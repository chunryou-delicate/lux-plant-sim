/* tools/_make_leafsave.mjs — **[leaf] 청: 「잎 여럿 난 판」 세이브 한 장** (2026-09-07)
   ⚠ 먼저 잰 것: `runDays(S, io, n)` 만으로 90일을 굴리면 «유효일이 54에서 멈춥니다»(빛이 안 먹힘) — 그래서 «걸어서» 만든다.
   손가락을 따라 첫날을 하고, 그 뒤 [다음 날]을 눌러 날을 보낸다(진짜 길). 잎이 목표에 닿으면 `byeot/save/1` 을 파일로 뜬다.
   ⛔ 값 0 · 고치지 않는다. */
import { launch, sleep } from './test_cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const WANT = Number(process.env.LEAVES || 2);   /* [leaf]: 두 장이면 넉넉하다 */
const WANT_MATURE = Number(process.env.MATURE || 0);   /* ★ 「무늬 잎이 «폈있는» 판」([leaf] 2차 청) — 다 자란 잎 수로 멈춘다 */
const DAYS = Number(process.env.DAYS || 70);
const OUT = process.env.OUT || 'docs/handoff/saves/leaf_sill.json';
const W = 1770, H = 1188;
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 2400000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4500);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1);
  await sleep(80); await m('mouseReleased', x, y, 0); await sleep(800); };
