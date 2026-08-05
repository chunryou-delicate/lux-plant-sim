/* ★ 살림이 구조적으로 적자다 — 「파산일 < 이사일」의 간격을 메우는 세 갈래를 잰다
 *
 *   node tools/probe_economy_gap.mjs               후보 전부 + 딸린 검사
 *   node tools/probe_economy_gap.mjs --quick       세 경로만 (딸린 검사 생략)
 *   node tools/probe_economy_gap.mjs --only=㉢2    후보 하나만 (쉼표로 여러 개)
 *
 * ══ 무엇을 재나 ═══════════════════════════════════════════════════════════
 * `docs/handoff/tutlength-to-plan.md` §7-① 이 남긴 문제가 출발점이다 —
 * *"189일도 126일도 **파산을 무시했을 때**의 값이다. 진짜 플레이라면 60일쯤 끝난다."*
 * 하네스가 파산에서 안 멈추기 때문이었다. 그래서 이 도구는 **두 시계를 나란히** 잰다.
 *
 *   ① 파산일 — 지갑이 언제 0이 되나. 벌이 세 수준(콩나물만 / 콩+무순 / 삽수까지)
 *   ② 이사일 — 모주가 언제 이사 자금이 되나. 세 경로(A 등없이 / B 등1개 / C 늦게)
 *   ★ 합격선은 **파산일 ≥ 이사일** 하나다. 못 넘으면 0원으로 보내는 날이 생기고,
 *     0원이면 씨앗도 못 사서(콩 700·무 600원) 회전이 끊긴다 — 벌이가 아예 0이 된다.
 *
 * ══ 기준선 (박사님 확정 · 2026-08-05) ══════════════════════════════════════
 *   · 월세 300,000 → **150,000원**. ⚠ `rentWon` 만 내리면 **하루 지출이 안 준다** —
 *     `dailyCashOutWon` 이 `dailySpendWon − rentWon/30` 이라 월세 몫을 도로 채운다.
 *     "하루 몫 10,000 → 5,000" 이 되려면 `dailySpendWon` 20,000 → **15,000** 도 같이 가야 한다.
 *     그래서 이 도구의 기준선은 **둘 다** 바꾼 것이다(아래 BASE).
 *   · 80일 목표를 버리고 150일 근처로 다시 잡는다 → `③-b` 는 판정에서 뺐다
 *   · 속도 계수 `slow 1.5 · best 2.0` 을 **같이 켠 상태**로도 잰다 (tutlength §5)
 *
 * ══ 저장소를 한 글자도 안 건드리는 방법 ══════════════════════════════════
 * 손잡이가 전부 소스 상수라(`Object.freeze` · `import json`) 메모리로 못 바꾼다.
 * 그래서 **임시 폴더에 사본(run root)을 만들고 거기서만** 값을 갈아 끼운다.
 * 진짜 `src/**` · `data/**` · `*.html` 은 **읽기만** 한다. 사본은 끝나면 지운다.
 * 후보마다 새 프로세스인 이유는 `loop.js` 가 계수를 모듈 최상단에서 한 번만 읽어서다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const IS_WORKER = process.argv.includes('--worker');

/* ══════════════════════════════════════════════════════════════════════════
   기준선 — 박사님이 이미 정하신 것. 후보는 전부 이 위에 얹는다
   ══════════════════════════════════════════════════════════════════════ */
const BASE = Object.freeze({ rent: 150_000, spend: 15_000 });
const SPEED_NOW = Object.freeze({ slow: 1, best: 1.25, good: 1.25, over: 1 });
const SPEED_A3  = Object.freeze({ slow: 1.5, best: 2, good: 2, over: 1 });

/* 벌이 세 수준 — 박사님이 직접 재신 값(콩나물 3,000 + 무순 2,000 + 삽수 3,000).
   ★ 이건 **가정**이지 이 도구가 잰 값이 아니다. 실측 벌이는 표 ③ 에 따로 낸다. */
const INCOME_LEVELS = Object.freeze([
  { id: 'bean',  ko: '콩나물만',   won: 3_000, cut: 0 },
  { id: 'musun', ko: '콩+무순',    won: 5_000, cut: 0 },
  { id: 'cut',   ko: '삽수까지',   won: 8_000, cut: 3_000 }   // cut = 그중 삽수 몫
]);

/* ══════════════════════════════════════════════════════════════════════════
   후보표 — 세 갈래와 섞은 것
   ────────────────────────────────────────────────────────────────────────
   speed   data/growth_tuning.json  growth_speed.by_band
   cash    TUTORIAL_RULES.startCashWon        (㉡)
   move    TUTORIAL_RULES.moveOutCostWon
   cutWon  shop.UNIT_WON.monstera.cutting     (㉠ 삽수 하한가 = 잎1 삽수 값)
   rootDays propagation.METHODS.water.rootDays (㉠ 자를 수 있는 주기)
   adultMin shop.ADULT_MIN_LEAVES             (㉢ 몇 장부터 성체로 보나 = 등급 상한 해제)
   halfmoon VARIE_GRADES.halfmoon.minVarieLeaves (㉢ 하프문 문턱)
   ══════════════════════════════════════════════════════════════════════ */
