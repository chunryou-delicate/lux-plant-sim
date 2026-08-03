/* 반지하 세 경로 재현 — "이사 자금을 실제로 모을 수 있나 · 막다른 길이 없나"
 *
 *   node tools/test_banjiha_routes.mjs
 *
 * ★ 설계 정본은 `docs/story_arc.md` §2(세 경로)·`docs/shop.md`(상점·잭팟 역산)다.
 *   박사님 확정(2026-08-03): **이사 자금은 적립이 아니라 무늬 개체 하나를 팔아 만든다.**
 *   콩나물은 그때까지 굶지 않게 버티는 수단이고, 씨앗·용기는 인터넷 주문으로 1~2일 뒤에 온다.
 *
 * ★ 하루 수입을 **주입하지 않는다.** 돈이 들어오는 길은 shop.sellCutting·sellPot 뿐이고,
 *   그 값은 propagation.md §6 의 공식이 정한다. 여기서 숫자를 넣어 주지 않는다.
 *
 * ★ 난수는 **시드로 돌린다.** 무늬는 잎마다 굴리는 확률이라 한 판으로는 아무것도 못 말한다 —
 *   시드 여러 개를 돌려 성공률·중앙값·최악을 같이 낸다(박사님 지시).
 *
 * ⚠ growth 는 브라우저 전용이라 여기서는 대역을 쓴다. **대역이 지어낸 값은 하나도 없다** —
 *   마디 시각은 sale_economy.md §0 의 ageOf 실측표, 무늬 확률은 plant_grow.html 의
 *   calcVarieProb(= varieProb × fLight × fStable)과 data/balance/light_thresholds.json ·
 *   data/growth_tuning.json 의 값을 그대로 옮긴 것이다. 아래 §대역 주석에 출처가 있다.
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { createProfileLight } from '../src/game/room_profile.js';
import { newState, pot0, setPotSlot, resowCrop } from '../src/game/state.js';
import { nextDay } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, moveMonstera } from '../src/game/first_play.js';
import { seasonAt, seasonDayAt, buyLamp, canMoveOut, moveOut } from '../src/game/tutorial.js';
import { orderItem, stockOf, incomingOf, priceOf, varieLeavesNeededFor,
         sellCutting, sellPot, CATALOG, buyPriceOf, shopOf } from '../src/game/shop.js';
import { takeCutting } from '../src/game/propagation.js';

const U = p => new URL(p, import.meta.url);
const J = p => JSON.parse(readFileSync(U(p), 'utf8'));

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
/* ★ WARN — **고장이 아니라 판단 대기**다. 여기 걸리는 것은 코드가 틀린 게 아니라
   기획 수치가 아직 안 맞는 것이라 스위트를 빨갛게 만들지 않는다. 대신 크게 찍는다. */
const warn = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                             catch (e) { results.push(['WARN', name, e.message]); } };
const info = m => results.push(['INFO', '  ' + m]);

const light = createProfileLight(J('../data/profiles/room_profile.banjiha.json'), {
  lightTh: J('../data/balance/light_thresholds.json'),
  weatherBalance: J('../data/balance/weather.json')
});
const RULES = firstPlayRulesFromBalance(J('../data/balance/characters.json'));
const TH = J('../data/balance/light_thresholds.json');
const GT = J('../data/growth_tuning.json');

const DARK = 'banjiha-dresser:1';        // peak DLI 0.04 — 콩나물 자리
const SILL = 'banjiha-sill:0';           // peak DLI 3.77 (등 1개 5.61) — 몬스테라 자리
const MOVE_OUT_WON = 1_500_000;

/* ══ 대역 — 지어낸 값이 없다 ═════════════════════════════════════════════
   ① 마디(잎) 시각 — docs/sale_economy.md §0 이 plant_grow.html 의 ageOf() 곡선을 실측한 표다.
        마디 1 → 11.0 · 2 → 28.9 · 4 → 75.7 · 6 → 133.0 · 12 → 348.3 (유효 생장일)
      그 사이는 선형 보간한다. 도착 개체가 유효 143일이므로 **잎 6장에서 시작**하고,
      다음 잎(7번째)까지 30일 남짓이 걸린다 — "성숙한 모주는 마디 하나에 30~40일"과 맞는다.
   ② 무늬 확률 — plant_grow.html `calcVarieProb` 그대로:
        varieProb(0.20) × fLight(7일평균) × fStable(CV) × fPropagation(1)
      fLight 구간은 growth_tuning.json f_light, 경계는 light_thresholds 의
      best_lo·best_hi × need_mult(1.4) = **7.0 ~ 15.4** 다.
      초보(novice)는 맑음·여름 고정이라 CV≈0 → fStable = mult_stable(1.3).
   ⚠ 이 대역은 **잎이 언제 나고 무늬가 나오나**만 흉내 낸다. 3D·형태는 안 그린다. */
