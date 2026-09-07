/* ============================================================
   probe_first_leaf.mjs — 「첫 잎이 나는 데 며칠인가」 ([growth] 소유)
   ------------------------------------------------------------
   ★ 2026-09-07 · [leaf] 가 물어서 만들었다.
     [leaf] 가 폰으로 걸었더니 «반지하 · 등 없음 · 창턱 아님» 에서 54일에 잎이 0장이었다.
     ⇒ 총괄 물음: 「느린 것인가, 아예 안 나는 것인가」. 그 둘은 사람에게 아주 다르다.

   ⚠ 자 셋 중 «몬스테라 7일 이동평균» 을 쓴다. 콩나물(5일)·무순(7일)과 섞지 마라.
   ⚠ 첫 잎은 누적 GROWTH «30» 이다. leaf_interval 의 30 은 «사이»가 아니라 «첫째»다.
   ⚠ ★★ 모드를 꼭 같이 읽어라 — novice(여름·맑음 고정, 첫 플레이)와 real(계절이 돈다)은
     아예 다른 표다. [leaf] 가 걸은 것은 «첫 플레이» 이므로 novice 다.

   ⛔ 이 자는 «재기만» 한다. 갈래 수·확률·일수는 박사님 것이다.

     ROOM=banjiha LAMPS=0,1 FROM=11 node tools/probe_first_leaf.mjs
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const ROOM = process.env.ROOM || 'banjiha';
const P  = J(`data/profiles/room_profile.${ROOM}.json`);
const TH = J('data/balance/light_thresholds.json');
const T  = TH.plants.monstera_deliciosa;
const GS = J('data/growth_tuning.json').growth_speed.by_band;
const STEP_MAX = J('data/growth_tuning.json').growth_speed.GROWTH_STEPS_MAX ?? 2;
const light = createProfileLight({ ...P, uidStable: true },
  { thresholds: TH, weather: J('data/balance/weather.json'), electricity: J('data/balance/electricity.json') });
const FROM  = Number(process.env.FROM || 11);      // 그루가 방에 놓이는 게임일
const FIRST = Number(process.env.FIRST || 30);     // 첫 잎의 누적 GROWTH
const DAYS  = Number(process.env.DAYS || 400);
const LAMPS = (process.env.LAMPS || '0').split(',').map(Number);
const MODES = (process.env.MODES || 'novice,real').split(',');
function bandOf(d){ if(d<T.die)return'critical'; if(d<T.survive)return'poor'; if(d<T.min)return'stagnant';
  if(d<T.best_lo)return'slow'; if(d<=T.best_hi)return'best'; if(d<=T.max)return'good'; return'over'; }
console.log(`══ 첫 잎까지 며칠인가 — 방 «${ROOM}» · 그루는 게임일 ${FROM} 에 놓인다`);
console.log(`   ⚠ 첫 잎 = 누적 GROWTH ${FIRST} · 몬스테라 7일 이동평균 · ${DAYS}일까지 본다`);
console.log(`   ⚠ 모드를 표에서 떼지 마라 — novice=여름·맑음 고정(첫 플레이) · real=계절이 돈다\n`);
for (const mode of MODES) for (const lamps of LAMPS) {
  console.log(`[${mode} 등${lamps}개]   자리          7일평균(놓인 뒤)   밴드      첫 잎`);
  let any = 0;
  for (const slot of P.slots.map(s => s.slotId)) {
    const hist = []; let g = 0, leafDay = null, bandSeen = {}, avgSum = 0, avgN = 0;
    for (let d = 1; d <= DAYS; d++) {
      const S = { sim:{mode, yearDay0:135}, lamps:{count:lamps, litHours:12}, pots:[], placedItems:[] };
      const r = light.daily(d, S);
      const s = (r.report.slots||[]).find(x => x.slotId === slot); if (!s) continue;
      hist.push(s.dli || 0);
      const w = hist.slice(-7), a = w.reduce((x,y)=>x+y,0)/w.length;
      if (d < FROM) continue;
      avgSum += a; avgN++;
      const b = bandOf(a); bandSeen[b] = (bandSeen[b]||0)+1;
      const m = GS[b] ?? 0;
      if (m > 0) g += Math.min(m, STEP_MAX);
      if (leafDay === null && g >= FIRST) leafDay = d;
    }
    const avg = avgN ? (avgSum/avgN) : 0;
    const topBand = Object.entries(bandSeen).sort((x,y)=>y[1]-x[1])[0];
    const ans = leafDay
      ? `게임일 ${leafDay}  ⇒ 놓인 지 ${leafDay-FROM}일`
      : `⛔ ${DAYS}일에도 «안 난다» (누적 ${g.toFixed(0)}/${FIRST})`;
    if (leafDay) any++;
    console.log(`   ${slot.padEnd(22)}${avg.toFixed(2).padStart(6)}   ${(topBand?topBand[0]:'-').padEnd(9)} ${ans}`);
  }
  console.log(`   ⇒ ★ 첫 잎이 «나는» 자리 ${any}/${P.slots.length}\n`);
}
