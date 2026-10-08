/* tools/probe_walk_trap.mjs — **사람을 한 번도 안 고른 사람도 첫 수확 뒤 손가락이 상점을 짚나** (2026-10-08 · 총괄 튜토 검토 #1)
   ------------------------------------------------------------------
   났던 일: 패널 [심기]로 심은 사람은 걷기를 못 배워, Day 0~13 내내 손가락이 「사람을 눌러 보세요」에 갇혔다 —
            상점 갈래(seedNeed && firstCycleDone)보다 걷기 갈래가 앞이라 씨앗을 못 사고 몬스테라가 영영 안 왔다.
   걸음: 시루는 손가락대로 놓고(가방 칸) · 심기·물·거두기는 «식물 시트 줄 단추»로만 한다(사람을 안 누른다) · [다음 날]만 누른다
   잰다: 첫 수확 «뒤» 손가락이 무엇을 짚고 무슨 말을 하나 — 「사람을 눌러」면 갇힌 것이다
   판: W×H(기본 폰 390×844). ⛔ 값 0. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:9300';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 900000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 240000, 500);
await sleep(3000);
const J = async (e) => JSON.parse(await page.eval(`(()=>{ try { return JSON.stringify((${e})); } catch(e) { return JSON.stringify({ 탈:e.message }); } })()`));
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(80); await m('mouseReleased', x, y, 0); await sleep(700); };
const clearDlg = async () => { for (let i = 0; i < 40; i++) { const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return; await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(150); } };
const hint = () => J(`(()=>{ const h=document.getElementById('hint'); const t=document.querySelector('.hintTarget');
  return { on: !!(h && h.classList.contains('on')), say: h ? ((h.querySelector('.say')||{}).textContent||'').trim() : null, target: t ? (t.id || t.className.split(' ')[0]) : null }; })()`);
const rowAct1 = (act) => J(`(()=>{ try { window.__byeotSheet.open('plants'); } catch(e){}
  const b=[...document.querySelectorAll('button[data-act="${act}"]')].find(x=>!x.disabled); if(!b) return false; b.click(); return true; })()`);
/* 줄 단추는 동작(사람이 걸어가 하는 일)이 끝나야 다음 것이 선다 — 12초까지 다시 본다 */
const rowAct = async (act) => { for (let i = 0; i < 24; i++) { if (await rowAct1(act)) return true; await sleep(500); await clearDlg(); } return false; };
await clearDlg();
/* ⓪ #2 첫날 [다음 날]은 흐리고 작다(막지는 않는다) · #6 시트가 열리면 [다음 날]이 숨는다 */
const n0 = await J(`(()=>{ const n=document.getElementById('next'); const cs=getComputedStyle(n); return { dayzero: n.classList.contains('dayzero'), disabled: n.disabled, opacity: cs.opacity }; })()`);
console.log(`  ${n0.dayzero && !n0.disabled ? 'OK  ' : 'FAIL'} #2 첫날 물 주기 전 [다음 날]이 흐리고 작다(막지는 않는다) → ${JSON.stringify(n0)}`);
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(500);
const n1 = await J(`(()=>{ const n=document.getElementById('next'); return { sheetopen: document.documentElement.classList.contains('sheetopen'), vis: getComputedStyle(n).visibility }; })()`);
await page.eval(`window.__byeotSheet.close()`, false); await sleep(300);
const n2 = await J(`getComputedStyle(document.getElementById('next')).visibility`);
console.log(`  ${(n1.vis === 'hidden' || !n1.sheetopen) && n2 === 'visible' ? 'OK  ' : 'FAIL'} #6 폰에서 시트가 열리면 [다음 날]이 숨고 닫으면 돌아온다 → 열림 ${JSON.stringify(n1)} · 닫음 ${n2}`);
/* ① 시루는 손가락대로 놓는다(가방 칸 → [확인]) — 사람은 안 누른다 */
for (let i = 0; i < 8; i++) {
  const placed = await J(`(()=>{ try { return window.__S().firstPlay.beansprout.pots.some(p=>p && (p.slotId || p.at)); } catch(e) { return false; } })()`);
  const h0 = await hint();
  /* 놓기는 [확인]까지 해야 끝난다 · 손가락이 사람·[다음 날]을 짚으면 안 따른다(이 자의 걸음은 «사람을 안 고른다») */
  if (placed && !/둘까요/.test(h0.say || '')) break;
  if (/사람을 눌러|내 캐릭터를 눌러|걸어가 보세요/.test(h0.say || '') || h0.target === 'next') break;
  const at = await J(`(()=>{ const t=document.querySelector('.hintTarget'); if(!t) return null; const r=t.getBoundingClientRect(); return r.width>0 ? { x:r.left+r.width/2, y:r.top+r.height/2, id:t.id } : null; })()`);
  if (!at) break; await tapAt(at.x, at.y); await clearDlg();
}
console.log('■ 놓은 뒤 손가락 —', JSON.stringify(await hint()));
/* ② 심기·물은 시트 줄 단추로 */
console.log('■ 심기 —', await rowAct('plant')); await sleep(800); await clearDlg();
console.log('■ 물 —', await rowAct('water')); await sleep(800); await clearDlg();
try { await page.eval(`window.__byeotSheet.close()`, false); } catch { }
const walked = await J(`(()=>{ try { return [...JSON.parse(localStorage.getItem('byeot.coach')||'[]')]; } catch(e) { return null; } })()`);
console.log('■ 배운 쪽지(걷기 있나) —', JSON.stringify(walked));
/* ③ [다음 날]만 눌러 익힌 뒤 줄 단추로 거둔다 */
const nextDay = async () => {
  await clearDlg();
  const r = await J(`(()=>{ const p=document.querySelector('.pop.on'); const b=p ? [...p.querySelectorAll('button.go')].find(x=>!x.disabled) : null; const n=b||document.getElementById('next'); if(!n||n.disabled) return null; const q=n.getBoundingClientRect(); return { x:q.left+q.width/2, y:q.top+q.height/2 }; })()`);
  if (r) await tapAt(r.x, r.y);
  await sleep(1500); await clearDlg();
  const r2 = await J(`(()=>{ const p=document.querySelector('.pop.on'); const b=p ? [...p.querySelectorAll('button.go,button.primary')].find(x=>!x.disabled) : null; if(!b) return null; const q=b.getBoundingClientRect(); return { x:q.left+q.width/2, y:q.top+q.height/2 }; })()`);
  if (r2) { await tapAt(r2.x, r2.y); await sleep(1200); await clearDlg(); }
};
let harvested = false;
for (let d = 0; d < 9 && !harvested; d++) {
  await nextDay();
  if (await rowAct1('harvest')) { await sleep(900); await clearDlg(); harvested = await J(`(window.__S().firstPlay.beansprout.harvestCount||0) >= 1`); }
  try { await page.eval(`window.__byeotSheet.close()`, false); } catch { }
}
await sleep(1200); await clearDlg();
/* 거두기는 사람이 걸어가 하는 일이라 누른 뒤 늦게 선다 — 끝에 다시 읽는다 */
harvested = await J(`(window.__S().firstPlay.beansprout.harvestCount||0) >= 1`);
const after = await hint();
const day = await J(`window.__S().day`);
console.log('■ 첫 수확 —', harvested, '· 날', day, '· 손가락 —', JSON.stringify(after));
const trapped = /사람을 눌러|내 캐릭터를 눌러|걸어가 보세요/.test(after.say || '');
console.log(`  ${!trapped && harvested ? 'OK  ' : 'FAIL'} 첫 수확 뒤 손가락이 «사람»에 갇히지 않는다 → ${JSON.stringify(after)}`);
/* M1(D19) — 씨앗 0 이면 방 알약이 «🛒 콩 씨앗 주문 · N원» 지름길 · 누르면 주문 창 */
const pill = await J(`(()=>{ const b=document.getElementById('resow'); return b ? { 글:(b.textContent||'').trim(), 보임: getComputedStyle(b).display!=='none', 막힘: b.disabled, buy: b.dataset.buy||null } : null; })()`);
console.log(`  ${pill && /🛒 콩 씨앗 주문/.test(pill.글) && !pill.막힘 ? 'OK  ' : 'FAIL'} M1 씨앗 0 이면 방 알약이 주문 지름길 → ${JSON.stringify(pill)}`);
if (pill && pill.buy) { await page.eval(`document.getElementById('resow').click()`, false); await sleep(800);
  const bp = await J(`(()=>{ const p=document.getElementById('buyPanel')||document.querySelector('.pop.on'); return { on: !!(p && p.classList.contains('on')), id: p && p.id, err: !!document.querySelector('.err:not(:empty), #errBox.on') }; })()`);
  console.log(`  ${bp.on ? 'OK  ' : 'FAIL'} M1 누르면 주문 창이 뜬다(빨간 오류 없이) → ${JSON.stringify(bp)}`); }
const shopish = /씨앗|상점|주문/.test(after.say || '') || /Shop|shop/.test(after.target || '');
console.log(`  ${shopish ? 'OK  ' : 'INFO'} 첫 수확 뒤 손가락이 씨앗·상점 쪽을 말한다 → 「${after.say}」 · ${after.target}`);
await page.close(); clearTimeout(wd);
process.exit(!trapped && harvested ? 0 : 1);
