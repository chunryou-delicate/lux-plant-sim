/* ============================================================
   game/first_play.js — 자취생 첫 플레이의 얇은 수직 흐름
   ------------------------------------------------------------
   정본: docs/first_play.md §1~3, docs/food_economy.md §3~4.

   이 모듈이 맡는 것은 첫 수확 한 번과 그 결과 표시뿐이다.
   월세·현금·상점·반복 생산은 넣지 않는다. 몬스테라 형태는 growth가 맡는다.
============================================================ */

/* 작물 품질표는 아직 plan JSON에 없다(docs/first_play.md §3의 "구현 없음").
   이번 얇은 통합에서는 이 모듈 한 곳만 임시 계약으로 가지며 UI·루프에는 숫자를 복제하지 않는다. */
export const FIRST_PLAY_RULES = Object.freeze({
  harvestDays: 4,
  quality: Object.freeze([
    Object.freeze({ maxDli: 0.3, id: 'crisp_white', ko: '하얗고 아삭', meals: 3 }),
    Object.freeze({ maxDli: 1.0, id: 'slightly_green', ko: '살짝 초록', meals: 2 }),
    Object.freeze({ maxDli: Infinity, id: 'green_bitter', ko: '초록·쓴맛', meals: 1 })
  ])
});

export const FIRST_PLAY_ASSETS = Object.freeze({
  monsteraPotDiameterM: 0.202
});

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
      slotId: null,
      ageDays: 0,
      harvestDays: rules ? rules.harvestDays : 0,
      dliHist: [],
      harvested: false,
      quality: null,
      meals: 0,
      avgDli: null
    },
    food: {
      pantryMeals: 0,
      lastHarvestMeals: 0,
      lastFoodSavedWon: 0,
      totalFoodSavedWon: 0,
      cashFoodWon: rules ? rules.dailyFoodWon : 0
    },
    monstera: {
      arrived: false,
      slotId: null,
      growthPhase: null
    }
  };
}

export function placeBeansprout(fp, slotId) {
  if (!fp || !fp.beansprout) throw new Error('[첫 플레이] 콩나물 상태가 없습니다');
  if (!slotId) throw new Error('[첫 플레이] 콩나물을 둘 자리를 골라 주세요');
  if (fp.beansprout.harvested)
    throw new Error('[첫 플레이] 이미 수확한 첫 시루는 옮길 수 없습니다');
  fp.beansprout.slotId = slotId;
  fp.phase = 'grow_beansprout';
  return fp.beansprout;
}

function validDli(dli) {
  return typeof dli === 'number' && Number.isFinite(dli) && dli >= 0;
}

export function cropDliFromReport(report, slotId) {
  if (!slotId) throw new Error('[첫 플레이] 콩나물 자리가 정해지지 않았습니다');
  const slot = ((report && report.slots) || []).find(s => s && s.slotId === slotId);
  if (!slot) throw new Error(`[첫 플레이] 콩나물 자리 ${slotId}가 오늘 조도 계약에 없습니다`);
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
  const usedMeals = Math.min(quality.meals, rules.dailyCropMealCap);
  const savedWon = usedMeals * rules.mealWon;

  fp.beansprout.harvested = true;
  fp.beansprout.avgDli = avgDli;
  fp.beansprout.quality = quality.id;
  fp.beansprout.meals = quality.meals;
  fp.food.lastHarvestMeals = quality.meals;
  fp.food.pantryMeals += quality.meals - usedMeals;
  fp.food.lastFoodSavedWon = savedWon;
  fp.food.totalFoodSavedWon += savedWon;
  fp.food.cashFoodWon = rules.dailyFoodWon - savedWon;
  fp.phase = 'monstera_gift';

  return {
    harvested: true,
    avgDli,
    quality: quality.id,
    qualityKo: quality.ko,
    meals: quality.meals,
    usedMeals,
    foodSavedWon: savedWon,
    cashFoodWon: fp.food.cashFoodWon
  };
}

export function markMonsteraArrived(fp, slotId) {
  if (!fp.beansprout.harvested)
    throw new Error('[첫 플레이] 콩나물을 수확하기 전에는 몬스테라가 오지 않습니다');
  if (!slotId) throw new Error('[첫 플레이] 몬스테라 도착 자리가 없습니다');
  fp.monstera.arrived = true;
  fp.monstera.slotId = slotId;
  fp.phase = 'move_monstera';
  return fp.monstera;
}

export function moveMonstera(fp, slotId) {
  if (!fp.monstera.arrived) throw new Error('[첫 플레이] 아직 몬스테라가 도착하지 않았습니다');
  if (!slotId) throw new Error('[첫 플레이] 몬스테라를 옮길 자리를 골라 주세요');
  fp.monstera.slotId = slotId;
  return slotId;
}

export function markMonsteraPhase(fp, phase) {
  if (!fp.monstera.arrived || !phase) return fp;
  fp.monstera.growthPhase = {
    phaseId: phase.phaseId,
    progress01: phase.progress01,
    nextPhaseId: phase.nextPhaseId ?? null
  };
  /* The first-play close is one exact scene: the furled spear appears.  Accepting
     later phases would let an invalid initial state or multi-day jump skip it. */
  if (phase.phaseId === 'spear_furled') {
    fp.completed = true;
    fp.phase = 'complete';
  }
  return fp;
}