const NODE_TABLE = [[1, 11.0], [2, 28.9], [4, 75.7], [6, 133.0], [12, 348.3]];
function leavesAtGrowth(g) {
  if (g < NODE_TABLE[0][1]) return 0;
  for (let i = NODE_TABLE.length - 1; i >= 0; i--) {
    const [n, t] = NODE_TABLE[i];
    if (g >= t) {
      const nx = NODE_TABLE[i + 1];
      if (!nx) return n + Math.floor((g - t) / 39.6);              // 마지막 구간의 간격으로 이어 간다
      return n + Math.floor((g - t) / ((nx[1] - t) / (nx[0] - n)));
    }
  }
  return 0;
}
const MON = TH.plants.monstera_deliciosa;
const NEED_MULT = TH.need_mult ?? 1.4;
function fLightOf(d) {
  const F = GT.f_light;
  if (d == null || !isFinite(d)) return 1;
  if (d < MON.min) return F.below_min;
  if (d < MON.best_lo * NEED_MULT) return F.below_best;
  if (d <= MON.best_hi * NEED_MULT) return F.best;
  if (d <= MON.max) return F.below_max;
  return F.over;
}
const VARIE_BASE = 0.20;                       // plant_grow.html P.varieProb — "확정값은 0.20"
const F_STABLE_NOVICE = GT.f_stable.mult_stable;
function varieProbOf(dli7) { return Math.min(1, VARIE_BASE * fLightOf(dli7) * F_STABLE_NOVICE); }

/* 결정적 난수 — 같은 시드면 같은 판이 나온다(propagation.cuttingHash 와 같은 사상) */
function rngOf(seed) {
  /* ★ 씨를 먼저 흩는다. xorshift 에 1,2,3 같은 작은 수를 그대로 넣으면 처음 몇 번이
     전부 0에 가까운 값이 나와 **모든 시드가 같은 판**이 된다(실제로 40판이 다 똑같았다). */
  let s = Math.imul((seed >>> 0) || 1, 0x9e3779b1) >>> 0;
  const step = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 8; i++) step();
  return step;
}

/* opt.lampVarieDli — ★"만약 반지하 식물등이 무늬 대역(7.0)까지 올려 준다면" 을 재는 손잡이.
   지금 데이터로는 등 2개를 켜도 5.76 이라 대역에 못 들어간다(검사 F). 그 한 가지만 바꿔서
   세 경로가 성립하는지 보려고 둔 것이고, **기본은 꺼져 있다**(실제 데이터 그대로 돈다). */
