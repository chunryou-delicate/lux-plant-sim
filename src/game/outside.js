/* ============================================================
   game/outside.js — 창밖 동네 (장식 전용)
   ------------------------------------------------------------
   방 안이 어두운 **이유가 화면에 없었다.** 창밖이 비어 있어서
   "빛이 모자란 방"이라는 이 게임의 전제가 그림으로 안 보였다.
   그래서 창 너머에 동네를 세운다 — 간소하게, 러프하게.

   ★★ 이건 **장식이다. 조도 계산에 절대 들어가지 않는다.**
     조도 엔진(src/engine/daylight_lux.js · daily_light.js)은 THREE 를 아예 모른다.
     차폐체는 buildHouse() 가 data/house_rooms.json 에서 만든 평범한 배열
     `built.occluders = [{x,z,w,d,h,y0,rot,src}]` 하나뿐이고, 씬을 훑지 않는다.
     그러니 여기서 메시를 아무리 더해도 dliAt·daylightRatio·luxGrid 는 못 본다.
     ⚠ 그래도 지키는 것 — 아래 셋을 어기면 **그림**이 흔들린다(계산이 아니라):
       ① 진짜 광원을 만들지 않는다. 가로등도 **색**으로만 흉내 낸다.
          (이 저장소는 예전에 "밤이 너무 밝다"로 고생했다 — 방 안 조명들이 92 를 더하고 있었다)
       ② castShadow 를 켜지 않는다. 켜면 해 그림자맵 안에 들어와 방이 실제로 어두워진다.
       ③ MeshBasicMaterial 을 쓴다 — 방의 hemi·ambient·sunLight 에 아예 반응하지 않는다.
          낮밤은 정점색을 직접 갈아 끼워 만든다.

   ★ 반지하의 눈높이
     반지하 창은 **땅 높이**에 있다. 방 데이터가 그렇게 말한다 —
       banjiha  창 y 1.495~2.045 (방 높이 2.3) → 창턱이 방 높이의 65% 지점
       oneroom  창 y 0.775~2.225 (방 높이 2.5) → 창턱이 31% 지점
     창턱이 방 높이의 절반을 넘으면 그 방은 땅에 묻힌 것이다. 그때 **바깥 지면을
     창턱 높이에 둔다.** 그러면 창으로 하늘이 아니라 아스팔트가 보인다.
     아래 절반(31%)이면 지상층 위다 — 지면을 창턱보다 3.6m 아래(2층)에 둔다.
     그래서 원룸은 하늘이 보이고 반지하는 안 보인다. 방이 바뀌면 창밖도 바뀐다.

   ★ "반투명하게" 를 어떻게 풀었나 — §TRANSLUCENCY 주석 참고.
     transparent/opacity 를 안 썼다. **낮은 채도 + 방 배경색 쪽으로 당긴 색**으로 풀었다.

   ★★ 「축소하면 주변이 보이도록」 — 두 요구가 부딪히는 자리 (2026-08-15)
     박사님: "방만 덜렁있는데 좀 이상한데 주변 배경도 좀… 골목 도로랑 건물들 있는거처럼?
              최소 축소햇을때 보이는 배경정도는 좀 차도록"
     그런데 이 게임 카메라는 **늘 내려다본다**(상하각 16°~54°). 창밖에 뭘 세우면
     창으로만 보이는 게 아니라 벽 너머로 그냥 보인다. 앞사람은 담벼락이 지붕 위로
     솟아 화면 절반을 덮는 것을 겪고 **창 크기로 잘라 버렸다**(render3d/outside_alley.js).
     그래서 지금 화면은 방만 허공에 떠 있다 — 자른 것이 원인이다.

     ⇒ 자르지 않는다. 대신 **거리로 푼다.** 왜 그것이 답인지가 아래 숫자다.

     카메라가 내려다보면 화면 **위쪽 끝**은 「수평에서 (상하각 − 화각절반)만큼 내려간 방향」이다.
     폰 세로에서 상하각 49°·수직화각 38° 이면 위쪽 끝이 **수평 아래 30°** 다.
     즉 카메라보다 tan(30°)·H 이상 낮은 것만 화면에 든다(H = 카메라에서의 수평거리).
       · 방 지붕(y 2.3, H 16.4m)      → 수평 아래 43°  … 화면 안
       · 골목 바닥(y 1.44, H 20~28m)  → 수평 아래 30~39° … **방 지붕과 화면 위끝 사이**
       · 30m 넘게 먼 바닥            → 30° 보다 얕다   … **화면 밖(위)으로 잘려 나간다**
     ★ 그러니 「멀리 두면 방을 덮는다」는 거꾸로다. **멀수록 화면 위로 밀려 사라진다.**
       방을 덮는 것은 먼 것이 아니라 **가깝고 큰 것**이다(그래서 앞사람의 담이 덮었다).
     ⇒ 방 지붕과 화면 위끝 사이의 그 띠를 **깊이 5~12m 짜리 동네**로 채운다.
       더 먼 줄(12~22m)은 상하각을 낮췄을 때(16°, 하늘이 보이는 각)만 나온다 —
       공짜로 얻는 층이다. 잘라내지 않아도 **화각이 알아서 자른다.**

   ★ 두 겹으로 나눠 그린다 — near · far
     near  골목 그 자체(길·담·차·전봇대). 창으로 보이는 것이 여기 다 있다.
     far   건너편 빌라 줄·더 먼 실루엣·전선. **드로우콜 하나를 더 쓴다.**
     나눈 이유는 하나다 — 카메라가 창 벽 **바깥**으로 돌면 방과 카메라 사이에 서게 되어
     방을 가린다. 그때 통째로 감춰야 하는데, 겹을 나눠 두면 「멀리 있는 것만 끄기」도 된다.

   쓰는 법 (room_view.js 가 방을 지은 직후 한 줄)
     const out = attachOutside(ctx, built, roomId, () => daylightT);
     out.updateCamera(ctx.cam.position);      // 카메라가 움직일 때마다
   THREE 는 전역이다(room_view.js·house.js 와 같은 r128). DOM 은 모른다.
============================================================ */

/* ============================================================
   §TRANSLUCENCY — 왜 opacity 를 안 썼나
   ------------------------------------------------------------
   "반투명하게" 를 세 가지로 읽을 수 있었고 셋 다 화면에서 봤다.

   ① transparent + opacity 를 낮춘다
      - 겹친 면끼리 정렬 문제가 난다. 담벼락 뒤로 전봇대가 비쳐 보이고
        카메라를 돌리면 앞뒤가 뒤집힌다(투명 물체는 깊이를 안 쓴다).
      - 드로우콜이 는다. 투명 물체는 불투명 묶음에 못 섞이고 하나씩 정렬돼 나간다.
        이 파일의 전부가 **드로우콜 하나**인 것이 그 반대급부로 얻은 것이다.
      - 무엇보다 뒤가 방 배경색(0x14101c 쪽)이라, opacity 를 낮추면 그냥
        **어두워지기만** 한다. 색을 섞는 것과 결과가 같은데 비용만 더 든다.
   ② scene.fog
      - 못 쓴다. room_view.js:2179 가 안개를 카메라 거리에 맞춰 near=max(30,·)
        far=max(120,·) 로 다시 잡는다. 창밖은 카메라에서 20~30m 안쪽이라
        안개가 **닿지도 않는다.** 그렇다고 near 를 당기면 방까지 뿌예진다 —
        그건 조도 그림을 건드리는 것이라 금지다.
   ③ 채도를 낮추고 방 배경색 쪽으로 당긴 색만 쓴다  ← 이걸 골랐다
      - 정점색 하나에 다 들어간다. 드로우콜 0 추가, 정렬 문제 0, 상태 변화 0.
      - 멀수록 배경색 쪽으로 더 당긴다(HAZE 표) — 눈에는 공기원근으로 읽힌다.
        진짜 안개와 같은 그림인데 셰이더를 안 건드린다.
      - 낮밤이 바뀌면 당기는 목표색도 같이 바뀌므로 밤엔 저절로 더 묻힌다.
   결론: 배경이 방보다 앞에 나서면 안 된다는 뜻으로 읽고, **색으로** 풀었다.
============================================================ */

/* 채도를 낮추고 방 배경 쪽으로 당길 목표색 — room_view.js:2124 가 배경/안개를
   섞어 넣는 그 색과 같은 것 하나다. 여기가 어긋나면 창밖만 붕 뜬다. */
