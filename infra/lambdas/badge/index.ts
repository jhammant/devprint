// Badge Lambda — returns image/svg+xml for `devprint.dev/<user>.svg` and
// `devprint.dev/<user>/<repo>.svg`. Path comes from CloudFront route forwarding.

import {
  GitHubError,
  buildBadgeData,
  buildUserBadgeData,
  createGitHubClient,
  renderBadgeSvg,
} from '../../../src/analysis/index.ts';

const client = createGitHubClient({
  token: process.env.GITHUB_TOKEN,
  userAgent: 'Devprint-Badge-Lambda/0.1',
});

type Event = {
  rawPath: string;
  rawQueryString: string;
  headers: Record<string, string | undefined>;
  requestContext: { http: { method: string; sourceIp: string } };
};

type Response = { statusCode: number; headers: Record<string, string>; body: string };

const SVG_CACHE = 'public, max-age=3600, stale-while-revalidate=86400';

export async function handler(event: Event): Promise<Response> {
  const start = Date.now();
  const path = event.rawPath.replace(/^\/+/, '').replace(/\/+$/, '');

  // Match /<user>.svg or /<user>/<repo>.svg
  const repoMatch = /^([^/]+)\/([^/]+)\.svg$/.exec(path);
  const userMatch = /^([^/]+)\.svg$/.exec(path);

  let body: string;
  let target: string;
  try {
    if (repoMatch) {
      target = `${repoMatch[1]}/${repoMatch[2]}`;
      const data = await buildBadgeData(client, repoMatch[1], repoMatch[2]);
      body = renderBadgeSvg(data);
    } else if (userMatch) {
      target = userMatch[1];
      const data = await buildUserBadgeData(client, userMatch[1]);
      body = renderBadgeSvg(data);
    } else {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Bad path; expected /<user>.svg or /<user>/<repo>.svg',
      };
    }
  } catch (e) {
    if (e instanceof GitHubError && e.isNotFound) {
      return { statusCode: 404, headers: { 'Content-Type': 'text/plain' }, body: 'Not found' };
    }
    return { statusCode: 502, headers: { 'Content-Type': 'text/plain' }, body: 'Upstream error' };
  }

  const res: Response = {
    statusCode: 200,
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': SVG_CACHE },
    body,
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    msg: 'badge.request',
    path: event.rawPath,
    target,
    status: res.statusCode,
    ms: Date.now() - start,
  }));
  return res;
}
