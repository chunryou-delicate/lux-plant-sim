/* ============================================================
   tools/test_oneroom.mjs — ③ 원룸 · ④ 엔딩 재현
   ------------------------------------------------------------
     node tools/test_oneroom.mjs

   정본은 `docs/story_arc.md` §0·§5 와 `docs/oneroom.md`.

   ★ 여기서 **밸런스 값을 검사하지 않는다.** 원룸 월세·슬롯 수·엔딩 목표 금액은 전부
     미확정이라(story_arc.md §5) 값을 못 박으면 그게 곧 확정이 된다. 대신 검사하는 것은
     **구조**다 — 「미확정이면 미확정이라고 답하나」 · 「주입하면 그 값으로 도나」 ·
     「이사하면 방이 실제로 바뀌나」 · 「④ 전에 초보가 안 꺼지나」.

   ⚠ 검사 H 는 **일부러 안 던진다.** 지금 원룸 방 데이터로는 갈라짐·무늬가 성립하지 않고
     그건 코어가 못 고치는 것(house 소유 파일)이라, 재현이 그 사실을 **INFO 로 적어 남긴다.**
     docs/oneroom.md §3 이 그 인계다.
============================================================ */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

import { newState, pushLog } from '../src/game/state.js';
import {
  STORY_SCHEMA, ONEROOM_ROOM_ID, STAGES, createStoryState, storyOf, stageOf, storyRunning,
  ONEROOM_RULES, oneroomRulesFromHomes, withOneroomRent, moveIntoOneroom, lightGateOf,
  oneroomGoal, storyStatus
} from '../src/game/oneroom.js';
import {
  ENDING_RULES, endingRulesFrom, endingProgress, canFinish, stepEnding, finishEnding, endingGoal
} from '../src/game/ending.js';
import {
  TUTORIAL_RULES, createTutorialState, tutorialDay, noteLearning, canMoveOut, moveOut,
  rentWonOf, dailyCashOutWon
} from '../src/game/tutorial.js';
import { isNoviceMode, graceDaysOf } from '../src/game/propagation.js';
import { serialize, deserialize } from '../src/game/save.js';
import { createProfileLight } from '../src/game/room_profile.js';
import { daylightDLI } from '../src/engine/daily_light.js';
import { weatherE } from '../src/engine/weather.js';
import { timeModeOf } from '../src/game/loop.js';

const J = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const info = (s) => results.push(['INFO', '  ' + s]);

/* 배움 넷을 다 채운다 — tools/test_tutorial.mjs 의 teachAll 과 같은 값이다 */
const teachAll = (ts) => noteLearning(ts, {
  harvested: true, foodSavedWon: 5000, cropAvgDli: 0.1,
  plantDli7: 3.8, plantMinDli: 3.0, spearFurled: true
});

/* 이사할 수 있는 판 하나. 첫 플레이는 안 켠다(밸런스 계약이 필요하고 여기서 재는 것이 아니다). */
function readyToMove({ rules = TUTORIAL_RULES, cash = null } = {}) {
  const S = newState({ room: 'banjiha', mode: 'real' });
  S.day = 60;
  S.tutorial = createTutorialState({ enabled: true, rules });
  S.tutorial.day = 60;
  teachAll(S.tutorial);
  S.tutorial.cashWon = cash == null ? rules.moveOutCostWon : cash;
  return S;
}

/* 아주 작은 가짜 조도 창 — 방 조립(THREE)이 필요 없는 자리 검사용.
   ★ 진짜 조도 물리는 안 흉내 낸다. 여기서 재는 것은 「자리를 새 방으로 옮기나」뿐이다. */
function stubLight(roomId, slotIds) {
  const slots = slotIds.map((id, i) => ({ slotId: id, x: i * 0.3, y: 1.0, z: 0, maxPotD: 0.3 }));
  let built = roomId;
  const room = () => ({ id: built, slots, size: { w: 6, d: 5, h: 2.5 },
                        surfaces: new Set(slotIds.map(s => String(s).split(':')[0])) });
  return {
    builtRooms: [],
    build(id) { built = id; this.builtRooms.push(id); return room(); },
    clearCache() {},
    get room() { return room(); }
  };
}

