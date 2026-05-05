# Devprint — Plans and Ideas

This captures the product thinking from the initial Devprint discussion so the next local-dev pass has a clear direction.

## Core concept

Devprint is a URL-swap product for GitHub:

- `devprint.dev/<user>` → a human-facing developer fingerprint.
- `devprint.dev/<user>/<repo>` → a human-facing repo fingerprint.
- `agents.devprint.dev/<user>` → an agent-facing context pack for a developer's public repos.
- `agents.devprint.dev/<user>/<repo>` → an agent-facing context pack for one repo.

The simple pitch:

> GitHub in. Useful artefact out.

For humans, the artefact should be visual, shareable, and slightly addictive.
For agents, the artefact should be practical context that helps them work faster and make fewer bad assumptions.

## Human product: Devprint

### Positioning

> Devprint — see the shape of any developer's work.

### MVP output

For a GitHub user:

- visual builder graph
- repo/theme clusters
- inferred strengths with evidence
- strongest or most interesting public projects
- collaborator/ecosystem signals later
- shareable developer card
- Top Trumps-style builder card

For a GitHub repo:

- visual repo fingerprint
- language / stack clues
- repo health signals
- stars, forks, issues, recent activity
- repo battle card
- useful project summary

### Top Trumps / battle card idea

This feels like the most viral layer.

Each user/repo gets a card with stats like:

- Build Power
- Impact
- Versatility
- Momentum
- Community
- Originality
- rarity tier: Emerging / Rare / Epic / Legendary
- Special Move based on archetype

Example archetypes:

- AI Toolsmith
- Product Hacker
- Systems Shaper
- Data Explorer
- App Builder
- Pragmatic Builder

Important: keep this fun, but not obviously fake. Show evidence where possible.

### Why this wedge works

- People will run it on themselves first.
- It is easy to share.
- Public GitHub data is enough for v1.
- It has utility beyond novelty: hiring, intros, founder matching, OSS discovery.
- It can expand later into LinkedIn, X, blogs, packages, papers, etc.

## Agent product: Agents.Devprint

### Positioning

> Give any coding agent this URL before it touches a repo. It arrives already briefed.

### Intended usage

A human should be able to say to an agent:

```text
Use https://agents.devprint.dev/jhammant/factcheck to understand this repo, then add tests for the CLI. Run the smallest useful test gate before reporting back.
```

Or, once markdown endpoints exist:

```text
Use https://agents.devprint.dev/jhammant/factcheck.md as context, then fix the setup instructions.
```

### Agent pack contents

The agent-facing output should be closer to `AGENTS.md` than a visual page:

- target type: user or repo
- GitHub URL
- owner
- repo/user summary
- main languages and stack clues
- likely setup/test/build commands
- files/directories to inspect first
- active vs stale repo signals
- risks / unknowns
- confidence labels
- starter prompts
- operating guidance

Example guidance:

- Start by reading README, package/build files, and recent commits.
- Do not assume private context; only public GitHub data was used.
- Prefer small, reversible changes.
- Run the smallest relevant test/build command before reporting success.
- Preserve the repo's apparent stack and style unless asked to refactor.

### Direct markdown endpoint

Add direct text endpoints so agents and CLIs do not need JavaScript:

- `agents.devprint.dev/<user>.md`
- `agents.devprint.dev/<user>/<repo>.md`
- maybe `agents.devprint.dev/<user>/<repo>/AGENTS.md`

Return `text/markdown`.

This is probably the most important next technical feature.

### Task-specific packs

Support query params that tailor the pack:

- `?task=add-tests`
- `?task=review`
- `?task=fix-bug`
- `?task=ship-mvp`
- `?task=docs`
- `?task=refactor`

Different tasks should change:

- likely commands
- first files to inspect
- warnings
- starter prompt
- success criteria

Example:

```text
https://agents.devprint.dev/jhammant/factcheck.md?task=add-tests
```

## Crossover ideas: shareable AND agent-useful

The strongest features hit both axes — viral on the human side AND the literal artefact an agent needs. Avoid building separate "fun" and "useful" features when one well-shaped output can do both.

### Cross-cutting features

