# devprint.json — opt-in profile enrichment

Devprint reads everything off the public GitHub API. That gets you ~80% of a useful card. The remaining 20% — the *human* parts (what you're available for, your one-line tagline, the wins you'd lead with) — can be filled in with an opt-in JSON file in your own GitHub.

## Where to put the file

Devprint looks in two places, in this order:

1. `https://github.com/<you>/.github/devprint.json` — the conventional "GitHub config" repo most maintainers already have.
2. `https://github.com/<you>/<you>/devprint.json` — your profile-readme repo (the one whose name matches your username).

The first hit wins. Both are public, both update through the same Lambda that already builds the rest of the card, so changes propagate in seconds.

## Schema

Every field is optional. Any field omitted simply doesn't render — the card was designed to look right on GitHub data alone.

```json
{
  "tagline": "Hands-on engineering · shipping public",
  "status": "Available · Q3 2026",
  "about": "I write tools for indie devs and write less docs than I should. Recently obsessed with making CV-style artefacts that update themselves.",
  "now": "Living in London. Reading 'The Goal'. Shipping Devprint.",
  "available": "Advisor chats · short consulting (1-2 weeks)",
  "ask": "If you're building a developer-tooling startup that's hit a stage where you're hiring your first 5 engineers — I'd love to compare notes.",
  "contact": "hi@example.dev",
  "pinned": ["devprint", "factcheck", "agents-md"],
  "skills": ["TypeScript", "AWS", "AI infra", "Postgres"],
  "highlights": [
    "Shipped devprint.dev solo in two weeks",
    "Sold a previous developer-tools startup to $LARGE_CO",
    "Open-sourced the agent context-pack format Devprint generates"
  ],
  "links": [
    {"name": "Site", "href": "https://example.dev"},
    {"name": "X",    "href": "https://x.com/handle"},
    {"name": "Mastodon", "href": "https://mastodon.social/@handle"}
  ]
}
```

### Field reference

| Field        | Type                            | Where it surfaces |
|--------------|----------------------------------|-------------------|
| `tagline`    | string (≤ 500 chars)            | Title line under your name on the Letterhead card. |
| `status`     | string (≤ 500 chars)            | Status ribbon next to your name. **No status, no ribbon** — Devprint never invents an "Open to work" badge for you. |
| `about`      | string (≤ 2000 chars)           | Replaces the auto-generated "About" paragraph. |
| `now`        | string (≤ 500 chars)            | "Right now —" line under About. |
| `available`  | string (≤ 500 chars)            | Used as the ribbon when `status` is absent. |
| `ask`        | string (≤ 600 chars)            | Headline + body of the closing CTA panel. |
| `contact`    | string (email)                  | Mailto link in the contact rail. |
| `pinned`     | string[] of repo names          | Repos to feature first in "Selected works", before the score-ranked list fills the rest. |
| `skills`     | string[] (up to 16)             | Skill chips below "Skills, in their words". |
| `highlights` | string[] (up to 6)              | A bulleted "Highlights" section under About. |
| `links`      | array of `{name, href}` objects | Up to 8 outbound links in the contact rail. `href` must be `http(s)`; anything else is silently dropped. |

## Safety

- Every string is run through Devprint's PII scrubber (same one used for the AI agent pack) before it's rendered.
- Links must be `http://` or `https://`. `javascript:`, `data:`, and relative URLs are rejected.
- The whole file is capped at sensible per-field lengths — you can't push 100KB of prose through it.
- Field values are HTML-escaped on render. You can't sneak markup into your tagline.

## What it doesn't do

- Doesn't override stats. Stars, repos, followers, battle-card numbers — those are still computed from public GitHub data, and you can't bump them with this file.
- Doesn't change the public-card URL. `devprint.dev/<you>` stays the same.
- Doesn't run on private repos or private profile data — it's a public-data tool by design.

## Removing it

Delete the file. Next render won't include the overrides.
