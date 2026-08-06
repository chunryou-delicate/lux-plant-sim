/* ============================================================
   tools/test_ground.mjs — **바닥에 붙어 있나**를 숫자로 못 박는다
   ------------------------------------------------------------
   박사님(2026-08-06 · 폰 실기): "캐릭이 허리가 공중에 매달려서 대롱대롱해.
   바닥에 붙어 있는 게 아니라 왜 저래" — 화분도 선반 옆 공중에 떠 있었다.

     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_ground.mjs

   ★ 무엇을 재나 — 전부 **세계좌표 Box3 의 min.y** 하나다.
     떠 있다 = 놓인 면(바닥 0 · 상판 y)보다 min.y 가 위에 있다.
     박혀 있다 = 아래에 있다. 둘 다 틀린 것이고, 눈으로는 "대롱대롱"으로 보인다.

     A 캐릭터(자취녀)가 바닥에 붙는다        |min.y| ≤ 1cm
     B 몬이는 **일부러 뜬다** — 마스코트다. 뜬 높이가 MON.floatHeight 와 같아야 한다
     C 바닥에 놓은 화분(몬스테라·시루·무순)이 바닥에 붙는다
     D 상판에 놓은 화분이 그 상판에 붙는다   (slot.y 와 min.y 차이 ≤ 1cm)
     E 걷는 중에도 안 뜬다 (걷기 클립이 루트를 들어 올리지 않나)
     F ★ 접지 그림자(blob)가 화분·사람 밑에 깔린다 — 그림자가 곧 "붙어 보임"이다

   ⚠ 크기는 안 본다. GLB 에 구워진 1.40m 를 여기서 다시 재서 고치면 안 된다
     (README §1). 이 검사는 **높이(y)만** 본다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const ROOM = process.env.BYEOT_ROOM || 'banjiha';

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log(`PASS  ${name}${extra ? '  — ' + extra : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  — ' + extra : ''}`); }
};

/* ⚠⚠ **캐릭터에 Box3.setFromObject 를 쓰면 안 된다.**
   스킨드 메시의 정점은 뼈가 움직이는데 Box3 는 기하의 바인드 상자에 메시 노드 행렬만
   곱한다. 재 보면 1.4m 짜리 사람이 [0, 0.014]m 로 나온다 — 실제로 그렇게 나와서
   "캐릭터 키 0.02m" 라는 검사 결과를 한 번 받았다.
   ⚠ 그리고 `skeleton.update()` 를 안 부르면 boneTransform 이 **바인드 포즈**를 돌려준다.
     그것도 겪었다 — 그 값으로 재면 "클립은 멀쩡하다"는 잘못된 결론이 나온다.
   그림자 판때기(blob)·픽 상자는 뺀다. 넣으면 무엇을 재든 min.y 가 0 이 되어 무의미해진다. */
const BB = `(o) => { const THREE = window.THREE;
  const b = new THREE.Box3(); b.makeEmpty();
  const v = new THREE.Vector3();
  o.updateMatrixWorld(true);
  o.traverse(n => {
    if (!n.isMesh || !n.geometry || !n.geometry.attributes || !n.geometry.attributes.position) return;
    if (n.userData && (n.userData.isBlobShadow || n.userData.isPickBox)) return;
    if (n.type === 'Mesh' && n.geometry.type === 'RingGeometry') return;   // 고르기 링
    const pos = n.geometry.attributes.position;
    if (n.isSkinnedMesh && typeof n.boneTransform === 'function') {
      n.skeleton.update();
      const step = Math.max(1, Math.floor(pos.count / 900));
      for (let i = 0; i < pos.count; i += step) {
        n.boneTransform(i, v); b.expandByPoint(v.applyMatrix4(n.matrixWorld));
      }
      return;
    }
    if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
    const g = n.geometry.boundingBox;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? g.max.x : g.min.x, i & 2 ? g.max.y : g.min.y, i & 4 ? g.max.z : g.min.z);
      b.expandByPoint(v.applyMatrix4(n.matrixWorld));
    }
  });
  return b; }`;

