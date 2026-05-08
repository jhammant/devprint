// Structured-JSON sidecar for the SPA. The agent endpoint returns markdown by
// default; the SPA also wants stack chips, a commit-style line, the real
// 52-week commit-activity heatmap, and a "related people" panel. Building
// these client-side would cost 30+ GitHub calls per page render against the
// unauth 60/hr-per-IP ceiling — so the Lambda (which has a server-side token
// + CloudFront cache) builds them once and the SPA reads them as JSON.

import type { GhClient } from './github.ts';
import { packageFileCandidates } from './github.ts';
import { detectStack, mergeStacks, type StackInference } from './stack.ts';
import { inferCommitStyle, type CommitStyleVerdict } from './commits.ts';
import { buildCareerTimeline, type CareerTimeline } from './timeline.ts';
import { scoreRepo } from './infer.ts';
import { scrub } from './scrub.ts';
import type { GhContributor, GhRepo, RepoFile } from './types.ts';

export type CommitActivityWeek = { week: number; total: number };

export type RelatedProfile = {
  login: string;
  avatar_url: string;
  contributions: number;
  /** For user insights, the repo we found this contributor through. */
  viaRepo?: string;
};

/**
 * User-controlled overrides loaded from `<owner>/.github/devprint.json` (or
 * fallback `<owner>/<owner>/devprint.json` — the profile-readme repo). Every
 * field is optional and stylistically merged into the rendered card. The
 * styles are designed to look fine when this is `undefined` (the common
 * case); fields only render when the user has filled them in.
 */
export type ProfileExperience = {
  role: string;
  org?: string;
  /** ISO year-month (`2024-03`) or year (`2024`). */
  from?: string;
  to?: string;
  summary?: string;
  href?: string;
};

export type ProfileTalk = {
  title: string;
  venue?: string;
  /** Year or year-month. */
  date?: string;
  href?: string;
};

export type ProfileWriting = {
  title: string;
  /** Year or year-month. */
  date?: string;
  href: string;
  publisher?: string;
};

export type ProfileEducation = {
  degree?: string;
  org: string;
  /** Year or year-range, e.g. `2018` or `2014-2018`. */
  date?: string;
};

export type ProfileEndorsement = {
  /** Author's display name. */
  from: string;
  /** Optional GitHub login — links the endorser to their devprint card. */
  github?: string;
  /** Optional title/role of the endorser. */
  role?: string;
  /** The quote itself. */
  blurb: string;
};

export type ProfileExtra = {
  /** Single-line tagline shown under the name. */
  tagline?: string;
  /** Status ribbon copy ("Open to advisor chats", "Available · Q3 2026"). */
  status?: string;
  /** Replaces the GitHub-bio paragraph in styles that show prose. */
  about?: string;
  /** Repo names (no owner) to feature first in "Selected works" lists. */
  pinned?: string[];
  /** Outbound links for the contact rail / footer. */
  links?: Array<{ name: string; href: string }>;
  /** Bullet wins surfaced as a "Highlights" section. */
  highlights?: string[];
  /** Skill chips beyond the language inference. */
  skills?: string[];
  /** "Right now" line — what they're up to today. */
  now?: string;
  /** What they're available for ("Advisory", "Speaking", "Short consulting"). */
  available?: string;
  /** Soft ask — what kind of intro / message they'd want from a reader. */
  ask?: string;
  /** Optional contact email (only render with explicit user permission). */
  contact?: string;
  /** Career / work history. Each entry renders as a row in "Experience". */
  experience?: ProfileExperience[];
  /** Education entries — degree, school, year. */
  education?: ProfileEducation[];
  /** Talks given — surfaced as a "Talks" section. */
  talks?: ProfileTalk[];
  /** Writing — blog posts, essays, books. */
  writing?: ProfileWriting[];
  /** Endorsements / quotes from peers. */
  endorsements?: ProfileEndorsement[];
  /** Where this object was found (./.github/devprint.json etc.) — debug only. */
  source?: string;
};

