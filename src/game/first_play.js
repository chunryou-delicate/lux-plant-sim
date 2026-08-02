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

/* ★ 수확 전이면 언제든 옮길 수 있다 (2026-08-02 정정).
   예전엔 하루라도 자라면 잠갔는데, 그 자리의 조도 계약이 깨지면 **고칠 방법이 사라졌다** —
   매일 예외만 나고 시루는 못 옮기는 막다른 길이 됐다. 옮겨도 **과거 DLI 이력은 그대로 둔다**:
   이력은 "이 콩나물이 실제로 받은 빛"이라 자리를 바꿨다고 없던 일이 되지 않는다.
   수확 뒤에는 결과가 이미 확정됐으므로 막는다. */
export function placeBeansprout(fp, slotId) {
  if (!fp || !fp.beansprout) throw new Error('[첫 플레이] 콩나물 상태가 없습니다');
  if (!slotId) throw new Error('[첫 플레이] 콩나물을 둘 자리를 골라 주세요');
  if (fp.beansprout.harvested)
    throw new Error('[첫 플레이] 이미 수확한 첫 시루는 옮길 수 없습니다');
  const moved = fp.beansprout.slotId != null && fp.beansprout.slotId !== slotId;
  fp.beansprout.slotId = slotId;
  fp.phase = 'grow_beansprout';
  return { ...fp.beansprout, moved, keptDays: fp.beansprout.dliHist.length };
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
  if (!before.harvested && now.harvested)
    out.push({ id: 'beansprout_harvest', ko: '콩나물 첫 수확',
               meals: fp.beansprout.meals, quality: fp.beansprout.quality });
  if (before.cashFoodWon !== now.cashFoodWon || before.totalFoodSavedWon !== now.totalFoodSavedWon)
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
