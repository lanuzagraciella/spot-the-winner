// Background music and sound cues, generated in the browser with the Web Audio API:
// no audio files, no licensing, nothing to download. A light electronic loop at
// 112 BPM (A minor → F → C → G): soft pad, plucked arpeggio, bass, kick and hat.
// If config.js sets MUSIC_SRC to a licensed track, that file loops instead.
// Browsers only allow sound after a tap, so music starts from the Play button.
window.SFSound = (() => {
  "use strict";

  const MUTE_KEY = "sf_games_muted_v1";
  const BPM = 112;
  const STEP = 60 / BPM / 4; // one 16th note
  const LEVEL = 0.2; // music volume
  const DUCKED = 0.07; // music volume while an answer is revealed

  // One chord per bar: [bass, pad and arpeggio notes] as MIDI numbers.
  const CHORDS = [
    [45, [57, 60, 64, 69]], // Am
    [41, [57, 60, 65, 69]], // F
    [48, [55, 60, 64, 67]], // C
    [43, [55, 59, 62, 67]], // G
  ];
  const ARP = [0, 1, 2, 3, 2, 1, 3, 2]; // order of chord tones on the 8th notes

  let ctx = null;
  let master = null;
  let music = null;
  let noise = null;
  let loopTimer = null;
  let step = 0;
  let nextAt = 0;
  let playing = false;
  let track = null; // <audio> when MUSIC_SRC is set
  let muted = read();

  function read() {
    try { return localStorage.getItem(MUTE_KEY) === "1"; } catch (_) { return false; }
  }
  function write(v) {
    try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch (_) { /* storage blocked */ }
  }

  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    music = ctx.createGain();
    music.gain.value = LEVEL;
    music.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  // ---------- instruments ----------
  function env(node, t, peak, attack, decay) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function kick(t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    env(g, t, 0.9, 0.003, 0.22);
    o.connect(g).connect(music);
    o.start(t);
    o.stop(t + 0.3);
  }

  function hat(t, peak) {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = ctx.createGain();
    env(g, t, peak, 0.002, 0.045);
    s.connect(f).connect(g).connect(music);
    s.start(t);
    s.stop(t + 0.08);
  }

  function pluck(t, midi) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = hz(midi);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.2);
    const g = ctx.createGain();
    env(g, t, 0.22, 0.004, 0.22);
    o.connect(f).connect(g).connect(music);
    o.start(t);
    o.stop(t + 0.3);
  }

  function bass(t, midi) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = hz(midi - 12);
    const g = ctx.createGain();
    env(g, t, 0.5, 0.01, STEP * 7);
    o.connect(g).connect(music);
    o.start(t);
    o.stop(t + STEP * 8);
  }

  function pad(t, notes) {
    const len = STEP * 16;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.4);
    g.gain.setValueAtTime(0.05, t + len - 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    f.connect(g).connect(music);
    notes.slice(0, 3).forEach((m) => {
      [-6, 6].forEach((cents) => {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = hz(m);
        o.detune.value = cents;
        o.connect(f);
        o.start(t);
        o.stop(t + len + 0.05);
      });
    });
  }

  // ---------- sequencer (look-ahead scheduling keeps timing tight) ----------
  function schedule() {
    while (nextAt < ctx.currentTime + 0.15) {
      const bar = Math.floor(step / 16) % CHORDS.length;
      const s = step % 16;
      const [root, notes] = CHORDS[bar];
      if (s === 0) pad(nextAt, notes);
      if (s % 4 === 0) kick(nextAt);
      if (s % 4 === 2) hat(nextAt, 0.12);
      else if (s % 2 === 1) hat(nextAt, 0.04);
      if (s % 2 === 0) pluck(nextAt, notes[ARP[(s / 2) % ARP.length]] + 12);
      if (s === 0 || s === 8 || s === 14) bass(nextAt, root);
      nextAt += STEP;
      step += 1;
    }
  }

  // ---------- public API ----------
  function startMusic() {
    if (playing) return;
    playing = true;
    const src = window.SF_CONFIG && window.SF_CONFIG.MUSIC_SRC;
    if (src) {
      if (!track) {
        track = new Audio(src);
        track.loop = true;
      }
      track.volume = LEVEL * 1.6;
      track.muted = muted;
      track.play().catch(() => { /* blocked until the next tap */ });
      return;
    }
    if (!ensure()) return;
    if (ctx.state === "suspended" && !muted) ctx.resume();
    music.gain.cancelScheduledValues(ctx.currentTime);
    music.gain.setValueAtTime(LEVEL, ctx.currentTime);
    step = 0;
    nextAt = ctx.currentTime + 0.05;
    clearInterval(loopTimer);
    loopTimer = setInterval(schedule, 25);
    schedule();
  }

  function stopMusic() {
    if (!playing) return;
    playing = false;
    if (track) { track.pause(); track.currentTime = 0; return; }
    clearInterval(loopTimer);
    loopTimer = null;
    if (ctx) {
      music.gain.cancelScheduledValues(ctx.currentTime);
      music.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
    }
  }

  function duck(on) {
    const v = on ? DUCKED : LEVEL;
    if (track) { track.volume = v * 1.6; return; }
    if (!ctx || !playing) return;
    music.gain.cancelScheduledValues(ctx.currentTime);
    music.gain.setTargetAtTime(v, ctx.currentTime, 0.2);
  }

  // Short cue on the reveal: up for a correct answer, down for a wrong one.
  function cue(ok) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime + 0.01;
    const seq = ok ? [76, 81] : [57, 52];
    seq.forEach((m, k) => {
      const o = ctx.createOscillator();
      o.type = ok ? "sine" : "square";
      o.frequency.value = hz(m);
      const g = ctx.createGain();
      env(g, t + k * 0.09, ok ? 0.25 : 0.07, 0.005, 0.18);
      o.connect(g).connect(master);
      o.start(t + k * 0.09);
      o.stop(t + k * 0.09 + 0.25);
    });
  }

  // Rising chord for the result screen; brighter for a high score.
  function sting(high) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime + 0.05;
    const seq = high ? [69, 73, 76, 81, 85] : [69, 72, 76, 81];
    seq.forEach((m, k) => pluck(t + k * 0.08, m));
    music.gain.cancelScheduledValues(ctx.currentTime);
    music.gain.setValueAtTime(LEVEL, ctx.currentTime);
  }

  function setMuted(v) {
    muted = v;
    write(v);
    if (track) track.muted = v;
    if (!ctx) return;
    master.gain.setTargetAtTime(v ? 0 : 1, ctx.currentTime, 0.05);
    if (v) setTimeout(() => muted && ctx.suspend(), 200);
    else ctx.resume();
  }

  // Silence the loop while the tab or phone screen is hidden.
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (playing && !muted) ctx.resume();
  });

  return {
    startMusic,
    stopMusic,
    duck,
    cue,
    sting,
    isMuted: () => muted,
    toggle: () => { setMuted(!muted); return muted; },
    state: () => ({ context: ctx ? ctx.state : "none", playing, muted }),
  };
})();
