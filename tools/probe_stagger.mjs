/* ============================================================
   tools/probe_stagger.mjs — **시루를 늘리면 는가 · 어긋나게 두면 는가**
   ------------------------------------------------------------
   ⚠ 왜 새로 짓나 — `probe_crop_cycle.mjs ①·③` 이 이상한 값을 냈다:
     시루 1개~6개가 **절감도 「수확 6시루」도 전부 같았다.** 읽어 보니 그 자는
     `waterBeansprout(fp, shown)` 을 `{all:true}` 없이 부르는데, 그러면 `first_play.js:1962`
     에 적힌 대로 **하루에 한 시루만** 시작한다. ⇒ 몇 개를 놓든 하나씩만 돌았을 수 있다.
   ⛔ **남의 자를 고치지 않는다.** 같은 함수를 불러 **내 자로 따로 잰다.**
     그래야 「저 자가 틀렸다」가 아니라 **「이 값이 이렇더라」**를 낼 수 있다.

   ★ 재는 것 둘
     ① 시루를 늘리면 절감이 느나 — **모든 시루에 물을 준다**(`{all:true}`)
     ② 같은 날 다 심기 vs 하루씩 어긋나게 — **둘 다 모든 시루가 돌게** 해 놓고 견준다
   ⚠ 하루 차례는 `probe_crop_cycle` 머리말 그대로다 —
     [물주기](어제 날짜) → [다음 날](하루가 가고 곳간에서 한 입) → [수확] → [다시 심기]
     이 차례를 틀리면 회전이 5일이 아니라 6일로 나온다(오늘 실제로 그 흠을 하네스에서 봤다).

     node tools/probe_stagger.mjs
============================================================ */
import { readFileSync } from 'node:fs';
import { createFirstPlayState, firstPlayRulesFromBalance, placeBeansprout,
         advanceBeansproutDay, harvestBeansprout, eatFromPantry, resowBeansprout,
         waterBeansprout, beansproutReady, makeCropPot } from '../src/game/first_play.js';
import { buyPriceOf } from '../src/game/shop.js';

const R = firstPlayRulesFromBalance(JSON.parse(readFileSync('./data/balance/characters.json', 'utf8')));
const SEED_BUY = buyPriceOf('bean_seed');
console.log(`규칙 — 자라는 날 ${R.harvestDays}일 · 하루 상한 ${R.dailyCropSaveWon.toLocaleString()}원 · ` +
            `한 회전 담김 ${R.cropSavedWonPerCycle.toLocaleString()}원 · 씨앗 사는 값 ${SEED_BUY}원`);

/* stagger: 0 = 첫날 «다» 물 준다 · 1 = 하루에 하나씩 (다 시작될 때까지) */
function run({ sirus = 1, dli = 0.05, days = 30, stagger = 0 }) {
  const fp = createFirstPlayState({ enabled: true, rules: R });
  /* ⚠⚠⚠ **차례가 답을 가른다.** 시루를 만들어 넣고 **그 뒤에** 놓아야 한다.
     먼저 놓고 나중에 밀어 넣으면 새 시루는 `slotId`·`at` 이 없어 `cropPotPlaced` 가 거짓이고,
     `advanceBeansproutDay` 가 `placedCropPots` 만 돌리므로 **영영 안 자란다.**
     ⇒ ★ 그래서 「시루를 몇 개 놓든 값이 똑같은」 헛것이 난다. 실제로 그렇게 났다
       (`probe_crop_cycle ①` 도 같은 차례라 같은 값이 나온 것으로 보인다 — 남의 자라 안 고쳤다).
     ★ `placeCrop` 은 `opt.potId` 를 안 주면 **그 자리의 시루를 전부** 옮긴다. 그래서 한 번이면 된다. */
  for (let i = 2; i <= sirus; i++) fp.beansprout.pots.push(makeCropPot('crop_01_' + String(i).padStart(2, '0')));
  placeBeansprout(fp, 'dark');
  {
    const placed = fp.beansprout.pots.filter(p => p.slotId || p.at).length;
    if (placed !== sirus) throw new Error(`[자] 시루 ${sirus}개를 놓으려 했는데 ${placed}개만 놓였습니다 — 답이 헛것이 됩니다`);
  }
  let total = 0, harvests = 0, seed = 0;
  for (let d = 1; d <= days; d++) {
    const shown = d - 1;
    /* ★ 여기가 남의 자와 다른 곳이다 — **쉬고 있는 시루에 «다» 물을 준다.**
       어긋나게 두는 판에서도 «하루에 하나씩 계속» 주므로 결국 다 돈다. */
    if (stagger === 0) waterBeansprout(fp, shown, { all: true });
    else waterBeansprout(fp, shown);
    advanceBeansproutDay(fp, dli);
    total += eatFromPantry(fp).foodSavedWon;
    if (beansproutReady(fp.beansprout)) {
      const ev = harvestBeansprout(fp, { day: d });
      harvests += ev.harvestedPots;
      seed += resowBeansprout(fp, { day: d }).resown * SEED_BUY;
    }
  }
  /* ★ 곳간에 «남은 것» — 끼니가 못 먹고 쌓인 몫이다. 이것이 「팔 수 있는 것」이다. */
  const left = Math.max(0, Math.round((fp.food && fp.food.pantryWon) || 0));
  return { total, harvests, seed, net: total - seed, left };
}

