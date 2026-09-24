/* ============================================================
   game/ambience.js — 반지하 방 소리 (v2 · 2026-09-25)
   ------------------------------------------------------------
   음악 밑에 아주 작게 깔리는 «방의 숨». 전부 합성이다(받을 바이트 0 · music.js 와 같은 근거).
     ① 냉장고 웅 — 60Hz 와 배음(120·180·240)에 눌린 잡음. 몇 분 돌고 쉬고, 켜고 끌 때 딸깍
     ② 방 공기 — 아주 여린 분홍 잡음(낮은 쪽만)
     ③ 높은 창 너머 — 가끔 지나가는 발소리 · 먼 차 · 배달 오토바이. 벽 너머라 둔하게, 좌우로 지나간다
     ④ 밤비 — 밤 가운데 몇 밤은 창에 가는 비(가랑비 쉬 + 가끔 물방울)

   ★ 부르는 쪽(game.html)이 음악과 **같은 AudioContext**(musicCtx)를 넘긴다 — 셋째 컨텍스트를 안 만든다.
   ★ 켬/끔은 음악과 같은 스위치(byeot.music · ♪ 단추)를 탄다. 여기서 localStorage 를 안 읽는다.
   ★ 사용자 손짓 뒤에만 start() 가 불린다(game.html startMusic). 탭이 숨으면 스스로 멎고, 돌아오면 잇는다.
   ★ 예약은 setInterval + 오디오 시계. rAF 를 안 쓴다(music.js §예약).
   ★ 끄면 오실레이터·잡음 원천을 **실제로 멈춘다** — 꺼 둔 동안 오디오 스레드를 안 먹는다.

   끄기: ?v2=0 · ?v2amb=0 · localStorage 'byeot.v2amb' = '0'
   재기: tools/probe_v2_camaudio.mjs A-4 (OfflineAudioContext 로 굽고 음악과 RMS 를 견준다)
============================================================ */
import { v2Flag } from './camera_moves.js';

/* 세기 — 음악(RMS ≈ 0.04~0.06) 밑으로 12~18dB. 귀로 못 들으니 probe 로 잰다 */
export const AMB = {
  vol: 0.34,                       // 마스터
  hum:   { gain: 0.025,   /* v2 합치기 검토: 늘 켜져 있는 소리라 절반으로 */ hz: 60, cycleOn: [70, 150], cycleOff: [25, 60], ramp: 2.2 },
  air:   { gain: 0.030, lp: 520 },
  rain:  { gain: 0.060, chance: 0.45, fade: 7 },
  street: { dayGap: [16, 42], nightGap: [40, 100], wallLp: 900 }
};

function rngOf(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const lerp = (a, b, t) => a + (b - a) * t;
const between = (r, rng) => lerp(r[0], r[1], rng());

/* 잡음 버퍼 — 길이를 서로 다르게 해 되풀이 자리가 안 겹치게 한다 */
function noiseBuffer(ctx, sec, kind, rng) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * sec));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const w = rng() * 2 - 1;
    if (kind === 'pink') {        // Paul Kellet
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    } else if (kind === 'brown') {
      last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5;
    } else d[i] = w;
  }
  /* 이음매에서 딸깍 안 나게 끝 20ms 를 처음으로 겹쳐 흐린다 */
  const x = Math.min(n >> 2, Math.floor(ctx.sampleRate * 0.02));
  for (let i = 0; i < x; i++) { const t = i / x; d[n - x + i] = d[n - x + i] * (1 - t) + d[i] * t; }
  return buf;
}

