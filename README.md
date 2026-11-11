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

All demo users, their data and a step-by-step walkthrough are in **[Part 3: Demo guide](#part-3-demo-guide)**.

If you want your own admin account as well:

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

## Part 3: Demo guide

### How to sign in as a demo user

- **One tap (easiest):** open http://localhost:5173/login and tap a card under **Try a demo account**. No password is needed. This panel appears when `DEMO_LOGIN=true` is set in `server/.env` (the default). Set it to `false` to hide the panel, for example in a real deployment.
- **Email and password:** every demo account shares one password. `npm --prefix server run seed:demo` generates it and writes it to `server/.demo-credentials.txt`. That file is git-ignored, so the password is never in the repository.
- **Two people at once:** sign-in uses a browser cookie, so one browser window = one user. To watch two users interact, open a second window in **private / incognito mode** (or a different browser) and sign in as another demo user there.

### Demo users

| Demo button | Email | Role | Office | Invite code |
|---|---|---|---|---|
| Senior lawyer | `mehta@courtcall.demo` | Senior lawyer (office owner) | Mehta & Associates | `MEHTA4` |
| Junior lawyer | `priya@courtcall.demo` | Junior lawyer | Mehta & Associates | n/a |
| Senior lawyer (2nd office) | `desai@courtcall.demo` | Senior lawyer (office owner) | Desai Law Chambers | `DESAI7` |
| Junior lawyer (2nd office) | `arjun@courtcall.demo` | Junior lawyer | Desai Law Chambers | n/a |
| CourtCall team | `admin@courtcall.demo` | CourtCall staff (not a firm role) | none | n/a |

All demo accounts are already verified, so they can use every feature straight away.

### Demo data (created by `seed:demo`)

Everything is in **Gujarat High Court**, dated **today** (India time):

| Office | Client | Case | Court | Item | Assigned junior |
|---|---|---|---|---|---|
| Mehta & Associates | Ramesh Patel | Patel vs State of Gujarat (`CR.MA/1452/2026`) | 4 | 15 | Priya Shah |
| Mehta & Associates | Sunita Joshi | Joshi vs Joshi (`FA/388/2025`) | 4 | 22 | Priya Shah |
| Mehta & Associates | Ramesh Patel | Patel Textiles vs GSFC (`SCA/9021/2026`) | 7 | 9 | none |
| Desai Law Chambers | Kiran Desai | Desai vs Municipal Corporation (`SCA/7710/2026`) | 4 | 18 | none |

**Court 4 is shared by both offices.** Both offices see the same live progress there, but each office sees only its own clients and cases.

Re-running `seed:demo` moves these cases to today's date and keeps the same password (it only creates `server/.demo-credentials.txt` if the file is missing). Courtroom progress already reported today is kept. A new day starts with fresh courtroom rooms.

### What each demo user can do

**Senior lawyer: Adv. Rakesh Mehta (Mehta & Associates)**
- **Today:** live cards for Court 4 and Court 7 showing the latest reported item, status (hearing, break, stale) and how far each of the office's cases is ("3 away").
- **Cases:** add, edit or delete cases (client, court, date, item number, assigned junior).
- **Clients:** add, edit or delete clients (name, WhatsApp number, alert language).
- **Team:** see the invite code `MEHTA4`, and approve or decline juniors who sign up with it.
- **Chat:** the private office team room, plus a private chat with each client.
- **Courtroom rooms:** open any room to see progress, history and room chat. Lawyers can report too.

**Junior lawyer: Priya Shah (Mehta & Associates)**
- **Today:** the courtrooms where the office has cases (Court 4 and Court 7).
- **Report progress** in a room:
  - Tap **Now hearing: Item N**. It is pre-filled with the next item; use **−1 / +1** or type a number.
  - Tap **Passed over**, **Adjourned** (applies to the item being heard), **Recalled** (pick from passed-over items), **Break / Resume**, **Not sitting** or **Court risen**.
  - **Undo** stays on screen for 10 seconds after every report.
  - Jumping more than 5 items ahead, or moving backward, asks for confirmation.
- **Room chat:** message every verified lawyer and junior in the courtroom, from any office. Every accepted update also appears there as a progress card, sent through Nexconn.
- **Chat:** the office team room.

**Senior lawyer (2nd office): Adv. Nisha Desai (Desai Law Chambers)**
- The same screens as Mehta, for her own office.
- In **Court 4** she sees the same live progress as Mehta & Associates, but only her own case (Kiran Desai, Item 18). Mehta's clients are never visible to her.

**Junior lawyer (2nd office): Arjun Trivedi (Desai Law Chambers)**
- Reports in the same **Court 4** room as Priya. Updates from either junior are shared with both offices.

**CourtCall team: CourtCall Admin**
- This is **not** a law-firm admin. It is the CourtCall platform team, the gatekeeper that keeps fake lawyers out of shared courtrooms.
- **CourtCall verification page:** when a senior lawyer signs up, they wait here until the team checks their Bar Council enrolment number and taps **Verify** or **Reject**. Tabs show pending, verified and rejected lawyers.
- Juniors are never approved here: their own firm approves them on its **Team** page.

**Client (coming next)**
- The client's private WhatsApp link page (case progress, alerts, chat with the lawyer) is the next module. A client demo button will be added with it.

### Guided tour (first login)

The first time someone signs in, CourtCall starts a guided tour. It dims the page, zooms a spotlight onto one feature at a time, and explains what that feature does and how it works. The tour moves between pages by itself (for juniors, it opens a courtroom and walks through the reporting buttons).

- **Next / Back** (or the arrow keys) move between steps. **End tour** (or Esc) stops it at any point.
- Each role gets its own tour: senior lawyer (10 steps), junior lawyer (13), CourtCall team (5).
- **Real accounts** see it once; it's saved on the server, so it won't repeat on another device. **Demo accounts** remember it per browser, so every person trying a demo account gets the tour.
- To see it again: **Settings → Take the tour again**.
- To replay it on a demo account from scratch, clear the site's local storage, or open a private window.

### Suggested walkthrough (about 5 minutes, good for the demo video)

1. **Landing page:** open http://localhost:5173. In the hero, tap **Now hearing**, **Passed over** and **Break** to drive the dashboard and the client's phone (auto-play resumes after 12 seconds). Tap people in **Your whole firm, connected** to see their links. Try the live demo, including **Simulate a delayed old update**.
2. **Window 1, Junior Priya:** tap **Junior lawyer** → **Today** → **Court 4** → **Open room**.
   - Set the item to **12** and tap **Now hearing: Item 12**. Then tap **Now hearing: Item 13**.
   - Tap **Passed over** (marks Item 13), then **Now hearing: Item 14**, then **Recalled** and choose **13**.
   - Type **25** and tap **Now hearing** to see the **jump confirmation**. Cancel it.
   - Tap **Break**, then **Resume**. Use **Undo** on any toast.
   - Send a message in **Room chat**.
3. **Window 2 (private window), Junior Arjun:** tap **Junior lawyer (2nd office)** → **Court 4**. The same progress and the same room chat appear, but **Your cases here** shows only Item 18 (Kiran Desai).
   - Report **Now hearing** from Arjun's window. Priya's window updates within seconds.
   - **Conflict protection:** report from one window, then immediately report from the other without waiting. The older update is rejected with "Someone else just reported a newer update".
4. **Senior lawyer Mehta** (sign out first, or use a third window): **Today** now shows Court 4's live item and "N away" for Ramesh (15) and Sunita (22). Open **Chat** for the office team room and the client list.
5. **Senior lawyer Desai:** **Today** shows Court 4 with only Kiran Desai's case. This demonstrates private office data inside a shared courtroom.
6. **Sign-up and approvals:** sign out, choose **Create an account → Junior lawyer**, and use invite code **MEHTA4**. The new junior waits for approval. Sign in as **Mehta** → **Team** → **Approve**.
7. **CourtCall team:** sign up a new **Senior lawyer** account, then sign in as **CourtCall team** and approve it on the verification page.

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
