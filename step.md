# CourtCall: setup steps for Kushi (Windows)

This file takes you from nothing to a working copy of CourtCall on your laptop, and explains how to push your work so it goes live on **https://courtcall-kappa.vercel.app** without breaking it. Parts E and F are ready-made prompts for Kushi's Claude and Urja's Claude.

**How it is set up (decided by Urja, 13 Nov 2026):**

| | Kushi (local, on your laptop) | Live site (Vercel) |
|---|---|---|
| Database | **Your own** free Supabase project | Urja's Supabase project |
| Nexconn (chat) | **Your own** Nexconn app | Urja's Nexconn app |
| Code | Same GitHub repo, branch `main` | Deploys automatically from `main` |

Your tests, demo data and chat messages never touch the live site. Only your **code** reaches it, through GitHub.

> **Never paste secrets** (database password, Nexconn App Secret, `JWT_SECRET`, VAPID private key) into chat, Claude, commits or issues. They only go in `server/.env`, which Git ignores.

---

## Part A: Urja does this once

1. **Add Kushi to the GitHub repo.** On https://github.com/Urjagajera/CourtCall, go to **Settings → Collaborators → Add people**, enter Kushi's GitHub username, and invite her.
2. **Nothing to do on Vercel.** The repo is public, so Kushi's pushes to `main` deploy automatically. Kushi does not need a Vercel account or access.
3. **Do not send Kushi the live `server/.env`.** She creates her own (Part B).

---

## Part B: Kushi's first-time setup (about 45 minutes)

### B1. Install the tools

1. **Node.js 22 LTS**: https://nodejs.org → download **LTS** → install with the default options.
2. **Git for Windows**: https://git-scm.com/download/win → install with the default options.
3. **Claude Code** (if not installed yet): follow https://claude.com/claude-code.
4. Open **PowerShell** (Start menu → type `PowerShell`) and check:

```bash
node -v
```

It must print `v20.19` or newer (`v22.x` is ideal).

```bash
git --version
```

### B2. GitHub account and invite

