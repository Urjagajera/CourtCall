import { useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useApi } from '../lib/useApi'
import { Sheet } from './Sheet'
import { Banner, Button, Select } from './ui'

export interface Person {
  id: string
  name: string
  role: 'lawyer' | 'junior' | 'staff'
  isFirmAdmin: boolean
}
export interface Team {
  mainLawyerId: string
  assignedJuniorId: string
  helperStaffId: string
}

/**
 * Case team fields. Rules (CLAUDE.md "Case teams"): main lawyer = a senior or a junior (only firm admins
 * choose it); helping junior only when the main lawyer is a senior; at most one staff helper.
 */
export function TeamFields({ value, onChange, canChangeMain }: { value: Team; onChange: (t: Team) => void; canChangeMain: boolean }) {
  const { user } = useAuth()
  const { data } = useApi<{ people: Person[] }>('/office/people')
  const people = data?.people ?? []
  const seniors = people.filter((p) => p.role === 'lawyer')
  const juniors = people.filter((p) => p.role === 'junior')
  const staff = people.filter((p) => p.role === 'staff')
  const main = people.find((p) => p.id === value.mainLawyerId)
  const mainIsSenior = !main || main.role === 'lawyer'
  const name = (p: Person) => `${p.name}${p.id === user!.id ? ' (you)' : ''}${p.isFirmAdmin ? ' · firm admin' : ''}`

  return (
    <div className="flex flex-col gap-3">
      {canChangeMain ? (
        <Select
          label="Main lawyer"
          required
          value={value.mainLawyerId}
          onChange={(e) => {
            const next = people.find((p) => p.id === e.target.value)
            // A junior main lawyer has no helping junior.
            onChange({ ...value, mainLawyerId: e.target.value, assignedJuniorId: next?.role === 'junior' ? '' : value.assignedJuniorId })
          }}
        >
          <option value="" disabled>
            {data ? 'Choose the main lawyer' : 'Loading…'}
          </option>
          <optgroup label="Senior lawyers">
            {seniors.map((p) => (
              <option key={p.id} value={p.id}>
                {name(p)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Junior lawyers">
            {juniors.map((p) => (
              <option key={p.id} value={p.id}>
                {name(p)}
              </option>
            ))}
          </optgroup>
        </Select>
      ) : (
        <div>
          <p className="text-label font-semibold">Main lawyer</p>
          <p className="text-label text-ink-muted">{main ? name(main) : 'You'} · only a firm admin can change this</p>
        </div>
      )}
      {mainIsSenior ? (
        <Select label="Helping junior (optional)" value={value.assignedJuniorId} onChange={(e) => onChange({ ...value, assignedJuniorId: e.target.value })}>
          <option value="">None</option>
          {juniors.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      ) : (
        <p className="text-caption text-ink-muted">A junior main lawyer works the case without a helping junior.</p>
      )}
      <Select label="Staff helper (optional)" value={value.helperStaffId} onChange={(e) => onChange({ ...value, helperStaffId: e.target.value })}>
        <option value="">None</option>
        {staff.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </div>
  )
}

/** Edit the team of an existing case (firm admin, or the senior main lawyer for junior + staff). */
export function TeamSheet({
  caseId,
  initial,
  canChangeMain,
  onClose,
  onSaved,
}: {
  caseId: string
  initial: Team
  canChangeMain: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [team, setTeam] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet open title="Case team" onClose={onClose}>
      <TeamFields value={team} onChange={setTeam} canChangeMain={canChangeMain} />
      {error && (
        <div className="mt-3">
          <Banner tone="stopped">{error}</Banner>
        </div>
      )}
      <Button
        className="mt-4 w-full"
        loading={busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            await api(`/cases/${caseId}/team`, {
              method: 'PUT',
              body: {
                ...(canChangeMain ? { mainLawyerId: team.mainLawyerId } : {}),
                assignedJuniorId: team.assignedJuniorId || null,
                helperStaffId: team.helperStaffId || null,
              },
            })
            onSaved()
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save the team')
          } finally {
            setBusy(false)
          }
        }}
      >
        Save team
      </Button>
    </Sheet>
  )
}
