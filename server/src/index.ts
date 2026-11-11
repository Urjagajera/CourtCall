import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { config, nexconnEnabled } from './config.js'

const app = express()

app.use(cors({ origin: config.clientOrigin, credentials: true }))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    nexconn: nexconnEnabled ? 'configured' : 'not configured',
  })
})

async function start() {
  await mongoose.connect(config.mongoUri)
  console.log('MongoDB connected')
  app.listen(config.port, () => console.log(`CourtCall API on http://localhost:${config.port}`))
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
