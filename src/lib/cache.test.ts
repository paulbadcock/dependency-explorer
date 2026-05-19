// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { createD1Shim } from '../test-utils/d1-shim'
import type { Analysis } from './types'

let cache: typeof import('./cache')

beforeEach(async () => {
  vi.resetModules()
  cache = await import('./cache')
  cache.resetForTest(createD1Shim())
  await cache.ensureSchema()
})

import { vi } from 'vitest'

const mockAnalysis: Analysis = {
  id: 'abc123',
  filename: 'requirements.txt',
  createdAt: new Date().toISOString(),
  packages: [],
}

describe('pkgCacheGet / pkgCacheSet', () => {
  it('returns null for missing key', async () => {
    expect(await cache.pkgCacheGet('missing')).toBeNull()
  })

  it('returns stored value within TTL', async () => {
    await cache.pkgCacheSet('k1', { foo: 'bar' }, 60_000)
    expect(await cache.pkgCacheGet('k1')).toEqual({ foo: 'bar' })
  })

  it('returns null after TTL expires', async () => {
    await cache.pkgCacheSet('k2', { x: 1 }, -1)
    expect(await cache.pkgCacheGet('k2')).toBeNull()
  })
})

describe('analysisSave / analysisGet / analysisListRecent / analysisDelete', () => {
  it('round-trips an analysis', async () => {
    await cache.analysisSave(mockAnalysis)
    expect(await cache.analysisGet('abc123')).toEqual(mockAnalysis)
  })

  it('lists recent analyses', async () => {
    await cache.analysisSave(mockAnalysis)
    const recent = await cache.analysisListRecent()
    expect(recent).toHaveLength(1)
    expect(recent[0]!.id).toBe('abc123')
  })

  it('deletes an analysis', async () => {
    await cache.analysisSave(mockAnalysis)
    await cache.analysisDelete('abc123')
    expect(await cache.analysisGet('abc123')).toBeNull()
  })
})