const HAZE_DAY   = 0x23242f;
const HAZE_NIGHT = 0x14101c;
/* 깊이[m]별로 얼마나 당기나. 가까운 것은 또렷하고 먼 것은 묻힌다.
   ★ 세게 잡았다. room_view.js:2119 가 방 바깥을 UI 바탕색으로 낮춰 "방만 밝은 섬"으로
     만들어 놓았는데, 창밖이 그보다 밝으면 그 공이 통째로 날아간다.
     처음엔 0.10~0.62 로 뒀다가 폰 크기로 찍어 보고 올렸다 — 배경이 방보다 앞에 나섰다. */
const HAZE_NEAR = 0.30, HAZE_FAR = 0.72, HAZE_DIST = 10;
/* 전체 한 번 더 눌러 준다 — 색을 하나하나 다시 고르는 것보다 되돌리기 쉽다.
   ★ 기준: **창밖이 방바닥보다 밝으면 안 된다.** 방바닥 휘도 103.8 을 재 놓고
     그 아래로 들어올 때까지 내렸다(tools/probe_outside.mjs). */
const DIM_DAY = 0.80, DIM_NIGHT = 0.90;

/* 낮밤 — room_view.js:2067 의 isDay(0.30~0.78) · 2185 의 lampsOn(<0.30 | >0.86) 과
   같은 시각을 쓴다. 창밖만 다른 시각에 밝아지면 화면이 어긋난다. */
const DAWN0 = 0.22, DAWN1 = 0.34, DUSK0 = 0.74, DUSK1 = 0.86;

/* 씬 하나에 하나만 붙는다. 방을 갈아 끼우면 이전 것을 치운다. */
const _mounted = new WeakMap();

/* ── 작은 도구들 ───────────────────────────────────────── */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/* ★ 정점색은 셰이더에서 **선형(linear)** 값으로 그대로 쓰인다.
   renderer.outputEncoding 이 sRGB 라 화면에 나갈 때만 인코딩되는데, 그건 이미
   선형이라고 가정한 값을 인코딩하는 것이다. 그래서 눈으로 고른 16진 색(=sRGB)을
   날것으로 넣으면 **한참 밝게** 나온다 — 처음에 이걸 빠뜨려 담벼락이 방보다 밝았다.
   여기서 sRGB→선형으로 바꿔 준다. 그래야 표에 적은 색이 화면의 색과 같은 뜻이 된다. */
const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const rgb = (hex) => [s2l(((hex >> 16) & 255) / 255), s2l(((hex >> 8) & 255) / 255), s2l((hex & 255) / 255)];
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/* 되풀이되는 난수 — 같은 방은 언제 열어도 같은 동네여야 한다.
   Math.random 을 쓰면 방을 다시 지을 때마다 전봇대가 옮겨 다닌다. */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* ============================================================
   ①  기하 쌓개 — 전부 **하나의 BufferGeometry** 로 모은다
   ------------------------------------------------------------
   ★ 재질은 하나뿐이다. 색은 정점색으로 넣는다.
     물체마다 재질을 만들면 드로우콜이 폭발한다(예산 +8). 이 방식이면
     동네 전체가 **드로우콜 1개**다. 낮밤은 정점색 배열을 갈아 끼워 만든다.
   좌표는 창 기준 국소계 (u, y, t) 로 준다.
     u  창 중심에서 벽을 따라 좌우[m]
     y  방 바닥 기준 높이[m] (월드 y 그대로)
     t  벽면에서 밖으로 나간 거리[m]
============================================================ */
function makeBuilder(toWorld) {
  const pos = [], colD = [], colN = [];
  const HD = rgb(HAZE_DAY), HN = rgb(HAZE_NIGHT);
  let hazeK = 0;                    /* 지금 쌓는 것에 걸 안개 세기(0..1) */

  const put = (u, y, t, cd, cn) => {
    const p = toWorld(u, y, t);
    pos.push(p[0], p[1], p[2]);
    /* 안개는 여기서 **색에 미리 섞어** 넣는다. 셰이더가 아니라 데이터다. */
    const a = mix(cd, HD, hazeK), b = mix(cn, HN, hazeK);
    colD.push(a[0] * DIM_DAY, a[1] * DIM_DAY, a[2] * DIM_DAY);
    colN.push(b[0] * DIM_NIGHT, b[1] * DIM_NIGHT, b[2] * DIM_NIGHT);
  };

  const B = {
    /* 깊이 t 를 주면 그 거리에 맞는 안개 세기를 건다 */
    haze(t) { hazeK = HAZE_NEAR + (HAZE_FAR - HAZE_NEAR) * clamp(t / HAZE_DIST, 0, 1); return B; },
    hazeRaw(k) { hazeK = k; return B; },

    /* 삼각형 하나 */
    tri(a, b, c, color, colorNight) {
      const cd = rgb(color), cn = rgb(colorNight == null ? color : colorNight);
      put(a[0], a[1], a[2], cd, cn); put(b[0], b[1], b[2], cd, cn); put(c[0], c[1], c[2], cd, cn);
      return B;
    },

    /* 사각형 하나 — 네 점을 시계/반시계 아무 쪽으로 줘도 된다(양면 재질) */
    quad(a, b, c, d, color, colorNight) {
      const cd = rgb(color), cn = rgb(colorNight == null ? color : colorNight);
      put(a[0], a[1], a[2], cd, cn); put(b[0], b[1], b[2], cd, cn); put(c[0], c[1], c[2], cd, cn);
      put(a[0], a[1], a[2], cd, cn); put(c[0], c[1], c[2], cd, cn); put(d[0], d[1], d[2], cd, cn);
      return B;
    },

    /* 바닥에 깔리는 판 — y 하나에 u·t 범위 */
    slab(u0, u1, t0, t1, y, color, colorNight) {
      return B.quad([u0, y, t0], [u1, y, t0], [u1, y, t1], [u0, y, t1], color, colorNight);
    },

    /* 상자 — 위/옆 색을 따로 준다.
       ★ 이 재질은 빛을 안 받으므로 면끼리 밝기 차를 **손으로** 넣어야 입체로 보인다.
         면마다 조금씩 다른 밝기를 주는 것이 이 저장소의 flatShading 결과 같은 그림이 된다. */
    box(u0, u1, y0, y1, t0, t1, top, side, topN, sideN) {
      const sN = sideN == null ? side : sideN;
      B.quad([u0, y1, t0], [u1, y1, t0], [u1, y1, t1], [u0, y1, t1], top, topN);          // 윗면
      B.quad([u0, y0, t0], [u1, y0, t0], [u1, y1, t0], [u0, y1, t0], side, sN);           // 앞(창 쪽)
      B.quad([u0, y0, t1], [u1, y0, t1], [u1, y1, t1], [u0, y1, t1],
             shade(side, 0.86), shade(sN, 0.9));                                          // 뒤
      B.quad([u0, y0, t0], [u0, y0, t1], [u0, y1, t1], [u0, y1, t0],
             shade(side, 0.80), shade(sN, 0.86));                                          // 좌
      B.quad([u1, y0, t0], [u1, y0, t1], [u1, y1, t1], [u1, y1, t0],
             shade(side, 0.92), shade(sN, 0.94));                                          // 우
      return B;
    },

    /* n각 기둥. 세 가지로 눕는다 — **축이 어느 쪽인가**로 고른다.
         'y'  전봇대·나무줄기 (cy 가 **밑동**)
         'u'  축이 길 방향     — 원판이 (y,t) 면에 선다
         't'  축이 길을 가로지름 — 원판이 (u,y) 면에 선다. ★ **바퀴는 이쪽이다**

       ★★ 2026-08-15 — **바퀴가 'u' 로 서 있었다.** 박사님이 화면을 보고 짚으셨다.
         축이 길 방향이면 원판이 차 옆구리가 아니라 **앞뒤 얼굴**에 붙는다 —
         굴러가는 방향이 90° 틀린 것이고, 화면에서는 둥글게 안 보이고
         차체에서 삐져나온 **까만 탭** 두 개로 보인다(그렇게 보였다).
         바퀴 축은 진행 방향에 **직각**이어야 한다.
       ⚠ 'u' 를 지운 게 아니라 남겨 뒀다 — 축이 길 방향인 물건(가로대 따위)이 나중에 나온다.

       capLow  마감면을 e1(기본) 이 아니라 **e0** 쪽에 붙인다. 바퀴는 **바깥쪽**이 보이는데
               가까운 쪽 바퀴는 그 바깥이 −t(=e0) 라서 필요하다. 안 그러면 뚫려 보인다. */
    prism(cu, cy, ct, r, len, n, axis, color, colorNight, capLow) {
      const cN = colorNight == null ? color : colorNight;
      const P = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        P.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      const e0 = axis === 'y' ? 0 : -len / 2;
      const e1 = axis === 'y' ? len : len / 2;
      const pt = (i, e) => {
        const [p, q] = P[i % n];
        if (axis === 'y') return [cu + p, cy + e, ct + q];
        if (axis === 't') return [cu + p, cy + q, ct + e];  // 축이 길을 가로지름(바퀴)
        return [cu + e, cy + p, ct + q];                    // 축이 길 방향
      };
      for (let i = 0; i < n; i++) {
        /* 옆면 — 한쪽을 밝게 둬서 둥글게 보이게 한다.
           'u'·'y' 는 창 쪽(−t)을, 't' 는 **위(+y)** 를 밝힌다. 바퀴는 위에서 내려다보므로
           창 쪽을 밝히면 아무 데도 안 밝다 — 원판이 서 있는 면이 다르기 때문이다. */
        const a = (i / n) * Math.PI * 2;
        const k = axis === 't' ? 0.76 + 0.26 * Math.max(0, Math.sin(a))
                               : 0.76 + 0.26 * Math.max(0, -Math.sin(a));
        B.quad(pt(i, e0), pt(i + 1, e0), pt(i + 1, e1), pt(i, e1), shade(color, k), shade(cN, k));
      }
      /* 마감면 — 보이는 쪽 하나만. 반대쪽은 땅에 붙거나 차체에 묻힌다 */
      const ec = capLow ? e0 : e1;
      for (let i = 1; i < n - 1; i++)
        B.tri(pt(0, ec), pt(i, ec), pt(i + 1, ec), shade(color, 1.12), shade(cN, 1.12));
      return B;
    },

    /* 가운데가 밝고 가장자리로 사라지는 원판 — 가로등 불빛 자국·맨홀.
       ★ 진짜 광원이 아니다. 바닥에 칠한 **색**이다. 조도에 0을 더한다. */
    pool(cu, ct, r, y, edgeD, edgeN, coreD, coreN, n = 12) {
      const cD = rgb(coreD), cN = rgb(coreN), eD = rgb(edgeD), eN = rgb(edgeN);
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        put(cu, y, ct, cD, cN);
        put(cu + Math.cos(a0) * r, y, ct + Math.sin(a0) * r, eD, eN);
        put(cu + Math.cos(a1) * r, y, ct + Math.sin(a1) * r, eD, eN);
      }
      return B;
    },

    /* 지금까지 쌓은 정점 개수 — 움직이는 조각의 위치를 기억해 두려고 쓴다 */
    mark() { return pos.length / 3; },
    get pos() { return pos; },
    get colD() { return colD; },
    get colN() { return colN; },
    tris() { return pos.length / 9; }
  };
  return B;
}

