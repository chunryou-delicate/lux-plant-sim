/* ============================================================
   tools/probe_actbar.mjs — **하단 「물 주는 중」 막대가 안 사라진다** (2026-08-16)
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_actbar.mjs

   박사님 두 마디를 같이 잰다 — 둘은 한 사고의 앞뒤일 수 있다:
     ① "밑에 물주는중 이 안없어져"          → 동작이 끝났는데 막대가 남는다
     ② "버튼 갈기면 게이지 없이 바로 되버려" → 연달아 누르면 연출이 통째로 없다

   ★ 재는 법. **막대의 display 를 시간축으로 찍는다.** 끝났는지는 `__byeotWalkSfx().acting`
     (하는 중인가)로 가른다 — 「acting 은 거짓인데 막대는 보인다」가 곧 ①이다.
   ⚠⚠ **재는 자를 먼저 의심한다.** 갓 켠 판에는 화분도 시루도 없어서 `doAct` 가
     「갈 곳이 없다」로 연출을 통째로 건너뛴다. 그 0 을 「안 남았다」로 읽으면 이 검사는
     늘 통과한다 — 그래서 **먼저 시루 셋을 방에 놓고** 그 위에서 잰다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on(m => {
  if (m.method === 'Runtime.exceptionThrown')
    errs.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
});
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(4500);

async function walk() {
  for (let i = 0; i < 80; i++) {
    const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),
      g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (!busy) return;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s) s.click();
      const b=document.getElementById('dlgBox'); if(b) b.click();
      const g=document.getElementById('guideClose'); if(g) g.click();})()`, false);
    await sleep(280);
  }
}
await walk();

const snap = () => page.eval(`(()=>{
  const el = document.getElementById('actBar');
  const st = el ? getComputedStyle(el) : null;
  const i  = el && el.querySelector('i');
  const w  = (()=>{ try { return window.__byeotWalkSfx(); } catch { return null; } })();
  const mk = [...document.querySelectorAll('#marks .mark')]
    .map(m=>({ko:((m.querySelector('span')||{}).textContent||'').trim(),
              acting:m.classList.contains('acting')}));
  return JSON.stringify({
    bar: st ? st.display !== 'none' : null,
    ko: el ? (el.querySelector('b')||{}).textContent : null,
    p: i ? i.style.getPropertyValue('--p') : null,
    acting: w ? w.acting : null,
    marks: mk });
})()`).then(s => JSON.parse(s));

const freeHands = () => page.eval(`(()=>{const S=window.__S();
  if (S.stamina) S.stamina.usedToday = 0;})()`, false);

async function trace(label, seconds = 14) {
  const rows = [];
  for (let i = 0; i < seconds * 4; i++) {
    rows.push({ t: i * 250, ...(await snap()) });
    await sleep(250);
  }
  const key = r => `${r.bar}|${r.ko}|${r.p}|${r.acting}`;
  let last = null;
  console.log(`\n── ${label} ──`);
  for (const r of rows) {
    if (key(r) === last) continue;
    last = key(r);
    console.log(`  ${String(r.t).padStart(5)}ms  막대:${r.bar ? '보임' : '없음'}  «${r.ko}»  p=${r.p || '-'}  acting=${r.acting}`
      + `  말풍선:${r.marks.map(m => (m.acting ? '★' : '') + m.ko).join(' / ') || '없음'}`);
  }
  const end = rows[rows.length - 1];
  console.log(`  ⤷ 끝: 막대=${end.bar ? '보임' : '없음'} acting=${end.acting}`);
  return { rows, end };
}

/* ── 시루 셋을 서로 다른 자리에 놓는다 (갈길 것이 있어야 갈긴다) ── */
const SLOTS = ['banjiha-dresser:0', 'banjiha-dresser:1', 'banjiha-desk:0'];
await page.eval(`(()=>{ const S=window.__S();
  S.shop.stock.siru = (S.shop.stock.siru||0) + 4;
  S.shop.stock.bean_seed = (S.shop.stock.bean_seed||0) + 8; })()`, false);
