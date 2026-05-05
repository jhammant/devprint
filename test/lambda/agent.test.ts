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
    getRecentCommits: async () => [],
    getCommitActivity: async () => undefined,
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

  it('returns safety.md as text/markdown', async () => {
    const res = await handle(
      { method: 'GET', path: '/jhammant/factcheck/safety.md', search: '', headers: {} },
      { client: client(), toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/markdown; charset=utf-8');
    expect(res.body).toContain('# Safety Brief');
  });

  it('returns receipt.md as text/markdown', async () => {
    const res = await handle(
      { method: 'GET', path: '/jhammant/factcheck/receipt.md', search: '', headers: {} },
      { client: client(), toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(200);
    expect(res.body).toContain('Receipt RC-');
  });

  it('drift returns JSON with drifted=true when shas differ', async () => {
    const c = client({ getRepoHeadSha: async () => 'newsha' });
    const res = await handle(
      { method: 'GET', path: '/jhammant/factcheck/drift', search: '?sha=oldsha', headers: {} },
      { client: c, toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/json; charset=utf-8');
    const body = JSON.parse(res.body) as { drifted: boolean; currentSha: string };
    expect(body.drifted).toBe(true);
    expect(body.currentSha).toBe('newsha');
  });

  it('drift requires ?sha=', async () => {
    const res = await handle(
      { method: 'GET', path: '/jhammant/factcheck/drift', search: '', headers: {} },
      { client: client(), toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(400);
  });

  it('?task= overlays the pack', async () => {
    const res = await handle(
      { method: 'GET', path: '/jhammant/factcheck.md', search: '?task=add-tests', headers: {} },
      { client: client(), toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(200);
    expect(res.body).toContain('Task overlay: add-tests');
  });

  it('returns 501 for vs page (Wave 2)', async () => {
    const res = await handle(
      { method: 'GET', path: '/vs/jhammant/sindresorhus.md', search: '', headers: {} },
      { client: client(), toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(501);
  });

  it('returns user-insights JSON for /<user>.json', async () => {
    const c = client({
      getRepoFile: async (_o, _r, p) =>
        p === 'package.json'
          ? { path: p, content: JSON.stringify({ dependencies: { next: '14', tailwindcss: '3' } }) }
          : undefined,
      getCommitActivity: async () => [
        { week: 1700000000, total: 5 },
        { week: 1700604800, total: 2 },
      ],
    });
    const res = await handle(
      { method: 'GET', path: '/jhammant.json', search: '', headers: {} },
      { client: c, toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/json; charset=utf-8');
    const body = JSON.parse(res.body);
    expect(body.kind).toBe('user');
    expect(body.target).toBe('jhammant');
    const detected = body.stack.detected.map((d: { name: string }) => d.name);
    expect(detected).toContain('Next.js');
    expect(detected).toContain('Tailwind');
    expect(body.commitActivity).toHaveLength(2);
    expect(body.commitActivitySource).toMatch(/^jhammant\//);
  });

  it('returns repo-insights JSON for /<u>/<r>.json with commit-style + heatmap', async () => {
    const c = client({
      getRepoFile: async (_o, _r, p) =>
        p === 'Cargo.toml'
          ? { path: p, content: '[dependencies]\naxum = "0.7"\ntokio = { version = "1", features = ["full"] }\n' }
          : undefined,
      getRecentCommits: async () => [
        { sha: 'a', message: 'feat: add login', date: '' },
        { sha: 'b', message: 'fix: redirect bug', date: '' },
        { sha: 'c', message: 'chore: bump deps', date: '' },
      ],
      getCommitActivity: async () => [{ week: 1700000000, total: 3 }],
    });
    const res = await handle(
      { method: 'GET', path: '/jhammant/factcheck.json', search: '', headers: {} },
      { client: c, toolVersion: '0.1.0' },
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.kind).toBe('repo');
    const detected = body.stack.detected.map((d: { name: string }) => d.name);
    expect(detected).toContain('Axum');
    expect(detected).toContain('Tokio');
    expect(body.commitStyle.signals.sample).toBe(3);
    expect(body.commitStyle.signals.conventional).toBeGreaterThan(0.5);
    expect(body.commitActivity).toEqual([{ week: 1700000000, total: 3 }]);
  });
});