const CANDIDATES = [
  { id: '기준0', ko: '월세 15만만 (속도 그대로)', speed: SPEED_NOW, cost: '—' },
  { id: '기준',  ko: '월세 15만 + slow1.5/best2.0', 기준: true, cost: '—' },

  /* ㉠ 삽수 벌이 ─ 삽수 값과 회전 주기 */
  { id: '㉠1', ko: '삽수값 ×2 (12,000→24,000)', cutWon: 24_000,
    cost: '삽수 한 개가 잎 2장짜리 화분(20,000)보다 비싸진다 — 「키우면 값이 붙는다」가 흔들린다' },
  { id: '㉠2', ko: '삽수값 ×4 (12,000→48,000)', cutWon: 48_000,
    cost: '위와 같음 · 더 심함. 잎 4장 성체(40,000)보다 잎 1장 삽수가 비싸다' },
  { id: '㉠3', ko: '뿌리 6일 (12→6)', rootDays: 6,
    cost: '물꽂이 12일이 growth_tuning.gauge_days 와 같은 12 라는 근거가 끊긴다' },
  { id: '㉠4', ko: '삽수값 ×4 + 뿌리 6일', cutWon: 48_000, rootDays: 6,
    cost: '위 둘을 한꺼번에' },

  /* ㉡ 시작 자금 ─ 올리는 방향이다(내리면 파산이 더 빨라진다) */
  { id: '㉡0', ko: '시작 120만', cash: 1_200_000,
    cost: '「없음이 정체성인 고아 자취생」이라는 시작점을 묽게 한다 (game_flow.md §㉯)' },
  { id: '㉡1', ko: '시작 130만', cash: 1_300_000,
    cost: '위와 같음. game_flow.md §㉯ 가 이미 "100 → 130~150만 · 가장 잘 듣는다"고 적어 둔 구간이다' },
  { id: '㉡2', ko: '시작 140만', cash: 1_400_000,
    cost: '위와 같음 · 더 심함' },
  { id: '㉡3', ko: '시작 150만', cash: 1_500_000,
    cost: '★**이사 자금과 같은 액수**다 — 아래 표 ② 에서 판이 깨진다' },
  { id: '㉡4', ko: '시작 200만', cash: 2_000_000,
    cost: '시작 자금이 이사 자금을 넘는다 — 「모아서 나간다」가 완전히 사라진다' },

  /* ㉢ 모주 판매 문턱 ─ 잎 2장에도 값이 붙게 */
  { id: '㉢1', ko: '성체 문턱 잎2 (등급 상한 해제)', adultMin: 2,
    cost: '잎2·무늬2 가 160,000 → 711,111원. 「삽수는 무늬가 굳었는지 모른다」(shop §CUTTING_GRADE_CAP)가 깨진다' },
  { id: '㉢2', ko: '㉢1 + 하프문 문턱 2장', adultMin: 2, halfmoon: 2,
    cost: '잎2·무늬2 가 1,220,000원. 「하프문은 잎 셋」이라는 등급 사다리가 한 칸 내려온다' },
  { id: '㉢3', ko: '㉢2 + 이사 120만', adultMin: 2, halfmoon: 2, move: 1_200_000,
    cost: '★잎 2장으로 실제로 나간다. "무늬 잎 셋을 길러 냈다"가 이사의 뜻이 아니게 된다' },
  { id: '㉢4', ko: '㉢1 + 이사 72만', adultMin: 2, move: 721_111,
    cost: '위와 같음 + 원룸 이사비 실비 근거(150만)를 절반 아래로 깎는다' },

  /* 섞은 것 */
  { id: '★x1', ko: '㉢3 + 시작 130만', adultMin: 2, halfmoon: 2, move: 1_200_000, cash: 1_300_000,
    cost: '㉢3 의 대가 + 시작점이 묽어진다' },
  { id: '★x2', ko: '㉢3 + 삽수값 ×2', adultMin: 2, halfmoon: 2, move: 1_200_000, cutWon: 24_000,
    cost: '㉢3 의 대가 + 삽수 값의 근거' },
  { id: '★x3', ko: '㉡1(시작 130만) + 삽수값 ×2', cash: 1_300_000, cutWon: 24_000,
    cost: '길이는 안 건드리고 살림만 — 시작점과 삽수 값 근거를 둘 다 조금씩 내준다' },
  { id: '★x4', ko: '㉢4 + 시작 130만', adultMin: 2, move: 721_111, cash: 1_300_000,
    cost: '㉢4 의 대가 + 시작점이 묽어진다' },
  /* ★ ㉢ 를 켜면 시계가 「잎」에서 「달력(가을 게이트 45일)」으로 옮겨 가 등이 값을 잃는다.
       속도를 도로 늦춰서 잎이 다시 시계가 되게 해 보는 것이 ★x5 다. */
  { id: '★x5', ko: '㉢3 + 속도 그대로(slow1.0/best1.25)', adultMin: 2, halfmoon: 2,
    move: 1_200_000, speed: SPEED_NOW,
    cost: '㉢3 의 대가 + 속도 계수를 안 올리므로 ①-2(가을 안에 끝난다)를 다시 잃을 수 있다' },
  { id: '★x6', ko: '㉡1(130만) + ㉢1(성체 문턱 잎2)', cash: 1_300_000, adultMin: 2,
    cost: '시작점 + 삽수 등급 상한. 둘 다 조금씩' },
  { id: '㉡2b', ko: '시작 145만 (벼랑 바로 앞)', cash: 1_450_000,
    cost: '시작 자금이 이사 자금(150만)의 97%다 — 「모아서 나간다」가 거의 사라진다' },
  /* ★ 벼랑(시작 자금 ≥ 이사 자금)을 **옮기면** 시작 자금을 더 올릴 수 있나 — 산수의 끝을 본다 */
  { id: '★x7', ko: '시작 150만 + 이사 200만', cash: 1_500_000, move: 2_000_000,
    cost: '원룸 이사 실비 근거(150만)를 위로 33% 늘린다 + 시작점이 묽어진다' },
  { id: '★x8', ko: '시작 180만 + 이사 250만', cash: 1_800_000, move: 2_500_000,
    cost: '위와 같음 · 더 심함. 잎3·무늬3(183만)으로도 못 닿아 잎이 한 장 더 필요해진다' },
  /* ★★ 이 창이 권하는 조합 — ㉢2(이사비는 안 건드린다) + 속도 그대로 + 시작 130만 */
  { id: '★권', ko: '★㉢2 + 속도 그대로 + 시작 130만', adultMin: 2, halfmoon: 2,
    speed: SPEED_NOW, cash: 1_300_000,
    cost: '내주는 것 셋 — 하프문 문턱 한 칸 · 성체 문턱 한 장 · 시작 자금 30만. ' +
          '이사비 근거(150만)와 속도 계수의 근거는 그대로 남는다' },
  { id: '★권b', ko: '★㉢2 + slow1.5/best2.0 + 시작 130만', adultMin: 2, halfmoon: 2, cash: 1_300_000,
    cost: '위와 같은데 앞 창이 권한 속도 계수를 켠 것 — 등이 사는지 보는 값' },
  /* ★★ ★권 이 189일로 되돌아간 이유 — 속도를 안 올리면 잎2가 튜토 86일에 오는데 그날
     잔액이 0이라 잎2·무늬2(1,220,000) 만으로는 이사 자금 150만에 못 닿는다. 둘 중 하나가 필요하다:
       ★권c 이사 자금을 120만으로 내리거나 · ★권d 시작 자금을 145만으로 올리거나 */
  { id: '★권c', ko: '★㉢2 + 이사 120만 + 속도 그대로 + 시작 130만',
    adultMin: 2, halfmoon: 2, move: 1_200_000, speed: SPEED_NOW, cash: 1_300_000,
    cost: '내주는 것 넷 — 하프문 문턱 · 성체 문턱 · 이사비 20% · 시작 자금 30만. 속도 계수는 안 건드린다' },
  { id: '★권d', ko: '★㉢2 + 이사비 그대로 + 속도 그대로 + 시작 145만',
    adultMin: 2, halfmoon: 2, speed: SPEED_NOW, cash: 1_450_000,
    cost: '이사비 근거(150만)를 지키는 대신 시작 자금이 벼랑(150만) 바로 앞까지 간다' }
];

/* ══ ㉣ 잉여 채소 판매 — 자금 흐름 장부 ═══════════════════════════════════
   ★ 이건 **아직 규칙이 없는 기능**이다(코어에 파는 창구가 없다). 그래서 하네스로 못 재고
     **장부로만** 잰다. 다만 숫자는 하나도 안 지어냈다 — 겹침 표(`cropKindSavedWon`)·
     주기(`CROP_KINDS.harvestDays`)·씨앗과 용기의 **실지출**(`shop.buyPriceOf`)·
     하루 저감 상한(`rules.dailyCropSaveWon`)·곳간 한도(`pantryCapWon` 의 식)를
     전부 진짜 모듈에서 읽어 쓴다. 지갑은 `tutorial.tutorialDay` 가 그대로 굴린다.
   ⚠ 「잉여」의 정의도 코어가 이미 갖고 있다 — `harvestCrop` 이 내는
     `overlapLostWon`(질려서 못 받은 몫) + `spoiledWon`(곳간이 넘쳐 쉰 몫)이다. */
const SELL_RATES = [0, 0.20, 0.2333, 0.25, 0.30, 0.40, 0.50, 0.70, 1.00];
/* ★★ 반지하는 **자리가 14칸**이고 몬스테라가 한 칸을 쓴다 — 작물은 **13칸이 천장**이다
   (`data/profiles/room_profile.banjiha.json` 실측 14 · `docs/food_economy.md` §5 가
   "13슬롯 중 8칸이 콩나물에 잡아먹혀"라고 같은 셈을 한다).
   ⚠ 지금 코드는 한 자리에 시루를 여러 개 두는 것을 안 막는다(`resowCrop` 이 `at` 하나에
     `sirus: N` 을 받는다). 그래서 13칸을 넘는 계획도 **장부로는 돈다** — 아래 ⚠ 줄이 그것이다.
     그게 진짜 되는지는 이 창이 못 정한다(자리 규칙은 house·core 소유). */
