/* tools/probe_wall_hang.mjs — 벽 걸이 v1 «걸이 자리» 화면 이음(core · 2026-10-10 · house 3ca468e9 · 총괄 결정 · 글 plan bcf8dda3)
   반지하 새 판에서 산 그림(재고)을 «사람 손 길»(가방 칸과 같은 함수)로 걸어 본다:
     ① 산 그림을 누르면 방 한가운데가 아니라 걸이 자리 원이 뜬다(글 «벽에 걸 자리를 골라 주세요») · 원은 화면 안
     ② 원을 고르면 그 자리에 걸린다 — 방 가구 줄에 y > 0 · 그 자리가 찬다 · 재고 하나 빠짐
     ③ 걸린 그림을 고르면 [옮기기]·[팔기]는 있고 [돌리기]는 없다 · [옮기기] → 다른 자리 원(제 자리 빼고) → 고르면 옮겨 걸린다
     ④ 자리를 다 채우면 «벽에 걸 자리가 다 찼습니다 — 걸린 것을 하나 내리면 걸 수 있습니다» · 주문판(투룸 전용)은 «주문판은 가게 방 문 옆에 겁니다»(plan a2ccb0c9)
     ⑤ 다시 켜도 걸린 자리가 그대로 · 달력 계절이 게임 계절(skyFor)과 맞아 있다(setSeason 이 «바뀐 것 없음»)
     ⑥ 콘솔에 처리 안 된 예외 없음
   python tools/serve.py 9300 · node tools/probe_wall_hang.mjs (OUTDIR=… 이면 사진) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const OUTDIR = process.env.OUTDIR || null; if (OUTDIR) fs.mkdirSync(OUTDIR, { recursive: true });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
const page = await launch();
const exc = [];
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').slice(0, 200)); });
await page.send('Runtime.enable');
const J = async (js, ms = 120000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
const shot = async n => { if (OUTDIR) await page.shot(`${OUTDIR}/${n}.png`); };
const skip = async () => { for (let i = 0; i < 40; i++) {
  if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s && s.offsetParent) s.click(); else { const x=document.getElementById('dlgBox'); if(x)x.click(); }})()`, false); await sleep(200); } };
const boot = async () => { await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(5000); await skip(); };
const hungRows = `(()=>((window.__S().home.furnitureAdded)||[]).filter(f => /^(poster_|frame_|postcards|calendar_|order_board)/.test(f.preset)).map(f => ({ uid:f.uid, preset:f.preset, y:f.y ?? null, x:f.x, z:f.z })))()`;
const spots = `(()=>window.__byeotHang.spots().map(s => ({ id:s.id, free:s.free, uid:s.uid })))()`;
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__wh){ localStorage.clear(); sessionStorage.__wh='1'; } }catch(e){}` });
  await boot();
  const sp0 = await J(spots);
  console.log('자리 —', JSON.stringify(sp0));
  ok(sp0.length === 4 && sp0.every(s => s.free), `반지하 걸이 자리 넷 · 다 빔(${sp0.length})`);
  await page.eval(`(()=>{ const st=window.__S().shop.stock; st.furn_poster_monstera=1; st.furn_calendar_season=1; st.furn_frame_field=3; st.furn_postcards=2; st.furn_order_board=1; window.__redraw(); })()`, false);
  /* ① */
  const r1 = await J(`window.__placeFurnStock('furn_poster_monstera')`);
  await sleep(600);
  const pk = await J(`(()=>window.__byeotHang.picking())()`);
  const dotsIn = await J(`(()=>{ const r=document.getElementById('stage').getBoundingClientRect(); return [...document.querySelectorAll('#hangPickDots .hp')].every(b => { const q=b.getBoundingClientRect(); return q.width > 0 && q.left >= r.left - 1 && q.right <= r.right + 1 && q.top >= r.top - 1 && q.bottom <= r.bottom + 1; }); })()`);
  console.log('① —', JSON.stringify(r1), JSON.stringify(pk));
  await shot('1_pick');
  ok(r1.picking && pk.on && pk.dots.length >= 1 && pk.msg === '벽에 걸 자리를 골라 주세요', `① 걸이 자리 원이 뜬다(${pk.dots.length}개) · 글`);
  ok(dotsIn, '① 원이 무대 안에 있다');
  ok((await J(hungRows)).length === 0, '① 고르기 전엔 아직 안 걸렸다');
  /* ② */
  const first = pk.dots[0];
  await page.eval(`(()=>document.querySelector('#hangPickDots [data-hang="${first}"]').click())()`, false); await sleep(2500);
  const h2 = await J(hungRows), sp2 = await J(spots), stock2 = await J(`(()=>window.__S().shop.stock.furn_poster_monstera || 0)()`);
  console.log('② —', JSON.stringify(h2), JSON.stringify(sp2));
  await shot('2_hung');
  ok(h2.length === 1 && h2[0].preset === 'poster_monstera' && h2[0].y > 0.5, `② 걸렸다(y ${h2[0] && h2[0].y})`);
  ok(sp2.find(s => s.id === first).uid === (h2[0] || {}).uid, '② 고른 자리가 찼다');
  ok(stock2 === 0 && !(await J(`(()=>window.__byeotHang.picking().on)()`)), '② 재고 하나 빠짐 · 원 닫힘');
  /* ③ */
  const uid = h2[0].uid;
  const menu = await J(`(()=>{ const f=(window.__rv.furniture()||[]).find(x => x.uid === ${JSON.stringify(uid)}); const cr=document.getElementById('roomCanvas').getBoundingClientRect();
    window.__furn.select(f, cr.left + cr.width/2, cr.top + cr.height/2); const v = id => { const e=document.getElementById(id); return !!(e && e.style.display !== 'none' && e.offsetParent); };
    return { move: v('furnMove'), turn: v('furnTurn'), sell: v('furnSell') }; })()`);
  console.log('③ 메뉴 —', JSON.stringify(menu));
  ok(menu.move && menu.sell && !menu.turn, '③ 걸린 그림 메뉴 — [옮기기]·[팔기] 있고 [돌리기] 없음');
  await page.eval(`(()=>window.__furn.beginMove())()`, false); await sleep(600);
  const pk3 = await J(`(()=>window.__byeotHang.picking())()`);
  ok(pk3.on && pk3.dots.length >= 1 && !pk3.dots.includes(first), `③ [옮기기] → 다른 자리 원(${pk3.dots.join(',')}) · 제 자리 빠짐`);
  const second = pk3.dots[0];
  await page.eval(`(()=>document.querySelector('#hangPickDots [data-hang="${second}"]').click())()`, false); await sleep(2500);
  const sp3 = await J(spots);
  ok(sp3.find(s => s.id === second).uid === uid && sp3.find(s => s.id === first).free, `③ 옮겨 걸렸다(${first} → ${second})`);
  await page.eval(`(()=>{ try { document.getElementById('furnClose') && document.getElementById('furnClose').click(); } catch(e){} })()`, false); await sleep(300);
  /* ④ 다 채우기 */
  let n = 0;
  for (const it of ['furn_calendar_season', 'furn_frame_field', 'furn_frame_field', 'furn_postcards', 'furn_frame_field', 'furn_postcards']) {
    const r = await J(`window.__placeFurnStock(${JSON.stringify(it)})`); await sleep(400);
    const p = await J(`(()=>window.__byeotHang.picking())()`);
    if (!p.on) continue;
    await page.eval(`(()=>document.querySelector('#hangPickDots [data-hang="${p.dots[0]}"]').click())()`, false); await sleep(2000); n++;
  }
  const sp4 = await J(spots);
  console.log('④ 다 채움 —', n, JSON.stringify(sp4));
  const rFull = await J(`window.__placeFurnStock('furn_postcards')`); await sleep(400);
  const pFull = await J(`(()=>window.__byeotHang.picking())()`);
  const rNone = await J(`window.__placeFurnStock('furn_order_board')`); await sleep(400);
  const pNone = await J(`(()=>window.__byeotHang.picking())()`);
  console.log('④ —', JSON.stringify({ rFull, pFull, rNone, pNone }));
  await shot('4_full');
  ok(sp4.every(s => !s.free), '④ 반지하 자리 넷이 다 찼다');
  ok(!pFull.on && pFull.lastLine === '벽에 걸 자리가 다 찼습니다 — 걸린 것을 하나 내리면 걸 수 있습니다', `④ 찼을 때 글(${pFull.lastLine})`);
  ok(!pNone.on && pNone.lastLine === '주문판은 가게 방 문 옆에 겁니다', `④ 주문판(투룸 전용) 글(${pNone.lastLine})`);
  /* ⑤ */
  await page.eval(`(()=>{ try { window.__byeotSave && window.__byeotSave(); } catch(e){} })()`, false); await sleep(1500);
  await boot();
  const sp5 = await J(spots);
  const season = await J(`(()=>({ s: window.__io.light.skyFor(window.__S().day, window.__S().sim).season, changed: window.__rv.setSeason(window.__io.light.skyFor(window.__S().day, window.__S().sim).season) }))()`);
  console.log('⑤ —', JSON.stringify(sp5), JSON.stringify(season));
  await shot('5_reload');
  ok(JSON.stringify(sp5.map(s => s.uid)) === JSON.stringify(sp4.map(s => s.uid)), '⑤ 다시 켜도 걸린 자리가 그대로');
  ok(season.changed === false, `⑤ 달력 계절이 이미 게임 계절(${season.s})과 맞아 있다`);
  ok(exc.length === 0, `⑥ 처리 안 된 예외 없음${exc.length ? ' — ' + exc.slice(0, 2).join(' / ') : ''}`);
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; }
finally { await page.close(); }
console.log(bad ? `probe_wall_hang: FAIL (${bad})` : 'probe_wall_hang: PASS');
process.exit(bad ? 1 : 0);