function stubGrowth(seed, start = 143, opt = {}) {
  let cal = start, growth = start, today = null;
  const rand = rngOf(seed);
  /* 도착 개체의 잎은 **전부 민무늬**다 — 플레이어가 키운 잎이 아니라 받은 잎이다 */
  let leaves = Math.max(1, leavesAtGrowth(start));
  const varie = new Array(leaves).fill(false);          // 아래(오래된 잎)부터
  const self = {
    lampOn: false,
    assertContract() {}, has: () => true,
    setGrowth(d) { cal = d; growth = d; return { growth, calDay: cal, drawn: true, drawError: null, hudError: null }; },
    setDailyLight(v) { today = v; },
    calendarDay: () => cal, growthDays: () => growth,
    advanceTo(d) {
      cal = d;
      const grew = today != null && today >= MON.min;
      if (grew) {
        growth++;
        const n = leavesAtGrowth(growth);
        const lit = (self.lampOn && Number.isFinite(opt.lampVarieDli))
          ? Math.max(today, opt.lampVarieDli) : today;
        while (leaves < n) {                            // ★새 잎이 날 때 딱 한 번 굴린다
          leaves++;
          varie.push(rand() < varieProbOf(lit));
        }
      }
      return { calDay: cal, growth, grew, blocked: grew ? null : '빛 부족',
               drawn: true, drawError: null, hudError: null };
    },
    growthBlocked: () => (today != null && today >= MON.min ? null : '빛 부족'),
    growthPhase: () => (growth >= 146
      ? { phaseId: 'spear_furled', phaseKo: '말린 새순 등장', progress01: 0,
          nextPhaseId: 'spear_opening', nextPhaseKo: '새순이 펴지는 중' }
      : { phaseId: 'spear_ready', phaseKo: '말린 새순을 준비하는 중',
          progress01: Math.max(0, (growth - 143) / 3),
          nextPhaseId: 'spear_furled', nextPhaseKo: '말린 새순 등장' }),
    dli7: () => today, dliCV: () => 0, ageOf: d => d,
    /* ★ 코어가 못 세는 것을 growth 가 낸다 — shop.sellPot 이 이 값을 받아야만 돈다 */
    leafStats: () => ({ leaves, variegatedLeaves: varie.filter(Boolean).length }),
    /* ★ 자를 수 있는 마디 — 캐논대로 "자른 마디 + 위 전부"가 딸려온다.
       마디 i 를 자르면 잎 (leaves − i)장이 딸려오고 그중 무늬가 몇 장인지도 정해진다. */
    cuttableNodes() {
      const out = [];
      for (let i = 1; i < leaves; i++) {                // 0번(밑동)은 남겨 둔다
        const up = varie.slice(i);
        out.push({ nodeId: `n${i}`, stem: 'pink', leaves: leaves - i,
                   variegatedLeaves: up.filter(Boolean).length, growthDays: growth });
      }
      return out;
    }
  };
  return self;
}

/* ══ 판 굴리기 ═════════════════════════════════════════════════════════
   플레이어가 하는 일만 스크립트로 넣는다. 하루 진행은 전부 loop.nextDay 다. */
