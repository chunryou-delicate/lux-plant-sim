/* ============================================================
   tools/probe_leafm.mjs — **「자란 정도」(leafM)가 실제로 0→1 로 도나**
   ------------------------------------------------------------
   박사님 2026-08-25: *"그루값은 «자란 정도에 따라» 달리 값을 책정한다."*
   [growth] 가 낸 값: `leafM = clamp01((T - leafBirth) / P.matSpan)` (plant_grow:2438 등).
   ⚠ 그런데 [growth] 스스로 밝혔다 — **「leafM 이 실제로 0→1 로 도는지 «찍어 보지는 않았다»」**.
   ⇒ ★ 그래서 «눌러서» 본다. 하루씩 밀며 잎마다 찍는다.

   ★ 세 창구를 맞물려 셈한다 — 어느 하나라도 없으면 «비례를 못 만든다»
     leafStats().growthDays   지금 T
     leafStageParams().matSpan 나눌 폭
     leafRows()[].leafBirth    잎마다 태어난 때
   ⚠ 어댑터가 지금 `matured` 하나만 옮기므로(growth_adapter:451) 여기서는 «원본 접근자»를 직접 부른다.

     python tools/serve.py 8972 .
     BYEOT_URL=http://localhost:8972 node tools/probe_leafm.mjs
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const DAYS = Number(process.env.BYEOT_LEAFM_DAYS || 24);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 600000);
wd.unref && wd.unref();

const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);

const read = async () => page.eval(`(()=>{ try{
  const io = window.__io;
  const g = io && io.growth;
  if (!g) return JSON.stringify({ err: 'io.growth 가 없다' });
  const st  = g.leafStats  ? g.leafStats()  : null;
  const par = g.leafStageParams ? g.leafStageParams() : null;
  const rows = g.leafState ? g.leafState() : null;
  return JSON.stringify({
    have: { leafStats: !!st, leafStageParams: !!par, leafState: !!rows },
    growthDays: st ? st.growthDays : null,
    leaves: st ? st.leaves : null, varie: st ? st.variegatedLeaves : null,
    matSpan: par ? par.matSpan : null,
    rows: Array.isArray(rows) ? rows.map(r => ({ lb: r.leafBirth, varie: !!r.varie,
                                                 matured: !!r.matured, dropped: !!r.dropped })) : null
  });
} catch(e){ return JSON.stringify({ err: e.message }); } })()`);

const first = JSON.parse(await read());
console.log('■ 창구가 있나 —', JSON.stringify(first.have || first.err));
if (first.err || !first.have || !first.have.leafStageParams) {
  console.log('⛔ `leafStageParams` 가 어댑터에 «안 나와 있다» — 그러면 leafM 을 못 셈한다.');
  console.log('   ⇒ ★ 그것부터 이어야 한다(growth_adapter). 여기서 끝낸다.');
  await page.close(); clearTimeout(wd); process.exit(0);
}
console.log(`   matSpan = ${first.matSpan}`);

const line = (s) => {
  if (s.err) return '  ✘ ' + s.err;
  const M = (lb) => (s.growthDays == null || !s.matSpan) ? null
    : Math.max(0, Math.min(1, (s.growthDays - lb) / s.matSpan));
  const cells = (s.rows || []).map(r => {
    const m = M(r.lb);
    return `lb${r.lb}:${m == null ? '?' : m.toFixed(2)}${r.varie ? 'v' : ''}${r.matured ? 'M' : ''}`;
  });
  return `  T=${String(s.growthDays).padStart(4)} 잎${s.leaves}/무늬${s.varie}  ` + cells.join(' ');
};
console.log('\n■ 하루씩 밀며 — lb{태어난때}:{leafM} (v 무늬 · M 다 자람)');
console.log(line(first));
for (let i = 0; i < DAYS; i++) {
  await page.eval(`(()=>{ const b=document.getElementById('next'); if(b && !b.disabled) b.click(); })()`, false);
  await sleep(700);
  /* 밥상·가계부를 지난다 */
  for (let k = 0; k < 6; k++) {
    const did = await page.eval(`(()=>{ const up=(id)=>{const e=document.getElementById(id);
      return !!e && e.getAttribute('aria-hidden')==='false';};
      const hit=(id)=>{const b=document.getElementById(id); if(!b||b.disabled) return false; b.click(); return true;};
      if (up('reliefBox') && hit('reliefOk')) return '1';
      if (up('monthPanel') && hit('monthClose')) return '1';
      if (up('mealPanel') && hit('mealGo')) return '1';
      if (up('buyPanel') && hit('buyCancel')) return '1';
      const d=document.getElementById('dlgNext'); if(d) { d.click(); return '1'; }
      return ''; })()`);
    if (!did) break;
    await sleep(200);
  }
  await sleep(300);
  const s = JSON.parse(await read());
  if (i % 3 === 2 || i === DAYS - 1) console.log(line(s));
}
console.log('\n⇒ ★ 값이 «0 에서 1 로 곧게 오르면» 비례를 만들 수 있다.');
console.log('   ⚠ 1 에서 멎으면 그 뒤로는 못 가른다 — 「다 자란 뒤」는 leafM 이 다 1 이다.');
await page.close(); clearTimeout(wd);
