import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
console.log('rig 전문:', await page.eval(`(()=>{ try{
  return JSON.stringify((window.__io.light.room.growRigs||[]).map(r=>({uid:r.uid,id:r.id,
    x:r.x,y:r.y,z:r.z, pos:r.pos, at:r.at, fx:r.fx?{watts:r.fx.watts}:null})));
}catch(e){return 'ERR '+e.message;} })()`));
console.log('가구 목록:', await page.eval(`(()=>{ try{
  const l=window.__rv.furniture?window.__rv.furniture():[];
  return JSON.stringify(l.map(f=>({uid:f.uid,x:f.x,y:f.y,z:f.z,movable:f.movable})));
}catch(e){return 'ERR '+e.message;} })()`));
console.log('옮길 수 있는 것:', await page.eval(`(()=>{ try{
  const f=window.__rv.movableFurniture?window.__rv.movableFurniture():null;
  return f?JSON.stringify(f):'no-api';
}catch(e){return 'ERR '+e.message;} })()`));
console.log('등 상태:', await page.eval(`(()=>{ try{
  return JSON.stringify(window.__rv.lampSwitches().lamps.map(l=>({uid:l.uid,grow:l.grow,on:l.on,
    ...(l.at?{at:l.at}:{}), ...(l.pos?{pos:l.pos}:{})})));
}catch(e){return 'ERR '+e.message;} })()`));
await page.close();
