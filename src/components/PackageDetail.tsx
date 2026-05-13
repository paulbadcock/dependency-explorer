import { useState } from 'react'
import type { Package, CVE, PyPIRelease } from '../lib/types'

const TIMELINE_COLLAPSED = 4

function cvesAffecting(releaseVersion: string, cves: CVE[], allReleases: PyPIRelease[]): CVE[] {
  const releaseIdx = allReleases.findIndex(r => r.version === releaseVersion)
  if (releaseIdx < 0) return []
  return cves.filter(cve => {
    if (!cve.fixedInVersion) return true
    const fixIdx = allReleases.findIndex(r => r.version === cve.fixedInVersion)
    return fixIdx < 0 || releaseIdx < fixIdx
  })
}

const SEV_COLOR: Record<CVE['severity'], string> = {
  critical: 'bg-red-text', high: 'bg-red-text',
  medium: 'bg-yellow-text', low: 'bg-green-text', unknown: 'bg-muted',
}

export function PackageDetail({ pkg, ecosystem }: { pkg: Package | null; ecosystem: 'pypi' | 'nuget' }) {
  const [timelineExpanded, setTimelineExpanded] = useState(false)

  if (!pkg) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Select a package from the tree to see details
      </div>
    )
  }

  const registryUrl = ecosystem === 'nuget'
    ? `https://www.nuget.org/packages/${pkg.name}`
    : `https://pypi.org/project/${pkg.name}`

  const daysSince = Math.floor(
    (Date.now() - new Date(pkg.lastReleaseDate).getTime()) / (1000 * 60 * 60 * 24)
  )
  const yearsSince = Math.floor(daysSince / 365)

  const releases = pkg.releases ?? []
  const installedIdx = releases.findIndex(r => r.version === pkg.installedVersion)
  const latestIdx = releases.findIndex(r => r.version === pkg.latestVersion)
  // newest first (top → down)
  const timelineReleases =
    installedIdx >= 0 && latestIdx >= 0 && installedIdx <= latestIdx
      ? [...releases.slice(installedIdx, latestIdx + 1)].reverse()
      : null

  return (
    <div className="p-4 overflow-auto h-full text-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <a
            href={registryUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono font-bold text-lg hover:underline"
          >
            {pkg.name}
            <span aria-hidden="true"> ↗</span>
          </a>
          <p className="text-muted text-xs mt-0.5">
            installed: <span className="text-red-text font-mono">{pkg.installedVersion}</span>
            {' · '}
            latest: <span className="text-green-text font-mono">{pkg.latestVersion}</span>
          </p>
        </div>
        <div className="text-xs text-right space-y-0.5">
          {pkg.patchesBehind > 0 && (
            <div className="text-yellow-text">{pkg.patchesBehind} releases behind</div>
          )}
          {pkg.majorsBehind > 0 && (
            <div className="text-purple-text">{pkg.majorsBehind} major behind</div>
          )}
          {daysSince > 730 && (
            <div className="text-muted">☠ No release in {yearsSince}yr</div>
          )}
        </div>
      </div>

      {timelineReleases && (
        <div className="mb-4">
          <h3 className="text-xs uppercase tracking-widest text-muted mb-2">Version Timeline</h3>
          <div className="flex flex-col">
            {(timelineExpanded ? timelineReleases : timelineReleases.slice(0, TIMELINE_COLLAPSED)).map((release, i, arr) => {
              const isInstalled = release.version === pkg.installedVersion
              const isLatest = release.version === pkg.latestVersion
              const isLast = i === arr.length - 1
              const affected = cvesAffecting(release.version, pkg.cves, releases)
              return (
                <div key={release.version} data-release={release.version} className="flex gap-2">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${
                      isLatest ? 'bg-green-text' : isInstalled ? 'bg-red-text' : 'bg-border'
                    }`} />
                    {!isLast && <div className="w-px flex-1 bg-border my-0.5" />}
                  </div>
                  <div className="flex items-center gap-3 pb-2 min-w-0">
                    <span className={`font-mono text-xs font-semibold shrink-0 ${
                      isLatest ? 'text-green-text' : isInstalled ? 'text-red-text' : 'text-foreground'
                    }`}>
                      {release.version}
                    </span>
                    <span className="text-muted text-xs shrink-0">
                      {new Date(release.uploadTime).toLocaleDateString()}
                    </span>
                    {isLatest && <span className="text-green-text text-xs">← latest</span>}
                    {isInstalled && !isLatest && <span className="text-red-text text-xs">← you</span>}
                    <span className="flex gap-0.5 items-center ml-auto">
                      {affected.map(cve => (
                        <span
                          key={cve.id}
                          data-cve-dot
                          className={`inline-block w-1.5 h-1.5 rounded-full ${SEV_COLOR[cve.severity]}`}
                          title={cve.id}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          {timelineReleases.length > TIMELINE_COLLAPSED && (
            <button
              onClick={() => setTimelineExpanded(e => !e)}
              className="mt-1 text-xs text-muted hover:text-white transition-colors"
            >
              {timelineExpanded
                ? '↑ show less'
                : `↓ ${timelineReleases.length - TIMELINE_COLLAPSED} more versions`}
            </button>
          )}
        </div>
      )}

      <h3 className="text-xs uppercase tracking-widest text-muted mb-2">CVEs</h3>
      {pkg.cves.length === 0 ? (
        <p className="text-green-text text-xs">No known CVEs for this version</p>
      ) : (
        <div className="flex flex-col gap-2">
          {pkg.cves.map(cve => <CveCard key={cve.id} cve={cve} />)}
        </div>
      )}

      {pkg.patchesBehind > 0 && (
        <div className="mt-4">
          <h3 className="text-xs uppercase tracking-widest text-muted mb-2">Last release</h3>
          <p className="text-muted text-xs">
            {new Date(pkg.lastReleaseDate).toLocaleDateString()} ({daysSince} days ago)
          </p>
        </div>
      )}
    </div>
  )
}

function CveCard({ cve }: { cve: CVE }) {
  const borderColor = {
    critical: 'border-red-text', high: 'border-red-text',
    medium: 'border-yellow-text', low: 'border-green-text', unknown: 'border-muted',
  }[cve.severity]

  return (
    <div className={`bg-surface rounded-md p-3 border-l-2 ${borderColor}`}>
      <div className="flex justify-between">
        <span className="flex items-center gap-2">
          <a
            href={`https://osv.dev/vulnerability/${cve.id}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs hover:underline"
          >
            {cve.id}
          </a>
          {cve.id.startsWith('CVE-') && (
            <a
              href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-muted text-xs hover:text-white transition-colors"
            >
              NVD <span aria-hidden="true">↗</span>
            </a>
          )}
        </span>
        <span className="text-muted text-xs uppercase">{cve.severity}</span>
      </div>
      <p className="text-muted text-xs mt-1">{cve.description}</p>
      {cve.fixedInVersion && (
        <p className="text-green-text text-xs mt-1">Fixed in {cve.fixedInVersion}</p>
      )}
    </div>
  )
}
