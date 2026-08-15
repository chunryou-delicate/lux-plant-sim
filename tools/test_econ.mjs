/* ★ 살림값 — 정본이 한 벌인가 (2026-08-09 신설)
 *
 *   node tools/test_econ.mjs
 *
 * ══ 왜 이 검사가 생겼나 ═══════════════════════════════════════════════════
 * `tutorial.js` 와 `first_play.js` 주석이 넉 달째 *"tools/test_econ.mjs 가 그 등식을
 * 고정한다"* 라고 적고 있었는데 **그 파일이 없었다.** 지키는 사람이 없는 약속이었다.
 *
 * 이 저장소가 오늘 하루에만 정본이 두 벌인 자리에서 **네 번** 데였다
 * (와트 · 씨앗값 · 월세 · 빛 옵션). 갈리는 방식은 늘 같다 —
 * 값을 두 곳에 적고 "늘 같은 값이어야 한다"는 **주석으로만** 지킨다.
 *
 * ⇒ 그래서 여기서는 값이 맞는지가 아니라 **두 곳이 같은지**를 본다.
 *   골든값(§E)은 박사님 확정값이라 바뀌면 바뀐 이유를 적고 같이 고치는 자리다.
 *
 * ══ 무엇을 켜고 무엇을 껐나 ═══════════════════════════════════════════════
 * 브라우저를 안 띄운다. 순수 모듈만 읽으므로 서버가 없어도 돈다.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import { TUTORIAL_RULES, banjihaRulesFrom } from '../src/game/tutorial.js';
import { CROP_KINDS, CROP_TIRED_MULTIPLIER, FIRST_PLAY_RULES, firstPlayRulesFromBalance,
         cropCycleSavedWon, cropBaseSavedWonOf, overlapSavedWon,
         /* ★ 2026-08-16 · 그램 셈 (first_play §그램) */
         cropCycleGrams, pantryCapWon } from '../src/game/first_play.js';
import { CATALOG, buyPriceOf, BUY_MARKUP } from '../src/game/shop.js';

const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const HOMES = J('../data/balance/homes.json');
const CHARS = J('../data/balance/characters.json');

let fail = 0;
const check = (name, fn) => {
  try { fn(); console.log('PASS  ' + name); }
  catch (e) { fail++; console.log('FAIL  ' + name + '\n      → ' + e.message); }
};

const BANJIHA = HOMES.homes.find(h => h.id === 'banjiha');
const RULES   = firstPlayRulesFromBalance(CHARS);

/* ══ A · ★하루 지출은 지어낸 값이 아니라 **유도된 값**인가 ═══════════════════
   `dailySpendWon = 월세/주기 + 공과/주기 + 식비`. 월세를 내리면 **따라와야** 한다 —
   2026-08-05 에 월세만 내렸더니 하루치에서 빼는 몫도 같이 줄어 총액이 그대로였고,
   파산일이 81일에서 하루도 안 움직였다. 그 사고를 여기서 막는다. */
check('A ★하루 지출 = 월세/주기 + 공과/주기 + 식비 (월세를 내리면 따라 내려간다)', () => {
  const period = TUTORIAL_RULES.rentPeriodDays;
  const food = CHARS._meta.dailyFoodPerPerson;
  const want = Math.round(BANJIHA.rent / period + BANJIHA.utility / period + food);
  assert.equal(TUTORIAL_RULES.rentWon, BANJIHA.rent,
    `월세 폴백(${TUTORIAL_RULES.rentWon})이 정본 homes.json banjiha.rent(${BANJIHA.rent})와 갈렸습니다`);
  assert.equal(TUTORIAL_RULES.dailySpendWon, want,
    `하루 지출 폴백(${TUTORIAL_RULES.dailySpendWon})이 유도값(${want})과 갈렸습니다 — ` +
    `월세만 고치고 이 값을 안 고치면 총액이 안 움직입니다`);
  /* 읽어 꽂는 길도 같은 값을 내야 한다 — 폴백만 맞고 유도가 틀리면 판마다 다른 살림이 된다 */
  const R = banjihaRulesFrom(HOMES, { dailyFoodWon: food });
  assert.equal(R.rentWon, BANJIHA.rent, 'banjihaRulesFrom 이 월세를 안 꽂았습니다');
  assert.equal(R.dailySpendWon, want, 'banjihaRulesFrom 의 하루 지출이 유도값과 다릅니다');
});

