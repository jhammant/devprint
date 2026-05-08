// Public GitHub API shapes (only the fields Devprint reads).

export type GhUser = {
  login: string;
  name: string | null;
  avatar_url: string;
  public_repos: number;
  followers: number;
};

export type GhRepo = {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  fork: boolean;
  updated_at: string;
  // pushed_at = last commit on the default branch. updated_at = any metadata
  // change (description edit, star count tick, transfer, etc.). For "is this
  // repo actually maintained?" charts the pushed_at axis is much cleaner.
  pushed_at?: string;
  default_branch?: string;
  topics?: string[];
  license?: { spdx_id: string | null; name: string } | null;
};

export type GhContributor = {
  login: string;
  avatar_url: string;
  contributions: number;
};

export type RepoFile = { path: string; content: string };

// Devprint domain types.

export type Confidence = 'high' | 'medium' | 'low';

export type Evidence =
  | { kind: 'field'; ref: string }     // a JSON field, e.g. "repo.language"
  | { kind: 'file'; ref: string }      // a path in the source repo
  | { kind: 'derived'; ref: string };  // a derivation, e.g. "topLangs[0]"

export type Claim<T> = {
  value: T;
  confidence: Confidence;
  evidence: Evidence[];
};

export type Provenance = {
  generatedAt: string;       // ISO 8601
  contentHash: string;       // sha-256 over body sans footer
  sourceSha?: string;        // repo head SHA at fetch time, for repo packs
  toolVersion: string;
};

export type Pack = {
  target: string;
  kind: 'user' | 'repo';
  markdown: string;          // includes provenance footer
  provenance: Provenance;
  redactions: number;        // count, not contents
};

export type BattleStats = {
  build: Claim<number>;
  impact: Claim<number>;
  versatility: Claim<number>;
  momentum: Claim<number>;
  community: Claim<number>;
  originality: Claim<number>;
  tier: 'Emerging' | 'Rare' | 'Epic' | 'Legendary';
};

export type Themes = ReadonlyArray<readonly [string, number]>;

export type FingerprintModel = {
  target: string;
  isRepo: boolean;
  profile: GhUser;
  repo?: GhRepo;
  repos: GhRepo[];
  langs: Record<string, number>;
  themes: Themes;
  archetype: string;
  totalStars: number;
  battle: BattleStats;
};
