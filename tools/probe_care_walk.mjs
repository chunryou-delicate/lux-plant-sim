/* tools/probe_care_walk.mjs — **B 판 «식물 돌봄»을 게임 화면 손으로 걷는다**(core · 2026-10-24 · 총괄 D73 · D80)
   ------------------------------------------------------------------
   하네스(probe_branches careR --dump)가 단계 «전날» 세이브를 뜬다. 이 자는 그 세이브를 게임 localStorage 에 싣고 화면 손으로 걷는다
   (값·깃발을 안 건드린다 — 맡은 화분을 자리에 놓는 손만 코어 함수로).
     node tools/probe_branches.mjs --one '{"name":"careR","seed":"g","targets":[5000000],"days":1300,"dump":"<폴더>"}'
     DUMP=<폴더> OUTDIR=<사진 폴더> BYEOT_URL=http://127.0.0.1:9300 node tools/probe_care_walk.mjs
   단계:
     ready       500만 닿음(엔딩 «전») — 할 일 [내 집 마련] → [계약한다] → 장면 → 진로 카드 → [돌봄을 시작한다]
                 → 투룸 · 창 옆 맡김판 · 첫 맡김(가방) · 맡김판 줄([돌려준다] 꺼짐) · 그루 카드 «맡음» 줄 · 팔기 막힘 · 놓고 하루
     careSaved   처음 나은 날 — 그 고장 «나았을 때» 대사 · 맡김판 [돌려준다] 켜짐 → 누름 → 수고비 · 맡김이 걷힘 · 화분이 떠남
     care10      살린 10 — 돌려주면 칠판 간판이 선다(기록 줄 · 방 소품 깃발)
     careEnd     살린 30 다음 날 아침 — careEnding 대사 · 끝맺음 카드 · 칭호 «동네 식물 의사» · 다시 켜도 카드 안 뜸
   단계마다: 방이 선다 · 처리 안 된 예외 0 · 저장 → 다시 켬 왕복(그 판 그대로) */
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const DUMP = process.env.DUMP;
const PFX = process.env.PFX || 'careR_g';
const OUTDIR = process.env.OUTDIR || null; if (OUTDIR) fs.mkdirSync(OUTDIR, { recursive: true });
if (!DUMP) { console.error('DUMP=<probe_branches --dump 폴더> 가 필요합니다'); process.exit(2); }
const wd = setTimeout(() => { console.error('⏱ 자가 제한(30분)'); process.exit(2); }, 1800000); wd.unref && wd.unref();

