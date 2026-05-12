import { writeFileSync, unlinkSync, mkdtempSync, rmdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFileNoThrow } from '../utils/execFileNoThrow'
import type { PipAuditDependency, PipAuditOutput } from './types'

function extractPipError(stderr: string): string {
  if (!stderr.trim()) return 'pip-audit produced no output'
  const lines = stderr.split('\n')
  // Prefer bare pip ERROR lines (no module path) — these are user-facing
  const pipErrors = lines.filter(l => /^ERROR: (?!pip_audit\.)/.test(l))
  if (pipErrors.length > 0) return pipErrors.join('\n')
  // Fall back to last 3 non-empty lines
  const nonEmpty = lines.filter(l => l.trim())
  return nonEmpty.slice(-3).join('\n')
}

export class PipAuditNotFoundError extends Error {
  constructor() {
    super('pip-audit not found. Install it with: pip install pip-audit')
    this.name = 'PipAuditNotFoundError'
  }
}

export async function runPipAudit(requirementsTxt: string): Promise<PipAuditDependency[]> {
  const dir = mkdtempSync(join(tmpdir(), 'dep-explorer-'))
  const filePath = join(dir, 'requirements.txt')

  try {
    writeFileSync(filePath, requirementsTxt, 'utf8')
    const result = await execFileNoThrow('pip-audit', ['-f', 'json', '-r', filePath])

    if (result.notFound) throw new PipAuditNotFoundError()

    if (!result.stdout.trim()) {
      throw new Error(extractPipError(result.stderr))
    }

    const parsed = JSON.parse(result.stdout) as PipAuditOutput
    return parsed.dependencies
  } finally {
    try { unlinkSync(filePath) } catch { /* best-effort cleanup */ }
    try { rmdirSync(dir) } catch { /* best-effort cleanup */ }
  }
}
