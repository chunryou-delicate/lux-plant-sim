/* ============================================================
   game/first_play.js — 자취생 첫 플레이의 얇은 수직 흐름
   ------------------------------------------------------------
   정본: docs/first_play.md §1~3, docs/food_economy.md §3~4.

   이 모듈이 맡는 것은 첫 수확 한 번과 그 결과 표시뿐이다.
   월세·현금·상점·반복 생산은 넣지 않는다. 몬스테라 형태는 growth가 맡는다.

   ★ 자리는 화분과 **똑같은 모양**이다 (2026-08-03).
     콩나물 시루도 임의 좌표에 놓인다. 그래서 여기서 두 번째 배치 개념을 만들지 않고
     `place.js` 의 `at = {x,y,z,rotY,onUid,occIdx}` 와 불변식(resolvePlacement)을 그대로 쓴다.
       추천 자리 위 : slotId = 그 자리의 안정 id  ·  at = 그 자리 좌표
       자유 좌표    : slotId = `free:{id}`        ·  at = 그 좌표
     `slotId` 는 **계약 열쇠라 버리지 않는다** — 옛 세이브와 헤드리스 시뮬(room_profile)이 그걸로 찾는다.
============================================================ */
import { spotOf } from './place.js';

/* ============================================================
   ★★ 작물 종류 — **체감의 축** (2026-08-04 박사님 확정)
   ------------------------------------------------------------
   원문: *"5일 주기로 3천원 아끼는 걸로 하고, 다른 종류를 추가하면 추가 2000원(주기에 따라),
          그다음은 1000원(주기에 따라) 정도로 할까?"*

   ★ 체감이 걸리는 것은 **개수가 아니라 종류**다. 그 근거는 이미 문서에 있다 —
     `docs/food_economy.md` §4 는 끼니 상한의 이유를 *"질림·영양"* 이라고 적어 뒀는데,
     질리는 것은 **같은 것을 계속 먹는 것**이다. 그러니 콩나물 시루를 열 개 놓는 것이 아니라
     **다른 작물을 들이는 것**에만 값이 붙어야 그 이유와 셈이 같은 말을 한다.

   ⇒ 그래서 규칙이 이렇게 갈린다:
       같은 종류 시루를 늘린다  → 절감은 **안 는다** (씨앗값만 더 나간다 = 질려서 못 먹는다)
       다른 종류를 들인다       → 3,000 → +2,000 → +1,000 (순번마다 체감)

   ★ 지금 작물은 콩나물 하나뿐이다. 2종·3종은 **자리만** 만들어 둔다 —
     쓰지 않는 값을 지어내지 않는다. 작물이 생기면 이 배열에 한 줄 붙이면 그대로 흐른다.
============================================================ */
export const CROP_KINDS = Object.freeze([
  Object.freeze({ id: 'beansprout', ko: '콩나물' })
  /* 2종·3종 자리 — 작물이 생기면 여기에 붙인다. cropKindSavedWon 의 2·3번째 값이 따라온다. */
]);

/* 작물 품질표는 아직 plan JSON에 없다(docs/first_play.md §3의 "구현 없음").
   이번 얇은 통합에서는 이 모듈 한 곳만 임시 계약으로 가지며 UI·루프에는 숫자를 복제하지 않는다. */
export const FIRST_PLAY_RULES = Object.freeze({
  /* ★ 자라는 날 4 → **5일** (2026-08-04). 박사님 "5일 주기"를 **재배 기간**으로 읽었다.
     ① 현실이 4~7일(보통 5일)이라 5 자체가 타당하다.
     ② "주기에 따라"라는 말이 2종·3종에도 붙는다 — 절감이 **그 작물의 한 주기가 내는 값**이라는 뜻이다.
        "5일마다 3,000원"으로 읽으면 회전 4일 · 절감 5일이라 시계가 둘이 되고, 주기가 무엇이든
        5일마다 들어오므로 "주기에 따라"가 아무 일도 안 한다.
     ③ ★ 물주기와 맞물린다. 물을 빼먹으면 회전이 6일·7일로 늘어 하루평균이 저절로 내려간다.
        "5일마다 3,000원"으로 읽으면 물을 안 줘도 5일마다 들어와 물주기가 경제에 안 걸린다.
     ⚠ 그래서 **자라는 날 = 물을 준 날 5일**이다. 달력 5일이 아니다(아래 §물주기). */
  harvestDays: 5,
  /* ★ 씨앗값 — 시루 하나를 다시 심을 때마다 든다 (docs/food_economy.md §3).
     ★★ 1,500 → **1,000원** (2026-08-04 박사님 확정). 근거 둘:
       ① 현실이 그렇다. 나물콩 1시루분 실제 시세가 **700~1,200원**이라 1,000원이 그 한가운데다.
          1,500원은 시세 위끝을 넘는 값이었다.
       ② 1,500원이면 씨앗값이 절감의 **70%**를 먹어 순액이 하루 180원(지출의 0.9%)뿐이었다.
          "콩나물을 돌릴 이유"가 산수로 거의 안 남는다.
     ⚠ 이 값만 `characters.json._meta` 가 아니라 여기 있다. 그 파일은 이 창 소유가 아니라
       못 고쳤다 — plan 에 `seedWonPerSiru` 를 _meta 로 옮겨 달라고 요청해 뒀다(보고 ⑤).
     ★ 그래도 **공짜는 아니다.** 재파종이 돈을 쓰는 행동이라야 회전이 선택이 된다. */
  seedWonPerSiru: 1_000,
  /* ★★ 종류 순번별 **한 회전(=harvestDays)이 내는 절감액**. 박사님 확정값 그대로다.
     ⚠ 이 셋도 `data/balance/` 가 아니라 여기 있다 — 그 폴더는 이 창 소유가 아니다.
       plan 에 `characters.json._meta.cropKindSavedWon` 으로 옮겨 달라고 요청한다(보고 ⑤).
     ★ 배열 길이가 곧 "몇 종까지 값이 붙나"다. 4종째부터는 0 — 질려서 더는 못 먹는다. */
  cropKindSavedWon: Object.freeze([3_000, 2_000, 1_000]),
  /* 품질 배수의 분모. 최상 품질(3끼)이 그 종류의 기본값을 그대로 낸다.
     ★ 끼니는 **품질 라벨로 남는다** — "하얗고 아삭 3끼"라는 말이 절감액보다 눈에 잘 들어온다.
       값은 원으로 매기되 비율은 예전 그대로다(3 : 2 : 1 = 3,000 : 2,000 : 1,000원). */
  qualityMaxMeals: 3,
  quality: Object.freeze([
    Object.freeze({ maxDli: 0.3, id: 'crisp_white', ko: '하얗고 아삭', meals: 3 }),
    Object.freeze({ maxDli: 1.0, id: 'slightly_green', ko: '살짝 초록', meals: 2 }),
    Object.freeze({ maxDli: Infinity, id: 'green_bitter', ko: '초록·쓴맛', meals: 1 })
  ])
});

export const FIRST_PLAY_ASSETS = Object.freeze({
  monsteraPotDiameterM: 0.202
});

