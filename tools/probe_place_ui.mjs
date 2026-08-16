/* §B-4 · B-5 를 **화면 길로** 끝까지 굴린다.
     가구를 탭 → [옮기기] → 끌기 → 손 뗌 → 팝업 단추 확인 → [취소] 로 되돌리기
   ★ 방뷰 API 를 직접 부르지 않는다. 그러면 game.html 의 배선(세이브 반영)이 안 돈다 —
     B-5 가 바로 그 배선에서 새고 있었다. */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';
const _wd = setTimeout(() => { console.error('⏱'); process.exit(2); }, 420000); _wd.unref && _wd.unref();
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const DIR = 'docs/handoff/img/place';
fs.mkdirSync(DIR, { recursive: true });
const TAG = process.argv[2] || 'after';

const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
const errs = [];
page.on((m, p) => {
  if (m === 'Runtime.exceptionThrown') errs.push(String(p.exceptionDetails && p.exceptionDetails.text));
  if (m === 'Log.entryAdded' && p.entry && p.entry.level === 'error') errs.push(String(p.entry.text));
});
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);
await page.eval(`(()=>{ for(let i=0;i<40;i++){ try{ document.getElementById('dlgSkip').click() }catch{} } })()`, false);
await sleep(1500);

/* 손짓 흉내 — 핸들러가 읽는 것은 clientX/Y·pointerType·pointerId 뿐이다 */
const HELPERS = `
window.__ev = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, {
  bubbles:true, cancelable:true, clientX:x, clientY:y, pointerId:1, pointerType:'touch', isPrimary:true }));
window.__menu = () => (getComputedStyle(document.getElementById('furnActions')).display === 'none')
  ? ['(메뉴 안 뜸)']
  : [...document.querySelectorAll('#furnActions button')]
      .filter(b => getComputedStyle(b).display !== 'none').map(b => b.textContent.trim());
/* 그 가구를 실제로 짚는 화면 점을 찾는다 — 발밑을 쏘면 바닥을 맞는다 */
window.__hitPt = (uid) => { const rv=window.__rv;
  const r = document.getElementById('roomCanvas').getBoundingClientRect();
  const p = rv.screenPosOf(uid);
  /* ⚠ 위쪽부터 본다 — 상판 가까이를 누르면 **자리 탭**(onSlotTap)이 먼저 먹어
     가구 메뉴가 안 뜬다(재서 확인했다: dy −30 은 안 뜨고 −60 은 뜬다) */
  for (const dy of [-60,-70,-50,-40,-30,-20,-10,0]) for (const dx of [0,-20,20,-40,40]) {
    const x = r.left + p.x + dx, y = r.top + p.y + dy;
    let f=null; try { f = rv.pickFurnitureAt(x, y); } catch {}
    if (f && f.uid === uid) return { x, y };
  }
  return null; };
window.__snap = () => { const S=window.__S(), rv=window.__rv;
  return { desk: rv.furniture().find(f=>f.uid==='banjiha-desk'),
           statePots: (S.pots||[]).map(p=>({ id:p.id, slotId:p.slotId,
             at: p.at ? { x:+p.at.x.toFixed(3), y:+p.at.y.toFixed(3), z:+p.at.z.toFixed(3),
                          rotY:+(p.at.rotY||0).toFixed(3), onUid:p.at.onUid } : null })),
           view: rv.plants().map(p=>({ key:p.key, x:+p.pos.x.toFixed(3), z:+p.pos.z.toFixed(3) })),
           furn: (S.home && S.home.furniture) || null };
};`;
await page.eval(HELPERS, false);

