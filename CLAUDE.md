# CourtCall: project context for Claude

Claude Code loads this file automatically. It holds what has been built, the decisions behind it, and what comes next, so anyone on the team (and their Claude) can continue the work. **Keep it current:** when you finish a module or make a decision, update the "Status" and "Decisions" sections in the same commit.

Team: **Urja** (started the project) and **Kushi**. Repository: `github.com/Urjagajera/CourtCall`, branch `main`.

---

## 1. What CourtCall is

Real-time courtroom communication for Indian courts. Junior lawyers sitting in a courtroom report progress with one tap ("Now hearing Item 12", passed over, break…). CourtCall checks every update for conflicts, shares it with everyone in the same courtroom across law firms, and alerts each client about **their own** case through a private WhatsApp-shared link that needs no app.

> "eCourts tells you which day. CourtCall tells you the latest reported courtroom progress."

It never predicts hearing times. It only shows the latest reported progress, clearly labelled with when and by whom.

### The hackathon

- **Nexconn Build Challenge 2026**, deadline **22 Nov 2026**. Submission = demo video + PDF write-up + working app.
- Judging: **50% completeness and UX** (every demo path works end to end, polished on a phone), **30% innovation and scenario value**, **20% business and growth** (real users are a bonus: get actual lawyers/juniors/clients to try it and record usage).
- All real-time messaging must run on **Nexconn** (Chat SDK for web + Server API). Show real, measurable SDK usage.
- Rule of thumb: fewer features done fully beats many half-done.

---

## 2. How to run it

Full first-time and daily steps are in **README.md** (Part 1: setup, Part 2: run, Part 3: demo guide). Short version:

```bash
npm run setup                          # install root, server, client
npm --prefix server run db:migrate     # apply migrations
npm --prefix server run seed:demo      # demo firms, people, clients, today's cases
npm run dev                            # web http://localhost:5173, API http://localhost:4000
```

**Secrets:** `server/.env` is never committed. Get the values (Supabase `DATABASE_URL`, `JWT_SECRET`, Nexconn App Key/Secret, VAPID keys) from Urja **privately**, or create your own Supabase project and Nexconn app (README step 4–6). Never paste secrets into chat, commits, issues or this file.

If two people share the **same** Supabase database, they share demo data and migrations: coordinate before running `db:generate` (see section 8).

Useful checks: `npm test` (courtroom rule unit tests), `npm --prefix server run smoke` (100+ check end-to-end API test, needs the API running and `DEMO_LOGIN=true`; then run `npm --prefix server run smoke:cleanup`), `db:ping`, `db:check`, `nexconn:check`.

---

## 3. Stack and layout

| Part | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript, Tailwind CSS v4, React Router, lucide-react icons |
| Backend | Node + Express (async route errors handled), TypeScript, Zod validation, JWT in an httpOnly cookie (`cc_session`) |
| Database | Postgres on Supabase (project region: Tokyo, ~145 ms per query from India), Drizzle ORM + drizzle-kit migrations |
| Real-time | Nexconn Chat SDK for web (`@nexconn/engine`, `@nexconn/chat` 26.x) + Nexconn Server API (signed REST) |
| Push | Web Push (VAPID) — planned |

```
client/src/
  pages/landing/     public landing page (interactive hero, firm network, display board, live demo)
  pages/auth/        sign in, sign up (create firm / join firm), demo logins, pending approval
  pages/lawyer/      Today, Cases, Clients, Team (also used by staff)
  pages/court/Room   courtroom room: report progress, room chat, history
  pages/admin/       CourtCall verification (platform team)
  pages/Chats        team room + client chats
  components/        AppLayout, ChatPanel, Tour (guided tour), Sheet, ConfirmSheet, ui.tsx
  lib/               api, auth, nexconn (SDK wrapper), tour + tourSteps, theme, court helpers
server/src/
  db/schema.ts       all tables and enums
  lib/engine.ts      pure courtroom event rules (unit tested in engine.test.ts)
  lib/sessions.ts    courtroom sessions, joining, applying events, Nexconn room sync
  lib/nexconn.ts     Server API client (signing, failover, IDs, groups, messages)
  lib/demo.ts        demo accounts (shared by seed + demo login)
  routes/            auth, office (team), clients, cases, courtrooms, chat, admin
  scripts/           seed-demo, smoke, cleanup-smoke, create-admin, db-check, db-ping, nexconn-check
server/drizzle/      SQL migrations (never edit applied ones; add new)
design.md            design system — every screen follows it
PLAN.md              original product plan and schedule
```

