/* tools/probe_pick_props.mjs — **반지하 소품을 «눌러서» 고르나 · 캐릭터가 가로채나** (2026-10-08 core · [house] scratchpad pick_props3 를 그대로 옮김)
   진짜 마우스 18점(발자국 9점 × 높이 둘) × 소품 넷 — 누를 때마다 무엇이 골렸나(가구 이름 · 캐릭터 · 없음). resolveTap 남은 반을 재는 자.
   BYEOT_URL(기본 9300) · 390×844. ⛔ 값 0. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:9300';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000); wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`); await page.eval('localStorage.clear()', false); await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300); await sleep(4000);
for (let i = 0; i < 40; i++) {
  const t = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`);
  if (t !== 'true') break;
  await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(200);
}
await page.eval(`(()=>{ try { const S=window.__S(); if (S.firstPlay) S.firstPlay.enabled = false; window.__byeotHint && window.__byeotHint(); window.__redraw && window.__redraw(); } catch(e) {} })()`, false);
let waited = 0; for (; waited < 6000; waited += 100) { const b = await page.eval(`String((()=>{ try { return !!window.__rv.camBusy().tween; } catch(e) { return false; } })())`); if (b !== 'true') break; await sleep(100); }
await sleep(1500);
console.log(`■ 판 ${BASE} · 카메라 멎음까지 ${waited}ms`);
const J = async (e, t = 60000) => JSON.parse(await page.eval(e, true, t));
const UIDS = ['banjiha-nightstand', 'banjiha-drying-rack', 'banjiha-heater', 'banjiha-trash', 'banjiha-backpack'];
const r = await J(`(async()=>{
  const rv=window.__rv, fs=rv.furniture()||[], c=document.getElementById('roomCanvas').getBoundingClientRect(), out={};
  for (const u of ${JSON.stringify(UIDS)}) {
    const f=fs.find(x=>x.uid===u); if(!f){ out[u]='없음'; continue; }
    const s=f.size||{w:0.4,d:0.4,h:0.4}, q=Math.round((((f.rot||0)%180)+180)%180/90)%2, W=q?s.d:s.w, D=q?s.w:s.d;
    const rows=[]; let hit=0, n=0;
    for (const y of [0.05, s.h/2, s.h*0.9]) { let line='';
      for (const [a,b] of [[0,0],[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]]) {
        const p=rv.worldToScreen(f.x+a*W*0.35, y, f.z+b*D*0.35); n++;
        if(!p){ line+='?'; continue; }
        const k=rv.pickFurnitureAt(p.x+c.left, p.y+c.top), id=k&&k.uid;
        if(id===u){ hit++; line+='O'; } else line+= id? (id.replace('banjiha-','')[0]) : '.';
      } rows.push(line); }
    out[u]={ hit, n, rows };
  }
  return JSON.stringify(out);
})()`);
for (const [u, v] of Object.entries(r)) console.log(' ', u.replace('banjiha-', '').padEnd(12), typeof v === 'string' ? v : `${v.hit}/${v.n}  [높이 0.05 | h/2 | 0.9h] ${v.rows.join(' | ')}   (O=제 것 · 다른 글자=그 가구 첫 글자 · .=없음)`);
/* 진짜 마우스 — 건조대 가운데 h/2 를 눌러 메뉴 이름을 본다 */
const tgt = await J(`(()=>{ const rv=window.__rv, f=(rv.furniture()||[]).find(x=>x.uid==='banjiha-drying-rack'), c=document.getElementById('roomCanvas').getBoundingClientRect();
  const p=rv.worldToScreen(f.x, (f.size||{h:0.72}).h/2, f.z); return JSON.stringify({x:p.x+c.left, y:p.y+c.top}); })()`);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
