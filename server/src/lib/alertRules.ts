import { ALERT_TEXT, type Lang } from './alertText.js'
// Which alert (if any) a client gets after a courtroom update. Pure function: no I/O, unit tested.
// At most ONE alert per case per update, so clients are never flooded. Alerts never predict times.

export interface AlertEvent {
  type:
    | 'now_hearing'
    | 'passed_over'
    | 'recalled'
    | 'adjourned'
    | 'break_start'
    | 'break_end'
    | 'court_not_sitting'
    | 'court_risen'
    | 'correction'
  item: number | null
  version: number
}

export interface AlertPick {
  /** Dedupe key, stored once per case per courtroom day (alert_logs.alert_key). */
  key: string
  message: string
  /** Earlier thresholds that are now pointless (e.g. jumping straight to "2 away" skips "10 away"). Stored silently. */
  implied: string[]
}

const THRESHOLDS = [2, 5, 10] as const

export function chooseAlert(input: {
  event: AlertEvent
  /** Session progress AFTER the event. */
  currentItem: number | null
  caseItem: number
  roomNo: string
  /** Alert keys already sent to this case today. */
  sent: Set<string>
  /** The client's language (defaults to English). */
  lang?: Lang
}): AlertPick | null {
  const { event, currentItem: cur, caseItem: mine, roomNo, sent } = input
  const T = ALERT_TEXT[input.lang ?? 'en']
  const pick = (key: string, message: string, implied: string[] = []): AlertPick | null =>
    sent.has(key) ? null : { key, message, implied: implied.filter((k) => !sent.has(k)) }
  // Once a case has been heard or adjourned, only court-level news that still matters goes out.
  const done = sent.has('now_hearing') || sent.has('adjourned')
  const away = cur == null ? null : mine - cur
  const v = { court: roomNo, mine, cur, away }

  // 1. Updates about this exact case always win.
  if (event.item === mine) {
    switch (event.type) {
      case 'now_hearing':
        return pick('now_hearing', T.now_hearing(v), [
          ...THRESHOLDS.map((t) => `within_${t}`),
          'first',
        ])
      case 'passed_over':
        return pick(
          `passed_over:v${event.version}`,
          T.passed_over(v),
        )
      case 'recalled':
        return pick(`recalled:v${event.version}`, T.recalled(v))
      case 'adjourned':
        return pick('adjourned', T.adjourned(v))
    }
  }

  // 2. Court-wide news.
  switch (event.type) {
    case 'court_not_sitting':
      return done ? null : pick('not_sitting', T.not_sitting(v))
    case 'court_risen':
      return done ? null : pick('risen', T.risen(v))
    case 'break_start':
      return done || away == null || away <= 0
        ? null
        : pick(`break:v${event.version}`, T.break(v))
    case 'correction':
      return null // an undo: the next real update will alert if needed
  }

  // 3. Progress through the list (new item heard, or court resumed).
  if (event.type !== 'now_hearing' && event.type !== 'break_end') return null
  if (done || away == null) return null
  if (away < 0) {
    if ([...sent].some((k) => k.startsWith('passed_over'))) return null
    return pick('moved_past', T.moved_past(v))
  }
  for (const t of THRESHOLDS) {
    if (away <= t && !sent.has(`within_${t}`)) {
      const larger = THRESHOLDS.filter((x) => x > t).map((x) => `within_${x}`)
      const message =
        t === 2
          ? T.close(v)
          : T.within(v)
      return pick(`within_${t}`, message, [...larger, 'first'])
    }
  }
  if (!sent.has('first') && THRESHOLDS.every((t) => !sent.has(`within_${t}`))) {
    return pick('first', T.first(v))
  }
  return null
}

// ---------- Alerts for the firm (lawyers and staff on the case, plus firm admins) ----------
// Separate keys (staff_*) in the same alert_logs table, stored with an empty message so clients never see them.

export type StaffAlertKind = 'close' | 'now' | 'done'

export interface StaffAlertPick {
  key: string
  kind: StaffAlertKind
  message: string
  implied: string[]
}

export function chooseStaffAlert(input: {
  event: AlertEvent
  /** Session progress AFTER the event. */
  currentItem: number | null
  caseItem: number
  roomNo: string
  clientName: string
  /** Alert keys already recorded for this case today (client and staff keys). */
  sent: Set<string>
}): StaffAlertPick | null {
  const { event, currentItem: cur, caseItem: mine, roomNo: court, clientName: who, sent } = input
  if (sent.has('staff_done')) return null
  const pick = (key: string, kind: StaffAlertKind, message: string, implied: string[] = []): StaffAlertPick | null =>
    sent.has(key) ? null : { key, kind, message, implied: implied.filter((k) => !sent.has(k)) }
  const done = (message: string) => pick('staff_done', 'done', message, ['staff_within_2', 'staff_now_hearing'])
  const record = 'Record what happened and the next date.'

  // This exact case.
  if (event.item === mine) {
    switch (event.type) {
      case 'now_hearing':
        return pick('staff_now_hearing', 'now', `${who}'s case (Item ${mine}) is being heard now in Court ${court}.`, ['staff_within_2'])
      case 'recalled':
        return pick(`staff_recalled:v${event.version}`, 'now', `${who}'s case (Item ${mine}) was recalled and is being heard now in Court ${court}.`, ['staff_within_2'])
      case 'adjourned':
        return done(`${who}'s case (Item ${mine}) was adjourned in Court ${court}. ${record}`)
      case 'passed_over':
        return null // it may still be called again; the client is told separately
    }
  }

  // The court stopped for the day.
  if (event.type === 'court_risen') return done(`Court ${court} has risen. ${record} (${who}, Item ${mine})`)
  if (event.type === 'court_not_sitting') return done(`Court ${court} is not sitting today. Record the next date for ${who}'s case (Item ${mine}).`)

  // Progress through the list.
  if ((event.type !== 'now_hearing' && event.type !== 'break_end') || cur == null) return null
  const away = mine - cur
  if (away < 0) {
    // A passed-over case can still be recalled, so moving past it doesn't mean it is over.
    if ([...sent].some((k) => k.startsWith('passed_over'))) return null
    return done(`The hearing of ${who}'s case (Item ${mine}) in Court ${court} is over: the court is now at Item ${cur}. ${record}`)
  }
  if (away > 0 && away <= 2) {
    return pick('staff_within_2', 'close', `${who}'s case is close: Court ${court} is at Item ${cur}, theirs is Item ${mine} (${away} away).`)
  }
  return null
}

/**
 * Who gets a firm alert: the case team and the firm admins, once each. The person who reported the update
 * is in the courtroom and already knows, except for "over": they may still need to record the outcome.
 */
export function staffRecipients(team: (string | null)[], admins: string[], reporterId: string, kind: StaffAlertKind) {
  const all = [...new Set([...team, ...admins].filter((id): id is string => !!id))]
  return kind === 'done' ? all : all.filter((id) => id !== reporterId)
}