export type Insights = {
  target: string;
  kind: 'user' | 'repo';
  generatedAt: string;
  stack: StackInference;
  /** For user insights, per-repo stack across top 3 active repos. */
  perRepoStack?: Array<{ repo: string; stack: StackInference }>;
  commitStyle?: CommitStyleVerdict;
  /**
   * 52 weeks of commit counts (oldest first). For user insights this is the
   * sum across top-3 repos (a "personal pulse"); for repo insights it's the
   * single repo. Undefined when GitHub's cache hasn't built it yet.
   */
  commitActivity?: CommitActivityWeek[];
  /** Repo (single) or comma-joined repo list (user) whose data we summed. */
  commitActivitySource?: string;
  /**
   * People who often build with this person (user pages) or top contributors
   * to this repo (repo pages). Excludes bot accounts and the user themselves.
   */
  relatedProfiles?: RelatedProfile[];
  /**
   * For user pages where listUserRepos hit the 100-repo cap. Lets the SPA say
   * "top 100 of N by recency" instead of pretending the analysis covers
   * everything.
   */
  reposAnalysed?: number;
  publicReposTotal?: number;
  /**
   * Optional user-supplied overrides from `<owner>/.github/devprint.json`.
   * When present, styles can use it to flavour the card (status ribbon,
   * tagline, available-for line, pinned repos, links). When absent the
   * styles render fine on GitHub data alone.
   */
  profileExtra?: ProfileExtra;
  /**
   * Career milestones derived from `created_at` / `pushed_at` across the
   * repo set: first public repo, first popular (≥100 ★) repo, peak repo,
   * latest activity, plus the language used per year.
   */
  timeline?: CareerTimeline;
  /**
   * Top external organisations the user has contributed to — repos they
   * don't own. Detected via the GitHub commit-search API. Empty when no
   * external work is found or the search rate-limit was hit.
   */
  externalContribs?: ExternalContribOrg[];
  /** A small set of provenance signals surfaced as trust badges. */
  provenanceBadges?: ProvenanceBadge[];
};

export type ExternalContribOrg = {
  /** Owner login (typically an org). */
  org: string;
  org_avatar?: string;
  /** Number of merged PRs / commits the user has against this org. */
  contributions: number;
  /** Top repos within this org the user has contributed to. */
  topRepos: Array<{ name: string; full_name: string; html_url: string; stars?: number }>;
};

export type ProvenanceBadge = {
  /** Short label, eg. "Verified active" / "Maintainer" / "Long arc". */
  label: string;
  /** One-sentence rationale used as a hover/tooltip. */
  detail: string;
  /** Brand colour bucket the renderer maps to a hue. */
  tone: 'positive' | 'neutral' | 'milestone';
};

export type BuildInsightsOptions = {
  generatedAt?: string;
  /** Limit how many repos to scan for stack inference. Default 3. */
  topRepoCount?: number;
};

const TOP_REPOS_DEFAULT = 3;
const RELATED_PROFILE_LIMIT = 8;
// When the top-3 manifest scan yields zero detected libs, broaden to this
// many repos before giving up. Catches the sindresorhus case where his
// top-by-score repos happen to be README-only awesome lists.
const FALLBACK_REPO_COUNT = 8;

