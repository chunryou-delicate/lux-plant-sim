/* ============================================================
   tools/probe_hintgone.mjs — **손화살표가 안 없어지던 것** (§E-2 · 2026-08-16)
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_hintgone.mjs

   박사님(§E-2): *"손화살표 — 다른 것 클릭했을 때 안 없어짐 · 시점 바꾸면 안 따라옴"*

   ★ 뿌리. `hintFollowLoop` 이 「가리키던 노드가 사라졌으면 **그냥 돌아간다**」였다.
     고리는 계속 도는데 아무 일도 안 하고, 손가락은 옛 자리에 켜진 채 남는다.
     말풍선은 `drawMarks` 가 **노드째 다시 만들므로** 그 일이 실제로 일어난다.
   ⚠ 「사진이 멀쩡하다」로 재지 않는다 — `#hint` 의 `on` 클래스와 **화면 좌표**를 잰다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
let bad = 0;
const ok = (n, c, g) => { console.log(`${c ? '  OK' : 'FAIL'}  ${n}${g == null ? '' : '  → ' + g}`); if (!c) bad++; };

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on(m => { if (m.method === 'Runtime.exceptionThrown')
  errs.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text); });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 90000, 300);
await sleep(4200);
for (let i = 0; i < 60; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (!b) break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
const hint = () => page.eval(`(()=>{ const h=document.getElementById('hint');
  const r=h.getBoundingClientRect();
  return JSON.stringify({ on:h.classList.contains('on'),
    say:(h.querySelector('.say')||{}).textContent||'',
    x:Math.round(r.left), y:Math.round(r.top) }); })()`).then(s => JSON.parse(s));

/* ① 손가락이 무언가를 가리키고 있나 */
const a = await hint();
ok('① 손가락이 떠 있다 (가리킬 것이 있다)', a.on, JSON.stringify(a));

/* ② ★ 가리키던 노드를 **없앤다** — 말풍선이 다시 그려질 때 실제로 일어나는 일이다 */
const killed = await page.eval(`(()=>{ const h=document.getElementById('hint');
  const say=(h.querySelector('.say')||{}).textContent||'';
  /* 지금 가리키는 그 노드를 찾는다 — 화면에서 hintTarget 표시가 붙어 있다 */
  let t=document.querySelector('.hintTarget');
  if(!t){ const m=document.querySelector('#marks .mark'); t=m; }
  if(!t) return 'no-target';
  t.remove();
  return 'removed:' + say; })()`);
console.log(`  ⤷ 가리키던 것을 없앴다 — ${killed}`);
await sleep(600);
const b = await hint();
ok('② ★★ 가리키던 것이 사라지면 **손가락도 꺼진다**', !b.on, JSON.stringify(b));

/* ③ ⚠ **자가 거짓말할 뻔한 자리다.** 처음에는 「다시 그리면 손가락이 돌아온다」로 잰 뒤
   `on || say` 로 통과시켰는데, 그건 **말이 남아 있기만 해도 참**이라 아무것도 안 재는 식이었다.
   게다가 내가 방금 **진짜 버튼을 지웠으니** 안 돌아오는 것이 오히려 맞다.
   ⇒ 재려던 것은 「꺼 놓고 영영 안 켜지지 않나」다. 그것은 **판을 새로 열어** 재야 한다. */
const stillOff = await hint();
ok('③ 없앤 뒤에도 손가락이 꺼진 채다 (되살아나 옛 자리를 가리키지 않는다)',
   !stillOff.on, JSON.stringify(stillOff));
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 90000, 300);
await sleep(4200);
for (let i = 0; i < 60; i++) {
  const b2 = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (!b2) break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
const c = await hint();
ok('④ ★ 판을 새로 열면 손가락이 다시 뜬다 (안내를 통째로 죽이지 않았다)',
   c.on, JSON.stringify(c));

console.log(`\n(예외 ${errs.length}건)`);
if (errs.length) console.log(errs.slice(0, 4).join('\n'));
console.log(bad ? `\n✗ ${bad}건 실패` : '\n★ 전부 통과');
await page.close();
process.exit(bad ? 1 : 0);
