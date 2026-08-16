/* ============================================================
   test_banjiha_profile.mjs — 반지하 정적 프로필 비파괴 검증 (house 소유)
   ------------------------------------------------------------
   증명 대상 (첫 플레이 얇은 통합 · HOUSE 범위):
     ① data/profiles/room_profile.banjiha.json 이 게임 경로(createProfileLight)로
        throw 없이 로드된다 — 안정 uid 계약(uidStable·중복·TEMP)을 통과한다.
     ② 안정 ID: 14칸 전부 고유·TEMP~ 없음·중복 없음.
     ③ 각 슬롯에 유한한 maxPotD 가 실려 있다(화분 배치 물리 필터가 정적 경로에도 산다).
     ④ 첫 플레이 두 자리 — 밝은 `banjiha-sill:0`(몬스테라 0.202) / 어두운
        `banjiha-dresser:1`(열린 시루 0.24) 의 maxPotD 가 그 화분을 올릴 수 있다.
     ⑤ live↔static: 정적 프로필의 ratio 로 낸 DLI 가 라이브(집 조립 + buildDailyLight)
        값을 오차 <= 0.005 로 재현하고, best 슬롯이 일치한다.

   물리식은 엔진 정본(daily_light.js)만 부른다 — createProfileLight 가 daylightDLI 를
   그대로 쓰므로 여기서 상수를 복제하지 않는다. THREE·집 조립이 없어 Node 에서 돈다.

   라이브 참조값 LIVE 는 2026-08-02 `_profile_gen.html?rooms=banjiha` 가 실제 집을
   조립해(buildHouse→winFromHouse(...,w.cz)→buildDailyLight) 낸 값이다. 맑음·여름·등 0개.
   같은 조건에서 브라우저가 잰 최대 오차는 0.00493 이었다(정본 daylightDLI 대조).
   재현 명령:  python tools/serve.py 8790 .  →  브라우저로 위 URL 열기.
============================================================ */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProfileLight, PROFILE_SCHEMA } from '../src/game/room_profile.js';

const profile = JSON.parse(readFileSync(
  new URL('../data/profiles/room_profile.banjiha.json', import.meta.url), 'utf8'));
const lightTh = JSON.parse(readFileSync(
  new URL('../data/balance/light_thresholds.json', import.meta.url), 'utf8'));

/* 라이브 참조 — buildDailyLight(맑음·여름·등 0개).
   ★★ **2026-08-05 갱신 — 반지하 창 tau 0.55 → 0.70 (박사님 확정).**
   ------------------------------------------------------------
   이 표는 검사가 무르익어서 고친 것이 아니라 **입력이 바뀌어서** 다시 뜬 것이다.
   `data/window_presets.json` 의 `win_semi_letterbox.glass.transmittance` 를 올렸고,
   창턱 DLI 가 등 0개 3.77 → **4.80** 이 되어 등 1개일 때 5.61 → **6.64** 로
   갈라짐 문턱 6.0 을 넘게 됐다. 그 전에는 못 넘어서 「등을 사는 경로」와
   「안 사는 경로」의 결과가 바이트 단위로 같았다(test_balance_routes ①-1).

   ★ 값은 지어낸 것이 아니라 **브라우저에서 실제로 다시 잰 것**이다 —
     `game.html` 을 띄우고 `io.light.dliOfSlot(…, {weather:'clear', season:'summer',
     lampCount:0, litHours:0})` 를 14칸 전부 돌렸다.
   ★ 열네 칸이 **전부 정확히 1.2727배**(= 0.70/0.55)다. 차폐 기하가 안 바뀌었으므로
     그래야 맞고, 한 칸이라도 어긋났으면 그건 tau 말고 다른 것이 바뀐 것이다.
     ⇒ 이 「전부 같은 배율」이 곧 이 갱신이 정당하다는 증거다.

   옛 값(tau 0.55, 2026-08-02): sill 3.77 · desk:0 0.48 · desk:1 0.13 ·
     dresser:0 0.06 · dresser:1 0.04 · etagere:0~2 0.10/0.11/0.10 ·
     etagere:3~5 0.18/0.18/0.17 · etagere:6~8 0.40/0.38/0.38 */
