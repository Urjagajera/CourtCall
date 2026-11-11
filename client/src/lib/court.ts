import {
  Ban,
  CalendarX,
  CirclePlay,
  Clock,
  Coffee,
  DoorClosed,
  Play,
  RotateCcw,
  SkipForward,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Tone } from '../components/ui'

export type SessionStatus = 'not_started' | 'hearing' | 'break' | 'risen' | 'not_sitting'
export type EventType =
  | 'now_hearing'
  | 'passed_over'
  | 'recalled'
  | 'adjourned'
  | 'break_start'
  | 'break_end'
  | 'court_not_sitting'
  | 'court_risen'
  | 'correction'

export interface SessionState {
  id: string
  courtroomId: string
  date: string
  currentItem: number | null
  hearingItem: number | null
  status: SessionStatus
  version: number
  lastEventAt: string | null
  stale: boolean
}

export interface Courtroom {
  id: string
  courtComplex: string
  roomNo: string
}

export interface MyCase {
  id: string
  title: string
  itemNo: number
  clientName: string
  assignedJuniorId: string | null
}

export interface CourtEventRow {
  id: string
  version: number
  type: EventType
  item: number | null
  singleReporter: boolean
  confirmed: boolean
  correctsEventId: string | null
  createdAt: string
  reporterId: string
  reporterName: string
  officeName: string | null
}

export const EVENT_META: Record<EventType, { label: string; tone: Tone; icon: LucideIcon }> = {
  now_hearing: { label: 'Now hearing', tone: 'hearing', icon: CirclePlay },
  passed_over: { label: 'Passed over', tone: 'waiting', icon: SkipForward },
  recalled: { label: 'Recalled', tone: 'waiting', icon: Undo2 },
  adjourned: { label: 'Adjourned', tone: 'stopped', icon: CalendarX },
  break_start: { label: 'Break', tone: 'waiting', icon: Coffee },
  break_end: { label: 'Break ended', tone: 'hearing', icon: Play },
  court_not_sitting: { label: 'Court not sitting', tone: 'stopped', icon: Ban },
  court_risen: { label: 'Court risen', tone: 'stopped', icon: DoorClosed },
  correction: { label: 'Undone', tone: 'info', icon: RotateCcw },
}

export function statusMeta(s: Pick<SessionState, 'status' | 'stale'>): { label: string; tone: Tone; icon: LucideIcon } {
  if (s.stale) return { label: 'Stale', tone: 'stale', icon: Clock }
  switch (s.status) {
    case 'hearing':
      return { label: 'Hearing', tone: 'hearing', icon: CirclePlay }
    case 'break':
      return { label: 'On break', tone: 'waiting', icon: Coffee }
    case 'risen':
      return { label: 'Court risen', tone: 'stopped', icon: DoorClosed }
    case 'not_sitting':
      return { label: 'Not sitting', tone: 'stopped', icon: Ban }
    default:
      return { label: 'Not started', tone: 'stale', icon: Clock }
  }
}

/** Re-renders every `ms` so "2 min ago" labels stay fresh. */
export function useNow(ms = 15000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export function timeAgo(iso: string | null, now: number) {
  if (!iso) return 'No updates yet'
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  return `${h} h ${m % 60} min ago`
}

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

/** Polls a loader every `ms` while the tab is visible (live updates until Nexconn push is wired). */
export function usePolling(fn: () => void, ms: number) {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') fn()
    }
    const t = setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [fn, ms])
}
