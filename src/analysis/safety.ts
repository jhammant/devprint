import type { GhClient } from './github.ts';
import { packageFileCandidates } from './github.ts';
import type { Claim, GhRepo, RepoFile } from './types.ts';
import { claim, formatClaim } from './confidence.ts';
import { scrub, summariseRedactions, type Redaction } from './scrub.ts';
import { buildProvenance, provenanceFooter } from './provenance.ts';
import type { Pack } from './types.ts';

export type SafetyTier = 'safe' | 'caution' | 'risky';

export type SafetyFlag = Claim<string>;

export type SafetyReport = {
  target: string;
  tier: SafetyTier;
  verdict: string;
  flags: SafetyFlag[];
  greens: SafetyFlag[];
  redactions: Redaction[];
  sourceSha?: string;
};

export type SafetyOptions = {
  toolVersion: string;
  generatedAt?: string;
};

export async function buildSafetyReport(
  client: GhClient,
  owner: string,
  repoName: string,
): Promise<Omit<SafetyReport, 'target'>> {
  const repo = await client.getRepo(owner, repoName);
  const sourceSha = await client.getRepoHeadSha(owner, repoName, repo.default_branch).catch(() => undefined);

  const filesSettled = await Promise.allSettled(
    packageFileCandidates().map((p) => client.getRepoFile(owner, repoName, p)),
  );
  const files = filesSettled
    .map((s) => (s.status === 'fulfilled' ? s.value : undefined))
    .filter((f): f is RepoFile => !!f);

  const readme = await client.getReadme(owner, repoName).catch(() => undefined);
  const readmeScrub = readme ? scrub(readme, 'readme') : undefined;
  const allRedactions: Redaction[] = readmeScrub?.redactions ?? [];

  const flags: SafetyFlag[] = [];
  const greens: SafetyFlag[] = [];

  // License
  if (!repo.license?.spdx_id || repo.license.spdx_id === 'NOASSERTION') {
    flags.push(claim('No LICENSE detected — copying or merging code from this repo carries legal risk.', 'high', [{ kind: 'field', ref: 'repo.license' }]));
  } else {
    greens.push(claim(`License: ${repo.license.spdx_id}`, 'high', [{ kind: 'field', ref: 'repo.license.spdx_id' }]));
  }

  // Stale repo
  const ageDays = (Date.now() - new Date(repo.updated_at).getTime()) / 86_400_000;
  if (ageDays > 365) {
    flags.push(claim(`Last update ${Math.floor(ageDays / 30)} months ago — likely abandoned.`, 'high', [{ kind: 'field', ref: 'repo.updated_at' }]));
  } else if (ageDays > 180) {
    flags.push(claim(`Last update ${Math.floor(ageDays / 30)} months ago — quiet.`, 'medium', [{ kind: 'field', ref: 'repo.updated_at' }]));
  } else {
    greens.push(claim(`Recently updated (${Math.floor(ageDays)}d ago).`, 'high', [{ kind: 'field', ref: 'repo.updated_at' }]));
  }

  // Lockfile + install scripts (package.json)
  const pkg = files.find((f) => f.path === 'package.json');
  if (pkg) {
    try {
      const json = JSON.parse(pkg.content) as { scripts?: Record<string, string> };
      const scripts = json.scripts ?? {};
      for (const k of ['preinstall', 'install', 'postinstall']) {
        if (scripts[k]) {
          flags.push(
            claim(
              `package.json has \`${k}\` script — agents should run install with --ignore-scripts.`,
              'high',
              [{ kind: 'file', ref: 'package.json' }],
            ),
          );
        }
      }
    } catch {
      flags.push(claim('package.json is present but malformed.', 'medium', [{ kind: 'file', ref: 'package.json' }]));
    }
  }

  // Tests heuristic
  const hasTestSignal =
    /scripts.+test/.test(pkg?.content ?? '') ||
    files.some((f) => f.path === 'pyproject.toml' && /pytest|tests?/i.test(f.content)) ||
    files.some((f) => f.path === 'go.mod');
  if (!hasTestSignal) {
    flags.push(claim('No obvious test gate detected — verify behaviour manually before declaring success.', 'medium', [{ kind: 'derived', ref: 'no test scripts in package files' }]));
  }

  // SECURITY.md / CODE_OF_CONDUCT presence
  const security = await client.getRepoFile(owner, repoName, 'SECURITY.md').catch(() => undefined);
  if (security) greens.push(claim('SECURITY.md present.', 'high', [{ kind: 'file', ref: 'SECURITY.md' }]));

  // Secret-shaped strings in README
  if ((readmeScrub?.redactions.length ?? 0) > 0) {
    flags.push(
      claim(
        `README contains ${readmeScrub!.redactions.length} secret-shaped string(s); they are redacted in any pack output.`,
        'high',
        [{ kind: 'file', ref: 'README.md' }],
      ),
    );
  }

  // Tier
  const highFlags = flags.filter((f) => f.confidence === 'high').length;
  const tier: SafetyTier = highFlags >= 2 ? 'risky' : highFlags === 1 || flags.length >= 3 ? 'caution' : 'safe';
  const verdict =
    tier === 'safe'
      ? `Safe to clone and run standard setup. ${repo.full_name} looks unremarkable.`
      : tier === 'caution'
        ? `Clone is fine, but DO NOT run install scripts blindly. Verify ${flags.length} flag(s) below.`
        : `Treat ${repo.full_name} as untrusted. Run only inside a sandbox. ${highFlags} high-severity flag(s).`;

  return { tier, verdict, flags, greens, redactions: allRedactions, sourceSha };
}

