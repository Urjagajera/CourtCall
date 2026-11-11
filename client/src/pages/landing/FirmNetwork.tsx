import { Briefcase, ClipboardList, Landmark, ShieldCheck, UserRound, Users, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cx } from '../../components/ui'
import { prefersReducedMotion } from '../../lib/useReveal'

// A connected picture of one law firm: who is linked to whom, with live "messages" travelling
// along the links. Visitors tap a person to see their connections and what they can do.

type NodeKind = 'admin' | 'senior' | 'junior' | 'staff' | 'court' | 'client'
interface NetNode {
  id: string
  kind: NodeKind
  label: string
  /** Position in % of the box: [wide x, wide y, phone x, phone y] */
  pos: [number, number, number, number]
}

const NODES: NetNode[] = [
  { id: 'admin', kind: 'admin', label: 'Firm admin', pos: [30, 14, 50, 8] },
  { id: 'sA', kind: 'senior', label: 'Senior lawyer', pos: [12, 44, 24, 24] },
  { id: 'sB', kind: 'senior', label: 'Senior lawyer', pos: [48, 44, 76, 24] },
  { id: 'jA', kind: 'junior', label: 'Junior', pos: [10, 84, 16, 42] },
  { id: 'jB', kind: 'junior', label: 'Junior', pos: [28, 74, 50, 46] },
  { id: 'staff', kind: 'staff', label: 'Office staff', pos: [42, 62, 84, 40] },
  { id: 'court', kind: 'court', label: 'Court 4 · shared', pos: [70, 84, 30, 76] },
  { id: 'c1', kind: 'client', label: 'Client', pos: [88, 18, 64, 70] },
  { id: 'c2', kind: 'client', label: 'Client', pos: [88, 48, 86, 80] },
  { id: 'c3', kind: 'client', label: 'Client', pos: [88, 78, 64, 92] },
]

const EDGES: [string, string][] = [
  ['admin', 'sA'],
  ['admin', 'sB'],
  ['admin', 'staff'],
  ['admin', 'jA'],
  ['admin', 'jB'],
  ['sA', 'jA'],
  ['sB', 'jB'],
  ['sA', 'c1'],
  ['sB', 'c2'],
  ['staff', 'c3'],
  ['jA', 'court'],
  ['jB', 'court'],
  ['court', 'c1'],
  ['court', 'c2'],
  ['court', 'c3'],
]

const META: Record<NodeKind, { icon: LucideIcon; title: string; does: string[] }> = {
  admin: { icon: ShieldCheck, title: 'Firm admin', does: ['Adds lawyers, juniors and staff', 'Approves every sign-up', 'Sees all cases and courtrooms'] },
  senior: { icon: Briefcase, title: 'Senior lawyer', does: ['Owns clients and cases', 'Assigns juniors', 'Chats privately with clients'] },
  junior: { icon: Users, title: 'Junior lawyer', does: ['Joins the courtroom', 'Reports progress in one tap', 'Undo in 10 seconds'] },
  staff: { icon: ClipboardList, title: 'Office staff', does: ['Keeps the cause list updated', 'Adds cases and clients', 'Shares client links'] },
  court: { icon: Landmark, title: 'Shared courtroom', does: ['One live room per court', 'Juniors from every firm report', 'Conflicts checked by the server'] },
  client: { icon: UserRound, title: 'Client', does: ['Opens a WhatsApp link', 'Sees only their own case', 'Alerted as the court gets close'] },
}

const ORDER = ['admin', 'jA', 'court', 'c1', 'staff', 'sB']

