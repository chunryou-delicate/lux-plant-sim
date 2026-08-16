/* ══════════════════════════════════════════════════════════════════════════
   tools/probe_questchain.mjs — **초반 퀘스트 사슬을 잰다** (2026-08-16 신설)

     node tools/probe_questchain.mjs

   ★★ 왜 `test_quest.mjs` 와 따로 있나 — **재는 것이 다르다.**
     `test_quest` 는 스냅샷을 **손으로 적어** 판정을 잰다. 손으로 적은 스냅샷은
     「내가 그럴 것이라 믿는 판」이지 「실제로 나는 판」이 아니다.
     여기는 **`src/game/first_play.js` 를 실제로 굴려서** 그 fp 로 스냅샷을 짓는다.
     ⇒ 그래서 이 재는 자가 답하는 것은 *"판정이 맞나"* 가 아니라
       **"첫 플레이를 실제로 밟으면 사슬이 정말 도는가"** 다.

   ⚠⚠ **무엇을 켜고 무엇을 껐는지** (START-HERE §2 첫째 규칙)
     켠 것 : `first_play.js` 전부 — 놓기·물·자라기·수확·다시 심기·시루 늘리기·
             몬스테라 도착/옮기기. 규칙은 `data/balance/characters.json` 실물.
     끈 것 : ⓐ **조도 엔진** — 자리마다 DLI 를 재는 대신 값을 직접 먹인다(아래 DLI).
             ⓑ **생장 엔진(모주 잎)** — `growth` 는 이 파일이 안 부른다.
                모주 잎 수는 **손으로 넣는다**. 그래서 ⑦⑧(잎 2·3장)은
                *"잎이 그만큼 나면 열리고 끝나는가"* 만 재고 *"며칠에 나는가"* 는 **안 잰다.**
             ⓒ **화면** — `game.html` 은 안 띄운다. 배선이 살아 있는지는
                `tools/test_questui.mjs` 것이다.
     ⇒ 그러니 이 파일의 「걸음」은 **달력 날짜가 아니다.** 날짜를 알고 싶으면
       `test_banjiha_routes` 를 봐라 — 이 저장소에는 시계가 둘이다(START-HERE §2.9 ⑤).

   재는 것 여섯:
     A 첫날에 열린 줄이 **몇 개인가** (0 이면 실패다 — 그것이 고치려던 구멍이다)
     B 실제 코어를 밟으며 **한 번에 하나씩만** 열리는가
     C 사슬이 **안 끊기는가** (여덟 줄이 다 열리고 다 끝나는가)
     D ★ **배선이 하나도 안 붙어도** 사슬이 끝까지 가는가 (§안전 폴백)
     E 회귀 — **본 줄기 여덟이 예전과 같은 걸음에** 열리는가
     F 「지금 하나 + 다음 몇 줄」 계약이 서는가 · `todo` 가 28자 이하인가
   ══════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from 'node:fs';
import {
  createFirstPlayState, firstPlayRulesFromBalance,
  placeCrop, waterBeansprout, advanceBeansproutDay, harvestBeansprout,
  resowBeansprout, addCropPot, markMonsteraArrived, moveMonstera,
  cropSites, cropPotPlaced, cropPotSown
} from '../src/game/first_play.js';
import { STAMINA_RULES, createStaminaState, grantStaminaQuest } from '../src/game/stamina.js';
import { QUESTS, QUEST_IDS, FIRST_PLAY_CHAIN_IDS, questView, stepQuests,
         questTodo, emptySnapshot, QUEST_PREVIEW } from '../src/game/quest.js';

let bad = 0, seen = 0;
const ok = (name, cond, got) => {
  seen++;
  console.log(`${cond ? '  OK' : 'FAIL'}  ${name}${got == null || got === '' ? '' : '  → ' + got}`);
  if (!cond) bad++;
};
const note = m => console.log('      ' + m);

const RULES = firstPlayRulesFromBalance(JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8')));

/* 콩나물은 어두울수록 좋다 — 반지하 서랍장 언저리 값을 그대로 먹인다.
   ⚠ 이 값은 **품질**만 정한다. 사슬 판정에는 안 들어간다(회전이 도는지만 본다). */
