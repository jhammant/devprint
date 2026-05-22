import { describe, expect, it } from 'vitest';
import { buildRepoInsights, buildUserInsights } from '../../src/analysis/insights.ts';
import type { GhClient } from '../../src/analysis/github.ts';
import type { GhRepo, GhUser } from '../../src/analysis/types.ts';

const profile: GhUser = {
  login: 'jhammant', name: 'J', avatar_url: '', public_repos: 3, followers: 1,
};

const baseRepo = (over: Partial<GhRepo> = {}): GhRepo => ({
  name: 'r', full_name: 'jhammant/r', description: null, html_url: '',
  language: null, stargazers_count: 0, forks_count: 0, watchers_count: 0,
  open_issues_count: 0, fork: false, updated_at: '2026-04-01T00:00:00Z',
  default_branch: 'main', ...over,
});

function client(over: Partial<GhClient> = {}): GhClient {
  return {
    getUser: async () => profile,
    getRepo: async (_o, name) => baseRepo({ name, full_name: `jhammant/${name}` }),
    listUserRepos: async () => [baseRepo({ name: 'top', stargazers_count: 50 })],
    getReadme: async () => undefined,
    getRepoFile: async () => undefined,
    getRepoHeadSha: async () => undefined,
    getRecentCommits: async () => [],
    getCommitActivity: async () => undefined,
    getContributors: async () => [],
    ...over,
  };
}

describe('buildUserInsights', () => {
  it('detects stack across top repos and pulls heatmap from top repo', async () => {
    const c = client({
      getRepoFile: async (_o, _r, p) =>
        p === 'package.json'
          ? { path: p, content: JSON.stringify({ dependencies: { next: '14' } }) }
          : undefined,
      getCommitActivity: async () => [
        { week: 1700000000, total: 4 },
        { week: 1700604800, total: 6 },
      ],
    });
    const insights = await buildUserInsights(c, 'jhammant');
    expect(insights.kind).toBe('user');
    expect(insights.stack.detected.map((d) => d.name)).toContain('Next.js');
    expect(insights.commitActivity).toHaveLength(2);
    expect(insights.perRepoStack?.length).toBeGreaterThan(0);
  });

  it('survives missing manifests and missing heatmap', async () => {
    const insights = await buildUserInsights(client(), 'jhammant');
    expect(insights.stack.detected).toEqual([]);
    expect(insights.commitActivity).toBeUndefined();
  });

  it('aggregates commit activity across top 3 repos and sums same-week buckets', async () => {
    const repos: GhRepo[] = [
      baseRepo({ name: 'a', full_name: 'jhammant/a', stargazers_count: 90 }),
      baseRepo({ name: 'b', full_name: 'jhammant/b', stargazers_count: 80 }),
      baseRepo({ name: 'c', full_name: 'jhammant/c', stargazers_count: 70 }),
    ];
    const c = client({
      listUserRepos: async () => repos,
      getCommitActivity: async (_o, name) => {
        if (name === 'a') return [{ week: 1700000000, total: 3 }, { week: 1700604800, total: 4 }];
        if (name === 'b') return [{ week: 1700000000, total: 2 }];
        return undefined; // 'c' has no cached stats yet
      },
    });
    const insights = await buildUserInsights(c, 'jhammant');
    expect(insights.commitActivity).toBeDefined();
    const week0 = insights.commitActivity!.find((w) => w.week === 1700000000);
    expect(week0?.total).toBe(5); // 3 + 2
    expect(insights.commitActivitySource).toContain('jhammant/a');
    expect(insights.commitActivitySource).toContain('jhammant/b');
  });

  it('returns relatedProfiles excluding the user themselves and bots', async () => {
    const repos: GhRepo[] = [
      baseRepo({ name: 'top', full_name: 'jhammant/top', stargazers_count: 50 }),
    ];
    const c = client({
      listUserRepos: async () => repos,
      getContributors: async () => [
        { login: 'jhammant', avatar_url: '', contributions: 200 }, // self → excluded
        { login: 'alice', avatar_url: 'a.png', contributions: 80 },
        { login: 'bob', avatar_url: 'b.png', contributions: 30 },
      ],
    });
    const insights = await buildUserInsights(c, 'jhammant');
    const logins = (insights.relatedProfiles ?? []).map((p) => p.login);
    expect(logins).not.toContain('jhammant');
    expect(logins).toContain('alice');
    expect(logins[0]).toBe('alice'); // sorted by contributions
  });

  it('broadens manifest scan when top-3 yields zero detected libs', async () => {
    // Six repos: top 3 are README-only awesome lists (no manifests). Repos
    // 4-6 have package.json. Without the broadened scan we'd return an empty
    // detected[]. With it we should pick up the framework.
    const repos: GhRepo[] = [
      baseRepo({ name: 'awesome-x', full_name: 'jhammant/awesome-x', stargazers_count: 1000 }),
      baseRepo({ name: 'awesome-y', full_name: 'jhammant/awesome-y', stargazers_count: 900 }),
      baseRepo({ name: 'awesome-z', full_name: 'jhammant/awesome-z', stargazers_count: 800 }),
      baseRepo({ name: 'real-cli', full_name: 'jhammant/real-cli', stargazers_count: 50 }),
      baseRepo({ name: 'real-lib', full_name: 'jhammant/real-lib', stargazers_count: 30 }),
      baseRepo({ name: 'demo', full_name: 'jhammant/demo', stargazers_count: 10 }),
    ];
    const c = client({
      listUserRepos: async () => repos,
      getRepoFile: async (_o, repo, p) => {
        if (p === 'package.json' && (repo === 'real-cli' || repo === 'real-lib')) {
          return { path: p, content: JSON.stringify({ dependencies: { fastify: '4' } }) };
        }
        return undefined;
      },
    });
    const insights = await buildUserInsights(c, 'jhammant');
    expect(insights.stack.detected.map((d) => d.name)).toContain('Fastify');
  });

  it('computes commitSubstance with diff stats when getCommitDetail is available', async () => {
    const c = client({
      getRecentCommits: async () =>
        Array.from({ length: 10 }, (_, i) => ({ sha: `s${i}`, message: 'work', date: '' })),
      getCommitDetail: async (_o, _r, sha) => ({ sha, additions: 60, deletions: 12, changedFiles: 4 }),
    });
    const insights = await buildUserInsights(c, 'jhammant');
    expect(insights.commitSubstance?.basis).toBe('diff-sampled');
    expect(insights.commitSubstance?.verdict).toBe('substantial');
  });

  it('falls back to message-only commitSubstance without getCommitDetail', async () => {
    const c = client({
      getRecentCommits: async () =>
        Array.from({ length: 8 }, (_, i) => ({
          sha: `m${i}`,
          message: 'Add full retry logic to the queue worker',
          date: '',
        })),
    });
    const insights = await buildUserInsights(c, 'jhammant');
    expect(insights.commitSubstance?.basis).toBe('message-only');
  });

  it('detects AI usage from an AI-tool config file', async () => {
    const c = client({
      getRepoFile: async (_o, _r, p) =>
        p === '.cursorrules' ? { path: p, content: 'be concise' } : undefined,
    });
    const insights = await buildUserInsights(c, 'jhammant');
    expect(insights.aiUsage?.detected).toBe(true);
    expect(insights.aiUsage?.tools).toContain('Cursor');
  });

  it('always returns a seniority band', async () => {
    const insights = await buildUserInsights(client(), 'jhammant');
    expect(insights.seniority?.band).toBeDefined();
    expect(['junior', 'mid', 'senior', 'staff+']).toContain(insights.seniority!.band);
  });

  it('survives getRecentCommits throwing for every repo', async () => {
    const c = client({
      getRecentCommits: async () => {
        throw new Error('rate limited');
      },
    });
    const insights = await buildUserInsights(c, 'jhammant');
    expect(insights.kind).toBe('user');
    // commitSubstance either omitted or insufficient-data — never throws.
    if (insights.commitSubstance) {
      expect(insights.commitSubstance.verdict).toBe('insufficient-data');
    }
  });
});

