/* tools/probe_dlgwhen.mjs — **대사가 «언제» 열리나** (총괄 ④ · 「말이 몰린 것」)
   ------------------------------------------------------------------
   [Plan]: 셋은 한 걸음이 아니라 «세 걸음»이다 —
     questPlaceSiru(왜 놓나) · questDonePlaceSiru(했다) · questWaterSiru(다음은).
   ⇒ 그런데 화면에서는 «놓자마자 셋이 한꺼번에» 나온다.
   재는 것: 걸음마다 `window.__dlgLog` 가 «무엇을 언제» 열었나. ⛔ 값은 안 바꾼다.
   ★ 읽는 법: `b` 는 «한 번에 연 묶음» 번호다. 같은 b 면 «한꺼번에» 뜬 것이다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 1770), H = Number(process.env.H || 1188);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
const mouse = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapEl = async (sel) => {
  const at = JSON.parse(await page.eval(`(()=>{ const e=document.querySelector(${JSON.stringify(sel)});
    if(!e) return 'null'; const r=e.getBoundingClientRect();
    if(!r.width||!r.height) return 'null';
    return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2 }); })()`));
  if (!at) return false;
  await mouse('mouseMoved', at.x, at.y, 0);
  await mouse('mousePressed', at.x, at.y, 1);
  await sleep(60);
  await mouse('mouseReleased', at.x, at.y, 0);
  await sleep(800);
  return true;
};
const log = () => page.eval(`JSON.stringify((window.__dlgLog||[]).map(r => r.id + '(b' + r.b + ')'))`);
const say = () => page.eval(`(()=>{ const t=document.getElementById('dlgText');
  return JSON.stringify({ 대사: t ? (t.textContent||'').trim().slice(0,30) : null,
    talking: document.getElementById('stage').classList.contains('talking') }); })()`);
/* ⚠ [건너뛰기]는 «안 보일 때»가 있다. 대사 상자를 누르는 길은 늘 있다(재서 확인함) */
const clearDlg = async () => { for (let i = 0; i < 40; i++) {
  const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
  if (t !== 'true') return;
  await page.eval(`(()=>{ const b=document.getElementById('dlgSkip');
    if (b && b.offsetParent !== null) b.click();
    const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false);
  await sleep(180); } };
console.log('① 켠 직후 —', await log(), await say());
await clearDlg();
console.log('② 첫 대사를 걷은 뒤 —', await log(), await say());
await page.eval(`(()=>{ try{ window.__byeotSheet.open('bag'); }catch(e){} })()`, false);
await sleep(1200);
console.log('③ 가방을 연 뒤 —', await log());
await tapEl('.bagslot[data-place="beansprout"]');
console.log('④ 시루 칸을 누른 뒤(임시로 섬) —', await log(), await say());
await tapEl('#placeOk');
await sleep(1200);
console.log('⑤ [확인]으로 놓은 뒤 —', await log(), await say());
console.log('   ⇒ ★ 여기서 한 묶음(b)에 «몇 줄»이 들어 있나를 본다');
await clearDlg();
await sleep(800);
console.log('⑥ 그 대사를 다 걷은 뒤 —', await log(), await say());
await page.close(); clearTimeout(wd);