const shade = (hex, k) => {
  const r = clamp(Math.round(((hex >> 16) & 255) * k), 0, 255);
  const g = clamp(Math.round(((hex >> 8) & 255) * k), 0, 255);
  const b = clamp(Math.round((hex & 255) * k), 0, 255);
  return (r << 16) | (g << 8) | b;
};

/* ============================================================
   ②  동네 — 반지하 골목
   ------------------------------------------------------------
   창이 땅 높이라 보이는 것이 정해져 있다.
     길바닥 · 경계석 · 건너편 담벼락 **아랫도리** · 전봇대 밑동 · 차 **바퀴**
   얼굴도 하늘도 안 보인다. 그게 이 방의 사정이다.
============================================================ */
const PAL_B = {
  walkD: 0x8d8a84, walkN: 0x2a2932,      // 보도블록
  kerbD: 0x9c9891, kerbN: 0x30303a,      // 경계석 옆면
  roadD: 0x55535a, roadN: 0x1b1b24,      // 아스팔트
  lineD: 0xb9a25e, lineN: 0x3b3730,      // 차선(빛바랜 노랑)
  holeD: 0x3b3a40, holeN: 0x141419,      // 맨홀
  wallD: 0x8a8378, wallN: 0x272631,      // 건너편 담
  baseD: 0x6d675e, baseN: 0x1f1e27,      // 담 기단
  poleD: 0x7d7a74, poleN: 0x26262e,      // 전봇대
  carD:  0x6b7480, carN:  0x212430,      // 차체
  tireD: 0x2e2e33, tireN: 0x131317,      // 타이어
  acD:   0x9a978f, acN:   0x2c2c34,      // 실외기
  potD:  0x8a6a56, potN:  0x2a2229,      // 담 밑 화분
  lampD: 0x8f8b83, lampN: 0x3a3730,      // 가로등 기둥
  glowE: 0x55535a, glowEN: 0x24222a,     // 불빛 자국 가장자리(=길색)
  glowC: 0x5a5860, glowCN: 0x6a5a3c,     // 한가운데 (낮엔 길색과 거의 같다)
  skinD: 0x5c5a5e, skinN: 0x24242c       // 지나가는 사람 — 실루엣만
};

