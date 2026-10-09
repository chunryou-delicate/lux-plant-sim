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
         doneIdsOf, emptySnapshot,
         /* ★ 2026-08-16 — 초반 사슬(§초반 사슬). 줄 수를 이 파일에 안 박는다 */
         FIRST_PLAY_CHAIN_IDS, questSpeaks, stageOfQuest,
         /* ★ 2026-08-17 — 느린 줄 둘(§긴 줄). 줄 수를 이 파일에 안 박는다 */
         SLOW_QUEST_IDS,
         /* ★ 2026-10-10 [plan] — 물린 줄(이름만 남김). 대사 지도에 남은 옛 열쇠를 «물린 줄»로 가른다 */
         RETIRED_QUESTS } from '../src/game/quest.js';
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
/* ══ ⚠⚠ 2026-08-16 — **이 검사가 두 갈래로 갈렸다** (초반 사슬 여덟 줄) ══════
   예전에는 *"줄마다 대사가 둘씩 있다"* 가 모든 줄에 걸렸다. 그런데 초반 사슬 여덟은
   `dialogue.js` 가 **다른 창의 쓰기 영역**이라 두 지도에 못 넣었다.
   ⇒ 검사를 **약하게 만들지 않고 두 갈래로** 갈랐다:
       `speaks` 인 줄  → 대사가 **둘 다 있어야** 한다 (예전 그대로)
       `speaks:false` → 대사가 **하나도 없어야** 한다
   ★ 뒤쪽이 중요하다. 대사를 붙이면서 `speaks` 를 안 바꾸면 **여기가 깨진다** —
     「표에는 조용하다고 적혀 있는데 실제로는 말하는」 어긋남이 안 생긴다.
   ⚠ 그러니 이것은 계약을 **판 것**이지 **깎은 것**이 아니다. */
check('⑴ 말하는 줄은 대사가 둘씩 있다 (열림 · 완료)', () => {
  const talk = QUESTS.filter(questSpeaks);
  for (const q of talk) {
    const o = QUEST_OPEN_SCRIPT[q.id], d = QUEST_DONE_SCRIPT[q.id];
    assert.ok(o, `'${q.id}' 열림 대사가 없습니다 — 열려도 화면이 조용합니다`);
    assert.ok(d, `'${q.id}' 완료 대사가 없습니다`);
    assert.ok(SCRIPTS[o] && SCRIPTS[o].length, `없는 대사 '${o}'`);
    assert.ok(SCRIPTS[d] && SCRIPTS[d].length, `없는 대사 '${d}'`);
  }
  info(`말하는 줄 ${talk.length}/${QUESTS.length}`);
});
check('⑴ ★ 조용하기로 한 줄은 **정말로** 대사가 없다 (표와 지도가 같은 말을 한다)', () => {
  for (const q of QUESTS.filter(x => !questSpeaks(x))) {
    assert.ok(!QUEST_OPEN_SCRIPT[q.id],
      `'${q.id}' 는 speaks:false 인데 열림 대사가 있습니다 — 둘 중 하나가 낡았습니다`);
    assert.ok(!QUEST_DONE_SCRIPT[q.id], `'${q.id}' 는 speaks:false 인데 완료 대사가 있습니다`);
  }
  const mute = QUESTS.filter(q => !questSpeaks(q)).map(q => q.id);
  if (mute.length) info(`⚠ 아직 조용한 줄 ${mute.length}개 — ${mute.join(' · ')}`);
});
/* ★ 2026-10-10 [plan] 빨간 검사 정리(총괄) — 물린 줄의 옛 열쇠는 대사 지도에 남아도 된다(열리지 않으니 말도 안 난다).
     resow_siru(「한 시루를 2바퀴째」) — 2026-09-04 7346fbc6 에서 물림(박사님 「1바퀴 더 돌리는 퀘는 없애」 · 첫 수확 바로 뒤가 씨앗 주문).
   ⚠ 물린 줄이 아니면서 표에 없는 열쇠는 여전히 빨갛다. */
const RETIRED_IDS = RETIRED_QUESTS.map(q => q.id);
check('⑴ 대사 지도에 표에 없는 줄이 없다 (물린 줄은 따로 센다)', () => {
  for (const id of [...Object.keys(QUEST_OPEN_SCRIPT), ...Object.keys(QUEST_DONE_SCRIPT)])
    assert.ok(QUEST_IDS.includes(id) || RETIRED_IDS.includes(id), `표에 없는 퀘스트 대사: '${id}'`);
  const old = [...new Set(Object.keys(QUEST_OPEN_SCRIPT).filter(id => RETIRED_IDS.includes(id)))];
  if (old.length) info(`물린 줄의 옛 대사 열쇠 ${old.length} — ${old.join(' · ')} (열리지 않아 말도 안 난다)`);
});
/* ══ ⚠ 2026-08-16 — **재는 것을 옮겼다** ═══════════════════════════════════
   예전: *"줄마다 `stamina.quests` 에 값이 있어야 한다"*.
   그런데 초반 사슬 여덟은 `data/balance/stamina.json` 도 `stamina.js` 도 이 창의
   쓰기 영역 밖이라 그 표에 못 넣었다(그래서 0 이다 — `grantStaminaQuest` 가 0 으로 읽는다).
   ★ 정말로 지켜야 하는 것은 「표에 칸이 있나」가 아니라
     **「화면이 이 줄의 보상을 말할 수 있나」**다 — `test_questui C-8` 이 재는 그것.
     말할 길은 둘뿐이다: 체력 표에 값이 있거나 · `reward` 에 글이 있거나.
   ⇒ **둘 중 하나는 반드시 있어야 한다**로 바꿨다. 옛 여덟 줄은 그대로 통과한다. */