const show = (ko, r, days = 30) =>
  console.log(`  ${ko.padEnd(16)}| 30일 절감 ${String(r.total.toLocaleString()).padStart(8)}원 · ` +
              `하루평균 ${String(Math.round(r.total / days).toLocaleString()).padStart(6)}원 · ` +
              `수확 ${String(r.harvests).padStart(3)}시루 · 씨앗 ${r.seed.toLocaleString()}원 · ` +
              `순액 하루평균 ${Math.round(r.net / days).toLocaleString()}원`);

console.log('\n① 시루를 늘리면 느나 — ★ 모든 시루에 물을 준다 (30일 · 어두운 자리)');
for (const n of [1, 2, 3, 5, 8, 12, 16, 22]) show(`시루 ${n}개`, run({ sirus: n, stagger: 0 }));

console.log('\n② 같은 날 다 심기 vs 하루씩 어긋나게 (30일 · 어두운 자리)');
for (const n of [5, 16]) {
  show(`${n}개 · 같은 날`, run({ sirus: n, stagger: 0 }));
  show(`${n}개 · 하루씩`, run({ sirus: n, stagger: 1 }));
}
console.log('\n⚠ ①이 어느 개수에서 «멎는지»가 곧 「하루 상한이 언제 차나」다.');

/* ══ ★★★★ ③ **몇 개면 흑자인가** — 「열여섯이면 버틴다」를 정면으로 잰다 ═══════════
   ⚠ 위 ①·②는 **밥값 절감만** 잰다. 그런데 실제 판을 가른 것은 «팔기»였다(실측 d90 +21만).
     ⇒ ★ 그래서 여기서는 **끼니가 못 먹고 곳간에 남은 몫을 판 것**까지 넣는다.
   셈에 넣는 것 — **전부 규칙에서 읽는다. 수를 안 박는다:**
     지출  월세/일 = rentWon / rentPeriodDays   ·   끼니 = mealCostWon × 끼니 수
     수입  절감(곳간이 끼니를 덮은 몫) + 남은 곳간 × 파는 비율  −  씨앗값
   ⚠ 「끼니 수」는 `dailyCropSaveWon ÷ mealCostWon` 에서 나온다 — 손으로 안 적는다.
   ⚠⚠ 이 셈에 **없는 것**: 손(체력) 한도 · 등값·전기 · 무늬 잎 팔기 · 무순.
     ⇒ ★ 그러니 이 표는 **「밥과 콩나물만으로 살림이 되나」**를 재는 것이지 판 전체가 아니다. */
const { TUTORIAL_RULES } = await import('../src/game/tutorial.js');
const RENT_DAY = TUTORIAL_RULES.rentWon / TUTORIAL_RULES.rentPeriodDays;
const MEALS = Math.max(1, Math.round(R.dailyCropSaveWon / TUTORIAL_RULES.mealCostWon));
const LIVING = TUTORIAL_RULES.mealCostWon * MEALS;
const SALE = R.cropSurplusSaleRate;
console.log(`\n③ ★ 몇 개면 흑자인가 (30일 · 어두운 자리 · 같은 날 다 심기)`);
console.log(`   지출 — 월세 ${Math.round(RENT_DAY).toLocaleString()}원/일 + 끼니 ` +
            `${TUTORIAL_RULES.mealCostWon.toLocaleString()}×${MEALS} = ${LIVING.toLocaleString()}원/일 ` +
            `⇒ 합 ${Math.round(RENT_DAY + LIVING).toLocaleString()}원/일 · 파는 비율 ${Math.round(SALE * 100)}%`);
for (const n of [2, 5, 8, 12, 16, 20, 25, 30, 40, 60]) {
  const r = run({ sirus: n, stagger: 0 });
  const earn = (r.total + r.left * SALE - r.seed) / 30;
  const day = earn - RENT_DAY - LIVING;
  console.log(`  시루 ${String(n).padStart(2)}개 | 절감 ${String(Math.round(r.total / 30)).padStart(5)}` +
              ` + 팔기 ${String(Math.round(r.left * SALE / 30)).padStart(6)}` +
              ` − 씨앗 ${String(Math.round(r.seed / 30)).padStart(5)}` +
              ` ⇒ 벌이 ${String(Math.round(earn)).padStart(6)}원/일` +
              ` ⇒ ★ 하루 ${String(Math.round(day)).padStart(7)}원` + (day >= 0 ? '  ✔ 흑자' : ''));
}
