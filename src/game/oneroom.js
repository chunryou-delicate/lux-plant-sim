/* ============================================================
   game/oneroom.js — ③ 원룸 (core 소유) · 2026-08-05 신설
   ------------------------------------------------------------
   스토리는 네 단계다(docs/story_arc.md §0).

     ① 반지하(튜토)  →  ② 탈출(원룸 이사)  →  ③ 원룸  →  ④ 내 집 마련 엔딩
        first_play.js      tutorial.moveOut     ★여기       ending.js

   ①②는 이미 있었다. 이 파일은 **②가 실제로 일어나게 하고 ③을 연다.**

   ══ ★ 무엇이 없어서 이 파일이 생겼나 ═══════════════════════════════════
   `tutorial.moveOut(ts)` 은 **돈을 빼고 깃발 하나를 세울 뿐**이었다.
   `ts.movedOut = true` 가 되어도 `S.home.room` 은 그대로 `'banjiha'` 다 —
   화면도 조도도 슬롯도 반지하 그대로이고, 「이사했다」는 문장만 남는다.
   `game.html` 의 방 바꾸기(`buildRoom(id)`)는 개발용 드롭다운에만 붙어 있어서
   스토리 경로에서는 **아무도 부르지 않는다.**

   그래서 여기서 하는 일은 하나다 — **이사를 사건이 아니라 이동으로 만든다.**

   ══ ★ 규칙을 두 곳에 두지 않는다 ═══════════════════════════════════════
   이사 **판정과 돈**은 여전히 `tutorial.js` 가 갖는다(`canMoveOut` · `moveOut`).
   여기서 다시 세지 않고 그 함수를 부른다. 이 파일이 갖는 것은 **방과 자리**뿐이다:
     · `S.home.room` 을 바꾼다
     · 반지하 슬롯·좌표를 가리키던 것들을 새 방으로 회수한다
     · 「원룸에 짐을 풀었다」는 사건을 낸다

   살림(하루 지출·월세·계절)도 그대로 `tutorial.tutorialDay` 가 돈다. ③에서 갈리는 것은
   **월세 하나**이고, 그건 `tutorial.rentWonOf(ts)` 가 사는 방을 보고 고른다 —
   여기서 두 번째 살림 장부를 만들면 반지하와 원룸이 서로 다른 계산으로 돌기 시작한다.

   ══ ★★ 숫자를 새로 지어내지 않았다 ═════════════════════════════════════
   원룸의 **월세·보증금·슬롯 수·엔딩 목표 금액은 전부 미확정**이다
   (`docs/story_arc.md` §5). 그래서 이 파일에는 **자리만** 있다:

     ONEROOM_RULES.rentWon === null      ← 「아직 안 정해졌다」는 뜻이다. 0 이 아니다
     oneroomRulesFromHomes(homes)        ← 정본(data/balance/homes.json)에서 **읽어** 채운다

   후보값과 근거는 `docs/oneroom.md` 에 적었다. 여기에 베껴 두지 않는다 —
   베끼는 순간 정본이 둘이 되고, 다른 워커가 실측으로 고친 값과 조용히 갈린다.

   ★ THREE 를 쓰지 않는다. DOM 도 타이머도 모른다.
============================================================ */

import { canMoveOut, moveOut as tutorialMoveOut, TUTORIAL_RULES } from './tutorial.js';
import { cropSites, placeCrop, syncCropLead, CROP_SITE_IDS } from './first_play.js';
/* ★ 거둔 시루는 `placeCrop` 이 막는다(수확 잠금). 이사는 「손으로 옮기는 것」이 아니라
   「방이 통째로 바뀌는 것」이라 그 잠금을 우회해야 자리를 지킬 수 있다 — 자리 두 칸만 짓는다. */
import { spotOf } from './place.js';
import { pot0, pushLog, rehomePot, carryFurniture } from './state.js';
import { rehomeCuttings } from './propagation.js';
import { weatherE } from '../engine/weather.js';

export const STORY_SCHEMA = 'story/1';

/* 원룸의 방 id — `data/house_rooms.json` 의 `rooms.oneroom` 이자
   `data/balance/homes.json` 의 `homes[].room` 이다. 두 파일이 같은 이름을 쓴다. */
export const ONEROOM_ROOM_ID = 'oneroom';

