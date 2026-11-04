/* U2-b 자(총괄 11-04 · plan 8aa170ce 대조) — 확인 바 길 경고는 «새로 막힐 때만»
   투룸 첫날은 놓기 전부터 바깥 문에 못 간다(doorReach ok false · 앞 오른쪽 구석 · U2-c 로 따로 잼) → 무엇을 어디 놓든 «여기 두면 문 앞 길이 막힙니다»가 서면 거짓
   판 T(tworoom_shop_first): 새 종 둘(알로카시아 · 핑크프린세스) · 가방 몬스테라 · 이삿짐 시루 / 판 B(tworoom_care_first): 칼라테아 — 가방 칸 [누름] → 확인 바
   단언(길마다): 놓기 전 문 길이 이미 막힘(판 확인) · 확인 바가 섬 · 경고 줄에 «문 앞 길이 막»이 없다(가를 수 없는 옛 문 말 0)
     ⚠ 정말 새로 막는 칸(원룸 문 앞 바닥)에서 «문 앞 길이 막힙니다»가 서는 것은 probe_critic8_c ㉲ 가 잰다(같은 §reachWarningFor)
   예외 0 · J 단언엔 !탈 · 빨강 먼저: b9736d22(고치기 전) 새 종 · 칼라테아 빨강 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const K = 'C:/Users/pc/byeot-core-keep/critic8';
const SAVE_T = process.env.SAVE || `${K}/tworoom_shop_first.json`, SAVE_B = process.env.SAVE_B || `${K}/tworoom_care_first.json`;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
for (const f of [SAVE_T, SAVE_B]) if (!fs.existsSync(f)) { ok(false, '세이브 없음', f); process.exit(1); }
const exc = [];
let page = null;
const fresh = async () => { if (page) { try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); } }
  page = await launch({ width: 390, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` }); };
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const dlg = async () => { for (let i = 0; i < 160; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); } };
const boot = async (file) => { await fresh();
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(file, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
  await dlg(); await bannerOff(); await sleep(1200); };
const SNAP = `(()=>{ const w=document.getElementById('placeConfirmWarn'), who=document.getElementById('placeConfirmWho'); const pk=window.__picked||{};
  return { confirming: document.getElementById('stage').classList.contains('confirming'), who: who ? (who.textContent||'').trim() : null, slot: pk.slotId || null,
           warn: w && w.style.display !== 'none' ? (w.textContent||'').trim() : null, door: (window.__rv.doorReach ? window.__rv.doorReach() : []).map(d => d && d.ok) }; })()`;
const tryPath = async (sel, tag) => {
  await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1300);
  const tap = await J(`(()=>{ const c=document.querySelector(${JSON.stringify(sel)}); if (!c) return null; c.click(); return c.getAttribute('data-place'); })()`);
  await sleep(2500);
  const s = await J(SNAP);
  console.log(`  ${tag}`, JSON.stringify({ tap, ...s }));
  if (OUT) await page.shot(`${OUT}/390_u2b_${tag}.png`);
  await J(`(()=>{ const b=document.getElementById('placeCancel'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(1500);
  return { tap, ...s }; };
const doorBefore = async () => J(`(()=>({ door: (window.__rv.doorReach ? window.__rv.doorReach() : []).map(d => ({ ok: d && d.ok, gap: d && d.gap })), plants: (window.__rv.plants ? window.__rv.plants() : []).length }))()`);
const NO_DOOR = (w) => !/문 앞 길이 막/.test(String(w || ''));
/* ═══ T ═══ */
await boot(SAVE_T);
const dT = await doorBefore();
console.log('  T 놓기 전', JSON.stringify(dT));
ok(!dT.탈 && dT.door.length > 0 && dT.door.every(d => d.ok === false), 'T 판 — 투룸 가게 첫날 놓기 전부터 바깥 문에 못 감(U2-c 따로)', JSON.stringify(dT));
const spT = await J(`(()=>((window.__S().species||{}).pots||[]).filter(q=>q && !q.slotId && !q.at).map(q=>({ id: q.id, sp: q.species })))()`);
for (const want of ['alocasia_frydek', 'pink_princess']) {
  const q = (spT || []).find(x => x.sp === want);
  if (!q) { ok(false, `T 새 종 ${want} 가 가방에 없음`, JSON.stringify(spT)); continue; }
  const r = await tryPath(`#pageBag .bagslot[data-place="species:${q.id}"]`, `sp_${want}`);
  ok(!r.탈 && typeof r.tap === 'string' && r.confirming === true && NO_DOOR(r.warn), `T 새 종 ${want} [누름] → ${r.who} — 경고에 «문 앞 길이 막» 없음(놓기 전부터 막힘)`, JSON.stringify({ slot: r.slot, warn: r.warn }));
}
{ const pot = await J(`(()=>{ const c=document.querySelector('#pageBag .bagslot[data-place^="pot"]'); return c ? c.getAttribute('data-place') : null; })()`);
  if (pot) { const r = await tryPath(`#pageBag .bagslot[data-place="${pot}"]`, 'pot');
    ok(!r.탈 && r.confirming === true && NO_DOOR(r.warn), `T 가방 몬스테라 [누름] → ${r.who} — 경고에 «문 앞 길이 막» 없음`, JSON.stringify({ tap: r.tap, slot: r.slot, warn: r.warn })); }
  else console.log('  T 가방 몬스테라 칸 없음(적기만)'); }
{ const box = await J(`(()=>{ const c=document.querySelector('#pageBag .bagslot[data-place^="box:"]'); return c ? c.getAttribute('data-place') : null; })()`);
  if (box) { const r = await tryPath(`#pageBag .bagslot[data-place="${box}"]`, 'box');
    if (r.confirming) ok(!r.탈 && NO_DOOR(r.warn), `T 이삿짐 ${box} [누름] → ${r.who} — 경고에 «문 앞 길이 막» 없음`, JSON.stringify({ slot: r.slot, warn: r.warn }));
    else console.log('  T 이삿짐은 확인 바 없이 놓임(적기만)', JSON.stringify(r)); }
  else console.log('  T 이삿짐 칸 없음(적기만)'); }
/* ═══ B — 칼라테아 ═══ */
await boot(SAVE_B);
const dB = await doorBefore();
console.log('  B 놓기 전', JSON.stringify(dB));
const cal = await J(`(()=>(((window.__S().species||{}).pots)||[]).find(q=>q && q.species==='calathea' && !q.slotId && !q.at) || null)()`);
if (!cal || cal.탈) ok(false, 'B 칼라테아가 가방에 없음', JSON.stringify(cal));
else { const r = await tryPath(`#pageBag .bagslot[data-place="species:${cal.id}"]`, 'sp_calathea');
  ok(!r.탈 && r.confirming === true && dB.door.every(d => d.ok === false) && NO_DOOR(r.warn), `B 칼라테아 [누름] → ${r.who} — 경고에 «문 앞 길이 막» 없음(놓기 전부터 막힘)`, JSON.stringify({ slot: r.slot, warn: r.warn, door: dB.door })); }
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `probe_u2b_reach: 빨강 ${bad}` : 'probe_u2b_reach: 다 통과');
process.exit(bad ? 1 : 0);
