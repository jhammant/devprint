# Devprint Product Notes

This file captures the surface-level product split. For full scope and roadmap see [`../IDEAS.md`](../IDEAS.md). For deployment topology see [`./ARCHITECTURE.md`](./ARCHITECTURE.md).

## Product split

### `devprint.dev/:user` and `devprint.dev/:user/:repo`
Human-facing page:
- visual developer/repo fingerprint
- Top Trumps-style battle card with evidence-backed stats
- themes, language strengths, public project highlights
- OG image = the battle card itself
- shareable URL

### `agents.devprint.dev/:user` and `agents.devprint.dev/:user/:repo`
Agent-facing page:
- markdown-style context pack in the browser
- copy-paste prompt for coding agents
- stack clues, likely commands, files to inspect, risks and starter tasks

### `agents.devprint.dev/:user.md` and `agents.devprint.dev/:user/:repo.md`
Lambda endpoint returning `text/markdown` directly for agents/CLIs that fetch URLs without running JavaScript. Includes a provenance footer (`generated_at`, content hash, source commit SHA) and the same fields as response headers.

Example prompt:

> Use https://agents.devprint.dev/jhammant/factcheck.md to understand the repo, then add tests for the CLI. Run the smallest relevant test gate before summarising.

## Hosting

AWS-native via SST v3 (Ion). No DB in v1; rely on CloudFront response caching for the `.md` packs (`Cache-Control: max-age=300, stale-while-revalidate=600`). See [`./ARCHITECTURE.md`](./ARCHITECTURE.md) for the full diagram, [`./DEPLOY.md`](./DEPLOY.md) for the deploy runbook, and [`./OPERATIONS.md`](./OPERATIONS.md) for rate limits + the opt-out workflow.

## Next useful features

The full roadmap lives in [`../IDEAS.md`](../IDEAS.md) under "Feature waves". Highlights for the immediate horizon:

1. Real `.md` agent Lambda replacing the Cloudflare Pages stub.
2. Stack Receipt (visual + `.md` twin) — proves the analysis engine.
3. README badge SVG at `devprint.dev/<u>/<r>.svg`.
4. VS pages — `/vs/<a>/<b>` for users and repos with `.md` twin.
5. Repo Safety Card + `agents.devprint.dev/<u>/<r>/safety.md` decision endpoint.
6. `?task=` modifiers (add-tests, review, fix-bug, ship-mvp, docs, refactor).
