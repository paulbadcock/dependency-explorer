import { Tooltip } from './Tooltip'

interface StatusBadgeProps {
  type: 'cve' | 'versions' | 'major' | 'healthy' | 'eol'
  count?: number
  years?: number
}

export function StatusBadge({ type, count = 0, years = 0 }: StatusBadgeProps) {
  if (type === 'cve') {
    if (count === 0) return null
    return (
      <Tooltip text={`${count} known security ${count === 1 ? 'hole' : 'holes'} in this version — like a broken lock that hackers already know about. Update to fix ${count === 1 ? 'it' : 'them'}.`}>
        <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-red-badge text-red-text font-mono">
          ● {count} CVE
        </span>
      </Tooltip>
    )
  }
  if (type === 'versions') {
    if (count === 0) return null
    return (
      <Tooltip text={`${count} newer ${count === 1 ? 'version has' : 'versions have'} been released — the authors shipped improvements since this was installed. Not urgent, but worth updating soon.`}>
        <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-yellow-badge text-yellow-text font-mono">
          +{count} ver
        </span>
      </Tooltip>
    )
  }
  if (type === 'major') {
    return (
      <Tooltip text="A big new version exists — like upgrading from a bicycle to a car. It has new features and fixes but may need code changes to adopt.">
        <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-red-badge text-purple-text font-mono">
          ⬆ MAJOR
        </span>
      </Tooltip>
    )
  }
  if (type === 'eol') {
    return (
      <Tooltip text={`End of life — the people who made this stopped fixing it ${years} ${years === 1 ? 'year' : 'years'} ago. No more security patches. Like using a phone that no longer gets updates.`}>
        <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-panel text-muted font-mono">
          ☠ EOL {years}yr
        </span>
      </Tooltip>
    )
  }
  return (
    <Tooltip text="All good — no known security holes and up to date.">
      <span className="rounded px-1.5 py-0.5 text-[0.65rem] bg-green-badge text-green-text font-mono">
        ✓
      </span>
    </Tooltip>
  )
}
