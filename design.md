# CourtCall Design System

Every screen in CourtCall follows this file. Colors, fonts, spacing and components should come from the tokens below, never from one-off hex values.

## 1. The 50 / 35 / 15 rule

| Share | Role | Light | Dark | Used for |
|---|---|---|---|---|
Theme: **Indigo Ink**. It is calm and trustworthy, and its accent never looks like a courtroom status (green, amber or red).

| Share | Role | Light | Dark | Used for |
|---|---|---|---|---|
| **50%** | Base | Indigo mist `#E4E7F5` | Midnight indigo `#11142A` | Page background behind everything |
| **35%** | Surface | Near-white `#FAFAFE` | Deep indigo `#1B1F3A` | Cards, sheets, nav bars, inputs, lists, chat bubbles |
| **15%** | Accent | Indigo `#3B4CCA` | Soft indigo `#8C9BFF` | Primary buttons, active tab, the client's own item number, unread badges, focus rings |

How to check a screen: squint at it. It should read as a soft misty background with white panels on top and a few indigo highlights. If indigo covers more than one main button and a couple of small badges per screen, the 15% is overused.

Text is **ink `#1A1D2E`** in light mode and **`#ECEDF7`** in dark mode.

The landing page illustration may use fixed "real world" colors that are not tokens: wood (`#6B4430`, `#8A5A3B`) for the bench and gavel, skin tones, advocates' black robes and white bands, and light-indigo LED digits (`#A7B2FF`) on the dark display boards.

## 2. Color tokens

All colors are CSS variables in `client/src/index.css` and exposed to Tailwind as `bg-base`, `bg-surface`, `bg-accent`, `text-ink` and so on.

### Core

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--base` | `#E4E7F5` | `#11142A` | 50% background |
| `--base-strong` | `#CDD3EE` | `#0B0D1E` | Header strip, pressed state on base |
| `--surface` | `#FAFAFE` | `#1B1F3A` | 35% cards and panels |
| `--surface-raised` | `#FFFFFF` | `#252A4A` | Inputs, a card nested inside a card, hover |
| `--line` | `#D5D9EE` | `#323862` | Borders and dividers on surface |
| `--accent` | `#3B4CCA` | `#8C9BFF` | 15% action color |
| `--accent-strong` | `#2F3DA8` | `#A7B2FF` | Accent hover/pressed |
| `--accent-ink` | `#FFFFFF` | `#0F1230` | Text on the accent (white in light mode, dark indigo in dark mode) |
| `--ink` | `#1A1D2E` | `#ECEDF7` | Main text |
| `--ink-muted` | `#4E5470` | `#A6ABC9` | Secondary text and labels |

### Status (outside the palette, on purpose)

Courtroom events have to be told apart instantly, so they use standard status colors. Each one is a soft tint background with dark text, plus an icon and a word. Color is never the only signal.

| Status | Events | Light bg / text | Dark bg / text |
|---|---|---|---|
| `hearing` (green) | now hearing, break ended | `#DDF1E4` / `#1F6B3F` | `#1F3A2A` / `#8FDCA9` |
| `waiting` (amber) | passed over, break, recalled | `#FCEBCF` / `#8A5300` | `#3D2F14` / `#F3C673` |
| `stopped` (red) | adjourned, court not sitting, court risen | `#F9DEDC` / `#A1261E` | `#45201E` / `#F2A49E` |
| `stale` (grey) | no update for 20+ minutes | `#E4E4EA` / `#55576B` | `#30323F` / `#A9ABC4` |
| `info` (blue) | single reporter (lawyers only), neutral info | `#DCE8FB` / `#1E4F99` | `#1C2E4D` / `#A8C8F5` |

### Contrast (checked against WCAG AA)

- Ink on indigo mist: about 13:1 ✅
- Ink on near-white surface: about 16:1 ✅
- Muted ink on indigo mist: about 6:1 ✅
- White on indigo button: about 6.8:1 ✅
- Indigo button against the mist background: about 5.5:1, so buttons stand out anywhere ✅
- Dark mode: light text on midnight indigo is about 15:1, and dark-indigo text on the soft indigo button is about 7:1 ✅

## 3. Light and dark mode

- **Light is the default** for everyone. Dark mode is opt-in.
- A toggle in settings (Light / Dark / System) stores the choice in `localStorage` (`cc-theme-v2`) and sets `data-theme` on `<html>`. "System" follows the phone setting (`prefers-color-scheme`).
- The accent lightens in dark mode (`#3B4CCA` becomes `#8C9BFF`) so buttons stay bright. Its text flips from white to dark indigo to keep contrast.
- The browser `theme-color` meta tag is `#E4E7F5` in light mode and `#11142A` in dark mode, so the phone status bar blends in.

## 4. Typography

- Font: **Noto Sans**, with **Noto Sans Gujarati** and **Noto Sans Devanagari** for the Gujarati and Hindi alert templates. All three are loaded from Google Fonts with `display=swap`.
- Use tabular numbers (`font-variant-numeric: tabular-nums`) wherever item numbers appear, so numbers don't jump around as they change.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 48 / 52 | 700 | The big "current item" number on courtroom and client screens |
| `h1` | 24 / 32 | 700 | Page titles |
| `h2` | 18 / 26 | 600 | Card titles, section headers |
| `body` | 16 / 24 | 400 | Default text. Never smaller on phones |
| `label` | 14 / 20 | 500 | Form labels, metadata, timestamps |
| `caption` | 12 / 16 | 500 | Badges, helper text (sparingly) |

