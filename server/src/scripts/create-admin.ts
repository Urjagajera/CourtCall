// Usage: npm run create-admin -- <email> <password> [name]
import { db, schema, sql } from '../db/index.js'
import { hashPassword } from '../lib/auth.js'

const [email, password, name = 'CourtCall Admin'] = process.argv.slice(2)
if (!email || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -- <email> <password(min 8 chars)> [name]')
  process.exit(1)
}

await db
  .insert(schema.users)
  .values({
    role: 'admin',
    name,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    verificationStatus: 'verified',
  })
  .onConflictDoNothing({ target: schema.users.email })

console.log(`Admin ready: ${email}`)
await sql.end()
