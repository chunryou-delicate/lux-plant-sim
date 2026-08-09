/* ============================================================
   tools/test_stamina_xp.mjs — 경험치·레벨업 · 2026-08-09 신설
   ------------------------------------------------------------
     node tools/test_stamina_xp.mjs        (브라우저가 필요 없다)

   박사님 확정(2026-08-09):
     · 시작 최대체력 **5**
     · 물주기·수확·심기가 **시루마다 1**
     · **경험치 = 그날 쓴 체력의 총량** (한 행동 = 1)
     · 5→10 은 10·20·30·40·50 · 10→20 은 최대체력 × 10
     · 퀘스트 「시루 5개를 분배로 5주기 완주」 → +1

   ★★ **숫자를 이 파일에 안 박는다.** 곡선이 아직 최종이 아니라 후보를 재는 중이다
     (코디네이터). 정본은 `data/balance/stamina.json` 이고 여기서는 **그 표를 읽어** 검산한다 —
     표를 갈아 끼우면 이 검사도 같이 따라간다.

   ══ 무엇을 보나 ═══════════════════════════════════════════════════════════
     A  표에서 온다 — 코드에 박힌 값이 아니다
     B  경험치는 **쓴 만큼** 쌓인다 · 차면 그 자리에서 오른다
     C  ★ 레벨은 **안 내려간다** · 세이브를 왕복해도 그대로다
     D  ★ 옛 세이브(체력 칸이 없는 판)가 **던지지 않고** 열린다
     E  ★ 레벨업이 **화면에 넘어간다**(takeLevelUps) · 두 번 안 나온다
     F  ★★ 실측 — 시작 체력 · 시루 6개째에 못 하는 날 · 첫 레벨업이 며칠째
============================================================ */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newState, waterCrop, resowCrop, placeSiru } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, addCropPot, placeCrop,
         cropPotList } from '../src/game/first_play.js';
import { staminaOf, staminaView, staminaRulesFrom, xpNeededAt, gainXp,
         takeLevelUps, grantStaminaQuest, spend, resetDay, STAMINA_RULES }
  from '../src/game/stamina.js';
import { serialize, deserialize } from '../src/game/save.js';
import { createProfileLight } from '../src/game/room_profile.js';
/* ★ 몸스테라 생장 스텀 — `test_save` · `test_ending_flow` 와 **같은 하네스**를 쓴다.
   ⚠ 직접 지은 스텀을 썼다가 첫 수확의 몰스테라 선물에서 매번 던졌고,
     그 던짐을 **「체력이 모자란 날」로 잘못 세고** 있었다. 재는 것이 달라지므로
     같은 스텀을 써야 한다 — 이 검사가 재야 하는 것은 생장이 아니라 손이다. */
import { nullGrowth } from '../src/game/sim.js';

let pass = 0, fail = 0;
const ok = (n, c, v = '') => {
  if (c) { pass++; console.log(`  OK  ${n}` + (v ? `  → ${v}` : '')); }
  else { fail++; console.log(`  FAIL ${n}` + (v ? `  → ${v}` : '')); }
};
const J = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));

const BAL = J('../data/balance/stamina.json');
const R = staminaRulesFrom(BAL);
const FP = firstPlayRulesFromBalance(J('../data/balance/characters.json'));
const mk = () => newState({ mode: 'novice', room: 'banjiha', firstPlay: true,
                            firstPlayRules: FP, staminaRules: R });

