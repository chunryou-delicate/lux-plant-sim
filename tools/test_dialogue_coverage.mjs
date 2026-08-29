/* 대사 채움 재현 — 반지하 시작부터 원룸 이사까지 "아무 말도 없는 구간"이 없는가
 *
 *   node tools/test_dialogue_coverage.mjs
 *
 * ★ 이 재현이 지키는 것은 여섯 가지다. 하나라도 깨지면 그 구간이 조용해진다.
 *   ⑴ **말 없는 날이 연속 3일을 넘지 않는다** — 세 경로(A·B·C) 전부
 *   ⑵ 반드시 다뤄야 할 **사건이 전부 실제로 발현된다**(하나라도 안 뜨면 FAIL)
 *   ⑶ **같은 말이 연달아 두 번 나오지 않는다**
 *   ⑷ 대사가 가리키는 **표정 파일이 실제로 있다** — 없으면 얼굴이 조용히 기본으로 떨어진다
 *   ⑸ **식물신(god)은 외형이 없다** — portrait:false 계약이 안 깨진다
 *   ⑹ 이사 장면이 **실제로 대사로 나온다** — 이 구간의 끝이자 감정의 정점
 *
 * ★ 왜 N=3 인가 (⑴의 근거)
 *   반지하 구간의 기본 박자는 **콩나물 4일**이다 — 놓고, 사흘 기다리고, 나흘째에 사건이 난다.
 *   그 리듬 안(무음 3일)이면 플레이어는 "기다리는 중"으로 읽는다. 그보다 길어지면 리듬이
 *   아니라 구멍이고, 실제로 그랬다 — 손보기 전 진단에서 **연속 43일**이 비어 있었다.
 *   dialogue.QUIET_DAYS_BEFORE_CHATTER 가 2 라서 실측 상한은 2일이고, 여기서는
 *   여유 한 칸을 두고 3으로 잰다(사건이 몰린 날 뒤에 하루가 밀릴 수 있다).
 *
 * ★ 진짜 게임 경로로 돈다 — 프로파일 조도 + loop.nextDay + growth 어댑터 대역.
 *   growth 는 브라우저 전용이라 유효 생장일만 세는 최소 대역을 쓴다
 *   (tools/probe_first_play_len.mjs · tools/test_fastforward.mjs 와 같은 계약: spear_furled = 146).
 *
 * ⚠ **수입은 재현이 직접 넣는다.** 지금 코어에는 반복 수입이 없다 —
 *   콩나물은 첫 시루 한 번뿐이고 판매도 없어서, 소지금은 시작 100만에서 줄기만 한다.
 *   그대로 두면 이사 자금 150만에 **영영 도달하지 못해** ⑵의 절반을 못 잰다.
 *   그래서 하루 수입만 주입하고 나머지(월세·지출·계절·해금)는 전부 코어 규칙대로 돈다.
 *
 * ★ 2026-08-03 갱신 — 주입액을 35,000/15,000 에서 24,300/5,000 으로 낮췄다. 두 가지가 바뀌었다:
 *   ① 월세가 하루 지출에서 **두 번 빠지던 것**을 고쳤다(tutorial.dailyCashOutWon). 지출이
 *      실제로 하루 20,000원(월 60만)이 되면서 예전 주입액으로는 A 가 **여름 28일째**에
 *      이사해 버려 가을·식물등 장면이 통째로 안 났다.
 *   ② 실제 수입은 이제 주입이 아니라 **무늬 개체 판매 한 방**이다(docs/shop.md).
 *      그 경제는 tools/test_banjiha_routes.mjs 가 잰다. 여기서 재는 것은 **대사 채움**뿐이라,
 *      세 경로의 도착 시점만 story_arc.md §2 대로 맞춰 두면 된다.
 */
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { createProfileLight } from '../src/game/room_profile.js';
import { newState, pot0, setPotSlot, waterCrop, waterPot, resowCrop, ARRIVAL } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, moveMonstera,
         beansproutReady } from '../src/game/first_play.js';
import {
  SCRIPTS, SPEAKERS, CHATTER, REPEATABLE, EVENT_SCRIPT,
  /* ★ 2026-08-17 — 퀘스트 대사 두 지도 (dialogue §5.5) */
  QUEST_OPEN_SCRIPT, QUEST_DONE_SCRIPT,
  createDialogue, createStoryteller, scriptsForEvents, pickChatter
} from '../src/game/dialogue.js';
import { seasonAt, seasonDayAt, buyLamp, canMoveOut, moveOut,
         varieGrantOpensDay, varieView } from '../src/game/tutorial.js';
/* ★★ 2026-08-17 — 몬스테라 것은 상점이 안 산다(shop.js §⑦-0). 올리고 → 연락 → 거래다.
   이 재현은 하루 루프를 돌리므로 연락은 `stepMarket` 이 저절로 가져온다. */
import { orderItem, stockOf, incomingOf, listCutting, dealListing,
         marketStatus, marketGate, listingFor, MARKET_MIN_LEAVES,
         SELLABLE_CUTTING_STATUS } from '../src/game/shop.js';
import { cuttableNow, takeCutting, cuttingsOf } from '../src/game/propagation.js';

const U = p => new URL(p, import.meta.url);
const J = p => JSON.parse(readFileSync(U(p), 'utf8'));

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const info = m => results.push(['INFO', '  ' + m]);

/* ══ 판 굴리기 ═════════════════════════════════════════════════════════ */

const light = createProfileLight(J('../data/profiles/room_profile.banjiha.json'), {
  lightTh: J('../data/balance/light_thresholds.json'),
  weatherBalance: J('../data/balance/weather.json')
});
const RULES = firstPlayRulesFromBalance(J('../data/balance/characters.json'));

const DARK = 'banjiha-dresser:1';        // peak DLI 0.04 — 콩나물 자리
const SILL = 'banjiha-sill:0';           // peak DLI 3.77 — 몬스테라 자리
const BRIGHT_CROP = 'banjiha-sill:0';    // ★일부러 밝은 데 둔 콩나물(배움 ② 가 안 켜진다)

