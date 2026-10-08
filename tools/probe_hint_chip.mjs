/* tools/probe_hint_chip.mjs — **시트 문을 짚는 손가락이 할 일 칩을 덮나** (2026-10-08 · [plan] plan-friction-7-8-14 #8)
   ------------------------------------------------------------------
   났던 일: 시트가 목표를 덮으면 손가락이 열린 탭을 짚고 「할 일이 가려졌습니다 — 한 번 더 누르면 닫힙니다」 —
            그 말풍선이 오른쪽 위 「📜 할 일」 칩을 83~95% 덮어 막 바뀐 칩 글이 안 보였다.
   고친 것: 글 「한 번 더 누르면 닫힙니다」(한 상수) · 칩과 겹치면 말풍선을 대상 «아래»로 · 그래도 겹치면 «왼쪽».
   잰다: 첫날(시루 놓기 손가락) 시트를 열어 문 손가락이 뜨게 한 뒤 — 말 · 칩과 겹친 넓이(칩 넓이 대비 %).
   판: W×H(기본 폰 390×844 · 넓은 판 W=1770 H=1188). ⛔ 값 0. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:9300';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 240000, 500);
await sleep(3500);
const J = async (e) => JSON.parse(await page.eval(`(()=>{ try { return JSON.stringify((${e})); } catch(e) { return JSON.stringify({ 탈:e.message }); } })()`));
for (let i = 0; i < 60; i++) { const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break;
  await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(140); }
let fail = 0;
const ok = (c, msg, got) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${msg}${got !== undefined ? ' → ' + JSON.stringify(got) : ''}`); if (!c) fail++; };
const read = () => J(`(()=>{ const h=document.getElementById('hint'), c=document.getElementById('questChip');
  const a=h.getBoundingClientRect(), b=c.getBoundingClientRect();
  const ix=Math.max(0, Math.min(a.right,b.right)-Math.max(a.left,b.left)), iy=Math.max(0, Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  return { on: h.classList.contains('on'), say: ((h.querySelector('.say')||{}).textContent||'').trim(), cls: h.className,
           target: (document.querySelector('.hintTarget')||{}).id || null,
           overlapPct: b.width*b.height ? Math.round(ix*iy/(b.width*b.height)*100) : null, chipVis: getComputedStyle(c).visibility,
           hint: { l: Math.round(a.left), t: Math.round(a.top), r: Math.round(a.right), b: Math.round(a.bottom) },
           chip: { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) } }; })()`);
/* 시루를 손가락대로 놓는다 — 그 뒤 손가락 목표가 «방 안»(내 캐릭터)이라 시트가 그것을 덮는다 */
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(80); await m('mouseReleased', x, y, 0); await sleep(700); };
for (let i = 0; i < 8; i++) {
  const placed = await J(`(()=>{ try { return window.__S().firstPlay.beansprout.pots.some(p=>p && (p.slotId || p.at)); } catch(e) { return false; } })()`);
  const say = await J(`(()=>{ const h=document.getElementById('hint'); return h ? ((h.querySelector('.say')||{}).textContent||'').trim() : ''; })()`);
  if (placed && !/둘까요/.test(say)) break;
  const at = await J(`(()=>{ const t=document.querySelector('.hintTarget'); if(!t) return null; const r=t.getBoundingClientRect(); return r.width>0 ? { x:r.left+r.width/2, y:r.top+r.height/2 } : null; })()`);
  if (!at) break; await tapAt(at.x, at.y);
  for (let k = 0; k < 40; k++) { const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break;
    await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(140); }
}
await sleep(800);
const before = await read();
console.log('■ 첫 손가락 —', JSON.stringify({ say: before.say, target: before.target }));
let r = null;
for (const tab of ['plants', 'bag', 'shop']) {
  await page.eval(`(()=>{ try { window.__byeotSheet.open('${tab}'); } catch(e){} })()`, false);
  await sleep(600);
  await page.eval(`(()=>{ try { window.__byeotHint && window.__byeotHint(); } catch(e){} })()`, false);
  await sleep(400);
  r = await read();
  console.log(`■ 시트 [${tab}] 연 뒤 —`, JSON.stringify(r));
  if (/닫힙니다/.test(r.say)) break;
}
if (r && /닫힙니다/.test(r.say)) {
  ok(r.say === '한 번 더 누르면 닫힙니다', '#8 글 — 「한 번 더 누르면 닫힙니다」(탭 이름·「할 일」 없음)', r.say);
  ok(r.overlapPct === 0, `#8 말풍선이 할 일 칩을 안 덮는다(겹친 넓이 ${r.overlapPct}%)`, { hint: r.hint, chip: r.chip, cls: r.cls });
  /* ★ 대조 — 짧아진 글이 «원래» 안 겹친 것일 수 있다. 칩을 말풍선 자리로 옮겨 «피하기»가 실제로 비키는지 본다(칩은 끝에 되돌린다) */
  await page.eval(`(()=>{ const c=document.getElementById('questChip'); const h=document.getElementById('hint').getBoundingClientRect();
    c.dataset.probeStyle = c.getAttribute('style') || ''; c.style.position='fixed'; c.style.left=(h.left)+'px'; c.style.top=(h.top)+'px'; c.style.right='auto';
    c.style.width=(h.width)+'px'; c.style.height=(h.height)+'px'; c.style.minWidth='0'; c.style.maxWidth='none'; c.style.overflow='hidden'; c.style.boxSizing='border-box';
    window.__byeotHint && window.__byeotHint(); })()`, false);
  await sleep(400);
  const r2 = await read();
  console.log('■ 대조(칩을 말풍선 자리로) —', JSON.stringify({ cls: r2.cls, overlapPct: r2.overlapPct, hint: r2.hint, chip: r2.chip }));
  ok(/below|side/.test(r2.cls) && r2.overlapPct === 0, '#8 대조 — 칩과 겹치면 말풍선이 비킨다(아래 또는 왼쪽)', { cls: r2.cls, overlapPct: r2.overlapPct });
  await page.eval(`(()=>{ const c=document.getElementById('questChip'); c.setAttribute('style', c.dataset.probeStyle||''); })()`, false);
} else console.log('  INFO 이 판에서는 시트 문 손가락이 안 떴다 — 시트가 목표를 안 덮는 크기다', r && r.say);
await page.close(); clearTimeout(wd);
console.log(fail ? `\nprobe_hint_chip: FAIL ${fail}` : '\nprobe_hint_chip: PASS');
process.exit(fail ? 1 : 0);
