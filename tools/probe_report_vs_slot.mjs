/* ============================================================
   probe_report_vs_slot.mjs — 「식물이 먹는 값」과 「검사가 재는 값」이 같은가 ([House])
   ------------------------------------------------------------
   ★★★ 왜 이것을 재나 (2026-08-29)

   이 저장소의 조도 수치는 거의 다 `dliOfSlot()` 에서 나왔다 — 정적 프로필, 밸런스 표,
   「창턱 3.68」, 「겨울 2.78」. 그런데 **게임 속 식물이 실제로 먹는 값**은 그게 아니라
   하루치 계약 `daily(day, S).report.slots[…].dli` 다.

   ⇒ ★ **둘이 같다는 말은 여기저기 «적혀» 있는데, 아무도 «재지» 않았다.**
     `dliOfSlot` 이 속으로 `buildDailyLight` 를 부르니 «같은 함수»인 것은 맞다.
     그런데 넘기는 «인자»가 같은지는 다른 문제다 — 등 개수·점등 시간·날씨·놓인 것.

   ⚠⚠ 이 저장소는 그 꼴로 여러 번 물렸다. 제일 가까운 것이 2026-08-24 이다:
       *"ratio 가 같으니 DLI 도 같을 것"* ⇒ ratio 만 쟀고 DLI 는 안 쟀다.
   ⇒ ★★ **「같은 함수를 탄다」는 «구조»의 말이고, 「같은 값이 나온다」는 «잰» 말이다.**

   ★ 조건을 «훑는다». 한 조건만 재고 「같다」고 하면 그게 바로 그 병이다.
     등을 켠 판이 제일 위험하다 — 등 개수(`rigsOn`)·점등 시간·겨눔이 그때만 흐른다.

   쓰기:  python tools/serve.py 8971
          BYEOT_URL=http://localhost:8971 node tools/probe_report_vs_slot.mjs
============================================================ */
import { launch } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';

/* ⚠⚠ 여기서 «한 번 틀렸다». 적어 둔다 — 처음엔 `S.sim.weather`·`S.sim.season` 을 바꿔
     계절을 훑으려 했다. **그런데 그 손잡이는 «안 달려 있다»** —
       state.js §SIM_MODES  real  = {rollWeather:true,  rollSeason:true }   ← 날짜로 굴린다
                            novice= {weather:'clear', season:'summer'}      ← 얼려 있다
     `skyFor` 는 `modeOf(S)` 가 내주는 «표»를 보지 `S.sim.weather` 를 «안 본다».
   ⇒ ★ 그래서 「겨울 3.68 · 여름 3.68」이 나왔고 **검사는 «통과»했다** —
     둘 다 안 움직였으니 서로 같았던 것이다.
   ⇒ ⇒ ★★★ **안 달린 손잡이를 돌려 놓고 「값이 같다」고 하면 그건 «아무것도 안 잰 것»이다.**
     그런데 초록으로 보인다. 이 저장소가 여러 번 물린 그 꼴이다(계율 ㊵ 「표본 없는 0」).

   ★ 그래서 계절은 «내가 정하지 않는다» — `real` 모드로 «날짜»를 옮기고,
     엔진이 실제로 «쓴» 하늘(`sky`)을 «되읽어» 그것으로 견준다.
   ⚠ 그리고 아래에서 **하늘이 실제로 갈렸는지 세어서 찍는다.** 안 갈렸으면 이 자는 못 잰 것이다. */
const CASES = [];
for (const lamps of [0, 1, 2, 3])
  for (const day of [0, 60, 120, 180, 240, 300])
    CASES.push({ lamps, day });

const page = await launch({ width: 900, height: 700, dpr: 1, mobile: false });
await page.goto(BASE + '/game.html');
await page.eval('localStorage.clear()', false);
await page.goto(BASE + '/game.html');
await page.waitFor('!!window.__io', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);

