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
