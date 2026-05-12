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