- **VS pages** — `devprint.dev/vs/<a>/<b>` for users and repos. Pokémon-style head-to-head: shareable ("I beat you on Momentum"), and useful to agents asked "which library do I pick for X?" Same engine generates `agents.devprint.dev/vs/...md` returning a comparison brief.
- **Stack Receipt** — paper-receipt-styled image listing detected stack, install/test/build commands, last-touched timestamp, with confidence percentages. Memey on Twitter; the text twin is the smallest-useful agent pack.
- **README badge** — `[![devprint](https://devprint.dev/<user>/<repo>.svg)]`. Spreads organically through forks. Each click funnels into both surfaces. Distribution disguised as ego candy.
- **Risk panel** — "no tests, last commit 14mo ago, leaked-token-shaped strings in history, no LICENSE." Spicy when self-roasted; mission-critical for an agent so it does not walk into a dead repo.
- **Hot files / churn heatmap** — visualises where bugs cluster and which files churn most. Shareable as a picture; for agents this IS "files to inspect first."
- **"Open in Codex/Claude/Cursor with context preloaded"** — buttons on the human card. Magic moment for users and a tracked conversion event proving the agent pack works.
- **Drop-in AGENTS.md PR button** — "Add a generated AGENTS.md to this repo." One click → real PR. Stunt for sharing. Embeds the pack at source, so future agents get it for free without devprint in the loop.
- **Fingerprint code** — short stable hash like `DV-7K3M-AI-TOOLSMITH` derived from archetype + stack signature. People put it in bios (free distribution). For agents, it doubles as a deterministic cache key.
- **Compatibility score** — `/match/<a>/<b>`. "You and @x are 73% compatible co-founders / 41% compatible reviewers." Meme-shaped. For agents in multi-developer repos, signal about review-friction zones.
- **Maintainer responsiveness stat** — median PR/issue response time, "active hours" heatmap. Funny ("Owl tier: replies at 2am"). For agents: input to "file an issue, fork, or just patch?"
- **Archetype evolution timeline** — show how a dev's archetype shifted over time (e.g., "Data Explorer 2019 → AI Toolsmith 2024"). Story-shaped, very shareable. For agents, distinguishes currently-maintained work from legacy interest.
- **Onboarding speedrun stat** — estimated time-to-first-meaningful-edit for an agent on this repo, based on doc quality, test coverage, setup complexity. Leaderboard-shareable. Literally the metric an agent cares about.
- **Repo "smell test" tag** — single-label classification: maintained / abandoned / demo-only / learning project / library / app / weekend hack. Shareable label; filters wrong agent assumptions.
- **Commit + PR style sample** — extracted exemplars of how this dev writes commits and PRs. Vibe check for humans; lets agents match existing style automatically.
- **"What I'd build next for you"** — generate three concrete next-issue ideas per repo with effort estimates. Shareable ("devprint suggested a real feature for my repo"). Maps directly onto `?task=ship-mvp` starter prompts.
- **Saved snapshots / permalinks** — devprint as of date X. Shareable historical artifacts. For agents: stable, reproducible context that does not drift with the repo.
- **Repo-pack diff** — "what changed in this repo's pack since last week." Shareable changelog. For agents: incremental context updates.
- **Lineage graph** — forked-from / inspired-by / similar-to chains. Shareable discovery tree. For agents: prior art when implementing similar work.
- **"Twin" / similarity finder** — most similar developer or repo. "Apparently I'm the @x of Go." For agents: collaborator / reviewer / exemplar suggestions.
- **Paste-any-GitHub-URL mode** — accept PR / issue / commit / branch URLs, return a contextual mini-pack. DM-shareable ("read this before commenting"); useful for agents handed any GitHub link.
- **Agent dry-run preview** — "given this pack, here's the first 3 files an agent would read and the first command it would run." Theatrical demo for sharing; validates the pack actually works.

### Meta-moves that amplify all of the above

- **Every visual page has a `.md` / `?format=md` twin** with identical underlying data. Contract: nothing exists on the human side the agent side cannot consume. Eliminates the "two products" temptation.
- **Every shareable artefact links back to the agent URL by design** — OG images, badges, embeds all carry the `devprint.dev` ↔ `agents.devprint.dev` swap as the punchline. The viral loop and the agent loop become the same loop.

