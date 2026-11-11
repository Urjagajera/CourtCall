// Usage: npm run smoke  (API must be running, DEMO_LOGIN=true, demo data seeded)
// End-to-end check of every API flow as the demo users. Courtroom tests use an isolated
// "Smoke Test Court / 99" room so demo courtrooms are not touched. Cleans up what it creates.
const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4000/api'

type Res = { status: number; body: any }
class Session {
  cookie = ''
  constructor(public label: string) {}
  async req(method: string, path: string, body?: unknown): Promise<Res> {
    const r = await fetch(BASE + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const set = r.headers.get('set-cookie')
    if (set) this.cookie = set.split(';')[0]
    return { status: r.status, body: await r.json().catch(() => ({})) }
  }
  get = (p: string) => this.req('GET', p)
  post = (p: string, b?: unknown) => this.req('POST', p, b ?? {})
  patch = (p: string, b: unknown) => this.req('PATCH', p, b)
  put = (p: string, b: unknown) => this.req('PUT', p, b)
  del = (p: string) => this.req('DELETE', p)
}

let pass = 0
const failures: string[] = []
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) pass++
  else failures.push(`${name}${detail !== undefined ? ` -> ${JSON.stringify(detail).slice(0, 300)}` : ''}`)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

async function login(key: string) {
  const s = new Session(key)
  const r = await s.post('/auth/demo', { account: key })
  check(`demo login: ${key}`, r.status === 200, r)
  return s
}

const anon = new Session('anon')
check('health ok', (await anon.get('/health')).body.db === 'connected')
check('unknown /api route is 404', (await anon.get('/nope')).status === 404)
check('me without login returns no user', (await anon.get('/auth/me')).body.user === null)
check('demo list available', (await anon.get('/auth/demo')).body.accounts?.length === 6)
const wrong = await anon.post('/auth/login', { email: 'mehta@courtcall.demo', password: 'wrong-password' })
check('wrong password rejected', wrong.status === 401, wrong)
check('junior signup with bad invite code rejected', (await anon.post('/auth/register/junior', { name: 'Test', email: `x${Date.now()}@t.test`, phone: '9800000000', password: 'password123', inviteCode: 'ZZZZZZ' })).status === 400)
check('signup validation errors are per-field', !!(await anon.post('/auth/register/lawyer', { email: 'bad' })).body.details?.email)

const lawyer = await login('lawyer')
const junior = await login('junior')
const lawyer2 = await login('lawyer2')
const junior2 = await login('junior2')

const me = await lawyer.get('/auth/me')
check('lawyer me has office + invite code', me.body.office?.inviteCode === 'MEHTA4', me.body)
check('junior me hides invite code', (await junior.get('/auth/me')).body.office?.inviteCode === undefined)

// ---- clients ----
const c1 = await lawyer.post('/clients', { name: 'Smoke Client', phone: '9812345678', language: 'gu' })
check('create client', c1.status === 201, c1.body)
const clientId = c1.body.client?.id
check('edit client', (await lawyer.patch(`/clients/${clientId}`, { name: 'Smoke Client 2' })).body.client?.name === 'Smoke Client 2')
check('client list includes nexconn id', (await lawyer.get('/clients')).body.clients?.some((c: any) => c.id === clientId && c.ncId))
check('other office cannot edit my client', (await lawyer2.patch(`/clients/${clientId}`, { name: 'hack' })).status === 404)
check('other office cannot see my client', !(await lawyer2.get('/clients')).body.clients?.some((c: any) => c.id === clientId))
check('junior cannot create client', (await junior.post('/clients', { name: 'X Y' })).status === 403)
check('invalid client rejected', (await lawyer.post('/clients', { name: 'A' })).status === 400)

