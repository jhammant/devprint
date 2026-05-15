// Single source of truth for parsing Devprint URLs.
// Used by both the SPA router and the agent Lambda router.

export type AgentRoute =
  | { kind: 'user'; format: 'md'; user: string; task?: string }
  | { kind: 'repo'; format: 'md'; user: string; repo: string; task?: string }
  | { kind: 'repo-agents'; user: string; repo: string }   // /<u>/<r>/AGENTS.md
  | { kind: 'safety'; user: string; repo: string }        // Wave 2
  | { kind: 'receipt'; user: string; repo: string }       // Wave 2
  | { kind: 'vs'; a: string; b: string }                  // Wave 2
  | { kind: 'drift'; user: string; repo: string; sha?: string } // Wave 2
  | { kind: 'user-insights'; user: string }               // JSON sidecar: /<u>.json
  | { kind: 'repo-insights'; user: string; repo: string } // JSON sidecar: /<u>/<r>.json
  | { kind: 'user-resume'; user: string };                // JSON Resume: /<u>.resume.json

export type ParseResult =
  | { ok: true; route: AgentRoute }
  | { ok: false; reason: 'empty' | 'invalid' };

export function parseAgentPath(rawPath: string, search?: string): ParseResult {
  const path = rawPath.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!path) return { ok: false, reason: 'empty' };

  const params = new URLSearchParams(search ?? '');
  const task = params.get('task') ?? undefined;
  const sha = params.get('sha') ?? undefined;

  // /vs/<a>/<b>(.md)?
  const vsMatch = /^vs\/([^/]+)\/([^/]+?)(?:\.md)?$/.exec(path);
  if (vsMatch) return ok({ kind: 'vs', a: vsMatch[1], b: vsMatch[2] });

  // /<u>/<r>/AGENTS.md
  const agentsMatch = /^([^/]+)\/([^/]+)\/AGENTS\.md$/i.exec(path);
  if (agentsMatch) return ok({ kind: 'repo-agents', user: agentsMatch[1], repo: agentsMatch[2] });

  // /<u>/<r>/safety.md
  const safetyMatch = /^([^/]+)\/([^/]+)\/safety\.md$/i.exec(path);
  if (safetyMatch) return ok({ kind: 'safety', user: safetyMatch[1], repo: safetyMatch[2] });

  // /<u>/<r>/receipt.md
  const receiptMatch = /^([^/]+)\/([^/]+)\/receipt\.md$/i.exec(path);
  if (receiptMatch) return ok({ kind: 'receipt', user: receiptMatch[1], repo: receiptMatch[2] });

  // /<u>/<r>/drift
  const driftMatch = /^([^/]+)\/([^/]+)\/drift$/i.exec(path);
  if (driftMatch) return ok({ kind: 'drift', user: driftMatch[1], repo: driftMatch[2], sha });

  // /<u>.resume.json — JSON Resume export (jsonresume.org schema). Matched
  // BEFORE the `<u>.json` rule so the longer suffix wins.
  const resumeMatch = /^([^/]+)\.resume\.json$/.exec(path);
  if (resumeMatch) return ok({ kind: 'user-resume', user: resumeMatch[1] });

  // /<u>/<r>.json — structured JSON sidecar (must come BEFORE the .md match
  // so `.json` is not parsed as a repo named "<r>.json" → ".md" suffix).
  const repoJsonMatch = /^([^/]+)\/([^/]+)\.json$/.exec(path);
  if (repoJsonMatch) return ok({ kind: 'repo-insights', user: repoJsonMatch[1], repo: repoJsonMatch[2] });

  // /<u>.json
  const userJsonMatch = /^([^/]+)\.json$/.exec(path);
  if (userJsonMatch) return ok({ kind: 'user-insights', user: userJsonMatch[1] });

  // /<u>/<r>.md  (must come BEFORE the /<u>.md match)
  const repoMatch = /^([^/]+)\/([^/]+)\.md$/.exec(path);
  if (repoMatch) return ok({ kind: 'repo', format: 'md', user: repoMatch[1], repo: repoMatch[2], task });

  // /<u>.md
  const userMatch = /^([^/]+)\.md$/.exec(path);
  if (userMatch) return ok({ kind: 'user', format: 'md', user: userMatch[1], task });

  // Extension-less fallbacks — agents.devprint.dev/<u>/<r> and /<u> should
  // serve the markdown pack, matching the URLs the README advertises.
  // These come LAST so all suffixed forms (.md/.json/AGENTS.md/safety.md/
  // receipt.md/drift) win first.
  const bareRepoMatch = /^([^/]+)\/([^/]+)$/.exec(path);
  if (bareRepoMatch) return ok({ kind: 'repo', format: 'md', user: bareRepoMatch[1], repo: bareRepoMatch[2], task });

  const bareUserMatch = /^([^/]+)$/.exec(path);
  if (bareUserMatch) return ok({ kind: 'user', format: 'md', user: bareUserMatch[1], task });

  return { ok: false, reason: 'invalid' };
}

export function parseAgentUrl(url: string | URL): ParseResult {
  const u = typeof url === 'string' ? new URL(url) : url;
  return parseAgentPath(u.pathname, u.search);
}

function ok(route: AgentRoute): ParseResult {
  return { ok: true, route };
}

// SPA-side target parser (used by both the SPA and as a normaliser).
export function cleanTarget(v: string): string {
  return (v || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/^github\.com\//, '')
    .replace(/^@/, '')
    .split(/[?#]/)[0]
    .replace(/^\/+|\/+$/g, '');
}
