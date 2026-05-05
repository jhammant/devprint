export type {
  GhUser,
  GhRepo,
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
} from './infer.ts';

export { buildUserPack, buildRepoPack } from './pack.ts';
export type { PackOptions } from './pack.ts';

export { isOptedOut, STATIC_OPTOUT } from './optout.ts';
export type { OptOutTarget } from './optout.ts';

export {
  parseAgentPath,
  parseAgentUrl,
  cleanTarget,
} from './router.ts';
export type { AgentRoute, ParseResult } from './router.ts';
