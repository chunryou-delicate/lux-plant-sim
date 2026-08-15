/* ============================================================
   tools/test_quest.mjs — 퀘스트 다섯 줄 (2026-08-17 신설)

     node tools/test_quest.mjs

   ★ 이 검사가 지키는 것은 여섯이다. 하나라도 깨지면 「목적성」이 도로 사라진다.
     ⑴ **표 · 대사 · 값 셋이 안 어긋난다** — 줄이 늘었는데 대사를 안 쓰면 조용해지고,
        값을 안 쓰면 보상이 없다. 셋을 한 자리에서 대조한다
     ⑵ **다섯 줄이 실제 판에서 전부 열리고 전부 끝난다** — 판정만 맞고 안 열리는 줄이
        생기면 그건 없는 것과 같다(`stamina.js §grantStaminaQuest` 가 창구만 열고
        부르는 데가 없던 그 상태가 정확히 그것이었다)
     ⑶ **여는 순서가 배우는 순서다** — 정의 순서대로 열린다
     ⑷ **아래 한 줄에 들어간다** — `docs/player_guide.md §0` 실측 상한(28자)
     ⑸ **두 번 불러도 두 번 열리지 않는다**
     ⑹ ★ **말이 실제로 나온다** — 사건 → 대사까지 이어지는지를 storyteller 로 잰다

   ⚠ **숫자를 이 파일에 안 박는다.** 시루 수·바퀴 수는 `QUESTS` 정의에서 읽고,
     체력 보상은 `STAMINA_RULES.quests` 에서 읽는다 — 박으면 값이 움직일 때
     「검사가 낡아서」 나는 실패가 된다(START-HERE §2).
============================================================ */
import assert from 'node:assert';
import { QUESTS, QUEST_IDS, questOf, questTodo, questView, stepQuests,
         doneIdsOf, emptySnapshot } from '../src/game/quest.js';
import { QUEST_OPEN_SCRIPT, QUEST_DONE_SCRIPT, SCRIPTS, REPEATABLE,
         createStoryteller } from '../src/game/dialogue.js';
import { STAMINA_RULES, createStaminaState, grantStaminaQuest, staminaView } from '../src/game/stamina.js';

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); }
                              catch (e) { results.push(['FAIL', name, e.message]); } };
const info = m => results.push(['INFO', '  ' + m]);

/* 최소한의 가짜 판 — 이 검사가 보는 것은 퀘스트 판정뿐이라 코어 전체가 필요 없다.
   ⚠ `S.stamina` 만은 **진짜**를 쓴다. 끝낸 것을 적는 칸이 거기라서다. */
const newBoard = () => ({ stamina: createStaminaState(STAMINA_RULES) });

/* ══ ⑴ 표 · 대사 · 값이 안 어긋난다 ═══════════════════════════════════ */
check('⑴ 줄마다 대사가 둘씩 있다 (열림 · 완료)', () => {
  for (const q of QUESTS) {
    const o = QUEST_OPEN_SCRIPT[q.id], d = QUEST_DONE_SCRIPT[q.id];
    assert.ok(o, `'${q.id}' 열림 대사가 없습니다 — 열려도 화면이 조용합니다`);
    assert.ok(d, `'${q.id}' 완료 대사가 없습니다`);
    assert.ok(SCRIPTS[o] && SCRIPTS[o].length, `없는 대사 '${o}'`);
    assert.ok(SCRIPTS[d] && SCRIPTS[d].length, `없는 대사 '${d}'`);
  }
});
check('⑴ 대사 지도에 표에 없는 줄이 없다', () => {
  for (const id of Object.keys(QUEST_OPEN_SCRIPT))
    assert.ok(QUEST_IDS.includes(id), `표에 없는 퀘스트 대사: '${id}'`);
  for (const id of Object.keys(QUEST_DONE_SCRIPT))
    assert.ok(QUEST_IDS.includes(id), `표에 없는 퀘스트 대사: '${id}'`);
});
check('⑴ 줄마다 보상 값이 정해져 있다 (0 도 값이다)', () => {
  for (const q of QUESTS)
    assert.ok(Object.prototype.hasOwnProperty.call(STAMINA_RULES.quests, q.id),
      `'${q.id}' 의 보상이 stamina.quests 에 없습니다 — 「모른다」와 「0」은 다릅니다`);
  const paid = QUESTS.filter(q => STAMINA_RULES.quests[q.id] > 0);
  info(`체력을 주는 줄 ${paid.length}/${QUESTS.length} — ${paid.map(q => q.id).join(' · ')}`);
  /* ★ 세상이 주는 둘은 **0 이라야 한다**(§stamina.js §퀘스트가 주는 최대체력) */
  assert.equal(STAMINA_RULES.quests.varie_bright, 0, '무늬 등급이 보상인 줄에 체력이 붙었습니다');
  assert.equal(STAMINA_RULES.quests.sell_varie, 0, '이사가 보상인 줄에 체력이 붙었습니다');
});
check('⑴ 퀘스트 대사는 **다시 안 나온다**', () => {
  for (const id of [...Object.values(QUEST_OPEN_SCRIPT), ...Object.values(QUEST_DONE_SCRIPT)])
    assert.ok(!REPEATABLE.has(id), `'${id}' 가 다시 나올 수 있게 돼 있습니다 — 안내가 잔소리가 됩니다`);
});
check('⑴ 가르치는 것이 겹치지 않는다', () => {
  const all = QUESTS.flatMap(q => q.teaches || []);
  const dup = all.filter((t, i) => all.indexOf(t) !== i);
  assert.equal(dup.length, 0, `두 줄이 같은 것을 가르칩니다: ${[...new Set(dup)]}`);
  info(`가르치는 것 ${all.length}가지 / 줄 ${QUESTS.length}개`);
});

