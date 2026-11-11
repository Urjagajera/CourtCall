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