const raw = await page.eval('(()=>{ const io=window.__io, S=window.__S();'
  + ' const CASES=' + JSON.stringify(CASES) + ', out=[];'
  + ' for (const c of CASES) {'
  /* 게임 상태를 그 조건으로 흉내 낸다 — daily() 가 실제로 보는 열쇠만 바꾼다 */
  + '   const S2=Object.assign({},S,{'
  + '     lamps:Object.assign({},S.lamps,{count:c.lamps, litHours:12}),'
  + '     sim:Object.assign({},S.sim,{mode:"real"}) });'   /* ★ 날씨·계절을 «날짜로 굴리게» 한다 */
  + '   let rep=null, sky=null, e=null;'
  + '   try{ const d=io.light.daily(c.day, S2); rep=d.report; sky=d.sky; }'
  + '   catch(err){ e=String(err.message||err); }'
  + '   if (e) { out.push({c:c, e:e}); continue; }'
  + '   const opt={weather:sky.weather, season:sky.season, lampCount:c.lamps, litHours:12};'
  + '   io.light.clearCache();'
  + '   const rows=rep.slots.map(s=>{ let ask=null, e2=null;'
  + '     try{ ask=io.light.dliOfSlot(s.slotId,opt); }catch(err){ e2=String(err.message||err); }'
  + '     return {id:s.slotId, fed:s.dli, ask:ask, e:e2}; });'
  + '   out.push({c:c, sky:{weather:sky.weather,season:sky.season}, n:rows.length, rows:rows,'
  + '     bad:rows.filter(r=>r.e || Math.abs(r.fed-r.ask)>1e-6)});'
  + ' }'
  + ' return JSON.stringify({room:(io.light.room&&io.light.room.id), day:S.day, cases:out}); })()');
await page.close();
const D = JSON.parse(raw);

console.log('방 ' + D.room + ' · ' + D.day + '일차 · 점등 12시간');
console.log('★ 「식물이 먹는 값」(daily 계약) 과 「검사가 재는 값」(dliOfSlot) 을 조건마다 견준다\n');
console.log('  ' + '조건'.padEnd(28) + '어긋난 칸'.padEnd(12) + '가장 밝은 자리   먹는 값 vs 재는 값');

let bad = 0, err = 0, cells = 0;
for (const c of D.cases) {
  const tag = ((c.sky ? c.sky.season + '/' + c.sky.weather : '?') + ' · 등 ' + c.c.lamps + '개 · ' + c.c.day + '일').padEnd(28);
  if (c.e) { err++; console.log('  ✘ ' + tag + '던짐: ' + c.e); continue; }
  const top = c.rows.reduce((a, b) => (!a || b.fed > a.fed) ? b : a, null);
  bad += c.bad.length; cells += c.n;
  console.log('  ' + (c.bad.length ? '✘ ' : '  ') + tag
    + (c.bad.length + '/' + c.n).padEnd(12)
    + Number(top.fed).toFixed(2).padStart(6) + '  vs ' + Number(top.ask).toFixed(2).padStart(6)
    + (c.bad.length ? '   ★ 어긋남' : '   같다'));
  for (const r of c.bad.slice(0, 3))
    console.log('        ★ ' + r.id + '   먹는 값 ' + r.fed + ' · 재는 값 ' + r.ask + (r.e ? ' · ' + r.e : ''));
}

/* ★ 손잡이가 «실제로» 돌아갔나 — 안 돌아갔으면 위의 「같다」는 아무 뜻이 없다 */
const skies = new Set(D.cases.filter(c => c.sky).map(c => c.sky.season + '/' + c.sky.weather));
const tops  = new Set(D.cases.filter(c => c.rows).map(c =>
  Math.max(...c.rows.map(r => r.fed)).toFixed(4)));
console.log('');
console.log('★ 손잡이가 실제로 돌아갔나 — 나온 하늘 ' + skies.size + '가지 ('
  + [...skies].join(' · ') + ')');
console.log('                            나온 최고값 ' + tops.size + '가지 ('
  + [...tops].map(v => (+v).toFixed(2)).join(' · ') + ')');
if (skies.size < 2 || tops.size < 2) {
  console.log('  ⛔ 값이 안 갈렸습니다. 그러면 위의 「같다」는 «아무것도 안 잰 것»입니다.');
  process.exitCode = 1;
}

console.log('');
if (err || bad) {
  console.log('report_vs_slot: FAIL — 어긋난 칸 ' + bad + '개 · 던진 조건 ' + err + '개');
  console.log('  ⛔ 그러면 이 저장소의 조도 표가 «식물이 안 먹는 값» 위에 서 있습니다.');
  process.exitCode = 1;
} else {
  console.log('report_vs_slot: PASS — 조건 ' + D.cases.length + '가지 · ' + cells + '칸, 전부 같다  (하늘 ' + skies.size + '가지 · 최고값 ' + tops.size + '가지로 «갈렸다»)');
  console.log('  ★ 「식물이 먹는 값 = 검사가 재는 값」을 이제 «쟀다». 그동안 «적혀만» 있었다.');
  console.log('  ⚠ 아직 안 잰 것: 겨눈 등 · 자유 좌표(바닥) · 반지하 말고 다른 방.');
}