check('⑴ 줄마다 보상을 **말할 수 있다** (체력 값이든 · 세상이 주는 것이든)', () => {
  for (const q of QUESTS) {
    const hasStamina = Object.prototype.hasOwnProperty.call(STAMINA_RULES.quests, q.id);
    const hasWord = typeof q.reward === 'string' && q.reward.trim().length > 0;
    assert.ok(hasStamina || hasWord,
      `'${q.id}' 의 보상을 말할 길이 없습니다 — 화면이 빈칸을 그립니다`);
  }
  const worded = QUESTS.filter(q => q.reward);
  info(`세상이 주는 보상으로 적힌 줄 ${worded.length}개`);
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
  /* ★ 2026-10-10 [plan] — «바퀴»는 2026-09-04 bfaeefab(사슬을 다시 짰다)에서 이 줄에서 빠졌다(시루 수만 센다). 남아 있으면 그때 다시 잰다 */
  if (q.need.cycles != null)
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

/* ══ ★★★ 초반 사슬 — **첫 플레이가 도는 동안** (2026-08-16 신설) ═══════════
   `src/game/first_play.js` 의 실제 걸음을 그대로 따라간다:
     놓기 → 물 → 첫 수확 → 다시 심기 → 시루 둘 → 몬스테라 자리 → 잎 2 → 잎 3
   ★ 걸음을 **둘씩** 두었다(열리는 걸음 · 끝내는 걸음). 한 걸음에 열고 닫으면
     「열린 채로 화면에 남는가」를 못 잰다 — 그게 이 계통의 존재 이유다. */
const pot = (o = {}) => ({ kind: 'beansprout', harvestCount: 0, placed: false, watered: false, ...o });
const fp = (day, o = {}) => {
  const pots = o.pots || [pot()];
  return { ...S0, day, cropPots: pots,
           cropHarvestTotal: pots.reduce((a, p) => a + (p.harvestCount || 0), 0),
           monsteraArrived: o.arrived ?? false,
           monsteraHomed: o.homed ?? false,
           motherLeaves: o.leaves ?? 0 };
};
const P1 = pot({ placed: true });
const P1W = pot({ placed: true, watered: true });
const H1 = pot({ placed: true, watered: true, harvestCount: 1 });
const H2 = pot({ placed: true, watered: true, harvestCount: 2 });
/* ★ 2026-08-17 — **세 바퀴째**. `order_seed` 가 여기서 끝난다(quest.js §씨앗 주문 —
   갖고 있던 한 봉지로는 두 바퀴가 끝이라 세 바퀴째는 산 씨앗이라야 돈다) */
const H3 = pot({ placed: true, watered: true, harvestCount: 3 });

/* ══ ⚠⚠ 2026-08-17 — **걸음을 다시 짰다** (초반 사슬이 여덟 → 일곱 + 둘로 갈렸다) ══
   ① `order_seed`(씨앗을 주문한다)가 ④와 ⑤ 사이에 들어왔다 — **총 3회전**이 문턱이라
      그 걸음을 새로 넣었다. 넣기 전에는 `H2` 에서 총합이 2 에 머물러 그 줄이 안 끝났고,
      뒤에 걸린 ⑤⑥ 이 통째로 밀렸다(실측 — 사슬이 8걸음에서 19걸음으로 밀렸다).
   ② `leaf_two`·`leaf_three` 가 사슬에서 빠져 **맨 뒤**로 갔다(`quest.SLOW_QUESTS`).
      걸음 자체는 그대로 둔다 — 그 둘도 여전히 열리고 끝나야 하기 때문이다.
   ③ ★ **몬스테라 도착을 뒤로 옮겼다.** 예전 7걸음에 `arrived: true` 였는데, 실제 문턱은
      **총 3회전**이다(`first_play.MONSTERA_ARRIVAL_RULE.harvestCount = 3`).
      1회전에 도착시킨 것은 옛 걸음표가 틀린 것이었고, `crop_mix` 가 도착을 보게 된
      지금은 그 틀림이 **첫 플레이가 끝나기 전에 본 줄기가 열리는** 모양으로 드러난다. */
/* ★ 2026-10-10 [plan] 본 줄기 · 원룸 · 새 종 걸음의 손잡이(아래 §본 줄기) */
const bean  = n => Array.from({ length: n }, () => ({ kind: 'beansprout', harvestCount: 5, placed: true, watered: true }));
const musun = n => Array.from({ length: n }, () => ({ kind: 'musun', harvestCount: 1, placed: true }));
const MS = (day, o = {}) => ({ ...S0, day, firstPlayDone: true, monsteraArrived: true, monsteraHomed: true, monsteraGrowing: true,
                               motherLeaves: 3, cropHarvestTotal: 20, cropPots: bean(16), ...o });
const LATE = { cropPots: [...bean(16), ...musun(5)], lampUnlocked: true };
const CW = { method: 'water', status: 'rooted', varieFromCut: false, varieLightBand: 'mid', gen: 1, rootedOnDay: 74 };
const VB = { method: 'water', status: 'rooted', varieFromCut: true, varieLightBand: 'bright', gen: 1, rootedOnDay: 90 };
const ES = { method: 'soil', status: 'established', varieFromCut: true, varieLightBand: 'bright', gen: 1, rootedOnDay: 125, at: true };
const OR = (day, o = {}) => MS(day, { ...LATE, motherVarieMatured: 2, lampOwned: 1, lampPlaced: 1, varieSaleCount: 1,
                                     movedOut: true, movedInOnDay: 110, targetWon: 5_000_000, cashWon: 300_000, varieSalesSinceMove: 0,
                                     bagPlants: 0, bagCuttings: 0, cuttings: [CW, VB], ...o });
const SPEC = { cuttings: [CW, VB, ES, { ...ES, gen: 2 }], varieSalesSinceMove: 1,
               ppPlants: 0, ppPinkHoldCuts: 0, alDormantNow: false, alWokeCount: 0, alCormsFound: 0, alFoundCormsPlanted: 0 };
/* ★ 2026-10-10 [plan] D59 — 산 집(투룸) · 진로 식물 가게 걸음. 원룸·새 종은 다 끝낸 판에서 */
const END_SPEC = { ...SPEC, ppPlants: 1, ppPinkHoldCuts: 1, alCormsFound: 1, alFoundCormsPlanted: 1, alWokeCount: 1, cashWon: 5_000_000 };
const HM = (day, o = {}) => OR(day, { ...END_SPEC, movedHome: true, job: 'shop', bagPlants: 0,
                                     shopDone: 0, shopRegulars: 0, shopOpenOrders: 0, shopDueSoonest: null, ...o });
const steps = [
  /* ─ 초반 사슬 ─────────────────────────────────────────────────────── */
  /* 1  ★★ 켠 그 순간 — **여기서 ①이 열려야 한다**(예전엔 0줄이었다) */
  fp(1),
  /* 2  방에 놓았다 — ① 완료 */
  fp(1, { pots: [P1] }),
  /* 3  ② 열림. 아직 물은 안 줬다 — 놓는 것과 시작하는 것은 다른 동작이다 */
  fp(2, { pots: [P1] }),
  /* 4  물을 줬다 — ② 완료 (물 준 날이 0일차) */
  fp(2, { pots: [P1W] }),
  /* 5  ③ 열림. 자라는 중이라 아직 못 거둔다 */
  fp(5, { pots: [P1W] }),
  /* 6  거뒀다 — ③ 완료 */
  fp(7, { pots: [H1] }),
  /* 7  ④ 열림 — 빈 시루를 다시 심어야 한다 (몬스테라는 아직이다 — 총 1회전) */
  fp(8, { pots: [H1] }),
  /* 8  두 바퀴째를 거뒀다 — ④ 완료. ★ 이 순간 **갖고 있던 씨앗 한 봉지가 다 나갔다** */
  fp(13, { pots: [H2] }),
  /* 9  ④-b 열림 — 심을 씨앗이 없다. 상점에서 주문해야 한다 */
  fp(14, { pots: [H2] }),
  /* 10 ★ 주문한 씨앗이 와서 세 바퀴째를 거뒀다 — ④-b 완료.
        총 3회전이라 **몬스테라도 이 날 온다**(`MONSTERA_ARRIVAL_RULE.harvestCount = 3`).
        ⇒ 무순이 상점에 뜨는 순간이라 `crop_mix` 도 여기서 열린다(quest.js §긴 줄 ㉠) */
  fp(19, { pots: [H3], arrived: true, leaves: 1 }),
  /* 11 ⑤ 열림 — 아직 시루가 하나다 */
  fp(20, { pots: [H3], arrived: true, leaves: 1 }),
  /* 12 시루를 하나 더 들였다 — ⑤ 완료 */
  fp(21, { pots: [H3, pot({ placed: true })], arrived: true, leaves: 1 }),
  /* 13 ⑥ 열림 — 몬스테라가 와 있어야만 열린다 */
  fp(22, { pots: [H3, P1], arrived: true, leaves: 1 }),
  /* 14 밝은 자리로 옮겼다 — ⑥ 완료. **여기까지가 초반 사슬 일곱 줄이다** */
  fp(23, { pots: [H3, P1], arrived: true, homed: true, leaves: 1 }),
  /* 15 느린 줄 ㉠ 열림 — 아직 잎이 하나다 */
  fp(24, { pots: [H3, P1], arrived: true, homed: true, leaves: 1 }),
  /* 16 잎이 둘이 됐다 — ㉠ 완료. 이때 `first_cut` 도 같이 열린다 */
  fp(30, { pots: [H3, P1], arrived: true, homed: true, leaves: 2 }),
  /* 17 느린 줄 ㉡ 열림 */
  fp(31, { pots: [H3, P1], arrived: true, homed: true, leaves: 2 }),
  /* 18 ★ 잎이 셋 — ㉡ 완료. 박사님이 *"잎 3개 날 때까지"* 라고 하신 그 끝이다 */
  fp(33, { pots: [H3, P1], arrived: true, homed: true, leaves: 3 }),

  /* ─ 본 줄기 — ★ 2026-10-10 [plan] 지금 규칙으로 다시 짰다(총괄 «빨간 검사 정리») ─────────────
     예전 걸음은 08-17 사슬(crop_mix 가 첫 플레이 끝에 열리고 siru5 가 «다섯 바퀴»)을 걸었다 — 2026-09-04 bfaeefab 에서
     사슬이 «시루 다섯 → 한 상에 두 가지 → 무순 다섯 · 여덟 → 열여섯»으로 바뀌어 crop_mix 가 영영 안 열렸고, 그 뒤 칸이 줄줄이 빨갰다.
     ⚠ 하루에 새로 여는 줄은 하나다(stepQuests 「한 번에 하나」) — 그래서 날을 하루씩 벌렸다.
     ★ 이사 · 원룸 여섯 · 새 종 셋까지 이어 걷는다 — 「전부 열리고 전부 끝난다」가 표 전체를 재게. */
  MS(34, { cropPots: bean(2) }),
  /* 시루 다섯 — siru5 완료 → crop_mix 열림(siru8 은 이튿날 이후) */
  MS(36, { cropPots: bean(5) }),
  MS(37, { cropPots: bean(5) }),
  MS(38, { cropPots: bean(5) }),
  /* 무순을 길러 한 상에 — crop_mix 완료 → radish5 */
  MS(46, { cropPots: [...bean(5), ...musun(1)], mealKinds: ['beansprout', 'musun'] }),
  MS(47, { cropPots: [...bean(5), ...musun(1)], mealKinds: ['beansprout', 'musun'] }),
  MS(48, { cropPots: [...bean(5), ...musun(5)], mealKinds: ['beansprout', 'musun'] }),
  /* 여덟 · 열여섯(놓인 것만 센다) */
  MS(50, { cropPots: [...bean(8), ...musun(5)] }),
  MS(51, { cropPots: [...bean(8), ...musun(5)] }),
  MS(56, { cropPots: [...bean(16), ...musun(5)] }),
  /* 가을 — 등이 풀린다 · 무늬 잎이 다 자랐다(D25 · 둘) — 등 → 자르기 → 무늬 차례로 하루씩 */
  MS(60, { ...LATE, motherVarieMatured: 2, motherVarieLeaves: 2 }),
  MS(61, { ...LATE, motherVarieMatured: 2, motherVarieLeaves: 2 }),
  MS(62, { ...LATE, motherVarieMatured: 2, motherVarieLeaves: 2 }),
  /* 등을 놓았다 · 물꽂이가 뿌리를 냈다 — buy_lamp · first_cut 완료 */
  MS(75, { ...LATE, motherVarieMatured: 2, lampOwned: 1, lampPlaced: 1, cuttings: [CW] }),
  /* 무늬 삽수를 잘랐다 → sell_varie 열림 */
  MS(80, { ...LATE, motherVarieMatured: 2, lampOwned: 1, lampPlaced: 1, cuttings: [CW, { ...VB, status: 'rooting', varieLightBand: null }] }),
  /* 밝은 데서 뿌리냈다 — varie_bright 완료 */
  MS(92, { ...LATE, motherVarieMatured: 2, lampOwned: 1, lampPlaced: 1, cuttings: [CW, VB] }),
  /* 팔았다 — sell_varie 완료 */
  MS(100, { ...LATE, motherVarieMatured: 2, lampOwned: 1, lampPlaced: 1, cuttings: [CW, VB], varieSaleCount: 1 }),

  /* ─ 이사 · 원룸 여섯 줄(D41 차례) ─────────────────────────────────── */
  OR(110, { bagPlants: 1, bagCuttings: 1 }),
  OR(111, { bagPlants: 0, bagCuttings: 0 }),
  OR(112), OR(113), OR(114), OR(115),
  /* 원룸에서 뿌리내린 무늬 삽수를 흙에 옮겨 키웠다 — settle 완료 */
  OR(140, { cuttings: [CW, VB, ES] }),
  OR(141, { cuttings: [CW, VB, ES] }),
  /* 키운 그루에서 다시 잘랐다(gen 2) — recut 완료 */
  OR(170, { cuttings: [CW, VB, ES, { ...ES, gen: 2 }] }),
  /* 이사 뒤 무늬를 팔았다 — oneroom_sell 완료 */
  OR(180, { cuttings: [CW, VB, ES, { ...ES, gen: 2 }], varieSalesSinceMove: 1 }),

  /* ─ 새 종 곁줄 셋(D45 · D52) ────────────────────────────────────────── */
  OR(190, { ...SPEC, ppPlants: 1 }),
  OR(220, { ...SPEC, ppPlants: 1, ppPinkHoldCuts: 1 }),
  OR(290, { ...SPEC, ppPlants: 1, ppPinkHoldCuts: 1, alDormantNow: true, alCormsFound: 1 }),
  OR(291, { ...SPEC, ppPlants: 1, ppPinkHoldCuts: 1, alDormantNow: true, alCormsFound: 1 }),
  OR(300, { ...SPEC, ppPlants: 1, ppPinkHoldCuts: 1, alDormantNow: true, alCormsFound: 1, alFoundCormsPlanted: 1 }),
  OR(360, { ...SPEC, ppPlants: 1, ppPinkHoldCuts: 1, alDormantNow: false, alCormsFound: 1, alFoundCormsPlanted: 1, alWokeCount: 1 }),
  /* 내 집 자금이 모였다 — home_fund 완료 */
  OR(400, { ...END_SPEC }),

  /* ─ 진로 «식물 가게»(D59) — 산 투룸으로 옮김 · 가게 사슬 다섯 ─────────────── */
  HM(420, { bagPlants: 1 }),
  HM(421),
  HM(422, { shopOpenOrders: 1, shopDueSoonest: 21 }),
  HM(430, { shopDone: 1, shopRegulars: 1 }),
  HM(431, { shopDone: 1, shopRegulars: 1 }),
  HM(470, { shopDone: 3, shopRegulars: 3 }),
  HM(471, { shopDone: 3, shopRegulars: 3 }),
  HM(560, { shopDone: 10, shopRegulars: 10 }),
  HM(561, { shopDone: 10, shopRegulars: 10 }),
  HM(800, { shopDone: 30, shopRegulars: 30 })
];
steps.forEach((s, i) => step(i + 1, s));

/* ⚠ 줄 수를 이름에 안 박는다 — 2026-08-16 에 여덟이 열여섯이 됐고, 그때 "여덟 줄"이라
   적힌 이름 넷이 한꺼번에 낡았다(START-HERE §2.8 의 그 모양). 표에서 센다. */
check(`⑵ ${QUEST_IDS.length}줄이 전부 열린다`, () => {
  const got = openedAt.map(([id]) => id);
  for (const id of QUEST_IDS)
    assert.ok(got.includes(id), `'${id}' 가 한 번도 안 열렸습니다 — 없는 것과 같습니다`);
  info(`열린 차례 — ${openedAt.map(([id, n]) => `${n}걸음 ${id}`).join(' · ')}`);
});
check(`⑵ ${QUEST_IDS.length}줄이 전부 끝난다`, () => {
  const got = doneAt.map(([id]) => id);
  for (const id of QUEST_IDS) assert.ok(got.includes(id), `'${id}' 가 안 끝났습니다`);
  info(`끝난 차례 — ${doneAt.map(([id, n]) => `${n}걸음 ${id}`).join(' · ')}`);
});
/* ══ ★★★ 2026-08-16 신설 — **초반 사슬** (§초반 사슬) ═══════════════════════ */
/* ══ ⚠⚠ 2026-08-17 — **재는 자를 고쳤다** ═══════════════════════════════════
   예전에는 *"`crop_mix` 가 열린 걸음 = 첫 플레이가 끝난 걸음"* 을 자로 썼다.
   그 등식이 **2026-08-17 에 깨졌다** — `crop_mix` 가 이제 「무순을 살 수 있게 된 때」
   (몬스테라 도착)에도 열린다(`quest.js §긴 줄 ㉠`). 즉 그 줄은 첫 플레이가 **도는 동안**
   열릴 수 있다. 자를 안 고치면 **고친 쪽이 검사를 깨게 된다**(START-HERE §2 의 그 모양).
   ⇒ **`firstPlayDone` 을 직접 본다.** 원래 재려던 것이 그것이다 — 대리 지표를 쓰다가
     그 대리 지표가 움직인 것이지, 재려던 사실이 바뀐 것이 아니다. */
check('⑵ ★★ 초반 사슬은 **첫 플레이가 끝나기 전에** 다 끝난다', () => {
  const doneStep = new Map(doneAt.map(([id, n]) => [id, n]));
  const fpEnd = steps.findIndex(s => s && s.firstPlayDone) + 1;   /* 1부터 세는 걸음 번호 */
  assert.ok(fpEnd > 0, '첫 플레이가 끝나는 걸음이 없습니다');
  for (const id of FIRST_PLAY_CHAIN_IDS)
    assert.ok(doneStep.get(id) < fpEnd,
      `'${id}' 가 첫 플레이 뒤(${doneStep.get(id)}걸음)에 끝났습니다 — 사슬이 구간을 넘겼습니다`);
  info(`초반 사슬 ${FIRST_PLAY_CHAIN_IDS.length}줄이 1~${fpEnd - 1}걸음에 다 끝났다`);
});
/* ══ ★★★ 2026-08-17 신설 — **긴 줄이 짧은 줄을 막지 않는다** (`quest.js §긴 줄`) ══════
   박사님: *"잎 두 장·잎 세 장 퀘스트 앞에 「한 상에 두 가지」 등 퀘가 배치돼야 될 듯?
           잎 두 장·잎 세 장은 **엄청 오래 걸리니까.**"*
   ⚠ 이 검사가 재는 것은 **여는 차례가 아니라 「지금 할 일」로 뽑히는 차례**다.
     잎 줄은 예전에도 사슬을 막지 않았다(뒤에 걸린 줄이 없다) — 막은 것은 `next` 였다. */
check('⑶ ★★★ 느린 줄은 **다른 줄이 열려 있는 동안 「지금 할 일」이 안 된다**', () => {
  const b = newBoard();
  /* 초반 사슬을 다 끝낸 판 = 잎 줄과 `crop_mix` 가 **같이** 열려 있는 그 자리다 */
  b.stamina.questsTaken = [...FIRST_PLAY_CHAIN_IDS];
  /* ★ 2026-10-10 [plan] — 사슬 뒤 짧은 줄은 이제 siru5_cycle5 다(2026-09-04 bfaeefab · crop_mix 는 그 뒤). 시루 둘을 놓고 몬스테라 자리를 잡은 판 */
  const v = questView(b, { ...S0, day: 25, monsteraArrived: true, monsteraHomed: true, motherLeaves: 1, cropPots: [P1W, P1W] });
  assert.ok(v.open.includes('leaf_two'), `잎 줄이 안 열렸습니다: ${v.open}`);
  assert.ok(v.open.includes('siru5_cycle5'), `짧은 줄이 안 열렸습니다: ${v.open}`);
  assert.ok(!SLOW_QUEST_IDS.includes(v.next.id),
    `느린 줄이 「지금 할 일」을 차지했습니다: ${v.next.id}`);
  info(`같이 열린 줄 ${v.open.length}개 · 「지금 할 일」은 「${v.next.ko}」`);
});
check('⑶ ★★ 그래도 **느린 줄이 사라지지는 않는다** (열리고 · 목록에 남고 · 끝난다)', () => {
  const got = openedAt.map(([id]) => id), fin = doneAt.map(([id]) => id);
  for (const id of SLOW_QUEST_IDS) {
    assert.ok(got.includes(id), `'${id}' 가 한 번도 안 열렸습니다`);
    assert.ok(fin.includes(id), `'${id}' 가 안 끝났습니다`);
  }
  /* 아무것도 안 열린 판에서는 **비로소** 「지금 할 일」이 된다 — 그때는 그것이 참말이다 */
  const b = newBoard();
  b.stamina.questsTaken = QUEST_IDS.filter(id => !SLOW_QUEST_IDS.includes(id));
  const v = questView(b, { ...S0, motherLeaves: 1 });
  assert.equal(v.next && v.next.id, SLOW_QUEST_IDS[0],
    `할 게 그것뿐인데도 안 뽑혔습니다: ${v.next && v.next.id}`);
});
check('⑵ ★★★ **한 걸음에 두 줄이 새로 열리지 않는다** (심부름 목록이 안 된다)', () => {
  const byStep = new Map();
  for (const [id, n] of openedAt) byStep.set(n, [...(byStep.get(n) || []), id]);
  /* ⚠ 본 줄기에는 **일부러 같이 열리는 자리**가 있다(`first_cut`+`buy_lamp` — 잎 둘과
     가을이 같은 날 올 수 있다). 그건 예전부터 그랬고 고칠 것이 아니다.
     여기서 못 박는 것은 **초반 사슬**이다 — 거기서 둘이 같이 열리면 사슬이 아니다. */
  for (const [n, ids] of byStep) {
    const mine = ids.filter(id => FIRST_PLAY_CHAIN_IDS.includes(id));
    assert.ok(mine.length <= 1, `${n}걸음에 초반 사슬이 둘 열렸습니다: ${mine}`);
  }
});
check('⑵ ★ 초반 사슬은 **정의 순서 그대로** 열린다 (사슬이 안 끊긴다)', () => {
  const order = openedAt.map(([id]) => id).filter(id => FIRST_PLAY_CHAIN_IDS.includes(id));
  assert.deepEqual(order, [...FIRST_PLAY_CHAIN_IDS], `사슬 차례가 어긋납니다: ${order}`);
});
check('⑵ ★ 초반 사슬은 **첫 플레이 구간의 줄**로만 되어 있다', () => {
  for (const id of FIRST_PLAY_CHAIN_IDS)
    assert.equal(stageOfQuest(id), 'first_play', `'${id}' 의 마디가 어긋납니다`);
  for (const id of QUEST_IDS.filter(i => !FIRST_PLAY_CHAIN_IDS.includes(i)))
    assert.equal(stageOfQuest(id), 'main', `'${id}' 의 마디가 어긋납니다`);
});
/* ══ ⚠⚠ 2026-08-16 — **이 검사를 두 개로 갈랐다** ═══════════════════════════
   예전: *"여는 순서가 정의 순서와 같다"* — 열여섯 줄이 되면서 **참이 아니게** 됐다.
   까닭은 버그가 아니라 구조다: **줄기가 둘이고 나란히 돈다.**
     초반 사슬 — 첫 플레이의 걸음을 따라간다
     본 줄기   — 각자 제 사실로 열린다. `first_cut` 은 **모주 잎 둘**이면 열리는데,
                 실측으로 그건 첫 플레이가 끝나기 **전**이다(START-HERE) —
                 그래서 정의가 뒤인 `first_cut` 이 앞인 `crop_mix` 보다 먼저 열린다.
   ⚠ 그것을 「어긋남」으로 재면 **고치려고 `first_cut` 을 건드리게 된다.** 그건 회귀다.
   ⇒ 아래 두 검사가 그 자리를 맡는다 — **사슬로 걸린 줄만** 차례를 잰다(`after`).
   ⚠ 그러면 「본 줄기 안에서 차례가 뒤집히는 것」은 이제 아무도 안 잰다. 적어 둔다:
     **안 재는 것이 맞다.** 열린 차례가 뒤집혀도 플레이어에게 닿는 차례는 안 뒤집힌다 —
     `questView` 가 「지금 할 일」로 **정의 순서에서 첫째**를 고르기 때문이다(§questView).
     즉 `first_cut` 이 먼저 열려도 화면은 `crop_mix` 를 먼저 말한다. */
check('⑶ ★★ 사슬로 걸린 줄은 **앞 줄이 끝난 뒤에만** 열린다', () => {
  const openStep = new Map(openedAt.map(([id, n]) => [id, n]));
  const doneStep = new Map(doneAt.map(([id, n]) => [id, n]));
  const chained = QUESTS.filter(q => q.after);
  assert.ok(chained.length, '`after` 가 적힌 줄이 하나도 없습니다');
  for (const q of chained) {
    assert.ok(QUEST_IDS.includes(q.after), `'${q.id}.after' 가 없는 줄을 가리킵니다: ${q.after}`);
    assert.ok(doneStep.has(q.after), `'${q.after}' 가 안 끝났습니다`);
    /* ★★ 2026-08-17 — **같은 걸음도 맞는 것으로 친다** (박사님: *"퀘스트 나오기 전 이미
       달성했으면 자동 완료되게 해줘"*). `stepQuests` 가 이제 **더 안 바뀔 때까지 돌므로**,
       앞 줄이 끝나면 뒷줄이 **그 걸음 안에서** 열린다 — 하루를 안 기다린다.
       ⚠ 재는 것은 여전히 「앞이 끝난 뒤에 열렸나」다. 다만 「뒤」의 눈금이 **걸음에서
         이벤트 차례로** 내려왔다. 같은 걸음 안에서도 끝난 것이 먼저 실린다(아래 ⑶ 이 잰다).
       ⚠ **앞 줄이 안 끝났는데 열리는 것**은 여전히 빨갛다 — 그건 사슬이 깨진 것이다. */
    assert.ok(openStep.get(q.id) >= doneStep.get(q.after),
      `'${q.id}' 가 '${q.after}' 보다 먼저 열렸습니다 ` +
      `(${openStep.get(q.id)}걸음 vs ${doneStep.get(q.after)}걸음)`);
  }
  info(`사슬로 걸린 줄 ${chained.length}개 — 전부 앞 줄 뒤에 열렸다`);
});
check('⑶ ★★★ 표의 `after` 가 **실제 판정과 같은 말**을 한다 (두 벌이 안 된다)', () => {
  /* 그 줄이 실제로 열렸던 걸음의 스냅샷을 그대로 쓰되, **끝낸 목록만 비운다.**
     `after` 가 진짜 여는 열쇠라면 여기서 반드시 안 열려야 한다. */
  const openStep = new Map(openedAt.map(([id, n]) => [id, n]));
  for (const q of QUESTS.filter(x => x.after)) {
    const snap = steps[openStep.get(q.id) - 1];
    const got = q.opens(snap, { doneIds: [], S: newBoard(), q });
    assert.equal(!!got, false,
      `'${q.id}' 는 '${q.after}' 를 안 끝내도 열립니다 — 표가 거짓말을 합니다`);
    /* 반대쪽도 본다 — 앞 줄만 끝내면 그 걸음에서 열려야 한다 */
    const got2 = q.opens(snap, { doneIds: [q.after], S: newBoard(), q });
    assert.equal(!!got2, true, `'${q.id}' 가 '${q.after}' 를 끝냈는데도 안 열립니다`);
  }
});
check('⑶ ★ 끝난 것이 열린 것보다 먼저 말한다', () => {
  /* ★ 실측 — ① 완료는 3걸음, ② 열림은 **4걸음**이다. 한 걸음 벌어지는 까닭:
     `stepQuests` 는 걸음 **머리에서** 끝낸 목록(`questsTaken`)을 읽는데 보상은 그 뒤에
     붙는다. 그래서 「①을 끝낸 그 순간」에는 ②가 아직 안 열린다.
     ⇒ 버그가 아니라 **한 박자**다. 두 안내가 한 화면에 겹치지 않아 오히려 낫다.
     여기서 재는 것은 그래도 **말의 앞뒤가 안 뒤집히는가**다 —
     `EVENT_ORDER` 의 `quest_done → quest_opened` 가 같은 날 겹칠 때를 지킨다. */
  /* ★ 2026-10-10 [plan] — 지금 사슬은 «시루 다섯 끝 → 한 상에 두 가지 열림»(2026-09-04 bfaeefab). 열쇠는 지도에서 읽는다 */
  const i = said.indexOf(QUEST_DONE_SCRIPT.siru5_cycle5), j = said.indexOf(QUEST_OPEN_SCRIPT.crop_mix);
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
check('⑹ 퀘스트 대사가 전부 화면까지 나온다 (물린 줄 빼고)', () => {
  const live = id => !RETIRED_IDS.includes(id);
  for (const id of [...Object.entries(QUEST_OPEN_SCRIPT), ...Object.entries(QUEST_DONE_SCRIPT)].filter(([q]) => live(q)).map(([, v]) => v))
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

/* ★ 2026-10-10 [plan] — ③ «한 그루가 둘이 된다»: 들고 온 무늬 삽수(이사 «전»에 뿌리냄)를 원룸에서 흙에 옮겨도 끝난다.
     옛 조건(«이사 뒤에 뿌리낸 것만»)은 D41 할 일(«혹이 나면 흙에 옮겨 심으세요»)을 따른 사람을 막았다. 옛 조건이면 이 칸이 빨갛다. */
check('③ 들고 온 무늬 삽수를 흙에 옮겨도 «한 그루가 둘이 된다»가 끝난다', () => {
  const q = questOf('oneroom_settle_cutting');
  const brought = { method: 'soil', status: 'established', varieFromCut: true, varieLightBand: 'bright', gen: 1, rootedOnDay: 90 };
  assert.ok(q.done({ ...S0, movedOut: true, movedInOnDay: 110, cuttings: [brought] }), '들고 온 삽수를 흙에 옮겼는데 안 끝납니다');
  assert.ok(!q.done({ ...S0, movedOut: true, movedInOnDay: 110, cuttings: [{ ...brought, status: 'rooted' }] }), '흙에 안 옮겼는데 끝납니다');
  assert.ok(!q.done({ ...S0, movedOut: true, movedInOnDay: 110, cuttings: [{ ...brought, varieFromCut: false }] }), '무늬 아닌 삽수로 끝납니다');
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
/* ══ ⚠⚠ 2026-08-16 — **이 검사를 뒤집었다** ═════════════════════════════════
   예전: *"아무것도 안 열린 판은 next 가 null 이다"* — 켠 첫 순간을 재고 있었고,
   그때 열린 줄이 **0** 이었다. 그것이 박사님이 잡으신 구멍 그 자체다
   (*"잎 3개 날 때까지 너무 이벤트가 없더라"*). 즉 **고장난 상태를 검사가 정상으로 못 박고
   있었다** — START-HERE §2 가 *"제일 위험하다"* 고 적은 바로 그 모양이다.
   ⇒ 이제 **켠 첫 순간에 딱 한 줄이 열려야** 한다. 「next 가 null 인 판」은 다 끝낸 판뿐이다. */
check('화면 — ★★★ 켠 **첫 순간에 딱 한 줄**이 열린다 (예전엔 0줄이었다)', () => {
  const b3 = newBoard();
  const v = questView(b3, S0);
  assert.equal(v.open.length, 1, `열린 줄 ${v.open.length}개: ${v.open}`);
  assert.equal(v.open[0], FIRST_PLAY_CHAIN_IDS[0], `첫 줄이 사슬의 첫째가 아닙니다: ${v.open[0]}`);
  assert.ok(v.next && v.next.todo, 'next 가 없습니다');
  info(`첫 순간의 할 일 — 「${v.next.todo}」 (${v.stage} ${v.chain.index}/${v.chain.total})`);
});
check('화면 — 다 끝낸 판은 next 가 null 이고 마디가 `clear` 다', () => {
  const b4 = newBoard();
  b4.stamina.questsTaken = [...QUEST_IDS];
  const v = questView(b4, S0);
  assert.equal(v.next, null);
  assert.equal(v.stage, 'clear');
  assert.equal(v.upcoming.length, 0);
});

/* ══ ★★★ 2026-08-16 신설 — **「지금 하나 + 다음 몇 줄」 계약** ════════════════
   박사님: *"그리고 한 번에 보여주고… 단계적 목표로 가이드랑 연계해서."*
   화면이 그리는 데 필요한 것을 코어가 내는가를 잰다(그리는 법은 화면이 정한다). */
check('화면 — ★★ 「지금 하나」와 「다음에 올 것」이 갈려 나온다', () => {
  const b5 = newBoard();
  const v = questView(b5, S0);
  assert.equal(v.current && v.current.id, v.next && v.next.id, 'current 와 next 가 다릅니다');
  assert.ok(v.upcoming.length > 0, '다음에 올 줄이 없습니다');
  assert.ok(!v.upcoming.some(a => a.id === v.current.id), '지금 하나가 다음 목록에 또 있습니다');
  assert.ok(v.upcoming.every(a => a.state !== 'done'), '끝낸 줄이 다음 목록에 있습니다');
  /* 정의 순서 그대로 · 지금 하나 **뒤**의 것만 */
  assert.ok(v.upcoming.every(a => a.index > v.current.index), '앞의 줄이 다음 목록에 있습니다');
  const idx = v.upcoming.map(a => a.index);
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b), '다음 목록이 정의 순서가 아닙니다');
  info(`지금 「${v.current.ko}」 · 다음 ${v.upcoming.length}줄 중 앞 셋 — ` +
       v.upcoming.slice(0, 3).map(a => a.ko).join(' · '));
});
check('화면 — ★ 셈이 스스로 안 어긋난다 (total = done + open + locked)', () => {
  const b6 = newBoard();
  for (const snap of [S0, steps[6], steps[20], steps[steps.length - 1]]) {
    const v = questView(b6, snap);
    const c = v.counts;
    assert.equal(c.total, QUEST_IDS.length);
    assert.equal(c.done + c.open + c.locked, c.total,
      `${c.done}+${c.open}+${c.locked} ≠ ${c.total}`);
    assert.equal(c.open, v.open.length);
    assert.equal(v.all.filter(a => a.state === 'locked').length, c.locked);
  }
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
