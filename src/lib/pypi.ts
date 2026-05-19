import { pkgCacheGet, pkgCacheSet } from './cache'
import type { PyPIPackageInfo, PyPIRelease } from './types'

const PKG_CACHE_TTL = 24 * 60 * 60 * 1000
const PEP440_PRE_RE = /(a|b|rc)\d+$/

export async function fetchPackageInfo(name: string, installedVersion: string): Promise<PyPIPackageInfo> {
  const cacheKey = `pypi:${name.toLowerCase()}@${installedVersion}`
  const cached = await pkgCacheGet<PyPIPackageInfo>(cacheKey)
  if (cached) return cached

  const [latestData, versionData] = await Promise.all([
    fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`),
    fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(installedVersion)}/json`)
      .catch(() => null),
  ])

  const releases = buildReleaseList(
    (latestData as any).releases as Record<string, Array<{ upload_time_iso_8601: string }>>
  )

  const info: PyPIPackageInfo = {
    latestVersion: (latestData as any).info.version as string,
    releases,
    requiresDist: ((versionData as any)?.info?.requires_dist as string[] | null) ?? [],
    lastReleaseDate: releases.at(-1)?.uploadTime ?? new Date().toISOString(),
  }

  await pkgCacheSet(cacheKey, info, PKG_CACHE_TTL)
  return info
}

export function computeStaleness(
  installedVersion: string,
  info: PyPIPackageInfo
): { patchesBehind: number; majorsBehind: number; lastReleaseDate: string } {
  const idx = info.releases.findIndex(r => r.version === installedVersion)
  if (idx === -1) {
    return { patchesBehind: 0, majorsBehind: 0, lastReleaseDate: info.lastReleaseDate }
  }
  const patchesBehind = info.releases.length - 1 - idx
  const installedMajor = parseInt(installedVersion.split('.')[0] ?? '0', 10)
  const latestMajor = parseInt(info.latestVersion.split('.')[0] ?? '0', 10)
  return {
    patchesBehind,
    majorsBehind: Math.max(0, latestMajor - installedMajor),
    lastReleaseDate: info.lastReleaseDate,
  }
}

function buildReleaseList(
  rawReleases: Record<string, Array<{ upload_time_iso_8601: string }>>
): PyPIRelease[] {
  return Object.entries(rawReleases)
    .filter(([version, files]) =>
      files.length > 0 &&
      !PEP440_PRE_RE.test(version)
    )
    .map(([version, files]) => ({ version, uploadTime: files[0]!.upload_time_iso_8601 }))
    .sort((a, b) => new Date(a.uploadTime).getTime() - new Date(b.uploadTime).getTime())
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`PyPI API ${res.status}: ${url}`)
  return res.json()
}
