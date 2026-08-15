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

   ══ ⚠⚠⚠ 2026-08-17 밤 — **이 프로브가 재는 「후」는 이제 그날의 후가 아니다** ═════════
   확정문(`docs/handoff/plan-2026-08-17-crop-balance.md`)이 붙으면서 밥이 **「몫」**으로 바뀌었다
   (첫 몫 2,500 · 같은 작물 둘째 1,200 · 하루 최대 5,000). 이 파일의 「후」 칸은 **지금 엔진**을
   그대로 돌리므로 그 새 규칙으로 나온다 — 즉 이 표의 전·후 차이에는 **두 변경이 섞여 있다.**
   ⇒ **지금 셈의 살림 표는 `tools/probe_crop_balance.mjs` 가 정본이다.** 이 파일은
     2026-08-16·17 두 날의 기록으로 남긴다(옛 규칙 사본은 아래에 값으로 박아 뒀다).
   ⇒ 아래 「85%」·「하루 300g」 같은 머리말 문구도 그날의 값이다. 지금 값이 아니다.

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
  takeCropSurplus, cropSurplusQuote, dailyCropSaveWonOf, gramsOfWon, formatGram,
  /* ★ 2026-08-17 · 겹침 — 곳간에서 파는 창구(잉여가 0 이 되면서 이쪽이 정본이 됐다) */
  pantrySaleQuote, takePantryCrop, overlapSavedWon
} from '../src/game/first_play.js';
/* ★ 2026-08-17 — **살림(지갑)까지 굴린다.** 파산일·잔액은 밥값 절감만으로는 못 잰다:
   월세·하루 지출·씨앗값이 같이 나가야 「며칠에 마르나」가 나온다. */
import { createTutorialState, tutorialDay } from '../src/game/tutorial.js';
import { buyPriceOf } from '../src/game/shop.js';

const BALANCE = JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8'));
const NEW = firstPlayRulesFromBalance(BALANCE);
const RATE = NEW.cropSurplusSaleRate;
const CYCLE = NEW.harvestDays;
const DARK = 0.2;            // 콩나물 최상 품질(하얗고 아삭)이 나오는 어두운 자리

/* 옛 셈 — 그램 표를 뺀 종류 사본 + 옛 하루 몫 + 곳간 한도
   ⚠⚠ **2026-08-17 밤 — 이 「옛 셈」을 유도로 못 세우게 됐다.** 확정문(§1·§6)이 붙으면서
     ① 무순 회전분이 2,800 → 2,000 이 되고 ② 질림(×2/3)이 걷혀서, 지금 규칙에서 옛 식을
     다시 돌리면 4,867 이 아니라 5,000 이 나온다.
   ⇒ **2026-08-16 당시의 값을 그대로 박는다.** 이 표는 그날의 전·후를 재는 **역사 기록**이고,
     지금 규칙에서 유도하면 「자가 딴 세상 것」이 된다(START-HERE §2.9 ④).
   ★ 지금 셈의 살림 표는 여기가 아니라 `tools/probe_crop_balance.mjs` 가 낸다. */
const OLD_DEFS = NEW.cropKindDefs.map((d, i) => {
  const { gramsPerCycle, gramsMidMeals, gramsPerQualityStep, ...rest } = d;
  /* 2026-08-16 당시의 작물 기본값 — 콩나물 3,000 · 무순 **2,800**(질림 전) */
  return Object.freeze({ ...rest, savedWonPerCycle: i === 1 ? 2_800 : 3_000 });
});
const OLD = Object.freeze({
  ...NEW,
  cropKindDefs: Object.freeze(OLD_DEFS),
  cropBaseSavedWon: Object.freeze([3_000, 2_800, 2_800]),
  cropKindSavedWon: Object.freeze([3_000, 1_867, 933]),   // 기본값 × 질림 (그때 셈)
  pantryCapEnabled: true
});
const OLD_DAILY = 4_867;                                  // 3,000 + 1,867 (2026-08-16 실측값)
const OLD_RULES = Object.freeze({ ...OLD, dailyCropSaveWon: OLD_DAILY });
assert.equal(cropCycleSavedWon(OLD_RULES, 3, 0, 0), 3000, '옛 회전분이 3,000원이 아니다');
/* ⚠⚠ 2026-08-18 — 여기 **4000** 이 박혀 있었다(콩나물 최상 400g · 2026-08-16 의 그 값).
   박사님이 수확량 눈금을 넓히셔서(*"콩나물은 200-500"* · first_play §그램) 최상이 **500g** 이다.
   ★ 이 줄이 지키는 것은 「4,000」이 아니라 **「옛 셈과 새 셈이 서로 안 섞였다」**이다 —
     옛 쪽(3,000)이 안 움직이는 것이 이 두 줄의 요지다. 그래서 새 쪽은 **엔진에서 읽는다.**
   ⚠ 그러니 **아래 표의 「후」는 2026-08-16 의 후가 아니다**(이 파일 머리말이 경계한 그것) —
     지금 규칙의 값이다. 08-16 의 전·후를 다시 보려면 그날 커밋에서 이 도구를 돌려라. */
