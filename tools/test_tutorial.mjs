/* 반지하 튜토리얼 재현 — docs/story_arc.md §1·§2·§3·§4
 *
 *   node tools/test_tutorial.mjs
 */
import assert from 'node:assert';
import {
  TUTORIAL_RULES, createTutorialState, tutorialDay, seasonAt, seasonDayAt,
  noteLearning, learningLeft, canMoveOut, moveOut, buyLamp,
  lampElectricityWon, foodSavedWon, tutorialGoal,
  /* ★ 2026-08-13 — 탈출의 둘째 축(무늬 삽수 판매). tutorial.js §무늬 삽수를 판 적이 있다 */
  noteVarieCuttingSale, hasSoldVarieCutting
} from '../src/game/tutorial.js';

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const mk = () => createTutorialState({ enabled: true });
/* 배운 것을 전부 채운다 — 돈 조건만 따로 보고 싶을 때 쓴다 */
const teachAll = (ts) => noteLearning(ts, {
  harvested: true, foodSavedWon: 5000, cropAvgDli: 0.1,
  plantDli7: 3.8, plantMinDli: 3.0, spearFurled: true
});

/* ══ A · 첫 플레이 동안 — **살림은 돌고 계절은 안 돈다** ══════════════════
   ★★★ 2026-08-30 — 여기 있던 것은 「날짜·돈·계절 «전부» 정지」였다. **낡았다.**
     2026-08-16 에 박사님이 *"살림 시계 첫날부터"* 로 정하셨다(`tutorial.js §tutorialDay`).
     까닭은 실측이다 — 첫 플레이가 37일이라, 멈춰 두면 **첫 월세가 달력 37일에** 나갔다.
   ⚠ 그런데 «계절»은 그때도 안 건드렸다. 첫 플레이는 「맑음·여름 고정」이 계약이라
     그것까지 풀면 배우는 구간에 겨울이 온다.
   ⇒ 그러니 재는 뜻은 「전부 정지」가 아니라 ★ **「둘이 «갈려» 있나」**다.
     그 둘이 한 줄에 묶여 있던 것이 그날 사고의 «모양»이었으니, 갈린 것을 자로 지킨다. */
check('A 첫 플레이 중 — 살림은 첫날부터 돌고 계절만 멈춰 있다', () => {
  const ts = mk();
  const before = ts.cashWon;
  for (let i = 0; i < 20; i++) tutorialDay(ts, { firstPlayDone: false });
  assert.equal(ts.day, 20, '살림 시계가 안 돌았습니다 — 첫 월세가 달력 한참 뒤로 밀립니다');
  assert.ok(ts.cashWon < before, '돈이 한 톨도 안 나갔습니다');
  assert.equal(ts.seasonRunning, false, '계절이 돌기 시작했습니다 — 배우는 구간에 겨울이 옵니다');
  assert.equal(seasonAt(ts, ts.day), 'summer', '첫 플레이 중인데 여름이 아닙니다');
  /* 첫 플레이가 끝나면 그때 계절이 켜진다 — 갈린 둘이 각자 제 때에 켜지나 */
  tutorialDay(ts, { firstPlayDone: true });
  assert.equal(ts.seasonRunning, true, '첫 플레이가 끝났는데 계절이 안 돕니다');
});

/* ══ B · 계절 — 여름 45일차에서 시작해 45일 뒤 가을 ═══════════════════════ */
check('B 계절 — 시작 여름 · 45일 뒤 가을 · 135일 뒤 겨울', () => {
  const ts = mk();
  assert.equal(seasonAt(ts, 0), 'summer', '시작이 여름이 아닙니다');
  assert.equal(seasonDayAt(ts, 0), TUTORIAL_RULES.startSeasonDay, '여름 45일차가 아닙니다');
  assert.equal(seasonAt(ts, 44), 'summer', '44일째가 벌써 가을입니다');
  assert.equal(seasonAt(ts, 45), 'autumn', '45일째가 가을이 아닙니다');
  assert.equal(seasonAt(ts, 135), 'winter', '135일째가 겨울이 아닙니다');
});

