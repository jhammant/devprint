# Devprint Operations

> Status: skeleton. Fleshed out as Phase 2 (agent Lambda) and Wave 2 features land.

## Rate limits

### GitHub API ceiling

| Mode | Ceiling | Notes |
|---|---|---|
| Browser, unauthenticated | 60 req/hr/IP | SPA reads — each visitor's own browser. Generally fine. |
| Lambda with PAT | 5,000 req/hr/account | Shared across all warm Lambda containers. CloudFront cache hides most reads. |

Mitigations layered into the Lambda:

1. CloudFront cache: `max-age=300, stale-while-revalidate=600` on `.md` packs makes the 5,000/hr ceiling survive significant traffic.
2. In-memory token bucket per warm container: rough per-IP throttle. v1.
3. Wave 3: DynamoDB-backed pack cache keyed by `<user>/<repo>@<sha>`, plus DynamoDB-backed per-IP rate limiting.

### Devprint endpoint rate limit (per-IP)

v1: simple in-memory token bucket (e.g., 30 req/min refill) per warm container. Returns `429 Too Many Requests` with `Retry-After`. Counts reset per cold start — imperfect but acceptable for low-traffic launch.

v2 (Wave 3): DynamoDB-backed limiter, per-IP and per-target.

## Opt-out workflow

A user or repo opts out by adding a file at `.well-known/devprint-optout` to:

- `https://github.com/<owner>/<owner>` for user-level opt-out, or
- the target repo itself for repo-level opt-out.

The agent Lambda checks both at request time. Opted-out targets receive:

```
HTTP/1.1 451 Unavailable For Legal Reasons
X-Devprint-OptOut: true
Content-Type: text/markdown; charset=utf-8

# Devprint pack unavailable

The owner of this target has opted out of Devprint analysis. No data has been generated.

To opt back in, remove `.well-known/devprint-optout` from the relevant repo.
```

A static allowlist in `src/analysis/optout.ts` handles emergency opt-outs that need to take effect before the user can ship a commit. Updates to that list ship via a regular deploy.

Opt-out lookup adds ~1 RTT to a cold pack request. Mitigation: 1-hour in-memory cache per warm container; long-term move to DynamoDB.

## Secret scrubbing

Token-shaped strings detected in any externally-sourced content (READMEs, configs, descriptions) are **never** reproduced in the pack body. They are replaced with a placeholder of the form `<redacted: stripe-key-shaped>` and the redaction count is included in the pack footer.

Supported patterns (live in `src/analysis/scrub.ts`):

- GitHub PAT: `ghp_`, `gho_`, `ghs_`, `github_pat_…`
- AWS access keys: `AKIA…`, `ASIA…`, plus 40-char secret-key shapes in adjacent contexts
- Stripe keys: `sk_live_`, `sk_test_`, `rk_live_…`
- Slack tokens: `xox[baprs]-…`
- Twilio: `AC…` + auth-token shapes
- Google API keys: `AIza…`
- JWTs: `eyJ…\.eyJ…\.…`
- PEM private key blocks: `-----BEGIN .* PRIVATE KEY-----`
- Long hex/base64 strings (≥32 chars) in suspicious adjacent contexts (`token=`, `key=`, env-style assignments)

False positives (e.g., README code samples that *teach* readers about a token format) are tracked under "Known imperfections"; future iterations may treat fenced code blocks differently.

## Provenance contract

Every `.md` pack includes:

- A footer block with `generated_at` (ISO 8601), content hash (sha-256 of the body sans the footer itself), source commit SHA (when generating a repo pack), and tool version.
- Response headers mirroring the same: `X-Devprint-Generated-At`, `X-Devprint-Hash`, `X-Devprint-Sha`, `X-Devprint-Tool-Version`.

Agents can verify the body hasn't been tampered with by recomputing the hash over `body.replace(footer, "").trim()` and comparing.

## Logging & metrics

CloudWatch:

- Each Lambda emits structured JSON log lines with `target`, `kind`, `format`, `task?`, `ms`, `status`, `cache: HIT|MISS`, `redactions`, `optedOut`.
- Set retention to 14 days on all `/aws/lambda/devprint-*` log groups.

Custom metrics (Wave 2):

- `OpenInAgentClicks` per surface (Codex / Claude Code / Cursor) via `?utm=` on the agent endpoint.
- `BadgeRenders` per `<u>/<r>`.
- `OptOutHits` count.

Metrics live in the `Devprint` namespace in CloudWatch.

## Incident playbook (placeholder)

| Symptom | First check | Next step |
|---|---|---|
| 5xx spike on agent Lambda | CloudWatch errors + log lines | GitHub status page; rotate PAT if quota exhausted |
| 429s rising | per-IP rate-limiter logs | Lift to DynamoDB-backed limiter (Wave 3 chore) |
| OG image broken | CloudWatch errors on `Og` Lambda | Likely `@resvg/resvg-js` arch mismatch or font missing |
| Cert validation stuck | ACM console | Confirm Route 53 NS records + DNS validation CNAMEs in place |

## Emergency opt-out

To opt out a target immediately without waiting for a `.well-known/devprint-optout` file:

1. Add the target to `STATIC_OPTOUT` in `src/analysis/optout.ts`.
2. `npx sst deploy --stage prod`.

Document why in the commit message; users can later remove themselves from the static set by opening a PR or filing an issue.
