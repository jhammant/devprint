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
};

export type CommitStyleVerdict = {
  signals: CommitStyleSignal;
  bullets: string[];   // human-readable lines for agent pack
  primary: string;     // single-sentence verdict
  samples: string[];   // 0–3 representative subjects (no merges)
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
