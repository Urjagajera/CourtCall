import { CalendarCheck, CheckCircle2, Gavel } from 'lucide-react'
import { useState } from 'react'
import { api, ApiError } from '../lib/api'
import { formatDate } from '../lib/dates'
import { Sheet } from './Sheet'
import { useApi } from '../lib/useApi'
import type { Person } from './CaseTeam'
import { Banner, Button, Input, Select, Textarea, cx } from './ui'

export interface OutcomeCase {
  id: string
  title: string
  caseNo: string | null
  clientName: string
  hearingDate: string
  itemNo: number | null
  courtComplex: string
  roomNo: string
  appearingLawyerId?: string | null
}

/**
 * After a hearing: what happened, and what's next. Either the next date (court can change) or the case ended.
 * The summary can be shared with the client; prep notes stay inside the firm.
 */
export function OutcomeSheet({ c, onClose, onSaved }: { c: OutcomeCase; onClose: () => void; onSaved: () => void }) {
  const [outcome, setOutcome] = useState<'next_date' | 'closed'>('next_date')
  const [nextDate, setNextDate] = useState('')
  const [itemNo, setItemNo] = useState('')
  const [changeCourt, setChangeCourt] = useState(false)
  const [courtComplex, setCourtComplex] = useState(c.courtComplex)
  const [roomNo, setRoomNo] = useState(c.roomNo)
  const [summary, setSummary] = useState('')
  const [share, setShare] = useState(true)
  const [prepNotes, setPrepNotes] = useState('')
  // For the next hearing's 9 AM briefing to the client.
  const people = useApi<{ people: Person[] }>('/office/people')
  const seniors = (people.data?.people ?? []).filter((p) => p.role === 'lawyer')
  const [appearing, setAppearing] = useState(c.appearingLawyerId ?? '')
  const [remember, setRemember] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function save() {
    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      await api(`/cases/${c.id}/outcome`, {
        body: {
          outcome,
          nextDate: outcome === 'next_date' ? nextDate || undefined : undefined,
          itemNo: outcome === 'next_date' && itemNo ? Number(itemNo) : null,
          ...(outcome === 'next_date' && changeCourt ? { courtComplex, roomNo } : {}),
          summary: summary || undefined,
          shareWithClient: share,
          prepNotes: prepNotes || undefined,
          ...(outcome === 'next_date' ? { appearingLawyerId: appearing || null, rememberNote: remember.trim() || undefined } : {}),
        },
      })
      onSaved()
    } catch (e) {
      if (e instanceof ApiError && e.details) setFieldErrors(Object.fromEntries(Object.entries(e.details).map(([k, v]) => [k, v?.[0] ?? ''])))
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open title="What happened at the hearing?" onClose={onClose}>
      <p className="text-label text-ink-muted">
        {c.title}
        {c.caseNo && ` · ${c.caseNo}`} · {c.clientName}
        <br />
        {formatDate(c.hearingDate)} · {c.courtComplex} · Court {c.roomNo}
        {c.itemNo != null && ` · Item ${c.itemNo}`}
      </p>

      <div role="radiogroup" aria-label="Outcome" className="mt-4 grid grid-cols-2 gap-2">
        {(
          [
            ['next_date', 'Next date given', CalendarCheck],
            ['closed', 'Case ended', CheckCircle2],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={outcome === key}
            onClick={() => setOutcome(key)}
            className={cx(
              'flex h-14 items-center justify-center gap-2 rounded-md border-2 text-label font-semibold transition-colors',
              outcome === key ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface hover:border-accent',
            )}
          >
            <Icon className="size-5" strokeWidth={1.75} /> {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {outcome === 'next_date' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Next hearing date" type="date" required min={c.hearingDate} value={nextDate} onChange={(e) => setNextDate(e.target.value)} error={fieldErrors.nextDate} />
              <Input
                label="Item no. (optional)"
                type="number"
                inputMode="numeric"
                min={1}
                hint="Add it when the cause list is out"
                value={itemNo}
                onChange={(e) => setItemNo(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-label">
              <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={changeCourt} onChange={(e) => setChangeCourt(e.target.checked)} />
              Different court or room next time
            </label>
            <Select label="Appearing lawyer next time" value={appearing} onChange={(e) => setAppearing(e.target.value)}>
              <option value="">Not set (the main lawyer, if a senior)</option>
              {seniors.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Textarea
              label="Remember (for the client, next hearing)"
              placeholder="e.g. Bring your Aadhaar card and reach court by 10:30."
              hint="Read to the client in their language on the morning of the next hearing."
              maxLength={400}
              value={remember}
              onChange={(e) => setRemember(e.target.value)}
            />
            {changeCourt && (
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <Input label="Court complex" value={courtComplex} onChange={(e) => setCourtComplex(e.target.value)} />
                <Input label="Court no." value={roomNo} onChange={(e) => setRoomNo(e.target.value)} />
              </div>
            )}
          </>
        ) : (
          <Banner tone="info">
            <span className="flex items-start gap-2">
              <Gavel className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} /> The case will be marked closed. No more reminders or alerts for it. Its history stays.
            </span>
          </Banner>
        )}

        <Textarea
          label="What happened in court"
          placeholder="e.g. Arguments heard in part. The State asked for time to file a reply."
          maxLength={1000}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <label className="-mt-1 flex items-center gap-2 text-label">
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={share} onChange={(e) => setShare(e.target.checked)} />
          Show this to the client on their page
        </label>
        <Textarea
          label={outcome === 'next_date' ? 'To prepare for the next hearing (firm only)' : 'Follow-up (firm only)'}
          placeholder={outcome === 'next_date' ? 'e.g. Get the reply copy. Keep surety papers ready. Client to attend.' : 'e.g. Apply for the certified copy.'}
          hint="Never shown to the client"
          maxLength={2000}
          value={prepNotes}
          onChange={(e) => setPrepNotes(e.target.value)}
        />
        {error && <Banner tone="stopped">{error}</Banner>}
        <Button loading={busy} onClick={save} disabled={outcome === 'next_date' && !nextDate}>
          {outcome === 'next_date' ? 'Save and move to next date' : 'Save and close the case'}
        </Button>
      </div>
    </Sheet>
  )
}