/* ══ C · 하루 지출과 콩나물 절감 ═════════════════════════════════════════
   ★2026-08-03 정정 — 예전에는 `spentWon === dailySpendWon(20,000)` 을 확인했다.
     그런데 월세 30만이 30일마다 **따로** 또 빠지고 있었다. `dailySpendWon` 은
     food_economy.md §2 표대로 **월세 10,000원을 이미 포함한** 하루 지출 합이라,
     그 상태에서는 월세가 두 번 나가 실제 지출이 하루 30,000원(월 90만)이었다.
     지금은 하루치에서 월세 몫을 빼고(=10,000) 월세는 목돈으로 낸다 —
     **30일 평균은 그대로 20,000원**이고, 그것을 아래에서 직접 잰다. */
/* ★★ 2026-08-09 — **45만 → 60만.** 월세가 15만에서 30만으로 되돌아갔다(박사님 확정).
     10,000(월세 몫) × 30 + 300,000(목돈) = 600,000. 하루 평균은 20,000원 = 월 60만이다.
   ⚠ `rentWon` 과 `dailySpendWon` 은 같이 움직인다 — 이 검사가 바로 그 짝을 지킨다.
     한쪽만 바꾸면 이 숫자가 안 움직이거나 두 배가 된다(2026-08-05 에 실제로 그랬다). */
check('C 하루 지출 — 월세를 두 번 안 뗀다 · 30일 평균이 16,667원', () => {
  const ts = mk();
  const r0 = tutorialDay(ts, { firstPlayDone: true, mealsUsed: 0 });
  assert.equal(r0.spentWon, 10_000, `하루 현금 지출이 ${r0.spentWon} — 월세 몫을 뺀 10,000이어야 합니다`);
  assert.equal(r0.dailyBaseWon, 10_000);

  const ts2 = mk();
  const r1 = tutorialDay(ts2, { firstPlayDone: true, mealsUsed: 3 });
  assert.equal(r1.savedWon, 7500, `절감이 ${r1.savedWon}`);
  assert.equal(r1.spentWon, 10_000 - 7_500, `절감 뒤 지출이 ${r1.spentWon}`);

  /* ★진짜로 재는 것 — 유예가 끝난 뒤 30일 동안 실제로 얼마가 빠지나.
     ★★ 2026-08-05 — **20,000원(월 60만) → 15,000원(월 45만)** (박사님 확정, 월세 30만 → 15만).
       살림이 구조적 적자였다: 하루 지출 20,000원인데 벌 수 있는 최대가 8,000원이라
       무엇을 하든 60~90일에 파산했고 이사는 189일에나 됐다. 게다가 0원이면 씨앗도 못 사서
       회전이 끝나면 벌이가 통째로 끊겼다 — 되돌아올 길이 없었다.
       ⇒ 이 숫자가 바뀐 것은 **검사가 물러선 것이 아니라 기획이 바뀐 것**이다.
       ⚠ `rentWon` 과 `dailySpendWon` 은 같이 움직인다 — 한쪽만 바꾸면 총액이 그대로다
         (tutorial.js §rentWon 의 ⚠). 이 검사가 바로 그 짝을 지킨다. */
  const ts3 = mk();
  ts3.cashWon = 5_000_000;          // 0원 클램프에 걸리지 않게 넉넉히 — 여기서 재는 건 지출뿐이다
  for (let i = 0; i < 30; i++) tutorialDay(ts3, { firstPlayDone: true, mealsUsed: 0 });
  const after30 = ts3.cashWon;
  for (let i = 0; i < 30; i++) tutorialDay(ts3, { firstPlayDone: true, mealsUsed: 0 });
  /* ★★ 2026-08-09 — **60만 → 50만원** (박사님 확정, 월세 30만 → **20만**).
       월세 200,000 + 공과 75,000 + 식비 225,000 = **500,000원/월** = 하루 16,667원.
     ★ 위 `r0.spentWon === 10,000` 은 **안 움직였다** — 하루 지출과 월세 몫이 같이 내려가
       차액(하루 현금차감)이 그대로이기 때문이다. 그게 이 짝이 맞물려 있다는 증거다:
       월세만 내리면 여기 500,000 이 안 내려가고, 하루치만 내리면 r0 가 어긋난다. */
  const spent = after30 - ts3.cashWon;
  assert.equal(spent, 500_000, `한 달 지출이 ${spent.toLocaleString()}원 — 50만원이어야 합니다`);
});