function buildBasement(B, W, seed) {
  const R = rng(seed);
  const gy = W.gy, U = W.U;
  const P = PAL_B;
  const WALK = 0.85;                 // 창 앞 보도 폭
  const FARW = W.roadT;              // 건너편 보도 시작
  /* ★ 좌우로 넉넉히 편다 — 카메라가 45° 로 틀어 서므로 좁게 자르면 **길 끝이 보인다.**
     찍어 보니 담벼락과 길의 왼쪽 끝이 화면 안에 들어와 있었다. 평면은 삼각형 2개라
     넓히는 값이 공짜다. 반대로 세로(높이)는 함부로 못 늘린다 — 지붕 너머로 넘어온다.

     ★★ 2026-08-15 밤 — **아직 짧았다.** 3.2·5.0 으로도 길 끝이 화면 안에 들어온다.
       PC 가로(1280×800)에서 방위를 틀어(az −0.9rad · 상하각 19°) 찍으니
       ① 길·보도가 담보다 **먼저 끝나** 담벼락이 땅 없이 떠 있고
       ② 그 끊긴 자리가 허공에 뾰족한 모서리로 남는다.
       세 겹의 폭이 3.2U < 5.0U < 9.0U(먼 겹 FW) 로 계단져 있던 것이 원인이다.
       ⇒ **가까운 겹 두 폭을 먼 겹(9.0U)에 맞춰 올린다.** 길이 담보다 넓어야
         "담 밑에 땅이 있다"가 어느 각에서나 성립한다.
       ⚠ 늘려도 삼각형·드로우콜은 **한 개도 안 는다**(전부 slab/box 하나짜리다).
         찍어서 확인했다 — 창밖 삼각형 846 · 드로우콜 2 로 전후가 같다.
       ⚠ 깊이(t)는 손대지 않았다. 골목 폭 3.45m 는 그대로다 — 넓히면 하늘이 보인다. */
  const G = U * 7.0;                 // 길·보도 폭
  const GW = U * 8.2;                // 담벼락 폭(길보다 더 넓게)

  /* ★ 건너편 담 — 제일 먼저 세운다. 이게 이 그림의 **지평선**이다.
     담이 낮으면 그 위로 아무것도 없는 배경이 보이고, 그러면 그림이 흐트러진다.
     담을 사람 키보다 높이 세워 위를 막으면 화면이 정리되고, 동시에
     "하늘이 안 보인다 → 그래서 어둡다"가 그림으로 성립한다.
     넓이는 방보다 넉넉히 — 45° 로 틀어 봐도 담 끝이 안 보이게 한다. */
  B.haze(W.wallT);
  B.box(-GW, GW, gy + 0.10, W.wallTop, W.wallT, W.wallT + 0.34,
        shade(P.wallD, 0.82), P.wallD, shade(P.wallN, 0.86), P.wallN);
  /* 기단 — 담 밑 물때 낀 시멘트 띠. 이게 있어야 '벽'이 아니라 '담'으로 읽힌다 */
  B.box(-GW, GW, gy + 0.08, gy + 0.52, W.wallT - 0.05, W.wallT + 0.38,
        P.baseD, P.baseD, P.baseN, P.baseN);
  /* 담에 난 세로 얼룩 — 러프하게. 단색 벽 하나면 판때기로 보인다 */
  for (let i = 0; i < 7; i++) {
    const u = -U * 1.3 + U * 2.6 * R();
    const h = 0.35 + R() * 0.95;
    B.quad([u, gy + 0.52, W.wallT - 0.055], [u + 0.09 + R() * 0.14, gy + 0.52, W.wallT - 0.055],
           [u + 0.09 + R() * 0.14, gy + 0.52 + h, W.wallT - 0.055], [u, gy + 0.52 + h, W.wallT - 0.055],
           shade(P.wallD, 0.88), shade(P.wallN, 0.93));
  }

  /* 창 앞 보도 — 지면이 창턱 높이다. 화면에서 눈높이에 길바닥이 있다. */
  B.haze(0.4).slab(-G, G, 0.00, WALK, gy + 0.12, P.walkD, P.walkN);
  for (let i = 0; i < 8; i++) {                 // 보도블록 줄눈
    const u = -U + (U * 2) * (i + 0.5) / 8;
    B.slab(u - 0.025, u + 0.025, 0.04, WALK - 0.03, gy + 0.121,
           shade(P.walkD, 0.86), shade(P.walkN, 0.9));
  }
  B.haze(WALK).quad([-G, gy, WALK], [G, gy, WALK],
                    [G, gy + 0.12, WALK], [-G, gy + 0.12, WALK], P.kerbD, P.kerbN);

  /* 차도 */
  B.haze(2.2).slab(-G, G, WALK, FARW, gy, P.roadD, P.roadN);
  /* 끊어진 중앙선 — 위에서 내려다보는 화면이라 이 한 줄이 '길'이라고 말해 준다 */
  for (let i = 0; i < 5; i++) {
    const u = -U * 1.1 + (U * 2.2) * i / 4.6;
    B.slab(u, u + 0.72, (WALK + FARW) / 2 - 0.05, (WALK + FARW) / 2 + 0.05, gy + 0.004,
           P.lineD, P.lineN);
  }
  B.haze(1.9).pool(-U * 0.05, WALK + 0.55, 0.30, gy + 0.005,
                   P.holeD, P.holeN, shade(P.holeD, 1.2), shade(P.holeN, 1.2), 8);

  /* 건너편 보도 */
  B.haze(FARW).slab(-G, G, FARW, W.wallT, gy + 0.12, P.walkD, P.walkN);

  /* 주차된 차 — 건너편 쪽에 붙여 댄다.
     ★ 카메라가 16~54° **위**라 지붕이 보인다. 그래서 지붕까지 만든다.
       처음엔 "창으로는 바퀴만 보이니 지붕은 안 만든다"고 뒀는데, 찍어 보니
       화면의 절반은 지붕에서 내려다본 그림이었다. 안 만들면 납작한 상자가 된다. */
  const cLen = 4.0, cu0 = -cLen / 2 - 0.2, cu1 = cLen / 2 - 0.2;
  const ct0 = FARW - 1.85, ct1 = FARW - 0.15;
  B.haze(2.4);
  B.box(cu0, cu1, gy + 0.30, gy + 0.76, ct0, ct1, shade(P.carD, 1.10), P.carD,
        shade(P.carN, 1.10), P.carN);                                     // 차체
  B.box(cu0 + 0.95, cu1 - 1.10, gy + 0.76, gy + 1.18, ct0 + 0.16, ct1 - 0.16,
        shade(P.carD, 1.22), shade(P.carD, 0.78), shade(P.carN, 1.18), shade(P.carN, 0.82)); // 캐빈
  B.box(cu0 + 0.10, cu1 - 0.10, gy + 0.22, gy + 0.32, ct0 + 0.04, ct1 - 0.04,
        shade(P.carD, 0.70), shade(P.carD, 0.70), shade(P.carN, 0.74), shade(P.carN, 0.74)); // 스커트
  /* 바퀴 넷 — ★ 축은 길을 **가로지른다**('t'). 2026-08-15 박사님이 화면 보고 짚으심.
     예전엔 축이 길 방향('u')이라 원판이 차 앞뒤 얼굴에 붙었다 — 굴러가는 방향이 90° 틀렸고
     화면에서는 차체에서 삐져나온 까만 탭 둘로 보였다. 그리고 **두 개뿐**이었다.
     ⚠ 마감면은 **바깥쪽**에 붙인다(가까운 쪽 바퀴는 −t 가 바깥이라 capLow=true).
       안 그러면 위에서 내려다볼 때 바퀴 안이 뚫려 보인다. */
  for (const wu of [cu0 + 0.78, cu1 - 0.78])
    for (const [wt, capLow] of [[ct0 + 0.12, true], [ct1 - 0.12, false]])
      B.prism(wu, gy + 0.30, wt, 0.30, 0.22, 10, 't', P.tireD, P.tireN, capLow);

  /* 전봇대 — 창 앞 보도. 창으로는 밑동만 보이고, 위에서는 기둥이 보인다.
     ★ 2026-08-15 — 키를 2.5m 에서 **9m** 로 올렸다. 참고 사진의 뒷골목은 전봇대와 전선이
       화면을 가로지르는 그림이고, 2.5m 짜리는 창턱 위로 겨우 1m 올라와 아무것도 아니었다.
       위로 올려도 방을 안 덮는다 — 전봇대는 **가늘다.** 방을 덮는 것은 넓은 면이지 높이가
       아니다(머리글 ★★). 화면 위끝(수평 아래 30°)을 넘는 윗동아리는 화각이 알아서 자른다. */
  B.haze(0.6);
  const POLE_H = 9.0;
  B.prism(U * 0.72, gy + 0.12, 0.48, 0.10, POLE_H, 6, 'y', P.poleD, P.poleN);
  B.box(U * 0.72 - 0.16, U * 0.72 + 0.16, gy + 0.12, gy + 0.28, 0.48 - 0.16, 0.48 + 0.16,
        shade(P.poleD, 1.06), P.poleD, shade(P.poleN, 1.06), P.poleN);
  /* 완목(십자 가로대) 둘 — 전선이 매달릴 자리. 이것 하나로 '전봇대'가 된다 */
  for (const [dy, hw] of [[POLE_H - 0.55, 0.62], [POLE_H - 1.30, 0.48]])
    B.box(U * 0.72 - 0.055, U * 0.72 + 0.055, gy + 0.12 + dy, gy + 0.12 + dy + 0.09,
          0.48 - hw, 0.48 + hw, shade(P.poleD, 1.10), P.poleD, shade(P.poleN, 1.10), P.poleN);

  /* 가로등 — ★ 진짜 광원이 아니다. 밤에 생기는 자국은 아래 pool 이 **색으로만** 만든다.
     (진짜 빛을 하나 더하면 밤 밝기가 바뀌어 밸런스가 흔들린다 — 이 저장소가 겪은 일이다) */
  B.haze(0.5);
  B.prism(-U * 0.86, gy + 0.12, 0.42, 0.07, W.wallTop + 1.15 - gy, 6, 'y', P.lampD, P.lampN);
  B.haze(1.5).pool(-U * 0.86, WALK + 0.5, 1.55, gy + 0.006, P.glowE, P.glowEN, P.glowC, P.glowCN, 14);

  /* 담 밑 살림살이 — 실외기 하나, 화분 둘. 사람이 사는 골목으로 읽히게 */
  B.haze(W.wallT);
  B.box(1.15, 1.87, gy + 0.12, gy + 0.62, W.wallT - 0.36, W.wallT - 0.03,
        shade(P.acD, 1.08), P.acD, shade(P.acN, 1.08), P.acN);
  for (let i = 0; i < 2; i++) {
    const u = -2.15 + i * 0.44;
    B.box(u, u + 0.32, gy + 0.12, gy + 0.38, W.wallT - 0.34, W.wallT - 0.03,
          shade(P.potD, 1.12), P.potD, shade(P.potN, 1.12), P.potN);
  }
}