console.log('\n══ A. 숫자가 표에서 온다 ═══════════════════════════════════════');
{
  const S = mk();
  const st = staminaOf(S);
  ok('A-1 시작 최대체력이 표의 값이다', st.max === R.startMax, `${st.max} (표 ${R.startMax})`);
  ok('A-2 규칙이 표에서 왔다고 말한다', R.source === 'data/balance/stamina.json', R.source);
  ok('A-3 표를 갈아 끼우면 규칙도 바뀐다 (코드에 안 박혔다)',
     staminaRulesFrom({ ...BAL, startMax: 99 }).startMax === 99);
  /* 곡선 — 표에 있는 칸은 표대로, 없는 칸은 `n × beyondMult` */
  for (const [k, v] of Object.entries(R.levelTable))
    ok(`A-4 ${k} → ${+k + 1} 에 드는 경험치가 표대로다`, xpNeededAt(+k, R) === v, `${xpNeededAt(+k, R)}`);
  ok('A-5 표 밖(10 이상)은 최대체력 × 배수다',
     [10, 11, 30, 78, 100].every(n => xpNeededAt(n, R) === n * R.beyondMult),
     [10, 11, 30, 78, 100].map(n => `${n}→${xpNeededAt(n, R)}`).join(' · '));
  /* ★★ 2026-08-09 — **상한이 없어졌다**(박사님: *"체력도 상한이 없이 계속 ×10 쓰면
     1씩 오른다 치고"*). 앞서 「최대 20」이라 두었던 것을 취소하셨다.
     ⚠ `maxCap: null` 이 **없다**는 뜻이다. 큰 수로 횡내 내면 화면이 「최대 999」를
       보여 주거나 진행바가 이상해진다 — 그걸 이 검사가 막는다. */
  ok('A-6 ★★ 상한이 **없다** — 큰 수로 흉내 내지도 않았다',
     R.maxCap === null, `maxCap = ${JSON.stringify(R.maxCap)}`);
  ok('A-7 그래서 아무리 높아도 「더 오를 데 없음」이 안 된다',
     [20, 100, 1000].every(n => xpNeededAt(n, R) != null),
     [20, 100, 1000].map(n => `${n}→${xpNeededAt(n, R)}`).join(' · '));
  /* 상한을 **넣으면** 그때부터 막는다 — 길은 열려 있다 */
  ok('A-8 나중에 상한을 넣으면 그때부터 막힌다 (길은 열려 있다)',
     xpNeededAt(20, staminaRulesFrom({ ...BAL, maxCap: 20 })) === null);
}

console.log('\n══ B. 경험치는 쓴 만큼 쌓이고, 차면 오른다 ═══════════════════════');
{
  const S = mk();
  placeBeansprout(S.firstPlay, 'banjiha-dresser:1');
  const st = staminaOf(S);
  const need = xpNeededAt(st.max, R);
  ok('B-1 처음엔 경험치가 0이다', st.xp === 0);
  waterCrop(S);
  ok('B-2 ★한 번 쓰면 1이 쌓인다 (경험치 = 쓴 체력)', st.xp === 1, `${st.xp}`);
  ok('B-3 그만큼 손이 줄었다', st.left === st.max - 1, `${st.left}/${st.max}`);

  /* 필요한 만큼 채워 본다 — 하루를 굴리지 않고 규칙만 본다 */
  const before = st.max;
  gainXp(S, need - st.xp);
  ok('B-4 ★차면 그 자리에서 최대체력이 오른다', st.max === before + 1, `${before} → ${st.max}`);
  ok('B-5 남는 경험치는 다음 칸으로 넘어간다 (안 버린다)', st.xp === 0, `${st.xp}`);
  ok('B-6 ★오른 그날 **남은 손도** 같이 는다 (보상이 하루 뒤로 안 밀린다)',
     st.left === before - 1 + 1, `${st.left}`);
  /* 한 번에 여러 칸도 오른다 */
  const m0 = st.max;
  gainXp(S, xpNeededAt(st.max, R) + xpNeededAt(st.max + 1, R));
  ok('B-7 한꺼번에 넣으면 여러 칸이 오른다', st.max === m0 + 2, `${m0} → ${st.max}`);
}

