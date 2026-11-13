// Web Push: phone notifications for clients ("Turn on alerts" on their case page) and for lawyers/staff (Settings).
import { eq, inArray } from 'drizzle-orm'
import { sendNotification, setVapidDetails } from 'web-push'
import { config } from '../config.js'
import { db, schema } from '../db/index.js'

export const pushEnabled = Boolean(config.webPush.publicKey && config.webPush.privateKey)
if (pushEnabled) setVapidDetails(config.webPush.subject, config.webPush.publicKey, config.webPush.privateKey)

/** Sends to every phone subscribed through these links. Dead subscriptions are removed. */
export async function pushToLinks(linkIds: string[], payload: { title: string; body: string; url: string; tag?: string }) {
  if (!pushEnabled || !linkIds.length) return
  const subs = await db.select().from(schema.pushSubscriptions).where(inArray(schema.pushSubscriptions.accessLinkId, linkIds))
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 3600, urgency: 'high' })
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, s.id))
        else console.warn('[push]', status ?? (e instanceof Error ? e.message : e))
      }
    }),
  )
}

/** Sends to every browser/phone where these staff users turned on alerts (Settings). Dead subscriptions are removed. */
export async function pushToUsers(userIds: string[], payload: { title: string; body: string; url: string; tag?: string }) {
  if (!pushEnabled || !userIds.length) return
  const subs = await db.select().from(schema.pushSubscriptions).where(inArray(schema.pushSubscriptions.userId, userIds))
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 3600, urgency: 'high' })
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, s.id))
        else console.warn('[push]', status ?? (e instanceof Error ? e.message : e))
      }
    }),
  )
}