describe('buildRepoInsights', () => {
  it('returns stack + commit-style + heatmap when all available', async () => {
    const c = client({
      getRepoFile: async (_o, _r, p) =>
        p === 'package.json'
          ? { path: p, content: JSON.stringify({ dependencies: { fastify: '4', stripe: '15' } }) }
          : undefined,
      getRecentCommits: async () => [
        { sha: 'a', message: 'feat: add login', date: '' },
        { sha: 'b', message: 'feat: add signup', date: '' },
        { sha: 'c', message: 'fix: redirect bug', date: '' },
      ],
      getCommitActivity: async () => [{ week: 1700000000, total: 5 }],
    });
    const insights = await buildRepoInsights(c, 'jhammant', 'demo');
    const names = insights.stack.detected.map((d) => d.name);
    expect(names).toContain('Fastify');
    expect(names).toContain('Stripe');
    expect(insights.commitStyle?.signals.sample).toBe(3);
    expect(insights.commitStyle?.signals.conventional).toBeGreaterThan(0.5);
    expect(insights.commitActivity).toHaveLength(1);
  });

  it('returns empty commitStyle when there are no commits', async () => {
    const insights = await buildRepoInsights(client(), 'jhammant', 'demo');
    expect(insights.commitStyle?.signals.sample).toBe(0);
    expect(insights.commitStyle?.bullets).toEqual([]);
  });

  it('returns relatedProfiles for a repo from getContributors', async () => {
    const c = client({
      getContributors: async () => [
        { login: 'alice', avatar_url: 'a.png', contributions: 200 },
        { login: 'bob', avatar_url: 'b.png', contributions: 50 },
      ],
    });
    const insights = await buildRepoInsights(c, 'jhammant', 'demo');
    expect(insights.relatedProfiles?.map((p) => p.login)).toEqual(['alice', 'bob']);
    expect(insights.relatedProfiles?.[0].contributions).toBe(200);
  });
});
