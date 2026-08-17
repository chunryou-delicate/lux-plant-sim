/* 방에 있는 것을 **집어 옮길 때** 미리보기가 무엇으로 서나 (박사님 ㉢).
   ------------------------------------------------------------
   ⚠ 「가방에서 끈 것」과 「방에서 집은 것」은 **다른 길**이다. 여기서 재는 것은 뒷길뿐이다.
   재는 것 셋:
     ① 2D 사진(#dragGhost)이 방 안에서 감춰지나 — `inroom` 클래스와 실제 display
     ② 3D 유령이 **집은 그루**로 서나 — preview 의 srcKey/fromId
     ③ 격자·네모가 켜져 있나 */
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

/* ── ① 가방에서 끄는 길의 설치지점 미리보기 ── (방에서 집는 길과 **다른 길**이다) */
console.log('가방길 —', await page.eval(`(()=>{ try {
  const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  const t=document.getElementById('cropThumb');
  window.__drag.begin('beansprout', t ? t.src : '', {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y});
  const gh=document.getElementById('dragGhost'), cs=getComputedStyle(gh);
  let g=null; rv.three.scene.traverse(o=>{ if(!g&&o.userData&&o.userData.isPreview&&o.parent
                                             && !(o.parent.userData||{}).isPreview) g=o; });
  let meshes=0; if(g) g.traverse(o=>{ if(o.isMesh) meshes++; });
  const r=JSON.stringify({ 사진보이나: cs.display!=='none',
                           그림:(cs.backgroundImage||'').slice(-34),
                           유령메시: meshes, 대역인가: !!(g&&g.userData&&g.userData.generic) });
  window.__drag.end();
  return r;
} catch(e){ return 'ERR '+e.message; } })()`));
await sleep(600);
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`, false);
await sleep(900);
await page.eval(`(()=>{ const rv=window.__rv; for(const p of rv.plants()) rv.removePlantOf(p.potId); })()`, false);
await sleep(400);

/* 시루를 하나 방에 세운다 — 가방에서 끄는 길로. (§probe_move_audit 이 쓰는 그 손짓이다) */
await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  const t=document.getElementById('cropThumb');
  window.__drag.begin('beansprout', t ? t.src : '', {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y});
  window.__drag.end(); })()`, false);
await sleep(1500);
await page.eval(`(()=>{const b=document.getElementById('placeOk'); if(b&&b.offsetParent)b.click();})()`, false);
await sleep(1200);

const before = await page.eval(`(()=>{ try {
  const rv = window.__rv;
  return JSON.stringify({ 방에선것: rv.plants().map(p => ({ key: p.key, kind: p.kind, potId: p.potId })) });
} catch (e) { return 'ERR ' + e.message; } })()`);
console.log('놓기 전/후 —', before);

const out = await page.eval(`(()=>{ try {
  const rv = window.__rv, P = window.__picked;
  const list = rv.plants();
  if (!list.length) return 'ERR 방에 아무것도 없다';
  const key = list[0].key;
  /* ⚠⚠ 앞 끌기가 남긴 inroom 을 **먼저 걷는다.** drag.end() 가 그 클래스를 안 떼서
     가방에서 한 번 끌어 본 판에서는 찌꺼기가 남아 사진이 저절로 감춰진다 —
     그 상태로 재면 「고쳐져 있다」로 나온다. 앞 창이 재현 못 한 까닭이 이것이다. */
  document.getElementById('dragGhost').classList.remove('inroom');
  P.clear(); P.select(key); P.beginMove();
  /* 손가락을 조금 끈다 — 방 한가운데 쪽으로 */
  P.down({ clientX: 500, clientY: 500 });
  P.move({ clientX: 560, clientY: 470 });
  const gh = document.getElementById('dragGhost');
  const cs = getComputedStyle(gh);
  return JSON.stringify({
    집은열쇠: key, 집은종류: P.kindAt(key), 붙든것: P.potId,
    사진: { class: gh.className, display: cs.display,
            보이나: cs.display !== 'none' && cs.visibility !== 'hidden',
            /* ★ 「떠 있다」와 「보인다」는 다르다 — 크기와 그림이 있어야 실제로 눈에 든다 */
            크기: [Math.round(gh.getBoundingClientRect().width), Math.round(gh.getBoundingClientRect().height)],
            그림: (cs.backgroundImage || '').slice(0, 90) },
    /* 유령이 **무엇으로 섰나** — 진짜 그루를 복사했으면 메시가 여럿이고 크기도 그 물건 것이다.
       대역(generic)이면 단순한 원기둥 하나다. 눈이 아니라 이걸로 가른다. */
    유령: (() => {
      let g = null;
      rv.three.scene.traverse(o => { if (!g && o.userData && o.userData.isPreview && o.parent
                                         && !(o.parent.userData || {}).isPreview) g = o; });
      if (!g) return null;
      let meshes = 0, lines = 0;
      g.traverse(o => { if (o.isMesh) meshes++; if (o.isLine || o.isLineSegments) lines++; });
      return { 메시수: meshes, 선: lines, 자식: g.children.length };
    })(),
    격자켜짐: (rv.guideCells({ potD: 0.20 }) || []).length,
    라벨: (document.getElementById('dropLabel') || {}).textContent
  });
} catch (e) { return 'ERR ' + e.message + '\\n' + e.stack; } })()`);
console.log(out);
await sleep(900);
await page.shot(process.argv[2] || 'docs/handoff/img/topcell/movedrag.png');
await page.close();