const NEW_FULL = cropCycleSavedWon(NEW, 3, 0, 0);
assert.equal(NEW_FULL, NEW.cropKindDefs[0].gramsPerCycle * 10 +
                       NEW.cropKindDefs[0].gramsPerQualityStep * 10,
  `새 회전분(${NEW_FULL}원)이 콩나물 그램 표와 안 맞는다`);

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

/* ══════════════════════════════════════════════════════════════════════════
   ★★★ 2026-08-17 — **겹침의 벌을 걷었다. 전·후를 잰다** (박사님 확정)
   ------------------------------------------------------------------------
   원문: *"내가 수확할 때 300G을 기준으로 하라는 건 **하루 수확량을 개수에 따라 조절하라는
   게 아니었는데**… 식량으로 사용할 수 있는 G수를 조절하란 거지.. 최대 300G로."*

   ★★ **여기서도 손으로 세지 않는다.** 「전」은 규칙 사본에 문 하나를 열어 만든다 —
     `cropOverlapTiredEnabled: true` (first_play §겹침 이 남긴 문). 같은 엔진이 두 번 돈다.
   ⚠ 위쪽 표의 `OLD_RULES`(2026-08-16 의 「옛 셈」)와 **다른 것**이다. 여기서 재는 전·후는
     둘 다 **g 셈·곳간 한도 없음** 위에 있고, 갈리는 것은 **겹침의 벌 하나**다.
     안 그러면 두 변경이 섞여 어느 쪽이 얼마를 움직였는지 못 가른다.
   ══════════════════════════════════════════════════════════════════════ */
const PEN = Object.freeze({ ...NEW, cropOverlapTiredEnabled: true });   // 전(벌 있음)
const NOPEN = NEW;                                                     // 후(벌 없음 · 지금 게임)
/* ⚠ 2026-08-18 — 여기 **2670 · 4000** 이 박혀 있었다(최상 400g 시절: 400 × 2/3 = 267g).
   최상이 500g 이 되면서 3,330 · 5,000 이다. ★ 이 두 줄이 지키는 것은 두 수가 아니라
   **「문을 열면 벌이 돌아오고, 닫으면 안 물린다」**이므로 그 관계로 잰다(§2.8). */
const FULL1 = overlapSavedWon(NOPEN, 3, 0, 0);            // 그날 첫째 — 온전한 한 회전분
assert.equal(overlapSavedWon(PEN, 3, 1, 0), Math.round(FULL1 / 10 * 2 / 3) * 10,
  '문을 열었는데 옛 겹침 셈이 안 돌아온다');
assert.equal(overlapSavedWon(NOPEN, 3, 1, 0), FULL1, '벌이 아직 물린다');

console.log('\n\n' + '═'.repeat(78));
console.log('★★★ 2026-08-17 — 겹침의 벌을 걷은 전·후');
console.log('═'.repeat(78));

/* ══ ① 하루 수확 — 같은 날 N개를 거두면 몇 g 이 손에 드나 ═══════════════════ */
console.log('\n★ ① 하루 수확 — 어두운 자리(최상 품질) · 같은 날 N개를 거둔다');
console.log('  ⚠ 「곳간에 든 양」이다. 그중 **먹는 것은 하루 300g** 뿐이고 나머지는 재고다.\n');
function harvestDay(rules, n) {
  const fp = createFirstPlayState({ enabled: true, rules });
  for (let i = 2; i <= n; i++) fp.beansprout.pots.push(makeCropPot('crop_01_' + String(i).padStart(2, '0')));
  placeBeansprout(fp, 'dark-slot');
  waterBeansprout(fp, 0, { all: true });
  for (let d = 1; d <= CYCLE; d++) advanceBeansproutDay(fp, DARK);
  const h = harvestBeansprout(fp, { day: CYCLE });
  const g = h.perPot.reduce((a, p) => a + p.grams, 0);
  return { g, each: h.perPot.map(p => p.grams), lost: h.lostGrams };
}
table(['같은 날 거둔 개수', '전(벌 있음)', '개당', '후(벌 없음)', '개당', '전 · 못 챙긴 몫'],
  [1, 2, 3, 4, 5, 6].map(n => {
    const a = harvestDay(PEN, n), b = harvestDay(NOPEN, n);
    return [`${n}개`, formatGram(a.g), a.each.join('/') + 'g',
            formatGram(b.g), b.each.join('/') + 'g', formatGram(a.lost)];
  }));