/* ══ ⑷ 아래 한 줄에 들어간다 ══════════════════════════════════════════
   `docs/player_guide.md §0` 실측 — `#quest` 한 줄이 폰 360px 에서 **26자**,
   390px 에서 29자다. 두 줄까지 허용되므로 상한을 **28자**로 둔다(그 문서의 기준 그대로). */
const TODO_MAX = 28;
check(`⑷ 「지금 할 일」이 ${TODO_MAX}자를 안 넘는다`, () => {
  for (const q of QUESTS) {
    const t = questTodo(q);
    assert.ok(t, `'${q.id}' 의 할 일 문구가 없습니다`);
    assert.ok(t.length <= TODO_MAX, `'${q.id}' ${t.length}자 — ${t}`);
    info(`${q.id} (${t.length}자) ${t}`);
  }
});
check('⑷ 할 일 문구가 **정의에서 수를 읽는다**', () => {
  /* `siru5_cycle5` 의 문구는 `need` 를 읽어 짓는다 — 값을 바꾸면 문구가 따라와야 한다 */
  const q = questOf('siru5_cycle5');
  assert.ok(q.need && q.need.sirus > 0, 'need 가 없습니다');
  assert.ok(questTodo(q).includes(String(q.need.sirus)),
    '할 일 문구가 시루 수를 안 말합니다 — 손으로 박힌 문구입니다');
  assert.ok(questTodo(q).includes(String(q.need.cycles)), '할 일 문구가 바퀴 수를 안 말합니다');
});

/* ══ ⑵⑶⑸ 실제 판을 굴린다 ═══════════════════════════════════════════
   ★ 스냅샷을 **한 걸음씩** 실제 순서대로 움직인다. 코어를 통째로 올리지 않는 까닭:
     이 파일이 재는 것은 **퀘스트 판정**이고, 코어가 그 사실을 어느 함수로 내는가는
     `game.html` 배선의 일이다(확정문 §배선). 코어까지 올리면 두 가지를 한 검사가 재게 되어
     실패했을 때 어느 쪽이 깨진 것인지 못 가른다. */
const board = newBoard();
const said = [];          // 「무슨 말이 났나」
const openedAt = [];      // 「몇 걸음째에 열렸나」
const doneAt = [];
const st = createStoryteller();

/* 한 걸음 = 스냅샷 하나. 화면이 하는 것과 똑같이 판정 → 보상 → 대사 순서로 돈다 */
function step(n, snap) {
  const r = stepQuests(board, snap);
  for (const id of r.finished) grantStaminaQuest(board, id);   // ★ 보상은 stamina 가 준다
  for (const id of r.opened)   openedAt.push([id, n]);
  for (const id of r.finished) doneAt.push([id, n]);
  said.push(...st.events(r.events));
  return r;
}