console.log('\n══ C. 레벨은 안 내려간다 · 세이브를 왕복한다 ═══════════════════');
{
  const S = mk();
  const st = staminaOf(S);
  gainXp(S, xpNeededAt(st.max, R));               // 한 칸 올린다
  const grown = st.max;
  ok('C-1 올랐다', grown === R.startMax + 1, `${R.startMax} → ${grown}`);
  st.left = 1;
  const raw = serialize(S);
  ok('C-2 세이브에 최대체력·경험치가 실린다',
     raw.state.stamina.max === grown && Number.isInteger(raw.state.stamina.xp),
     JSON.stringify(raw.state.stamina));
  const S2 = deserialize(raw, { firstPlayRules: FP, staminaRules: R,
                                slots: [], size: null, allowUnappliedFurniture: true });
  ok('C-3 ★불러와도 레벨이 그대로다 (시작값으로 안 내려간다)',
     staminaOf(S2).max === grown, `${staminaOf(S2).max}`);
  ok('C-4 남은 손도 그대로다', staminaOf(S2).left === 1, `${staminaOf(S2).left}`);
  /* 하루가 가면 **오른 최대치로** 가득 찬다 */
  resetDay(S2, 1);
  ok('C-5 하루가 가면 오른 최대치로 가득 찬다', staminaOf(S2).left === grown, `${staminaOf(S2).left}`);
}

console.log('\n══ D. 옛 세이브 — 체력 칸이 없어도 열린다 ═══════════════════════');
{
  const S = mk();
  const raw = serialize(S);
  /* ① 칸이 통째로 없는 옛 판 */
  delete raw.state.stamina;
  const A = deserialize(raw, { firstPlayRules: FP, staminaRules: R,
                               slots: [], size: null, allowUnappliedFurniture: true });
  ok('D-1 ★체력 칸이 아예 없어도 던지지 않는다', !!staminaOf(A));
  ok('D-2 그때는 시작값으로 가득 찬 채 열린다',
     staminaOf(A).max === R.startMax && staminaOf(A).left === R.startMax,
     `${staminaOf(A).left}/${staminaOf(A).max}`);
  ok('D-3 경험치는 0으로 시작한다 (지어내지 않는다)', staminaOf(A).xp === 0);

  /* ② `left` 만 있던 옛 모양(2026-08-05~08 판) */
  const raw2 = serialize(mk());
  raw2.state.stamina = { left: 3 };
  const B = deserialize(raw2, { firstPlayRules: FP, staminaRules: R,
                                slots: [], size: null, allowUnappliedFurniture: true });
  ok('D-4 ★`left` 만 있던 옛 세이브도 열린다', staminaOf(B).left === 3, `${staminaOf(B).left}`);
  ok('D-5 그때 최대체력은 지금 시작값이다', staminaOf(B).max === R.startMax, `${staminaOf(B).max}`);

  /* ③ 저장된 left 가 max 보다 큰 판(최대치를 낮춘 뒤 열 때) */
  const raw3 = serialize(mk());
  raw3.state.stamina = { left: 99, max: R.startMax, xp: 0, totalSpent: 0, questsTaken: [] };
  const C = deserialize(raw3, { firstPlayRules: FP, staminaRules: R,
                                slots: [], size: null, allowUnappliedFurniture: true });
  ok('D-6 남은 손이 최대치보다 크면 잘라 낸다', staminaOf(C).left === R.startMax, `${staminaOf(C).left}`);
}