## 5. Shape, spacing and elevation

- **Moderately rounded:** `--radius-sm` 8px (inputs, badges), `--radius-md` 10px (buttons), `--radius-lg` 12px (cards, sheets). Pills only for small status badges.
- Spacing uses a **4px grid**. Common values: 4, 8, 12, 16, 24, 32.
- **Phone gutter:** 16px on each side. Content max-width is 480px on client and junior screens and 1200px on the lawyer dashboard.
- Elevation is mostly done with 1px `--line` borders. Shadows stay subtle: `0 1px 2px rgb(20 35 59 / 0.08)` for cards and `0 8px 24px rgb(20 35 59 / 0.16)` for sheets and dialogs. In dark mode, borders do the work instead of shadows.
- **Touch targets:** at least 44×44px everywhere, and 56px or more for junior reporting actions.

## 6. Icons

- **Lucide** outline icons (`lucide-react`), 1.75px stroke.
- Sizes: 20px inline, 24px in buttons and nav.
- Icons inherit the current text color.
- Every status always shows icon + text, for example a circle-play icon with "Now hearing".

| Meaning | Lucide icon |
|---|---|
| Now hearing | `CirclePlay` |
| Passed over | `SkipForward` |
| Recalled | `Undo2` |
| Adjourned | `CalendarX` |
| Break / break ended | `Coffee` / `Play` |
| Court not sitting / risen | `Ban` / `DoorClosed` |
| Stale | `Clock` |
| Single reporter | `UserRound` |
| Chat | `MessageCircle` |
| Courtroom | `Landmark` |

## 7. Components

**Buttons**
- **Primary:** indigo background, white text, 10px radius, 48px tall (56px in the junior UI). One primary button per screen area.
- **Secondary:** `--surface-raised` background, `--line` border, ink text.
- **Ghost:** transparent background, ink text. Used for toolbar actions.
- **Danger:** status red tint background with red text. Used for revoke link, delete, adjourn confirmation.
- **Focus:** 2px indigo outline plus a 2px offset.

**Cards:** `--surface` background, 12px radius, 16px padding, `--line` border.

**Inputs:** `--surface-raised` background, `--line` border, 8px radius, 48px tall, label above the field. The error message appears below in status red with an icon.

**Status badge:** pill shape, status tint background, icon + word, caption size.

**Item progress bar** (client and lawyer views): a horizontal track that shows the current item against the client's own item, for example "Now 12 → Yours 15". The client's own item is the only indigo marker on the screen.

**Navigation:**
- Phone: bottom tab bar on `--surface`, with the active tab marked by an indigo indicator.
- Laptop (lawyer): left sidebar on `--surface`.

**Toasts and banners:** surface card with a status-colored left border of 4px.

## 8. Junior reporting screen (built for speed)

Juniors report while standing in a courtroom, holding a phone in one hand. Every common action should take **one tap**.

1. **Top:** courtroom name, status badge, and the current item in `display` size, with "updated 2 min ago" (or "Stale" in grey).
2. **Main action:** a full-width **"Now hearing: Item 13"** indigo button (64px tall). It is pre-filled with current item + 1, which is the most likely next event.
3. **Stepper:** large **−1** and **+1** buttons on either side of the number change the pre-filled value. Tapping the number itself opens the numeric keypad for a direct jump.
4. **Secondary grid:** a 2-column grid of 56px buttons for Passed over, Recalled, Adjourned, Break / Resume, Not sitting and Court risen. Each uses its status tint.
5. **Confirmations:** moving backward or jumping more than 5 items opens a bottom sheet: "Item 30 is 17 ahead of Item 13. Confirm?" with a large Confirm button. If someone else reported in the meantime, the sheet shows the newer state and asks again.
6. **Undo:** a toast with **Undo** stays up for 10 seconds after every report. Undo sends a correction event.
7. **History:** a collapsible list of recent events below the grid, each showing the reporter's name and time.

## 9. Client screen

- Opens straight from the WhatsApp link. No login, no app chrome.
- **Hero card:** "Your case: Item 15, Court 4" with the progress bar and a big current-item number.
- The latest update is written in a full sentence, for example: "Latest reported progress: Item 12 is being heard (2 min ago)".
- The fixed disclaimer is always visible in small text: *"CourtCall shows the latest reported courtroom progress. It does not predict hearing time."*
- Indigo **Chat with lawyer** button. Family links don't show it.
- **Enable alerts** card for Web Push permission. It appears once and is easy to dismiss.

## 10. Lawyer dashboard

- **Laptop:** sidebar, then a grid of courtroom cards for today. Each card shows current item, status, freshness, and that office's cases in the room with distance (for example "Mehta: Item 15, 3 away").
- **Phone:** the same cards stacked in one column.
- The single-reporter and stale badges appear here only. Clients never see them.

## 11. Writing style

- Use plain, short sentences: "Item 12 is being heard."
- Never predict times. Avoid wording like "your case will be heard in 20 min".
- Times are relative ("2 min ago"). Tapping one shows the exact time.
- Buttons use verbs: "Report", "Send link", "Revoke link".

## 12. Accessibility

- Every color pairing meets WCAG AA. Status is always shown with icon + text, never color alone.
- Respect `prefers-reduced-motion`. Animations are 150–200ms ease-out, used only for sheets, toasts and number changes.
- All interactive elements have visible focus states and accessible labels.
- Layouts must work at 360px width with no horizontal scrolling.
