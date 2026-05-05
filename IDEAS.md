# Devprint — Plans and Ideas

This captures the product thinking from the initial Devprint discussion so the next local-dev pass has a clear direction.

## Core concept

Devprint is a URL-swap product for GitHub:

- `devprint.xyz/<user>` → a human-facing developer fingerprint.
- `devprint.xyz/<user>/<repo>` → a human-facing repo fingerprint.
- `agents.devprint.xyz/<user>` → an agent-facing context pack for a developer's public repos.
- `agents.devprint.xyz/<user>/<repo>` → an agent-facing context pack for one repo.

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
Use https://agents.devprint.xyz/jhammant/factcheck to understand this repo, then add tests for the CLI. Run the smallest useful test gate before reporting back.
```

Or, once markdown endpoints exist:

```text
Use https://agents.devprint.xyz/jhammant/factcheck.md as context, then fix the setup instructions.
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

- `agents.devprint.xyz/<user>.md`
- `agents.devprint.xyz/<user>/<repo>.md`
- maybe `agents.devprint.xyz/<user>/<repo>/AGENTS.md`

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
https://agents.devprint.xyz/jhammant/factcheck.md?task=add-tests
```

## Product architecture

### Cheap v1

Keep it cheap and easy to host:

- Cloudflare Pages
- Vite static app
- Cloudflare Pages Functions for `.md` endpoints
- no database initially
- GitHub public API from browser for the visual app
- GitHub API from edge function for markdown endpoint

### Why Cloudflare Pages

- free/cheap
- custom domains are easy
- one deployment can serve both `devprint.xyz` and `agents.devprint.xyz`
- Pages Functions can add the agent markdown endpoint without a separate backend
- can add KV/cache later for rate limiting

### Future backend/cache

Add only when needed:

- GitHub token for higher rate limits
- Cloudflare KV cache per target
- background refresh of popular profiles/repos
- saved generated cards
- image generation for OG/social cards

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

## Potential premium/features later

- private GitHub repos via OAuth
- org/team fingerprints
- compare two developers/repos
- founder/cofounder matching
- recruiter/hiring reports
- OSS maintainer discovery
- “what should I build next?” from abandoned repo threads
- “repo onboarding in 60 seconds” for teams
- generated `AGENTS.md` PRs
- badges/widgets for README files
- social image generation for cards

## Immediate next steps

1. Implement real `.md` endpoint logic in `functions/[[path]].ts`.
2. Share GitHub analysis logic between frontend and function.
3. Add README/package-file fetching for repo agent packs.
4. Add `?task=` modes for agent packs.
5. Deploy to Cloudflare Pages.
6. Configure domains:
   - `devprint.xyz`
   - `agents.devprint.xyz`
7. Add OG/social images for human cards.
8. Improve battle-card scoring so it is evidence-backed and less arbitrary.

## Open questions

- Should the agent endpoint default to markdown, JSON, or both?
- Should `.md` output be deterministic or LLM-enhanced?
- Do we want OAuth early for private repos, or prove public repo workflow first?
- Should battle cards be deliberately playful, or more professional?
- Should repo pages prioritize “show-off” or “onboarding”?
