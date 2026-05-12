# Python Dependency Explorer — Design Spec

**Date:** 2026-05-12  
**Status:** Approved

---

## Overview

A locally-hosted Astro website that accepts a `requirements.txt` or `pyproject.toml` upload and renders an interactive dependency tree. For each package the tool shows how many releases behind it is, flags CVEs, and rolls status indicators up the tree so you can assess project health at a glance.

---

## Goals

- Upload a Python dependency file and get a full tree within ~15 seconds
- See CVEs, version staleness, major-version gaps, and EOL packages without leaving the browser
- Cache results locally so repeat visits are instant
- Run with a single `npm run dev` — no external services, no accounts

## Non-Goals

- Multi-user / hosted deployment
- Lock-file analysis (only `requirements.txt` and `pyproject.toml` are in scope)
- Auto-upgrade suggestions or PR generation

---

## Architecture

### Approach: Astro SSR + pip-audit subprocess

Astro runs in SSR mode with the `@astrojs/node` adapter. When a file is uploaded, the server spawns `pip-audit --json` as a subprocess. `pip-audit` uses pip's real resolver, so the dependency tree produced matches what would actually be installed. It also queries OSV.dev for CVEs natively. The PyPI JSON API supplies release lists for version-behind and EOL calculations.

### Data flow

```
Browser upload
  └─ POST /api/analyze
       ├─ Write file to tmp/
       ├─ Check SQLite cache (hash of file contents, TTL 24h)
       ├─ [cache miss] Spawn: pip-audit --json -r <file>
       │     └─ pip-audit → OSV.dev (CVEs)
       ├─ [cache miss] fetch pypi.org/pypi/{name}/json per package
       │     └─ versions list + upload dates
       ├─ Merge results → Analysis record
       ├─ Store in SQLite
       └─ Return { id }
  └─ Redirect → GET /analysis/{id}
```

**Analysis ID** is a SHA-256 hash of the uploaded file contents. Uploading the same file twice returns the cached result immediately.

### External APIs

| API | Purpose | Auth |
|-----|---------|------|
| `pypi.org/pypi/{name}/json` | Full release list + upload dates | None |
| OSV.dev (via pip-audit) | CVE lookup | None |

---

## Dependency Resolution

- **Depth**: Direct dependencies + one level of transitive (grandchildren)
- **Resolver**: pip-audit uses pip's native resolver — version specifiers, extras, and markers are handled correctly
- **File formats**: `requirements.txt` (pip format) and `pyproject.toml` (PEP 621 `[project.dependencies]`)

---

## Data Model

```typescript
interface Package {
  name: string               // "requests"
  installedVersion: string   // "2.28.0"
  latestVersion: string      // "2.32.3"
  patchesBehind: number      // total releases between installed and latest
  majorsBehind: number       // semver major distance
  lastReleaseDate: Date      // date of latest PyPI release
  cves: CVE[]                // CVEs affecting installedVersion
  dependencies: Package[]    // one level deep
  rollup: Rollup             // aggregated from own + children
}

interface CVE {
  id: string                 // "CVE-2023-32681"
  severity: "critical" | "high" | "medium" | "low"
  description: string
  fixedInVersion: string | null
}

interface Rollup {
  totalCves: number          // own + all transitive
  maxPatchesBehind: number   // worst in subtree
  hasMajorBehind: boolean    // any node in subtree is major behind
  hasEol: boolean            // any node in subtree is EOL
}

interface Analysis {
  id: string                 // SHA-256 of file contents
  filename: string
  createdAt: Date
  packages: Package[]        // top-level direct dependencies
}
```

### SQLite schema

