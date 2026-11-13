import { useId, type ChangeEvent } from 'react'
import type { Courtroom } from '../lib/court'
import { useApi } from '../lib/useApi'
import { Input } from './ui'

type FieldProps = { value: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void; name?: string; error?: string }

/**
 * Court complex + court no. with suggestions from courtrooms already in CourtCall (every firm),
 * so firms type the same names and land in the same shared room. Rooms are suggested for the chosen complex.
 * Typing a new court is still allowed.
 */
export function CourtFields({ complex, room, required }: { complex: FieldProps; room: FieldProps; required?: boolean }) {
  const { data } = useApi<{ courtrooms: Courtroom[] }>('/courtrooms')
  const known = data?.courtrooms ?? []
  const complexId = useId()
  const roomId = useId()

  // Most used complex first (more rooms = more firms there).
  const counts = new Map<string, { name: string; n: number }>()
  for (const k of known) {
    const key = k.courtComplex.trim().toLowerCase()
    const e = counts.get(key)
    if (e) e.n++
    else counts.set(key, { name: k.courtComplex, n: 1 })
  }
  const complexes = [...counts.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map((c) => c.name)

  const chosen = complex.value.trim().toLowerCase()
  const rooms = [...new Set(known.filter((k) => k.courtComplex.trim().toLowerCase() === chosen).map((k) => k.roomNo))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  )

  return (
    <div className="grid grid-cols-[1fr_7rem] gap-3">
      <Input
        label="Court complex"
        required={required}
        list={complexId}
        autoComplete="off"
        placeholder={complexes[0] ? `e.g. ${complexes[0]}` : 'Name of the court complex'}
        hint={complexes.length ? 'Pick a court already in CourtCall to share its room' : undefined}
        {...complex}
      />
      <Input label="Court no." required={required} list={roomId} autoComplete="off" placeholder={rooms[0] ?? 'No.'} {...room} />
      <datalist id={complexId}>
        {complexes.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id={roomId}>
        {rooms.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
    </div>
  )
}
