interface StatusBadgeProps {
  type: 'cve' | 'versions' | 'major' | 'healthy' | 'eol'
  count?: number
  years?: number
}

export function StatusBadge({ type, count = 0, years = 0 }: StatusBadgeProps) {
  if (type === 'cve') {
    if (count === 0) return null
    return (
      <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-red-badge text-red-text font-mono">
        ● {count} CVE
      </span>
    )
  }
  if (type === 'versions') {
    if (count === 0) return null
    return (
      <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-yellow-badge text-yellow-text font-mono">
        +{count} ver
      </span>
    )
  }
  if (type === 'major') {
    return (
      <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-red-badge text-purple-text font-mono">
        ⬆ MAJOR
      </span>
    )
  }
  if (type === 'eol') {
    return (
      <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-panel text-muted font-mono">
        ☠ EOL {years}yr
      </span>
    )
  }
  return (
    <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-green-badge text-green-text font-mono">
      ✓
    </span>
  )
}
