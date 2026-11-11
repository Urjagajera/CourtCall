import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chooseAlert, type AlertEvent } from './alertRules.js'

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
