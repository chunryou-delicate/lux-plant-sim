/* tools/probe_oneroom_boot.mjs — **이사한 원룸이 «서나», 그리고 거기서 가구를 놓으면**
   ------------------------------------------------------------------
   ⚠ 헤드리스는 방을 «두 번째로» 못 짓는다 — WebGL 판을 하나밖에 못 연다(probe_remountable).
     그래서 `remountRoomView` 를 지나는 이사는 이 자로 못 잰다.
   ⇒ ★ 그러면 «다시 짓지» 말고 ⇒ ★★ 「이사한 판을 저장해 두고 «새로 켠다»」.
     새로 켜면 방을 «처음» 짓는 것이라 그 벽을 안 지난다 — 하나만 다르게(견줌의 계율).
   재는 것: ① 원룸이 서나 ② 가방에 아홉이 그대로 있나 ③ 거기서 하나 놓으면 몇 ms 이고 서나
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
const skip = async (n = 40) => {
  for (let i = 0; i < n; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (b !== 'true') break;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
      const x=document.getElementById('dlgBox'); if(x)x.click();
      const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
    await sleep(250);
  }
};
await skip();
/* 이사 — 3D 는 여기서 안 선다(위 ⚠). 상태만 넘긴다 */
await page.eval(`(()=>{ const S=window.__S(); const ts=S.tutorial;
  ts.cashWon = ts.rules.moveOutCostWon + 100000;
  ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day }; window.__redraw(); })()`, false);
await sleep(600);
await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false);
await sleep(6000);
await skip(20);
console.log('■ 이사 직후(같은 판) —', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ 방:S.home.room, '3D 섰나': !!window.__rv,
    가방:((S.home||{}).furnitureBag||[]).length,
    '조도판 가구':(window.__io.light.room.def.furniture||[]).length }); })()`));
/* 저장이 되었나 보고, 새로 켠다 */
console.log('■ 저장 —', await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){}
  const keys=Object.keys(localStorage);
  return JSON.stringify({ 칸:keys.slice(0,4), 수:keys.length }); })()`));
