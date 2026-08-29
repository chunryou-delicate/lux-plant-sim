/* tools/probe_zoompath.mjs — **방에 놓인 화분을 «당겨 보는 길»이 첫 플레이에서도 손에 닿나** (총괄)
   ⇒ 「있다/없다/어디」만 낸다. ⛔ 고치지 않는다. */
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
for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[]; S.pots.length=0;
  S.pots.push({ id:'pot_a', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
    cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
    arrivalGrowthDays:200, dliHist:[], placedOnce:true, slotId:'banjiha-sill:0', at:null });
  try{ S.firstPlay.monstera.arrived=true; S.firstPlay.phase='move_monstera'; }catch(e){}
  window.__redraw();
  try{ window.__io.growth.setGrowth(200); window.__redraw(); }catch(e){} })()`, false);
await sleep(3000);
console.log('■ 첫 플레이인가 —', await page.eval(`(()=>String(!!(window.__S().firstPlay||{}).enabled))()`));
await page.eval(`(()=>{ window.__picked.select('banjiha-sill:0'); })()`, false);
await sleep(900);
console.log('■ 고르기 바 단추들 —', await page.eval(`(()=>{ const out=[];
  for (const id of ['pickMove','pickTurn','pickWhere','pickZoom','pickTake','pickSow','pickClose']) {
    const b=document.getElementById(id); if(!b) { out.push(id+': 없음'); continue; }
    const cs=getComputedStyle(b), r=b.getBoundingClientRect();
    out.push(id+': '+(cs.display==='none'?'⛔안보임':'★보임 '+Math.round(r.width)+'x'+Math.round(r.height))
      +(b.disabled?' (막힘)':'')); }
  return out.join(' | '); })()`));
console.log('■ [자세히] 누르기 —', await page.eval(`(()=>{ const b=document.getElementById('pickZoom');
  if(!b || getComputedStyle(b).display==='none') return '⛔ 못 누름'; b.click(); return '눌렀다'; })()`));
await sleep(2000);
console.log('■ 무엇이 열렸나 —', await page.eval(`(()=>{ const vis=(id)=>{ const e=document.getElementById(id);
  if(!e) return id+': 없음'; const cs=getComputedStyle(e), r=e.getBoundingClientRect();
  return id+': '+(cs.display!=='none'&&cs.visibility!=='hidden'&&+cs.opacity>0.05
    ? '★열림 '+Math.round(r.width)+'x'+Math.round(r.height) : '닫힘'); };
  let z='?'; try{ z=String(window.__byeotZoom.isOpen()); }catch(e){ z='err'; }
  return [vis('zoom'), vis('growth'), vis('closeZoom'), '__byeotZoom.isOpen()='+z].join(' | '); })()`));
console.log('■ 방 카메라는 —', await page.eval(`(()=>{ try{ const c=window.__rv.three.cam;
  return JSON.stringify({x:+c.position.x.toFixed(2),y:+c.position.y.toFixed(2),z:+c.position.z.toFixed(2)});
}catch(e){ return 'err'; } })()`));
await page.close(); clearTimeout(wd);
