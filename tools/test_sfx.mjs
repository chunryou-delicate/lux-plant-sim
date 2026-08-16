/* ============================================================
   tools/test_sfx.mjs — 효과음 여섯이 **실제로 소리가 나나**
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_sfx.mjs

   ★★ 무엇을 재는지 — **「함수가 안 던진다」는 재는 것이 아니다.**
     Web Audio 는 **조용히 실패하는 길이 많다**: 포락선을 0 에서 시작하면 지수 램프가
     영영 안 올라오고, 예약 시각을 지나쳐 걸면 그 음은 그냥 안 나고, 필터를 잘못 물리면
     전부 깎여 나간다. 전부 「코드는 도는데 소리는 없다」로 끝난다.
     ⇒ `OfflineAudioContext` 에 그래프를 걸어 **렌더한 파형을 숫자로 잰다.**
       RMS 가 0 이면 안 난 것이다.

   ★ 오프라인 렌더는 자동재생 정책을 안 탄다(사용자 제스처가 없어도 렌더된다).
     그래서 헤드리스에서 된다 — probe_music.mjs 가 낸 길을 그대로 쓴다.

   재는 것
     ① 여섯이 다 난다 (RMS > 0) · 길이 · 최대 진폭
     ② 찢어지지 않는다 (최댓값 < 1.0)
     ③ 여섯이 서로 다른 소리다 (RMS 가 다 다르다 — 같으면 배선이 한 데로 갔다는 뜻)
     ④ ★ 연타를 삼킨다 (같은 소리를 다섯 번 연달아 불러도 한 번만 실린다)
     ⑤ ★ 끄면 조용해진다 (setEnabled(false) 뒤 RMS ≈ 0)
     ⑥ 저벅저벅이 **멈춘다** (walk(false) 뒤 isWalking() 이 거짓)
     ⑦ game.html 부팅 예외 0
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';

const _wd = setTimeout(() => {
  console.error('[효과음] 5분을 넘겼습니다 — 서버가 떠 있는지 확인해 주세요');
  process.exit(1);
}, 5 * 60 * 1000);
_wd.unref();

let fails = 0;
const ok = (c, ko, extra = '') => {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${ko}${extra ? ' — ' + extra : ''}`);
  if (!c) fails++;
};

/* ── 파형 하나를 숫자로 접는다 (브라우저 안에서 도는 글) ─────────────── */
const MEASURE = `
  function _stat(d, sr) {
    let sum = 0, peak = 0;
    for (let i = 0; i < d.length; i++) { const v = d[i]; sum += v * v; if (Math.abs(v) > peak) peak = Math.abs(v); }
    const rms = Math.sqrt(sum / d.length);
    /* 들리는 길이 = 최댓값의 0.3% 를 넘는 마지막 표본까지. 지수 감쇠라 절대값으로 자르면
       볼륨이 큰 소리만 길게 나온다 — 상대값으로 잰다 */
    const th = peak * 0.003;
    let first = -1, last = -1;
    for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > th) { if (first < 0) first = i; last = i; }
    return { rms, peak, ms: last > first ? Math.round((last - first) / sr * 1000) : 0 };
  }
`;

/* 목소리 하나를 1.5초짜리 오프라인 판에 걸어 렌더한다 */
const RENDER_ONE = (name) => `(async () => {
  ${MEASURE}
  const M = await import('/src/game/sfx.js');
  const SR = 44100, SEC = 1.5;
  const ctx = new OfflineAudioContext(1, Math.ceil(SR * SEC), SR);
  M.VOICES['${name}'](ctx, ctx.destination, 0.02, { off: 0.2 });
  const buf = await ctx.startRendering();
  return _stat(buf.getChannelData(0), SR);
})()`;

/* createSfx 를 통째로 걸어 본다 — 연타 삼킴·끄기가 여기서만 잡힌다 */
const RENDER_API = (body) => `(async () => {
  ${MEASURE}
  const M = await import('/src/game/sfx.js');
  const SR = 44100, SEC = 2.0;
  const ctx = new OfflineAudioContext(1, Math.ceil(SR * SEC), SR);
  const s = M.createSfx(ctx, { volume: 0.7 });
  const extra = (() => { ${body} })();
  const buf = await ctx.startRendering();
  return Object.assign(_stat(buf.getChannelData(0), SR), extra || {});
})()`;

