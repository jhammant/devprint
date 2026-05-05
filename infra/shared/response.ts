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
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' },
    body: `# Not found\n\nNo public GitHub data found for \`${target}\`.\n`,
  };
}

export function badRequest(reason: string): HandlerResponse {
  return {
    status: 400,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' },
    body: `# Bad request\n\n${reason}\n`,
  };
}

export function optedOut(target: string): HandlerResponse {
  return {
    status: 451,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
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
      'Cache-Control': 'no-store',
      'Retry-After': String(retryAfterSeconds),
    },
    body: `# Rate limited\n\nToo many requests. Try again in ${retryAfterSeconds}s.\n`,
  };
}

export function badGateway(message: string): HandlerResponse {
  return {
    status: 502,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' },
    body: `# Upstream error\n\n${message}\n`,
  };
}

export function notImplemented(feature: string): HandlerResponse {
  return {
    status: 501,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' },
    body: `# Not yet implemented\n\n\`${feature}\` ships in a later wave. See IDEAS.md.\n`,
  };
}
