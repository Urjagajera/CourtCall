# CourtCall – Build Plan

Hackathon: **Nexconn Build Challenge 2026** (reskilll.com/hack/nexconn)
Deadline: **Nov 22, 23:59 AoE** (Mon Nov 23, 5:29 PM IST).

## What judges score (drives every decision)

| Weight | Criterion | What it means for us |
|---|---|---|
| 50% | Completeness & UX | Every demo path works end to end, is smooth and looks polished on a phone. Fewer features done fully beats many half-done. |
| 30% | Innovation & scenario value | Real communication problem (Indian courts), shared courtroom rooms, conflict-safe updates, no-install client links. |
| 20% | Business & growth | **Real users = bonus.** Get a few actual lawyers/juniors/clients to use the app and record usage numbers. |

Required submission: PDF write-up (incl. Nexconn App Key + list of SDK-powered features), demo video, live URL, public GitHub repo. Disqualified without real Chat SDK usage.

## Stack

- **Client:** React + Vite + TypeScript, Tailwind CSS v4, React Router, `@nexconn/engine` + `@nexconn/chat`
- **Server:** Node.js + Express + TypeScript, Drizzle ORM, Zod, JWT
- **DB:** PostgreSQL on Supabase (free tier). We use Supabase only as hosted Postgres, connected through the transaction pooler. Auth stays in our own server.
- **Realtime chat:** Nexconn Chat SDK (client) + Nexconn Server API (server-signed)
- **Push:** Web Push (VAPID + service worker). Nexconn has no web push provider.
- **Deploy:** one Vercel project serves the client and the Express API (as a serverless function) at one live URL. Supabase hosts the database. The server must therefore be **stateless**: no in-memory state and no timers. Values like "stale" are computed when data is read.

## Nexconn usage map

| Feature | Nexconn primitive |
|---|---|
| Shared courtroom room (e.g. "Court 4 – 11 Nov") | Group channel; members are verified lawyers and juniors |
| Structured progress messages (Item 12 now being heard) | Server API sends a structured/custom message into the courtroom group |
| Private lawyer–client chat | Direct channel |
| Private office team room | Group channel per office |
| Client alerts and history | Server sends a direct message from the "CourtCall Bot" user to the client, plus Web Push |

Tokens: the server issues a Nexconn token for each user through `/v4/auth/access-token/issue`. The App Secret never leaves the server.

## Data model (Postgres tables)

- **User**: role (`lawyer` | `junior` | `admin`), name, phone, email, passwordHash, barCouncilNo, verificationStatus (`pending` | `verified` | `rejected`), officeId
- **Office**: name, ownerId (senior lawyer)
- **Courtroom**: courtComplex, roomNo, displayName
- **CourtSession**: courtroomId, date, currentItem, status (`not_started` | `hearing` | `break` | `risen`), version, lastEventAt, nexconnGroupId
- **CourtEvent**: sessionId, version, type, item, reporterId, officeId, serverTs, confirmedBy[], singleReporter, correctsEventId
- **Client**: officeId, name, phone, language
- **Case**: officeId, clientId, title, caseNo, courtroomId, hearingDate, itemNo, assignedJuniorId
- **AccessLink**: caseId, kind (`client` | `family`), tokenHash, deviceIdHash, activatedAt, revokedAt
- **AlertLog**: caseId, sessionId, eventVersion, channel, sentAt (prevents duplicate alerts)

## Courtroom update rules

1. The server assigns the timestamp and a monotonic `version` per session: `UPDATE court_sessions SET ..., version = version + 1 WHERE id = $1 AND version = $baseVersion`, in a transaction with the event insert.
2. A reporter sends `baseVersion`. If the session has moved on, the server returns **409 + the latest state**. A delayed update never overwrites newer progress.
3. Moving backward in item number, or jumping more than 5 items forward, returns `needsConfirmation`. The reporter re-sends with `confirm: true`.
4. If no other reporter has been active in this session within 20 minutes, the event is marked `singleReporter`. Lawyers see this flag; clients never do.
5. Corrections are new events that reference `correctsEventId`. The history is append-only.
6. If more than 20 minutes pass without an update during hearing hours, the session is shown as **stale**.
7. Event types: `now_hearing`, `passed_over`, `recalled`, `adjourned`, `break_start`, `break_end`, `court_not_sitting`, `court_risen`, `correction`.

## Client alert logic

For each case listed in the session, after every accepted event:
- Distance = case item − current item. Alert thresholds: the first update of the day, then at ≤10, ≤5, ≤2 and "now hearing".
- Also alert on events that affect this specific case: passed over, recalled, adjourned.
- `AlertLog` deduplicates. Each alert is sent as a Nexconn bot DM and a Web Push.
- Alert text comes from fixed templates (English first; Gujarati and Hindi if time permits). Alerts never predict a hearing time.

## Client access links

- The lawyer generates a link `/c/<token>`. Only a hash of the token is stored.
- The first open binds the link to a device: we store a hash of a random device ID kept in localStorage, and the server issues a client session cookie or JWT.
- Opening from a different device shows "Link already activated. Ask your lawyer for a new link."
- The lawyer can revoke and reissue links. Family links are status-only and have no chat.

## MVP scope (in build order)

1. Auth: lawyer/junior sign-up, admin verification, JWT
2. Offices, clients, cases CRUD (lawyer)
3. Courtrooms + sessions + event engine with conflict rules
4. Junior reporting UI (big buttons, mobile)
5. Nexconn integration: tokens, courtroom groups, structured messages
6. Client links + client case page + alerts
7. Lawyer dashboard (multi-courtroom) + lawyer–client chat
8. Web Push
9. Deploy + seed demo data
10. If time permits: office team room, family links, Gujarati/Hindi templates, PWA

## Schedule (solo, build complete by Nov 16)

| Date | Work |
|---|---|
| Nov 11 | Scaffold ✅, DB schema, auth (lawyer/junior/admin verify), lawyer CRUD for clients and cases |
| Nov 12 | Courtroom sessions + event engine with conflict rules + junior reporting UI |
| Nov 13 | Nexconn: tokens, courtroom group rooms, structured progress messages, lawyer–client chat |
| Nov 14 | Client links (device activation, revoke/reissue), client case page, automatic alerts |
| Nov 15 | Lawyer multi-courtroom dashboard, Web Push, first Vercel deploy + seed demo data |
| Nov 16 | Polish UX on phones, fix bugs, extras if time (family links, Gujarati/Hindi, PWA) |
| Nov 17–21 | Real-user testing (traction bonus), fixes from feedback |
| Nov 22 | Demo video, PDF write-up, submit |

Deploy early (Nov 15), not at the end, so hosting problems show up while there is time to fix them.