export function createAmbience(ctx, opt = {}) {
  if (!v2Flag('v2amb')) return null;
  if (!ctx || typeof ctx.createGain !== 'function') return null;

  const rng = rngOf(opt.seed || 20260925);
  const phaseOf = () => { try { const p = opt.phase ? +opt.phase() : NaN; return Number.isFinite(p) ? p : 0.4; } catch { return 0.4; } };
  const dayOf = () => { try { const d = opt.day ? +opt.day() : NaN; return Number.isFinite(d) ? d : 1; } catch { return 1; } };
  const isNight = (p) => p < 0.23 || p > 0.83;       // 05:30 전 · 20:00 뒤
  /* 비 오는 밤인가 — 날마다 정해진다(같은 밤에 켰다 껐다 하지 않는다) */
  const rainyNight = (day) => {
    if (opt.rain === true) return true;
    if (opt.rain === false) return false;
    const r = rngOf(0x9e3779b1 ^ (day * 2654435761 >>> 0))(); return r < AMB.rain.chance;
  };

  const master = ctx.createGain();
  master.gain.value = 0;
  /* 벽 너머 소리는 높은 쪽이 먹힌다 — 전체를 살짝 눌러 둔다(폰 스피커에서 쉬익이 안 튀게) */
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 7000; tone.Q.value = 0.5;
  master.connect(tone).connect(ctx.destination);

  let bufs = null;               // 잡음 버퍼(처음 켤 때 한 번)
  let live = null;               // 켜져 있는 동안의 원천들
  let timer = null, playing = false, wanted = false, hiddenPause = false;
  let transient = 0, fired = { steps: 0, car: 0, moto: 0, drip: 0, relay: 0 };
  let nextStreet = 0, nextDrip = 0, fridgeOn = true, fridgeNext = 0;
  let rainK = 0;

  const pan = (dest, p) => {
    if (typeof ctx.createStereoPanner !== 'function') return { node: dest, set() { } };
    const s = ctx.createStereoPanner(); s.pan.value = p; s.connect(dest);
    return { node: s, set: (v, at) => s.pan.linearRampToValueAtTime(v, at), p: s.pan };
  };
  const track = (src, at) => { transient++; src.onended = () => { transient = Math.max(0, transient - 1); }; };
  function oneNoise(at, dur, { buf = 'white', type = 'lowpass', hz = 800, q = 0.7, peak = 0.1, attack = 0.005, dest = master }) {
    const s = ctx.createBufferSource(); s.buffer = bufs[buf];
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(at, rng() * (bufs[buf].duration - dur - 0.05)); s.stop(at + dur + 0.05);
    track(s, at);
    return { s, f, g };
  }

  /* ── 지속음(켜 있는 동안) ─────────────────────────── */
  function buildLive(t) {
    if (!bufs) bufs = {
      white: noiseBuffer(ctx, 3.1, 'white', rng),
      pink: noiseBuffer(ctx, 4.3, 'pink', rng),
      brown: noiseBuffer(ctx, 5.7, 'brown', rng)
    };
    const L = { srcs: [], nodes: [] };
    const keep = (n) => { L.nodes.push(n); return n; };
    /* ① 냉장고 — 60Hz 와 배음. 폰 스피커는 60Hz 를 못 내므로 120·180·240 이 «웅»을 들려준다 */
    L.fridge = keep(ctx.createGain()); L.fridge.gain.value = AMB.hum.gain;      // 켜고 끄는 포락선
    const breath = keep(ctx.createGain()); breath.gain.value = 1;                // 느린 숨(아래 lfo)
    const humLp = keep(ctx.createBiquadFilter()); humLp.type = 'lowpass'; humLp.frequency.value = 420;
    L.fridge.connect(breath).connect(humLp).connect(master);
    for (const [mul, a, type] of [[1, 0.55, 'sine'], [2, 0.42, 'sine'], [3, 0.16, 'sine'], [4, 0.07, 'triangle']]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = AMB.hum.hz * mul;
      o.detune.value = (rng() - 0.5) * 6;
      const g = keep(ctx.createGain()); g.gain.value = a;
      o.connect(g).connect(L.fridge); o.start(t); L.srcs.push(o);
    }
    const rumble = ctx.createBufferSource(); rumble.buffer = bufs.brown; rumble.loop = true;
    const rbp = keep(ctx.createBiquadFilter()); rbp.type = 'bandpass'; rbp.frequency.value = 110; rbp.Q.value = 0.8;
    const rg = keep(ctx.createGain()); rg.gain.value = 0.9;
    rumble.connect(rbp).connect(rg).connect(L.fridge); rumble.start(t, rng() * 4); L.srcs.push(rumble);
    /* 웅이 한 자리에 박혀 있으면 기계음이다 — 아주 느리게 숨 쉬게 한다 */
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoG = keep(ctx.createGain()); lfoG.gain.value = 0.18;
    lfo.connect(lfoG).connect(breath.gain); lfo.start(t); L.srcs.push(lfo);
    /* ② 방 공기 */
    const air = ctx.createBufferSource(); air.buffer = bufs.pink; air.loop = true;
    const alp = keep(ctx.createBiquadFilter()); alp.type = 'lowpass'; alp.frequency.value = AMB.air.lp;
    L.air = keep(ctx.createGain()); L.air.gain.value = AMB.air.gain;
    air.connect(alp).connect(L.air).connect(master); air.start(t, rng() * 3); L.srcs.push(air);
    /* ④ 비 — 늘 돌려 두고 세기만 올리고 내린다(켜고 끌 때 이음매가 안 난다) */
    const rain = ctx.createBufferSource(); rain.buffer = bufs.white; rain.loop = true;
    const rhp = keep(ctx.createBiquadFilter()); rhp.type = 'highpass'; rhp.frequency.value = 600;
    const rlp = keep(ctx.createBiquadFilter()); rlp.type = 'lowpass'; rlp.frequency.value = 4200;
    L.rain = keep(ctx.createGain()); L.rain.gain.value = 0;
    rain.connect(rhp).connect(rlp).connect(L.rain).connect(master); rain.start(t, rng() * 2); L.srcs.push(rain);
    L.rainBus = L.rain;
    return L;
  }
  function killLive(L, at) {
    if (!L) return;
    for (const s of L.srcs) { try { s.stop(at); } catch { } }
    setTimeout(() => { for (const n of L.nodes) { try { n.disconnect(); } catch { } } }, Math.max(0, (at - ctx.currentTime) * 1000) + 200);
  }

  /* ── 사건(가끔) ─────────────────────────────────── */
  function relay(at) {         // 냉장고 계전기 딸깍 — 아주 작게
    oneNoise(at, 0.05, { type: 'bandpass', hz: 2400, q: 3, peak: 0.035, attack: 0.001 });
    oneNoise(at + 0.012, 0.09, { buf: 'brown', type: 'lowpass', hz: 300, peak: 0.05, attack: 0.002 });
    fired.relay++;
  }
  function steps(at) {          // 창 너머로 지나가는 발소리 — 다가왔다 멀어진다
    const n = 8 + Math.floor(rng() * 6), gap = 0.46 + rng() * 0.12;
    const dir = rng() < 0.5 ? -1 : 1;
    const P = pan(master, -0.8 * dir);
    const wall = ctx.createBiquadFilter(); wall.type = 'lowpass'; wall.frequency.value = AMB.street.wallLp;
    wall.connect(P.node);
    if (P.p) { P.p.setValueAtTime(-0.8 * dir, at); P.p.linearRampToValueAtTime(0.8 * dir, at + n * gap); }
    for (let i = 0; i < n; i++) {
      const t = at + i * gap + (rng() - 0.5) * 0.03;
      const env = Math.sin(Math.PI * (i + 0.5) / n);            // 가까워졌다 멀어진다
      const pk = 0.10 * (0.25 + 0.75 * env) * (i % 2 ? 0.85 : 1);
      oneNoise(t, 0.09, { buf: 'brown', type: 'lowpass', hz: 420, peak: pk * 1.4, attack: 0.004, dest: wall });
      oneNoise(t + 0.02, 0.05, { type: 'bandpass', hz: 1500, q: 1.2, peak: pk * 0.25, attack: 0.002, dest: wall });
    }
    setTimeout(() => { try { wall.disconnect(); P.node !== master && P.node.disconnect(); } catch { } },
               Math.max(0, (at - ctx.currentTime + n * gap + 1) * 1000));
    fired.steps++;
    return n * gap;
  }
  function car(at) {            // 먼 차 — 쉬이이 하고 지나간다
    const dur = 4.5 + rng() * 2.5, dir = rng() < 0.5 ? -1 : 1;
    const P = pan(master, -0.9 * dir);
    if (P.p) { P.p.setValueAtTime(-0.9 * dir, at); P.p.linearRampToValueAtTime(0.9 * dir, at + dur); }
    const s = ctx.createBufferSource(); s.buffer = bufs.pink; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9;
    f.frequency.setValueAtTime(260, at); f.frequency.linearRampToValueAtTime(620, at + dur * 0.5);
    f.frequency.linearRampToValueAtTime(240, at + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.09, at + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f).connect(g).connect(P.node); s.start(at, rng() * 3); s.stop(at + dur + 0.1); track(s, at);
    fired.car++;
    return dur;
  }
  function moto(at) {           // 배달 오토바이 — 톱니 엔진이 도플러로 내려간다. 벽 너머라 둔하다
    const dur = 3.6 + rng() * 1.6, dir = rng() < 0.5 ? -1 : 1, hz = 72 + rng() * 18;
    const P = pan(master, -0.9 * dir);
    if (P.p) { P.p.setValueAtTime(-0.9 * dir, at); P.p.linearRampToValueAtTime(0.9 * dir, at + dur); }
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(hz * 1.08, at); o.frequency.linearRampToValueAtTime(hz * 1.05, at + dur * 0.45);
    o.frequency.linearRampToValueAtTime(hz * 0.9, at + dur * 0.6); o.frequency.linearRampToValueAtTime(hz * 0.86, at + dur);
    const vib = ctx.createOscillator(); vib.frequency.value = 9 + rng() * 4;
    const vg = ctx.createGain(); vg.gain.value = hz * 0.03; vib.connect(vg).connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 480; f.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.045, at + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(f).connect(g).connect(P.node);
    o.start(at); vib.start(at); o.stop(at + dur + 0.1); vib.stop(at + dur + 0.1); track(o, at);
    fired.moto++;
    return dur;
  }
  function drip(at) {           // 창틀 물방울 — 똑
    const o = ctx.createOscillator(); o.type = 'sine';
    const hz = 900 + rng() * 900;
    o.frequency.setValueAtTime(hz, at); o.frequency.exponentialRampToValueAtTime(hz * 0.55, at + 0.06);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.03 * rainK + 0.0002, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    const P = pan(master, (rng() - 0.5) * 1.2);
    o.connect(g).connect(P.node); o.start(at); o.stop(at + 0.12); track(o, at);
    fired.drip++;
  }

  /* ── 예약: 오디오 시계로 horizon 까지 채운다(살아서는 setInterval 이, 굽기는 _renderPlan 이 부른다) */
  function plan(now, horizon, phase, day) {
    if (!live) return;
    /* 냉장고 켜고 끄기 */
    while (fridgeNext < horizon) {
      const at = Math.max(fridgeNext, now);
      fridgeOn = !fridgeOn;
      const g = live.fridge.gain, R = AMB.hum.ramp;
      /* 앞 상태의 값에서 출발한다(g.value 는 «지금» 값이라 미리 건 자리에서는 틀린다) */
      g.setValueAtTime(fridgeOn ? 0.0001 : AMB.hum.gain, at);
      if (fridgeOn) { relay(at); g.linearRampToValueAtTime(AMB.hum.gain, at + R); }
      else { g.linearRampToValueAtTime(0.0001, at + R * 1.5); relay(at + R * 1.5); }
      fridgeNext = at + between(fridgeOn ? AMB.hum.cycleOn : AMB.hum.cycleOff, rng);
    }
    /* 비 — 밤이고 비 오는 밤이면 천천히 오르고, 아니면 천천히 걷힌다 */
    const night = isNight(phase);
    const wantRain = night && rainyNight(day) ? 1 : 0;
    if (wantRain !== rainK) {
      rainK = wantRain;
      const g = live.rain.gain;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(AMB.rain.gain * rainK, now + AMB.rain.fade);
    }
    if (rainK > 0) {
      if (nextDrip < now) nextDrip = now + rng() * 0.5;
      while (nextDrip < horizon) { drip(nextDrip); nextDrip += 0.35 + rng() * 1.6; }
    }
    /* 창 너머 — 반지하만. 밤에는 드물다(비 오면 더 드물다) */
    if (opt.basement && !opt.basement()) return;
    if (!nextStreet) nextStreet = now + 4 + rng() * 8;            // 켜자마자 나면 놀란다
    while (nextStreet < horizon) {
      const at = Math.max(nextStreet, now + 0.05);
      const r = rng();
      let dur;
      if (night) dur = r < 0.6 ? steps(at) : car(at);
      else dur = r < 0.5 ? steps(at) : r < 0.8 ? car(at) : moto(at);
      const gap = night ? AMB.street.nightGap : AMB.street.dayGap;
      nextStreet = at + dur + between(gap, rng) * (rainK ? 1.5 : 1);
    }
  }

  function pump() {
    try {
      if (!playing) return;
      const now = ctx.currentTime;
      plan(now, now + 1.5, phaseOf(), dayOf());
    } catch (e) { console.warn('[방 소리]', e && e.message); }
  }

  function start() {
    wanted = true;
    if (playing) return true;
    if (typeof document !== 'undefined' && document.hidden) { hiddenPause = true; return false; }
    try {
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      const t = ctx.currentTime + 0.05;
      live = buildLive(t);
      fridgeOn = true; fridgeNext = t + between(AMB.hum.cycleOn, rng) * 0.6;
      nextStreet = 0; nextDrip = 0; rainK = 0;
      playing = true; hiddenPause = false;
      pump();
      if (typeof setInterval === 'function') timer = setInterval(pump, 500);
      fade(AMB.vol, 2.5);          // 천천히 스민다 — 켜진 줄 모르게
      return true;
    } catch (e) { console.warn('[방 소리] 못 켰다 —', e && e.message); playing = false; return false; }
  }
  function fade(to, sec) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
    master.gain.linearRampToValueAtTime(Math.max(to, 0), t + sec);
  }
  function halt(sec) {
    if (!playing) return;
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
    fade(0, sec);
    killLive(live, ctx.currentTime + sec + 0.05); live = null;
  }
  function stop() { wanted = false; hiddenPause = false; halt(0.5); }

  /* 탭이 숨으면 멎고, 돌아오면 잇는다(끈 사람이면 안 켠다) */
  const onVis = () => {
    try {
      if (document.hidden) { if (playing) { halt(0.25); hiddenPause = true; } }
      else if (hiddenPause && wanted) { hiddenPause = false; start(); }
    } catch (e) { console.warn('[방 소리]', e && e.message); }
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);

  const api = {
    start, stop,
    isPlaying: () => playing,
    stats() {
      const persistent = live ? live.srcs.length + live.nodes.length : 0;
      return { playing, wanted, hiddenPause, ctxState: ctx.state, master: +master.gain.value.toFixed(4),
               nodes: persistent + transient + 2, persistent, transient, fridgeOn, rain: rainK,
               night: isNight(phaseOf()), phase: +phaseOf().toFixed(3), fired: { ...fired } };
    },
    /* 굽기(검사)용 — 타이머 없이 sec 까지 전부 예약한다 */
    _renderPlan(sec, phase = 0.4, day = 1) {
      live = buildLive(0); playing = true;
      fridgeOn = true; fridgeNext = between(AMB.hum.cycleOn, rng) * 0.6;
      nextStreet = 0.5; nextDrip = 0;
      master.gain.setValueAtTime(AMB.vol, 0);
      for (let t = 0; t < sec; t += 1) plan(t, Math.min(sec, t + 1), phase, day);
    },
    dispose() {
      stop();
      try { document.removeEventListener('visibilitychange', onVis); } catch { }
      setTimeout(() => { try { master.disconnect(); tone.disconnect(); } catch { } }, 800);
    }
  };
  try { (window.__v2 = window.__v2 || {}).amb = api; } catch { }
  return api;
}
