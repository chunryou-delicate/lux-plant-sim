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
  pantryLotsOf, pantrySaleQuote, takePantryCrop,
  /* ★ 2026-08-16 · 그램 셈 (first_play §그램) */
  cropCycleSavedWon, pantryLotsWithGrams, pantryGramsOf, formatGram,
  mealPlanQuote, planMealGrams,
  /* ★ 2026-08-17 · §몫 · §판매 — 파는 값이 작물마다 다르다(확정문 §1) */
  CROP_KINDS, cropMealPlan
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
/* ★★ 2026-08-16 — 이 파일에 3,000 / 2,000 / 1,000 / 6,000 이 박혀 있었다. 그것이 이 검사가
   지키던 옛 약속이다: 「콩나물 최상 품질 한 회전 = 3,000원」. g 셈이 들어와 400 / 300 / 200g
   = 4,000 / 3,000 / 2,000원이 됐다(first_play §그램). ⇒ 규칙에서 읽는다. */
/* ══ ⚠⚠ 2026-08-17 — **이 표가 지키던 것이 또 바뀌었다** (first_play §겹침 2026-08-17) ══
   옛 줄: `const OVER4 = [0,1,2,3].map(t => cropCycleSavedWon(RULES,3,t,0))`
          // "같은 날 넷을 거두면" → 4,000 / 2,670 / 1,330 / 0 · 판 **3개** · 못 받은 몫 4,000
   박사님이 겹침의 벌을 걷으셨다 — *"하루 수확량을 개수에 따라 조절하라는 게 아니었는데…
   식량으로 사용할 수 있는 G수를 조절하란 거지.. 최대 300G로."*
   ⇒ 같은 날 넷을 거두면 **넷 다 온전한 값**이고 판이 **4개**다. 못 받은 몫은 **0**이다.
   ★ 그래서 이 파일의 판 수·FIFO 단언이 3 → 4 로 움직인다. 숫자는 여전히 규칙에서 읽는다. */
const W0 = cropCycleSavedWon(RULES, 3, 0, 0);                           // 온전한 한 회전분
const LOTS4 = new Array(4).fill(W0);                                    // 같은 날 넷을 거두면
const SUM4 = LOTS4.reduce((a, v) => a + v, 0);                          // 곳간에 든 몫
const LOST4 = 0;                                                        // 겹쳐서 못 받은 몫 — 이제 없다
/* ★ 겹침의 벌을 되살린 사본 — §F 가 「두 창구가 안 섞인다」를 재려면 잉여가 나야 한다.
   ⚠ 게임은 이 문을 안 연다(first_play §겹침). */
const PEN = Object.freeze({ ...RULES, cropOverlapTiredEnabled: true });
/* 옛 세이브(원만 있는 판)를 쪼개는 한 덩이 — `cropKindSavedWon[0]`(중간 품질)이 정본이다 */
const CHUNK = RULES.cropKindSavedWon[0];
const splitByChunk = (won) => {
  const out = [];
  for (let rest = won; rest > 0; rest -= CHUNK) out.push(Math.min(CHUNK, rest));
  return out;
};

console.log('\n== A. ★개수가 어림수가 아니다 — 판을 더하면 곳간과 딱 맞는다 ==');
{
  const { fp } = sameDayHarvest(4);
  /* ⚠ 2026-08-17 — 예전에는 4,000 / 2,670 / 1,330 / 0 이라 **판이 셋**이었다(0원은 꾸러미가
     안 된다). 이제 넷 다 4,000 이라 **판이 넷**이다(§겹침 2026-08-17). */
  const lots = pantryLotsOf(fp);
  assert.equal(lots.length, 4, `★판 수가 4가 아니다: ${lots.length}`);
  assert.deepEqual(lots.map(l => l.won), LOTS4);
  /* ★ 2026-08-16 — 꾸러미마다 g 이 붙어 나온다(§그램). 낱개를 더한 것이 곧 곳간의 g 이다 */
  const gs = pantryLotsWithGrams(fp);
  assert.deepEqual(gs.map(l => l.g), LOTS4.map(w => Math.round(w / 10)),
    '★꾸러미 g 이 원과 어긋난다 — 10원 = 1g 이 깨졌다');
  assert.equal(pantryGramsOf(fp), gs.reduce((a, l) => a + l.g, 0),
    '★★곳간 g 합계가 낱개의 합이 아니다 — 화면에 적힌 것을 더하면 안 맞게 된다');
  assert.equal(sumLots(fp), fp.food.pantryWon,
    '★★판을 다 더해도 곳간 총액이 안 된다 — 화면의 「N판」이 거짓말이 된다');
  assert.ok(lots.every(l => l.kind === 'beansprout'), '★작물 이름을 안 적었다');
  assert.ok(lots.every(l => l.day === CYCLE), '★거둔 날을 안 적었다');
  ok(`곳간 ${fp.food.pantryWon.toLocaleString()}원 = ${LOTS4.join(' + ')} (4판 · ${pantryGramsOf(fp)}g)`);
}