// ---- office / team ----
const office = await lawyer.get('/office')
check('office team list', office.status === 200 && office.body.members?.length >= 2, office.body)
const priyaId = office.body.members?.find((m: any) => m.email === 'priya@courtcall.demo')?.id
const jt = await junior.get('/office')
check('junior sees team without contact details or invite code', jt.status === 200 && !jt.body.office?.inviteCode && !jt.body.members?.[0]?.email, jt.body)
check('junior cannot manage the team', (await junior.patch(`/office/members/${priyaId}`, { role: 'staff' })).status === 403)

// ---- firm roles: staff, firm admin, joining a firm ----
const lawyer3 = await login('lawyer3')
const staff = await login('staff')
check('founder is a firm admin', me.body.user?.isFirmAdmin === true && me.body.office?.isFounder === true, me.body.user)
check('second lawyer is not a firm admin', (await lawyer3.get('/auth/me')).body.user?.isFirmAdmin === false)
check('non-admin lawyer cannot manage the team', (await lawyer3.patch(`/office/members/${priyaId}`, { role: 'staff' })).status === 403)
check('staff can see clients', (await staff.get('/clients')).status === 200)
check('staff sees today read-only', (await staff.get('/courtrooms/today')).status === 200)
check('staff cannot join a courtroom', (await staff.post('/courtrooms/join', { courtComplex: 'Smoke Test Court', roomNo: '99' })).status === 403)
check('staff gets a chat token', (await staff.post('/chat/token')).status === 200)

const stamp = Date.now()
const newbie = new Session('newbie')
const reg = await newbie.post('/auth/register/member', { name: 'Smoke Clerk', email: `clerk${stamp}@smoke.test`, phone: '9800000001', password: 'password123', role: 'staff', inviteCode: 'mehta4' })
check('staff signs up with the invite code (pending)', reg.status === 201 && reg.body.user?.role === 'staff' && reg.body.user?.verificationStatus === 'pending', reg.body)
const newbieId = reg.body.user?.id
check('pending member is blocked', (await newbie.get('/clients')).status === 403)
check('lawyer can join with name, contact and invite code', (await anon.post('/auth/register/member', { name: 'Smoke Lawyer', email: `law${stamp}@smoke.test`, phone: '9800000002', password: 'password123', role: 'lawyer', inviteCode: 'MEHTA4' })).status === 201)
check('firm admin approves the new member', (await lawyer.post(`/office/members/${newbieId}/verification`, { status: 'verified' })).body.user?.verificationStatus === 'verified')
check('approved member gets in', (await newbie.get('/clients')).status === 200)
check('firm admin makes staff a firm admin', (await lawyer.patch(`/office/members/${newbieId}`, { isFirmAdmin: true })).body.user?.isFirmAdmin === true)
check('staff firm admin can manage the team', (await newbie.get('/office')).body.office?.inviteCode === 'MEHTA4')
check('juniors cannot be firm admins', (await lawyer.patch(`/office/members/${newbieId}`, { role: 'junior', isFirmAdmin: true })).status === 400)
check('moving to junior removes admin rights', (await lawyer.patch(`/office/members/${newbieId}`, { role: 'junior' })).body.user?.isFirmAdmin === false)
check('nobody edits themselves', (await lawyer.patch(`/office/members/${me.body.user?.id}`, { role: 'staff' })).status === 400)
check('founder cannot be deactivated', (await lawyer.post(`/office/members/${me.body.user?.id}/verification`, { status: 'rejected' })).status === 400)
check('other firm cannot touch my people', (await lawyer2.patch(`/office/members/${newbieId}`, { role: 'staff' })).status === 404)
check('deactivate member', (await lawyer.post(`/office/members/${newbieId}/verification`, { status: 'rejected' })).body.user?.verificationStatus === 'rejected')
check('deactivated member is blocked', (await newbie.get('/cases')).status === 403)

