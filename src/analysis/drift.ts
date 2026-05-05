import type { GhClient } from './github.ts';
import { GitHubError } from './github.ts';

export type DriftReport = {
  target: string;
  packSha: string;
  currentSha: string | undefined;
  drifted: boolean;
  behindBy?: number;
};

// Compare a pack's source SHA against the current head SHA. Returns
// drifted=true if they differ. behindBy is the commit count between them when
// computable (one comparison call), undefined otherwise.
export async function checkDrift(
  client: GhClient,
  owner: string,
  repo: string,
  packSha: string,
): Promise<DriftReport> {
  const target = `${owner}/${repo}`;
  let currentSha: string | undefined;
  try {
    currentSha = await client.getRepoHeadSha(owner, repo);
  } catch (e) {
    if (e instanceof GitHubError && e.isNotFound) {
      return { target, packSha, currentSha: undefined, drifted: true };
    }
    throw e;
  }

  if (!currentSha) return { target, packSha, currentSha: undefined, drifted: true };

  const drifted = currentSha !== packSha;
  return { target, packSha, currentSha, drifted };
}