console.log('\n══ E. 레벨업이 화면으로 넘어간다 ═══════════════════════════════');
{
  const S = mk();
  const st = staminaOf(S);
  gainXp(S, xpNeededAt(st.max, R));
  const ups = takeLevelUps(S);
  ok('E-1 ★오른 사실이 화면으로 넘어간다', ups.length === 1 && ups[0].max === st.max,
     JSON.stringify(ups));
  ok('E-2 ★두 번 안 나온다 (가져가며 비운다)', takeLevelUps(S).length === 0);
  /* 퀘스트 — 창구가 있고, 같은 것을 두 번 안 준다 */
  const before = st.max;
  const q1 = grantStaminaQuest(S, 'siru5_cycle5');
  ok('E-3 퀘스트로도 오른다', st.max === before + (R.quests.siru5_cycle5 || 0),
     `${before} → ${st.max} (+${q1.granted})`);
  const q2 = grantStaminaQuest(S, 'siru5_cycle5');
  ok('E-4 ★같은 퀘스트는 두 번 안 받는다', q2.already === true && st.max === before + 1, `${st.max}`);
  ok('E-5 퀘스트로 오른 것도 화면에 넘어간다',
     takeLevelUps(S).some(u => u.quest === 'siru5_cycle5'));
  /* ★ 상한이 없으므로 많이 넣으면 **계속** 오른다 */
  const m1 = st.max, xp1 = xpNeededAt(m1, R) + xpNeededAt(m1 + 1, R) + xpNeededAt(m1 + 2, R);
  st.xp = 0; gainXp(S, xp1);
  ok('E-6 ★상한이 없으므로 계속 오른다', st.max === m1 + 3, `${m1} → ${st.max}`);
  /* 상한을 넣은 판에서는 거기서 선다 — 그 길이 살아 있는지까지 본다 */
  const Rcap = staminaRulesFrom({ ...BAL, maxCap: m1 + 4 });
  const S2 = newState({ mode: 'novice', room: 'banjiha', firstPlay: true,
                        firstPlayRules: FP, staminaRules: Rcap });
  const st2 = staminaOf(S2); st2.max = m1 + 4; st2.xp = 0;
  gainXp(S2, 999999);
  ok('E-7 상한을 넣은 판에서는 거기서 선다', st2.max === m1 + 4, `${st2.max}`);
}

console.log('\n══ F. 실측 — 판을 굴려서 잰다 ═══════════════════════════════════');
/* ★ 진짜 하루 루프(`nextDay`)로 굴린다. 규칙 함수만 부르면 「화면이 그 규칙을 부르는가」를
   못 재고, 무엇보다 **하루가 실제로 몇 손을 요구하는지**가 안 나온다.
   ⚠ 조도는 정적 프로파일로 돈다(브라우저가 없다). 시루는 **추천 자리**에만 놓는다 —
     자유 좌표는 그 표에 없어 계약이 던진다(room_profile 머리말). */
function playDays(siruCount, days) {
  const prof = J('../data/profiles/room_profile.banjiha.json');
  const light = createProfileLight(prof, { lightTh: J('../data/balance/light_thresholds.json') });
  const GROWTH_MIN = J('../data/balance/light_thresholds.json').plants.monstera_deliciosa.min;
  const io = { light, growth: nullGrowth(14, { growthMin: GROWTH_MIN }) };
  const S = mk();
  const slots = (light.room && light.room.slots) || [];
  const dark = slots.filter(s => Number.isFinite(s.maxPotD) && s.maxPotD >= 0.24)
                    .map(s => s.slotId);
  if (!dark.length) return null;
  /* 시루를 원하는 수만큼 만들고 **서로 다른 자리**에 놓는다(각개) */
  placeCrop(S.firstPlay, 'beansprout', dark[0], { slots, potId: S.firstPlay.beansprout.pots[0].id });
  for (let i = 1; i < siruCount; i++) {
    const p = addCropPot(S.firstPlay, 'beansprout', { day: 0 });
    placeCrop(S.firstPlay, 'beansprout', dark[i % dark.length], { slots, potId: p.id });
  }
  S.shop = S.shop || {}; S.shop.stock = { ...(S.shop.stock || {}), bean_seed: 999, siru: 0 };
  /* ⚠⚠ **하네스 우회 하나 — 이유를 적어 둔다.**
     세 번째 수확에 몸스테라 선물이 오는데(first_play §MONSTERA_ARRIVAL_RULE),
     그걸 받으려면 `growthPhase()` 를 내는 **진짜 생장 창**이 있어야 한다.
     없으면 수확이 던지고, 그 던짐을 이 검사가 「체력이 모자란 날」로
     **잘못 세고 있었다**(실제로 그러면서 시루 1개에 「못 한 날 35일」이 나왔다).
     ★ 여기서 재려는 것은 **손**이지 선물이 아니다. 그래서 선물을 꺼 둔다 —
       도착 자체는 `test_first_play` · `test_ending_flow` 가 이미 지키고 있다. */
  S.firstPlay.monstera.arrived = true;

  let firstLevelDay = null, blockedDays = 0, totalActs = 0, lastErr = null, dayErr = null;
  for (let d = 1; d <= days; d++) {
    let blockedToday = false;
    /* ① 익은 것을 거둔다 — **하나씩** (화면이 그렇게 부른다) */
    for (;;) {
      let ripe = null;
      try { ripe = (cropPotList(S.firstPlay, S.day) || []).find(x => x.ready); } catch { }
      if (!ripe) break;
      try { harvestCrop(S, io, { potIds: [ripe.id] }); totalActs++; }
      catch (e) { blockedToday = true; lastErr = 'H:' + e.message; break; }
    }
    /* ② 거둔 시루를 다시 심는다 — 하나씩 */
    for (;;) {
      let done = null;
      try { done = (cropPotList(S.firstPlay, S.day) || []).find(x => x.harvested); } catch { }
      if (!done) break;
      try { resowCrop(S, { potIds: [done.id] }); totalActs++; }
      catch (e) { blockedToday = true; lastErr = 'S:' + e.message; break; }
    }
    /* ③ 물을 준다 — 하나씩 */
    for (;;) {
      let idle = null;
      try { idle = (cropPotList(S.firstPlay, S.day) || []).find(x => x.needsWater); } catch { }
      if (!idle) break;
      try { const r = waterCrop(S, { potIds: [idle.id] }); if (!r.watered) break; totalActs++; }
      catch (e) { blockedToday = true; lastErr = e.message; break; }
    }
    if (blockedToday) blockedDays++;
    if (firstLevelDay == null && staminaOf(S).max > R.startMax) firstLevelDay = S.day;
    try { nextDay(S, io); } catch (e) { dayErr = e.message; break; }
  }
  const st = staminaOf(S);
  return { firstLevelDay, blockedDays, totalActs, max: st.max, xp: st.xp, days: S.day,
           lastErr, dayErr };
}

