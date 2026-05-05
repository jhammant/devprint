import { describe, expect, it } from 'vitest';
import { buildReceiptPack } from '../../src/analysis/receipt.ts';
import { applyTaskOverlay, isKnownTask } from '../../src/analysis/tasks.ts';
import { checkDrift } from '../../src/analysis/drift.ts';
import { buildBadgeData, renderBadgeSvg } from '../../src/analysis/badge.ts';
import { buildUserPack } from '../../src/analysis/pack.ts';
import type { GhClient } from '../../src/analysis/github.ts';
import type { GhRepo, GhUser } from '../../src/analysis/types.ts';

const profile: GhUser = { login: 'jhammant', name: 'J', avatar_url: '', public_repos: 1, followers: 0 };
const baseRepo: GhRepo = {
  name: 'r', full_name: 'jhammant/r', description: null, html_url: '',
  language: 'TypeScript', stargazers_count: 5, forks_count: 0, watchers_count: 0,
  open_issues_count: 0, fork: false, updated_at: '2026-04-01T00:00:00Z', default_branch: 'main',
};
function client(over: Partial<GhClient> = {}): GhClient {
  return {
    getUser: async () => profile,
    getRepo: async () => baseRepo,
    listUserRepos: async () => [baseRepo],
    getReadme: async () => undefined,
    getRepoFile: async (_o, _r, p) =>
      p === 'package.json'
        ? { path: p, content: JSON.stringify({ scripts: { test: 'vitest run' } }) }
        : undefined,
    getRepoHeadSha: async () => 'abc1234',
    getRecentCommits: async () => [],
    getCommitActivity: async () => undefined,
    ...over,
  };
}

describe('receipt', () => {
  it('builds a receipt pack with detected files and commands', async () => {
    const pack = await buildReceiptPack(client(), 'jhammant', 'r', { toolVersion: '0.1.0' });
    expect(pack.markdown).toContain('# jhammant/r');
    expect(pack.markdown).toContain('Receipt RC-');
    expect(pack.markdown).toContain('package.json');
    expect(pack.markdown).toContain('npm install');
  });
});

describe('tasks', () => {
  it('isKnownTask gates known names only', () => {
    expect(isKnownTask('add-tests')).toBe(true);
    expect(isKnownTask('made-up')).toBe(false);
  });

  it('applyTaskOverlay inserts overlay before the provenance footer', async () => {
    const pack = await buildUserPack(client(), 'jhammant', { toolVersion: '0.1.0' });
    const overlaid = applyTaskOverlay(pack, 'add-tests');
    const overlayIdx = overlaid.markdown.indexOf('Task overlay: add-tests');
    const footerIdx = overlaid.markdown.indexOf('_Devprint pack provenance_');
    expect(overlayIdx).toBeGreaterThan(0);
    expect(footerIdx).toBeGreaterThan(overlayIdx);
  });
});

describe('drift', () => {
  it('reports no drift when SHAs match', async () => {
    const r = await checkDrift(client({ getRepoHeadSha: async () => 'aaa' }), 'jhammant', 'r', 'aaa');
    expect(r.drifted).toBe(false);
  });

  it('reports drift when SHAs differ', async () => {
    const r = await checkDrift(client({ getRepoHeadSha: async () => 'bbb' }), 'jhammant', 'r', 'aaa');
    expect(r.drifted).toBe(true);
    expect(r.currentSha).toBe('bbb');
  });
});

describe('badge', () => {
  it('builds badge data and renders an SVG', async () => {
    const data = await buildBadgeData(client(), 'jhammant', 'r');
    expect(data.label).toBe('devprint');
    expect(data.tier).toMatch(/^(Emerging|Rare|Epic|Legendary)$/);
    const svg = renderBadgeSvg(data);
    expect(svg).toContain('<svg');
    expect(svg).toContain('devprint');
  });
});
