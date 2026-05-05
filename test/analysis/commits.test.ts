import { describe, expect, it } from 'vitest';
import { inferCommitStyle } from '../../src/analysis/commits.ts';

const c = (message: string) => ({
  sha: Math.random().toString(36).slice(2),
  message,
  date: '2026-05-05T00:00:00Z',
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
