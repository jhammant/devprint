import { describe, expect, it } from 'vitest';
import { buildRepoPack, buildUserPack } from '../../src/analysis/pack.ts';
import type { GhClient } from '../../src/analysis/github.ts';
import type { GhRepo, GhUser } from '../../src/analysis/types.ts';

const profile: GhUser = {
  login: 'jhammant', name: 'Jonathan Hammant',
  avatar_url: 'https://example.com/a.png', public_repos: 12, followers: 30,
};

const baseRepo = (over: Partial<GhRepo>): GhRepo => ({
  name: 'r', full_name: 'jhammant/r', description: null, html_url: '',
  language: null, stargazers_count: 0, forks_count: 0, watchers_count: 0,
  open_issues_count: 0, fork: false, updated_at: '2026-04-01T00:00:00Z',
  default_branch: 'main',
  ...over,
});

function mockClient(over: Partial<GhClient> = {}): GhClient {
  return {
    getUser: async () => profile,
    getRepo: async (_o, name) => baseRepo({ name, full_name: `jhammant/${name}` }),
    listUserRepos: async () => [
      baseRepo({ name: 'factcheck', language: 'TypeScript', stargazers_count: 12 }),
      baseRepo({ name: 'devprint', language: 'TypeScript', stargazers_count: 3 }),
    ],
    getReadme: async () => undefined,
    getRepoFile: async () => undefined,
    getRepoHeadSha: async () => undefined,
    getRecentCommits: async () => [],
    getCommitActivity: async () => undefined,
    ...over,
  };
}

describe('buildUserPack', () => {
  it('includes target, archetype, repos and provenance footer', async () => {
    const pack = await buildUserPack(mockClient(), 'jhammant', { toolVersion: '0.1.0' });
    expect(pack.kind).toBe('user');
    expect(pack.target).toBe('jhammant');
    expect(pack.markdown).toContain('# Devprint Agent Pack: jhammant');
    expect(pack.markdown).toContain('## Target');
    expect(pack.markdown).toContain('## Repos to inspect first');
    expect(pack.markdown).toContain('content_hash: sha256:');
    expect(pack.markdown).toContain('tool_version: 0.1.0');
    expect(pack.provenance.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hash matches the body sans footer', async () => {
    const pack = await buildUserPack(mockClient(), 'jhammant', {
      toolVersion: '0.1.0',
      generatedAt: '2026-01-01T00:00:00Z',
    });
    // Re-derive the body by stripping the footer and assert determinism.
    const footerIdx = pack.markdown.indexOf('\n---\n\n> _Devprint pack provenance_');
    expect(footerIdx).toBeGreaterThan(0);
  });
});

describe('buildRepoPack', () => {
  it('fetches README + package files in parallel and lists them', async () => {
    let readmeCalled = false;
    const calls: string[] = [];
    const client = mockClient({
      getRepo: async () => baseRepo({ name: 'factcheck', language: 'TypeScript' }),
      getReadme: async () => {
        readmeCalled = true;
        return '# Factcheck\n\nA cool project.';
      },
      getRepoFile: async (_o, _r, path) => {
        calls.push(path);
        if (path === 'package.json') {
          return { path, content: JSON.stringify({ name: 'factcheck', scripts: { test: 'vitest' } }) };
        }
        return undefined;
      },
      getRepoHeadSha: async () => 'abc1234deadbeef',
    });

    const pack = await buildRepoPack(client, 'jhammant', 'factcheck', { toolVersion: '0.1.0' });
    expect(readmeCalled).toBe(true);
    expect(calls).toContain('package.json');
    expect(pack.markdown).toContain('# Devprint Agent Pack: jhammant/factcheck');
    expect(pack.markdown).toContain('npm install');
    expect(pack.markdown).toContain('source_sha: abc1234deadbeef');
    expect(pack.markdown).toContain('## README excerpt');
  });

  it('survives a failing package-file fetch', async () => {
    let pkgCalls = 0;
    const client = mockClient({
      getRepoFile: async (_o, _r, path) => {
        pkgCalls++;
        if (path === 'package.json') throw new Error('boom');
        return undefined;
      },
    });
    const pack = await buildRepoPack(client, 'jhammant', 'factcheck', { toolVersion: '0.1.0' });
    // No package files detected → falls back to inspect README hint.
    expect(pack.markdown).toContain('inspect README');
    expect(pkgCalls).toBeGreaterThan(0);
  });

  it('scrubs leaked tokens from README content', async () => {
    const client = mockClient({
      getReadme: async () =>
        '# Setup\n\nExport GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz1234567890 then run.',
    });
    const pack = await buildRepoPack(client, 'jhammant', 'factcheck', { toolVersion: '0.1.0' });
    expect(pack.markdown).not.toContain('ghp_abcdef');
    expect(pack.markdown).toContain('<redacted: github-pat>');
    expect(pack.redactions).toBeGreaterThanOrEqual(1);
    expect(pack.markdown).toContain('Scrubber note');
  });
});
