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
  // Prefer pushed_at (last commit on the default branch). Fall back to
  // updated_at when the API didn't return it (older fixtures, deserialised
  // edge cases). The previous version used updated_at, which is bumped by any
  // metadata change and was the root cause of the "all bubbles cluster top"
  // chart bug.
  const tsSource = r.pushed_at ?? r.updated_at;
  const recencyDays = Math.min(1000, (now - new Date(tsSource).getTime()) / DAY_MS);
  const recencyBoost = Math.max(0, 1000 - recencyDays) / 20;
  return r.stargazers_count * 3 + r.forks_count * 2 + (r.watchers_count || 0) + recencyBoost;
}

// ---- Archetype detection -------------------------------------------------

// Weighted keyword scoring for archetype categories. Each repo contributes
// matches across its name, topics, and description with the per-source
// weights below. The sum is multiplied by log(stars+1)+1 so a single megastar
// repo pulls more than a dozen forgotten experiments. Picking a single
// category requires a clear margin (≥1.5×) over the runner-up; otherwise we
// return "Generalist Builder" rather than mislabel.

type ArchetypeCategory =
  | 'AI Toolsmith'
  | 'App Builder'
  | 'Systems Shaper'
  | 'Product Hacker'
  | 'Data Explorer'
  | 'Tools Maker';

const ARCHETYPE_KEYWORDS: Record<ArchetypeCategory, readonly string[]> = {
  // Tightened: 'model' alone matched too many false positives ("model viewer",
  // "data model"). Stick to AI-specific terms.
  'AI Toolsmith': [
    'llm', 'agent', 'openai', 'anthropic', 'claude', 'gemini', 'rag',
    'transformer', 'embedding', 'mlops', 'fine-tune', 'vector-db', 'gpt',
    'langchain', 'huggingface', 'prompt',
  ],
  'App Builder': [
    'ios', 'android', 'mobile', 'swiftui', 'jetpack', 'kotlin-multiplatform',
    'flutter', 'react-native', 'expo',
  ],
  'Systems Shaper': [
    'kernel', 'compiler', 'runtime', 'wasm', 'unikernel', 'kubernetes',
    'docker', 'observability', 'tracing', 'storage-engine', 'database-engine',
    'protocol', 'bpf', 'systems',
  ],
  'Product Hacker': [
    'saas', 'webapp', 'startup', 'landing-page', 'next-app', 'dashboard',
    'product', 'side-project', 'directory', 'marketplace',
  ],
  'Data Explorer': [
    'dataset', 'pandas', 'jupyter', 'notebook', 'analytics', 'etl',
    'visualization', 'visualisation', 'scrape', 'crawler', 'data-science',
  ],
  'Tools Maker': [
    'cli', 'utility', 'helper', 'library', 'module', 'package', 'plugin',
    'lint', 'eslint', 'prettier', 'codemod', 'devtool', 'config',
    'awesome', 'collection',
  ],
};

const LANGUAGE_HINTS: Partial<Record<ArchetypeCategory, readonly string[]>> = {
  'App Builder': ['Swift', 'Kotlin', 'Objective-C', 'Dart'],
  'Systems Shaper': ['Go', 'Rust', 'C', 'C++', 'Zig', 'Shell', 'Assembly'],
  'Product Hacker': ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'Vue', 'Svelte'],
  'Data Explorer': ['Python', 'R', 'Julia', 'Jupyter Notebook'],
};

const ARCHETYPE_MARGIN = 1.5;

