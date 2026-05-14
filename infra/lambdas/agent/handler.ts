import {
  GitHubError,
  applyTaskOverlay,
  buildJsonResume,
  buildReceiptPack,
  buildRepoInsights,
  buildRepoPack,
  buildSafetyPack,
  buildUserInsights,
  buildUserPack,
  checkDrift,
  isKnownTask,
  isOptedOut,
  parseAgentPath,
  type AgentRoute,
  type GhClient,
  type Insights,
  type Pack,
  type PackOptions,
} from '../../../src/analysis/index.ts';
import type { HandlerRequest, HandlerResponse } from '../../shared/types.ts';
import {
  agentInstructions,
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
    if (parsed.reason === 'empty') {
      // No target → return the agent-readable user manual instead of a 400.
      // Crawlers, agents probing the root, and curious humans all land here.
      return agentInstructions();
    }
    return badRequest(`Could not parse path: ${req.path}`);
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
        let pack = await buildUserPack(deps.client, route.user, packOpts);
        if (route.task && isKnownTask(route.task)) pack = applyTaskOverlay(pack, route.task);
        return withPackHeaders(markdown(pack), pack);
      }
      case 'repo':
      case 'repo-agents': {
        if (await isOptedOut(deps.client, { kind: 'repo', user: route.user, repo: route.repo })) {
          return optedOut(`${route.user}/${route.repo}`);
        }
        let pack = await buildRepoPack(deps.client, route.user, route.repo, packOpts);
        if (route.kind === 'repo' && route.task && isKnownTask(route.task)) {
          pack = applyTaskOverlay(pack, route.task);
        }
        return withPackHeaders(markdown(pack), pack);
      }
      case 'safety': {
        if (await isOptedOut(deps.client, { kind: 'repo', user: route.user, repo: route.repo })) {
          return optedOut(`${route.user}/${route.repo}`);
        }
        const pack = await buildSafetyPack(deps.client, route.user, route.repo, packOpts);
        return withPackHeaders(markdown(pack), pack);
      }
      case 'receipt': {
        if (await isOptedOut(deps.client, { kind: 'repo', user: route.user, repo: route.repo })) {
          return optedOut(`${route.user}/${route.repo}`);
        }
        const pack = await buildReceiptPack(deps.client, route.user, route.repo, packOpts);
        return withPackHeaders(markdown(pack), pack);
      }
      case 'drift': {
        const sha = route.sha;
        if (!sha) return badRequest('Missing ?sha=<commit-sha> query parameter');
        const report = await checkDrift(deps.client, route.user, route.repo, sha);
        return {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          },
          body: JSON.stringify(report, null, 2),
        };
      }
      case 'user-insights': {
        if (await isOptedOut(deps.client, { kind: 'user', user: route.user })) {
          return optedOut(route.user);
        }
        const insights = await buildUserInsights(deps.client, route.user, {
          ...(deps.now ? { generatedAt: deps.now() } : {}),
        });
        return jsonInsights(insights);
      }
      case 'repo-insights': {
        if (await isOptedOut(deps.client, { kind: 'repo', user: route.user, repo: route.repo })) {
          return optedOut(`${route.user}/${route.repo}`);
        }
        const insights = await buildRepoInsights(deps.client, route.user, route.repo, {
          ...(deps.now ? { generatedAt: deps.now() } : {}),
        });
        return jsonInsights(insights);
      }
      case 'user-resume': {
        if (await isOptedOut(deps.client, { kind: 'user', user: route.user })) {
          return optedOut(route.user);
        }
        const [profile, repos, insights] = await Promise.all([
          deps.client.getUser(route.user),
          deps.client.listUserRepos(route.user, { max: 100 }),
          buildUserInsights(deps.client, route.user, {
            ...(deps.now ? { generatedAt: deps.now() } : {}),
          }),
        ]);
        const resume = buildJsonResume({
          profile,
          repos,
          insights,
          url: `https://devprint.dev/${route.user}`,
        });
        return {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
            'Content-Disposition': `inline; filename="${route.user}.resume.json"`,
            'X-Devprint-Target': route.user,
            'X-Devprint-Kind': 'user-resume',
          },
          body: JSON.stringify(resume, null, 2),
        };
      }
      case 'vs':
        return notImplemented('vs');
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

function jsonInsights(insights: Insights): HandlerResponse {
  return {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      // Same cache window as markdown packs — both are derived from the same
      // GitHub state, so they should expire together.
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      'X-Devprint-Target': insights.target,
      'X-Devprint-Kind': insights.kind,
    },
    body: JSON.stringify(insights),
  };
}

function targetFromRoute(r: AgentRoute): string {
  switch (r.kind) {
    case 'user':
    case 'user-insights':
    case 'user-resume':
      return r.user;
    case 'repo':
    case 'repo-agents':
    case 'safety':
    case 'receipt':
    case 'drift':
    case 'repo-insights':
      return `${r.user}/${r.repo}`;
    case 'vs':
      return `${r.a} vs ${r.b}`;
  }
}
