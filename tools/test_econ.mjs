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
/* ⚠⚠ **2026-08-17 — 이 절이 지키던 약속이 뒤집혔다.**
     옛 약속 — *"판매가율의 **정본은 `characters.json._meta.cropSurplusSaleRate`(0.85)** 이고
       `FIRST_PLAY_RULES` 는 폴백이다. 둘이 같아야 한다."*
   박사님 확정문 §1 이 파는 값을 **작물마다** 정했다(콩나물 7원/g · 무순 8원/g).
   ⇒ 한 값으로는 못 적으므로 정본이 **작물 표**로 옮겨 갔고, `_meta` 칸은 **지웠다.**
     그 칸이 살아 있으면 `firstPlayRulesFromBalance` 가 그것을 먼저 읽어 작물 표를 덮어쓴다.
   ⇒ 이 절이 이제 지키는 것 셋: ① `_meta` 에 그 칸이 **없다** ② 전역값이 숫자를 안 갖고
     `CROP_KINDS[0]` 을 가리킨다 ③ 위끝(1.00)은 그대로다. */
check('B 판매가 — 정본은 작물 표다 (_meta 의 한 값이 아니다)', () => {
  assert.equal(CHARS._meta.cropSurplusSaleRate, undefined,
    '★characters.json 에 cropSurplusSaleRate 가 살아 있습니다 — 작물 표를 덮어씁니다(확정문 §1)');
  const fallback = CROP_KINDS[0].sellWonPerGram / 10;
  assert.equal(FIRST_PLAY_RULES.cropSurplusSaleRate, fallback,
    `전역 폴백(${FIRST_PLAY_RULES.cropSurplusSaleRate})이 콩나물 값(${fallback})과 갈렸습니다`);
  assert.equal(RULES.cropSurplusSaleRate, fallback,
    'firstPlayRulesFromBalance 가 폴백을 안 읽었습니다');
  for (const k of CROP_KINDS)
    assert.ok(k.sellWonPerGram / 10 <= 1,
      `★${k.ko} 파는 값이 물건 값(10원/g)을 넘습니다 — 뼈대가 뒤집힙니다`);
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
  /* ⚠ 2026-08-16 — 값(3,000)은 그대로인데 **뜻이 바뀌었다**: 「최상 품질」이 아니라
     「중간 품질(300g)」이다. 최상은 400g = 4,000원이다(§그램). */
  assert.equal(CROP_KINDS[0].savedWonPerCycle, 3_000, '콩나물 회전분(중간 품질 300g)');
  assert.equal(CROP_KINDS[0].gramsPerCycle, 300, '콩나물 기준 수확량(g)');
  assert.equal(CROP_KINDS[0].gramsPerQualityStep, 100, '품질 한 칸당 ±g');
  /* ══ ★★ 2026-08-17 박사님 확정문 §1 의 표 — **이것이 정본이다** ═══════════════
     ⚠ 여기 `CROP_KINDS[1].savedWonPerCycle` 에 **2,800** 이 박혀 있었다. 그 값은
       「질림(×2/3)이 붙기 전의 기본값」이었고 실제 곳간에 들던 것은 1,867원이었다.
       질림을 걷으면서(확정문 §6) 기본값이 곧 곳간 값이 되므로 확정문 표대로 2,000 이다. */
  assert.equal(CROP_KINDS[1].savedWonPerCycle, 2_000, '무순 회전분(중간 품질 200g)');
  assert.equal(CROP_KINDS[1].gramsPerCycle, 200, '무순 기준 수확량(g)');
  assert.equal(CROP_KINDS[1].harvestDays, 7, '무순 주기');
  assert.equal(CROP_KINDS[0].mealPortionGrams, 300, '콩나물 몫당 필요량');
  assert.equal(CROP_KINDS[1].mealPortionGrams, 200, '무순 몫당 필요량');
  assert.equal(CROP_KINDS[0].sellWonPerGram, 7, '콩나물 파는 값(원/g)');
  assert.equal(CROP_KINDS[1].sellWonPerGram, 8, '무순 파는 값(원/g)');
  assert.equal(RULES.cropMealPortionWon, 2_500, '첫 몫');
  assert.equal(RULES.cropSecondMealSameWon, 1_200, '둘째 몫(같은 작물)');
  assert.equal(RULES.cropMealCapWon, 5_000, '하루 최대');
  /* ★ 빛 경계 — 확정문 §1. 무순만 움직였다(콩나물은 0.3 · 1.0 그대로) */
  assert.equal(CROP_KINDS[1].quality[0].minDli, 0.35, '무순 최상 경계');
  assert.equal(CROP_KINDS[1].quality[1].minDli, 0.15, '무순 중간 경계');
  assert.equal(CROP_KINDS[0].quality[0].maxDli, 0.3, '콩나물 최상 경계');
  assert.equal(CROP_KINDS[0].quality[1].maxDli, 1.0, '콩나물 중간 경계');
});