export function archetype(
  langs: Record<string, number>,
  repos: readonly GhRepo[],
): string {
  if (repos.length === 0) return 'Generalist Builder';

  const scores: Record<ArchetypeCategory, number> = {
    'AI Toolsmith': 0,
    'App Builder': 0,
    'Systems Shaper': 0,
    'Product Hacker': 0,
    'Data Explorer': 0,
    'Tools Maker': 0,
  };

  for (const r of repos) {
    const name = (r.name ?? '').toLowerCase();
    const desc = (r.description ?? '').toLowerCase();
    const topics = (r.topics ?? []).map((t) => t.toLowerCase());
    const starWeight = Math.log2((r.stargazers_count ?? 0) + 1) + 1;

    for (const cat of Object.keys(ARCHETYPE_KEYWORDS) as ArchetypeCategory[]) {
      let s = 0;
      for (const kw of ARCHETYPE_KEYWORDS[cat]) {
        if (topics.includes(kw)) s += 3;
        if (name.includes(kw)) s += 2;
        if (desc.includes(kw)) s += 1;
      }
      scores[cat] += s * starWeight;
    }
  }

  // Add language hints with a softer weight than keyword matches so a single
  // dominant primary language doesn't paper over the project text.
  for (const cat of Object.keys(LANGUAGE_HINTS) as ArchetypeCategory[]) {
    const hint = LANGUAGE_HINTS[cat];
    if (!hint) continue;
    const hits = hint.reduce((n, l) => n + (langs[l] ?? 0), 0);
    scores[cat] += hits * 1.2;
  }

  const ranked = (Object.entries(scores) as Array<[ArchetypeCategory, number]>)
    .sort((a, b) => b[1] - a[1]);
  const [winner, winnerScore] = ranked[0];
  const runnerScore = ranked[1]?.[1] ?? 0;

  // Require a clear margin OR a non-trivial absolute score before committing.
  // For tied/low totals the user genuinely is a generalist — say so.
  if (winnerScore < 4 || winnerScore < runnerScore * ARCHETYPE_MARGIN) {
    return 'Generalist Builder';
  }
  return winner;
}

// ---- Themes --------------------------------------------------------------

const THEME_KEYWORDS: Record<string, readonly string[]> = {
  AI: ['ai', 'llm', 'agent', 'openai', 'claude', 'rag', 'gpt', 'embedding'],
  Web: ['web', 'site', 'next', 'react', 'html', 'css', 'frontend', 'app'],
  Data: ['data', 'analysis', 'visual', 'chart', 'scrape', 'etl', 'pandas'],
  Tools: ['cli', 'tool', 'utility', 'script', 'automation', 'bot', 'codemod'],
  Mobile: ['ios', 'swift', 'android', 'kotlin', 'mobile', 'expo'],
  Infra: ['docker', 'deploy', 'cloud', 'api', 'server', 'infra', 'kubernetes'],
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

/**
 * Theme display helper: when many themes match (the "everything" problem on
 * dense profiles), collapse to a "Generalist" pseudo-theme instead of
 * showing all six. Keep at most `cap` themes when below the floor.
 */
export function summariseThemes(themes: Themes, cap = 3): Themes {
  if (themes.length === 0) return themes;
  if (themes.length >= 5) {
    // Everything matches → noise → "Generalist" instead.
    return [['Generalist', themes[0][1]]] as const;
  }
  return themes.slice(0, cap);
}

// ---- Battle stats --------------------------------------------------------

const clamp = (n: number) => Math.max(1, Math.min(99, Math.round(n)));

/**
 * Plain-English formulas for each Battle Card stat. Surfaced as tooltips in
 * the SPA so the unitless 0-99 numbers stop being mystery theatre. Kept in
 * the same module as the actual computation so they can't drift.
 */
export const BATTLE_FORMULAS: Record<keyof Omit<BattleStats, 'tier'>, string> = {
  build: 'Volume of public output. log₂(non-fork repos + 1) × 12 (+8 if a single repo). Capped at 99.',
  impact: 'Reach across the audience. log₂(total stars + 1) × 7 + log₂(followers + 1) × 3. Capped at 99.',
  versatility: 'Breadth across stacks. languages × 6 + themes × 4. Capped at 99.',
  momentum: 'Recent activity. Share of repos pushed within the last 180 days × 90. Capped at 99.',
  community: 'Signal others use the work. log₂(followers + 1) × 5 + log₂(total forks + 1) × 4. Capped at 99.',
  originality: 'Original output. 5 + (non-fork ratio × 30) + (themes × 3) + log₂(non-fork count + 1) × 4. Capped at 99.',
};

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

  const tsOf = (r: GhRepo) => new Date(r.pushed_at ?? r.updated_at).getTime();
  const recent = repos.filter((r) => (now - tsOf(r)) / DAY_MS < 180).length;
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
    momentum: claim(momentum, 'medium', [{ kind: 'derived', ref: `${recent}/${repos.length} repos pushed in last 180 days` }]),
    community: claim(community, 'medium', followerEv),
    originality: claim(originality, 'low', [...themeEv, { kind: 'derived', ref: 'non-fork ratio' }]),
    tier,
  };
}

export function statValue(c: Claim<number>): number {
  return c.value;
}
