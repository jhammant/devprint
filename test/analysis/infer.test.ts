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
    const repos = [
      baseRepo({ description: 'an llm agent that calls openai for code review', topics: ['llm', 'agent'] }),
      baseRepo({ description: 'rag pipeline with anthropic claude', topics: ['rag'] }),
    ];
    expect(archetype({}, repos)).toBe('AI Toolsmith');
  });

  it('detects Systems Shaper for Go/Rust portfolio with infra topics', () => {
    const repos = [
      baseRepo({ description: 'kubernetes operator', topics: ['kubernetes', 'systems'] }),
      baseRepo({ description: 'docker observability tool', topics: ['docker'] }),
    ];
    expect(archetype({ Go: 4, Rust: 2 }, repos)).toBe('Systems Shaper');
  });

  it('detects App Builder when iOS/Android signal is clear', () => {
    const repos = [
      baseRepo({ description: 'swiftui ios app for tracking habits', topics: ['ios', 'swiftui'] }),
      baseRepo({ description: 'react-native habit tracker', topics: ['mobile'] }),
    ];
    expect(archetype({ Swift: 2, Kotlin: 1 }, repos)).toBe('App Builder');
  });

  it('falls back to Generalist Builder when keyword signal is weak', () => {
    expect(archetype({}, [baseRepo({})])).toBe('Generalist Builder');
  });

  it('does NOT label sindresorhus-shaped portfolio (utility libraries) as AI Toolsmith', () => {
    // Approximation of sindresorhus's pattern: many Node utility libs, a few
    // CLI tools, occasional "AI" mentions. The previous regex chain matched
    // any "ai" string and labelled him AI Toolsmith. The reworked scorer
    // should land Tools Maker or Generalist instead.
    const repos = [
      baseRepo({ name: 'awesome', description: 'awesome lists about all kinds of interesting topics', topics: ['awesome', 'collection'], stargazers_count: 463_000 }),
      baseRepo({ name: 'ky', description: 'tiny http client based on the fetch api', topics: ['library'], stargazers_count: 16_000 }),
      baseRepo({ name: 'type-fest', description: 'a collection of essential typescript types', topics: ['utility', 'typescript'], stargazers_count: 17_000 }),
      baseRepo({ name: 'execa', description: 'process execution for humans, like child_process but better', topics: ['cli', 'utility'], stargazers_count: 6_000 }),
      baseRepo({ name: 'p-queue', description: 'promise queue with concurrency control', topics: ['utility', 'library'], stargazers_count: 3_500 }),
      baseRepo({ name: 'ai-toolkit', description: 'ai helper experiments', topics: [], stargazers_count: 30 }),
    ];
    const langs = { JavaScript: 4, TypeScript: 3, Swift: 2, CSS: 1 };
    const a = archetype(langs, repos);
    expect(a).not.toBe('AI Toolsmith');
    expect(['Tools Maker', 'Generalist Builder']).toContain(a);
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
