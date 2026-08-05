/* ============================================================
   체력 — 하루에 돌볼 수 있는 양 (2026-08-05 박사님 확정)
   정본 문서: docs/stamina.md · 규칙: src/game/stamina.js

   ★ 이 검사가 지키는 것 셋
     ① 숫자가 **주기에서 나온다** — 7번이 "제대로 하는 하루"고 최대치 10은 그 위 여유다
     ② **옮기기는 공짜다** — 자리를 바꿔 보는 데 벌이 붙으면 게임이 제 교훈과 싸운다
     ③ **빨리감기가 안 막힌다** — 날마다 가득 차므로 저절로 따라온다
============================================================ */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newState, waterCrop, resowCrop } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, CROP_KINDS, placeBeansprout } from '../src/game/first_play.js';
import { STAMINA_MAX, ACT_COST, costOf, canAct, spend, resetDay,
         staminaOf, staminaView, createStaminaState } from '../src/game/stamina.js';

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
};
const check = (name, fn) => { try { fn(); pass++; console.log(`PASS  ${name}`); }
                              catch (e) { fail++; console.log(`FAIL  ${name}\n      → ${e.message}`); } };

const bal = JSON.parse(readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8'));
const RULES = firstPlayRulesFromBalance(bal);
const mk = () => newState({ mode: 'novice', room: 'banjiha', firstPlay: true, firstPlayRules: RULES });

/* ══ A · 숫자가 규칙에서 나오나 ═══════════════════════════════════════════ */
check('A-1 ★최대치가 "완전 시차로 두 작물을 다 굴리는 하루"보다 여유가 있다', () => {
  /* 완전 시차 = 거두는 날을 하루씩 어긋나게 두는 것(first_play §겹침).
     그때 하루에 드는 손 = 종류마다 (물 1 + 수확 1 + 심기 1) + 몬스테라 물 1. */
  const perKind = CROP_KINDS.length * 3;
  const needed = perKind + 1;
  assert.equal(needed, 7, `주기에서 나온 하루 손질이 ${needed}번입니다 — 문서(docs/stamina.md §2)는 7번입니다`);
  assert.ok(STAMINA_MAX > needed,
    `최대치 ${STAMINA_MAX} 가 하루 손질 ${needed} 보다 커야 합니다 — 딱 맞으면 실수 한 번이 그날을 망칩니다`);
  assert.ok(STAMINA_MAX <= needed * 2,
    `최대치 ${STAMINA_MAX} 가 하루 손질의 두 배를 넘으면 상한 노릇을 못 합니다`);
});

check('A-2 ★옮기기·돌리기·시간 보내기는 **공짜**다 (자리를 바꿔 보는 데 벌이 붙으면 안 된다)', () => {
  for (const free of ['move', 'turn', 'place', 'nextDay', 'fastForward', '없는동작'])
    assert.equal(costOf(free), 0, `${free} 가 체력을 씁니다 — 0이어야 합니다`);
});

check('A-3 돌보는 동작은 전부 1씩 쓴다', () => {
  for (const k of ['water', 'harvest', 'sow', 'cut', 'repot'])
    assert.equal(costOf(k), 1, `${k} 비용이 ${costOf(k)} 입니다`);
  assert.equal(Object.keys(ACT_COST).length, 5, '동작 표에 예상 밖의 항목이 있습니다');
});

/* ══ B · 셈이 맞나 ═══════════════════════════════════════════════════════ */
check('B-1 쓰면 줄고, 모자라면 안 쓰고 false 를 낸다 (음수로 안 내려간다)', () => {
  const S = mk();
  const st = staminaOf(S);
  st.max = 2; st.left = 2;
  assert.equal(spend(S, 'water'), true);
  assert.equal(st.left, 1);
  assert.equal(spend(S, 'water'), true);
  assert.equal(st.left, 0);
  assert.equal(spend(S, 'water'), false, '바닥인데 썼습니다');
  assert.equal(st.left, 0, '음수로 내려갔습니다');
});

check('B-2 canAct 는 **던지지 않고** 이유를 낸다 (안내지 고장이 아니다)', () => {
  const S = mk();
  staminaOf(S).left = 0;
  const r = canAct(S, 'water');
  assert.equal(r.ok, false);
  assert.ok(r.reason && /오늘은 여기까지/.test(r.reason), `이유가 ${r.reason}`);
  /* 공짜 동작은 바닥이어도 된다 */
  assert.equal(canAct(S, 'move').ok, true, '바닥인데 옮기기가 막혔습니다');
});

check('B-3 하루가 가면 **가득 찬다** — 이월도 누적도 없다', () => {
  const S = mk();
  const st = staminaOf(S);
  st.left = 3; st.spentToday = 7;
  resetDay(S, 5);
  assert.equal(st.left, st.max, '가득 안 찼습니다');
  assert.equal(st.spentToday, 0);
  assert.equal(st.day, 5);
  /* 이월 금지 — 안 쓰고 넘겨도 최대치를 안 넘는다 */
  resetDay(S, 6);
  assert.equal(st.left, st.max, `안 쓴 만큼 쌓였습니다(${st.left} > ${st.max})`);
});

check('B-4 옛 세이브·칸 없는 판도 던지지 않고 만들어 준다', () => {
  const S = mk();
  delete S.stamina;
  const st = staminaOf(S);
  assert.ok(st && st.max === STAMINA_MAX, '칸을 안 만들어 줬습니다');
  S.stamina = { schema: 'stamina/0', max: 3, left: 1 };     // 옛 규약
  assert.equal(staminaOf(S).max, STAMINA_MAX, '모르는 규약을 그대로 썼습니다');
});

/* ══ C · 실제 동작에 붙었나 ══════════════════════════════════════════════ */
check('C-1 물주기가 체력을 쓴다', () => {
  const S = mk();
  placeBeansprout(S.firstPlay, 'banjiha-dresser:1');
  const before = staminaOf(S).left;
  waterCrop(S);
  assert.equal(staminaOf(S).left, before - 1, `물을 줬는데 ${staminaOf(S).left} (전 ${before})`);
});

check('C-2 ★바닥이면 물주기가 **막히고**, 그때 상태는 하나도 안 바뀐다', () => {
  const S = mk();
  placeBeansprout(S.firstPlay, 'banjiha-dresser:1');
  staminaOf(S).left = 0;
  const before = JSON.stringify(S.firstPlay.beansprout);
  assert.throws(() => waterCrop(S), /오늘은 여기까지/);
  assert.equal(JSON.stringify(S.firstPlay.beansprout), before,
    '막혔는데 시루 상태가 바뀌었습니다 — 반쯤 준 물이 생겼습니다');
});

check('C-3 ★막힌 것은 **고장이 아니라 안내**다 (tutorialInput 이 붙는다)', () => {
  const S = mk();
  placeBeansprout(S.firstPlay, 'banjiha-dresser:1');
  staminaOf(S).left = 0;
  try { waterCrop(S); assert.fail('안 던졌습니다'); }
  catch (e) { assert.equal(e.tutorialInput, true,
    'tutorialInput 이 없으면 game.html 이 판을 통째로 잠급니다(isRecoverable)'); }
});

check('C-4 ★이미 준 시루에 또 눌러도 체력이 안 준다', () => {
  const S = mk();
  placeBeansprout(S.firstPlay, 'banjiha-dresser:1');
  waterCrop(S);
  const after1 = staminaOf(S).left;
  const r = waterCrop(S);                       // 오늘 또 — 아무 일도 안 난다
  /* ⚠ `watered` 는 boolean 이다(0 이 아니다). 형을 단정하지 말고 **거짓인지**만 본다 —
     이 검사가 지키려는 것은 "아무 일도 안 났으면 체력도 안 준다"이지 반환 형이 아니다. */
  assert.ok(!r.watered, `두 번째 물주기가 ${r.watered} 로 무언가를 시작했습니다`);
  assert.equal(staminaOf(S).left, after1,
    '아무 일도 안 났는데 체력이 줄었습니다 — "눌렀더니 오늘이 끝났다"가 됩니다');
});

/* ══ D · 빨리감기·하루 넘기기가 안 막힌다 ════════════════════════════════ */
check('D-1 ★하루를 넘기는 데는 체력이 안 든다 — 바닥이어도 넘어간다', () => {
  const S = mk();
  staminaOf(S).left = 0;
  assert.equal(canAct(S, 'nextDay').ok, true, '하루 넘기기가 막혔습니다');
});

check('D-2 ★날이 바뀌면 저절로 가득 찬다 (빨리감기가 이걸 날마다 탄다)', () => {
  const S = mk();
  const st = staminaOf(S);
  st.left = 0;
  resetDay(S, S.day + 1);                       // loop.nextDay 가 하는 그 일
  assert.equal(st.left, st.max, '날이 바뀌었는데 안 찼습니다');
});

/* ══ E · 화면이 읽는 값 ══════════════════════════════════════════════════ */
check('E-1 staminaView 가 화면이 쓸 값을 낸다 (문구는 안 만든다)', () => {
  const S = mk();
  staminaOf(S).left = 4;
  const v = staminaView(S);
  assert.equal(v.left, 4); assert.equal(v.max, STAMINA_MAX);
  assert.equal(v.empty, false);
  assert.ok(Math.abs(v.ratio - 4 / STAMINA_MAX) < 1e-9);
  staminaOf(S).left = 0;
  assert.equal(staminaView(S).empty, true);
});

/* ══ F · 상한이 실제로 노가다를 막나 ═════════════════════════════════════ */
check('F-1 ★시루를 얼마나 늘리면 하루에 다 못 돌보나 — 규칙에서 나오는 천장', () => {
  const bean = CROP_KINDS.find(k => k.id === 'beansprout');
  /* 완전 시차면 하루에 (시루수 / 주기) 번씩 물·수확·심기가 난다 */
  const actsFor = (n) => Math.round(n / bean.harvestDays * 3);
  const cap = (() => { for (let n = 1; n <= 60; n++) if (actsFor(n) > STAMINA_MAX) return n - 1; return 60; })();
  console.log(`      시루 5개 ${actsFor(5)}번 · 10개 ${actsFor(10)}번 · 15개 ${actsFor(15)}번 → 체력이 정하는 천장 **${cap}개**`);
  assert.ok(cap >= 10 && cap <= 20,
    `체력이 정하는 시루 천장이 ${cap}개입니다 — 끼니 상한(10개)보다 조금 위여야 "팔아야 뜻이 생기는 구간"이 납니다`);
});

console.log(`\nstamina: ${fail ? 'FAIL' : 'PASS'}  (${pass}/${pass + fail})`);
process.exit(fail ? 1 : 0);
