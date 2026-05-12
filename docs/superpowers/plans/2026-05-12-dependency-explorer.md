# Python Dependency Explorer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally-hosted Astro SSR website that accepts `requirements.txt` or `pyproject.toml` uploads, resolves dependency trees via pip-audit, and displays CVEs and version staleness in an interactive split-panel UI.

**Architecture:** Astro SSR (Node adapter) handles routing and file uploads. A `pip-audit` subprocess provides dependency resolution and CVE data via OSV.dev. PyPI JSON API supplies version history and dependency relationships. Results are cached in SQLite with a 24-hour TTL.

**Tech Stack:** Astro 5, React 18 islands, Tailwind CSS 3, better-sqlite3, smol-toml, pip-audit CLI, Vitest 2, @testing-library/react

---

## File Map

```
project-explorer/
├── src/
│   ├── lib/
│   │   ├── types.ts              # shared interfaces (Package, CVE, Analysis, etc.)
│   │   ├── cache.ts              # SQLite read/write with TTL — pkg_cache + analyses tables
│   │   ├── parser.ts             # parse requirements.txt / pyproject.toml -> dep names + req txt
│   │   ├── pip-audit.ts          # invoke pip-audit via execFile, parse stdout JSON
│   │   ├── pypi.ts               # fetch pypi.org/pypi/{name}/json, compute staleness
│   │   ├── indicators.ts         # getPackageStatus(), computeRollup()
│   │   └── analysis.ts           # orchestrate pip-audit + pypi -> Analysis; read/write cache
│   ├── utils/
│   │   └── execFileNoThrow.ts    # safe execFile wrapper (no shell, structured output)
│   ├── pages/
│   │   ├── index.astro           # upload page + recent analyses list
│   │   ├── analysis/
│   │   │   └── [id].astro        # split-panel analysis view (SSR, passes data to islands)
│   │   └── api/
│   │       ├── analyze.ts        # POST: receive file, run analysis, redirect
│   │       └── analysis/
│   │           └── [id].ts       # GET: return JSON; DELETE: remove cached analysis
│   ├── components/
│   │   ├── StatusBadge.tsx       # pill badges: CVE count, version-behind, EOL, MAJOR
│   │   ├── UploadZone.tsx        # drag-and-drop file upload island
│   │   ├── DependencyTree.tsx    # collapsible left-panel tree with rollup badges
│   │   ├── PackageDetail.tsx     # right-panel CVE list + version info
│   │   └── SplitPanel.tsx        # state container for selected package, renders both panels
│   └── test/
│       └── setup.ts              # @testing-library/jest-dom import
├── data/                         # SQLite file lives here (.gitignored)
├── astro.config.mjs
├── tailwind.config.mjs
├── vitest.config.ts
└── .gitignore
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tailwind.config.mjs`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `.gitignore`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "project-explorer",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "node ./dist/server/entry.mjs",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@astrojs/node": "^9.0.0",
    "@astrojs/react": "^4.0.0",
    "@astrojs/tailwind": "^6.0.0",
    "astro": "^5.0.0",
    "better-sqlite3": "^9.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "smol-toml": "^1.3.0",
    "tailwindcss": "^3.4.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Write astro.config.mjs**

```js
import { defineConfig } from 'astro/config'
import node from '@astrojs/node'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react(), tailwind()],
})
```

- [ ] **Step 3: Write tailwind.config.mjs**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: '#0d1117',
        panel: '#161b22',
        border: '#21262d',
        muted: '#8b949e',
        red: { badge: '#2d0f0f', text: '#f85149' },
        yellow: { badge: '#2d1f0f', text: '#e3b341' },
        green: { badge: '#0f2d12', text: '#3fb950' },
        purple: { text: '#a371f7' },
      },
      fontFamily: { mono: ['JetBrains Mono', 'ui-monospace', 'monospace'] },
    },
  },
}
```

- [ ] **Step 4: Write vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 5: Write src/test/setup.ts**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Write .gitignore**

```
node_modules/
dist/
data/
.env
.superpowers/
```

- [ ] **Step 7: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 8: Verify Astro starts**

Create a minimal `src/pages/index.astro`:

```astro
---
---
<html><body><h1>hello</h1></body></html>
```

Run: `npm run dev`
Expected: `http://localhost:4321` responds with "hello". Stop the server.

- [ ] **Step 9: Commit**

```bash
git add package.json astro.config.mjs tailwind.config.mjs vitest.config.ts src/test/setup.ts .gitignore src/pages/index.astro
git commit -m "feat: scaffold Astro SSR project with React, Tailwind, Vitest"
```

---

## Task 2: execFileNoThrow Utility

**Files:**
- Create: `src/utils/execFileNoThrow.ts`
- Create: `src/utils/execFileNoThrow.test.ts`

This utility wraps Node's `execFile` (which does NOT use a shell, preventing command injection) and returns a structured result rather than throwing. All subprocess calls in this project go through this utility.

- [ ] **Step 1: Write failing test**

```ts
// src/utils/execFileNoThrow.test.ts
import { describe, it, expect } from 'vitest'
import { execFileNoThrow } from './execFileNoThrow'

describe('execFileNoThrow', () => {
  it('returns stdout on success', async () => {
    const result = await execFileNoThrow('node', ['-e', 'process.stdout.write("hello")'])
    expect(result.stdout).toBe('hello')
    expect(result.status).toBe(0)
  })

  it('returns stderr and non-zero status on failure', async () => {
    const result = await execFileNoThrow('node', ['-e', 'process.exit(1)'])
    expect(result.status).toBe(1)
  })

  it('returns notFound=true when the executable does not exist', async () => {
    const result = await execFileNoThrow('this-binary-does-not-exist-xyz', [])
    expect(result.notFound).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- execFileNoThrow.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write src/utils/execFileNoThrow.ts**

```ts
import { execFile } from 'child_process'

export interface ExecResult {
  stdout: string
  stderr: string
  status: number
  notFound: boolean
}

