/* ============================================================
   game/state.js — 게임 상태 S (core 소유)
   ------------------------------------------------------------
   여기 있는 건 '루프가 세는 것'뿐이다.
     · 며칠 지났나 · 어느 방 · 어느 슬롯 · 등 몇 개 · 어떤 모드
   여기 없는 것(다른 창 소유이므로 절대 복제하지 않는다):
     · 생장 나이·잎 수         → growth (ageOf·growthDays). 코어는 읽기만 한다
     · DLI·밴드·전기요금       → house (계약 객체 daily_light/1)
     · 임계값·계수·확률        → data/balance/*.json (plan)

   ★ 고사·정식 경제는 없다. 첫 플레이의 콩나물 1회 수확·식비 절감만
     first_play.js의 닫힌 상태로 둔다. 월세·현금·상점으로 확장하지 않는다.
     활력(vigor)은 표시 취소·구현 보류다(2026-08-02) — 자리를 만들면 판정이 코어로 샌다.
============================================================ */

import { createFirstPlayState, placeBeansprout, placeCrop, resowBeansprout, waterBeansprout,
         beansproutWaterStatus, beansproutHarvestStatus, BEANSPROUT_ID,
         CROP_SITE_IDS, cropKindOf, cropSites, cropSiteOf,
         cropSurplusQuote, takeCropSurplus,
         /* ★ 2026-08-15 · 곳간 채소 판매 (first_play §곳간 판매) */
         pantrySaleQuote, takePantryCrop, pantryLotsOf,
         /* ★ 2026-08-16 · 그램(g) · 오늘 밥상 고르개 (first_play §그램 · §eatFromPantry) */
         mealPlanQuote, planMealGrams, pantryLotsWithGrams, gramsOfWon, formatGram,
         /* ★ 2026-08-09 · 시루 개체화 (first_play §자리는 시루마다 따로다) */
         ensureCropPots, syncCropLead, addCropPot, cropPotOf, adoptCropSpotToPots,
         placedCropPots, idleCropPots, cropPotList,
         /* ★ 2026-08-11 · 놓기와 심기를 가른다 (first_play §sown) */
         sowCropPot, cropPotSown } from './first_play.js';
import { createTutorialState, yearDay0Of } from './tutorial.js';
/* 체력 — 하루에 돌볼 수 있는 양. 규칙은 전부 그쪽 모듈이 갖는다(docs/stamina.md) */
import { spend as spendStamina, canAct as canActStamina, createStaminaState } from './stamina.js';
import { createShopState, useStock, assertStockAll, stockOf,
         creditCropSurplus,
         /* ★ 2026-08-17 · 가구를 사고 판다 (아래 §가구를 사고 판다) */
         furnitureQuoteOf, creditFurnitureSale, presetOfFurnitureItemId,
         /* ★ 2026-08-17 — 꾸미는 화분 표. 「고른 화분」이 실제로 나가고 실제로 그려지게 한다 */
         POT_KINDS } from './shop.js';
/* ★★ 2026-08-17 — 삽수 용기. **화살표는 한 방향이다**(state → propagation).
   그쪽은 이 파일을 안 부르므로 순환이 안 생긴다(propagation 은 place·shop·stamina 만 쓴다).
   ⚠ 들여오는 까닭 하나: 「이 그릇에 무엇을 심을 수 있나」는 씨앗(여기)과 삽수(그쪽)를
     둘 다 알아야 답할 수 있고, 둘을 아는 자리는 여기뿐이다(§plantableInto). */
import { CONTAINERS, placeCutContainer, containerRowOf, containerKindOf,
         containerKindOfItem, putCuttingIn, methodLeafBlock,
         cuttingStatsNow } from './propagation.js';
import { atFromSlot, isFreeSlotId, makeAt, resolvePlacement, samePoint,
         inRoom, assertFurnitureAt, followFurnitureAt } from './place.js';

export const SCHEMA = 'game_state/1';

/* ★ 시뮬 모드 — 판정 단위가 모드마다 다르다.
     real   날씨·계절을 굴린다. 판정 단위 = 계절별 7일 이동평균.
            peak·연평균은 판정에 쓰지 않는다(data/balance/weather.json 규약).
     novice 날씨·계절 계수를 1.0으로 고정한다. 맑음·여름에 못박히므로
            peak가 곧 실제값이 되고, peak 금지 규약이 적용되지 않는다.
   ⚠ v0는 real 로만 검증한다. novice 는 '자리'다 — 값(중간 난이도 계수 등)은 plan 미정. */
export const SIM_MODES = {
  real:   { ko: '실전 (날씨·계절 굴림)', rollWeather: true,  rollSeason: true,  weather: null,    season: null },
  novice: { ko: '초보 (계수 1.0 고정)',  rollWeather: false, rollSeason: false, weather: 'clear', season: 'summer' }
};

export function newState(opt = {}) {
  return {
    schema: SCHEMA,
    day: 0,

    /* 시간 3모드가 이 숫자 하나로 갈린다 — 하드코딩 금지(plan-to-core §미해결). v0 미사용. */
    timeScale: { minutesPerGameDay: 30 },

    /* 모드. seasonK/weatherK 는 '중간 난이도'가 생길 때 쓸 자리다(null = 모드 기본).
       ★★ `yearDay0` — **게임 0일이 연중 며칠인가** (2026-08-05 · 박사님 확정으로 고침).
       ------------------------------------------------------------
       달력이 **두 벌이었다.** 화면은 `tutorial.seasonAt` 을 쓰는데 그건 연중 135일
       (= 여름 90 + `startSeasonDay` 45)에서 시작하고, 빛은 `skyFor` 안에서
       `seasonOf(S.day)` 를 그냥 써서 **0일을 봄 0일**로 봤다.
       ⇒ 게임 50일이 화면엔 `autumn`, 빛 계산엔 `spring` 이었다(test_balance_routes ②-b).
         novice 는 빛 계절이 안 굴러 안 보였을 뿐, 켜는 순간 드러나는 고장이다.

       ★ 고치는 자리를 여기로 고른 이유 — **빛에게 튜토리얼을 가르치지 않는다.**
         `room_profile`·`light_adapter` 가 `tutorial.js` 를 import 하면 의존이 거꾸로 선다
         (빛은 튜토가 있든 없든 도는 물건이다). 대신 상태가 "우리 0일은 연중 N일이다"
         한 줄만 알려 준다. 빛은 그 숫자만 더한다.
       ⚠ 값의 정본은 `TUTORIAL_RULES` 다 — 여기서 135 를 베끼지 않는다.
         `tutorial.yearDay0Of()` 가 계산해 주고, 그 값이 없으면 0(= 봄 0일, 옛 동작)이다. */
    sim: { mode: opt.mode || 'real', seed: 0, weatherK: null, seasonK: null,
           yearDay0: Number.isFinite(opt.yearDay0) ? opt.yearDay0 : yearDay0Of() },

    /* ★ 가구 덮어쓰기 표 (2026-08-03) — `{ <uid>: {x, z, rot} }`
       **플레이어가 옮긴 가구만** 담는다. 비어 있으면 data/house_rooms.json 의 기본값이다.
       그 파일은 house 소유라 게임이 못 건드린다 — 그래서 '차이'만 세이브에 남긴다.
       조립 때 메모리 사본에 얹는 일은 light_adapter.build 가 한다(파일은 안 바뀐다). */
    home: { room: opt.room || 'banjiha', furniture: {} },

    /* 식물등 — 방에 이미 놓인 grow 기구를 앞에서부터 n개 켠다.
       개수·PPFD·와트를 코어가 지어내지 않는다(house의 lightRigs + lighting_presets).

       ★ aim — 등마다 겨눈 각도 `{ <등 uid>: {yaw, tilt} }` (2026-08-06).
         가구 덮어쓰기(home.furniture)와 **같은 규약**이다: 플레이어가 실제로 겨눈 등만 담는다.
         비어 있으면 「안 겨눔」이고 그때 조도는 옛 식과 비트 단위로 같다 —
         그래서 **옛 세이브(aim 칸이 없는 것)는 자동으로 「안 겨눔」으로 열린다.**
         돌릴 수 있는 범위는 여기가 아니라 data/lighting_presets.json 이 갖는다. */
    lamps: { count: 0, litHours: 12, aim: {} },

    /* ★ 화분 — **비어 있게 시작한다** (2026-08-02).
       몬스테라는 플레이어가 처음부터 키운 게 아니라 **이미 싹이 튼 개체가 도착**하는 것이다.
       앱을 열었다고 Day 0부터 식물이 있으면 안 된다 — 도착 이벤트(Day 4 선물, 이번 범위 밖)나
       테스트 초기화 경계(givePlant)가 만들 때 생긴다. v0는 1개 (growth가 한 그루 전용). */
    pots: [],
    /* ══ ★★ 빈 화분 — **놓았지만 아직 안 심은 것** (2026-08-16 박사님 확정) ══════════
       박사님: *"씨앗이 자동으로 안 들어가고 **화분만 놓이게** 해 줘."*
       ⚠⚠ **`pots` 에 넣지 않는다.** `S.pots` 를 도는 자리가 여덟 군데이고
         전부 **그루가 하나 있다**를 전제로 돈다(하루 진행 · 조도 · 세이브 · 생장 창 고르기).
         빈 화분을 거기 끼우면 하루 진행이 통째로 흔들린다 — 그래서 **따로 둔다.**
       ★ 시루와 같은 결이다: 시루도 `firstPlay.cropSites` 에 따로 있지 `pots` 에 없다.

       ══ ★★★ 2026-08-17 — **여기에 유리 수경병도 산다** (박사님 확정) ══════════════
       박사님: *"**삽수 꽂기가 뭐야? 용도가 아니라 거기 심어지는 거에 따라 나뉘어야지.**
         … **씨앗심기 누르면 심을 수 있는 인벤 템 리스트가 팝업으로 나와서 고르도록** 하자."*
       ⇒ 「씨앗용 화분」과 「삽수용 포트」라는 **용도 구분이 없다.** 놓을 때는 그냥 빈 그릇이고,
         **무엇이 들어가느냐는 심을 때 고른다**(`plantableInto` → `plantInto`).
       ⇒ 그래서 목록도 **하나**다. 하루 있었던 `S.cutContainers` 는 여기로 합쳐 없앴다.
       한 줄 = { id, container, itemId, at, slotId, placedOnDay, usedOnDay }
         container  'soil'(검은 모종포트) | 'jar'(유리 수경병). **옛 줄에는 없다** —
                    그때는 `itemId` 로 읽는다(`propagation.containerKindOf`)
         usedOnDay  한 번이라도 무언가 들어앉았나 — 걷을 때 돌아오나가 이 칸으로 갈린다
       ⚠ **빈 것만 산다.** 씨앗이 들어가면 `S.pots` 로 가고, 삽수가 들어가면 삽수가 그릇을
         지고 간다(`c.container`). 어느 쪽이든 이 줄은 빠지고, 삽수를 도로 빼면 돌아온다.
       ★ 쓰는 창구는 `propagation.js §⑤-2` 가 갖는다(용기 표가 거기 있어서다). 아래
         `placeEmptyPot`·`removeEmptyPot` 은 그 창구로 넘기는 문이고 이름이 안 바뀌었다. */
    emptyPots: [],

    /* ★ 삽수 — 잘라서 물꽂이·화분에 담아 둔 조각들 (2026-08-03).
       규칙과 수치는 src/game/propagation.js 가 갖는다(docs/propagation.md 가 정본).
       여기 두는 이유는 **자리를 차지하기 때문**이다 — placedItems 가 이 배열을 같이 낸다.
       ⚠ 화분(S.pots)이 아니다. 삽수는 growth 를 안 쓴다(한 그루 전용) — 논리로만 돈다.
         승격은 다개체 리팩터 뒤다(propagation.promoteToPot 이 그 자리에서 던진다). */
    cuttings: [],

    /* Day 0 콩나물 → Day 4 첫 수확·선물 → 몬스테라 말린 새순.
       정식 작물 목록이나 경제 장부가 아니라 첫 재미 검증 한 흐름만 담는다. */
    firstPlay: createFirstPlayState({ enabled: !!opt.firstPlay, rules: opt.firstPlayRules }),

    /* 반지하 튜토리얼 — 첫 플레이 **그 뒤**부터 원룸 이사까지 (2026-08-03).
       규칙과 수치는 src/game/tutorial.js 가 갖는다(docs/story_arc.md 가 정본).
       첫 플레이가 끝나기 전에는 날짜도 돈도 계절도 안 움직인다. */
    tutorial: createTutorialState({ enabled: !!opt.firstPlay }),

    /* ★★ 스토리 ③④ — 원룸에 언제 들어왔나 · 엔딩을 봤나 (2026-08-05 신설).
       규칙과 수치는 src/game/oneroom.js · ending.js 가 갖는다(docs/oneroom.md 가 정본).
       ⚠ **여기서 import 하지 않는다** — state 를 import 하는 쪽이라 순환이 된다
         (`cuttings`·`perks` 와 같은 규약: 모양만 여기, 규칙은 저쪽).
         두 곳이 갈리지 않게 `tools/test_oneroom.mjs` 검사 A 가 등식을 고정한다.
       ★ **단계(stage)를 여기 안 적는다.** 단계를 정하는 사실은 이미 상태에 둘 다 있다 —
         `tutorial.movedOut`(②를 했나)과 아래 `ending.doneOnDay`(④를 봤나)다.
         적어 두면 「이사는 했는데 단계는 반지하」인 어긋난 판이 생기고 고칠 길이 없다. */
    story: { schema: 'story/1', movedInOnDay: null,
             ending: { reachedOnDay: null, doneOnDay: null } },

    /* 인터넷 주문 상점 — 배송 중인 주문과 도착한 재고 (2026-08-03).
       규칙·값·배송일은 src/game/shop.js 가 갖는다(docs/shop.md 가 정본).
       ★첫 콩나물 시루는 **공짜로 준 것**이라 재고에 안 들어간다. 그 뒤부터 주문이다.
       ★★★ 2026-08-16 — `opt.startSeeds` 로 **콩 씨앗을 들려 보낼 수 있다**
         (박사님: *"콩나물 시루가 콩씨앗이 없어도 설치되게 … 용기에 씨 심기 해서 심도록 해
         **처음에 순서가**"*).
         ⚠ 이걸 안 주면 튜토리얼 첫 걸음이 **막힌다**: 놓기는 되는데 심을 씨앗이 없어서
           빈 시루가 방에 선 채로 하루가 흐른다(실측 — 재고 bean_seed 0).
         ⚠ **공짜로 더 준 것이 아니다.** 예전에는 시루에 콩이 이미 앉아 있었고(놓기 = 심기)
           그 콩값을 아무도 안 냈다. 그 콩이 이제 봉지로 손에 들려 있는 것뿐이라
           살림이 한 푼도 안 움직인다.
         ⚠ **기본값은 0 이다.** 검사·재현이 「재고 없이 심어지나」를 재고 있는데
           (`test_banjiha_routes §A-2`), 여기서 말없이 하나를 주면 그 줄들이 조용히 거짓이 된다.
           게임 화면(`game.html`)이 새 판을 세울 때만 1 을 넘긴다. */
    shop: (() => {
      const sh = createShopState();
      const seeds = Math.max(0, Math.round(opt.startSeeds || 0));
      if (seeds > 0) sh.stock[cropKindOf('beansprout').seedItemId] = seeds;
      return sh;
    })(),

    /* 코어가 따로 쌓는 DLI 이력. 용도는 두 가지뿐:
         ① growth의 dli7()과 대조(어긋나면 배선이 틀린 것)
         ② 30일 검수 리포트의 '문턱 넘는 주 비율'
       ★ 판정에는 쓰지 않는다. 고사·활력은 취소·보류다(2026-08-02). */
    dliHist: [],

    /* ★★ perks — **보상으로 켜지는 편의 기능** (2026-08-04 신설. 지금은 자리만).
       ------------------------------------------------------------
       박사님 확정: *"자동수확은 나중에 뭐 아이템이나 아니면 특수보상이나
                    업적 달성 보상으로 주도록 하고."*

       ★ 지금은 **늘 꺼져 있다.** 여기 두는 이유는 하나다 — 나중에 켤 자리를 미리 파 두면
         세이브 규약과 빨리감기 기본값을 그때 고치지 않아도 된다(세이브는 이미 이 칸을 싣는다).
       ★ `autoHarvest` 가 켜지면 이렇게 돈다(loop.js §수확과 어떻게 맞물리나):
           ① 빨리감기가 거둘 때가 됐다고 서지 않는다(`stopOnReady` 기본값이 false 가 된다)
           ② 대신 빨리감기 tick 이 `harvestCrop(S, io)` 를 대신 부른다 — [수확하기]와 같은 함수다
         ⚠ 재파종(씨앗값·자리 고르기)은 **자동이 아니다.** 그건 선택이라 대신 해 주면 안 된다.
       ★ 읽는 곳은 `loop.hasAutoHarvest(S)` 한 곳뿐이다 — 여러 곳에서 읽으면 반씩 켜진다. */
    perks: { autoHarvest: false },

    /* ★★ 체력 — **하루에 돌볼 수 있는 양** (2026-08-05 박사님 확정 · docs/stamina.md).
       규칙과 값은 전부 `src/game/stamina.js` 가 갖는다. 여기는 모양만 둔다
       (`cuttings`·`perks` 와 같은 규약 — 두 곳이 갈리지 않게).
       ★ 넣은 이유 한 줄: 「잉여 채소를 판다」가 들어오면 시루를 늘릴 이유가 **무한**해진다.
         그전에는 끼니 상한 위가 버려져 저절로 멈췄는데, 팔 수 있으면 안 멈춘다.
         체력이 그 상한이고, 그 상한이 곧 박사님이 원하신 노가다다. */
    /* ★ 2026-08-09 — 규칙을 받아 꽂는다(`opt.staminaRules`). 안 주면 밑값으로 돌고,
       값은 `data/balance/stamina.json` 이 정본이다 — 곱선이 아직 최종이 아니라 표로 둔다. */
    stamina: createStaminaState(opt.staminaRules || undefined),

    /* 경제는 3단계다. 표시만 하고 차감하지 않는다. */
    ledger: { today: { in: 0, out: 0 }, total: 0, electricityWon: 0 },

    log: []
  };
}

