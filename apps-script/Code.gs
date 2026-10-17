/**
 * Smart Funnels · Spot the Winner (AGS Rome): Google Sheet backend.
 *
 * What it does
 *  - register: adds a player row to the Players tab and emails them a welcome email.
 *  - result:   re-scores the answers on the server and saves score + time on that row.
 *  - scan:     records a QR scan (one per device; your own scans don't count).
 *  - event:    counts page views and QR-page opens for the live report.
 *  - GET ?action=board → leaderboard, live stats and report numbers (no emails or phones).
 *  - GET ?action=qr&ref=CODE → verified scan count for a player's QR.
 *
 * Setup / update (the web-app URL stays the same):
 *  1. Extensions → Apps Script → replace all code with this file → Save.
 *  2. Run `setup()` once and approve the permissions (it now also asks to send email).
 *     It adds the Players, Ranked, Scans and Events tabs. The old Leads/Draw tabs are left alone.
 *  3. Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy.
 *  4. Optional: run `sendTestEmail()` to see the welcome email in your own inbox.
 *
 * Winners: most correct answers wins; ties go to the fastest time, then the earliest finish.
 * The Ranked tab lists eligible players in exactly that order.
 */

const SETTINGS = {
  GAME_URL: 'https://spot-the-winner.vercel.app',          // the live game address (QR codes and emails link here)
  CLOSE_AT: new Date('2026-11-05T15:00:00+01:00'),    // entries close (Rome time)
  SEND_WELCOME_EMAIL: true,
  EMAIL_FROM_NAME: 'Smart Funnels',
  EMAIL_REPLY_TO: '',                                  // e.g. 'hello@smart-funnels.org'; empty = your Google account
  COMPANY_LINE: 'Ecom Elevated Ltd (Smart Funnels) · 131 Finsbury Pavement, London, EC2A 1NT, United Kingdom',
  BRAND_URL: 'https://smart-funnels.org',              // the "Visit" button in the welcome email
  DISCOUNT_CODE: 'AGS-ROME',
  ROUNDS: 10,
};

// Winning side of each landing-page pair. Keep in sync with pages.js.
// p09–p15 are example pairs: their answers are placeholders until real results arrive.
const ANSWER_KEY = {
  p01: 'b', p02: 'b', p03: 'b', p04: 'b', p05: 'b', p06: 'b', p07: 'a', p08: 'b',
  p09: 'b', p10: 'b', p11: 'b', p12: 'b', p13: 'b', p14: 'b', p15: 'a',
};

const PLAYERS = 'Players';
const HEAD = [
  'registered_at', 'play_id', 'name', 'email', 'store', 'phone', 'consent_privacy', 'consent_marketing',
  'ref_code', 'referred_by', 'device_id', 'device', 'kiosk', 'source', 'user_agent', 'welcome_email',
  'finished_at', 'score', 'time_ms', 'questions', 'answers', 'eligible', 'report_email',
];
const C = Object.fromEntries(HEAD.map((h, i) => [h, i + 1]));

function setup() {
  const ss = SpreadsheetApp.getActive();
  const players = ss.getSheetByName(PLAYERS) || ss.insertSheet(PLAYERS);
  players.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
  players.setFrozenRows(1);

  const ranked = ss.getSheetByName('Ranked') || ss.insertSheet('Ranked');
  ranked.clear();
  ranked.getRange(1, 1, 1, 6).setValues([['rank', 'name', 'store', 'email', 'score', 'time (s)']]).setFontWeight('bold');
  // Eligible finished players: score ↓, time ↑, finish time ↑.
  ranked.getRange('B2').setFormula(
    `=IFERROR(QUERY(${PLAYERS}!A2:V, "select C, E, D, R, S/1000 where V = TRUE order by R desc, S asc, Q asc label S/1000 ''", 0), "")`
  );
  ranked.getRange('A2').setFormula('=IFERROR(SEQUENCE(COUNTA(B2:B)), "")');
  ranked.setFrozenRows(1);

  [['Scans', ['scanned_at', 'ref_code', 'device_id', 'counted']], ['Events', ['at', 'type', 'device_id', 'ref_code']]].forEach(([name, head]) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) { sh.appendRow(head); sh.getRange(1, 1, 1, head.length).setFontWeight('bold'); }
  });
  MailApp.getRemainingDailyQuota(); // asks for the send-email permission now, not on the first sign-up
}

