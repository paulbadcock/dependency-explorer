import type { Analysis, Package } from './types'

export type DiffStatus = 'upgraded' | 'downgraded' | 'added' | 'removed' | 'unchanged'

export interface PackageDiff {
  name: string
  status: DiffStatus
  pkgA: Package | null
  pkgB: Package | null
}

export function compareAnalyses(a: Analysis, b: Analysis): PackageDiff[] {
  const mapA = new Map(a.packages.map(p => [p.name.toLowerCase(), p]))
  const mapB = new Map(b.packages.map(p => [p.name.toLowerCase(), p]))
  const allNames = new Set([...mapA.keys(), ...mapB.keys()])

  const diffs: PackageDiff[] = []

  for (const key of allNames) {
    const pkgA = mapA.get(key) ?? null
    const pkgB = mapB.get(key) ?? null

    let status: DiffStatus
    if (!pkgA) status = 'added'
    else if (!pkgB) status = 'removed'
    else if (pkgA.installedVersion === pkgB.installedVersion) status = 'unchanged'
    else status = semverGt(pkgB.installedVersion, pkgA.installedVersion) ? 'upgraded' : 'downgraded'

    diffs.push({ name: pkgA?.name ?? pkgB!.name, status, pkgA, pkgB })
  }

  const order: Record<DiffStatus, number> = {
    downgraded: 0, upgraded: 1, added: 2, removed: 3, unchanged: 4,
  }
  return diffs.sort((x, y) => order[x.status] - order[y.status] || x.name.localeCompare(y.name))
}

function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map(s => parseInt(s, 10) || 0)
  const pb = b.split('.').map(s => parseInt(s, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}
