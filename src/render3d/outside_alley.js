/* ============================================================
   render3d/outside_alley.js — 창밖 골목 (반지하 눈높이)
   ------------------------------------------------------------
   창이 그냥 밝은 사각형이 되지 않게 **창 너머에 무언가**를 둔다.
   정교한 도시가 아니다. 저채도 판때기 몇 장으로 "골목이다"만 말한다.

   ★ 세 가지를 지킨다.
     ① 빛의 근원이 아니다 — MeshBasicMaterial(무광원)이고
        castShadow·receiveShadow 를 켜지 않는다. 조도 계산(src/engine)은 물론
        렌더 조명(sunLight·skyPortals)도 이 기하를 **한 번도 보지 않는다.**
        여기서 무엇을 하든 winFromHouse·daily_light 의 숫자는 안 움직인다.
     ② 눈에 띄면 안 된다 — 반투명(opacity)으로 뒤 배경과 섞고, 채도를 죽인다.
     ③ 싸야 한다 — 판때기 스무 장 남짓, 삼각형 100개 미만, 벽 하나당 드로우콜 1.

   ============================================================
   ★★ 이 파일의 전부인 한 가지 — **지붕 너머로 삐져나오지 않게 하는 법**
   ------------------------------------------------------------
   게임 카메라는 인형의 집 시점이다. 방을 위에서 내려다본다(상하각 16°~54°).
   그래서 창밖에 뭘 세우면 **창으로만 보이는 게 아니라 벽 너머로 그냥 보인다.**
   처음 만들었을 때 담벼락과 전봇대가 방 지붕 위로 솟아 화면 절반을 덮었다.

   벽 윗변(y=CH)에 가려지는 영역은 카메라 상하각 el 에 대해
       y  <  CH − tan(el)·o          (o = 벽 바깥면에서 밖으로 나간 거리)
   이고, 상하각이 **얕을수록 더 많이 가려진다**(tan 이 작으니 문턱이 높다).
   그러니 제일 위험한 각은 EL_MAX(0.95rad ≈ 54°, tan≈1.398) 하나뿐이다.
   (카메라가 가까이 오면 벽 윗변을 넘는 시선은 오히려 더 가팔라진다 — 즉 더 가려진다.
    d 를 거리라 할 때 실제 기울기는 (d·sin−Δ)/(d·cos+z) < tan(el) 로 늘 작다.)

   그래서 **평면 하나로 잘라 버린다.**
       남길 영역:  y + TAN_MAX·o  ≤  CH − MARGIN
   이 쐐기(wedge) 밖은 three.js 의 clippingPlanes 가 지운다.
   (scene.js 가 renderer.localClippingEnabled 를 이미 켜 뒀다 — 벽 밑동 자르기에 쓰던 것)

   ★ 이 자르기가 **창으로 보이는 것은 하나도 안 자른다**는 증명
     상하각 el 에서 창(아랫변 SILL·윗변 HEAD)으로 보이는 점은
         y = y_win − tan(el)·o,   y_win ∈ [SILL, HEAD]
     이 점이 쐐기 안에 있으려면  y_win − tan(el)·o + TAN_MAX·o ≤ CH − MARGIN.
     최악은 y_win = HEAD, tan(el) 최소:
         HEAD + (TAN_MAX − tan(el))·o ≤ CH − MARGIN
     HEAD < CH 이고(창은 벽보다 낮다) TAN_MAX ≥ tan(el) 이므로 o 가 크면 언젠가 깨진다 —
     그 지점이 바로 "지붕 위로 보이기 시작하는 자리"다. 즉 **자를 수밖에 없는 깊이**이고,
     자르는 자리와 삐져나오는 자리가 정확히 같다. 얕은 각에서 창 윗동아리에
     배경이 비치는 것은 그 대가다(반지하 창은 간유리라 티가 안 난다).

   ★ 그래서 골목이 얕다 — 담벼락이 코앞(0.55m)이다.
     타협이 아니라 **반지하 골목 그 자체**이기도 하다. 창을 열면 옆집 담이 손에 닿는다.
============================================================ */