/* ★ 자유 좌표일 때 계약 열쇠에 붙는 이름 (2026-08-03).
   콩나물 시루는 S.pots 에 없는 물건이라 화분 id 를 빌려 쓸 수 없다 — 자기 이름을 갖는다.
   `free:crop_01` 이 그대로 하루치 계약(daily_light/1)의 slotId 가 되고 세이브에도 남는다. */
export const BEANSPROUT_ID = 'crop_01';
/* 몬스테라는 **자기 화분이 있다**(S.pots[0]). 그 화분 id 가 정본이고 여기 값은 기본값일 뿐이다 —
   state.givePlant 의 `opt.id || 'pot_01'` 과 같은 값이다. 좌표를 직접 넘길 때만 쓰인다. */
export const MONSTERA_POT_ID = 'pot_01';

/* ★ 완료는 **정확히 이 단계에서만** 인정한다 (2026-08-02 정정).
   뒤 단계를 함께 통과시키면 "말린 새순을 봤다"가 아니라 "언젠가 지나갔다"가 된다 —
   중간에 화면을 못 본 회차도 성공으로 처리되어 첫 학습의 증거가 사라진다.
   단계 이름·경계는 growth 소유다. 코어는 이 열쇠 하나만 안다. */
export const FIRST_PLAY_COMPLETE_PHASE_ID = 'spear_furled';

/* 물리적으로 올라가는 자리인가 — ★ maxPotD 가 **숫자로 확인된** 슬롯만 허용한다.
   `maxPotD == null` 을 통과시키면 치수를 모르는 자리에 화분이 올라간다(조용한 폴백). */
export function slotFitsDiameter(slot, diameterM) {
  if (!slot || !Number.isFinite(diameterM)) return false;
  return Number.isFinite(slot.maxPotD) && slot.maxPotD >= diameterM;
}

/* leaf 정본의 열린 시루를 이름이 아니라 상태로 찾는다. blocks_light는 "차광 기능 보유"이고
   실제 적용 여부는 leaf-to-house 계약대로 lid_state가 closed일 때다. 첫 플레이는 open만 허용한다. */
export function openSiruContractFromManifest(manifest) {
  const items = Array.isArray(manifest) ? manifest : manifest && manifest.items;
  const item = items && items.find(v => v && v.kind === 'siru' && v.crop === 'beansprout' &&
    v.lid_state === 'open' && v.source_2d && v.size_m);
  if (!item || !item.size_m || !Number.isFinite(item.size_m.w) || !Number.isFinite(item.size_m.d) || !item.source_2d)
    throw new Error('[첫 플레이] 열린 콩나물 시루 에셋 계약이 올바르지 않습니다');
  return Object.freeze({
    id: item.id,
    lidState: item.lid_state,
    diameterM: Math.max(item.size_m.w, item.size_m.d),
    thumbnail: `./assets/crops/thumbs/${item.source_2d}`,
    transmitsSlotDli: item.lid_state === 'open'
  });
}

/* ★ 한 회전이 내는 절감액 — **품질이 배수를 정한다** (2026-08-04).
   자리(빛)가 품질을 정하고 품질이 값을 정한다. 그 사슬은 예전 그대로이고, 끝만 끼니에서 원으로 바뀌었다.
     colspan  종류 순번(0 = 첫 작물). CROP_KINDS 의 자리와 같다.
     meals    품질표가 낸 끼니(3·2·1) — 여기서는 **배수**로만 쓴다 */
export function cropCycleSavedWon(rules, meals, kindIndex = 0) {
  const table = rules.cropKindSavedWon || FIRST_PLAY_RULES.cropKindSavedWon;
  const base = table[kindIndex] ?? 0;
  const maxMeals = rules.qualityMaxMeals || FIRST_PLAY_RULES.qualityMaxMeals;
  return Math.round(base * Math.max(0, meals) / maxMeals);
}

/* 경제값의 정본은 data/balance/characters.json._meta다. 코어는 그 값을 받아 1끼 값을
   유도할 뿐 복제하지 않는다. 잘못된 JSON은 기본값으로 굴리지 않고 시작 전에 중단한다.
   ★ 2026-08-04 — 절감은 이제 **원**으로 매긴다(위 §작물 종류). 그래도 이 검증은 그대로 둔다:
     `dailyFoodWon`·`mealWon` 은 살림(하루 식비 표시)과 튜토리얼 지출이 계속 쓰고,
     `dailyCropMealCap` 은 **품질 라벨의 끼니**와 같은 축이라 정본이 살아 있어야 한다. */
export function firstPlayRulesFromBalance(balance) {
  const meta = balance && balance._meta;
  const dailyFoodWon = meta && meta.dailyFoodPerPerson;
  const dailyCropMealCap = meta && meta.cropMealCapPerPerson;
  const mealsPerDay = meta && meta.mealsPerDayPerPerson;
  if (![dailyFoodWon, dailyCropMealCap, mealsPerDay].every(Number.isFinite) ||
      dailyFoodWon <= 0 || dailyCropMealCap < 0 || mealsPerDay <= 0 || dailyFoodWon % mealsPerDay !== 0)
    throw new Error('[첫 플레이] characters.json의 식비·끼니 계약이 올바르지 않습니다');
  /* ★ 지금 실제로 도는 종류만 센다 — 배열에 값이 셋 있어도 작물이 하나면 첫 값 하나뿐이다.
     쓰지 않는 값을 합계에 넣으면 "있지도 않은 작물이 아껴 주는" 살림이 된다. */
  const kinds = CROP_KINDS.length;
  const cropSavedWonPerCycle = FIRST_PLAY_RULES.cropKindSavedWon
    .slice(0, kinds).reduce((a, b) => a + b, 0);
  return Object.freeze({
    ...FIRST_PLAY_RULES,
    dailyFoodWon,
    mealWon: dailyFoodWon / mealsPerDay,
    dailyCropMealCap,
    /* ★ 지금 도는 작물 전부가 **한 회전에** 내는 절감 합계(최상 품질 기준). 곳간 한도이기도 하다 —
       한 회전분보다 많이 쌓일 수 없다(그 이상은 쉬어서 버린다. 콩나물은 냉장 3~4일이다). */
    cropSavedWonPerCycle,
    /* 하루에 곳간에서 꺼내 쓸 수 있는 상한. 한 회전분을 회전 일수로 고르게 나눈 값이다 —
       ★ 이것이 예전의 "하루 2끼 상한"을 대신한다. 종류 체감이 이미 총량을 막으므로
         상한은 "몰아 쓰지 않게" 고르게 펴는 일만 한다. */
    dailyCropSaveWon: Math.round(cropSavedWonPerCycle / FIRST_PLAY_RULES.harvestDays),
    cropKinds: kinds
  });
}

