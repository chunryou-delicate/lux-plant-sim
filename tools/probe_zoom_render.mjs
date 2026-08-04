/* ============================================================
   tools/probe_zoom_render.mjs — 확대 화면(plant_grow.html) 이 초당 몇 장을 그리나
   ------------------------------------------------------------
   박사님 지적: "화분 상세보기 누르면 렉 걸려. 회전도 잘 안 되고"
   방 쪽(room_view)은 이미 멈췄다. 남은 절반이 이 안이다.

   ★ 왜 새 파일인가 — tools/probe_zoom_inside.mjs 는 iframe 안의 `renderer`·`scene` 을
     window 에서 읽으려 했는데, 그건 <script> 안의 `let` 이라 window 에 안 붙는다.
     그래서 항상 null 이 나왔다. plant_grow 에 읽기 전용 계측 창구
     `__growthStats()` 를 내고 그걸 읽는다.

   재는 것
     ① 가만히 둔 채 — 아무것도 안 바뀌는데 몇 장을 그리나 (여기가 핵심이다)
     ② 회전하는 동안 — 드래그가 실제로 몇 장으로 따라오나
     ③ 자동회전 켠 채
     ④ 미리보기 렌더러가 따로 몇 장을 그리나 (확대에서는 패널이 통째로 안 보인다)

     python tools/serve.py 8971
     node tools/probe_zoom_render.mjs
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

/* ★자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다.
   이게 없어서 측정 하나가 21시간 매달려 있었다. 헤드리스 크롬은 무언가를
   기다리다 영영 안 끝나는 일이 실제로 생긴다. 시간은 환경변수로 늘릴 수 있다. */
const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한 ' + Math.round(_WATCHDOG_MS / 1000) + '초를 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
/* ★타이머가 프로세스를 붙잡으면 안 된다 — unref 를 빠뜨려서
   재기를 다 끝낸 도구가 제한 시간까지 안 죽고 매달려 있었다(넣자마자 났다). */
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));


const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const page = await launch({ width: 390, height: 844, dpr: 2 });

/* iframe 안에서 값을 읽는다 */
const inZoom = (expr) => page.eval(`(()=>{ const f=document.getElementById('growth');
  const w = f && f.contentWindow;
  if(!w) return { err:'iframe 없음' };
  try { return (${expr}); } catch(e) { return { err: String((e&&e.message)||e) }; } })()`);

const stats = (reset) => inZoom(`w.__growthStats(${reset ? 'true' : 'false'})`);

/* n 초 동안 그린 장수를 잰다. 재기 직전에 카운터를 0 으로 돌린다. */
async function measure(label, ms, prep) {
  if (prep) { await prep(); }
  await stats(true);
  await sleep(ms);
  const s = await stats(false);
  if (s.err) { console.log(`${label}: 못 읽음 — ${s.err}`); return s; }
  console.log(`${label}`);
  console.log(`   rAF ${s.rafFps}/s · 본무대 ${s.mainFps}/s (${s.mainMsAvg}ms/장) · 미리보기 ${s.prevFps}/s (${s.prevMsAvg}ms/장)`);
  console.log(`   그린 프레임 간격 — 평균 ${s.avgGapMs}ms · 최대 ${s.maxGapMs}ms (끊김)`);
  console.log(`   드로우콜 ${s.calls} · 삼각형 ${s.triangles} · 지오 ${s.geometries} · 텍스처 ${s.textures} · 프로그램 ${s.programs}`);
  console.log(`   미리보기 콜 ${s.prevCalls} · 삼각형 ${s.prevTriangles} · 캔버스 ${JSON.stringify(s.canvas)} · DPR ${s.pixelRatio}`);
  console.log(`   paused ${s.paused} · embed ${s.embed} · 미리보기객체 ${s.previewOn} · 보이나 ${s.previewVisible} · dirty ${s.dirty}`);
  return s;
}

await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 120000, 300);
await sleep(8000);
await page.eval(`(()=>{try{document.getElementById('dlgSkip').click()}catch{}})()`, false); await sleep(1200);
await page.eval(`(()=>{try{document.getElementById('guideClose').click()}catch{}})()`, false); await sleep(800);

const boot = await inZoom(`typeof w.__growthStats`);
if (boot !== 'function') {
  console.log('★ __growthStats 가 없습니다 — 계측 창구가 안 붙었습니다:', JSON.stringify(boot));
  await page.close(); process.exit(1);
}

console.log('\n═══ 확대를 열기 전 (방만 보이는 상태) ═══');
await measure('닫힌 채 3초', 3000);

await page.eval(`window.__byeotZoom.open()`, false);
await sleep(2500);