const CROP_PLANS = [
  { id: '콩5',      siru: 5,  tray: 0 },
  { id: '콩10',     siru: 10, tray: 0 },
  { id: '콩13',     siru: 13, tray: 0 },   // 자리를 전부 콩나물로
  { id: '콩8무5',   siru: 8,  tray: 5 },
  { id: '⚠콩20무28', siru: 20, tray: 28 }  // 자리 천장(13)을 훌쩍 넘는다
];
const PLAN_MAIN = '콩13';
const PLAN_HONEST = '콩13';                 // ㉣ 없이 지금 규칙으로 할 수 있는 최선
const RATE_MAIN = 0.25;

/* 딸린 검사 — 박사님이 지정하신 것 전부 */
const COLLATERAL = ['test_balance_routes', 'test_save', 'test_maturation', 'test_first_play',
                    'test_first_play_attacks', 'test_cutting_wiring', 'test_headroom',
                    'test_banjiha_routes', 'test_oneroom', 'test_tutorial', 'test_propagation',
                    'test_cuttable', 'test_growth_speed'];
/* ★ `test_balance_routes` 는 FAIL 줄을 세는 것만으로는 부족하다 — 어느 검사가 깨졌는지가 중요하다.
   특히 `①-1`(A≠B) 은 박사님이 "깨뜨리면 안 된다"고 못 박은 줄이라 따로 뽑아 낸다. */
const ROUTE_CHECKS = ['①-1', '①-2', '②-c', '③-b'];

/* ══════════════════════════════════════════════════════════════════════════
                              워커
   ══════════════════════════════════════════════════════════════════════ */
if (IS_WORKER) {
  const opt = JSON.parse(process.env.PROBE_OPTS || '{}');
  const out = await measure(opt);
  process.stdout.write('__RESULT__' + JSON.stringify(out) + '\n');
  process.exit(0);
}