/* ============================================================
   ②-2  **먼 동네** — 담 너머 (반지하만) · 두 번째 드로우콜
   ------------------------------------------------------------
   머리글 ★★ 의 계산이 여기의 전부다. 상하각 49°(폰 기본)에서 화면 위끝은
   수평 아래 30° 이므로, 카메라에서 수평거리 H 인 것은 **카메라보다 0.577·H 이상 낮아야**
   화면에 든다. 방 지붕은 43°, 골목 바닥은 30~39° 에 맺힌다 —
   그 사이의 띠가 지금 **아무것도 없이 비어 있는 자리**다. 그걸 채운다.

     깊이 5~12m   건너편 빌라 줄(4~5층). 49° 에서는 **아랫도리 3m 만** 보인다 —
                  그래도 그 3m 가 지붕 위 빈 곳을 메운다. 16° 로 눕히면 통째로 보인다.
     깊이 14~22m  더 먼 실루엣. 49° 에서는 화면 위로 잘려 안 보이고,
                  낮은 각에서만 나온다. **공짜로 붙는 층이다.**
     전선         전봇대에서 좌우로. 참고 사진의 뒷골목은 이 선이 그림을 만든다.

   ⚠ 여기에 **가깝고 넓은 면**을 두면 안 된다. 그것이 방을 덮는 유일한 것이다.
     제일 앞줄(빌라)조차 담(4.15m)보다 1.4m 뒤에 세운다.
   ⚠ 에셋을 안 만든다. 전부 상자다. 4~5층은 층 띠와 창 격자 세 줄로만 말한다.
============================================================ */
const PAL_F = {
  grndD: 0x6a6870, grndN: 0x1c1c24,      // 담 뒤 땅
  bldD:  0x8b8479, bldN:  0x2a2a34,      // 빌라 면
  bld2D: 0x7d7a74, bld2N: 0x262630,      // 옆 빌라(명도를 갈라 줄이 보이게)
  roofD: 0x6e6a63, roofN: 0x222229,      // 옥상
  winD:  0x5a5f68, winN:  0x6b5c3e,      // 창 — 밤엔 몇 집만 켠다
  railD: 0x7b7770, railN: 0x252530,      // 옥상 난간
  tankD: 0x8c8378, tankN: 0x282830,      // 물탱크
  farD:  0x63626c, farN:  0x1b1b23,      // 더 먼 실루엣
  wireD: 0x3c3b42, wireN: 0x17171d       // 전선
};

function buildBasementFar(B, W, seed) {
  const R = rng(seed);
  const gy = W.gy, U = W.U;
  const P = PAL_F;
  const FW = U * 9.0;                 // 먼 것은 넓게 편다 — 45° 로 틀어도 줄 끝이 안 보이게
  const T0 = W.wallT + 0.45;          // 담 바로 뒤에서 시작

  /* ── ① 담 뒤 땅 ── 없으면 빌라가 허공에 선다. 안개를 세게 걸어 배경으로 눌러 둔다 */
  B.hazeRaw(0.74).slab(-FW, FW, T0, T0 + 26, gy - 0.02, P.grndD, P.grndN);

  /* ── ② 건너편 빌라 줄 (4~5층) ──
     ★ 층 수를 높이로 말한다. 한국 빌라 층고 2.65m + 반지하 노출 0.9m. */
  let u = -FW * 0.94;
  let k = 0;
  while (u < FW * 0.94) {
    const w = 4.2 + R() * 3.6;
    const st = 4 + (R() < 0.45 ? 1 : 0);            // 4층 또는 5층
    const h = 0.9 + st * 2.65;                      // 11.5 ~ 14.15
    const t0 = T0 + 0.9 + R() * 1.8;
    const dp = 5.0 + R() * 3.0;
    const face = k % 2 ? P.bld2D : P.bldD, faceN = k % 2 ? P.bld2N : P.bldN;
    B.hazeRaw(0.64 + R() * 0.08);
    B.box(u, u + w, gy, gy + h, t0, t0 + dp, P.roofD, face, P.roofN, faceN);
    /* 층 띠 — 4~5층이라고 말하는 유일한 단서다 */
    for (let s = 1; s <= st; s++) {
      const y = gy + 0.9 + s * 2.65;
      if (y > gy + h) break;
      B.quad([u, y, t0 - 0.012], [u + w, y, t0 - 0.012],
             [u + w, y + 0.10, t0 - 0.012], [u, y + 0.10, t0 - 0.012],
             shade(face, 0.84), shade(faceN, 0.90));
    }
    /* 창 — 층마다 세 짝. 멀어서 무늬는 안 읽히므로 개수만 맞춘다.
       밤에 다 켜면 배경이 방보다 밝아진다. 세 집에 한 집만 켠다. */
    for (let s = 0; s < st; s++) for (let c = 0; c < 3; c++) {
      const wx = u + w * (0.16 + c * 0.30);
      const wy = gy + 1.35 + s * 2.65;
      if (wy + 1.05 > gy + h) continue;
      B.quad([wx, wy, t0 - 0.02], [wx + w * 0.18, wy, t0 - 0.02],
             [wx + w * 0.18, wy + 1.05, t0 - 0.02], [wx, wy + 1.05, t0 - 0.02],
             P.winD, R() < 0.32 ? P.winN : shade(faceN, 0.66));
    }
    /* 옥상 난간과 물탱크 — 49° 에서는 화면 위로 잘려 안 보인다.
       각을 낮췄을 때(16°) 옥상선이 밋밋하지 않게 하는 값이다. */
    B.quad([u, gy + h, t0 - 0.01], [u + w, gy + h, t0 - 0.01],
           [u + w, gy + h + 0.55, t0 - 0.01], [u, gy + h + 0.55, t0 - 0.01], P.railD, P.railN);
    if (R() < 0.55) {
      const tu = u + w * (0.25 + R() * 0.4);
      B.box(tu, tu + 0.9, gy + h, gy + h + 1.15, t0 + 0.9, t0 + 1.8,
            shade(P.tankD, 1.08), P.tankD, shade(P.tankN, 1.08), P.tankN);
    }
    u += w + 0.5 + R() * 1.5;
    k++;
  }

  /* ── ③ 더 먼 실루엣 ── 49° 에서는 화면 위로 잘려 안 보인다.
     각을 낮추면(하늘이 보이는 각) 그때 나온다 — 깊이가 한 층 생긴다. */
  B.hazeRaw(0.90);
  for (let i = 0; i < 9; i++) {
    const bw = 5.0 + R() * 7.0;
    const bu = -FW * 0.95 + (FW * 1.9) * (i + R() * 0.6) / 9;
    const bh = 6.0 + R() * 6.0;
    const bt = T0 + 13.0 + R() * 7.0;
    B.box(bu, bu + bw, gy, gy + bh, bt, bt + 3.0, P.farD, P.farD, P.farN, P.farN);
  }

  /* ── ④ 전선 ── 전봇대 완목에서 좌우로. 위에서 내려다보므로 **납작한 띠**로 깐다 —
     세운 판때기로 만들면 각도에 따라 사라진다(면이 시선과 나란해진다). */
  /* ★ 높이가 6.2~6.5m 인 데는 이유가 있다 — **두 각에서 다 보이는 띠**가 거기뿐이다.
     상하각 49°(폰 기본)에서는 카메라가 17.6m 위에 있어 y ≤ 7.85m 만 화면에 들고,
     16°(제일 낮게 눕힌 각)에서는 카메라가 7.9m 라 y ≤ 8.75m 까지 든다.
     처음에 8.5m 에 걸었더니 **낮은 각에서 화면 위로 사라졌다**(찍어 보고 내렸다).
     전봇대는 9m 그대로 둔다 — 윗동아리가 잘려 나가는 것이 오히려 높아 보인다. */
  B.hazeRaw(0.34);
  const PU = U * 0.72;
  for (const [dt, dy] of [[-0.44, 6.50], [-0.16, 6.46], [0.30, 6.20], [0.58, 6.16]]) {
    const t = 0.48 + dt, y = gy + 0.12 + dy;
    B.slab(-FW * 0.8, PU, t - 0.028, t + 0.028, y, P.wireD, P.wireN);
    B.slab(PU, FW * 0.8, t - 0.028, t + 0.028, y - 0.06, P.wireD, P.wireN);   // 반대쪽은 조금 처진다
  }
}

