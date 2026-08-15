/* ============================================================
   tools/test_cropsale.mjs — 잉여 채소를 판다 (2026-08-06 신설)
   ------------------------------------------------------------
   박사님 확정(2026-08-05): *"잉여 채소를 팔 수 있게 해서 오래 노가다하면 일단 마칠 수는 있게.
   씨앗 비용보다는 살짝 이득이게."*

   이 검사가 못 박는 것은 셋이다.

     ① ★**끼니로 쓸 수 있는 것은 안 팔린다.** 곳간(pantryWon)에 들어간 몫은 밥이고,
        팔리는 것은 곳간이 **못 받은 몫**(겹쳐서 못 받은 것 + 넘쳐서 쉰 것)뿐이다.
        이게 무너지면 「식물로 밥값을 아낀다」가 「식물을 판다」로 바뀐다.
     ② ★**판매가를 바꾸면 결과가 따라 움직인다.** 값이 코드에 박혀 있으면 안 움직인다.
     ③ ★**손익분기 아래에서는 손해다.** 콩나물 16.7% · 무순 32.1% (2026-08-09 갱신) —
        지갑에서 나가는 씨앗값(정가 × 1.4 · 100원 올림)으로 셈한 값이다. 정가로 셈하면
        11.7%가 나오는데 그건 틀린 값이고, econgap 이 실제로 한 번 그렇게 틀렸다.
        ⚠ 두 작물이 **반대로 움직였다**: 콩나물은 씨앗이 싸져서(700 → 500원) 내려갔고,
          무순은 회전분이 내려가서(2,000 → 1,867원) 올라갔다.

   ⚠ 이 검사는 숫자를 하나도 안 지어낸다. 씨앗값은 `shop.buyPriceOf`, 한 회전분은
     `first_play.cropCycleSavedWon`, 손익분기는 `shop.cropBreakEvenRate` 에서 읽는다.

   ══ ⚠⚠⚠ 2026-08-17 — **이 파일이 재던 물건이 게임에서 사라졌다** ═══════════════
   박사님이 겹침의 벌을 걷으셨다(first_play §겹침 2026-08-17):
     *"하루 수확량을 개수에 따라 조절하라는 게 아니었는데… 식량으로 사용할 수 있는
       G수를 조절하란 거지.. 최대 300G로."*
   ⇒ `overlapLostWon` 이 0 이 되고, `spoiledWon` 은 2026-08-16 에 이미 0 이 됐다.
     **둘을 더한 것이 잉여**이므로 **잉여가 늘 0** 이다. 「팔 잉여」가 아예 안 생긴다.

   ★ 그래서 이 파일을 **둘로 갈랐다.** 지우지 않은 까닭은 §K 에 적었다.
     ① **§K(신설)** — 게임이 실제로 도는 규칙에서 **잉여가 0** 임을 못 박는다. ★ 이게 새 약속이다
     ② **§D~I** — 잉여를 만드는 계통(값·손익분기·지갑·누적)은 **문을 열고** 잰다:
        `rules.cropOverlapTiredEnabled = true` (first_play §겹침 이 남긴 문).
        ⚠ 이 절들이 재는 것은 이제 **「게임에서 이런 일이 난다」가 아니라
          「그 계통이 아직 성하다」**다. 뜻이 바뀌었으므로 각 절 머리에 적어 두었다.
     ⇒ ★ 문이 없었다면 이 절들은 **지울 수밖에** 없었고, 되살릴 때 아무 근거도 안 남았다.
============================================================ */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FIRST_PLAY_RULES, firstPlayRulesFromBalance, createFirstPlayState,
  placeBeansprout, waterBeansprout, advanceBeansproutDay, harvestBeansprout,
  makeCropPot, eatFromPantry, pantryCapWon, dailyCropSaveWonOf,
  cropCycleSavedWon, cropSurplusQuote, cropSurplusRateOf, takeCropSurplus,
  /* ★ 2026-08-17 · §K — 「잉여가 0 이 됐어도 **곳간에서 파는 길**은 살아 있다」를 잰다 */
  pantrySaleQuote
} from '../src/game/first_play.js';
import { newState, sellCropSurplus, cropSurplusStatus } from '../src/game/state.js';
import { buyPriceOf, cropBreakEvenRate, shopStatus } from '../src/game/shop.js';

const BALANCE = JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8'));
/* 판매가만 갈아 끼운 계약을 만든다 — 저장소 파일은 한 글자도 안 고친다 */
const rulesAt = (rate) => firstPlayRulesFromBalance(
  rate == null ? BALANCE : { ...BALANCE, _meta: { ...BALANCE._meta, cropSurplusSaleRate: rate } });