/* ══ F · ★질림은 한 표인가 — 표를 가르고 나서도 그 사상이 사나 ═════════════
   2026-08-04 박사님 확정: *"둘을 다른 표로 만들면 안 된다. 줄어드는 이유가 같기
   때문이다 — 질림이다."* 가른 것은 「작물마다 다른 값」이지 질림이 아니다.

   ⚠⚠ **2026-08-17 — 이 절의 제목이 반쪽이 됐다.** 옛 제목은
     *"질림 배율은 한 표다 — **종류 체감과 겹침 체감**이 같은 눈금을 쓴다"* 였고,
     옛 단언은 `overlapSavedWon(RULES,3,i,0)`(그날 순번 i)이 배율표를 따르는지를 물었다.
   박사님이 **겹침 쪽만** 걷으셨다(first_play §겹침 2026-08-17):
     *"하루 수확량을 개수에 따라 조절하라는 게 아니었는데… 식량으로 사용할 수 있는
       G수를 조절하란 거지.. 최대 300G로."*
   ⇒ **표는 여전히 하나다. 다만 그 표를 읽는 축이 하나로 줄었다** — 작물 **종류**뿐이다.

   ══ ⚠⚠ 2026-08-17 **밤** — 그 하나마저 없어졌다 (확정문 §6) ════════════════════
   *"질림은 「둘째 몫」 규칙이 **대신한다.** 두 벌로 두지 마라."*
   ⇒ **작물 종류 축도 표를 안 읽는다.** 「같은 것만 먹으면 물린다」는 이제 **밥상에서**
     잰다(first_play §몫 — 같은 작물로 채운 둘째 몫은 2,500 이 아니라 1,200원).
   ⇒ 그래서 이 절이 이제 재는 것은 셋이다:
       ① 배율표 **자체**는 성한가 — `cropOverlapTiredEnabled` 문이 아직 읽는다
       ② 두 축(그날 순번 · 작물 종류)이 **표를 안 건드리나** — 이번에 새로 지키는 것
       ③ 문을 열면 옛 겹침 셈이 그대로 돌아오나 */
