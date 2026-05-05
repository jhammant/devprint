// Structured-JSON sidecar for the SPA. The agent endpoint returns markdown by
// default; the SPA also wants stack chips, a commit-style line, and the real
// 52-week commit-activity heatmap. Building these client-side would cost 30+
// GitHub calls per page render against the unauth 60/hr-per-IP ceiling — so
// the Lambda (which has a server-side token + CloudFront cache) builds them
// once and the SPA reads them as JSON.

import type { GhClient } from './github.ts';
import { packageFileCandidates } from './github.ts';
import { detectStack, mergeStacks, type StackInference } from './stack.ts';
import { inferCommitStyle, type CommitStyleVerdict } from './commits.ts';
import { scoreRepo } from './infer.ts';
import { scrub } from './scrub.ts';
import type { GhRepo, RepoFile } from './types.ts';

export type CommitActivityWeek = { week: number; total: number };

export type Insights = {
  target: string;
  kind: 'user' | 'repo';
  generatedAt: string;
  stack: StackInference;
  /** For user insights, per-repo stack across top 3 active repos. */
  perRepoStack?: Array<{ repo: string; stack: StackInference }>;
  commitStyle?: CommitStyleVerdict;
  /** 52 weeks of commit counts (oldest first) — when GitHub has cached stats. */
  commitActivity?: CommitActivityWeek[];
  /** Repo whose commit activity we used (for users we pick the top-scored repo). */
  commitActivitySource?: string;
};

export type BuildInsightsOptions = {
  generatedAt?: string;
  /** Limit how many repos to scan for stack inference. */
  topRepoCount?: number;
};

export async function buildUserInsights(
  client: GhClient,
  user: string,
  opts: BuildInsightsOptions = {},
): Promise<Insights> {
  const reposRaw = await client.listUserRepos(user, { max: 100 });
  const repos = reposRaw.filter((r) => !r.fork).sort((a, b) => scoreRepo(b) - scoreRepo(a));
  const top = repos.slice(0, opts.topRepoCount ?? 3);

  const perRepoStack: Array<{ repo: string; stack: StackInference }> = [];
  const stacks: StackInference[] = [];
  await Promise.all(
    top.map(async (r) => {
      const owner = r.full_name.split('/')[0];
      const stack = await detectRepoStack(client, owner, r.name);
      perRepoStack.push({ repo: r.name, stack });
      stacks.push(stack);
    }),
  );

  // Commit activity for the top repo only (one /stats call per page render).
  let commitActivity: CommitActivityWeek[] | undefined;
  let commitActivitySource: string | undefined;
  if (top.length) {
    const r = top[0];
    const owner = r.full_name.split('/')[0];
    try {
      const ca = await client.getCommitActivity(owner, r.name);
      if (ca && ca.length) {
        commitActivity = ca;
        commitActivitySource = r.full_name;
      }
    } catch {
      // ignore — heatmap is a best-effort enhancement.
    }
  }

  return {
    target: user,
    kind: 'user',
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    stack: mergeStacks(stacks),
    perRepoStack,
    ...(commitActivity ? { commitActivity, commitActivitySource } : {}),
  };
}

export async function buildRepoInsights(
  client: GhClient,
  owner: string,
  repoName: string,
  opts: BuildInsightsOptions = {},
): Promise<Insights> {
  const [stack, commits, ca] = await Promise.all([
    detectRepoStack(client, owner, repoName),
    client.getRecentCommits(owner, repoName, undefined, 30).catch(() => []),
    client.getCommitActivity(owner, repoName).catch(() => undefined),
  ]);
  const commitStyle = inferCommitStyle(commits);
  return {
    target: `${owner}/${repoName}`,
    kind: 'repo',
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    stack,
    commitStyle,
    ...(ca && ca.length ? { commitActivity: ca, commitActivitySource: `${owner}/${repoName}` } : {}),
  };
}

async function detectRepoStack(
  client: GhClient,
  owner: string,
  repo: string,
): Promise<StackInference> {
  const filesSettled = await Promise.allSettled(
    packageFileCandidates().map((p) => client.getRepoFile(owner, repo, p)),
  );
  const files = filesSettled
    .map((s) => (s.status === 'fulfilled' ? s.value : undefined))
    .filter((f): f is RepoFile => !!f);
  // Scrub before parsing so secret-shaped values can't leak through evidence
  // strings even though the stack module only inspects keys.
  const safe = files.map((f) => ({ ...f, content: scrub(f.content, 'config').text }));
  return detectStack(safe);
}

// Re-export for SPA-side typing convenience.
export type { GhRepo };