### Ranking for early build

If forced to pick three first: **Stack Receipt** (proves the engine), **VS pages** (most viral), **README badge** (long-term distribution). The "Open in <agent>" button is the cheapest stunt and worth bundling into the human card from day one.

## Security & reputation

The most agent-critical zone — security signals are the difference between "agent helps you" and "agent runs malware on your laptop" — and the most reputation-charged. Get it wrong and you defame people or surface secrets. Get it right and Devprint becomes the trust layer for the LLM-coding era.

### Repo security (mostly agent utility)

- **Repo Safety Card** — companion to Stack Receipt. License, dep CVE count, secret-scan hits (count only, never values), CI/branch-protection posture, supply-chain smells. Spicy when self-roasted; literally the safety brief an agent needs before running setup.
- **`agents.devprint.dev/<u>/<r>/safety.md`** — decision-shaped output: "safe to clone, risky to install, do not run install scripts." Agents read this gate before acting; humans forward it as a warning.
- **Supply-chain risk score** — unpinned deps, lockfile presence, postinstall/preinstall scripts, packages that download binaries on install, deprecated packages. For agents: "use `--ignore-scripts`."
- **"Don't-run-this" allowlist** — explicit list of commands an agent must NOT exec without human OK (postinstall hooks, `RUN curl | bash` in Dockerfiles, etc.).
- **Auth/crypto antipattern flags** — `md5` for passwords, `Math.random()` for tokens, `eval`, `exec(user_input)`. Lightweight static review for both audiences.
- **"First contact" risk indicator** — new repo + new account + asks-for-tokens = high-risk. Major signal when an agent is pointed at unfamiliar code by a user.
- **License compatibility checker** — pairs with VS pages. "Cannot relicense @x's AGPL code into this MIT project." Critical for any agent merging code.

### Developer reputation (mostly shareable)

- **Builder Trust Tier** — credit-score-shaped, evidence-driven (sustained OSS, dep downloads, issue close rate, account age, etc.). Memey leaderboard hook; only credible if every score shows its working.
- **Cross-platform verification** — link X / blog / npm via `.well-known/devprint` or repo-root file. Verified badge for humans; for agents it's "this really is the maintainer of that npm package, not a typosquatter."
- **Web-of-trust vouches** — opt-in public vouches between Devprint users ("worked with @x for 2y"). Network effect. For agents handling repos with mystery contributors: authenticity signal.
- **Maintainer karma** — % issues closed, median response time, lightweight sentiment in threads. Brag-worthy; for agents, signal whether to file an issue or just patch locally.
- **Drive-by ratio** — % of repos one-commit-and-abandoned vs sustained. Gentle self-roast; for agents calibrating "is this maintained?".
- **AI-assisted authorship: opt-in self-disclosure ONLY** — self-declared label like "~85% AI-assisted." Helps agents calibrate review depth. Detection-based AI labels are reputational poison and unreliable — never do this.

### Trust mechanics for the agent packs themselves

- **Provenance-stamped packs** — every `.md` carries `generated_at`, content hash, and source commit SHA. Deterministic, verifiable, cache-keyable. Agents can detect tampering.
- **Drift indicator** — "pack is 47 commits stale; regenerate." Agents shouldn't act on stale context.
- **Reproducibility check endpoint** — agent posts the SHA it's using, gets back "still current" / "drifted, here's the diff." Self-verification before acting.
- **Confidence labels everywhere** — every claim tagged with confidence + evidence (`test cmd: pnpm test (90%, evidence: package.json scripts.test + .github/workflows/ci.yml)`). Hard contract, not a nice-to-have.
- **PII / secret scrubbing** — token-shaped strings in README/CI/configs are NEVER reproduced in the pack. Replace with `<redacted: Stripe-key-shaped>`. Protects users, protects us, useful agent flag.

### Guardrails (must be in from day one)

- Anything reputation-negative is **factual + auditable, or self-roast only, or opt-in** — never inferred-and-publicized about third parties.
- Public **audit / correction channel** — let people contest inferences and publish corrections. Reduces defamation risk; builds system trust.
- **Never quote leaked secrets** — flag presence and rough type only. Otherwise we become a discovery tool for credential thieves.
- **No AI-detection witch hunts** — false-positive cost is huge. Self-disclosure only.
- **Honor `.well-known/devprint-optout`** — let any repo or user opt out of being analyzed.
- **Rate-limit and/or sign agent endpoints** for repos that are not yours — reduce drive-by reconnaissance abuse.