const WT = 0.2;                 // house.js 의 벽 두께. 바깥 면에서 시작해야 벽 속에 안 묻힌다
/* room_view.js 의 EL_MAX(0.95rad) tan 값 1.398 에 여유를 준 것.
   ⚠ EL_MAX 를 올리면 여기도 같이 올려야 한다 — 안 그러면 담벼락이 지붕 위로 솟는다. */
const TAN_MAX = 1.42;
const MARGIN = 0.08;            // 벽 윗변에서 이만큼 더 내려 자른다(그림자·앤티에일리어싱 여유)

/* 팔레트 — 전부 저채도다. 여기서 선명한 색을 쓰면 화면 주인공이 바뀐다.
   material.color 가 시간대에 따라 이 값들을 통째로 곱한다.

   ★ 안쪽 대비는 **세게** 준다. 언뜻 모순 같지만 아니다 —
     반지하 창은 간유리(opacity 0.82)라 뒤엣것이 5분의 1로 눌려서 온다.
     거기에 이 재질의 반투명(0.58)이 한 번 더 곱해진다. 담과 줄눈의 명도차를
     8%로 두면 화면에서는 1%가 되어 **그냥 회색 판 한 장**이 된다(실제로 그랬다).
     안에서 세게 갈라 두어야 유리를 통과한 뒤에 겨우 '무엇인가 있다'가 된다.
     ⚠ 그래서 맑은 유리 방에 이걸 켜면 셀 것이다. 기본이 반지하 전용인 이유다. */
const C = {
  road:      0x4a4a54,   // 골목 바닥(집 벽 쪽)
  roadFar:   0x2e2e36,   // 담 밑(그늘)
  gutter:    0x1e1e24,   // 배수구 선
  wall:      0x6f6a60,   // 시멘트 담벼락 — 아래쪽
  wallTop:   0x9c968a,   // 담 위쪽 — 하늘빛을 더 받는다
  wallBase:  0x38362f,   // 밑동 물때
  joint:     0x45413a,   // 블록 줄눈
  pole:      0x2f2c27,   // 전봇대
  pipe:      0x3b382f,   // 홈통
  box:       0x4c4941    // 담 밑에 놓인 무언가
};

/* 벽 → 바깥 방향·가로축. house.js 의 wallPlacement 와 같은 규약이다. */
function wallFrame(wall, size) {
  const bz = size.d / 2 + WT / 2, bx = size.w / 2 + WT / 2;
  switch (wall) {
    /* (u, y, o) → 월드. o 는 벽 바깥면에서 밖으로 나간 거리 */
    case 'back':  return { base: bz, len: size.w, out: [0, 0, -1], p: (u, y, o) => [u, y, -(bz + o)] };
    case 'front': return { base: bz, len: size.w, out: [0, 0,  1], p: (u, y, o) => [u, y,  (bz + o)] };
    case 'left':  return { base: bx, len: size.d, out: [-1, 0, 0], p: (u, y, o) => [-(bx + o), y, u] };
    case 'right': return { base: bx, len: size.d, out: [ 1, 0, 0], p: (u, y, o) => [ (bx + o), y, u] };
  }
  return null;
}

/* 판때기를 쌓는 아주 작은 빌더. 삼각형을 직접 적는다 —
   BoxGeometry 를 스무 개 만들면 드로우콜도 스무 개고 안 보이는 면까지 그린다. */