const DLI = 0.2;
const SLOT = 'banjiha-dresser:1';
const board = () => ({ stamina: createStaminaState(STAMINA_RULES) });

/* ══════════════════════════════════════════════════════════════════════════
   ★★★ 스냅샷을 **fp 에서 짓는다** — 이것이 `game.html §questSnapshotNow` 가
   해야 하는 일 그대로다. 여기 적힌 식이 곧 배선 계약이다(인계 §화면이 붙일 것).
   ⚠ 모주 잎만은 fp 가 안 갖는다(growth 소유) — 밖에서 받는다.
   ══════════════════════════════════════════════════════════════════════════ */
function snapOfFp(fp, opt = {}) {
  const pots = cropSites(fp).flatMap(site =>
    ((site && site.pots) || []).map(p => ({
      kind: site.kind || 'beansprout',
      harvestCount: (p && p.harvestCount) || 0,
      /* ★ 새 칸 둘 — 정본은 `first_play.js` 의 이 두 함수/칸이다 */
      placed: cropPotPlaced(p),
      watered: !!(p && p.startedOnDay != null),
      /* (지금 사슬은 안 보지만 배선을 붙일 때 같이 넣기 좋다) */
      sown: cropPotSown(p)
    })));
  const m = fp.monstera || {};
  return {
    ...emptySnapshot(),
    day: opt.day ?? null,
    firstPlayDone: !!fp.completed,
    cropHarvestTotal: pots.reduce((a, p) => a + p.harvestCount, 0),
    cropPots: pots,
    /* ★ 새 칸 둘 — 정본은 `fp.monstera.arrived` 와 `fp.monstera.guide.moved` 다 */
    monsteraArrived: !!m.arrived,
    monsteraHomed: !!(m.guide && m.guide.moved),
    motherLeaves: opt.leaves ?? 0
  };
}

/* 한 걸음 = 스냅샷 하나. 화면이 하는 것과 똑같이 판정 → 보상 순서로 돈다 */
function makeWalker(B) {
  const log = [];
  return {
    log,
    step(label, snap) {
      const r = stepQuests(B, snap);
      for (const id of r.finished) grantStaminaQuest(B, id);
      log.push({ n: log.length + 1, label, opened: r.opened, finished: r.finished, snap });
      return r;
    }
  };
}

