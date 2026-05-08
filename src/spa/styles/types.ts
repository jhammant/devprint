// Shared shapes for the style renderers. Each renderer takes a `ProfileData`
// and returns the full result-section HTML to splat into the page, plus an
// optional mount() that runs after innerHTML is set (for things like the
// holofoil's mouse-tracked foil).

import type {
  BattleStats,
  GhRepo,
  GhUser,
  Insights,
  Themes,
} from '../../analysis/index.ts';

export type ProfileData = {
  profile: GhUser;
  repo?: GhRepo;
  isRepo: boolean;
  /** All non-fork repos sorted by score, from listUserRepos (or [repo] for repo pages). */
  repos: GhRepo[];
  topLangs: Array<[string, number]>;
  langs: Record<string, number>;
  themes: Themes;
  archetype: string;
  totalStars: number;
  battle: BattleStats;
  /** Pulled from the JSON sidecar; may be undefined if the endpoint failed. */
  insights?: Insights;
  /** Markdown agent pack. */
  pack: string;
  target: string;
};

export type StyleId =
  | 'default'
  | 'trading-card'
  | 'letterhead'
  | 'holofoil'
  | 'newspaper';

export type StyleRenderer = {
  id: StyleId;
  /** Display label for the picker. */
  name: string;
  /** One-line subtitle for the picker dropdown. */
  blurb: string;
  /** Returns the HTML for the result section + optional post-render hook. */
  render(data: ProfileData): { html: string; mount?: (root: HTMLElement) => void };
  /** Whether the renderer should hide the SPA's default search/nav chrome. */
  takeover?: boolean;
};

// ---- shared helpers all renderers want -----------------------------------

export function escapeHtml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export function escapeAttr(s: string): string {
  return escapeHtml(s);
}

export function shortStars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function relativeDate(iso: string): string {
  const t = new Date(iso).getTime();
  const days = Math.round((Date.now() - t) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} mo ago`;
  return `${Math.round(days / 365)} yr ago`;
}

export function topRepos(repos: readonly GhRepo[], n = 6): GhRepo[] {
  return [...repos]
    .filter((r) => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, n);
}

/** Year of the earliest repo created — proxies "years coding publicly". */
export function yearsActive(repos: readonly GhRepo[]): number | undefined {
  // GhRepo doesn't carry created_at today; use updated_at as a fallback floor.
  // When we add created_at to the type this becomes more accurate.
  if (repos.length === 0) return undefined;
  const earliestUpdated = repos
    .map((r) => new Date(r.updated_at).getTime())
    .sort((a, b) => a - b)[0];
  const years = Math.max(1, Math.floor((Date.now() - earliestUpdated) / (365.25 * 86_400_000)));
  return years;
}
