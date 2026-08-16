/* ============================================================
   tools/test_mealbykind.mjs — **밥상에서 작물별로 갈라 고른다** (2026-08-18 신설 · G-19)
   ------------------------------------------------------------
   박사님 원문: *"콩나물·무순 **식량 적용 시 칸을 갈라 고르도록**"*

   ## 무엇을 재는가
   앞 창(`terms-to-plan.md §4`)이 *"못 했다"* 로 남긴 자리다. 진단은 이랬다 —
   고른 값이 지나는 채널이 `mealPlanWon` **수 하나**라서 「콩나물만 300g」을 적어 보낼 칸이
   없었고, 총 g 으로는 그 뜻이 **전달되지 않는다**(총 200g 을 주면 엔진은 무순을 고른다).
   ⇒ 이번에 낸 것은 화면이 아니라 **창구**다: `cropMealPlan(fp, { gramsByKind })` ·
     `planMealByKind` · `fp.food.mealPlanByKind` · `eatFromPantry` 의 읽기.

   ## ★★ 이 검사가 지키는 것 넷
     ① **안 고른 판이 한 원도 안 달라야 한다** — §A 의 값은 **고치기 전에 재서 적어 둔 것**이다
        (`git` 워크트리를 안 건드리고, 고치기 전 파일로 같은 표를 뽑아 JSON 으로 받아 두었다.
         고친 뒤 같은 표를 다시 뽑아 `diff` 했고 **지워지거나 바뀐 줄이 0**, 늘어난 줄만 2,874).
     ② **고른 대로 나가야 한다** — 한 작물만 · 갈라서 · 비율대로
     ③ **못 채우면 왜 못 채웠는지가 반환값에 있어야 한다** — 화면이 셈도 문장도 안 짓는다(§2.8)
     ④ **곳간에서 실제로 빠진 g 이 고른 g 과 같아야 한다** — `eatFromPantry` 까지 태워서 잰다

   ## ⚠ 숫자를 지어내지 않는다
   몫 규칙 값(2,500 · 1,200 · 300g · 200g)은 `rules` 와 `cropMealPortionGrams` 에서 읽는다.
   §A 의 값만 **손으로 적었다** — 그것이 「고치기 전 값」이라는 뜻이고, 읽어 오면 이 검사가
   재는 것이 없어진다(고치는 쪽과 재는 쪽이 같은 함수를 보게 된다).
============================================================ */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  firstPlayRulesFromBalance, createFirstPlayState,
  cropMealPlan, cropMealPortionGrams, mealPlanQuote, mealShortReasonKo,
  planMealGrams, planMealByKind, eatFromPantry, pantryGramsOf
} from '../src/game/first_play.js';
import { newState, mealPlanStatus, planMeal } from '../src/game/state.js';
import { serialize, deserialize } from '../src/game/save.js';

const BALANCE = JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8'));
const RULES = firstPlayRulesFromBalance(BALANCE);

const seed = (lots, rules = RULES) => {
  const fp = createFirstPlayState({ enabled: true, rules });
  fp.food.pantryLots = lots.map(l => ({ ...l }));
  fp.food.pantryWon = lots.reduce((a, l) => a + l.won, 0);
  return fp;
};
const B = (won, day = 1) => ({ kind: 'beansprout', day, won, meals: 3 });
const M = (won, day = 1) => ({ kind: 'musun', day, won, meals: 3 });
const NUL = (won, day = 1) => ({ kind: null, day, won, meals: 0 });
const of = (plan, id) => plan.byKind.find(b => b.kind === id);
const sig = (plan) => plan.portions.map(p => `${p.kind}:${p.grams}:${p.won}`).join('+');

let n = 0;
const ok = (name) => { n++; console.log(`  ✓ ${name}`); };

