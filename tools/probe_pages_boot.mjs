/* tools/probe_pages_boot.mjs — **깃(Pages)에서 게임이 «왜 안 서나»**
   ------------------------------------------------------------------
   박사님 사진: Firefox(Ubuntu) · 「게임을 불러오는 중… 6초째」에서 «멈춤».
   ⛔ 로컬은 «됩니다». 그러니 로컬로 재면 영영 안 나옵니다 — ★ 깃 주소를 «직접» 엽니다.
   찍는 것: 콘솔 오류 · 실패한 요청(status) · 받은 MIME · 마지막 화면 글.
   쓰기: node tools/probe_pages_boot.mjs   (BYEOT_URL 로 다른 판) */
import { launch, sleep } from './test_cdp.mjs';
const URL = process.env.BYEOT_URL || 'https://chunryou-delicate.github.io/lux-plant-sim/game.html';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
const errs = [], fails = [], mimes = new Map();
page.on((m) => {
  if (m.method === 'Runtime.consoleAPICalled' && /error|warning/.test(m.params.type || ''))
    errs.push('[' + m.params.type + '] ' + (m.params.args || []).map(a =>
      String(a.value !== undefined ? a.value : (a.description || a.unserializableValue || ''))).join(' ').slice(0, 300));
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails || {};
    errs.push('[throw] ' + (d.text || '') + ' ' + ((d.exception || {}).description || '').slice(0, 300));
  }
  if (m.method === 'Network.responseReceived') {
    const r = m.params.response || {};
    if (r.status >= 400) fails.push(r.status + ' ' + String(r.url).slice(-70));
    const u = String(r.url);
    if (/\.(glb|json|js|html|png|webp|mp3|ogg)(\?|$)/i.test(u))
      mimes.set(u.split('/').pop().slice(-40), (r.mimeType || '?') + ' ' + r.status);
  }
  if (m.method === 'Network.loadingFailed')
    fails.push('FAIL ' + (m.params.errorText || '') + ' ' + (m.params.type || ''));
});
await page.send('Network.enable', {});
await page.send('Runtime.enable', {});
console.log('■ 여는 곳 —', URL);
await page.goto(URL);
/* 부팅을 «기다리되» 실패해도 갈무리한다 */
let booted = null;
try { booted = await page.waitFor('window.__byeotBooted === true || !!window.__rv', 60000, 500); }
catch (e) { booted = null; }
console.log('■ 부팅 —', booted != null ? `★ 섰습니다 (${booted}ms)` : '⛔ 60초 안에 «안 섰습니다»');
await sleep(2000);
console.log('\n=== 화면에 뜬 글 ===');
console.log(await page.eval(`(()=>{ const out=[];
  for (const id of ['boot','bootMsg','loading','splash','errBox','gpuInfo','quest','money','stam']) {
    const e=document.getElementById(id); if(!e) continue;
    const t=(e.textContent||'').trim().replace(/\s+/g,' ').slice(0,80); if(t) out.push(id+': '+t); }
  const b=document.body; out.push('body 첫 120자: '+(b.innerText||'').trim().replace(/\s+/g,' ').slice(0,120));
  return out.join('  //  '); })()`));
console.log('\n=== 콘솔 오류 —', errs.length, '개 ===');
console.log(errs.slice(0, 14).map(x => '  ' + x).join('\n') || '  (없음)');
console.log('\n=== 실패한 요청 —', fails.length, '개 ===');
console.log([...new Set(fails)].slice(0, 20).map(x => '  ' + x).join('\n') || '  (없음)');
console.log('\n=== 받은 MIME (몇 가지) ===');
console.log([...mimes.entries()].slice(0, 18).map(([k, v]) => '  ' + k + ' → ' + v).join('\n') || '  (없음)');
await page.shot('docs/handoff/img/pages_boot.png');
await page.close(); clearTimeout(wd);
