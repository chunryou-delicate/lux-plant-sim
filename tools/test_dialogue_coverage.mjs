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
import { chatterContext as chatterContextOf } from '../src/game/dialogue.js';   /* ★ D78 귀띔 조건 */
import { CARE_SCRIPT } from '../src/game/dialogue.js';                         /* ★ D72 B 돌봄 고장 대사 지도 */
import { JOB_REST_TODO, questOf } from '../src/game/quest.js';                 /* ★ D72 D 나머지 쉬는 중 글 · D85 간판 줄 kept */
import { SHOP_JOB } from '../src/game/job_shop.js';                            /* ★ D72 D 나머지 칭호(core 값과 같은 말) */
import { CARE_JOB } from '../src/game/job_care.js';
import { createProfileLight } from '../src/game/room_profile.js';
import { newState, pot0, setPotSlot, waterCrop, waterPot, resowCrop, ARRIVAL } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, moveMonstera,
         beansproutReady, cropSites } from '../src/game/first_play.js';   /* cropSites — ★ D92 이삿짐 판 */
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

/* ★ 2026-10-30 [core] 총괄 D90 ② ⓑ — 화면처럼 첫 등을 **가방에** 넣는다(game.html §첫 등을 가방에 · 코어는 신호만 낸다).
     lamp_skipped 가 «가진 등 ≥ 1 · 단 등 0»으로 바뀌어(tutorial.js) 순수 코어 판(등 0)에서는 안 난다 — 사람 판과 같게 받은 등을 쥐여 준다.
     안 단 등은 S.lamps.count 0 이라 빛도 전기세도 안 바뀐다(loop §lampCount = S.lamps.count) */
const giftLamp = ts => { if (ts.lamp.unlocked && !ts.lamp.owned && !ts.lamp.placed) ts.lamp.owned = 1; };

/* A — 식물등 없이 가을 안에 이사(★ 10-30 — 공짜 등은 가방에 두고 안 단다) */
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
    giftLamp(ts);                           // ★ 10-30 — 위 §giftLamp
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
      /* ★ 2026-10-30 [core] D90 ② ⓑ — 사서 **단다**(화면 §placeLampFromBag 과 같게 placed 를 올린다). 안 올리면 «안 단 등» 독촉이 B 에서 난다 */
      ts.lamp.placed = ts.lamp.owned;
      S.lamps.count = ts.lamp.placed; io.light.clearCache();
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
    giftLamp(S.tutorial);                       // ★ 10-30 — 위 §giftLamp(받은 등을 안 단다)
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
  /* ★ 2026-10-08 [plan] D20 — 겨울은 방으로 갈린다(dialogue.js §winterCameBanjiha). C 는 반지하에서 겨울을 맞는 판이라 반지하 줄이다 */
  ['겨울 진입',                  'season',              'winterCameBanjiha',   [C]],
  ['식물등이 열림',              'lamp_unlocked',       'lampUnlocked',        [A, B, C]],
  ['식물등을 샀을 때',           'lamp_bought',         'lampBought',          [B]],
  /* ★ 2026-10-30 [core] D90 ② ⓑ — «안 사고»가 아니라 «받은 등을 안 달고»(A · C 는 §giftLamp 로 가방에만 둔다) */
  ['받은 등을 안 달고 버틸 때',  'lamp_skipped',        'lampSkipped',         [A, C]],
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
/* ★ 2026-10-10 [plan] 박사님 «직업이랑 남녀별로 추후에 분기되도록» — 주인공 성별이 드러나는 낱말이 대사에 들어오면 빨강.
     성별은 «모습»(초상·3D·옷)만 갈리고 대사는 안 갈린다(plan-branch-job-gender-20261010 §2-3). 한 번 샜다: 손님 표 «총각»(c13b4f0e 전에 고침).
     ⚠ «형»은 «형광·형편·모형» 속에도 있어 «형님»만 본다. «학생 · 엄마 아빠 · 아저씨(남을 가리킴)»는 성별이 없거나 주인공이 아니다. */
check('데이터 — 주인공 성별 낱말이 없다 (자취생·몬이 줄 · 손님 표)', () => {
  const BAD = /(언니|오빠|누나|형님|아가씨|총각|자취녀|자취남|그녀)/;
  const hits = [];
  for (const [id, lines] of Object.entries(SCRIPTS))
    for (const l of lines) if ((l.who === 'jachwi' || l.who === 'moni') && BAD.test(String(l.text || ''))) hits.push(`${id}: ${l.text}`);
  const cust = JSON.parse(readFileSync(U('../data/balance/shop_customers.json'), 'utf8'));
  for (const c of cust.customers || []) for (const k of ['ask', 'thanks']) if (BAD.test(String(c[k] || ''))) hits.push(`손님 ${c.id}.${k}: ${c[k]}`);
  assert.equal(hits.length, 0, '주인공 성별이 드러나는 낱말:\n      ' + hits.join('\n      '));
});
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
  /* ★★★ 2026-08-30 — **「하나도 못 찾는 것」도 고장이다** ([Char] 이 오늘 세운 관문).
     ⚠ 이 긁기가 언젠가 깨지면(부르는 꼴이 바뀌거나 정규식이 상하면) `calledInHtml` 이 빈 배열이 된다.
       ⇒ 그러면 아래 「안 낡았나」 검사가 **조용히 초록**이 된다 — 쓰이는 것이 없다고 보니까.
     ★ [Char] 가 오늘 그러다 데였다 — 사건 30개가 «전부» 「없다」로 나왔는데 자 검사는 «통과»했다.
       「다 통과」와 「다 실패」는 **둘 다** 고장이다. */
  assert.ok(calledInHtml.length > 0,
    'game.html 에서 dlgOpen 부르는 자리를 한 개도 못 찾았습니다 — 긁는 자가 깨졌을 가능성이 큽니다');
  const used = new Set([
    ...Object.values(EVENT_SCRIPT), ...CHATTER.map(c => c.id),
    /* ★ 2026-08-17 — **손으로 안 적는다.** 퀘스트 대사는 지도에서 읽는다 —
       손으로 적으면 줄이 늘 때마다 이 목록이 낡고, 그게 START-HERE §2 가 "제일 위험하다"고
       적은 모양(검사가 고장난 상태를 정상으로 못 박는 것)의 씨앗이다. */
    ...Object.values(QUEST_OPEN_SCRIPT), ...Object.values(QUEST_DONE_SCRIPT),
    /* ★ 2026-08-29 — 화면이 직접 부르는 것은 **긁어서** 센다(§㉮) */
    ...calledInHtml,
    /* ⚠ 아래 여섯만 남는다 — **코드에서 이름이 안 보이는** 길들이다.
       god1           dialogue.js 가 순서를 맞추며 `out.splice(arr, 0, 'god1')` 로 끼워 넣는다
       나머지 다섯     `scriptOf` 가 **id 안에서** 가른다. 이벤트 표에는 한 이름뿐이다:
                      계절(autumn·winter) · 월세(first·again) · ★ 파산(첫 번·그다음)
       ★ 2026-08-30 — `brokeTalkAgain` 이 늘었다([Plan]). `broke` 사건 하나가 둘로 갈린다 —
         `ev.first` 가 거짓이면 그쪽이다(그 값은 `tutorial` 이 `reliefTaken` 으로 낸다). */
    /* ★ 2026-10-08 [plan] — `winterCameBanjiha` 가 늘었다. 겨울 `season` 하나가 방(S.tutorial.movedOut · ev.movedOut)으로 둘로 갈린다 */
    /* ★ 2026-10-08 [plan] — `hungryTalk2` 가 늘었다. `hungry` 사건 하나가 남은 날 홀/짝으로 두 벌을 번갈아 쓴다(같은 말이 연달아 안 서게) */
    /* ★ 2026-10-08 [plan] — 삽수 사건 갈림(scriptOf): 경고 마지막 날 · 뿌리낸 밝기 둘(중간은 이벤트 표 이름) */
    'god1', 'rentFirst', 'rentAgain', 'autumnCame', 'winterCame', 'winterCameBanjiha', 'brokeTalkAgain', 'hungryTalk2',
    'cuttingWarnLast', 'cuttingVarieBright', 'cuttingVarieDark',
    /* ★ 2026-10-09 [plan] — 원룸 철 셋(season 사건이 방으로 갈림) */
    'springCameOneroom', 'summerCameOneroom', 'autumnCameOneroom',
    /* ★ 2026-10-09 [plan] — 월세 두 벌 번갈아(rent·rent_soon 이 낸 달 수 홀/짝으로 갈림) */
    'rentAgain2', 'rentSoon2',
    /* ★ 2026-10-09 [plan] D43 — 원룸 도착(moved_in_oneroom) 날 들고 온 삽수가 가방에 있으면 scriptsForEvents 가 도착 장면 뒤에 붙인다 */
    'movedInBagCuttings',
    /* ★ 2026-10-31 [plan] D92 — 같은 자리에 이삿짐(들고 온 채소)이 가방에 있으면 그 뒤에 */
    'movedInBagCrops',
    /* ★ 2026-10-09 [plan] D45 — 새 종 사건 갈림(scriptOf): 교환 두 번째 물음·두 번째 거절 · 구근 싹 무늬/민무늬 */
    'ppTradeOfferAgain', 'ppTradeDeclinedLast', 'alSproutVarie', 'alSproutPlain',
    /* ★ 2026-10-09 [plan] D52 — 잠드는 날 구근(al_asleep corms > 0) · 두 번째 깸(al_wake first false) */
    'alAsleepCorms', 'alWakeAgain',
    /* ★ 2026-10-10 [plan] D59 — 식물 가게 사건 갈림(scriptOf): 납품 새 단골 · 단골 이정표 3/10/30 */
    'shopNewRegular', 'shopRegulars3', 'shopSign', 'shopTown', 'shopNoSpeciesPP',
    /* ★ 2026-10-23 [plan] D79 ㉡ — 가게 판 굶음 갈래(scriptOf hungry · 진로 shop · 산 투룸 · 홀수 날) */
    'hungryShop',
    /* ★ 2026-10-23 [plan] D75 ⑤ — 가게 끝맺음 둘째 줄 갈래(scriptOf shop_ending · ev.fewPlants) */
    'shopEndingFew',
    /* ★ 2026-10-23 [plan] D72 B — 돌봄 사건 갈림(scriptOf): 진로 첫날 · 고장마다 세 줄(CARE_SCRIPT) · 이정표 3/10/30 */
    'jobStartCare', 'careMilestone3', 'careMilestone10', 'careMilestone30',
    /* ★ 2026-10-24 [plan] D72 C — 육종 사건 갈림(scriptOf): 진로 첫날 · 줄마다 첫 표본 · 이정표 1/3/5 */
    'jobStartBreed', 'breedFirstMonstera', 'breedFirstAl', 'breedFirstPp', 'breedMilestone1', 'breedMilestone3', 'breedMilestone5',
    /* ★ 2026-10-24 [plan] D72 D 나머지 — 바꾸기 갈림(scriptOf): 옮긴 날 · 돌아간 날 · 판을 이어 쓴 날 */
    'jobSwitch', 'jobSwitchCare', 'jobSwitchBreed', 'jobBack', 'shopOpenKept', 'careOpenKept',
    /* ★ 2026-10-24 [plan] D85 ③ — 간판 한 자리 갈림(scriptOf): 10 이정표 signKept · 간판 줄 kept */
    'shopSignKept', 'careMilestone10Kept', 'questShopSignKept', 'questDoneShopSignKept', 'questCareSignKept', 'questDoneCareSignKept',
    ...Object.values(CARE_SCRIPT).flatMap(m => [m.new, m.stuck, m.saved])
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
  assert.deepEqual(scriptsForEvents([{ id: 'season', season: 'winter' }]), ['winterCame']);   // 방을 모르면 예전 그대로
  assert.deepEqual(scriptsForEvents([{ id: 'season', season: 'winter' }], { tutorial: { movedOut: false } }), ['winterCameBanjiha']);
  assert.deepEqual(scriptsForEvents([{ id: 'season', season: 'winter' }], { tutorial: { movedOut: true } }), ['winterCame']);
  assert.deepEqual(scriptsForEvents([{ id: 'season', season: 'winter', movedOut: false }]), ['winterCameBanjiha']);
  assert.deepEqual(scriptsForEvents([{ id: 'season', season: 'spring' }]), []);
  assert.deepEqual(scriptsForEvents([{ id: 'rent', first: true }]), ['rentFirst']);
  assert.deepEqual(scriptsForEvents([{ id: 'rent', first: false }]), ['rentAgain']);
  assert.deepEqual(scriptsForEvents([]), []);
  assert.deepEqual(scriptsForEvents(null), []);
});