/* growth 대역 — 단계 이름은 growth 소유라 지어내지 않는다.
   ★ 마디·잎 집계도 낸다 (2026-08-03). 확정 무늬(varie_granted)는 growth 가 낸 마디 목록
     **위에** 얹히는 것이라(tutorial.varieView), 목록이 없으면 코어가 아무것도 안 한다 —
     그러면 튜토의 마지막 장면이 이 재현에서 영영 안 나온다.
   ⚠ 값은 진짜 엔진이 실제로 내는 모양을 그대로 쓴다(tools/test_banjiha_routes.mjs 검사 0:
     도착 잎 2장 · 자란 뒤 3장). 여기서는 잎 3장짜리 그루로 고정한다 — 한 장을 잘라도
     모주에 두 장이 남아 초보 규칙(모주가 안 끝난다)에 안 걸린다. */
const STUB_LEAVES = 3;
/* ★★ 2026-08-04 — 도착 진행도가 **줄기 1개짜리(state.ARRIVAL)** 로 내려갔고, 그 뒤 첫
   말린 새순은 유효 61 이다(재서 나온 값 — tools/probe_arrival_stems.mjs).
   ⚠ 위 STUB_LEAVES=3 은 **진짜 엔진보다 후한 값**이 됐다: 유효 61 에서 실제 잎은 2장이고
     3장째는 유효 150 에서 난다. 여기서는 대사가 다 나오는가만 보므로 그대로 두지만,
     살림이 성립하는가는 tools/test_banjiha_routes.mjs 가 **진짜 엔진으로** 잰다. */
const ARR = ARRIVAL.growthDays;
const SPEAR = 61;
const SPEAR_DAYS = SPEAR - ARR;
function stubGrowth(start = ARR) {
  let cal = start, growth = start, today = null;
  return {
    cuttableNodes: () => [
      { nodeId: 'n0#0', stem: 'pink', leaves: STUB_LEAVES, variegatedLeaves: 0, growthDays: growth },
      { nodeId: 'n0#1', stem: 'pink', leaves: 1, variegatedLeaves: 0, growthDays: growth },
      { nodeId: 'n0#2', stem: 'pink', leaves: 1, variegatedLeaves: 0, growthDays: growth }
    ],
    leafStats: () => ({ leaves: STUB_LEAVES, variegatedLeaves: 0, matureLeaves: 0, growthDays: growth }),
    assertContract() {}, has: () => true,
    setGrowth(d) { cal = d; growth = d; return { growth, calDay: cal, drawn: true, drawError: null, hudError: null }; },
    setDailyLight(v) { today = v; },
    calendarDay: () => cal, growthDays: () => growth,
    advanceTo(d) { cal = d; const grew = today >= 3; if (grew) growth++;
      return { calDay: cal, growth, grew, blocked: grew ? null : '빛 부족',
               drawn: true, drawError: null, hudError: null }; },
    growthBlocked: () => (today >= 3 ? null : '빛 부족'),
    growthPhase: () => (growth >= SPEAR
      ? { phaseId: 'spear_furled', phaseKo: '말린 새순 등장', progress01: 0,
          nextPhaseId: 'spear_opening', nextPhaseKo: '새순이 펴지는 중' }
      : { phaseId: 'spear_ready', phaseKo: '말린 새순을 준비하는 중',
          progress01: Math.max(0, (growth - ARR) / SPEAR_DAYS),
          nextPhaseId: 'spear_furled', nextPhaseKo: '말린 새순 등장' }),
    dli7: () => today, dliCV: () => 0, ageOf: d => d
  };
}

/* 한 판. opt.script(day, S) 로 그날그날 플레이어가 하는 일을 넣는다.
   ★대사는 createStoryteller 하나로만 나온다 — 게임 화면이 쓸 창구와 같은 것이다. */
function play(opt) {
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  light.clearCache();
  const io = { light, growth: stubGrowth() };
  const st = createStoryteller();
  placeBeansprout(S.firstPlay, opt.cropSlot || DARK, { slots: light.room.slots });

  const rows = [];
  for (let d = 1; d <= (opt.days || 200); d++) {
    const ts = S.tutorial;
    /* ⚠ 주입 — 위 머리말 참고. 하루가 시작하기 **전에** 넣어야 그날 판정이 오늘 돈을 본다. */
    if (ts.day > 0 && opt.incomeWon) ts.cashWon += opt.incomeWon;

    /* ★ 물주기 (2026-08-04) — [물 주기] + [다음 날] 이 표준 하루다. 물을 준 날만 자라므로
       재현도 그 행위를 한다. 안 하면 콩나물이 영영 안 커서 몬스테라도 안 온다. */
    /* ★ 몬스테라는 3회전째에 온다 (2026-08-04) — 그래서 거둔 시루는 **다시 심는다.**
       안 심으면 회전이 한 번에서 멈춰 선물이 영영 안 오고, 튜토가 통째로 안 열린다. */
    const bs = S.firstPlay.beansprout;
    if (bs && bs.harvested) {
      if (stockOf(S, 'bean_seed') < 1 && incomingOf(S, 'bean_seed') < 1)
        try { orderItem(S, 'bean_seed', 1); } catch { /* 돈이 모자라면 다음 날 */ }
      if (stockOf(S, 'bean_seed') >= 1)
        try { resowCrop(S, { at: opt.cropSlot || DARK, slots: light.room.slots }); }
        catch { /* 재고가 안 맞으면 다음 날 */ }
    }
    try { waterCrop(S); } catch { /* 아직 안 놓았거나 이미 거둔 시루 */ }
    try { waterPot(S); } catch { /* 아직 없거나 안 놓은 화분 — 그런 날은 물이 안 든다 */ }

    let turn;
    try { turn = nextDay(S, io).turn; }
    catch (e) { throw new Error(`Day ${S.day} 에서 턴이 터졌습니다 — ${e.message}`); }

    /* ★★ 수확 (2026-08-04) — **[수확하기] 를 눌러야** 곳간에 들어가고 몬스테라가 온다
       (first_play.js §수확). 그래서 첫 플레이 세 장면(수확 → 식물신 → 도착)의 대사도
       턴이 아니라 **이 함수의 반환값**에서 나온다 — 게임 화면이 하는 것과 똑같이. */
    let harvestEvents = [];
    if (beansproutReady(S.firstPlay.beansprout)) {
      const r = harvestCrop(S, io);
      harvestEvents = r.events || [];
      /* 몬스테라가 도착한 날 자리를 옮긴다(플레이어가 하는 일) */
      if (r.arrived && opt.plantSlot) movePot(S, opt.plantSlot);
    }

    const said = st.turn(turn, S);
    /* ★턴 밖에서 나는 일(수확·식물등 구입·이사 버튼)도 같은 창구로 돌린다 —
       게임 화면이 하는 것과 똑같이. onDay 는 그쪽이 낸 events 배열을 돌려준다. */
    const extraEvents = [...harvestEvents,
                         ...((opt.onDay && opt.onDay({ S, io, day: S.day, turn })) || [])];
    const extraSaid = extraEvents.length ? st.events(extraEvents) : [];

    rows.push({
      day: S.day, tday: ts.day,
      season: seasonAt(ts, ts.day), seasonDay: seasonDayAt(ts, ts.day),
      cashWon: ts.cashWon,
      events: [...(turn.events || []), ...extraEvents].map(e => e.id),
      said: [...said, ...extraSaid]
    });
    if (ts.movedOut) break;
  }
  return { S, rows,
           events: new Set(rows.flatMap(r => r.events)),
           said: new Set(rows.flatMap(r => r.said)),
           saidSeq: rows.flatMap(r => r.said) };
}
function movePot(S, slotId) {
  setPotSlot(S, pot0(S), slotId, light.room.slots);
  moveMonstera(S.firstPlay, slotId, { slots: light.room.slots });
}
/* 말 없는 날이 연속 며칠까지 이어졌나 */
function longestSilence(rows) {
  let run = 0, max = 0, at = null, start = null, atStart = null;
  for (const r of rows) {
    if (r.said.length) { run = 0; start = null; }
    else { if (start == null) start = r.day; run++; if (run > max) { max = run; at = r.day; atStart = start; } }
  }
  return { days: max, from: atStart, to: at };
}

