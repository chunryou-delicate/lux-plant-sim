/* tools/probe_switch_walk.mjs — **D 나머지 «진로 바꾸기 · 마지막 덮개»를 게임 화면 손으로 걷는다**(core · 2026-10-24 · 총괄 D85 · plan-career-endings-spec §2 · §11)
   ------------------------------------------------------------------
   하네스 바꾸기 걸음(probe_branches switchW --dump)이 끝맺음 «전날» 세이브를 뜬다. 이 자는 그 세이브를 게임 localStorage 에 싣고 화면 손으로 걷는다(값·깃발을 안 건드린다).
     node tools/probe_branches.mjs --one '{"name":"switchW","seed":"g","targets":[5000000],"days":3200,"dump":"<폴더>"}'
     DUMP=<폴더> OUTDIR=<사진 폴더> BYEOT_URL=http://127.0.0.1:9300 node tools/probe_switch_walk.mjs
   단계:
     A 가게 끝맺음(end30_pre) — 장면(주인공이 앞줄을 안 가림) → 카드 [다른 진로도 해 본다] → 진로 카드(지금 하는 중 · 해 볼 수 있음 둘) → [돌봄을 시작한다] →
       이사 없음 · 맡김판 이름 · 기록 줄(옮김 · 판 그대로 · 손님 이음) · 대사(jobSwitchCare · careOpenKept) · 할 일 머리(칭호 칩 · «진로 바꾸기» 없음)
     B 돌봄 끝맺음(careEnd_pre · 가게 뒤) — 카드 [다른 진로도 해 본다] → 카드(끝맺음 봄 · 지금 하는 중 · 해 볼 수 있음) → [육종을 시작한다] → 메모판 이름 · 기록장
     C 육종 끝맺음(breedEnd_pre · 셋째) — 카드에 [다른 진로도 해 본다] 없음 → [계속 산다] → 마지막 덮개(글 · 원화 · 몬이 두 줄 · [처음부터 다시] 없음) → [계속 산다] →
       할 일 머리 칭호 셋 + «진로 바꾸기» → 카드(셋 다 끝맺음 봄/지금) → 돌봄 [돌아간다] → 돌아옴 한 줄 · 첫날 사건 없음 · 옛 맡김판
   단계마다: 처리 안 된 예외 0 · 저장 → 다시 켬 왕복(진로 · 이력 · 바꾼 자국) */
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const SWT = JSON.parse(fs.readFileSync(new URL('../data/balance/career_switch.json', import.meta.url), 'utf8'));   /* 화면 글은 plan 표 그대로 읽는다 */
const DUMP = process.env.DUMP;
const PFX = process.env.PFX || 'switchW_g';
const OUTDIR = process.env.OUTDIR || null; if (OUTDIR) fs.mkdirSync(OUTDIR, { recursive: true });
if (!DUMP) { console.error('DUMP=<probe_branches switchW --dump 폴더> 가 필요합니다'); process.exit(2); }
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
const click = sel => page.eval(`(()=>{ const x=document.querySelector(${JSON.stringify(sel)}); if (!x) return false; x.click(); return true; })()`, true);
const talk = async (want = null, name = null, max = 80) => {
  const lines = []; let shotTaken = false;
  for (let i = 0; i < max; i++) {
    const t = await J(`(()=>({ on: document.getElementById('stage').classList.contains('talking'), text: ((document.getElementById('dlgText') || {}).textContent || '').trim() }))()`);
    if (!t.on) break;
    if (t.text && lines[lines.length - 1] !== t.text) lines.push(t.text);
    if (want && !shotTaken && want.test(t.text)) { await sleep(3500); await shot(name); shotTaken = true; }
    await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(200);
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
const digest = `(()=>{ const S=window.__S(); return { day:S.day, room:S.home.room, job:S.story.job && S.story.job.id, jobs:JSON.stringify(S.story.jobs||{}), sw:(S.story.jobSwitches||[]).length,
  cover:S.story.finalCoverOn ?? null, cash:S.tutorial.cashWon }; })()`;
const logTail = (n = 14) => J(`(()=>((window.__S().log||[]).slice(-${n}).map(x=>typeof x==='string'?x:(x&&(x.text||x.ko||x.msg))||'')))()`);
const nextDayTalk = async (want, name) => {
  await page.eval(`(()=>{ const n=document.getElementById('mealGo'); if(n) n.click(); })()`, false); await sleep(2500);
  const t = await talk(want, name); await sleep(900);
  return t;
};
const roundTrip = async (stage) => {
  await sleep(1200);
  const before = await J(digest); await boot(); const after = await J(digest);
  ok(JSON.stringify(before) === JSON.stringify(after), `[${stage}] 저장 → 다시 켬 왕복`, JSON.stringify(before) === JSON.stringify(after) ? '' : JSON.stringify({ before, after }));
};
const card = () => J(`(()=>({ on: document.getElementById('shopEndPanel').classList.contains('on'), title: document.getElementById('shopEndTitle').textContent,
  sw: getComputedStyle(document.getElementById('shopEndSwitch')).display !== 'none', swKo: document.getElementById('shopEndSwitch').textContent, go: document.getElementById('shopEndGo').textContent }))()`);
const cards = () => J(`(()=>({ on: document.getElementById('chapterEnd').classList.contains('on'), title: document.getElementById('chapterEndTitle').textContent, sub: document.getElementById('chapterEndSub').textContent,
  rows: [...document.querySelectorAll('#jobCards .job')].map(j => ({ ko: (j.querySelector('b')||{}).textContent, mark: (j.querySelector('i.jmark')||{}).textContent, go: (j.querySelector('button')||{}).textContent || null })),
  look: document.getElementById('chapterLook').textContent, again: getComputedStyle(document.getElementById('chapterAgain')).display !== 'none',
  art: getComputedStyle(document.getElementById('chapterEndArt')).display !== 'none' }))()`);
const head = async () => { await page.eval(`(()=>{ window.__byeotSheet.open('quest'); })()`, false); await sleep(900);
  const h = await J(`(()=>{ const g=document.getElementById('questGoalTab'); return { html: g ? g.innerHTML : '', text: g ? g.textContent.replace(/\\s+/g,' ').trim() : '', chips: g ? [...g.querySelectorAll('.titleChip')].map(x=>x.textContent) : [], sw: !!(g && g.querySelector('[data-act="jobSwitch"]')) }; })()`);
  return h; };
const closeSheet = async () => { await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch(e){} })()`, false); await sleep(400); };
const boardName = () => J(`(()=>{ const f=(window.__rv.furniture()||[]).find(x=>['order_board','care_board','memo_board'].includes(x.preset)); return f ? { preset: f.preset, ko: (window.__byeotBoardKo ? window.__byeotBoardKo(f.preset) : null) } : null; })()`);
const stand = () => J(`(()=> window.__byeotEndingStandLast || null)()`);
const endingStep = async (stage, kind, want) => {
  const t = await nextDayTalk(want, `${stage}_ending`);
  ok(t.lines.length >= 5, `[${stage}] 끝맺음 장면 대사`, t.lines.slice(0, 3).join(' / '));
  const st = await stand(); ok(!!st && (st.moved || st.clear >= 24), `[${stage}] 끝맺음 장면 — 주인공이 진열대 앞줄을 안 가림`, JSON.stringify(st));
  await sleep(800); await shot(`${stage}_card`);
  return card();
};

try {
  /* ── A 가게 끝맺음 → 돌봄 ── */
  if (!has('end30_pre')) ok(false, '[A] end30_pre 세이브가 없습니다'); else {
    const e0 = exc.length;
    await load('end30_pre'); console.log('[A] 실음 —', JSON.stringify(await J(digest)));
    const c = await endingStep('A', 'shop', /오늘부터 여긴/);
    ok(c.on && c.title === '동네 식물 가게' && c.sw && c.swKo === '다른 진로도 해 본다' && c.go === '계속 산다', '[A] 끝맺음 카드 — 단추 둘', JSON.stringify(c));
    await click('#shopEndSwitch'); await sleep(900);
    const k = await cards(); await shot('A_cards');
    ok(k.on && k.title === '진로 바꾸기' && !k.art && !k.again && k.look === SWT.cards.close, '[A] 진로 바꾸기 화면', JSON.stringify({ title: k.title, art: k.art, again: k.again, look: k.look }));
    ok(JSON.stringify(k.rows.map(r => [r.mark, r.go])) === JSON.stringify([['지금 하는 중 · 동네 식물 가게', null], ['해 볼 수 있음', '돌봄을 시작한다'], ['해 볼 수 있음', '육종을 시작한다']]), '[A] 카드 표 셋', JSON.stringify(k.rows));
    const d0 = await J(digest);
    await click('[data-switchjob="care"]'); await sleep(1500);
    const t = await talk(/남의 화분|맡김판으로/, 'A_switched');
    const d1 = await J(digest);
    ok(d1.job === 'care' && d1.room === d0.room && d1.room === 'tworoom' && d1.sw === d0.sw + 1, '[A] 돌봄으로 옮김 · 이사 없음', JSON.stringify({ d0, d1 }));
    ok(d1.cash === d0.cash, '[A] 옮기며 돈이 안 바뀜', `${d0.cash} → ${d1.cash}`);
    ok(t.lines.some(x => /이번엔 다른 걸 해 보자/.test(x)) && t.lines.some(x => /남의 화분이니까/.test(x)) && t.lines.some(x => /창 옆 판을 이제 맡김판으로/.test(x)) && !t.lines.some(x => /이제부턴 진짜/.test(x)),
       '[A] 대사 — jobSwitchCare · careOpenKept · «이제부턴 진짜» 없음', t.lines.join(' / '));
    const lg = await logTail(); ok(lg.some(x => /진로 — 식물 돌봄으로 옮겼습니다/.test(x)) && lg.some(x => /창 옆 판을 이제 맡김판으로 씁니다/.test(x)) && lg.some(x => /단골이 화분을 맡기러 왔다/.test(x)),
       '[A] 기록 줄 — 옮김 · 판 그대로 · 손님 이음', lg.slice(-6).join(' | '));
    const bn = await boardName(); ok(bn && bn.ko === '맡김판', '[A] 창 옆 판 이름 = 맡김판(house boardAs)', JSON.stringify(bn));
    const h = await head(); await shot('A_head');
    ok(h.chips.join(',') === '동네 식물 가게' && /식물 돌봄 · 살린 화분/.test(h.text) && !h.sw, '[A] 할 일 머리 — 칭호 칩 · 지금 진로 · «진로 바꾸기» 없음(돌봄 끝맺음 전)', h.text);
    await closeSheet();
    ok(exc.length === e0, '[A] 처리 안 된 예외 0', exc.slice(e0).join(' | '));
    await roundTrip('A');
  }
  /* ── B 돌봄 끝맺음(가게 뒤) → 육종 ── */
  if (!has('careEnd_pre')) ok(false, '[B] careEnd_pre 세이브가 없습니다'); else {
    const e0 = exc.length;
    await load('careEnd_pre'); console.log('[B] 실음 —', JSON.stringify(await J(digest)));
    const c = await endingStep('B', 'care', /오늘부터 여긴/);
    ok(c.on && c.title === '동네 식물 의사' && c.sw, '[B] 끝맺음 카드 — [다른 진로도 해 본다](육종이 남음)', JSON.stringify(c));
    await click('#shopEndSwitch'); await sleep(900);
    const k = await cards(); await shot('B_cards');
    ok(JSON.stringify(k.rows.map(r => [r.mark, r.go])) === JSON.stringify([['끝맺음 봄 · 동네 식물 가게', '돌아간다'], ['지금 하는 중 · 동네 식물 의사', null], ['해 볼 수 있음', '육종을 시작한다']]), '[B] 카드 표 셋', JSON.stringify(k.rows));
    const d0 = await J(digest);
    await click('[data-switchjob="breed"]'); await sleep(1500);
    const t = await talk(/하나 나온 건 우연/, 'B_switched');
    const d1 = await J(digest);
    ok(d1.job === 'breed' && d1.room === d0.room && d1.cash === d0.cash, '[B] 육종으로 옮김 · 이사 없음 · 돈 그대로', JSON.stringify({ d0, d1 }));
    ok(t.lines.some(x => /하나 나온 건 우연/.test(x)) && !t.lines.some(x => /이제부턴 진짜/.test(x)), '[B] 대사 — jobSwitchBreed', t.lines.join(' / '));
    const bn = await boardName(); ok(bn && bn.ko === '메모판', '[B] 창 옆 판 이름 = 메모판', JSON.stringify(bn));
    const h = await head(); await shot('B_head');
    ok(h.chips.join(',') === '동네 식물 가게,동네 식물 의사' && /무늬 육종 · 품종 0/.test(h.text) && !h.sw, '[B] 할 일 머리 — 칭호 칩 둘', h.text);
    await closeSheet();
    ok(exc.length === e0, '[B] 처리 안 된 예외 0', exc.slice(e0).join(' | '));
    await roundTrip('B');
  }
  /* ── C 육종 끝맺음(셋째) → 마지막 덮개 → 돌봄으로 돌아감 ── */
  if (!has('breedEnd_pre')) ok(false, '[C] breedEnd_pre 세이브가 없습니다'); else {
    const e0 = exc.length;
    await load('breedEnd_pre'); console.log('[C] 실음 —', JSON.stringify(await J(digest)));
    const c = await endingStep('C', 'breed', /육종가/);
    ok(c.on && c.title === '무늬 육종가' && !c.sw, '[C] 끝맺음 카드 — [다른 진로도 해 본다] 없음(셋 다 해 봄)', JSON.stringify(c));
    await click('#shopEndGo'); await sleep(1200);
    const cv = await cards();
    const ft = await J(`(()=>({ fc: document.documentElement.classList.contains('finalcover'), talking: document.getElementById('stage').classList.contains('talking'), text: (document.getElementById('dlgText')||{}).textContent }))()`);
    await sleep(600); await shot('C_cover');
    ok(cv.on && cv.title === '여기까지 — 이 집 이야기' && cv.sub === '동네 식물 가게 · 동네 식물 의사 · 무늬 육종가' && cv.art && !cv.again && cv.look === '계속 산다', '[C] 마지막 덮개 — 글 · 원화 · [계속 산다] · [처음부터 다시] 없음', JSON.stringify(cv));
    const t = await talk();
    ok(ft.fc && t.lines.some(x => /가게도, 돌봄도, 육종도 다 해 봤네/.test(x)) && t.lines.some(x => /물 주는 날은 또 와/.test(x)), '[C] 덮개 위 몬이 두 줄', (ft.text || '') + ' / ' + t.lines.join(' / '));
    await click('#chapterLook'); await sleep(900);
    const d0 = await J(digest);
    ok(d0.cover != null, '[C] 덮개 본 날이 적힘(한 번)', JSON.stringify(d0));
    const h = await head(); await shot('C_head');
    ok(h.chips.join(',') === '무늬 육종가,동네 식물 가게,동네 식물 의사' && h.sw, '[C] 할 일 머리 — 칭호 셋(지금 진로 먼저) + «진로 바꾸기»', h.text);
    await click('#questGoalTab [data-act="jobSwitch"]'); await sleep(900);
    const k = await cards(); await shot('C_cards');
    ok(JSON.stringify(k.rows.map(r => [r.mark, r.go])) === JSON.stringify([['끝맺음 봄 · 동네 식물 가게', '돌아간다'], ['끝맺음 봄 · 동네 식물 의사', '돌아간다'], ['지금 하는 중 · 무늬 육종가', null]]), '[C] 카드 표 — 셋 다 끝맺음', JSON.stringify(k.rows));
    await closeSheet();
    const jc0 = await J(`(()=>{ const J=window.__S().jobCare; return { saved: J.saved, seq: J.seq, opened: J.openedOn }; })()`);
    await click('[data-switchjob="care"]'); await sleep(1500);
    const tb = await talk(/하던 데서 이어서/, 'C_back');
    const d1 = await J(digest), jc1 = await J(`(()=>{ const J=window.__S().jobCare; return { saved: J.saved, seq: J.seq, opened: J.openedOn }; })()`);
    ok(d1.job === 'care' && d1.room === d0.room && d1.cash === d0.cash, '[C] 돌봄으로 돌아감 · 이사 없음 · 돈 그대로', JSON.stringify({ d0, d1 }));
    ok(tb.lines.some(x => /하던 데서 이어서/.test(x)) && !tb.lines.some(x => /맡김판으로 쓴다|맡김판을 걸었다/.test(x)), '[C] 대사 — jobBack 한 줄 · 첫날 사건 없음', tb.lines.join(' / '));
    ok(JSON.stringify(jc0) === JSON.stringify(jc1), '[C] 돌봄 상태 그대로(살린 수 · 셈 · 연 날)', JSON.stringify({ jc0, jc1 }));
    const lg = await logTail(); ok(lg.some(x => /진로 — 식물 돌봄으로 돌아왔습니다/.test(x)), '[C] 기록 줄 — 돌아옴', lg.slice(-4).join(' | '));
    const bn = await boardName(); ok(bn && bn.ko === '맡김판', '[C] 창 옆 판 이름 = 맡김판', JSON.stringify(bn));
    ok(exc.length === e0, '[C] 처리 안 된 예외 0', exc.slice(e0).join(' | '));
    await roundTrip('C');
  }
} catch (e) { ok(false, '걸음이 던졌다', String(e && e.stack || e).slice(0, 400)); }
console.log(bad ? `switch_walk: FAIL (${bad})` : 'switch_walk: PASS');
await page.close();
process.exit(bad ? 1 : 0);
