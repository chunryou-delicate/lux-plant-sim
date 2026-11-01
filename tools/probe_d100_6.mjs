/* 총괄 D100 #6 ㉡ 자(core 11-01 · 비판 다섯째 판 ⑤ #6 d45_lamptap2_zoom «등 막대를 눌러도 아무 반응 없음») — 390×844
   판: 총괄 humanQ g premove(반지하 Day 134 · 등을 단 판)
   손: 방에 선 등(lightRigs)마다 그 몸 둘레 몇 점을 화면에서 진짜로 누른다 → 무엇이 골라지나(등 메뉴 · 화분 상세 · 가구 · 아무것도)
   ㉮ 등을 누르면 등 메뉴(#furnActions · 이름 «…식물등» · [켜기/끄기])가 선다 — 점마다 세어 적는다
   ㉯ 못 옮기는 등이면 까닭 한 줄(#furnWhy)이 보이고, «가구를 골랐습니다 — [옮기기]…» 쪽지는 안 선다(총괄 11-01 사진)
   ⚠ 아무것도 지우지 않는다 · 재기만 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
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
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (!t) return; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
await dlgOnly();
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1500);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(60); await m('mouseReleased', x, y, 0); };
/* 단 등만 — 방 자료의 식물등 셋(벽부형 → 집게형 → 거치형 · §bagLamp 차례) 가운데 단 수(tutorial.lamp.placed)만큼 · 안 단 등은 방에 없다(그 자리를 누르면 그 밑 것이 골라지는 것이 맞다) */
const rigs = await J(`(()=>{ const rv=window.__rv; const c=document.getElementById('roomCanvas').getBoundingClientRect(); const n=((window.__S().tutorial||{}).lamp||{}).placed||0; return (rv.lightRigs()||[]).filter(r=>r.grow).slice(0, n).map(r=>{ const s=rv.worldToScreen(r.pos.x, r.pos.y, r.pos.z); return { uid: r.uid, pos: r.pos, sx: s ? c.left + s.x : null, sy: s ? c.top + s.y : null }; }); })()`);
console.log('  등', JSON.stringify(rigs));
ok(rigs.length > 0, '판 — 단 식물등이 있다', JSON.stringify(rigs.map(r => r.uid)));
const what = () => J(`(()=>{ const fa=document.getElementById('furnActions'); const faOn = !!(fa && fa.offsetParent !== null && getComputedStyle(fa).display !== 'none' && document.getElementById('stage').classList.contains('furnpicked'));
  const det=document.getElementById('detail'); const detOn = !!(det && det.classList.contains('on'));
  return { furn: faOn ? (document.getElementById('furnName')||{}).textContent : null, lampBtn: faOn ? (()=>{ const b=document.getElementById('furnLamp'); return b && b.style.display !== 'none' ? b.textContent : null; })() : null,
           why: faOn ? (()=>{ const w=document.getElementById('furnWhy'); return w && w.style.display !== 'none' ? w.textContent : null; })() : null, detail: detOn, picked: document.getElementById('stage').classList.contains('picked'),
           coach: (()=>{ const c=document.getElementById('coach'); return c && c.classList.contains('on') ? ((document.getElementById('coachTitle')||{}).textContent || '') : null; })() }; })()`);
/* ★ 11-01 — 비우기 누름은 «방 캔버스가 잡히는 빈 점»에(예전 (195,150) 고정점이 할 일 칩에 맞으면 [할 일] 시트가 열려 방을 덮었다 — 회귀 한 번 0/5) */
const emptyPt = () => J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } const c=document.getElementById('roomCanvas').getBoundingClientRect(); const rigs=${JSON.stringify(rigs.map(r => [r.sx, r.sy]))};
  for (let y = c.top + 40; y < c.bottom - 140; y += 23) for (let x = c.left + 120; x < c.right - 20; x += 29) { const e=document.elementFromPoint(x, y); if (e && e.id === 'roomCanvas' && rigs.every(q => q[0] == null || Math.hypot(q[0]-x, q[1]-y) > 70)) return { x, y }; }
  return null; })()`);
const clear = async () => { await page.eval(`(()=>{ try { const c=document.getElementById('furnClose'); if (c && c.offsetParent) c.click(); } catch (e) { void e; } try { const d=document.getElementById('dClose'); if (d && d.offsetParent) d.click(); } catch (e) { void e; } return 1; })()`, false);
  const p = await emptyPt(); if (p && !p.탈) await tapAt(p.x, p.y); await sleep(700); };
const results = [];
for (const r of rigs) {
  if (r.sx == null) continue;
  for (const [dx, dy] of [[0, 0], [-12, 0], [12, 0], [0, -6], [0, 6]]) {
    await clear();
    await tapAt(r.sx + dx, r.sy + dy); await sleep(900);
    const w = await what();
    results.push({ uid: r.uid, dx, dy, ...w });
  }
}
console.log('  누른 점마다', JSON.stringify(results));
if (OUT) { await clear(); if (rigs[0] && rigs[0].sx != null) { await tapAt(rigs[0].sx, rigs[0].sy); await sleep(900); } await page.shot(`${OUT}/390_d100_6_tap.png`); }
for (const r of rigs) {
  const mine = results.filter(x => x.uid === r.uid);
  const hit = mine.filter(x => x.furn && /식물등/.test(x.furn));
  ok(hit.length >= Math.ceil(mine.length / 2), `㉮ ${r.uid} — 등을 누르면 등 메뉴(절반 넘는 점)`, `${hit.length}/${mine.length} · ${JSON.stringify(mine.map(x => x.furn || (x.detail ? '화분 상세' : x.picked ? '화분 고름' : '없음')))}`);
  const withBtn = hit.find(x => x.lampBtn);
  ok(!hit.length || !!withBtn, `㉮ ${r.uid} — 등 메뉴에 [켜기/끄기]`, JSON.stringify(withBtn || hit[0] || null));
  /* ★ 11-01 총괄 사진 MINOR ① — 붙박이 등(«붙박이 등이라 자리를 못 옮깁니다»)을 골랐을 때 «가구를 골랐습니다 — [옮기기]…» 쪽지가 안 선다 */
  const fixed = hit.filter(x => /붙박이/.test(x.why || ''));
  ok(!fixed.length || fixed.every(x => !/가구를 골랐습니다/.test(x.coach || '')), `㉯ ${r.uid} — 붙박이 등을 고르면 «가구를 골랐습니다» 쪽지가 안 선다`, JSON.stringify(fixed.map(x => x.coach)));
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_d100_6: 빨강 ${bad}` : 'probe_d100_6: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
