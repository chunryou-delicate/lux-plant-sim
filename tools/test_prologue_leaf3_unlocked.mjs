/* ============================================================
   test_prologue_leaf3_unlocked.mjs — 첫 그루 잎3 은 «중간잎 확정»에 안 걸린다 ([growth] 소유)
   ------------------------------------------------------------
   ★ 박사님 2026-10-04 결정(총괄 claude-a3 전달):
     「첫 그루 잎3은 중간잎 확정 3%(mid_lock_pct 0.03)에서 뺀다.」
     목적 — 누구나 빛만 주면 하프문이 갈라져 장면과 자르기(이사 길)가 열리게 한다.
     범위 — 첫 몬스테라(프롤로그 그루)의 3번째 잎만. 다른 잎·다른 그루의 3% 는 그대로.

   ★ 무엇을 지키나 — 넷이다. 하나라도 어긋나면 붉는다.
     ① 첫 그루(보장 켬)의 잎3 은 N판 어디서도 안 잠긴다            ← 결정 그 자체
     ② 같은 씨앗을 씨앗 그루(보장 끔)로 두면 잎3 이 잠기는 판이 있다  ← 예외가 «새지» 않는다
     ③ 첫 그루의 잎2 는 여전히 잠기는 판이 있다                       ← 범위가 잎3 하나뿐이다
     ④ 고치기 전에 잎3 이 잠겼던 판(237570)이 실제로 400일 안에 갈라진다 ← 술어만이 아니라 «동작»
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

const r = JSON.parse(await page.eval(`(()=>{
 const scan = (pro) => { const l2=[], l3=[];
   for (let s=1; s<=${N}; s++){ plantSeed(s*7919); setPrologueVarieLeaves(pro ? [2,3] : []); resetDailyLight(); setGrowth(160);
     const b=[...new Set(leafOnPlantAll().map(x=>x.leafBirth))].sort((a,c)=>a-c);
     if (b.length < 3) return { short: s*7919 };
     if (midLockedOf(b[1])) l2.push(s*7919);
     if (midLockedOf(b[2])) l3.push(s*7919); }
   return { l2, l3 }; };
 const on = scan(true), off = scan(false);
 /* ④ 동작 — 고치기 전 잎3 이 잠겼던 씨앗을 창턱+등1 빛으로 400일 걸린다(코어 걸음: 밝기 1.25배 적립) */
 plantSeed(237570); setPrologueVarieLeaves([2,3]); resetDailyLight(); setGrowth(45);
 let credit=0, l3=null, split=null;
 for (let k=1; k<=400 && split==null; k++){
   let steps=1; if(!growthBlocked()){ credit+=1.25; steps=Math.min(2,Math.floor(credit+1e-9)); credit-=steps; steps=Math.max(1,steps); }
   for(let i=0;i<steps;i++){ setDailyLight(6.02); advanceTo(calendarDay()+1); }
   const b=[...new Set(leafOnPlantAll().filter(x=>x.onPlant).map(x=>x.leafBirth))].sort((a,c)=>a-c);
   if(b[2]!=null && l3==null) l3=b[2];
   if(l3!=null && matureOf(l3)) split=k;
 }
 return JSON.stringify({ on, off, l3, split });
})()`, true, 1800000));

let fail = 0;
const ok = (c, m) => { console.log((c ? '✅ ' : '⛔ ') + m); if (!c) fail++; };
if (r.on.short || r.off.short) ok(false, `잎이 3장까지 안 자란 판이 있다(씨앗 ${r.on.short || r.off.short}) — 재는 판이 틀렸다`);
else {
  ok(r.on.l3.length === 0, `① 첫 그루 잎3 잠김 ${r.on.l3.length}/${N}` + (r.on.l3.length ? ' — ' + r.on.l3.slice(0,5).join(',') : ''));
  ok(r.off.l3.length > 0,  `② 씨앗 그루(같은 씨앗) 잎3 잠김 ${r.off.l3.length}/${N} — 0 이면 예외가 다른 그루로 샌 것이다`);
  ok(r.on.l2.length > 0,   `③ 첫 그루 잎2 잠김 ${r.on.l2.length}/${N} — 0 이면 예외가 잎3 밖으로 넓어진 것이다`);
}
ok(r.split != null, `④ 고치기 전 잠겼던 씨앗 237570 의 잎3 — ${r.split != null ? '도착 후 ' + r.split + '일에 갈라짐' : '400일 안에 안 갈라짐'}`);
console.log('\nprologue_leaf3_unlocked: ' + (fail ? 'FAIL' : 'PASS'));
process.exitCode = fail ? 1 : 0;
await page.close();