function play(opt = {}) {
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  light.clearCache();
  const growth = stubGrowth(opt.seed || 1, 143, { lampVarieDli: opt.lampVarieDli });
  const io = { light, growth };
  placeBeansprout(S.firstPlay, opt.cropSlot || DARK, { slots: light.room.slots });

  const rows = [];
  let jackpotDay = null, soldWon = 0, lampDay = null;
  for (let d = 1; d <= (opt.days || 240); d++) {
    let turn;
    try { turn = nextDay(S, io).turn; }
    catch (e) { throw new Error(`Day ${S.day} 에서 턴이 터졌습니다 — ${e.message}`); }
    const ts = S.tutorial;

    if (turn.plantArrived && opt.plantSlot) {
      setPotSlot(S, pot0(S), opt.plantSlot, light.room.slots);
      moveMonstera(S.firstPlay, opt.plantSlot, { slots: light.room.slots });
    }

    /* ── ① 콩나물 회전 — 씨앗을 미리 시켜 두고, 오면 다시 심는다 ────────── */
    if (opt.farm !== false) {
      const b = S.firstPlay.beansprout;
      /* ★시루를 셋까지 늘린다 — 하루 2끼 상한을 채우는 데 필요한 수(food_economy.md §4).
         그 이상은 남아서 쉬어 버리므로 사는 의미가 없다. 용기는 이틀 걸린다. */
      const want = Math.min(opt.sirus ?? 3, 3);
      if (b.sirus + stockOf(S, 'siru') + incomingOf(S, 'siru') < want)
        try { orderItem(S, 'siru', 1); } catch { /* 돈이 모자라면 다음 날 */ }
      const target = Math.min(want, b.sirus + stockOf(S, 'siru'));
      /* 수확이 가까워지면 씨앗을 미리 주문한다. 하루 뒤에 오므로 **미리** 시켜야 안 빈다. */
      if (stockOf(S, 'bean_seed') + incomingOf(S, 'bean_seed') < target)
        try { orderItem(S, 'bean_seed', target - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed')); }
        catch { /* 돈이 모자라면 다음 날 */ }
      if (b.harvested && stockOf(S, 'bean_seed') >= target)
        try { resowCrop(S, { sirus: target, at: opt.cropSlot || DARK, slots: light.room.slots }); }
        catch { /* 재고가 딱 안 맞으면 다음 날 */ }
    }

    /* ── ② 식물등 — 경로 B·C 만 산다 ─────────────────────────────────── */
    if (opt.buyLamp && ts.lamp.unlocked && ts.lamp.owned === 0 && ts.cashWon >= ts.rules.lampPriceWon) {
      buyLamp(ts); S.lamps.count = ts.lamp.owned; light.clearCache(); lampDay = ts.day;
      growth.lampOn = true;
    }

    /* ── ③ ★잭팟 — 지금 팔면 이사 자금이 되나 ──────────────────────────── */
    if (!ts.movedOut && pot0(S)) {
      const best = bestSale(S, growth);
      if (best && ts.cashWon + best.won >= MOVE_OUT_WON) {
        realize(S, growth, best);
        soldWon = best.won;
        jackpotDay = ts.day;
      }
    }
    if (!ts.movedOut && canMoveOut(ts).ok) moveOut(ts);

    rows.push({ day: S.day, tday: ts.day, season: seasonAt(ts, ts.day),
                seasonDay: seasonDayAt(ts, ts.day), cashWon: ts.cashWon,
                bankrupt: ts.bankrupt, leaves: growth.leafStats() });
    if (ts.movedOut) break;
  }
  const last = rows[rows.length - 1];
  return { S, rows, growth, jackpotDay, soldWon, lampDay,
           movedOut: S.tutorial.movedOut, lastDay: last.tday,
           season: last.season, everBroke: rows.some(r => r.bankrupt) };
}

/* 지금 팔 수 있는 것 중 제일 비싼 것. **모주를 통째로 파는 것**과 **마디를 잘라 파는 것**을 견준다.
   ★ 값은 shop.priceOf 하나가 매긴다 — 재현이 따로 셈을 갖지 않는다. */
function bestSale(S, growth) {
  const st = growth.leafStats();
  const opts = [];
  if (st.leaves >= 1)
    opts.push({ kind: 'pot', won: priceOf({ leaves: st.leaves, variegatedLeaves: st.variegatedLeaves }).won,
                leaves: st.leaves, variegatedLeaves: st.variegatedLeaves });
  const nodes = growth.cuttableNodes();
  for (const n of nodes) {
    /* 초보에서는 모주에 예비혹이 안 남는 자르기가 막힌다(propagation.md §2) — 맨 아래 마디는 뺀다 */
    if (n.leaves >= st.leaves) continue;
    const q = priceOf({ leaves: n.leaves, variegatedLeaves: n.variegatedLeaves });
    /* 삽수만 팔면 모주가 남는다 → 모주도 같이 판다(이사 가면서 방을 비운다) */
    const restLeaves = st.leaves - n.leaves;
    const restVarie = st.variegatedLeaves - n.variegatedLeaves;
    const rest = restLeaves >= 1 ? priceOf({ leaves: restLeaves, variegatedLeaves: restVarie }).won : 0;
    opts.push({ kind: 'cutting', nodeId: n.nodeId, won: q.won + rest, cutWon: q.won, restWon: rest,
                leaves: n.leaves, variegatedLeaves: n.variegatedLeaves, nodes });
  }
  opts.sort((a, b) => b.won - a.won);
  return opts[0] || null;
}

/* 고른 것을 실제로 판다 — 상점 API 만 쓴다. */
function realize(S, growth, best) {
  const st = growth.leafStats();
  if (best.kind === 'pot')
    return sellPot(S, { leaves: st.leaves, variegatedLeaves: st.variegatedLeaves });
  const c = takeCutting(S, { nodes: best.nodes, nodeId: best.nodeId, container: 'jar' });
  sellCutting(S, c.id);
  const restLeaves = st.leaves - best.leaves;
  if (restLeaves >= 1)
    sellPot(S, { leaves: restLeaves, variegatedLeaves: st.variegatedLeaves - best.variegatedLeaves });
  return c;
}

const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

/* ══ A · 상점 — 주문하면 하루 이틀 뒤에 온다 ════════════════════════════ */
check('A 상점 — 결제는 지금, 물건은 1~2일 뒤. 도착 전에는 못 쓴다', () => {
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  light.clearCache();
  const io = { light, growth: stubGrowth(1) };
  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });

  const before = S.tutorial.cashWon;
  const o = orderItem(S, 'bean_seed', 2);
  assert.equal(S.tutorial.cashWon, before - buyPriceOf('bean_seed') * 2, '주문한 날 돈이 안 빠졌습니다');
  assert.equal(stockOf(S, 'bean_seed'), 0, '★주문하자마자 물건이 왔습니다 — 배송이 없습니다');
  assert.equal(o.arrivesOnDay, S.day + CATALOG.bean_seed.leadDays);

  nextDay(S, io);                                     // Day 1 — 아직 안 온다? (leadDays 1 이라 이 날 온다)
  assert.equal(stockOf(S, 'bean_seed'), 2, `배송 ${CATALOG.bean_seed.leadDays}일인데 안 왔습니다`);

  /* 용기는 이틀 걸린다 — 규칙이 품목마다 갈린다 */
  const S2 = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  const io2 = { light, growth: stubGrowth(1) };
  placeBeansprout(S2.firstPlay, DARK, { slots: light.room.slots });
  orderItem(S2, 'siru', 1);
  nextDay(S2, io2); assert.equal(stockOf(S2, 'siru'), 0, '시루가 하루 만에 왔습니다');
  nextDay(S2, io2); assert.equal(stockOf(S2, 'siru'), 1, '시루가 이틀 뒤에도 안 왔습니다');

  info(`상점: ${Object.values(CATALOG).map(c => `${c.ko} ${buyPriceOf(c.id).toLocaleString()}원/${c.leadDays}일`).join(' · ')}`);
});