export function pot0(S) { return S.pots[0] || null; }
export function hasPlant(S) { return S.pots.length > 0; }

/* ============================================================
   ★★ 여러 그루 — 화분 ↔ 생장 창의 그루를 잇는 이름 (2026-08-15)
   ------------------------------------------------------------
   생장 창(plant_grow.html)은 그루를 **id 로** 들고 있다(§다개체 등록부).
   코어는 화분마다 그 id 를 하나씩 들고 다니며 「이 화분의 그루를 꽂아라」라고 부른다.

   ★ 선물로 온 첫 그루는 `__main__` 이다 — 생장 창이 부팅 때부터 갖고 있던 **바로 그 그루**다.
     새 id 를 주면 옛 판을 열 때 빈 그루가 하나 더 생기고, 화면의 몬스테라는 아무도 안 굴린다.
   ⚠ 그래서 `growthId` 는 **화분에 적어 두고 세이브에도 싣는다.** 순서(pots[0])로 정하면
     첫 화분을 팔거나 옮기는 날 이름이 통째로 밀린다. */
export const MAIN_GROWTH_ID = '__main__';
export function growthIdOf(pot) {
  if (!pot) return null;
  return pot.growthId || MAIN_GROWTH_ID;
}

/* ★★ 빛 이력의 정본은 **화분마다**다 (2026-08-15 다개체).
   `S.dliHist` 는 그 첫 화분의 **대표 칸**이다 — 작물(`firstPlay.beansprout`)이 시루 여럿으로
   갈릴 때 쓴 규약과 같다(first_play §syncCropLead). 사본이 아니라 **같은 배열**을 가리키므로
   둘이 어긋날 수가 없다. 세이브도 화면도 옛 이름을 그대로 읽는다.
   ⚠ 화분 목록이 바뀌면(도착·심기·판매·복원) 반드시 이걸 다시 부른다. */
export function syncPotLead(S) {
  if (!S) return S;
  const p = pot0(S);
  if (!p) return S;
  if (!Array.isArray(p.dliHist)) p.dliHist = Array.isArray(S.dliHist) ? S.dliHist : [];
  S.dliHist = p.dliHist;
  return S;
}
/* 이 화분의 빛 이력(정본). 없으면 만들어 준다 — 옛 세이브·옛 화분도 여기로 들어온다. */
export function potHist(S, pot) {
  const p = pot || pot0(S);
  if (!p) return null;
  if (!Array.isArray(p.dliHist)) p.dliHist = [];
  if (p === pot0(S)) S.dliHist = p.dliHist;
  return p.dliHist;
}

/* ★★ 도착 진행도 — **줄기 1개짜리로 온다** (2026-08-04 박사님 확정)
   ------------------------------------------------------------
   원문: *"몬스테라 줄기 1개일 때 줘서 2개째 자라는 걸로 하자"*

   ★ 왜 45인가 — **재서 나온 값이다**(tools/probe_arrival_stems.mjs).
     "줄기"는 plant_grow 의 **축(axis)** 이다. 축 하나가 생장점 하나이고 잎 한 장이며,
     화면에서 흙에서 갈라져 올라오는 대 하나가 그것이다(마디 seg 는 한 대 안에서 쌓이는
     마디라 줄기 수가 아니다. 화면으로 대조했다 — docs/engine/shots/arrival/).

       유효  5~50 → 줄기 1개      ← 여기가 도착 구간이다
       유효 51    → 2개째가 난다 (혹이 부풀고 그 자리에서 새 축이 나온다)
       유효 61    → 그 2개째의 첫 잎이 **말린 새순**으로 보인다
       유효 134   → 3개째
     씨앗 8종(1·7·8888·12345·24601·40503·92158·99999)이 전부 같은 날에 넘어간다 —
     혹이 **어느 마디에** 붙나만 랜덤이고 **언제**는 시간이 정한다(growTopology ④).
     단 쌍혹(15%)이 걸린 판(24601)은 51일에 2개째와 3개째가 같이 난다.

   ★ 45 를 고른 이유(1~50 중에서)
     ① 잎 한 장이 이미 **중간잎**이라 몬스테라 잎 모양으로 보인다. 20일 언저리는 새순이라
        무슨 식물인지 화면에서 안 읽힌다.
     ② 도착 6일(유효) 뒤 2개째가 난다 — 플레이어가 **기다릴 만한 거리**다.
     ③ 그 2개째의 첫 잎이 유효 61 = 도착 16일 뒤에 **말린 새순**으로 나온다.
        첫 플레이의 완료 신호가 정확히 그 단계다(first_play.FIRST_PLAY_COMPLETE_PHASE_ID).
        ⇒ **"2개째가 자란다"와 "첫 플레이가 끝난다"가 같은 사건이 된다.**
     ⚠ 50 으로 두면 도착 다음 날 바로 2개째가 나서 "줄기 1개"를 볼 틈이 없고,
       38 이하로 내리면 말린 새순까지 23일이 넘어 첫 플레이가 늘어진다(재 봤다).

   ══ ⚠ 이 값이 살림에 치르는 값 — **재서 나온 것이다**(tools/test_banjiha_routes.mjs) ══
     이사 성공률 40/40(100%)은 **그대로**다. 그런데 **중앙값이 튜토 57일 → 189일**로 늘었다.
     이유는 하나다. **첫 플레이는 언제나 "도착 뒤 첫 말린 새순"에서 끝나는데, 그 날이
     유효 61 아니면 유효 146 둘 중 하나로만 떨어진다** (spear_furled 창이 그 둘뿐이다 —
     유효 13~14 · 61~67 · 146~152). 그래서 도착을 14~60 사이 어디에 두든 튜토는
     **유효 61 짜리 그루로 시작**하고, 68~145 어디에 두든 **유효 146 짜리로 시작**한다.
     중간이 없다. 도착값을 43 으로 하든 50 으로 하든 살림은 똑같다.

     잭팟은 모주에 **무늬 잎 두 장**이 있어야 성립하는데(1,464,000원), 세 번째 잎은
     유효 150 에 난다. 옛 도착 143 은 그 바로 앞이었고, 유효 61 로 시작하면 그 자리까지
     **89일**을 더 기다린다 — 그 기다림이 곧 57 → 189 다.
   ⇒ **"줄기 1개로 준다"와 "튜토 57일"은 지금 구조에서 동시에 성립하지 않는다.**
     박사님 지시가 앞을 골랐으므로 여기 값이 45 다. 뒤를 되찾으려면 고칠 곳은 이 숫자가 아니라
     잭팟이 요구하는 잎 수(docs/shop.md §1)나 첫 플레이의 완료 단계(first_play.js
     FIRST_PLAY_COMPLETE_PHASE_ID)다 — 둘 다 기획 판단이라 손대지 않았다.

   ══ ★★ 2026-08-09 — **위 날짜들이 전부 움직였다.** 값(45)은 그대로 두었다 ══
     박사님이 잎 간격을 표로 정하셨다(`data/growth_tuning.json · leaf_interval.days`
     = 30·40·50·70·100·150·200·300). 시간 축이 그 표를 따르게 바뀌어서
     (plant_grow.html §ageOf) 잎이 나는 유효 생장일이 이렇게 됐다:

       옛(timeCurve 0.72)   10 · 61 · 146 · 249 · 365 · 493 · 631 · 778
       새(잎 간격표)        30 · 70 · 120 · 190 · 290 · 440 · 640 · 940

     ⇒ 도착 45 는 여전히 **줄기 1개** 구간이다(잎 2장째가 70이므로). 그래서 값은 안 바꿨다.
     ⇒ 다만 「도착 뒤 첫 말린 새순」이 **유효 61(도착+16) → 유효 70(도착+25)** 로 밀렸다.
       첫 플레이가 유효일 기준 **9일** 길어진다. 자리 값(30~70 구간)은 하나뿐이라
       도착값을 31~69 어디에 둬도 완료일은 70 으로 같다 — 위 「중간이 없다」 성질은 그대로다.
       ⚠ 튜토를 줄이려면 도착값을 **60 언저리로 올리는 것**이 이제 유일한 손잡이다
         (도착+10 이 된다). 기획 판단이라 손대지 않았다 — plan 이 정할 것.
     ⇒ 세 번째 잎(잭팟이 기다리던 자리)은 유효 150 → **120** 으로 앞당겨졌다.

   ⚠ 이 숫자는 growth 소유다. 코어는 도착 시 한 번 넘기기만 한다.
   ⚠ 옛 세이브(143 으로 저장된 판)는 이 값에 **소급되지 않는다** — save.js §arrivalGrowthDays.
     화분이 `arrivalGrowthDays` 를 직접 싣고(state.givePlant), 세이브가 그 값을 그대로 적었다가
     그대로 되세운다(save.js:190·705). ARRIVAL 은 **그 칸이 없는 아주 옛 세이브**의 메움값일 뿐이다.
     ⇒ 143 으로 저장된 판은 다시 열어도 143 이다. 자라던 포기가 갑자기 작아지지 않는다. */
export const ARRIVAL = {
  plantId: 'monstera_deliciosa',
  growthDays: 45,
  potAsset: 'monstera/pot.glb'      // 회전 무관 지름 0.202 ≤ 창턱 0.21 (core-to-house ④)
};

/* ★ 개체 생성 = **도착**. 여기서만 setGrowth 를 쓴다(점프 1회).
   그 뒤 일일 진행은 전부 advanceTo 다 — 이 경계를 흐리면 저광 정지가 무시된다.

   pot.daysPlanted 는 **플레이어가 돌본 날**이라 0부터 센다.
   growth 안의 달력·유효 진행도는 ARRIVAL.growthDays 에서 시작한다. 둘은 다른 축이다. */
/* ★ 원자적이다 (2026-08-02) — 형태를 못 세우면 개체도 안 생긴다.
   순서가 중요하다: **setGrowth 가 성공한 뒤에만** 화분·로그를 남긴다.
   반대로 하면 "화분은 있는데 형태는 0일(=씨앗)"인 개체가 조용히 남는다.
   던지면 S 는 손대기 전 상태 그대로다 — 부분 성공이 없다. */
export function givePlant(S, io, opt = {}) {
  if (S.pots.length) return pot0(S);                     // 이미 있으면 다시 만들지 않는다

  const g = io && io.growth;
  const growthDays = opt.growthDays ?? ARRIVAL.growthDays;
  if (!g || typeof g.setGrowth !== 'function')
    throw new Error('[도착] 생장 창이 준비되지 않았습니다 — setGrowth 를 부를 수 없어 개체를 만들지 않습니다');
  if (typeof g.has === 'function' && !g.has('setGrowth'))
    throw new Error('[도착] plant_grow 에 setGrowth 가 없습니다 — 개체를 만들지 않습니다');

  /* ① 형태부터 세운다. 여기서 던지면 아래로 내려가지 않는다(화분·로그 0) */
  const res = g.setGrowth(growthDays);

  /* ★ 그려졌는지까지 본다 (growth 렌더 신호 계약, 2026-08-02).
     `setGrowth` 는 그리기가 실패해도 예외를 던지지 않는다 — 논리 진행과 화면을 갈라 뒀기 때문이다.
     그 신호를 안 보면 **"화분은 있는데 화면엔 없는" 개체**가 조용히 생긴다.
     도착은 화면에 보이는 것이 전부인 사건이라 여기서 멈춘다 — 화분도 로그도 만들지 않는다.
     ⚠ drawn 이 undefined 인 옛 growth 는 '정보 없음'이라 막지 않는다(=== false 일 때만 멈춘다). */
  if (res && res.drawn === false) {
    const why = res.drawError ? ` — ${res.drawError}` : '';
    const err = new Error(`[도착] 몬스테라를 화면에 그리지 못했습니다${why}. 개체를 만들지 않았습니다`);
    err.drawError = res.drawError ?? null;
    err.recoverable = true;          // 다시 그릴 수 있으면 재시도 가능한 종류다
    throw err;
  }
  /* HUD 실패는 3D 실패와 등급이 다르다 — 형태는 보이는데 growth 쪽 숫자판만 죽은 것이라 경고만 한다. */
  if (res && res.hudError) {
    console.warn(`[도착] growth HUD 갱신 실패(3D 는 그려짐) — ${res.hudError}`);
    pushLog(S, `⚠ growth HUD 갱신 실패 — ${res.hudError} (형태는 그려졌습니다)`);
  }

  /* ② 성공했으니 개체를 남긴다 */
  const pot = {
    id: opt.id || 'pot_01',
    /* slotId 는 **계약 열쇠**다 — 하루치 조도 계약(daily_light/1)에 이 화분이 실리는 이름이고
       세이브에도 그대로 들어간다. 추천 자리 위면 그 자리의 안정 id, 자유 좌표면 `free:{화분 id}`. */
    slotId: opt.slotId || null,
    /* ★ 좌표가 정본이다 (2026-08-03). 없으면 slotId 로 돌고, 로드 때 migratePots 가 채운다. */
    at: opt.at ? makeAt(opt.at) : null,
    plantId: opt.plantId || ARRIVAL.plantId,
    potAsset: ARRIVAL.potAsset,
    variegated: false,
    daysPlanted: 0,                                      // 플레이어가 돌본 날
    /* growth 에게 실제로 먹인 하루의 수. 밝은 날은 하루에 둘이라 위 칸과 갈린다 —
       `S.dliHist` 와 **1:1** 이고, 그 짝을 세이브 복원이 검사한다(save.js §fedDays) */
    fedDays: 0,
    arrivedOnDay: S.day,
    /* ★ 한 번이라도 방에 놓였나 — 자리를 받고 왔으면 참이다(§rehomePot).
       거짓이면 **가방에 있는 것**이고, 하루가 가도 아무도 자동으로 안 앉힌다. */
    placedOnce: !!(opt.slotId || opt.at),
    /* ★★ 마지막으로 물 준 날 (2026-08-07 · §몬스테라 물주기).
       **온 날을 채운다.** null 로 두면 선물로 온 화분이 도착하자마자 목말라 있다 —
       받자마자 벌이 된다. 첫 주기는 도착일부터 센다. */
    wateredOnDay: S.day,
    arrivalGrowthDays: growthDays,
    /* ★ 생장 창의 어느 그루냐 (2026-08-15 다개체). 선물은 **부팅 때부터 있던 그 그루**다 —
       새 id 를 주면 빈 그루가 하나 더 생기고 화면의 몬스테라는 아무도 안 굴린다. */
    growthId: MAIN_GROWTH_ID,
    /* ★ 이 그루가 받은 빛 이력(정본). `S.dliHist` 는 이것의 대표 칸이다(§syncPotLead).
       도착 시점의 `S.dliHist` 를 **그대로 가리킨다** — 새 배열을 만들면 그 순간 둘이 갈린다. */
    dliHist: Array.isArray(S.dliHist) ? S.dliHist : []
  };
  S.pots.push(pot);
  syncPotLead(S);
  /* ★ 2026-08-27 [Plan] ① — 「화분째」가 «심는 걸음이 없다»를 그 자리에서 말한다.
     그리고 박사님이 이 그루를 「축복받은 몬스테라 삽수」라 부르기로 하셨다 —
     상점의 「몬스테라 씨앗」과 «같은 것으로 보이면» 안 되기 때문이다.
     ⚠ `${growthDays}` 는 읽어 쓰는 값이라 안 낡는다. 그대로 둔다. */
  pushLog(S, `🪴 축복받은 몬스테라 삽수가 도착했습니다 — 화분째, 이미 ${growthDays}일 자란 개체입니다`);
  return pot;
}

/* ══════════════════════════════════════════════════════════════════════════
   ★★★ 씨앗을 심는다 — **두 번째 그루가 생기는 유일한 길** (2026-08-15 · 걸음 3)
   ──────────────────────────────────────────────────────────────────────────
   박사님 지시: *"여러 그루를 굴릴 수 있도록 하자. 어차피 보상으로 주는 거보다는 느리잖아?"*

   ★ 그 말씀이 곧 밸런스의 답이다 — **선물 몬스테라는 유효 45일짜리로 오고, 씨앗은 0일부터**다.
     돈으로 병렬화해도 느리다. 그래서 열어도 판이 안 무너진다.

   ══ 왜 이 함수가 없으면 안 되나 ═══════════════════════════════════════════
   `monstera_seed` 는 상점에 있고 살 수도 있는데 **그 씨앗을 쓰는 코드가 한 줄도 없었다.**
   사면 가방에 쌓이기만 하고 화면이 아무 말도 안 한다 — 이 저장소가 제일 싫어하는 조용한 실패다.

   ══ 순서가 계약이다 (givePlant · repotCutting 과 **같은 규칙**) ════════════
     ① 던질 수 있는 것을 다 던져 본다 — 체력 · 재고 · 자리 · **형태 세우기**
     ② 다 됐으면 재고를 뺀다
     ③ 화분을 남긴다
     ④ 체력을 깎는다
   ⇒ 중간에 던지면 **아무것도 안 바뀐다.** 씨앗만 사라지고 화분은 안 생기는 일이 없다.

   ★ 형태를 **먼저** 세운다(생장 창에 그루를 만들고 0일로 그린다). 못 그리면 화분을 안 만든다 —
     "화분은 있는데 화면엔 없는 개체"를 막는 그 규칙 그대로다(givePlant §도착).

     opt.potItemId  심을 그릇(상점 id). 기본 `nursery_pot`(검은 모종포트)
     opt.at·slots·size  자리. 안 주면 화분만 만들고 자리는 나중에 setPotAt 으로 준다
     opt.seed       생장 창에 줄 씨앗(모양·색). 안 주면 이 판에서 만든다
     opt.log        기록 함수
   반환 화분 객체
   ⚠ 화면(단추·그루 고르기)은 여기 없다 — `docs/handoff/multiplant-to-plan.md` 에 코드째로 적었다.
══════════════════════════════════════════════════════════════════════════ */
export const SEED_ITEM_ID = 'monstera_seed';
/* 심을 그릇 — 상점의 `pot`(검은 모종포트)다. 삽수 분갈이가 쓰는 그 그릇이고
   (`propagation.CONTAINERS.soil.itemId`), 여기서 새 품목을 만들지 않는다. */
