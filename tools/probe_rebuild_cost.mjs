/* ============================================================
   probe_rebuild_cost.mjs — 「가구 하나 놓을 때 «어디»가 오래 걸리나」 ([House])
   ------------------------------------------------------------
   ⛔⛔ 2026-08-30 — **이 자가 처음 낸 결론 「조도는 0.02%」를 «물린다».**
   [core] 가 「가방에서 하나 꺼내 놓기 = 31,088 ms」를 냈고 나는 그 위에 자를 댔다.
   ⇒ 그런데 그 31초는 **재는 자의 «기다림 고리가 끝까지 돈 값»**(60회 × 500ms)이었다.
     그 판에서는 방이 «아예 안 서 있었다»(`window.__rv === null`). [core] 가 물렸다.
   ⇒ ⇒ ★★★ **내 수는 하나도 안 틀렸는데 «분모»가 틀렸다. 그래서 결론이 죽었다.**
   ⇒ ★ **참값은 273 ms** — [core] 재측정(이사를 안 하고, 방이 선 자리에서 가방에만 하나 얹어서).

   ⚠⚠ 그리고 이것이 이 밤의 «열째»다 — 앞의 아홉과 «모양이 다르다»:
     ①~⑨  «내가» 잰 것을 잘못 말했다
     ★⑩   ⇒ «남이» 준 수를 «어떻게 쟀는지 안 묻고» 그 위에 결론을 세웠다
   ⇒ ⇒ ★★ 나는 내 표에는 [잰 것]/[셈]/[짐작]을 붙이면서, **받은 수에는 그것을 «안 물었다».**

   ⇒ ★ 그런데 그 31초가 «무엇»인지는 안 갈렸다. 후보가 셋이다:
       ㉠ 조도 엔진   `io.light.build(room)` — 방을 다시 조립하고 광선을 쏜다
       ㉡ 조도 셈     자리마다 DLI 를 다시 낸다
       ㉢ 화면        THREE 장면을 통째로 다시 짓는다(`remountRoomView`)
   ⇒ ⇒ ★★ 고칠 데를 고르려면 «셋 중 어디»인지부터 알아야 한다.
     [House] 가 전에 잰 것 — 겨누기 19ms · 가구 옮기기 40ms (⚠ 그건 «조도 엔진만»이다)

   ⚠ 이 자는 «브라우저»로 잰다. 헤드리스로는 ㉢ 을 못 잰다.
   ⛔⛔ 그리고 [core] 가 낸 벽 — **헤드리스는 방을 «두 번째로» 못 짓는다**
     (`Cannot read properties of null (reading 'precision')` · swiftshader 가 WebGL 판을 하나만 연다).
     ⇒ ★ `remountRoomView` 를 지나는 길은 헤드리스에서 «전부» 못 잰다. 이사가 그 길이다.
     ⇒ ⇒ **한 판(`launch`)에 방을 «한 번만» 지어라.**

   ★★ 그리고 재기 «전»에 반드시 — **`window.__rv` 가 참인지 보라.**
     널이면 그 판은 «무효»다. [core] 가 31초를 낸 것이 정확히 그 자리였다.

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
  /* ★★ 문지기 — 방이 안 서 있으면 그 판은 «무효»다. [core] 가 여기서 31초를 냈다 */
  + ' if(!window.__rv) return JSON.stringify({dead:"window.__rv 가 널이다 — 방이 안 섰다. 이 판은 무효"});'
  + ' const t=(f,n)=>{ const a=performance.now(); for(let i=0;i<n;i++) f(i);'
  + '                  return (performance.now()-a)/n; };'
  + ' const out={};'
  + ' out.build = t(()=>{ io.light.build(R); }, 5);'
  + ' const r0=io.light.build(R); const ids=r0.slots.map(s=>s.slotId);'
  + ' out.buildDli = t(()=>{ io.light.build(R); io.light.clearCache();'
  + '   for(const id of ids) io.light.dliOfSlot(id,{weather:"clear",season:"summer",lampCount:1,litHours:12}); }, 3);'
  + ' const f=io.light.furnitureList().find(x=>!/growlight/.test(x.preset));'
  + ' out.movedUid=f&&f.uid;'
  + ' if(f) out.move = t((i)=>{ io.light.moveFurniture(f.uid,'
  + '   {x:+(f.x+(i%2?0.01:-0.01)).toFixed(3), z:f.z, y:f.y, rot:f.rot}); }, 5);'
  + ' if(typeof io.light.setFurnitureEdits==="function")'
  + '   out.edits = t(()=>{ io.light.setFurnitureEdits([], []); }, 5);'
  /* ★ [core] 가 낸 «가벼운 창구» — rebuildRoom({prebuilt}) 결 (f17231b) */
  + ' if(window.__rv && typeof window.__rv.refreshFurniture==="function")'
  + '   out.refresh = t(()=>{ window.__rv.refreshFurniture(); }, 5);'
  + ' else out.refreshMissing = true;'
  + ' out.nSlots = r0.slots.length;'
  + ' return JSON.stringify(out); })()');
await page.close();
const D = JSON.parse(raw);
if (D.dead) { console.log('⛔ ' + D.dead); process.exitCode = 1; }
else {

const ms = v => v == null ? '  ―  ' : (v < 10 ? v.toFixed(2) : v.toFixed(0)).padStart(8) + ' ms';
console.log('방 ' + ROOM + ' · 자리 ' + D.nSlots + '칸 · 브라우저(CDP) · window.__rv 살아 있음' + String.fromCharCode(10));
console.log('  ㉠ 방 조립만            io.light.build()             ' + ms(D.build));
console.log('  ㉡ 조립 + 자리마다 DLI  build + dliOfSlot × ' + String(D.nSlots).padStart(2) + '       ' + ms(D.buildDli));
console.log('  ㉢ 가구 하나 옮기기     io.light.moveFurniture()     ' + ms(D.move)
  + (D.movedUid ? '   (' + D.movedUid + ')' : ''));
console.log('  ㉣ 판 것/산 것 얹기     io.light.setFurnitureEdits() ' + ms(D.edits));
console.log('  ㉤ ★ 가구만 다시 그리기 __rv.refreshFurniture()      '
  + (D.refreshMissing ? '  없음 (f17231b 이 안 들어왔나)' : ms(D.refresh)));

console.log('');
console.log('  ⇒ [core 잰 것] 「가구 하나 놓기」 참값 = ★ 273 ms (3D 까지 다 서기까지)');
console.log('     ⛔ 옛 수 31,088 ms 는 «재는 자의 천장»이었다 — 물렸다(2026-08-30)');
const eng = (D.build || 0) + (D.edits || 0);
console.log('  ⇒ 조도 몫 ' + eng.toFixed(1) + ' ms  ≒ ' + (eng / 273 * 100).toFixed(0) + '%'
  + '   · 나머지는 화면(3D)');
console.log('');
console.log('  ★ 그래서 결론이 «바뀐다» — 「고칠 데는 room_view」가 아니라 ⇒ ★★ 「고칠 것이 «없다»」');
console.log('    273 ms 면 가구 아홉을 놓아도 2.5초다. 사람이 쓸 수 있다.');
}
