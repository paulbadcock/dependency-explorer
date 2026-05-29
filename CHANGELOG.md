# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-05-28

### Added
- Inline rename for saved analyses — click the pencil icon on a row in the Recent analyses list to give the run a friendly name. The label is persisted via a new `PATCH /api/analysis/:id` endpoint, survives reloads, and is shown as the row's primary title with the original filename kept as a sub-line. Submitting an empty value clears the label and the row falls back to the filename.

## [1.0.5] - 2026-05-27

### Changed
- Upgraded `astro` 6.3.6 → 6.3.8 (patch)
- Upgraded `@astrojs/cloudflare` 13.5.3 → 13.5.5 (patch)
- Upgraded `@cloudflare/workers-types` 4.20260521.1 → 4.20260527.1 (patch)
- Upgraded `wrangler` 4.93.1 → 4.95.0 (minor)

## [1.0.4] - 2026-05-27

### Changed
- Added release checklist to README so all contributors follow the same release workflow

## [1.0.3] - 2026-05-27

### Added
- GitHub Actions CI workflow — runs `astro check`, `vitest`, and `astro build` on every push and pull request to `master`

### Fixed
- Replaced `@astrojs/tailwind` with a direct PostCSS integration; `@astrojs/tailwind` never declared Astro 6 compatibility, causing `npm ci` to fail with an ERESOLVE peer dependency conflict
- Removed unused `cveDelta` variable in the compare page that produced a TypeScript hint

### Changed
- Upgraded `jsdom` 25 → 29, removing the `whatwg-encoding` deprecation warning
- CI workflow now opts into Node.js 24 for GitHub Actions runners ahead of the June 2026 forced migration

## [1.0.2] - 2026-05-21

### Fixed
- README: added missing Registry links feature bullet (PyPI/NuGet links per package name)
- README: expanded CVE scan bullet to mention clickable osv.dev and NVD deep links per CVE
- README: corrected stack from Astro 5 to Astro 6

## [1.0.1] - 2026-05-21

### Security
- Upgraded `vitest` from 2.1.9 to 4.1.7 to resolve [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) — esbuild ≤0.24.2 allowed any website to send requests to the dev server and read the response (dev-only, not a production risk)
- Added `@testing-library/dom` as an explicit dev dependency (previously an implicit transitive dep)

## [1.0.0] - 2026-05-21

Initial stable release, establishing the semver baseline.

### Added
- CVE scan via [osv.dev](https://osv.dev) batch API for every package in the lockfile
- Version staleness check (patch / minor / major behind latest) using PyPI and NuGet metadata APIs
- Per-package status classification: critical / EOL / warning / healthy
- One level of transitive dependency surfacing per package
- Compare mode — diff two analyses side-by-side to see what changed between lockfiles
- Result caching keyed on SHA-256 of raw file content; same upload always returns instantly
- Package metadata TTL-cached in Cloudflare D1 to avoid hammering upstream APIs
- Support for `requirements.txt`, `poetry.lock`, and `packages.lock.json`
- Animated GIF feature tour in README

### Changed
- Upgraded to Astro 6, Wrangler 4, and `@astrojs/cloudflare` 13
- Middleware updated to use `cloudflare:workers` env API required by Astro 6
