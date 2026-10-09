/* tools/probe_day_walk.mjs — **오늘 들어간 것 전부를 한 판으로 걸어 본다**(core · 2026-10-10 · 총괄)
   ------------------------------------------------------------------
   따로 PASS 인 이음들이 이어 붙여도 서는지 본다. 긴 가운데(이사 → 원룸 → 교환 → 500만)는 하네스가 «안내대로» 걷고
   단계마다 게임 세이브로 떠 둔다(probe_branches --dump) — 이 자는 그 세이브를 게임 localStorage 에 싣고 «화면 손»으로 걷는다.
     node tools/probe_branches.mjs --one '{"name":"shop45","seed":"g","targets":[5000000],"days":1200,"dump":"<폴더>"}'
     DUMP=<폴더> node tools/probe_day_walk.mjs        (OUTDIR=… 이면 폰 크기 사진)
   단계(파일 shop45_g_<단계>.json):
     moved  이사 다음 날(원룸)          · trade 핑크프린세스 교환 뒤 · ready 500만 닿음(엔딩 «전»)
     shop30 가게 연 뒤 30일(하네스)
   단계마다: 방이 선다 · 처리 안 된 예외 0 · 할 일 칩 글 · [다음 날] 한 번 · 저장 → 다시 켬 왕복(그 판 그대로)
   ready 는 «다시 켜지 않는» 걸음을 같이 — 할 일 [내 집 마련] → [계약한다] → 장면 → [다음] → 진로 카드 → [가게를 연다]
     → 투룸 가게 방 첫 화면 · 주문판 · 앞치마 · 가게 30일([다음 날] + 주문판 [납품] 단추) · 벽 걸이(가방 → 자리) · 가구점 줄 수
   대사가 지나갈 때마다 장면 그림(__sceneArt)과 배너 카드(.bcard)를 모아 «오늘 그림이 실제로 섰나»를 적는다.
   ⛔ 값을 안 바꾼다(하네스가 세운 판 그대로 · 입간판만 단골 수를 당겨 본다 — 총괄 허락). */
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const DUMP = process.env.DUMP;
const PFX = process.env.PFX || 'shop45_g';
const OUTDIR = process.env.OUTDIR || null; if (OUTDIR) fs.mkdirSync(OUTDIR, { recursive: true });
const SHOP_DAYS = Number(process.env.SHOP_DAYS || 30);
if (!DUMP) { console.error('DUMP=<probe_branches --dump 폴더> 가 필요합니다'); process.exit(2); }
const wd = setTimeout(() => { console.error('⏱ 자가 제한(60분)'); process.exit(2); }, 3600000); wd.unref && wd.unref();

const rows = [];   /* 깨진 곳 표 */
let bad = 0;
const ok = (c, m, extra) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) bad++; return c; };
const broke = (stage, what, got, want, sev) => rows.push({ stage, what, got, want, sev });