check('F ★질림 배율표는 살아 있다 — 그런데 그것을 읽는 축이 하나도 안 남았다', () => {
  assert.deepEqual([...CROP_TIRED_MULTIPLIER], [1, 2 / 3, 1 / 3, 0], '질림 배율표');
  /* ⚠⚠ 2026-08-16 — 여기 **3,000 / 2,000 / 1,000 / 0 이 박혀 있었다.** 그것이 이 줄이
     지키던 옛 약속이다. g 셈이 들어와 콩나물 최상 품질이 400g = 4,000원이 되면서
     **4,000 / 2,670 / 1,330 / 0** 이 됐다(first_play §그램).
     ★ 이 절이 진짜로 지키는 것은 숫자가 아니라 **배율이 한 표인가**다 ⇒ 배율로 잰다. */
  /* ⚠ **반올림은 g 에서 일어난다** — 400g × 2/3 = 266.67 → 267g → 2,670원이다.
     원에서 반올림하면 2,667원이 나오는데 그건 「0.7g 짜리 콩나물」이라 물건이 안 된다. */
  const beanG = [0, 1, 2, 3].map(t => cropCycleGrams(RULES, 3, t, 0));   // 종류 축
  assert.deepEqual(beanG, CROP_TIRED_MULTIPLIER.map(m => Math.round(beanG[0] * m)),
    `콩나물 질림이 ${beanG.join('/')}g 입니다 — 질림 배율표를 그대로 따라야 합니다`);
  assert.deepEqual([0, 1, 2, 3].map(t => cropCycleSavedWon(RULES, 3, t, 0)),
    beanG.map(g => g * 10), '★원과 g 이 10배로 안 맞물린다');
  /* ★★ ② 그날 순번(겹침)은 이제 **표를 안 건드린다** — 넷이 다 온전한 값이다 */
  const onDay = [0, 1, 2, 3].map(i => overlapSavedWon(RULES, 3, i, 0));
  assert.deepEqual(onDay, new Array(4).fill(onDay[0]),
    `★그날 순번이 아직 값을 깎습니다(${onDay.join('/')}원) — 겹침의 벌이 안 걷혔습니다`);
  /* ★ 그런데 **문을 열면 옛 셈이 그대로 돌아온다** — 계통이 지워진 게 아님을 여기서 잰다 */
  const PEN = Object.freeze({ ...RULES, cropOverlapTiredEnabled: true });
  assert.deepEqual([0, 1, 2, 3].map(i => overlapSavedWon(PEN, 3, i, 0)), beanG.map(g => g * 10),
    '★문(cropOverlapTiredEnabled)을 열었는데 옛 겹침 셈이 안 돌아온다');
  /* ★★ ② 작물 **종류** 축도 표를 안 건드린다 (2026-08-17 밤 · 확정문 §6).
     ⚠ 이 자리에 *"무순은 2종째라 한 칸 밀려 시작한다 — 2,800 × 2/3 = **1,867**"* 이
       박혀 있었다. 그것이 이 줄이 지키던 옛 약속이다. 이제 무순은 자기 표대로 난다. */
  assert.equal(overlapSavedWon(RULES, 3, 0, 1), cropCycleGrams(RULES, 3, 0, 1) * 10,
    '★무순이 아직 종류 순번만큼 깎입니다 — 질림이 어디선가 다시 물립니다');
  assert.equal(cropCycleGrams(RULES, 3, 0, 1), 300, '무순 최상 품질 300g (확정문 §1)');
  /* 넷째부터 0 — 표 밖은 지어내지 않는다 (문을 열었을 때의 이야기다) */
  assert.equal(cropCycleSavedWon(RULES, 3, 9, 0), 0, '표 밖 순번');
});

/* ══ G · ★무순만 내려갔는가 — 콩나물 표가 안 딸려 갔는가 ═══════════════════
   이 일의 요구가 정확히 이것이었다. `cropKindSavedWon[1]` 을 2,800 으로 바꾸면
   **콩나물 둘째**까지 2,800 이 된다(그 칸이 겹침에도 쓰였다). 그래서 표를 갈랐다.
   ⚠⚠ 2026-08-17 — 옛 제목은 *"콩나물 **겹침 벌**은 그대로다"* 였고, 그것을
     `overlapSavedWon(RULES, 3, 1, 0)`(콩나물 **그날 둘째**)로 재고 있었다.
     겹침의 벌이 걷혔으므로 그 자리는 **작물 종류 축**(`cropCycleSavedWon(…, 1, 0)`)으로
     옮긴다 — 지키려던 것(「콩나물 칸에 무순 값이 새어 들지 않는다」)은 그대로다. */
