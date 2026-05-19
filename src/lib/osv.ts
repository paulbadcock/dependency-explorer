import type { CVE } from './types'

interface OsvVuln {
  id: string
  aliases?: string[]
  summary?: string
  database_specific?: { severity?: string }
  affected?: Array<{
    ranges?: Array<{
      type: string
      events?: Array<{ introduced?: string; fixed?: string }>
    }>
  }>
}

// Batch endpoint returns stubs — id + modified only
interface OsvVulnStub { id: string }

interface OsvBatchResponse {
  results: Array<{ vulns?: OsvVulnStub[] }>
}

const SEV_MAP: Record<string, CVE['severity']> = {
  CRITICAL: 'critical', HIGH: 'high', MODERATE: 'medium', MEDIUM: 'medium', LOW: 'low',
}

export function osvToCve(vuln: OsvVuln): CVE {
  const id = vuln.aliases?.find(a => a.startsWith('CVE-')) ?? vuln.id
  const rawSev = vuln.database_specific?.severity?.toUpperCase() ?? ''
  const severity: CVE['severity'] = SEV_MAP[rawSev] ?? 'unknown'

  let fixedInVersion: string | null = null
  outer: for (const affected of vuln.affected ?? []) {
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed) { fixedInVersion = event.fixed; break outer }
      }
    }
  }

  return { id, severity, description: vuln.summary ?? '', fixedInVersion }
}

export async function queryOsvBatch(
  packages: Array<{ name: string; version: string }>,
  ecosystem: string,
): Promise<Map<string, CVE[]>> {
  if (packages.length === 0) return new Map()

  try {
    // Step 1: get the list of vuln IDs affecting each package version
    const res = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: packages.map(p => ({
          package: { name: p.name, ecosystem },
          version: p.version,
        })),
      }),
    })
    if (!res.ok) return new Map()
    const data = await res.json() as OsvBatchResponse

    // Step 2: fetch full details for every unique vuln ID in parallel
    const allIds = new Set(
      data.results.flatMap(r => (r.vulns ?? []).map(v => v.id))
    )
    const vulnDetails = new Map<string, OsvVuln>()
    await Promise.allSettled([...allIds].map(async id => {
      try {
        const vulnRes = await fetch(`https://api.osv.dev/v1/vulns/${id}`)
        if (vulnRes.ok) vulnDetails.set(id, await vulnRes.json() as OsvVuln)
      } catch { /* ignore individual failures */ }
    }))

    // Step 3: build the result map using the full vuln details
    return new Map(
      packages.map((p, i) => [
        p.name.toLowerCase(),
        (data.results[i]?.vulns ?? [])
          .map(stub => vulnDetails.get(stub.id))
          .filter((v): v is OsvVuln => v !== undefined)
          .map(osvToCve),
      ])
    )
  } catch {
    return new Map()
  }
}
