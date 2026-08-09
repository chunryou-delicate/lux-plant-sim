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
import { newState, waterCrop, resowCrop, cropWaterStatus } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, CROP_KINDS, placeBeansprout,
         placeCrop, cropSiteOf, addCropPot } from '../src/game/first_play.js';
import { STAMINA_MAX, ACT_COST, costOf, canAct, spend, resetDay,
         staminaOf, staminaView, createStaminaState,
         /* ★ 2026-08-09 · 표에서 오는 규칙·경험치 */
         staminaRulesFrom, xpNeededAt, gainXp, takeLevelUps } from '../src/game/stamina.js';

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
check('A-1 ★시작 최대체력은 **표가 정하고**, 그 값은 하루를 다 돌보기에 **모자란다**', () => {
  /* ★★ 2026-08-09 — 이 검사가 지키던 것이 **둘 다 뒤집혔다**(박사님 확정).
       ① 예전 전제: 「하루 손질은 종류마다 3번, 합 7번」 — 이젠 아니다.
         물·수확·심기가 **시루마다 1** 이라(박사님: *"체력은 물주기 수확하기 심기
         할 때 다 소모되도록 하자고."*) 시루 5개면 거두는 데만 5가 든다.
       ② 예전 결론: 「최대치는 그보다 여유가 있어야 한다(10)」 — 이젬 반대다.
         시작 5 는 **모자라야 한다.** 모자라야 「오늘 무엇을 먼저 할까」가 생기고,
         돌본 만큼 늘어나는 것(§경험치)이 보상이 된다.
     ★ 그래서 이젠 지키는 것은 **숫자가 어디서 오느냐**다 — 코드가 아니라 표에서. */
  const J = JSON.parse(readFileSync(new URL('../data/balance/stamina.json', import.meta.url), 'utf8'));
  const R = staminaRulesFrom(J);
  assert.equal(R.source, 'data/balance/stamina.json', '표를 안 읽고 밑값으로 돕니다');
  assert.equal(R.startMax, J.startMax, '표의 startMax 와 규칙이 다릅니다');
  assert.equal(STAMINA_MAX, R.startMax,
    `코드 밑값(${STAMINA_MAX})과 표(${R.startMax})가 갈렸습니다 — 둘이 갈리면 밑값으로 도는 판만 다른 게임이 됩니다`);

  /* ★ 첫 시루 하나는 반드시 굴려야 한다 — 물1+수형1+심기1 = 3 */
  assert.ok(R.startMax >= 3,
    `시작 ${R.startMax} 으로는 시루 하나의 한 회전도 못 돌립니다(물·수확·심기 = 3)`);
  /* ★★ 그러나 「시루 5개 완전 시차」는 **못 받아야** 한다 — 그것이 상한의 뜻이다 */
  const fullDay = 5 * 3;
  assert.ok(R.startMax < fullDay,
    `시작 ${R.startMax} 가 시루 5개 하루치(${fullDay})를 다 받아버리면 체력이 상한 노릅을 못 합니다`);
  /* 오를 수 있어야 한다 — 안 오르면 그냥 낮춘 상한이지 성장이 아니다 */
  /* ★★ 2026-08-09 — 상한이 **없어졌다**(박사님: "체력도 상한이 없이 계속 ×10 쓰면 1씩 오른다 치고").
     그래서 `maxCap > startMax` 를 못 물어본다 — `null` 이다.
     ⚠ 대신 **오를 수 있는가**를 직접 묻는다. 그것이 원래 재려던 것이고, 상한이 있건 없건 같은 말이다. */
  assert.ok(xpNeededAt(R.startMax, R) != null,
    '시작값에서 더 오를 데가 없습니다 — 그러면 성장이 아니라 고정값입니다');
  assert.ok(R.maxCap == null || R.maxCap > R.startMax,
    '상한을 둔 판이라면 시작값보다는 커야 합니다');
  console.log(`      시작 ${R.startMax} · 천장 ${R.maxCap == null ? "없음" : R.maxCap} · 첫 칸 ${R.levelTable[R.startMax]}번 · 표=${R.source}`);
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
  /* ★ 2026-08-09 — 이유에 **숫자와 처방**이 들어갔다(0/5 · [다음 날]).
     체력이 5 로 내려가 상한에 닿는 날이 실제로 생기므로 「여기까지」만으로는 모자란다 */
  assert.ok(r.reason && /손이 다 떨어졌습니다/.test(r.reason), `이유가 ${r.reason}`);
  assert.ok(/다음 날/.test(r.reason), `어떻게 하라는 말이 없습니다: ${r.reason}`);
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
  /* ★ 2026-08-09 — 문구가 바뀜다: 왜 안 되는지와 **어떻게 하는지**를 같이 말한다 */
  assert.throws(() => waterCrop(S), /손이 다 떨어졌습니다/);
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

/* ══ C-5 · ★작물이 둘일 때 물이 **둘 다** 간다 (2026-08-06) ══════════════════
   무순을 사고 심고 놓아도 **회전이 영영 시작 안 됐다** — 화면이 `waterCrop(S)` 를
   종류 없이 불러 언제나 콩나물에 줬기 때문이다. 버튼은 「2개 대기」라 해 놓고서.
   ⇒ 이 검사가 그 구멍을 막는다. 작물이 셋째로 늘어도 같은 규칙이면 저절로 걸린다. */
check('C-5 ★기다리는 작물이 둘이면 두 번 눌러 **둘 다** 시작된다', () => {
  const S = mk();
  placeBeansprout(S.firstPlay, 'banjiha-dresser:1');
  const ms = cropSiteOf(S.firstPlay, 'musun');
  ms.pots = [{ id: 'm1', harvested: false, startedOnDay: null, ageDays: 0, dliHist: [] }];
  placeCrop(S.firstPlay, 'musun', 'banjiha-desk:0');

  /* 화면(reallyWater)이 하는 그대로 — 기다리는 종류를 골라 준다 */
  const press = () => {
    const w = cropWaterStatus(S);
    const t = (w.byKind || []).find(k => k.needsWater);
    return { ko: t ? t.kindKo : null, r: waterCrop(S, { kind: t ? t.kind : 'beansprout' }) };
  };
  const a = press(), b = press();
  assert.equal(a.ko, '콩나물', `첫 번째가 ${a.ko} 입니다`);
  assert.equal(b.ko, '무순', `두 번째가 ${b.ko} 입니다 — 무순에 물이 안 갑니다`);
  assert.ok(S.firstPlay.beansprout.pots[0].startedOnDay != null, '콩나물이 안 시작됐습니다');
  assert.ok(ms.pots[0].startedOnDay != null,
    '★무순이 안 시작됐습니다 — 사고 심고 놓아도 못 키웁니다');
  assert.equal(cropWaterStatus(S).waiting, 0, '아직 기다리는 것이 남았습니다');
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
/* ══ F · ★★ 체력이 실제로 무엇을 막나 — **시루 수는 아니다** (2026-08-06 정정) ══════
   처음엔 「완전 시차면 시루마다 손 3번」으로 세어 천장을 15개(실질 13개)라고 적었다.
   **그 셈이 틀렸다.** 코드는 시루마다가 아니라 **부를 때마다** 1을 문다 —
   `harvestCrop` 이 익은 시루를 전부 거두고 1, `resowCrop` 이 전부 심고 1이다.
   ⇒ 시루를 50개 깔아도 하루 손이 안 늘어난다. 체력은 시루 수의 상한이 **못 된다.**
   ⇒ 이 검사는 이제 그 **사실 자체**를 못 박는다. 문서(docs/stamina.md §2)와 짝이다. */
check('F-1 ★손은 **부를 때마다** 1이다 — 시루 수가 늘어도 안 는다', () => {
  const mkFull = (n) => {
    const S = mk();
    placeBeansprout(S.firstPlay, 'banjiha-dresser:1');
    const site = S.firstPlay.beansprout;
    site.pots = Array.from({ length: n }, (_, i) =>
      ({ id: 'p' + i, harvested: true, startedOnDay: null, ageDays: 0, dliHist: [] }));
    S.shop.stock = { siru: 40, bean_seed: 80 };
    return S;
  };
  const cost = (S, n) => { const b = staminaOf(S).left; resowCrop(S, { sirus: n }); return b - staminaOf(S).left; };
  const c15 = cost(mkFull(15), 15), c2 = cost(mkFull(2), 2);
  console.log(`      시루 15개 다시 심기 ${c15}손 · 2개 ${c2}손 — 같아야 맞다`);
  assert.equal(c15, 1, `시루 15개를 심는 데 ${c15}손이 듭니다`);
  assert.equal(c2, 1, `시루 2개를 심는 데 ${c2}손이 듭니다`);
});

/* ★ 그러면 무엇이 손을 늘리나 — **종류 수**다. 그게 지금 체력이 실제로 재는 축이다. */
check('F-2 ★손을 늘리는 것은 **시루 수**다 (2026-08-09 뒤집힘)', () => {
  /* ★★ 이 검사가 지키던 말은 *「손을 늘리는 것은 시루 수가 아니라 종류 수다」* 였다.
     박사님이 **반대로** 확정하셨다: *"체력은 물주기 수확하기 심기 할 때 다 소모되도록 하자고."*
     ⇒ 물·수확·심기가 **시루마다 1** 이다.
     ★ 왜 바뀜이 맞나 — 종류 수로 묶으면 시루를 늘릴수록 한 개당 손이 **싸진다.**
       그러면 체력은 「많이 깔수록 이득」을 못 막고, 그것이 이 계통이 생긴 이유였다
       (stamina.js 머리말: 「잉여를 팔 수 있으면 시루를 늘릴 이유가 무한해진다」).
     ⚠ 그래서 옛 결론(「하루치가 최대치 안에 들어야 한다」)도 같이 버린다 —
       이제는 **안 들어가는 것이 맞다.** 그것이 「오늘 무엇을 먼저 할까」를 만든다. */
  const S = mk();
  placeBeansprout(S.firstPlay, 'banjiha-dresser:1');
  for (let i = 2; i <= 3; i++) addCropPot(S.firstPlay, 'beansprout', { day: 0 });
  placeBeansprout(S.firstPlay, 'banjiha-dresser:1');     // 셋을 다 놓는다
  const before = staminaOf(S).left;
  waterCrop(S); waterCrop(S);                            // 시루 둘에 물
  const used = before - staminaOf(S).left;
  assert.equal(used, 2,
    `시루 둘에 물을 줬는데 손이 ${used} 들었습니다 — 시루마다 1 이어야 합니다`);
  /* ★ 그리고 시루 5개짜리 하루는 최대치를 **넘어야** 한다(상한이 물린다는 뜻) */
  const fullDay = 5 * 3;
  console.log(`      시루 3개 · 물 두 번 = 손 ${used} · 시루 5개 하루치 ${fullDay} > 시작 체력 ${STAMINA_MAX}`);
  assert.ok(fullDay > STAMINA_MAX,
    `시루 5개 하루치(${fullDay})가 체력 ${STAMINA_MAX} 안에 들어가면 상한이 아무것도 안 막습니다`);
});

console.log(`\nstamina: ${fail ? 'FAIL' : 'PASS'}  (${pass}/${pass + fail})`);
process.exit(fail ? 1 : 0);