async function measure(OPT) {
  const assert = (await import('node:assert')).default;
  const vm = await import('node:vm');
  const { createProfileLight } = await import('../src/game/room_profile.js');
  const { newState, pot0, setPotSlot, resowCrop, waterCrop, ARRIVAL } = await import('../src/game/state.js');
  const { nextDay, harvestCrop } = await import('../src/game/loop.js');
  const { firstPlayRulesFromBalance, placeBeansprout, moveMonstera, beansproutReady } =
    await import('../src/game/first_play.js');
  const { seasonAt, buyLamp, canMoveOut, moveOut, varieView, TUTORIAL_RULES,
          createTutorialState, tutorialDay, dailyCashOutWon } = await import('../src/game/tutorial.js');
  const { orderItem, stockOf, incomingOf, priceOf, sellCutting, sellPot,
          SELLABLE_CUTTING_STATUS, ADULT_MIN_LEAVES } = await import('../src/game/shop.js');
  const { takeCutting, cuttableNow, cutBudgetOf, motherStatsNow, METHODS } =
    await import('../src/game/propagation.js');

  /* ══ ① 파산 장부 — **진짜 tutorial.tutorialDay 로 굴린다.** 셈을 베끼지 않는다 ══
     벌이는 밖에서 주어지는 것으로 둔다(incomeWon). 콩나물의 「식비 절감」도 살림에서는
     같은 방향의 같은 크기라 이렇게 두어야 박사님이 재신 60/81/90 이 그대로 재현된다. */
  function bustDay(incomeWon, maxDays = 500) {
    const ts = createTutorialState({ enabled: true });
    for (let d = 1; d <= maxDays; d++) {
      tutorialDay(ts, { firstPlayDone: true, savedWon: 0, incomeWon });
      if (ts.bankrupt) return d;
    }
    return null;
  }

  /* ══ ①-b ㉣ 잉여 채소 판매 — 자금 흐름 장부 ══════════════════════════════
     ★ 완전 시차를 전제한다(주기 5일이면 시루 5개까지 하루 하나씩 — first_play §겹침).
       하루에 k개를 거두면 겹침 표가 `표[종류순번 + 그날 순번]` 으로 값을 깎고,
       **깎인 몫(lost)** 과 **곳간이 넘쳐 쉰 몫(spoiled)** 이 합쳐서 「잉여」다.
     ★ 용기는 **한 푼이라도 남으면 하루에 하나씩** 산다 — 플레이어가 할 수 있는 가장
       공격적인 「노가다」다. 이 최선의 경우에도 안 되면 이 갈래는 그림의 떡이다. */
  const { cropCycleSavedWon, CROP_KINDS } = await import('../src/game/first_play.js');
  const { buyPriceOf } = await import('../src/game/shop.js');
  const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  const RULES = firstPlayRulesFromBalance(J('data/balance/characters.json'));
  const PRICE = {
    siru: buyPriceOf('siru'), tray: buyPriceOf('sprout_tray'),
    beanSeed: buyPriceOf('bean_seed'), radishSeed: buyPriceOf('radish_seed')
  };
  const CYCLE = { siru: CROP_KINDS[0].harvestDays, tray: CROP_KINDS[1].harvestDays };
  const FULL  = { siru: cropCycleSavedWon(RULES, 3, 0), tray: cropCycleSavedWon(RULES, 3, 1) };
  /* 손익분기 — **지갑에서 나가는 씨앗값**(정가가 아니라 buyPriceOf)을 한 회전분으로 나눈 것 */
  const BREAKEVEN = { siru: PRICE.beanSeed / FULL.siru, tray: PRICE.radishSeed / FULL.tray };
  /* 「자리가 값을 바꾼다」 — 품질 3/2/1끼일 때 한 회전분이 얼마인가 */
  const BYQUALITY = [3, 2, 1].map(m => ({ meals: m,
    siru: cropCycleSavedWon(RULES, m, 0), tray: cropCycleSavedWon(RULES, m, 1) }));

  const harvestsToday = (n, cycle, d) => Math.floor(n / cycle) + ((d % cycle) < (n % cycle) ? 1 : 0);

  function cropLedger({ rate = 0, siruTarget = 1, trayTarget = 0, maxDays = 600, buy = true }) {
    const ts = createTutorialState({ enabled: true });
    let siru = 1, tray = 0;                 // 시작 = 선물로 받은 시루 하나
    let bust = null, reach = null, invested = 0, cumNet = 0, payback = null;
    let pantry = 0, soldTotal = 0, seedTotal = 0, savedTotal = 0;
    let steadyFrom = null, steadyNet = 0, steadyDays = 0;
    for (let d = 1; d <= maxDays; d++) {
      /* 오늘 거둔 것 — 종류마다 그날 순번(overlapIndex)이 붙는다 */
      const kS = harvestsToday(siru, CYCLE.siru, d);
      const kT = harvestsToday(tray, CYCLE.tray, d);
      let saved = 0, full = 0;
      for (let j = 0; j < kS; j++) { saved += cropCycleSavedWon(RULES, 3, 0 + j); full += FULL.siru; }
      for (let j = 0; j < kT; j++) { saved += cropCycleSavedWon(RULES, 3, 1 + j); full += FULL.tray; }
      const lost = Math.max(0, full - saved);
      /* 곳간 — 한도는 `pantryCapWon` 의 식(용기 하나가 한 회전에 낼 값 × 개수) */
      const cap = FULL.siru * siru + FULL.tray * tray;
      pantry += saved;
      const spoiled = Math.max(0, pantry - cap);
      pantry -= spoiled;
      /* 오늘 꺼내 먹는 몫 — 하루 저감 상한(끼니 상한이 이기면 그 값) */
      const use = Math.min(RULES.dailyCropSaveWon, Math.round(pantry));
      pantry -= use;
      const income = Math.round(rate * (lost + spoiled));
      const seed = kS * PRICE.beanSeed + kT * PRICE.radishSeed;

      tutorialDay(ts, { firstPlayDone: true, savedWon: use, incomeWon: income });
      ts.cashWon -= seed;
      if (ts.cashWon < 0) { ts.cashWon = 0; ts.bankrupt = true; }
      soldTotal += income; seedTotal += seed; savedTotal += use;
      cumNet += income + use - seed;
      if (payback == null && invested > 0 && cumNet >= invested) payback = d;

      /* 용기를 산다 — 목표까지 하루에 하나씩, 돈이 남는 한 */
      if (buy && !ts.bankrupt) {
        if (siru < siruTarget && ts.cashWon >= PRICE.siru) { ts.cashWon -= PRICE.siru; invested += PRICE.siru; siru++; }
        else if (tray < trayTarget && ts.cashWon >= PRICE.tray) { ts.cashWon -= PRICE.tray; invested += PRICE.tray; tray++; }
      }
      if (reach == null && siru >= siruTarget && tray >= trayTarget) reach = d;
      if (reach != null && d > reach + 20) { steadyFrom = steadyFrom ?? d; steadyNet += income + use - seed; steadyDays++; }
      if (bust == null && ts.bankrupt) bust = d;
    }
    return { rate, siruTarget, trayTarget, bust, reach, invested, payback,
             siru, tray, soldTotal, seedTotal, savedTotal,
             steadyPerDay: steadyDays ? Math.round(steadyNet / steadyDays) : null };
  }

  /* 비율 × 계획 표 · 그리고 대표 한 벌 */
  const gap4 = {
    price: PRICE, cycle: CYCLE, full: FULL, breakeven: BREAKEVEN, byQuality: BYQUALITY,
    dailyCapWon: RULES.dailyCropSaveWon, mealCapWon: RULES.cropMealCapWon,
    grid: SELL_RATES.map(r => ({ rate: r,
      plans: CROP_PLANS.map(p => ({ id: p.id,
        ...cropLedger({ rate: r, siruTarget: p.siru, trayTarget: p.tray }) })) })),
    main: cropLedger({ rate: RATE_MAIN,
                       siruTarget: CROP_PLANS.find(p => p.id === PLAN_MAIN).siru,
                       trayTarget: CROP_PLANS.find(p => p.id === PLAN_MAIN).tray }),
    /* ★ ㉣ 가 **없을 때** 지금 규칙으로 할 수 있는 최선의 살림 — 이게 진짜 파산일이다 */
    honest: cropLedger({ rate: 0,
                       siruTarget: CROP_PLANS.find(p => p.id === PLAN_HONEST).siru,
                       trayTarget: CROP_PLANS.find(p => p.id === PLAN_HONEST).tray }),
    main50: cropLedger({ rate: 0.5,
                       siruTarget: CROP_PLANS.find(p => p.id === PLAN_MAIN).siru,
                       trayTarget: CROP_PLANS.find(p => p.id === PLAN_MAIN).tray }),
    /* 시루 한 개를 **더** 들이면 하루에 얼마가 남나 — 겹침 순번(overlap)마다 다르다 */
    /* 하루 저감 상한(5,000원) **아래**면 깎인 저감이 실제로 산다.
       상한을 이미 넘겼으면 그 저감도 곳간에서 쉬어 버리므로 0이고, 잉여가 한 회전분 전부다. */
    marginal: [...[0, 1, 2, 3].map(j => {
      const saved = cropCycleSavedWon(RULES, 3, j);
      return { ko: `겹침 ${j}번째 (상한 아래)`, saved, surplus: FULL.siru - saved };
    }), { ko: '저감 상한을 넘긴 뒤', saved: 0, surplus: FULL.siru }]
      .map(m => ({ ...m, perDay: SELL_RATES.map(r => ({ rate: r,
        won: Math.round((m.saved + r * m.surplus - PRICE.beanSeed) / CYCLE.siru) })) }))
  };

  /* ══ ② 세 경로 — test_balance_routes.play() 와 같은 하네스 ══ */
  const light = createProfileLight(J('data/profiles/room_profile.banjiha.json'), {
    lightTh: J('data/balance/light_thresholds.json'),
    weatherBalance: J('data/balance/weather.json')
  });
  const DARK = 'banjiha-dresser:1';
  const SILL = 'banjiha-sill:0';
  const MOVE_OUT_WON = TUTORIAL_RULES.moveOutCostWon;

  function makeThree() {
    class V3 {
      constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
      set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
      clone() { return new V3(this.x, this.y, this.z); }
      copy(v) { return this.set(v.x, v.y, v.z); }
      add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
      sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
      addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
      multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
      lengthSq() { return this.x ** 2 + this.y ** 2 + this.z ** 2; }
      length() { return Math.sqrt(this.lengthSq()); }
      normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
      crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
      lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
      applyAxisAngle() { return this; }
      distanceTo(v) { return this.clone().sub(v).length(); }
    }
    const nop = function () { return new Proxy({}, handler); };
    const handler = {
      get(t, k) {
        if (k === 'then') return undefined;
        if (k === Symbol.toPrimitive) return () => 0;
        if (!(k in t)) t[k] = new Proxy(nop, handler);
        return t[k];
      },
      apply() { return new Proxy({}, handler); },
      construct() { return new Proxy({ position: new V3(), rotation: new V3(), scale: new V3(1, 1, 1) }, handler); }
    };
    return new Proxy({ Vector3: V3, Vector2: V3 }, handler);
  }
  function loadGrowth() {
    const html = fs.readFileSync(path.join(ROOT, 'plant_grow.html'), 'utf8');
    const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    const main = blocks[blocks.length - 1];
    assert.ok(main && main.length > 20000, 'plant_grow.html 본문 스크립트를 못 찾았습니다');
    const src = main.replace(/\n\s*init\(\);\s*updateCam\(\);\s*$/, '\n/* init() 제거(헤드리스) */\n');
    assert.notEqual(src, main, 'init() 호출부를 못 찾았습니다');
    const tuning = fs.readFileSync(path.join(ROOT, 'data', 'growth_tuning.json'), 'utf8');
    const el = () => ({
      value: '', textContent: '', checked: false, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
      appendChild() {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
      querySelector() { return null; }, querySelectorAll() { return []; }, insertAdjacentHTML() {}, focus() {}, remove() {}
    });
    const ctx = {
      THREE: makeThree(), console: { log() {}, warn() {}, error() {} },
      document: { getElementById() { return null; }, createElement: el, querySelector() { return null; },
        querySelectorAll() { return []; }, addEventListener() {}, body: el(), documentElement: el() },
      location: { search: '', href: 'http://localhost/plant_grow.html' },
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
      requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
      setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
      fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(tuning)) }),
      Math, JSON, Date, Object, Array, Number, String, Boolean, Map, Set, Error, isFinite, isNaN, parseFloat, parseInt
    };
    ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
    vm.createContext(ctx);
    vm.runInContext(src, ctx, { filename: 'plant_grow.html' });
    return ctx;
  }
  const G = loadGrowth();
  for (let i = 0; i < 200 && !G.thLoaded(); i++) await new Promise(r => setImmediate(r));
  assert.ok(G.thLoaded(), '임계값 정본(data/growth_tuning.json)이 안 실렸습니다');

  function standGrowth(seed) {
    try { G.plantSeed(seed); } catch { /* 3D 무대 없음 */ }
    G.matResetAll(); G.resetDailyLight(); G.setGrowth(ARRIVAL.growthDays);
    return {
      assertContract: () => true,
      setDailyLight: d => G.setDailyLight(d),
      advanceTo(d) { const r = G.advanceTo(d); return { ...r, drawn: true, drawError: null }; },
      setGrowth(d) { const r = G.setGrowth(d); return { ...r, drawn: true, drawError: null }; },
      calendarDay: () => G.calendarDay(), growthDays: () => G.growthDays(),
      growthBlocked: () => G.growthBlocked(), growthPhase: () => G.growthPhase(),
      dli7: () => G.dli7(), dliCV: () => G.dliCV(), ageOf: d => G.ageOf(d),
      cuttableNodes: () => G.cuttableNodes(), leafStats: () => G.leafStats()
    };
  }
  function viewOf(S, io) {
    const raw = io.growth.cuttableNodes();
    const stats = io.growth.leafStats();
    const v = varieView(S, { nodes: raw, stats });
    return { nodes: cuttableNow(S, v.nodes || []), stats: motherStatsNow(S, v.stats),
             budget: cutBudgetOf(S, v.nodes || []) };
  }
  function pickNode(nodes, budget) {
    const varie = nodes.filter(n => n.variegatedLeaves > 0 && (!budget || n.leaves <= budget.leftLeaves - 1))
                       .sort((a, b) => a.leaves - b.leaves);
    if (varie.length) return varie[0];
    const one = nodes.filter(n => n.leaves === 1 && (!budget || budget.leftLeaves - 1 >= 1));
    return one.length ? one[0] : null;
  }
  const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

  function play(o = {}) {
    const io = { light, growth: standGrowth(o.seed || 1) };
    const S = newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });
    light.clearCache();
    placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });

    let cuttingIncome = 0, varieIncome = 0, potIncome = 0, cutsTaken = 0;
    let bust = null, zeroDays = 0;
    const sell = c => {
      const varie = c.source.variegatedLeaves > 0;
      const r = sellCutting(S, c.id);
      if (varie) varieIncome += r.won; else cuttingIncome += r.won;
    };
    let lastEff = 0, lastLeaves = 0, lastSeason = null, lastTday = 0;

    for (let d = 1; d <= (o.days || 400); d++) {
      try { waterCrop(S); } catch { /* 아직 안 놓은 시루 */ }
      nextDay(S, io);
      let harvested = null;
      if (beansproutReady(S.firstPlay.beansprout)) harvested = harvestCrop(S, io);
      const ts = S.tutorial;
      if (harvested && harvested.arrived) {
        setPotSlot(S, pot0(S), SILL, light.room.slots);
        moveMonstera(S.firstPlay, SILL, { slots: light.room.slots });
      }

      const b = S.firstPlay.beansprout;
      const SIRUS = o.sirus || 1;
      if (b.sirus + stockOf(S, 'siru') + incomingOf(S, 'siru') < SIRUS) {
        try { orderItem(S, 'siru', SIRUS - b.sirus - stockOf(S, 'siru') - incomingOf(S, 'siru')); } catch {}
      }
      const target = Math.min(SIRUS, b.sirus + stockOf(S, 'siru'));
      if (stockOf(S, 'bean_seed') + incomingOf(S, 'bean_seed') < target) {
        try { orderItem(S, 'bean_seed', target - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed')); } catch {}
      }
      if (b.harvested && stockOf(S, 'bean_seed') >= target) {
        try { resowCrop(S, { sirus: target, at: DARK, slots: light.room.slots }); } catch {}
      }

      if (o.buyLamp && ts.lamp.unlocked && ts.lamp.owned < (o.lamps || 1) && ts.cashWon >= ts.rules.lampPriceWon) {
        buyLamp(ts); S.lamps.count = ts.lamp.owned; light.clearCache();
      }

      if (ts.day >= (o.startCutDay || 0)) {
        const v0 = pot0(S) ? viewOf(S, io) : null;
        const node = v0 ? pickNode(v0.nodes, v0.budget) : null;
        if (node && (S.cuttings || []).length === 0 && stockOf(S, 'jar') + incomingOf(S, 'jar') === 0) {
          try { orderItem(S, 'jar', 1); } catch {}
        }
        if (node && stockOf(S, 'jar') >= 1) {
          try { takeCutting(S, { nodes: v0.nodes, nodeId: node.nodeId, container: 'jar' }); cutsTaken++; } catch {}
        }
        for (const c of [...(S.cuttings || [])]) if (SELLABLE_CUTTING_STATUS.includes(c.status)) sell(c);
      }

      if (!ts.movedOut && pot0(S)) {
        const v = viewOf(S, io);
        const potWon = v.stats && v.stats.leaves >= 1
          ? priceOf({ leaves: v.stats.leaves, variegatedLeaves: v.stats.variegatedLeaves }).won : 0;
        let cut = 0;
        for (const c of S.cuttings || [])
          if (SELLABLE_CUTTING_STATUS.includes(c.status))
            cut += priceOf({ leaves: c.source.leaves, variegatedLeaves: c.source.variegatedLeaves }).won;
        /* ★ 배움이 아직 남았으면 안 판다 — 팔아도 못 나가고, 판 그루는 안 돌아온다.
           ⚠ `test_balance_routes.play` 에는 이 문이 없다. 그래서 시작 자금이 이사 자금에
             가까운 후보(㉡3 시작 150만)에서 **1일차에 몬스테라를 12,000원에 팔아 버리고**
             그 뒤로 아무것도 못 하는 판이 나왔다(0% · 유효 45 · 잎 1). 하네스의 흠이지
             게임의 규칙이 아니라서 여기서만 막는다. */
        if (ts.cashWon + cut + potWon >= MOVE_OUT_WON && canMoveOut(ts).learningLeft.length === 0) {
          for (const c of [...(S.cuttings || [])]) if (SELLABLE_CUTTING_STATUS.includes(c.status)) sell(c);
          if (potWon && ts.cashWon < MOVE_OUT_WON) {
            sellPot(S, { leaves: v.stats.leaves, variegatedLeaves: v.stats.variegatedLeaves });
            potIncome += potWon;
          }
        }
      }
      if (!ts.movedOut && canMoveOut(ts).ok) moveOut(ts);

      if (ts.bankrupt && bust == null) bust = ts.day;
      if (ts.cashWon <= 0) zeroDays++;
      lastEff = io.growth.growthDays(); lastLeaves = io.growth.leafStats().leaves;
      lastSeason = seasonAt(ts, ts.day); lastTday = ts.day;
      if (ts.movedOut) break;
    }
    return { cuttingIncome, varieIncome, potIncome, cutsTaken, bust, zeroDays,
             movedOut: S.tutorial.movedOut, lastDay: lastTday,
             season: lastSeason, eff: lastEff, leaves: lastLeaves };
  }

  const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);
  function route(name, o) {
    const runs = SEEDS.map(seed => play({ ...o, seed }));
    const ok = runs.filter(r => r.movedOut);
    const seasons = {};
    for (const r of ok) seasons[r.season] = (seasons[r.season] || 0) + 1;
    const busts = runs.map(r => r.bust).filter(v => v != null);
    return {
      name, n: runs.length, okN: ok.length, rate: ok.length / runs.length, seasons,
      autumn: ok.filter(r => r.season === 'autumn').length,
      medDay: ok.length ? median(ok.map(r => r.lastDay)) : null,
      medEff: median(runs.map(r => r.eff)),
      medLeaves: median(runs.map(r => r.leaves)),
      medCut: median(runs.map(r => r.cuttingIncome + r.varieIncome)),
      medPot: median(runs.map(r => r.potIncome)),
      medCuts: median(runs.map(r => r.cutsTaken)),
      brokeN: busts.length, medBust: busts.length ? median(busts) : null,
      medZero: median(runs.map(r => r.zeroDays))
    };
  }
  const A = route('A', { buyLamp: false });
  const B = route('B', { buyLamp: true, lamps: 1 });
  const C = route('C', { buyLamp: true, lamps: 1, startCutDay: 12 });

  /* 벌이 수준별 파산일 — 삽수 값을 올린 후보는 그 몫을 배수만큼 늘린다(★가정) */
  const cutMult = OPT.cutMult || 1;
  const levels = INCOME_LEVELS.map(L => ({
    ...L, wonUsed: L.won + L.cut * (cutMult - 1),
    bust: bustDay(L.won + L.cut * (cutMult - 1))
  }));

  /* 값의 사다리 — 이 후보에서 잎 2·3장이 얼마인가 */
  const ladder = [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]].map(([l, v]) =>
    ({ l, v, won: priceOf({ leaves: l, variegatedLeaves: v }).won }));

  return {
    A, B, C, levels, ladder, gap4,
    moveOutWon: MOVE_OUT_WON, startCash: TUTORIAL_RULES.startCashWon,
    rentWon: TUTORIAL_RULES.rentWon, spendWon: TUTORIAL_RULES.dailySpendWon,
    dailyOut: dailyCashOutWon({ rules: TUTORIAL_RULES, movedOut: false }),
    adultMin: ADULT_MIN_LEAVES, rootDays: METHODS.water.rootDays,
    p11: !(A.medDay === B.medDay && A.medEff === B.medEff && A.medLeaves === B.medLeaves),
    p12: A.autumn > A.okN / 2
  };
}