export async function buildUserInsights(
  client: GhClient,
  user: string,
  opts: BuildInsightsOptions = {},
): Promise<Insights> {
  const reposRaw = await client.listUserRepos(user, { max: 100 });
  const profile = await client.getUser(user).catch(() => undefined);
  const repos = reposRaw.filter((r) => !r.fork).sort((a, b) => scoreRepo(b) - scoreRepo(a));
  const initialN = opts.topRepoCount ?? TOP_REPOS_DEFAULT;
  let top = repos.slice(0, initialN);

  let { perRepoStack, stacks } = await scanStacks(client, top);
  // Broaden when the merged top-N yields no detected libs (typical for
  // README-only "awesome-*" repos at the top of a maintainer's list).
  if (mergeStacks(stacks).detected.length === 0 && repos.length > initialN) {
    const broadenedTop = repos.slice(0, FALLBACK_REPO_COUNT);
    const broadened = await scanStacks(client, broadenedTop);
    if (broadened.stacks.some((s) => s.detected.length > 0)) {
      perRepoStack = broadened.perRepoStack;
      stacks = broadened.stacks;
      top = broadenedTop;
    }
  }

  // Aggregate commit activity across the top 3 repos so the chart reflects
  // "this person's pulse", not just one project's. Each /stats call may
  // return undefined while GitHub warms the cache — we silently drop those.
  const aggregated = await aggregateCommitActivity(client, top.slice(0, TOP_REPOS_DEFAULT));

  // "Often building with" — top contributors across top 3 repos, excluding
  // the user themselves and any bot accounts.
  const relatedProfiles = await collectUserCollaborators(
    client,
    top.slice(0, TOP_REPOS_DEFAULT),
    user,
  );

  const reposAnalysed = repos.length;
  const publicReposTotal = profile?.public_repos;
  const profileExtra = await fetchProfileExtra(client, user);
  const timeline = buildCareerTimeline(repos);
  const externalContribs = await detectExternalContributions(client, user).catch(() => []);
  const provenanceBadges = deriveProvenanceBadges({
    repos,
    timeline,
    relatedProfiles,
    externalContribs,
  });

  return {
    target: user,
    kind: 'user',
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    stack: mergeStacks(stacks),
    perRepoStack,
    ...(aggregated ? { commitActivity: aggregated.weeks, commitActivitySource: aggregated.source } : {}),
    ...(relatedProfiles.length ? { relatedProfiles } : {}),
    reposAnalysed,
    ...(publicReposTotal !== undefined ? { publicReposTotal } : {}),
    ...(profileExtra ? { profileExtra } : {}),
    ...(timeline.milestones.length ? { timeline } : {}),
    ...(externalContribs.length ? { externalContribs } : {}),
    ...(provenanceBadges.length ? { provenanceBadges } : {}),
  };
}

export async function buildRepoInsights(
  client: GhClient,
  owner: string,
  repoName: string,
  opts: BuildInsightsOptions = {},
): Promise<Insights> {
  const [stack, commits, ca, contributors] = await Promise.all([
    detectRepoStack(client, owner, repoName),
    client.getRecentCommits(owner, repoName, undefined, 30).catch(() => []),
    client.getCommitActivity(owner, repoName).catch(() => undefined),
    client.getContributors(owner, repoName, RELATED_PROFILE_LIMIT).catch(() => []),
  ]);
  const commitStyle = inferCommitStyle(commits);
  const relatedProfiles: RelatedProfile[] = contributors
    .slice(0, RELATED_PROFILE_LIMIT)
    .map((c) => ({ login: c.login, avatar_url: c.avatar_url, contributions: c.contributions }));
  // Repo pages also get the owner's overrides — useful for "links / contact"
  // even when the visitor lands on a single-repo page.
  const profileExtra = await fetchProfileExtra(client, owner);
  return {
    target: `${owner}/${repoName}`,
    kind: 'repo',
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    stack,
    commitStyle,
    ...(ca && ca.length ? { commitActivity: ca, commitActivitySource: `${owner}/${repoName}` } : {}),
    ...(relatedProfiles.length ? { relatedProfiles } : {}),
    ...(profileExtra ? { profileExtra } : {}),
  };
}

/**
 * Try to fetch a user-supplied `devprint.json` from one of the well-known
 * locations:
 *   1. `<owner>/.github/devprint.json`   — community-standard "GitHub config" repo
 *   2. `<owner>/<owner>/devprint.json`   — profile-readme repo
 *   3. `<owner>/.github/devprint.yml`    — same repo, YAML variant (best-effort)
 *
 * Returns the parsed object on success, undefined otherwise. We're permissive
 * about field names (the user's hand-writing this) and reject anything
 * that doesn't look like an object so a stray markdown file doesn't blow up.
 */
