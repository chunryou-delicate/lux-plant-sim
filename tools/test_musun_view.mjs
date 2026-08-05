/* ============================================================
   tools/test_musun_view.mjs — 무순(재배판)을 방 3D 에 세운다
   ------------------------------------------------------------
   test_roomview_place.mjs 와 같은 방식이다: 진짜 브라우저(헤드리스 크롬)에서
   tools/room_view_demo.html 을 띄우고 계약을 하나씩 눌러 본다.
   3D 는 node:vm 으로 못 돌린다 — WebGL 이 필요하고, 지름은 정점을 훑어야 나온다.

     python tools/serve.py 8987
     node tools/test_musun_view.mjs

   ★ 여기서 보는 것
     ① **회귀** — 무순을 넣기 전후로 콩나물·몬스테라의 지름·높이·자리가 **완전히 같다**.
        아래 GOLD 표는 무순을 붙이기 **전에** 같은 방·같은 자리에서 실제로 잰 값이다.
        눈으로 안 본다 — 숫자로 비교한다.
     ② setPlant / setPlantAt 에 kind:'musun' 을 주면 던지지 않고 **실제로 선다**
     ③ progress01 0 → 1 로 갈 때 무순 **포기 수가 단조 증가**하고 NaN 이 안 난다
        (콩나물에서 lerp(4,11,undefined) → NaN → 0포기가 실제로 났던 사고다)
     ④ 재배판이 놓인 자리의 **조도 계약이 안 바뀐다** — container_tray_s 는
        blocks_light:false 다. 방뷰가 화분을 가림막으로 넣으면 그 순간 계약이 깨진다
     ⑤ 콘솔에 처리 안 된 예외 0건

   ⚠ 서버가 먼저 떠 있어야 한다. 떠도는 서버가 포트를 먼저 잡으면 **낡은 코드를 잰다**.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BYEOT_URL || 'http://localhost:8987';
const URL_ = `${BASE}/tools/room_view_demo.html?room=banjiha&engine=1`;
const SHOTS = !process.argv.includes('--no-shots');
const SHOT_DIR = fileURLToPath(new URL('../docs/engine/shots/', import.meta.url));

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? '  — ' + extra : ''}`); }
};
const near = (a, b, eps) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;

/* ── 자 ────────────────────────────────────────────────────────
   그루를 **방뷰와 같은 규칙**으로 재는 자를 페이지에 심는다.
   potPart(= leaves 를 뺀 첫 자식)만 재는 이유는 room_view.potPartOf 와 같다 —
   잎·포기는 용기 밖으로 나가는 게 정상이라 같이 재면 지름이 거짓이 된다.
   ★ 콩나물 몸통 각도에는 Math.random 이 들어 있어 **그루 전체 bbox 는 결정적이지 않다.**
     그래서 회귀는 potPart·지름·자리·자식 수로 못 박고, 전체 높이는 몬스테라만 본다. */
