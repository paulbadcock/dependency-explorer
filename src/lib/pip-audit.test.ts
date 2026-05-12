import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../utils/execFileNoThrow', () => ({
  execFileNoThrow: vi.fn(),
}))

import { execFileNoThrow } from '../utils/execFileNoThrow'
import { runPipAudit, PipAuditNotFoundError } from './pip-audit'
import type { ExecResult } from '../utils/execFileNoThrow'

const VALID_JSON = JSON.stringify({
  dependencies: [
    { name: 'requests', version: '2.28.0', vulns: [] },
    { name: 'urllib3', version: '1.26.18', vulns: [
      { id: 'GHSA-v845', fix_versions: ['1.26.19'], aliases: ['CVE-2023-45803'], description: 'urllib3 test vuln' }
    ]},
  ],
})

beforeEach(() => vi.clearAllMocks())

describe('runPipAudit', () => {
  it('parses valid pip-audit JSON output', async () => {
    vi.mocked(execFileNoThrow).mockResolvedValue(
      { stdout: VALID_JSON, stderr: '', status: 1, notFound: false }
    )
    const deps = await runPipAudit('requests>=2.28.0\n')
    expect(deps).toHaveLength(2)
    expect(deps[0]!.name).toBe('requests')
    expect(deps[1]!.vulns).toHaveLength(1)
  })

  it('throws PipAuditNotFoundError when pip-audit is not installed', async () => {
    vi.mocked(execFileNoThrow).mockResolvedValue(
      { stdout: '', stderr: '', status: -1, notFound: true }
    )
    await expect(runPipAudit('requests\n')).rejects.toBeInstanceOf(PipAuditNotFoundError)
  })

  it('throws on empty stdout with no valid JSON', async () => {
    vi.mocked(execFileNoThrow).mockResolvedValue(
      { stdout: '', stderr: 'ERROR: could not find a version', status: 2, notFound: false }
    )
    await expect(runPipAudit('nonexistent-pkg==999\n')).rejects.toThrow('could not find a version')
  })
})
