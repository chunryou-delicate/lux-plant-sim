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

/* 라이브 참조 — buildDailyLight(맑음·여름·등 0개). _profile_gen.html 캡처(2026-08-02). */
const LIVE = {
  best: 'banjiha-sill:0',
  dli: {
    'banjiha-sill:0': 3.77, 'banjiha-desk:0': 0.48, 'banjiha-desk:1': 0.13,
    'banjiha-dresser:0': 0.06, 'banjiha-dresser:1': 0.04,
    'banjiha-etagere:0': 0.1, 'banjiha-etagere:1': 0.11, 'banjiha-etagere:2': 0.1,
    'banjiha-etagere:3': 0.18, 'banjiha-etagere:4': 0.18, 'banjiha-etagere:5': 0.17,
    'banjiha-etagere:6': 0.4, 'banjiha-etagere:7': 0.38, 'banjiha-etagere:8': 0.38
  }
};

/* ── ① 로드: 계약 위반이면 createProfileLight 이 throw 한다 ── */
assert.equal(profile.schema, PROFILE_SCHEMA, 'schema 가 room_profile/1 이어야 한다');
assert.equal(profile.uidStable, true, 'uidStable:true 여야 게임 경로가 로드한다');
assert.ok(profile.roomRev && /\S/.test(profile.roomRev), 'roomRev 가 실려 있어야 한다');
const port = createProfileLight(profile, { lightTh });   // throw 하면 여기서 실패
console.log(`load: PASS (uidStable · roomRev="${profile.roomRev}")`);

/* ── ② 안정 ID: 14칸 고유 · TEMP~ 없음 · 중복 없음 ── */
const ids = profile.slots.map(s => s.slotId);
assert.equal(ids.length, 14, '반지하 슬롯 14칸');
assert.equal(new Set(ids).size, 14, 'slotId 는 전부 고유해야 한다');
assert.equal(ids.filter(id => String(id).startsWith('TEMP~')).length, 0, 'TEMP~ 임시 uid 가 없어야 한다');
console.log('stable_ids: PASS (14/14 고유 · TEMP 0)');

/* ── ③ maxPotD 결측 0칸 ── */
const noDim = profile.slots.filter(s => !Number.isFinite(s.maxPotD));
assert.equal(noDim.length, 0, `maxPotD 결측 슬롯이 있으면 안 된다: ${noDim.map(s => s.slotId)}`);
console.log('maxPotD_present: PASS (14/14)');

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
