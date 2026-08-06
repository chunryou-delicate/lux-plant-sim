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
     ③ ★**손익분기 아래에서는 손해다.** 콩나물 23.3% · 무순 30.0% —
        지갑에서 나가는 씨앗값(정가 × 1.4)으로 셈한 값이다. 정가로 셈하면 16.7%가 나오는데
        그건 틀린 값이고, econgap 이 실제로 한 번 그렇게 틀렸다.

   ⚠ 이 검사는 숫자를 하나도 안 지어낸다. 씨앗값은 `shop.buyPriceOf`, 한 회전분은
     `first_play.cropCycleSavedWon`, 손익분기는 `shop.cropBreakEvenRate` 에서 읽는다.
============================================================ */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FIRST_PLAY_RULES, firstPlayRulesFromBalance, createFirstPlayState,
  placeBeansprout, waterBeansprout, advanceBeansproutDay, harvestBeansprout,
  makeCropPot, eatFromPantry, pantryCapWon, dailyCropSaveWonOf,
  cropCycleSavedWon, cropSurplusQuote, cropSurplusRateOf, takeCropSurplus
} from '../src/game/first_play.js';
import { newState, sellCropSurplus, cropSurplusStatus } from '../src/game/state.js';
import { buyPriceOf, cropBreakEvenRate, shopStatus } from '../src/game/shop.js';

const BALANCE = JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8'));
/* 판매가만 갈아 끼운 계약을 만든다 — 저장소 파일은 한 글자도 안 고친다 */
const rulesAt = (rate) => firstPlayRulesFromBalance(
  rate == null ? BALANCE : { ...BALANCE, _meta: { ...BALANCE._meta, cropSurplusSaleRate: rate } });
const RULES = rulesAt(null);
const CYCLE = RULES.harvestDays;
const DARK = 0.2;                       // 콩나물 최상 품질(하얗고 아삭 3끼)이 나오는 빛

let n = 0;
const ok = (name) => { n++; console.log(`  ✓ ${name}`); };

/* 시루 n개를 **같은 날** 돌려 한 번에 거둔다 — 겹침이 물려 잉여가 생기는 판이다.
   반환은 수확 결과와 그 fp. */
function sameDayHarvest(pots, rules = RULES) {
  const fp = createFirstPlayState({ enabled: true, rules });
  placeBeansprout(fp, 'dark-slot');
  for (let i = 2; i <= pots; i++) fp.beansprout.pots.push(makeCropPot('crop_01_0' + i));
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
  ok(`판매가는 계약값 한 곳에만 있다 (지금 기본 ${Math.round(RULES.cropSurplusSaleRate * 100)}% · 미확정)`);
}

console.log('\n== B. 손익분기 — 지갑에서 나가는 씨앗값으로 잰다 ==');
{
  /* ⚠ 정가는 500·400원이지만 **지갑에서 나가는 값**은 ×1.4 다 */
  assert.equal(buyPriceOf('bean_seed'), 700, '★콩 씨앗의 지갑값이 700원이 아니다');
  assert.equal(buyPriceOf('radish_seed'), 600, '★무 씨앗의 지갑값이 600원이 아니다');
  const bean = cropBreakEvenRate('beansprout');
  const musun = cropBreakEvenRate('musun');
  assert.equal(bean.toFixed(3), '0.233', `★콩나물 손익분기가 23.3%가 아니다: ${bean}`);
  assert.equal(musun.toFixed(3), '0.300', `★무순 손익분기가 30.0%가 아니다: ${musun}`);
  /* ★ 정가로 셈하면 16.7%가 나온다 — 그 값이 아님을 못 박는다 */
  assert.notEqual(bean.toFixed(3), '0.167', '★손익분기를 정가로 셈하고 있다');
  ok(`손익분기 콩나물 ${(bean * 100).toFixed(1)}% · 무순 ${(musun * 100).toFixed(1)}%`);
}

console.log('\n== C. ★끼니로 쓸 수 있는 것은 안 팔린다 ==');
{
  /* 시루 하나 — 겹치지도 넘치지도 않는다. 3,000원이 통째로 **밥**이다 */
  const { fp, h } = sameDayHarvest(1);
  assert.equal(h.cycleSavedWon, 3000, '★한 시루가 온전한 한 회전분을 안 냈다');
  assert.equal(h.overlapLostWon, 0);
  assert.equal(h.spoiledWon, 0);
  assert.equal(fp.food.pantryWon, 3000, '★곳간에 안 들어갔다');
  assert.equal(h.surplusWon, 0, '★겹치지도 넘치지도 않았는데 잉여가 생겼다');
  assert.equal(cropSurplusQuote(fp).canSell, false, '★★밥이 될 몫을 팔 수 있다고 한다');

  const S = newState({ firstPlay: true, firstPlayRules: RULES });
  S.firstPlay = fp;
  assert.throws(() => sellCropSurplus(S), (e) => e.tutorialInput === true && /넘길 잉여가 없습니다/.test(e.message),
    '★팔 것이 없는데 안 막았다');
  /* 그리고 그 3,000원은 **여전히 밥으로 나온다** */
  const bite = eatFromPantry(fp);
  assert.equal(bite.savedWon, Math.min(dailyCropSaveWonOf(fp), 3000),
    '★파는 창구가 생기면서 밥이 줄었다');
  ok('시루 하나짜리 판에는 팔 것이 아예 없다 — 곳간에 든 몫은 손도 못 댄다');
}