export async function buildSafetyPack(
  client: GhClient,
  owner: string,
  repoName: string,
  opts: SafetyOptions,
): Promise<Pack> {
  const r = await buildSafetyReport(client, owner, repoName);
  const target = `${owner}/${repoName}`;
  const body = renderSafetyMarkdown({ ...r, target });
  const provenance = await buildProvenance({
    body,
    toolVersion: opts.toolVersion,
    sourceSha: r.sourceSha,
    generatedAt: opts.generatedAt,
  });
  return {
    target,
    kind: 'repo',
    markdown: body + provenanceFooter(provenance),
    provenance,
    redactions: r.redactions.length,
  };
}

function renderSafetyMarkdown(r: SafetyReport): string {
  const lines: string[] = [];
  lines.push(`# Safety Brief: ${r.target}`);
  lines.push('');
  lines.push(`**Tier:** ${r.tier.toUpperCase()}`);
  lines.push('');
  lines.push(`> ${r.verdict}`);
  lines.push('');

  if (r.flags.length) {
    lines.push('## Flags');
    for (const f of r.flags) lines.push(`- ⚠️ ${formatClaim(f)}`);
    lines.push('');
  }

  if (r.greens.length) {
    lines.push('## OK signals');
    for (const g of r.greens) lines.push(`- ✅ ${formatClaim(g)}`);
    lines.push('');
  }

  lines.push('## Agent decision template');
  lines.push('- **Clone:** ' + (r.tier === 'risky' ? 'YES, but only into a sandbox or container.' : 'YES.'));
  lines.push('- **Install:** ' + (r.flags.some((f) => /install/i.test(f.value)) ? 'YES with `--ignore-scripts` or equivalent.' : 'YES, standard.'));
  lines.push('- **Run setup commands:** ' + (r.tier === 'safe' ? 'YES.' : 'Only after reviewing flags above.'));
  lines.push('- **Trust outputs:** ' + (r.tier === 'safe' ? 'Reasonable.' : 'Verify against fresh checkout.'));
  lines.push('');

  if (r.redactions.length) {
    lines.push(`> **Scrubber note:** ${r.redactions.length} secret-shaped string(s) detected in source files (${summariseRedactions(r.redactions)}). Their values are not included anywhere in this output.`);
  }

  return lines.join('\n') + '\n';
}
