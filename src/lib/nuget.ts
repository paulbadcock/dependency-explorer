import { pkgCacheGet, pkgCacheSet } from './cache'
import type { PyPIPackageInfo, PyPIRelease } from './types'

const PKG_CACHE_TTL = 24 * 60 * 60 * 1000
const NUGET_REGISTRATION = 'https://api.nuget.org/v3/registration5-semver1'
const NUGET_FLATCONTAINER = 'https://api.nuget.org/v3-flatcontainer'

interface CatalogEntry {
  version: string
  listed?: boolean
  published: string
}

interface RegistrationPage {
  '@id': string
  items?: Array<{ catalogEntry: CatalogEntry }>
}

interface RegistrationIndex {
  items?: RegistrationPage[]
}

function isPreRelease(version: string): boolean {
  return version.includes('-')
}

function semverCmp(a: string, b: string): number {
  const pa = a.split(/[-+]/)[0]!.split('.').map(s => parseInt(s, 10) || 0)
  const pb = b.split(/[-+]/)[0]!.split('.').map(s => parseInt(s, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

export async function fetchNuGetPackageInfo(
  name: string,
  installedVersion: string,
): Promise<PyPIPackageInfo> {
  const id = name.toLowerCase()
  const cacheKey = `nuget:${id}@${installedVersion}`
  const cached = await pkgCacheGet<PyPIPackageInfo>(cacheKey)
  if (cached) return cached

  const releases = await fetchReleases(id)
  const latest = releases.at(-1)

  const info: PyPIPackageInfo = {
    latestVersion: latest?.version ?? installedVersion,
    releases,
    requiresDist: [],
    lastReleaseDate: latest?.uploadTime ?? new Date().toISOString(),
  }

  await pkgCacheSet(cacheKey, info, PKG_CACHE_TTL)
  return info
}

async function fetchReleases(id: string): Promise<PyPIRelease[]> {
  try {
    const res = await fetch(`${NUGET_REGISTRATION}/${id}/index.json`)
    if (!res.ok) return []

    const index = await res.json() as RegistrationIndex
    const releases: PyPIRelease[] = []

    for (const page of index.items ?? []) {
      let items = page.items
      if (!items) {
        // Paginated page — fetch it
        try {
          const pageRes = await fetch(page['@id'])
          if (pageRes.ok) {
            const pageData = await pageRes.json() as { items?: Array<{ catalogEntry: CatalogEntry }> }
            items = pageData.items
          }
        } catch {
          continue
        }
      }
      for (const item of items ?? []) {
        const e = item.catalogEntry
        if (e.listed === false || isPreRelease(e.version)) continue
        releases.push({ version: e.version, uploadTime: e.published })
      }
    }

    if (releases.length === 0) return await fetchVersionsOnly(id)

    releases.sort((a, b) => semverCmp(a.version, b.version))
    return releases
  } catch {
    return []
  }
}

// Fallback: flat container gives versions only, no dates
async function fetchVersionsOnly(id: string): Promise<PyPIRelease[]> {
  try {
    const res = await fetch(`${NUGET_FLATCONTAINER}/${id}/index.json`)
    if (!res.ok) return []
    const data = await res.json() as { versions?: string[] }
    return (data.versions ?? [])
      .filter(v => !isPreRelease(v))
      .map(v => ({ version: v, uploadTime: new Date().toISOString() }))
      .sort((a, b) => semverCmp(a.version, b.version))
  } catch {
    return []
  }
}