/* ══ B · 잉여 판매가율 — 정본(JSON)과 폴백(코드)이 같은가 ═══════════════════ */
check('B 잉여 판매가율 — characters.json 정본 = first_play 폴백', () => {
  const meta = CHARS._meta.cropSurplusSaleRate;
  assert.equal(FIRST_PLAY_RULES.cropSurplusSaleRate, meta,
    `폴백(${FIRST_PLAY_RULES.cropSurplusSaleRate})이 정본(${meta})과 갈렸습니다`);
  assert.equal(RULES.cropSurplusSaleRate, meta, 'firstPlayRulesFromBalance 가 정본을 안 읽었습니다');
  assert.ok(meta <= 1, '★1.00 을 넘기면 「밥보다 파는 게 낫다」가 되어 뼈대가 뒤집힙니다');
});

/* ══ C · ★씨앗값 정본이 한 벌인가 — 이게 넉 달째 갈려 있던 그 자리다 ═══════
   `shop.CATALOG.*.listWon` 이 `CROP_KINDS[i].seedWonPerPot` 을 **읽는다**(2026-08-09).
   숫자를 두 곳에 적던 것을 가리키기로 바꿨으므로 이 검사는 그 배선을 지킨다. */
check('C ★씨앗값 — 상점 정가가 작물 표를 그대로 읽는다 (정본 한 벌)', () => {
  for (const k of CROP_KINDS) {
    assert.equal(CATALOG[k.seedItemId].listWon, k.seedWonPerPot,
      `${k.ko} 씨앗값이 갈렸습니다 — 상점 ${CATALOG[k.seedItemId].listWon} vs 작물표 ${k.seedWonPerPot}`);
  }
  /* 옛 이름도 같은 곳을 가리켜야 한다 — 화면이 이걸 읽는다 */
  assert.equal(FIRST_PLAY_RULES.seedWonPerSiru, CROP_KINDS[0].seedWonPerPot,
    'seedWonPerSiru 가 콩나물 씨앗값과 갈렸습니다');
});

/* ══ D · ★정가와 실구매가를 헷갈리지 않는가 ═══════════════════════════════
   박사님이 정하신 것은 **실구매가**다. 정가에 그 숫자를 그대로 적으면 실구매가
   1.4배로 서서 아무것도 안 바뀐다 — 이 검사가 그 착각을 잡는다. */
check('D ★실구매가 (정가 × 1.4 · 100원 올림) — 박사님 확정값', () => {
  assert.equal(BUY_MARKUP, 1.4, '상점 마진이 바뀌었습니다 — 아래 실구매가가 전부 움직입니다');
  assert.equal(buyPriceOf('bean_seed'), 500,
    `콩 씨앗 실구매가가 ${buyPriceOf('bean_seed')}원입니다 — 500원이어야 합니다(정가 350)`);
  assert.equal(buyPriceOf('siru'), 5_000,
    `시루 실구매가가 ${buyPriceOf('siru')}원입니다 — 5,000원이어야 합니다(정가 3,550)`);
});

/* ══ E · 박사님 확정 골든값 ════════════════════════════════════════════════
   ⚠ 여기가 움직이면 **왜 그만큼 움직였는지 적고** 고치는 자리다. 설명이 없으면
     딴 게 같이 바뀐 것이다(docs/handoff/plan-2026-08-09-decisions.md §7). */
