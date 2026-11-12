# CourtCall

**Real-time courtroom communication for lawyers, junior lawyers and their clients.**

Juniors report courtroom progress ("Item 12 is being heard") with one tap. CourtCall checks every update for conflicts, shares it with everyone in the same courtroom across offices, and alerts each client about their own case through a private link. Clients don't need to install an app.

> eCourts tells you which day. CourtCall tells you the latest reported courtroom progress.

**Live:** https://courtcall-kappa.vercel.app · **How to install and use it:** [GUIDE.md](GUIDE.md). It installs as an app on Android and iPhone.

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
| Firm admin (senior lawyer) | `mehta@courtcall.demo` | Senior lawyer, **firm admin**, founder | Mehta & Associates | `MEHTA4` |
| Senior lawyer | `anil@courtcall.demo` | Senior lawyer | Mehta & Associates | n/a |
| Junior lawyer | `priya@courtcall.demo` | Junior lawyer | Mehta & Associates | n/a |
| Office staff | `neha@courtcall.demo` | Office staff (clerk) | Mehta & Associates | n/a |
| Senior lawyer (2nd office) | `desai@courtcall.demo` | Senior lawyer, firm admin, founder | Desai Law Chambers | `DESAI7` |
| Junior lawyer (2nd office) | `arjun@courtcall.demo` | Junior lawyer | Desai Law Chambers | n/a |
| Client | no account (private link) | Client of Mehta & Associates: Ramesh Patel | Mehta & Associates | n/a |

All demo accounts are already verified, so they can use every feature straight away. Re-running `seed:demo` also resets their roles, in case you changed them on the Team page.

### Roles in a firm

| Role | Who | Can do | Approved by |
|---|---|---|---|
| **Firm admin** | A senior lawyer with admin rights (juniors and office staff can never be firm admins). The founder is always one. | Everything their role can do, plus the **Team** page: approve or decline new people, change roles (senior lawyer / junior / staff), make or remove other firm admins, deactivate and reactivate people, and make a new invite code | Founder: nobody (starts right away). Others: another firm admin |
| **Senior lawyer** | Advocates of the firm | Clients, cases, courtrooms (join and report), team room, private client chat | Founder: nobody. Joining lawyers: a firm admin |
| **Junior lawyer** | Juniors who go to court | Join courtrooms, report progress, room chat, team room | A firm admin |
| **Office staff** | Clerks and office employees | Clients, cases, team room, private client chat; watch today's courtrooms **read-only** (they never report) | A firm admin |

**How people join a firm:** they choose **Create an account → Join a firm**, pick their role, and enter the firm's invite code. They wait on an "awaiting approval" screen until a firm admin approves them on the **Team** page. All data (clients, cases, chats) is shared across the whole firm and never with other firms.

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

**Firm admin: Adv. Rakesh Mehta (Mehta & Associates)**
- Everything a senior lawyer can do (below), plus he runs the firm on the **Team** page:
  - **Invite code** `MEHTA4` with copy and **Make a new code**.
  - **Your firm** at a glance: how many senior lawyers, juniors and staff.
  - **Waiting for your approval:** approve or decline people who joined with the code.
  - **People:** change anyone's role, **Make admin / Remove admin**, **Deactivate** (with confirmation). Deactivated people can be reactivated.
  - The founder can't be deactivated or demoted, and nobody can edit their own account.

**Senior lawyer: Adv. Anil Shah (Mehta & Associates)**
- A second senior lawyer at the same firm, without admin rights. He sees the same firm clients, cases and courtrooms as Mehta. His **Team** page is read-only and lists the firm admins to contact.

**Office staff: Neha Parikh (Mehta & Associates)**
- **Today:** the firm's courtrooms with live progress, **read-only** (no Join courtroom, no reporting).
- **Cases** and **Clients:** add, edit and delete, like a senior lawyer.
- **Chat:** the office team room and private chats with clients.
- **Team:** read-only.

**What every senior lawyer can do (Mehta and Anil)**
- **Today:** live cards for Court 4 and Court 7 showing the latest reported item, status (hearing, break, stale) and how far each of the office's cases is ("3 away").
- **Cases:** add, edit or delete cases (client, court, date, item number, assigned junior).
- **Clients:** add, edit or delete clients (name, WhatsApp number, alert language).
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

**Client: Ramesh Patel (no account)**
- Clients never sign in. The firm shares a private link on WhatsApp; the **Client** demo button opens Ramesh's seeded link directly.
- His page shows only his own case: **Now** vs **Your item**, how many cases are before his, court status and how fresh the report is, and the latest updates. It refreshes by itself every 10 seconds. It never shows who reported or other firms' cases, and never predicts times.
- **Chat with Mehta & Associates** (Nexconn direct chat). The person who shared the link is the default contact; he can switch to the firm's other lawyers and staff. Messages appear on the firm's **Chat** page.

### Client alerts (automatic)

After every accepted courtroom update, CourtCall checks every case in that courtroom today, in every firm, and alerts the clients it concerns:

| When | Alert |
|---|---|
| First update while the case is still far away | "Court 4 has started. Now: Item 3. Your case is Item 15 (12 away)." |
| 10, 5 and 2 cases away | "Court 4 is at Item 10. Your case is Item 15 (5 away). Get ready." |
| Their case is called | "Your case (Item 15) is being heard now in Court 4." |
| Their case is passed over, recalled or adjourned | A message for that exact event |
| Break (while still waiting), court not sitting, court risen | Court-wide news |
| The court moved past their item without calling it | "Court 4 has moved past your item…" |