/* ============================================================
   ① 단계 — **저장하지 않고 유도한다**
   ------------------------------------------------------------
   ★ `stage` 를 상태에 적지 않는다. 적으면 「이사는 했는데 단계는 아직 반지하」 같은
     어긋난 판이 생기고, 그걸 고칠 방법이 없다(둘 다 세이브에 들어가므로).
     단계를 정하는 사실은 이미 둘 다 상태에 있다:
       ts.movedOut          ② 탈출을 했나
       story.ending.doneOnDay  ④ 엔딩을 봤나
     그래서 여기서는 **읽어서 고르기만** 한다. 옛 세이브도 그대로 맞는다.
============================================================ */
export const STAGES = Object.freeze({
  banjiha: { id: 'banjiha', ko: '반지하', step: '①②' },
  oneroom: { id: 'oneroom', ko: '원룸',   step: '③' },
  ending:  { id: 'ending',  ko: '내 집',  step: '④' }
});

export function createStoryState() {
  return {
    schema: STORY_SCHEMA,
    /* 원룸에 들어온 게임일. `null` 이면 아직 반지하다. `ts.movedOut` 과 같은 사실을
       가리키지만 **날짜**를 갖는다 — 「며칠부터 원룸이었나」는 여기밖에 없다. */
    movedInOnDay: null,
    /* ④ 는 ending.js 가 쓴다. 상태의 모양만 여기서 만든다 —
       state.newState 가 부르는 팩토리가 하나여야 세이브 규약도 하나가 된다. */
    ending: { reachedOnDay: null, doneOnDay: null }
  };
}

/* 없으면 만들어서 돌려준다(옛 세이브가 이 칸 없이 열린다). */
export function storyOf(S) {
  if (!S) throw new TypeError('[스토리] 상태가 없습니다');
  if (!S.story) S.story = createStoryState();
  return S.story;
}

/* 지금 어느 단계인가. **판정에 쓰는 유일한 창구**다. */
export function stageOf(S) {
  const st = S && S.story;
  if (st && st.ending && st.ending.doneOnDay != null) return STAGES.ending;
  const ts = S && S.tutorial;
  if (ts && ts.movedOut) return STAGES.oneroom;
  return STAGES.banjiha;
}

/* ★ 스토리가 아직 도는 중인가 — `propagation.isNoviceMode` 가 보는 사실이다.
   story_arc.md §0: *"스토리 모드 전체가 초보다."* ②에서 끝나는 것이 아니라 ④까지다. */
export function storyRunning(S) {
  const ts = S && S.tutorial;
  if (!ts || !ts.enabled) return false;
  return stageOf(S) !== STAGES.ending;
}

/* ============================================================
   ② 원룸 규칙 — ⏸ **값이 아니라 자리다**
   ------------------------------------------------------------
   `docs/story_arc.md` §5 가 미확정으로 남긴 것 그대로다:
     · ③ 원룸 이후의 **슬롯 수 · 월세 · 판매가**
     · ④ 내 집 마련의 **목표 금액**

   ★ `null` 은 「아직 안 정해졌다」다. **0 이 아니다.** 0 으로 두면 월세 공짜인 방이
     조용히 성립하고, 아무도 그게 미확정이었다는 것을 모른다.
   ★ 확정되면 값을 여기 박는 것이 아니라 `data/balance/homes.json`(plan 소유)이 갖고,
     아래 `oneroomRulesFromHomes` 가 읽어 온다. 코어는 살림 값을 복제하지 않는다
     (state.js 머리말 — "임계값·계수·확률 → data/balance/*.json").
============================================================ */
export const ONEROOM_RULES = Object.freeze({
  roomId: ONEROOM_ROOM_ID,
  /* ⏸ 미확정. 후보와 근거는 docs/oneroom.md §2 */
  rentWon: null,
  depositWon: null,
  moveCostWon: TUTORIAL_RULES.moveOutCostWon,   // ★이것만 확정이다(story_arc.md §3 · 실비 근거)
  /* ⏸ 미확정. 지금 방 데이터의 실측은 11칸이고 docs/propagation.md §7 은 24칸을 요청한다 —
     둘이 안 맞는다. 그 간극이 docs/oneroom.md §3 이다. */
  slots: null,
  darkSlots: null
});