check('E 확정 골든값 — 시작돈 · 월세 · 회전분 · 판매가율', () => {
  assert.equal(TUTORIAL_RULES.startCashWon, 1_500_000, '시작돈');
  assert.equal(BANJIHA.rent, 200_000, '반지하 월세');
  assert.equal(TUTORIAL_RULES.dailySpendWon, 16_667, '하루 지출');
  assert.equal(CHARS._meta.cropSurplusSaleRate, 0.85, '잉여 판매가율');
  /* ⚠ 2026-08-16 — 값(3,000)은 그대로인데 **뜻이 바뀌었다**: 「최상 품질」이 아니라
     「중간 품질(300g)」이다. 최상은 400g = 4,000원이다(§그램). */
  assert.equal(CROP_KINDS[0].savedWonPerCycle, 3_000, '콩나물 회전분(중간 품질 300g)');
  assert.equal(CROP_KINDS[0].gramsPerCycle, 300, '콩나물 기준 수확량(g)');
  assert.equal(CROP_KINDS[0].gramsPerQualityStep, 100, '품질 한 칸당 ±g');
  assert.equal(CROP_KINDS[1].savedWonPerCycle, 2_800, '무순 회전분');
});

/* ══ F · ★질림은 한 표인가 — 표를 가르고 나서도 그 사상이 사나 ═════════════
   2026-08-04 박사님 확정: *"둘을 다른 표로 만들면 안 된다. 줄어드는 이유가 같기
   때문이다 — 질림이다."* 가른 것은 「작물마다 다른 값」이지 질림이 아니다. */
check('F ★질림 배율은 한 표다 — 종류 체감과 겹침 체감이 같은 눈금을 쓴다', () => {
  assert.deepEqual([...CROP_TIRED_MULTIPLIER], [1, 2 / 3, 1 / 3, 0], '질림 배율표');
  /* ⚠⚠ 2026-08-16 — 여기 **3,000 / 2,000 / 1,000 / 0 이 박혀 있었다.** 그것이 이 줄이
     지키던 옛 약속이다. g 셈이 들어와 콩나물 최상 품질이 400g = 4,000원이 되면서
     **4,000 / 2,670 / 1,330 / 0** 이 됐다(first_play §그램).
     ★ 이 절이 진짜로 지키는 것은 숫자가 아니라 **배율이 한 표인가**다 ⇒ 배율로 잰다. */
  const bean = [0, 1, 2, 3].map(i => overlapSavedWon(RULES, 3, i, 0));
  /* ⚠ **반올림은 g 에서 일어난다** — 400g × 2/3 = 266.67 → 267g → 2,670원이다.
     원에서 반올림하면 2,667원이 나오는데 그건 「0.7g 짜리 콩나물」이라 물건이 안 된다. */
  const beanG = [0, 1, 2, 3].map(i => cropCycleGrams(RULES, 3, i, 0));
  assert.deepEqual(beanG, CROP_TIRED_MULTIPLIER.map(m => Math.round(beanG[0] * m)),
    `콩나물 겹침이 ${beanG.join('/')}g 입니다 — 질림 배율표를 그대로 따라야 합니다`);
  assert.deepEqual(bean, beanG.map(g => g * 10), '★원과 g 이 10배로 안 맞물린다');
  /* 무순은 2종째라 한 칸 밀려 시작한다 — 2,800 × 2/3 = 1,867 */
  assert.equal(cropCycleSavedWon(RULES, 3, 1, 1), 1_867, '무순 한 회전(2종째)');
  /* 넷째부터 0 — 표 밖은 지어내지 않는다 */
  assert.equal(cropCycleSavedWon(RULES, 3, 9, 0), 0, '표 밖 순번');
});

/* ══ G · ★무순만 내려갔는가 — 겹침 벌이 같이 약해지지 않았는가 ═════════════
   이 일의 요구가 정확히 이것이었다. `cropKindSavedWon[1]` 을 2,800 으로 바꾸면
   **콩나물 둘째**까지 2,800 이 된다(그 칸이 겹침에도 쓰였다). 그래서 표를 갈랐다. */