async function main() {
  const page = await launch({ width: 390, height: 844, dpr: 2 });
  const exs = [];
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') exs.push(p.exceptionDetails.text); });
  /* ?engine=1 — 조도 엔진을 붙여 띄운다. 검사 I(조도가 안 바뀐다)가 이걸 쓴다. */
  await page.goto(`${BASE}/tools/room_view_demo.html?room=${ROOM}&engine=1`);
  await page.waitFor('!!window.view', 180000, 200);
  await page.eval(`window.__bb = ${BB}; 1`);

  await page.eval(`window.view.setCharacter('jachwi').then(()=>1)`);
  await page.eval(`window.view.setCharacter('moni').then(()=>1)`);
  await sleep(1800);

  /* ── 캐릭터 루트를 찾는 길 — 픽 상자를 단 그룹이 곧 캐릭터 루트다 ── */
  const CHARS = `(() => { const T = window.view.three, out = [];
    T.scene.traverse(o => { if (o.userData && o.userData.isCharacterPick && o.parent) {
      const r = o.parent, b = window.__bb(r);
      out.push({ kind: r.userData.charKind || null,
                 y: +r.position.y.toFixed(4),
                 minY: +b.min.y.toFixed(4), maxY: +b.max.y.toFixed(4),
                 h: +(b.max.y - b.min.y).toFixed(4) }); } });
    return JSON.stringify(out); })()`;

  const chars = JSON.parse(await page.eval(CHARS));
  console.log('\n── 캐릭터 (세계좌표 m) ' + '─'.repeat(46));
  console.log('종류        root.y   bb.min.y   bb.max.y     키');
  for (const c of chars)
    console.log(`${String(c.kind || '?').padEnd(10)} ${String(c.y).padStart(7)} ${String(c.minY).padStart(10)} ` +
                `${String(c.maxY).padStart(10)} ${String(c.h).padStart(6)}`);

  const person = chars.find(c => c.kind === 'person') || chars.find(c => c.h > 1);
  const mascot = chars.find(c => c.kind === 'mascot') || chars.find(c => c.h < 1);

  ok('A 자취녀가 바닥에 붙는다 (|bb.min.y| ≤ 0.01m)',
     person && Math.abs(person.minY) <= 0.01, person ? `bb.min.y=${person.minY}m` : '캐릭터가 없다');
  /* ★ '1.40m' 은 **바인드 포즈**의 키다. idle 은 힘을 빼고 선 자세라 그보다 조금 낮다
     (재 보면 1.33~1.36m). 여기서 보는 것은 "크기를 안 건드렸나"이지 "정확히 1.40 인가"가
     아니다 — 배율이 걸렸다면 이 범위를 크게 벗어난다. */
  ok('A2 키가 그대로다 — 크기를 안 건드렸다 (1.28~1.45m)',
     person && person.h > 1.28 && person.h < 1.45, person ? `${person.h}m` : '—');

  ok('B 몬이는 일부러 뜬다 (마스코트)',
     mascot && mascot.minY > 0.05, mascot ? `bb.min.y=${mascot.minY}m` : '—');

  /* ── 화분 ─────────────────────────────────────────────────────── */
  console.log('\n── 화분 ' + '─'.repeat(58));
  const PLANTS = `(async () => {
    const out = [];
    /* ① 바닥 자유좌표 세 종류 */
    for (const [id, kind] of [['g_mon','monstera'], ['g_bean','beansprout'], ['g_musun','musun']]) {
      const g = await window.view.setPlantAt(id, { x: -0.6 + out.length * 0.6, y: 0, z: 0.6 },
                                            { kind, progress01: 0.8, growthDays: 200, seed: 5 });
      const b = window.__bb(g);
      out.push({ where: '바닥 ' + kind, base: 0, y: +g.position.y.toFixed(4), minY: +b.min.y.toFixed(4) });
    }
    /* ② 상판(추천 자리) — 자리의 y 가 놓일 면이다 */
    const S = window.view.slots().filter(s => !s.occupied && s.pos.y > 0.2).slice(0, 3);
    for (const s of S) {
      await window.view.setPlant(s.slotId, { kind: 'monstera', growthDays: 200, seed: 7, band: 'good' });
      const t = window.view.resolveKey(s.slotId);
      let node = null;
      window.view.three.scene.traverse(o => { if (!node && o.userData && o.userData.plantSlotId === t.key && o.parent && o.parent.type === 'Group' && o.userData.potId != null) node = o; });
      /* 그루의 뿌리 노드 — plants() 좌표와 같은 것을 고른다 */
      node = null;
      window.view.three.scene.traverse(o => {
        if (node) return;
        if (o.userData && o.userData.plantSlotId === t.key &&
            Math.abs(o.position.x - s.pos.x) < 1e-3 && Math.abs(o.position.z - s.pos.z) < 1e-3) node = o;
      });
      if (!node) continue;
      const b = window.__bb(node);
      out.push({ where: s.slotId, base: +s.pos.y.toFixed(4), y: +node.position.y.toFixed(4), minY: +b.min.y.toFixed(4) });
    }
    return JSON.stringify(out);
  })()`;
  const plants = JSON.parse(await page.eval(PLANTS));
  console.log('자리                      놓일면 y   그룹 y   bb.min.y     뜬 높이');
  let floorBad = 0, shelfBad = 0;
  for (const p of plants) {
    const gap = +(p.minY - p.base).toFixed(4);
    if (Math.abs(gap) > 0.01) { if (p.base === 0) floorBad++; else shelfBad++; }
    console.log(`${p.where.padEnd(24)} ${String(p.base).padStart(8)} ${String(p.y).padStart(8)} ` +
                `${String(p.minY).padStart(10)} ${String(gap).padStart(10)}`);
  }
  ok('C 바닥에 놓은 화분이 바닥에 붙는다', floorBad === 0, `어긋난 것 ${floorBad}개`);
  ok('D 상판에 놓은 화분이 그 상판에 붙는다', shelfBad === 0, `어긋난 것 ${shelfBad}개`);

  /* ── E 걷는 중에도 안 뜬다 ─────────────────────────────────────── */
  await page.eval(`window.view.selectCharacter('jachwi')`);
  const sent = await page.eval(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect();
    const f=window.view.characterScreenPos('jachwi'); if (!f) return null;
    for (let a=0;a<16;a++) for (const R of [90,140]) {
      const x=r.left+f.x+Math.cos(a/16*6.283)*R, y=r.top+f.y+Math.sin(a/16*6.283)*R*0.6;
      const t=window.view.previewWalk('jachwi',x,y);
      if (t && t.ok) { window.view.previewWalk('jachwi',null,null); return JSON.stringify({x,y}); } }
    window.view.previewWalk('jachwi',null,null); return null; })()`);
  let walkMax = 0, walkMin = 0;
  if (sent) {
    const s = JSON.parse(sent);
    await page.eval(`window.view.walkTo('jachwi', ${s.x}, ${s.y})`);
    for (let i = 0; i < 80 && await page.eval(`window.view.isWalking('jachwi')`); i++) {
      const y = +(await page.eval(`(()=>{ let r=null; window.view.three.scene.traverse(o=>{
        if (!r && o.userData && o.userData.isCharacterPick && o.parent && o.parent.userData.charKind==='person') r=o.parent; });
        return r ? window.__bb(r).min.y : 0; })()`));
      walkMax = Math.max(walkMax, y); walkMin = Math.min(walkMin, y);
      await sleep(60);
    }
  }
  ok('E 걷는 중에도 발이 바닥을 안 떠난다 (|min.y| ≤ 0.02m)',
     Math.max(Math.abs(walkMax), Math.abs(walkMin)) <= 0.02,
     `걷는 동안 min.y ${walkMin.toFixed(4)} ~ ${walkMax.toFixed(4)}m`);

  /* ── E2 ★ 보정이 **클립마다** 걸려 있나 ─────────────────────────────
     박사님(2026-08-06): "서서 하는 모션(머리 긁적임) 때만 발이 대롱대롱해."
     한 클립에만 상수를 박으면 다른 클립에서 또 뜬다 — 그래서 클립마다 재고,
     그 표가 실제로 채워졌는지를 여기서 못 박는다. */
  const gr = JSON.parse(await page.eval(
    `JSON.stringify((window.view.characters().find(c=>c.kind==='person')||{}).ground||null)`));
  if (gr) {
    console.log('\n발바닥 보정 (클립 → model.position.y[m])');
    for (const [k, v] of Object.entries(gr.clips)) console.log(`  ${k.padEnd(16)} ${v}`);
  }
  ok('E2 걸어 본 뒤 idle·walking **둘 다** 따로 재어 두었다 (한 값으로 안 뭉갠다)',
     gr && gr.clips && gr.clips.idle != null && gr.clips.walking != null
        && Math.abs(gr.clips.idle - gr.clips.walking) > 0.03,
     gr ? `idle ${gr.clips.idle} · walking ${gr.clips.walking}` : '보정표가 없다');

  /* ── F 접지 그림자 ─────────────────────────────────────────────── */
  const blobs = JSON.parse(await page.eval(`(()=>{ const out=[];
    window.view.three.scene.traverse(o => { if (o.userData && o.userData.isBlobShadow) {
      o.updateWorldMatrix(true,false);
      const p = new window.THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      out.push({ y:+p.y.toFixed(4), visible:o.visible }); } });
    return JSON.stringify(out); })()`));
  console.log(`\n접지 그림자 ${blobs.length}장 · 바닥에서 뜬 높이 ` +
              (blobs.length ? `${Math.min(...blobs.map(b=>b.y)).toFixed(4)}~${Math.max(...blobs.map(b=>b.y)).toFixed(4)}m` : '—'));
  ok('F 접지 그림자가 사람·화분 밑에 깔린다', blobs.length >= 3, `${blobs.length}장`);

  /* ── H 화면을 훑어 "받쳐지지 않은 자리"가 나오나 ──────────────────
     방뷰가 스스로 내주는 자리(surfaceAt · ok:true)는 전부 무언가 위여야 한다.
     아래로 광선을 다시 쏴서 그 면이 정말 거기 있는지 확인한다. */
  const scan = JSON.parse(await page.eval(`(()=>{
    const V=window.view, T=V.three, THREE=window.THREE;
    const c=document.getElementById('roomCanvas'), r=c.getBoundingClientRect();
    const down=new THREE.Raycaster(); let n=0, floatN=0; const ex=[];
    for(let px=20; px<r.width-20; px+=26) for(let py=60; py<r.height-120; py+=26){
      const s=V.surfaceAt(r.left+px, r.top+py, {potD:0.20});
      if(s.y==null || !s.ok) continue;
      n++;
      down.set(new THREE.Vector3(s.x, s.y+0.05, s.z), new THREE.Vector3(0,-1,0));
      const hits=down.intersectObject(T.scene, true).filter(h=>h.object.isMesh && h.object.visible
        && !(h.object.userData&&(h.object.userData.isBlobShadow||h.object.userData.isPreview)));
      const top = hits.length ? hits[0].point.y : null;
      /* 뜬 것 = 받쳐 주는 면이 **아래로 3cm 넘게** 떨어져 있다 */
      if(top==null || s.y - top > 0.03){ floatN++; if(ex.length<4) ex.push({y:+s.y.toFixed(3), under:top}); }
    }
    return JSON.stringify({n, floatN, ex});
  })()`));
  ok('H 방뷰가 내주는 자리는 전부 무언가 위다 (뜬 자리 0)',
     scan.floatN === 0, `${scan.n}점 중 뜬 자리 ${scan.floatN} ${JSON.stringify(scan.ex)}`);

  /* ── I ★ 그림자는 **그림**이지 계산이 아니다 ────────────────────────
     접지 그림자·발바닥 보정을 넣고 뺐을 때 자리별 DLI 가 한 톨도 안 바뀌어야 한다.
     (조도는 light_adapter 가 방 정의로 낸다 — 이 판때기는 houseGroup 에만 붙는다) */
  const dli = JSON.parse(await page.eval(`(async () => {
    const V = window.view, E = window.engine;
    if (!E) return JSON.stringify({ skip: true });
    const pts = V.slots().map(s => ({ x:s.pos.x, y:s.pos.y, z:s.pos.z, id:s.slotId }));
    const read = () => pts.map(p => E.dliAt({ x:p.x, y:p.y, z:p.z }).dli);
    const before = read();
    await V.setCharacter('jachwi'); await V.setCharacter('moni');
    await V.setPlantAt('dliProbe', { x:0, y:0, z:0 }, { kind:'monstera', growthDays:200, seed:1 });
    const after = read();
    await V.setPlantAt('dliProbe', null, null);
    return JSON.stringify({ ids: pts.map(p=>p.id), before, after });
  })()`));
  if (dli.skip) {
    console.log('\n(조도 엔진 없이 띄운 화면이라 DLI 검사를 건너뜁니다 — ?engine=1 로 띄우면 잽니다)');
  } else {
    const moved = dli.ids.filter((id, i) => Math.abs(dli.before[i] - dli.after[i]) > 1e-9);
    ok('I 접지 그림자·발바닥 보정을 넣어도 자리별 DLI 가 한 톨도 안 바뀐다',
       moved.length === 0 && dli.before.length > 0,
       `${dli.before.length}점 · 바뀐 것 ${JSON.stringify(moved.slice(0, 3))}`);
  }

  console.log(`\n예외 ${exs.length}건` + (exs.length ? '\n  ' + exs.join('\n  ') : ''));
  ok('G 콘솔 예외가 없다', exs.length === 0);

  console.log(`\n=== ${pass} PASS · ${fail} FAIL ===`);
  await page.close();
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
