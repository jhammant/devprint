# Devprint Deploy Runbook

> Status: skeleton. Fleshed out as Phase 4 (SST deploy) lands.

## Prerequisites

- AWS account, with admin or scoped deploy role.
- Route 53 hosted zone for `devprint.dev` (created automatically when the domain registration completes; verify with `aws route53 list-hosted-zones`).
- `aws` CLI configured with credentials for the target account.
- Node.js 20+ and `npm` 10+.
- A GitHub fine-grained personal access token (PAT) with `public_repo: read` only — for the `GithubToken` SST secret.

## First-time setup

### 1. Install deps

```bash
npm install
```

### 2. Bootstrap SST

```bash
npx sst init    # if not already initialised; creates sst.config.ts skeleton
```

### 3. Set the GitHub token secret per stage

```bash
npx sst secret set GithubToken <fine-grained-pat> --stage dev
npx sst secret set GithubToken <fine-grained-pat> --stage prod
```

### 4. Bootstrap the GitHub Actions OIDC role

CD pushes to `main` deploy via OIDC, not long-lived AWS keys. One-off CloudFormation stack:

```bash
# stack.yml below — deploy once, then save the role ARN for the workflow
aws cloudformation deploy \
  --stack-name devprint-gha-oidc \
  --template-file scripts/oidc-role.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      Repo=jhammant/devprint \
      Branch=main
```

The role ARN is stored as a GitHub Actions secret named `AWS_DEPLOY_ROLE_ARN`.

## Deploy commands

### Personal / preview stage (no custom domain)

```bash
npx sst deploy --stage dev
# or for ephemeral PR previews:
npx sst deploy --stage pr-123
```

SST emits the auto-generated CloudFront and Function URLs in the output.

### Production

```bash
npx sst deploy --stage prod
```

Requires:
- Hosted zone for `devprint.dev` is active (post-Route 53 registration completion).
- `GithubToken` secret set for the `prod` stage.

First prod deploy can take 20–40 minutes (ACM cert validation + CloudFront propagation). Re-deploys are typically 2–5 minutes.

## Local dev

```bash
npx sst dev
```

Boots the SPA via Vite and runs each Lambda as a live local process, hot-reloading on save. The Function URLs are wired to the dev stage, so requests hit local code.

SPA-only iteration (no Lambdas):

```bash
npm run dev
```

## Cleanup of Cloudflare scaffolding

After the first successful prod deploy passes the post-deploy smoke checks (Phase 6), remove these in a single commit titled `Remove Cloudflare scaffolding`:

- `functions/[[path]].ts`
- `public/_redirects`
- `public/_headers`
- `"functions"` entry from `tsconfig.json` `include` array

Do **not** remove pre-emptively — they keep the repo in a known-deployable state until the AWS path is verified.

## Rollback

SST deployments are CloudFormation stacks. Rollback by redeploying a previous git ref:

```bash
git checkout <known-good-sha>
npx sst deploy --stage prod
```

Custom domain DNS records and ACM certs are retained on `prod` (`removal: "retain"` in `sst.config.ts`).

## Cost expectations

At MVP scale (low single-digit req/s, mostly cached):

- Route 53 hosted zone: $0.50/mo
- Route 53 domain: $17/yr (`.dev` registration; renews at the same rate)
- CloudFront: free tier covers first 1 TB and 10 M requests for 12 months; a few $/mo afterwards
- Lambda: free tier covers first 1 M req/mo forever
- S3: pennies/mo at MVP scale
- Secrets Manager: $0.40/secret/mo
- CloudWatch logs: pennies/mo at MVP volume (set retention to 14 days)

Budget alarm: $5/mo, $20/mo. Configure in `sst.config.ts` or via the AWS Budgets console.
