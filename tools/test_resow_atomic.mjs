/* ============================================================
   tools/test_resow_atomic.mjs — 다시 심기는 **반만 일어나면 안 된다** (2026-08-09 신설)
   ------------------------------------------------------------
   무엇이 잘못돼 있었나.

     resowCrop 은 재고를 **둘** 쓴다 — 시루(용기)와 씨앗. 그런데 순서가 이랬다.

       if (sirusAdded > 0) useStock(S, 시루, sirusAdded);   // ← 여기서 시루가 빠지고
       useStock(S, 씨앗, seedsUsed);                        // ← 여기서 던진다

     씨앗이 모자라면 두 번째 줄이 던진다. 그때 **첫 줄은 이미 일어났다.**
     시루는 빠졌는데 심기지는 않았다 — 시루 하나가 14,000원인데 그냥 사라진다.

   ⚠ 화면(game.html)이 미리 세어 그 길을 피하고 있었다. 그래서 손으로 놀 때는 안 보였다.
     하지만 그건 **규칙이 지키는 게 아니다.** 재현(tools/test_*)·자동조작·다른 화면·
     앞으로 붙을 어떤 버튼이든 화면의 그 셈을 안 거치면 그대로 사라진다.
     규칙은 스스로 지켜야 한다.

   이 검사가 못 박는 것은 둘이다.

     ① ★**던졌으면 아무것도 안 바뀐다.** 씨앗이 모자라 실패한 뒤 시루 재고가 그대로다.
     ② ★성공하는 길은 예전과 똑같다 — 시루도 씨앗도 쓴 만큼만 빠진다.
        (①만 보면 "아무것도 안 빼게" 고쳐도 통과한다. 그건 공짜 경제다.)

   ⚠ 이 검사는 숫자를 안 지어낸다. 씨앗·시루 품목 이름은 `first_play.cropKindOf` 에서 읽는다.
============================================================ */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firstPlayRulesFromBalance, placeBeansprout, cropKindOf } from '../src/game/first_play.js';
import { newState, resowCrop } from '../src/game/state.js';
import { stockOf } from '../src/game/shop.js';

const RULES = firstPlayRulesFromBalance(JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8')));

const K = cropKindOf('beansprout');
const SIRU = K.containerItemId;      // 'siru'
const SEED = K.seedItemId;           // 'bean_seed'

let n = 0;
const ok = (name) => { n++; console.log(`  ✓ ${name}`); };

/* 거둔 시루 하나를 가진 판을 만든다 — 다시 심을 수 있는 상태다.
   재고는 검사마다 직접 넣는다(주문·배송을 태우면 이 검사가 상점 배송을 같이 재게 된다). */
function harvestedState({ siru = 0, seed = 0 } = {}) {
  const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: RULES });
  placeBeansprout(S.firstPlay, 'dark');
  for (const p of S.firstPlay.beansprout.pots) p.harvested = true;
  S.shop.stock[SIRU] = siru;
  S.shop.stock[SEED] = seed;
  return S;
}

console.log('\n== A. 던졌으면 재고는 손댄 적이 없다 ==');
{
  /* 시루를 2개 더 세우려는데(sirusAdded=2) 씨앗이 하나도 없다.
     예전 판이면 시루 2개가 먼저 빠지고 씨앗에서 던져 28,000원이 사라진다. */
  const S = harvestedState({ siru: 2, seed: 0 });
  const had = S.firstPlay.beansprout.pots.length;
  const siruBefore = stockOf(S, SIRU);
  const seedBefore = stockOf(S, SEED);

  assert.throws(() => resowCrop(S, { sirus: had + 2 }),
    /씨앗|봉지|bean_seed/, '★씨앗이 없는데 다시 심기가 통과했습니다');

  assert.equal(stockOf(S, SIRU), siruBefore,
    `★★던지고도 ${K.containerKo}가 빠졌습니다 — ${siruBefore}개였는데 ${stockOf(S, SIRU)}개입니다. ` +
    '반만 일어난 동작입니다(빼기 전에 전부 물어야 합니다)');
  ok(`씨앗이 모자라 실패해도 ${K.containerKo} 재고가 그대로다 (${siruBefore}개)`);

  assert.equal(stockOf(S, SEED), seedBefore, '★씨앗 재고가 움직였습니다');
  ok('씨앗 재고도 그대로다');

  assert.equal(S.firstPlay.beansprout.pots.length, had, `★${K.containerKo} 수가 늘었습니다`);
  ok('시루도 안 늘었다 — 심기 자체가 안 일어났다');
}

console.log('\n== B. 시루가 모자란 쪽도 마찬가지다 ==');
{
  /* 반대 순서로도 반만 일어나면 안 된다 — 씨앗은 넉넉한데 시루가 모자란 판. */
  const S = harvestedState({ siru: 0, seed: 9 });
  const had = S.firstPlay.beansprout.pots.length;

  assert.throws(() => resowCrop(S, { sirus: had + 1 }), /시루|siru/,
    '★시루가 없는데 다시 심기가 통과했습니다');
  assert.equal(stockOf(S, SEED), 9, '★★시루에서 던졌는데 씨앗이 빠졌습니다');
  ok('시루가 모자라 실패해도 씨앗 9봉지가 그대로다');
}

console.log('\n== C. 성공하는 길은 예전 그대로다 — 쓴 만큼 빠진다 ==');
{
  /* ①만 보면 "아무것도 안 빼게" 고쳐도 통과한다. 그건 씨앗이 공짜인 경제다.
     그래서 되는 길에서 **정확히 얼마가 빠지는지**를 같이 못 박는다. */
  const S = harvestedState({ siru: 3, seed: 9 });
  const had = S.firstPlay.beansprout.pots.length;
  const add = 2;

  const r = resowCrop(S, { sirus: had + add });

  assert.equal(r.sirusAdded, add, '★새로 세운 시루 수가 안 맞습니다');
  assert.equal(stockOf(S, SIRU), 3 - add, `★${K.containerKo}가 쓴 만큼 안 빠졌습니다`);
  ok(`${K.containerKo} ${add}개를 세우니 재고가 ${3 - add}개로 줄었다`);

  /* 씨앗은 **거둔 시루 + 새로 세운 시루** 만큼 든다 — 자라는 중인 시루는 안 건드린다 */
  assert.equal(stockOf(S, SEED), 9 - r.seedsUsed, '★씨앗이 쓴 만큼 안 빠졌습니다');
  assert.equal(r.seedsUsed, had + add,
    `★씨앗 셈이 바뀌었습니다 — 거둔 ${had} + 새로 ${add} 여야 하는데 ${r.seedsUsed} 입니다`);
  ok(`씨앗 ${r.seedsUsed}봉지를 써서 재고가 ${9 - r.seedsUsed}봉지로 줄었다`);
}

console.log(`\n다시 심기 원자성 — 검사 ${n}건 전부 통과했습니다.\n`);