/* ══ A·B·C. 실제 코어를 밟는다 ════════════════════════════════════════════ */
console.log('\n══ A·B·C. ★★★ 첫 플레이를 실제로 밟는다 (first_play.js 를 굴린다) ══');
const B1 = board();
const W = makeWalker(B1);
{
  const fp = createFirstPlayState({ enabled: true, rules: RULES });
  let day = 0, leaves = 0;
  const shot = (label) => W.step(label, snapOfFp(fp, { day, leaves }));

  /* ① 켠 그 순간 — 아직 아무것도 안 했다 */
  shot('켠 순간 — 가방에 시루 하나');
  const first = W.log[0];
  ok('A-1 ★★★ **첫날에 열린 줄이 있다** (예전엔 0 이었다 — 그것이 이 계통이 생긴 까닭이다)',
     first.opened.length >= 1, `열린 줄 ${first.opened.length}개: ${first.opened}`);
  ok('A-2 ★★ 그리고 **딱 하나**다 (여럿이면 첫날부터 심부름 목록이 된다)',
     first.opened.length === 1, `${first.opened}`);
  ok('A-3 ★ 그 하나가 **사슬의 첫째**다', first.opened[0] === FIRST_PLAY_CHAIN_IDS[0],
     `${first.opened[0]} vs ${FIRST_PLAY_CHAIN_IDS[0]}`);
  note(`첫날 할 일 — 「${questTodo(first.opened[0])}」`);

  /* ② 방에 놓는다 */
  placeCrop(fp, 'beansprout', SLOT);
  shot('시루를 방에 놓았다');

  /* ③ 하루가 가도 물을 안 주면 안 자란다 — 그 하루를 실제로 굴려 본다 */
  day++; advanceBeansproutDay(fp, DLI);
  shot('하루가 갔다 (물은 안 줬다 — 안 자란다)');

  /* ④ 물을 준다 = 회전 시작 */
  waterBeansprout(fp, day);
  shot('물을 줬다 (이 날이 0일차)');

  /* ⑤ 자라는 동안 — 다 자랄 때까지 */
  for (let i = 0; i < RULES.harvestDays; i++) { day++; advanceBeansproutDay(fp, DLI); }
  shot('다 자랐다 (아직 안 거뒀다)');

  /* ⑥ 거둔다 — 이 순간 몬스테라 문이 열린다 */
  harvestBeansprout(fp);
  shot('첫 수확');

  /* ⑦ 몬스테라가 온다 (게임에서는 loop 가 부른다) */
  markMonsteraArrived(fp, 'banjiha-desk:0');
  leaves = 1;
  shot('몬스테라 도착 (책상 · 잎 1장)');

  /* ⑧ 씨앗을 사서 다시 심는다 → 두 바퀴째 */
  resowBeansprout(fp, { day });
  waterBeansprout(fp, day);
  for (let i = 0; i < RULES.harvestDays; i++) { day++; advanceBeansproutDay(fp, DLI); }
  harvestBeansprout(fp);
  shot('다시 심어 두 바퀴째를 거뒀다');

  /* ⑨ 시루를 하나 더 들여 방에 놓는다 */
  const p2 = addCropPot(fp, 'beansprout', { day, sown: false });
  placeCrop(fp, 'beansprout', SLOT, { potId: p2.id });
  shot('시루를 하나 더 놓았다');

  /* ⑩ 몬스테라를 밝은 자리로 옮긴다 */
  moveMonstera(fp, 'banjiha-sill:0');
  shot('몬스테라를 창턱으로 옮겼다');

  /* ⑪⑫ 잎이 둘 · 셋이 된다 (⚠ 생장 엔진은 꺼져 있다 — 손으로 넣는다) */
  leaves = 2; day += 20; shot('잎이 둘이 됐다');
  leaves = 3; day += 20; shot('잎이 셋이 됐다');
  /* 사슬의 마지막 줄이 끝나는 걸음을 한 번 더 준다(한 박자 뒤에 열리는 줄이 있다) */
  shot('그대로 하루 더');

  console.log('');
  console.log('  걸음   열린 것                 끝난 것');
  for (const e of W.log)
    console.log(`  ${String(e.n).padStart(2)}  ${(e.opened.join(',') || '—').padEnd(22)} ` +
                `${(e.finished.join(',') || '—').padEnd(22)} ${e.label}`);
  console.log('');

  /* ── B. 한 번에 하나씩 ─────────────────────────────────────────────── */
  const many = W.log.filter(e => e.opened.filter(id => FIRST_PLAY_CHAIN_IDS.includes(id)).length > 1);
  ok('B-1 ★★★ 사슬은 **한 걸음에 한 줄만** 새로 열린다', many.length === 0,
     many.map(e => `${e.n}걸음 ${e.opened}`).join(' · '));

  /* ── C. 사슬이 안 끊긴다 ───────────────────────────────────────────── */
  const opened = W.log.flatMap(e => e.opened);
  const finished = W.log.flatMap(e => e.finished);
  const notOpened = FIRST_PLAY_CHAIN_IDS.filter(id => !opened.includes(id));
  const notDone = FIRST_PLAY_CHAIN_IDS.filter(id => !finished.includes(id));
  ok('C-1 ★★★ 여덟 줄이 **전부 열린다** (한 줄이라도 안 열리면 없는 것과 같다)',
     notOpened.length === 0, notOpened.join(' · '));
  ok('C-2 ★★★ 여덟 줄이 **전부 끝난다** (사슬이 안 막힌다)',
     notDone.length === 0, notDone.join(' · '));
  ok('C-3 ★ 여는 차례가 **표의 차례**와 같다',
     JSON.stringify(opened.filter(id => FIRST_PLAY_CHAIN_IDS.includes(id))) ===
     JSON.stringify(FIRST_PLAY_CHAIN_IDS),
     opened.filter(id => FIRST_PLAY_CHAIN_IDS.includes(id)).join(' → '));
  /* ★ 빈 걸음 — 「열린 것도 끝난 것도 없는」 걸음이 몇이나 이어지나.
     박사님이 잡으신 것이 그 구간이라 **세어서 적는다.** */
  let run = 0, worst = 0;
  for (const e of W.log) { run = (e.opened.length || e.finished.length) ? 0 : run + 1; worst = Math.max(worst, run); }
  note(`사슬이 도는 동안 아무 일도 안 난 걸음 — 최장 ${worst}걸음 / 전체 ${W.log.length}걸음`);
}

