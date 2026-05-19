export interface CVE {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown'
  description: string
  fixedInVersion: string | null
}

export interface Rollup {
  totalCves: number
  maxPatchesBehind: number
  hasMajorBehind: boolean
  hasEol: boolean
  maxEolYears: number
}

export interface Package {
  name: string
  installedVersion: string
  latestVersion: string
  patchesBehind: number
  majorsBehind: number
  lastReleaseDate: string   // ISO string of the latest release
  cves: CVE[]
  releases: PyPIRelease[]   // all stable releases, oldest → newest
  dependencies: Package[]   // one level deep (transitive)
  rollup: Rollup
}

export interface Analysis {
  id: string
  filename: string
  label?: string            // user-supplied note, used as display name
  createdAt: string         // ISO string
  packages: Package[]       // direct dependencies only at top level
}

export interface RecentAnalysis {
  id: string
  filename: string
  label?: string
  createdAt: number         // unix ms
  totalCves: number
}

// PyPI JSON API shapes
export interface PyPIRelease {
  version: string
  uploadTime: string        // ISO string
}

export interface PyPIPackageInfo {
  latestVersion: string
  releases: PyPIRelease[]   // sorted oldest to newest, pre-releases excluded
  requiresDist: string[]    // PEP 508 dep strings for the installed version
  lastReleaseDate: string   // ISO string of the most recent stable release
}