function makeBuilder(frame) {
  const pos = [], col = [];
  const c3 = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  function vtx(p, hex) {
    const w = frame.p(p[0], p[1], p[2]);
    pos.push(w[0], w[1], w[2]);
    const c = c3(hex);
    col.push(c[0], c[1], c[2]);
  }
  const B = {
    /* 네 점(국소좌표)과 색. cols 를 주면 꼭짓점마다 다른 색 = 그라데이션.
       ★ 양면(DoubleSide)이라 감는 방향은 신경 쓰지 않는다 — 판때기 스무 장에
         뒷면 컬링을 아껴 봐야 소용없고, 뒤집힌 판 하나 찾느라 시간을 쓰는 게 더 비싸다. */
    quad(a, b, c, d, hex, cols) {
      const h = cols || [hex, hex, hex, hex];
      vtx(a, h[0]); vtx(b, h[1]); vtx(c, h[2]);
      vtx(a, h[0]); vtx(c, h[2]); vtx(d, h[3]);
    },
    /* 위·아래 뚜껑 없는 네모 기둥(전봇대·상자). 옆면 4장. */
    post(u0, u1, y0, y1, o0, o1, hex) {
      B.quad([u0, y0, o0], [u1, y0, o0], [u1, y1, o0], [u0, y1, o0], hex);
      B.quad([u0, y0, o1], [u1, y0, o1], [u1, y1, o1], [u0, y1, o1], hex);
      B.quad([u0, y0, o0], [u0, y0, o1], [u0, y1, o1], [u0, y1, o0], hex);
      B.quad([u1, y0, o0], [u1, y0, o1], [u1, y1, o1], [u1, y1, o0], hex);
    },
    done() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeBoundingSphere();
      return { geo: g, tris: pos.length / 9 };
    }
  };
  return B;
}

/* 이 벽에서 지붕 너머로 안 보이는 쐐기를 만드는 자르기 평면 하나.
   남기는 쪽:  y + TAN_MAX·o ≤ CH − MARGIN   (머리말의 증명 참조) */
function wedgePlane(frame, roofY) {
  const [ox, , oz] = frame.out;
  /* 남길 조건을  n·p + c ≥ 0  꼴로.  n = (−TAN_MAX·out) + (0,−1,0) */
  const n = new THREE.Vector3(-TAN_MAX * ox, -1, -TAN_MAX * oz);
  /* 경계 위의 한 점: 그 벽 바깥면(o=0)의 y = roofY */
  const w = frame.p(0, roofY, 0);
  return new THREE.Plane().setFromNormalAndCoplanarPoint(
    n.normalize(), new THREE.Vector3(w[0], w[1], w[2]));
}