await sleep(1200);
console.log('');
console.log('=== ① 새로 켜면 원룸이 «서나» ===');
const t0 = Date.now();
await page.goto(`${BASE}/game.html`);
let stood = null;
for (let i = 0; i < 150; i++) {
  await sleep(1000);
  if (await page.eval(`String(!!window.__rv)`) === 'true') { stood = Date.now() - t0; break; }
}
console.log(' ', stood == null ? '★★ 안 섰습니다' : `${stood} ms 만에 섰습니다`);
console.log(' ', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ 방:S.home.room,
    'room-ok': document.getElementById('stage').classList.contains('room-ok'),
    '3D 가구':((window.__rv&&window.__rv.furniture())||[]).length,
    '조도판 가구':(window.__io.light.room.def.furniture||[]).length,
    자리:(window.__io.light.room.slots||[]).length,
    가방:((S.home||{}).furnitureBag||[]).length,
    덮개: (()=>{ const fb=document.getElementById('roomFallback');
      return fb && fb.style.display!=='none' ? (fb.textContent||'').trim().slice(0,90) : null; })() }); })()`));
await skip(20);
console.log('');
console.log('=== ③ 원룸에서 가방 가구 하나를 놓으면 ===');
await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
await sleep(1500);
console.log(' ', await page.eval(`(async()=>{ const S=window.__S();
  const n0=(S.home.furnitureAdded||[]).length;
  const c=document.querySelector('[data-furnbag]');
  if(!c) return JSON.stringify({ 탈:'가방 칸이 없다' });
  const ko=((c.querySelector('.nm')||{}).textContent||'').trim();
  const t=performance.now(); c.click();
  const sync=performance.now()-t; let done=null, uid=null;
  for(let i=0;i<200;i++){ await new Promise(r=>setTimeout(r,50));
    const add=(window.__S().home.furnitureAdded||[]);
    if(add.length>n0){ uid=add[add.length-1].uid;
      if((window.__io.light.room.def.furniture||[]).some(f=>f&&f.uid===uid)){ done=performance.now()-t; break; } } }
  await new Promise(r=>setTimeout(r,800));
  return JSON.stringify({ 놓은것:ko, uid,
    '누른 손이 돌아오기까지 ms': Math.round(sync),
    '방에 들기까지 ms': done==null? null : Math.round(done),
    '3D 에 섰나': ((window.__rv&&window.__rv.furniture())||[]).some(f=>f.uid===uid),
    가방:(window.__S().home.furnitureBag||[]).length,
    자리:(window.__io.light.room.slots||[]).length,
    '방 서 있나': !!window.__rv }); })()`, true, 200000));
console.log('');
console.log('=== ④ 자를 조인다 — 놓인 가구가 방 «안»에 «온전히» 들어갔나 ===');
/* ★★★ 2026-08-30 — 벽을 뚫고 서던 것을 잡고 나서 «자»에 건다.
   ⛔ 코어 검사(place.js §inRoom)는 «가운데 점»만 본다 — 게다가 경계는 ε 로 봐준다.
     그래서 「벽에 딱 붙은 금」이 «통과»로 세어졌고, 화면에서는 침대가 반쯤 나가 있었다.
   ⇒ 여기서는 ★ «덩치»를 본다 — 폭·깊이를 돌려서 네 귀가 방 안인지 잰다.
   ⚠ 코어를 안 고친다. 「가운데만 보는 것」이 틀린 규칙은 아니다(가구는 벽에 붙여 놓는다).
     ⇒ ★ 다만 「자동으로 세워 주는 자리」가 벽을 넘으면 그건 «화면 몫»의 탈이고, 이 자가 잡는다. */
console.log(' ', await page.eval(`(async()=>{
  const pre = await fetch('/data/furniture_presets.json').then(r=>r.json()).then(j=>j.presets||j);
  const sz = window.__io.light.room.size;
  const rows = (window.__io.light.room.def.furniture||[]);
  const out = [];
  for (const f of rows) {
    const p = pre[f.preset]; const m = p && p.size_m;
    if (!m || !(m.w>0) || !(m.d>0)) continue;
    const t = (f.rot||0) * Math.PI/180, c = Math.abs(Math.cos(t)), s2 = Math.abs(Math.sin(t));
    const hw = m.w/2*c + m.d/2*s2, hd = m.w/2*s2 + m.d/2*c;
    const outX = Math.abs(f.x||0) + hw - sz.w/2, outZ = Math.abs(f.z||0) + hd - sz.d/2;
    const over = Math.max(outX, outZ);
    if (over > 0.02) out.push({ uid:f.uid, 넘은m: Math.round(over*100)/100 });
  }
  return JSON.stringify({ 방: sz.w + '×' + sz.d, '가구 수': rows.length,
    '벽을 넘은 것': out.length, 어느것: out.slice(0,5),
    판정: out.length ? '★ 넘은 것이 있다' : '✔ 다 방 안이다' }); })()`));
/* ★ 그리고 «자가 그것을 잡나»를 잰다 — 자를 조여 놓고 안 재면 조인 줄 모른다.
   옛 자리(방너비/2, 방깊이/2)를 그 가구에 대 보고 «몇 m 넘는지» 셈한다(놓지는 않는다). */
console.log('  · 옛 자리였다면 —', await page.eval(`(async()=>{
  const pre = await fetch('/data/furniture_presets.json').then(r=>r.json()).then(j=>j.presets||j);
  const sz = window.__io.light.room.size;
  const added = (window.__S().home.furnitureAdded||[]);
  const one = added[added.length-1]; if(!one) return JSON.stringify({ 탈:'놓은 것이 없다' });
  const m = (pre[one.preset]||{}).size_m; if(!m) return JSON.stringify({ 탈:'크기를 모른다' });
  const hw = m.w/2, hd = m.d/2;
  const over = Math.max(Math.abs(sz.w/2)+hw - sz.w/2, Math.abs(sz.d/2)+hd - sz.d/2);
  return JSON.stringify({ 것:one.preset, '옛 자리': (sz.w/2)+','+(sz.d/2),
    '벽을 넘었을 길이 m': Math.round(over*100)/100,
    판정: over > 0.02 ? '★ 자가 잡는다' : '⛔ 자가 «못» 잡는다 — 조인 것이 아니다' }); })()`));
await page.shot('docs/handoff/img/oneroom_placed.png').catch(() => {});
await page.close(); clearTimeout(wd);