check('G ★두 작물의 값이 서로 안 샌다 — 각자 자기 표대로 난다', () => {
  assert.equal(cropBaseSavedWonOf(RULES, 0), 3_000, '콩나물 기본값');
  /* ⚠⚠ 2026-08-17 — 여기 **2,800** 이 박혀 있었다(질림이 붙기 전의 기본값).
     확정문 §1 이 무순 중간 품질을 200g 으로 정했으므로 2,000 이다. */
  assert.equal(cropBaseSavedWonOf(RULES, 1), 2_000, '무순 기본값');
  /* ⚠ 2026-08-16 — 품질 배수가 **끼니/3 에서 「중간빛 300g ±100g」으로 바뀌었다**(§그램).
     2끼(살짝 초록)는 300g = 3,000원이다 — 예전 2,000원이 아니다. */
  assert.equal(overlapSavedWon(RULES, 2, 0, 0), 3_000, '콩나물 · 2끼 품질 = 300g');
  assert.equal(overlapSavedWon(RULES, 3, 0, 0), 4_000, '콩나물 · 3끼 품질 = 400g');
  assert.equal(overlapSavedWon(RULES, 1, 0, 0), 2_000, '콩나물 · 1끼 품질 = 200g');
  /* ★ 무순 — 확정문 §1 의 300 / 200 / 100g.
     ⚠⚠ 옛 줄은 *"무순은 2종째라 **질림 순번이 1에서 시작한다.** 그날 첫 무순도 이미 ×2/3 다"*
       라고 적고 1,867 · 622 를 못 박고 있었다. 그 밀림이 이번에 없어졌다(확정문 §6). */
  assert.equal(overlapSavedWon(RULES, 3, 0, 1), 3_000, '무순 · 3끼 품질 = 300g');
  assert.equal(overlapSavedWon(RULES, 2, 0, 1), 2_000, '무순 · 2끼 품질 = 200g');
  assert.equal(overlapSavedWon(RULES, 1, 0, 1), 1_000, '무순 · 1끼 품질 = 100g');
  /* ★ 그리고 **한쪽을 고쳐도 다른 쪽이 안 따라 움직이는지**를 여기서 잰다 —
     이 절이 원래 지키던 그것이다. 무순 표를 갈아 끼운 사본에서 콩나물이 안 움직여야 한다. */
  const swapped = Object.freeze({ ...RULES, cropKindDefs: Object.freeze(
    RULES.cropKindDefs.map((d, i) => i === 1 ? Object.freeze({ ...d, gramsPerCycle: 999 }) : d)) });
  assert.equal(cropCycleGrams(swapped, 3, 0, 0), cropCycleGrams(RULES, 3, 0, 0),
    '★무순 표를 고쳤는데 콩나물이 같이 움직였습니다 — 표가 아직 하나입니다');
  assert.notEqual(cropCycleGrams(swapped, 3, 0, 1), cropCycleGrams(RULES, 3, 0, 1),
    '★무순 표를 고쳤는데 무순이 안 움직였습니다 — 표를 안 읽고 있습니다');
});

/* ══ H · 하루 몫 — **300g** 인가 (2026-08-16 박사님 확정) ══════════════════
   ⚠⚠ **이 절이 지키던 옛 약속이 바뀌었다.** 예전 제목은 「하루 저감 상한 =
     min(도는 작물의 한 회전 합, 끼니 상한)」이었고 값은 **4,867원**이었다.
     박사님: *"400G 가 오면 300G 까지는 당일 쓸 수 있는 거고 남는 거 팔아먹든 하는 거"*
     ⇒ 하루 몫은 **작물을 통틀어 300g(3,000원)** 이고, 회전분 합계를 안 본다.
     ⇒ 대신 **남는 것이 안 버려지고 곳간에 쌓인다**(곳간 한도를 걷었다). */
/* ══ ⚠⚠ 2026-08-17 밤 — **이 절이 지키던 약속이 또 바뀌었다** ════════════════════
     08-15 까지 — 「하루 저감 상한 = min(회전분 합, 끼니 상한)」 = **4,867원**
     08-16     — 「작물 통틀어 **300g**(3,000원)」
     08-17 밤  — ★ **「몫」이다** (확정문 §1). 하루에 몫 둘까지 · 첫 몫 2,500 ·
                 둘째 몫은 다른 작물이면 2,500 · 같은 작물이면 1,200 · 하루 최대 5,000.
   ⇒ `dailyCropSaveWon` 의 **단위가 바뀌었다** — 곳간에서 빠지는 물건 값이 아니라
     **아낄 수 있는 밥값**이다. 그래서 이제 `cropMealCapWon` 과 같은 수다. */
