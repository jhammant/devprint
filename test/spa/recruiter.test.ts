import { describe, expect, it } from 'vitest';

// The renderer reads `location.href` (via linkedinShareUrl). The vitest node
// environment has no DOM globals — provide a minimal stub.
if (typeof globalThis.location === 'undefined') {
  Object.defineProperty(globalThis, 'location', {
    value: { href: 'https://recruiter.devprint.dev/devuser' },
    configurable: true,
  });
}

import { recruiter } from '../../src/spa/styles/recruiter.ts';
import type { ProfileData } from '../../src/spa/styles/types.ts';
import type { BattleStats, GhRepo, GhUser, Insights } from '../../src/analysis/index.ts';

const profile: GhUser = {
  login: 'devuser',
  name: 'Dev User',
  avatar_url: 'https://example.com/a.png',
  public_repos: 12,
  followers: 240,
};

const repo = (over: Partial<GhRepo> = {}): GhRepo => ({
  name: 'project',
  full_name: 'devuser/project',
  description: 'a useful project',
  html_url: 'https://github.com/devuser/project',
  language: 'TypeScript',
  stargazers_count: 120,
  forks_count: 8,
  watchers_count: 0,
  open_issues_count: 2,
  fork: false,
  updated_at: '2026-05-01T00:00:00Z',
  pushed_at: '2026-05-10T00:00:00Z',
  topics: ['developer-tools'],
  ...over,
});

const claimN = (v: number) => ({ value: v, confidence: 'low' as const, evidence: [] });
const battle: BattleStats = {
  build: claimN(10),
  impact: claimN(10),
  versatility: claimN(10),
  momentum: claimN(10),
  community: claimN(10),
  originality: claimN(10),
  tier: 'Emerging',
};

const fullInsights: Insights = {
  target: 'devuser',
  kind: 'user',
  generatedAt: '2026-05-22T00:00:00Z',
  stack: {
    ecosystems: ['node'],
    detected: [{ name: 'React', category: 'framework', confidence: 'high', evidence: 'package.json: react' }],
  },
  seniority: { band: 'senior', basis: ['6 years building publicly', "merged PRs into 3 orgs they don't own"] },
  provenanceBadges: [
    { label: 'Verified active', detail: 'Pushed within the last 30 days.', tone: 'positive' },
  ],
  aiUsage: {
    detected: true,
    confidence: 'high',
    tools: ['Claude Code'],
    signals: ['Commit co-author trailers in 2 repos'],
  },
  commitSubstance: {
    verdict: 'substantial',
    summary: 'Recent commits look substantial.',
    detail: ['20 of 24 recent commits checked against real diffs.'],
    basis: 'diff-sampled',
    sample: 24,
    diffSampled: 24,
  },
  timeline: {
    milestones: [{ year: 2020, label: 'First public repo', repo: { name: 'project', full_name: 'devuser/project', html_url: 'https://github.com/devuser/project' } }],
    langsByYear: [],
  },
  commitActivity: Array.from({ length: 20 }, (_, i) => ({ week: 1700000000 + i * 604800, total: 5 })),
};

function makeData(over: Partial<ProfileData> = {}): ProfileData {
  return {
    profile,
    isRepo: false,
    repos: [repo(), repo({ name: 'second', full_name: 'devuser/second', stargazers_count: 40 })],
    topLangs: [['TypeScript', 2]],
    langs: { TypeScript: 2, Python: 1 },
    themes: [],
    archetype: 'App Builder',
    totalStars: 160,
    battle,
    insights: fullInsights,
    pack: '',
    target: 'devuser',
    ...over,
  };
}

describe('recruiter renderer', () => {
  it('is a takeover style with the expected id', () => {
    expect(recruiter.id).toBe('recruiter');
    expect(recruiter.takeover).toBe(true);
  });

  it('renders the full set of sections without throwing', () => {
    const { html } = recruiter.render(makeData());
    expect(html).toContain('Recruiter view');
    expect(html).toContain('Overall level');
    expect(html).toContain('Senior');
    expect(html).toContain('App Builder');
    expect(html).toContain('Claude Code');
    expect(html).toContain('Recent commits look substantial');
  });

  it('renders on minimal data with no insights', () => {
    const { html } = recruiter.render(makeData({ insights: undefined }));
    expect(html).toContain('Recruiter view');
    expect(html).toContain("What this can't tell you");
  });

  it('shows neutral copy when there are no provenance badges', () => {
    const data = makeData({ insights: { ...fullInsights, provenanceBadges: [] } });
    const { html } = recruiter.render(data);
    expect(html).toContain('No standout provenance signals');
  });

  it('shows cadence-unavailable copy when commitActivity is missing', () => {
    const data = makeData({ insights: { ...fullInsights, commitActivity: undefined } });
    const { html } = recruiter.render(data);
    expect(html).toContain('cadence unavailable');
  });

  it('states no AI signals when aiUsage is absent', () => {
    const data = makeData({ insights: { ...fullInsights, aiUsage: undefined } });
    const { html } = recruiter.render(data);
    expect(html).toContain('No AI-tool signals found');
  });

  it('always renders the honesty panel', () => {
    expect(recruiter.render(makeData()).html).toContain("What this can't tell you");
    expect(recruiter.render(makeData({ insights: undefined })).html).toContain("What this can't tell you");
  });

  it('does not render a numeric score or tier headline', () => {
    const { html } = recruiter.render(makeData());
    expect(html).not.toMatch(/\/100/);
    expect(html).not.toContain('Tier');
  });
});
