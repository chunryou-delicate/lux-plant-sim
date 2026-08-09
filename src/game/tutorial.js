/* 반지하 튜토리얼 — 첫 플레이 **그 뒤** (2026-08-03)
 *
 * 첫 플레이(`first_play.js`)는 Day 0~16 한 흐름만 담는다. 이 파일은 그 뒤부터
 * **원룸으로 이사할 때까지**를 담는다. `docs/story_arc.md` 가 정본이다.
 *
 *   ① 반지하 ← 여기          ② 탈출(이사)  ③ 원룸  ④ 삽수로 내 집 마련 엔딩
 *
 * ★순수하다. DOM 도 타이머도 모른다. 화면은 game.html 이 그린다.
 *
 * ★수치는 전부 근거가 있다. 지어낸 값이 없다 —
 *   식비·지출은 `food_economy.md`, 자금·이사비는 `game_flow.md`,
 *   계절 길이는 `src/engine/weather.js`, 종료 조건은 `story_arc.md` §1.
 */

import { seasonOf, DAYS_PER_SEASON } from '../engine/weather.js';
import { priceOf } from './shop.js';

/* weather.js 는 **연중 절대 일수**를 받는다(0~359, 봄→여름→가을→겨울 각 90일).
   "여름 45일째"를 그 축으로 옮기려면 여름이 시작하는 90 을 더해야 한다 —
   45 를 그냥 넣으면 봄 45일째가 되어 계절이 통째로 어긋난다(실제로 그랬다). */
const SEASON_START = Object.freeze({ spring: 0, summer: 90, autumn: 180, winter: 270 });

export const TUTORIAL_RULES = Object.freeze({
  /* ★게임 시작 = 여름 45일차. 0일차면 90일 내내 여름이라 계절이 아예 안 나오고,
     식물등의 존재 이유도 같이 사라진다(story_arc.md §2).
     45 를 고른 이유: 첫 플레이(16일)를 여름 고정으로 끝내고 나면 가을까지 29일이
     남는다. 표준 진행이면 가을 안에 이사하고, 늦으면 겨울을 맞는다 — 세 경로가 성립한다. */
  startSeason: 'summer',
  startSeasonDay: 45,

  /* ★★ 2026-08-09 박사님 확정 — **1,000,000 → 1,300,000원.**
     원문: *"시작돈을 130만원으로 일단하자."*
     ⚠ 예전 주석은 *"「없음」이 정체성이라 안 올린다"* 였다. 그 판단이 바뀐 것이 아니라
       **살림 값이 통째로 다시 짜인 것**이다 — 월세가 15만에서 30만으로 돌아가고
       유예가 없어져 첫날 30만이 목돈으로 빠진다. 셋은 같이 움직이는 한 벌이다. */
  startCashWon: 1_300_000,
  moveOutCostWon: 1_500_000,      // 원룸 보증금 + 첫 달 월세 + 이사비. 실비 근거가 있어 안 내린다
  /* ★★ 2026-08-05 박사님 확정 — **300,000 → 150,000원.**
     ------------------------------------------------------------
     살림이 구조적 적자였다. 하루 지출 20,000원인데 벌 수 있는 최대가 8,000원이라
     무엇을 하든 **60~90일에 파산**했고, 이사는 189일에나 가능했다.
     즉 튜토 후반 절반 이상을 0원으로 보냈고, **0원이면 씨앗도 못 사서**
     (콩 700원·무 600원) 회전이 끝나면 벌이가 통째로 끊겼다 — 되돌아올 길이 없었다.
     ⇒ 월세를 반으로 내려 하루 5,000원을 벌어 준다. 파산이 81일 → **111일**로 밀린다.
     ⚠ **이것만으로는 안 메워진다.** 월세를 0으로 해도 201일이 한계다(이사 189일 대비 12일 여유).
       남는 지출 10,000원 중 7,500원이 식비인데, 식비는 이 게임이 「식물로 아끼는 것」이라
       없앨 수가 없다. 나머지 40일은 삽수 벌이·시작 자금·모주 판매 문턱 중에서 정한다
       (재는 중 — docs/handoff/econgap-to-plan.md).
     ⚠ **`dailySpendWon` 을 같이 안 내리면 아무 일도 안 일어난다.** 그 값이 월세를 포함하고
       있어서(§dailyCashOutWon), 월세만 내리면 하루치에서 빼는 몫도 같이 줄어 총액이 그대로다.
       실제로 재서 확인했다 — 월세만 바꾸면 파산일이 81일 그대로다. */
  /* ★★ 2026-08-09 박사님 확정 — **150,000 → 300,000원으로 되돌린다.**
     원문: *"월세가 지금 30만원이잖아? 30일 기준으로 해서…"*
     ⇒ 이 값의 정본은 원래부터 `data/balance/homes.json` 의 `banjiha.rent = 300,000` 이었다.
       2026-08-05 에 여기서만 반으로 내렸고, 그래서 정본과 코드가 넉 달째 갈려 있었다
       (`utility 75,000`/월 = 하루 2,500원도 그 파일 값이다). 이제 다시 같아졌다.
     ⚠ 위 §startCashWon · 아래 §dailySpendWon 과 **셋이 한 벌**이다. 하나만 바꾸면 총액이 안 맞는다. */
  rentWon: 300_000,               // 반지하 월세 — data/balance/homes.json §banjiha.rent
  /* ★★ ③ 원룸 월세 — **⏸ 미확정이라 자리만 둔다** (2026-08-05 · docs/oneroom.md §2).
     `null` 이면 이사한 뒤에도 반지하 월세로 돈다. 0 이 아니다 — 0 으로 두면 원룸이
     공짜인 방이 조용히 성립하고, 그게 미확정이었다는 것을 아무도 모른다.
     확정되면 여기 숫자를 박는 것이 아니라 `oneroom.withOneroomRent(TUTORIAL_RULES,
     oneroom.oneroomRulesFromHomes(homes))` 가 이 칸을 채운 사본을 낸다 —
     살림 값의 정본은 `data/balance/homes.json`(plan 소유)이지 코어가 아니다. */
  oneroomRentWon: null,
  /* ★★ 2026-08-09 박사님 확정 — **첫 달 유예를 폐지한다.** `rentGraceDays: 30` → `rentFirstDueDay: 1`.
     ------------------------------------------------------------
     원문: *"30일 기준으로 해서, 바로 시작날이 바로 30일기준 마지막날인거야.
            다음날 누르면 월세 30만원이 쓱 빠지게, 그리고 식대도 빠지게 해서
            돈에 대한 설명을 먼저 하고 가는게 좋겠어."*

     ★ 왜 이름을 바꿨나. `rentGraceDays` 는 「며칠을 봐 준다」는 뜻이라 값이 1 이면 말이 안 된다
       (하루만 봐 준다?). 지금 이 숫자가 정하는 것은 **첫 청구일**이다. 뜻이 바뀌었으면 이름도
       바뀌어야 한다 — 안 그러면 다음 사람이 「유예 1일」로 읽는다.
     ★ 1 이지 0 이 아니다. `tutorialDay` 는 `ts.day += 1` 을 먼저 하므로 첫 [다음 날]이 1일이다.
       0 으로 두면 그 뒤 주기가 30 · 60 이 되어 첫 달만 29일이 된다.

     ⚠⚠ **「시작 첫날」이 어디인가는 이 파일이 못 정한다.** 튜토 시계는 첫 플레이가 끝나야 돈다
       (`tutorialDay` 첫 줄 `if (!firstPlayDone) return`). 첫 플레이는 돈도 계절도 멈춘 16일이라
       (`docs/first_play.md §0`), **여기서 말하는 1일차는 게임 17일쯤**이다.
       박사님 말씀이 「게임을 켜고 처음 누르는 [다음 날]」이라면 그건 `first_play.js` 가
       살림을 시작해야 하는 것이고 그 파일은 코어 소유다 — docs/handoff/econ-to-plan.md §1 에 적었다. */
  rentFirstDueDay: 1,
  rentPeriodDays: 30,             // 월세 주기. 아래 dailyCashOutWon 이 이 값으로 하루치를 뗀다

  /* ★★ 하루 지출 합 — **월세를 포함한 값**이다 (food_economy.md §2 표 · story_arc.md §3).
         월세 10,000 + 공과·전기 2,500 + 식비 7,500 = 20,000원/일 = 월 60만.
     ⚠ 2026-08-03 정정: 예전에는 이 20,000 을 매일 떼고 **월세 30만을 30일마다 또** 뗐다.
       월세가 두 번 나간 셈이라 실제 지출이 하루 30,000원(월 90만)이었고, 그래서
       재현에서 42일에 파산했다. 지금은 하루치에서 월세 몫(rentWon/rentPeriodDays)을 빼고
       월세는 30일마다 목돈으로 낸다 — **평균은 그대로 20,000원/일**이고 유예도 그대로 산다. */
  /* ★★ 2026-08-09 — 월세가 30만으로 돌아갔으므로 여기도 되돌린다(위 §rentWon).
       월세 10,000 + 공과·전기 2,500 + 식비 7,500 = **20,000원/일** = 월 60만.
       셋 다 `data/balance/homes.json`(rent 300,000 · utility 75,000)과
       `data/balance/characters.json._meta`(dailyFoodPerPerson 7,500)에서 나온 값이다.
     ⚠ 이 값과 `rentWon` 은 **같이 움직인다.** 한쪽만 바꾸면 총액이 안 바뀌거나 두 번 샌다
       (2026-08-05 에 실제로 그랬다 — 월세만 내렸더니 파산일이 81일 그대로였다). */
  dailySpendWon: 20_000,
  mealCostWon: 2_500,             // 한 끼. 콩나물 한 끼가 이만큼을 아낀다

  /* ★ 콩나물은 **버티는 수단이지 이사 자금이 아니다** (2026-08-03 박사님 확정).
     이사 자금은 무늬 개체 하나를 팔아 한 번에 만든다(docs/shop.md §1 역산).
     그래서 시루 수의 상한은 "돈을 얼마나 버나"가 아니라 **끼니 상한**이 정한다 —
     하루 2끼(food_economy.md §4)를 채우는 데 필요한 시루가 3개다(3끼 ÷ 4일 × 3 = 2.25끼/일).
     그 이상은 남아서 버려지므로 사는 의미가 없다. 규칙이 아니라 **셈이 상한을 만든다.** */
  cropSirusForCap: 3,             // 표시·안내용. 판정에는 안 쓴다(끼니 상한이 알아서 막는다)

  /* 식물등 — 필수가 아니라 선택이다. 하루 지출보다 조금 커서 망설임이 생기고,
     전기는 거의 공짜라 부담이 사는 순간 한 번뿐이다(story_arc.md §4).

     ★★ 2026-08-09 — **전기세 숫자의 정본은 `data/balance/electricity.json` 이다.**
     ------------------------------------------------------------
     여기 남은 값은 그 파일을 못 읽는 판(순수 모듈·검사 하네스)을 위한 **기본값**이고,
     둘이 같은지는 `tools/test_elec.mjs` 가 매번 확인한다. 다르면 검사가 깨진다 —
     이 저장소는 정본이 두 벌이라 반복해서 사고가 났다(씨앗값·계절 달력).
     읽어 꽂는 법은 아래 §electricityRulesFrom. */
  lampPriceWon: 25_000,
  /* ★★ **와트가 두 벌이었다** (2026-08-09 정정).
     예전에는 `lampWatt: 12` 하나였다 — 어떤 기구를 켜든 개당 12W 로 셌다.
     그런데 방에 실제로 달린 기구는 **바 20W + 집게 12W** 이고(`data/lighting_presets.json`),
     방 프로파일도 그렇게 굳혀 두었다(`room_profile.banjiha.json` §lampWatts = [0, 20, 32]).
     ⇒ 등 2개를 24시간 켜면 프로파일은 123원인데 여기는 **92원**이었다. 「집게 전력으로 바를 켜는」 판이었다.
     이제 **산 순서대로의 와트 표**를 갖는다. 순서(1개=바 · 2개=바+집게)는 프로파일이 정한 것이지
     여기서 새로 정한 것이 아니다 — 사는 것은 붙박이를 **켤 권리**다(lampecon-to-plan.md §5-③).
     ⚠ 표보다 많이 켜면 마지막 칸을 되쓴다. 없는 기구의 와트를 지어내지 않는다. */
  lampWattsByOrder: Object.freeze([20, 12]),
  lampHours: 12,
  kwhWon: 160,                                // 원/kWh — 한국 가정용 평균가
  /* ⏸ 누진 구간. `null` 이면 위 `kwhWon` 하나로 센다. 모양과 뜻은 electricity.json §_tiers.
     0 이 아니라 null 인 이유는 「아직 안 켰다」와 「공짜다」가 다른 말이기 때문이다. */
  tariffTiers: null,
  baseKwhPerMonth: 0,                         // 누진을 켤 때만 쓰인다 — 집이 원래 쓰는 달 사용량
  lampUnlockSeason: 'autumn'                  // 가을 진입에 해금 — 겨울 전 선택지가 생긴다
});

