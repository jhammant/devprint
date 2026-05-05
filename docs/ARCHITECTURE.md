# Devprint Architecture

AWS-native, deployed via SST v3 (Ion). Two CloudFront distributions over a single Route 53 hosted zone, fronted by ACM certs auto-provisioned in `us-east-1`. Lambdas in `eu-west-2`.

## Topology

```text
                          devprint.dev                  agents.devprint.dev
                               │                                │
                               ▼                                ▼
                    sst.aws.Router                       sst.aws.Router
                  ┌────────┼────────┐                          │
                  ▼        ▼        ▼                          ▼
          StaticSite    Og fn   Badge fn                    Agent fn
            (S3)      (Lambda)  (Lambda)                   (Lambda)
                          │        │                          │
                          └────────┴───────┬──────────────────┘
                                           ▼
                                    GitHub public API
                                  (+ Secrets Manager
                                   for GitHub PAT)
```

## Routing matrix

| Host | Path | Origin | Notes |
|---|---|---|---|
| `devprint.dev` | `/` | StaticSite (S3 + CloudFront) | SPA shell |
| `devprint.dev` | `/<user>` | StaticSite | client-side routing |
| `devprint.dev` | `/<user>/<repo>` | StaticSite | client-side routing |
| `devprint.dev` | `/vs/<a>/<b>` (Wave 2) | StaticSite | client-side routing |
| `devprint.dev` | `/og/<user>.png`, `/og/<user>/<repo>.png` (Wave 1) | Og Lambda Function URL | satori → resvg PNG |
| `devprint.dev` | `/<user>/<repo>.svg` (Wave 2) | Badge Lambda Function URL | image/svg+xml |
| `agents.devprint.dev` | `/<user>.md` | Agent Lambda Function URL | text/markdown |
| `agents.devprint.dev` | `/<user>/<repo>.md` | Agent Lambda Function URL | text/markdown |
| `agents.devprint.dev` | `/<user>/<repo>/AGENTS.md` | Agent Lambda Function URL | alias of repo pack |
| `agents.devprint.dev` | `/<user>/<repo>/safety.md` (Wave 2) | Agent Lambda Function URL | safety brief |
| `agents.devprint.dev` | `/<user>/<repo>/receipt.md` (Wave 2) | Agent Lambda Function URL | Stack Receipt twin |
| `agents.devprint.dev` | `/vs/<a>/<b>.md` (Wave 2) | Agent Lambda Function URL | comparison brief |
| `agents.devprint.dev` | `/<user>/<repo>/drift?sha=<x>` (Wave 2) | Agent Lambda Function URL | application/json |
| both | `/<user>.md?task=<task>` (Wave 2) | Agent Lambda Function URL | task-tailored pack |

Route ordering inside the agent Lambda matters: longer paths (`/<u>/<r>/safety.md`) must match before shorter ones (`/<u>/<r>.md`) before the user pack (`/<u>.md`).

## Cache strategy

| Surface | `Cache-Control` | Notes |
|---|---|---|
| SPA shell | default CloudFront defaults | Vite hashed assets immutable |
| Agent `.md` packs | `public, max-age=300, stale-while-revalidate=600` | covers most reads from one warm CloudFront edge per region |
| OG `*.png` | `public, max-age=600, stale-while-revalidate=86400` | regen on demand if origin says so |
| Badge `.svg` | `public, max-age=3600, stale-while-revalidate=86400` | README badge embeds — high read volume |
| `safety.md` | same as `.md` packs | |

CloudFront `X-Cache: HIT` should appear by the second request from any given edge. Pack response headers always include `X-Devprint-Sha`, `X-Devprint-Hash`, `X-Devprint-Generated-At`, `X-Devprint-Tool-Version` for agent verification.

## Trust contracts (from `IDEAS.md`)

Every agent pack must include:

- **Provenance footer** in the markdown body: `generated_at`, content hash (sha-256 of body sans footer), source commit SHA.
- **Provenance headers** mirroring the footer (`X-Devprint-*`).
- **Confidence labels with evidence** on every inferred claim.
- **PII / secret scrubbing** of any externally-sourced strings before they appear in the pack body.
- **Opt-out honored** via `.well-known/devprint-optout` on the user's `<user>/<user>` repo or the target repo itself; opt-out targets return `451 Unavailable For Legal Reasons` with `X-Devprint-OptOut: true`.

## Stages

- **`dev`**: SST-generated CloudFront + Function URLs. No custom domain. Used for PR previews and personal stages.
- **`prod`**: `devprint.dev` and `agents.devprint.dev` attached.

## Open questions

Tracked in [`../IDEAS.md`](../IDEAS.md) under "Open questions"; resolve before features that depend on them ship (e.g. JSON vs markdown default, deterministic vs LLM-enhanced packs).
