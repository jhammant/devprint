// Structured-JSON sidecar for the SPA. The agent endpoint returns markdown by
// default; the SPA also wants stack chips, a commit-style line, the real
// 52-week commit-activity heatmap, and a "related people" panel. Building
// these client-side would cost 30+ GitHub calls per page render against the
// unauth 60/hr-per-IP ceiling — so the Lambda (which has a server-side token
// + CloudFront cache) builds them once and the SPA reads them as JSON.

import type { GhClient } from './github.ts';
import { packageFileCandidates } from './github.ts';
import { detectStack, mergeStacks, type StackInference } from './stack.ts';
import { inferCommitStyle, type CommitStyleVerdict } from './commits.ts';
import { scoreRepo } from './infer.ts';
import { scrub } from './scrub.ts';
import type { GhContributor, GhRepo, RepoFile } from './types.ts';

export type CommitActivityWeek = { week: number; total: number };

export type RelatedProfile = {
  login: string;
  avatar_url: string;
  contributions: number;
  /** For user insights, the repo we found this contributor through. */
  viaRepo?: string;
};

export type Insights = {
  target: string;
  kind: 'user' | 'repo';
  generatedAt: string;
  stack: StackInference;
  /** For user insights, per-repo stack across top 3 active repos. */
  perRepoStack?: Array<{ repo: string; stack: StackInference }>;
  commitStyle?: CommitStyleVerdict;
  /**
   * 52 weeks of commit counts (oldest first). For user insights this is the
   * sum across top-3 repos (a "personal pulse"); for repo insights it's the
   * single repo. Undefined when GitHub's cache hasn't built it yet.
   */
  commitActivity?: CommitActivityWeek[];
  /** Repo (single) or comma-joined repo list (user) whose data we summed. */
  commitActivitySource?: string;
  /**
   * People who often build with this person (user pages) or top contributors
   * to this repo (repo pages). Excludes bot accounts and the user themselves.
   */
  relatedProfiles?: RelatedProfile[];
  /**
   * For user pages where listUserRepos hit the 100-repo cap. Lets the SPA say
   * "top 100 of N by recency" instead of pretending the analysis covers
   * everything.
   */
  reposAnalysed?: number;
  publicReposTotal?: number;
};

export type BuildInsightsOptions = {
  generatedAt?: string;
  /** Limit how many repos to scan for stack inference. Default 3. */
  topRepoCount?: number;
};

const TOP_REPOS_DEFAULT = 3;
const RELATED_PROFILE_LIMIT = 8;
// When the top-3 manifest scan yields zero detected libs, broaden to this
// many repos before giving up. Catches the sindresorhus case where his
// top-by-score repos happen to be README-only awesome lists.
const FALLBACK_REPO_COUNT = 8;

export async function buildUserInsights(
  client: GhClient,
  user: string,
  opts: BuildInsightsOptions = {},
): Promise<Insights> {
  const reposRaw = await client.listUserRepos(user, { max: 100 });
  const profile = await client.getUser(user).catch(() => undefined);
  const repos = reposRaw.filter((r) => !r.fork).sort((a, b) => scoreRepo(b) - scoreRepo(a));
  const initialN = opts.topRepoCount ?? TOP_REPOS_DEFAULT;
  let top = repos.slice(0, initialN);

  let { perRepoStack, stacks } = await scanStacks(client, top);
  // Broaden when the merged top-N yields no detected libs (typical for
  // README-only "awesome-*" repos at the top of a maintainer's list).
  if (mergeStacks(stacks).detected.length === 0 && repos.length > initialN) {
    const broadenedTop = repos.slice(0, FALLBACK_REPO_COUNT);
    const broadened = await scanStacks(client, broadenedTop);
    if (broadened.stacks.some((s) => s.detected.length > 0)) {
      perRepoStack = broadened.perRepoStack;
      stacks = broadened.stacks;
      top = broadenedTop;
    }
  }

  // Aggregate commit activity across the top 3 repos so the chart reflects
  // "this person's pulse", not just one project's. Each /stats call may
  // return undefined while GitHub warms the cache — we silently drop those.
  const aggregated = await aggregateCommitActivity(client, top.slice(0, TOP_REPOS_DEFAULT));

  // "Often building with" — top contributors across top 3 repos, excluding
  // the user themselves and any bot accounts.
  const relatedProfiles = await collectUserCollaborators(
    client,
    top.slice(0, TOP_REPOS_DEFAULT),
    user,
  );

  const reposAnalysed = repos.length;
  const publicReposTotal = profile?.public_repos;

  return {
    target: user,
    kind: 'user',
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    stack: mergeStacks(stacks),
    perRepoStack,
    ...(aggregated ? { commitActivity: aggregated.weeks, commitActivitySource: aggregated.source } : {}),
    ...(relatedProfiles.length ? { relatedProfiles } : {}),
    reposAnalysed,
    ...(publicReposTotal !== undefined ? { publicReposTotal } : {}),
  };
}

