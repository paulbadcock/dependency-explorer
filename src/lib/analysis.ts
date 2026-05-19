import { createHash } from 'crypto'
import { fetchPackageInfo, computeStaleness } from './pypi'
import { fetchNuGetPackageInfo } from './nuget'
import { queryOsvBatch } from './osv'
import { parseDirectDepNames, parseNuGetLock } from './parser'
import { resolveRequirementsTxt, resolveTransitiveDeps } from './pypi-resolve'
import { computeRollup } from './indicators'
import { analysisSave, analysisGet } from './cache'
import { parse } from 'smol-toml'
import type { Analysis, Package, CVE, PyPIPackageInfo } from './types'

export { analysisGet }

export async function runAnalysis(filename: string, content: string, label?: string): Promise<Analysis> {
  const id = createHash('sha256').update(content).digest('hex').slice(0, 16)

  const cached = await analysisGet(id)
  if (cached && cached.packages.every(p => p.releases)) return cached

  const analysis = filename === 'packages.lock.json'
    ? await runNuGetAnalysis(id, filename, content, label)
    : await runPythonAnalysis(id, filename, content, label)

  await analysisSave(analysis)
  return analysis
}

// ─── Python path (requirements.txt and poetry.lock) ─────────────────────────

interface PoetryLock {
  package?: Array<{ name: string; version: string }>
}

function parsePythonPackages(content: string): Array<{ name: string; version: string }> {
  const parsed = parse(content) as PoetryLock
  return (parsed.package ?? []).map(p => ({ name: p.name, version: p.version }))
}

async function runPythonAnalysis(
  id: string, filename: string, content: string, label?: string,
): Promise<Analysis> {
  const flatDeps = filename.endsWith('.lock')

  // Step 1: resolve all direct packages with pinned versions
  const directPkgs = flatDeps
    ? parsePythonPackages(content)
    : await resolveRequirementsTxt(content)

  const directNames = new Set(parseDirectDepNames(filename, content))
  const pkgMap = new Map(directPkgs.map(p => [p.name.toLowerCase(), p]))

  // Step 2: fetch PyPI info for direct deps (needed to discover requiresDist)
  const infoMap = new Map<string, PyPIPackageInfo>()
  await Promise.allSettled(directPkgs.map(async pkg => {
    const info = await fetchPackageInfo(pkg.name, pkg.version).catch(() => fallbackInfo(pkg.version))
    infoMap.set(pkg.name.toLowerCase(), info)
  }))

  // Step 3: for requirements.txt, resolve transitive deps one level deep
  if (!flatDeps) {
    const allDepNames = [...infoMap.values()].flatMap(info => parsePythonDepNames(info.requiresDist))
    const transitive = await resolveTransitiveDeps(allDepNames, new Set(pkgMap.keys()))
    for (const t of transitive) {
      pkgMap.set(t.name.toLowerCase(), t)
    }
    await Promise.allSettled(transitive.map(async t => {
      const info = await fetchPackageInfo(t.name, t.version).catch(() => fallbackInfo(t.version))
      infoMap.set(t.name.toLowerCase(), info)
    }))
  }

  // Step 4: query OSV for CVEs across all known packages
  const osvMap = await queryOsvBatch([...pkgMap.values()], 'PyPI')

  // Step 5: build Package objects for direct deps only at the top level
  const packages: Package[] = directPkgs
    .filter(p => directNames.has(p.name.toLowerCase()))
    .map(p => buildPythonPackage(p.name, p.version, pkgMap, infoMap, osvMap, true))

  return { id, filename, ...(label ? { label } : {}), createdAt: new Date().toISOString(), packages }
}

