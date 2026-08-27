/* tools/probe_sheet_settle.mjs — **가방을 열고 «몇 ms» 뒤부터 손이 먹나**
   [Plan] ㊻: 자는 늘 기다린다 ⇒ «조급한 손»이 막히는 것은 자로 안 나온다.
   ⇒ ★ 그래서 «일부러 조급하게» 눌러 본다. 열고 나서 t ms 뒤에 끌어 본다.
   ⚠ 판을 안 굴린다 — 자리 없는 화분 하나를 세워 그 칸을 만든다. */
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
await sleep(4000);
await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[];
  S.pots.push({id:'pot_probe',itemId:'pot',placedOnce:false,at:null,slotId:null,leafGrades:{},leafGradesSeen:{},cuts:[]});
  window.__redraw(); })()`, false);
await sleep(600);

const tryAt = async (waitMs) => {
  /* 닫았다 다시 연다 — 「열자마자」를 재려면 매번 새로 열어야 한다 */
  await page.eval(`(()=>{ try{ window.__drag.end && window.__drag.end(); window.__byeotSheet.close(); }catch(e){} })()`, false);
  await sleep(900);
  await page.eval(`window.__byeotSheet.open('bag')`, false);
  await sleep(waitMs);
  const at = JSON.parse(await page.eval(`(()=>{ const c=document.querySelector('[data-potbag]');
    if(!c) return JSON.stringify({err:'칸 없음'});
    const r=c.getBoundingClientRect();
    return JSON.stringify({ x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2),
                            top:Math.round(r.top) }); })()`));
  if (at.err) return { err: at.err };
  const p = [{ x: at.x, y: at.y, radiusX: 12, radiusY: 12, force: 1, id: 1 }];
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: p });
  await sleep(80);
  await page.send('Input.dispatchTouchEvent', { type: 'touchMove',
    touchPoints: [{ ...p[0], x: at.x + 40, y: at.y - 50 }] });
  await sleep(100);
  const on = await page.eval(`(()=>String(!!(window.__drag && window.__drag.on)))()`) === 'true';
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(200);
  return { on, y: at.y, top: at.top };
};

console.log('■ 가방을 열고 t ms 뒤에 끌어 본다 (화면 높이 844)');
for (const t of [0, 50, 100, 150, 200, 300, 400, 600, 900, 1400]) {
  const r = await tryAt(t);
  if (r.err) { console.log(`  ${String(t).padStart(4)}ms  ✘ ${r.err}`); continue; }
  console.log(`  ${String(t).padStart(4)}ms  칸 y ${String(r.y).padStart(5)}` +
              `  ${r.y > 844 ? '(화면 밖)' : '(화면 안)'}  ⇒ 끌기 ${r.on ? '✔ 켜짐' : '⛔ 안 켜짐'}`);
}
console.log('\n⇒ ★ 처음으로 ✔ 가 뜨는 t 가 「이때부터 손이 먹는다」다.');
await page.close(); clearTimeout(wd);
