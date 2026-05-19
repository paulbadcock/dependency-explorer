// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createD1Shim } from '../test-utils/d1-shim'
import { resetForTest, ensureSchema } from './cache'
import { fetchNuGetPackageInfo } from './nuget'

const stableRelease = (version: string, published: string) => ({
  catalogEntry: { version, listed: true, published },
})

const registrationIndex = {
  items: [
    {
      '@id': 'https://example.com/page/0',
      items: [
        stableRelease('13.0.1', '2022-01-01T00:00:00Z'),
        stableRelease('13.0.2', '2022-06-01T00:00:00Z'),
        stableRelease('13.0.3', '2023-03-01T00:00:00Z'),
      ],
    },
  ],
}

describe('fetchNuGetPackageInfo', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    resetForTest(createD1Shim())
    await ensureSchema()
  })

  it('returns latest stable version', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => registrationIndex,
    }))

    const info = await fetchNuGetPackageInfo('Newtonsoft.Json.Unique1', '13.0.1')
    expect(info.latestVersion).toBe('13.0.3')
  })

  it('excludes pre-release versions', async () => {
    const withPreRelease = {
      items: [{
        '@id': 'https://example.com/page/0',
        items: [
          stableRelease('13.0.3', '2023-03-01T00:00:00Z'),
          { catalogEntry: { version: '14.0.0-alpha', listed: true, published: '2024-01-01T00:00:00Z' } },
        ],
      }],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => withPreRelease,
    }))

    const info = await fetchNuGetPackageInfo('Newtonsoft.Json.Unique2', '13.0.3')
    expect(info.latestVersion).toBe('13.0.3')
    expect(info.releases.map(r => r.version)).not.toContain('14.0.0-alpha')
  })

  it('excludes unlisted versions', async () => {
    const withUnlisted = {
      items: [{
        '@id': 'https://example.com/page/0',
        items: [
          { catalogEntry: { version: '13.0.2', listed: false, published: '2022-06-01T00:00:00Z' } },
          stableRelease('13.0.3', '2023-03-01T00:00:00Z'),
        ],
      }],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => withUnlisted,
    }))

    const info = await fetchNuGetPackageInfo('Newtonsoft.Json.Unique3', '13.0.2')
    expect(info.releases.map(r => r.version)).not.toContain('13.0.2')
  })

  it('falls back to flat container when registration returns no releases', async () => {
    const flatContainer = { versions: ['1.0.0', '1.1.0', '2.0.0-beta'] }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => flatContainer }),
    )

    const info = await fetchNuGetPackageInfo('Some.Pkg.Unique4', '1.0.0')
    expect(info.releases.map(r => r.version)).toContain('1.0.0')
    expect(info.releases.map(r => r.version)).toContain('1.1.0')
    expect(info.releases.map(r => r.version)).not.toContain('2.0.0-beta')
  })

  it('returns fallback info when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const info = await fetchNuGetPackageInfo('Broken.Pkg.Unique5', '1.0.0')
    expect(info.latestVersion).toBe('1.0.0')
    expect(info.releases).toHaveLength(0)
  })

  it('sorts releases by semver', async () => {
    const outOfOrder = {
      items: [{
        '@id': 'https://example.com/page/0',
        items: [
          stableRelease('2.0.0', '2023-01-01T00:00:00Z'),
          stableRelease('1.0.0', '2021-01-01T00:00:00Z'),
          stableRelease('1.10.0', '2022-06-01T00:00:00Z'),
          stableRelease('1.9.0', '2022-01-01T00:00:00Z'),
        ],
      }],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => outOfOrder,
    }))

    const info = await fetchNuGetPackageInfo('Sort.Test.Unique6', '1.0.0')
    expect(info.releases.map(r => r.version)).toEqual(['1.0.0', '1.9.0', '1.10.0', '2.0.0'])
  })
})
