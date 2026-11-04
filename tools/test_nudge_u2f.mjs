/* tools/test_nudge_u2f.mjs — U2-f 몬이 독촉: 임자 · 날수 · 범용 셋([plan] docs/handoff/plan-nudge-u2f-20261104.md 8a44c714 · 총괄 11-04)
   node 만(크롬 없음) · 빨강 먼저: 고치기 전 판(1b15337a)
   ㉮ ② 쌓는 줄 16 + LONG_OWN 셋은 범용 셋(권함 · 물음 · 걱정)을 안 낸다 · 손 줄은 셋 다 낸다
   ㉯ ② 고른 줄(pp_hold_pink · al_plant_corm)은 권함 · 물음만(걱정 안 냄)
   ㉰ ④ 임자의 제 줄이 오늘 칸에서 조건으로 서면 범용 줄이 안 선다(되풀이 자는 안 봄) · 칸이 다르면 선다(siru5 Coming → 이튿날 물음)
   ㉱ ① 덧 새 줄(fresh0)이 화면 칩을 쥔 날은 범용 셋이 쉰다 · 제 줄은 선다
   ㉲ nudgeBack — 기다림 아닌 화면 칩이 있으면 안 선다 · 칩 없음은 선다 · 칩을 안 넘긴 옛 부름은 예전 그대로
   ㉳ ① 임자 = 넘긴 칩 줄(가장 먼저 열린 줄이 아님) · 열린 날을 모르면 · 기다림이면 · 끝났으면 · 칩을 안 넘기면 null
   ㉴ ① noteQuestWaits(chipId) — 칩이 아닌 열린 줄을 오늘로 적는다 · 칩 줄은 안 적는다 · opt 없으면 예전 그대로 · 날수는 칩에 선 날부터
   ㉵ ① questChipAfterCheck — 그날 아침 끝날 줄은 빠지고 이어 열릴 줄이 칩(checkQuests 뒤) · 상태를 안 바꾼다
   ㉶ 하루 대사(createStoryteller.turn) — 쌓는 줄이 칩인 판에서 범용 셋 0(투룸 꼴) · 손 줄 칩이면 권함이 선다 */
import assert from 'node:assert/strict';
const D = await import('../src/game/dialogue.js');
const Q = await import('../src/game/quest.js');
const W = await import('../src/game/nudge_wait.js');
const { CHATTER, NUDGE_DAYS, chatterContext, createStoryteller } = D;
const results = [];
const check = (name, fn) => { try { fn(); results.push(['OK  ', name]); } catch (e) { results.push(['FAIL', name, (e && e.message || String(e)).split('\n')[0].slice(0, 300)]); } };
const row = id => c => CHATTER.filter(r => r.id === id).some(r => { try { return !!r.when(c); } catch { return false; } });
const GEN = ['nudgeOffer', 'nudgeAsk', 'nudgeWorry'];
const gens = c => GEN.filter(id => row(id)(c));
const ctx = (id, days, o = {}) => ({ living: true, nudge: { id, days }, nudgeChip: id, nudgeFresh: false, ...o });
const STACK = ['oneroom_home_fund', 'radish5', 'al_keep_winter', 'shop_first_order', 'shop_regulars3', 'shop_sign', 'shop_town',
  'care_first', 'care_kinds3', 'care_sign', 'care_town', 'care_all_kinds', 'breed_first_sample', 'breed_first_variety', 'breed_three',
  'breed_three_lines', 'breed_all', 'sc_hang', 'ca_unfurl'];
const IDS = new Set((Q.QUESTS || []).map(q => q.id));

