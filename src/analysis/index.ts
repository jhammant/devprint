export type {
  GhUser,
  GhRepo,
  GhContributor,
  RepoFile,
  Confidence,
  Evidence,
  Claim,
  Provenance,
  Pack,
  BattleStats,
  Themes,
  FingerprintModel,
} from './types.ts';

export {
  GitHubError,
  createGitHubClient,
  packageFileCandidates,
} from './github.ts';
export type { GhClient, GhClientOptions, FetchImpl } from './github.ts';

export { scrub, summariseRedactions } from './scrub.ts';
export type { ScrubKind, ScrubResult, Redaction } from './scrub.ts';

export {
  buildProvenance,
  provenanceFooter,
  provenanceHeaders,
} from './provenance.ts';

export {
  claim,
  highClaim,
  mediumClaim,
  lowClaim,
  formatClaim,
  confidencePercent,
} from './confidence.ts';

export {
  archetype,
  battleStats,
  getThemes,
  scoreRepo,
  statValue,
  summariseThemes,
  BATTLE_FORMULAS,
} from './infer.ts';

export { buildUserPack, buildRepoPack } from './pack.ts';
export type { PackOptions } from './pack.ts';

export {
  detectStack,
  mergeStacks,
  rankDetected,
  summariseStack,
} from './stack.ts';
export type { DetectedTech, StackInference, TechCategory } from './stack.ts';

export {
  fetchRecentCommits,
  inferCommitStyle,
} from './commits.ts';
export type { Commit, CommitStyleSignal, CommitStyleVerdict } from './commits.ts';

export { buildUserInsights, buildRepoInsights } from './insights.ts';
export type {
  Insights,
  CommitActivityWeek,
  RelatedProfile,
  BuildInsightsOptions,
} from './insights.ts';

export { isOptedOut, STATIC_OPTOUT } from './optout.ts';
export type { OptOutTarget } from './optout.ts';

export {
  parseAgentPath,
  parseAgentUrl,
  cleanTarget,
} from './router.ts';
export type { AgentRoute, ParseResult } from './router.ts';

export { buildSafetyPack, buildSafetyReport } from './safety.ts';
export type { SafetyTier, SafetyFlag, SafetyReport, SafetyOptions } from './safety.ts';

export { buildReceipt, buildReceiptPack } from './receipt.ts';
export type { StackReceipt, StackItem, ReceiptOptions } from './receipt.ts';

export { applyTaskOverlay, isKnownTask } from './tasks.ts';
export type { TaskName } from './tasks.ts';

export { checkDrift } from './drift.ts';
export type { DriftReport } from './drift.ts';

export {
  buildBadgeData,
  buildUserBadgeData,
  renderBadgeSvg,
} from './badge.ts';
export type { BadgeData, BadgeOptions } from './badge.ts';
