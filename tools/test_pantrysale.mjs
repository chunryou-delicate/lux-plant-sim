/* ============================================================
   tools/test_pantrysale.mjs — 곳간 채소를 판다 (2026-08-15 신설)
   ------------------------------------------------------------
   박사님 확정(2026-08-15): *"채소는 상점에서 판매 가능하게 해줘.
   누르면 몇개팔지 나오게도 해주고."* + ㉯(곳간 것도 팔게).

   ⚠⚠ **이 검사는 앞선 약속 하나가 바뀐 자리다.**
     `test_cropsale §C·§E` 는 *"파는 것이 곳간을 한 푼도 안 건드린다"* 를 못 박는다.
     그 검사는 **여전히 그대로 통과해야 한다** — 못 박고 있던 것이 「잉여 판매 창구
     (`sellCropSurplus`)가 곳간을 안 만진다」이고, 그 뜻은 지금도 살아 있기 때문이다.
     바뀐 것은 「곳간을 파는 길이 **아예 없다**」이고, 그건 검사가 아니라 문서의 약속이었다.
   ⇒ 그래서 여기서는 **새 창구(`sellPantryCrop`)만** 곳간을 만지고, 잉여 창구는 예전처럼
     안 만진다는 것을 **한 판 안에서 같이** 못 박는다(§F).

   이 검사가 못 박는 것 넷.
     ① ★**개수가 거짓말이 아니다.** 「N판」은 꾸러미 수이고, 각 판의 값을 더하면
        곳간 총액과 **정확히** 같다. 어림수가 아니다.
     ② ★**팔면 늘 손해다.** 곳간 1원 = 밥값 1원인데 받는 것은 0.85원이다.
        이 부등호가 뒤집히면 「밥으로 먹는 것보다 파는 게 낫다」가 되어 뼈대가 뒤집힌다.
     ③ ★**먼저 거둔 것부터 나간다**(FIFO) — 먹는 순서와 같다.
     ④ ★**옛 세이브가 열린다.** 꾸러미 기록이 없는 판(원만 있는 판)도 팔 수 있다.

   ⚠ 숫자를 안 지어낸다. 판매가는 계약(`cropSurplusSaleRate`), 한 회전분은
     `cropCycleSavedWon`, 하루 몫은 `dailyCropSaveWonOf` 에서 읽는다.
============================================================ */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  firstPlayRulesFromBalance, createFirstPlayState,
  placeBeansprout, waterBeansprout, advanceBeansproutDay, harvestBeansprout,
  makeCropPot, eatFromPantry, dailyCropSaveWonOf, cropSurplusRateOf,
  pantryLotsOf, pantrySaleQuote, takePantryCrop
} from '../src/game/first_play.js';
import { newState, sellPantryCrop, pantrySaleStatus,
         sellCropSurplus, cropSurplusStatus } from '../src/game/state.js';
import { serialize, deserialize } from '../src/game/save.js';

const BALANCE = JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8'));
const RULES = firstPlayRulesFromBalance(BALANCE);
const RATE = RULES.cropSurplusSaleRate;
const CYCLE = RULES.harvestDays;
const DARK = 0.2;                       // 콩나물 최상 품질(3끼)이 나오는 빛

let n = 0;
const ok = (name) => { n++; console.log(`  ✓ ${name}`); };

/* 시루 n개를 **같은 날** 돌려 한 번에 거둔다 (test_cropsale 과 같은 판) */
function sameDayHarvest(pots, rules = RULES) {
  const fp = createFirstPlayState({ enabled: true, rules });
  for (let i = 2; i <= pots; i++) fp.beansprout.pots.push(makeCropPot('crop_01_0' + i));
  placeBeansprout(fp, 'dark-slot');
  waterBeansprout(fp, 0, { all: true });
  for (let d = 1; d <= CYCLE; d++) advanceBeansproutDay(fp, DARK);
  const h = harvestBeansprout(fp, { day: CYCLE });
  return { fp, h };
}
const stateWith = (fp) => {
  const S = newState({ firstPlay: true, firstPlayRules: RULES });
  S.firstPlay = fp;
  return S;
};
const sumLots = (fp) => pantryLotsOf(fp).reduce((a, l) => a + l.won, 0);

