# CourtCall guide: install and use

CourtCall shows **how far the court has reached**, live. Junior lawyers in the courtroom report progress with one tap, and every client is alerted about their own case. No more "has my case come up?" calls.

**Open CourtCall:** https://courtcall-kappa.vercel.app

> CourtCall shows the latest progress **reported** by verified lawyers in the courtroom. It never predicts hearing times.

---

## 1. Install the app on your phone

CourtCall runs in the browser, so there's nothing to download from a store. Installing it puts a CourtCall icon on your home screen. It then opens full screen like any other app, and phone alerts work best.

### Android (Chrome)

1. Open **https://courtcall-kappa.vercel.app** in **Chrome**.
2. Open Chrome's **⋮** menu and tap **Install app** (on some phones it says **Add to Home screen**).
3. Tap **Install**. The CourtCall icon appears on your home screen and in your app drawer.
4. Open CourtCall from the icon. It opens straight to your dashboard, or to your case if you're a client.

### iPhone (Safari)

1. Open the link in **Safari** (not Chrome).
2. Tap **Share** (the square with an arrow), then **Add to Home Screen**, then **Add**.
3. Open CourtCall from the new icon. On iPhone, phone alerts work only from the installed icon (iOS 16.4 or newer).

### Laptop or desktop

Open the link in Chrome or Edge and click the **install** icon at the right of the address bar. Or just use it in a browser tab: everything works the same.

---

## 2. Try it in one minute (demo)

1. Open the site and tap **Sign in**.
2. Under **Try a demo account**, tap any role. No password is needed:

| Demo button | Who | What to try |
|---|---|---|
| Firm admin (senior lawyer) | Adv. Rakesh Mehta, Mehta & Associates | Today's courtrooms, cases, clients, the **Team** page |
| Senior lawyer | Adv. Anil Shah | The same firm, without admin rights |
| Junior lawyer | Priya Shah | Report live progress in Court 4 |
| Office staff | Neha Parikh | Cases and clients; courtrooms read-only |
| Senior lawyer / Junior (2nd office) | Desai Law Chambers | The **same Court 4**, with private data of another firm |
| Client | Ramesh Patel | His own case page, alerts and chat with the firm |

**Best demo:** open **Junior lawyer** in one window and **Client** in a private/incognito window. Report "Now hearing" in Court 4 and watch the client's page update and alert.

The first time each person signs in, a **guided tour** points out every feature. You can replay it anytime: **Settings → Take the tour again**.

---

## 3. Set up your firm (for the senior lawyer who starts it)

1. Tap **Get started → Create a firm**. Enter your name, email, mobile, a password and your firm's name.
2. You can start straight away: you're the **firm admin**.
3. As firm admin, Open **Team** to find your firm's **6-character invite code**.
4. Send the code to your lawyers, juniors and office staff.

### People joining a firm

1. They tap **Get started → Join a firm**, choose **Senior lawyer**, **Junior lawyer** or **Office staff**, and enter the invite code.
2. A firm admin approves them on **Team → Waiting for your approval**.

### What each role can do

| Role | Can do |
|---|---|
| **Firm admin** (senior lawyers only) | Everything a senior lawyer can do, plus manage the firm on **Team**: approve or decline people, change roles, make other senior lawyers firm admins (never juniors or office staff), deactivate people who leave, make a new invite code, and change **Firm settings** (stale time for courtrooms, WhatsApp country code) |
| **Senior lawyer** | Clients, cases, courtrooms (join and report), team chat, private chat with clients |
| **Junior lawyer** | Join courtrooms, report progress, courtroom chat, team chat |
| **Office staff** | Clients, cases, team chat, client chat; see today's courtrooms (read-only) |

Your firm's clients and cases are **never** visible to other firms. Only courtroom progress is shared.

### Case teams: who works on and sees each case

Every case has a **team**:
- **Main lawyer**: a senior lawyer or a junior lawyer. They run the case.
- **Helping junior** (optional): only when the main lawyer is a senior.
- **Staff helper** (optional): one office staff member who helps on the case.

Who decides:
- The **firm admin** sets everything: any senior (or themselves) or a junior as main lawyer, the helping junior and the staff helper.
- A **senior lawyer** who adds a case is its main lawyer. On cases they lead they choose the helping junior and staff helper (**Case team → Edit team** on the case page), but only the firm admin can change the main lawyer.
- **Juniors and staff** can't assign anyone. Staff and juniors can't add cases or clients.

Who sees what:
- **Firm admins** see every case and client in the firm.
- **Everyone else** sees only the cases they are on, plus those clients, their chats and their WhatsApp links. A junior who isn't on a case doesn't see it.
- Case details and hearing outcomes are changed by the **main lawyer** or a **firm admin**. Helpers see everything on the case but can't change it.
- The client can chat only with the people on their cases and the firm admins.