// ---- cases ----
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
const k1 = await lawyer.post('/cases', { clientId, title: 'Smoke vs Test', courtComplex: ' smoke   test court ', roomNo: '99', hearingDate: today, itemNo: 7, assignedJuniorId: priyaId })
check('create case (court name normalised)', k1.status === 201, k1.body)
const caseId = k1.body.case?.id
const list = await lawyer.get(`/cases?date=${today}`)
const listed = list.body.cases?.find((c: any) => c.id === caseId)
check('case listed with court + client', listed?.roomNo === '99' && listed?.clientName === 'Smoke Client 2', listed)
check('edit case item', (await lawyer.patch(`/cases/${caseId}`, { itemNo: 8 })).body.case?.itemNo === 8)
check('edit case court needs both fields', (await lawyer.patch(`/cases/${caseId}`, { roomNo: '98' })).status === 400)
check('junior sees office cases', (await junior.get('/cases')).body.cases?.some((c: any) => c.id === caseId))
check('other office cannot see my case', !(await lawyer2.get('/cases')).body.cases?.some((c: any) => c.id === caseId))
check('case with other office client rejected', (await lawyer2.post('/cases', { clientId, title: 'Bad case', courtComplex: 'X Court', roomNo: '1', hearingDate: today, itemNo: 1 })).status === 400)

// ---- courtrooms ----
const t1 = await junior.get('/courtrooms/today')
const room = t1.body.sessions?.find((s: any) => s.courtroom.roomNo === '99')
check('junior auto-joined smoke room via office case', !!room, t1.body)
check('room shows only my office cases', room?.myCases?.every((c: any) => c.id === caseId))
const sid = room?.id
const j2 = await junior2.post('/courtrooms/join', { courtComplex: 'Smoke Test Court', roomNo: '99' })
check('other office junior joins same room', j2.body.sessionId === sid, j2.body)
check('non-member cannot read room', (await lawyer2.get(`/sessions/${sid}`)).status === 403)

let s = (await junior.get(`/sessions/${sid}`)).body
check('room detail has members + chat group', Array.isArray(s.members) && s.members.length >= 2, s)
const v0 = s.session.version
const e1 = await junior.post(`/sessions/${sid}/events`, { type: 'now_hearing', item: (s.session.currentItem ?? 0) + 1, baseVersion: v0 })
check('report now hearing', e1.status === 201, e1.body)
const e2 = await junior2.post(`/sessions/${sid}/events`, { type: 'now_hearing', item: 50, baseVersion: v0 })
check('stale baseVersion -> 409 conflict', e2.status === 409 && e2.body.session?.version === v0 + 1, e2.body)
const cur = e1.body.session.currentItem
const e3 = await junior2.post(`/sessions/${sid}/events`, { type: 'now_hearing', item: cur + 10, baseVersion: v0 + 1 })
check('big jump asks for confirmation', !!e3.body.needsConfirmation, e3.body)
const e4 = await junior2.post(`/sessions/${sid}/events`, { type: 'now_hearing', item: cur + 10, baseVersion: v0 + 1, confirm: true })
check('confirmed jump applied', e4.status === 201 && e4.body.event?.confirmed === true, e4.body)
const e5 = await junior2.post(`/sessions/${sid}/events`, { type: 'correction', correctsEventId: e4.body.event?.id, baseVersion: v0 + 2 })
check('undo restores previous item', e5.status === 201 && e5.body.session?.currentItem === cur, e5.body)
const e6 = await junior.post(`/sessions/${sid}/events`, { type: 'correction', correctsEventId: e1.body.event?.id, baseVersion: v0 + 3 })
check('cannot undo an older event', e6.status === 400, e6.body)
const e7 = await junior.post(`/sessions/${sid}/events`, { type: 'passed_over', item: cur, baseVersion: v0 + 3 })
check('passed over', e7.status === 201 && e7.body.session?.hearingItem === null, e7.body)
const e8 = await junior.post(`/sessions/${sid}/events`, { type: 'recalled', item: cur, baseVersion: v0 + 4 })
check('recalled', e8.status === 201 && e8.body.session?.hearingItem === cur, e8.body)
const e9 = await junior.post(`/sessions/${sid}/events`, { type: 'break_start', baseVersion: v0 + 5 })
check('break', e9.body.session?.status === 'break', e9.body)
const e10 = await junior.post(`/sessions/${sid}/events`, { type: 'break_start', baseVersion: v0 + 6 })
check('duplicate break is noop', !!e10.body.noop, e10.body)
const e11 = await junior.post(`/sessions/${sid}/events`, { type: 'break_end', baseVersion: v0 + 6 })
check('resume', e11.body.session?.status === 'hearing', e11.body)
check('item event without item rejected', (await junior.post(`/sessions/${sid}/events`, { type: 'adjourned', baseVersion: v0 + 7 })).status === 400)
s = (await junior2.get(`/sessions/${sid}`)).body
check('history visible to other office', s.events?.length >= 7 && s.events.some((e: any) => e.officeName === 'Mehta & Associates'), s.events?.length)
check('lawyer today shows room with distance data', (await lawyer.get('/courtrooms/today')).body.sessions?.some((x: any) => x.id === sid && x.currentItem != null))

