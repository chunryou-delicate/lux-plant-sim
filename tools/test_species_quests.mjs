/* test_species_quests — 2026-10-09 [plan] D45 새 식물 두 종의 곁줄 셋(quest.js §SPECIES_QUESTS)
   ① 칸이 null(배선 전)이면 셋 다 안 열린다 — 판을 안 바꾼다
   ② 걸어서: PP 가 들어오면 «분홍을 붙잡는다»가 열리고, 분홍 마디 위에서 자르면 끝난다
   ③ 걸어서: AL 이 잠들면(그날 흙 속 구근을 찾음 · D52) «겨울잠을 지킨다»와 «구근을 심는다»가 같이 열리고, 깨면 «겨울잠»이 끝난다
   ④ 상점에서 산 구근을 심은 것으로는 «구근을 심는다»가 끝나지 않는다(찾은 구근만 침)
   ⑤ 원룸 사슬이 열려 있는 동안 새 종 줄은 「지금 할 일」을 안 잡는다
   ⑥ 대사: 열림·끝 대사가 다 있고, 사건 갈림(교환 두 번째 · 구근 싹 무늬/민무늬)이 맞게 갈린다
   실행: node tools/test_species_quests.mjs */
import assert from 'node:assert/strict';
import { QUESTS, SPECIES_QUEST_IDS, emptySnapshot, stepQuests, questView } from '../src/game/quest.js';
import { scriptsForEvents, SCRIPTS } from '../src/game/dialogue.js';

let fails = 0;
const check = (name, fn) => {
  try { fn(); console.log(`PASS  ${name}`); }
  catch (e) { fails++; console.log(`FAIL  ${name}\n      ${e.message}`); }
};

const S0 = emptySnapshot();
const board = () => ({ stamina: { questsTaken: [] } });
const walk = (S, snap) => {
  const r = stepQuests(S, snap);
  S.stamina.questsTaken.push(...r.finished);
  return r;
};
const ONE = { ...S0, movedOut: true, movedInOnDay: 150 };

check('① 칸이 null 이면 셋 다 안 열린다', () => {
  const S = board();
  const r = walk(S, { ...ONE, day: 160 });
  for (const id of SPECIES_QUEST_IDS) assert.ok(!r.opened.includes(id), `${id} 가 배선 전에 열렸습니다`);
});

check('② PP — 들어오면 열리고, 분홍 마디 위에서 자르면 끝난다', () => {
  const S = board();
  walk(S, { ...ONE, day: 190, ppPlants: 0, ppPinkHoldCuts: 0 });
  const a = walk(S, { ...ONE, day: 191, ppPlants: 1, ppPinkHoldCuts: 0 });
  assert.ok(a.opened.includes('pp_hold_pink'), '그루가 들어온 날 안 열렸습니다');
  const b = walk(S, { ...ONE, day: 230, ppPlants: 1, ppPinkHoldCuts: 1 });
  assert.ok(b.finished.includes('pp_hold_pink'), '분홍 마디 위에서 잘랐는데 안 끝났습니다');
});

check('③ AL — 잠드는 날 «겨울잠»·«구근을 심는다»가 같이 열리고, 깨면 «겨울잠»이 끝난다 (D52)', () => {
  const S = board();
  const base = { ...ONE, alWokeCount: 0, alCormsFound: 0, alFoundCormsPlanted: 0 };
  const a = walk(S, { ...base, day: 220, alDormantNow: false });
  assert.ok(!a.opened.includes('al_keep_winter'), '깨어 있는데 열렸습니다');
  const b = walk(S, { ...base, day: 290, alDormantNow: true, alCormsFound: 2 });
  assert.ok(b.opened.includes('al_keep_winter'), '잠든 날 안 열렸습니다');
  /* 하루에 새로 여는 줄은 하나(stepQuests §「한 번에 하나」) — «구근을 심는다»는 이튿날. 잠든 날 대사가 구근을 먼저 보여 준다 */
  assert.ok(!b.opened.includes('al_plant_corm'), '하루 한 줄 규칙이 깨졌습니다');
  const b2 = walk(S, { ...base, day: 291, alDormantNow: true, alCormsFound: 2 });
  assert.ok(b2.opened.includes('al_plant_corm'), '구근을 찾은 이튿날 «구근을 심는다»가 안 열렸습니다');
  const c = walk(S, { ...base, day: 300, alDormantNow: true, alCormsFound: 2, alFoundCormsPlanted: 1 });
  assert.ok(c.finished.includes('al_plant_corm'), '찾은 구근을 심었는데 안 끝났습니다');
  const d = walk(S, { ...base, day: 360, alDormantNow: false, alWokeCount: 1, alCormsFound: 2, alFoundCormsPlanted: 1 });
  assert.ok(d.finished.includes('al_keep_winter'), '깼는데 안 끝났습니다');
});

check('④ 상점 구근을 심은 것으로는 «구근을 심는다»가 안 끝난다', () => {
  const S = board();
  const base = { ...ONE, alCormsFound: 0, alFoundCormsPlanted: 0 };
  walk(S, { ...base, day: 290, alDormantNow: true, alWokeCount: 0, alCormsFound: 1 });
  walk(S, { ...base, day: 360, alDormantNow: false, alWokeCount: 1, alCormsFound: 1 });
  const r = walk(S, { ...base, day: 361, alDormantNow: false, alWokeCount: 1, alCormsFound: 1 });
  assert.ok(!S.stamina.questsTaken.includes('al_plant_corm'), '찾은 구근을 안 심었는데 끝났습니다');
  void r;
});

