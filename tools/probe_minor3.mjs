/* 비판 넷째 판 MINOR 셋 자(core 11-01 · 총괄 차례) — 390×844 · 판: 총괄 humanQ g premove(반지하 Day 134)
   ㉮ b072 몬스테라에 지금 물을 줄 수 있으면 [몬스테라 물] 단추가 시루 단추(거두기 · 물)보다 «아래»(엄지 자리) · 촉촉한 날은 예전 자리(위)
   ㉯ b113 시루 묶음 이름표가 화면 가장자리에 걸려도 화면 안(카메라를 옮겨 묶음을 왼쪽 끝 · 오른쪽 끝으로 보낸다)
   ㉰ b106 원룸으로 이사 → [가방] 몬스테라 칸 → 확인 바: 손가락(말풍선+손)이 제목 «… 칸에 둘까요?» 글을 덮지 않는다 · 손가락은 떠 있다
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9447', OUT = process.env.OUT || null;
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
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { console.warn(e && e.message); } return 1; })()`, false); await sleep(800);

/* ── ㉮ b072 ── */
const btns = () => J(`(()=>{ const q = id => { const b=document.getElementById(id); if (!b || b.style.display === 'none' || !b.offsetParent) return null; const r=b.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), t: (b.textContent||'').replace(/\\s+/g,' ').slice(0,40) }; };
  return { pot: q('waterPot'), water: q('waterCrop'), harvest: q('harvestCrop'), potFirst: document.getElementById('stage').classList.contains('potFirst') }; })()`);
await J(`(()=>{ const S=window.__S(); for (const p of (S.pots||[])) if (p) p.wateredOnDay = S.day - 20; window.__redraw(); return 1; })()`);
await sleep(900);
const a1 = await btns();
console.log('  마른 판', JSON.stringify(a1));
const crop1 = a1.water || a1.harvest;
ok(!!a1.pot && !!crop1, '㉮ 판 — 몬스테라 물 단추와 시루 단추가 같이 떠 있다', JSON.stringify(a1));
ok(!!a1.pot && !!crop1 && a1.pot.top > crop1.top, '㉮ b072 물 줄 수 있으면 [몬스테라 물]이 시루 단추보다 아래(엄지 자리)', JSON.stringify({ pot: a1.pot, crop: crop1 }));
ok(!!a1.pot && !!crop1 && (a1.pot.bottom <= crop1.top || crop1.bottom <= a1.pot.top), '㉮ 두 단추가 안 겹친다', JSON.stringify({ pot: a1.pot, crop: crop1 }));
if (OUT) await page.shot(`${OUT}/390_b072_dry.png`);
await J(`(()=>{ const S=window.__S(); for (const p of (S.pots||[])) if (p) p.wateredOnDay = S.day; window.__redraw(); return 1; })()`);
await sleep(900);
const a2 = await btns();
console.log('  촉촉한 판', JSON.stringify(a2));
const crop2 = a2.water || a2.harvest;
ok(!a2.pot || !crop2 || a2.pot.top < crop2.top, '㉮ 촉촉한 날은 예전 자리(몬스테라 단추가 위)', JSON.stringify({ pot: a2.pot, crop: crop2 }));

/* ── ㉯ b113 ── */
const badges = () => J(`(()=>{ const W=innerWidth; return [...document.querySelectorAll('#siruBadges .sbadge')].filter(e => e.style.display !== 'none' && e.offsetParent).map(e => { const r=e.getBoundingClientRect(); return { g: e.classList.contains('sgroup'), t: (e.textContent||'').slice(0,30), l: Math.round(r.left), r: Math.round(r.right), W }; }); })()`);
const b0 = await badges();
const grp0 = b0.find(b => b.g);
console.log('  묶음 표지(처음)', JSON.stringify(b0.filter(b => b.g)));
ok(!!grp0, '㉯ 판 — 시루 묶음 표지가 떠 있다', JSON.stringify(b0.slice(0, 4)));
/* 묶음의 월드 가운데(놓인 시루 at 평균) — 카메라 목표를 옮겨 그 점을 화면 가장자리로 보낸다 */
const cen = await J(`(()=>{ const S=window.__S(); const ps=(S.firstPlay.beansprout.pots||[]).filter(p=>p&&p.at); if(!ps.length) return null; const n=ps.length; return { x: ps.reduce((a,p)=>a+p.at.x,0)/n, y: ps.reduce((a,p)=>a+(p.at.y||0),0)/n, z: ps.reduce((a,p)=>a+p.at.z,0)/n, n }; })()`);
async function pushTo(sxWant) {
  for (let k = 0; k < 6; k++) {
    const g = await J(`(()=>{ const rv=window.__rv, c=${JSON.stringify(cen)}; const s0=rv.worldToScreen(c.x,c.y,c.z), sx1=rv.worldToScreen(c.x+0.1,c.y,c.z), sz1=rv.worldToScreen(c.x,c.y,c.z+0.1); const b=rv.camBusy(); return { s0, dx:(sx1.x-s0.x)/0.1, dz:(sz1.x-s0.x)/0.1, t: b.tweenTo ? b.tweenTo.target : null }; })()`);
    if (!g || !g.s0) return null;
    const err = sxWant - g.s0.x;
    if (Math.abs(err) < 12) return g.s0;
    /* 목표를 +d 옮기면 화면에서 그 점은 −d 만큼 간다 — 화면 가로에 더 크게 걸리는 축으로 */
    const useX = Math.abs(g.dx) >= Math.abs(g.dz);
    const d = -err / (useX ? g.dx : g.dz);
    await J(`(()=>{ const rv=window.__rv; const b=rv.camBusy(); const cur = rv.camTo({}, 120).target; const t={ x: cur.x + ${useX ? 'd' : '0'}, y: cur.y, z: cur.z + ${useX ? '0' : 'd'} }; rv.camTo({ target: t }, 150); return 1; })()`.replace(/\bd\b/g, String(d)));
    await sleep(900);
  }
  return null;
}
let edgeL = null, edgeR = null;
if (cen) {
  const sL = await pushTo(18); await sleep(800);
  const bL = await badges(); edgeL = bL.filter(b => b.g);
  console.log('  왼쪽 끝으로', JSON.stringify(sL), JSON.stringify(edgeL));
  if (OUT) await page.shot(`${OUT}/390_b113_left.png`);
  ok(edgeL.length > 0 && edgeL.every(b => b.l >= 0 && b.r <= b.W), '㉯ b113 묶음을 왼쪽 끝으로 보내도 이름표가 화면 안', JSON.stringify(edgeL));
  const sR = await pushTo(372); await sleep(800);
  const bR = await badges(); edgeR = bR.filter(b => b.g);
  console.log('  오른쪽 끝으로', JSON.stringify(sR), JSON.stringify(edgeR));
  if (OUT) await page.shot(`${OUT}/390_b113_right.png`);
  ok(edgeR.length > 0 && edgeR.every(b => b.l >= 0 && b.r <= b.W), '㉯ b113 묶음을 오른쪽 끝으로 보내도 이름표가 화면 안', JSON.stringify(edgeR));
} else ok(false, '㉯ 놓인 시루 자리를 못 찾았다');