/* ══ 세 경로 ═══════════════════════════════════════════════════════════
   story_arc.md §2 의 A·B·C 를 그대로 굴린다. 수입만 갈라서 도착 시점을 만든다. */

/* ⚠ 2026-08-09 — **90일 → 130일로 늘렸다.** 판을 고친 게 아니라 재현의 기한을 맞춘 것이다.
   이사비가 150만 → **200만**이 되면서(하프문 하나로 넘는 자리) 주입 수입 24,300원/일 로는
   90일 안에 못 닿는다 — 이사를 안 하니 `move_ready`·`moved_out` 대사가 영영 안 났다.
   ⚠ **대사가 없어진 게 아니라 이사가 안 일어난 것**이었다. 재는 기한이 낡았던 자리다.
   ⇒ 값을 또 올리면 여기도 같이 봐야 한다. `days` 는 이사비를 따라간다. */
/* ★★ 2026-08-13 — **삽수 한 바퀴를 실제로 돈다** (탈출의 둘째 축).
   ------------------------------------------------------------
   박사님 확정으로 탈출 조건이 「돈 × 배움 넷」에서 **「돈 × 무늬 삽수를 판 적이 있다」**로
   바뀌었다(tutorial.js §두 축). 그래서 A·B 도 **잘라서 · 뿌리내려서 · 판다** —
   안 하면 `move_ready`·`moved_out` 대사가 영영 안 난다.
   ⚠ 지름길을 안 쓴다: 병을 **주문해서** 사고, 코어 API 로 자르고, 뿌리내린 뒤에 판다.
     ⇒ 순서가 곧 규칙이다. ① 아무 마디나 한 번 잘라야 확정 무늬가 열리고(§확정 무늬 조건 ③),
       ② 확정 무늬가 붙은 마디를 다시 잘라야 **무늬 삽수**가 되고,
       ③ 12일 뒤 뿌리를 내려야 팔린다.
   ★ 코어가 준 확정 무늬는 growth 의 날 마디에는 안 붙어 있다 — `varieView` 로 덧씌워 읽어야
     `takeCutting` 이 무늬를 실어 준다(tutorial.js §덧씌워 읽기). */
function runCuttingCycle(S, io) {
  const pot = pot0(S);
  if (!pot) return;
  if (stockOf(S, 'jar') + incomingOf(S, 'jar') === 0) {
    try { orderItem(S, 'jar', 1); } catch { /* 돈이 모자라면 다음 날 */ }
  }
  if (stockOf(S, 'jar') >= 1) {
    const v = varieView(S, { nodes: io.growth.cuttableNodes(), stats: io.growth.leafStats() });
    const nodes = cuttableNow(S, v.nodes);
    /* 무늬가 붙은 마디가 있으면 그것부터. 없으면 잎 1장짜리로 **첫 자르기**를 채운다 */
    const pick = nodes.find(n => (n.variegatedLeaves || 0) >= 1)
              || ((pot.cuts || []).length ? null : nodes.find(n => n.leaves === 1));
    /* ⚠ `takeCutting` 에는 **거르지 않은 전체 목록**을 넘긴다. 거른 목록을 넘기면
       `motherLeavesOf(nodes)` 가 그 목록의 최댓값을 모주 잎 수로 보고
       (propagation §cutBudgetOf), 잎 1장짜리 하나만 남은 목록에서는 **모주가 잎 1장짜리**가
       되어 「모주에 0장만 남았습니다」로 막힌다. 실제로 여기서 그 함정을 밟았다. */
    if (pick) try { takeCutting(S, { nodes: v.nodes, nodeId: pick.nodeId, container: 'jar' }); }
              catch { /* 규칙대로 막힌 것이다 */ }
  }
  /* 뿌리내린 무늬 삽수는 **내놓는다** — 그리고 연락이 온 것을 거래한다.
     ★ 탈출의 둘째 축이 열리는 자리는 **거래**다(shop.js §⑦-2 · tutorial.js §누가 적나).
     ⚠ 문은 손으로 안 연다 — 모주 잎 수를 넘겨 화면과 같은 길로 연다. */
  try { if (S.pots && S.pots.length) marketGate(S, { leaves: MARKET_MIN_LEAVES }); } catch { }
  for (const c of [...cuttingsOf(S)]) {
    if (!SELLABLE_CUTTING_STATUS.includes(c.status)) continue;
    if ((c.variegatedLeaves || 0) < 1) continue;
    if (listingFor(S, c)) continue;
    try { listCutting(S, c.id); } catch { /* 아직 못 올린다 */ }
  }
  for (const l of marketStatus(S).contacted) {
    if (l.kind !== 'cutting') continue;
    try { dealListing(S, l.listingId); } catch { }
  }
}