export const SEED_POT_ITEM_ID = 'pot';
/* 씨앗에서 난 그루의 도착 진행도. **0 이다** — 그것이 이 길이 느린 이유의 전부다.
   ⚠ 여기에 숫자를 하나 올리는 순간 「사면 빨라진다」가 된다. 올리려면 기획이 정할 것. */
export const SEED_START_GROWTH_DAYS = 0;

/* ══ ★★★ 빈 그릇을 놓는다 — **아무것도 안 넣는다** (2026-08-16 → 2026-08-17 넓힘) ══════
   박사님(08-16): *"씨앗이 자동으로 안 들어가고 화분만 놓이게 해 줘."*
   박사님(08-17): *"**용도가 아니라 거기 심어지는 거에 따라 나뉘어야지.**"*
   ★ 시루와 같은 결이다 — 놓기와 심기가 두 걸음이다(`placeSiru(sow:false)` → `sowCrop`).
   ⚠ 그릇 하나만 쓴다. 씨앗도 삽수도 **심을 때** 들어간다(`plantInto`).
   ⚠ `S.pots` 에 안 넣는다 — 거기는 그루가 있는 것만 사는 자리다(§emptyPots).

   ★★ 2026-08-17 — **유리 수경병도 이 문으로 놓는다.** 갈래는 `opt.container` 로 고른다:
       placeEmptyPot(S, at, { container: 'soil' })   검은 모종포트 (기본)
       placeEmptyPot(S, at, { container: 'jar'  })   유리 수경병
     ⚠ 옛 호출부(`opt.potItemId` 만 주는 것)가 **그대로 돈다** — 품목에서 갈래를 읽는다.
     ★ 속은 `propagation.placeCutContainer` 다. 규칙표(`CONTAINERS`)가 거기 있어서고,
       여기서 다시 쓰면 두 벌이 된다. 이름을 안 바꾼 것은 화면(`game.html`)이 이 이름을
       부르고 있기 때문이다 — 문은 그대로 두고 속만 옮겼다.
   반환 { id, container, containerKo, itemId, at, slotId, left } */
export function placeEmptyPot(S, at, opt = {}) {
  /* ★★★ 2026-08-17 — **고른 화분이 실제로 나간다** (박사님: *"화분 구매 시 모양이 안 나와"*).
     ⚠⚠ 꾸미는 화분 넷은 `CONTAINERS` 에 없다 — 그래서 `containerKindOfItem` 이 `null` 을 내고
       **검은 모종포트로 떨어졌다.** 콘크리트 사각을 고르면 모종포트가 나가고 모양도 기본이었다.
       (실측: 사각 1 · 모종포트 1 → 사각을 놓았더니 모종포트가 0)
     ⇒ 심는 **방식**은 흙 그릇 그대로 두고, **품목·모양·지름**만 그 화분 것으로 넘긴다.
     ★ 지름은 `POT_KINDS` 가 GLB 를 직접 재서 굳혀 둔 값이다 — 여기서 지어내지 않는다. */
  const potKind = opt.potItemId
    ? Object.values(POT_KINDS).find(k => k && k.itemId === opt.potItemId) || null : null;
  const decorative = !!(potKind && !containerKindOfItem(opt.potItemId));
  /* ★★★ 2026-08-17 — **검은 모종포트도 제 모양으로 그린다** (박사님: *"검은 모종포트 모양도
     그게 아니라 크림 어쩌고로 나와."*)
     ⚠ 위 `decorative` 는 **그릇 표에 없는 화분**만 참이다. 검은 모종포트는 그 표에 있으므로
       거짓이 되고, 그러면 `potAsset` 을 한 톨도 안 넘겨 방이 기본값
       (`monstera/pot.glb` = **크림도자기**)으로 떨어졌다.
     ⇒ 모양·지름은 **아는 화분이면 언제나** 넘긴다. 품목을 갈아 끼우는 것(`itemId`)과
       모양을 넘기는 것은 **다른 일**인데 한 조건에 묶여 있었다. */
  const artOf = potKind ? { potAsset: potKind.asset, potD: potKind.diameterM } : {};
  const kind = opt.container ||
               (opt.potItemId ? containerKindOfItem(opt.potItemId) : null) ||
               (decorative ? 'soil' : null) ||
               containerKindOfItem(SEED_POT_ITEM_ID) || 'soil';
  const r = placeCutContainer(S, kind, at, {
    ...opt, log: null,
    ...artOf,
    ...(decorative ? { itemId: potKind.itemId } : {})
  });
  pushLog(S, r.accepts && r.accepts.includes('seed')
    ? `🪴 빈 ${r.containerKo}를 놓았습니다 — [🌱 심기]를 눌러 씨앗이나 삽수를 골라 주세요`
    : `🫙 빈 ${r.containerKo}를 놓았습니다 — [🌱 심기]를 눌러 삽수를 골라 주세요`);
  return r;
}

/* 그 빈 그릇을 목록에서 뺀다 — 심었거나 치웠을 때. 없으면 조용히 지나간다(두 번 불러도 안전).
   ⚠ **재고를 안 돌려준다.** 여기는 「목록에서 지운다」이고, 걷어서 가방에 넣는 것은
     `propagation.removeContainer` 다(그쪽이 돌아오나 마나를 `CONTAINERS` 로 정한다).
     둘을 한 함수로 묶으면 `plantMonsteraSeed` 가 심을 때마다 화분이 재고로 하나 생긴다. */
export function removeEmptyPot(S, id) {
  if (!Array.isArray(S.emptyPots)) return null;
  const i = S.emptyPots.findIndex(p => p && p.id === id);
  if (i < 0) return null;
  return S.emptyPots.splice(i, 1)[0] || null;
}

export function emptyPotOf(S, id) {
  return (S.emptyPots || []).find(p => p && p.id === id) || null;
}

/* ══════════════════════════════════════════════════════════════════════════
   ★★★ **[🌱 심기] 팝업** — 「이 그릇에 심을 수 있는 것」 (2026-08-17 박사님 확정)
   --------------------------------------------------------------------------
   박사님 원문: *"**씨앗심기 누르면 심을 수 있는 인벤 템 리스트가 팝업으로 나와서 고르도록**
   하자."*

   ★ 이 두 함수가 이 창의 뼈대다. 화면은 **그릇 하나만** 알면 되고, 「이 그릇이 씨앗용인가
     삽수용인가」를 영영 안 묻는다 — 그 물음이 박사님이 물리신 그것이다.
       `plantableInto(S, containerId)`  → 목록 (회색 줄까지 **다 낸다**)
       `plantInto(S, io, containerId, pick)` → 고른 것을 심는다

   ══ 왜 여기(state.js)인가 ═════════════════════════════════════════════════
   심을 수 있는 것이 **둘**인데 주인이 다르다 — 씨앗은 여기(`plantMonsteraSeed`),
   삽수는 `propagation`(`putCuttingIn`). 둘을 아는 자리는 여기뿐이다. 이 파일의 손버릇이
   원래 그것이다(`sowCrop` 머리말 — *"규칙은 first_play 가, 가방은 shop 이 갖고, 둘을 여기서 묶는다"*).
   ⚠ 화살표는 한 방향이다: state → propagation. 그쪽은 여기를 안 부른다(순환이 안 생긴다).

   ══ 못 넣는 것을 **목록에서 빼지 않는다** ═════════════════════════════════
   회색으로 두고 `why` 를 적는다. 이 저장소의 지병이 조용한 실패다 —
   「왜 안 되나」를 화면이 말할 수 있어야 한다.
   ⚠ 다만 **갈래 자체가 안 들어가는 것은 아예 안 낸다**(유리 수경병 × 씨앗).
     그건 「이 개체가 안 된다」가 아니라 **그 그릇이 받는 것이 아니다**라, 목록에 두면
     플레이어가 될 수도 있는 줄로 읽는다. 그 금은 `CONTAINERS[*].accepts` 가 긋는다.
════════════════════════════════════════════════════════════════════════════ */

/* 이 그릇에 심을 수 있는 것 — 가방의 씨앗과 삽수를 **한 목록**으로 낸다.
   줄 = { kind:'seed'|'cutting', id, ko, sub, can, why, count }
     kind   'seed' 면 `id` 는 상점 품목(`monstera_seed`) · 'cutting' 이면 삽수 id
     ko     화면에 찍을 이름       sub  부제(잎 수·무늬·등급 같은 것. 없으면 null)
     can    넣을 수 있나          why  못 넣으면 까닭(사람이 읽는 말). 넣을 수 있으면 null
     count  씨앗 몇 립(삽수는 늘 1)
   ⚠ 사유를 여기서 새로 짓지 않는다 — `propagation.methodLeafBlock` 이 낸 말을 그대로 쓴다.
   반환 { containerId, container, containerKo, accepts, rows } */
export function plantableInto(S, containerId) {
  const ct = containerRowOf(S, containerId);
  if (!ct) throw new Error(`[심기] 모르는 그릇입니다: ${containerId} — ` +
    `방에 놓인 빈 그릇이라야 합니다`);
  const kind = containerKindOf(ct);
  const cont = CONTAINERS[kind];
  if (!cont) throw new Error(`[심기] 그릇 ${ct.id} 의 갈래가 이상합니다: ${kind}`);
  const rows = [];

  /* ① 씨앗 — 그 그릇이 씨앗을 받을 때만 낸다(§accepts).
     ⚠ 가방에 없어도 **줄은 낸다.** 「씨앗이 없습니다」를 회색 줄이 말해 주는 편이,
       줄이 아예 없어서 「왜 못 심나」를 모르는 것보다 낫다(상점 [주문]이 쓰는 그 판단). */
  if (cont.accepts.includes('seed')) {
    const n = stockOf(S, SEED_ITEM_ID) || 0;
    rows.push({
      kind: 'seed', id: SEED_ITEM_ID, count: n,
      ko: '몬스테라 씨앗', sub: n > 0 ? `${n}립` : null,
      can: n > 0,
      why: n > 0 ? null : '가방에 몬스테라 씨앗이 없습니다 — 상점에서 주문해 주세요'
    });
  }

  /* ② 삽수 — **가방에 있는 것만**(이미 어딘가 들어앉은 것은 심을 대상이 아니다) */
  if (cont.accepts.includes('cutting')) {
    for (const c of (S.cuttings || [])) {
      if (!c || c.status !== 'bag' || c.method) continue;
      const now = cuttingStatsNow(c);
      /* ⚠ 사유는 `methodLeafBlock` 한 곳에서 온다 — 물꽂이는 잎 1장까지다 */
      const block = methodLeafBlock(cont.method, now.leaves);
      const varie = now.variegatedLeaves
        ? ` · 무늬 ${now.variegatedLeaves}장` : '';
      rows.push({
        kind: 'cutting', id: c.id, count: 1,
        ko: `삽수 ${c.id}`, sub: `잎 ${now.leaves}장${varie}`,
        can: !block, why: block || null
      });
    }
  }
  return { containerId: ct.id, container: kind, containerKo: cont.ko,
           accepts: [...cont.accepts], rows };
}

/* 고른 것을 그 그릇에 심는다. **씨앗이든 삽수든 같은 문**이다.
     io    생장 창 — **씨앗일 때만 쓴다**(형태를 세워야 한다). 삽수면 안 본다
     pick  { kind:'seed'|'cutting', id } — `plantableInto` 가 낸 줄을 그대로 넘기면 된다
   ⚠ 던지는 사유는 전부 **플레이어 입력**이다(`tutorialInput`) — 고장이 아니다.
     ⚠ 다만 씨앗 쪽에서 「생장 창이 없다·못 그렸다」는 진짜 고장이라 그대로 올려 보낸다.
   반환 { kind, containerId, potId? , cuttingId? } */
export function plantInto(S, io, containerId, pick, opt = {}) {
  const ct = containerRowOf(S, containerId);
  if (!ct) throw new Error(`[심기] 모르는 그릇입니다: ${containerId}`);
  const kind = containerKindOf(ct);
  const cont = CONTAINERS[kind] || {};
  const what = typeof pick === 'string' ? { kind: 'cutting', id: pick } : (pick || {});
  if (!what.kind || !what.id)
    throw new Error('[심기] 무엇을 심을지 안 골랐습니다 — plantableInto 의 줄을 넘겨 주세요');
  if (!(cont.accepts || []).includes(what.kind)) {
    const e = new Error(`[심기] ${cont.ko || kind} 에는 ` +
      `${what.kind === 'seed' ? '씨앗' : '삽수'}를 못 심습니다`);
    e.tutorialInput = true; throw e;
  }

  if (what.kind === 'cutting') {
    /* 삽수 — 그릇을 삽수가 지고 간다. `putCuttingIn` 이 목록에서 그 줄을 뺀다 */
    const c = putCuttingIn(S, what.id, ct.id, { log: m => pushLog(S, m) });
    return { kind: 'cutting', containerId: ct.id, cuttingId: c.id };
  }

  /* 씨앗 — **놓인 그 자리·그 그릇**에 심는다. 자리를 다시 고르지 않는다
     (다시 고르면 「놓은 데가 아닌 데」에 나서 손이 두 번 헛돈다 — game.html §sowEmptyPot).
     ⚠ 심은 **뒤에** 목록에서 뺀다. 먼저 빼면 심기가 던졌을 때 그릇이 사라진다. */
  /* ⚠ `usePot:false` — **그릇은 놓을 때 이미 나갔다**(§usePot · 2026-08-17 박사님 제보로
     다른 창이 잡은 그 사고다). 안 주면 화분 하나짜리 판은 놓고 나면 영영 못 심는다. */
  const pot = plantMonsteraSeed(S, io, {
    ...opt, at: ct.at, potItemId: ct.itemId, id: ct.id, usePot: false
  });
  removeEmptyPot(S, ct.id);
  return { kind: 'seed', containerId: ct.id, potId: pot.id };
}

export function plantMonsteraSeed(S, io, opt = {}) {
  const log = typeof opt.log === 'function' ? opt.log : (m => pushLog(S, m));
  const g = io && io.growth;
  if (!g || typeof g.setGrowth !== 'function')
    throw new Error('[심기] 생장 창이 준비되지 않았습니다 — 형태를 세울 수 없어 심지 않습니다');
  /* ★ 그루를 못 고르는 생장 창이면 **여기서 막는다.** 심고 나서 알면 이미 늦다 —
     그 판은 화분 둘에 그루 하나가 되어 매일 던진다. */
  if (typeof g.multi !== 'function' || !g.multi())
    throw new Error('[심기] 이 생장 창은 그루를 하나만 굴립니다 — 두 번째 그루를 심을 수 없습니다 ' +
                    '(plant_grow 에 selectPlant/addPlant 가 있는지 확인해 주세요)');

  const potItemId = opt.potItemId || SEED_POT_ITEM_ID;
  /* ① 체력 — **아무것도 바꾸기 전에** 묻는다. 심기는 `sow` 와 같은 손이다(새 비용을 안 만든다). */
  {
    const st = canActStamina(S, 'sow');
    if (!st.ok) { const e = new Error('[심기] ' + st.reason); e.tutorialInput = true; throw e; }
  }
  /* ★★★ 2026-08-17 — **이미 놓인 화분에 심을 때는 그릇을 또 안 쓴다** (박사님 실측 제보:
       *"화분 배치는 되는데 몬스테라 씨앗을 못 심네."*)
     ══════════════════════════════════════════════════════════════════
     ⚠⚠ 놓기·심기가 두 걸음이 되면서(`placeEmptyPot` → 여기) **그릇은 놓을 때 이미 나갔다.**
       그런데 이 줄이 그릇을 **한 번 더** 요구해서, 화분이 하나뿐인 판은 놓고 나면
       **영영 못 심었다.** 재고가 둘이면 모르고 지나가고 하나면 막히는, 조용한 사고다.
     ⇒ `opt.usePot === false` 면 **씨앗만** 묻는다. 놓인 화분에 심는 길(`sowEmptyPot`)이 그것이다.
     ⚠ 한 걸음으로 심는 옛 길(자리부터 새로 잡는 길)은 **그대로 둘을 다 쓴다** — 그 길에서는
       그릇이 아직 안 나갔다. 기본값을 바꾸지 않는 까닭이 그것이다. */
  const usePot = opt.usePot !== false;
  assertStockAll(S, usePot
    ? [{ itemId: SEED_ITEM_ID, qty: 1 }, { itemId: potItemId, qty: 1 }]
    : [{ itemId: SEED_ITEM_ID, qty: 1 }]);

  /* ① 자리 — 줬으면 여기서 재 본다(던질 수 있다). 아직 화분에 안 쓴다. */
  const potId = opt.id || nextPotId(S);
  const spot = opt.at ? resolvePlacement(potId, opt.at, opt) : null;

  /* ① 형태 — 생장 창에 그루를 만들고 0일로 세운다. 못 그리면 여기서 끝난다. */
  const growthId = `g:${potId}`;
  const growthSeed = Number.isInteger(opt.seed) ? (opt.seed >>> 0) : newGrowthSeed(S, potId);
  g.addPlant({ id: growthId, seed: growthSeed, day: SEED_START_GROWTH_DAYS });
  let res = null;
  try {
    g.select(growthId);
    res = g.setGrowth(SEED_START_GROWTH_DAYS);
  } catch (e) {
    try { g.removePlant(growthId); } catch { /* 치우다 또 터지면 그건 생장 창 몫이다 */ }
    throw e;
  }
  if (res && res.drawn === false) {
    try { g.removePlant(growthId); } catch { }
    const err = new Error(`[심기] 새 그루를 화면에 그리지 못했습니다` +
                          `${res.drawError ? ` — ${res.drawError}` : ''}. 씨앗은 그대로 있습니다`);
    err.drawError = res.drawError ?? null;
    err.recoverable = true;
    throw err;
  }

  /* ② 재고를 뺀다 — 여기부터는 되돌릴 일이 없다 */
  useStock(S, SEED_ITEM_ID, 1);
  if (usePot) useStock(S, potItemId, 1);   /* ★ 놓인 화분이면 그릇은 이미 나갔다(위 §usePot) */

  /* ③ 화분을 남긴다 */
  const pot = {
    id: potId,
    slotId: spot ? spot.slotId : null,
    at: spot ? spot.at : null,
    plantId: ARRIVAL.plantId,
    /* ★★★ 2026-08-17 — **고른 화분의 모양을 그대로 쓴다** (박사님: *"배치해도 처음
       화분하고 똑같에"*). 여기가 늘 `ARRIVAL.potAsset` 하나였다 — 무엇을 골라 심어도
       도착 그루가 신고 온 그 화분이 됐다.
       ⚠ 넘어온 것이 없으면 예전 그대로다(옛 세이브·옛 호출부가 안 깨진다). */
    potAsset: (opt.potAsset || (() => {
      const k = Object.values(POT_KINDS).find(x => x && x.itemId === potItemId);
      return (k && k.asset) || null;
    })() || ARRIVAL.potAsset),
    variegated: false,
    daysPlanted: 0,
    fedDays: 0,
    arrivedOnDay: S.day,
    /* 심는 날은 물을 준 날이다 — 심을 때 물을 붓는 것이 현실이고, 그래야
       "방금 심었는데 오늘은 마른 날"이 안 생긴다(setCropAt 과 같은 판단). */
    wateredOnDay: S.day,
    arrivalGrowthDays: SEED_START_GROWTH_DAYS,
    growthId, growthSeed,
    dliHist: [],
    /* ★ 씨앗에서 났다는 표시. 계통(gen)은 **0 이다** — 삽수가 아니라 실생이다. */
    fromSeed: true, gen: 0
  };
  S.pots.push(pot);
  syncPotLead(S);

  /* ④ 성공한 뒤에 깎는다 */
  spendStamina(S, 'sow');
  log(`🌱 몬스테라 씨앗을 심었습니다 — ${potId} (0일부터 시작합니다. 선물로 온 그루보다 느립니다)`);
  return pot;
}