for (const s of SLOTS) {
  const r = await page.eval(`(()=>{ const rv=window.__rv,
      c=document.getElementById('roomCanvas').getBoundingClientRect();
    const sp=rv.screenPosOf('${s}'); if(!sp) return 'no-slot';
    window.__drag.begin('beansprout', document.getElementById('cropThumb').src,
                        {clientX:c.left+c.width*0.9, clientY:c.top+40});
    window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end();
    return 'placed'; })()`);
  console.log(`시루 → ${s} : ${r}`);
  await sleep(1200); await walk();
}
await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(700);
const btns = await page.eval(`(()=>[...document.querySelectorAll('#siruList button[data-act]')]
  .map(b=>b.dataset.act).join(','))()`);
console.log(`시루 줄의 단추 → ${btns || '(없음)'}`);

const nth = (act, i) => page.eval(`(()=>{ const b=[...document.querySelectorAll(
    '#siruList button[data-act="${act}"]')];
  if(!b[${i}]) return 'no-btn(${act}#${i})';
  b[${i}].click(); return 'clicked ${act}#${i}'; })()`);

/* ── ① 한 번만 누른다 ─────────────────────────────────────── */
await freeHands();
console.log(`\n① 한 번 누름 → ${await nth('plant', 0)}`);
const A = await trace('① 한 번 누른 뒤');

/* ── ② 서로 다른 줄을 **한꺼번에** 갈긴다 (예전에는 셋이 즉시 끝났다) ── */
await sleep(600); await freeHands();
const t0 = Date.now();
const all3 = await page.eval(`(()=>{ const b=[...document.querySelectorAll(
    '#siruList button[data-act="plant"]')];
  const n=b.length; b.forEach(x=>x.click()); return '갈김 ' + n + '줄'; })()`);
console.log(`\n② ${all3}`);
const B = await trace('② 갈긴 뒤');
console.log(`  ⤷ 셋을 다 끝내는 데 걸린 시간(대략) ${((Date.now() - t0) / 1000).toFixed(1)}초 안쪽`);

/* ── ③ ★★ 막대를 **억지로 켜 놓는다** — 스스로 꺼져야 한다 ───────────
   박사님이 본 장면을 손으로 만든다. 하는 중이 아닌데 막대가 켜져 있는 상태다.
   원인이 무엇이었든(밀려난 진행률·놓친 짝) **하는 중이 아니면 막대는 없다**가 사실이고,
   그 사실로 매 틱 되돌아와야 한다(§actBarTick). */
await sleep(600);
const forced = await page.eval(`(()=>{ const el=document.getElementById('actBar');
  if(!el) return 'no-bar';
  el.style.display=''; el.querySelector('b').textContent='💧 물 주는 중';
  el.querySelector('i').style.setProperty('--p','50%');
  return getComputedStyle(el).display!=='none' ? '켰다' : '안 켜졌다'; })()`);
await sleep(700);
const stillOn = await page.eval(`(()=>{ const el=document.getElementById('actBar');
  return el ? getComputedStyle(el).display!=='none' : null; })()`);
console.log(`\n③ 막대를 억지로 ${forced} → 0.7초 뒤 ${stillOn ? '★아직 보인다(버그)' : '스스로 사라졌다'}`);

console.log(`\n(예외 ${errs.length}건)`);
if (errs.length) console.log(errs.slice(0, 6).join('\n'));

const stuckA = A.end.bar && A.end.acting === false;
const stuckB = B.end.bar && B.end.acting === false;
console.log(`\n★ 진단`);
console.log(`  ① 한 번 누른 뒤 막대가 남았나 : ${stuckA ? '★남았다(버그)' : '아니다'}`);
console.log(`  ② 갈긴 뒤 막대가 남았나       : ${stuckB ? '★남았다(버그)' : '아니다'}`);
console.log(`  ③ 억지로 켠 막대가 스스로 꺼지나 : ${stillOn ? '★안 꺼진다(버그)' : '꺼진다'}`);
await page.close();
process.exit(0);
