/* 확대 화면(plant_grow.html iframe) 자체가 얼마나 무거운가.
   방은 이미 멈췄다 — 남은 렉은 이 안에 있다. */
import { launch, sleep } from './test_cdp.mjs';

/* ★자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다.
   이게 없어서 측정 하나가 21시간 매달려 있었다. 헤드리스 크롬은 무언가를
   기다리다 영영 안 끝나는 일이 실제로 생긴다. 시간은 환경변수로 늘릴 수 있다. */
const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한 ' + Math.round(_WATCHDOG_MS / 1000) + '초를 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const net = [];
page.on((m, p) => { if (m === 'Network.responseReceived')
  net.push({ url: p.response.url, len: p.response.encodedDataLength || 0 }); });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 120000, 300);
await sleep(8000);
await page.eval(`(()=>{try{document.getElementById('dlgSkip').click()}catch{}})()`, false); await sleep(1000);
await page.eval(`(()=>{try{document.getElementById('guideClose').click()}catch{}})()`, false); await sleep(600);

const inZoom = (expr) => page.eval(`(()=>{ const w = document.getElementById('growth').contentWindow;
  try { return (${expr}); } catch(e) { return { err: String(e && e.message || e) }; } })()`);

console.log('열기 전 iframe 상태', JSON.stringify(await inZoom(`({
  renderer: !!w.renderer, scene: !!w.scene,
  info: w.renderer ? { calls: w.renderer.info.render.calls, tris: w.renderer.info.render.triangles,
                       geo: w.renderer.info.memory.geometries, tex: w.renderer.info.memory.textures } : null,
  pixelRatio: w.renderer ? w.renderer.getPixelRatio() : null,
  size: w.renderer ? (()=>{const s=new w.THREE.Vector2(); w.renderer.getSize(s); return [s.x,s.y];})() : null
})`)));

await page.eval(`window.__byeotZoom.open()`, false);
await sleep(2500);
/* 확대 안에서 프레임을 센다 */
await page.eval(`(()=>{ const w=document.getElementById('growth').contentWindow;
  w.__n=0; const t=()=>{ w.__n++; w.requestAnimationFrame(t); }; w.requestAnimationFrame(t); })()`, false);
const t0 = Date.now(); await sleep(3000);
const n = await inZoom(`w.__n`);
console.log('확대 rAF', JSON.stringify({ 초당: Math.round(n / ((Date.now()-t0)/1000)) }));
console.log('확대 그리기', JSON.stringify(await inZoom(`({
  calls: w.renderer.info.render.calls, tris: w.renderer.info.render.triangles,
  geo: w.renderer.info.memory.geometries, tex: w.renderer.info.memory.textures,
  pixelRatio: w.renderer.getPixelRatio(),
  size: (()=>{const s=new w.THREE.Vector2(); w.renderer.getSize(s); return [s.x,s.y];})(),
  paused: typeof w.renderPaused === 'function' ? w.renderPaused() : null
})`)));
/* 회전 — 안쪽 캔버스에 드래그를 흘려 카메라가 도는지 */
const rot = await page.eval(`(async ()=>{ const f=document.getElementById('growth'), w=f.contentWindow, d=w.document;
  const c = d.querySelector('canvas'); if (!c) return { err: '캔버스 없음' };
  const r = c.getBoundingClientRect();
  const before = w.camera ? { x:+w.camera.position.x.toFixed(3), z:+w.camera.position.z.toFixed(3) } : null;
  const cx = r.left + r.width/2, cy = r.top + r.height/2;
  c.dispatchEvent(new w.MouseEvent('mousedown',{clientX:cx,clientY:cy,bubbles:true}));
  for (let i=1;i<=8;i++) w.dispatchEvent(new w.MouseEvent('mousemove',{clientX:cx+i*14,clientY:cy,bubbles:true}));
  w.dispatchEvent(new w.MouseEvent('mouseup',{clientX:cx+112,clientY:cy,bubbles:true}));
  await new Promise(r2=>setTimeout(r2,600));
  const after = w.camera ? { x:+w.camera.position.x.toFixed(3), z:+w.camera.position.z.toFixed(3) } : null;
  return { before, after, 돌았나: before&&after ? (Math.abs(before.x-after.x)+Math.abs(before.z-after.z)) > 0.05 : null,
           캔버스: [Math.round(r.width), Math.round(r.height)] }; })()`);
console.log('회전', JSON.stringify(rot));
const big = net.filter(x => x.len > 400_000).sort((a,b)=>b.len-a.len).slice(0,8)
  .map(x => `${(x.len/1e6).toFixed(1)}MB ${x.url.split('/').slice(-2).join('/')}`);
console.log('큰 파일', JSON.stringify(big));
console.log('총 받은 바이트', (net.reduce((a,x)=>a+x.len,0)/1e6).toFixed(1) + 'MB', '요청', net.length);
await page.close();