/* ══════════════════════════════════════════════════════════════
   A. ★★★ 안 고르면 **고치기 전과 한 원도 안 다르다**
   ⚠ 아래 값은 고치기 전 파일에서 뽑은 것이다. 「지금 이렇다」가 아니라 「전에 이랬다」다.
══════════════════════════════════════════════════════════════ */
console.log('\n== A. ★★★안 고른 판 — 고치기 전 값과 한 원도 안 다르다 ==');
{
  /* [이름, 꾸러미, 총 g, 밥값, 물건 값, 몫 서명] — 전부 **고치기 전** 실측 */
  const BEFORE = [
    ['빈 곳간',            [],                   0,   0,    0,    ''],
    ['콩 400g',            [B(4000)],           300, 2500, 3000, 'beansprout:300:2500'],
    ['콩 300g',            [B(3000)],           300, 2500, 3000, 'beansprout:300:2500'],
    ['콩 150g(반몫)',      [B(1500)],           150, 1250, 1500, 'beansprout:150:1250'],
    ['콩 400g 둘',         [B(4000), B(4000)],  300, 2500, 3000, 'beansprout:300:2500'],
    ['무순 300g',          [M(3000)],           200, 2500, 2000, 'musun:200:2500'],
    ['무순 100g(반몫)',    [M(1000)],           100, 1250, 1000, 'musun:100:1250'],
    ['콩+무순',            [B(4000), M(3000)],  500, 5000, 5000, 'beansprout:300:2500+musun:200:2500'],
    /* ★ FIFO — 무순을 **먼저 거둔** 판은 몫 순서가 뒤집힌다. 이 줄이 동점 처리를 지킨다 */
    ['무순+콩(FIFO)',      [M(3000), B(4000)],  500, 5000, 5000, 'musun:200:2500+beansprout:300:2500'],
    ['동점 판',            [B(3000), M(2000)],  500, 5000, 5000, 'beansprout:300:2500+musun:200:2500'],
    ['작물 모르는 옛 꾸러미', [NUL(3500), NUL(3500)], 300, 2500, 3000, 'beansprout:300:2500'],
    ['큰 판',              [B(5000), M(3000), B(5000)], 500, 5000, 5000,
                           'beansprout:300:2500+musun:200:2500']
  ];
  for (const [name, lots, g, saved, used, s] of BEFORE) {
    const p = cropMealPlan(seed(lots));
    assert.equal(p.usedGrams, g, `★★[${name}] 안 골랐는데 총 g 이 달라졌다`);
    assert.equal(p.savedWon, saved, `★★[${name}] 안 골랐는데 밥값이 달라졌다`);
    assert.equal(p.usedWon, used, `★★[${name}] 안 골랐는데 곳간에서 빠질 물건 값이 달라졌다`);
    assert.equal(sig(p), s, `★★[${name}] 안 골랐는데 몫이 달라졌다`);
    assert.equal(p.pickedByKind, false, `★[${name}] 안 골랐는데 「골랐다」로 나온다`);
    /* 먹는 쪽도 같아야 한다 */
    const fp = seed(lots);
    const e = eatFromPantry(fp);
    assert.equal(e.savedWon, saved, `★★[${name}] 안 골랐는데 먹은 밥값이 달라졌다`);
    assert.equal(e.savedGrams, g, `★★[${name}] 안 골랐는데 먹은 g 이 달라졌다`);
    assert.equal(e.pantryUsedWon, used, `★★[${name}] 안 골랐는데 곳간에서 빠진 값이 달라졌다`);
    assert.equal(e.planned, false, `★[${name}] 안 골랐는데 planned 가 참이다`);
  }
  ok(`안 고른 판 12벌이 고치기 전 값과 같다 (총 g · 밥값 · 물건 값 · 몫 순서까지)`);

  /* 총 g 만 고르던 옛 길도 그대로다 */
  const q = mealPlanQuote(seed([B(4000), M(3000)]), 200);
  assert.equal(q.grams, 200, '★총 g 200 을 골랐는데 200g 이 안 나갔다');
  assert.equal(sig({ portions: q.portions }), 'musun:200:2500',
    '★★총 200g 이 무순을 고르던 것이 바뀌었다 — 옛 길이 안 지켜졌다');
  assert.equal(mealPlanQuote(seed([B(4000), M(3000)])).maxGrams, 500, '★위끝이 달라졌다');
  ok('총 g 만 고르는 옛 길(그 200g 이 무순을 고르던 것까지) 그대로다');
}

