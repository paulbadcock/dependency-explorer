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

export function analysisSave(analysis: Analysis): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO analyses (id, filename, data, created_at) VALUES (?, ?, ?, ?)')
    .run(analysis.id, analysis.filename, JSON.stringify(analysis), Date.now())
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