/* 걸음마다 무엇이 바뀌나 — 실제 판의 차례 그대로다 */
const S0 = emptySnapshot();
const steps = [
  /* 1  첫 플레이 도는 중 — 아직 아무것도 안 열린다 */
  { ...S0, day: 10, cropHarvestTotal: 1, cropPots: [{ kind: 'beansprout', harvestCount: 1 }] },
  /* 2  ★ 첫 플레이가 끝났다 — ① 이 열린다 */
  { ...S0, day: 33, firstPlayDone: true, cropHarvestTotal: 5,
    cropPots: [{ kind: 'beansprout', harvestCount: 5 }] },
  /* 3  무순을 길러 한 상에 올렸다 — ① 완료 */
  { ...S0, day: 46, firstPlayDone: true, mealKinds: ['beansprout', 'musun'],
    cropPots: [{ kind: 'beansprout', harvestCount: 6 }, { kind: 'musun', harvestCount: 1 }] },
  /* 4  ② 가 열린 뒤 시루를 늘려 돌린다 — 아직 모자란다 */
  { ...S0, day: 60, firstPlayDone: true, motherLeaves: 1,
    cropPots: Array.from({ length: 5 }, () => ({ kind: 'beansprout', harvestCount: 4 })) },
  /* 5  ② 완료 · 모주 잎이 둘이 됐다 → ③ 열림.
        ★ 가을이 왔다 — 식물등이 풀린다(`ts.lamp.unlocked`) → ④ 열림 */
  { ...S0, day: 70, firstPlayDone: true, motherLeaves: 2, lampUnlocked: true,
    cropPots: Array.from({ length: 5 }, () => ({ kind: 'beansprout', harvestCount: 5 })) },
  /* 6  물꽂이가 뿌리를 냈다 — ③ 완료. ★ 등을 샀다 — ④ 완료.
        무늬 잎이 났다 → ⑤ 열림 */
  { ...S0, day: 84, firstPlayDone: true, motherLeaves: 3, motherVarieLeaves: 1,
    lampUnlocked: true, lampOwned: 1,
    cuttings: [{ method: 'water', status: 'rooted', varieFromCut: false, varieLightBand: 'mid' }] },
  /* 7  무늬 삽수를 잘랐다 → ⑥ 열림. 아직 어두운 데 있다 */
  { ...S0, day: 90, firstPlayDone: true, motherLeaves: 3, motherVarieLeaves: 2,
    lampUnlocked: true, lampOwned: 1,
    cuttings: [{ method: 'water', status: 'rooting', varieFromCut: true, varieLightBand: null }] },
  /* 8  ★ 밝은 자리에서 뿌리내렸다 — ⑤ 완료. **등을 산 덕에 생긴 자리다** */
  { ...S0, day: 102, firstPlayDone: true, motherLeaves: 3, motherVarieLeaves: 2,
    lampUnlocked: true, lampOwned: 1,
    cuttings: [{ method: 'water', status: 'rooted', varieFromCut: true, varieLightBand: 'bright' }] },
  /* 9  팔았다 — ⑥ 완료 = 탈출의 둘째 축 */
  { ...S0, day: 112, firstPlayDone: true, motherLeaves: 3, motherVarieLeaves: 2, varieSaleCount: 1,
    lampUnlocked: true, lampOwned: 1,
    cuttings: [{ method: 'water', status: 'rooted', varieFromCut: true, varieLightBand: 'bright' }] }
];
steps.forEach((s, i) => step(i + 1, s));

check('⑵ 여섯 줄이 전부 열린다', () => {
  const got = openedAt.map(([id]) => id);
  for (const id of QUEST_IDS)
    assert.ok(got.includes(id), `'${id}' 가 한 번도 안 열렸습니다 — 없는 것과 같습니다`);
  info(`열린 차례 — ${openedAt.map(([id, n]) => `${n}걸음 ${id}`).join(' · ')}`);
});
check('⑵ 여섯 줄이 전부 끝난다', () => {
  const got = doneAt.map(([id]) => id);
  for (const id of QUEST_IDS) assert.ok(got.includes(id), `'${id}' 가 안 끝났습니다`);
  info(`끝난 차례 — ${doneAt.map(([id, n]) => `${n}걸음 ${id}`).join(' · ')}`);
});
check('⑶ 여는 순서가 정의 순서(=배우는 순서)와 같다', () => {
  const order = openedAt.map(([id]) => id);
  const want = QUEST_IDS.filter(id => order.includes(id));
  assert.deepEqual(order, want, `열린 순서가 어긋납니다: ${order}`);
});
check('⑶ ★ 끝난 것이 열린 것보다 먼저 말한다', () => {
  /* ★ 실측 — ① 완료는 3걸음, ② 열림은 **4걸음**이다. 한 걸음 벌어지는 까닭:
     `stepQuests` 는 걸음 **머리에서** 끝낸 목록(`questsTaken`)을 읽는데 보상은 그 뒤에
     붙는다. 그래서 「①을 끝낸 그 순간」에는 ②가 아직 안 열린다.
     ⇒ 버그가 아니라 **한 박자**다. 두 안내가 한 화면에 겹치지 않아 오히려 낫다.
     여기서 재는 것은 그래도 **말의 앞뒤가 안 뒤집히는가**다 —
     `EVENT_ORDER` 의 `quest_done → quest_opened` 가 같은 날 겹칠 때를 지킨다. */
  const i = said.indexOf('questDoneCropMix'), j = said.indexOf('questSiru5');
  assert.ok(i >= 0 && j >= 0, `둘 다 안 나왔습니다: ${said}`);
  assert.ok(i < j, `열림이 완료보다 먼저 나왔습니다 — ${said.join(' → ')}`);
});
check('⑸ 두 번 불러도 두 번 열리지 않는다', () => {
  const before = openedAt.length;
  const r = stepQuests(board, steps[steps.length - 1]);
  assert.equal(r.opened.length, 0, `다시 열렸습니다: ${r.opened}`);
  assert.equal(r.finished.length, 0, `끝난 것을 또 냅니다: ${r.finished}`);
  assert.equal(openedAt.length, before);
});
check('⑸ 끝낸 것은 `stamina.questsTaken` 하나가 기억한다', () => {
  const taken = board.stamina.questsTaken;
  for (const id of QUEST_IDS) assert.ok(taken.includes(id), `'${id}' 가 안 적혔습니다`);
  assert.deepEqual(doneIdsOf(board).sort(), [...QUEST_IDS].sort());
});
check('⑸ ★ 세이브에 새 칸을 안 만들었다', () => {
  /* 열린 목록은 `_` 로 시작하는 칸에만 산다 — save.js 의 화이트리스트가 안 싣는다 */
  assert.ok(Array.isArray(board._questOpen), '_questOpen 이 없습니다');
  const own = Object.keys(board).filter(k => k !== 'stamina' && !k.startsWith('_'));
  assert.equal(own.length, 0, `세이브에 실릴 새 칸이 생겼습니다: ${own}`);
});

