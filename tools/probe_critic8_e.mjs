/* 비판 8판 8C4 (다) 자(core 11-03 · 총괄 가름) — 이삿짐 시루 · 판 «한꺼번에 놓기»: 누르는 횟수만 줄이고 놓이는 자리는 하나씩 놓을 때와 같다
   ⛔ 비판 8판 Q4(A_d446_000): 가게 · 돌봄 · 육종 모두 진로 첫날 이삿짐 시루 16 · 무순 판 5 를 하나씩 다시 놓아야 [다음 날]
   판: 투룸 가게 첫날 세이브(C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json · 프로필 안 건드림)
   단언(390)
     ㉮ 가방 이삿짐 머리줄에 [한꺼번에 놓기 (N개)] · N = 이삿짐 시루 + 판
     ㉯ 그 단추 한 번 — 이삿짐이 다 놓임(남은 것 0 · 그렇지 않으면 하나씩 놓은 판과 같은 수가 남음)
     ㉰ 놓인 자리가 하나씩 [누름] → [확인] 으로 놓은 판과 개체마다 같음(자리 이름 · 좌표 1mm 안)
     ㉱ §11(plan a8f0d8bf ㉠) — 원룸(바닥 금지 · 비판 6판 S Day 97 세이브)에서 이삿짐이 맞는 자리보다 많으면(작물을 다 이삿짐으로 · 시루 9개 덧붙임):
        배너 «📦 이삿짐 N개를 놓았습니다» / «남은 M개는 맞는 자리가 없습니다 — {할 말}» · 기록 «… · M개 남음» · 가방 칸 ×M
     ㉲ 360 — 그 아래 줄이 두 줄 안 · 세 갈래({할 말} 띠 밖 · 원룸 다 참 · 그 밖 다 참) × 남은 수 2 · 12 도 두 줄 안(plan c7c2e2e0 · 배너 손잡이 §__byeotBannerTest 로 같은 배너 그림)
     예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json';
const SAVE_S = process.env.SAVE_S || 'C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE)) { ok(false, '세이브 없음', SAVE); process.exit(1); }
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
const boot = async () => {
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
  await dlg(); await bannerOff(); await sleep(1200);
};
const SNAP = `(()=>{ const fp=window.__S().firstPlay; const all=[...((fp.beansprout||{}).pots||[]), ...Object.values(fp.crops||{}).flatMap(v=>(v&&v.pots)||[])];
  const out={}; for (const p of all) out[p.id] = { slot: p.slotId || null, at: p.at ? [+(+p.at.x).toFixed(3), +(+p.at.y).toFixed(3), +(+p.at.z).toFixed(3)] : null, box: !!p.moveBox };
  return out; })()`;
/* ═══ A — 하나씩 [누름] → [확인] ═══ */
await boot();
const s0 = await J(SNAP);
const boxIds = Object.keys(s0).filter(k => s0[k].box);
console.log('  처음 이삿짐', boxIds.length, JSON.stringify(boxIds.slice(0, 4)));
let taps = 0;
for (let k = 0; k < 40; k++) {
  await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(900); await settle();
  const t = await J(`(()=>{ const c=document.querySelector('#pageBag .bagslot[data-place^="box:"]'); if (!c) return null; const d = c.dataset.boxpot; c.click(); return d; })()`);
  if (!t) break;
  taps++; await sleep(1300); await settle();
  await J(`(()=>{ const b=document.getElementById('placeOk'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(900); await dlg(); await bannerOff();
}
const sA = await J(SNAP);
const leftA = Object.keys(sA).filter(k => sA[k].box).length;
console.log('  A 하나씩', JSON.stringify({ taps, leftA }));
if (OUT) await page.shot(`${OUT}/390_c8e_one.png`);
/* ═══ B — 한꺼번에 ═══ */
await boot();
await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1500); await settle();
const a = await J(`(()=>{ const b=document.querySelector('#pageBag [data-act="boxAll"]'); return b ? { t: (b.textContent||'').trim(), shown: !!b.offsetParent } : null; })()`);
console.log('  ㉮ 단추', JSON.stringify(a));
if (OUT) await page.shot(`${OUT}/390_c8e_bag.png`);
ok(!!a && !a.탈 && a.shown && a.t === `한꺼번에 놓기 (${boxIds.length}개)`, `㉮ 가방 이삿짐 머리줄에 [한꺼번에 놓기 (${boxIds.length}개)]`, JSON.stringify(a));
await J(`(()=>{ const b=document.querySelector('#pageBag [data-act="boxAll"]'); if (b) b.click(); return !!b; })()`); await sleep(2500); await dlg();
const ev = await J(`(document.getElementById('event').innerText||'').replace(/\\s+/g,' ').slice(0,140)`);
const sB = await J(SNAP);
const leftB = Object.keys(sB).filter(k => sB[k].box).length;
console.log('  B 한꺼번에', JSON.stringify({ leftB, ev }));
if (OUT) await page.shot(`${OUT}/390_c8e_all.png`);
ok(!sB.탈 && leftB === leftA, `㉯ 단추 한 번 — 남은 이삿짐 ${leftB}(하나씩 놓은 판 ${leftA})`, JSON.stringify({ leftA, leftB, ev }));
const diff = boxIds.filter(id => { const x = sA[id], y = sB[id]; if (!x || !y) return true; if (x.slot !== y.slot) return true;
  if (!!x.at !== !!y.at) return true; if (x.at && y.at && x.at.some((v, i) => Math.abs(v - y.at[i]) > 0.001)) return true; return false; });
ok(!sA.탈 && !sB.탈 && boxIds.length > 0 && diff.length === 0, `㉰ 놓인 자리가 하나씩 놓은 판과 개체마다 같음(${boxIds.length}개)`, JSON.stringify({ diff: diff.slice(0, 5).map(id => ({ id, A: sA[id], B: sB[id] })) }));
/* ═══ ㉱ ㉲ 덜 놓음 — 원룸 · 360 ═══ */
{ const w = JSON.parse(fs.readFileSync(SAVE_S, 'utf8')); const st = w.state; const fp = st.firstPlay; const day = st.day;
  for (const pp of [...fp.beansprout.pots, ...Object.values(fp.crops || {}).flatMap(v => (v && v.pots) || [])])
    Object.assign(pp, { slotId: null, at: null, moveBox: true, sown: true, harvested: false, ageDays: 1, startedOnDay: day - 1, idleSinceDay: day - 1 });
  const base0 = fp.beansprout.pots[0];
  for (let i = 0; i < 9; i++) fp.beansprout.pots.push({ ...JSON.parse(JSON.stringify(base0)), id: `crop_01_${90 + i}` });
  const p3 = await launch({ width: 360, height: 844, dpr: 2 });
  p3.on((method, pr) => { if (method === 'Runtime.exceptionThrown') exc.push(((pr.exceptionDetails.exception && pr.exceptionDetails.exception.description) || pr.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await p3.send('Runtime.enable'); await p3.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  const J3 = async (js) => JSON.parse(await p3.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  await p3.goto(`${BASE}/data/balance/homes.json`);
  await p3.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(JSON.stringify(w))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await p3.goto(`${BASE}/game.html`); await p3.waitFor('window.__byeotBooted === true', 300000, 500); await p3.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
  for (let i = 0; i < 160; i++) { const t = await J3(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await p3.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
  for (let i = 0; i < 20; i++) { const on = await J3(`document.getElementById('event').classList.contains('on')`); if (on !== true) break; await J3(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); }
  await J3(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1500);
  const n0 = await J3(`(()=>{ const b=document.querySelector('#pageBag [data-act="boxAll"]'); return b ? (b.textContent||'').trim() : null; })()`);
  await J3(`(()=>{ const b=document.querySelector('#pageBag [data-act="boxAll"]'); if (b) b.click(); return !!b; })()`);
  let g = null; for (let i = 0; i < 60; i++) { await sleep(500); g = await J3(`(()=>{ const ev=document.getElementById('event'); const b=ev.querySelector('b'); const sub=ev.querySelector('i');
      const lines = sub ? (()=>{ const rg=document.createRange(); rg.selectNodeContents(sub); return new Set([...rg.getClientRects()].filter(q=>q.width>0).map(q=>Math.round(q.top))).size; })() : null;
      const fp=window.__S().firstPlay; const all=[...fp.beansprout.pots, ...Object.values(fp.crops||{}).flatMap(v=>(v&&v.pots)||[])];
      return { on: ev.classList.contains('on'), title: b ? ((b.childNodes[0]||{}).textContent||'').trim() : null, sub: sub ? (sub.textContent||'').trim() : null, lines, left: all.filter(p=>p.moveBox && !p.slotId && !p.at).length, log: ((window.__S().log||[]).slice(-1)[0]||{}).msg || null }; })()`);
    if (g && g.on && /이삿짐/.test(g.title || '')) break; }
  console.log('  ㉱ 원룸 덜 놓음 360', JSON.stringify({ n0, g }));
  if (OUT) await p3.shot(`${OUT}/360_c8e_partial.png`);
  const m = /^📦 이삿짐 (\d+)개를 놓았습니다$/.exec(g && g.title || '');
  ok(!g.탈 && !!m && g.left > 0 && new RegExp(`^남은 ${g.left}개는 맞는 자리가 없습니다 — .+`).test(g.sub || ''), '㉱ 덜 놓음 — «📦 이삿짐 N개를 놓았습니다» / «남은 M개는 맞는 자리가 없습니다 — …»(§11)', JSON.stringify({ title: g.title, sub: g.sub, left: g.left }));
  ok(!g.탈 && !!m && g.log === `📦 이삿짐 ${m[1]}개를 한꺼번에 놓았습니다 · ${g.left}개 남음`, '㉱ 기록 «📦 이삿짐 N개를 한꺼번에 놓았습니다 · M개 남음»(§11)', JSON.stringify({ log: g.log }));
  ok(!g.탈 && g.lines != null && g.lines <= 2, `㉲ 360 — 아래 줄이 두 줄 안(${g.lines}줄)`, JSON.stringify({ sub: g.sub, lines: g.lines }));
  /* 세 갈래 × 남은 수 2 · 12 — 같은 배너 그림(§banners)에 글만 바꿔 줄 수를 잰다 */
  const rows = [];
  for (const tail of ['가구를 놓으세요', '가구를 더 놓거나 자리를 비워 주세요', '가방 칸을 빈 바닥으로 끌어 놓으세요']) for (const M of [2, 12]) {
    for (let i = 0; i < 20; i++) { const on = await J3(`document.getElementById('event').classList.contains('on')`); if (on !== true) break; await J3(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(300); }
    await sleep(500);
    const r = await J3(`(async()=>{ window.__byeotBannerTest([{ title: '📦 이삿짐 28개를 놓았습니다', sub: ${JSON.stringify(`남은 ${M}개는 맞는 자리가 없습니다 — ${tail}`)} }]);
      await new Promise(res=>setTimeout(res, 900)); for (const a of document.getAnimations()) { try { a.finish(); } catch (e) { void e; } }
      const sub = document.querySelector('#event i'); const rg=document.createRange(); rg.selectNodeContents(sub);
      return { t: (sub.textContent||'').trim(), lines: new Set([...rg.getClientRects()].filter(q=>q.width>0).map(q=>Math.round(q.top))).size }; })()`);
    rows.push({ M, tail, lines: r.lines, 탈: r.탈 });
  }
  console.log('  ㉲ 세 갈래 × 남은 수', JSON.stringify(rows));
  ok(rows.length === 6 && rows.every(x => !x.탈 && x.lines <= 2), '㉲ 360 — 세 갈래 × 남은 수 2 · 12 모두 두 줄 안', JSON.stringify(rows));
  try { await p3.close(); } catch (e3) { void e3; } }
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { void e; }
console.log(bad ? `\nprobe_critic8_e: 빨강 ${bad}` : '\nprobe_critic8_e: 다 통과');
process.exit(bad ? 1 : 0);