/* ★ 2026-10-23 [plan] D78 — 스킨답서스 «높이» 귀띔은 sc_hang 이 열려 있고 이레 넘게 다 낮은 자리일 때만 */
check('잡담 — hintScHang 는 sc_hang 열림 + 낮은 자리 이레일 때만(D78)', () => {
  const row = CHATTER.find(r => r.id === 'hintScHang');
  assert.ok(row && SCRIPTS.hintScHang, 'hintScHang 줄·대사가 없습니다');
  assert.ok(!REPEATABLE.has('hintScHang'), '한 번만 하는 말인데 되풀이 목록에 있습니다');
  const S = { stamina: { questsOpenedOn: { sc_hang: 880 }, questsTaken: [] } };
  const ctxOf = (d) => chatterContextOf({ day: 900, scLowDays: d }, S);
  assert.equal(row.when(ctxOf(7)), true, '이레째인데 안 섭니다');
  assert.equal(row.when(ctxOf(6)), false, '엿새째에 섭니다');
  assert.equal(row.when(ctxOf(null)), false, '모르는데(null) 섭니다');
  const done = { stamina: { questsOpenedOn: { sc_hang: 880 }, questsTaken: ['sc_hang'] } };
  assert.equal(row.when(chatterContextOf({ day: 900, scLowDays: 9 }, done)), false, 'sc_hang 을 끝냈는데 섭니다');
  assert.equal(row.when(chatterContextOf({ day: 900, scLowDays: 9 }, { stamina: { questsOpenedOn: {}, questsTaken: [] } })), false, 'sc_hang 이 안 열렸는데 섭니다');
});

/* ★ 2026-10-23 [plan] D79 — 주문 가뭄 귀띔은 가게 판 + 열린 주문 0건 스무하루일 때만 */
check('잡담 — hintShopDry 는 가게 판 + 열린 주문 0건 스무하루일 때만(D79)', () => {
  const row = CHATTER.find(r => r.id === 'hintShopDry');
  assert.ok(row && SCRIPTS.hintShopDry, 'hintShopDry 줄·대사가 없습니다');
  assert.ok(!REPEATABLE.has('hintShopDry'), '한 번만 하는 말인데 되풀이 목록에 있습니다');
  const shopS = { story: { job: { id: 'shop', since: 600 } }, home: { room: 'tworoom' } };
  const at = (d, S = shopS, extra = {}) => row.when({ ...chatterContextOf({ day: 900, shopOrderDryDays: d }, S), ...extra });
  assert.equal(at(21, shopS, { movedHome: true, jobId: 'shop' }), true, '스무하루째인데 안 섭니다');
  assert.equal(at(20, shopS, { movedHome: true, jobId: 'shop' }), false, '스무날째에 섭니다');
  assert.equal(at(null, shopS, { movedHome: true, jobId: 'shop' }), false, '모르는데(null) 섭니다');
  assert.equal(at(30, shopS, { movedHome: true, jobId: 'care' }), false, '가게 판이 아닌데 섭니다');
  assert.equal(at(30, shopS, { movedHome: false, jobId: 'shop' }), false, '산 집이 아닌데 섭니다');
});

/* ★ 2026-10-23 [plan] D79 ㉠㉡ — 투룸 «시루가 밥 · 식물이 돈» */
check('대사 — 가게 판 굶음은 홀수 날 «팔고, 시루부터»(hungryShop) · 짝수 날·가게 밖은 예전 그대로(D79)', () => {
  const shopS = { story: { job: { id: 'shop', since: 600 } }, home: { room: 'tworoom' }, tutorial: { movedOut: true, homeOwned: true } };
  const oneS = { tutorial: { movedOut: true }, home: { room: 'oneroom' } };
  assert.deepEqual(scriptsForEvents([{ id: 'hungry', left: 3 }], shopS), ['hungryShop']);
  assert.deepEqual(scriptsForEvents([{ id: 'hungry', left: 2 }], shopS), ['hungryTalk2']);
  assert.deepEqual(scriptsForEvents([{ id: 'hungry', left: 3 }], oneS), ['hungryTalk']);
  assert.deepEqual(scriptsForEvents([{ id: 'hungry', left: 3 }]), ['hungryTalk']);   // 판을 모르면 예전 그대로
  const careS = { story: { job: { id: 'care', since: 600 } }, home: { room: 'tworoom' } };
  assert.deepEqual(scriptsForEvents([{ id: 'hungry', left: 3 }], careS), ['hungryShop']);   // ★ D72 B — 돌봄 판도 «시루가 밥»
});
check('잡담 — chatShopSiru 는 가게 판 + 빈 시루일 때만(D79)', () => {
  const row = CHATTER.find(r => r.id === 'chatShopSiru');
  assert.ok(row && SCRIPTS.chatShopSiru, 'chatShopSiru 줄·대사가 없습니다');
  const base = { movedHome: true, jobId: 'shop' };
  assert.equal(row.when({ ...base, emptySiru: true }), true, '빈 시루가 있는데 안 섭니다');
  assert.equal(row.when({ ...base, emptySiru: false }), false, '빈 시루가 없는데 섭니다');
  assert.equal(row.when({ ...base, emptySiru: null }), false, '모르는데(null) 섭니다');
  assert.equal(row.when({ movedHome: true, jobId: 'care', emptySiru: true }), true, '돌봄 판인데 안 섭니다(D72 B — 진로가 있는 산 투룸 어디서나)');
  assert.equal(row.when({ movedHome: true, jobId: null, emptySiru: true }), false, '진로가 없는데 섭니다');
  assert.equal(row.when({ movedHome: false, jobId: 'shop', emptySiru: true }), false, '산 집이 아닌데 섭니다');
  /* 맥락 칸이 cropNow 에서 오는지(새 칸 아님) */
  const ctx = chatterContextOf({ day: 900, cropNow: { seedStock: 0, emptySiru: true, harvestTotal: 40 } }, { story: { job: { id: 'shop' } }, home: { room: 'tworoom' } });
  assert.equal(ctx.emptySiru, true, 'cropNow.emptySiru 를 못 읽습니다');
  assert.equal(row.when(ctx), true, '진짜 맥락으로 안 섭니다');
});

/* ★ 2026-10-23 [plan] D75 ⑤ — 가게 끝맺음 장면 */
check('대사 — 가게 끝맺음 shop_ending 은 여섯 줄 · 그루가 적으면 둘째 줄만 갈린다(D75 ⑤)', () => {
  assert.deepEqual(scriptsForEvents([{ id: 'shop_ending', fewPlants: false }]), ['shopEnding']);
  assert.deepEqual(scriptsForEvents([{ id: 'shop_ending', fewPlants: true }]), ['shopEndingFew']);
  assert.deepEqual(scriptsForEvents([{ id: 'shop_ending' }]), ['shopEnding']);          // 모르면 여섯 줄 그대로
  const a = SCRIPTS.shopEnding, b = SCRIPTS.shopEndingFew;
  assert.equal(a.length, 6); assert.equal(b.length, 6);
  for (let i = 0; i < 6; i++) if (i !== 1) assert.deepEqual(a[i], b[i], `${i + 1}째 줄이 갈렸습니다 — 둘째 줄만 갈려야 합니다`);
  /* 앞치마 낯 안에서만(APRON_FACES = beam · think · surprise · happy) */
  for (const l of [...a, ...b]) if (l.who === 'jachwi') assert.ok(['beam', 'think', 'surprise', 'happy'].includes(l.face), `앞치마 낯 밖 '${l.face}'`);
  /* 끝맺음 아침 장면이 같은 날 새 주문(표 밖)보다 앞 */
  assert.deepEqual(scriptsForEvents([{ id: 'order_done', newRegular: true }, { id: 'shop_ending' }]), ['shopEnding', 'shopNewRegular']);
});