console.log('\n== D. 잉여의 정의 — 곳간이 못 받은 몫, 그 둘뿐 ==');
{
  const { fp, h } = sameDayHarvest(4);
  /* 같은 날 넷을 거두면 3,000 → 2,000 → 1,000 → 0 으로 깎인다(§겹침) */
  assert.deepEqual(h.perPot.map(p => p.savedWon), [3000, 2000, 1000, 0]);
  assert.equal(h.cycleSavedWon, 6000, '★곳간에 들어간 몫이 안 맞는다');
  assert.equal(h.overlapLostWon, 6000, '★겹쳐서 못 받은 몫이 안 맞는다');
  assert.equal(h.spoiledWon, 0, '★한도(시루 4개 × 3,000원) 안인데 쉬었다');
  assert.equal(h.surplusWon, h.overlapLostWon + h.spoiledWon,
    '★★잉여가 「겹쳐서 못 받은 몫 + 쉰 몫」이 아니다 — 정의가 새고 있다');
  assert.equal(h.surplusPendingWon, 6000);
  /* ★ 잉여 + 곳간 = 온전한 값의 합. 어느 쪽도 서로를 갉아먹지 않는다 */
  assert.equal(h.cycleSavedWon + h.surplusWon, 4 * cropCycleSavedWon(RULES, 3, 0),
    '★잉여와 곳간을 더해도 온전한 값이 안 된다');
  assert.equal(fp.food.pantryWon, 6000);
  ok('잉여 6,000원 · 곳간 6,000원 — 같은 수확이 둘로 정확히 갈린다');
}

console.log('\n== E. ★파는 것이 곳간을 한 푼도 안 건드린다 ==');
{
  const { fp } = sameDayHarvest(4);
  const before = fp.food.pantryWon;
  const S = newState({ firstPlay: true, firstPlayRules: RULES });
  S.firstPlay = fp;
  const r = sellCropSurplus(S);
  assert.equal(fp.food.pantryWon, before, '★★팔았더니 곳간이 줄었다 — 끼니를 팔았다');
  assert.equal(r.pendingWon, 6000);
  assert.equal(r.won, Math.round(6000 * RULES.cropSurplusSaleRate));
  /* 다 팔고 나서도 밥은 그대로 나온다 — 5일에 걸쳐 6,000원이 다 나온다 */
  let ate = 0;
  for (let d = 0; d < CYCLE; d++) ate += eatFromPantry(fp).savedWon;
  assert.equal(ate, 6000, '★판 뒤에 먹을 몫이 줄었다');
  /* 두 번은 못 판다 */
  assert.throws(() => sellCropSurplus(S), (e) => e.tutorialInput === true,
    '★같은 잉여를 두 번 팔았다');
  ok('판 뒤에도 곳간 6,000원이 그대로 밥이 된다 · 두 번은 못 판다');
}

console.log('\n== F. 판매가를 바꾸면 결과가 따라 움직인다 ==');
{
  const rows = [];
  for (const rate of [0, 0.233, 0.25, 0.5, 0.7, 1.0]) {
    const rules = rulesAt(rate);
    const { fp } = sameDayHarvest(4, rules);
    const q = cropSurplusQuote(fp);
    assert.equal(q.pendingWon, 6000, '★판매가가 잉여의 양을 바꿨다 — 값과 양이 섞였다');
    assert.equal(q.won, Math.round(6000 * rate), `★${rate} 에서 받는 값이 안 맞는다`);
    const taken = takeCropSurplus(fp);
    assert.equal(fp.food.totalSurplusSoldWon, taken.won);
    rows.push([rate, q.won]);
  }
  /* 0%면 한 푼도 안 들어오고, 제값이면 정가 그대로다 — 사이는 단조증가 */
  assert.equal(rows[0][1], 0, '★0%인데 돈이 들어왔다');
  assert.equal(rows[rows.length - 1][1], 6000, '★100%인데 정가가 안 들어왔다');
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
    const rules = rulesAt(rate);
    const a = sameDayHarvest(3, rules), b = sameDayHarvest(4, rules);
    assert.equal(b.h.cycleSavedWon - a.h.cycleSavedWon, 0,
      '★넷째 시루가 저감을 늘렸다 — 「잉여만 내는 시루」가 아니다');
    const dSurplus = cropSurplusQuote(b.fp).won - cropSurplusQuote(a.fp).won;
    return dSurplus - SEED;            // 그 시루 한 회전의 순액
  };
  const be = cropBreakEvenRate('beansprout');
  assert.ok(marginOf(0.20) < 0, `★20%인데 손해가 아니다 (${marginOf(0.20)}원)`);
  assert.ok(marginOf(0.167) < 0, '★정가 기준 손익분기(16.7%)에서 이득이 났다 — 씨앗값을 정가로 셈하고 있다');
  assert.equal(marginOf(be), 0, '★손익분기에서 ±0 이 아니다');
  assert.ok(marginOf(0.25) > 0, '★25%인데 이득이 아니다');
  assert.equal(marginOf(0.25), 50, '★25%의 회전당 순액이 +50원이 아니다');
  assert.equal(marginOf(0.70), 1400, '★70%의 회전당 순액이 +1,400원이 아니다');
  ok(`씨앗 ${SEED.toLocaleString()}원 · 20%→${marginOf(0.20)}원 · ` +
     `${(be * 100).toFixed(1)}%→0원 · 25%→+50원 · 70%→+1,400원`);
}