/* ══════════════════════════════════════════════════════════════
   B. 한 작물만 고르면 **그 작물만** 나간다
══════════════════════════════════════════════════════════════ */
console.log('\n== B. 한 작물만 고르면 그 작물만 나간다 ==');
{
  const LOTS = [B(4000), M(3000)];        // 콩 400g · 무순 300g (앞 창이 실측한 그 판)
  const beanOnly = cropMealPlan(seed(LOTS), { gramsByKind: { beansprout: 300 } });
  assert.equal(sig(beanOnly), 'beansprout:300:2500', '★★콩나물만 골랐는데 무순이 올라갔다');
  assert.equal(of(beanOnly, 'musun').grams, 0, '★안 고른 무순이 나갔다');
  assert.equal(of(beanOnly, 'musun').reason, 'notPicked', '★안 고른 것의 까닭이 안 맞는다');

  const musunOnly = cropMealPlan(seed(LOTS), { gramsByKind: { musun: 200 } });
  assert.equal(sig(musunOnly), 'musun:200:2500', '★★무순만 골랐는데 콩나물이 올라갔다');
  assert.equal(of(musunOnly, 'beansprout').grams, 0, '★안 고른 콩나물이 나갔다');

  /* ★★ 이것이 앞 창이 *"총 g 으로는 그 말이 전달되지 않는다"* 고 적은 그 자리다.
     총 300g 을 주면 엔진이 **먼저 거둔 쪽**을 고른다(FIFO). 갈라 고르면 그것을 넘어선다. */
  const byTotal = cropMealPlan(seed([M(3000), B(4000)]), { grams: 300 });
  assert.equal(byTotal.portions[0].kind, 'musun',
    '★총 g 300 은 먼저 거둔 무순을 고른다 — 이 전제가 깨지면 아래 줄의 뜻이 없다');
  const byPick = cropMealPlan(seed([M(3000), B(4000)]), { gramsByKind: { beansprout: 300 } });
  assert.equal(byPick.portions[0].kind, 'beansprout',
    '★★★먼저 거둔 것이 무순인 판에서 「콩나물만」을 고를 수 없다 — 창구가 안 선 것이다');
  ok('한 작물만 고르면 그 작물만 나간다 — 총 g 으로는 못 하던 것이 된다');
}

/* ══════════════════════════════════════════════════════════════
   C. 둘을 갈라 고르면 **그 비율대로** · 못 채우면 **까닭**이 나온다
══════════════════════════════════════════════════════════════ */
console.log('\n== C. 갈라 고르면 그 비율대로 · 못 채우면 까닭이 나온다 ==');
{
  const LOTS = [B(4000), M(3000)];
  const split = cropMealPlan(seed(LOTS), { gramsByKind: { beansprout: 200, musun: 100 } });
  assert.equal(of(split, 'beansprout').grams, 200, '★콩나물 200g 이 안 나갔다');
  assert.equal(of(split, 'musun').grams, 100, '★무순 100g 이 안 나갔다');
  assert.equal(split.usedGrams, 300, '★갈라 고른 합이 안 맞는다');
  /* ★ 못 채운 몫은 **비례**로 친다 — 몫 규칙을 한 톨도 안 바꿨다는 증거다 */
  const needB = cropMealPortionGrams(RULES, 0), needM = cropMealPortionGrams(RULES, 1);
  const full = RULES.cropMealPortionWon;
  assert.equal(of(split, 'beansprout').savedWon, Math.round(full * 200 / needB),
    '★★콩나물 200g 의 밥값이 비례가 아니다 — 몫 규칙이 바뀌었다');
  assert.equal(of(split, 'musun').savedWon, Math.round(full * 100 / needM),
    '★★무순 100g 의 밥값이 비례가 아니다');
  ok(`갈라 고른 200g : 100g 이 그 비율대로 나간다 (밥값도 비례 그대로)`);

  /* ── 못 채우는 네 까닭 ─────────────────────────────────────── */
  /* ① 곳간에 없다 */
  const noStock = cropMealPlan(seed([B(4000)]), { gramsByKind: { musun: 200 } });
  assert.equal(of(noStock, 'musun').grams, 0, '★없는 무순이 나갔다');
  assert.equal(of(noStock, 'musun').shortGrams, 200, '★못 채운 g 을 안 센다');
  assert.equal(of(noStock, 'musun').reason, 'pantry', '★곳간에 없는데 까닭이 안 맞는다');
  assert.ok(of(noStock, 'musun').reasonKo.length > 0, '★★까닭에 말이 안 붙었다 — 화면이 지어야 한다');

  /* ② 파는 값보다 못한 몫이라 안 먹는다 (§몫 ④ — 고르개가 이것을 못 뚫는다) */
  const second = cropMealPlan(seed([B(7000)]), { gramsByKind: { beansprout: 600 } });
  assert.equal(of(second, 'beansprout').grams, 300,
    '★★★같은 작물로 둘째 몫까지 먹었다 — 고르개가 §몫 ④ 를 뚫었다');
  assert.equal(of(second, 'beansprout').reason, 'sell', '★안 먹은 까닭이 「파는 게 낫다」가 아니다');

  /* ③ 오늘 올릴 수 있는 몫 자리가 다 찼다 */
  const both = cropMealPlan(seed([B(7000), M(6000)]),
                            { gramsByKind: { beansprout: 600, musun: 400 } });
  assert.equal(both.portions.length, RULES.cropMealPortions, '★몫 자리를 다 안 썼다');
  assert.equal(of(both, 'musun').grams, 200, '★무순이 한 몫만 나가야 한다');
  assert.equal(of(both, 'musun').reason, 'portions', '★몫 자리가 없어서인데 까닭이 안 맞는다');

  /* ④ 총 g(`opt.grams`)과 같이 오면 — **둘 다 지킨다.** 먼저 걸리는 쪽이 이긴다 */
  const both2 = cropMealPlan(seed([B(4000), M(3000)]),
                             { grams: 200, gramsByKind: { beansprout: 300 } });
  assert.equal(both2.usedGrams, 200, '★★총 g 상한이 안 걸렸다 — 둘 다 지킨다는 계약이 깨졌다');
  assert.equal(both2.portions[0].kind, 'beansprout', '★작물별 상한이 안 걸렸다');
  assert.equal(of(both2, 'beansprout').reason, 'budget', '★총 g 에 걸린 까닭이 안 맞는다');
  ok('못 채운 까닭 넷(곳간·파는 값·몫 자리·총 g)이 작물마다 반환값에 실린다');
}

