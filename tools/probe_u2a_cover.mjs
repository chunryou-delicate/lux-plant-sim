/* U2-a 자(총괄 11-04 · 새 종 덩이 8aa170ce 가 새로 만든 가림) — 확인 바(#placeConfirm)가 «자기» 배너를 덮지 않고, 남의 배너는 숨기지 않는다
   판: 투룸 가게 첫날 세이브(tworoom_shop_first · Day 445) — 가방 새 종(알로카시아) [누름] → 확인 바 «진열대 N번 칸에 둘까요?» + 문 앞 길 경고 줄 · 배너 «여기에 둘까요?»
   단언
     ㉮ 390 · 360 — 확인 바가 섰고 배너가 켜져 있을 때, «보이는» 배너 칸(#event > b · visibility 가 hidden 아님)과 확인 바 사각형 겹침 px² = 0
     ㉰ 390 — 바가 선 동안 남의 배너(게임 손잡이 __byeotBannerTest · 제목 «🌿 시험 배너»)가 서면 그 칸은 보인다(.underConfirm 아님 · visibility 보임)
        (총괄 조건 — 바가 떠 있는 동안 다른 손 · 할 일 배너가 #event 에 설 수 있다(critic8_i ㉹ 꼴) · 숨긴 채 시간이 가면 못 본 채 지나감)
     ㉯ [취소]로 확인 바가 닫히면 배너 숨김 표지(.underConfirm)가 어느 칸에도 안 남는다
     예외 0 · J 단언엔 !탈
   사진: 390 · 360 바 선 때(u2a_cover) · ㉰ 남의 배너(390_u2a_other) · [취소] 뒤(390 · 360 u2a_cancel)
   빨강 먼저: ㉮ 는 8aa170ce(고치기 전) · ㉰ 는 #event 통째 숨김 판(c6/p81 · fm105) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_T = process.env.SAVE || 'C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_T)) { ok(false, '세이브 없음', SAVE_T); process.exit(1); }
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const dlg = async () => { for (let i = 0; i < 160; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); } };
const settle = async () => { await J(`(()=>{ for (const a of document.getAnimations()) { try { a.finish(); } catch (e) { void e; } } return 1; })()`);
  await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 10, clip: { x: 0, y: 0, width: 10, height: 10, scale: 1 } }); await sleep(300); };
const W = async (w) => { await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: w === 360 ? 780 : 844, deviceScaleFactor: 2, mobile: false }); await sleep(1300); await settle(); };
await W(390);
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE_T, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
await dlg(); await bannerOff(); await sleep(1200);
/* 새 종 하나 [누름] — critic8_i ㉮ 와 같은 손(가방 열고 칸 누름) */
const sp0 = await J(`(()=>((window.__S().species||{}).pots||[]).filter(q=>q && !q.slotId && !q.at).map(q=>({ id: q.id, sp: q.species })))()`);
const A = (Array.isArray(sp0) && (sp0.find(q => q.sp === 'alocasia_frydek') || sp0[0])) || null;
let tap = null;
if (A) {
  await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1300); await settle();
  tap = await J(`(()=>{ const c=document.querySelector('#pageBag .bagslot[data-place="species:${A.id}"]'); if (!c) return null; c.click(); return c.getAttribute('data-place'); })()`);
  await sleep(1800); await settle();
}
/* 배너 칸마다: 제목 · 보임 · 바와 겹침 px² */
const M = `(()=>{ const ev=document.getElementById('event'), pc=document.getElementById('placeConfirm'); const a=pc.getBoundingClientRect(); const r=q=>[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)];
  const evCs=getComputedStyle(ev); const evShown = ev.classList.contains('on') && evCs.visibility !== 'hidden' && +evCs.opacity > 0.05;
  const items=[...ev.querySelectorAll(':scope > b')].map(b=>{ const q=b.getBoundingClientRect(); const cs=getComputedStyle(b); const ov=Math.max(0,Math.min(a.right,q.right)-Math.max(a.left,q.left))*Math.max(0,Math.min(a.bottom,q.bottom)-Math.max(a.top,q.top));
    const t=(b.firstChild && b.firstChild.nodeType===3) ? b.firstChild.textContent.trim() : (b.textContent||'').trim().slice(0,20);
    const vis = evShown && cs.visibility !== 'hidden';
    return { t, vis, under: b.classList.contains('underConfirm'), box: r(q), ov: Math.round(ov) }; });
  const w=document.getElementById('placeConfirmWarn');
  return { W: innerWidth, confirming: document.getElementById('stage').classList.contains('confirming'), evOn: ev.classList.contains('on'), pc: r(a), items,
           overlapVisible: items.filter(x=>x.vis).reduce((s,x)=>s+x.ov,0), anyUnder: !!ev.querySelector('.underConfirm') || ev.classList.contains('underConfirm'),
           warn: w && w.style.display !== 'none' ? (w.textContent||'').slice(0,40) : null }; })()`;
const m390 = await J(M);
if (OUT) await page.shot(`${OUT}/390_u2a_cover.png`);
await W(360); await sleep(600);
const m360 = await J(M);
if (OUT) await page.shot(`${OUT}/360_u2a_cover.png`);
console.log('  ㉮ 390', JSON.stringify(m390));
console.log('  ㉮ 360', JSON.stringify(m360));
for (const m of [m390, m360])
  ok(!!A && typeof tap === 'string' && !m.탈 && m.confirming === true && m.evOn === true && m.overlapVisible === 0,
     `㉮ ${m.W} — 확인 바가 섰을 때 보이는 배너 칸과 겹침 px² = 0(칸 ${(m.items || []).map(x => `${x.t}${x.vis ? '' : '(숨김)'} ${x.ov}`).join(' · ')})`, JSON.stringify({ tap, pc: m.pc, warn: m.warn }));
/* ㉰ 바가 선 동안 남의 배너 */
await W(390); await sleep(600);
await J(`(()=>{ window.__byeotBannerTest([{ title: '🌿 시험 배너', sub: '바가 선 동안 선 남의 배너' }]); return 1; })()`); await sleep(900);
const mO = await J(M);
if (OUT) await page.shot(`${OUT}/390_u2a_other.png`);
console.log('  ㉰ 남의 배너', JSON.stringify(mO));
const other = (mO.items || []).find(x => /시험 배너/.test(x.t));
ok(!mO.탈 && mO.confirming === true && !!other && other.vis === true && other.under === false,
   '㉰ 바가 선 동안 남의 배너(«🌿 시험 배너»)는 보인다(숨김 표지 없음)', JSON.stringify({ other, items: mO.items }));
/* ㉯ [취소] → 바 닫힘 → 숨김 표지 없음 */
await J(`(()=>{ const b=document.getElementById('placeCancel'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(1200);
const after = await J(`(()=>({ confirming: document.getElementById('stage').classList.contains('confirming'), under: !!document.querySelector('#event .underConfirm') || document.getElementById('event').classList.contains('underConfirm') }))()`);
if (OUT) await page.shot(`${OUT}/390_u2a_cancel.png`);
await W(360); if (OUT) await page.shot(`${OUT}/360_u2a_cancel.png`); await W(390);
console.log('  ㉯ [취소] 뒤', JSON.stringify(after));
ok(!after.탈 && after.confirming === false && after.under === false, '㉯ [취소]로 확인 바가 닫히면 배너 숨김 표지(.underConfirm)가 안 남는다', JSON.stringify(after));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `probe_u2a_cover: 빨강 ${bad}` : 'probe_u2a_cover: 다 통과');
process.exit(bad ? 1 : 0);