async function fetchProfileExtra(
  client: GhClient,
  owner: string,
): Promise<ProfileExtra | undefined> {
  // Single canonical location. Users fork jhammant/devprint-template (which
  // keeps the name on fork) or click "Use this template" (which defaults to
  // the same name), then edit devprint.json and push. One path, one story.
  const sources: Array<[string, string, string]> = [
    [owner, 'devprint-template', 'devprint.json'],
  ];
  for (const [o, r, p] of sources) {
    const file = await client.getRepoFile(o, r, p).catch(() => undefined);
    if (!file?.content) continue;
    const parsed = parseProfileExtra(file.content);
    if (parsed) {
      parsed.source = `${o}/${r}/${p}`;
      return parsed;
    }
  }
  return undefined;
}

/**
 * Permissive ProfileExtra parser. Only keeps fields we know about, coerces
 * strings, and rejects anything that doesn't fit the contract — so a
 * malformed file just yields `undefined` rather than rendering garbage.
 */
function parseProfileExtra(raw: string): ProfileExtra | undefined {
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return undefined; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
  const r = obj as Record<string, unknown>;
  const out: ProfileExtra = {};
  const cleanStr = (raw: string, max: number): string => scrub(raw.slice(0, max)).text;
  const str = (k: string, max = 500): string | undefined => typeof r[k] === 'string' ? cleanStr(r[k] as string, max) : undefined;
  const list = (k: string, max = 200): string[] | undefined => Array.isArray(r[k])
    ? (r[k] as unknown[]).filter((v): v is string => typeof v === 'string').map((v) => cleanStr(v, max)).slice(0, 12)
    : undefined;

  const tagline = str('tagline'); if (tagline) out.tagline = tagline;
  const status = str('status'); if (status) out.status = status;
  const about = str('about', 2000); if (about) out.about = about;
  const pinned = list('pinned', 80); if (pinned?.length) out.pinned = pinned;
  const highlights = list('highlights'); if (highlights?.length) out.highlights = highlights;
  const skills = list('skills', 80); if (skills?.length) out.skills = skills;
  const now = str('now'); if (now) out.now = now;
  const available = str('available'); if (available) out.available = available;
  const ask = str('ask', 600); if (ask) out.ask = ask;
  const contact = str('contact'); if (contact) out.contact = contact;

  // Links: array of {name, href} where href must be http(s) — anything else
  // is dropped (no javascript: or relative URLs sneaking through).
  if (Array.isArray(r.links)) {
    const safe: Array<{ name: string; href: string }> = [];
    for (const item of r.links as unknown[]) {
      if (!item || typeof item !== 'object') continue;
      const i = item as Record<string, unknown>;
      const name = typeof i.name === 'string' ? cleanStr(i.name, 60) : undefined;
      const href = typeof i.href === 'string' ? i.href.slice(0, 500) : undefined;
      if (!name || !href) continue;
      if (!/^https?:\/\//i.test(href)) continue;
      safe.push({ name, href });
      if (safe.length >= 8) break;
    }
    if (safe.length) out.links = safe;
  }

  // Helper: only keep http(s) links, otherwise drop.
  const safeHref = (raw: unknown): string | undefined => {
    if (typeof raw !== 'string') return undefined;
    const h = raw.slice(0, 500);
    return /^https?:\/\//i.test(h) ? h : undefined;
  };
  const safeDate = (raw: unknown): string | undefined => {
    if (typeof raw !== 'string') return undefined;
    // Permissive: yyyy, yyyy-mm, yyyy-mm-dd, yyyy-yyyy, "present"
    const t = raw.slice(0, 32);
    return /^(\d{4}|present|\d{4}-\d{2}|\d{4}-\d{4}|\d{4}-\d{2}-\d{2})$/i.test(t) || /^\d{4}.*$/.test(t) ? cleanStr(t, 32) : undefined;
  };

  // Experience: career rows.
  if (Array.isArray(r.experience)) {
    const safe: ProfileExperience[] = [];
    for (const item of r.experience as unknown[]) {
      if (!item || typeof item !== 'object') continue;
      const i = item as Record<string, unknown>;
      const role = typeof i.role === 'string' ? cleanStr(i.role, 120) : undefined;
      if (!role) continue;
      const e: ProfileExperience = { role };
      if (typeof i.org === 'string') e.org = cleanStr(i.org, 120);
      const from = safeDate(i.from); if (from) e.from = from;
      const to = safeDate(i.to); if (to) e.to = to;
      if (typeof i.summary === 'string') e.summary = cleanStr(i.summary, 600);
      const href = safeHref(i.href); if (href) e.href = href;
      safe.push(e);
      if (safe.length >= 12) break;
    }
    if (safe.length) out.experience = safe;
  }

  // Education.
  if (Array.isArray(r.education)) {
    const safe: ProfileEducation[] = [];
    for (const item of r.education as unknown[]) {
      if (!item || typeof item !== 'object') continue;
      const i = item as Record<string, unknown>;
      const org = typeof i.org === 'string' ? cleanStr(i.org, 120) : undefined;
      if (!org) continue;
      const e: ProfileEducation = { org };
      if (typeof i.degree === 'string') e.degree = cleanStr(i.degree, 120);
      const date = safeDate(i.date); if (date) e.date = date;
      safe.push(e);
      if (safe.length >= 6) break;
    }
    if (safe.length) out.education = safe;
  }

  // Talks.
  if (Array.isArray(r.talks)) {
    const safe: ProfileTalk[] = [];
    for (const item of r.talks as unknown[]) {
      if (!item || typeof item !== 'object') continue;
      const i = item as Record<string, unknown>;
      const title = typeof i.title === 'string' ? cleanStr(i.title, 200) : undefined;
      if (!title) continue;
      const e: ProfileTalk = { title };
      if (typeof i.venue === 'string') e.venue = cleanStr(i.venue, 120);
      const date = safeDate(i.date); if (date) e.date = date;
      const href = safeHref(i.href); if (href) e.href = href;
      safe.push(e);
      if (safe.length >= 12) break;
    }
    if (safe.length) out.talks = safe;
  }

  // Writing.
  if (Array.isArray(r.writing)) {
    const safe: ProfileWriting[] = [];
    for (const item of r.writing as unknown[]) {
      if (!item || typeof item !== 'object') continue;
      const i = item as Record<string, unknown>;
      const title = typeof i.title === 'string' ? cleanStr(i.title, 200) : undefined;
      const href = safeHref(i.href);
      if (!title || !href) continue;
      const e: ProfileWriting = { title, href };
      if (typeof i.publisher === 'string') e.publisher = cleanStr(i.publisher, 120);
      const date = safeDate(i.date); if (date) e.date = date;
      safe.push(e);
      if (safe.length >= 12) break;
    }
    if (safe.length) out.writing = safe;
  }

  // Endorsements.
  if (Array.isArray(r.endorsements)) {
    const safe: ProfileEndorsement[] = [];
    for (const item of r.endorsements as unknown[]) {
      if (!item || typeof item !== 'object') continue;
      const i = item as Record<string, unknown>;
      const from = typeof i.from === 'string' ? cleanStr(i.from, 120) : undefined;
      const blurb = typeof i.blurb === 'string' ? cleanStr(i.blurb, 600) : undefined;
      if (!from || !blurb) continue;
      const e: ProfileEndorsement = { from, blurb };
      if (typeof i.role === 'string') e.role = cleanStr(i.role, 120);
      if (typeof i.github === 'string' && /^[a-zA-Z0-9-]{1,39}$/.test(i.github)) e.github = i.github;
      safe.push(e);
      if (safe.length >= 6) break;
    }
    if (safe.length) out.endorsements = safe;
  }

  return Object.keys(out).length ? out : undefined;
}

// ---- helpers --------------------------------------------------------------

async function scanStacks(
  client: GhClient,
  repos: readonly GhRepo[],
): Promise<{ perRepoStack: Array<{ repo: string; stack: StackInference }>; stacks: StackInference[] }> {
  const perRepoStack: Array<{ repo: string; stack: StackInference }> = [];
  const stacks: StackInference[] = [];
  await Promise.all(
    repos.map(async (r) => {
      const owner = r.full_name.split('/')[0];
      const stack = await detectRepoStack(client, owner, r.name);
      perRepoStack.push({ repo: r.name, stack });
      stacks.push(stack);
    }),
  );
  return { perRepoStack, stacks };
}

async function aggregateCommitActivity(
  client: GhClient,
  repos: readonly GhRepo[],
): Promise<{ weeks: CommitActivityWeek[]; source: string } | undefined> {
  if (repos.length === 0) return undefined;
  const results = await Promise.all(
    repos.map(async (r) => {
      const owner = r.full_name.split('/')[0];
      try {
        return { repo: r.full_name, ca: await client.getCommitActivity(owner, r.name) };
      } catch {
        return { repo: r.full_name, ca: undefined };
      }
    }),
  );
  const usable = results.filter((x): x is { repo: string; ca: CommitActivityWeek[] } => !!x.ca && x.ca.length > 0);
  if (usable.length === 0) return undefined;

  // Align on the union of week timestamps. GitHub buckets by Sunday midnight
  // UTC so the timestamps line up across repos already; just sum totals.
  const totalsByWeek = new Map<number, number>();
  for (const { ca } of usable) {
    for (const w of ca) {
      totalsByWeek.set(w.week, (totalsByWeek.get(w.week) ?? 0) + w.total);
    }
  }
  const weeks = Array.from(totalsByWeek.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, total]) => ({ week, total }));
  const source = usable.map((u) => u.repo).join(', ');
  return { weeks, source };
}

