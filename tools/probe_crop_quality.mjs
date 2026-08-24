/* ============================================================
   probe_crop_quality.mjs — 자리마다 «실제로 잡히는 작물 품질»을 센다 ([growth] 소유)
   ------------------------------------------------------------
   ★ 왜 이 자가 있나 (2026-08-23)
   작물 셈(시루 1개 = 하루 600원 …)에 «품질표»가 안 들어가 있었다. 품질은 자리가
   정하는데, 자리마다 얼마가 잡히는지 아무도 안 재 봤다.

   ★ 반드시 지킬 것 넷
     ① 등급이 먹는 값은 peak 도 7일평균도 «아니다» — 자라는 **harvestDays 동안의
        하루 조도 평균**이다(first_play.js:2442 `dliHist` 평균 → cropQualityOf).
        ⇒ 콩나물 5일 · 무순 7일. 작물마다 자가 다르다
     ② 게임 0일 = 연중 135일 (tutorial.yearDay0Of)
     ③ ★ 콩나물은 **어두울수록** 좋고(maxDli 0.3) 무순은 **밝을수록** 좋다(minDli 0.35).
        한 표로 둘을 읽으면 반대로 읽는다
     ④ ⚠ 이 자는 «이름 붙은 자리»만 본다. 바닥(자유 좌표)은 못 잰다 —
        정적 프로필에 임의 좌표 표가 없다. 바닥은 tools/probe_floor_dli.mjs 로

     node tools/probe_crop_quality.mjs
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { cropQualityOf, cropKindOf } from '../src/game/first_play.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const P = J('data/profiles/room_profile.banjiha.json');
const light = createProfileLight({ ...P, uidStable: true },
  { thresholds: J('data/balance/light_thresholds.json'),
    weather: J('data/balance/weather.json'), electricity: J('data/balance/electricity.json') });
const IDS = P.slots.map(s => s.slotId);
/* ★ 3단 선반은 «단»이 등급을 가른다 — 이름을 붙여 둔다(2026-08-24 박사님 물음) */
const TIER = {};
for (const s of P.slots) {
  if (!/etagere/.test(s.slotId)) continue;
  const y = (s.point && s.point.y) ?? 0;
  TIER[s.slotId] = y < 0.2 ? '아랫단' : y < 0.6 ? '가운뎃단' : '윗단';
}

for (const kind of ['beansprout','musun']) {
  const HD = cropKindOf(kind).harvestDays;
  for (const [mode,lamps] of [['novice',0],['real',0],['real',1]]) {
    const hist={}; const tally={};
    IDS.forEach(id=>{hist[id]=[];tally[id]={};});
    for (let d=1; d<=400; d++){
      const S={sim:{mode,yearDay0:135},lamps:{count:lamps,litHours:12},pots:[],placedItems:[]};
      for (const s of (light.daily(d,S).report.slots||[])){
        const h=hist[s.slotId]; if(!h) continue;
        h.push(s.dli||0);
        if (h.length>=HD){ const w=h.slice(-HD);
          const q=cropQualityOf(kind, w.reduce((a,b)=>a+b,0)/w.length);
          tally[s.slotId][q.meals]=(tally[s.slotId][q.meals]||0)+1; }
      }
    }
    const N = 400-HD+1;
    console.log(`\n[${cropKindOf(kind).ko} · ${mode} 등${lamps}]  (자라는 ${HD}일 평균 → 품질)  ${N}주기`);
    let zero=0;
    for (const id of IDS){
      const t=tally[id]; const best=((t[3]||0)/N*100), mid=((t[2]||0)/N*100), low=((t[1]||0)/N*100);
      const g = (t[3]||0)*500 + (t[2]||0)*350 + (t[1]||0)*200;
      if (g/N <= 0) zero++;
      console.log('   '+id.padEnd(21)+(TIER[id]||'').padEnd(8)+'3끼 '+best.toFixed(0).padStart(3)
        +'% · 2끼 '+mid.toFixed(0).padStart(3)+'% · 1끼 '+low.toFixed(0).padStart(3)
        +'%   평균 '+(g/N).toFixed(0).padStart(3)+'g');
    }
    /* ★★ 「최상 칸 수」와 「놓을 수 있는 칸 수」는 «다르다» — 이 줄이 그것을 가른다.
       2026-08-24 에 「무순 최상은 창턱뿐」이 「무순은 창턱에서만 자란다」로 읽혔다. */
    console.log('   ⇒ ★ 0g 인 칸 '+zero+'/'+IDS.length+' — 0 이 아니면 «자란다». 품질만 다르다');
  }
}