### If forced to pick three first

**Repo Safety Card + `safety.md`** (highest agent differentiation), **provenance-stamped packs** (cheap, signals seriousness, table-stakes for agent trust), **cross-platform verification** (foundation everything reputation hangs off — until people prove who they are, reputation scoring is hot air).

## Product architecture

### v1 stack (AWS-native)

- **Static SPA**: Vite app on S3 + CloudFront → `devprint.dev`
- **Agent endpoints**: Lambda functions with Function URLs, fronted by a separate CloudFront distribution at `agents.devprint.dev` returning `text/markdown`
- **Shared analysis library**: a single `src/analysis/` TypeScript module imported by both the SPA and the Lambdas — one implementation, two surfaces
- **DNS**: Route 53 (`devprint.dev` registered there)
- **Cert**: ACM (free, auto-renewed; CloudFront certs must live in `us-east-1`)
- **Cache**: lean on CloudFront response caching for `.md` packs (`Cache-Control: max-age=300, stale-while-revalidate=600`). No DB in v1.
- **GitHub API**: public from the browser for the v1 SPA; from Lambda for the agent endpoint. Token stored in Secrets Manager once added.
- **Logging / metrics**: CloudWatch (built-in).
- **IaC**: SST v3 (Ion) — TypeScript-first, defines static site + Lambdas + CloudFront + DNS in one project. Plain CloudFormation under the hood.

### Why AWS

- One account, one bill, one IAM model — already where everything else lives
- Lambda exposure is a deliberate goal, not an accident
- CloudFront caching + Lambda Function URLs are fast enough for markdown packs (cold start ~200–500 ms; warm ~50–200 ms; CloudFront cache hides cold starts on repeat hits)
- DynamoDB / S3 / Secrets Manager are right there when we need them
- Subdomain split (`devprint.dev` ↔ `agents.devprint.dev`) is two CloudFront distributions sharing one Route 53 hosted zone

### Future backend / cache

Add only when needed:

- GitHub token in Secrets Manager (raises rate-limit ceiling from 60/hr → 5,000/hr)
- DynamoDB or S3 cache for generated packs, keyed by `<user>/<repo>@<sha>`
- EventBridge schedule for background refresh of popular profiles / repos
- S3 for stored generated card images
- Lambda + headless renderer (e.g. `@sparticuz/chromium`) for OG / social card image generation

## Data sources

### v1 public GitHub API

Use:

- user profile
- public repos
- repo metadata
- language field
- topics
- stars/forks/issues
- updated timestamps
- README later
- package/build files later

### v2 richer analysis

Fetch and analyse:

- README.md
- package.json / pyproject.toml / go.mod / Cargo.toml / Makefile
- CI configs
- directory tree
- recent commits
- releases
- issues/PRs if useful

For agent packs, README + package files are much more valuable than stars.

## Design principles

### Human side

- fast magic moment
- beautiful card first, detailed report second
- shareable by default
- evidence-backed stats where possible
- fun enough to post, credible enough not to feel like a toy

### Agent side

- plain text beats pretty UI
- make uncertainty explicit
- practical commands and files matter most
- optimize for reducing agent warm-up time
- make the output easy to paste into Codex/Claude/Gemini/OpenCode

## Feature waves

Sequencing the ideas above. Each wave should ship as a coherent release and earn its right to start the next one.

### Wave 1 — Foundations & MVP

Goal: prove the URL-swap concept end-to-end with real GitHub data on both surfaces, deployed, safe by default. Smallest set that's recognisably Devprint.

