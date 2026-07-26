/* ============================================================
   render3d/character.js — 캐릭터 로드 · 이동 · 감정표현
   ------------------------------------------------------------
   assets/characters/3d 의 리깅 GLB + anim/ 의 동작 GLB를 쓴다.
     char_<id>_rigged.glb   뼈대 + 메시 (기본 자세)
     anim/char_<id>_<동작>.glb  동작 하나당 파일 하나 → 클립만 뽑아 mixer에 물린다

   조작
     바닥 클릭 → 그 지점으로 걸어감 (walking 루프 → 도착하면 idle)
     감정 버튼 → 한 번 재생하고 idle로 복귀

   ※ 조도 계산과 무관하다. 캐릭터는 차폐체로 넣지 않는다
     (움직일 때마다 격자를 다시 계산해야 해서 비싸고, 게임상 의미도 작다).
============================================================ */

/* 메시는 경량본(lq)을 쓴다 — 원본 14.3MB / 경량 2.26MB. 게임뷰엔 경량본으로 충분하다. */
const BASE  = './assets/characters/3d';
const MESH  = BASE + '/lq';
/* idle·walking 원본은 메시를 통째로 다시 담고 있어 14MB씩이라
   tools/strip_anim_glb.py 로 클립만 뽑아 70KB/35KB로 줄인 파생본을 쓴다.
   (원본 assets/characters 는 캐릭 작업창 담당이라 읽기만 한다) */
const CLIPS = './assets/derived/char_clips';

/* 감정·동작 — anim/ 에 있는 16종 중 UI에 낼 것들 */
export const EMOTES = [
  { id: 'wave',      ko: '인사',   loop: false },
  { id: 'heart',     ko: '하트',   loop: false },
  { id: 'happyjump', ko: '기뻐',   loop: false },
  { id: 'cheer',     ko: '환호',   loop: false },
  { id: 'nod',       ko: '끄덕',   loop: false },
  { id: 'inspect',   ko: '살펴봄', loop: false },
  { id: 'repot',     ko: '분갈이', loop: false },
  { id: 'harvest',   ko: '수확',   loop: false },
  { id: 'pickup',    ko: '줍기',   loop: false },
  { id: 'scratch',   ko: '갸웃',   loop: false },
  { id: 'listen',    ko: '귀기울임', loop: false },
  { id: 'opendoor',  ko: '문열기', loop: false },
  { id: 'harvest_crouch', ko: '쪼그려수확', loop: false },
  { id: 'sit',       ko: '앉기',   loop: true  },
  { id: 'doze',      ko: '졸기',   loop: true  },
  { id: 'sleep',     ko: '자기',   loop: true  }
];

export const CHARACTERS = [
  { id: 'jachwi_f',          ko: '자취녀' },
  { id: 'namja_jachwi',      ko: '자취남' },
  { id: 'yeoja_gajang',      ko: '여자 가장' },
  { id: 'namja_gajang',      ko: '남자 가장' },
  { id: 'yeoja_jubu',        ko: '주부(여)' },
  { id: 'namja_jubu',        ko: '주부(남)' },
  { id: 'yeoja_researcher',  ko: '연구자(여)' },
  { id: 'namja_researcher',  ko: '연구자(남)' }
];

let loader = null;
function gltf() {
  if (!loader) {
    if (!THREE.GLTFLoader) throw new Error('GLTFLoader 미로드 — index.html의 script 태그 확인');
    loader = new THREE.GLTFLoader();
  }
  return loader;
}
const load = url => new Promise((res, rej) => gltf().load(url, res, undefined, rej));

/* 애니메이션 GLB에서 클립만 뽑는다. 파일마다 클립 이름이 제각각이라 첫 번째를 쓴다. */
async function loadClip(charId, emote) {
  try {
    const g = await load(`${BASE}/anim/char_${charId}_${emote}.glb`);
    const c = g.animations && g.animations[0];
    if (c) { c.name = emote; return c; }
  } catch (e) { /* 그 캐릭에 그 동작이 없으면 조용히 건너뛴다 */ }
  return null;
}

