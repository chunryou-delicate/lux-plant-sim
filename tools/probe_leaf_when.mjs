/* ============================================================
   probe_leaf_when.mjs — n번째 잎이 «언제» 오나 ([growth] 소유)
   ------------------------------------------------------------
   ★ 왜 이 자가 있나 (2026-08-23)
   "잎이 51일째 안 온다 — 느린 것 아닌가"를 판정하려면 «표대로면 언제인가»를
   먼저 내야 한다. 그걸 손으로 세다가 틀린다.

   ★ 반드시 지킬 것 넷
     ① 잎 간격은 **유효 생장일**이다. 달력일이 아니다
        박사님 확정(2026-08-09) 누적: 30 · 70 · 120 · 190 · 290 · 440 · 640 · 940
     ② 관문은 **7일 이동평균**이다. 하루값으로 재면 몇 배 틀린다
     ③ 게임 0일 = 연중 135일 (tutorial.yearDay0Of)
     ④ ★ 달력 하루가 유효 며칠인가는 **밴드**가 정한다(growth_tuning.growth_speed.by_band).
        slow=1.0 · best/good=1.25 · 그 아래는 0(정지). 상한은 GROWTH_STEPS_MAX=2

   ⚠ 이 자는 **빛만** 본다. 무늬 확률·형태 판정은 안 센다.

     FROM=89 EFF=70 node tools/probe_leaf_when.mjs
       FROM  세기 시작할 게임일 (앞 잎이 난 날)
       EFF   그 다음 잎까지 필요한 유효 생장일 (표에서 고른다)
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const P = J('data/profiles/room_profile.banjiha.json');
const TH = J('data/balance/light_thresholds.json');
const T  = TH.plants.monstera_deliciosa;
const GS = J('data/growth_tuning.json').growth_speed.by_band;
const light = createProfileLight({ ...P, uidStable: true },
  { thresholds: TH, weather: J('data/balance/weather.json'), electricity: J('data/balance/electricity.json') });
const SILL=process.env.SLOT||'banjiha-sill:0';
const FROM=Number(process.env.FROM||89), EFF=Number(process.env.EFF||70);
function bandOf(d){ if(d<T.die)return'critical'; if(d<T.survive)return'poor'; if(d<T.min)return'stagnant';
  if(d<T.best_lo)return'slow'; if(d<=T.best_hi)return'best'; if(d<=T.max)return'good'; return'over'; }
for (const [mode,lamps] of [['novice',0],['real',1],['real',3]]) {
  const hist=[]; let eff=0, gated=0, days=0, leaf4=null; const bands={};
  for (let d=1; d<=400; d++){
    const S={sim:{mode,yearDay0:135},lamps:{count:lamps,litHours:12},pots:[],placedItems:[]};
    const r=light.daily(d,S);
    const s=(r.report.slots||[]).find(x=>x.slotId===SILL); if(!s) continue;
    hist.push(s.dli||0); const w=hist.slice(-7), a=w.reduce((x,y)=>x+y,0)/w.length;
    if (d<FROM) continue;
    days++;
    const b=bandOf(a); bands[b]=(bands[b]||0)+1;
    const m=GS[b]??0;
    if (m<=0) gated++; else eff+=Math.min(m,2);
    if (leaf4===null && eff>=EFF) leaf4=d;
  }
  console.log(`[${mode} 등${lamps}] ${SILL} · d${FROM} 부터`);
  console.log(`   밴드: ${Object.entries(bands).map(([k,v])=>k+' '+v+'일').join(' · ')}`);
  console.log(`   관문 닫힘 ${gated}일 / ${days}일   유효일 누적 ${eff.toFixed(0)}`);
  console.log(`   ★ 다음 잎(${EFF} 유효일): ${leaf4?('게임일 '+leaf4+'  ⇒ 앞 잎으로부터 '+(leaf4-FROM)+'일'):'400일 안에 «안 온다»'}\n`);
}