/* ══════════════════════════════════════════════════════════════
   D. 곳간에 없는 작물 · 모르는 작물 이름 — **계약**
══════════════════════════════════════════════════════════════ */
console.log('\n== D. 곳간에 없는 작물은 0 이 되고, 모르는 이름은 던진다 ==');
{
  /* ★ 곳간에 없는 작물 = **정상적인 판**이다. 0g 이 나가고 까닭이 실린다(§C ①) */
  const q = mealPlanQuote(seed([B(4000)]), { musun: 200 });
  assert.equal(q.grams, 0, '★★없는 작물만 골랐는데 무언가를 먹었다');
  assert.equal(q.savedWon, 0, '★없는 작물로 밥값을 아꼈다');
  /* ★ 위끝까지 깎으므로 고른 값도 0 으로 정규화된다 — 화면이 「200g 골랐다」고 못 적게 */
  assert.equal(q.pickedByKind.musun, 0, '★★곳간에 없는데 고른 값이 200 으로 남았다');

  /* ★ 모르는 이름은 **던진다** — 조용히 콩나물로 굴리면 그 판 밥상이 통째로 거짓이 된다 */
  assert.throws(() => cropMealPlan(seed([B(4000)]), { gramsByKind: { tomato: 100 } }),
    /모르는 작물/, '★★모르는 작물 이름을 조용히 삼켰다');
  assert.throws(() => planMealByKind(seed([B(4000)]), { tomato: 100 }), /모르는 작물/);
  /* ★ 던진 뒤에 칸이 반쯤 적혀 있으면 안 된다 */
  const fp = seed([B(4000)]);
  try { planMealByKind(fp, { beansprout: 300, tomato: 100 }); } catch { }
  assert.equal(fp.food.mealPlanByKind, null, '★★던지고 나서 반쯤 적힌 칸이 남았다');
  /* ★ g 이 수가 아니면 던진다 */
  assert.throws(() => cropMealPlan(seed([B(4000)]), { gramsByKind: { beansprout: -1 } }), /0 이상/);
  assert.throws(() => cropMealPlan(seed([B(4000)]), { gramsByKind: 300 }), /표여야/);
  ok('없는 작물은 0g(까닭 pantry) · 모르는 이름은 던지고 칸을 안 적는다');
}

