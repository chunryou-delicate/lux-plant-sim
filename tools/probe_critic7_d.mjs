/* 비판 7판 7C3 자(core 11-02 · 총괄 가름) — 판이 닫히면 판 안 대상 손가락은 [가방] 기둥을 짚는다
   ⛔ 비판 7판 S(S16 · S18 · S19_bag3): 이사 → 가방에서 3단 선반 놓기 → 가방 판 닫힘 → 손가락 «들고 온 채소를 가구 위에 올리세요»가 방 아래 빈 자리(css 64,660)를 짚음 ·
      세 번 눌러도 아무 일 없음 · 가방을 열자 같은 손가락이 «이삿짐 — 콩나물 시루» 칸에 나타남
   까닭(재현): 판 속 목록(.sheetbody)을 굴린 채 판을 닫으면 판 위로 잘려 나간 칸의 네모가 닫힌 판 위쪽에 «화면 안»으로 남는다(§onScreen 이 잘림을 안 봄) — 그 점에서 잡히는 것은 방 바닥
   판: 총괄 humanQ premove(반지하 Day 134 · C:/Users/pc/AppData/Local/Temp/byeot-master/d_66841206/humanQ/humanQ_g_premove.json · 프로필 안 건드림) → [다음 날] → 지갑 손질 → 원룸 이사
   단언
     ㉮ 이사 직후 손가락 [가방]
     ㉯ 가방에서 3단 선반을 누르면(판 닫힘) 1.5초 뒤 손가락은 [가방] — 손가락이 짚는 것의 가운데에서 그것이 잡힌다
     ㉰ 가방을 다시 열고 판 속 목록을 맨 아래로 굴린 뒤 닫으면 손가락은 [가방](판 안 칸 아님) · 짚는 것의 가운데에서 그것이 잡힌다 — 세 번 다시 물어도 같다
     ㉱ 가방을 다시 열면(목록은 굴린 그대로) 손가락이 판 안 칸을 «보이게» 짚는다(잘린 칸은 굴려 보임 · 가운데에서 그 칸이 잡힘)
     ㉳ (11-03 여섯째 묶음 8C5 · 총괄 가름) 몬스테라 · 삽수를 사람 손으로 놓아 이삿짐 차례가 되면(시루 · 판 둘 이상) 손가락은 머리줄 [한꺼번에 놓기 (N개)] 단추(보이는 · 눌리는 단추 위)
     ㉲ (11-03 plan §13 ㉡) 원룸 도착 배너 아래 줄 «할 일 탭과 가계부에서 내 집 마련까지 얼마인지 볼 수 있습니다»
     ㉴ (11-03 8C5 꼬리 · plan §15) 그 단추를 짚는 말은 «빛이 맞는 빈 자리에 바로 놓습니다»
     ㉵ 손(글자 상자) ↔ 단추 상자 거리 ≤ 12px(390 · 360) — 사진 390_c7d_boxall 에서 손이 말풍선 오른쪽 끝 밑으로 꺾여 110px 떨어졌다(전역 .row flex-wrap)
     ㉶ 말풍선이 가방 칸(.bagslot) 어느 것과도 안 겹침(390 · 360) — 칸 머리 ×N 표를 덮었다
     ㉷ 말풍선이 위 «가방 · N개» 머리글을 안 덮음 · 화면 안(390 · 360)
     예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-master/d_66841206/humanQ/humanQ_g_premove.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE)) { ok(false, '세이브 없음', SAVE); process.exit(1); }
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return; await page.eval(`(()=>{ const s=document.getElementById('dlgSkip'); if(s) s.click(); const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); } };
await dlgOnly();
/* ★ 11-03 — 배너 글 적기(자 쪽 관찰 · 게임은 안 건드림) */
await J(`(()=>{ const e=document.getElementById('event'); window.__c7dBan = []; new MutationObserver(()=>{ const t=(e.textContent||'').trim(); if (t) window.__c7dBan.push(t); }).observe(e, { childList:true, subtree:true, characterData:true }); return 1; })()`);
/* premove → [다음 날] → 지갑을 이사비 + 2,780(probe_b2_unpack 과 같은 손질) → [원룸으로 이사] */
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
{ const ban = await J(`(window.__c7dBan || [])`);
  console.log('  ㉲ 이사 배너', JSON.stringify((Array.isArray(ban) ? ban : []).filter(t => /내 집|가계부/.test(t)).slice(0, 3)));
  ok(Array.isArray(ban) && ban.some(t => t.includes('할 일 탭과 가계부에서 내 집 마련까지 얼마인지 볼 수 있습니다')) && !ban.some(t => /\[방\] 판과 가계부에서/.test(t)),
     '㉲ 원룸 도착 배너 아래 줄 «할 일 탭과 가계부에서 내 집 마련까지 얼마인지 볼 수 있습니다»', JSON.stringify((Array.isArray(ban) ? ban : []).filter(t => /가계부/.test(t)).slice(0, 3))); }
