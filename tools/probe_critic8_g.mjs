/* 비판 8판 갈림 B(㉲) 자(core 11-03 · 총괄 가름 · plan §16 f633091f) — 짐 풀기 이삿짐 칸 말풍선 글 ↔ 눌러 선 자리
   ⛔ 투룸(moveIntoOwnedHome)에서도 가방에 빈 시루 · 판 · 화분 · 삽수가 남아 있으면 짐 풀기 갈래가 이삿짐까지 이어진다(§unpackPassedBoxesOnly).
      그때 손가락이 이삿짐 칸을 «들고 온 채소를 가구 위에 올리세요»로 짚는데, 누르면 §provisionalSpot ① 바닥 구석(onUid 없음)에 선다 — 투룸은 바닥을 받는다.
      글과 선 자리가 어긋났다(core 11-03 잼 · c7/band4 spare_390_tworoom_shop_first_one_bar).
   ⇒ plan §16: 원룸이 아니면(§provisionalSpot floorOk 와 같은 문) «들고 온 채소를 놓으세요»(같은 갈래 문 말 doorSay 와 같은 글) · 원룸은 그대로
   판(세이브를 고친 판 — critic8_e ㉱ 와 같은 꼴 · 총괄 11-03 받음 · 프로필 안 건드림) · 앞 차례(삽수 · 몬스테라)는 손가락대로 사람 손으로 먼저 놓는다
     T 투룸 가게 첫날(C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json) + 가방 빈 시루 하나 + 이삿짐 하나(다른 이삿짐은 뺌)
     O 원룸 S Day 97(C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json) + 가방 빈 시루 하나 + 놓인 콩나물 시루 하나를 이삿짐으로
   단언(390)
     ㉮ T 이삿짐 차례 — 손가락이 그 이삿짐 칸(data-boxpot)을 짚고 말풍선이 «들고 온 채소를 놓으세요»(plan §16) · 390 · 360 한 줄
     ㉯ T 그 칸을 누르면 확인 바 «여기에 둘까요?» · 빛 낱말 줄이 «안 맞음»이 아님(그 작물 띠 안)
     ㉰ T 말풍선 글 ↔ 선 자리 — 글에 «가구 위»가 있으면 [확인] 뒤 선 자리가 가구 위(이름 자리 · 가구 윗면 onUid)다 · 바닥에 서면 글에 «가구 위»가 없다
     ㉱ O 원룸은 그대로 — 말풍선 «들고 온 채소를 가구 위에 올리세요» · [확인] 뒤 선 자리가 가구 위(글 ↔ 선 자리 같은 자)
     예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_T = process.env.SAVE || 'C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json';
const SAVE_O = process.env.SAVE_S || 'C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
for (const f of [SAVE_T, SAVE_O]) if (!fs.existsSync(f)) { ok(false, '세이브 없음', f); process.exit(1); }
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
const LOOK = `(()=>{ const h=document.getElementById('hint'); const t=document.querySelector('.hintTarget'); const s=h.querySelector('.say');
  let lines = null; if (h.classList.contains('on') && s && s.textContent) { const rg=document.createRange(); rg.selectNodeContents(s); lines = new Set([...rg.getClientRects()].filter(q=>q.width>0).map(q=>Math.round(q.top))).size; }
  return { on: h.classList.contains('on'), say: h.classList.contains('on') ? ((s||{}).textContent||null) : null, lines,
    target: t ? (t.getAttribute('data-act') || (t.dataset && t.dataset.boxpot ? 'boxpot:' + t.dataset.boxpot : (t.id || String(t.className).slice(0, 40)))) : null,
    room: (window.__S().home||{}).room || null }; })()`;
const boxed = p => p.moveBox && !p.slotId && !p.at;
const spareOf = (keep) => ({ ...JSON.parse(JSON.stringify(keep)), id: 'crop_01_spare', slotId: null, at: null, moveBox: false, sown: false, harvested: false, ageDays: 0, startedOnDay: null, idleSinceDay: null });

/* 한 판 — 세이브를 싣고 · 앞 차례를 손가락대로 놓고 · 이삿짐 칸 손가락 · 누름 · [확인] · 선 자리 */
const walk = async (tag, w, keepId) => {
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(JSON.stringify(w))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
  await dlg(); await bannerOff(); await sleep(1200);
  const trail = []; let lk = null;
  for (let k = 0; k < 14; k++) {
    await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1300); await settle(); await sleep(700);
    lk = await J(LOOK); trail.push([lk.target, lk.say]);
    if (lk.탈 || !lk.target || /^boxpot:/.test(lk.target) || lk.target === 'boxAll') break;
    const r = await J(`(()=>{ const t=document.querySelector('.hintTarget'); if (!t) return null; const c = t.closest('.bagslot[data-place]') || t; c.click(); return c.getAttribute('data-place') || c.id || null; })()`);
    await sleep(1500); await settle();
    await J(`(()=>{ const b=document.getElementById('placeOk'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(1200); await dlg(); await bannerOff(); await sleep(600);
    trail.push(['눌렀다', r && r.탈 ? 'tal' : r]);
  }
  console.log(`  ${tag} 앞 차례`, JSON.stringify(trail));
  if (OUT) await page.shot(`${OUT}/390_c8g_${tag}_box.png`);
  /* 360 한 줄 */
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 2, mobile: false }); await sleep(1500);
  try { await J(`(()=>{ window.__byeotHint(); return 1; })()`); } catch (e) { void e; } await sleep(900); await settle();
  const lk360 = await J(LOOK);
  if (OUT) await page.shot(`${OUT}/360_c8g_${tag}_box.png`);
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false }); await sleep(1500);
  try { await J(`(()=>{ window.__byeotHint(); return 1; })()`); } catch (e) { void e; } await sleep(900); await settle();
  const tap = await J(`(()=>{ const c=document.querySelector('#pageBag .bagslot[data-boxpot="${keepId}"]'); if (!c) return null; c.click(); return c.dataset.boxpot; })()`);
  await sleep(1500); await settle();
  const bar = await J(`(()=>{ const ok=document.getElementById('placeOk'); const box = ok ? ok.parentElement && ok.parentElement.parentElement : null;
    return { shown: !!(ok && ok.offsetParent), text: box ? (box.innerText||'').replace(/\\s+/g,' ').trim().slice(0, 200) : null }; })()`);
  if (OUT) await page.shot(`${OUT}/390_c8g_${tag}_bar.png`);
  await J(`(()=>{ const b=document.getElementById('placeOk'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(1500); await dlg(); await bannerOff();
  const at = await J(`(()=>{ const all=window.__S().firstPlay.beansprout.pots; const p=all.find(q=>q.id==='${keepId}'); if (!p) return null;
    return { slot: p.slotId || null, at: p.at ? { y: +(+p.at.y).toFixed(3), onUid: p.at.onUid ?? null } : null, box: !!p.moveBox }; })()`);
  if (OUT) await page.shot(`${OUT}/390_c8g_${tag}_placed.png`);
  const named = !!(at && !at.탈 && at.slot && !String(at.slot).startsWith('free:'));
  const onFurn = named || !!(at && !at.탈 && at.at && at.at.onUid);
  console.log(`  ${tag} 이삿짐 칸`, JSON.stringify({ lk, lk360, tap, bar, at, onFurn }));
  return { lk, lk360, tap, bar, at, onFurn };
};

/* ═══ T 투룸 ═══ */
{ const w = JSON.parse(fs.readFileSync(SAVE_T, 'utf8')); const fp = w.state.firstPlay;
  const sites = [fp.beansprout, ...Object.values(fp.crops || {})].filter(s => s && Array.isArray(s.pots));
  const keep = fp.beansprout.pots.find(boxed);
  if (!keep) { ok(false, '판 T — 세이브에 콩나물 이삿짐 없음'); process.exit(1); }
  for (const s of sites) s.pots = s.pots.filter(p => !boxed(p) || p.id === keep.id);
  fp.beansprout.pots.push(spareOf(keep));
  const T = await walk('tworoom', w, keep.id);
  const want = '들고 온 채소를 놓으세요';
  ok(!T.lk.탈 && !T.lk360.탈 && T.lk.room === 'tworoom' && T.lk.on && T.lk.target === `boxpot:${keep.id}` && T.lk.say === want && T.lk.lines === 1 && T.lk360.say === want && T.lk360.lines === 1,
     `㉮ 투룸 이삿짐 칸 손가락 «${want}»(plan §16) · 390 · 360 한 줄`, JSON.stringify({ l390: T.lk, l360: T.lk360 }));
  ok(!T.bar.탈 && T.tap === keep.id && T.bar.shown && /여기에 둘까요\?/.test(T.bar.text || '') && /— 콩나물에/.test(T.bar.text || '') && !/안 맞음/.test(T.bar.text || ''),
     '㉯ 투룸 그 칸을 누르면 확인 바 «여기에 둘까요?» · 빛 낱말 줄이 «안 맞음» 아님(그 작물 띠 안)', JSON.stringify(T.bar));
  const saysFurn = /가구 위/.test(T.lk.say || '');
  ok(!!T.at && !T.at.탈 && (!!T.at.slot || !!T.at.at) && (saysFurn ? T.onFurn : true),
     `㉰ 투룸 말풍선 글 ↔ 선 자리 — «${T.lk.say}» · 선 자리 ${T.onFurn ? '가구 위' : '바닥'}(글에 «가구 위»가 있으면 가구 위여야 함)`, JSON.stringify({ at: T.at, say: T.lk.say }));
}
/* ═══ O 원룸 ═══ */
{ const w = JSON.parse(fs.readFileSync(SAVE_O, 'utf8')); const st = w.state; const fp = st.firstPlay; const day = st.day;
  const keep = fp.beansprout.pots.find(p => (p.slotId || p.at) && !p.harvested) || fp.beansprout.pots[0];
  Object.assign(keep, { slotId: null, at: null, moveBox: true, sown: true, harvested: false, ageDays: 1, startedOnDay: day - 1, idleSinceDay: day - 1 });
  fp.beansprout.pots.push(spareOf(keep));
  const O = await walk('oneroom', w, keep.id);
  const want = '들고 온 채소를 가구 위에 올리세요';
  ok(!O.lk.탈 && !!O.at && !O.at.탈 && O.lk.room === 'oneroom' && O.lk.on && O.lk.target === `boxpot:${keep.id}` && O.lk.say === want && O.onFurn,
     `㉱ 원룸은 그대로 — 이삿짐 칸 손가락 «${want}» · [확인] 뒤 가구 위`, JSON.stringify({ lk: O.lk, at: O.at, bar: O.bar }));
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `probe_critic8_g: 빨강 ${bad}` : 'probe_critic8_g: 다 통과');
process.exit(bad ? 1 : 0);