const clearDlg = async () => { for (let i = 0; i < 40; i++) {
  const t = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`);
  if (t !== 'true') return true;
  await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false);
  await sleep(200); } return false; };
const quiet = async () => { for (let i = 0; i < 3; i++) { await clearDlg(); await sleep(500); } };
const tapHint = async () => {
  const at = JSON.parse(await page.eval(`(()=>{ const t=document.querySelector('.hintTarget');
    const d=document.getElementById('hintDim'); const hole=(d&&d.dataset.hole||'').split(',').map(Number);
    if (t) { const r=t.getBoundingClientRect(); if (r.width>0) return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2, 짚:t.id||t.className }); }
    if (hole.length===3 && hole.every(Number.isFinite)) return JSON.stringify({ x:hole[0], y:hole[1], 짚:'(점)' });
    return 'null'; })()`));
  if (!at) return null;
  await tapAt(at.x, at.y); await quiet();
  return at.짚;
};
const nextDay = async () => {
  for (let k = 0; k < 4; k++) {
    await quiet();
    const go = JSON.parse(await page.eval(`(()=>{
      const pop=document.querySelector('.pop.on');
      const b = pop ? [...pop.querySelectorAll('button.go')].find(x=>!x.disabled) : null;
      const n = b || document.getElementById('next');
      if(!n || n.disabled) return 'null'; const r=n.getBoundingClientRect();
      return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2, id:n.id }); })()`));
    if (!go) { await sleep(400); continue; }
    const before = await page.eval(`String(window.__S().day)`);
    await tapAt(go.x, go.y); await quiet();
    const after = await page.eval(`String(window.__S().day)`);
    if (after !== before) return true;
  }
  return false;
};
/* ① 첫날 — 손가락을 따라 놓고 심고 물 (probe_nudge 와 같은 손) */
await quiet();
for (let i = 0; i < 14; i++) {
  const st = JSON.parse(await page.eval(`(async()=>{ const fp=await import('/src/game/first_play.js'); const S=window.__S();
    const r=(fp.cropPotList(S.firstPlay,S.day)||[])[0]||{}; return JSON.stringify({ 자람:!!r.growing, 놓임:!!r.placed }); })()`, true, 30000));
  if (st.놓임 && st.자람) break;
  if (!await tapHint()) break;
}
/* ★ 잰 것(첫 판): 이 자의 손가락 따르기는 «끌기»를 못 한다 — 그래서 몬스테라가 «바닥»(free:)에 남고 유효일이 45 에서 멈췄다(d31 까지 잎 1).
   ⇒ 그루가 오면 «창턱»에 코어로 세운다(setPotAt · 자리 좌표). 이 자의 물음은 「잎이 난 판을 만드는 것」이지 「끌기가 되나」가 아니다. */
const toSill = async () => JSON.parse(await page.eval(`(async()=>{ try { const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js'); const S=window.__S();
  const p=(S.pots||[])[0]; if (!p) return JSON.stringify({ 아직:true });
  if (p.slotId && /sill/.test(p.slotId)) return JSON.stringify({ 이미:true });
  const slots=window.__io.light.room.slots||[]; const slot=slots.find(x=>/sill/.test(x.slotId)); if (!slot) return JSON.stringify({ 탈:'창턱 자리가 없다' });
  st.setPotAt(S, p.id, { x:slot.x, y:slot.y, z:slot.z, slotId:slot.slotId }, { slots, size: window.__io.light.room.size });
  try { fp.moveMonstera(S.firstPlay, slot.slotId); } catch(e) {}
  try { window.__redraw(); } catch(e) {}
  return JSON.stringify({ 옮김: slot.slotId }); } catch(e) { return JSON.stringify({ 탈:e.message }); } })()`, true, 30000));
/* ② 손가락을 계속 따라 걷는다 — 몬스테라가 오면 창턱으로 옮기는 것도 손가락이 이끈다 */
let leaves = 0, day = 0;
for (let d = 0; d < DAYS; d++) {
  for (let k = 0; k < 12; k++) { if (!await tapHint()) break; }
  { const t = await toSill(); if (t && t.옮김) console.log('   ★ 창턱으로 —', t.옮김); }
  if (!await nextDay()) { console.log('⚠ 하루를 못 넘겼다'); break; }
  const s = JSON.parse(await page.eval(`(()=>{ const S=window.__S(); let st=null; try { st=window.__io.growth.leafStats(); } catch(e) {}
    const p=(S.pots||[])[0]||null;
    /* ⚠ 생장 창은 «부팅 때부터» {leaves:3} 을 들고 있다 — 화분이 없으면 그 수는 «그 그루의 것이 아니다»(§questSnapshotNow 도 hasPlant 로 막는다) */
    const 그루있나 = !!p;
    return JSON.stringify({ 날:S.day, 그루있나, 잎: 그루있나 && st ? st.leaves : 0, 무늬: 그루있나 && st ? st.variegatedLeaves : 0,
      성숙: 그루있나 && st ? (st.matureLeaves||0) : 0,
      유효일: 그루있나 && st ? st.growthDays : null, 자리: p ? (p.slotId || (p.at?'free':null)) : null }); })()`));
  leaves = s.잎 || 0; day = s.날;
  if (WANT_MATURE > 0 && (s.성숙 || 0) >= WANT_MATURE) { console.log(`   ★ 다 자란 잎 ${s.성숙} — 여기서 멈춘다`); break; }
  if (d % 5 === 0 || leaves >= WANT) console.log(`   d${s.날} · 그루 ${s.그루있나?'O':'X'} · 잎 ${s.잎}(다자람 ${s.성숙}) · 무늬 ${s.무늬} · 유효일 ${s.유효일} · 자리 ${s.자리}`);
  if (WANT_MATURE === 0 && leaves >= WANT) break;
}
const raw = String(await page.eval(`(()=>{ try { window.__save && window.__save(); } catch(e) {} return localStorage.getItem('byeot/save/1') || ''; })()`, true, 30000));
if (raw.length > 50) { mkdirSync(OUT.slice(0, OUT.lastIndexOf('/')), { recursive: true }); writeFileSync(OUT, raw); console.log(`★ 세이브 — ${OUT} · ${raw.length}자 · Day ${day} · 잎 ${leaves}`); }
else console.log('⛔ 세이브가 비었습니다');
await page.close(); clearTimeout(wd);
