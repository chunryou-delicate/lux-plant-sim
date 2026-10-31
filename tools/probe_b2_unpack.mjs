/* 비판 셋째 판 B2 BLOCKER 자(core 10-31) — «원룸 이삿짐 재배판을 못 풂 · 가구 칸 누르기가 한 자리에 겹침» · 390×844 · 사람 손 길
   판: 총괄 humanQ moved(원룸 Day 136 · 들고 온 가구 · 이삿짐 시루 · 재배판이 가방에)
   손: [가방] → 들고 온 가구 칸을 하나씩 누른다(칸 누르기 = 게임이 자리를 고름) → 이삿짐 칸을 누르고 [확인]을 «빈 자리가 없습니다» 또는 다 풀릴 때까지
   ㉮ 들고 온 가구가 서로 겹치지 않는다(발자국 쌍) · 못 놓으면 «놓을 자리가 없습니다»라고 말한다
   ㉯ 들고 온 가구만으로 이삿짐 시루 · 재배판이 다 풀린다
   ㉰ 풀린 뒤 할 일 oneroom_unpack 이 넘어가고 손가락이 [가방]에 묶이지 않는다
   ㉱ 삽수 병(가방 수경병 칸) 누르기 놓기가 된다(있으면)
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-master/d_66841206/humanQ/humanQ_g_premove.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (!t) return; await page.eval(`(()=>{ const s=document.getElementById('dlgSkip'); if(s) s.click(); const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
await dlgOnly();
if (process.env.FROM_PREMOVE !== '0') {
  /* premove(반지하 Day 134) → [다음 날] → 지갑을 이사비 + 2,780(비판 판 꼴 · 재는 손질) → [원룸으로 이사] → 창 [이사한다/그래도 간다] — 반지하 가구가 가방에 담긴 원룸 첫날 */
  await page.eval(`(()=>{ const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
  await sleep(1500); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
  await sleep(4000); await dlgOnly();
  await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = ts.rules.moveOutCostWon + 2780; window.__redraw(); return 1; })()`);
  for (let i = 0; i < 6; i++) {
    const mv = await J(`(()=>({ moved: !!window.__S().tutorial.movedOut, panel: document.getElementById('movePanel').classList.contains('on') }))()`);
    if (mv.moved) break;
    if (mv.panel) await page.eval(`(()=>{ document.getElementById('moveGo').click(); return 1; })()`, false);
    else await page.eval(`(()=>{ window.__byeotSheet.tab('room'); document.getElementById('moveOut').click(); return 1; })()`, false);
    await sleep(1200); await dlgOnly();
  }
  await sleep(6000); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3000); await dlgOnly();
}
const banner = () => J(`(()=>{ const e=document.getElementById('event'); return e && e.classList.contains('on') ? (e.innerText||'').replace(/\\s+/g,' ').slice(0,120) : ''; })()`);
const bagState = () => J(`(()=>{ window.__byeotSheet.open('bag'); const g=document.getElementById('bagGrid');
  return { furn: [...g.querySelectorAll('[data-furnbag]')].map(b=>b.getAttribute('data-furnbag')), boxB: (g.querySelector('[data-place="box:beansprout"] .qty')||{}).textContent || null, boxM: (g.querySelector('[data-place="box:musun"] .qty')||{}).textContent || null,
    jar: !!g.querySelector('[data-cutbag], [data-place^="cut"]') }; })()`);