export function createFirstPlayState(opt = {}) {
  const enabled = !!opt.enabled;
  const rules = opt.rules || null;
  if (enabled && !rules) throw new Error('[첫 플레이] 밸런스 계약 없이 시작할 수 없습니다');
  return {
    enabled,
    rules,
    phase: 'place_beansprout',
    completed: false,
    beansprout: {
      /* slotId = 계약 열쇠 · at = 좌표 정본. 화분(S.pots[])과 같은 두 칸이다. */
      slotId: null,
      at: null,
      ageDays: 0,
      harvestDays: rules ? rules.harvestDays : 0,
      dliHist: [],
      harvested: false,
      quality: null,
      meals: 0,
      avgDli: null,
      /* ★ 시루는 **하나가 아니다** (2026-08-03 · 반복 수입).
         `sirus` 는 같은 자리에서 함께 도는 시루 수다.
         ⚠ 2026-08-04 정정 — **같은 종류를 늘려도 절감은 안 는다**(위 §작물 종류).
           칸을 없애지 않은 이유는 둘이다: ① 시루는 여전히 **자리를 차지하고 씨앗을 먹는다**
           (늘리면 손해가 눈에 보인다) ② 작물 종류가 늘면 종류마다 시루가 필요하다.
           즉 시루는 "많이 먹는 장치"에서 **"한 종류를 담는 그릇"** 으로 뜻이 바뀌었다. */
      sirus: 1,
      cycle: 1,              // 몇 번째 회전인가 (재파종할 때마다 오른다)
      harvestCount: 0,       // 지금까지 몇 번 수확했나 — 첫 수확과 그 뒤를 가르는 열쇠
      harvestMeals: 0,       // 직전 수확의 품질 끼니 라벨 (표시용)
      /* ★★ 물주기 (2026-08-04) — 아래 §물주기 참고.
         `wateredOnDay` 는 **게임일**이다(상대 일수가 아니다). 세이브에 그대로 남아
         복원 뒤에도 "오늘 줬나"가 맞는다. null = 아직 한 번도 안 줬다. */
      wateredOnDay: null,
      dryDays: 0,            // 이번 회전에서 물을 빼먹은 날 (누적)
      dryRun: 0              // 지금 연속 며칠째 빼먹고 있나 (0 = 어제 줬다)
    },
    food: {
      /* ★ 곳간은 **원**으로 센다 (2026-08-04). 예전에는 끼니였는데, 한 회전 절감이
         3,000원이라 1끼(2,500원) 단위로는 안 떨어진다. 끼니는 품질 라벨로만 남는다. */
      pantryWon: 0,
      lastHarvestMeals: 0,   // 직전 수확의 품질 끼니 라벨 (표시용)
      lastFoodSavedWon: 0,
      totalFoodSavedWon: 0,
      cashFoodWon: rules ? rules.dailyFoodWon : 0,
      /* 못 먹고 쉬어 버린 몫. 팔지 않는다 — 콩나물은 지출 방어이지 수입이 아니다
         (docs/food_economy.md 머리말). 한 회전분보다 많이 쌓이면 여기로 빠진다. */
      lastSpoiledWon: 0
    },
    monstera: {
      arrived: false,
      /* ★ 정본은 **화분 쪽**(S.pots[0].slotId · .at)이다. 여기 둘은 첫 플레이 화면이 보는 사본이다 —
         튜토리얼 안내가 화분 배열을 뒤지지 않게 두려고 남긴다. 판정에는 쓰지 않는다. */
      slotId: null,
      at: null,
      growthPhase: null
    }
  };
}

/* ★ 수확 전이면 언제든 옮길 수 있다 (2026-08-02 정정).
   예전엔 하루라도 자라면 잠갔는데, 그 자리의 조도 계약이 깨지면 **고칠 방법이 사라졌다** —
   매일 예외만 나고 시루는 못 옮기는 막다른 길이 됐다. 옮겨도 **과거 DLI 이력은 그대로 둔다**:
   이력은 "이 콩나물이 실제로 받은 빛"이라 자리를 바꿨다고 없던 일이 되지 않는다.
   수확 뒤에는 결과가 이미 확정됐으므로 막는다.

   ★ 좌표도 받는다 (2026-08-03). 셋 다 같은 함수다 — 기존 호출부(문자열)는 안 깨진다.
       placeBeansprout(fp, 'banjiha-desk:1')                              추천 자리 이름
       placeBeansprout(fp, {x,y,z,onUid,occIdx}, { size, slots, snapDist }) 임의 좌표
       placeBeansprout(fp, { slotId, at })                                이미 자리를 가진 물건
     opt.slots 를 같이 주면 이름으로 놓아도 좌표까지 세워진다(자유 좌표와 같은 정본을 갖는다).
   ★ opt.day 를 주면 **그날 물을 준 것으로 친다** (2026-08-04). 심을 때 물을 붓는 것이
     현실이고, 그래야 "놓자마자 마른 날"이 안 생긴다. 안 주면 물 상태를 손대지 않는다. */
export function placeBeansprout(fp, target, opt = {}) {
  if (!fp || !fp.beansprout) throw new Error('[첫 플레이] 콩나물 상태가 없습니다');
  if (target == null || target === '')
    throw new Error('[첫 플레이] 콩나물을 둘 자리를 골라 주세요');
  if (fp.beansprout.harvested)
    throw new Error('[첫 플레이] 이미 수확한 첫 시루는 옮길 수 없습니다');

  const spot = spotOf(target, { id: BEANSPROUT_ID, ...opt });
  const moved = fp.beansprout.slotId != null && fp.beansprout.slotId !== spot.slotId;
  if (Number.isInteger(opt.day)) waterBeansprout(fp, opt.day);
  fp.beansprout.slotId = spot.slotId;
  /* 좌표를 못 세운 경우(얇은 슬롯 · 좌표 없는 헤드리스 표)는 **null 로 남긴다.** 지어내면
     그 시루만 방 한가운데로 순간이동한다 — 그때는 예전처럼 slotId 로 돈다. */
  fp.beansprout.at = spot.at;
  fp.phase = 'grow_beansprout';
  return { ...fp.beansprout, moved, keptDays: fp.beansprout.dliHist.length,
           snappedTo: spot.snappedTo, dist: spot.dist };
}

function validDli(dli) {
  return typeof dli === 'number' && Number.isFinite(dli) && dli >= 0;
}

/* ★ 자유 좌표여도 **찾는 법은 그대로 slotId 다** (2026-08-03).
   좌표로 옮긴 시루는 계약에 `free:crop_01` 이라는 이름으로 실린다(light_adapter.slotsFor).
   그래서 여기서 좌표를 다시 재지 않는다 — 계약이 낸 값과 코어가 따로 낸 값이 갈리면
   "화면의 밝기"와 "판정에 쓴 밝기"가 달라진다. 계약 한 곳만 본다.
   ref 는 slotId 문자열이거나 콩나물 상태 객체({slotId})다. */
export function cropDliFromReport(report, ref) {
  const slotId = (ref && typeof ref === 'object') ? ref.slotId : ref;
  if (!slotId) throw new Error('[첫 플레이] 콩나물 자리가 정해지지 않았습니다');
  const slot = ((report && report.slots) || []).find(s => s && s.slotId === slotId);
  if (!slot) throw new Error(`[첫 플레이] 콩나물 자리 ${slotId}가 오늘 조도 계약에 없습니다` +
    (String(slotId).startsWith('free:')
      ? ' — 자유 좌표 시루는 state.placedItems(S) 를 거쳐 계약에 실립니다. ' +
        '정적 방 프로파일(room_profile)에는 임의 좌표 표가 없어 실리지 않습니다'
      : ''));
  if (!validDli(slot.dli))
    throw new Error(`[첫 플레이] 콩나물 자리의 DLI를 쓸 수 없습니다: ${slot.dli}`);
  return slot.dli;
}

