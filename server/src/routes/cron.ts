import { Router } from 'express'
import { sendBriefings } from '../lib/briefing.js'
import { HttpError } from '../lib/http.js'

// Scheduled jobs called by Vercel Cron (vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>"
// when the CRON_SECRET environment variable is set; without it these routes refuse to run.
export const cronRouter = Router()

cronRouter.use((req, _res, next) => {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new HttpError(503, 'CRON_SECRET is not set on this server')
  if (req.headers.authorization !== `Bearer ${secret}`) throw new HttpError(401, 'Not allowed')
  next()
})

/** 9:00–10:00 IST every day: hearing-day briefings for every client with a hearing today. */
cronRouter.get('/briefings', async (_req, res) => {
  const results = await sendBriefings()
  res.json({ sent: results.filter((r) => r.status === 'sent').length, alreadySent: results.filter((r) => r.status === 'already_sent').length })
})