/* A — 식물등 없이 가을 안에 이사 */
const A = play({
  /* ⚠ 2026-08-17 — **130 → 145일.** 늘린 까닭은 밸런스가 아니라 **길이**다:
     몬스테라 것이 중고 거래로만 팔리게 되면서(shop.js §⑦-0) 무늬 삽수 한 장을 돈으로
     바꾸는 데 **1~7일**이 더 든다. 130일 안에서는 `move_short_money`·`move_ready` 가
     날 자리까지 못 가서 「대사가 없다」로 잡혔다 — 대사가 없어진 것이 아니라
     **재현이 짧아진 것**이다(실측: 대기를 0일로 눌러 보니 130일에 그대로 났다). */
/* ⚠⚠ 2026-08-17 — **하루 늦게 나간다.** 고친 것은 판이 아니라 **재현의 손 순서**다.
     ------------------------------------------------------------
     `move_ready`(「이사할 수 있게 됐다」)와 `move_short_money`(「돈이 모자란다」)는
     `nextDay` 안의 튜토 걸음이 **상태가 뒤집히는 것을 봤을 때** 내는 사건이다.
     그런데 이 재현은 같은 날 안에서 「팔아서 조건을 참으로 만들고 → 곧바로 나가버려서」
     그 뒤집힘을 아무도 못 보게 만들고 있었다. 몬스테라 것이 중고 거래로만 팔리면서
     (shop.js §⑦-0) 조건이 참이 되는 날이 밀렸고, 그 바람에 이 구멍이 드러났다.
     ⇒ **어제 이미 참이었을 때만 나간다.** 사람이 하는 것도 그렇다 — 화면이
       「이사할 수 있습니다」라고 말하는 것을 보고 나서 [이사]를 누른다.
     ⚠ 대기를 0일로 눌러 재 보니 **옛 순서로도 130일에 두 사건이 다 났다** — 즉 사건이
       없어진 것이 아니라 이 재현이 그 순간을 안 보고 있었다(tools/_probe_dlg_nowait.mjs). */
  cropSlot: DARK, plantSlot: SILL, incomeWon: 24_300, days: 145,
  onDay: ({ S, io }) => {
    const ts = S.tutorial;
    const wasOk = canMoveOut(ts).ok;        // ★ 어제까지의 상태 — 오늘 판 것은 안 센다
    runCuttingCycle(S, io);
    return (wasOk && !ts.movedOut) ? moveOut(ts).events : [];
  }
});

/* B — 식물등을 사고 가을에 이사
   ★★★ 2026-08-09 — **등을 사기 전에는 안 나간다**는 줄이 새로 필요해졌다.
     ------------------------------------------------------------
     시작돈이 1,300,000 → **1,500,000원**이 되면서 `moveOutCostWon`(1,500,000)과 같아졌다.
     그래서 `canMoveOut` 의 돈 조건이 **첫날부터 참**이고, 배움 넷만 채우면 곧바로 나간다 —
     실측으로 B 가 **게임 48일(여름 62일째)** 에 이사해 버렸다. 식물등은 **가을**에 열리므로
     (`lampUnlockSeason`) 등을 아예 못 사고, `lamp_bought` 대사가 영영 안 난다.
   ⇒ 여기서는 **경로 B 를 경로 B 답게** 만든다: 등을 사려는 사람은 등을 사고 나간다.
     ⚠ 다만 이건 재현을 고친 것이지 판을 고친 것이 아니다. **여름에 이사가 끝난다**는 사실은
       그대로 남아 있고, 그건 가을·식물등·겨울 콘텐츠가 통째로 건너뛰어진다는 뜻이다
       (plan-2026-08-09-decisions §4 가 막으려던 바로 그것). 인계에 판단 요청으로 적었다. */
const B = play({
  /* ⚠ 130 → 145일 — 중고 거래 대기(1~7일)만큼 재현을 늘렸다. 값은 안 건드렸다 */
  cropSlot: DARK, plantSlot: SILL, incomeWon: 24_300, days: 145,
  onDay: ({ S, io }) => {
    const ts = S.tutorial, out = [];
    const wasOk = canMoveOut(ts).ok;        // ★ 위 ⚠⚠ 와 같은 규칙 — 어제까지의 상태로 나간다
    runCuttingCycle(S, io);                 // ★ 둘째 축 — 위 §삽수 한 바퀴
    if (ts.lamp.unlocked && ts.lamp.owned === 0 && ts.cashWon >= ts.rules.lampPriceWon) {
      out.push(...buyLamp(ts).events);
      S.lamps.count = ts.lamp.owned; io.light.clearCache();
    }
    if (ts.lamp.owned >= 1 && wasOk && !ts.movedOut) out.push(...moveOut(ts).events);
    return out;
  }
});

/* C — 진행이 늦어 겨울을 맞는다. ★실패가 아니라 더딘 것이다.
   중간에 화분을 어두운 데로 옮겼다가 되돌린다 — 멈춤·재개도 이 판에서 겪는다.
   ★삽수도 이 판에서 한 번 자른다 (2026-08-03) — 확정 무늬(varie_granted)의 조건 ③이라
     안 자르면 튜토의 마지막 장면이 영영 안 난다. 지름길을 안 쓴다: 병을 **주문해서**
     이틀 기다려 사고, 코어 API(propagation.takeCutting)로 자른다. */
const C = play({
  /* ★ 2026-08-04 — 175 → 220 일. 첫 플레이가 길어져(선물이 3회전째로 밀렸다) 튜토 시계가
     그만큼 늦게 돌기 시작한다. 겨울(튜토 135일)·winter_still(튜토 145일)까지 가려면
     게임 일수로 그만큼 더 필요하다 — 새 규칙이 아니라 같은 지점까지 가는 데 드는 날수다. */
  cropSlot: DARK, plantSlot: SILL, incomeWon: 5_000, days: 220,
  onDay: ({ S, io }) => {
    /* ★ 2026-08-04 — **튜토 일자**로 센다. 게임 일자로 세면 첫 플레이가 길어진 만큼
       옮기는 날이 통째로 앞당겨져 "겨울에 멈춘다"가 가을에 일어난다(실제로 그랬다).
       살림·계절은 첫 플레이가 끝난 뒤에야 흐르므로, 계절을 겨냥한 각본은 튜토 일자가 맞다. */
    const tday = S.tutorial.day;
    if (tday === 12) movePot(S, DARK);          // 어두운 데로
    if (tday === 37) movePot(S, SILL);          // 다시 창턱으로
    if (tday === 142) movePot(S, DARK);         // 겨울에 다시 멈춘다
    /* 병을 하나 시켜 두고, 오면 잎 1장짜리 마디를 한 번 자른다 */
    const pot = pot0(S);
    if (pot && !(pot.cuts || []).length) {
      if (stockOf(S, 'jar') + incomingOf(S, 'jar') === 0)
        try { orderItem(S, 'jar', 1); } catch { /* 돈이 모자라면 다음 날 */ }
      else if (stockOf(S, 'jar') >= 1) {
        const nodes = cuttableNow(S, io.growth.cuttableNodes());
        const one = nodes.find(n => n.leaves === 1);
        if (one) try { takeCutting(S, { nodes, nodeId: one.nodeId, container: 'jar' }); }
                 catch { /* 규칙대로 막힌 것이다 */ }
      }
    }
    return [];
  }
});

