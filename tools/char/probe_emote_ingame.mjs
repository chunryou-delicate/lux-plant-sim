/* 게임 방 안에서 hero 에 몸짓 클립(cheer·wave)을 걸어 «몸짓 무게»가 실제로 바뀌는지 찍는다 — 크레딧 0.

   2026-10-08 · [Char]

   ■ 왜
   v2_hero.js installEmoteSkin 은 «팔을 수평 위로 들 때만» 머리·뺨 무게를 바꾼다.
   그림 자(shot_body_still --emote-skin)는 그 함수를 뽑아 따로 건다 ⇒ «게임 안에서도» 켜지는지는 따로 봐야 한다.

   ■ 어떻게
   tools/room_view_demo.html?room=banjiha 에 jachwi 를 세우고, 화면 갱신을 멈춘 뒤(setContinuous(false))
   hero 몸에 «내 믹서»로 클립을 걸어 시각마다 손으로 한 장씩 그린다. 몸짓 무게를 끈 판(원래 무게만)도 같은 시각에 찍는다.
   ⛔ 게임의 믹서는 그대로 있다 — 갱신을 멈춰야 내 자세가 덮이지 않는다. 다 찍으면 페이지를 닫는다(게임 상태 안 남김).

   쓰기
     BYEOT_URL=http://localhost:9351 node tools/char/probe_emote_ingame.mjs [cheer|wave]
   나오는 것: docs/handoff/img/bodytest/ingame_<clip>_<on|off>_tNN.png (사람 둘레만 잘라서)
*/
import { launch, sleep } from '../test_cdp.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const CLIP = process.argv[2] || 'cheer';
const OUT = join('docs', 'handoff', 'img', 'bodytest');

async function main() {
  mkdirSync(OUT, { recursive: true });
  const page = await launch({ width: 1280, height: 900, dpr: 1 });
  try {
    await page.goto(`${BASE}/tools/room_view_demo.html?room=banjiha`);
    await page.waitFor('!!window.view', 120000, 200);
    await page.eval(`window.view.setCharacter('jachwi').then(()=>1)`);
    await sleep(1500);
    await page.eval(`window.view.setContinuous(false)`);
    await sleep(500);
    const info = await page.eval(`(async()=>{
      const sc = window.view.three.scene;
      let mesh = null;
      sc.traverse(o => { if (!mesh && o.isSkinnedMesh && o.userData.emoteSkin) mesh = o; });
      if (!mesh) return JSON.stringify({ err: '몸짓 무게를 건 hero 메시가 없다' });
      let body = mesh; while (body.parent && body.parent.name !== '__scale_root') body = body.parent;
      const H = await import('/src/game/v2_hero.js');
      const hero = await H.makeHero();
      const clip = await hero.actClip(${JSON.stringify(CLIP)});
      if (!clip) return JSON.stringify({ err: '클립이 없다' });
      const mx = new THREE.AnimationMixer(body);
      mx.clipAction(clip).play();
      const G = mesh.geometry, keep = mesh.onBeforeRender;
      /* ⛔ 첫 판: 게임 루프가 사이사이 제 믹서(idle)로 그려 몸짓 무게를 도로 껐다(프레임이 10씩 넘어갔다).
         ⇒ 찍는 동안 게임의 render 를 막고 내가 부를 때만 그린다. 페이지는 끝나면 닫는다. */
      const C0 = window.view.three, R = C0.renderer, draw = R.render.bind(R);
      R.render = function () {};
      window.__emote = {
        mesh, mx, dur: clip.duration,
        pose(t, on) {
          mesh.onBeforeRender = on ? keep : function () {};
          if (!on) { G.setAttribute('skinIndex', G.attributes._joints_base); G.setAttribute('skinWeight', G.attributes._weights_base); }
          mx.setTime(t); body.updateMatrixWorld(true);
          const C = window.view.three;
          const f0 = C.renderer.info.render.frame;
          draw(C.scene, C.cam);
          /* 팔 각도 — installEmoteSkin 과 같은 셈(위팔이 몸통 위쪽과 이루는 각 · 두 팔 중 작은 쪽) */
          const bn = n => mesh.skeleton.bones.find(b => b.name === n);
          const P = n => bn(n).getWorldPosition(new THREE.Vector3());
          const up = P('Spine').sub(P('Hips')).normalize();
          const raise = Math.min(...['Left', 'Right'].map(s => Math.acos(P(s + 'ForeArm').sub(P(s + 'Arm')).normalize().dot(up)) * 180 / Math.PI));
          return { t: +t.toFixed(2), raise: +raise.toFixed(1), emote: on ? mesh.userData.emoteSkin() : false, frameGap: C.renderer.info.render.frame - f0 };
        }
      };
      return JSON.stringify({ clip: clip.name, dur: +clip.duration.toFixed(2), emoteSkin: hero.emoteSkin });
    })()`);
    console.log('  ' + info);
    if (JSON.parse(info).err) return;
    const pos = await page.eval(`window.view.characterScreenPos('jachwi')`);
    console.log('  사람 화면 자리 ' + JSON.stringify(pos));
    const dur = JSON.parse(info).dur;
    const fr = [0.25, 0.5, 0.75];
    for (const on of [false, true]) {
      let t0 = 0;
      for (const f of fr) {
        /* 실제 재생처럼 0초부터 1/30초씩 밟는다 — 몸짓 무게는 «앞 상태»를 기억한다(켬·끔 문턱이 다르다) */
        const r = await page.eval(`(()=>{ let r; for (let t=${t0.toFixed(4)}; t<=${(dur * f).toFixed(4)}+1e-6; t+=1/30) r=window.__emote.pose(t, ${on}); return JSON.stringify(r); })()`);
        t0 = dur * f;
        await sleep(200);
        const gap = await page.eval(`window.view.three.renderer.info.render.frame`);
        const file = join(OUT, `ingame_${CLIP}_${on ? 'on' : 'off'}_t${String(Math.round(f * 100)).padStart(2, '0')}.png`);
        await page.shot(file);
        console.log('  ' + (on ? '몸짓 무게 켬 ' : '원래 무게만 ') + r + ' · 찍을 때 프레임 ' + gap + ' → ' + file);
      }
    }
  } finally { try { await page.close(); } catch {} }
  console.log('⛔ 이 자는 «보기에 괜찮나»를 판정하지 않는다. 눈으로 볼 것.');
}
main();
