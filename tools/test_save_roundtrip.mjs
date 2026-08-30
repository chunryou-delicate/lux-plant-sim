/* ============================================================
   tools/test_save_roundtrip.mjs — **세이브에 «안 실리는» 상태 칸을 센다**
   ------------------------------------------------------------
   왜 이 자가 생겼나 — 2026-08-30 하루에 «같은 모양»의 탈을 다섯 번 잡았다:

     ① 얼린 표가 두 벌인데 한 벌만 갱신됐다                      (House)
     ② coachPending 이 세이브에 안 실려 새로고침에 사라졌다        (core)
     ③ furnitureSold 를 세이브를 «읽을 때» 방에 안 얹었다          (core)
     ④ pots[].placedOnce 가 세이브에 «안 실려» 가방 속 그루가 방에 섰다 (core)
     ⑤ 판 가구가 새로 켜면 되살아났다(③의 화면 쪽)                 (core)

   ⇒ 다섯 다 **「한 쪽만 손댔다」**이고, 셋은 **「상태에는 있는데 세이브에 없다」**였다.
   ⇒ ⇒ 그리고 셋 다 «사람이 눌러서» 찾았다. **자가 못 잡고 있었다.**

   ★ 이 자가 하는 일 — 상태를 하나 지어 **serialize → deserialize** 로 왕복시키고,
     원본에 있던 값이 «사라졌거나 달라진» 자리를 **경로로** 찍는다.
     `pots[0].placedOnce: false → (없음)` 처럼 나온다.

   ⚠ 「달라지는 것이 옳은」 자리가 있다 — 아래 §봐주는 자리에 **까닭과 함께** 적는다.
     까닭 없이 늘리지 말 것. 그 표가 길어지는 것이 곧 이 자가 눈감는 크기다.

   ⛔ 이 자는 값(밸런스)을 하나도 안 본다. 「무엇이 살아남나」만 본다.

     node tools/test_save_roundtrip.mjs
============================================================ */
import assert from 'node:assert/strict';
import { newState, pushLog } from '../src/game/state.js';
import { serialize, deserialize } from '../src/game/save.js';
import { firstPlayRulesFromBalance } from '../src/game/first_play.js';
import { nullGrowth } from '../src/game/sim.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FP_RULES = firstPlayRulesFromBalance(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'data/balance/characters.json'), 'utf8')));

/* 조도 창 흉내 — 방을 짓고 자리를 낸다. 값은 안 쓴다(자리 이름만 쓴다) */
function stubLight(slotIds) {
  const slots = slotIds.map((id, i) => ({ slotId: id, x: i * 0.3, y: 1.0, z: 0, maxPotD: 0.4 }));
  const room = () => ({ id: 'banjiha', slots, size: { w: 6, d: 5, h: 2.5 },
                        surfaces: new Set(slotIds.map(s => String(s).split(':')[0])) });
  return { build() { return room(); }, clearCache() {}, setFurnitureOverrides() {},
           setFurnitureEdits() {}, setLampAims() {}, lampList() { return []; },
           furnitureList() { return []; }, get room() { return room(); } };
}
/* 생장 창 흉내 — **계약은 `sim.nullGrowth` 것을 그대로 쓴다.**
   ⚠ 손으로 흉내 내다가 `setDailyLight` 하나를 빠뜨려 복원이 통째로 던졌다.
     이미 있는 것을 쓰면 그 계약이 늘어도 이 자가 안 낡는다(㊺). */
const stubGrowth = () => nullGrowth(14);

/* ── 왕복시킬 판을 짓는다 ────────────────────────────────────────────────
   ★ 「그 칸이 있나」를 보는 자라 **값은 아무거나**여도 된다. 다만 **빈 값은 안 된다** —
     비어 있으면 사라져도 표가 안 난다. 그래서 칸마다 눈에 띄는 값을 하나씩 넣는다. */
