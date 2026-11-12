import { CalendarClock, CheckCheck, FileText, Gavel, NotebookPen, UserMinus, UserPlus, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { timeAgo, useNow } from '../lib/court'
import { useUpdates, type Update } from '../lib/updates'
import { Card, cx } from './ui'

const ICON: Record<Update['kind'], LucideIcon> = {
  assigned: UserPlus,
  unassigned: UserMinus,
  details_changed: CalendarClock,
  outcome_recorded: Gavel,
  notes_edited: NotebookPen,
}

/** Top of Today: what changed on your cases (newest first). Tapping one opens the case and marks it read. */
export function UpdatesCard() {
  const { items, unread, markRead } = useUpdates()
  const navigate = useNavigate()
  const now = useNow()
  // Unread first, then the latest few read ones for context.
  const shown = [...items.filter((i) => !i.readAt), ...items.filter((i) => i.readAt).slice(0, Math.max(0, 5 - unread))].slice(0, 8)
  if (!shown.length) return null

  return (
    <Card data-tour="updates" className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-h2">
          <FileText className="size-5" strokeWidth={1.75} /> Updates
          {unread > 0 && <span className="tabular rounded-full bg-stopped-fg px-2 py-0.5 text-caption font-bold text-white">{unread} new</span>}
        </p>
        {unread > 0 && (
          <button onClick={() => markRead({ all: true })} className="flex items-center gap-1 text-label font-semibold text-ink-muted hover:text-ink">
            <CheckCheck className="size-4" strokeWidth={1.75} /> Mark all read
          </button>
        )}
      </div>
      <ul className="divide-y divide-line">
        {shown.map((u) => {
          const Icon = ICON[u.kind]
          return (
            <li key={u.id}>
              <button
                onClick={async () => {
                  if (!u.readAt) await markRead({ ids: [u.id] })
                  if (u.caseId) navigate(`/cases/${u.caseId}`)
                }}
                className={cx('flex w-full items-start gap-3 py-2.5 text-left', u.caseId ? 'hover:bg-surface-raised' : 'cursor-default')}
              >
                <span className={cx('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', u.readAt ? 'bg-base text-ink-muted' : 'bg-accent text-accent-ink')}>
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block text-label', !u.readAt && 'font-semibold')}>{u.message}</span>
                  <span className="text-caption text-ink-muted">{timeAgo(u.createdAt, now)}</span>
                </span>
                {!u.readAt && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-stopped-fg" aria-label="New" />}
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
