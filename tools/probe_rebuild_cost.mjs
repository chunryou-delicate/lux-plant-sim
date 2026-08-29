/* ============================================================
   probe_rebuild_cost.mjs — 「가구 하나 놓을 때 «어디»가 오래 걸리나」 ([House])
   ------------------------------------------------------------
   2026-08-30 [core] 가 쟀다 — 가방에서 가구 하나를 꺼내 놓으면 ★ «31,088 ms».
   가구 아홉이면 4~5분이라 «사람이 못 쓴다».

   ⇒ ★ 그런데 그 31초가 «무엇»인지는 안 갈렸다. 후보가 셋이다:
       ㉠ 조도 엔진   `io.light.build(room)` — 방을 다시 조립하고 광선을 쏜다
       ㉡ 조도 셈     자리마다 DLI 를 다시 낸다
       ㉢ 화면        THREE 장면을 통째로 다시 짓는다(`remountRoomView`)
   ⇒ ⇒ ★★ 고칠 데를 고르려면 «셋 중 어디»인지부터 알아야 한다.
     [House] 가 전에 잰 것 — 겨누기 19ms · 가구 옮기기 40ms (⚠ 그건 «조도 엔진만»이다)

   ⚠ 이 자는 «브라우저»로 잰다. 헤드리스로는 ㉢ 을 못 잰다 — 거기가 제일 의심스럽다.

   쓰기:  python tools/serve.py 8971
          BYEOT_URL=http://localhost:8971 node tools/probe_rebuild_cost.mjs
============================================================ */
import { launch } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const ROOM = process.env.ROOM || 'oneroom';

const page = await launch({ width: 900, height: 700, dpr: 1, mobile: false });
await page.goto(BASE + '/game.html');
await page.eval('localStorage.clear()', false);
await page.goto(BASE + '/game.html');
await page.waitFor('!!window.__io', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);

const raw = await page.eval('(()=>{ const io=window.__io, R="' + ROOM + '";'
  + ' const t=(f,n)=>{ const a=performance.now(); for(let i=0;i<n;i++) f(i);'
  + '                  return (performance.now()-a)/n; };'
  + ' const out={};'
  /* ㉠ 방 조립만 */
  + ' out.build = t(()=>{ io.light.build(R); }, 5);'
  /* ㉡ 조립 + 자리마다 DLI */
  + ' const r0=io.light.build(R); const ids=r0.slots.map(s=>s.slotId);'
  + ' out.buildDli = t(()=>{ io.light.build(R); io.light.clearCache();'
  + '   for(const id of ids) io.light.dliOfSlot(id,{weather:"clear",season:"summer",lampCount:1,litHours:12}); }, 3);'
  /* ㉢ 가구를 «옮기는» 창구 — 가벼운 길이 있나 */
  + ' out.hasMove = typeof io.light.moveFurniture === "function";'
  + ' out.hasEdits = typeof io.light.setFurnitureEdits === "function";'
  + ' const f=io.light.furnitureList().find(x=>!/growlight/.test(x.preset));'
  + ' out.movedUid=f&&f.uid;'
  + ' if(f) out.move = t((i)=>{ io.light.moveFurniture(f.uid,'
  + '   {x:+(f.x+(i%2?0.01:-0.01)).toFixed(3), z:f.z, y:f.y, rot:f.rot}); }, 5);'
  + ' if(out.hasEdits) out.edits = t(()=>{ io.light.setFurnitureEdits([], []); }, 5);'
  + ' out.nSlots = r0.slots.length;'
  + ' return JSON.stringify(out); })()');
await page.close();
const D = JSON.parse(raw);

const ms = v => v == null ? '  ―  ' : (v < 10 ? v.toFixed(2) : v.toFixed(0)).padStart(8) + ' ms';
console.log('방 ' + ROOM + ' · 자리 ' + D.nSlots + '칸 · 브라우저(CDP)\n');
console.log('  ㉠ 방 조립만            io.light.build()            ' + ms(D.build));
console.log('  ㉡ 조립 + 자리마다 DLI  build + dliOfSlot × ' + String(D.nSlots).padStart(2) + '      ' + ms(D.buildDli));
console.log('  ㉢ 가구 하나 옮기기     io.light.moveFurniture()    ' + ms(D.move)
  + (D.movedUid ? '   (' + D.movedUid + ')' : ''));
if (D.edits != null)
  console.log('  ㉣ 판 것/산 것 얹기     io.light.setFurnitureEdits()' + ms(D.edits));
console.log('');
console.log('  ⇒ [core 잰 것] 가방에서 하나 꺼내 놓기 = ★ 31,088 ms');
const engine = Math.max(D.build || 0, D.move || 0, D.edits || 0);
if (engine > 0) {
  const pct = (engine / 31088 * 100);
  console.log('  ⇒ ★★ 조도 엔진 몫은 그중 «' + pct.toFixed(2) + '%» 입니다 ('
    + engine.toFixed(0) + ' ms)');
  console.log('  ⇒ ⇒ ★ 나머지 ' + (100 - pct).toFixed(2) + '% 는 «화면»(THREE 장면 다시 짓기)입니다');
  console.log('     ⇒ ⛔ 조도를 아무리 고쳐도 «안 빨라집니다». 고칠 데는 room_view 쪽입니다');
}