await m('mouseMoved', tgt.x, tgt.y, 0); await m('mousePressed', tgt.x, tgt.y, 1); await sleep(80); await m('mouseReleased', tgt.x, tgt.y, 0); await sleep(900);
const menu = await J(`JSON.stringify({ 이름:(document.getElementById('furnName')||{}).textContent||null, 옮기기: (()=>{ const b=document.getElementById('furnMove'); return !!(b && b.offsetParent!==null); })() })`);
console.log('  진짜 마우스로 건조대 가운데(h/2) 누름 →', JSON.stringify(menu));
/* 진짜 마우스 18점 × 소품 셋 — 누를 때마다 무엇이 골렸나(가구 이름 · 캐릭터 · 없음) */
for (const U of ['banjiha-heater','banjiha-trash','banjiha-backpack','banjiha-drying-rack']) {
  const pts = await J(`(()=>{ const rv=window.__rv, f=(rv.furniture()||[]).find(x=>x.uid===${JSON.stringify(U)}), c=document.getElementById('roomCanvas').getBoundingClientRect();
    const s=f.size, q=Math.round((((f.rot||0)%180)+180)%180/90)%2, W=q?s.d:s.w, D=q?s.w:s.d, out=[];
    for (const y of [0.05, s.h/2]) for (const [a,b] of [[0,0],[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]]) {
      const p=rv.worldToScreen(f.x+a*W*0.35, y, f.z+b*D*0.35); if(p) out.push({x:p.x+c.left,y:p.y+c.top}); }
    return JSON.stringify(out); })()`);
  const names = [];
  for (const p of pts) {
    await page.eval(`(()=>{ try { window.__furn && window.__furn.clear(); } catch(e) {} try { window.__rv.selectCharacter(null); } catch(e) {} })()`, false); await sleep(250);
    await m('mouseMoved', p.x, p.y, 0); await m('mousePressed', p.x, p.y, 1); await sleep(80); await m('mouseReleased', p.x, p.y, 0); await sleep(700);
    const n = await page.eval(`String((()=>{ const n=document.getElementById('furnName'); if (n && n.offsetParent!==null && (n.textContent||'').trim()) return n.textContent.trim();
      try { if (window.__rv.selectedCharacter()) return '캐릭터'; } catch(e) {} return '-'; })())`);
    names.push(n);
  }
  const tally = {}; for (const n of names) tally[n] = (tally[n] || 0) + 1;
  console.log('  ', U.replace('banjiha-',''), '진짜 마우스 18점 →', JSON.stringify(tally));
}
/* ★ 대조 — 천장등을 여전히 고를 수 있나(2026-10-08). 천장이 잘린 시점에선 몸이 숨고 반투명 «유령»만 보인다 —
     유령 둘레 9점(가운데 + 8방 · 반지름의 0.7)을 진짜 마우스로 눌러 몇 점에서 「천장등」이 골리나 */
{ const pts = await J(`(()=>{ const rv=window.__rv, T=window.THREE, th=rv.three, c=document.getElementById('roomCanvas').getBoundingClientRect();
    let node=null; th.scene.traverse(o=>{ if(!node && o.userData && o.userData.uid==='banjiha-lamp-ceiling') node=o; });
    if(!node) return JSON.stringify([]);
    const visUp=o=>{ for(let x=o;x;x=x.parent) if(!x.visible) return false; return true; };
    let best=null; node.traverse(o=>{ if(!o.isMesh || !visUp(o)) return; const bb=new T.Box3().setFromObject(o); const v=bb.getSize(new T.Vector3()); const vol=v.x*v.y*v.z;
      if(!best || vol>best.vol) best={ vol, bb }; });
    if(!best) return JSON.stringify([]);
    const ctr=best.bb.getCenter(new T.Vector3()), sz=best.bb.getSize(new T.Vector3()), out=[];
    for (const [a,b] of [[0,0],[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]]) {
      const p=rv.worldToScreen(ctr.x+a*sz.x*0.35, ctr.y, ctr.z+b*sz.z*0.35); if(p) out.push({ x:p.x+c.left, y:p.y+c.top }); }
    return JSON.stringify(out); })()`);
  const tally = {};
  for (const p of pts) {
    await page.eval(`(()=>{ try { window.__furn && window.__furn.clear(); } catch(e) {} })()`, false); await sleep(250);
    await m('mouseMoved', p.x, p.y, 0); await m('mousePressed', p.x, p.y, 1); await sleep(80); await m('mouseReleased', p.x, p.y, 0); await sleep(700);
    const n = await page.eval(`String((()=>{ const n=document.getElementById('furnName'); return n && n.offsetParent!==null ? (n.textContent||'').trim() : '-'; })())`);
    tally[n] = (tally[n] || 0) + 1;
  }
  console.log(`  대조 — 천장등 유령 둘레 ${pts.length}점 →`, JSON.stringify(tally), (tally['천장등'] || 0) > 0 ? 'OK(아직 고를 수 있다)' : 'FAIL(천장등을 못 고른다)'); }
(process.env.SHOT ? page.shot(process.env.SHOT) : Promise.resolve()).catch(() => {});
await page.close(); clearTimeout(wd);