console.log('\n== A. ★개수가 어림수가 아니다 — 판을 더하면 곳간과 딱 맞는다 ==');
{
  const { fp } = sameDayHarvest(4);
  /* 같은 날 넷을 거두면 3,000 / 2,000 / 1,000 / 0 — 0원짜리는 꾸러미가 안 된다 */
  const lots = pantryLotsOf(fp);
  assert.equal(lots.length, 3, `★판 수가 3이 아니다: ${lots.length}`);
  assert.deepEqual(lots.map(l => l.won), [3000, 2000, 1000]);
  assert.equal(sumLots(fp), fp.food.pantryWon,
    '★★판을 다 더해도 곳간 총액이 안 된다 — 화면의 「N판」이 거짓말이 된다');
  assert.ok(lots.every(l => l.kind === 'beansprout'), '★작물 이름을 안 적었다');
  assert.ok(lots.every(l => l.day === CYCLE), '★거둔 날을 안 적었다');
  ok(`곳간 ${fp.food.pantryWon.toLocaleString()}원 = 3,000 + 2,000 + 1,000 (3판)`);
}

console.log('\n== B. ★★팔면 늘 손해다 — 이 부등호가 이 계통의 뼈대다 ==');
{
  assert.ok(RATE < 1, `★★판매가가 1.00 이상이다(${RATE}) — 「밥으로 먹는 것보다 파는 게 낫다」가 된다`);
  const { fp } = sameDayHarvest(4);
  const q = pantrySaleQuote(fp);                       // 안 주면 전부
  assert.equal(q.maxLots, 3);
  assert.equal(q.pendingWon, 6000);
  assert.equal(q.rate, RATE);
  assert.equal(q.won, Math.round(6000 * RATE));
  assert.equal(q.lossWon, q.pendingWon - q.won, '★손해를 안 세어 준다');
  assert.ok(q.won < q.pendingWon, '★★파는 값이 곳간값 이상이다');
  /* 견적은 **상태를 안 바꾼다** */
  assert.equal(fp.food.pantryWon, 6000, '★견적만 냈는데 곳간이 줄었다');
  ok(`6,000원어치 → ${q.won.toLocaleString()}원 (${q.lossWon.toLocaleString()}원 손해 · ${Math.round(RATE * 100)}%)`);
}

console.log('\n== C. ★몇 판을 팔지 고른다 — 고른 만큼만 나간다 ==');
{
  const { fp } = sameDayHarvest(4);
  const S = stateWith(fp);
  /* 1판만 — 먼저 거둔 3,000원짜리가 나간다 */
  const st1 = pantrySaleStatus(S, 1);
  assert.equal(st1.lots, 1);
  assert.equal(st1.pendingWon, 3000);
  assert.equal(st1.won, Math.round(3000 * RATE));
  assert.equal(st1.list.length, 3, '★목록이 세 판이 아니다');
  assert.equal(st1.list[0].kindKo, '콩나물', '★이름을 안 붙여 낸다');

  const r = sellPantryCrop(S, 1);
  assert.equal(r.lots, 1);
  assert.equal(r.pendingWon, 3000);
  assert.equal(r.won, Math.round(3000 * RATE));
  assert.equal(fp.food.pantryWon, 3000, '★★고른 것보다 많이/적게 나갔다');
  assert.deepEqual(pantryLotsOf(fp).map(l => l.won), [2000, 1000],
    '★★먼저 거둔 판이 아니라 다른 판이 나갔다');
  assert.equal(sumLots(fp), fp.food.pantryWon, '★판 뒤에 판과 총액이 어긋났다');
  assert.equal(fp.food.totalPantrySoldWon, r.won, '★누계가 안 쌓인다');

  /* 0판을 팔라면 막는다 — 안내지 고장이 아니다 */
  assert.throws(() => sellPantryCrop(S, 0),
    (e) => e.tutorialInput === true && /골라/.test(e.message), '★0판을 안 막았다');
  /* 있는 것보다 많이 부르면 **있는 만큼**이다(던지지 않는다 — ＋ 를 오래 눌러도 안 깨진다) */
  const all = pantrySaleQuote(fp, 99);
  assert.equal(all.lots, 2, '★있는 것보다 많이 팔린다');
  ok('1판만 팔면 1판만 나가고, 남은 판·총액이 서로 맞는다');
}

