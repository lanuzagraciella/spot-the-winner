(() => {
  "use strict";

  const CFG = window.SF_CONFIG;
  const { PAIRS, html: pageHTML } = window.SF_PAGES;
  const SND = window.SFSound || { startMusic() {}, stopMusic() {}, duck() {}, cue() {}, sting() {}, isMuted: () => true, toggle: () => true };
  const ROUNDS = Math.min(CFG.ROUNDS || 10, PAIRS.length);
  const PARAMS = new URLSearchParams(location.search);
  const KIOSK = CFG.KIOSK === true || PARAMS.get("kiosk") === "1";
  const DEMO = !CFG.SHEET_ENDPOINT;
  const GAME_URL = CFG.GAME_URL || location.origin + location.pathname;

  const K = { queue: "sf_spot_queue_v1", player: "sf_spot_player_v1", progress: "sf_spot_progress_v1", device: "sf_spot_device_v1", seen: "sf_spot_seen_v1", qrSeen: "sf_spot_qrseen_v1", muted: "sf_games_muted_v1" };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const secs = (ms) => (ms / 1000).toFixed(1);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const BY_ID = Object.fromEntries(PAIRS.map((p) => [p.id, p]));

  function store(area, key, value) {
    try {
      const s = window[area];
      if (value === undefined) return JSON.parse(s.getItem(key) || "null");
      if (value === null) return s.removeItem(key);
      s.setItem(key, JSON.stringify(value));
    } catch (_) { return null; }
  }
  // Kiosk mode keeps nothing about players on the device (the send queue still persists).
  const local = (k, v) => (KIOSK && k !== K.queue ? (v === undefined ? null : undefined) : store("localStorage", k, v));
  const session = (k, v) => store("sessionStorage", k, v);

  const DEVICE = KIOSK ? "kiosk-" + uid() : local(K.device) || (() => { const d = uid(); local(K.device, d); return d; })();
  const REF_IN = (PARAMS.get("ref") || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
  // ?me=CODE (the "Open my QR code" button in the welcome email) opens the player's own QR screen.
  const ME = (PARAMS.get("me") || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 16);

  const st = { screen: "reg", player: null, playId: null, rounds: [], answers: [], i: 0, thinkMs: 0, roundStart: 0, board: null, scans: 0 };

  function show(name) {
    st.screen = name;
    ["reg", "quiz", "res", "qr", "report"].forEach((s) => ($(`#s-${s}`).hidden = s !== name));
    document.body.classList.toggle("in-quiz", name === "quiz");
    if (name === "quiz") startClock(); else stopClock();
    scrollTo({ top: 0, behavior: "instant" });
    kioskIdle();
    clearInterval(show.poll);
    if (name === "res" || name === "qr") placeQR(name);
    if (name === "qr" || name === "res") { refreshQR(); show.poll = setInterval(() => { refreshQR(); if (name === "res" && !DEMO) loadBoard(); }, 20000); }
    if (name === "report" && !DEMO) show.poll = setInterval(loadBoard, 30000);
  }

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.id); toast.id = setTimeout(() => (t.hidden = true), 2600);
  }

  // ---------- server: send queue (survives weak Wi-Fi and reloads) ----------
  function enqueue(item) {
    if (DEMO) return;
    const q = local(K.queue) || [];
    q.push(item);
    local(K.queue, q);
    flush();
  }

  let flushing = null;
  function flush() {
    if (DEMO) return Promise.resolve();
    if (flushing) return flushing;
    flushing = (async () => {
      try {
        let q = local(K.queue) || [];
        let sentSomething = false;
        while (q.length) {
          const res = await fetch(CFG.SHEET_ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(q[0]) });
          if (!res.ok) throw new Error("HTTP " + res.status);
          const reply = await res.json().catch(() => ({ ok: true }));
          // The result can arrive before its sign-up has landed: keep it and retry.
          if (reply.ok === false && (reply.reason === "not_registered" || reply.reason === "not_finished")) throw new Error("waiting for sign-up");
          if (q[0].action === "register" && reply.ref && st.player && !st.player.ref) { st.player.ref = reply.ref; savePlayer(); }
          q = (local(K.queue) || []).slice(1);
          local(K.queue, q);
          sentSomething = true;
        }
        setStatus("");
        if (sentSomething && (st.screen === "res" || st.screen === "report")) loadBoard();
      } catch (_) {
        setStatus("Saving… we'll keep trying until you're back online.", true);
        setTimeout(() => flush(), 10000);
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  }
  addEventListener("online", () => flush());

  function setStatus(text, warn) {
    const el = $("#save-status");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("warn", !!warn);
  }

  async function getJSON(params) {
    if (DEMO) return null;
    try {
      const res = await fetch(CFG.SHEET_ENDPOINT + "?" + new URLSearchParams(params), { cache: "no-store" });
      return res.ok ? await res.json() : null;
    } catch (_) { return null; }
  }

  // Same 8-character code the server makes: SHA-256 of "email|store", base64, letters and digits only.
  async function refCode(email, storeUrl) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email + "|" + storeUrl));
      return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
    } catch (_) { return null; }
  }

  // ---------- QR codes ----------
  // Real, scannable QR codes drawn locally (assets/qrcode.js, MIT), so they work even on weak venue Wi-Fi.
  function drawQR(el, text) {
    el.innerHTML = "";
    const qr = window.qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount(), quiet = 2, cell = Math.ceil(600 / (n + quiet * 2));
    const c = document.createElement("canvas");
    c.width = c.height = (n + quiet * 2) * cell;
    const x = c.getContext("2d");
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#0b1210";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) x.fillRect((k + quiet) * cell, (r + quiet) * cell, cell, cell);
    c.setAttribute("role", "img");
    c.setAttribute("aria-label", "QR code");
    el.appendChild(c);
  }


  // ---------- registration ----------
  function savePlayer() { local(K.player, st.player); }

  $("#prefill").addEventListener("click", () => {
    $("#f-name").value = "Giulia Rossi"; $("#f-email").value = "giulia@glowshop.it"; $("#f-store").value = "glowshop.it"; $("#f-privacy").checked = true;
  });
  $("#form").addEventListener("input", (e) => e.target.classList.remove("bad"));
  $("#form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isClosed()) return toast("Entries are closed. Thanks for playing!");
    const name = $("#f-name"), email = $("#f-email"), storeEl = $("#f-store"), priv = $("#f-privacy");
    const storeUrl = storeEl.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    const checks = [
      [name, name.value.trim().length > 1, "Please enter your name."],
      [email, email.checkValidity() && /\S+@\S+\.\S+/.test(email.value), "Please check your email address."],
      [storeEl, /^[\w-]+(\.[\w-]+)+$/.test(storeUrl), "Please enter your store's web address, like yourstore.com."],
      [priv, priv.checked, "Please accept the privacy policy to play."],
    ];
    const bad = checks.find(([, ok]) => !ok);
    checks.forEach(([el, ok]) => el.classList.toggle("bad", !ok));
    if (bad) { $("#err").textContent = bad[2]; $("#err").hidden = false; bad[0].focus(); return; }
    $("#err").hidden = true;

    const em = email.value.trim().toLowerCase();
    const prev = local(K.player);
    const same = prev && prev.email === em && prev.store === storeUrl;
    st.player = {
      name: name.value.trim(), email: em, store: storeUrl,
      ref: (same && prev.ref) || (await refCode(em, storeUrl)),
      first: same ? prev.first : null,
    };
    savePlayer();
    st.playId = uid();
    const phoneDigits = $("#f-phone").value.replace(/\D/g, "");
    enqueue({
      action: "register", play_id: st.playId, name: st.player.name, email: em, store: storeUrl,
      phone: phoneDigits ? $("#f-dial").value.replace(/[^\d+]/g, "") + phoneDigits.replace(/^0+/, "") : "",
      consent_privacy: true, consent_marketing: $("#f-mkt").checked,
      referred_by: REF_IN, device_id: DEVICE, device: deviceClass(), kiosk: KIOSK,
      source: CFG.EVENT_SOURCE, user_agent: navigator.userAgent,
    });
    startGame();
  });

  function deviceClass() {
    if (matchMedia("(hover: hover) and (pointer: fine)").matches) return "desktop";
    return Math.min(screen.width, screen.height) >= 700 ? "tablet" : "phone";
  }
  function isClosed() { return Date.now() >= new Date(CFG.ENTRIES_CLOSE_AT).getTime(); }

  // ---------- quiz ----------
  function startGame() {
    st.rounds = shuffle(PAIRS).slice(0, ROUNDS).map((p) => ({ p, flip: Math.random() < .5 }));
    st.answers = []; st.i = 0; st.thinkMs = 0;
    saveProgress();
    beginRounds();
    SND.startMusic();
  }

  function beginRounds() {
    const prog = $("#prog");
    prog.style.setProperty("--n", ROUNDS);
    prog.innerHTML = "<i></i>".repeat(ROUNDS);
    show("quiz");
    renderRound();
  }

  function saveProgress() {
    if (KIOSK) return;
    session(K.progress, { player: st.player, playId: st.playId, rounds: st.rounds.map(({ p, flip }) => [p.id, flip]), answers: st.answers, thinkMs: st.thinkMs, ts: Date.now() });
  }
  function loadProgress() {
    const p = KIOSK ? null : session(K.progress);
    if (!p || Date.now() - p.ts > 30 * 60 * 1000 || p.answers.length >= ROUNDS || !p.rounds.every(([id]) => BY_ID[id])) return null;
    return p;
  }

  function renderRound() {
    const { p, flip } = st.rounds[st.i];
    const sides = flip ? ["b", "a"] : ["a", "b"];
    $("#rn").textContent = `${st.i + 1}/${ROUNDS}`;
    $("#qmeta").textContent = `Question ${st.i + 1} of ${ROUNDS} · ${p.title}`;
    $("#qtext").textContent = "Which landing page converted more visitors?";
    $$("#prog i").forEach((d, k) => { d.className = k < st.i ? "done" : k === st.i ? "now" : ""; });
    const pages = $("#pages");
    pages.className = "pages";
    pages.innerHTML = sides.map((side, k) => `
      <div class="pg" data-side="${side}">
        <span class="tag">Landing page ${k + 1}</span>
        <div class="frame" data-pick="${side}"><div class="scroll">${pageHTML(p, side)}</div>
          <button class="zoom" type="button" data-zoom="${k}" aria-label="View landing page ${k + 1} full screen">⤢</button></div>
        <button class="choose" type="button" data-pick="${side}">Choose page ${k + 1}</button>
      </div>`).join("");
    $("#locked").classList.remove("show");
    $("#qtext").focus({ preventScroll: true });
    st.roundStart = performance.now();
    SND.duck(false);
  }

  function pick(side) {
    const pages = $("#pages");
    if (st.screen !== "quiz" || pages.classList.contains("locked")) return;
    st.thinkMs += Math.round(performance.now() - st.roundStart);
    st.answers.push(side);
    saveProgress();
    pages.classList.add("locked");
    pages.querySelector(`.pg[data-side="${side}"]`).classList.add("sel");
    $$("#prog i")[st.i].className = "done";
    $("#locked").classList.add("show");
    try { navigator.vibrate && navigator.vibrate(25); } catch (_) {}
    SND.cue(true); // the same "locked in" sound for every pick: no reveal until the end
    setTimeout(() => { st.i += 1; if (st.i < ROUNDS) renderRound(); else finish(); }, 650);
  }

  $("#pages").addEventListener("click", (e) => {
    const z = e.target.closest("[data-zoom]");
    if (z) { e.stopPropagation(); openViewer(+z.dataset.zoom); return; }
    const t = e.target.closest("[data-pick]");
    if (t) pick(t.dataset.pick);
  });
  addEventListener("keydown", (e) => {
    if (st.screen !== "quiz" || !$("#viewer").hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    const k = e.key.toLowerCase();
    const idx = k === "1" || k === "arrowleft" || k === "a" ? 0 : k === "2" || k === "arrowright" || k === "b" ? 1 : -1;
    if (idx >= 0) { e.preventDefault(); pick($$("#pages .pg")[idx].dataset.side); }
  });

  // full-screen page viewer (phones especially)
  let vSide = null;
  function openViewer(k) {
    vSide = $$("#pages .pg")[k].dataset.side;
    $("#v-title").textContent = `Landing page ${k + 1}`;
    $("#v-pick").textContent = `Choose landing page ${k + 1}`;
    $("#v-page").innerHTML = pageHTML(st.rounds[st.i].p, vSide);
    $("#v-page").scrollTop = 0;
    $("#viewer").hidden = false;
    $("#v-close").focus();
  }
  const closeViewer = () => { $("#viewer").hidden = true; };
  $("#v-close").addEventListener("click", closeViewer);
  $("#v-pick").addEventListener("click", () => { closeViewer(); pick(vSide); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#viewer").hidden) closeViewer(); });

  // answer clock: counts only while a pair is open
  let clockId = null, shown = "";
  function liveMs() {
    const open = st.screen === "quiz" && !$("#pages").classList.contains("locked");
    return st.thinkMs + (open ? performance.now() - st.roundStart : 0);
  }
  function startClock() {
    cancelAnimationFrame(clockId);
    (function loop() {
      const t = secs(liveMs());
      if (t !== shown) { shown = t; $$(".tval").forEach((el) => (el.textContent = t)); }
      document.body.classList.toggle("timing", st.screen === "quiz" && !$("#pages").classList.contains("locked"));
      clockId = requestAnimationFrame(loop);
    })();
  }
  function stopClock() { cancelAnimationFrame(clockId); document.body.classList.remove("timing"); }

  // ---------- results ----------
  const score = () => st.answers.filter((a, k) => a === st.rounds[k].p.win).length;
  const shortName = (n) => { const p = n.trim().split(/\s+/); return p[0] + (p[1] ? ` ${p[1][0].toUpperCase()}.` : ""); };

  function finish() {
    const s = score();
    session(K.progress, null);
    enqueue({ action: "result", play_id: st.playId, questions: st.rounds.map(({ p }) => p.id), answers: st.answers, time_ms: st.thinkMs });
    if (st.player && !st.player.first) { st.player.first = { s, t: st.thinkMs, playId: st.playId, rounds: st.rounds.map(({ p, flip }) => [p.id, flip]), answers: st.answers }; savePlayer(); }
    SND.stopMusic();
    renderResult(s);
    show("res");
    countUp($("#r-score"), s);
    SND.sting(s >= 8);
    if (s >= 8) confetti();
    flush().then(loadBoard);
  }

  function renderResult(s) {
    $$("#email-report, [data-email-report]").forEach((b) => { b.disabled = false; b.textContent = b.id ? "✉ Email me my full report" : "✉ Email me this report"; });
    $("#r-title").textContent = s >= 9 ? "Conversion assassin" : s >= 7 ? "Sharp optimizer" : s >= 5 ? "Rising tester" : "Funnel rookie";
    $("#r-score").textContent = s;
    $("#r-of").textContent = ROUNDS;
    $("#r-time").textContent = `${secs(st.thinkMs)} s`;
    $("#review").innerHTML = st.rounds.map(({ p, flip }, k) => {
      const ok = st.answers[k] === p.win;
      const winNo = (flip ? ["b", "a"] : ["a", "b"]).indexOf(p.win) + 1;
      const myNo = (flip ? ["b", "a"] : ["a", "b"]).indexOf(st.answers[k]) + 1;
      return `<div class="rv"><span class="m ${ok ? "ok" : "no"}">${ok ? "✓" : "✗"}</span><div><b>${esc(p.title)}</b>: you picked page ${myNo}, page ${winNo} won${p.provisional ? ' <span class="x">EXAMPLE PAIR, PLACEHOLDER ANSWER</span>' : ""}<p>${p.diff.replace(/<[^>]+>/g, "")}</p></div></div>`;
    }).join("");
    renderBoard(boardFallback(s));
  }

  // Example players for demo mode, and a stand-in until the live board loads.
  const DEMO_ROWS = [["Marco B.", "vitashop.it", 10, 38.2], ["Anna K.", "petloft.de", 10, 44.9], ["Tom W.", "gearhub.co.uk", 9, 29.7], ["Lea M.", "beautybox.fr", 9, 35.0], ["Sam O.", "fitfuel.com", 9, 41.3], ["Nina P.", "casaverde.es", 8, 33.1], ["Luca F.", "bikestore.it", 8, 47.6], ["Eva S.", "skinlab.nl", 8, 52.0], ["Jon D.", "outdoorx.com", 7, 30.4], ["Mia H.", "teatime.co.uk", 7, 36.8], ["Omar A.", "gadgetly.ae", 7, 49.9], ["Sofia R.", "modaitalia.it", 6, 28.5], ["Ben T.", "coffeeco.com", 6, 44.0], ["Ivy L.", "yogamat.de", 5, 31.2]];
  function boardFallback(s) {
    const me = { me: true, name: shortName(st.player ? st.player.name : "You"), store: st.player ? st.player.store : "", s, t: st.thinkMs };
    if (!DEMO) return { live: false, top: [], me, players: null };
    const rows = DEMO_ROWS.map(([name, sto, sc, t]) => ({ name, store: sto, s: sc, t: t * 1000 })).concat(me);
    rows.sort((a, b) => b.s - a.s || a.t - b.t);
    const rank = rows.indexOf(me) + 1;
    me.rank = rank;
    return {
      live: false, demo: true, top: rows.slice(0, 15).map((r, i) => ({ ...r, rank: i + 1 })), me, players: 312, playersToday: 312, avg: 6.4,
      funnel: { landed: 1000, registered: 640, finished: 548, qr: 301 }, dist: [2, 4, 9, 16, 28, 44, 58, 52, 37, 18, 6],
      pairs: { p06: { n: 300, right: 93 }, p03: { n: 310, right: 260 } }, avgScans: 1.8,
    };
  }

  async function loadBoard() {
    const data = await getJSON({ action: "board", play_id: st.playId || "" });
    if (!data || !data.ok) { if (!DEMO) $("#lb").innerHTML = `<p class="muted" style="margin:0">The leaderboard is loading. Pull to refresh in a moment.</p>`; return; }
    const me = data.me ? { ...data.me, me: true } : { me: true, name: shortName(st.player.name), store: st.player.store, s: score(), t: st.thinkMs, pending: true };
    renderBoard({ live: true, ...data, me });
  }

  function renderBoard(b) {
    st.board = b;
    $$("[data-demo-label]").forEach((el) => (el.hidden = !b.demo));
    const row = (r) => `<div class="row${r.rank <= 3 ? " top" : ""}${r.me ? " me" : ""}"><span class="r">${r.rank || "–"}</span><span class="nm">${esc(r.me ? "You" : r.name)} · ${esc(r.store)}</span><span class="s">${r.s}/${ROUNDS}</span><span class="t">${secs(r.t)}s</span></div>`;
    const mark = (list) => list.map((r) => (b.me && b.me.rank && r.rank === b.me.rank ? { ...r, me: true } : r));
    const list = (limit) => {
      const top = mark(b.top.slice(0, limit));
      let html = top.map(row).join("");
      if (b.me && !top.some((r) => r.me)) html += (top.length ? `<div class="gap">···</div>` : "") + row(b.me);
      return html || `<p class="muted" style="margin:0">You're the first to finish. Nice!</p>`;
    };
    $("#lb").innerHTML = list(8);
    $("#lb2").innerHTML = list(15);
    $("#r-rank").textContent = b.me && b.me.rank ? `#${b.me.rank}` : "…";
    $("#r-players").textContent = b.players != null ? b.players : "…";
    const hardest = Object.entries(b.pairs || {}).filter(([, v]) => v.n >= 5).map(([id, v]) => [id, v.right / v.n]).sort((x, y) => x[1] - y[1]);
    const hard = hardest[0];
    $("#perf").innerHTML = `<div class="stat"><b>${b.playersToday != null ? b.playersToday : "…"}</b><span>players today</span></div>` +
      `<div class="stat"><b>${b.avg != null ? b.avg.toFixed(1) : "…"}</b><span>average score</span></div>` +
      `<div class="stat"><b>${hard ? Math.round(hard[1] * 100) + "%" : "…"}</b><span>${hard ? "spotted “" + esc(BY_ID[hard[0]].title) + "”" : "hardest pair"}</span></div>`;
    buildReport(b, hardest);
  }

  function buildReport(b, hardest) {
    const f = b.funnel || { landed: 0, registered: 0, finished: 0, qr: 0 };
    const base = Math.max(f.landed, f.registered, 1);
    const steps = [["Landed", f.landed], ["Registered", f.registered], ["Finished", f.finished], ["Opened QR", f.qr]];
    $("#funnel").innerHTML = steps.map(([l, v]) => `<div class="bar"><span>${l}</span><i style="width:${(v / base) * 100}%"></i><em>${v}</em></div>`).join("");
    const dist = b.dist || Array(ROUNDS + 1).fill(0);
    const max = Math.max(1, ...dist);
    const myS = b.me ? b.me.s : -1;
    $("#dist").innerHTML = dist.map((h, k) => `<i class="${k === myS ? "me" : ""}" style="height:${Math.max(2, (h / max) * 100)}%" title="${h} players scored ${k}"></i>`).join("");
    $("#distx").innerHTML = dist.map((_, k) => `<span>${k}</span>`).join("");
    const easy = hardest && hardest.length ? hardest[hardest.length - 1] : null;
    $("#dist-note").textContent = myS >= 0 ? `You're the bright bar (${myS}/${ROUNDS}).` + (hardest && hardest.length ? ` Hardest pair: ${BY_ID[hardest[0][0]].title} (${Math.round(hardest[0][1] * 100)}% right). Easiest: ${BY_ID[easy[0]].title} (${Math.round(easy[1] * 100)}%).` : "") : "";
    $("#pairstats").innerHTML = `<div><b>Average verified QR scans per player</b><br>${b.avgScans != null ? b.avgScans.toFixed(1) : "…"}</div>` +
      `<div><b>Finish rate</b><br>${f.registered ? Math.round((f.finished / f.registered) * 100) + "% of players who signed up finished all " + ROUNDS + " pairs" : "…"}</div>`;
    $("#rep-updated").textContent = b.live ? "updated " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "updates every minute";
  }

  function countUp(el, to) {
    const t0 = performance.now();
    (function f(now) { const p = Math.min(1, (now - t0) / 700); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(t0);
  }

  $("#again").addEventListener("click", () => { toast("Replay: only your first score counts for the prize."); st.playId = uid(); enqueueReplay(); startGame(); });
  function enqueueReplay() {
    // A replay is a new play on the same sign-up details, so it gets its own row.
    enqueue({ action: "register", play_id: st.playId, name: st.player.name, email: st.player.email, store: st.player.store, phone: "", consent_privacy: true, consent_marketing: false, referred_by: REF_IN, device_id: DEVICE, device: deviceClass(), kiosk: KIOSK, source: CFG.EVENT_SOURCE + " (replay)", user_agent: navigator.userAgent });
  }
  $$("[data-go]").forEach((b) => b.addEventListener("click", () => {
    const go = b.dataset.go;
    if (go === "res" && !st.rounds.length) return renderReg(); // opened from the email: no result on this device
    if (go === "qr") openQR(); else show(go);
    if (go === "report") loadBoard();
  }));

  // ---------- QR rewards ----------
  const TIERS = [
    { at: 2, label: "Discount code", body: 'Your code: <span class="code">AGS-ROME</span><br><span class="muted" style="font-size:13px">One code, no expiry, share it freely.</span>' },
    { at: 5, label: "Mystery reward", body: "Reward to be announced." },
    { at: 10, label: "Mystery reward", body: "Reward to be announced." },
  ];
  const myLink = () => `${GAME_URL}?ref=${encodeURIComponent(st.player && st.player.ref ? st.player.ref : "")}`;

  // One QR panel, shown on the score screen and on its own screen (opened from the welcome email).
  function placeQR(where) {
    $(where === "qr" ? "#qr-slot-qr" : "#qr-slot-res").appendChild($("#qrpanel"));
    const link = myLink();
    if (placeQR.drawn !== link) { drawQR($("#myqr"), link); placeQR.drawn = link; }
    renderTiers();
    if (!DEMO && !session(K.qrSeen)) { session(K.qrSeen, 1); enqueue({ action: "event", type: "qr_open", device_id: DEVICE, ref: st.player && st.player.ref }); }
  }
  function openQR() { show("qr"); }

  // ---------- full report by email ----------
  function emailReport() {
    const btns = $$("#email-report, [data-email-report]");
    if (DEMO) return toast("Demo preview: no email is sent.");
    if (!st.player || !st.playId) return;
    enqueue({ action: "report", play_id: st.playId });
    btns.forEach((b) => { b.disabled = true; b.textContent = "✓ Report on its way to your inbox"; });
    toast(`Sending your full report to ${st.player.email}`);
  }
  $$("#email-report, [data-email-report]").forEach((b) => b.addEventListener("click", emailReport));
  async function refreshQR() {
    if (DEMO || !st.player || !st.player.ref) return renderTiers();
    const data = await getJSON({ action: "qr", ref: st.player.ref });
    if (data && data.ok) {
      const before = st.scans;
      st.scans = data.scans;
      const hit = TIERS.find((t) => before < t.at && st.scans >= t.at);
      renderTiers(hit && hit.at);
      if (hit && before > 0) celebrate(hit);
    }
  }
  function renderTiers(pop) {
    const n = st.scans;
    $("#scans").textContent = n;
    $("#scans-word").textContent = n === 1 ? "person" : "people";
    const next = TIERS.find((t) => n < t.at);
    $("#track").style.width = `${Math.min(100, (n / 10) * 100)}%`;
    $("#nudge").innerHTML = next
      ? `${n === 0 ? "Share it with friends at the booth." : n < 5 ? "Keep it up!" : "Well done!"} Share with <b style="color:var(--text)">${next.at - n} more</b> to unlock the next mystery reward.`
      : "All rewards unlocked. Legend!";
    $("#tiers").innerHTML = TIERS.map((t) => {
      const on = n >= t.at;
      return `<div class="tier${on ? " on" : ""}${pop === t.at ? " pop" : ""}"><div class="ic">${on ? "🎁" : "❔"}</div><b>${t.at} scans</b>${on ? (t.at === 2 ? "Unlocked: discount code" : "Unlocked") : "Mystery reward"}</div>`;
    }).join("");
    const top = TIERS.filter((t) => n >= t.at).pop();
    if (top && $("#reward").hidden) { $("#reward").innerHTML = rewardHTML(top); $("#reward").hidden = false; }
  }
  const rewardHTML = (t) => `<div style="font-size:30px">🎉</div><b style="font-size:20px">Reward unlocked at ${t.at} scans</b><div style="margin-top:6px">${t.body}</div>`;
  function celebrate(t) { $("#reward").innerHTML = rewardHTML(t); $("#reward").hidden = false; confetti(); SND.sting(true); }

  $("#sim").addEventListener("click", () => {
    st.scans += 1;
    const hit = TIERS.find((t) => t.at === st.scans);
    renderTiers(hit && hit.at);
    if (hit) celebrate(hit);
  });
  // ---------- sharing (phones first: WhatsApp, the share sheet, a branded image) ----------
  const SHARE_TEXT = "How many winning landing pages can you spot? Play the Smart Funnels challenge with my link:";
  $("#sh-wa").addEventListener("click", () => {
    window.open("https://wa.me/?text=" + encodeURIComponent(`${SHARE_TEXT} ${myLink()}`), "_blank", "noopener");
  });
  $("#sh-copy").addEventListener("click", () => {
    navigator.clipboard.writeText(myLink()).then(() => toast("Link copied"), () => toast(myLink()));
  });
  // A portrait card with the QR, ready for WhatsApp status, Instagram stories and chats.
  async function shareImage() {
    const qr = $("#myqr canvas") || $("#myqr img");
    if (!qr) return null;
    const W = 1080, H = 1350, c = document.createElement("canvas"), x = c.getContext("2d");
    c.width = W; c.height = H;
    const g = x.createRadialGradient(W, 0, 60, W * .6, H * .4, H);
    g.addColorStop(0, "#14402F"); g.addColorStop(.45, "#0C2A1D"); g.addColorStop(1, "#060B09");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = "rgba(52,224,161,.06)"; x.lineWidth = 2;
    for (let i = 0; i < W; i += 54) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
    for (let i = 0; i < H; i += 54) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
    try { await document.fonts.ready; } catch (_) {}
    const font = (w, s) => `${w} ${s}px "Space Grotesk", Arial, sans-serif`;
    x.textAlign = "center";
    x.fillStyle = "#34E0A1"; x.font = font(600, 30); x.fillText("SMART FUNNELS · AFFILIATE GRAND SLAM ROME", W / 2, 110);
    x.fillStyle = "#FFFDFC"; x.font = font(700, 74); x.fillText("How many winning", W / 2, 220);
    x.fillStyle = "#34E0A1"; x.fillText("landing pages", W / 2, 302);
    x.fillStyle = "#FFFDFC"; x.fillText("can you spot?", W / 2, 384);
    const S = 560, X = (W - S) / 2, Y = 450;
    x.fillStyle = "#fff"; x.beginPath(); (x.roundRect ? x.roundRect(X - 30, Y - 30, S + 60, S + 60, 36) : x.rect(X - 30, Y - 30, S + 60, S + 60)); x.fill();
    x.imageSmoothingEnabled = false; x.drawImage(qr, X, Y, S, S);
    x.fillStyle = "#FFFDFC"; x.font = font(700, 44); x.fillText("Scan to play. Beat my score!", W / 2, 1150);
    x.fillStyle = "#9DA4A2"; x.font = font(500, 30); x.fillText(myLink().replace(/^https?:\/\//, ""), W / 2, 1210);
    return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
  }
  $("#sh-share").addEventListener("click", async () => {
    const data = { title: "Spot the Winner", text: SHARE_TEXT, url: myLink() };
    if (!navigator.share) return $("#sh-copy").click();
    try {
      const blob = await shareImage();
      const file = blob && new File([blob], "spot-the-winner-qr.png", { type: "image/png" });
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ ...data, files: [file] });
      else await navigator.share(data);
    } catch (_) {}
  });
  $("#sh-save").addEventListener("click", async () => {
    try {
      const blob = await shareImage();
      if (!blob) throw new Error("no qr");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "spot-the-winner-qr.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (_) { toast("Tap the QR code, then long-press it to save."); }
  });

  // Tap any QR code to show it full screen, so a friend can scan it from your phone.
  function zoomQR(link, title) {
    $("#qz-title").textContent = title;
    drawQR($("#qz-code"), link);
    $("#qrzoom").hidden = false;
  }
  $("#qz-close").addEventListener("click", () => ($("#qrzoom").hidden = true));
  $("#qrzoom").addEventListener("click", (e) => { if (e.target.id === "qrzoom") $("#qrzoom").hidden = true; });
  $("#myqr").addEventListener("click", () => zoomQR(myLink(), "Ask your friend to scan this"));
  $$("[data-qr]").forEach((el) => el.addEventListener("click", () => zoomQR(GAME_URL, "Scan to play")));

  // ---------- returning players, resume, reset ----------
  function showMyResult() {
    const f = st.player.first;
    st.playId = f.playId;
    st.rounds = f.rounds.map(([id, flip]) => ({ p: BY_ID[id], flip }));
    st.answers = f.answers;
    st.thinkMs = f.t;
    renderResult(f.s);
    show("res");
    flush().then(loadBoard);
  }
  $("#btn-myresult").addEventListener("click", showMyResult);
  $("#btn-resume").addEventListener("click", () => {
    const p = loadProgress();
    if (!p) return;
    Object.assign(st, { player: p.player, playId: p.playId, rounds: p.rounds.map(([id, flip]) => ({ p: BY_ID[id], flip })), answers: p.answers, i: p.answers.length, thinkMs: p.thinkMs });
    beginRounds();
    SND.startMusic();
  });

  function renderReg() {
    const prog = loadProgress();
    $("#resume-note").hidden = !prog;
    if (prog) $("#resume-round").textContent = `${prog.answers.length + 1}/${ROUNDS}`;
    const pl = local(K.player);
    st.player = pl;
    const played = pl && pl.first && pl.first.rounds && pl.first.rounds.every(([id]) => BY_ID[id]);
    $("#played-note").hidden = !played;
    if (played) $("#played-text").textContent = `Welcome back, ${pl.name.split(" ")[0]}. Your first score: ${pl.first.s}/${ROUNDS} in ${secs(pl.first.t)} s.`;
    if (pl) { $("#f-name").value = pl.name; $("#f-email").value = pl.email; $("#f-store").value = pl.store; }
    show("reg");
  }

  function resetToStart() {
    session(K.progress, null);
    $("#form").reset();
    $("#reward").hidden = true;
    st.scans = 0;
    placeQR.drawn = null;
    $$("#email-report, [data-email-report]").forEach((b) => { b.disabled = false; b.textContent = b.id ? "✉ Email me my full report" : "✉ Email me this report"; });
    SND.stopMusic();
    if ($("#rules").open) $("#rules").close();
    renderReg();
  }

  // Tester shortcut: open the link with #reset to become a first-time visitor again.
  function testerReset() {
    if (location.hash !== "#reset") return false;
    [K.player, K.seen].forEach((k) => store("localStorage", k, null));
    session(K.progress, null);
    try { history.replaceState(null, "", location.pathname + location.search); } catch (_) {}
    resetToStart();
    toast("Reset: you're a first-time visitor again.");
    return true;
  }
  addEventListener("hashchange", testerReset);

  // ---------- kiosk ----------
  let idle = null;
  function kioskIdle() {
    if (!KIOSK) return;
    clearTimeout(idle);
    const ms = st.screen === "reg" ? 0 : st.screen === "quiz" ? 120000 : 45000;
    if (ms) idle = setTimeout(resetToStart, ms);
  }
  ["pointerdown", "keydown"].forEach((ev) => addEventListener(ev, kioskIdle, { passive: true }));
  $("#next-player").addEventListener("click", resetToStart);
  $$("[data-next]").forEach((b) => b.addEventListener("click", resetToStart));

  // ---------- music toggle ----------
  const sb = $("#snd");
  const paint = (m) => { sb.setAttribute("aria-pressed", String(m)); sb.setAttribute("aria-label", m ? "Unmute music" : "Mute music"); };
  paint(SND.isMuted());
  sb.addEventListener("click", () => { const m = SND.toggle(); paint(m); if (!m && st.screen === "quiz") SND.startMusic(); });

  // ---------- confetti (brand greens only) ----------
  function confetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = $("#confetti"), ctx = cv.getContext("2d"), dpr = devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = ["#34E0A1", "#169E79", "#FFFDFC"];
    const bits = Array.from({ length: 150 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * .35, vx: (Math.random() - .5) * 16, vy: -Math.random() * 15 - 4, r: Math.random() * 3, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, c: cols[(Math.random() * 3) | 0] }));
    const t0 = performance.now();
    (function f(now) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      bits.forEach((b) => { b.vy += .35; b.x += b.vx; b.y += b.vy; b.r += b.vr; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore(); });
      if (now - t0 < 3000) requestAnimationFrame(f); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(t0);
  }

  // Every country's dialling code; the event's most common countries first. Italy is the default.
  function fillDialCodes() {
    const list = window.SF_COUNTRIES || [];
    if (!list.length) return;
    const flag = (iso) => iso.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
    const opt = ([iso, name, code], sel) => `<option value="${code}"${sel ? " selected" : ""}>${flag(iso)} ${code} · ${name}</option>`;
    const top = ["IT", "GB", "US", "DE", "FR", "ES", "NL"].map((iso) => list.find((c) => c[0] === iso)).filter(Boolean);
    $("#f-dial").innerHTML = `<optgroup label="Common">${top.map((c, i) => opt(c, i === 0)).join("")}</optgroup>`
      + `<optgroup label="All countries">${list.map((c) => opt(c, false)).join("")}</optgroup>`;
  }

  // ---------- init ----------
  function init() {
    if (KIOSK) document.body.classList.add("kiosk");
    $$("[data-cfg]").forEach((el) => (el.textContent = CFG[el.dataset.cfg]));
    $$("[data-cfg-href]").forEach((el) => (el.href = CFG[el.dataset.cfgHref]));
    $("#rules-close").textContent = new Date(CFG.ENTRIES_CLOSE_AT).toLocaleString("en-GB", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) + " (Rome time)";
    $$("[data-open]").forEach((b) => b.addEventListener("click", () => $(`#${b.dataset.open}`).showModal()));
    $$("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
    fillDialCodes();
    $("#prefill").hidden = !DEMO;
    $("#demo-note").hidden = !DEMO;
    $("#sim").hidden = !DEMO;
    $$("[data-qr]").forEach((el) => drawQR(el, GAME_URL));

    // Count the visit once per session, and a scan when the game opens from someone's QR.
    if (!DEMO && !session(K.seen)) {
      session(K.seen, 1);
      enqueue({ action: "event", type: "view", device_id: DEVICE, ref: REF_IN });
      if (REF_IN) enqueue({ action: "scan", ref: REF_IN, device_id: DEVICE });
    }
    flush();
    if (testerReset()) return;
    renderReg();
    if (ME) {
      const pl = local(K.player);
      if (pl && pl.ref === ME && pl.first && $("#played-note").hidden === false) showMyResult();
      else st.player = { ref: ME };
      openQR();
    }
  }
  init();
})();