check('A-2 재고 없이 다시 심을 수 없다 — 공짜로 무한히 나오지 않는다', () => {
  const r = play({ seed: 7, days: 6, farm: false, cropSlot: DARK, plantSlot: SILL });
  assert.equal(r.S.firstPlay.beansprout.harvested, true, 'Day 4 수확이 안 났습니다');
  assert.throws(() => resowCrop(r.S, {}), /먼저 주문|배송 중/, '★씨앗 없이 다시 심어졌습니다');
});

/* ══ B · 콩나물 회전 — 반복되고, 매일 식비를 막는다 ═══════════════════════ */
check('B 콩나물 — 다시 심을 수 있고 회전이 이어진다 · 절감이 매일 걸린다', () => {
  const r = play({ seed: 3, days: 40, cropSlot: DARK, plantSlot: SILL });
  const b = r.S.firstPlay.beansprout;
  assert.ok(b.harvestCount >= 5, `40일에 수확이 ${b.harvestCount}번뿐입니다 — 회전이 안 돕니다`);
  assert.ok(r.S.firstPlay.food.totalFoodSavedWon > 100_000,
    `총 절감이 ${r.S.firstPlay.food.totalFoodSavedWon}원 — 매일 안 걸리고 있습니다`);
  info(`회전: 40일에 수확 ${b.harvestCount}번 · 총 절감 ${r.S.firstPlay.food.totalFoodSavedWon.toLocaleString()}원 ` +
       `· 씨앗값 ${r.S.tutorial.crop.spentWon.toLocaleString()}원`);
});

/* ══ C · ★막다른 길이 없다 ═══════════════════════════════════════════════ */
check('C 밝은 자리에서 첫 수확을 해도 만회할 수 있다 (cropDark 재시도)', () => {
  /* 밝은 자리(창턱)에 시루를 두면 4일평균 DLI 3.77 → 품질 1끼 → cropDark 가 안 켜진다 */
  const r = play({ seed: 5, days: 60, cropSlot: SILL, plantSlot: SILL });
  assert.equal(r.S.firstPlay.beansprout.harvestCount >= 2, true, '회전이 안 돌았습니다');
  /* 위 play 는 같은 자리(SILL)에 계속 다시 심는다 → 영영 안 켜져야 한다 */
  assert.equal(r.S.tutorial.learned.cropDark, false,
    '★밝은 자리에만 뒀는데 cropDark 가 켜졌습니다 — 판정이 헐렁합니다');

  /* 이제 어두운 자리로 옮겨 다시 심는다 — **다시 해 보면 배운다** */
  const S = r.S;
  const io = { light, growth: r.growth };
  let got = false;
  for (let i = 0; i < 30 && !got; i++) {
    const b = S.firstPlay.beansprout;
    if (stockOf(S, 'bean_seed') + incomingOf(S, 'bean_seed') < b.sirus)
      try { orderItem(S, 'bean_seed', b.sirus); } catch { /* 파산이면 다음 날 */ }
    if (b.harvested && stockOf(S, 'bean_seed') >= b.sirus)
      resowCrop(S, { at: DARK, slots: light.room.slots });
    nextDay(S, io);
    got = S.tutorial.learned.cropDark;
  }
  assert.equal(got, true, '★어두운 자리로 옮겨 다시 심었는데도 cropDark 가 안 켜졌습니다 — 막다른 길입니다');
  info('막다른 길 없음: 밝은 데서 첫 수확 → 어두운 데로 재파종 → cropDark 회복');
});

