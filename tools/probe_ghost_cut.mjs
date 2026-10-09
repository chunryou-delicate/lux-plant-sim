/* tools/probe_ghost_cut.mjs — **한 번 자른 가지의 잎이 다시 자르기 목록에 뜨나** (2026-10-09 · core · 총괄 D36 ①)
   ------------------------------------------------------------
   유령 잎: growth(형태 정본)는 자른 것을 모르고 잎을 안 지운다(그 가지도 계속 자란다). 예전 cuttableNow 는 «자른 마디 이름»만 빼서,
     같은 가지의 다른 마디(이미 잘려 나간 끝잎을 그대로 싣는다)가 목록에 다시 떠 같은 잎을 또 팔 수 있었다
     (갈래 판 g·1~9: 안내대로 모주 자르기 67번 중 41번 · 씨앗 3 은 프롤로그 하프문 잎을 세 번 팖).
   판 세우기(값 0): 새 판 → 모주 도착(코어 · _make_leaf3_save 와 같은 길) · 창턱 → 날마다 물 · 다섯 날씩(loop.runDays) —
     화면 자르기 목록에 «누를 수 있는» 마디가 처음 뜬 날까지. 병 셋을 손에 쥐여 준다.
   잰다(화면 손 그대로):
     ① 식물 탭 자르기 목록을 찍는다(before.png) · 열린 첫 줄 X 의 [병에] 를 누른다(놓기 확인 바가 서면 [확인])
     ② 날을 다섯씩 보내며 목록을 본다 — 어느 줄이 X 가 싣고 나간 잎 열쇠(growth leafKeys)를 다시 실으면 «유령»
     ③ 유령이 뜬 날(또는 WATCH 일 · STOPDAY 가 있으면 그날)에 찍는다(after.png). 유령이 한 번도 안 뜨면 PASS
   OUTDIR= (필수 · 비어 있어야) · BYEOT_URL=(기본 127.0.0.1:9300) · MAXDAYS=(첫 열린 마디까지 · 기본 400) · WATCH=(자른 뒤 · 기본 300) · STOPDAY=(그 날에 멈춰 찍음 — 고친 뒤 «같은 판 같은 날») */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const OUTDIR = process.env.OUTDIR;
