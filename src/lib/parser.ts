import { parse } from 'smol-toml'

interface PyProjectToml {
  project?: { dependencies?: string[] }
}

function depNameFrom(specifier: string): string {
  return specifier.split(/[>=<!~\[;\s]/)[0]!.trim().toLowerCase()
}

export function parseDirectDepNames(filename: string, content: string): string[] {
  if (filename.endsWith('.toml')) {
    const parsed = parse(content) as PyProjectToml
    return (parsed.project?.dependencies ?? []).map(depNameFrom).filter(Boolean)
  }
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('--'))
    .map(depNameFrom)
    .filter(Boolean)
}

export function toRequirementsTxt(filename: string, content: string): string {
  if (!filename.endsWith('.toml')) return content
  const parsed = parse(content) as PyProjectToml
  return (parsed.project?.dependencies ?? []).join('\n')
}
