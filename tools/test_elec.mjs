/* ★ 전기세 — 정본이 한 벌인가 (2026-08-09 신설)
 *
 *   node tools/test_elec.mjs
 *
 * ══ 왜 이 검사가 생겼나 ═══════════════════════════════════════════════════
 * 전기세 값이 **세 곳**에 흩어져 있었고 서로 달랐다.
 *
 *   ① `TUTORIAL_RULES.lampWatt = 12`        — 지갑에서 빼는 값. 등이 몇 개든 개당 12W
 *   ② `data/lighting_presets.json` fixtures — 실제 기구. 바 20W · 집게 12W
 *   ③ `data/profiles/room_profile.banjiha.json` lampWatts [0,20,32] — 방 조도 계약이 쓰는 값
 *
 * ②③ 은 같은데 ① 만 달랐다. 그래서 등 2개를 24시간 켜면
 * **화면은 123원이라 적고 지갑에서는 92원이 빠졌다.** 「집게 전력으로 바를 켜는」 판이었다.
 *
 * 이 저장소는 정본이 두 벌인 것 때문에 반복해서 사고가 났다(씨앗값 · 계절 달력).
 * ⇒ 그래서 값을 옮기는 것으로 끝내지 않고 **등식을 검사로 고정한다.** 여기가 그 자리다.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import { TUTORIAL_RULES, electricityRulesFrom, lampWattsOn, electricityWonOf,
         lampElectricityWon, createTutorialState, buyLamp } from '../src/game/tutorial.js';

const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const BAL     = J('../data/balance/electricity.json');
const PRESETS = J('../data/lighting_presets.json');
const PROFILE = J('../data/profiles/room_profile.banjiha.json');

let fail = 0;
const check = (name, fn) => {
  try { fn(); console.log('PASS  ' + name); }
  catch (e) { fail++; console.log('FAIL  ' + name + '\n      → ' + e.message); }
};
const mk = (rules = TUTORIAL_RULES, owned = 2) => {
  const ts = createTutorialState({ enabled: true, rules });
  ts.lamp.unlocked = true;
  ts.cashWon = 10_000_000;
  for (let i = 0; i < owned; i++) buyLamp(ts);
  return ts;
};

/* ══ A · 코드 기본값과 정본 JSON 이 같은가 ═══════════════════════════════ */
check('A ★코드 기본값 = data/balance/electricity.json', () => {
  assert.equal(TUTORIAL_RULES.kwhWon, BAL.kwhWon, 'kwhWon 이 갈렸습니다');
  assert.equal(TUTORIAL_RULES.lampHours, BAL.lamp.hours, 'lampHours 가 갈렸습니다');
  assert.equal(TUTORIAL_RULES.lampPriceWon, BAL.lamp.priceWon, 'lampPriceWon 이 갈렸습니다');
  assert.deepEqual([...TUTORIAL_RULES.lampWattsByOrder], [...BAL.lamp.wattsByOrder],
    'lampWattsByOrder 가 갈렸습니다');
  assert.equal(TUTORIAL_RULES.tariffTiers, BAL.tiers, 'tariffTiers 가 갈렸습니다');
  assert.equal(TUTORIAL_RULES.baseKwhPerMonth, BAL.baseKwhPerMonth, 'baseKwhPerMonth 가 갈렸습니다');
});