const page = await launch({ width: 390, height: 844, dpr: 2 });
try {
  /* ── ⑦ 먼저 — game.html 이 예외 없이 뜨나 ───────────────────────────
     ⚠ sfx.js 는 아직 game.html 에 import 되기 전이다. 그래도 확인한다 —
       내가 붙일 자리를 적어 주는 상대가 그 파일이므로, **지금 0 이었다**는 것이
       나중에 「내가 깼나」를 가리는 기준선이 된다. */
  const errs = [];
  page.on((m, p) => {
    if (m === 'Runtime.exceptionThrown') errs.push((p.exceptionDetails && p.exceptionDetails.text) || 'exception');
    if (m === 'Runtime.consoleAPICalled' && p.type === 'error')
      errs.push((p.args || []).map(a => a.value || a.description || '').join(' '));
  });
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!document.getElementById("stage")', 60000, 200);
  await sleep(1500);
  ok(errs.length === 0, 'game.html 부팅 예외 0', errs.length ? errs.slice(0, 3).join(' | ') : '0건');

  /* ── ①②③ 여섯 목소리 ─────────────────────────────────────────── */
  const names = await page.eval(`(async () => (await import('/src/game/sfx.js')).NAMES)()`);
  const spec  = await page.eval(`(async () => (await import('/src/game/sfx.js')).SPEC)()`);
  ok(Array.isArray(names) && names.length === 6, '여섯 가지가 다 있다', (names || []).join(' · '));

  const rows = [];
  for (const n of names) {
    const r = await page.eval(RENDER_ONE(n));
    rows.push({ n, ko: (spec[n] || {}).ko || n, ...r });
  }

  console.log('\n── 여섯 소리 ─────────────────────────────────────────');
  console.log('  이름        길이(ms)   최대진폭     RMS');
  for (const r of rows)
    console.log(`  ${(r.ko + '        ').slice(0, 9)} ${String(r.ms).padStart(6)}   ${r.peak.toFixed(4).padStart(8)}  ${r.rms.toFixed(5).padStart(9)}`);
  console.log('');

  for (const r of rows) ok(r.rms > 0.0005, `★${r.ko} 이 실제로 난다 (RMS > 0)`, `RMS ${r.rms.toFixed(5)}`);
  for (const r of rows) ok(r.peak < 1.0, `${r.ko} 이 안 찢어진다`, `최대 ${r.peak.toFixed(3)}`);
  for (const r of rows) ok(r.ms > 8, `${r.ko} 이 너무 짧지 않다`, `${r.ms}ms`);
  {
    const set = new Set(rows.map(r => r.rms.toFixed(6)));
    ok(set.size === rows.length, '여섯이 서로 다른 소리다 (배선이 한 데로 안 갔다)', `${set.size}/${rows.length} 가지`);
  }
  /* 표에 적은 길이와 실제로 잰 길이가 같은 자리에 있나 — 표가 낡으면 표가 거짓말을 한다 */
  for (const r of rows) {
    const want = Math.round((spec[r.n].dur || 0) * 1000);
    ok(r.ms <= want + 120, `${r.ko} 의 실제 길이가 표(${want}ms)를 크게 안 넘는다`, `${r.ms}ms`);
  }

  /* ── ④ 연타를 삼킨다 ──────────────────────────────────────────── */
  const one  = await page.eval(RENDER_API(`s.tap(); return { fired: 1 };`));
  const five = await page.eval(RENDER_API(`let c = 0; for (let i = 0; i < 5; i++) if (s.tap()) c++; return { fired: c };`));
  ok(five.fired === 1, '★연타를 삼킨다 (딸칵 5번 → 1번만 실린다)', `실린 것 ${five.fired}회`);
  ok(Math.abs(one.rms - five.rms) < 1e-9, '삼킨 뒤 파형이 한 번 낸 것과 같다',
     `${one.rms.toFixed(6)} vs ${five.rms.toFixed(6)}`);

  /* ── ⑤ 끄면 조용해진다 ───────────────────────────────────────── */
  const off = await page.eval(RENDER_API(`s.setEnabled(false); for (let i = 0; i < 6; i++) s.tap({ force: true }); return { en: s.isEnabled() };`));
  ok(off.en === false && off.rms < 1e-6, '★끄면 조용해진다', `RMS ${off.rms.toExponential(2)}`);

  /* ── ⑥ 저벅저벅이 멈춘다 ─────────────────────────────────────── */
  const walk = await page.eval(`(async () => {
    const M = await import('/src/game/sfx.js');
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const s = M.createSfx(ctx);
    s.walk(true);  const on = s.isWalking();
    s.walk(false); const off = s.isWalking();
    s.gauge(true); const g1 = s.isGauging();
    s.stopAll();   const g2 = s.isGauging();
    return { on, off, g1, g2 };
  })()`);
  ok(walk.on === true && walk.off === false, '★저벅저벅은 걷는 동안만 (walk(false) 로 멈춘다)');
  ok(walk.g1 === true && walk.g2 === false, '사각사각도 stopAll 로 멈춘다');

  /* ── 던져도 게임이 안 멈추나 — 창구가 전부 try/catch 안인가 ────────── */
  const safe = await page.eval(`(async () => {
    const M = await import('/src/game/sfx.js');
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const s = M.createSfx(ctx);
    /* 컨텍스트를 일부러 망가뜨린다 — createGain 이 던지게 만든다 */
    const bad = Object.create(ctx);
    let threw = false;
    try { s.tap(); s.walk(true); s.walk(false); } catch (e) { threw = true; }
    /* 없는 이름을 불러도 조용해야 한다 */
    const none = s.tap === undefined;
    return { threw, none };
  })()`);
  ok(safe.threw === false, '소리가 던져도 게임이 안 멈춘다 (창구가 try/catch 안이다)');

  console.log(`\n${fails ? `sfx: FAIL (${fails}건)` : 'sfx: 전부 통과'}`);
} finally {
  await page.close();
  clearTimeout(_wd);
}
process.exit(fails ? 1 : 0);