/* D — 돈은 됐는데 배움이 모자란 경우. ★콩나물을 **밝은 자리**에 두면 ②가 영영 안 켜진다. */
const D = play({
  cropSlot: BRIGHT_CROP, plantSlot: SILL, incomeWon: 120_000, days: 40
});

info(`A 이사 Day ${A.rows[A.rows.length - 1].day} (${A.rows[A.rows.length - 1].season} ` +
     `${A.rows[A.rows.length - 1].seasonDay + 1}일째) · ${A.rows.length}턴`);
info(`B 이사 Day ${B.rows[B.rows.length - 1].day} · 식물등 ${B.S.tutorial.lamp.owned}개`);
info(`C 마지막 Day ${C.rows[C.rows.length - 1].day} (${C.rows[C.rows.length - 1].season}) · 이사 ${C.S.tutorial.movedOut}`);
info(`D 마지막 Day ${D.rows[D.rows.length - 1].day} · 배운 것 ${Object.values(D.S.tutorial.learned).filter(Boolean).length}/4`);
const cGrant = C.rows.find(r => r.events.includes('varie_granted'));
info(`C 확정 무늬 — ${cGrant ? `Day ${cGrant.day}(튜토 ${cGrant.tday}일 · ${cGrant.season})` : '안 남'} ` +
     `· 가을 진입은 튜토 ${varieGrantOpensDay(C.S.tutorial)}일`);

/* ══ ⑴ 말 없는 날이 연속 3일을 넘지 않는다 ══════════════════════════════ */
const MAX_SILENT_DAYS = 3;
for (const [name, run] of [['A 가을 이사', A], ['B 등 사고 이사', B], ['C 겨울', C]]) {
  check(`⑴ ${name} — 말 없는 날이 연속 ${MAX_SILENT_DAYS}일을 안 넘는다`, () => {
    const s = longestSilence(run.rows);
    assert.ok(s.days <= MAX_SILENT_DAYS,
      `Day ${s.from}~${s.to} 가 ${s.days}일 동안 조용합니다 (상한 ${MAX_SILENT_DAYS}일)`);
    info(`${name} 최장 침묵 ${s.days}일` + (s.days ? ` (Day ${s.from}~${s.to})` : ''));
  });
}

/* ══ ⑵ 반드시 다뤄야 할 사건이 전부 실제로 발현된다 ═════════════════════
   박사님 지시의 목록 그대로다. **이벤트가 났다**와 **대사가 나왔다**를 둘 다 본다 —
   이벤트만 나고 대사가 없으면 화면에서는 아무 일도 안 일어난 것과 같다. */
const MUST = [
  ['첫 월세 고지가 다가옴',      'rent_soon',           'rentSoon',            [A, B, C]],
  ['첫 월세 청구',               'rent',                'rentFirst',           [A, B, C]],
  ['둘째 달 월세',               'rent',                'rentAgain',           [C]],
  ['가을 진입',                  'season',              'autumnCame',          [A, B, C]],
  ['겨울 진입',                  'season',              'winterCame',          [C]],
  ['식물등이 열림',              'lamp_unlocked',       'lampUnlocked',        [A, B, C]],
  ['식물등을 샀을 때',           'lamp_bought',         'lampBought',          [B]],
  ['안 사고 버틸 때',            'lamp_skipped',        'lampSkipped',         [A, C]],
  ['성장이 멈췄을 때',           'plant_stalled',       'plantStalled',        [C]],
  ['또 멈췄을 때',               'plant_stalled_again', 'plantStalledAgain',   [C]],
  ['겨울에 멈췄을 때',           'plant_stalled_winter','plantStalledWinter',  [C]],
  ['다시 자랄 때',               'plant_resumed',       'plantResumed',        [C]],
  ['배움 ① 첫 수확·식비 절감',   'learn_harvest',       'learnHarvest',        [A, B, C]],
  ['배움 ② 콩나물을 어두운 데',  'learn_cropDark',      'learnCropDark',       [A, B, C]],
  ['배움 ③ 몬스테라를 밝은 데',  'learn_plantWindow',   'learnPlantWindow',    [A, B, C]],
  ['배움 ④ 말린 새순',           'learn_spear',         'learnSpear',          [A, B, C]],
  ['돈이 모자랄 때',             'move_short_money',    'shortMoney',          [A, B, C]],
  ['배움이 모자랄 때',           'move_short_learn',    'shortLearn',          [D]],
  ['이사할 수 있게 됐을 때',     'move_ready',          'moveReady',           [A, B]],
  ['★이사 나가는 순간',          'moved_out',           'movedOut',            [A, B]],
  ['겨울까지 못 나간 경우',      'winter_still',        'winterStill',         [C]],
  ['돈이 다 떨어졌을 때',        'broke',               'brokeTalk',           [C]],
  /* ★튜토의 마지막 장면. 이벤트만 나고 대사가 없으면 화면에서는 아무 일도 안 일어난 것과 같다 —
     실제로 2026-08-03 이전이 그 상태였다(varie_granted 에 대사가 없었다). */
  ['★확정 무늬가 난 날',         'varie_granted',       'varieGranted',        [C]]
];
const RUN_KO = new Map([[A, 'A'], [B, 'B'], [C, 'C'], [D, 'D']]);
for (const [ko, eventId, scriptId, runs] of MUST) {
  check(`⑵ ${ko}`, () => {
    const hitEv = runs.filter(r => r.events.has(eventId));
    assert.ok(hitEv.length, `이벤트 '${eventId}' 가 어느 경로에서도 안 났습니다 ` +
      `(${runs.map(r => RUN_KO.get(r)).join('·')})`);
    const hitSc = runs.filter(r => r.said.has(scriptId));
    assert.ok(hitSc.length, `이벤트는 났는데 대사 '${scriptId}' 가 안 나왔습니다 — ` +
      `화면에서는 아무 일도 안 일어난 것과 같습니다`);
  });
}