/* 정본(`data/balance/homes.json`)에서 원룸 살림 값을 **읽어** 규칙을 만든다.
   `first_play.firstPlayRulesFromBalance(characters.json)` 과 같은 결이다 —
   코어가 값을 갖지 않고 받아 쓴다.

   ⚠ `cost_provisional: true` 인 값은 **잠정**이라고 같이 낸다. 조용히 확정처럼 쓰면
     다른 워커가 실측으로 고친 값과 갈렸을 때 아무도 눈치채지 못한다.
   반환 { roomId, rentWon, depositWon, moveCostWon, provisional, source } */
export function oneroomRulesFromHomes(homes, opt = {}) {
  const list = (homes && homes.homes) || [];
  const row = list.find(h => h && h.id === (opt.roomId || ONEROOM_ROOM_ID));
  if (!row)
    throw new Error(`[원룸] homes.json 에 ${opt.roomId || ONEROOM_ROOM_ID} 이(가) 없습니다 — ` +
                    `살림 값을 지어내지 않습니다`);
  const num = (v, name) => {
    if (v == null) return null;
    if (!Number.isFinite(v) || v < 0)
      throw new Error(`[원룸] homes.json ${row.id}.${name} 이(가) 0 이상의 수가 아닙니다: ${v}`);
    return v;
  };
  return Object.freeze({
    ...ONEROOM_RULES,
    roomId: row.room || row.id,
    rentWon: num(row.rent, 'rent'),
    depositWon: num(row.deposit, 'deposit'),
    moveCostWon: num(row.moveCost, 'moveCost') ?? ONEROOM_RULES.moveCostWon,
    provisional: !!row.cost_provisional,
    source: 'data/balance/homes.json'
  });
}

/* ★ 튜토리얼 규칙에 **원룸 월세 자리를 채운 사본**을 만든다.
   ------------------------------------------------------------
   왜 이 모양인가 — `ts.rules` 는 **세이브에 안 적힌다**(save.js packTutorial 머리말:
   "여기도 rules 는 안 적는다"). 복원은 늘 `createTutorialState({ rules: opt.rules })` 로
   지금 정본을 다시 붙인다. 그래서 이사할 때 `ts.rules` 를 갈아 끼우면 **저장 한 번에 사라진다.**
   대신 규칙 객체 하나에 두 방의 월세를 다 담고, 어느 쪽을 낼지는 `tutorial.rentWonOf(ts)` 가
   `ts.movedOut`(=세이브에 있는 사실)을 보고 고른다.

     const rules = withOneroomRent(TUTORIAL_RULES, oneroomRulesFromHomes(homes));
     createTutorialState({ enabled: true, rules });      // 새 판
     deserialize(raw, { rules, ... });                   // 이어하기 — **같은 객체를 준다**

   ⚠ 두 경로에 다른 rules 를 주면 이어하기에서 월세가 바뀐다. 호출부가 한 곳에서 만들어야 한다. */
export function withOneroomRent(baseRules, oneroomRules) {
  const base = baseRules || TUTORIAL_RULES;
  const rent = oneroomRules ? oneroomRules.rentWon : null;
  if (rent == null) return base;             // 미확정이면 그대로 — 지어내지 않는다
  if (!Number.isFinite(rent) || rent < 0)
    throw new Error(`[원룸] 월세가 0 이상의 수가 아닙니다: ${rent}`);
  return Object.freeze({ ...base, oneroomRentWon: rent });
}

/* ============================================================
   ③ ★★ 이사 — 사건이 아니라 **이동**이다
   ------------------------------------------------------------
     moveIntoOneroom(S, io, opt)

   ★ 판정·돈은 `tutorial.moveOut` 이 한다. 못 나가면 거기서 던진다(`tutorialInput`).
     여기서 조건을 한 번 더 세면 두 곳이 갈린다.

   ★ 순서가 중요하다. **돈이 빠진 뒤에만** 방을 바꾼다 —
     반대로 하면 「방은 원룸인데 이사비는 안 낸」 판이 던진 자리에 남는다.

   ★ 조도 창(io.light)은 **있으면 쓴다.** 없으면 방만 바꾸고 `roomChanged: true` 로 알린다 —
     화면(game.html)이 자기 방식으로 다시 짓게 두는 것이 맞다. 그쪽은 3D 방 뷰도 같이
     세워야 하는데 코어는 그걸 모른다(shop.sellPot 의 `growthNeedsReset` 과 같은 규약).

   반환 { movedOut, cashWon, fromRoom, roomId, roomChanged, roomBuilt,
          rehomed: [...], events: [...] } */
