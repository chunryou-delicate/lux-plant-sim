import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
const dump = async (tag) => console.log(tag, await page.eval(`(()=>{ try{
  const sw=window.__rv.lampSwitches();
  return JSON.stringify({ 방:sw.room, 켜진식물등:sw.growOn,
    등:sw.lamps.map(l=>({uid:l.uid, grow:l.grow, on:l.on, watts:l.watts, 보임:l.visible, y:l.y??null})) });
}catch(e){return 'ERR '+e.message;} })()`));
await dump('등 0개:');
await page.eval(`(()=>{ const S=window.__S(); S.lamps.count=1; window.__redraw&&window.__redraw(); })()`,false);
await sleep(1200); await dump('등 1개:');
await page.eval(`(()=>{ const S=window.__S(); S.lamps.count=2; window.__redraw&&window.__redraw(); })()`,false);
await sleep(1200); await dump('등 2개:');
console.log('스크린샷');
await page.shot('docs/handoff/img/guidewalk/lamp_2.png');
await page.close();
