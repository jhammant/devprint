import type { GhClient } from './github.ts';
import { packageFileCandidates } from './github.ts';
import type {
  Claim,
  Evidence,
  GhRepo,
  GhUser,
  Pack,
  RepoFile,
  Themes,
} from './types.ts';
import { archetype, battleStats, getThemes, scoreRepo } from './infer.ts';
import { claim, formatClaim } from './confidence.ts';
import { scrub, summariseRedactions, type Redaction } from './scrub.ts';
import {
  buildProvenance,
  provenanceFooter,
} from './provenance.ts';

export type PackOptions = {
  toolVersion: string;
  generatedAt?: string;
  hashFn?: (s: string) => Promise<string>;
};

export async function buildUserPack(
  client: GhClient,
  owner: string,
  opts: PackOptions,
): Promise<Pack> {
  const profile = await client.getUser(owner);
  const reposRaw = await client.listUserRepos(owner, { max: 100 });
  const repos = reposRaw.filter((r) => !r.fork).sort((a, b) => scoreRepo(b) - scoreRepo(a));
  const langs = countLanguages(repos);
  const themes = getThemes(repos);
  const arch = archetype(langs, repos);
  const totalStars = repos.reduce((n, r) => n + r.stargazers_count, 0);
  const battle = battleStats(profile, repos, langs, totalStars, themes);

  const allRedactions: Redaction[] = [];
  const safeDescriptions = repos.slice(0, 8).map((r) => {
    const s = scrub(r.description ?? '', 'description');
    allRedactions.push(...s.redactions);
    return { repo: r, description: s.text };
  });

  const body = renderUserMarkdown({
    target: owner,
    profile,
    repos,
    langs,
    themes,
    archetype: arch,
    totalStars,
    battle,
    safeDescriptions,
    redactions: allRedactions,
  });

  const provenance = await buildProvenance({
    body,
    toolVersion: opts.toolVersion,
    generatedAt: opts.generatedAt,
    hashFn: opts.hashFn,
  });

  return {
    target: owner,
    kind: 'user',
    markdown: body + provenanceFooter(provenance),
    provenance,
    redactions: allRedactions.length,
  };
}

export async function buildRepoPack(
  client: GhClient,
  owner: string,
  repoName: string,
  opts: PackOptions,
): Promise<Pack> {
  const [profile, repo] = await Promise.all([
    client.getUser(owner),
    client.getRepo(owner, repoName),
  ]);

  const repos: GhRepo[] = [repo];
  const langs: Record<string, number> = repo.language ? { [repo.language]: 1 } : {};
  const themes = getThemes(repos);
  const arch = `${repo.language ?? 'Mixed'} Repo`;
  const totalStars = repo.stargazers_count;
  const battle = battleStats(profile, repos, langs, totalStars, themes, repo);

  const sourceSha = await client.getRepoHeadSha(owner, repoName, repo.default_branch).catch(() => undefined);

  // Fetch README + plausible package files in parallel; never let a single
  // failure poison the pack.
  const readmeP = client.getReadme(owner, repoName).catch(() => undefined);
  const filesP = Promise.allSettled(
    packageFileCandidates().map((p) => client.getRepoFile(owner, repoName, p)),
  );

  const [readmeRaw, filesSettled] = await Promise.all([readmeP, filesP]);
  const presentFiles = filesSettled
    .map((s) => (s.status === 'fulfilled' ? s.value : undefined))
    .filter((f): f is RepoFile => !!f);

  const allRedactions: Redaction[] = [];
  const readme = readmeRaw ? scrub(readmeRaw, 'readme') : undefined;
  if (readme) allRedactions.push(...readme.redactions);

  const safeRepoDescription = scrub(repo.description ?? '', 'description');
  allRedactions.push(...safeRepoDescription.redactions);

  const safePackageFiles = presentFiles.map((f) => {
    const s = scrub(f.content, 'config');
    allRedactions.push(...s.redactions);
    return { ...f, content: s.text };
  });

  const setupClaims = inferSetupCommands(safePackageFiles, repo);

  const body = renderRepoMarkdown({
    target: `${owner}/${repoName}`,
    profile,
    repo,
    repoDescription: safeRepoDescription.text,
    readme: readme?.text,
    files: safePackageFiles,
    setupClaims,
    archetype: arch,
    battle,
    redactions: allRedactions,
  });

  const provenance = await buildProvenance({
    body,
    toolVersion: opts.toolVersion,
    sourceSha,
    generatedAt: opts.generatedAt,
    hashFn: opts.hashFn,
  });

  return {
    target: `${owner}/${repoName}`,
    kind: 'repo',
    markdown: body + provenanceFooter(provenance),
    provenance,
    redactions: allRedactions.length,
  };
}

