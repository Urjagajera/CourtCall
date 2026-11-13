// Hearing-day briefing for clients (flow agreed with Urja, 12–13 Nov 2026; see CLAUDE.md).
// Between 9 and 10 AM (Vercel cron) — or when the main lawyer / firm admin taps "Send briefing now" —
// each client with a hearing today gets: a CourtCall bot message (CC:Briefing, opens the
// "CourtCall is calling" screen that reads it aloud) + a phone notification. Fixed templates only;
// never a predicted time. Sent once per case per day (alert_logs key "briefing"), then the
// lawyer's Remember note is cleared.
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ensureNexconnUser } from './alerts.js'
import type { Lang } from './alertText.js'
import { courtDate } from './engine.js'
import { MSG_BRIEFING, ncClientId, safely, sendBotDirectMessage } from './nexconn.js'
import { pushToLinks } from './push.js'
import { translateNote } from './translate.js'

export interface BriefingVars {
  client: string // first name
  title: string
  complex: string
  room: string
  item: number | null
  lawyer: string | null
  note: string | null
}

const T: Record<Lang, (v: BriefingVars) => string> = {
  en: (v) =>
    [
      `Namaste ${v.client}. Today your case ${v.title} is at ${v.complex}, Court ${v.room}, ${v.item != null ? `item ${v.item}` : 'item number not out yet'}.`,
      v.lawyer ? `${v.lawyer} will appear for you.` : '',
      v.note ? `Message from your lawyer: ${v.note}` : '',
      'CourtCall will tell you as the court gets close to your case.',
    ]
      .filter(Boolean)
      .join(' '),
  hi: (v) =>
    [
      `नमस्ते ${v.client}। आज आपका केस ${v.title} ${v.complex}, कोर्ट ${v.room} में है, ${v.item != null ? `आइटम ${v.item}` : 'आइटम नंबर अभी नहीं आया'}।`,
      v.lawyer ? `${v.lawyer} आपकी ओर से पेश होंगे।` : '',
      v.note ? `आपके वकील का संदेश: ${v.note}` : '',
      'कोर्ट आपके केस के करीब आने पर CourtCall आपको बताएगा।',
    ]
      .filter(Boolean)
      .join(' '),
  gu: (v) =>
    [
      `નમસ્તે ${v.client}. આજે તમારો કેસ ${v.title} ${v.complex}, કોર્ટ ${v.room}માં છે, ${v.item != null ? `આઇટમ ${v.item}` : 'આઇટમ નંબર હજુ આવ્યો નથી'}.`,
      v.lawyer ? `${v.lawyer} તમારા તરફથી હાજર રહેશે.` : '',
      v.note ? `તમારા વકીલનો સંદેશ: ${v.note}` : '',
      'કોર્ટ તમારા કેસની નજીક આવશે ત્યારે CourtCall તમને જણાવશે.',
    ]
      .filter(Boolean)
      .join(' '),
}

export const briefingText = (lang: Lang, v: BriefingVars) => T[lang](v)

const asLang = (l: string): Lang => (l === 'hi' || l === 'gu' ? l : 'en')

/**
 * Sends today's briefing for the given cases (all of today's active cases when `caseIds` is omitted).
 * Returns what happened per case. Already-sent cases are skipped.
 */
