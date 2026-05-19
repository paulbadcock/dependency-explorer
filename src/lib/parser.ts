import { parse } from 'smol-toml'

interface PoetryLock {
  package?: Array<{ name: string; version: string; dependencies?: Record<string, unknown> }>
}

interface NuGetLockEntry {
  type: string       // "Direct" | "Transitive"
  resolved: string
  dependencies?: Record<string, string>
}

interface NuGetLock {
  version: number
  dependencies: Record<string, Record<string, NuGetLockEntry>>
}

export interface NuGetPackage {
  name: string
  version: string
  isDirect: boolean
  deps: string[]  // immediate dependency names
}

export function parseNuGetLock(content: string): {
  packages: NuGetPackage[]
  directNames: Set<string>
} {
  const lock = JSON.parse(content) as NuGetLock
  const seen = new Map<string, NuGetPackage>()

  for (const framework of Object.values(lock.dependencies)) {
    for (const [name, entry] of Object.entries(framework)) {
      const key = name.toLowerCase()
      if (!seen.has(key)) {
        seen.set(key, {
          name,
          version: entry.resolved,
          isDirect: entry.type === 'Direct',
          deps: Object.keys(entry.dependencies ?? []),
        })
      }
    }
  }

  const packages = [...seen.values()]
  const directNames = new Set(packages.filter(p => p.isDirect).map(p => p.name.toLowerCase()))
  return { packages, directNames }
}

function depNameFrom(specifier: string): string {
  return specifier.split(/[>=<!~\[;\s]/)[0]!.trim().toLowerCase()
}

export function parseDirectDepNames(filename: string, content: string): string[] {
  if (filename.endsWith('.lock')) {
    const parsed = parse(content) as PoetryLock
    const packages = parsed.package ?? []
    // Root packages are those not listed as a dependency of any other package
    const transitiveNames = new Set(
      packages.flatMap(p =>
        Object.keys(p.dependencies ?? {}).map(n => n.toLowerCase().replace(/_/g, '-'))
      )
    )
    return packages.map(p => p.name.toLowerCase()).filter(n => !transitiveNames.has(n))
  }
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('--'))
    .map(depNameFrom)
    .filter(Boolean)
}

export function toRequirementsTxt(filename: string, content: string): string {
  if (filename.endsWith('.lock')) {
    const parsed = parse(content) as PoetryLock
    return (parsed.package ?? []).map(p => `${p.name}==${p.version}`).join('\n') + '\n'
  }
  return content
}
