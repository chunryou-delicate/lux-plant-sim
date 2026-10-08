/* ============================================================
   tools/probe_branches.mjs — **갈래 판** · 사람이 이리 튀고 저리 튀어도 판이 매끄러운가 (2026-10-08 · core)
   ------------------------------------------------------------
   박사님(10-08 13:1x): «모든 것이 다 매끄럽도록. 게임하는 사람이 이리 튈지 저리 튈지 모르니 그것도 생각해서.»
   총괄 13:20 · 12:25(M3 — 원룸에서 자르기를 막는 «실제 말»과 «삽수에서 다시 자르기»가 길이 되나)

     node tools/probe_branches.mjs                       (사람 아홉 × 씨앗 g·1~5 · 4판씩 같이 · g = 게임이 실제로 주는 그루)
     node tools/probe_branches.mjs --persona guide,lazy --seeds 1-10 --jobs 6
     node tools/probe_branches.mjs --targets 5000000,10000000 --days 660
     node tools/probe_branches.mjs --noprologue           (잎 2·3 무늬 보장 끔 — 게임은 켠다 · 견주기용)

   ══ 무엇을 하나 ═══════════════════════════════════════════════════════════
   브라우저 없이(tools/lib/byeot_harness · 진짜 생장 수) 반지하 → 이사 → 원룸 → 엔딩을 «사람 성격 손잡이»대로 하루씩 굴린다.
   손잡이(이름은 plan «갈래 지도»와 맞춘다):
     lamps        0 · 1 · 2          식물등을 몇 개까지 사나(열리면 · 돈 되면)
     siruCap      1 · 2 · 5 · 16     콩나물 시루를 몇 개까지 두나
     cut          none · asap · keep1   안 자름 · 자를 수 있으면 자름(무늬 먼저) · 자르되 모주에 무늬 잎 하나는 남김
     sellMother   never · early      모주를 안 팖 · 시장 문이 열리면(잎 3장) 내놓음
     move         asap · withCuttings   이사 문이 열리면 바로 · 무늬 삽수를 하나 들고 갈 때까지 기다림(60일 넘으면 그냥 감)
     lazy         0 · 1              1 이면 홀수 날엔 아무것도 안 한다([다음 날]만)
     follow       true · false       열린 퀘스트가 말하는 대로 시루를 늘리고(5·8·16) 무순을 들이나(crop_mix 1 · radish5 5)
   날마다 적는 것:
     ★ 막힘 — 퀘스트가 열려 있고 «기다림»(nudge_wait)도 아닌데 14일 넘게 안 풀린 구간(퀘스트 · 시작 날 · 길이)
     첫 0원 · 굶음 · 이사 날 · 엔딩 닿은 날(가정 목표 둘 · --targets · 현금 / 다 팔면)
     ★ 자르기를 막은 말(cutBlockedReason) — 그날 자를 마디 후보 중 «가장 앞» 마디의 말을 날마다 센다(반지하/원룸 따로)
     ★ 삽수에서 다시 자르기(원룸) — 흙에 자리 잡은 삽수에서 잘라 봤나 · 됐나 · 막혔으면 그 말
   ⚠ 이 자의 «사람»은 화면을 안 거친다 — 손가락·대사 차례는 night_play(총괄) 몫. 여기는 «규칙이 길을 막는 날»을 센다.
   ⚠ 값을 하나도 안 바꾼다(월세·목표는 지금 게임 그대로 · 목표만 가정값을 준다 — 엔딩 목표가 아직 null 이라).
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeGrowth, makeSwitchingLight, questSnapshotOf, atOf, RULES, ROOT } from './lib/byeot_harness.mjs';
import { newState, pot0, setPotSlot, resowCrop, waterCrop, waterPot, sellCropSurplus, sellPantryCrop } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { placeBeansprout, moveMonstera, beansproutReady, pantrySaleQuote } from '../src/game/first_play.js';
import { orderItem, stockOf, incomingOf, listCutting, listPot, dealListing, marketStatus, marketGate, listingFor,
         SELLABLE_CUTTING_STATUS } from '../src/game/shop.js';
import { canMoveOut, varieView, buyLamp } from '../src/game/tutorial.js';
import { takeCutting, repotCutting, cuttableNow, cutBudgetOf, motherStatsNow, cuttingsOf, cutBlockedReason,
         cuttingStatsNow, cuttableNodesOfCutting } from '../src/game/propagation.js';
import { lightOptsOf } from '../src/game/loop.js';
import { moveIntoOneroom } from '../src/game/oneroom.js';
import { endingRulesFrom, endingProgress } from '../src/game/ending.js';
import { stepQuests } from '../src/game/quest.js';
import { nudgeWaiting, noteQuestWaits } from '../src/game/nudge_wait.js';
import { grantStaminaQuest } from '../src/game/stamina.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d; };
const list = v => String(v).split(',').map(x => x.trim()).filter(Boolean);
const range = v => list(v).flatMap(t => { const m = t.match(/^(\d+)-(\d+)$/); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : [t === 'g' ? 'g' : Number(t)]; });
/* ★ 씨앗 'g' = **게임이 실제로 주는 판** — 모주 생장 씨앗 92158(plant_grow 기본 · room_view 도 같은 값 · headroom.js §씨앗) · S.sim.seed 0(newState 기본).
     게임은 새 판마다 이 둘을 안 바꾼다 ⇒ 박사님·사람이 받는 그루는 언제나 이 판이다. 숫자 씨앗은 «그루가 달랐다면»(흔들기)이다 */
