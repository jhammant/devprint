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
  const recent = repos.filter((r) => (now - new Date(r.updated_at).getTime()) / DAY_MS < 180).length;

  const build = clamp(30 + Math.log2(repos.length + 1) * 11 + (repo ? 12 : 0));
  const impact = clamp(18 + Math.log2(totalStars + 1) * 12 + Math.log2((profile.followers || 0) + 1) * 5);
  const versatility = clamp(22 + Object.keys(langs).length * 11 + themes.length * 5);
  const momentum = clamp(20 + (recent / Math.max(1, repos.length)) * 70);
  const community = clamp(
    18 +
      Math.log2((profile.followers || 0) + 1) * 12 +
      Math.log2(repos.reduce((n, r) => n + r.forks_count, 0) + 1) * 8,
  );
  const originality = clamp(35 + repos.filter((r) => !r.fork).length * 1.2 + themes.length * 6);

  const avg = (build + impact + versatility + momentum + community + originality) / 6;
  const tier: BattleStats['tier'] = avg > 82 ? 'Legendary' : avg > 68 ? 'Epic' : avg > 52 ? 'Rare' : 'Emerging';

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
