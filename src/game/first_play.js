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
       다른 종류를 들인다       → 3,000 → +2,000 → +1,000 (순번마다 체감)
       같은 종류 시루를 늘린다  → **거두는 때가 겹치면** 같은 표로 깎인다(아래 §겹침)

   ★★ 2026-08-04 재정정 — 예전에는 "같은 종류 시루를 늘리면 절감이 아예 안 는다"였다.
     그 규칙은 **시루를 살 이유를 통째로 없앴다**(재현 tools/probe_crop_cases.mjs 가 그걸 쟀다:
     20일 순이득이 1개 -800원 · 3개 -20,400원이었다 — 살수록 손해다).
     이제는 **겹치면 깎이고, 어긋나게 돌리면 온전히 받는다.** 시루를 더 사는 이유가
     "더 번다"가 아니라 **"끊기지 않는다"** 가 된다 — 그 어긋남을 만드는 것이 플레이어의 손이다.

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
  /* ★실제 시세 700~1,200원의 **아래쪽**을 잡는다 (박사님 2026-08-04: "씨앗값을 더 줄여").
     나물콩은 큰 봉지를 사 나누어 쓰는 것이라 1시루분은 그만큼 싼다.
     ⚠ shop.CATALOG.bean_seed.listWon 과 **같은 값이어야 한다** — 지갑에 닿는 건 그쪽이다. */
  seedWonPerSiru: 500,
  /* ★★ **순번별 한 회전이 내는 절감액**. 박사님 확정값 그대로다.
     ⚠ 이 셋도 `data/balance/` 가 아니라 여기 있다 — 그 폴더는 이 창 소유가 아니다.
       plan 에 `characters.json._meta.cropKindSavedWon` 으로 옮겨 달라고 요청한다(보고 ⑤).
     ★ 배열 길이가 곧 "몇 번째까지 값이 붙나"다. 4번째부터는 0 — 질려서 더는 못 먹는다.

     ★★ 이 표는 **두 곳에서 같이 쓴다** (2026-08-04 박사님 확정 · 아래 §겹침).
       ① 작물 **종류**가 늘 때 — 콩나물 다음에 들인 것은 2,000, 그다음은 1,000
       ② 거두는 **때가 겹칠** 때 — 곳간이 아직 안 빈 채로 또 거두면 둘째는 2,000, 셋째는 1,000
     둘을 다른 표로 만들면 안 된다. 줄어드는 **이유가 같기 때문**이다 — 질림이다.
     같은 것이 아직 남아 있는데 또 들어오는 것이나, 같은 것을 계속 먹는 것이나 한 가지다. */
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

/* ============================================================
   ★★ 겹침 — **"같은 날에 거둔 것"** 이 겹친 것이다 (2026-08-04 박사님 확정)
   ------------------------------------------------------------
   원문: *"띄엄으로 해야지. 내 말은 5일 주기니까 5개까지 1일씩 안 겹치게 하면
          저감량이 매일 다 3000 아녀?"*

       주기 5일 · 시루 5개 · 물을 하루씩 걸러 준다
         → 거두는 날이 하루씩 어긋난다 → 매일 하나씩 거둔다
         → 겹치는 것이 없으니 **전부 3,000원** → 하루 저감 3,000원

   ★★ **천장이 주기 길이에서 저절로 나온다.** 5일 주기면 5개가 상한이다 —
     6개째부터는 반드시 어느 날과 겹쳐 그날 둘째가 되어 2,000원, 그다음 1,000원, 그다음 0원이다.
     상한을 따로 박지 않는다. 규칙에서 나온다. **이것이 이 설계의 핵심이다.**
   ⇒ 시루를 사는 것이 "돈"을 사는 것이 아니라 **"짜임새"** 를 사는 것이 된다.

   ★ 후보가 둘이었다 — **같은 날인가** · **곳간이 안 빈 동안인가**. 박사님 그림이 앞을 골랐고,
     재 보니 **하루 상한이 한 회전분이 된 뒤로는 둘이 사실상 같은 답을 낸다**:
     완전 시차 판에서는 매일 곳간이 비므로 "곳간이 안 빔" = "그날 처음 거둠"이다.
     그래도 **같은 날**을 정본으로 삼는 이유는 정확해서다 —
     곳간 잔량으로 세면 깎인 수확(2,000·1,000원)이 들어간 뒤 잔량이 회전 배수와 안 맞아
     **넷째가 0원이 아니라 1,000원이 된다.** 세는 대상이 "금액"이 아니라 "건수"라야 눈금이 맞다.

   ★ 순번 = **그날 이미 거둔 시루 수**.
       그날 첫째 → 0 → 3,000 (온전히)
       그날 둘째 → 1 → 2,000
       그날 셋째 → 2 → 1,000
       그날 넷째부터 → 3 이상 → **0원** (표에 값이 없다 = 질려서 더는 못 먹는다)
   ★ 넷째부터 0인 것은 표 길이가 셋이기 때문이고, 3종째까지만 값이 붙는 것과 **같은 이유**다.
     버리는 것이 아니다 — 곳간에 안 들어가므로 쉬어서 버려지는 몫(spoiledWon)과도 다르다.
     들고 오긴 왔는데 **먹을 마음이 안 드는 것**이라 셈이 0이다.
============================================================ */
export function overlapSavedWon(rules, meals, indexOnDay) {
  return cropCycleSavedWon(rules, meals, Math.max(0, Math.round(indexOnDay || 0)));
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
    /* ★★ 하루에 곳간에서 꺼내 쓸 수 있는 상한 — **한 회전분**이다 (2026-08-04 다시 정함).
       ------------------------------------------------------------
       박사님: *"5일 주기니까 5개까지 1일씩 안 겹치게 하면 저감량이 매일 다 3000 아녀?"*

       ★ 예전에는 `한 회전분 ÷ 회전 일수` = 600원이었다. 그 값이 **박사님 그림을 막고 있었다**:
         완전 시차로 매일 3,000원이 들어와도 600원씩만 꺼내 쓰면 곳간에 쌓이다 버려진다.
         상한이 "고르게 펴는 일"을 넘어 **총량을 막는 두 번째 규칙**이 되어 있었던 것이다.
         (실측: 시루를 몇 개로 늘려도 20일 총저감이 9,000원으로 똑같았다.)

       ★ 그래서 상한을 **한 회전분**으로 올린다. 근거 셋:
         ① ★**천장이 주기 길이에서 저절로 나온다.** 5일 주기면 시루 5개까지 매일 하나씩 거둘 수
            있고, 그때 하루 저감이 딱 한 회전분이다. 6개째부터는 반드시 어느 날과 겹쳐
            2,000 → 1,000 → 0 으로 깎인다 — **상한을 따로 박을 필요가 없다.**
         ② 정본에 이미 천장이 있다 — `characters.json._meta.cropMealCapPerPerson`(자취생 2끼).
            원으로 5,000원이고, 한 회전분 3,000원은 그 아래다. 아래 `Math.min` 이 그 정본을 지킨다.
            작물 종류가 늘어 한 회전분 합계가 5,000원을 넘으면 **끼니 상한이 이긴다.**
         ③ 하루 식비 7,500원의 40%다. 그 위로 가면 "하루 세 끼를 콩나물로만"이 되어 현실이 아니다.
       ⚠ 그래서 시루 1개짜리는 저감이 **고르지 않다**: 거둔 날 3,000원, 나머지 나흘 0원.
         총액은 예전과 같고(5일에 3,000원), 오히려 "거둔 날에 밥값이 준다"가 또렷해진다. */
    dailyCropSaveWon: Math.min(cropSavedWonPerCycle, dailyCropMealCap * (dailyFoodWon / mealsPerDay)),
    cropKinds: kinds
  });
}