const INSTALL = `(() => {
  const V = window.view, T = window.THREE;
  const r5 = v => +Number(v).toFixed(5);
  window.__potPart = g => {
    const leaves = g.userData.leaves || [];
    return g.userData.potPart || g.children.find(c => !leaves.includes(c)) || g;
  };
  window.__bbox = o => {
    const b = new T.Box3().setFromObject(o);
    return { w: r5(b.max.x - b.min.x), h: r5(b.max.y - b.min.y), d: r5(b.max.z - b.min.z) };
  };
  window.__grp = key => {
    let g = null;
    V.three.scene.traverse(o => {
      if (!g && o.userData && o.userData.plantSlotId === key
          && o.parent && !(o.parent.userData && o.parent.userData.plantSlotId === key)) g = o;
    });
    return g;
  };
  window.__measure = key => {
    const g = window.__grp(key);
    if (!g) return null;
    const pot = window.__potPart(g);
    const kids = g.children.filter(c => c !== pot);
    return {
      kind: g.userData.kind || null,
      pos: { x: r5(g.position.x), y: r5(g.position.y), z: r5(g.position.z) },
      children: g.children.length,
      bodies: kids.length,
      diameter: r5(V.plantDiameter(key) ?? -1),
      pot: window.__bbox(pot),
      whole: window.__bbox(g),
      /* NaN 사냥 — 좌표·배율에 하나라도 유한하지 않은 값이 있으면 여기서 잡힌다 */
      finite: g.children.every(c => Number.isFinite(c.position.x) && Number.isFinite(c.position.y)
                                 && Number.isFinite(c.position.z) && Number.isFinite(c.scale.x)),
      /* 포기가 실제로 판 안에 서 있나 — 판 bbox 안쪽 여부(위로는 자라도 된다) */
      bodyXZ: kids.map(c => [r5(c.position.x), r5(c.position.z)])
    };
  };
  /* 그루를 **완전히 새로** 짓게 한다. 같은 날이면 방뷰가 옮기기만 하기 때문이다
     (needsRebuild §②). 회귀를 재려면 매번 진짜로 지어야 한다. */
  window.__place = async (id, at, spec) => {
    await V.setPlantAt(id, null, null);
    await V.setPlantAt(id, at, spec);
    return window.__measure('free:' + id);
  };
  return true;
})()`;

const AT = { x: 0.5, y: 0.02, z: 0.5, onUid: null, occIdx: null };

