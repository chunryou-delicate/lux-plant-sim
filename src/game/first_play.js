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

   ★★ 2026-08-05 — **2종째(무순)를 들였다.** 자리만 있던 2,000원이 이제 실제로 돈다.
   ------------------------------------------------------------
   ★ 왜 무순인가 — **빛이 반대라서**다. 이것 하나가 고른 이유의 전부다.
     콩나물은 어두워야 한다(시루가 차광 용기인 이유다). 그래서 작물이 콩나물뿐이면
     자리 고르기가 "아무 데나 어두운 데"로 끝나 **자리라는 축이 식비에서는 죽어 있다.**
     무순은 빛을 봐야 떡잎이 파래지고 알싸한 맛이 난다 — 어두우면 웃자라 희멀겋고 밍밍하다
     (농사로·농업기술센터: *"웃자람 방지를 위해 식물용LED로 보완"*).
     ⇒ 무순을 들이는 순간 **밝은 자리를 몬스테라와 다툰다.** "등보다 자리"가 식비에서도 산다.
     ⚠ 실측(반지하): 등이 없으면 DLI 1.0 을 넘는 자리가 `banjiha-sill:0`(3.77) **하나뿐**이고
       나머지는 전부 0.48 이하다. 그런데 몬스테라는 die 0.5 · survive 1.2 · min 3 이라
       창턱 말고는 갈 곳이 아예 없다 — **등을 사기 전에는 창턱을 나눠 쓸 수 없다.**
       식물등(2.5만원)을 사면 선반 3~5칸이 1.88~2.22 로 올라 무순 자리가 열린다.
       ⇒ 식물등에 **두 번째 이유**가 생긴다(지금은 몬스테라 전용이다).

   ★ 왜 7일인가 — 근거 둘.
     ① 현실이 그렇다. 농사로 *"발아 후 약 일주일 뒤 수확"* · *"빠르면 1주 길어도 2주"*.
        떡잎이 나오고 본잎이 나오기 전에 거둔다.
     ② ★**5와 서로소다.** 콩나물 5일 · 무순 7일이라 거두는 날이 35일에 한 번만 다 겹친다.
        주기가 나눠떨어지면(예: 10일) 겹침이 규칙적으로 되풀이돼 짤 것이 없다.
        서로소면 **엇갈렸다 겹쳤다** 하고, 그 달력을 읽는 것이 플레이어의 일이 된다.

   ★★ **3종은 안 넣었다.** 억지로 못 넣은 것이 아니라 **정본이 막는다** — 아래
     `firstPlayRulesFromBalance` 의 `dailyCropSaveWon` 이 `Math.min` 으로 끼니 상한을 지킨다:
       2종 : 3,000 + 1,867 = 4,867원 ≤ 끼니 상한(2끼 × 2,500원 = 5,000원) — 아슬하게 안 걸린다
       3종 : + 933 = 5,800원 > 5,000원 → **상한이 이겨서 하루 저감이 안 는다**
     ⚠ 2026-08-09 무순 회전분이 2,000 → 2,800×2/3 = **1,867원**이 되면서 2종 합계가
       5,000 에서 4,867 로 내려갔다. 예전 주석의 "정확히 딱"은 이제 틀린 말이다.
     3종째는 씨앗값·용기값만 더 나가고 절감은 한 푼도 안 는다. 재 봤고(tools/probe_crop_cases.mjs
     `--kinds3`), 그래서 안 넣는다. 표에는 1,000원 자리를 **그대로 남긴다** — 끼니 상한이
     올라가는 캐릭터(가장·주부는 household 4 라 상한이 20,000원이다)에서는 3종째가 살아난다.

   ★ 칸의 뜻
       harvestDays   한 회전이 자라는 날 (물을 준 날이 0일차)
       seedWonPerPot 한 판/한 시루를 다시 심을 때 드는 씨앗 **정가**.
                     ★ 2026-08-09 — `shop.CATALOG` 가 **이 칸을 그대로 읽는다.** 값을 두 곳에
                       적던 것을 한 곳으로 모았다(정본이 두 벌이라 넉 달째 갈려 있었다).
                     ⚠ 지갑에서 나가는 값은 정가가 아니라 `shop.buyPriceOf` = 정가 × 1.4 를
                       100원 단위로 올린 것이다. 350원 → **실구매 500원**.
       savedWonPerCycle ★ 2026-08-09 신설 — 이 작물 한 회전이 내는 **작물 기본값**.
                     질림이 **하나도 안 붙은** 값이다. 실제 절감은 여기에 §질림 배율을 곱한다.
       wantsLight    true = 밝아야 좋다(무순) · false = 어두워야 좋다(콩나물)
       quality       DLI 대역 → 품질. `minDli` 이상 · `maxDli` 이하일 때 그 대역이다.
                     ★ 두 작물이 **같은 눈금(0.3 · 1.0)을 반대 방향으로** 쓴다.
                       한쪽이 3끼인 자리가 다른 쪽은 1끼다 — 그래야 자리가 진짜 선택이 된다.
============================================================ */
export const CROP_KINDS = Object.freeze([
  Object.freeze({
    id: 'beansprout', ko: '콩나물',
    containerId: 'siru', containerKo: '시루',
    seedItemId: 'bean_seed', containerItemId: 'siru',
    harvestDays: 5,
    /* ★★ 2026-08-09 박사님 확정 — **실구매 700 → 500원.**
       ⚠ 이 칸은 **정가**다. 실구매가는 `shop.buyPriceOf` = ceil(정가 × 1.4 / 100) × 100 이라
         실구매 500원을 만들려면 정가는 **350원**이다(500 → 정가 350 · 350×1.4 = 490 → 올림 500).
         정가에 500 을 그대로 적으면 실구매가 700원이 되어 아무것도 안 바뀐다. */
    seedWonPerPot: 350,
    /* ★ 콩나물 한 회전의 작물 기본값 — 3,000원 그대로다(2026-08-04 확정 · plan §1 표). */
    savedWonPerCycle: 3_000,
    wantsLight: false,
    quality: Object.freeze([
      Object.freeze({ minDli: 0, maxDli: 0.3, id: 'crisp_white', ko: '하얗고 아삭', meals: 3 }),
      Object.freeze({ minDli: 0, maxDli: 1.0, id: 'slightly_green', ko: '살짝 초록', meals: 2 }),
      Object.freeze({ minDli: 0, maxDli: Infinity, id: 'green_bitter', ko: '초록·쓴맛', meals: 1 })
    ])
  }),
  Object.freeze({
    id: 'musun', ko: '무순',
    containerId: 'sprout_tray', containerKo: '새싹 재배판',
    seedItemId: 'radish_seed', containerItemId: 'sprout_tray',
    harvestDays: 7,
    /* ★ 무씨 실제 시세 100g 1,758원 · 1kg 18,000원(=1,800원/100g). 한 판(20×30cm)에 20~30g 쓰므로
       350~530원이다. 그 한가운데인 **400원**으로 잡았다 — 콩(500원)보다 씨가 잘아 조금 덜 든다. */
    seedWonPerPot: 400,
    /* ★★ 2026-08-09 박사님 확정 — 무순 한 회전의 작물 기본값 **2,800원.**
       원문: *"무순이 좀 더 낮아서 그 회전분을 2800원 정도로."*
       ⚠ 예전에는 이 값이 `cropKindSavedWon[1] = 2,000` 이었는데 그 표는 **겹침 벌**에도
         같이 쓰였다 — 거기를 2,800 으로 고치면 콩나물 둘째까지 같이 세진다.
         그래서 표를 「작물 기본값 × 질림 배율」로 갈랐다(아래 §질림). 질림은 여전히 한 표다. */
    savedWonPerCycle: 2_800,
    wantsLight: true,
    /* ★ 콩나물 표를 **뒤집은 것**이다. 눈금(0.3 · 1.0)까지 같다 —
       같은 자리를 두 작물이 정반대로 읽어야 "어디에 무엇을 놓나"가 셈이 된다.
       ⚠ 어두워도 **죽지 않는다**(콩나물과 같은 사상). 웃자라 밍밍해질 뿐이다. */
    quality: Object.freeze([
      Object.freeze({ minDli: 1.0, maxDli: Infinity, id: 'green_crisp', ko: '파릇하고 알싸', meals: 3 }),
      Object.freeze({ minDli: 0.3, maxDli: Infinity, id: 'pale_green', ko: '덜 파랗다', meals: 2 }),
      Object.freeze({ minDli: 0, maxDli: Infinity, id: 'leggy_bland', ko: '웃자라 밍밍', meals: 1 })
    ])
  })
  /* 3종 자리 — 위 ★★ 참고. 끼니 상한이 막고 있어 지금은 비워 둔다. */
]);

/* ============================================================
   ★★★ 질림 배율 — **순번이 뒤로 갈수록 깎인다** (2026-08-09 · 표를 가른 자리)
   ------------------------------------------------------------
   예전에는 `cropKindSavedWon = [3,000 · 2,000 · 1,000]` **한 표**가 두 가지 일을 겸했다:
     ① 작물 **종류** 순번 — 콩나물 다음에 들인 것은 2,000, 그다음은 1,000
     ② 같은 날 거두는 **겹침** 순번 — 그날 둘째는 2,000, 셋째는 1,000
   그래서 무순 회전분만 2,800 으로 내리려고 `[1]` 을 건드리면 **콩나물 겹침 벌까지** 같이
   움직였다. 값 하나에 뜻이 둘이면 한쪽만 고칠 수가 없다.

   ⇒ 값을 두 축으로 갈랐다:
       작물 기본값   `CROP_KINDS[i].savedWonPerCycle`  — 콩나물 3,000 · 무순 2,800
       질림 배율     아래 표                            — 첫째 1 · 둘째 2/3 · 셋째 1/3 · 넷째부터 0
       실제 절감 = 작물 기본값 × 질림 배율 × (품질 끼니 / 3)

   ★★ **질림은 여전히 한 표다.** 2026-08-04 박사님 확정 *"둘을 다른 표로 만들면 안 된다.
     줄어드는 이유가 같기 때문이다 — 질림이다"* 가 안 깨진다. 가른 것은 「질림」이 아니라
     「작물마다 다른 값」이다 — 그건 애초에 질림이 아니었는데 같은 표에 얹혀 있었다.
     ★ 이 저장소는 이미 그 길로 갔다: `harvestDays` 와 `seedWonPerPot` 은 벌써
       `CROP_KINDS` 로 옮겨져 있었고, 회전분만 안 옮겨져 있었다. 이제 셋이 같은 자리에 있다.

   ⚠ **2/3 · 1/3 이지 0.667 · 0.333 이 아니다.** 인계에 적힌 0.667/0.333 은 소수로 적은 것이고,
     그대로 곱하면 콩나물 둘째가 2,000 이 아니라 **2,001원**이 된다 — 2026-08-04 에 확정된
     3,000/2,000/1,000 이 1원씩 어긋난다. 뜻한 값은 정확한 삼분의 이·삼분의 일이다.
   ★ 배열 길이가 곧 "몇 번째까지 값이 붙나"다. 넷째부터는 0 — 질려서 더는 못 먹는다.
     들고 오긴 왔는데 먹을 마음이 안 드는 것이라 셈이 0이다(버린 것과는 다르다).
============================================================ */
export const CROP_TIRED_MULTIPLIER = Object.freeze([1, 2 / 3, 1 / 3, 0]);

/* 순번 → 질림 배율. 표 밖(넷째 이상)은 0 이다 — 없는 칸을 지어내지 않는다. */
export function cropTiredMultiplier(rules, index) {
  const t = (rules && rules.cropTiredMultiplier) || CROP_TIRED_MULTIPLIER;
  const i = Math.max(0, Math.round(index || 0));
  return i < t.length ? t[i] : 0;
}

/* 순번별 작물 기본값 표. 작물이 모자란 칸(3종째)은 **마지막 작물의 기본값**을 쓴다 —
   그 칸이 실제로 쓰이는 곳은 「없는 3종째 작물」이 아니라 「무순을 같은 날 둘째로 거둠」이다. */
function cropBases(defs = CROP_KINDS) {
  const n = Math.max(defs.length, 3);
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = defs[i] || defs[defs.length - 1];
    out.push((d && d.savedWonPerCycle) || 0);
  }
  return Object.freeze(out);
}

/* 옛 이름 `cropKindSavedWon` 이 가리키던 표를 **파생**으로 낸다 (화면·검사·재현이 읽는다).
   칸 i = 기본값[i] × 질림배율[i]. */