/* ① 책상 윗면 자유 좌표 칸에 화분 하나 세운다 */
const put = await page.eval(`(async()=>{ const rv=window.__rv, S=window.__S();
  rv.showSlotRings(true, { potD: 0.20 });
  const c = rv.guideCells({ potD: 0.20 }).filter(x=>x.uid==='banjiha-desk' && x.fits)[0];
  const at = { x:c.x, y:c.y, z:c.z, rotY:0, onUid:'banjiha-desk', occIdx:null };
  S.pots.push({ id:'probe1', slotId:'free:probe1', at, kind:'monstera', days:60, sownDay:0 });
  await rv.setPlantAt('probe1', at, { kind:'monstera', days:60 });
  rv.showSlotRings(false);
  return JSON.stringify(window.__snap()); })()`);
console.log('① 놓은 뒤        ' + put);

/* ② 책상을 탭해서 고른다 */
const sel = await page.eval(`(async()=>{ const rv=window.__rv;
  const pt = window.__hitPt('banjiha-desk');
  if (!pt) return JSON.stringify({ 못짚음:true });
  const x = pt.x, y = pt.y;
  const c = document.getElementById('roomCanvas');
  window.__ev(c,'pointerdown',x,y); window.__ev(c,'pointerup',x,y);
  await new Promise(r2=>setTimeout(r2,300));
  return JSON.stringify({ 눌린자리:[Math.round(x),Math.round(y)], 메뉴: window.__menu(),
                           고른것: document.getElementById('furnName').textContent }); })()`);
console.log('② 가구를 탭      ' + sel);
await sleep(600);
await page.shot(`${DIR}/menu_picked_${TAG}.png`);

/* ③ [옮기기] → 끌기 → 손 뗌 */
const moved = await page.eval(`(async()=>{
  const mv = document.getElementById('furnMove');
  window.__ev(mv,'pointerdown', 0, 0);
  await new Promise(r=>setTimeout(r,300));
  const cat = document.getElementById('moveCatcher');
  const pt = window.__hitPt('banjiha-desk') || { x: innerWidth/2, y: innerHeight/2 };
  const x = pt.x, y = pt.y;
  /* 놓을 수 있는 데까지 끈다 — 방마다 빈 자리가 다르니 몇 갈래를 재 본다 */
  let dx = 0, label = '';
  window.__ev(cat,'pointerdown',x,y);
  for (const d of [60, 90, 40, -40, -60]) {
    window.__ev(cat,'pointermove',x+d,y);
    await new Promise(r2=>setTimeout(r2,150));
    label = document.getElementById('dropLabel').textContent;
    if (/여기로 옮깁니다/.test(label)) { dx = d; break; }
  }
  if (!dx) return JSON.stringify({ 끌수있는자리없음: label });
  window.__ev(cat,'pointermove',x+dx,y);
  await new Promise(r2=>setTimeout(r2,150));
  window.__ev(cat,'pointerup',x+dx,y);
  await new Promise(r2=>setTimeout(r2,2500));
  return JSON.stringify({ 끈픽셀: dx, 메뉴: window.__menu(), ...window.__snap() }); })()`);
console.log('③ 옮긴 뒤        ' + moved);
await sleep(800);
await page.shot(`${DIR}/menu_moved_${TAG}.png`);

/* ④ [취소] — 옮기기 전 자리로 되돌아가나 */
const undone = await page.eval(`(async()=>{
  const u = document.getElementById('furnUndo');
  if (!u || getComputedStyle(u).display === 'none') return JSON.stringify({ 없음:true });
  window.__ev(u,'pointerdown',0,0);
  await new Promise(r=>setTimeout(r,3000));
  return JSON.stringify({ 메뉴: window.__menu(), ...window.__snap() }); })()`);
console.log('④ [취소] 뒤      ' + undone);
await sleep(500);
await page.shot(`${DIR}/menu_undone_${TAG}.png`);

