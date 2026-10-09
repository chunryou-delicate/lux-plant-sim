/* tools/leaf/_check_move_remount.mjs — «이사하면 원룸 3D 방이 서나» ([leaf] 10-09 · 재현 도구)
   반지하 세이브로 켜고 → 게임 이사 길과 같게 oneroom.moveIntoOneroom(에타제르 들고) → 놓기 → window.__remount()(= 게임 doMoveOut 끝의 remountRoomView)
   → 새 방뷰(__rv)가 서나 · 등 자리(lampMounts) · 덮개 글(roomFallback) · 콘솔 오류를 적는다.
   10-09: 소프트웨어 GL · CDP_GL=gpu 둘 다 «방을 그리지 못했습니다 — Cannot read properties of null (reading 'precision')» · __rv null.
   SAVE= (반지하 세이브 · 필수) · BYEOT_URL=(기본 127.0.0.1:9340 · tools/serve.py) · CDP_GL=gpu */
import fs from 'node:fs';
import { launch, sleep } from '../test_cdp.mjs';
if (!process.env.SAVE) { console.error('⛔ SAVE='); process.exit(2); }
const SAVE = fs.readFileSync(process.env.SAVE, 'utf8'), BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9340';
const page = await launch({ width: 390, height: 844, dpr: 1 });
const logs = [];
page.on(m => { if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails).slice(0, 600));
  if (m.method === 'Runtime.consoleAPICalled' && /error|warn/.test(m.params.type)) logs.push(m.params.type + ' ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 400)); });
await page.send('Runtime.enable', {});
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
for (let i = 0; i < 100; i++) { await sleep(3000); if (await page.eval('String(!!window.__rv)') === 'true') break; }
await sleep(5000);
console.log('부팅 뒤 로그', logs.length); logs.length = 0;
const J = async (js, ms = 600000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message, st:(e.stack||'').slice(0,400)}); } })()`, true, ms));
console.log('이사 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const orm=await import('/src/game/oneroom.js');
  const S=window.__S(), io=window.__io;
  if (S.tutorial && Number.isFinite(S.tutorial.cashWon)) S.tutorial.cashWon = Math.max(S.tutorial.cashWon, 6000000);
  const carry=(io.light.room.def.furniture||[]).filter(f=>f&&f.uid&&/etagere/.test(f.preset)).map(f=>({uid:f.uid, preset:f.preset}));
  const r=orm.moveIntoOneroom(S, io, { carry });
  const H=await (await fetch('/data/house_rooms.json')).json(); const ref=(H.rooms.oneroom.reference_layout.furniture||[]).find(f=>/etagere/.test(f.preset));
  st.placeCarriedFurniture(S, ref.uid, { x:ref.x, z:ref.z, rot:ref.rot||0 }, { size: io.light.room.size });
  io.light.setFurnitureEdits(st.soldFurniture(S), st.addedFurniture(S));
  return { 방:S.home.room, roomChanged:r.roomChanged, 같은S: S===window.__S() }; })()`)));
const t0 = Date.now();
const res = await J(`(async()=>{ const t=performance.now(); try { await window.__remount(); return { ok:true, ms:Math.round(performance.now()-t), rv:!!window.__rv, room:window.__rv&&window.__rv.roomId }; } catch(e) { return { 탈:e.message, st:(e.stack||'').slice(0,600), ms:Math.round(performance.now()-t) }; } })()`);
console.log('remount —', JSON.stringify(res), (Date.now() - t0) + 'ms');
for (let i = 0; i < 20; i++) { if (await page.eval('String(!!window.__rv)') === 'true') break; await sleep(3000); }
console.log('rv 뒤 —', await page.eval(`JSON.stringify({rv:!!window.__rv, mounts:(window.__rv&&window.__rv.lampMounts&&window.__rv.lampMounts().map(m=>m.mountId))||null, fb:(document.getElementById('roomFallback')||{}).innerText||'', cls:document.getElementById('stage').className})`));
console.log('로그 —\n' + logs.slice(0, 30).join('\n'));
await page.close();