/* ★★ **2026-08-15 갱신 — 추천 자리를 칸 한가운데로 옮겼다**(박사님 허락).
   ------------------------------------------------------------
   또 **입력이 바뀌어서** 다시 뜬 표다. `furniture_pastel.tierSlots` 의 가장자리 여백
   상수 0.09 를 **칸 반쪽**으로 바꿨다(까닭·폭은 `tools/test_floorlight.mjs` §① 머리말).
   자리 열 곳의 **월드 좌표가 움직였고**, 밝기는 좌표에서 나오므로 같이 움직였다.

   ⚠⚠ **이 검사는 그 움직임을 못 잡는다.** 정적 프로필의 ratio 와 아래 LIVE 표를 견줄 뿐
     집을 조립하지 않기 때문이다. 둘 다 낡으면 오차 0.00000 으로 그냥 통과한다.
     ⇒ 「live_vs_static 0.00000」을 **「빛이 안 바뀌었다」로 읽으면 안 된다.**
       빛이 바뀌었는지는 `test_floorlight` ① · `test_lampaim` ① · `test_oneroom_room` ⑥ 이 잡는다.

   ★ 값은 **손으로 적지 않았다.** 정적 프로필과 이 표를 같은 도구가 한 번에 뽑는다:
       node tools/gen_room_profile.mjs --write
     (스텁 DOM 위에서 집을 실제로 조립해 `light_adapter.profile` + `dliOfSlot` 을 부른다.
      예전에는 브라우저로 `_profile_gen.html` 을 열어 손으로 옮겨 적었고, 그래서
      `banjiha-sill:0` 의 등 PPFD 가 2026-08-06 반사광 도입 뒤 42.62 로 **9일간 낡아 있었다**.)
   옛 값(2026-08-06 main): desk:0 0.61 · desk:1 0.17 · dresser:0 0.08 · etagere:3 0.23.
     나머지 열 칸은 그대로다. 창턱 4.80 은 한 톨도 안 움직였다. */
/* ★★ 2026-08-17 (G-14) 갱신 — **두 가지가 한꺼번에 들어 있다. 갈라 적는다.**
     ① 반지하에 **협탁**이 들어와 자리가 14 → 15 칸이 됐다
        (`data/house_rooms.json §banjiha-nightstand`). 새 줄은 `banjiha-nightstand:0` 하나다.
     ② ⚠ **이 표는 그 전부터 이미 빨갰다.** `desk:0` 0.6 · `desk:1` 0.19 ·
        `dresser:0` 0.07 · `dresser:1` 0.05 는 **B-1·B-6**(가구를 모서리로 붙이고 상판
        자리를 칸 한가운데로 옮긴 것 · `d1986cd`)이 낸 값인데 이 표가 안 따라와서,
        협탁 전에 돌려도 `banjiha-desk:0: static 0.61 vs live 0.6` 로 터졌다(재서 확인).
        여기서 같이 바로잡는다 — **내 변경이 낸 값이 아니다.**
   ★ 값은 손으로 안 적었다: `node tools/gen_room_profile.mjs` 가 이 표를 그대로 찍어 준다. */
const LIVE = {
  best: 'banjiha-sill:0',
  dli: {
    'banjiha-sill:0': 4.8, 'banjiha-desk:0': 0.61, 'banjiha-desk:1': 0.18,
    'banjiha-dresser:0': 0.06, 'banjiha-dresser:1': 0.04,
    'banjiha-etagere:0': 0.13, 'banjiha-etagere:1': 0.14, 'banjiha-etagere:2': 0.13,
    'banjiha-etagere:3': 0.22, 'banjiha-etagere:4': 0.22, 'banjiha-etagere:5': 0.21,
    'banjiha-etagere:6': 0.51, 'banjiha-etagere:7': 0.48, 'banjiha-etagere:8': 0.48,
    'banjiha-nightstand:0': 0.29
  }
};