check('C-2 자동으로 채워 주지 않는다 — 다시 심어도 어두운 데라야 켜진다', () => {
  const r = play({ seed: 11, days: 60, cropSlot: SILL, plantSlot: SILL });
  assert.equal(r.S.tutorial.learned.cropDark, false, '★재파종만으로 배움이 켜졌습니다');
});

/* ══ D · 아무것도 안 하면 파산한다 (위험이 남아 있다) ═════════════════════ */
check('D 아무것도 안 하면 파산한다 — 다만 게임이 끝나지는 않는다', () => {
  const r = play({ seed: 2, days: 120, farm: false, cropSlot: DARK, plantSlot: SILL });
  assert.equal(r.everBroke, true, '★아무것도 안 했는데 파산하지 않았습니다 — 위험이 사라졌습니다');
  const broke = r.rows.find(x => x.bankrupt);
  assert.equal(r.rows.length >= 100, true, '★파산으로 하루가 멈췄습니다 — 초보 모드는 죽지 않습니다');
  /* ★파산해도 잭팟은 계속 굴러간다 — 그게 "막히지 않는다"의 내용이다(shop.js §파산) */
  const after = r.rows[r.rows.length - 1].leaves.leaves;
  const at = broke.leaves.leaves;
  assert.ok(after > at, `★파산한 뒤로 잎이 안 늘었습니다(${at} → ${after}) — 기다려도 아무 일이 안 일어납니다`);
  info(`파산: 튜토 ${broke.tday}일째(게임 ${broke.day}일) · 그 뒤에도 잎 ${at} → ${after}장으로 계속 자란다`);
});

check('D-2 콩나물을 돌리면 돈이 덜 준다 — 그게 콩나물의 값어치다', () => {
  const bare = play({ seed: 2, days: 120, farm: false, cropSlot: DARK, plantSlot: SILL });
  const farm = play({ seed: 2, days: 120, cropSlot: DARK, plantSlot: SILL });
  /* ★파산 **날짜**로 재지 않는다 — 30일마다 30만원이 목돈으로 빠져서 며칠 벌어도 같은 날
     0이 되는 계단이 생긴다. 실제 값어치는 "같은 날 지갑에 얼마가 남아 있나"다. */
  const at = t => (bare.rows.find(r => r.tday === t) || {}).cashWon;
  const bt = t => (farm.rows.find(r => r.tday === t) || {}).cashWon;
  const D = 29;                                     // 첫 월세(30일) 직전 — 계단에 안 걸리는 자리
  assert.ok(bt(D) > at(D),
    `★콩나물을 돌렸는데 돈이 더 안 남았습니다 (튜토 ${D}일: 맨몸 ${at(D)} vs 회전 ${bt(D)})`);
  const gain = (bt(D) - at(D)) / D;
  info(`콩나물 값어치: 튜토 ${D}일에 ${(bt(D) - at(D)).toLocaleString()}원 더 남는다 ` +
       `(하루 ${Math.round(gain).toLocaleString()}원 · 씨앗값 낸 뒤 순액)`);
});