/* ══ C-2 · ★전기세가 **실제로 켠 것**을 따라간다 (2026-08-06) ══════════════
   예전에는 `ts.lamp.owned`·`ts.lamp.litHours` 만 봤는데 화면이 켜는 것은 `S.lamps` 였고
   **둘을 아무도 안 맞췄다.** 그래서 등을 꺼도 요금이 그대로 나갔고, 24시간을 틀어도
   요금이 한 푼도 안 올랐다 — 전기세가 밸런스 손잡이가 될 수 없던 이유다. */
check('C-2 ★전기세 — 끄면 0원 · 오래 켜면 그만큼 · 안 산 등은 0원', () => {
  const ts = mk();
  /* 안 산 등을 켰다고 넘겨도 요금이 없다 — 없는 물건의 전기를 물릴 수는 없다 */
  assert.equal(lampElectricityWon(ts, { count: 2, litHours: 24 }), 0,
    '안 산 등에 요금이 붙었습니다');

  ts.lamp.unlocked = true; buyLamp(ts); buyLamp(ts);
  const base = lampElectricityWon(ts, { count: 1, litHours: 12 });
  assert.ok(base > 0, '켰는데 요금이 0원입니다');
  assert.equal(lampElectricityWon(ts, { count: 0, litHours: 12 }), 0,
    '★껐는데 요금이 나갑니다 — 켜고 끄기가 돈에 안 닿습니다');
  /* ★★ 2026-08-09 — 「두 개면 두 배」를 **일부러 뺐다.** 등마다 와트가 다르다:
     1개 = 바 20W, 2개 = 바+집게 32W 다(room_profile.banjiha §lampWatts). 두 배가 되면
     그건 와트가 다시 한 벌로 뭉갠 것이다 — 그 상태가 바로 여기서 고친 버그다. */
  const two = lampElectricityWon(ts, { count: 2, litHours: 12 });
  assert.ok(two > base, '두 개를 켰는데 요금이 안 늘었습니다');
  assert.ok(two < base * 2,
    `★두 개가 정확히 두 배입니다(${two}) — 등마다 와트가 다른데 하나로 뭉개고 있습니다`);
  /* 두 배로 오래 켜면 두 배. ⚠ 1원 안의 차는 반올림이다 — 20W·12h 는 38.4원이라
     38 로 떨어지고 24h 는 76.8 → 77 이 된다. 옛 12W 에서는 23.04·46.08 이라 우연히 딱 맞았다. */
  assert.ok(Math.abs(lampElectricityWon(ts, { count: 1, litHours: 24 }) - base * 2) <= 1,
    '★두 배로 오래 켰는데 요금이 그대로입니다');
  /* 켠 개수는 산 개수를 못 넘는다 */
  assert.equal(lampElectricityWon(ts, { count: 9, litHours: 12 }), two,
    '산 것보다 많이 켠 요금이 나갑니다');
  /* ★ 와트를 직접 받아도(방 조도 계약의 report.energy.watts) 산 등의 합을 못 넘는다 */
  assert.equal(lampElectricityWon(ts, { count: 2, litHours: 12, wattsOn: 9_999 }), two,
    '안 산 등의 와트로 요금이 나갔습니다');
  /* 아무것도 안 넘기면 예전 그대로 — 옛 호출부가 안 깨진다 */
  assert.equal(lampElectricityWon(ts), lampElectricityWon(ts, { count: 2, litHours: ts.lamp.litHours }),
    '인자 없이 부른 값이 예전과 다릅니다');
});

/* ══ D · 월세 — 첫날 청구 · 그 뒤 30일마다 ═══════════════════════════ */
/* ★★ 2026-08-09 — **[30, 60, 90] → [1, 31, 61, 91].** 첫 달 유예를 폐지했다(박사님 확정).
   원문: *"바로 시작날이 바로 30일기준 마지막날인거야. 다음날 누르면 월세 30만원이 쓱 빠지게"*
   ⇒ 첫 [다음 날]에 바로 청구되고, 그 뒤로도 정확히 30일 간격이다. 간격이 안 변한 것이
     이 검사의 요점이다 — 첫날로 당기면서 주기가 29일이 되는 실수가 나기 쉬운 자리다. */