/* ============================================================
   ★★ 물주기 — **속도 축** (2026-08-04 박사님 지시 "행위가 있어야 재미있겠지")
   ------------------------------------------------------------
   ★ 축을 겹치지 않는다. 이 게임이 가르치는 것은 빛이다.
       자리(빛) = **품질**   어두우면 하얗고 아삭 · 밝으면 초록·쓴맛. 예전 그대로.
       물       = **속도**   준 날만 자란다. 빼먹으면 그날은 안 자란다.
     그래서 물은 새 축이 되되 빛과 부딪히지 않는다.

   ★★ 빼먹은 날은 **DLI 이력에도 안 쌓는다.** 이게 축 분리의 실제 구현이다 —
     안 쌓아야 "물을 안 준 것"이 품질 평균을 못 건드린다. 쌓으면 어두운 방에서 물을
     빼먹을수록 평균이 더 어두워져 **물이 품질을 올리는** 이상한 규칙이 된다.
     이력은 "이 콩나물이 **자란 날에** 받은 빛"이고, 안 자란 날은 그 콩나물의 하루가 아니다.

   ★ **죽지 않는다.** 박사님 확정 원칙("초보는 안 죽는다")을 그대로 지킨다.
     며칠을 내리 빼먹어도 시들지 않고 **늦어질 뿐**이다. 벌은 시간이고, 시간이 곧 돈이다:
     5일 회전이 7일이 되면 하루평균 절감이 600원 → 429원으로 스스로 내려간다.
     따로 벌점을 만들지 않는다 — 만들면 그것이 두 번째 벌이 되고 "안 죽는다"가 흔들린다.
     그래서 **연속으로 안 준 날에도 품질은 안 떨어진다.** 속도만 멈춘다.

   ★ **하루 한 번**이다. 현실은 하루 3~4번 헹궈 줘야 하지만(집에서 시루로 기르는 실제 방식),
     게임에서 하루에 여러 번 누르게 하면 그건 재미가 아니라 노동이다. 누르는 횟수가 아니라
     **잊지 않는 것**이 이 행위의 내용이라, 하루 한 번이면 그 내용이 다 담긴다.
     두 번 눌러도 안전하다(아래 `already`) — 실수로 두 번 눌러 하루가 두 번 가면 안 된다.

   ★ 대상은 **작물뿐이다. 몬스테라에는 안 건다.** 근거 셋:
     ① 현실이 다르다 — 시루는 하루 3~4번, 관엽은 주 1회다. 매일 축이 아니다.
     ② 몬스테라의 속도 축은 **이미 빛**이다(저광 정지). 거기에 물을 얹으면 정지 사유가 둘이 되어
        "왜 안 자라지"의 처방이 흐려진다 — loop.js 가 머리공간 정지를 빛 정지와 **다른 칸**에
        두는 것과 같은 이유다.
     ③ 몬스테라의 하루 진행은 growth 창 소유(advanceTo)다. 코어가 물로 그걸 막으면
        남의 창 규칙을 코어가 갖게 된다.
============================================================ */

/* 오늘 물을 준다. **하루 한 번**이고 두 번 눌러도 안전하다.
     fp   첫 플레이 상태
     day  게임일(S.day). 상대 일수가 아니라 절대 게임일이라 세이브 왕복에서도 맞는다
   반환 { watered, already, day, dryRun } */
export function waterBeansprout(fp, day) {
  if (!fp || !fp.beansprout) throw new Error('[첫 플레이] 콩나물 상태가 없습니다');
  if (!Number.isInteger(day) || day < 0)
    throw new Error(`[물주기] 게임일이 0 이상의 정수가 아닙니다: ${day}`);
  const b = fp.beansprout;
  if (b.harvested) {
    /* 이미 거둔 시루는 물을 줄 것이 없다. 고장이 아니라 안내다 — 던지지 않는다.
       (다시 심으면 그때부터 다시 물이 필요하다) */
    return { watered: false, already: false, harvested: true, day, dryRun: b.dryRun || 0 };
  }
  if (b.wateredOnDay === day)
    return { watered: false, already: true, day, dryRun: b.dryRun || 0 };
  b.wateredOnDay = day;
  return { watered: true, already: false, day, dryRun: b.dryRun || 0 };
}

/* ============================================================
   ★★ 수확은 **행위**다 (2026-08-04 박사님 지시)
   ------------------------------------------------------------
   원문: *"수확하기를 해야 반영되도록 하자. 자동수확은 나중에 뭐 아이템이나 아니면
          특수보상이나 업적 달성 보상으로 주도록 하고."*

   ★ 자라는 날이 차면 **거둘 수 있는 상태**가 될 뿐, 저절로 거둬지지 않는다.
     `[수확하기]` 를 눌러야(harvestBeansprout) 곳간에 들어가고 절감이 시작된다.

   ★★ **안 거둬도 따로 벌을 주지 않는다.** 물주기와 같은 사상이다 —
     안 거두면 다음 회전이 시작되지 않고, 그동안 곳간이 비어 절감이 0이다.
     **그것이 이미 벌이고, 그 벌은 시간이다.** 둘째 벌(품질 하락·시듦)을 만들면
     "초보는 안 죽는다"가 흔들린다.
     ⚠ 늦게 거둘수록 품질이 떨어지게 하고 싶어지면 **먼저 재고 근거를 대라.** 기본은 안 떨어뜨린다.
       품질은 이미 `dliHist` 로 확정돼 있고(자리=빛), 거두는 시각이 그 값을 못 바꾼다.
       바꾸게 만들면 **물이 아니라 시각이 빛 축을 건드리는** 세 번째 축이 생긴다.

   ★★ **다 자란 뒤에는 물을 안 요구한다.** 현실에서는 거두기 전까지 주지만, 게임에서는 안 준다:
     ① 물은 **속도 축**이고(§물주기) 속도가 쓸 곳이 없다 — `ageDays` 가 이미 만수라 더 올릴 데가 없다.
        아무것도 안 바꾸는 입력을 매일 요구하면 그건 규칙이 아니라 잡음이다.
     ② 효과를 만들려면 "안 주면 나빠진다"라야 하는데 그게 곧 **둘째 벌**이라 위 원칙과 부딪힌다.
     ③ 손이 두 배가 된다 — 다 자란 날에 [물 주기]와 [수확하기]가 같이 뜨면 버튼이 겹친다.
        `beansproutWaterStatus.needsWater` 가 다 자란 시루에서 false 가 되는 것이 이 결정의 구현이다.
     ⇒ 그래서 `advanceBeansproutDay` 는 **물 검사보다 먼저** 다 자람에서 선다 — 마른 날도 안 센다.

   ★ 자동수확(`S.perks.autoHarvest`)은 **나중 보상**이다. 지금은 늘 꺼져 있다(state.js §perks).
============================================================ */

/* 다 자랐나 = 거둘 수 있나. 상태를 안 바꾼다. 놓지 않았거나 이미 거둔 시루는 false 다. */
export function beansproutReady(b) {
  return !!(b && b.slotId && !b.harvested &&
            Number.isFinite(b.harvestDays) && Number.isFinite(b.ageDays) &&
            b.ageDays >= b.harvestDays);
}

