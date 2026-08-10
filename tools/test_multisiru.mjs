/* ============================================================
   tools/test_multisiru.mjs — 시루를 여러 개 사면 방에 여러 개 선다
   ------------------------------------------------------------
   test_musun_view.mjs 와 같은 방식이다: 진짜 브라우저(헤드리스 크롬)에서
   tools/room_view_demo.html 을 띄우고 계약을 하나씩 눌러 본다.
   3D 는 node:vm 으로 못 돌린다 — WebGL 이 필요하고, 지름은 정점을 훑어야 나온다.

     python tools/serve.py 8979
     BYEOT_URL=http://localhost:8979 node tools/test_multisiru.mjs

   ★ 무엇을 고쳤길래 이 검사가 생겼나
     작물 자리(site)는 좌표가 **하나**고 그 위에서 시루 N개가 돈다(first_play §pots[]).
     그런데 방뷰는 그 좌표에 그루를 **하나만** 세웠다 — 시루를 12개 심어도 방에는 1개다.
     플레이어는 7,000원짜리 시루를 열두 번 사고 화면에서는 아무것도 못 본다.

   ★ 여기서 보는 것
     ① `count` 를 주면 **실제로 그 수만큼 선다** — 상태를 되읽지 않고 **장면을 센다**
     ② **회귀** — count 를 안 주거나 1 이면 지금과 **완전히 같다**.
        아래 GOLD 표는 test_musun_view.mjs §GOLD 와 같은 값이다(같은 방·같은 자리·같은 자).
        콩나물뿐 아니라 몬스테라·무순도 한 톨도 안 바뀌어야 한다
     ③ 폭 — n 개를 제 크기로 세울 때 무리가 먹는 회전무관 지름. 표로 낸다
     ④ **조도가 안 바뀐다** — 시루 12개를 세운 뒤 그 자리와 모든 추천 자리의 DLI 가 그대로다
        (시루는 blocks_light:true 지만 방뷰는 화분을 가림막으로 안 넣는다. 그 '안 함'이 계약이다)
     ⑤ **안 삐져나온다** — 자리 한도가 있는 곳에서는 무리가 그 한도를 절대 안 넘는다
     ⑥ 12개가 안 들어가는 자리 목록(들어가는 최대 개수와 함께)
     ⑦ 콘솔에 처리 안 된 예외 0건

   ⚠ 서버가 먼저 떠 있어야 한다. 떠도는 서버가 포트를 먼저 잡으면 **낡은 코드를 잰다** —
     BYEOT_URL 로 **자기 서버**를 가리켜라. 창이 여럿이면 기본 포트는 남의 것이다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BYEOT_URL || 'http://localhost:8979';
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
   test_musun_view.mjs 의 자와 **같은 규칙**이다. 다른 것 하나 —
   `containers` 는 장면에 실제로 선 용기 수를 **세어서** 낸다.
   상태(spec.count)를 되읽으면 "12를 넣었으니 12"가 되어 아무것도 안 재는 검사가 된다. */
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
    /* ★ 장면을 센다 — 시루 하나마다 containerIndex 가 찍혀 있다 */
    const seen = new Set();
    g.traverse(o => { if (o.userData && Number.isInteger(o.userData.containerIndex))
                        seen.add(o.userData.containerIndex); });
    return {
      kind: g.userData.kind || null,
      pos: { x: r5(g.position.x), y: r5(g.position.y), z: r5(g.position.z) },
      children: g.children.length,
      bodies: kids.length,
      containers: seen.size,
      diameter: r5(V.plantDiameter(key) ?? -1),
      pot: window.__bbox(pot),
      whole: window.__bbox(g),
      finite: g.children.every(c => Number.isFinite(c.position.x) && Number.isFinite(c.position.y)
                                 && Number.isFinite(c.position.z) && Number.isFinite(c.scale.x)),
      /* 시루끼리 겹치나 — 이웃한 두 시루의 중심 거리와 시루 한 개의 지름을 잰다 */
      potXZ: pot.children ? pot.children.map(c => [r5(c.position.x), r5(c.position.z)]) : []
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
   GOLD — **무리 짓기를 붙이기 전에** 잰 값이다.
     콩나물 12줄·몬스테라 10줄은 tools/test_musun_view.mjs §GOLD 와 **같은 표**다.
     같은 방(banjiha) · 같은 자유 좌표 (0.5, 0.02, 0.5) · 390×844 dpr2 · SwiftShader.
   ★ 두 파일이 같은 표를 들고 있는 것은 중복이 아니다 — 이 검사는 "무리 짓기가
     한 개짜리를 안 건드렸나"를 보고, 저 검사는 "무순이 안 건드렸나"를 본다.
     한쪽이 물러서면 다른 쪽에서 걸려야 한다.
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
  /* ★★ 2026-08-09 — **몬스테라 그루 높이 여덟 줄이 움직였다.** 회귀가 아니라 확정이다.
     박사님이 잎 간격을 표로 정하셨고(`data/growth_tuning.json · leaf_interval.days`
     = 30·40·50·70·100·150·200·300), 시간 축이 그 표를 따르게 바뀌었다(plant_grow.html §ageOf).
     ⇒ **같은 유효 생장일이 다른 「생장 나이」가 된다.** 높이는 나이의 함수라 같이 움직였다.

       유효일   생장나이 옛 → 새    높이 옛 → 새
         0        0 → 0            0.13321 그대로 (씨앗 — 화분만 있다)
        60      135 → 111          0.37251 → 0.32667  (−12% · 어려졌다)
       143      253 → 295          0.51354 → 0.54442  (+6%  · 늙었다)
       146      257 → 301          0.51862 → 0.54746  (+6%)
       300      431 → 504          0.60710 → 0.69423  (+14%)

     ⚠ 화분·지름·자식 수는 **한 톨도 안 움직였다** — 바뀐 것은 시간 축뿐이라는 증거다.
     ⚠ 이 표가 또 움직이면 먼저 leaf_interval 을 봐라. 표를 안 고쳤는데 움직였으면 그때가 회귀다. */
  monstera: {
    'g0|-':      { children: 1, diameter: 0.20, pot: { w: 0.19811, h: 0.13321, d: 0.19743 }, wholeH: 0.13321 },
    'g0|0.14':   { children: 1, diameter: 0.14, pot: { w: 0.13868, h: 0.09324, d: 0.1382  }, wholeH: 0.09324 },
    'g60|-':     { children: 1, diameter: 0.20, pot: { w: 0.19811, h: 0.13321, d: 0.19743 }, wholeH: 0.32667 },
    'g60|0.14':  { children: 1, diameter: 0.14, pot: { w: 0.13868, h: 0.09324, d: 0.1382  }, wholeH: 0.22867 },
    'g143|-':    { children: 1, diameter: 0.20, pot: { w: 0.19811, h: 0.13321, d: 0.19743 }, wholeH: 0.54442 },
    'g143|0.14': { children: 1, diameter: 0.14, pot: { w: 0.13868, h: 0.09324, d: 0.1382  }, wholeH: 0.38109 },
    'g146|-':    { children: 1, diameter: 0.20, pot: { w: 0.19811, h: 0.13321, d: 0.19743 }, wholeH: 0.54746 },
    'g146|0.14': { children: 1, diameter: 0.14, pot: { w: 0.13868, h: 0.09324, d: 0.1382  }, wholeH: 0.38322 },
    'g300|-':    { children: 1, diameter: 0.20, pot: { w: 0.19811, h: 0.13321, d: 0.19743 }, wholeH: 0.69423 },
    'g300|0.14': { children: 1, diameter: 0.14, pot: { w: 0.13868, h: 0.09324, d: 0.1382  }, wholeH: 0.48596 }
  },
  /* 무순 재배판 — 시루와 한 파일에 살아서 같이 깨질 수 있다. 같이 못 박는다 */
  musunD: 0.20,
  musunWH: { w: +(0.36 * 0.20 / Math.hypot(0.36, 0.24)).toFixed(5),
             d: +(0.24 * 0.20 / Math.hypot(0.36, 0.24)).toFixed(5) },
  /* 링·fitCheck 의 답 — 14칸 중 통과하는 칸 수 */
  ringsFit: { beansprout: 13, monstera: 14, none: 14 },
  fitDiameter: { beansprout: 0.24, monstera: 0.20 },

  /* ★ 무리의 폭 — **육각 격자 자리표에서 나오는 값**이다(room_view §clusterUnit).
     공식은 span = 2·r + 1 (시루 지름 1 기준) 이고 r 은 고른 n점의 외접원 반지름이다.
     여기 적은 숫자는 지어낸 것이 아니라 그 공식으로 나온 값을 **소수 셋째까지 굳힌 것**이다 —
     굳혀 두지 않으면 자리표를 누가 흔들어도 검사가 안 걸린다. */
  clusterD: { 1: 0.240, 2: 0.480, 3: 0.517, 4: 0.656, 6: 0.720, 8: 0.875, 12: 0.973 }
};

