const PEP440_PRE_RE = /(a|b|rc)\d+$/

// ─── PEP 440 specifier matching ─────────────────────────────────────────────

function parseVersionParts(v: string): number[] {
  // Strip pre/post/local identifiers, split on dots
  return v.split(/[+!]/, 1)[0]!.split('.').map(p => parseInt(p, 10) || 0)
}

function cmpVersions(a: string, b: string): number {
  const pa = parseVersionParts(a)
  const pb = parseVersionParts(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

function satisfiesSpec(version: string, specifier: string): boolean {
  if (!specifier) return true
  return specifier.split(',').every(s => satisfiesOne(version, s.trim()))
}

function satisfiesOne(version: string, spec: string): boolean {
  const m = spec.match(/^(==|!=|>=|<=|>|<|~=)\s*(.+)$/)
  if (!m) return true
  const op = m[1]!
  const sv = m[2]!

  // Wildcard equality: ==1.4.*
  if (op === '==' && sv.endsWith('.*')) {
    const prefix = sv.slice(0, -2)
    return version === prefix || version.startsWith(prefix + '.')
  }

  // Compatible release: ~=1.4.2 means >=1.4.2 AND ==1.4.*
  if (op === '~=') {
    const parts = sv.split('.')
    if (parts.length < 2) return cmpVersions(version, sv) >= 0
    const prefix = parts.slice(0, -1).join('.')
    return cmpVersions(version, sv) >= 0 && (version === prefix || version.startsWith(prefix + '.'))
  }

  const cmp = cmpVersions(version, sv.replace('.*', ''))
  switch (op) {
    case '==': return cmp === 0
    case '!=': return cmp !== 0
    case '>=': return cmp >= 0
    case '<=': return cmp <= 0
    case '>':  return cmp > 0
    case '<':  return cmp < 0
  }
  return true
}

// ─── Requirements.txt parsing ───────────────────────────────────────────────

interface ParsedRequirement {
  name: string
  specifier: string
}

function parseRequirementLine(line: string): ParsedRequirement | null {
  const t = line.trim()
  if (!t || t.startsWith('#') || t.startsWith('-') || t.startsWith('--')) return null
  // Capture name (normalised), optional extras, and everything after as specifier
  const m = t.match(/^([A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?)\s*(?:\[[^\]]*\])?\s*(.*)$/)
  if (!m) return null
  // Normalise name: lowercase, underscores → hyphens (PEP 503)
  const name = m[1]!.toLowerCase().replace(/_/g, '-')
  const specifier = m[3]!.trim().split(';')[0]!.trim() // strip env markers
  return { name, specifier }
}

// ─── PyPI fetch helpers ─────────────────────────────────────────────────────

interface PyPISimple {
  info: { version: string }
  releases: Record<string, Array<{ upload_time_iso_8601?: string }>>
}

async function fetchPyPIIndex(name: string): Promise<PyPISimple | null> {
  try {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`)
    if (!res.ok) return null
    return await res.json() as PyPISimple
  } catch {
    return null
  }
}

function stableVersions(data: PyPISimple): string[] {
  return Object.keys(data.releases)
    .filter(v => !PEP440_PRE_RE.test(v) && data.releases[v]!.length > 0)
}

// Returns true when the specifier only constrains from below (>=, ~=) with no
// upper bound. In that case we can use the minimum satisfying version as a
// conservative "worst-case installed" estimate for staleness analysis.
function isLowerBoundOnly(specifier: string): boolean {
  if (!specifier) return false
  return specifier.split(',').map(s => s.trim()).every(s => /^(>=|~=)/.test(s))
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function resolveRequirementsTxt(
  content: string,
): Promise<Array<{ name: string; version: string }>> {
  const lines = content.split('\n').map(l => l.trim().replace(/\s*\\$/, '')).filter(Boolean)
  const results: Array<{ name: string; version: string }> = []

  await Promise.allSettled(lines.map(async line => {
    const req = parseRequirementLine(line)
    if (!req) return

    // Exact pin — no API call needed (wildcards like ==6.* are not exact pins)
    if (/^==\d/.test(req.specifier) && !req.specifier.includes(',') && !req.specifier.includes('*')) {
      results.push({ name: req.name, version: req.specifier.slice(2).trim() })
      return
    }

    const data = await fetchPyPIIndex(req.name)
    if (!data) return

    if (!req.specifier) {
      results.push({ name: req.name, version: data.info.version })
      return
    }

    const matching = stableVersions(data).filter(v => satisfiesSpec(v, req.specifier))
    if (matching.length === 0) {
      // Constraint matched nothing stable — fall back to declared latest
      results.push({ name: req.name, version: data.info.version })
      return
    }

    matching.sort(cmpVersions)
    // For lower-bound-only specs (>=X, ~=X) use the oldest stable satisfying
    // version as a conservative minimum-installed estimate. For upper-bound or
    // unconstrained specs we fall through to the latest matching version.
    const version = isLowerBoundOnly(req.specifier) ? matching[0]! : matching.at(-1)!
    results.push({ name: req.name, version })
  }))

  return results
}

// Resolve the latest stable version of each transitive dep name not already known.
export async function resolveTransitiveDeps(
  depNames: string[],
  knownNames: Set<string>,
): Promise<Array<{ name: string; version: string }>> {
  const toResolve = depNames.filter(n => !knownNames.has(n))
  const results: Array<{ name: string; version: string }> = []

  await Promise.allSettled(toResolve.map(async name => {
    const data = await fetchPyPIIndex(name)
    if (!data) return
    results.push({ name, version: data.info.version })
  }))

  return results
}
