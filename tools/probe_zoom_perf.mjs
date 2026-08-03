/* 화분 상세보기(확대)가 왜 렉이 걸리나. 방과 iframe 둘 다 도는지 센다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 120000, 300);
await sleep(7000);
await page.eval(`(()=>{try{document.getElementById('dlgSkip').click()}catch{}})()`, false); await sleep(1000);
await page.eval(`(()=>{try{document.getElementById('guideClose').click()}catch{}})()`, false); await sleep(600);

/* 방과 iframe 의 프레임을 각각 센다 */
const install = `(()=>{
  window.__fr = { room: 0, zoom: 0 };
  const tick = () => { window.__fr.room++; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  const f = document.getElementById('growth');
  try { const w = f.contentWindow;
    const t2 = () => { window.__fr.zoom++; w.requestAnimationFrame(t2); }; w.requestAnimationFrame(t2); } catch(e) { window.__fr.err = e.message; }
})()`;
const measure = async (label, ms) => {
  await page.eval(`window.__fr.room=0; window.__fr.zoom=0`, false);
  const s0 = await page.eval(`window.__rv.stats()`);
  await sleep(ms);
  const s1 = await page.eval(`window.__rv.stats()`);
  const fr = await page.eval(`window.__fr`);
  console.log(label, JSON.stringify({ 초당rAF: { 창: Math.round(fr.room/(ms/1000)), 확대: Math.round(fr.zoom/(ms/1000)) },
    방그린수: s1.drawn - s0.drawn, 삼각형: s1.triangles, 콜: s1.calls }));
};
await page.eval(install, false);
await measure('닫힘', 2500);
await page.eval(`window.__byeotZoom.open()`, false); await sleep(2500);
await measure('열림', 2500);
/* 확대 중에 방이 계속 그려지나 · iframe 이 화면을 실제로 덮나 */
const z = await page.eval(`(()=>{ const f=document.getElementById('growth'), r=f.getBoundingClientRect();
  const cs=getComputedStyle(f);
  const mid=document.elementFromPoint(innerWidth/2, innerHeight/2);
  return { iframe:{w:Math.round(r.width),h:Math.round(r.height),z:cs.zIndex,pe:cs.pointerEvents,disp:cs.display},
           가운데요소: mid && (mid.id||mid.tagName),
           방일시정지: typeof window.__rv.setContinuous }; })()`);
console.log('확대상태', JSON.stringify(z));
await page.close();