/* ══ B · ★와트가 기구·방과 같은가 — 이게 이번에 고친 그 버그다 ══════════ */
check('B ★와트 — 기구 프리셋 · 방 프로파일 · 지갑이 같은 값을 본다', () => {
  const bar  = PRESETS.fixtures.growlight_bar.watts;
  const clip = PRESETS.fixtures.growlight_clip.watts;
  /* ★★★ 2026-08-22 — **거치형이 빠져 있었다.** 이 자가 등을 **둘**만 보는 사이
     2026-08-17 에 셋째 등(거치형)이 들어왔다(박사님: *"식물등도 집게형 말고 그냥 거치형 하나
     추가해"* · `tutorial.js §LAMP_KINDS`). 코드는 셋을 다 들고 있었다:
       기구 프리셋 20 · 12 · **36**  ·  `lampWattsByOrder` [20, 12, **36**]
       방 프로파일 `lampWatts` [0, 20, 32, **68**] — 누계라 32+36=68 로 딱 맞는다
     ⇒ **셋 다 아귀가 맞는데 이 한 줄만 둘을 기다려 FAIL 을 냈다.** 코드가 아니라 자가 낡았다.
     ⚠⚠ 이게 §2.9-⑥ 의 **더 나쁜 판**이다. 「조용히 안 재어지는 것」이 아니라
       **멀쩡한 코드를 빨갛게 찍고 있었다.** 이 붉은 줄을 보고 `lampWattsByOrder` 에서
       36 을 빼는 순간 **거치등 전기세가 통째로 사라진다** — 검사가 사고를 만드는 자리다.
     ⇒ 이제 **기구 표에서 셋을 다 읽는다.** 넷째 등이 들어오면 이 줄도 같이 늘려야 한다.
       (수를 여기 박지 않고 프리셋에서 읽으므로 **와트 값이 바뀌는 것**은 저절로 따라온다.) */
  const stand = PRESETS.fixtures.growlight_stand.watts;
  assert.deepEqual([...TUTORIAL_RULES.lampWattsByOrder], [bar, clip, stand],
    `와트 표가 기구 프리셋과 다릅니다 — 바 ${bar}W · 집게 ${clip}W · 거치 ${stand}W 여야 합니다`);
  /* 방 프로파일의 lampWatts[n] 은 "등 n개를 켰을 때의 와트 합"이다. 누계라 그대로 맞아야 한다 */
  PROFILE.lampWatts.forEach((w, n) => {
    assert.equal(lampWattsOn(TUTORIAL_RULES, n), w,
      `등 ${n}개 — 지갑은 ${lampWattsOn(TUTORIAL_RULES, n)}W, 방은 ${w}W 로 셉니다`);
  });
});

check('B-2 ★그래서 하루 요금이 방 조도 계약과 같아진다', () => {
  const tariff = PRESETS.tariff.krw_per_kwh;
  assert.equal(TUTORIAL_RULES.kwhWon, tariff,
    `단가가 갈렸습니다 — 지갑 ${TUTORIAL_RULES.kwhWon} vs 조도 계약 ${tariff}`);
  const ts = mk();
  for (const [n, h] of [[1, 12], [2, 12], [1, 24], [2, 24]]) {
    const roomWon = Math.round(PROFILE.lampWatts[n] / 1000 * h * tariff);   // room_profile.build §energy
    const walletWon = lampElectricityWon(ts, { count: n, litHours: h });
    assert.equal(walletWon, roomWon,
      `등 ${n}개 ${h}h — 화면 ${roomWon}원 vs 지갑 ${walletWon}원`);
  }
});

/* ══ C · 켠 만큼 낸다 ═══════════════════════════════════════════════════ */
check('C 켠 만큼 낸다 — 끄면 0 · 오래 켜면 그만큼 · 안 산 등은 0', () => {
  const off = mk(TUTORIAL_RULES, 0);
  assert.equal(lampElectricityWon(off, { count: 2, litHours: 24 }), 0, '안 산 등에 요금이 붙었습니다');
  const ts = mk();
  assert.equal(lampElectricityWon(ts, { count: 0, litHours: 24 }), 0, '껐는데 요금이 나갑니다');
  assert.ok(lampElectricityWon(ts, { count: 2, litHours: 24 }) >
            lampElectricityWon(ts, { count: 2, litHours: 12 }), '오래 켰는데 안 오릅니다');
  /* ★ 등마다 와트가 달라서 두 번째 등은 첫 번째보다 싸다 — 두 배면 다시 한 벌로 뭉갠 것이다 */
  const one = lampElectricityWon(ts, { count: 1, litHours: 12 });
  const two = lampElectricityWon(ts, { count: 2, litHours: 12 });
  assert.ok(two > one && two < one * 2,
    `등 2개가 ${two}원 — 1개(${one}원)의 두 배면 와트를 다시 뭉갠 것입니다`);
});

