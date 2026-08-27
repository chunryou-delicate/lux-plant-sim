/* tools/probe_roommove_touch.mjs — **방에 «놓인» 화분을 폰에서 옮길 수 있나** (㉡)
   ------------------------------------------------------------------
   총괄 2026-08-27: *"「옮기다」는 이쪽 말입니다 — 방 안에서 «자리를 옮기는 것»."*
   ⚠ 나는 이틀 ㉠(가방 → 방)만 쟀다. 박사님 말씀은 ㉡(방 → 방)일 수 있다.
   재는 것 셋(총괄이 짚은 그대로):
     ① 방 안 화분을 «그냥 끌면» 무슨 일이 나나 — 옮겨지나, 방만 도나
     ② 눌렀을 때 고르기 바가 «폰 화면 안»에 뜨나 — [옮기기]가 손에 닿나
     ③ [옮기기] 뒤에 «갈 자리»를 사람이 아나 — 무슨 글이 뜨고, 끌면 정말 옮겨지나
   ⛔ 값은 아무것도 안 바꾼다. 세우고 누르고 읽기만 한다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);

/* 말풍선·안내를 걷는다 */
for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (busy !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}

/* ── 세우기 — 화분 하나를 «책상»에 놓인 꼴로. 도착 직후 튜토리얼과 같은 자리다 */
console.log('■ 세우기 —', await page.eval(`(()=>{ try{
  const S = window.__S();
  S.pots = S.pots || [];
  let p = S.pots[0];
  if (!p) { p = { id:'pot_probe', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
                  cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
                  arrivalGrowthDays:0, dliHist:[] };
            S.pots.push(p); }
  p.placedOnce = true; p.slotId = 'banjiha-desk:0'; p.at = null;
  window.__redraw();
  return JSON.stringify({ id: p.id, slotId: p.slotId, pots: S.pots.length });
} catch(e){ return JSON.stringify({ err: e.message }); } })()`));
await sleep(2000);
/* ★ 그리기까지 되었나 — 안 그려졌으면 아래를 재봐야 거짓말이 된다 */
const drawn = await page.eval(`(()=>{ try{ return String(!!window.__byeotIsPlantSlot('banjiha-desk:0')); }
  catch(e){ return 'err:'+e.message; } })()`);
console.log('■ 방이 그 자리를 «식물 자리»로 보나 —', drawn);


/* 그 화분이 «화면 어디»에 서 있나 */
const pos = JSON.parse(await page.eval(`(()=>{ try{
  const rv = window.__rv; const r = document.getElementById('roomCanvas').getBoundingClientRect();
  const p = rv.screenPosOf('banjiha-desk:0');
  if (!p) return JSON.stringify({ err: 'screenPosOf 가 null' });
  return JSON.stringify({ x: Math.round(r.left + p.x), y: Math.round(r.top + p.y) });
} catch(e){ return JSON.stringify({ err: e.message }); } })()`));
console.log('■ 화분 자리 —', JSON.stringify(pos));
if (pos.err) { await page.close(); clearTimeout(wd); process.exit(0); }

