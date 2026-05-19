import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DependencyTree } from './DependencyTree'
import type { Package } from '../lib/types'

function makePackage(name: string, overrides: Partial<Package> = {}): Package {
  return {
    name,
    installedVersion: '1.0.0',
    latestVersion: '1.0.0',
    patchesBehind: 0,
    majorsBehind: 0,
    lastReleaseDate: new Date().toISOString(),
    cves: [],
    releases: [],
    dependencies: [],
    rollup: { totalCves: 0, maxPatchesBehind: 0, hasMajorBehind: false, hasEol: false, maxEolYears: 0 },
    ...overrides,
  }
}

const PACKAGES: Package[] = [
  makePackage('requests', {
    patchesBehind: 4,
    dependencies: [makePackage('urllib3'), makePackage('certifi')],
    rollup: { totalCves: 0, maxPatchesBehind: 4, hasMajorBehind: false, hasEol: false },
  }),
  makePackage('fastapi'),
]

describe('DependencyTree', () => {
  it('renders top-level packages', () => {
    render(<DependencyTree packages={PACKAGES} onSelect={() => {}} selected={null} />)
    expect(screen.getByText('requests')).toBeInTheDocument()
    expect(screen.getByText('fastapi')).toBeInTheDocument()
  })

  it('hides children by default', () => {
    render(<DependencyTree packages={PACKAGES} onSelect={() => {}} selected={null} />)
    expect(screen.queryByText('urllib3')).not.toBeInTheDocument()
  })

  it('expands children on click', () => {
    render(<DependencyTree packages={PACKAGES} onSelect={() => {}} selected={null} />)
    fireEvent.click(screen.getByText('requests'))
    expect(screen.getByText('urllib3')).toBeInTheDocument()
    expect(screen.getByText('certifi')).toBeInTheDocument()
  })

  it('calls onSelect with the clicked package', () => {
    const onSelect = vi.fn()
    render(<DependencyTree packages={PACKAGES} onSelect={onSelect} selected={null} />)
    fireEvent.click(screen.getByText('fastapi'))
    expect(onSelect).toHaveBeenCalledWith(PACKAGES[1])
  })

  it('marks the selected package with data-selected=true', () => {
    render(<DependencyTree packages={PACKAGES} onSelect={() => {}} selected={PACKAGES[1]!} />)
    const row = screen.getByText('fastapi').closest('[data-selected]')
    expect(row).toHaveAttribute('data-selected', 'true')
  })
})
