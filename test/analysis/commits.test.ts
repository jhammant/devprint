import { describe, expect, it } from 'vitest';
import {
  inferCommitStyle,
  inferCommitSubstance,
  fetchCommitDiffs,
  detectAiTrailers,
  type Commit,
  type CommitDiffStat,
} from '../../src/analysis/commits.ts';
import type { GhClient } from '../../src/analysis/github.ts';

const c = (message: string) => ({
  sha: Math.random().toString(36).slice(2),
  message,
  date: '2026-05-05T00:00:00Z',
});

const cs = (sha: string, message: string): Commit => ({
  sha,
  message,
  date: '2026-05-05T00:00:00Z',
});

const diff = (sha: string, additions: number, deletions: number, changedFiles = 1): CommitDiffStat => ({
  sha,
  additions,
  deletions,
  changedFiles,
});

describe('inferCommitStyle', () => {
  it('detects Conventional Commits when most subjects use prefixes', () => {
    const commits = [
      c('feat: add login page'),
      c('fix: correct redirect on error'),
      c('feat(auth): support magic links'),
      c('chore: bump deps'),
      c('docs: update README'),
      c('refactor: extract helper'),
      c('test: add coverage for parser'),
      c('something different'),
    ];
    const v = inferCommitStyle(commits);
    expect(v.signals.conventional).toBeGreaterThan(0.6);
    expect(v.bullets.some((b) => b.includes('Conventional Commits'))).toBe(true);
    expect(v.primary).toMatch(/Conventional Commits/);
  });

  it('detects squash-merge style from "(#NNN)" trailers', () => {
    const commits = Array.from({ length: 6 }, (_, i) => c(`Fix the thing (#${100 + i})`));
    const v = inferCommitStyle(commits);
    expect(v.signals.squashMerge).toBeGreaterThan(0.5);
    expect(v.bullets.some((b) => b.includes('squash-merge'))).toBe(true);
  });

  it('detects imperative subjects', () => {
    const commits = [
      c('Add tests for parser'),
      c('Fix race condition in queue'),
      c('Update README'),
      c('Remove dead code'),
      c('Refactor token logic'),
    ];
    const v = inferCommitStyle(commits);
    expect(v.signals.imperative).toBeGreaterThan(0.6);
  });

  it('returns empty verdict for no commits', () => {
    const v = inferCommitStyle([]);
    expect(v.signals.sample).toBe(0);
    expect(v.bullets).toEqual([]);
    expect(v.primary).toBe('');
    expect(v.samples).toEqual([]);
  });

  it('flags Signed-off-by when a DCO trailer is common', () => {
    const commits = Array.from({ length: 5 }, (_, i) =>
      c(`Add feature ${i}\n\nSigned-off-by: Dev <dev@example.com>`),
    );
    const v = inferCommitStyle(commits);
    expect(v.signals.signedOff).toBeGreaterThan(0.5);
    expect(v.bullets.some((b) => b.toLowerCase().includes('signed-off-by'))).toBe(true);
  });
});