/* ★첫 플레이 세 장면도 같이 지킨다 — 여기가 깨지면 first_play.md §2 계약이 깨진 것이다 */
check('⑵ 첫 플레이 — 수확은 먼저, 식물신은 도착 바로 앞이다', () => {
  /* ★★ 2026-08-04 — **두 장면이 갈렸다.**
       첫 수확 날   수확 대사(harvest)
       3회전째 날   식물신(god1) → 도착(monsteraArrived)
     선물이 첫 수확에서 3회전째로 밀리면서(first_play.monsteraArrivalDue) 식물신도
     "주는 순간" 쪽으로 따라갔다(dialogue.scriptsForEvents). 지켜야 할 것은 하나다 —
     **식물신이 도착보다 뒤로 밀리면 안 된다**(first_play.md §2). */
  const hRow = A.rows.findIndex(r => r.said.includes('harvest'));
  assert.ok(hRow >= 0, '수확 대사가 안 나왔습니다');
  const aRow = A.rows.findIndex(r => r.said.includes('monsteraArrived'));
  assert.ok(aRow >= 0, '도착 대사가 안 나왔습니다');
  /* 도착이 몇 회전째인가는 first_play.MONSTERA_ARRIVAL_RULE 이 정한다 — 지금은 1 이라
     수확과 **같은 날**이다. 그 값이 오르면 도착이 뒤 날로 간다. 어느 쪽이든 앞서면 안 된다. */
  assert.ok(hRow <= aRow, '★수확보다 도착이 먼저 났습니다');
  const day4 = A.rows[aRow];
  const i = day4.said.indexOf('god1'), j = day4.said.indexOf('monsteraArrived');
  assert.ok(i >= 0, `Day ${day4.day} 에 식물신이 안 실렸습니다: ${day4.said}`);
  assert.equal(i, j - 1, `★식물신이 도착 바로 앞이 아닙니다: ${day4.said.join(' → ')}`);
  assert.ok(A.said.has('spearFurled'), '말린 새순 대사가 안 나왔습니다');
});

/* ══ ⑶ 같은 말이 연달아 두 번 나오지 않는다 ═════════════════════════════ */
for (const [name, run] of [['A', A], ['B', B], ['C', C], ['D', D]]) {
  check(`⑶ ${name} — 같은 대사가 연달아 두 번 안 나온다`, () => {
    const seq = run.saidSeq;
    for (let i = 1; i < seq.length; i++)
      assert.notEqual(seq[i], seq[i - 1], `'${seq[i]}' 가 연달아 두 번 나왔습니다(${i}번째)`);
    /* 한 번뿐이어야 할 대사가 두 번 나오지도 않는다 */
    const once = seq.filter(id => !REPEATABLE.has(id));
    const dup = once.filter((id, i) => once.indexOf(id) !== i);
    assert.equal(dup.length, 0, `한 번뿐이어야 할 대사가 다시 나왔습니다: ${[...new Set(dup)]}`);
  });
}
check('⑶ 한 번뿐인 대사는 대화 상자가 막는다 · 다시 나올 것은 통과시킨다', () => {
  const dlg = createDialogue();
  assert.equal(dlg.push('intro'), true);
  assert.equal(dlg.push('intro'), false, '★한 번뿐인 대사가 두 번 들어갔습니다');
  assert.equal(dlg.push('chatQuiet'), true);
  assert.equal(dlg.push('chatQuiet'), true, '작은 말은 다시 나올 수 있어야 합니다');
  assert.deepEqual(dlg.recentList(), ['intro', 'chatQuiet', 'chatQuiet'], '나온 차례가 안 남습니다');
});
check('⑶ 작은 말 고르기 — 가장 오래 안 나온 것부터 나온다', () => {
  const ctx = { season: 'summer', living: true };
  const recent = [];
  const seen = [];
  for (let i = 0; i < 8; i++) { const id = pickChatter(ctx, recent); recent.push(id); seen.push(id); }
  for (let i = 1; i < seen.length; i++)
    assert.notEqual(seen[i], seen[i - 1], `연달아 같은 작은 말: ${seen.join(' ')}`);
  assert.ok(new Set(seen).size >= 4, `여름 살림 표본이 너무 얕습니다: ${new Set(seen).size}가지`);
});

/* ══ ⑷ 표정 파일이 실제로 있다 ══════════════════════════════════════════
   ★표정 표(FACE_FILE)의 정본은 game.html 이다. 여기서 베끼면 두 표가 갈리므로
     **읽어서 대조**한다 — 베낀 표는 조용히 낡는다. */
