/* ============================================================
   tools/probe_lamp_tags_seen.mjs — 단 식물등이 폰 첫 화면에 보이나 · 시루 방울·꼬리표가 왜 포개지나 ([house] · 2026-10-31 · 총괄 비판 둘째 판)
   ------------------------------------------------------------
     SAVE=<세이브 JSON> BYEOT_URL=http://127.0.0.1:9331 [OUT=<사진 폴더>] node tools/probe_lamp_tags_seen.mjs
   왜: 비판 플레이어 둘째 판(docs/handoff/playtest-critic2-20261031.md · M4 ① · m4)
       ① Day 45 «벽부형 식물등»을 달았는데 방 그림에서 등을 못 찾아 7분 헤맸다(s138_lamp · s141_zoom · s148_zoom)
       ② 시루 여럿이면 심기 방울 3~4개가 한 점에 포개지고 시루 16개 중 꼬리표는 4~7개만 보였다(s080 · s103 · s130_d42)
   그 판의 세이브(Day 50 · 등 1개 단 판)를 그대로 켜고 폰 390×844 dpr2 기본 카메라에서 잰다. ⚠ 값·자리 손질 0 — 읽기만 한다.
     A 등 — 3D 그룹이 서 있나(visible) · 화면 상자 몇 px · 3D 가림(빛살) · DOM 가림(꼬리표·방울·말풍선) · 등 메시만 끈 사진과 그 상자 안 픽셀 차
     B 꼬리표 — 시루·재배판 몇 개 · 낱개로 보이는 것 · 묶음(3개 이상 44×20px 안) · 숨은 까닭
     C 방울 — 몇 개 · 화면 같은 점(3px 안)에 몇 개씩 · 그 그루들의 자리 이름과 발밑 좌표
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { launch, sleep } from './test_cdp.mjs';
const SAVEF = process.env.SAVE;
if (!SAVEF) { console.error('⛔ SAVE=<세이브 JSON>'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9331';
const OUT = process.env.OUT || null;
const LAMP = process.env.LAMP || 'banjiha-growlight-bar';
const SAVE = fs.readFileSync(SAVEF, 'utf8');
const J = v => JSON.stringify(v);

/* PNG 를 풀어 RGBA 로 — 등 메시 켜고/끈 두 장을 상자 안에서 견준다 */
function decodePNG(buf) {
  let off = 8, w = 0, h = 0; const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(off + 8); h = buf.readUInt32BE(off + 12); }
    else if (type === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = (x >= bpp && y) ? px[(y - 1) * stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, px };
}
const lum = (im, x, y) => { const i = (y * im.w + x) * 4; return 0.299 * im.px[i] + 0.587 * im.px[i + 1] + 0.114 * im.px[i + 2]; };