/* ============================================================
   ③  동네 — 지상층(원룸)
   ------------------------------------------------------------
   같은 코드로 같은 그림을 그리면 이사한 보람이 없다.
   창턱이 낮으니 **길이 저 아래**에 있고 **하늘이 보인다.**
   빛이 왜 나아졌는지가 화면에 있어야 한다.
============================================================ */
const PAL_O = {
  skyD: 0x8e9db0, skyN: 0x1a1c2b,
  farD: 0x6f7686, farN: 0x1e202c,        // 먼 지붕들
  bldD: 0x9a9086, bldN: 0x2a2833,        // 건너편 건물 면
  winD: 0x5f6672, winN: 0x6a5c3e,        // 그 건물 창 — 밤엔 켜진 색
  roofD: 0x7d6a5c, roofN: 0x232028,
  roadD: 0x5b5960, roadN: 0x1c1c25,
  walkD: 0x8f8c86, walkN: 0x2a2932,
  treeD: 0x5c6d52, treeN: 0x1d2224,
  trunkD: 0x6a5a4a, trunkN: 0x201d24,
  carD: 0x707a86, carN: 0x22252f,
  lampD: 0x8a867e, lampN: 0x3a3730,
  glowE: 0x5b5960, glowEN: 0x24222a,
  glowC: 0x605e66, glowCN: 0x6d5d3e
};

function buildAbove(B, W, seed) {
  const R = rng(seed);
  const gy = W.gy, U = W.U;
  const P = PAL_O;

  const G = U * 3.4;                 // 길 폭 — 45° 로 틀어도 끝이 안 보이게
  const SKYW = U * 6.0;              // 하늘 폭

  /* 하늘 — 제일 멀리 세운 판 하나. ★ 이것만은 넓다.
     "하늘이 보인다"가 이 방의 자랑이라 창을 통해 보이는 것이 하늘이어야 한다.
     그래도 방보다 앞에 나서면 안 되므로 채도를 죽이고 배경색 쪽으로 크게 당긴다. */
  B.hazeRaw(0.58).quad([-SKYW, gy, W.skyT], [SKYW, gy, W.skyT],
                       [SKYW, gy + 16, W.skyT], [-SKYW, gy + 16, W.skyT], P.skyD, P.skyN);

  /* 먼 지붕들 — 실루엣만. 하늘 앞에 층을 하나 넣으면 깊이가 산다.
     ★ 방 지붕(2.5) 위로 올라오지 않게 눌러 둔다. 카메라가 위에서 내려다보므로
       그 위로 넘어오는 것은 죄다 "방 뒤에 떠 있는 상자"로 보인다(찍어 보고 잘라 냈다). */
  B.hazeRaw(0.50);
  for (let i = 0; i < 8; i++) {
    const u = -SKYW * 0.8 + SKYW * 1.6 * (i + R() * 0.5) / 8;
    const w = 1.6 + R() * 3.0, h = 2.2 + R() * 3.0;
    const t = W.skyT - 5 - R() * 4;
    B.box(u, u + w, gy, Math.min(gy + h, W.capY), t, t + 0.8, P.farD, P.farD, P.farN, P.farN);
  }

  /* 건너편 건물 — 창 격자만으로 건물로 읽힌다.
     ★ 위쪽은 자른다. 창으로 보면 "위가 안 보일 만큼 큰 건물"이고, 방 뷰에서는
       지붕 선 위로 안 넘어온다. 하나로 두 그림을 다 만든다. */
  const bTop = W.capY;
  B.haze(W.bldT);
  B.box(-G, G, gy, bTop, W.bldT, W.bldT + 0.7, shade(P.bldD, 0.88), P.bldD,
        shade(P.bldN, 0.9), P.bldN);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
    const u = -G * 0.92 + (G * 1.84) * (c + 0.30) / 7;
    const y = gy + 1.0 + r * 1.30;
    if (y + 0.75 > bTop - 0.2) continue;
    /* 밤에 몇 집만 켠다 — 다 켜면 배경이 방보다 밝아진다 */
    const on = R() < 0.30;
    B.quad([u, y, W.bldT - 0.02], [u + 0.58, y, W.bldT - 0.02],
           [u + 0.58, y + 0.75, W.bldT - 0.02], [u, y + 0.75, W.bldT - 0.02],
           P.winD, on ? P.winN : shade(P.bldN, 0.62));
  }

  /* 길 — 창턱보다 3.6m 아래. 창에 붙어 내려다봐야 보인다.
     반지하는 이 길이 **눈높이**에 있었다. 그 차이가 이사한 값이다. */
  B.haze(4.0).slab(-G, G, 1.1, W.bldT, gy, P.roadD, P.roadN);
  B.haze(2.0).slab(-G, G, 1.1, 2.6, gy + 0.13, P.walkD, P.walkN);
  B.haze(W.bldT).slab(-G, G, W.bldT - 2.3, W.bldT, gy + 0.13, P.walkD, P.walkN);
  const mid = (2.6 + W.bldT - 2.3) / 2;
  for (let i = 0; i < 6; i++) {
    const u = -G * 0.9 + (G * 1.8) * i / 5.4;
    B.slab(u, u + 1.1, mid - 0.06, mid + 0.06, gy + 0.004, P.lineD, P.lineN);
  }

  /* 가로등 — 기둥 + 밤 자국. ★ 여기서도 진짜 광원은 없다. 바닥에 칠한 색뿐이다. */
  B.haze(2.4);
  B.prism(U * 0.35, gy + 0.13, 2.3, 0.075, 3.6, 6, 'y', P.lampD, P.lampN);
  B.box(U * 0.35 - 0.05, U * 0.35 + 0.5, gy + 3.66, gy + 3.78, 2.24, 2.36,
        P.lampD, P.lampD, P.glowCN, P.glowCN);
  B.pool(U * 0.35 + 0.45, 2.3, 2.4, gy + 0.006, P.glowE, P.glowEN, P.glowC, P.glowCN, 14);
}

/* ============================================================
   ④  지나가는 발  (반지하만)
   ------------------------------------------------------------
   ★ 이 게임은 **바뀔 때만 그린다**(room_view.js:2294 needsRender).
     배경이 계속 움직이면 그 절약이 통째로 사라진다. 그래서 규칙을 하나 세웠다:
       **절대로 다시 그려 달라고 하지 않는다.**
     이미 그리고 있는 프레임에 얹혀서만 움직인다(onBeforeRender 안에서 시간을 잰다).
     그러니 방이 노는 동안에는 발도 안 움직인다 — 화면이 어차피 안 바뀌니 손해가 없다.
     노는 화면 fps 는 1장도 안 는다. 재서 확인했다(보고서 ④).
   발은 위 기하와 **같은 버퍼**에 들어 있다. 움직일 땐 그 구간의 좌표만 다시 쓴다 —
   드로우콜도 재질도 안 는다. 안 걸을 땐 한 점으로 접어 둔다(픽셀 0).
============================================================ */
const WALKER_QUADS = 6;                       // 다리 2 × 앞뒤 1 + 발 2 + 그림자 1
const WALK_EVERY = [22, 52];                  // 이 사이 간격[s] 으로 한 번
const WALK_SECS = 3.2;                        // 지나가는 데 걸리는 시간
const WALK_WARMUP = 8;                        // 이만큼 연속으로 그리고 있어야 시작한다

function walkerSlots(B, W) {
  /* 자리만 잡아 둔다 — 처음엔 접혀 있다(전부 같은 점) */
  const start = B.mark();
  const P = PAL_B;
  for (let i = 0; i < WALKER_QUADS; i++)
    B.hazeRaw(0.18).quad([0, W.gy, 0.5], [0, W.gy, 0.5], [0, W.gy, 0.5], [0, W.gy, 0.5],
                         P.skinD, P.skinN);
  return { start, count: B.mark() - start };
}

/* ============================================================
   ⑤  붙이기
============================================================ */

/* 제일 큰 벽창을 고른다 — room_view.js:566 windowAzimuth 와 같은 기준이다.
   카메라가 마주 보는 그 창 뒤에 동네가 있어야 한다. */
function biggestWindow(built) {
  const ws = (built.luxWins || []).filter(w => w.wall && w.wall !== 'ceiling');
  if (!ws.length) return null;
  let big = ws[0], area = -1;
  for (const w of ws) { const a = (w.w || 0) * (w.h || 0); if (a > area) { area = a; big = w; } }
  return big;
}

/* 창 기준 국소계 → 월드. 벽마다 밖으로 나가는 방향이 다르다.
   (house.js:113 wallPlacement 과 같은 벽 규약을 쓴다) */
