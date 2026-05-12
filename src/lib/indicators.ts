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
    maxPatchesBehind: all.reduce((max, p) => Math.max(max, p.patchesBehind), 0),
    hasMajorBehind: all.some(p => p.majorsBehind >= 1),
    hasEol: all.some(p => getPackageStatus(p) === 'eol'),
  }
}