/* ★ 2026-10-23 [plan] D72 B — 돌봄: 고장 표 ↔ 대사 지도 · 사건 갈림 · 잡담 */
check('데이터 — care_problems.json 고장 여덟이 대사 지도(CARE_SCRIPT)와 같은 말을 한다(D72 B)', () => {
  const T = JSON.parse(readFileSync(new URL('../data/balance/care_problems.json', import.meta.url), 'utf8'));
  const ids = T.problems.map(p => p.id);
  assert.equal(ids.length, 8, `고장이 ${ids.length}개입니다`);
  assert.deepEqual([...ids].sort(), Object.keys(CARE_SCRIPT).sort(), '표와 대사 지도의 고장이 다릅니다');
  const SPECIES = ['calathea', 'pink_princess', 'alocasia_frydek', 'scindapsus'];
  for (const p of T.problems) {
    assert.ok(SPECIES.includes(p.species), `'${p.id}' 모르는 종 '${p.species}'`);
    assert.ok(['easy', 'normal', 'hard', 'spring'].includes(p.tier), `'${p.id}' 모르는 tier '${p.tier}'`);
    assert.ok(Number.isInteger(p.unlockAtSaved) && p.unlockAtSaved >= 0, `'${p.id}' unlockAtSaved`);
    assert.ok(Array.isArray(p.seasons) && p.seasons.length, `'${p.id}' seasons`);
    assert.ok(p.ko && p.clue && p.teaches, `'${p.id}' 글 칸이 비었습니다`);
    assert.deepEqual(p.scripts, { ...CARE_SCRIPT[p.id] }, `'${p.id}' 대사 키가 지도와 다릅니다`);
    for (const k of ['new', 'stuck', 'saved']) assert.ok(SCRIPTS[p.scripts[k]], `'${p.id}' 없는 대사 '${p.scripts[k]}'`);
    assert.ok(!/(언니|오빠|누나|형님|아가씨|총각|그녀)/.test(p.clue), `'${p.id}' 손님 말에 성별 낱말`);
  }
  for (const k of ['returned', 'collected', 'cutGift', 'regularAsk']) assert.ok(T._lines && T._lines[k], `기록 줄 '${k}' 이 없습니다`);
  /* 처음 열리는 고장 셋 = 손 셋(자리 · 가위 · 기다림) 하나씩 */
  assert.deepEqual(T.problems.filter(p => p.unlockAtSaved === 0).map(p => p.id).sort(), ['al_dark', 'ca_bright', 'pp_tip']);
});
check('대사 — 돌봄 사건이 제 대사로 갈린다 · 돌려줌·기한은 조용하다(D72 B)', () => {
  assert.deepEqual(scriptsForEvents([{ id: 'job_start', job: 'care' }]), ['jobStartCare']);
  assert.deepEqual(scriptsForEvents([{ id: 'job_start' }]), ['jobStart']);                    // 가게는 예전 그대로
  assert.deepEqual(scriptsForEvents([{ id: 'job_start', job: 'shop' }]), ['jobStart']);
  assert.deepEqual(scriptsForEvents([{ id: 'care_new', problem: 'ca_bright' }]), ['careNewCaBright']);
  assert.deepEqual(scriptsForEvents([{ id: 'care_stuck', problem: 'pp_tip' }]), ['careStuckPpTip']);
  assert.deepEqual(scriptsForEvents([{ id: 'care_saved', problem: 'sc_floor' }]), ['careSavedScFloor']);
  assert.deepEqual(scriptsForEvents([{ id: 'care_new', problem: '없는고장' }]), []);
  assert.deepEqual(scriptsForEvents([{ id: 'care_return', first: true }, { id: 'care_expired' }, { id: 'care_cut_gift' }]), []);
  /* 첫날 차례: 진로 → 맡김판 → 첫 맡김 */
  assert.deepEqual(scriptsForEvents([{ id: 'care_new', problem: 'ca_bright' }, { id: 'care_open' }, { id: 'job_start', job: 'care' }]),
    ['jobStartCare', 'careOpen', 'careNewCaBright']);
  /* 이정표 10 · 30 과 그 퀘스트 끝이 같은 턴이면 퀘스트 쪽만 */
  assert.deepEqual(scriptsForEvents([{ id: 'care_milestone', n: 10 }, { id: 'quest_done', questId: 'care_sign' }]), ['questDoneCareSign']);
  assert.deepEqual(scriptsForEvents([{ id: 'care_milestone', n: 30 }, { id: 'quest_done', questId: 'care_town' }]), ['questDoneCareTown']);
  assert.deepEqual(scriptsForEvents([{ id: 'care_milestone', n: 3 }]), ['careMilestone3']);
  assert.deepEqual(scriptsForEvents([{ id: 'care_ending' }]), ['careEnding']);
  assert.equal(SCRIPTS.careEnding.length, 6);
  /* 자취생 낯은 앞치마 낯 안에서만(돌봄도 앞치마 · plan-care §10 ⑧) */
  const careIds = ['jobStartCare', 'careOpen', 'careEnding', 'careMilestone3', 'careMilestone10', 'careMilestone30',
                   ...Object.values(CARE_SCRIPT).flatMap(m => [m.new, m.stuck, m.saved])];
  for (const id of careIds) for (const l of SCRIPTS[id])
    if (l.who === 'jachwi') assert.ok(['beam', 'think', 'surprise', 'happy'].includes(l.face), `'${id}' 앞치마 낯 밖 '${l.face}'`);
  /* 몬이는 수를 안 말한다 */
  for (const id of careIds) for (const l of SCRIPTS[id])
    if (l.who === 'moni') assert.ok(!/[0-9]|하나|둘|셋|넷|다섯|여섯|일곱|여덟|아홉|열|서른/.test(l.text.replace(/하나씩|열어|열었|열면/g, '')), `'${id}' 몬이가 수를 말합니다: ${l.text}`);
});
check('잡담 — 돌봄 판 잡담 셋은 진로 돌봄 · 산 집일 때만(D72 B)', () => {
  const row = id => CHATTER.find(r => r.id === id);
  for (const id of ['chatCareMorning', 'chatCareQuiet', 'chatCareReady']) assert.ok(row(id) && SCRIPTS[id], `'${id}' 가 없습니다`);
  const base = { movedHome: true, jobId: 'care' };
  assert.equal(row('chatCareMorning').when(base), true);
  assert.equal(row('chatCareMorning').when({ movedHome: true, jobId: 'shop' }), false, '가게 판에 돌봄 잡담');
  assert.equal(row('chatCareQuiet').when({ ...base, careOpen: 0 }), true);
  assert.equal(row('chatCareQuiet').when({ ...base, careOpen: 1 }), false);
  assert.equal(row('chatCareQuiet').when({ ...base, careOpen: null }), false);
  assert.equal(row('chatCareReady').when({ ...base, careReady: 1 }), true);
  assert.equal(row('chatCareReady').when({ ...base, careReady: 0 }), false);
  /* 맥락 칸이 S.jobCare 에서 온다(새 core 칸 아님) */
  const S = { story: { job: { id: 'care' } }, home: { room: 'tworoom' },
              jobCare: { requests: [{ problem: 'ca_bright', savedOn: null }, { problem: 'pp_tip', savedOn: 905 }] } };
  const c = chatterContextOf({ day: 906 }, S);
  assert.equal(c.careOpen, 2); assert.equal(c.careReady, 1);
  assert.equal(chatterContextOf({ day: 906 }, { story: { job: { id: 'shop' } } }).careOpen, null, '돌봄 판이 아닌데 0 을 지어냅니다');
});

