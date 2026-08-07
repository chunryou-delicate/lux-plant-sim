/* ============================================================
   tools/test_perf_budget.mjs — **무엇이 얼마나 무거운가**를 한 장 표로 낸다
   ------------------------------------------------------------
   박사님(2026-08-06 · 폰 실기): "그리고 렉 걸리는 느낌?"
   그리고 좁혀 주신 단서: "이동할 때는 되게 쾌적한데 **가만히 서서 모션할 때** 버버벅"

     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_perf_budget.mjs
     … --room oneroom      다른 방
     … --cpu 4             느린 폰 흉내 (기본 1 = 스로틀 없음)
   ⚠ --cpu 4 로 돌리면 시루 24개 구간에서 몇 분씩 걸린다. 값(삼각형·드로우콜)은
     CPU 와 무관하므로 평소에는 기본으로 돌리고, 시간 비교가 필요할 때만 올리십시오.

   ★ 무엇을 재나
     ① 오늘 들어온 것들이 **각각** 삼각형·드로우콜·렌더시간을 얼마나 늘렸나
        (창밖 골목 · 시루 무리 · 무순 · 접지 그림자 · 캐릭터 · 식물등)
     ② 그림자 예산 lean / full / none 이 각각 얼마인가
     ③ ★ **가만히 서 있을 때 몇 장이 나오나** — 상한 정책(idle 10 / busy 30 / move 60)이
        실제로 무엇에 걸려 있는지

   ⚠⚠ **헤드리스는 폰이 아니다.** SwiftShader(소프트웨어 GL)라 절대 시간은 폰과 다르다.
     그래서 여기서 믿을 수 있는 것은
       · 삼각형 수 · 드로우콜 수 — GPU 와 무관하다. **정확하다**
       · 구간끼리의 **비**
     못 믿을 것은 절대 fps 다. 폰 실기 수치는 아직 없다 — 그 사실을 보고서에 적는다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const ROOM = argOf('--room', 'banjiha');
const CPU = +argOf('--cpu', 1);   // 기본은 스로틀 없음 — 값(삼각형·콜)은 CPU 와 무관하다

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log(`PASS  ${name}${extra ? '  — ' + extra : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  — ' + extra : ''}`); }
};

/* 한 장 그려 보고 그 한 장의 값을 읽는다. 그리는 시간은 여러 장의 중앙값을 쓴다. */
const SHOT = `(() => {
  const v = window.view, r = v.three.renderer;
  v.redraw();
  const t = [];
  for (let i = 0; i < 9; i++) {
    const a = performance.now();
    r.render(v.three.scene, v.three.cam);
    t.push(performance.now() - a);
  }
  t.sort((x, y) => x - y);
  return JSON.stringify({ tris: r.info.render.triangles, calls: r.info.render.calls,
                          ms: +t[4].toFixed(2) });
})()`;

const row = (name, s, base) => {
  const d = base ? { tris: s.tris - base.tris, calls: s.calls - base.calls,
                     ms: +(s.ms - base.ms).toFixed(2) } : null;
  const sign = v => (v > 0 ? '+' : '') + v;
  return `${name.padEnd(26)} ${String(s.tris).padStart(8)} ${String(s.calls).padStart(6)} ` +
         `${String(s.ms).padStart(8)}` +
         (d ? `   ${String(sign(d.tris)).padStart(8)} ${String(sign(d.calls)).padStart(6)} ` +
              `${String(sign(d.ms)).padStart(7)}` : '');
};
const HEAD = '무엇                          삼각형   드로우콜  렌더ms       Δ삼각형 Δ콜   Δms';