// ---------- POST ----------
function doPost(e) {
  let p;
  try { p = JSON.parse(e.postData.contents); } catch (_) { return json({ ok: false, reason: 'bad_json' }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (p.action === 'register') return json(register(p));
    if (p.action === 'result') return json(result(p));
    if (p.action === 'scan') return json(scan(p));
    if (p.action === 'event') return json(event(p));
    if (p.action === 'report') return json(report(p));
    return json({ ok: false, reason: 'unknown_action' });
  } finally {
    lock.releaseLock();
  }
}

function register(p) {
  if (new Date() >= SETTINGS.CLOSE_AT) return { ok: false, reason: 'closed' };
  const email = String(p.email || '').trim().toLowerCase();
  const store = cleanStore(p.store);
  if (!p.play_id || !p.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !store || p.consent_privacy !== true) {
    return { ok: false, reason: 'invalid' };
  }
  const sh = sheet(PLAYERS);
  const rows = data(sh);
  if (rows.some((r) => r[C.play_id - 1] === p.play_id)) return { ok: true, duplicate: true };

  const returning = rows.some((r) => String(r[C.email - 1]).toLowerCase() === email && String(r[C.store - 1]) === store);
  const ref = refCode(email, store);
  let mail = 'off';
  if (SETTINGS.SEND_WELCOME_EMAIL && !returning) {
    try { sendWelcome(p.name, email, ref); mail = 'sent'; } catch (err) { mail = 'failed: ' + String(err).slice(0, 80); }
  } else if (returning) {
    mail = 'returning player';
  }
  sh.appendRow([
    new Date(), p.play_id, clean(p.name), email, store, "'" + String(p.phone || '').replace(/[^\d+]/g, ''),
    true, p.consent_marketing === true, ref, clean(p.referred_by), clean(p.device_id), clean(p.device),
    p.kiosk === true, clean(p.source), clean(p.user_agent), mail, '', '', '', '', '', false, '',
  ]);
  return { ok: true, ref, email: mail };
}

function result(p) {
  const sh = sheet(PLAYERS);
  const rows = data(sh);
  const idx = rows.findIndex((r) => r[C.play_id - 1] === p.play_id);
  if (idx < 0) return { ok: false, reason: 'not_registered' }; // the browser retries until the sign-up has landed
  const row = rows[idx];
  if (row[C.finished_at - 1]) return { ok: true, duplicate: true };

  const qs = (p.questions || []).slice(0, SETTINGS.ROUNDS);
  const ans = (p.answers || []).slice(0, SETTINGS.ROUNDS);
  const valid = qs.length === SETTINGS.ROUNDS && new Set(qs).size === qs.length && qs.every((q) => q in ANSWER_KEY);
  const score = qs.reduce((s, q, i) => s + (ANSWER_KEY[q] === ans[i] ? 1 : 0), 0);
  const timeMs = Math.max(0, Math.min(Number(p.time_ms) || 0, 30 * 60 * 1000));
  // Only the first finished game per email + store counts for the prize.
  const already = rows.some((r) => r[C.eligible - 1] === true &&
    String(r[C.email - 1]) === String(row[C.email - 1]) && String(r[C.store - 1]) === String(row[C.store - 1]));
  const eligible = valid && !already;
  sh.getRange(idx + 2, C.finished_at, 1, 6).setValues([[new Date(), score, timeMs, qs.join(','), ans.join(','), eligible]]);
  return { ok: true, score, eligible };
}

function scan(p) {
  const ref = clean(p.ref);
  const device = clean(p.device_id);
  if (!ref || !device) return { ok: false, reason: 'invalid' };
  const owner = data(sheet(PLAYERS)).find((r) => r[C.ref_code - 1] === ref);
  if (!owner) return { ok: false, reason: 'unknown_ref' };
  const sh = sheet('Scans');
  const seen = data(sh).some((r) => r[1] === ref && r[2] === device);
  const own = owner[C.device_id - 1] === device;
  const counted = !seen && !own;
  sh.appendRow([new Date(), ref, device, counted]);
  return { ok: true, counted };
}

function event(p) {
  const type = ['view', 'qr_open'].includes(p.type) ? p.type : null;
  if (!type) return { ok: false, reason: 'invalid' };
  sheet('Events').appendRow([new Date(), type, clean(p.device_id), clean(p.ref)]);
  return { ok: true };
}

// Emails the player their full report. Only ever goes to the email the play was registered with.
function report(p) {
  const sh = sheet(PLAYERS);
  const rows = data(sh);
  const idx = rows.findIndex((r) => r[C.play_id - 1] === p.play_id);
  if (idx < 0) return { ok: false, reason: 'not_registered' };
  const row = rows[idx];
  if (!row[C.finished_at - 1]) return { ok: false, reason: 'not_finished' }; // the browser retries
  const sent = Number(String(row[C.report_email - 1]).replace(/\D/g, '')) || 0;
  if (sent >= 3) return { ok: true, limited: true };
  let status;
  try {
    sendReport(row, board(p.play_id), verifiedScans(row[C.ref_code - 1]));
    status = 'sent ' + (sent + 1);
  } catch (err) {
    status = 'failed: ' + String(err).slice(0, 80);
  }
  sh.getRange(idx + 2, C.report_email, 1, 1).setValues([[status]]);
  return { ok: true, email: status };
}

// ---------- GET ----------
function doGet(e) {
  const q = (e && e.parameter) || {};
  if (q.action === 'qr') return json({ ok: true, scans: verifiedScans(clean(q.ref)) });
  if (q.action === 'board') return json(board(clean(q.play_id)));
  return json({ ok: true, service: 'spot-the-winner' });
}

function board(playId) {
  const rows = data(sheet(PLAYERS));
  const done = rows.filter((r) => r[C.eligible - 1] === true);
  done.sort((a, b) => b[C.score - 1] - a[C.score - 1] || a[C.time_ms - 1] - b[C.time_ms - 1] || a[C.finished_at - 1] - b[C.finished_at - 1]);
  const pub = (r, i) => ({ rank: i + 1, name: shortName(r[C.name - 1]), store: r[C.store - 1], s: r[C.score - 1], t: r[C.time_ms - 1] });
  const meIdx = done.findIndex((r) => r[C.play_id - 1] === playId);
  const dist = Array(SETTINGS.ROUNDS + 1).fill(0);
  done.forEach((r) => { dist[r[C.score - 1]] += 1; });
  const pairs = {};
  rows.filter((r) => r[C.finished_at - 1]).forEach((r) => {
    const qs = String(r[C.questions - 1]).split(','), as = String(r[C.answers - 1]).split(',');
    qs.forEach((q, i) => { pairs[q] = pairs[q] || { n: 0, right: 0 }; pairs[q].n += 1; if (ANSWER_KEY[q] === as[i]) pairs[q].right += 1; });
  });
  const ev = data(sheet('Events'));
  const today = Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd');
  const isToday = (d) => d && Utilities.formatDate(new Date(d), 'Europe/Rome', 'yyyy-MM-dd') === today;
  const scans = data(sheet('Scans')).filter((r) => r[3] === true).length;
  return {
    ok: true,
    players: done.length,
    playersToday: done.filter((r) => isToday(r[C.finished_at - 1])).length,
    avg: done.length ? done.reduce((s, r) => s + r[C.score - 1], 0) / done.length : null,
    top: done.slice(0, 15).map(pub),
    me: meIdx >= 0 ? pub(done[meIdx], meIdx) : null,
    funnel: {
      landed: new Set(ev.filter((r) => r[1] === 'view').map((r) => r[2])).size,
      registered: rows.length,
      finished: rows.filter((r) => r[C.finished_at - 1]).length,
      qr: new Set(ev.filter((r) => r[1] === 'qr_open').map((r) => r[2])).size,
    },
    dist,
    pairs,
    avgScans: rows.length ? scans / rows.length : 0,
  };
}

// A scan counts once per device, not from the owner's device, and not from a device
// whose own sign-up used the same email or store as the QR's owner.
function verifiedScans(ref) {
  if (!ref) return 0;
  const players = data(sheet(PLAYERS));
  const owner = players.find((r) => r[C.ref_code - 1] === ref);
  if (!owner) return 0;
  const sameOwner = new Set(players.filter((r) => r[C.email - 1] === owner[C.email - 1] || r[C.store - 1] === owner[C.store - 1]).map((r) => r[C.device_id - 1]));
  const devices = new Set(data(sheet('Scans')).filter((r) => r[1] === ref && r[3] === true && !sameOwner.has(r[2])).map((r) => r[2]));
  return devices.size;
}

// ---------- email ----------
function sendWelcome(name, email, ref) {
  const first = String(name).trim().split(/\s+/)[0];
  const links = {
    game: SETTINGS.GAME_URL,
    qr: `${SETTINGS.GAME_URL}?me=${encodeURIComponent(ref)}`,
    friend: `${SETTINGS.GAME_URL}?ref=${encodeURIComponent(ref)}`,
  };
  const opts = {
    to: email,
    subject: `You're in, ${first}: spot the winning landing pages`,
    htmlBody: welcomeHtml(first, links),
    body: welcomeText(first, links),
    name: SETTINGS.EMAIL_FROM_NAME,
  };
  if (SETTINGS.EMAIL_REPLY_TO) opts.replyTo = SETTINGS.EMAIL_REPLY_TO;
  MailApp.sendEmail(opts);
}

/** The welcome email, designed like the AGS poster. Table layout + inline styles, no images. */
function welcomeHtml(first, links) {
  const name = escapeHtml(first);
  const game = escapeHtml(links.game);
  const qr = escapeHtml(links.qr);
  const friend = escapeHtml(links.friend);
  const brand = escapeHtml(SETTINGS.BRAND_URL);
  const brandShort = brand.replace(/^https?:\/\//, '');
  const head = "font-family:'Space Grotesk',Arial,Helvetica,sans-serif;font-weight:700";
  const body = 'font-family:Inter,Arial,Helvetica,sans-serif';
  const bar = (w) => `<tr><td align="center" style="padding:2px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="${w}" height="4" style="background:#090B0A;border-radius:2px;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`;
  const tier = (n, label) => `
    <td width="33%" valign="top" style="padding:0 5px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1E4A39;border-radius:14px;background:#0A1C15">
        <tr><td align="center" style="padding:16px 6px 14px">
          <div style="font-size:26px;line-height:1">🎁</div>
          <div style="${head};font-size:28px;line-height:1.1;color:#34E0A1;padding-top:8px">${n}</div>
          <div style="${body};font-size:12px;line-height:1.3;color:#9DA4A2;text-transform:uppercase;letter-spacing:1px">scans</div>
          <div style="${body};font-size:13px;line-height:1.35;color:#FFFDFC;padding-top:8px">${label}</div>
        </td></tr>
      </table>
    </td>`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>You're in, ${name}</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  @media (max-width:620px){
    .wrap{width:100%!important}
    .px{padding-left:20px!important;padding-right:20px!important}
    .h1{font-size:34px!important}
    .stack{display:block!important;width:100%!important;padding:0 0 14px!important}
    .pill{font-size:9.5px!important;letter-spacing:1px!important;padding:5px 8px!important}
    .wm{font-size:16px!important;padding-left:8px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#060B09">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#060B09">Your entry is confirmed. Here's how to win the iPad.&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#060B09" style="background:#060B09">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px">

  <!-- Header -->
  <tr><td class="px" style="padding:4px 8px 20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td width="34" height="34" valign="middle" style="background:#169E79;border-radius:9px">
            <table role="presentation" width="34" cellpadding="0" cellspacing="0">${bar(22)}${bar(16)}${bar(11)}</table>
          </td>
          <td style="${head};font-size:19px;color:#FFFDFC;padding-left:10px;white-space:nowrap" class="wm">Smart Funnels</td>
        </tr></table>
      </td>
      <td align="right" valign="middle">
        <span class="pill" style="${body};display:inline-block;font-size:11px;font-weight:600;letter-spacing:1.5px;color:#34E0A1;border:1px solid #1E4A39;border-radius:999px;padding:6px 12px;white-space:nowrap">AGS ROME · 2–5 NOV</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- Hero -->
  <tr><td bgcolor="#0C2A1D" style="background-color:#0C2A1D;background-image:linear-gradient(rgba(52,224,161,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(52,224,161,.06) 1px,transparent 1px),radial-gradient(120% 90% at 100% 0%,#14402F 0%,#0C2A1D 45%,#09120F 80%);background-size:28px 28px,28px 28px,100% 100%;border-radius:22px;border:1px solid #1E4A39">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="px" style="padding:44px 40px 40px">
      <div style="${body};font-size:12px;font-weight:600;letter-spacing:2.5px;color:#34E0A1">YOU'RE IN ✓</div>
      <h1 class="h1" style="${head};font-size:42px;line-height:1.06;letter-spacing:-1px;color:#FFFDFC;margin:14px 0 16px">${name}, let's see how many <span style="color:#34E0A1">winning landing pages</span> you can spot.</h1>
      <p style="${body};font-size:17px;line-height:1.55;color:#C9D1CE;margin:0 0 26px">10 real A/B tests. Pick the page that converted more, beat the clock, and climb the live leaderboard.</p>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td bgcolor="#34E0A1" style="border-radius:12px;background:#34E0A1">
          <a href="${game}" style="${head};display:inline-block;font-size:16px;color:#060B09;text-decoration:none;padding:15px 26px;border-radius:12px">Open my game →</a>
        </td>
      </tr></table>
    </td></tr></table>
  </td></tr>

  <tr><td height="16" style="font-size:0;line-height:0">&nbsp;</td></tr>

  <!-- Prizes -->
  <tr><td bgcolor="#0A1C15" style="background:#0A1C15;border:1px solid #1E4A39;border-radius:22px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="px" style="padding:32px 40px">
      <div style="${body};font-size:12px;font-weight:600;letter-spacing:2.5px;color:#9DA4A2">WHAT YOU'RE PLAYING FOR</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px"><tr>
        <td class="stack" width="50%" valign="top" style="padding-right:10px">
          <div style="${head};font-size:56px;line-height:1;color:#34E0A1;letter-spacing:-2px">iPad</div>
          <div style="${body};font-size:15px;color:#FFFDFC;padding-top:6px"><b>1st place</b> · plus a free trial</div>
        </td>
        <td class="stack" width="50%" valign="top" style="padding-left:10px;padding-top:4px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:2px solid #1E4A39"><tr><td style="padding:4px 0 4px 16px">
            <div style="${head};font-size:22px;line-height:1.15;color:#FFFDFC">2nd &amp; 3rd</div>
            <div style="${body};font-size:15px;line-height:1.45;color:#C9D1CE;padding-top:4px">A prize + a 1-month free trial of Smart Funnels</div>
          </td></tr></table>
        </td>
      </tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-top:1px solid #1E4A39"><tr><td style="${body};font-size:14px;line-height:1.6;color:#9DA4A2;padding-top:16px">
        <span style="color:#34E0A1">●</span>&nbsp; Most correct answers wins<br>
        <span style="color:#34E0A1">●</span>&nbsp; Fastest time breaks ties<br>
        <span style="color:#34E0A1">●</span>&nbsp; Only your first game counts<br>
        <span style="display:block;height:8px;line-height:8px;font-size:0">&nbsp;</span>Entries close <b style="color:#FFFDFC">5 Nov, 15:00</b>. Winners announced at our booth and by email.
      </td></tr></table>
    </td></tr></table>
  </td></tr>

  <tr><td height="16" style="font-size:0;line-height:0">&nbsp;</td></tr>

  <!-- QR rewards -->
  <tr><td bgcolor="#09120F" style="background:#09120F;border:1px solid #1E4A39;border-radius:22px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="px" style="padding:32px 35px">
      <div style="padding:0 5px">
        <div style="${body};font-size:12px;font-weight:600;letter-spacing:2.5px;color:#9DA4A2">BONUS</div>
        <h2 style="${head};font-size:28px;line-height:1.15;color:#FFFDFC;margin:10px 0 8px">Share your QR. <span style="color:#34E0A1">Unlock mystery rewards.</span></h2>
        <p style="${body};font-size:15px;line-height:1.55;color:#C9D1CE;margin:0 0 20px">Every friend who opens the game from your QR on their own phone counts as a scan.</p>
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        ${tier(2, 'Mystery reward #1')}${tier(5, 'Mystery reward #2')}${tier(10, 'The big one')}
      </tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td bgcolor="#34E0A1" style="border-radius:12px;background:#34E0A1">
            <a href="${qr}" style="${head};display:inline-block;font-size:16px;color:#060B09;text-decoration:none;padding:15px 26px;border-radius:12px">Open my QR code</a>
          </td>
        </tr></table>
        <div style="${body};font-size:12px;color:#6F7A76;padding-top:10px;word-break:break-all">Or send friends your link: <a href="${friend}" style="color:#9DA4A2">${friend}</a></div>
      </td></tr></table>
    </td></tr></table>
  </td></tr>

  <tr><td height="16" style="font-size:0;line-height:0">&nbsp;</td></tr>

  <!-- Brand -->
  <tr><td bgcolor="#0C2A1D" style="background-color:#0C2A1D;background-image:radial-gradient(100% 120% at 0% 100%,#060B09 0%,#0C2A1D 70%,#103428 100%);border-radius:22px;border:1px solid #1E4A39">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="px" style="padding:36px 40px" align="center">
      <div style="${head};font-size:26px;line-height:1.2;color:#FFFDFC">One funnel. Infinite versions.<br><span style="color:#34E0A1">Every visitor.</span></div>
      <p style="${body};font-size:15px;line-height:1.6;color:#C9D1CE;margin:14px auto 22px;max-width:440px">Smart Funnels tests many versions of your landing pages at once and shows each visitor the one most likely to convert, so you keep the winners without guessing.</p>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="border:1.5px solid #34E0A1;border-radius:12px">
          <a href="${brand}" style="${head};display:inline-block;font-size:15px;color:#34E0A1;text-decoration:none;padding:13px 22px">Visit ${brandShort}</a>
        </td>
      </tr></table>
      <div style="${body};font-size:13px;color:#9DA4A2;padding-top:14px">Or come say hi at our booth, Affiliate Grand Slam Rome.</div>
    </td></tr></table>
  </td></tr>

  <!-- Footer -->
  <tr><td class="px" align="center" style="padding:26px 30px 8px;${body};font-size:12px;line-height:1.6;color:#6F7A76">
    You're getting this email because you signed up to play at the Smart Funnels booth.
    We'll only send you marketing emails if you ticked that box.<br><br>
    ${escapeHtml(SETTINGS.COMPANY_LINE)}
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

// ---------- full report email ----------
// Pair titles, the winning version and why. Keep in sync with pages.js.
const PAIR_INFO = {
  p01: ['The headline', 'The plain benefit headline', 'The scandal versions got more clicks but fewer buyers: curiosity clicks aren’t customers.'],
  p02: ['The subtitle', 'The product-forward subtitle', 'Full dose, better form and a concrete outcome beat a novelty line.'],
  p03: ['Social proof', 'The page with customer and review counts', 'Adding “12,000+ customers · 4.8 from 12,400 reviews” to the same promises sold more.'],
  p04: ['The expert quote', 'Three punchy sentences', 'Same doctor, same message: short and plain beat a long clinical paragraph.'],
  p05: ['Where the ad lands', 'Straight to the product page', 'For visitors ready to buy, skipping the article earned +39.5% revenue per click.'],
  p06: ['The price', '$35', 'No cheaper price beat $35. A discount isn’t a free lift.'],
  p07: ['Offer or expert?', 'The offer-led page', 'The expert angle converted about 57% worse and was cut.'],
  p08: ['Bundle order', '3 bags + gift preselected', 'Same prices, different default: +4.9% revenue per visitor, all from bigger orders.'],
  p09: ['Hero image', 'The lifestyle photo', 'Example pair: the answer is a placeholder until a real result is added.'],
  p10: ['The guarantee', 'The 100-night trial', 'Example pair: the answer is a placeholder until a real result is added.'],
  p11: ['Reviews position', 'Reviews right under the photo', 'Example pair: the answer is a placeholder until a real result is added.'],
  p12: ['Free-shipping bar', 'The free-shipping bar', 'Example pair: the answer is a placeholder until a real result is added.'],
  p13: ['Button text', '“Try it risk-free”', 'Example pair: the answer is a placeholder until a real result is added.'],
  p14: ['Countdown timer', 'The countdown timer', 'Example pair: the answer is a placeholder until a real result is added.'],
  p15: ['Video or photos', 'The video at the top', 'Example pair: the answer is a placeholder until a real result is added.'],
};

function sendReport(row, b, scans) {
  const first = String(row[C.name - 1]).trim().split(/\s+/)[0];
  const ref = row[C.ref_code - 1];
  const r = {
    first, scans,
    score: Number(row[C.score - 1]) || 0,
    secs: ((Number(row[C.time_ms - 1]) || 0) / 1000).toFixed(1),
    rank: b.me ? b.me.rank : null,
    players: b.players,
    avg: b.avg,
    answers: String(row[C.questions - 1]).split(',').map((q, i) => ({ q, mine: String(row[C.answers - 1]).split(',')[i] })),
    links: { qr: `${SETTINGS.GAME_URL}?me=${encodeURIComponent(ref)}`, friend: `${SETTINGS.GAME_URL}?ref=${encodeURIComponent(ref)}` },
  };
  const opts = {
    to: row[C.email - 1],
    subject: `${first}, you spotted ${r.score} of ${SETTINGS.ROUNDS} winners: your full report`,
    htmlBody: reportHtml(r),
    body: reportText(r),
    name: SETTINGS.EMAIL_FROM_NAME,
  };
  if (SETTINGS.EMAIL_REPLY_TO) opts.replyTo = SETTINGS.EMAIL_REPLY_TO;
  MailApp.sendEmail(opts);
}

function reportHtml(r) {
  const head = "font-family:'Space Grotesk',Arial,Helvetica,sans-serif;font-weight:700";
  const body = 'font-family:Inter,Arial,Helvetica,sans-serif';
  const qr = escapeHtml(r.links.qr), friend = escapeHtml(r.links.friend);
  const bar = (w) => `<tr><td align="center" style="padding:2px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="${w}" height="4" style="background:#090B0A;border-radius:2px;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`;
  const card = (inner, bg) => `<tr><td bgcolor="${bg || '#0A1C15'}" style="background:${bg || '#0A1C15'};border:1px solid #1E4A39;border-radius:22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="px" style="padding:30px 36px">${inner}</td></tr></table></td></tr><tr><td height="14" style="font-size:0;line-height:0">&nbsp;</td></tr>`;
  const eyebrow = (t) => `<div style="${body};font-size:12px;font-weight:600;letter-spacing:2.5px;color:#9DA4A2">${t}</div>`;
  const stat = (v, l) => `<td class="stack" width="33%" valign="top" style="padding-right:8px"><div style="${head};font-size:30px;line-height:1.1;color:#34E0A1">${v}</div><div style="${body};font-size:12.5px;color:#9DA4A2">${l}</div></td>`;
  const right = r.answers.filter((a) => ANSWER_KEY[a.q] === a.mine).length;
  const rows = r.answers.map((a, i) => {
    const info = PAIR_INFO[a.q] || [a.q, '', ''];
    const ok = ANSWER_KEY[a.q] === a.mine;
    return `<tr><td valign="top" width="30" style="padding:12px 0;border-top:1px solid #1E4A39;${head};font-size:18px;color:${ok ? '#34E0A1' : '#FE5B3E'}">${ok ? '✓' : '✗'}</td>
      <td style="padding:12px 0;border-top:1px solid #1E4A39;${body};font-size:14px;line-height:1.45;color:#C9D1CE">
        <b style="color:#FFFDFC">${i + 1}. ${escapeHtml(info[0])}</b><br>Winner: <span style="color:#34E0A1">${escapeHtml(info[1])}</span><br><span style="color:#9DA4A2">${escapeHtml(info[2])}</span></td></tr>`;
  }).join('');
  const tiers = [2, 5, 10].map((n) => {
    const on = r.scans >= n;
    return `<td width="33%" style="padding:0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px ${on ? 'solid #34E0A1' : 'dashed #2E5A49'};border-radius:12px;background:${on ? '#123A2C' : '#09120F'}"><tr><td align="center" style="padding:12px 4px">
      <div style="font-size:20px">${on ? '🎁' : '❔'}</div><div style="${head};font-size:20px;color:#FFFDFC">${n}</div><div style="${body};font-size:11px;color:#9DA4A2">${on ? 'UNLOCKED' : 'scans'}</div></td></tr></table></td>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>Your full report</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>@media (max-width:620px){.wrap{width:100%!important}.px{padding-left:20px!important;padding-right:20px!important}.h1{font-size:30px!important}.stack{display:block!important;width:100%!important;padding:0 0 12px!important}.wm{font-size:16px!important}}</style>
</head><body style="margin:0;padding:0;background:#060B09">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#060B09">Every answer explained, your rank, and your QR rewards.&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#060B09" style="background:#060B09"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px">
  <tr><td class="px" style="padding:4px 8px 20px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td width="34" height="34" valign="middle" style="background:#169E79;border-radius:9px"><table role="presentation" width="34" cellpadding="0" cellspacing="0">${bar(22)}${bar(16)}${bar(11)}</table></td>
    <td class="wm" style="${head};font-size:19px;color:#FFFDFC;padding-left:10px;white-space:nowrap">Smart Funnels</td></tr></table></td></tr>

  ${card(`${eyebrow('YOUR FULL REPORT')}
    <h1 class="h1" style="${head};font-size:38px;line-height:1.08;letter-spacing:-1px;color:#FFFDFC;margin:12px 0 18px">${escapeHtml(r.first)}, you spotted <span style="color:#34E0A1">${right} of ${r.answers.length}</span> winning landing pages.</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${stat(r.secs + ' s', 'your time')}${stat(r.rank ? '#' + r.rank : '–', r.players ? 'rank of ' + r.players + ' players' : 'rank')}${stat(r.avg != null ? Number(r.avg).toFixed(1) : '–', 'average score')}</tr></table>
    <div style="${body};font-size:13.5px;line-height:1.5;color:#9DA4A2;padding-top:14px">Most correct answers wins the iPad; the fastest time breaks ties. Winners are announced at our booth on 5 November and by email.</div>`, '#0C2A1D')}

  ${card(`${eyebrow('EVERY ANSWER, EXPLAINED')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">${rows}</table>`)}

  ${card(`${eyebrow('BONUS')}
    <h2 style="${head};font-size:24px;line-height:1.2;color:#FFFDFC;margin:10px 0 6px">${r.scans} ${r.scans === 1 ? 'friend has' : 'friends have'} scanned your QR. <span style="color:#34E0A1">Keep going.</span></h2>
    <div style="${body};font-size:14px;line-height:1.5;color:#C9D1CE;margin-bottom:16px">Mystery rewards unlock at 2, 5 and 10 scans.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${tiers}</tr></table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr><td bgcolor="#34E0A1" style="border-radius:12px;background:#34E0A1">
      <a href="${qr}" style="${head};display:inline-block;font-size:16px;color:#060B09;text-decoration:none;padding:15px 26px;border-radius:12px">Open my QR code</a></td></tr></table>
    <div style="${body};font-size:12px;color:#6F7A76;padding-top:10px;word-break:break-all">Link to send friends: <a href="${friend}" style="color:#9DA4A2">${friend}</a></div>`, '#09120F')}

  ${card(`<div style="text-align:center"><div style="${head};font-size:24px;line-height:1.2;color:#FFFDFC">Guessing is hard. <span style="color:#34E0A1">Smart Funnels tests it for you.</span></div>
    <div style="${body};font-size:14.5px;line-height:1.6;color:#C9D1CE;margin:12px auto 20px;max-width:440px">We test many versions of your landing pages at once and show each visitor the one most likely to convert, so you keep the winners without guessing.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td style="border:1.5px solid #34E0A1;border-radius:12px">
      <a href="${escapeHtml(SETTINGS.BRAND_URL)}" style="${head};display:inline-block;font-size:15px;color:#34E0A1;text-decoration:none;padding:13px 22px">Visit ${escapeHtml(SETTINGS.BRAND_URL.replace(/^https?:\/\//, ''))}</a></td></tr></table></div>`, '#0C2A1D')}

  <tr><td class="px" align="center" style="padding:14px 30px 8px;${body};font-size:12px;line-height:1.6;color:#6F7A76">
    You asked for this report after playing at the Smart Funnels booth. Brands shown in the game are fictional.<br><br>${escapeHtml(SETTINGS.COMPANY_LINE)}</td></tr>
</table></td></tr></table></body></html>`;
}

function reportText(r) {
  const right = r.answers.filter((a) => ANSWER_KEY[a.q] === a.mine).length;
  return [
    `${r.first}, you spotted ${right} of ${r.answers.length} winning landing pages.`,
    `Time: ${r.secs} s · Rank: ${r.rank ? '#' + r.rank : '-'}${r.players ? ' of ' + r.players : ''}`,
    '',
    'EVERY ANSWER',
    ...r.answers.map((a, i) => { const info = PAIR_INFO[a.q] || [a.q, '', '']; return `${ANSWER_KEY[a.q] === a.mine ? '✓' : '✗'} ${i + 1}. ${info[0]}: winner ${info[1]}. ${info[2]}`; }),
    '',
    `QR rewards: ${r.scans} scans so far. Rewards unlock at 2, 5 and 10 scans.`,
    `Your QR code: ${r.links.qr}`,
    `Link to send friends: ${r.links.friend}`,
    '',
    `Smart Funnels: ${SETTINGS.BRAND_URL}`,
    SETTINGS.COMPANY_LINE,
  ].join('\n');
}

function welcomeText(first, links) {
  return [
    `You're in, ${first}!`,
    '',
    "Let's see how many winning landing pages you can spot: 10 real A/B tests, pick the page that converted more.",
    `Open the game: ${links.game}`,
    '',
    "WHAT YOU'RE PLAYING FOR",
    '1st place: iPad + a free trial. 2nd & 3rd: a prize + a 1-month free trial.',
    'Most correct answers wins, the fastest time breaks ties, only your first game counts.',
    'Entries close 5 Nov, 15:00. Winners announced at our booth and by email.',
    '',
    'BONUS: share your QR and unlock mystery rewards at 2, 5 and 10 scans.',
    `Your QR code: ${links.qr}`,
    `Link to send friends: ${links.friend}`,
    '',
    'One funnel. Infinite versions. Every visitor.',
    `Smart Funnels: ${SETTINGS.BRAND_URL}`,
    '',
    SETTINGS.COMPANY_LINE,
  ].join('\n');
}

/** Run from the editor to see the welcome email in your own inbox. */
function sendTestEmail() {
  const me = Session.getActiveUser().getEmail();
  sendWelcome('Test Player', me, 'TESTCODE');
  Logger.log('Sent to ' + me + '. Emails left today: ' + MailApp.getRemainingDailyQuota());
}

// ---------- helpers ----------
function sheet(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function data(sh) { const n = sh.getLastRow() - 1; return n > 0 ? sh.getRange(2, 1, n, sh.getLastColumn()).getValues() : []; }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean(v) { return String(v == null ? '' : v).slice(0, 300).replace(/^[=+\-@]+/, ''); }
function cleanStore(v) { return clean(v).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''); }
function shortName(n) { const p = String(n).trim().split(/\s+/); return p[0] + (p[1] ? ' ' + p[1][0].toUpperCase() + '.' : ''); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function refCode(email, store) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email + '|' + store, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
}