check('⑤ 원룸 사슬이 열려 있는 동안 새 종 줄은 「지금 할 일」을 안 잡는다', () => {
  const S = board();
  const snap = { ...ONE, day: 200, ppPlants: 1, ppPinkHoldCuts: 0, alDormantNow: true, alWokeCount: 0 };
  walk(S, snap);
  const v = questView(S, snap);
  const firstSpecies = QUESTS.findIndex(q => SPECIES_QUEST_IDS.includes(q.id));
  const lastOther = QUESTS.length - 1 - [...QUESTS].reverse().findIndex(q => !SPECIES_QUEST_IDS.includes(q.id));
  assert.ok(firstSpecies > lastOther, '새 종 줄이 배열 끝 묶음이 아닙니다');
  if (v.current && SPECIES_QUEST_IDS.includes(v.current.id))
    assert.ok(v.open.every(id => SPECIES_QUEST_IDS.includes(id)), `다른 줄이 열려 있는데 ${v.current.id} 가 할 일입니다`);
});

check('⑥ 대사 — 열림·끝 대사가 있고 사건 갈림이 맞다', () => {
  for (const id of ['questPpHoldPink', 'questDonePpHoldPink', 'questAlKeepWinter', 'questDoneAlKeepWinter',
                    'questAlPlantCorm', 'questDoneAlPlantCorm'])
    assert.ok(Array.isArray(SCRIPTS[id]) && SCRIPTS[id].length, `${id} 대사가 없습니다`);
  const ids = evs => scriptsForEvents(evs, null);
  assert.deepEqual(ids([{ id: 'pp_trade_offer' }]), ['ppTradeOffer']);
  assert.deepEqual(ids([{ id: 'pp_trade_offer', again: true }]), ['ppTradeOfferAgain']);
  assert.deepEqual(ids([{ id: 'pp_trade_declined', last: true }]), ['ppTradeDeclinedLast']);
  assert.deepEqual(ids([{ id: 'al_sprout', varie: true }]), ['alSproutVarie']);
  assert.deepEqual(ids([{ id: 'al_sprout', varie: false }]), ['alSproutPlain']);
  assert.deepEqual(ids([{ id: 'al_sprout' }]), [], '무늬를 모르면 말이 없어야 합니다');
  /* D52 — 잠드는 날 구근은 corms > 0 일 때만 · «겨울잠» 열림 «뒤» · 구근이 없는 잠엔 구근 말이 없다 */
  assert.deepEqual(ids([{ id: 'al_asleep', corms: 2 }, { id: 'quest_opened', questId: 'al_keep_winter' }]),
                   ['questAlKeepWinter', 'alAsleepCorms']);
  assert.deepEqual(ids([{ id: 'al_asleep', corms: 0 }, { id: 'quest_opened', questId: 'al_keep_winter' }]), ['questAlKeepWinter']);
  assert.deepEqual(ids([{ id: 'al_asleep' }]), [], '구근 수를 모르면 말이 없어야 합니다');
  assert.deepEqual(ids([{ id: 'al_wake', first: true }]), []);
  assert.deepEqual(ids([{ id: 'al_wake', first: false }]), ['alWakeAgain']);
  /* «겨울잠» 열림 대사는 구근을 약속하지 않는다(구근 0 인 잠이 있다) */
  assert.ok(SCRIPTS.questAlKeepWinter.every(l => !/구근/.test(l.text)), '«겨울잠» 열림 대사가 구근을 말합니다');
  /* 교환 끝난 날 «분홍을 붙잡는다»가 열리면 「바꿨다」가 먼저 */
  assert.deepEqual(ids([{ id: 'quest_opened', questId: 'pp_hold_pink' }, { id: 'pp_trade_done' }]),
                   ['ppTradeDone', 'questPpHoldPink']);
  /* 몬이는 수를 말하지 않는다 */
  const D45 = ['ppTradeOffer', 'ppTradeOfferAgain', 'ppTradeDone', 'ppTradeDeclined', 'ppTradeDeclinedLast', 'ppPinkWarn',
               'ppTipWithered', 'ppReverted', 'alSproutVarie', 'alSproutPlain', 'statusAlSleeping',
               'questPpHoldPink', 'questDonePpHoldPink', 'questAlKeepWinter', 'questDoneAlKeepWinter',
               'questAlPlantCorm', 'questDoneAlPlantCorm', 'alAsleepCorms', 'alWakeAgain', 'statusHomeQuarter', 'statusHomeThreeQuarter'];
  for (const id of D45) for (const l of SCRIPTS[id])
    if (l.who === 'moni') assert.ok(!/[0-9]/.test(l.text), `${id}: 몬이가 수를 말합니다 — ${l.text}`);
});

console.log(fails ? `species_quests: FAIL (${fails})` : 'species_quests: PASS');
process.exit(fails ? 1 : 0);
