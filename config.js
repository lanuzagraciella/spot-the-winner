// Event settings. Edit these before the event; nothing else needs to change.
window.SF_CONFIG = {
  // Google Apps Script web-app URL (apps-script/Code.gs). Empty = demo mode: nothing is
  // sent, and the leaderboard, report and QR scans show example data.
  SHEET_ENDPOINT: "https://script.google.com/macros/s/AKfycbyzYiibBqRHiQ-wtozC69yK1QZZyhLsPT0CHCP5avDeKWBWoZS8ctAdBI6gre6FphWZ/exec",

  // The live game address, used in players' QR codes and share links.
  // Empty = the address the game is opened from.
  GAME_URL: "",

  // Entries close (Rome time, UTC+1 in November). Keep CLOSE_AT in Code.gs the same.
  ENTRIES_CLOSE_AT: "2026-11-05T15:00:00+01:00",
  WINNERS_ANNOUNCED: "at the Smart Funnels booth on 5 November",

  ROUNDS: 10,
  EVENT_SOURCE: "AGS Rome 2026",
  PRIVACY_URL: "#", // TODO: privacy-policy URL

  // Booth iPad: true (or open the URL with ?kiosk=1) → no per-device memory,
  // "Next player" button, auto-reset when idle.
  KIOSK: false,

  // Background music. Empty = a loop generated in the browser (no file, no licence).
  // To use a licensed track: add assets/music.mp3 and set MUSIC_SRC: "assets/music.mp3".
  MUSIC_SRC: "",
};
