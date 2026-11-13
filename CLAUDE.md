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
| `lawyer` (senior lawyer) | Adds clients and cases (becomes main lawyer); sees the cases they are on + their clients and chats; on cases they lead: edits details, records hearings, picks helping junior + staff helper; courtrooms (join + report), team room | Firm founder: nobody (starts right away). Others: a firm admin |
| `junior` | Sees only cases they are on (as main lawyer or helping junior) + those clients and chats; as main lawyer records hearings and edits the case; join courtrooms, report progress, room chat, team room; never assigns anyone | A firm admin |
| `staff` (office clerk) | Staff helper on cases (max one per case): sees those cases, clients and chats read-only; team room; today's courtrooms **read-only**, never reports; can't add or edit cases or clients | A firm admin |
| `admin` | Removed (Nov 2026). The enum value stays in the DB but nothing uses it | — |

- **Firm admin** is a flag (`users.is_firm_admin`), not a role. The founder (`offices.owner_id`) always has it and can't be deactivated or demoted. Only **senior lawyers** can be firm admins (never juniors or office staff): enforced in `PATCH /office/members/:id`, and `withAdminRule()` in `lib/auth.ts` ignores the flag on anyone else. Moving an admin to junior/staff removes it. They approve/decline/deactivate people, change roles, and rotate the invite code (`/api/office/*`).
- People join a firm with its 6-character invite code (`/api/auth/register/member` with a role) and wait in `pending` until approved. "Deactivated" = `verification_status = 'rejected'`.
- Firm data is **never** shared with other firms; courtroom progress is the only thing shared between firms.
- **Case teams decide visibility** (`server/src/lib/visibility.ts`: `caseVisible`, `clientScope`, `canEditCase`, `canManageTeam`, `validateTeam`): each case has `main_lawyer_id` (senior or junior), `assigned_junior_id` (helping junior, senior-led cases only) and `helper_staff_id` (one staff). Firm admins see everything; everyone else sees only cases they are on, the clients of those cases (plus clients they added that have no case yet), their links and chats, and only those case rows on Today/rooms/Calendar. Team changes: `PUT /api/cases/:id/team` (firm admin: all; senior main lawyer: helping junior + staff helper only). Clients chat with the people on their cases + firm admins. The old per-client `client_assignments` table is no longer used (kept for history).
- No Bar Council number is collected (removed Nov 2026: there is no public API to verify it). Firm admins approve everyone who joins.
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
- **Core rule (Urja, 12 Nov 2026): Nexconn's Chat SDK and Call SDK are the backbone of CourtCall and must "light up" across the whole system.** For every feature, first design how it runs on Nexconn: realtime updates as Chat SDK messages (`CC:Progress`, `CC:Alert`, planned `CC:Briefing`), conversations as Nexconn channels, voice as Call SDK calls (planned "Call my lawyer" / "Call client" and the hearing-day briefing). Use other services only where Nexconn can't do the job (e.g. the Call SDK can't dial phone numbers) and say so. Make the usage visible in the UI, the demo video and the write-up.
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
10. Client WhatsApp links: per-case client links (hashed tokens, bound to the first phone, revoke/reissue), firm link sheet with WhatsApp share, client page `/case` with live progress + Nexconn chat with the firm, Client demo button

**Not done yet:**

11. Automatic client alerts: rules in `server/src/lib/alertRules.ts` (unit tested), sending in `alerts.ts` (dedupe via `alert_logs`, Nexconn bot DM `CC:Alert`, Web Push in `push.ts`), client page banner + "Turn on alerts" (`client/public/sw.js`, `client/src/lib/push.ts`)
12. Deployed on Vercel Hobby (free): **https://courtcall-kappa.vercel.app**. Installable app (PWA): `client/public/manifest.webmanifest`, icons, `sw.js` (offline page + push), service worker registration (`client/src/lib/install.ts`; the in-app install card was removed on request, Android users get an APK built with PWABuilder), app opens at `/app` which routes staff/clients. User guide `GUIDE.md` lives in the repo only (not shown inside the app); keep it updated with features. `vercel.json` builds server + client, serves client/dist, rewrites /api/* to the function pi/index.js (imports server/dist), region hnd1 (Tokyo). Alerts use waitUntil on Vercel. Every push to `main` redeploys.
13. Done: client history/sign out/tour, firm chat filters, client assignment, platform admin removed. **Languages**: client page + client tour + alerts in en/hi/gu (`client/src/lib/clientI18n.ts`, `server/src/lib/alertText.ts`; client switch saves `clients.language` via `POST /api/c/language`). Staff screens stay English. **Voice typing** in every chat box (`client/src/lib/dictation.ts`, browser SpeechRecognition, text goes into the box, never auto-sent). Next: polish on real phones
13b. Done (12 Nov 2026): **hearing lifecycle**. `cases.status` (active/closed), `cases.item_no` nullable (cause list not out yet), table `case_hearings` (one row per held hearing: outcome next_date/closed, next date, summary + `share_with_client`, firm-only `prep_notes`). Routes in `server/src/routes/hearings.ts`: `GET /hearings/pending` (reminder: date passed, or court risen / not sitting / moved past the item; lawyers+staff, scoped), `POST /cases/:id/outcome`, `PATCH /hearings/:id`, `GET /cases/:id/detail`, `GET /clients/:id/detail`, `GET /calendar?from&to`. UI: `HearingsToUpdate` card (Today + Cases), `OutcomeSheet`, pages `/cases/:id`, `/clients/:id`, `/calendar` (new nav tab). Client links need a case number; the client page shows the next date, "case ended", and shared summaries in History (never prep notes). Alerts skip closed cases and cases without an item number. Tour steps added for all of these (staff, lawyer, junior: Calendar only).

13c. Done (12 Nov 2026): **client layout** matches the lawyer app (`ClientLayout` in `client/src/pages/client/ClientCase.tsx`): sidebar on laptops, top bar + bottom tabs on phones. Tabs are routes: `/case` (My case), `/case/cases`, `/case/history`, `/case/chat`, `/case/settings` (language, alerts, theme, tour, sign out); `?case=<id>` is kept across tabs. The client keeps a Nexconn connection on every tab (alerts pop up anywhere). Client tour steps carry routes. `bar_council_no` column dropped (migration 0009) and non-lawyer admin flags cleared (0010) on the shared DB.

### Pending tasks (requested by Urja; remove each line when done)

13d. Done (12 Nov 2026): **case teams, per-case visibility and update badges** (`lib/visibility.ts`, `routes/cases.ts` `PUT /:id/team`, `lib/notify.ts`, `routes/notifications.ts`, table `notifications`, client `lib/updates.tsx`, `components/CaseTeam.tsx`, `UpdatesCard.tsx`, nav badges in `AppLayout.tsx`). Rules decided by Urja (do not change without asking):
  - **Each case has a team:** one **main lawyer** (a senior or a junior), an optional **helping junior** (only when the main lawyer is a senior; replaces "Junior in court", column `assigned_junior_id`), and at most **one staff helper**. Staff are never main lawyer.
  - **Who assigns:** firm admin can set everything (any senior, themselves or a junior as main lawyer; helping junior; staff helper). A senior who is not admin: on cases they are main lawyer of, can set the helping junior and staff helper, but can **not** change the main lawyer. Juniors and staff can't assign anything.
  - **New cases:** firm admin (picks the main lawyer) and senior lawyers (the creator becomes main lawyer). Staff and juniors can't add cases. **Clients:** added by firm admin and seniors; edited/deleted by the firm admin or the main lawyer of that client's case(s).
  - **Visibility is per case** (replaces per-client "who looks after this client"): you see a case if you are its main lawyer, helping junior or staff helper; firm admins see everything; juniors see only their own cases. You see a client (page, details, chat, WhatsApp link) if you are on at least one of their cases (or added the client and it has no case yet). Old data copied once: main lawyer = senior who looked after the client (else founder), helping junior = old "Junior in court", staff helper = staff who looked after the client.
  - **Case details** (date, item, court, case no., title) are edited by the firm admin or the main lawyer.
  - **Hearing outcome to-do** goes to the main lawyer (senior or junior) and firm admins. When one records it, the to-do disappears for everyone and the others get a "changes were made" notice.
  - **"Something new" badges** for the people on a case (never the person who made the change): you were assigned / removed; case details changed; hearing outcome recorded or notes edited; a hearing needs an update (to-do, main lawyer + admins). Shown as a **number on the sidebar / bottom tab** (Cases) and an **Updates list at the top of Today**; opening an update marks it read. **Chat** in the sidebar / bottom tab shows the unread message count. New updates arrive instantly via a Nexconn bot message (not stored, so it never counts as chat), with polling as fallback.

13e. Done (13 Nov 2026, Kushi): **firm alerts when a client's turn comes**, built **without a database migration**. Rules: `chooseStaffAlert` + `staffRecipients` in `server/src/lib/alertRules.ts` (unit tested). Keys `staff_within_2`, `staff_now_hearing`, `staff_recalled:v<N>`, `staff_done` share `alert_logs` with the client keys (same dedupe) and always have an empty message, so the client never sees them. `sendAlerts` in `lib/alerts.ts` (renamed from `alertClients`) does clients and firm in one pass. Recipients: main lawyer, helping junior, staff helper + verified firm admins of that firm; the reporter is skipped except for "done". "Done" = moved past (not if the case was passed over), adjourned, risen, not sitting. Delivery: Nexconn bot DM `CC:StaffAlert` ({text, caseId, kind: close/now/done, url}) shown as a Toast in `AppLayout`, plus Web Push via `pushToUsers` (uses the existing `push_subscriptions.user_id` column). Staff push routes `/api/push` (`key`, `status`, `/`, `off`) in `routes/push.ts`; Settings → **Phone alerts** card (mute = Turn off, per device). Deep link `/cases/:id?update=1` opens `OutcomeSheet` when the hearing still needs an outcome and the person can edit. Cases without an item number get no firm alerts (same as clients). Smoke checks added (alerts are confirmed by reading `alert_logs`).

13f. Done (13 Nov 2026, Urja): **hearing-day briefing + in-app calls**.
  - **Case data** (migration 0013, additive): `cases.appearing_lawyer_id` (approved senior of the firm) and `cases.remember_note` (client-facing, max 400). Set on the case page (`BriefingCard`) and in the outcome sheet for the next hearing; edited by the main lawyer / firm admin. The note is cleared once that day's briefing is sent.
  - **Briefing** (`server/src/lib/briefing.ts`): fixed template en/hi/gu (court, item or "not out yet", appearing lawyer else a senior main lawyer, the note); never a time. Once per case per day via `alert_logs` key `briefing` (message stored, so it shows in the client's History). Delivered as Nexconn bot DM `CC:Briefing` + Web Push to the case's active links (`/case?case=…&briefing=1`).
  - **When:** Vercel Cron `GET /api/cron/briefings` at 03:30 UTC (9:00–10:00 IST on Hobby; `vercel.json` `crons`), protected by env **`CRON_SECRET`** (Vercel sends it as a Bearer token; without it the route returns 503). Plus **"Send briefing now"** (`POST /api/cases/:id/briefing`, main lawyer / firm admin, hearing day only, 409 if already sent).
  - **Translation (free, Urja: no paid APIs):** `server/src/lib/translate.ts` uses the MyMemory public API (no key; optional `MYMEMORY_EMAIL` raises the free daily limit). Source language from the script (Latin/Devanagari/Gujarati); any failure falls back to the note as typed. The note text is sent to MyMemory. No Claude API.
  - **Client screen** (`client/src/components/BriefingCall.tsx`): full-screen "CourtCall is calling" (rings; Answer reads it aloud with the phone's own speech synthesis in the client's language, shows the text if the phone has no voice for it; Listen again; Call my lawyer). Opens on a `CC:Briefing` message or the notification link; "Today's briefing" card on My case.
  - **Nexconn Call SDK** (`@nexconn/call` 26.2.1, which requires `@nexconn/chat` / `@nexconn/engine` **exactly 26.2.0**, pinned): `client/src/lib/calls.ts` (`NCCallEngine.install()` before `NCEngine.initialize`, engine started after chat connects; one call at a time; ringtone via Web Audio; the caller posts a call-log line into the direct chat), `CallOverlay` on every page (staff + client). Buttons: **Call** in every one-to-one chat, **Call client** on the case page, **Call my lawyer** for clients (appearing lawyer first, else main lawyer). Audio only. **Needs the voice/video call (VoIP) service switched on for the Nexconn app** in console.nexconn.ai; until then `startCall` returns 80006 "VoIP service not active" and the app shows "The call could not connect".
  - Smoke checks: appearing lawyer must be a senior, staff/junior can't send, briefing content, once a day, note cleared, cron locked.

- [ ] **Real phone-call fallback for the briefing** (agreed 12 Nov 2026, deferred by Urja 13 Nov: not needed for the demo). For clients who haven't opened the in-app briefing within ~15 min (or never opened their link), a robot-voice call to `clients.phone` via a telephony provider (Exotel for India or Twilio; NOT Nexconn, whose Call SDK can't dial phone numbers). Needs a paid account + keys and Indian caller-ID/DLT registration for production.

- [x] **Notify the lawyer when their client's turn comes** (requested 12 Nov 2026; **done by Kushi, 13 Nov 2026**, see 13e below; original request kept for reference). When a client's case is close (2 away) and when it is being heard, the people who look after that client (assigned lawyers/staff, plus firm admins; see `lib/visibility.ts`) get a notification: a phone/browser notification (Web Push for staff, which doesn't exist yet; only clients have push today) and a CourtCall bot message in the app. When the hearing ends (court moves past the item, adjourned, risen), notify again with a direct link that opens the existing outcome form (`OutcomeSheet`: next date or case ended, "what happened" note shareable with the client, firm-only prep notes) for that case. Today this only shows as the in-app "Hearings to update" card on Today/Cases. Reuse the alert pipeline in `server/src/lib/alerts.ts` (same triggers and `alert_logs` dedupe, but a separate key prefix such as `staff_within_2`, `staff_now_hearing`, `staff_done`, stored with an empty client message so clients never see it). Needs: staff push subscription table + "Turn on alerts" in Settings, a deep link like `/cases/:id?update=1` that opens the sheet, a setting to mute, smoke tests and tour/GUIDE updates.

- [ ] ~~**Client accounts by email instead of WhatsApp links**~~ **Dropped for the hackathon (Urja, 13 Nov 2026):** it reverses the core "WhatsApp link, no password" decision, needs a migration + email service, and 9 days are left; completeness beats new scope. Kept here only as a post-hackathon idea. (Originally requested 12 Nov 2026.) When a firm adds a client, CourtCall creates a proper client account and **emails the client their sign-in details** so they can use the website (and the installed app) like everyone else, instead of the current WhatsApp link bound to one phone. To decide when building it: email provider (e.g. Resend / SES), the client must have an email (make it required on Add client), set-password link that expires instead of mailing a plain password, sign-in page for clients, what happens to existing links (keep as fallback or migrate), family access, and updating the client tour, GUIDE.md and smoke tests.

14. Real-user testing with actual lawyers/juniors/clients (traction bonus); record usage numbers
15. Demo video + PDF write-up + submit by 22 Nov

### Plan for 10–11 (client links + alerts)

- Lawyer/staff generates a link `/c/<token>` from **Clients** (share via WhatsApp with a prefilled message). Only a **hash** of the token is stored (`access_links` table already exists).
- First open binds the link to that device (hash of a random device ID in localStorage) and sets a client session cookie. Another device sees "This link is already in use. Ask your lawyer for a new one."
- Firm can **revoke** and **reissue** links. **Family links were removed** (Nov 2026): only client links exist; any old family link returns 410 "turned off" (`link_kind` enum keeps the value).
- Client case page: "Now 12 → Yours 15 (3 away)", court, status, latest updates, **Chat with lawyer** (Nexconn direct channel with the firm; client Nexconn ID `c<clientId>`).
- Alerts after each accepted courtroom event: first update of the day, then distance ≤10, ≤5, ≤2, now hearing; plus passed over / recalled / adjourned for that case. Deduplicate with `alert_logs`. Send as `CC:Alert` from the bot + Web Push. Fixed templates; never predict times.
- **Requirement (Urja, 12 Nov 2026): the client must be told when their turn is 2 cases away.** Built: the `within_2` alert ("Your case is close: Court 4 is at Item 9, yours is Item 11 (2 away). Be near the courtroom.", `close` template in `server/src/lib/alertText.ts`, en/hi/gu). It fires once per hearing day, even if the court jumps straight to 2 or fewer away. Keep it when changing alert rules (unit test in `alertRules.test.ts`).
- Add a **Client** demo button that opens Ramesh Patel's case page; add smoke-test checks; add tour/README sections.

**Module 10 as built** (files: `server/src/lib/clientAccess.ts`, `server/src/routes/links.ts`, `server/src/routes/client.ts`, `client/src/components/LinkSheet.tsx`, `client/src/pages/client/*`):
- Links are **per case** (`access_links.case_id`). Add a migration column `access_links.created_by` (user who shared it). The client chats with that person by default.
- `server/src/lib/clientAccess.ts`: token = `randomBytes(24).toString('base64url')`, store `sha256` hash. A separate cookie `cc_client` (JWT `{ lid: linkId }`). Middleware `requireClient` loads the link (not revoked) + case + client + firm.
- Firm routes (lawyer/staff, verified, same firm as the case):
  - `GET /api/cases/:id/links` lists links (never tokens).
  - `POST /api/cases/:id/links {kind?: client, label?, assignTo?}` returns the raw token **once**.
  - `POST /api/links/:id/revoke`.
  - `POST /api/links/:id/reissue` revokes the old link and returns a new token.
- Client routes:
  - `POST /api/c/activate {token, deviceId}`. A revoked link returns 410 "This link was turned off. Ask your lawyer for a new one". A different device returns 409 "This link is already in use on another phone". Otherwise it binds `device_id_hash` on first open and sets the cookie.
  - `GET /api/c/me` returns the case, court, firm name, link kind, today's session state (if the hearing is today), recent events **without reporter names**, and alert history.
  - `POST /api/c/chat-token` issues a Nexconn token for `c<clientId>` and returns contacts (the link creator first, plus anyone who already messaged).
  - `POST /api/c/demo` (only when `DEMO_LOGIN=true`) sets the cookie for the seeded demo link, skipping device binding.
- Frontend: `/c/:token` keeps a random `deviceId` in localStorage, calls activate, then `navigate('/case', { replace: true })`, so the token never stays in the history. `/case` is the client page: Now / Yours / N away, status, updates, chat via `ChatPanel` direct channel, and polls every 10 s. Use `startChat('/c/chat-token')`.
- Cases page: add a "Client link" button per case. It opens a sheet listing links (active / opened on a phone / revoked), with create, copy, **Share on WhatsApp** (`https://wa.me/91<10-digit phone>?text=…`), revoke and reissue. Warn: "Opening the link yourself locks it to your phone."
- Seed: create a demo client link for "Patel vs State of Gujarat". Add a "Client" demo button that calls `/api/c/demo` and goes to `/case`.
- The seeded demo link is never bound to a phone and is hidden from the firm's link list, so nobody can break the Client demo button.
- Alerts run **after** the event response is sent to keep the junior's tap fast. On Vercel, `waitUntil` (from `@vercel/functions`) keeps the function alive until they finish.
- Silent bookkeeping rows in `alert_logs` (skipped thresholds) have an empty `message` and are never shown.

---

## 7. Working conventions

- **Team setup and pushing safely:** see **step.md** (Kushi uses her own Supabase + Nexconn app; the live site uses Urja's). Changes that add a migration go to a branch first: Urja applies the migration to the live DB, then merges (decided 13 Nov 2026).
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
- **Supabase transaction pooler (port 6543) hangs with pipelined queries** (seen 12–13 Nov 2026, found by Kushi): when a page fires more queries than the pool has connections, postgres.js pipelines several on one connection and the pooler stalls (queries sit "active / ClientRead"); every request then times out until the API restarts. **Fixed 13 Nov 2026** with `max_pipeline: 1` in `server/src/db/index.ts` (queries wait for a free connection instead); 30 parallel heavy requests now pass. Keep it.
- `GET /api/auth/me` returns `{ user: null }` (200) for visitors on purpose, so the landing page doesn't log 401 errors.
