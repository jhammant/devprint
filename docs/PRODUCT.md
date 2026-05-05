# Devprint Product Notes

## Product split

### `devprint.xyz/:user` and `devprint.xyz/:user/:repo`
Human-facing page:
- visual developer/repo fingerprint
- Top Trumps-style battle card
- themes, language strengths, public project highlights
- shareable URL

### `agents.devprint.xyz/:user` and `agents.devprint.xyz/:user/:repo`
Agent-facing page:
- markdown-style context pack in the browser
- copy-paste prompt for coding agents
- stack clues, likely commands, files to inspect, risks and starter tasks

### `agents.devprint.xyz/:user/:repo.md`
Future/Cloudflare Function endpoint:
- returns plain Markdown directly
- intended for agents/CLIs that fetch URLs without running JavaScript

Example prompt:

> Use https://agents.devprint.xyz/jhammant/factcheck.md to understand the repo, then add tests for the CLI. Run the smallest relevant test gate before summarising.

## Cheap hosting recommendation

Use Cloudflare Pages:
1. Connect this private GitHub repo.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add custom domains:
   - `devprint.xyz`
   - `agents.devprint.xyz`
5. Keep both pointed at the same deployment. The app switches mode based on hostname.

No database required for v1. GitHub public API is enough.

## Next useful features

1. Markdown endpoint that returns `text/markdown` for agents.
2. Task-specific packs: `?task=add-tests`, `?task=review`, `?task=fix-bug`.
3. GitHub OAuth for private repos.
4. Save/cache generated packs to reduce GitHub API rate limits.
5. Social image generation for human battle cards.
