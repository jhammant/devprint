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
});
