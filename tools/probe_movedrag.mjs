/* 끄는 동안 **설치지점 미리보기**가 무엇으로 서나 (박사님 ㉢ · 2026-08-18).
   ------------------------------------------------------------
   ⚠ 「가방에서 끈 것」과 「방에서 집은 것」은 **다른 길**이다. 둘 다 잰다 — 하나만 재면
     나머지가 조용히 남는다(2026-08-17 에 세 번 그랬다).
   재는 것 셋:
     ① 2D 사진(#dragGhost)이 방 안에서 감춰지나 — inroom 클래스와 **실제 display**
     ② 3D 유령이 **그 물건**으로 서나 — 메시 수와 generic 여부. 대역은 원기둥 하나다
     ③ 그 사진에 붙은 그림이 그 물건 것인가 — 밑값(몬스테라)으로 안 떨어졌나
   ⚠⚠ 방에서 집는 길을 재기 전에 **inroom 찌꺼기를 먼저 걷는다.** drag.end() 가 안 떼서
     가방에서 한 번 끌어 본 판은 저절로 감춰져 「이미 고쳐져 있다」로 나온다. */
import { launch, sleep } from './test_cdp.mjs';
const _wd = setTimeout(() => { console.error('⏱ 자가 제한 초과'); process.exit(2); }, 300000);
_wd.unref && _wd.unref(); process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 1280, height: 900, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(7000);
for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (!busy) break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}

/* 유령을 재는 한 벌 — 두 길이 **같은 자**를 쓴다 */
const GHOST = `(()=>{ const rv=window.__rv;
  let g=null; rv.three.scene.traverse(o=>{ if(!g&&o.userData&&o.userData.isPreview&&o.parent
                                             && !(o.parent.userData||{}).isPreview) g=o; });
  if(!g) return null;
  let m=0,l=0; g.traverse(o=>{ if(o.isMesh)m++; if(o.isLine||o.isLineSegments)l++; });
  return { 메시:m, 선:l, 대역인가: !!(g.userData&&g.userData.generic) }; })()`;
const PHOTO = `(()=>{ const gh=document.getElementById('dragGhost'), cs=getComputedStyle(gh);
  return { 보이나: cs.display!=='none' && cs.visibility!=='hidden',
           그림: (cs.backgroundImage||'').split('/').pop().replace(/["')]+$/,'') }; })()`;

/* ── ① 가방에서 끄는 길 ── */
await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  const t=document.getElementById('cropThumb');
  window.__byeotProbeSp = {x:c.left+sp.x, y:c.top+sp.y};
  window.__drag.begin('beansprout', t ? t.src : '', {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:window.__byeotProbeSp.x, clientY:window.__byeotProbeSp.y}); })()`, false);
/* ⚠ 유령 원본 조립은 async 다 — 기다린 **뒤에** 한 번 더 끌어야 그 프레임에 실린다 */
await sleep(2500);
await page.eval(`window.__drag.move({clientX:window.__byeotProbeSp.x+1, clientY:window.__byeotProbeSp.y})`, false);
await sleep(400);
console.log('가방길 — 사진', await page.eval(PHOTO), '· 유령', await page.eval(GHOST));
await page.shot('docs/handoff/img/topcell/bagdrag.png');
await page.eval(`window.__drag.end()`, false);
await sleep(1200);
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`, false);
await sleep(1200);

/* ── ② 방에서 집어 옮기는 길 ── */
const out = await page.eval(`(()=>{ try {
  const rv = window.__rv, P = window.__picked;
  const list = rv.plants();
  if (!list.length) return 'ERR 방에 아무것도 없다';
  const key = list[0].key;
  document.getElementById('dragGhost').classList.remove('inroom');   /* ⚠ 찌꺼기를 먼저 걷는다 */
  P.clear(); P.select(key); P.beginMove();
  P.down({ clientX: 500, clientY: 500 });
  P.move({ clientX: 560, clientY: 470 });
  return JSON.stringify({ 집은열쇠: key, 집은종류: P.kindAt(key), 붙든것: P.potId,
                          라벨: (document.getElementById('dropLabel')||{}).textContent });
} catch (e) { return 'ERR ' + e.message; } })()`);
console.log('방안길 —', out);
console.log('방안길 — 사진', await page.eval(PHOTO), '· 유령', await page.eval(GHOST));
await sleep(700);
await page.shot(process.argv[2] || 'docs/handoff/img/topcell/movedrag.png');
await page.close();
