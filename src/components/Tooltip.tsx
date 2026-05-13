import { useState } from 'react'
import { createPortal } from 'react-dom'

export function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  return (
    <span
      className="cursor-default"
      onMouseEnter={e => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        setPos({ x: r.left + r.width / 2, y: r.top })
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && createPortal(
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: pos.x, top: pos.y - 6, transform: 'translate(-50%, -100%)' }}
        >
          <div className="bg-gray-900 border border-gray-700 text-white text-[11px] leading-snug rounded px-2 py-1.5 max-w-[200px] text-center shadow-xl">
            {text}
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
