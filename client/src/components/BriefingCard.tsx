import { CheckCircle2, Megaphone, Send } from 'lucide-react'
import { useState } from 'react'
import { api } from '../lib/api'
import { clockTime } from '../lib/court'
import { formatDate, todayISO } from '../lib/dates'
import { useApi } from '../lib/useApi'
import type { Person } from './CaseTeam'
import { Banner, Button, Card, Select, Textarea } from './ui'

/**
 * Hearing-day briefing for the client (CLAUDE.md "Hearing-day briefing"): between 9 and 10 AM on the hearing day
 * the client gets a "CourtCall is calling" voice message with the court, item, the appearing lawyer and the
 * lawyer's Remember note (translated into their language). The main lawyer / firm admin can also send it now.
 */
export function BriefingCard({
  caseId,
  hearingDate,
  active,
  canEdit,
  appearingLawyerId,
  rememberNote,
  briefing,
  onChanged,
}: {
  caseId: string
  hearingDate: string
  active: boolean
  canEdit: boolean
  appearingLawyerId: string | null
  rememberNote: string | null
  briefing: { text: string; at: string } | null
  onChanged: () => void
}) {
  const { data } = useApi<{ people: Person[] }>(canEdit ? '/office/people' : null)
  const seniors = (data?.people ?? []).filter((p) => p.role === 'lawyer')
  const [lawyer, setLawyer] = useState(appearingLawyerId ?? '')
  const [note, setNote] = useState(rememberNote ?? '')
  const [busy, setBusy] = useState<'save' | 'send' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const isToday = hearingDate === todayISO()
  const dirty = lawyer !== (appearingLawyerId ?? '') || note.trim() !== (rememberNote ?? '')

  async function run(kind: 'save' | 'send', fn: () => Promise<unknown>) {
    setBusy(kind)
    setError(null)
    setSaved(false)
    try {
      await fn()
      if (kind === 'save') setSaved(true)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }
  const save = () => run('save', () => api(`/cases/${caseId}`, { method: 'PATCH', body: { appearingLawyerId: lawyer || null, rememberNote: note.trim() || null } }))

  return (
    <Card data-tour="case-briefing">
      <p className="flex items-center gap-2 text-h2">
        <Megaphone className="size-5" strokeWidth={1.75} /> Hearing-day briefing
      </p>
      <p className="mt-1 text-label text-ink-muted">
        {isToday ? 'Today' : `On ${formatDate(hearingDate)}`} between 9 and 10 AM, the client gets a CourtCall voice message: court, item, who appears for them,
        and your note, in their language.
      </p>

      {briefing && (
        <div className="mt-3 rounded-md border border-hearing-fg/30 bg-hearing-bg p-3 text-label">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-hearing-fg">
            <CheckCircle2 className="size-4" strokeWidth={1.75} /> Sent today at {clockTime(briefing.at)}
          </p>
          {briefing.text}
        </div>
      )}

      {canEdit && active ? (
        <div className="mt-3 flex flex-col gap-3">
          <Select label="Appearing lawyer" value={lawyer} onChange={(e) => setLawyer(e.target.value)} hint="Said to the client: who will appear for them">
            <option value="">Not set (the main lawyer, if a senior)</option>
            {seniors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Textarea
            label="Remember (for the client)"
            placeholder="e.g. Bring your Aadhaar card and reach court by 10:30."
            hint="Read to the client in their language in the next briefing, then cleared."
            maxLength={400}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <Banner tone="stopped">{error}</Banner>}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" loading={busy === 'save'} disabled={!dirty} onClick={save}>
              {saved && !dirty ? 'Saved' : 'Save'}
            </Button>
            {isToday && !briefing && (
              <Button
                loading={busy === 'send'}
                icon={<Send className="size-4" strokeWidth={1.75} />}
                onClick={() =>
                  run('send', async () => {
                    if (dirty) await api(`/cases/${caseId}`, { method: 'PATCH', body: { appearingLawyerId: lawyer || null, rememberNote: note.trim() || null } })
                    await api(`/cases/${caseId}/briefing`, { method: 'POST' })
                  })
                }
              >
                Send briefing now
              </Button>
            )}
          </div>
        </div>
      ) : (
        !briefing && rememberNote && <p className="mt-3 text-label">Note for the client: {rememberNote}</p>
      )}
    </Card>
  )
}
