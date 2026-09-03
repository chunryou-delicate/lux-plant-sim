/* tools/probe_pointhint.mjs — **«점»으로 짚는 손가락이 허공을 짚나** (박사님 폰 그림 · 2026-09-02)
   ------------------------------------------------------------------
   박사님: 첫 몬스테라를 «놓은 뒤» 손가락이 「여기를 눌러 보세요」라며 «빈 곳»을 짚는다 —
   화분은 오른쪽 서랍장 위인데 손가락은 그보다 왼쪽 위 허공.
   짚이는 것: 그 손가락은 «점»으로 놓는 갈래(§hintAtPoint)다. 요소는 프레임마다 다시 놓지만
   점은 한 번 놓고 끝이다. 폰에서는 놓자마자 시트가 닫히며 판이 바뀐다 — 그때 점이 «옛 자리»에 남나.
   재는 것: 폰(390×844)에서 가방의 그루를 눌러 놓은 «직후»와 «1초 뒤»·«2초 뒤»에
     ① 손가락·구멍이 «어디»에 있나  ② 화분의 «진짜» 화면 점(screenPosOf)은 어디인가
     ③ 그 둘의 거리  ④ 캔버스 크기와 방뷰 렌더러 크기가 «같은가»(시트가 닫히며 판이 바뀐 뒤)
   ⛔ 값은 안 바꾼다. 여기서는 「어긋나나」만 본다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4500);
const clearDlg = async () => { for (let i = 0; i < 40; i++) {
  const t = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`);
  if (t !== 'true') return true;
  await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false);
  await sleep(200); } return false; };
for (let i = 0; i < 4; i++) { await clearDlg(); await sleep(700); }
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1);
  await sleep(80); await m('mouseReleased', x, y, 0); await sleep(900); };
/* 손가락이 짚는 곳을 누른다 — 요소면 그 한가운데, 점이면 구멍 */
const tapHint = async () => {
  const at = JSON.parse(await page.eval(`(()=>{ const t=document.querySelector('.hintTarget');
    const d=document.getElementById('hintDim');
    const hole=(d&&d.dataset.hole||'').split(',').map(Number);
    if (t) { const r=t.getBoundingClientRect(); if (r.width>0) return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2, 짚:t.id||t.className }); }
    if (hole.length===3 && hole.every(Number.isFinite)) return JSON.stringify({ x:hole[0], y:hole[1], 짚:'(점)' });
    return 'null'; })()`));
  if (!at) return null;
  await tapAt(at.x, at.y); await clearDlg();
  return at.짚;
};
/* ★ 선물을 코어가 주는 그대로 — 그리고 시루부터 놓아 손가락이 그루 칸까지 오게 한다 */
await page.eval(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S();
  if(!(S.pots||[]).length) st.givePlant(S, window.__io, { slotId:null }); window.__redraw(); })()`, true, 30000);
await sleep(800);
const path = [];
for (let i = 0; i < 14; i++) {
  const who = await tapHint();
  path.push(who);
  if (!who) break;
  const placed = await page.eval(`(()=>{ const p=(window.__S().pots||[])[0]; return String(!!(p&&(p.slotId||p.at))); })()`);
  if (placed === 'true') break;
}
console.log('■ 손가락을 따라온 길 —', path.join(' → '));
const snap = (ko) => page.eval(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0];
  const rv=window.__rv, c=document.getElementById('roomCanvas');
  const cr=c.getBoundingClientRect();
  let sp=null; try { sp = p && p.slotId ? rv.screenPosOf(p.slotId) : null; } catch(e){}
  const d=document.getElementById('hintDim'); const h=document.getElementById('hint');
  const hole=(d&&d.dataset.hole||'').split(',').map(Number);
  const hr=h?h.getBoundingClientRect():null;
  const truth = sp ? { x:Math.round(cr.left+sp.x), y:Math.round(cr.top+sp.y) } : null;
  const fingerPt = (hole.length===3 && hole.every(Number.isFinite)) ? { x:hole[0], y:hole[1] } : null;
  const dist = (truth && fingerPt) ? Math.round(Math.hypot(truth.x-fingerPt.x, truth.y-fingerPt.y)) : null;
  let rsz=null; try { const r=rv.renderer ? rv.renderer.getSize(new (rv.THREE||{}).Vector2()) : null; rsz = r? [Math.round(r.x),Math.round(r.y)] : null; } catch(e){}
  return JSON.stringify({ 때:${JSON.stringify('KO')},
    화분:p?{ 자리:p.slotId, 좌표:!!p.at }:null,
    화분점_진짜: truth, 손가락점: fingerPt, 어긋남px: dist,
    손가락말: h?((h.querySelector('.say')||{}).textContent||'').trim().slice(0,22):null,
    덮개켜짐: !!(d&&d.classList.contains('on')),
    시트열림: !!document.getElementById('sheet').classList.contains('open'),
    캔버스:[Math.round(cr.left),Math.round(cr.top),Math.round(cr.width),Math.round(cr.height)],
    캔버스픽셀:[c.width,c.height], 렌더러: rsz,
    마지막짚기: window.__hintLast ? window.__hintLast.자리 : null }); })()`).then(x => x.replace('"KO"', JSON.stringify(ko)));