console.log('\n═══ 확대를 연 뒤 ═══');
const idle = await measure('① 가만히 3초 (아무것도 안 바뀜)', 3000);

/* ② 회전 — ★브라우저 바깥에서 진짜 마우스 입력을 흘린다.
   페이지 안에서 rAF 루프로 이벤트를 만들면 그 루프가 프레임을 같이 먹어서
   "회전이 부드러운가"를 재는 것이 아니라 내 측정 코드를 재게 된다. */
const rect = await page.eval(`(()=>{ const f=document.getElementById('growth');
  const r=f.getBoundingClientRect();
  return { x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2), w:Math.round(r.width), h:Math.round(r.height) }; })()`);

async function realDrag(ms) {
  const mouse = (type, x, y, btn) => page.send('Input.dispatchMouseEvent',
    { type, x, y, button: btn || 'none', buttons: btn === 'left' ? 1 : 0, clickCount: btn ? 1 : 0 });
  await mouse('mousePressed', rect.x, rect.y, 'left');
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < ms) {
    const k = (Date.now() - t0) / 16;
    await mouse('mouseMoved', Math.round(rect.x + Math.sin(k * 0.2) * (rect.w * 0.35)), rect.y, 'left');
    n++;
  }
  await mouse('mouseReleased', rect.x, rect.y, 'left');
  return n;
}

await stats(true);
const moves = await realDrag(3000);
const s2 = await stats(false);
console.log(`\n② 회전 드래그 3초 (진짜 마우스 입력 ${moves}번 · iframe ${rect.w}×${rect.h})`);
console.log(`   rAF ${s2.rafFps}/s · 본무대 ${s2.mainFps}/s (${s2.mainMsAvg}ms/장) · 미리보기 ${s2.prevFps}/s (${s2.prevMsAvg}ms/장)`);
console.log(`   드로우콜 ${s2.calls} · 삼각형 ${s2.triangles}`);
console.log(`   ★그린 장수 ${s2.mainDraws}장 / 3초 · 입력 1번당 ${(s2.mainDraws / Math.max(1, moves)).toFixed(2)}장`);
console.log(`   그린 프레임 간격 — 평균 ${s2.avgGapMs}ms · 최대 ${s2.maxGapMs}ms`);

/* ③ 손을 뗀 직후 — 관성이 있나(계속 그리나) */
const after = await measure('③ 손 뗀 뒤 2초', 2000);

/* ④ 자동회전 */
await measure('④ 자동회전 3초', 3000, async () => {
  await inZoom(`(w.document.getElementById('btnAuto')&&w.document.getElementById('btnAuto').click(),{ok:1})`);
  await sleep(300);
});
await inZoom(`(w.document.getElementById('btnAuto')&&w.document.getElementById('btnAuto').click(),{ok:1})`);
await sleep(400);

/* ⑤ 확대를 닫으면 (setRenderPaused 계약이 그대로인지) */
await page.eval(`window.__byeotZoom.close()`, false);
await sleep(1200);
await measure('⑤ 확대를 닫고 3초 (setRenderPaused 계약)', 3000);

/* ⑥ ★단독 튜닝 화면은 안 망가졌나 — 거기서는 패널이 보이고 미리보기가 돌아야 한다.
   확대만 보고 고치면 튜닝 창의 에셋 미리보기를 조용히 죽일 수 있다. */
console.log('\n═══ 단독 튜닝 화면 (embed 아님) ═══');
await page.goto(`${BASE}/plant_grow.html`);
await page.waitFor('typeof window.__growthStats === "function"', 60000, 300);
await sleep(6000);
const solo = (reset) => page.eval(`window.__growthStats(${reset ? 'true' : 'false'})`);
await solo(true); await sleep(3000);
const s6 = await solo(false);
console.log(`   가만히 3초 — rAF ${s6.rafFps}/s · 본무대 ${s6.mainFps}/s · 미리보기 ${s6.prevFps}/s`);
console.log(`   embed ${s6.embed} · 미리보기 보이나 ${s6.previewVisible} · 미리보기 삼각형 ${s6.prevTriangles}`);
if (s6.previewVisible !== true) console.log('   ⚠ 단독 화면인데 미리보기가 안 보인다고 나옵니다');
if (!(s6.prevFps > 0))          console.log('   ⚠ 단독 화면인데 미리보기가 안 돕니다 — 튜닝 창을 죽였습니다');
if (s6.mainFps > 1)             console.log('   ⚠ 단독 화면이 가만히 있는데도 본무대를 그립니다:', s6.mainFps);

console.log('\n요약 — 확대를 열고 가만히 둔 채 본무대', idle.mainFps, '장/s · 미리보기', idle.prevFps, '장/s');
await page.close();