// ---- client links ----
check('no client link before the case number is added', (await lawyer.post(`/cases/${caseId}/links`, { kind: 'client' })).status === 400)
check('case number added', (await lawyer.patch(`/cases/${caseId}`, { caseNo: 'SMK/1/2026' })).body.case?.caseNo === 'SMK/1/2026')
check('case can be saved without an item number (cause list not out)', (await lawyer.patch(`/cases/${caseId}`, { itemNo: null })).body.case?.itemNo === null)
await lawyer.patch(`/cases/${caseId}`, { itemNo: 8 })
const mk = await lawyer.post(`/cases/${caseId}/links`, { kind: 'client' })
check('lawyer creates a client link (token returned once)', mk.status === 201 && typeof mk.body.token === 'string' && mk.body.token.length > 20, mk.body)
const linkToken = mk.body.token
check('junior cannot create links', (await junior.post(`/cases/${caseId}/links`, { kind: 'client' })).status === 403)
check('other firm cannot see my links', (await lawyer2.get(`/cases/${caseId}/links`)).status === 404)
check("staff can't share links for clients not assigned to them", (await staff.post(`/cases/${caseId}/links`, { kind: 'family' })).status === 404)
const staffId = (await staff.get('/auth/me')).body.user?.id
const viaShare = await lawyer.post(`/cases/${caseId}/links`, { kind: 'family', assignTo: [staffId] })
check('sharing a link assigns the chosen people', viaShare.status === 201 && ((await staff.get('/clients')).body.clients ?? []).some((k: any) => k.id === clientId))
check('assigned staff can create links', (await staff.post(`/cases/${caseId}/links`, { kind: 'family' })).status === 201)
const phoneA = 'device-aaaaaaaaaaaaaaaa'
const phoneB = 'device-bbbbbbbbbbbbbbbb'
const clientA = new Session('clientA')
check('no link, no access', (await clientA.get('/c/me')).status === 401)
check('client opens link on first phone', (await clientA.post('/c/activate', { token: linkToken, deviceId: phoneA })).status === 200)
const cme = await clientA.get('/c/me')
check('client sees only their case, live', cme.body.case?.title === 'Smoke vs Test' && cme.body.isToday === true && cme.body.session?.currentItem != null, cme.body)
check('client never sees reporter names', !JSON.stringify(cme.body.updates ?? []).includes('reporter') && !JSON.stringify(cme.body).includes('Priya'))
check('second phone is refused', (await new Session('clientB').post('/c/activate', { token: linkToken, deviceId: phoneB })).status === 409)
check('same phone can reopen the link', (await new Session('clientA2').post('/c/activate', { token: linkToken, deviceId: phoneA })).status === 200)
const listed2 = await lawyer.get(`/cases/${caseId}/links`)
const clientLink = listed2.body.links?.find((l: any) => l.kind === 'client' && !l.revokedAt)
check('firm sees the link as opened, never the token', !!clientLink?.activatedAt && !JSON.stringify(listed2.body).includes(linkToken), listed2.body)
const ct = await clientA.post('/c/chat-token')
check('client gets a chat token with firm contacts', ct.status === 200 && ct.body.userId?.startsWith('c') && ct.body.contacts?.length >= 1, { status: ct.status, err: ct.body.error })
const fam = await lawyer.post(`/cases/${caseId}/links`, { kind: 'family' })
const famPhone = new Session('family')
await famPhone.post('/c/activate', { token: fam.body.token, deviceId: 'device-family-1234567' })
check('family link shows progress', (await famPhone.get('/c/me')).body.kind === 'family')
check('family link has no chat', (await famPhone.post('/c/chat-token')).status === 403)
check('firm turns the link off', (await lawyer.post(`/links/${clientLink?.id}/revoke`)).status === 200)
check('turned-off link stops working at once', (await clientA.get('/c/me')).status === 410)
const re = await lawyer.post(`/links/${clientLink?.id}/reissue`)
const clientNew = new Session('clientNew')
check('reissued link works on a new phone', re.status === 201 && (await clientNew.post('/c/activate', { token: re.body.token, deviceId: phoneB })).status === 200)