await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1500); await bannerOff();
const H = `(async()=>{ try { window.__byeotHint(); } catch (e) { void e; } await new Promise(r=>setTimeout(r,900)); const h=document.getElementById('hint'), t=document.querySelector('.hintTarget');
  if (!t || !h.classList.contains('on')) return { on: h.classList.contains('on'), none: true };
  const q=t.getBoundingClientRect(); const hit=document.elementFromPoint(q.left+q.width/2, q.top+q.height/2);
  return { on: true, tid: t.id || null, act: t.getAttribute('data-act'), inSheet: !!t.closest('#sheet'), cell: !!t.closest('.bagslot'), r: [Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)],
    hitIsT: !!hit && (hit === t || t.contains(hit)), hit: hit ? (hit.id || hit.tagName + '.' + (hit.className||'').toString().slice(0,24)) : null, say: (h.querySelector('.say')||{}).textContent,
    sheetOpen: document.getElementById('sheet').classList.contains('open') }; })()`;
const a = await J(H);
console.log('  ㉮ 이사 직후', JSON.stringify(a));
ok(!a.탈 && a.on && a.tid === 'openBag', '㉮ 이사 직후 손가락 [가방]', JSON.stringify(a));
/* ㉯ 3단 선반 */
await page.eval(`(()=>{ document.getElementById('openBag').click(); return 1; })()`, false); await sleep(1500);
const furn = await J(`[...document.querySelectorAll('#bagGrid [data-furnbag]')].map(b=>({ uid: b.getAttribute('data-furnbag'), t: (b.textContent||'').trim().slice(0,30) }))`);
const pick = (furn.find(f => /선반/.test(f.t)) || furn[0] || {}).uid;
await page.eval(`(()=>{ const b=document.querySelector('#bagGrid [data-furnbag="${pick}"]'); if (b) b.click(); return 1; })()`, false);
await sleep(4000); await dlgOnly(); await bannerOff(); await sleep(1500);
const b = await J(H);
console.log('  ㉯ 선반 놓은 뒤(판 닫힘)', pick, JSON.stringify(b));
ok(!b.탈 && b.on && b.tid === 'openBag' && b.hitIsT && !b.sheetOpen, '㉯ 가방에서 3단 선반을 놓아 판이 닫히면 손가락 [가방](짚는 것의 가운데에서 그것이 잡힘)', JSON.stringify(b));
/* ㉰ 다시 열고 목록을 맨 아래로 굴린 뒤 닫음 */
await page.eval(`(()=>{ document.getElementById('openBag').click(); return 1; })()`, false); await sleep(1500);
const sc = await J(`(()=>{ const body=document.querySelector('#sheet .sheetbody'); if (!body) return { 없음: true }; body.scrollTop = body.scrollHeight; return { top: body.scrollTop, sh: body.scrollHeight, ch: body.clientHeight }; })()`);
await sleep(800);
await J(`(()=>{ window.__byeotSheet.close(); return 1; })()`); await sleep(1500);
const c = [];
for (let k = 0; k < 3; k++) { c.push(await J(H)); await sleep(1200); }
console.log('  ㉰ 굴린 채 닫은 뒤', JSON.stringify({ sc, c }));
if (OUT) await page.shot(`${OUT}/390_c7d_closed.png`);
ok(c.every(x => !x.탈 && x.on && x.tid === 'openBag' && x.hitIsT && !x.inSheet), '㉰ 판 속 목록을 굴린 채 판을 닫으면 손가락은 [가방](판 안 칸 아님 · 세 번 다 · 짚는 것의 가운데에서 그것이 잡힘)', JSON.stringify(c.map(x => [x.tid, x.inSheet, x.hitIsT, x.hit, x.r, x.say])));
/* ㉱ 다시 열면 판 안 칸을 보이게 짚는다 */
await page.eval(`(()=>{ document.getElementById('openBag').click(); return 1; })()`, false); await sleep(1600);
const d = await J(H);
console.log('  ㉱ 다시 연 뒤', JSON.stringify(d));
if (OUT) await page.shot(`${OUT}/390_c7d_reopen.png`);
ok(!d.탈 && d.on && d.cell && d.hitIsT && (d.r[1] + d.r[3]) / 2 > 0 && (d.r[1] + d.r[3]) / 2 < 844, '㉱ 가방을 다시 열면 손가락이 판 안 칸을 보이게 짚는다(그 칸 가운데가 화면 안 · 가운데에서 그 칸이 잡힘)', JSON.stringify(d));
/* ★ 11-03 8C5(총괄 가름) — ㉱ 는 몬스테라 차례(그루 → 삽수 → 이삿짐 순)라 단추 차례가 아니다 ⇒ 사람 손으로 몬스테라 · 삽수를 [누름] → [확인]해 이삿짐 차례에 닿은 뒤
     손가락은 머리줄 [한꺼번에 놓기 (N개)] 단추(N ≥ 2 · 판 안 · 보이게 · 가운데에서 그 단추가 잡힘) */
