// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveRequirementsTxt } from './pypi-resolve'

const BLEACH_RELEASES = ['5.0.0', '6.0.0', '6.1.0', '6.1.1', '6.2.0', '6.3.0']

function makePyPIResponse(latest: string, versions: string[]) {
  const releases: Record<string, Array<{ upload_time_iso_8601: string }>> = {}
  versions.forEach((v, i) => {
    releases[v] = [{ upload_time_iso_8601: `2022-0${(i % 9) + 1}-01T00:00:00Z` }]
  })
  return { info: { version: latest }, releases }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('resolveRequirementsTxt', () => {
  it('treats ==X.* as a wildcard, not an exact pin, and resolves via PyPI', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => makePyPIResponse('6.3.0', BLEACH_RELEASES),
    } as Response)

    const result = await resolveRequirementsTxt('bleach==6.*\n')

    // Must NOT produce the literal wildcard string as a version
    expect(result).toHaveLength(1)
    expect(result[0]!.version).not.toBe('6.*')
    expect(result[0]!.version).toMatch(/^\d+\.\d+/)
    // Latest 6.x version should be selected
    expect(result[0]!.version).toBe('6.3.0')
    // PyPI should have been called (not short-circuited)
    expect(fetch).toHaveBeenCalled()
  })

  it('still short-circuits exact pins without hitting PyPI', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)

    const result = await resolveRequirementsTxt('bleach==6.3.0\n')

    expect(result[0]!.version).toBe('6.3.0')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('strips trailing backslash from uv pip compile --hash format', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)

    const uvHashFormat = [
      'awscrt==0.32.2 \\',
      '    --hash=sha256:023a2f4595804a0f1d61ab49b64dda5612be9bfbe9b13759331e8e31658dda3f \\',
      '    --hash=sha256:ffb40027e6779138f6cb9b11a85ef76d00ef6b015de6d8ae8e6598659c4af996',
      '    # via botocore',
    ].join('\n')

    const result = await resolveRequirementsTxt(uvHashFormat)

    expect(result).toHaveLength(1)
    // Version must be clean — no trailing backslash
    expect(result[0]!.version).toBe('0.32.2')
    expect(fetch).not.toHaveBeenCalled()
  })
})
