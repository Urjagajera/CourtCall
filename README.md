# CourtCall

**Real-time courtroom communication for lawyers, junior lawyers and their clients.**

Juniors report courtroom progress ("Item 12 is being heard") with one tap. CourtCall checks every update for conflicts, shares it with everyone in the same courtroom across offices, and alerts each client about their own case through a private link. Clients don't need to install an app.

> eCourts tells you which day. CourtCall tells you the latest reported courtroom progress.

Built for the **Nexconn Build Challenge 2026**. All real-time messaging runs on the Nexconn Chat SDK.

---

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React + Vite + TypeScript, Tailwind CSS v4, React Router |
| Backend | Node.js + Express + TypeScript, Zod, JWT (httpOnly cookie) |
| Database | PostgreSQL on Supabase, Drizzle ORM |
| Real-time chat | Nexconn Chat SDK (web) + Nexconn Server API |
| Notifications | Nexconn messages + Web Push |

```
CourtCall/
├── client/          React app (landing page, lawyer, junior and client screens)
├── server/          Express API, database schema, scripts
│   ├── src/db/      Drizzle schema
│   ├── drizzle/     SQL migrations
│   └── .env         your secrets (never committed)
├── design.md        design system (colors, fonts, components)
└── PLAN.md          product plan and build schedule
```

---

## Part 1: First-time setup (do this once)

### 1. Install the tools

- **Node.js 20.19 or newer** (22 LTS recommended): https://nodejs.org. Check with:

```bash
node -v
```

- **Git**: https://git-scm.com

### 2. Get the code

```bash
git clone https://github.com/Urjagajera/CourtCall.git
```

```bash
cd CourtCall
```

### 3. Install all dependencies

This one command installs the root, `server` and `client` packages:

```bash
npm run setup
```

### 4. Create a free Supabase database

1. Go to https://supabase.com, sign in and click **New project**.
2. Set a database password and save it. For **Region**, choose **Auto**.
3. When the project is ready, open **Connect → Transaction pooler** and copy the connection string. It uses port **6543**.

### 5. Create a free Nexconn app

1. Go to https://console.nexconn.ai and create an app.
2. Under **Key Management**, copy the **App Key** and **App Secret**.

### 6. Create your `server/.env` file

Copy the example file:

```bash
cp server/.env.example server/.env
```

(On Windows Command Prompt, use `copy server\.env.example server\.env` instead.)

Open `server/.env` and fill in:

| Variable | What to put |
|---|---|
| `DATABASE_URL` | The Supabase transaction pooler string from step 4, with your password filled in |
| `JWT_SECRET` | A long random string. Generate one with the command below |
| `NEXCONN_APP_KEY` / `NEXCONN_APP_SECRET` | From step 5 |
| `NEXCONN_API_BASE` | Leave as `https://api.sg-light-api.com` unless your Nexconn app is in another data center |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Generate with the command below |

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Generate Web Push keys (run inside the `server` folder):

```bash
cd server && npx web-push generate-vapid-keys && cd ..
```

> Never commit `server/.env` or share its values. It is already in `.gitignore`.

### 7. Create the database tables

```bash
npm --prefix server run db:migrate
```

Check that it worked. You should see `11 tables: ...`:

```bash
npm --prefix server run db:check
```

### 8. Check the Nexconn keys

You should see `OK: Nexconn reachable ...`:

```bash
npm --prefix server run nexconn:check
```

### 9. Add demo data (recommended)

This creates an admin, two law offices that share Court 4, juniors, clients and today's cases:

```bash
npm --prefix server run seed:demo
```

**Demo login:** with `DEMO_LOGIN=true` in `server/.env` (the default), the sign-in page shows a **Try a demo account** panel. One tap signs you in as any of these, with no password:

| Demo button | Account | What you can try |
|---|---|---|
| Senior lawyer | `mehta@courtcall.demo` | Today dashboard, clients, cases, team approvals, client chat |
| Junior lawyer | `priya@courtcall.demo` | Report live progress in Court 4 and Court 7, room chat |
| Senior lawyer (2nd office) | `desai@courtcall.demo` | Same shared Court 4 room, different private office data |
| Junior lawyer (2nd office) | `arjun@courtcall.demo` | Reports in Court 4 from another office |
| Platform admin | `admin@courtcall.demo` | Verify new lawyers |

The shared password for normal email sign-in is written to `server/.demo-credentials.txt`. That file is git-ignored. Set `DEMO_LOGIN=false` to hide the demo panel.

**Tip:** to see two offices working in the same courtroom, open one browser normally and a second in a private/incognito window, then sign in as two different demo users.

If you want your own admin account instead:

```bash
npm --prefix server run create-admin -- you@example.com YourStrongPassword "Your Name"
```

Setup is done. Continue with Part 2.

---

## Part 2: Running the project (every time)

From the project root:

```bash
npm run dev
```

This starts both apps together:

| App | URL |
|---|---|
| Website (open this) | http://localhost:5173 |
| API | http://localhost:4000 (health check: http://localhost:4000/api/health) |

Open **http://localhost:5173**, click **Sign in**, and tap any **Try a demo account** button. Stop everything with **Ctrl + C**.

Code changes reload automatically: the website hot-reloads and the API restarts on save.

### Each new day of testing

Demo cases are dated "today". To move them to the current date, run:

```bash
npm --prefix server run seed:demo
```

### After you pull new changes from GitHub

If the code changed since your last pull, reinstall dependencies and apply any new database migrations:

```bash
npm run setup
```

```bash
npm --prefix server run db:migrate
```

---

## Useful commands

All commands run from the project root.

| Command | What it does |
|---|---|
| `npm run dev` | Start website and API together |
| `npm run setup` | Install all dependencies |
| `npm run build` | Production build of API and website |
| `npm test` | Run the courtroom update rule tests |
| `npm --prefix server run db:migrate` | Apply database migrations |
| `npm --prefix server run db:check` | List database tables |
| `npm --prefix server run db:ping` | Measure database latency |
| `npm --prefix server run db:studio` | Open a web view of the database tables |
| `npm --prefix server run db:generate` | Create a migration after editing `server/src/db/schema.ts` |
| `npm --prefix server run nexconn:check` | Verify Nexconn keys |
| `npm --prefix server run seed:demo` | Create or refresh demo data |
| `npm --prefix server run create-admin -- <email> <password> [name]` | Create an admin account |

---

## Troubleshooting

**`Missing required env var ...`**
`server/.env` is missing or a value is empty. Repeat step 6.

**`db: disconnected` on `/api/health`, or migrations fail**
Check `DATABASE_URL`. It must be the **Transaction pooler** string (port `6543`) with your real password. If the password has special characters like `@` or `#`, reset it in Supabase to letters and numbers only.

**`Port 4000 is already in use` or `5173 is already in use`**
Another copy is already running. Close the other terminal, or stop the old process.

**The app works but chat shows a red dot / "Chat unavailable"**
Run `npm --prefix server run nexconn:check`. Code `1004` means the App Secret is wrong. A network error usually means `NEXCONN_API_BASE` is wrong.

**`ENOSPC: no space left on device` (Windows)**
Your C: drive is full. npm and the build tools write temporary files there. Free some space, or point temp files to another drive for that terminal (PowerShell):

```bash
$env:TEMP="D:\tmp"; $env:TMP="D:\tmp"
```

**Pages load slowly**
Every database query travels to your Supabase region. Run `npm --prefix server run db:ping`: under about 150 ms is fine for local development.
