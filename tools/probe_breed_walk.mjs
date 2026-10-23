/* tools/probe_breed_walk.mjs — **C 판 «무늬 육종»을 게임 화면 손으로 걷는다**(core · 2026-10-24 · 총괄 D83 (c) · D85)
   ------------------------------------------------------------------
   하네스(probe_branches breedR --dump)가 단계 «전날» 세이브를 뜬다. 이 자는 그 세이브를 게임 localStorage 에 싣고 화면 손으로 걷는다(값·깃발을 안 건드린다).
     node tools/probe_branches.mjs --one '{"name":"breedR","seed":"g","targets":[5000000],"days":1300,"dump":"<폴더>"}'
     DUMP=<폴더> OUTDIR=<사진 폴더> BYEOT_URL=http://127.0.0.1:9300 node tools/probe_breed_walk.mjs
   단계:
     ready         500만(엔딩 «전») — [내 집 마련] → [계약한다] → 장면 → 진로 카드 → [육종을 시작한다] → 투룸 · 판 자리 메모판(D85) · 기록장(빈 칸 글) · 대사
     breedSample   첫 표본 — 그 줄 첫 표본 대사 · 기록 줄 «📒 표본 — …» · 기록장 셈 막대
     breedCand     첫 후보 — breedCandidate 대사 · 기록장 «같은 조건 2/3»
     breedReg      첫 등록 대기 — 이름 칸이 뜬다(자동 이름 미리 채움) → 이름 적고 [이 이름으로 등록] → 상금 · 기록 줄 «🏷 새 품종» · breedRegister 대사 · 기록장 «등록»
     breedEnd      품종 셋 다음 날 아침 — breedEnding 대사 · 끝맺음 카드(«무늬 육종가» · 품종 이름들) · 할 일 머리 칭호 · 다시 켜도 카드 안 뜸
   단계마다: 방이 선다 · 처리 안 된 예외 0 · 저장 → 다시 켬 왕복(그 판 그대로) */
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const DUMP = process.env.DUMP;
const PFX = process.env.PFX || 'breedR_g';
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
const digest = `(()=>{ const S=window.__S(); const B=S.jobBreed||{}; return { day:S.day, room:S.home.room, job:S.story.job && S.story.job.id, samples:B.sampleCount ?? null,
  varieties:(B.varieties||[]).map(v=>v.slot+':'+v.name).join(','), pending:(B.pending||[]).map(p=>p.slot).join(','), ended:(S.story.jobs&&S.story.jobs.breed) ? S.story.jobs.breed.endedOn : null, cash:S.tutorial.cashWon }; })()`;
const view = `(()=>({ rv: !!window.__rv, room: window.__rv && window.__rv.roomId, failed: document.getElementById('stage').classList.contains('room-failed') }))()`;
const logTail = (n = 12) => J(`(()=>((window.__S().log||[]).slice(-${n}).map(x=>typeof x==='string'?x:(x&&(x.text||x.ko||x.msg))||'')))()`);
const nextDayTalk = async (want, name) => {
  const d0 = (await J(digest)).day;
  await page.eval(`(()=>{ const n=document.getElementById('mealGo'); if(n) n.click(); })()`, false); await sleep(2500);
  const t = await talk(want, name); await sleep(900);
  return { d0, d1: (await J(digest)).day, ...t };
};
const roundTrip = async (stage) => {
  await sleep(1200);
  const before = await J(digest); await boot(); const after = await J(digest);
  ok(JSON.stringify(before) === JSON.stringify(after), `[${stage}] 저장 → 다시 켬 왕복`, JSON.stringify(before) === JSON.stringify(after) ? '' : JSON.stringify({ before, after }));
};
const board = async () => {
  await page.eval(`(()=>{ window.__byeotSheet.open('shop'); })()`, false); await sleep(1000);
  return J(`(()=>{ const b=document.getElementById('orderBoard'); if(!b) return null;
    return { shown: b.style.display !== 'none' && !!b.offsetParent, head: ((b.querySelector('h4')||{}).textContent||'').trim(), text: (b.textContent||'').replace(/\\s+/g,' ').trim().slice(0, 900),
             slots: [...b.querySelectorAll('.bslot')].map(x=>x.textContent.trim()), bars: b.querySelectorAll('.bbar').length, nameBtn: !!b.querySelector('[data-breedname]') }; })()`);
};
const closeSheet = async () => { const r = await page.eval(`(()=>{ try { window.__byeotSheet.close(); return null; } catch(e){ return e.message; } })()`, false); if (r) console.log('  · 시트 닫기 실패 —', r); };

