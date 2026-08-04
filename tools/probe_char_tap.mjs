/* game.html 에서 캐릭터 탭이 되나. room_view_demo 는 21/21 통과하는데
   박사님이 "캐릭 이동 안 됨"이라 하셔서 게임 쪽만 따로 잰다. */
import { launch, sleep } from './test_cdp.mjs';

/* ★자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다.
   이게 없어서 측정 하나가 21시간 매달려 있었다. 헤드리스 크롬은 무언가를
   기다리다 영영 안 끝나는 일이 실제로 생긴다. 시간은 환경변수로 늘릴 수 있다. */
const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한 ' + Math.round(_WATCHDOG_MS / 1000) + '초를 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
/* ★타이머가 프로세스를 붙잡으면 안 된다 — unref 를 빠뜨려서
   재기를 다 끝낸 도구가 제한 시간까지 안 죽고 매달려 있었다(넣자마자 났다). */
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on((m, p) => { if (m === 'Runtime.exceptionThrown')
  errs.push(p.exceptionDetails.text + ' ' + ((p.exceptionDetails.exception || {}).description || '')); });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 120000, 300);
await sleep(6000);
await page.eval(`(()=>{ try{document.getElementById('dlgSkip').click()}catch{} })()`, false);
await sleep(1200);
await page.eval(`(()=>{ try{document.getElementById('guideClose').click()}catch{} })()`, false);
await sleep(600);

const tap = async (x, y) => {
  await page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
    c.dispatchEvent(new MouseEvent('mousedown',{clientX:${x},clientY:${y},bubbles:true}));
    window.dispatchEvent(new MouseEvent('mouseup',{clientX:${x},clientY:${y},bubbles:true})); })()`, false);
  await sleep(400);
};
const st = await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas');
  const r=c.getBoundingClientRect();
  return { rect:{l:r.left,t:r.top,w:r.width,h:r.height},
           j: rv.characterScreenPos('jachwi'),
           chars: rv.characters().map(x=>x.id),
           top: (()=>{const p=rv.characterScreenPos('jachwi');
                 const e=document.elementFromPoint(r.left+p.x, r.top+p.y); return e&&(e.id||e.tagName);})() }; })()`);
console.log('상태', JSON.stringify(st));
const out = [];
for (const dy of [0, -30, -60, -90, -120]) {
  await page.eval(`window.__rv.selectCharacter(null)`, false);
  await tap(Math.round(st.rect.l + st.j.x), Math.round(st.rect.t + st.j.y + dy));
  out.push({ dy, sel: await page.eval(`window.__rv.selectedCharacter()`) });
}
console.log('탭결과', JSON.stringify(out));

/* ── 걷기: 고른 뒤 끌면 걸어가나 ── */
await page.eval(`window.__rv.selectCharacter(null)`, false);
await tap(Math.round(st.rect.l + st.j.x), Math.round(st.rect.t + st.j.y));
const sel = await page.eval(`window.__rv.selectedCharacter()`);
const p0 = await page.eval(`window.__rv.characters().find(c=>c.id==='jachwi').pos`);
const x0 = Math.round(st.rect.l + st.j.x), y0 = Math.round(st.rect.t + st.j.y);
const x1 = Math.round(st.rect.l + st.rect.w * 0.62), y1 = Math.round(st.rect.t + st.rect.h * 0.62);
await page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
  c.dispatchEvent(new MouseEvent('mousedown',{clientX:${x0},clientY:${y0},bubbles:true})); })()`, false);
for (let i = 1; i <= 8; i++) {
  const x = Math.round(x0 + (x1-x0)*i/8), y = Math.round(y0 + (y1-y0)*i/8);
  await page.eval(`window.dispatchEvent(new MouseEvent('mousemove',{clientX:${x},clientY:${y},bubbles:true}))`, false);
  await sleep(40);
}
await page.eval(`window.dispatchEvent(new MouseEvent('mouseup',{clientX:${x1},clientY:${y1},bubbles:true}))`, false);
await sleep(3500);
const p1 = await page.eval(`window.__rv.characters().find(c=>c.id==='jachwi').pos`);
const moved = Math.hypot(p1.x-p0.x, p1.z-p0.z);
console.log('걷기', JSON.stringify({ 고름: sel, 전: [+p0.x.toFixed(2), +p0.z.toFixed(2)],
  후: [+p1.x.toFixed(2), +p1.z.toFixed(2)], 이동거리: +moved.toFixed(2), 걸었나: moved > 0.2 }));

/* ── ★진짜 폰처럼 touch ──
   ⚠ 앞 걸기 검사에서 캐릭터가 이미 옮겨갔다. 화면 자리를 다시 재서 누른다 —
     옛 좌표를 누르면 빈 바닥이라 고르기가 풀릴 뿐이다(이걸로 한 번 속았다). */
await page.eval(`window.__rv.selectCharacter(null)`, false);
await sleep(300);
const sp2 = await page.eval(`window.__rv.characterScreenPos('jachwi')`);
const tx = Math.round(st.rect.l + sp2.x), ty = Math.round(st.rect.t + sp2.y);
const T = (type, x, y) => page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
  const t=new Touch({identifier:1,target:c,clientX:${x},clientY:${y}});
  c.dispatchEvent(new TouchEvent('${type}',{bubbles:true,cancelable:true,
    touches:'${type}'==='touchend'?[]:[t],targetTouches:'${type}'==='touchend'?[]:[t],changedTouches:[t]})); })()`, false);
await T('touchstart', tx, ty); await sleep(80); await T('touchend', tx, ty); await sleep(600);
const selTouch = await page.eval(`window.__rv.selectedCharacter()`);
const q0 = await page.eval(`window.__rv.characters().find(c=>c.id==='jachwi').pos`);
const gx = Math.round(st.rect.l + st.rect.w * 0.30), gy = Math.round(st.rect.t + st.rect.h * 0.75);
await T('touchstart', tx, ty); await sleep(60);
for (let i = 1; i <= 8; i++) { await T('touchmove', Math.round(tx+(gx-tx)*i/8), Math.round(ty+(gy-ty)*i/8)); await sleep(40); }
await T('touchend', gx, gy); await sleep(3500);
const q1 = await page.eval(`window.__rv.characters().find(c=>c.id==='jachwi').pos`);
const md = Math.hypot(q1.x-q0.x, q1.z-q0.z);
console.log('터치', JSON.stringify({ 고름: selTouch, 이동: +md.toFixed(2), 걸었나: md > 0.2 }));
console.log('예외', JSON.stringify(errs.slice(0, 4)));
await page.close();