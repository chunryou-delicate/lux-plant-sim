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
  /* ★★ 2026-08-23 — **등 값 배열이 빠져 있었다** ([growth] 가 §8-3 재측정에서 찾음).
     이 검사가 여섯 칸을 보는데 `lamp.pricesByOrder` 만 안 봤다. 지금은 같지만
     **집게등·거치등 값이 갈리면 아무도 안 잡았다** — 사는 값과 파는 값이 다른 판이 된다.
     ⚠ 「틀렸다」가 아니라 **어느 등이 얼마로 갈렸는지** 찍는다. 안 그러면 고칠 자리를 또 찾아야 한다. */
  {
    const code = [...(TUTORIAL_RULES.lampPricesWon || [])];
    const canon = [...(BAL.lamp.pricesByOrder || [])];
    const n = Math.max(code.length, canon.length);
    const bad = [];
    for (let i = 0; i < n; i++)
      if (code[i] !== canon[i])
        bad.push(`${i + 1}번째 등 — 코드 ${code[i] === undefined ? '없음' : code[i].toLocaleString() + '원'}` +
                 ` / 정본 ${canon[i] === undefined ? '없음' : canon[i].toLocaleString() + '원'}`);
    assert.equal(bad.length, 0,
      `lampPricesWon 이 electricity.json lamp.pricesByOrder 와 갈렸습니다 — ${bad.join(' · ')}`);
    assert.equal(code.length, canon.length,
      `등 값 개수가 다릅니다 — 코드 ${code.length}개 / 정본 ${canon.length}개`);
  }
  assert.deepEqual([...TUTORIAL_RULES.lampWattsByOrder], [...BAL.lamp.wattsByOrder],
    'lampWattsByOrder 가 갈렸습니다');
  assert.equal(TUTORIAL_RULES.tariffTiers, BAL.tiers, 'tariffTiers 가 갈렸습니다');
  assert.equal(TUTORIAL_RULES.baseKwhPerMonth, BAL.baseKwhPerMonth, 'baseKwhPerMonth 가 갈렸습니다');
});

/* ══ B · ★와트가 기구·방과 같은가 — 이게 이번에 고친 그 버그다 ══════════ */
check('B ★와트 — 기구 프리셋 · 방 프로파일 · 지갑이 같은 값을 본다', () => {
  /* ★★★ 2026-08-23 — **기구 이름 셋을 손으로 적던 자리를 없앴다** ([growth]).
     예전에는 `growlight_bar`·`growlight_clip`·`growlight_stand` 를 여기 박아 두고 견줬다.
     그래서 2026-08-17 에 셋째 등이 들어왔을 때 **이 줄만 둘을 기다려 FAIL** 을 냈다 —
     코드 셋은 아귀가 맞는데 자가 낡아서 **멀쩡한 코드를 빨갛게 찍었다.** 그 붉은 줄을 보고
     `lampWattsByOrder` 에서 36 을 빼면 **거치등 전기세가 통째로 사라진다.** 검사가 사고를 만드는 자리였다.
     ⇒ 이제 **기구 표에서 「식물등인 것」을 세어** 견준다. 넷째 등이 들어와도 이 줄은 안 고친다.
       · 개수 — 프리셋의 `grow:true` 개수 = 와트 표 길이
       · 값   — 두 쪽의 와트 **묶음**이 같다 (순서는 아래 방 프로파일이 정한다)
       · 순서 — `PROFILE.lampWatts` 누계가 정본이다. 여기서 새로 정하지 않는다
     ⚠ 프리셋의 `price`(18,000·34,000·72,000)는 **실제 기구 소매가**라 게임 구매가
       (`lampPricesWon` 120,000·80,000·150,000)와 **다른 값이다.** 같은 것으로 보고 묶지 말 것. */
  const grow = Object.entries(PRESETS.fixtures).filter(([, v]) => v.grow === true);
  assert.ok(grow.length > 0, 'lighting_presets.json 에 grow:true 인 기구가 없습니다');
  const table = [...TUTORIAL_RULES.lampWattsByOrder];
  assert.equal(table.length, grow.length,
    `식물등 개수가 다릅니다 — 기구 표 ${grow.length}개(${grow.map(([k]) => k).join(', ')}) / ` +
    `와트 표 ${table.length}개(${table.join('·')}W). 등이 늘었으면 lampWattsByOrder 도 늘려야 합니다`);
  const sortNum = a => [...a].sort((x, y) => x - y);
  const presetWatts = grow.map(([, v]) => v.watts);
  assert.deepEqual(sortNum(table), sortNum(presetWatts),
    `와트가 기구 프리셋과 다릅니다 — 기구 ` +
    grow.map(([k, v]) => `${k} ${v.watts}W`).join(' · ') + ` / 와트 표 ${table.join('·')}W`);
  /* 방 프로파일의 lampWatts[n] 은 "등 n개를 켰을 때의 와트 합"이다. 누계라 그대로 맞아야 한다.
     ★ 길이도 본다 — 등이 늘었는데 프로파일만 안 늘면 아래 forEach 가 **새 등을 아예 안 돈다**
       (없는 것을 「없다」로 읽는 자리다 · §2.9 ①). 그래서 개수부터 못박는다. */
  assert.equal(PROFILE.lampWatts.length, table.length + 1,
    `방 프로파일 lampWatts 가 ${PROFILE.lampWatts.length}칸인데 등은 ${table.length}개입니다 — ` +
    `[0개, 1개, …, ${table.length}개] 로 ${table.length + 1}칸이어야 합니다`);
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