export function moveIntoOneroom(S, io = {}, opt = {}) {
  const ts = S && S.tutorial;
  if (!ts || !ts.enabled)
    throw new Error('[원룸] 반지하 튜토리얼 상태가 없습니다 — 이사할 판이 아닙니다');
  const story = storyOf(S);
  if (ts.movedOut || story.movedInOnDay != null) {
    const e = new Error('[원룸] 이미 이사했습니다');
    e.tutorialInput = true;                  // 버튼을 두 번 누른 것은 고장이 아니다
    throw e;
  }

  /* ① 판정과 돈 — tutorial 이 갖는다. 던지면 아래로 안 내려간다(S 는 그대로다) */
  const r = tutorialMoveOut(ts);

  /* ② 방을 바꾼다 */
  const fromRoom = S.home.room;
  const roomId = opt.roomId || ONEROOM_ROOM_ID;
  S.home.room = roomId;
  story.movedInOnDay = S.day;

  /* ★ 가구 자리표(S.home.furniture)는 **지우지 않는다.**
     표는 방을 안 가린다 — 반지하 uid 는 원룸에 없어서 그냥 안 얹힐 뿐이고,
     나중에 되돌아갈 일이 있으면 그때 그대로 산다(save.js §furnitureNotInRoom 과 같은 판단). */

  /* ★★★★ 2026-08-30 — **반지하 가구를 가방에 담는다** (박사님 · [House] 합의)
     ══════════════════════════════════════════════════════════════════
     박사님: *"반지하 있던 가구만 «인벤에 넣어서 가져와서» 플레이어가 «배치»하도록 해."*
     ⚠ **무엇을 담을지는 여기서 안 고른다.** 「방에 붙었나」는 프리셋(`mount`)이 알고
       그 데이터는 [House] 마당이다(`rooms_spec §13`). ⇒ **부르는 쪽이 목록을 준다**(㊸).
       `opt.carry = [{uid, preset}]` — 안 주면 **예전 그대로**다(아무것도 안 담는다).
     ⚠ 「팔 수 있나」로 가르면 안 된다 — [House] 실측: `furnitureQuoteOf` 로 가르면
       **식물등 셋이 「두고 가는 쪽」**으로 떨어진다. 합의(등은 들고 온다)와 정반대다.
       ★ 「팔 수 있나」와 「들고 갈 수 있나」는 **다른 물음**이다.
     ★ 방에서 걷는 일은 안 한다 — 방이 통째로 갈리므로 옛 방 정의가 더 안 쓰인다. */
  const carried = [];
  for (const row of (Array.isArray(opt.carry) ? opt.carry : [])) {
    try { carried.push(carryFurniture(S, row).uid); }
    catch (e) { pushLog(S, '⚠ 이사 — 못 담았습니다: ' + (e && e.message)); }
  }
  if (carried.length)
    pushLog(S, `📦 반지하 가구 ${carried.length}개를 가방에 담았습니다 — 원룸에서 놓아 주세요`);

  /* ③ 자리를 비운다. 반지하의 슬롯 id 도 좌표도 원룸에서는 뜻이 없다 —
     그대로 두면 계약이 「이 방에 없는 자리」를 실어 조용히 0 DLI 가 되거나 던진다. */
  const cleared = clearPlacements(S);

  /* ④ 조도 창이 있으면 지금 방을 조립하고, 물건을 새 방 자리로 회수한다.
     회수 규칙은 이미 있는 것을 그대로 쓴다 — loop.nextDay 가 매일 부르는 그 함수들이다. */
  const rehomed = [];
  let roomBuilt = false;
  const light = io.light;
  if (light && typeof light.build === 'function') {
    light.build(roomId);
    if (typeof light.clearCache === 'function') light.clearCache();
    roomBuilt = true;
  }
  if (light && light.room) {
    const room = light.room;
    const log = (m) => { rehomed.push(m); pushLog(S, '🔧 이사 — ' + m); };
    if (pot0(S)) rehomePot(S, room.slots || [], log, room);
    rehomeCuttings(S, room, log);
    reseatCrops(S, room, log);
  }

  pushLog(S, `📦 ${fromRoom} → ${roomId} · 원룸에 짐을 풀었습니다`);
  return {
    ...r,
    fromRoom, roomId, roomChanged: true, roomBuilt,
    carried,                       /* ★ 가방에 담은 가구 uid — 화면이 「몇 개 담았나」를 말할 때 쓴다 */
    movedInOnDay: story.movedInOnDay,
    clearedPlacements: cleared,
    rehomed,
    /* ★ `moved_out` 은 tutorial 이 이미 냈다(반지하를 떠나는 장면). 여기 것은 그 **다음 장**이다 —
       둘을 하나로 합치지 않는 이유는 대사가 갈리기 때문이다(dialogue.js 는 id 로 고른다).
       ⚠ 대사는 아직 없다. dialogue.EVENT_SCRIPT 에 없는 id 는 조용히 지나간다(그쪽 §머리말). */
    events: [...(r.events || []),
             { id: 'moved_in_oneroom', ko: '원룸에 짐을 풀었습니다', roomId, fromRoom }]
  };
}

