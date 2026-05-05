import type { GhClient } from './github.ts';
import { GitHubError } from './github.ts';

// Static, code-controlled emergency opt-out list. Add a target here and ship a
// deploy when someone needs to opt out before they can publish a
// .well-known/devprint-optout file. Format: "owner" or "owner/repo".
export const STATIC_OPTOUT: ReadonlySet<string> = new Set<string>([
  // Example: 'evilcorp', 'evilcorp/private-thing',
]);

export type OptOutTarget =
  | { kind: 'user'; user: string }
  | { kind: 'repo'; user: string; repo: string };

const OPTOUT_PATH = '.well-known/devprint-optout';

export async function isOptedOut(
  client: Pick<GhClient, 'getRepoFile'>,
  target: OptOutTarget,
): Promise<boolean> {
  if (matchesStatic(target)) return true;

  if (target.kind === 'user') {
    // User opt-out lives at github.com/<owner>/<owner>/.well-known/devprint-optout
    return await fileExists(client, target.user, target.user);
  }
  // Repo opt-out lives at the repo itself.
  return await fileExists(client, target.user, target.repo);
}

function matchesStatic(target: OptOutTarget): boolean {
  if (target.kind === 'user') return STATIC_OPTOUT.has(target.user);
  return STATIC_OPTOUT.has(target.user) || STATIC_OPTOUT.has(`${target.user}/${target.repo}`);
}

async function fileExists(
  client: Pick<GhClient, 'getRepoFile'>,
  owner: string,
  repo: string,
): Promise<boolean> {
  try {
    const f = await client.getRepoFile(owner, repo, OPTOUT_PATH);
    return f !== undefined;
  } catch (e) {
    // If the well-known repo doesn't exist (e.g. user has no <user>/<user> repo),
    // they aren't opted out via that channel.
    if (e instanceof GitHubError && e.isNotFound) return false;
    throw e;
  }
}