/* ══ A · state.js 의 story 리터럴과 oneroom.createStoryState 가 **같아야 한다** ══════
   state.js 는 순환을 피하려고 이 모양을 인라인으로 갖는다(그쪽 §story 주석).
   두 곳이 갈리면 세이브 복원이 새 판과 다른 모양을 만든다 — 여기서 등식을 고정한다. */
check('A story 상태 — state.js 리터럴 == oneroom.createStoryState()', () => {
  const fresh = newState({}).story;
  assert.deepEqual(fresh, createStoryState(), '★ state.js 의 story 리터럴이 oneroom.js 와 갈렸습니다');
  assert.equal(fresh.schema, STORY_SCHEMA);
});

/* ══ B · 단계는 **유도한다** — 저장하지 않는다 ═══════════════════════════ */
check('B 단계 — movedOut·ending.doneOnDay 만 보고 ①②→③→④', () => {
  const S = newState({});
  S.tutorial = createTutorialState({ enabled: true });
  assert.equal(stageOf(S), STAGES.banjiha, '처음이 반지하가 아닙니다');
  S.tutorial.movedOut = true;
  assert.equal(stageOf(S), STAGES.oneroom, '이사했는데 원룸이 아닙니다');
  storyOf(S).ending.doneOnDay = 200;
  assert.equal(stageOf(S), STAGES.ending, '엔딩을 봤는데 단계가 안 넘어갔습니다');

  /* ★ 옛 세이브 — `story` 칸 자체가 없어도 단계가 맞아야 한다 */
  const old = newState({});
  old.tutorial = createTutorialState({ enabled: true });
  old.tutorial.movedOut = true;
  delete old.story;
  assert.equal(stageOf(old), STAGES.oneroom, '★ story 칸이 없는 옛 세이브가 ③으로 안 읽힙니다');
});

/* ══ C · ★ 이사 — **방이 실제로 바뀐다** ════════════════════════════════ */
check('C 이사 — S.home.room 이 oneroom 이 되고 자리가 비워진다', () => {
  const S = readyToMove();
  S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa',
                slotId: 'banjiha-sill:0', at: { x: 0, y: 1.585, z: -1.95 }, variegated: false });
  S.cuttings.push({ id: 'cut_01', slotId: 'banjiha-desk:0', at: { x: 1.3, y: 0.75, z: -1.5 },
                    status: 'rooting', method: 'water', container: 'jar', days: 3,
                    source: { leaves: 1, variegatedLeaves: 0 } });

  assert.equal(S.home.room, 'banjiha');
  const r = moveIntoOneroom(S, {});
  assert.equal(r.movedOut, true);
  assert.equal(S.home.room, ONEROOM_ROOM_ID, '★ 이사했는데 방이 안 바뀌었습니다');
  assert.equal(r.roomChanged, true);
  assert.equal(r.fromRoom, 'banjiha');
  assert.equal(storyOf(S).movedInOnDay, S.day, '들어온 날이 안 적혔습니다');
  assert.equal(S.pots[0].slotId, null, '★ 반지하 슬롯 id 가 화분에 남았습니다');
  assert.equal(S.pots[0].at, null, '★ 반지하 좌표가 화분에 남았습니다');
  assert.equal(S.cuttings[0].slotId, null, '★ 반지하 슬롯 id 가 삽수에 남았습니다');
  assert.ok(r.events.some(e => e.id === 'moved_out'), '반지하를 떠나는 사건이 없습니다');
  assert.ok(r.events.some(e => e.id === 'moved_in_oneroom'), '원룸에 든 사건이 없습니다');
  assert.equal(stageOf(S), STAGES.oneroom);
});