---

## 4. Roles and permissions

| Role (`users.role`) | Can do | Approved by |
|---|---|---|
| `lawyer` (senior lawyer) | Clients, cases, courtrooms (join + report), team room, client chat | Firm founder: CourtCall team (Bar Council check). Others: a firm admin |
| `junior` | Join courtrooms, report progress, room chat, team room | A firm admin |
| `staff` (office clerk) | Clients, cases, team room, client chat; today's courtrooms **read-only**, never reports | A firm admin |
| `admin` | **CourtCall platform team**, not part of any firm. Only verifies firm founders | — |

- **Firm admin** is a flag (`users.is_firm_admin`), not a role. The founder (`offices.owner_id`) always has it and can't be deactivated or demoted. Firm admins can give it to lawyers or staff (never juniors). They approve/decline/deactivate people, change roles, and rotate the invite code (`/api/office/*`).
- People join a firm with its 6-character invite code (`/api/auth/register/member` with a role) and wait in `pending` until approved. "Deactivated" = `verification_status = 'rejected'`.
- All firm data (clients, cases, chats) is shared across the firm and **never** with other firms. Courtroom progress is the only thing shared between firms.
- `requireAuth`, `requireRole`, `requireVerified`, `requireFirmAdmin` in `server/src/lib/auth.ts` enforce this. Always enforce permissions on the server, not only in the UI.

---

## 5. Key decisions (and why)

**Product**
- Clients get **link-based access, no password** (WhatsApp-shared link bound to the first device). Clients are often older and on cheap phones; a login would push them back to calling the lawyer.
- Courtrooms are shared rooms across firms: one `court_session` per courtroom per day. Courtroom names match **case-insensitively** so different firms land in the same room.
- Never predict hearing times. Show "latest reported progress", who reported it and when; mark rooms **stale** after 20 minutes without updates.

**Courtroom update rules** (`server/src/lib/engine.ts`, unit tested)
- Every update carries `baseVersion`. If the room has moved on, the server returns **409 conflict** with the latest state ("Someone else reported a newer update"). A late update never overwrites newer progress.
- Jumps of more than 5 items ahead, or moving backwards, need explicit confirmation.
- Undo = a `correction` event on the latest event, within 10 seconds in the UI. Older events can't be undone. History keeps everything.
- Events: now_hearing, passed_over, recalled, adjourned, break_start, break_end, court_not_sitting, court_risen, correction.

**Nexconn** (`server/src/lib/nexconn.ts`, `client/src/lib/nexconn.ts`)
- IDs: staff `u<uuid without dashes>`, clients `c<…>`, courtroom group `s<sessionId>`, firm team group `o<officeId>`, bot user `courtcallbot`.
- Server signs requests: `SHA1(appSecret + nonce + timestamp)` lowercase hex; fails over to the `api-b.` backup domain.
- Custom message types: `CC:Progress` (structured courtroom update posted into the room group by the bot) and `CC:Alert` (client alerts). The web SDK's real field is `isPersisted` — the docs misspell it `isPersited`; trust the `.d.ts` types over the docs.
- Nexconn failures are logged and never break the core courtroom flow (`safely()`).
- Rooms reload instantly on a `CC:Progress` message; polling stays as a slow fallback.

**Design** (`design.md`, tokens in `client/src/index.css`)
- Theme "Warm legal": 50% warm ivory `#F4EEEA`, 35% near-white cards `#FBF8F6`, 15% maroon `#7B3B36` accent; espresso text `#463B36`; taupe `#B4907C` details. **Light is the default**; dark mode is optional in Settings.
- Use tokens (`bg-base`, `bg-surface`, `bg-accent`, `text-ink`, `text-detail`…), never one-off hex values. Status colors (hearing green, waiting amber, stopped red, stale grey, info blue) are separate on purpose.
- No cartoon illustrations; show real app screens. Subtle motion only (number flips, pops). Respect `prefers-reduced-motion`.
- Wide screens: no big empty side margins (app up to 1600px, landing 1440px). Phones: big tap targets, bottom tab bar.
- Every first login gets a **guided tour** per role (`client/src/lib/tourSteps.ts`); spotlight targets are `data-tour="…"` attributes. Add steps when you add a major feature.