/* ══════════════════════════════════════════════════════════════════════════
                     부모 — 사본을 만들고 값을 갈아 끼운다
   ══════════════════════════════════════════════════════════════════════ */
const argOnly = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
const QUICK = process.argv.includes('--quick');

const RUN = fs.mkdtempSync(path.join(os.tmpdir(), 'byeot-econgap-'));
process.on('exit', () => { try { fs.rmSync(RUN, { recursive: true, force: true }); } catch {} });

console.log('══ 살림 적자 · 파산일 vs 이사일 실측 (probe_economy_gap) ═══════════════');
console.log(`  사본: ${RUN}`);
console.log('  ★ 진짜 src/** · data/** · *.html 은 읽기만 한다. 값은 이 사본에서만 갈아 끼운다.');
console.log(`  기준선 — 월세 ${BASE.rent.toLocaleString()}원 · 하루지출 ${BASE.spend.toLocaleString()}원`);
console.log('           (⚠ 둘 다 바꿔야 하루 몫이 10,000 → 5,000 이 된다. rentWon 만 내리면 안 준다)');

for (const d of ['src', 'data']) fs.cpSync(path.join(ROOT, d), path.join(RUN, d), { recursive: true });
fs.mkdirSync(path.join(RUN, 'tools'), { recursive: true });
for (const f of ['plant_grow.html', 'game.html', 'index.html'])
  if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(RUN, f));