describe('inferCommitSubstance', () => {
  it('flags mostly-trivial from real diffs when most commits are tiny', () => {
    const commits = Array.from({ length: 20 }, (_, i) =>
      cs(`s${i}`, 'change something in the codebase'),
    );
    const diffs = new Map<string, CommitDiffStat>();
    for (let i = 0; i < 15; i++) diffs.set(`s${i}`, diff(`s${i}`, 1, 0, 1));
    for (let i = 15; i < 20; i++) diffs.set(`s${i}`, diff(`s${i}`, 50, 10, 3));
    const v = inferCommitSubstance(commits, diffs);
    expect(v.verdict).toBe('mostly-trivial');
    expect(v.basis).toBe('diff-sampled');
    expect(v.sample).toBe(20);
    expect(v.diffSampled).toBe(20);
  });

  it('flags substantial from real diffs when commits are high-churn', () => {
    const commits = Array.from({ length: 20 }, (_, i) => cs(`b${i}`, 'work'));
    const diffs = new Map<string, CommitDiffStat>();
    for (let i = 0; i < 20; i++) diffs.set(`b${i}`, diff(`b${i}`, 60, 20, 4));
    const v = inferCommitSubstance(commits, diffs);
    expect(v.verdict).toBe('substantial');
  });

  it('runs message-only when no diff map is supplied', () => {
    const commits = ['wip', 'fix', 'update', '.', 'tmp', 'misc', 'edit', 'typo'].map((m, i) =>
      cs(`m${i}`, m),
    );
    const v = inferCommitSubstance(commits, new Map());
    expect(v.verdict).toBe('mostly-trivial');
    expect(v.basis).toBe('message-only');
  });

  it('reads descriptive imperative subjects as substantial (message-only)', () => {
    const commits = Array.from({ length: 8 }, (_, i) =>
      cs(`d${i}`, 'Add full retry logic to the queue worker'),
    );
    const v = inferCommitSubstance(commits, new Map());
    expect(v.verdict).toBe('substantial');
    expect(v.basis).toBe('message-only');
  });

  it('excludes merge commits from the denominator', () => {
    const commits = [
      ...Array.from({ length: 5 }, (_, i) => cs(`mg${i}`, `Merge pull request #${i}`)),
      ...Array.from({ length: 6 }, (_, i) => cs(`r${i}`, 'Add a real descriptive change here')),
    ];
    const v = inferCommitSubstance(commits, new Map());
    expect(v.sample).toBe(6);
  });

  it('returns insufficient-data for fewer than 5 non-merge commits', () => {
    const commits = Array.from({ length: 4 }, (_, i) => cs(`x${i}`, 'Add something useful here'));
    const v = inferCommitSubstance(commits, new Map());
    expect(v.verdict).toBe('insufficient-data');
  });

  it('computes medianChurn for an even count of diff-sampled commits', () => {
    const commits = Array.from({ length: 6 }, (_, i) => cs(`e${i}`, 'work'));
    const diffs = new Map<string, CommitDiffStat>();
    [10, 20, 30, 40, 50, 60].forEach((churn, i) => diffs.set(`e${i}`, diff(`e${i}`, churn, 0, 2)));
    const v = inferCommitSubstance(commits, diffs);
    // median of [10,20,30,40,50,60] = (30+40)/2 = 35
    expect(v.detail.some((d) => d.includes('35'))).toBe(true);
  });
});

describe('fetchCommitDiffs', () => {
  const fakeClient = (over: Partial<GhClient>): GhClient => ({
    getUser: async () => { throw new Error('unused'); },
    getRepo: async () => { throw new Error('unused'); },
    listUserRepos: async () => [],
    getReadme: async () => undefined,
    getRepoFile: async () => undefined,
    getRepoHeadSha: async () => undefined,
    getRecentCommits: async () => [],
    getCommitActivity: async () => undefined,
    getContributors: async () => [],
    ...over,
  });

  it('honours the per-repo cap', async () => {
    let calls = 0;
    const client = fakeClient({
      getCommitDetail: async (_o, _r, sha) => {
        calls++;
        return { sha, additions: 5, deletions: 1, changedFiles: 1 };
      },
    });
    const commits = Array.from({ length: 20 }, (_, i) => cs(`c${i}`, 'work'));
    const map = await fetchCommitDiffs(client, 'o', 'r', commits, 8);
    expect(calls).toBe(8);
    expect(map.size).toBe(8);
  });

  it('returns an empty map when the client cannot fetch detail', async () => {
    const map = await fetchCommitDiffs(fakeClient({}), 'o', 'r', [cs('a', 'x')], 8);
    expect(map.size).toBe(0);
  });

  it('drops a single failing commit without failing the batch', async () => {
    const client = fakeClient({
      getCommitDetail: async (_o, _r, sha) => {
        if (sha === 'bad') throw new Error('boom');
        return { sha, additions: 3, deletions: 0, changedFiles: 1 };
      },
    });
    const commits = [cs('ok1', 'x'), cs('bad', 'x'), cs('ok2', 'x')];
    const map = await fetchCommitDiffs(client, 'o', 'r', commits, 8);
    expect(map.has('bad')).toBe(false);
    expect(map.size).toBe(2);
  });
});

describe('detectAiTrailers', () => {
  it('detects Claude Code co-author trailers', () => {
    const hit = detectAiTrailers(['feat: add x\n\nCo-Authored-By: Claude <noreply@anthropic.com>']);
    expect(hit.tools).toContain('Claude Code');
    expect(hit.hits).toBe(1);
  });

  it('detects "Generated with Claude Code"', () => {
    const hit = detectAiTrailers(['fix: thing\n\n🤖 Generated with [Claude Code](https://claude.com)']);
    expect(hit.tools).toContain('Claude Code');
  });

  it('detects Copilot co-author trailers', () => {
    const hit = detectAiTrailers(['fix: x\n\nCo-authored-by: Copilot <copilot@github.com>']);
    expect(hit.tools).toContain('GitHub Copilot');
  });

  it('returns no hits for clean messages', () => {
    const hit = detectAiTrailers(['feat: add login', 'fix: redirect bug']);
    expect(hit.hits).toBe(0);
    expect(hit.tools).toEqual([]);
  });
});