export function execFileNoThrow(
  file: string,
  args: string[]
): Promise<ExecResult> {
  return new Promise(resolve => {
    execFile(file, args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        resolve({ stdout: '', stderr: '', status: -1, notFound: true })
        return
      }
      resolve({
        stdout: stdout ?? '',
        stderr: stderr ?? '',
        status: (err as NodeJS.ErrnoException & { code?: number })?.code ?? 0,
        notFound: false,
      })
    })
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- execFileNoThrow.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/execFileNoThrow.ts src/utils/execFileNoThrow.test.ts
git commit -m "feat: add safe execFileNoThrow subprocess utility"
```

---

## Task 3: Shared Types + SQLite Cache

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/cache.ts`
- Create: `src/lib/cache.test.ts`

- [ ] **Step 1: Write src/lib/types.ts**

```ts
export interface CVE {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown'
  description: string
  fixedInVersion: string | null
}

export interface Rollup {
  totalCves: number
  maxPatchesBehind: number
  hasMajorBehind: boolean
  hasEol: boolean
}

export interface Package {
  name: string
  installedVersion: string
  latestVersion: string
  patchesBehind: number
  majorsBehind: number
  lastReleaseDate: string   // ISO string of the latest PyPI release
  cves: CVE[]
  dependencies: Package[]   // one level deep (transitive)
  rollup: Rollup
}

export interface Analysis {
  id: string
  filename: string
  createdAt: string         // ISO string
  packages: Package[]       // direct dependencies only at top level
}

export interface RecentAnalysis {
  id: string
  filename: string
  createdAt: number         // unix ms
  totalCves: number
}

// pip-audit --json output shapes
export interface PipAuditVuln {
  id: string
  fix_versions: string[]
  aliases: string[]
  description: string
}

export interface PipAuditDependency {
  name: string
  version: string
  vulns: PipAuditVuln[]
}

export interface PipAuditOutput {
  dependencies: PipAuditDependency[]
}

// PyPI JSON API shapes
export interface PyPIRelease {
  version: string
  uploadTime: string        // ISO string
}

export interface PyPIPackageInfo {
  latestVersion: string
  releases: PyPIRelease[]   // sorted oldest to newest, pre-releases excluded
  requiresDist: string[]    // PEP 508 dep strings for the installed version
  lastReleaseDate: string   // ISO string of the most recent stable release
}
```

- [ ] **Step 2: Write failing tests for cache**

```ts
// src/lib/cache.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import type { Analysis } from './types'

// resetForTest must be called before each test to get a fresh in-memory db
let cache: typeof import('./cache')

beforeEach(async () => {
  cache = await import('./cache')
  cache.resetForTest()
})

const mockAnalysis: Analysis = {
  id: 'abc123',
  filename: 'requirements.txt',
  createdAt: new Date().toISOString(),
  packages: [],
}

describe('pkgCacheGet / pkgCacheSet', () => {
  it('returns null for missing key', () => {
    expect(cache.pkgCacheGet('missing')).toBeNull()
  })

  it('returns stored value within TTL', () => {
    cache.pkgCacheSet('k1', { foo: 'bar' }, 60_000)
    expect(cache.pkgCacheGet('k1')).toEqual({ foo: 'bar' })
  })

  it('returns null after TTL expires', () => {
    cache.pkgCacheSet('k2', { x: 1 }, -1)  // TTL of -1ms is already expired
    expect(cache.pkgCacheGet('k2')).toBeNull()
  })
})

describe('analysisSave / analysisGet / analysisListRecent / analysisDelete', () => {
  it('round-trips an analysis', () => {
    cache.analysisSave(mockAnalysis, 'requirements.txt')
    expect(cache.analysisGet('abc123')).toEqual(mockAnalysis)
  })

  it('lists recent analyses', () => {
    cache.analysisSave(mockAnalysis, 'requirements.txt')
    const recent = cache.analysisListRecent()
    expect(recent).toHaveLength(1)
    expect(recent[0]!.id).toBe('abc123')
  })

  it('deletes an analysis', () => {
    cache.analysisSave(mockAnalysis, 'requirements.txt')
    cache.analysisDelete('abc123')
    expect(cache.analysisGet('abc123')).toBeNull()
  })
})
```

- [ ] **Step 3: Run to verify failure**

```bash
npm test -- cache.test.ts
```

Expected: FAIL — `cache` module not found.

- [ ] **Step 4: Write src/lib/cache.ts**

```ts
import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { join } from 'path'
import type { Analysis, RecentAnalysis } from './types'

const DB_PATH = join(process.cwd(), 'data', 'cache.db')

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (_db) return _db
  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  _db = new Database(DB_PATH)
  applySchema(_db)
  return _db
}

function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pkg_cache (
      key        TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS analyses (
      id         TEXT PRIMARY KEY,
      filename   TEXT NOT NULL,
      data       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)
}

export function resetForTest(): void {
  if (_db) { _db.close(); _db = null }
  _db = new Database(':memory:')
  applySchema(_db)
}

export function pkgCacheGet<T>(key: string): T | null {
  const row = getDb()
    .prepare('SELECT data, expires_at FROM pkg_cache WHERE key = ?')
    .get(key) as { data: string; expires_at: number } | undefined
  if (!row || row.expires_at < Date.now()) return null
  return JSON.parse(row.data) as T
}

export function pkgCacheSet(key: string, data: unknown, ttlMs: number): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO pkg_cache (key, data, expires_at) VALUES (?, ?, ?)')
    .run(key, JSON.stringify(data), Date.now() + ttlMs)
}

export function analysisSave(analysis: Analysis, filename: string): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO analyses (id, filename, data, created_at) VALUES (?, ?, ?, ?)')
    .run(analysis.id, filename, JSON.stringify(analysis), Date.now())
}

export function analysisGet(id: string): Analysis | null {
  const row = getDb()
    .prepare('SELECT data FROM analyses WHERE id = ?')
    .get(id) as { data: string } | undefined
  if (!row) return null
  return JSON.parse(row.data) as Analysis
}

export function analysisListRecent(limit = 10): RecentAnalysis[] {
  const rows = getDb()
    .prepare('SELECT id, filename, created_at, data FROM analyses ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Array<{ id: string; filename: string; created_at: number; data: string }>
  return rows.map(r => {
    const a = JSON.parse(r.data) as Analysis
    const totalCves = a.packages.reduce((sum, p) => sum + p.rollup.totalCves, 0)
    return { id: r.id, filename: r.filename, createdAt: r.created_at, totalCves }
  })
}

export function analysisDelete(id: string): void {
  getDb().prepare('DELETE FROM analyses WHERE id = ?').run(id)
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- cache.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/cache.ts src/lib/cache.test.ts
git commit -m "feat: add shared types and SQLite cache module"
```

---

## Task 4: File Parser

**Files:**
- Create: `src/lib/parser.ts`
- Create: `src/lib/parser.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseDirectDepNames, toRequirementsTxt } from './parser'

const REQUIREMENTS_TXT = `
# a comment
requests>=2.28.0
fastapi==0.100.0
  httpx  
-r other.txt
--index-url https://example.com
`

const PYPROJECT_TOML = `
[project]
name = "my-app"
dependencies = [
  "requests>=2.28.0",
  "fastapi[standard]==0.100.0",
  "httpx",
]
`

describe('parseDirectDepNames', () => {
  it('extracts names from requirements.txt, skipping comments and options', () => {
    expect(parseDirectDepNames('requirements.txt', REQUIREMENTS_TXT)).toEqual(['requests', 'fastapi', 'httpx'])
  })

  it('extracts names from pyproject.toml [project.dependencies]', () => {
    expect(parseDirectDepNames('pyproject.toml', PYPROJECT_TOML)).toEqual(['requests', 'fastapi', 'httpx'])
  })

  it('returns lowercase names', () => {
    expect(parseDirectDepNames('requirements.txt', 'Requests>=2.0\n')).toEqual(['requests'])
  })
})

describe('toRequirementsTxt', () => {
  it('returns requirements.txt content unchanged', () => {
    expect(toRequirementsTxt('requirements.txt', 'requests>=2.0\n')).toBe('requests>=2.0\n')
  })

  it('converts pyproject.toml to requirements.txt format', () => {
    const result = toRequirementsTxt('pyproject.toml', PYPROJECT_TOML)
    expect(result).toContain('requests>=2.28.0')
    expect(result).toContain('fastapi[standard]==0.100.0')
    expect(result).toContain('httpx')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- parser.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write src/lib/parser.ts**

```ts
import { parse } from 'smol-toml'

interface PyProjectToml {
  project?: { dependencies?: string[] }
}

function depNameFrom(specifier: string): string {
  return specifier.split(/[>=<!~\[;\s]/)[0]!.trim().toLowerCase()
}

export function parseDirectDepNames(filename: string, content: string): string[] {
  if (filename.endsWith('.toml')) {
    const parsed = parse(content) as PyProjectToml
    return (parsed.project?.dependencies ?? []).map(depNameFrom)
  }
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('--'))
    .map(depNameFrom)
}

export function toRequirementsTxt(filename: string, content: string): string {
  if (!filename.endsWith('.toml')) return content
  const parsed = parse(content) as PyProjectToml
  return (parsed.project?.dependencies ?? []).join('\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- parser.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parser.ts src/lib/parser.test.ts
git commit -m "feat: add requirements.txt and pyproject.toml parser"
```

---

## Task 5: pip-audit Module

**Files:**
- Create: `src/lib/pip-audit.ts`
- Create: `src/lib/pip-audit.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/pip-audit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../utils/execFileNoThrow', () => ({
  execFileNoThrow: vi.fn(),
}))