/* 한 벽 바깥에 골목 한 벌.  win = { cy, h, w } (그 벽에서 제일 큰 창) */
function alleyForWall(wall, size, win, baseMat) {
  const frame = wallFrame(wall, size);
  if (!frame) return null;
  const B = makeBuilder(frame);

  const sill = win.cy - win.h / 2;                 // 창턱
  const GY = sill - Math.max(0.50, win.h * 1.1);   // 골목 바닥 — 창턱 바로 아래
  const WO = 0.55;                                 // 담벼락 면까지 (벽 바깥면 기준)
  /* 담·전봇대는 넉넉히 세운다. 어차피 쐐기 평면이 보일 만큼만 남기고 잘라 준다 —
     여기서 높이를 눈대중으로 맞추면 방 높이가 다른 방에서 틀린다. */
  const WTOP = GY + 2.4;
  /* 창으로 보이는 각이 좁다. 창폭의 두 배면 화면 밖까지 덮는다.
     ★ 벽 길이보다 짧게 — 방 모서리 밖으로 삐져나오면 옆에서 보인다. */
  const SPAN = Math.min(frame.len - 0.5, Math.max(3.0, win.w * 1.8));
  const U0 = -SPAN / 2, U1 = SPAN / 2;
  const DEEP = 1.6;                                // 바닥을 이만큼 깔면 쐐기가 알아서 자른다

  /* ── ① 골목 바닥 ── 집 벽 밑에서 담 너머까지. 담 밑은 그늘져 어둡다 */
  B.quad([U0, GY, 0.02], [U1, GY, 0.02], [U1, GY, DEEP], [U0, GY, DEEP], 0,
         [C.road, C.road, C.roadFar, C.roadFar]);
  /* 배수구 — 담 밑으로 흐르는 선 하나. 골목이 '길'이라는 유일한 단서다 */
  B.quad([U0, GY + 0.004, WO - 0.22], [U1, GY + 0.004, WO - 0.22],
         [U1, GY + 0.004, WO - 0.08], [U0, GY + 0.004, WO - 0.08], C.gutter);

  /* ── ② 담벼락 ── 코앞에 선다. 창을 통째로 채우는 것이 이 판이다 */
  B.quad([U0, GY, WO], [U1, GY, WO], [U1, WTOP, WO], [U0, WTOP, WO], 0,
         [C.wall, C.wall, C.wallTop, C.wallTop]);
  /* 밑동 물때 — 담이 바닥에 앉은 자리. 이거 하나로 담이 '오래된 것'이 된다 */
  B.quad([U0, GY, WO - 0.006], [U1, GY, WO - 0.006],
         [U1, GY + 0.16, WO - 0.006], [U0, GY + 0.16, WO - 0.006], C.wallBase);
  /* 블록 줄눈 — 담의 재질감은 이게 다다. 쐐기가 자르므로 보이는 높이에만 둔다 */
  for (const dy of [0.30, 0.58, 0.86, 1.14]) {
    const y = GY + dy;
    B.quad([U0, y, WO - 0.008], [U1, y, WO - 0.008],
           [U1, y + 0.022, WO - 0.008], [U0, y + 0.022, WO - 0.008], C.joint);
  }

  /* ── ③ 서 있는 것 몇 개 ── 담만 있으면 판때기로 보인다.
     세로선이 하나 있어야 '골목'이 된다.
     ★ 자리를 창폭(±win.w/2) 안에 둔다 — 밖에 두면 만들어 놓고 아무도 못 본다.
       앞쪽(o 작은 곳)에 둘수록 쐐기가 덜 잘라서 위까지 살아남는다. */
  const HW = win.w / 2;
  const pu = -HW * 0.52;                                        // 전봇대
  B.post(pu, pu + 0.15, GY, WTOP + 1.2, 0.24, 0.39, C.pole);
  const du = HW * 0.72;                                         // 담을 타고 내려오는 홈통
  B.quad([du, GY, WO - 0.012], [du + 0.075, GY, WO - 0.012],
         [du + 0.075, WTOP, WO - 0.012], [du, WTOP, WO - 0.012], C.pipe);
  const bu = HW * 0.02;                                         // 담 밑에 놓인 무언가(양동이·실외기)
  B.post(bu, bu + 0.36, GY, GY + 0.44, WO - 0.34, WO - 0.04, C.box);

  const { geo, tris } = B.done();
  /* 벽마다 자르기 평면이 다르므로 재질도 벽마다 한 벌. 방에 창 벽은 많아야 둘셋이다. */
  const mat = baseMat.clone();
  mat.clippingPlanes = [wedgePlane(frame, size.h - MARGIN)];
  mat.clipShadows = false;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;          // 절대 안 움직인다
  mesh.renderOrder = -1;                  // 창유리보다 먼저 — 유리가 그 위에 덮이게
  /* 배치·걷기 레이캐스트가 절대 집지 않게. (room_view 는 built.room 에만 쏘지만
     나중에 씬 전체로 쏘는 코드가 생겨도 여기서 막힌다) */
  mesh.raycast = () => {};
  mesh.userData.outsideWall = wall;
  mesh.userData.outNormal = frame.out;
  mesh.userData.wallBase = frame.base;
  return { mesh, mat, tris };
}