const s0 = await bagState();
console.log('  가방', JSON.stringify(s0));
const room0 = await J(`(()=>({ room: window.__S().home.room, day: window.__S().day }))()`);
ok(room0.room === 'oneroom', '판 — 원룸 이사 직후', JSON.stringify(room0));
/* ㉮ 가구 칸 누르기 */
const said = [];
for (let i = 0; i < 12; i++) {
  const st = await bagState();
  if (!st.furn.length) break;
  const uid = st.furn[0];
  await page.eval(`(()=>{ const b=document.querySelector('#bagGrid [data-furnbag="${uid}"]'); if (b) b.click(); return 1; })()`, false);
  await sleep(2500);
  const bn = await banner(); said.push(bn);
  const st2 = await bagState();
  if (st2.furn.includes(uid)) { console.log('   가구 안 놓임', uid, bn); break; }
}
const furn = await J(`(()=>{ const list=(window.__rv.furniture && window.__rv.furniture()) || []; const rects=list.filter(f=>f && f.size && f.size.h > 0.05 && !f.hang).map(f=>({ uid:f.uid, x:f.x, z:f.z, w:f.size.w, d:f.size.d, rot:(f.rot||0)*Math.PI/180 }));
  const corners=r=>{ const c=Math.cos(r.rot), s=Math.sin(r.rot), hw=r.w/2, hd=r.d/2; return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([a,b])=>({x:r.x+a*c-b*s, z:r.z+a*s+b*c})); };
  const sep=(A,B)=>{ for (const r of [A,B]) { const c=Math.cos(r.rot), s=Math.sin(r.rot); for (const ax of [{x:c,z:s},{x:-s,z:c}]) { let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9; for (const p of corners(A)) { const t=p.x*ax.x+p.z*ax.z; a0=Math.min(a0,t); a1=Math.max(a1,t); } for (const p of corners(B)) { const t=p.x*ax.x+p.z*ax.z; b0=Math.min(b0,t); b1=Math.max(b1,t); } if (a1 <= b0 + 0.02 || b1 <= a0 + 0.02) return true; } } return false; };
  const pairs=[]; for (let i=0;i<rects.length;i++) for (let j=i+1;j<rects.length;j++) if (!sep(rects[i],rects[j])) pairs.push(rects[i].uid+'×'+rects[j].uid);
  return { n: rects.length, pairs: pairs.slice(0, 8), npairs: pairs.length }; })()`);