const steps = [];
for (let k = 0; k < 8; k++) {
  const left = await J(`(()=>({ pot: document.querySelectorAll('#bagGrid [data-potbag]').length, cut: document.querySelectorAll('#bagGrid .bagslot[data-place^="cutting:"]').length }))()`);
  steps.push(left);
  if (left.탈 || (left.pot + left.cut) === 0) break;
  await page.eval(`(()=>{ const c=document.querySelector('#bagGrid [data-potbag], #bagGrid .bagslot[data-place^="cutting:"]'); if (c) c.click(); return 1; })()`, false);
  await sleep(2400);
  await page.eval(`(()=>{ const b=document.getElementById('placeOk'); if (b && b.offsetParent) b.click(); return 1; })()`, false);
  await sleep(2200); await dlgOnly(); await bannerOff();
  await page.eval(`(()=>{ if (!document.getElementById('sheet').classList.contains('open')) document.getElementById('openBag').click(); return 1; })()`, false); await sleep(1600);
}
const boxN = await J(`(()=>{ const b=document.querySelector('#bagGrid [data-act="boxAll"]'); return b ? +(((b.textContent||'').match(/[0-9]+/)||[])[0] || 0) : 0; })()`);
const e = await J(H);
console.log('  ㉳ 이삿짐 차례', JSON.stringify({ steps, boxN, e }));
if (OUT) await page.shot(`${OUT}/390_c7d_boxall.png`);
ok(!e.탈 && boxN >= 2 && e.on && e.act === 'boxAll' && e.inSheet && e.hitIsT && (e.r[1] + e.r[3]) / 2 > 0 && (e.r[1] + e.r[3]) / 2 < 844,
   '㉳ 이삿짐 차례(시루 · 판 둘 이상)엔 손가락이 [한꺼번에 놓기 (N개)] 단추를 보이게 짚는다(단추 가운데가 화면 안 · 가운데에서 그 단추가 잡힘)', JSON.stringify({ boxN, e }));