**Demo**
- `DEMO_LOGIN=true` shows one-tap demo buttons on the sign-in page (`server/src/lib/demo.ts`). Demo accounts end in `@courtcall.demo`. Firms: **Mehta & Associates** (`MEHTA4`: Mehta = founder/firm admin, Anil = senior lawyer, Priya = junior, Neha = staff) and **Desai Law Chambers** (`DESAI7`: Desai, Arjun). Court 4 is shared by both firms. Re-run `seed:demo` each day to move cases to today.
- README "Part 3: Demo guide" doubles as the demo-video script. Keep it in sync with features.

---

## 6. Status

Done (in order):
1. Scaffold, schema, auth (sign-up/sign-in, verification), clients and cases CRUD
2. Courtroom sessions + event engine with conflict rules + junior reporting UI (big buttons, undo, confirmations, history)
3. Nexconn: tokens, courtroom group rooms, `CC:Progress` messages, room chat, firm team room, lawyer → client chat list
4. Landing page: interactive hero (visitors drive the dashboard + client phone), connected firm network, cause-list board, live demo with conflict simulation
5. Warm legal theme, light default, wide layouts, split sign-in page, two-column courtroom room
6. One-tap demo logins, README with setup + demo guide
7. Audit and fixes; end-to-end API smoke test
8. Guided first-login tour per role
9. Firm roles: firm admin flag, office staff role, join-a-firm by invite code, Team management page
10. Client WhatsApp links: per-case client/family links (hashed tokens, bound to the first phone, revoke/reissue), firm link sheet with WhatsApp share, client page `/case` with live progress + Nexconn chat with the firm, Client demo button

**Not done yet:**

11. Automatic client alerts: rules in `server/src/lib/alertRules.ts` (unit tested), sending in `alerts.ts` (dedupe via `alert_logs`, Nexconn bot DM `CC:Alert`, Web Push in `push.ts`), client page banner + "Turn on alerts" (`client/public/sw.js`, `client/src/lib/push.ts`)
12. Deployed on Vercel Hobby (free): **https://courtcall-kappa.vercel.app**. Installable app (PWA): `client/public/manifest.webmanifest`, icons, `sw.js` (offline page + push), install button (`client/src/lib/install.ts`, `InstallApp`), app opens at `/app` which routes staff/clients. User guide `GUIDE.md` is rendered on the site at `/guide`; keep it updated with features. `vercel.json` builds server + client, serves client/dist, rewrites /api/* to the function pi/index.js (imports server/dist), region hnd1 (Tokyo). Alerts use waitUntil on Vercel. Every push to `main` redeploys.
13. **Polish on real phones** ← next; family links; Gujarati/Hindi alert templates; PWA install
14. Real-user testing with actual lawyers/juniors/clients (traction bonus); record usage numbers
15. Demo video + PDF write-up + submit by 22 Nov

### Plan for 10–11 (client links + alerts)

- Lawyer/staff generates a link `/c/<token>` from **Clients** (share via WhatsApp with a prefilled message). Only a **hash** of the token is stored (`access_links` table already exists).
- First open binds the link to that device (hash of a random device ID in localStorage) and sets a client session cookie. Another device sees "This link is already in use. Ask your lawyer for a new one."
- Firm can **revoke** and **reissue** links. **Family links** are status-only (no chat).
- Client case page: "Now 12 → Yours 15 (3 away)", court, status, latest updates, **Chat with lawyer** (Nexconn direct channel with the firm; client Nexconn ID `c<clientId>`).
- Alerts after each accepted courtroom event: first update of the day, then distance ≤10, ≤5, ≤2, now hearing; plus passed over / recalled / adjourned for that case. Deduplicate with `alert_logs`. Send as `CC:Alert` from the bot + Web Push. Fixed templates; never predict times.
- Add a **Client** demo button that opens Ramesh Patel's case page; add smoke-test checks; add tour/README sections.