if (!OUTDIR) { console.error('⛔ OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ OUTDIR 가 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const MAXDAYS = Number(process.env.MAXDAYS || 400), WATCH = Number(process.env.WATCH || 300);
const STOPDAY = process.env.STOPDAY ? Number(process.env.STOPDAY) : null;
const page = await launch({ width: 390, height: 844, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__c){ localStorage.clear(); sessionStorage.__c='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 300000, 500); await sleep(4000);
  const J = async (js, ms = 120000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
  const clear = async () => { for (let i = 0; i < 40; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return String(!!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on')));})()`);
    if (b !== 'true') return;
    await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false); await sleep(250); } };
  /* 판 세우기 — 모주 도착 · 창턱 */
  console.log('세움 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js'); const S=window.__S();
    S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
    const a = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a);
    const p = (S.pots||[])[0];
    const sill = (window.__io.light.room.slots||[]).map(s=>s.slotId).find(id=>/sill/.test(id));
    const slot = (window.__io.light.room.slots||[]).find(x=>x.slotId===sill) || {};
    st.setPotAt(S, p.id, { x: slot.x, y: slot.y, z: slot.z, slotId: sill }, { slots: window.__io.light.room.slots, size: window.__io.light.room.size });
    fp.moveMonstera(S.firstPlay, sill);
    try { window.__redraw(); } catch(e) {}
    return { 화분: p.id, 자리: sill }; })()`)));
  await clear();
  /* 화면 자르기 목록(#cutNodes)의 줄 + 그 마디가 싣는 잎 열쇠(growth 전체 목록에서) */
  const listNow = () => J(`(async()=>{ try{window.__redraw();}catch(e){} window.__byeotSheet.open('plants'); await new Promise(r=>setTimeout(r,300));
    const rows=[...document.querySelectorAll('#cutNodes [data-cut]')].filter(b=>b.dataset.cont==='jar').map(b=>({ id:b.dataset.cut, off:b.disabled }));
    const all = window.__io.growth.cuttableNodes() || [];
    const key = id => { const n = all.find(x=>x.nodeId===id); return n && Array.isArray(n.leafKeys) ? n.leafKeys : null; };
    return rows.map(r=>({ ...r, keys:key(r.id) })); })()`);
  const days = n => J(`(async()=>{ const loop=await import('/src/game/loop.js'); const st=await import('/src/game/state.js'); const S=window.__S();
      for (let i=0;i<${n};i++) { try { st.waterPot(S); } catch(e) {} loop.runDays(S, window.__io, 1); }   /* 날마다 물(갈래 판과 같은 손) */
      try{window.__redraw();}catch(e){} return S.day; })()`);
  const dayNow = () => J(`window.__S().day`);
  /* 병 셋(누를 수 있게) — 그리고 열린 첫 마디가 뜰 때까지 */
  await J(`(async()=>{ const pr=await import('/src/game/propagation.js'); const S=window.__S(); const it=pr.containerItemOf('jar'); S.shop.stock[it]=(S.shop.stock[it]||0)+3; try{window.__redraw();}catch(e){} return 1; })()`);
  let rows = null, X = null;
  for (let d = 0; d < MAXDAYS && !X; d += 5) { await days(5); rows = await listNow(); X = rows.find(r => !r.off && r.keys && r.keys.length) || null; }
  if (!X) { ok(false, `${MAXDAYS}일 안에 누를 수 있는 마디가 목록에 안 떴다 — 판을 못 세움`); throw new Error('setup'); }
  await clear(); rows = await listNow();
  const day0 = await dayNow();
  console.log('자르기 전 —', JSON.stringify({ day: day0, X: X.id, keys: X.keys, rows: rows.map(r => r.id) }));
  await page.shot(`${OUTDIR}/before.png`);
  /* ① X 의 [병에] */
  await page.eval(`(()=>{ const b=[...document.querySelectorAll('#cutNodes [data-cut]')].find(x=>x.dataset.cut===${JSON.stringify(X.id)} && x.dataset.cont==='jar'); if(b) b.click(); })()`, false);
  /* 자르기는 주인공이 걸어가 하는 동작(doAct)이라 시간이 걸린다 — 잘릴 때까지(최대 20초) 기다리며 놓기 확인 바가 서면 [확인] */
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    await page.eval(`(()=>{ const b=document.getElementById('placeOk'); if(b && document.getElementById('stage').classList.contains('confirming')) b.click(); })()`, false);
    if (await J(`(window.__S().pots[0].cuts||[]).some(c=>c.nodeId===${JSON.stringify(X.id)})`)) break;
  }
  await sleep(800); await clear();
  const cut = await J(`(()=>{ const p=window.__S().pots[0]; return (p.cuts||[]).map(c=>({ nodeId:c.nodeId, leafKeys:c.leafKeys||null })); })()`);
  console.log('자른 것 —', JSON.stringify(cut));
  ok(cut.some(c => c.nodeId === X.id), `X(${X.id}) 가 잘렸다`);
  /* ② 날을 보내며 본다 */
  const gone = new Set(X.keys);
  let ghostDay = null, ghosts = [], after = null;
  for (let d = 0; d < WATCH; d += 5) {
    const now = await days(5); after = await listNow();
    ghosts = after.filter(r => r.keys && r.keys.some(k => gone.has(k)));
    if ((STOPDAY == null && ghosts.length) || (STOPDAY != null && now >= STOPDAY)) { ghostDay = ghosts.length ? now : null; break; }
  }
  const dayEnd = await dayNow();
  await clear(); after = await listNow();
  ghosts = after.filter(r => r.keys && r.keys.some(k => gone.has(k)));
  /* 유령 줄을 화면에 보이게 굴린다(있으면) */
  if (ghosts.length) await page.eval(`(()=>{ const b=[...document.querySelectorAll('#cutNodes [data-cut]')].find(x=>x.dataset.cut===${JSON.stringify(ghosts[0].id)}); if(b) b.closest('.cutRow').scrollIntoView({block:'center'}); })()`, false);
  await sleep(400);
  await page.shot(`${OUTDIR}/after.png`);
  console.log('자른 뒤 —', JSON.stringify({ day: dayEnd, rows: after.map(r => `${r.id}${r.off ? '(닫힘)' : ''}`), ghosts: ghosts.map(g => g.id) }));
  ok(ghosts.length === 0, `${dayEnd - day0}일 뒤 목록에 X 가 싣고 나간 잎을 다시 싣는 줄이 없다${ghosts.length ? ' — ' + ghosts.map(g => `${g.id}${g.off ? '(닫힘)' : '(열림)'}`).join(', ') : ''}`);
} catch (e) { if (e && e.message !== 'setup') { console.log('  FAIL 탈 —', e && e.message); bad++; } }
finally { await page.close(); }
console.log(bad ? `probe_ghost_cut: FAIL (${bad})` : 'probe_ghost_cut: PASS');
process.exit(bad ? 1 : 0);
