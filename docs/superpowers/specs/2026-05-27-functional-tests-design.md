# Functional Tests — Design Spec

**Date:** 2026-05-27
**Status:** Approved

## Overview

Add a functional test suite that exercises the full pipeline from a real `requirements.txt` fixture through `runAnalysis()` and into the rendered UI. This sits above the existing unit tests (which test individual modules or components in isolation) and verifies the data flows correctly end-to-end.

## Fixture

**Input:** `fixtures/requirements-new.txt`
```
requests==2.31.0
flask==3.0.3
django==4.2.13
pillow==10.3.0
numpy==1.26.4
sqlalchemy==2.0.30
```

## File

`src/test/functional.test.tsx` — a single test file covering both the analysis shape and the rendered UI.

## Mock Setup

Same `vi.mock` pattern as `src/lib/analysis.test.ts`. Four modules are mocked at the top of the file:

### `../lib/pypi-resolve`
- `resolveRequirementsTxt` → returns all 6 packages at their pinned versions
- `resolveTransitiveDeps` → returns `[]` (transitive deps are out of scope)

### `../lib/osv`
- `queryOsvBatch` → returns a `Map` with 2 CVEs for `django`, empty for all others:
  ```ts
  new Map([
    ['django', [
      { id: 'CVE-2024-27351', severity: 'high', description: 'Potential ReDoS in django.utils.text.Truncator', fixedInVersion: '4.2.14' },
      { id: 'CVE-2024-24680', severity: 'medium', description: 'Denial of service via intcomma template filter', fixedInVersion: '4.2.14' },
    ]],
  ])
  ```

### `../lib/pypi`
- `fetchPackageInfo` → uses `mockImplementation` keyed on package name:
  - `django`: `latestVersion: '5.0.6'`, `lastReleaseDate: '2024-05-07T00:00:00Z'`, non-empty `releases`, `requiresDist: []`
  - all others: `latestVersion` = installed version (clean), `lastReleaseDate` any ISO string, `releases: []`, `requiresDist: []`
- `computeStaleness` → uses `mockImplementation` keyed on version:
  - django (`4.2.13`): `{ patchesBehind: 0, majorsBehind: 1, lastReleaseDate: '2024-05-07T00:00:00Z' }`
  - all others: `{ patchesBehind: 0, majorsBehind: 0, lastReleaseDate: '<any ISO>' }`

### `../lib/cache`
- `analysisGet` → `null` (no cache hit)
- `analysisSave` → resolves void

## Test Groups

### Group 1: Analysis shape

Run `runAnalysis('requirements.txt', content)` once in `beforeAll` (shared across group).

| # | Assertion |
|---|-----------|
| 1 | `analysis.packages` has length 6 |
| 2 | Package names are exactly `['requests', 'flask', 'django', 'pillow', 'numpy', 'sqlalchemy']` (order-insensitive) |
| 3 | Django's `installedVersion` is `'4.2.13'` |
| 4 | Django's `lastReleaseDate` starts with `'2024-05-07'` |
| 5 | Django's `majorsBehind` is `1` |
| 6 | Django has exactly 2 CVEs |
| 7 | Django's CVE ids include `'CVE-2024-27351'` and `'CVE-2024-24680'` |

### Group 2: UI rendering

Use the `Analysis` from Group 1. Render components with `@testing-library/react`.

| # | Component | Assertion |
|---|-----------|-----------|
| 8 | `SplitPanel` | All 6 package names appear in the rendered output |
| 9 | `PackageDetail` (django pkg) | Installed version `4.2.13` is visible |
| 10 | `PackageDetail` (django pkg) | CVE count badge renders `● 2 CVE` |
| 11 | `PackageDetail` (django pkg) | `⬆ MAJOR` status badge is present |
| 12 | `PackageDetail` (django pkg) | CVE id `CVE-2024-27351` is visible |

## Notes

- `SplitPanel` auto-selects `packages[0]` on mount. Tests 9–12 render `PackageDetail` directly with the Django package rather than clicking through the tree — this keeps assertions focused on data correctness, not interaction behaviour.
- `StatusBadge` renders inside `Tooltip` wrappers. The badge text (`● 2 CVE`, `⬆ MAJOR`) is still in the DOM and queryable by `getByText`.
- The `content` variable in the tests is loaded from the real fixture file using `fs.readFileSync` so the test always reflects the actual file on disk.

## Out of Scope

- Transitive dependency rendering
- Filter/sort UI interactions
- Compare mode
- NuGet fixture