check('C-2 이사 — 조도 창을 주면 새 방으로 조립하고 자리를 회수한다', () => {
  const S = readyToMove();
  S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa',
                slotId: 'banjiha-sill:0', at: { x: 0, y: 1.585, z: -1.95 }, variegated: false });
  const light = stubLight('banjiha', ['oneroom-shelf:0', 'oneroom-desk:0']);
  const r = moveIntoOneroom(S, { light });
  assert.equal(r.roomBuilt, true, '조도 창을 줬는데 방을 안 지었습니다');
  assert.deepEqual(light.builtRooms, [ONEROOM_ROOM_ID]);
  assert.equal(S.pots[0].slotId, 'oneroom-shelf:0', '★ 화분이 새 방 자리로 안 옮겨졌습니다');
  assert.ok(r.rehomed.length > 0, '회수 기록이 없습니다');
});

check('C-3 이사 — 조건을 못 채우면 던지고 **방도 안 바뀐다**', () => {
  const S = readyToMove({ cash: 100 });                    // 배움은 다 됐고 돈만 없다
  assert.equal(canMoveOut(S.tutorial).ok, false);
  assert.throws(() => moveIntoOneroom(S, {}), /자금이/);
  assert.equal(S.home.room, 'banjiha', '★ 던졌는데 방이 바뀌었습니다');
  assert.equal(storyOf(S).movedInOnDay, null);
});

check('C-4 이사 — 두 번 눌러도 안전하다(안내로 던진다)', () => {
  const S = readyToMove();
  moveIntoOneroom(S, {});
  let e = null;
  try { moveIntoOneroom(S, {}); } catch (err) { e = err; }
  assert.ok(e && /이미 이사/.test(e.message), '두 번째 이사가 그냥 됐습니다');
  assert.equal(e.tutorialInput, true, '고장이 아니라 안내여야 합니다');
});

/* ══ D · 월세 — ⏸ 미확정이면 반지하 값 그대로, 주입하면 그 값 ══════════════ */
check('D 월세 — 원룸 값이 미확정이면 반지하 월세로 그대로 돈다', () => {
  assert.equal(TUTORIAL_RULES.oneroomRentWon, null,
    '★ 원룸 월세가 코드에 박혔습니다 — story_arc.md §5 는 아직 미확정입니다');
  const S = readyToMove();
  moveIntoOneroom(S, {});
  assert.equal(rentWonOf(S.tutorial), TUTORIAL_RULES.rentWon, '미확정인데 값이 바뀌었습니다');
  assert.equal(dailyCashOutWon(S.tutorial), 10_000, '하루치가 반지하와 달라졌습니다');
});

check('D-2 월세 — withOneroomRent 로 채우면 이사 뒤부터 그 값이 나간다', () => {
  /* ★ 아래 300,000 은 **밸런스 값이 아니라 재현용 입력**이다.
     정본은 data/balance/homes.json 이고 지금 cost_provisional: true 다(검사 J).
     ★★ 2026-08-05 — 450,000 → 300,000 으로 바꿨다. 반지하 하루 지출이 20,000 → 15,000 이
       되면서(박사님 확정 · 월세 30만 → 15만) 450,000(하루 15,000)은 **하루치를 통째로 먹어**
       `dailyCashOutWon` 이 0 이 된다 — 곧 공과·전기·식비가 공짜가 된다는 뜻이라 재현이 성립 안 한다.
       반지하 15만의 두 배인 30만이면 하루 몫 10,000, 남는 하루치 5,000 으로 뜻이 그대로다.
     ⚠ **이건 이 검사만의 문제가 아니다.** `dailyCashOutWon` 은 원룸에서도 반지하의
       `dailySpendWon` 을 그대로 쓰고 월세 몫만 갈아 끼운다(tutorial.js §dailyCashOutWon 의 ⏸).
       그래서 **원룸 월세가 하루 15,000원을 넘으면 나머지 살림이 0원이 된다.**
       원룸 `dailySpendWon` 을 정할 때 반드시 같이 봐야 한다 — docs/oneroom.md §2. */
  const rules = withOneroomRent(TUTORIAL_RULES, { rentWon: 300_000 });
  const S = readyToMove({ rules });
  assert.equal(rentWonOf(S.tutorial), TUTORIAL_RULES.rentWon, '이사 전인데 원룸 월세가 나옵니다');
  moveIntoOneroom(S, {});
  assert.equal(rentWonOf(S.tutorial), 300_000, '이사 뒤인데 원룸 월세가 안 나옵니다');
  assert.equal(dailyCashOutWon(S.tutorial), 5_000, '하루치가 늘어난 월세 몫만큼 안 줄었습니다');

  /* 실제로 청구될 때도 그 값이어야 한다 */
  const ts = S.tutorial;
  ts.cashWon = 5_000_000;
  ts.rent.nextDueDay = ts.day + 1;
  const r = tutorialDay(ts, { firstPlayDone: true });
  assert.equal(r.rentWon, 300_000, `청구액이 ${r.rentWon} 입니다`);
});

