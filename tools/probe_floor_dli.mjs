/* ============================================================
   probe_floor_dli.mjs — 반지하 «바닥»의 조도를 격자로 훑는다 ([growth] 소유)
   ------------------------------------------------------------
   ★★ 왜 이 자가 따로 있나 (2026-08-23)

   `room_profile.createProfileLight` 은 **바닥을 모른다.**
   프로필 slots 는 이름 붙은 15칸뿐이고, 자유 좌표(`free:…`)는 표에 없다.
   ⇒ 그 길로 바닥을 물으면 **0 이 돌아온다. 그 0 은 「어둡다」가 아니라 「모른다」다.**

   ⚠⚠ 이것이 **소리 없이 초록으로 보인다** —
       콩나물 최상 대역은 `maxDli 0.3` 이고 **하한이 없다**(first_play.js:204).
       ⇒ 「몰라서 나온 0」이 「최상」으로 읽힌다. 헤드리스로 바닥 작물을 재면 안 된다.

   ⇒ 그래서 **라이브 엔진**(light_adapter)에 묻는다. `io.light.dliAt({x,y,z})` 는
     임의 좌표를 슬롯 판정과 **같은 함수**로 잰다(light_adapter.js:390).

   ★ 반드시 지킬 것 둘
     ① 작물 등급이 먹는 값은 **peak 도 7일평균도 아니다** — 자라는 5일간의
        «하루 조도 평균»이다(first_play.js:2442 `dliHist` 평균 → cropQualityOf).
        그래서 여기서는 날씨별로 따로 찍는다. 맑음 하루값이 상한이다.
     ② 서버가 떠 있어야 한다:  python tools/serve.py 8971
        BYEOT_URL=http://localhost:8971 node tools/probe_floor_dli.mjs
============================================================ */
import { launch } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const Y = Number(process.env.FLOOR_Y || 0.10);          /* 시루가 앉는 높이 */
const ROOM = process.env.ROOM || 'banjiha';
const page = await launch({ width: 900, height: 700, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__io', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
const out = await page.eval(`(()=>{ const io=window.__io, y=${Y};
  if (io.light.room.id !== '${ROOM}') io.light.build('${ROOM}');
  const pts=[]; const X=2.4, Z=2.4;
  for(let x=-X;x<=X;x+=0.3) for(let z=-Z;z<=Z;z+=0.3){
    let r=null; try{ r=io.light.dliAt({x:+x.toFixed(2),y,z:+z.toFixed(2)},
       {weather:'clear',season:'summer',lampCount:0,litHours:0}); }catch(e){ continue; }
    if(r&&isFinite(r.dli)) pts.push({x:+x.toFixed(2),z:+z.toFixed(2),d:+r.dli.toFixed(3)});
  }
  const seasons={};
  for(const se of ['spring','summer','autumn','winter'])
   for(const wx of ['clear','cloudy']) {
    const v=pts.map(p=>{ try{ return io.light.dliAt({x:p.x,y,z:p.z},
      {weather:wx,season:se,lampCount:0,litHours:0}).dli; }catch(e){ return 0; } });
    seasons[se+'/'+wx]=[Math.min(...v),Math.max(...v)].map(n=>+n.toFixed(3));
  }
  return JSON.stringify({n:pts.length, pts, seasons});
})()`);
const R = JSON.parse(out);
const s = R.pts.slice().sort((a,b)=>b.d-a.d);
const N = Number(process.env.SIRU_N || 16);
console.log(`[${ROOM}] 바닥 격자 ${R.n}점 (y=${Y.toFixed(2)} · 0.3m 간격 · 맑음·여름·등0 · 하루 DLI)`);
console.log(`  가장 밝은 ${N}점: ` + s.slice(0, N).map(p => p.d.toFixed(2)).join(' '));
console.log(`  0.30 을 넘는 점: ${s.filter(p => p.d > 0.30).length}/${R.n}  (콩나물 최상 상한)`);
console.log(`  0.35 이상인 점: ${s.filter(p => p.d >= 0.35).length}/${R.n}  (무순 최상 하한)`);
console.log('\n계절·날씨별 바닥 하루 DLI 폭 (등 0개)');
for (const k in R.seasons)
  console.log('  ' + k.padEnd(16) + R.seasons[k][0].toFixed(2) + ' ~ ' + R.seasons[k][1].toFixed(2));
await page.close();