**Module 10 as built** (files: `server/src/lib/clientAccess.ts`, `server/src/routes/links.ts`, `server/src/routes/client.ts`, `client/src/components/LinkSheet.tsx`, `client/src/pages/client/*`):
- Links are **per case** (`access_links.case_id`). Add a migration column `access_links.created_by` (user who shared it). The client chats with that person by default.
- `server/src/lib/clientAccess.ts`: token = `randomBytes(24).toString('base64url')`, store `sha256` hash. A separate cookie `cc_client` (JWT `{ lid: linkId }`). Middleware `requireClient` loads the link (not revoked) + case + client + firm.
- Firm routes (lawyer/staff, verified, same firm as the case):
  - `GET /api/cases/:id/links` lists links (never tokens).
  - `POST /api/cases/:id/links {kind: client|family, label?}` returns the raw token **once**.
  - `POST /api/links/:id/revoke`.
  - `POST /api/links/:id/reissue` revokes the old link and returns a new token.
- Client routes:
  - `POST /api/c/activate {token, deviceId}`. A revoked link returns 410 "This link was turned off. Ask your lawyer for a new one". A different device returns 409 "This link is already in use on another phone". Otherwise it binds `device_id_hash` on first open and sets the cookie.
  - `GET /api/c/me` returns the case, court, firm name, link kind, today's session state (if the hearing is today), recent events **without reporter names**, and alert history.
  - `POST /api/c/chat-token` (client links only, not family) issues a Nexconn token for `c<clientId>` and returns contacts (the link creator first, plus anyone who already messaged).
  - `POST /api/c/demo` (only when `DEMO_LOGIN=true`) sets the cookie for the seeded demo link, skipping device binding.
- Frontend: `/c/:token` keeps a random `deviceId` in localStorage, calls activate, then `navigate('/case', { replace: true })`, so the token never stays in the history. `/case` is the client page: Now / Yours / N away, status, updates, chat via `ChatPanel` direct channel, and polls every 10 s. Use `startChat('/c/chat-token')`.
- Cases page: add a "Client link" button per case. It opens a sheet listing links (active / opened on a phone / revoked), with create, copy, **Share on WhatsApp** (`https://wa.me/91<10-digit phone>?text=…`), revoke and reissue. Warn: "Opening the link yourself locks it to your phone."
- Seed: create a demo client link for "Patel vs State of Gujarat". Add a "Client" demo button that calls `/api/c/demo` and goes to `/case`.
- The seeded demo link is never bound to a phone and is hidden from the firm's link list, so nobody can break the Client demo button.
- Alerts run **after** the event response is sent to keep the junior's tap fast. On Vercel, `waitUntil` (from `@vercel/functions`) keeps the function alive until they finish.
- Silent bookkeeping rows in `alert_logs` (skipped thresholds) have an empty `message` and are never shown.

---

## 7. Working conventions

- **Git:** work on `main`. Always `git pull --rebase` before starting and before pushing. Push small, finished pieces. Tell each other which module you're working on so two people don't edit the same files.
- **Commit messages:** plain human sentences. For a module, commit `start: <module> - …` when it begins and `done: <module> - …` when it's finished and verified. No AI attribution lines in commit messages.
- **Before committing:** client `npx tsc -b` (in `client/`), server `npx tsc --noEmit` (in `server/`), `npm test`, and the smoke test for API changes. Check UI changes in a browser on phone (375px) and laptop widths, light and dark.
- **Migrations:** change `server/src/db/schema.ts`, then `npm --prefix server run db:generate -- --name <what>`, review the SQL, then `db:migrate`. Never edit an applied migration. Only one person generates migrations at a time.
- **Copy:** short, plain sentences, sentence case. No "please", no "successfully". Errors say what happened and what to do.
- Keep README (setup + demo guide), design.md and this file updated when behaviour changes.

## 8. Gotchas

- **Windows, full C: drive** (Urja's machine): set `TEMP`/`TMP` to a folder on D: before npm/vite/tsc, e.g. `$env:TEMP='D:\ANTI\.tmp'`.
- In PowerShell, `R` is a built-in alias (`Invoke-History`), so a helper function named `R` silently won't run.
- The API runs under `tsx watch`; touching `server/src/config.ts` restarts it so it re-reads `.env`.
- Every DB query goes to Tokyo (~145 ms): batch queries instead of looping, as in `sessionsForUser`.
- Nexconn group channel IDs allow letters and digits only (max 64), which is why UUID dashes are stripped.
- `GET /api/auth/me` returns `{ user: null }` (200) for visitors on purpose, so the landing page doesn't log 401 errors.