const RULES = rulesAt(null);
/* ★★ 2026-08-17 — **겹침의 벌을 되살린 사본**(first_play §겹침 이 남긴 문).
   §D~I 가 「잉여를 만드는 계통이 아직 성한가」를 재려면 잉여가 나는 판이 필요하다.
   ⚠ **게임은 이 문을 안 연다.** 게임 규칙(문 닫힘)에서 무슨 일이 나는지는 §K 가 잰다. */
const penalty = (rules) => Object.freeze({ ...rules, cropOverlapTiredEnabled: true });
const PEN = penalty(RULES);
const penAt = (rate) => penalty(rulesAt(rate));
const CYCLE = RULES.harvestDays;
/* ★★ 2026-08-16 — 이 파일에 3,000 / 2,000 / 1,000 / 6,000 이 박혀 있었다. 그것이
   이 검사가 지키던 옛 약속이다: 「콩나물 최상 품질 한 회전 = 3,000원 · 끼니에 비례」.
   g 셈이 들어와 400 / 300 / 200g = 4,000 / 3,000 / 2,000원이 됐다(first_play §그램).
   ⇒ **숫자를 다시 박지 않는다. 규칙에서 읽는다.** 값이 또 바뀌어도 이 파일은 안 낡는다. */
const W = (t = 0) => cropCycleSavedWon(RULES, 3, t, 0);   // 질림 순번 t 로 거둘 때
const W0 = W(0);                                          // 온전한 한 회전분
/* ⚠ 2026-08-17 — 아래 셋은 **문을 연 판**(PEN)의 값이다. 게임에서는 넷 다 W0 이고
   `LOST4` 는 0 이다(§K). 이름은 그대로 두되 뜻이 갈렸으므로 여기 적어 둔다. */
const OVER4 = [0, 1, 2, 3].map(W);                        // 같은 날 넷을 거두면(문 열림)
const SUM4 = OVER4.reduce((a, v) => a + v, 0);            // 그중 곳간에 든 몫
const LOST4 = 4 * W0 - SUM4;                              // 겹쳐서 못 받은 몫
const DARK = 0.2;                       // 콩나물 최상 품질(하얗고 아삭 3끼)이 나오는 빛

let n = 0;
const ok = (name) => { n++; console.log(`  ✓ ${name}`); };

/* 시루 n개를 **같은 날** 돌려 한 번에 거둔다 — 겹침이 물려 잉여가 생기는 판이다.
   반환은 수확 결과와 그 fp. */
function sameDayHarvest(pots, rules = RULES) {
  const fp = createFirstPlayState({ enabled: true, rules });
  /* ★★ 2026-08-09 — **놓는 것이 먼저가 아니라 나중**이다(first_play §자리는 시루마다 따로다).
     자리가 시루마다 생기면서 「안 놓인 시루는 안 자란다」가 규칙이 됐다. 손으로 만든 시루는
     자리가 null 이라, 예전 순서(놓고 → 만들기)로는 둘째부터 물도 안 받고 자라지도 않는다.
     ⇒ 다 만든 뒤에 한 번 놓는다. `placeBeansprout` 은 `potId` 를 안 주면 **그 자리의 시루
       전부**를 옮기므로 넷이 한 자리에 선다 — 예전 판이 실제로 그랬던 그 모양이다. */
  for (let i = 2; i <= pots; i++) fp.beansprout.pots.push(makeCropPot('crop_01_0' + i));
  placeBeansprout(fp, 'dark-slot');
  waterBeansprout(fp, 0, { all: true });
  for (let d = 1; d <= CYCLE; d++) advanceBeansproutDay(fp, DARK);
  const h = harvestBeansprout(fp, { day: CYCLE });
  return { fp, h };
}

console.log('\n== A. 값이 어디 있나 — 코드에 박혀 있지 않다 ==');
{
  assert.equal(typeof FIRST_PLAY_RULES.cropSurplusSaleRate, 'number',
    '★판매가 자리가 FIRST_PLAY_RULES 에 없다');
  assert.equal(RULES.cropSurplusSaleRate, FIRST_PLAY_RULES.cropSurplusSaleRate,
    '★계약이 기본 판매가를 안 물고 왔다');
  /* ★ 정본이 생기면 그쪽이 이긴다 — `characters.json._meta.cropSurplusSaleRate` */
  assert.equal(rulesAt(0.4).cropSurplusSaleRate, 0.4,
    '★_meta 의 판매가가 안 이겼다 — 값을 옮길 자리가 막혀 있다');
  assert.throws(() => rulesAt(-0.1), /잉여 판매가/,
    '★음수 판매가가 통과했다');
  const fp = createFirstPlayState({ enabled: true, rules: rulesAt(0.4) });
  assert.equal(cropSurplusRateOf(fp), 0.4, '★판이 계약의 판매가를 안 읽는다');
  ok(`판매가는 계약값 한 곳에만 있다 (지금 기본 ${Math.round(RULES.cropSurplusSaleRate * 100)}% · 2026-08-09 박사님 확정)`);
}