// ---- client alerts ----
const before = (await junior.get(`/sessions/${sid}`)).body.session
const heard = await junior.post(`/sessions/${sid}/events`, { type: 'now_hearing', item: 8, baseVersion: before.version, confirm: true })
check('junior reports the client’s own item', heard.status === 201, heard.body)
const waitAlerts = async (pred: (a: any[]) => boolean) => {
  for (let i = 0; i < 20; i++) {
    const a = (await clientNew.get('/c/me')).body.alerts ?? []
    if (pred(a)) return a
    await new Promise((r) => setTimeout(r, 500))
  }
  return (await clientNew.get('/c/me')).body.alerts ?? []
}
const alerts1 = await waitAlerts((a) => a.some((x: any) => /being heard now/.test(x.message)))
check('client gets a "being heard now" alert', alerts1.some((x: any) => /Item 8\) is being heard now/.test(x.message)), alerts1)
check('alerts never show empty bookkeeping rows', alerts1.every((x: any) => x.message))
const after = (await junior.get(`/sessions/${sid}`)).body.session
await junior.post(`/sessions/${sid}/events`, { type: 'break_start', baseVersion: after.version })
await new Promise((r) => setTimeout(r, 2500))
const alerts2 = (await clientNew.get('/c/me')).body.alerts ?? []
check('no more alerts after the case was heard', alerts2.length === alerts1.length, alerts2)
const fin = (await junior.get(`/sessions/${sid}`)).body.session
await junior.post(`/sessions/${sid}/events`, { type: 'break_end', baseVersion: fin.version })
check('push key is available for phone alerts', (await clientNew.get('/c/push-key')).body.publicKey?.length > 20)
check('other firm cannot revoke my links', (await lawyer2.post(`/links/${re.body.link?.id}/revoke`)).status === 404)
// ---- who sees which clients ----
const names = async (s: Session) => ((await s.get('/clients')).body.clients ?? []).map((c: any) => c.name)
const mehtaSees = await names(lawyer)
const anilSees = await names(lawyer3)
check('firm admin sees every client', mehtaSees.includes('Ramesh Patel') && mehtaSees.includes('Sunita Joshi'), mehtaSees)
check('lawyer sees only assigned clients', anilSees.includes('Ramesh Patel') && !anilSees.includes('Sunita Joshi'), anilSees)
const anilCases = ((await lawyer3.get('/cases')).body.cases ?? []).map((c: any) => c.clientName)
check("lawyer doesn't see unassigned clients' cases", anilCases.length > 0 && !anilCases.includes('Sunita Joshi'), anilCases)
const juniorCases = ((await junior.get('/cases')).body.cases ?? []).map((c: any) => c.clientName)
check('juniors still see every firm case (they cover courtrooms)', juniorCases.includes('Sunita Joshi'))
const sunitaId = ((await lawyer.get('/clients')).body.clients ?? []).find((c: any) => c.name === 'Sunita Joshi')?.id
const sunitaCase = ((await lawyer.get('/cases')).body.cases ?? []).find((c: any) => c.clientId === sunitaId)
check("lawyer can't share a link for an unassigned client", (await lawyer3.post(`/cases/${sunitaCase?.id}/links`, { kind: 'family' })).status === 404)
check('only firm admins change assignments', (await lawyer3.put(`/clients/${sunitaId}/assignees`, { userIds: [] })).status === 403)
const anilId = (await lawyer3.get('/auth/me')).body.user?.id
check('firm admin assigns a client', (await lawyer.put(`/clients/${sunitaId}/assignees`, { userIds: [anilId] })).status === 200 && (await names(lawyer3)).includes('Sunita Joshi'))
const famSunita = await lawyer.post(`/cases/${sunitaCase?.id}/links`, { kind: 'family', assignTo: [] })
check('sharing a link keeps assignments', famSunita.status === 201 && (await names(lawyer3)).includes('Sunita Joshi'))
await lawyer.post(`/links/${famSunita.body.link?.id}/revoke`)
check('people list for the picker', ((await staff.get('/office/people')).body.people ?? []).length >= 3)