/* ══════════════════════════════════════════════════════════════
   E. ★★ 곳간에서 **실제로 빠진 g** 이 고른 g 과 맞나 (`eatFromPantry` 까지)
══════════════════════════════════════════════════════════════ */
console.log('\n== E. ★★곳간에서 실제로 빠진 g 이 고른 g 과 맞는다 ==');
{
  const CASES = [
    ['콩나물만 300g', [B(4000), M(3000)], { beansprout: 300, musun: 0 },
     { beansprout: 100, musun: 300 }],           // 남을 g (콩 400-300 · 무순 그대로)
    ['무순만 200g',   [B(4000), M(3000)], { beansprout: 0, musun: 200 },
     { beansprout: 400, musun: 100 }],
    ['갈라서 200:100', [B(4000), M(3000)], { beansprout: 200, musun: 100 },
     { beansprout: 200, musun: 200 }],
    ['아무것도 안 먹기', [B(4000), M(3000)], { beansprout: 0, musun: 0 },
     { beansprout: 400, musun: 300 }]
  ];
  for (const [name, lots, pick, restBy] of CASES) {
    const fp = seed(lots);
    const q = planMealByKind(fp, pick);
    const beforeG = pantryGramsOf(fp);
    const e = eatFromPantry(fp);
    const wantG = Object.values(q.pickedByKind).reduce((a, v) => a + v, 0);
    assert.equal(e.savedGrams, wantG, `★★[${name}] 먹은 g 이 고른 g 과 다르다`);
    assert.equal(beforeG - pantryGramsOf(fp), wantG,
      `★★★[${name}] 곳간에서 빠진 g 이 고른 g 과 다르다 — 화면이 거짓말하는 자리다`);
    assert.equal(e.pantryUsedWon, wantG * 10, `★[${name}] 빠진 물건 값이 g×10 이 아니다`);
    /* ★ 작물마다도 맞아야 한다 — 총합만 맞고 속이 뒤바뀐 판을 잡는다 */
    const leftBy = {};
    for (const l of fp.food.pantryLots) {
      const k = l.kind || 'beansprout';
      leftBy[k] = (leftBy[k] || 0) + Math.round(l.won / 10);
    }
    for (const [k, g] of Object.entries(restBy))
      assert.equal(leftBy[k] || 0, g, `★★★[${name}] ${k} 이 곳간에 ${g}g 남아야 하는데 아니다`);
    assert.equal(e.planned, true, `★[${name}] 골랐는데 planned 가 거짓이다`);
    /* ★ 한 번 쓰고 지운다 — 내일도 조용히 같은 것을 먹으면 안 된다 */
    assert.equal(fp.food.mealPlanByKind, null, `★★[${name}] 고른 표를 안 지웠다`);
    assert.equal(fp.food.mealPlanWon, null, `★[${name}] 총 g 칸을 안 지웠다`);
  }
  ok('고른 g 이 곳간에서 그대로 빠진다 (작물마다 · 총합 · 물건 값 · 한 번 쓰고 지우기)');

  /* ★ 지운 다음 날은 **안 고른 판**이다 — 어제 0g 이 오늘까지 이어지면 안 된다 */
  const fp2 = seed([B(4000), M(3000)]);
  planMealByKind(fp2, { beansprout: 0, musun: 0 });
  eatFromPantry(fp2);
  fp2.food.pantryLots = [B(4000), M(3000)];
  fp2.food.pantryWon = 7000;
  const next = eatFromPantry(fp2);
  assert.equal(next.savedGrams, 500, '★★어제 「안 먹기」가 오늘까지 이어졌다');
  ok('어제 고른 것이 오늘까지 안 이어진다');
}