/* ══ ⑹ 말이 실제로 나온다 ═══════════════════════════════════════════ */
check('⑹ 열두 가지 대사가 전부 화면까지 나온다', () => {
  for (const id of [...Object.values(QUEST_OPEN_SCRIPT), ...Object.values(QUEST_DONE_SCRIPT)])
    assert.ok(said.includes(id), `'${id}' 가 사건은 났는데 대사가 안 나왔습니다`);
  info(`나온 대사 ${said.length}가지`);
});
check('⑹ 같은 대사가 연달아 두 번 안 나온다', () => {
  for (let i = 1; i < said.length; i++)
    assert.notEqual(said[i], said[i - 1], `'${said[i]}' 가 연달아 두 번`);
});
check('⑹ 모르는 퀘스트는 **조용히** 지나간다 (안 던진다)', () => {
  const s2 = createStoryteller();
  assert.deepEqual(s2.events([{ id: 'quest_opened', questId: '없는줄' }]), []);
  assert.deepEqual(s2.events([{ id: 'quest_done', questId: '없는줄' }]), []);
});

/* ══ 보상이 실제로 붙었나 ═════════════════════════════════════════════ */
check('보상 — 체력이 밑값에서 딱 「주기로 한 만큼」 올랐다', () => {
  const want = QUEST_IDS.reduce((a, id) => a + (STAMINA_RULES.quests[id] || 0), 0);
  const v = staminaView(board);
  assert.equal(v.max, STAMINA_RULES.startMax + want,
    `최대체력 ${v.max} — ${STAMINA_RULES.startMax} + ${want} 이라야 합니다`);
  info(`최대체력 ${STAMINA_RULES.startMax} → ${v.max} (퀘스트 +${want})`);
});

/* ══ 「지금 할 일」 한 줄 ═════════════════════════════════════════════ */
check('화면 — 「지금 할 일」은 **하나만** 낸다', () => {
  const b2 = newBoard();
  const v = questView(b2, { ...S0, firstPlayDone: true, motherLeaves: 2, motherVarieLeaves: 1 });
  assert.ok(v.next, '열린 것이 있는데 next 가 없습니다');
  assert.ok(v.open.length >= 2, `여러 줄이 동시에 열리는 자리라야 이 검사가 뜻이 있습니다: ${v.open}`);
  assert.equal(v.next.id, v.open[0], 'next 가 첫째 줄이 아닙니다');
  info(`동시에 열린 줄 ${v.open.length}개 · 보여 주는 것은 「${v.next.todo}」`);
});
check('화면 — 아무것도 안 열린 판은 next 가 null 이다', () => {
  const b3 = newBoard();
  assert.equal(questView(b3, S0).next, null);
});

/* ── 보고 ────────────────────────────────────────────────────────────── */
let fail = 0;
for (const [st2, name, msg] of results) {
  if (st2 === 'INFO') { console.log(name); continue; }
  if (st2 === 'FAIL') fail++;
  console.log(`${st2}  ${name}${msg ? '\n      ' + msg : ''}`);
}
console.log(`\nquest: ${fail ? `FAIL (${fail})` : 'PASS'}`);
process.exit(fail ? 1 : 0);
