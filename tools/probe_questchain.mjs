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
import { QUESTS, QUEST_IDS, FIRST_PLAY_CHAIN_IDS, SLOW_QUEST_IDS, questView, stepQuests,
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

  /* ⑦ 아직 몬스테라는 안 온다 — 문턱은 **총 3회전**이다
     (`first_play.MONSTERA_ARRIVAL_RULE.harvestCount = 3`).
     ⚠ 2026-08-17 정정 — 예전에는 여기서 바로 `markMonsteraArrived` 를 불렀다. 그건 실제
       문턱보다 두 회전 이른 것이었고, `crop_mix` 가 도착을 보게 된 지금은 그 틀림이
       **첫 플레이 중반에 본 줄기가 열리는** 모양으로 드러난다. 실제 자리로 옮겼다. */
  shot('아직 한 바퀴 — 몬스테라는 세 바퀴째에 온다');

  /* ⑧ 씨앗을 사서 다시 심는다 → 두 바퀴째. ★ 여기서 갖고 있던 씨앗 한 봉지가 다 나간다 */
  resowBeansprout(fp, { day });
  waterBeansprout(fp, day);
  for (let i = 0; i < RULES.harvestDays; i++) { day++; advanceBeansproutDay(fp, DLI); }
  harvestBeansprout(fp);
  shot('다시 심어 두 바퀴째를 거뒀다');

  /* ⑧-b ★ 2026-08-17 신설 — **주문한 씨앗이 와서 세 바퀴째**.
     `order_seed` 가 여기서 끝나고, 총 3회전이라 **몬스테라도 이때 온다** */
  resowBeansprout(fp, { day });
  waterBeansprout(fp, day);
  for (let i = 0; i < RULES.harvestDays; i++) { day++; advanceBeansproutDay(fp, DLI); }
  harvestBeansprout(fp);
  markMonsteraArrived(fp, 'banjiha-desk:0');
  leaves = 1;
  shot('주문한 씨앗으로 세 바퀴째 — 몬스테라 도착 (책상 · 잎 1장)');

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

  /* ── C. 사슬이 안 끊긴다 ─────────────────────────────────────────────
     ⚠ 2026-08-17 — **재는 대상을 넓혔다.** 초반 사슬이 일곱 + 느린 둘로 갈리면서
       `FIRST_PLAY_CHAIN_IDS` 만 재면 **잎 두 줄이 아무에게도 안 재어진 채로 남는다.**
       (START-HERE §2.9-⑥ — *"손짓이 바뀌면 자도 같이 고쳐라"* 의 그 모양이다.)
       ⇒ C-1·C-2 는 **아홉 줄 전부**를 보고, C-3(차례)만 사슬로 걸린 일곱을 본다. */
  const opened = W.log.flatMap(e => e.opened);
  const finished = W.log.flatMap(e => e.finished);
  const EARLY = [...FIRST_PLAY_CHAIN_IDS, ...SLOW_QUEST_IDS];
  const notOpened = EARLY.filter(id => !opened.includes(id));
  const notDone = EARLY.filter(id => !finished.includes(id));
  ok(`C-1 ★★★ ${EARLY.length}줄이 **전부 열린다** (한 줄이라도 안 열리면 없는 것과 같다)`,
     notOpened.length === 0, notOpened.join(' · '));
  ok(`C-2 ★★★ ${EARLY.length}줄이 **전부 끝난다** (사슬이 안 막힌다)`,
     notDone.length === 0, notDone.join(' · '));
  ok('C-3 ★ 사슬로 걸린 줄의 여는 차례가 **표의 차례**와 같다',
     JSON.stringify(opened.filter(id => FIRST_PLAY_CHAIN_IDS.includes(id))) ===
     JSON.stringify(FIRST_PLAY_CHAIN_IDS),
     opened.filter(id => FIRST_PLAY_CHAIN_IDS.includes(id)).join(' → '));
  /* ★ 빈 걸음 — 「열린 것도 끝난 것도 없는」 걸음이 몇이나 이어지나.
     박사님이 잡으신 것이 그 구간이라 **세어서 적는다.** */
  let run = 0, worst = 0;
  for (const e of W.log) { run = (e.opened.length || e.finished.length) ? 0 : run + 1; worst = Math.max(worst, run); }
  note(`사슬이 도는 동안 아무 일도 안 난 걸음 — 최장 ${worst}걸음 / 전체 ${W.log.length}걸음`);

  /* ── ★★★ C-4 2026-08-17 신설 — **긴 줄이 짧은 줄을 막지 않는다** (§긴 줄) ────────
     박사님: *"잎 두 장·잎 세 장 퀘스트 앞에 「한 상에 두 가지」 등 퀘가 배치돼야 될 듯?"*
     ⚠ 재는 것은 **여는 차례가 아니라 「지금 할 일」로 뽑히는 차례**다. 잎 줄은 예전에도
       사슬을 막지 않았다(뒤에 걸린 줄이 하나도 없다) — 막고 있던 것은 `questView.next` 다. */
  const B1b = board();
  B1b.stamina.questsTaken = [...FIRST_PLAY_CHAIN_IDS];
  /* ★ 2026-09-02 — 이 판은 `questsTaken` 에 `monstera_home` 을 «끝냈다»고 적어 둔다.
     그런데 그 줄의 done 이 곧 `monsteraHomed`(옮겼나)다 — 끝냈으면 옮긴 것이다. 예전에는 그 칸을
     안 채워도 통했는데, 오늘부터 `crop_mix` 가 「왔나」가 아니라 「옮겼나」로 열린다(박사님:
     창턱까지 배치하고 설명이 끝난 뒤에 무순 이야기). ⇒ 판을 «사실대로» 채운다 — 자의 자기 모순을 없앤다. */
  /* ★ 2026-09-02 ㉱ — 짧은 줄(siru5_cycle5)의 열쇠가 「세팅 끝」이 됐다([plan]). 이 판은 day 25 라 세팅이 끝난 판이다 —
     그 사실을 채운다(안 채우면 짧은 줄이 없어 자가 거짓으로 붉다). */
  /* ★ 2026-09-04 ㉲ — siru5 의 열쇠가 「시루 둘 «놓임» && 창턱」이라 놓인 시루 둘을 «사실대로» 채운다. */
  const vMix = questView(B1b, { ...emptySnapshot(), day: 25, firstPlayDone: true,
                                cropPots: [{ kind: 'beansprout', harvestCount: 3, placed: true },
                                           { kind: 'beansprout', harvestCount: 1, placed: true }],
                                monsteraArrived: true, monsteraHomed: true, monsteraHomedDays: 1, motherLeaves: 1 });
  ok('C-4 ★★★ 잎 줄과 짧은 줄이 같이 열려 있으면 **짧은 줄이 「지금 할 일」이 된다**',
     /* ★ ㉱ — 짧은 줄의 «이름»을 안 박는다(예전엔 crop_mix 였고 지금은 siru5_cycle5 다). 「짧은 줄이 하나 열려 있다」로 본다 */
     vMix.open.includes('leaf_two') && vMix.open.some(id => !SLOW_QUEST_IDS.includes(id)) &&
     !SLOW_QUEST_IDS.includes(vMix.next.id),
     `열린 것 ${vMix.open.join(',')} → 지금 할 일 「${vMix.next.ko}」`);
  const B1c = board();
  B1c.stamina.questsTaken = QUEST_IDS.filter(id => !SLOW_QUEST_IDS.includes(id));
  const vSlow = questView(B1c, { ...emptySnapshot(), motherLeaves: 1 });
  ok('C-5 ★★ 그래도 **다른 게 없으면 잎 줄이 「지금 할 일」이 된다** (사라지지 않는다)',
     vSlow.next && vSlow.next.id === SLOW_QUEST_IDS[0],
     vSlow.next ? `「${vSlow.next.ko}」` : 'next 가 null 이다');
}

