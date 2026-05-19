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
    releases: [],
    dependencies: [],
    rollup: { totalCves: 0, maxPatchesBehind: 0, hasMajorBehind: false, hasEol: false, maxEolYears: 0 },
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

  it('maxEolYears reflects the worst-case eol dep, not the parent', () => {
    const old = new Date()
    old.setFullYear(old.getFullYear() - 3)
    const child = makePackage({ lastReleaseDate: old.toISOString() })
    const parent = makePackage({ dependencies: [child] })
    const rollup = computeRollup(parent)
    expect(rollup.hasEol).toBe(true)
    expect(rollup.maxEolYears).toBeGreaterThanOrEqual(3)
  })

  it('returns zero maxPatchesBehind for a package with no dependencies', () => {
    expect(computeRollup(makePackage()).maxPatchesBehind).toBe(0)
  })
})