check('㉮ 쌓는 줄 19(LONG_OWN 3 + 진로 14 + sc_hang · ca_unfurl)은 범용 셋을 안 낸다 · 손 줄(home_unpack · first_cut)은 칸마다 하나씩 낸다', () => {
  for (const id of STACK) assert.ok(IDS.has(id), `없는 할 일 id: ${id}`);
  const bad = [];
  for (const id of STACK) for (const d of [1, 2, 5, 9, 40]) { const g = gens(ctx(id, d)); if (g.length) bad.push(`${id}:${d}→${g.join(',')}`); }
  assert.deepEqual(bad, [], '쌓는 줄을 두고 범용 줄이 섭니다');
  for (const id of ['home_unpack', 'care_unpack', 'breed_unpack']) {
    assert.deepEqual(gens(ctx(id, 2)), ['nudgeOffer'], `${id} 권함`);
    assert.deepEqual(gens(ctx(id, 5)), ['nudgeAsk'], `${id} 물음`);
    assert.deepEqual(gens(ctx(id, 9)), ['nudgeWorry'], `${id} 걱정`);
  }
});
check('㉯ 고른 줄(pp_hold_pink · al_plant_corm)은 권함 · 물음만 — 걱정 안 냄', () => {
  for (const id of ['pp_hold_pink', 'al_plant_corm']) {
    assert.ok(IDS.has(id), `없는 할 일 id: ${id}`);
    assert.deepEqual(gens(ctx(id, 2)), ['nudgeOffer'], `${id} 권함`);
    assert.deepEqual(gens(ctx(id, 5)), ['nudgeAsk'], `${id} 물음`);
    assert.deepEqual(gens(ctx(id, 9)), [], `${id} 걱정이 섭니다`);
    assert.deepEqual(gens(ctx(id, 60)), [], `${id} 걱정이 섭니다(60일)`);
  }
});
check('㉰ 제 줄이 오늘 칸에 서면 범용 줄 안 섬(siru8 권함 · varie_bright 기다림 · 시루 가방) · 칸이 다르면 섬(siru5 물음)', () => {
  /* siru8 권함 칸 — 제 줄 nudgeSiruOffer(가방 · 오는 중 0) */
  const s8 = ctx('siru8', 2, { siruBag: 0, siruIncoming: 0 });
  assert.equal(row('nudgeSiruOffer')(s8), true, '판이 틀림: 제 줄이 안 섬');
  assert.deepEqual(gens(s8), [], 'siru8 제 줄 날에 범용 권함이 섭니다');
  /* 시루 가방 줄(nudgeSiruBag)도 제 줄 */
  assert.deepEqual(gens(ctx('siru16', 2, { siruBag: 2 })), [], '가방 시루 줄 날에 범용 권함이 섭니다');
  /* varie_bright 걱정 칸 — 뿌리내리는 삽수가 방에 있으면 nudgeVarieWait(«뿌리낼 때까지 기다려») */
  const vb = ctx('varie_bright', 9, { varieRootingPlaced: 1 });
  assert.equal(row('nudgeVarieWait')(vb), true, '판이 틀림: nudgeVarieWait 안 섬');
  assert.deepEqual(gens(vb), [], '«뿌리낼 때까지 기다려» 날에 «막힌 데 있어?»가 섭니다');
  /* 칸이 다르면(물음 칸 4~6일 · 시루 줄 제 줄 없음) 범용 물음이 선다 */
  assert.deepEqual(gens(ctx('siru5_cycle5', 5, { siruBag: 0, siruIncoming: 3 })), ['nudgeAsk'], 'siru5 물음 칸에 범용 물음이 안 섭니다');
  /* 제 줄 조건이 거짓이면(무늬 삽수 없음 → nudgeVariePush 가 선다) — 그것도 제 줄 */
  const vb2 = ctx('varie_bright', 9, { varieRootingPlaced: 0, varieRootingBag: 0 });
  assert.equal(row('nudgeVariePush')(vb2), true, '판이 틀림: nudgeVariePush 안 섬');
  assert.deepEqual(gens(vb2), [], 'varie 미는 말 날에 범용 걱정이 섭니다');
});
check('㉱ 새 줄(fresh0)이 화면 칩을 쥔 날 범용 셋 쉼 · 제 줄은 섬', () => {
  assert.deepEqual(gens(ctx('home_unpack', 2, { nudgeFresh: true })), [], '새 줄 날에 범용 권함이 섭니다');
  assert.deepEqual(gens(ctx('home_unpack', 9, { nudgeFresh: true })), [], '새 줄 날에 범용 걱정이 섭니다');
  assert.equal(row('nudgeSiruOffer')(ctx('siru8', 2, { siruBag: 0, siruIncoming: 0, nudgeFresh: true })), true, '새 줄 날에 제 줄이 안 섭니다');
});
check('㉲ nudgeBack — 기다림 아닌 화면 칩이 있으면 안 섬 · 칩 없음 섬 · 옛 부름(칩 안 넘김) 예전 그대로', () => {
  const back = row('nudgeBack');
  assert.equal(back({ living: true, nudge: null, nudgeChip: 'water_siru' }), false, '칩(아침 열릴 줄)이 있는데 «급한 건 아니야»가 섭니다');
  assert.equal(back({ living: true, nudge: null, nudgeChip: null }), true, '칩 없는 날 안 섭니다');
  assert.equal(back({ living: true, nudge: null }), true, '옛 부름(nudgeChip undefined)에서 안 섭니다');
  assert.equal(back({ living: true, nudge: { id: 'shop_town', days: 3 }, nudgeChip: 'shop_town' }), false, '임자가 있는데 섭니다');
});
check('㉳ chatterContext 임자 = 넘긴 칩 줄 · 열린 날 모름 / 끝남 / 칩 안 넘김 = null', () => {
  const S = { stamina: { questsOpenedOn: { pp_hold_pink: 100, shop_town: 150 }, questsTaken: [], questsWaitedOn: {} }, tutorial: { movedOut: true, lamp: { owned: 0, placed: 0 } } };
  const chipOf = id => ({ chip: id, chipAny: id, fresh: null, screen: id, live: id });
  const c1 = chatterContext({ day: 160, nudgeChip: chipOf('shop_town') }, S);
  assert.deepEqual(c1.nudge, { id: 'shop_town', days: 10 }, `임자가 칩이 아닙니다: ${JSON.stringify(c1.nudge)}`);
  assert.equal(c1.nudgeChip, 'shop_town');
  assert.equal(c1.nudgeFresh, false);
  assert.equal(chatterContext({ day: 160 }, S).nudge, null, '칩을 안 넘겼는데 «가장 먼저 열린 줄»을 임자로 고릅니다');
  assert.equal(chatterContext({ day: 160 }, S).nudgeChip, undefined, '칩을 안 넘긴 부름의 nudgeChip 은 undefined');
  assert.equal(chatterContext({ day: 160, nudgeChip: chipOf('care_town') }, S).nudge, null, '열린 날을 모르는 칩 줄을 임자로 고릅니다');
  const done = { stamina: { ...S.stamina, questsTaken: ['shop_town'] } };
  assert.equal(chatterContext({ day: 160, nudgeChip: chipOf('shop_town') }, done).nudge, null, '끝난 줄을 임자로 고릅니다');
  assert.equal(chatterContext({ day: 160, nudgeChip: { chip: null, chipAny: 'shop_town', fresh: null, screen: 'shop_town', live: null } }, S).nudge, null, '기다림 칩을 임자로 고릅니다');
  const cf = chatterContext({ day: 160, nudgeChip: { chip: 'shop_town', chipAny: 'shop_town', fresh: 'sc_hang', screen: 'sc_hang', live: 'sc_hang' } }, S);
  assert.equal(cf.nudge && cf.nudge.id, 'shop_town', '새 줄이 있어도 임자는 qv.chip 줄');
  assert.equal(cf.nudgeFresh, true);
  assert.equal(cf.nudgeChip, 'sc_hang');
});
check('㉴ noteQuestWaits(chipId) — 칩이 아닌 열린 줄만 오늘로 적음 · opt 없으면 예전 그대로 · 날수는 칩에 선 날부터', () => {
  const mk = () => ({ stamina: { questsOpenedOn: { pp_hold_pink: 100, shop_town: 150, sc_hang: 155 }, questsTaken: ['sc_hang'], questsWaitedOn: {} }, tutorial: { movedOut: true, lamp: { owned: 0, placed: 0 } } });
  const S0 = mk(); W.noteQuestWaits(S0, 160);
  assert.deepEqual(S0.stamina.questsWaitedOn, {}, `opt 없는 부름이 칩 아닌 줄을 적습니다: ${JSON.stringify(S0.stamina.questsWaitedOn)}`);
  const S1 = mk(); W.noteQuestWaits(S1, 160, { chipId: 'shop_town' });
  assert.deepEqual(S1.stamina.questsWaitedOn, { pp_hold_pink: 160 }, `적힌 것: ${JSON.stringify(S1.stamina.questsWaitedOn)}`);
  assert.equal(W.nudgeDaysOf(S1, 'shop_town', 150, 160), 10, '칩 줄 날수가 끊깁니다');
  assert.equal(W.nudgeDaysOf(S1, 'pp_hold_pink', 100, 161), 0, '오늘 칩이 아니던 줄이 이튿날 칩이 되면 날수 0 이어야 합니다');
  const S2 = mk(); W.noteQuestWaits(S2, 160, { chipId: null });
  assert.deepEqual(S2.stamina.questsWaitedOn, { pp_hold_pink: 160, shop_town: 160 }, `칩 없음(null)에서 적힌 것: ${JSON.stringify(S2.stamina.questsWaitedOn)}`);
});
check('㉵ questChipAfterCheck — 그날 아침 끝날 줄(place_siru)은 빠지고 이어 열릴 줄(water_siru)이 칩 · 상태 안 바꿈', () => {
  assert.equal(typeof Q.questChipAfterCheck, 'function', 'quest.js §questChipAfterCheck 가 없습니다');
  const S = { day: 2, stamina: { questsOpenedOn: { place_siru: 1 }, questsTaken: [], questsClosed: [] }, _questOpen: ['place_siru'] };
  const snap = { day: 2, cropPots: [{ kind: 'beansprout', placed: true }] };
  const before = JSON.stringify(S);
  const v0 = Q.questView(S, snap);
  assert.equal(v0.chip && v0.chip.id, 'place_siru', '판이 틀림: 하루 대사 때 칩이 place_siru 가 아님');
  const r = Q.questChipAfterCheck(S, snap);
  assert.deepEqual({ chip: r.chip, chipAny: r.chipAny, screen: r.screen, live: r.live }, { chip: 'water_siru', chipAny: 'water_siru', screen: 'water_siru', live: 'water_siru' }, JSON.stringify(r));
  assert.equal(JSON.stringify(S), before, '미리 보기가 판을 바꿨습니다');
  /* 하루 대사: 칩(water_siru)은 아침에 열려 열린 날을 아직 모름 → 임자 없음 · nudgeBack 안 섬 */
  const c = chatterContext({ day: 2, nudgeChip: r }, { ...S, tutorial: { lamp: { owned: 0, placed: 0 } } });
  assert.equal(c.nudge, null, `아침 열릴 줄이 임자가 됐습니다: ${JSON.stringify(c.nudge)}`);
  assert.equal(c.nudgeChip, 'water_siru');
});
check('㉶ 하루 대사 — 쌓는 줄 칩(shop_town 30일)이면 범용 셋 0 · 손 줄 칩(home_unpack 2일)이면 권함', () => {
  const S = { day: 180, stamina: { questsOpenedOn: { pp_hold_pink: 100, shop_town: 150, home_unpack: 178 }, questsTaken: [], questsWaitedOn: {} },
              tutorial: { movedOut: true, lamp: { owned: 0, placed: 0 } }, home: { room: 'tworoom' }, story: { job: { id: 'shop' } } };
  const said = [];
  const st = createStoryteller();
  for (let d = 151; d <= 180; d++) said.push(...st.turn({ day: d, nudgeChip: { chip: 'shop_town', chipAny: 'shop_town', fresh: null, screen: 'shop_town', live: 'shop_town' } }, S));
  const g = said.filter(id => GEN.includes(id) || id === 'nudgeBack');
  assert.deepEqual(g, [], `쌓는 줄 칩 30일에 범용 줄: ${g.join(',')}`);
  const st2 = createStoryteller();
  const s2 = st2.turn({ day: 180, nudgeChip: { chip: 'home_unpack', chipAny: 'home_unpack', fresh: null, screen: 'home_unpack', live: 'home_unpack' } }, S);
  assert.ok(s2.includes('nudgeOffer'), `손 줄 칩 2일에 권함이 안 섭니다: ${JSON.stringify(s2)}`);
});

let fail = 0;
for (const [st, name, msg] of results) { if (st === 'FAIL') fail++; console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`); }
console.log(fail ? `\ntest_nudge_u2f: 빨강 ${fail}` : '\ntest_nudge_u2f: 다 통과');
process.exit(fail ? 1 : 0);