function frameFor(wall, cu, size) {
  const half = { back: size.d / 2, front: size.d / 2, left: size.w / 2, right: size.w / 2 }[wall];
  const N = { back: [0, 0, -1], front: [0, 0, 1], left: [-1, 0, 0], right: [1, 0, 0] }[wall];
  if (!N) return null;
  /* r = n × up — 벽을 따라가는 방향 */
  const r = [N[1] * 0 - N[2] * 1, N[2] * 0 - N[0] * 0, N[0] * 1 - N[1] * 0];
  const o = [N[0] * half, 0, N[2] * half];
  /* 창 중심(cu)만큼 벽을 따라 민다 */
  o[0] += r[0] * cu; o[2] += r[2] * cu;
  return (u, y, t) => [o[0] + r[0] * u + N[0] * t, y, o[2] + r[2] * u + N[2] * t];
}

/**
 * 창밖 동네를 세운다.
 * @param {object} ctx      room_view 의 렌더 컨텍스트 (createScene 결과). scene 만 쓴다.
 * @param {object} built    buildHouse 결과 — size 와 luxWins 만 읽는다. **안 고친다.**
 * @param {string} roomId   방 id (되풀이 난수 씨앗으로만 쓴다)
 * @param {function} dayGet () => daylightT (0..1). 없으면 낮으로 둔다.
 * @returns {object|null}   { dispose, stats } · 창이 없으면 null
 */
