/* tools/probe_grabjump.mjs — **P-2 가 왜 `null` 인가** (자 하나가 떨어져 있다)
   ------------------------------------------------------------------
   test_uiwire P-2 「direct 에서는 잡은 자리로 튄다」가 `nullm` 으로 떨어진다.
   `null` 은 **유령이 안 섰다**는 뜻이고, 그건 ① 바닥을 못 맞았거나 ② 옮기기로 안 들어갔거나다.
   재는 것: 같은 자리를 **두 번** 잡아 보고, 그때마다 mode·유령·아래글을 적는다.
   ⇒ 두 번째만 되면 「첫 판이 덜 데워진 것」(자의 탈)이고, 둘 다 안 되면 화면의 탈이다.
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 240000);
wd.unref && wd.unref();
const page = await launch({ width: 1770, height: 1188, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
const target = JSON.parse(await page.eval(`(()=>{ const rv=window.__rv;
  const c=document.getElementById('roomCanvas').getBoundingClientRect();
  for (const fy of [0.55,0.62,0.48,0.7]) for (const fx of [0.5,0.35,0.65,0.25,0.75]) {
    const x=c.left+c.width*fx, y=c.top+c.height*fy;
    let h=null; try{ h=rv.pickFurnitureAt(x,y); }catch(e){}
    if (h) return JSON.stringify({ uid:h.uid, x, y });
  }
  return 'null'; })()`));
console.log('■ 잡을 가구 —', JSON.stringify(target));
if (!target) { console.log('⚠ 잡을 것을 못 찾았다'); await page.close(); process.exit(0); }
const off = JSON.parse(await page.eval(`(()=>{ const rv=window.__rv;
  for (const dx of [26,-26,34,-34,18,-18]) {
    const x=${target.x}+dx, y=${target.y};
    let h=null; try{ h=rv.pickFurnitureAt(x,y); }catch(e){}
    if (h && h.uid===${JSON.stringify(target.uid)}) return JSON.stringify({ x, y, dx });
  }
  return JSON.stringify({ x:${target.x}, y:${target.y}, dx:0 }); })()`));
console.log('■ 비껴 잡는 점 —', JSON.stringify(off));
const once = (n) => page.eval(`(()=>{ const rv=window.__rv, f=window.__furn;
  const g=(rv.furniture()||[]).find(a=>a.uid===${JSON.stringify(target.uid)});
  if(!g) return JSON.stringify({ 회:${n}, 탈:'가구가 목록에 없다' });
  f.clear();
  f.select(g, ${off.x}, ${off.y});
  const uid=f.uid;
  f.beginMove();
  const mode=f.mode;
  f.down({ clientX:${off.x}, clientY:${off.y} });
  const gh=f.ghost;
  const out={ 회:${n}, 골랐나:uid||null, 모드:mode||null,
    기준점:[Math.round(f.originX||-1), Math.round(f.originY||-1)],
    바닥맞음:(()=>{ try{ const h=window.__freePlace ? null : null; }catch(e){}
      return null; })(),
    유령: gh? { x:+gh.x.toFixed(3), z:+gh.z.toFixed(3) } : null,
    튄거리: gh? +Math.hypot(gh.x-g.x, gh.z-g.z).toFixed(4) : null,
    아래글: (document.getElementById('dropLabel').textContent||'').trim().slice(0,30) };
  f.mode=null; f.ghost=null; f.clear();
  document.getElementById('stage').classList.remove('furnmoving');
  return JSON.stringify(out); })()`);
console.log('① 첫 번째 —', await once(1));
await sleep(500);
console.log('② 두 번째 —', await once(2));
await sleep(500);
console.log('③ 세 번째 —', await once(3));
await page.close(); clearTimeout(wd);