console.log('\n== B. 손익분기 — 지갑에서 나가는 씨앗값으로 잰다 ==');
{
  /* ⚠ 정가는 350·400원이지만 **지갑에서 나가는 값**은 ×1.4 · 100원 올림이다.
     ★★ 2026-08-09 박사님 확정 — 콩 씨앗 **실구매 700 → 500원**(정가 500 → 350).
       손익분기가 23.3% → **16.7%** 로 내려간다: 씨앗이 싸졌으니 더 싸게 팔아도 남는다.
     ★★ 무순은 씨앗값이 그대로인데(600원) 손익분기가 30.0% → **32.1%** 로 **올라갔다.**
       회전분이 2,000 → 1,867원으로 내려갔기 때문이다(무순 기본값 2,800 × 질림 2/3).
       ⇒ 두 작물이 **반대 방향으로** 움직였다. 한 값만 보고 "다 내려갔다"고 읽으면 안 된다. */
  assert.equal(buyPriceOf('bean_seed'), 500, '★콩 씨앗의 지갑값이 500원이 아니다');
  assert.equal(buyPriceOf('radish_seed'), 600, '★무 씨앗의 지갑값이 600원이 아니다');
  const bean = cropBreakEvenRate('beansprout');
  const musun = cropBreakEvenRate('musun');
  /* ⚠⚠ 2026-08-16 — 여기 **16.7%가 박혀 있었다.** 그것이 이 줄이 지키던 옛 약속이다:
       「콩 씨앗 500원 / 콩나물 한 회전분 3,000원」. g 셈이 들어오면서 콩나물 최상 품질
       한 회전분이 **4,000원**(400g)이 되어 손익분기가 **12.5%** 로 내려갔다
       (first_play §그램 — 중간빛 300g 기준 ±100g).
     ★ 무순은 그램 표가 없어 값이 한 푼도 안 움직였다 — 32.1% 그대로다.
       ⇒ 두 작물이 또 갈렸다. 한 값만 보고 「다 내려갔다」로 읽으면 안 된다(2026-08-09 과 같은 함정). */
  /* ⚠⚠ 2026-08-17 — **무순 쪽이 또 움직였다. 32.1% 가 여기 박혀 있었다.**
     ① 질림(×2/3)을 걷어서 무순 최상 회전분이 1,867 → 3,000원(300g)이 됐다(확정문 §6)
     ② `shop.cropBreakEvenRate` 가 인자 셋으로 부르며 **작물 순번을 질림 축으로도 넘기고**
        있었다 — 그대로 두면 없는 벌이 계속 걸린다. 넷째 인자로 갈라 넘기게 고쳤다.
     ⇒ 600 / 3,000 = **20.0%**. 콩나물은 한 푼도 안 움직였다(12.5%). */
  /* ⚠⚠ 2026-08-18 — **둘 다 또 내려갔다. 12.5% 와 20.0% 가 여기 박혀 있었다.**
     이번에는 씨앗값이 아니라 **최상 품질 수확량**이 움직였다(박사님 *"200-500"* · §E):
       콩나물 최상 400g → **500g** ⇒ 500 / 5,000 = **10.0%** (12.5 → 10.0)
       무순  최상 300g → **400g** ⇒ 600 / 4,000 = **15.0%** (20.0 → 15.0)
     ★ 이번엔 **둘이 같은 방향으로** 움직였다 — 위 두 사건(2026-08-09 · 08-16)에서는
       반대로 갈렸다. 「늘 갈린다」로도, 「늘 같이 간다」로도 읽으면 안 된다.
     ⚠ `cropBreakEvenRate` 는 **최상 품질**(`qualityMaxMeals`)로 잰다 — 「제일 잘 됐을 때
       씨앗값을 뽑으려면 몇 %에 팔아야 하나」다. 그래서 위끝만 벌려도 이 값이 움직인다. */
  assert.equal(bean.toFixed(3), '0.100', `★콩나물 손익분기가 10.0%가 아니다: ${bean}`);
  assert.equal(musun.toFixed(3), '0.150', `★무순 손익분기가 15.0%가 아니다: ${musun}`);
  /* ★ 정가로 셈하면 11.7%가 나온다 — 그 값이 아님을 못 박는다 */
  assert.notEqual(bean.toFixed(3), '0.117', '★손익분기를 정가로 셈하고 있다');
  ok(`손익분기 콩나물 ${(bean * 100).toFixed(1)}% · 무순 ${(musun * 100).toFixed(1)}%`);
}