- Shared GitHub-analysis library used by both the SPA and the Lambdas (no duplication)
- Real `.md` agent endpoint at `agents.devprint.dev/<u>.md` and `<u>/<r>.md` (Lambda + Function URL behind CloudFront)
- README + package/build file fetching for repo packs
- Visual human page with builder graph + Top Trumps battle card on real data
- AWS deploy via SST v3: S3 + CloudFront for SPA, Lambda + CloudFront for agent endpoint
- Route 53 hosted zone + ACM cert covering `devprint.dev` and `agents.devprint.dev`
- OG image = the battle card itself (one artefact, two surfaces)
- **Provenance stamps on every pack** — `generated_at`, content hash, source commit SHA
- **Confidence labels on every inferred claim**, with evidence references
- **PII / secret scrubbing** before any string lands in a pack
- Honor `.well-known/devprint-optout` from day one

### Wave 2 — Distribution & differentiation

Goal: spread, prove the differentiated agent value, light up the viral feedback loops.

- Stack Receipt (visual + `.md` twin)
- README badge SVG (`devprint.dev/<u>/<r>.svg`)
- "Open in Codex / Claude Code / Cursor with context preloaded" buttons on the human card
- `?task=` modifiers (add-tests, review, fix-bug, ship-mvp, docs, refactor)
- VS pages — `/vs/<a>/<b>` for users and repos, with `.md` twin
- **Repo Safety Card** (visual + `.md` twin)
- **`agents.devprint.dev/<u>/<r>/safety.md`** decision endpoint
- **Drift indicator** on packs (pack vs head SHA)
- Risk panel on human page

### Wave 3 — Trust at scale

Goal: become credible enough that people stake reputation on a Devprint, and agents trust it enough to act.

- `.well-known/devprint` cross-platform verification (X, blog, npm)
- Builder Trust Tier — every score shows its working
- Maintainer karma (issue close rate, response time, lightweight sentiment)
- Web-of-trust vouches between Devprint users
- Public audit / correction channel
- Saved snapshots / permalinks
- Repo-pack diff ("what changed since last week")
- Supply-chain risk score
- "Don't-run-this" allowlist
- "First contact" risk indicator
- License compatibility checker (also powers VS pages)
- Hot files / churn heatmap
- Auth / crypto antipattern flags
- AI-assisted authorship self-disclosure label (opt-in)
- Fingerprint code (`DV-7K3M-AI-TOOLSMITH`)

### Wave 4 — Depth

Goal: reward the second glance — every hover surfaces more useful detail.

- Compatibility / match score (`/match/<a>/<b>`)
- Twin / similarity finder
- Lineage graph (forked-from / inspired-by / similar-to)
- Archetype evolution timeline
- Onboarding speedrun stat
- Repo smell-test tag (maintained / abandoned / demo / weekend hack / …)
- Commit + PR style sample
- "What I'd build next for you" — concrete next-issue suggestions
- Paste-any-GitHub-URL mode (PR / issue / commit URLs → mini-pack)
- Agent dry-run preview (first 3 files, first command)
- Reproducibility check endpoint

### Wave 5 — Premium / OAuth / org

Goal: monetize and expand surface area.

- Private repos via OAuth
- Drop-in AGENTS.md PR button (requires OAuth write)
- Org / team fingerprints
- Founder / co-founder matching
- Recruiter / hiring reports
- OSS maintainer discovery
- "What should I build next?" from abandoned repo threads
- "Repo onboarding in 60 seconds" for teams
- LLM-enhanced agent packs (paid tier?)
- Image generation for OG / social cards

### What we'd build first (Wave 1, in order)

1. Shared GitHub-analysis library (foundation for everything else).
2. Real `.md` agent endpoint with README + package-file ingestion, **including provenance stamps, confidence labels, and PII scrubbing from the start** (cheaper to bake in now than retrofit).
3. Visual human page with battle card on real data; OG image = the battle card.
4. AWS deploy via SST: S3 + CloudFront for the SPA, Lambda + CloudFront for the agent endpoint, Route 53 + ACM covering `devprint.dev` and `agents.devprint.dev`.
5. `.well-known/devprint-optout` honored.
6. Improve battle-card scoring so it is evidence-backed before any sharing surfaces light up in Wave 2.

## Open questions

- Should the agent endpoint default to markdown, JSON, or both?
- Should `.md` output be deterministic or LLM-enhanced?
- Do we want OAuth early for private repos, or prove public repo workflow first?
- Should battle cards be deliberately playful, or more professional?
- Should repo pages prioritize “show-off” or “onboarding”?