console.log('\n== H. 쌓아 뒀다 한 번에 넘겨도 총액이 같다 ==');
{
  const { fp } = sameDayHarvest(4);
  /* 거둔 것을 그대로 두고 한 회전 더 돌린다 — 잉여가 이어서 쌓인다 */
  for (const p of fp.beansprout.pots) { p.harvested = false; p.ageDays = 0; p.dliHist = []; p.startedOnDay = null; }
  waterBeansprout(fp, CYCLE, { all: true });
  for (let d = 1; d <= CYCLE; d++) advanceBeansproutDay(fp, DARK);
  const h2 = harvestBeansprout(fp, { day: CYCLE * 2 });
  assert.equal(h2.surplusWon, 6000, '★둘째 회전의 잉여가 안 맞는다');
  assert.equal(h2.surplusPendingWon, 12000, '★★잉여가 안 쌓였다 — 안 넘기면 사라진다');

  const S = newState({ firstPlay: true, firstPlayRules: RULES });
  S.firstPlay = fp;
  const st = cropSurplusStatus(S);
  assert.equal(st.pendingWon, 12000);
  assert.equal(fp.food.surplusWon, 12000, '★상태를 보는 함수가 장부를 비웠다');
  const r = sellCropSurplus(S);
  assert.equal(r.won, Math.round(12000 * RULES.cropSurplusSaleRate));
  assert.equal(cropSurplusStatus(S).pendingWon, 0);
  ok(`두 회전을 모아 12,000원어치를 한 번에 → ${r.won.toLocaleString()}원`);
}

console.log('\n== I. 지갑에 실제로 들어간다 — 그루·삽수와 같은 문으로 ==');
{
  const { fp } = sameDayHarvest(4);
  const S = newState({ firstPlay: true, firstPlayRules: RULES });
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
  const S2 = newState({ firstPlay: true, firstPlayRules: RULES });
  S2.firstPlay = sameDayHarvest(4).fp;
  S2.tutorial.cashWon = 0; S2.tutorial.bankrupt = true;
  sellCropSurplus(S2);
  assert.equal(S2.tutorial.bankrupt, false, '★잉여를 팔았는데 파산이 안 풀렸다');
  ok('지갑 · 상점 장부 · 파산 해제가 그루·삽수와 같은 문으로 돈다');
}

console.log('\n== J. 곳간이 넘쳐 쉰 몫도 잉여다 ==');
{
  /* 시루 하나로 한도를 채운 뒤 또 거두면 넘친다 — `spoiledWon` 이 그 몫이다 */
  const fp = createFirstPlayState({ enabled: true, rules: RULES });
  placeBeansprout(fp, 'dark-slot');
  fp.food.pantryWon = pantryCapWon(fp);              // 한도까지 찬 곳간
  waterBeansprout(fp, 0);
  for (let d = 1; d <= CYCLE; d++) advanceBeansproutDay(fp, DARK);
  const h = harvestBeansprout(fp, { day: CYCLE });
  assert.equal(h.overlapLostWon, 0, '★겹치지 않았는데 깎였다');
  assert.equal(h.spoiledWon, 3000, '★넘친 몫이 안 맞는다');
  assert.equal(h.surplusWon, 3000, '★★쉰 몫이 잉여로 안 잡혔다');
  assert.equal(fp.food.pantryWon, pantryCapWon(fp), '★한도를 넘어 곳간에 들어갔다');
  ok('한도를 넘어 쉴 몫이 그대로 팔 몫이 된다 — 버리는 것을 안 버린다');
}

console.log(`\n★ tools/test_cropsale.mjs — ${n}벌 전부 통과\n`);
