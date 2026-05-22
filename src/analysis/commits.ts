// Commit-style inference. Given a repo's recent commits, surface signals an
// AI agent should match: Conventional Commits compliance, average message
// length, frequency of squash-merge PR titles, etc.
//
// Network-bearing helper (fetchRecentCommits) is separate from the pure
// inference function (inferCommitStyle) so it's easy to unit-test the analyser
// in isolation.

import type { GhClient } from './github.ts';

export type Commit = {
  sha: string;
  message: string;
  author?: string;
  date: string;
};

export type CommitStyleSignal = {
  conventional: number; // ratio 0..1 of commits matching feat:/fix:/etc.
  squashMerge: number;  // ratio of "(#1234)" trailers, signals PR squash workflow
  avgLength: number;    // characters in subject line
  avgWords: number;     // words in subject line
  shortSubjects: number; // ratio of subjects < 40 chars
  imperative: number;   // ratio starting with imperative verb (Add/Fix/Update/...)
  signedOff: number;    // ratio with "Signed-off-by:" trailer
  sample: number;       // number of commits analysed
  trivialRatio?: number;      // ratio 0..1 of non-merge commits classified trivial
  substantialRatio?: number;  // ratio 0..1 classified substantial
  diffSampled?: number;       // how many sampled commits had real diff stats
  medianChurn?: number;       // median (additions+deletions) over diff-sampled commits
};

export type CommitStyleVerdict = {
  signals: CommitStyleSignal;
  bullets: string[];   // human-readable lines for agent pack
  primary: string;     // single-sentence verdict
  samples: string[];   // 0–3 representative subjects (no merges)
};

/** Per-commit diff stats — only the single-commit API endpoint carries these. */
export type CommitDiffStat = {
  sha: string;
  additions: number;
  deletions: number;
  changedFiles: number;
};

/**
 * Spam-commit / substance verdict for the recruiter view. Answers "are these
 * substantial changes or trivial edits?" without exposing a gameable number.
 */
export type CommitSubstance = {
  verdict: 'substantial' | 'mixed' | 'mostly-trivial' | 'insufficient-data';
  summary: string;       // one-sentence recruiter-readable verdict
  detail: string[];      // 1–3 supporting bullets
  basis: 'diff-sampled' | 'message-only';
  sample: number;        // non-merge commits the verdict is based on
  diffSampled: number;   // of those, how many had backing diff stats
};

/** AI-coding-tool trailers detected in a set of commit messages. */
export type AiTrailerHit = {
  tools: string[];   // distinct tool names, e.g. ['Claude Code', 'Copilot']
  hits: number;      // number of commits carrying at least one trailer
};