/* ★ 정본(`data/balance/electricity.json`)을 읽어 전기세 값을 채운 **규칙 사본**을 낸다.
   `oneroom.oneroomRulesFromHomes(homes)` 와 같은 모양이다 — 이 모듈은 파일을 안 읽는다
   (DOM 도 타이머도 fs 도 모른다). 읽는 것은 부르는 쪽이고, 여기서는 **꽂기만** 한다.
   ⚠ 규칙 객체 자체를 세이브에 적지 않는다(save.js §packTutorial) — 그래서 판을 만들 때마다
     다시 꽂아야 하고, 안 꽂으면 위 기본값으로 돈다. 그래서 둘이 같아야 한다. */
/* ★★ 반지하 살림 값을 정본(`data/balance/homes.json`)에서 읽어 채운 **규칙 사본**을 낸다.
   ------------------------------------------------------------
   2026-08-09 — 월세·공과가 여기와 그 파일에 **두 벌**로 있었고 실제로 갈려 있었다:
   homes.json 은 `banjiha.rent = 300,000` · `utility = 75,000` 인데 여기는 150,000 이었다
   (2026-08-05 에 여기서만 반으로 내렸다). 값은 이제 같지만, **같다는 것을 검사가 지켜야** 한다 —
   `tools/test_econ.mjs` §A 가 그 등식을 고정한다.
   ⇒ 하루 지출은 지어내지 않고 **더해서 낸다**: 월세/주기 + 공과/주기 + 식비.
     식비는 `characters.json._meta.dailyFoodPerPerson` 이 정본이라 인자로 받는다. */
export function banjihaRulesFrom(homes, opt = {}, rules = TUTORIAL_RULES) {
  const R = { ...rules };
  const rows = (homes && homes.homes) || [];
  const row = rows.find(h => h && (h.id === 'banjiha' || h.room === 'banjiha'));
  if (!row) return Object.freeze(R);
  const period = R.rentPeriodDays || 30;
  if (Number.isFinite(row.rent)) R.rentWon = row.rent;
  const foodWon = Number.isFinite(opt.dailyFoodWon) ? opt.dailyFoodWon : null;
  if (foodWon != null && Number.isFinite(row.utility))
    R.dailySpendWon = Math.round(R.rentWon / period + row.utility / period + foodWon);
  R.homesSource = 'data/balance/homes.json';
  return Object.freeze(R);
}

export function electricityRulesFrom(json, rules = TUTORIAL_RULES) {
  const R = { ...rules };
  if (!json || typeof json !== 'object') return Object.freeze(R);
  if (Number.isFinite(json.kwhWon)) R.kwhWon = json.kwhWon;
  if (Array.isArray(json.tiers) && json.tiers.length) R.tariffTiers = Object.freeze(json.tiers.map(t => ({ ...t })));
  else if (json.tiers === null) R.tariffTiers = null;
  if (Number.isFinite(json.baseKwhPerMonth)) R.baseKwhPerMonth = json.baseKwhPerMonth;
  const L = json.lamp || {};
  if (Number.isFinite(L.hours)) R.lampHours = L.hours;
  if (Number.isFinite(L.priceWon)) R.lampPriceWon = L.priceWon;
  if (Array.isArray(L.wattsByOrder) && L.wattsByOrder.length &&
      L.wattsByOrder.every(w => Number.isFinite(w) && w >= 0))
    R.lampWattsByOrder = Object.freeze([...L.wattsByOrder]);
  R.electricitySource = 'data/balance/electricity.json';
  return Object.freeze(R);
}