check('D 월세 — 첫날 청구 · 그 뒤 30일마다 (유예 없음)', () => {
  const ts = mk();
  const due = [];
  for (let i = 1; i <= 95; i++) {
    const r = tutorialDay(ts, { firstPlayDone: true, mealsUsed: 3 });
    if (r.rentWon > 0) due.push(r.day);
  }
  assert.deepEqual(due, [1, 31, 61, 91], '월세 청구일이 ' + due.join(',') + ' 입니다');
});

/* ══ E · 식물등 — 가을에 해금 · 사면 돈이 빠지고 전기가 붙는다 ═══════════ */
/* ★★ 2026-08-09 — **23원 → 38원.** 검사가 물러선 것이 아니라 **와트가 정정된 것**이다.
   예전 `TUTORIAL_RULES.lampWatt` 는 12W 하나였다: 어떤 기구를 켜든 개당 12W 로 셌다.
   그런데 방에 실제로 달린 첫 등은 **바 20W** 이고(data/lighting_presets.json ·
   room_profile.banjiha.json §lampWatts [0, 20, 32]), 방 조도 계약(report.energy.won)은
   내내 20W 로 세고 있었다. 즉 화면과 지갑이 서로 다른 와트를 보고 있었다.
   ⇒ 20W × 12h × 160원/kWh = **38원**. 12 → 20 은 ×1.667 이고 23 × 1.667 = 38 이다. */
/* ★ 값을 이름에 박지 않는다 — 2026-08-23 까지 「25,000원」이라 적혀 있었는데 정본은 120,000 이었다.
   단언은 처음부터 TUTORIAL_RULES 를 읽고 있어 판정은 안 갈렸다. **사람이 읽는 문구만 거짓말했다.**
   문구가 거짓말하면 다음 사람이 그걸 근거로 판단한다(§2.8 · 계율 ⑰). 정본에서 읽어 찍는다. */
check(`E 식물등 — 가을 해금 · ${TUTORIAL_RULES.lampPriceWon.toLocaleString()}원 · 전기 38원/일(바 20W)`, () => {
  const ts = mk();
  let unlockedAt = null;
  for (let i = 1; i <= 60 && !unlockedAt; i++) {
    const r = tutorialDay(ts, { firstPlayDone: true, mealsUsed: 3 });
    if (r.events.some(e => e.id === 'lamp_unlocked')) unlockedAt = r.day;
  }
  assert.equal(unlockedAt, 45, `해금이 ${unlockedAt}일째입니다 — 가을 진입(45)이어야 합니다`);
  const before = ts.cashWon;
  buyLamp(ts);
  assert.equal(ts.cashWon, before - TUTORIAL_RULES.lampPriceWon, '값이 안 빠졌습니다');
  assert.equal(ts.lamp.owned, 1);
  assert.equal(lampElectricityWon(ts), 38, `전기가 ${lampElectricityWon(ts)}원/일 입니다`);
  const r = tutorialDay(ts, { firstPlayDone: true, mealsUsed: 3 });
  assert.equal(r.electricityWon, 38, '하루 전기가 안 붙었습니다');
});

check('E-2 식물등 — 해금 전에는 못 산다', () => {
  const ts = mk();
  assert.throws(() => buyLamp(ts), /아직 살 수 없습니다/);
});

