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

   ★★ 2026-09-07 · DLI= 손잡이를 달았다. 왜 필요했나:
     «바닥»은 프로필의 열다섯 칸에 **없다**(자리는 전부 가구에 붙어 있다).
     그래서 바닥 값은 라이브 `dliAt` 으로 따로 재야 하는데, 그 수를 손에 들고
     「1.44 는 2.7 보다 작으니 0 이다」로 «셈»만 하면 그건 잰 것이 아니다.
     ⇒ 그래서 «잰 수를 그대로 태우는» 길을 냈다. 이름:값 을 콤마로 준다.
       DLI='바닥한가운데:0.27,바닥최고:1.44' node tools/probe_first_leaf.mjs
     ⚠ novice 는 날씨가 고정이라 하루 값이 상수다. 그래서 상수를 먹여도 옳다.
       real 에는 쓰지 마라 — 계절이 도는데 상수를 먹이면 거짓이 된다.

   ⚠⚠ `die` 는 밴드 «이름»일 뿐이고 **죽이지 않는다.** 이 자도 죽음을 안 센다.
     loop.js:17   「band === 'critical' 로 죽이는 코드는 절대 넣지 않는다」
     headroom.js:5「죽지 않는다. 시들지도 않는다. 그냥 멈춘다. 옮기면 다시 자란다」
     ⇒ 「die 아래」를 「죽는다」로 읽지 마라. 2026-09-07 에 내가 그렇게 읽어서 틀렸다.
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
/* DLI= 를 주면 «프로필 자리» 대신 «준 상수»를 태운다 (바닥처럼 자리 목록에 없는 데) */
const FIXED = process.env.DLI
  ? process.env.DLI.split(',').map(t => { const i = t.lastIndexOf(':');
      return { slotId: t.slice(0,i).trim(), fixed: Number(t.slice(i+1)) }; })
  : null;
if (FIXED) console.log('⚠ DLI= 로 «잰 상수»를 태웁니다 — 등 개수는 그 상수에 이미 들어 있습니다\n');
for (const mode of MODES) for (const lamps of (FIXED ? [0] : LAMPS)) {
  console.log(FIXED ? `[${mode} «잰 상수»]   자리                     하루 DLI   밴드      첫 잎` : `[${mode} 등${lamps}개]   자리          7일평균(놓인 뒤)   밴드      첫 잎`);
  let any = 0;
  const TARGETS = FIXED ? FIXED.map(f => f.slotId) : P.slots.map(s => s.slotId);
  for (const slot of TARGETS) {
    const fixedOf = FIXED ? FIXED.find(f => f.slotId === slot).fixed : null;
    const hist = []; let g = 0, leafDay = null, bandSeen = {}, avgSum = 0, avgN = 0;
    for (let d = 1; d <= DAYS; d++) {
      const S = { sim:{mode, yearDay0:135}, lamps:{count:lamps, litHours:12}, pots:[], placedItems:[] };
      let dayDli;
      if (fixedOf !== null) dayDli = fixedOf;
      else {
        const r = light.daily(d, S);
        const s = (r.report.slots||[]).find(x => x.slotId === slot); if (!s) continue;
        dayDli = s.dli || 0;
      }
      hist.push(dayDli);
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
  console.log(`   ⇒ ★ 첫 잎이 «나는» 자리 ${any}/${TARGETS.length}\n`);
}
