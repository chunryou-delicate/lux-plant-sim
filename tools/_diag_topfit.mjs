/* 그린 격자와 **실제 상판**이 같은 크기인가 (박사님: "협탁 그리드 수정해" · "이렇게 하면 5자리")
   ⚠ 격자는 `size_m` 으로 그리고, 눈에 보이는 판때기는 빌더가 만든 메시다. 둘이 다르면
     칸이 상판 밖으로 삐져나가고 「저기 놓을 수 있나」가 거짓말이 된다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`,false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);
console.log(await page.eval(`(()=>{ try {
  const io=window.__io, rv=window.__rv;
  const slots=io.light.room.slots||[];
  const byUid=new Map();
  for(const s of slots){ const u=String(s.slotId).split(':')[0];
    if(!byUid.has(u)) byUid.set(u,[]); byUid.get(u).push(s); }
  const out=[];
  for(const [uid,list] of byUid){
    const xs=list.map(s=>s.x), zs=list.map(s=>s.z);
    const f=(io.light.furnitureList()||[]).find(x=>x.uid===uid);
    out.push({ uid, 칸:list.length,
      칸x:[+Math.min(...xs).toFixed(3), +Math.max(...xs).toFixed(3)],
      칸z:[+Math.min(...zs).toFixed(3), +Math.max(...zs).toFixed(3)],
      가구:f?{x:f.x,z:f.z,preset:f.preset}:null });
  }
  return JSON.stringify(out, null, 0);
} catch(e){ return 'ERR '+e.message; } })()`));
await page.close();