/* ══ D. ★ 배선이 하나도 안 붙어도 사슬이 도는가 (§안전 폴백) ═══════════════ */
console.log('\n══ D. ★★ **화면 배선이 하나도 없는 판** — 사슬이 끝까지 가는가 ══');
{
  /* 새 칸 넷(`placed`·`watered`·`monsteraArrived`·`monsteraHomed`)을 **하나도 안 채운다.**
     `game.html` 이 아직 안 고쳐진 그 상태가 정확히 이것이다.
     ⇒ 그래도 사슬이 돌아야 한다. 안 돌면 배선이 붙기 전까지 열여섯 줄이 통째로 잠긴다. */
  const B2 = board(), W2 = makeWalker(B2);
  const S0 = emptySnapshot();
  /* ⚠ 2026-08-17 — 회전 수를 **셋까지** 늘렸다. `order_seed` 의 문턱이 총 3회전이라
     둘에서 멈춘 옛 표로는 그 줄이 안 끝나고, 뒤에 걸린 ⑤⑥ 이 통째로 막힌다.
     ★ 값을 늘린 것이지 판정을 느슨하게 한 것이 아니다 — 배선 칸은 여전히 하나도 안 채운다. */
  const cp = (...counts) => counts.map(h => ({ kind: 'beansprout', harvestCount: h }));
  const naive = [
    { ...S0, day: 1, cropPots: cp(0) },
    { ...S0, day: 2, cropPots: cp(0) },
    { ...S0, day: 7, cropHarvestTotal: 1, cropPots: cp(1) },
    { ...S0, day: 8, cropHarvestTotal: 1, cropPots: cp(1) },
    { ...S0, day: 9, cropHarvestTotal: 1, cropPots: cp(1) },
    { ...S0, day: 13, cropHarvestTotal: 2, cropPots: cp(2) },
    { ...S0, day: 14, cropHarvestTotal: 2, cropPots: cp(2) },
    /* ★ 주문한 씨앗이 와서 세 바퀴째 — `order_seed` 가 여기서 끝난다 */
    { ...S0, day: 19, cropHarvestTotal: 3, motherLeaves: 1, cropPots: cp(3) },
    { ...S0, day: 20, cropHarvestTotal: 3, motherLeaves: 1, cropPots: cp(3) },
    { ...S0, day: 21, cropHarvestTotal: 3, motherLeaves: 1, cropPots: cp(3, 0) },
    { ...S0, day: 22, cropHarvestTotal: 3, motherLeaves: 1, cropPots: cp(3, 0) },
    { ...S0, day: 30, cropHarvestTotal: 3, motherLeaves: 2, cropPots: cp(3, 0) },
    { ...S0, day: 31, cropHarvestTotal: 3, motherLeaves: 2, cropPots: cp(3, 0) },
    { ...S0, day: 40, cropHarvestTotal: 3, motherLeaves: 3, cropPots: cp(3, 0) },
    { ...S0, day: 41, cropHarvestTotal: 3, motherLeaves: 3, cropPots: cp(3, 0) }
  ];
  naive.forEach((s, i) => W2.step(`배선 없음 ${i + 1}`, s));
  const done2 = W2.log.flatMap(e => e.finished);
  const want2 = [...FIRST_PLAY_CHAIN_IDS, ...SLOW_QUEST_IDS];
  const left = want2.filter(id => !done2.includes(id));
  ok(`D-1 ★★★ 새 칸을 **하나도 안 채워도** ${want2.length}줄이 다 끝난다 (사슬이 안 막힌다)`,
     left.length === 0, left.length ? `막힌 줄: ${left.join(' · ')}` : `${want2.length}줄 전부`);
  note('⇒ `game.html` 배선을 나중에 붙여도 사슬은 이미 돈다. 붙이면 **더 일찍** 끝날 뿐이다.');
}