console.log('\n== C. ★끼니로 쓸 수 있는 것은 안 팔린다 ==');
{
  /* 시루 하나 — 겹치지도 넘치지도 않는다. 3,000원이 통째로 **밥**이다 */
  const { fp, h } = sameDayHarvest(1);
  assert.equal(h.cycleSavedWon, W0, '★한 시루가 온전한 한 회전분을 안 냈다');
  assert.equal(h.overlapLostWon, 0);
  assert.equal(h.spoiledWon, 0);
  assert.equal(fp.food.pantryWon, W0, '★곳간에 안 들어갔다');
  assert.equal(h.surplusWon, 0, '★겹치지도 넘치지도 않았는데 잉여가 생겼다');
  assert.equal(cropSurplusQuote(fp).canSell, false, '★★밥이 될 몫을 팔 수 있다고 한다');

  const S = newState({ firstPlay: true, firstPlayRules: RULES });
  S.firstPlay = fp;
  assert.throws(() => sellCropSurplus(S), (e) => e.tutorialInput === true && /넘길 잉여가 없습니다/.test(e.message),
    '★팔 것이 없는데 안 막았다');
  /* 그리고 그 3,000원은 **여전히 밥으로 나온다** */
  /* ⚠⚠ 2026-08-17 — 여기서 재던 것이 바뀌었다. 옛 줄은
       `bite.savedWon === min(dailyCropSaveWonOf(fp), W0)` = **4,000원**(한 회전분 통째)였다.
     확정문 §1 이 밥을 「몫」으로 바꿨다 — 콩나물 400g 은 **첫 몫 300g** 을 채우고 100g 이
     남는다. 그 100g 은 둘째 몫을 못 채우고, 채워도 같은 작물이라 4.00원/g 이라 **판다**.
     ⇒ 밥값은 **한 몫 = 2,500원**이고 곳간에서는 3,000원(300g)이 빠진다. 두 수가 다르다. */
  const bite = eatFromPantry(fp);
  assert.equal(bite.savedWon, RULES.cropMealPortionWon, '★첫 몫이 온전히 안 들어왔다');
  assert.equal(bite.savedGrams, RULES.dailyCropGrams, '★콩나물 한 몫이 300g 이 아니다');
  assert.equal(bite.pantryUsedWon, RULES.dailyCropGrams * 10,
    '★곳간에서 빠진 물건 값이 300g 어치가 아니다');
  assert.equal(fp.food.pantryWon, W0 - bite.pantryUsedWon, '★남는 100g 이 곳간에 안 남았다');
  ok('시루 하나짜리 판에는 팔 것이 아예 없다 — 곳간에 든 몫은 손도 못 댄다');
}

console.log('\n== D. 잉여의 정의 — 곳간이 못 받은 몫, 그 둘뿐 (★문을 연 판) ==');
{
  /* ⚠ 2026-08-17 — **뜻이 바뀐 절이다.** 예전에는 「게임에서 이런 일이 난다」였고
     이제는 「잉여를 만드는 계통이 아직 성하다」다. 게임 규칙에서는 §K 처럼 잉여가 0 이다. */
  const { fp, h } = sameDayHarvest(4, PEN);
  /* 같은 날 넷을 거두면 4,000 → 2,670 → 1,330 → 0 으로 깎인다(§겹침 · 문 열림) */
  assert.deepEqual(h.perPot.map(p => p.savedWon), OVER4);
  assert.equal(h.cycleSavedWon, SUM4, '★곳간에 들어간 몫이 안 맞는다');
  assert.equal(h.overlapLostWon, LOST4, '★겹쳐서 못 받은 몫이 안 맞는다');
  assert.equal(h.spoiledWon, 0, '★한도(시루 4개 × 한 회전분) 안인데 쉬었다');
  assert.equal(h.surplusWon, h.overlapLostWon + h.spoiledWon,
    '★★잉여가 「겹쳐서 못 받은 몫 + 쉰 몫」이 아니다 — 정의가 새고 있다');
  assert.equal(h.surplusPendingWon, LOST4);
  /* ★ 잉여 + 곳간 = 온전한 값의 합. 어느 쪽도 서로를 갉아먹지 않는다 */
  assert.equal(h.cycleSavedWon + h.surplusWon, 4 * cropCycleSavedWon(RULES, 3, 0),
    '★잉여와 곳간을 더해도 온전한 값이 안 된다');
  assert.equal(fp.food.pantryWon, SUM4);
  ok(`잉여 ${LOST4.toLocaleString()}원 · 곳간 ${SUM4.toLocaleString()}원 — 같은 수확이 둘로 정확히 갈린다`);
}