/* ── ① 로드: 계약 위반이면 createProfileLight 이 throw 한다 ── */
assert.equal(profile.schema, PROFILE_SCHEMA, 'schema 가 room_profile/1 이어야 한다');
assert.equal(profile.uidStable, true, 'uidStable:true 여야 게임 경로가 로드한다');
assert.ok(profile.roomRev && /\S/.test(profile.roomRev), 'roomRev 가 실려 있어야 한다');
const port = createProfileLight(profile, { lightTh });   // throw 하면 여기서 실패
console.log(`load: PASS (uidStable · roomRev="${profile.roomRev}")`);

/* ── ② 안정 ID: 15칸 고유 · TEMP~ 없음 · 중복 없음 ── */
const ids = profile.slots.map(s => s.slotId);
assert.equal(ids.length, 15, '반지하 슬롯 15칸');
assert.equal(new Set(ids).size, 15, 'slotId 는 전부 고유해야 한다');
assert.equal(ids.filter(id => String(id).startsWith('TEMP~')).length, 0, 'TEMP~ 임시 uid 가 없어야 한다');
console.log('stable_ids: PASS (15/15 고유 · TEMP 0)');

/* ── ③ maxPotD 결측 0칸 ── */
const noDim = profile.slots.filter(s => !Number.isFinite(s.maxPotD));
assert.equal(noDim.length, 0, `maxPotD 결측 슬롯이 있으면 안 된다: ${noDim.map(s => s.slotId)}`);
console.log('maxPotD_present: PASS (15/15)');

/* ── ④ 첫 플레이 두 화분이 지정 자리에 올라간다 ── */
const slotOf = id => profile.slots.find(s => s.slotId === id) || assert.fail(`슬롯 없음: ${id}`);
const sill = slotOf('banjiha-sill:0'), dresser1 = slotOf('banjiha-dresser:1');
assert.ok(0.202 <= sill.maxPotD, `몬스테라 0.202 ≤ 창턱 maxPotD(${sill.maxPotD})`);
assert.ok(0.24 <= dresser1.maxPotD, `열린 시루 0.24 ≤ 서랍장 maxPotD(${dresser1.maxPotD})`);
console.log(`firstplay_fit: PASS (sill maxPotD ${sill.maxPotD} ≥ 0.202 · dresser:1 ${dresser1.maxPotD} ≥ 0.24)`);

/* ── ⑤ live↔static: 정적 ratio→DLI 가 라이브를 <=0.005 로 재현 · best 일치 ── */
const opt = { weather: 'clear', season: 'summer', lampCount: 0, litHours: 0 };
let maxErr = 0, worst = null, bestId = null, bestDli = -Infinity;
for (const id of ids) {
  const staticDli = port.dliOfSlot(id, opt);
  if (staticDli > bestDli) { bestDli = staticDli; bestId = id; }
  const live = LIVE.dli[id];
  assert.notEqual(live, undefined, `라이브 참조에 ${id} 가 없다`);
  const e = Math.abs(staticDli - live);
  if (e > maxErr) { maxErr = e; worst = id; }
  assert.ok(e <= 0.005, `${id}: static ${staticDli} vs live ${live} 오차 ${e.toFixed(5)} > 0.005`);
}
assert.equal(bestId, LIVE.best, `best 슬롯 정적 ${bestId} ≠ 라이브 ${LIVE.best}`);
console.log(`live_vs_static: PASS (best ${bestId} 일치 · 최대 오차 ${maxErr.toFixed(5)} @ ${worst})`);

console.log('banjiha_profile: PASS');