fs.copyFileSync(fileURLToPath(import.meta.url), path.join(RUN, 'tools', 'probe_economy_gap.mjs'));
if (!QUICK) {
  for (const t of COLLATERAL) {
    const s = path.join(ROOT, 'tools', `${t}.mjs`);
    if (fs.existsSync(s)) fs.copyFileSync(s, path.join(RUN, 'tools', `${t}.mjs`));
  }
  for (const extra of ['assets', 'docs', 'vendor'])
    if (fs.existsSync(path.join(ROOT, extra)))
      try { fs.symlinkSync(path.join(ROOT, extra), path.join(RUN, extra), 'junction'); } catch {}
}

const F = {
  tune: path.join(RUN, 'data', 'growth_tuning.json'),
  tuto: path.join(RUN, 'src', 'game', 'tutorial.js'),
  shop: path.join(RUN, 'src', 'game', 'shop.js'),
  prop: path.join(RUN, 'src', 'game', 'propagation.js')
};
const ORIG = Object.fromEntries(Object.entries(F).map(([k, p]) => [k, fs.readFileSync(p, 'utf8')]));

function applyCandidate(c) {
  /* ① 속도 계수 */
  const t = JSON.parse(ORIG.tune);
  if (!t.growth_speed) t.growth_speed = {};
  t.growth_speed.by_band = { ...(t.growth_speed.by_band || SPEED_NOW), ...(c.speed || SPEED_A3) };
  fs.writeFileSync(F.tune, JSON.stringify(t, null, 2));

  /* ② TUTORIAL_RULES — 기준선(월세·하루지출)은 항상 얹는다 */
  let s = ORIG.tuto;
  const put = (key, v) => {
    const re = new RegExp(`(${key}:\\s*)[\\d_]+`);
    if (!re.test(s)) throw new Error(`tutorial.js 에서 ${key} 를 못 찾았습니다`);
    s = s.replace(re, `$1${v}`);
  };
  put('rentWon', c.rent != null ? c.rent : BASE.rent);
  put('dailySpendWon', c.spend != null ? c.spend : BASE.spend);
  if (c.cash != null) put('startCashWon', c.cash);
  if (c.move != null) put('moveOutCostWon', c.move);
  fs.writeFileSync(F.tuto, s);

  /* ③ shop.js — 값의 사다리 */
  let sh = ORIG.shop;
  const sub = (re, to, what) => {
    if (!re.test(sh)) throw new Error(`shop.js 에서 ${what} 를 못 찾았습니다`);
    sh = sh.replace(re, to);
  };
  if (c.adultMin != null)
    sub(/(export const ADULT_MIN_LEAVES = )\d+/, `$1${c.adultMin}`, 'ADULT_MIN_LEAVES');
  if (c.halfmoon != null)
    sub(/(id: 'halfmoon',[^}]*?minVarieLeaves: )\d+/, `$1${c.halfmoon}`, "halfmoon minVarieLeaves");
  if (c.cutWon != null)
    sub(/(monstera: Object\.freeze\(\{ cutting: )[\d_]+/, `$1${c.cutWon}`, 'UNIT_WON.monstera.cutting');
  fs.writeFileSync(F.shop, sh);

  /* ④ propagation.js — 뿌리내림 주기 */
  let pr = ORIG.prop;
  if (c.rootDays != null) {
    const re = /(id: 'water', ko: '물꽂이',\s*\n\s*rootDays: )\d+/;
    if (!re.test(pr)) throw new Error('propagation.js 에서 water.rootDays 를 못 찾았습니다');
    pr = pr.replace(re, `$1${c.rootDays}`);
  }
  fs.writeFileSync(F.prop, pr);
}

function runWorker(c) {
  const cutMult = (c.cutWon ? c.cutWon / 12_000 : 1) * (c.rootDays ? 12 / c.rootDays : 1);
  const r = spawnSync(process.execPath, [path.join(RUN, 'tools', 'probe_economy_gap.mjs'), '--worker'], {
    env: { ...process.env, PROBE_OPTS: JSON.stringify({ cutMult }) },
    encoding: 'utf8', maxBuffer: 1 << 26
  });
  const m = (r.stdout || '').match(/__RESULT__(.*)/);
  if (!m) throw new Error(`워커 실패 (${c.id}):\n${(r.stderr || '').slice(-1800)}`);
  return JSON.parse(m[1]);
}

function runCollateral() {
  const broken = [], detail = [];
  let routes = null;
  for (const t of COLLATERAL) {
    const f = path.join(RUN, 'tools', `${t}.mjs`);
    if (!fs.existsSync(f)) continue;
    const r = spawnSync(process.execPath, [f], { cwd: RUN, encoding: 'utf8', maxBuffer: 1 << 26 });
    const out = (r.stdout || '') + (r.stderr || '');
    const lines = (out.match(/^FAIL\s+.*$/gm) || []);
    /* ★ `test_balance_routes` 의 줄별 판정 — ①-1 하나가 이 작업의 붉은 선이다 */
    if (t === 'test_balance_routes') {
      routes = {};
      for (const id of ROUTE_CHECKS) {
        const m = out.match(new RegExp(`^(PASS|FAIL|WARN)\\s+${id}\\b`, 'm'));
        routes[id] = m ? m[1] : '?';
      }
    }
    const said = /^\w[\w_]*:\s*FAIL/m.test(out);
    if (lines.length || said || r.status !== 0) {
      broken.push(`${t}${lines.length ? `(${lines.length})` : ''}`);
      for (const l of lines.slice(0, 3)) detail.push(`${t} — ${l.replace(/^FAIL\s+/, '').slice(0, 100)}`);
      if (!lines.length) detail.push(`${t} — 종료코드 ${r.status} (${(out.match(/Error:.*/) || ['사유 미상'])[0].slice(0, 80)})`);
    }
  }
  return { broken, detail, routes };
}

const only = argOnly ? argOnly.split(',') : null;
const list = CANDIDATES.filter(c => !only || only.includes(c.id));
const rows = [];
for (const c of list) {
  applyCandidate(c);
  process.stderr.write(`  … ${c.id} ${c.ko}\n`);
  const m = runWorker(c);
  const col = QUICK ? null : runCollateral();
  rows.push({ c, m, broken: col && col.broken, detail: col && col.detail, routes: col && col.routes });
}

/* ── 표 ───────────────────────────────────────────────────────────────── */
const pad = (s, n) => { s = String(s); let w = 0; for (const ch of s) w += ch.charCodeAt(0) > 0x2000 ? 2 : 1;
                        return s + ' '.repeat(Math.max(0, n - w)); };
const pct = v => `${(v * 100).toFixed(0)}%`;
const yn = b => b ? 'PASS' : 'FAIL';
const D = v => v == null ? '—' : v + '일';

console.log('');
console.log('── ① 파산일 (벌이 세 수준 · tutorial.tutorialDay 를 그대로 굴린 장부) ──');
console.log(pad('후보', 30) + pad('시작자금', 11) + pad('하루나감', 9) +
            pad('콩나물만', 9) + pad('콩+무순', 9) + pad('삽수까지', 9) + '삽수 몫 가정');
for (const { c, m } of rows) {
  const L = m.levels;
  console.log(pad(c.id + ' ' + c.ko, 30) + pad(m.startCash.toLocaleString(), 11) +
              pad(m.dailyOut.toLocaleString(), 9) +
              pad(D(L[0].bust), 9) + pad(D(L[1].bust), 9) + pad(D(L[2].bust), 9) +
              `${L[2].wonUsed.toLocaleString()}원/일`);
}

console.log('');
console.log('── ② 이사일 · 세 경로 (씨앗 24판 · 반지하 · 최대 400일) ─────────────');
console.log(pad('후보', 30) + pad('A 등없이', 26) + pad('B 등1개', 26) + pad('C 늦게', 22) +
            pad('①-1', 6) + pad('①-2', 6) + '★등 이득');
for (const { c, m } of rows) {
  const f = r => `${pct(r.rate)} ${D(r.medDay)} 잎${r.medLeaves} 유효${r.medEff}`;
  const gain = (m.A.medDay != null && m.B.medDay != null && m.B.medDay > 0)
    ? `−${m.A.medDay - m.B.medDay}일 ×${(m.A.medDay / m.B.medDay).toFixed(2)}` : '—';
  console.log(pad(c.id + ' ' + c.ko, 30) + pad(f(m.A), 26) + pad(f(m.B), 26) + pad(f(m.C), 22) +
              pad(yn(m.p11), 6) + pad(yn(m.p12), 6) + gain);
}

console.log('');
console.log('── ③ ★합격선 — 파산일 ≥ 이사일 인가 (A 경로 기준) ────────────────────');
console.log(pad('후보', 30) + pad('A 이사일', 10) +
            pad('콩나물만', 16) + pad('콩+무순', 16) + pad('삽수까지', 16) + '0원 일수(실측)');
for (const { c, m } of rows) {
  const mv = m.A.medDay;
  const cell = L => {
    if (mv == null || L.bust == null) return '—';
    const gap = L.bust - mv;
    return `${gap >= 0 ? 'PASS' : 'FAIL'} ${gap >= 0 ? '+' : ''}${gap}일`;
  };
  console.log(pad(c.id + ' ' + c.ko, 30) + pad(D(mv), 10) +
              pad(cell(m.levels[0]), 16) + pad(cell(m.levels[1]), 16) + pad(cell(m.levels[2]), 16) +
              `A ${m.A.medZero} · B ${m.B.medZero} · C ${m.C.medZero}`);
}

console.log('');
console.log('── ③-b ★★ 가정을 빼고 — ㉣ 없이 지금 규칙으로 할 수 있는 최선의 살림 ──');
console.log('   (콩나물 13시루 · 완전 시차 · 씨앗과 시루의 **실지출**을 다 뺀 자금 흐름)');
console.log(pad('후보', 30) + pad('A 이사일', 10) + pad('진짜 파산일', 12) +
            pad('합격선', 12) + pad('시루 다 삼', 12) + '안정 순이익');
for (const { c, m } of rows) {
  const h = m.gap4.honest, mv = m.A.medDay;
  const gap = (h.bust == null || mv == null) ? null : h.bust - mv;
  console.log(pad(c.id + ' ' + c.ko, 30) + pad(D(mv), 10) +
              pad(h.bust == null ? '안 망함' : h.bust + '일', 12) +
              pad(gap == null ? '—' : `${gap >= 0 ? 'PASS +' : 'FAIL '}${gap}일`, 12) +
              pad(D(h.reach), 12) +
              (h.steadyPerDay == null ? '—' : h.steadyPerDay.toLocaleString() + '원/일'));
}

console.log('');
console.log('── ④ 실측 — 하네스가 실제로 번 돈 · 실제 파산일 (A 경로 중앙값) ──────');
console.log(pad('후보', 30) + pad('모주판매', 12) + pad('삽수판매', 11) + pad('자른 횟수', 10) +
            pad('실측파산', 10) + '잎2·무늬2 값 / 잎3·무늬3 값');
for (const { c, m } of rows) {
  const l22 = m.ladder.find(x => x.l === 2 && x.v === 2).won;
  const l33 = m.ladder.find(x => x.l === 3 && x.v === 3).won;
  console.log(pad(c.id + ' ' + c.ko, 30) + pad(m.A.medPot.toLocaleString(), 12) +
              pad(m.A.medCut.toLocaleString(), 11) + pad(m.A.medCuts, 10) +
              pad(D(m.A.medBust), 10) + `${l22.toLocaleString()} / ${l33.toLocaleString()}`);
}

/* ── ㉣ 잉여 채소 판매 ─────────────────────────────────────────────────── */
const base = rows.find(r => r.c.기준) || rows[0];
if (base) {
  const g = base.m.gap4;
  console.log('');
  console.log('── ㉣-0 근거 숫자 (전부 진짜 모듈에서 읽은 값) ──────────────────────');
  console.log(`  콩나물  주기 ${g.cycle.siru}일 · 한 회전분 ${g.full.siru.toLocaleString()}원 · ` +
              `씨앗 **지갑에서 ${g.price.beanSeed.toLocaleString()}원**(정가 500 × 1.4) · 시루 ${g.price.siru.toLocaleString()}원`);
  console.log(`  무순    주기 ${g.cycle.tray}일 · 한 회전분 ${g.full.tray.toLocaleString()}원 · ` +
              `씨앗 **지갑에서 ${g.price.radishSeed.toLocaleString()}원**(정가 400 × 1.4) · 재배판 ${g.price.tray.toLocaleString()}원`);
  console.log(`  ★ 손익분기 — 콩나물 ${(g.breakeven.siru * 100).toFixed(1)}% · ` +
              `무순 ${(g.breakeven.tray * 100).toFixed(1)}%`);
  console.log('     ⚠ 정가(500·400원)로 재면 16.7% · 20% 지만, **지갑에서 나가는 값은 상점 마진 ×1.4** 다.');
  console.log(`  하루 저감 상한 ${g.dailyCapWon.toLocaleString()}원 (끼니 상한 ${g.mealCapWon.toLocaleString()}원)`);
  console.log('  ★ 자리가 값을 바꾸나 — 품질별 한 회전분:');
  for (const q of g.byQuality)
    console.log(`      ${q.meals}끼  콩나물 ${q.siru.toLocaleString()}원 · 무순 ${q.tray.toLocaleString()}원` +
                (q.meals === 3 ? '   ← 제 자리' : ''));

  console.log('');
  console.log('── ㉣-0b ★시루 한 개를 더 들이면 하루에 얼마가 남나 (씨앗 실지출 뺀 값) ──');
  console.log(pad('시루가 서는 자리', 24) + pad('저감', 8) + pad('잉여', 8) +
              g.marginal[0].perDay.map(p => pad(`${(p.rate * 100).toFixed(0)}%`, 8)).join(''));
  for (const m of g.marginal)
    console.log(pad(m.ko, 24) + pad(m.saved.toLocaleString(), 8) + pad(m.surplus.toLocaleString(), 8) +
                m.perDay.map(p => pad((p.won >= 0 ? '+' : '') + p.won, 8)).join(''));
  console.log(`  ★ 시루 하나가 ${g.price.siru.toLocaleString()}원이다 — 위 값으로 나누면 회수일이 나온다.`);

  console.log('');
  console.log('── ㉣-1 판매 비율 × 재배 계획 → 파산일 (기준선 · 자금흐름 장부) ─────');
  console.log(pad('판매가(한 회전분 대비)', 24) + CROP_PLANS.map(p => pad(p.id, 13)).join(''));
  for (const r of g.grid)
    console.log(pad(`${(r.rate * 100).toFixed(1)}%`, 24) +
                r.plans.map(p => pad(p.bust == null ? '안 망함' : p.bust + '일', 13)).join(''));

  console.log('');
  console.log(`── ㉣-2 ★함정 — 용기를 언제 다 사나 · 회수는 되나 (${PLAN_MAIN} 목표) ──`);
  console.log(pad('판매가', 10) + pad('도달일', 10) + pad('실제 도달', 14) +
              pad('용기 투자', 12) + pad('회수일', 10) + pad('안정 순이익', 13) + '파산일');
  for (const r of g.grid) {
    const p = r.plans.find(x => x.id === PLAN_MAIN);
    console.log(pad(`${(r.rate * 100).toFixed(1)}%`, 10) + pad(D(p.reach), 10) +
                pad(`시루${p.siru}·판${p.tray}`, 14) + pad(p.invested.toLocaleString(), 12) +
                pad(D(p.payback), 10) + pad((p.steadyPerDay == null ? '—' : p.steadyPerDay.toLocaleString() + '원/일'), 13) +
                D(p.bust));
  }

  console.log('');
  console.log(`── ㉣-3 후보마다 ㉣ 를 켜면 (${PLAN_MAIN} 목표 · 노가다) ────────────────`);
  console.log(pad('후보', 30) + pad('A 이사일', 10) +
              pad('25% 파산', 10) + pad('25% 합격선', 13) +
              pad('50% 파산', 10) + pad('50% 합격선', 13) + '25% 순이익');
  const verdict = (bust, mv) => {
    if (mv == null) return '—';
    if (bust == null) return 'PASS ∞';
    const gap = bust - mv;
    return `${gap >= 0 ? 'PASS +' : 'FAIL '}${gap}일`;
  };
  for (const { c, m } of rows) {
    const p = m.gap4.main, p5 = m.gap4.main50, mv = m.A.medDay;
    console.log(pad(c.id + ' ' + c.ko, 30) + pad(D(mv), 10) +
                pad(p.bust == null ? '안 망함' : p.bust + '일', 10) + pad(verdict(p.bust, mv), 13) +
                pad(p5.bust == null ? '안 망함' : p5.bust + '일', 10) + pad(verdict(p5.bust, mv), 13) +
                (p.steadyPerDay == null ? '—' : p.steadyPerDay.toLocaleString() + '원/일'));
  }
}

console.log('');
console.log('── ⑤ 깨지는 검사 · test_balance_routes 줄별 판정 ────────────────────');
console.log(pad('후보', 30) + ROUTE_CHECKS.map(k => pad(k, 7)).join('') + '깨진 검사');
for (const { c, broken, routes } of rows)
  console.log(pad(c.id + ' ' + c.ko, 30) +
              ROUTE_CHECKS.map(k => pad(routes ? routes[k] : '—', 7)).join('') +
              (broken == null ? '(--quick)' : (broken.length ? broken.join(' ') : '없음')));

console.log('');
console.log('── ⑥ 대가 ──────────────────────────────────────────────────────────');
for (const { c } of rows) console.log('  ' + pad(c.id + ' ' + c.ko, 30) + c.cost);

if (!QUICK) {
  console.log('');
  console.log('── ⑦ 깨진 검사가 정확히 무엇을 말하나 ──────────────────────────────');
  for (const { c, detail } of rows) {
    if (!detail || !detail.length) continue;
    console.log(`  ${c.id} ${c.ko}`);
    for (const d of detail) console.log('      ' + d);
  }
}

console.log(`
★ 읽는 법 ──────────────────────────────────────────────────────────────────
  ① 의 파산일은 **벌이가 그 수준으로 계속 들어온다고 쳤을 때**의 값이다(박사님 가정).
     ④ 의 실측 파산일은 하네스가 **실제로 번 돈**으로 굴린 값이고, 둘은 크게 다르다 —
     그 차이 자체가 "지금 벌이가 가정만큼 안 나온다"는 뜻이다.
  ③ 이 합격선이다. FAIL 이면 그 일수만큼 **0원으로 보내는 날**이 생기고,
     0원이면 씨앗(콩 700·무 600원)도 못 사서 회전이 끊긴다 — 벌이가 0이 된다.
  ①-1(A≠B) 이 FAIL 인 후보는 **등이 아무것도 안 사는 판**이라 값이 얼마든 못 쓴다.
★ 고르는 것은 이 도구의 일이 아니다 — docs/handoff/econgap-to-plan.md 참고.`);
