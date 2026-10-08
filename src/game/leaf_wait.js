/* src/game/leaf_wait.js — **둘째 잎을 기다리는 동안의 칸** (2026-10-08 · [plan] plan-leafwait-20261008.md ③)
   ------------------------------------------------------------------
   [plan] 이 dialogue.js 에 «상태 줄» 여섯을 지었다(사건 > 독촉 > 상태 줄 > 잡담 · §pickStatus).
   줄은 칸이 참일 때만 뜬다. 칸을 잇는 것은 core 몫이고, 여기서 **하루에 한 번** 센다(loop.nextDay —
   빨리감기도 하루씩 nextDay 를 지나므로 날이 안 빠진다).

   계약(dialogue §chatterContext 가 이 이름 그대로 읽는다):
     turn.leafWait = { leaves, newLeafToday, leafWaitDays, youngestLeafM, growStreak, arrivedOnDay,
                       harvestedToday, harvestsSinceArrival, potOnSill, band, zoomOpenedSinceArrival }
   ⚠ 모르면 **null** 이다(그 줄이 안 뜬다). 0·false 로 안 메꾼다 — 모르는 것을 안다고 하면 몬이가 거짓말을 한다.

   칸마다의 뜻:
     leaves               첫 그루에 달린 잎 수(growth leafOnPlant 의 onPlant · leafStats().leaves 와 같은 기준)
     newLeafToday         지난번 센 뒤 새 잎이 났나. ★ 잎 «수»가 아니라 **가장 늦게 난 잎의 leafBirth** 로 본다 —
                          자르면 잎 수가 줄어 «자른 날 새 잎이 함께 난» 것을 못 본다. leafBirth 는 g 와 같이만 커지므로
                          지금까지 본 가장 큰 leafBirth 보다 크면 새 잎이다
     leafWaitDays         새 잎이 마지막으로 난 날부터 오늘까지(도착한 날부터 센다 — 사람의 기다림은 거기서 시작한다)
     youngestLeafM        가장 늦게 난 «달린» 잎의 leafM(렌더러가 잎 크기로 쓰는 값 · growth 가 g 로 잰 것)
     growStreak           멈춤 없이 자란 날(turn 의 grew). 멈춘 날·가방에 든 날 0 · 못 잰 날(grew null)은 그대로 둔다
     arrivedOnDay         첫 그루가 온 날(pot.arrivedOnDay)
     harvestedToday       지난번 센 뒤 시루를 거뒀나 — ⚠ 거두기는 «낮의 손»이고 이 칸은 «아침»에 센다.
                          그래서 «오늘 아침에 보니 어제 거뒀다»다(statusSiruVs 「콩나물은 또 거뒀는데」 과거형과 맞는다)
     harvestsSinceArrival 도착 뒤 거둔 수(도착을 부른 그 수확은 안 센다)
     potOnSill            첫 그루 칸이 창턱인가(slotId 에 `sill`) · 가방이면 false
     band                 그 자리의 빛 낱말 'dark'|'mid'|'bright' — 무늬 등급 표(shop.varieLightStepOfBand)와 같은 낱말
     zoomOpenedSinceArrival 도착 뒤 확대창을 연 적 있나 · ⚠ 도착을 못 지켜본 옛 세이브는 null(모른다)

   ★ 세이브 칸은 `firstPlay.monstera.watch` 하나다(save.js §monstera). 안 실으면 새로고침마다 «기다린 날»이 0 부터 다시 센다.
   ⚠ 이 파일은 값(문턱)을 안 정한다 — 「며칠이면 말하나」는 dialogue.js 의 표([plan] 몫)다. */
import { cropSites } from './first_play.js';
import { varieLightStepOfBand } from './shop.js';

const int = v => Number.isInteger(v);
const fin = v => typeof v === 'number' && Number.isFinite(v);

/* 지금 꽂힌 그루의 잎 — 부르는 쪽이 «첫 그루가 꽂힌 그 순간»에 부른다(loop §여러 그루).
   반환 `{ leaves, birthTop, youngestM }` 또는 못 읽으면 null. */
export function readLeafNow(io) {
  const g = io && io.growth;
  if (!g) return null;
  let rows = null;
  try { rows = g.leafOnPlant ? g.leafOnPlant() : null; } catch { rows = null; }
  if (Array.isArray(rows)) {
    const on = rows.filter(r => r && r.onPlant === true && fin(r.leafBirth));
    let top = null;
    for (const r of on) if (!top || r.leafBirth > top.leafBirth) top = r;
    return { leaves: on.length, birthTop: top ? top.leafBirth : null,
             youngestM: top && fin(top.leafM) ? top.leafM : null };
  }
  /* 잎마다를 못 읽는 옛 생장 창 — 잎 수만 안다(새 잎·leafM 은 모른다) */
  let s = null;
  try { s = g.leafStats ? g.leafStats() : null; } catch { s = null; }
  return (s && int(s.leaves)) ? { leaves: s.leaves, birthTop: null, youngestM: null } : null;
}

function harvestTotalOf(fp) {
  try { return cropSites(fp).reduce((a, s) => a + ((s && s.harvestCount) || 0), 0); }
  catch { return null; }
}