export function attachOutside(ctx, built, roomId, dayGet) {
  if (typeof THREE === 'undefined') return null;          // Node 에서 부르면 조용히 아무것도 안 한다
  const scene = ctx && ctx.scene;
  if (!scene || !built || !built.size) return null;

  /* 이전 방 것을 먼저 치운다 — room_view 는 houseGroup 만 비우고 여기는 안 건드린다 */
  const old = _mounted.get(scene);
  if (old) { try { old.dispose(); } catch (e) { /* 치우다 난 오류로 새 방을 못 세우면 안 된다 */ } }
  _mounted.delete(scene);

  const win = biggestWindow(built);
  if (!win) return null;
  const toWorld = frameFor(win.wall, win.cu || 0, built.size);
  if (!toWorld) return null;

  const sill = (win.cy || 0) - (win.h || 0) / 2;
  const head = (win.cy || 0) + (win.h || 0) / 2;
  const roomH = built.size.h;

  /* ★ 반지하인가 — 창턱이 방 높이의 절반을 넘으면 그 방은 땅에 묻힌 것이다.
     banjiha 1.495/2.3 = 0.65 · oneroom 0.775/2.5 = 0.31. 두 방이 확실히 갈린다. */
  const basement = sill / roomH > 0.5;

  const U = Math.max(built.size.w / 2 + 0.9, (win.w || 2) / 2 + 2.2);
  const W = basement
    /* ★ 골목은 **좁다**. 넓게 잡으면 창으로 하늘이 보이고, 그러면 이 방이
       어두운 이유가 사라진다. 차 한 대 대면 꽉 차는 3.5m 다. */
    ? { gy: sill - 0.06, U, roadT: 3.45, wallT: 4.15,
        /* 담 높이 — 지면에서 1.95m. 사람 키보다 높아야 "하늘이 안 보인다"가 된다.
           방 지붕(2.3)보다 위로 넘어오지만 그건 **판판한 한 면**이라 그림을 어지럽히지
           않는다. 오히려 지평선이 되어 정리해 준다(찍어 보고 이렇게 정했다).
           반대로 차·전봇대 같은 덩어리는 지붕 너머로 나오면 어지럽다 — 담 아래로 눌러 둔다. */
        wallTop: sill - 0.06 + 1.95 }
    : { gy: sill - 3.6,                 /* 2층 — 층고 2.8 + 창턱 0.8 */
        U, roadT: 9.5, bldT: 9.5, skyT: 26,
        /* ★ 지상층 방은 위로 세울 것이 많다(건물·지붕). 그런데 카메라가 방 **위에서**
           내려다보므로, 방 천장보다 높은 것은 지붕 너머로 넘어와 화면을 어지럽힌다.
           그래서 세로를 여기서 한 번에 자른다. 창으로 보면 "위가 안 보이는 큰 건물"이
           되고, 방 뷰에서는 지붕 선에 딱 맞는다 — 하나로 두 그림을 다 만든다. */
        capY: roomH - 0.06 };

  const B = makeBuilder(toWorld);
  /* 씨앗은 방 이름에서 뽑는다 — 같은 방은 언제 열어도 같은 동네여야 한다 */
  let s = 0;
  const rid = String(roomId || 'room');
  for (let i = 0; i < rid.length; i++) s = (s * 31 + rid.charCodeAt(i)) >>> 0;
  if (basement) buildBasement(B, W, s + 7); else buildAbove(B, W, s + 7);

  const walker = basement ? walkerSlots(B, W) : null;

  /* ── 먼 동네는 **따로 쌓는다** ──
     같은 버퍼에 넣으면 통째로만 켜고 끌 수 있다. 겹을 나눠야 「가까운 것은 두고
     먼 것만 끄기」가 된다(카메라가 창 벽 바깥으로 돌 때 이 구분이 필요하다). */
  const BF = basement ? makeBuilder(toWorld) : null;
  if (BF) buildBasementFar(BF, W, s + 23);

  /* ★ 재질 하나. 빛을 안 받는다(MeshBasic) — 방 조명이 창밖을 밝히지 못한다.
     toneMapped 는 기본(true) 그대로 둔다. 방과 같은 노출·톤매핑을 지나야
     창밖만 붕 뜨지 않는다(GAME_EXPOSURE 0.72 아래에서 색을 골랐다).
     ★ 겹이 둘이어도 재질은 **하나를 나눠 쓴다** — 재질 개수는 안 는다. */
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, fog: false, depthWrite: true
  });

  /* 겹 하나를 메시로 만든다. 낮/밤 색표를 들고 있다가 applyDay 가 섞어 넣는다. */
  function layerOf(bld, name) {
    const n = bld.pos.length / 3;
    if (!n) return null;
    const posArr = new Float32Array(bld.pos);
    const colDay = new Float32Array(bld.colD);
    const colNight = new Float32Array(bld.colN);
    const colLive = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    const aPos = new THREE.BufferAttribute(posArr, 3);
    const aCol = new THREE.BufferAttribute(colLive, 3);
    /* 낮밤(색)과 지나가는 발(좌표)만 다시 올린다 — 자주 바뀐다고 드라이버에 알려 준다 */
    if (THREE.DynamicDrawUsage != null) { aPos.setUsage(THREE.DynamicDrawUsage); aCol.setUsage(THREE.DynamicDrawUsage); }
    geo.setAttribute('position', aPos);
    geo.setAttribute('color', aCol);
    /* ★ 법선을 안 만든다 — MeshBasicMaterial 은 법선을 안 쓴다. 버퍼가 1/3 준다. */
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.frustumCulled = false;      // updateMatrixWorld 를 놓치지 않게 (물체 둘이라 비용 없음)
    m.matrixAutoUpdate = false;
    m.castShadow = false;         // ★ 켜면 해 그림자맵에 들어가 방이 실제로 어두워진다
    m.receiveShadow = false;
    /* ★ 탭 판정에서 빼낸다. room_view 의 줍기는 built.room·화분·가구로 범위가 좁아
       원래도 안 걸리지만, 나중에 누가 범위를 넓혀도 창밖이 손가락을 먹으면 안 된다. */
    m.raycast = () => {};
    m.userData.decorative = true;
    scene.add(m);
    return { mesh: m, geo, posArr, colDay, colNight, colLive, tris: bld.tris(), verts: n };
  }

  const near = layerOf(B, '__outside');
  if (!near) { mat.dispose(); return null; }
  const far = BF ? layerOf(BF, '__outside_far') : null;
  const mesh = near.mesh, geo = near.geo, posArr = near.posArr;
  const layers = far ? [near, far] : [near];

  /* ── 낮밤 ── */
  let lastK = -1;
  function applyDay(k) {
    if (Math.abs(k - lastK) < 0.004) return;
    lastK = k;
    for (const L of layers) {
      for (let i = 0; i < L.colLive.length; i++)
        L.colLive[i] = L.colNight[i] + (L.colDay[i] - L.colNight[i]) * k;
      L.geo.attributes.color.needsUpdate = true;
    }
  }
  const dayK = () => {
    const t = dayGet ? clamp(+dayGet() || 0, 0, 1) : 0.5;
    return Math.min(smooth(DAWN0, DAWN1, t), 1 - smooth(DUSK0, DUSK1, t));
  };
  applyDay(dayK());

  /* ── 지나가는 발 ── */
  const wk = walker ? { t0: 0, on: false, next: 6, live: 0, dir: 1, seedR: rng(s + 91) } : null;
  let lastNow = 0;

  function foldWalker() {
    if (!walker) return;
    const p = posArr, o = walker.start * 3;
    for (let i = 0; i < walker.count * 3; i++) p[o + i] = p[o + (i % 3)];
    geo.attributes.position.needsUpdate = true;
  }
  if (walker) foldWalker();

  /* 발 한 켤레를 그린다. 얼굴은 없다 — 반지하 창으로는 종아리까지만 보인다. */
  function drawWalker(prog, dir) {
    const p = posArr;
    let o = walker.start * 3;
    const put = (u, y, t) => { const w = toWorld(u, y, t); p[o++] = w[0]; p[o++] = w[1]; p[o++] = w[2]; };
    const quad = (a, b, c, d) => { put(...a); put(...b); put(...c); put(...a); put(...c); put(...d); };

    const span = W.U * 2 + 1.6;
    const u0 = dir > 0 ? -W.U - 0.8 : W.U + 0.8;
    const cu = u0 + dir * span * prog;
    const t = 0.62;                                  // 보도 위를 걷는다
    const gy = W.gy + 0.12;
    const ph = prog * span / 0.72 * Math.PI;         // 보폭 0.72m
    const sw = Math.sin(ph) * 0.30, sw2 = Math.sin(ph + Math.PI) * 0.30;
    const LH = 0.78, LW = 0.115;                     // 종아리 길이·굵기

    for (const [dx, lean] of [[sw, sw], [sw2, sw2]]) {
      /* 다리 — 위는 제자리, 아래가 앞뒤로 흔들린다 */
      quad([cu + dx - LW, gy, t], [cu + dx + LW, gy, t],
           [cu + LW, gy + LH, t], [cu - LW, gy + LH, t]);
      /* 발 */
      quad([cu + dx - LW, gy, t], [cu + dx + LW + 0.10 * Math.sign(lean || 1), gy, t],
           [cu + dx + LW + 0.10 * Math.sign(lean || 1), gy + 0.055, t],
           [cu + dx - LW, gy + 0.055, t]);
    }
    /* 발밑 그림자 — 바닥에 붙인 납작한 판 하나 */
    quad([cu - 0.30, gy + 0.003, t - 0.16], [cu + 0.30, gy + 0.003, t - 0.16],
         [cu + 0.30, gy + 0.003, t + 0.16], [cu - 0.30, gy + 0.003, t + 0.16]);
    geo.attributes.position.needsUpdate = true;
  }

  /* ★★ 왜 onBeforeRender 가 아니라 updateMatrixWorld 인가 (2026-08-05 · 찍어 보고 알았다)
     r128 의 그리기 차례는 이렇다:
       render() → scene.updateMatrixWorld() → projectObject() **여기서 정점 버퍼를 올린다**
                → renderObject() → object.onBeforeRender() → 실제 그리기
     onBeforeRender 에서 색을 바꾸면 **이미 올라간 뒤**라 한 프레임 늦게 반영된다.
     이 게임은 바뀔 때만 그리므로 "다음 프레임"이 영영 안 오는 일이 흔하다 —
     실제로 낮/밤 스크린샷의 창밖 색이 서로 뒤바뀌어 나왔다(밤에 창밖이 더 밝았다).
     updateMatrixWorld 는 버퍼를 올리기 **전**에 불린다. 그래서 여기에 얹는다.

     ★ 그리는 프레임에 얹혀서만 시간이 흐른다 — **다시 그려 달라고 절대 안 한다.**
       (updateMatrixWorld 는 renderer.render 안에서만 불린다. 방이 놀면 여기도 안 돈다) */
  const _umw = THREE.Object3D.prototype.updateMatrixWorld;
  mesh.updateMatrixWorld = function (force) {
    _umw.call(this, force);
    const now = performance.now() / 1000;
    applyDay(dayK());
    if (!wk) { lastNow = now; return; }
    const dt = lastNow ? now - lastNow : 0;
    lastNow = now;
    /* 0.25초 넘게 안 그렸으면 '방이 놀고 있었다'는 뜻이다 */
    const gap = dt > 0.25 || dt <= 0;
    if (wk.on) {
      if (gap) { wk.on = false; foldWalker(); wk.next = WALK_EVERY[0]; return; }
      wk.t0 += dt;
      const prog = wk.t0 / WALK_SECS;
      if (prog >= 1) { wk.on = false; foldWalker(); wk.live = 0;
                       wk.next = WALK_EVERY[0] + wk.seedR() * (WALK_EVERY[1] - WALK_EVERY[0]); return; }
      drawWalker(prog, wk.dir);
      return;
    }
    if (gap) { wk.live = 0; return; }
    wk.live++;
    wk.next -= dt;
    if (wk.next <= 0 && wk.live > WALK_WARMUP) {
      wk.on = true; wk.t0 = 0; wk.dir = wk.seedR() < 0.5 ? 1 : -1;
    }
  };

  /* ============================================================
     카메라를 따라가는 것 — **빛이 아니라 가리기다**
     ------------------------------------------------------------
     ① 카메라가 창 벽 **바깥**으로 돌면 house.js 가 그 벽을 밑동만 남기고 감춘다.
        그때 창밖이 그대로 서 있으면 **카메라와 방 사이**에 판때기가 끼어 방을 덮는다.
        이것이 이 파일이 할 수 있는 제일 나쁜 짓이라 두 겹 다 감춘다.
        문턱 0.3 은 house.js 의 updateShellVisibility 와 같은 값이다 — 벽이 사라지는
        바로 그 순간에 같이 사라져야 한다. 여기만 다르면 한 프레임 어긋난 그림이 나온다.
     ② 그 밖에는 **끄지 않는다.** 배율로 먼 겹을 켰다 껐다 하면 줌 도중에 배경이
        나타났다 사라져 눈에 띈다. 멀리 있는 것은 화각이 알아서 자른다(머리글 ★★) —
        코드가 다시 자를 일이 없다.
  ============================================================ */
  const wallHalf = { back: built.size.d / 2, front: built.size.d / 2,
                     left: built.size.w / 2, right: built.size.w / 2 }[win.wall];
  const nx = { back: 0, front: 0, left: -1, right: 1 }[win.wall];
  const nz = { back: -1, front: 1, left: 0, right: 0 }[win.wall];
  let camOutside = false;
  function updateCamera(camPos) {
    if (!camPos) return camOutside;
    const dot = (camPos.x - nx * wallHalf) * nx + (camPos.z - nz * wallHalf) * nz;
    const out = dot >= 0.3;
    if (out !== camOutside) {
      camOutside = out;
      for (const L of layers) L.mesh.visible = !out;
    }
    return camOutside;
  }

  const handle = {
    /* 재는 도구가 쓴다 */
    stats: { triangles: B.tris() + (BF ? BF.tris() : 0), nearTriangles: B.tris(),
             farTriangles: BF ? BF.tris() : 0,
             vertices: near.verts + (far ? far.verts : 0),
             drawCalls: layers.length, materials: 1,
             basement, groundY: W.gy, sill, head, roomH, room: roomId,
             walker: !!walker },
    /* 카메라가 움직일 때마다 room_view 가 부른다. 돌려주는 값 = 지금 감춰져 있나 */
    updateCamera,
    hidden() { return camOutside; },
    /* 검사용 — 지금 낮인가(0=밤 1=낮). 게임 코드는 안 쓴다 */
    dayK,
    /* 검사용 — 지금 당장 한 번 지나가게 한다. 몇십 초를 기다릴 수 없는 도구를 위한 것이다.
       ★ 여기서도 다시 그려 달라고 하지 않는다. 부르는 쪽이 그리고 있어야 움직인다. */
    walkNow() { if (wk && !wk.on) { wk.on = true; wk.t0 = 0; wk.live = 99; wk.dir = 1; return true; } return false; },
    walking() { return !!(wk && wk.on); },
    dispose() {
      mesh.updateMatrixWorld = _umw;
      for (const L of layers) { scene.remove(L.mesh); L.geo.dispose(); }
      mat.dispose();
      if (_mounted.get(scene) === handle) _mounted.delete(scene);
    }
  };
  _mounted.set(scene, handle);
  /* 재는 도구가 밖에서 잡을 수 있게 — 게임 코드는 이걸 안 쓴다 */
  ctx.outside = handle;
  return handle;
}
