/* ============================================================
   tools/probe_seedbite.mjs — **씨앗이 판을 물기는 무나**
   ------------------------------------------------------------
   씨앗 2 와 3 의 판이 119일까지 «똑같이» 나왔다. 그래서 물었다.

   ★ 답 — **씨앗은 날씨를 문다. 그런데 튜토가 날씨를 안 굴린다.**
     · `skyOf` 로 140일을 뽑으면 씨앗 2·3 이 **82일** 다르다 (⇒ 씨앗 자체는 멀쩡하다)
     · 그런데 게임이 뜨는 자리는 `sim.mode = 'novice'` 이고
       `SIM_MODES.novice = { rollWeather:false, rollSeason:false, weather:'clear', season:'summer' }`
       (src/game/state.js:58) — **날씨·계절을 아예 안 굴린다.**
     · `WEATHER_K.clear = 1.00` (cloudy 0.25 · rain 0.12) · `summer.k = 1.00`(winter 0.55)
       ⇒ ★★ **맑음 × 여름은 빛 축의 «천장»이다.** 튜토는 가장 밝은 판에 못박혀 있다.

   ⇒ ⛔ 그러니 **「씨앗을 여럿 굴려 본다」가 튜토에서는 뜻이 없다.** 판이 하나뿐이다.
     씨앗이 건드리는 것은 상점·번식 굴림뿐이라 씨앗 2·3 은 d120 에서야 갈라졌다.
   ⇒ ★ 대신 이렇게 읽어야 맞다 — 「운이 나빠서 못 나간 것이 아니라
     **가장 밝은 판에서도** 못 나간다」. 자를 바꾸면 결론이 세진다.

     BYEOT_URL=http://localhost:8972 node tools/probe_seedbite.mjs
   ⚠ 읽기만 한다 — 밸런스 값은 손대지 않는다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 180000);
wd.unref && wd.unref();

const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 120000, 300);
await sleep(4000);

/* 씨앗을 넣고 **그 씨앗으로 날씨를 140일 뽑는다.** 게임을 굴리지 않는다. */
const skyOf = async (seed) => page.eval(`(async()=>{ try{
  const W = await import('/src/engine/weather.js');
  const out = [];
  for (let d = 0; d < 140; d++) {
    const w = W.skyOf(d, { seed: ${seed} });
    out.push(w.weather + ':' + (w.cloud != null ? Math.round(w.cloud*100) : '-'));
  }
  return JSON.stringify({ ok: out });
} catch(e){ return JSON.stringify({ err: e.message }); } })()`);

/* ★ 씨앗보다 먼저 볼 것 — **이 판이 날씨를 굴리기는 하나** */
const mode = JSON.parse(await page.eval(`(async()=>{ try{
  const S = window.__S(), M = await import('/src/game/state.js');
  const m = M.modeOf ? M.modeOf(S) : (M.SIM_MODES||{})[S.sim.mode];
  return JSON.stringify({ mode: S.sim.mode, rollWeather: !!(m&&m.rollWeather),
                          rollSeason: !!(m&&m.rollSeason), weather: m&&m.weather, season: m&&m.season });
} catch(e){ return JSON.stringify({ err: e.message }); } })()`));
console.log('■ 이 판의 모드 —', JSON.stringify(mode));
if (mode.rollWeather === false)
  console.log('  ⇒ ⛔ **날씨를 안 굴린다** — 씨앗을 아무리 바꿔도 빛은 그대로다.' +
              ` (${mode.weather} · ${mode.season} 에 못박힘 — 둘 다 계수 1.00, 곧 천장이다)`);

const a = JSON.parse(await skyOf(2));
const b = JSON.parse(await skyOf(3));
if (a.err || b.err) {
  console.log('✘ 못 쟀다 —', a.err || b.err);
  console.log('  ⇒ 창에 걸린 것들:', await page.eval(`JSON.stringify(Object.keys(window).filter(k=>k.startsWith('__')))`));
} else {
  let diff = 0, first = -1;
  for (let i = 0; i < a.ok.length; i++) if (a.ok[i] !== b.ok[i]) { diff++; if (first < 0) first = i; }
  console.log(`■ 날씨 140일 — 씨앗 2 와 3 이 다른 날 ${diff}일` + (first >= 0 ? ` (처음 d${first})` : ''));
  console.log('  씨앗2 앞 12일 —', a.ok.slice(0, 12).join(' '));
  console.log('  씨앗3 앞 12일 —', b.ok.slice(0, 12).join(' '));
  console.log(diff === 0 ? '  ⇒ ⛔ **씨앗이 날씨를 안 문다** — 세 판은 같은 판이다'
                         : '  ⇒ ✔ 씨앗이 날씨를 문다 — 판이 같게 나온 것은 다른 까닭이다');
}
await page.close(); clearTimeout(wd);
