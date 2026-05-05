// Stack Receipt — paper-receipt-styled summary of detected stack and likely
// commands. Same engine as the agent pack, narrower output.

import type { GhClient } from './github.ts';
import { packageFileCandidates } from './github.ts';
import type { Claim, GhRepo, Pack, RepoFile } from './types.ts';
import { claim, formatClaim } from './confidence.ts';
import { buildProvenance, provenanceFooter } from './provenance.ts';

export type StackItem = Claim<string>;

export type StackReceipt = {
  target: string;
  receiptId: string;
  language: string | null;
  items: StackItem[];
  commands: StackItem[];
  lastTouched: string;
  stars: number;
  sourceSha?: string;
};

export type ReceiptOptions = {
  toolVersion: string;
  generatedAt?: string;
};

export async function buildReceipt(
  client: GhClient,
  owner: string,
  repoName: string,
): Promise<Omit<StackReceipt, 'target'>> {
  const repo = await client.getRepo(owner, repoName);
  const sourceSha = await client.getRepoHeadSha(owner, repoName, repo.default_branch).catch(() => undefined);
  const filesSettled = await Promise.allSettled(
    packageFileCandidates().map((p) => client.getRepoFile(owner, repoName, p)),
  );
  const files = filesSettled
    .map((s) => (s.status === 'fulfilled' ? s.value : undefined))
    .filter((f): f is RepoFile => !!f);

  const items: StackItem[] = [];
  const commands: StackItem[] = [];

  if (repo.language) {
    items.push(claim(`Primary language: ${repo.language}`, 'high', [{ kind: 'field', ref: 'repo.language' }]));
  }

  for (const f of files) {
    items.push(claim(f.path, 'high', [{ kind: 'file', ref: f.path }]));
  }

  if (files.some((f) => f.path === 'package.json')) {
    const pkg = files.find((f) => f.path === 'package.json');
    let testCmd = 'npm test';
    if (pkg) {
      try {
        const json = JSON.parse(pkg.content) as { scripts?: Record<string, string> };
        if (json.scripts?.test) testCmd = `npm test  # ${json.scripts.test.slice(0, 50)}`;
      } catch {
        // ignore
      }
    }
    commands.push(claim('npm install', 'high', [{ kind: 'file', ref: 'package.json' }]));
    commands.push(claim(testCmd, 'high', [{ kind: 'file', ref: 'package.json' }]));
  }
  if (files.some((f) => f.path === 'pyproject.toml')) {
    commands.push(claim('pip install -e .', 'medium', [{ kind: 'file', ref: 'pyproject.toml' }]));
    commands.push(claim('python -m pytest', 'medium', [{ kind: 'file', ref: 'pyproject.toml' }]));
  }
  if (files.some((f) => f.path === 'requirements.txt')) {
    commands.push(claim('pip install -r requirements.txt', 'high', [{ kind: 'file', ref: 'requirements.txt' }]));
  }
  if (files.some((f) => f.path === 'go.mod')) {
    commands.push(claim('go test ./...', 'high', [{ kind: 'file', ref: 'go.mod' }]));
  }
  if (files.some((f) => f.path === 'Cargo.toml')) {
    commands.push(claim('cargo test', 'high', [{ kind: 'file', ref: 'Cargo.toml' }]));
  }
  if (files.some((f) => f.path === 'Makefile')) {
    commands.push(claim('make test', 'medium', [{ kind: 'file', ref: 'Makefile' }]));
  }

  const receiptId = receiptIdFor(repo);
  return {
    receiptId,
    language: repo.language,
    items,
    commands,
    lastTouched: repo.updated_at.slice(0, 10),
    stars: repo.stargazers_count,
    sourceSha,
  };
}

export async function buildReceiptPack(
  client: GhClient,
  owner: string,
  repoName: string,
  opts: ReceiptOptions,
): Promise<Pack> {
  const r = await buildReceipt(client, owner, repoName);
  const target = `${owner}/${repoName}`;
  const body = renderReceiptMarkdown({ ...r, target });
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
    redactions: 0,
  };
}

function receiptIdFor(repo: GhRepo): string {
  // Short, deterministic, human-friendly ID. Used in the visual receipt header
  // and on share artefacts.
  const seed = `${repo.full_name}@${repo.updated_at}`;
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const code = Math.abs(h).toString(36).slice(0, 6).toUpperCase().padEnd(6, '0');
  return `RC-${code}`;
}

function renderReceiptMarkdown(r: StackReceipt): string {
  const lines: string[] = [];
  lines.push('```');
  lines.push('       _____ _             _      ____               _      _   ');
  lines.push('      / ____| |           | |    |  _ \\             (_)    | |  ');
  lines.push('     | (___ | |_ __ _  ___| | __ | |_) | ___   ___   _ ___| |_ ');
  lines.push("      \\___ \\| __/ _` |/ __| |/ / |  _ < / _ \\ / _ \\ | / __| __|");
  lines.push('      ____) | || (_| | (__|   <  | |_) | (_) | (_) || \\__ \\ |_ ');
  lines.push('     |_____/ \\__\\__,_|\\___|_|\\_\\ |____/ \\___/ \\___(_) |___/\\__|');
  lines.push('                                                  _/ |          ');
  lines.push('                                                 |__/            ');
  lines.push('```');
  lines.push('');
  lines.push(`# ${r.target}`);
  lines.push(`Receipt ${r.receiptId} · ${r.language ?? 'mixed'} · ★ ${r.stars} · last touched ${r.lastTouched}`);
  lines.push('');
  lines.push('## Detected');
  for (const item of r.items) lines.push(`- ${formatClaim(item)}`);
  lines.push('');
  lines.push('## Commands an agent likely needs');
  if (r.commands.length === 0) {
    lines.push('- (no commands inferred — consult README)');
  } else {
    for (const c of r.commands) lines.push(`- ${formatClaim(c)}`);
  }
  lines.push('');
  return lines.join('\n') + '\n';
}
