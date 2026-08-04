/* ============================================================
   tools/probe_music.mjs — 배경 음악이 **실제로 소리가 나나**
   ------------------------------------------------------------
     python tools/serve.py 8971
     node tools/probe_music.mjs

   왜 만들었나
     박사님: "음악도 아무거나좀 넣어줄래? 활기찬걸로."
     음악은 눈으로 확인이 안 된다. 그런데 Web Audio 는 **조용히 실패하는 길이 많다** —
     자동재생 정책에 막히면 예외 없이 무음이고, 포락선을 0 에서 시작하면 지수 램프가
     영영 안 올라오고, 예약 시각을 지나쳐 걸면 그 음은 그냥 안 난다.
     전부 "코드는 도는데 소리는 없다"로 끝난다. 그러니 **파형을 숫자로 재야 한다.**

   ★ `OfflineAudioContext` 로 렌더한다 — 실시간이 아니라 계산이라 빠르고,
     자동재생 정책을 안 탄다(사용자 제스처가 없어도 렌더된다). 그래서 헤드리스에서 된다.

   무엇을 재나
     ① 무음이 아닌가 (RMS)
     ② 찢어지지 않나 (최댓값이 1.0 을 안 넘나)
     ③ 박자가 도나 (에너지 봉우리 간격이 BPM 과 맞나)
     ④ 조용한 구간이 길게 비지 않나 (중간에 곡이 죽지 않나)
     ⑤ 같은 씨앗이면 같은 곡인가 (재현되나)
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const SECONDS = 12;                 // 마디 넷이 한 바퀴(약 7.6초)이라 한 바퀴 반이 넘는다
const BPM = 126, BEAT = 60 / BPM;

/* ★ 워치독 — 재는 도구가 스스로 매달리면 안 된다.
   ⚠ `unref()` 를 반드시 부른다. 안 부르면 이 타이머가 살아 있어서 **정상 종료도 막는다**
     (전에 그것 때문에 모든 probe 가 제한시간까지 매달렸다). */
const _wd = setTimeout(() => {
  console.error('[음악] 5분을 넘겼습니다 — 서버가 떠 있는지 확인해 주세요');
  process.exit(1);
}, 5 * 60 * 1000);
_wd.unref();

const RENDER = `(async (secs, seed) => {
  const { createMusic } = await import('/src/game/music.js');
  const SR = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * secs), SR);
  const m = createMusic(ctx, { seed, volume: 0.5, intensity: 0.6 });
  /* 실시간 타이머가 없으므로 직접 채운다(오프라인은 시계가 안 흐른다) */
  m._pumpUntil(secs);
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);

  let sum = 0, peak = 0;
  for (let i = 0; i < d.length; i++) { const v = d[i]; sum += v * v; if (Math.abs(v) > peak) peak = Math.abs(v); }
  const rms = Math.sqrt(sum / d.length);

  /* 10ms 칸으로 에너지를 접어 본다 — 봉우리 간격이 박자다 */
  const W = Math.round(SR * 0.01), n = Math.floor(d.length / W);
  const env = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let i = k * W; i < (k + 1) * W; i++) s += d[i] * d[i];
    env[k] = Math.sqrt(s / W);
  }
  const mx = Math.max(...env);
  /* 봉우리 = 앞뒤보다 크고 평균의 1.6배 넘는 칸 */
  const mean = env.reduce((a, b) => a + b, 0) / n;
  const peaks = [];
  for (let k = 1; k < n - 1; k++)
    if (env[k] > env[k - 1] && env[k] >= env[k + 1] && env[k] > mean * 1.6) peaks.push(k * 0.01);
  const gaps = [];
  for (let i = 1; i < peaks.length; i++) gaps.push(peaks[i] - peaks[i - 1]);
  gaps.sort((a, b) => a - b);
  const medGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;

  /* 가장 긴 '조용한' 구간 — 평균의 12% 밑을 조용한 것으로 본다 */
  let quiet = 0, run = 0;
  for (let k = 0; k < n; k++) {
    if (env[k] < mean * 0.12) { run++; if (run > quiet) quiet = run; } else run = 0;
  }
  return { rms, peak, mx, mean, peakCount: peaks.length, medGap, quietMs: quiet * 10,
           firstSoundMs: (() => { for (let k = 0; k < n; k++) if (env[k] > mean * 0.3) return k * 10; return -1; })() };
})(${SECONDS}, SEED)`;

let fails = 0;
const ok = (c, ko, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${ko}${extra ? ' — ' + extra : ''}`); if (!c) fails++; };

const page = await launch({ width: 390, height: 844, dpr: 2 });
try {
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!document.body', 60000, 200);
  await sleep(800);
  const a = await page.eval(RENDER.replace('SEED', '20260804'));
  console.log('\n── 잰 값 ─────────────────────────────');
  console.log(`  RMS ${a.rms.toFixed(4)} · 최댓값 ${a.peak.toFixed(3)} · 봉우리 ${a.peakCount}개`);
  console.log(`  봉우리 간격(중앙) ${a.medGap.toFixed(3)}초 · 한 박 ${BEAT.toFixed(3)}초 · 8분음 ${(BEAT / 2).toFixed(3)}초`);
  console.log(`  첫 소리 ${a.firstSoundMs}ms · 가장 긴 정적 ${a.quietMs}ms\n`);

  ok(a.rms > 0.01, '★소리가 난다 (무음이 아니다)', `RMS ${a.rms.toFixed(4)}`);
  ok(a.peak < 1.0, '찢어지지 않는다 (최댓값 < 1.0)', a.peak.toFixed(3));
  ok(a.rms < 0.45, '너무 크지 않다', `RMS ${a.rms.toFixed(4)}`);
  ok(a.peakCount > SECONDS * 2, '박자가 계속 돈다', `${a.peakCount}개 봉우리 / ${SECONDS}초`);
  /* 봉우리는 8분음(0.238초)이나 한 박(0.476초) 자리에 선다. 둘 중 하나에 붙으면 된다 */
  const near = x => Math.abs(a.medGap - x) < 0.06;
  ok(near(BEAT) || near(BEAT / 2) || near(BEAT * 2),
     `박자가 ${BPM}BPM 과 맞는다`, `간격 ${a.medGap.toFixed(3)}초`);
  ok(a.firstSoundMs >= 0 && a.firstSoundMs < 600, '시작하자마자 들어온다', `${a.firstSoundMs}ms`);
  ok(a.quietMs < 900, '중간에 곡이 죽지 않는다', `가장 긴 정적 ${a.quietMs}ms`);

  /* ⑤ 재현 — 같은 씨앗이면 같은 곡. 다른 씨앗이면 다른 곡 */
  const b = await page.eval(RENDER.replace('SEED', '20260804'));
  const c = await page.eval(RENDER.replace('SEED', '777'));
  ok(Math.abs(a.rms - b.rms) < 1e-9, '같은 씨앗이면 같은 곡이다 (검사가 재현된다)');
  ok(Math.abs(a.rms - c.rms) > 1e-9, '씨앗이 다르면 가락이 달라진다', `${a.rms.toFixed(4)} vs ${c.rms.toFixed(4)}`);

  console.log(`\n${fails ? `music: FAIL (${fails}건)` : 'music: 전부 통과'}`);
} finally {
  await page.close();
  clearTimeout(_wd);
}
process.exit(fails ? 1 : 0);