/* ★ 확대창을 열었다 — game.html 의 확대 열기가 부른다. 도착 전이면 아무것도 안 한다. */
export function noteZoomOpened(S) {
  const m = S && S.firstPlay && S.firstPlay.monstera;
  if (!m || !m.arrived) return false;
  if (!m.watch || typeof m.watch !== 'object') m.watch = {};
  m.watch.zoomOpened = true;
  return true;
}

/* ★ 하루에 한 번 — 칸을 세고 `firstPlay.monstera.watch` 를 앞으로 민다. 반환이 곧 turn.leafWait 다.
     S     게임 상태(watch 만 바꾼다)
     pot   첫 그루(pot0) · 없으면 null
     row   오늘 그 그루의 턴 줄(turn.plants 의 그 줄 · 가방이면 null)
     leaf  readLeafNow 가 낸 것(못 읽었으면 null)
   ⚠ 몬스테라가 안 왔으면 null 을 낸다(칸 전체가 «모른다»). */
export function stepLeafWatch(S, { pot = null, row = null, leaf = null } = {}) {
  const fp = S && S.firstPlay;
  const m = fp && fp.monstera;
  if (!m || !m.arrived || !int(S.day)) return null;
  const day = S.day;
  const arrivedOnDay = pot && int(pot.arrivedOnDay) ? pot.arrivedOnDay : null;
  if (!m.watch || typeof m.watch !== 'object') m.watch = {};
  const w = m.watch;
  const total = harvestTotalOf(fp);

  /* 처음 세는 날 — 도착을 «지켜봤나»(온 날 다음 아침까지)에 따라 아는 것이 갈린다 */
  if (!int(w.since)) {
    const fresh = arrivedOnDay != null && day <= arrivedOnDay + 1;
    w.since = day;
    w.upDay = fresh ? arrivedOnDay : day;            /* 옛 세이브는 오늘부터 — 「스무 날 그대로」를 지어내지 않는다 */
    w.harvestBase = total;                           /* 도착을 부른 수확은 이미 들어 있다 → 안 센다 */
    w.harvestSeen = null;                            /* 어제를 못 봤다 → 오늘 «거뒀나»는 모른다(null) */
    if (w.zoomOpened !== true) w.zoomOpened = fresh ? false : null;
    w.streak = 0;
  }
  /* 첫 그루가 바뀌었다(모주를 팔았다 등) — 잎 쪽만 새로 센다 */
  if (pot && w.potId !== pot.id) {
    if (w.potId != null) { w.upDay = day; w.streak = 0; }
    w.potId = pot.id; w.birthTop = null;
  }

  /* 새 잎 */
  let newLeafToday = null;
  if (leaf && fin(leaf.birthTop)) {
    if (fin(w.birthTop)) {
      newLeafToday = leaf.birthTop > w.birthTop + 1e-9;
      if (newLeafToday) w.upDay = day;
    }
    if (!fin(w.birthTop) || leaf.birthTop > w.birthTop) w.birthTop = leaf.birthTop;
  }
  /* 멈춤 없이 자란 날 */
  const inBag = !!(pot && pot.placedOnce === false && !pot.slotId && !pot.at);
  if (!pot || inBag || !row) w.streak = 0;
  else if (row.grew === true) w.streak = (int(w.streak) ? w.streak : 0) + 1;
  else if (row.grew === false) w.streak = 0;
  /* 거둠 */
  let harvestedToday = null;
  if (total != null && int(w.harvestSeen)) harvestedToday = total > w.harvestSeen;
  if (total != null) w.harvestSeen = total;
  w.day = day;

  const sb = row && ((row.growthSpeed && row.growthSpeed.band) || (row.slot && row.slot.band)) || null;
  let band = null; try { band = sb ? varieLightStepOfBand(sb) : null; } catch { band = null; }
  return {
    leaves: leaf && int(leaf.leaves) ? leaf.leaves : null,
    newLeafToday,
    leafWaitDays: int(w.upDay) ? Math.max(0, day - w.upDay) : null,
    youngestLeafM: leaf && fin(leaf.youngestM) ? leaf.youngestM : null,
    growStreak: int(w.streak) ? w.streak : null,
    arrivedOnDay,
    harvestedToday,
    harvestsSinceArrival: (total != null && int(w.harvestBase)) ? Math.max(0, total - w.harvestBase) : null,
    potOnSill: pot ? (!inBag && /sill/i.test(String(pot.slotId || ''))) : null,
    band,
    zoomOpenedSinceArrival: w.zoomOpened === true ? true : (w.zoomOpened === false ? false : null)
  };
}

/* save.js 가 싣는 모양 — 열쇠를 하나하나 적는다(모르는 칸이 몰래 따라 들어가지 않게) */
export function packLeafWatch(w) {
  if (!w || typeof w !== 'object') return null;
  const i = v => (int(v) ? v : null);
  return {
    since: i(w.since), day: i(w.day), potId: (typeof w.potId === 'string' || int(w.potId)) ? w.potId : null,
    birthTop: fin(w.birthTop) ? w.birthTop : null, upDay: i(w.upDay), streak: i(w.streak),
    harvestBase: i(w.harvestBase), harvestSeen: i(w.harvestSeen),
    zoomOpened: w.zoomOpened === true ? true : (w.zoomOpened === false ? false : null)
  };
}
