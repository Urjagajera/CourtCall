import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var ${name} (see server/.env.example)`)
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  nexconn: {
    appKey: process.env.NEXCONN_APP_KEY ?? '',
    appSecret: process.env.NEXCONN_APP_SECRET ?? '',
    apiBase: process.env.NEXCONN_API_BASE ?? '',
  },
  webPush: {
    publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
    subject: process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
  },
}

export const nexconnEnabled = Boolean(config.nexconn.appKey && config.nexconn.appSecret && config.nexconn.apiBase)
