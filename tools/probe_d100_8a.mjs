/* 총괄 D100 #8 ㉠ 자(core 11-01 · 비판 다섯째 판 Day 11 d11_003) — 390×844 · 새 판
   판: 처음부터 — 시루 하나 놓고(probe_cutting_ui 와 같은 손 · 씨앗 재고 손질) [식물] 판 줄 단추로 심기 · 물 · 거두기를 날마다 → 세 번째 수확(몬스테라 도착 · 가방)
   그날(두 바퀴는 배웠고 몬스테라는 아직 가방 — 손가락이 «돌봄»은 안 짚는 때) 거둔 시루를 다시 심는다(줄 단추)
   ㉮ 다시 심은 직후 손가락이 «심기의 짝» 물을 짚는다(«물을 주면 자라기 시작합니다») — «가방에 몬스테라»로 먼저 넘어가지 않는다
   예외 0 */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await page.waitFor('window.__byeotBooted === true', 150000, 300);
await sleep(5000);
const click = (id) => page.eval(`(()=>{ const e=document.getElementById('${id}'); if (e) e.click(); return 1; })()`, false);
const skipTalk = async () => { for (let i = 0; i < 30; i++) { const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`); if (!t) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if (b) b.click(); return 1; })()`, false); await sleep(220); } };
await click('dlgSkip'); await sleep(800); await click('guideClose'); await sleep(500); await skipTalk();
await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src, {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); return 1; })()`, false);
await sleep(1500); await skipTalk();
await page.eval(`(()=>{ const ok=document.getElementById('placeOk'); if (ok && ok.offsetParent) ok.click(); const S=window.__S(); S.shop.stock.bean_seed = 9; return 1; })()`, false);
await sleep(1000); await skipTalk();
const waitAct = async () => { for (let i = 0; i < 60; i++) { let a = false; try { a = await page.eval(`(()=>{ try { return !!window.__byeotWalkSfx().acting; } catch (e) { return false; } })()`); } catch (e) { a = false; } if (!a && i > 2) return; await sleep(200); } };
const rowAct = async (act) => {
  let n = 0;
  for (let k = 0; k < 6; k++) {
    const hit = await page.eval(`(()=>{ window.__byeotSheet.open('plants'); const b=[...document.querySelectorAll('#siruList button[data-act="${act}"]')].find(x=>!x.disabled); if(!b) return false; b.click(); return true; })()`);
    if (!hit) break;
    n++; await waitAct(); await sleep(300); await skipTalk();
  }
  return n;
};
const st = () => page.eval(`(()=>{ const S=window.__S(); const b=S.firstPlay.beansprout; return { day: S.day, pots: (S.pots||[]).length, harvestCount: b.harvestCount || 0, bagPot: (S.pots||[]).some(p=>p && !p.slotId && !p.at) }; })()`);
let arrivedDay = null;
for (let i = 0; i < 40; i++) {
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) { S.stamina.usedToday=0; S.stamina.left = S.stamina.max; } return 1; })()`, false);
  await rowAct('plant'); await rowAct('water'); await rowAct('harvest');
  const s = await st();
  if (s.pots > 0) { arrivedDay = s.day; break; }
  await rowAct('sow');
  await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(300);
  await click('next'); await sleep(900); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false); await sleep(900); await skipTalk();
}
const s1 = await st();
console.log('  몬스테라 온 날', arrivedDay, JSON.stringify(s1));
ok(arrivedDay != null && s1.bagPot && s1.harvestCount >= 2, '판 — 두 바퀴 넘게 거뒀고 몬스테라가 가방에 왔다', JSON.stringify(s1));
/* 그날 거둔 시루를 다시 심는다(줄 단추) → 판을 닫고 손가락을 본다 */
await page.eval(`(()=>{const S=window.__S(); if(S.stamina) { S.stamina.usedToday=0; S.stamina.left = S.stamina.max; } return 1; })()`, false);
const sown = await rowAct('sow') + await rowAct('plant');
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false);
await sleep(1500); await skipTalk();
/* 그날 뜬 창(한 달 가계부 등)은 사람이 닫는다 — 손가락이 창 단추를 짚는 것은 이 자의 몫이 아니다 */
for (let k = 0; k < 4; k++) { await page.eval(`(()=>{ for (const id of ['monthGo','mealGo','evCardA']) { const g=document.getElementById(id); if (g && g.offsetParent) g.click(); } return 1; })()`, false); await sleep(700); await skipTalk(); }
await sleep(1200);
const hint = [];
for (let i = 0; i < 10; i++) {
  const h = await page.eval(`(()=>{ const h=document.getElementById('hint'); const t=document.querySelector('.hintTarget'); const S=window.__S(); const L=(S.firstPlay.beansprout.pots||[]);
    return JSON.stringify({ say: h && h.classList.contains('on') ? (h.textContent||'').replace(/\\s+/g,' ').slice(0,60) : '', target: t ? (t.id || t.getAttribute('aria-label') || t.className) : null, needsWater: L.filter(p=>p && p.sown && p.startedOnDay == null && !p.harvested).length }); })()`);
  hint.push(h); await sleep(400);
}
const last = JSON.parse(hint[hint.length - 1]);
console.log('  다시 심은 뒤', sown, [...new Set(hint)].join(' | '));
if (OUT) await page.shot(`${OUT}/390_d100_8a.png`);
ok(last.needsWater > 0, '판 — 다시 심어 물을 기다리는 시루가 있다', JSON.stringify(last));
ok(/물을 주면 자라기 시작합니다/.test(last.say) && !/가방에 몬스테라/.test(last.say), '㉮ #8 다시 심은 직후 손가락이 물을 짚는다(«가방에 몬스테라»로 먼저 안 넘어감)', JSON.stringify(last));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_d100_8a: 빨강 ${bad}` : 'probe_d100_8a: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