const GAME_PLANT_SEED = 92158;

/* ══ 사람 — 손잡이 묶음(이름은 plan «갈래 지도»와 맞춘다 · 다르면 이름만 바꾼다) ═══════════════ */
export const PERSONAS = {
  guide:   { ko: '안내대로',          lamps: 1, siruCap: 5,  cut: 'asap',  sellMother: 'never', move: 'asap',         lazy: 0, follow: true },
  nolamp:  { ko: '등 안 삼',          lamps: 0, siruCap: 5,  cut: 'asap',  sellMother: 'never', move: 'asap',         lazy: 0, follow: true },
  tiny:    { ko: '시루 하나',          lamps: 1, siruCap: 1,  cut: 'asap',  sellMother: 'never', move: 'asap',         lazy: 0, follow: false },
  keep1:   { ko: '무늬 하나는 남김',    lamps: 1, siruCap: 5,  cut: 'keep1', sellMother: 'never', move: 'asap',         lazy: 0, follow: true },
  seller:  { ko: '모주 일찍 팖',       lamps: 1, siruCap: 5,  cut: 'asap',  sellMother: 'early', move: 'asap',         lazy: 0, follow: true },
  carrier: { ko: '삽수 들고 이사',      lamps: 1, siruCap: 5,  cut: 'asap',  sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true },
  lazy:    { ko: '게으름(이틀에 한 번)', lamps: 1, siruCap: 5,  cut: 'asap',  sellMother: 'never', move: 'asap',         lazy: 1, follow: true },
  nocut:   { ko: '안 자름',            lamps: 1, siruCap: 5,  cut: 'none',  sellMother: 'never', move: 'asap',         lazy: 0, follow: true },
  big:     { ko: '크게(시루 16 · 등 2)', lamps: 2, siruCap: 16, cut: 'asap',  sellMother: 'never', move: 'asap',         lazy: 0, follow: true }
};
const DARK = 'banjiha-dresser:1', SILL = 'banjiha-sill:0', ONE_SILL = 'oneroom-sill:0', ONE_BRIGHT = ['oneroom-sill:1', 'oneroom-sill:2', 'oneroom-sill:3'];
const STUCK_DAYS = 14;
const PANTRY_KEEP = 10;               /* 남겨 둘 판 수 — night_play KEEP_LOTS 와 같은 손버릇(값 아님) */
const MUSUN_AT = 'banjiha-desk:0';    /* 무순 판 자리 — 반지하 책상(원룸에도 짐으로 같은 이름이 선다) */
const reasonKey = m => String(m || '')
  .replace(/n[\d.]+#\d+/g, '마디').replace(/\d[\d,.]*/g, 'N').replace(/\s+/g, ' ').slice(0, 46);
function pickNode(nodes, budget, varieOnly) {
  const varie = nodes.filter(n => n.variegatedLeaves > 0 && (!budget || n.leaves <= budget.leftLeaves - 1)).sort((a, b) => a.leaves - b.leaves);
  if (varie.length) return varie[0];
  if (varieOnly) return null;
  const one = nodes.filter(n => n.leaves === 1 && (!budget || budget.leftLeaves - 1 >= 1));
  return one.length ? one[0] : null;
}

/* ══ 한 판 ═════════════════════════════════════════════════════════════ */
export async function play(name, seed, opt = {}) {
  const P = PERSONAS[name];
  if (!P) throw new Error('모르는 사람: ' + name);
  const targets = opt.targets || [5_000_000, 10_000_000];
  const maxDays = opt.days || 660;
  const light = makeSwitchingLight('banjiha');
  const io = { light, growth: await makeGrowth(seed === 'g' ? GAME_PLANT_SEED : seed, { prologue: !opt.noprologue }) };
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  S.sim.seed = seed === 'g' ? 0 : seed;
  light.clearCache();
  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });
  const ts = S.tutorial;
  const out = { name, seed, persona: P, moveDay: null, firstBrokeDay: null, starvedDay: null, endDay: null,
                reach: Object.fromEntries(targets.map(t => [t, null])), reachNet: Object.fromEntries(targets.map(t => [t, null])),
                cuts: { banjiha: 0, oneroom: 0, fromCutting: 0 }, cutWhy: { banjiha: {}, oneroom: {} }, recut: { tried: 0, ok: 0, why: {} },
                stuck: [], questDone: {}, questOpen: {}, sold: { varie: 0, plain: 0, pot: 0 }, cashAt: {},
                varieDay: null, moneyDay: null, leafAt: {}, cashDaily: [], rootBands: {} };
  /* cashDaily[i] = i+1 일 끝의 지갑(총괄 봇 기록 days[].cash 와 대 보기) · rootBands = 뿌리내린 무늬 삽수의 빛 띠(반지하/원룸) */   /* leafAt[날] = [잎 · 무늬 잎 · 무늬이면서 다 자란 잎 · 유효 생장일] (30일마다) */   /* 이사 두 축이 처음 선 날(canMoveOut · 무늬 잎을 낸 적 · 이사 자금) */
  const qOpen = new Map();          // id → { since, run }
  const seenRoot = new Set();       // 뿌리내림을 이미 센 삽수 id
  /* 원룸 삽수 자리 — 안내대로(follow)는 «오늘 그 자리의 빛»을 재어 가장 밝은 빈 창턱을 고른다(퀘스트 «밝은 자리에서 뿌리내리세요»를 따르는 손).
     안 따르는 사람은 예전대로 ONE_BRIGHT 앞에서부터. 모주 자리(ONE_SILL)는 비운 자리로 안 본다 */
  const brightestFree = live => {
    const free = ONE_BRIGHT.filter(id => !live.some(c => c && c.slotId === id));
    if (!free.length) return ONE_BRIGHT[0];
    if (!P.follow) return free[0];
    let sky = null; try { sky = light.skyFor(S.day, S.sim); } catch { }
    const dl = id => { try { return light.dliOfSlot(id, lightOptsOf(S, sky)); } catch { return -1; } };
    return free.slice().sort((a, b) => dl(b) - dl(a))[0];
  };
  const eRules = endingRulesFrom({ targetWon: 1e12 });
  let meals = [];
  let followSiru = 0;               /* 안내를 따른 시루 목표(한 번 오르면 안 내린다) */
  for (let d = 1; d <= maxDays; d++) {
    const moved = !!ts.movedOut;
    const rest = P.lazy && (d % 2 === 1);
    if (!rest) { try { waterPot(S); } catch { } }
    let turn = null;
    try { turn = nextDay(S, io).turn; } catch (e) { out.crash = (e && e.message) || String(e); break; }
    meals = ((turn && turn.firstPlayEvent && turn.firstPlayEvent.portions) || []).map(p => p && p.kind).filter(Boolean);
    try { if (S.pots && S.pots.length) marketGate(S, { leaves: io.growth.leafStats().leaves }); } catch { }
    if (!rest) {
      /* ── 작물 ── 안내를 따르는 사람은 열린 퀘스트가 말하는 시루 수를 맞춘다(5·8·16) · 무순도 들인다(crop_mix 1 · radish5 5) */
      const stm = S.stamina || {}, openQ = id => (stm.questsOpenedOn || {})[id] != null, doneQ = id => (stm.questsTaken || []).includes(id);
      if (P.follow) { for (const [id, n] of [['siru5_cycle5', 5], ['siru8', 8], ['siru16', 16]]) if (openQ(id) || doneQ(id)) followSiru = Math.max(followSiru, n); }
      const b = S.firstPlay.beansprout, want = Math.max(P.siruCap, followSiru);
      /* ★ 2026-10-08 (총괄 13:55) — 안내를 따르는 사람의 손버릇은 night_play guided 와 같게: 시루는 «시키는 수 > 놓인 수 · 재고 0 · 오는 중 0»일 때 하루 하나 ·
           씨앗은 놓인 시루 수만큼. 열리자마자 다 사들이면 사람보다 가난한 판이 된다(첫 판 d60 364,830 ↔ 봇 d45 741,666) */
      if (P.follow) {
        if (want > b.sirus && stockOf(S, 'siru') === 0 && incomingOf(S, 'siru') === 0) { try { orderItem(S, 'siru', 1); } catch { } }
      } else {
        const needSiru = want - b.sirus - stockOf(S, 'siru') - incomingOf(S, 'siru');
        if (needSiru > 0) { try { orderItem(S, 'siru', needSiru); } catch { } }
      }
      const target = Math.min(want, b.sirus + stockOf(S, 'siru'));
      const needSeed = (P.follow ? b.sirus : target * 2) - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed');
      if (needSeed > 0) { try { orderItem(S, 'bean_seed', needSeed); } catch { } }
      let hv = null; if (beansproutReady(S.firstPlay)) { try { hv = harvestCrop(S, io); } catch { } }
      if (hv && hv.arrived) { setPotSlot(S, pot0(S), SILL, light.room.slots); moveMonstera(S.firstPlay, SILL, { slots: light.room.slots }); }
      try { resowCrop(S, { sirus: target, at: moved ? 'banjiha-dresser:1' : DARK, slots: light.room.slots }); } catch { }
      try { waterCrop(S, { all: true }); } catch { }
      if (P.follow && (openQ('crop_mix') || openQ('radish5'))) {
        const mw = (openQ('radish5') || doneQ('radish5')) ? 5 : 1;
        const site = (S.firstPlay.crops || []).find(x => x && x.kind === 'musun');
        const have = site ? (site.pots || []).length : 0;
        if (mw > have && stockOf(S, 'sprout_tray') === 0 && incomingOf(S, 'sprout_tray') === 0) { try { orderItem(S, 'sprout_tray', 1); } catch { } }   /* 하루 하나 */
        const needRad = Math.max(1, have) - stockOf(S, 'radish_seed') - incomingOf(S, 'radish_seed');   /* 씨앗은 놓인 판 수만큼 */
        if (needRad > 0) { try { orderItem(S, 'radish_seed', needRad); } catch { } }
        const mt = Math.min(mw, have + stockOf(S, 'sprout_tray'));
        if (mt > 0) { try { resowCrop(S, { kind: 'musun', sirus: mt, at: MUSUN_AT, slots: light.room.slots }); } catch { } }
        try { waterCrop(S, { kind: 'musun', all: true }); } catch { }
      }
      if (!P.follow || S.day % 5 === 0) { try { sellCropSurplus(S); } catch { } }   /* 안내대로는 닷새마다 남는 채소를 판다(night_play 와 같게) */
      /* ★ 보유 채소 팔기 — night_play §sellSurplus 손버릇: 닷새마다 · 이레치 밥값(10판)은 남기고 나머지를 판다(값은 안 건드린다) */
      if (P.follow && S.day % 5 === 0) {
        try { const q = pantrySaleQuote(S.firstPlay, 0); const n = (q && q.maxLots || 0) - PANTRY_KEEP;
              if (n > 0) { const r = sellPantryCrop(S, n); out.pantrySoldWon = (out.pantrySoldWon || 0) + ((r && r.won) || 0); } } catch { }
      }
      /* ── 등 ── */
      if (P.lamps >= 1 && ts.lamp.unlocked && (ts.lamp.owned || 0) < P.lamps && ts.cashWon >= (ts.rules.lampPriceWon || 0)) {
        try { buyLamp(ts); S.lamps.count = ts.lamp.owned; if (ts.lamp) ts.lamp.placed = ts.lamp.owned; light.clearCache(); } catch { }
      }
    }
    /* ── 자르기(막은 말은 쉬는 날에도 센다 — 규칙이 막는지가 물음이다) ── */
    if (pot0(S)) {
      let v = null;
      try { const vv = varieView(S, { nodes: io.growth.cuttableNodes(), stats: io.growth.leafStats() });
            v = { nodes: cuttableNow(S, vv.nodes || []), all: vv.nodes || [], stats: motherStatsNow(S, vv.stats), budget: cutBudgetOf(S, vv.nodes || []) }; } catch { v = null; }
      let vm = null; try { const ls = io.growth.leafState(); vm = Array.isArray(ls) ? ls.filter(r => r && r.varie && r.matured && !r.dropped).length : null;
                           if (S.day % 30 === 0 && Array.isArray(ls)) { const on = ls.filter(r => r && !r.dropped);
                             out.leafAt[S.day] = [on.length, on.filter(r => r.varie).length, vm, (() => { try { return Math.round(io.growth.growthDays()); } catch { return null; } })()]; } } catch { }
      const room = moved ? 'oneroom' : 'banjiha';
      if (v) {
        const cand = v.nodes.length ? v.nodes.slice().sort((a, b) => (b.variegatedLeaves > 0) - (a.variegatedLeaves > 0) || a.leaves - b.leaves)[0] : null;
        let why = '자를 마디 0(총량·잎)';
        if (cand) { try { why = cutBlockedReason(S, v.all, cand.nodeId, { potId: pot0(S).id, varieMaturedLeaves: vm }) || '자를 수 있음'; } catch (e) { why = (e && e.message) || '알 수 없음'; } }
        const k = reasonKey(why); out.cutWhy[room][k] = (out.cutWhy[room][k] || 0) + 1;
        if (!rest && P.cut !== 'none') {
          if (stockOf(S, 'jar') + incomingOf(S, 'jar') < 1) { try { orderItem(S, 'jar', 1); } catch { } }
          if (stockOf(S, 'pot') + incomingOf(S, 'pot') < 1) { try { orderItem(S, 'pot', 1); } catch { } }
          let node = pickNode(v.nodes, v.budget, false);
          if (node && P.cut === 'keep1' && node.variegatedLeaves > 0 && ((v.stats && v.stats.variegatedLeaves) || 0) - node.variegatedLeaves < 1) node = null;
          if (node && stockOf(S, 'jar') >= 1) {
            const live = cuttingsOf(S).filter(c => c.status !== 'dead');
            const slot = moved ? brightestFree(live) : SILL;
            try { takeCutting(S, { nodes: v.nodes, nodeId: node.nodeId, container: 'jar', at: atOf(light, slot), slots: light.room.slots, varieMaturedLeaves: vm }); out.cuts[room]++; } catch { }
          }
        }
      }
    }
    if (!rest) {
      /* ── 원룸: 흙에 자리 잡은 삽수에서 다시 자르기(cutBlockedReason 주석: «삽수에서 다시 자르기는 이 문을 안 탄다») ── */
      if (ts.movedOut && P.cut !== 'none') {
        for (const c of cuttingsOf(S)) {
          if (!c || c.status !== 'established') continue;
          let lv = 0; try { lv = cuttingStatsNow(c).leaves; } catch { }
          if (lv < 2 || stockOf(S, 'jar') < 1) continue;
          out.recut.tried++;
          /* ⚠ 2026-10-08 — nodeId 를 안 넘겨 «모르는 마디: undefined» 로 늘 깨졌다(자의 버그). 삽수 마디는 코어가 자기 잎에서 읽는다(cuttableNodesOfCutting).
               ⚠ 화면(game.html)에는 삽수에서 자르는 단추가 «없다» — 여기 숫자는 «규칙은 되나»이지 «사람이 할 수 있나»가 아니다 */
          const cn = cuttableNodesOfCutting(c), pick = cn.find(n => n.variegatedLeaves > 0) || cn[0];
          if (!pick) { out.recut.why['마디 없음'] = (out.recut.why['마디 없음'] || 0) + 1; break; }
          try { takeCutting(S, { motherCuttingId: c.id, nodes: cn, nodeId: pick.nodeId, container: 'jar', at: atOf(light, brightestFree(cuttingsOf(S).filter(x => x.status !== 'dead'))), slots: light.room.slots }); out.recut.ok++; out.cuts.fromCutting++; }
          catch (e) { const k = reasonKey(e && e.message); out.recut.why[k] = (out.recut.why[k] || 0) + 1; }
          break;
        }
      }
      for (const c of [...cuttingsOf(S)]) if (c.status === 'node' && stockOf(S, 'pot') >= 1) { try { repotCutting(S, c.id); } catch { } }
      /* ── 팔기 ── */
      const keepVarie = !ts.movedOut && P.move === 'withCuttings' && ts.varieSale && ts.varieSale.count >= 1;
      for (const c of [...cuttingsOf(S)]) {
        if (!SELLABLE_CUTTING_STATUS.includes(c.status) || listingFor(S, c)) continue;
        const varie = (c.variegatedLeaves || 0) > 0 || !!c.varieFromCut;
        if (varie && keepVarie) continue;
        try { listCutting(S, c.id); } catch { }
      }
      if (P.sellMother === 'early' && pot0(S) && !listingFor(S, pot0(S))) {
        try { const st = io.growth.leafStats(); if (st.leaves >= 3) listPot(S, { leaves: st.leaves, variegatedLeaves: st.variegatedLeaves }); } catch { }
      }
      for (const l of (() => { try { return marketStatus(S).contacted; } catch { return []; } })()) {
        try { const r = dealListing(S, l.listingId); if (r.kind === 'pot') out.sold.pot++; else if (l.variegatedLeaves > 0) out.sold.varie++; else out.sold.plain++; } catch { }
      }
      /* ── 이사 ── */
      if (!ts.movedOut) { const c = canMoveOut(ts); if (c.varie && out.varieDay == null) out.varieDay = S.day; if (c.money && out.moneyDay == null) out.moneyDay = S.day; }
      if (!ts.movedOut && canMoveOut(ts).ok) {
        const holding = cuttingsOf(S).some(c => c && c.status !== 'dead' && ((c.variegatedLeaves || 0) > 0 || c.varieFromCut));
        const waited = out.moveReadyDay != null && S.day - out.moveReadyDay > 60;
        if (out.moveReadyDay == null) out.moveReadyDay = S.day;
        if (P.move === 'asap' || holding || waited) {
          try {
            moveIntoOneroom(S, io);
            out.moveDay = S.day;
            if (pot0(S)) { try { setPotSlot(S, pot0(S), ONE_SILL, light.room.slots); } catch { } }
            S.lamps.count = ts.lamp.owned || 0; if (ts.lamp) ts.lamp.placed = S.lamps.count; light.clearCache();
          } catch (e) { out.moveErr = (e && e.message) || String(e); }
        }
      }
    }
    /* ── 퀘스트 · 막힘 ── */
    try {
      const snap = questSnapshotOf(S, io, { mealKinds: meals, targetWon: targets[0] });
      const qr = stepQuests(S, snap);
      for (const id of (qr && qr.finished) || []) { try { grantStaminaQuest(S, id); } catch { } }   /* 게임 checkQuests 와 같다 — 끝낸 것은 stamina.questsTaken 이 기억한다 */
      noteQuestWaits(S, S.day);
      const stm = S.stamina || {}, done = new Set(stm.questsTaken || []);
      for (const [id, on] of Object.entries(stm.questsOpenedOn || {})) {
        if (out.questOpen[id] == null) out.questOpen[id] = on;
        if (done.has(id)) { if (out.questDone[id] == null) out.questDone[id] = S.day; qOpen.delete(id); continue; }
        const waiting = (() => { try { return nudgeWaiting(S, id, S.day); } catch { return false; } })();
        const q = qOpen.get(id) || { since: null, run: 0 };
        if (waiting) { if (q.run >= STUCK_DAYS) out.stuck.push({ id, from: q.since, days: q.run, room: ts.movedOut ? 'oneroom' : 'banjiha' }); q.since = null; q.run = 0; }
        else { if (q.since == null) q.since = S.day; q.run++; }
        qOpen.set(id, q);
      }
    } catch (e) { out.questErr = (e && e.message) || String(e); }
    /* ── 살림 · 엔딩 ── */
    const cash = ts.cashWon;
    if (out.firstBrokeDay == null && (ts.bankrupt || cash <= 0)) out.firstBrokeDay = S.day;
    if (ts.starved && out.starvedDay == null) { out.starvedDay = S.day; break; }
    if ([60, 120, 180, 240, 360].includes(S.day)) out.cashAt[S.day] = cash;
    out.cashDaily.push(cash);
    for (const c of cuttingsOf(S)) {
      if (!c || !c.varieFromCut || !Number.isFinite(c.rootedOnDay) || seenRoot.has(c.id)) continue;
      seenRoot.add(c.id); const k = `${ts.movedOut ? 'oneroom' : 'banjiha'}:${c.varieLightBand || '?'}`; out.rootBands[k] = (out.rootBands[k] || 0) + 1;
    }
    if (ts.movedOut) {
      let net = null; try { net = endingProgress(S, io, { rules: eRules, nodes: pot0(S) ? io.growth.cuttableNodes() : null, stats: pot0(S) ? io.growth.leafStats() : null }).netWorthWon; } catch { }
      for (const t of targets) { if (out.reach[t] == null && cash >= t) out.reach[t] = S.day; if (out.reachNet[t] == null && net != null && net >= t) out.reachNet[t] = S.day; }
      if (targets.every(t => out.reach[t] != null)) { out.endDay = S.day; break; }
    }
  }
  /* 끝까지 안 풀린 막힘 */
  for (const [id, q] of qOpen) if (q.run >= STUCK_DAYS) out.stuck.push({ id, from: q.since, days: q.run, room: ts.movedOut ? 'oneroom' : 'banjiha', open: true });
  out.lastDay = S.day; out.cashEnd = ts.cashWon;
  return out;
}

