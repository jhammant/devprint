// Shared shapes for the style renderers. Each renderer takes a `ProfileData`
// and returns the full result-section HTML to splat into the page, plus an
// optional mount() that runs after innerHTML is set (for things like the
// holofoil's mouse-tracked foil).

import type {
  BattleStats,
  GhRepo,
  GhUser,
  Insights,
  ProfileExtra,
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
  /**
   * User-supplied overrides from `<owner>/.github/devprint.json`. Convenience
   * pointer; equivalent to `data.insights?.profileExtra` but easier to use in
   * renderers without having to optional-chain through insights every time.
   */
  profileExtra?: ProfileExtra;
  /** Markdown agent pack. */
  pack: string;
  target: string;
};

export type StyleId =
  | 'default'
  | 'trading-card'
  | 'letterhead'
  | 'holofoil'
  | 'newspaper'
  | 'boardingpass'
  | 'receipt'
  | 'vinyl'
  | 'magazine'
  | 'arcade'
  | 'subway'
  | 'recruiter';

export type StyleRenderer = {
  id: StyleId;
  /** Display label for the picker. */
  name: string;
  /** One-line subtitle for the picker dropdown. */
  blurb: string;
  /**
   * Returns the HTML for the result section + optional post-render hook.
   * `mount()` may return an `unmount` function — used by the dispatcher to
   * tear down event listeners (mousemove etc.) when the user picks another
   * style without a full page reload.
   */
  render(data: ProfileData): {
    html: string;
    mount?: (root: HTMLElement) => void | (() => void);
  };
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

/** Build a LinkedIn share URL pointing at the current devprint URL. */
export function linkedinShareUrl(href: string = location.href): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(href)}`;
}

/** Build a Twitter/X share intent URL with text + the current devprint URL. */
export function tweetUrl(text: string, href: string = location.href): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(href)}`;
}

/**
 * Render the given DOM node to a PNG and trigger a download. Used by every
 * style renderer's "Save PNG" CTA so the artefact can be shared as an image
 * (otherwise the OS-screenshot tax kills polish + crops the picker into the
 * frame).
 */
export async function saveAsPng(
  node: HTMLElement | null,
  filename = 'devprint.png',
  background = '#0a0d18',
): Promise<boolean> {
  if (!node) return false;
  const { toPng } = await import('html-to-image');
  try {
    const dataUrl = await toPng(node, {
      pixelRatio: 2,
      backgroundColor: background,
      cacheBust: true,
      style: { transform: 'none' },
      // Drop the interactive toolbar from the export. Every style names its
      // CTA bar `<id>-cta` (lh-cta, hf-cta, ar-cta, …) or `<id>-share`
      // (np-share). Future styles can opt in with data-export-hide="true".
      filter: (n) => {
        if (!(n instanceof HTMLElement)) return true;
        if (n.dataset.exportHide === 'true') return false;
        for (const c of n.classList) if (/^[a-z]{2,3}-(cta|share)$/.test(c)) return false;
        return true;
      },
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}

/** Helpers to flash a label on a CTA element after click. */
export function flashLabel(el: HTMLElement, msg: string, ms = 1200): void {
  const original = el.textContent ?? '';
  el.textContent = msg;
  setTimeout(() => (el.textContent = original), ms);
}