function countLanguages(repos: readonly GhRepo[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of repos) if (r.language) out[r.language] = (out[r.language] ?? 0) + 1;
  return out;
}

function inferSetupCommands(files: readonly RepoFile[], repo: GhRepo): Claim<string>[] {
  const claims: Claim<string>[] = [];
  const has = (name: string) => files.some((f) => f.path === name);

  if (has('package.json')) {
    const pkg = files.find((f) => f.path === 'package.json');
    const ev: Evidence[] = [{ kind: 'file', ref: 'package.json' }];
    let testCmd = 'npm test';
    if (pkg) {
      try {
        const json = JSON.parse(pkg.content) as { scripts?: Record<string, string> };
        if (json.scripts?.test) testCmd = `npm test  # ${json.scripts.test.slice(0, 60)}`;
      } catch {
        // malformed package.json — keep default
      }
    }
    claims.push(claim('npm install', 'high', ev));
    claims.push(claim(testCmd, 'high', ev));
    claims.push(claim('npm run build', 'medium', ev));
  }
  if (has('pyproject.toml') || has('requirements.txt')) {
    const ev: Evidence[] = has('pyproject.toml')
      ? [{ kind: 'file', ref: 'pyproject.toml' }]
      : [{ kind: 'file', ref: 'requirements.txt' }];
    claims.push(claim('pip install -r requirements.txt', 'high', ev));
    claims.push(claim('python -m pytest', 'medium', ev));
  }
  if (has('go.mod')) {
    claims.push(claim('go test ./...', 'high', [{ kind: 'file', ref: 'go.mod' }]));
  }
  if (has('Cargo.toml')) {
    claims.push(claim('cargo test', 'high', [{ kind: 'file', ref: 'Cargo.toml' }]));
  }
  if (has('Makefile')) {
    claims.push(claim('make test', 'medium', [{ kind: 'file', ref: 'Makefile' }]));
  }
  if (claims.length === 0) {
    claims.push(
      claim(
        'inspect README and package files before running commands',
        'low',
        [{ kind: 'derived', ref: `${repo.full_name} has no recognised package file` }],
      ),
    );
  }
  return claims;
}

// ---- markdown renderers ----

type UserRender = {
  target: string;
  profile: GhUser;
  repos: readonly GhRepo[];
  langs: Record<string, number>;
  themes: Themes;
  archetype: string;
  totalStars: number;
  battle: ReturnType<typeof battleStats>;
  safeDescriptions: { repo: GhRepo; description: string }[];
  redactions: readonly Redaction[];
};

function renderUserMarkdown(m: UserRender): string {
  const topLangs = Object.entries(m.langs).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const top = topLangs.map(([l, c]) => `${l} (${c})`).join(', ') || 'unknown';

  const lines: string[] = [];
  lines.push(`# Devprint Agent Pack: ${m.target}`);
  lines.push('');
  lines.push(`Purpose: brief an AI coding agent on ${m.profile.name ?? m.profile.login}'s public GitHub footprint.`);
  lines.push('');
  lines.push('## Target');
  lines.push(`- Type: GitHub user`);
  lines.push(`- GitHub: https://github.com/${m.target}`);
  lines.push(`- Owner: ${m.profile.login}`);
  lines.push(`- Public repos analysed: ${m.repos.length}`);
  lines.push(`- Stars observed across portfolio: ${m.totalStars}`);
  lines.push('');
  lines.push('## High-level read');
  lines.push(`- Archetype: ${m.archetype}`);
  lines.push(`- Main languages: ${top}`);
  lines.push(`- Themes: ${m.themes.map(([t]) => t).join(', ') || 'unclear'}`);
  lines.push(`- Builder Battle Card: ${m.battle.tier} (build ${m.battle.build.value} · impact ${m.battle.impact.value} · momentum ${m.battle.momentum.value})`);
  lines.push('');
  lines.push('## Repos to inspect first');
  for (const { repo, description } of m.safeDescriptions) {
    lines.push(`- **${repo.name}**: ${description || 'no description'} [${repo.language ?? 'mixed'}; ★ ${repo.stargazers_count}; updated ${shortDate(repo.updated_at)}]`);
  }
  lines.push('');
  lines.push('## Agent operating guidance');
  lines.push('- Start by reading READMEs, package/build files, and recent commits.');
  lines.push('- Only public GitHub data was used; do not assume private context.');
  lines.push('- Prefer small, reversible changes; run the smallest relevant test/build command.');
  lines.push("- Preserve the repo's apparent stack and style unless asked to refactor.");
  lines.push('- If working across this user\'s portfolio, identify the active repo first; older repos are often experiments.');
  lines.push('');
  lines.push('## Starter prompts');
  lines.push("- Summarise this user's most active project and pick a small concrete improvement.");
  lines.push('- Find the fastest useful test/build gate in the most-starred repo.');
  lines.push('- Identify stale TODOs, broken setup steps, or missing README instructions in the top 3 projects.');

  appendRedactionNote(lines, m.redactions);
  return lines.join('\n') + '\n';
}