/* ══════════════════════════════════════════════════════════════
   F·G. 세이브 — 옛 판이 안 깨지고, 새 칸이 저장을 넘는다
══════════════════════════════════════════════════════════════ */
console.log('\n== F. ★옛 세이브(칸이 없는 판)가 그대로 돈다 ==');
{
  const S = newState({ firstPlay: true, firstPlayRules: RULES });
  S.firstPlay = seed([B(4000), M(3000)]);
  const raw = JSON.parse(JSON.stringify(serialize(S)));
  /* ★ 옛 파일에는 이 칸이 **아예 없다** */
  delete raw.state.firstPlay.food.mealPlanByKind;
  const back = deserialize(JSON.stringify(raw), { firstPlayRules: RULES });
  assert.equal(back.firstPlay.food.mealPlanByKind, null,
    '★★칸이 없는 옛 파일이 null 로 안 열린다');
  const e = eatFromPantry(back.firstPlay);
  assert.equal(e.savedGrams, 500, '★★옛 판이 예전처럼 안 먹는다');
  assert.equal(e.savedWon, 5000, '★옛 판의 밥값이 달라졌다');
  assert.equal(e.planned, false, '★옛 판이 「골랐다」로 열렸다');

  /* 옛 총 g 채널만 적힌 파일도 그대로 돈다 */
  const S2 = newState({ firstPlay: true, firstPlayRules: RULES });
  S2.firstPlay = seed([B(4000), M(3000)]);
  planMealGrams(S2.firstPlay, 200);
  const raw2 = JSON.parse(JSON.stringify(serialize(S2)));
  delete raw2.state.firstPlay.food.mealPlanByKind;
  const back2 = deserialize(JSON.stringify(raw2), { firstPlayRules: RULES });
  assert.equal(back2.firstPlay.food.mealPlanWon, 2000, '★옛 총 g 채널이 안 실렸다');
  assert.equal(eatFromPantry(back2.firstPlay).savedGrams, 200, '★★옛 판의 고른 값이 안 먹혔다');
  ok('칸이 없는 옛 세이브가 예전 그대로 돈다 (안 고른 판 · 총 g 만 고른 판)');
}

console.log('\n== G. ★새 칸이 저장을 넘고, 고르개 둘이 서로를 지운다 ==');
{
  const S = newState({ firstPlay: true, firstPlayRules: RULES });
  S.firstPlay = seed([B(4000), M(3000)]);
  planMealByKind(S.firstPlay, { beansprout: 300, musun: 0 });
  const back = deserialize(JSON.stringify(serialize(S)), { firstPlayRules: RULES });
  assert.deepEqual(back.firstPlay.food.mealPlanByKind, { beansprout: 300, musun: 0 },
    '★★갈라 고른 표가 저장을 못 넘었다 — 새로고침 한 번에 무순까지 먹는다');
  assert.equal(eatFromPantry(back.firstPlay).savedGrams, 300,
    '★★불러온 판이 고른 대로 안 먹는다');

  /* ★ 「전부 0」과 null 을 갈라 싣는다 — mealPlanWon 이 겪은 그 사고 */
  const S2 = newState({ firstPlay: true, firstPlayRules: RULES });
  S2.firstPlay = seed([B(4000), M(3000)]);
  planMealByKind(S2.firstPlay, { beansprout: 0, musun: 0 });
  const b2 = deserialize(JSON.stringify(serialize(S2)), { firstPlayRules: RULES });
  assert.deepEqual(b2.firstPlay.food.mealPlanByKind, { beansprout: 0, musun: 0 },
    '★★「오늘은 안 먹는다」가 저장을 못 넘었다');
  assert.equal(eatFromPantry(b2.firstPlay).savedGrams, 0,
    '★★★안 먹기로 한 판이 새로고침 뒤에 500g 을 먹는다');

  /* ★ null 을 주면 지운다 */
  planMealByKind(S2.firstPlay, { beansprout: 300 });
  planMealByKind(S2.firstPlay, null);
  assert.equal(S2.firstPlay.food.mealPlanByKind, null, '★null 로 안 지워진다');
  assert.equal(S2.firstPlay.food.mealPlanWon, null, '★null 이 총 g 칸을 안 지운다');

  /* ★★ 두 고르개가 서로를 지운다 — 한 번에 하나만 찬다 */
  const fp = seed([B(4000), M(3000)]);
  planMealByKind(fp, { beansprout: 300, musun: 0 });
  assert.equal(fp.food.mealPlanWon, null, '★★갈라 고르는데 총 g 칸이 같이 찼다');
  planMealGrams(fp, 200);
  assert.equal(fp.food.mealPlanByKind, null,
    '★★★총 g 을 다시 골랐는데 어제의 「콩나물만」이 남았다 — 고른 것과 먹은 것이 갈린다');
  assert.equal(eatFromPantry(fp).portions[0].kind, 'musun',
    '★총 g 200 은 몫 규칙이 무순을 고른다(§A) — 갈라 고른 것이 안 지워졌다');

  /* ★ 모르는 작물이 든 세이브는 **읽을 때 던진다** */
  const S3 = newState({ firstPlay: true, firstPlayRules: RULES });
  S3.firstPlay = seed([B(4000)]);
  const raw3 = JSON.parse(JSON.stringify(serialize(S3)));
  raw3.state.firstPlay.food.mealPlanByKind = { tomato: 100 };
  assert.throws(() => deserialize(JSON.stringify(raw3), { firstPlayRules: RULES }),
    /모르는 작물/, '★모르는 작물이 든 세이브가 조용히 열렸다');
  ok('새 칸이 저장을 넘는다 · null 과 「전부 0」이 갈린다 · 고르개 둘이 서로를 지운다');
}