console.log('\n== B. ★★팔면 늘 손해다 — 이 부등호가 이 계통의 뼈대다 ==');
{
  assert.ok(RATE < 1, `★★판매가가 1.00 이상이다(${RATE}) — 「밥으로 먹는 것보다 파는 게 낫다」가 된다`);
  const { fp } = sameDayHarvest(4);
  const q = pantrySaleQuote(fp);                       // 안 주면 전부
  assert.equal(q.maxLots, 4);                          // ⚠ 2026-08-17 · 3 → 4 (§겹침)
  assert.equal(q.pendingWon, SUM4);
  assert.equal(q.rate, RATE);
  assert.equal(q.won, Math.round(SUM4 * RATE));
  assert.equal(q.lossWon, q.pendingWon - q.won, '★손해를 안 세어 준다');
  assert.ok(q.won < q.pendingWon, '★★파는 값이 곳간값 이상이다');
  /* 견적은 **상태를 안 바꾼다** */
  assert.equal(fp.food.pantryWon, SUM4, '★견적만 냈는데 곳간이 줄었다');
  ok(`${SUM4.toLocaleString()}원어치 → ${q.won.toLocaleString()}원 (${q.lossWon.toLocaleString()}원 손해 · ${Math.round(RATE * 100)}%)`);
}

console.log('\n== C. ★몇 판을 팔지 고른다 — 고른 만큼만 나간다 ==');
{
  const { fp } = sameDayHarvest(4);
  const S = stateWith(fp);
  /* 1판만 — **먼저 거둔** 판이 나간다 */
  const st1 = pantrySaleStatus(S, 1);
  assert.equal(st1.lots, 1);
  assert.equal(st1.pendingWon, LOTS4[0]);
  assert.equal(st1.won, Math.round(LOTS4[0] * RATE));
  assert.equal(st1.list.length, 4, '★목록이 네 판이 아니다');   // ⚠ 2026-08-17 · 3 → 4
  assert.equal(st1.list[0].kindKo, '콩나물', '★이름을 안 붙여 낸다');

  const r = sellPantryCrop(S, 1);
  assert.equal(r.lots, 1);
  assert.equal(r.pendingWon, LOTS4[0]);
  assert.equal(r.won, Math.round(LOTS4[0] * RATE));
  assert.equal(fp.food.pantryWon, SUM4 - LOTS4[0], '★★고른 것보다 많이/적게 나갔다');
  assert.deepEqual(pantryLotsOf(fp).map(l => l.won), LOTS4.slice(1),
    '★★먼저 거둔 판이 아니라 다른 판이 나갔다');
  assert.equal(sumLots(fp), fp.food.pantryWon, '★판 뒤에 판과 총액이 어긋났다');
  assert.equal(fp.food.totalPantrySoldWon, r.won, '★누계가 안 쌓인다');

  /* 0판을 팔라면 막는다 — 안내지 고장이 아니다 */
  assert.throws(() => sellPantryCrop(S, 0),
    (e) => e.tutorialInput === true && /골라/.test(e.message), '★0판을 안 막았다');
  /* 있는 것보다 많이 부르면 **있는 만큼**이다(던지지 않는다 — ＋ 를 오래 눌러도 안 깨진다) */
  const all = pantrySaleQuote(fp, 99);
  assert.equal(all.lots, 3, '★있는 것보다 많이 팔린다');       // ⚠ 2026-08-17 · 2 → 3
  ok('1판만 팔면 1판만 나가고, 남은 판·총액이 서로 맞는다');
}

