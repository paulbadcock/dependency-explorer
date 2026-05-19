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
  releases: [],
  dependencies: [],
  rollup: { totalCves: 1, maxPatchesBehind: 4, hasMajorBehind: false, hasEol: false, maxEolYears: 0 },
}

const RELEASES = [
  { version: '2.28.0', uploadTime: '2023-01-01T00:00:00Z' },
  { version: '2.29.0', uploadTime: '2023-04-01T00:00:00Z' },
  { version: '2.31.0', uploadTime: '2023-10-01T00:00:00Z' },
  { version: '2.32.3', uploadTime: '2024-05-01T00:00:00Z' },
]

describe('PackageDetail', () => {
  it('renders package name and versions', () => {
    render(<PackageDetail pkg={MOCK_PKG} ecosystem="pypi" />)
    expect(screen.getByText('requests')).toBeInTheDocument()
    expect(screen.getByText(/2\.28\.0/)).toBeInTheDocument()
    expect(screen.getByText(/2\.32\.3/)).toBeInTheDocument()
  })

  it('renders CVE ID and description', () => {
    render(<PackageDetail pkg={MOCK_PKG} ecosystem="pypi" />)
    expect(screen.getByText('CVE-2023-32681')).toBeInTheDocument()
    expect(screen.getByText(/SSRF via Proxy-Authorization/)).toBeInTheDocument()
  })

  it('renders fixed-in version', () => {
    render(<PackageDetail pkg={MOCK_PKG} ecosystem="pypi" />)
    expect(screen.getByText(/fixed in 2\.31\.0/i)).toBeInTheDocument()
  })

  it('shows "No known CVEs" when clean', () => {
    render(<PackageDetail pkg={{ ...MOCK_PKG, cves: [] }} ecosystem="pypi" />)
    expect(screen.getByText(/no known cves/i)).toBeInTheDocument()
  })

  it('shows placeholder when no package selected', () => {
    render(<PackageDetail pkg={null} ecosystem="pypi" />)
    expect(screen.getByText(/select a package/i)).toBeInTheDocument()
  })

  it('renders release timeline section when releases are provided', () => {
    render(<PackageDetail pkg={{ ...MOCK_PKG, releases: RELEASES }} ecosystem="pypi" />)
    expect(screen.getByText(/version timeline/i)).toBeInTheDocument()
    expect(screen.getByText('2.29.0')).toBeInTheDocument()
    expect(screen.getByText('2.31.0')).toBeInTheDocument()
  })

  it('marks installed and latest versions in the timeline', () => {
    render(<PackageDetail pkg={{ ...MOCK_PKG, releases: RELEASES }} ecosystem="pypi" />)
    const installed = screen.getAllByText('2.28.0')
    const latest = screen.getAllByText('2.32.3')
    expect(installed.length).toBeGreaterThanOrEqual(1)
    expect(latest.length).toBeGreaterThanOrEqual(1)
  })

  it('shows CVE indicator only on releases where CVE is active', () => {
    render(<PackageDetail pkg={{ ...MOCK_PKG, releases: RELEASES }} ecosystem="pypi" />)
    // 2.31.0 is the fix version — dot should not appear in that row
    // 2.29.0 is before the fix — dot should appear in that row
    const rows = document.querySelectorAll('[data-release]')
    const row229 = Array.from(rows).find(r => r.getAttribute('data-release') === '2.29.0')
    const row231 = Array.from(rows).find(r => r.getAttribute('data-release') === '2.31.0')
    expect(row229?.querySelectorAll('[data-cve-dot]').length).toBe(1)
    expect(row231?.querySelectorAll('[data-cve-dot]').length).toBe(0)
  })

  it('renders CVE ID as a link to OSV', () => {
    render(<PackageDetail pkg={MOCK_PKG} ecosystem="pypi" />)
    const link = screen.getByRole('link', { name: /CVE-2023-32681/ })
    expect(link).toHaveAttribute('href', 'https://osv.dev/vulnerability/CVE-2023-32681')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('renders an NVD link for CVE- format IDs', () => {
    render(<PackageDetail pkg={MOCK_PKG} ecosystem="pypi" />)
    const nvdLink = screen.getByRole('link', { name: 'NVD' })
    expect(nvdLink).toHaveAttribute('href', 'https://nvd.nist.gov/vuln/detail/CVE-2023-32681')
    expect(nvdLink).toHaveAttribute('target', '_blank')
    expect(nvdLink).toHaveAttribute('rel', 'noreferrer')
  })

  it('does not render an NVD link for GHSA- format IDs', () => {
    const ghsaPkg: Package = {
      ...MOCK_PKG,
      cves: [{ id: 'GHSA-abcd-1234-efgh', severity: 'high', description: 'test vuln', fixedInVersion: null }],
    }
    render(<PackageDetail pkg={ghsaPkg} ecosystem="pypi" />)
    expect(screen.queryByRole('link', { name: 'NVD' })).not.toBeInTheDocument()
  })

  it('renders package name as a PyPI link', () => {
    render(<PackageDetail pkg={MOCK_PKG} ecosystem="pypi" />)
    const link = screen.getByRole('link', { name: /requests/ })
    expect(link).toHaveAttribute('href', 'https://pypi.org/project/requests')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('renders package name as a NuGet link', () => {
    render(<PackageDetail pkg={{ ...MOCK_PKG, name: 'Newtonsoft.Json' }} ecosystem="nuget" />)
    const link = screen.getByRole('link', { name: /Newtonsoft\.Json/ })
    expect(link).toHaveAttribute('href', 'https://www.nuget.org/packages/Newtonsoft.Json')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })
})