console.log('  ★ 지시서가 짚은 자리: **시루 12개 · 5개 거둔 날** — 전 ' +
            formatGram(harvestDay(PEN, 5).g) + ' → 후 ' + formatGram(harvestDay(NOPEN, 5).g) + '\n');

/* ══ ② 살림 — 파산일과 200일 잔액 ═══════════════════════════════════════════
   ★★ **무엇을 켜고 무엇을 껐나** (START-HERE §2 첫째 규칙)
     · 방 · 자리   반지하 · 어두운 자리 하나(최상 품질 400g). 3D·조도는 안 켠다(고정 DLI 0.2)
     · 지갑        `tutorial.createTutorialState` 그대로 — 시작돈 1,500,000 · 월세 200,000(30일마다)
                   · 하루 지출 `dailyCashOutWon` = 10,000원 · **식물등 없음**(전기 0)
     · 씨앗값      거둔 시루를 다시 심을 때마다 **실구매 500원**(`shop.buyPriceOf`)이 지갑에서 나간다
     · 시루값      ⚠ **안 뺐다.** 처음부터 N개를 갖고 시작한 것으로 본다
                   (24개를 더 사면 120,000원이다 — 이 표에 없는 돈이다)
     · 손          하루에 **최대 5개**만 물을 준다(체력 5). 5일 주기 × 5 = **25개가 천장**
     · 파는 값     85% (`cropSurplusSaleRate`)
     · 파는 방식   두 벌을 다 잰다 — ㉠ **다 팔기**(곳간을 매일 비운다)
                   ㉡ **하루 몫은 남기고 팔기**(내일 먹을 300g 을 남긴다)
   ⚠ 몬스테라·삽수·상점·계절은 **안 켰다.** 이 표가 재는 것은 「채소만으로 며칠 버티나」다. */