/* ── ㉰ b106 ── 이사(probe_d99e 와 같은 손) → 가방 몬스테라 칸 → 확인 바 */
await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = ts.rules.moveOutCostWon + 302780; window.__redraw(); return 1; })()`);
for (let i = 0; i < 6; i++) {
  const mv = await J(`(()=>({ moved: !!window.__S().tutorial.movedOut, panel: document.getElementById('movePanel').classList.contains('on') }))()`);
  if (mv.moved) break;
  if (mv.panel) await page.eval(`(()=>{ document.getElementById('moveGo').click(); return 1; })()`, false);
  else await page.eval(`(()=>{ window.__byeotSheet.tab('room'); document.getElementById('moveOut').click(); return 1; })()`, false);
  await sleep(1200); await dlgOnly();
}
await sleep(6000); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3000); await dlgOnly();
const pb = await J(`(()=>{ window.__byeotSheet.open('bag'); const c=[...document.querySelectorAll('#bagGrid .bagslot[data-potbag]')]; return c.map(e => e.getAttribute('data-potbag')); })()`);
console.log('  가방 그루 칸', JSON.stringify(pb));
await page.eval(`(()=>{ const c=document.querySelector('#bagGrid .bagslot[data-potbag]'); if (c) c.click(); return 1; })()`, false);
let cf = null;
for (let i = 0; i < 20; i++) {
  await sleep(500);
  cf = await J(`(()=>{ const pc=document.getElementById('placeConfirm'); const on = pc && pc.offsetParent !== null && getComputedStyle(pc).display !== 'none';
    const h=document.getElementById('hint'); const hon = h && h.classList.contains('on');
    if (!on || !hon) return { on, hon };
    const who=document.getElementById('placeConfirmWho'); const rg=document.createRange(); rg.selectNodeContents(who); const w=rg.getBoundingClientRect();
    const hr=h.getBoundingClientRect(); const ok=document.getElementById('placeOk').getBoundingClientRect();
    const hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    const R=q=>({ l:Math.round(q.left), t:Math.round(q.top), r:Math.round(q.right), b:Math.round(q.bottom) });
    return { on, hon, who: (who.textContent||'').slice(0,40), say: (h.textContent||'').replace(/\\s+/g,' ').slice(0,40), cls: h.className, whoR: R(w), hintR: R(hr), okR: R(ok), overWho: hit(hr, w), inScreen: hr.left >= 0 && hr.right <= innerWidth };
  })()`);
  if (cf && cf.on && cf.hon) break;
}
console.log('  확인 바', JSON.stringify(cf));
if (OUT) await page.shot(`${OUT}/390_b106_confirm.png`);
ok(!!(cf && cf.on && cf.hon), '㉰ 판 — 확인 바와 손가락이 같이 떠 있다', JSON.stringify(cf));
ok(!!(cf && cf.on && cf.hon && !cf.overWho), '㉰ b106 손가락이 확인 바 제목 글을 덮지 않는다', JSON.stringify(cf && { who: cf.who, whoR: cf.whoR, hintR: cf.hintR, cls: cf.cls }));
ok(!!(cf && cf.on && cf.hon && cf.inScreen), '㉰ 손가락이 화면 안', JSON.stringify(cf && cf.hintR));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_minor3: 빨강 ${bad}` : 'probe_minor3: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
