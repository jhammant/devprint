# devprint.json — opt-in profile enrichment

Devprint reads everything off the public GitHub API. That gets you ~80% of a useful card. The remaining 20% — the *human* parts (your tagline, what you're available for, career history, talks, writing, endorsements) — comes from a single JSON file in a repo you own.

## How to set it up

1. **Fork [`jhammant/devprint-template`](https://github.com/jhammant/devprint-template)** (or click "Use this template").
2. Edit **`devprint.json`** in your new repo. Every field is optional — fill in only what you care about.
3. Commit + push. Your card at `devprint.dev/<your-username>` updates within ~5 minutes (CloudFront cache).

The repo must stay public, and it must stay named **`devprint-template`** (the default name on fork or template-creation). That's the single path Devprint looks for: `<your-username>/devprint-template/devprint.json`.

## Schema

```json
{
  "tagline": "Hands-on engineering · shipping public",
  "status": "Available · Q3 2026",
  "about": "I write tools for indie devs. Recently obsessed with making CV-style artefacts that update themselves.",
  "now": "Living in London. Reading 'The Goal'. Shipping Devprint.",
  "available": "Advisor chats · short consulting (1-2 weeks)",
  "ask": "If you're building a developer-tooling startup that's hit a stage where you're hiring your first 5 engineers — I'd love to compare notes.",
  "contact": "hi@example.dev",

  "pinned": ["devprint", "factcheck", "agents-md"],
  "skills": ["TypeScript", "AWS", "AI infra"],

  "highlights": [
    "Shipped devprint.dev solo in two weeks",
    "Sold a previous developer-tools startup to $LARGE_CO"
  ],

  "experience": [
    { "role": "Founding engineer", "org": "Cool Co", "from": "2024", "to": "present", "summary": "What I owned. What I shipped. What broke." }
  ],
  "education": [
    { "degree": "BSc Computer Science", "org": "University of X", "date": "2014-2018" }
  ],
  "talks": [
    { "title": "Shipping CVs that update themselves", "venue": "DevConf 2025", "date": "2025-09", "href": "https://example.com" }
  ],
  "writing": [
    { "title": "How Devprint works", "publisher": "Personal blog", "date": "2025-10", "href": "https://example.com" }
  ],
  "endorsements": [
    { "from": "Jane Maintainer", "role": "Eng lead at $CO", "github": "janemaintainer", "blurb": "Ships fast, writes the docs everyone else forgets." }
  ],

  "links": [
    { "name": "Site", "href": "https://example.dev" },
    { "name": "X",    "href": "https://x.com/handle" }
  ]
}
```

### Field reference

| Field          | Type                                | Where it surfaces |
|----------------|--------------------------------------|-------------------|
| `tagline`      | string (≤ 500 chars)                | Title line under your name. |
| `status`       | string (≤ 500 chars)                | Status ribbon. **No status, no ribbon** — Devprint never invents an "Open to work" badge. |
| `about`        | string (≤ 2000 chars)               | Replaces the auto-generated About paragraph. |
| `now`          | string (≤ 500 chars)                | "Right now —" line. |
| `available`    | string (≤ 500 chars)                | Used as the ribbon when `status` is absent. |
| `ask`          | string (≤ 600 chars)                | Headline + body of the closing CTA panel. |
| `contact`      | string (email)                      | Mailto link in the contact rail. |
| `pinned`       | string[]                            | Repo names to feature first. |
| `skills`       | string[] (≤ 16)                     | Skill chips. |
| `highlights`   | string[] (≤ 6)                      | Bulleted "Highlights" section. |
| `experience`   | `{role, org, from, to, summary, href}[]` | "Experience" rows. |
| `education`    | `{org, degree, date}[]`             | "Education" section. |
| `talks`        | `{title, venue, date, href}[]`      | "Talks" section. |
| `writing`      | `{title, publisher, date, href}[]`  | "Writing" section. |
| `endorsements` | `{from, role, github, blurb}[]`     | "What people say" quote cards. |
| `links`        | `{name, href}[]` (≤ 8, https only)  | Outbound links in the contact rail. |

## Safety

- Every string is run through Devprint's PII scrubber.
- Links must be `http://` or `https://`. `javascript:`, `data:`, and relative URLs are rejected.
- Per-field length caps; no novel-length About pages.
- Field values are HTML-escaped on render — you can't sneak markup in.

## What it doesn't do

- Doesn't override stats. Stars, repos, followers, battle-card numbers — still computed from public GitHub data.
- Doesn't change the public-card URL. `devprint.dev/<you>` stays the same.
- Doesn't run on private repos or private profile data — public-data only by design.

## Removing it

Delete the file (or the repo). Next render goes back to public-data-only.
