/* tools/probe_roomtap_split.mjs — **방 안 화분을 «눌러도» 안 골라진다**를 갈라 본다
   probe_roommove_touch 에서 (282,465) 를 터치했는데 `picked` 가 null 이었다.
   갈래 셋 — 어느 것인지 갈라야 고칠 자리가 정해진다:
     ㉮ 자리를 «잘못» 짚었다 — screenPosOf 가 화분 몸을 안 가리킨다
     ㉯ «터치»만 안 먹는다 — 마우스로는 골라진다
     ㉰ 둘 다 안 먹는다 — 고르는 길 자체가 이 판에서 안 선다(세운 화분이 가짜라서일 수도)
   ⛔ 값은 안 바꾼다. */
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
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (busy !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
console.log('■ 세우기 —', await page.eval(`(()=>{ try{ const S=window.__S(); S.pots=S.pots||[];
  let p=S.pots[0];
  if(!p){ p={ id:'pot_probe', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
              cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
              arrivalGrowthDays:0, dliHist:[] }; S.pots.push(p); }
  p.placedOnce=true; p.slotId='banjiha-desk:0'; p.at=null; window.__redraw();
  return JSON.stringify({id:p.id, slotId:p.slotId}); }catch(e){return JSON.stringify({err:e.message});} })()`));
await sleep(2000);

const pos = JSON.parse(await page.eval(`(()=>{ try{ const rv=window.__rv;
  const r=document.getElementById('roomCanvas').getBoundingClientRect();
  const p=rv.screenPosOf('banjiha-desk:0'); if(!p) return JSON.stringify({err:'null'});
  return JSON.stringify({ x:Math.round(r.left+p.x), y:Math.round(r.top+p.y),
    canvas:{l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)} });
} catch(e){ return JSON.stringify({err:e.message}); } })()`));
console.log('■ screenPosOf —', JSON.stringify(pos));
console.log('■ 그 점에서 잡히는 것 —', await page.eval(`(()=>{ const h=document.elementFromPoint(${pos.x},${pos.y});
  return h ? h.tagName+'#'+(h.id||'')+'.'+(typeof h.className==='string'?h.className.trim().split(/\s+/).slice(0,2).join('.'):'') : 'null'; })()`));

const st = () => page.eval(`(()=>{ const pk=window.__picked||{};
  return JSON.stringify({ picked: pk.slotId||null, mode: pk.mode||null,
    detail: !!(window.__detailOpen && window.__detailOpen()),
    bar: (()=>{ const b=document.getElementById('pickMove'); if(!b) return 'no-btn';
      const r=b.getBoundingClientRect(); return Math.round(r.width)+'x'+Math.round(r.height)+'@'+Math.round(r.top); })() }); })()`);

console.log('\n=== ㉮ 방이 «스스로» 그 자리를 고를 수 있나 — picked.select 를 직접 부른다 ===');
console.log('  전 —', await st());
await page.eval(`(()=>{ try{ window.__picked.select('banjiha-desk:0'); }catch(e){} })()`, false);
await sleep(900);
console.log('  후 —', await st());
await page.eval(`(()=>{ try{ window.__picked.clear(); }catch(e){} })()`, false); await sleep(500);

console.log('\n=== ㉯ «마우스»로 그 점을 눌렀다 ===');
for (const type of ['mousePressed','mouseReleased'])
  await page.send('Input.dispatchMouseEvent', { type, x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
await sleep(1200);
console.log('  후 —', await st());
await page.eval(`(()=>{ try{ window.__picked.clear(); }catch(e){} })()`, false); await sleep(500);

console.log('\n=== ㉰ «터치»로 같은 점을 눌렀다 ===');
await page.send('Input.dispatchTouchEvent', { type: 'touchStart',
  touchPoints: [{ x: pos.x, y: pos.y, radiusX: 12, radiusY: 12, force: 1, id: 1 }] });
await sleep(80);
await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(1200);
console.log('  후 —', await st());

console.log('\n=== ㉱ 방 화면 «격자»를 훑어 어디를 누르면 골라지나 (터치) ===');
const cv = pos.canvas;
const hits = [];
for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 5; gx++) {
  const x = Math.round(cv.l + cv.w * (gx + 0.5) / 5), y = Math.round(cv.t + cv.h * (gy + 0.5) / 6);
  await page.eval(`(()=>{ try{ window.__picked.clear(); }catch(e){} })()`, false);
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart',
    touchPoints: [{ x, y, radiusX: 12, radiusY: 12, force: 1, id: 1 }] });
  await sleep(60);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(320);
  const got = await page.eval(`(()=>{ const pk=window.__picked||{}; return pk.slotId||''; })()`);
  if (got) hits.push(`(${x},${y})→${got}`);
}
console.log('  골라진 점 —', hits.length ? hits.join(' · ') : '⛔ «한 점도 없다»');
await page.close(); clearTimeout(wd);