/* ★ 11-03 8C5 꼬리(총괄 가름 A+B) — 움직임 finish 뒤 손 · 말풍선 · 단추 · 칸 · 머리글 상자(390 → 360) */
const GEO = `(async()=>{ for (const an of document.getAnimations()) { try { an.finish(); } catch (e2) { void e2; } }
  const h=document.getElementById('hint'), hand=h.querySelector('.hand'), say=h.querySelector('.say'), t=document.querySelector('.hintTarget');
  const R = q => q ? [Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)] : null;
  const rg=document.createRange(); rg.selectNodeContents(hand); const g=rg.getBoundingClientRect();
  const tr = t ? t.getBoundingClientRect() : null, sr = say.getBoundingClientRect();
  const gap = (a, c) => { if (!a || !c) return null; const dx = Math.max(0, c.left - a.right, a.left - c.right), dy = Math.max(0, c.top - a.bottom, a.top - c.bottom); return Math.round(Math.hypot(dx, dy)); };
  const hit = (a, c) => a.left < c.right - 0.5 && a.right > c.left + 0.5 && a.top < c.bottom - 0.5 && a.bottom > c.top + 0.5;
  const cells = [...document.querySelectorAll('#pageBag .bagslot')].map(c => c.getBoundingClientRect()).filter(q => q.width > 0);
  const h3 = document.querySelector('#pageBag h3'); let hr = null; if (h3) { const r2 = document.createRange(); r2.selectNodeContents(h3); hr = r2.getBoundingClientRect(); }
  const hb = h.getBoundingClientRect();
  return { act: t ? t.getAttribute('data-act') : null, say: say.textContent, cls: h.className, glyph: R(g), sayR: R(sr), target: R(tr), gap: gap(g, tr),
    cellHits: cells.filter(q => hit(sr, q)).length, cells: cells.length, headHit: !!(hr && hr.width && hit(sr, hr)), head: R(hr),
    inScreen: Math.min(hb.left, sr.left) >= -0.5 && Math.max(hb.right, sr.right) <= innerWidth + 0.5, iw: innerWidth }; })()`;
const geoAt = async () => { try { await J(`(()=>{ window.__byeotHint(); return 1; })()`); } catch (e2) { void e2; } await sleep(1200);
  await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 10, clip: { x: 0, y: 0, width: 10, height: 10, scale: 1 } }); await sleep(300); return J(GEO); };
const g390 = await geoAt();
await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 2, mobile: false }); await sleep(1500);
const g360 = await geoAt();
if (OUT) await page.shot(`${OUT}/360_c7d_boxall.png`);
await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false }); await sleep(800);
console.log('  ㉴~㉷ 손가락 자리', JSON.stringify({ g390, g360 }));
ok(!e.탈 && boxN >= 2 && !g390.탈 && g390.act === 'boxAll' && g390.say === '빛이 맞는 빈 자리에 바로 놓습니다', '㉴ [한꺼번에 놓기 (N개)]를 짚는 말 «빛이 맞는 빈 자리에 바로 놓습니다»(plan §15)', JSON.stringify({ boxN, say: g390.say }));
for (const [w, g] of [[390, g390], [360, g360]]) {
  ok(!g.탈 && g.act === 'boxAll' && g.gap != null && g.gap <= 12, `㉵ ${w} 손(글자 상자) ↔ 단추 거리 ≤ 12px(${g.gap}px)`, JSON.stringify({ glyph: g.glyph, target: g.target, cls: g.cls }));
  ok(!g.탈 && g.cells > 0 && g.cellHits === 0, `㉶ ${w} 말풍선이 가방 칸과 안 겹침(겹친 칸 ${g.cellHits})`, JSON.stringify({ sayR: g.sayR, cls: g.cls }));
  ok(!g.탈 && !g.headHit && g.inScreen, `㉷ ${w} 말풍선이 «가방 · N개» 머리글을 안 덮고 화면 안`, JSON.stringify({ sayR: g.sayR, head: g.head, iw: g.iw }));
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `probe_critic7_d: 빨강 ${bad}` : 'probe_critic7_d: 다 통과');
process.exit(bad ? 1 : 0);
