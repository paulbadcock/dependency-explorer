// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryOsvBatch, osvToCve } from './osv'

const mockVuln = {
  id: 'GHSA-xxxx-yyyy-zzzz',
  aliases: ['CVE-2023-12345'],
  summary: 'Remote code execution via crafted input',
  database_specific: { severity: 'HIGH' },
  affected: [
    {
      ranges: [
        {
          type: 'ECOSYSTEM',
          events: [{ introduced: '0' }, { fixed: '13.0.4' }],
        },
      ],
    },
  ],
}

describe('osvToCve', () => {
  it('prefers CVE alias over GHSA id', () => {
    const cve = osvToCve(mockVuln)
    expect(cve.id).toBe('CVE-2023-12345')
  })

  it('falls back to OSV id when no CVE alias', () => {
    const cve = osvToCve({ ...mockVuln, aliases: [] })
    expect(cve.id).toBe('GHSA-xxxx-yyyy-zzzz')
  })

  it('maps HIGH severity', () => {
    expect(osvToCve(mockVuln).severity).toBe('high')
  })

  it('maps CRITICAL severity', () => {
    const cve = osvToCve({ ...mockVuln, database_specific: { severity: 'CRITICAL' } })
    expect(cve.severity).toBe('critical')
  })

  it('maps MODERATE to medium', () => {
    const cve = osvToCve({ ...mockVuln, database_specific: { severity: 'MODERATE' } })
    expect(cve.severity).toBe('medium')
  })

  it('falls back to unknown for unrecognised severity', () => {
    const cve = osvToCve({ ...mockVuln, database_specific: { severity: 'INFORMATIONAL' } })
    expect(cve.severity).toBe('unknown')
  })

  it('extracts fixedInVersion from ranges', () => {
    expect(osvToCve(mockVuln).fixedInVersion).toBe('13.0.4')
  })

  it('returns null fixedInVersion when no fix event', () => {
    const noFix = { ...mockVuln, affected: [{ ranges: [{ type: 'ECOSYSTEM', events: [{ introduced: '0' }] }] }] }
    expect(osvToCve(noFix).fixedInVersion).toBeNull()
  })

  it('uses summary as description', () => {
    expect(osvToCve(mockVuln).description).toBe('Remote code execution via crafted input')
  })
})

describe('queryOsvBatch', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns empty map for empty input', async () => {
    const result = await queryOsvBatch([], 'NuGet')
    expect(result.size).toBe(0)
  })

  it('fetches full vuln details and maps to package names (lowercase)', async () => {
    // First call: batch query returning stubs
    // Subsequent calls: individual vuln detail fetches
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { vulns: [{ id: 'GHSA-xxxx-yyyy-zzzz' }] },
            { vulns: [] },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockVuln,
      })

    vi.stubGlobal('fetch', mockFetch)

    const result = await queryOsvBatch(
      [{ name: 'Newtonsoft.Json', version: '13.0.3' }, { name: 'System.Runtime', version: '4.3.0' }],
      'NuGet',
    )

    expect(result.get('newtonsoft.json')).toHaveLength(1)
    expect(result.get('newtonsoft.json')![0].id).toBe('CVE-2023-12345')
    expect(result.get('system.runtime')).toHaveLength(0)
    // Should have made 2 fetch calls: 1 batch + 1 vuln detail
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('skips vulns whose detail fetch fails and returns the rest', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ vulns: [{ id: 'GHSA-good' }, { id: 'GHSA-bad' }] }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => mockVuln })
      .mockRejectedValueOnce(new Error('network error'))

    vi.stubGlobal('fetch', mockFetch)

    const result = await queryOsvBatch([{ name: 'Pkg', version: '1.0.0' }], 'NuGet')
    // Only the successfully-fetched vuln is included
    expect(result.get('pkg')).toHaveLength(1)
  })

  it('returns empty map when batch fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const result = await queryOsvBatch([{ name: 'Foo', version: '1.0.0' }], 'NuGet')
    expect(result.size).toBe(0)
  })

  it('returns empty map on non-ok batch response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const result = await queryOsvBatch([{ name: 'Foo', version: '1.0.0' }], 'NuGet')
    expect(result.size).toBe(0)
  })

  it('deduplicates vuln detail fetches when a vuln affects multiple packages', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { vulns: [{ id: 'GHSA-shared' }] },
            { vulns: [{ id: 'GHSA-shared' }] },
          ],
        }),
      })
      .mockResolvedValue({ ok: true, json: async () => mockVuln })

    vi.stubGlobal('fetch', mockFetch)

    await queryOsvBatch(
      [{ name: 'PkgA', version: '1.0.0' }, { name: 'PkgB', version: '1.0.0' }],
      'NuGet',
    )

    // Batch call + 1 detail fetch (not 2, because the ID is deduplicated)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