async function collectUserCollaborators(
  client: GhClient,
  repos: readonly GhRepo[],
  excludeLogin: string,
): Promise<RelatedProfile[]> {
  if (repos.length === 0) return [];
  const results = await Promise.all(
    repos.map(async (r) => {
      const owner = r.full_name.split('/')[0];
      try {
        const list = await client.getContributors(owner, r.name, RELATED_PROFILE_LIMIT);
        return list.map((c) => ({ ...c, viaRepo: r.name }));
      } catch {
        return [] as Array<GhContributor & { viaRepo: string }>;
      }
    }),
  );

  // Dedupe by login (keep highest-contribution row), drop the user themselves.
  const byLogin = new Map<string, RelatedProfile>();
  const lowerExclude = excludeLogin.toLowerCase();
  for (const list of results) {
    for (const c of list) {
      if (c.login.toLowerCase() === lowerExclude) continue;
      const existing = byLogin.get(c.login);
      if (!existing || c.contributions > existing.contributions) {
        byLogin.set(c.login, {
          login: c.login,
          avatar_url: c.avatar_url,
          contributions: c.contributions,
          viaRepo: c.viaRepo,
        });
      }
    }
  }
  return Array.from(byLogin.values())
    .sort((a, b) => b.contributions - a.contributions)
    .slice(0, RELATED_PROFILE_LIMIT);
}