/* ══ D. ★ 배선이 하나도 안 붙어도 사슬이 도는가 (§안전 폴백) ═══════════════ */
console.log('\n══ D. ★★ **화면 배선이 하나도 없는 판** — 사슬이 끝까지 가는가 ══');
{
  /* 새 칸 넷(`placed`·`watered`·`monsteraArrived`·`monsteraHomed`)을 **하나도 안 채운다.**
     `game.html` 이 아직 안 고쳐진 그 상태가 정확히 이것이다.
     ⇒ 그래도 사슬이 돌아야 한다. 안 돌면 배선이 붙기 전까지 열여섯 줄이 통째로 잠긴다. */
  const B2 = board(), W2 = makeWalker(B2);
  const S0 = emptySnapshot();
  const naive = [
    { ...S0, day: 1, cropPots: [{ kind: 'beansprout', harvestCount: 0 }] },
    { ...S0, day: 2, cropPots: [{ kind: 'beansprout', harvestCount: 0 }] },
    { ...S0, day: 7, cropHarvestTotal: 1, cropPots: [{ kind: 'beansprout', harvestCount: 1 }] },
    { ...S0, day: 8, cropHarvestTotal: 1, cropPots: [{ kind: 'beansprout', harvestCount: 1 }] },
    { ...S0, day: 9, cropHarvestTotal: 1, cropPots: [{ kind: 'beansprout', harvestCount: 1 }] },
    { ...S0, day: 13, cropHarvestTotal: 2, cropPots: [{ kind: 'beansprout', harvestCount: 2 }] },
    { ...S0, day: 15, cropHarvestTotal: 2, motherLeaves: 1,
      cropPots: [{ kind: 'beansprout', harvestCount: 2 }, { kind: 'beansprout', harvestCount: 0 }] },
    { ...S0, day: 16, cropHarvestTotal: 2, motherLeaves: 1,
      cropPots: [{ kind: 'beansprout', harvestCount: 2 }, { kind: 'beansprout', harvestCount: 0 }] },
    { ...S0, day: 30, cropHarvestTotal: 2, motherLeaves: 2,
      cropPots: [{ kind: 'beansprout', harvestCount: 2 }, { kind: 'beansprout', harvestCount: 0 }] },
    { ...S0, day: 31, cropHarvestTotal: 2, motherLeaves: 2,
      cropPots: [{ kind: 'beansprout', harvestCount: 2 }, { kind: 'beansprout', harvestCount: 0 }] },
    { ...S0, day: 40, cropHarvestTotal: 2, motherLeaves: 3,
      cropPots: [{ kind: 'beansprout', harvestCount: 2 }, { kind: 'beansprout', harvestCount: 0 }] },
    { ...S0, day: 41, cropHarvestTotal: 2, motherLeaves: 3,
      cropPots: [{ kind: 'beansprout', harvestCount: 2 }, { kind: 'beansprout', harvestCount: 0 }] }
  ];
  naive.forEach((s, i) => W2.step(`배선 없음 ${i + 1}`, s));
  const done2 = W2.log.flatMap(e => e.finished);
  const left = FIRST_PLAY_CHAIN_IDS.filter(id => !done2.includes(id));
  ok('D-1 ★★★ 새 칸을 **하나도 안 채워도** 여덟 줄이 다 끝난다 (사슬이 안 막힌다)',
     left.length === 0, left.length ? `막힌 줄: ${left.join(' · ')}` : '여덟 줄 전부');
  note('⇒ `game.html` 배선을 나중에 붙여도 사슬은 이미 돈다. 붙이면 **더 일찍** 끝날 뿐이다.');
}

