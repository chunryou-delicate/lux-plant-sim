/* tools/test_leaf_wait.mjs — **둘째 잎 기다림 칸(turn.leafWait)이 날마다 바로 세지나** (2026-10-08 · [plan] plan-leafwait ③)
   ------------------------------------------------------------------
   leaf_wait.stepLeafWatch 를 가짜 하루들로 민다(생장 창 없이 · 잎 줄은 손으로 준다).
   재는 것: 새 잎(leafBirth 로) · 자른 날 · 멈춘 날 · 가방 · 거둠 · 확대창 · 옛 세이브(도착을 못 본 판) · 첫 그루가 바뀜
   ⛔ 값(줄이 뜨는 문턱)은 dialogue.js 의 표([plan]) — 여기서는 칸만 본다.
     node tools/test_leaf_wait.mjs */
import { stepLeafWatch, noteZoomOpened, packLeafWatch } from '../src/game/leaf_wait.js';

let fail = 0;
const ok = (c, msg, got) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${msg}${got !== undefined ? ' → ' + JSON.stringify(got) : ''}`); if (!c) fail++; };
const mkS = (day, arrivedOnDay) => ({
  day,
  firstPlay: null,
  pots: [{ id: 'pot_01', arrivedOnDay, slotId: 'banjiha-sill:0', at: { x: 0 }, placedOnce: true }]
});
/* 첫 플레이 모양은 진짜를 쓴다 — leaf_wait 가 first_play §cropSites 를 그대로 부른다 */
/* cropSites 는 beansprout 와 crops[] 만 본다 — 그 둘만 준다(진짜 상태를 지으려면 밸런스 계약이 든다) */
const realFp = () => ({ monstera: { arrived: true }, beansprout: { kind: 'beansprout', harvestCount: 0 }, crops: [] });
/* 자리 줄의 harvestCount(시루 합 · first_play §syncCropLead 가 맞춘다) — firstPlaySnapshot 이 사건을 낼 때 보는 그 수 */
const bumpHarvest = fp => { fp.beansprout.harvestCount = (fp.beansprout.harvestCount || 0) + 1; };

/* ① 도착을 지켜본 판 — 온 날 다음 아침부터 */
{
  console.log('■ ① 도착을 지켜본 판(온 날 5 · 첫 셈 6)');
  const S = mkS(6, 5); S.firstPlay = realFp();
  bumpHarvest(S.firstPlay);              /* 도착을 부른 수확 */
  const pot = S.pots[0];
  const row = { grew: true, growthSpeed: { band: 'slow' } };
  let lw = stepLeafWatch(S, { pot, row, leaf: { leaves: 3, birthTop: 40.5, youngestM: 0.9 } });
  ok(lw.leaves === 3 && lw.newLeafToday === null, '첫 셈 — 잎 3 · 새 잎은 «모른다»(어제가 없다)', lw);
  ok(lw.leafWaitDays === 1 && lw.arrivedOnDay === 5, '기다린 날은 온 날부터(6−5=1)', lw.leafWaitDays);
  ok(lw.harvestsSinceArrival === 0 && lw.harvestedToday === null, '도착을 부른 수확은 안 센다 · 거둠은 «모른다»', [lw.harvestsSinceArrival, lw.harvestedToday]);
  ok(lw.zoomOpenedSinceArrival === false, '확대창 — 지켜본 판이라 «안 열었다»(false)', lw.zoomOpenedSinceArrival);
  ok(lw.potOnSill === true && lw.band === 'mid', '창턱 · slow → mid', [lw.potOnSill, lw.band]);
  ok(lw.growStreak === 1, '자란 날 1', lw.growStreak);
  /* d7~d9 — 잎 그대로 · 자람 */
  for (let d = 7; d <= 9; d++) { S.day = d; lw = stepLeafWatch(S, { pot, row, leaf: { leaves: 3, birthTop: 40.5, youngestM: 0.95 } }); }
  ok(lw.newLeafToday === false && lw.leafWaitDays === 4 && lw.growStreak === 4, 'd9 — 새 잎 없음 · 기다림 4 · 자란 날 4', lw);
  /* d10 — 거둠(낮) 뒤 아침 */
  bumpHarvest(S.firstPlay); S.day = 10;
  lw = stepLeafWatch(S, { pot, row, leaf: { leaves: 3, birthTop: 40.5, youngestM: 1 } });
  ok(lw.harvestedToday === true && lw.harvestsSinceArrival === 1, 'd10 — 어제 거둠 → 오늘 아침 참 · 도착 뒤 1', [lw.harvestedToday, lw.harvestsSinceArrival]);
  S.day = 11; lw = stepLeafWatch(S, { pot, row, leaf: { leaves: 3, birthTop: 40.5, youngestM: 1 } });
  ok(lw.harvestedToday === false, 'd11 — 안 거둠 → 거짓', lw.harvestedToday);
  /* d12 — 멈춤(grew false) */
  S.day = 12; lw = stepLeafWatch(S, { pot, row: { grew: false, growthSpeed: { band: 'poor' } }, leaf: { leaves: 3, birthTop: 40.5, youngestM: 1 } });
  ok(lw.growStreak === 0 && lw.band === 'dark', 'd12 — 멈춘 날 자란 날 0 · poor → dark', [lw.growStreak, lw.band]);
  /* d13 — 못 잰 날(grew null)은 그대로 */
  S.day = 13; lw = stepLeafWatch(S, { pot, row: { grew: null }, leaf: { leaves: 3, birthTop: 40.5, youngestM: 1 } });
  ok(lw.growStreak === 0 && lw.band === null, 'd13 — grew null 은 그대로 · 밴드 모름 null', [lw.growStreak, lw.band]);
  /* d14 — 새 잎 */
  S.day = 14; lw = stepLeafWatch(S, { pot, row, leaf: { leaves: 4, birthTop: 52.25, youngestM: 0 } });
  ok(lw.newLeafToday === true && lw.leafWaitDays === 0 && lw.youngestLeafM === 0, 'd14 — 새 잎 · 기다림 0 · 가장 어린 잎 leafM 0', lw);
  S.day = 15; lw = stepLeafWatch(S, { pot, row, leaf: { leaves: 4, birthTop: 52.25, youngestM: 0.1 } });
  ok(lw.newLeafToday === false && lw.leafWaitDays === 1, 'd15 — 이튿날은 거짓 · 기다림 1', [lw.newLeafToday, lw.leafWaitDays]);
  /* d16 — 잘랐다(잎 수 4→2) 그리고 같은 날 새 잎(leafBirth 는 더 크다) */
  S.day = 16; lw = stepLeafWatch(S, { pot, row, leaf: { leaves: 3, birthTop: 60, youngestM: 0 } });
  ok(lw.newLeafToday === true && lw.leaves === 3, 'd16 — 잘라 잎 수가 줄어도 새 잎은 leafBirth 로 본다', lw);
  /* d17 — 잘라 가장 어린 잎이 떠났다(birthTop 이 작아짐) — 새 잎 아님 */
  S.day = 17; lw = stepLeafWatch(S, { pot, row, leaf: { leaves: 1, birthTop: 30, youngestM: 1 } });
  ok(lw.newLeafToday === false && lw.leafWaitDays === 1, 'd17 — 위를 잘라 가장 큰 leafBirth 가 줄어도 «새 잎»이 아니다', lw);
  S.day = 18; lw = stepLeafWatch(S, { pot, row, leaf: { leaves: 2, birthTop: 58, youngestM: 0 } });
  ok(lw.newLeafToday === false, 'd18 — 지금까지 본 것보다 작은 leafBirth 는 새 잎이 아니다(60 > 58)', lw.newLeafToday);
  /* 확대창 */
  noteZoomOpened(S); S.day = 19; lw = stepLeafWatch(S, { pot, row, leaf: { leaves: 2, birthTop: 61, youngestM: 0 } });
  ok(lw.zoomOpenedSinceArrival === true && lw.newLeafToday === true, '확대창을 열면 참 · d19 새 잎(61 > 60)', [lw.zoomOpenedSinceArrival, lw.newLeafToday]);
  /* 세이브 모양 왕복 */
  const w2 = JSON.parse(JSON.stringify(packLeafWatch(S.firstPlay.monstera.watch)));
  ok(w2.upDay === 19 && w2.birthTop === 61 && w2.zoomOpened === true && w2.harvestBase === 1, '세이브 모양 — upDay·birthTop·zoomOpened·harvestBase', w2);
}
/* ② 가방 */
{
  console.log('■ ② 가방에 든 그루');
  const S = mkS(6, 5); S.firstPlay = realFp();
  const pot = { id: 'pot_01', arrivedOnDay: 5, slotId: null, at: null, placedOnce: false };
  const lw = stepLeafWatch(S, { pot, row: null, leaf: { leaves: 3, birthTop: 40.5, youngestM: 0.9 } });
  ok(lw.potOnSill === false && lw.growStreak === 0 && lw.band === null, '가방 — 창턱 아님 · 자란 날 0 · 밴드 모름', lw);
}
/* ③ 옛 세이브 — 온 지 오래된 판에 칸이 처음 생김 */
{
  console.log('■ ③ 옛 세이브(온 날 5 · 첫 셈 80)');
  const S = mkS(80, 5); S.firstPlay = realFp();
  const lw = stepLeafWatch(S, { pot: S.pots[0], row: { grew: true }, leaf: { leaves: 7, birthTop: 140, youngestM: 0.4 } });
  ok(lw.leafWaitDays === 0, '기다림은 오늘부터(지난 75일을 «그대로»로 지어내지 않는다)', lw.leafWaitDays);
  ok(lw.zoomOpenedSinceArrival === null, '확대창 — 도착을 못 봤으니 «모른다»(게이지 줄이 거짓으로 안 뜬다)', lw.zoomOpenedSinceArrival);
}
/* ④ 몬스테라 전 */
{
  console.log('■ ④ 몬스테라 전');
  const S = mkS(3, null); S.firstPlay = realFp(); S.firstPlay.monstera.arrived = false;
  ok(stepLeafWatch(S, { pot: null }) === null, '안 왔으면 칸 전체가 null(모른다)');
  ok(noteZoomOpened(S) === false && !S.firstPlay.monstera.watch, '안 왔으면 확대창도 안 적는다');
}
/* ⑤ 첫 그루가 바뀜(모주를 팔았다) */
{
  console.log('■ ⑤ 첫 그루가 바뀜');
  const S = mkS(6, 5); S.firstPlay = realFp();
  stepLeafWatch(S, { pot: S.pots[0], row: { grew: true }, leaf: { leaves: 5, birthTop: 90, youngestM: 1 } });
  S.day = 7; stepLeafWatch(S, { pot: S.pots[0], row: { grew: true }, leaf: { leaves: 5, birthTop: 90, youngestM: 1 } });
  S.day = 8;
  const pot2 = { id: 'pot_02', arrivedOnDay: 7, slotId: 'banjiha-desk:0', at: { x: 1 }, placedOnce: true };
  let lw = stepLeafWatch(S, { pot: pot2, row: { grew: true }, leaf: { leaves: 1, birthTop: 3, youngestM: 0 } });
  ok(lw.newLeafToday === null && lw.leafWaitDays === 0 && lw.growStreak === 1 && lw.potOnSill === false,
     '새 그루 — 새 잎 «모른다» · 기다림 0 · 자란 날 1 · 책상', lw);
  S.day = 9; lw = stepLeafWatch(S, { pot: pot2, row: { grew: true }, leaf: { leaves: 2, birthTop: 8, youngestM: 0 } });
  ok(lw.newLeafToday === true, '새 그루의 다음 잎은 그 그루의 leafBirth 로 본다(옛 모주 90 과 안 견준다)', lw.newLeafToday);
}
console.log(fail ? `\ntest_leaf_wait: FAIL ${fail}` : '\ntest_leaf_wait: PASS');
process.exit(fail ? 1 : 0);