/* ══ F · 체크리스트 — 코어 값으로 켜지고, 한 번 켜지면 안 꺼진다 ═════════ */
check('F 배움 — 품질로 콩나물 배치를 · DLI 로 몬스테라 자리를 판정', () => {
  const ts = mk();
  assert.equal(learningLeft(ts).length, 4, '처음에 4개가 아닙니다');

  /* ② 콩나물: 자리 이름이 아니라 4일평균 DLI 로 본다 */
  noteLearning(ts, { harvested: true, foodSavedWon: 5000, cropAvgDli: 0.9 });
  assert.equal(ts.learned.harvest, true, '수확·절감이 안 켜졌습니다');
  assert.equal(ts.learned.cropDark, false, '★밝은 데(0.9)서 수확했는데 어두운 자리로 인정됐습니다');
  noteLearning(ts, { harvested: true, foodSavedWon: 5000, cropAvgDli: 0.2 });
  assert.equal(ts.learned.cropDark, true, '어두운 데(0.2)인데 인정 안 됐습니다');

  /* ③ 몬스테라: min 미만이면 인정 안 됨 */
  noteLearning(ts, { plantDli7: 2.4, plantMinDli: 3.0 });
  assert.equal(ts.learned.plantWindow, false, '★어두운 자리인데 창가로 인정됐습니다');
  noteLearning(ts, { plantDli7: 3.8, plantMinDli: 3.0 });
  assert.equal(ts.learned.plantWindow, true);

  noteLearning(ts, { spearFurled: true });
  assert.equal(learningLeft(ts).length, 0, '넷이 다 안 켜졌습니다');

  /* ★한 번 켜지면 안 꺼진다 — 나중에 자리를 옮겼다고 배운 게 없던 일이 되면 안 된다 */
  noteLearning(ts, { plantDli7: 0.1, plantMinDli: 3.0, cropAvgDli: 5 });
  assert.equal(learningLeft(ts).length, 0, '★배운 것이 되돌려졌습니다');
});

/* ══ G · 이사 — 두 축을 함께 본다 ══════════════════════════════════════
   ★★ 2026-08-13 박사님 확정으로 **둘째 축이 갈렸다** — 「배움 넷」 → 「무늬 삽수 판매」.
       원문: *"탈출 조건을 2개로 하지. 돈이랑 무늬 삽수 팔기."*
   ⚠ 여기 있던 옛 계약을 적어 둔다(START-HERE §2: 검사가 무엇을 지키고 있었는지):
       예전 G 는 `canMoveOut(ts).ok === money && learningLeft.length === 0` 을 못 박고 있었고,
       `moveOut` 이 던지는 사유가 「못 해 본 것」이라는 것까지 고정하고 있었다.
       그 둘이 이번에 바뀌는 약속이다. **배움 넷 자체는 안 지웠으므로**(안내로 남는다)
       아래에서 `learningLeft` 가 여전히 살아 있는 것도 같이 잰다. */
check('G 이사 — 돈만으로도, 무늬 삽수만으로도 안 된다', () => {
  const ts = mk();
  ts.cashWon = TUTORIAL_RULES.moveOutCostWon;      // 돈은 충분
  teachAll(ts);                                     // ★배움을 다 채워도 그것만으로는 안 열린다
  let c = canMoveOut(ts);
  assert.equal(c.ok, false, '★돈(+배움)만으로 이사가 됐습니다');
  assert.equal(c.money, true);
  assert.equal(c.varie, false);
  assert.equal(c.learningLeft.length, 0, '배움 계통이 사라졌습니다 — 조건에서만 빼기로 했습니다');
  assert.throws(() => moveOut(ts), /무늬 삽수/);

  const ts2 = mk();
  noteVarieCuttingSale(ts2, { variegatedLeaves: 1, won: 80_000 });
  ts2.cashWon = 100;                                // 삽수는 팔았고, 돈은 없음
  c = canMoveOut(ts2);
  assert.equal(c.ok, false, '★무늬 삽수만으로 이사가 됐습니다');
  assert.equal(c.varie, true);
  assert.ok(c.shortWon > 0, '모자란 금액이 안 나옵니다');
  assert.throws(() => moveOut(ts2), /자금이/);

  /* ★ 무늬가 **안 실린** 판매는 안 쳐진다 — 판정 근거가 「무늬로 값이 매겨졌나」 하나라는 것 */
  const ts3 = mk();
  noteVarieCuttingSale(ts3, { variegatedLeaves: 0, won: 12_000 });
  assert.equal(hasSoldVarieCutting(ts3), false, '★민무늬 삽수를 팔았는데 조건이 열렸습니다');

  const ts4 = mk();
  noteVarieCuttingSale(ts4, { variegatedLeaves: 1, won: 80_000 });
  ts4.cashWon = TUTORIAL_RULES.moveOutCostWon;
  assert.equal(canMoveOut(ts4).ok, true, '둘 다 됐는데 이사가 안 됩니다');
  assert.equal(canMoveOut(ts4).why, null, '열렸는데 잠긴 사유가 남아 있습니다');
  const r = moveOut(ts4);
  assert.equal(r.movedOut, true);
  assert.equal(ts4.cashWon, 0, '이사비가 안 빠졌습니다');
  assert.equal(tutorialGoal(ts4).id, 'done');
});