/* ★ 2026-10-24 [plan] D72 C — 육종: 칸 표 · 사건 갈림 · 비교 잡담(참일 때만) */
check('데이터 — breed_slots.json 품종 칸 다섯 · 판정 낱말 · 자동 이름 꼴(D72 C)', () => {
  const T = JSON.parse(readFileSync(new URL('../data/balance/breed_slots.json', import.meta.url), 'utf8'));
  assert.deepEqual(T.slots.map(s => s.id), ['monstera_halfmoon', 'monstera_fullmoon', 'al_marble', 'al_sector', 'pp_heavy']);
  const OUT = { monstera: ['halfmoon', 'fullmoon'], al: ['marble', 'sector'], pp: ['heavy'] };
  const COND = { monstera: 'rootBand', al: 'varieMotherKind', pp: 'ppLineRun' };
  for (const s of T.slots) {
    assert.ok(OUT[s.line] && OUT[s.line].includes(s.outcome), `'${s.id}' 줄·결과가 안 맞습니다`);
    assert.equal(s.cond, COND[s.line], `'${s.id}' 조건 낱말`);
    assert.ok(s.ko && s.short && s.desc && s.teaches, `'${s.id}' 글 칸이 비었습니다`);
    assert.ok(T._labels[s.line].out[s.outcome], `'${s.id}' 결과 낱말이 _labels 에 없습니다`);
  }
  assert.ok(/\{short\}/.test(T.autoName) && /\{n\}/.test(T.autoName), '자동 이름 꼴에 {short}·{n} 이 없습니다');
  assert.equal(T.autoName.replace('{short}', '하프문').replace('{n}', '1'), '볕 하프문 1호');   /* D74 ④ 예시 그대로 */
  for (const k of ['tab', 'empty', 'slotRow', 'slotRegistered', 'nameTitle', 'nameSub', 'nameButton', 'nameHint', 'logSample', 'logRegister'])
    assert.ok(T._ui[k], `화면 글 '${k}' 이 없습니다`);
});
check('대사 — 육종 사건이 제 대사로 갈린다 · 첫 표본만 말한다(D72 C)', () => {
  assert.deepEqual(scriptsForEvents([{ id: 'job_start', job: 'breed' }]), ['jobStartBreed']);
  assert.deepEqual(scriptsForEvents([{ id: 'breed_sample', line: 'monstera', first: true }]), ['breedFirstMonstera']);
  assert.deepEqual(scriptsForEvents([{ id: 'breed_sample', line: 'al', first: true }]), ['breedFirstAl']);
  assert.deepEqual(scriptsForEvents([{ id: 'breed_sample', line: 'pp', first: true }]), ['breedFirstPp']);
  assert.deepEqual(scriptsForEvents([{ id: 'breed_sample', line: 'monstera', first: false }]), []);
  assert.deepEqual(scriptsForEvents([{ id: 'breed_sample', line: 'monstera' }]), []);
  assert.deepEqual(scriptsForEvents([{ id: 'breed_candidate', slot: 'al_marble' }]), ['breedCandidate']);
  /* 첫 등록 날: 등록 → (이정표 1 은 퀘스트 끝과 겹쳐 걸러짐) → 퀘스트 끝 */
  assert.deepEqual(scriptsForEvents([{ id: 'quest_done', questId: 'breed_first_variety' }, { id: 'breed_milestone', n: 1 }, { id: 'breed_register', slot: 'pp_heavy' }]),
    ['breedRegister', 'questDoneBreedFirstVariety']);
  assert.deepEqual(scriptsForEvents([{ id: 'breed_milestone', n: 3 }, { id: 'quest_done', questId: 'breed_three' }]), ['questDoneBreedThree']);
  assert.deepEqual(scriptsForEvents([{ id: 'breed_milestone', n: 5 }]), ['breedMilestone5']);
  assert.deepEqual(scriptsForEvents([{ id: 'breed_ending' }]), ['breedEnding']);
  assert.equal(SCRIPTS.breedEnding.length, 6);
  /* 첫날 차례: 진로 → 기록장 */
  assert.deepEqual(scriptsForEvents([{ id: 'breed_open' }, { id: 'job_start', job: 'breed' }]), ['jobStartBreed', 'breedOpen']);
  const ids = ['jobStartBreed', 'breedOpen', 'breedFirstMonstera', 'breedFirstAl', 'breedFirstPp', 'breedCandidate', 'breedRegister',
               'breedMilestone1', 'breedMilestone3', 'breedMilestone5', 'breedEnding'];
  for (const id of ids) for (const l of SCRIPTS[id]) {
    if (l.who === 'jachwi') assert.ok(['beam', 'think', 'surprise', 'happy'].includes(l.face), `'${id}' 앞치마 낯 밖 '${l.face}'`);
    if (l.who === 'moni') assert.ok(!/[0-9]|셋|넷|다섯|여섯|일곱|여덟|아홉|서른|퍼센트|할/.test(l.text.replace(/할 /g, '')), `'${id}' 몬이가 수를 말합니다: ${l.text}`);
  }
});
check('잡담 — 육종 비교 잡담은 기록이 참일 때만(D72 C)', () => {
  const row = id => CHATTER.find(r => r.id === id);
  for (const id of ['chatBreedMorning', 'chatBreedBright', 'chatBreedPlainMother', 'chatBreedPinkCut']) assert.ok(row(id) && SCRIPTS[id], `'${id}' 가 없습니다`);
  const base = (tally) => ({ ...chatterContextOf({ day: 1400 }, { story: { job: { id: 'breed' } }, home: { room: 'tworoom' }, jobBreed: { tally } }),
                             movedHome: true, jobId: 'breed' });
  /* 밝은 쪽 하프문 몫이 더 큼(양쪽 무늬 잎 다섯 이상) */
  const t1 = { monstera: { bright: { plain: 1, sanban: 2, halfmoon: 5, fullmoon: 1 }, mid: { plain: 0, sanban: 4, halfmoon: 2, fullmoon: 0 } } };
  assert.equal(row('chatBreedBright').when(base(t1)), true, '밝은 쪽이 하프문이 많은데 안 섭니다');
  const t2 = { monstera: { bright: { sanban: 4, halfmoon: 1, fullmoon: 0 }, mid: { sanban: 1, halfmoon: 4, fullmoon: 0 } } };
  assert.equal(row('chatBreedBright').when(base(t2)), false, '기록이 거꾸로인데 섭니다(거짓말)');
  const t3 = { monstera: { bright: { sanban: 1, halfmoon: 2 }, mid: { sanban: 1 } } };
  assert.equal(row('chatBreedBright').when(base(t3)), false, '표본이 적은데 섭니다');
  /* 무지 어미 구근 둘 이상 · 무늬 0 */
  assert.equal(row('chatBreedPlainMother').when(base({ al: { plain_mother: { plain: 2, marble: 0, sector: 0 } } })), true);
  assert.equal(row('chatBreedPlainMother').when(base({ al: { plain_mother: { plain: 1 } } })), false);
  assert.equal(row('chatBreedPinkCut').when(base({ pp: { L1: { marble: 2 } } })), true);
  assert.equal(row('chatBreedPinkCut').when(base({})), false);
  /* 육종 판이 아니면 null — 0 을 지어내지 않는다 */
  const c = chatterContextOf({ day: 1400 }, { story: { job: { id: 'shop' } } });
  assert.equal(c.breedBrightHalfMore, null); assert.equal(c.breedPpLines, null);
  assert.equal(row('chatBreedMorning').when({ movedHome: true, jobId: 'care' }), false, '돌봄 판에 육종 잡담');
});

