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
const SWT = JSON.parse(fs.readFileSync(new URL('../data/balance/career_switch.json', import.meta.url), 'utf8'));   /* 화면 글은 plan 표 그대로 읽는다 — 글이 바뀌어도 자가 낡지 않게 */
const TT = id => SWT.jobs[id].title, MK = (k, id) => SWT.cards.mark[k].replace('{title}', id ? TT(id) : '');
const ROW = (id, k) => [MK(k, k === 'fresh' ? null : id), k === 'current' ? null : k === 'ended' ? SWT.cards.back : SWT.jobs[id].go];
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
let standAt = null;   /* 끝맺음 장면에서 잰 선 자리(talk 가 그 대사에서 채운다) */
const talk = async (want = null, name = null, max = 80) => {
  const lines = []; let shotTaken = false;
  for (let i = 0; i < max; i++) {
    const t = await J(`(()=>({ on: document.getElementById('stage').classList.contains('talking'), text: ((document.getElementById('dlgText') || {}).textContent || '').trim() }))()`);
    if (!t.on) break;
    if (t.text && lines[lines.length - 1] !== t.text) lines.push(t.text);
    if (want && !shotTaken && want.test(t.text)) {
      /* 끝맺음 장면 — 주인공이 비켜서는 걸음이 멎은 뒤(그 자리에서 대사 위) 찍고 같은 자(game.html §endingStandCheck)로 잰다 */
      await sleep(1500);
      /* 비켜서기가 다 끝날 때까지(game.html §endingStandWhenSettled 가 done 을 남긴다 · 걷다 끼면 «걷기 뒤 다시» 한두 번 · 60초까지 —
         칸막이 너머 5.5m 는 진짜로 4초 남짓이지만 헤드리스는 초당 2~3장이라 19초 걸린다) */
      for (let k = 0; k < 240; k++) { const d = await J(`(()=> (window.__byeotEndingStandLast || {}).done || null)()`); if (d) break; await sleep(250); }
      await sleep(600); await shot(name); shotTaken = true;
      standAt = await J(`(()=> window.__byeotEndingStandCheck ? window.__byeotEndingStandCheck() : null)()`);
    }
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
/* 보이는 두 요소가 겹치나 — 사진으로 본 꼴(총괄 · plan 10-24)을 자로: 덮개·끝맺음 카드 단추 × «건너뛰기» 알약 · 옮김 배너 × 할 일 칩 */
const overlapOf = (aSel, bSels) => J(`(()=>{ const vis = e => { if (!e) return null; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null;
    const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
  const a = vis(document.querySelector(${JSON.stringify(aSel)})); if (!a) return { a: false, hit: [] };
  const hit = ${JSON.stringify(bSels)}.filter(sel => { const b = vis(document.querySelector(sel)); return b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; });
  return { a: true, hit }; })()`);
const endingStep = async (stage, kind, want) => {
  const t = await nextDayTalk(want, `${stage}_ending`);
  ok(t.lines.length >= 5, `[${stage}] 끝맺음 장면 대사`, t.lines.slice(0, 3).join(' / '));
  const st = await stand();
  /* 총괄 10-24 MAJOR — 세 끝맺음이 한 규칙: ① 화면 안(양옆 8% 안 · 대사 창 위) ② 대사 창 · 몬이 얼굴 밖 ③ 그루 · 판 · 간판 안 가림 */
  ok(!!standAt && standAt.inView && !standAt.faceOrDlg && standAt.clear >= 12, `[${stage}] 끝맺음 장면 — 주인공이 화면 안 · 얼굴 밖 · 진열대 앞줄을 안 가림`, JSON.stringify({ standAt, st }));
  await sleep(800); await shot(`${stage}_card`);
  const ov = await overlapOf('#dlgSkip', ['#shopEndGo', '#shopEndSwitch']);
  ok(ov.hit.length === 0, `[${stage}] 끝맺음 카드 단추를 «건너뛰기» 알약이 안 덮음`, JSON.stringify(ov));
  return card();
};

try {
  /* ── A 가게 끝맺음 → 돌봄 ── */
  if (!has('end30_pre')) ok(false, '[A] end30_pre 세이브가 없습니다'); else {
    const e0 = exc.length;
    await load('end30_pre'); console.log('[A] 실음 —', JSON.stringify(await J(digest)));
    const c = await endingStep('A', 'shop', /오늘부터 여긴/);
    ok(c.on && c.title === TT('shop') && c.sw && c.swKo === SWT.endCard.switch && c.go === SWT.endCard.stay, '[A] 끝맺음 카드 — 단추 둘', JSON.stringify(c));
    await click('#shopEndSwitch'); await sleep(900);
    const k = await cards(); await shot('A_cards');
    ok(k.on && k.title === SWT.cards.title && !k.art && !k.again && k.look === SWT.cards.close, '[A] 진로 바꾸기 화면', JSON.stringify({ title: k.title, art: k.art, again: k.again, look: k.look }));
    ok(JSON.stringify(k.rows.map(r => [r.mark, r.go])) === JSON.stringify([ROW('shop', 'current'), ROW('care', 'fresh'), ROW('breed', 'fresh')]), '[A] 카드 표 셋', JSON.stringify(k.rows));
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
    ok(h.chips.join(',') === TT('shop') && /식물 돌봄 · 살린 화분/.test(h.text) && !h.sw, '[A] 할 일 머리 — 칭호 칩 · 지금 진로 · «진로 바꾸기» 없음(돌봄 끝맺음 전)', h.text);
    await closeSheet();
    ok(exc.length === e0, '[A] 처리 안 된 예외 0', exc.slice(e0).join(' | '));
    await roundTrip('A');
  }
  /* ── B 돌봄 끝맺음(가게 뒤) → 육종 ── */
  if (!has('careEnd_pre')) ok(false, '[B] careEnd_pre 세이브가 없습니다'); else {
    const e0 = exc.length;
    await load('careEnd_pre'); console.log('[B] 실음 —', JSON.stringify(await J(digest)));
    const c = await endingStep('B', 'care', /오늘부터 여긴/);
    ok(c.on && c.title === TT('care') && c.sw, '[B] 끝맺음 카드 — [다른 진로도 해 본다](육종이 남음)', JSON.stringify(c));
    await click('#shopEndSwitch'); await sleep(900);
    const k = await cards(); await shot('B_cards');
    ok(JSON.stringify(k.rows.map(r => [r.mark, r.go])) === JSON.stringify([ROW('shop', 'ended'), ROW('care', 'current'), ROW('breed', 'fresh')]), '[B] 카드 표 셋', JSON.stringify(k.rows));
    const d0 = await J(digest);
    await click('[data-switchjob="breed"]'); await sleep(1500);
    { const ov = await overlapOf('#event', ['#questChip']); ok(ov.a && ov.hit.length === 0, '[B] 옮김 배너 위에 할 일 칩이 안 겹침', JSON.stringify(ov));
      /* 배너가 꺼지며 0.45초 동안 사라지는 사이에도 칩이 먼저 돌아와 겹치지 않는다(10-24 — 앞 판 사진이 그 틈에 찍혔다) */
      for (let k = 0; k < 40; k++) { if (!(await J(`document.getElementById('event').classList.contains('on')`))) break; await sleep(250); }
      const fade = []; for (const ms of [0, 150, 300, 400]) { if (ms) await sleep(ms - (fade.length ? [0, 150, 300, 400][fade.length - 1] : 0)); fade.push((await overlapOf('#event', ['#questChip'])).hit.length); }
      ok(fade.every(n => n === 0), '[B] 배너가 사라지는 동안에도 할 일 칩이 안 겹침', JSON.stringify(fade)); }
    const t = await talk(/하나 나온 건 우연/, 'B_switched');
    const d1 = await J(digest);
    ok(d1.job === 'breed' && d1.room === d0.room && d1.cash === d0.cash, '[B] 육종으로 옮김 · 이사 없음 · 돈 그대로', JSON.stringify({ d0, d1 }));
    ok(t.lines.some(x => /하나 나온 건 우연/.test(x)) && !t.lines.some(x => /이제부턴 진짜/.test(x)), '[B] 대사 — jobSwitchBreed', t.lines.join(' / '));
    const bn = await boardName(); ok(bn && bn.ko === '메모판', '[B] 창 옆 판 이름 = 메모판', JSON.stringify(bn));
    const h = await head(); await shot('B_head');
    ok(h.chips.join(',') === [TT('shop'), TT('care')].join(',') && /무늬 육종 · 품종 0/.test(h.text) && !h.sw, '[B] 할 일 머리 — 칭호 칩 둘', h.text);
    await closeSheet();
    ok(exc.length === e0, '[B] 처리 안 된 예외 0', exc.slice(e0).join(' | '));
    await roundTrip('B');
  }
  /* ── C 육종 끝맺음(셋째) → 마지막 덮개 → 돌봄으로 돌아감 ── */
  if (!has('breedEnd_pre')) ok(false, '[C] breedEnd_pre 세이브가 없습니다'); else {
    const e0 = exc.length;
    await load('breedEnd_pre'); console.log('[C] 실음 —', JSON.stringify(await J(digest)));
    const c = await endingStep('C', 'breed', /육종가/);
    ok(c.on && c.title === TT('breed') && !c.sw, '[C] 끝맺음 카드 — [다른 진로도 해 본다] 없음(셋 다 해 봄)', JSON.stringify(c));
    await click('#shopEndGo'); await sleep(1200);
    const cv = await cards();
    const ft = await J(`(()=>({ fc: document.documentElement.classList.contains('finalcover'), talking: document.getElementById('stage').classList.contains('talking'), text: (document.getElementById('dlgText')||{}).textContent }))()`);
    await sleep(600); await shot('C_cover');
    ok(cv.on && cv.title === SWT.finalCover.title && cv.sub === SWT.finalCover.sub && cv.art && !cv.again && cv.look === SWT.finalCover.stay, '[C] 마지막 덮개 — 글 · 원화 · [계속 산다] · [처음부터 다시] 없음', JSON.stringify(cv));
    { const ov = await overlapOf('#dlgSkip', ['#chapterLook']); ok(ov.hit.length === 0, '[C] 덮개 [계속 산다]를 «건너뛰기» 알약이 안 덮음(대사 중)', JSON.stringify(ov));
      const ov2 = await overlapOf('#dlgBox', ['#chapterLook']); ok(ov2.hit.length === 0, '[C] 덮개 [계속 산다]를 대사 창이 안 덮음', JSON.stringify(ov2)); }
    const t = await talk();
    ok(ft.fc && t.lines.some(x => /가게도, 돌봄도, 육종도 다 해 봤네/.test(x)) && t.lines.some(x => /물 주는 날은 또 와/.test(x)), '[C] 덮개 위 몬이 두 줄', (ft.text || '') + ' / ' + t.lines.join(' / '));
    await click('#chapterLook'); await sleep(900);
    const d0 = await J(digest);
    ok(d0.cover != null, '[C] 덮개 본 날이 적힘(한 번)', JSON.stringify(d0));
    const h = await head(); await shot('C_head');
    ok(h.chips.join(',') === [TT('breed'), TT('shop'), TT('care')].join(',') && h.sw, '[C] 할 일 머리 — 칭호 셋(지금 진로 먼저) + «진로 바꾸기»', h.text);
    await click('#questGoalTab [data-act="jobSwitch"]'); await sleep(900);
    const k = await cards(); await shot('C_cards');
    ok(JSON.stringify(k.rows.map(r => [r.mark, r.go])) === JSON.stringify([ROW('shop', 'ended'), ROW('care', 'ended'), ROW('breed', 'current')]), '[C] 카드 표 — 셋 다 끝맺음', JSON.stringify(k.rows));
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