/* 놓여 있던 것들의 자리를 비운다. **죽이지 않는다** — 자리를 잃는 것과 사라지는 것은 다르다
   (propagation.rehomeCuttings 머리말과 같은 판단). */
function clearPlacements(S) {
  const out = { pots: 0, cuttings: 0, crops: 0 };
  /* ★★★★ 2026-08-30 — **그루는 «가방»으로 간다** (박사님 「응 그렇게 해」 · [Plan] (c)).
     ══════════════════════════════════════════════════════════════════
     ⚠ 예전에는 자리만 뗐다. 그러면 바로 아래 §④ 의 `rehomePot` 이 「자리를 잃은 화분」으로 보고
       **새 방의 «첫 자리»에 앉혔다.** 실측: 원룸 `oneroom-nightstand:0` — ★ 열다섯 중 «열다섯째»,
       DLI **0.00** 이다(probe_carrypot). 사람이 아무것도 안 했는데 그루가 죽는 자리에 선다.
     ★ 그래서 「아직 안 놓았다」로 «세워» 둔다 — 그러면 `rehomePot` 이 비켜서고 가방 칸이 뜬다.
       ⇒ 이사가 「처음을 다시 하는 일」이 된다: 받아들이고 · 놓고 · 옮긴다([Plan]).
     ⚠ 「가방에 있다」의 정본은 이 셋이다 — 자리 없음 · 좌표 없음 · `placedOnce === false`
       (state §rehomePot · game.html §bagPots). 새 칸을 만들지 않는다.
     ⚠ 삽수·작물은 **안 건드린다.** 그쪽은 제 회수 규칙이 따로 있고(rehomeCuttings·reseatCrops)
       가방 칸도 없다 — 여기서 같이 「안 놓았다」로 만들면 갈 데 없이 떠 있게 된다. */
  for (const p of S.pots || []) { p.at = null; p.slotId = null; p.placedOnce = false; out.pots++; }
  for (const c of S.cuttings || []) { c.at = null; c.slotId = null; out.cuttings++; }
  const fp = S.firstPlay;
  /* ★★ 2026-08-09 — 자리의 정본이 **시루마다**로 내려왔다(first_play §자리는 시루마다 따로다).
     자리 사본(site)만 비우면 시루들은 **떠나온 방의 좌표를 그대로 들고** 새 방으로 온다.
     그러면 다음 하루에 `cropDliFromReport` 가 "그 자리가 오늘 계약에 없습니다"로 던져
     이사한 판이 통째로 멈춘다 — `test_ending_flow` 가 그 자리에서 섰다. */
  if (fp && fp.enabled)
    for (const site of cropSites(fp)) {
      if (!site) continue;
      for (const p of (site.pots || [])) {
        if (!p || !(p.slotId || p.at)) continue;
        p.at = null; p.slotId = null; out.crops++;
      }
      site.at = null; site.slotId = null;
    }
  return out;
}

/* 작물 자리를 새 방에 다시 앉힌다 — `save.js` 의 복원(reseat)과 **같은 규칙**이다.
   ★★ 2026-08-10 — 여기가 **자리 사본으로 자리를 통째로 건너뛰고 있었다.**
     옛 줄: `if (!site || site.harvested || site.slotId) continue;`
       · `site.harvested` 는 「**하나라도** 거뒀나」다. 시루 다섯 중 하나만 거뒀어도
         **안 거둔 넷까지 같이** 안 옮겨졌고, `clearPlacements` 가 이미 자리를 비운 뒤라
         그 넷은 그대로 **가방으로 갔다.** 그리고 아무 말도 안 했다.
       · `site.slotId` 도 사본이라(first_play §makeCropSite) 여기 판단에 쓸 것이 아니다.
     ⇒ 이제 **시루마다** 판단한다. 거둔 시루는 자리를 지키고, 안 거둔 시루도 자리를 지킨다.
     ⚠ 정말로 못 옮긴 시루는 가방으로 가되 **반드시 말한다**(docs/silent_failures.md). */
