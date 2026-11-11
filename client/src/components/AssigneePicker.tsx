import { Check, Crown } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useApi } from '../lib/useApi'
import { cx } from './ui'

export interface Person {
  id: string
  name: string
  role: 'lawyer' | 'staff'
  isFirmAdmin: boolean
}

/**
 * Tick who looks after a client. Firm admins see every client anyway, so they're shown as
 * "sees all" and can't be ticked. When `lockSelf` is set, the current user is always included.
 */
export function AssigneePicker({
  value,
  onChange,
  lockSelf,
}: {
  value: string[]
  onChange: (ids: string[]) => void
  lockSelf?: boolean
}) {
  const { user } = useAuth()
  const { data } = useApi<{ people: Person[] }>('/office/people')
  const people = data?.people ?? []
  if (!data) return <p className="text-caption text-ink-muted">Loading people…</p>

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  const groups: [string, Person[]][] = [
    ['Senior lawyers', people.filter((p) => p.role === 'lawyer')],
    ['Office staff', people.filter((p) => p.role === 'staff')],
  ]

  return (
    <div className="flex flex-col gap-3">
      {groups.map(([label, list]) =>
        list.length === 0 ? null : (
          <div key={label}>
            <p className="mb-1 text-caption font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
            <ul className="flex flex-wrap gap-2">
              {list.map((p) => {
                const self = p.id === user!.id
                const locked = p.isFirmAdmin || (lockSelf && self)
                const on = p.isFirmAdmin || value.includes(p.id) || (lockSelf && self)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={locked}
                      aria-pressed={on}
                      onClick={() => toggle(p.id)}
                      className={cx(
                        'flex h-10 items-center gap-1.5 rounded-full border px-3 text-label font-semibold transition-colors',
                        on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface hover:border-accent',
                        locked && 'cursor-default opacity-80',
                      )}
                    >
                      {on && <Check className="size-4" strokeWidth={2} />}
                      {p.name}
                      {self && ' (you)'}
                      {p.isFirmAdmin && <Crown className="size-3.5" strokeWidth={2} aria-label="Firm admin, sees all clients" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ),
      )}
      <p className="text-caption text-ink-muted">Firm admins (crown) always see every client.</p>
    </div>
  )
}