// ---- hearing outcomes, reminders, calendar, detail pages ----
const pendingMehta = (await lawyer.get('/hearings/pending')).body.cases ?? []
const maint = pendingMehta.find((k: any) => k.title === 'Joshi vs Joshi (maintenance)')
check('firm admin is reminded of a hearing that happened', !!maint, pendingMehta.map((k: any) => k.title))
check('the assigned lawyer is reminded too', ((await lawyer3.get('/hearings/pending')).body.cases ?? []).some((k: any) => k.id === maint?.id))
check('juniors get no reminder list', (await junior.get('/hearings/pending')).status === 403)
check('next date must be after the hearing', (await lawyer.post(`/cases/${maint?.id}/outcome`, { outcome: 'next_date', nextDate: '2020-01-01' })).status === 400)
check('next date is required', (await lawyer.post(`/cases/${maint?.id}/outcome`, { outcome: 'next_date' })).status === 400)
const nextDate = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)
const rec = await lawyer.post(`/cases/${maint?.id}/outcome`, { outcome: 'next_date', nextDate, summary: 'Reply filed. Arguments next time.', shareWithClient: true, prepNotes: 'SECRET-PREP: get income proof' })
check('outcome recorded and case moved to the next date', rec.status === 201 && rec.body.case?.hearingDate === nextDate && rec.body.case?.itemNo === null, rec.body)
check('the next (future) hearing cannot get an outcome yet', (await lawyer.post(`/cases/${maint?.id}/outcome`, { outcome: 'closed' })).status === 400)
check('reminder cleared after recording', !((await lawyer.get('/hearings/pending')).body.cases ?? []).some((k: any) => k.id === maint?.id))
const det = (await lawyer.get(`/cases/${maint?.id}/detail`)).body
check('case detail shows the hearing history with notes', det.hearings?.[0]?.summary === 'Reply filed. Arguments next time.' && det.hearings?.[0]?.prepNotes?.includes('SECRET-PREP'), det)
check('juniors can open case details', (await junior.get(`/cases/${maint?.id}/detail`)).status === 200)
check("lawyer can't open an unassigned client's case", (await lawyer2.get(`/cases/${maint?.id}/detail`)).status === 404)
const cd = (await lawyer.get(`/clients/${maint?.clientId}/detail`)).body
check('client detail lists all their cases with hearings', cd.cases?.length >= 2 && cd.cases.some((k: any) => k.hearings?.length >= 1))
const monthEnd = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10)
const cal = (await lawyer.get(`/calendar?from=2026-01-01&to=${monthEnd}`)).body.events ?? []
check('calendar shows held and upcoming hearings', cal.some((e: any) => e.kind === 'held') && cal.some((e: any) => e.kind === 'upcoming' && e.caseId === maint?.id))
check('calendar rejects a backwards range', (await lawyer.get('/calendar?from=2026-12-01&to=2026-01-01')).status === 400)

