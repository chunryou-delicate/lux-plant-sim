/* 7C11 자(core 11-03 · 총괄 가름 · 7C5 재현에서 나옴 c7/x7c5_plus1s) — 바닥 단추를 누른 뒤 주인공이 걸어가는 동안 그 단추가 대답한다
   ⛔ 7C5 재현: 바닥 [🥣 콩나물 거두기]를 누르면 걸어가 닿기까지 5~9초 동안 단추 · 체력 칸이 그대로(«🚶 가는 중…»은 방 안 말풍선 위에만) → 단추만 보는 사람은 또 누름
   판: 비판 6판 A100 세이브(C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json · 프로필 안 건드림) — 손질: 체력 가득 · 콩나물 시루 셋 익음 · 나머지는 자라는 중
   단언(390 · 사람 손 누름 Input.dispatchMouseEvent)
     ㉮ 누른 뒤 0.4초 — 단추 둘째 줄 «🚶 가는 중…»(data-walk · ::after) · 흐림(opacity ≤ 0.7) · disabled 아님 · 아직 체력 그대로
     ㉯ 걷는 중 둘째 누름 — 버려짐(체력은 한 번만 · 거둔 판 3) · 그동안 꼬리 그대로
     ㉰ 일이 끝나면 — 꼬리 · 흐림이 걷힘(data-walk 없음 · 단추가 남았으면 opacity ≥ 0.9)
     예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_A = process.env.SAVE_A || 'C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_A)) { ok(false, '세이브 없음', SAVE_A); process.exit(1); }
const ID = 'harvestCrop', WALK = '🚶 가는 중…';
const stage = () => { const w = JSON.parse(fs.readFileSync(SAVE_A, 'utf8')); const s = w.state; s.stamina.left = s.stamina.max; s.shop.stock.bean_seed = 20;
  const hd = s.firstPlay.beansprout.harvestDays || 5; let i = 0;
  for (const p of s.firstPlay.beansprout.pots) { if (!p.slotId) continue; const ripe = i++ < 3;
    Object.assign(p, { sown: true, harvested: false, ageDays: ripe ? hd : 1, startedOnDay: s.day - (ripe ? hd : 1), idleSinceDay: s.day - (ripe ? hd : 1) }); }
  for (const v of Object.values(s.firstPlay.crops || {})) for (const p of ((v && v.pots) || [])) if (p.slotId) Object.assign(p, { sown: true, harvested: false, ageDays: 1, startedOnDay: s.day - 1, idleSinceDay: s.day - 1 });
  return JSON.stringify(w); };
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(stage())}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
for (let i = 0; i < 120; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1200);
{ let n = 0; for (let i = 0; i < 60 && n < 2; i++) { const b = await J(`(()=>{ try { const c = window.__rv.camBusy(); return !!(c && (c.tween || c.down)); } catch (e) { return false; } })()`); n = b === false ? n + 1 : 0; await sleep(200); } }
for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) break; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); }
await sleep(1500);
const ST = `(()=>{ const S=window.__S(), b=document.getElementById('${ID}'), cs=b ? getComputedStyle(b) : null, af=b ? getComputedStyle(b, '::after').content : null;
  return { left: S.stamina.left, harv: S.firstPlay.beansprout.pots.filter(p=>p.slotId && p.harvested).length, shown: !!(b && b.offsetParent && cs.display !== 'none'),
    walk: b ? (b.dataset.walk || null) : null, after: af, op: cs ? +cs.opacity : null, dis: b ? !!b.disabled : null, txt: b ? (b.textContent||'').trim() : null }; })()`;
const tap = async () => { const r = await J(`(()=>{ const b=document.getElementById('${ID}'); const q=b.getBoundingClientRect(); const x=q.left+q.width/2, y=q.top+q.height/2; const top=document.elementFromPoint(x,y); return { x, y, top: top ? (top.id || top.tagName) : null }; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(60);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  return r; };
const s0 = await J(ST);
console.log('  누르기 전', JSON.stringify(s0));
ok(!s0.탈 && s0.shown && !s0.walk, '판 — 바닥 [🥣 거두기]가 보이고 꼬리 없음', JSON.stringify(s0));
const r1 = await tap(); await sleep(400);
const a = await J(ST);
console.log('  누름 +0.4초', JSON.stringify({ r1, a }));
if (OUT) await page.shot(`${OUT}/390_c7j_walk.png`);
ok(!a.탈 && r1.top === ID && a.walk === WALK && /가는 중/.test(a.after || '') && a.op <= 0.7 && a.dis === false && a.left === s0.left,
   `㉮ 누른 뒤 0.4초 — 단추 둘째 줄 «${WALK}» · 흐림 · disabled 아님 · 체력 아직 그대로`, JSON.stringify({ top: r1.top, walk: a.walk, after: a.after, op: a.op, dis: a.dis, left: [s0.left, a.left] }));
/* 둘째 누름은 ㉮ 바로 뒤 — 걷기가 짧은 판(주인공이 가까움)은 1~2초 안에 끝나 단추가 사라진다(11-03 fm53 첫 판) · 그때 이미 끝났으면 꼬리 단언은 건너뜀(체력 한 번 단언은 그대로) */
const pre = await J(ST);
const r2 = pre.shown && pre.harv === 0 ? await tap() : null; await sleep(300);
const b = await J(ST);
console.log('  둘째 누름 +0.3초', JSON.stringify({ pre: { harv: pre.harv, shown: pre.shown }, r2, b }));
if (r2 && r2.top === ID && b.harv === 0) ok(!b.탈 && (b.walk === WALK || /거두는 중/.test(b.walk || '')), '㉯ 걷는 중 둘째 누름 뒤에도 꼬리 그대로', JSON.stringify({ walk: b.walk, after: b.after }));
else console.log('  -- ㉯ 꼬리 단언은 건너뜀(둘째 누름 전후에 이미 끝남 · 걷기가 짧은 판)', JSON.stringify({ r2, harv: b.harv }));
let c = null;
for (let i = 0; i < 60; i++) { c = await J(ST); if (!c.탈 && !c.walk && c.harv >= 3) break; await sleep(300); }
await sleep(800); c = await J(ST);
console.log('  끝난 뒤', JSON.stringify(c));
if (OUT) await page.shot(`${OUT}/390_c7j_done.png`);
ok(!c.탈 && c.harv === 3 && s0.left - c.left === 3, '㉯ 체력은 한 번만(거둔 판 3 · 체력 −3)', JSON.stringify({ harv: c.harv, left: [s0.left, c.left] }));
ok(!c.탈 && !c.walk && (!c.shown || c.op >= 0.9), '㉰ 일이 끝나면 꼬리 · 흐림이 걷힘', JSON.stringify({ walk: c.walk, shown: c.shown, op: c.op, txt: c.txt }));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { void e; }
console.log(bad ? `\nprobe_critic7_j: 빨강 ${bad}` : '\nprobe_critic7_j: 다 통과');
process.exit(bad ? 1 : 0);