import { execFileNoThrow } from '../utils/execFileNoThrow'
import { runPipAudit, PipAuditNotFoundError } from './pip-audit'
import type { ExecResult } from '../utils/execFileNoThrow'

const VALID_JSON = JSON.stringify({
  dependencies: [
    { name: 'requests', version: '2.28.0', vulns: [] },
    { name: 'urllib3', version: '1.26.18', vulns: [
      { id: 'GHSA-v845', fix_versions: ['1.26.19'], aliases: ['CVE-2023-45803'], description: 'urllib3 test vuln' }
    ]},
  ],
})

beforeEach(() => vi.clearAllMocks())

describe('runPipAudit', () => {
  it('parses valid pip-audit JSON output', async () => {
    vi.mocked(execFileNoThrow).mockResolvedValue(
      { stdout: VALID_JSON, stderr: '', status: 1, notFound: false }
    )
    const deps = await runPipAudit('requests>=2.28.0\n')
    expect(deps).toHaveLength(2)
    expect(deps[0]!.name).toBe('requests')
    expect(deps[1]!.vulns).toHaveLength(1)
  })

  it('throws PipAuditNotFoundError when pip-audit is not installed', async () => {
    vi.mocked(execFileNoThrow).mockResolvedValue(
      { stdout: '', stderr: '', status: -1, notFound: true }
    )
    await expect(runPipAudit('requests\n')).rejects.toBeInstanceOf(PipAuditNotFoundError)
  })

  it('throws on empty stdout with no valid JSON', async () => {
    vi.mocked(execFileNoThrow).mockResolvedValue(
      { stdout: '', stderr: 'ERROR: could not find a version', status: 2, notFound: false }
    )
    await expect(runPipAudit('nonexistent-pkg==999\n')).rejects.toThrow('could not find a version')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- pip-audit.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write src/lib/pip-audit.ts**

```ts
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFileNoThrow } from '../utils/execFileNoThrow'
import type { PipAuditDependency, PipAuditOutput } from './types'

export class PipAuditNotFoundError extends Error {
  constructor() {
    super('pip-audit not found. Install it with: pip install pip-audit')
    this.name = 'PipAuditNotFoundError'
  }
}

export async function runPipAudit(requirementsTxt: string): Promise<PipAuditDependency[]> {
  const dir = mkdtempSync(join(tmpdir(), 'dep-explorer-'))
  const filePath = join(dir, 'requirements.txt')
  writeFileSync(filePath, requirementsTxt, 'utf8')

  try {
    const result = await execFileNoThrow('pip-audit', ['--json', '-r', filePath])

    if (result.notFound) throw new PipAuditNotFoundError()

    if (!result.stdout.trim()) {
      throw new Error(result.stderr.trim() || 'pip-audit produced no output')
    }

    const parsed = JSON.parse(result.stdout) as PipAuditOutput
    return parsed.dependencies
  } finally {
    try { unlinkSync(filePath) } catch { /* best-effort cleanup */ }
    try { unlinkSync(dir) } catch { /* best-effort cleanup */ }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- pip-audit.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pip-audit.ts src/lib/pip-audit.test.ts
git commit -m "feat: add pip-audit subprocess module using execFileNoThrow"
```

---

## Task 6: PyPI Client

**Files:**
- Create: `src/lib/pypi.ts`
- Create: `src/lib/pypi.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/pypi.test.ts
import { describe, it, expect } from 'vitest'
import { computeStaleness } from './pypi'
import type { PyPIPackageInfo } from './types'

const mockInfo: PyPIPackageInfo = {
  latestVersion: '2.32.3',
  lastReleaseDate: '2024-05-01T00:00:00Z',
  requiresDist: ['urllib3>=1.21.1', 'certifi>=2017.4.17'],
  releases: [
    { version: '2.28.0', uploadTime: '2022-06-01T00:00:00Z' },
    { version: '2.29.0', uploadTime: '2022-09-01T00:00:00Z' },
    { version: '2.30.0', uploadTime: '2023-01-01T00:00:00Z' },
    { version: '2.31.0', uploadTime: '2023-05-01T00:00:00Z' },
    { version: '2.32.3', uploadTime: '2024-05-01T00:00:00Z' },
  ],
}

describe('computeStaleness', () => {
  it('returns 0 patchesBehind when on latest', () => {
    const result = computeStaleness('2.32.3', mockInfo)
    expect(result.patchesBehind).toBe(0)
    expect(result.majorsBehind).toBe(0)
  })

  it('counts releases between installed and latest', () => {
    expect(computeStaleness('2.28.0', mockInfo).patchesBehind).toBe(4)
  })

  it('calculates majorsBehind from semver', () => {
    const info: PyPIPackageInfo = {
      ...mockInfo,
      latestVersion: '3.0.0',
      releases: [
        { version: '2.28.0', uploadTime: '2022-06-01T00:00:00Z' },
        { version: '3.0.0', uploadTime: '2024-01-01T00:00:00Z' },
      ],
    }
    const result = computeStaleness('2.28.0', info)
    expect(result.majorsBehind).toBe(1)
    expect(result.patchesBehind).toBe(1)
  })

  it('returns 0 patchesBehind when version not found in releases', () => {
    const result = computeStaleness('2.27.0', mockInfo)
    expect(result.patchesBehind).toBe(0)
    expect(result.majorsBehind).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- pypi.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write src/lib/pypi.ts**

```ts
import { pkgCacheGet, pkgCacheSet } from './cache'
import type { PyPIPackageInfo, PyPIRelease } from './types'

const PKG_CACHE_TTL = 24 * 60 * 60 * 1000

export async function fetchPackageInfo(name: string, installedVersion: string): Promise<PyPIPackageInfo> {
  const cacheKey = `pypi:${name.toLowerCase()}@${installedVersion}`
  const cached = pkgCacheGet<PyPIPackageInfo>(cacheKey)
  if (cached) return cached

  const [latestData, versionData] = await Promise.all([
    fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`),
    fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(installedVersion)}/json`),
  ])

  const releases = buildReleaseList(
    (latestData as any).releases as Record<string, Array<{ upload_time_iso_8601: string }>>
  )

  const info: PyPIPackageInfo = {
    latestVersion: (latestData as any).info.version as string,
    releases,
    requiresDist: ((versionData as any).info.requires_dist as string[] | null) ?? [],
    lastReleaseDate: releases.at(-1)?.uploadTime ?? new Date().toISOString(),
  }

  pkgCacheSet(cacheKey, info, PKG_CACHE_TTL)
  return info
}

export function computeStaleness(
  installedVersion: string,
  info: PyPIPackageInfo
): { patchesBehind: number; majorsBehind: number; lastReleaseDate: string } {
  const idx = info.releases.findIndex(r => r.version === installedVersion)
  if (idx === -1) {
    return { patchesBehind: 0, majorsBehind: 0, lastReleaseDate: info.lastReleaseDate }
  }
  const patchesBehind = info.releases.length - 1 - idx
  const installedMajor = parseInt(installedVersion.split('.')[0] ?? '0', 10)
  const latestMajor = parseInt(info.latestVersion.split('.')[0] ?? '0', 10)
  return {
    patchesBehind,
    majorsBehind: Math.max(0, latestMajor - installedMajor),
    lastReleaseDate: info.lastReleaseDate,
  }
}

function buildReleaseList(
  rawReleases: Record<string, Array<{ upload_time_iso_8601: string }>>
): PyPIRelease[] {
  return Object.entries(rawReleases)
    .filter(([version, files]) =>
      files.length > 0 &&
      !version.includes('a') && !version.includes('b') && !version.includes('rc')
    )
    .map(([version, files]) => ({ version, uploadTime: files[0]!.upload_time_iso_8601 }))
    .sort((a, b) => new Date(a.uploadTime).getTime() - new Date(b.uploadTime).getTime())
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`PyPI API ${res.status}: ${url}`)
  return res.json()
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- pypi.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pypi.ts src/lib/pypi.test.ts
git commit -m "feat: add PyPI client with staleness calculation"
```

---

## Task 7: Status Indicators + Rollup

**Files:**
- Create: `src/lib/indicators.ts`
- Create: `src/lib/indicators.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/indicators.test.ts
import { describe, it, expect } from 'vitest'
import { getPackageStatus, computeRollup } from './indicators'
import type { Package } from './types'

function makePackage(overrides: Partial<Package> = {}): Package {
  return {
    name: 'example',
    installedVersion: '1.0.0',
    latestVersion: '1.0.0',
    patchesBehind: 0,
    majorsBehind: 0,
    lastReleaseDate: new Date().toISOString(),
    cves: [],
    dependencies: [],
    rollup: { totalCves: 0, maxPatchesBehind: 0, hasMajorBehind: false, hasEol: false },
    ...overrides,
  }
}

describe('getPackageStatus', () => {
  it('returns healthy when up to date with no CVEs', () => {
    expect(getPackageStatus(makePackage())).toBe('healthy')
  })

  it('returns critical when CVEs present', () => {
    const pkg = makePackage({ cves: [{ id: 'CVE-1', severity: 'high', description: '', fixedInVersion: null }] })
    expect(getPackageStatus(pkg)).toBe('critical')
  })

  it('returns critical when major version behind', () => {
    expect(getPackageStatus(makePackage({ majorsBehind: 1 }))).toBe('critical')
  })

  it('returns eol when last release is over 2 years ago', () => {
    const old = new Date()
    old.setFullYear(old.getFullYear() - 3)
    expect(getPackageStatus(makePackage({ lastReleaseDate: old.toISOString() }))).toBe('eol')
  })

  it('returns warning when patches behind', () => {
    expect(getPackageStatus(makePackage({ patchesBehind: 2 }))).toBe('warning')
  })

  it('returns warning when last release over 1 year ago but under 2 years', () => {
    const d = new Date()
    d.setMonth(d.getMonth() - 14)
    expect(getPackageStatus(makePackage({ lastReleaseDate: d.toISOString() }))).toBe('warning')
  })

  it('critical takes priority over eol', () => {
    const old = new Date()
    old.setFullYear(old.getFullYear() - 3)
    const pkg = makePackage({
      lastReleaseDate: old.toISOString(),
      cves: [{ id: 'CVE-1', severity: 'high', description: '', fixedInVersion: null }],
    })
    expect(getPackageStatus(pkg)).toBe('critical')
  })
})

describe('computeRollup', () => {
  it('rolls up CVEs from children', () => {
    const child = makePackage({ cves: [{ id: 'CVE-1', severity: 'high', description: '', fixedInVersion: null }] })
    const parent = makePackage({ dependencies: [child] })
    expect(computeRollup(parent).totalCves).toBe(1)
  })

  it('picks max patchesBehind from subtree', () => {
    const child = makePackage({ patchesBehind: 5 })
    const parent = makePackage({ patchesBehind: 1, dependencies: [child] })
    expect(computeRollup(parent).maxPatchesBehind).toBe(5)
  })

  it('flags hasMajorBehind if any node is major behind', () => {
    const child = makePackage({ majorsBehind: 1 })
    expect(computeRollup(makePackage({ dependencies: [child] })).hasMajorBehind).toBe(true)
  })

  it('flags hasEol if any child is eol', () => {
    const old = new Date()
    old.setFullYear(old.getFullYear() - 3)
    const child = makePackage({ lastReleaseDate: old.toISOString() })
    expect(computeRollup(makePackage({ dependencies: [child] })).hasEol).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- indicators.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write src/lib/indicators.ts**

```ts
import type { Package, Rollup } from './types'

export type PackageStatus = 'critical' | 'eol' | 'warning' | 'healthy'

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000
const ONE_YEAR_MS  =     365 * 24 * 60 * 60 * 1000

export function getPackageStatus(pkg: Package): PackageStatus {
  if (pkg.cves.length > 0 || pkg.majorsBehind >= 1) return 'critical'
  const ageMs = Date.now() - new Date(pkg.lastReleaseDate).getTime()
  if (ageMs > TWO_YEARS_MS) return 'eol'
  if (pkg.patchesBehind >= 1 || ageMs > ONE_YEAR_MS) return 'warning'
  return 'healthy'
}

export function computeRollup(pkg: Package): Rollup {
  const all = [pkg, ...pkg.dependencies]
  return {
    totalCves: all.reduce((sum, p) => sum + p.cves.length, 0),
    maxPatchesBehind: Math.max(0, ...all.map(p => p.patchesBehind)),
    hasMajorBehind: all.some(p => p.majorsBehind >= 1),
    hasEol: all.some(p => getPackageStatus(p) === 'eol'),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- indicators.test.ts
```

Expected: all 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/indicators.ts src/lib/indicators.test.ts
git commit -m "feat: add status indicator and rollup logic"
```

---

## Task 8: Analysis Orchestrator

**Files:**
- Create: `src/lib/analysis.ts`
- Create: `src/lib/analysis.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/analysis.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PipAuditDependency, PyPIPackageInfo } from './types'

vi.mock('./pip-audit', () => ({
  runPipAudit: vi.fn(),
  PipAuditNotFoundError: class extends Error {},
}))
vi.mock('./pypi', () => ({
  fetchPackageInfo: vi.fn(),
  computeStaleness: vi.fn(),
}))
vi.mock('./cache', () => ({
  analysisGet: vi.fn().mockReturnValue(null),
  analysisSave: vi.fn(),
  resetForTest: vi.fn(),
}))

import { runPipAudit } from './pip-audit'
import { fetchPackageInfo, computeStaleness } from './pypi'
import { runAnalysis } from './analysis'

const REQUIREMENTS = 'requests==2.28.0\n'

const MOCK_PIP_DEPS: PipAuditDependency[] = [
  { name: 'requests', version: '2.28.0', vulns: [] },
  { name: 'urllib3', version: '1.26.18', vulns: [
    { id: 'GHSA-v845', fix_versions: ['1.26.19'], aliases: ['CVE-2023-45803'], description: 'test vuln' },
  ]},
  { name: 'certifi', version: '2023.1.1', vulns: [] },
]

const MOCK_PYPI_INFO: PyPIPackageInfo = {
  latestVersion: '2.32.3',
  releases: [
    { version: '2.28.0', uploadTime: '2022-06-01T00:00:00Z' },
    { version: '2.32.3', uploadTime: '2024-05-01T00:00:00Z' },
  ],
  requiresDist: ['urllib3>=1.21.1', 'certifi>=2017.4.17'],
  lastReleaseDate: '2024-05-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(runPipAudit).mockResolvedValue(MOCK_PIP_DEPS)
  vi.mocked(fetchPackageInfo).mockResolvedValue(MOCK_PYPI_INFO)
  vi.mocked(computeStaleness).mockReturnValue({
    patchesBehind: 1,
    majorsBehind: 0,
    lastReleaseDate: '2024-05-01T00:00:00Z',
  })
})

describe('runAnalysis', () => {
  it('returns an Analysis with a 16-char hex id', async () => {
    const analysis = await runAnalysis('requirements.txt', REQUIREMENTS)
    expect(analysis.id).toMatch(/^[a-f0-9]{16}$/)
    expect(analysis.filename).toBe('requirements.txt')
  })

  it('only puts direct deps at the top level', async () => {
    const analysis = await runAnalysis('requirements.txt', REQUIREMENTS)
    expect(analysis.packages).toHaveLength(1)
    expect(analysis.packages[0]!.name).toBe('requests')
  })

  it('populates transitive deps one level deep from requiresDist', async () => {
    const analysis = await runAnalysis('requirements.txt', REQUIREMENTS)
    const depNames = analysis.packages[0]!.dependencies.map(d => d.name)
    expect(depNames).toContain('urllib3')
    expect(depNames).toContain('certifi')
  })

  it('maps CVE aliases to CVE-* ids', async () => {
    const analysis = await runAnalysis('requirements.txt', REQUIREMENTS)
    const urllib3 = analysis.packages[0]!.dependencies.find(d => d.name === 'urllib3')!
    expect(urllib3.cves[0]!.id).toBe('CVE-2023-45803')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- analysis.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write src/lib/analysis.ts**

```ts
import { createHash } from 'crypto'
import { runPipAudit } from './pip-audit'
import { fetchPackageInfo, computeStaleness } from './pypi'
import { parseDirectDepNames, toRequirementsTxt } from './parser'
import { computeRollup } from './indicators'
import { analysisSave, analysisGet } from './cache'
import type { Analysis, Package, CVE, PipAuditDependency, PyPIPackageInfo } from './types'

export { analysisGet }

export async function runAnalysis(filename: string, content: string): Promise<Analysis> {
  const id = createHash('sha256').update(content).digest('hex').slice(0, 16)

  const cached = analysisGet(id)
  if (cached) return cached

  const requirementsTxt = toRequirementsTxt(filename, content)
  const directDepNames = new Set(parseDirectDepNames(filename, content))
  const pipDeps = await runPipAudit(requirementsTxt)
  const pipMap = new Map(pipDeps.map(d => [d.name.toLowerCase(), d]))

  const pypiInfoMap = new Map<string, PyPIPackageInfo>()
  await Promise.allSettled(
    pipDeps.map(async dep => {
      try {
        pypiInfoMap.set(dep.name.toLowerCase(), await fetchPackageInfo(dep.name, dep.version))
      } catch {
        pypiInfoMap.set(dep.name.toLowerCase(), fallbackInfo(dep.version))
      }
    })
  )

  const packages: Package[] = pipDeps
    .filter(d => directDepNames.has(d.name.toLowerCase()))
    .map(dep => buildPackage(dep, pipMap, pypiInfoMap))

  const analysis: Analysis = { id, filename, createdAt: new Date().toISOString(), packages }
  analysisSave(analysis, filename)
  return analysis
}

function buildPackage(
  dep: PipAuditDependency,
  pipMap: Map<string, PipAuditDependency>,
  pypiInfoMap: Map<string, PyPIPackageInfo>
): Package {
  const info = pypiInfoMap.get(dep.name.toLowerCase()) ?? fallbackInfo(dep.version)
  const staleness = computeStaleness(dep.version, info)
  const cves = mapCves(dep)

  const dependencies: Package[] = parseDepNames(info.requiresDist).flatMap(name => {
    const td = pipMap.get(name)
    if (!td) return []
    const tInfo = pypiInfoMap.get(name) ?? fallbackInfo(td.version)
    const tStaleness = computeStaleness(td.version, tInfo)
    const tCves = mapCves(td)
    const tPkg: Package = {
      name: td.name,
      installedVersion: td.version,
      latestVersion: tInfo.latestVersion,
      ...tStaleness,
      cves: tCves,
      dependencies: [],
      rollup: {
        totalCves: tCves.length,
        maxPatchesBehind: tStaleness.patchesBehind,
        hasMajorBehind: tStaleness.majorsBehind >= 1,
        hasEol: false,
      },
    }
    return [tPkg]
  })

  const pkg: Package = {
    name: dep.name,
    installedVersion: dep.version,
    latestVersion: info.latestVersion,
    ...staleness,
    cves,
    dependencies,
    rollup: { totalCves: 0, maxPatchesBehind: 0, hasMajorBehind: false, hasEol: false },
  }
  pkg.rollup = computeRollup(pkg)
  return pkg
}

function mapCves(dep: PipAuditDependency): CVE[] {
  return dep.vulns.map(v => ({
    id: v.aliases.find(a => a.startsWith('CVE-')) ?? v.id,
    severity: 'high' as const,
    description: v.description,
    fixedInVersion: v.fix_versions[0] ?? null,
  }))
}

function parseDepNames(requiresDist: string[]): string[] {
  return requiresDist
    .map(dep => dep.split(/[>=<!~\[;\s(]/)[0]!.trim().toLowerCase())
    .filter(Boolean)
}

function fallbackInfo(version: string): PyPIPackageInfo {
  return {
    latestVersion: version,
    releases: [{ version, uploadTime: new Date().toISOString() }],
    requiresDist: [],
    lastReleaseDate: new Date().toISOString(),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- analysis.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Run all lib tests together**

```bash
npm test -- src/lib
```

Expected: all tests across all lib modules PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/analysis.ts src/lib/analysis.test.ts
git commit -m "feat: add analysis orchestrator"
```

---

## Task 9: API Endpoints

**Files:**
- Create: `src/pages/api/analyze.ts`
- Create: `src/pages/api/analysis/[id].ts`

- [ ] **Step 1: Write src/pages/api/analyze.ts**

```ts
import type { APIRoute } from 'astro'
import { runAnalysis } from '../../../lib/analysis'
import { PipAuditNotFoundError } from '../../../lib/pip-audit'

export const POST: APIRoute = async ({ request, redirect }) => {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'No file uploaded' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { name: filename } = file
  if (!filename.endsWith('.txt') && !filename.endsWith('.toml')) {
    return new Response(JSON.stringify({ error: 'Only .txt and .toml files are accepted' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const content = await file.text()
  if (!content.trim()) {
    return new Response(JSON.stringify({ error: 'File is empty' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const analysis = await runAnalysis(filename, content)
    return redirect(`/analysis/${analysis.id}`, 303)
  } catch (err) {
    if (err instanceof PipAuditNotFoundError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
```

- [ ] **Step 2: Write src/pages/api/analysis/[id].ts**

```ts
import type { APIRoute } from 'astro'
import { analysisGet } from '../../../lib/analysis'
import { analysisDelete } from '../../../lib/cache'

export const GET: APIRoute = ({ params }) => {
  const analysis = analysisGet(params.id!)
  if (!analysis) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new Response(JSON.stringify(analysis), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export const DELETE: APIRoute = ({ params }) => {
  analysisDelete(params.id!)
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 3: Smoke test the endpoints**

```bash
npm run dev
```

In a second terminal:
```bash
# Should get 400 (no file)
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4321/api/analyze
# Expected output: 400

# GET non-existent analysis
curl -s http://localhost:4321/api/analysis/doesnotexist
# Expected output: {"error":"Not found"}
```

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/analyze.ts src/pages/api/analysis/[id].ts
git commit -m "feat: add analyze and analysis API endpoints"
```

---

## Task 10: StatusBadge Component

**Files:**
- Create: `src/components/StatusBadge.tsx`
- Create: `src/components/StatusBadge.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/StatusBadge.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders CVE count badge', () => {
    render(<StatusBadge type="cve" count={3} />)
    expect(screen.getByText('● 3 CVE')).toBeInTheDocument()
  })

  it('renders version-behind badge', () => {
    render(<StatusBadge type="versions" count={4} />)
    expect(screen.getByText('+4 ver')).toBeInTheDocument()
  })

  it('renders major-behind badge', () => {
    render(<StatusBadge type="major" />)
    expect(screen.getByText('⬆ MAJOR')).toBeInTheDocument()
  })

  it('renders healthy badge', () => {
    render(<StatusBadge type="healthy" />)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('renders EOL badge with years', () => {
    render(<StatusBadge type="eol" years={3} />)
    expect(screen.getByText('☠ EOL 3yr')).toBeInTheDocument()
  })

  it('renders nothing when count is 0 for cve type', () => {
    const { container } = render(<StatusBadge type="cve" count={0} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- StatusBadge.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write src/components/StatusBadge.tsx**

```tsx
interface StatusBadgeProps {
  type: 'cve' | 'versions' | 'major' | 'healthy' | 'eol'
  count?: number
  years?: number
}

export function StatusBadge({ type, count = 0, years = 0 }: StatusBadgeProps) {
  if (type === 'cve') {
    if (count === 0) return null
    return (
      <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-red-badge text-red-text font-mono">
        ● {count} CVE
      </span>
    )
  }
  if (type === 'versions') {
    if (count === 0) return null
    return (
      <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-yellow-badge text-yellow-text font-mono">
        +{count} ver
      </span>
    )
  }
  if (type === 'major') {
    return (
      <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-red-badge text-purple-text font-mono">
        ⬆ MAJOR
      </span>
    )
  }
  if (type === 'eol') {
    return (
      <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-panel text-muted font-mono">
        ☠ EOL {years}yr
      </span>
    )
  }
  return (
    <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-green-badge text-green-text font-mono">
      ✓
    </span>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- StatusBadge.test.tsx
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatusBadge.tsx src/components/StatusBadge.test.tsx
git commit -m "feat: add StatusBadge component"
```

---

## Task 11: UploadZone Component

**Files:**
- Create: `src/components/UploadZone.tsx`
- Create: `src/components/UploadZone.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/UploadZone.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UploadZone } from './UploadZone'

describe('UploadZone', () => {
  it('renders drop zone and browse button', () => {
    render(<UploadZone />)
    expect(screen.getByText(/drop your file/i)).toBeInTheDocument()
    expect(screen.getByText(/browse files/i)).toBeInTheDocument()
  })

  it('shows accepted file types', () => {
    render(<UploadZone />)
    expect(screen.getByText(/requirements\.txt/i)).toBeInTheDocument()
    expect(screen.getByText(/pyproject\.toml/i)).toBeInTheDocument()
  })

  it('rejects files with wrong extension and shows error', async () => {
    render(<UploadZone />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'setup.py')] } })
    expect(await screen.findByText(/only .txt and .toml/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- UploadZone.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write src/components/UploadZone.tsx**

```tsx
import { useState, useRef } from 'react'

export function UploadZone() {
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function validateAndSubmit(file: File) {
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.toml')) {
      setError('Only .txt and .toml files are accepted')
      return
    }
    setError(null)
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    fetch('/api/analyze', { method: 'POST', body: formData })
      .then(res => {
        if (res.redirected) { window.location.href = res.url; return }
        return res.json().then((body: { error?: string }) => {
          setError(body.error ?? 'Upload failed')
          setUploading(false)
        })
      })
      .catch(() => { setError('Upload failed'); setUploading(false) })
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) validateAndSubmit(file)
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-400 bg-panel' : 'border-border bg-surface hover:border-muted'
        }`}
      >
        <div className="text-4xl mb-3">📄</div>
        <p className="text-muted text-sm mb-3">Drop your file here or</p>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
          className="px-4 py-1.5 rounded bg-panel border border-border text-sm hover:border-muted transition-colors"
        >
          {uploading ? 'Analysing…' : 'Browse files'}
        </button>
        <p className="text-muted text-xs mt-3">
          Accepts <code>requirements.txt</code> and <code>pyproject.toml</code>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.toml"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSubmit(f) }}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-text">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- UploadZone.test.tsx
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/UploadZone.tsx src/components/UploadZone.test.tsx
git commit -m "feat: add UploadZone drag-and-drop component"
```

---

## Task 12: DependencyTree Component

**Files:**
- Create: `src/components/DependencyTree.tsx`
- Create: `src/components/DependencyTree.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/DependencyTree.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DependencyTree } from './DependencyTree'
import type { Package } from '../lib/types'

function makePackage(name: string, overrides: Partial<Package> = {}): Package {
  return {
    name,
    installedVersion: '1.0.0',
    latestVersion: '1.0.0',
    patchesBehind: 0,
    majorsBehind: 0,
    lastReleaseDate: new Date().toISOString(),
    cves: [],
    dependencies: [],
    rollup: { totalCves: 0, maxPatchesBehind: 0, hasMajorBehind: false, hasEol: false },
    ...overrides,
  }
}

const PACKAGES: Package[] = [
  makePackage('requests', {
    patchesBehind: 4,
    dependencies: [makePackage('urllib3'), makePackage('certifi')],
    rollup: { totalCves: 0, maxPatchesBehind: 4, hasMajorBehind: false, hasEol: false },
  }),
  makePackage('fastapi'),
]

describe('DependencyTree', () => {
  it('renders top-level packages', () => {
    render(<DependencyTree packages={PACKAGES} onSelect={() => {}} selected={null} />)
    expect(screen.getByText('requests')).toBeInTheDocument()
    expect(screen.getByText('fastapi')).toBeInTheDocument()
  })

  it('hides children by default', () => {
    render(<DependencyTree packages={PACKAGES} onSelect={() => {}} selected={null} />)
    expect(screen.queryByText('urllib3')).not.toBeInTheDocument()
  })

  it('expands children on click', () => {
    render(<DependencyTree packages={PACKAGES} onSelect={() => {}} selected={null} />)
    fireEvent.click(screen.getByText('requests'))
    expect(screen.getByText('urllib3')).toBeInTheDocument()
    expect(screen.getByText('certifi')).toBeInTheDocument()
  })

  it('calls onSelect with the clicked package', () => {
    const onSelect = vi.fn()
    render(<DependencyTree packages={PACKAGES} onSelect={onSelect} selected={null} />)
    fireEvent.click(screen.getByText('fastapi'))
    expect(onSelect).toHaveBeenCalledWith(PACKAGES[1])
  })

  it('marks the selected package with data-selected=true', () => {
    render(<DependencyTree packages={PACKAGES} onSelect={() => {}} selected={PACKAGES[1]!} />)
    const row = screen.getByText('fastapi').closest('[data-selected]')
    expect(row).toHaveAttribute('data-selected', 'true')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- DependencyTree.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write src/components/DependencyTree.tsx**

```tsx
import { useState } from 'react'
import { StatusBadge } from './StatusBadge'
import { getPackageStatus } from '../lib/indicators'
import type { Package } from '../lib/types'

interface TreeProps {
  packages: Package[]
  selected: Package | null
  onSelect: (pkg: Package) => void
}

export function DependencyTree({ packages, selected, onSelect }: TreeProps) {
  return (
    <div className="font-mono text-sm select-none">
      {packages.map(pkg => (
        <TreeNode key={pkg.name} pkg={pkg} selected={selected} onSelect={onSelect} depth={0} />
      ))}
    </div>
  )
}

function TreeNode({
  pkg, selected, onSelect, depth,
}: { pkg: Package; selected: Package | null; onSelect: (p: Package) => void; depth: number }) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = pkg.dependencies.length > 0
  const isSelected = selected?.name === pkg.name
  const status = getPackageStatus(pkg)

  const statusColor = {
    critical: 'text-red-text',
    eol: 'text-muted',
    warning: 'text-yellow-text',
    healthy: 'text-green-text',
  }[status]

  const yearsSince = Math.floor(
    (Date.now() - new Date(pkg.lastReleaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365)
  )

  function handleClick() {
    if (hasChildren) setExpanded(e => !e)
    onSelect(pkg)
  }

  return (
    <div>
      <div
        data-selected={isSelected}
        onClick={handleClick}
        className={`flex items-center gap-1.5 py-1 cursor-pointer rounded transition-colors hover:bg-panel ${
          isSelected ? 'bg-panel border-l-2 border-blue-400' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className={statusColor}>
          {hasChildren ? (expanded ? '▼' : '▶') : '↳'} {pkg.name}
        </span>
        <div className="flex gap-1 ml-auto mr-2 flex-shrink-0">
          {pkg.rollup.totalCves > 0 && <StatusBadge type="cve" count={pkg.rollup.totalCves} />}
          {pkg.rollup.hasMajorBehind && <StatusBadge type="major" />}
          {pkg.rollup.hasEol && <StatusBadge type="eol" years={yearsSince} />}
          {!pkg.rollup.hasMajorBehind && pkg.rollup.maxPatchesBehind > 0 && (
            <StatusBadge type="versions" count={pkg.rollup.maxPatchesBehind} />
          )}
          {pkg.rollup.totalCves === 0 && pkg.rollup.maxPatchesBehind === 0 && !pkg.rollup.hasEol && (
            <StatusBadge type="healthy" />
          )}
        </div>
      </div>
      {expanded && pkg.dependencies.map(dep => (
        <TreeNode key={dep.name} pkg={dep} selected={selected} onSelect={onSelect} depth={depth + 1} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- DependencyTree.test.tsx
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DependencyTree.tsx src/components/DependencyTree.test.tsx
git commit -m "feat: add collapsible DependencyTree component"
```

---

## Task 13: PackageDetail + SplitPanel Components

**Files:**
- Create: `src/components/PackageDetail.tsx`
- Create: `src/components/PackageDetail.test.tsx`
- Create: `src/components/SplitPanel.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/PackageDetail.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PackageDetail } from './PackageDetail'
import type { Package } from '../lib/types'

const MOCK_PKG: Package = {
  name: 'requests',
  installedVersion: '2.28.0',
  latestVersion: '2.32.3',
  patchesBehind: 4,
  majorsBehind: 0,
  lastReleaseDate: '2024-05-01T00:00:00Z',
  cves: [
    { id: 'CVE-2023-32681', severity: 'high', description: 'SSRF via Proxy-Authorization', fixedInVersion: '2.31.0' },
  ],
  dependencies: [],
  rollup: { totalCves: 1, maxPatchesBehind: 4, hasMajorBehind: false, hasEol: false },
}

describe('PackageDetail', () => {
  it('renders package name and versions', () => {
    render(<PackageDetail pkg={MOCK_PKG} />)
    expect(screen.getByText('requests')).toBeInTheDocument()
    expect(screen.getByText(/2\.28\.0/)).toBeInTheDocument()
    expect(screen.getByText(/2\.32\.3/)).toBeInTheDocument()
  })

  it('renders CVE ID and description', () => {
    render(<PackageDetail pkg={MOCK_PKG} />)
    expect(screen.getByText('CVE-2023-32681')).toBeInTheDocument()
    expect(screen.getByText(/SSRF via Proxy-Authorization/)).toBeInTheDocument()
  })

  it('renders fixed-in version', () => {
    render(<PackageDetail pkg={MOCK_PKG} />)
    expect(screen.getByText(/fixed in 2\.31\.0/i)).toBeInTheDocument()
  })

  it('shows "No known CVEs" when clean', () => {
    render(<PackageDetail pkg={{ ...MOCK_PKG, cves: [] }} />)
    expect(screen.getByText(/no known cves/i)).toBeInTheDocument()
  })

  it('shows placeholder when no package selected', () => {
    render(<PackageDetail pkg={null} />)
    expect(screen.getByText(/select a package/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- PackageDetail.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write src/components/PackageDetail.tsx**

```tsx
import type { Package, CVE } from '../lib/types'

export function PackageDetail({ pkg }: { pkg: Package | null }) {
  if (!pkg) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Select a package from the tree to see details
      </div>
    )
  }

  const daysSince = Math.floor(
    (Date.now() - new Date(pkg.lastReleaseDate).getTime()) / (1000 * 60 * 60 * 24)
  )
  const yearsSince = Math.floor(daysSince / 365)

  return (
    <div className="p-4 overflow-auto h-full text-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="font-mono font-bold text-lg">{pkg.name}</h2>
          <p className="text-muted text-xs mt-0.5">
            installed: <span className="text-red-text font-mono">{pkg.installedVersion}</span>
            {' · '}
            latest: <span className="text-green-text font-mono">{pkg.latestVersion}</span>
          </p>
        </div>
        <div className="text-xs text-right space-y-0.5">
          {pkg.patchesBehind > 0 && (
            <div className="text-yellow-text">{pkg.patchesBehind} releases behind</div>
          )}
          {pkg.majorsBehind > 0 && (
            <div className="text-purple-text">{pkg.majorsBehind} major behind</div>
          )}
          {daysSince > 730 && (
            <div className="text-muted">☠ No release in {yearsSince}yr</div>
          )}
        </div>
      </div>

      <h3 className="text-xs uppercase tracking-widest text-muted mb-2">CVEs</h3>
      {pkg.cves.length === 0 ? (
        <p className="text-green-text text-xs">No known CVEs for this version</p>
      ) : (
        <div className="flex flex-col gap-2">
          {pkg.cves.map(cve => <CveCard key={cve.id} cve={cve} />)}
        </div>
      )}

      {pkg.patchesBehind > 0 && (
        <div className="mt-4">
          <h3 className="text-xs uppercase tracking-widest text-muted mb-2">Last release</h3>
          <p className="text-muted text-xs">
            {new Date(pkg.lastReleaseDate).toLocaleDateString()} ({daysSince} days ago)
          </p>
        </div>
      )}
    </div>
  )
}

function CveCard({ cve }: { cve: CVE }) {
  const borderColor = {
    critical: 'border-red-text', high: 'border-red-text',
    medium: 'border-yellow-text', low: 'border-green-text', unknown: 'border-muted',
  }[cve.severity]

  return (
    <div className={`bg-surface rounded-md p-3 border-l-2 ${borderColor}`}>
      <div className="flex justify-between">
        <span className="font-mono text-xs">{cve.id}</span>
        <span className="text-muted text-xs uppercase">{cve.severity}</span>
      </div>
      <p className="text-muted text-xs mt-1">{cve.description}</p>
      {cve.fixedInVersion && (
        <p className="text-green-text text-xs mt-1">Fixed in {cve.fixedInVersion}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write src/components/SplitPanel.tsx**

```tsx
import { useState } from 'react'
import { DependencyTree } from './DependencyTree'
import { PackageDetail } from './PackageDetail'
import type { Package } from '../lib/types'

export function SplitPanel({ packages }: { packages: Package[] }) {
  const [selected, setSelected] = useState<Package | null>(packages[0] ?? null)
  return (
    <div className="flex w-full h-full overflow-hidden">
      <div className="w-2/5 border-r border-border overflow-auto py-2">
        <DependencyTree packages={packages} selected={selected} onSelect={setSelected} />
      </div>
      <div className="flex-1 overflow-auto">
        <PackageDetail pkg={selected} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- PackageDetail.test.tsx
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/PackageDetail.tsx src/components/PackageDetail.test.tsx src/components/SplitPanel.tsx
git commit -m "feat: add PackageDetail, SplitPanel components"
```

---

## Task 14: Pages

**Files:**
- Modify: `src/pages/index.astro`
- Create: `src/pages/analysis/[id].astro`

- [ ] **Step 1: Write src/pages/index.astro**

```astro
---
import { UploadZone } from '../components/UploadZone'
import { analysisListRecent } from '../lib/cache'

let recent: Awaited<ReturnType<typeof analysisListRecent>> = []
try {
  recent = analysisListRecent(10)
} catch {
  // database may not exist on first run
}
---

<html lang="en" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Python Dependency Explorer</title>
  </head>
  <body class="min-h-screen bg-surface text-white p-8">
    <div class="max-w-2xl mx-auto">

      <header class="mb-10 text-center">
        <h1 class="text-2xl font-bold font-mono mb-1">Python Dependency Explorer</h1>
        <p class="text-muted text-sm">
          Upload a <code>requirements.txt</code> or <code>pyproject.toml</code>
        </p>
      </header>

      <div class="mb-10">
        <UploadZone client:load />
      </div>

      {recent.length > 0 && (
        <section>
          <h2 class="text-xs uppercase tracking-widest text-muted mb-3">Recent analyses</h2>
          <div class="border border-border rounded-lg overflow-hidden">
            {recent.map((item, i) => (
              <a
                href={`/analysis/${item.id}`}
                class:list={[
                  'flex items-center justify-between px-4 py-3 hover:bg-panel transition-colors',
                  i < recent.length - 1 ? 'border-b border-border' : '',
                ]}
              >
                <span class="font-mono text-sm">{item.filename}</span>
                <div class="flex items-center gap-3 text-xs">
                  {item.totalCves > 0 ? (
                    <span class="bg-red-badge text-red-text rounded px-2 py-0.5">
                      ● {item.totalCves} CVE
                    </span>
                  ) : (
                    <span class="bg-green-badge text-green-text rounded px-2 py-0.5">✓ clean</span>
                  )}
                  <span class="text-muted">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

    </div>
  </body>
</html>
```

- [ ] **Step 2: Create src/pages/analysis directory**

```bash
mkdir -p src/pages/analysis
```

- [ ] **Step 3: Write src/pages/analysis/[id].astro**

```astro
---
import { SplitPanel } from '../../components/SplitPanel'
import { analysisGet } from '../../lib/analysis'
import type { Analysis } from '../../lib/types'

const { id } = Astro.params
const analysis: Analysis | null = id ? analysisGet(id) : null
if (!analysis) return Astro.redirect('/', 302)

const totalCves    = analysis.packages.reduce((s, p) => s + p.rollup.totalCves, 0)
const majorsCount  = analysis.packages.filter(p => p.rollup.hasMajorBehind).length
const eolCount     = analysis.packages.filter(p => p.rollup.hasEol).length
const upToDate     = analysis.packages.filter(
  p => p.rollup.totalCves === 0 && p.rollup.maxPatchesBehind === 0 && !p.rollup.hasEol
).length
---

<html lang="en" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{analysis.filename} — Dependency Explorer</title>
  </head>
  <body class="min-h-screen bg-surface text-white flex flex-col" style="height:100vh">

    <header class="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
      <a href="/" class="text-muted text-sm hover:text-white transition-colors">← Upload</a>
      <span class="font-mono text-sm text-muted">{analysis.filename}</span>
      <span class="text-muted text-xs">{new Date(analysis.createdAt).toLocaleDateString()}</span>
    </header>

    <div class="grid grid-cols-4 border-b border-border flex-shrink-0">
      <div class="px-4 py-2 text-center border-r border-border">
        <div class:list={['font-bold text-lg', totalCves > 0 ? 'text-red-text' : 'text-green-text']}>
          {totalCves}
        </div>
        <div class="text-muted text-xs uppercase tracking-widest">CVEs</div>
      </div>
      <div class="px-4 py-2 text-center border-r border-border">
        <div class:list={['font-bold text-lg', majorsCount > 0 ? 'text-purple-text' : 'text-muted']}>
          {majorsCount}
        </div>
        <div class="text-muted text-xs uppercase tracking-widest">Major behind</div>
      </div>
      <div class="px-4 py-2 text-center border-r border-border">
        <div class:list={['font-bold text-lg', eolCount > 0 ? 'text-muted' : 'text-green-text']}>
          {eolCount}
        </div>
        <div class="text-muted text-xs uppercase tracking-widest">EOL</div>
      </div>
      <div class="px-4 py-2 text-center">
        <div class="font-bold text-lg text-green-text">{upToDate}/{analysis.packages.length}</div>
        <div class="text-muted text-xs uppercase tracking-widest">Up to date</div>
      </div>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <SplitPanel packages={analysis.packages} client:load />
    </div>

  </body>
</html>
```

- [ ] **Step 4: End-to-end smoke test**

```bash
npm run dev
```

1. Open `http://localhost:4321`
2. Upload a real `requirements.txt` (any Python project)
3. Verify redirect to `/analysis/{id}`
4. Verify the 4-cell summary strip shows numbers
5. Click a package in the left panel — right panel updates
6. Click a package with children (▶) — children expand
7. Verify recent analyses list on homepage after revisiting `/`
8. Stop the server

- [ ] **Step 5: Run final test suite**

```bash
npm test
```

Expected: all tests PASS, zero failures.

- [ ] **Step 6: Commit**

```bash
git add src/pages/index.astro src/pages/analysis/[id].astro
git commit -m "feat: add upload and analysis pages — feature complete"
```

---

## Done

Run the app:

```bash
npm run dev
# Open http://localhost:4321
```

**Prerequisite:** `pip install pip-audit`