/* ══ E. 회귀 — 본 줄기 여덟이 예전과 같은 걸음에 열리는가 ═══════════════════ */
console.log('\n══ E. ★★ 회귀 — 본 줄기 여덟은 예전 그대로인가 ═══════════════════');
{
  /* ⚠⚠ 아래 아홉 걸음은 **2026-08-16 이전의 `tools/test_quest.mjs` 가 쓰던 것 그대로**다.
     한 글자도 안 고쳤다 — 고치면 「전·후 비교」가 아니라 다른 것을 재게 된다.
     ★ 그때 실측한 여는 걸음: 2 · 4 · 6 · 7 · 7 · 7 · 8 · 9 (그 판의 출력에서 받아 적었다). */
  /* ★★★ 2026-08-17 — **셋이 앞당겨졌다. 회귀가 아니라 지시다.** (박사님: *"퀘스트 나오기
       전 이미 달성했으면 자동 완료되게 해줘 (예를 들면 시루 8개 늘리기)"*)
     `stepQuests` 가 **더 안 바뀔 때까지 돌게** 됐다. 앞 줄이 이번 걸음에 끝나면 뒷줄이
     **같은 걸음 안에서** 열린다 — 하루를 안 기다린다. 그래서 사슬로 걸린 줄이 당겨진다:
       siru5_cycle5 4 → **3** · siru8 6 → **5** · siru16 7 → **5**
     ⚠ 옛 값은 지우지 않고 옆에 남긴다 — 「무엇이 왜 움직였나」가 안 남으면 다음 사람이
       이것을 회귀로 읽고 되돌린다(이 저장소가 여러 번 겪은 그 모양).
     ⚠ 나머지 다섯(crop_mix 2 · first_cut 7 · buy_lamp 7 · varie_bright 8 · sell_varie 9)은
       **한 톨도 안 움직였다** — 그것들은 사슬이 아니라 제 사실로 열리기 때문이다. */
  /* ★★★ 2026-09-02 ㉱ — **[plan]이 사슬을 다시 짰다. 회귀가 아니라 지시다.** (plan-quest-reframe ㉱ · 263b920)
       siru5_cycle5 의 열쇠가 「crop_mix 끝」→「세팅 끝」 ⇒ 3 → **2** (무순 없이 열린다 — 141일 파산의 자물쇠가 풀렸다)
       crop_mix 는 siru5 «뒤»로 ⇒ 2 → **4** · siru8 은 siru5 를 따라 5 → **4**
       ⚠ siru16 은 이 걸음표에서 원래(HEAD)부터 안 열렸다(undefined) — 그건 이 표의 병이지 사슬의 병이 아니다. 5 를 남긴다.
       ⚠ 옛 값은 지우지 않고 옆에 남긴다: crop_mix 2 · siru5_cycle5 3 · siru8 5. */
  /* ★★ 2026-09-04 ㉲([plan] 93a35e1) — **열쇠가 또 바뀌었다. 회귀가 아니라 지시다.**
       siru5_cycle5 ← 「시루 둘 «놓임»(placed) && 창턱(monsteraHomed)」. 이 옛 걸음표는 그 두 칸을 «일부러 안 채운다»
       (위 ⚠ 새 칸 넷) ⇒ 그러니 siru5 와 그 뒤(crop_mix·siru8·siru16)는 이 표에서 «안 열리는 것이 뜻대로»다(undefined).
       ⚠ 진짜 옛 세이브는 다르다 — 화면의 questSnapshotNow 가 placed 와 guide.moved(세이브에 실린다)로 두 칸을 «채운다».
       ⚠ 옛 값은 지우지 않고 옆에 남긴다: crop_mix 4 · siru5_cycle5 2 · siru8 4 · siru16 5. */
  const OLD = { crop_mix: undefined, siru5_cycle5: undefined, siru8: undefined, siru16: undefined,
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
  /* ⚠ 2026-08-17 — 줄 수를 **표에서 읽는다**. 예전에는 `=== 8` 이 박혀 있었고,
     사슬이 여덟 → 일곱으로 갈리자 그 한 줄만 낡았다(START-HERE §2.8 의 그 모양). */
  ok('F-4 ★ 마디를 말한다',
     v.stage === 'first_play' && v.chain && v.chain.total === FIRST_PLAY_CHAIN_IDS.length,
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
