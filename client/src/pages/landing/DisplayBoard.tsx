import { Clock, Coffee, Radio } from 'lucide-react'
import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../../lib/useReveal'

// A simulated court-complex board: several courtrooms progressing at their own pace.
// Purely illustrative (marked "Demo") so visitors see what shared rooms look like.

type Row = { court: string; item: number; status: 'hearing' | 'break' | 'stale'; updated: number }

const START: Row[] = [
  { court: '1', item: 7, status: 'hearing', updated: 1 },
  { court: '2', item: 22, status: 'hearing', updated: 3 },
  { court: '4', item: 12, status: 'hearing', updated: 0 },
  { court: '7', item: 3, status: 'break', updated: 6 },
  { court: '9', item: 41, status: 'hearing', updated: 2 },
  { court: '12', item: 15, status: 'stale', updated: 24 },
]

export function DisplayBoard() {
  const [rows, setRows] = useState(START)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const t = setInterval(() => {
      setRows((prev) => {
        const next = prev.map((r) => ({ ...r, updated: r.updated + 1 }))
        const i = Math.floor(Math.random() * next.length)
        const r = next[i]
        if (r.status === 'stale') return next
        if (r.status === 'break') next[i] = { ...r, status: 'hearing', updated: 0 }
        else if (Math.random() < 0.12) next[i] = { ...r, status: 'break', updated: 0 }
        else next[i] = { ...r, item: r.item + 1, updated: 0 }
        return next
      })
    }, 1800)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="overflow-hidden rounded-lg border-4 border-[#2A2220] bg-[#2A2220] shadow-sheet">
      <div className="flex items-center justify-between gap-2 bg-[#3A302C] px-4 py-3">
        <p className="text-label font-bold tracking-[0.2em] text-[#E8C9A9]">CAUSE LIST BOARD</p>
        <span className="flex items-center gap-1.5 text-caption font-semibold text-[#8FDCA9]">
          <Radio className="cc-blink size-3.5" strokeWidth={2} /> LIVE · DEMO
        </span>
      </div>
      <div className="grid grid-cols-[4.5rem_1fr_auto] gap-x-3 border-b border-white/10 px-4 py-2 text-caption tracking-widest text-[#CDBFB5]">
        <span>COURT</span>
        <span>ITEM</span>
        <span>STATUS</span>
      </div>
      <ul>
        {rows.map((r) => (
          <li
            key={r.court}
            className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-x-3 border-b border-white/5 px-4 py-2.5 last:border-0"
          >
            <span className="tabular text-h2 font-bold text-[#F4EEEA]">{r.court}</span>
            <span className="overflow-hidden [perspective:400px]">
              <span key={r.item} className="cc-flip tabular inline-block text-[1.75rem] font-extrabold leading-none text-[#E8C9A9]">
                {r.item}
              </span>
            </span>
            <span
              className={
                r.status === 'hearing'
                  ? 'flex items-center gap-1 text-caption font-semibold text-[#8FDCA9]'
                  : r.status === 'break'
                    ? 'flex items-center gap-1 text-caption font-semibold text-[#F3C673]'
                    : 'flex items-center gap-1 text-caption font-semibold text-[#CDBFB5]'
              }
            >
              {r.status === 'hearing' ? (
                <>
                  <span className="size-2 rounded-full bg-[#8FDCA9]" /> {r.updated === 0 ? 'just now' : `${r.updated}m ago`}
                </>
              ) : r.status === 'break' ? (
                <>
                  <Coffee className="size-3.5" strokeWidth={2} /> Break
                </>
              ) : (
                <>
                  <Clock className="size-3.5" strokeWidth={2} /> Stale {r.updated}m
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
