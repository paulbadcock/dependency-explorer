# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
