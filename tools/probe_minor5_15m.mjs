/* 비판 다섯째 판 #15 셋째 가름 자(core 11-01) — «놓인 것 메뉴 여섯째 줄이 [다음 날] 단추에 가림»(d17_006_siru2) — 390×844
   판: 총괄 humanQ g premove(반지하 Day 134) · 방의 시루(그리고 몬스테라) 하나씩을 진짜로 눌러 메뉴(#plantActions)를 띄운다
   잰다: 메뉴 단추마다 네모 · [다음 날](#next) 네모와 겹치나 · 그 단추 가운데 점에서 잡히는 것 · 사진
   단언(11-01 #15 고침): ㉯ 놓인 것 메뉴 단추가 [다음 날] 밑에 안 깔린다(가운데 점에서 그 단추가 잡힘) · 예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-master/d_66841206/humanQ/humanQ_g_premove.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1500);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(60); await m('mouseReleased', x, y, 0); };
const pts = await J(`(()=>{ const c=document.getElementById('roomCanvas').getBoundingClientRect(); return (window.__rv.plants()||[]).map(p=>{ const s=window.__rv.screenPosOf(p.key); return s ? { key:p.key, id:p.potId, x:c.left+s.x, y:c.top+s.y } : null; }).filter(Boolean); })()`);
console.log('  그루', pts.length, JSON.stringify(pts.slice(0, 6).map(p => [p.id, Math.round(p.x), Math.round(p.y)])));
let k = 0; let menus = 0, hiddenAll = [];
for (const p of pts.filter((q, i) => i < 12)) {
  await page.eval(`(()=>{ const x=document.getElementById('pickClose') || document.getElementById('plantClose'); if (x && x.offsetParent) x.click(); return 1; })()`, false); await sleep(300);
  /* ★ 그루 점이 시루 묶음 이름표 · 말풍선에 가려지면 그것이 눌린다(회귀 한 번 — 메뉴 대신 시트) · 방 캔버스가 잡히는 둘레 점을 고른다 */
  const tp = await J(`(()=>{ const x0=${p.x}, y0=${p.y}; let best=null;
    for (let r = 0; r <= 30 && !best; r += 3) for (let a = 0; a < 360; a += 30) { const x = x0 + r * Math.cos(a * Math.PI / 180), y = y0 + r * Math.sin(a * Math.PI / 180);
      const e = document.elementFromPoint(x, y); if (e && e.id === 'roomCanvas') { best = { x, y, r }; break; } if (r === 0) break; }
    return best; })()`);
  if (!tp || tp.탈) continue;
  const pre = await J(`(()=>{ const d=document.getElementById('hintDim'); const h=window.__hintLast||null; const e=document.elementFromPoint(${tp.x}, ${tp.y}); const e0=document.elementFromPoint(${p.x}, ${p.y}); const at0 = e0 ? (e0.id || String(e0.className).slice(0,40)) + '|' + ((e0.textContent||'').trim().slice(0,20)) + '|' + (e0.parentElement ? (e0.parentElement.id || String(e0.parentElement.className).slice(0,30)) : '') : null;
    return { dim: !!(d && d.classList.contains('on')), hint: h && (h.say || h.id), at: e ? (e.id || String(e.className).slice(0,30)) : null, coach: (document.getElementById('coach')||{classList:{contains:()=>false}}).classList.contains('on'), cls: document.getElementById('stage').className.slice(0,80), at0 }; })()`);
  if (process.env.M15M_DBG) console.log('    누르기 전', JSON.stringify({ tp, pre }));
  await tapAt(tp.x, tp.y); await sleep(1000);
  const r = await J(`(()=>{ const pa=document.getElementById('plantActions'); const on=document.getElementById('stage').classList.contains('picked') && pa && getComputedStyle(pa).display!=='none'; if (!on) return { on:false };
    const nx=document.getElementById('next').getBoundingClientRect(); const hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    const btns=[...pa.querySelectorAll('button')].filter(b=>b.offsetParent && getComputedStyle(b).display!=='none').map(b=>{ const q=b.getBoundingClientRect(); const e=document.elementFromPoint(q.left+q.width/2, q.top+q.height/2);
      return { t:(b.textContent||'').trim().slice(0,16), y:[Math.round(q.top),Math.round(q.bottom)], overNext: hit(q,nx), seen: !!(e && (e===b || b.contains(e))), at: e ? (e.id || (e.className||'').toString().slice(0,20)) : null }; });
    const q=pa.getBoundingClientRect(); return { on:true, menu:[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)], next:[Math.round(nx.left),Math.round(nx.top),Math.round(nx.right),Math.round(nx.bottom)], btns }; })()`);
  const hidden = r.on ? r.btns.filter(b => !b.seen) : []; if (r.on) menus++; hiddenAll.push(...hidden.map(h => p.id + ':' + h.t + '@' + h.at));
  console.log(`  ${p.id}`, JSON.stringify({ on: r.on, menu: r.menu, next: r.next, n: r.on ? r.btns.length : 0, hidden }));
  if (OUT && r.on && (hidden.length || k === 0) && k < 3) { await page.shot(`${OUT}/390_m15m_${k++}.png`); }
}
ok(menus > 0, '판 — 놓인 것을 누르니 메뉴가 섰다', String(menus));
ok(hiddenAll.length === 0, '㉯ 메뉴 단추가 [다음 날] 밑에 안 깔린다', JSON.stringify(hiddenAll.slice(0, 4)));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_minor5_15m: 빨강 ${bad}` : 'probe_minor5_15m: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