export async function buildRepoInsights(
  client: GhClient,
  owner: string,
  repoName: string,
  opts: BuildInsightsOptions = {},
): Promise<Insights> {
  const [stack, commits, ca, contributors] = await Promise.all([
    detectRepoStack(client, owner, repoName),
    client.getRecentCommits(owner, repoName, undefined, 30).catch(() => []),
    client.getCommitActivity(owner, repoName).catch(() => undefined),
    client.getContributors(owner, repoName, RELATED_PROFILE_LIMIT).catch(() => []),
  ]);
  const commitStyle = inferCommitStyle(commits);
  const relatedProfiles: RelatedProfile[] = contributors
    .slice(0, RELATED_PROFILE_LIMIT)
    .map((c) => ({ login: c.login, avatar_url: c.avatar_url, contributions: c.contributions }));
  return {
    target: `${owner}/${repoName}`,
    kind: 'repo',
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    stack,
    commitStyle,
    ...(ca && ca.length ? { commitActivity: ca, commitActivitySource: `${owner}/${repoName}` } : {}),
    ...(relatedProfiles.length ? { relatedProfiles } : {}),
  };
}

// ---- helpers --------------------------------------------------------------

async function scanStacks(
  client: GhClient,
  repos: readonly GhRepo[],
): Promise<{ perRepoStack: Array<{ repo: string; stack: StackInference }>; stacks: StackInference[] }> {
  const perRepoStack: Array<{ repo: string; stack: StackInference }> = [];
  const stacks: StackInference[] = [];
  await Promise.all(
    repos.map(async (r) => {
      const owner = r.full_name.split('/')[0];
      const stack = await detectRepoStack(client, owner, r.name);
      perRepoStack.push({ repo: r.name, stack });
      stacks.push(stack);
    }),
  );
  return { perRepoStack, stacks };
}

async function aggregateCommitActivity(
  client: GhClient,
  repos: readonly GhRepo[],
): Promise<{ weeks: CommitActivityWeek[]; source: string } | undefined> {
  if (repos.length === 0) return undefined;
  const results = await Promise.all(
    repos.map(async (r) => {
      const owner = r.full_name.split('/')[0];
      try {
        return { repo: r.full_name, ca: await client.getCommitActivity(owner, r.name) };
      } catch {
        return { repo: r.full_name, ca: undefined };
      }
    }),
  );
  const usable = results.filter((x): x is { repo: string; ca: CommitActivityWeek[] } => !!x.ca && x.ca.length > 0);
  if (usable.length === 0) return undefined;

  // Align on the union of week timestamps. GitHub buckets by Sunday midnight
  // UTC so the timestamps line up across repos already; just sum totals.
  const totalsByWeek = new Map<number, number>();
  for (const { ca } of usable) {
    for (const w of ca) {
      totalsByWeek.set(w.week, (totalsByWeek.get(w.week) ?? 0) + w.total);
    }
  }
  const weeks = Array.from(totalsByWeek.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, total]) => ({ week, total }));
  const source = usable.map((u) => u.repo).join(', ');
  return { weeks, source };
}

async function collectUserCollaborators(
  client: GhClient,
  repos: readonly GhRepo[],
  excludeLogin: string,
): Promise<RelatedProfile[]> {
  if (repos.length === 0) return [];
  const results = await Promise.all(
    repos.map(async (r) => {
      const owner = r.full_name.split('/')[0];
      try {
        const list = await client.getContributors(owner, r.name, RELATED_PROFILE_LIMIT);
        return list.map((c) => ({ ...c, viaRepo: r.name }));
      } catch {
        return [] as Array<GhContributor & { viaRepo: string }>;
      }
    }),
  );

  // Dedupe by login (keep highest-contribution row), drop the user themselves.
  const byLogin = new Map<string, RelatedProfile>();
  const lowerExclude = excludeLogin.toLowerCase();
  for (const list of results) {
    for (const c of list) {
      if (c.login.toLowerCase() === lowerExclude) continue;
      const existing = byLogin.get(c.login);
      if (!existing || c.contributions > existing.contributions) {
        byLogin.set(c.login, {
          login: c.login,
          avatar_url: c.avatar_url,
          contributions: c.contributions,
          viaRepo: c.viaRepo,
        });
      }
    }
  }
  return Array.from(byLogin.values())
    .sort((a, b) => b.contributions - a.contributions)
    .slice(0, RELATED_PROFILE_LIMIT);
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
