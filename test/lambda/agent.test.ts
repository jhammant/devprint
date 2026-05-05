import { describe, expect, it } from 'vitest';
import { handle } from '../../infra/lambdas/agent/handler.ts';
import type { GhClient } from '../../src/analysis/github.ts';
import type { GhRepo, GhUser } from '../../src/analysis/types.ts';
import { GitHubError } from '../../src/analysis/github.ts';

const profile: GhUser = {
  login: 'jhammant', name: 'Jonathan Hammant',
  avatar_url: '', public_repos: 12, followers: 30,
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
    listUserRepos: async () => [
      baseRepo({ name: 'factcheck', language: 'TypeScript', stargazers_count: 5 }),
    ],
    getReadme: async () => undefined,
    getRepoFile: async () => undefined,
    getRepoHeadSha: async () => undefined,
    ...over,
  };
}

describe('agent handler', () => {
  it('returns user pack for /<user>.md with provenance + cache headers', async () => {
    const res = await handle(
      { method: 'GET', path: '/jhammant.md', search: '', headers: {} },
      { client: client(), toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/markdown; charset=utf-8');
    expect(res.headers['Cache-Control']).toBe('public, max-age=300, stale-while-revalidate=600');
    expect(res.headers['X-Devprint-Hash']).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(res.headers['X-Devprint-Tool-Version']).toBe('0.1.0');
    expect(res.headers['X-Devprint-Target']).toBe('jhammant');
    expect(res.headers['X-Devprint-Kind']).toBe('user');
    expect(res.body).toContain('# Devprint Agent Pack: jhammant');
  });

  it('returns repo pack for /<user>/<repo>.md', async () => {
    const res = await handle(
      { method: 'GET', path: '/jhammant/factcheck.md', search: '', headers: {} },
      { client: client(), toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(200);
    expect(res.body).toContain('# Devprint Agent Pack: jhammant/factcheck');
    expect(res.headers['X-Devprint-Kind']).toBe('repo');
  });

  it('aliases /<u>/<r>/AGENTS.md to repo pack', async () => {
    const res = await handle(
      { method: 'GET', path: '/jhammant/factcheck/AGENTS.md', search: '', headers: {} },
      { client: client(), toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(200);
    expect(res.body).toContain('# Devprint Agent Pack: jhammant/factcheck');
  });

  it('returns 451 with X-Devprint-OptOut when target opts out via .well-known', async () => {
    const c = client({
      getRepoFile: async (_o, _r, path) =>
        path === '.well-known/devprint-optout'
          ? { path, content: '' }
          : undefined,
    });
    const res = await handle(
      { method: 'GET', path: '/jhammant.md', search: '', headers: {} },
      { client: c, toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(451);
    expect(res.headers['X-Devprint-OptOut']).toBe('true');
    expect(res.body).toContain('opted out');
  });

  it('returns 404 when GitHub user does not exist', async () => {
    const c = client({
      getUser: async () => { throw new GitHubError(404, 'GitHub target not found'); },
    });
    const res = await handle(
      { method: 'GET', path: '/missing.md', search: '', headers: {} },
      { client: c, toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(404);
  });

  it('returns 502 on upstream GitHub 5xx', async () => {
    const c = client({
      getUser: async () => { throw new GitHubError(500, 'github exploded'); },
    });
    const res = await handle(
      { method: 'GET', path: '/jhammant.md', search: '', headers: {} },
      { client: c, toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(502);
  });

  it('returns 400 for empty path', async () => {
    const res = await handle(
      { method: 'GET', path: '/', search: '', headers: {} },
      { client: client(), toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(400);
  });

  it('returns 501 for safety.md (Wave 2)', async () => {
    const res = await handle(
      { method: 'GET', path: '/jhammant/factcheck/safety.md', search: '', headers: {} },
      { client: client(), toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(501);
    expect(res.body).toContain('safety');
  });

  it('returns 501 for vs page (Wave 2)', async () => {
    const res = await handle(
      { method: 'GET', path: '/vs/jhammant/sindresorhus.md', search: '', headers: {} },
      { client: client(), toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(501);
  });
});
