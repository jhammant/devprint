# Devprint

Turn a GitHub user or repo into two useful artefacts:

- `devprint.dev/<user>` or `devprint.dev/<user>/<repo>` — human-facing show-off card.
- `agents.devprint.dev/<user>` or `agents.devprint.dev/<user>/<repo>` — agent-facing context pack.

See [IDEAS.md](./IDEAS.md) for product scope and the five-wave roadmap.

## Why

Humans want a quick, shareable sense of what someone builds.
Agents need a concise repo briefing before they start editing code.

Devprint uses public GitHub data to create both.

## Local dev

SPA-only (no Lambdas):

```bash
npm install
npm run dev
```

Try:

- `http://localhost:5173/jhammant`
- `http://localhost:5173/jhammant/factcheck`
- `http://localhost:5173/agents/jhammant/factcheck`

Full stack with live Lambdas (once SST is wired up):

```bash
npx sst dev
```

This boots the SPA via Vite alongside the agent / OG / badge Lambdas as live local processes.

## Agent usage

Give a coding agent a Devprint URL before the task:

```text
Use https://agents.devprint.dev/jhammant/factcheck to understand this repo, then add tests for the CLI. Run the smallest useful test gate before reporting back.
```

Direct markdown endpoint:

```text
https://agents.devprint.dev/jhammant/factcheck.md
```

## Architecture

AWS-native, deployed via [SST v3 (Ion)](https://sst.dev). See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the routing matrix and cache strategy.

- **SPA** (`devprint.dev`): Vite static app on S3 + CloudFront.
- **Agent endpoints** (`agents.devprint.dev`): Lambda Function URLs behind a CloudFront Router, returning `text/markdown`.
- **OG images** (`devprint.dev/og/<user>.png`): Lambda using `satori` + `@resvg/resvg-js`.
- **Badge SVG** (`devprint.dev/<u>/<r>.svg`): Lambda returning `image/svg+xml`.
- **DNS / certs**: Route 53 hosted zone + ACM certs auto-provisioned by SST in `us-east-1` for CloudFront.
- **Region**: Lambdas in `eu-west-2`.

## Deploy

See [`docs/DEPLOY.md`](./docs/DEPLOY.md) for the full deploy runbook including the GitHub Actions OIDC bootstrap.

```bash
# Personal stage (auto SST URLs, no custom domain):
npx sst deploy --stage dev

# Production (devprint.dev + agents.devprint.dev):
npx sst deploy --stage prod
```

## Status

MVP skeleton. The static SPA works against the public GitHub API. The agent markdown endpoint is scaffolded — replacement with the real Lambda is the first wave-1 task.