/* [수확하기] 버튼을 켤지 흐리게 할지의 근거. **한글 문장은 만들지 않는다**(UI 몫). */
export function beansproutHarvestStatus(fp) {
  const b = fp && fp.beansprout;
  if (!fp || !fp.enabled || !b) return null;
  const ready = beansproutReady(b);
  return {
    ready,
    canHarvest: ready,
    placed: !!b.slotId,
    harvested: !!b.harvested,
    ageDays: b.ageDays || 0,
    harvestDays: b.harvestDays || 0,
    daysLeft: Math.max(0, (b.harvestDays || 0) - (b.ageDays || 0)),
    sirus: Math.max(1, Math.round(b.sirus || 1)),
    cycle: b.cycle || 1,
    dryDays: b.dryDays || 0
  };
}

/* 오늘 물을 줬나 · 며칠째 빼먹었나 — 화면 버튼 문구용. **한글 문장은 만들지 않는다**(UI 몫). */
export function beansproutWaterStatus(fp, day) {
  const b = fp && fp.beansprout;
  if (!fp || !fp.enabled || !b) return null;
  const wateredToday = Number.isInteger(day) && b.wateredOnDay === day;
  const ready = beansproutReady(b);
  return {
    wateredToday,
    /* 놓지 않았거나 · 이미 거뒀거나 · **다 자랐으면** 줄 것이 없다 — 버튼을 흐리게 할 근거다.
       다 자란 시루에 물을 안 받는 이유는 위 §수확 ★★ 참고(속도가 쓸 곳이 없다). */
    needsWater: !!b.slotId && !b.harvested && !ready && !wateredToday,
    ready,
    placed: !!b.slotId,
    harvested: !!b.harvested,
    wateredOnDay: b.wateredOnDay ?? null,
    dryRun: b.dryRun || 0,
    dryDays: b.dryDays || 0,
    ageDays: b.ageDays || 0,
    harvestDays: b.harvestDays || 0
  };
}

/* 하루 공개 경계. 입력을 먼저 검증하고 나서만 상태를 바꾼다.
     dli        그날 그 자리의 조도
     opt.watered  ★ 오늘 물을 줬나. loop.js 가 `wateredOnDay === 어제(진행 전 S.day)` 로 낸다.
                  안 넘기면 **준 것으로 치지 않는다** — 조용한 폴백을 만들지 않는다.
   ★ 2026-08-04 — **여기서 거두지 않는다.** 자라는 날이 차면 `ready:true` 로 서고,
     거두는 것은 `harvestBeansprout`(=[수확하기] 버튼)의 몫이다(위 §수확). */
export function advanceBeansproutDay(fp, dli, opt = {}) {
  if (!fp.beansprout.slotId) throw new Error('[첫 플레이] 콩나물 자리를 먼저 정해 주세요');
  if (!validDli(dli)) throw new Error(`[첫 플레이] 콩나물 DLI가 올바르지 않습니다: ${dli}`);
  if (fp.beansprout.harvested)
    return { harvested: false, alreadyHarvested: true };

  const rules = fp.rules;
  if (!rules) throw new Error('[첫 플레이] 밸런스 계약이 없습니다');
  const b = fp.beansprout;

  /* ★★ 이미 다 자랐다 — 하루가 지나도 **아무 일도 안 난다.** 안 거뒀다고 벌을 주지 않고,
     ★ 물도 안 센다(마른 날로 안 잡힌다). 그래서 이 줄이 물 검사보다 **먼저** 있다(위 §수확).
       뒤에 두면 다 자란 시루가 매일 마른 날을 쌓아 "거두기 전까지 물을 줘야" 하게 된다. */
  if (b.ageDays >= rules.harvestDays) {
    return {
      harvested: false, ready: true, justReady: false, dry: false,
      ageDays: b.ageDays, daysLeft: 0,
      dryRun: b.dryRun || 0, dryDays: b.dryDays || 0
    };
  }

  /* ★ 물을 안 준 날 — **하루도 안 자란다. 이력도 안 쌓는다.** 죽지도 않는다(위 §물주기). */
  if (!opt.watered) {
    b.dryDays = (b.dryDays || 0) + 1;
    b.dryRun = (b.dryRun || 0) + 1;
    return {
      harvested: false, ready: false, dry: true,
      ageDays: b.ageDays, daysLeft: rules.harvestDays - b.ageDays,
      dryRun: b.dryRun, dryDays: b.dryDays
    };
  }
  b.dryRun = 0;

  b.ageDays++;
  b.dliHist.push(dli);

  return {
    harvested: false,
    dry: false,
    /* ★ 오늘 다 자랐나 · 오늘 **막** 다 자랐나 — 둘을 가른다.
       빨리감기가 서는 것은 `justReady`(전환) 쪽이다. `ready` 로 세우면 안 거둔 채로
       다시 감을 때마다 첫날에 또 서서 빨리감기가 못 돈다. */
    ready: b.ageDays >= rules.harvestDays,
    justReady: b.ageDays === rules.harvestDays,
    ageDays: b.ageDays,
    daysLeft: Math.max(0, rules.harvestDays - b.ageDays)
  };
}

/* ★★ 거둔다 — **[수확하기] 버튼이 부르는 함수** (2026-08-04 신설. 위 §수확).
   ------------------------------------------------------------
   예전에는 `advanceBeansproutDay` 안에서 자동으로 일어났다. 이제는 손 동작이다.
   ⚠ 몬스테라 선물은 여기 없다 — 그건 `io.growth` 를 쓰므로 loop.harvestCrop 이 맡는다.
     여기서는 `phase = 'monstera_gift'` 로 **문만 연다**(예전과 같은 자리다).
   반환은 예전 `advanceBeansproutDay` 의 수확 반환과 **같은 모양**이다 — 화면·재현이 안 깨진다. */