/* ══ E. 회귀 — 본 줄기 여덟이 예전과 같은 걸음에 열리는가 ═══════════════════ */
console.log('\n══ E. ★★ 회귀 — 본 줄기 여덟은 예전 그대로인가 ═══════════════════');
{
  /* ⚠⚠ 아래 아홉 걸음은 **2026-08-16 이전의 `tools/test_quest.mjs` 가 쓰던 것 그대로**다.
     한 글자도 안 고쳤다 — 고치면 「전·후 비교」가 아니라 다른 것을 재게 된다.
     ★ 그때 실측한 여는 걸음: 2 · 4 · 6 · 7 · 7 · 7 · 8 · 9 (그 판의 출력에서 받아 적었다). */
  const OLD = { crop_mix: 2, siru5_cycle5: 4, siru8: 6, siru16: 7,
                first_cut: 7, buy_lamp: 7, varie_bright: 8, sell_varie: 9 };
  const S0 = emptySnapshot();
  const oldSteps = [
    { ...S0, day: 10, cropHarvestTotal: 1, cropPots: [{ kind: 'beansprout', harvestCount: 1 }] },
    { ...S0, day: 33, firstPlayDone: true, cropHarvestTotal: 5,
      cropPots: [{ kind: 'beansprout', harvestCount: 5 }] },
    { ...S0, day: 46, firstPlayDone: true, mealKinds: ['beansprout', 'musun'],
      cropPots: [{ kind: 'beansprout', harvestCount: 6 }, { kind: 'musun', harvestCount: 1 }] },
    { ...S0, day: 60, firstPlayDone: true, motherLeaves: 1,
      cropPots: Array.from({ length: 5 }, () => ({ kind: 'beansprout', harvestCount: 4 })) },
    { ...S0, day: 64, firstPlayDone: true,
      cropPots: Array.from({ length: 8 }, () => ({ kind: 'beansprout', harvestCount: 5 })) },
    { ...S0, day: 66, firstPlayDone: true,
      cropPots: Array.from({ length: 16 }, () => ({ kind: 'beansprout', harvestCount: 5 })) },
    { ...S0, day: 70, firstPlayDone: true, motherLeaves: 2, lampUnlocked: true,
      cropPots: Array.from({ length: 16 }, () => ({ kind: 'beansprout', harvestCount: 5 })) },
    { ...S0, day: 84, firstPlayDone: true, motherLeaves: 3, motherVarieLeaves: 1,
      lampUnlocked: true, lampOwned: 1,
      cuttings: [{ method: 'water', status: 'rooted', varieFromCut: false, varieLightBand: 'mid' }] },
    { ...S0, day: 90, firstPlayDone: true, motherLeaves: 3, motherVarieLeaves: 2,
      lampUnlocked: true, lampOwned: 1,
      cuttings: [{ method: 'water', status: 'rooting', varieFromCut: true, varieLightBand: null }] }
  ];
  /* ★ 초반 사슬을 **미리 끝난 것으로** 세운다 — 그래야 옛 판과 같은 조건이 된다.
     (옛 판에는 사슬이 아예 없었으므로 「이미 다 끝난 판」이 그것과 같다) */
  const B3 = board();
  B3.stamina.questsTaken = [...FIRST_PLAY_CHAIN_IDS];
  const W3 = makeWalker(B3);
  oldSteps.forEach((s, i) => W3.step(`옛 걸음 ${i + 1}`, s));
  const at = {};
  for (const e of W3.log) for (const id of e.opened) if (at[id] == null) at[id] = e.n;
  let same = 0;
  for (const [id, want] of Object.entries(OLD)) {
    const got = at[id];
    if (got === want) same++;
    else ok(`E-x '${id}' 가 예전과 다른 걸음에 열렸다`, false, `예전 ${want} → 지금 ${got}`);
  }
  ok(`E-1 ★★★ 본 줄기 여덟이 **예전과 똑같은 걸음**에 열린다 (회귀 없음)`,
     same === Object.keys(OLD).length, `${same}/${Object.keys(OLD).length} 일치`);
  note(`여는 걸음 — ${Object.entries(OLD).map(([id, n]) => `${id} ${at[id]}(옛 ${n})`).join(' · ')}`);
}