async function main() {
  const page = await launch({ width: 390, height: 844, dpr: 2,
                              throttle: CPU > 1 ? { cpu: CPU } : null });
  const exs = [];
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') exs.push(p.exceptionDetails.text); });
  await page.goto(`${BASE}/tools/room_view_demo.html?room=${ROOM}`);
  await page.waitFor('!!window.view', 180000, 200);
  await sleep(1200);
  /* 픽셀비를 못 박는다 — autoQuality 가 도중에 갈아 끼우면 구간마다 다른 것을 재게 된다 */
  await page.eval(`(()=>{ const r=window.view.three.renderer;
    r.setPixelRatio(0.5); r.setPixelRatio = () => {}; window.view.redraw(); return 1; })()`);
  const shot = async () => JSON.parse(await page.eval(SHOT));

  console.log(`\n방=${ROOM} · 390×844 · CPU ${CPU}배 느리게 · 픽셀비 0.5 · SwiftShader`);
  console.log('⚠ 절대 시간은 폰과 다르다. 삼각형·드로우콜은 GPU 와 무관해 정확하다.\n');

  /* ══ ① 오늘 들어온 것들의 값 ═══════════════════════════════════════ */
  console.log('── ① 무엇이 얼마를 더하나 (하나씩 켜 가며) ' + '─'.repeat(30));
  console.log(HEAD);
  console.log('─'.repeat(88));

  /* 맨바닥 — 창밖 끄고 · 사람 없고 · 화분 없고 · 접지 그림자 없음 */
  await page.eval(`(()=>{ window.view.setOutside(false);
    window.view.setBlobShadows(false); return 1; })()`);
  await sleep(400);
  const bare = await shot();
  console.log(row('맨 방 (가구·벽만)', bare));

  await page.eval(`window.view.setBlobShadows(true); 1`); await sleep(250);
  const withBlob = await shot();
  console.log(row('+ 가구 접지 그림자', withBlob, bare));

  await page.eval(`window.view.setOutside(true); 1`); await sleep(700);
  const withOut = await shot();
  const outInfo = JSON.parse(await page.eval(`JSON.stringify(window.view.outsideInfo())`));
  console.log(row('+ 창밖 골목', withOut, withBlob));

  await page.eval(`window.view.setCharacter('jachwi').then(()=>1)`); await sleep(1400);
  const withChar = await shot();
  console.log(row('+ 자취녀', withChar, withOut));

  await page.eval(`window.view.setCharacter('moni').then(()=>1)`); await sleep(1200);
  const withMoni = await shot();
  console.log(row('+ 몬이', withMoni, withChar));

  await page.eval(`(async()=>{ await window.view.setPlantAt('p_mon', {x:0,y:0,z:0.6},
    {kind:'monstera', growthDays:200, seed:5}); return 1; })()`); await sleep(900);
  const withMon = await shot();
  console.log(row('+ 몬스테라 1그루', withMon, withMoni));

  await page.eval(`(async()=>{ await window.view.setPlantAt('p_musun', {x:-0.7,y:0,z:0.6},
    {kind:'musun', progress01:0.9}); return 1; })()`); await sleep(700);
  const withMusun = await shot();
  console.log(row('+ 무순 재배판 1', withMusun, withMon));

  /* ★ 시루 무리 — 오늘 들어온 것 중 제일 의심스럽다(multisiru-to-plan.md §7) */
  const siru = {};
  let prevS = withMusun;
  for (const n of [1, 4, 12, 24]) {
    await page.eval(`(async()=>{ const V=window.view;
      await V.setPlantAt('p_siru', {x:0.8,y:0,z:0.6},
        { kind:'beansprout', progress01:1, count:${n}, potD: V.plantPotD('beansprout', ${n}) });
      return 1; })()`);
    await sleep(600);
    const s = await shot();
    siru[n] = s;
    console.log(row(`+ 시루 ${n}개 (누계)`, s, prevS));
    prevS = s;
  }

  /* ★ 실제 게임 화면으로 되돌려 놓고 잰다. 위에서 세운 시루 24개(콜 1,264)를 그대로
     두고 재면 "그림자 굽는 데 230ms" 같은 엉뚱한 값이 나온다 — 실제로 한 번 그렇게 쟀다. */
  await page.eval(`(async()=>{ const V=window.view;
    await V.setPlantAt('p_siru', null, null);
    await V.setPlantAt('p_musun', null, null);
    return 1; })()`);
  await sleep(600);
  const realScene = await shot();
  console.log(`재는 화면: 삼각형 ${realScene.tris} · 드로우콜 ${realScene.calls}` +
              ` (자취녀+몬이+몬스테라 1그루 — 게임 초반 화면)`);

  /* ══ ③ 가만히 서 있을 때 몇 장이 나오나 ════════════════════════════ */
  console.log('\n── ③ 가만히 서 있을 때 (박사님 "가만히 서서 모션할 때 버버벅") ' + '─'.repeat(8));
  await page.eval(`window.view.selectCharacter(null); window.view.showSlotRings(false); 1`);
  const drawn = async ms => {
    const a = +await page.eval(`window.view.stats().drawn`);
    await sleep(ms);
    return (+await page.eval(`window.view.stats().drawn`)) - a;
  };
  /* ★ 위 ①에서 시루 24개를 세우는 동안 idleBackoff 가 이미 내려앉았을 수 있다.
     그건 정책이 제대로 도는 것이지만 여기서는 방해가 되므로 한 번 되돌리고 잰다. */
  await page.eval(`window.view.setIdleFps(null)`);
  const idleRows = [];
  for (const cap of [null, 10, 18, 24, 30]) {
    if (cap != null) await page.eval(`window.view.setIdleFps(${cap})`);
    else await page.eval(`window.view.setIdleFps(null)`);
    await sleep(700);
    const n = await drawn(3000);
    const st = JSON.parse(await page.eval(`JSON.stringify(window.view.stats())`));
    idleRows.push([cap == null ? '기본' : String(cap), n, +(n / 3).toFixed(1), st.fpsCap.idle,
                   st.level, !!(st.idleCap && st.idleCap.backedOff)]);
  }
  console.log('idle 상한   3초에 그린 장수   실제 fps   그때 상한   level   스스로 내려앉음');
  for (const r of idleRows)
    console.log(`${String(r[0]).padStart(8)} ${String(r[1]).padStart(15)} ${String(r[2]).padStart(11)} ` +
                `${String(r[3]).padStart(11)} ${String(r[4]).padStart(7)} ${String(r[5]).padStart(15)}`);
  await page.eval(`window.view.setIdleFps(null)`);

  /* 걷는 중은 어떤가 — 박사님은 "이동할 때는 쾌적"이라 하셨다. 숫자로 확인한다. */
  await page.eval(`window.view.selectCharacter('jachwi')`);
  const sent = await page.eval(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect();
    const f=window.view.characterScreenPos('jachwi'); if(!f) return null;
    for(let a=0;a<16;a++) for(const R of [90,150]){
      const x=r.left+f.x+Math.cos(a/16*6.283)*R, y=r.top+f.y+Math.sin(a/16*6.283)*R*0.6;
      const t=window.view.previewWalk('jachwi',x,y);
      if(t&&t.ok){ window.view.previewWalk('jachwi',null,null); return JSON.stringify({x,y}); } }
    window.view.previewWalk('jachwi',null,null); return null; })()`);
  let moveFps = null;
  if (sent) {
    const s = JSON.parse(sent);
    const a = +await page.eval(`window.view.stats().drawn`);
    await page.eval(`window.view.walkTo('jachwi', ${s.x}, ${s.y})`);
    const t0 = Date.now();
    while (Date.now() - t0 < 4000 && await page.eval(`window.view.isWalking('jachwi')`)) await sleep(60);
    const dt = (Date.now() - t0) / 1000;
    moveFps = +(((+await page.eval(`window.view.stats().drawn`)) - a) / dt).toFixed(1);
    console.log(`걷는 중 ${moveFps} fps (상한 ${JSON.parse(await page.eval(`JSON.stringify(window.view.stats())`)).fpsCap.move})`);
  }
  await page.eval(`window.view.stopWalk('jachwi'); window.view.selectCharacter(null); 1`);

  /* ══ ② 그림자 예산 ═════════════════════════════════════════════════ */
  console.log('\n── ② 그림자 예산 — 무엇이 켜지고 무엇이 꺼져 있나 ' + '─'.repeat(22));
  const shadowRows = [];
  for (const mode of ['none', 'lean', 'full']) {
    await page.eval(`window.view.setShadowBudget('${mode}'); window.view.redraw(); 1`);
    await sleep(300);
    /* 그림자맵을 강제로 다시 굽게 하고 그 프레임을 잰다 — 굽는 값이 진짜 값이다 */
    const s = JSON.parse(await page.eval(`(() => {
      const v = window.view, T = v.three, r = T.renderer;
      const L = [T.sunLight, T.ceilingBulb, ...(T.skyPortals || [])].filter(Boolean);
      /* ★ 한 장씩 재면 해상도가 모자라 0.00 이 나온다 — 여러 장을 모아 재고 나눈다 */
      const N = 20;
      for (const x of L) if (x.castShadow && x.shadow) x.shadow.needsUpdate = true;
      for (let w = 0; w < 4; w++) r.render(T.scene, T.cam);   // 데우기 — 첫 모드가 셰이더 컴파일을 뒤집어쓴다
      const a0 = performance.now();
      for (let i = 0; i < N; i++) {
        for (const x of L) if (x.castShadow && x.shadow) x.shadow.needsUpdate = true;
        r.render(T.scene, T.cam);
      }
      const bake = (performance.now() - a0) / N;
      return JSON.stringify({
        bakeMs: +bake.toFixed(2),
        sun: !!T.sunLight.castShadow,
        bulb: !!T.ceilingBulb.castShadow,
        portals: (T.skyPortals||[]).filter(p=>p.castShadow).length,
        portalsAll: (T.skyPortals||[]).length,
        mapSize: T.sunLight.shadow ? T.sunLight.shadow.mapSize.width : null,
        camHalf: T.sunLight.shadow ? +Math.abs(T.sunLight.shadow.camera.left).toFixed(2) : null
      });
    })()`));
    shadowRows.push([mode, s]);
  }
  console.log('예산    해   천장등큐브  창확산광   그림자맵  그림자카메라  굽는 프레임 ms');
  for (const [mode, s] of shadowRows)
    console.log(`${mode.padEnd(6)} ${(s.sun?'○':'✗').padStart(3)} ${(s.bulb?'○(6면)':'✗').padStart(10)} ` +
                `${(s.portals+'/'+s.portalsAll).padStart(9)} ${String(s.mapSize).padStart(10)} ` +
                `${('±'+s.camHalf+'m').padStart(12)} ${String(s.bakeMs).padStart(14)}`);
  await page.eval(`window.view.setShadowBudget('lean'); 1`);
  const lean = shadowRows.find(r => r[0] === 'lean')[1];
  const full = shadowRows.find(r => r[0] === 'full')[1];
  const none = shadowRows.find(r => r[0] === 'none')[1];
  console.log(`⇒ full 은 lean 보다 굽는 프레임이 ${(full.bakeMs / Math.max(0.01, lean.bakeMs)).toFixed(2)}배` +
              ` · lean 은 none 보다 ${(lean.bakeMs / Math.max(0.01, none.bakeMs)).toFixed(2)}배`);
  ok('② lean 이 기본이다 — 해만 굽고 천장등 큐브맵은 꺼져 있다',
     lean.sun === true && lean.bulb === false, `해 ${lean.sun} · 천장등 ${lean.bulb}`);

  /* ══ 계약 검사 ═════════════════════════════════════════════════════ */
  console.log('\n── 검사 ' + '─'.repeat(56));
  const blobCalls = withBlob.calls - bare.calls;
  ok('A 가구 접지 그림자는 **드로우콜 1개**다 (가구마다 만들지 않는다)',
     blobCalls <= 1, `+${blobCalls}콜 · +${withBlob.tris - bare.tris}삼각형`);
  /* ★ 시루 무리는 **상한이 없다.** 여기서는 값을 숫자로 남기고, 판단은 박사님께 올린다
     (docs/handoff/render3d-to-plan.md §판단 필요). 검사는 "값이 이 표와 같은가"만 본다 —
     여기서 임의로 자르면 "사면 돈만 없어진다" 사고를 다시 만드는 셈이다. */
  const perSiru = Math.round((siru[24].calls - siru[1].calls) / 23);
  ok('B 시루 하나가 더하는 드로우콜을 안다 (표가 흔들리면 여기서 걸린다 · 47±6)',
     perSiru >= 41 && perSiru <= 53,
     `시루 1개당 +${perSiru}콜 · 1개 ${siru[1].calls} → 12개 ${siru[12].calls} → 24개 ${siru[24].calls}콜`);
  const idleDefault = idleRows[0];
  const cap = JSON.parse(await page.eval(`JSON.stringify(window.view.stats().idleCap)`));
  /* ★ 24 → 18 (박사님 2026-08-07 확정 · room_view §ANIM_IDLE_FPS).
     끊겨 보이던 것은 15 아래였기 때문이라 18 이면 사라지고, 배터리는 2.4배가 아니라 1.8배다. */
  ok('C 사람이 서 있으면 서 있는 상한이 18 이다 (사람이 없으면 10)',
     cap.anim === 18 && cap.floor === 10 && cap.skeletal === true,
     JSON.stringify(cap));
  /* ⚠ 헤드리스(SwiftShader)는 상한을 못 낼 수 있다 — 그때는 **스스로 내려앉는 쪽**이 정답이다.
     둘 중 하나면 통과다: 상한 언저리를 냈거나(빠른 기기), 못 내서 스스로 10 으로 내려앉았거나.
     ★ 문턱을 숫자로 박지 않는다 — 내려앉는 규칙 자체가 `상한 × 0.75` 라
       상한을 바꿀 때마다 이 줄이 조용히 어긋난다(24 로 맞춰 둔 16 이 실제로 그랬다). */
  const backoffFloor = cap.anim * 0.75;
  ok('C2 그 상한을 못 내는 기기는 스스로 10 으로 내려앉는다 (moveBackoff 와 같은 사상)',
     idleDefault[5] === true || idleDefault[2] >= backoffFloor,
     `기본에서 ${idleDefault[2]}fps · 그때 상한 ${idleDefault[3]} · 내려앉음=${idleDefault[5]} ` +
     `· 내려앉는 문턱 ${backoffFloor}`);
  ok('D 예외가 없다', exs.length === 0, exs.join(' | '));

  console.log(`\n창밖 골목: ${JSON.stringify(outInfo)}`);
  console.log(`\n=== ${pass} PASS · ${fail} FAIL ===`);
  await page.close();
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
