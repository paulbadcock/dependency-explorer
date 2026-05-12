import { createHash } from 'crypto'
import { runPipAudit } from './pip-audit'
import { fetchPackageInfo, computeStaleness } from './pypi'
import { parseDirectDepNames, toRequirementsTxt } from './parser'
import { computeRollup } from './indicators'
import { analysisSave, analysisGet } from './cache'
import type { Analysis, Package, CVE, PipAuditDependency, PyPIPackageInfo } from './types'

export { analysisGet }

export async function runAnalysis(filename: string, content: string): Promise<Analysis> {
  const id = createHash('sha256').update(content).digest('hex').slice(0, 16)

  const cached = analysisGet(id)
  if (cached) return cached

  const requirementsTxt = toRequirementsTxt(filename, content)
  const directDepNames = new Set(parseDirectDepNames(filename, content))
  const pipDeps = await runPipAudit(requirementsTxt)
  const pipMap = new Map(pipDeps.map(d => [d.name.toLowerCase(), d]))

  const pypiInfoMap = new Map<string, PyPIPackageInfo>()
  await Promise.allSettled(
    pipDeps.map(async dep => {
      try {
        pypiInfoMap.set(dep.name.toLowerCase(), await fetchPackageInfo(dep.name, dep.version))
      } catch {
        pypiInfoMap.set(dep.name.toLowerCase(), fallbackInfo(dep.version))
      }
    })
  )

  const packages: Package[] = pipDeps
    .filter(d => directDepNames.has(d.name.toLowerCase()))
    .map(dep => buildPackage(dep, pipMap, pypiInfoMap))

  const analysis: Analysis = { id, filename, createdAt: new Date().toISOString(), packages }
  analysisSave(analysis)
  return analysis
}

function buildPackage(
  dep: PipAuditDependency,
  pipMap: Map<string, PipAuditDependency>,
  pypiInfoMap: Map<string, PyPIPackageInfo>
): Package {
  const info = pypiInfoMap.get(dep.name.toLowerCase()) ?? fallbackInfo(dep.version)
  const staleness = computeStaleness(dep.version, info)
  const cves = mapCves(dep)

  const dependencies: Package[] = parseDepNames(info.requiresDist).flatMap(name => {
    const td = pipMap.get(name)
    if (!td) return []
    const tInfo = pypiInfoMap.get(name) ?? fallbackInfo(td.version)
    const tStaleness = computeStaleness(td.version, tInfo)
    const tCves = mapCves(td)
    const tPkg: Package = {
      name: td.name,
      installedVersion: td.version,
      latestVersion: tInfo.latestVersion,
      ...tStaleness,
      cves: tCves,
      dependencies: [],
      rollup: {
        totalCves: tCves.length,
        maxPatchesBehind: tStaleness.patchesBehind,
        hasMajorBehind: tStaleness.majorsBehind >= 1,
        hasEol: false,
      },
    }
    return [tPkg]
  })

  const pkg: Package = {
    name: dep.name,
    installedVersion: dep.version,
    latestVersion: info.latestVersion,
    ...staleness,
    cves,
    dependencies,
    rollup: { totalCves: 0, maxPatchesBehind: 0, hasMajorBehind: false, hasEol: false },
  }
  pkg.rollup = computeRollup(pkg)
  return pkg
}

function mapCves(dep: PipAuditDependency): CVE[] {
  return dep.vulns.map(v => ({
    id: v.aliases.find(a => a.startsWith('CVE-')) ?? v.id,
    severity: 'unknown' as const,
    description: v.description,
    fixedInVersion: v.fix_versions[0] ?? null,
  }))
}

function parseDepNames(requiresDist: string[]): string[] {
  return requiresDist
    .map(dep => dep.split(/[>=<!~\[;\s(]/)[0]!.trim().toLowerCase())
    .filter(Boolean)
}

function fallbackInfo(version: string): PyPIPackageInfo {
  return {
    latestVersion: version,
    releases: [{ version, uploadTime: new Date().toISOString() }],
    requiresDist: [],
    lastReleaseDate: new Date().toISOString(),
  }
}