- Each alert is sent **once** (deduplicated per case per day), and at most one per update, so clients are never flooded. A big jump sends only the nearest alert. Undo never alerts. No alert ever predicts a time.
- Delivered three ways: an instant banner on the client's page (Nexconn message from the CourtCall bot), a **phone notification** if the client tapped **Turn on** under "Get alerts on this phone" (Web Push; Android Chrome and desktop, iPhone only after Add to Home Screen), and the "Latest updates" list on their page.
- To see it: open the **Client** demo in one window and turn alerts on, then as **Junior lawyer** report **Now hearing** in Court 4 until Item 5, 10, 13 and 15.

### Client links (how the firm shares a case)

- On **Cases**, tap the link icon on a case. **Create client link** makes a private link with live progress and chat.
- **Share on WhatsApp** opens WhatsApp with a ready message to the client's number (+91 is added to 10-digit numbers). **Copy link** works for any other app. The full link is shown only once.
- The link **locks to the first phone that opens it**. The same phone can always reopen it; any other phone sees "This link is already in use on another phone". Don't open a client's link yourself.
- **Turn off** stops a link at once. **New link** turns the old one off and makes a fresh one (lost or new phone).
- The list shows each link's status: not opened yet, on a phone, or turned off.
- To try the real flow: create a link as Mehta, then open it in a private window. Open it again in a second private window to see the one-phone rule.

### Guided tour (first login)

The first time someone signs in, CourtCall starts a guided tour. It dims the page, zooms a spotlight onto one feature at a time, and explains what that feature does and how it works. The tour moves between pages by itself (for juniors, it opens a courtroom and walks through the reporting buttons).

- **Next / Back** (or the arrow keys) move between steps. **End tour** (or Esc) stops it at any point.
- Each role gets its own tour: senior lawyer (17 steps, 18 for firm admins), junior lawyer (14), office staff (15, 16 for firm admins), client (9 steps, in English, Hindi or Gujarati). Staff tours cover hearings to update, case and client pages, and the Calendar.
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
6. **Joining a firm:** sign out, choose **Create an account → Join a firm**, pick **Office staff** (or junior / senior lawyer) and use invite code **MEHTA4**. The new person waits for approval. Sign in as **Firm admin (Mehta)** → **Team** → **Approve**, then try changing their role or making them a firm admin.
   - Sign in as **Office staff (Neha)** to see the read-only courtrooms and the cases and clients she manages.
7. **Client:** tap the **Client** demo button. Ramesh's page shows Court 4's progress against his Item 15. Tap **Turn on** under "Get alerts on this phone". Report from Priya's window (Court 4, Now hearing 5, then 10, 13, 15) and watch the alert banner, the phone notification and his page update. Send Mehta a message from the client chat, then open **Chat → Ramesh Patel** as Mehta to reply.
8. **Case teams and updates:** sign in as **Senior lawyer (Anil)**: he leads Ramesh's cases, so he sees only Ramesh. **Junior (Priya)** sees only the two cases she helps on and can't change them. **Office staff (Neha)** helps on Ramesh's and Sunita's cases (read-only). As **Firm admin (Mehta)**, open a case → **Case team → Edit team** and make Anil the main lawyer: Anil gets a number on **Cases** and an item under **Updates** on Today.
9. **Languages and voice:** on the client page tap **हिं** or **ગુ**; the page, tour and his future alerts switch language. In any chat, tap the **mic** and speak.

---

## Part 4: Deploy online for free (Vercel)

The repo is ready for **Vercel's free Hobby plan**: one project serves the website (from Vercel's CDN) and the API (a serverless function in **Tokyo**, next to the Supabase database). It never sleeps and needs no card. Settings live in `vercel.json` and `api/index.js`.

### First deploy (about 10 minutes)

1. Go to https://vercel.com and choose **Sign up → Continue with GitHub** (Hobby plan).
2. **Add New → Project**, then **Import** the `CourtCall` repository.
3. Leave **Framework Preset: Other** and **Root Directory** as the repo root. The build and install commands come from `vercel.json`.
4. Open **Environment Variables** and add each of these, copying values from your `server/.env`:

| Name | Value |
|---|---|
| `DATABASE_URL` | Supabase transaction pooler string (port 6543) |
| `JWT_SECRET` | same long random string |
| `NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET`, `NEXCONN_API_BASE` | Nexconn keys |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push keys |
| `DEMO_LOGIN` | `true` (one-tap demo buttons for judges) |
| `DB_POOL_MAX` | `3` |

5. Click **Deploy**. When it finishes, Vercel shows your address, for example `https://courtcall.vercel.app`.
6. Add one more variable, `CLIENT_ORIGIN` = that address, then **Deployments → ⋯ → Redeploy**.
7. Check it: open `https://<your-address>/api/health`. It should show `"db":"connected","nexconn":"configured"`. Then open the site and tap a demo account.

After that, **every push to `main` deploys automatically**.

### Keeping it running

- The live site uses the same Supabase database as your computer, so running `npm --prefix server run seed:demo` locally also refreshes the live demo data. Do this each morning before showing it, so the cases are dated today.
- Database migrations are not run by Vercel. After adding one, run `npm --prefix server run db:migrate` from your computer before (or right after) pushing.
- Phone alerts need HTTPS, which Vercel provides. Client links shared from the live site use the live address automatically.
- Logs: Vercel project → **Logs** (filter by `/api`).

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