export function harvestBeansprout(fp) {
  if (!fp || !fp.beansprout) throw new Error('[수확] 콩나물 상태가 없습니다');
  const b = fp.beansprout;
  const rules = fp.rules;
  if (!rules) throw new Error('[수확] 밸런스 계약이 없습니다');
  if (!b.slotId) {
    const e = new Error('[수확] 시루를 먼저 방 안에 놓아 주세요');
    e.tutorialInput = true; throw e;
  }
  if (b.harvested) {
    const e = new Error('[수확] 이미 거둔 시루입니다 — 다시 심어야 또 거둡니다');
    e.tutorialInput = true; throw e;
  }
  if (b.ageDays < rules.harvestDays) {
    const e = new Error(`[수확] 아직 ${rules.harvestDays - b.ageDays}일 더 자라야 합니다 ` +
                        `(${b.ageDays}/${rules.harvestDays}일)`);
    e.tutorialInput = true;                 // 안내지 고장이 아니다
    throw e;
  }

  const hist = b.dliHist;
  const avgDli = hist.reduce((sum, v) => sum + v, 0) / hist.length;
  const quality = rules.quality.find(q => avgDli <= q.maxDli);
  /* ★★ 시루 수를 **곱하지 않는다** (2026-08-04). 같은 콩나물을 두 시루 심어도 두 배로 먹지
     않는다 — 질리는 것이 상한의 이유이기 때문이다(위 §작물 종류 · food_economy.md §4).
     예전에는 `quality.meals × sirus` 였고, 그래서 시루 3개가 하루평균을 2.25배로 올렸다.
     이제 늘어나는 것은 **씨앗값뿐**이라 시루를 늘리면 손해가 그대로 보인다. */
  const sirus = Math.max(1, Math.round(b.sirus || 1));
  /* 한 회전이 내는 절감. 종류 순번 0 = 콩나물(지금은 이것뿐이다). */
  const cycleSavedWon = cropCycleSavedWon(rules, quality.meals, 0);

  /* ★ 곳간에 넣고 **매일 조금씩** 꺼내 먹는다(eatFromPantry). 수확한 날 몰아 쓰지 않는다 —
     한 회전분을 회전 일수로 나눠 먹는 것이 "5일 주기로 3,000원"의 실제 모양이다.
     ★ 남는 것은 **버려진다. 팔지 않는다.** 콩나물은 냉장 3~4일이면 쉬는 채소라 쌓이지 않는다
       (docs/food_economy.md 머리말 — 지출 방어이지 수입이 아니다).
       한도는 **한 회전분**이다: 그보다 많이 쌓였다는 것은 지난 회전을 다 못 먹었다는 뜻이다. */
  let pantry = (fp.food.pantryWon || 0) + cycleSavedWon;
  const capWon = rules.cropSavedWonPerCycle;
  const spoiledWon = Math.max(0, pantry - capWon);
  pantry -= spoiledWon;

  b.harvested = true;
  b.avgDli = avgDli;
  b.quality = quality.id;
  b.meals = quality.meals;                        // ★ 품질 **라벨**(3·2·1끼). 값은 원으로 매긴다
  b.harvestMeals = quality.meals;
  b.harvestCount = (b.harvestCount || 0) + 1;
  /* 다음 회전을 위해 물 상태를 비운다 — 거둔 시루에 물을 주는 일은 없다 */
  b.wateredOnDay = null;
  fp.food.lastHarvestMeals = quality.meals;
  fp.food.pantryWon = pantry;
  fp.food.lastSpoiledWon = spoiledWon;
  /* ★ 여기서 **먹지 않는다.** 곳간에 넣기만 하고, 꺼내 먹는 것은 다음 [다음 날] 의 eatFromPantry 다
     (2026-08-04 정정 — 수확이 손 동작이 되면서 거두는 순간과 하루 정산이 갈렸다).
     ⚠ 여기서 한 입 꺼내면 **하루에 두 번 먹는 날**이 생긴다: 다 자란 날의 [다음 날] 이
       지난 회전의 마지막 600원을 이미 꺼낸 뒤라, 같은 날 또 꺼내면 하루 1,200원이 된다.
       "하루 상한 600원"이 그 자리에서 깨진다. 먹는 것은 살림이고 살림은 하루에 한 번이다. */
  /* ★ 선물은 **첫 수확에만** 온다. 두 번째 시루에서 몬스테라가 또 오면 안 된다. */
  if (!fp.monstera.arrived) fp.phase = 'monstera_gift';

  return {
    harvested: true,
    dry: false,
    avgDli,
    quality: quality.id,
    qualityKo: quality.ko,
    meals: quality.meals,
    sirus,
    /* ★ 시루를 늘려도 안 늘어난 몫. 화면이 "두 시루째는 질려서 못 먹습니다"를 말할 근거다. */
    wastedSirus: sirus - 1,
    cycleSavedWon,
    spoiledWon,
    cycleDays: rules.harvestDays,
    dryDays: b.dryDays || 0,
    harvestCount: b.harvestCount,
    cashFoodWon: fp.food.cashFoodWon
  };
}

/* ★ 오늘의 밥 — 곳간에서 하루치만 꺼내 쓴다 (2026-08-03 신설 · 2026-08-04 원 단위로).
   ------------------------------------------------------------
   한 회전이 낸 절감(3,000원)을 **회전 일수로 고르게 나눠** 먹는다. 하루 상한 600원이
   그 나눗셈이다(`rules.dailyCropSaveWon`). 몰아 쓰지 않는 이유는 예전과 같다 —
   "5일 주기로 3,000원"은 5일에 걸쳐 아끼는 것이지 하루에 3,000원을 아끼는 것이 아니다.

   ★ **매일** 불린다. 수확한 날도 포함이다(2026-08-04 정정) — 수확이 곳간에 넣고,
     같은 턴에 이 함수가 그날 몫을 꺼낸다. 예전처럼 수확일만 따로 계산하면 규칙이 둘이 된다.
   ★ 곳간이 비면 절감은 0이다. **물을 빼먹어 회전이 늘어지면 여기서 빈 날이 생긴다** —
     물주기의 벌이 돈으로 보이는 자리이고, 따로 만든 벌점이 아니다. */
export function eatFromPantry(fp) {
  const zero = { savedWon: 0, foodSavedWon: 0, mealsUsed: 0 };
  if (!fp || !fp.enabled || !fp.rules || !fp.food) return zero;
  const rules = fp.rules;
  const use = Math.min(rules.dailyCropSaveWon, Math.max(0, Math.round(fp.food.pantryWon || 0)));
  if (use <= 0) {
    fp.food.lastFoodSavedWon = 0;
    fp.food.cashFoodWon = rules.dailyFoodWon;
    return { ...zero, cashFoodWon: fp.food.cashFoodWon };
  }
  fp.food.pantryWon -= use;
  fp.food.lastFoodSavedWon = use;
  fp.food.totalFoodSavedWon += use;
  fp.food.cashFoodWon = rules.dailyFoodWon - use;
  return {
    savedWon: use,
    /* 옛 이름도 같이 낸다 — `noteLearning`·화면이 `foodSavedWon` 을 읽는다 */
    foodSavedWon: use,
    /* 표시용 끼니 환산(내림). 판정에는 안 쓴다 — 값의 정본은 원이다. */
    mealsUsed: Math.floor(use / rules.mealWon),
    cashFoodWon: fp.food.cashFoodWon
  };
}

/* ★ 다시 심는다 — **막다른 길을 없애는 함수** (2026-08-03 신설).
   ------------------------------------------------------------
   두 가지를 한꺼번에 푼다.
     ① **반복 수입.** 시루가 한 번뿐이면 식비 절감도 한 번뿐이라 소지금이 줄기만 한다.
     ② **막다른 길.** 배움 ②(`cropDark`)는 수확할 때의 4일평균 DLI 로 판정하는데,
        시루가 하나뿐이면 밝은 자리에서 첫 수확을 한 판은 **영영 못 나간다.**
        다시 심을 수 있으면 "다시 해 보면 배운다"가 된다 — 자동으로 채워 주지 않는다.

   ★ 씨앗값은 **호출부가 낸다.** 여기서 지갑을 만지지 않는다(코어의 살림은 tutorial.js 소유).
     `state.resowCrop(S, ...)` 이 그 둘을 한 동작으로 묶는다 — 게임 화면은 그것만 부르면 된다.
     opt.sirus     이번 회전에 돌릴 시루 수 (없으면 그대로)
     opt.maxSirus  놓을 수 있는 칸 수 (없으면 검사 안 함)
     opt.at        자리를 옮기려면. placeBeansprout 과 같은 세 가지 입력을 받는다 */
