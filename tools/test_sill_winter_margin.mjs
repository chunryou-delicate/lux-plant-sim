/* ============================================================
   test_sill_winter_margin.mjs — 이 판에서 «제일 아슬한 수»를 지킨다 ([growth] 소유)
   ------------------------------------------------------------
   ★ 무엇을 지키나
   `banjiha-sill:0` · real · 등 1개 · 겨울 최저 7일평균 = **2.78**
   몬스테라 `min` = **2.7**  ⇒ 여유가 **0.08** 뿐이다.

   ★ 이 한 수에 걸린 것
     이 값이 2.7 아래로 내려가면 real 에서 몬스테라가 **겨울에 멈춘다.**
     그러면 넷째 잎이 안 오고 → 무늬 3장이 안 되고 → **이사비가 안 나온다.**
     ⇒ **판이 안 끝난다.** 등 없이는 400일에 유효 생장 19일뿐이다(§10.12).

   ⚠ 이 값은 «세 갈래»로 흔들린다. 어느 쪽도 이 자리를 겨누고 만지지 않는다:
     ① 문턱 `min` 을 올리면              (2026-08-17 에 3.0 → 2.7 로 내린 것이 real 을 살렸다. 우연이었다)
     ② 창턱 «좌표»를 옮기면              (2026-08-29: 격자에 붙이면 2.784 → 2.703. 여유가 0.003 이 된다)
     ③ 방 프로필·가구·등 자리가 바뀌면
   ⇒ ★ 셋 다 «남의 마당»이다. 그래서 **자를 여기 둔다.**

   ★★ 「넘느냐」만 보지 않는다 — «여유»를 찍는다.
     2.703 도 2.7 을 «넘는다». 그런데 그건 설계가 아니라 «운»이다.
     그래서 여유가 GUARD 아래로 얇아지면 붉히지는 않되 **크게 말한다.**
     ⚠ GUARD 는 밸런스 값이 아니라 [growth] 가 고른 «자의 눈금»이다. 게임은 이걸 안 읽는다.

     node tools/test_sill_winter_margin.mjs
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { yearDay0Of, TUTORIAL_RULES as TR } from '../src/game/tutorial.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const SILL = 'banjiha-sill:0';
const GUARD = 0.05;                       // ★ 자의 눈금. 밸런스 값이 아니다

const P  = J('data/profiles/room_profile.banjiha.json');
const TH = J('data/balance/light_thresholds.json');
const MIN = TH.plants.monstera_deliciosa.min;
const light = createProfileLight({ ...P, uidStable: true },
  { thresholds: TH, weather: J('data/balance/weather.json'),
    electricity: J('data/balance/electricity.json') });

const rev = String(P.roomRev || '').split(' ')[0] || '?';
console.log('══ 창턱 겨울 여유 — 이 판에서 제일 아슬한 수');
console.log(`   [real · 등 1개 · ${SILL} · 400일 · 프로필 ${rev}]`);
console.log(`   몬스테라 min = ${MIN}\n`);

const hist = [];
let min7 = Infinity, minDay = null;
for (let d = 1; d <= 400; d++) {
  const S = { sim: { mode: 'real', yearDay0: yearDay0Of(TR) },
              lamps: { count: 1, litHours: 12 }, pots: [], placedItems: [] };
  const s = (light.daily(d, S).report.slots || []).find(x => x.slotId === SILL);
  if (!s) continue;
  hist.push(s.dli || 0);
  if (d < 7) continue;
  const a = hist.slice(-7).reduce((x, y) => x + y, 0) / 7;
  if (a < min7) { min7 = a; minDay = d; }
}

let fail = 0;
const margin = min7 - MIN;
console.log(`   연중 최저 7일평균  ${min7.toFixed(3)}  (게임일 ${minDay})`);
console.log(`   여유              ${margin >= 0 ? '+' : ''}${margin.toFixed(3)}\n`);

if (min7 >= MIN) {
  console.log(`PASS  창턱이 겨울에 문턱을 넘는다 (${min7.toFixed(3)} >= ${MIN})`);
} else {
  fail++;
  console.log(`FAIL  ⛔ 창턱이 겨울에 문턱 «아래»다 (${min7.toFixed(3)} < ${MIN})`);
  console.log(`      ⇒ real 에서 몬스테라가 겨울에 멈춘다. 넷째 잎이 안 오고 이사비가 안 나온다.`);
  console.log(`      ⇒ 판이 «안 끝난다». 무엇을 만졌는지 보라 — 문턱 · 창턱 좌표 · 방 프로필.`);
}

if (min7 >= MIN && margin < GUARD) {
  console.log(`\n⚠⚠ 여유가 ${margin.toFixed(3)} 뿐이다 (자의 눈금 ${GUARD} 아래).`);
  console.log(`    넘기는 넘지만 «설계»가 아니라 «운»이다. 날씨 난수 하나에 뒤집힌다.`);
  console.log(`    ⇒ 이 값을 얇게 만든 변경을 되돌릴지 박사님께 여쭈라. 붉히지는 않는다.`);
}

console.log(`\nsill_winter_margin: ${fail ? 'FAIL' : 'PASS'}`);
process.exitCode = fail ? 1 : 0;