check('D-3 월세 — withOneroomRent 는 미확정을 지어내지 않는다', () => {
  assert.equal(withOneroomRent(TUTORIAL_RULES, { rentWon: null }), TUTORIAL_RULES,
    '미확정인데 새 규칙 객체를 만들었습니다');
  assert.equal(withOneroomRent(TUTORIAL_RULES, null), TUTORIAL_RULES);
  assert.throws(() => withOneroomRent(TUTORIAL_RULES, { rentWon: -1 }), /0 이상/);
});

/* ══ E · 세이브 — 왕복해도 그대로 · 옛 세이브도 열린다 ═══════════════════ */
check('E 세이브 — story 가 왕복에서 안 사라진다', () => {
  const S = readyToMove();
  moveIntoOneroom(S, {});
  storyOf(S).ending.reachedOnDay = 120;
  storyOf(S).ending.doneOnDay = 130;
  const raw = serialize(S);
  assert.ok(raw.state.story, '★ story 가 저장 목록에 없습니다');
  const back = deserialize(raw, { allowUnappliedFurniture: true, slots: [] });
  assert.deepEqual(back.story, S.story, '★ story 가 왕복에서 달라졌습니다');
  assert.equal(stageOf(back), STAGES.ending);
});

check('E-2 세이브 — story 칸이 없는 옛 세이브가 그대로 열린다', () => {
  const S = readyToMove();
  moveIntoOneroom(S, {});
  const raw = serialize(S);
  delete raw.state.story;                       // 이 칸이 생기기 전의 세이브
  const back = deserialize(raw, { allowUnappliedFurniture: true, slots: [] });
  assert.deepEqual(back.story, createStoryState(), '옛 세이브가 처음 상태로 안 열립니다');
  assert.equal(stageOf(back), STAGES.oneroom,
    '★ story 가 없어도 tutorial.movedOut 으로 ③ 이라고 읽어야 합니다');
});

/* ══ F · ★★ 초보 모드는 **④ 까지** 켜져 있다 (story_arc.md §0) ═══════════ */
check('F 초보 — ③ 원룸에서도 켜져 있고 ④ 뒤에 꺼진다', () => {
  const S = readyToMove();
  S.sim.mode = 'real';                          // sim 쪽 신호를 빼고 스토리 신호만 본다
  assert.equal(isNoviceMode(S), true, '반지하에서 초보가 아닙니다');
  moveIntoOneroom(S, {});
  assert.equal(isNoviceMode(S), true,
    '★ 이사하는 순간 초보가 꺼졌습니다 — story_arc.md §0 은 ④까지 초보입니다');
  assert.equal(storyRunning(S), true);
  /* 삽수 유예도 같이 봐야 한다 — 초보 16일 / 자유 8일 */
  assert.equal(graceDaysOf('water', isNoviceMode(S)), 16, '원룸에서 유예가 줄었습니다');

  storyOf(S).ending.doneOnDay = S.day;
  assert.equal(isNoviceMode(S), false, '④ 를 봤는데도 초보입니다');
  assert.equal(storyRunning(S), false);
  assert.equal(graceDaysOf('water', isNoviceMode(S)), 8);
});

