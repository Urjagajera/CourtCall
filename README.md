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

> **Joining the team (Kushi)?** Follow **[step.md](step.md)** instead: it sets you up with your own database and Nexconn app so the live site is never affected, and explains how to push safely.

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

Check that it worked. It prints how many tables there are and their names:

```bash
npm --prefix server run db:check
```

### 8. Check the Nexconn keys

You should see `OK: Nexconn reachable ...`:

```bash
npm --prefix server run nexconn:check
```

### 9. Add demo data (recommended)

This creates two law offices that share Court 4, their lawyers, juniors and staff, clients and today's cases:

```bash
npm --prefix server run seed:demo
```

All demo users, their data and a step-by-step walkthrough are in **[Part 3: Demo guide](#part-3-demo-guide)**.

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
| **Firm admin** | A senior lawyer with admin rights (juniors and office staff can never be firm admins). The founder is always one. | Everything their role can do, plus the **Team** page: approve or decline new people, change roles (senior lawyer / junior / staff), make or remove other firm admins, deactivate and reactivate people, make a new invite code, and change **Firm settings** (when a courtroom counts as stale, WhatsApp country code) | Founder: nobody (starts right away). Others: another firm admin |
| **Senior lawyer** | Advocates of the firm | Adds clients and cases (and becomes the case's main lawyer); on cases they lead: edits details, records hearing outcomes, sets the briefing, picks the helping junior and staff helper; courtrooms (join and report), chats, calls | Founder: nobody. Joining lawyers: a firm admin |
| **Junior lawyer** | Juniors who go to court | Sees only the cases they are on; as main lawyer records outcomes and edits the case; join courtrooms, report progress, room chat, chats, calls; never assigns anyone | A firm admin |
| **Office staff** | Clerks and office employees | Staff helper on cases: sees those cases, clients and chats **read-only**; watches today's courtrooms **read-only** (never reports); can't add or edit cases or clients | A firm admin |

**How people join a firm:** they choose **Create an account → Join a firm**, pick their role, and enter the firm's invite code. They wait on an "awaiting approval" screen until a firm admin approves them on the **Team** page.

**Case teams decide who sees what.** Every case has a **main lawyer** (senior or junior), an optional **helping junior** (only when a senior leads) and at most one **staff helper**. You see a case, its client, the client's link and chat only if you are on that case; firm admins see everything. Firm data is never shared with other firms: courtroom progress is the only thing shared.

### Demo data (created by `seed:demo`)

Everything is in **Gujarat High Court**, dated **today** (India time):

| Office | Client | Case | Court | Item | Main lawyer | Helping junior | Staff helper |
|---|---|---|---|---|---|---|---|
| Mehta & Associates | Ramesh Patel | Patel vs State of Gujarat (`CR.MA/1452/2026`) | 4 | 15 | Anil | Priya | Neha |
| Mehta & Associates | Sunita Joshi | Joshi vs Joshi (`FA/388/2025`) | 4 | 22 | Mehta | Priya | Neha |
| Mehta & Associates | Ramesh Patel | Patel Textiles vs GSFC (`SCA/9021/2026`) | 7 | 9 | Anil | none | Neha |
| Desai Law Chambers | Kiran Desai | Desai vs Municipal Corporation (`SCA/7710/2026`) | 4 | 18 | Desai | Arjun | none |

**Court 4 is shared by both offices.** Both offices see the same live progress there, but each office sees only its own clients and cases.

Past history, so the case, client and Calendar pages aren't empty:
- **Patel vs State of Gujarat** was last heard a week ago (Court 4, Item 11): adjourned to today, with a summary shared with the client and firm-only prep notes. Ramesh's **History** shows that day's alerts.
- **Patel vs Shah (property)** (City Civil Court 12, three weeks ago): **case ended**, decree in Ramesh's favour.
- **Joshi vs Joshi (maintenance)** (Court 7, two days ago) has **no outcome yet**, so Mehta and Neha see it under **Hearings to update**.
- Today's **briefing** for Ramesh's main case is **not sent**, so you can send it live with **Send briefing now**.

Re-running `seed:demo` moves these cases to today's date and keeps the same password (it only creates `server/.demo-credentials.txt` if the file is missing). Courtroom progress already reported today is kept. A new day starts with fresh courtroom rooms.

### What each demo user can do

**Firm admin: Adv. Rakesh Mehta (Mehta & Associates)**
- Sees **every** case and client of the firm, and can do everything on them: add and edit cases and clients, set any case team (**Case team → Edit team**: main lawyer, helping junior, staff helper), record hearing outcomes, set and send briefings.
- Runs the firm on the **Team** page:
  - **Invite code** `MEHTA4` with copy and **Make a new code**.
  - **Firm settings:** minutes without an update before a courtroom shows as stale for this firm (default 20), and the WhatsApp country code added to 10-digit client numbers (default 91).
  - **This week in CourtCall:** courtroom updates, client alerts, firm alerts, briefings, calls (with minutes), voice notes, hearings recorded and clients with their link open, for the last 7 days and in total. Calls and voice notes run on Nexconn, so the app reports each one.
  - **Waiting for your approval:** approve or decline people who joined with the code.
  - **People:** change anyone's role, **Make admin / Remove admin** (senior lawyers only), **Deactivate** and reactivate.
  - The founder can't be deactivated or demoted, and nobody can edit their own account.

**Senior lawyer: Adv. Anil Shah (Mehta & Associates)**
- Main lawyer on both of Ramesh Patel's cases, so he sees **only Ramesh** (not Sunita). On his cases he edits details, picks the helping junior and staff helper (not the main lawyer), records outcomes and sends the briefing. He can add new clients and cases (he becomes their main lawyer). His **Team** page is read-only.

**Junior lawyer: Priya Shah (Mehta & Associates)**
- Helping junior on Ramesh's and Sunita's Court 4 cases: sees only those two, read-only, and never assigns anyone.
- **Report progress** in a courtroom room:
  - **Now hearing: Item N** (pre-filled with the next item; **−1 / +1** or type a number).
  - **Passed over**, **Adjourned**, **Recalled** (pick from passed-over items), **Break / Resume**, **Not sitting**, **Court risen**.
  - **Undo** stays for 10 seconds. Jumping more than 5 items ahead, or moving backward, asks for confirmation.
- **Room chat** with every lawyer and junior in the courtroom, from any firm. Every accepted update also appears there as a progress card, sent through Nexconn. **Voice notes** (tap the sound-wave button when the box is empty) for when typing in court isn't possible.

**Office staff: Neha Parikh (Mehta & Associates)**
- Staff helper on Ramesh's and Sunita's cases: sees those cases and clients **read-only**, chats with those clients, and watches today's courtrooms **read-only** (never reports). Can't add or edit cases or clients.

**Every staff screen**
- **Today:** live cards per courtroom (latest item, status: hearing, break, stale) and how far each of your cases is ("3 away"); **Updates** (what changed on your cases) and **Hearings to update**.
- **Cases** and **case page** (`/cases/:id`): details, case team, **Hearing-day briefing** card, hearings history with outcomes, client link, **Call client**.
- **Clients** and **client page**: their cases, hearings, chat.
- **Calendar:** your hearings by day, past and upcoming.
- **Chat:** the firm team room and one-to-one chats, with filters **Lawyers** (seniors first), **Staff**, **Clients**; **Call** button in every one-to-one chat; **mic** for voice typing; with an empty message box the send button records a **voice note** (up to 1 minute).
- **Badges:** a number on **Cases** for new updates and on **Chat** for unread messages.
- **Settings:** theme, **Phone alerts**, take the tour again.

**Senior lawyer (2nd office): Adv. Nisha Desai (Desai Law Chambers)**
- The same screens as Mehta, for her own firm. In **Court 4** she sees the same live progress as Mehta & Associates, but only her own case (Kiran Desai, Item 18).

**Junior lawyer (2nd office): Arjun Trivedi (Desai Law Chambers)**
- Reports in the same **Court 4** room as Priya. Updates from either junior are shared with both firms.

**Client: Ramesh Patel (no account)**
- Clients never sign in. The firm shares a private link on WhatsApp; the **Client** demo button opens Ramesh's seeded link directly.
- Tabs (sidebar on a laptop, bottom bar on a phone): **My case**, **Cases**, **History**, **Chat**, **Settings**.
- **My case:** **Now** vs **Your item**, how many cases are before his, court status and how fresh the report is, the next date, today's briefing, latest updates. It never shows who reported or other firms' cases, and never predicts times.
- **History:** past alerts and hearing summaries the firm chose to share (never prep notes); "case ended" for finished cases.
- **Chat** with the people on his case (Nexconn direct chat), **Call my lawyer**, voice typing and voice notes.
- **Settings:** language **English / हिंदी / ગુજરાતી** (page, tour and alerts), phone alerts, theme, tour, sign out.

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

### Firm alerts (automatic)

The same courtroom updates also alert **the firm**: the people on the case (main lawyer, helping junior, staff helper) and the firm admins. The person who reported the update is skipped (they are in the courtroom), except for "over".

| When | Alert |
|---|---|
| Their client's case is 2 away | "Ramesh Patel's case is close: Court 4 is at Item 13, theirs is Item 15 (2 away)." |
| It is being heard (or recalled) | "Ramesh Patel's case (Item 15) is being heard now in Court 4." |
| The hearing is over: court moved past it, adjourned, risen or not sitting | "The hearing of Ramesh Patel's case (Item 15) in Court 4 is over… Record what happened and the next date." |

- Each is sent **once** per case per day. A passed-over case isn't reported as over when the court moves past it (it may be recalled).
- Delivered as a **pop-up inside CourtCall** on any page (Nexconn message `CC:StaffAlert` from the CourtCall bot) and as a **phone notification** for people who tapped **Settings → Phone alerts → Turn on**. Tapping the "over" alert opens the case with the **Update hearing** form already open (for the main lawyer and firm admins).
- To see it: sign in as **Office staff (Neha)** or **Firm admin (Mehta)** in one window (Settings → Phone alerts → Turn on), and as **Junior lawyer (Priya)** in another. Report **Now hearing** in Court 4 for Item 13, 15, then 16.

### Hearing-day briefing and calls (Nexconn Call SDK)

- **Briefing:** on a hearing day, each client gets a short spoken briefing: the court, the item number (or "not out yet"), which lawyer will appear, and a note from the firm ("Remember to bring…"). It never gives a time.
  - Set it on the case page, in the **Hearing-day briefing** card (or in the outcome form for the next hearing): **Appearing lawyer** (a senior lawyer of the firm) and **Remember** note. A note typed in English is translated to Hindi or Gujarati for the client (free MyMemory service); if translation fails, the note is sent as typed.
  - Sent automatically every morning (Vercel Cron, 9–10 am India time), or right away with **Send briefing now** (main lawyer or firm admin, hearing day only, once per day).
  - The client sees a full-screen **"CourtCall is calling"** screen. **Answer** reads the briefing aloud in their language with the phone's own voice; **Listen again**, **Call my lawyer**. It also stays on **My case** as "Today's briefing" and in **History**.
- **Calls:** voice calls inside CourtCall over the **Nexconn Call SDK**: **Call** in every one-to-one chat, **Call client** on the case page, **Call my lawyer** for clients (the appearing lawyer first, else the main lawyer). The other person's phone rings in CourtCall on any page; a call-log line is added to the chat.
  - Calls need the **voice/video call (VoIP) service switched on** for the Nexconn app (console.nexconn.ai). Until then a call shows "The call could not connect".

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

### Suggested walkthrough (video script, about 7 minutes)

Before recording: run `seed:demo` the same day, and open three windows side by side: a normal one, a private one and a phone-size one (DevTools device mode at 375 px, or a real phone on the deployed site). Each window is one demo user. Every live update below travels as a **Nexconn** message; say so on screen.

1. **The problem (0:00–0:30), landing page:** "eCourts tells you which day. CourtCall tells you the latest reported courtroom progress." In the hero, tap **Now hearing**, **Passed over** and **Break** to drive the dashboard and the client's phone. Show **Your whole firm, connected**.
2. **The junior in court (0:30–1:45), Window 1, Junior Priya:** **Today → Court 4 → Open room**.
   - Report **Now hearing** 5, then 6. Tap **Passed over**, **Now hearing 7**, then **Recalled → 6**. (Keep below Item 13 so Ramesh's alerts are saved for step 4.)
   - Type **20** to show the **jump confirmation**; cancel. **Break**, **Resume**, **Undo** on a toast.
   - Send a message in **Room chat**; point at the progress cards (Nexconn group channel, `CC:Progress`).
3. **Shared courtroom, private firms (1:45–2:30), Window 2, Junior Arjun (2nd office):** Court 4 shows the same progress and room chat, but only Kiran Desai's Item 18.
   - Report **Now hearing 8** from Arjun; Priya's window updates within a second.
   - **Conflict protection:** report from both windows at once; the late one gets "Someone else just reported a newer update".
4. **The client (2:30–3:45), Window 3 (phone size), Client:** tap **Client**. Ramesh sees **Now** vs **Item 15** and "N away". Tap **Turn on** alerts.
   - From Priya, report **Now hearing** 13: Ramesh gets "Your case is close… (2 away)". Then 15: "being heard now". Show the banner and the phone notification.
   - Switch the language to **ગુજરાતી**; the page and alerts follow. Open **History** (last week's hearing summary, the finished case) and **Chat**: send a message with the **mic** (voice typing), then record a **voice note** with the sound-wave button.
5. **The firm gets alerted too (3:45–4:30), Window 1, Firm admin Mehta** (Settings → **Phone alerts → Turn on**): from Arjun's window report Court 4 **16**. Mehta's pop-up says the hearing of Ramesh's case is over; **Update** opens the outcome form. Record **Next date**, a summary shared with the client and firm-only prep notes. Show it on Ramesh's **History**, and the **Calendar**.
6. **Hearing-day briefing (4:30–5:30), Mehta → Patel vs State of Gujarat:** in **Hearing-day briefing**, pick **Anil** as appearing lawyer, type a **Remember** note in English, tap **Send briefing now**. On Ramesh's phone **"CourtCall is calling"** rings; tap **Answer**: it reads the briefing aloud in Gujarati (`CC:Briefing`).
7. **Calls (5:30–6:00):** tap **Call my lawyer** on Ramesh's phone, or **Call client** on the case page; the other side rings and answers (Nexconn Call SDK). Needs VoIP switched on in the Nexconn console.
8. **Case teams and usage (6:00–6:40):** as Mehta open a case → **Case team → Edit team**. Then show **Anil** (sees only Ramesh's cases, a number on **Cases** and an item under **Updates** on Today), **Priya** (only her two cases, read-only) and **Neha** (read-only courtrooms, Chat count). Mention **Team → invite code MEHTA4 → Approve**, and show **This week in CourtCall** on Mehta's Team page (the numbers from this recording).
9. **Close (6:40–7:00):** Nexconn powers every live part: courtroom rooms, firm chat, client chat, alerts, briefings and calls. Works on a cheap phone through a WhatsApp link, with no app and no password.

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
| `CRON_SECRET` | a long random string (protects the 9 AM hearing-day briefing job; Vercel sends it automatically) |
| `MYMEMORY_EMAIL` | optional: an email address, raises the free translation limit for the Remember note |

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