const page = await launch();
const exc = [], errs = [];
page.on((method, p) => {
  if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200));
  if (method === 'Runtime.consoleAPICalled' && p.type === 'error') errs.push((p.args || []).map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
});
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js, ms = 180000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
const shot = async n => { if (OUTDIR) await page.shot(`${OUTDIR}/${n}.png`); };
const arts = new Map(), cards = new Map();
const note = (m, k) => m.set(k, (m.get(k) || 0) + 1);
/* 대사를 한 줄씩 넘기며 장면 그림·배너 카드를 모은다 */
const talk = async (max = 80) => {
  for (let i = 0; i < max; i++) {
    const t = await J(`(()=>({ on: document.getElementById('stage').classList.contains('talking'), art: (window.__sceneArt && window.__sceneArt()) || null,
      card: (document.querySelector('#event.on img.bcard') || {}).getAttribute ? document.querySelector('#event.on img.bcard').getAttribute('src') : null,
      face: (document.getElementById('dlgFace') || {}).style ? document.getElementById('dlgFace').style.backgroundImage : '' }))()`);
    if (t.art && t.art.on && t.art.src) note(arts, t.art.src.replace(/^.*\//, ''));
    if (t.card) note(cards, t.card.replace(/^.*\//, ''));
    if (t.face && /_apron\.png/.test(t.face)) note(arts, '(앞치마 낯)');
    if (!t.on) return i;
    await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(160);
  }
  return max;
};
const digest = `(()=>{ const S=window.__S(); return { day:S.day, room:S.home.room, cash:S.tutorial.cashWon, job:S.story.job && S.story.job.id,
  sp:((S.species && S.species.pots) || []).length, cuts:(S.cuttings || []).length, pots:(S.pots || []).length, added:(S.home.furnitureAdded || []).length,
  regulars:S.jobShop ? S.jobShop.regulars.length : null, orders:S.jobShop ? S.jobShop.orders.length : null, done:S.jobShop ? S.jobShop.done : null }; })()`;
const view = `(()=>({ rv: !!window.__rv, room: window.__rv && window.__rv.roomId, failed: document.getElementById('stage').classList.contains('room-failed'),
  chip: (document.getElementById('questChipText') || {}).textContent || '', quest: ((document.getElementById('quest') || {}).textContent || '').slice(0, 60) }))()`;
const boot = async () => { await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(5000); await talk(); };
const load = async (stage) => {
  const f = path.join(DUMP, `${PFX}_${stage}.json`);
  const text = fs.readFileSync(f, 'utf8');
  await page.goto(`${BASE}/data/balance/homes.json`);   /* 같은 출처의 스크립트 없는 쪽 — 여기서 세이브를 심는다 */
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(text)}); return 1; })()`, false);
  await boot();
};
const nextDay = async () => {
  const d0 = (await J(digest)).day;
  await page.eval(`(()=>{ const n=document.getElementById('mealGo'); if(n) n.click(); })()`, false); await sleep(2500);
  await talk(); await sleep(600);
  return { d0, d1: (await J(digest)).day };
};
/* 공통 — 방 · 예외 · 칩 · 하루 · 저장 왕복 */
const common = async (stage) => {
  const e0 = exc.length;
  const v = await J(view);
  console.log(`[${stage}] 화면 —`, JSON.stringify(v));
  if (!ok(v.rv && !v.failed, `[${stage}] 방이 선다(${v.room})`)) broke(stage, '방', JSON.stringify(v), '방뷰가 선다', '높음');
  if (!ok(!!v.chip || !!v.quest, `[${stage}] 할 일 칩·줄에 글(${v.chip || v.quest})`)) broke(stage, '할 일 칩', '비었다', '지금 할 일 글', '중간');
  const nd = await nextDay();
  if (!ok(nd.d1 === nd.d0 + 1, `[${stage}] [다음 날](${nd.d0} → ${nd.d1})`)) broke(stage, '[다음 날]', `${nd.d0} → ${nd.d1}`, '하루 감', '높음');
  await sleep(1200);   /* saveSoon(400ms) */
  const before = await J(digest);
  await boot();
  const after = await J(digest);
  const same = JSON.stringify(before) === JSON.stringify(after);
  if (!ok(same, `[${stage}] 저장 → 다시 켬 왕복`, same ? '' : JSON.stringify({ before, after }))) broke(stage, '세이브 왕복', JSON.stringify(after), JSON.stringify(before), '높음');
  const ne = exc.slice(e0);
  if (!ok(ne.length === 0, `[${stage}] 처리 안 된 예외 0`, ne.slice(0, 2).join(' / '))) broke(stage, '예외', ne.slice(0, 2).join(' / '), '0', '높음');
  await shot(`${stage}_after_reload`);
  return { v, nd, before, after };
};

try {
  /* ── 이사 다음 날(원룸) ── */
  await load('moved'); await shot('moved_boot');
  await common('moved');
  /* ── PP 교환 뒤 — 교환 대사 새 줄(plan)·장면 그림은 대사 길로 연다 ── */
  await load('trade'); await shot('trade_boot');
  for (const id of ['ppTradeOffer', 'ppTradeDone']) {
    await page.eval(`(()=>window.__dlgOpen([${JSON.stringify(id)}]))()`, false); await sleep(800);
    const lines = await J(`(async()=>{ const seen=[]; for (let i=0;i<8;i++){ const on=document.getElementById('stage').classList.contains('talking'); if(!on) break;
      seen.push({ t:(document.getElementById('dlgText')||{}).textContent||'', art:(window.__sceneArt()||{}).src||null }); document.getElementById('dlgBox').click(); await new Promise(r=>setTimeout(r,250)); } return seen; })()`);
    console.log(`[trade] ${id} —`, JSON.stringify(lines.map(l => l.t.slice(0, 26))));
    for (const l of lines) if (l.art) note(arts, l.art.replace(/^.*\//, ''));
    ok(lines.length > 0, `[trade] ${id} 대사가 선다(${lines.length}줄)`);
  }
  ok(arts.has('ev_pp_trade_offer.png') && arts.has('ev_pp_trade_done.png'), '[trade] 교환 장면 그림 둘(offer · done)');
  await common('trade');
  /* ── 500만 닿음 → 엔딩을 화면 손으로 → 진로 → 가게(다시 켜지 않는 걸음) ── */
  await load('ready'); await shot('ready_boot');
  const r0 = await J(digest);
  await page.eval(`(()=>{ window.__byeotSheet.open('quest'); })()`, false); await sleep(900);
  const ask = await J(`(()=>{ const b=document.querySelector('[data-act="homeAsk"]'); return { has: !!b, off: b ? b.disabled : null, text: b ? b.textContent : null }; })()`);
  console.log('[ready] 내 집 단추 —', JSON.stringify(ask), JSON.stringify(r0));
  if (!ok(ask.has && !ask.off, `[ready] 할 일에 [내 집 마련] 단추가 켜져 있다(${ask.text})`)) broke('ready', '내 집 단추', JSON.stringify(ask), '켜짐(현금 500만 이상)', '높음');
  await shot('ready_quest');
  await page.eval(`(()=>{ const b=document.querySelector('[data-act="homeAsk"]'); if (b) b.click(); })()`, false); await sleep(900);
  await page.eval(`(()=>{ const b=document.getElementById('homeGo'); if (b) b.click(); })()`, false); await sleep(1500);
  await talk(120); await sleep(800);
  await page.eval(`(()=>{ const b=document.getElementById('homeNext'); if (b && b.offsetParent) b.click(); })()`, false); await sleep(1500);
  await talk(); await sleep(600);
  const ce = await J(`(()=>({ on: document.getElementById('chapterEnd').classList.contains('on'), cards: [...document.querySelectorAll('#jobCards [data-job]')].map(b=>b.dataset.job),
    art: (()=>{ const i=document.getElementById('chapterEndArt'); return !!(i && i.complete && i.naturalWidth > 0); })() }))()`);
  console.log('[ready] 진로 덮개 —', JSON.stringify(ce));
  await shot('ready_job_cards');
  if (!ok(ce.on && ce.cards.includes('shop'), '[ready] 엔딩 뒤 진로 카드 · [가게를 연다]')) broke('ready', '진로 덮개', JSON.stringify(ce), '덮개 + 가게 카드', '높음');
  ok(ce.art, '[ready] 진로 덮개 그림(ev_first_story_end)');
  await page.eval(`(()=>{ const b=document.querySelector('#jobCards [data-job="shop"]'); if (b) b.click(); })()`, false);
  let st = null;
  for (let i = 0; i < 40; i++) { await sleep(2000); st = await J(view); if (st.rv && st.room === 'tworoom') break; }
  await talk(); await sleep(1500);
  const shop = await J(`(()=>{ const S=window.__S(); const r=document.getElementById('roomCanvas').getBoundingClientRect(); const inC = p => !!p && p.x >= 0 && p.y >= 0 && p.x <= r.width && p.y <= r.height;
    const board=(S.home.furnitureAdded||[]).find(f=>f.preset==='order_board'); const at=u=>window.__rv.screenPosOf(u);
    return { room: S.home.room, hf: !!window.__rv.camera().homeFrame, display: inC(at('tworoom-shop-display')), board: board ? inC(at(board.uid)) : false,
             orders: S.jobShop.orders.length, outfit: window.__rv.heroOutfit ? window.__rv.heroOutfit() : null, sp: ((S.species&&S.species.pots)||[]).length }; })()`);
  console.log('[가게 첫날] —', JSON.stringify(shop), JSON.stringify(st));
  await shot('shop_day0');
  if (!ok(shop.room === 'tworoom' && st && st.rv && !st.failed, '[가게 첫날] 다시 켜지 않고 투룸이 선다')) broke('가게 첫날', '투룸', JSON.stringify(st), '투룸 방뷰', '높음');
  if (!ok(shop.hf && shop.display && shop.board, '[가게 첫날] 첫 화면 = 가게 방(진열대 · 주문판이 화면 안)')) broke('가게 첫날', '가게 방 첫 화면', JSON.stringify(shop), '집 보기 = 가게 방', '중간');
  if (!ok(shop.orders >= 1, `[가게 첫날] 첫 주문(${shop.orders})`)) broke('가게 첫날', '첫 주문', String(shop.orders), '1 이상', '높음');
  ok(shop.outfit === 'apron', `[가게 첫날] 앞치마(${shop.outfit})`);
  console.log(`  · 가진 새 종 ${shop.sp} — ${shop.sp ? '«새 종 0» 줄은 안 서는 것이 맞다(새 두 종 사람)' : '«새 종 0» 줄이 서야 한다'}`);
  /* 칩을 따른다 — 「가방의 식물을 새 집에 놓으세요」: 가방에 든 화분·삽수·새 종을 빈 자리 중 가장 밝은 데에(하네스 손 · 코어 함수) → 하루 → 칩이 가게 줄로 */
  const chip0 = (await J(view)).chip;
  const placed = await J(`(async()=>{ const st=await import('/src/game/state.js'); const SPM=await import('/src/game/species.js'); const pr=await import('/src/game/propagation.js'); const loop=await import('/src/game/loop.js');
    const S=window.__S(), io=window.__io, slots=io.light.room.slots||[], size=io.light.room.size; const sky=io.light.skyFor(S.day,S.sim);
    const occ=()=>new Set([...(S.pots||[]).map(p=>p.slotId), ...(S.cuttings||[]).map(c=>c.slotId), ...SPM.speciesPotsOf(S).map(q=>q.slotId)].filter(Boolean));
    const best=()=>{ const o=occ(); let b=null,bd=-1; for (const sl of slots){ if(o.has(sl.slotId)) continue; let d=-1; try{ d=io.light.dliOfSlot(sl.slotId, loop.lightOptsOf(S, sky)); }catch(e){} if(d>bd){bd=d;b=sl;} } return b; };
    const at=sl=>({ x:sl.x, y:sl.y, z:sl.z, slotId:sl.slotId }); let n=0;
    for (const p of S.pots||[]) if (!p.slotId && !p.at) { const sl=best(); if (sl) { st.setPotAt(S, p.id, at(sl), { slots, size }); n++; } }
    for (const c of S.cuttings||[]) if (c.status!=='dead' && !c.slotId && !c.at) { const sl=best(); if (sl) { try { pr.setCuttingAt ? pr.setCuttingAt(S, c, { x:sl.x,y:sl.y,z:sl.z }, { slots, size }) : (c.slotId=sl.slotId, c.at={x:sl.x,y:sl.y,z:sl.z}); n++; } catch(e) {} } }
    for (const q of SPM.speciesPotsOf(S)) if (!SPM.speciesPlaced(q)) { const sl=best(); if (sl) { SPM.setSpeciesAt(S, q.id, { slotId: sl.slotId, at: { x:sl.x,y:sl.y,z:sl.z } }); n++; } }
    window.__redraw(); return { n }; })()`);
  await nextDay();
  const chip1 = (await J(view)).chip;
  console.log('[가게 첫날] 칩 따르기 —', JSON.stringify({ chip0, placed, chip1 }));
  if (!ok(!/가방|놓으세요/.test(chip1), `[가게] 칩을 따라 놓으면 다음 칩으로 넘어간다(${chip0} → ${chip1})`)) broke('가게', '할 일 칩', chip1, '가방 줄이 끝나고 가게 줄로', '중간');
  /* 가구점 줄 수 · 벽 걸이(가방 → 자리) */
  await page.eval(`(()=>{ window.__byeotSheet.open('shop'); })()`, false); await sleep(1000);
  const furnN = await J(`(()=>{ const m=(document.body.innerText.match(/가구\\s*(\\d+)/)||[])[1]; return m ? +m : null; })()`);
  ok(furnN === 102, `[가게] 가구점 줄 ${furnN}(102 — 벽 걸이 열다섯 포함)`);
  await page.eval(`(()=>{ window.__S().shop.stock.furn_poster_moon = 1; window.__redraw(); })()`, false);
  const hp = await J(`window.__placeFurnStock('furn_poster_moon')`); await sleep(700);
  const pk = await J(`(()=>window.__byeotHang.picking())()`);
  await shot('shop_hang_pick');
  let hung = false;
  if (pk.on && pk.dots.length) { await page.eval(`(()=>document.querySelector('#hangPickDots [data-hang="${pk.dots[0]}"]').click())()`, false); await sleep(2500);
    hung = await J(`(()=>window.__byeotHang.spots().some(s => s.uid && /poster_moon/.test(s.uid)))()`); }
  if (!ok(pk.on && hung, `[가게] 벽 걸이 — 가방 → 걸이 자리(${pk.dots.length}개 중 ${pk.dots[0]}) → 걸림`, JSON.stringify(hp))) broke('가게', '벽 걸이', JSON.stringify({ hp, pk, hung }), '원 → 걸림', '중간');
  const sea = await J(`(()=>{ const S=window.__S(); const s=window.__io.light.skyFor(S.day, S.sim).season; return { s, changed: window.__rv.setSeason(s) }; })()`);
  ok(sea.changed === false, `[가게] 달력 계절 = 게임 계절(${sea.s})`);
  await page.eval(`(()=>{ window.__byeotSheet.close(); })()`, false); await sleep(400);
  /* 가게 30일 — 화면 [다음 날] + 주문판 [납품] 단추(맞는 것이 있으면) */
  const shop0 = await J(digest);
  let delivered = 0;
  for (let d = 0; d < SHOP_DAYS; d++) {
    await nextDay();
    await page.eval(`(()=>{ window.__byeotSheet.open('shop'); })()`, false); await sleep(600);
    for (let k = 0; k < 3; k++) {
      const can = await J(`(()=>{ const b=[...document.querySelectorAll('#orderBoard [data-deliver]')].find(x=>!x.disabled); if (!b) return false; b.click(); return true; })()`);
      if (!can) break;
      await sleep(700);
      const pick = await J(`(()=>{ const b=[...document.querySelectorAll('#dBtns button')].find(x=>/원$/.test(x.textContent)); if (!b) return false; b.click(); return true; })()`);
      if (!pick) { await page.eval(`(()=>{ const b=[...document.querySelectorAll('#dBtns button')].find(x=>/그만두기/.test(x.textContent)); if (b) b.click(); })()`, false); break; }
      await sleep(900); await talk(); delivered++;
      await page.eval(`(()=>{ window.__byeotSheet.open('shop'); })()`, false); await sleep(500);
    }
    await page.eval(`(()=>{ window.__byeotSheet.close(); })()`, false); await sleep(300);
  }
  const shopN = await J(digest);
  console.log('[가게 30일] —', JSON.stringify({ shop0, shopN, delivered }));
  await shot('shop_day30');
  if (!ok(shopN.day === shop0.day + SHOP_DAYS, `[가게 30일] 날이 다 갔다(${shop0.day} → ${shopN.day})`)) broke('가게 30일', '날', `${shop0.day} → ${shopN.day}`, `+${SHOP_DAYS}`, '높음');
  ok(delivered >= 1 && shopN.regulars >= 1, `[가게 30일] 화면 [납품] ${delivered}번 · 단골 ${shopN.regulars}`);
  /* 입간판 — 단골을 10으로 당겨(총괄 허락) 방을 다시 세우면 선다 */
  await page.eval(`(()=>{ const J=window.__S().jobShop; J.signOnDay = window.__S().day; window.__byeotShopView(); })()`, false); await sleep(1500);
  await shot('shop_sign');
  const ex2 = exc.length;
  await common('가게(다시 켜지 않은 걸음 끝)');
  /* ── 하네스 가게 30일 판 ── */
  await load('shop30'); await shot('shop30_boot');
  await common('shop30');
  console.log(`\n대사가 지나며 선 장면 그림: ${[...arts.entries()].map(([k, v]) => `${k}×${v}`).join(' · ') || '없음'}`);
  console.log(`배너 잎 카드: ${[...cards.entries()].map(([k, v]) => `${k}×${v}`).join(' · ') || '없음'}`);
  console.log(`console.error ${errs.length}건${errs.length ? ' — ' + [...new Set(errs)].slice(0, 4).join(' / ') : ''}`);
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; broke('걸음', '탈', e && e.message, '끝까지', '높음'); }
finally { await page.close(); }
console.log('\n■ 깨진 곳 표');
if (!rows.length) console.log('  (없음)');
for (const r of rows) console.log(`  | ${r.stage} | ${r.what} | 실제 ${r.got} | 기대 ${r.want} | ${r.sev} |`);
console.log(bad ? `probe_day_walk: FAIL (${bad})` : 'probe_day_walk: PASS');
process.exit(bad ? 1 : 0);
