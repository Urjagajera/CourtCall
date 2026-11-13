import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chooseAlert, chooseStaffAlert, staffRecipients, type AlertEvent } from './alertRules.js'

const ev = (type: AlertEvent['type'], item: number | null = null, version = 1): AlertEvent => ({ type, item, version })
const run = (event: AlertEvent, currentItem: number | null, sent: string[] = [], caseItem = 15) =>
  chooseAlert({ event, currentItem, caseItem, roomNo: '4', sent: new Set(sent) })

test('first update far away sends a "court has started" alert once', () => {
  const a = run(ev('now_hearing', 1), 1)
  assert.equal(a?.key, 'first')
  assert.match(a!.message, /Court 4 has started.*Item 15 \(14 away\)/)
  assert.equal(run(ev('now_hearing', 2), 2, ['first']), null)
})

test('thresholds fire once each, nearest first', () => {
  assert.equal(run(ev('now_hearing', 5), 5, ['first'])?.key, 'within_10')
  assert.equal(run(ev('now_hearing', 6), 6, ['first', 'within_10']), null)
  assert.equal(run(ev('now_hearing', 10), 10, ['first', 'within_10'])?.key, 'within_5')
  const two = run(ev('now_hearing', 13), 13, ['first', 'within_10', 'within_5'])
  assert.equal(two?.key, 'within_2')
  assert.match(two!.message, /close/)
})

test('a big jump sends only the nearest threshold and silently marks the others', () => {
  const a = run(ev('now_hearing', 14), 14)
  assert.equal(a?.key, 'within_2')
  assert.deepEqual(a?.implied.sort(), ['first', 'within_10', 'within_5'])
})

test('own case being heard, passed over, recalled, adjourned', () => {
  assert.equal(run(ev('now_hearing', 15), 15)?.key, 'now_hearing')
  assert.equal(run(ev('passed_over', 15, 7), 15)?.key, 'passed_over:v7')
  assert.equal(run(ev('recalled', 15, 9), 20)?.key, 'recalled:v9')
  assert.equal(run(ev('adjourned', 15), 15)?.key, 'adjourned')
})

test('other cases being passed over do not alert this client', () => {
  assert.equal(run(ev('passed_over', 12), 12, ['first', 'within_10', 'within_5']), null)
})

test('moving past without being heard alerts once; not after own passed over', () => {
  assert.equal(run(ev('now_hearing', 16), 16, ['first', 'within_10', 'within_5', 'within_2'])?.key, 'moved_past')
  assert.equal(run(ev('now_hearing', 16), 16, ['passed_over:v3']), null)
})

test('nothing more after the case was heard, except it is never repeated', () => {
  assert.equal(run(ev('now_hearing', 16), 16, ['now_hearing']), null)
  assert.equal(run(ev('court_risen'), 16, ['now_hearing']), null)
})

test('court-wide news: break while waiting, not sitting, risen', () => {
  assert.equal(run(ev('break_start', null, 4), 10)?.key, 'break:v4')
  assert.equal(run(ev('break_start', null, 4), 16), null) // already past this case
  assert.equal(run(ev('court_not_sitting'), null)?.key, 'not_sitting')
  assert.equal(run(ev('court_risen'), 12)?.key, 'risen')
})

test('undo never alerts, and no message predicts a time', () => {
  assert.equal(run(ev('correction'), 12), null)
  const msgs = [run(ev('now_hearing', 1), 1), run(ev('now_hearing', 14), 14), run(ev('now_hearing', 15), 15)].map((a) => a!.message)
  for (const m of msgs) assert.doesNotMatch(m, /\b(minute|min|hour|o'clock|am|pm|soon)\b/i)
})

test('alerts use the client language (Hindi, Gujarati)', () => {
  const base = { event: { type: 'now_hearing' as const, item: 12, version: 9 }, currentItem: 12, caseItem: 15, roomNo: '4', sent: new Set<string>() }
  assert.match(chooseAlert({ ...base, lang: 'hi' })!.message, /कोर्ट 4.*3 बाकी/)
  assert.match(chooseAlert({ ...base, lang: 'gu' })!.message, /કોર્ટ 4.*3 બાકી/)
  assert.match(chooseAlert(base)!.message, /Court 4 is at Item 12/)
})

// ---------- firm (staff) alerts ----------

const staff = (event: AlertEvent, currentItem: number | null, sent: string[] = [], caseItem = 15) =>
  chooseStaffAlert({ event, currentItem, caseItem, roomNo: '4', clientName: 'Ramesh Patel', sent: new Set(sent) })

test('firm is told when the client is 2 away, once', () => {
  assert.equal(staff(ev('now_hearing', 10), 10), null)
  const a = staff(ev('now_hearing', 13), 13)
  assert.equal(a?.key, 'staff_within_2')
  assert.equal(a?.kind, 'close')
  assert.match(a!.message, /Ramesh Patel's case is close: Court 4 is at Item 13, theirs is Item 15 \(2 away\)/)
  assert.equal(staff(ev('now_hearing', 14), 14, ['staff_within_2']), null)
})

test('firm is told when the case is being heard (implies the 2-away alert)', () => {
  const a = staff(ev('now_hearing', 15), 15)
  assert.equal(a?.key, 'staff_now_hearing')
  assert.deepEqual(a?.implied, ['staff_within_2'])
  assert.equal(staff(ev('now_hearing', 15), 15, ['staff_now_hearing']), null)
})

test('firm is told when the hearing is over: moved past, adjourned, risen, not sitting', () => {
  const past = staff(ev('now_hearing', 16), 16, ['staff_now_hearing'])
  assert.equal(past?.key, 'staff_done')
  assert.equal(past?.kind, 'done')
  assert.match(past!.message, /Record what happened/)
  assert.equal(staff(ev('adjourned', 15), 12)?.key, 'staff_done')
  assert.equal(staff(ev('court_risen'), 12)?.key, 'staff_done')
  assert.equal(staff(ev('court_not_sitting'), null)?.key, 'staff_done')
  // Only once per day, whatever comes after.
  assert.equal(staff(ev('court_risen'), 16, ['staff_done']), null)
})

test('a passed-over case is not reported as over when the court moves past it', () => {
  assert.equal(staff(ev('passed_over', 15), 15), null)
  assert.equal(staff(ev('now_hearing', 16), 16, ['passed_over:v3']), null)
  assert.equal(staff(ev('recalled', 15, 9), 17, ['passed_over:v3'])?.kind, 'now')
})

test('firm alerts ignore breaks and corrections', () => {
  assert.equal(staff(ev('break_start'), 13), null)
  assert.equal(staff(ev('correction'), 13), null)
})

test('recipients: team + firm admins, once each; the reporter is skipped unless the hearing is over', () => {
  assert.deepEqual(staffRecipients(['main', 'junior', null], ['admin', 'main'], 'junior', 'close'), ['main', 'admin'])
  assert.deepEqual(staffRecipients(['main', 'junior', null], ['admin'], 'junior', 'done'), ['main', 'junior', 'admin'])
})