/* ============================================================
   ★★ 시루마다 자기 회전 (2026-08-04 박사님 지시 "시차를 두자")
   ------------------------------------------------------------
   예전에는 `beansprout.ageDays` **하나를 시루 전부가 나눠 썼다.** 그래서 시루를 몇 개 놓든
   회전이 같이 돌고 거두는 날도 같았다 — 시차가 아예 생길 수 없는 모양이었다.
   이제 `beansprout.pots[]` 가 정본이고, 칸 하나가 시루 하나다.

   ★ **자리는 여전히 하나다**(`beansprout.slotId` · `.at`). 시루들은 같은 자리에서 나란히 돈다.
     시루마다 좌표를 주지 않은 이유 셋:
       ① 시차는 **시간의 축**이지 자리의 축이 아니다. 자리를 쪼개면 시루마다 빛이 달라져
          품질까지 갈리는데, 그건 이 지시가 재려던 것이 아니다(빛 축은 이미 몬스테라가 쓴다).
       ② 조도 계약(daily_light/1)·방뷰·자유 배치가 전부 `slotId` 하나를 전제한다.
          시루마다 좌표를 주면 그 셋을 같이 고쳐야 하는데 화면은 이 창 소유가 아니다.
       ③ 현실이 그렇다 — 시루 셋은 같은 선반 위에 나란히 놓는다.

   ★ 칸 하나가 갖는 것은 **자기 회전에 관한 것뿐**이다. 자리·자라는 날처럼 시루 전부가
     나눠 갖는 것은 `beansprout` 쪽에 그대로 둔다. 두 곳에 같은 값을 두지 않는다.
============================================================ */
export function makeCropPot(id, opt = {}) {
  return {
    id,                    // 'crop_01' … 표시·세이브의 안정 열쇠
    /* ★★ **회전 시작일** (2026-08-04 새 규칙 · 아래 §물주기).
       물을 준 날이 곧 0일차다. null = 아직 물을 안 줘서 **시작하지 않았다.** */
    startedOnDay: opt.startedOnDay ?? null,
    /* ★ **언제부터 시작을 기다리고 있나** — 벌이 아니라 화면이 말할 근거다(§물주기 ⚠).
       놓은 날(=게임 시작)이나 다시 심은 날이 여기 들어간다. 시작하면 뜻이 없어진다. */
    idleSinceDay: opt.idleSinceDay ?? 0,
    ageDays: 0,
    dliHist: [],
    harvested: false,
    quality: null,
    meals: 0,
    avgDli: null,
    cycle: opt.cycle ?? 1,   // 이 시루의 몇 번째 회전인가
    harvestCount: 0,         // 이 시루가 지금까지 몇 번 거둬졌나
    harvestMeals: 0,         // 직전 수확의 품질 끼니 라벨 (표시용)
    savedWon: 0,             // 직전 수확이 실제로 곳간에 넣은 값
    overlapIndex: 0          // 직전 수확이 몇 번째로 겹쳤나 (0 = 안 겹쳤다)
  };
}

/* 옛 세이브·옛 상태(칸이 하나뿐인 모양)를 `pots[]` 로 옮긴다. **되돌릴 수 있는 모양으로만** 옮긴다 —
   지어낼 값이 없다: 옛 한 칸이 그대로 첫 시루가 되고, `sirus` 가 2 이상이면 나머지는
   **같은 회전을 함께 돌던 것**이므로 같은 값으로 복제한다(옛 규칙이 실제로 그랬다).
   ★ 옛 `wateredOnDay` 는 새 `startedOnDay` 가 된다 — 옛 규칙에서도 "마지막으로 물을 준 날"이라
     그 값이 회전 시작으로 읽혀도 하루 이상 어긋나지 않는다(아래 §세이브 이전).
   ⚠ 이미 pots 가 있으면 **손대지 않는다.** 두 번 부르는 것이 안전해야 세이브·복원이 안 꼬인다. */
export function ensureCropPots(b) {
  if (!b) return b;
  if (Array.isArray(b.pots) && b.pots.length) return b;
  const n = Math.max(1, Math.round(b.sirus || 1));
  const started = Number.isInteger(b.wateredOnDay) ? b.wateredOnDay : null;
  b.pots = [];
  for (let i = 0; i < n; i++) {
    const p = makeCropPot(`${BEANSPROUT_ID}_${String(i + 1).padStart(2, '0')}`,
                          { startedOnDay: started, cycle: b.cycle || 1 });
    /* 옛 한 칸의 진행을 그대로 옮긴다. `dliHist` 는 배열이라 시루마다 사본을 준다 */
    p.ageDays = Math.max(0, Math.round(b.ageDays || 0));
    p.dliHist = (b.dliHist || []).slice();
    p.harvested = !!b.harvested;
    p.quality = b.quality ?? null;
    p.meals = b.meals || 0;
    p.avgDli = b.avgDli ?? null;
    p.harvestCount = b.harvestCount || 0;
    p.harvestMeals = b.harvestMeals || 0;
    /* ★ 아직 한 번도 안 자란 시루는 **시작 안 한 것**으로 본다 — 옛 규칙에서 "심고 물만 준" 상태와
       새 규칙의 "아직 물을 안 준" 상태를 가를 근거가 `ageDays` 뿐이다. 0이면 잃을 진행이 없다. */
    if (p.ageDays === 0 && !p.harvested) p.startedOnDay = started;
    b.pots.push(p);
  }
  return b;
}

/* 시루 목록 — 옛 모양(pots 없음)도 받아 준다. **읽기 전용 경로에서 상태를 안 만든다.** */
function potsOf(b) {
  if (!b) return [];
  if (Array.isArray(b.pots) && b.pots.length) return b.pots;
  return [];
}

