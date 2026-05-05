// Cloudflare Pages Function skeleton for future direct Markdown endpoint.
// Goal: agents can fetch https://agents.devprint.xyz/owner/repo.md and receive text/markdown
// without needing to execute client-side JavaScript.

type EventContext = {
  request: Request;
  next: () => Promise<Response>;
};

export async function onRequest(context: EventContext): Promise<Response> {
  const url = new URL(context.request.url);

  if (!url.hostname.startsWith('agents.') || !url.pathname.endsWith('.md')) {
    return context.next();
  }

  const target = url.pathname.replace(/^\/+|\.md$/g, '');
  if (!target) return new Response('Missing GitHub target', { status: 400 });

  // TODO: replace this placeholder with shared GitHub analyser logic.
  // Keep unauthenticated v1 public-only. Add a GitHub token env var later for higher rate limits.
  const body = `# Devprint Agent Pack: ${target}\n\n` +
    `This is the planned direct Markdown endpoint.\n\n` +
    `For now, use the browser app at https://agents.devprint.xyz/${target}.\n\n` +
    `## Intended agent usage\n\n` +
    `Use this pack to understand https://github.com/${target}, then complete the requested coding task.\n`;

  return new Response(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=300'
    }
  });
}
