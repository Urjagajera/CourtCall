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
}): AlertPick | null {
  const { event, currentItem: cur, caseItem: mine, roomNo, sent } = input
  const court = `Court ${roomNo}`
  const pick = (key: string, message: string, implied: string[] = []): AlertPick | null =>
    sent.has(key) ? null : { key, message, implied: implied.filter((k) => !sent.has(k)) }
  // Once a case has been heard or adjourned, only court-level news that still matters goes out.
  const done = sent.has('now_hearing') || sent.has('adjourned')
  const away = cur == null ? null : mine - cur

  // 1. Updates about this exact case always win.
  if (event.item === mine) {
    switch (event.type) {
      case 'now_hearing':
        return pick('now_hearing', `Your case (Item ${mine}) is being heard now in ${court}.`, [
          ...THRESHOLDS.map((t) => `within_${t}`),
          'first',
        ])
      case 'passed_over':
        return pick(
          `passed_over:v${event.version}`,
          `Your case (Item ${mine}) was passed over in ${court}. It may be called again later. Your lawyer will update you.`,
        )
      case 'recalled':
        return pick(`recalled:v${event.version}`, `Your case (Item ${mine}) has been recalled and is being heard now in ${court}.`)
      case 'adjourned':
        return pick('adjourned', `Your case (Item ${mine}) was adjourned in ${court}. Your lawyer will share the next date.`)
    }
  }

  // 2. Court-wide news.
  switch (event.type) {
    case 'court_not_sitting':
      return done ? null : pick('not_sitting', `${court} is not sitting today. Your lawyer will update you.`)
    case 'court_risen':
      return done ? null : pick('risen', `${court} has risen for the day. Your lawyer will update you.`)
    case 'break_start':
      return done || away == null || away <= 0
        ? null
        : pick(`break:v${event.version}`, `${court} is on a short break. Latest progress: Item ${cur}. Yours is Item ${mine}.`)
    case 'correction':
      return null // an undo: the next real update will alert if needed
  }

  // 3. Progress through the list (new item heard, or court resumed).
  if (event.type !== 'now_hearing' && event.type !== 'break_end') return null
  if (done || away == null) return null
  if (away < 0) {
    if ([...sent].some((k) => k.startsWith('passed_over'))) return null
    return pick('moved_past', `${court} has moved past your item (now Item ${cur}). Your lawyer will update you.`)
  }
  for (const t of THRESHOLDS) {
    if (away <= t && !sent.has(`within_${t}`)) {
      const larger = THRESHOLDS.filter((x) => x > t).map((x) => `within_${x}`)
      const message =
        t === 2
          ? `Your case is close: ${court} is at Item ${cur}, yours is Item ${mine} (${away} away). Be near the courtroom.`
          : `${court} is at Item ${cur}. Your case is Item ${mine} (${away} away). Get ready.`
      return pick(`within_${t}`, message, [...larger, 'first'])
    }
  }
  if (!sent.has('first') && THRESHOLDS.every((t) => !sent.has(`within_${t}`))) {
    return pick('first', `${court} has started. Now: Item ${cur}. Your case is Item ${mine} (${away} away).`)
  }
  return null
}
