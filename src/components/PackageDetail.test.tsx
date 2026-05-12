import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PackageDetail } from './PackageDetail'
import type { Package } from '../lib/types'

const MOCK_PKG: Package = {
  name: 'requests',
  installedVersion: '2.28.0',
  latestVersion: '2.32.3',
  patchesBehind: 4,
  majorsBehind: 0,
  lastReleaseDate: '2024-05-01T00:00:00Z',
  cves: [
    { id: 'CVE-2023-32681', severity: 'high', description: 'SSRF via Proxy-Authorization', fixedInVersion: '2.31.0' },
  ],
  dependencies: [],
  rollup: { totalCves: 1, maxPatchesBehind: 4, hasMajorBehind: false, hasEol: false },
}

describe('PackageDetail', () => {
  it('renders package name and versions', () => {
    render(<PackageDetail pkg={MOCK_PKG} />)
    expect(screen.getByText('requests')).toBeInTheDocument()
    expect(screen.getByText(/2\.28\.0/)).toBeInTheDocument()
    expect(screen.getByText(/2\.32\.3/)).toBeInTheDocument()
  })

  it('renders CVE ID and description', () => {
    render(<PackageDetail pkg={MOCK_PKG} />)
    expect(screen.getByText('CVE-2023-32681')).toBeInTheDocument()
    expect(screen.getByText(/SSRF via Proxy-Authorization/)).toBeInTheDocument()
  })

  it('renders fixed-in version', () => {
    render(<PackageDetail pkg={MOCK_PKG} />)
    expect(screen.getByText(/fixed in 2\.31\.0/i)).toBeInTheDocument()
  })

  it('shows "No known CVEs" when clean', () => {
    render(<PackageDetail pkg={{ ...MOCK_PKG, cves: [] }} />)
    expect(screen.getByText(/no known cves/i)).toBeInTheDocument()
  })

  it('shows placeholder when no package selected', () => {
    render(<PackageDetail pkg={null} />)
    expect(screen.getByText(/select a package/i)).toBeInTheDocument()
  })
})