/* ══ H · ★파산해도 안 죽는다 (스토리 전체가 초보 모드) ═══════════════════ */
check('H 돈이 떨어져도 게임이 안 끝난다 · 0원 아래로 안 간다', () => {
  const ts = mk();
  ts.cashWon = 5_000;
  let broke = null;
  for (let i = 0; i < 40; i++) {
    const r = tutorialDay(ts, { firstPlayDone: true, mealsUsed: 0 });
    if (!broke && r.events.some(e => e.id === 'broke')) broke = r.day;
    assert.ok(ts.cashWon >= 0, `★잔액이 음수가 됐습니다: ${ts.cashWon}`);
  }
  assert.ok(broke !== null, '돈이 떨어졌는데 알림이 없습니다');
  assert.equal(ts.movedOut, false);
  assert.ok(ts.day >= 40, '★파산으로 하루가 멈췄습니다 — 초보 모드는 죽지 않습니다');
});

/* ══ I · 목표 안내 — 무엇을 하면 되는지 한 줄 ═══════════════════════════ */
check('I 목표 — 배울 게 남으면 배움을, 다 배웠으면 돈을 말한다', () => {
  const ts = mk();
  assert.equal(tutorialGoal(ts).id, 'learn', '처음엔 배움을 말해야 합니다');
  teachAll(ts);
  /* ★★★ 2026-08-09 — **「돈을 모으는 단계」가 실제로 있어야 한다.**
     ------------------------------------------------------------
     ⚠ 이 자리는 하루 사이에 두 번 바뀌었다. 그 이력을 남긴다.
       ① 시작돈을 130만 → **150만**으로 올렸더니 `moveOutCostWon`(150만)과 **같아졌다.**
          배움을 채우는 순간 곧바로 `ready` 라 **돈 단계가 아예 없어졌다** — 튜토의 목표 줄이
          「이사 자금 N원 남았습니다」를 한 번도 안 말했고, 실측으로 튜토가 게임 48일에 끝나
          가을·식물등·겨울이 통째로 건너뛰어졌다.
       ② 그래서 **이사비를 200만으로 올렸다**(하프문 하나로 넘는 자리).
     ⚠ ①일 때 이 검사가 「바로 ready 여야 한다」로 **고장난 상태를 정상으로 못 박았다.**
       재현이 판을 따라간 게 아니라 **판의 병을 계약으로 굳힌 것**이다. 그게 더 위험하다 —
       고치는 쪽이 검사를 깨게 되기 때문이다(실제로 그랬다).
     ⇒ 이제는 **관계를 잰다**: 시작돈으로는 이사비에 못 닿아야 하고, 그래서 배움을 다 채워도
       「돈」을 말해야 한다. 값이 또 바뀌어도 이 줄은 그대로 유효하다. */
  assert.ok(TUTORIAL_RULES.startCashWon < TUTORIAL_RULES.moveOutCostWon,
    '★시작돈이 이사비 이상입니다 — 첫날부터 이사 조건이 참이라 「돈을 모으는 단계」가 사라집니다');
  /* ★★ 2026-08-13 — **단계가 하나 늘었다.** 배움을 다 채우면 이제 「무늬 삽수」를 말한다.
     ⚠ 옛 검사는 여기서 곧바로 `money` 를 못 박고 있었다. 그게 이번에 바뀌는 약속이다.
     ★ 왜 돈보다 삽수를 먼저 말하나 — 돈은 하루하루 저절로 **줄어드는** 것이라 먼저 말하면
       「기다리세요」가 되고, 할 일이 안 보인다. 삽수는 지금 손으로 할 수 있는 일이다. */
  assert.equal(tutorialGoal(ts).id, 'varie',
    '★배움을 다 채웠는데 무늬 삽수를 안 말합니다 — 남은 목표가 안 보입니다');
  noteVarieCuttingSale(ts, { variegatedLeaves: 1, won: 80_000 });
  assert.equal(tutorialGoal(ts).id, 'money',
    '★삽수를 팔았는데 돈을 안 말합니다 — 남은 목표가 안 보입니다');
  ts.cashWon = TUTORIAL_RULES.moveOutCostWon - 1;
  assert.equal(tutorialGoal(ts).id, 'money', '이사비에 못 미치면 돈을 말해야 합니다');
  ts.cashWon = TUTORIAL_RULES.moveOutCostWon;
  assert.equal(tutorialGoal(ts).id, 'ready');
});