type RepoRender = {
  target: string;
  profile: GhUser;
  repo: GhRepo;
  repoDescription: string;
  readme?: string;
  files: readonly RepoFile[];
  setupClaims: readonly Claim<string>[];
  archetype: string;
  battle: ReturnType<typeof battleStats>;
  redactions: readonly Redaction[];
};

function renderRepoMarkdown(m: RepoRender): string {
  const lines: string[] = [];
  lines.push(`# Devprint Agent Pack: ${m.target}`);
  lines.push('');
  lines.push(`Purpose: brief an AI coding agent before it touches \`${m.target}\`.`);
  lines.push('');
  lines.push('## Target');
  lines.push(`- Type: Repository`);
  lines.push(`- GitHub: https://github.com/${m.target}`);
  lines.push(`- Owner: ${m.profile.login}`);
  lines.push(`- Default branch: ${m.repo.default_branch ?? 'main'}`);
  lines.push(`- Stars: ${m.repo.stargazers_count} · Forks: ${m.repo.forks_count} · Open issues: ${m.repo.open_issues_count}`);
  lines.push(`- Last update: ${shortDate(m.repo.updated_at)}`);
  if (m.repo.license?.spdx_id) lines.push(`- License: ${m.repo.license.spdx_id}`);
  lines.push('');
  if (m.repoDescription) {
    lines.push('## Description');
    lines.push(m.repoDescription);
    lines.push('');
  }
  lines.push('## High-level read');
  lines.push(`- Archetype: ${m.archetype}`);
  lines.push(`- Repo Battle Card: ${m.battle.tier} (build ${m.battle.build.value} · impact ${m.battle.impact.value} · momentum ${m.battle.momentum.value})`);
  lines.push('');

  lines.push('## Likely setup / test commands');
  if (m.setupClaims.length) {
    for (const c of m.setupClaims) lines.push(`- ${formatClaim(c)}`);
  } else {
    lines.push('- inspect README and package files before running commands');
  }
  lines.push('');

  lines.push('## Files to inspect first');
  lines.push('- README.md');
  for (const f of m.files) lines.push(`- ${f.path}`);
  lines.push('');

  if (m.readme) {
    const snippet = m.readme.split('\n').slice(0, 30).join('\n').trim();
    lines.push('## README excerpt (first 30 lines, scrubbed)');
    lines.push('```');
    lines.push(snippet);
    lines.push('```');
    lines.push('');
  }

  lines.push('## Agent operating guidance');
  lines.push('- Read the listed files in order before proposing changes.');
  lines.push('- Run the smallest relevant test/build command before reporting success.');
  lines.push("- Preserve the repo's stack and style unless asked to refactor.");
  lines.push('- Treat any redacted strings as known secrets — do not try to reconstruct them.');
  lines.push('');
  lines.push('## Starter prompts');
  lines.push('- Summarise this repo\'s architecture and entry points in 5 bullets.');
  lines.push('- Find and run the fastest useful test gate.');
  lines.push('- Propose one small, reversible improvement that matches the existing style.');

  appendRedactionNote(lines, m.redactions);
  return lines.join('\n') + '\n';
}

function appendRedactionNote(lines: string[], redactions: readonly Redaction[]) {
  if (redactions.length === 0) return;
  lines.push('');
  lines.push(`> **Scrubber note:** ${redactions.length} secret-shaped string(s) redacted before this pack was assembled (${summariseRedactions(redactions)}). Their values are not included anywhere in this output.`);
}

function shortDate(iso: string): string {
  return iso.slice(0, 10);
}
