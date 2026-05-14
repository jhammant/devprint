import type { HandlerResponse } from './types.ts';
import {
  provenanceHeaders,
  type Pack,
} from '../../src/analysis/index.ts';

const MD_CACHE = 'public, max-age=300, stale-while-revalidate=600';

export function markdown(pack: Pack, extra: Record<string, string> = {}): HandlerResponse {
  return {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': MD_CACHE,
      ...provenanceHeaders(pack.provenance),
      ...extra,
    },
    body: pack.markdown,
  };
}

export function notFound(target: string): HandlerResponse {
  return {
    status: 404,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    body: `# Not found\n\nNo public GitHub data found for \`${target}\`.\n`,
  };
}

export function badRequest(reason: string): HandlerResponse {
  return {
    status: 400,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    body: `# Bad request\n\n${reason}\n`,
  };
}

export function optedOut(target: string): HandlerResponse {
  return {
    status: 451,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'X-Devprint-OptOut': 'true',
    },
    body:
      `# Devprint pack unavailable\n\n` +
      `The owner of \`${target}\` has opted out of Devprint analysis. No data has been generated.\n\n` +
      `To opt back in, remove \`.well-known/devprint-optout\` from the relevant repo.\n`,
  };
}

export function rateLimited(retryAfterSeconds: number): HandlerResponse {
  return {
    status: 429,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Retry-After': String(retryAfterSeconds),
    },
    body: `# Rate limited\n\nToo many requests. Try again in ${retryAfterSeconds}s.\n`,
  };
}

export function badGateway(message: string): HandlerResponse {
  return {
    status: 502,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    body: `# Upstream error\n\n${message}\n`,
  };
}

export function notImplemented(feature: string): HandlerResponse {
  return {
    status: 501,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    body: `# Not yet implemented\n\n\`${feature}\` ships in a later wave. See IDEAS.md.\n`,
  };
}

/**
 * Friendly default response for `https://agents.devprint.dev/` (no path).
 *
 * Returns 200 + a markdown user manual aimed at LLM coding agents:
 * what the endpoint is, what shape each route returns, and a
 * copy-pasteable example for the most useful call. Crawlers and humans
 * landing on the bare host get the same doc.
 */
export function agentInstructions(): HandlerResponse {
  const body = [
    '# Devprint agent endpoint',
    '',
    'You are looking at `https://agents.devprint.dev/` — a read-only API that turns any public GitHub user or repo into a compact, agent-friendly markdown brief.',
    '',
    'Pass a target as the path. Every route returns `text/markdown; charset=utf-8` (except where noted) with cache-friendly headers. No auth required. No POST, only GET.',
    '',
    '## Quick start',
    '',
    'For a user fingerprint:',
    '',
    '```',
    'GET https://agents.devprint.dev/jhammant',
    '```',
    '',
    'For a repo brief (this is the most useful call for an agent picking up an unfamiliar codebase):',
    '',
    '```',
    'GET https://agents.devprint.dev/jhammant/devprint',
    '```',
    '',
    '## All routes',
    '',
    '| Path | What you get |',
    '|---|---|',
    '| `/:user` | User pack — languages, recent activity, signature repos, build style |',
    '| `/:user/:repo` | Repo pack — README summary, stack, hot files, CI hints |',
    '| `/:user/:repo/agents` | Repo pack pre-shaped for agent consumption (same data, different framing) |',
    '| `/:user/:repo/safety` | Safety + provenance for the repo (license, last-touched, contributor count) |',
    '| `/:user/:repo/receipt` | Career-receipt pack — who did what, when, how often |',
    '| `/:user/:repo/drift?sha=<commit>` | JSON: how far the repo has moved since `<commit>` |',
    '| `/:user/insights.json` | User-level structured JSON insights |',
    '| `/:user/:repo/insights.json` | Repo-level structured JSON insights |',
    '| `/:user/resume.json` | JSON Resume schema derived from public activity |',
    '',
    'Task overlays (focused framing for the same data) — append `?task=<name>` on user or repo routes:',
    '`hire`, `pair`, `audit`, `port`, `learn`.',
    '',
    '## Headers worth knowing',
    '',
    '- `X-Devprint-Target` — the canonical target the response describes',
    '- `X-Devprint-Kind` — pack kind (`user` / `repo` / `safety` / `receipt` / etc.)',
    '- `X-Devprint-Redactions` — count of fields scrubbed for privacy',
    '- `Cache-Control: public, max-age=300, stale-while-revalidate=600`',
    '',
    '## Opt-out',
    '',
    'Owners can opt out by committing `.well-known/devprint-optout` to any repo they own; the endpoint then returns `451`.',
    '',
    '## More',
    '',
    'Web UI + source: https://devprint.dev/  ·  https://github.com/jhammant/devprint',
    '',
  ].join('\n');
  return {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
      'X-Devprint-Kind': 'instructions',
    },
    body,
  };
}