/* ⑤ **돌리기도** 같이 가나 (B-5 뒷줄) — [돌리기] 로 90° 돌린다 */
const turned = await page.eval(`(async()=>{
  const pt = window.__hitPt('banjiha-desk');
  if (!pt) return JSON.stringify({ 못짚음:true });
  const c = document.getElementById('roomCanvas');
  window.__ev(c,'pointerdown',pt.x,pt.y); window.__ev(c,'pointerup',pt.x,pt.y);
  await new Promise(r=>setTimeout(r,400));
  const before = window.__snap();
  window.__ev(document.getElementById('furnTurn'),'pointerdown',0,0);
  await new Promise(r=>setTimeout(r,300));
  const cat = document.getElementById('moveCatcher');
  /* 화면 폭 절반 = 한 바퀴 → 90° 는 innerWidth/8 */
  const dx = Math.round(innerWidth/8);
  window.__ev(cat,'pointerdown',pt.x,pt.y);
  window.__ev(cat,'pointermove',pt.x+dx,pt.y);
  await new Promise(r=>setTimeout(r,200));
  window.__ev(cat,'pointerup',pt.x+dx,pt.y);
  await new Promise(r=>setTimeout(r,2500));
  return JSON.stringify({ 전:{ desk:before.desk, pots:before.statePots },
                          후:{ ...window.__snap() }, 메뉴: window.__menu() }); })()`);
console.log('⑤ 돌린 뒤        ' + turned);

/* ⑥ 돌리기 — **자리가 넉넉한 서랍장**으로 다시 잰다 (책상은 의자에 막혀 못 돈다) */
const turned2 = await page.eval(`(async()=>{ const rv=window.__rv, S=window.__S();
  rv.showSlotRings(true, { potD: 0.20 });
  const c = rv.guideCells({ potD: 0.20 }).filter(x=>x.uid==='banjiha-dresser' && x.fits)[0];
  rv.showSlotRings(false);
  if (!c) return JSON.stringify({ 칸없음:true });
  const at = { x:c.x, y:c.y, z:c.z, rotY:0, onUid:'banjiha-dresser', occIdx:null };
  S.pots.push({ id:'probe2', slotId:'free:probe2', at, kind:'monstera', days:60, sownDay:0 });
  await rv.setPlantAt('probe2', at, { kind:'monstera', days:60 });
  const pt = window.__hitPt('banjiha-dresser');
  if (!pt) return JSON.stringify({ 못짚음:true });
  const cv = document.getElementById('roomCanvas');
  window.__ev(cv,'pointerdown',pt.x,pt.y); window.__ev(cv,'pointerup',pt.x,pt.y);
  await new Promise(r=>setTimeout(r,400));
  const before = { dresser: rv.furniture().find(f=>f.uid==='banjiha-dresser'),
                   pot: (S.pots||[]).find(p=>p.id==='probe2').at };
  window.__ev(document.getElementById('furnTurn'),'pointerdown',0,0);
  await new Promise(r=>setTimeout(r,300));
  const cat = document.getElementById('moveCatcher');
  const dx = Math.round(innerWidth/8);
  window.__ev(cat,'pointerdown',pt.x,pt.y);
  window.__ev(cat,'pointermove',pt.x+dx,pt.y);
  await new Promise(r=>setTimeout(r,200));
  const lab = document.getElementById('dropLabel').textContent;
  window.__ev(cat,'pointerup',pt.x+dx,pt.y);
  await new Promise(r=>setTimeout(r,2500));
  return JSON.stringify({ 전: before, 끌면서본말: lab,
    후: { dresser: rv.furniture().find(f=>f.uid==='banjiha-dresser'),
          pot: (S.pots||[]).find(p=>p.id==='probe2').at,
          view: rv.plants().map(p=>({key:p.key,x:+p.pos.x.toFixed(3),z:+p.pos.z.toFixed(3),yaw:+(p.yaw||0).toFixed(3)})) },
    메뉴: window.__menu(), 말: document.getElementById('dropLabel').textContent }); })()`);
console.log('⑥ 서랍장 돌리기  ' + turned2);

console.log('■ JS 예외/오류 ' + errs.length + (errs.length ? ' — ' + JSON.stringify(errs.slice(0, 8)) : ''));
await page.close();
