/* tools/probe_remountable.mjs — **방을 «다시» 짓는 길이 헤드리스에서 되나** (자를 먼저 잰다)
   ------------------------------------------------------------------
   이사 뒤 원룸이 안 서면서 「방을 그리지 못했습니다 — Cannot read properties of null (reading 'precision')」
   가 떴다. 그 말은 ★ WebGL 판(context)을 «못 얻었다»는 말이다.
   ⇒ ⚠ 그러면 「이사가 깨진 것」인지 「헤드리스에서 판을 두 번 못 여는 것」인지 갈라야 한다.
     ⇒ 그래서 **이사를 안 하고** 같은 방을 그대로 다시 짓는다 — 하나만 다르게(견줌의 계율).
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 240000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
console.log('■ 처음 —', await page.eval(`JSON.stringify({ 방:window.__S().home.room, 섰나:!!window.__rv })`));
const t = Date.now();
await page.eval(`(async()=>{ try{ await window.__remount(); }catch(e){ window.__remountErr=e.message; } })()`, false);
let ok = null;
for (let i = 0; i < 100; i++) { await sleep(1000); if (await page.eval(`String(!!window.__rv)`) === 'true') { ok = Date.now() - t; break; } }
console.log('■ 같은 방을 다시 지었더니 —', ok == null ? '★ 안 섰습니다' : `${ok} ms 만에 섰습니다`);
console.log('■ 덮개 —', await page.eval(`(()=>{ const fb=document.getElementById('roomFallback');
  return JSON.stringify({ 보이나:!!(fb&&fb.style.display!=='none'), 말: fb?(fb.textContent||'').trim().slice(0,140):null,
    던진말: window.__remountErr||null }); })()`));
await page.close(); clearTimeout(wd);