export function resowBeansprout(fp, opt = {}) {
  if (!fp || !fp.beansprout) throw new Error('[첫 플레이] 콩나물 상태가 없습니다');
  const b = fp.beansprout;
  if (!b.harvested)
    throw new Error('[콩나물] 아직 수확하지 않은 시루입니다 — 수확한 뒤에 다시 심습니다');
  const rules = fp.rules;
  if (!rules) throw new Error('[첫 플레이] 밸런스 계약이 없습니다');

  const sirus = opt.sirus == null ? Math.max(1, Math.round(b.sirus || 1)) : opt.sirus;
  if (!Number.isInteger(sirus) || sirus < 1)
    throw new Error(`[콩나물] 시루 수가 1 이상의 정수가 아닙니다: ${sirus}`);
  if (Number.isFinite(opt.maxSirus) && sirus > opt.maxSirus)
    throw new Error(`[콩나물] 시루를 놓을 칸이 ${opt.maxSirus}칸뿐입니다 — ${sirus}개는 못 놓습니다 ` +
                    `(시루 선반을 놓으면 늘어납니다)`);

  const seedCostWon = sirus * rules.seedWonPerSiru;

  /* ★ **이력을 비운다.** 지난 회전의 DLI 는 이번 콩나물이 받은 빛이 아니다 —
     남겨 두면 밝은 데서 한 번 망친 판이 어두운 데로 옮겨도 평균이 안 내려가 영영 못 배운다. */
  b.harvested = false;
  b.ageDays = 0;
  b.dliHist = [];
  b.quality = null;
  b.meals = 0;
  b.avgDli = null;
  b.harvestMeals = 0;
  b.sirus = sirus;
  b.cycle = (b.cycle || 1) + 1;
  /* ★ 물 상태도 새 회전 것으로 비운다 (2026-08-04). 안 비우면 지난 회전에 준 물이
     이번 회전 첫날을 대신 채워 하루가 공짜로 간다. `opt.day` 를 주면 **심는 날 물을 준다**
     (placeBeansprout 과 같은 규칙 — 심을 때 물을 붓는다). */
  b.dryDays = 0;
  b.dryRun = 0;
  b.wateredOnDay = null;
  if (Number.isInteger(opt.day)) waterBeansprout(fp, opt.day);

  /* 자리를 다시 고를 수 있다 — 이게 ②(막다른 길)의 실제 해법이다.
     placeBeansprout 은 수확한 시루를 막으므로 **위에서 harvested 를 내린 뒤에** 부른다. */
  if (opt.at != null && opt.at !== '') placeBeansprout(fp, opt.at, opt);

  return { sirus, cycle: b.cycle, seedCostWon, slotId: b.slotId, at: b.at,
           wateredOnDay: b.wateredOnDay };
}

/* 콩나물과 **같은 세 가지 입력**을 받는다(이름 · 좌표 · 화분 객체).
   loop.js 는 방금 만든 화분을 통째로 넘긴다 — 화분이 정본이므로 베끼는 게 가장 안 어긋난다. */
export function markMonsteraArrived(fp, target, opt = {}) {
  if (!fp.beansprout.harvested)
    throw new Error('[첫 플레이] 콩나물을 수확하기 전에는 몬스테라가 오지 않습니다');
  if (target == null || target === '') throw new Error('[첫 플레이] 몬스테라 도착 자리가 없습니다');
  const spot = spotOf(target, { id: MONSTERA_POT_ID, ...opt });
  fp.monstera.arrived = true;
  fp.monstera.slotId = spot.slotId;
  fp.monstera.at = spot.at;
  fp.phase = 'move_monstera';
  return fp.monstera;
}

export function moveMonstera(fp, target, opt = {}) {
  if (!fp.monstera.arrived) throw new Error('[첫 플레이] 아직 몬스테라가 도착하지 않았습니다');
  if (target == null || target === '')
    throw new Error('[첫 플레이] 몬스테라를 옮길 자리를 골라 주세요');
  const spot = spotOf(target, { id: MONSTERA_POT_ID, ...opt });
  fp.monstera.slotId = spot.slotId;
  fp.monstera.at = spot.at;
  return spot.slotId;
}

/* 직전 관측보다 형태가 나아갔나 — 단계가 바뀌었거나, 같은 단계 안에서 진행이 올랐거나.
   도착 시점 값을 0으로 가정하지 않는다(첫 관측이 0%가 아닐 수도 있다) — 두 관측을 비교만 한다. */
function phaseAdvanced(prev, now) {
  if (!prev) return false;                          // 도착 직후 첫 관측은 비교 대상이 없다
  if (prev.phaseId !== now.phaseId) return true;
  return Number.isFinite(prev.progress01) && Number.isFinite(now.progress01) &&
         now.progress01 > prev.progress01;
}

/* 표시용 단계를 그대로 보관한다. ★ 한글 이름도 growth 가 낸 것을 쓴다 —
   코어가 자기 표를 들면 growth 가 단계를 늘리거나 이름을 바꿀 때 **오류 없이 틀린 라벨**이 뜬다.
   phaseKo 가 없는(옛) growth 면 키를 그대로 보여준다 — 조용히 비우지 않는다. */
export function markMonsteraPhase(fp, phase) {
  if (!fp.monstera.arrived || !phase) return fp;
  const prev = fp.monstera.growthPhase;
  fp.monstera.growthPhase = {
    phaseId: phase.phaseId,
    phaseKo: phase.phaseKo ?? phase.phaseId ?? null,
    progress01: phase.progress01,
    nextPhaseId: phase.nextPhaseId ?? null,
    nextPhaseKo: phase.nextPhaseKo ?? phase.nextPhaseId ?? null
  };
  /* ★ 형태가 실제로 오르기 시작하면 안내 단계를 넘긴다 (2026-08-02 정정).
     예전엔 move_monstera 가 완료될 때까지 그대로라, 창턱으로 옮겨 게이지가 오르는 중에도
     화면은 계속 "높은 창가 자리로 옮겨 보세요" 였다 — 플레이어가 옮긴 것을 게임이 못 본 셈이다.
     ★ 슬롯 id 로 판정하지 않는다. 정답 슬롯을 코어에 박으면 방이 바뀔 때 조용히 틀리고,
     "어느 자리인지는 숨긴다"(first_play.md §4)도 깨진다. 오른다는 것 자체가 자리를 맞춘 증거다.
     반대로 다른 어두운 자리로 옮기면 진행이 0에서 멈추므로 안내는 그대로 남는다 — 그게 맞다. */
  if (fp.phase === 'move_monstera' && phaseAdvanced(prev, fp.monstera.growthPhase))
    fp.phase = 'grow_monstera';
  /* ★ 정확히 spear_furled 에서만 완료. 뒤 단계 포괄 성공 금지 — 위 상수 주석 참고. */
  if (phase.phaseId === FIRST_PLAY_COMPLETE_PHASE_ID) {
    fp.completed = true;
    fp.phase = 'complete';
  }
  return fp;
}