/* ══ F. 화면 계약 ═════════════════════════════════════════════════════════ */
console.log('\n══ F. 화면 계약 — 「지금 하나 + 다음 몇 줄」 · 문구 길이 ═══════════');
{
  const TODO_MAX = 28;   /* `docs/player_guide.md §0` 실측 — 폰 360px 한 줄이 26자 */
  const over = QUESTS.map(q => [q.id, questTodo(q)])
                     .filter(([, t]) => !t || t.length > TODO_MAX);
  ok(`F-1 「지금 할 일」 ${QUESTS.length}줄이 전부 ${TODO_MAX}자 이하`, over.length === 0,
     over.map(([id, t]) => `${id} ${t && t.length}자`).join(' · '));

  const B4 = board();
  const v = questView(B4, emptySnapshot());
  ok('F-2 ★★ 「지금 하나」가 있다', !!(v.current && v.current.todo), v.current && v.current.todo);
  ok('F-3 ★★ 「다음에 올 것」이 잠긴 채로 따라온다',
     v.upcoming.length >= QUEST_PREVIEW &&
     v.upcoming.slice(0, QUEST_PREVIEW).every(a => a.state === 'locked'),
     v.upcoming.slice(0, QUEST_PREVIEW).map(a => `${a.ko}(${a.state})`).join(' · '));
  ok('F-4 ★ 마디를 말한다', v.stage === 'first_play' && v.chain && v.chain.total === 8,
     `${v.stage} ${v.chain && v.chain.index}/${v.chain && v.chain.total}`);
  ok('F-5 ★ 셈이 맞는다 (total = done + open + locked)',
     v.counts.done + v.counts.open + v.counts.locked === v.counts.total &&
     v.counts.total === QUEST_IDS.length, JSON.stringify(v.counts));
  /* ★ 화면이 그릴 그림을 그대로 찍어 둔다 — 배선하는 창이 이걸 보고 만든다 */
  console.log('');
  console.log(`  ─ 켠 첫 순간의 할 일 창 (${v.counts.done}/${v.counts.total}) ─`);
  console.log(`   ▶ ${v.current.ko} — ${v.current.todo}`);
  console.log(`      왜: ${v.current.why}`);
  console.log(`      상: ${v.current.reward}`);
  for (const a of v.upcoming.slice(0, QUEST_PREVIEW)) console.log(`   🔒 ${a.ko}`);
  console.log(`   … 그리고 ${Math.max(0, v.upcoming.length - QUEST_PREVIEW)}줄 더`);
}

console.log(`\n${bad ? '⛔' : '★'} ${seen - bad}/${seen} 통과`);
process.exit(bad ? 1 : 0);