/* ── 알림 시점 (2026-08-03) ────────────────────────────────────────────
   ★규칙이 아니라 **말이 나올 자리**다. 살림 수치(월세·등값)는 위 TUTORIAL_RULES 가 갖고,
     여기 셋은 "언제 말을 거나"만 정한다. 값을 바꿔도 경제는 안 바뀐다. */
const RENT_NOTICE_DAYS = 7;    // 유예 만료 이레 전에 미리 알린다
const LAMP_NUDGE_DAY = 7;      // 가을 이레째까지 등을 안 샀으면 한 번만 짚는다
const WINTER_STILL_DAY = 10;   // 겨울 열하루째까지 반지하면 한 번 더

/* 학습 체크리스트 — story_arc.md §1. ★넷 다 **코어가 이미 내는 값**으로 판정한다.
   새 신호를 만들면 그게 또 어긋난다. */
export const LEARNING = Object.freeze({
  harvest:     { ko: '콩나물 첫 수확 · 식비 절감 확인' },
  cropDark:    { ko: '콩나물을 어두운 자리에 두었다' },
  plantWindow: { ko: '몬스테라를 높은 창가 자리에 두었다' },
  spear:       { ko: '말린 새순을 보았다' }
});
const LEARNING_KEYS = Object.keys(LEARNING);

export function createTutorialState(opt = {}) {
  const R = opt.rules || TUTORIAL_RULES;
  return {
    enabled: !!opt.enabled,
    rules: R,
    day: 0,                       // 게임 시작으로부터 며칠
    cashWon: R.startCashWon,
    /* 계절이 흐르기 시작하는 시점. 첫 플레이(novice·여름 고정) 동안은 멈춰 있다. */
    seasonRunning: false,
    lamp: { unlocked: false, owned: 0, litHours: R.lampHours },
    /* ★ 2026-08-09 — 첫 청구는 **첫날**이다(위 §rentFirstDueDay. 유예 폐지).
       ⚠ 옛 세이브·옛 규칙 사본은 `rentGraceDays` 밖에 없다 — 없으면 그 값을 쓴다.
         못 읽으면 조용히 0 이 되어 **없던 월세가 하루 일찍 빠지므로** 폴백을 남긴다. */
    rent: { paidCount: 0, nextDueDay: R.rentFirstDueDay ?? R.rentGraceDays ?? 1 },
    /* 살림 장부 — 상점에 쓴 돈과 판 돈. 재배 자체(시루 나이·품질)는 first_play 소유이고,
       품목·가격·배송은 shop.js 소유다. 여기는 **합계만** 센다. */
    crop: { spentWon: 0, soldWon: 0 },
    learned: LEARNING_KEYS.reduce((o, k) => (o[k] = false, o), {}),
    /* ★ 튜토 확정 무늬 — 아래 §확정 무늬. 정식 모드에는 이 칸 자체가 없다(튜토 상태다). */
    varieGrant: createVarieGrantState(),
    movedOut: false,
    bankrupt: false
  };
}

export function createVarieGrantState() {
  return {
    nodeIds: [],         // 지금 **모주에** 붙어 있는 확정 무늬 마디
    count: 0,            // 튜토 전체에서 몇 번 줬나 (표시·재현용)
    lastDay: null        // 마지막으로 준 튜토 일자
  };
}

/* ── 계절 ─────────────────────────────────────────────────────────────── */

/* 게임 n일차 → 연중 절대 일수. weather.js 의 달력 위에 시작점만 얹는다 —
   새 시간 체계를 안 만든다. */
function yearDay(ts, day) {
  const base = (SEASON_START[ts.rules.startSeason] ?? 0) + ts.rules.startSeasonDay;
  const Y = DAYS_PER_SEASON * 4;
  return ((base + Math.max(0, day)) % Y + Y) % Y;
}
export function seasonAt(ts, day) { return seasonOf(yearDay(ts, day)); }

/* ★★ 게임 0일이 **연중 며칠인가** (2026-08-05 신설).
   화면(`seasonAt`)과 빛(`room_profile.skyFor`)이 서로 다른 0일을 보고 있었다 —
   화면은 여기 `base`(여름 90 + 45 = 135)에서 시작하는데 빛은 `seasonOf(S.day)` 를
   그냥 써서 0일을 봄 0일로 봤다. 135일 어긋난 것이다.
   ⇒ **그 오프셋의 정본은 여기 하나다.** 빛은 이 숫자를 `S.sim.yearDay0` 으로 받아
     더하기만 한다(state.js §yearDay0). 숫자를 두 곳에 적지 않는다.
   ⚠ 인자 없이 부르면 `TUTORIAL_RULES` 기본값이다 — 규칙이 다른 판은 그 규칙을 넘겨라. */