let stage = '크롬 띄우기', page = null, code = 0;
try {
  page = await launch({ width: 390, height: 844, dpr: 2, mobile: true });   /* 비판 판 운전기와 같은 폰 흉내 */
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${J(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
  stage = '게임 열기';
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv && !!window.__S', 300000, 500); await sleep(5000);
  stage = '대사 닫기';
  for (let i = 0; i < 40; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return String(!!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on')));})()`);
    if (b !== 'true') break;
    await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false); await sleep(250);
  }
  stage = '카메라 멎기';
  let prev = '';
  for (let i = 0; i < 40; i++) { const c = await page.eval(`JSON.stringify((()=>{const c=window.__rv.camera();return [c.az,c.el,c.dist].map(v=>+v.toFixed(4));})())`); if (c === prev) break; prev = c; await sleep(500); }
  await sleep(1200);
  const head = JSON.parse(await page.eval(`JSON.stringify((()=>{ const S=window.__S(); return { day:S.day, room:S.home&&S.home.room, lamp:S.tutorial&&S.tutorial.lamp, lamps:S.lamps&&S.lamps.count, cam:window.__rv.camera() }; })())`));
  console.log('판', J({ day: head.day, room: head.room, lamp: head.lamp, lampsCount: head.lamps, cam: { az: +head.cam.az.toFixed(3), el: +head.cam.el.toFixed(3), dist: +head.cam.dist.toFixed(2) } }));

  /* ── A 등 ── */
  stage = 'A 등';
  const A = JSON.parse(await page.eval(`JSON.stringify((()=>{
    const T=window.THREE, ctx=window.__rv.three, cam=ctx.cam, cv=document.getElementById('roomCanvas'), cr=cv.getBoundingClientRect();
    let node=null; ctx.scene.traverse(o=>{ if(!node && o.userData && o.userData.uid==='${LAMP}' && o.isGroup!==false && o.children.length) node=o; });
    if(!node) return { found:false };
    let shown=true; for(let o=node;o;o=o.parent) if(!o.visible) shown=false;
    node.updateMatrixWorld(true);
    const box=new T.Box3().setFromObject(node), sz=box.getSize(new T.Vector3()), ctr=box.getCenter(new T.Vector3());
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for(const ix of [0,1]) for(const iy of [0,1]) for(const iz of [0,1]){
      const v=new T.Vector3(ix?box.max.x:box.min.x, iy?box.max.y:box.min.y, iz?box.max.z:box.min.z).project(cam);
      const sx=(v.x+1)/2*cr.width, sy=(1-v.y)/2*cr.height; x0=Math.min(x0,sx); x1=Math.max(x1,sx); y0=Math.min(y0,sy); y1=Math.max(y1,sy); }
    /* 3D 가림 — 카메라에서 등 가운데로 빛살. 보이는(조상까지 visible · 불투명도 > 0.05) 첫 메시가 등인가 */
    const rc=new T.Raycaster(); const dir=ctr.clone().sub(cam.position).normalize(); rc.set(cam.position.clone(), dir);
    const isIn=(o,root)=>{ for(let q=o;q;q=q.parent) if(q===root) return true; return false; };
    const vis=o=>{ for(let q=o;q;q=q.parent) if(!q.visible) return false; const m=Array.isArray(o.material)?o.material[0]:o.material; return !m || !m.transparent || (m.opacity==null||m.opacity>0.05); };
    const hits=rc.intersectObjects(ctx.scene.children,true).filter(h=>h.object.isMesh && vis(h.object));
    const first=hits[0]||null;
    const firstName=first? (()=>{ for(let q=first.object;q;q=q.parent) if(q.userData&&q.userData.uid) return q.userData.uid; return first.object.name||first.object.type; })():null;
    /* DOM 가림 — 상자 안 점들(2px 눈금) 맨 위 요소 */
    const cover={}; let n=0, onCanvas=0;
    for(let y=Math.floor(y0); y<=Math.ceil(y1); y+=2) for(let x=Math.floor(x0); x<=Math.ceil(x1); x+=2){
      if(x<0||y<0||x>cr.width||y>cr.height) continue; n++;
      const el=document.elementFromPoint(cr.left+x, cr.top+y); if(el===cv){ onCanvas++; continue; }
      const k=el? ((el.closest('.sbadge')&&('꼬리표 «'+el.closest('.sbadge').textContent.trim().slice(0,24)+'»')) || (el.closest('.mark')&&('방울 '+(el.closest('.mark').title||'')).slice(0,30)) || (el.id?('#'+el.id):(el.className?('.'+String(el.className).split(' ')[0]):el.tagName))) : 'null';
      cover[k]=(cover[k]||0)+1; }
    return { found:true, shown, world:{ x:+ctr.x.toFixed(3), y:+ctr.y.toFixed(3), z:+ctr.z.toFixed(3), w:+sz.x.toFixed(3), h:+sz.y.toFixed(3), d:+sz.z.toFixed(3) },
             screen:{ x0:+x0.toFixed(1), y0:+y0.toFixed(1), x1:+x1.toFixed(1), y1:+y1.toFixed(1), w:+(x1-x0).toFixed(1), h:+(y1-y0).toFixed(1) },
             canvas:{ left:cr.left, top:cr.top, w:cr.width, h:cr.height }, ray:{ first:firstName, dist:first?+first.distance.toFixed(3):null, lampAt:(()=>{ const i=hits.findIndex(h=>isIn(h.object,node)); return i; })(), before: hits.slice(0,4).map(h=>{ const o=h.object, m=Array.isArray(o.material)?o.material[0]:o.material; let who=null, chain=[];
                 for(let q=o;q&&chain.length<5;q=q.parent){ chain.push(q.name||q.type); if(!who&&q.userData&&(q.userData.uid||q.userData.kind||q.userData.role)) who=q.userData.uid||q.userData.kind||q.userData.role; }
                 return { who, chain:chain.join('<'), d:+h.distance.toFixed(3), mat:m&&m.type, opacity:m&&m.opacity, transparent:m&&m.transparent, color:m&&m.color&&m.color.getHexString() }; }) },
             dom:{ points:n, canvas:onCanvas, cover } };
  })())`));
  console.log('A 등', J(A));
  let px = null;
  if (A.found && A.shown) {
    /* 등 메시만 끈다(그룹은 둔다 — 그룹을 끄면 lampIsOn 이 거짓이라 광원까지 꺼져 방 전체가 바뀐다) */
    const pad = 6, cl = { x: Math.max(0, A.canvas.left + A.screen.x0 - pad), y: Math.max(0, A.canvas.top + A.screen.y0 - pad) };
    cl.w = Math.min(390 - cl.x, A.screen.w + 2 * pad); cl.h = Math.min(844 - cl.y, A.screen.h + 2 * pad);
    const snap = async () => decodePNG(Buffer.from((await page.send('Page.captureScreenshot', { format: 'png', clip: { x: cl.x, y: cl.y, width: cl.w, height: cl.h, scale: 1 } })).data, 'base64'));
    const setMesh = on => page.eval(`(()=>{ let node=null; window.__rv.three.scene.traverse(o=>{ if(!node && o.userData && o.userData.uid==='${LAMP}' && o.children.length) node=o; });
      node.traverse(o=>{ if(o!==node && o.isMesh) o.visible=${on ? 'true' : 'false'}; }); window.__rv.setIdleFps(30); return true; })()`);
    const full = async f => { if (OUT) { fs.mkdirSync(OUT, { recursive: true }); await page.shot(path.join(OUT, f)); } };
    await full('lamp_on.png');
    const on = await snap();
    await setMesh(false); await sleep(1500);
    const off = await snap(); await full('lamp_meshoff.png');
    await setMesh(true); await sleep(800);
    let diff = 0, dmax = 0, n = 0; const W = Math.min(on.w, off.w), H = Math.min(on.h, off.h);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { n++; const d = Math.abs(lum(on, x, y) - lum(off, x, y)); if (d > 12) diff++; if (d > dmax) dmax = d; }
    px = { clipCss: cl, devPx: `${W}×${H}`, changed: diff, of: n, maxDelta: +dmax.toFixed(1), changedCss2: +(diff / 4).toFixed(1) };
    console.log('A 등 메시 켬/끔 — 상자(+6px) 안 장치 픽셀 중 밝기 12 넘게 바뀐 것', J(px));
  }

  /* ── B 꼬리표 · C 방울 ── */
  stage = 'B·C 꼬리표·방울';
  /* 세이브로 켠 첫 화면은 꼬리표가 0 개였다(#siruBadges sig '' — 부팅 때 한 번 그린 뒤 다시 안 그림 · HEAD 083337c5 · 같은 세이브의 비판 판 s155 에는 있었다).
     그래서 «켠 그대로» 수를 먼저 적고, 게임의 draw() 를 한 번 불러(window.__redraw — 하루 넘기기·누르기마다 도는 그 함수) 다시 센다 */
  const before = JSON.parse(await page.eval(`JSON.stringify({ badges: document.querySelectorAll('#siruBadges .sbadge').length, sig: (document.getElementById('siruBadges')||{dataset:{}}).dataset.sig })`));
  await page.eval(`(()=>{ window.__redraw(); return 1; })()`); await sleep(1500);
  const BC = JSON.parse(await page.eval(`JSON.stringify((()=>{
    const S=window.__S(), fp=S.firstPlay||{}, rv=window.__rv;
    const pots=[]; for(const g of [fp.beansprout,...(fp.crops||[])]) for(const p of ((g&&g.pots)||[])) pots.push({ kind:g.kind, id:p.id, slotId:p.slotId, at:p.at&&{x:p.at.x,y:p.at.y,z:p.at.z} });
    const bySlot={}; for(const p of pots){ const k=p.slotId||'?'; bySlot[k]=(bySlot[k]||0)+1; }
    const shared=Object.entries(bySlot).filter(([k,n])=>n>1 && !/^free:/.test(k));
    const badges=[...document.querySelectorAll('#siruBadges .sbadge')];
    const single=badges.filter(b=>!b.classList.contains('sgroup')), groups=badges.filter(b=>b.classList.contains('sgroup')&&b.style.display!=='none');
    const shownSingle=single.filter(b=>b.style.display!=='none');
    const groupTexts=groups.map(g=>g.textContent);
    const marks=[...document.querySelectorAll('#marks .mark')].filter(m=>m.style.display!=='none').map(m=>({ key:m.dataset.key, ko:m.title, x:+parseFloat(m.style.left).toFixed(1), y:+parseFloat(m.style.top).toFixed(1) }));
    const piles=[]; for(const m of marks){ const q=piles.find(p=>Math.abs(p.x-m.x)<=3&&Math.abs(p.y-m.y)<=3); if(q) q.items.push(m.key+' '+m.ko); else piles.push({ x:m.x, y:m.y, items:[m.key+' '+m.ko] }); }
    /* 에타제르 아홉 칸 화면 점 — 이웃 사이 px(묶음 자 44×20 과 견줌) */
    const et=[]; for(const s of rv.slots()) if(/^banjiha-etagere:/.test(s.slotId)){ const sp=rv.screenPosOf(s.slotId); if(sp) et.push({ id:s.slotId, x:+sp.x.toFixed(1), y:+sp.y.toFixed(1) }); }
    let etMin=1e9; for(let i=0;i<et.length;i++) for(let j=i+1;j<et.length;j++){ const dx=Math.abs(et[i].x-et[j].x), dy=Math.abs(et[i].y-et[j].y); etMin=Math.min(etMin, Math.hypot(dx,dy)); }
    const etIn=et.filter((a,i)=>et.some((b,j)=>j!==i && Math.abs(a.x-b.x)<44 && Math.abs(a.y-b.y)<20)).length;
    const sill=rv.slots().filter(s=>/^banjiha-sill/.test(s.slotId)).map(s=>({ id:s.slotId, maxPotD:s.maxPotD, occupied:s.occupied }));
    /* 꼬리표 묶음 흉내 — game.html §placeSiruBadges ② 와 같은 자(표지 점 = 그루 발밑 + 0.21m · 44×20px 안 셋 이상이면 하나) ·
       방이 그린 그루(rv.plants 의 potId)만 · 손가락 구멍·말풍선 숨김은 뺀 «많아야» 값 */
    const rvp=new Map(); for(const q of (rv.plants()||[])) if(q&&q.potId) rvp.set(q.potId,q);
    const pts=[]; for(const p of pots){ const q=rvp.get(p.id); const w=q?q.pos:p.at; if(!w) continue; const sp=rv.worldToScreen(w.x, w.y+0.21, w.z); if(sp) pts.push({ id:p.id, slot:p.slotId, drawn:!!q, x:sp.x, y:sp.y }); }
    const cl=[]; for(const it of pts){ const c=cl.find(q=>Math.abs(q.x-it.x)<44&&Math.abs(q.y-it.y)<20); if(c) c.m.push(it); else cl.push({ x:it.x, y:it.y, m:[it] }); }
    const sim={ pots:pts.length, drawnByRoom:pts.filter(p=>p.drawn).length, tagsShown:cl.reduce((n,c)=>n+(c.m.length>=3?1:c.m.length),0),
                clusters:cl.map(c=>({ n:c.m.length, at:[Math.round(c.x),Math.round(c.y)], slots:[...new Set(c.m.map(q=>String(q.slot).replace('banjiha-','')))].join(',') })) };
    return { pots:pots.length, bySlot, shared, badges:{ single:single.length, shownSingle:shownSingle.length, hidden:single.length-shownSingle.length, groups:groupTexts },
             marks:{ n:marks.length, piles:piles.filter(p=>p.items.length>1), all:marks.map(m=>m.key) }, etagere:{ slots:et.length, minGapPx:+etMin.toFixed(1), withinGroupRule:etIn, pts:et }, sill, sim };
  })())`));
  console.log('B 꼬리표 — 켠 그대로', J(before), '→ draw() 한 번 뒤', J({ pots: BC.pots, badges: BC.badges }));
  if (A.found) {   /* 꼬리표가 선 뒤 등 상자를 다시 덮어 본다(A 는 꼬리표 0 개일 때 잰 것) */
    const cov = JSON.parse(await page.eval(`JSON.stringify((()=>{ const cv=document.getElementById('roomCanvas'), cr=cv.getBoundingClientRect(), b=${J(A.screen)}; const cover={}; let n=0, onCanvas=0;
      for(let y=Math.floor(b.y0); y<=Math.ceil(b.y1); y+=2) for(let x=Math.floor(b.x0); x<=Math.ceil(b.x1); x+=2){ n++; const el=document.elementFromPoint(cr.left+x, cr.top+y); if(el===cv){ onCanvas++; continue; }
        const t=el&&el.closest('.sbadge'), m=el&&el.closest('.mark'); const k=t?('꼬리표 «'+t.textContent.trim().slice(0,24)+'»'):m?('방울 '+(m.title||'')):el?(el.id?'#'+el.id:el.tagName):'null'; cover[k]=(cover[k]||0)+1; }
      return { points:n, canvas:onCanvas, cover }; })())`));
    console.log('A 등 상자 DOM 가림 — 꼬리표 선 뒤', J(cov));
  }
  console.log('B 한 이름 자리에 둘 이상 선 그루', J(BC.shared));
  console.log('C 방울', J({ n: BC.marks.n, keys: BC.marks.all }));
  console.log('C 화면 같은 점(3px 안)에 포개진 방울', J(BC.marks.piles));
  console.log('B 에타제르 칸 화면 점', J({ slots: BC.etagere.slots, minGapPx: BC.etagere.minGapPx, withinGroupRule: BC.etagere.withinGroupRule }));
  console.log('창턱 이름 자리', J(BC.sill));
  console.log('B 묶음 흉내(44×20px · 셋 이상 하나)', J(BC.sim));
  if (OUT) await page.shot(path.join(OUT, 'tags.png'));
} catch (e) {
  code = 1; console.log(`FAIL  던짐 — ${stage} 단계: ${String((e && e.message) || e).slice(0, 400)}`);
} finally { if (page) { try { await page.close(); } catch { /* 이미 닫힘 */ } } }
console.log(code ? '\nlamp_tags_seen: FAIL' : '\nlamp_tags_seen: 잼 끝');
process.exit(code);