function derivedKindSavedWon(bases = cropBases(), tired = CROP_TIRED_MULTIPLIER) {
  return Object.freeze(bases.map((b, i) => Math.round(b * (i < tired.length ? tired[i] : 0))));
}

/* 작물 기본값 — 질림이 **하나도 안 붙은** 한 회전분.
   ★ 규칙 사본이 옛 표(`cropKindSavedWon`)를 **손으로 덮어썼으면** 거기서 되풀어 낸다.
     그 표는 `기본값 × 질림배율` 이라 배율로 나누면 기본값이 돌아온다. 이 길이 있어야
     회전분을 훑는 재현(`tools/probe_econ.mjs`·`probe_three_layers.mjs`)이 계속 듣는다 —
     그 도구들은 `cropKindSavedWon` 을 갈아 끼워 회전분을 바꾼다.
   ⚠ 덮어쓴 것이 아니라 **파생 그대로**면 되나누지 않는다. 파생표는 원 단위로 반올림돼 있어서
     되나누면 2,800 이 **2,800.5** 로 돌아온다. 그래서 "이 표가 선언된 기본값에서 나온
     그대로인가"를 먼저 본다 — 맞으면 기본값을 그냥 쓴다. */
export function cropBaseSavedWonOf(rules, kindIndex = 0) {
  const i = Math.max(0, Math.round(kindIndex || 0));
  const bases = (rules && rules.cropBaseSavedWon) || FIRST_PLAY_RULES.cropBaseSavedWon;
  const table = rules && rules.cropKindSavedWon;
  if (Array.isArray(table) && Number.isFinite(table[i])) {
    const m = cropTiredMultiplier(rules, i);
    const b = bases[i];
    if (Number.isFinite(b) && Math.round(b * m) === table[i]) return b;
    return m > 0 ? table[i] / m : 0;
  }
  return bases[i] ?? 0;
}

/* 종류 표를 이름으로 · 순번으로 찾는다. **모르는 이름은 던진다** — 조용히 콩나물로 굴리면
   값이 3,000원으로 잘못 붙고 그 판이 통째로 틀린 살림이 된다. */
export function cropKindOf(kindId) {
  const k = CROP_KINDS.find(v => v.id === kindId);
  if (!k) throw new Error(`[작물] 모르는 작물입니다: ${kindId} ` +
                          `(아는 것: ${CROP_KINDS.map(v => v.id).join(', ')})`);
  return k;
}
export function cropKindIndexOf(kindId) {
  const i = CROP_KINDS.findIndex(v => v.id === kindId);
  if (i < 0) throw new Error(`[작물] 모르는 작물입니다: ${kindId}`);
  return i;
}

/* 그 자리의 빛이 낸 품질. **작물마다 표가 다르다**(콩나물은 어두울수록 · 무순은 밝을수록).
   위에서부터 처음 맞는 대역을 쓴다 — 표가 좋은 것부터 적혀 있다. */
export function cropQualityOf(kindId, avgDli) {
  const table = cropKindOf(kindId).quality;
  const v = Number.isFinite(avgDli) ? avgDli : 0;
  return table.find(q => v >= (q.minDli ?? 0) && v <= (q.maxDli ?? Infinity)) ||
         table[table.length - 1];
}

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
  /* ★ 2026-08-05 — 정본이 `CROP_KINDS[0].harvestDays` 로 옮겨 갔다(작물마다 주기가 다르다).
     여기 칸은 **그것을 가리키는 사본**이다 — 값을 두 곳에 적으면 하나가 조용히 낡는다. */
  harvestDays: CROP_KINDS[0].harvestDays,
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
  /* ★ 2026-08-05 — 정본은 `CROP_KINDS[0].seedWonPerPot` 이다(작물마다 씨앗값이 다르다). */
  seedWonPerSiru: CROP_KINDS[0].seedWonPerPot,
  /* ★★ 질림 배율 — 순번이 뒤로 갈수록 깎인다. 정본은 위 §질림 이다.
     이 표는 **두 곳에서 같이 쓴다**(2026-08-04 박사님 확정 · 아래 §겹침):
       ① 작물 **종류**가 늘 때 — 콩나물 다음에 들인 것은 ×2/3, 그다음은 ×1/3
       ② 거두는 **때가 겹칠** 때 — 같은 날 둘째는 ×2/3, 셋째는 ×1/3
     둘을 다른 표로 만들면 안 된다. 줄어드는 **이유가 같기 때문**이다 — 질림이다. */
  cropTiredMultiplier: CROP_TIRED_MULTIPLIER,
  /* ★ 순번별 **작물 기본값** — 질림이 안 붙은 값. 정본은 `CROP_KINDS[i].savedWonPerCycle` 이고
     여기 칸은 그것을 가리키는 사본이다(순번 표로 펴 둔 것뿐). [3,000 · 2,800 · 2,800] */
  cropBaseSavedWon: cropBases(),
  /* ★★ 옛 이름 — 이제 **파생값**이다 (2026-08-09 · 위 §질림).
     [0]=콩나물 3,000 · [1]=무순 2,800×2/3=1,867 · [2]=(작물 없음)2,800×1/3=933.
     ⚠ 여기 숫자를 손으로 고치지 마라. 회전분을 바꾸려면 `CROP_KINDS[i].savedWonPerCycle` 을,
       깎이는 폭을 바꾸려면 위 `CROP_TIRED_MULTIPLIER` 를 고치는 것이다.
     ★ 그래도 이 칸을 남긴 이유 — 화면(`game.html`)·검사·재현이 `cropKindSavedWon[0]` 을
       「한 회전분」으로 읽고 있다. 이름을 없애면 그것들이 조용히 0 을 읽는다. */
  cropKindSavedWon: derivedKindSavedWon(),
  /* 품질 배수의 분모. 최상 품질(3끼)이 그 종류의 기본값을 그대로 낸다.
     ★ 끼니는 **품질 라벨로 남는다** — "하얗고 아삭 3끼"라는 말이 절감액보다 눈에 잘 들어온다.
       값은 원으로 매기되 비율은 예전 그대로다(3 : 2 : 1 = 3,000 : 2,000 : 1,000원). */
  qualityMaxMeals: 3,
  /* ★ 2026-08-05 — 정본이 `CROP_KINDS[0].quality` 로 옮겨 갔다(작물마다 표가 다르다).
     여기 칸은 **그것을 가리키는 사본**이다 — 값을 두 곳에 적지 않는다.
     옛 호출부(`rules.quality`)가 그대로 도는 이유가 이 한 줄이다. */
  quality: CROP_KINDS[0].quality,

  /* ============================================================
     ★★★ 잉여 채소를 넘기는 값 — **정가의 몇 %인가** (2026-08-06 신설 · 아래 §잉여 판매)
     ------------------------------------------------------------
     ★★ 2026-08-09 박사님 확정 — **0.70 → 0.85.**
       정본은 `data/balance/characters.json._meta.cropSurplusSaleRate` 다. 여기 값은 그 파일을
       못 읽는 판(순수 모듈·검사 하네스)을 위한 **폴백**이고, 둘이 같은지는
       `tools/test_econ.mjs` 가 매번 확인한다 — 다르면 검사가 깨진다.
     ★ 0.85 가 왜 위끝인가 — 1.00 을 넘기면 「밥으로 먹는 것보다 파는 게 낫다」가 되어 이 게임의
       뼈대가 뒤집힌다. 0.85 는 그 아래이면서 「씨앗값보다는 살짝 이득」을 크게 넘긴다.

     ★ 값이 왜 여기 있나 — `data/balance/` 는 이 창 소유가 아니라 못 고친다.
       `cropKindSavedWon`(3,000/2,000/1,000)도 같은 이유로 여기 있고, 그 칸 바로 옆이
       이 값의 자연스러운 자리다. 둘은 같은 표를 읽는 한 쌍이기 때문이다 —
       한 회전분이 **밥으로** 얼마인가(위)와 **돈으로** 얼마인가(여기).
     ★ 옮길 자리도 정해 둔다: 확정되면 `characters.json._meta.cropSurplusSaleRate` 로 간다.
       `firstPlayRulesFromBalance` 가 **이미 그 칸을 먼저 읽는다** — 정본이 생기는 날
       이 줄은 기본값(폴백)으로 조용히 물러난다. 그때 코드는 한 글자도 안 고쳐도 된다.

     ★ 어느 값이 말이 되나 — 손익분기가 바닥이다(`shop.cropBreakEvenRate`).
         콩나물 700원 / 3,000원 = **23.3%**   ← 이 아래는 씨앗값도 못 건진다
         무순   600원 / 2,000원 = **30.0%**
       econgap 실측: 시작 140만 + 콩13 에서 50%면 여유 +1일 · 60%면 +3일 · **70%면 +9일**.
       ⇒ 「씨앗 비용보다는 살짝 이득」(박사님)이 70% 언저리에서 성립한다.
     ★ 서사로도 100% 가 아니어야 한다 — 이건 **떨이**다. 곳간이 못 받아 버릴 것을
       이웃·가게에 헐값으로 넘기는 것이라 제값을 못 받는 편이 앞뒤가 맞는다. */
  cropSurplusSaleRate: 0.85
});

export const FIRST_PLAY_ASSETS = Object.freeze({
  monsteraPotDiameterM: 0.202
});

/* ★ 자유 좌표일 때 계약 열쇠에 붙는 이름 (2026-08-03).
   콩나물 시루는 S.pots 에 없는 물건이라 화분 id 를 빌려 쓸 수 없다 — 자기 이름을 갖는다.
   `free:crop_01` 이 그대로 하루치 계약(daily_light/1)의 slotId 가 되고 세이브에도 남는다. */
export const BEANSPROUT_ID = 'crop_01';
/* ★ 2종째 자리 이름 (2026-08-05). 콩나물과 **다른 자리**라 자기 이름을 갖는다 —
   빛 요구가 정반대라 한 자리를 나눠 쓸 수 없다(위 §작물 종류). `free:crop_02` 가
   그대로 하루치 계약(daily_light/1)의 slotId 가 되고 세이브에도 남는다. */
export const MUSUN_ID = 'crop_02';
/* 작물 종류 → 자리 이름. 새 작물이 생기면 여기 한 줄이다. */
export const CROP_SITE_IDS = Object.freeze({ beansprout: BEANSPROUT_ID, musun: MUSUN_ID });
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
   실제 적용 여부는 leaf-to-house 계약대로 lid_state가 closed일 때다. 첫 플레이는 open만 허용한다.

   ★★ 2026-08-09 — **가방 그림만 「뚜껑 덮인 시루」로 가른다** (박사님 지시).
     가방 카드는 "아직 아무것도 안 선 **빈 시루**"라고 말하는데 그림은 콩나물이 다 자란
     열린 시루였다 — 글과 그림이 서로 다른 말을 했다.
     ★ 근거: 콩나물 시루는 원래 **차광 용기**라 뚜껑을 덮어 기른다. 그래서 뚜껑 덮인 모습이
       「아직 안 심은 것」으로 자연스럽고, 열린 시루는 「자라는 중」의 그림이 된다.
     ⚠ **방에 선 시루는 그대로 열린 시루다.** 바뀌는 것은 가방 칸의 그림 하나뿐이다 —
       3D(room_view 의 container_siru_open.glb)도 `thumbnail` 도 안 건드린다.
     ⚠ 자리·치수 판정도 **열린 시루 것을 그대로 쓴다**(diameterM · transmitsSlotDli).
       뚜껑 덮인 에셋은 높이만 다르고(0.19 vs 0.109) 세울 물건은 여전히 열린 시루다. */
export function openSiruContractFromManifest(manifest) {
  const items = Array.isArray(manifest) ? manifest : manifest && manifest.items;
  const of = lid => items && items.find(v => v && v.kind === 'siru' && v.crop === 'beansprout' &&
    v.lid_state === lid && v.source_2d && v.size_m);
  const item = of('open');
  if (!item || !item.size_m || !Number.isFinite(item.size_m.w) || !Number.isFinite(item.size_m.d) || !item.source_2d)
    throw new Error('[첫 플레이] 열린 콩나물 시루 에셋 계약이 올바르지 않습니다');
  /* 뚜껑 덮인 짝이 없으면 **열린 그림으로 물러난다** — 그림 하나 때문에 첫 플레이가 못 열리면
     안 된다. 대신 조용히 넘어가지 않게 사유를 실어 둔다(`bagLidState`). */
  const closed = of('closed');
  return Object.freeze({
    id: item.id,
    lidState: item.lid_state,
    diameterM: Math.max(item.size_m.w, item.size_m.d),
    thumbnail: `./assets/crops/thumbs/${item.source_2d}`,
    /* ★ 가방(빈 용기) 칸의 그림. 화면은 **이 칸을** 읽는다 — 파일 이름을 화면에 적지 않는다. */
    bagThumbnail: closed ? `./assets/crops/thumbs/${closed.source_2d}`
                         : `./assets/crops/thumbs/${item.source_2d}`,
    bagLidState: closed ? 'closed' : 'open',
    transmitsSlotDli: item.lid_state === 'open'
  });
}