/* ══ G · ④ 엔딩 ════════════════════════════════════════════════════════ */
check('G 엔딩 — 목표 금액이 미확정이면 **끝낼 수 없다**', () => {
  assert.equal(ENDING_RULES.targetWon, null,
    '★ 엔딩 목표 금액이 코드에 박혔습니다 — story_arc.md §5 는 아직 미확정입니다');
  const S = readyToMove();
  moveIntoOneroom(S, {});
  S.tutorial.cashWon = 99_999_999;
  const p = endingProgress(S);
  assert.equal(p.ok, false, '★ 미확정인데 엔딩이 성립했습니다');
  assert.equal(p.targetWon, null);
  assert.match(p.why, /정해지지 않았습니다/);
  assert.throws(() => finishEnding(S), /정해지지 않았습니다/);
  assert.equal(endingGoal(S).id, 'undecided');
});

check('G-2 엔딩 — 목표를 주입하면 **현금**으로 판정한다', () => {
  /* ★ 아래 450,000 은 재현용 입력이다(무늬 삽수 한 개 값 언저리라 「팔면 닿는다」가 나온다).
     밸런스 값이 아니다 — 후보(1,000만)와 근거는 docs/oneroom.md §5. */
  const opt = { rules: endingRulesFrom({ targetWon: 450_000 }) };
  const S = readyToMove();
  moveIntoOneroom(S, {});
  S.tutorial.cashWon = 400_000;
  /* 팔면 닿지만 아직 안 판 상태 — 삽수를 하나 얹는다(잎 1장·무늬 1장 = 산반 80,000원) */
  S.cuttings.push({ id: 'cut_01', status: 'rooted', method: 'water', container: 'jar', days: 20,
                    leaves: 1, variegatedLeaves: 1, slotId: null, at: null,
                    source: { leaves: 1, variegatedLeaves: 1 } });
  const p = endingProgress(S, {}, opt);
  assert.equal(p.targetWon, 450_000);
  assert.ok(p.netWorthWon > p.cashWon, '자산이 현금보다 크지 않습니다');
  assert.ok(p.netWorthWon >= p.targetWon, '팔면 닿는 판이 아닙니다');
  assert.equal(p.ok, false, '★ 안 팔았는데 엔딩이 성립했습니다 — 판정은 현금입니다');
  assert.match(p.why, /팔면 닿습니다/);
  assert.equal(canFinish(S, {}, opt).ok, false);

  S.tutorial.cashWon = 480_000;                 // 팔았다 치고
  assert.equal(endingProgress(S, {}, opt).ok, true);
  assert.equal(endingGoal(S, {}, opt).id, 'ready');
});

check('G-3 엔딩 — 닿은 날이 한 번만 적히고, 끝내면 돈이 나간다', () => {
  const opt = { rules: endingRulesFrom({ targetWon: 1_000_000 }) };
  const S = readyToMove();
  moveIntoOneroom(S, {});
  S.day = 150;
  S.tutorial.cashWon = 1_200_000;

  const a = stepEnding(S, {}, opt);
  assert.equal(a.firstTime, true, '처음 닿았는데 사건이 없습니다');
  assert.ok(a.events.some(e => e.id === 'ending_ready'));
  assert.equal(storyOf(S).ending.reachedOnDay, 150);
  const b = stepEnding(S, {}, opt);
  assert.equal(b.firstTime, false, '★ 같은 사건이 두 번 났습니다');
  assert.equal(b.events.length, 0);
  /* ★ 자동으로 끝나지 않는다 — 닿았다고 게임이 알아서 엔딩을 틀면 안 된다 */
  assert.equal(stageOf(S), STAGES.oneroom, '★ 닿기만 했는데 엔딩이 됐습니다');

  const r = finishEnding(S, {}, opt);
  assert.equal(r.done, true);
  assert.equal(r.paidWon, 1_000_000);
  assert.equal(S.tutorial.cashWon, 200_000, '계약금이 안 빠졌습니다');
  assert.equal(storyOf(S).ending.doneOnDay, 150);
  assert.equal(stageOf(S), STAGES.ending);
  assert.ok(r.events.some(e => e.id === 'ending_home'));
  /* ★ 직업 선택은 ④ **뒤**다 — 이 창은 그 화면을 만들지 않고 다음 장만 알린다 */
  assert.equal(r.nextChapter, 'job_select');
  assert.equal(endingGoal(S, {}, opt).id, 'done');
  assert.throws(() => finishEnding(S, {}, opt), /이미 내 집/);
});

