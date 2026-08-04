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
         CROP_SITE_IDS, cropKindOf, cropSites, cropSiteOf } from './first_play.js';
import { createTutorialState } from './tutorial.js';
import { createShopState, useStock } from './shop.js';
import { atFromSlot, isFreeSlotId, makeAt, resolvePlacement,
         inRoom, assertFurnitureAt } from './place.js';

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

    /* 모드. seasonK/weatherK 는 '중간 난이도'가 생길 때 쓸 자리다(null = 모드 기본). */
    sim: { mode: opt.mode || 'real', seed: 0, weatherK: null, seasonK: null },

    /* ★ 가구 덮어쓰기 표 (2026-08-03) — `{ <uid>: {x, z, rot} }`
       **플레이어가 옮긴 가구만** 담는다. 비어 있으면 data/house_rooms.json 의 기본값이다.
       그 파일은 house 소유라 게임이 못 건드린다 — 그래서 '차이'만 세이브에 남긴다.
       조립 때 메모리 사본에 얹는 일은 light_adapter.build 가 한다(파일은 안 바뀐다). */
    home: { room: opt.room || 'banjiha', furniture: {} },

    /* 식물등 — 방에 이미 놓인 grow 기구를 앞에서부터 n개 켠다.
       개수·PPFD·와트를 코어가 지어내지 않는다(house의 lightRigs + lighting_presets). */
    lamps: { count: 0, litHours: 12 },

    /* ★ 화분 — **비어 있게 시작한다** (2026-08-02).
       몬스테라는 플레이어가 처음부터 키운 게 아니라 **이미 싹이 튼 개체가 도착**하는 것이다.
       앱을 열었다고 Day 0부터 식물이 있으면 안 된다 — 도착 이벤트(Day 4 선물, 이번 범위 밖)나
       테스트 초기화 경계(givePlant)가 만들 때 생긴다. v0는 1개 (growth가 한 그루 전용). */
    pots: [],

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
       ★첫 콩나물 시루는 **공짜로 준 것**이라 재고에 안 들어간다. 그 뒤부터 주문이다. */
    shop: createShopState(),

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

    /* 경제는 3단계다. 표시만 하고 차감하지 않는다. */
    ledger: { today: { in: 0, out: 0 }, total: 0, electricityWon: 0 },

    log: []
  };
}

export function pot0(S) { return S.pots[0] || null; }
export function hasPlant(S) { return S.pots.length > 0; }

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
    arrivedOnDay: S.day,
    arrivalGrowthDays: growthDays
  };
  S.pots.push(pot);
  pushLog(S, `🪴 몬스테라가 도착했습니다 — 이미 ${growthDays}일 자란 개체입니다`);
  return pot;
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
  const filled = [], skipped = [];
  const fill = (o, id) => {
    if (!o || o.at) return;
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
  /* ★ 2026-08-05 — 작물 자리가 **종류마다 하나**가 됐다(first_play §작물 자리). 전부 채운다 */
  if (fp && fp.enabled)
    for (const site of cropSites(fp))
      if (site.slotId) fill(site, CROP_SITE_IDS[site.kind || 'beansprout'] || BEANSPROUT_ID);
  /* 몬스테라 쪽은 **사본**이라 값만 맞춰 둔다(정본은 위 S.pots 가 이미 채웠다) */
  if (fp && fp.enabled && fp.monstera && fp.monstera.arrived && fp.monstera.slotId)
    fill(fp.monstera, (pot0(S) && pot0(S).id) || 'monstera');

  return { filled, skipped };
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
  if (S.firstPlay && S.firstPlay.enabled)
    for (const b of cropSites(S.firstPlay))
      if (b && (b.slotId || b.at))
        out.push({ id: CROP_SITE_IDS[b.kind || 'beansprout'] || BEANSPROUT_ID,
                   slotId: b.slotId, at: b.at || null,
                   plantId: null, variegated: false, crop: true, crop_kind: b.kind || 'beansprout' });
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
  const r = placeCrop(fp, kindId, at, { ...opt, day: S.day });
  const site = cropSiteOf(fp, kindId);
  return { cropId: CROP_SITE_IDS[kindId], kind: kindId,
           slotId: site.slotId, at: site.at,
           snappedTo: r.snappedTo, dist: r.dist, moved: r.moved, keptDays: r.keptDays };
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
  if (!site.slotId) {
    const e = new Error(`[물주기] ${k.containerKo}를 먼저 방 안에 놓아 주세요`);
    e.tutorialInput = true;                 // 안내지 고장이 아니다
    throw e;
  }
  const r = waterBeansprout(fp, S.day, opt);
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
  const harvestedCount = pots.filter(p => p.harvested).length;
  if (!harvestedCount && !sirusAdded) {
    const e = new Error(`[${k.ko}] 아직 수확하지 않았습니다 — 거둔 뒤에 다시 심습니다`);
    e.tutorialInput = true;
    throw e;
  }
  /* 씨앗은 **실제로 심는 시루 수**만큼만 든다 — 자라는 중인 시루는 안 건드리므로 안 나간다 */
  const seedsUsed = harvestedCount + sirusAdded;

  /* ★ 재고부터 뺀다. resowBeansprout 은 이력을 비우므로 되돌릴 수 없다 —
     "심어 놓고 씨앗이 없어서 실패"가 나면 그 회전이 통째로 사라진다. */
  if (sirusAdded > 0) useStock(S, k.containerItemId, sirusAdded);
  useStock(S, k.seedItemId, seedsUsed);            // 용기 하나에 씨앗 한 봉지

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

/* 추천 자리에 놓는다(예전 경로). 좌표까지 같이 세운다. */
export function setPotSlot(S, potOrId, slotId, slots) {
  const p = typeof potOrId === 'string' ? (S.pots || []).find(x => x.id === potOrId) : potOrId;
  if (!p) throw new Error(`[배치] 모르는 화분: ${potOrId}`);
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
export function rehomePot(S, slots, log, room = null) {
  const p = pot0(S);
  if (!p) return null;
  migratePots(S, slots);                       // 옛 세이브면 여기서 좌표가 채워진다

  if (p.at) {
    const surfaces = room && room.surfaces;    // Set<uid> — 지금 방에 있는 가구
    const gone = p.at.onUid && surfaces && !surfaces.has(p.at.onUid);
    const outside = room && room.size && !inRoom(p.at, room.size);
    if (!gone && !outside) return p.slotId;
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

export function pushLog(S, msg) {
  S.log.push({ day: S.day, msg });
  if (S.log.length > 200) S.log.shift();
  return msg;
}
