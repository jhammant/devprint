import { describe, expect, it } from 'vitest';
import { archetype, battleStats, getThemes } from '../../src/analysis/infer.ts';
import type { GhRepo, GhUser } from '../../src/analysis/types.ts';

const baseRepo = (over: Partial<GhRepo>): GhRepo => ({
  name: 'r', full_name: 'u/r', description: null, html_url: '',
  language: null, stargazers_count: 0, forks_count: 0, watchers_count: 0,
  open_issues_count: 0, fork: false, updated_at: new Date().toISOString(),
  ...over,
});

const profile: GhUser = { login: 'u', name: null, avatar_url: '', public_repos: 0, followers: 0 };

describe('archetype', () => {
  it('detects AI Toolsmith from description keywords', () => {
    const repos = [baseRepo({ description: 'an llm agent for code review' })];
    expect(archetype({}, repos)).toBe('AI Toolsmith');
  });

  it('detects Systems Shaper for Go/Rust', () => {
    expect(archetype({ Go: 4 }, [baseRepo({})])).toBe('Systems Shaper');
  });

  it('detects App Builder for Swift/Kotlin', () => {
    expect(archetype({ Swift: 2 }, [baseRepo({})])).toBe('App Builder');
  });

  it('detects Product Hacker for web languages', () => {
    expect(archetype({ TypeScript: 5 }, [baseRepo({})])).toBe('Product Hacker');
  });

  it('falls back to Pragmatic Builder', () => {
    expect(archetype({}, [baseRepo({})])).toBe('Pragmatic Builder');
  });
});

describe('getThemes', () => {
  it('detects AI theme from llm/agent keywords', () => {
    const themes = getThemes([baseRepo({ name: 'llm-agent', description: 'rag and gpt' })]);
    expect(themes[0][0]).toBe('AI');
    expect(themes[0][1]).toBeGreaterThan(0);
  });

  it('returns empty for repos with no theme keywords', () => {
    const themes = getThemes([baseRepo({ name: 'misc', description: 'a thing' })]);
    expect(themes).toHaveLength(0);
  });
});

describe('battleStats', () => {
  it('returns claims for every metric and a tier', () => {
    const repos = [
      baseRepo({ language: 'TypeScript', stargazers_count: 50, forks_count: 5, name: 'ai-cli' }),
      baseRepo({ language: 'Python', stargazers_count: 10, name: 'data-tool' }),
    ];
    const langs = { TypeScript: 1, Python: 1 };
    const themes = getThemes(repos);
    const b = battleStats(profile, repos, langs, 60, themes);
    expect(b.build.value).toBeGreaterThan(0);
    expect(b.build.confidence).toBe('high');
    expect(b.build.evidence.length).toBeGreaterThan(0);
    expect(['Emerging', 'Rare', 'Epic', 'Legendary']).toContain(b.tier);
  });
});
