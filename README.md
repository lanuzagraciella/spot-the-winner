# Spot the Winner (folder: beat-the-algorithm)

Smart Funnels' lead-capture game for the Affiliate Grand Slam Rome booth (2–5 November 2026).

**"How many winning landing pages can you spot?"** Visitors register (full name, work email,
store URL, optional phone), then pick the page that converted more in 10 A/B pairs drawn from
15. No reveal during the game: the score, time, rank and "Review my answers" come at the end.
Players then share their own QR code to unlock mystery rewards.

## Where sign-ups go

Every sign-up is a row in the **Players** tab of the Google Sheet the Apps Script is attached
to (`apps-script/Code.gs`). The game sends to the web-app URL in `config.js`
(`SHEET_ENDPOINT`).

| Tab | What it holds |
|---|---|
| **Players** | One row per game: sign-up time, name, email, store, phone, consents, QR code, referred by, device, welcome-email status, then score, time, questions, answers and `eligible` once the game is finished |
| **Ranked** | The winners list: eligible games only, most correct first, then fastest, then earliest |
| **Scans** | Every friend scan of a player's QR, with whether it counted |
| **Events** | Page views and QR-screen opens (for the funnel in the report) |

Tabs from the earlier version (Leads, Draw) are left as they were; the new script doesn't use
them.

What the script checks:
- Required fields, a valid email, privacy consent, and the closing time (`CLOSE_AT`).
- **Re-scores** every game from the answers against its own answer key; the phone's score is
  never trusted.
- Only the **first finished game per email + store** is `eligible`; replays are kept but don't
  rank.
- A QR scan counts once per device, never from the owner's own device or from a device that
  signed up with the owner's email or store.
- Text that starts with `= + - @` is cleaned so it can't run as a formula in the Sheet.

## Welcome email

Right after someone signs up, the script emails them from the Google account that owns the
script (sender name "Smart Funnels"). The email:
- confirms they're in, and explains how to win (most correct, then fastest; top 3 win)
- links to their personal game link with their QR code (`GAME_URL?ref=CODE`)
- mentions the QR rewards at 2, 5 and 10 scans
- ends with the company line

It's sent once per email + store (not again for replays). The result is written to the
`welcome_email` column (`sent`, `returning player`, or `failed: …` with the reason).

Settings at the top of `Code.gs`: `SEND_WELCOME_EMAIL`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`,
`GAME_URL`, `DISCOUNT_CODE`, `COMPANY_LINE`.

**Daily limit:** about 100 emails a day from a free Gmail account, about 1,500 from Google
Workspace. For the booth, run the script from a Workspace account (e.g. a smart-funnels.org
address). If the limit is reached, the sign-up is still saved; only the email is skipped.

## Updating the script (keeps the same URL)

1. Open the Sheet → **Extensions → Apps Script**. Replace everything in `Code.gs` with
   `apps-script/Code.gs` from this repo and **Save**.
2. Pick **setup** in the function menu → **Run**. Approve the permissions: it now also asks to
   **send email as you**. This creates the Players, Ranked, Scans and Events tabs.
3. **Deploy → Manage deployments** → pencil icon → Version: **New version** → **Deploy**.
   The URL stays the same, so `config.js` doesn't change. (Use "Execute as: Me", "Who has
   access: Anyone".)
4. Optional: run **sendTestEmail** to get the welcome email in your own inbox.

## Testing

- Play once on the live site with your own email, then check the Players tab and your inbox.
- `#reset` at the end of the URL makes the device a first-time visitor again (unsent data is
  kept). Delete test rows from the Sheet before the event.
- Leave `SHEET_ENDPOINT` empty for **demo mode**: nothing is sent; leaderboard, report and QR
  scans show example data, with a "Simulate a friend's scan" button and a sample-details link.

## Devices

One URL, three layouts: phone (main case), iPad, desktop. On phones a tap opens a page full
screen before choosing; on iPad/desktop the two pages sit side by side and scroll in place.
Keyboard: <kbd>1</kbd>/<kbd>2</kbd>.

**Booth iPad (kiosk mode):** `?kiosk=1` or `KIOSK: true`. Nothing is remembered on the device,
"Next player" resets the game, and it resets itself when idle.

Venue Wi-Fi: sign-ups and results are queued on the phone and retried every 10 s and when the
connection comes back, so nothing is lost offline.

## Game details

- **15 pairs** in `pages.js` (fictional brands, designed mockups), 10 per game in random order,
  random left/right side. Answers live in `ANSWER_KEY` in `Code.gs` and in `pages.js`.
  Pairs p09–p15 are marked `provisional` until real test results are confirmed.
- **Timer** counts time spent choosing; it decides ties. **Music** is generated in the browser
  (mute button in the header; `MUSIC_SRC` for a licensed track).
- **Winners:** most correct answers out of 10, then fastest time, then earliest finish (Ranked
  tab). 1st: iPad + free trial; 2nd and 3rd: prize + 1-month free trial.
- **QR rewards:** 2, 5 and 10 verified scans. The 2-scan reward shows the code `AGS-ROME`.
- **Report:** players today, average score, leaderboard (first name + initial and store, never
  emails), funnel (landed → registered → finished → shared), score distribution, hardest pairs.

## Files

| File | What |
|---|---|
| `index.html` | Screens: sign-up, quiz, result, QR rewards, report, rules |
| `styles.css` | Poster design: green-to-black gradient, `#34E0A1` accent, Space Grotesk / Inter |
| `app.js` | Game, timer, send queue, leaderboard, QR rewards |
| `pages.js` | The 15 landing-page pairs |
| `sound.js` | Generated background music and cues |
| `config.js` | Event settings and the Sheet URL |
| `apps-script/Code.gs` | Google Sheet backend and welcome email |

## Vercel

Import `smartfunnels/games`, Root Directory `beat-the-algorithm`, Framework preset **Other**,
no build command. Set `GAME_URL` in `config.js` and `Code.gs` to the final address.

## Open items

- Real results for pairs p09–p15 (or drop them).
- 2nd/3rd prizes, final URL/QR (`GAME_URL`), privacy-policy URL (`PRIVACY_URL`).
- Score and reward emails (only the welcome email is built).
- Han signs off the copy before launch.