check('G-4 엔딩 — ③ 전에는 아예 판정하지 않는다', () => {
  const opt = { rules: endingRulesFrom({ targetWon: 1_000 }) };
  const S = readyToMove();
  S.tutorial.cashWon = 9_999_999;
  assert.equal(canFinish(S, {}, opt).ok, false, '★ 반지하에서 엔딩이 성립했습니다');
  assert.match(canFinish(S, {}, opt).why, /아직 반지하/);
  assert.equal(endingGoal(S, {}, opt), null, '③ 전에 ④ 목표를 말합니다');
  assert.deepEqual(stepEnding(S, {}, opt).events, []);
});

/* ══ H · ⏸ 원룸의 빛 — **지금은 갈라짐·무늬가 성립하지 않는다** ═══════════
   story_arc.md §0 은 ③ 에 *"갈라진 잎 · 무늬 · 번식(삽수)"* 을 붙였다.
   그런데 방 데이터를 재면 그 문턱을 하나도 못 넘는다. 코어가 못 고치는 것이라
   **여기서는 던지지 않고 숫자를 남긴다.** 인계는 docs/oneroom.md §3. */
check('H 빛 게이트 — 지금 방이 문턱을 넘나 못 넘나를 말한다(반지하 기준)', () => {
  const lightTh = J('data/balance/light_thresholds.json');
  const wb = J('data/balance/weather.json');
  const light = createProfileLight(J('data/profiles/room_profile.banjiha.json'),
                                   { lightTh, weatherBalance: wb });
  const S = newState({ room: 'banjiha', mode: 'real' });
  S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: null, at: null,
                variegated: false });
  const g = lightGateOf(S, { light }, { season: 'summer', lampCount: 0 });
  assert.equal(g.ok, true, g.why);
  assert.equal(g.fenestrate, 6.0, '갈라짐 문턱이 light_thresholds.json 값이 아닙니다');
  assert.equal(g.min, 3.0);
  assert.equal(g.varieMin, 4.2, '무늬종 min 이 ×1.4 가 아닙니다');
  assert.equal(g.canFenestrate, false, '반지하 자연광이 갈라짐 문턱을 넘었습니다');
  assert.ok(g.why && /못 미칩니다/.test(g.why), '못 넘는 이유를 말하지 않습니다');
  info(`반지하 등0 — 가장 밝은 자리 ${g.best.slotId} peak ${g.best.peak} · 7일평균 ${g.best.avg7} ` +
       `(min ${g.min} · 갈라짐 ${g.fenestrate}) · 방의 식물등 기구 ${g.growRigs}개`);

  const g2 = lightGateOf(S, { light }, { season: 'summer', lampCount: 2 });
  info(`반지하 등2 — 7일평균 ${g2.best.avg7} · 갈라짐 ${g2.canFenestrate ? '가능' : '불가'} ` +
       `· 무늬 대역(${g2.varieMin}) ${g2.canVarie ? '도달' : '미달'}`);
});