check('G ★무순 회전분만 움직였다 — 콩나물 겹침 벌은 그대로다', () => {
  assert.equal(cropBaseSavedWonOf(RULES, 0), 3_000, '콩나물 기본값');
  assert.equal(cropBaseSavedWonOf(RULES, 1), 2_800, '무순 기본값');
  /* 콩나물 둘째는 「콩나물 기본값 × 2/3」이지 「무순 기본값」이 아니다 */
  /* ⚠ 2026-08-16 — 「콩나물 둘째 = 2,000원」이 박혀 있었다. 이제 4,000 × 2/3 = 2,670원이다.
     지킬 것은 「**콩나물** 기본값에 질림이 걸리는가」이지 그 수가 아니다. */
  assert.equal(overlapSavedWon(RULES, 3, 1, 0),
    Math.round(cropCycleGrams(RULES, 3, 0, 0) * (2 / 3)) * 10,
    '콩나물 둘째가 무순 값을 받고 있습니다 — 표가 아직 하나입니다');
  /* ⚠ 2026-08-16 — 품질 배수가 **끼니/3 에서 「중간빛 300g ±100g」으로 바뀌었다**(§그램).
     2끼(살짝 초록)는 300g = 3,000원이다 — 예전 2,000원이 아니다. */
  assert.equal(overlapSavedWon(RULES, 2, 0, 0), 3_000, '콩나물 첫째 · 2끼 품질 = 300g');
  assert.equal(overlapSavedWon(RULES, 3, 0, 0), 4_000, '콩나물 첫째 · 3끼 품질 = 400g');
  assert.equal(overlapSavedWon(RULES, 1, 0, 0), 2_000, '콩나물 첫째 · 1끼 품질 = 200g');
  /* ★ 무순은 2종째라 **질림 순번이 1에서 시작한다.** 그날 첫 무순도 이미 ×2/3 다 —
     「그날 첫째」와 「질림 순번 0」은 다른 말이다. 여기 헷갈리면 표를 잘못 읽는다. */
  assert.equal(overlapSavedWon(RULES, 3, 0, 1), 1_867, '무순 그날 첫째 · 3끼 = 2,800 × 2/3');
  assert.equal(overlapSavedWon(RULES, 1, 0, 1), Math.round(2_800 * (2 / 3) / 3),
    '무순 그날 첫째 · 1끼 품질 = 2,800 × 2/3 × 1/3');
});

/* ══ H · 하루 몫 — **300g** 인가 (2026-08-16 박사님 확정) ══════════════════
   ⚠⚠ **이 절이 지키던 옛 약속이 바뀌었다.** 예전 제목은 「하루 저감 상한 =
     min(도는 작물의 한 회전 합, 끼니 상한)」이었고 값은 **4,867원**이었다.
     박사님: *"400G 가 오면 300G 까지는 당일 쓸 수 있는 거고 남는 거 팔아먹든 하는 거"*
     ⇒ 하루 몫은 **작물을 통틀어 300g(3,000원)** 이고, 회전분 합계를 안 본다.
     ⇒ 대신 **남는 것이 안 버려지고 곳간에 쌓인다**(곳간 한도를 걷었다). */
check('H 하루 몫 = 300g (작물 통틀어) · 끼니 상한 아래', () => {
  const mealCap = CHARS._meta.cropMealCapPerPerson *
                  (CHARS._meta.dailyFoodPerPerson / CHARS._meta.mealsPerDayPerPerson);
  const perCycle = 3_000 + 1_867;                    // 콩나물(중간 품질) + 무순(2종째)
  assert.equal(RULES.cropSavedWonPerCycle, perCycle,
    `한 회전 합계가 ${RULES.cropSavedWonPerCycle} 입니다 — ${perCycle} 이어야 합니다`);
  assert.equal(RULES.dailyCropGrams, 300, '하루 몫(g)');
  assert.equal(RULES.dailyCropSaveWon, Math.min(300 * 10, mealCap), '하루 몫(원)');
  assert.equal(RULES.dailyCropSaveWon, 3_000, '하루 몫이 3,000원이 아니다');
  assert.equal(RULES.cropCapBinding, false,
    '★끼니 상한이 이기고 있습니다 — 300g(3,000원)은 상한 5,000원 아래라야 합니다');
  /* ★★ **곳간은 이제 안 넘친다** — 쌓아 두었다가 팔 수 있어야 하기 때문이다 */
  assert.equal(pantryCapWon({ rules: RULES }), Infinity,
    '★곳간에 한도가 남아 있습니다 — 남는 것이 쉬어서 버려집니다');
});

console.log(fail ? `\n✕ ${fail}개 실패` : '\n✓ 전부 통과');
process.exit(fail ? 1 : 0);