/* 다음 화분 이름. `pot_01`(선물) 다음부터 빈 번호를 찾는다 — 팔고 다시 심어도 안 겹친다. */
function nextPotId(S) {
  /* ⚠ 2026-08-16 — **빈 화분도 같이 센다.** 안 세면 빈 화분과 심은 화분이 같은 이름을 갖고,
     그 순간 자리·세이브·방뷰가 서로 다른 것을 가리킨다. */
  const used = new Set([...(S.pots || []), ...(S.emptyPots || [])].map(p => p && p.id));
  for (let i = 2; i < 1000; i++) {
    const id = `pot_${String(i).padStart(2, '0')}`;
    if (!used.has(id)) return id;
  }
  throw new Error('[심기] 화분 이름이 바닥났습니다');
}
/* 새 그루의 씨앗. **판마다 다르고 그 판 안에서는 다시 나온다** — `S.sim.seed` 와
   화분 이름에서 만든다. 이 값은 화분에 적히고 세이브에 실린다(save §growthSeed).
   ⚠ `Math.random()` 을 쓰지 않는다. 그러면 저장·복원 사이에 얼굴이 바뀐다. */
function newGrowthSeed(S, potId) {
  let h = (Number.isInteger(S.sim && S.sim.seed) ? S.sim.seed : 0) ^ 0x9e3779b9;
  const s = `${potId}|${S.day}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}

export function modeOf(S) { return SIM_MODES[S.sim.mode] || SIM_MODES.real; }

/* ============================================================
   ★ 화분 자리 — 좌표가 정본, slotId 는 계약 열쇠 (2026-08-03)
   ------------------------------------------------------------
   지켜야 할 불변식 하나:
     ① 추천 자리 위 화분  : pot.slotId = 그 슬롯의 안정 id  ·  pot.at = 그 슬롯 좌표
     ② 자유 좌표 화분     : pot.slotId = `free:{pot.id}`     ·  pot.at = 그 좌표
   이게 깨지면 하루치 계약에 같은 화분이 두 번(빈 슬롯 + 자유 좌표) 실리거나,
   loop.js 가 `p.slotId` 로 찾은 값이 **다른 자리의 밝기**가 된다. 조용히 틀리는 유형이라
   light_adapter.slotsFor 가 깨진 조합을 보면 던진다.
============================================================ */

/* 옛 세이브 마이그레이션 — `slotId` 만 있는 화분에 그 슬롯의 좌표를 채운다.
   좌표가 이미 있으면 손대지 않는다(좌표가 이긴다).
   ⚠ 슬롯에 좌표가 없으면(정적 프로파일의 얇은 슬롯 등) **지어내지 않고 건너뛴다** —
     그 화분은 예전처럼 slotId 로 돈다. 0,0,0 으로 메꾸면 방 한가운데로 순간이동한다.

   ★ 콩나물 시루도 같이 챙긴다 (2026-08-03) — 자리를 차지하는 물건은 화분만이 아니다.
     시루만 좌표 없이 남으면 옛 세이브에서 시루가 계약에는 실리는데 방뷰에는 못 서거나,
     자유 배치 UI 가 "지금 어디 있는지"를 물었을 때 답이 없다. */
export function migratePots(S, slots) {
  const filled = [], skipped = [], resnapped = [];
  /* ★★★ 2026-08-17 — **자리가 움직이면 그 자리에 앉은 것도 따라와야 한다.**
     ══════════════════════════════════════════════════════════════════
     박사님 폰에서 옛 판(Day 13)이 안 열렸다:
       `[조도] crop_01_01 의 자리가 어긋납니다 — slotId=banjiha-desk:0 는 (0.82,0.74,-1.35)
        인데 at 은 (0.79,0.74,-1.41) 입니다`
     그날 `furniture_pastel.tierSlots` 의 여백을 고쳐 **추천 자리를 칸 한가운데로 옮겼다.**
     세이브에는 **옛 좌표**가 `at` 으로 굳어 있고 `slotId` 는 그대로라, 불변식
     「slotId 가 가리키는 자리 = at」이 깨져 `light_adapter.slotsFor` 가 던진다.
     ⇒ 게임이 통째로 멈춘다. 아래 `fill` 은 `at` 이 **없을 때만** 채우므로 이걸 못 잡았다.

     ★ 옳은 뜻은 하나뿐이다 — **그 화분은 그 자리에 있었다.** 자리가 움직였으면 화분도 옮긴다.
     ⚠ 자유 좌표(`free:*`)는 건드리지 않는다. 그건 「자리에 안 앉은 것」이라 뜻이 다르다.
     ⚠ 조용히 하지 않는다 — 옮겼으면 기록에 남긴다(`resnapped`). 밝기가 조금 달라질 수 있고,
       말 없이 바뀌면 다음 사람이 「왜 값이 다르지」를 코드에서 찾게 된다. */
  const resnap = (o, id) => {
    if (!o || !o.at || !o.slotId || isFreeSlotId(o.slotId)) return;
    const s = (slots || []).find(x => x && x.slotId === o.slotId);
    if (!s || ![s.x, s.y, s.z].every(v => typeof v === 'number' && Number.isFinite(v))) return;
    if (samePoint(s, o.at)) return;
    const was = { x: o.at.x, y: o.at.y, z: o.at.z };
    o.at = atFromSlot(s);
    resnapped.push({ id, slotId: o.slotId, was, now: o.at });
  };
  const fill = (o, id) => {
    if (!o) return;
    if (o.at) { resnap(o, id); return; }
    if (!o.slotId) { skipped.push({ id, why: 'slotId 가 없습니다' }); return; }
    if (isFreeSlotId(o.slotId)) { skipped.push({ id, why: '자유 좌표인데 at 이 없습니다' }); return; }
    const s = (slots || []).find(x => x && x.slotId === o.slotId);
    if (!s) { skipped.push({ id, why: `슬롯 ${o.slotId} 이(가) 이 방에 없습니다` }); return; }
    if (![s.x, s.y, s.z].every(v => typeof v === 'number' && Number.isFinite(v))) {
      skipped.push({ id, why: `슬롯 ${o.slotId} 에 좌표가 없습니다` }); return;
    }
    o.at = atFromSlot(s);
    filled.push({ id, slotId: o.slotId, at: o.at });
  };

  for (const p of S.pots || []) fill(p, p.id);

  /* 아직 자리를 안 정한 시루(slotId 조차 없음)는 **마이그레이션 대상이 아니다** —
     빠뜨린 게 아니라 아직 안 놓은 것이라 건너뛴 사유 목록에도 넣지 않는다. */
  const fp = S.firstPlay;
  /* ★ 2026-08-05 — 작물 자리가 **종류마다 하나**가 됐다(first_play §작물 자리). 전부 채운다.
     ★★ 2026-08-09 — 이제 자리는 **시루마다**다(first_play §자리는 시루마다 따로다).
       그래서 시루 하나하나를 채운다. 자리 사본(site)은 `syncCropLead` 가 다시 세운다 —
       사본을 먼저 채우면 정본과 사본에 서로 다른 좌표가 남는다. */
  if (fp && fp.enabled)
    for (const site of cropSites(fp)) {
      ensureCropPots(site);
      /* ★ 자리에만 적혀 있고 시루는 모르는 옛 모양은 여기서 시루로 내려 준다.
         `ensureCropPots` 는 pots 가 이미 있으면 손을 안 대므로 그 틈을 이것이 막는다. */
      adoptCropSpotToPots(site);
      for (const p of (site.pots || [])) if (p.slotId) fill(p, p.id);
      syncCropLead(site);
    }
  /* 몬스테라 쪽은 **사본**이라 값만 맞춰 둔다(정본은 위 S.pots 가 이미 채웠다) */
  if (fp && fp.enabled && fp.monstera && fp.monstera.arrived && fp.monstera.slotId)
    fill(fp.monstera, (pot0(S) && pot0(S).id) || 'monstera');

  return { filled, skipped, resnapped };
}

/* ★ 지금 방 안에서 **자리를 차지하고 있는 것 전부** (2026-08-03).
   조도 계약(daily_light/1)에 실려야 하는 목록이고, 화분만이 아니다 — 첫 플레이의 콩나물 시루도
   자유 좌표로 놓이면 계약에 실려야 `cropDliFromReport` 가 그 자리의 DLI 를 찾는다.

   ★ 왜 여기(state)에 두는가: "방 안에 무엇이 있나"는 상태의 질문이다. 조도 창(light_adapter)이
     `S.firstPlay` 를 뒤지기 시작하면 물건이 하나 늘 때마다 조도 쪽을 고쳐야 한다.
   ★ 시루는 **화분 모양 그대로** 낸다. 두 번째 배치 개념을 만들지 않는다 —
     slotsFor 는 `{id, slotId, at, plantId, variegated}` 만 보므로 그대로 돈다.
   ⚠ `plantId: null` 이다. 콩나물은 광 임계값 표(light_thresholds)에 없는 작물이라
     식물 id 를 지어내면 그 자리 밴드 판정이 몬스테라 기준으로 나온다. 시루는 자리일 뿐이다.

   ★ 몬스테라는 여기 없다 — S.pots[0] 이 이미 그 개체다. fp.monstera 는 사본이라
     같이 실으면 **같은 화분이 계약에 두 번** 실린다(K 검사와 같은 사상). */
export function placedItems(S) {
  const out = [...(S.pots || [])];
  /* ★ 2026-08-05 — 작물 자리가 여럿이다. **놓인 자리는 전부** 계약에 실린다 —
     안 실으면 그 자리의 DLI 를 못 찾아 `cropDliFromReport` 가 던진다(무순이 그 경우다). */
  /* ★★ 2026-08-09 — **시루 하나가 한 줄**이다(first_play §자리는 시루마다 따로다).
     예전에는 자리마다 한 줄이라 시루 열두 개가 계약에 한 줄로 실렸다. 이제 시루마다
     자리가 다르니 줄도 시루마다다 — 그래야 그 자리의 DLI 를 시루마다 찾을 수 있다.
     ⚠ 열쇠는 **시루 id**(`crop_01_02`)다. 자리 id 하나를 나눠 쓰면 자유 좌표 열쇠가
       `free:crop_01` 로 겹쳐 뒤엣것이 앞엣것을 덮는다(light_adapter.slotsFor 가 Map 이다).
     ⚠ 아직 안 놓은(가방의) 시루는 안 싣는다 — 방에 없는 것은 자리를 안 차지한다. */
  if (S.firstPlay && S.firstPlay.enabled)
    for (const b of cropSites(S.firstPlay)) {
      if (!b) continue;
      for (const p of (b.pots || []))
        if (p && (p.slotId || p.at))
          out.push({ id: p.id, slotId: p.slotId, at: p.at || null,
                     plantId: null, variegated: false, crop: true,
                     crop_kind: b.kind || 'beansprout' });
    }
  /* ★ 삽수도 자리를 차지한다 (2026-08-03) — 시루와 **같은 모양**으로 낸다.
     ⚠ `plantId: null` 인 이유는 시루와 같다: 뿌리내리는 동안 삽수는 빛과 무관하므로
       (docs/propagation.md §3) 그 자리에 몬스테라 밴드 판정을 걸 근거가 없다.
       판정이 아니라 **자리를 차지한다는 사실**만 계약에 실어야 유령이 안 생긴다.
     ★ 여기서 propagation.js 를 import 하지 않는다 — 이 함수가 보는 것은
       `{id, slotId, at}` 세 칸뿐이라 규칙 모듈을 끌어올 이유가 없고, 순환 import 도 안 생긴다. */
  for (const c of S.cuttings || [])
    if (c && (c.slotId || c.at))
      out.push({ id: c.id, slotId: c.slotId, at: c.at || null,
                 plantId: null, variegated: !!c.variegated, cutting: true });
  return out;
}

/* 화분을 좌표에 놓는다. **유일한 쓰기 창구**다 — 불변식은 여기서만 세운다.
     at    { x, y, z, rotY?, onUid?, occIdx? }
     opt   { size: 방 치수, slots: 추천 자리 배열, snapDist: 이 거리 안이면 슬롯에 붙인다 }
   추천 자리에 붙으면 그 자리의 안정 slotId 를 쓴다(세이브 하위호환·헤드리스 시뮬이 그걸 본다).
   벗어나면 `free:{pot.id}` 가 된다. */
export function setPotAt(S, potOrId, at, opt = {}) {
  const p = typeof potOrId === 'string' ? (S.pots || []).find(x => x.id === potOrId) : potOrId;
  if (!p) throw new Error(`[배치] 모르는 화분: ${potOrId}`);
  /* ★ 한 번이라도 놓였다는 표시 — 그래야 「가방에 있다」와 「자리를 잃었다」가 갈린다(§rehomePot) */
  p.placedOnce = true;
  /* 불변식 자체는 place.resolvePlacement 한 곳에만 있다 — 콩나물(setCropAt)도 같은 함수를 탄다.
     여기서 다시 세우면 둘 중 하나만 고쳐지고 나머지가 조용히 어긋난다. */
  const r = resolvePlacement(p.id, at, opt);
  p.at = r.at;
  p.slotId = r.slotId;
  return { potId: p.id, slotId: r.slotId, at: r.at, snappedTo: r.snappedTo, dist: r.dist };
}

/* ★ 콩나물 시루를 좌표에 놓는다 — `setPotAt` 과 **같은 문체·같은 불변식**이다 (2026-08-03).
   시루는 S.pots 가 아니라 S.firstPlay.beansprout 에 산다(첫 플레이 닫힌 상태). 그래서 쓰기는
   first_play.placeBeansprout 을 거친다 — 수확 뒤 잠금·단계 전환 같은 첫 플레이 규칙이 거기 있고,
   그걸 여기서 다시 쓰면 규칙이 둘로 갈린다.
     at   { x, y, z, rotY?, onUid?, occIdx? }
     opt  { size, slots, snapDist } — setPotAt 과 같다
   반환 { cropId, slotId, at, snappedTo, dist, moved, keptDays } */
export function setCropAt(S, at, opt = {}) {
  const fp = S && S.firstPlay;
  if (!fp || !fp.beansprout) throw new Error('[배치] 첫 플레이 상태가 없습니다 — 놓을 시루가 없습니다');
  /* ★ 2026-08-05 — `opt.kind` 로 어느 작물 자리인지 고른다. 없으면 콩나물(옛 호출부).
     ⚠ 자리는 종류마다 따로다 — 무순을 놓아도 콩나물 자리는 안 움직인다(first_play §작물 자리). */
  const kindId = opt.kind || 'beansprout';
  /* ★ 놓는 날은 물을 준 날이다 (2026-08-04) — 심을 때 물을 붓는 것이 현실이고,
     그래야 "방금 놓았는데 오늘은 마른 날"이 안 생긴다. 날짜는 S 만 안다(§물주기). */
  /* ★★ 2026-08-09 — `opt.potId` 를 주면 **그 시루 하나만** 옮긴다. 안 주면 예전 그대로
     자리의 시루 전부가 함께 간다(first_play.placeCrop 이 그 갈림길을 갖는다). */
  const r = placeCrop(fp, kindId, at, { ...opt, day: S.day });
  const site = cropSiteOf(fp, kindId);
  const one = opt.potId ? cropPotOf(site, opt.potId) : null;
  return { cropId: CROP_SITE_IDS[kindId], kind: kindId, potId: opt.potId || null,
           slotId: one ? one.slotId : site.slotId, at: one ? one.at : site.at,
           snappedTo: r.snappedTo, dist: r.dist, moved: r.moved, keptDays: r.keptDays };
}

/* ══════════════════════════════════════════════════════════════════════════
   ★★★ **빈 시루 하나를 방에 세운다** (2026-08-09 · 박사님 지시)
   ------------------------------------------------------------
   원문: *"콩나물시루 아이템만 있어서 그걸 드래그 하면 하나씩 따로따로 설치되게 하고싶어."*

   예전에는 끌어다 놓으면 `resowCrop(S, {sirus: 지금+가방전부, at})` 이 돌아
   **가방에 있던 시루가 몽땅** 그 한 자리에 무리로 섰다. 이 함수는 **한 개만** 세운다.

   ★ 어느 시루를 세우나 — 순서가 있다. 이 순서가 곧 「가방에는 빈 용기만」의 구현이다.
     ① 이미 만들어져 있는데 아직 안 놓은 시루(처음 받은 하나가 그것이다) → 재고를 안 쓴다
     ② 없으면 상점 재고에서 **용기 1 + 씨앗 1** 을 빼고 새 시루를 만든다

   ⚠⚠ **빼기 전에 전부 묻는다.** `assertStockAll` 이 그 창구다(2026-08-09 신설).
     순서를 어기면 용기만 빠지고 씨앗에서 던져 **산 시루가 그냥 사라진다.**
     `tools/test_resow_atomic.mjs` 가 그 자리를 지킨다 — 금액은 그 파일이 정본이다
     (여기 숫자를 적어 두면 값이 바뀔 때 조용히 거짓말이 된다. 실제로 한 번 그랬다).
   ★ 씨앗값은 여기서 안 낸다 — 재고에서 뺄 뿐이다(살림은 tutorial.js 소유라는 규약 그대로).
     opt.at / 자리 이름은 `at` 인자로 · opt 는 `setCropAt` 과 같다(size · slots · snapDist)
     opt.sow  **false 면 씨앗을 안 쓴다** — 빈 용기만 세운다 (2026-08-11 · 아래 ★★)
   반환 { potId, kind, slotId, at, fromStock, seedsUsed, sirus, moved, keptDays } */
/* ★★★ 2026-08-11 — `opt.sow:false` 가 왜 생겼나 (박사님 "재배판 배치 후 무순 심기").
   ------------------------------------------------------------
   콩나물 시루는 **놓기 = 심기**였다 — 시루는 콩을 앉히는 용기라 놓는 순간이 곧 심는
   순간이라고 보았다. 무순 재배판은 **씨앗을 뿌리는 판**이라 결이 달라서, 놓을 때는 용기
   하나만 나가고 씨앗은 `state.sowCrop`(=[🌱 심기])이 뺀다.
   ⚠⚠ **2026-08-16 — 콩나물도 이 길로 왔다.** 박사님: *"콩나물 시루(차광용기)가 콩씨앗이
     없어도 설치되게 해줘. 그리고 용기에 씨 심기 해서 심도록 해 처음에 순서가."*
     ⇒ `game.html §commitPlace` 와 `startPhonePlace` 가 둘 다 `sow:false` 로 부른다.
       이 함수는 **한 글자도 안 고쳤다** — 갈림길이 이미 여기 있었다.
     ⚠ `opt.sow` 를 안 주면 예전 그대로 씨앗까지 뺀다. 그 길은 검사·재현이 아직 쓴다
       (`test_siru_each` 가 「재고에서 꺼내면 씨앗도 나간다」를 그 기본값으로 잰다).
   ⚠ ①묻고 ②만들고 ③놓고 ④뺀다 **순서는 그대로다**(`tools/test_resow_atomic.mjs` 가 지킨다).
     달라지는 것은 ①에서 묻는 목록과 ④에서 빼는 목록뿐이고, 둘은 **같은 목록**이다. */
export function placeSiru(S, at, opt = {}) {
  const fp = S && S.firstPlay;
  if (!fp || !fp.beansprout) throw new Error('[배치] 첫 플레이 상태가 없습니다 — 놓을 시루가 없습니다');
  const kindId = opt.kind || 'beansprout';
  const k = cropKindOf(kindId);
  const site = cropSiteOf(fp, kindId);
  if (!site) throw new Error(`[배치] ${k.ko} 상태가 없습니다`);
  ensureCropPots(site);
  const sow = opt.sow !== false;              // 안 주면 예전 그대로 놓으면서 심는다

  const spare = idleCropPots(site);
  let pot = spare[0] || null, fromStock = false, seedsUsed = 0;
  if (!pot) {
    /* ① **묻기만 한다.** 여기서는 한 톨도 안 뺀다 */
    const need = [{ itemId: k.containerItemId, qty: 1 }];
    if (sow) need.push({ itemId: k.seedItemId, qty: 1 });
    assertStockAll(S, need);
    fromStock = true; seedsUsed = sow ? 1 : 0;
    /* ② 시루 개체를 만든다. 아직 가방에 있는 빈 용기다 — 재고는 그대로다 */
    pot = addCropPot(fp, kindId, { day: S.day, sown: sow });
  }
  /* ③ 놓는다. **여기가 던질 수 있는 유일한 자리**이고, 아직 재고를 안 뺐으므로
     던져도 잃는 것이 없다. 만들어 둔 빈 시루만 도로 걷는다.
     ⚠ 이 순서가 곧 `test_resow_atomic` 이 지키는 그 순서다 — 물건은 마지막에 뺀다. */
  try {
    placeCrop(fp, kindId, at, { ...opt, potId: pot.id, day: S.day });
  } catch (e) {
    if (fromStock) {
      site.pots = (site.pots || []).filter(p => p !== pot);
      syncCropLead(site);
    }
    throw e;
  }
  /* ④ 다 됐다. 이제 뺀다 — ①에서 물어 뒀으므로 여기서는 못 뺄 일이 없다 */
  if (fromStock) {
    useStock(S, k.containerItemId, 1);
    if (sow) useStock(S, k.seedItemId, 1);
  }
  /* ★★★ 2026-08-16 — **가방에 있던 빈 용기도 「안 심은 것」으로 세운다.**
     ------------------------------------------------------------
     `spare[0]`(이미 만들어져 있던 시루 — 첫 플레이가 들고 시작하는 그 하나가 그것이다)는
     `makeCropPot` 기본값대로 `sown:true` 로 만들어져 있다. 그 기본값은 **옛 세이브를 위한
     것**이고(§sown — 「없으면 심은 것」), 「가방에 있는 빈 용기」에는 맞지 않는다.
     ⇒ 놓는 쪽이 `sow:false` 라고 말했으면 **그 시루는 빈 시루다.** 안 고치면 첫 시루만
       놓자마자 심긴 것이 되어 [🌱 심기] 단추가 안 뜬다(실측으로 잡았다).
     ⚠ 안 놓였고·안 시작했고·안 거둔 용기에만 건다 — 방에서 자라던 것을 되돌리지 않는다.
     ⚠ ③(놓기)이 성공한 **뒤**다. 앞에 두면 놓기가 던진 판에서 가방의 시루가 조용히 바뀐다. */
  if (!sow && pot.startedOnDay == null && !pot.harvested) pot.sown = false;
  pushLog(S, !sow
    ? `🌱 빈 ${k.containerKo}를 하나 놓았습니다 (씨앗을 심어야 시작합니다)`
    : fromStock
      ? `🥣 ${k.containerKo}를 하나 놓았습니다 — 씨앗 1봉지 (물을 줘야 시작합니다)`
      : `🥣 ${k.containerKo}를 하나 놓았습니다 (물을 줘야 시작합니다)`);
  return { potId: pot.id, kind: kindId, slotId: pot.slotId, at: pot.at,
           sown: cropPotSown(pot),
           fromStock, seedsUsed, sirus: placedCropPots(site).length,
           spare: idleCropPots(site).length + (stockOf(S, k.containerItemId) || 0),
           events: [{ id: 'siru_placed', ko: `${k.containerKo}를 놓았습니다`,
                      kind: kindId, potId: pot.id }] };
}

/* ★ 시루 하나에만 물을 준다 — [물 주기] 버튼이 시루마다 붙는다(2026-08-09).
   규칙은 아래 `waterCrop` 이 전부 갖는다. 여기는 **어느 시루인가**만 얹는다. */
export function waterSiru(S, potId, opt = {}) {
  return waterCrop(S, { ...opt, potIds: [potId] });
}

/* ══════════════════════════════════════════════════════════════════════════
   ★★★ **놓인 용기에 씨앗을 뿌린다** (2026-08-11 · 박사님 지시)
   ------------------------------------------------------------
   원문: *"왜 가방에서 무순 심기를 해야 돼? 재배판 배치 후 무순 심기를 해야지?"*

   `placeSiru` 와 **같은 결**이다: 규칙은 first_play(`sowCropPot`)가, 가방은 shop 이 갖고,
   둘을 여기서 묶는다. 화면은 이 함수 하나만 부른다.
   ⚠ **①묻고 ②심고 ③뺀다.** 순서를 뒤집으면 씨앗만 나가고 안 심기는 판이 난다
     (`placeSiru` §①~④ 와 같은 이유다 — 이 저장소가 실제로 그 사고를 겪었다).
   ★ **체력을 안 쓴다.** 콩나물은 「놓기 = 심기」인데 그 길(`placeSiru`)이 체력을 안 쓴다.
     여기서 물리면 같은 결과를 내는 데 무순만 손이 하나 더 드는 셈이라 두 작물의 셈이
     갈린다. ⚠ 이건 **판단**입니다 — 물리게 하려면 `resowCrop` 처럼 `canActStamina(S,'sow')`
     한 줄이면 되고, 그때는 밸런스 창과 같이 정해야 합니다.
     opt.kind  종류를 알면 넘긴다. 안 넘기면 그 potId 를 가진 자리를 찾아 정한다
   반환 { potId, kind, seedsUsed, sown, events } */
export function sowCrop(S, potId, opt = {}) {
  const fp = S && S.firstPlay;
  if (!fp || !fp.beansprout) throw new Error('[심기] 첫 플레이 상태가 없습니다 — 심을 용기가 없습니다');
  /* 어느 종류의 용기인가 — 화면이 종류를 안 넘겨도 되게 여기서 찾는다.
     ⚠ 지어내지 않는다. 못 찾으면 던진다(모르는 id 로 심으면 엉뚱한 씨앗이 나간다). */
  let kindId = opt.kind || null;
  if (!kindId) {
    for (const site of cropSites(fp))
      if (cropPotOf(ensureCropPots(site), potId)) { kindId = site.kind || 'beansprout'; break; }
  }
  if (!kindId) throw new Error(`[심기] 모르는 용기입니다: ${potId}`);
  const k = cropKindOf(kindId);
  /* ① **묻기만 한다.** 여기서는 한 톨도 안 뺀다 */
  assertStockAll(S, [{ itemId: k.seedItemId, qty: 1 }]);
  /* ② 심는다. 여기가 던질 수 있는 자리이고, 아직 재고를 안 뺐으므로 던져도 잃는 것이 없다 */
  const r = sowCropPot(fp, kindId, potId, { day: S.day });
  /* ③ 다 됐다. 이제 뺀다 */
  useStock(S, k.seedItemId, 1);
  pushLog(S, `🌱 ${k.containerKo}에 ${k.ko} 씨앗을 심었습니다 — 씨앗 1봉지 ` +
             `(물을 줘야 ${k.harvestDays}일 회전이 시작됩니다)`);
  return { ...r, seedsUsed: 1,
           events: [{ id: 'crop_sown', ko: `${k.ko}을(를) 심었습니다`,
                      kind: kindId, potId }] };
}

/* ★ 시루를 놓는 것과 **회전을 시작하는 것은 다른 동작**이다 (2026-08-04 새 규칙).
   예전에는 여기서 놓는 날 물을 부었다. 이제는 안 붓는다 — 물이 회전 시작이라
   놓자마자 시작되면 플레이어가 시차를 만들 손이 사라진다(first_play.js §물주기). */

/* ★★ 물을 준다 = **회전을 시작한다** — 게임 화면의 [물 주기] 버튼이 부르는 유일한 함수
   ------------------------------------------------------------
   규칙은 first_play.js §물주기 가 갖는다. 여기 있는 이유는 `setCropAt`·`resowCrop` 과 같다 —
   **오늘이 며칠인지는 S 만 안다.** first_play 는 게임일을 모르므로(fp 만 받는다) 날짜를
   호출부가 넘겨야 하는데, 그걸 화면에 맡기면 창마다 다른 날을 넘길 수 있다. 여기서 한 번 묶는다.

   ★★ 2026-08-04 새 규칙 — **회전당 한 번**이다. 매일 주는 것이 아니다.
     한 번 누르면 **시루 하나**가 그날을 0일차로 잡고 시작한다. `{ all: true }` 면 전부.
     ⇒ 시루 셋을 하루씩 걸러 시작하면 거두는 날이 하루씩 어긋난다 — 그게 시차이고, 손이다.
   ★ 여러 번 눌러도 안전하다 — 시작할 시루가 없으면 `already:true` 로 조용히 지난다.
     던지지 않는 이유: 버튼을 두 번 누른 것은 고장이 아니고, 던지면 화면이 붉어진다.
   ★ 돈이 안 든다. 물값을 만들지 않았다 — 이 행위가 가르치는 것은 **언제 시작할지 정하는 것**이지
     살림이 아니다. 돈을 붙이면 "물을 안 주는 것이 절약"이 되어 규칙이 뒤집힌다.
     opt.all   대기 중인 시루를 전부 시작한다 (기본은 하나)
   반환 { watered, already, day, started, waiting, idleDays, events } */
export function waterCrop(S, opt = {}) {
  const fp = S && S.firstPlay;
  if (!fp || !fp.enabled || !fp.beansprout)
    throw new Error('[물주기] 첫 플레이 상태가 없습니다 — 물을 줄 시루가 없습니다');
  /* ★ 2026-08-05 — `opt.kind` 로 종류를 고른다(기본 콩나물). 자리도 종류마다 따로 본다 */
  const kindId = opt.kind || 'beansprout';
  const k = cropKindOf(kindId);
  const site = cropSiteOf(fp, kindId);
  if (!site) throw new Error(`[물주기] ${k.ko} 상태가 없습니다`);
  /* ★ 2026-08-10 — 자리 사본(`site.slotId`)이 아니라 **방에 선 시루**로 묻는다.
     사본은 대표 시루의 읽기용 복사본이라(first_play §makeCropSite) 비어도 시루는 서 있을 수 있다.
     그때 여기서 막으면 「방에 있는데 물을 못 주는」 판이 된다. */
  if (!placedCropPots(ensureCropPots(site)).length) {
    const e = new Error(`[물주기] ${k.containerKo}를 먼저 방 안에 놓아 주세요`);
    e.tutorialInput = true;                 // 안내지 고장이 아니다
    throw e;
  }
  /* ★ 체력 — 오늘 손이 남았나 (2026-08-05 · docs/stamina.md).
     ⚠ **아무것도 바꾸기 전에** 묻는다. 반쯤 준 물은 없다. */
  {
    const st = canActStamina(S, 'water');
    if (!st.ok) { const e = new Error('[물주기] ' + st.reason); e.tutorialInput = true; throw e; }
  }
  const r = waterBeansprout(fp, S.day, opt);
  /* 실제로 준 날만 깎는다 — 이미 준 시루에 또 눌러 봤자 아무 일도 안 나는데
     그것까지 물리면 "눌렀더니 오늘이 끝났다"가 된다. */
  if (r.watered) spendStamina(S, 'water');
  if (r.watered)
    pushLog(S, r.started > 1
      ? `💧 ${k.containerKo} ${r.started}개에 물을 주었습니다 — 오늘이 0일차입니다 ` +
        `(${site.harvestDays}일 뒤에 거둡니다)`
      : `💧 ${k.ko}에 물을 주었습니다 — 오늘이 0일차입니다 ` +
        `(${site.harvestDays}일 뒤에 거둡니다` +
        (r.waiting ? ` · 아직 안 준 ${k.containerKo} ${r.waiting}개` : '') + ')');
  return { ...r,
           events: r.watered
             ? [{ id: 'crop_watered', ko: `${k.ko} 회전을 시작했습니다`,
                  kind: kindId, started: r.started, waiting: r.waiting }]
             : [] };
}

/* 오늘 물을 줘야 하나 — 버튼을 켤지 흐리게 할지의 근거. 상태를 안 바꾼다. */
export function cropWaterStatus(S) {
  return beansproutWaterStatus(S && S.firstPlay, S ? S.day : null);
}

/* ══════════════════════════════════════════════════════════════════════════
   ★★ 몬스테라 물주기 (2026-08-07 박사님 확정 · docs/handoff/plan-to-core.md)
   ------------------------------------------------------------
   ★ 한 문장 — 물은 「오늘이 **하루로 세어지는가**」를 가르는 문이다.
     **얼마나** 자라나는 빛이 정하고, 물은 **곱하지 않고 직렬로** 걸린다.
     곱하면 "물을 반만 줬으니 반만 자란다"가 되어 처방이 흐려진다 — 화면이
     "물을 주세요"가 아니라 "물을 조금 더 주세요"라고 말하게 된다.
     그리고 이 게임의 다른 정지가 전부 문 모양이다(growthBlocked · headroomBlocked).

   ★★ 콩나물 물과 **뜻이 다르다. `waterCrop` 과 합치지 마라:**
     | | 콩나물 | 몬스테라 |
     | 물의 뜻 | **회전 시작**(startedOnDay) | **유지** |
     | 언제 | 회전당 한 번 | 주기마다 다시 |
     | 자리에 걸리나 | 안 걸린다 | **걸린다** — 밝을수록 빨리 마른다 |

   ★ 죽지 않는다. 마른 날은 달력만 가고 형태가 안 는다
     (loop.js §17 "band === 'critical' 로 죽이는 코드는 절대 넣지 않는다"와 같은 규약).

   ★★ 이게 왜 있나 — **밝은 자리가 공짜가 아니게 된다.**
     지금 밝은 자리는 순수 이득이라 「자리」의 교훈이 "제일 밝은 데 두면 된다" 한 줄로 끝난다.
     물이 들어오면 밝은 자리는 잘 크지만 **자주 챙겨야 한다.** 체력이 하루 10 인 판에서
     그건 진짜 고민이 된다 — 시루를 늘릴수록 몬스테라를 챙길 손이 준다.
   ══════════════════════════════════════════════════════════════════════════ */

/* 얼마나 만에 마르나 — **숫자를 새로 짓지 않는다.**
   밝기를 재는 자를 새로 만들면 색(rankSlots)·속도(growthSpeedOf)·물주기가 **세 벌**이 되고
   세 벌은 반드시 어긋난다. growth 가 이미 내는 **밴드**를 그대로 읽는다.
   ⚠ 밴드는 **7일평균(dli7)** 으로 잰다 — 하루 값으로 재면 흐린 날마다 주기가 들썩여
     "어제는 8일이라더니 오늘은 12일"이 된다. 흙이 마르는 속도는 그렇게 안 움직인다. */
export const WATER_INTERVAL_BY_BAND = Object.freeze({
  over: 7, best: 7,                       // 아주 밝다 — 빨리 마른다
  good: 8,                                // 밝다
  slow: 10,                               // 어둑하다
  stagnant: 12, poor: 12, critical: 12    // 어둡다 — 오래 간다
});
/* 밴드를 못 읽을 때(헤드리스·옛 판). **실제 7~10일의 한가운데**라 지어낸 값이 아니다. */
export const WATER_INTERVAL_DEFAULT = 8;
/* 계절 — 실제로 밝기만큼 크다. 겨울 실내 몬스테라는 2~3주에 한 번이다. */
export const WATER_SEASON_ADJ = Object.freeze({ spring: 0, summer: -1, autumn: 0, winter: 3 });
/* 아무리 밝고 더워도 이보다 자주 마르지는 않는다 — 화분 흙이 그렇게는 안 마른다. */
export const WATER_INTERVAL_MIN = 5;
/* ★ 마르기 **며칠 전부터 물이 드나.** 0 으로 두면 마른 날(=하루를 잃은 날)에만 줄 수 있어
   주기마다 반드시 하루씩 잃는다. 2 면 「마를 때가 됐다」 사흘 창이 생겨 안 잃고 넘어갈 수 있다. */
export const WATER_GRACE_DAYS = 2;

export function waterIntervalOf(band, season) {
  const base = WATER_INTERVAL_BY_BAND[band] ?? WATER_INTERVAL_DEFAULT;
  return Math.max(WATER_INTERVAL_MIN, base + (WATER_SEASON_ADJ[season] ?? 0));
}

/* 지금 목마른가 — 버튼·안내·loop 판정이 **전부 이 하나를 읽는다.**
   ★ **상태를 안 바꾼다.** `wateredOnDay` 가 없는 화분도 여기서 고치지 않는다 —
     그건 세이브 복원(save.js)과 도착(givePlant)이 채울 일이고, 읽기 경로에서 상태를
     만들면 "화면을 열었더니 물을 준 것이 됐다"가 난다(ensureCropPots §읽기 전용과 같은 규칙).
   ⚠ 화분이 없으면 **null 이다. 던지지 않는다** — 안내지 고장이 아니다.
     opt.band    growth 밴드(7일평균 기준). 없으면 기본 주기
     opt.season  'spring'|'summer'|'autumn'|'winter'
   반환 { dryDays, interval, leftDays, dry, canWater, wateredOnDay } */
export function potWaterStatus(S, opt = {}) {
  /* ★ `opt.pot` — **어느 그루냐** (2026-08-15 다개체). 안 주면 예전처럼 첫 화분이다.
     루프가 화분마다 따로 재야 하는데, 자리마다 밝기가 달라 주기(밴드)도 그루마다 다르다. */
  const p = opt.pot || pot0(S);
  if (!p || !S) return null;
  /* 없는 칸은 **오늘 준 것으로 읽는다.** 0 으로 읽으면 300일째 세이브가 열리자마자
     "물 준 지 300일"이 되어 그 판의 몬스테라가 영영 안 자란다. */
  const last = Number.isInteger(p.wateredOnDay) ? p.wateredOnDay : S.day;
  const interval = waterIntervalOf(opt.band ?? null, opt.season ?? null);
  const dryDays = Math.max(0, S.day - last);
  return {
    dryDays, interval,
    leftDays: interval - dryDays,          // 음수면 그만큼 잃고 있다
    dry: dryDays > interval,               // ← 이 날은 하루가 안 세어진다
    canWater: dryDays >= interval - WATER_GRACE_DAYS,
    wateredOnDay: last
  };
}

/* ★★ 물을 준다 — 화면의 [몬스테라에 물 주기] 버튼이 부르는 유일한 함수.
   ★ 과습 — 아직 촉촉하면 **아무 일도 안 난다. 체력도 안 쓴다.**
     실제로는 과습이 몬스테라를 죽이는 1위지만 **벌을 주지 않는다.** 하루 한 번 눌러 두는
     습관이 손해가 되면 플레이어가 버튼을 무서워하고, 그러면 안 무서운 쪽(=아예 안 누름)으로
     간다 — 가르치려는 행동을 말리는 셈이다. 화면은 "아직 촉촉합니다"라고만 말한다.
   ★ 던지지 않는다(자리가 없을 때만 뺀다) — 버튼을 두 번 누른 것은 고장이 아니다.
   ★ 돈이 안 든다. `waterCrop` 과 같은 판단이다.
   반환 { watered, already, dryDays, interval, leftDays, events } */
export function waterPot(S, opt = {}) {
  const p = opt.pot || pot0(S);          // ★ opt.pot — 어느 그루냐(다개체). 안 주면 첫 화분
  if (!p) { const e = new Error('[물주기] 아직 몬스테라가 없습니다'); e.tutorialInput = true; throw e; }
  if (!p.slotId && !p.at) {
    const e = new Error('[물주기] 화분을 먼저 방 안에 놓아 주세요');
    e.tutorialInput = true; throw e;
  }
  const st = potWaterStatus(S, opt);
  if (st && !st.canWater)
    return { ...st, watered: false, already: true, events: [] };
  /* ★ `free` — 배속의 자동 급수가 쓴다(loop.js §autoWater). 체력도 안 쓰고 기록도 안 남긴다.
     콩나물 배속이 `waterBeansprout` 을 직접 부르는 것과 **같은 결**이다: 배속은 손이 아니라
     시간이 흐른 것이라, 매일 체력을 물리면 배속이 체력에 막혀 하루짜리가 된다.
     ⚠ 규칙 자체(언제 물이 드나)는 **위 한 곳뿐**이다 — 여기서 갈라지지 않는다. */
  if (!opt.free) {
    /* ★ 체력 — **아무것도 바꾸기 전에** 묻는다. 반쯤 준 물은 없다(waterCrop 과 같은 순서). */
    const sta = canActStamina(S, 'water');
    if (!sta.ok) { const e = new Error('[물주기] ' + sta.reason); e.tutorialInput = true; throw e; }
  }
  p.wateredOnDay = S.day;
  if (!opt.free) spendStamina(S, 'water');
  const after = potWaterStatus(S, opt);
  if (!opt.free) pushLog(S, st.dry
    ? `💧 몬스테라에 물을 주었습니다 — ${st.dryDays - st.interval}일 멈춰 있었습니다. 다시 자랍니다`
    : `💧 몬스테라에 물을 주었습니다 (다음은 ${after.interval}일 뒤)`);
  return { ...after, watered: true, already: false,
           events: [{ id: 'pot_watered', ko: '몬스테라에 물을 주었습니다',
                      wasDry: !!st.dry, interval: after.interval }] };
}

/* ★ 지금 거둘 수 있나 — [수확하기] 버튼을 켤지 흐리게 할지의 근거. 상태를 안 바꾼다 (2026-08-04).
   ⚠ **거두는 함수는 여기 없다.** `loop.harvestCrop(S, io)` 다 — 첫 수확에 몬스테라 선물이
     딸려 오고 그건 `io` 를 쓴다. 상태(state)는 io 를 모른다. */
export function cropHarvestStatus(S) {
  return beansproutHarvestStatus(S && S.firstPlay);
}

/* ★ 콩나물을 다시 심는다 — **재배(first_play)와 지갑(tutorial)을 한 동작으로** (2026-08-03).
   ------------------------------------------------------------
   씨앗값을 안 내고 다시 심을 수 있으면 그건 경제가 아니다. 그렇다고 first_play 가 지갑을
   만지면 살림 규칙이 두 곳으로 갈린다 — 그래서 `setCropAt` 과 같은 자리에서 묶는다.
   게임 화면·재현은 **이 함수 하나만** 부르면 된다(buyLamp·moveOut 과 같은 결).

   ★ 씨앗은 **미리 주문해 둔 재고**를 쓴다. 돈으로 바로 사는 게 아니다 —
     주문하면 하루 뒤에 오므로(shop.CATALOG.bean_seed.leadDays) 회전을 이어 가려면
     수확 전에 시켜 둬야 한다. 그게 이 상점의 성격이고, 잊으면 하루가 빈다.
   ★ 시루 용기도 마찬가지다. 시루를 늘리려면(`opt.sirus` 를 올리려면) 늘어난 만큼
     `siru` 재고가 있어야 한다. 첫 시루 하나는 처음에 받은 것이라 안 센다.

     opt.sirus  이번 회전에 돌릴 시루 수 (없으면 그대로)
     opt.at     자리를 옮기려면. placeBeansprout 과 같은 세 가지 입력
     opt.slots · size · snapDist  좌표를 세울 때 쓰는 것들(setCropAt 과 같다)
   반환 { sirus, cycle, seedsUsed, sirusAdded, slotId, at, events } */
export function resowCrop(S, opt = {}) {
  const fp = S && S.firstPlay;
  if (!fp || !fp.enabled || !fp.beansprout)
    throw new Error('[콩나물] 첫 플레이 상태가 없습니다 — 다시 심을 시루가 없습니다');
  /* ★ 2026-08-05 — `opt.kind` 로 종류를 고른다(기본 콩나물).
     ★★ 씨앗·용기 품목도 **작물이 정한다** — `bean_seed`·`siru` 를 여기 박아 두면
       무순을 심을 때 콩 씨앗이 나간다(재고가 조용히 틀린 데서 빠진다). */
  const kindId = opt.kind || 'beansprout';
  const k = cropKindOf(kindId);
  const site = cropSiteOf(fp, kindId);
  if (!site) throw new Error(`[${k.ko}] 상태가 없습니다 — 다시 심을 것이 없습니다`);
  const pots = (site.pots || []);
  /* ★ 2종째는 0개에서 시작한다(재배판을 사야 생긴다). 콩나물만 "적어도 하나"가 사실이다 */
  const floor = kindId === 'beansprout' ? 1 : 0;
  const had = Math.max(floor, pots.length || Math.round(site.sirus || 0));
  const sirus = opt.sirus == null ? had : opt.sirus;
  if (!Number.isInteger(sirus) || sirus < floor)
    throw new Error(`[${k.ko}] ${k.containerKo} 수가 ${floor} 이상의 정수가 아닙니다: ${sirus}`);
  const sirusAdded = Math.max(0, sirus - had);
  /* ★★ 거둔 시루만 다시 심는다 (2026-08-04 · first_play.js §다시 심는다).
     시차 판에서는 늘 일부만 거둬져 있다 — 전부를 요구하면 시차를 둔 판이 영영 못 심는다. */
  /* ★★ 2026-08-09 — `opt.potIds` 를 주면 **그 시루만** 다시 심는다(박사님 "각개 다시 심기").
     씨앗도 그만큼만 든다 — 안 그러면 하나를 심는데 다섯 봉지가 나간다. */
  const only = Array.isArray(opt.potIds) && opt.potIds.length ? new Set(opt.potIds) : null;
  const harvestedCount = pots.filter(p => p.harvested && (!only || only.has(p.id))).length;
  if (!harvestedCount && !sirusAdded) {
    const e = new Error(`[${k.ko}] 아직 수확하지 않았습니다 — 거둔 뒤에 다시 심습니다`);
    e.tutorialInput = true;
    throw e;
  }
  /* 씨앗은 **실제로 심는 시루 수**만큼만 든다 — 자라는 중인 시루는 안 건드리므로 안 나간다 */
  const seedsUsed = harvestedCount + sirusAdded;

  /* ★ 재고부터 뺀다. resowBeansprout 은 이력을 비우므로 되돌릴 수 없다 —
     "심어 놓고 씨앗이 없어서 실패"가 나면 그 회전이 통째로 사라진다. */
  /* ★ 체력 — 재고를 빼기 **전에** 묻는다. 씨앗만 나가고 안 심기면 그 씨앗이 사라진다 */
  {
    const st = canActStamina(S, 'sow');
    if (!st.ok) { const e = new Error(`[${k.ko}] ` + st.reason); e.tutorialInput = true; throw e; }
  }
  /* ★★ 2026-08-09 — **묻는 것과 빼는 것을 갈랐다.**
     예전에는 시루를 먼저 빼고 씨앗을 나중에 뺐다. 씨앗에서 던지면 이미 빠진 시루가
     그대로 사라졌다(시루 하나 14,000원). 화면이 미리 세어 그 길을 피할 뿐이라
     **규칙이 지키는 게 아니었다** — 재현·자동조작·다른 화면에서는 그냥 사라진다.
     이제 둘 다 먼저 묻고, 통과한 뒤에만 뺀다. 던져도 재고는 손댄 적이 없다. */
  assertStockAll(S, [{ itemId: k.containerItemId, qty: sirusAdded },
                     { itemId: k.seedItemId,      qty: seedsUsed }]);
  if (sirusAdded > 0) useStock(S, k.containerItemId, sirusAdded);
  useStock(S, k.seedItemId, seedsUsed);            // 용기 하나에 씨앗 한 봉지
  spendStamina(S, 'sow');

  const r = resowBeansprout(fp, { ...opt, kind: kindId, sirus, day: S.day });
  pushLog(S, `🌱 ${k.ko}을(를) 다시 심었습니다 — ${k.containerKo} ${r.resown}개 · ` +
             `씨앗 ${seedsUsed}봉지를 썼습니다 (물을 줘야 회전이 시작됩니다)`);
  /* ★★ 2026-08-04 재정정 — 예전에는 "몇 시루를 심어도 절감은 한 시루분"이라고 말했다.
     이제는 다르다: **거두는 때가 겹치면** 깎이고, 어긋나게 돌리면 온전히 받는다(§겹침).
     그래서 막지도, 손해라고 말하지도 않는다 — **어떻게 하면 안 겹치는지**를 말한다. */
  if (r.resown > 1)
    pushLog(S, `⏱ ${k.containerKo} ${r.resown}개를 한꺼번에 심었습니다 — 물을 **날을 달리해** 주면 ` +
               `거두는 날이 어긋나 절감이 안 깎입니다(같은 날 거두면 3,000 → 2,000 → 1,000원)`);
  return { ...r, seedsUsed, sirusAdded, kind: kindId,
           events: [{ id: 'crop_resown', ko: `${k.ko}을(를) 다시 심었습니다`, kind: kindId,
                      sirus: r.sirus, resown: r.resown, cycle: r.cycle, seedsUsed }] };
}

/* ★★ 잉여 채소를 넘긴다 — **재배(first_play)와 지갑(shop)을 한 동작으로** (2026-08-06 신설).
   ------------------------------------------------------------
   `resowCrop` 과 **같은 결**이다: 규칙은 first_play 가, 지갑은 shop 이 갖고, 둘을 여기서 묶는다.
   게임 화면·재현은 **이 함수 하나만** 부르면 된다.

   ★ 무엇이 팔리나 — `first_play.js §잉여 판매` 가 정본이다. 한 줄로 줄이면:
     **곳간이 못 받은 몫**(겹쳐서 못 받은 것 + 넘쳐서 쉰 것)만 팔린다. 곳간(끼니)은 안 만진다.

   ★ 체력을 안 쓴다. 물주기·수확·심기는 **돌보는 손**이지만 넘기는 것은 그 축이 아니다
     (`shop.sellPot`·`sellCutting` 도 체력을 안 쓴다 — 파는 일에 체력을 물린 적이 없다).
     ⚠ 이건 판단이다. 만약 물리게 되면 콩나물 15시루가 삽수를 못 자르는 문제(econgap §A-3)가
       한 칸 더 나빠진다 — 그래서 지금은 안 물린다. 바꾸려면 stamina 창과 같이 정해야 한다.

   반환 { won, pendingWon, rate, cashWon, kind, events } */
export function sellCropSurplus(S, opt = {}) {
  const fp = S && S.firstPlay;
  if (!fp || !fp.enabled)
    throw new Error('[잉여] 첫 플레이 상태가 없습니다 — 넘길 잉여가 없습니다');
  const q = cropSurplusQuote(fp);
  if (q.pendingWon <= 0) {
    const e = new Error('[잉여] 넘길 잉여가 없습니다 — 보유 채소로 들어간 것은 밥으로 씁니다 ' +
                        '(겹쳐서 못 받거나 넘쳐서 쉰 몫만 넘길 수 있습니다)');
    e.tutorialInput = true;                 // 안내지 고장이 아니다
    throw e;
  }
  if (q.won <= 0) {
    const e = new Error(`[잉여] 지금 넘기면 0원입니다 — 넘기는 값이 정가의 ` +
                        `${Math.round(q.rate * 100)}% 입니다`);
    e.tutorialInput = true;
    throw e;
  }
  const taken = takeCropSurplus(fp);
  /* ⚠ `opt.log` 를 넘기지 않는다 — 바로 아래에서 `pushLog` 로 한 줄을 적는다.
     둘 다 켜면 같은 일이 로그에 두 번 적힌다(다른 문장으로 적혀서 더 나쁘다). */
  const r = creditCropSurplus(S, taken.won);
  pushLog(S, `💰 잉여 채소를 넘겼습니다 — 정가 ${taken.pendingWon.toLocaleString()}원어치를 ` +
             `${Math.round(taken.rate * 100)}% 에 넘겨 ${taken.won.toLocaleString()}원 ` +
             `(보유 채소로 들어간 몫은 그대로 밥입니다)`);
  return { ...r, pendingWon: taken.pendingWon, rate: taken.rate, won: taken.won,
           totalSoldWon: fp.food.totalSurplusSoldWon,
           events: [{ id: 'crop_surplus_sold', ko: '잉여 채소를 넘겼습니다',
                      won: taken.won, pendingWon: taken.pendingWon, rate: taken.rate }] };
}

/* 지금 넘길 것이 있나 · 얼마인가 — 버튼을 켤지 흐리게 할지의 근거. **상태를 안 바꾼다.** */
export function cropSurplusStatus(S) {
  const fp = S && S.firstPlay;
  if (!fp || !fp.enabled) return { pendingWon: 0, rate: 0, won: 0, canSell: false };
  return cropSurplusQuote(fp);
}

/* ★★ 곳간 채소를 판다 — **몇 판인지 골라서** (2026-08-15 신설 · first_play §곳간 판매).
   ------------------------------------------------------------
   `sellCropSurplus` 와 같은 결이다: 규칙은 first_play, 지갑은 shop, 묶는 것은 여기.
   ⚠ 다른 점 하나가 전부다 — **이건 곳간(끼니)을 판다.** 잉여는 어차피 버릴 것을 넘기는
     것이라 잃는 게 없었지만, 이쪽은 **먹을 것을 파는 것**이라 판 만큼 밥이 준다.
     그래서 로그가 손해를 반드시 적는다(아래 pushLog). 화면도 같은 말을 한다.
   ★ 값은 잉여와 **같은 `cropSurplusSaleRate`(0.85)** 다. 새 값을 안 만들었다 —
     둘이 갈리면 「어느 쪽으로 파는 게 이득인가」라는, 이 게임이 재지 않는 셈이 생긴다.
   ★ 체력을 안 쓴다 — 파는 일에 체력을 물린 적이 없다(`sellPot`·`sellCutting`·잉여 넘기기).
     박사님이 *"어차피 체력이 막고있어서 괜찮을거랴"* 라 하신 것은 **채소를 만드는 쪽**의
     체력이다. 파는 손에 체력을 새로 물리는 것은 이 작업이 정할 일이 아니다.

   count 를 안 주면 **전부**다. 반환 { won, pendingWon, lossWon, lots, rate, pantryWon, ... } */
export function sellPantryCrop(S, count, opt = {}) {
  const fp = S && S.firstPlay;
  if (!fp || !fp.enabled)
    throw new Error('[보유 채소] 첫 플레이 상태가 없습니다 — 팔 채소가 없습니다');
  /* ★ `opt.kind` 를 그대로 넘긴다 — 「그 채소만 팔기」(first_play §갈래 고르기) */
  const q = pantrySaleQuote(fp, count, opt);
  if (q.maxLots <= 0) {
    const e = new Error('[보유 채소] 가진 채소가 없습니다 — 거둬서 채운 뒤에 팔 수 있습니다');
    e.tutorialInput = true;                 // 안내지 고장이 아니다
    throw e;
  }
  if (q.lots <= 0) {
    const e = new Error('[보유 채소] 몇 판을 팔지 골라 주세요 (지금 0판입니다)');
    e.tutorialInput = true;
    throw e;
  }
  if (q.won <= 0) {
    const e = new Error(`[보유 채소] 지금 팔면 0원입니다 — 넘기는 값이 정가의 ` +
                        `${Math.round(q.rate * 100)}% 입니다`);
    e.tutorialInput = true;
    throw e;
  }
  const taken = takePantryCrop(fp, count, opt);
  /* 무엇을 팔았나 — 종류별로 센다. 「콩나물 2판」처럼 적으려고 */
  const byKind = new Map();
  for (const l of taken.picked) {
    const ko = l.kind ? cropKindOf(l.kind).ko : '보유 채소';
    byKind.set(ko, (byKind.get(ko) || 0) + 1);
  }
  /* ★ 2026-08-16 — 무게도 같이 적는다(§그램). 「콩나물 2판」만으로는 얼마나 나갔는지 모른다 */
  const whatKo = [...byKind].map(([ko, n]) => `${ko} ${n}판`).join(' · ') || `${taken.lots}판`;
  const whatG = formatGram(taken.pendingGrams);
  const r = creditCropSurplus(S, taken.won);
  /* ⚠ `opt.log` 를 안 넘긴다 — 아래에서 한 줄을 적는다(두 줄이 되면 더 나쁘다) */
  pushLog(S, `💰 보유 채소를 팔았습니다 — ${whatKo} ${whatG}(밥값 ${taken.pendingWon.toLocaleString()}원어치)을 ` +
             `${Math.round(taken.rate * 100)}% 에 넘겨 ${taken.won.toLocaleString()}원 ` +
             `(${taken.lossWon.toLocaleString()}원 손해 · ${taken.pantryWon.toLocaleString()}원어치 남음)`);
  return { ...r, lots: taken.lots, picked: taken.picked, whatKo, whatG,
           pendingGrams: taken.pendingGrams, pantryGrams: taken.pantryGrams,
           pendingWon: taken.pendingWon, rate: taken.rate, won: taken.won,
           lossWon: taken.lossWon, pantryWon: taken.pantryWon,
           totalSoldWon: fp.food.totalPantrySoldWon,
           events: [{ id: 'pantry_crop_sold', ko: '보유 채소를 팔았습니다',
                      won: taken.won, pendingWon: taken.pendingWon,
                      lossWon: taken.lossWon, lots: taken.lots, rate: taken.rate }] };
}

/* 곳간에 몇 판이 있고 n 판을 팔면 얼마인가 — **상태를 안 바꾼다.**
   ⚠ 꾸러미 목록을 총액에 맞추기는 한다(옛 세이브를 여는 길이라 피할 수 없다). */
/* ★ `opt.kind` — **그 작물만** 본다(2026-08-17 · first_play §갈래 고르기). 안 주면 예전 그대로 */
export function pantrySaleStatus(S, count, opt = {}) {
  const fp = S && S.firstPlay;
  if (!fp || !fp.enabled)
    return { lots: 0, maxLots: 0, pendingWon: 0, rate: 0, won: 0, lossWon: 0,
             pantryWon: 0, picked: [], list: [], canSell: false };
  const q = pantrySaleQuote(fp, count, opt);
  return {
    ...q,
    /* 화면이 「콩나물 400g (7일차)」를 적을 수 있게 이름을 붙여 낸다
       ★ 2026-08-16 — `g` 도 같이 실린다(`pantryLotsWithGrams`). 화면이 원을 나누지 않는다 */
    list: pantryLotsWithGrams(fp).map(l => ({
      ...l, kindKo: l.kind ? cropKindOf(l.kind).ko : '보유 채소'
    }))
  };
}

/* ══ ★★ 오늘 밥상 — 곳간에서 몇 g 을 쓸까 (2026-08-16 · first_play §eatFromPantry) ══════
   박사님: *"하루지날떄 그때 소모량 반자동으로 소요되도록 … 창이 떠서 몇 G 쓸지 조정가능하도록"*
   `sellPantryCrop` 과 같은 결이다: 규칙은 first_play, 묶는 것은 여기, 화면은 부르기만 한다.
   ★ **먹지 않는다.** 적어 둘 뿐이고 실제로 먹는 것은 [다음 날]의 `eatFromPantry` 다 —
     여기서 먹으면 하루에 두 번 먹는 날이 생긴다(§수확이 겪은 그 함정 그대로). */
export function mealPlanStatus(S, grams) {
  const fp = S && S.firstPlay;
  if (!fp || !fp.enabled)
    return { grams: 0, wantGrams: 0, maxGrams: 0, defaultGrams: 0, useWon: 0,
             capWon: 0, capGrams: 0, pantryWon: 0, pantryGrams: 0,
             cashFoodWon: 0, dailyFoodWon: 0, lots: [], lessThanCapWon: 0, list: [] };
  const q = mealPlanQuote(fp, grams);
  return { ...q, list: q.lots.map(l => ({
    ...l, kindKo: l.kind ? cropKindOf(l.kind).ko : '보유 채소' })) };
}

/* 오늘 쓸 g 을 적어 둔다(null 이면 지운다 = 예전 그대로 상한까지 먹는다) */
export function planMeal(S, grams) {
  const fp = S && S.firstPlay;
  if (!fp || !fp.enabled) throw new Error('[밥상] 첫 플레이 상태가 없습니다');
  const q = planMealGrams(fp, grams);
  return { ...q, list: q.lots.map(l => ({
    ...l, kindKo: l.kind ? cropKindOf(l.kind).ko : '보유 채소' })) };
}

/* 추천 자리에 놓는다(예전 경로). 좌표까지 같이 세운다. */
export function setPotSlot(S, potOrId, slotId, slots) {
  const p = typeof potOrId === 'string' ? (S.pots || []).find(x => x.id === potOrId) : potOrId;
  if (!p) throw new Error(`[배치] 모르는 화분: ${potOrId}`);
  p.placedOnce = true;                         /* §rehomePot — 놓인 적이 있다 */
  const s = (slots || []).find(x => x && x.slotId === slotId);
  if (!s) throw new Error(`[배치] 모르는 자리: ${slotId}`);
  p.slotId = slotId;
  p.at = [s.x, s.y, s.z].every(v => typeof v === 'number' && Number.isFinite(v))
       ? atFromSlot(s, { rotY: p.at ? p.at.rotY : 0 }) : null;
  return { potId: p.id, slotId, at: p.at };
}

/* 슬롯이 사라졌을 때(가구 삭제·방 전환) 화분을 어디로 보낼지 — 코어가 정한다(house-to-core §slotId).
   v0 규칙: 가장 밝은 자리로 자동 회수하고 로그를 남긴다. 조용히 옮기지 않는다.

   ★ 자유 좌표 화분은 슬롯 목록과 무관하게 **그 자리에 그대로 있다.** 회수는 두 경우뿐이다:
     ① 올라앉았던 가구(onUid)가 방에서 사라졌다   ② 방이 바뀌어 그 좌표가 방 밖이다
   room 을 안 넘기면 ①·②를 판단할 근거가 없으므로 자유 좌표는 손대지 않는다. */
/* ★★ 가구가 **움직이면** 그 위 물건의 좌표도 따라가야 한다 (2026-08-06 · 베타테스터 신고).
   ------------------------------------------------------------
   신고된 화면:
     ⛔ 진행을 멈췄습니다 — [조도] pot_01 의 자리가 어긋납니다
        slotId=banjiha-desk:0 는 (-0.36, 0.74, -0.86) 인데 at 은 (0.79, 0.74, -1.41) 입니다.

   책상 위에 화분을 놓고 책상을 옮기면 **자리(slot)는 가구를 따라가는데 화분의 `at` 은
   제자리에 남는다.** 둘이 어긋나면 조도 계약이 던지고, 그 예외는 `isRecoverable` 이 아니라
   `hardLock` 이라 **판이 통째로 잠긴다** — 즉 옳은 조작(빛을 받으러 가구를 옮김)이 판을 끝낸다.

   ⚠ `rehomePot` 의 옛 검사 둘로는 못 잡는다. 그건 「받치던 가구가 **사라졌나**」와
     「방 **밖**인가」만 본다 — **움직인 경우**는 그 둘 다 아니라 이른 return 으로 빠져나갔다.

   ⇒ `slotId` 가 아직 살아 있으면 그 자리의 **지금 좌표**로 `at` 을 다시 뜬다.
     화분은 그 선반 칸에 그대로 있는 것이 맞다 — 가구를 옮기면 얹힌 것도 같이 가는 것이
     플레이어가 기대하는 바이고 3D 도 이미 그렇게 그린다(room_view 의 riders).
   ⚠ 자유 좌표(`free:`)는 **안 건드린다.** 그건 가구가 아니라 좌표에 놓은 것이라
     따라갈 자리가 없다. 받치던 가구가 사라지는 경우는 위 ①이 따로 맡는다.
   ⚠ 회전(`rotY`)은 지킨다 — 플레이어가 돌려 둔 것을 가구를 옮겼다고 되돌리면 안 된다. */
function reseatOnSlot(o, slots) {
  if (!o || !o.slotId || isFreeSlotId(o.slotId) || !o.at) return false;
  const s = (slots || []).find(x => x && x.slotId === o.slotId);
  if (!s || ![s.x, s.y, s.z].every(v => typeof v === 'number' && Number.isFinite(v))) return false;
  if (['x', 'y', 'z'].every(k => Math.abs((o.at[k] ?? 0) - s[k]) < 1e-6)) return false;
  o.at = atFromSlot(s, { rotY: o.at.rotY || 0 });
  return true;
}

/* 놓인 것 **전부**를 다시 앉힌다 — 화분·작물 자리·삽수.
   ★ 한 곳에서 도는 이유: 셋이 같은 규칙(`slotId` 가 살아 있으면 그 자리 좌표)인데
     세 곳에 흩어 두면 하나를 빠뜨린다. 실제로 화분만 고쳐 두고 시루는 안 고쳐져 있었다.
   ⚠ 이것은 **회수(rehome)가 아니라 재정렬(reseat)** 이다 — 자리를 안 바꾸고 좌표만 맞춘다.
     자리가 사라진 경우의 회수는 `rehomePot`·`rehomeCuttings` 가 따로 맡는다. */
export function reseatAllOnSlots(S, slots) {
  if (!S) return 0;
  let n = 0;
  for (const p of (S.pots || [])) if (reseatOnSlot(p, slots)) n++;
  /* ★★★ 2026-08-17 — **빈 그릇과 작물 개체도 다시 앉힌다** (박사님: *"3단장이나 책상에
       화분 올리고 가구 이동하면 가구 따라가게 다시 검토해."*)
     ══════════════════════════════════════════════════════════════════
     ⚠⚠ 여기가 화분·**자리 사본**·삽수만 돌았다. 그런데 2026-08-09 에 시루가 각개가 되면서
       (`site.pots[]` 마다 제 `at`) **개체는 아무도 안 앉혔고**, 2026-08-16 에 생긴
       빈 그릇(`S.emptyPots`)도 빠져 있었다.
     ⇒ 실측: 책상을 옮기면 **서랍장 슬롯까지 다시 앉는데**(자리표를 통째로 다시 적는다)
       그 위의 콩나물이 안 따라가 **0.25m 어긋났다.** 그 뒤로는 조도 엔진이
       「자리가 어긋납니다」로 던져서 **그 가구를 영영 못 옮긴다.**
       옮기기 전 어긋남 0m → 책상 한 번 옮긴 뒤 0.25m (`probe_move_audit ⓪`).
     ★ 자리 사본만 앉히고 개체를 안 앉히면 **둘이 갈린다** — 이 저장소의 오랜 병이다. */
  for (const p of (S.emptyPots || [])) if (reseatOnSlot(p, slots)) n++;
  if (S.firstPlay && S.firstPlay.enabled) {
    for (const site of cropSites(S.firstPlay)) {
      if (reseatOnSlot(site, slots)) n++;
      for (const p of (site.pots || [])) if (reseatOnSlot(p, slots)) n++;
    }
  }
  for (const c of (S.cuttings || [])) if (reseatOnSlot(c, slots)) n++;
  return n;
}

/* ★★ 자유 좌표로 **가구 위에 얹힌 것**을 그 가구와 함께 옮긴다 (2026-08-16 · B-5)
   ------------------------------------------------------------
   박사님: *"가구 옮길 때 위에 식물들도 같이 옮겨지기 및 돌리기도"*

   위 `reseatOnSlot` 은 **추천 자리 위**의 것만 맡는다(자유 좌표는 첫 줄에서 뺀다).
   그런데 2026-08-11 에 가구 윗면 전체가 칸이 되면서, 플레이어가 놓는 것은 대개
   **자유 좌표 + at.onUid** 다. 그래서 「책상을 옮기면 화분이 허공에 남는」 구멍이 났다.
   3D 는 이미 따라갔다(room_view.followFurniture) — 갈린 것은 **세이브**다.
   실측표는 `docs/handoff/place-to-plan.md §B-5`.

   ⚠ 좌표 규약은 `place.followFurnitureAt` 하나만 쓴다. 여기서 식을 또 쓰면 두 벌이 된다.
   ⚠ 추천 자리 위(`slotId` 가 free 가 아닌 것)는 **안 건드린다** — 그건 reseatOnSlot 몫이고
     둘 다 손대면 같은 것을 두 번 옮긴다.
   ⚠ from·to 는 **가구 규약(도°)** 이다. 부르는 쪽이 room_view.commitFurnitureAt 의
     `{from, to}` 를 그대로 넘기면 된다 — 그것이 실제로 방을 움직인 값이다. */
export function followFreeOnFurniture(S, uid, from, to) {
  if (!S || !uid || !from || !to) return 0;
  let n = 0;
  const move = (o) => {
    if (!o || !o.at || o.at.onUid !== uid) return;
    if (o.slotId && !isFreeSlotId(o.slotId)) return;      // 추천 자리 위 — reseatOnSlot 몫이다
    o.at = followFurnitureAt(o.at, from, to);
    n++;
  };
  for (const p of (S.pots || [])) move(p);
  /* ★ 2026-08-17 — 이 줄이 유리 수경병까지 같이 옮긴다. 빈 그릇은 갈래를 안 가리고
     **한 목록**에 살기 때문이다(§emptyPots). 삽수가 든 그릇은 삽수가 지고 있어서
     바로 아래 줄이 옮긴다 — 그래서 둘이 갈릴 곳이 없다. */
  for (const p of (S.emptyPots || [])) move(p);
  for (const c of (S.cuttings || [])) move(c);
  /* ★★★ 2026-08-17 — **시루·재배판은 「자리」가 아니라 「개체마다」다** (박사님:
       *"3단장이나 책상에 화분 올리고 가구 이동하면 가구 따라가게 다시 검토해."*)
     ⚠⚠ 여기는 **자리(site) 하나**만 옮기고 있었다. 2026-08-09 에 시루가 각개가 되면서
       (`site.pots[]` 마다 제 `at` 을 든다) 자리 사본은 대표 하나일 뿐이다 —
       그래서 상판에 시루를 둘 올려 두고 가구를 밀면 **자리 사본만 따라가고 시루는 남았다.**
     ⇒ 자리도 옮기고, 그 안의 **개체도 하나씩** 옮긴다. 둘 다 `at` 을 들고 있으므로 둘 다다. */
  if (S.firstPlay && S.firstPlay.enabled) {
    for (const site of cropSites(S.firstPlay)) {
      move(site);
      for (const p of (site.pots || [])) move(p);
    }
  }
  return n;
}

export function rehomePot(S, slots, log, room = null) {
  const p = pot0(S);
  if (!p) return null;
  /* ★★★ 2026-08-17 — **가방에 있는 화분은 앉히지 않는다** (박사님: *"몬스테라 주는 거
       인벤으로 안 들어오고 또 바로 설치되는데?"*)
     ══════════════════════════════════════════════════════════════════
     ⚠⚠ 이 함수의 마지막 줄이 **자리 없는 화분을 첫 자리에 앉힌다.** 그 규칙은
       「슬롯이 사라졌을 때 화분을 잃지 않게」 만든 것인데(v0 · 위 머리말),
       **「아직 안 놓았다」와 「자리를 잃었다」를 못 가른다.**
       ⇒ 선물을 가방으로 보내자마자(`givePlant({slotId:null})`) 하루가 가면서
         여기가 도로 방에 세웠다. 실측: 「인벤으로 안 들어오고 또 바로 설치」.
     ★ 둘을 가르는 표는 **이미 있다** — `arrivedOnDay` 가 있고 자리·좌표가 둘 다 없으면
       그것은 **한 번도 안 놓인 것**이다. 자리를 잃은 화분은 `slotId` 나 `at` 중 하나가
       반드시 남아 있다(그것을 잃는 길이 이 함수 말고는 없다).
     ⚠ 「모르면 앉힌다」로 두면 안 된다 — 그러면 가방이라는 상태가 존재할 수 없다. */
  if (p.placedOnce === false || (!p.slotId && !p.at && p.placedOnce == null)) {
    return null;                               // 아직 가방에 있다 — 놓는 것은 플레이어 손이다
  }
  migratePots(S, slots);                       // 옛 세이브면 여기서 좌표가 채워진다

  if (p.at) {
    const surfaces = room && room.surfaces;    // Set<uid> — 지금 방에 있는 가구
    const gone = p.at.onUid && surfaces && !surfaces.has(p.at.onUid);
    const outside = room && room.size && !inRoom(p.at, room.size);
    if (!gone && !outside) { reseatOnSlot(p, slots); return p.slotId; }
    if (log) log(gone
      ? `화분 회수 — 받치던 ${p.at.onUid} 이(가) 사라졌습니다`
      : '화분 회수 — 자리가 방 밖입니다');
    p.at = null;                               // 아래 슬롯 회수로 내려간다
  } else if (p.slotId && slots.some(s => s.slotId === p.slotId)) {
    return p.slotId;
  }

  const dest = slots[0] || null;
  if (log && dest) log(p.slotId
    ? `화분 회수 — 슬롯 ${p.slotId} 이(가) 사라져 ${dest.slotId} 로 옮겼습니다`
    : `화분 배치 — ${dest.slotId}`);
  p.slotId = dest ? dest.slotId : null;
  p.at = (dest && [dest.x, dest.y, dest.z].every(v => typeof v === 'number' && Number.isFinite(v)))
       ? atFromSlot(dest) : null;
  return p.slotId;
}

/* ---- 가구 덮어쓰기 표 (S.home.furniture) ---- */
export function furnitureOverrides(S) {
  if (!S.home.furniture) S.home.furniture = {};
  return S.home.furniture;
}

/* 플레이어가 가구를 옮긴 것을 세이브에 적는다. 방을 다시 조립하는 일은
   light_adapter.moveFurniture 가 한다 — 상태와 조립을 한 함수에 섞지 않는다. */
export function setFurniturePlacement(S, uid, pos, opt = {}) {
  if (!uid || typeof uid !== 'string') throw new TypeError('[배치] 가구 uid 가 필요합니다');
  assertFurnitureAt(pos, opt);
  const tbl = furnitureOverrides(S);
  const cur = tbl[uid] || {};
  tbl[uid] = {
    x: pos.x, z: pos.z,
    rot: pos.rot == null ? (cur.rot ?? 0) : pos.rot,
    ...(pos.y == null ? (cur.y == null ? {} : { y: cur.y }) : { y: pos.y })
  };
  return tbl[uid];
}

export function clearFurniturePlacement(S, uid) {
  const tbl = furnitureOverrides(S);
  const had = uid in tbl;
  delete tbl[uid];
  return had;
}

/* ============================================================
   ★★★ 가구를 사고 판다 (2026-08-17 · 박사님 *"가구 판매/구매도 열자"*)
   ------------------------------------------------------------
   ══ ⚠⚠ 먼저 — **`S.home.furniture` 는 「방에 무엇이 있나」가 아니다** ═══════════
   그 표는 **옮긴 자리만** 담는다(`{uid: {x,z,rot,y}}`). 방에 무엇이 서 있나는
   `data/house_rooms.json` 이 갖고, 조도 엔진은 조립 직전에 그 표를 **덮어쓰기로만** 얹는다
   (`light_adapter §defWithOverrides`). 즉 **지우는 길도 더하는 길도 원래 없었다.**
   ⇒ 그래서 칸을 둘 새로 뒀다. 자리표에서 지우는 것만으로는 판 가구가 **다시 켤 때 되살아난다.**

     `S.home.furnitureSold`   판아서 **방에서 걷어낸** uid 목록 (방 정의에 원래 있던 것)
     `S.home.furnitureAdded`  사서 **방에 새로 놓은** 것 `[{uid, preset, x, z, rot, y?}]`

   ⚠ 이 둘을 **조립에 실제로 먹이는 일은 `light_adapter` 몫**이고 그 파일은 이번 창의
     쓰기 영역 밖이다. 붙일 코드는 `docs/handoff/furnishop-to-plan.md §붙일 코드`에 적어 두었다.
     ★ 안 붙이면 **상태·세이브는 맞는데 화면은 안 바뀐다.** 그 사실을 여기 적어 둔다 —
       「고쳤다」를 화면 확인 없이 쓰지 않는다(START-HERE §2).

   ══ ★ 못 파는 것 넷 — **막을 때 까닭을 말한다** ═════════════════════════════
     ① **가구가 아니다** — 조명·벽 붙박이·가전 (`shop.furnitureQuoteOf` 가 판정한다)
     ② **위에 뭔가 올라가 있다** — 화분·시루·재배판·삽수. 그 물건이 갈 곳이 없어진다
     ③ **다른 가구를 받치고 있다** — 2026-08-16 에 두 겹 쌓기가 열렸다(room_view §G-13).
        ⚠ 「무엇이 내 위에 얹혔나」는 **3D 기하**라 코어가 모른다. 그루의 잎 수를 growth 에서
          **받는 것과 같은 규약**으로 화면에서 받는다(`opt.riders` = `roomView.ridersOf(uid)`).
          ⇒ **안 주면 던진다.** 지어내지 않는다.
     ④ **방이 못 박은 것** — `opt.fixed`. 지금 `house_rooms.json` 에 `fixed` 칸을 쓰는 방은
        **하나도 없다**(재서 확인했다). 창턱 받침·식물등처럼 못 파는 것은 ①이 이미 막는다.
        칸을 열어 둔 이유는 나중에 방이 「이건 못 판다」를 말할 수 있게 하기 위해서다.
============================================================ */

/* 판 가구 목록 — 늘 있는 모양으로 만들어 낸다(`earnedByOf` 와 같은 규약) */
export function soldFurniture(S) {
  if (!S.home) S.home = { room: 'banjiha', furniture: {} };
  if (!Array.isArray(S.home.furnitureSold)) S.home.furnitureSold = [];
  return S.home.furnitureSold;
}
/* 사서 놓은 가구 목록 */
export function addedFurniture(S) {
  if (!S.home) S.home = { room: 'banjiha', furniture: {} };
  if (!Array.isArray(S.home.furnitureAdded)) S.home.furnitureAdded = [];
  return S.home.furnitureAdded;
}
export const isFurnitureSold = (S, uid) => soldFurniture(S).includes(uid);
export const addedFurnitureOf = (S, uid) => addedFurniture(S).find(f => f.uid === uid) || null;

/* 사서 재고에 있는 가구를 **방에 놓는다.** 재고가 하나 빠지고 방에 한 줄이 는다.
     itemId  `furn_<preset>` (상점 품목 id)
     pos     { x, z, rot?, y? } — 가구 자리 규약(도°)과 같다
     opt.uid 자리 이름. 안 주면 `add-<preset>-<번호>` 로 짓는다
   ⚠ **자리가 되는 자리인지는 여기서 안 본다** — 겹침·방 밖 판정은 3D 가 갖는다
     (`room_view.furnitureFit`). 여기는 「무엇이 어디에 있다」만 적는다. */
export function placeBoughtFurniture(S, itemId, pos, opt = {}) {
  const preset = presetOfFurnitureItemId(itemId);
  if (!preset) throw new Error(`[가구] 가구 품목이 아닙니다: ${itemId}`);
  const q = furnitureQuoteOf(preset);
  if (!q.ok) { const e = new Error('[가구] ' + q.reason); e.tutorialInput = true; throw e; }
  assertFurnitureAt(pos, opt);
  useStock(S, itemId, 1);                       // 없으면 던진다(까닭을 말한다)
  const list = addedFurniture(S);
  const uid = opt.uid || `add-${preset}-${list.length + 1}`;
  if (list.some(f => f.uid === uid) || uid in furnitureOverrides(S))
    throw new Error(`[가구] 이미 쓰는 자리 이름입니다: ${uid}`);
  const row = { uid, preset, x: pos.x, z: pos.z, rot: pos.rot == null ? 0 : pos.rot,
                ...(pos.y == null ? {} : { y: pos.y }) };
  list.push(row);
  return { ...row, ko: q.ko, itemId };
}

/* 이 가구 위에 얹힌 **내 물건**(화분·빈 그릇·삽수·작물 자리). 이름만 낸다.
   ⚠ 자리 이름 두 벌을 다 본다 — 추천 자리는 `slotId = "<uid>:<번호>"` 이고
     자유 좌표는 `at.onUid` 다. 하나만 보면 절반이 안 걸린다(2026-08-11 에 갈렸던 자리다). */
export function itemsOnFurniture(S, uid) {
  const pre = uid + ':';
  const hit = [];
  const look = (o, ko) => {
    if (!o) return;
    const onSlot = typeof o.slotId === 'string' && o.slotId.startsWith(pre);
    const onFree = o.at && o.at.onUid === uid;
    if (onSlot || onFree) hit.push({ id: o.id || null, ko });
  };
  for (const p of (S.pots || [])) look(p, '화분');
  for (const p of (S.emptyPots || [])) look(p, '빈 그릇');
  for (const c of (S.cuttings || [])) look(c, '삽수');
  if (S.firstPlay && S.firstPlay.enabled) for (const site of cropSites(S.firstPlay)) look(site, '작물 자리');
  return hit;
}

/* 팔 수 있나. **상태를 안 바꾼다** — 화면이 단추를 회색으로 만들 때도, 실제로 팔기
   직전에도 같은 함수를 본다(`canSwapPot` 과 같은 규약).
     opt.preset  프리셋 이름 ★필수 (사서 놓은 가구면 안 줘도 된다 — 목록이 안다)
     opt.riders  이 가구가 받치고 있는 것들의 uid ★필수 (`roomView.ridersOf(uid)`)
     opt.fixed   방이 못 박았나
     opt.sizeM   방이 크기를 덮어썼으면 그 크기
   반환 { ok, reason, uid, preset, ko, won, listWon, buyWon, riders, on, added } */
export function furnitureSellQuote(S, uid, opt = {}) {
  if (!uid || typeof uid !== 'string') throw new TypeError('[가구] 가구 uid 가 필요합니다');
  const added = addedFurnitureOf(S, uid);
  const preset = opt.preset || (added && added.preset) || null;
  if (!preset)
    throw new Error(`[가구] ${uid} 가 무슨 가구인지 모릅니다 — opt.preset 을 주세요 ` +
                    '(roomView.furniture() 의 preset 이 그 값입니다)');
  if (!Array.isArray(opt.riders))
    throw new Error('[가구] opt.riders 를 주세요 — 「이 가구가 무엇을 받치고 있나」는 3D 기하라 ' +
                    '코어가 지어내지 않습니다 (roomView.ridersOf(uid) 를 그대로 넘기세요)');

  const q = furnitureQuoteOf(preset, { sizeM: opt.sizeM });
  const base = { uid, preset, ko: q.ko, added: !!added,
                 listWon: q.listWon ?? null, buyWon: q.buyWon ?? null, won: q.resaleWon ?? null,
                 riders: [...opt.riders], on: itemsOnFurniture(S, uid) };
  if (isFurnitureSold(S, uid))
    return { ...base, ok: false, reason: `${q.ko}은(는) 이미 팔았습니다` };
  if (!q.ok) return { ...base, ok: false, reason: q.reason };
  if (opt.fixed === true)
    return { ...base, ok: false, reason: `${q.ko}은(는) 이 방에 붙박이라 팔 수 없습니다` };
  if (base.on.length) {
    const what = [...new Set(base.on.map(o => o.ko))].join('·');
    return { ...base, ok: false,
             reason: `${q.ko} 위에 ${what}이(가) 올라가 있습니다 (${base.on.length}개) — ` +
                     '먼저 내려놓고 나서 팔아 주세요' };
  }
  if (base.riders.length)
    return { ...base, ok: false,
             reason: `${q.ko} 위에 다른 가구가 올라가 있습니다 (${base.riders.length}개) — ` +
                     '위에 있는 것을 먼저 옮기고 나서 팔아 주세요' };
  return { ...base, ok: true, reason: null };
}

/* ★ 실제로 판다. **돈이 들어오고 가구가 방에서 없어진다.**
   ⚠ 자리표(`S.home.furniture`)에서도 걷는다 — 안 걷으면 없는 가구의 자리가 남아
     같은 uid 가 나중에 다시 서면 엉뚱한 데 선다.
   ⚠ 조립을 다시 하는 일은 여기서 안 한다(상태와 조립을 한 함수에 안 섞는다 —
     `setFurniturePlacement` 와 같은 분담). 부르는 쪽이 방을 다시 짓는다. */
export function sellFurniture(S, uid, opt = {}) {
  const q = furnitureSellQuote(S, uid, opt);
  if (!q.ok) { const e = new Error('[가구] ' + q.reason); e.tutorialInput = true; throw e; }

  if (q.added) S.home.furnitureAdded = addedFurniture(S).filter(f => f.uid !== uid);
  else soldFurniture(S).push(uid);              // 방 정의에 있던 것 — 걷어냈다고 적는다
  clearFurniturePlacement(S, uid);              // 자리표에서도 걷는다(위 ⚠)
  if (S.lamps && S.lamps.aim) delete S.lamps.aim[uid];

  const r = creditFurnitureSale(S, q.won, { ko: q.ko, log: opt.log });
  if (typeof opt.log === 'function')
    opt.log(`🪑 ${q.ko}을(를) 팔았습니다 — ${q.won.toLocaleString()}원 ` +
            `(산 값 ${q.buyWon.toLocaleString()}원의 ${Math.round(q.won / q.buyWon * 100)}%)`);
  return { ...r, uid, preset: q.preset, ko: q.ko, won: q.won,
           listWon: q.listWon, buyWon: q.buyWon, wasAdded: q.added,
           /* ⚠ 방을 다시 지어야 한다 — 그 일은 화면 몫이다(위 ⚠) */
           roomNeedsRebuild: true,
           events: [{ id: 'furniture_sold', ko: `${q.ko}을(를) 팔았습니다`,
                      uid, preset: q.preset, won: q.won }] };
}

/* ---- 등 겨누기 표 (S.lamps.aim) — 2026-08-06 ----
   ★ 옛 세이브에는 이 칸이 없다. 없으면 만들어 주되 **비운 채로** 만든다 = 안 겨눔. */
export function lampAims(S) {
  if (!S.lamps) S.lamps = { count: 0, litHours: 12, aim: {} };
  if (!S.lamps.aim) S.lamps.aim = {};
  return S.lamps.aim;
}

/* 플레이어가 등을 겨눈 것을 세이브에 적는다. **범위 검사는 여기서 안 한다** —
   무엇이 얼마나 도는지는 프리셋과 조립된 rig 가 알고, 그건 light_adapter.setLampAim 이 본다.
   상태는 "무엇을 골랐나"만 적는다(가구 자리표와 같은 분담). */
export function setLampAim(S, uid, aim) {
  if (!uid || typeof uid !== 'string') throw new TypeError('[겨누기] 등 uid 가 필요합니다');
  /* ⚠ `Number(x) || 0` 로 쓰면 NaN 이 0 으로 삼켜져 아래 검사가 영영 안 걸린다.
     안 준 것만 0 이고, 준 것이 숫자가 아니면 던진다. */
  const ry = aim == null ? null : aim.yaw, rt = aim == null ? null : aim.tilt;
  const yaw = ry == null ? 0 : Number(ry), tilt = rt == null ? 0 : Number(rt);
  if (!Number.isFinite(yaw) || !Number.isFinite(tilt))
    throw new TypeError(`[겨누기] ${uid}: yaw·tilt 는 유한한 숫자여야 합니다 (${ry}, ${rt})`);
  const tbl = lampAims(S);
  tbl[uid] = { yaw, tilt };
  return tbl[uid];
}

export function clearLampAim(S, uid) {
  const tbl = lampAims(S);
  const had = uid in tbl;
  delete tbl[uid];
  return had;
}

export function pushLog(S, msg) {
  S.log.push({ day: S.day, msg });
  if (S.log.length > 200) S.log.shift();
  return msg;
}
