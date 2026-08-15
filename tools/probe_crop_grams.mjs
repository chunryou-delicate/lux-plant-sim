/* ============================================================
   tools/probe_crop_grams.mjs — **g 셈이 살림을 얼마나 움직이나** (2026-08-16 신설)
   ------------------------------------------------------------
     node tools/probe_crop_grams.mjs

   박사님이 셈을 바꾸셨다:
     · 콩나물 수확량 = 중간빛 **300g** 기준 ±100g  (어두움 400 / 중간 300 / 밝음 200)
     · 10원 = 1g
     · 하루에 쓸 수 있는 양 = **300g**(3,000원) — 작물 통틀어
     · **남는 것은 안 버려진다.** 곳간에 쌓이고 팔 수 있다(0.85배)

   ⚠ **하루 절감만 보면 줄었다**(4,867 → 3,000원). 그런데 남는 것이 팔리므로
     총합이 늘었는지 줄었는지는 **판을 굴려 봐야 안다.** 이 프로브가 그 일을 한다.

   ★★ **손으로 쓴 모의 계산이 아니다.** 옛 셈도 새 셈도 **같은 엔진**(first_play.js)으로
     돌린다 — 규칙 사본만 갈아 끼운다. 그래야 「자가 딴 세상 것」이 안 된다
     (START-HERE §2.9 ④ 가 그 사고다).

   옛 셈을 어떻게 되살렸나 — 규칙 사본 셋을 바꾼다:
     ① `cropKindDefs`   그램 표를 뺀 사본 → 회전분이 옛 비율 셈(3,000/2,000/1,000)으로 돌아간다
     ② `dailyCropSaveWon` 4,867원(= min(회전분 합, 끼니 상한))
     ③ `pantryCapEnabled` true → 곳간 한도와 「쉰 몫」이 살아난다
============================================================ */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  firstPlayRulesFromBalance, createFirstPlayState, makeCropPot,
  placeBeansprout, waterBeansprout, advanceBeansproutDay, harvestBeansprout,
  eatFromPantry, resowBeansprout, cropCycleSavedWon, cropSurplusRateOf,
  takeCropSurplus, cropSurplusQuote, dailyCropSaveWonOf, gramsOfWon, formatGram
} from '../src/game/first_play.js';

const BALANCE = JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8'));
const NEW = firstPlayRulesFromBalance(BALANCE);
const RATE = NEW.cropSurplusSaleRate;
const CYCLE = NEW.harvestDays;
const DARK = 0.2;            // 콩나물 최상 품질(하얗고 아삭)이 나오는 어두운 자리

/* 옛 셈 — 그램 표를 뺀 종류 사본 + 옛 하루 몫 + 곳간 한도 */
const OLD_DEFS = NEW.cropKindDefs.map(d => {
  const { gramsPerCycle, gramsMidMeals, gramsPerQualityStep, ...rest } = d;
  return Object.freeze(rest);
});
const OLD = Object.freeze({
  ...NEW,
  cropKindDefs: Object.freeze(OLD_DEFS),
  dailyCropSaveWon: Math.min(NEW.cropSavedWonPerCycle,
                             NEW.dailyCropMealCap * (NEW.dailyFoodWon / NEW.mealsPerDayPerPerson || 1)),
  pantryCapEnabled: true
});
/* ⚠ 위 `dailyCropSaveWon` 을 **재서 확인한다** — 옛 값이 4,867원이 아니면 이 표가 통째로 거짓이다 */
const OLD_DAILY = Math.min(NEW.cropSavedWonPerCycle,
                           NEW.dailyCropMealCap * (NEW.dailyFoodWon / 2));
const OLD_RULES = Object.freeze({ ...OLD, dailyCropSaveWon: OLD_DAILY });
assert.equal(OLD_RULES.dailyCropSaveWon, 4867, `옛 하루 몫이 4,867원이 아니다: ${OLD_RULES.dailyCropSaveWon}`);
assert.equal(cropCycleSavedWon(OLD_RULES, 3, 0, 0), 3000, '옛 회전분이 3,000원이 아니다');
assert.equal(cropCycleSavedWon(NEW, 3, 0, 0), 4000, '새 회전분이 4,000원이 아니다');

/* ══ 한 판을 days 일 굴린다 ═══════════════════════════════════════════════
   ★ **시차를 둔다** — 시루 n개를 하루씩 걸러 물을 준다(박사님 그림 · §겹침).
     겹치게 굴리면 질림이 물려서 두 셈을 비교하는 축이 흐려진다.
   ★ 매일 하는 일: ① 오늘 익은 것을 거둔다 ② 거둔 시루를 다시 심고 물을 준다
     ③ 밥을 먹는다(eatFromPantry) ④ 하루가 간다
   ⚠ 씨앗값은 **뺀다** — 두 셈이 회전 수가 같으면 같은 값이라 표에 안 실어도 되지만,
     회전 수가 갈리면 갈리므로 세어서 같이 낸다. */
