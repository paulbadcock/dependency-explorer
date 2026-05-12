import { writeFileSync, unlinkSync, mkdtempSync, rmdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFileNoThrow } from '../utils/execFileNoThrow'
import type { PipAuditDependency, PipAuditOutput } from './types'

function extractPipError(stderr: string): string {
  if (!stderr.trim()) return 'pip-audit produced no output'
  const lines = stderr.split('\n')
  const pipErrors = lines.filter(l => /^ERROR: (?!pip_audit\.)/.test(l))
  if (pipErrors.length > 0) return pipErrors.join('\n')
  const nonEmpty = lines.filter(l => l.trim())
  return nonEmpty.slice(-3).join('\n')
}

function isResolutionFailure(stderr: string): boolean {
  return stderr.includes('ResolutionImpossible') || stderr.includes('ResolutionTooDeep')
}

// psycopg[binary] → psycopg: removes extras so pip doesn't pull in conflicting binary wheels
function stripExtras(txt: string): string {
  return txt
    .split('\n')
    .map(line => {
      const t = line.trim()
      if (!t || t.startsWith('#') || t.startsWith('-')) return line
      return line.replace(/\[[^\]]*\]/g, '')
    })
    .join('\n')
}

export class PipAuditNotFoundError extends Error {
  constructor() {
    super('pip-audit not found. Install it with: pip install pip-audit')
    this.name = 'PipAuditNotFoundError'
  }
}

async function audit(filePath: string, noDeps: boolean): Promise<PipAuditDependency[] | null> {
  const args = ['-f', 'json', '-r', filePath]
  if (noDeps) args.push('--no-deps')
  const result = await execFileNoThrow('pip-audit', args)

  if (result.notFound) throw new PipAuditNotFoundError()

  if (!result.stdout.trim()) {
    if (isResolutionFailure(result.stderr)) return null  // signal: try next strategy
    throw new Error(extractPipError(result.stderr))
  }

  const parsed = JSON.parse(result.stdout) as PipAuditOutput
  return parsed.dependencies
}

export async function runPipAudit(requirementsTxt: string): Promise<PipAuditDependency[]> {
  const dir = mkdtempSync(join(tmpdir(), 'dep-explorer-'))
  const filePath = join(dir, 'requirements.txt')

  try {
    // Strategy 1: full resolution with extras
    writeFileSync(filePath, requirementsTxt, 'utf8')
    const full = await audit(filePath, false)
    if (full !== null) return full

    // Strategy 2: strip extras (removes [binary], [c], etc. that pull in conflicting wheels)
    writeFileSync(filePath, stripExtras(requirementsTxt), 'utf8')
    const noExtras = await audit(filePath, false)
    if (noExtras !== null) return noExtras

    // Strategy 3: no-deps (audits packages as listed, no transitive resolution)
    const noDepsResult = await audit(filePath, true)
    if (noDepsResult !== null) return noDepsResult

    return []
  } finally {
    try { unlinkSync(filePath) } catch { /* best-effort cleanup */ }
    try { rmdirSync(dir) } catch { /* best-effort cleanup */ }
  }
}