/* ══ 자식 판(--one) ══ */
if (arg('one', null)) {
  const o = JSON.parse(arg('one'));
  const r = await play(o.name, o.seed, o);
  process.stdout.write(JSON.stringify(r) + '\n');
  process.exit(0);
}

/* ══ 여러 판 — node 자식 프로세스로 같이(램 규칙: 크롬 없음) ══ */
const NAMES = arg('persona', null) ? list(arg('persona')) : Object.keys(PERSONAS);
const SEEDS = range(arg('seeds', 'g,1-5'));
const TARGETS = list(arg('targets', '5000000,10000000')).map(Number);
const DAYS = Number(arg('days', 660));
const JOBS = Number(arg('jobs', 4));
const SELF = fileURLToPath(import.meta.url);
const tasks = NAMES.flatMap(name => SEEDS.map(seed => ({ name, seed, targets: TARGETS, days: DAYS, noprologue: !!arg('noprologue', false) })));
const results = [];
let next = 0;
async function worker() {
  while (next < tasks.length) {
    const t = tasks[next++];
    const r = await new Promise(res => {
      const ch = spawn(process.execPath, [SELF, '--one', JSON.stringify(t)], { stdio: ['ignore', 'pipe', 'pipe'] });
      let buf = '', err = '';
      ch.stdout.on('data', d => buf += d); ch.stderr.on('data', d => err += d);
      ch.on('close', () => { try { res(JSON.parse(buf.trim().split('\n').pop())); } catch { res({ ...t, crash: (err || buf).slice(-300) }); } });
    });
    results.push(r);
    process.stderr.write(`  · ${t.name} ${t.seed} — 이사 ${r.moveDay ?? '-'} · 굶음 ${r.starvedDay ?? '-'} · 엔딩 ${r.endDay ?? '-'}\n`);
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: Math.max(1, JOBS) }, worker));
const med = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
/* 90% — 닿은 판 가운데 90% 가 이 날까지 닿았다(못 닿은 판은 안 셈 · 닿은 판 수를 같이 읽을 것) */
const p90 = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1)] : null; };
const won = v => (v == null ? '—' : Math.round(v).toLocaleString());
console.log(`■ 갈래 판 — 사람 ${NAMES.length} × 씨앗 ${SEEDS.length} · 최대 ${DAYS}일 · 목표 가정 ${TARGETS.map(won).join('/')} · ${Math.round((Date.now() - t0) / 1000)}초`);
console.log('  (월세·규칙은 지금 게임 그대로 · 엔딩 목표만 가정값 · 막힘 = 열려 있고 «기다림»도 아닌데 14일 넘게 안 풀린 퀘스트)');
for (const name of NAMES) {
  const rs = results.filter(r => r.name === name);
  const N = rs.length, P = PERSONAS[name];
  const crash = rs.filter(r => r.crash);
  const stuckBy = {}; for (const r of rs) for (const s of (r.stuck || [])) { const k = `${s.id}(${s.room === 'oneroom' ? '원룸' : '반지하'})`; stuckBy[k] = (stuckBy[k] || 0) + 1; }
  const why = room => { const t = {}; for (const r of rs) for (const [k, v] of Object.entries((r.cutWhy || {})[room] || {})) t[k] = (t[k] || 0) + v;
                        const tot = Object.values(t).reduce((a, b) => a + b, 0) || 1;
                        return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${Math.round(v / tot * 100)}%`).join(' · '); };
  const recut = rs.reduce((a, r) => ({ tried: a.tried + ((r.recut || {}).tried || 0), ok: a.ok + ((r.recut || {}).ok || 0) }), { tried: 0, ok: 0 });
  const recutWhy = {}; for (const r of rs) for (const [k, v] of Object.entries((r.recut || {}).why || {})) recutWhy[k] = (recutWhy[k] || 0) + v;
  console.log(`\n■ ${name} · ${P.ko} (등 ${P.lamps} · 시루 ${P.siruCap} · 자르기 ${P.cut} · 모주 ${P.sellMother} · 이사 ${P.move} · 게으름 ${P.lazy})`);
  if (crash.length) console.log(`  ⚠ 깨진 판 ${crash.length}/${N} — ${crash[0].crash}`);
  console.log(`  이사 ${rs.filter(r => r.moveDay != null).length}/${N}(중앙 ${med(rs.map(r => r.moveDay))}일) · 첫 0원 ${rs.filter(r => r.firstBrokeDay != null).length}/${N}(중앙 ${med(rs.map(r => r.firstBrokeDay))}일) · ` +
              `★굶음 ${rs.filter(r => r.starvedDay != null).length}/${N}(중앙 ${med(rs.map(r => r.starvedDay))}일) · 엔딩 둘 다 ${rs.filter(r => r.endDay != null).length}/${N}`);
  /* ★ 총괄 14:25 ③ — D9(엔딩 금액) 판단용: 목표마다 «현금 닿는 날» 중앙·90% 와 «이사 뒤 날수» 중앙·90% */
  for (const t of TARGETS) {
    const hit = rs.filter(r => (r.reach || {})[t] != null);
    const d = hit.map(r => r.reach[t]), after = hit.map(r => r.reach[t] - r.moveDay);
    console.log(`  ◇ ${won(t)} 현금 — ${hit.length}/${N} · 날 중앙 ${med(d) ?? '—'} · 90% ${p90(d) ?? '—'} · 이사 뒤 중앙 ${med(after) ?? '—'} · 90% ${p90(after) ?? '—'}`);
  }
  console.log('  엔딩 닿은 날(현금 · 다 팔면) — ' + TARGETS.map(t => `${won(t)}: ${rs.filter(r => (r.reach || {})[t] != null).length}/${N} 중앙 ${med(rs.map(r => (r.reach || {})[t]))} · 다팔면 ${rs.filter(r => (r.reachNet || {})[t] != null).length}/${N} 중앙 ${med(rs.map(r => (r.reachNet || {})[t]))}`).join(' | '));
  const stay = rs.filter(r => r.moveDay == null && r.starvedDay == null);
  if (stay.length) console.log(`  이사 못 한 판 ${stay.length} — 무늬 잎을 낸 적 없음 ${stay.filter(r => r.varieDay == null).length} · 이사 자금 모자람 ${stay.filter(r => r.moneyDay == null).length}` +
                               ` · (이사한 판의 무늬 첫날 중앙 ${med(rs.filter(r => r.moveDay != null).map(r => r.varieDay))}일)`);
  console.log(`  ★막힘 — ${Object.keys(stuckBy).length ? Object.entries(stuckBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}판`).join(' · ') : '없음'}`);
  console.log(`  자르기 — 반지하 ${rs.reduce((a, r) => a + r.cuts.banjiha, 0)} · 원룸 ${rs.reduce((a, r) => a + r.cuts.oneroom, 0)} · 삽수에서 ${recut.ok}/${recut.tried}` +
              (Object.keys(recutWhy).length ? `(막힘: ${Object.entries(recutWhy).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${v}`).join(' · ')})` : ''));
  console.log(`  ★자르기를 막은 말(날마다 · 가장 앞 마디) — 반지하: ${why('banjiha') || '—'}`);
  console.log(`                                          원룸: ${why('oneroom') || '—'}`);
}
try {
  const f = path.join(ROOT, 'tools', '_out', 'branches.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ args: { NAMES, SEEDS, TARGETS, DAYS }, results }, null, 1));
  console.log(`\n  판별 기록 — ${path.relative(ROOT, f)}`);
} catch (e) { console.log('  ⚠ 기록 파일 —', e.message); }
