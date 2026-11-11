import assert from 'node:assert/strict'
import { test } from 'node:test'
import { courtDate, decide, isStale, type SessionState } from './engine.js'

const fresh: SessionState = { currentItem: null, hearingItem: null, status: 'not_started' }
const at12: SessionState = { currentItem: 12, hearingItem: 12, status: 'hearing' }

test('first report of the day is accepted at any item', () => {
  const d = decide(fresh, { type: 'now_hearing', item: 20 })
  assert.equal(d.kind, 'apply')
  if (d.kind === 'apply') assert.deepEqual(d.next, { currentItem: 20, hearingItem: 20, status: 'hearing' })
})

test('normal forward step is accepted without confirmation', () => {
  const d = decide(at12, { type: 'now_hearing', item: 13 })
  assert.equal(d.kind, 'apply')
})

test('jump of more than 5 needs confirmation, then applies and is marked confirmed', () => {
  assert.equal(decide(at12, { type: 'now_hearing', item: 17 }).kind, 'apply') // +5 is fine
  const ask = decide(at12, { type: 'now_hearing', item: 18 }) // +6 asks
  assert.equal(ask.kind, 'confirm')
  if (ask.kind === 'confirm') assert.equal(ask.reason, 'jump')
  const ok = decide(at12, { type: 'now_hearing', item: 18, confirm: true })
  assert.equal(ok.kind, 'apply')
  if (ok.kind === 'apply') assert.equal(ok.confirmed, true)
})

test('moving backward needs confirmation', () => {
  const ask = decide(at12, { type: 'now_hearing', item: 9 })
  assert.equal(ask.kind, 'confirm')
  if (ask.kind === 'confirm') assert.equal(ask.reason, 'backward')
  assert.equal(decide(at12, { type: 'now_hearing', item: 9, confirm: true }).kind, 'apply')
})

test('duplicate now-hearing is a no-op', () => {
  assert.equal(decide(at12, { type: 'now_hearing', item: 12 }).kind, 'noop')
})

test('recall changes the item being heard but not the progress pointer', () => {
  const d = decide(at12, { type: 'recalled', item: 7 })
  assert.equal(d.kind, 'apply')
  if (d.kind === 'apply') assert.deepEqual(d.next, { currentItem: 12, hearingItem: 7, status: 'hearing' })
  // after the recalled case, continuing at 13 is a normal step
  if (d.kind === 'apply') assert.equal(decide(d.next, { type: 'now_hearing', item: 13 }).kind, 'apply')
})

test('passed over / adjourned keep progress, clear hearing item if it was that case', () => {
  const d = decide(at12, { type: 'passed_over', item: 12 })
  if (d.kind !== 'apply') assert.fail()
  assert.deepEqual(d.next, { currentItem: 12, hearingItem: null, status: 'hearing' })
  const e = decide(at12, { type: 'adjourned', item: 15 })
  if (e.kind !== 'apply') assert.fail()
  assert.equal(e.next.hearingItem, 12)
})

test('item events require an item number', () => {
  assert.equal(decide(at12, { type: 'adjourned' }).kind, 'reject')
  assert.equal(decide(at12, { type: 'now_hearing', item: 0 }).kind, 'reject')
})

test('break start/end toggle and repeated break is a no-op', () => {
  const b = decide(at12, { type: 'break_start' })
  if (b.kind !== 'apply') assert.fail()
  assert.equal(b.next.status, 'break')
  assert.equal(decide(b.next, { type: 'break_start' }).kind, 'noop')
  const r = decide(b.next, { type: 'break_end' })
  if (r.kind !== 'apply') assert.fail()
  assert.equal(r.next.status, 'hearing')
})

test('undo restores exact previous state only for the latest event', () => {
  const target = { type: 'now_hearing' as const, isLatest: true, prevCurrentItem: 11, prevHearingItem: 11, prevStatus: 'hearing' as const }
  const d = decide(at12, { type: 'correction' }, target)
  if (d.kind !== 'apply') assert.fail()
  assert.deepEqual(d.next, { currentItem: 11, hearingItem: 11, status: 'hearing' })
  assert.equal(decide(at12, { type: 'correction' }, { ...target, isLatest: false }).kind, 'reject')
  assert.equal(decide(at12, { type: 'correction' }, { ...target, type: 'correction' }).kind, 'reject')
})

test('stale after 20 minutes only while court is sitting', () => {
  const now = Date.now()
  const old = new Date(now - 21 * 60 * 1000)
  assert.equal(isStale('hearing', old, now), true)
  assert.equal(isStale('hearing', new Date(now - 5 * 60 * 1000), now), false)
  assert.equal(isStale('risen', old, now), false)
})

test('court date uses India time', () => {
  // 20:00 UTC on Nov 11 is 01:30 IST on Nov 12
  assert.equal(courtDate(new Date('2026-11-11T20:00:00Z')), '2026-11-12')
})
