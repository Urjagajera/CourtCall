import { BellRing, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '../lib/dates'
import { useApi } from '../lib/useApi'
import { OutcomeSheet, type OutcomeCase } from './OutcomeSheet'
import { Button, Card } from './ui'

/**
 * Reminder for lawyers and staff: hearings that have happened but have no recorded outcome yet
 * (only for clients they look after; firm admins see all). Hidden when there's nothing to do.
 */
export function HearingsToUpdate({ onChanged }: { onChanged?: () => void }) {
  const { data, reload } = useApi<{ cases: OutcomeCase[] }>('/hearings/pending')
  const [open, setOpen] = useState<OutcomeCase | null>(null)
  const list = data?.cases ?? []
  if (!list.length) return null

  return (
    <Card data-tour="hearings-to-update" className="border-2 border-waiting-fg/40">
      <p className="flex items-center gap-2 text-h2">
        <BellRing className="size-5 text-waiting-fg" strokeWidth={1.75} />
        {list.length === 1 ? '1 hearing to update' : `${list.length} hearings to update`}
      </p>
      <p className="mt-1 text-label text-ink-muted">Record what happened and the next date, so the client sees it too.</p>
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2">
            <Link to={`/cases/${c.id}`} className="min-w-0 flex-1">
              <span className="block truncate text-label font-semibold">{c.title}</span>
              <span className="block truncate text-caption text-ink-muted">
                {c.clientName} · {formatDate(c.hearingDate)} · Court {c.roomNo}
              </span>
            </Link>
            <Button size="sm" onClick={() => setOpen(c)}>
              Update
            </Button>
            <Link to={`/cases/${c.id}`} aria-label={`Open ${c.title}`} className="hidden text-ink-muted sm:block">
              <ChevronRight className="size-5" strokeWidth={1.75} />
            </Link>
          </li>
        ))}
      </ul>
      {open && (
        <OutcomeSheet
          c={open}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null)
            reload()
            onChanged?.()
          }}
        />
      )}
    </Card>
  )
}