console.log('  가구', JSON.stringify(furn), '· 배너', JSON.stringify(said.filter(Boolean).slice(0, 4)));
if (OUT) await page.shot(`${OUT}/390_b2_furn.png`);
ok(furn.npairs === 0, '㉮ 칸 누르기로 놓은 가구끼리 안 겹친다', JSON.stringify(furn.pairs));
/* ㉯ 이삿짐 칸 누르기 → [확인] */
let placed = 0, stuck = null;
for (let i = 0; i < 40; i++) {
  const st = await bagState();
  const sel = st.boxM ? 'box:musun' : (st.boxB ? 'box:beansprout' : null);
  if (!sel) break;
  await page.eval(`(()=>{ const c=document.querySelector('#bagGrid [data-place="${sel}"]'); if (c) c.click(); return 1; })()`, false);
  await sleep(1500);
  const conf = await J(`(()=>({ c: document.getElementById('stage').classList.contains('confirming') }))()`);
  if (!conf.c) { stuck = { sel, banner: await banner() }; break; }
  await page.eval(`(()=>{ document.getElementById('placeOk').click(); return 1; })()`, false);
  await sleep(1300); await dlgOnly(); placed++;
}
const s1 = await bagState();
console.log('  이삿짐', JSON.stringify({ placed, left: { B: s1.boxB, M: s1.boxM }, stuck }));
if (OUT) await page.shot(`${OUT}/390_b2_boxes.png`);
ok(!s1.boxB && !s1.boxM, '㉯ 들고 온 가구만으로 이삿짐 시루 · 재배판이 다 풀린다', JSON.stringify({ placed, left: { B: s1.boxB, M: s1.boxM }, stuck }));
/* 그루 · 삽수(가방 [data-potbag] · 삽수 칸) — 사람처럼 칸을 누르고 [확인] */
let grown = 0; const growLog = [];
/* 사람 손 — 칸 한가운데를 마우스로 누르고 뗀다(CDP Input · 포인터 길 그대로) */
const tapSel = async (sel) => {
  const r = await J(`(()=>{ window.__byeotSheet.open('bag'); const c=document.querySelector(${JSON.stringify(sel)}); if (!c) return null; c.scrollIntoView({block:'center'}); const b=c.getBoundingClientRect(); return { x: b.left + b.width/2, y: b.top + b.height/2, w: b.width }; })()`);
  if (!r || !(r.w > 0)) return false;
  await sleep(300);
  const r2 = await J(`(()=>{ const c=document.querySelector(${JSON.stringify(sel)}); if (!c) return null; const b=c.getBoundingClientRect(); return { x: b.left + b.width/2, y: b.top + b.height/2 }; })()`);
  if (!r2) return false;
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r2.x, y: r2.y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r2.x, y: r2.y, button: 'left', clickCount: 1 });
  await sleep(80);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r2.x, y: r2.y, button: 'left', clickCount: 1 });
  return true;
};
for (let i = 0; i < 10; i++) {
  const sel = await J(`(()=>{ window.__byeotSheet.open('bag'); const g=document.getElementById('bagGrid'); const c=g.querySelector('[data-potbag]') || g.querySelector('[data-place^="cutting:"]') || g.querySelector('[data-place^="species:"]');
    if (!c) return null; return c.hasAttribute('data-potbag') ? '#bagGrid [data-potbag="' + c.getAttribute('data-potbag') + '"]' : '#bagGrid [data-place="' + c.getAttribute('data-place') + '"]'; })()`);
  if (!sel) break;
  const tapped = await tapSel(sel);
  await sleep(1500);
  const conf = await J(`document.getElementById('stage').classList.contains('confirming')`);
  growLog.push({ sel: sel.replace('#bagGrid ', ''), tapped, conf });
  if (!conf) { console.log('   그루 안 놓임', sel, await banner()); break; }
  await page.eval(`(()=>{ document.getElementById('placeOk').click(); return 1; })()`, false); await sleep(1300); await dlgOnly(); grown++;
}
ok(growLog.length === 0 || growLog.every(g => g.conf), '㉱ 가방 그루 · 삽수 병을 누르면 [확인] 자리가 선다(④ 삽수 병 누르기)', JSON.stringify(growLog));
const left = await J(`(()=>{ const S=window.__S(); window.__byeotSheet.open('bag'); const g=document.getElementById('bagGrid'); return { pot: g.querySelectorAll('[data-potbag]').length, cut: g.querySelectorAll('[data-place^="cutting:"]').length, sp: g.querySelectorAll('[data-place^="species:"]').length, places: [...g.querySelectorAll('[data-place]')].map(x=>x.getAttribute('data-place')).slice(0,12) }; })()`);
console.log('  가방에 남은 것', JSON.stringify(left));
console.log('  그루 · 삽수 놓음', grown);
await page.eval(`(()=>{ window.__byeotSheet.close(); return 1; })()`, false); await sleep(800);
/* 할 일은 아침에 다시 센다 — [다음 날] 한 번(사람 손) */
await page.eval(`(()=>{ const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
await sleep(1500); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
await sleep(4000); await dlgOnly(); await sleep(1500);
/* ㉰ 할 일 · 손가락 */
const q = await J(`(()=>{ const S=window.__S(); const t=document.querySelector('.hintTarget'); return { open: S._questOpen || null, taken: (S.stamina.questsTaken||[]).slice(-4), hint: t ? (t.id || t.className.split(' ')[0]) : null, say: (document.querySelector('#hint .say')||{}).textContent || null }; })()`);
console.log('  할 일', JSON.stringify(q));
ok(!(q.open || []).includes('oneroom_unpack') || (q.taken || []).includes('oneroom_unpack'), '㉰ 할 일 «짐 풀기»가 넘어갔다', JSON.stringify(q));
ok(q.hint !== 'openBag', '㉰ 손가락이 [가방]에 묶이지 않는다', JSON.stringify({ hint: q.hint, say: q.say }));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_b2_unpack: 빨강 ${bad}` : 'probe_b2_unpack: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