/* ============================================================
   ① 회귀 기준값 — **무순을 붙이기 전에** 이 스크립트의 자로 실제로 잰 것이다.
     방 banjiha · 자유 좌표 (0.5, 0.02, 0.5) · 390×844 dpr2 · SwiftShader
     콩나물: potD 를 안 줄 때(한도 없음)와 0.18 로 조일 때
     몬스테라: 같은 씨앗(seed 7)으로 0·60·143·146·300일
     ★ 143 → 146 은 test_maturation 의 재현 G 가 지나는 안전선이다.
============================================================ */
const GOLD = {
  beansprout: {
    'p0|-':      { children: 5,  bodies: 4,  diameter: 0.24, pot: { w: 0.24, h: 0.109,   d: 0.24 } },
    'p0|0.18':   { children: 5,  bodies: 4,  diameter: 0.18, pot: { w: 0.18, h: 0.08175, d: 0.18 } },
    'p0.2|-':    { children: 6,  bodies: 5,  diameter: 0.24, pot: { w: 0.24, h: 0.109,   d: 0.24 } },
    'p0.2|0.18': { children: 6,  bodies: 5,  diameter: 0.18, pot: { w: 0.18, h: 0.08175, d: 0.18 } },
    'p0.34|-':   { children: 7,  bodies: 6,  diameter: 0.24, pot: { w: 0.24, h: 0.109,   d: 0.24 } },
    'p0.34|0.18':{ children: 7,  bodies: 6,  diameter: 0.18, pot: { w: 0.18, h: 0.08175, d: 0.18 } },
    'p0.5|-':    { children: 9,  bodies: 8,  diameter: 0.24, pot: { w: 0.24, h: 0.109,   d: 0.24 } },
    'p0.5|0.18': { children: 9,  bodies: 8,  diameter: 0.18, pot: { w: 0.18, h: 0.08175, d: 0.18 } },
    'p0.7|-':    { children: 10, bodies: 9,  diameter: 0.24, pot: { w: 0.24, h: 0.109,   d: 0.24 } },
    'p0.7|0.18': { children: 10, bodies: 9,  diameter: 0.18, pot: { w: 0.18, h: 0.08175, d: 0.18 } },
    'p1|-':      { children: 12, bodies: 11, diameter: 0.24, pot: { w: 0.24, h: 0.109,   d: 0.24 } },
    'p1|0.18':   { children: 12, bodies: 11, diameter: 0.18, pot: { w: 0.18, h: 0.08175, d: 0.18 } }
  },
  monstera: {
    'g0|-':      { children: 1, diameter: 0.20, pot: { w: 0.19811, h: 0.13321, d: 0.19743 }, wholeH: 0.13321 },
    'g0|0.14':   { children: 1, diameter: 0.14, pot: { w: 0.13868, h: 0.09324, d: 0.1382  }, wholeH: 0.09324 },
    'g60|-':     { children: 1, diameter: 0.20, pot: { w: 0.19811, h: 0.13321, d: 0.19743 }, wholeH: 0.37251 },
    'g60|0.14':  { children: 1, diameter: 0.14, pot: { w: 0.13868, h: 0.09324, d: 0.1382  }, wholeH: 0.26076 },
    'g143|-':    { children: 1, diameter: 0.20, pot: { w: 0.19811, h: 0.13321, d: 0.19743 }, wholeH: 0.51354 },
    'g143|0.14': { children: 1, diameter: 0.14, pot: { w: 0.13868, h: 0.09324, d: 0.1382  }, wholeH: 0.35947 },
    'g146|-':    { children: 1, diameter: 0.20, pot: { w: 0.19811, h: 0.13321, d: 0.19743 }, wholeH: 0.51862 },
    'g146|0.14': { children: 1, diameter: 0.14, pot: { w: 0.13868, h: 0.09324, d: 0.1382  }, wholeH: 0.36303 },
    'g300|-':    { children: 1, diameter: 0.20, pot: { w: 0.19811, h: 0.13321, d: 0.19743 }, wholeH: 0.6071  },
    'g300|0.14': { children: 1, diameter: 0.14, pot: { w: 0.13868, h: 0.09324, d: 0.1382  }, wholeH: 0.42497 }
  },
  /* 링·fitCheck 의 지름 삼항이 표로 바뀌었다. 두 종류의 답은 한 톨도 안 바뀌어야 한다 */
  ringsFit: { beansprout: 13, monstera: 14, none: 14 },   // 14칸 중 통과하는 칸 수
  fitDiameter: { beansprout: 0.24, monstera: 0.20 },
  /* ★★ 2026-08-05 — 무순 판을 **0.20m 로 세운다**(박사님 확정 ㉮ · room_view §MUSUN_D).
     GLB 원본대로 0.4327(대각선)로 세웠더니 반지하 14칸 중 받아 주는 곳이 책상 2칸뿐이었고,
     그 둘은 어두운 자리다. 무순은 밝아야 좋은 작물인데 제일 밝은 창턱(0.21m)에 못 올라갔다.
     0.20 은 격자(0.05m) **4칸 정확히**라 창턱에 들어간다 — 몬스테라 화분과 같은 값이다.
     ⇒ 이 표가 바뀐 것은 검사가 물러선 것이 아니라 **기획이 바뀐 것**이다. */
  trayD: 0.20,
  /* 판을 0.20 으로 줄이면 GLB 0.36×0.24 는 이 크기가 된다(배율 0.20/0.43267 = 0.46224) */
  trayWH: { w: +(0.36 * 0.20 / Math.hypot(0.36, 0.24)).toFixed(5),      // 0.16641
            d: +(0.24 * 0.20 / Math.hypot(0.36, 0.24)).toFixed(5) },    // 0.11094
  /* 칸 좌표도 같은 배율로 줄어든다 — 판 안에 있어야 하니 당연하다 */
  trayK: 0.20 / Math.hypot(0.36, 0.24)
};

const EPS = 1e-4;