/* ============================================================
   buildOutsideAlley(built, opts)
   built  : buildHouse 의 결과 ({ size, luxWins })
   opts   : { opacity }
   반환   : null  (창이 없거나 만들 게 없는 방)
          | { group, tris, quads, walls, setDaylight, updateVisibility, dispose }
============================================================ */
export function buildOutsideAlley(built, opts = {}) {
  if (!built || !built.size) return null;
  const size = built.size;
  if (!(size.h > 0)) return null;

  /* 벽마다 '제일 큰 창' 하나만 본다. 창이 셋이어도 골목은 한 벌이면 된다.
     천창(ceiling)·유리벽 구간은 뺀다 — 하늘을 보는 창이라 골목이 아니다. */
  const best = new Map();
  for (const w of (built.luxWins || [])) {
    if (!w || !w.wall || w.wall === 'ceiling') continue;
    if (!wallFrame(w.wall, size)) continue;
    const a = (w.w || 0) * (w.h || 0);
    if (!(a > 0) || !Number.isFinite(w.cy)) continue;
    /* 창 윗변이 벽 윗변보다 높으면(있을 수 없지만) 쐐기 증명이 깨진다 — 안 만든다 */
    if (w.cy + w.h / 2 >= size.h - MARGIN) continue;
    const cur = best.get(w.wall);
    if (!cur || a > cur.area) best.set(w.wall, { area: a, w: w.w, h: w.h, cy: w.cy });
  }
  if (!best.size) return null;              // ★ 창 없는 방 — 조용히 아무것도 안 만든다

  const OP = opts.opacity == null ? 0.58 : opts.opacity;
  /* 밑틀 재질. vertexColors 로 부위 색을 넣으므로 부위마다 재질을 만들지 않는다.
     ★ MeshBasicMaterial 이라 빛을 안 받는다 = 조명 계산에 끼어들 방법이 없다. */
  const baseMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: OP,
    depthWrite: true, side: THREE.DoubleSide,
    fog: false                 // scene.fog 는 방을 위한 값이다. 여기 흐림은 opacity 가 낸다
  });

  const group = new THREE.Group();
  group.name = 'outside_alley';
  group.matrixAutoUpdate = false;
  const walls = [], mats = [];
  let tris = 0;

  for (const [wall, win] of best) {
    const made = alleyForWall(wall, size, win, baseMat);
    if (!made) continue;
    group.add(made.mesh);
    walls.push(made.mesh);
    mats.push(made.mat);
    tris += made.tris;
  }
  baseMat.dispose();                        // 틀이었을 뿐이다. 실제로 쓰는 건 복제본들
  if (!walls.length) return null;
  group.updateMatrixWorld(true);

  /* ── 시간대 ──
     무광원이므로 색을 직접 곱해 준다. 방의 빛을 흉내 내려는 게 아니라
     "밖이 밝다/어둡다"만 같이 움직이면 된다. */
  const _tmp = new THREE.Color();
  const NIGHT = new THREE.Color(0x2b3042);          // 밤: 푸르고 어둡다
  const DAY   = new THREE.Color(0xf2f0ea);          // 낮: 거의 흰 배수(색은 정점색이 낸다)

  /* d = { sunI, sunColor, sky } — room_view 가 scene.js 갱신 직후 값을 넘긴다.
     sunI 는 scene.js 의 sunLight.intensity (= 하루 세기 x 1.55). */
  function setDaylight(d = {}) {
    const k = Math.max(0, Math.min(1, (d.sunI == null ? 0.8 : d.sunI) / 1.55));
    _tmp.copy(NIGHT).lerp(DAY, k);
    /* 해가 낮을 때(아침·저녁) 해 색을 섞는다 — 담벼락이 같이 물든다 */
    if (d.sunColor && k > 0.02) _tmp.lerp(d.sunColor, 0.20 * (1 - k) + 0.08);
    /* 밤에는 하늘색 쪽으로 조금 끌어 준다(가로등 없는 골목이 새까매지지 않게) */
    if (d.sky && k < 0.35) _tmp.lerp(d.sky, 0.18);
    const op = OP * (0.72 + 0.28 * k);              // 밤엔 살짝 더 묽게
    for (const m of mats) { m.color.copy(_tmp); m.opacity = op; }
  }

  /* 카메라가 그 벽 **바깥**으로 돌아가면 house.js 가 벽을 밑동만 남기고 감춘다.
     그때 골목이 그대로 보이면 방 옆에 판때기가 서 있는 꼴이라 감춘다.
     문턱 0.3 은 house.js 의 updateShellVisibility 와 같은 값이다. */
  function updateVisibility(camPos) {
    for (const m of walls) {
      const n = m.userData.outNormal, b = m.userData.wallBase;
      /* 벽 바깥면 위의 한 점: 법선 * base. (u·y 성분은 내적에서 0 이 된다) */
      const dot = (camPos.x - n[0] * b) * n[0] + (camPos.z - n[2] * b) * n[2];
      const outsideCam = dot >= 0.3;
      if (m.visible === !outsideCam) continue;
      m.visible = !outsideCam;
    }
  }

  function dispose() {
    for (const m of walls) m.geometry.dispose();
    for (const m of mats) m.dispose();
    if (group.parent) group.parent.remove(group);
    walls.length = 0; mats.length = 0;
  }

  return { group, tris, quads: tris / 2, walls: [...best.keys()],
           setDaylight, updateVisibility, dispose };
}