function reseatCrops(S, room, log) {
  const fp = S.firstPlay;
  if (!fp || !fp.enabled) return;
  const dest = ((room && room.slots) || [])[0] || null;
  if (!dest) {
    /* ⚠ 새 방에 자리가 하나도 없으면 시루가 전부 가방에 남는다 — **조용히 넘기지 않는다** */
    const n = cropSites(fp).reduce(
      (a, s) => a + ((s && s.pots) || []).filter(p => p && (p.startedOnDay != null || p.harvested)).length, 0);
    if (n && log) log(`⚠ 새 방에 놓을 자리가 없어 시루 ${n}개가 가방으로 들어갔습니다`);
    return;
  }
  for (const site of cropSites(fp)) {
    if (!site) continue;
    /* ★ 이사 전에 방에 서 있던 시루만 새 방에 앉힌다 — **가방에 있던 빈 시루는 가방에 그대로**
       (2026-08-09). 이사 왔다고 안 놓은 시루가 저절로 서면 「가방에는 빈 용기만」이 깨진다.
       ⚠ 어느 시루가 방에 있었는지는 위 `clearPlacements` 가 이미 지웠다. 그래서 여기서는
         **한 번이라도 회전을 돈 시루**를 기준으로 삼는다 — 그것이 방에 있던 것이다.
       ⚠⚠ 「회전을 시작했나」만 보면 **거둔 시루가 빠진다** — `harvestBeansprout` 이 거두면서
         `startedOnDay` 를 지우기 때문이다(다음 회전을 위해). 그래서 `harvested` 도 같이 본다.
       ★ 거둔 시루도 방에 서 있던 시루다. 「결과가 확정이라 옮길 이유가 없다」던 옛 근거는
         **자리를 잃어도 된다는 뜻이 아니었다** — 다시 심으면 그 자리에서 이어져야 한다. */
    const kindId = site.kind || 'beansprout';
    const name = CROP_SITE_IDS[kindId] || kindId;
    const moving = (site.pots || []).filter(p => p && (p.startedOnDay != null || p.harvested));
    if (!moving.length) continue;
    let ok = 0;
    const lost = [];
    for (const p of moving) {
      /* 시루 하나가 못 앉아도 **나머지는 앉힌다.** 통째로 포기하면 하나 때문에 전부 가방행이다.
         ★ 거둔 시루는 `placeCrop` 이 막으므로(§수확 잠금) 자리 두 칸을 직접 적는다 —
           같은 함수를 쓰려고 잠금을 풀면 「거둔 시루를 손으로 옮기는 것」까지 열린다. */
      try {
        if (p.harvested) {
          const spot = spotOf(dest.slotId, { id: p.id, slots: room.slots });
          p.slotId = spot.slotId; p.at = spot.at;
        } else {
          placeCrop(fp, kindId, dest.slotId, { slots: room.slots, potId: p.id });
        }
        ok++;
      } catch (e) {
        lost.push(`${p.id}(${e.message})`);
      }
    }
    syncCropLead(site);
    if (ok && log) log(`${name} ${ok}개를 ${dest.slotId} 로 옮겼습니다`);
    /* ⚠ 조용히 사라지지 않게 — 못 옮긴 것은 가방에 있고, 그 사실을 말한다 */
    if (lost.length && log)
      log(`⚠ ${name} ${lost.length}개는 새 방에 자리를 못 잡아 **가방으로 들어갔습니다** — ` +
          `${lost.join(' · ')}`);
  }
}