function run(rules, sirus, days, opt = {}) {
  const stagger = opt.stagger !== false;
  const fp = createFirstPlayState({ enabled: true, rules });
  for (let i = 2; i <= sirus; i++) fp.beansprout.pots.push(makeCropPot('crop_01_0' + i));
  placeBeansprout(fp, 'dark-slot');
  let ate = 0, sold = 0, harvests = 0, spoiled = 0, lost = 0;
  const seedRate = rules.cropSurplusSaleRate;
  for (let day = 0; day < days; day++) {
    /* ① 오늘 익은 것을 거둔다 */
    const ripe = fp.beansprout.pots.filter(p => !p.harvested && p.startedOnDay != null &&
                                                p.ageDays >= rules.harvestDays);
    if (ripe.length) {
      const h = harvestBeansprout(fp, { day });
      harvests += h.harvestedPots;
      spoiled += h.spoiledWon;
      lost += h.overlapLostWon;
      resowBeansprout(fp, { day });
    }
    /* ② 시차면 **하루에 하나씩**, 아니면 **한꺼번에** 시작한다(겹침 판) */
    if (stagger) waterBeansprout(fp, day);
    else waterBeansprout(fp, day, { all: true });
    /* ③ 밥 — 하루 몫만큼 곳간에서 꺼낸다 */
    ate += eatFromPantry(fp).savedWon;
    /* ④ 하루가 간다 */
    advanceBeansproutDay(fp, DARK);
  }
  /* ⑤ 끝나고 남은 것을 판다 — 곳간에 쌓인 재고 + 잉여(못 챙긴 몫) */
  const q = cropSurplusQuote(fp);
  if (q.canSell) { sold += takeCropSurplus(fp).won; }
  const restWon = Math.max(0, Math.round(fp.food.pantryWon || 0));
  const restSold = Math.round(restWon * seedRate);
  return {
    ate, sold, restWon, restGrams: gramsOfWon(restWon), restSold,
    harvests, spoiled, lost,
    total: ate + sold + restSold
  };
}

const DAYS = 30;
const won = n => Math.round(n).toLocaleString('ko-KR');
console.log(`\n★ 30일 · 시차(하루씩 어긋나게 물주기) · 어두운 자리(최상 품질) · 씨앗값은 안 뺐다`);
console.log(`  옛 셈  회전분 3,000/2,000/1,000원 · 하루 몫 ${won(OLD_RULES.dailyCropSaveWon)}원 · 곳간 한도 있음(쉰다)`);
console.log(`  새 셈  회전분 4,000/3,000/2,000원(400/300/200g) · 하루 몫 ${won(NEW.dailyCropSaveWon)}원(300g) · 곳간 한도 없음(쌓인다)`);
console.log(`  판 값  ${Math.round(RATE * 100)}% (두 셈이 같은 값을 쓴다)\n`);

const head = ['시루', '셈', '밥값 절감', '판 잉여', '남은 재고', '남은 것 팔면', '합계', '거둔 회전', '쉰 몫'];
const rows = [];
for (const n of [1, 3, 5]) {
  const o = run(OLD_RULES, n, DAYS);
  const w = run(NEW, n, DAYS);
  rows.push([`${n}개`, '옛', won(o.ate), won(o.sold), `${formatGram(o.restGrams)}`, won(o.restSold), won(o.total), o.harvests, won(o.spoiled)]);
  rows.push([`${n}개`, '새', won(w.ate), won(w.sold), `${formatGram(w.restGrams)}`, won(w.restSold), won(w.total), w.harvests, won(w.spoiled)]);
  const d = w.total - o.total;
  rows.push([`${n}개`, '차', '', '', '', '',
             `${d >= 0 ? '+' : ''}${won(d)} (${o.total ? ((w.total / o.total - 1) * 100).toFixed(1) : '—'}%)`, '', '']);
}
function table(head, rows) {
  const wcol = head.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)));
  const line = (r) => '  ' + r.map((c, i) => String(c).padStart(wcol[i])).join(' | ');
  console.log(line(head));
  console.log('  ' + wcol.map(w => '-'.repeat(w)).join('-+-'));
  for (const r of rows) console.log(line(r));
  console.log('');
}
table(head, rows);

/* ══ 겹침 판 — 시루를 **같은 날 한꺼번에** 굴린다 ═══════════════════════════
   ★ 여기가 옛 셈에서 「쉰 몫」과 「잉여」가 나던 자리다. 새 셈에서는 안 쉰다. */
console.log('★ 같은 판을 **겹치게** 굴린 것 (물을 한꺼번에 준다 — 질림이 물린다)');
console.log('');
const rows2 = [];
for (const n of [1, 3, 5]) {
  const o = run(OLD_RULES, n, DAYS, { stagger: false });
  const w = run(NEW, n, DAYS, { stagger: false });
  rows2.push([`${n}개`, '옛', won(o.ate), won(o.sold), `${formatGram(o.restGrams)}`, won(o.restSold), won(o.total), o.harvests, won(o.spoiled)]);
  rows2.push([`${n}개`, '새', won(w.ate), won(w.sold), `${formatGram(w.restGrams)}`, won(w.restSold), won(w.total), w.harvests, won(w.spoiled)]);
  const d = w.total - o.total;
  rows2.push([`${n}개`, '차', '', '', '', '',
             `${d >= 0 ? '+' : ''}${won(d)} (${o.total ? ((w.total / o.total - 1) * 100).toFixed(1) : '—'}%)`, '', '']);
}
table(head, rows2);

/* ══ 품질 세 칸이 원으로 얼마인가 — 전·후 ═══════════════════════════════ */
console.log('★ 품질 세 칸의 한 회전분 (겹침 없음)');
console.log('');
table(['품질', '옛(원)', '새(g)', '새(원)', '차'],
  [['하얗고 아삭(3끼)', 3, ], ['살짝 초록(2끼)', 2], ['초록·쓴맛(1끼)', 1]]
    .map(([ko, m]) => {
      const a = cropCycleSavedWon(OLD_RULES, m, 0, 0), b = cropCycleSavedWon(NEW, m, 0, 0);
      return [ko, won(a), formatGram(gramsOfWon(b)), won(b), `${b >= a ? '+' : ''}${won(b - a)}`];
    }));
