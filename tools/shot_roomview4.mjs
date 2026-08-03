/* ============================================================
   tools/shot_roomview4.mjs — 방 뷰 4차(뒷걸음질·재선택 해제) 그림 증거
   ------------------------------------------------------------
     python tools/serve.py 8981
     node tools/shot_roomview4.mjs

   docs/engine/shots/roomview4_*.png 로 남긴다. 폰 세로(390×844 · dpr2).
     walk_start  걷기 시작 — 몸이 가는 쪽으로 돌아서는 중
     walking     걷는 중 — 가는 쪽을 보고 있다(뒷걸음질이 아니다)
     arrived     도착 — 카메라(플레이어) 쪽을 보고 선다
     sel_on      캐릭터를 한 번 눌렀다 — 발밑 주황 링
     sel_off     같은 캐릭터를 다시 눌렀다 — 링이 사라진다

   ★ 그림 옆에 **숫자**도 같이 찍는다(진행 각 vs 몸 각). 작은 캐릭터의 앞뒤는
     그림만으로는 우기기 좋다 — 숫자가 있어야 다툼이 끝난다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://localhost:8981';
const OUT = path.join(ROOT, 'docs', 'engine', 'shots');
const deg = r => (r * 180 / Math.PI).toFixed(0) + '°';
const norm = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

const WHO = `(()=>{ const c = window.view.characters().find(x=>x.id==='jachwi');
  const p = window.view.three.cam.position;
  return c ? { yaw: c.yaw, x: c.pos.x, z: c.pos.z, walking: c.walking, sel: c.selected,
               camYaw: Math.atan2(p.x - c.pos.x, p.z - c.pos.z) } : null; })()`;

async function main() {
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') console.log('EX ' + p.exceptionDetails.text); });
  await page.goto(`${BASE}/tools/room_view_demo.html?room=banjiha&t=0.42`);
  await page.waitFor('!!window.view', 180000, 200);
  await page.eval(`window.view.setContinuous(true)`);
  await page.eval(`window.view.setCharacter('jachwi').then(()=>1)`);
  await page.eval(`window.view.setCharacter('moni').then(()=>1)`);
  await page.eval(`(async()=>{ const S=window.view.slots().filter(s=>!s.occupied).slice(0,2);
    for (const s of S) await window.view.setPlant(s.slotId, {kind:'monstera', growthDays:220, seed:7, band:'good'});
    return S.length; })()`);
  await sleep(2500);

  const shot = async (name, note) => {
    await page.eval(`window.view.redraw()`, false);
    const f = path.join(OUT, `roomview4_${name}.png`);
    await page.shot(f);
    console.log(`  ${name.padEnd(11)} ${path.relative(ROOT, f)}   ${note}`);
  };

  /* ── 고르기 ── */
  const rect = await page.eval(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect();
    return {left:r.left, top:r.top, w:r.width, h:r.height}; })()`);
  const tapAt = async (x, y) => page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
    c.dispatchEvent(new MouseEvent('mousedown',{clientX:${x},clientY:${y},bubbles:true}));
    window.dispatchEvent(new MouseEvent('mouseup',{clientX:${x},clientY:${y},bubbles:true})); })()`, false);

  const fp = await page.eval(`window.view.characterScreenPos('jachwi')`);
  const CX = Math.round(rect.left + fp.x), CY = Math.round(rect.top + fp.y - 26);
  await tapAt(CX, CY); await sleep(300);
  await shot('sel_on', `골라짐=${await page.eval('window.view.selectedCharacter()')}`);
  await tapAt(CX, CY); await sleep(300);
  await shot('sel_off', `골라짐=${await page.eval('window.view.selectedCharacter()')}  ← 같은 자리를 한 번 더 눌렀다`);

  /* ── 걷기 ── 지금 서 있는 데서 제일 먼 자리로 보낸다(=크게 돌아야 한다) ── */
  await page.eval(`window.view.selectCharacter('jachwi')`);
  const pick = await page.eval(`(()=>{
    const r = document.getElementById('roomCanvas').getBoundingClientRect();
    const f = window.view.characterScreenPos('jachwi');
    const me = window.view.characters().find(c=>c.id==='jachwi').pos;
    let best=null, bestD=0;
    for (let a=0;a<20;a++) for (const R of [70,120,170]) {
      const x=r.left+f.x+Math.cos(a/20*6.283)*R, y=r.top+f.y+Math.sin(a/20*6.283)*R*0.6;
      const t=window.view.previewWalk('jachwi', x, y);
      if (t && t.ok) { const d=Math.hypot(t.x-me.x,t.z-me.z); if (d>bestD) { bestD=d; best={x,y,d}; } }
    }
    window.view.previewWalk('jachwi', null, null);
    return best;
  })()`);
  const p0 = await page.eval(WHO);
  await page.eval(`window.view.walkTo('jachwi', ${pick.x}, ${pick.y})`);
  await sleep(160);
  await shot('walk_start', `막 출발 — 몸 ${deg((await page.eval(WHO)).yaw)}`);

  await sleep(420);
  const a = await page.eval(WHO);
  await sleep(300);
  const b = await page.eval(WHO);
  const travel = Math.atan2(b.x - a.x, b.z - a.z);
  await shot('walking', `진행 ${deg(travel)} · 몸 ${deg(b.yaw)} → 어긋남 ${deg(Math.abs(norm(travel - b.yaw)))}  (0°이면 정면 · 180°면 뒷걸음질)`);

  for (let i = 0; i < 100 && await page.eval(`window.view.isWalking('jachwi')`); i++) await sleep(80);
  await sleep(800);
  const c = await page.eval(WHO);
  await shot('arrived', `몸 ${deg(c.yaw)} · 카메라 쪽 ${deg(c.camYaw)} → 어긋남 ${deg(Math.abs(norm(c.camYaw - c.yaw)))}`);
  console.log(`\n출발 (${p0.x.toFixed(2)}, ${p0.z.toFixed(2)}) → 도착 (${c.x.toFixed(2)}, ${c.z.toFixed(2)}) · ${pick.d.toFixed(2)}m`);
  await page.close();
}
main().catch(e => { console.error(e); process.exit(1); });
