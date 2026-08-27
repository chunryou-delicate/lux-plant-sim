/* tools/probe_roommove_chain.mjs — **방 → 방 옮기기 한 줄을 끝까지 눌러 본다** (㉡)
   ★ 과녁이 작아 실측으로 찾은 «먹는 점»(288,480)을 쓴다 — probe_pottap_map 참고. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (busy !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[];
  let p=S.pots[0];
  if(!p){ p={ id:'pot_probe', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
              cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
              arrivalGrowthDays:45, dliHist:[] }; S.pots.push(p); }
  p.placedOnce=true; p.slotId='banjiha-desk:0'; p.at=null; window.__redraw();
  try{ window.__io.growth.setGrowth(45); window.__redraw(); }catch(e){} })()`, false);
await sleep(3000);

const st = () => page.eval(`(()=>{ const S=window.__S(), p=(S.pots||[])[0], pk=window.__picked||{};
  const b=document.getElementById('pickMove'), r=b?b.getBoundingClientRect():null;
  return JSON.stringify({ 자리: p?p.slotId:null, 좌표: p&&p.at?1:0, 골라진것: pk.slotId||null,
    모드: pk.mode||null, 옮기는중: document.getElementById('stage').classList.contains('moving'),
    옮기기단추: r? Math.round(r.width)+'x'+Math.round(r.height)+'@y'+Math.round(r.top) : '없음',
    아래글: (document.getElementById('dropLabel')||{}).textContent||'' }); })()`);
const P = { x: 288, y: 480 };
const touchTap = async (x, y) => {
  await page.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x,y,radiusX:12,radiusY:12,force:1,id:1}] });
  await sleep(70); await page.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] }); await sleep(900); };
const touchDrag = async (x, y, dx, dy) => {
  await page.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x,y,radiusX:12,radiusY:12,force:1,id:1}] });
  await sleep(90);
  for (let i=1;i<=8;i++){ await page.send('Input.dispatchTouchEvent', { type:'touchMove',
    touchPoints:[{x:x+dx*i/8,y:y+dy*i/8,radiusX:12,radiusY:12,force:1,id:1}] }); await sleep(45); }
  const mid = await st();
  await page.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] }); await sleep(1000);
  return { mid, end: await st() }; };

console.log('=== ① 안 고르고 «그냥 끌었다» ===');
console.log('  전 —', await st());
const r1 = await touchDrag(P.x, P.y, 0, -170);
console.log('  끄는 중 —', r1.mid);
console.log('  놓은 뒤 —', r1.end);

console.log('\n=== ② «눌러서» 골랐다 (실측으로 찾은 먹는 점) ===');
await touchTap(P.x, P.y);
console.log('  후 —', await st());

console.log('\n=== ③ [옮기기]를 «터치»로 눌렀다 ===');
const mb = JSON.parse(await page.eval(`(()=>{ const b=document.getElementById('pickMove');
  const r=b.getBoundingClientRect(); return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}); })()`));
await touchTap(mb.x, mb.y);
console.log('  후 —', await st());
console.log('  화면에 뜬 글 —', await page.eval(`(()=>{ const out=[];
  ['dropLabel','banner','hint','coach'].forEach(id=>{ const e=document.getElementById(id); if(!e) return;
    const cs=getComputedStyle(e); if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<0.05) return;
    const t=(e.textContent||'').trim().replace(/\s+/g,' ').slice(0,70); if(t) out.push(id+': '+t); });
  return out.join(' | ')||'(없다)'; })()`));

console.log('\n=== ④ 그 상태에서 «끌었다» — 창턱 쪽으로 ===');
const r4 = await touchDrag(P.x, P.y, -40, -120);
console.log('  끄는 중 —', r4.mid);
console.log('  놓은 뒤 —', r4.end);
const e4 = JSON.parse(r4.end);
console.log('  ⇒', (e4.자리 !== 'banjiha-desk:0' || e4.좌표) ? '★ 옮겨졌다' : '⛔ 그대로다');
await page.close(); clearTimeout(wd);