async function main() {
  const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
  const errs = [];
  page.on((m, p) => {
    if (m === 'Runtime.exceptionThrown')
      errs.push(p.exceptionDetails.text + ' ' + ((p.exceptionDetails.exception || {}).description || ''));
  });

  await page.goto(URL_);
  await page.waitFor('!!window.view', 180000, 200);
  await page.waitFor('!!window.engine', 180000, 200);
  await page.eval(INSTALL);
  await sleep(500);

  /* ══ ① 회귀 — 콩나물 ═══════════════════════════════════════════════════ */
  const badB = [];
  for (const p01 of [0, 0.2, 0.34, 0.5, 0.7, 1]) {
    for (const potD of [null, 0.18]) {
      const key = `p${p01}|${potD ?? '-'}`;
      const spec = `{ kind:'beansprout', progress01: ${p01}${potD ? `, potD: ${potD}` : ''} }`;
      const m = await page.eval(`window.__place('regB', ${JSON.stringify(AT)}, ${spec})`);
      const g = GOLD.beansprout[key];
      const why = [];
      if (!m) why.push('그루가 없다');
      else {
        if (m.children !== g.children) why.push(`자식 ${m.children}≠${g.children}`);
        if (m.bodies !== g.bodies) why.push(`포기 ${m.bodies}≠${g.bodies}`);
        if (!near(m.diameter, g.diameter, EPS)) why.push(`지름 ${m.diameter}≠${g.diameter}`);
        for (const a of ['w', 'h', 'd'])
          if (!near(m.pot[a], g.pot[a], EPS)) why.push(`용기.${a} ${m.pot[a]}≠${g.pot[a]}`);
        if (!near(m.pos.x, AT.x, EPS) || !near(m.pos.y, AT.y, EPS) || !near(m.pos.z, AT.z, EPS))
          why.push(`자리 ${JSON.stringify(m.pos)}`);
      }
      if (why.length) badB.push(`${key}: ${why.join(' · ')}`);
    }
  }
  await page.eval(`window.view.setPlantAt('regB', null, null)`);
  ok('①-A 콩나물 12가지가 무순 넣기 전 값과 완전히 같다 (지름·용기bbox·포기 수·자리)',
     badB.length === 0, badB.slice(0, 4).join(' | '));

  /* ══ ① 회귀 — 몬스테라 ═════════════════════════════════════════════════ */
  const badM = [];
  for (const gd of [0, 60, 143, 146, 300]) {
    for (const potD of [null, 0.14]) {
      const key = `g${gd}|${potD ?? '-'}`;
      const spec = `{ kind:'monstera', growthDays: ${gd}, seed: 7, band:'good'${potD ? `, potD: ${potD}` : ''} }`;
      const m = await page.eval(`window.__place('regM', ${JSON.stringify(AT)}, ${spec})`);
      const g = GOLD.monstera[key];
      const why = [];
      if (!m) why.push('그루가 없다');
      else {
        if (m.children !== g.children) why.push(`자식 ${m.children}≠${g.children}`);
        if (!near(m.diameter, g.diameter, EPS)) why.push(`지름 ${m.diameter}≠${g.diameter}`);
        for (const a of ['w', 'h', 'd'])
          if (!near(m.pot[a], g.pot[a], EPS)) why.push(`화분.${a} ${m.pot[a]}≠${g.pot[a]}`);
        if (!near(m.whole.h, g.wholeH, EPS)) why.push(`그루 높이 ${m.whole.h}≠${g.wholeH}`);
        if (!near(m.pos.x, AT.x, EPS) || !near(m.pos.y, AT.y, EPS) || !near(m.pos.z, AT.z, EPS))
          why.push(`자리 ${JSON.stringify(m.pos)}`);
      }
      if (why.length) badM.push(`${key}: ${why.join(' · ')}`);
    }
  }
  await page.eval(`window.view.setPlantAt('regM', null, null)`);
  ok('①-B 몬스테라 10가지가 무순 넣기 전 값과 완전히 같다 (143→146 안전선 포함)',
     badM.length === 0, badM.slice(0, 4).join(' | '));

  /* ① 지름을 묻는 창구(showSlotRings · fitCheck)의 답이 그대로인가 */
  const ring = await page.eval(`(() => {
    const V = window.view, r = {};
    for (const [name, opt] of [['beansprout', { plantId: 'beansprout' }],
                               ['monstera',   { plantId: 'monstera' }],
                               ['none',       {}],
                               ['musun',      { plantId: 'musun' }]]) {
      V.showSlotRings(true, opt);
      const st = V.slotRings();
      r[name] = { total: st.length, fits: st.filter(x => x.fits).length };
    }
    V.showSlotRings(false);
    const s = V.slots()[0];
    r.fit = { beansprout: V.fitCheck(s.slotId, { kind: 'beansprout' }).diameter,
              monstera:   V.fitCheck(s.slotId, { kind: 'monstera' }).diameter,
              musun:      V.fitCheck(s.slotId, { kind: 'musun' }).diameter,
              unknown:    V.fitCheck(s.slotId, { kind: '없는것' }).diameter };
    r.table = V.plantPotD ? { monstera: V.plantPotD('monstera'), beansprout: V.plantPotD('beansprout'),
                              musun: V.plantPotD('musun'), unknown: V.plantPotD('없는것') } : null;
    return r;
  })()`);
  ok('①-C 추천 원의 통과 칸 수가 콩나물·몬스테라 모두 그대로다',
     ring.beansprout.fits === GOLD.ringsFit.beansprout &&
     ring.monstera.fits === GOLD.ringsFit.monstera &&
     ring.none.fits === GOLD.ringsFit.none,
     `콩나물 ${ring.beansprout.fits}/${GOLD.ringsFit.beansprout} · 몬스테라 ${ring.monstera.fits}/${GOLD.ringsFit.monstera} · 지정없음 ${ring.none.fits}/${GOLD.ringsFit.none}`);
  ok('①-D fitCheck 이 종류로 내는 지름이 그대로다 (모르는 이름은 예전처럼 0.20)',
     near(ring.fit.beansprout, GOLD.fitDiameter.beansprout, EPS) &&
     near(ring.fit.monstera, GOLD.fitDiameter.monstera, EPS) &&
     near(ring.fit.unknown, GOLD.fitDiameter.monstera, EPS),
     JSON.stringify(ring.fit));
  ok('①-E 종류표가 창구로 나온다 — 무순 지름은 0.20 (격자 4칸 · §trayD)',
     ring.table && near(ring.table.musun, GOLD.trayD, 1e-4) &&
     near(ring.table.beansprout, 0.24, EPS) && near(ring.table.monstera, 0.20, EPS) &&
     near(ring.table.unknown, 0.20, EPS),
     JSON.stringify(ring.table) + ` · 재배판 ${GOLD.trayD}`);
  ok('①-F 무순은 fitCheck 에도 같은 지름으로 잡힌다',
     near(ring.fit.musun, GOLD.trayD, 1e-4), `${ring.fit.musun} vs ${GOLD.trayD}`);

  /* ══ ② 무순이 실제로 선다 ═════════════════════════════════════════════ */
  const free = await page.eval(`window.__place('musunFree', ${JSON.stringify(AT)},
                                { kind:'musun', progress01: 0.5 })`);
  ok('②-A setPlantAt(자유 좌표, kind:musun) 이 던지지 않고 그루를 세운다',
     !!free && free.kind === 'musun', JSON.stringify(free && { kind: free.kind, bodies: free.bodies }));
  ok('②-B 그 좌표에 실제로 선다',
     free && near(free.pos.x, AT.x, EPS) && near(free.pos.y, AT.y, EPS) && near(free.pos.z, AT.z, EPS),
     free && JSON.stringify(free.pos));
  ok('②-C 한도를 안 주면 재배판이 0.20 으로 선다 — 두 번 줄지 않는다',
     free && near(free.diameter, GOLD.trayD, 1e-3) &&
     near(free.pot.w, GOLD.trayWH.w, 5e-3) && near(free.pot.d, GOLD.trayWH.d, 5e-3),
     free && `지름 ${free.diameter} · 판 ${free.pot.w}×${free.pot.d}×h${free.pot.h}`);

  /* 칸 좌표가 manifest 격자 그대로인가 — 원형으로 흩뿌리면 여기서 걸린다 */
  const full = await page.eval(`window.__place('musunFree', ${JSON.stringify(AT)},
                                { kind:'musun', progress01: 1 })`);
  /* ★ 칸 좌표는 판 좌표계 값에 **판 배율**을 곱한 것이다. 판을 줄였으니 칸도 같이 줄어든다 —
     안 줄면 포기가 판 밖에 선다. 격자 모양(4열×3행)이 그대로인지가 이 검사의 뜻이다. */
  const K = GOLD.trayK;
  const XS = [-0.108, -0.036, 0.036, 0.108].map(v => v * K),
        ZS = [-0.06, 0, 0.06].map(v => v * K);
  const gridBad = (full ? full.bodyXZ : []).filter(([x, z]) =>
    !XS.some(v => near(x, v, 1e-3)) || !ZS.some(v => near(z, v, 1e-3)));
  ok('②-D 다 자라면 manifest 슬롯 12칸(4열×3행)에 정확히 선다 (원형 흩뿌리기가 아니다)',
     full && full.bodies === 12 && gridBad.length === 0 &&
     new Set(full.bodyXZ.map(p => p.join(','))).size === 12,
     full && `포기 ${full.bodies} · 격자 밖 ${JSON.stringify(gridBad.slice(0, 3))}`);

  /* ★ 밑동이 흙 윗면에 앉나 — 재배판 GLB 안에는 `soil` 이라는 상자가 있고
     그 윗면이 **정확히 y=0.026**, 곧 manifest 슬롯 y 와 같은 값이다(재서 확인했다).
     여기가 어긋나면 무순이 흙 위에 뜨거나 흙에 박힌다 — 화면으로는 잘 안 보이는 종류다. */
  const soil = await page.eval(`(() => {
    const T = window.THREE;
    const g = window.__grp('free:musunFree');
    if (!g) return null;
    g.updateWorldMatrix(true, true);
    const inv = new T.Matrix4().copy(g.matrixWorld).invert();
    const m = new T.Matrix4(), v = new T.Vector3();
    let soilTop = null;
    g.children[0].traverse(o => {
      if (!o.isMesh || o.name !== 'soil') return;
      m.multiplyMatrices(inv, o.matrixWorld);
      const p = o.geometry.attributes.position;
      let mx = -1e9;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); mx = Math.max(mx, v.y); }
      soilTop = +mx.toFixed(5);
    });
    const bases = g.children.slice(1).map(c => +c.position.y.toFixed(5));
    return { soilTop, base: bases[0], allSame: new Set(bases).size === 1 };
  })()`);
  ok('②-G 포기 밑동이 판의 흙 윗면에 정확히 앉는다 (뜨지도 박히지도 않는다)',
     soil && soil.allSame && near(soil.base, soil.soilTop, 1e-4),
     JSON.stringify(soil));

  /* 좁은 자리에 놓으면 판이 그 한도까지 줄어든다(걸쳐 두지 않는다) */
  /* ★ 한도는 판(0.20)보다 **좁아야** 뜻이 있다. 예전엔 0.24 를 줬는데 그때는 판이 0.4327 이라
     좁은 한도였다. 이제 0.24 는 판보다 넓어서 안 줄어드는 것이 맞다 —
     한도가 넓다고 판을 키우면 "선반이 크면 판도 커진다"가 되어 규칙이 거꾸로 선다.
     그래서 선반(0.25) 대신 **창턱보다도 좁은 0.15** 로 잰다. */
  const tight = await page.eval(`window.__place('musunFree', ${JSON.stringify(AT)},
                                 { kind:'musun', progress01: 1, potD: 0.15 })`);
  ok('②-E 판보다 좁은 한도(0.15)를 주면 판이 그 한도로 줄어든다 (밖으로 안 걸친다)',
     tight && near(tight.diameter, 0.15, 1e-3) && tight.bodies === 12,
     tight && `지름 ${tight.diameter} · 판 ${tight.pot.w}×${tight.pot.d}`);
  /* 넓은 한도로는 안 커진다 — 위 규칙의 반대쪽 */
  const wide = await page.eval(`window.__place('musunFree', ${JSON.stringify(AT)},
                                 { kind:'musun', progress01: 1, potD: 0.50 })`);
  ok('②-E2 판보다 넓은 한도(0.50)를 줘도 판은 0.20 그대로다 (자리가 넓다고 안 커진다)',
     wide && near(wide.diameter, 0.20, 1e-3),
     wide && `지름 ${wide.diameter}`);

  /* 추천 자리에도 선다 — setPlant 쪽 길 */
  const slotPlace = await page.eval(`(async () => {
    const V = window.view;
    const s = V.slots().reduce((a, b) => (b.maxPotD || 0) > (a.maxPotD || 0) ? b : a);
    await V.setPlant(s.slotId, { kind:'musun', progress01: 0.8 });
    const m = window.__measure(s.slotId);
    return { slotId: s.slotId, maxPotD: s.maxPotD, m, pos: s.pos };
  })()`);
  ok('②-F setPlant(추천 자리, kind:musun) 도 던지지 않고 그 자리에 선다',
     slotPlace.m && slotPlace.m.kind === 'musun' &&
     near(slotPlace.m.pos.x, slotPlace.pos.x, 1e-3) && near(slotPlace.m.pos.z, slotPlace.pos.z, 1e-3),
     `${slotPlace.slotId}(한도 ${slotPlace.maxPotD}) → ${JSON.stringify(slotPlace.m && slotPlace.m.pos)}`);

  /* ══ ③ 포기 수가 단조 증가하고 NaN 이 없다 ════════════════════════════ */
  const steps = [];
  for (let i = 0; i <= 10; i++) {
    const p01 = i / 10;
    const m = await page.eval(`window.__place('musunRamp', ${JSON.stringify(AT)},
                               { kind:'musun', progress01: ${p01} })`);
    steps.push({ p01, bodies: m && m.bodies, finite: m && m.finite, dia: m && m.diameter });
  }
  const mono = steps.every((s, i) => i === 0 || s.bodies >= steps[i - 1].bodies);
  ok('③-A progress01 0 → 1 에서 포기 수가 한 번도 줄지 않는다',
     mono, steps.map(s => `${s.p01}:${s.bodies}`).join(' '));
  ok('③-B 0 에서도 비어 있지 않고, 1 에서 12칸이 다 찬다 (실제로 늘어난다)',
     steps[0].bodies >= 1 && steps[10].bodies === 12 && steps[10].bodies > steps[0].bodies,
     `${steps[0].bodies} → ${steps[10].bodies}`);
  ok('③-C 좌표·배율에 NaN 이 없다',
     steps.every(s => s.finite === true && Number.isFinite(s.dia)),
     JSON.stringify(steps.filter(s => !s.finite)));

  /* ★ progress01 을 안 주거나 망가진 값을 줘도 **빈 판이 안 나온다**.
     콩나물에서 실제로 났던 사고(lerp(4,11,undefined) → NaN → 0포기)의 재발 방지다. */
  const junk2 = await page.eval(`(async () => {
    const out = {};
    const cases = { 'undefined': undefined, 'null': null, 'NaN': NaN, '문자열': '0.5', '범위밖': 5 };
    for (const k of Object.keys(cases)) {
      const m = await window.__place('musunJunk', ${JSON.stringify(AT)},
                                     { kind:'musun', progress01: cases[k] });
      out[k] = m ? { bodies: m.bodies, finite: m.finite } : null;
    }
    return out;
  })()`);
  ok('③-D progress01 이 없거나 NaN·문자열이어도 빈 판이 안 나온다 (옛 0포기 사고)',
     Object.values(junk2).every(v => v && v.bodies >= 1 && v.finite === true),
     JSON.stringify(junk2));
  await page.eval(`window.view.setPlantAt('musunJunk', null, null)`);
  await page.eval(`window.view.setPlantAt('musunRamp', null, null)`);

  /* ══ ④ 조도 계약이 안 바뀐다 ══════════════════════════════════════════
     container_tray_s 는 blocks_light:false 다. 방뷰는 화분을 가림막으로 넣지 않으므로
     (조도는 light_adapter 한 벌이 낸다) 재배판을 놓아도 그 자리 DLI 가 그대로여야 한다.
     그 '안 바뀜'을 숫자로 못 박는다 — 나중에 누가 화분을 가림막에 넣으면 여기서 걸린다. */
  const light = await page.eval(`(async () => {
    const V = window.view, E = window.engine;
    const pts = [{ x:${AT.x}, y:${AT.y}, z:${AT.z} },
                 ...V.slots().map(s => ({ x:s.pos.x, y:s.pos.y, z:s.pos.z, id:s.slotId }))];
    const read = () => pts.map(p => E.dliAt({ x:p.x, y:p.y, z:p.z }).dli);
    await V.setPlantAt('lightTray', null, null);
    const before = read();
    await V.setPlantAt('lightTray', ${JSON.stringify(AT)}, { kind:'musun', progress01: 1 });
    const after = read();
    await V.setPlantAt('lightTray', null, null);
    return { ids: pts.map(p => p.id || '자유좌표'), before, after };
  })()`);
  const dliBad = light.ids.filter((id, i) => !near(light.before[i], light.after[i], 1e-9));
  ok('④ 재배판을 놓아도 그 자리·모든 추천 자리의 DLI 가 한 톨도 안 바뀐다 (blocks_light:false)',
     dliBad.length === 0 && light.before.length >= 15,
     `${light.before.length}점 · 바뀐 것 ${JSON.stringify(dliBad.slice(0, 3))} · 자유좌표 ${light.before[0]}`);

  /* ══ 스크린샷 — 재배판에 무순이 실제로 서 있는 것이 보여야 한다 ═══════ */
  if (SHOTS) {
    const shot = await page.eval(`(async () => {
      const V = window.view;
      const s = V.slots().reduce((a, b) => (b.maxPotD || 0) > (a.maxPotD || 0) ? b : a);
      await V.setPlant(s.slotId, null);
      V.focusSlot(s.slotId, true);
      return s.slotId;
    })()`);
    /* ★ 카메라는 **자리가 빈 채로** 한 번만 잡는다. 화분을 놓고 다시 focusSlot 하면
       그루 bbox(재배판은 13cm 밖에 안 된다)에 맞춰 0.5m 까지 코를 박아서
       판 가장자리가 화면 밖으로 잘린다 — 세 장의 거리도 서로 달라져 비교가 안 된다. */
    for (const [name, p01] of [['empty', 0], ['half', 0.5], ['full', 1]]) {
      await page.eval(`(async () => {
        await window.view.setPlant(${JSON.stringify(shot)}, null);
        await window.view.setPlant(${JSON.stringify(shot)}, { kind:'musun', progress01: ${p01} });
        window.view.redraw();
        return 1;
      })()`);
      await sleep(3500);
      await page.eval(`window.view.redraw()`);
      await page.shot(`${SHOT_DIR}musun_${name}.png`);
    }
    const made = ['empty', 'half', 'full'].filter(n => {
      try { return fs.statSync(`${SHOT_DIR}musun_${n}.png`).size > 10000; } catch { return false; }
    });
    ok('스크린샷 3장을 docs/engine/shots 에 남겼다', made.length === 3, made.join(', '));
  }

  /* ══ ⑤ 처리 안 된 예외 ════════════════════════════════════════════════ */
  ok('⑤ 콘솔에 처리 안 된 예외가 없다', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log(`\nmusun_view: ${fail === 0 ? 'PASS' : 'FAIL'}  (${pass}/${pass + fail})`);
  await page.close();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