export async function sendBriefings(caseIds?: string[]) {
  const today = courtDate()
  const rows = await db
    .select({
      caseId: schema.cases.id,
      title: schema.cases.title,
      itemNo: schema.cases.itemNo,
      courtroomId: schema.cases.courtroomId,
      rememberNote: schema.cases.rememberNote,
      appearingLawyerId: schema.cases.appearingLawyerId,
      mainLawyerId: schema.cases.mainLawyerId,
      clientId: schema.clients.id,
      clientName: schema.clients.name,
      language: schema.clients.language,
      complex: schema.courtrooms.courtComplex,
      room: schema.courtrooms.roomNo,
    })
    .from(schema.cases)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.cases.clientId))
    .innerJoin(schema.courtrooms, eq(schema.courtrooms.id, schema.cases.courtroomId))
    .where(
      and(
        eq(schema.cases.hearingDate, today),
        eq(schema.cases.status, 'active'),
        caseIds ? inArray(schema.cases.id, caseIds) : undefined,
      ),
    )
  if (!rows.length) return []

  // Lawyer names (appearing lawyer, else the main lawyer if they are a senior).
  const lawyerIds = [...new Set(rows.flatMap((r) => [r.appearingLawyerId, r.mainLawyerId]).filter((x): x is string => !!x))]
  const lawyers = lawyerIds.length
    ? await db.select({ id: schema.users.id, name: schema.users.name, role: schema.users.role }).from(schema.users).where(inArray(schema.users.id, lawyerIds))
    : []
  const appearing = (r: (typeof rows)[number]) =>
    lawyers.find((l) => l.id === r.appearingLawyerId)?.name ?? lawyers.find((l) => l.id === r.mainLawyerId && l.role === 'lawyer')?.name ?? null

  // Today's courtroom sessions (one per courtroom per day; created if nobody has reported yet).
  const roomIds = [...new Set(rows.map((r) => r.courtroomId))]
  await db.insert(schema.courtSessions).values(roomIds.map((courtroomId) => ({ courtroomId, date: today }))).onConflictDoNothing()
  const sessions = await db
    .select({ id: schema.courtSessions.id, courtroomId: schema.courtSessions.courtroomId })
    .from(schema.courtSessions)
    .where(and(inArray(schema.courtSessions.courtroomId, roomIds), eq(schema.courtSessions.date, today)))

  const results: { caseId: string; status: 'sent' | 'already_sent' }[] = []
  for (const r of rows) {
    const lang = asLang(r.language)
    const note = r.rememberNote ? (await translateNote(r.rememberNote, lang)).text : null
    const text = briefingText(lang, {
      client: r.clientName.split(' ')[0],
      title: r.title,
      complex: r.complex,
      room: r.room,
      item: r.itemNo,
      lawyer: appearing(r),
      note,
    })
    const sessionId = sessions.find((s) => s.courtroomId === r.courtroomId)!.id
    // Record first: the unique (case, session, key) index makes this once per case per day.
    const [logged] = await db
      .insert(schema.alertLogs)
      .values({ caseId: r.caseId, sessionId, eventVersion: 0, alertKey: 'briefing', message: text })
      .onConflictDoNothing()
      .returning({ id: schema.alertLogs.id })
    if (!logged) {
      results.push({ caseId: r.caseId, status: 'already_sent' })
      continue
    }
    // The Remember note was for this hearing: clear it so it isn't repeated next time.
    if (r.rememberNote) await db.update(schema.cases).set({ rememberNote: null }).where(eq(schema.cases.id, r.caseId))

    const ncId = ncClientId(r.clientId)
    await safely('briefing', async () => {
      await ensureNexconnUser(ncId, r.clientName)
      await sendBotDirectMessage([ncId], MSG_BRIEFING, { text, caseId: r.caseId, lang }, text)
    })
    const links = await db
      .select({ id: schema.accessLinks.id })
      .from(schema.accessLinks)
      .where(and(eq(schema.accessLinks.caseId, r.caseId), isNull(schema.accessLinks.revokedAt)))
    await pushToLinks(
      links.map((l) => l.id),
      { title: 'CourtCall is calling', body: text, url: `/case?case=${r.caseId}&briefing=1`, tag: `briefing-${r.caseId}` },
    ).catch((e) => console.warn('[push]', e instanceof Error ? e.message : e))
    results.push({ caseId: r.caseId, status: 'sent' })
  }
  return results
}

/** Today's briefing for a case, if sent: text + time (for the client page and the case page). */
export async function todaysBriefing(caseId: string) {
  const [row] = await db
    .select({ text: schema.alertLogs.message, at: schema.alertLogs.createdAt })
    .from(schema.alertLogs)
    .innerJoin(schema.courtSessions, eq(schema.courtSessions.id, schema.alertLogs.sessionId))
    .where(and(eq(schema.alertLogs.caseId, caseId), eq(schema.alertLogs.alertKey, 'briefing'), eq(schema.courtSessions.date, courtDate())))
  return row ?? null
}
