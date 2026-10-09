/* tools/probe_houseC_furnlight.mjs — **화분을 받는 가구를 옮겨 놓으면 «빛» 한 줄이 뜨나** (2026-10-09 · core · 총괄 D39 C · house placeVerdict)
   ------------------------------------------------------------
   손: 가구 메뉴의 [옮기기] 확정과 같은 길(window.__furn = furnPicked · select → 끌기 끝 up()) — 방 다시 짓기·세이브 적기까지 그대로 탄다.
   잰다:
     ① 반지하(초보 판) — 3단 에타지에(banjiha-etagere)를 창 밑 → 방 앞쪽으로. 줄이 뜨고 글이 엔진 갈래(grow/lamp/none)의 그 글이다 ·
        겨울 말이 없다 · 앞쪽은 none(«안 자랍니다») · 창 밑으로 되돌려도 엔진 갈래 그대로(반지하는 창턱만 자란다) · 찍음
     ② [취소] → 줄이 걷힌다 · 자리 없는 가구(침대)를 옮기면 줄이 안 뜬다
     ③ 원룸(이사 · 저장 → 새로 켬) — 산 계단식 화분대(furn_plant_step_3)를 창 앞으로 → A/B/Bp 쪽 · 방 안쪽 바닥으로 → C/D 쪽 · 찍음
   OUTDIR= (필수 · 비어 있어야) · BYEOT_URL=(기본 127.0.0.1:9300) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const OUTDIR = process.env.OUTDIR;
if (!OUTDIR) { console.error('⛔ OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ OUTDIR 가 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const page = await launch({ width: 390, height: 844, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
const KO = {
  A: '여기면 몬스테라가 겨울에도 자랍니다',
  B: '여름엔 등 없이 자랍니다 — 겨울엔 식물등을 켜야 자랍니다',
  Bp: '여름엔 등 없이 자랍니다 — 겨울엔 등을 켜도 모자랍니다',
  C: '여기선 식물등이 있어야 자랍니다',
  D: '여기선 몬스테라가 안 자랍니다 — 창에 더 붙여 보세요',
  grow: '여기면 몬스테라가 자랍니다',
  lamp: '여기선 식물등이 있어야 자랍니다',
  none: '여기선 몬스테라가 안 자랍니다 — 창에 더 붙여 보세요'
};
const J = async (js, ms = 180000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
const skip = async () => { for (let k = 0; k < 4; k++) { for (let i = 0; i < 40; i++) {
  if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s && s.offsetParent) s.click(); else { const x=document.getElementById('dlgBox'); if(x)x.click(); }})()`, false); await sleep(150); } await sleep(300); } };
const reload = async () => {
  await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){} })()`, false); await sleep(1500);
  await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(4500); await skip(); };
/* [옮기기] 확정과 같은 길 — 고르고 · 끌기 끝(up). 후보 자리를 차례로(놓을 수 없으면 다음) */
const moveVia = (uid, cands) => J(`(async()=>{ const fp=window.__furn; const f=(window.__rv.furniture()||[]).find(x=>x.uid===${JSON.stringify(uid)});
  if (!f) return { 탈:'가구 없음' };
  const tries=[];
  for (const [x,z] of ${JSON.stringify(cands)}) {
    fp.clear(); const cr=document.getElementById('roomCanvas').getBoundingClientRect();
    fp.select(f, cr.left+cr.width/2, cr.top+cr.height/2);
    fp.mode='move'; fp.ghost={ x, z, rot: f.rot||0 };
    await fp.up();
    const now=(window.__rv.furniture()||[]).find(q=>q.uid===${JSON.stringify(uid)});
    const moved = now && Math.abs(now.x-x)<0.2 && Math.abs(now.z-z)<0.2;
    const el=document.getElementById('furnLight');
    tries.push({ x, z, moved, at: now ? [+now.x.toFixed(2), +now.z.toFixed(2)] : null });
    if (moved) { await new Promise(r=>setTimeout(r,600));
      return { tries, shown: !!(el && el.style.display!=='none' && el.textContent), text: el ? el.textContent : null, good: !!(el && el.classList.contains('good')),
               confirm: document.getElementById('furnOk').style.display!=='none', verdict: window.__byeotFurnLight(${JSON.stringify(uid)}) }; }
  }
  return { tries, 탈:'어느 자리에도 못 옮김' }; })()`);
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__hc){ localStorage.clear(); sessionStorage.__hc='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 600000, 500); await sleep(4500); await skip();
  /* ① 반지하 — 에타지에 */
  const before = await J(`(()=>{ const sl=(window.__io.light.room.slots||[]).filter(s=>String(s.slotId).startsWith('banjiha-etagere:')); return { n: sl.length, room: window.__S().home && window.__S().home.room }; })()`);
  console.log('반지하 —', JSON.stringify(before));
  const b1 = await moveVia('banjiha-etagere', [[0.9, 1.3], [0.3, 1.0], [-0.9, 1.2], [1.0, 0.5]]);
  console.log('① 앞쪽 —', JSON.stringify(b1));
  await page.shot(`${OUTDIR}/1_banjiha_front.png`);
  ok(b1.shown && b1.verdict && b1.text === KO[b1.verdict.key], `줄이 뜨고 글이 엔진 갈래 그대로(${b1.verdict && b1.verdict.key} «${b1.text}»)`);
  ok(b1.verdict && ['grow', 'lamp', 'none'].includes(b1.verdict.key), '반지하는 초보 판 갈래(grow/lamp/none)');
  ok(!/겨울/.test(b1.text || ''), '반지하는 겨울 말을 안 한다');
  ok(b1.verdict && b1.verdict.key === 'none', `앞쪽(창에서 멂)은 «안 자랍니다»(${b1.verdict && b1.verdict.key})`);
  ok(b1.confirm, '[확정]/[취소] 와 같이 선다');
  /* 창 밑으로 되돌려 놓기(옮기기 한 번 더) — 갈래가 바뀌나 */
  const b2 = await moveVia('banjiha-etagere', [[-0.35, -1.72], [-0.6, -1.72], [-0.35, -1.6]]);
  console.log('① 창 밑 —', JSON.stringify(b2));
  await page.shot(`${OUTDIR}/2_banjiha_window.png`);
  /* ⚠ 반지하 창은 높다(창턱 y 1.585) — 자라는 데는 붙박이 창턱(3.68)뿐이고 에타지에는 창 밑 맨 윗단도 0.51(등 셋 다 1.75 < 2.7).
       그래서 창 밑에서도 «안 자랍니다»가 참이다(house-decor §C 닻: 반지하 창턱 = grow · 책상 = none) */
  ok(b2.shown && b2.verdict && b2.text === KO[b2.verdict.key], `창 밑에서도 엔진 갈래 그대로(${b2.verdict && b2.verdict.key} «${b2.text}»)`);
  /* ② [취소] → 걷힘 */
  const u = await J(`(async()=>{ await window.__furn.undoMove(); const el=document.getElementById('furnLight'); return { shown: !!(el && el.style.display!=='none') }; })()`);
  ok(!u.shown, '[취소]를 누르면 줄이 걷힌다');
  await page.eval(`(()=>{ window.__furn.clear(); })()`, false);
  const bed = await moveVia('banjiha-bed', [[-1.9, -0.6], [-1.9, -0.4], [-1.8, -0.9]]);
  console.log('② 침대 —', JSON.stringify({ shown: bed.shown, text: bed.text, tries: bed.tries }));
  ok(bed.tries && bed.tries.some(t => t.moved) && !bed.shown, '자리 없는 가구(침대)는 아무 말 없음');
  await page.eval(`(()=>{ window.__furn.clear(); })()`, false);
  /* ③ 원룸 */
  await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js');
    const S=window.__S(); S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
    const a = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a); return 1; })()`);
  await skip();
  await page.eval(`(()=>{ const S=window.__S(); const ts=S.tutorial; ts.cashWon = ts.rules.moveOutCostWon + 3000000; ts.lamp.unlocked = true;
    ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day }; window.__redraw(); })()`, false); await sleep(600);
  await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false); await sleep(1500); await skip();
  await page.eval(`(()=>{ if (window.__S().tutorial.movedOut) return; const p=document.getElementById('movePanel');
    if (p && p.classList.contains('on')) document.getElementById('moveGo').click(); else document.getElementById('moveOut').click(); })()`, false);
  await sleep(6000); await skip(); await reload();
  const room = await J(`(()=>{ const S=window.__S(); return { 방:S.home.room }; })()`);
  ok(room.방 === 'oneroom', '원룸으로 이사했다');
  const placed = await J(`(async()=>{ const S=window.__S(); S.shop.stock['furn_plant_step_3']=(S.shop.stock['furn_plant_step_3']||0)+1;
    const r = await window.__placeFurnStock('furn_plant_step_3'); return r; })()`);
  console.log('③ 놓음 —', JSON.stringify(placed));
  await sleep(2000); await skip();
  ok(placed && placed.ok, `산 화분대를 방에 놓았다(${placed && placed.uid})`);
  if (placed && placed.ok) {
    const W = await J(`(()=>{ const r=window.__io.light.room; const f=(window.__rv.furniture()||[]).find(x=>x.uid===${JSON.stringify(placed.uid)}); return { d: r.size.d, fd: (f && f.size && f.size.d) || 0.28 }; })()`);
    const zWin = -W.d / 2 + W.fd / 2 + 0.03;
    const o1 = await moveVia(placed.uid, [[0.5, zWin], [0.2, zWin], [1.1, zWin], [0.5, zWin + 0.1]]);
    console.log('③ 창 앞 —', JSON.stringify(o1));
    await page.shot(`${OUTDIR}/3_oneroom_window.png`);
    ok(o1.shown && o1.verdict && o1.text.startsWith(KO[o1.verdict.key]), `줄이 뜨고 글이 엔진 갈래 그대로(${o1.verdict && o1.verdict.key} «${o1.text}»)`);
    ok(o1.verdict && ['A', 'B', 'Bp'].includes(o1.verdict.key), `창 앞은 «여름엔 등 없이 자랍니다» 쪽(${o1.verdict && o1.verdict.key})`);
    const o2 = await moveVia(placed.uid, [[-2.4, 1.9], [-2.0, 1.6], [2.3, 1.9], [-1.0, 1.5]]);
    console.log('③ 안쪽 —', JSON.stringify(o2));
    await page.shot(`${OUTDIR}/4_oneroom_inner.png`);
    ok(o2.shown && o2.verdict && o2.text.startsWith(KO[o2.verdict.key]) && ['C', 'D'].includes(o2.verdict.key), `안쪽 바닥은 등이 있어야/안 자람(${o2.verdict && o2.verdict.key} «${o2.text}»)`);
    ok(!o2.good, '안 자라는 갈래는 초록이 아니다');
  }
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; }
finally { await page.close(); }
console.log(bad ? `probe_houseC_furnlight: FAIL (${bad})` : 'probe_houseC_furnlight: PASS');
process.exit(bad ? 1 : 0);