const snap = () => page.eval(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0];
  const pk = window.__picked||{};
  return JSON.stringify({ slotId: p? p.slotId : null, at: p&&p.at? 1:0,
    mode: pk.mode||null, picked: pk.slotId||null,
    moving: document.getElementById('stage').classList.contains('moving'),
    label: (document.getElementById('dropLabel')||{}).textContent || '' }); })()`);

const touch = async (x0, y0, dx, dy, steps = 6) => {
  const p = { x: x0, y: y0, radiusX: 12, radiusY: 12, force: 1, id: 1 };
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await sleep(90);
  for (let i = 1; i <= steps; i++)
    { await page.send('Input.dispatchTouchEvent', { type: 'touchMove',
        touchPoints: [{ ...p, x: x0 + dx * i / steps, y: y0 + dy * i / steps }] }); await sleep(50); }
  const mid = JSON.parse(await snap());
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(700);
  return { mid, end: JSON.parse(await snap()) };
};

const camOf = () => page.eval(`(()=>{ try{ const c=window.__rv.three.camera.position;
  return JSON.stringify({x:+c.x.toFixed(2),y:+c.y.toFixed(2),z:+c.z.toFixed(2)}); }
  catch(e){ return JSON.stringify({err:1}); } })()`);

/* ── ① 그냥 끌면? */
console.log('\n=== ① 방 안 화분을 «그냥» 끌었다 (누르지 않고, 옮기기도 안 누르고) ===');
console.log('  끌기 전 —', await snap());
const cam0 = await camOf();
const r1 = await touch(pos.x, pos.y, 0, -160);
console.log('  끄는 중 —', JSON.stringify(r1.mid));
console.log('  놓은 뒤 —', JSON.stringify(r1.end));
console.log('  카메라 전 —', cam0, ' 후 —', await camOf());

/* ── ② 눌러서 고르기 — [옮기기]가 화면 안에 있나 */
console.log('\n=== ② 화분을 «눌렀다» — 고르기 바와 [옮기기] ===');
await page.eval(`(()=>{ try{ window.__picked.clear(); }catch(e){} })()`, false);
await sleep(300);
await page.send('Input.dispatchTouchEvent', { type: 'touchStart',
  touchPoints: [{ x: pos.x, y: pos.y, radiusX: 12, radiusY: 12, force: 1, id: 1 }] });
await sleep(80);
await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(1200);
console.log('  누른 뒤 —', await snap());
console.log('  [옮기기] —', await page.eval(`(()=>{ const b=document.getElementById('pickMove');
  if(!b) return '단추가 «없다»';
  const r=b.getBoundingClientRect(), cs=getComputedStyle(b);
  const cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
  const h=document.elementFromPoint(cx,cy);
  const bar=b.closest('#pickBar')||b.parentElement;
  const bcs=bar?getComputedStyle(bar):null;
  return JSON.stringify({ 보이나: cs.display!=='none'&&cs.visibility!=='hidden'&&+cs.opacity>0.05,
    바보이나: bcs? (bcs.display!=='none'&&bcs.visibility!=='hidden'&&+bcs.opacity>0.05) : null,
    막혔나: !!b.disabled, w:Math.round(r.width), h:Math.round(r.height),
    x:cx, y:cy, 화면안: (cy>0&&cy<844&&cx>0&&cx<390),
    그점에잡히는것: h? (h===b||b.contains(h)? 'OK '+h.tagName : '★COVER '+h.tagName+'.'+
      (typeof h.className==='string'? h.className.trim().split(/\s+/).slice(0,2).join('.'):'')) : 'null' });
})()`));

/* ── ③ [옮기기] 뒤 */
console.log('\n=== ③ [옮기기]를 누른 뒤 — 사람이 다음에 뭘 할지 아나 ===');
await page.eval(`(()=>{ const b=document.getElementById('pickMove'); if(b) b.click(); })()`, false);
await sleep(900);
console.log('  누른 뒤 —', await snap());
console.log('  화면에 뜬 글 —', await page.eval(`(()=>{
  const out=[]; const push=(id)=>{ const e=document.getElementById(id); if(!e) return;
    const cs=getComputedStyle(e); if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<0.05) return;
    const t=(e.textContent||'').trim().replace(/\s+/g,' ').slice(0,80); if(t) out.push(id+': '+t); };
  ['dropLabel','banner','bannerBox','hint','coach','placeConfirm'].forEach(push);
  return out.join(' | ') || '(아무 글도 «없다»)'; })()`));
const r3 = await touch(pos.x, pos.y, 0, -150);
console.log('  끄는 중 —', JSON.stringify(r3.mid));
console.log('  놓은 뒤 —', JSON.stringify(r3.end));
console.log('  ⇒ 옮겨졌나 —', r3.end.slotId !== 'banjiha-desk:0' || r3.end.at ? '★ 옮겨졌다' : '⛔ 그대로다');

await page.close(); clearTimeout(wd);
