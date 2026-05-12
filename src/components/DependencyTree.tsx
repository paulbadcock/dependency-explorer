import { useState } from 'react'
import { StatusBadge } from './StatusBadge'
import { getPackageStatus } from '../lib/indicators'
import type { Package } from '../lib/types'

interface TreeProps {
  packages: Package[]
  selected: Package | null
  onSelect: (pkg: Package) => void
}

export function DependencyTree({ packages, selected, onSelect }: TreeProps) {
  return (
    <div className="font-mono text-sm select-none">
      {packages.map(pkg => (
        <TreeNode key={pkg.name} pkg={pkg} selected={selected} onSelect={onSelect} depth={0} />
      ))}
    </div>
  )
}

function TreeNode({
  pkg, selected, onSelect, depth,
}: { pkg: Package; selected: Package | null; onSelect: (p: Package) => void; depth: number }) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = pkg.dependencies.length > 0
  const isSelected = selected?.name === pkg.name
  const status = getPackageStatus(pkg)

  const statusColor = {
    critical: 'text-red-text',
    eol: 'text-muted',
    warning: 'text-yellow-text',
    healthy: 'text-green-text',
  }[status]

  const yearsSince = Math.floor(
    (Date.now() - new Date(pkg.lastReleaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365)
  )

  function handleClick() {
    if (hasChildren) setExpanded(e => !e)
    onSelect(pkg)
  }

  return (
    <div>
      <div
        data-selected={isSelected}
        onClick={handleClick}
        className={`flex items-center gap-1.5 py-1 cursor-pointer rounded transition-colors hover:bg-panel ${
          isSelected ? 'bg-panel border-l-2 border-blue-400' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className={statusColor}>
          <span aria-hidden="true">{hasChildren ? (expanded ? '▼' : '▶') : '↳'} </span>
          <span>{pkg.name}</span>
        </span>
        <div className="flex gap-1 ml-auto mr-2 flex-shrink-0">
          {pkg.rollup.totalCves > 0 && <StatusBadge type="cve" count={pkg.rollup.totalCves} />}
          {pkg.rollup.hasMajorBehind && <StatusBadge type="major" />}
          {pkg.rollup.hasEol && <StatusBadge type="eol" years={yearsSince} />}
          {!pkg.rollup.hasMajorBehind && pkg.rollup.maxPatchesBehind > 0 && (
            <StatusBadge type="versions" count={pkg.rollup.maxPatchesBehind} />
          )}
          {pkg.rollup.totalCves === 0 && pkg.rollup.maxPatchesBehind === 0 && !pkg.rollup.hasEol && (
            <StatusBadge type="healthy" />
          )}
        </div>
      </div>
      {expanded && pkg.dependencies.map(dep => (
        <TreeNode key={dep.name} pkg={dep} selected={selected} onSelect={onSelect} depth={depth + 1} />
      ))}
    </div>
  )
}