console.log('■ 놓은 직후(확인 전) —', await snap('확인 전'));
/* [확인]을 눌러 «정말» 놓는다 — 그다음이 박사님이 보신 «점» 손가락이다 */
console.log('■ [확인] —', await tapHint());
await sleep(800);
console.log('■ 확인 직후   —', await snap('확인 직후'));
/* ★ 박사님이 보신 손가락은 «점»으로 짚는 「여기를 눌러 보세요」다(그 화분을 짚는 걸음).
   말풍선(심기·물)이 먼저 걸리면 그 걸음이 안 뜬다 — 손가락을 따라가 그 걸음까지 간다. */
{
  const path2 = [];
  for (let i = 0; i < 8; i++) {
    const who = await page.eval(`(()=>{ const t=document.querySelector('.hintTarget');
      const h=document.getElementById('hint'); const say=h?((h.querySelector('.say')||{}).textContent||'').trim():'';
      return JSON.stringify({ 짚:t?(t.id||t.className):'(점)', 말:say.slice(0,20), 켜짐:!!(h&&h.classList.contains('on')) }); })()`);
    const o = JSON.parse(who);
    path2.push(o.짚 + '「' + o.말 + '」');
    if (o.짚 === '(점)' && /눌러 보세요/.test(o.말) && o.켜짐) break;
    if (!await tapHint()) break;
    await sleep(400);
  }
  console.log('■ 점 걸음까지 —', path2.join(' → '));
}
console.log('■ ★ 점 손가락 —', await snap('점 손가락'));
await sleep(1000);
console.log('■ 1초 뒤      —', await snap('1초'));
await sleep(1500);
console.log('■ 2.5초 뒤    —', await snap('2.5초'));
/* ★ 창 크기 사건을 «한 번» 쏘아 본다 — 방뷰가 그때 몸을 맞추면 «안 맞춘 채»였던 것이다 */
await page.eval(`window.dispatchEvent(new Event('resize'))`, false);
await sleep(900);
console.log('■ resize 쏜 뒤 —', await snap('resize 뒤'));
/* ★ 지킴이가 다시 물은 뒤에도 어긋나면 «점 계산» 자체가 틀린 것이다.
   그러면 방뷰에게 «다른 길»로 물어 견준다 — 화분 메쉬를 직접 투영한다. */
console.log('■ 다른 길로 물음 —', await page.eval(`(()=>{ const rv=window.__rv; const S=window.__S(); const p=(S.pots||[])[0];
  try {
    const keys = Object.keys(rv).filter(k=>/pos|proj|screen/i.test(k));
    return JSON.stringify({ 방뷰가_가진_문: keys.slice(0,12) });
  } catch(e){ return JSON.stringify({ 탈:e.message }); } })()`));
await page.shot('docs/handoff/img/pointhint.png').catch(() => {});
await page.close(); clearTimeout(wd);
