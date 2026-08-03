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

/* 작물 품질표는 아직 plan JSON에 없다(docs/first_play.md §3의 "구현 없음").
   이번 얇은 통합에서는 이 모듈 한 곳만 임시 계약으로 가지며 UI·루프에는 숫자를 복제하지 않는다. */
export const FIRST_PLAY_RULES = Object.freeze({
  harvestDays: 4,
  /* ★ 씨앗값 — 시루 하나를 다시 심을 때마다 든다 (docs/food_economy.md §3 "씨앗(콩) 1시루분 1,500원").
     ⚠ 이 값만 `characters.json._meta` 가 아니라 여기 있다. 그 파일은 이 창 소유가 아니라
       못 고쳤다 — plan 에 `seedWonPerSiru` 를 _meta 로 옮겨 달라고 요청해 뒀다(보고 ⑤).
     ★ 공짜로 무한히 나오면 경제가 아니다. 재파종이 돈을 쓰는 행동이라야 회전이 선택이 된다. */
  seedWonPerSiru: 1_500,
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

/* 경제값의 정본은 data/balance/characters.json._meta다. 코어는 그 값을 받아 1끼 값을
   유도할 뿐 복제하지 않는다. 잘못된 JSON은 기본값으로 굴리지 않고 시작 전에 중단한다. */
export function firstPlayRulesFromBalance(balance) {
  const meta = balance && balance._meta;
  const dailyFoodWon = meta && meta.dailyFoodPerPerson;
  const dailyCropMealCap = meta && meta.cropMealCapPerPerson;
  const mealsPerDay = meta && meta.mealsPerDayPerPerson;
  if (![dailyFoodWon, dailyCropMealCap, mealsPerDay].every(Number.isFinite) ||
      dailyFoodWon <= 0 || dailyCropMealCap < 0 || mealsPerDay <= 0 || dailyFoodWon % mealsPerDay !== 0)
    throw new Error('[첫 플레이] characters.json의 식비·끼니 계약이 올바르지 않습니다');
  return Object.freeze({
    ...FIRST_PLAY_RULES,
    dailyFoodWon,
    mealWon: dailyFoodWon / mealsPerDay,
    dailyCropMealCap
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
         `sirus` 는 같은 자리에서 함께 도는 시루 수다. 상한은 살림 쪽(tutorial.cropSlotsOf)이
         정한다 — 방 칸이 곧 상한이라 시루가 공짜로 무한히 늘지 않는다.
         ⚠ 전부 **같은 자리의 DLI** 를 쓴다. 밝은 데 두면 열 개가 다 같이 초록이 된다 —
           "자리 하나가 결과를 바꾼다"가 수입 전체로 확대되는 것이고, 그게 이 게임의 뼈대다. */
      sirus: 1,
      cycle: 1,              // 몇 번째 회전인가 (재파종할 때마다 오른다)
      harvestCount: 0,       // 지금까지 몇 번 수확했나 — 첫 수확과 그 뒤를 가르는 열쇠
      harvestMeals: 0        // 직전 수확의 **합계** 끼니(= meals × sirus)
    },
    food: {
      pantryMeals: 0,
      lastHarvestMeals: 0,
      lastFoodSavedWon: 0,
      totalFoodSavedWon: 0,
      cashFoodWon: rules ? rules.dailyFoodWon : 0,
      /* 못 먹고 쉬어 버린 끼니. 팔지 않는다 — 콩나물은 지출 방어이지 수입이 아니다
         (docs/food_economy.md 머리말). 시루를 과하게 산 것이 눈에 보이라고 세어 둔다. */
      lastSpoiledMeals: 0
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
     opt.slots 를 같이 주면 이름으로 놓아도 좌표까지 세워진다(자유 좌표와 같은 정본을 갖는다). */
export function placeBeansprout(fp, target, opt = {}) {
  if (!fp || !fp.beansprout) throw new Error('[첫 플레이] 콩나물 상태가 없습니다');
  if (target == null || target === '')
    throw new Error('[첫 플레이] 콩나물을 둘 자리를 골라 주세요');
  if (fp.beansprout.harvested)
    throw new Error('[첫 플레이] 이미 수확한 첫 시루는 옮길 수 없습니다');

  const spot = spotOf(target, { id: BEANSPROUT_ID, ...opt });
  const moved = fp.beansprout.slotId != null && fp.beansprout.slotId !== spot.slotId;
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

/* 하루 공개 경계. 입력을 먼저 검증하고 나서만 상태를 바꾼다. */
export function advanceBeansproutDay(fp, dli) {
  if (!fp.beansprout.slotId) throw new Error('[첫 플레이] 콩나물 자리를 먼저 정해 주세요');
  if (!validDli(dli)) throw new Error(`[첫 플레이] 콩나물 DLI가 올바르지 않습니다: ${dli}`);
  if (fp.beansprout.harvested)
    return { harvested: false, alreadyHarvested: true };

  fp.beansprout.ageDays++;
  fp.beansprout.dliHist.push(dli);

  const rules = fp.rules;
  if (!rules) throw new Error('[첫 플레이] 밸런스 계약이 없습니다');
  if (fp.beansprout.ageDays < rules.harvestDays) {
    return {
      harvested: false,
      ageDays: fp.beansprout.ageDays,
      daysLeft: rules.harvestDays - fp.beansprout.ageDays
    };
  }

  const hist = fp.beansprout.dliHist;
  const avgDli = hist.reduce((sum, v) => sum + v, 0) / hist.length;
  const quality = rules.quality.find(q => avgDli <= q.maxDli);
  /* ★ 시루 수만큼 곱해진다. 품질은 자리 하나가 정하므로 **자리가 수입 전체를 가른다** —
     어두운 자리 10시루는 30끼, 밝은 자리 10시루는 10끼다(세 배). */
  const sirus = Math.max(1, Math.round(fp.beansprout.sirus || 1));
  const totalMeals = quality.meals * sirus;
  const usedMeals = Math.min(rules.dailyCropMealCap, totalMeals);
  const savedWon = usedMeals * rules.mealWon;

  /* ★ 남는 끼니는 **버려진다. 팔지 않는다.**
     박사님 확정(2026-08-03): 콩나물은 굶지 않게 버티는 수단이고 이사 자금이 아니다.
     콩나물은 며칠이면 쉬는 채소라 쌓아 둘 수도 없다 — 다음 회전까지 먹을 만큼
     (`상한 × 회전일` = 2끼 × 4일 = 8끼)만 남고 그보다 많으면 버린다.
     그래서 시루를 네 개 이상 사도 소용이 없다: **끼니 상한이 곧 시루 상한**이다.
     시루 1개(3끼)면 버릴 것이 없어 **첫 수확의 숫자는 예전 그대로**다. */
  let pantry = fp.food.pantryMeals + (totalMeals - usedMeals);
  const keepMeals = rules.dailyCropMealCap * rules.harvestDays;
  const spoiledMeals = Math.max(0, pantry - keepMeals);
  pantry -= spoiledMeals;

  fp.beansprout.harvested = true;
  fp.beansprout.avgDli = avgDli;
  fp.beansprout.quality = quality.id;
  fp.beansprout.meals = quality.meals;              // ★시루 **하나당** 끼니. 표시·판정의 기준
  fp.beansprout.harvestMeals = totalMeals;          // 합계는 따로 둔다
  fp.beansprout.harvestCount = (fp.beansprout.harvestCount || 0) + 1;
  fp.food.lastHarvestMeals = totalMeals;
  fp.food.pantryMeals = pantry;
  fp.food.lastFoodSavedWon = savedWon;
  fp.food.totalFoodSavedWon += savedWon;
  fp.food.cashFoodWon = rules.dailyFoodWon - savedWon;
  fp.food.lastSpoiledMeals = spoiledMeals;
  /* ★ 선물은 **첫 수확에만** 온다. 두 번째 시루에서 몬스테라가 또 오면 안 된다. */
  if (!fp.monstera.arrived) fp.phase = 'monstera_gift';

  return {
    harvested: true,
    avgDli,
    quality: quality.id,
    qualityKo: quality.ko,
    meals: quality.meals,
    sirus,
    totalMeals,
    usedMeals,
    /* ★ `mealsUsed` 라는 이름으로도 낸다 (2026-08-03 정정).
       loop.stepTutorial 이 `ev.mealsUsed` 를 읽는데 여기서는 `usedMeals` 로만 내고 있었다 —
       이름이 하나 어긋나서 **식비 절감이 살림에 한 번도 반영되지 않았다.**
       읽는 쪽을 고치면 옛 호출부가 조용히 깨지므로 두 이름을 같이 낸다. */
    mealsUsed: usedMeals,
    foodSavedWon: savedWon,
    spoiledMeals,
    harvestCount: fp.beansprout.harvestCount,
    cashFoodWon: fp.food.cashFoodWon
  };
}

/* ★ 수확한 날이 아닌 날의 밥 — 창고에서 상한만큼 꺼내 쓴다 (2026-08-03 신설).
   ------------------------------------------------------------
   예전에는 절감이 **수확한 날 하루만** 일어났다. 시루 하나가 4일에 3끼를 내는데
   그중 2끼를 수확일 하루에 몰아 쓰고 나머지는 창고에서 잠들었다 —
   `food_economy.md` §4 의 "하루 2끼 상한"은 **매일** 걸리는 상한이지 4일에 한 번이 아니다.
   그래서 회전이 돌기 시작하면 이 함수가 매일 불린다(loop.nextDay).
   ★ 수확한 날에는 안 부른다 — 그날 몫은 위 advanceBeansproutDay 가 이미 꺼내 썼다. */
export function eatFromPantry(fp) {
  const zero = { mealsUsed: 0, foodSavedWon: 0 };
  if (!fp || !fp.enabled || !fp.rules || !fp.food) return zero;
  const rules = fp.rules;
  const use = Math.min(rules.dailyCropMealCap, Math.max(0, fp.food.pantryMeals || 0));
  fp.food.lastSpoiledMeals = 0;
  if (use <= 0) {
    fp.food.lastFoodSavedWon = 0;
    fp.food.cashFoodWon = rules.dailyFoodWon;
    return zero;
  }
  fp.food.pantryMeals -= use;
  const won = use * rules.mealWon;
  fp.food.lastFoodSavedWon = won;
  fp.food.totalFoodSavedWon += won;
  fp.food.cashFoodWon = rules.dailyFoodWon - won;
  return { mealsUsed: use, foodSavedWon: won };
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

  /* 자리를 다시 고를 수 있다 — 이게 ②(막다른 길)의 실제 해법이다.
     placeBeansprout 은 수확한 시루를 막으므로 **위에서 harvested 를 내린 뒤에** 부른다. */
  if (opt.at != null && opt.at !== '') placeBeansprout(fp, opt.at, opt);

  return { sirus, cycle: b.cycle, seedCostWon, slotId: b.slotId, at: b.at };
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
  if (!b || !b.harvested) {
    const left = (b && Number.isFinite(b.harvestDays) && Number.isFinite(b.ageDays))
      ? b.harvestDays - b.ageDays : null;
    return { id: 'beansprout_harvest', ko: '콩나물 첫 수확',
             etaDays: left != null && left > 0 ? left : null,
             note: '같은 턴에 몬스테라도 도착합니다' };
  }
  if (!fp.monstera || !fp.monstera.arrived)
    return { id: 'monstera_arrived', ko: '몬스테라 도착', etaDays: null, note: null };
  return { id: FIRST_PLAY_COMPLETE_PHASE_ID, ko: '말린 새순 등장', etaDays: null,
           note: '빛이 되는 자리라야 옵니다 — 어두운 자리면 날짜만 갑니다' };
}
