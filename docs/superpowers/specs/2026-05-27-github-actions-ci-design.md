# GitHub Actions CI — Design Spec

**Date:** 2026-05-27
**Status:** Approved

## Overview

Add a CI workflow that runs on every push to `master` and every pull request targeting `master`. The workflow verifies type correctness, test passage, and build integrity in a single sequential job.

## Trigger

```yaml
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
```

## Workflow: `.github/workflows/ci.yml`

### Job: `ci`

- **Runner:** `ubuntu-latest`
- **Node version:** 26 (matches local development environment)
- **Dependency install:** `npm ci` (clean, reproducible installs from lockfile)

### Steps (sequential, fail-fast)

| # | Step | Command | Purpose |
|---|------|---------|---------|
| 1 | Checkout | `actions/checkout@v4` | Fetch repo at the triggering commit |
| 2 | Setup Node | `actions/setup-node@v4` (Node 26, npm cache) | Install Node, restore dependency cache |
| 3 | Install | `npm ci` | Clean install from `package-lock.json` |
| 4 | Type check | `npx astro check` | Catch TypeScript and Astro template type errors |
| 5 | Test | `npm test` | Run full Vitest suite (12 test files, jsdom env) |
| 6 | Build | `npm run build` | Compile SSR output with Cloudflare adapter |

## Decisions

- **Sequential over parallel:** The test suite is small; splitting into parallel jobs would add complexity and duplicate `npm ci` without meaningful time savings.
- **Node 26:** Matches the developer's local environment to avoid environment-specific failures.
- **`npm ci` over `npm install`:** Ensures the lockfile is the source of truth in CI, prevents accidental dependency drift.
- **`npx astro check` before tests:** Type errors are cheap to surface early; failing fast avoids running the full suite against broken types.
- **No deployment step:** This workflow is CI only. Deployment to Cloudflare Pages is handled separately (Cloudflare's own Git integration).

## Out of Scope

- Deployment / Cloudflare Pages integration
- Node version matrix testing
- Dependency vulnerability scanning (handled by the app itself via osv.dev)
- Release automation