const EPS = 1e-4;
const SIRU_D = 0.24;

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

  /* ══ ① 12개가 실제로 선다 ══════════════════════════════════════════════ */
  const twelve = await page.eval(`window.__place('multi12', ${JSON.stringify(AT)},
    { kind:'beansprout', progress01: 1, count: 12,
      potD: window.view.plantPotD('beansprout', 12) })`);
  ok('① count:12 를 주면 시루가 방에 **12개** 선다 (장면을 세어 본 값)',
     !!twelve && twelve.containers === 12,
     twelve ? `센 개수 ${twelve.containers}` : '그루가 없다');
  ok('①-B 시루 12개가 서 있는데도 좌표·유한성이 멀쩡하다',
     !!twelve && twelve.finite === true
     && near(twelve.pos.x, AT.x, EPS) && near(twelve.pos.z, AT.z, EPS),
     JSON.stringify(twelve && twelve.pos));

  /* 시루끼리 안 겹치나 — 중심 거리가 시루 한 개 지름보다 짧으면 겹친 것이다 */
  const gap = (() => {
    if (!twelve || twelve.potXZ.length < 2) return null;
    let min = Infinity;
    for (let i = 0; i < twelve.potXZ.length; i++)
      for (let j = i + 1; j < twelve.potXZ.length; j++)
        min = Math.min(min, Math.hypot(twelve.potXZ[i][0] - twelve.potXZ[j][0],
                                       twelve.potXZ[i][1] - twelve.potXZ[j][1]));
    return min;
  })();
  ok('①-C 시루 12개가 서로 안 겹친다 (제일 가까운 두 중심 거리 ≥ 시루 지름)',
     gap != null && gap >= SIRU_D - 1e-3, `제일 가까운 거리 ${gap}`);

  /* 한 개일 때와 **모양이 같나** — 12개는 한 개의 되풀이여야 한다 */
  const one = await page.eval(`window.__place('multi1', ${JSON.stringify(AT)},
    { kind:'beansprout', progress01: 1, count: 1 })`);
  ok('①-D 포기 수가 시루 수만큼 늘어난다 (한 시루당 같은 수)',
     !!one && !!twelve && one.bodies * 12 === twelve.bodies,
     `1개 ${one && one.bodies}포기 · 12개 ${twelve && twelve.bodies}포기`);
  await page.eval(`window.view.setPlantAt('multi12', null, null)`);
  await page.eval(`window.view.setPlantAt('multi1', null, null)`);

  /* ══ ②-A 회귀 — 콩나물. count 를 **안 주면** 예전 값 그대로 ═════════════ */
  const badB = [], badB1 = [];
  for (const p01 of [0, 0.2, 0.34, 0.5, 0.7, 1]) {
    for (const potD of [null, 0.18]) {
      const key = `p${p01}|${potD ?? '-'}`;
      const g = GOLD.beansprout[key];
      const base = `kind:'beansprout', progress01: ${p01}${potD ? `, potD: ${potD}` : ''}`;
      for (const [tag, spec, bag] of [['없음', `{ ${base} }`, badB],
                                      ['1', `{ ${base}, count: 1 }`, badB1]]) {
        const m = await page.eval(`window.__place('regB', ${JSON.stringify(AT)}, ${spec})`);
        const why = [];
        if (!m) why.push('그루가 없다');
        else {
          if (m.children !== g.children) why.push(`자식 ${m.children}≠${g.children}`);
          if (m.bodies !== g.bodies) why.push(`포기 ${m.bodies}≠${g.bodies}`);
          if (m.containers !== 1) why.push(`시루 ${m.containers}≠1`);
          if (!near(m.diameter, g.diameter, EPS)) why.push(`지름 ${m.diameter}≠${g.diameter}`);
          for (const a of ['w', 'h', 'd'])
            if (!near(m.pot[a], g.pot[a], EPS)) why.push(`용기.${a} ${m.pot[a]}≠${g.pot[a]}`);
          if (!near(m.pos.x, AT.x, EPS) || !near(m.pos.y, AT.y, EPS) || !near(m.pos.z, AT.z, EPS))
            why.push(`자리 ${JSON.stringify(m.pos)}`);
        }
        if (why.length) bag.push(`${key}(count ${tag}): ${why.join(' · ')}`);
      }
    }
  }
  await page.eval(`window.view.setPlantAt('regB', null, null)`);
  ok('②-A count 를 **안 주면** 콩나물 12가지가 예전 값과 완전히 같다',
     badB.length === 0, badB.slice(0, 4).join(' | '));
  ok('②-B count:1 도 **한 톨도 안 다르다** (안 준 것과 같은 값)',
     badB1.length === 0, badB1.slice(0, 4).join(' | '));

  /* ══ ②-C 회귀 — 몬스테라 ═══════════════════════════════════════════════ */
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
      }
      if (why.length) badM.push(`${key}: ${why.join(' · ')}`);
    }
  }
  await page.eval(`window.view.setPlantAt('regM', null, null)`);
  ok('②-C 몬스테라 10가지가 예전 값과 완전히 같다 (143→146 안전선 포함)',
     badM.length === 0, badM.slice(0, 4).join(' | '));

  /* ②-D 몬스테라·무순에 count 를 줘도 **안 늘어난다** — 안 지을 것의 자리를 안 잡는다 */
  const noCluster = await page.eval(`(async () => {
    const V = window.view;
    const m = await window.__place('noCl', ${JSON.stringify(AT)},
      { kind:'monstera', growthDays: 143, seed: 7, band:'good', count: 12 });
    const s = await window.__place('noCl2', ${JSON.stringify(AT)},
      { kind:'musun', progress01: 1, count: 12 });
    const out = { monD: m && m.diameter, musunD: s && s.diameter,
                  monAsk: V.plantPotD('monstera', 12), musunAsk: V.plantPotD('musun', 12),
                  musunW: s && s.pot.w, musunDep: s && s.pot.d };
    await V.setPlantAt('noCl', null, null);
    await V.setPlantAt('noCl2', null, null);
    return out;
  })()`);
  ok('②-D 몬스테라·무순은 count 를 줘도 안 늘어난다 (무리를 못 짓는 종류)',
     near(noCluster.monD, 0.20, EPS) && near(noCluster.monAsk, 0.20, EPS)
     && near(noCluster.musunD, GOLD.musunD, EPS) && near(noCluster.musunAsk, GOLD.musunD, EPS)
     && near(noCluster.musunW, GOLD.musunWH.w, EPS) && near(noCluster.musunDep, GOLD.musunWH.d, EPS),
     JSON.stringify(noCluster));

  /* ②-E 지름을 묻는 창구(showSlotRings · fitCheck · plantPotD)의 답이 그대로인가 */
  const ring = await page.eval(`(() => {
    const V = window.view, r = {};
    for (const [name, opt] of [['beansprout', { plantId: 'beansprout' }],
                               ['monstera',   { plantId: 'monstera' }],
                               ['none',       {}]]) {
      V.showSlotRings(true, opt);
      r[name] = V.slotRings().filter(x => x.fits).length;
    }
    V.showSlotRings(false);
    const s = V.slots()[0];
    r.fit = { beansprout: V.fitCheck(s.slotId, { kind: 'beansprout' }).diameter,
              monstera:   V.fitCheck(s.slotId, { kind: 'monstera' }).diameter };
    r.table = { beansprout: V.plantPotD('beansprout'), monstera: V.plantPotD('monstera'),
                unknown: V.plantPotD('없는것') };
    return r;
  })()`);
  ok('②-E 추천 원 통과 칸 수·fitCheck·plantPotD 의 답이 그대로다 (count 를 안 줬을 때)',
     ring.beansprout === GOLD.ringsFit.beansprout && ring.monstera === GOLD.ringsFit.monstera
     && ring.none === GOLD.ringsFit.none
     && near(ring.fit.beansprout, GOLD.fitDiameter.beansprout, EPS)
     && near(ring.fit.monstera, GOLD.fitDiameter.monstera, EPS)
     && near(ring.table.beansprout, 0.24, EPS) && near(ring.table.monstera, 0.20, EPS)
     && near(ring.table.unknown, 0.20, EPS),
     JSON.stringify(ring));

  /* ══ ③ 폭 — n 개를 제 크기로 세울 때 무리가 먹는 지름 ═══════════════════ */
  const spans = await page.eval(`(async () => {
    const V = window.view, out = {};
    for (const n of [1, 2, 3, 4, 6, 8, 12]) {
      const d = V.plantPotD('beansprout', n);
      const m = await window.__place('span', ${JSON.stringify(AT)},
        { kind:'beansprout', progress01: 1, count: n, potD: d });
      out[n] = { ask: +d.toFixed(5), got: m && m.diameter, cnt: m && m.containers };
    }
    await V.setPlantAt('span', null, null);
    return out;
  })()`);
  /* ★ 묻은 값과 잰 값이 **소수점까지 같지는 않다** — 그리고 그래야 맞다.
     시루는 저폴리 원통이라 바깥쪽 꼭짓점이 무리의 중심 방향과 딱 맞아떨어지지 않는다.
     그래서 잰 값은 묻은 값보다 **조금 작다**(재 보니 제일 큰 차이가 n=8 의 0.6mm).
     계약은 "같다"가 아니라 **"약속한 지름을 절대 안 넘는다"** 여야 한다 —
     넘으면 창턱 사고가 나고, 조금 모자란 것은 자리가 남는 것뿐이다.
     ⚠ 반대로 너무 많이 모자라면 자리를 헛되이 잡는 것이므로 2mm 로 위아래를 묶는다. */
  const SLACK = 0.002;
  const spanBad = Object.keys(GOLD.clusterD).filter(n =>
    !near(spans[n].ask, GOLD.clusterD[n], 5e-4)
    || !(spans[n].got <= spans[n].ask + 1e-4 && spans[n].got >= spans[n].ask - SLACK)
    || spans[n].cnt !== +n);
  console.log('\n  시루 수 → 무리 지름[m]  (묻은 값 / 실제 잰 값 / 센 시루)');
  for (const n of Object.keys(spans))
    console.log(`    ${String(n).padStart(2)}개  ${spans[n].ask.toFixed(3)} / ${spans[n].got.toFixed(3)} / ${spans[n].cnt}`);
  ok('③ plantPotD(kind,n) 이 **약속한 지름을 무리가 절대 안 넘는다** (모자람은 2mm 안)',
     spanBad.length === 0, spanBad.map(n => `${n}개 ${JSON.stringify(spans[n])}`).join(' | '));

  /* ══ ④ 조도가 안 바뀐다 ════════════════════════════════════════════════
     시루는 blocks_light:true 다. 그런데 방뷰는 **화분을 가림막으로 안 넣는다** —
     조도는 light_adapter 한 벌이 낸다. 그 '안 함'이 계약이라 여기서 숫자로 못 박는다.
     12개로 넓어진 무리가 가림막이 되면 바로 여기서 걸린다. */
  const light = await page.eval(`(async () => {
    const V = window.view, E = window.engine;
    const pts = [{ x:${AT.x}, y:${AT.y}, z:${AT.z} },
                 ...V.slots().map(s => ({ x:s.pos.x, y:s.pos.y, z:s.pos.z, id:s.slotId }))];
    const read = () => pts.map(p => E.dliAt({ x:p.x, y:p.y, z:p.z }).dli);
    await V.setPlantAt('lightSiru', null, null);
    const before = read();
    await V.setPlantAt('lightSiru', ${JSON.stringify(AT)},
      { kind:'beansprout', progress01: 1, count: 12, potD: V.plantPotD('beansprout', 12) });
    const after = read();
    await V.setPlantAt('lightSiru', null, null);
    const back = read();
    return { ids: pts.map(p => p.id || '자유좌표'), before, after, back };
  })()`);
  const dliBad = light.ids.filter((id, i) => !near(light.before[i], light.after[i], 1e-9)
                                          || !near(light.before[i], light.back[i], 1e-9));
  ok('④ 시루를 12개 세워도 그 자리·모든 추천 자리의 DLI 가 한 톨도 안 바뀐다',
     dliBad.length === 0 && light.before.length >= 15,
     `${light.before.length}점 · 바뀐 것 ${JSON.stringify(dliBad.slice(0, 3))} · 자유좌표 ${light.before[0]}`);

  /* ══ ⑤ 안 삐져나온다 — 자리 한도가 있는 곳에서는 그 한도를 절대 안 넘는다 ══ */
  const clamped = await page.eval(`(async () => {
    const V = window.view, out = [];
    for (const s of V.slots()) {
      if (!Number.isFinite(s.maxPotD)) continue;
      await V.setPlant(s.slotId, null);
      await V.setPlant(s.slotId, { kind:'beansprout', progress01: 1, count: 12 });
      const m = window.__measure(s.slotId);
      out.push({ id: s.slotId, max: s.maxPotD, got: m && m.diameter, cnt: m && m.containers });
      await V.setPlant(s.slotId, null);
    }
    return out;
  })()`);
  const over = clamped.filter(r => !(r.got <= r.max + 1e-3));
  const lostCount = clamped.filter(r => r.cnt !== 12);
  /* 줄어들면 시루 한 개는 얼마가 되나 — 무리 지름 : 시루 지름 = 0.973 : 0.24 다 */
  console.log('\n  좁은 자리에 12개를 놓으면 — 자리 한도 / 무리 지름 / 시루 한 개[m]');
  for (const r of clamped)
    console.log(`    ${r.id.padEnd(18)} ${r.max.toFixed(2)} / ${r.got.toFixed(3)} / ${(r.got / GOLD.clusterD[12] * SIRU_D).toFixed(3)}`);
  ok('⑤ 한도가 있는 자리에 12개를 놓아도 무리가 그 한도를 **안 넘는다**',
     over.length === 0 && clamped.length > 0,
     `${clamped.length}칸 중 넘친 것 ${JSON.stringify(over.slice(0, 3))}`);
  ok('⑤-B 좁아서 줄어들어도 시루 **개수는 안 준다** (12개는 12개다)',
     lostCount.length === 0, JSON.stringify(lostCount.slice(0, 3)));

  /* ══ ⑥ 12개가 제 크기로는 안 들어가는 자리 목록 ═════════════════════════ */
  const fitTable = await page.eval(`(() => {
    const V = window.view, rows = [];
    for (const s of V.slots()) {
      const max = Number.isFinite(s.maxPotD) ? s.maxPotD : null;
      let most = 0;
      for (let n = 1; n <= 24; n++) if (max == null || V.plantPotD('beansprout', n) <= max + 1e-9) most = n;
      rows.push({ id: s.slotId, max, most });
    }
    return rows;
  })()`);
  console.log('\n  자리 → 제 크기로 들어가는 시루 수');
  for (const r of fitTable)
    console.log(`    ${r.id.padEnd(18)} 한도 ${r.max == null ? '없음 ' : r.max.toFixed(2)}  최대 ${r.most === 24 ? '24+' : r.most}개`);
  const noTwelve = fitTable.filter(r => r.most < 12);
  console.log(`  ⇒ 12개가 제 크기로 안 들어가는 자리 ${noTwelve.length}/${fitTable.length}칸`);
  /* ★ 창턱(0.21)은 시루 **한 개도** 안 받는다 — 그건 이 작업이 만든 일이 아니라
     예전부터 그랬다. 추천 원이 14칸 중 13칸만 밝히는 것(§GOLD.ringsFit)이 같은 사실이다.
     그래서 검사는 "한 개 이상"이 아니라 **옛 답과 맞물리는지**를 본다. */
  ok('⑥ 한 개라도 받는 자리 수가 추천 원의 답과 맞물린다 (창턱은 예전부터 0개다)',
     fitTable.filter(r => r.most >= 1).length === GOLD.ringsFit.beansprout,
     `${fitTable.filter(r => r.most >= 1).length} ≠ ${GOLD.ringsFit.beansprout}`);

  /* ══ 스크린샷 — 1 · 4 · 12개가 실제로 서 있는 것이 보여야 한다 ══════════
     ★ **방바닥**에 **제 크기로** 세운다. 가구 위에 놓으면 자리 한도에 맞춰 무리가
       통째로 줄어들어(§⑤) "12개를 샀다"가 아니라 "작은 시루가 많다"로 보인다.
       반지하 14칸은 전부 12개를 제 크기로 못 받는다 — 그건 ⑤·⑥ 표가 말한다.
     ★ 카메라는 **방 전체**(focusSlot(null))로 한 번만 잡고 그대로 둔다.
       ⚠ focusSlot(그루) 로 확대하면 안 된다 — 그 함수는 **키**로만 거리를 잡는다.
         무리는 넓고 낮아서(0.97 × 0.35m) 코앞까지 들어가 시루 두어 개만 찍힌다(실제로 찍혔다).
         세 장의 거리가 같아야 "몇 개인가"를 눈으로 견줄 수 있다. */
  if (SHOTS) {
    const FLOOR = { x: 0.5, y: 0, z: 0.5, onUid: null, occIdx: null };
    await page.eval(`window.view.focusSlot(null, true)`);
    await sleep(2500);
    for (const n of [12, 4, 1]) {
      await page.eval(`(async () => {
        const V = window.view;
        await V.setPlantAt('shot', null, null);
        await V.setPlantAt('shot', ${JSON.stringify(FLOOR)},
          { kind:'beansprout', progress01: 1, count: ${n}, potD: V.plantPotD('beansprout', ${n}) });
        V.redraw();
        return 1;
      })()`);
      await sleep(3500);
      await page.eval(`window.view.redraw()`);
      await page.shot(`${SHOT_DIR}multisiru_${n}.png`);
    }
    await page.eval(`window.view.setPlantAt('shot', null, null)`);
    const made = [1, 4, 12].filter(n => {
      try { return fs.statSync(`${SHOT_DIR}multisiru_${n}.png`).size > 10000; } catch { return false; }
    });
    ok('스크린샷 3장을 docs/engine/shots 에 남겼다', made.length === 3, made.join(', '));
  }

  /* ══ ⑦ 처리 안 된 예외 ═════════════════════════════════════════════════ */
  ok('⑦ 콘솔에 처리 안 된 예외가 없다', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log(`\nmultisiru: ${fail === 0 ? 'PASS' : 'FAIL'}  (${pass}/${pass + fail})`);
  await page.close();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