/* ============================================================
   createCharacter(scene, charId, opt) → 컨트롤러
============================================================ */
export async function createCharacter(scene, charId = 'jachwi_f', opt = {}) {
  const root = new THREE.Group();
  const g = await load(`${MESH}/char_${charId}_rigged.glb`);
  const model = g.scene;

  /* ★ 크기는 건드리지 않는다.
     GLB에 이미 실치수가 들어 있다 — 캐릭 작업창이 tools/rescale_char_glb.py 로
     씬 최상단 래퍼에 스케일을 얹어 여캐 1.40m / 남캐 1.50m / 마스코트 0.375m 로 맞춰뒀다.
     (bbox 1.70m × 래퍼 0.8235 = 1.40m)
     여기서 또 정규화하면 그 위에 곱해져 1.36m 같은 값이 된다 — 실제로 그랬다.
     opt.height 를 명시적으로 준 경우에만 덮어쓴다. */
  if (opt.height) {
    const bb = new THREE.Box3().setFromObject(model);
    let bindH = 0;
    model.traverse(o => {                       // 스킨드 메시는 Box3가 못 재므로 바인드 bbox 사용
      if (o.isSkinnedMesh && !bindH) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        bindH = (o.geometry.boundingBox.max.y - o.geometry.boundingBox.min.y) * model.scale.y;
      }
    });
    if (bindH > 0.05) model.scale.multiplyScalar(opt.height / bindH);
  }

  model.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      o.frustumCulled = false;                       // 스키닝 메시 컬링 오류 방지
      if (o.material && o.material.map) o.material.map.encoding = THREE.sRGBEncoding;
    }
  });
  root.add(model);
  scene.add(root);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  const addClip = c => {
    if (!c) return;
    const a = mixer.clipAction(c);
    a.clampWhenFinished = true;
    actions[c.name] = a;
  };

  // 기본 두 개(idle·walking) — 파생 클립본(70KB/35KB). 감정은 필요할 때 채운다.
  for (const [file, name] of [['idle', 'idle'], ['walking', 'walking']]) {
    const c = await load(`${CLIPS}/char_${charId}_${file}.glb`)
      .then(x => x.animations && x.animations[0]).catch(() => null);
    if (c) { c.name = name; addClip(c); }
    else console.warn('[볕] 클립 없음:', charId, name, '— tools/strip_anim_glb.js 를 돌렸나?');
  }

  let cur = null;
  function play(name, { loop = true, fade = 0.25 } = {}) {
    const a = actions[name];
    if (!a || a === cur) return false;
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    a.enabled = true; a.setEffectiveWeight(1);
    if (cur) a.crossFadeFrom(cur, fade, false);
    a.play();
    cur = a;
    return true;
  }
  play('idle');

  /* ---- 이동 ---- */
  const target = new THREE.Vector3();
  let moving = false;
  const SPEED = opt.speed ?? 1.5;             // m/s
  const RADIUS = opt.radius ?? 0.26;          // 몸통 반지름 [m]
  let emoteBusy = false;
  let stuck = 0;

  /* ---- 세계 (벽·가구·문) ----
     buildHouse가 준 colliders/doorways를 그대로 받는다.
     colliders는 개구부를 이미 뺀 '조각'이라 문 자리는 저절로 비어 있다. */
  let colliders = [], doorways = [];
  let grid = null;              // { n, m, cell, x0, z0, free:Uint8Array }
  let path = [], pathI = 0;     // 웨이포인트

  const CELL = 0.25;            // 가구 배치 그리드와 같은 간격

  /* 방 전체를 0.25m 칸으로 나눠 '설 수 있는 칸'을 표시한다.
     칸 중심이 어떤 충돌체 안(반지름 포함)이면 막힌 칸. */
  function buildGrid(size) {
    if (!size) return null;
    const x0 = -size.w / 2, z0 = -size.d / 2;
    const n = Math.ceil(size.w / CELL), m = Math.ceil(size.d / CELL);
    const free = new Uint8Array(n * m);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const x = x0 + (i + 0.5) * CELL, z = z0 + (j + 0.5) * CELL;
      free[j * n + i] = blockedAt(x, z) ? 0 : 1;
    }
    return { n, m, cell: CELL, x0, z0, free };
  }
  function blockedAt(x, z) {
    for (const c of colliders) {
      const rot = c.rot || 0, co = Math.cos(-rot), si = Math.sin(-rot);
      const lx = (x - c.x) * co - (z - c.z) * si;
      const lz = (x - c.x) * si + (z - c.z) * co;
      if (Math.abs(lx) < c.w / 2 + RADIUS && Math.abs(lz) < c.d / 2 + RADIUS) return true;
    }
    return false;
  }
  const cellOf = (x, z) => grid
    ? [Math.max(0, Math.min(grid.n - 1, Math.floor((x - grid.x0) / CELL))),
       Math.max(0, Math.min(grid.m - 1, Math.floor((z - grid.z0) / CELL)))]
    : [0, 0];
  const cellPos = (i, j) => ({ x: grid.x0 + (i + 0.5) * CELL, z: grid.z0 + (j + 0.5) * CELL });

  /* 막힌 칸이면 가장 가까운 빈 칸으로 옮긴다(문 앞 가구 같은 경우) */
  function nearestFree(i, j) {
    if (grid.free[j * grid.n + i]) return [i, j];
    for (let r = 1; r < 24; r++)
      for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= grid.n || b >= grid.m) continue;
        if (grid.free[b * grid.n + a]) return [a, b];
      }
    return [i, j];
  }

  /* BFS — 대각선 포함(모서리 끼임 방지로 양옆이 뚫린 경우만).

     ★ 목표 칸이 '빈칸이지만 갇힌 주머니'일 수 있다(옷장과 서랍장 사이 2칸 같은).
       그래서 목표를 먼저 정하지 않고, 출발점에서 갈 수 있는 곳을 전부 훑은 뒤
       그중 목표에 가장 가까운 칸으로 간다. 못 가는 곳을 찍어도 최대한 다가간다. */
  function findPath(sx, sz, tx, tz) {
    if (!grid) return [];
    const [si, sj] = nearestFree(...cellOf(sx, sz));
    const [ti, tj] = cellOf(tx, tz);
    const N = grid.n, M = grid.m, F = grid.free;
    const prev = new Int32Array(N * M).fill(-1);
    const seen = new Uint8Array(N * M);
    const start = sj * N + si;
    const q = [start]; seen[start] = 1;
    const D = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    let head = 0;
    let best = start, bestD = (si - ti) ** 2 + (sj - tj) ** 2;
    while (head < q.length) {
      const cur = q[head++];
      const ci = cur % N, cj = (cur - ci) / N;
      const d2 = (ci - ti) ** 2 + (cj - tj) ** 2;
      if (d2 < bestD) { bestD = d2; best = cur; }
      if (d2 === 0) break;
      for (const [di, dj] of D) {
        const a = ci + di, b = cj + dj;
        if (a < 0 || b < 0 || a >= N || b >= M) continue;
        const k = b * N + a;
        if (seen[k] || !F[k]) continue;
        if (di && dj && (!F[cj * N + a] || !F[b * N + ci])) continue;   // 모서리 끼움 방지
        seen[k] = 1; prev[k] = cur; q.push(k);
      }
    }
    if (best === start) return [];
    const out = [];
    for (let k = best; k !== -1; k = prev[k]) {
      const i = k % N, j = (k - i) / N;
      out.push(cellPos(i, j));
      if (k === start) break;
    }
    out.reverse();
    return simplify(out);
  }
  /* 직선으로 갈 수 있는 구간은 웨이포인트를 지운다(지그재그 방지) */
  function simplify(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      for (; j > i + 1; j--) if (clearLine(pts[i], pts[j])) break;
      out.push(pts[j]); i = j;
    }
    return out;
  }
  function clearLine(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.ceil(d / (CELL * 0.5));
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      if (blockedAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  /* 축정렬 상자에 회전이 있는 경우까지 — 점을 상자 로컬로 옮겨 밀어낸다.
     겹치면 가장 얕은 축으로 빼내고(=벽을 따라 미끄러짐), 안 겹치면 그대로. */
  function pushOut(px, pz) {
    for (const c of colliders) {
      const cx = c.x, cz = c.z, rot = c.rot || 0;
      const co = Math.cos(-rot), si = Math.sin(-rot);
      let lx = (px - cx) * co - (pz - cz) * si;
      let lz = (px - cx) * si + (pz - cz) * co;
      const hw = c.w / 2 + RADIUS, hd = c.d / 2 + RADIUS;
      if (Math.abs(lx) >= hw || Math.abs(lz) >= hd) continue;   // 안 겹침
      const ox = hw - Math.abs(lx), oz = hd - Math.abs(lz);
      if (ox < oz) lx = Math.sign(lx || 1) * hw;                 // x로 빼는 게 얕다
      else         lz = Math.sign(lz || 1) * hd;
      const c2 = Math.cos(rot), s2 = Math.sin(rot);
      px = cx + lx * c2 - lz * s2;
      pz = cz + lx * s2 + lz * c2;
    }
    return { x: px, z: pz };
  }

  /* 문 열림 — 가까이 오면 t가 1로, 멀어지면 0으로. 실제 여닫이는 t로 그린다. */
  function updateDoors(dt) {
    const p = root.position;
    for (const d of doorways) {
      const dx = p.x - d.x, dz = p.z - d.z;
      // 통과 방향(법선)으로는 넉넉히, 옆으로는 문폭 안쪽일 때만 반응
      const along = d.nx ? dz : dx;              // 문이 뻗은 방향
      const across = d.nx ? dx : dz;             // 통과 방향
      const near = Math.abs(along) < d.half && Math.abs(across) < 1.35;
      const want = near ? 1 : 0;
      d.t += (want - d.t) * Math.min(1, dt * 6);
      if (Math.abs(d.t - want) < 0.002) d.t = want;
      if (!d.node) continue;
      if (d.kind === 'swing') d.node.rotation.y = -d.openRot * d.t;
      else if (d.kind === 'slide') {
        const off = d.travel * d.t;
        if (d.axis === 'x') d.node.position.z = d.home + off;
        else                d.node.position.x = d.home + off;
      }
    }
  }
  /* 문이 열려 있으면 그 자리는 통과 가능 — 애초에 colliders에 없으므로 따로 처리 안 함.
     (미닫이 짝은 유리라 충돌체로 넣지 않았다) */

  /* 선택 표시 — 발밑 주황 링 */
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.26, 0.34, 26),
    new THREE.MeshBasicMaterial({ color: 0xffb454, transparent: true, opacity: 0.9,
                                  side: THREE.DoubleSide, depthTest: false })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
  ring.renderOrder = 998; ring.visible = false;
  root.add(ring);

  /* ★ 클릭 판정용 보이지 않는 상자.
     스킨드 메시는 정점이 뼈 행렬로 움직이는데 three의 레이캐스트는 바인드 포즈와
     메시 노드 행렬만 본다 → 캐릭터를 클릭해도 안 맞는다(실제로 안 맞았다).
     몸통 크기의 상자를 씌워 그걸로 집는다. */
  const pick = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 1.55, 0.62),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  pick.position.y = 0.78;
  pick.userData.isCharacterPick = true;
  root.add(pick);

  /* 걸어간 뒤 할 일 — 가구 상호작용에 쓴다 */
  let arriveCb = null;

  const ctl = {
    root, model, mixer, actions,
    get position() { return root.position; },
    get selected() { return ring.visible; },
    get pickTarget() { return pick; },
    setSelected(v) { ring.visible = !!v; },

    /* 가구 앞으로 걸어가서 모션 하나 — main.js가 좌표와 동작을 준다 */
    goAndDo(x, z, emoteId) {
      arriveCb = emoteId ? () => this.emote(emoteId) : null;
      this.moveTo(x, z);
      if (!moving && arriveCb) { const f = arriveCb; arriveCb = null; f(); }
    },

    setPosition(x, z, y = 0) { root.position.set(x, y, z); },

    /* 방이 바뀌면 다시 물려준다 */
    setWorld(w = {}) {
      colliders = w.colliders || [];
      doorways  = w.doorways  || [];
      for (const d of doorways) d.t = 0;
      grid = buildGrid(w.size);
      path = []; pathI = 0;
    },

    /* 바닥의 (x,z)로 걸어가기 */
    moveTo(x, z) {
      if (emoteBusy) { emoteBusy = false; }      // 모션 중이어도 새 명령이 우선
      path = findPath(root.position.x, root.position.z, x, z);
      pathI = 0;
      if (!path.length) { moving = false; return; }      // 갈 수 없는 곳
      const w0 = path[0];
      target.set(w0.x, root.position.y, w0.z);
      moving = true;
      play('walking');
    },

    /* 감정 한 번 재생 → 끝나면 idle */
    async emote(id) {
      if (!actions[id]) {
        const c = await loadClip(charId, id);
        if (!c) return false;
        addClip(c);
      }
      moving = false; emoteBusy = true;
      const meta = EMOTES.find(e => e.id === id);
      const loop = !!(meta && meta.loop);
      play(id, { loop });
      if (!loop) {
        const a = actions[id];
        const dur = (a.getClip().duration || 1) * 1000;
        setTimeout(() => { emoteBusy = false; if (!moving) play('idle'); }, dur - 200);
      } else {
        emoteBusy = false;
      }
      return true;
    },

    stop() { moving = false; emoteBusy = false; play('idle'); },

    /* 디버그 — 경로와 격자 상태를 그대로 본다 */
    debug(tx, tz) {
      const pth = findPath(root.position.x, root.position.z, tx, tz);
      let freeN = 0;
      if (grid) for (const v of grid.free) freeN += v;
      return { path: pth, grid: grid && { n: grid.n, m: grid.m, free: freeN, total: grid.n * grid.m } };
    },

    update(dt) {
      mixer.update(dt);
      updateDoors(dt);
      if (!moving) return;
      const d = target.clone().sub(root.position);
      d.y = 0;
      const dist = d.length();
      if (dist < 0.12) {                       // 이번 웨이포인트 도착 → 다음으로
        if (pathI < path.length - 1) {
          pathI++;
          target.set(path[pathI].x, root.position.y, path[pathI].z);
          return;
        }
        moving = false;
        if (arriveCb) { const f = arriveCb; arriveCb = null; f(); return; }
        if (!emoteBusy) play('idle');
        return;
      }
      d.normalize();
      const step = Math.min(SPEED * dt, dist);

      // 가려다 막히면 벽을 따라 미끄러진다
      const want = { x: root.position.x + d.x * step, z: root.position.z + d.z * step };
      const fixed = pushOut(want.x, want.z);
      const moved = Math.hypot(fixed.x - root.position.x, fixed.z - root.position.z);
      root.position.x = fixed.x; root.position.z = fixed.z;

      // 거의 못 움직였으면(구석에 낀 것) 목표를 포기한다
      if (moved < step * 0.12) {
        stuck += dt;
        // 웨이포인트가 막혔으면 다음 것으로 건너뛴다. 그래도 안 되면 포기.
        if (stuck > 0.35) {
          stuck = 0;
          if (pathI < path.length - 1) {
            pathI++; target.set(path[pathI].x, root.position.y, path[pathI].z);
          } else { moving = false; if (!emoteBusy) play('idle'); return; }
        }
      } else stuck = 0;

      // 진행 방향 바라보기 (부드럽게)
      const face = Math.atan2(d.x, d.z);
      let diff = face - root.rotation.y;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      root.rotation.y += diff * Math.min(1, dt * 10);
    },

    dispose() {
      scene.remove(root);
      model.traverse(o => {
        if (o.isMesh) {
          o.geometry?.dispose();
          const m = o.material;
          (Array.isArray(m) ? m : [m]).forEach(x => { x?.map?.dispose(); x?.dispose(); });
        }
      });
    }
  };
  return ctl;
}
