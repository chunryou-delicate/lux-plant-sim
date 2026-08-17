import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
console.log('등 상태:', await page.eval(`(()=>{ const S=window.__S();
  return JSON.stringify({ lamps:S.lamps, lamp:(S.tutorial&&S.tutorial.lamp)||null,
    값:(S.tutorial&&S.tutorial.rules&&S.tutorial.rules.lampPriceWon)||null }); })()`));
console.log('방 가구:', await page.eval(`(()=>{ try{
  const rv=window.__rv; const list=rv.furniture?rv.furniture():[];
  return JSON.stringify(list.filter(f=>/grow|lamp/.test(f.uid||'')));
}catch(e){return 'ERR '+e.message;} })()`));
console.log('메시:', await page.eval(`(()=>{ try{
  const rv=window.__rv, out=[];
  const sc = rv.scene ? rv.scene() : null;
  if(!sc) return 'no-scene';
  sc.traverse(o=>{ const n=(o.name||'')+' '+((o.userData&&o.userData.uid)||'');
    if(/grow/i.test(n)){ const p=new (o.constructor.prototype.constructor===Object?Object:Object)();
      const w=o.getWorldPosition ? o.getWorldPosition(o.position.clone()) : o.position;
      out.push({이름:(o.name||'?'), uid:(o.userData&&o.userData.uid)||null,
        보임:o.visible, 로컬y:+o.position.y.toFixed(3),
        월드:[+w.x.toFixed(2),+w.y.toFixed(2),+w.z.toFixed(2)]}); } });
  return JSON.stringify(out.slice(0,12));
}catch(e){return 'ERR '+e.message;} })()`));
console.log('rigs:', await page.eval(`(()=>{ try{
  const io=window.__io; const r=io.light.room;
  return JSON.stringify({ rigs:(r.growRigs||r.rigs||[]).map(g=>({id:g.id||g.uid, y:g.y??(g.at&&g.at.y), preset:g.preset})) });
}catch(e){return 'ERR '+e.message;} })()`));
await page.close();