async function detectRepoStack(
  client: GhClient,
  owner: string,
  repo: string,
): Promise<StackInference> {
  const filesSettled = await Promise.allSettled(
    packageFileCandidates().map((p) => client.getRepoFile(owner, repo, p)),
  );
  const files = filesSettled
    .map((s) => (s.status === 'fulfilled' ? s.value : undefined))
    .filter((f): f is RepoFile => !!f);
  // Scrub before parsing so secret-shaped values can't leak through evidence
  // strings even though the stack module only inspects keys.
  const safe = files.map((f) => ({ ...f, content: scrub(f.content, 'config').text }));
  return detectStack(safe);
}

// ---- external contributions / provenance helpers -------------------------

/**
 * Find merged PRs the user has made against repos they don't own. Uses the
 * GitHub search API (one call per render against the Lambda's authed
 * client). Best-effort; returns `[]` on any API trouble.
 */
async function detectExternalContributions(
  client: GhClient,
  user: string,
): Promise<ExternalContribOrg[]> {
  if (!client.searchMergedPRs) return [];
  const prs = await client.searchMergedPRs(user, 30).catch(() => []);
  if (!prs.length) return [];
  // Group by owner, exclude the user's own org.
  const byOrg = new Map<string, { count: number; repos: Map<string, { name: string; full_name: string; html_url: string; stars?: number }> }>();
  for (const p of prs) {
    if (p.owner.toLowerCase() === user.toLowerCase()) continue;
    if (!byOrg.has(p.owner)) byOrg.set(p.owner, { count: 0, repos: new Map() });
    const e = byOrg.get(p.owner)!;
    e.count += 1;
    if (!e.repos.has(p.repo)) {
      e.repos.set(p.repo, {
        name: p.repo,
        full_name: `${p.owner}/${p.repo}`,
        html_url: `https://github.com/${p.owner}/${p.repo}`,
      });
    }
  }
  return Array.from(byOrg.entries())
    .map(([org, e]) => ({
      org,
      contributions: e.count,
      topRepos: Array.from(e.repos.values()).slice(0, 4),
    }))
    .sort((a, b) => b.contributions - a.contributions)
    .slice(0, 6);
}