/* ══ E · 값 공식 — propagation.md §6 그대로 ══════════════════════════════ */
check('E 값 — 잎 2장 이하로는 150만이 안 된다 · 성체라야 닿는다', () => {
  assert.equal(priceOf({ leaves: 1, variegatedLeaves: 0 }).won, 12_000, '민무늬 삽수 잎1');
  assert.equal(priceOf({ leaves: 6, variegatedLeaves: 0 }).won, 60_000, '민무늬 성체 잎6 (정본 60,000)');
  const rows = [];
  for (const n of [1, 2, 3, 6, 9, 12]) {
    const r = varieLeavesNeededFor(MOVE_OUT_WON, { leaves: n });
    rows.push(`잎${n}:${r.needVarieLeaves === null ? '불가' : r.needVarieLeaves + '장'}`);
    if (n <= 2) assert.equal(r.needVarieLeaves, null, `★잎 ${n}장 삽수로 150만이 나왔습니다`);
    else assert.ok(r.wonAtNeed >= MOVE_OUT_WON, `잎 ${n}장 역산이 목표에 못 미칩니다`);
  }
  info('150만 역산 — ' + rows.join(' · '));
});

/* ══ F · 무늬 확률 — 자리와 등이 실제로 확률을 가른다 ════════════════════ */
check('F 무늬 확률 — 반지하 창턱 · 등 유무로 실제 확률이 얼마인가', () => {
  const noLamp = 3.77, lamp1 = 5.61, lamp2 = 5.76, best = 8.0;
  const p = d => varieProbOf(d);
  info(`무늬 대역(최적) = ${(MON.best_lo * NEED_MULT).toFixed(1)} ~ ${(MON.best_hi * NEED_MULT).toFixed(1)} DLI`);
  info(`잎당 무늬 확률 — 창턱 ${noLamp}: ${(p(noLamp) * 100).toFixed(1)}% · ` +
       `등1개 ${lamp1}: ${(p(lamp1) * 100).toFixed(1)}% · 등2개 ${lamp2}: ${(p(lamp2) * 100).toFixed(1)}% · ` +
       `(참고) 최적 ${best}: ${(p(best) * 100).toFixed(1)}%`);
  /* ★이게 이 재현이 낸 제일 큰 발견이다 — 반지하는 등을 사도 무늬 최적 대역에 못 들어간다 */
  assert.ok(p(lamp2) < p(best),
    '반지하 등 2개가 최적 대역과 같은 확률입니다 — 프로파일이 바뀌었으면 이 검사를 고쳐 주세요');
});

/* ══ G · ★세 경로 — 시드 분포 ═══════════════════════════════════════════ */
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
function runRoute(name, opt) {
  const runs = SEEDS.map(seed => play({ ...opt, seed }));
  const ok = runs.filter(r => r.movedOut);
  const days = ok.map(r => r.lastDay);
  const rate = ok.length / runs.length;
  const seasons = {};
  for (const r of ok) seasons[r.season] = (seasons[r.season] || 0) + 1;
  info(`${name} — 이사 성공 ${ok.length}/${runs.length} (${(rate * 100).toFixed(0)}%)` +
       (days.length ? ` · 중앙값 튜토 ${median(days)}일 · 최선 ${Math.min(...days)}일 · 최악 ${Math.max(...days)}일` +
                      ` · 계절 ${Object.entries(seasons).map(([k, v]) => k + ':' + v).join(' ')}`
                    : ' · **한 판도 못 나갔다**'));
  return { runs, ok, days, rate };
}

const A = runRoute('경로 A (등 없이)', { cropSlot: DARK, plantSlot: SILL, buyLamp: false, days: 240 });
const B = runRoute('경로 B (등 사고)', { cropSlot: DARK, plantSlot: SILL, buyLamp: true, days: 240 });
const C = runRoute('경로 C (겨울까지)', { cropSlot: DARK, plantSlot: SILL, buyLamp: true, days: 360 });

check('G-1 경로 C — 겨울까지 가도 막히지 않는다(진행이 계속되고 잎이 계속 난다)', () => {
  const r = C.runs[0];
  const last = r.rows[r.rows.length - 1];
  assert.ok(last.tday >= 135 || r.movedOut, `튜토 ${last.tday}일에서 멈췄습니다`);
  assert.ok(last.leaves.leaves > 6, `잎이 ${last.leaves.leaves}장 — 겨울에 형태가 통째로 멈췄습니다`);
});