/* ══ J · 표준 진행 — 월세 유예로 데드라인이 성립하는가 ═══════════════════ */
check('J 표준 진행 — 콩나물 3끼로 버티면 며칠 가나', () => {
  /* ★★ 2026-08-17 — **자를 고쳤다. 판이 바뀌었기 때문이다**(§reliefWon).
     ══════════════════════════════════════════════════════════════════
     박사님: *"처음 0원 됐을 때는 긴급자금 대출 50만원 … 그다음 죽는 걸로."*
     ⇒ 이제 0원이 되면 **딱 한 번** 50만원이 들어온다. 그래서 「0원이 될 때까지」로 재면
       두 번을 재게 되고 211일이 나온다 — 자가 틀린 게 아니라 **재는 대상이 둘로 늘었다.**
     ⇒ 이 자는 **구호금을 이미 쓴 판**을 잰다. 그것이 진짜 데드라인이다(두 번째 0원 = 죽음).
       구호금 자체는 아래 J-2 가 따로 잰다 — 한 자에 두 가지를 재면 어느 쪽이 깨졌는지 모른다. */
  const ts = mk(); ts.reliefTaken = true;
  let day = 0;
  while (ts.cashWon > 0 && day < 400) { tutorialDay(ts, { firstPlayDone: true, mealsUsed: 3 }); day = ts.day; }
  /* game_flow.md 의 "월세 첫 달 유예 → 데드라인 73일" 과 자릿수가 맞는지만 본다.
     콩나물만으로는 흑자가 안 나므로(선반이 있어야 한다) 여기서는 버티는 날수를 잰다. */
  results.push(['INFO', `  콩나물 3끼만으로 버티는 날: ${day}일 (게임 시작 자금 ${TUTORIAL_RULES.startCashWon.toLocaleString()})`]);
  assert.ok(day > 40 && day < 200, `버티는 날이 ${day}일 — 데드라인 자릿수(수십 일)와 어긋납니다`);
});

/* ══ J-2 · 구호금 — **딱 한 번**이고, 그다음엔 죽는다 (2026-08-17 · §reliefWon) ══════ */
check('J-2 구호금 — 처음 0원에 한 번만 나오고 그 뒤엔 굶어 죽는다', () => {
  const ts = mk();
  let relief = 0, starved = 0, reliefDay = null;
  for (let i = 0; i < 400 && !ts.starved; i++) {
    const r = tutorialDay(ts, { firstPlayDone: true, mealsUsed: 3 });
    for (const e of (r && r.events) || []) {
      if (e.id === 'relief') { relief++; reliefDay = ts.day;
        assert.equal(e.won, TUTORIAL_RULES.reliefWon, '구호금 액수가 규칙과 다릅니다'); }
      if (e.id === 'starved') starved++;
    }
  }
  results.push(['INFO', `  구호금 ${reliefDay}일 · ${relief}번 · 죽은 날 ${ts.day}일`]);
  assert.equal(relief, 1, `구호금이 ${relief}번 나왔습니다 — 한 번뿐이어야 합니다`);
  assert.ok(ts.starved, '구호금을 다 쓰고도 안 죽었습니다 — 데드라인이 사라졌습니다');
  /* ⚠ 「죽긴 죽는다」로는 모자란다. **구호금보다 뒤여야** 순서가 지켜진 것이다 */
  assert.ok(ts.day > reliefDay, '죽은 날이 구호금 날보다 앞입니다 — 순서가 뒤집혔습니다');
});

/* ── 보고 ─────────────────────────────────────────────────────────────── */
let fail = 0;
for (const [st, name, msg] of results) {
  if (st === 'INFO') { console.log(name); continue; }
  if (st === 'FAIL') fail++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\ntutorial: FAIL (${fail}건)` : '\ntutorial: PASS');
process.exit(fail ? 1 : 0);