let bad = 0;
const ok = (c, m, extra) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) bad++; return c; };
const page = await launch();
const exc = [];
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js, ms = 180000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
const shot = async n => { if (OUTDIR) await page.shot(`${OUTDIR}/${n}.png`); };
/* 대사를 한 줄씩 넘긴다 — want 에 맞는 줄이 뜨면 그 화면을 찍는다 */
const talk = async (want = null, name = null, max = 80) => {
  const lines = []; let shotTaken = false;
  for (let i = 0; i < max; i++) {
    const t = await J(`(()=>({ on: document.getElementById('stage').classList.contains('talking'), text: ((document.getElementById('dlgText') || {}).textContent || '').trim() }))()`);
    if (!t.on) break;
    if (t.text && lines[lines.length - 1] !== t.text) lines.push(t.text);
    if (want && !shotTaken && want.test(t.text)) { await sleep(500); await shot(name); shotTaken = true; }
    await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(180);
  }
  return { lines, shotTaken };
};
const boot = async () => { await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(5000); await talk(); };
const has = stage => fs.existsSync(path.join(DUMP, `${PFX}_${stage}.json`));
const load = async (stage) => {
  const text = fs.readFileSync(path.join(DUMP, `${PFX}_${stage}.json`), 'utf8');
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(text)}); return 1; })()`, false);
  await boot();
};
const digest = `(()=>{ const S=window.__S(); const C=S.jobCare||{}; return { day:S.day, room:S.home.room, job:S.story.job && S.story.job.id, saved:C.saved ?? null,
  req:(C.requests||[]).map(r=>r.problem+(r.savedOn!=null?'+':'')).join(','), sign:C.signOnDay ?? null, ended:(S.story.jobs&&S.story.jobs.care) ? S.story.jobs.care.endedOn : null,
  sp:((S.species&&S.species.pots)||[]).map(q=>q.species+(q.care?'*':'')+(q.slotId||q.at?'@':'')).join(','), cash:S.tutorial.cashWon }; })()`;
const view = `(()=>({ rv: !!window.__rv, room: window.__rv && window.__rv.roomId, failed: document.getElementById('stage').classList.contains('room-failed') }))()`;
const logTail = (n = 12) => J(`(()=>((window.__S().log||[]).slice(-${n}).map(x=>typeof x==='string'?x:(x&&(x.text||x.ko||x.msg))||'')))()`);
const nextDayTalk = async (want, name) => {
  const d0 = (await J(digest)).day;
  await page.eval(`(()=>{ const n=document.getElementById('mealGo'); if(n) n.click(); })()`, false); await sleep(2500);
  const t = await talk(want, name); await sleep(600);
  return { d0, d1: (await J(digest)).day, ...t };
};
const roundTrip = async (stage) => {
  await sleep(1200);
  const before = await J(digest); await boot(); const after = await J(digest);
  ok(JSON.stringify(before) === JSON.stringify(after), `[${stage}] 저장 → 다시 켬 왕복`, JSON.stringify(before) === JSON.stringify(after) ? '' : JSON.stringify({ before, after }));
};
/* 맡김판(상점 탭 맨 위 #orderBoard) — 줄마다 글 · [돌려준다] 켜짐 */
const board = async () => {
  await page.eval(`(()=>{ window.__byeotSheet.open('shop'); })()`, false); await sleep(1000);
  return J(`(()=>{ const b=document.getElementById('orderBoard'); if(!b) return null;
    return { shown: b.style.display !== 'none' && !!b.offsetParent, head: ((b.querySelector('h4')||{}).textContent||'').trim(),
             rows: [...b.querySelectorAll('.orow')].map(r=>({ t:((r.querySelector('.otxt')||{}).textContent||'').replace(/\\s+/g,' ').trim(), id:(r.querySelector('[data-careret]')||{}).dataset?.careret ?? null,
                       on: !!r.querySelector('[data-careret]') && !r.querySelector('[data-careret]').disabled })) }; })()`);
};
const closeSheet = async () => { const r = await page.eval(`(()=>{ try { window.__byeotSheet.close(); return null; } catch(e){ return e.message; } })()`, false); if (r) console.log('  · 시트 닫기 실패 —', r); };
const cardOf = async (id) => {
  await page.eval(`(()=>window.__detailOpen('species', { id: ${JSON.stringify(id)} }))()`, false); await sleep(1200);
  return J(`(()=>((document.querySelector('#detail.on .dcard') || {}).textContent || '').replace(/\\s+/g,' ').slice(0, 2000))()`);
};
const closeCard = () => page.eval(`(()=>{ const c=document.getElementById('dClose'); if(c) c.click(); })()`, false);
/* 맡은 화분을 «오늘 가장 밝은 빈 자리»에(하네스 대조 손과 같은 손 · 코어 함수) */
const placeCarePots = () => J(`(async()=>{ const SPM=await import('/src/game/species.js'); const loop=await import('/src/game/loop.js');
  const S=window.__S(), io=window.__io, slots=io.light.room.slots||[]; const sky=io.light.skyFor(S.day,S.sim);
  const occ=new Set([...(S.pots||[]).map(p=>p.slotId), ...(S.cuttings||[]).map(c=>c.slotId), ...SPM.speciesPotsOf(S).map(q=>q.slotId)].filter(Boolean));
  let n=0; const errs=[]; for (const q of SPM.speciesPotsOf(S)) if (q.care && !SPM.speciesPlaced(q)) {
    let b=null,bd=-1; for (const sl of slots){ if(occ.has(sl.slotId)) continue; let d=-1; try{ d=io.light.dliOfSlot(sl.slotId, loop.lightOptsOf(S, sky)); }catch(e){ errs.push(sl.slotId+': '+e.message); } if(d>bd){bd=d;b=sl;} }
    if (b) { SPM.setSpeciesAt(S, q.id, { slotId:b.slotId, at:{ x:b.x,y:b.y,z:b.z }, dropM:b.dropM }); occ.add(b.slotId); n++; } }
  window.__redraw(); if (errs.length) console.warn('[맡은 화분 놓기] 빛을 못 잰 자리', errs.slice(0, 3)); return n; })()`);

try {
  /* ── ready · 500만 닿음 → 엔딩 → 진로 카드 → [돌봄을 시작한다] ── */
  { const e0 = exc.length;
    await load('ready');
    const r0 = await J(digest); console.log('[ready] 실음 —', JSON.stringify(r0));
    await page.eval(`(()=>{ window.__byeotSheet.open('quest'); })()`, false); await sleep(900);
    const ask = await J(`(()=>{ const b=document.querySelector('[data-act="homeAsk"]'); return { has: !!b, off: b ? b.disabled : null }; })()`);
    ok(ask.has && !ask.off, `[ready] 할 일에 [내 집 마련] 단추가 켜져 있다`, JSON.stringify(ask));
    await page.eval(`(()=>{ const b=document.querySelector('[data-act="homeAsk"]'); if (b) b.click(); })()`, false); await sleep(900);
    await page.eval(`(()=>{ const b=document.getElementById('homeGo'); if (b) b.click(); })()`, false); await sleep(1500);
    await talk(null, null, 120); await sleep(800);
    await page.eval(`(()=>{ const b=document.getElementById('homeNext'); if (b && b.offsetParent) b.click(); })()`, false); await sleep(1500);
    await talk(); await sleep(600);
    const ce = await J(`(()=>({ on: document.getElementById('chapterEnd').classList.contains('on'), cards: [...document.querySelectorAll('#jobCards [data-job]')].map(b=>b.dataset.job+':'+b.textContent.trim()) }))()`);
    console.log('[ready] 진로 덮개 —', JSON.stringify(ce));
    await shot('ready_job_cards');
    ok(ce.on && ce.cards.includes('care:돌봄을 시작한다'), '[ready] 진로 카드에 [돌봄을 시작한다]', JSON.stringify(ce.cards));
    await page.eval(`(()=>{ const b=document.querySelector('#jobCards [data-job="care"]'); if (b) b.click(); })()`, false);
    let st = null;
    for (let i = 0; i < 40; i++) { await sleep(2000); st = await J(view); if (st.rv && st.room === 'tworoom') break; }
    const t0 = await talk(/맡김판|남의 화분|말려/, 'care_day0_talk'); await sleep(1500);
    console.log('  대사 —', t0.lines.slice(0, 10).join(' / '));
    const d0 = await J(digest); console.log('[돌봄 첫날] —', JSON.stringify(d0), JSON.stringify(st));
    ok(st && st.rv && !st.failed && d0.room === 'tworoom' && d0.job === 'care', '[돌봄 첫날] 다시 켜지 않고 투룸 · 진로 care', JSON.stringify({ st, room: d0.room, job: d0.job }));
    ok(t0.lines.some(l => /창 옆에 맡김판을 걸었다/.test(l)) && t0.lines.some(l => /남의 화분이니까/.test(l)), '[돌봄 첫날] jobStartCare · careOpen 대사', t0.lines.slice(0, 6).join(' / '));
    const fb = await J(`(()=>{ const S=window.__S(); const r=document.getElementById('roomCanvas').getBoundingClientRect();
      const b=(S.home.furnitureAdded||[]).find(f=>f.preset==='care_board'); const p=b ? window.__rv.screenPosOf(b.uid) : null;
      return { board: !!b, onScreen: !!p && p.x >= 0 && p.y >= 0 && p.x <= r.width && p.y <= r.height, outfit: window.__rv.heroOutfit ? window.__rv.heroOutfit() : null }; })()`);
    ok(fb.board && fb.onScreen, '[돌봄 첫날] 맡김판(care_board)이 벽에 걸려 화면 안', JSON.stringify(fb));
    console.log('  · 옷 —', fb.outfit);
    const lg = await logTail(16);
    ok(lg.filter(l => /맡김판을 걸었습니다/.test(l)).length === 1 && lg.some(l => /창 옆에 맡김판을 걸었습니다/.test(l)), '[돌봄 첫날] 기록 줄 «창 옆에 맡김판을 걸었습니다» 한 번', lg.slice(-6).join(' / '));
    ok(/^ca_bright$/.test(d0.req) && /calathea\*(?!@)/.test(d0.sp), `[돌봄 첫날] 첫 맡김 ca_bright · 맡은 칼라테아가 가방에(${d0.req} · ${d0.sp})`);
    await shot('care_day0');
    const b0 = await board(); console.log('[돌봄 첫날] 맡김판 —', JSON.stringify(b0));
    ok(b0 && b0.shown && /맡김판 · 살린 화분 0/.test(b0.head) && b0.rows.length === 1 && /잎이 다 말림/.test(b0.rows[0].t) && /\d+일 남음/.test(b0.rows[0].t) && !b0.rows[0].on,
       '[돌봄 첫날] 상점 맡김판 — 한 줄(손님 · 칼라테아 · 잎이 다 말림 · 남은 날) · [돌려준다] 꺼짐');
    await shot('care_board0');
    await closeSheet(); await sleep(500);
    const careId = await J(`(()=>{ const q=(window.__S().species.pots||[]).find(q=>q.care); return q ? q.id : null; })()`);
    const card = await cardOf(careId);
    ok(/맡음/.test(card) && /잎이 다 말림/.test(card) && /맡은 화분입니다/.test(card), '[돌봄 첫날] 그루 카드 «맡음» 줄 · 팔기 막힘(까닭 글)', card.slice(0, 220));
    await shot('care_card0');
    await closeCard(); await sleep(500);
    const placed = await placeCarePots(); ok(placed === 1, `[돌봄 첫날] 맡은 화분을 자리에 놓음(${placed})`);
    const nd = await nextDayTalk(null, null);
    ok(nd.d1 === nd.d0 + 1, `[돌봄] [다음 날](${nd.d0} → ${nd.d1})`);
    await roundTrip('ready');
    const ne = exc.slice(e0); ok(ne.length === 0, '[ready] 처리 안 된 예외 0', ne.slice(0, 2).join(' / ')); }

  /* ── careSaved · 처음 나은 날 → [돌려준다] → 수고비 ── */
  if (has('careSaved_pre')) {
    const e0 = exc.length;
    await load('careSaved_pre');
    const p0 = await J(digest); console.log('[careSaved] 실음 —', JSON.stringify(p0));
    const nd = await nextDayTalk(/다 펴졌|끝을 살렸|다시 났|다시 깨어났|다시 내려온|새 잎이 났/, 'careSaved_talk');   /* dialogue.js careSaved* 여덟 줄 */
    console.log('  대사 —', nd.lines.slice(0, 8).join(' / '));
    ok(nd.d1 === nd.d0 + 1, `[careSaved] [다음 날](${nd.d0} → ${nd.d1})`);
    const d1 = await J(digest); console.log('[careSaved] 판 —', JSON.stringify(d1));
    ok(/\+/.test(d1.req), `[careSaved] 그날 나은 맡김이 있다(${d1.req})`);
    ok(nd.shotTaken, '[careSaved] «나았을 때» 대사가 화면에 떴다', nd.lines.slice(0, 4).join(' / '));
    const b1 = await board(); console.log('[careSaved] 맡김판 —', JSON.stringify(b1));
    const row = b1 && b1.rows.find(r => r.on);
    ok(!!row && /나음 — 돌려줄 수 있습니다/.test(row.t), '[careSaved] 맡김판 [돌려준다] 켜짐 · «나음» 글', row ? row.t : '');
    await shot('careSaved_board');
    if (row) {
      const c0 = (await J(digest)).cash, n0 = (await J(`(()=>(window.__S().species.pots||[]).filter(q=>q.care).length)()`));
      await page.eval(`(()=>{ const b=document.querySelector('#orderBoard [data-careret="${row.id}"]'); if(b) b.click(); })()`, false); await sleep(1500);
      const t = await talk(/살려 돌려줬다|네가 살린/, 'careSaved_first'); await sleep(500);
      const d2 = await J(digest), n1 = (await J(`(()=>(window.__S().species.pots||[]).filter(q=>q.care).length)()`));
      const lg = await logTail(10);
      console.log('  돌려줌 —', JSON.stringify({ cash: [c0, d2.cash], saved: d2.saved, care: [n0, n1] }), '·', t.lines.slice(0, 4).join(' / '));
      ok(d2.cash > c0 && d2.saved === (p0.saved ?? 0) + 1 && n1 === n0 - 1, '[careSaved] 돌려주면 수고비가 들어오고 · 살린 화분 +1 · 맡은 화분이 떠난다');
      ok(lg.some(l => /돌봄 수고비/.test(l)), '[careSaved] 기록 줄 «돌봄 수고비»', lg.slice(-4).join(' / '));
      ok(p0.saved !== 0 || t.lines.some(l => /첫 화분을 살려 돌려줬다/.test(l)), '[careSaved] 첫 돌려줌이면 care_first 끝 대사', t.lines.slice(0, 3).join(' / '));
      await shot('careSaved_after');
    }
    await closeSheet(); await sleep(400);
    await roundTrip('careSaved');
    const ne = exc.slice(e0); ok(ne.length === 0, '[careSaved] 처리 안 된 예외 0', ne.slice(0, 2).join(' / '));
  } else ok(false, '[careSaved] 처음 나은 날 «전날» 세이브가 없다(하네스 판이 하나도 못 살림)');

  /* ── care10 · 살린 10 — 돌려주면 칠판 간판 ── */
  if (has('care10_pre')) {
    const e0 = exc.length;
    await load('care10_pre');
    const p0 = await J(digest); console.log('[care10] 실음 —', JSON.stringify(p0));
    await nextDayTalk(null, null);
    const b = await board(); const row = b && b.rows.find(r => r.on);
    ok(!!row, '[care10] 다음 날 나은 맡김이 있어 [돌려준다]가 켜졌다', JSON.stringify(b && b.rows));
    if (row) {
      await page.eval(`(()=>{ const x=document.querySelector('#orderBoard [data-careret="${row.id}"]'); if(x) x.click(); })()`, false); await sleep(1500);
      await closeSheet(); await sleep(400);
      const t = await talk(/칠판 간판|알아보겠다/, 'care10_talk'); await sleep(1500);
      const d = await J(digest), lg = await logTail(12);
      console.log('[care10] —', JSON.stringify(d), '·', t.lines.slice(0, 5).join(' / '));
      ok(d.saved === 10 && d.sign === d.day, `[care10] 살린 10 · 간판 날 = 오늘(${d.saved} · ${d.sign})`);
      ok(lg.some(l => /진열대 옆에 칠판 간판을 세웠습니다/.test(l)), '[care10] 기록 줄 «진열대 옆에 칠판 간판을 세웠습니다»', lg.slice(-5).join(' / '));
      ok((await J(`(()=>window.__rv.setShopSign(true))()`)) === false, '[care10] 방에 칠판 간판이 이미 서 있다(깃발 켜짐 — 다시 켜도 바뀜 없음)');
      await shot('care10_room');
      await roundTrip('care10');
      ok((await J(`(()=>window.__rv.setShopSign(true))()`)) === false, '[care10] 다시 켠 판에도 간판이 선다(signOnDay)');
    }
    const ne = exc.slice(e0); ok(ne.length === 0, '[care10] 처리 안 된 예외 0', ne.slice(0, 2).join(' / '));
  } else ok(false, '[care10] 살린 10 «전날» 세이브가 없다');

  /* ── careEnd · 살린 30 다음 날 아침 — 장면 대사 · 카드 · 칭호 ── */
  if (has('careEnd_pre')) {
    const e0 = exc.length;
    await load('careEnd_pre');
    const nd = await nextDayTalk(/동네 식물 의사|둘러봤다/, 'careEnd_talk');
    console.log('  대사 —', nd.lines.slice(0, 8).join(' / '));
    ok(nd.d1 === nd.d0 + 1, `[careEnd] [다음 날](${nd.d0} → ${nd.d1})`);
    const d = await J(digest);
    ok(d.ended === d.day && d.saved >= 30, `[careEnd] 끝맺음이 그날 아침(${JSON.stringify({ ended: d.ended, day: d.day, saved: d.saved })})`);
    ok(nd.shotTaken && nd.lines.some(l => /오늘부터 여긴 «동네 식물 의사»야/.test(l)), '[careEnd] careEnding 대사가 화면에 떴다', nd.lines.slice(0, 3).join(' / '));
    await sleep(600);
    const c = await J(`(()=>window.__byeotShopEnd())()`);
    console.log('[careEnd] 카드 —', JSON.stringify(c));
    ok(c.open && /살린 화분 \d+/.test(c.rows), '[careEnd] 끝맺음 카드(살린 화분 수)', JSON.stringify(c));
    await shot('careEnd_card');
    await page.eval(`(()=>{ const b=document.getElementById('shopEndGo'); if(b) b.click(); })()`, false); await sleep(800);
    ok(!(await J(`(()=>window.__byeotShopEnd().open)()`)), '[careEnd] [계속 산다]로 닫힌다');
    await page.eval(`(()=>{ const b=document.getElementById('navQuest'); if(b) b.click(); })()`, false); await sleep(1200);
    const head = await J(`(()=>({ tab: ((document.getElementById('questGoalTab')||{}).textContent||'').trim(), sub: ((document.getElementById('questSub')||{}).textContent||'').trim() }))()`);
    ok(/동네 식물 의사/.test(head.tab) && /동네 식물 의사/.test(head.sub) && !/내 집을 마련했습니다/.test(head.sub), `[careEnd] 할 일 머리 칭호`, JSON.stringify(head));
    await shot('careEnd_quest');
    await roundTrip('careEnd');
    ok(!(await J(`(()=>window.__byeotShopEnd().open)()`)), '[careEnd] 다시 켜도 카드가 또 안 뜬다');
    const ne = exc.slice(e0); ok(ne.length === 0, '[careEnd] 처리 안 된 예외 0', ne.slice(0, 2).join(' / '));
  } else ok(false, '[careEnd] 끝맺음 «전날» 세이브가 없다(하네스 판이 살린 30 에 못 닿음)');
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; }
finally { await page.close(); }
console.log(bad ? `probe_care_walk: FAIL (${bad})` : 'probe_care_walk: PASS');
process.exit(bad ? 1 : 0);