const runs = [];
for (const n of [1, 2, 5, 6]) {
  let r = null;
  try { r = playDays(n, 50); } catch (e) { console.log(`  (시루 ${n}개 재기 실패: ${e.message})`); }
  if (r) { runs.push({ n, ...r }); console.log(
    `      시루 ${String(n).padStart(2)}개 · 50일 — 손질 ${String(r.totalActs).padStart(3)}번 · ` +
    `못 한 날 ${r.blockedDays}일 · 첫 레벨업 ${r.firstLevelDay ?? '없음'}일째 · 끝 체력 ${r.max} · 굴린 날 ${r.days}` +
    (r.dayErr ? ` · 하루가 터짐: ${r.dayErr}` : '') +
    (r.lastErr ? ` · 막힌 사유: ${r.lastErr}` : '')); }
}
ok('F-1 ★시작 최대체력이 5다', R.startMax === 5, `${R.startMax}`);
const r1 = runs.find(x => x.n === 1), r6 = runs.find(x => x.n === 6);
ok('F-2 시루가 하나면 하루가 안 막힌다 (첫 시루는 반드시 굴러간다)',
   !!r1 && r1.blockedDays === 0, r1 ? `못 한 날 ${r1.blockedDays}일` : '못 잼');
ok('F-3 ★시루를 늘리면 **못 하는 날이 생긴다** (체력이 상한 노릇을 한다)',
   !!r6 && r6.blockedDays > 0, r6 ? `시루 6개 · 못 한 날 ${r6.blockedDays}일/50일` : '못 잼');
ok('F-4 ★돌보면 레벨이 오른다 (첫 레벨업이 온다)',
   runs.every(x => x.firstLevelDay != null),
   runs.map(x => `${x.n}개→${x.firstLevelDay}일`).join(' · '));
ok('F-5 시루가 많을수록 레벨업이 빠르다 (많이 돌보면 빨리 는다)',
   !!r1 && !!r6 && r6.firstLevelDay <= r1.firstLevelDay,
   r1 && r6 ? `1개 ${r1.firstLevelDay}일 vs 6개 ${r6.firstLevelDay}일` : '못 잼');

console.log(`\n${pass + fail}개 중 ${pass}개 통과` + (fail ? ` · ${fail}개 실패` : ' — 전부 통과'));
if (fail) process.exit(1);