export function yearDay0Of(rules = TUTORIAL_RULES) {
  return ((SEASON_START[rules.startSeason] ?? 0) + (rules.startSeasonDay || 0)) % (DAYS_PER_SEASON * 4);
}
/* 그 계절이 며칠째인가. 화면이 "가을 12일째"처럼 적을 때 쓴다. */
export function seasonDayAt(ts, day) { return yearDay(ts, day) % DAYS_PER_SEASON; }
export const SEASON_KO = Object.freeze({ spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' });

/* ── 돈 ───────────────────────────────────────────────────────────────── */

/* 하루 전기값. 식물등 몫만 실계산하고 나머지는 dailySpendWon 안에 상수로 들어 있다
   (food_economy.md 의 결정 그대로 — 식물등 실측이 월세 옆에서 먼지가 되지 않게).
   ⚠ 2026-08-09 — 예전 주석의 「23원/일」은 12W 고정값 시절의 숫자다. 실제 기구 와트로 세면
     바 1개 12h 는 **38원**, 바+집게 24h 는 **123원**이다(§lampWattsByOrder). */
export function lampElectricityWon(ts, opt = {}) {
  const R = ts.rules;
  /* ★★ **켠 만큼 낸다** (2026-08-06 · lampecon 창이 잡았다).
     ------------------------------------------------------------
     예전에는 `ts.lamp.owned` 와 `ts.lamp.litHours` 만 봤다. 그런데 화면이 실제로 켜는 것은
     `S.lamps.count` · `S.lamps.litHours` 이고 **둘을 아무도 안 맞췄다.** 그래서:
       · 등을 **꺼도 요금이 그대로** 나갔다 (owned 를 보니까)
       · 점등시간을 24h 로 늘려도 **요금이 한 푼도 안 올랐다** (ts 쪽 12h 를 보니까)
     ⇒ 「켜고 끄기」가 돈에 안 닿아 **고정비**였다. 밸런스 손잡이가 될 수가 없었다.

     이제 부르는 쪽이 **실제로 켠 값**을 넘긴다. 안 넘기면 예전 그대로다(옛 호출부 보호).
     ⚠ 켠 개수는 **산 개수를 못 넘는다** — 안 산 등의 요금을 물릴 수는 없다.
       (못 켜게 막는 것은 화면 몫이다. 여기서는 셈만 지킨다.) */
  const owned = Math.max(0, ts.lamp.owned || 0);
  const on = Number.isFinite(opt.count) ? Math.max(0, Math.min(owned, opt.count)) : owned;
  const hours = Number.isFinite(opt.litHours) ? Math.max(0, Math.min(24, opt.litHours))
                                              : ts.lamp.litHours;
  /* ★ 와트 — **켠 등의 실제 와트 합**이다(위 §lampWattsByOrder). 개당 하나가 아니다.
     ⚠ `opt.wattsOn` 은 방 조도 계약이 낸 값(`report.energy.watts`)을 그대로 받는 자리다.
       그쪽과 여기가 같은 와트를 봐야 「화면에 뜨는 전기세」와 「지갑에서 빠지는 전기세」가 안 갈린다
       (docs/handoff/elec-to-plan.md §장부 두 벌). 받아도 **산 등의 합을 못 넘는다** —
       안 산 등의 요금을 물릴 수는 없다. */
  const watts = Number.isFinite(opt.wattsOn)
    ? Math.max(0, Math.min(opt.wattsOn, lampWattsOn(R, owned)))
    : lampWattsOn(R, on);
  return Math.round(electricityWonOf(R, watts * hours / 1000));
}

/* 등 n개를 켰을 때의 와트 합. 표가 없는 옛 규칙 사본은 `lampWatt × n` 으로 돈다 —
   조용히 0원이 되는 것보다 옛 값으로 도는 편이 낫다. */
export function lampWattsOn(rules, on) {
  const n = Math.max(0, Math.round(on || 0));
  if (!n) return 0;
  const table = rules && Array.isArray(rules.lampWattsByOrder) && rules.lampWattsByOrder.length
    ? rules.lampWattsByOrder : null;
  if (!table) return Math.max(0, (rules && rules.lampWatt) || 0) * n;
  let w = 0;
  for (let i = 0; i < n; i++) w += table[Math.min(i, table.length - 1)] || 0;
  return w;
}

/* ★★ 하루 kWh → 원. **단가를 읽는 곳은 여기 하나다.**
   누진(`tariffTiers`)이 없으면 곱하기 하나이고, 있으면 **한계 단가**로 센다:
   집이 원래 쓰는 몫(`baseKwhPerMonth`) 위에 식물등이 얹히므로, 식물등이 내는 것은
   「base 까지의 요금」과 「base + 식물등까지의 요금」의 차다.
   ⚠ base 자체를 여기서 또 물리면 두 번 낸다 — 그 몫은 이미 `dailySpendWon` 안의
     공과·전기 2,500원이다(food_economy.md §2). 그래서 차를 쓴다. */
export function electricityWonOf(rules, kwhPerDay) {
  const R = rules || TUTORIAL_RULES;
  const kwh = Math.max(0, kwhPerDay || 0);
  const tiers = Array.isArray(R.tariffTiers) && R.tariffTiers.length ? R.tariffTiers : null;
  if (!tiers) return kwh * (R.kwhWon || 0);
  const days = R.rentPeriodDays || 30;          // 「한 달」의 정본은 월세 주기다. 새 값을 안 만든다
  const base = Math.max(0, R.baseKwhPerMonth || 0);
  return (tierCostWon(tiers, base + kwh * days) - tierCostWon(tiers, base)) / days;
}
/* 한 달 사용량(kWh) → 그 달 요금(원). 구간을 넘어간 몫만 다음 단가로 센다. */
function tierCostWon(tiers, kwhPerMonth) {
  let prev = 0, won = 0;
  for (const t of tiers) {
    const upto = Number.isFinite(t.uptoKwhPerMonth) ? t.uptoKwhPerMonth : Infinity;
    won += Math.max(0, Math.min(kwhPerMonth, upto) - prev) * (t.won || 0);
    prev = upto;
    if (kwhPerMonth <= upto) break;
  }
  return won;
}

/* 콩나물이 아껴 준 오늘 식비. 끼니 하나가 mealCostWon 을 아낀다.
   ⚠ 2026-08-04 — 값의 정본은 이제 **원**이다(first_play.js §작물 종류: 한 회전 3,000원은
     1끼 2,500원으로 안 떨어진다). 이 함수는 **끼니로 부르던 옛 호출부**를 위해 남는다.
     새 경로(loop.stepTutorial)는 `savedWon` 을 그대로 넘긴다 — 아래 tutorialDay 참고. */
export function foodSavedWon(ts, mealsUsed) {
  return Math.max(0, Math.round(mealsUsed || 0)) * ts.rules.mealCostWon;
}

/* ★★ 이번 달 월세는 얼마인가 — **사는 방이 정한다** (2026-08-05 · ③ 원룸).
   ------------------------------------------------------------
   반지하는 `rentWon`, 원룸은 `oneroomRentWon` 이다. 어느 쪽인지는 **세이브에 있는 사실**
   (`ts.movedOut`)로 고른다 — `ts.rules` 자체를 갈아 끼우면 저장 왕복에서 사라진다
   (save.js §packTutorial: "여기도 rules 는 안 적는다"). 그래서 규칙 객체에 두 값을 다 담고
   고르는 일만 여기서 한다. 읽는 곳은 이 함수 하나뿐이다 — 여러 곳에서 고르면 반씩 바뀐다.
   ⚠ `oneroomRentWon` 이 `null`(미확정)이면 반지하 월세로 그대로 돈다. 숫자를 지어내지 않는다. */
export function rentWonOf(ts) {
  const R = (ts && ts.rules) || TUTORIAL_RULES;
  if (ts && ts.movedOut && R.oneroomRentWon != null) return R.oneroomRentWon;
  return R.rentWon;
}

/* ★ 오늘 지갑에서 나가는 돈 — **월세 몫을 뺀 나머지**다.
   `dailySpendWon` 은 월세를 포함한 하루 지출 합(20,000)이고, 월세는 30일마다 목돈으로
   따로 나간다. 두 번 떼지 않으려면 여기서 한 번 나눠야 한다(TUTORIAL_RULES 주석 참고).
   ★ 뺄 몫도 **지금 사는 방의 월세**다(rentWonOf) — 안 그러면 원룸에서 하루치가
     반지하 월세 몫만큼만 줄어 월세가 어긋난 만큼 두 번 새어 나간다.
   ⏸ 원룸의 `dailySpendWon`(월세를 포함한 하루 지출 합) 자체는 아직 미확정이다 —
     docs/oneroom.md §2. 여기서는 반지하 값을 그대로 쓰고 월세 몫만 바꾼다. */
export function dailyCashOutWon(ts) {
  const R = ts.rules;
  const period = R.rentPeriodDays || 30;
  return Math.max(0, Math.round(R.dailySpendWon - rentWonOf(ts) / period));
}

export function buyLamp(ts) {
  if (!ts.lamp.unlocked) throw new Error('[튜토] 식물등은 아직 살 수 없습니다');
  if (ts.cashWon < ts.rules.lampPriceWon) {
    const e = new Error('[튜토] 돈이 모자랍니다 — 식물등 ' + ts.rules.lampPriceWon.toLocaleString() + '원');
    e.tutorialInput = true;                 // 안내지 고장이 아니다
    throw e;
  }
  ts.cashWon -= ts.rules.lampPriceWon;
  ts.lamp.owned += 1;
  /* ★사는 것은 **턴 밖**에서 일어난다(버튼). 그래서 다음 하루를 기다리지 않고
     여기서 바로 신호를 낸다 — 하루 뒤에 "샀네" 하면 산 순간이 조용해진다.
     호출부는 이 events 를 dialogue.createStoryteller().events() 에 그대로 넘기면 된다. */
  return { owned: ts.lamp.owned, cashWon: ts.cashWon,
           events: [{ id: 'lamp_bought', ko: '식물등을 샀습니다' }] };
}

/* ── 하루 ─────────────────────────────────────────────────────────────── */

/* 하루가 지났을 때 튜토리얼 쪽에서 일어나는 일.
   ★첫 플레이가 끝나기 전에는 계절도 돈도 안 움직인다 — 그 7~16일은 배우는 구간이지
     살림을 하는 구간이 아니다(first_play.md §0: novice·맑음·여름 고정). */
/* ★ 절감은 **원으로 받는 것이 정본**이다 (2026-08-04). `savedWon` 을 주면 그대로 쓰고,
   안 주면 옛 방식(`mealsUsed × 한 끼 값`)으로 유도한다 — 옛 호출부를 조용히 깨지 않으려고
   둘 다 받되, **한 턴에 둘을 섞지 않는다**(savedWon 이 있으면 mealsUsed 는 보지 않는다). */
export function tutorialDay(ts, opt = {}) {
  const { firstPlayDone = false, mealsUsed = 0, savedWon = null, incomeWon = 0 } = opt;
  if (!ts.enabled) return null;
  if (!firstPlayDone) return { skipped: '첫 플레이 진행 중' };

  ts.seasonRunning = true;
  ts.day += 1;
  const R = ts.rules;
  const ev = [];

  /* ★ 수입 — 그날 지갑에 들어온 돈. 지금은 상점 판매(shop.sellPot·sellCutting)가 유일하고,
     그쪽은 턴 밖에서 즉시 정산하므로 여기로는 대개 0이 온다. 자리를 남겨 두는 이유는
     "수입이 하루 결산에 실린다"는 것이 살림의 계약이기 때문이다. */
  const income = Math.max(0, Math.round(incomeWon || 0));
  if (income > 0) ts.cashWon += income;

  /* 지출 — 콩나물로 아낀 만큼은 빼고 낸다. ★월세 몫은 여기 없다(아래 목돈으로 나간다) */
  const saved = savedWon == null ? foodSavedWon(ts, mealsUsed)
                                 : Math.max(0, Math.round(savedWon));
  /* 켠 만큼 낸다 — 부르는 쪽(loop)이 S.lamps 를 넘긴다(§lampElectricityWon) */
  const power = lampElectricityWon(ts, { count: opt.lampCount, litHours: opt.lampHours });
  const base = dailyCashOutWon(ts);
  const out = Math.max(0, base - saved) + power;
  ts.cashWon -= out;

  /* ★★ 2026-08-09 — 유예가 없어졌으므로 이 예고는 **둘째 달부터** 산다.
     ------------------------------------------------------------
     예전 조건은 `ts.rent.paidCount === 0` 이었다. 첫 청구가 1일로 당겨진 지금 그 조건은
     「튜토 −6일」을 가리켜 **한 번도 안 터진다.** 죽은 코드로 남기지 않고 조건을 바꿨다:
     이제 **매달** 이레 전에 알린다. 첫 달은 예고할 여지가 없으니(첫날 청구) 저절로 빠진다.
     ⇒ 예고의 뜻도 같이 바뀐다. 예전에는 「봐 주던 것이 끝난다」였고 지금은 **「또 돌아온다」** 다.
       한 번 맞아 본 뒤라야 그 말이 무게를 갖는다. 대사도 그래서 갈렸다(dialogue §rentSoon). */
  if (ts.day > 0 && ts.day === ts.rent.nextDueDay - RENT_NOTICE_DAYS)
    ev.push({ id: 'rent_soon', ko: '월세 ' + rentWonOf(ts).toLocaleString() + '원이 ' +
                                   RENT_NOTICE_DAYS + '일 뒤 나갑니다',
              dueDay: ts.rent.nextDueDay, rentWon: rentWonOf(ts), count: ts.rent.paidCount + 1 });

  /* 월세 — 첫 달은 유예다(집주인 사정·보증금 상계라는 서사 장치).
     ★ 액수는 **사는 방**이 정한다(rentWonOf) — 반지하와 원룸이 같을 이유가 없다. */
  let rentPaid = 0;
  if (ts.day >= ts.rent.nextDueDay) {
    rentPaid = rentWonOf(ts);
    ts.cashWon -= rentPaid;
    ts.rent.paidCount += 1;
    ts.rent.nextDueDay += R.rentPeriodDays || 30;   // ★주기의 정본은 규칙이다. 30 을 또 적지 않는다
    /* ★첫 달과 그 뒤는 다른 사건이다 — 첫 달은 유예가 끝난 날이고, 그 뒤는 반복이다.
       대사도 갈린다(dialogue.rentFirst / rentAgain). */
    ev.push({ id: 'rent', ko: '월세 ' + rentPaid.toLocaleString() + '원',
              first: ts.rent.paidCount === 1, count: ts.rent.paidCount });
  }

  /* 식물등 해금 — 가을에 들어서면 살 수 있다 */
  const season = seasonAt(ts, ts.day);
  const seasonDay = seasonDayAt(ts, ts.day);
  if (!ts.lamp.unlocked && season === R.lampUnlockSeason) {
    ts.lamp.unlocked = true;
    ev.push({ id: 'lamp_unlocked', ko: '식물등을 살 수 있게 되었습니다',
              priceWon: R.lampPriceWon });
  }
  const prevSeason = seasonAt(ts, ts.day - 1);
  /* ★계절 이름을 같이 싣는다 — 가을과 겨울은 대사가 완전히 다르다.
     싣지 않으면 화면이 ko 문자열을 뜯어 봐야 하고, 그건 조용히 틀리는 종류다. */
  if (season !== prevSeason)
    ev.push({ id: 'season', ko: SEASON_KO[season] + '이 되었습니다', season, prevSeason });

  /* ★안 사는 것도 답이다 (story_arc.md §4) — 그래서 재촉이 아니라 한 번만 짚는다.
     해금일을 따로 저장하지 않는다: 해금은 가을 0일째라 "가을 7일째"가 곧 이레 뒤다. */
  if (ts.lamp.unlocked && ts.lamp.owned === 0 &&
      season === R.lampUnlockSeason && seasonDay === LAMP_NUDGE_DAY)
    ev.push({ id: 'lamp_skipped', ko: '식물등을 아직 사지 않았습니다' });

  /* ★겨울까지 못 나간 경우 — **실패가 아니라 더딘 것**이다(박사님 지시).
     겨울에 들어선 것만으로 한 번, 열흘이 지나도 그대로면 한 번 더 짚는다. */
  if (season === 'winter' && !ts.movedOut && seasonDay === WINTER_STILL_DAY)
    ev.push({ id: 'winter_still', ko: '겨울 ' + (WINTER_STILL_DAY + 1) + '일째 · 아직 반지하' });

  /* ★파산은 스토리 모드에서 끝이 아니다 — 초보 모드라 죽지 않는다(story_arc.md §0).
     0원 아래로는 안 내려가고, 표시로만 알린다. 게임을 끝내지 않는다. */
  if (ts.cashWon < 0) {
    ts.cashWon = 0;
    if (!ts.bankrupt) { ts.bankrupt = true; ev.push({ id: 'broke', ko: '돈이 다 떨어졌습니다' }); }
  } else if (ts.bankrupt && ts.cashWon > 0) ts.bankrupt = false;

  return { day: ts.day, season, seasonDay: seasonDayAt(ts, ts.day),
           cashWon: ts.cashWon, spentWon: out, savedWon: saved, incomeWon: income,
           dailyBaseWon: base,
           electricityWon: power, rentWon: rentPaid, events: ev };
}

/* ── 배움 ─────────────────────────────────────────────────────────────── */

/* 체크리스트를 코어가 내는 값으로 채운다. ★한 번 켜지면 안 꺼진다 —
   배운 것을 나중에 자리를 옮겼다고 되돌리면 "배웠다"가 아니라 "지금 그렇게 두었다"가 된다. */
export function noteLearning(ts, ev = {}) {
  if (!ts.enabled) return ts.learned;
  const R = ts.rules;
  /* ① 첫 수확 · 식비 절감
     ★ 2026-08-04 — 증거를 **거두는 순간의 것**으로 넓혔다. 수확이 손 동작이 되면서
       (first_play.js §수확) 거두는 날과 곳간에서 꺼내 먹는 날이 갈렸다:
         cycleSavedWon  이 회전이 식비를 얼마나 덜었나 — **거두는 순간** 확정된다 (loop.harvestCrop)
         foodSavedWon   오늘 곳간에서 얼마를 꺼냈나 — 그 **다음 날부터** 난다 (loop.nextDay)
       둘 중 하나라도 0보다 크면 "거뒀고 그것이 식비를 덜었다"는 사실은 같다.
       옛 이름을 안 지우는 이유는 그것이 여전히 참인 증거이고, 지우면 옛 호출부가 조용히 죽어서다. */
  if (ev.harvested && ((ev.cycleSavedWon || 0) > 0 || (ev.foodSavedWon || 0) > 0))
    ts.learned.harvest = true;
  /* ② 콩나물을 어두운 자리에 — ★자리를 검사하지 않고 품질로 본다.
     콩나물은 빛을 받으면 초록이 되고 써진다. 3끼가 나오는 구간이 곧 어두운 자리라,
     **품질이 곧 배치의 증거**다(story_arc.md §1). 다른 방·다른 슬롯에서도 성립한다. */
  if (ev.harvested && ev.cropAvgDli != null && ev.cropAvgDli <= 0.3) ts.learned.cropDark = true;
  /* ③ 몬스테라를 밝은 자리에 — ★자리 이름이 아니라 DLI 로 본다.
     banjiha-sill:0 만 인정하면 다른 방에서 성립하지 않는다. 배운 것은 "창턱"이 아니라 "밝은 자리"다. */
  if (ev.plantDli7 != null && ev.plantMinDli != null && ev.plantDli7 >= ev.plantMinDli)
    ts.learned.plantWindow = true;
  /* ④ 말린 새순 */
  if (ev.spearFurled) ts.learned.spear = true;
  return ts.learned;
}

export function learningLeft(ts) {
  return LEARNING_KEYS.filter(k => !ts.learned[k]).map(k => ({ id: k, ko: LEARNING[k].ko }));
}

/* ============================================================
   ★★ 확정 무늬 — "임의 확정 성숙 무늬로 마무리" (2026-08-03 박사님 확정)
   ------------------------------------------------------------
   원문: *"튜토는 어느 정도 꾸준수입 + **임의 확정 성숙 무늬로 마무리**하는 걸로 하자."*
   그 전에 같은 원칙을 이미 말씀하셨다 — *"튜토에 꼭 갈라져야만 하는 거면 튜토에선 100%로."*

   ══ ★ 확률을 안 건드린다 ═══════════════════════════════════════════════
   무늬 굴림의 정본은 growth 의 `calcVarieProb` 이고 **그건 growth 소유다.**
   코어가 그 확률을 만지면 두 창이 같은 값을 두 곳에서 정하게 되고, 정식 모드로 새는 길도
   거기서 열린다. 그래서 코어는 확률이 아니라 **"이 마디를 무늬로 친다"는 자기 상태**를 갖는다:

     ts.varieGrant.nodeIds  ← 코어 상태(세이브에 남는다)
     varieView(S, {nodes, stats})  ← 그 상태를 growth 가 낸 값 **위에 덧씌워 읽는다**

   growth 에는 아무것도 요청하지 않았다 — 필요한 접근자(`cuttableNodes`·`leafStats`)가
   이미 다 있다(2026-08-03 growth 창이 붙였다). `plant_grow.html` 은 한 글자도 안 바뀐다.

   ══ ★ 어디에 두었나 · 왜 거기인가 ═══════════════════════════════════════
   아래 **다섯이 같은 날 모두 참**이면, 모주의 맨 위 잎 한 장을 무늬로 친다.

     ① 반지하 튜토 진행 중이다            `ts.enabled && !ts.movedOut`
     ② **배움 넷을 다 채웠다**            `learningLeft().length === 0`
     ③ **모주에서 삽수를 한 번 잘라 봤다** `pots[0].cuts.length >= 1`
     ④⑤ **지금 가진 것을 다 팔아도 이사 자금에 못 닿는다**
         `현금 + 살아 있는 삽수 값 + 모주 값 < 1,500,000`

   ★ **플레이어가 한 일에 대한 답이다.** ②는 이 튜토가 가르친 넷(수확·어두운 자리·창가 자리·
     말린 새순)을 다 해 봤다는 것이고, ③은 이번에 새로 가르치는 것(번식)에 **손을 댔다**는 것이다.
     ③은 공짜가 아니다 — 자르려면 용기를 **주문해서 이틀을 기다려** 사야 하고(7,000원),
     자를 마디가 있으려면 몬스테라가 밝은 자리에서 자라고 있어야 한다.
     **시간만 지나서는 절대 안 온다** — 어두운 자리에 두면 ②의 `spear` 가 안 뜨고,
     잎이 안 나서 자를 마디도 안 생긴다. 세 갈래 다 자리로 막힌다.

   ★ **왜 "뿌리내려 봤다"가 아니라 "잘라 봤다"인가 — 자금 곡선이 정했다.**
     뿌리내림까지 기다리면 확정 무늬가 12일 늦게 오고, 그 무늬를 다시 뿌리내려 파는 데
     12일이 또 걸린다. 실측하면(tools/test_banjiha_routes.mjs) 시작 자금 100만이
     하루 7,700원씩 줄어 **튜토 30일에 첫 월세 30만이 겹치면** 무늬 삽수 732,000원을 팔아도
     150만에 못 닿는다. 즉 "뿌리내림"으로 걸면 **여유가 사흘**뿐이라 조금만 늦어도 막다른 길이 된다.
     "잘라 봤다"로 걸면 그 여유가 **보름**이 되고, 그래도 **확정 무늬 자체는 여전히 잘라서
     12일을 기다려 팔아야** 값이 된다 — 배우는 내용은 그대로고 문턱만 앞으로 왔다.

   ★ **마지막 장도 플레이어가 배운 동작으로 친다.** 확정 무늬는 그 자리에서 돈이 되지 않는다 —
     한 번 더 잘라 뿌리내려(12일) 팔아야 값이 된다. 그래서 튜토의 마지막 행동이 "삽수 판매"가
     되고, ③ 원룸에서 이어질 번식 게임의 예고편이 그대로 된다.

   ★★ **막다른 길이 없다(④⑤) — 이게 "마무리"의 내용이다.**
     조건이 "무늬가 하나도 없다"가 아니라 **"다 팔아도 못 닿는다"** 인 이유가 여기 있다.
     실측하면(tools/test_banjiha_routes.mjs) 도착 개체의 살아 있는 잎은 **두세 장**이고,
     그중 한 장만 무늬가 되면 v = 1/3 ~ 1/2 이라 값이 38만~83만에서 멈춘다 — 150만에 못 닿는다.
     "한 장만 준다"로 걸면 **무늬는 났는데 그래도 못 나가는** 판이 절반을 넘었다(재현으로 확인).

     그래서 규칙을 이렇게 둔다: **닿을 때까지, 열이틀에 한 장씩.**
       · 한 장을 준 뒤 **12일**은 안 준다. 12일은 `propagation.METHODS.water.rootDays` —
         **받은 무늬를 잘라 뿌리내려 파는 데 걸리는 바로 그 시간**이다. 그래서 확정 무늬가
         "그냥 주는 것"이 아니라 **번식 한 바퀴의 박자**로 온다. 하루에 한 장씩 주면
         튜토가 이틀 만에 끝났다(재현으로 확인) — 배울 틈이 없다.
       · **닿는 순간 멈춘다** — 필요한 만큼만 주고 한 장도 더 주지 않는다
       · 잎이 없으면 못 준다 — 마디 하나에 그 마디의 잎 수까지만 붙는다(있는 잎에만 붙는다)
     수도꼭지가 아니다. 총량이 **"이사 자금 한 번"** 으로 잠겨 있고, 이사하면 영영 끝난다.
     `shop.js` §8 의 *"파산해도 막히지 않는다"* 가 여기서 확률이 아니라 **규칙**이 된다.

   ★ **성숙 무늬라 부르는 이유.** 무늬를 치는 자리가 그 모주의 잎이다.
     ⚠ 2026-08-04 — 도착 개체가 **줄기 1개짜리(유효 45일)** 로 작아졌다(state.ARRIVAL).
       그래서 "이미 성숙한 모주"라는 전제가 약해졌다. 이 규칙 자체는 잎 수로만 도므로
       깨지지는 않지만, **닿는 데 걸리는 날이 늘었다**(재현 중앙값 튜토 57 → 189일). `leafStats().matureLeaves`(갈라짐)로 문을 걸지는 않았다 —
     실측하면 반지하 창턱에서는 갈라짐이 유효 220일 언저리라(tools 로 확인) 그걸 조건에 넣으면
     튜토가 영영 안 끝난다. **가진 조건으로 못 걸 문은 걸지 않는다.**

   ══ ★ 정식 모드로 새지 않는 이유 ════════════════════════════════════════
   ① `ts.varieGrant` 는 **튜토 상태**다. 튜토가 없는 판에는 이 칸 자체가 없다.
   ② `stepVarieGrant` 가 첫 줄에서 `ts.enabled && !ts.movedOut` 을 본다 — 이사한 뒤에는 끝이다.
   ③ 덧씌우기(`varieView`)도 같은 문을 지난다. 튜토가 꺼져 있으면 growth 값을 **그대로** 낸다.
   ④ `growth` 는 아무 영향도 안 받는다 — 확정 무늬는 코어 장부일 뿐이라 다음 판·다른 개체에
      한 글자도 안 남는다.
   재현이 이 넷을 다 확인한다(tools/test_banjiha_routes.mjs 검사 H).
============================================================ */

/* ★ 지금 **가진 것을 다 팔면 얼마인가** — 조건 ④⑤.
     현금 + 살아 있는 삽수 값 + 모주 값(확정 무늬를 덧씌우고, 잘라낸 잎은 뺀 값)
   ⚠ 뿌리내리는 중인 삽수도 센다. 12일 뒤면 팔리는 물건이라 "가진 것"이 맞고,
     안 세면 자르자마자 무늬를 또 주게 된다. */
export function sellableWonOf(S, ctx = {}) {
  const ts = S.tutorial;
  let won = ts.cashWon;
  /* ★ **지금** 달고 있는 잎으로 센다 (2026-08-04 삽수 생장). `c.source` 는 자를 때의 기록이라
     자란 삽수를 작게 세고, 그러면 확정 무늬가 「아직 모자란다」고 판단해 더 준다 —
     실제로는 이미 넘었는데도. 값을 매기는 자리(shop.sellCutting)와 **같은 값**을 봐야 한다. */
  for (const c of (S.cuttings || [])) {
    if (!c || c.status === 'dead') continue;
    const leaves = Number.isInteger(c.leaves) ? c.leaves : (c.source && c.source.leaves);
    const varie = Number.isInteger(c.variegatedLeaves)
      ? c.variegatedLeaves : ((c.source && c.source.variegatedLeaves) || 0);
    if (Number.isInteger(leaves) && leaves >= 1)
      won += priceOf({ leaves, variegatedLeaves: varie }).won;
  }
  const v = varieView(S, ctx);
  const st = v.stats;
  if (st && Number.isInteger(st.leaves)) {
    /* 모주는 **잘라낸 만큼을 뺀다** — growth 는 잘린 것을 모른다(propagation.js §유한성).
       여기서 안 빼면 이미 팔아 버린 잎을 또 가진 것으로 센다. */
    const lost = (((S.pots || [])[0] || {}).pendingCutLoss || {}).leaves || 0;
    const leaves = Math.max(0, st.leaves - lost);
    const varie = Math.min(leaves, Math.max(0, st.variegatedLeaves || 0));
    if (leaves >= 1) won += priceOf({ leaves, variegatedLeaves: varie }).won;
  }
  return won;
}

/* ★★ 가을 게이트 — 확정 무늬는 **가을에 들어선 뒤부터** 준다 (2026-08-03 박사님 확정)
   ------------------------------------------------------------------------------
   왜 넣었나. 게이트가 없을 때 재현이 낸 중앙값은 튜토 13일(A·B)·27일(C) 이고 **셋 다 여름**이었다.
   그런데 반지하 구간에는 가을 진입(autumnCame)·식물등 해금(lampUnlocked)·겨울(winterCame)이
   콘텐츠와 대사로 이미 다 채워져 있다(dialogue.js §4 · story_arc.md §2). 튜토가 여름 안에
   끝나면 **그걸 아무도 못 본다.** 식물등은 해금되기 전에 게임이 끝나므로 살 이유조차 없다.

   ★ 새 수치를 만들지 않았다. 이 날짜는 TUTORIAL_RULES(시작 계절·시작 일자)와
     weather.js 의 계절 길이가 정한다 — 여름 45일차 시작이므로 가을은 튜토 45일이다.
     계절을 `lampUnlockSeason` 에 묶은 것은 의도 그대로다: **무늬가 오는 계절과 등이 열리는
     계절을 같은 값으로 두면** 튜토 안에 계절 전환과 해금이 반드시 한 번씩 들어온다.
     둘을 따로 두면 어느 한쪽이 조용히 밖으로 밀린다.

   ★ 날짜로 재는 이유(계절 이름으로 안 재는 이유). 계절은 한 바퀴 돌아 봄으로 다시 간다 —
     `seasonAt() === 'autumn'` 으로 걸면 겨울에 들어선 판에서 문이 **도로 닫힌다.**
     시작점부터의 일수는 단조라 한 번 열리면 안 닫힌다. */
export function varieGrantOpensDay(ts) {
  const R = (ts && ts.rules) || TUTORIAL_RULES;
  const Y = DAYS_PER_SEASON * 4;
  const start = (SEASON_START[R.startSeason] ?? 0) + (R.startSeasonDay || 0);
  const target = SEASON_START[R.lampUnlockSeason] ?? SEASON_START.autumn;
  return ((target - start) % Y + Y) % Y;
}

/* 튜토 확정 무늬가 지금 열려 있나. 사유를 같이 낸다 — 화면·재현이 "왜 안 오나"를 말할 수 있게. */
export function varieGrantCheck(S, ctx = {}) {
  const ts = S && S.tutorial;
  if (!ts || !ts.enabled || ts.movedOut) return { ok: false, why: '튜토가 아닙니다' };
  const g = ts.varieGrant || (ts.varieGrant = createVarieGrantState());
  const left = learningLeft(ts);
  if (left.length) return { ok: false, why: '아직 못 해 본 것이 있습니다 — ' + left.map(x => x.ko).join(' · ') };
  /* ③ — **모주가 적어 둔 사실**을 읽는다. 이벤트를 후킹하지 않는다:
     자르기는 턴 밖(버튼)에서 일어나므로 신호를 따로 만들면 호출 경로마다 갈린다. */
  const cuts = (((S.pots || [])[0] || {}).cuts || []).length;
  if (!cuts) return { ok: false, why: '삽수를 아직 한 번도 잘라 보지 않았습니다' };
  const have = sellableWonOf(S, ctx);
  if (have >= ts.rules.moveOutCostWon)
    return { ok: false, why: `지금 가진 것을 다 팔면 ${have.toLocaleString()}원 — 이사 자금에 닿습니다`, haveWon: have };
  /* ★ 가을 게이트 — 위 §가을 게이트 참고. 배움·삽수 뒤에 두는 이유는 사유가 **가장 가까운 것**을
     말해야 하기 때문이다. 아직 아무것도 안 해 본 사람에게 "가을을 기다리세요"는 틀린 안내다. */
  const opens = varieGrantOpensDay(ts);
  if (ts.day < opens)
    return { ok: false, haveWon: have,
             why: `${SEASON_KO[ts.rules.lampUnlockSeason] || '가을'}에 들어서야 옵니다 — ` +
                  `${opens - ts.day}일 남았습니다(지금 ${SEASON_KO[seasonAt(ts, ts.day)]} ` +
                  `${seasonDayAt(ts, ts.day) + 1}일째)` };
  if (g.lastDay != null && ts.day - g.lastDay < VARIE_GRANT_INTERVAL_DAYS)
    return { ok: false, haveWon: have,
             why: `무늬를 받은 지 ${ts.day - g.lastDay}일째입니다 — ` +
                  `${VARIE_GRANT_INTERVAL_DAYS}일에 한 장씩 옵니다(잘라 뿌리내리는 시간)` };
  return { ok: true, why: null, haveWon: have };
}

/* 하루에 한 번. loop.nextDay 가 growth 에서 읽은 값을 그대로 넘긴다.
     ctx.nodes  growth.cuttableNodes()  (null 이면 아무것도 안 한다 — 지어내지 않는다)
     ctx.stats  growth.leafStats()
   반환 { granted, nodeId, detached, why } */
export function stepVarieGrant(S, ctx = {}) {
  const ts = S && S.tutorial;
  if (!ts || !ts.enabled) return { granted: false, nodeId: null, detached: [], why: '튜토가 아닙니다' };
  const g = ts.varieGrant || (ts.varieGrant = createVarieGrantState());

  /* ① 잘려 나간 무늬 마디를 모주 목록에서 뺀다 — 잘랐으면 그 잎은 삽수로 옮겨 갔다.
     takeCutting 을 후킹하지 않는다(호출부가 game.html 이든 재현이든 같아야 한다).
     대신 모주가 적어 둔 `pot.cuts` 를 읽는다 — 그게 "무엇을 잘라냈나"의 정본이다. */
  const pot = (S.pots || [])[0];
  const cutIds = new Set(((pot && pot.cuts) || []).map(c => c.nodeId));
  const detached = g.nodeIds.filter(id => cutIds.has(id));
  if (detached.length) g.nodeIds = g.nodeIds.filter(id => !cutIds.has(id));

  const c = varieGrantCheck(S, ctx);
  if (!c.ok) return { granted: false, nodeId: null, detached, why: c.why };

  /* ② 어느 마디에 붙이나 — **맨 위 잎 한 장**. growth 가 낸 목록에서 잎이 제일 적은
     자를 수 있는 마디를 고른다. 잎 한 장짜리 조각이라야 "무늬 잎 비율 v = 1"이 되고,
     그게 docs/shop.md §1 이 낸 잭팟(잎1·v=1 → 732,000원)의 자리다.
     ★ 코어가 마디를 새로 만들지 않는다 — 있는 목록에서 하나를 고를 뿐이다. */
  const nodes = ctx.nodes;
  if (!Array.isArray(nodes) || !nodes.length)
    return { granted: false, nodeId: null, detached, why: 'growth 가 마디 목록을 안 냈습니다' };
  /* ★ 잎이 제일 적은 마디부터 채운다 — 잎 한 장짜리 조각이라야 무늬 잎 비율 v 가 1 이 되고,
     그게 docs/shop.md §1 이 낸 잭팟(잎1·v=1 → 732,000원)의 자리다.
     한 마디에 **그 마디의 잎 수까지만** 붙는다 — 없는 잎에 무늬를 칠하지 않는다. */
  const used = new Map();
  for (const id of g.nodeIds) used.set(id, (used.get(id) || 0) + 1);
  const cand = nodes
    .filter(n => n && CUTTABLE_STEMS_FOR_GRANT.includes(n.stem) &&
                 Number.isInteger(n.leaves) && n.leaves >= 1 && !cutIds.has(n.nodeId) &&
                 (used.get(n.nodeId) || 0) < n.leaves)
    .sort((a, b) => a.leaves - b.leaves || String(a.nodeId).localeCompare(String(b.nodeId)));
  if (!cand.length)
    return { granted: false, nodeId: null, detached, why: '무늬를 붙일 잎이 남지 않았습니다' };

  const pick = cand[0];
  g.nodeIds.push(pick.nodeId);
  g.count += 1;
  g.lastDay = ts.day;
  return { granted: true, nodeId: pick.nodeId, leaves: pick.leaves, detached, why: null };
}

/* propagation.CUTTABLE_STEMS 와 같은 표. 여기서 propagation 을 import 하면
   tutorial → propagation → shop 으로 의존이 늘어난다(tutorial 은 지금 weather 하나만 쓴다).
   ⚠ 둘이 갈리면 못 자르는 마디에 무늬가 붙는다 — 재현이 등식을 고정한다. */
const CUTTABLE_STEMS_FOR_GRANT = Object.freeze(['pink', 'thick', 'main']);

/* 확정 무늬 사이의 간격(튜토 일수). `propagation.METHODS.water.rootDays` 와 같은 12 —
   위 §확정 무늬 참고. 여기서 propagation 을 import 하지 않는 이유는 CUTTABLE_STEMS 와 같다. */
export const VARIE_GRANT_INTERVAL_DAYS = 12;

/* ★ 덧씌워 읽기 — growth 가 낸 값 위에 코어의 확정 무늬를 얹는다. **원본을 안 고친다.**
     varieView(S, { nodes, stats }) → { nodes, stats, granted }

   ⚠ **덜 세는 쪽으로 둔다.** 코어는 "어느 마디가 어느 마디를 품고 있나"를 모른다
     (마디 트리는 growth 소유이고, nodeId 경로를 파싱하지 않기로 했다 — propagation.js §유한성).
     그래서 무늬 +1 은 **확정 무늬 그 마디**와 **그루 전체(밑동·leafStats)** 에만 얹는다.
     중간 마디는 그대로 둔다 — 넘치게 세면 안 판 잎을 판 게 되고, 덜 세면 손해가 없다. */
export function varieView(S, io = {}) {
  const nodes = Array.isArray(io.nodes) ? io.nodes : null;
  const stats = io.stats && typeof io.stats === 'object' ? io.stats : null;
  const ts = S && S.tutorial;
  const g = ts && ts.enabled && !ts.movedOut ? ts.varieGrant : null;
  const ids = (g && g.nodeIds) || [];
  if (!ids.length) return { nodes, stats, granted: [] };

  const cnt = new Map();
  for (const id of ids) cnt.set(id, (cnt.get(id) || 0) + 1);
  const motherLeaves = nodes ? nodes.reduce((m, n) => Math.max(m, (n && n.leaves) || 0), 0) : 0;
  const outNodes = nodes && nodes.map(n => {
    if (!n) return n;
    const add = cnt.get(n.nodeId) || ((motherLeaves && n.leaves === motherLeaves) ? ids.length : 0);
    if (!add) return n;
    return { ...n, variegatedLeaves: Math.min(n.leaves, (n.variegatedLeaves || 0) + add) };
  });
  const outStats = stats && {
    ...stats,
    variegatedLeaves: Math.min(stats.leaves ?? 0, (stats.variegatedLeaves || 0) + ids.length)
  };
  return { nodes: outNodes, stats: outStats, granted: [...ids] };
}

/* ── 이사 ─────────────────────────────────────────────────────────────── */

/* 종료 조건은 **두 축을 함께** 본다(story_arc.md §1).
   돈만 모으면 자동으로 끝나는 구조를 피하되, 돈을 아예 빼지도 않는다. */
export function canMoveOut(ts) {
  const need = ts.rules.moveOutCostWon;
  const money = ts.cashWon >= need;
  const left = learningLeft(ts);
  return {
    ok: money && left.length === 0,
    money, needWon: need, haveWon: ts.cashWon, shortWon: Math.max(0, need - ts.cashWon),
    learningLeft: left
  };
}

/* ★★ 이것만 부르면 **방은 안 바뀐다** (2026-08-05 명시).
   여기서 하는 일은 「이사비를 내고 깃발을 세우는 것」뿐이다 — `S.home.room` 은 그대로다.
   스토리 경로는 `oneroom.moveIntoOneroom(S, io)` 를 부른다. 그쪽이 이 함수를 감싸고
   방·자리·조도까지 옮긴다. 이 함수를 직접 부르면 「이사했다는데 여전히 반지하」가 된다
   (실제로 game.html 의 [원룸으로 이사] 버튼이 그 상태다 — docs/oneroom.md §6 배선 인계). */
export function moveOut(ts) {
  const c = canMoveOut(ts);
  if (!c.ok) {
    const why = !c.money
      ? '이사 자금이 ' + c.shortWon.toLocaleString() + '원 모자랍니다'
      : '아직 못 해 본 것이 있습니다 — ' + c.learningLeft.map(x => x.ko).join(' · ');
    const e = new Error('[튜토] ' + why);
    e.tutorialInput = true;
    throw e;
  }
  ts.cashWon -= ts.rules.moveOutCostWon;
  ts.movedOut = true;
  /* ★반지하 구간의 끝이다. buyLamp 와 같은 이유로 여기서 신호를 낸다 —
     이사는 턴이 아니라 버튼이라, 다음 하루를 기다리면 장면이 하루 늦게 나온다. */
  return { movedOut: true, cashWon: ts.cashWon,
           events: [{ id: 'moved_out', ko: '원룸으로 이사했습니다' }] };
}

/* 화면이 "다음에 무엇을 하면 되나"를 적을 때 쓴다. 코어에 새 계산을 만들지 않는다. */
export function tutorialGoal(ts) {
  if (!ts.enabled) return null;
  if (ts.movedOut) return { id: 'done', ko: '원룸으로 이사했습니다' };
  const c = canMoveOut(ts);
  if (c.ok) return { id: 'ready', ko: '원룸으로 이사할 수 있습니다' };
  if (c.learningLeft.length) return { id: 'learn', ko: c.learningLeft[0].ko };
  return { id: 'money', ko: '이사 자금 ' + c.shortWon.toLocaleString() + '원이 더 필요합니다' };
}
