/* 폰 화면(390×844)에서 주인공 «머리카락 화소»가 실제로 무슨 색으로 그려지나 — 크레딧 0.

   2026-10-08 · [Char] · 총괄 청: 「새벽 빛에서 짙은 갈색이 아니라 검정으로 읽히나」

   ■ 어떻게
   game.html 을 폰 크기로 띄우고(새 판) 방이 서면, 한 번의 eval 안에서:
     ① setDaylight(t) → redraw()(게임과 같은 후처리 길) → 캔버스를 그대로 읽는다(색 판)
     ② hero 만 남기고 다 숨긴 뒤 hero 재질을 «머리 지도»(빨강=머리 · hero_recolor_test_mask.png)로 바꿔
        같은 redraw() 로 그린다(가림 판) — 같은 길·같은 카메라라 화소가 맞물린다
     ③ 다 되돌린다
   가림 판의 빨강 화소를 1화소 깎아(가장자리 섞임 빼기) 색 판에서 그 자리 색을 모은다.
   ⛔ 대사창 같은 DOM 은 안 찍힌다(캔버스만 읽는다).

   쓰기   BYEOT_URL=http://localhost:9351 node tools/char/probe_hair_onscreen.mjs [t01 ...]
   나오는 것  docs/handoff/img/bodytest/hair_onscreen_<t>.png(색 판) · _mask.png · 숫자는 stdout(JSON 한 줄씩)
*/
import { launch, sleep } from '../test_cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const OUT = join('docs', 'handoff', 'img', 'bodytest');
const TS = process.argv.slice(2).filter(a => !a.startsWith('--')).map(Number);
const SCAN = process.argv.includes('--scan');
/* --tex=<경로> : hero 텍스처(map·emissiveMap)를 시험 그림으로 바꿔 끼운다(hero.glb 는 안 건드린다) · --tag=이름 : 파일 이름 꼬리 */
const TEX = (process.argv.find(a => a.startsWith('--tex=')) || '').slice(6);
const TAG = (process.argv.find(a => a.startsWith('--tag=')) || '').slice(6);
/* --zoom : 사람을 눌렀을 때처럼 selectCharacter('jachwi') 로 카메라를 다가가게 한 뒤 찍는다(카메라가 멎을 때까지 기다린다) */
const ZOOM = process.argv.includes('--zoom');

async function main() {
  mkdirSync(OUT, { recursive: true });
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: true });
  try {
    await page.goto(`${BASE}/game.html`); await sleep(2500);
    await page.eval(`(()=>{try{localStorage.clear()}catch(e){}})()`, false);
    await page.goto(`${BASE}/game.html`);
    await page.waitFor('!!window.__rv', 300000, 500);
    await sleep(6000);
    await page.waitFor(`(()=>{let m=null;window.__rv.three.scene.traverse(o=>{if(o.isSkinnedMesh&&o.userData.emoteSkin)m=o});return !!m})()`, 120000, 500);
    if (SCAN) {
      const lab = await page.eval(`JSON.stringify(Array.from({length:25},(_,i)=>[+(i/24).toFixed(3), String(window.__rv.setDaylight(i/24))]))`);
      console.log('시간대 ' + lab);
    }
    await page.eval(`(async()=>{
      const tl = new THREE.TextureLoader();
      const tex = await new Promise((res, rej) => tl.load('/assets/derived/hero_test/hero_recolor_test_mask.png', res, undefined, rej));
      tex.flipY = false; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
      window.__maskTex = tex;
      const swap = ${JSON.stringify(TEX)};
      if (swap) {
        const t2 = await new Promise((res, rej) => tl.load('/' + swap, res, undefined, rej));
        t2.flipY = false; t2.encoding = THREE.sRGBEncoding;
        let hero = null; window.__rv.three.scene.traverse(o => { if (o.isSkinnedMesh && o.userData.emoteSkin) hero = o; });
        const mt = hero.material;
        if (mt.map) { t2.wrapS = mt.map.wrapS; t2.wrapT = mt.map.wrapT; mt.map = t2; }
        if (mt.emissiveMap) mt.emissiveMap = t2;
        mt.needsUpdate = true;
      }
      return 1; })()`);
    if (ZOOM) {
      await page.eval(`(()=>{ window.__rv.selectCharacter('jachwi'); return 1; })()`);
      await sleep(800);
      await page.waitFor('(()=>{ const b = window.__rv.camBusy(); return !b.tween && b.zoom === false; })()', 30000, 200);   // camBusy 는 객체다
      await sleep(500);
    }
    for (const t of TS) {
      const r = JSON.parse(await page.eval(`(()=>{
        const rv = window.__rv, C = rv.three, cv = C.renderer.domElement;
        const label = String(rv.setDaylight(${t}));
        rv.redraw();
        const color = cv.toDataURL('image/png');
        let hero = null; C.scene.traverse(o => { if (o.isSkinnedMesh && o.userData.emoteSkin) hero = o; });
        const vis = []; C.scene.traverse(o => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) { vis.push([o, o.visible]); o.visible = false; } });
        hero.visible = true;
        const mat0 = hero.material, bg0 = C.scene.background, fog0 = C.scene.fog;
        hero.material = new THREE.MeshBasicMaterial({ map: window.__maskTex, skinning: true });
        C.scene.background = new THREE.Color(0x000000); C.scene.fog = null;
        rv.redraw();
        const mask = cv.toDataURL('image/png');
        hero.material.dispose(); hero.material = mat0; C.scene.background = bg0; C.scene.fog = fog0;
        for (const [o, v] of vis) o.visible = v;
        rv.redraw();
        return JSON.stringify({ t: ${t}, label, w: cv.width, h: cv.height, color, mask });
      })()`));
      const tag = String(t).replace('.', '_') + (TAG ? '_' + TAG : '');
      for (const k of ['color', 'mask']) {
        const f = join(OUT, `hair_onscreen_${tag}${k === 'mask' ? '_mask' : ''}.png`);
        writeFileSync(f, Buffer.from(r[k].split(',')[1], 'base64'));
      }
      console.log(JSON.stringify({ t, label: r.label, canvas: [r.w, r.h], files: `hair_onscreen_${tag}(_mask).png` }));
    }
  } finally { try { await page.close(); } catch {} }
}
main();
