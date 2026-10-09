/* tools/probe_move_remount.mjs — **이사하는 그 순간 원룸 3D 방이 서나** (2026-10-09 · core · 총괄 P0 · leaf 0748f781 재현)
   ------------------------------------------------------------
   ⛔ 났던 일: 반지하 → 원룸 이사(doMoveOut 끝 remountRoomView)에서 «방을 그리지 못했습니다 — …(reading 'precision')» · __rv null ·
     무대 room-failed. 다시 켜면 멀쩡해서 «다시 켬»을 끼우는 재는 자들(probe_d47_stand_window · probe_houseC · probe_d45)이 못 봤다.
     까닭: 08-17(5ebb1ad3) dispose 가 늘 forceContextLoss → 같은 캔버스에 새 방뷰가 «잃은 문맥»을 받음.
   ★ 이 자는 **다시 켜지 않는다** — 화면 단추로 이사하고, 같은 페이지에서 원룸 방이 서는지만 본다(상설 · 이사 걸음 지킴이).
   잰다: 이사 뒤 S.home.room = oneroom · window.__rv 섬 · __rv 의 방이 oneroom · 무대에 room-failed 없음 · 덮개 글 없음 ·
         콘솔에 «방을 그리지 못했습니다» 없음 · 방이 실제로 그린다(가구 수 > 0)
   OUTDIR= (선택 · 찍음) · BYEOT_URL=(기본 127.0.0.1:9300) · CDP_GL=gpu(선택) · Q=keepctx=0(대조 판) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const QS = process.env.Q ? '?' + process.env.Q : '';   /* Q='keepctx=0' — 고치기 전 길(대조 판 · 빨강이 나와야 자가 잰다) */
const OUTDIR = process.env.OUTDIR || null;
if (OUTDIR) fs.mkdirSync(OUTDIR, { recursive: true });
const page = await launch({ width: 390, height: 844, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
const logs = [];
page.on(m => { if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
  if (m.method === 'Runtime.consoleAPICalled' && /error|warn/.test(m.params.type)) logs.push(m.params.type + ' ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300)); });
const J = async (js, ms = 300000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
const skip = async () => { for (let k = 0; k < 4; k++) { for (let i = 0; i < 40; i++) {
  if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s && s.offsetParent) s.click(); else { const x=document.getElementById('dlgBox'); if(x)x.click(); }})()`, false); await sleep(150); } await sleep(300); } };
try {
  await page.send('Runtime.enable', {});
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__mr){ localStorage.clear(); sessionStorage.__mr='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html${QS}`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(4500); await skip();
  /* 판: 몬스테라 · 이사 자금(세운 판 — 이사 단추는 화면 손) */
  await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js');
    const S=window.__S(); S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
    const a = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a); return 1; })()`);
  await skip();
  await page.eval(`(()=>{ const S=window.__S(); const ts=S.tutorial; ts.cashWon = ts.rules.moveOutCostWon + 3000000; ts.lamp.unlocked = true;
    ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day }; window.__redraw(); })()`, false); await sleep(600);
  const before = await J(`(()=>({ room: window.__S().home.room, rv: !!window.__rv, rvRoom: window.__rv && window.__rv.roomId }))()`);
  logs.length = 0;
  await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false); await sleep(1500); await skip();
  await page.eval(`(()=>{ if (window.__S().tutorial.movedOut) return; const p=document.getElementById('movePanel');
    if (p && p.classList.contains('on')) document.getElementById('moveGo').click(); else document.getElementById('moveOut').click(); })()`, false);
  /* 다시 켜지 않는다 — 같은 페이지에서 방이 서기를 기다린다 */
  let after = null;
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    after = await J(`(()=>({ room: window.__S().home.room, moved: !!window.__S().tutorial.movedOut, rv: !!window.__rv, rvRoom: window.__rv && window.__rv.roomId,
      failed: document.getElementById('stage').classList.contains('room-failed'), ok: document.getElementById('stage').classList.contains('room-ok'),
      fb: (()=>{ const f=document.getElementById('roomFallback'); if(!f) return ''; const t=(f.innerText||'').trim(); return /못했습니다|못 그|준비 중/.test(t) ? t.slice(0,120) : ''; })(),   /* 덮개의 «방이 떴습니다»는 성공 글이다 — 실패 글만 본다 */
      furn: (()=>{ try { return (window.__rv && window.__rv.furniture()||[]).length; } catch(e) { return -1; } })() }))()`);
    if (after.moved && (after.rv || after.failed)) break;
  }
  await skip(); await sleep(1500);
  if (OUTDIR) await page.shot(`${OUTDIR}/after_move.png`);
  const failLog = logs.filter(l => /방을 그리지 못했습니다|precision/.test(l));
  console.log('이사 전 —', JSON.stringify(before));
  console.log('이사 뒤 —', JSON.stringify(after));
  if (failLog.length) console.log('로그 —\n  ' + failLog.slice(0, 6).join('\n  '));
  ok(after && after.moved && after.room === 'oneroom', '화면 단추로 이사했다(원룸)');
  ok(after && after.rv && after.rvRoom === 'oneroom', `다시 켜지 않고 원룸 방뷰가 섰다(__rv ${after && after.rv} · ${after && after.rvRoom})`);
  ok(after && !after.failed && !after.fb, `무대가 깨지지 않았다(room-failed ${after && after.failed} · 덮개 «${after && after.fb}»)`);
  ok(!failLog.length, '콘솔에 «방을 그리지 못했습니다» 없음');
  ok(after && after.furn > 0, `방이 가구를 그린다(${after && after.furn})`);
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; }
finally { await page.close(); }
console.log(bad ? `probe_move_remount: FAIL (${bad})` : 'probe_move_remount: PASS');
process.exit(bad ? 1 : 0);
