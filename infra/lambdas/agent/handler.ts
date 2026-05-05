import {
  GitHubError,
  buildRepoPack,
  buildUserPack,
  isOptedOut,
  parseAgentPath,
  type AgentRoute,
  type GhClient,
  type Pack,
  type PackOptions,
} from '../../../src/analysis/index.ts';
import type { HandlerRequest, HandlerResponse } from '../../shared/types.ts';
import {
  badGateway,
  badRequest,
  markdown,
  notFound,
  notImplemented,
  optedOut,
} from '../../shared/response.ts';

export type HandlerDeps = {
  client: GhClient;
  toolVersion: string;
  now?: () => string;
};

export async function handle(
  req: HandlerRequest,
  deps: HandlerDeps,
): Promise<HandlerResponse> {
  const parsed = parseAgentPath(req.path, req.search);
  if (!parsed.ok) {
    return parsed.reason === 'empty'
      ? badRequest('Provide a target, e.g. /jhammant.md or /jhammant/factcheck.md')
      : badRequest(`Could not parse path: ${req.path}`);
  }
  const route = parsed.route;
  const packOpts: PackOptions = { toolVersion: deps.toolVersion };
  if (deps.now) packOpts.generatedAt = deps.now();

  try {
    switch (route.kind) {
      case 'user': {
        if (await isOptedOut(deps.client, { kind: 'user', user: route.user })) {
          return optedOut(route.user);
        }
        const pack = await buildUserPack(deps.client, route.user, packOpts);
        return withPackHeaders(markdown(pack), pack);
      }
      case 'repo':
      case 'repo-agents': {
        if (await isOptedOut(deps.client, { kind: 'repo', user: route.user, repo: route.repo })) {
          return optedOut(`${route.user}/${route.repo}`);
        }
        const pack = await buildRepoPack(deps.client, route.user, route.repo, packOpts);
        return withPackHeaders(markdown(pack), pack);
      }
      case 'safety':
      case 'receipt':
      case 'vs':
      case 'drift':
        return notImplemented(route.kind);
    }
  } catch (e) {
    if (e instanceof GitHubError) {
      if (e.isNotFound) {
        return notFound(targetFromRoute(route));
      }
      return badGateway(`GitHub upstream error: ${e.message}`);
    }
    return badGateway(e instanceof Error ? e.message : 'unknown error');
  }
}

function withPackHeaders(res: HandlerResponse, pack: Pack): HandlerResponse {
  return {
    ...res,
    headers: {
      ...res.headers,
      'X-Devprint-Redactions': String(pack.redactions),
      'X-Devprint-Target': pack.target,
      'X-Devprint-Kind': pack.kind,
    },
  };
}

function targetFromRoute(r: AgentRoute): string {
  switch (r.kind) {
    case 'user':
      return r.user;
    case 'repo':
    case 'repo-agents':
    case 'safety':
    case 'receipt':
    case 'drift':
      return `${r.user}/${r.repo}`;
    case 'vs':
      return `${r.a} vs ${r.b}`;
  }
}