const DAYS_LONG = 200;
const SEED_WON = buyPriceOf('bean_seed');
function live(rules, sirus, opt = {}) {
  const days = opt.days || DAYS_LONG;
  const keepMeal = opt.keepMeal === true;
  const fp = createFirstPlayState({ enabled: true, rules });
  for (let i = 2; i <= sirus; i++)
    fp.beansprout.pots.push(makeCropPot('crop_01_' + String(i).padStart(2, '0')));
  placeBeansprout(fp, 'dark-slot');
  const ts = createTutorialState({ enabled: true });
  const cap = dailyCropSaveWonOf(fp);
  let brokeDay = null, cashAtEnd = 0, ate = 0, sold = 0, seedSpent = 0, harvests = 0;
  for (let day = 0; day < days; day++) {
    /* ① 오늘 익은 것을 다 거둔다 → 다시 심는다(씨앗값이 지갑에서 나간다) */
    const ripe = fp.beansprout.pots.filter(
      p => !p.harvested && p.startedOnDay != null && p.ageDays >= rules.harvestDays);
    if (ripe.length) {
      harvestBeansprout(fp, { day });
      harvests += ripe.length;
      resowBeansprout(fp, { day });
      seedSpent += ripe.length * SEED_WON;
      ts.cashWon -= ripe.length * SEED_WON;
    }
    /* ② 물 — **하루 다섯 개까지**(체력 5). 이것이 시루 수의 실제 천장을 만든다 */
    waterBeansprout(fp, day, { count: 5 });
    /* ③ 밥 — 하루 몫만큼 곳간에서 꺼낸다 */
    const bite = eatFromPantry(fp);
    ate += bite.savedWon;
    /* ④ 남는 것을 판다 */
    let guard = 0;
    while (guard++ < 200) {
      const q = pantrySaleQuote(fp, 1);
      if (!q.canSell) break;
      if (keepMeal && fp.food.pantryWon - q.pendingWon < cap) break;
      const r = takePantryCrop(fp, 1);
      sold += r.won; ts.cashWon += r.won;
    }
    /* ⚠⚠ **여기가 이 표의 갈림길이다.** 「전」에서 겹쳐 못 받은 몫은 버려진 것이 아니라
       `surplusWon` 에 쌓여 **[상점]에서 85%에 팔린다.** 그것을 팔면 전·후의 살림이 거의
       같아지고(재서 확인했다), 안 팔면 그만큼이 통째로 손해다. ⇒ 두 경우를 다 잰다. */
    if (opt.sellSurplus !== false) {
      const sq = cropSurplusQuote(fp);         // ⚠ 「전」에서만 값이 있다(벌이 낸 몫)
      if (sq.canSell) { const r = takeCropSurplus(fp); sold += r.won; ts.cashWon += r.won; }
    }
    /* ⑤ 하루가 간다 — 월세·하루 지출이 여기서 나간다 */
    /* ⚠⚠ **`firstPlayDone: true` 가 없으면 돈이 한 푼도 안 움직인다.**
       `tutorialDay` 첫 줄이 `if (!firstPlayDone) return { skipped }` 다 — 첫 플레이 동안은
       살림이 멈춰 있는 것이 규칙이라 그렇다. 이걸 모르고 한 번 재서 **「아무도 파산 안 한다 ·
       200일에 돈이 2.5배로 는다」**는 표가 나왔다(START-HERE §2.9 「재는 자가 거짓말한다」). */
    tutorialDay(ts, { firstPlayDone: true, savedWon: bite.savedWon, lampCount: 0 });
    advanceBeansproutDay(fp, DARK);
    if (brokeDay == null && ts.bankrupt) brokeDay = ts.day;
    cashAtEnd = ts.cashWon;
  }
  return { brokeDay, cashAtEnd, ate, sold, seedSpent, harvests };
}
const SIRUS = [1, 3, 5, 8, 12, 16, 20, 25];
const POLICIES = [
  ['㉠ 다 팔기 (곳간을 매일 비운다 · 잉여도 판다)', { keepMeal: false }],
  ['㉡ 하루 몫은 남기고 팔기 (내일 먹을 300g 을 남긴다 · 잉여도 판다)', { keepMeal: true }],
  ['㉢ ★ 잉여는 안 판다 (상점에 안 들르는 사람 · 하루 몫은 남긴다)', { keepMeal: true, sellSurplus: false }]
];
for (const [ko, opt] of POLICIES) {
  console.log(`\n★ ② 살림 — 파산일과 ${DAYS_LONG}일 잔액 · ${ko}`);
  console.log(`  시작돈 ${won(1_500_000)}원 · 월세 ${won(200_000)}원/30일 · 하루 지출 ${won(10_000)}원 · ` +
              `씨앗 ${won(SEED_WON)}원/회전 · 시루값은 안 뺐다 · 등 없음 · 하루 5개까지 물 준다\n`);
  table(['시루', '파산일(전)', '파산일(후)', `${DAYS_LONG}일 잔액(전)`, `${DAYS_LONG}일 잔액(후)`,
         '거둔 회전(후)', '밥값 절감(후)', '판 돈(후)', '씨앗값(후)'],
    SIRUS.map(n => {
      const a = live(PEN, n, opt), b = live(NOPEN, n, opt);
      const dayKo = (d) => d == null ? '안 남' : `${d}일`;
      return [`${n}개`, dayKo(a.brokeDay), dayKo(b.brokeDay),
              won(a.cashAtEnd), won(b.cashAtEnd),
              b.harvests, won(b.ate), won(b.sold), won(b.seedSpent)];
    }));
}
console.log('\n★★ 읽는 법 — ㉠㉡ 에서 **전·후가 거의 같다.** 겹쳐서 못 받던 몫이 버려진 것이');
console.log('   아니라 [상점]에서 85%에 팔렸기 때문이다. 벌의 값은 ㉢ 에서만 드러난다:');
console.log('   상점에 안 들르면 그 몫이 통째로 사라졌다. ⇒ 이번 변경이 실제로 바꾼 것은');
console.log('   **「손에 들어오는 양」(800g → 2kg)** 과 **「손이 덜 간다」** 이지 총액이 아니다.\n');