/**
 * Derive a small set of trust signals from already-computed data — no extra
 * API calls. Everything here is grounded in observable GitHub state so it's
 * verifiable from the live profile.
 */
function deriveProvenanceBadges(input: {
  repos: readonly GhRepo[];
  timeline: CareerTimeline;
  relatedProfiles?: readonly RelatedProfile[];
  externalContribs?: readonly ExternalContribOrg[];
}): ProvenanceBadge[] {
  const out: ProvenanceBadge[] = [];
  const { repos, timeline, relatedProfiles, externalContribs } = input;

  // Verified active: pushed within last 30 days.
  const recent = repos
    .map((r) => new Date(r.pushed_at ?? r.updated_at).getTime())
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)[0];
  if (recent && Date.now() - recent < 30 * 86_400_000) {
    out.push({
      label: 'Verified active',
      detail: 'Pushed to a public repo within the last 30 days.',
      tone: 'positive',
    });
  }

  // Long arc: ≥5 years between first and latest.
  if (timeline.yearsActive && timeline.yearsActive >= 5) {
    out.push({
      label: `${timeline.yearsActive} yr arc`,
      detail: `Public commits span ${timeline.yearsActive} calendar years.`,
      tone: 'milestone',
    });
  }

  // Maintainer: ≥3 repos with 100+ stars.
  const popularCount = repos.filter((r) => r.stargazers_count >= 100).length;
  if (popularCount >= 3) {
    out.push({
      label: `Maintainer · ${popularCount}× 100+★`,
      detail: `${popularCount} non-fork repos at 100+ stars.`,
      tone: 'positive',
    });
  } else if (repos[0] && repos[0].stargazers_count >= 1000) {
    out.push({
      label: `${repos[0].stargazers_count.toLocaleString()}★ peak`,
      detail: `Top repo "${repos[0].name}" has crossed 1K stars.`,
      tone: 'milestone',
    });
  }

  // Outside contributor: external orgs detected.
  if (externalContribs && externalContribs.length) {
    const topOrg = externalContribs[0];
    out.push({
      label: `External merged PRs`,
      detail: `${externalContribs.length} other org${externalContribs.length === 1 ? '' : 's'} have merged commits — top: ${topOrg.org} (${topOrg.contributions}).`,
      tone: 'positive',
    });
  }

  // Collaborative: works with N+ peers.
  if (relatedProfiles && relatedProfiles.length >= 4) {
    out.push({
      label: `${relatedProfiles.length}+ collaborators`,
      detail: 'Recurring co-contributors across the top repos.',
      tone: 'neutral',
    });
  }

  return out.slice(0, 5);
}

// Re-export for SPA-side typing convenience.
export type { GhRepo };
