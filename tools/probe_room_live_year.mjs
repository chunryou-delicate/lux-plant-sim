/* ============================================================
   probe_room_live_year.mjs — 프로필이 «낡았을 때» 400일을 재는 자 ([growth] 소유)
   ------------------------------------------------------------
   ★ 왜 이 자가 있나 (2026-08-30)

   [House] 가 가구·등을 옮기면 `data/profiles/*.json` 은 «다시 뽑기 전»까지 낡는다.
   그 사이에 정적 프로필로 재면 ⇒ ⛔ **옛 자리를 재고도 「쟀다」고 말하게 된다.**
   실제로 원룸 등을 옮긴 뒤 15칸이 «전부» 달랐다(등0 은 같고 등1·등2 만).

   ★ 그래서 «둘을 갈라» 쓴다:
     자연광 · 등 몫  →  ★ 라이브(브라우저 `io.light`)에서 뽑는다. 가구가 바뀌면 여기가 바뀐다
     날씨 흐름       →  정적 엔진에서 쓴다. ★ 기하와 «무관»하다

   ⚠ 반드시 지킬 것 넷 (머리표)
     ① 모드 real · ② 등 개수 · ③ 판정은 «7일 이동평균» · ④ 어느 방·어느 등 자리인가
     ★⑤ **등 DLI 에는 날씨 계수를 «안» 곱한다** — 엔진이 그렇게 돈다(400일 훑어 확인:
        자연광은 날씨마다 12가지인데 등은 «1가지»). 밖에서 ×0.643 을 곱하면 틀린다.
        `engine/weather.js §weekStats` 에 그 경고가 이미 있었다.

   ⚠⚠ **±0.01 어긋난다** — 엔진의 `dli` 는 소수 둘째 자리로 반올림된 «한 값»인데
     이 자는 `dli_daylight` 와 `dli_lamp` 를 «따로» 받아 더한다. 두 항이 각각 반올림돼
     합이 최대 0.01 어긋난다(실측: 반지하 창턱 400일 중 0.00 또는 0.01, 최저 7일평균이
     2.7843 vs 2.7757). ⇒ ★ **문턱과의 여유가 0.05 아래면 이 자를 믿지 말고**
     프로필을 다시 뽑아 `probe_slot_year`(엔진의 `dli` 를 그대로 씀)로 재라.

   ⚠ 이것은 «[셈]이 섞인 자»다 — 라이브 한 점씩을 날씨 흐름에 «태운» 것이라,
     프로필을 다시 뽑은 뒤에는 `probe_slot_year` 로 «다시» 재라.

     python tools/serve.py 8971
     ROOM=oneroom LAMPS=1,2 node tools/probe_room_live_year.mjs
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { launch } from './test_cdp.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const TH = J('data/balance/light_thresholds.json'), T = TH.plants.monstera_deliciosa;
const ROOM = process.env.ROOM || 'oneroom';
const P = J('data/profiles/room_profile.' + ROOM + '.json');
const light = createProfileLight({ ...P, uidStable:true },
  { thresholds:TH, weather:J('data/balance/weather.json'), electricity:J('data/balance/electricity.json') });

const page = await launch({ width: 900, height: 700, dpr: 1, mobile: false });
await page.goto('http://localhost:8971/game.html');
await page.eval(`localStorage.clear()`, false);
await page.goto('http://localhost:8971/game.html');
await page.waitFor('!!window.__io', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
const LIVE = JSON.parse(await page.eval(`(()=>{ const io=window.__io;
  if (io.light.room.id !== '${ROOM}') io.light.build('${ROOM}');
  const out={};
  for (const s of io.light.room.slots) {
    const day={}, lamp={};
    for (const se of ['spring','summer','autumn','winter'])
      for (const w of ['clear','cloudy','rain'])
        day[se+'/'+w] = +io.light.dliOfSlot(s.slotId,{weather:w,season:se,litHours:12,lampCount:0}).toFixed(4);
    for (const n of [1,2])
      lamp[n] = +(io.light.dliOfSlot(s.slotId,{weather:'clear',season:'summer',litHours:12,lampCount:n})
                - io.light.dliOfSlot(s.slotId,{weather:'clear',season:'summer',litHours:12,lampCount:0})).toFixed(4);
    out[s.slotId]={day,lamp};
  }
  return JSON.stringify(out); })()`));
await page.close();

const IDS = Object.keys(LIVE);
const band = d => d<T.die?'critical':d<T.survive?'poor':d<T.min?'stagnant'
                 :d<T.best_lo?'slow':d<=T.best_hi?'best':d<=T.max?'good':'over';
console.log(`══ ${ROOM} · real 400일 · 7일평균 · 라이브 값을 날씨 흐름에 태움`);
console.log('   ⚠ 자연광·등 몫은 «라이브»에서 뽑고 날씨 흐름만 정적 엔진에서 씀');
console.log('   ⚠ 등 DLI 에는 날씨 계수를 안 곱한다 (엔진 확인 완료)');
console.log('   문턱: min 2.7 · best_lo 5.0 · 갈라짐 6.0 · 무늬 8.4\n');
const LAMPS = (process.env.LAMPS || '1,2').split(',').map(Number);
for (const lamps of LAMPS) {
  const H={}, st={};
  IDS.forEach(i=>{H[i]=[];st[i]={mid:0,bright:0,fen:0,over84:0,wMin:99,max:0,n:0};});
  for (let d=1; d<=400; d++){
    const S={sim:{mode:'real',yearDay0:135},lamps:{count:lamps,litHours:12},pots:[],placedItems:[]};
    const sky=light.daily(d,S).sky;
    const key=sky.season+'/'+sky.weather;
    for (const id of IDS){
      const v=(LIVE[id].day[key]??0)+(LIVE[id].lamp[lamps]??0);
      H[id].push(v); if(H[id].length<7) continue;
      const a=H[id].slice(-7).reduce((x,y)=>x+y,0)/7, t=st[id]; t.n++;
      const b=band(a);
      if(b==='slow') t.mid++; else if(b!=='critical'&&b!=='poor'&&b!=='stagnant') t.bright++;
      if(a>=T.fenestrate) t.fen++;
      if(a>=8.4) t.over84++;
      if(a>t.max) t.max=a;
      if(sky.season==='winter'&&a<t.wMin) t.wMin=a;
    }
  }
  const rank=[...IDS].sort((a,b)=>st[b].max-st[a].max);
  const byWinter=[...IDS].sort((a,b)=>st[b].wMin-st[a].wMin);
  const pc=(v,n)=>String(Math.round(v/n*100)).padStart(3)+'%';
  const top=rank[0], win=byWinter[0];
  console.log(`[등 ${lamps}개]`);
  console.log(`   ★ 연중 최고 자리   ${top}   최고 avg7 ${st[top].max.toFixed(2)}`
    + `   mid:bright ${pc(st[top].mid,st[top].n)}:${pc(st[top].bright,st[top].n)}`);
  console.log(`      갈라짐(≥6.0) ${pc(st[top].fen,st[top].n)}   무늬(≥8.4) ${pc(st[top].over84,st[top].n)}`);
  console.log(`   ★ 겨울 최고 자리   ${win}   겨울 최저 ${st[win].wMin.toFixed(2)}`
    + `   min 2.7 대비 ${(st[win].wMin-2.7>=0?'+':'')}${(st[win].wMin-2.7).toFixed(2)}`
    + (st[win].wMin>=2.7?'  ✅':'  ⛔'));
  console.log(`      (연중 최고 자리 ${top} 의 겨울은 ${st[top].wMin.toFixed(2)})`);
  console.log('');
}