check('⑷ 표정 — 대사가 가리키는 초상화 파일이 전부 있다', () => {
  const html = readFileSync(U('../game.html'), 'utf8');
  const m = html.match(/const FACE_FILE = \{([\s\S]*?)\n\};/);
  assert.ok(m, 'game.html 에서 FACE_FILE 을 못 찾았습니다 — 표정 대조를 못 합니다');
  const FACE_FILE = {};
  for (const line of m[1].split('\n')) {
    const who = line.match(/^\s*(\w+)\s*:\s*\{/);
    if (who) FACE_FILE[who[1]] = {};
    const target = Object.keys(FACE_FILE).pop();
    if (!target) continue;
    for (const kv of line.matchAll(/(\w+)\s*:\s*'([^']+)'/g)) FACE_FILE[target][kv[1]] = kv[2];
  }
  assert.ok(FACE_FILE.jachwi && FACE_FILE.moni, `FACE_FILE 을 못 읽었습니다: ${Object.keys(FACE_FILE)}`);

  const missingKey = [], missingFile = [];
  for (const [id, lines] of Object.entries(SCRIPTS)) {
    for (const l of lines) {
      const sp = SPEAKERS[l.who];
      assert.ok(sp, `${id}: 없는 화자 '${l.who}'`);
      if (!sp.portrait) continue;                       // ★god 은 얼굴이 없다
      const key = l.face || 'base';
      const file = (FACE_FILE[l.who] || {})[key];
      if (!file) { missingKey.push(`${id}: ${l.who}.${key}`); continue; }
      const path = `../assets/characters/portraits/portrait_${l.who}_${file}.png`;
      if (!existsSync(U(path))) missingFile.push(`${id}: ${path}`);
    }
  }
  assert.equal(missingKey.length, 0,
    `game.html 의 FACE_FILE 에 없는 표정 키 — 조용히 기본 얼굴로 떨어집니다:\n      ${missingKey.join('\n      ')}`);
  assert.equal(missingFile.length, 0,
    `가리키는 초상화 파일이 없습니다:\n      ${missingFile.join('\n      ')}`);
});

/* ══ ⑸ 식물신은 외형이 없다 ═════════════════════════════════════════════ */
check('⑸ 식물신 — 외형 없음(portrait:false) 계약이 안 깨졌다', () => {
  assert.equal(SPEAKERS.god.portrait, false, '★식물신에게 초상화가 생겼습니다');
  assert.equal(SPEAKERS.god.ko, '?', '★식물신에게 이름이 생겼습니다 — 아직 정하지 않기로 했습니다');
  const godLines = Object.entries(SCRIPTS)
    .flatMap(([id, ls]) => ls.filter(l => l.who === 'god').map(l => ({ id, l })));
  assert.ok(godLines.every(x => !x.l.face),
    `★식물신 대사에 표정이 붙었습니다: ${godLines.filter(x => x.l.face).map(x => x.id)}`);
  /* ★아껴 쓴다 — 반지하 구간 전체에서 셋(도착·말린 새순·이사)뿐이다 */
  const scripts = [...new Set(godLines.map(x => x.id))];
  assert.deepEqual(scripts.sort(), ['god1', 'movedOut', 'spearFurled'],
    `식물신이 나오는 자리가 늘었습니다: ${scripts}`);
  assert.equal(godLines.length, 3, `★식물신 대사가 ${godLines.length}줄입니다 — 자리마다 한 줄이어야 합니다`);
});

/* ══ ⑹ 이사 장면 ═══════════════════════════════════════════════════════ */
check('⑹ 이사 — 실제로 대사가 나오고, 마지막 말이 다음 방을 가리킨다', () => {
  const last = A.rows[A.rows.length - 1];
  assert.ok(last.said.includes('movedOut'), `마지막 턴에 이사 대사가 없습니다: ${last.said}`);
  assert.equal(A.S.tutorial.movedOut, true);
  const lines = SCRIPTS.movedOut;
  assert.ok(lines.length >= 8, `이사 장면이 ${lines.length}줄입니다 — 정점치고 짧습니다`);
  assert.ok(lines.some(l => l.who === 'god'), '이사 장면에 식물신 한 줄이 없습니다');
  assert.equal(lines[lines.length - 1].who, 'moni', '마지막 말은 몬이가 합니다');
  assert.match(lines[lines.length - 1].text, /창/, '마지막 말이 다음 방의 창을 안 가리킵니다');
});

/* ══ 데이터 위생 ═══════════════════════════════════════════════════════ */
check('데이터 — 모든 대사에 화자와 내용이 있다', () => {
  for (const [id, lines] of Object.entries(SCRIPTS)) {
    assert.ok(Array.isArray(lines) && lines.length, `${id}: 대사가 비었습니다`);
    for (const l of lines) {
      assert.ok(SPEAKERS[l.who], `${id}: 없는 화자 '${l.who}'`);
      assert.equal(typeof l.text, 'string', `${id}: text 가 문자열이 아닙니다`);
      assert.ok(l.text.length, `${id}: 빈 대사가 있습니다`);
      /* **굵게** 는 짝이 맞아야 한다 — 안 맞으면 화면에 별표가 그대로 뜬다 */
      assert.equal((l.text.match(/\*\*/g) || []).length % 2, 0, `${id}: 굵게 표시 짝이 안 맞습니다 — ${l.text}`);
    }
  }
});
check('데이터 — 이벤트 표가 가리키는 대사가 전부 있다', () => {
  for (const [ev, id] of Object.entries(EVENT_SCRIPT))
    assert.ok(SCRIPTS[id], `이벤트 ${ev} → 없는 대사 '${id}'`);
  for (const c of CHATTER) assert.ok(SCRIPTS[c.id], `작은 말 목록에 없는 대사 '${c.id}'`);
  for (const id of REPEATABLE) assert.ok(SCRIPTS[id], `다시 나올 수 있다고 적힌 없는 대사 '${id}'`);
  /* ★ 2026-08-17 — 퀘스트 두 지도도 같이 본다 */
  for (const [q, id] of Object.entries(QUEST_OPEN_SCRIPT))
    assert.ok(SCRIPTS[id], `퀘스트 ${q} 열림 → 없는 대사 '${id}'`);
  for (const [q, id] of Object.entries(QUEST_DONE_SCRIPT))
    assert.ok(SCRIPTS[id], `퀘스트 ${q} 완료 → 없는 대사 '${id}'`);
});
/* ★★★ 2026-08-29 — **「아직 안 쓰는 대사」는 «흠»이 아니라 «상태»다** ([Plan] ㊿-c).
   ⛔ 지우지 말 것. 까닭을 여기 적는다.
   monsteraStalled — 「원룸(이사 뒤) 멈춤」용이다.
     ⚠ `monsteraGuideWindow` 와 **겹치지 않는다** — 저쪽은 「창턱」이라 **불러 주고**,
       이쪽은 「더 밝은 자리를 찾아 보자」로 **안 불러 준다**(dialogue.js:252 가 「헷갈리지 말라」고 적었다).
     ★ 이름을 **안 부르는** 말이라 **어느 방에서나** 쓴다. 원룸에는 창턱이 다르다.
     ⇒ 붙일 자리는 원룸이 열릴 때 정한다(2026-08-29 plan 판단).
     ⚠ dialogue.js:233 의 「지우는 것이 맞아 보인다」는 **2026-08-11** 판단이고,
       그때는 **원룸이 없었다.** 그 줄은 낡았다. */
const NOT_YET_USED = new Set(['monsteraStalled']);
/* ★★★ 2026-08-29 [Plan] ㎙-d — **검사는 자기가 «어디까지 재는지»를 «이름»에 적는다.**
     ⛔ 옵 이름은 「쓰이지 «않는» 대사가 «없다»」였다 — 「없다」고 말하는 검사는
       「**다 봤다**」는 뜻이 된다. 그런데 이 검사가 보는 것은 ★ 「«불리는» 자리가 있나」까지다.
     ⚠ `monsteraMoved` 가 오늘 그랬다 — **불리기는 불렸는데 조건이 죽어** 있었다.
       그때도 이 검사는 «초록»이었고, 사람은 그 대사를 한 번도 못 봤다.
     ⇒ ★★ 「닿나」는 **판을 굴려야** 답한다(비싸다). 이 검사는 **코드가 답한다**(싸다).
       둘 다 있어야 하고, ★ **다른 이름으로 불려야 한다.** 하나가 다른 하나인 «척»하면 그것이 ㎙-b2 다. */
check('데이터 — 대사마다 «부르는 자리»가 있다 («불린다»까지만 본다)', () => {
  /* ★★★★ 2026-08-29 — **손으로 박던 것을 «세는 것»으로 바꿨다** ([Plan] ㊿-c · cc7a8d4)
     ══════════════════════════════════════════════════════════════════
     ⛔ 여기 아홉 이름이 **손으로** 박혀 있었다. 그중 둘이 이러했다:
```
       monsteraStalled  dialogue.js:233 이 «스스로» 「아무 데서도 안 불린다」고 적었다
                        ⇒ ★ 그런데 이 목록이 그것을 «정상»으로 못 박고 있었다
       monsteraMoved    ⇒ 불리기는 «불렸다». ⛔ 그런데 «조건이 죽어» 있었다(arrivalSlotId)
                        ⇒ ⇒ ★★ 자는 「불린다」만 보고 「닿는다」는 안 봤다
```
     ⇒ ★★ 고침 둘:
       ㉮ **`dlgOpen('...')` 를 `game.html` 에서 «긁어» 센다.** 손으로 안 적는다 —
          손으로 적으면 부르는 자리가 늘 때마다 이 목록이 낡는다(바로 위 §퀘스트 지도와 같은 규율).
       ㉯ ★ **「아직 안 쓰는 대사」 갈래를 «따로» 둔다.** 「안 쓴다」는 «흠»이 아니라 «상태»다.
          그리고 **까닭을 적는다** — 다음 사람이 「지워도 되나」를 다시 묻지 않게.
     ★★★ 그리고 **그 갈래가 «변하면 자가 운다»** — 아래 두 번째 검사가 그 일을 한다.
       「아직 안 쓴다」고 적어 둔 것이 실제로 «쓰이기 시작하면» 이 목록에서 빼라고 말한다.
       ⇒ 안 그러면 오늘 고친 그 병(박아 두고 잊기)이 그대로 되살아난다. */
  const html = readFileSync(U('../game.html'), 'utf8');
  const calledInHtml = [...html.matchAll(/dlgOpen\(\s*'([A-Za-z0-9_]+)'\s*\)/g)].map(m => m[1]);
  const used = new Set([
    ...Object.values(EVENT_SCRIPT), ...CHATTER.map(c => c.id),
    /* ★ 2026-08-17 — **손으로 안 적는다.** 퀘스트 대사는 지도에서 읽는다 —
       손으로 적으면 줄이 늘 때마다 이 목록이 낡고, 그게 START-HERE §2 가 "제일 위험하다"고
       적은 모양(검사가 고장난 상태를 정상으로 못 박는 것)의 씨앗이다. */
    ...Object.values(QUEST_OPEN_SCRIPT), ...Object.values(QUEST_DONE_SCRIPT),
    /* ★ 2026-08-29 — 화면이 직접 부르는 것은 **긁어서** 센다(§㉮) */
    ...calledInHtml,
    /* ⚠ 아래 다섯만 남는다 — **코드에서 이름이 안 보이는** 길들이다.
       god1        dialogue.js 가 순서를 맞추며 `out.splice(arr, 0, 'god1')` 로 끼워 넣는다
       나머지 넷    `scriptOf` 가 **id 안에서** 가른다(계절·월세). 이벤트 표에는 한 이름뿐이다 */
    'god1', 'rentFirst', 'rentAgain', 'autumnCame', 'winterCame'
  ]);
  const dead = Object.keys(SCRIPTS).filter(id => !used.has(id) && !NOT_YET_USED.has(id));
  assert.equal(dead.length, 0, `아무 데서도 안 불리는 대사: ${dead}`);
});
check('데이터 — 「아직 안 쓰는 대사」 목록이 안 낡았다', () => {
  const html = readFileSync(U('../game.html'), 'utf8');
  const calledInHtml = new Set([...html.matchAll(/dlgOpen\(\s*'([A-Za-z0-9_]+)'\s*\)/g)].map(m => m[1]));
  const wired = new Set([...Object.values(EVENT_SCRIPT), ...CHATTER.map(c => c.id),
    ...Object.values(QUEST_OPEN_SCRIPT), ...Object.values(QUEST_DONE_SCRIPT), ...calledInHtml]);
  for (const id of NOT_YET_USED) {
    assert.ok(SCRIPTS[id], `「아직 안 쓴다」고 적힌 없는 대사 '${id}' — 목록에서 빼십시오`);
    /* ★ 쓰이기 시작했으면 **자가 운다.** 박아 두고 잊는 것이 오늘 고친 그 병이다 */
    assert.ok(!wired.has(id),
      `'${id}' 는 이제 쓰입니다 — 「아직 안 쓰는 대사」 목록(NOT_YET_USED)에서 빼십시오`);
  }
});
check('데이터 — 계절·월세는 같은 이벤트 안에서 갈린다', () => {
  assert.deepEqual(scriptsForEvents([{ id: 'season', season: 'autumn' }]), ['autumnCame']);
  assert.deepEqual(scriptsForEvents([{ id: 'season', season: 'winter' }]), ['winterCame']);
  assert.deepEqual(scriptsForEvents([{ id: 'season', season: 'spring' }]), []);
  assert.deepEqual(scriptsForEvents([{ id: 'rent', first: true }]), ['rentFirst']);
  assert.deepEqual(scriptsForEvents([{ id: 'rent', first: false }]), ['rentAgain']);
  assert.deepEqual(scriptsForEvents([]), []);
  assert.deepEqual(scriptsForEvents(null), []);
});

/* ── 보고 ─────────────────────────────────────────────────────────────── */
let fail = 0;
for (const [st, name, msg] of results) {
  if (st === 'INFO') { console.log(name); continue; }
  if (st === 'FAIL') fail++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\ndialogue_coverage: FAIL (${fail}건)` : '\ndialogue_coverage: PASS');
process.exit(fail ? 1 : 0);
