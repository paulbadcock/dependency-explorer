import type { Package, CVE } from '../lib/types'

export function PackageDetail({ pkg }: { pkg: Package | null }) {
  if (!pkg) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Select a package from the tree to see details
      </div>
    )
  }

  const daysSince = Math.floor(
    (Date.now() - new Date(pkg.lastReleaseDate).getTime()) / (1000 * 60 * 60 * 24)
  )
  const yearsSince = Math.floor(daysSince / 365)

  return (
    <div className="p-4 overflow-auto h-full text-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="font-mono font-bold text-lg">{pkg.name}</h2>
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
        <span className="font-mono text-xs">{cve.id}</span>
        <span className="text-muted text-xs uppercase">{cve.severity}</span>
      </div>
      <p className="text-muted text-xs mt-1">{cve.description}</p>
      {cve.fixedInVersion && (
        <p className="text-green-text text-xs mt-1">Fixed in {cve.fixedInVersion}</p>
      )}
    </div>
  )
}