try {
  /* ── ready · 500만 → 엔딩 → 진로 카드 → [육종을 시작한다] ── */
  { const e0 = exc.length;
    await load('ready');
    console.log('[ready] 실음 —', JSON.stringify(await J(digest)));
    await page.eval(`(()=>{ window.__byeotSheet.open('quest'); })()`, false); await sleep(900);
    await page.eval(`(()=>{ const b=document.querySelector('[data-act="homeAsk"]'); if (b) b.click(); })()`, false); await sleep(900);
    await page.eval(`(()=>{ const b=document.getElementById('homeGo'); if (b) b.click(); })()`, false); await sleep(1500);
    await talk(null, null, 120); await sleep(800);
    await page.eval(`(()=>{ const b=document.getElementById('homeNext'); if (b && b.offsetParent) b.click(); })()`, false); await sleep(1500);
    await talk(); await sleep(600);
    const ce = await J(`(()=>({ on: document.getElementById('chapterEnd').classList.contains('on'), cards: [...document.querySelectorAll('#jobCards [data-job]')].map(b=>b.dataset.job+':'+b.textContent.trim()) }))()`);
    await shot('ready_job_cards');
    ok(ce.on && ce.cards.includes('breed:육종을 시작한다'), '[ready] 진로 카드에 [육종을 시작한다]', JSON.stringify(ce.cards));
    await page.eval(`(()=>{ const b=document.querySelector('#jobCards [data-job="breed"]'); if (b) b.click(); })()`, false);
    let st = null;
    for (let i = 0; i < 40; i++) { await sleep(2000); st = await J(view); if (st.rv && st.room === 'tworoom') break; }
    const t0 = await talk(/기록장을 새로 폈다|하나 나온 건 우연/, 'breed_day0_talk'); await sleep(1500);
    console.log('  대사 —', t0.lines.slice(0, 8).join(' / '));
    const d0 = await J(digest);
    ok(st && st.rv && !st.failed && d0.room === 'tworoom' && d0.job === 'breed', '[육종 첫날] 다시 켜지 않고 투룸 · 진로 breed', JSON.stringify({ st, d0 }));
    ok(t0.lines.some(l => /하나 나온 건 우연/.test(l)) && t0.lines.some(l => /기록장을 새로 폈다/.test(l)), '[육종 첫날] jobStartBreed · breedOpen 대사', t0.lines.slice(0, 5).join(' / '));
    const mb = await J(`(()=>{ const S=window.__S(); const r=document.getElementById('roomCanvas').getBoundingClientRect();
      const b=(S.home.furnitureAdded||[]).find(f=>f.preset==='memo_board'); const p=b ? window.__rv.screenPosOf(b.uid) : null;
      return { board: !!b, onScreen: !!p && p.x >= 0 && p.y >= 0 && p.x <= r.width && p.y <= r.height }; })()`);
    ok(mb.board && mb.onScreen, '[육종 첫날] 판 자리에 메모판(memo_board · D85)이 화면 안', JSON.stringify(mb));
    await shot('breed_day0');
    const b0 = await board(); console.log('[육종 첫날] 기록장 —', JSON.stringify(b0).slice(0, 300));
    ok(b0 && b0.shown && /기록장 · 품종 0/.test(b0.head) && /아직 적은 것이 없습니다/.test(b0.text), '[육종 첫날] 상점 기록장 — 품종 0 · 빈 칸 글');
    await shot('breed_board0');
    await closeSheet(); await roundTrip('ready');
    const ne = exc.slice(e0); ok(ne.length === 0, '[ready] 처리 안 된 예외 0', ne.slice(0, 2).join(' / ')); }

  /* ── breedSample · 첫 표본 ── */
  if (has('breedSample_pre')) { const e0 = exc.length;
    await load('breedSample_pre');
    const nd = await nextDayTalk(/밝은 데서 뿌리 낸 삽수가|무늬 어미 구근에서|분홍은 아래 잎을 닮아/, 'breedSample_talk');
    console.log('  대사 —', nd.lines.slice(0, 6).join(' / '));
    ok(nd.d1 === nd.d0 + 1 && nd.shotTaken, `[첫 표본] [다음 날] · 그 줄 첫 표본 대사(${nd.d0} → ${nd.d1})`, nd.lines.slice(0, 3).join(' / '));
    const lg = await logTail(14);
    ok(lg.some(l => /^📒 표본 — /.test(l)), '[첫 표본] 기록 줄 «📒 표본 — …»(하루 한 줄)', lg.filter(l => /📒/.test(l)).join(' / '));
    const b = await board(); console.log('[첫 표본] 기록장 —', JSON.stringify(b).slice(0, 400));
    ok(b && b.slots.length === 5 && b.bars >= 1, `[첫 표본] 기록장 칸 다섯 · 셈 막대(${b && b.bars})`);
    await shot('breedSample_board');
    await closeSheet(); await roundTrip('breedSample');
    const ne = exc.slice(e0); ok(ne.length === 0, '[첫 표본] 처리 안 된 예외 0', ne.slice(0, 2).join(' / '));
  } else ok(false, '[첫 표본] 전날 세이브가 없다');

  /* ── breedCand · 첫 후보 ── */
  if (has('breedCand_pre')) { const e0 = exc.length;
    await load('breedCand_pre');
    const nd = await nextDayTalk(/한 번만 더 나오면 우연이 아니야/, 'breedCand_talk');
    console.log('  대사 —', nd.lines.slice(0, 6).join(' / '));
    ok(nd.shotTaken, '[첫 후보] breedCandidate 대사', nd.lines.slice(0, 3).join(' / '));
    const b = await board();
    ok(b && b.slots.some(x => /같은 조건 2\/3/.test(x)), '[첫 후보] 기록장 «같은 조건 2/3»', b && b.slots.join(' | '));
    await shot('breedCand_board');
    await closeSheet(); await roundTrip('breedCand');
    const ne = exc.slice(e0); ok(ne.length === 0, '[첫 후보] 처리 안 된 예외 0', ne.slice(0, 2).join(' / '));
  } else ok(false, '[첫 후보] 전날 세이브가 없다');

  /* ── breedReg · 첫 등록(이름 칸) ── */
  if (has('breedReg_pre')) { const e0 = exc.length;
    await load('breedReg_pre');
    const p0 = await J(digest);
    await nextDayTalk(null, null); await sleep(800);
    let nm = await J(`(()=>window.__byeotBreedName())()`);
    if (!nm.open) { await page.eval(`(()=>{ const b=document.querySelector('#orderBoard [data-breedname]'); if (b) b.click(); })()`, false); await sleep(600); nm = await J(`(()=>window.__byeotBreedName())()`); }
    console.log('[등록] 이름 칸 —', JSON.stringify(nm));
    ok(nm.open && /^볕 .+ 1호$/.test(nm.value) && /비워 두면 «볕 .+ 1호»로 등록됩니다/.test(nm.hint), '[등록] 이름 칸이 뜬다 · 자동 이름 «볕 … 1호»가 미리 채워짐', JSON.stringify(nm));
    await shot('breedReg_name');
    const c0 = (await J(digest)).cash;
    await page.eval(`(()=>window.__byeotRegisterBreed('창가의 첫 무늬'))()`, false); await sleep(1200);
    const t = await talk(/이름을 붙였다|네 품종이야|첫 품종이야/, 'breedReg_talk'); await sleep(600);
    const d = await J(digest), lg = await logTail(12);
    console.log('[등록] —', JSON.stringify({ cash: [c0, d.cash], varieties: d.varieties }), t.lines.slice(0, 4).join(' / '));
    ok(d.cash > c0 && /창가의 첫 무늬/.test(d.varieties) && d.varieties.split(',').length === (p0.varieties ? p0.varieties.split(',').length : 0) + 1, '[등록] 상금이 들어오고 품종이 이름으로 섰다');
    ok(lg.some(l => /🏷 새 품종 — 창가의 첫 무늬/.test(l)) && lg.some(l => /품종 등록 상금/.test(l)), '[등록] 기록 줄 «🏷 새 품종» · «품종 등록 상금»', lg.slice(-4).join(' / '));
    ok(t.lines.some(l => /같은 무늬가 거듭 났다/.test(l)), '[등록] breedRegister 대사', t.lines.slice(0, 3).join(' / '));
    const b = await board();
    ok(b && b.slots.some(x => /등록 · «창가의 첫 무늬»/.test(x)), '[등록] 기록장 칸 «등록 · «창가의 첫 무늬»»', b && b.slots.join(' | '));
    await shot('breedReg_board');
    await closeSheet(); await roundTrip('breedReg');
    const ne = exc.slice(e0); ok(ne.length === 0, '[등록] 처리 안 된 예외 0', ne.slice(0, 2).join(' / '));
  } else ok(false, '[등록] 전날 세이브가 없다');

  /* ── breedEnd · 품종 셋 다음 날 아침 ── */
  if (has('breedEnd_pre')) { const e0 = exc.length;
    await load('breedEnd_pre');
    const nd = await nextDayTalk(/무늬 육종가|처음부터 넘겨 봤다/, 'breedEnd_talk');
    console.log('  대사 —', nd.lines.slice(0, 8).join(' / '));
    const d = await J(digest);
    ok(d.ended === d.day, `[끝맺음] 그날 아침(${JSON.stringify({ ended: d.ended, day: d.day, varieties: d.varieties })})`);
    ok(nd.lines.some(l => /오늘부터 너는 «무늬 육종가»야/.test(l)), '[끝맺음] breedEnding 대사', nd.lines.slice(0, 3).join(' / '));
    await sleep(600);
    const c = await J(`(()=>window.__byeotShopEnd())()`);
    console.log('[끝맺음] 카드 —', JSON.stringify(c));
    ok(c.open && /품종 \d+ · 적은 표본 \d+/.test(c.rows) && /육종을 시작한 지 \d+일/.test(c.rows) && /«.+»/.test(c.rows), '[끝맺음] 카드(품종 수 · 표본 · 날 · 품종 이름)', JSON.stringify(c));
    await shot('breedEnd_card');
    await page.eval(`(()=>{ const b=document.getElementById('shopEndGo'); if(b) b.click(); })()`, false); await sleep(800);
    ok(!(await J(`(()=>window.__byeotShopEnd().open)()`)), '[끝맺음] [계속 산다]로 닫힌다');
    await page.eval(`(()=>{ const b=document.getElementById('navQuest'); if(b) b.click(); })()`, false); await sleep(1200);
    const head = await J(`(()=>({ tab: ((document.getElementById('questGoalTab')||{}).textContent||'').trim(), sub: ((document.getElementById('questSub')||{}).textContent||'').trim() }))()`);
    ok(/무늬 육종가/.test(head.tab) && /무늬 육종가/.test(head.sub), '[끝맺음] 할 일 머리 칭호', JSON.stringify(head));
    await shot('breedEnd_quest');
    await roundTrip('breedEnd');
    ok(!(await J(`(()=>window.__byeotShopEnd().open)()`)), '[끝맺음] 다시 켜도 카드가 또 안 뜬다');
    const ne = exc.slice(e0); ok(ne.length === 0, '[끝맺음] 처리 안 된 예외 0', ne.slice(0, 2).join(' / '));
  } else ok(false, '[끝맺음] 전날 세이브가 없다');
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; }
finally { await page.close(); }
console.log(bad ? `probe_breed_walk: FAIL (${bad})` : 'probe_breed_walk: PASS');
process.exit(bad ? 1 : 0);
