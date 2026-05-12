import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PipAuditDependency, PyPIPackageInfo } from './types'

vi.mock('./pip-audit', () => ({
  runPipAudit: vi.fn(),
  PipAuditNotFoundError: class extends Error {},
}))
vi.mock('./pypi', () => ({
  fetchPackageInfo: vi.fn(),
  computeStaleness: vi.fn(),
}))
vi.mock('./cache', () => ({
  analysisGet: vi.fn().mockReturnValue(null),
  analysisSave: vi.fn(),
  resetForTest: vi.fn(),
}))

import { runPipAudit } from './pip-audit'
import { fetchPackageInfo, computeStaleness } from './pypi'
import { runAnalysis } from './analysis'

const REQUIREMENTS = 'requests==2.28.0\n'

const MOCK_PIP_DEPS: PipAuditDependency[] = [
  { name: 'requests', version: '2.28.0', vulns: [] },
  { name: 'urllib3', version: '1.26.18', vulns: [
    { id: 'GHSA-v845', fix_versions: ['1.26.19'], aliases: ['CVE-2023-45803'], description: 'test vuln' },
  ]},
  { name: 'certifi', version: '2023.1.1', vulns: [] },
]

const MOCK_PYPI_INFO: PyPIPackageInfo = {
  latestVersion: '2.32.3',
  releases: [
    { version: '2.28.0', uploadTime: '2022-06-01T00:00:00Z' },
    { version: '2.32.3', uploadTime: '2024-05-01T00:00:00Z' },
  ],
  requiresDist: ['urllib3>=1.21.1', 'certifi>=2017.4.17'],
  lastReleaseDate: '2024-05-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(runPipAudit).mockResolvedValue(MOCK_PIP_DEPS)
  vi.mocked(fetchPackageInfo).mockResolvedValue(MOCK_PYPI_INFO)
  vi.mocked(computeStaleness).mockReturnValue({
    patchesBehind: 1,
    majorsBehind: 0,
    lastReleaseDate: '2024-05-01T00:00:00Z',
  })
})

describe('runAnalysis', () => {
  it('returns an Analysis with a 16-char hex id', async () => {
    const analysis = await runAnalysis('requirements.txt', REQUIREMENTS)
    expect(analysis.id).toMatch(/^[a-f0-9]{16}$/)
    expect(analysis.filename).toBe('requirements.txt')
  })

  it('only puts direct deps at the top level', async () => {
    const analysis = await runAnalysis('requirements.txt', REQUIREMENTS)
    expect(analysis.packages).toHaveLength(1)
    expect(analysis.packages[0]!.name).toBe('requests')
  })

  it('populates transitive deps one level deep from requiresDist', async () => {
    const analysis = await runAnalysis('requirements.txt', REQUIREMENTS)
    const depNames = analysis.packages[0]!.dependencies.map(d => d.name)
    expect(depNames).toContain('urllib3')
    expect(depNames).toContain('certifi')
  })

  it('maps CVE aliases to CVE-* ids', async () => {
    const analysis = await runAnalysis('requirements.txt', REQUIREMENTS)
    const urllib3 = analysis.packages[0]!.dependencies.find(d => d.name === 'urllib3')!
    expect(urllib3.cves[0]!.id).toBe('CVE-2023-45803')
  })
})