/* ══ D · 정본을 갈아 끼우면 실제로 값이 바뀐다 ═════════════════════════ */
check('D 정본 주입 — JSON 을 바꾸면 지갑이 따라온다', () => {
  const R = electricityRulesFrom({ kwhWon: 480, lamp: { hours: 24, wattsByOrder: [40, 24], priceWon: 25000 } });
  const ts = mk(R);
  assert.equal(lampElectricityWon(ts, { count: 2, litHours: 24 }),
    Math.round(64 / 1000 * 24 * 480), '주입한 값이 안 먹었습니다');
  /* 빈 JSON 은 기본값 그대로 — 없는 값을 지어내지 않는다 */
  const R0 = electricityRulesFrom(null);
  assert.equal(R0.kwhWon, TUTORIAL_RULES.kwhWon, '빈 정본이 값을 지어냈습니다');
});

/* ══ E · 누진 — 한계 단가로 센다 ═══════════════════════════════════════ */
check('E 누진 — 집이 원래 쓰는 몫 위에 얹히는 만큼만 낸다', () => {
  const tiers = [{ uptoKwhPerMonth: 200, won: 120 }, { uptoKwhPerMonth: 400, won: 214 }, { won: 307 }];
  const one = { kwhWon: 160, tariffTiers: null };
  /* base 가 1단계 한참 아래면 1단계 단가로만 센다 */
  const low = { ...TUTORIAL_RULES, tariffTiers: tiers, baseKwhPerMonth: 0 };
  assert.equal(Math.round(electricityWonOf(low, 1) * 30), Math.round(30 * 120),
    '1단계 안인데 1단계 단가가 아닙니다');
  /* base 가 이미 3단계면 전부 3단계 단가다 — 「많이 쓰면 비싸진다」가 여기서 산다 */
  const high = { ...TUTORIAL_RULES, tariffTiers: tiers, baseKwhPerMonth: 450 };
  assert.equal(Math.round(electricityWonOf(high, 1) * 30), Math.round(30 * 307),
    '3단계인데 3단계 단가가 아닙니다');
  assert.ok(electricityWonOf(high, 1) > electricityWonOf(low, 1),
    '★누진인데 많이 쓰는 집이 더 안 냅니다');
  /* 구간을 걸치면 나뉘어 센다 (base 390 + 30kWh → 10 은 2단계, 20 은 3단계) */
  const mid = { ...TUTORIAL_RULES, tariffTiers: tiers, baseKwhPerMonth: 390 };
  assert.equal(Math.round(electricityWonOf(mid, 1) * 30), Math.round(10 * 214 + 20 * 307),
    '구간을 걸친 몫이 안 나뉘었습니다');
  /* 누진을 안 켜면 예전 그대로 */
  assert.equal(electricityWonOf({ ...TUTORIAL_RULES, ...one }, 1), 160, '단일 단가가 안 맞습니다');
});

/* ══ F · 옛 규칙 사본 보호 — lampWatt 만 있는 판도 안 죽는다 ═══════════ */
check('F 옛 규칙 사본 — 와트 표가 없으면 lampWatt 로 돈다', () => {
  const old = { ...TUTORIAL_RULES, lampWattsByOrder: null, lampWatt: 12 };
  assert.equal(lampWattsOn(old, 2), 24, '옛 사본이 0W 로 떨어졌습니다');
  assert.equal(lampElectricityWon(mk(old), { count: 2, litHours: 12 }), 46, '옛 값이 안 나옵니다');
});

console.log('\nelec: ' + (fail ? `FAIL (${fail}건)` : 'PASS'));
process.exit(fail ? 1 : 0);