/* ============================================================
   ★ 이벤트 신호 — 점핑이 멈출 지점 (2026-08-03 신설)
   ------------------------------------------------------------
   정지 목록의 정본은 docs/time_modes.md §이벤트 정지 목록이다.
   첫 플레이에서 실제로 일어나는 것은 넷뿐이고, **넷 다 이 모듈이 이미 내고 있던 신호**다:
     콩나물 첫 수확 · 몬스테라 도착 · 말린 새순 등장 · 식비(자금) 변화
   그래서 새 이벤트 체계를 만들지 않고 **상태 두 장의 차이**로만 낸다.

   ★ 왜 "신호"가 아니라 "차이"인가 — 빨리감기는 턴 반환값을 매번 보지 않는다.
     advanceBeansproutDay 의 반환값은 그 턴을 부른 쪽만 본다. 점핑은 nextDay 만 부르므로
     그 안에서 난 일을 알 창구가 없다. 앞뒤 스냅샷을 비교하면 **어느 경로로 바뀌었든** 잡힌다.

   ★ 형태 단계 전환은 여기 없다 — 그건 first_play 상태가 아니라 growth 가 낸 turn.growthPhase 다.
     loop.js 가 본다. 여기에 두면 첫 플레이가 아닌 개체의 단계 전환을 놓친다.
============================================================ */

/* 비교에 쓸 최소한만 뜬다. fp 를 통째로 복제하지 않는다 —
   dliHist 까지 딸려오면 매 턴 깊은 비교가 되고, 무엇이 이벤트인지도 흐려진다. */
export function firstPlaySnapshot(fp) {
  if (!fp || !fp.enabled) return null;
  return {
    harvested: !!(fp.beansprout && fp.beansprout.harvested),
    /* ★ 거둘 수 있게 된 것도 **사건**이다 (2026-08-04) — 수확이 손 동작이 되면서
       "다 자랐다"와 "거뒀다"가 다른 날이 될 수 있게 됐다. 점핑이 서야 하는 곳은 앞쪽이다. */
    ready: beansproutReady(fp.beansprout),
    /* ★ 회전이 생기면서 `harvested` 만으로는 부족해졌다 — 재파종하면 false 로 내려갔다가
       다시 true 가 되므로 "몇 번째 수확인가"를 세야 첫 수확과 그 뒤를 가를 수 있다. */
    harvestCount: fp.beansprout ? (fp.beansprout.harvestCount || 0) : 0,
    cycle: fp.beansprout ? (fp.beansprout.cycle || 1) : 1,
    arrived: !!(fp.monstera && fp.monstera.arrived),
    completed: !!fp.completed,
    cashFoodWon: fp.food ? fp.food.cashFoodWon : null,
    totalFoodSavedWon: fp.food ? fp.food.totalFoodSavedWon : null
  };
}

/* 스냅샷 두 장의 차이를 이벤트 목록으로. 한 턴에 여러 개면 **여러 개 그대로 낸다** —
   Day 4 는 수확·식비·도착이 같은 턴이다. 몇 번 멈출지는 부르는 쪽(loop)이 정한다. */
export function firstPlayEventsOf(before, fp) {
  const now = firstPlaySnapshot(fp);
  if (!before || !now) return [];
  const out = [];
  /* ★ 거둘 때가 됐다 — **전환에서만** 낸다 (2026-08-04). 매일 내면 안 거둔 채로 두는 동안
     사건이 매일 나서 점핑이 하루도 못 간다. 대사는 없다(food_cash 처럼 화면이 버튼으로 말한다). */
  if (!before.ready && now.ready)
    out.push({ id: 'beansprout_ready', ko: '콩나물을 거둘 때가 됐습니다',
               ageDays: fp.beansprout.ageDays, cycle: fp.beansprout.cycle });
  /* ★ 첫 수확과 **그 뒤의 수확**은 다른 사건이다 (2026-08-03).
     같은 id 로 내면 화면이 "콩나물 첫 수확"을 4일마다 다시 띄우고, 대사는 한 번뿐이라
     두 번째부터는 **아무 말도 안 하는 날**이 된다 — 회전이 도는 구간이 통째로 조용해진다. */
  if (now.harvestCount > before.harvestCount) {
    out.push(before.harvestCount === 0
      ? { id: 'beansprout_harvest', ko: '콩나물 첫 수확',
          meals: fp.beansprout.meals, quality: fp.beansprout.quality }
      : { id: 'beansprout_harvest_again', ko: '콩나물을 또 거뒀습니다',
          meals: fp.beansprout.meals, totalMeals: fp.beansprout.harvestMeals,
          sirus: fp.beansprout.sirus, quality: fp.beansprout.quality,
          cycle: fp.beansprout.cycle });
  }
  /* ★ 식비 신호는 **거둔 날에만** 낸다 (2026-08-03 정정).
     회전이 생기면서 창고에서 매일 끼니를 꺼내 쓰게 됐는데, 그걸 그대로 신호로 내면
     `totalFoodSavedWon` 이 매일 바뀌어 **빨리감기가 하루도 못 간다**(재현에서 Day 5 에 섰다).
     매일 밥을 먹는 것은 사건이 아니라 살림이다 — 사건은 "거둬서 식비가 달라진 날"이다. */
  if (now.harvestCount > before.harvestCount &&
      (before.cashFoodWon !== now.cashFoodWon || before.totalFoodSavedWon !== now.totalFoodSavedWon))
    out.push({ id: 'food_cash', ko: '식비가 바뀌었습니다',
               cashFoodWon: now.cashFoodWon, totalFoodSavedWon: now.totalFoodSavedWon });
  if (!before.arrived && now.arrived)
    out.push({ id: 'monstera_arrived', ko: '몬스테라 도착', slotId: fp.monstera.slotId });
  if (!before.completed && now.completed)
    out.push({ id: FIRST_PLAY_COMPLETE_PHASE_ID, ko: '말린 새순 등장' });
  return out;
}

/* 다음에 멈출 이벤트가 무엇인가 — 버튼 문구용. **한글 문장은 만들지 않는다**(UI 몫).
   etaDays 는 **셀 수 있을 때만** 낸다. 몬스테라 쪽은 빛에 달렸으므로 코어가 지어내지 않는다 —
   어두운 자리면 영영 안 오는 게 정답이라, 며칠 남았다고 쓰면 그 자체가 거짓말이 된다. */
export function firstPlayNextEvent(fp) {
  if (!fp || !fp.enabled || fp.completed) return null;
  const b = fp.beansprout;
  /* ★ 다 자랐는데 아직 안 거뒀다 — 다음에 올 것은 **날짜가 아니라 손**이다 (2026-08-04).
     여기서 `beansprout_harvest` 를 계속 내면 화면이 "며칠 뒤 수확"이라고 말하는데
     날짜를 아무리 넘겨도 안 온다. 안 거두면 아무 일도 안 나는 것이 규칙이다(§수확). */
  if (beansproutReady(b))
    return { id: 'beansprout_ready', ko: '콩나물을 거둘 때가 됐습니다', etaDays: 0,
             note: '거두기 전에는 다음 회전이 시작되지 않습니다' };
  if (!b || !b.harvested) {
    const left = (b && Number.isFinite(b.harvestDays) && Number.isFinite(b.ageDays))
      ? b.harvestDays - b.ageDays : null;
    return { id: 'beansprout_harvest', ko: '콩나물 첫 수확',
             etaDays: left != null && left > 0 ? left : null,
             note: '거둔 뒤에 몬스테라가 옵니다' };
  }
  if (!fp.monstera || !fp.monstera.arrived)
    return { id: 'monstera_arrived', ko: '몬스테라 도착', etaDays: null, note: null };
  return { id: FIRST_PLAY_COMPLETE_PHASE_ID, ko: '말린 새순 등장', etaDays: null,
           note: '빛이 되는 자리라야 옵니다 — 어두운 자리면 날짜만 갑니다' };
}
