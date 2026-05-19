# README Rewrite Design

**Date:** 2026-05-19
**Goal:** Replace the current technical CLAUDE.md-style README with a human, portfolio-friendly README that includes screenshots.

## Audience & Tone

Personal project / portfolio. First-person, conversational, honest. The reader might be a potential employer, a collaborator, or someone who wants to run it themselves. Not aimed at open-source contributors — no contribution guide needed.

## Motivation to Surface

Built as a scratch-your-own-itch tool: needed a fast way to audit Python and NuGet dependency files at work without cross-referencing multiple tools.

## Primary Goals

1. Show what the app does and why it exists (features + problem)
2. Include real screenshots so readers can see it before cloning
3. Give enough technical signal to demonstrate stack competence (portfolio)

## Structure (Option A — Story-first)

### 1. Header + opener
- Project name
- 2–3 sentence first-person origin story: "I kept needing a fast way to audit Python and NuGet dependency files at work..."
- Screenshot: upload / home page

### 2. What it does
Feature list covering:
- CVE scan via osv.dev
- Version staleness (patch / minor / major)
- Status classification (critical / EOL / warning / healthy)
- Transitive dependency surfacing (one level)
- Compare mode (two analyses side-by-side)
- Cached results (SHA-256 content-addressed, no duplicate API calls)
- Screenshots: analysis results page, compare page

### 3. Running it locally
Minimal quick-start:
```bash
npm install
npm run dev
```
Note on Cloudflare Pages + D1 for production deploy.

### 4. Stack / How it's built
- Astro 5 SSR + React 18 + Tailwind 3
- Cloudflare Pages + D1 (SQLite)
- PyPI + NuGet APIs → osv.dev batch CVE lookup
- Vitest with better-sqlite3 D1 shim
- One interesting implementation detail: SHA-256 content-addressed analysis IDs for deduplication

## Screenshots Required

Three screenshots to capture:
1. **Home / upload page** — shows the upload zone and recent analyses list
2. **Analysis results page** — shows package list with CVE badges, status indicators, version info
3. **Compare page** — shows two analyses side-by-side

Screenshots should be taken from the running dev server and saved to `public/screenshots/` or a top-level `screenshots/` directory, then referenced in the README with relative paths.

## What to Keep vs. Remove

- **Remove** from README: all CLAUDE.md internals (D1 shim details, test conventions, Tailwind token list, key conventions section)
- **Keep** the CLAUDE.md file as-is — it remains the developer/AI-assistant reference
- The README replaces the current content entirely

## Out of Scope

- Contribution guide
- License section (unless user adds one)
- Badges (CI status, npm version, etc.)
- Detailed deployment walkthrough