function makeRich() {
  const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: FP_RULES });
  S.day = 12;
  /* 화분 — ★ placedOnce:false 가 이 자를 만들게 한 그 칸이다(2026-08-30) */
  S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: null, at: null,
                placedOnce: false, variegated: true, daysPlanted: 9, fedDays: 9,
                arrivedOnDay: 3, wateredOnDay: 11, arrivalGrowthDays: 45, growthId: '__main__' });
  /* 집 — 가구를 팔고 · 사서 놓고 · 가방에 담은 셋
     ★★ 2026-08-30 [House] 가 다섯을 세게 했다. 까닭을 하나씩 적는다:
       ① «둘 이상» 넣는다 — 하나만 넣으면 「둘째 칸이 사라지는」 것을 못 잡는다
       ② 좌표를 «어림수로 안 쓴다» — 실제 값은 0.047 · −2.03 · −3.83 같은 것이다.
          1.0 · −1.5 만 넣으면 «반올림하는 저장»을 못 잡는다
       ③ ★ `furnitureAdded` 가 `x:0, z:0, rot:0` 이었다 — 위 머리말이 «바로 그것»을
          경계하는데(「비어 있으면 사라져도 표가 안 난다」) 0 을 넣어 뒀다. 0 은 사라져도 0 이다
       ④ `rot` 에 «음수»와 «0 아닌 여러 값» — 부호를 잃는 저장을 잡는다
       ⑤ `aim` 을 «등 둘»에, «음수 yaw» 로 — 겨누기는 −180~180 을 쓴다(growlight_aim §2) */
  S.home.furniture = {
    'banjiha-desk':    { x: 1.047, z: -1.503, rot: 90 },
    'banjiha-etagere': { x: -2.375, z: -1.875, rot: -90 }
  };
  S.home.furnitureSold = ['banjiha-dresser', 'banjiha-chair'];
  S.home.furnitureAdded = [
    { uid: 'add-bed_single-1', preset: 'bed_single', x: -3.83, z: 2.03, rot: 180 },
    { uid: 'add-shelf_cart_3tier-2', preset: 'shelf_cart_3tier', x: 0.047, z: -2.03, rot: -45 }
  ];
  S.home.furnitureBag = [
    { uid: 'banjiha-nightstand', preset: 'nightstand' },
    { uid: 'banjiha-growlight-clip', preset: 'growlight_clip' }
  ];
  /* 등 — 산 개수와 겨눔 (★ 둘에, 음수 yaw 로) */
  S.lamps.count = 2; S.lamps.litHours = 12;
  S.lamps.aim = {
    'banjiha-growlight-stand': { yaw: 15, tilt: 30 },
    'banjiha-growlight-clip':  { yaw: -37.5, tilt: 12.25 }
  };
  /* 지갑·배움 */
  S.tutorial.cashWon = 1234500;
  S.tutorial.lamp = { ...(S.tutorial.lamp || {}), unlocked: true, owned: 2, placed: 1 };
  /* ⚠ 모양을 «지어내지» 않는다 — 정본은 `tutorial.createVarieLeafState()` 다({ever, firstDay, where}).
     처음에 여기 `count`·`firstOnDay` 를 적었다가 이 자가 「사라졌다」고 잡았다. 사라진 게 아니라
     **애초에 없는 칸**이었다. ⇒ 자가 «내가 지어낸 칸»까지 잡아 준 셈이다. */
  S.tutorial.varieLeaf = { ever: true, firstDay: 7, where: 'pot_01' };
  pushLog(S, '자를 위한 줄');
  return S;
}

/* ── 두 판을 걸어서 견준다 ──────────────────────────────────────────────
   원본에 값이 있는데 왕복한 쪽에서 **사라졌거나 달라진** 경로를 모은다.
   ⚠ 배열은 «길이»와 «칸별»로 본다 — 길이만 보면 알맹이가 바뀐 것을 놓친다. */
function diff(a, b, at = '', out = []) {
  const kind = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
  const ka = kind(a), kb = kind(b);
  if (ka === 'object' && kb === 'object') {
    for (const k of Object.keys(a)) diff(a[k], b[k], at ? `${at}.${k}` : k, out);
    return out;
  }
  if (ka === 'array' && kb === 'array') {
    if (a.length !== b.length) out.push({ at: at + '.length', was: a.length, now: b.length });
    for (let i = 0; i < a.length; i++) diff(a[i], b[i], `${at}[${i}]`, out);
    return out;
  }
  if (ka !== kb || (ka !== 'object' && ka !== 'array' && a !== b))
    out.push({ at, was: a, now: b === undefined ? '(없음)' : b });
  return out;
}