### Updates and badges

- When something changes on a case you are on (you are added or removed, the date, item, court or case number changes, a hearing is recorded or its notes edited), it appears under **Updates** at the top of **Today** and as a **number on Cases** in the menu. The person who made the change isn't notified.
- After a hearing, its **main lawyer** and the **firm admins** get it as a to-do ("Hearings to update", also counted on Cases). When one of them records it, the to-do disappears for everyone and the others get a "changes were made" update.
- **Chat** in the menu shows how many messages you haven't read yet.
- Opening a case marks its updates as read; **Mark all read** clears the list.

### Alerts when your client's turn comes

If you are on a case (main lawyer, helping junior or staff helper) or a firm admin, CourtCall tells you when:
- your client's case is **2 away** ("be ready"),
- it is **being heard**,
- the hearing is **over** (the court moved past it, adjourned it, rose or isn't sitting). Tap **Update** to open the case with the hearing form ready: next date, what happened, notes.

You see these as a **pop-up** anywhere in CourtCall. To get them on your **phone** as well, go to **Settings → Phone alerts → Turn on** and allow notifications (on iPhone, add CourtCall to the Home Screen first). Turn it off there any time. If you reported the update yourself, you only get the "over" alert.

---

## 4. Every court day

### Lawyers and staff: prepare the day

1. **Clients → Add client:** name, WhatsApp number and alert language.
2. **Cases → Add case:** client, case number, court complex (e.g. "Gujarat High Court"), court number, next hearing date, item number from the cause list (or later, when it's out), and the case team (firm admins pick the main lawyer; a senior who adds a case leads it).
3. **Share the case with the client:** on **Cases**, tap the **link icon** on the case, then **Client link → Share on WhatsApp**. The message and link are filled in for you.
   - The link **locks to the first phone that opens it**, so don't open it yourself.
   - Lost or new phone? Tap **New link**. To stop a link at once, tap **Turn off**.

### Hearing-day briefing and calls

- On a case page, **Hearing-day briefing**: choose the **Appearing lawyer** (a senior lawyer) and write a **Remember** note for the client (for example "Bring your Aadhaar card and reach court by 10:30"). You can also set both when you record the next date after a hearing.
- On the hearing day between **9 and 10 AM**, the client gets a **"CourtCall is calling"** voice message in their language: court, item number, who appears for them, and your note (translated automatically). The note is then cleared for the next hearing.
- The main lawyer or a firm admin can tap **Send briefing now** on the hearing day (once a day). The case page shows when it was sent.
- **Voice calls inside CourtCall** (Nexconn): **Call** in any one-to-one chat, **Call client** on a case page. The client can tap **Call my lawyer**. Calls ring on the other person's open CourtCall page.

### After every hearing: record what happened

When a hearing is over (the date has passed, or the court has risen or moved past the item), the people who look after that client see **"Hearings to update"** on **Today** and **Cases**.
1. Tap **Update**.
2. Choose **Next date given** (pick the date; the item number can be added later when the cause list is out; tick if the court or room changes) or **Case ended**.
3. Write **What happened in court**. Leave **Show this to the client** ticked to share it on their page.
4. Write **To prepare for the next hearing**: only your firm sees this.
5. Save. The case moves to the next date and the client's page shows it.

### Case, client and calendar pages

- **Tap a case** (Cases, Calendar, a client's page): case number, court, next date and item, the case team (main lawyer, helping junior, staff helper; **Edit team** if you may), client link status, and every past hearing with its notes (edit notes with the pencil).
- **Tap a client** (Clients): phone, alert language, and their cases you are on (firm admins: all) with each case’s main lawyer. Seniors and firm admins can **Add case** from there.
- **Calendar**: a month view of every hearing. Dots: maroon = upcoming, taupe = held, amber = still to update. Tap a day to list its hearings.
- A **case number** is required before a client link can be shared, so the client always sees complete details.

### Juniors: report from the courtroom

1. Open **Today**. Courtrooms where you have a case (as main lawyer or helping junior) appear automatically. To cover another room, tap **Join courtroom**.
2. Tap a courtroom card to open the room.
3. The big button already shows the **next item**. When the judge calls it, tap **Now hearing: Item N**. Use **−1 / +1** or type a number if the court jumps.
4. Other buttons: **Passed over**, **Adjourned**, **Recalled** (pick from passed-over items), **Break / Resume**, **Not sitting**, **Court risen**.
5. Made a mistake? Tap **Undo** within 10 seconds.
6. Jumping more than 5 items, or going backwards, asks you to confirm.
7. If someone else reported a moment before you, CourtCall says so and shows the latest progress. Nothing is overwritten.

Juniors from **different firms** in the same courtroom see and update the **same progress**. Use **Room chat** to coordinate.

### Everyone: chat inside the firm

Open **Chat**:
- **Team room** (at the top): one room for everyone in the firm.
- **Lawyers** tab: a private chat with each colleague, senior lawyers first, then junior lawyers. The firm admin is marked.
- **Staff** tab: office staff.
- **Clients** tab (senior lawyers and staff): a private chat with each client you look after (firm admins: every client).
- **Voice typing:** tap the **mic** next to the message box and speak. The words appear in the box so you can check them before tapping Send. The **EN / हिं / ગુ** button next to the mic picks the language you speak.
- Use the search box to find someone. A dot on a tab means unread messages there.

### Lawyers: watch from anywhere

**Today** shows every courtroom your firm has cases in: the latest item, the status (hearing, break, stale) and how far each case is ("3 away"). Cards update on their own.

---

## 5. For clients

1. Your lawyer sends you a link on WhatsApp. **Tap it.** There's no app to download, no password and no code.
2. CourtCall opens with the same layout lawyers use: a menu on the left on a laptop, tabs at the bottom on a phone, and **Settings** (the gear at the top on a phone).
   - **My case**: **Now** (the item the court is hearing), **Your item** (your number on today's list), how many cases are before yours, when it was last reported, the next hearing date and the latest updates.
   - **Your cases**: all your cases with this firm (today, upcoming and past). Tap one to open it.
   - **History**: earlier court days: alerts, the next date your lawyer set, and their note on what happened (if they shared it).
   - **Chat**: message the people at the firm who look after you. Type, or tap the **mic** and speak (in your page language). Tap **Call my lawyer** for a voice call inside CourtCall.
   - **Hearing-day briefing**: on the morning of your hearing, CourtCall "calls" you: tap **Answer** to hear your court, item number and your lawyer's message in your language. It stays on **My case** under **Today's briefing** (tap **Listen** to hear it again).
   - **Settings**: language (English, हिन्दी, ગુજરાતી; your alerts switch too), **Get alerts on this phone**, light or dark, **Take the tour again**, and **Sign out**.
3. In **Settings**, tap **Turn on** under **Get alerts on this phone** to get notifications.
4. Install it (section 1) so it opens from your home screen next time.
5. The guided tour runs on your first visit. **Sign out** removes your case and alerts from this phone; to come back, open the WhatsApp link again.

The link works on **your phone only**. If you change phones, ask your lawyer for a new link.

### Alerts you'll get

- When the court starts, if your case is still far away
- When your case is **10**, **5** and **2** cases away
- When your case is **being heard**, **passed over**, **recalled** or **adjourned**
- If the court takes a break, is not sitting, or rises for the day

Each alert comes once. You'll never get a guessed time.

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| Everything looks tiny on your phone, with cards side by side | Chrome is showing the **desktop site**. In Chrome tap **⋮** and untick **Desktop site**. For the installed app: Chrome → **⋮ → Settings → Site settings → Desktop site** → off, then reopen CourtCall. |
| "This link is already in use on another phone" | The link opened on a different phone first. Ask your lawyer for a **New link**. |
| "This link was turned off" | Your lawyer turned it off. Ask for a new one. |
| No **Install app** option on Android | Use Chrome (not an in-app browser such as WhatsApp's). Open the link, tap **⋮ → Open in Chrome**, then install. |
| No alerts | Tap **Turn on** on your case page and allow notifications. On iPhone, install it to the home screen first. Check that the phone isn't in battery saver. |
| "Awaiting approval" | Your firm admin approves you on **Team**. Firm founders never wait. |
| A client or case is missing from your list | You only see cases you are on. Ask the firm admin (or the case's senior main lawyer) to add you to the case team. |
| Mic button missing or "Microphone is blocked" | Voice typing works in Chrome, Edge and Safari (not Firefox). Allow the microphone for this site in the browser settings. |
| Progress says "may be out of date" | Nobody has reported for 20 minutes. Ask the junior in court, or check again soon. |
| Red dot next to your name | Chat is reconnecting. Courtroom updates still work. |
| "You're offline" | CourtCall needs internet for live progress. Reconnect and tap **Try again**. |

---

## 7. For developers

- **Run it on your computer:** README.md, Part 1 (first-time setup) and Part 2 (every day).
- **Deploy (free, Vercel):** README.md, Part 4.
- **Project context, decisions and roadmap:** CLAUDE.md.
- Source code: https://github.com/Urjagajera/CourtCall
