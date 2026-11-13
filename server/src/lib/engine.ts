// Courtroom update rules. Pure functions only (no DB) so they are easy to test.
// See PLAN.md "Courtroom update rules".

export const EVENT_TYPES = [
  'now_hearing',
  'passed_over',
  'recalled',
  'adjourned',
  'break_start',
  'break_end',
  'court_not_sitting',
  'court_risen',
  'correction',
] as const
export type EventType = (typeof EVENT_TYPES)[number]
export type SessionStatus = 'not_started' | 'hearing' | 'break' | 'risen' | 'not_sitting'

export const ITEM_EVENTS: readonly EventType[] = ['now_hearing', 'passed_over', 'recalled', 'adjourned']

/** Forward jumps larger than this need an explicit confirmation. */
export const MAX_JUMP = 5
/** No accepted update for this long while court is sitting => shown as stale. */
export const STALE_AFTER_MS = 20 * 60 * 1000
/** A reporter counts as "active" in a room if they reported within this window. */
export const ACTIVE_REPORTER_MS = 20 * 60 * 1000

export interface SessionState {
  currentItem: number | null
  hearingItem: number | null
  status: SessionStatus
}

export interface EventInput {
  type: EventType
  item?: number | null
  confirm?: boolean
}

/** The event being undone (only for type "correction"). */
export interface CorrectionTarget {
  type: EventType
  isLatest: boolean
  prevCurrentItem: number | null
  prevHearingItem: number | null
  prevStatus: SessionStatus
}

export type Decision =
  | { kind: 'apply'; next: SessionState; confirmed: boolean }
  | { kind: 'confirm'; reason: 'backward' | 'jump'; message: string }
  | { kind: 'noop'; message: string }
  | { kind: 'reject'; message: string }

export function decide(state: SessionState, input: EventInput, target?: CorrectionTarget): Decision {
  const { type, item, confirm = false } = input
  const needsItem = ITEM_EVENTS.includes(type)
  if (needsItem && (item == null || !Number.isInteger(item) || item < 1)) {
    return { kind: 'reject', message: 'An item number is required for this update' }
  }
  const apply = (patch: Partial<SessionState>, confirmed = false): Decision => ({
    kind: 'apply',
    next: { ...state, ...patch },
    confirmed,
  })

  switch (type) {
    case 'now_hearing': {
      const n = item!
      const cur = state.currentItem
      if (cur != null && n === cur && state.hearingItem === n && state.status === 'hearing') {
        return { kind: 'noop', message: `Item ${n} is already reported as being heard` }
      }
      if (cur != null && n < cur && !confirm) {
        return {
          kind: 'confirm',
          reason: 'backward',
          message: `Item ${n} is before the current progress (Item ${cur}). If a passed-over case was called back, use "Recalled" instead. Confirm moving progress back?`,
        }
      }
      if (cur != null && n - cur > MAX_JUMP && !confirm) {
        return {
          kind: 'confirm',
          reason: 'jump',
          message: `Item ${n} is ${n - cur} items ahead of Item ${cur}. Confirm this jump?`,
        }
      }
      const risky = cur != null && (n < cur || n - cur > MAX_JUMP)
      return apply({ currentItem: n, hearingItem: n, status: 'hearing' }, risky)
    }

    case 'recalled':
      // A passed-over item is taken up again. Progress pointer stays where it was.
      return apply({ hearingItem: item!, status: 'hearing' })

    case 'passed_over':
    case 'adjourned':
      // Recorded for the affected case; the courtroom's progress does not change.
      // If that item was the one being heard, nothing is in front of the judge until the next update.
      return apply({ hearingItem: state.hearingItem === item ? null : state.hearingItem })

    case 'break_start':
      if (state.status === 'break') return { kind: 'noop', message: 'Court is already on a break' }
      return apply({ status: 'break' })

    case 'break_end':
      if (state.status !== 'break') return { kind: 'noop', message: 'Court is not on a break' }
      return apply({ status: 'hearing' })

    case 'court_not_sitting':
      if (state.status === 'not_sitting') return { kind: 'noop', message: 'Already reported as not sitting' }
      return apply({ status: 'not_sitting', hearingItem: null })

    case 'court_risen':
      if (state.status === 'risen') return { kind: 'noop', message: 'Already reported as risen' }
      return apply({ status: 'risen', hearingItem: null })

    case 'correction': {
      if (!target) return { kind: 'reject', message: 'Nothing to correct' }
      if (target.type === 'correction') return { kind: 'reject', message: 'A correction cannot be undone' }
      if (!target.isLatest) {
        return { kind: 'reject', message: 'Newer updates were reported after this one, so it can no longer be undone' }
      }
      return apply({
        currentItem: target.prevCurrentItem,
        hearingItem: target.prevHearingItem,
        status: target.prevStatus,
      })
    }
  }
}

export function isStale(status: SessionStatus, lastEventAt: Date | null, now = Date.now(), staleAfterMs = STALE_AFTER_MS) {
  if (!lastEventAt || status === 'risen' || status === 'not_sitting' || status === 'not_started') return false
  return now - lastEventAt.getTime() > staleAfterMs
}

/** Court days follow Indian time even when the server runs in UTC. */
export function courtDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d) // YYYY-MM-DD
}