console.log('\n== D. ★먼저 거둔 것부터 — 파는 순서와 먹는 순서가 같다 ==');
{
  const { fp } = sameDayHarvest(4);
  /* ⚠ 하루 몫을 여기서 숫자로 적지 않는다 — 계약에서 읽는다.
     (기본 계약에서는 4,867원이다: 콩나물 3,000 + 무순 1,867. 「3,000원」은 콩나물만 있을 때 값이다) */
  const daily = dailyCropSaveWonOf(fp);
  assert.ok(daily > 0);
  eatFromPantry(fp);
  const after = pantryLotsOf(fp);
  assert.equal(sumLots(fp), fp.food.pantryWon, '★먹은 뒤 판과 총액이 어긋났다');
  assert.ok(after.length < 3, '★★먹었는데 판이 하나도 안 줄었다');
  assert.equal(after[after.length - 1].won, 1000,
    '★★맨 뒤(제일 나중에 거둔) 판이 먼저 깎였다 — FIFO 가 아니다');
  /* 다 먹을 때까지 돌리면 판이 남지 않는다 */
  for (let d = 0; d < 10 && fp.food.pantryWon > 0; d++) eatFromPantry(fp);
  assert.equal(fp.food.pantryWon, 0);
  assert.equal(pantryLotsOf(fp).length, 0, '★곳간이 비었는데 판이 남았다');
  ok('먹기도 팔기도 먼저 거둔 판부터 나간다 (FIFO)');
}

console.log('\n== D-2. ⚠ 하루 몫이 판 경계에 안 맞으면 — 「먹다 남은 판」이 남는다 ==');
{
  const { fp } = sameDayHarvest(4);
  const daily = dailyCropSaveWonOf(fp);
  fp.food.pantryLots = [];                       // 꾸러미 기록을 지우고
  fp.food.pantryWon = daily + 1000;              // 하루 몫보다 딱 1,000원 많게
  assert.equal(sumLots(fp), daily + 1000, '★옛 판이 판으로 안 쪼개진다');
  eatFromPantry(fp);                             // 하루 몫을 먹는다
  assert.equal(fp.food.pantryWon, 1000);
  assert.deepEqual(pantryLotsOf(fp).map(l => l.won), [1000],
    '★남은 판이 제 값을 못 적는다');
  const q = pantrySaleQuote(fp, 1);
  assert.equal(q.pendingWon, 1000, '★★남은 판을 온전한 한 판 값으로 판다 — 화면이 거짓말한다');
  assert.equal(q.won, Math.round(1000 * RATE));
  ok('먹다 남은 판은 「반 판」이 아니라 제 값(1,000원)을 그대로 적는다');
}

console.log('\n== E. ★옛 세이브 — 꾸러미 기록이 없어도 열리고 팔린다 ==');
{
  const { fp } = sameDayHarvest(4);
  /* 2026-08-15 이전 판: `pantryLots` 자체가 없다 */
  delete fp.food.pantryLots;
  delete fp.food.totalPantrySoldWon;
  const lots = pantryLotsOf(fp);
  assert.equal(sumLots(fp), 6000, '★옛 판의 곳간이 판으로 안 쪼개진다');
  assert.deepEqual(lots.map(l => l.won), [3000, 3000], '★하루치씩 안 쪼갰다');
  assert.ok(lots.every(l => l.kind === null),
    '★★무엇을 거둔 것인지 모르는데 작물 이름을 지어냈다');
  const S = stateWith(fp);
  const r = sellPantryCrop(S, 1);
  assert.equal(r.pendingWon, 3000);
  assert.equal(r.whatKo, '곳간에 있던 것 1판', `★모르는 것을 아는 척한다: ${r.whatKo}`);
  ok('옛 판(원만 있는 판)도 하루치씩 쪼개져 팔린다 — 작물 이름은 지어내지 않는다');
}