console.log('\n== E. ★파는 것이 곳간을 한 푼도 안 건드린다 (★문을 연 판) ==');
{
  const { fp } = sameDayHarvest(4, PEN);
  const before = fp.food.pantryWon;
  const S = newState({ firstPlay: true, firstPlayRules: PEN });
  S.firstPlay = fp;
  const r = sellCropSurplus(S);
  assert.equal(fp.food.pantryWon, before, '★★팔았더니 곳간이 줄었다 — 끼니를 팔았다');
  assert.equal(r.pendingWon, LOST4);
  assert.equal(r.won, Math.round(LOST4 * RULES.cropSurplusSaleRate));
  /* 다 팔고 나서도 곳간의 것은 **그대로 밥이 된다** — 며칠에 걸쳐 다 나간다.
     ⚠⚠ 2026-08-17 — 옛 줄은 `ate === SUM4`(밥값 합계 = 곳간 총액)였다. 확정문 §1 이
       두 단위를 갈라서(§몫) **더는 같은 수가 아니다** — 곳간 300g(3,000원)이 밥값
       2,500원이 된다. ⇒ 재는 자리를 **곳간에서 빠진 물건 값**으로 옮긴다. 그게 이 절이
       원래 지키려던 것(「판 것이 곳간을 안 갉았다」)에 정확히 맞는 자다. */
  let ate = 0, drained = 0;
  for (let d = 0; d < CYCLE + 2; d++) {
    const b = eatFromPantry(fp);
    ate += b.savedWon; drained += b.pantryUsedWon;
  }
  assert.equal(drained, SUM4, '★판 뒤에 곳간에서 먹을 것이 줄었다');
  assert.equal(fp.food.pantryWon, 0, '★곳간이 안 비었다');
  assert.ok(ate > 0 && ate < SUM4,
    '★밥값이 곳간 총액과 같다 — 두 단위가 안 갈렸다(§몫)');
  /* 두 번은 못 판다 */
  assert.throws(() => sellCropSurplus(S), (e) => e.tutorialInput === true,
    '★같은 잉여를 두 번 팔았다');
  ok(`판 뒤에도 곳간 ${SUM4.toLocaleString()}원이 그대로 밥이 된다 · 두 번은 못 판다`);
}

console.log('\n== F. 판매가를 바꾸면 결과가 따라 움직인다 ==');
{
  const rows = [];
  for (const rate of [0, 0.233, 0.25, 0.5, 0.7, 1.0]) {
    const rules = penAt(rate);            // ★ 2026-08-17 · 문을 연 판(§머리말)
    const { fp } = sameDayHarvest(4, rules);
    const q = cropSurplusQuote(fp);
    assert.equal(q.pendingWon, LOST4, '★판매가가 잉여의 양을 바꿨다 — 값과 양이 섞였다');
    assert.equal(q.won, Math.round(LOST4 * rate), `★${rate} 에서 받는 값이 안 맞는다`);
    const taken = takeCropSurplus(fp);
    assert.equal(fp.food.totalSurplusSoldWon, taken.won);
    rows.push([rate, q.won]);
  }
  /* 0%면 한 푼도 안 들어오고, 제값이면 정가 그대로다 — 사이는 단조증가 */
  assert.equal(rows[0][1], 0, '★0%인데 돈이 들어왔다');
  assert.equal(rows[rows.length - 1][1], LOST4, '★100%인데 정가가 안 들어왔다');
  for (let i = 1; i < rows.length; i++)
    assert.ok(rows[i][1] > rows[i - 1][1], '★판매가를 올렸는데 안 늘었다');
  ok('판매가 ' + rows.map(([r, w]) => `${Math.round(r * 100)}%→${w.toLocaleString()}원`).join(' · '));
}

