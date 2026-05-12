import { useState } from 'react'
import { DependencyTree } from './DependencyTree'
import { PackageDetail } from './PackageDetail'
import type { Package } from '../lib/types'

export function SplitPanel({ packages }: { packages: Package[] }) {
  const [selected, setSelected] = useState<Package | null>(packages[0] ?? null)
  return (
    <div className="flex w-full h-full overflow-hidden">
      <div className="w-2/5 border-r border-border overflow-auto py-2">
        <DependencyTree packages={packages} selected={selected} onSelect={setSelected} />
      </div>
      <div className="flex-1 overflow-auto">
        <PackageDetail pkg={selected} />
      </div>
    </div>
  )
}
