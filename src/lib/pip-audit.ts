import { writeFileSync, unlinkSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFileNoThrow } from '../utils/execFileNoThrow'
import type { PipAuditDependency, PipAuditOutput } from './types'

export class PipAuditNotFoundError extends Error {
  constructor() {
    super('pip-audit not found. Install it with: pip install pip-audit')
    this.name = 'PipAuditNotFoundError'
  }
}

export async function runPipAudit(requirementsTxt: string): Promise<PipAuditDependency[]> {
  const dir = mkdtempSync(join(tmpdir(), 'dep-explorer-'))
  const filePath = join(dir, 'requirements.txt')
  writeFileSync(filePath, requirementsTxt, 'utf8')

  try {
    const result = await execFileNoThrow('pip-audit', ['--json', '-r', filePath])

    if (result.notFound) throw new PipAuditNotFoundError()

    if (!result.stdout.trim()) {
      throw new Error(result.stderr.trim() || 'pip-audit produced no output')
    }

    const parsed = JSON.parse(result.stdout) as PipAuditOutput
    return parsed.dependencies
  } finally {
    try { unlinkSync(filePath) } catch { /* best-effort cleanup */ }
    try { unlinkSync(dir) } catch { /* best-effort cleanup */ }
  }
}
