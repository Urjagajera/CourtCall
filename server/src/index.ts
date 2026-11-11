import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { config, nexconnEnabled } from './config.js'
import { sql } from './db/index.js'
import { errorHandler } from './lib/http.js'
import { adminRouter } from './routes/admin.js'
import { authRouter } from './routes/auth.js'
import { casesRouter } from './routes/cases.js'
import { clientsRouter } from './routes/clients.js'
import { courtroomsRouter } from './routes/courtrooms.js'
import { officeRouter } from './routes/office.js'

export const app = express()

app.use(cors({ origin: config.clientOrigin, credentials: true }))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.get('/api/health', async (_req, res) => {
  let db = 'connected'
  try {
    await sql`select 1`
  } catch {
    db = 'disconnected'
  }
  res.json({ ok: true, db, nexconn: nexconnEnabled ? 'configured' : 'not configured' })
})

app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/office', officeRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/cases', casesRouter)
app.use('/api', courtroomsRouter)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})
app.use(errorHandler)

// Local dev / long-running host. On Vercel the app is imported as a serverless handler instead.
if (!process.env.VERCEL) {
  app.listen(config.port, () => console.log(`CourtCall API on http://localhost:${config.port}`))
}