function buildPythonPackage(
  name: string,
  version: string,
  pkgMap: Map<string, { name: string; version: string }>,
  infoMap: Map<string, PyPIPackageInfo>,
  osvMap: Map<string, CVE[]>,
  includeDeps: boolean,
): Package {
  const info = infoMap.get(name.toLowerCase()) ?? fallbackInfo(version)
  const staleness = computeStaleness(version, info)
  const cves = osvMap.get(name.toLowerCase()) ?? []

  const dependencies: Package[] = includeDeps
    ? parsePythonDepNames(info.requiresDist).flatMap(depName => {
        const dep = pkgMap.get(depName)
        if (!dep) return []
        const dInfo = infoMap.get(depName) ?? fallbackInfo(dep.version)
        const dStaleness = computeStaleness(dep.version, dInfo)
        const dCves = osvMap.get(depName) ?? []
        const dPkg: Package = {
          name: dep.name,
          installedVersion: dep.version,
          latestVersion: dInfo.latestVersion,
          ...dStaleness,
          cves: dCves,
          releases: dInfo.releases,
          dependencies: [],
          rollup: { totalCves: 0, maxPatchesBehind: 0, hasMajorBehind: false, hasEol: false, maxEolYears: 0 },
        }
        dPkg.rollup = computeRollup(dPkg)
        return [dPkg]
      })
    : []

  const pkg: Package = {
    name,
    installedVersion: version,
    latestVersion: info.latestVersion,
    ...staleness,
    cves,
    releases: info.releases,
    dependencies,
    rollup: { totalCves: 0, maxPatchesBehind: 0, hasMajorBehind: false, hasEol: false, maxEolYears: 0 },
  }
  pkg.rollup = computeRollup(pkg)
  return pkg
}

function parsePythonDepNames(requiresDist: string[]): string[] {
  return requiresDist
    .map(dep => dep.split(/[>=<!~\[;\s(]/)[0]!.trim().toLowerCase().replace(/_/g, '-'))
    .filter(Boolean)
}

// ─── NuGet path ──────────────────────────────────────────────────────────────

async function runNuGetAnalysis(
  id: string, filename: string, content: string, label?: string,
): Promise<Analysis> {
  const { packages: lockPkgs, directNames } = parseNuGetLock(content)
  const pkgMap = new Map(lockPkgs.map(p => [p.name.toLowerCase(), p]))

  const osvMap = await queryOsvBatch(
    lockPkgs.map(p => ({ name: p.name, version: p.version })),
    'NuGet',
  )

  const infoMap = new Map<string, PyPIPackageInfo>()
  await Promise.allSettled(lockPkgs.map(async pkg => {
    try {
      infoMap.set(pkg.name.toLowerCase(), await fetchNuGetPackageInfo(pkg.name, pkg.version))
    } catch {
      infoMap.set(pkg.name.toLowerCase(), fallbackInfo(pkg.version))
    }
  }))

  const packages: Package[] = lockPkgs
    .filter(p => directNames.has(p.name.toLowerCase()))
    .map(p => buildNuGetPackage(p.name, p.version, p.deps, pkgMap, infoMap, osvMap))

  return { id, filename, ...(label ? { label } : {}), createdAt: new Date().toISOString(), packages }
}

function buildNuGetPackage(
  name: string,
  version: string,
  depNames: string[],
  pkgMap: Map<string, { name: string; version: string }>,
  infoMap: Map<string, PyPIPackageInfo>,
  osvMap: Map<string, CVE[]>,
): Package {
  const info = infoMap.get(name.toLowerCase()) ?? fallbackInfo(version)
  const staleness = computeStaleness(version, info)
  const cves = osvMap.get(name.toLowerCase()) ?? []

  const dependencies: Package[] = depNames.flatMap(depName => {
    const dep = pkgMap.get(depName.toLowerCase())
    if (!dep) return []
    const dInfo = infoMap.get(depName.toLowerCase()) ?? fallbackInfo(dep.version)
    const dStaleness = computeStaleness(dep.version, dInfo)
    const dCves = osvMap.get(depName.toLowerCase()) ?? []
    const dPkg: Package = {
      name: dep.name,
      installedVersion: dep.version,
      latestVersion: dInfo.latestVersion,
      ...dStaleness,
      cves: dCves,
      releases: dInfo.releases,
      dependencies: [],
      rollup: { totalCves: 0, maxPatchesBehind: 0, hasMajorBehind: false, hasEol: false, maxEolYears: 0 },
    }
    dPkg.rollup = computeRollup(dPkg)
    return [dPkg]
  })

  const pkg: Package = {
    name,
    installedVersion: version,
    latestVersion: info.latestVersion,
    ...staleness,
    cves,
    releases: info.releases,
    dependencies,
    rollup: { totalCves: 0, maxPatchesBehind: 0, hasMajorBehind: false, hasEol: false, maxEolYears: 0 },
  }
  pkg.rollup = computeRollup(pkg)
  return pkg
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function fallbackInfo(version: string): PyPIPackageInfo {
  return {
    latestVersion: version,
    releases: [{ version, uploadTime: new Date().toISOString() }],
    requiresDist: [],
    lastReleaseDate: new Date().toISOString(),
  }
}