check('G-2 잭팟이 나면 실제로 이사가 된다 — 배선은 돈다', () => {
  assert.ok(A.ok.length + B.ok.length + C.ok.length > 0,
    '★한 판도 못 나갔습니다 — 판매·이사 배선이 끊겼습니다');
  const r = (A.ok[0] || B.ok[0] || C.ok[0]);
  assert.equal(r.S.tutorial.movedOut, true);
  assert.ok(r.soldWon > 0, '판 돈이 0인데 이사했습니다 — 수입이 주입되고 있습니다');
  info(`잭팟 예: 튜토 ${r.jackpotDay}일에 ${r.soldWon.toLocaleString()}원에 팔고 그날 이사`);
});

/* ★★ 여기가 이 재현의 결론이다 — 고장이 아니라 **기획 판단 대기**라 WARN 이다.
   숫자는 검사 F 에서 이미 나왔다: 반지하는 등을 사도 무늬 최적 대역(7.0)에 못 들어가
   잎당 확률이 13% 로 고정된다. 반지하 체류 동안 새로 나는 잎이 3~5장이라
   150만에 필요한 무늬 잎(성체 기준 4~5장, 삽수 v=1 기준 1~2장)이 중앙값 안에 안 나온다. */
warn('G-2b ★세 경로가 중앙값 안에 성립한다 (지금 데이터 그대로)', () => {
  const bad = [['A', A], ['B', B], ['C', C]].filter(([, r]) => r.rate < 0.5);
  assert.equal(bad.length, 0,
    `중앙값으로 이사하지 못하는 경로: ${bad.map(([n, r]) => `${n} ${(r.rate * 100).toFixed(0)}%`).join(' · ')}. ` +
    `사유는 검사 F — 반지하는 등을 켜도 무늬 최적 대역(DLI ${(MON.best_lo * NEED_MULT).toFixed(1)})에 ` +
    `못 들어가 잎당 무늬 확률이 13% 로 고정된다. docs/shop.md §4 판단필요를 보세요`);
});

/* ★ 그래서 "무엇을 고치면 되나"를 같은 재현으로 답한다 — 손잡이를 딱 하나만 돌린다.
   식물등이 창턱을 무늬 대역(7.0)까지 올려 주면 어떻게 되나. */
const B7 = runRoute('경로 B′ (등이 무늬 대역까지 올려 준다면)',
  { cropSlot: DARK, plantSlot: SILL, buyLamp: true, lampVarieDli: 7.0, days: 240 });
const C7 = runRoute('경로 C′ (같은 조건 · 겨울까지)',
  { cropSlot: DARK, plantSlot: SILL, buyLamp: true, lampVarieDli: 7.0, days: 360 });

check('G-3 ★고칠 곳은 하나다 — 등이 무늬 대역에 닿으면 경로 B·C 가 성립한다', () => {
  assert.ok(B7.rate > B.rate,
    `등이 무늬 대역에 닿아도 성공률이 안 올랐습니다: ${B.rate} → ${B7.rate}`);
  assert.ok(C7.rate >= 0.5,
    `그래도 경로 C 가 중앙값 안에 안 됩니다: ${(C7.rate * 100).toFixed(0)}% — 손잡이가 하나로는 모자랍니다`);
  info(`★결론: 반지하 창턱 DLI 를 등으로 ${(MON.best_lo * NEED_MULT).toFixed(1)} 위로 올리면 ` +
       `B ${(B.rate * 100).toFixed(0)}%→${(B7.rate * 100).toFixed(0)}% · ` +
       `C ${(C.rate * 100).toFixed(0)}%→${(C7.rate * 100).toFixed(0)}% 로 바뀐다`);
});

check('G-4 등이 잭팟을 앞당긴다 — 등을 산 판이 안 산 판보다 낫다', () => {
  assert.ok(B7.rate > A.rate,
    `등을 샀는데 더 낫지 않습니다: A ${A.rate} vs B′ ${B7.rate}`);
});

/* ── 보고 ─────────────────────────────────────────────────────────────── */
let fail = 0, judge = 0;
for (const [st, name, msg] of results) {
  if (st === 'INFO') { console.log(name); continue; }
  if (st === 'FAIL') fail++;
  if (st === 'WARN') judge++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\nbanjiha_routes: FAIL (${fail}건)`
                 : `\nbanjiha_routes: PASS${judge ? ` (⚠ 기획 판단필요 ${judge}건 — 위 WARN)` : ''}`);
process.exit(fail ? 1 : 0);
