/* tools/probe_furnedits.mjs — **판 가구를 걷으면 «자리»와 «그림자»가 같이 빠지나**
   ------------------------------------------------------------------
   [House] 가 짚은 것: `furnitureSold/Added` 를 조립에 먹이면 `occluders` 와 `plantSlots` 가
   «같이» 바뀐다. ★ 하나만 되면 조용히 틀린다 — 「가구를 걷었는데 그 위 자리가 남는다」.
   ⇒ 그래서 가구를 하나씩 걷어 «자리 수»가 «그 가구 몫만큼» 주는지 본다.
   ⛔ 값은 안 바꾼다. 세이브에도 안 적는다 — 조립만 다시 한다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
const snap = () => page.eval(`(()=>{ try{ const L=window.__io.light, r=L.room;
  return JSON.stringify({ 방:r.id, 가구:(r.def.furniture||[]).length,
    자리:(r.slots||[]).length, 가림:(r.built&&r.built.occluders? r.built.occluders.length : null),
    자리주인:[...new Set((r.slots||[]).map(s=>String(s.slotId).split(':')[0]))] });
}catch(e){ return JSON.stringify({err:e.message}); } })()`);
console.log('■ 손 안 댄 판 —', await snap());
console.log('■ 창구가 있나 —', await page.eval(`(()=>{ const L=window.__io.light;
  return JSON.stringify({ setFurnitureEdits: typeof L.setFurnitureEdits,
    furnitureEdits: typeof L.furnitureEdits }); })()`));
const list = JSON.parse(await page.eval(`(()=>{ const r=window.__io.light.room;
  return JSON.stringify((r.def.furniture||[]).map(f=>({uid:f.uid,preset:f.preset}))); })()`));
console.log('■ 가구 —', list.map(f => f.uid + '(' + f.preset + ')').join(' · '));
console.log('');
console.log('=== 하나씩 걷어 본다 — 자리가 «그 가구 몫만큼» 주나 ===');
for (const f of list) {
  const r = JSON.parse(await page.eval(`(()=>{ try{ const L=window.__io.light;
    L.setFurnitureEdits(['${f.uid}'], []);
    const room=L.room;
    const out={ 가구:(room.def.furniture||[]).length, 자리:(room.slots||[]).length,
      가림:(room.built&&room.built.occluders? room.built.occluders.length : null) };
    L.setFurnitureEdits([], []);            /* 되돌린다 */
    return JSON.stringify(out);
  }catch(e){ return JSON.stringify({err:e.message}); } })()`));
  if (r.err) { console.log('  ' + f.uid.padEnd(22), '⛔', r.err); continue; }
  console.log('  ' + f.uid.padEnd(22) + ' 가구 ' + String(r.가구).padStart(3)
    + ' · 자리 ' + String(r.자리).padStart(3) + ' · 가림 ' + String(r.가림).padStart(4));
}
console.log('');
console.log('■ 되돌린 뒤 —', await snap());
console.log('');
console.log('=== 산 가구를 «더해» 본다 (같은 preset 을 다른 자리에) ===');
console.log(' ', await page.eval(`(()=>{ try{ const L=window.__io.light;
  const f=(L.room.def.furniture||[])[0];
  L.setFurnitureEdits([], [{ uid:'test_add_1', preset:f.preset, x:0, z:0, rot:0 }]);
  const room=L.room;
  const out={ 가구:(room.def.furniture||[]).length, 자리:(room.slots||[]).length,
    새자리:(room.slots||[]).filter(s=>String(s.slotId).indexOf('test_add_1')===0).length };
  L.setFurnitureEdits([], []);
  return JSON.stringify(out);
}catch(e){ return JSON.stringify({err:e.message}); } })()`));
await page.close(); clearTimeout(wd);
