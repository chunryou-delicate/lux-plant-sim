/* ============================================================
   tools/probe_branches.mjs — **갈래 판** · 사람이 이리 튀고 저리 튀어도 판이 매끄러운가 (2026-10-08 · core)
   ------------------------------------------------------------
   박사님(10-08 13:1x): «모든 것이 다 매끄럽도록. 게임하는 사람이 이리 튈지 저리 튈지 모르니 그것도 생각해서.»
   총괄 13:20 · 12:25(M3 — 원룸에서 자르기를 막는 «실제 말»과 «삽수에서 다시 자르기»가 길이 되나)

     node tools/probe_branches.mjs                       (사람 아홉 × 씨앗 g·1~5 · 4판씩 같이 · g = 게임이 실제로 주는 그루)
     node tools/probe_branches.mjs --persona guide,lazy --seeds 1-10 --jobs 6
     node tools/probe_branches.mjs --targets 5000000,10000000 --days 660
     node tools/probe_branches.mjs --noprologue           (잎 2·3 무늬 보장 끔 — 게임은 켠다 · 견주기용)
     node tools/probe_branches.mjs --rent 275000          (D8 — 이사하는 순간 원룸 월세 R 을 «짝»으로 꽂는다 · 없으면 게임 그대로(원룸 월세 미정 = 반지하 월세))
     node tools/probe_branches.mjs --boost 2                 (D40 — 삽수 «어린 그루» 무늬 배율을 이 판에서만 바꿔 끼운다 · 상한 0.9 · 1 = 캐논)
     node tools/probe_branches.mjs --grades <varie_grades.json>   (재는 판에서만 무늬 등급 표를 그 파일로 바꿔 끼운다 — 전/후 견주기용 · 게임 값은 안 건드림)
     node tools/probe_branches.mjs --persona guide --seeds g --targets 5000000 --days 1500 --rent 275000 --ledger
                                                           (이사 뒤 30일마다 장부 — 들어온 돈 · 나간 돈 · 판 삽수 · 달말 지갑)

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
     grow         true               원룸에서 처음 뿌리낸 무늬 삽수 하나를 안 팔고 키워 거기서 다시 자른다(«삽수에서 자르기» 단추 · 4e70d1e9)
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
import { makeGrowth, makeSwitchingLight, questSnapshotOf, atOf, RULES, TUT_RULES, ROOT, cutLeafGradesOf, setGrowthTuningPatch } from './lib/byeot_harness.mjs';
import { newState, pot0, setPotSlot, resowCrop, waterCrop, waterPot, sellCropSurplus, sellPantryCrop } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { placeBeansprout, moveMonstera, beansproutReady, pantrySaleQuote } from '../src/game/first_play.js';
import { orderItem, stockOf, incomingOf, listCutting, listPot, dealListing, marketStatus, marketGate, listingFor,
         SELLABLE_CUTTING_STATUS, assignPotLeafGrades, installVarieGrades } from '../src/game/shop.js';
import { canMoveOut, varieView, buyLamp } from '../src/game/tutorial.js';
import { takeCutting, repotCutting, cuttableNow, cutBudgetOf, motherStatsNow, cuttingsOf, cutBlockedReason,
         cuttingStatsNow, cuttableNodesOfCutting, installVarieBoost, setCuttingAt } from '../src/game/propagation.js';
import { lightOptsOf } from '../src/game/loop.js';
import { moveIntoOneroom } from '../src/game/oneroom.js';
import { endingRulesFrom, endingProgress } from '../src/game/ending.js';
import { stepQuests, questView } from '../src/game/quest.js';
import { nudgeWaiting, noteQuestWaits } from '../src/game/nudge_wait.js';
import { grantStaminaQuest } from '../src/game/stamina.js';
/* ★ 2026-10-09 (총괄 · plan 청) — 대사 고르기도 같이 돌린다(화면과 무관한 순수 함수 · game.html §story 와 같은 것) */
import { createStoryteller } from '../src/game/dialogue.js';

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
  big:     { ko: '크게(시루 16 · 등 2)', lamps: 2, siruCap: 16, cut: 'asap',  sellMother: 'never', move: 'asap',         lazy: 0, follow: true },
  /* ★ 2026-10-09 (총괄 11:12 ①) — 원룸에서 처음 뿌리낸 무늬 삽수 하나는 «안 팔고» 키워(혹 → 흙) 거기서 다시 자른다 · 등 1 · 오늘 가장 밝은 빈 창턱 */
  grower:  { ko: '늘리는 사람(삽수 하나 남겨 키움)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'asap', lazy: 0, follow: true, grow: true },
  /* ★ 2026-10-09 (총괄 D40 표) — «D41 안내대로»: 이사 때 무늬 삽수 하나를 들고 가고(D27 말림을 따름 · 삽수 들고 이사와 같은 손) ·
       원룸에서 그 그루(들고 간 것 · 없으면 처음 뿌리낸 무늬 삽수)를 팔지 않고 키워 거기서 다시 자른다 · 나머지는 안내대로 */
  guide41: { ko: 'D41 안내대로(하나 들고 가 키움)', lamps: 1, siruCap: 5, cut: 'asap', sellMother: 'never', move: 'withCuttings', lazy: 0, follow: true, grow: true, carryKeep: true }
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
  /* ★ 2026-10-09 D30 전/후 — 이 판(자식 프로세스)에서만 등급 표를 바꿔 끼운다 */
  if (opt.grades) installVarieGrades(JSON.parse(fs.readFileSync(opt.grades, 'utf8')));
  /* D40 전/후 — 삽수(코어 propagation)와 모주(plant_grow · 하네스가 생장 정본 칸을 덮어씀) 둘 다 같은 배율 */
  if (Number.isFinite(opt.boost)) { const vb = { pre_mature_mult: opt.boost, cap: 0.9 }; installVarieBoost(vb); setGrowthTuningPatch({ varie_boost: vb }); }
  const targets = opt.targets || [5_000_000, 10_000_000];
  const maxDays = opt.days || 660;
  const light = makeSwitchingLight('banjiha');
  const io = { light, growth: await makeGrowth(seed === 'g' ? GAME_PLANT_SEED : seed, { prologue: !opt.noprologue }) };
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES, tutorialRules: TUT_RULES });   /* D8 — 게임과 같은 살림 규칙 */
  S.sim.seed = seed === 'g' ? 0 : seed;
  light.clearCache();
  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });
  const ts = S.tutorial;
  const out = { name, seed, persona: P, moveDay: null, firstBrokeDay: null, starvedDay: null, endDay: null,
                reach: Object.fromEntries(targets.map(t => [t, null])), reachNet: Object.fromEntries(targets.map(t => [t, null])),
                cuts: { banjiha: 0, oneroom: 0, fromCutting: 0 }, cutWhy: { banjiha: {}, oneroom: {} }, recut: { tried: 0, ok: 0, why: {} },
                stuck: [], questDone: {}, questOpen: {}, sold: { varie: 0, plain: 0, pot: 0 }, cashAt: {},
                varieDay: null, moneyDay: null, leafAt: {}, cashDaily: [], rootBands: {},
                rentWon: null, minCashAfterMove: null, firstBrokeAfterMove: null,
                talk: { daysAfterMove: 0, silentAfterMove: 0, longestSilence: 0, linesAfterMove: 0 } };   /* 이사 뒤 말 없는 날 · 최장 침묵(연속) · 줄 수 */
  const story = createStoryteller();
  let silentRun = 0, saidToday = 0;
  /* ★ 2026-10-09 (총괄 · 박사님 «왜 못 닿아? 돈이 안 벌려?») — 이사 뒤 30일마다 장부. 지갑이 움직이는 부름마다 앞뒤 차이를 칸에 적고,
       그날 끝 지갑 − 그날 첫 지갑 − 적은 칸 = «기타»(퀘스트 보상 · 하루 결산 수입 등 칸 없는 것). ⇒ 칸을 다 더하면 달 차이와 꼭 맞는다 */
  let LG = null;   // { start, today } — 이사한 순간부터
  const bucket = () => {
    const i = Math.max(0, Math.floor((S.day - out.moveDay - 1) / 30));
    while (out.ledger.length <= i) out.ledger.push({ m: out.ledger.length + 1, days: 0, varie: 0, mother: 0, plain: 0, veg: 0, other: 0,
                                                     rent: 0, living: 0, power: 0, buy: 0, relief: 0, nVarie: 0, nPlain: 0, endCash: null });
    return out.ledger[i];
  };
  const book = (cat, dw) => { if (!LG || !dw) return; bucket()[cat] += dw; LG.today += dw; };
  const led = (cat, fn) => { const c0 = ts.cashWon; const r = fn(); book(cat, ts.cashWon - c0); return r; };
  const ord = (id, n) => led('buy', () => orderItem(S, id, n));   /* D8 — 원룸 월세 · 이사 뒤 최저 지갑 · 이사 뒤 첫 0원 날 */
  /* cashDaily[i] = i+1 일 끝의 지갑(총괄 봇 기록 days[].cash 와 대 보기) · rootBands = 뿌리내린 무늬 삽수의 빛 띠(반지하/원룸) */   /* leafAt[날] = [잎 · 무늬 잎 · 무늬이면서 다 자란 잎 · 유효 생장일] (30일마다) */   /* 이사 두 축이 처음 선 날(canMoveOut · 무늬 잎을 낸 적 · 이사 자금) */
  const qOpen = new Map();          // id → { since, run }
  const cutKeys = new Set();        // 모주에서 이미 잘려 나간 잎의 열쇠(leafKeys) — 진단용(§ghostCuts)
  const seenBirth = new Set();      // 모주 잎(leafBirth) — 처음 본 날 센다(§leafMonths)
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
    /* ★ 2026-10-09 (D30 «먼저 확인») — 모주 무늬 잎 등급(game.html §noteTurn → noteLeafGrades 와 같게: 이 턴의 밴드로 · 한 번 정하면 안 바뀜).
         ⚠ 예전엔 이 줄이 없어 장부가 비었고 무늬 삽수는 모두 legacy 산반(35만)으로 값이 매겨졌다 — lightGrade 를 바꿔도 이 판은 안 움직였다 */
    if (pot0(S)) { try { assignPotLeafGrades(S, { leafState: io.growth.leafState(), band: (turn && turn.growthSpeed && turn.growthSpeed.band) || null }); } catch { } }
    if (LG) { const t = (turn && turn.tutorial) || {};   /* 하루 결산 — 월세 · 생활비(밥값 − 콩나물로 아낀 것) · 전기 */
              book('rent', -(t.rentWon || 0)); book('power', -(t.electricityWon || 0)); book('living', -((t.spentWon || 0) - (t.electricityWon || 0)));
              /* ⚠ 구호금(tutorial §reliefWon · 처음 0원이 된 그날 한 번)은 결산 «안에서» 지갑을 메운다 — 끝 지갑만 보면 0원이 된 날이 안 보인다 */
              for (const e of t.events || []) if (e && e.id === 'relief') { book('relief', e.won || 0); if (out.firstBrokeAfterMove == null) out.firstBrokeAfterMove = S.day; out.reliefAfterMove = S.day; } }
    /* 하루 대사(game.html: noteQuestWaits → homeTarget → story.turn) — 퀘스트 사건 대사는 아래 §퀘스트 에서 더한다 */
    saidToday = 0;
    let saidIds = [];
    try { noteQuestWaits(S, S.day); turn.homeTarget = targets[0]; saidIds = story.turn(turn, S) || []; saidToday += saidIds.length; } catch { }
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
        if (want > b.sirus && stockOf(S, 'siru') === 0 && incomingOf(S, 'siru') === 0) { try { ord('siru', 1); } catch { } }
      } else {
        const needSiru = want - b.sirus - stockOf(S, 'siru') - incomingOf(S, 'siru');
        if (needSiru > 0) { try { ord('siru', needSiru); } catch { } }
      }
      const target = Math.min(want, b.sirus + stockOf(S, 'siru'));
      const needSeed = (P.follow ? b.sirus : target * 2) - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed');
      if (needSeed > 0) { try { ord('bean_seed', needSeed); } catch { } }
      let hv = null; if (beansproutReady(S.firstPlay)) { try { hv = led('veg', () => harvestCrop(S, io)); } catch { } }
      if (hv && hv.arrived) { setPotSlot(S, pot0(S), SILL, light.room.slots); moveMonstera(S.firstPlay, SILL, { slots: light.room.slots }); }
      try { resowCrop(S, { sirus: target, at: moved ? 'banjiha-dresser:1' : DARK, slots: light.room.slots }); } catch { }
      try { waterCrop(S, { all: true }); } catch { }
      if (P.follow && (openQ('crop_mix') || openQ('radish5'))) {
        const mw = (openQ('radish5') || doneQ('radish5')) ? 5 : 1;
        const site = (S.firstPlay.crops || []).find(x => x && x.kind === 'musun');
        const have = site ? (site.pots || []).length : 0;
        if (mw > have && stockOf(S, 'sprout_tray') === 0 && incomingOf(S, 'sprout_tray') === 0) { try { ord('sprout_tray', 1); } catch { } }   /* 하루 하나 */
        const needRad = Math.max(1, have) - stockOf(S, 'radish_seed') - incomingOf(S, 'radish_seed');   /* 씨앗은 놓인 판 수만큼 */
        if (needRad > 0) { try { ord('radish_seed', needRad); } catch { } }
        const mt = Math.min(mw, have + stockOf(S, 'sprout_tray'));
        if (mt > 0) { try { resowCrop(S, { kind: 'musun', sirus: mt, at: MUSUN_AT, slots: light.room.slots }); } catch { } }
        try { waterCrop(S, { kind: 'musun', all: true }); } catch { }
      }
      if (!P.follow || S.day % 5 === 0) { try { led('veg', () => sellCropSurplus(S)); } catch { } }   /* 안내대로는 닷새마다 남는 채소를 판다(night_play 와 같게) */
      /* ★ 보유 채소 팔기 — night_play §sellSurplus 손버릇: 닷새마다 · 이레치 밥값(10판)은 남기고 나머지를 판다(값은 안 건드린다) */
      if (P.follow && S.day % 5 === 0) {
        try { const q = pantrySaleQuote(S.firstPlay, 0); const n = (q && q.maxLots || 0) - PANTRY_KEEP;
              if (n > 0) { const r = led('veg', () => sellPantryCrop(S, n)); out.pantrySoldWon = (out.pantrySoldWon || 0) + ((r && r.won) || 0); } } catch { }
      }
      /* ── 등 ── */
      if (P.lamps >= 1 && ts.lamp.unlocked && (ts.lamp.owned || 0) < P.lamps && ts.cashWon >= (ts.rules.lampPriceWon || 0)) {
        try { led('buy', () => buyLamp(ts)); S.lamps.count = ts.lamp.owned; if (ts.lamp) ts.lamp.placed = ts.lamp.owned; light.clearCache(); } catch { }
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
          if (stockOf(S, 'jar') + incomingOf(S, 'jar') < 1) { try { ord('jar', 1); } catch { } }
          if (stockOf(S, 'pot') + incomingOf(S, 'pot') < 1) { try { ord('pot', 1); } catch { } }
          let node = pickNode(v.nodes, v.budget, false);
          if (node && P.cut === 'keep1' && node.variegatedLeaves > 0 && ((v.stats && v.stats.variegatedLeaves) || 0) - node.variegatedLeaves < 1) node = null;
          if (node && stockOf(S, 'jar') >= 1) {
            const live = cuttingsOf(S).filter(c => c.status !== 'dead');
            const slot = moved ? brightestFree(live) : SILL;
            /* ⚠⚠ 2026-10-09 자의 구멍 — 예전엔 «거른 목록»(v.nodes = cuttableNow)을 넘겼다. takeCutting 은 넘긴 목록으로 모주 잎 수를 센다
                 (propagation §motherLeavesOf = 가장 큰 마디의 잎 · 거른 목록엔 밑동 마디가 없다) ⇒ 모주 잎 4장이 2장으로 읽혀
                 «잎 2장 중 2장을 이미 잘랐습니다»로 원룸 자르기가 거의 다 던졌고 catch 가 삼켰다(씨앗 g: 원룸 자르기 2번 · 던짐 수백).
                 게임(game.html §doCutFrom)은 growth 가 낸 «전체» 목록을 넘긴다 — 같게 v.all. 던진 말은 셈해 둔다(삼키지 않는다) */
            /* 등급은 화면처럼 모주 장부에서(game.html §cutLeafGradesOf) — 못 읽으면 안 넘긴다(코어가 확정문 §5 로) */
            const lg = (() => { try { return cutLeafGradesOf(pot0(S), v.all.find(x => x.nodeId === node.nodeId)); } catch { return null; } })();
            /* ★ 2026-10-09 진단 — «이미 잘려 나간 잎»(leafKeys)을 싣고 나가는 자르기를 센다. growth 는 자른 것을 모르고(형태 정본 · 잎을 안 지움)
                 cuttableNow 는 자른 «마디 이름»만 빼서, 같은 가지의 위쪽 마디가 이미 판 끝잎을 다시 싣고 잘린다(씨앗 3: 프롤로그 하프문 잎 3번) */
            const carried = (() => { const nn = v.all.find(x => x.nodeId === node.nodeId); return (nn && Array.isArray(nn.leafKeys)) ? nn.leafKeys : null; })();
            const ghost = carried ? carried.filter(k => cutKeys.has(k)).length : 0;
            try { takeCutting(S, { nodes: v.all, nodeId: node.nodeId, container: 'jar', at: atOf(light, slot), slots: light.room.slots, varieMaturedLeaves: vm, ...(lg ? { leafGrades: lg } : {}) }); out.cuts[room]++;
                  if (carried) { if (ghost) { out.ghostCuts = (out.ghostCuts || 0) + 1; out.ghostLeaves = (out.ghostLeaves || 0) + ghost; } for (const k of carried) cutKeys.add(k); } }
            catch (e) { const k = reasonKey(e && e.message); (out.cutThrow = out.cutThrow || {})[k] = (out.cutThrow[k] || 0) + 1; }
          }
        }
      }
    }
    if (!rest && ts.movedOut) {
      /* ★ 2026-10-09 — **가방 삽수(그릇에 담겼는데 자리가 없는 것)를 놓는다.** 이사가 물건 자리를 다 비우고(oneroom §clearPlacements)
           삽수는 회수 대상이 아니라(자리 없는 것은 건너뜀) 들고 간 삽수가 가방에 남는다 — 가방 속 삽수는 하루가 안 간다(D29).
           게임은 «가방에 든 삽수는 하루가 안 가. 방에 놓아 줘.»로 알린다 ⇒ 사람은 놓는다(가장 밝은 빈 창턱).
           ⚠ 예전 갈래 판엔 이 손이 없어 들고 간 삽수가 이사 뒤 영영 멈췄다(«D41 안내대로» 7/10 이 원룸 ② 에 못 감) */
      for (const c of [...cuttingsOf(S)]) {
        if (!c || c.status === 'dead' || c.status === 'bag' || !c.method || c.at || c.slotId) continue;
        const slot = brightestFree(cuttingsOf(S).filter(x => x && x.status !== 'dead'));
        try { setCuttingAt(S, c, atOf(light, slot), { slots: light.room.slots, size: light.room.size }); out.placedFromBag = (out.placedFromBag || 0) + 1; } catch { }
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
      /* 늘리는 사람의 «남긴 삽수» — 원룸에서 처음 뿌리낸 무늬 삽수(죽으면 다음 것으로 갈아 듦)
         ★ 2026-10-09 D41 — 안내대로(follow)는 원룸 «흙에 옮겨 키우기»·«다시 자르기» 줄이 열리면 그 안내를 따라 같은 손을 쓴다 */
      const stmG = S.stamina || {}, openedG = id => (stmG.questsOpenedOn || {})[id] != null;
      const growNow = P.grow || (P.follow && ts.movedOut && (openedG('oneroom_settle_cutting') || openedG('oneroom_recut')));
      if (growNow && ts.movedOut) {
        const k = out.keeperId && cuttingsOf(S).find(c => c && c.id === out.keeperId);
        if (!k || k.status === 'dead') {
          const nk = cuttingsOf(S).find(c => c && c.varieFromCut && c.status !== 'dead' && c.status !== 'rooting' && Number.isFinite(c.rootedOnDay) &&
                                             (P.carryKeep || c.rootedOnDay >= (out.moveDay || 0)) && !listingFor(S, c));   /* D41 안내대로는 들고 간 것도 */
          out.keeperId = nk ? nk.id : null;
          if (nk) out.keepers = (out.keepers || 0) + 1;
        }
      }
      for (const c of [...cuttingsOf(S)]) {
        if (!SELLABLE_CUTTING_STATUS.includes(c.status) || listingFor(S, c)) continue;
        if (growNow && c.id === out.keeperId) continue;
        const varie = (c.variegatedLeaves || 0) > 0 || !!c.varieFromCut;
        if (varie && keepVarie) continue;
        try { listCutting(S, c.id); } catch { }
      }
      if (P.sellMother === 'early' && pot0(S) && !listingFor(S, pot0(S))) {
        try { const st = io.growth.leafStats(); if (st.leaves >= 3) listPot(S, { leaves: st.leaves, variegatedLeaves: st.variegatedLeaves }); } catch { }
      }
      for (const l of (() => { try { return marketStatus(S).contacted; } catch { return []; } })()) {
        /* 팔린 삽수의 잎 등급(팔기 전에 읽는다 — 팔면 목록에서 빠진다) · 무늬 판매 기록(날 · 방 · 값 · 등급) */
        let soldGrades = null;
        try { const c = (S.cuttings || []).find(x => x && x.id === l.refId); if (c && l.kind !== 'pot') soldGrades = (cuttingStatsNow(c).leafGrades || []).filter(Boolean); } catch { }
        try { const c0 = ts.cashWon; const r = dealListing(S, l.listingId), dw = ts.cashWon - c0;
              if (r.kind !== 'pot' && l.variegatedLeaves > 0) (out.varieSales = out.varieSales || []).push({ day: S.day, room: ts.movedOut ? 'oneroom' : 'banjiha', won: dw, grades: soldGrades });
              const cat = r.kind === 'pot' ? 'mother' : (l.variegatedLeaves > 0 ? 'varie' : 'plain');
              if (r.kind === 'pot') out.sold.pot++; else if (l.variegatedLeaves > 0) out.sold.varie++; else out.sold.plain++;
              book(cat, dw); if (LG && cat === 'varie') bucket().nVarie++; if (LG && cat === 'plain') bucket().nPlain++; } catch { }
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
            /* ★ 2026-10-09 D8 — 원룸 월세 후보를 «짝»으로 꽂는다(probe_oneroom_econ §pairRules 그대로 · 월세 밖 하루치는 그대로):
                 oneroomRentWon = R · dailySpendWon = 반지하 dailySpend + (R − 반지하 월세)/주기 */
            if (Number.isFinite(opt.rent)) {
              const base = ts.rules, per = base.rentPeriodDays || 30;
              /* ★ D8 뒤 — 원룸 하루 지출 합(oneroomDailySpendWon)이 있으면 그 칸을 같은 짝 셈으로 옮긴다(반지하 칸은 그대로) */
              ts.rules = Number.isFinite(base.oneroomDailySpendWon)
                ? Object.freeze({ ...base, oneroomRentWon: opt.rent, oneroomDailySpendWon: Math.round(base.oneroomDailySpendWon + (opt.rent - (base.oneroomRentWon ?? base.rentWon)) / per) })
                : Object.freeze({ ...base, oneroomRentWon: opt.rent, dailySpendWon: Math.round(base.dailySpendWon + (opt.rent - base.rentWon) / per) });
            }
            out.rentWon = Number.isFinite(opt.rent) ? opt.rent : null;
            out.ledger = []; LG = { start: ts.cashWon, today: 0 }; out.cashAtMove = ts.cashWon;
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
      try { if (qr && qr.events && qr.events.length) { const q2 = story.events(qr.events) || []; saidToday += q2.length; saidIds = saidIds.concat(q2); } } catch { }
      noteQuestWaits(S, S.day);
      /* ★ 2026-10-09 ([plan] 7d3b2e4f 청) — «지금 할 일» 칩(questView.current · 정의 순서 첫 열린 줄)이 이사 뒤 어느 줄에 며칠 머물렀나 */
      if (ts.movedOut) { try { const cur = questView(S, snap).current; const k = cur ? cur.id : '(없음)'; (out.chipDays = out.chipDays || {})[k] = (out.chipDays[k] || 0) + 1; } catch { } }
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
    if (ts.movedOut) { const g = cuttingsOf(S).filter(c => c && c.status === 'established' && c.varieFromCut && !listingFor(S, c)).length;
                       if (g > (out.grownMax || 0)) out.grownMax = g; }   /* D41 — 원룸에서 키운 무늬 그루(흙에 자리 잡은 · 안 내놓은) 최대 */
    /* ★ 2026-10-09 (총괄 D36 ③) — 원룸에서 «새 잎»이 달마다 몇 장 나나: 모주(leafState 의 새 leafBirth) · 삽수(cutting_leaf 사건) · 그중 무늬 */
    { let ls = null; try { ls = pot0(S) ? io.growth.leafState() : null; } catch { }
      const fresh = (Array.isArray(ls) ? ls : []).filter(r => r && Number.isFinite(r.leafBirth) && !seenBirth.has(r.leafBirth));
      for (const r of fresh) seenBirth.add(r.leafBirth);
      if (ts.movedOut && out.moveDay != null) {
        const i = Math.max(0, Math.floor((S.day - out.moveDay - 1) / 30));
        out.leafMonths = out.leafMonths || [];
        while (out.leafMonths.length <= i) out.leafMonths.push({ mLeaves: 0, mVarie: 0, cLeaves: 0, cVarie: 0, grown: 0 });
        const b = out.leafMonths[i];
        b.grown = cuttingsOf(S).filter(c => c && c.status === 'established' && c.varieFromCut && !listingFor(S, c)).length;   /* 달말 키운 무늬 그루 수 */
        for (const r of fresh) { b.mLeaves++; if (r.varie) b.mVarie++; }
        for (const e of ((turn && turn.cuttings && turn.cuttings.events) || [])) if (e && e.id === 'cutting_leaf') { b.cLeaves++; if (e.variegated) b.cVarie++; }
      } }
    if (LG) { const b = bucket(); const rest0 = cash - LG.start - LG.today; if (rest0) b.other += rest0;
              if (rest0 && (out.otherLog = out.otherLog || []).length < 10)
                out.otherLog.push({ day: S.day, won: rest0, ev: [...new Set([...((turn && turn.events) || []), ...(((turn && turn.tutorial) || {}).events || [])].map(e => e && e.id).filter(Boolean))] });
              b.days++; b.endCash = cash; LG.start = cash; LG.today = 0; }
    if (ts.movedOut) {
      const T = out.talk; T.daysAfterMove++; T.linesAfterMove += saidToday;
      T.ids = T.ids || {}; for (const id of saidIds) T.ids[id] = (T.ids[id] || 0) + 1;
      if (saidToday === 0) { T.silentAfterMove++; silentRun++; if (silentRun > T.longestSilence) T.longestSilence = silentRun; } else silentRun = 0;
    }
    if (ts.movedOut) {
      if (out.minCashAfterMove == null || cash < out.minCashAfterMove) out.minCashAfterMove = cash;
      if (out.firstBrokeAfterMove == null && (ts.bankrupt || cash <= 0)) out.firstBrokeAfterMove = S.day;
    }
    for (const c of cuttingsOf(S)) {
      if (!c || !c.varieFromCut || !Number.isFinite(c.rootedOnDay) || seenRoot.has(c.id)) continue;
      seenRoot.add(c.id); const k = `${ts.movedOut ? 'oneroom' : 'banjiha'}:${c.varieLightBand || '?'}`; out.rootBands[k] = (out.rootBands[k] || 0) + 1;
    }
    if (ts.movedOut) {
      let net = null; try { net = endingProgress(S, io, { rules: eRules, nodes: pot0(S) ? io.growth.cuttableNodes() : null, stats: pot0(S) ? io.growth.leafStats() : null }).netWorthWon; } catch { }
      for (const t of targets) { if (out.reach[t] == null && cash >= t) out.reach[t] = S.day; if (out.reachNet[t] == null && net != null && net >= t) out.reachNet[t] = S.day; }
      if (LG && net != null) bucket().netWorth = net;   /* 장부 — 달말 «다 팔면»(엔딩 netWorth · 모주·삽수 값까지) */
      if (targets.every(t => out.reach[t] != null)) { out.endDay = S.day; break; }
    }
  }
  /* 끝까지 안 풀린 막힘 */
  for (const [id, q] of qOpen) if (q.run >= STUCK_DAYS) out.stuck.push({ id, from: q.since, days: q.run, room: ts.movedOut ? 'oneroom' : 'banjiha', open: true });
  out.lastDay = S.day; out.cashEnd = ts.cashWon;
  out.neighborOrderDay = ts.neighborOrderDay ?? null;   /* D35 반찬가게 주문이 난 날 */
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
const RENT = arg('rent', null) == null ? null : Number(arg('rent'));
const GRADES = arg('grades', null);
const BOOST = arg('boost', null) == null ? null : Number(arg('boost'));
const tasks = NAMES.flatMap(name => SEEDS.map(seed => ({ name, seed, targets: TARGETS, days: DAYS, noprologue: !!arg('noprologue', false),
                                                         ...(Number.isFinite(RENT) ? { rent: RENT } : {}), ...(GRADES ? { grades: GRADES } : {}),
                                                         ...(Number.isFinite(BOOST) ? { boost: BOOST } : {}) })));
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
  /* D8 — 이사 뒤 살림(월세 후보 판정용): 이사 뒤 첫 0원 · 굶음 · 이사 뒤 최저 지갑 중앙 */
  { const mv = rs.filter(r => r.moveDay != null);
    if (mv.length) console.log(`  ▣ 이사 뒤 — 월세 ${won(mv[0].rentWon ?? null)} · 첫 0원 ${mv.filter(r => r.firstBrokeAfterMove != null).length}/${mv.length}` +
                               `(그중 구호금으로 메움 ${mv.filter(r => r.reliefAfterMove != null).length} · 이사 뒤 날 중앙 ${med(mv.filter(r => r.firstBrokeAfterMove != null).map(r => r.firstBrokeAfterMove - r.moveDay)) ?? '—'})` +
                               ` · 굶음 ${mv.filter(r => r.starvedDay != null).length}/${mv.length} · 최저 지갑 중앙 ${won(med(mv.map(r => r.minCashAfterMove)))}` +
                               ` · 제일 낮은 판 ${won(Math.min(...mv.map(r => r.minCashAfterMove ?? Infinity)))}`); }
  /* 대사 — 이사 뒤 말 없는 날(story.turn · 퀘스트 사건 둘 다 빈 날) · 최장 침묵 */
  { const mv = rs.filter(r => r.moveDay != null && r.talk && r.talk.daysAfterMove);
    if (mv.length) console.log(`  ✎ 이사 뒤 대사 — 날 중앙 ${med(mv.map(r => r.talk.daysAfterMove))} · 말 없는 날 중앙 ${med(mv.map(r => r.talk.silentAfterMove))}` +
                               `(${Math.round(100 * med(mv.map(r => r.talk.silentAfterMove / r.talk.daysAfterMove)))}%) · 최장 침묵 중앙 ${med(mv.map(r => r.talk.longestSilence))}일 · 제일 긴 판 ${Math.max(...mv.map(r => r.talk.longestSilence))}일` +
                               ` · 줄 수 중앙 ${med(mv.map(r => r.talk.linesAfterMove))}`);
    const tot = {}; for (const r of mv) for (const [k, v] of Object.entries(r.talk.ids || {})) tot[k] = (tot[k] || 0) + v;
    const top = Object.entries(tot).sort((a, b) => b[1] - a[1]);
    if (top.length) console.log(`    줄 종류 ${top.length} · 판당 자주 나온 줄: ` + top.slice(0, 8).map(([k, v]) => `${k} ${Math.round(v / mv.length)}`).join(' · '));
    /* «지금 할 일» 칩 — 이사 뒤 머문 날(판당) · 원룸 줄이 열린 날(이사 뒤 · 중앙 · 열린 판 수) */
    const chip = {}; for (const r of mv) for (const [k, v] of Object.entries(r.chipDays || {})) chip[k] = (chip[k] || 0) + v;
    const ct = Object.entries(chip).sort((a, b) => b[1] - a[1]);
    if (ct.length) console.log(`    칩(지금 할 일) 이사 뒤 머문 날 · 판당: ` + ct.slice(0, 6).map(([k, v]) => `${k} ${Math.round(v / mv.length)}`).join(' · '));
    const oq = ['oneroom_settle_cutting', 'oneroom_sell', 'oneroom_home_fund'];
    console.log(`    원룸 줄 열린 날(이사 뒤 중앙 · 열린 판) — ` + oq.map(id => { const h = mv.filter(r => (r.questOpen || {})[id] != null);
      return `${id} ${med(h.map(r => r.questOpen[id] - r.moveDay)) ?? '—'}일 ${h.length}/${mv.length}`; }).join(' · ')); }
  /* ★ 무늬 삽수 판매 — 반지하 첫 판매 날 · 원룸 판매 간격(중앙) · 등급 나눔(팔린 삽수의 무늬 잎 등급 · 판 전체 합) */
  { const vs = rs.filter(r => (r.varieSales || []).length);
    const first = vs.map(r => (r.varieSales.find(x => x.room === 'banjiha') || {}).day).filter(x => x != null);
    const gaps = []; for (const r of vs) { const d = r.varieSales.filter(x => x.room === 'oneroom').map(x => x.day); const all = [r.moveDay, ...d];
                                           for (let i = 1; i < all.length; i++) gaps.push(all[i] - all[i - 1]); }
    const gc = {}; let unk = 0; for (const r of vs) for (const x of r.varieSales) { if (!x.grades || !x.grades.length) { unk++; continue; } for (const g of x.grades) gc[g] = (gc[g] || 0) + 1; }
    const n1 = rs.reduce((a, r) => a + (r.varieSales || []).filter(x => x.room === 'oneroom').length, 0);
    console.log(`  ◆ 무늬 삽수 판매 — 반지하 첫 판매 중앙 ${med(first) ?? '—'}일(${first.length}/${N}) · 원룸 판매 판당 ${(n1 / N).toFixed(1)}개 · 간격 중앙 ${med(gaps) ?? '—'}일` +
                ` · 등급(잎) ${Object.entries(gc).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}${unk ? ` · 등급 모름 ${unk}개` : ''}` +
                ` · 값 평균 ${won(Math.round(vs.flatMap(r => r.varieSales.map(x => x.won)).reduce((a, b) => a + b, 0) / Math.max(1, vs.reduce((a, r) => a + r.varieSales.length, 0))))}`); }
  /* ★ 원룸 새 잎 — 달마다(판 평균) · 모주 / 자란 삽수 · 무늬 */
  { const lm = rs.filter(r => (r.leafMonths || []).length);
    if (lm.length) {
      const M = Math.max(...lm.map(r => r.leafMonths.length));
      const cell = (i, k) => { const v = lm.map(r => (r.leafMonths[i] || {})[k]).filter(x => x != null); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length) : null; };
      const f = x => x == null ? '—' : x.toFixed(1);
      const rows = []; for (let i = 0; i < Math.min(M, 24); i++) rows.push(`${i + 1}달 ${f(cell(i, 'mLeaves'))}(${f(cell(i, 'mVarie'))})/${f(cell(i, 'cLeaves'))}(${f(cell(i, 'cVarie'))})`);
      const tot = k => lm.reduce((a, r) => a + r.leafMonths.reduce((x, b) => x + b[k], 0), 0) / lm.reduce((a, r) => a + r.leafMonths.length, 0);
      console.log(`  ✿ 원룸 새 잎 — 한 달 평균: 모주 잎 ${tot('mLeaves').toFixed(2)}장(무늬 ${tot('mVarie').toFixed(2)}) · 자란 삽수 잎 ${tot('cLeaves').toFixed(2)}장(무늬 ${tot('cVarie').toFixed(2)}) · 판 ${lm.length}`);
      console.log(`    달마다 «모주 잎(무늬)/삽수 잎(무늬)»: ` + rows.join(' · '));
    } }
  /* 장부(--ledger) — 판마다 이사 뒤 30일씩 · 단위 만 원 */
  if (arg('ledger', false)) for (const r of rs.filter(x => x.ledger && x.ledger.length)) {
    const m = v => (v / 1e4).toFixed(1).replace(/\.0$/, '');
    const avg = (w, n) => n ? m(w / n) : '—';
    console.log(`  ▤ 장부 — 씨앗 ${r.seed} · 월세 ${won(r.rentWon ?? null)} · 이사 ${r.moveDay}일(지갑 ${m(r.cashAtMove)}만) · 단위 만 원` +
                ` · 5백만 ${(r.reach || {})[5000000] ?? '못 닿음'}일`);
    console.log('    달 | 날 | 무늬삽수 개·평균·합 | 민삽수 개·합 | 모주 | 채소·무순 | 구호금 | 기타(0원 밑 지움) | 월세 | 생활비 | 전기 | 산 것 | 남은 돈 | 달말 지갑 | 다 팔면');
    for (const b of r.ledger) {
      const inn = b.varie + b.mother + b.plain + b.veg + b.relief, outt = b.rent + b.living + b.power + b.buy, net = inn + outt + b.other;
      console.log(`    ${String(b.m).padStart(2)} | ${String(b.days).padStart(2)} | ${b.nVarie}개·${avg(b.varie, b.nVarie)}·${m(b.varie)} | ${b.nPlain}개·${m(b.plain)} | ${m(b.mother)} | ${m(b.veg)} | ${m(b.relief)} | ${m(b.other)}` +
                  ` | ${m(b.rent)} | ${m(b.living)} | ${m(b.power)} | ${m(b.buy)} | ${m(net)} | ${m(b.endCash)} | ${b.netWorth == null ? '—' : m(b.netWorth)}`);
    }
    if (r.otherLog && r.otherLog.length) console.log('    기타 — ' + r.otherLog.map(o => `${o.day}일 ${won(o.won)}(${o.ev.join(',') || '사건 없음'})`).join(' · '));
  }
  const stay = rs.filter(r => r.moveDay == null && r.starvedDay == null);
  { const no = rs.filter(r => r.neighborOrderDay != null); console.log(`  🧺 반찬가게 주문 — ${no.length}/${N}판 · 날 중앙 ${med(no.map(r => r.neighborOrderDay)) ?? '—'}`); }
  { const rc = rs.filter(r => (r.questDone || {}).oneroom_recut != null && r.moveDay != null);
    console.log(`  🌿 키워서 늘리기(D41) — 키운 무늬 그루 최대 중앙 ${med(rs.map(r => r.grownMax || 0))} · oneroom_recut 끝남 ${rc.length}/${N}(이사 뒤 중앙 ${med(rc.map(r => r.questDone.oneroom_recut - r.moveDay)) ?? '—'}일)`); }
  if (stay.length) console.log(`  이사 못 한 판 ${stay.length} — 무늬 잎을 낸 적 없음 ${stay.filter(r => r.varieDay == null).length} · 이사 자금 모자람 ${stay.filter(r => r.moneyDay == null).length}` +
                               ` · (이사한 판의 무늬 첫날 중앙 ${med(rs.filter(r => r.moveDay != null).map(r => r.varieDay))}일)`);
  console.log(`  ★막힘 — ${Object.keys(stuckBy).length ? Object.entries(stuckBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}판`).join(' · ') : '없음'}`);
  console.log(`  ⚠ 이미 자른 잎을 싣고 나간 자르기 — ${rs.reduce((a, r) => a + (r.ghostCuts || 0), 0)}번(잎 ${rs.reduce((a, r) => a + (r.ghostLeaves || 0), 0)}장) · 모주 자르기 ${rs.reduce((a, r) => a + r.cuts.banjiha + r.cuts.oneroom, 0)}번 중`);
  console.log(`  자르기 — 반지하 ${rs.reduce((a, r) => a + r.cuts.banjiha, 0)} · 원룸 ${rs.reduce((a, r) => a + r.cuts.oneroom, 0)} · 삽수에서 ${recut.ok}/${recut.tried}` +
              (Object.keys(recutWhy).length ? `(막힘: ${Object.entries(recutWhy).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${v}`).join(' · ')})` : ''));
  { const t = {}; for (const r of rs) for (const [k, v] of Object.entries(r.cutThrow || {})) t[k] = (t[k] || 0) + v;
    const top = Object.entries(t).sort((a, b) => b[1] - a[1]);
    console.log(`  자르기가 던진 말(고른 마디를 실제로 잘랐을 때) — ${top.length ? top.slice(0, 3).map(([k, v]) => `${k} ${Math.round(v / N)}/판`).join(' · ') : '없음'}`); }
  console.log(`  ★자르기를 막은 말(날마다 · 가장 앞 마디) — 반지하: ${why('banjiha') || '—'}`);
  console.log(`                                          원룸: ${why('oneroom') || '—'}`);
}
try {
  const f = path.join(ROOT, 'tools', '_out', 'branches.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ args: { NAMES, SEEDS, TARGETS, DAYS }, results }, null, 1));
  console.log(`\n  판별 기록 — ${path.relative(ROOT, f)}`);
} catch (e) { console.log('  ⚠ 기록 파일 —', e.message); }