/* ★ 한 회전이 내는 절감액 — **품질이 배수를 정한다** (2026-08-04).
   자리(빛)가 품질을 정하고 품질이 값을 정한다. 그 사슬은 예전 그대로이고, 끝만 끼니에서 원으로 바뀌었다.
     colspan  종류 순번(0 = 첫 작물). CROP_KINDS 의 자리와 같다.
     meals    품질표가 낸 끼니(3·2·1) — 여기서는 **배수**로만 쓴다 */
/* ★★ 2026-08-09 — 인자가 **둘로 갈렸다**(위 §질림).
     tiredIndex  질림 순번 = 종류 순번 + 그 종류의 그날 순번
     kindIndex   어느 작물인가 (기본값은 tiredIndex — 옛 호출부는 둘이 같은 뜻이었다)
   ⇒ 겹침을 셀 때는 **작물은 그대로인데 순번만 민다.** 예전에는 순번을 밀면 작물도 같이
     밀려서, 콩나물 둘째가 「무순의 값」을 받고 있었다. 표가 하나였을 때는 그게 안 보였다. */
export function cropCycleSavedWon(rules, meals, tiredIndex = 0, kindIndex = tiredIndex) {
  const maxMeals = rules.qualityMaxMeals || FIRST_PLAY_RULES.qualityMaxMeals;
  return Math.round(cropBaseSavedWonOf(rules, kindIndex) *
                    cropTiredMultiplier(rules, tiredIndex) *
                    Math.max(0, meals) / maxMeals);
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
export function overlapSavedWon(rules, meals, indexOnDay, kindIndex = 0) {
  const t = Math.max(0, Math.round(indexOnDay || 0));
  return cropCycleSavedWon(rules, meals, kindIndex + t, kindIndex);
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
  /* ★ 지금 실제로 도는 종류만 센다 — 배열에 값이 셋 있어도 작물이 둘이면 앞 두 값뿐이다.
     쓰지 않는 값을 합계에 넣으면 "있지도 않은 작물이 아껴 주는" 살림이 된다. */
  const kinds = CROP_KINDS.length;
  const cropSavedWonPerCycle = FIRST_PLAY_RULES.cropKindSavedWon
    .slice(0, kinds).reduce((a, b) => a + b, 0);
  /* ★★ 잉여 판매가 — **정본이 생기면 그쪽을 먼저 읽는다** (2026-08-06 · §잉여 판매).
     지금은 `characters.json._meta` 에 이 칸이 없어서 늘 폴백으로 떨어진다. 그래도 이 세 줄을
     지금 두는 이유: 값이 확정되어 `_meta` 로 옮겨지는 날 **코드를 안 고쳐도 되게** 하려는 것이다.
     ⚠ 0 ≤ rate 만 본다. 위끝을 안 막는 이유는 1.0(제값)이 말이 되는 값이기 때문이다 —
       막아야 할 것은 위가 아니라 **손익분기 아래**이고, 그건 값이 아니라 판단이라
       여기서 던지지 않고 `shop.cropBreakEvenRate` 로 **재서 보여 준다.** */
  const rateFromMeta = meta && meta.cropSurplusSaleRate;
  if (rateFromMeta != null && (!Number.isFinite(rateFromMeta) || rateFromMeta < 0))
    throw new Error('[첫 플레이] characters.json의 잉여 판매가(cropSurplusSaleRate)가 올바르지 않습니다');
  return Object.freeze({
    ...FIRST_PLAY_RULES,
    cropSurplusSaleRate: rateFromMeta ?? FIRST_PLAY_RULES.cropSurplusSaleRate,
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
    cropKinds: kinds,
    /* ★★ **끼니 상한이 지금 이기고 있나** (2026-08-05 신설).
       종류를 늘려도 하루 저감이 안 느는 순간이 여기다. 숫자를 재는 자(probe)와 화면이
       "왜 안 늘었나"를 말할 근거가 있어야 억지로 상한을 뚫는 일이 안 생긴다.
       자취생(1인)은 2종에서 5,000 = 5,000 으로 **딱 맞고**, 3종째부터 막힌다.
       가장·주부(4인)는 상한이 20,000원이라 3종째도 그대로 산다. */
    cropCapBinding: cropSavedWonPerCycle > dailyCropMealCap * (dailyFoodWon / mealsPerDay),
    cropMealCapWon: dailyCropMealCap * (dailyFoodWon / mealsPerDay),
    /* 종류 표를 규칙에 실어 준다 — 부르는 쪽이 first_play 를 또 import 하지 않아도 되게 */
    cropKindDefs: CROP_KINDS
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
    /* ★★ **자리는 시루마다 따로다** (2026-08-09 박사님 지시 "각개 움직이고 각개 물주고").
       ------------------------------------------------------------
       위 §시루마다 자기 회전 이 "자리는 여전히 하나다"라고 적어 둔 그 줄이 여기서 뒤집혔다.
       그때 든 근거 셋은 **하나씩 다 무너졌다**:
         ① "시차는 시간의 축이지 자리의 축이 아니다" — 맞다. 그런데 자리를 쪼개도 시차는
            그대로다(startedOnDay 는 시루마다 이미 따로다). 자리가 하나여서 얻은 것은 없었고,
            잃은 것이 있었다: 시루 12개가 **한 덩어리로 붙어** 서서 자리 한도에 맞춰
            통째로 찌그러졌다(multisiru §6 — 서랍장 위에서 시루 한 개가 10.4cm 가 됐다).
         ② "조도 계약·방뷰·자유 배치가 slotId 하나를 전제한다" — 계약은 `placedItems(S)` 가
            내는 목록이고, 목록에 시루를 **여러 줄** 싣는 것은 삽수가 이미 하고 있었다.
            조도 엔진은 한 줄도 안 고친다. 목록이 길어질 뿐이다.
         ③ "현실이 그렇다 — 시루 셋은 같은 선반에 나란히 둔다" — 그건 **놓는 사람의 선택**이지
            규칙이 아니다. 나란히 두고 싶으면 나란히 놓으면 된다.
       ⇒ `slotId` = 계약 열쇠 · `at` = 좌표 정본. 화분(S.pots[])과 **같은 두 칸**이다.
       ⚠ 둘 다 null = **아직 안 놓았다(가방에 있다)**. 그 시루는 자라지 않고 계약에도 안 실린다. */
    slotId: opt.slotId ?? null,
    at: opt.at ?? null,
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
  /* ★★ 2종째부터는 **빈 자리를 채우지 않는다** (2026-08-05). 콩나물 시루 하나는 게임을
     시작할 때 받은 것이라 "적어도 하나"가 옛 세이브의 사실이지만, 무순 재배판은 **사야
     생긴다.** 여기서 지어내면 안 산 판이 공짜로 굴러가 살림이 통째로 틀린다. */
  const siteId = CROP_SITE_IDS[kindIdOfSite(b)] || BEANSPROUT_ID;
  if (kindIdOfSite(b) !== 'beansprout') { b.pots = Array.isArray(b.pots) ? b.pots : []; return b; }
  const n = Math.max(1, Math.round(b.sirus || 1));
  const started = Number.isInteger(b.wateredOnDay) ? b.wateredOnDay : null;
  b.pots = [];
  for (let i = 0; i < n; i++) {
    /* ★★ 옛 판의 시루들은 **자리 하나에 무리로** 서 있었다(§자리는 시루마다 따로다).
       그래서 옛 자리를 시루마다 그대로 베낀다 — 지어내는 값이 아니라 **그때의 사실**이다.
       ⚠ 좌표(`at`)도 같이 베낀다. 좌표만 빠지면 옛 판의 시루가 추천 자리로 순간이동한다.
       ⚠ 무리가 겹쳐 서는 것은 맞다 — 옛 판이 실제로 그랬고, 옮기면 그때부터 갈라진다. */
    const p = makeCropPot(`${siteId}_${String(i + 1).padStart(2, '0')}`,
                          { startedOnDay: started, cycle: b.cycle || 1,
                            slotId: b.slotId ?? null,
                            at: b.at ? { ...b.at } : null });
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

/* ★ 그 시루가 방에 서 있나 — 자리(계약 열쇠)든 좌표든 하나라도 있으면 서 있는 것이다.
   `game.html` 의 `sits()` 와 **같은 판정**이다. 두 곳이 어긋나면 화면과 규칙이 갈린다. */
export function cropPotPlaced(p) { return !!(p && (p.slotId || p.at)); }
/* 방에 실제로 서 있는 시루만 — 자라는 것도 · 물을 받는 것도 · 계약에 실리는 것도 이것뿐이다 */
export function placedCropPots(b) { return potsOf(b).filter(cropPotPlaced); }
/* ★ 아직 안 놓은 시루 — **가방에 있는 빈 용기**다 (2026-08-09).
   ⚠ 이것과 상점 재고(`stockOf(S,'siru')`)는 **다른 물건이 아니다.** 둘 다 "가방의 빈 시루"이고,
     이쪽은 처음에 받은 하나처럼 **이미 개체가 만들어진** 것뿐이다. 화면은 둘을 더해 센다. */
export function idleCropPots(b) { return potsOf(b).filter(p => !cropPotPlaced(p) && !p.harvested); }
/* id 로 시루 하나 찾기 — 없으면 null(모르는 id 를 묻는 것은 고장이 아니다) */
export function cropPotOf(b, potId) {
  return potsOf(b).find(p => p && p.id === potId) || null;
}

/* ★★ 자리 사본을 시루로 **내려 준다** (2026-08-09).
   ------------------------------------------------------------
   옛 모양(자리에만 `slotId`/`at` 이 적히고 시루는 자리를 모르는 상태)이 어느 길로 들어와도
   정본(pots)이 비어 있지 않게 한다. `ensureCropPots` 는 pots 가 이미 있으면 손을 안 대므로
   (두 번 불러도 안전해야 세이브·복원이 안 꼬인다) 그 틈을 이 함수가 막는다.
   ⚠ **아무 시루도 안 놓여 있을 때만** 내려 준다. 하나라도 놓여 있으면 사본이 낡은 쪽이고,
     그때 내려 주면 각개로 흩어 놓은 판이 한 자리로 뭉친다 — 정확히 이번에 없앤 그 증상이다. */
export function adoptCropSpotToPots(site) {
  if (!site) return site;
  const pots = potsOf(site);
  if (!pots.length) return site;
  if (!(site.slotId || site.at)) return site;
  if (pots.some(cropPotPlaced)) return site;
  for (const p of pots) {
    p.slotId = site.slotId ?? null;
    p.at = site.at ? { ...site.at } : null;
  }
  return site;
}

/* ============================================================
   ★★ 작물 자리(site) — **종류마다 하나** (2026-08-05 · 2종째가 들어오며 신설)
   ------------------------------------------------------------
   ★ 왜 자리를 쪼갰나. 예전에는 `beansprout.slotId` 하나에 시루가 전부 나란히 섰다
     (§시루마다 자기 회전). 그 전제는 "시루들은 빛이 같아도 된다"였고 실제로 그랬다 —
     한 종류뿐이었으니까. **무순은 빛 요구가 정반대다.** 같은 자리에 세우면 한쪽은
     반드시 최악 품질이 된다. 자리가 하나면 두 작물이 있어도 고를 것이 없다.
   ⇒ 자리는 **종류마다 하나**, 그 안의 시루/판들은 예전처럼 한 자리를 나눠 쓴다.

   ★★ 이름을 안 바꿨다 — `fp.beansprout` 이 0번 자리다.
     ------------------------------------------------------------
     종류가 늘었으니 `beansprout` 은 이제 계통 전체의 이름으로는 **거짓말**이다.
     그래도 안 바꾼 근거 셋(전부 재 봤다):
       ① **세이브가 그 이름이다.** `save.js:packFirstPlay` 가 `firstPlay.beansprout.*` 를
          칸마다 이름으로 검증하며 적는다. 바꾸면 옛 판이 안 열린다 — 열리게 하려면
          이전(migration) 코드를 또 만들어야 하는데, 그건 이 일이 사려던 값이 아니다.
       ② **화면이 그 이름을 읽는다.** `game.html` · `room_view.js` 가
          `fp.beansprout.ageDays` 같은 칸을 직접 읽는데 **그 두 파일은 이 창 소유가 아니다.**
          이름을 바꾸면 내가 못 고치는 파일이 그 순간 깨진다.
       ③ 바꿔서 얻는 것이 **읽기 편함뿐**이다. 셈도 규칙도 한 줄 안 나아진다.
     ⇒ 대신 **거짓말을 여기 적어 둔다**: `fp.beansprout` = 0번 자리(콩나물),
       `fp.crops` = 1번부터의 자리들. 둘을 합쳐 보는 창구가 `cropSites(fp)` 하나다.
       ⚠ 새 코드는 `cropSites`/`cropSiteOf` 만 쓴다. `fp.beansprout` 를 직접 읽는 것은
         **옛 호출부(화면·세이브)뿐**이고, 그쪽이 갈아타면 이 칸은 지운다.
============================================================ */
export function makeCropSite(kindId, opt = {}) {
  const k = cropKindOf(kindId);
  return {
    kind: k.id,
    /* slotId = 계약 열쇠 · at = 좌표 정본. 화분(S.pots[])과 같은 두 칸이다. */
    slotId: opt.slotId ?? null,
    at: opt.at ?? null,
    /* ★ 자라는 날은 **작물이 정한다** — 콩나물 5일 · 무순 7일(§작물 종류) */
    harvestDays: k.harvestDays,
    pots: [],
    /* ── 아래는 전부 `pots[대표]` 의 읽기용 사본이다(syncCropLead 가 채운다) ── */
    ageDays: 0, dliHist: [], harvested: false, quality: null, meals: 0, avgDli: null,
    sirus: 0, cycle: 1, harvestCount: 0, harvestMeals: 0, wateredOnDay: null
  };
}

/* ★ 지금 방에서 도는 작물 자리 전부. **0번이 콩나물**이고 순서는 CROP_KINDS 순서다 —
   그 순서가 곧 겹침표의 순번(3,000 → 2,000)이라 흐트러지면 값이 달라진다. */
export function cropSites(fp) {
  if (!fp) return [];
  const out = [];
  if (fp.beansprout) out.push(fp.beansprout);
  for (const s of (fp.crops || [])) if (s) out.push(s);
  return out;
}

/* 그 종류의 자리. 없으면 null — 던지지 않는다(아직 안 들인 작물을 묻는 것은 고장이 아니다) */
export function cropSiteOf(fp, kindId) {
  return cropSites(fp).find(s => (s.kind || 'beansprout') === kindId) || null;
}

/* 자리 하나가 어느 종류인가 — 옛 세이브에서 온 자리는 `kind` 가 없다. 그때는 콩나물이다. */
function kindIdOfSite(site) { return (site && site.kind) || 'beansprout'; }

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
  /* ★★ 대표는 **놓인 시루 중에서** 고른다 (2026-08-09 · §자리는 시루마다 따로다).
     가방에 있는 빈 시루가 대표가 되면 `b.slotId` 가 null 이 되어 — 방에서 멀쩡히 자라는
     시루가 있는데도 — 물주기·수확·하루 진행이 통째로 "자리를 먼저 정하세요"로 막힌다.
     ⚠ 하나도 안 놓였을 때만 안 놓인 것이 대표다. 그때는 `b.slotId` 가 null 인 것이 맞다. */
  const placed = pots.filter(cropPotPlaced);
  const pool = placed.length ? placed : pots;
  const lead = pool.slice().sort((x, y) => {
    const rx = potReady(x, hd) ? 1 : 0, ry = potReady(y, hd) ? 1 : 0;
    if (rx !== ry) return ry - rx;
    return (y.ageDays || 0) - (x.ageDays || 0);
  })[0];
  /* ★ 자리도 사본으로 남긴다 — 옛 호출부(세이브·화면·빨리감기)가 `b.slotId` 로
     "놓았나"를 묻는다. 정본은 `pots[].slotId` 다. */
  b.slotId = lead.slotId ?? null;
  b.at = lead.at ?? null;
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
    /* ★ 0번 자리 = 콩나물. 이름은 옛것 그대로다(위 §작물 자리 ★★). */
    kind: 'beansprout',
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
    /* ★★ 1번부터의 작물 자리 (2026-08-05 · §작물 자리). **판은 비어 있다** —
       무순 재배판은 상점에서 사야 생긴다(콩나물 시루 하나만 받고 시작한다).
       ⚠ 자리 객체는 처음부터 있다. 없으면 "아직 안 산 작물"과 "모르는 작물"이 같은 모양이 되어
         화면이 무순을 목록에 못 띄운다 — 살 수 있다는 것 자체가 정보다. */
    crops: CROP_KINDS.slice(1).map(k => makeCropSite(k.id)),
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
      /* 못 먹고 쉬어 버린 몫. 한 회전분보다 많이 쌓이면 여기로 빠진다.
         ★ 2026-08-06 — *"팔지 않는다"* 였던 줄이다. 이제 **이 몫만** 팔린다(§잉여 판매).
           바뀐 것은 「채소를 판다」가 아니라 「버릴 것을 버리지 않는다」다 — 곳간(끼니)은
           그대로이고, 곳간이 **못 받은 것**에만 값이 붙는다. */
      lastSpoiledWon: 0,
      /* ★★ 아직 안 넘긴 잉여 — **정가 기준 누적**이다 (2026-08-06 · §잉여 판매).
         거둘 때마다 `overlapLostWon + spoiledWon` 이 여기 쌓이고, [잉여 팔기]가 비운다.
         ⚠ **원이지 채소가 아니다.** 곳간(pantryWon)과 달리 여기 있는 값은 절대로 밥이 안 된다 —
           애초에 곳간이 못 받은 몫이라 끼니로 돌아갈 길이 없다. 그래서 쌓아 둬도
           「썩는 채소를 창고에 재는」 그림이 아니라 **아직 안 받은 떨이값**이다.
         ⚠⚠ **아직 세이브에 안 실린다.** `save.js` 는 이 창 소유가 아니라 못 고쳤다 —
           `packFirstPlay` 의 `food` 칸이 열쇠를 하나하나 적는 모양이라, 여기 칸을 늘려도
           저장하면 사라진다(실제로 확인했다: 저장 → 불러오기 뒤 0원). 안 넘긴 잉여를 안고
           저장하면 그만큼 잃는다. 고칠 세 줄은 인계 문서 `cropsale-to-plan.md §세이브` 에 있다.
         ⚠ 그래서 `takeCropSurplus` 는 **거래를 두 쪽으로 안 나눈다** — 비우는 것과 값을 내는 것이
           한 번에 끝난다. 중간 상태가 있으면 그 사이에 저장하는 판이 생긴다. */
      surplusWon: 0,
      lastSurplusWon: 0,             // 직전 수확이 낸 잉여 (표시용)
      totalSurplusSoldWon: 0         // 지금까지 실제로 받은 돈 (판매가를 곱한 뒤의 값)
    },
    monstera: {
      arrived: false,
      /* ★ 정본은 **화분 쪽**(S.pots[0].slotId · .at)이다. 여기 둘은 첫 플레이 화면이 보는 사본이다 —
         튜토리얼 안내가 화분 배열을 뒤지지 않게 두려고 남긴다. 판정에는 쓰지 않는다. */
      slotId: null,
      at: null,
      growthPhase: null,
      guide: newMonsteraGuide()
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
  return placeCrop(fp, opt.kind || 'beansprout', target, opt);
}

/* ★ 종류를 골라 놓는다 (2026-08-05). `placeBeansprout` 은 이 함수의 콩나물 전용 옛 이름이다.
   ★★ **자리는 종류마다 따로다** — 빛 요구가 정반대라 한 자리를 나눠 쓸 수 없다(§작물 자리).
     그래서 무순을 놓아도 콩나물 자리는 안 건드린다. */
/* ★★ 2026-08-09 — `opt.potId` 를 주면 **그 시루 하나만** 움직인다 (§자리는 시루마다 따로다).
     안 주면 예전 그대로 **자리의 시루 전부**가 함께 간다. 옛 호출부(추천 자리 드롭다운 ·
     `resowBeansprout(opt.at)` · 옛 검사)가 그 뜻이었고, 그것을 깨면 무리째 옮기던 판이
     시루 하나만 옮겨 놓고 나머지를 잃어버린 것처럼 보인다.
   ⚠ 자리를 못 잡은(`at` 이 null 인) 시루도 계약 열쇠(slotId)는 갖는다 — 옛 규칙 그대로다. */
export function placeCrop(fp, kindId, target, opt = {}) {
  const k = cropKindOf(kindId);
  const site = fp && cropSiteOf(fp, k.id);
  if (!site) throw new Error(`[첫 플레이] ${k.ko} 상태가 없습니다`);
  if (target == null || target === '')
    throw new Error(`[첫 플레이] ${k.ko}을(를) 둘 자리를 골라 주세요`);
  ensureCropPots(site);

  /* 움직일 시루를 먼저 정한다 — **하나만인가 전부인가**가 이 함수의 유일한 갈림길이다 */
  const one = opt.potId ? cropPotOf(site, opt.potId) : null;
  if (opt.potId && !one)
    throw new Error(`[첫 플레이] 모르는 ${k.containerKo}입니다: ${opt.potId}`);
  const targets = one ? [one] : potsOf(site);
  if (!targets.length) throw new Error(`[첫 플레이] 놓을 ${k.containerKo}가 없습니다`);

  /* ★ 수확 잠금도 **시루마다**다. 예전에는 자리 사본(`site.harvested` = 하나라도 거뒀나)으로
     막아서, 시루 셋 중 하나만 거둬도 **나머지 둘까지 못 움직였다.** */
  for (const p of targets)
    if (p.harvested)
      throw new Error(`[첫 플레이] 이미 수확한 ${k.containerKo}는 옮길 수 없습니다`);

  /* ★ 계약 열쇠는 **시루 id 로** 짓는다 — 자유 좌표면 `free:crop_01_02` 가 된다.
     자리 id 하나(`crop_01`)를 쓰면 시루 둘이 같은 열쇠로 계약에 실려 뒤엣것이 앞엣것을 덮는다.
     ⚠ 무리째 옮길 때도 시루마다 제 열쇠를 갖는다 — 같은 좌표에 겹쳐 서도 열쇠는 달라야 한다. */
  let moved = false, keptDays = 0, spot = null;
  for (const p of targets) {
    spot = spotOf(target, { id: p.id, ...opt });
    if (p.slotId != null && p.slotId !== spot.slotId) moved = true;
    p.slotId = spot.slotId;
    /* 좌표를 못 세운 경우(얇은 슬롯 · 좌표 없는 헤드리스 표)는 **null 로 남긴다.** 지어내면
       그 시루만 방 한가운데로 순간이동한다 — 그때는 예전처럼 slotId 로 돈다. */
    p.at = spot.at;
    keptDays = Math.max(keptDays, (p.dliHist || []).length);
  }
  syncCropLead(site);
  /* 단계는 **콩나물이 정한다** — 첫 플레이의 안내 흐름은 콩나물 한 줄기다(§단계).
     무순은 튜토가 끝난 뒤에 들이는 것이라 안내 단계를 건드리면 흐름이 뒤로 되감긴다.
     ★★ 2026-08-09 고침 — **몬스테라가 온 뒤에는 안 되감는다.** 회전이 도는 판에서
       시루를 다시 심을 때마다 이 줄이 `move_monstera`(=옮겨 보세요)를 `grow_beansprout` 로
       덮어써서, 도착 이틀 만에 몬스테라 안내가 화면에서 사라졌다(재현으로 확인).
       콩나물 회전은 튜토가 끝난 뒤에도 계속 도는데 안내 단계는 앞으로만 가야 한다. */
  if (k.id === 'beansprout' && !(fp.monstera && fp.monstera.arrived)) fp.phase = 'grow_beansprout';
  return { ...site, kind: k.id, potId: one ? one.id : null, moved, keptDays,
           snappedTo: spot.snappedTo, dist: spot.dist };
}

/* ★★ **빈 시루 하나를 새로 들인다** (2026-08-09 · 박사님 "하나씩 따로따로 설치").
   ------------------------------------------------------------
   가방에서 끌어다 놓을 때 부르는 창구다. 재고를 빼는 것은 **호출부**(state.placeSiru)가
   한다 — 이 모듈은 지갑도 가방도 안 만진다(§다시 심는다 의 그 규약 그대로).
     opt.at / opt.slotId  놓을 자리 (없으면 가방에 있는 채로 만들어진다)
     opt.day              들인 날 (대기 시작일)
   ⚠ 물은 안 준다. 놓는 것과 시작하는 것은 다른 동작이다(§물주기). */
export function addCropPot(fp, kindId, opt = {}) {
  const k = cropKindOf(kindId);
  const site = fp && cropSiteOf(fp, k.id);
  if (!site) throw new Error(`[첫 플레이] ${k.ko} 상태가 없습니다`);
  ensureCropPots(site);
  const day = Number.isInteger(opt.day) ? opt.day : 0;
  /* ★ id 는 **안 겹치게** 짓는다. 개수로 세면 중간을 걷어낸 판에서 같은 id 가 두 번 난다 —
     그 순간 세이브의 안정 열쇠가 무너진다(방뷰가 두 그루를 한 열쇠로 잡는다). */
  const used = new Set(potsOf(site).map(p => p.id));
  const base = CROP_SITE_IDS[k.id];
  let n = potsOf(site).length + 1, id = '';
  do { id = `${base}_${String(n).padStart(2, '0')}`; n++; } while (used.has(id));
  const p = makeCropPot(id, { idleSinceDay: day });
  site.pots.push(p);
  syncCropLead(site);
  return p;
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
/* ★ 2026-08-09 — **방에 선 것만** 센다(§자리는 시루마다 따로다). 가방의 빈 시루는
   물을 기다리는 것이 아니라 **놓이기를** 기다리는 것이다. 섞으면 화면이
   "물을 주세요"라고 말하는데 물 줄 시루가 방에 없는 판이 난다. */
function idlePots(b) {
  return placedCropPots(b).filter(p => !p.harvested && p.startedOnDay == null);
}

/* 물을 준다 = **회전을 시작한다**. 시작할 시루가 없으면 아무 일도 안 하고 조용히 지난다.
     fp   첫 플레이 상태
     day  게임일(S.day). 절대 게임일이라 세이브 왕복에서도 맞는다 — 이 값이 그 회전의 0일차다
     opt.all    true 면 대기 중인 시루를 **전부** 시작한다 (기본은 하나)
     opt.count  몇 개를 시작할지 (기본 1). `all` 이 우선한다
   반환 { watered, already, day, started, startedIds, waiting, idleDays } */
export function waterBeansprout(fp, day, opt = {}) {
  /* ★ `opt.kind` 로 종류를 고른다 (2026-08-05). 없으면 콩나물 — 옛 호출부가 안 깨진다.
     ⚠ **한 번에 한 종류만** 시작한다. 두 작물을 같이 시작하는 버튼을 만들면 그날이 두 작물의
       0일차가 되어 7일·5일이 계속 같이 돌고, 서로소로 잡은 뜻(§작물 종류)이 사라진다. */
  const kindId = opt.kind || 'beansprout';
  const k = cropKindOf(kindId);
  const site = fp && cropSiteOf(fp, kindId);
  if (!site) throw new Error(`[첫 플레이] ${k.ko} 상태가 없습니다`);
  if (!Number.isInteger(day) || day < 0)
    throw new Error(`[물주기] 게임일이 0 이상의 정수가 아닙니다: ${day}`);
  const b = ensureCropPots(site);
  /* ★★ 2026-08-09 — `opt.potIds` 를 주면 **그 시루만** 시작한다 (박사님 "각개 물주고").
     안 주면 예전 그대로 먼저 만든 순서대로 하나(또는 `all`)를 시작한다. */
  const only = Array.isArray(opt.potIds) && opt.potIds.length ? new Set(opt.potIds) : null;
  const idle = only ? idlePots(b).filter(p => only.has(p.id)) : idlePots(b);
  if (!idle.length) {
    /* 줄 것이 없다. 고장이 아니라 안내다 — 던지지 않는다(두 번 눌러도 안전).
       `harvested` 는 **전부 거둬져 있나**다: 다시 심어야 물을 줄 것이 생긴다는 뜻이다. */
    syncCropLead(b);
    return { watered: false, already: true, day, started: 0, startedIds: [],
             kind: kindId, kindKo: k.ko, waiting: 0, idleDays: 0,
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
           kind: kindId, kindKo: k.ko, harvestDays: k.harvestDays,
           /* ★ 남은 대기는 **다시 세어** 낸다 — `opt.potIds` 로 고른 판에서는
              고른 목록의 나머지가 아니라 **자리 전체의 나머지**가 답이다 */
           waiting: idlePots(b).length, idleDays: 0, harvested: false };
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
  if (!b) return [];
  const hd = b.harvestDays;
  /* ★ 2026-08-09 — 자리 검사가 **자리 하나**에서 **시루마다**로 내려왔다(§자리는 시루마다 따로다).
     예전 `if (!b.slotId) return []` 을 그대로 두면 대표가 가방에 있는 판에서
     방에서 다 자란 시루가 통째로 안 보인다. */
  return placedCropPots(b).filter(p => potReady(p, hd))
    .sort((x, y) => (x.startedOnDay ?? 0) - (y.startedOnDay ?? 0));
}

/* 거둘 수 있나 — **시루 하나라도** 익었나. 상태를 안 바꾼다.
   ⚠ `b.harvested`(사본)를 안 본다. 그 칸은 "하나라도 거뒀나"라서, 시차 판에서는 거의 늘 true 다 —
     그걸로 막으면 **둘째 시루가 익어도 [수확하기]가 안 뜬다.** 판정은 언제나 pots 를 본다. */
export function beansproutReady(x) {
  /* ★ 2026-08-05 — **첫 플레이 상태(fp)도 받는다.** 종류가 늘면서 "거둘 것이 있나"는
     자리 하나의 질문이 아니게 됐다. 옛 호출부는 자리(site)를 넘기므로 그쪽도 그대로 받는다. */
  if (x && x.beansprout) return cropSites(x).some(s => readyCropPots(s).length > 0);
  return readyCropPots(x).length > 0;
}

/* 지금 거둘 수 있는 것 전부 — 자리별로 묶어 낸다. **순서는 CROP_KINDS 순서**다(겹침표의 순번). */
export function readyCropsByKind(fp) {
  return cropSites(fp)
    .map(s => ({ kind: kindIdOfSite(s), site: s, pots: readyCropPots(s) }))
    .filter(x => x.pots.length > 0);
}

/* [수확하기] 버튼을 켤지 흐리게 할지의 근거. **한글 문장은 만들지 않는다**(UI 몫). */
/* 자리 하나의 수확 상황. 아래 두 곳(자리별 · 전체)이 **같은 셈을 두 번 적지 않게** 뽑아 뒀다. */
function harvestStatusOfSite(site) {
  const pots = potsOf(site);
  const ripe = readyCropPots(site);
  const hd = site.harvestDays || 0;
  /* 자라는 중인 시루 중 가장 빨리 익을 것까지 며칠 — 시작 안 한 시루는 셀 수 없어 안 센다 */
  const growing = pots.filter(p => !p.harvested && p.startedOnDay != null && p.ageDays < hd);
  const kindId = kindIdOfSite(site);
  return {
    kind: kindId, kindKo: cropKindOf(kindId).ko,
    ready: ripe.length > 0,
    readyCount: ripe.length,
    readyIds: ripe.map(p => p.id),
    placed: !!site.slotId,
    harvested: !!site.harvested,
    ageDays: site.ageDays || 0,
    harvestDays: hd,
    daysLeft: Math.max(0, hd - (site.ageDays || 0)),
    nextReadyInDays: growing.length ? Math.min(...growing.map(p => hd - p.ageDays)) : null,
    growingCount: growing.length,
    harvestedCount: pots.filter(p => p.harvested).length,
    idleCount: idlePots(site).length,
    /* 이 자리에 놓인 용기 수. 콩나물은 시루 · 무순은 재배판이다 */
    sirus: pots.length,
    cycle: site.cycle || 1
  };
}

/* ★★ 2026-08-05 — **전체를 낸다.** [수확하기]는 익은 것을 종류 가리지 않고 다 거두므로
   `canHarvest` 가 콩나물만 보면 무순이 익어도 버튼이 안 켜진다.
   ⚠ 다만 `sirus`·`ageDays`·`harvestDays`·`cycle`·`daysLeft` 는 **콩나물 값 그대로** 둔다 —
     game.html 이 그 칸들로 "시루 N개 · N/5일"을 그리고 있고 그 파일은 이 창 소유가 아니다.
     종류별 값은 `byKind` 로 따로 낸다(보고 ⑦ — 화면이 갈아탈 목록). */
export function beansproutHarvestStatus(fp) {
  const b = fp && fp.beansprout;
  if (!fp || !fp.enabled || !b) return null;
  const byKind = cropSites(fp).map(harvestStatusOfSite);
  const lead = byKind[0];
  const nexts = byKind.map(x => x.nextReadyInDays).filter(Number.isFinite);
  const sum = key => byKind.reduce((a, x) => a + x[key], 0);
  return {
    ready: byKind.some(x => x.ready),
    canHarvest: byKind.some(x => x.ready),
    /* ★ 몇 개를 거두나 — 화면이 "시루 2개 거두기"라고 말할 근거다 (종류 합계) */
    readyCount: sum('readyCount'),
    readyIds: byKind.flatMap(x => x.readyIds),
    placed: lead.placed,
    harvested: !!b.harvested,
    ageDays: lead.ageDays,
    harvestDays: lead.harvestDays,
    daysLeft: lead.daysLeft,
    nextReadyInDays: nexts.length ? Math.min(...nexts) : null,
    growingCount: sum('growingCount'),
    /* ★ 다시 심어야 할 시루 수. `state.resowCrop` 의 `harvestedCount` 와 **같은 셈**이라
       화면이 "몇 개를 심나"를 물어볼 데가 생긴다 — 안 그러면 UI 가 pots 를 직접 뒤져
       같은 규칙을 두 곳에 적게 된다(시차가 들어오면서 `b.harvested` 하나로는 모자라다). */
    harvestedCount: sum('harvestedCount'),
    idleCount: sum('idleCount'),
    sirus: Math.max(1, lead.sirus || Math.round(b.sirus || 1)),
    cycle: lead.cycle,
    /* ★ 종류별 내역 — 화면이 "무순 2판 거두기"를 말할 유일한 근거다 */
    byKind
  };
}

/* 물을 줄(=회전을 시작할) 시루가 있나 · 며칠째 안 줬나 — 화면 버튼 문구용.
   **한글 문장은 만들지 않는다**(UI 몫). */
export function beansproutWaterStatus(fp, day) {
  const b = fp && fp.beansprout;
  if (!fp || !fp.enabled || !b) return null;
  /* ★★ 2026-08-05 — 수확 상황과 **같은 이유로** 전체를 낸다: 무순 판이 시작을 기다리는데
     [물 주기]가 안 켜지면 그 작물은 영영 못 돈다. 종류별은 `byKind` 로 따로 낸다.
     ⚠ `sirus`·`ageDays`·`harvestDays`·`wateredOnDay` 는 콩나물 값 그대로다(화면 호환). */
  const byKind = cropSites(fp).map(s => {
    const kindId = kindIdOfSite(s);
    const ps = potsOf(s), id = idlePots(s);
    return {
      kind: kindId, kindKo: cropKindOf(kindId).ko,
      needsWater: !!s.slotId && id.length > 0,
      waiting: id.length,
      idleIds: id.map(p => p.id),
      idleDays: idleDaysOf(s, day),
      startedToday: Number.isInteger(day) && ps.some(p => p.startedOnDay === day),
      placed: !!s.slotId,
      sirus: ps.length,
      ageDays: s.ageDays || 0,
      harvestDays: s.harvestDays || 0,
      wateredOnDay: s.wateredOnDay ?? null
    };
  });
  const pots = potsOf(b);
  const idle = cropSites(fp).flatMap(idlePots);
  const startedToday = byKind.some(x => x.startedToday);
  const idleDays = Math.max(0, ...byKind.map(x => x.idleDays));
  return {
    byKind,
    /* ★ 새 규칙에서 "오늘 줬나"는 더는 회전을 가르지 않는다 — 표시용으로만 남긴다 */
    wateredToday: startedToday,
    startedToday,
    /* 놓았고 · 아직 시작 안 한 시루가 있으면 줄 것이 있다.
       ⚠ **다 자란 시루는 애초에 대기가 아니다** — 물은 회전당 한 번이라 이미 줬다(§물주기). */
    needsWater: byKind.some(x => x.needsWater),
    /* 몇 개가 시작을 기다리나 — 화면이 "시루 2개가 아직 안 자랍니다"를 말할 근거 */
    waiting: idle.length,
    idleIds: idle.map(p => p.id),
    /* ★ 며칠째 안 줬나. 벌이 아니라 **알림의 근거**다(§물주기 ⚠) */
    idleDays,
    /* 옛 이름 — 화면(game.html)이 아직 `dryRun` 을 읽는다. 뜻은 "며칠째 밀렸나"로 같다.
       ⚠ 새 이름은 `idleDays` 다. 화면이 갈아타면 이 칸은 지운다. */
    dryRun: idleDays,
    ready: beansproutReady(fp),
    placed: !!b.slotId,
    /* **전부** 거둬져 있나 = 다시 심어야 줄 것이 생긴다 (종류를 다 세어서) */
    harvested: (() => { const all = cropSites(fp).flatMap(potsOf);
                        return all.length > 0 && all.every(p => p.harvested); })(),
    wateredOnDay: b.wateredOnDay ?? null,
    sirus: Math.max(1, pots.length),
    ageDays: b.ageDays || 0,
    harvestDays: b.harvestDays || 0
  };
}

/* ★★ **시루 하나하나의 상태** (2026-08-09 신설 · 박사님 "식물마다 게이지가 나와서").
   ------------------------------------------------------------
   화면이 시루마다 한 줄을 그리려면 시루마다의 사실이 필요하다. 예전에는 자리 하나의
   대표값(`ageDays` 하나)뿐이라 화면이 `pots` 를 직접 뒤져야 했고, 그러면 **판정 규칙이
   화면에도 한 벌 생긴다**(익었나 · 물이 필요한가 · 다시 심어야 하나). 여기서 한 번만 낸다.

   ★ **한글 문장은 안 만든다.** 사실만 낸다 — 문장은 UI 몫이라는 이 파일의 규약 그대로다.
   ★ 게이지(`progress01`)는 **자란 날 / 자라는 날**이다. 하루 안의 시각은 여기 없다 —
     생장은 하루 단위이고(§advanceBeansproutDay) 시각은 그 하루를 **보여 주는** 것뿐이라
     화면이 얹는다. 여기에 시각을 들이면 시각이 세 번째 축이 된다(§수확 ⚠ 와 같은 판단). */
export function cropPotList(fp, day) {
  const out = [];
  for (const site of cropSites(fp || {})) {
    const kindId = kindIdOfSite(site);
    const k = cropKindOf(kindId);
    const hd = site.harvestDays || k.harvestDays || 0;
    let n = 0;
    for (const p of potsOf(site)) {
      n++;
      const placed = cropPotPlaced(p);
      const growing = placed && !p.harvested && p.startedOnDay != null && p.ageDays < hd;
      const ready = potReady(p, hd);
      out.push({
        id: p.id, kind: kindId, kindKo: k.ko, containerKo: k.containerKo,
        /* 사람이 부르는 이름 — "시루 2" 처럼 **그 자리 안의 순번**이다. id 는 안 보인다 */
        ord: n,
        slotId: p.slotId ?? null, at: p.at ?? null,
        placed,
        /* 가방에 있는 빈 용기인가 — 놓이지도 · 거둬지지도 않은 것 */
        inBag: !placed && !p.harvested,
        started: p.startedOnDay != null,
        startedOnDay: p.startedOnDay ?? null,
        idleSinceDay: p.idleSinceDay ?? null,
        idleDays: (placed && !p.harvested && p.startedOnDay == null && Number.isInteger(day) &&
                   Number.isInteger(p.idleSinceDay)) ? Math.max(0, day - p.idleSinceDay) : 0,
        needsWater: placed && !p.harvested && p.startedOnDay == null,
        growing, ready,
        harvested: !!p.harvested,
        needsResow: !!p.harvested,
        ageDays: p.ageDays || 0,
        harvestDays: hd,
        daysLeft: Math.max(0, hd - (p.ageDays || 0)),
        progress01: hd > 0 ? Math.max(0, Math.min(1, (p.ageDays || 0) / hd)) : 0,
        cycle: p.cycle || 1,
        quality: p.quality ?? null,
        avgDli: p.avgDli ?? null,
        /* 지금까지 받은 빛의 평균 — 아직 안 거둔 시루도 화면이 보여 줄 수 있게 */
        dliSoFar: (p.dliHist || []).length
          ? p.dliHist.reduce((a, v) => a + v, 0) / p.dliHist.length : null
      });
    }
  }
  return out;
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
  const rules = fp.rules;
  if (!rules) throw new Error('[첫 플레이] 밸런스 계약이 없습니다');

  /* ★★ 2026-08-05 — `dli` 가 **자리마다 다르다.** 종류마다 자리가 따로라(§작물 자리)
     한 숫자로는 못 센다. 두 모양을 다 받는다:
       숫자          모든 자리에 같은 값 (자리가 하나뿐이던 옛 호출부 — 뜻이 안 바뀐다)
       { 종류: 값 }  자리마다 그 자리의 값 (loop.js 가 이걸 넘긴다)
     ⚠ 안 놓은 자리는 **건너뛴다**. 던지지 않는다 — 무순 재배판을 아직 안 산 판이 정상이고,
       그때 던지면 게임이 첫날부터 안 돈다. */
  const perSite = (typeof dli === 'object' && dli !== null);
  if (!perSite && !validDli(dli))
    throw new Error(`[첫 플레이] 콩나물 DLI가 올바르지 않습니다: ${dli}`);
  /* ★ 시루마다의 값 — `{ slotId: DLI }`. 없으면 자리 대표값 하나로 돈다(옛 뜻). */
  const bySlot = (opt && typeof opt.dliBySlot === 'object' && opt.dliBySlot) || null;

  let grew = 0, justReady = 0, idle = 0;
  const b = ensureCropPots(fp.beansprout);
  for (const site of cropSites(fp)) {
    ensureCropPots(site);
    idle += idlePots(site).length;
    if (!site.slotId) continue;
    const kindId = kindIdOfSite(site);
    const v = perSite ? dli[kindId] : dli;
    /* 자리는 놓였는데 그 자리의 값이 안 온 것은 **고장이다** — 조용히 0을 쓰면
       밝은 자리의 무순이 어둠으로 판정돼 품질이 통째로 뒤집힌다. */
    if (!validDli(v))
      throw new Error(`[첫 플레이] ${cropKindOf(kindId).ko} 자리의 DLI가 올바르지 않습니다: ${v}`);
    const hd = site.harvestDays;
    for (const p of placedCropPots(site)) {
      /* 거뒀거나 · 아직 시작 안 했거나 · 이미 다 자랐으면 오늘 아무 일도 안 난다 */
      if (p.harvested || p.startedOnDay == null || p.ageDays >= hd) continue;
      /* ★★ 2026-08-09 — 빛은 **그 시루가 선 자리**의 값이다(§자리는 시루마다 따로다).
         시루마다 자리가 다르니 자리마다 값이 다르다. `opt.dliBySlot` 이 그 표이고,
         표에 없으면 자리 대표값(옛 뜻 그대로)으로 떨어진다 — 옛 호출부·옛 검사가 안 깨진다.
         ⚠ **조도를 여기서 새로 재지 않는다.** 표는 하루치 계약(daily_light/1)이 낸 값을
           `loop.js` 가 시루마다 뽑아 넘긴 것이다. 이 파일은 빛을 만들지 않는다. */
      const dv = bySlot && p.slotId != null && bySlot[p.slotId] != null ? bySlot[p.slotId] : v;
      if (!validDli(dv))
        throw new Error(`[첫 플레이] ${cropKindOf(kindId).ko} ${p.id} 자리의 DLI가 ` +
                        `올바르지 않습니다: ${dv}`);
      p.ageDays++;
      /* ★ 이력은 **자란 날의 빛**만 쌓는다 — 시작 안 한 시루의 하루는 그 콩나물의 하루가 아니다.
         이 한 줄이 "물이 품질(빛 축)을 못 건드린다"의 실제 구현이다. */
      p.dliHist.push(dv);
      grew++;
      if (p.ageDays === hd) justReady++;
    }
    syncCropLead(site);
  }

  const allPots = cropSites(fp).flatMap(potsOf);
  const alreadyHarvested = allPots.length > 0 && allPots.every(p => p.harvested);
  return {
    harvested: false,
    alreadyHarvested,
    /* 오늘 몇 시루가 자랐나 · 오늘 **막** 익은 시루가 몇인가 */
    grew,
    justReadyCount: justReady,
    /* ★ 오늘 익은 시루가 있나 · 오늘 **막** 익었나 — 둘을 가른다.
       빨리감기가 서는 것은 `justReady`(전환) 쪽이다. `ready` 로 세우면 안 거둔 채로
       다시 감을 때마다 첫날에 또 서서 빨리감기가 못 돈다. */
    ready: beansproutReady(fp),
    justReady: justReady > 0,
    /* ★★ 마른 날 대신 **시작 대기**다 (2026-08-04). 물을 줄 수 있는데 안 준 시루 수 —
       벌이 아니라 "아직 시작을 안 했다"는 사실이다. 빨리감기가 여기를 본다(loop.js §물주기). */
    idle,
    /* 아래 둘은 **콩나물 대표 칸**이다 — 화면이 "N/5일"을 그리는 데 쓴다(옛 이름 그대로) */
    ageDays: b.ageDays,
    daysLeft: Math.max(0, (b.harvestDays || 0) - b.ageDays)
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
  for (const s of cropSites(fp)) ensureCropPots(s);
  /* ★★ 2026-08-05 — **종류를 가리지 않고 익은 것을 다 거둔다.** 익은 것을 안 거둘 이유가
     없다는 것(§수확)은 작물이 늘어도 그대로다. 순서는 CROP_KINDS 순서 → 그 안에서 먼저 심은 순 —
     그 순서가 곧 겹침 순번이다. */
  /* ★★ 2026-08-09 — `opt.potIds` 를 주면 **그 시루들만** 거둔다 (박사님 "각개 수확").
     안 주면 예전 그대로 익은 것을 **다 거둔다** — 빨리감기·자동수확이 그 뜻으로 부른다.
     ⚠ 익지 않은 id 를 주면 조용히 빠진다(거를 뿐이지 던지지 않는다). 그러고도 남는 것이
       없으면 아래 안내가 그대로 뜬다 — "왜 아무 일도 안 났나"를 말하는 자리는 하나면 된다. */
  const only = Array.isArray(opt.potIds) && opt.potIds.length ? new Set(opt.potIds) : null;
  const ripeByKind = readyCropsByKind(fp)
    .map(g => only ? { ...g, pots: g.pots.filter(p => only.has(p.id)) } : g)
    .filter(g => g.pots.length > 0);
  const ripe = ripeByKind.flatMap(x => x.pots);
  if (!ripe.length) {
    const growing = cropSites(fp).flatMap(s =>
      potsOf(s).filter(p => !p.harvested && p.startedOnDay != null && p.ageDays < s.harvestDays)
        .map(p => s.harvestDays - p.ageDays));
    const idle = cropSites(fp).reduce((a, s) => a + idlePots(s).length, 0);
    const e = new Error(
      growing.length
        ? `[수확] 아직 ${Math.min(...growing)}일 더 자라야 합니다 ` +
          `(${b.ageDays}/${b.harvestDays}일)`
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
  /* ★★ 겹침은 **종류마다 따로 센다** (2026-08-05). 근거는 이 규칙의 이유 그 자체다 —
     깎이는 까닭이 **질림**이라(§겹침) 콩나물을 세 번 거둔 것과 콩나물·무순을 한 번씩 거둔 것은
     같은 일이 아니다. 다른 것을 먹는 것은 질리는 일이 아니다.
   ★★ 그러면 종류 순번은 어디서 오나 — **더한다.** `표[종류순번 + 그 종류의 그날 순번]`.
     콩나물 1개      = 표[0+0] = 3,000
     콩나물 3개 같은날 = 3,000 / 2,000 / 1,000
     무순 1판        = 표[1+0] = 2,000        ← 2종째라 한 칸 밀려 시작한다
     무순 2판 같은날  = 2,000 / 1,000
     ⇒ 두 규칙(종류 체감 · 겹침 체감)이 **한 표 위에서 한 눈금으로** 만난다. 표를 둘로
       나누면 줄어드는 이유가 같은데 셈이 갈린다(§겹침이 이미 그 말을 적어 뒀다). */
  const onDayByKind = (day != null && fp.food.harvestDay === day && fp.food.harvestedOnDayByKind)
    ? { ...fp.food.harvestedOnDayByKind } : {};

  const perPot = [];
  let savedTotal = 0, spoiledTotal = 0, lostTotal = 0, onDayTotal = 0;
  for (const group of ripeByKind) {
    const kindId = group.kind;
    const kindIndex = cropKindIndexOf(kindId);
    for (const p of group.pots) {
      const hist = p.dliHist;
      const avgDli = hist.length ? hist.reduce((sum, v) => sum + v, 0) / hist.length : 0;
      /* ★ 품질표가 **작물마다 다르다**(콩나물은 어두울수록 · 무순은 밝을수록 — §작물 종류) */
      const quality = cropQualityOf(kindId, avgDli);
      const overlapIndex = (onDayByKind[kindId] || 0);
      onDayByKind[kindId] = overlapIndex + 1;
      /* 안 겹쳤을 때 이 작물이 낼 값 — 종류 순번은 그대로 붙는다(무순은 처음부터 ×2/3 다) */
      /* ★ 2026-08-09 — **작물을 따로 넘긴다**(§질림). 넷째 인자가 없으면 순번을 밀 때
         작물까지 같이 밀려, 콩나물 둘째가 「무순 기본값 × 2/3」을 받는다. */
      const fullWon = cropCycleSavedWon(rules, quality.meals, kindIndex, kindIndex);
      const savedWon = cropCycleSavedWon(rules, quality.meals, kindIndex + overlapIndex, kindIndex);
      /* 겹쳐서 못 받은 몫 — 화면이 "곳간이 안 비어 N원을 못 받았습니다"를 말할 근거다 */
      const lostWon = Math.max(0, fullWon - savedWon);

      let pantry = (fp.food.pantryWon || 0) + savedWon;
      const spoiledWon = Math.max(0, pantry - capWon);
      pantry -= spoiledWon;
      fp.food.pantryWon = pantry;

      p.harvested = true;
      p.avgDli = avgDli;
      p.quality = quality.id;
      p.meals = quality.meals;               // ★ 품질 **라벨**(3·2·1끼). 값은 원으로 매긴다
      p.harvestMeals = quality.meals;
      p.harvestCount = (p.harvestCount || 0) + 1;
      p.savedWon = savedWon;
      p.overlapIndex = overlapIndex;
      /* 다음 회전을 위해 시작 표시를 지운다 — 다시 심고 물을 줘야 또 돈다 */
      p.startedOnDay = null;

      savedTotal += savedWon;
      spoiledTotal += spoiledWon;
      lostTotal += lostWon;
      onDayTotal++;
      perPot.push({ id: p.id, kind: kindId, kindKo: cropKindOf(kindId).ko,
                    avgDli, quality: quality.id, qualityKo: quality.ko,
                    meals: quality.meals, overlapIndex, savedWon, fullWon, lostWon, spoiledWon });
    }
    syncCropLead(group.site);
  }

  syncCropLead(b);
  const lead = perPot[0];
  fp.food.lastHarvestMeals = lead.meals;
  fp.food.lastSpoiledWon = spoiledTotal;
  /* ★★ 잉여를 장부에 적는다 (2026-08-06 · 아래 §잉여 판매).
     **셈은 한 글자도 안 바뀐다** — 곳간에 들어간 값(savedTotal)도, 쉰 값(spoiledTotal)도
     예전 그대로다. 여기서 하는 일은 「버려질 몫이 얼마였나」를 **기억해 두는 것뿐**이다.
     ⇒ 그래서 이 줄은 기존 검사·재현을 못 건드린다. 파는 것은 뒤의 손 동작이다. */
  const surplusWon = lostTotal + spoiledTotal;
  fp.food.lastSurplusWon = surplusWon;
  fp.food.surplusWon = Math.max(0, Math.round((fp.food.surplusWon || 0) + surplusWon));
  if (day != null) {
    fp.food.harvestDay = day;
    fp.food.harvestedOnDayByKind = onDayByKind;
    /* 옛 이름 — **합계**다. 세이브·화면이 읽는다. 판정에는 위 종류별 표를 쓴다 */
    fp.food.harvestedOnDay =
      Object.values(onDayByKind).reduce((a, v) => a + v, 0);
  }
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
    /* ★ 이번 수확이 낸 잉여(정가) · 아직 안 넘긴 잉여 누적(정가) — 화면이 [잉여 팔기]를
       켤 근거다. **값(원)이 아니라 정가**임에 주의: 실제로 받는 돈은 판매가를 곱한 뒤다. */
    surplusWon,
    surplusPendingWon: fp.food.surplusWon,
    cycleDays: rules.harvestDays,
    /* ★ 거둔 횟수는 **종류를 다 세어** 낸다 — 무순만 거둔 날에도 늘어야 사건이 안 빠진다 */
    harvestCount: cropSites(fp).reduce((a, s) => a + (s.harvestCount || 0), 0),
    /* ★ 종류별 내역 (2026-08-05) — 화면이 "콩나물 3,000 · 무순 2,000"을 말할 근거 */
    byKind: ripeByKind.map(g => ({
      kind: g.kind, kindKo: cropKindOf(g.kind).ko,
      pots: g.pots.length,
      savedWon: perPot.filter(x => x.kind === g.kind).reduce((a, x) => a + x.savedWon, 0)
    })),
    cashFoodWon: fp.food.cashFoodWon
  };
}

/* 곳간 한도 — **용기 하나가 한 회전에 낼 수 있는 값의 합**.
   ★ 2026-08-05 — 종류마다 회전값이 다르므로(콩나물 3,000 · 무순 2,000) 자리마다 따로 세어
     더한다. 예전처럼 `한 회전분 합계 × 시루 수`로 두면 무순 판을 하나 사는 것만으로
     콩나물 한도가 1.67배로 뛴다 — 사지도 않은 절감이 곳간에 자리를 만든다. */
export function pantryCapWon(fp) {
  const rules = fp && fp.rules;
  if (!rules) return 0;
  const table = rules.cropKindSavedWon || FIRST_PLAY_RULES.cropKindSavedWon;
  let cap = 0;
  for (const s of cropSites(fp)) {
    const n = potsOf(s).length;
    cap += (table[cropKindIndexOf(kindIdOfSite(s))] ?? 0) * n;
  }
  /* 시루가 아직 하나도 없는 판(옛 세이브 복원 도중)은 한 회전분을 바닥값으로 준다 */
  return cap > 0 ? cap : rules.cropSavedWonPerCycle;
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

/* ============================================================
   ★★★ §잉여 판매 — **끼니가 못 될 몫만 판다** (2026-08-06 신설)
   ------------------------------------------------------------
   박사님 확정(2026-08-05): *"잉여 채소를 팔 수 있게 해서 오래 노가다하면 일단 마칠 수는 있게.
   씨앗 비용보다는 살짝 이득이게."*

   ## 무엇이 「잉여」인가 — **새로 정하지 않았다. 코어가 이미 갖고 있던 두 값이다.**

     ㉠ `overlapLostWon`  같은 날 겹쳐 거둬 **곳간에 아예 안 들어간 몫** (§겹침)
                          — 표가 3,000 → 2,000 → 1,000 → 0 으로 깎은 그 차액이다
     ㉡ `spoiledWon`      곳간 한도를 넘어 **쉬어서 버려진 몫** (harvestBeansprout)

   ★★ **이 둘이 잉여의 전부이고, 그래서 끼니를 못 판다.**
     둘 다 정의상 **곳간에 못 있는 값**이다 — ㉠ 은 애초에 안 들어갔고 ㉡ 은 넘쳐 나갔다.
     밥은 `eatFromPantry` 가 **곳간에서만** 꺼낸다(`pantryWon`). 파는 함수는 곳간을
     **한 번도 안 만진다.** 그래서 "끼니로 쓸 수 있는 것은 안 팔린다"가 검사로 지키는 약속이
     아니라 **구조**다. 시루가 하나뿐인 판에서는 잉여가 늘 0 이라 팔 것이 아예 없다.

   ## ★ 그러면 「하루 저감 상한을 넘긴 몫」과 어떤 사이인가 — **같은 문지기의 앞뒤다**

     같은 날 안에서  → 겹침 표가 자른다        → ㉠ 로 떨어진다
     여러 날에 걸쳐  → 곳간 한도가 넘친다      → ㉡ 로 떨어진다
                        (곳간은 하루 `dailyCropSaveWon` 씩만 빠지므로, 그보다 많이 들어오면
                         반드시 한도에 닿는다 — ㉡ 는 상한 초과가 **며칠 걸려** 드러난 모습이다)

     ⇒ 하루 저감 상한(5,000원)은 그대로 살아 있고, 이 함수는 그 상한을 **한 푼도 못 올린다.**
       올릴 수 있었다면 「식물로 밥값을 아낀다」가 「식물을 판다」로 바뀌었을 것이다.

   ## ★ 왜 「쉰 것을 판다」가 앞뒤가 맞나 — 그래서 **떨이**다
   `spoiledWon` 은 곳간이 못 받아 **결국 버릴** 몫이다. 그걸 알면서 그날 넘기면 쉬지 않는다.
   대신 제값은 못 받는다 — 급히 넘기는 것이라 그렇다. 판매가가 100%가 아닌 이유가 여기 있고,
   그 값은 `FIRST_PLAY_RULES.cropSurplusSaleRate` 한 곳에만 있다(**아직 미확정**).
   ⚠ 그래서 `loop.harvestCrop` 의 로그는 여전히 *"쉬었습니다"* 라고 말한다 — 안 판다면 정말
     쉬기 때문이다. 문구를 다듬는 것은 그 파일 소유자의 몫이다(인계 문서에 적었다).

   ## ★ 쌓아 둬도 되나 — 된다. **이건 채소가 아니라 아직 안 받은 값이다**
   `fp.food.surplusWon` 은 원이고, 곳간과 달리 **밥으로 돌아갈 길이 없다.** 며칠 모았다 한 번에
   넘겨도 살림의 총액이 같다(econgap 의 장부가 매일 넘긴 것과 같은 값을 낸다). 날짜 제한을
   두면 빨리감기가 잉여를 통째로 버려 **잰 값과 어긋난다** — 그래서 안 둔다.

   ## ★ 지갑은 여기서 안 만진다
   이 모듈의 오랜 규칙 그대로다(§다시 심는다: *"씨앗값은 호출부가 낸다"*).
   `takeCropSurplus` 는 장부를 비우고 **얼마인지만** 낸다. 돈으로 바꾸는 것은
   `state.sellCropSurplus(S)` 이고, 지갑에 넣는 것은 `shop.creditCropSurplus` 다.
============================================================ */

/* 지금 판매가 — 정본은 `rules.cropSurplusSaleRate`(= _meta 아니면 FIRST_PLAY_RULES). */
export function cropSurplusRateOf(fp) {
  const rules = fp && fp.rules;
  const r = rules ? rules.cropSurplusSaleRate : FIRST_PLAY_RULES.cropSurplusSaleRate;
  return Number.isFinite(r) && r >= 0 ? r : 0;
}

/* 지금 넘기면 얼마를 받나 — **상태를 안 바꾼다.** 버튼을 켤지 흐리게 할지의 근거다.
   반환 { pendingWon(정가) · rate · won(실수령) · canSell } */
export function cropSurplusQuote(fp) {
  const pendingWon = Math.max(0, Math.round((fp && fp.food && fp.food.surplusWon) || 0));
  const rate = cropSurplusRateOf(fp);
  const won = Math.round(pendingWon * rate);
  return { pendingWon, rate, won, canSell: pendingWon > 0 && won > 0 };
}

/* 장부를 비우고 받을 값을 낸다. **지갑은 안 만진다**(위 §잉여 판매 마지막 줄).
   ⚠ 곳간(`pantryWon`)을 안 건드린다 — 그 한 줄이 이 계통의 전부다. */
export function takeCropSurplus(fp) {
  if (!fp || !fp.food) throw new Error('[잉여] 첫 플레이 상태가 없습니다');
  const q = cropSurplusQuote(fp);
  if (q.pendingWon <= 0) return { ...q, won: 0 };
  fp.food.surplusWon = 0;
  fp.food.totalSurplusSoldWon = Math.round((fp.food.totalSurplusSoldWon || 0) + q.won);
  return q;
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
  /* ★ `opt.kind` 로 종류를 고른다 (2026-08-05). 없으면 콩나물 — 옛 호출부가 안 깨진다. */
  const kindId = opt.kind || 'beansprout';
  const k = cropKindOf(kindId);
  const site = fp && cropSiteOf(fp, kindId);
  if (!site) throw new Error(`[첫 플레이] ${k.ko} 상태가 없습니다`);
  const b = ensureCropPots(site);
  const rules = fp.rules;
  if (!rules) throw new Error('[첫 플레이] 밸런스 계약이 없습니다');

  const had = potsOf(b).length;
  const sirus = opt.sirus == null ? had : opt.sirus;
  /* ★ 2종째는 **0에서 시작한다** — 재배판을 사야 생긴다. 그래서 하한이 0이다.
     콩나물은 시루 하나를 받고 시작하므로 실제로 0이 되는 일이 없다. */
  if (!Number.isInteger(sirus) || sirus < 0)
    throw new Error(`[${k.ko}] ${k.containerKo} 수가 0 이상의 정수가 아닙니다: ${sirus}`);
  if (Number.isFinite(opt.maxSirus) && sirus > opt.maxSirus)
    throw new Error(`[${k.ko}] ${k.containerKo}를 놓을 칸이 ${opt.maxSirus}칸뿐입니다 — ` +
                    `${sirus}개는 못 놓습니다 (선반을 놓으면 늘어납니다)`);

  const added = Math.max(0, sirus - had);
  /* ★★ 2026-08-09 — `opt.potIds` 를 주면 **그 시루만** 다시 심는다 (박사님 "각개 다시 심기").
     안 주면 예전 그대로 거둔 것을 **다 다시 심는다**. */
  const only = Array.isArray(opt.potIds) && opt.potIds.length ? new Set(opt.potIds) : null;
  const harvestedPots = potsOf(b).filter(p => p.harvested && (!only || only.has(p.id)));
  if (!harvestedPots.length && !added)
    throw new Error(`[${k.ko}] 아직 수확하지 않았습니다 — 수확한 뒤에 다시 심습니다`);

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
  /* 시루를 더 샀으면 **빈 시루로** 붙는다 — 새 칸도 물을 줘야 시작한다.
     ★★ 2026-08-09 — 새 시루는 **가방에 있는 채로** 붙는다(자리가 null 이다). 예전에는
       자리 사본 하나를 무리 전체가 나눠 써서 사자마자 방에 서 있었는데, 이제 자리는
       시루마다이므로 「어디에 세울지」를 사람이 정해야 한다(§자리는 시루마다 따로다).
       ⚠ `opt.at` 을 같이 주면 아래 `placeCrop` 이 **자리의 시루 전부**를 그리로 옮긴다 —
         옛 호출부(무리째 놓기)가 그 뜻이었고 그대로 둔다. */
  for (let i = 0; i < added; i++) addCropPot(fp, k.id, { day });
  /* 시루를 줄였으면 **거둔 것부터** 뺀다 — 자라는 중인 회전을 버리지 않는다 */
  if (sirus < had) {
    const keep = [...potsOf(b)].sort((x, y) => (y.ageDays || 0) - (x.ageDays || 0)).slice(0, sirus);
    b.pots = potsOf(b).filter(p => keep.includes(p));
  }

  const resown = harvestedPots.length + added;
  /* ★ 씨앗값은 **작물마다 다르다**(콩 500 · 무씨 400 — §작물 종류).
     ⚠ 지갑에서 나가는 값은 shop.CATALOG 쪽이다. 여기 값은 표시용 정가다. */
  const seedCostWon = resown * k.seedWonPerPot;
  syncCropLead(b);

  /* 자리를 다시 고를 수 있다 — 이게 ②(막다른 길)의 실제 해법이다.
     placeCrop 은 거둔 시루가 남아 있으면 막으므로 **위에서 되살린 뒤에** 부른다. */
  if (opt.at != null && opt.at !== '') placeCrop(fp, k.id, opt.at, opt);

  return { kind: k.id, kindKo: k.ko, sirus: potsOf(b).length, resown, added,
           cycle: b.cycle, seedCostWon,
           slotId: b.slotId, at: b.at, wateredOnDay: b.wateredOnDay };
}

/* ============================================================
   ★★ 몬스테라 유도 — **책상 → 창턱 → 등** (2026-08-09 박사님 확정)
   ------------------------------------------------------------
   원문: *"몬스테라 책상에 주고 한 10일 정도 지나면 몬이가 새순 안 나는 게 이상하다 하고
          창턱에 두도록 유도하고 등 하나 설치하게 하면 될 듯."*

   ★★ **두 걸음을 따로 가르친다.** 자리를 옮겨도 아직 안 나고, 그 다음에 등을 켜야 난다.
     한 번에 알려 주면 「왜 등이 필요한지」를 못 배운다.

   ══ ⚠ 「10일」은 **게임일**이다 (이 항목의 함정) ══
     어두운 자리에서는 **유효 생장일이 한 칸도 안 오른다.** 그래서 유효일로 세면
     그 말은 영영 안 나온다 — 안 자라는 것을 짚어 주려는 말인데 안 자라서 못 나오는 셈이다.
     ⇒ 여기 카운터는 `markMonsteraPhase` 가 불릴 때마다 하나씩 오른다. 그 함수는
       `loop.nextDay` 가 하루에 **딱 한 번** 부르므로(loop.js:930) 곧 게임일이다.

   ══ ⚠ 지금 코드에서 두 번째 걸음이 안 뜰 수 있다 (실측 · 2026-08-09) ══
     박사님 표에는 「창턱(등 없음) DLI 1.52 → 안 자람」이라고 돼 있는데,
     지금 저장소 값으로 재면 **여름 반지하 창턱은 DLI 4.80 이라 등 없이도 자란다**
     (`banjiha-sill:0` · 최소 3 · 옮기고 나흘이면 7일평균이 3 을 넘는다).
     ⇒ 그래서 여름에 창턱으로 옮기면 등 없이 새순이 나고, 두 번째 걸음(등)은 안 뜬다.
       이 규칙은 **틀린 것이 아니다** — 「옮겼는데도 여전히 안 자란다」가 참일 때만 뜬다.
       가을·겨울이나 창턱이 아닌 밝기 어중간한 자리에서는 뜬다.
     ⚠ 「창턱만으로는 안 자라야 한다」가 기획이라면 고칠 곳은 이 파일이 아니라 조도 쪽이다.
       plan 판단 대기 — `docs/handoff/growth-to-plan.md §2026-08-09` 참고.

   ══ ⚠ 세이브에 아직 안 실린다 ══
     `save.js` 의 `packFirstPlay` 는 열쇠를 하나하나 적는 화이트리스트이고 이 창 소유가 아니다.
     그래서 `monstera.guide` 는 저장하면 사라지고 불러오면 0 부터 다시 센다.
     ⇒ 저장·복원을 끼면 안내가 그만큼 늦게 뜬다(대사 자체는 `seen` 이 한 번으로 막는다).
     붙일 세 줄은 `docs/handoff/growth-to-plan.md §세이브` 에 적어 두었다. */
/* 며칠 그대로면 「이상하다」고 말하나 — 게임일. 박사님 지시값 그대로 10 이다. */
export const MONSTERA_HINT_DAYS = 10;
/* 옮긴 뒤 며칠 더 그대로면 「등이 필요하다」고 말하나 — 게임일.
   ⚠ 7일평균이 새 자리 값으로 차오르는 데 나흘쯤 걸린다(실측). 그보다 짧게 두면
     "옮겼는데 아직 안 변했다"를 자리 탓으로 오해하게 만든다. 그래서 5 다. */
export const MONSTERA_LAMP_HINT_DAYS = 5;

function newMonsteraGuide() {
  return {
    days: 0,        // 형태가 그대로인 채 지난 게임일
    moved: false,   // 도착 자리에서 한 번이라도 옮겼나
    movedDays: 0,   // 옮긴 뒤 형태가 그대로인 채 지난 게임일
    grewOnce: false // 한 번이라도 형태가 올랐나 — 오르면 유도는 끝이다
  };
}
/* 지금 무슨 안내를 낼 상태인가. **순수 함수**다 — 상태를 안 건드린다.
   ★ 순서가 계약이다: 자리를 먼저, 등은 그 다음. 옮기기 전에는 등 얘기를 꺼내지 않는다. */
export function monsteraGuideOf(fp) {
  const m = fp && fp.monstera;
  if (!m || !m.arrived || (fp && fp.completed)) return { move: false, lamp: false };
  const g = m.guide || newMonsteraGuide();
  if (g.grewOnce) return { move: false, lamp: false };     // 자라기 시작하면 유도는 끝난다
  const move = !g.moved && g.days >= MONSTERA_HINT_DAYS;
  const lamp = g.moved && g.movedDays >= MONSTERA_LAMP_HINT_DAYS;
  return { move, lamp };
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
  fp.monstera.guide = newMonsteraGuide();      // 도착한 날이 유도의 0일차다
  fp.phase = 'move_monstera';
  return fp.monstera;
}

export function moveMonstera(fp, target, opt = {}) {
  if (!fp.monstera.arrived) throw new Error('[첫 플레이] 아직 몬스테라가 도착하지 않았습니다');
  if (target == null || target === '')
    throw new Error('[첫 플레이] 몬스테라를 옮길 자리를 골라 주세요');
  const spot = spotOf(target, { id: MONSTERA_POT_ID, ...opt });
  /* ★ 「옮겼다」는 **자리가 실제로 달라진 것**이다. 같은 자리에 다시 놓는 것(좌표 미세 조정)은
     옮긴 것이 아니다 — 그걸 옮김으로 세면 등 안내가 자리 안내보다 먼저 나온다. */
  const g = fp.monstera.guide || (fp.monstera.guide = newMonsteraGuide());
  if (fp.monstera.slotId !== spot.slotId) { g.moved = true; g.movedDays = 0; }
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
  const g = fp.monstera.guide || (fp.monstera.guide = newMonsteraGuide());
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
  /* ★★ 유도 카운터 (§몬스테라 유도). 이 함수는 하루에 한 번 불린다 = **게임일**이다.
     ⚠ 도착 직후 첫 관측(prev == null)은 안 센다 — 비교 대상이 없어 `phaseAdvanced` 가
       늘 false 라, 세면 도착한 날이 이미 "하루 그대로"가 된다. */
  if (prev) {
    if (phaseAdvanced(prev, fp.monstera.growthPhase)) { g.grewOnce = true; g.days = 0; g.movedDays = 0; }
    else { g.days++; if (g.moved) g.movedDays++; }
  }
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
    ready: beansproutReady(fp),
    /* ★ 회전이 생기면서 `harvested` 만으로는 부족해졌다 — 재파종하면 false 로 내려갔다가
       다시 true 가 되므로 "몇 번째 수확인가"를 세야 첫 수확과 그 뒤를 가를 수 있다.
       ★ 2026-08-04 — **시루 전부의 합계**다(syncCropLead). 시차 판에서는 시루마다 따로
         거둬지므로, 대표 한 칸만 세면 둘째·셋째 시루의 수확이 사건에서 통째로 빠진다. */
    harvestCount: cropSites(fp).reduce((a, s) => a + (s.harvestCount || 0), 0),
    cycle: fp.beansprout ? (fp.beansprout.cycle || 1) : 1,
    /* ★ 시작을 기다리는 시루 수 — 물이 회전 시작이 되면서 생긴 칸이다(§물주기).
       빨리감기가 "물을 줄 수 있는데 안 준 시루가 새로 생겼나"를 여기로 본다(loop.js). */
    idle: cropSites(fp).reduce((a, s) => a + idlePots(s).length, 0),
    arrived: !!(fp.monstera && fp.monstera.arrived),
    /* ★ 유도 두 걸음 (§몬스테라 유도) — **거짓 → 참**이 곧 사건이다 */
    guideMove: monsteraGuideOf(fp).move,
    guideLamp: monsteraGuideOf(fp).lamp,
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
  /* ★★ 유도 두 걸음 (§몬스테라 유도). **자리를 먼저, 등은 그 다음.**
     ⚠ 대사는 dialogue.js 소유이고 순서는 EVENT_ORDER 가 지킨다 — 여기서는 사건만 낸다. */
  if (!before.guideMove && now.guideMove)
    out.push({ id: 'monstera_no_spear', ko: '새순이 안 납니다',
               days: fp.monstera.guide.days });
  if (!before.guideLamp && now.guideLamp)
    out.push({ id: 'monstera_needs_lamp', ko: '옮겼는데도 새순이 안 납니다',
               days: fp.monstera.guide.movedDays });
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