/* ★ 2026-10-24 [plan] D72 D 나머지 — 바꾸기 · 마지막 덮개: 글 표 · 사건 갈림 · 거짓 없는 말 */
check('데이터 — career_switch.json 화면 글이 다 있고 칭호·이음 줄·쉬는 중 글이 다른 표와 같다(D72 D)', () => {
  const T = JSON.parse(readFileSync(new URL('../data/balance/career_switch.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(T.jobs), ['shop', 'care', 'breed']);
  for (const [id, j] of Object.entries(T.jobs)) {
    for (const k of ['ko', 'ro', 'title', 'cardSub', 'go']) assert.ok(j[k], `jobs.${id}.${k} 가 비었습니다`);
    /* 조사: 받침이 없거나 ㄹ 받침이면 «로», 그 밖의 받침이면 «으로» */
    const jong = (j.ko.charCodeAt(j.ko.length - 1) - 0xAC00) % 28;
    assert.equal(j.ro, j.ko + (jong === 0 || jong === 8 ? '로' : '으로'), `jobs.${id}.ro 조사`);
    assert.equal(JOB_REST_TODO[id], `쉬는 중 — ${j.ro} 돌아가면 이어집니다`, `쉬는 중 글(quest.js)과 진로 이름이 어긋납니다 — ${id}`);
  }
  assert.equal(T.jobs.shop.title, SHOP_JOB.ending.titleKo, '가게 칭호가 core 값과 다릅니다');
  assert.equal(T.jobs.care.title, CARE_JOB.ending.titleKo, '돌봄 칭호가 core 값과 다릅니다');
  assert.equal(T.finalCover.sub, Object.values(T.jobs).map(j => j.title).join(' · '), '덮개 밑글이 칭호 셋이 아닙니다');
  const care = JSON.parse(readFileSync(new URL('../data/balance/care_problems.json', import.meta.url), 'utf8'));
  assert.equal(T.customerLink.toCare, care._lines.regularAsk, '손님 이음 줄이 돌봄 표(_lines.regularAsk)와 다릅니다');
  assert.ok(T.customerLink.toShop);
  assert.equal(T.endCard.stay, T.finalCover.stay);
  assert.ok(T.endCard.switch && T.todoHead.switch && T.cards.title && T.cards.sub && T.cards.note && T.cards.back && T.cards.close);
  /* ✎ 10-24 core 사진 — 반쪽 단추가 낱말 가운데서 꺾이지 않게 끝맺음 카드 [진로 바꾸기]는 할 일 머리 단추·화면 제목과 같은 말 · 이사 없음은 note 에 */
  assert.equal(T.endCard.switch, T.todoHead.switch); assert.equal(T.endCard.switch, T.cards.title);
  assert.ok(/이사는 없습니다/.test(T.cards.note) && !/이사/.test(T.cards.sub), `진로 바꾸기 밑글·알림: ${T.cards.sub} / ${T.cards.note}`);
  /* ✎ 총괄 — 진로 바꾸기 화면 닫기 단추는 «아무것도 안 바뀐다»가 보이는 말(«그만두기»는 «진로를 그만둔다»로 읽힘) */
  assert.ok(!/그만/.test(T.cards.close) && /그대로|닫기/.test(T.cards.close), `닫기 단추 글: ${T.cards.close}`);
  /* ★ 10-24 core 청 — 쉬는 진로 판 밑 줄(새 일 안 받음 · 걸린 것은 기한까지) */
  assert.ok(/새 주문은 안 받/.test(T.resting.shop) && /기한까지/.test(T.resting.shop), `쉬는 가게 줄: ${T.resting.shop}`);
  assert.ok(/새 맡김은 안 받/.test(T.resting.care) && /기한 날/.test(T.resting.care), `쉬는 돌봄 줄: ${T.resting.care}`);
  for (const k of ['ended', 'fresh', 'current']) assert.ok(T.cards.mark[k], `카드 표 '${k}' 가 없습니다`);
  assert.ok(/\{title\}/.test(T.cards.mark.ended) && /\{title\}/.test(T.cards.mark.current), '카드 표에 {title} 이 없습니다');
  for (const k of ['switched', 'back']) assert.ok(/\{ro\}/.test(T.banner[k].title) && /\{ro\}/.test(T.log[k]), `알림·기록 '${k}' 에 {ro} 가 없습니다`);
  assert.ok(T.log.shopOpenKept && T.log.careOpenKept && !/걸었/.test(T.log.shopOpenKept + T.log.careOpenKept));
  assert.equal(T.finalCover.title, '여기까지 — 이 집 이야기');
  assert.ok(existsSync(new URL(`../assets/illust/${T.finalCover.art}.png`, import.meta.url)), `덮개 원화 ${T.finalCover.art} 가 없습니다`);
});
check('대사 — 옮긴 날 · 돌아간 날 · 판을 이어 쓴 날 · 마지막 덮개가 제 대사로 갈린다(D72 D)', () => {
  assert.deepEqual(scriptsForEvents([{ id: 'job_start', job: 'shop', switched: true }]), ['jobSwitch']);
  assert.deepEqual(scriptsForEvents([{ id: 'job_start', job: 'care', switched: true }]), ['jobSwitchCare']);
  assert.deepEqual(scriptsForEvents([{ id: 'job_start', job: 'breed', switched: true }]), ['jobSwitchBreed']);
  assert.deepEqual(scriptsForEvents([{ id: 'job_start', job: 'care', switched: true, back: true }]), ['jobBack']);
  /* 첫 진로는 예전 그대로 */
  assert.deepEqual(scriptsForEvents([{ id: 'job_start' }]), ['jobStart']);
  assert.deepEqual(scriptsForEvents([{ id: 'job_start', job: 'care' }]), ['jobStartCare']);
  assert.deepEqual(scriptsForEvents([{ id: 'shop_open' }]), ['shopOpen']);
  assert.deepEqual(scriptsForEvents([{ id: 'care_open' }]), ['careOpen']);
  /* 옮긴 날 차례: 진로 → 판(이어 씀) */
  assert.deepEqual(scriptsForEvents([{ id: 'care_open', boardKept: true }, { id: 'job_start', job: 'care', switched: true }]), ['jobSwitchCare', 'careOpenKept']);
  assert.deepEqual(scriptsForEvents([{ id: 'shop_open', boardKept: true }, { id: 'job_start', job: 'shop', switched: true }]), ['jobSwitch', 'shopOpenKept']);
  /* 셋째 끝맺음 장면 → 마지막 덮개 */
  assert.deepEqual(scriptsForEvents([{ id: 'final_cover' }, { id: 'breed_ending' }]), ['breedEnding', 'finalCover']);
  /* 거짓 없는 말: 옮긴 날엔 «이제부턴 진짜야»(초보 보호 끝)가 없다 · 판이 이미 걸린 날엔 «걸었다»가 없다 */
  for (const id of ['jobSwitch', 'jobSwitchCare', 'jobSwitchBreed', 'jobBack'])
    for (const l of SCRIPTS[id]) assert.ok(!/이제부턴 진짜/.test(l.text), `'${id}' 옮긴 날에 초보 보호 끝 말: ${l.text}`);
  for (const id of ['shopOpenKept', 'careOpenKept']) assert.ok(!SCRIPTS[id].some(l => /걸었/.test(l.text)), `'${id}' 에 «걸었다»`);
  assert.equal(SCRIPTS.finalCover.length, 2);
  assert.ok(SCRIPTS.finalCover.every(l => l.who === 'moni'), '마지막 덮개는 몬이 두 줄');
  const ids = ['jobSwitch', 'jobSwitchCare', 'jobSwitchBreed', 'jobBack', 'shopOpenKept', 'careOpenKept', 'finalCover'];
  for (const id of ids) for (const l of SCRIPTS[id]) {
    if (l.who === 'jachwi') assert.ok(['beam', 'think', 'surprise', 'happy'].includes(l.face), `'${id}' 앞치마 낯 밖 '${l.face}'`);
    if (l.who === 'moni') assert.ok(!/[0-9]|세 |셋|넷|다섯|여섯|일곱|여덟|아홉|서른|퍼센트/.test(l.text), `'${id}' 몬이가 수를 말합니다: ${l.text}`);
  }
});

/* ★ 2026-10-24 [plan] 총괄 D84 — 육종 귀띔 둘(풀문 · AL 재우기): 때가 참일 때만 · 한 번 · 거짓 말 없음 */
check('잡담 — 육종 귀띔 둘(풀문 · AL 재우기)은 때가 참일 때만 · 한 번(D84)', () => {
  const row = id => CHATTER.find(r => r.id === id);
  for (const id of ['hintBreedFullmoon', 'hintBreedAlSleep']) {
    assert.ok(row(id) && SCRIPTS[id], `'${id}' 가 없습니다`);
    assert.equal(row(id).gap, 9999, `'${id}' 는 한 번만`);
    assert.ok(!REPEATABLE.has(id), `'${id}' 가 다시 나옵니다`);
    for (const l of SCRIPTS[id])
      assert.ok(l.who === 'moni' && !/[0-9]|세 |셋|넷|다섯|여섯|일곱|여덟|아홉|서른|퍼센트|금방|몇 번이고|깨면/.test(l.text), `'${id}' 수·거짓 낱말: ${l.text}`);
  }
  /* 잡담보다 앞(안 나온 것끼리는 표 앞이 이긴다) */
  const at = id => CHATTER.findIndex(r => r.id === id);
  assert.ok(at('hintBreedFullmoon') < at('chatBreedMorning') && at('hintBreedAlSleep') < at('chatBreedMorning'), '귀띔이 육종 잡담 뒤에 있습니다');
  const ctx = (tally, turn = {}) => ({ ...chatterContextOf({ day: 1400, ...turn }, { story: { job: { id: 'breed' } }, home: { room: 'tworoom' }, jobBreed: { tally } }),
                                       movedHome: true, jobId: 'breed' });
  const F = row('hintBreedFullmoon').when;
  assert.equal(F(ctx({ monstera: { mid: { plain: 1, sanban: 3, halfmoon: 2 } } })), true, '풀문 0 · 밝음 0 인데 안 섭니다');
  assert.equal(F(ctx({ monstera: { mid: { sanban: 3, halfmoon: 2 }, bright: { sanban: 1 } } })), false, '밝음 표본이 있는데 섭니다');
  assert.equal(F(ctx({ monstera: { mid: { sanban: 3, halfmoon: 1, fullmoon: 1 } } })), false, '풀문이 났는데 섭니다');
  assert.equal(F(ctx({ monstera: { mid: { sanban: 2 } } })), false, '표본이 적은데 섭니다');
  assert.equal(F(ctx({})), false, '몬스테라 표본이 없는데 섭니다');
  assert.equal(chatterContextOf({ day: 1 }, { story: { job: { id: 'shop' } } }).breedFullmoonHint, null, '육종 판이 아닌데 참/거짓을 지어냅니다');
  const A = row('hintBreedAlSleep').when;
  assert.equal(A(ctx({}, { breedAlCormWaitDays: 60 })), true);
  assert.equal(A(ctx({}, { breedAlCormWaitDays: 59 })), false);
  assert.equal(A(ctx({})), false, '칸이 없는데(모른다) 섭니다');
  assert.equal(A({ ...ctx({}, { breedAlCormWaitDays: 90 }), jobId: 'care' }), false, '돌봄 판에 육종 귀띔');
  assert.equal(chatterContextOf({ day: 1 }, null).breedAlCormWaitDays, null);
});
check('데이터 — 풀문 칸 설명이 «가장 밝은 자리»를 가리키고 조건 낱말 자가 코드대로 적혀 있다(D84)', () => {
  const T = JSON.parse(readFileSync(new URL('../data/balance/breed_slots.json', import.meta.url), 'utf8'));
  /* ★ D86 ③ — PP «잇달아»는 분홍 많음이 아닌 잎이면 다 끊는다(마블까지) — 괄호가 끊는 것 일부만 늘어놓지 않게 */
  const ph = T.slots.find(s => s.id === 'pp_heavy');
  assert.ok(/잇달아\(사이에 다른 잎 없이\)/.test(ph.desc), `분홍 많은 PP 칸 설명이 «다른 잎 없이»가 아닙니다: ${ph.desc}`);
  const fm = T.slots.find(s => s.id === 'monstera_fullmoon');
  assert.ok(/가장 밝은 자리/.test(fm.desc) && !/[0-9]/.test(fm.desc), `풀문 칸 설명: ${fm.desc}`);
  assert.ok(/7\.0/.test(T._doc_labels) && /3\.78/.test(T._doc_labels) && !/avg ≥ 5/.test(T._doc_labels), '조건 낱말 자(밝음 7.0 · 중간 3.78)가 안 적혔습니다');
  /* 조건 낱말 셋 = varie_grades.json lightBands 가 묶는 이름 셋 */
  const V = JSON.parse(readFileSync(new URL('../data/balance/varie_grades.json', import.meta.url), 'utf8'));
  assert.deepEqual([...new Set(Object.values(V.lightBands))].sort(), Object.keys(T._labels.monstera.cond).sort());
});

/* ★ 2026-10-24 [plan] 총괄 D85 ③ — 간판 한 자리(house signOf): 배너 글 · 기록 줄 · 대사 갈림 · «달았다/세웠다» 없음 */
check('대사·데이터 — 간판 한 자리: 다른 진로 간판이 서 있으면 10 보상은 글 배너 · «몫도 한다» 대사로 갈린다(D85 ③)', () => {
  assert.deepEqual(scriptsForEvents([{ id: 'regulars_milestone', n: 10, signKept: true }]), ['shopSignKept']);
  assert.deepEqual(scriptsForEvents([{ id: 'regulars_milestone', n: 10 }]), ['shopSign']);
  assert.deepEqual(scriptsForEvents([{ id: 'care_milestone', n: 10, signKept: true }]), ['careMilestone10Kept']);
  assert.deepEqual(scriptsForEvents([{ id: 'care_milestone', n: 10 }]), ['careMilestone10']);
  assert.deepEqual(scriptsForEvents([{ id: 'quest_opened', questId: 'shop_sign', kept: true }]), ['questShopSignKept']);
  assert.deepEqual(scriptsForEvents([{ id: 'quest_opened', questId: 'shop_sign' }]), ['questShopSign']);
  assert.deepEqual(scriptsForEvents([{ id: 'quest_done', questId: 'care_sign', kept: true }]), ['questDoneCareSignKept']);
  /* kept 지도에 없는 줄은 kept 가 붙어도 예전 대사 */
  assert.deepEqual(scriptsForEvents([{ id: 'quest_done', questId: 'shop_town', kept: true }]), ['questDoneShopTown']);
  /* 이정표와 퀘스트 끝이 같은 턴이면 퀘스트 쪽만(예전 짝과 같은 셈) */
  assert.deepEqual(scriptsForEvents([{ id: 'regulars_milestone', n: 10, signKept: true }, { id: 'quest_done', questId: 'shop_sign', kept: true }]), ['questDoneShopSignKept']);
  assert.deepEqual(scriptsForEvents([{ id: 'care_milestone', n: 10, signKept: true }, { id: 'quest_done', questId: 'care_sign', kept: true }]), ['questDoneCareSignKept']);
  const ids = ['shopSignKept', 'questShopSignKept', 'questDoneShopSignKept', 'careMilestone10Kept', 'questCareSignKept', 'questDoneCareSignKept'];
  for (const id of ids) for (const l of SCRIPTS[id]) {
    assert.ok(!/달았|달자|세웠|세우자|세운다|단다/.test(l.text), `'${id}' 간판이 이미 섰는데 새로 단다고 합니다: ${l.text}`);
    if (l.who === 'jachwi') assert.ok(['beam', 'think', 'surprise', 'happy'].includes(l.face), `'${id}' 앞치마 낯 밖 '${l.face}'`);
    if (l.who === 'moni') assert.ok(!/[0-9]|세 |셋|넷|다섯|여섯|일곱|여덟|아홉|서른|열이|퍼센트/.test(l.text), `'${id}' 몬이가 수를 말합니다: ${l.text}`);
  }
  const T = JSON.parse(readFileSync(new URL('../data/balance/career_switch.json', import.meta.url), 'utf8'));
  for (const j of ['shop', 'care']) {
    const g = T.sign[j];
    assert.ok(g && g.banner && g.banner.title && g.banner.sub && g.log, `sign.${j} 글이 비었습니다`);
    assert.ok(!/[0-9]|달았|세웠/.test(g.banner.title + g.banner.sub + g.log), `sign.${j} — 수나 «세웠다» 낱말: ${g.log}`);
    assert.equal(g.log, questOf(`${j}_sign`).kept.reward, `sign.${j}.log 와 퀘스트 kept.reward 가 다릅니다`);
  }
  /* 메모판 소개 글(D85 ②) — 판 셋이 «…쪽지» 결 · 무지 잎도 적히므로 «무늬가 난 날»만이 아니다 */
  const F = JSON.parse(readFileSync(new URL('../data/furniture_presets.json', import.meta.url), 'utf8')).presets;
  assert.ok(/쪽지$/.test(F.memo_board.intro_ko) && !/무늬가 난 날/.test(F.memo_board.intro_ko), `메모판 소개 글: ${F.memo_board.intro_ko}`);
});

/* ★ 2026-10-24 [plan] 총괄 D86 ① — breedH 빈 다리 귀띔 둘(상점 구근 · PP 자르기): 때가 참일 때만 · 한 번 · 수·거짓 낱말 없음 */
check('잡담 — breedH 빈 다리 귀띔 둘(상점 구근 · PP 자르기)은 때가 참일 때만 · 한 번(D86 ①)', () => {
  const row = id => CHATTER.find(r => r.id === id);
  for (const id of ['hintBreedAlShopCorm', 'hintBreedPpHeavy', 'hintBreedPpShop']) {
    assert.ok(row(id) && SCRIPTS[id], `'${id}' 가 없습니다`);
    assert.equal(row(id).gap, 9999, `'${id}' 는 한 번만`);
    assert.ok(!REPEATABLE.has(id), `'${id}' 가 다시 나옵니다`);
    for (const l of SCRIPTS[id])
      assert.ok(l.who === 'moni' && !/[0-9]|세 |셋|넷|다섯|여섯|일곱|여덟|아홉|서른|퍼센트|반드시|꼭 나/.test(l.text), `'${id}' 수·장담 낱말: ${l.text}`);
  }
  const at = id => CHATTER.findIndex(r => r.id === id);
  assert.ok(at('hintBreedAlShopCorm') < at('chatBreedMorning') && at('hintBreedPpHeavy') < at('chatBreedMorning'), '귀띔이 육종 잡담 뒤에 있습니다');
  const ctx = (jb, turn = {}) => ({ ...chatterContextOf({ day: 1400, ...turn }, { story: { job: { id: 'breed' } }, home: { room: 'tworoom' }, jobBreed: jb }),
                                    movedHome: true, jobId: 'breed' });
  const S1 = row('hintBreedAlShopCorm').when;
  assert.equal(S1(ctx({ tally: {} }, { breedAlNoMotherDays: 21 })), true);
  assert.equal(S1(ctx({ tally: {} }, { breedAlNoMotherDays: 20 })), false);
  assert.equal(S1(ctx({ tally: {} })), false, '칸이 없는데(모른다) 섭니다');
  assert.equal(S1({ ...ctx({ tally: {} }, { breedAlNoMotherDays: 40 }), jobId: 'shop' }), false, '가게 판에 육종 귀띔');
  const P = row('hintBreedPpHeavy').when;
  assert.equal(P(ctx({ tally: { pp: { L1: { heavy: 1, marble: 2 } } }, varieties: [], pending: [] })), true, 'PP 줄이 끊기는데 안 섭니다');
  assert.equal(P(ctx({ tally: { pp: { L1: { heavy: 2, marble: 1 } } }, varieties: [], pending: [] })), false, '끊긴 잎이 하나뿐인데 섭니다');
  assert.equal(P(ctx({ tally: { pp: { L1: { marble: 2 } } }, varieties: [], pending: [] })), false, '표본이 적은데 섭니다');
  assert.equal(P(ctx({ tally: { pp: { L1: { heavy: 3, green: 2 } } }, varieties: [{ slot: 'pp_heavy', name: '볕 분홍 1호' }], pending: [] })), false, '이미 등록한 칸인데 섭니다');
  assert.equal(P(ctx({ tally: { pp: { L1: { heavy: 3, pink: 2 } } }, varieties: [], pending: [{ slot: 'pp_heavy' }] })), false, '이름 대기 중인데 섭니다');
  assert.equal(chatterContextOf({ day: 1 }, { story: { job: { id: 'care' } } }).breedPpHeavyHint, null, '육종 판이 아닌데 참/거짓을 지어냅니다');
  assert.equal(chatterContextOf({ day: 1 }, null).breedAlNoMotherDays, null);
  /* PP 없는 판 — 가진 PP 0(맡은 것은 안 침) · 표본 셋 이상 */
  const sp = (pots, n) => ({ ...chatterContextOf({ day: 1400 }, { story: { job: { id: 'breed' } }, home: { room: 'tworoom' },
                                                                 jobBreed: { tally: {}, sampleCount: n }, species: { pots } }), movedHome: true, jobId: 'breed' });
  const Q = row('hintBreedPpShop').when;
  assert.equal(Q(sp([], 3)), true, 'PP 가 없는데 안 섭니다');
  assert.equal(Q(sp([{ species: 'pink_princess', care: { id: 'r1' } }], 3)), true, '맡은 PP 를 내 것으로 칩니다(상점 진열 셈과 다름)');
  assert.equal(Q(sp([{ species: 'pink_princess' }], 3)), false, 'PP 가 있는데 섭니다');
  assert.equal(Q(sp([], 2)), false, '표본이 적은데 섭니다');
  assert.equal(chatterContextOf({ day: 1 }, { story: { job: { id: 'shop' } }, jobBreed: { tally: {} } }).breedPpShopHint, null, '육종 판이 아닌데 참/거짓을 지어냅니다');
  assert.ok(!SCRIPTS.hintBreedPpHeavy.some(l => /그 아래를 잘라/.test(l.text)), 'PP 귀띔이 chatBreedPinkCut 과 같은 말을 합니다');
});

/* ★ 2026-10-24 [plan] 총괄 D88 ② — 마지막 귀띔 둘(뿌리 자리 · AL 갈래): 때가 참일 때만 · 한 번 · 수·거짓 낱말 없음 · 풀문 귀띔과 안 겹침 */
check('잡담 — 마지막 귀띔 둘(뿌리 자리 · AL 갈래)은 때가 참일 때만 · 한 번(D88 ②)', () => {
  const row = id => CHATTER.find(r => r.id === id);
  for (const id of ['hintBreedRootSpot', 'hintBreedAlKinds']) {
    assert.ok(row(id) && SCRIPTS[id], `'${id}' 가 없습니다`);
    assert.equal(row(id).gap, 9999, `'${id}' 는 한 번만`);
    assert.ok(!REPEATABLE.has(id), `'${id}' 가 다시 나옵니다`);
    for (const l of SCRIPTS[id])
      assert.ok(l.who === 'moni' && !/[0-9]|세 |셋|넷|다섯|여섯|일곱|여덟|아홉|서른|퍼센트|반드시|꼭 나/.test(l.text), `'${id}' 수·장담 낱말: ${l.text}`);
  }
  assert.ok(!SCRIPTS.hintBreedRootSpot.some(l => /가장 밝은/.test(l.text)), '뿌리 자리 귀띔이 풀문 귀띔(«가장 밝은 자리»)과 같은 말을 합니다');
  /* ✎ 총괄 정정 — 뿌리 뒤 옮김은 «자랄 만큼 밝은 데»라야 참(무늬 삽수는 문턱 밑이면 안 자람) — «옮겨도 돼»만 남기지 않는다 */
  assert.ok(SCRIPTS.hintBreedRootSpot.some(l => /자랄 만큼/.test(l.text)) && !SCRIPTS.hintBreedRootSpot.some(l => /옮겨도 돼/.test(l.text)),
    '뿌리 뒤 옮김 줄에 «자랄 만큼 밝은 데»가 없습니다');
  const at = id => CHATTER.findIndex(r => r.id === id);
  assert.ok(at('hintBreedRootSpot') < at('chatBreedMorning') && at('hintBreedAlKinds') < at('chatBreedMorning'), '귀띔이 육종 잡담 뒤에 있습니다');
  const ctx = jb => ({ ...chatterContextOf({ day: 1400 }, { story: { job: { id: 'breed' } }, home: { room: 'tworoom' }, jobBreed: { varieties: [], pending: [], ...jb } }),
                       movedHome: true, jobId: 'breed' });
  const R = row('hintBreedRootSpot').when;
  assert.equal(R(ctx({ tally: { monstera: { dark: { plain: 3, sanban: 2, halfmoon: 1 }, mid: { sanban: 1 } } } })), true, '어두움이 대부분인데 안 섭니다');
  assert.equal(R(ctx({ tally: { monstera: { dark: { plain: 3, sanban: 2 }, mid: { sanban: 3, halfmoon: 2 } } } })), false, '중간이 더 많은데 섭니다');
  assert.equal(R(ctx({ tally: { monstera: { dark: { plain: 2, sanban: 1 } } } })), false, '표본이 적은데 섭니다');
  assert.equal(R(ctx({ tally: { monstera: { dark: { plain: 6 } } }, varieties: [{ slot: 'monstera_halfmoon' }] })), false, '하프문 칸을 이미 등록했는데 섭니다');
  const A = row('hintBreedAlKinds').when;
  assert.equal(A(ctx({ tally: { al: { varie_mother: { marble: 4, plain: 1 } } }, varieties: [{ slot: 'al_marble' }] })), true, '한 갈래만 섰는데 안 섭니다');
  assert.equal(A(ctx({ tally: { al: { varie_mother: { marble: 3 } } }, pending: [{ slot: 'al_marble' }] })), true, '이름 대기(같은 조건 셋)인데 안 섭니다');
  assert.equal(A(ctx({ tally: { al: { varie_mother: { marble: 4, sector: 1 } } }, varieties: [{ slot: 'al_marble' }] })), false, '다른 갈래 무늬 어미 싹이 있는데 섭니다');
  assert.equal(A(ctx({ tally: { al: {} }, varieties: [{ slot: 'al_marble' }, { slot: 'al_sector' }] })), false, '두 칸 다 섰는데 섭니다');
  assert.equal(A(ctx({ tally: { al: {} } })), false, '아무 갈래도 안 섰는데 섭니다');
  const c0 = chatterContextOf({ day: 1 }, { story: { job: { id: 'care' } } });
  assert.equal(c0.breedRootDarkHint, null); assert.equal(c0.breedAlKindsHint, null);
});

/* ★ 2026-10-30 [plan] 총괄 D90 ② — 등 글: «안 단 등» 독촉 · 원룸 등 잡담 둘은 «단 등»으로 가른다(첫 등은 공짜로 가방에 온다) */
check('대사 — 등: 안 단 등 독촉 · 원룸 등 잡담은 «단 등»으로 갈린다 · «샀다/안 샀다» 없음(D90 ②)', () => {
  for (const id of ['lampSkipped', 'chatOneroomLamp', 'chatOneroomNoLamp'])
    for (const l of SCRIPTS[id]) assert.ok(!/샀|사 ?온|안 사/.test(l.text), `'${id}' 에 «사다» 낱말(첫 등은 공짜): ${l.text}`);
  assert.ok(!SCRIPTS.lampSkipped.some(l => /그것도 답/.test(l.text)), '«안 다는 것도 답» — 등이 곧 길과 어긋납니다');
  assert.ok(SCRIPTS.lampSkipped.some(l => /가방/.test(l.text)) && SCRIPTS.lampSkipped.some(l => /창 위/.test(l.text)), '안 단 등 독촉에 «가방» · «창 위»가 없습니다');
  const row = id => CHATTER.find(r => r.id === id).when;
  const c = (owned, placed) => ({ movedOut: true, movedHome: false, lampOwned: owned, lampPlaced: placed });
  assert.equal(row('chatOneroomLamp')(c(1, 0)), false, '가방에만 있는데 «달려 있다»가 섭니다');
  assert.equal(row('chatOneroomLamp')(c(1, 1)), true, '단 등이 있는데 안 섭니다');
  assert.equal(row('chatOneroomNoLamp')(c(1, 0)), true, '가방에 있고 안 달았는데 안 섭니다');
  assert.equal(row('chatOneroomNoLamp')(c(1, 1)), false, '달았는데 «걸이가 비어 있다»가 섭니다');
  assert.equal(row('chatOneroomNoLamp')(c(0, 0)), false, '등이 없는데 «가방에 있어»가 섭니다');
  const ctx = lamp => chatterContextOf({ day: 200 }, { tutorial: { lamp, movedOut: true } });
  assert.equal(ctx({ owned: 1, placed: 0 }).lampPlaced, 0);
  assert.equal(ctx({ owned: 2, placed: 1 }).lampPlaced, 1);
  assert.equal(ctx({ owned: 1 }).lampPlaced, 1, 'placed 가 없는 옛 세이브는 owned 로');
});

/* ★ 2026-10-30 [plan] 총괄 D90 ③ — 첫 달 · 기다림 글: 약속 말고 «일어난 뒤» · 이레 지갑 · 자르기까지 */
check('대사 — 첫 달 끝 «들이는 달» · 이레 지갑 첫 플러스 · statusWallet 은 이레가 마이너스일 때만 · 자르기까지(D90 ③)', () => {
  const row = id => CHATTER.find(r => r.id === id);
  const F = row('statusFirstMonth');
  assert.ok(F && F.status && F.gap === 9999 && !REPEATABLE.has('statusFirstMonth'), '첫 달 줄은 상태 줄 · 한 번');
  const c = o => ({ movedOut: false, day: 31, cashWon: 834500, startCashWon: 1500000, shopSpentWon: 120000, ...o });
  assert.equal(F.when(c()), true, '첫 달 끝인데 안 섭니다');
  assert.equal(F.when(c({ cashWon: 1600000 })), false, '돈이 늘었는데 «더 줄었어»가 섭니다');
  assert.equal(F.when(c({ shopSpentWon: 0 })), false, '들인 것이 없는데 «들인 값»이 섭니다');
  assert.equal(F.when(c({ day: 20 })), false, '한 달이 안 됐는데 섭니다');
  assert.equal(F.when(c({ movedOut: true })), false, '이사 뒤에 섭니다');
  assert.equal(F.when(c({ startCashWon: null })), false, '시작 돈을 모르는데 섭니다');
  /* «둘째 달부터 모인다»는 약속하지 않는다 */
  for (const id of ['statusFirstMonth', 'walletWeekUp'])
    for (const l of SCRIPTS[id]) assert.ok(!/둘째 달|다음 달|모일 거|모인다/.test(l.text), `'${id}' 가 앞일을 장담합니다: ${l.text}`);
  assert.equal(EVENT_SCRIPT.wallet_week_up, 'walletWeekUp');
  assert.deepEqual(scriptsForEvents([{ id: 'wallet_week_up' }]), ['walletWeekUp']);
  const W = row('statusWallet').when, base = { hasMonstera: true, leafWaitDays: 25 };
  assert.equal(W({ ...base, walletWeekDelta: 62434 }), false, '이레가 플러스인데 «돈은 매일 줄고»가 섭니다');
  assert.equal(W({ ...base, walletWeekDelta: -30000 }), true, '이레가 마이너스인데 안 섭니다');
  assert.equal(W({ ...base, walletWeekDelta: null }), true, '모르면 예전 그대로여야 합니다');
  /* 자르기까지 — 몬이는 수를 안 말한다(«둘»은 할 일 칸이) */
  for (const id of ['questWaitVarie', 'questDoneWaitVarie'])
    for (const l of SCRIPTS[id]) if (l.who === 'moni') assert.ok(!/[0-9]|둘|두 장|셋/.test(l.text), `'${id}' 몬이가 수를 말합니다: ${l.text}`);
  assert.equal(QUEST_OPEN_SCRIPT.wait_varie, 'questWaitVarie'); assert.equal(QUEST_DONE_SCRIPT.wait_varie, 'questDoneWaitVarie');
  const ctx = chatterContextOf({ day: 31, walletWeekDelta: -5000 }, { tutorial: { rules: { startCashWon: 1500000 }, crop: { spentWon: 9000 }, lamp: { owned: 0 } } });
  assert.equal(ctx.startCashWon, 1500000); assert.equal(ctx.shopSpentWon, 9000); assert.equal(ctx.walletWeekDelta, -5000);
});

/* ★ 2026-10-30 [plan] 총괄 D90 ④ — 남는 건 판다: 한 목소리 · 상점 단추 이름 · 수 없음 · 장담 없음 */
check('대사 — 남는 건 판다(한 목소리 «하루 밥상 몫은 먹고 그 위는 판다» · 상점 단추 이름 · 수 없음)(D90 ④)', () => {
  assert.equal(QUEST_OPEN_SCRIPT.sell_surplus, 'questSellSurplus'); assert.equal(QUEST_DONE_SCRIPT.sell_surplus, 'questDoneSellSurplus');
  assert.ok(SCRIPTS.questSellSurplus.some(l => /하루 밥상에 오를 몫은 먹고, 그 위로 쌓이는 건 팔아/.test(l.text)), '한 목소리 줄이 없습니다');
  const html = readFileSync(U('../game.html'), 'utf8');
  const btn = (html.match(/id="sellPantry"[^>]*>([^<]+)</) || [])[1];
  assert.ok(btn && SCRIPTS.questSellSurplus.some(l => l.text.includes(btn.trim())), `상점 단추 이름(${btn})과 대사가 다릅니다`);
  for (const id of ['questSellSurplus', 'questDoneSellSurplus', 'nudgeSurplusOffer', 'nudgeSurplusPush'])
    for (const l of SCRIPTS[id]) {
      if (l.who === 'moni') assert.ok(!/[0-9]|이레|열여섯|다섯|여덟/.test(l.text), `'${id}' 몬이가 수를 말합니다: ${l.text}`);
      assert.ok(!/손해/.test(l.text), `'${id}' 가 «손해»를 말합니다(한 목소리와 어긋남): ${l.text}`);
    }
  const row = id => CHATTER.find(r => r.id === id);
  assert.ok(row('nudgeSurplusOffer') && row('nudgeSurplusPush'), '남는 건 판다 독촉 줄이 없습니다');
  /* ★ D91 — 열여섯을 되살리며 «본전 · 줄지 않는다 · 다른 길»을 안 되살렸다 · 몬이는 수를 안 말한다 */
  for (const id of ['questSiru16', 'questDoneSiru16']) for (const l of SCRIPTS[id]) {
    assert.ok(!/본전|버는 쪽|안 깎여|줄지 않는다|다른 길/.test(l.text), `'${id}' 가 거둔 말을 되살렸습니다: ${l.text}`);
    if (l.who === 'moni') assert.ok(!/[0-9]|닷새|열여섯|하나/.test(l.text), `'${id}' 몬이가 수를 말합니다: ${l.text}`);
  }
});

/* ★ 2026-10-30 [plan] 총괄 D90 ⑥ — 박사님 요령: 가르치지 않되 막지 않는다(«단 한 자리» 걷음 · 원리 한 줄은 비교만) */
check('대사 — 요령을 막지 않는다: «단 한 자리» 없음 · 원리 한 줄은 비교만 · 반지하 · 한 번(D90 ⑥)', () => {
  for (const id of Object.keys(SCRIPTS))
    for (const l of SCRIPTS[id]) assert.ok(!/단 한 자리/.test(l.text), `'${id}' 가 «단 한 자리»를 말합니다(요령과 어긋남): ${l.text}`);
  assert.ok(SCRIPTS.statusSill.some(l => /지금은/.test(l.text) && /제일 밝은/.test(l.text)), 'statusSill 이 «지금은 · 제일 밝은»이 아닙니다');
  const H = CHATTER.find(r => r.id === 'hintRaisePot');
  assert.ok(H && H.gap === 9999 && !REPEATABLE.has('hintRaisePot'), '원리 한 줄은 한 번');
  for (const l of SCRIPTS.hintRaisePot) assert.ok(!/[0-9]|넷|네 개|쌓아|자라/.test(l.text), `원리 줄이 레시피·장담을 말합니다: ${l.text}`);
  const c = o => ({ hasMonstera: true, movedOut: false, lampOwned: 1, bagCuttings: 1, ...o });
  assert.equal(H.when(c()), true);
  assert.equal(H.when(c({ movedOut: true })), false, '원룸에서 섭니다');
  assert.equal(H.when(c({ lampOwned: 0 })), false, '가구점이 열리기 전에 섭니다');
  assert.equal(H.when(c({ bagCuttings: 0 })), false, '둘 데 없는 삽수가 없는데 섭니다');
});

/* ★ 2026-10-30 [plan] 종합 «고칠 차례» 5 — 비판 판 «대사가 지금 상황을 모른다» 여섯: 날을 장담 안 함 · 수 안 말함 · 일어난 것만 · 가방·배송 중을 봄 */
check('대사 — 상황을 모르던 여섯 줄(Day 8 «내일 아침» · 시루 다섯 · 무순 다섯 · 씨앗 · 밥은 돈다 · 상점에 있어)(종합 5)', () => {
  const T = id => SCRIPTS[id].map(l => l.text).join(' / ');
  assert.ok(!/내일 아침/.test(T('chatCrop2')), `chatCrop2 가 날을 장담합니다: ${T('chatCrop2')}`);
  for (const l of SCRIPTS.questDoneSiru5) if (l.who === 'moni') assert.ok(!/다섯|바퀴|[0-9]/.test(l.text), `questDoneSiru5 몬이 수: ${l.text}`);
  assert.ok(!/밥값은 내네|모자라던데/.test(T('questDoneSiru5')), T('questDoneSiru5'));
  assert.ok(!/색이 다르|웃자랐/.test(T('questDoneRadish5')), T('questDoneRadish5'));
  assert.ok(!/^왔다/.test(SCRIPTS.questDoneOrderSeed[0].text), T('questDoneOrderSeed'));
  assert.ok(!/밥은/.test(T('shortBothLight')), T('shortBothLight'));
  /* ⚠ 같은 id 의 줄이 여럿이다(시루 줄 넷이 nudgeSiruOffer 를 함께 쓴다) — 하나라도 참이면 «선다» */
  const row = id => c => CHATTER.filter(r => r.id === id).some(r => { try { return !!r.when(c); } catch { return false; } });
  const n = (q, o = {}) => ({ nudge: { id: q, days: 2 }, ...o });
  /* 시루 줄 — 가방 › 오는 중 › 상점, 하나만 참 · 모르면(null) 예전 그대로 «상점» */
  const pick = c => ['nudgeSiruOffer', 'nudgeSiruBag', 'nudgeSiruComing'].filter(id => row(id)(c));
  assert.deepEqual(pick(n('siru8', { siruBag: 1, siruIncoming: 3 })), ['nudgeSiruBag']);
  assert.deepEqual(pick(n('siru8', { siruBag: 0, siruIncoming: 3 })), ['nudgeSiruComing']);
  assert.deepEqual(pick(n('siru8', { siruBag: 0, siruIncoming: 0 })), ['nudgeSiruOffer']);
  assert.deepEqual(pick(n('siru5_cycle5', { siruBag: null, siruIncoming: null })), ['nudgeSiruOffer']);
  const mix = c => ['nudgeMixOffer', 'nudgeMixBag'].filter(id => row(id)(c));
  assert.deepEqual(mix(n('crop_mix', { musunBag: 2 })), ['nudgeMixBag']);
  assert.deepEqual(mix(n('crop_mix', { musunBag: 0 })), ['nudgeMixOffer']);
  /* 문맥이 실제 판에서 센다 — 상점 재고 + 배송 중 */
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  S.shop = S.shop || {}; S.shop.stock = { ...(S.shop.stock || {}), siru: 2, sprout_tray: 1 };
  S.shop.orders = [...(S.shop.orders || []), { itemId: 'siru', qty: 3, arriveDay: 9 }];
  const c = chatterContextOf({ day: 5 }, S);
  assert.ok(c.siruBag >= 2 && c.siruIncoming === 3 && c.musunBag >= 1, JSON.stringify({ b: c.siruBag, i: c.siruIncoming, m: c.musunBag }));
});

/* ★ 2026-10-31 [plan] 총괄 D92 ㉠ — 이사 순간 작물은 다 이삿짐(가방 · 안 자람) · 창턱 넷은 삽수 · 몬스테라 몫.
     첫날 차례: 삽수(창턱) → 채소(가구 위) · 이삿짐 줄은 «돌던» 작물만 센다(빈 용기는 안 침) · 옛 사실 «한 자리에 모인 시루 · 침대 옆 한 칸»을 안 되살림 */
check('D92 이삿짐 — 이사 장면 끝 줄 차례 · 상태 줄 갈래 · 할 일 차례 · 옛 사실 안 되살림 · 몬이 수 없음', () => {
  const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
  const ev = [{ id: 'moved_in_oneroom' }];
  assert.ok(!scriptsForEvents(ev, S).includes('movedInBagCrops'), '가방에 돌던 작물이 없는데 이삿짐 줄이 붙습니다');
  const pot = cropSites(S.firstPlay).flatMap(s => (s && s.pots) || [])[0];
  assert.ok(pot, '판에 시루가 없습니다');
  pot.slotId = null; pot.at = null; pot.startedOnDay = 0; pot.ageDays = 2; pot.harvested = false;
  let out = scriptsForEvents(ev, S);
  assert.equal(out[out.indexOf('movedInOneroom') + 1], 'movedInBagCrops', out.join(','));
  S.cuttings = [{ id: 'cD92', status: 'rooting', method: 'water', at: null, slotId: null }];
  out = scriptsForEvents(ev, S);
  const m = out.indexOf('movedInOneroom');
  assert.deepEqual(out.slice(m, m + 3), ['movedInOneroom', 'movedInBagCuttings', 'movedInBagCrops'], `창턱(삽수) 다음 가구(채소)가 아닙니다: ${out.join(',')}`);
  assert.ok(chatterContextOf({ day: 5 }, S).bagCrops >= 1, '문맥 bagCrops 가 가방의 돌던 작물을 못 셉니다');
  /* 상태 줄 — 첫 이레는 «Move» · 삽수가 가방이면 삽수 줄 차례 · 그 뒤는 이레에 한 번 */
  const on = id => c => CHATTER.filter(r => r.id === id).some(r => { try { return !!r.when(c); } catch { return false; } });
  const base = { movedOut: true, movedHome: false, bagCrops: 1, bagCuttings: 0 };
  assert.equal(on('statusBagCropsMove')({ ...base, daysInOneroom: 3 }), true);
  assert.equal(on('statusBagCropsMove')({ ...base, daysInOneroom: 3, bagCuttings: 1 }), false, '삽수가 가방인데 채소 줄이 먼저 섭니다');
  assert.equal(on('statusBagCrops')({ ...base, daysInOneroom: 3 }), false);
  assert.equal(on('statusBagCrops')({ ...base, daysInOneroom: 12 }), true);
  assert.equal(on('statusBagCrops')({ ...base, bagCrops: null, daysInOneroom: 12 }), false, '모르는데 섭니다');
  /* 할 일 — 삽수 › 몬스테라 › 채소 › 예전 글(칸을 모르면 그 갈래를 건너뜀) */
  const q = questOf('oneroom_unpack');
  const bagCrop = [{ kind: 'beansprout', placed: false, growing: true }];
  const todo = s => q.todo(q, s);
  assert.equal(todo({ bagCuttings: 1, bagPots: 1, cropPots: bagCrop }), '들고 온 삽수부터 창가에 놓으세요');
  assert.equal(todo({ bagCuttings: 0, bagPots: 1, cropPots: bagCrop }), '몬스테라를 창가에 놓으세요');
  assert.equal(todo({ bagCuttings: 0, bagPots: 0, cropPots: bagCrop }), '들고 온 채소를 가구 위에 올리세요');
  assert.equal(todo({ bagCuttings: null, bagPots: null, cropPots: bagCrop }), '들고 온 채소를 가구 위에 올리세요');
  assert.equal(todo({ bagCuttings: 0, bagPots: null, cropPots: [{ kind: 'beansprout', placed: false, growing: false }] }), '가방의 식물을 원룸에 놓으세요', '빈 용기를 이삿짐으로 셉니다');
  for (const s of [{ bagCuttings: 0, bagPots: 1 }, { cropPots: bagCrop }]) assert.ok(todo(s).length <= 28);
  /* 옛 사실 — 이사가 시루를 한 점에 몰던 때 · 방 데이터에서 빠진 칸 */
  const T = id => SCRIPTS[id].map(l => l.text).join(' / ');
  for (const id of ['chatOneroomDark', 'chatOneroomSiru', 'movedInOneroom'])
    assert.ok(!/한 자리에 모여|거기뿐|침대 옆|한 칸|금방 찬다/.test(T(id)), `${id} 가 옛 사실을 말합니다: ${T(id)}`);
  for (const id of ['movedInBagCrops', 'statusBagCropsMove', 'statusBagCrops', 'chatOneroomDark', 'chatOneroomSiru', 'movedInOneroom'])
    for (const l of SCRIPTS[id]) if (l.who === 'moni')
      assert.ok(!/[0-9]|하나|한 칸|둘|셋|넷|다섯|아홉|열여섯/.test(l.text), `'${id}' 몬이가 수를 말합니다: ${l.text}`);
  assert.ok(REPEATABLE.has('movedInBagCrops') && REPEATABLE.has('statusBagCrops') && REPEATABLE.has('statusBagCropsMove'));
});

/* ★ 2026-10-31 [plan] 총괄 — chatOneroomBright «등 없이도 자라»는 여름에만(growth ab7bbecf: 등0 자라는 날 여름 89~96% · 겨울 1% · 이사 날 = 겨울 첫날) */
check('원룸 창턱 «등 없이도 자라» — 여름에만 · 몬이 수 없음(growth ab7bbecf)', () => {
  const on = c => CHATTER.filter(r => r.id === 'chatOneroomBright').some(r => { try { return !!r.when(c); } catch { return false; } });
  const o = { movedOut: true, movedHome: false };
  assert.equal(on({ ...o, season: 'summer' }), true);
  for (const season of ['winter', 'spring', 'autumn', undefined]) assert.equal(on({ ...o, season }), false, `${season} 에 섭니다`);
  for (const l of SCRIPTS.chatOneroomBright) if (l.who === 'moni')
    assert.ok(!/[0-9]|하나|둘|셋|넷|백 일/.test(l.text), `chatOneroomBright 몬이가 수를 말합니다: ${l.text}`);
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
