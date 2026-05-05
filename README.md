# Devprint

Turn a GitHub user or repo into two useful artefacts:

- `devprint.xyz/<user>` or `devprint.xyz/<user>/<repo>` — human-facing show-off card.
- `agents.devprint.xyz/<user>` or `agents.devprint.xyz/<user>/<repo>` — agent-facing context pack.

## Why

Humans want a quick, shareable sense of what someone builds.
Agents need a concise repo briefing before they start editing code.

Devprint uses public GitHub data to create both.

## Local dev

```bash
npm install
npm run dev
```

Try:

- `http://localhost:5173/jhammant`
- `http://localhost:5173/jhammant/factcheck`
- `http://localhost:5173/agents/jhammant/factcheck`

## Agent usage

Give a coding agent a Devprint URL before the task:

```text
Use https://agents.devprint.xyz/jhammant/factcheck to understand this repo, then add tests for the CLI. Run the smallest useful test gate before reporting back.
```

Future markdown endpoint shape:

```text
https://agents.devprint.xyz/jhammant/factcheck.md
```

## Deploy cheaply

Cloudflare Pages is the recommended host:

- Build command: `npm run build`
- Output directory: `dist`
- Add custom domains: `devprint.xyz` and `agents.devprint.xyz`
- SPA fallback is included via `public/_redirects`.

## Status

MVP skeleton. Static app works from public GitHub API. Agent markdown endpoint is scaffolded for Cloudflare Pages Functions.