/* ============================================================
   ④ ★★ 원룸에서 처음 의미를 갖는 것 — **갈라진 잎과 무늬**
   ------------------------------------------------------------
   story_arc.md 가 ③에 붙인 말이 이것이다: *"갈라진 잎 · 무늬 · 번식(삽수)"*.
   반지하에서 안 나는 이유는 규칙이 아니라 **빛이 모자라서**다.

   ★★ 그런데 그 문턱을 **코어가 정하지 않는다.** 정본은 `data/balance/light_thresholds.json`
     이고 조도 창이 `thresholdsOf(plantId, variegated)` 로 낸다:
       monstera_deliciosa   min 3.0 · fenestrate 6.0
       무늬종               전 구간 ×1.4 (need_mult) → min 4.2 · fenestrate 8.4
     여기서는 그 값을 **읽어서 지금 방이 넘나 못 넘나만 말한다.** 숫자를 새로 만들지 않는다.

   ★ 왜 「말하는 함수」가 필요한가 — 그 사실을 코드가 조용히 넘기면 ③ 이 왜 심심한지
     아무도 모른 채 밸런스를 뒤진다. 재현(tools/test_oneroom.mjs)이 이 함수로 그것을 고정한다.

   ★ 2026-08-06 (oneroomfix) — 원룸이 넘을 수 있게 되었다.
       등0 7일평균 3.65 (못 넘음) · 등1 7.15 (넘음) · 등2 7.50
     그 전에는 등 기구가 0개라 어떤 자리에서도 못 넘었다. 잰 표는
     `docs/handoff/oneroomfix-to-plan.md` · `tools/test_oneroom_room.mjs`.

   ⚠ 판정이 아니다. 갈라짐·무늬를 **실제로 정하는 것은 growth** 이고 코어는 안 굴린다
     (tutorial.js §확정 무늬가 확률을 안 건드린 것과 같은 이유).

     lightGateOf(S, io, { season, lampCount, plantId })
   반환 { roomId, season, lampCount, best: {slotId, peak, avg7},
          min, fenestrate, varieMin, varieFenestrate,
          canGrow, canFenestrate, canVarie, growRigs, ownedLamps, canTurnOn, why } */