console.log('\n== G. ★손익분기 아래에서는 손해다 ==');
{
  /* ★ 「잉여만 내는 시루」를 **차이로** 만든다.
       시루 3개 → 저감 6,000 · 잉여 3,000
       시루 4개 → 저감 6,000 · 잉여 6,000     ← 저감은 한 푼도 안 늘고 잉여만 3,000 는다
     그 넷째 시루가 곧 econgap §6-3 의 마지막 줄(「겹침 3번째~ · 저감 상한 위」)이다.
     그 시루를 한 회전 돌리는 데 지갑에서 나가는 것은 씨앗 한 봉지값뿐이다. */
  const SEED = buyPriceOf('bean_seed');
  const marginOf = (rate) => {
    const rules = penAt(rate);            // ★ 2026-08-17 · 문을 연 판(§머리말)
    const a = sameDayHarvest(3, rules), b = sameDayHarvest(4, rules);
    assert.equal(b.h.cycleSavedWon - a.h.cycleSavedWon, 0,
      '★넷째 시루가 저감을 늘렸다 — 「잉여만 내는 시루」가 아니다');
    const dSurplus = cropSurplusQuote(b.fp).won - cropSurplusQuote(a.fp).won;
    return dSurplus - SEED;            // 그 시루 한 회전의 순액
  };
  /* ★★ 2026-08-16 — **표본을 또 다시 잡았다.** g 셈이 들어와 한 회전분이 3,000 → 4,000원이
     되면서 손익분기가 16.7% → **12.5%** 로 내려갔다(씨앗값 500원은 그대로다).
     예전 표본(10% 손해 · 11.7% 손해)은 16.7% 아래를 재던 값인데, 12.5% 아래는 10% 뿐이라
     11.7% 는 이제 **이득 쪽**이다 — 그대로 두면 검사가 「아래는 손해」를 거꾸로 못 박는다.
     ⇒ 분기점을 사이에 두고 다시 고른다: 8.75%(정가 기준) 손해 · 10% 손해 · 12.5% ±0 ·
       20% 이득 · 85%(박사님 확정) 이득. ★ 순액은 **재서 적는다**(손으로 세지 않는다). */
  /* ══ ⚠⚠ 2026-08-18 — **표본을 또 다시 잡았다** (같은 함정을 세 번째로 밟는다) ══════
     수확량 눈금이 넓어져(박사님 *"200-500"*) 콩나물 최상이 400 → 500g 이 됐고,
     손익분기가 12.5% → **10.0%** 로 내려갔다. 여기 있던 표본 `marginOf(0.10) < 0` 은
     이제 **정확히 ±0** 이라 「아래는 손해」를 못 재고 그 자리에서 깨진다.
     ★ 그래서 표본을 **손으로 다시 고르지 않고 분기점에서 유도한다** — 아래는 `be × 0.8`,
       위는 `be × 1.6`. 다음에 눈금이 또 움직여도 이 줄은 안 깨진다(START-HERE §2.8).
     ⚠ 옛 표본은 그대로 적어 둔다: 16.7%(~08-16) → 12.5%(~08-17) → **10.0%**. */
  const be = cropBreakEvenRate('beansprout');
  /* 정가(350원)로 씨앗값을 셈하면 나오는 분기점 — 그 값에서 이득이 나면 정가로 세고 있는 것이다 */
  const beList = 350 / W0;
  const under = be * 0.8, over = be * 1.6;       // 분기점의 아래·위 (지금 8.0% · 16.0%)
  assert.ok(marginOf(under) < 0,
    `★분기점 아래(${(under * 100).toFixed(1)}%)인데 손해가 아니다 (${marginOf(under)}원)`);
  assert.ok(marginOf(beList) < 0,
    `★정가 기준 손익분기(${(beList * 100).toFixed(1)}%)에서 이득이 났다 — 씨앗값을 정가로 셈하고 있다`);
  assert.equal(marginOf(be), 0, '★손익분기에서 ±0 이 아니다');
  assert.ok(marginOf(over) > 0, `★분기점 위(${(over * 100).toFixed(1)}%)인데 이득이 아니다`);
  assert.ok(marginOf(0.85) > marginOf(over), '★판매가를 올렸는데 순액이 안 늘었다');
  ok(`씨앗 ${SEED.toLocaleString()}원 · ${(under * 100).toFixed(1)}%→${marginOf(under)}원 · ` +
     `${(be * 100).toFixed(1)}%→0원 · ${(over * 100).toFixed(1)}%→${marginOf(over)}원 · ` +
     `85%→${marginOf(0.85)}원`);
}

console.log('\n== H. 쌓아 뒀다 한 번에 넘겨도 총액이 같다 (★문을 연 판) ==');
{
  const { fp } = sameDayHarvest(4, PEN);
  /* 거둔 것을 그대로 두고 한 회전 더 돌린다 — 잉여가 이어서 쌓인다 */
  for (const p of fp.beansprout.pots) { p.harvested = false; p.ageDays = 0; p.dliHist = []; p.startedOnDay = null; }
  waterBeansprout(fp, CYCLE, { all: true });
  for (let d = 1; d <= CYCLE; d++) advanceBeansproutDay(fp, DARK);
  const h2 = harvestBeansprout(fp, { day: CYCLE * 2 });
  assert.equal(h2.surplusWon, LOST4, '★둘째 회전의 잉여가 안 맞는다');
  assert.equal(h2.surplusPendingWon, LOST4 * 2, '★★잉여가 안 쌓였다 — 안 넘기면 사라진다');

  const S = newState({ firstPlay: true, firstPlayRules: PEN });
  S.firstPlay = fp;
  const st = cropSurplusStatus(S);
  assert.equal(st.pendingWon, LOST4 * 2);
  assert.equal(fp.food.surplusWon, LOST4 * 2, '★상태를 보는 함수가 장부를 비웠다');
  const r = sellCropSurplus(S);
  assert.equal(r.won, Math.round(LOST4 * 2 * RULES.cropSurplusSaleRate));
  assert.equal(cropSurplusStatus(S).pendingWon, 0);
  ok(`두 회전을 모아 ${(LOST4 * 2).toLocaleString()}원어치를 한 번에 → ${r.won.toLocaleString()}원`);
}