```sql
-- Per-package data cache keyed by name@version
CREATE TABLE pkg_cache (
  key        TEXT PRIMARY KEY,   -- "{name}@{version}"
  data       TEXT NOT NULL,      -- JSON blob
  expires_at INTEGER NOT NULL    -- unix timestamp
);

-- Full analysis results
CREATE TABLE analyses (
  id         TEXT PRIMARY KEY,   -- SHA-256 of file
  filename   TEXT NOT NULL,
  data       TEXT NOT NULL,      -- JSON blob (Analysis)
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

---

## Status Indicators

Each package receives a status derived from its own data. The rollup aggregates status across the package and all its transitive children.

| Status | Condition | Colour | Badge |
|--------|-----------|--------|-------|
| Critical | Has CVEs OR majorsBehind ≥ 1 | Red 🔴 | `● N CVE` / `⬆ MAJOR` |
| EOL | No release in 2+ years (checked before Warning) | Grey ⚫ | `☠ EOL Nyr` |
| Warning | patchesBehind ≥ 1 OR last release > 1 year ago (no CVEs, no major gap) | Yellow 🟡 | `+N ver` |
| Healthy | patchesBehind = 0, no CVEs, not EOL | Green 🟢 | `✓` |

Priority order for evaluation: Critical → EOL → Warning → Healthy. A package that is both EOL and has CVEs shows Critical.

The `⬆ MAJOR` pill is always shown as an additional badge — it stacks alongside the colour status, it does not replace it.

**Rollup on tree nodes**: A collapsed parent shows the worst status among itself and all children, plus the total CVE count and maximum patches-behind from its subtree.

---

## Pages & Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Upload page + recent analyses list |
| `/api/analyze` | POST | Receive file, run analysis, return `{ id }` |
| `/analysis/[id]` | GET | Split-panel analysis view (SSR) |
| `/api/analysis/[id]` | GET | JSON data endpoint consumed by React islands |
| `/api/analysis/[id]` | DELETE | Clear a single cached analysis |

### Page 1 — Upload (`/`)

- Drag-and-drop zone accepting `.txt` and `.toml` files
- Browse-files fallback button
- "Recent analyses" list below, showing filename, CVE count, and age of each cached result
- Clicking a recent analysis navigates directly to `/analysis/{id}`

### Page 2 — Analysis (`/analysis/[id]`)

**Summary strip** (above the split panel):
- Total CVEs across all packages
- Count of packages one or more major versions behind
- Count of EOL packages
- Ratio of up-to-date packages (e.g. `6 / 11`)

**Left panel — Dependency Tree** (React island):
- Collapsible tree, two levels deep (direct → transitive)
- Each row shows: package name, status colour, CVE pill, version-behind pill
- Collapsed nodes show rollup badges aggregated from children
- Clicking a row selects it and loads its detail in the right panel

**Right panel — Package Detail** (React island):
- Package name, installed version, latest version
- Version timeline strip: visual sequence from installed → latest with each intermediate release shown
- CVE list: ID, severity, description, fixed-in version for each CVE
- Last release date; EOL warning if > 2 years

---

## File Structure

```
project-explorer/
├── src/
│   ├── pages/
│   │   ├── index.astro              # upload + recent analyses
│   │   ├── analysis/
│   │   │   └── [id].astro           # split panel view
│   │   └── api/
│   │       ├── analyze.ts           # POST handler
│   │       └── analysis/
│   │           └── [id].ts          # GET + DELETE handlers
│   ├── components/
│   │   ├── DependencyTree.tsx       # React island — left panel
│   │   ├── PackageDetail.tsx        # React island — right panel
│   │   ├── StatusBadge.tsx          # CVE / version pill component
│   │   └── UploadZone.tsx           # React island — drag-and-drop
│   └── lib/
│       ├── pip-audit.ts             # spawn pip-audit, parse stdout JSON
│       ├── pypi.ts                  # fetch release list, compute staleness
│       ├── cache.ts                 # SQLite read/write with TTL
│       ├── analysis.ts              # merge pip-audit + pypi → Analysis
│       └── indicators.ts            # status rules + rollup logic
├── data/                            # SQLite file (gitignored)
├── astro.config.mjs
└── tailwind.config.mjs
```

---

## Tech Stack

| Concern | Choice | Reason |
|---------|--------|--------|
| Framework | Astro SSR + `@astrojs/node` | SSR required for file upload handling and SQLite |
| Interactive UI | React islands (`client:load`) | Tree and detail panel need interactivity; rest is static |
| Styling | Tailwind CSS | Dark-theme utility classes, no component library needed |
| Database | `better-sqlite3` | Synchronous SQLite — no async complexity, no external process |
| Dep resolution + CVEs | `pip-audit` CLI subprocess | Uses pip's real resolver; OSV.dev CVE lookup built-in |
| Version data | PyPI JSON API | Free, no auth, full release history with upload dates |

---

## Error Handling

- **pip-audit not found**: Return a clear error page with install instructions (`pip install pip-audit`)
- **pip-audit resolution failure**: Surface stderr to the user with the raw pip error message (e.g. conflicting version specifiers)
- **PyPI fetch failure**: Log and skip; show "version data unavailable" in the UI rather than failing the whole analysis
- **Analysis not found**: `/analysis/{id}` returns a 404 page with a link back to upload

---

## Prerequisites

The user must have the following installed locally:

- Node.js ≥ 18
- Python ≥ 3.8 with `pip-audit` (`pip install pip-audit`)