check('H 하루 몫 = 「몫」이다 (확정문 §1) · 하루 최대는 끼니 상한 그대로', () => {
  const mealCap = CHARS._meta.cropMealCapPerPerson *
                  (CHARS._meta.dailyFoodPerPerson / CHARS._meta.mealsPerDayPerPerson);
  const perCycle = 3_000 + 2_000;                    // 콩나물 + 무순 (둘 다 중간 품질)
  assert.equal(RULES.cropSavedWonPerCycle, perCycle,
    `한 회전 합계가 ${RULES.cropSavedWonPerCycle} 입니다 — ${perCycle} 이어야 합니다`);
  assert.equal(RULES.dailyCropGrams, CROP_KINDS[0].mealPortionGrams, '콩나물 한 몫(g)');
  /* ★★ **새 상한을 안 만들었다** — 하루 최대 5,000원은 끼니 상한 그 값이다 */
  assert.equal(RULES.dailyCropSaveWon, mealCap, '하루 최대가 끼니 상한과 다릅니다');
  assert.equal(RULES.cropMealPortions, 2, '하루에 채울 수 있는 몫 수');
  assert.equal(RULES.cropMealPortions * RULES.cropMealPortionWon, RULES.cropMealCapWon,
    '★몫 수 × 첫 몫이 하루 최대와 안 맞습니다 — 상한이 두 벌이 됐습니다');
  assert.equal(RULES.cropCapBinding, false,
    '★끼니 상한이 둘째 몫을 막고 있습니다 — 자취생은 2끼라 두 몫이 서야 합니다');
  /* ★★ **곳간은 이제 안 넘친다** — 쌓아 두었다가 팔 수 있어야 하기 때문이다 */
  assert.equal(pantryCapWon({ rules: RULES }), Infinity,
    '★곳간에 한도가 남아 있습니다 — 남는 것이 쉬어서 버려집니다');
});

/* ══ I · ★★★ 위끝·아래끝 — **확정문 §3 이 게임의 뼈대다** ══════════════════════
   확정문 §3: *"위끝·아래끝을 지키는 것이 이 표의 전부다."*
     **위끝** — 첫 몫은 **파는 값보다 비싸다** (안 그러면 「먹느니 판다」가 되어 뼈대가 뒤집힌다)
     **아래끝** — 둘째 몫(같은 작물)은 **파는 값보다 싸다** (안 그러면 남는 것을 팔 이유가 없다)
   ⚠ 이 절은 **작물마다** 잰다. 값이 작물마다 갈렸으므로 한 작물만 재면 다른 쪽이 조용히
     뒤집혀도 안 잡힌다. 지시서가 「검사로 못 박아라」라고 지목한 자리다. */
check('I ★★위끝·아래끝 — 첫 몫은 파는 값보다 비싸고, 같은 작물 둘째 몫은 싸다', () => {
  for (let i = 0; i < CROP_KINDS.length; i++) {
    const k = CROP_KINDS[i];
    const first = RULES.cropMealPortionWon / k.mealPortionGrams;      // 첫 몫의 원/g
    const second = RULES.cropSecondMealSameWon / k.mealPortionGrams;  // 둘째(같은 것)의 원/g
    const sell = k.sellWonPerGram;
    assert.ok(first > sell,
      `★위끝이 깨졌습니다 — ${k.ko} 첫 몫 ${first.toFixed(2)}원/g 이 파는 값 ${sell}원/g 보다 싸다`);
    assert.ok(second < sell,
      `★아래끝이 깨졌습니다 — ${k.ko} 둘째 몫 ${second.toFixed(2)}원/g 이 파는 값 ${sell}원/g 보다 비싸다`);
  }
  /* ★ 확정문 §2 의 본전선 1.40 — 무순 밥 효율이 콩나물의 1.40배**보다는** 커야
     「7일이나 걸리는」 무순을 심을 이유가 생긴다(밝은 칸 하나를 두고 다투므로). */
  const eff = i => RULES.cropMealPortionWon / CROP_KINDS[i].mealPortionGrams;
  const ratio = eff(1) / eff(0);
  assert.ok(ratio > 1.40,
    `★무순 밥 효율이 콩나물의 ${ratio.toFixed(2)}배입니다 — 본전선(1.40)을 넘어야 심을 이유가 있습니다`);
  assert.ok(ratio < 2.0,
    `★무순이 콩나물의 ${ratio.toFixed(2)}배입니다 — 너무 세면 「무순만 심으면 됨」이 됩니다`);
});

console.log(fail ? `\n✕ ${fail}개 실패` : '\n✓ 전부 통과');
process.exit(fail ? 1 : 0);