/* ============================================================
   ★★ 몬스테라 선물이 오는 때 — **첫 수확이 아니다** (2026-08-04 박사님 확정)
   ------------------------------------------------------------
   원문: *"몬스테라는 좀 더 뒤에 줘야겠다. 먹는 거 재배 좀 더 알려줘야 될 듯."*

   예전에는 **첫 수확**에 왔다(튜토 4~5일차). 그러면 콩나물로 배우는 것이 한 회전뿐이라
   방금 들어온 시차 규칙(5일 주기 · 회전당 3,000원 · 같은 날 겹치면 3,000→2,000→1,000→0 ·
   시루 5개가 천장 · 물이 회전 시작)을 **하나도 못 겪고** 다음 식물로 넘어간다.

   ★ 조건은 둘 중 **먼저 오는 쪽**이다.
     ① 거둔 횟수 3회 이상          — 시루 하나만 굴려도 **반드시** 닿는다(5일 주기 × 3 ≈ 15일)
     ② 시루 2개 이상 · 거둔 횟수 2회 이상 — 시루를 늘린 사람은 더 빨리 온다(≈ 10일)

   ★ ②를 "시루 2개"만으로 걸지 않은 이유 — 사는 것은 배움이 아니다. 두 시루가 **각각
     한 번씩 돌아 본 뒤**라야 같은 날 겹쳐 깎이는 것도, 날을 어긋내면 안 깎이는 것도 겪는다.
   ★ 겹침(overlapCount)을 조건으로 안 건 이유 — **안 겪는 판이 있다.** 시루를 하나만 쓰거나
     처음부터 날을 어긋내 물을 준 사람에게는 영영 안 온다. 안 오는 판이 하나라도 있으면
     그건 틀린 조건이다.
   ★ ①이 바닥이라 **반드시 온다** — 콩나물을 계속 거두는 것 말고는 튜토에 할 일이 없고,
     안 거두면 다음 회전이 시작되지 않아 화면이 계속 [수확하기]를 가리킨다(firstPlayNextEvent).

   ══ ⛔ 그런데 지금은 `harvestCount: 1` 이다 — **화면이 못 따라온다** (2026-08-04 실측) ══
   `tools/probe_arrival_ingame.mjs` 로 game.html 을 실제로 띄워 눌러 보고 잡았다.

     game.html 의 `drawShop()` 이 첫 줄에서 이렇게 닫는다:
       const open = !!(ts && ts.enabled && S.firstPlay.completed);
       box.style.display = open ? '' : 'none'; if (!open) return;
     그리고 **[콩나물 다시 심기] 버튼(`#resow`)이 그 `#shopBox` 안에 들어 있다.**

   ⇒ 첫 플레이 동안에는 **씨앗을 주문할 수도, 다시 심을 수도 없다.** 회전이 한 번에서 멈춘다.
     그 상태에서 조건을 2 이상으로 걸면 선물이 **영영 안 온다** — 게임이 그 자리에서 멈춘다.
     (재현 표: 게임 70일을 눌러도 회전 1 · 화분 0 · 도착 null)

   ★ 그래서 값만 1 로 두고 **자리는 남긴다.** 상점·다시심기 게이트를 첫 수확 뒤로 여는 순간
     여기 숫자 하나(1 → 3)만 바꾸면 박사님 지시대로 돌아간다. 조건식·검사·대사는 이미 그 모양이다.
   ⚠ 그 게이트는 game.html 에 있고 이 창 소유가 아니다 — 손대지 않았다. 보고에 적었다.
============================================================ */
export const MONSTERA_ARRIVAL_RULE = Object.freeze({
  /* ★2026-08-04 — 게이트를 열었으므로 박사님 지시대로 3 으로 올린다.
     위 §게이트가 지목한 game.html 두 곳을 고쳤다:
       ① `#resow` 를 `#shopBox` 밖으로 뺐다 — 심기는 상점 일이 아니라 작물 일이다.
       ② `drawShop()` 의 `&& S.firstPlay.completed` 를 뺐다.
     ★②를 고치며 §게이트의 전제 하나가 틀렸음이 드러났다 — "첫 플레이 중에는 돈 개념이
       없다"가 아니라, 첫 플레이 중에도 `tutorial.enabled` 가 켜져 있어 씨앗값이 실제로
       나간다(이 파일 아래 `test_first_play` 가 그 차감을 검산한다). 코어는 처음부터
       회전을 더 돌릴 수 있었고, 막고 있던 것은 화면 한 줄뿐이었다.
       그래서 **공짜 씨앗을 주지 않는다** — "재고 없이는 못 심는다"가 그대로 선다. */
  harvestCount: 3,
  sirus: 2, sirusHarvestCount: 2   // ② 지름길 — 시루를 늘려 둘 다 굴려 봤다
});

/* 지금 선물이 올 때가 됐나. **읽기 전용**이다 — 상태를 안 만든다. */
export function monsteraArrivalDue(fp, rule = MONSTERA_ARRIVAL_RULE) {
  const b = fp && fp.beansprout;
  if (!b) return false;
  const n = b.harvestCount || 0;
  if (n >= rule.harvestCount) return true;
  return potsOf(b).length >= rule.sirus && n >= rule.sirusHarvestCount;
}

/* 아직 안 왔다면 무엇이 남았나 — 화면·재현이 "왜 아직인가"를 말할 수 있게. null 이면 올 때가 됐다. */
export function monsteraArrivalLeft(fp, rule = MONSTERA_ARRIVAL_RULE) {
  if (monsteraArrivalDue(fp, rule)) return null;
  const b = (fp && fp.beansprout) || null;
  const n = (b && b.harvestCount) || 0;
  return { harvestsLeft: Math.max(0, rule.harvestCount - n),
           sirus: potsOf(b).length, harvestCount: n };
}

/* 이 시루가 지금 거둘 수 있나 — 시작했고 · 안 거뒀고 · 다 자랐다 */
function potReady(p, harvestDays) {
  return !!(p && !p.harvested && p.startedOnDay != null &&
            Number.isFinite(harvestDays) && p.ageDays >= harvestDays);
}

/* ★ 대표 칸을 `beansprout` 에 비춘다 — **옛 이름을 살려 두는 유일한 장치**다.
   화면(game.html)·방뷰·옛 재현이 `beansprout.ageDays` 같은 칸을 그대로 읽고 있고, 그 파일들은
   이 창 소유가 아니다. 그래서 정본은 `pots[]` 로 옮기되 **읽기용 사본**을 여기 남긴다.
   ⚠ 사본은 **판정에 쓰지 않는다.** 판정은 전부 pots 를 본다(beansproutReady·harvest·water).

   대표는 **가장 앞선 시루**다: 거둘 수 있는 것이 있으면 그것, 없으면 제일 많이 자란 것.
   그래야 화면의 "수확까지 N일"이 **다음에 실제로 일어날 일**을 말한다.
   `harvested` 만 뜻이 다르다 — **하나라도 거뒀나**(= 자리를 잠글까 · 다시 심을 수 있나)다. */
export function syncCropLead(b) {
  const pots = potsOf(b);
  if (!pots.length) return b;
  const hd = b.harvestDays;
  const lead = pots.slice().sort((x, y) => {
    const rx = potReady(x, hd) ? 1 : 0, ry = potReady(y, hd) ? 1 : 0;
    if (rx !== ry) return ry - rx;
    return (y.ageDays || 0) - (x.ageDays || 0);
  })[0];
  b.sirus = pots.length;
  b.ageDays = lead.ageDays;
  b.dliHist = lead.dliHist;
  b.quality = lead.quality;
  b.meals = lead.meals;
  b.avgDli = lead.avgDli;
  b.harvestMeals = lead.harvestMeals;
  b.cycle = pots.reduce((m, p) => Math.max(m, p.cycle || 1), 1);
  b.harvestCount = pots.reduce((a, p) => a + (p.harvestCount || 0), 0);
  b.harvested = pots.some(p => p.harvested);
  /* 마지막으로 회전을 시작한 날 — 옛 이름 그대로다(세이브·화면이 읽는다) */
  const started = pots.map(p => p.startedOnDay).filter(v => Number.isInteger(v));
  b.wateredOnDay = started.length ? Math.max(...started) : null;
  return b;
}

