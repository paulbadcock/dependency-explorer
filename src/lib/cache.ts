import type { Analysis, Package, PyPIRelease, RecentAnalysis } from './types'

let _db: D1Database | null = null
let _schemaApplied = false

export function initDb(db: D1Database): void {
  _db = db
}

// Used in tests only — accepts a D1-compatible mock
export function resetForTest(db: D1Database): void {
  _db = db
  _schemaApplied = false
}

function getDb(): D1Database {
  if (!_db) throw new Error('Database not initialised. Ensure middleware has run.')
  return _db
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS pkg_cache (
    key        TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS analyses (
    id         TEXT PRIMARY KEY,
    filename   TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    content    TEXT
  );
`

export async function ensureSchema(): Promise<void> {
  if (_schemaApplied) return
  const db = getDb()
  for (const sql of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
    await db.prepare(sql).run()
  }
  _schemaApplied = true
}

export async function pkgCacheGet<T>(key: string): Promise<T | null> {
  const row = await getDb()
    .prepare('SELECT data, expires_at FROM pkg_cache WHERE key = ?')
    .bind(key)
    .first<{ data: string; expires_at: number }>()
  if (!row || row.expires_at < Date.now()) return null
  return JSON.parse(row.data) as T
}

export async function pkgCacheSet(key: string, data: unknown, ttlMs: number): Promise<void> {
  await getDb()
    .prepare('INSERT OR REPLACE INTO pkg_cache (key, data, expires_at) VALUES (?, ?, ?)')
    .bind(key, JSON.stringify(data), Date.now() + ttlMs)
    .run()
}

export async function analysisSave(analysis: Analysis): Promise<void> {
  await getDb()
    .prepare('INSERT OR REPLACE INTO analyses (id, filename, data, created_at) VALUES (?, ?, ?, ?)')
    .bind(analysis.id, analysis.filename, JSON.stringify(trimReleasesForStorage(analysis)), Date.now())
    .run()
}

function trimTopLevelReleases(pkg: Package): PyPIRelease[] {
  const installedIdx = pkg.releases.findIndex(r => r.version === pkg.installedVersion)
  const latestIdx = pkg.releases.findIndex(r => r.version === pkg.latestVersion)
  if (installedIdx === -1 || latestIdx === -1 || installedIdx > latestIdx) return pkg.releases
  return pkg.releases.slice(installedIdx, latestIdx + 1)
}

function trimReleasesForStorage(analysis: Analysis): Analysis {
  return {
    ...analysis,
    packages: analysis.packages.map(pkg => ({
      ...pkg,
      releases: trimTopLevelReleases(pkg),
      dependencies: pkg.dependencies.map(dep => ({
        ...dep,
        releases: dep.releases.filter(r => r.version === dep.installedVersion),
      })),
    })),
  }
}

export async function analysisGet(id: string): Promise<Analysis | null> {
  const row = await getDb()
    .prepare('SELECT data FROM analyses WHERE id = ?')
    .bind(id)
    .first<{ data: string }>()
  if (!row) return null
  return JSON.parse(row.data) as Analysis
}

export async function analysisListRecent(limit = 10): Promise<RecentAnalysis[]> {
  const { results } = await getDb()
    .prepare('SELECT id, filename, created_at, data FROM analyses ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all<{ id: string; filename: string; created_at: number; data: string }>()
  return results.map(r => {
    const a = JSON.parse(r.data) as Analysis
    const totalCves = a.packages.reduce((sum, p) => sum + p.rollup.totalCves, 0)
    return { id: r.id, filename: r.filename, label: a.label, createdAt: r.created_at, totalCves }
  })
}

export async function analysisDelete(id: string): Promise<number> {
  const result = await getDb()
    .prepare('DELETE FROM analyses WHERE id = ?')
    .bind(id)
    .run()
  return (result.meta as { changes?: number })?.changes ?? 0
}

export async function analysisUpdateLabel(id: string, label: string): Promise<number> {
  const db = getDb()
  const row = await db
    .prepare('SELECT data FROM analyses WHERE id = ?')
    .bind(id)
    .first<{ data: string }>()
  if (!row) return 0

  const analysis = JSON.parse(row.data) as Analysis
  const trimmed = label.trim()
  if (trimmed) {
    analysis.label = trimmed
  } else {
    delete analysis.label
  }

  const result = await db
    .prepare('UPDATE analyses SET data = ? WHERE id = ?')
    .bind(JSON.stringify(analysis), id)
    .run()
  return (result.meta as { changes?: number })?.changes ?? 0
}