function useWide() {
  const q = '(min-width: 768px)'
  const [wide, setWide] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const mq = matchMedia(q)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

export function FirmNetwork() {
  const wide = useWide()
  const [selected, setSelected] = useState('admin')
  const [touched, setTouched] = useState(false)

  // Walk through the roles by itself until the visitor picks one.
  useEffect(() => {
    if (touched || prefersReducedMotion()) return
    const t = setInterval(() => setSelected((s) => ORDER[(ORDER.indexOf(s) + 1) % ORDER.length]), 3500)
    return () => clearInterval(t)
  }, [touched])

  // SVG units match the box's aspect ratio, so circles stay round.
  const W = wide ? 160 : 80
  const H = wide ? 90 : 100
  const at = (n: NetNode) => (wide ? [(n.pos[0] / 100) * W, (n.pos[1] / 100) * H] : [(n.pos[2] / 100) * W, (n.pos[3] / 100) * H])
  const byId = useMemo(() => Object.fromEntries(NODES.map((n) => [n.id, n])), [])
  const linked = new Set(EDGES.filter(([a, b]) => a === selected || b === selected).flat())
  const meta = META[byId[selected].kind]
  const motion = !prefersReducedMotion()

  return (
    <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className={cx('relative w-full', wide ? 'aspect-[16/9]' : 'aspect-[4/5]')}>
        {/* Firm boundary */}
        <div
          className="absolute rounded-lg border-2 border-dashed border-line bg-surface/60"
          style={wide ? { left: '1%', top: '2%', width: '55%', height: '96%' } : { left: '2%', top: '1%', width: '96%', height: '56%' }}
        >
          <span className="absolute left-3 top-2 text-caption font-semibold uppercase tracking-wider text-ink-muted">Your firm</span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden="true">
          {EDGES.map(([a, b]) => {
            const [x1, y1] = at(byId[a])
            const [x2, y2] = at(byId[b])
            const on = a === selected || b === selected
            const d = `M ${x1} ${y1} L ${x2} ${y2}`
            return (
              <g key={a + b}>
                <path
                  d={d}
                  fill="none"
                  stroke={on ? 'var(--accent)' : 'var(--line)'}
                  strokeWidth={on ? 2.5 : 1.5}
                  vectorEffect="non-scaling-stroke"
                  className="transition-[stroke] duration-500"
                />
                {motion && (
                  <circle r={on ? 1.1 : 0.7} fill={on ? 'var(--accent)' : 'var(--detail)'}>
                    <animateMotion dur={on ? '1.6s' : '3.2s'} repeatCount="indefinite" path={d} />
                  </circle>
                )}
              </g>
            )
          })}
        </svg>

        {NODES.map((n) => {
          const [x, y] = wide ? [n.pos[0], n.pos[1]] : [n.pos[2], n.pos[3]]
          const M = META[n.kind]
          const isSel = n.id === selected
          const dim = !linked.has(n.id) && !isSel
          return (
            <button
              key={n.id}
              onClick={() => {
                setTouched(true)
                setSelected(n.id)
              }}
              aria-pressed={isSel}
              className={cx(
                'absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-caption font-semibold shadow-card transition-all duration-300',
                isSel
                  ? 'scale-110 border-accent bg-accent text-accent-ink'
                  : n.kind === 'admin'
                    ? 'border-accent/60 bg-surface text-ink'
                    : 'border-line bg-surface text-ink hover:border-accent',
                dim && 'opacity-55',
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <M.icon className="size-4" strokeWidth={1.75} />
              {n.label}
            </button>
          )
        })}
      </div>

      {/* What the selected role does */}
      <div key={selected} className="cc-pop rounded-lg border border-line bg-surface p-5 shadow-card">
        <span className="flex size-11 items-center justify-center rounded-md bg-accent text-accent-ink">
          <meta.icon className="size-5" strokeWidth={1.75} />
        </span>
        <p className="mt-3 text-h2">{meta.title}</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {meta.does.map((d) => (
            <li key={d} className="flex items-center gap-2 text-label">
              <span className="size-1.5 shrink-0 rounded-full bg-detail" /> {d}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-caption text-ink-muted">Tap anyone in the picture to see their connections.</p>
      </div>
    </div>
  )
}
