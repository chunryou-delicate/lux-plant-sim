/* tools/probe_pottap_map.mjs — **방 안 화분의 «손가락 과녁»을 훑어서 그린다**
   ⚠ 앞선 probe_pottap_box 는 씨점 하나에서 사방으로 걸어 재려 했는데, 그루를 45일로
     세우자 씨점 자체가 «안 먹는» 점이 되어 값이 뜻을 잃었다. 그 수는 «버린다».
   ⇒ 여기서는 **격자를 통째로 훑는다.** 먹는 점을 모두 모아 과녁의 크기를 낸다.
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 900000);
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
  p.placedOnce=true; p.slotId='banjiha-desk:0'; p.at=null; window.__redraw(); })()`, false);
await sleep(1500);
console.log('■ 45일로 세우기 —', await page.eval(`(()=>{ try{ const g=window.__io.growth;
  const r=g.setGrowth(45); window.__redraw(); return JSON.stringify(r); }catch(e){ return 'err '+e.message; } })()`));
await sleep(2500);

const tap = async (x, y) => {
  await page.eval(`(()=>{ try{ window.__picked.clear(); }catch(e){} })()`, false);
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart',
    touchPoints: [{ x, y, radiusX: 12, radiusY: 12, force: 1, id: 1 }] });
  await sleep(45);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(210);
  return (await page.eval(`(()=>{ const pk=window.__picked||{}; return pk.slotId||''; })()`)) === 'banjiha-desk:0';
};

const STEP = 6, X0 = 216, X1 = 348, Y0 = 402, Y1 = 552;
const rows = [];
let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, hit = 0, all = 0;
for (let y = Y0; y <= Y1; y += STEP) {
  let line = '';
  for (let x = X0; x <= X1; x += STEP) {
    all++;
    const ok = await tap(x, y);
    line += ok ? '#' : '.';
    if (ok) { hit++; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  }
  rows.push(String(y).padStart(4) + ' ' + line);
}
console.log(`\n■ 훑은 곳 — x ${X0}..${X1} · y ${Y0}..${Y1} · ${STEP}px 눈금 · 점 ${all}개`);
console.log(rows.join('\n'));
if (!hit) { console.log('\n⛔ 먹는 점이 «한 개도 없다»'); }
else console.log(`\n■ 먹는 점 ${hit}개 · 과녁 테두리 — 가로 «${maxx - minx + STEP}px» × 세로 «${maxy - miny + STEP}px»`
  + `  (x ${minx}..${maxx} · y ${miny}..${maxy})\n■ 견줌 — 손가락 권장 과녁 «44×44»`);
await page.close(); clearTimeout(wd);
