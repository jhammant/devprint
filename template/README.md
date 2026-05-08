# Your Devprint

This repo customises your card at **devprint.dev/&lt;your-username&gt;**.

## What this repo is

Devprint reads `devprint.json` from this repo and merges its contents into your live card — your tagline, what you're available for, career history, talks, writing, endorsements, links. Public GitHub data does the rest of the work.

The repo's name is `devprint` (not `.github` or `<username>/<username>`) because Devprint also looks here, and it's the easiest path: clone our template once, edit one file, push.

## How to use it

1. Open [`devprint.json`](./devprint.json) in this repo.
2. Edit the fields you want to fill in. **Every field is optional** — Devprint shows what you give it, hides what you don't.
3. Commit + push. Your card at `devprint.dev/<your-username>` updates within ~5 minutes (CloudFront cache).

## What you can put in it

See the [full schema reference](https://github.com/jhammant/devprint/blob/main/docs/DEVPRINT_JSON.md) for the complete list, or just look at `devprint.json` here for an annotated example.

The headline fields:

| Field | What it does |
|---|---|
| `tagline` | Title line under your name |
| `status` / `available` | The status ribbon (no ribbon by default — only shown when you set it) |
| `about` | Replaces the auto-generated About paragraph |
| `experience` | Career rows with role / org / dates |
| `education` | Schools and degrees |
| `pinned` | Repos to feature first in Selected Works |
| `highlights` | Bulleted Highlights section |
| `talks` / `writing` / `endorsements` | What it says on the tin |
| `links` | The link rail (https only) |

## Safety

- Every string runs through Devprint's PII scrubber.
- HTML is escaped on render — you can't sneak markup in via your tagline.
- Links must be `http://` or `https://`. `javascript:`, `data:`, relative URLs are dropped.
- Field lengths are capped (no novel-length about pages).

## Removing it

Delete the file, or delete this repo. Your card goes back to public-data-only.

---

Built on [Devprint](https://devprint.dev) — the GitHub fingerprint generator. The Devprint codebase is at [github.com/jhammant/devprint](https://github.com/jhammant/devprint).