1. If you don't have one, create an account at https://github.com.
2. Open the invite email from GitHub (or https://github.com/notifications) and click **Accept invitation**.
3. In GitHub, go to **Settings → Emails** and note your **primary, verified** email.
4. Tell Git who you are. Use **exactly** that GitHub email, otherwise GitHub (and Vercel) can't link your commits to you:

```bash
git config --global user.name "Kushi"
```

```bash
git config --global user.email "your-github-email@example.com"
```

### B3. Get the code

Pick a folder for projects (for example `D:\projects`), then:

```bash
cd D:\projects
```

```bash
git clone https://github.com/Urjagajera/CourtCall.git
```

```bash
cd CourtCall
```

The first time you push, Git opens a browser window to sign in to GitHub. Sign in with the account that accepted the invite.

### B4. Install all packages

```bash
npm run setup
```

This installs the root, `server` and `client` packages. It takes a few minutes.

### B5. Create your own Supabase database

1. Go to https://supabase.com and sign in (GitHub sign-in is fine).
2. Click **New project**. Name it `courtcall-kushi`.
3. Set a **database password** and save it somewhere safe. Use only letters and numbers (special characters like `@ # %` break the connection string).
4. **Region**: choose **South Asia (Mumbai)**, the closest to you. It only affects your laptop; the live site has its own database.
5. Wait until the project is ready. Click **Connect** (top of the dashboard) → **Transaction pooler**. Copy the connection string. It contains port **6543**. Replace `[YOUR-PASSWORD]` in it with your password.

### B6. Create your own Nexconn app

1. Go to https://console.nexconn.ai and sign up / sign in.
2. Create a new app (name it `courtcall-kushi`).
3. Open the app's **Key Management** page and copy the **App Key** and **App Secret**.
4. Note which **data center** the app is in. If it is Singapore, the Server API address is `https://api.sg-light-api.com` (already the default). If the console shows a different data center, copy the Server API address it shows for your app.

### B7. Create your `server/.env` file

```bash
Copy-Item server\.env.example server\.env
```

Generate a JWT secret (copy the line it prints):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Generate Web Push keys (copy both keys it prints):

```bash
cd server; npx web-push generate-vapid-keys; cd ..
```

Open `server\.env` in VS Code or Notepad and fill it in:

| Line | What to put |
|---|---|
| `PORT` | Leave `4000` |
| `CLIENT_ORIGIN` | Leave `http://localhost:5173` |
| `DATABASE_URL` | Your Supabase **Transaction pooler** string from B5, password filled in |
| `JWT_SECRET` | The random string you generated |
| `NEXCONN_APP_KEY` / `NEXCONN_APP_SECRET` | From B6 |
| `NEXCONN_API_BASE` | Leave `https://api.sg-light-api.com` unless B6 showed another address |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | The two keys you generated |
| `VAPID_SUBJECT` | `mailto:` followed by your email |
| `DEMO_LOGIN` | Leave `true` |

Save the file. Never commit it (it's already ignored by Git).

### B8. Create the tables in your database

```bash
npm --prefix server run db:migrate
```

Check it. It should print a number of tables and their names (including `cases`, `notifications`):

```bash
npm --prefix server run db:check
```

### B9. Check your Nexconn keys

It should print `OK: Nexconn reachable ...`:

```bash
npm --prefix server run nexconn:check
```

### B10. Add demo data

```bash
npm --prefix server run seed:demo
```

This creates the two demo firms (Mehta & Associates, Desai Law Chambers), their people, clients and today's cases in **your** database.

### B11. Run it

```bash
npm run dev
```

- Website: **http://localhost:5173** (open this)
- API health check: http://localhost:4000/api/health (should show `"db":"connected","nexconn":"configured"`)

Open the website, click **Sign in**, and tap any **Try a demo account** button. Stop everything with **Ctrl + C**.

Setup is done. 🎉

---

## Part C: Every working day

### C1. Before you start

```bash
git pull --rebase
```

If someone added packages or migrations since your last pull:

```bash
npm run setup
```

```bash
npm --prefix server run db:migrate
```

Demo cases are dated "today". To move them to today's date in your database:

```bash
npm --prefix server run seed:demo
```

Tell Urja which feature you're working on, so you don't both edit the same files.

### C2. Working with Claude

- Start Claude Code inside the `CourtCall` folder. It reads **CLAUDE.md** automatically: the project's rules, decisions, roles and status. Ask your Claude to keep CLAUDE.md updated when it finishes something.
- Don't paste secrets into Claude. If Claude needs a value from `.env`, it can read the file itself.

### C3. Before every push (checks)

Run these from the project root. Each must finish without errors:

```bash
cd client; npx tsc -b; cd ..
```

```bash
cd server; npx tsc --noEmit; cd ..
```

```bash
npm test
```

For changes to the API, also run the end-to-end test against **your** database (keep `npm run dev` running in another window):

```bash
npm --prefix server run smoke
```

```bash
npm --prefix server run smoke:cleanup
```

Also look at the change in the browser at phone size (375 px wide) and laptop size.

### C4. Pushing your work

**Check first whether your change adds a database migration**, meaning a new file in `server/drizzle/` (for example `server/drizzle/0013_something.sql`):

```bash
git status
```

**If there is NO new file in `server/drizzle/`** (most changes), commit and push to `main`:

```bash
git add -A
```

```bash
git commit -m "What you changed, in a plain sentence"
```

```bash
git pull --rebase
```

```bash
git push
```

Vercel deploys it automatically in 1–2 minutes. Then check https://courtcall-kappa.vercel.app/api/health and try your change on the live site.

**If there IS a new file in `server/drizzle/`** (a database change), do **not** push to `main`. The live database must get the change first, or the live site breaks until it does:

1. Push to a branch instead (use a short name):

```bash
git push origin HEAD:kushi-feature-name
```

2. Message Urja: "Branch `kushi-feature-name` has a migration."
3. **Urja** then runs, on her laptop (her `server/.env` points to the live database):

```bash
git fetch
```

```bash
git checkout kushi-feature-name
```

```bash
npm --prefix server run db:migrate
```

```bash
git checkout main
```

```bash
git pull --rebase
```

```bash
git merge kushi-feature-name
```

```bash
git push
```

The live database is updated first, then the code goes live.

### C5. Database change rules

- Change `server/src/db/schema.ts`, then `npm --prefix server run db:generate -- --name what-it-does`, read the SQL it creates, then `npm --prefix server run db:migrate` (on your database).
- **Only one person creates migrations at a time.** Migrations are numbered (`0013_…`, `0014_…`). If you and Urja both create one, the numbers clash. Tell Urja before you run `db:generate`.
- Never edit a migration file that has already been applied. Add a new one instead.
- Prefer changes that only **add** things (new tables, new columns). They never break the live site.

### C6. Things only Urja does on the live site

- Applying migrations to the live database (C4).
- Resetting the live demo data each morning: `npm --prefix server run seed:demo` with the live `server/.env`.
- Vercel settings and environment variables.
- Undoing a bad deploy (Vercel → **Deployments** → previous deployment → **Promote**, or `git revert` the commit and push).

---

## Part D: If something goes wrong

| Problem | Fix |
|---|---|
| `db:migrate` or `db:check` fails to connect | Check `DATABASE_URL`: it must be the **Transaction pooler** string (port **6543**) with your real password. Avoid special characters in the password (reset it in Supabase → **Project Settings → Database**). |
| `nexconn:check` fails | Check the App Key / Secret (no spaces). If your Nexconn app isn't in Singapore, set `NEXCONN_API_BASE` to the address your Nexconn console shows. |
| No **Try a demo account** buttons | `DEMO_LOGIN=true` in `server/.env`, and run `seed:demo`. Restart `npm run dev`. |
| `npm run dev` says a port is in use | Another copy is still running. Close the other terminal, or restart the computer. |
| Health shows `"nexconn":"not configured"` | The Nexconn lines in `server/.env` are empty. Fill them and restart. |
| `git push` rejected | Run `git pull --rebase`, fix any conflicts with Claude, then push again. |
| You pushed, but the live site didn't change | Ask Urja to check Vercel → **Deployments**. A common cause: your Git email doesn't match your GitHub account (B2). |
| The live site broke after your push | Tell Urja right away. She can promote the previous deployment in Vercel in one click. |
| Local database suddenly very slow | Free Supabase projects slow down after very heavy use (for example running the smoke test many times in a row). Wait an hour; check Supabase → **Reports**. |

---

## Part E: Prompt for Kushi's Claude

Paste this as the **first message** every time you start a new Claude Code session in the `CourtCall` folder:

````text
You are working on CourtCall with Kushi, on her Windows laptop. Before doing anything, read CLAUDE.md and step.md in this repo completely. They hold the project's rules and decisions; follow them exactly.

HOW THIS LAPTOP IS SET UP
- server/.env points to Kushi's OWN Supabase database and her OWN Nexconn app. The live site (https://courtcall-kappa.vercel.app) uses Urja's database and Nexconn app. Never ask for, accept or use the live database URL or live keys.
- Run the project: `npm run dev` from the repo root (website http://localhost:5173, API http://localhost:4000, health http://localhost:4000/api/health). After pulling: `npm run setup` and `npm --prefix server run db:migrate`. New day: `npm --prefix server run seed:demo`.
- It's Windows: use PowerShell or Git Bash syntax that works on Windows.

AT THE START OF EVERY SESSION
1. Run `git status` and `git pull --rebase`. If there are uncommitted changes you didn't make, stop and ask Kushi.
2. Ask Kushi which feature she wants to work on, and remind her to tell Urja so they don't edit the same files.
3. Check the API is healthy (start `npm run dev` if needed).

RULES YOU MUST FOLLOW (from CLAUDE.md)
- Decisions made by Urja are fixed unless Kushi says Urja agreed to change them. These include: case teams (main lawyer / helping junior / one staff helper, who can assign what), per-case visibility, only senior lawyers can be firm admins, no Bar Council number, no family links, client links need a case number, the hearing outcome flow, and the "Nexconn Chat SDK and Call SDK are the backbone" rule. If a request conflicts with one of them, explain the conflict and ask; don't assume.
- If anything in a request is unclear, ask Kushi before building. Don't invent features.
- Enforce permissions on the server, not only in the UI.
- Never predict hearing times; only show reported progress.
- Follow design.md and the colour tokens in client/src/index.css; check every screen at 375 px (phone) and laptop width.
- Add guided-tour steps (client/src/lib/tourSteps.ts) for any major new screen, and keep GUIDE.md, README.md and CLAUDE.md up to date in the same commit.
- Copy: short plain sentences, no "please", no "successfully".
- Commit messages: one plain human sentence. NO AI attribution lines (no "Co-Authored-By", no "Generated with").

BEFORE EVERY COMMIT (all must pass; show Kushi the results)
1. `cd client; npx tsc -b; cd ..`
2. `cd server; npx tsc --noEmit; cd ..`
3. `npm test`
4. If the API changed: `npm --prefix server run smoke`, then `npm --prefix server run smoke:cleanup` (this uses Kushi's own database; don't run it many times in a row, free Supabase slows down). Add smoke checks for new API rules.
5. Look at the change in a browser at phone and laptop width.
If something fails, fix it or tell Kushi exactly what failed. Never skip a check or say it passed when it didn't.

PUSHING
- First `git pull --rebase`, then check `git status`.
- If the change has NO new file in server/drizzle/: commit and `git push` to main. Vercel deploys in 1–2 minutes. Then open https://courtcall-kappa.vercel.app/api/health and tell Kushi to try the change on the live site.
- If the change HAS a new file in server/drizzle/ (a database migration): NEVER push it to main. Push to a branch: `git push origin HEAD:kushi-<short-name>`. Then write the MIGRATION REQUEST below for Kushi to send to Urja.

DATABASE CHANGES
- Before running `npm --prefix server run db:generate -- --name <what>`, ask Kushi to confirm with Urja that nobody else is creating a migration (migration numbers must not clash).
- Prefer additive changes (new tables, new nullable columns or columns with defaults). If something must be removed or renamed, stop and explain to Kushi: it needs two steps (code first, then a later migration), and Urja decides.
- Read the generated SQL and show it to Kushi. Never edit a migration that was already applied anywhere. Apply it only to Kushi's database (`npm --prefix server run db:migrate`).

MIGRATION REQUEST (write this for Kushi to send to Urja)
  Branch: kushi-<short-name>
  Migration file(s): server/drizzle/00xx_<name>.sql
  What it does: <plain sentence per statement>
  Safe for the live site before the code arrives? <yes: only adds things / no: explain>
  Code that depends on it: <files / features>
  Checks run: client tsc ✓, server tsc ✓, npm test ✓, smoke N passed ✓, browser ✓

NEVER DO
- Never push a migration to main, run migrations or seed/smoke against the live database, or change Vercel settings, vercel.json or api/index.js without Urja.
- Never force-push, rewrite history, or delete branches.
- Never commit server/.env or print secrets; never paste secrets into chat.
- Never edit an applied migration.
- Never change a decision listed in CLAUDE.md on your own.
- Never claim something works without having run it.

AT THE END OF EACH TASK
Tell Kushi in plain words: what changed, what was checked (with results), what was pushed and where (main or branch), and anything still to do, including any MIGRATION REQUEST to send to Urja.
````

---

## Part F: Prompt for Urja's Claude (handling Kushi's migration request)

When Kushi sends a migration request, paste this into **your** Claude Code (in your `CourtCall` folder, whose `server/.env` points to the **live** database), followed by Kushi's request:

````text
Kushi sent a MIGRATION REQUEST (below). My server/.env points to the LIVE database used by https://courtcall-kappa.vercel.app. Follow CLAUDE.md and step.md, and do this carefully, in order. Stop and ask me before any step that changes the live database or main.

1. `git status` (must be clean), `git fetch`, then `git checkout <branch>` and `git pull`.
2. Review the branch against main (`git diff main...HEAD`): summarise what changed and flag anything that breaks a rule in CLAUDE.md.
3. Migrations:
   - List the new files in server/drizzle/. Check their numbers don't clash with main (no two migrations with the same number; server/drizzle/meta/_journal.json must be consistent). If they clash, stop and explain how to fix it.
   - Read every SQL statement and tell me in plain words what it does. Is it additive (safe while the old code is live)? If it drops or renames anything, STOP: it must be split into two steps (code first, drop later) and I decide.
4. Run the checks on the branch: client `npx tsc -b`, server `npx tsc --noEmit`, `npm test`. Do NOT run seed:demo or the smoke test (they would write to the live database).
5. Show me the exact command and ask for my OK, then apply the migration to the live database: `npm --prefix server run db:migrate`. Then confirm with `npm --prefix server run db:check` that the new tables/columns exist.
6. Check the live site still works BEFORE merging: https://courtcall-kappa.vercel.app/api/health must show "db":"connected".
7. Merge: `git checkout main`, `git pull --rebase`, `git merge <branch>`, run the client and server type checks again, then `git push`. No AI attribution lines in any commit message.
8. After Vercel deploys (1–2 minutes): check /api/health again and try the feature on the live site.
9. Report to me in plain words: what was migrated, check results, live health, and a short message I can send Kushi ("merged and live" or what she needs to fix).

If any step fails, stop, don't continue to the next one, and tell me what happened.

KUSHI'S REQUEST:
<paste it here>
````