export function createFirstPlayState(opt = {}) {
  const enabled = !!opt.enabled;
  const rules = opt.rules || null;
  if (enabled && !rules) throw new Error('[첫 플레이] 밸런스 계약 없이 시작할 수 없습니다');
  const b = {
    /* slotId = 계약 열쇠 · at = 좌표 정본. 화분(S.pots[])과 같은 두 칸이다.
       ★ 시루 전부가 이 자리 하나를 나눠 쓴다(위 §시루마다 자기 회전). */
    slotId: null,
    at: null,
    harvestDays: rules ? rules.harvestDays : 0,
    /* ★★ 정본은 여기다 — 시루 하나가 칸 하나. `ensureCropPots` 가 옛 모양을 여기로 옮긴다. */
    pots: [makeCropPot(`${BEANSPROUT_ID}_01`)],
    /* ── 아래는 전부 `pots[대표]` 의 **읽기용 사본**이다(syncCropLead 가 채운다) ── */
    ageDays: 0,
    dliHist: [],
    harvested: false,
    quality: null,
    meals: 0,
    avgDli: null,
    /* `sirus` = 시루 수 = `pots.length`. 화면이 이 이름을 읽는다 */
    sirus: 1,
    cycle: 1,
    harvestCount: 0,
    harvestMeals: 0,
    /* ★ 마지막으로 회전을 시작한 날(=물을 준 날). **게임일**이다(상대 일수가 아니다) */
    wateredOnDay: null
  };
  return {
    enabled,
    rules,
    phase: 'place_beansprout',
    completed: false,
    beansprout: b,
    food: {
      /* ★ 곳간은 **원**으로 센다 (2026-08-04). 예전에는 끼니였는데, 한 회전 절감이
         3,000원이라 1끼(2,500원) 단위로는 안 떨어진다. 끼니는 품질 라벨로만 남는다. */
      pantryWon: 0,
      /* ★ 겹침을 세는 두 칸 (2026-08-04 · §겹침) — "그날 몇 번째로 거두나"의 기억이다.
         날이 바뀌면 `harvestDay` 가 안 맞아 저절로 0부터 다시 센다. */
      harvestDay: null,
      harvestedOnDay: 0,
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
   ★★ 2026-08-04 정정 — **놓는다고 물이 주어지지 않는다.** 예전에는 `opt.day` 로 심는 날 물을
     부었는데, 새 규칙에서 물은 **회전 시작**이라(아래 §물주기) 놓자마자 시작되면
     플레이어가 시차를 만들 손이 사라진다. 심는 것과 시작하는 것은 다른 동작이다.
     `opt.day` 는 받되 무시한다 — 옛 호출부가 안 깨진다. */
export function placeBeansprout(fp, target, opt = {}) {
  if (!fp || !fp.beansprout) throw new Error('[첫 플레이] 콩나물 상태가 없습니다');
  if (target == null || target === '')
    throw new Error('[첫 플레이] 콩나물을 둘 자리를 골라 주세요');
  ensureCropPots(fp.beansprout);
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

/* ============================================================
   ★★ 물주기 — **회전 시작 버튼** (2026-08-04 박사님 재지시)
   ------------------------------------------------------------
   원문: *"물은 시작 1번만 주도록 하는 게 어때? 심고, 물을 줘야 그날 기준으로 주기 뒤에 수확인 거야.
          그걸 이용해서 이용자가 알아서 시차 조절"* · *"이러면 가이드에 설명도 풍부해지지"*

       씨앗을 심는다 → **물을 준다(그날이 0일차)** → 5일 뒤 거둘 수 있음 → 거둔다
                        ↑ 여기가 회전 시작이다

   ★★ 물은 **회전당 한 번**이다. 매일 주는 것이 아니다.
     그래서 마른 날(`dryRun`·`dryDays`)이라는 개념 자체가 **없어졌다.**
     물을 안 주면 벌을 받는 것이 아니라 **아직 시작을 안 한 것**이다. 시루는 그대로 놓여 있다.

   ★★ 왜 바꿨나 — 세 가지가 한꺼번에 풀린다.
     ① **노동이 사라진다.** 5일 회전이면 5일에 한 번 누른다. 매일 누르던 것이 잡음이었다.
     ② **뜻이 하나로 선다.** [물 주기] = "이 시루를 지금 시작한다". 버튼 하나에 뜻 하나다.
     ③ ★**시차가 규칙이 아니라 판단이 된다.** 시루 셋을 다 심어 두고 물을 하루씩 걸러 주면
        거두는 날이 하루씩 어긋난다. 시스템이 시차를 주는 것이 아니라 **손으로 만드는 것**이다.
        그리고 그 어긋남이 곧 돈이다(§겹침) — 가르칠 것이 생긴다.

   ★ **한 번 누르면 시루 하나가 시작한다.** 전부가 아니다. 여기가 시차를 만드는 손이라
     "한 번에 전부"를 기본으로 두면 플레이어가 시차를 영영 못 만든다.
     ⇒ 노동 걱정은 안 남는다: 매일이 아니라 회전당 한 번이고, 시루 셋이면 5일에 세 번이다.
     ⇒ 한꺼번에 시작하고 싶으면 `opt.all` 이다 — 화면이 [전부 주기]를 붙일 수 있다.
     ⚠ **하루 한 번 제한이 없다.** 같은 날 세 번 눌러 셋을 다 시작할 수 있어야 하기 때문이다
       (그게 곧 `opt.all` 과 같은 결과다). 대신 **이미 시작한 시루는 다시 안 받는다** —
       그래서 두 번 눌러도 회전이 앞당겨지지 않는다.

   ⚠ **잊어버린 플레이어가 영영 멈춰 있으면 안 된다.** 벌이 없어진 대신 아무 일도 안 나기
     때문이다. 그래서 **며칠째 안 줬는지를 상태로 낸다**(`idleDays`) — 화면이
     "3일째 물을 안 줬습니다"라고 말할 수 있다. 코어는 숫자만 내고 문장은 안 만든다(UI 몫).

   ★ 축은 그대로다. 이 게임이 가르치는 것은 빛이다.
       자리(빛) = **품질**   어두우면 하얗고 아삭 · 밝으면 초록·쓴맛
       물       = **시작**   준 날이 0일차. 안 주면 시작이 안 된다
     물은 여전히 품질을 못 건드린다 — 시작 안 한 날은 DLI 이력에도 안 쌓인다.

   ★ **죽지 않는다.** 박사님 확정 원칙("초보는 안 죽는다")은 그대로다. 늦어질 뿐이다.
   ★ 대상은 **작물뿐이다. 몬스테라에는 안 건다** (근거는 예전과 같다 — 몬스테라의 속도 축은
     이미 빛이고, 하루 진행은 growth 창 소유다).
============================================================ */

/* 아직 시작 안 한 시루 — 놓여 있고 · 안 거뒀고 · 물을 안 줬다. 먼저 만든 순서대로 낸다. */
function idlePots(b) {
  return potsOf(b).filter(p => !p.harvested && p.startedOnDay == null);
}

/* 물을 준다 = **회전을 시작한다**. 시작할 시루가 없으면 아무 일도 안 하고 조용히 지난다.
     fp   첫 플레이 상태
     day  게임일(S.day). 절대 게임일이라 세이브 왕복에서도 맞는다 — 이 값이 그 회전의 0일차다
     opt.all    true 면 대기 중인 시루를 **전부** 시작한다 (기본은 하나)
     opt.count  몇 개를 시작할지 (기본 1). `all` 이 우선한다
   반환 { watered, already, day, started, startedIds, waiting, idleDays } */
export function waterBeansprout(fp, day, opt = {}) {
  if (!fp || !fp.beansprout) throw new Error('[첫 플레이] 콩나물 상태가 없습니다');
  if (!Number.isInteger(day) || day < 0)
    throw new Error(`[물주기] 게임일이 0 이상의 정수가 아닙니다: ${day}`);
  const b = ensureCropPots(fp.beansprout);
  const idle = idlePots(b);
  if (!idle.length) {
    /* 줄 것이 없다. 고장이 아니라 안내다 — 던지지 않는다(두 번 눌러도 안전).
       `harvested` 는 **전부 거둬져 있나**다: 다시 심어야 물을 줄 것이 생긴다는 뜻이다. */
    syncCropLead(b);
    return { watered: false, already: true, day, started: 0, startedIds: [],
             waiting: 0, idleDays: 0,
             harvested: potsOf(b).length > 0 && potsOf(b).every(p => p.harvested) };
  }
  const want = opt.all ? idle.length
             : Math.max(1, Math.min(idle.length, Math.round(opt.count || 1)));
  const startedIds = [];
  for (let i = 0; i < want; i++) {
    idle[i].startedOnDay = day;
    idle[i].ageDays = 0;
    idle[i].dliHist = [];
    startedIds.push(idle[i].id);
  }
  syncCropLead(b);
  return { watered: true, already: false, day, started: want, startedIds,
           waiting: idle.length - want, idleDays: 0, harvested: false };
}

/* 며칠째 안 줬나 — 대기 중인 시루가 **가장 오래 기다린 날 수**다.
   ⚠ 벌이 아니다(§물주기). 화면이 "3일째 물을 안 줬습니다"라고 말할 근거일 뿐이다.
   기준은 `b.idleSinceDay`(대기가 생긴 날)이고, 그 값이 없으면 셀 수 없으므로 0을 낸다. */
function idleDaysOf(b, day) {
  if (!Number.isInteger(day)) return 0;
  const idle = idlePots(b);
  if (!idle.length) return 0;
  const since = idle.map(p => (Number.isInteger(p.idleSinceDay) ? p.idleSinceDay : day));
  return Math.max(0, day - Math.min(...since));
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

   ★★ **다 자란 뒤에는 아무것도 안 요구한다.** 물은 이미 회전 시작에 한 번 줬고(§물주기),
     `ageDays` 가 만수라 더 올릴 데도 없다. 거둘 때까지 그대로 서 있는다.

   ★★ **한 번에 다 거둔다** (2026-08-04 · 시루가 여럿이 된 뒤). 익은 시루가 셋이면 셋 다 거둔다.
     ⚠ 시루마다 버튼을 누르게 하면 그건 폰에서 노동이다. 그리고 거두는 데에는 **판단이 없다** —
       익은 것을 안 거둘 이유가 없다(안 거두면 다음 회전이 안 시작될 뿐이다).
       판단이 있는 것은 **물주기**(언제 시작하나)뿐이고, 그래서 손이 하나씩인 것도 그쪽뿐이다.
     ⇒ 그래도 한꺼번에 거두면 **겹쳐서 깎인다**(§겹침). 그게 시차를 만들 이유다 —
       규칙으로 막는 대신 **셈으로 보여 준다.**

   ★ 자동수확(`S.perks.autoHarvest`)은 **나중 보상**이다. 지금은 늘 꺼져 있다(state.js §perks).
============================================================ */

/* 지금 거둘 수 있는 시루들. 먼저 시작한 순서대로 낸다 —
   ★ 순서가 곧 **겹침 순번**이다(§겹침): 먼저 심은 것이 먼저 곳간에 들어가 온전한 값을 받는다. */
export function readyCropPots(b) {
  if (!b || !b.slotId) return [];
  const hd = b.harvestDays;
  return potsOf(b).filter(p => potReady(p, hd))
    .sort((x, y) => (x.startedOnDay ?? 0) - (y.startedOnDay ?? 0));
}

/* 거둘 수 있나 — **시루 하나라도** 익었나. 상태를 안 바꾼다.
   ⚠ `b.harvested`(사본)를 안 본다. 그 칸은 "하나라도 거뒀나"라서, 시차 판에서는 거의 늘 true 다 —
     그걸로 막으면 **둘째 시루가 익어도 [수확하기]가 안 뜬다.** 판정은 언제나 pots 를 본다. */
export function beansproutReady(b) {
  return readyCropPots(b).length > 0;
}

/* [수확하기] 버튼을 켤지 흐리게 할지의 근거. **한글 문장은 만들지 않는다**(UI 몫). */
export function beansproutHarvestStatus(fp) {
  const b = fp && fp.beansprout;
  if (!fp || !fp.enabled || !b) return null;
  const pots = potsOf(b);
  const ripe = readyCropPots(b);
  const hd = b.harvestDays || 0;
  /* 자라는 중인 시루 중 가장 빨리 익을 것까지 며칠 — 시작 안 한 시루는 셀 수 없어 안 센다 */
  const growing = pots.filter(p => !p.harvested && p.startedOnDay != null && p.ageDays < hd);
  const nextIn = growing.length
    ? Math.min(...growing.map(p => hd - p.ageDays)) : null;
  return {
    ready: ripe.length > 0,
    canHarvest: ripe.length > 0,
    /* ★ 몇 개를 거두나 — 화면이 "시루 2개 거두기"라고 말할 근거다 */
    readyCount: ripe.length,
    readyIds: ripe.map(p => p.id),
    placed: !!b.slotId,
    harvested: !!b.harvested,
    ageDays: b.ageDays || 0,
    harvestDays: hd,
    daysLeft: Math.max(0, hd - (b.ageDays || 0)),
    nextReadyInDays: nextIn,
    growingCount: growing.length,
    /* ★ 다시 심어야 할 시루 수. `state.resowCrop` 의 `harvestedCount` 와 **같은 셈**이라
       화면이 "몇 개를 심나"를 물어볼 데가 생긴다 — 안 그러면 UI 가 pots 를 직접 뒤져
       같은 규칙을 두 곳에 적게 된다(시차가 들어오면서 `b.harvested` 하나로는 모자라다). */
    harvestedCount: pots.filter(p => p.harvested).length,
    idleCount: idlePots(b).length,
    sirus: Math.max(1, pots.length || Math.round(b.sirus || 1)),
    cycle: b.cycle || 1
  };
}

/* 물을 줄(=회전을 시작할) 시루가 있나 · 며칠째 안 줬나 — 화면 버튼 문구용.
   **한글 문장은 만들지 않는다**(UI 몫). */
export function beansproutWaterStatus(fp, day) {
  const b = fp && fp.beansprout;
  if (!fp || !fp.enabled || !b) return null;
  const pots = potsOf(b);
  const idle = idlePots(b);
  const startedToday = Number.isInteger(day) && pots.some(p => p.startedOnDay === day);
  const idleDays = idleDaysOf(b, day);
  return {
    /* ★ 새 규칙에서 "오늘 줬나"는 더는 회전을 가르지 않는다 — 표시용으로만 남긴다 */
    wateredToday: startedToday,
    startedToday,
    /* 놓았고 · 아직 시작 안 한 시루가 있으면 줄 것이 있다.
       ⚠ **다 자란 시루는 애초에 대기가 아니다** — 물은 회전당 한 번이라 이미 줬다(§물주기). */
    needsWater: !!b.slotId && idle.length > 0,
    /* 몇 개가 시작을 기다리나 — 화면이 "시루 2개가 아직 안 자랍니다"를 말할 근거 */
    waiting: idle.length,
    idleIds: idle.map(p => p.id),
    /* ★ 며칠째 안 줬나. 벌이 아니라 **알림의 근거**다(§물주기 ⚠) */
    idleDays,
    /* 옛 이름 — 화면(game.html)이 아직 `dryRun` 을 읽는다. 뜻은 "며칠째 밀렸나"로 같다.
       ⚠ 새 이름은 `idleDays` 다. 화면이 갈아타면 이 칸은 지운다. */
    dryRun: idleDays,
    ready: beansproutReady(b),
    placed: !!b.slotId,
    /* **전부** 거둬져 있나 = 다시 심어야 줄 것이 생긴다 */
    harvested: pots.length > 0 && pots.every(p => p.harvested),
    wateredOnDay: b.wateredOnDay ?? null,
    sirus: Math.max(1, pots.length),
    ageDays: b.ageDays || 0,
    harvestDays: b.harvestDays || 0
  };
}

/* 하루 공개 경계. 입력을 먼저 검증하고 나서만 상태를 바꾼다.
     dli   그날 그 자리의 조도 — 시루 전부가 **같은 자리**에 있으므로 한 값이다
   ★★ 2026-08-04 새 규칙 — `opt.watered` 가 사라졌다. **물을 준(=시작한) 시루만 나이를 먹는다.**
     시작 안 한 시루는 하루가 가도 그대로다. 마른 날을 세지 않는다 — 그런 개념이 없어졌다(§물주기).
     인자는 받되 무시한다(옛 호출부가 안 깨진다).
   ★ **여기서 거두지 않는다.** 자라는 날이 차면 `ready:true` 로 서고,
     거두는 것은 `harvestBeansprout`(=[수확하기] 버튼)의 몫이다(위 §수확). */
export function advanceBeansproutDay(fp, dli, opt = {}) {
  if (!fp.beansprout.slotId) throw new Error('[첫 플레이] 콩나물 자리를 먼저 정해 주세요');
  if (!validDli(dli)) throw new Error(`[첫 플레이] 콩나물 DLI가 올바르지 않습니다: ${dli}`);
  const rules = fp.rules;
  if (!rules) throw new Error('[첫 플레이] 밸런스 계약이 없습니다');
  const b = ensureCropPots(fp.beansprout);
  const hd = rules.harvestDays;

  let grew = 0, justReady = 0;
  for (const p of potsOf(b)) {
    /* 거뒀거나 · 아직 시작 안 했거나 · 이미 다 자랐으면 오늘 아무 일도 안 난다 */
    if (p.harvested || p.startedOnDay == null || p.ageDays >= hd) continue;
    p.ageDays++;
    /* ★ 이력은 **자란 날의 빛**만 쌓는다 — 시작 안 한 시루의 하루는 그 콩나물의 하루가 아니다.
       이 한 줄이 "물이 품질(빛 축)을 못 건드린다"의 실제 구현이다. */
    p.dliHist.push(dli);
    grew++;
    if (p.ageDays === hd) justReady++;
  }
  syncCropLead(b);

  const idle = idlePots(b).length;
  const alreadyHarvested = potsOf(b).length > 0 && potsOf(b).every(p => p.harvested);
  return {
    harvested: false,
    alreadyHarvested,
    /* 오늘 몇 시루가 자랐나 · 오늘 **막** 익은 시루가 몇인가 */
    grew,
    justReadyCount: justReady,
    /* ★ 오늘 익은 시루가 있나 · 오늘 **막** 익었나 — 둘을 가른다.
       빨리감기가 서는 것은 `justReady`(전환) 쪽이다. `ready` 로 세우면 안 거둔 채로
       다시 감을 때마다 첫날에 또 서서 빨리감기가 못 돈다. */
    ready: beansproutReady(b),
    justReady: justReady > 0,
    /* ★★ 마른 날 대신 **시작 대기**다 (2026-08-04). 물을 줄 수 있는데 안 준 시루 수 —
       벌이 아니라 "아직 시작을 안 했다"는 사실이다. 빨리감기가 여기를 본다(loop.js §물주기). */
    idle,
    ageDays: b.ageDays,
    daysLeft: Math.max(0, hd - b.ageDays)
  };
}

/* ★★ 거둔다 — **[수확하기] 버튼이 부르는 함수** (2026-08-04 신설. 위 §수확).
   ------------------------------------------------------------
   예전에는 `advanceBeansproutDay` 안에서 자동으로 일어났다. 이제는 손 동작이다.
   ⚠ 몬스테라 선물은 여기 없다 — 그건 `io.growth` 를 쓰므로 loop.harvestCrop 이 맡는다.
     여기서는 `phase = 'monstera_gift'` 로 **문만 연다**(예전과 같은 자리다).
   반환은 예전 `advanceBeansproutDay` 의 수확 반환과 **같은 모양**이다 — 화면·재현이 안 깨진다. */
export function harvestBeansprout(fp, opt = {}) {
  if (!fp || !fp.beansprout) throw new Error('[수확] 콩나물 상태가 없습니다');
  const b = fp.beansprout;
  const rules = fp.rules;
  if (!rules) throw new Error('[수확] 밸런스 계약이 없습니다');
  if (!b.slotId) {
    const e = new Error('[수확] 시루를 먼저 방 안에 놓아 주세요');
    e.tutorialInput = true; throw e;
  }
  ensureCropPots(b);
  const ripe = readyCropPots(b);
  if (!ripe.length) {
    const hd = rules.harvestDays;
    const growing = potsOf(b).filter(p => !p.harvested && p.startedOnDay != null && p.ageDays < hd);
    const idle = idlePots(b).length;
    const e = new Error(
      growing.length
        ? `[수확] 아직 ${Math.min(...growing.map(p => hd - p.ageDays))}일 더 자라야 합니다 ` +
          `(${b.ageDays}/${hd}일)`
        : idle
          ? `[수확] 아직 물을 안 준 시루가 ${idle}개 있습니다 — 물을 줘야 회전이 시작됩니다`
          : '[수확] 이미 거둔 시루입니다 — 다시 심어야 또 거둡니다');
    e.tutorialInput = true;                 // 안내지 고장이 아니다
    throw e;
  }

  /* ★ 곳간에 넣고 **매일 조금씩** 꺼내 먹는다(eatFromPantry). 수확한 날 몰아 쓰지 않는다.
     ★ 남는 것은 **버려진다. 팔지 않는다.** 콩나물은 냉장 3~4일이면 쉬는 채소라 쌓이지 않는다
       (docs/food_economy.md 머리말 — 지출 방어이지 수입이 아니다).
     ⚠ 한도는 **시루 수 × 한 회전분**이다 (2026-08-04). 시루 n개면 도는 회전이 n개이므로
       곳간에 들어올 수 있는 것도 n회전분이다. 예전처럼 한 회전분으로 두면 시루를 늘리는
       순간 대부분이 쉬어서 버려져 **겹침 체감이 재기도 전에 상한이 먼저 잘라 버린다.** */
  const capWon = pantryCapWon(fp);

  /* ★★ 겹침 순번은 **그날 몇 번째로 거두는가**다(§겹침).
     [수확하기]는 익은 시루를 한 번에 다 거두므로 보통 이 한 번의 셈으로 끝난다. 그래도
     같은 날 두 번 불릴 수 있으니(자동수확 보상·화면 두 번 누름) **게임일로 이어 센다** —
     안 이으면 같은 날 두 번 거둔 둘째가 순번 0으로 잡혀 규칙이 조용히 새어 나간다. */
  const day = Number.isInteger(opt.day) ? opt.day : null;
  let onDay = (day != null && fp.food.harvestDay === day)
    ? Math.max(0, Math.round(fp.food.harvestedOnDay || 0)) : 0;

  const perPot = [];
  let savedTotal = 0, spoiledTotal = 0, lostTotal = 0;
  for (const p of ripe) {
    const hist = p.dliHist;
    const avgDli = hist.length ? hist.reduce((sum, v) => sum + v, 0) / hist.length : 0;
    const quality = rules.quality.find(q => avgDli <= q.maxDli);
    const overlapIndex = onDay++;
    const fullWon = cropCycleSavedWon(rules, quality.meals, 0);
    const savedWon = overlapSavedWon(rules, quality.meals, overlapIndex);
    /* 겹쳐서 못 받은 몫 — 화면이 "곳간이 안 비어 N원을 못 받았습니다"를 말할 근거다 */
    const lostWon = Math.max(0, fullWon - savedWon);

    let pantry = (fp.food.pantryWon || 0) + savedWon;
    const spoiledWon = Math.max(0, pantry - capWon);
    pantry -= spoiledWon;
    fp.food.pantryWon = pantry;

    p.harvested = true;
    p.avgDli = avgDli;
    p.quality = quality.id;
    p.meals = quality.meals;                 // ★ 품질 **라벨**(3·2·1끼). 값은 원으로 매긴다
    p.harvestMeals = quality.meals;
    p.harvestCount = (p.harvestCount || 0) + 1;
    p.savedWon = savedWon;
    p.overlapIndex = overlapIndex;
    /* 다음 회전을 위해 시작 표시를 지운다 — 다시 심고 물을 줘야 또 돈다 */
    p.startedOnDay = null;

    savedTotal += savedWon;
    spoiledTotal += spoiledWon;
    lostTotal += lostWon;
    perPot.push({ id: p.id, avgDli, quality: quality.id, qualityKo: quality.ko,
                  meals: quality.meals, overlapIndex, savedWon, fullWon, lostWon, spoiledWon });
  }

  syncCropLead(b);
  const lead = perPot[0];
  fp.food.lastHarvestMeals = lead.meals;
  fp.food.lastSpoiledWon = spoiledTotal;
  if (day != null) { fp.food.harvestDay = day; fp.food.harvestedOnDay = onDay; }
  /* ★ 여기서 **먹지 않는다.** 곳간에 넣기만 하고, 꺼내 먹는 것은 다음 [다음 날] 의 eatFromPantry 다
     (2026-08-04 정정 — 수확이 손 동작이 되면서 거두는 순간과 하루 정산이 갈렸다).
     ⚠ 여기서 한 입 꺼내면 **하루에 두 번 먹는 날**이 생긴다: 다 자란 날의 [다음 날] 이
       지난 회전의 마지막 몫을 이미 꺼낸 뒤라, 같은 날 또 꺼내면 하루 상한이 그 자리에서 깨진다. */
  /* ★ 선물은 **첫 수확에만** 온다. 두 번째 시루에서 몬스테라가 또 오면 안 된다. */
  if (!fp.monstera.arrived) fp.phase = 'monstera_gift';

  return {
    harvested: true,
    /* 대표 시루(먼저 시작한 것)의 결과 — 옛 이름 그대로다. 화면·배움이 이걸 읽는다 */
    avgDli: lead.avgDli,
    quality: lead.quality,
    qualityKo: lead.qualityKo,
    meals: lead.meals,
    sirus: Math.max(1, potsOf(b).length),
    /* ★ 이번에 몇 시루를 거뒀나 · 그 합계가 얼마인가 */
    harvestedPots: ripe.length,
    perPot,
    cycleSavedWon: savedTotal,
    /* ★★ 겹쳐서 못 받은 몫. 화면이 "곳간이 안 비어 있어 덜 받았습니다"를 말할 근거다 —
       예전 `wastedSirus`(시루를 늘려도 안 늘어난 몫)를 대신한다. 이제 손해는 시루 수가 아니라
       **거두는 때가 겹친 것**에서 온다(§겹침). */
    overlapLostWon: lostTotal,
    overlapCount: perPot.filter(x => x.overlapIndex > 0).length,
    spoiledWon: spoiledTotal,
    cycleDays: rules.harvestDays,
    harvestCount: b.harvestCount,
    cashFoodWon: fp.food.cashFoodWon
  };
}

/* 곳간 한도 — **시루 수 × 한 회전분**. 시루가 n개면 도는 회전도 n개다. */
export function pantryCapWon(fp) {
  const rules = fp && fp.rules;
  if (!rules) return 0;
  const n = Math.max(1, potsOf(fp.beansprout).length);
  return rules.cropSavedWonPerCycle * n;
}

/* 하루에 곳간에서 꺼낼 수 있는 상한 — **시루 수와 무관한 한 값**이다 (2026-08-04).
   ★ 값의 정본은 `rules.dailyCropSaveWon`(= 한 회전분, 끼니 상한이 이기면 그 값)이고
     근거는 firstPlayRulesFromBalance 의 주석에 있다. 시루 수에 안 비례하는 이유:
     **비례시키면 겹침이 물리지 않는다.** 시루 5개를 같은 날 다 거둬도 상한이 5배면
     깎인 값(3,000+2,000+1,000)을 전부 다 먹어 버려 "짜임새"가 아무 일도 안 하게 된다.
     천장은 주기 길이가 정하고(§겹침), 그 천장이 곧 하루 한 회전분이다. */
export function dailyCropSaveWonOf(fp) {
  const rules = fp && fp.rules;
  return rules ? rules.dailyCropSaveWon : 0;
}

/* ★ 오늘의 밥 — 곳간에서 하루치만 꺼내 쓴다 (2026-08-03 신설 · 2026-08-04 원 단위로).
   ------------------------------------------------------------
   한 회전이 낸 절감(3,000원)을 **회전 일수로 고르게 나눠** 먹는다. 하루 상한 600원이
   그 나눗셈이다(`rules.dailyCropSaveWon`). 몰아 쓰지 않는 이유는 예전과 같다 —
   "5일 주기로 3,000원"은 5일에 걸쳐 아끼는 것이지 하루에 3,000원을 아끼는 것이 아니다.

   ★ **매일** 불린다. 수확한 날도 포함이다(2026-08-04 정정) — 수확이 곳간에 넣고,
     같은 턴에 이 함수가 그날 몫을 꺼낸다. 예전처럼 수확일만 따로 계산하면 규칙이 둘이 된다.
   ★ 곳간이 비면 절감은 0이다. **물을 늦게 줘 회전이 늦어지면 여기서 빈 날이 생긴다** —
     물주기의 값이 돈으로 보이는 자리이고, 따로 만든 벌점이 아니다.
   ★★ 상한은 **시루 수에 비례한다** (2026-08-04 · dailyCropSaveWonOf). 근거는 그 함수 주석 참고. */
export function eatFromPantry(fp) {
  const zero = { savedWon: 0, foodSavedWon: 0, mealsUsed: 0 };
  if (!fp || !fp.enabled || !fp.rules || !fp.food) return zero;
  const rules = fp.rules;
  const use = Math.min(dailyCropSaveWonOf(fp), Math.max(0, Math.round(fp.food.pantryWon || 0)));
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
     opt.at        자리를 옮기려면. placeBeansprout 과 같은 세 가지 입력을 받는다
     opt.day       다시 심는 날 (게임일). 대기 시작일로만 쓴다 — **물은 안 준다**

   ★★ 2026-08-04 — **거둔 시루만 다시 심는다.** 시차 판에서는 늘 일부만 거둬져 있고,
     자라는 중인 시루까지 갈아엎으면 시차가 그 자리에서 무너진다(그리고 진행을 잃는다).
   ★★ **다시 심어도 물은 안 준다.** 새 규칙에서 물은 회전 시작이라(§물주기), 여기서 자동으로
     주면 회전이 늘 같은 날 시작되어 **시차를 만들 손이 사라진다.** 심는 것과 시작하는 것은
     다른 동작이고, 그 사이의 간격이 곧 플레이어가 쥔 눈금이다.
   ★ 씨앗값은 **다시 심는 시루 수**만큼 든다(다 자란 것을 갈아엎지 않으므로 헛돈이 안 나간다). */
export function resowBeansprout(fp, opt = {}) {
  if (!fp || !fp.beansprout) throw new Error('[첫 플레이] 콩나물 상태가 없습니다');
  const b = ensureCropPots(fp.beansprout);
  const rules = fp.rules;
  if (!rules) throw new Error('[첫 플레이] 밸런스 계약이 없습니다');

  const had = potsOf(b).length;
  const sirus = opt.sirus == null ? had : opt.sirus;
  if (!Number.isInteger(sirus) || sirus < 1)
    throw new Error(`[콩나물] 시루 수가 1 이상의 정수가 아닙니다: ${sirus}`);
  if (Number.isFinite(opt.maxSirus) && sirus > opt.maxSirus)
    throw new Error(`[콩나물] 시루를 놓을 칸이 ${opt.maxSirus}칸뿐입니다 — ${sirus}개는 못 놓습니다 ` +
                    `(시루 선반을 놓으면 늘어납니다)`);

  const added = Math.max(0, sirus - had);
  const harvestedPots = potsOf(b).filter(p => p.harvested);
  if (!harvestedPots.length && !added)
    throw new Error('[콩나물] 아직 수확하지 않은 시루입니다 — 수확한 뒤에 다시 심습니다');

  const day = Number.isInteger(opt.day) ? opt.day : 0;

  /* ★ **이력을 비운다.** 지난 회전의 DLI 는 이번 콩나물이 받은 빛이 아니다 —
     남겨 두면 밝은 데서 한 번 망친 판이 어두운 데로 옮겨도 평균이 안 내려가 영영 못 배운다. */
  for (const p of harvestedPots) {
    p.harvested = false;
    p.ageDays = 0;
    p.dliHist = [];
    p.quality = null;
    p.meals = 0;
    p.avgDli = null;
    p.harvestMeals = 0;
    p.savedWon = 0;
    p.overlapIndex = 0;
    p.startedOnDay = null;                  // ★ 물을 줘야 다시 돈다
    p.idleSinceDay = day;
    p.cycle = (p.cycle || 1) + 1;
  }
  /* 시루를 더 샀으면 **빈 시루로** 붙는다 — 새 칸도 물을 줘야 시작한다 */
  for (let i = 0; i < added; i++)
    b.pots.push(makeCropPot(`${BEANSPROUT_ID}_${String(had + i + 1).padStart(2, '0')}`,
                            { idleSinceDay: day }));
  /* 시루를 줄였으면 **거둔 것부터** 뺀다 — 자라는 중인 회전을 버리지 않는다 */
  if (sirus < had) {
    const keep = [...potsOf(b)].sort((x, y) => (y.ageDays || 0) - (x.ageDays || 0)).slice(0, sirus);
    b.pots = potsOf(b).filter(p => keep.includes(p));
  }

  const resown = harvestedPots.length + added;
  const seedCostWon = resown * rules.seedWonPerSiru;
  syncCropLead(b);

  /* 자리를 다시 고를 수 있다 — 이게 ②(막다른 길)의 실제 해법이다.
     placeBeansprout 은 거둔 시루가 남아 있으면 막으므로 **위에서 되살린 뒤에** 부른다. */
  if (opt.at != null && opt.at !== '') placeBeansprout(fp, opt.at, opt);

  return { sirus: potsOf(b).length, resown, added, cycle: b.cycle, seedCostWon,
           slotId: b.slotId, at: b.at, wateredOnDay: b.wateredOnDay };
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
       다시 true 가 되므로 "몇 번째 수확인가"를 세야 첫 수확과 그 뒤를 가를 수 있다.
       ★ 2026-08-04 — **시루 전부의 합계**다(syncCropLead). 시차 판에서는 시루마다 따로
         거둬지므로, 대표 한 칸만 세면 둘째·셋째 시루의 수확이 사건에서 통째로 빠진다. */
    harvestCount: fp.beansprout ? (fp.beansprout.harvestCount || 0) : 0,
    cycle: fp.beansprout ? (fp.beansprout.cycle || 1) : 1,
    /* ★ 시작을 기다리는 시루 수 — 물이 회전 시작이 되면서 생긴 칸이다(§물주기).
       빨리감기가 "물을 줄 수 있는데 안 준 시루가 새로 생겼나"를 여기로 본다(loop.js). */
    idle: fp.beansprout ? idlePots(fp.beansprout).length : 0,
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
  /* ★★ 물을 안 줘서 **아직 시작도 안 했다** (2026-08-04 새 규칙 · §물주기).
     여기서 날짜를 세면 거짓말이 된다 — 며칠을 넘겨도 안 온다. 다음에 올 것은 손이다. */
  if (b && idlePots(b).length && !potsOf(b).some(p => p.startedOnDay != null && !p.harvested))
    return { id: 'crop_needs_water', ko: '물을 줘야 자라기 시작합니다', etaDays: null,
             waiting: idlePots(b).length,
             note: '물을 준 날이 0일차입니다 — 시루마다 따로 시작할 수 있습니다' };
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
