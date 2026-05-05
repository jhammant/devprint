import type {
  BattleStats,
  Claim,
  GhRepo,
  GhUser,
  Themes,
} from './types.ts';
import { claim } from './confidence.ts';

const DAY_MS = 86_400_000;

export function scoreRepo(r: GhRepo, now: number = Date.now()): number {
  const recencyDays = Math.min(1000, (now - new Date(r.updated_at).getTime()) / DAY_MS);
  const recencyBoost = Math.max(0, 1000 - recencyDays) / 20;
  return r.stargazers_count * 3 + r.forks_count * 2 + (r.watchers_count || 0) + recencyBoost;
}

export function archetype(
  langs: Record<string, number>,
  repos: readonly GhRepo[],
): string {
  const names = Object.keys(langs);
  const desc = repos
    .map((r) => `${r.description ?? ''} ${r.name} ${(r.topics ?? []).join(' ')}`)
    .join(' ')
    .toLowerCase();
  if (/\b(ai|llm|agent|model|rag|openai|claude|gemini|machine|neural)\b/.test(desc)) return 'AI Toolsmith';
  if (names.includes('Swift') || names.includes('Kotlin')) return 'App Builder';
  if (names.includes('Go') || names.includes('Rust') || names.includes('Shell')) return 'Systems Shaper';
  if (names.some((n) => ['HTML', 'CSS', 'JavaScript', 'TypeScript'].includes(n))) return 'Product Hacker';
  if (/\b(data|analysis|notebook|visual|chart)\b/.test(desc) || names.includes('Python')) return 'Data Explorer';
  return 'Pragmatic Builder';
}

const THEME_KEYWORDS: Record<string, readonly string[]> = {
  AI: ['ai', 'llm', 'agent', 'openai', 'claude', 'model', 'rag', 'gpt'],
  Web: ['web', 'site', 'next', 'react', 'html', 'css', 'frontend', 'app'],
  Data: ['data', 'analysis', 'visual', 'chart', 'scrape', 'etl'],
  Tools: ['cli', 'tool', 'script', 'automation', 'bot'],
  Mobile: ['ios', 'swift', 'android', 'kotlin', 'mobile'],
  Infra: ['docker', 'deploy', 'cloud', 'api', 'server', 'infra'],
};

export function getThemes(repos: readonly GhRepo[]): Themes {
  const text = repos
    .map((r) => `${r.name} ${r.description ?? ''} ${(r.topics ?? []).join(' ')}`.toLowerCase())
    .join(' ');
  return Object.entries(THEME_KEYWORDS)
    .map(([k, words]) => [k, words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0)] as const)
    .filter((x) => x[1] > 0)
    .sort((a, b) => b[1] - a[1]);
}

const clamp = (n: number) => Math.max(1, Math.min(99, Math.round(n)));

export function battleStats(
  profile: GhUser,
  repos: readonly GhRepo[],
  langs: Record<string, number>,
  totalStars: number,
  themes: Themes,
  repo?: GhRepo,
  now: number = Date.now(),
): BattleStats {
  // Recalibrated 2026-05-05. The previous version had constants that pushed
  // every moderately-active dev's stats to 99 (clamped) and every average to
  // Legendary (>82). New formulas drop the constant bases, use tighter log
  // multipliers, and tighter tier thresholds so Legendary is genuinely rare.

  const recent = repos.filter((r) => (now - new Date(r.updated_at).getTime()) / DAY_MS < 180).length;
  const recencyRatio = repos.length ? recent / repos.length : 0;
  const totalForks = repos.reduce((n, r) => n + r.forks_count, 0);
  const nonForkCount = repos.filter((r) => !r.fork).length;
  const langCount = Object.keys(langs).length;
  const repoBonus = repo ? 8 : 0;

  // Volume of public output — how much have they actually built.
  const build = clamp(Math.log2(repos.length + 1) * 12 + repoBonus);

  // Reach. Stars matter more than followers.
  const impact = clamp(Math.log2(totalStars + 1) * 7 + Math.log2((profile.followers || 0) + 1) * 3);

  // Breadth across languages + themes.
  const versatility = clamp(langCount * 6 + themes.length * 4);

  // Recency of activity. 0 if dormant; ~90 if everything recent.
  const momentum = clamp(recencyRatio * 90);

  // Followers + forks (signal that others use the work).
  const community = clamp(
    Math.log2((profile.followers || 0) + 1) * 5 + Math.log2(totalForks + 1) * 4,
  );

  // Original output. Rewards non-fork ratio + theme spread + non-fork count.
  const originality = clamp(
    nonForkCount > 0
      ? 5 + (nonForkCount / Math.max(1, repos.length)) * 30 + themes.length * 3 + Math.log2(nonForkCount + 1) * 4
      : 5,
  );

  const avg = (build + impact + versatility + momentum + community + originality) / 6;
  // Tier thresholds tightened: Legendary now genuinely rare. Calibrated
  // against test profiles spanning beginner → notable → top-1%.
  const tier: BattleStats['tier'] =
    avg >= 78 ? 'Legendary' : avg >= 58 ? 'Epic' : avg >= 38 ? 'Rare' : 'Emerging';

  const repoEv = [{ kind: 'derived' as const, ref: `${repos.length} non-fork repos` }];
  const langEv = [{ kind: 'derived' as const, ref: `${Object.keys(langs).length} languages observed` }];
  const starEv = [{ kind: 'derived' as const, ref: `${totalStars} stars across portfolio` }];
  const followerEv = [{ kind: 'field' as const, ref: 'profile.followers' }];
  const themeEv = [{ kind: 'derived' as const, ref: `${themes.length} themes detected` }];

  return {
    build: claim(build, 'high', repoEv),
    impact: claim(impact, 'high', [...starEv, ...followerEv]),
    versatility: claim(versatility, 'medium', [...langEv, ...themeEv]),
    momentum: claim(momentum, 'medium', [{ kind: 'derived', ref: `${recent}/${repos.length} repos updated in last 180 days` }]),
    community: claim(community, 'medium', followerEv),
    originality: claim(originality, 'low', [...themeEv, { kind: 'derived', ref: 'non-fork ratio' }]),
    tier,
  };
}

export function statValue(c: Claim<number>): number {
  return c.value;
}