console.log('\n== I. 지갑에 실제로 들어간다 — 그루·삽수와 같은 문으로 (★문을 연 판) ==');
{
  const { fp } = sameDayHarvest(4, PEN);
  const S = newState({ firstPlay: true, firstPlayRules: PEN });
  S.firstPlay = fp;
  const cashBefore = S.tutorial.cashWon;
  const earnedBefore = shopStatus(S).earnedWon;
  const logBefore = S.log.length;
  const r = sellCropSurplus(S);
  assert.equal(S.tutorial.cashWon - cashBefore, r.won, '★지갑이 안 늘었다');
  assert.equal(shopStatus(S).earnedWon - earnedBefore, r.won, '★상점 장부에 안 잡혔다');
  assert.equal(S.tutorial.crop.soldWon, r.won, '★작물 판매 장부에 안 잡혔다');
  assert.equal(S.log.length - logBefore, 1, '★로그가 한 줄이 아니다');
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].id, 'crop_surplus_sold');
  assert.equal(r.events[0].won, r.won);
  /* 파산 중이었다면 풀린다 — sellPot·sellCutting 과 같은 규칙이다 */
  const S2 = newState({ firstPlay: true, firstPlayRules: PEN });
  S2.firstPlay = sameDayHarvest(4, PEN).fp;
  S2.tutorial.cashWon = 0; S2.tutorial.bankrupt = true;
  sellCropSurplus(S2);
  assert.equal(S2.tutorial.bankrupt, false, '★잉여를 팔았는데 파산이 안 풀렸다');
  ok('지갑 · 상점 장부 · 파산 해제가 그루·삽수와 같은 문으로 돈다');
}

console.log('\n== J. **곳간은 이제 안 넘친다 — 쌓인다** (2026-08-16 박사님 확정) ==');
{
  /* ⚠⚠ **이 절이 지키던 약속이 통째로 바뀌었다.**
       옛 이름: 「곳간이 넘쳐 쉰 몫도 잉여다」. 옛 줄은 `fp.food.pantryWon = pantryCapWon(fp)`
       로 곳간을 한도까지 채운 뒤 또 거둬 `spoiledWon` 이 나는 것을 못 박았다.
     박사님: *"400G 가 오면 300G 까지는 당일 쓸 수 있는 거고 **남는 거 팔아먹든 하는 거**"*
       (그리고 2026-08-14 *"유통기한 그냥 없는걸로"*)
     ⇒ 곳간에 **한도가 없다**(`pantryCapWon` → Infinity). 남는 것은 버려지는 몫이 아니라
       **재고**다. ⇒ 이 절은 이제 「안 쉰다 · 다 쌓인다」를 못 박는다. */
  assert.equal(pantryCapWon({ rules: RULES }), Infinity, '★곳간에 아직 한도가 있다');
  const fp = createFirstPlayState({ enabled: true, rules: RULES });
  placeBeansprout(fp, 'dark-slot');
  /* 여섯 회전을 쌓는다 — 옛 규칙이면 첫 회전 뒤로는 전부 쉬어서 버려졌을 양이다 */
  let total = 0;
  for (let cycle = 0; cycle < 6; cycle++) {
    for (const p of fp.beansprout.pots) {
      p.harvested = false; p.ageDays = 0; p.dliHist = []; p.startedOnDay = null;
    }
    waterBeansprout(fp, cycle * CYCLE, { all: true });
    for (let d = 1; d <= CYCLE; d++) advanceBeansproutDay(fp, DARK);
    const h = harvestBeansprout(fp, { day: (cycle + 1) * CYCLE });
    assert.equal(h.spoiledWon, 0, `★${cycle + 1}회전째에 쉰 몫이 났다 — 곳간이 아직 넘친다`);
    assert.equal(h.surplusWon, 0, '★안 겹치고 안 넘쳤는데 잉여가 났다');
    total += h.cycleSavedWon;
  }
  assert.equal(fp.food.pantryWon, total,
    '★★거둔 것이 곳간에 다 안 쌓였다 — 남는 것이 어디론가 사라진다');
  ok(`여섯 회전 ${total.toLocaleString()}원어치가 한 푼도 안 쉬고 곳간에 쌓인다`);
}

