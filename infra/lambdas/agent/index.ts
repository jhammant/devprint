// AWS Lambda Function URL adapter. Translates the Lambda event/response shape
// to the transport-agnostic HandlerRequest/Response that handler.ts speaks.

import { createGitHubClient } from '../../../src/analysis/index.ts';
import type { HandlerRequest } from '../../shared/types.ts';
import { handle } from './handler.ts';

const TOOL_VERSION = process.env.DEVPRINT_TOOL_VERSION ?? '0.1.0';

// Lambda Function URL event shape (subset we use). Avoid pulling in
// @types/aws-lambda for now; this is the documented shape.
type LambdaFunctionURLEvent = {
  rawPath: string;
  rawQueryString: string;
  headers: Record<string, string | undefined>;
  requestContext: {
    http: { method: string; sourceIp: string };
  };
};

type LambdaFunctionURLResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

const client = createGitHubClient({
  token: process.env.GITHUB_TOKEN,
  userAgent: 'Devprint-Agent-Lambda/0.1',
});

export async function handler(
  event: LambdaFunctionURLEvent,
): Promise<LambdaFunctionURLResponse> {
  const start = Date.now();
  const req: HandlerRequest = {
    method: event.requestContext.http.method,
    path: event.rawPath || '/',
    search: event.rawQueryString ? `?${event.rawQueryString}` : '',
    headers: event.headers,
    ip: event.requestContext.http.sourceIp,
  };

  const res = await handle(req, { client, toolVersion: TOOL_VERSION });

  // Single structured log line per request — readable in CloudWatch.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    msg: 'agent.request',
    method: req.method,
    path: req.path,
    status: res.status,
    ms: Date.now() - start,
    redactions: res.headers['X-Devprint-Redactions'] ?? '0',
    target: res.headers['X-Devprint-Target'] ?? '',
    kind: res.headers['X-Devprint-Kind'] ?? '',
    optedOut: res.headers['X-Devprint-OptOut'] === 'true',
  }));

  return {
    statusCode: res.status,
    headers: res.headers,
    body: res.body,
  };
}
