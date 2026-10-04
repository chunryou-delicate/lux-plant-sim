/* ============================================================
   test_prologue_leaf3_unlocked.mjs — 첫 그루의 «무늬 보장 잎»(잎2·잎3)은 중간잎 확정에 안 걸린다
   ([growth] 소유 · 파일 이름은 처음 결정(잎3) 때 지었다 — 지우지 않으려고 이름을 그대로 둔다)
   ------------------------------------------------------------
   ★ 박사님 2026-10-04 결정 둘(총괄 claude-a3 전달):
     ① 「첫 그루 잎3은 중간잎 확정 3%(mid_lock_pct 0.03)에서 뺀다.」
     ② 「첫 그루 잎2도 뺀다.」 — 곧 첫 그루의 무늬 보장 두 장(잎2·잎3).
     목적 — 빛만 주면 누구나 하프문이 갈라지고 ✂(자르기 · 이사 길)가 열리게 한다.
     범위 — 첫 그루의 보장 잎만. 잎4 부터·다른 그루의 3% 는 그대로.

   ★ 무엇을 지키나 — 넷이다. 하나라도 어긋나면 붉는다.
     ① 첫 그루(보장 켬)의 잎2·잎3 은 N판 어디서도 안 잠긴다             ← 결정 그 자체
     ② 같은 씨앗을 씨앗 그루(보장 끔)로 두면 잎2·잎3 이 «각각» 잠기는 판이 있다 ← 예외가 다른 그루로 안 샌다
     ③ 첫 그루의 잎4 부터는 잠기는 판이 있다                             ← 범위가 보장 잎 밖으로 안 넓어졌다
     ④ 고치기 전에 잠겼던 판 둘(잎2: 617682 · 잎3: 237570)이 400일 안에 실제로 ✂ 가 열린다
        ← 술어만이 아니라 «목적»이 선다(창턱+등1 · 코어 걸음 · propagation §cutBlockedReason 그대로)
   ⚠ ②③ 이 없으면 「예외를 모든 잎·모든 그루로 넓혀도」 ①④ 는 초록이다. 그래서 같이 본다.

   ⚠ 서버가 떠 있어야 한다:  python tools/serve.py 8971
     BYEOT_URL=http://localhost:8971 node tools/test_prologue_leaf3_unlocked.mjs
   ⛔ 값·확률은 한 톨도 안 건드린다. 씨앗을 바꿔 가며 읽을 뿐이다.
============================================================ */
import { launch } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const N = Number(process.env.N || 600);
const page = await launch({ width: 900, height: 700, dpr: 1, mobile: false });
await page.goto(`${BASE}/plant_grow.html`);
await page.waitFor('typeof midLockedOf === "function"', 120000, 300);
await page.waitFor('TH_LOADED === true', 120000, 300);

const r = JSON.parse(await page.eval(`(async()=>{
 const pr = await import('/src/game/propagation.js');
 const scan = (pro) => { const l2=[], l3=[], l4p=[];
   for (let s=1; s<=${N}; s++){ plantSeed(s*7919); setPrologueVarieLeaves(pro ? [2,3] : []); resetDailyLight(); setGrowth(300);
     const b=[...new Set(leafOnPlantAll().map(x=>x.leafBirth))].sort((a,c)=>a-c);
     if (b.length < 4) return { short: s*7919 };
     if (midLockedOf(b[1])) l2.push(s*7919);
     if (midLockedOf(b[2])) l3.push(s*7919);
     for (const lb of b.slice(3)) if (midLockedOf(lb)) { l4p.push(s*7919); break; } }
   return { l2, l3, l4p }; };
 const on = scan(true), off = scan(false);
 /* ④ 목적 — 창턱+등1(6.02) · 코어 걸음(밝기 1.25배 적립) · 초보 · ✂ 문은 게임과 같은 두 문 */
 const walk = (seed) => {
   plantSeed(seed); setPrologueVarieLeaves([2,3]); resetDailyLight(); setGrowth(45);
   const S = { sim:{ mode:'novice' }, tutorial:{}, pots:[{ id:'p1', cuts:[] }], cuttings:[] };
   let credit=0;
   for (let k=1; k<=400; k++){
     let steps=1; if(!growthBlocked()){ credit+=1.25; steps=Math.min(2,Math.floor(credit+1e-9)); credit-=steps; steps=Math.max(1,steps); }
     for(let i=0;i<steps;i++){ setDailyLight(6.02); advanceTo(calendarDay()+1); }
     const vm = varieStateAll().filter(v=>v.varie && matureOf(v.leafBirth) && !leafDroppedOf(v.leafBirth)).length;
     const nodes = cuttableNodes()||[];
     if (nodes.some(n=>pr.cutBlockedReason(S,nodes,n.nodeId,{pot:S.pots[0], varieMaturedLeaves:vm})==null)) return k;
   }
   return null; };
 return JSON.stringify({ on, off, w2: walk(617682), w3: walk(237570) });
})()`, true, 1800000));

let fail = 0;
const ok = (c, m) => { console.log((c ? '✅ ' : '⛔ ') + m); if (!c) fail++; };
if (r.on.short || r.off.short) ok(false, `잎이 4장까지 안 자란 판이 있다(씨앗 ${r.on.short || r.off.short}) — 재는 판이 틀렸다`);
else {
  ok(r.on.l2.length === 0 && r.on.l3.length === 0,
     `① 첫 그루 잠김 — 잎2 ${r.on.l2.length}/${N} · 잎3 ${r.on.l3.length}/${N}` + ([...r.on.l2, ...r.on.l3].length ? ' — ' + [...r.on.l2, ...r.on.l3].slice(0,5).join(',') : ''));
  ok(r.off.l2.length > 0 && r.off.l3.length > 0,
     `② 씨앗 그루(같은 씨앗) 잠김 — 잎2 ${r.off.l2.length}/${N} · 잎3 ${r.off.l3.length}/${N} — 하나라도 0 이면 예외가 다른 그루로 샌 것이다`);
  ok(r.on.l4p.length > 0, `③ 첫 그루 잎4 부터 잠김 ${r.on.l4p.length}/${N} — 0 이면 예외가 보장 잎 밖으로 넓어진 것이다`);
}
ok(r.w2 != null, `④ 잎2 가 잠겼던 617682 — ${r.w2 != null ? '도착 후 ' + r.w2 + '일에 ✂ 열림' : '400일 안에 ✂ 안 열림'}`);
ok(r.w3 != null, `④ 잎3 이 잠겼던 237570 — ${r.w3 != null ? '도착 후 ' + r.w3 + '일에 ✂ 열림' : '400일 안에 ✂ 안 열림'}`);
console.log('\nprologue_leaf3_unlocked: ' + (fail ? 'FAIL' : 'PASS'));
process.exitCode = fail ? 1 : 0;
await page.close();
