import { CalendarClock, ChevronRight, Landmark, MessageSquareText, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDate } from '../lib/dates'
import { useApi } from '../lib/useApi'
import { Card } from './ui'

interface TomorrowCase {
  caseId: string
  title: string
  caseNo: string | null
  clientName: string
  courtComplex: string
  roomNo: string
  itemNo: number | null
  appearingLawyer: string | null
  /** The case already has a note for the client's 9 am briefing. */
  noteForClient: boolean
}

/**
 * The lawyer's cases for tomorrow, to prepare the evening before. Tapping a case opens its page, where the
 * note read to the client in the 9 am briefing is written. Hidden when there is nothing tomorrow.
 */
export function TomorrowCard() {
  const { data } = useApi<{ date: string; cases: TomorrowCase[] }>('/hearings/tomorrow')
  const list = data?.cases ?? []
  if (!data || !list.length) return null

  return (
    <Card data-tour="tomorrow-hearings">
      <p className="flex items-center gap-2 text-h2">
        <CalendarClock className="size-5" strokeWidth={1.75} />
        Tomorrow's hearings
        <span className="tabular text-label font-normal text-ink-muted">· {formatDate(data.date)}</span>
      </p>
      <p className="mt-1 text-label text-ink-muted">Prepare tonight. Open a case to add a note for the client's 9 am briefing.</p>
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {list.map((c) => (
          <li key={c.caseId}>
            <Link to={`/cases/${c.caseId}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-raised">
              <span className="tabular flex size-12 shrink-0 flex-col items-center justify-center rounded-md bg-base text-center leading-none">
                <span className="text-caption text-ink-muted">Item</span>
                <span className="text-h2">{c.itemNo ?? '–'}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-label font-semibold">{c.title}</span>
                <span className="flex min-w-0 items-center gap-1 text-caption text-ink-muted">
                  <Landmark className="size-3.5 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">
                    {c.courtComplex} · Court {c.roomNo}
                  </span>
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-ink-muted">
                  <span className="flex min-w-0 items-center gap-1">
                    <UserRound className="size-3.5 shrink-0" strokeWidth={1.75} />
                    <span className="truncate">Client: {c.clientName}</span>
                  </span>
                  <span className="truncate">Appearing: {c.appearingLawyer ?? 'not set'}</span>
                  {c.noteForClient && (
                    <span className="flex items-center gap-1 text-hearing-fg">
                      <MessageSquareText className="size-3.5" strokeWidth={1.75} /> Note added
                    </span>
                  )}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-muted" strokeWidth={1.75} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
