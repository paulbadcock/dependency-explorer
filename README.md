# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Astro dev server with Cloudflare platform proxy (hot-reload)
npm run build        # Production build → ./dist/
npm run preview      # Serve ./dist/ via wrangler (closest to prod)

# Tests
npm test             # Run all tests once (vitest run)
npm run test:watch   # Vitest in watch mode

# Run a single test file
npx vitest run src/lib/analysis.test.ts
```

## Architecture

**Stack:** Astro 5 (SSR) + React 18 + Tailwind 3, deployed to Cloudflare Pages. The Cloudflare adapter (`@astrojs/cloudflare`) is required; `astro dev` uses `platformProxy` to expose the D1 binding locally.

**Database:** Cloudflare D1 (SQLite). The binding is named `DB` and is injected into `context.locals.runtime.env`. `src/middleware.ts` initialises the singleton and runs `ensureSchema()` before any request. Two tables: `pkg_cache` (TTL-based external API cache) and `analyses` (stored analysis results).

**Analysis pipeline** (`src/lib/analysis.ts`):
1. Detect file type from filename (`packages.lock.json` → NuGet, else Python)
2. Parse lockfile / `requirements.txt` → resolve pinned versions
3. Fetch PyPI/NuGet package metadata in parallel
4. Query `osv.dev` batch API for CVEs
5. Build nested `Package[]` (direct deps with one level of transitive deps each)
6. Persist via `analysisSave()`; cache-hit skips re-analysis

**Data types** (`src/lib/types.ts`): `Analysis` → `Package[]` → `CVE[]`. `Rollup` is a pre-computed summary (CVE count, staleness flags) stored inside each `Package` so the UI never recomputes it.

**Status classification** (`src/lib/indicators.ts`): `getPackageStatus()` returns `critical | eol | warning | healthy`. Rules: any CVE or 1+ major behind → critical; no release in >2 yr → eol; 1+ patch behind or >1 yr stale → warning.

**Pages:**
- `src/pages/index.astro` — upload + recent analyses list
- `src/pages/analysis/[id].astro` — single analysis detail
- `src/pages/compare/[id1]/[id2].astro` — side-by-side diff (`src/lib/compare.ts`)
- `src/pages/api/analyze.ts` (POST) — accepts multipart file, calls `runAnalysis()`, redirects to `/analysis/:id`
- `src/pages/api/analysis/[id].ts` (DELETE) — removes an analysis from D1

**Testing:** Vitest + jsdom. `src/test-utils/d1-shim.ts` provides a `better-sqlite3`-backed `D1Database` compatible object for tests — this is the only way to test `cache.ts` logic in Node. Tests call `resetForTest(createD1Shim())` to get a clean in-memory DB per test file.

## Key Conventions

- All package name lookups are **lowercased** (`name.toLowerCase()`); normalise before any Map lookup.
- `releases[]` stored in D1 is trimmed to the installed→latest range for direct deps and collapsed to a single entry for transitive deps (see `trimReleasesForStorage` in `cache.ts`).
- The analysis `id` is a 16-char hex SHA-256 of the raw file content — uploading the same file twice always hits the cache.
- Tailwind uses custom semantic tokens (`surface`, `panel`, `border`, `muted`, `red.badge`, etc.) defined in `tailwind.config.mjs`. Always use these instead of raw colours.