export function lightGateOf(S, io = {}, opt = {}) {
  const light = io.light;
  if (!light || !light.room)
    return { ok: false, why: '조도 창이 없습니다 — 지금 방이 얼마나 밝은지 잴 수 없습니다' };
  const room = light.room;
  const season = opt.season || 'summer';
  const lampCount = opt.lampCount == null ? ((S && S.lamps && S.lamps.count) || 0) : opt.lampCount;
  const litHours = opt.litHours == null ? ((S && S.lamps && S.lamps.litHours) || 12) : opt.litHours;
  const plantId = opt.plantId || (pot0(S) && pot0(S).plantId) || 'monstera_deliciosa';

  const th = typeof light.thresholdsOf === 'function' ? light.thresholdsOf(plantId, false) : null;
  const thV = typeof light.thresholdsOf === 'function' ? light.thresholdsOf(plantId, true) : null;
  if (!th)
    return { ok: false, why: '조도 창이 임계값을 안 냅니다 — light_thresholds.json 이 안 실렸습니다' };

  /* ★ 판정 단위는 **7일 이동평균**이다(하루 값으로 판정하면 운으로 갈린다).
     맑은 날 값에 날씨 기댓값을 곱해 낸다 — 그 계수는 weather.js 가 갖는다(0.643 을 안 박는다). */
  const E = weatherE(season);
  const rows = (room.slots || []).map(s => {
    const peak = typeof light.dliOfSlot === 'function'
      ? light.dliOfSlot(s.slotId, { weather: 'clear', season, lampCount, litHours }) : 0;
    return { slotId: s.slotId, peak, avg7: peak * E };
  }).sort((a, b) => b.avg7 - a.avg7);
  const best = rows[0] || { slotId: null, peak: 0, avg7: 0 };

  /* 방에 실제로 달려 있는 식물등 기구 수. 반지하에도 원룸에도 둘씩 박혀 있다
     (2026-08-06 oneroomfix 전에는 원룸이 0개였고, 그래서 이사하면 산 등이 사라졌다). */
  const growRigs = typeof light.growLampCount === 'function' ? light.growLampCount()
                 : (room.growRigs || []).length;

  /* ★★ 「산 등이 이사를 따라온다」 (2026-08-06 · docs/handoff/oneroomfix-to-plan.md ㉠)
     ------------------------------------------------------------
     등은 방 데이터에 박혀 있고, **켤 수 있는 개수의 천장은 산 개수**다
     (`game.html` fillLamps: `min(방 기구 수, ts.lamp.owned)`). 반지하에도 원룸에도
     기구가 둘씩 있으니, 하나만 샀으면 어느 방에서든 하나만 켜진다.

     ⚠ 그래서 「몇 개 더 켤 수 있나」를 **기구 수로만 세면 거짓말이 된다** —
       원룸에 기구가 둘 있어도 등을 안 샀으면 한 개도 못 켠다. 여기서 그 천장을 같이 본다.
     ★ 튜토가 없는 판(검수·헤드리스)에는 산 개수라는 개념이 없다. 그때는 예전처럼
       기구 수가 곧 천장이다 — 그 판은 살림이 안 돌아 공짜로 켜도 잴 것이 없다
       (fillLamps 의 같은 판단). */
  const ts = S && S.tutorial;
  const ownedLamps = (ts && ts.enabled && ts.lamp) ? Math.max(0, ts.lamp.owned || 0) : null;
  const canTurnOn = Math.min(growRigs, ownedLamps == null ? growRigs : ownedLamps);

  const canGrow = best.avg7 >= th.min;
  const canFenestrate = th.fenestrate != null && best.avg7 >= th.fenestrate;
  const canVarie = !!(thV && best.avg7 >= thV.min);
  const round2 = (v) => +Number(v).toFixed(2);

  /* 왜 못 넘는지 — **할 수 있는 것을 말한다.** 켤 등이 남았으면 켜라고, 다 켰는데
     모자라면 사라고, 방에 기구가 없으면 그렇다고. 셋을 뭉치면 조언이 거짓이 된다. */
  const hint = canTurnOn > lampCount ? ` — 식물등을 ${canTurnOn - lampCount}개 더 켤 수 있습니다`
    : growRigs === 0 ? ' — 이 방에는 식물등 기구가 하나도 없습니다'
    : growRigs > lampCount ? ` — 식물등을 더 사야 켭니다 (이 방 기구 ${growRigs}개 · 산 등 ${ownedLamps}개)`
    : '';
  const why = canFenestrate ? null
    : th.fenestrate == null ? '이 식물은 갈라지지 않습니다'
    : `가장 밝은 자리(${best.slotId})의 7일평균이 ${round2(best.avg7)} 로 ` +
      `갈라짐 문턱 ${th.fenestrate} 에 못 미칩니다` + hint;

  return {
    ok: true, roomId: room.id, season, lampCount, growRigs,
    /* ownedLamps 는 튜토가 없으면 null 이다 — 「0개 샀다」와 「살 개념이 없는 판」은 다르다 */
    ownedLamps, canTurnOn,
    best: { slotId: best.slotId, peak: round2(best.peak), avg7: round2(best.avg7) },
    slots: rows.length,
    min: th.min, fenestrate: th.fenestrate,
    varieMin: thV ? thV.min : null, varieFenestrate: thV ? thV.fenestrate : null,
    canGrow, canFenestrate, canVarie, why
  };
}

/* ============================================================
   ⑤ 화면이 「지금 무엇을 하면 되나」를 적을 때 — tutorialGoal 과 같은 모양
   ------------------------------------------------------------
   ★ ④ 의 목표는 ending.js 가 낸다. 여기서는 ③ 까지만 말한다 —
     엔딩 목표 금액이 미확정이라(§②) 여기서 말하면 지어낸 값이 필요해진다.
============================================================ */
export function oneroomGoal(S) {
  const ts = S && S.tutorial;
  if (!ts || !ts.enabled) return null;
  const stage = stageOf(S);
  if (stage === STAGES.banjiha) {
    const c = canMoveOut(ts);
    return c.ok ? { id: 'move_ready', ko: '원룸으로 이사할 수 있습니다' } : null;
  }
  if (stage === STAGES.oneroom)
    return { id: 'propagate', ko: '삽수를 늘려 내 집 마련 자금을 만듭니다' };
  return { id: 'done', ko: '내 집을 마련했습니다' };
}

/* 지금 판의 한 줄 요약 — 재현·화면이 같은 문장을 쓰게. 상태를 안 바꾼다. */
export function storyStatus(S) {
  const stage = stageOf(S);
  const story = S && S.story;
  const ts = S && S.tutorial;
  return {
    stage: stage.id, stageKo: stage.ko, step: stage.step,
    room: S && S.home ? S.home.room : null,
    movedInOnDay: story ? story.movedInOnDay : null,
    endingDoneOnDay: story && story.ending ? story.ending.doneOnDay : null,
    cashWon: ts ? ts.cashWon : null,
    novice: storyRunning(S)
  };
}