console.log('\n== F. ★★잉여 창구는 예전 그대로 — 곳간을 한 푼도 안 만진다 ==');
{
  const { fp } = sameDayHarvest(4);
  const S = stateWith(fp);
  const before = fp.food.pantryWon;
  const lotsBefore = pantryLotsOf(fp).map(l => l.won);
  assert.equal(cropSurplusStatus(S).pendingWon, 6000);
  const rs = sellCropSurplus(S);
  assert.equal(fp.food.pantryWon, before,
    '★★잉여를 넘겼더니 곳간이 줄었다 — 두 창구가 섞였다');
  assert.deepEqual(pantryLotsOf(fp).map(l => l.won), lotsBefore, '★잉여 판매가 판을 건드렸다');
  /* 그리고 두 누계가 **갈라져** 쌓인다 — 잉여는 버릴 것, 곳간은 밥이라 뜻이 다르다 */
  const rp = sellPantryCrop(S, 1);
  assert.equal(fp.food.totalSurplusSoldWon, rs.won);
  assert.equal(fp.food.totalPantrySoldWon, rp.won);
  assert.notEqual(fp.food.totalSurplusSoldWon, fp.food.totalPantrySoldWon);
  ok('잉여(버릴 몫)와 곳간(밥)이 서로 다른 창구·다른 누계로 남는다');
}

console.log('\n== G. ★같은 값 하나를 쓴다 — 새 판매가를 안 만들었다 ==');
{
  const rules4 = firstPlayRulesFromBalance(
    { ...BALANCE, _meta: { ...BALANCE._meta, cropSurplusSaleRate: 0.4 } });
  const { fp } = sameDayHarvest(4, rules4);
  assert.equal(cropSurplusRateOf(fp), 0.4);
  assert.equal(pantrySaleQuote(fp).rate, 0.4,
    '★★곳간 판매가 잉여와 다른 값을 쓴다 — 「어느 쪽으로 파는 게 이득인가」가 생긴다');
  assert.equal(pantrySaleQuote(fp).won, Math.round(6000 * 0.4));
  ok('곳간 판매가 = 잉여 판매가 = cropSurplusSaleRate 한 곳');
}

console.log('\n== H. ★세이브 — 판 목록이 저장되고, 안 실려도 판이 안 깨진다 ==');
{
  const S = newState({ firstPlay: true, firstPlayRules: RULES });
  const { fp } = sameDayHarvest(4);
  S.firstPlay = fp;
  sellPantryCrop(S, 1);
  const json = JSON.stringify(serialize(S));
  const S2 = deserialize(json, { firstPlayRules: RULES });
  const f2 = S2.firstPlay.food;
  assert.equal(f2.pantryWon, fp.food.pantryWon, '★곳간 총액이 사라졌다');
  assert.deepEqual(f2.pantryLots.map(l => l.won), pantryLotsOf(fp).map(l => l.won),
    '★★판 목록이 저장을 못 넘겼다');
  assert.deepEqual(f2.pantryLots.map(l => l.kind), pantryLotsOf(fp).map(l => l.kind));
  assert.equal(f2.totalPantrySoldWon, fp.food.totalPantrySoldWon, '★판 돈 누계가 사라졌다');
  /* 판 목록이 통째로 없어도(스키마 밖의 옛 파일) 총액에서 다시 세워진다 */
  const raw = JSON.parse(json);
  delete raw.state.firstPlay.food.pantryLots;
  const S3 = deserialize(JSON.stringify(raw), { firstPlayRules: RULES });
  assert.equal(pantrySaleStatus(S3).pendingWon, fp.food.pantryWon,
    '★★판 목록이 없는 파일에서 팔 것이 사라졌다');
  ok('판 목록이 저장을 넘고, 없는 파일도 총액에서 다시 세워진다');
}

console.log(`\n★ tools/test_pantrysale.mjs — ${n}벌 전부 통과\n`);
