/* tools/probe_species2_walk.mjs — **D71 새 두 종이 들어오는 날을 게임 화면 손으로 걷는다**(core · 2026-10-23 · 총괄 «폰 사진 셋»)
   ------------------------------------------------------------------
   하네스(probe_branches shop71h --dump)가 사건 «전날» 세이브를 뜬다(<PFX>_<단계>_pre.json). 이 자는 그 세이브를 게임 localStorage 에 싣고
   [다음 날]을 눌러 그날 대사를 «제 손으로» 보게 한다(세운 손질 없음 — 값·깃발을 안 건드린다).
     node tools/probe_branches.mjs --one '{"name":"shop71h","seed":"g","targets":[5000000],"days":1300,"dump":"<폴더>"}'
     DUMP=<폴더> OUTDIR=<사진 폴더> BYEOT_URL=http://127.0.0.1:9300 node tools/probe_species2_walk.mjs
   단계:
     sc5     단골 5 — sc_ask 대사(찾는 손님 · 몬이) · 상점에 «스킨답서스 줄기 삽수» · 가구점에 벽 화분걸이
     ca8     단골 8 — ca_care 대사 · 가방에 «칼라테아»(맡은 그루 · 잎 말림) · 그루 카드 «맡음» 줄 · 곁줄 ca_unfurl 열림
     caSaved 잎이 다 펴진 날 — ca_saved 대사 · 맡음이 걷힘(가게 것) · 곁줄 ca_unfurl 끝
   단계마다: 방이 선다 · 처리 안 된 예외 0 · 하루 감 · 저장 → 다시 켬 왕복(그 판 그대로) */
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const DUMP = process.env.DUMP;
const PFX = process.env.PFX || 'shop71h_g';
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
const load = async (stage) => {
  const text = fs.readFileSync(path.join(DUMP, `${PFX}_${stage}.json`), 'utf8');
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(text)}); return 1; })()`, false);
  await boot();
};
const digest = `(()=>{ const S=window.__S(); const J=S.jobShop||{}; return { day:S.day, room:S.home.room, regulars:(J.regulars||[]).length, scAskOn:J.scAskOn??null, caCareOn:J.caCareOn??null, caPotId:J.caPotId??null, caSavedOn:J.caSavedOn??null,
  sp:((S.species&&S.species.pots)||[]).map(q=>q.species+(q.care?'*':'')+(q.slotId||q.at?'@':'')).join(','), cash:S.tutorial.cashWon }; })()`;
const view = `(()=>({ rv: !!window.__rv, room: window.__rv && window.__rv.roomId, failed: document.getElementById('stage').classList.contains('room-failed') }))()`;
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
/* 곁줄 열림·끝 — quest.js 는 «하루에 새로 여는 줄은 하나»라, 다시 켠 판(세이브 실음)에선 이미 열린 곁줄도 그 몫을 다시 받아야 끝을 본다.
     그날 다른 줄이 새로 열리면 하루 밀린다(10-23 caSaved: 같은 날 shop_town 이 열려 ca_unfurl 끝이 이튿날) — 이틀까지 [다음 날]을 더 눌러 본다 */
const questWithin = async (id, key, extra = 2) => {
  for (let k = 0; k <= extra; k++) {
    const q = await quest(id);
    if (key === 'opened' ? q.opened != null : q.done) return { ...q, lateDays: k };
    if (k < extra) await nextDayTalk(null, null);
  }
  return { ...(await quest(id)), lateDays: null };
};
const quest = (id) => J(`(()=>{ const st=window.__S().stamina||{}; return { opened: (st.questsOpenedOn||{})[${JSON.stringify(id)}] ?? null, done: (st.questsTaken||[]).includes(${JSON.stringify(id)}) }; })()`);

try {
  /* ── sc5 · 단골 5 ── */
  { const e0 = exc.length;
    await load('sc5_pre');
    const v = await J(view), d = await J(digest);
    console.log('[sc5] 실음 —', JSON.stringify(v), JSON.stringify(d));
    ok(v.rv && !v.failed && v.room === 'tworoom', `[sc5] 가게 방이 선다(${v.room})`);
    const nd = await nextDayTalk(/늘어지는|스킨답서스|높은 데/, 'sc5_talk');
    console.log('  대사 —', nd.lines.slice(0, 8).join(' / '));
    ok(nd.d1 === nd.d0 + 1, `[sc5] [다음 날](${nd.d0} → ${nd.d1})`);
    const d1 = await J(digest);
    ok(d1.scAskOn === d1.day, `[sc5] sc_ask 가 그날 났다(scAskOn ${d1.scAskOn})`);
    ok(nd.shotTaken, '[sc5] sc_ask 대사(plan scAsk)가 화면에 떴다', nd.lines.slice(0, 4).join(' / '));
    await page.eval(`(()=>{ const b=document.getElementById('navShop'); if(b) b.click(); })()`, false); await sleep(1500);
    const shopTxt = await J(`(()=>((document.getElementById('pageShop')||{}).textContent||''))()`);
    ok(/스킨답서스 줄기 삽수/.test(shopTxt), '[sc5] 상점에 «스킨답서스 줄기 삽수»가 있다');
    await page.eval(`(()=>{ const el=[...document.querySelectorAll('#pageShop *')].filter(x=>x.offsetParent && /스킨답서스 줄기 삽수/.test(x.textContent)).pop(); if(el) el.scrollIntoView({block:'center'}); })()`, false); await sleep(800);
    await shot('sc5_shop');
    const wp = await J(`(async()=>{ const m=await import('/src/game/shop.js'); return m.furnitureCatalogList(window.__S()).some(r=>r.preset==='wall_planter'); })()`);
    ok(wp === true, '[sc5] 가구점에 벽 화분걸이가 뜬다(unlock sc_ask)');
    await roundTrip('sc5');
    const ne = exc.slice(e0); ok(ne.length === 0, '[sc5] 처리 안 된 예외 0', ne.slice(0, 2).join(' / ')); }

  /* ── ca8 · 단골 8 ── */
  { const e0 = exc.length;
    await load('ca8_pre');
    const nd = await nextDayTalk(/칼라테아|말린|너무 밝/, 'ca8_talk');
    console.log('  대사 —', nd.lines.slice(0, 8).join(' / '));
    ok(nd.d1 === nd.d0 + 1, `[ca8] [다음 날](${nd.d0} → ${nd.d1})`);
    const d1 = await J(digest);
    console.log('[ca8] 판 —', JSON.stringify(d1));
    ok(d1.caCareOn === d1.day && !!d1.caPotId, `[ca8] ca_care 가 그날 났다 · 맡은 그루 ${d1.caPotId}`);
    ok(nd.shotTaken, '[ca8] ca_care 대사(plan caCare)가 화면에 떴다', nd.lines.slice(0, 4).join(' / '));
    const q = await questWithin('ca_unfurl', 'opened'); ok(q.opened != null, `[ca8] 곁줄 ca_unfurl 열림(${JSON.stringify(q)})`, q.lateDays ? `${q.lateDays}일 밀림(다시 켠 판 · 하루 한 줄)` : '');
    await page.eval(`(()=>{ const b=document.getElementById('openBag'); if(b) b.click(); })()`, false); await sleep(1500);
    const bagTxt = await J(`(()=>((document.getElementById('bagGrid')||{}).textContent||''))()`);
    ok(/칼라테아/.test(bagTxt), '[ca8] 가방에 «칼라테아»');
    await shot('ca8_bag');
    await page.eval(`(()=>window.__detailOpen('species', { id: ${JSON.stringify(d1.caPotId)} }))()`, false); await sleep(1200);
    const card = await J(`(()=>((document.querySelector('#detail.on .dcard') || {}).textContent || '').slice(0, 2000))()`);
    ok(/맡음/.test(card) && /말린 잎/.test(card), '[ca8] 그루 카드에 «말린 잎» · «맡음» 줄');
    ok(/맡은 칼라테아입니다/.test(card), '[ca8] 맡은 그루는 팔기가 막혔다(까닭 글)');
    await shot('ca8_card');
    await roundTrip('ca8');
    const ne = exc.slice(e0); ok(ne.length === 0, '[ca8] 처리 안 된 예외 0', ne.slice(0, 2).join(' / ')); }

  /* ── caSaved · 잎이 다 펴진 날 ── */
  { const e0 = exc.length;
    await load('caSaved_pre');
    const nd = await nextDayTalk(/다 펴졌|가운데를 찾았|가게에 두라고/, 'caSaved_talk');
    console.log('  대사 —', nd.lines.slice(0, 8).join(' / '));
    ok(nd.d1 === nd.d0 + 1, `[caSaved] [다음 날](${nd.d0} → ${nd.d1})`);
    const d1 = await J(digest);
    console.log('[caSaved] 판 —', JSON.stringify(d1));
    ok(d1.caSavedOn === d1.day, `[caSaved] ca_saved 가 그날 났다(${d1.caSavedOn})`);
    ok(nd.shotTaken, '[caSaved] ca_saved 대사(plan caSaved)가 화면에 떴다', nd.lines.slice(0, 4).join(' / '));
    const q = await questWithin('ca_unfurl', 'done'); ok(q.done, `[caSaved] 곁줄 ca_unfurl 끝(${JSON.stringify(q)})`, q.lateDays ? `${q.lateDays}일 밀림(다시 켠 판 · 하루 한 줄)` : '');
    await page.eval(`(()=>window.__detailOpen('species', { id: ${JSON.stringify(d1.caPotId)} }))()`, false); await sleep(1200);
    const card = await J(`(()=>((document.querySelector('#detail.on .dcard') || {}).textContent || '').slice(0, 2000))()`);
    ok(!/맡음/.test(card) && !/맡은 칼라테아입니다/.test(card), '[caSaved] 맡음이 걷혔다(가게 것 · 팔 수 있음)');
    await shot('caSaved_card');
    /* 같은 날 스킨답서스(지킴이) — 카드 줄 · 확대(늘어뜨릴 자리 hang) */
    const scId = await J(`(()=>{ const q=(window.__S().species.pots||[]).filter(q=>q.species==='scindapsus'&&(q.slotId||q.at)); return q.length ? q[0].id : null; })()`);
    if (scId) {
      await page.eval(`(()=>window.__detailOpen('species', { id: ${JSON.stringify('__ID__')} }))()`.replace('__ID__', scId), false); await sleep(1000);
      const sc = await J(`(()=>((document.querySelector('#detail.on .dcard') || {}).textContent || '').slice(0, 800))()`);
      ok(/마디/.test(sc) && /줄기/.test(sc), '[caSaved] 스킨답서스 카드 — 마디 · 줄기 길이 줄', sc.replace(/\s+/g, ' ').slice(0, 120));
      await shot('caSaved_sc_card');
      const z = await J(`(()=>{ try { return !!window.__byeotSpeciesZoom && (window.__byeotSpeciesZoom(${JSON.stringify('__ID__')}), true); } catch(e) { return e.message; } })()`.replace('__ID__', scId));
      await sleep(4000); await shot('caSaved_sc_zoom'); console.log('  확대 —', JSON.stringify(z));
      await page.eval(`(()=>{ try { window.__byeotZoom && window.__byeotZoom(false); } catch(e){} const c=document.getElementById('dClose'); if(c) c.click(); })()`, false); await sleep(800);
    } else ok(false, '[caSaved] 놓인 스킨답서스가 없다');
    await roundTrip('caSaved');
    const ne = exc.slice(e0); ok(ne.length === 0, '[caSaved] 처리 안 된 예외 0', ne.slice(0, 2).join(' / ')); }
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; }
finally { await page.close(); }
console.log(bad ? `probe_species2_walk: FAIL (${bad})` : 'probe_species2_walk: PASS');
process.exit(bad ? 1 : 0);