const CONVENTIONAL_RE = /^(feat|fix|docs|chore|refactor|test|style|perf|build|ci|revert)(\([^)]+\))?!?:\s+/;
const SQUASH_TRAILER_RE = /\(#\d+\)\s*$/m;
const IMPERATIVE_VERBS = new Set([
  'add', 'fix', 'update', 'remove', 'rename', 'refactor', 'clean', 'replace',
  'introduce', 'support', 'allow', 'enable', 'disable', 'use', 'make',
  'move', 'extract', 'inline', 'split', 'merge', 'wire', 'plumb', 'set',
  'drop', 'bump', 'pin', 'lock', 'silence', 'log', 'guard', 'normalise',
  'normalize', 'tidy', 'stop', 'start', 'expose', 'hide', 'avoid', 'prevent',
  'handle', 'fall', 'redirect', 'warn',
]);

/** Hard caps on per-commit diff-stat sampling — bounds Lambda latency + API cost. */
export const DIFF_SAMPLE_PER_REPO = 8;
export const DIFF_SAMPLE_MAX_REPOS = 3;

const MERGE_RE = /^Merge\s/i;
const TRIVIAL_SUBJECT_RE =
  /^(wip|tmp|temp|fix|fixes|fixed|update|updates|updated|changes|change|misc|stuff|\.|\.\.\.|test|tests|asdf|minor|edit|edits|tweak|tweaks|cleanup|oops|typo|format|formatting)\s*$/i;

/** AI-coding-tool trailers / co-author lines, keyed by display name. */
const AI_TRAILER_PATTERNS: ReadonlyArray<{ tool: string; re: RegExp }> = [
  { tool: 'Claude Code', re: /co-?authored-by:\s*claude/i },
  { tool: 'Claude Code', re: /generated with \[?claude code/i },
  { tool: 'GitHub Copilot', re: /co-?authored-by:\s*copilot/i },
  { tool: 'Cursor', re: /co-?authored-by:\s*cursor/i },
  { tool: 'aider', re: /co-?authored-by:\s*aider/i },
  { tool: 'Devin', re: /co-?authored-by:\s*devin/i },
  { tool: 'Gemini', re: /co-?authored-by:\s*gemini/i },
];

export async function fetchRecentCommits(
  client: GhClient,
  owner: string,
  repo: string,
  branch: string | undefined,
  count = 30,
): Promise<Commit[]> {
  return client.getRecentCommits(owner, repo, branch, count);
}

export function inferCommitStyle(commits: readonly Commit[]): CommitStyleVerdict {
  const sample = commits.length;
  if (sample === 0) {
    return {
      signals: emptySignals(0),
      bullets: [],
      primary: '',
      samples: [],
    };
  }

  const subjects = commits.map((c) => firstLine(c.message));
  let conv = 0;
  let squash = 0;
  let totalLen = 0;
  let totalWords = 0;
  let shortCount = 0;
  let imperative = 0;
  let signedOff = 0;

  for (const c of commits) {
    const subject = firstLine(c.message);
    if (CONVENTIONAL_RE.test(subject)) conv++;
    if (SQUASH_TRAILER_RE.test(subject)) squash++;
    if (subject.length < 40) shortCount++;
    totalLen += subject.length;
    const words = subject.split(/\s+/).filter(Boolean);
    totalWords += words.length;
    const first = (words[0] || '').toLowerCase().replace(/[^a-z]/g, '');
    if (IMPERATIVE_VERBS.has(first)) imperative++;
    if (/Signed-off-by:/i.test(c.message)) signedOff++;
  }

  const ratio = (n: number) => n / sample;
  const signals: CommitStyleSignal = {
    conventional: ratio(conv),
    squashMerge: ratio(squash),
    avgLength: Math.round(totalLen / sample),
    avgWords: Math.round((totalWords / sample) * 10) / 10,
    shortSubjects: ratio(shortCount),
    imperative: ratio(imperative),
    signedOff: ratio(signedOff),
    sample,
  };

  const bullets: string[] = [];
  if (signals.conventional >= 0.6) {
    bullets.push(`Uses **Conventional Commits** (${pct(signals.conventional)} of recent commits start with \`feat:\`, \`fix:\`, etc.). Match this style.`);
  } else if (signals.conventional >= 0.2) {
    bullets.push(`Mixed commit style — ${pct(signals.conventional)} use Conventional Commits prefixes, the rest are freeform.`);
  } else {
    bullets.push(`Freeform subject lines — Conventional Commits **not** in use here. Avoid \`feat:\`/\`fix:\` prefixes.`);
  }

  if (signals.squashMerge >= 0.4) {
    bullets.push(`Uses GitHub squash-merge workflow (${pct(signals.squashMerge)} of subjects end with \`(#NNN)\`). Most history sits on PR titles.`);
  }

  if (signals.imperative >= 0.6) {
    bullets.push(`Subjects are imperative ("Add X", "Fix Y") — keep that voice.`);
  }

  bullets.push(
    `Average subject ≈ ${signals.avgWords} words / ${signals.avgLength} chars` +
      (signals.shortSubjects >= 0.6 ? ' — short, punchy.' : signals.shortSubjects >= 0.3 ? ' — mostly short.' : ' — verbose subjects are common.'),
  );

  if (signals.signedOff >= 0.4) {
    bullets.push(`Frequent \`Signed-off-by:\` trailer — DCO sign-off appears expected.`);
  }

  let primary = '';
  if (signals.conventional >= 0.6) {
    primary = `Conventional Commits, ${signals.avgWords}-word subjects on average.`;
  } else if (signals.imperative >= 0.6) {
    primary = `Freeform imperative subjects (${signals.avgWords} words avg).`;
  } else if (signals.squashMerge >= 0.4) {
    primary = `Squash-merge style (\`(#NNN)\` trailers), freeform subjects.`;
  } else {
    primary = `Freeform commit style, ${signals.avgWords}-word subjects on average.`;
  }

  // Sample of representative subjects (deduplicated, max 3, no merges).
  const samples = subjects
    .filter((s) => !/^Merge\s/i.test(s))
    .slice(0, 3);
  return { signals, bullets, primary, samples };
}

/**
 * Fetch per-commit diff stats for up to `cap` non-merge commits. Returns an
 * empty map when the client can't fetch detail (unauthenticated / test fake) —
 * callers then run a message-only analysis. A single failing commit is dropped,
 * not fatal.
 */
export async function fetchCommitDiffs(
  client: GhClient,
  owner: string,
  repo: string,
  commits: readonly Commit[],
  cap: number = DIFF_SAMPLE_PER_REPO,
): Promise<Map<string, CommitDiffStat>> {
  const out = new Map<string, CommitDiffStat>();
  const getDetail = client.getCommitDetail;
  if (!getDetail) return out;
  const sample = commits.filter((c) => !isMerge(c)).slice(0, Math.max(cap, 0));
  const results = await Promise.all(
    sample.map((c) => getDetail(owner, repo, c.sha).catch(() => undefined)),
  );
  for (const r of results) {
    if (r) {
      out.set(r.sha, {
        sha: r.sha,
        additions: r.additions,
        deletions: r.deletions,
        changedFiles: r.changedFiles,
      });
    }
  }
  return out;
}

/**
 * Classify recent commits as substantial vs trivial — the "spam commit" signal.
 * Pure: pass commits plus a sha→diff map (empty map ⇒ message-only analysis).
 * Merge commits are excluded from the denominator (not authored work).
 */
export function inferCommitSubstance(
  commits: readonly Commit[],
  diffs: ReadonlyMap<string, CommitDiffStat>,
): CommitSubstance {
  const nonMerge = commits.filter((c) => !isMerge(c));
  const sample = nonMerge.length;
  const churns: number[] = [];
  let trivial = 0;
  let substantial = 0;
  let diffSampled = 0;

  for (const c of nonMerge) {
    const subject = firstLine(c.message);
    const diff = diffs.get(c.sha);
    if (diff) {
      diffSampled++;
      const churn = diff.additions + diff.deletions;
      churns.push(churn);
      if (churn <= 2 && diff.changedFiles <= 1) trivial++;
      else if (churn >= 30) substantial++;
    } else {
      if (isTrivialSubject(subject)) trivial++;
      else if (isSubstantialSubject(subject)) substantial++;
    }
  }

  const basis: CommitSubstance['basis'] = diffSampled > 0 ? 'diff-sampled' : 'message-only';

  if (sample < 5) {
    return {
      verdict: 'insufficient-data',
      summary: 'Not enough recent commit history to assess.',
      detail: [],
      basis,
      sample,
      diffSampled,
    };
  }

  const trivialRatio = trivial / sample;
  const substantialRatio = substantial / sample;
  const verdict: CommitSubstance['verdict'] =
    trivialRatio >= 0.5 ? 'mostly-trivial' : trivialRatio >= 0.25 ? 'mixed' : 'substantial';

  const detail: string[] = [];
  if (basis === 'diff-sampled') {
    detail.push(`${diffSampled} of ${sample} recent commits checked against real diffs.`);
    if (substantial > 0) detail.push(`${substantial} changed 30+ lines.`);
    if (trivial > 0) detail.push(`${trivial} changed 2 lines or fewer.`);
    const median = medianOf(churns);
    if (median !== undefined) detail.push(`Median change ≈ ${median} lines.`);
  } else {
    detail.push(`Based on ${sample} recent commit messages (diff stats unavailable).`);
  }

  let summary: string;
  if (verdict === 'substantial') {
    summary =
      basis === 'diff-sampled'
        ? `Recent commits look substantial — ${substantial} of ${sample} sampled changed 30+ lines.`
        : 'Recent commit subjects look descriptive and substantial.';
  } else if (verdict === 'mixed') {
    summary = 'Recent commits are mixed — a meaningful share are trivial edits.';
  } else {
    summary =
      basis === 'diff-sampled'
        ? `Many recent commits are trivial — ${trivial} of ${sample} sampled changed 2 lines or fewer.`
        : 'Many recent commit subjects look like quick, low-effort edits.';
  }

  return { verdict, summary, detail, basis, sample, diffSampled };
}

/** Scan commit messages for AI-coding-tool co-author / generation trailers. */
export function detectAiTrailers(messages: readonly string[]): AiTrailerHit {
  const tools = new Set<string>();
  let hits = 0;
  for (const msg of messages) {
    let hit = false;
    for (const { tool, re } of AI_TRAILER_PATTERNS) {
      if (re.test(msg)) {
        tools.add(tool);
        hit = true;
      }
    }
    if (hit) hits++;
  }
  return { tools: Array.from(tools), hits };
}

function isMerge(c: Commit): boolean {
  return MERGE_RE.test(firstLine(c.message));
}

function isTrivialSubject(subject: string): boolean {
  if (TRIVIAL_SUBJECT_RE.test(subject)) return true;
  if (subject.length < 6) return true;
  const words = subject.split(/\s+/).filter((w) => /[a-z]{3,}/i.test(w));
  return words.length === 0;
}

function isSubstantialSubject(subject: string): boolean {
  const words = subject.split(/\s+/).filter(Boolean);
  if (words.length < 4) return false;
  const first = (words[0] || '').toLowerCase().replace(/[^a-z]/g, '');
  return IMPERATIVE_VERBS.has(first);
}

function medianOf(nums: readonly number[]): number | undefined {
  if (nums.length === 0) return undefined;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function firstLine(s: string): string {
  const idx = s.indexOf('\n');
  return (idx >= 0 ? s.slice(0, idx) : s).trim();
}

function emptySignals(sample: number): CommitStyleSignal {
  return {
    conventional: 0,
    squashMerge: 0,
    avgLength: 0,
    avgWords: 0,
    shortSubjects: 0,
    imperative: 0,
    signedOff: 0,
    sample,
  };
}

function pct(r: number): string {
  return `${Math.round(r * 100)}%`;
}