const demoClient = new Session('demoClient')
check('client demo opens Ramesh Patel', (await demoClient.post('/c/demo')).status === 200 && (await demoClient.get('/c/me')).body.case?.title === 'Patel vs State of Gujarat')
const rameshMe = (await demoClient.get('/c/me')).body
check('client picks Gujarati (also their alert language)', (await demoClient.post('/c/language', { language: 'gu' })).status === 200 && (await demoClient.get('/c/me')).body.language === 'gu')
await demoClient.post('/c/language', { language: 'en' })
check('unsupported language rejected', (await demoClient.post('/c/language', { language: 'fr' })).status === 400)
check('client sees all their cases (today and past)', rameshMe.cases?.length >= 3 && rameshMe.cases.some((k: any) => k.hearingDate < rameshMe.today), rameshMe.cases)
check('client sees earlier court days in history', rameshMe.history?.some((h: any) => h.date < rameshMe.today && /adjourned/.test(h.message)))
check('client sees the shared hearing summary and the next date', rameshMe.hearings?.some((h: any) => h.summary && h.nextDate === rameshMe.today))
check('client never sees prep notes', !JSON.stringify(rameshMe).includes('surety') && !JSON.stringify(rameshMe).includes('prepNotes'))
const pastCase = rameshMe.cases?.find((k: any) => k.hearingDate < rameshMe.today)
check('client opens one of their other cases', (await demoClient.get(`/c/me?case=${pastCase?.id}`)).body.case?.title === pastCase?.title)
const cases2 = (await clientNew.get('/c/me')).body.cases ?? []
check('client sees their own cases list', cases2.some((k: any) => k.id === caseId && k.current), cases2)
check('client cannot open another client’s case', (await clientNew.get(`/c/me?case=${rameshMe.caseId}`)).status === 404)
check('family link sees only the shared case', (await famPhone.get(`/c/me?case=${rameshMe.caseId}`)).status === 404 && ((await famPhone.get('/c/me')).body.cases ?? []).length === 0)
check('client signs out of this phone', (await clientNew.post('/c/signout')).status === 200 && (await clientNew.get('/c/me')).status === 401)

// ---- chat ----
const tok = await junior.post('/chat/token')
check('chat token for junior (with team room)', tok.status === 200 && !!tok.body.token && !!tok.body.team?.groupId, { status: tok.status, err: tok.body.error })
check('old platform admin api is gone', (await lawyer.get('/admin/lawyers')).status === 404)
const founder = new Session('founder')
const fr = await founder.post('/auth/register/lawyer', { name: 'Smoke Founder', email: `founder${Date.now()}@smoke.test`, phone: '9800000003', password: 'password123', officeName: 'Smoke Firm' })
check('a new firm founder can start straight away', fr.status === 201 && fr.body.user?.verificationStatus === 'verified' && fr.body.user?.isFirmAdmin === true, fr.body)

// ---- logout + cleanup ----
check('delete case', (await lawyer.del(`/cases/${caseId}`)).status === 200)
check('delete client', (await lawyer.del(`/clients/${clientId}`)).status === 200)
await lawyer.post('/auth/logout')
check('after logout me has no user', (await lawyer.get('/auth/me')).body.user === null)

console.log(`\n${pass} passed, ${failures.length} failed`)
if (failures.length) {
  console.log('\nFailures:\n' + failures.map((f) => ' - ' + f).join('\n'))
  process.exit(1)
}
