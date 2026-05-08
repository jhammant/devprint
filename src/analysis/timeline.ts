// Career timeline — derives a small set of public-history milestones from a
// user's repo set. Cheap to compute (no extra API calls); cards use this to
// turn "X years coding publicly" from a vibe into a verifiable claim.

import type { GhRepo } from './types.ts';

export type CareerMilestone = {
  /** Year the milestone happened (or `null` for "ongoing" markers). */
  year: number;
  /** Short label rendered as the bullet copy. */
  label: string;
  /** Optional repo this milestone is grounded in. */
  repo?: { name: string; full_name: string; html_url: string };
};

export type LangYearShare = {
  year: number;
  /** Top language for this year, by repos created/touched. */
  topLang: string;
  /** All languages touched that year, descending. */
  langs: Array<{ name: string; count: number }>;
};

export type CareerTimeline = {
  /** Year of earliest known repo created. */
  firstYear?: number;
  /** Year of most recent push across the repo set. */
  latestYear?: number;
  /** Number of years between firstYear and latestYear, inclusive. */
  yearsActive?: number;
  /** Notable milestones, oldest first. Up to ~6. */
  milestones: CareerMilestone[];
  /** Languages by year, latest first. Used for the "stack drift" chart. */
  langsByYear: LangYearShare[];
};

const POPULAR_THRESHOLD = 100;

/**
 * Build a timeline from public repo data alone. Mutates nothing; returns
 * `{ milestones: [] }` shape if the repo set is empty so callers don't have
 * to optional-chain.
 */
export function buildCareerTimeline(repos: readonly GhRepo[]): CareerTimeline {
  if (repos.length === 0) return { milestones: [], langsByYear: [] };

  const withCreated = repos.filter((r) => !!r.created_at);
  const yearOf = (iso: string | undefined): number | undefined => {
    if (!iso) return undefined;
    const y = new Date(iso).getUTCFullYear();
    return Number.isFinite(y) && y > 1990 && y < 3000 ? y : undefined;
  };

  // First year: oldest repo created. Latest: max(pushed_at, updated_at).
  const createdYears = withCreated
    .map((r) => yearOf(r.created_at))
    .filter((y): y is number => typeof y === 'number')
    .sort((a, b) => a - b);
  const firstYear = createdYears[0];
  const lastTouches = repos
    .map((r) => yearOf(r.pushed_at) ?? yearOf(r.updated_at))
    .filter((y): y is number => typeof y === 'number')
    .sort((a, b) => b - a);
  const latestYear = lastTouches[0];
  const yearsActive = firstYear && latestYear ? latestYear - firstYear + 1 : undefined;

  // Milestones: dated, useful for a horizontal track.
  const milestones: CareerMilestone[] = [];

  if (firstYear) {
    const firstRepo = withCreated.sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime())[0];
    milestones.push({
      year: firstYear,
      label: `First public repo · ${firstRepo?.name ?? '—'}`,
      ...(firstRepo ? { repo: { name: firstRepo.name, full_name: firstRepo.full_name, html_url: firstRepo.html_url } } : {}),
    });
  }

  // First popular repo (≥100 stars), by created_at year.
  const popular = withCreated
    .filter((r) => r.stargazers_count >= POPULAR_THRESHOLD)
    .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());
  if (popular[0]) {
    const y = yearOf(popular[0].created_at);
    if (y && y !== firstYear) {
      milestones.push({
        year: y,
        label: `First popular repo · ${popular[0].name} (${popular[0].stargazers_count.toLocaleString()} ★)`,
        repo: { name: popular[0].name, full_name: popular[0].full_name, html_url: popular[0].html_url },
      });
    }
  }

  // Most-starred repo (peak public reception).
  const peak = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count)[0];
  if (peak && peak.stargazers_count >= POPULAR_THRESHOLD) {
    const y = yearOf(peak.created_at);
    if (y && !milestones.some((m) => m.repo?.full_name === peak.full_name)) {
      milestones.push({
        year: y,
        label: `Most-starred repo · ${peak.name} (${peak.stargazers_count.toLocaleString()} ★)`,
        repo: { name: peak.name, full_name: peak.full_name, html_url: peak.html_url },
      });
    }
  }

  // Recent activity marker — "still shipping in <year>".
  if (latestYear) {
    milestones.push({
      year: latestYear,
      label: `Latest public push${repos.length > 1 ? ` · ${repos.length} active repos this year` : ''}`,
    });
  }

  // De-duplicate by (year, label) and keep oldest-first ordering.
  const seen = new Set<string>();
  const sorted = milestones
    .filter((m) => {
      const k = `${m.year}|${m.label}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.year - b.year)
    .slice(0, 6);

  // Languages by year, derived from `created_at` year (the year a project
  // was started is more biographical than the year it was last updated).
  const yearMap = new Map<number, Map<string, number>>();
  for (const r of repos) {
    const y = yearOf(r.created_at) ?? yearOf(r.pushed_at);
    if (!y || !r.language) continue;
    if (!yearMap.has(y)) yearMap.set(y, new Map());
    const m = yearMap.get(y)!;
    m.set(r.language, (m.get(r.language) ?? 0) + 1);
  }
  const langsByYear: LangYearShare[] = Array.from(yearMap.entries())
    .map(([year, langs]) => {
      const list = Array.from(langs.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      return { year, topLang: list[0]?.name ?? '—', langs: list };
    })
    .sort((a, b) => b.year - a.year);

  return {
    ...(firstYear !== undefined ? { firstYear } : {}),
    ...(latestYear !== undefined ? { latestYear } : {}),
    ...(yearsActive !== undefined ? { yearsActive } : {}),
    milestones: sorted,
    langsByYear,
  };
}
