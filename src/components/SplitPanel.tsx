import { useState, useRef, useCallback } from 'react'
import { DependencyTree } from './DependencyTree'
import { PackageDetail } from './PackageDetail'
import { Tooltip } from './Tooltip'
import type { Package } from '../lib/types'

type FilterKey = 'cves' | 'major' | 'eol'
type SortKey = 'name' | 'date'
type SortDir = 'asc' | 'desc'

function getInstalledDate(pkg: Package): string {
  return pkg.releases.find(r => r.version === pkg.installedVersion)?.uploadTime ?? ''
}

function isUpToDate(pkg: Package): boolean {
  return pkg.rollup.totalCves === 0 && !pkg.rollup.hasMajorBehind &&
    !pkg.rollup.hasEol && pkg.rollup.maxPatchesBehind === 0
}

export function SplitPanel({ packages, ecosystem }: { packages: Package[]; ecosystem: 'pypi' | 'nuget' }) {
  const [selected, setSelected] = useState<Package | null>(packages[0] ?? null)
  const [leftPct, setLeftPct] = useState(40)
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set())
  const [hideUpToDate, setHideUpToDate] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const containerRef = useRef<HTMLDivElement>(null)

  const totalCves = packages.reduce((s, p) => s + p.rollup.totalCves, 0)
  const majorsCount = packages.filter(p => p.rollup.hasMajorBehind).length
  const eolCount = packages.filter(p => p.rollup.hasEol).length
  const upToDateCount = packages.filter(isUpToDate).length

  function toggleFilter(key: FilterKey) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filteredPackages = packages.filter(pkg => {
    if (hideUpToDate && isUpToDate(pkg)) return false
    if (activeFilters.size === 0) return true
    return (
      (activeFilters.has('cves') && pkg.rollup.totalCves > 0) ||
      (activeFilters.has('major') && pkg.rollup.hasMajorBehind) ||
      (activeFilters.has('eol') && pkg.rollup.hasEol)
    )
  })

  const sortedPackages = [...filteredPackages].sort((a, b) => {
    const cmp = sortKey === 'name'
      ? a.name.localeCompare(b.name)
      : getInstalledDate(a).localeCompare(getInstalledDate(b))
    return sortDir === 'asc' ? cmp : -cmp
  })

  const effectiveSelected =
    selected && filteredPackages.some(p => p.name === selected.name) ? selected : null

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setLeftPct(Math.min(70, Math.max(15, pct)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      <div className="grid grid-cols-4 border-b border-border flex-shrink-0">
        <StatFilter
          active={activeFilters.has('cves')}
          onClick={() => toggleFilter('cves')}
          value={totalCves}
          label="CVEs"
          valueClass={totalCves > 0 ? 'text-red-text' : 'text-green-text'}
          tooltip="Known security holes — like broken locks that hackers already know about. Click to filter the list to only packages with CVEs."
        />
        <StatFilter
          active={activeFilters.has('major')}
          onClick={() => toggleFilter('major')}
          value={majorsCount}
          label="Major behind"
          valueClass={majorsCount > 0 ? 'text-purple-text' : 'text-muted'}
          tooltip="Packages where a big new version exists — like upgrading from a bicycle to a car. May need code changes to adopt. Click to filter to just these."
        />
        <StatFilter
          active={activeFilters.has('eol')}
          onClick={() => toggleFilter('eol')}
          value={eolCount}
          label="EOL"
          valueClass={eolCount > 0 ? 'text-muted' : 'text-green-text'}
          tooltip="End of life — the authors stopped fixing these packages, so no more security patches. Like using a phone that no longer gets updates. Click to filter to just these."
        />
        <StatFilter
          active={hideUpToDate}
          onClick={() => setHideUpToDate(h => !h)}
          value={`${upToDateCount}/${packages.length}`}
          label="Up to date"
          valueClass="text-green-text"
          exclusion
          tooltip="Packages with no known issues and on the latest version. Click to hide these and focus on the ones that need attention."
        />
      </div>

      <div ref={containerRef} className="flex flex-1 overflow-hidden select-none">
        <div style={{ width: `${leftPct}%` }} className="shrink-0 overflow-auto flex flex-col">
          <div className="flex items-center px-2 pt-1.5 pb-1 border-b border-border flex-shrink-0">
            <SortButton label="Package" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
            <div className="ml-auto" />
            <div className="w-[46px] pr-2 flex justify-end flex-shrink-0">
              <SortButton label="Rel." active={sortKey === 'date'} dir={sortDir} onClick={() => toggleSort('date')} />
            </div>
          </div>
          <div className="overflow-auto py-1 flex-1">
            <DependencyTree
              packages={sortedPackages}
              selected={effectiveSelected}
              onSelect={setSelected}
            />
          </div>
        </div>
        <div
          className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-muted transition-colors"
          onMouseDown={onDragStart}
        />
        <div className="flex-1 overflow-auto min-w-0">
          <PackageDetail pkg={effectiveSelected} ecosystem={ecosystem} />
        </div>
      </div>
    </div>
  )
}

function SortButton({ label, active, dir, onClick }: {
  label: string; active: boolean; dir: SortDir; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-0.5 text-xs uppercase tracking-widest transition-colors hover:text-white ${
        active ? 'text-white' : 'text-muted'
      }`}
    >
      <span>{label}</span>
      <span className="w-3 text-center">{active ? (dir === 'asc' ? '↑' : '↓') : ''}</span>
    </button>
  )
}

function StatFilter({
  active,
  onClick,
  value,
  label,
  valueClass,
  exclusion = false,
  tooltip,
}: {
  active: boolean
  onClick: () => void
  value: number | string
  label: string
  valueClass: string
  exclusion?: boolean
  tooltip: string
}) {
  return (
    <Tooltip text={tooltip}>
      <button
        onClick={onClick}
        className={`w-full px-4 py-2 text-center border-r border-border last:border-r-0 transition-colors hover:bg-panel cursor-pointer ${
          active ? 'bg-panel' : ''
        }`}
      >
        <div className={`font-bold text-lg ${exclusion && active ? 'text-muted line-through' : valueClass}`}>
          {value}
        </div>
        <div className={`text-xs uppercase tracking-widest transition-colors ${active ? 'text-foreground' : 'text-muted'}`}>
          {label}
        </div>
      </button>
    </Tooltip>
  )
}