console.log('\n== D. ★먼저 거둔 것부터 — 파는 순서와 먹는 순서가 같다 ==');
{
  const { fp } = sameDayHarvest(4);
  /* ⚠ 하루 몫을 여기서 숫자로 적지 않는다 — 계약에서 읽는다.
     (기본 계약에서는 4,867원이다: 콩나물 3,000 + 무순 1,867. 「3,000원」은 콩나물만 있을 때 값이다) */
  /* ⚠⚠ 2026-08-17 — `dailyCropSaveWonOf` 의 **단위가 바뀌었다**(first_play §몫):
     이제 「곳간에서 빠지는 물건 값」이 아니라 **「아낄 수 있는 밥값」**이다.
     곳간이 얼마나 줄었나를 재려면 `bite.pantryUsedWon` 을 읽어야 한다. */
  const daily = dailyCropSaveWonOf(fp);
  assert.ok(daily > 0);
  const bite = eatFromPantry(fp);
  const drained = bite.pantryUsedWon;
  assert.ok(drained > 0, '★곳간이 한 푼도 안 줄었다');
  const after = pantryLotsOf(fp);
  assert.equal(sumLots(fp), fp.food.pantryWon, '★먹은 뒤 판과 총액이 어긋났다');
  /* ⚠ 2026-08-16 — 여기 `after.length < 3` 이 박혀 있었다. 하루 몫이 4,867원일 때는
     첫 판(3,000)이 통째로 사라졌기 때문이다. 이제 하루 몫이 **300g(3,000원)** 이고
     첫 판이 **4,000원**이라, 먹어도 판 수는 안 준다 — 첫 판이 **깎일 뿐**이다.
     ⇒ 재는 것을 「판이 줄었나」에서 **「앞에서부터 줄었나」**(=FIFO)로 바로잡는다. */
  assert.ok(after.length <= 4, '★먹었는데 판이 늘었다');       // ⚠ 2026-08-17 · 3 → 4
  assert.ok(after.length < 4 || after[0].won < LOTS4[0],
    '★★먹었는데 맨 앞 판이 한 푼도 안 줄었다');
  assert.equal(sumLots(fp) + drained, SUM4, '★먹은 만큼 정확히 안 줄었다');
  assert.equal(after[after.length - 1].won, LOTS4[3],
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
  /* ⚠ 2026-08-17 — 여기서 쓰던 `dailyCropSaveWonOf`(하루 몫 · 원)가 이제 **밥값**이라
     곳간에 그대로 못 넣는다. 곳간에서 빠지는 것은 **한 몫의 g** 이다(§몫). */
  const chunkWon = RULES.dailyCropGrams * 10;    // 콩나물 한 몫(300g)의 물건 값
  fp.food.pantryLots = [];                       // 꾸러미 기록을 지우고
  fp.food.pantryWon = chunkWon + 1000;           // 한 몫보다 딱 1,000원 많게
  assert.equal(sumLots(fp), chunkWon + 1000, '★옛 판이 판으로 안 쪼개진다');
  eatFromPantry(fp);                             // 한 몫을 먹는다
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
  assert.equal(sumLots(fp), SUM4, '★옛 판의 곳간이 판으로 안 쪼개진다');
  assert.deepEqual(lots.map(l => l.won), splitByChunk(SUM4), '★하루치씩 안 쪼갰다');
  assert.ok(lots.every(l => l.kind === null),
    '★★무엇을 거둔 것인지 모르는데 작물 이름을 지어냈다');
  const S = stateWith(fp);
  const r = sellPantryCrop(S, 1);
  assert.equal(r.pendingWon, CHUNK);
  assert.equal(r.whatKo, '곳간에 있던 것 1판', `★모르는 것을 아는 척한다: ${r.whatKo}`);
  ok('옛 판(원만 있는 판)도 하루치씩 쪼개져 팔린다 — 작물 이름은 지어내지 않는다');
}

console.log('\n== F. ★★잉여 창구는 예전 그대로 — 곳간을 한 푼도 안 만진다 (★문을 연 판) ==');
{
  /* ⚠⚠ 2026-08-17 — **게임에서는 이 절이 잴 것이 없다.** 잉여가 늘 0 이라
     `cropSurplusStatus().pendingWon` 이 0 이고 `sellCropSurplus` 는 던진다.
     그래도 두 창구가 안 섞이는지는 여전히 지켜야 할 계약이라, **문을 열어**(§머리말 PEN)
     잉여가 나는 판을 만들어 잰다. 게임 규칙에서 잉여가 0 인 것은 `test_cropsale §K` 가 못 박는다. */
  const { fp } = sameDayHarvest(4, PEN);
  const S = newState({ firstPlay: true, firstPlayRules: PEN });
  S.firstPlay = fp;
  const before = fp.food.pantryWon;
  const lotsBefore = pantryLotsOf(fp).map(l => l.won);
  assert.ok(cropSurplusStatus(S).pendingWon > 0, '★문을 열었는데 잉여가 안 났다');
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

/* ══ ⚠⚠ 2026-08-17 — **이 절이 지키던 약속이 뒤집혔다** ═══════════════════════
     옛 약속 — *"곳간 판매가 = 잉여 판매가 = `cropSurplusSaleRate` **한 곳**. 값이 둘이 되면
       「어느 쪽으로 파는 게 이득인가」라는 없던 셈이 생긴다."*
     옛 단언 — `_meta` 에 0.4 를 넣으면 `pantrySaleQuote(fp).rate === 0.4` 다.
   박사님 확정문 §1 이 파는 값을 **작물마다** 정했다(콩나물 7원/g · 무순 8원/g).
   ⇒ 값이 하나일 수가 없다. 그런데 **원래 지키려던 것은 안 죽었다** — 걱정하던 것은
     「같은 물건을 두 창구가 다른 값에 산다」였고, 그건 여전히 안 일어난다.
   ⇒ 그래서 재는 자리를 옮겼다: **같은 작물이면 어느 창구로 가도 같은 값**인가 ·
     **작물이 다르면 다른 값**인가 · 섞이면 **낱개의 합**인가. */
console.log('\n== G. ★파는 값은 작물이 정한다 — 창구마다 갈리지는 않는다 ==');
{
  const { fp } = sameDayHarvest(4);
  const perG = CROP_KINDS[0].sellWonPerGram;
  const q1 = pantrySaleQuote(fp, 1);
  assert.equal(q1.won, q1.pendingGrams * perG,
    '★곳간 한 판 값이 작물 표(원/g)와 안 맞는다');
  assert.equal(q1.picked[0].wonPerGram, perG, '★줄에 실린 원/g 이 작물 표와 다르다');
  /* ★ 작물이 다르면 값도 다르다 — 그게 확정문이 정한 것이다 */
  assert.notEqual(CROP_KINDS[0].sellWonPerGram, CROP_KINDS[1].sellWonPerGram,
    '★두 작물의 파는 값이 같다 — 확정문 §1 이 7원/g · 8원/g 으로 갈랐다');
  /* ★★ 섞인 판 — 총액에 한 비율을 곱하지 않고 **낱개를 더한다**(§판매 ⚠) */
  const mixed = createFirstPlayState({ enabled: true, rules: RULES });
  mixed.food.pantryLots = [{ kind: 'beansprout', day: 1, won: 4000, meals: 3 },
                           { kind: 'musun', day: 1, won: 3000, meals: 3 }];
  mixed.food.pantryWon = 7000;
  const qm = pantrySaleQuote(mixed);
  assert.equal(qm.won, 400 * CROP_KINDS[0].sellWonPerGram + 300 * CROP_KINDS[1].sellWonPerGram,
    '★★섞인 판을 한 비율로 곱했다 — 줄마다 적힌 값의 합과 화면이 어긋난다');
  assert.ok(qm.rate > CROP_KINDS[0].sellWonPerGram / 10 &&
            qm.rate < CROP_KINDS[1].sellWonPerGram / 10,
    '★섞인 판의 실효 비율이 두 값 사이에 안 떨어진다');
  /* ★ 작물을 **모르는** 꾸러미(옛 세이브)는 전역 폴백을 쓴다 — 첫 작물 값이다 */
  const old = createFirstPlayState({ enabled: true, rules: RULES });
  old.food.pantryLots = [{ kind: null, day: null, won: 3000, meals: 0 }];
  old.food.pantryWon = 3000;
  assert.equal(pantrySaleQuote(old).won, Math.round(3000 * RULES.cropSurplusSaleRate),
    '★작물을 모르는 옛 꾸러미가 폴백 값으로 안 팔린다');
  ok(`파는 값은 작물 표 한 곳에 있다 — 콩나물 ${CROP_KINDS[0].sellWonPerGram}원/g · ` +
     `무순 ${CROP_KINDS[1].sellWonPerGram}원/g · 모르는 것은 폴백`);
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

console.log('\n== I. 그램 표기 — 한 함수가 만들고, 낱개를 더한 것과 합계가 맞는다 ==');
{
  /* 박사님: *"우측아래 G으로 나오다가 1000G 이상되면 1KG 으로 표현되게해줘"* */
  assert.equal(formatGram(0), '0g', '★0 을 빈칸으로 두면 「고장」으로 읽힌다');
  assert.equal(formatGram(400), '400g');
  assert.equal(formatGram(999), '999g', '★999g 까지는 g 이다');
  assert.equal(formatGram(1000), '1kg', '★1,000g 부터 kg 이다');
  assert.equal(formatGram(1200), '1.2kg', '★뒤 0 을 안 뗐다');
  /* ★★ **소수 두 자리**여야 낱개를 더한 것과 안 어긋난다.
     한 자리면 1,250g 이 `1.3kg` 가 되는데 그 판의 낱개는 400+400+450 이라 화면이
     스스로 모순된다. 두 자리면 콩나물(늘 10g 단위)에서는 반올림이 **아예 안 일어난다**. */
  assert.equal(formatGram(1250), '1.25kg', '★★kg 소수 두 자리가 아니다 — 합계가 낱개와 어긋난다');
  assert.equal(formatGram(12500), '12.5kg');
  assert.equal(formatGram(400 * 3), '1.2kg', '★낱개 셋을 더한 것과 합계가 다르다');
  ok(`formatGram — ${[0, 400, 999, 1000, 1200, 1250, 12500].map(formatGram).join(' · ')}`);
}

console.log('\n== J. ★★오늘 밥상 — 300g 까지 쓰고 남는 것은 쌓인다 (2026-08-16 박사님 확정) ==');
{
  /* 박사님: *"400G 가 오면 300G 까지는 당일 쓸 수 있는 거고 남는 거 팔아먹든 하는 거"* */
  const { fp } = sameDayHarvest(1);                 // 어두운 자리 한 시루 = 400g
  assert.equal(pantryGramsOf(fp), 400, '★한 시루가 400g 을 안 냈다');
  const q = mealPlanQuote(fp);
  assert.equal(q.defaultGrams, 300, '★디폴트가 300g 이 아니다');
  assert.equal(q.maxGrams, 300, '★★하루에 300g 보다 많이 쓸 수 있다 — 상한이 안 걸렸다');
  assert.equal(q.useWon, 3_000, '★300g 이 3,000원이 아니다 (10원 = 1g)');
  assert.equal(q.restGrams, 100, '★★남는 100g 을 안 세고 있다');
  /* 곳간이 300g 보다 적으면 **있는 만큼**이 디폴트다(박사님 괄호 그대로) */
  const small = { ...fp, food: { ...fp.food, pantryWon: 1_200, pantryLots: [] } };
  assert.equal(mealPlanQuote(small).defaultGrams, 120, '★곳간이 적을 때 디폴트가 있는 만큼이 아니다');

  /* ★ 고른 값이 실제로 먹히나 — 0g 을 고르면 **한 푼도 안 먹는다** */
  planMealGrams(fp, 0);
  const none = eatFromPantry(fp);
  assert.equal(none.savedWon, 0, '★★0g 을 골랐는데 먹었다 — 모아서 파는 길이 막힌다');
  assert.equal(fp.food.pantryWon, 4_000, '★안 먹었는데 곳간이 줄었다');
  assert.equal(fp.food.mealPlanWon, null, '★★고른 값을 안 지웠다 — 내일도 0g 을 먹는다');
  /* 안 고르면 **몫 규칙이 최선껏** 짠다 — 콩나물만 있으므로 첫 몫 하나(300g)다.
     ⚠⚠ 2026-08-17 — 옛 줄은 `full.savedWon === dailyCropSaveWonOf(fp)` 였다. 그 값의
       단위가 「곳간에서 빠지는 물건 값(3,000원)」에서 **「아낄 수 있는 밥값(5,000원)」**으로
       바뀌었다(§몫). 300g 을 먹으면 곳간은 3,000원 줄고 밥값은 **2,500원** 준다. */
  const full = eatFromPantry(fp);
  assert.equal(full.savedWon, RULES.cropMealPortionWon, '★안 골랐는데 첫 몫을 안 먹었다');
  assert.equal(full.savedGrams, 300);
  assert.equal(full.pantryUsedWon, 3_000, '★곳간에서 빠진 물건 값이 300g 어치가 아니다');
  assert.notEqual(full.savedWon, full.pantryUsedWon,
    '★밥값과 물건 값이 아직 같은 수다 — 두 단위가 안 갈렸다(§몫)');
  assert.equal(fp.food.pantryWon, 1_000, '★★남는 100g 이 사라졌다 — 쌓여야 한다');
  ok('400g 이 오면 300g 을 쓰고 100g 이 곳간에 남는다 · 0g 도 고를 수 있다');
}

/* ══ J-2. ★★ **몫** — 확정문 §1 을 그대로 밟는다 (2026-08-17 신설) ═══════════════ */
console.log('\n== J-2. ★★몫 — 첫 몫 2,500 · 다른 작물 둘째 몫 2,500 · 같은 작물 1,200 ==');
{
  const seed = (lots) => {
    const fp = createFirstPlayState({ enabled: true, rules: RULES });
    fp.food.pantryLots = lots.map(l => ({ ...l }));
    fp.food.pantryWon = lots.reduce((a, l) => a + l.won, 0);
    return fp;
  };
  const BEAN = (won) => ({ kind: 'beansprout', day: 1, won, meals: 3 });
  const MUSUN = (won) => ({ kind: 'musun', day: 1, won, meals: 3 });
  /* ① 첫 몫 — 콩나물 300g = 2,500원 */
  assert.equal(cropMealPlan(seed([BEAN(4000)])).savedWon, 2_500, '★콩나물 첫 몫');
  /* ② 둘째 몫이 **다른 작물**이면 또 2,500원 — 하루 최대 5,000원에 딱 닿는다 */
  const two = cropMealPlan(seed([BEAN(4000), MUSUN(3000)]));
  assert.equal(two.savedWon, 5_000, '★다른 작물로 채운 둘째 몫이 2,500원이 아니다');
  assert.equal(two.usedGrams, 500, '★콩나물 300g + 무순 200g 이 아니다');
  assert.equal(two.savedWon, RULES.cropMealCapWon, '★하루 최대가 끼니 상한과 안 맞는다');
  /* ③ 둘째 몫이 **같은 작물**이면 1,200원인데, 그건 파는 값보다 싸서 **안 먹는다**(§3) */
  const same = cropMealPlan(seed([BEAN(4000), BEAN(4000)]));
  assert.equal(same.portions.length, 1, '★같은 작물로 둘째 몫까지 먹었다 — 파는 게 낫다');
  assert.equal(same.savedWon, 2_500);
  /* ④ ★ **못 채운 몫은 비례로** — 150g 이면 그 절반(확정문 §1 ★) */
  const half = cropMealPlan(seed([BEAN(1500)]));
  assert.equal(half.savedWon, 1_250, '★못 채운 몫이 비례로 안 쳐진다 — 절벽이 생겼다');
  assert.equal(half.usedGrams, 150);
  const musunHalf = cropMealPlan(seed([MUSUN(1000)]));   // 무순 100g = 몫의 절반
  assert.equal(musunHalf.savedWon, 1_250, '★무순 쪽 비례가 안 맞는다');
  /* ⑤ 무순만 있어도 첫 몫은 온전하다 — 200g 에 2,500원(12.50원/g) */
  assert.equal(cropMealPlan(seed([MUSUN(3000)])).savedWon, 2_500, '★무순 첫 몫');
  assert.equal(cropMealPlan(seed([MUSUN(3000)])).usedGrams, 200, '★무순 한 몫이 200g 이 아니다');
  ok('첫 몫 2,500 · 다른 작물 둘째 2,500 · 같은 작물 둘째는 파는 게 나아 안 먹는다 · 비례 성립');
}

console.log('\n== K. ★세이브 — 「안 골랐다(null)」와 「0g 을 골랐다(0)」가 갈린다 ==');
{
  const S2 = newState({ firstPlay: true, firstPlayRules: RULES });
  S2.firstPlay = sameDayHarvest(1).fp;
  planMealGrams(S2.firstPlay, 0);
  const back = deserialize(JSON.stringify(serialize(S2)), { firstPlayRules: RULES });
  assert.equal(back.firstPlay.food.mealPlanWon, 0,
    '★★0g 을 골랐는데 저장을 못 넘겼다 — 새로고침 한 번에 3,000원을 먹는다');
  planMealGrams(S2.firstPlay, null);
  const back2 = deserialize(JSON.stringify(serialize(S2)), { firstPlayRules: RULES });
  assert.equal(back2.firstPlay.food.mealPlanWon, null, '★안 고른 것이 0 으로 바뀌었다');
  ok('null(안 골랐다)과 0(안 먹기로 골랐다)이 저장을 넘어서도 갈린다');
}

console.log(`\n★ tools/test_pantrysale.mjs — ${n}벌 전부 통과\n`);