/* ══════════════════════════════════════════════════════════════
   H. ★★ 화면이 그릴 것 — **셈을 다시 안 하게** 낸다 (§2.8)
══════════════════════════════════════════════════════════════ */
console.log('\n== H. ★★화면이 그릴 줄 — 작물마다 「고른 g · 최대 g · 짜이는 몫」 ==');
{
  const S = newState({ firstPlay: true, firstPlayRules: RULES });
  S.firstPlay = seed([B(4000), M(3000)]);
  /* ★ `state.js` 의 옛 창구가 인자를 하나만 넘긴다 — 표를 그 자리에 넣어 닿는다 */
  const ms = mealPlanStatus(S, { beansprout: 300, musun: 0 });
  const bean = ms.byKind.find(b => b.kind === 'beansprout');
  const musun = ms.byKind.find(b => b.kind === 'musun');
  assert.equal(bean.kindKo, '콩나물', '★화면이 적을 이름이 없다');
  assert.equal(bean.wantGrams, 300, '★지금 고른 g 이 없다');
  assert.equal(bean.maxGrams, 300, '★★콩나물 위끝(300g)이 없다 — 화면이 셈을 다시 해야 한다');
  assert.equal(musun.maxGrams, 200, '★★무순 위끝(200g)이 없다');
  assert.equal(bean.pantryGrams, 400, '★곳간에 있는 g 이 없다');
  assert.equal(bean.portions.length, 1, '★그 g 으로 짜이는 몫이 없다');
  assert.equal(bean.portions[0].won, RULES.cropMealPortionWon, '★몫의 값이 안 실렸다');
  assert.equal(musun.grams, 0, '★안 고른 무순이 나갔다');
  assert.equal(musun.reasonKo, mealShortReasonKo('notPicked'), '★까닭의 말이 안 실렸다');
  assert.equal(ms.savedWon, RULES.cropMealPortionWon, '★아낀 밥값이 안 맞는다');
  assert.equal(ms.cashFoodWon, RULES.dailyFoodWon - RULES.cropMealPortionWon,
    '★지갑에서 나갈 밥값이 안 맞는다');
  /* ★ 화면이 눌러도 위끝을 못 넘는다 — 고르개는 「덜 먹는 쪽」으로만 */
  const over = mealPlanStatus(S, { beansprout: 9999, musun: 9999 });
  assert.deepEqual(over.pickedByKind, { beansprout: 300, musun: 200 },
    '★★위끝을 넘겨 고를 수 있다 — 고르개가 몫 규칙을 뚫는다');

  /* ★ `planMeal(S, 표)` 도 같은 자리로 닿는다 (화면이 실제로 부를 길) */
  const p = planMeal(S, { beansprout: 300, musun: 0 });
  assert.deepEqual(S.firstPlay.food.mealPlanByKind, { beansprout: 300, musun: 0 },
    '★★화면 창구(planMeal)로 갈라 고른 것이 안 적힌다');
  assert.equal(p.grams, 300, '★적은 뒤 반환값의 g 이 안 맞는다');
  /* 안 고른 판에서도 화면이 줄을 그릴 수 있어야 한다 */
  const plain = mealPlanStatus(newStateWith([B(4000), M(3000)]));
  assert.equal(plain.byKind.length, 2, '★안 고른 판에 작물 줄이 없다');
  assert.equal(plain.byKind[0].wantGrams, null, '★안 골랐는데 고른 g 이 있다');
  assert.equal(plain.byKind[0].grams, 300, '★안 고른 판의 「최선껏」이 안 실렸다');
  ok('작물마다 「고른 g · 최대 g · 곳간 g · 짜이는 몫 · 못 채운 까닭」이 한 자리에 나온다');
}

function newStateWith(lots) {
  const S = newState({ firstPlay: true, firstPlayRules: RULES });
  S.firstPlay = seed(lots);
  return S;
}

console.log(`\n★ tools/test_mealbykind.mjs — ${n}벌 전부 통과\n`);