console.log('\n== K. ★★★ **게임 규칙에서는 잉여가 아예 안 생긴다** (2026-08-17 박사님 확정) ==');
{
  /* ★★ **이 절이 이 파일의 새 중심이다.** 위 §D~I 는 「계통이 성한가」를 문을 열고 재고,
     여기서는 **게임이 실제로 도는 규칙**으로 잰다.
     박사님: *"하루 수확량을 개수에 따라 조절하라는 게 아니었는데… 식량으로 사용할 수 있는
     G수를 조절하란 거지.. 최대 300G로."*  ⇒ 거두는 것은 온전히 들어온다. */
  assert.notEqual(RULES.cropOverlapTiredEnabled, true, '★게임 규칙이 겹침의 벌을 켜 두었다');

  /* ① 같은 날 여섯을 거둬도 **여섯 몫이 다 들어온다** */
  const { fp, h } = sameDayHarvest(6);
  assert.deepEqual(h.perPot.map(p => p.savedWon), new Array(6).fill(W0),
    '★같은 날 거둔 것이 깎였다 — 겹침의 벌이 아직 물린다');
  assert.equal(h.overlapLostWon, 0, '★못 받은 몫이 났다');
  assert.equal(h.spoiledWon, 0, '★쉰 몫이 났다');
  assert.equal(h.surplusWon, 0, '★잉여가 났다 — 두 항이 다 0 인데 어디서 왔나');
  assert.equal(h.surplusPendingWon, 0, '★잉여 장부에 쌓였다');
  assert.equal(fp.food.pantryWon, 6 * W0, '★거둔 것이 곳간에 다 안 들어갔다');

  /* ② 그래서 **팔 잉여가 없다.** 상점 창구가 「없습니다」로 막는다 —
        「0원짜리를 팔 수 있다」고 하면 화면에 빈 단추가 뜬다 */
  assert.equal(cropSurplusQuote(fp).canSell, false, '★잉여가 0 인데 팔 수 있다고 한다');
  const S = newState({ firstPlay: true, firstPlayRules: RULES });
  S.firstPlay = fp;
  assert.equal(cropSurplusStatus(S).pendingWon, 0, '★상점이 잉여가 있다고 말한다');
  assert.throws(() => sellCropSurplus(S), (e) => e.tutorialInput === true,
    '★팔 것이 없는데 안 막았다');

  /* ③ ★ 그런데 **거둔 것을 팔 길 자체는 살아 있다** — 곳간에서 판다(§곳간 판매).
        「남는 거 팔아먹든 하는 거」라는 박사님 그림이 안 죽었음을 여기서 못 박는다.
        ⚠ 이게 없으면 「잉여가 0 이다」가 「팔 수 없게 됐다」로 잘못 읽힌다. */
  const q = pantrySaleQuote(fp, 1);
  assert.equal(q.canSell, true, '★★곳간에 6회전이 쌓였는데 팔 길이 없다 — 그림이 통째로 막혔다');
  assert.equal(q.won, Math.round(W0 * RULES.cropSurplusSaleRate),
    '★곳간 한 판을 넘긴 값이 판매가와 안 맞는다');

  /* ④ 그리고 **먹는 몫은 한 몫 그대로다** — 늘어난 것은 손에 든 양이지 밥값이 아니다.
     ⚠⚠ 2026-08-17 — 옛 줄은 `savedWon === dailyCropSaveWonOf(fp)`(= 3,000원 = 300g)였다.
       확정문 §1 이 밥을 「몫」으로 바꿨고, 이 판은 **콩나물만** 있으므로 첫 몫 하나뿐이다.
       둘째 몫은 같은 작물이라 1,200원(4.00원/g) < 파는 값 7원/g 이라 **안 먹고 판다**(§3). */
  const bite6 = eatFromPantry(fp);
  assert.equal(bite6.savedWon, RULES.cropMealPortionWon,
    '★여섯을 거뒀다고 하루에 먹는 몫이 늘었다 — 몫 상한이 무너졌다');
  assert.equal(bite6.portions.length, 1,
    '★같은 작물로 둘째 몫까지 먹었다 — 파는 것이 나은데 먹고 있다(확정문 §3)');
  ok(`여섯을 같은 날 거둬도 ${(6 * W0).toLocaleString()}원어치가 온전히 곳간에 든다 · 잉여 0 · ` +
     `밥은 첫 몫 ${RULES.cropMealPortionWon.toLocaleString()}원뿐 · 남는 것은 곳간에서 팔린다`);
}

console.log(`\n★ tools/test_cropsale.mjs — ${n}벌 전부 통과\n`);