check('H-2 ⏸ 원룸 방 데이터 — 지금 상태를 숫자로 남긴다(던지지 않는다)', () => {
  const prof = J('data/profiles/room_profile.oneroom.json');
  const E = weatherE('summer');
  const rows = prof.slots
    .map(s => ({ id: s.slotId, avg7: daylightDLI(s.ratio, { weather: 'clear', season: 'summer' }) * E }))
    .sort((a, b) => b.avg7 - a.avg7);
  const best = rows[0];
  info(`원룸 슬롯 ${rows.length}칸 · 가장 밝은 자리 7일평균 ${best.avg7.toFixed(2)} (${best.id})`);
  info(`  min 3.0 이상 ${rows.filter(r => r.avg7 >= 3).length}칸 · ` +
       `무늬 min 4.2 이상 ${rows.filter(r => r.avg7 >= 4.2).length}칸 · ` +
       `갈라짐 6.0 이상 ${rows.filter(r => r.avg7 >= 6).length}칸 · ` +
       `콩나물 자리(<0.3) ${rows.filter(r => r.avg7 < 0.3).length}칸`);
  info(`  방의 식물등 기구 ${Math.max(...prof.lampCounts)}개 · uidStable ${prof.uidStable === true}`);
  if (best.avg7 < 6 || Math.max(...prof.lampCounts) === 0 || prof.uidStable !== true)
    info('  ⏸ ③ 원룸이 아직 못 갖춘 것이 있습니다 — docs/oneroom.md §3 (house 인계)');
  /* 던지지 않는다. 여기서 막으면 코어가 못 고치는 것 때문에 재현이 늘 빨개진다. */
  assert.ok(rows.length > 0, '원룸 프로파일에 슬롯이 없습니다');
});

/* ══ I · 시간 — ③④ 는 배속만, 이벤트 점핑이 없다 (story_arc.md §0) ═══════ */
check('I 시간 — ③④ 에는 이벤트 점핑이 없다', () => {
  const S = readyToMove();
  moveIntoOneroom(S, {});
  assert.equal(timeModeOf(S), 'fast', '★ 원룸에서 점핑이 열려 있습니다');
  storyOf(S).ending.doneOnDay = S.day;
  assert.equal(timeModeOf(S), 'fast');
});

/* ══ J · 살림 값은 **정본에서 읽는다** ═══════════════════════════════════ */
check('J 원룸 규칙 — homes.json 에서 읽고, 잠정값이면 잠정이라고 말한다', () => {
  assert.equal(ONEROOM_RULES.rentWon, null, '★ 코어가 원룸 월세를 갖고 있습니다');
  assert.equal(ONEROOM_RULES.slots, null, '★ 코어가 원룸 슬롯 수를 갖고 있습니다');
  const r = oneroomRulesFromHomes(J('data/balance/homes.json'));
  assert.equal(r.roomId, ONEROOM_ROOM_ID);
  assert.ok(Number.isFinite(r.rentWon) && r.rentWon > 0, '월세를 못 읽었습니다');
  assert.equal(r.moveCostWon, TUTORIAL_RULES.moveOutCostWon,
    '★ homes.json 의 이사비와 story_arc.md §3 의 이사 자금이 갈렸습니다');
  info(`homes.json 원룸 — 월세 ${r.rentWon.toLocaleString()}원 · ` +
       `보증금 ${(r.depositWon || 0).toLocaleString()}원 · ` +
       `이사비 ${r.moveCostWon.toLocaleString()}원 · 잠정 ${r.provisional}`);
  assert.equal(r.provisional, true,
    '★ homes.json 이 원룸 값을 확정으로 바꿨습니다 — docs/oneroom.md §2 를 갱신하세요');
  assert.throws(() => oneroomRulesFromHomes({ homes: [] }), /없습니다/);
});

/* ══ K · 안내 문구 ══════════════════════════════════════════════════════ */
check('K 목표 — 단계마다 무엇을 하면 되는지 한 줄', () => {
  const S = readyToMove();
  assert.equal(oneroomGoal(S).id, 'move_ready');
  moveIntoOneroom(S, {});
  assert.equal(oneroomGoal(S).id, 'propagate');
  assert.equal(storyStatus(S).stage, 'oneroom');
  assert.equal(storyStatus(S).room, ONEROOM_ROOM_ID);
  storyOf(S).ending.doneOnDay = S.day;
  assert.equal(oneroomGoal(S).id, 'done');
  assert.equal(storyStatus(S).novice, false);
});

/* ── 보고 ─────────────────────────────────────────────────────────────── */
let fail = 0;
for (const [st, name, msg] of results) {
  if (st === 'INFO') { console.log(name); continue; }
  if (st === 'FAIL') fail++;
  console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`);
}
console.log(fail ? `\noneroom: FAIL (${fail}건)` : '\noneroom: PASS');
process.exit(fail ? 1 : 0);