/* ── §봐주는 자리 — «달라지는 것이 옳은» 경로. 까닭 없이 늘리지 말 것 ─────── */
const OK_TO_DIFFER = [
  [/^log(\[|\.length)/,          '로그는 마지막 200줄만 싣는다(save §LOG_KEEP) · 복원이 제 줄을 더 적는다'],
  [/^log$/,                      '위와 같다'],
  [/^savedAt|^appVersion/,       '저장할 때 찍는 것이라 원본에 없다'],
  [/^growth/,                    '형태는 생장 창이 갖는다 — 코어가 안 싣는다(save 머리말 §growth)'],
  [/^pots\[\d+\]\.dliHist/,      '빛 이력은 대표 칸(dliHist)으로 따로 실린다'],
  [/^dliHist/,                   '위와 같다 — 복원이 다시 건다'],
  [/^firstPlay\.rules/,          '밸런스 계약은 파일이 정본이라 복원 때 다시 읽는다'],
  [/^tutorial\.rules/,           '위와 같다'],
  [/^story\.schema|^firstPlay\.schema|^schema/, '판 번호는 봉투가 들고 있다']
];
const forgiven = (p) => OK_TO_DIFFER.find(([re]) => re.test(p));

const S = makeRich();
const before = JSON.parse(JSON.stringify(S));
const raw = JSON.stringify(serialize(S));
const S2 = deserialize(raw, { light: stubLight(['banjiha-sill:0', 'banjiha-desk:0']),
                              growth: stubGrowth(), firstPlayRules: FP_RULES });
const after = JSON.parse(JSON.stringify(S2));

const all = diff(before, after);
const lost = all.filter(d => !forgiven(d.at));
const seen = all.filter(d => forgiven(d.at));

console.log('══ 세이브 왕복 — 살아남지 못한 칸 ═══════════════════════════════');
for (const d of lost) console.log(`  ✘ ${d.at}: ${JSON.stringify(d.was)} → ${JSON.stringify(d.now)}`);
if (!lost.length) console.log('  ✔ 없다 — 넣은 칸이 전부 살아 돌아왔습니다');
console.log(`\n  · 봐준 자리 ${seen.length}건 (§봐주는 자리에 까닭이 적혀 있다)`);
for (const d of seen.slice(0, 6)) console.log(`      ~ ${d.at} — ${forgiven(d.at)[1]}`);
if (seen.length > 6) console.log(`      … 그 밖 ${seen.length - 6}건`);

/* ★ 그리고 **이 자가 떨어질 수 있나**를 같이 보인다 — 안 떨어지는 자는 자가 아니다.
   일부러 한 칸을 빼고 돌려, 그 자리가 «잡히는지» 확인한다. */
{
  const probe = makeRich();
  const rawP = JSON.parse(JSON.stringify(serialize(probe)));
  delete rawP.state.pots[0].placedOnce;                       // 2026-08-30 에 실제로 없던 그 칸
  const back = deserialize(JSON.stringify(rawP),
    { light: stubLight(['banjiha-sill:0']), growth: stubGrowth(), firstPlayRules: FP_RULES });
  const caught = diff(JSON.parse(JSON.stringify(probe)), JSON.parse(JSON.stringify(back)))
    .filter(d => !forgiven(d.at)).some(d => /placedOnce/.test(d.at));
  console.log(`\n  ★ 자가 떨어질 수 있나 — placedOnce 를 빼 보면: ${caught ? '✔ 잡는다' : '✘ 못 잡는다'}`);
  assert.ok(caught, '이 자는 빠진 칸을 못 잡습니다 — 자가 장식이 됩니다');
}

/* ★★ 2026-08-30 [House] — «내 칸»에서도 떨어지나. 남의 칸으로만 확인된 자는 내 것을 안 지킨다.
   ⇒ 셋을 따로 본다: ① 둘째 칸이 사라짐 ② 좌표가 반올림됨 ③ 겨눔의 부호가 뒤집힘
   ⚠ 그리고 이 셋은 «실제로 날 수 있는» 모양이다 —
     ① 배열을 `[0]` 만 싣는 packer · ② `toFixed(1)` 을 끼운 packer · ③ Math.abs 가 섞인 packer */
for (const [name, hurt, pat] of [
  ['둘째 가구가 사라짐',
   raw => { raw.state.home.furnitureAdded.length = 1; },              /paletteX|furnitureAdded/],
  ['가구 좌표가 반올림됨',
   raw => { raw.state.home.furniture['banjiha-desk'].x = 1.0; },      /home\.furniture/],
  ['겨눔 yaw 의 부호가 뒤집힘',
   raw => { raw.state.lamps.aim['banjiha-growlight-clip'].yaw *= -1; }, /lamps\.aim/]
]) {
  const probe = makeRich();
  const rawP = JSON.parse(JSON.stringify(serialize(probe)));
  hurt(rawP);
  let got = false;
  try {
    const back = deserialize(JSON.stringify(rawP),
      { light: stubLight(['banjiha-sill:0']), growth: stubGrowth(), firstPlayRules: FP_RULES });
    got = diff(JSON.parse(JSON.stringify(probe)), JSON.parse(JSON.stringify(back)))
      .filter(d => !forgiven(d.at)).some(d => pat.test(d.at));
  } catch (e) { got = true; }   /* 세이브 계통이 «던져서» 막아도 잡은 것이다 */
  console.log(`  ★ 내 칸에서도 — ${name}: ${got ? '✔ 잡는다' : '✘ 못 잡는다'}`);
  assert.ok(got, `이 자가 «${name}» 을 못 잡습니다 — [House] 칸이 안 지켜집니다`);
}

console.log('');
assert.equal(lost.length, 0,
  `세이브에 안 실리는 칸이 ${lost.length}개 있습니다 — save.js 에 저장 방법을 정하거나, ` +
  '달라지는 것이 옳으면 §봐주는 자리에 **까닭과 함께** 적어 주세요');
console.log('save_roundtrip: PASS');
