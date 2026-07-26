/* ============================================================
   render3d/decorate.js — 집꾸미기 (가구 배치 편집 · 저장 · 불러오기)
   ------------------------------------------------------------
   클릭으로 가구를 고르고 끌어서 옮긴다. 회전·삭제·추가·되돌리기.
   결과는 house_rooms.json의 furniture 배열과 **같은 형식**으로 내보낸다.
     → 사용자가 배치해서 저장한 걸 그대로 data/house_rooms.json에 붙여넣으면
       그게 기본 배치가 된다. (별도 포맷을 만들지 않는 게 핵심)

   ※ 배치를 바꾸면 조도가 달라진다(발코니 창가에서 한 칸 0.25m에 DLI 약 25%).
     그래서 놓을 때마다 onChange로 조도를 다시 계산하게 콜백을 준다.
============================================================ */

/* ★ 이산 그리드 — 플레이어가 만지는 건 이산화한다.
   물리(조도)는 연속 그대로 두고, '놓을 수 있는 자리'만 칸으로 끊는다.
   그러지 않으면 20cm를 미세조정해 DLI를 올리는 픽셀 최적화 게임이 된다.

   0.25m로 정한 근거(수정된 물리 기준, 발코니 창가 실측):
     인접 칸 사이 DLI 변화 ≈ 25%  — "옮기면 눈에 띄게 달라진다"는 되고,
     "1cm씩 밀어 최적점을 찾는다"는 안 된다.
   ※ 1m 모듈(창·문 스냅 단위)의 1/4이라 벽·창과도 격자가 맞는다. */
const SNAP = 0.25;
const ROT_STEP = 15;                     // 회전 15°

export function createDecorator(ctx, opts) {
  const { renderer, scene } = ctx;
  const camera = ctx.cam || ctx.camera;   // scene.js는 cam 으로 준다(camera 아님)
  const {
    getRoomDef,          // () => 현재 roomDef (furniture 배열을 직접 고침)
    getFurnitureGroup,   // () => buildHouse가 만든 furniture Group
    getSize,             // () => {w,d,h}
    rebuild,             // () => Promise  — 방을 다시 조립(배치 반영)
    onChange,            // () => void     — 조도 재계산
    getWorld,            // () => {colliders, doorways}  — 배치 가능 판정용
    getPreset            // (id) => 프리셋   — 새로 추가할 가구 크기
  } = opts;

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  let enabled = false;
  let selIdx = -1;               // roomDef.furniture 인덱스
  let dragging = false;
  let dragOff = { x: 0, z: 0 };
  const history = [];            // 되돌리기 스택 (furniture 배열 스냅샷)

  /* ---- 선택 표시: 바닥에 링 ---- */
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.36, 28),
    new THREE.MeshBasicMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0.85,
                                  side: THREE.DoubleSide, depthTest: false })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.renderOrder = 999;
  marker.visible = false;
  scene.add(marker);

  /* ---- 고스트: 끌고 있는 가구의 자리를 반투명 상자로 미리 보여준다 ----
     초록 = 놓을 수 있음 / 빨강 = 안 됨(벽·다른 가구·문 앞).
     실제 가구는 원래 자리에 그대로 두고, 놓는 순간에만 옮긴다. */
  const GH_OK = 0x4aa3ff, GH_NG = 0xe8615a;
  const ghostMat = new THREE.MeshBasicMaterial({ color: GH_OK, transparent: true,
                                                 opacity: 0.28, depthWrite: false });
  const ghostLine = new THREE.LineBasicMaterial({ color: GH_OK, transparent: true, opacity: 0.9,
                                                  depthTest: false });
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), ghostMat);
  const ghostEdge = new THREE.LineSegments(new THREE.EdgesGeometry(ghost.geometry), ghostLine);
  ghost.add(ghostEdge);
  ghost.renderOrder = 997; ghostEdge.renderOrder = 998;
  ghost.visible = false;
  scene.add(ghost);
  let ghostOK = true;

  function ghostShape(i) {
    const grp = getFurnitureGroup();
    let sz = { w: 0.5, d: 0.5, h: 0.6 };
    if (grp) for (const o of grp.children)
      if (o.userData.furnIdx === i && o.userData.size) sz = o.userData.size;
    return sz;
  }
  function setGhost(i, x, z, ok) {
    const f = getRoomDef().furniture[i]; if (!f) return;
    const sz = ghostShape(i);
    ghost.scale.set(Math.max(sz.w, 0.12), Math.max(sz.h, 0.12), Math.max(sz.d, 0.12));
    ghost.position.set(x, Math.max(sz.h, 0.12) / 2 + 0.01, z);
    ghost.rotation.y = (f.rot || 0) * Math.PI / 180;
    if (ok !== ghostOK) {
      ghostOK = ok;
      ghostMat.color.setHex(ok ? GH_OK : GH_NG);
      ghostLine.color.setHex(ok ? GH_OK : GH_NG);
    }
    ghost.visible = true;
  }

  function snap(v) { return Math.round(v / SNAP) * SNAP; }

  /* 회전을 반영한 발자국 사각형 */
  function footRect(sz, x, z, rotDeg) {
    const r = ((((rotDeg || 0) % 180) + 180) % 180);
    const w = (r > 45 && r < 135) ? sz.d : sz.w;
    const d = (r > 45 && r < 135) ? sz.w : sz.d;
    return { x0: x - w/2, x1: x + w/2, z0: z - d/2, z1: z + d/2 };
  }
  const overlap = (a, b, m = 0) =>
    a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.z0 < b.z1 + m && b.z0 < a.z1 + m;

  /* ★ 여기에 놓을 수 있나
       ① 방 밖으로 나가면 안 됨
       ② 벽·칸막이를 뚫으면 안 됨 (colliders 중 kind:'wall')
       ③ 다른 가구와 겹치면 안 됨
       ④ 문·미닫이 통로 앞을 막으면 안 됨 (doorways 기준 앞뒤 0.5m)
     낮은 것(러그)은 밟고 지나가므로 ②③은 건너뛴다. */
  function canPlace(i, x, z) {
    const S = getSize();
    const sz = ghostShape(i);
    const f = getRoomDef().furniture[i];
    const rect = footRect(sz, x, z, f.rot);
    if (rect.x0 < -S.w/2 - 1e-3 || rect.x1 > S.w/2 + 1e-3 ||
        rect.z0 < -S.d/2 - 1e-3 || rect.z1 > S.d/2 + 1e-3) return false;
    const low = (sz.h || 1) < 0.12;
    const W = (getWorld && getWorld()) || {};

    if (!low) for (const c of (W.colliders || [])) {
      if (c.kind !== 'wall') continue;
      // 벽은 축정렬이라 회전 없는 사각형으로 봐도 된다
      /* 벽에 '딱 붙인' 가구는 정상이므로 걸레받이 두께(6cm)만큼 파고드는 건 봐준다.
         이보다 깊으면 벽을 뚫은 것으로 본다. */
      if (overlap(rect, { x0:c.x-c.w/2, x1:c.x+c.w/2, z0:c.z-c.d/2, z1:c.z+c.d/2 }, -0.07)) return false;
    }
    if (!low) {
      const list = getRoomDef().furniture || [];
      for (let k = 0; k < list.length; k++) {
        if (k === i) continue;
        const o = list[k];
        const osz = ghostShape(k);
        if ((osz.h || 1) < 0.12) continue;                 // 러그류는 겹쳐도 됨
        if ((getPreset && (getPreset(o.preset)||{}).mount) === 'wall') continue;
        if (overlap(rect, footRect(osz, o.x||0, o.z||0, o.rot), -0.02)) return false;
      }
    }
    for (const d of (W.doorways || [])) {                  // 문 앞 막지 않기
      const half = (d.half || 0.9);
      const zone = d.nx
        ? { x0:d.x-0.5, x1:d.x+0.5, z0:d.z-half, z1:d.z+half }
        : { x0:d.x-half, x1:d.x+half, z0:d.z-0.5, z1:d.z+0.5 };
      if (overlap(rect, zone)) return false;
    }
    return true;
  }

  function pointer(e) {
    const r = renderer.domElement.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    ndc.x = ((cx - r.left) / r.width) * 2 - 1;
    ndc.y = -((cy - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
  }

  /* 클릭 지점의 바닥 좌표 */
  function floorAt(e) {
    pointer(e);
    return ray.ray.intersectPlane(floorPlane, hit) ? { x: hit.x, z: hit.z } : null;
  }

  /* 클릭한 가구의 furniture 인덱스 — buildHouse가 각 그룹에 furnIdx를 넣어준다 */
  function pickFurniture(e) {
    const grp = getFurnitureGroup();
    if (!grp) return -1;
    pointer(e);
    const hits = ray.intersectObjects(grp.children, true);
    for (const h of hits) {
      let o = h.object;
      while (o && o.userData.furnIdx == null && o.parent) o = o.parent;
      if (o && o.userData.furnIdx != null) return o.userData.furnIdx;
    }
    return -1;
  }

  function snapshot() {
    const f = getRoomDef().furniture || [];
    history.push(JSON.parse(JSON.stringify(f)));
    if (history.length > 40) history.shift();
  }

  function markerTo(i) {
    const f = (getRoomDef().furniture || [])[i];
    if (!f) { marker.visible = false; return; }
    marker.position.set(f.x || 0, 0.02, f.z || 0);
    marker.visible = true;
  }

  async function apply() { await rebuild(); markerTo(selIdx); onChange && onChange(); }

  /* ---------- 입력 ---------- */
  let dragHome = null, dragTo = null;

  function onDown(e) {
    if (e.button === 2) return;          // 우클릭은 해제(바깥에서 처리)
    if (!enabled) return;
    const i = pickFurniture(e);
    if (i < 0) { selIdx = -1; marker.visible = false; ghost.visible = false;
                 api.onSelect && api.onSelect(-1, null); return; }
    selIdx = i;
    const f = getRoomDef().furniture[i];
    const p = floorAt(e);
    dragOff = p ? { x: (f.x || 0) - p.x, z: (f.z || 0) - p.z } : { x: 0, z: 0 };
    dragHome = { x: f.x || 0, z: f.z || 0 };
    dragTo = { ...dragHome };
    dragging = true;
    markerTo(i);
    setGhost(i, dragHome.x, dragHome.z, true);
    api.onSelect && api.onSelect(i, f);
    e.preventDefault(); e.stopPropagation();
  }

  /* 선택된 가구의 실제 발자국(회전 반영) — 벽을 뚫지 않게 가두는 데 쓴다 */
  function footprint(i) {
    const grp = getFurnitureGroup();
    let w = 0.4, d = 0.4;
    if (grp) for (const o of grp.children)
      if (o.userData.furnIdx === i && o.userData.size) { w = o.userData.size.w; d = o.userData.size.d; }
    const f = getRoomDef().furniture[i];
    const rot = ((((f.rot || 0) % 180) + 180) % 180);
    return (rot > 45 && rot < 135) ? { w: d, d: w } : { w, d };
  }

  function onMove(e) {
    if (!enabled || !dragging || selIdx < 0) return;
    const p = floorAt(e);
    if (!p) return;
    const S = getSize();
    const fp = footprint(selIdx);
    // 발자국 절반만큼 안쪽으로 — 방 밖으로는 아예 못 나가게
    const mx = Math.max(0, S.w / 2 - fp.w / 2), mz = Math.max(0, S.d / 2 - fp.d / 2);
    const nx = Math.max(-mx, Math.min(mx, snap(p.x + dragOff.x)));
    const nz = Math.max(-mz, Math.min(mz, snap(p.z + dragOff.z)));
    const ok = canPlace(selIdx, nx, nz);
    setGhost(selIdx, nx, nz, ok);
    if (ok) dragTo = { x: nx, z: nz };        // 마지막으로 '놓을 수 있던' 자리만 기억
    marker.position.set(nx, 0.02, nz);
    e.preventDefault(); e.stopPropagation();
  }

  async function onUp(e) {
    if (!enabled || !dragging) return;
    dragging = false;
    ghost.visible = false;
    const f = getRoomDef().furniture[selIdx];
    if (!f || !dragTo) return;
    if (dragTo.x === dragHome.x && dragTo.z === dragHome.z) return;   // 안 움직였으면 그대로
    snapshot();                                  // 되돌리기용 — 실제로 옮길 때만 쌓는다
    f.x = dragTo.x; f.z = dragTo.z;
    await apply();
  }

  const el = renderer.domElement;

  const api = {
    onSelect: null,

    get enabled() { return enabled; },
    setEnabled(v) {
      enabled = !!v;
      if (!enabled) { selIdx = -1; dragging = false; marker.visible = false; ghost.visible = false; }
      el.style.cursor = enabled ? 'crosshair' : '';
      return enabled;
    },
    get selected() { return selIdx; },

    /* 바깥(main.js)에서 쓰는 것들 — 선택 해제 · 클릭 판정 재사용 */
    deselect() { selIdx = -1; dragging = false; marker.visible = false; ghost.visible = false;
                 api.onSelect && api.onSelect(-1, null); },
    pickAt(e) { return pickFurniture(e); },
    /* 검사·디버그용 — 그 자리에 놓을 수 있는지만 물어본다 */
    testPlace(i, x, z) { return canPlace(i, x, z); },

    async rotate(deg = ROT_STEP) {
      if (selIdx < 0) return;
      const f = getRoomDef().furniture[selIdx];
      const before = f.rot || 0;
      f.rot = ((before + deg) % 360 + 360) % 360;
      if (!canPlace(selIdx, f.x || 0, f.z || 0)) {   // 돌리면 걸리는 자리
        f.rot = before;
        api.onSelect && api.onSelect(selIdx, f);
        return false;
      }
      snapshot();
      await apply();
      return true;
    },

    async remove() {
      if (selIdx < 0) return;
      snapshot();
      getRoomDef().furniture.splice(selIdx, 1);
      selIdx = -1; marker.visible = false;
      await apply();
      api.onSelect && api.onSelect(-1, null);
    },

    /* 화면 중앙 근처에 새 가구 추가 */
    async add(preset) {
      snapshot();
      const S = getSize();
      const list = getRoomDef().furniture || (getRoomDef().furniture = []);
      list.push({ preset, x: 0, z: Math.min(S.d / 2 - 0.6, 0.8) });
      selIdx = list.length - 1;
      await apply();
      api.onSelect && api.onSelect(selIdx, list[selIdx]);
    },

    async undo() {
      if (!history.length) return;
      getRoomDef().furniture = history.pop();
      selIdx = -1; marker.visible = false;
      await apply();
      api.onSelect && api.onSelect(-1, null);
    },

    /* ---------- 저장 / 불러오기 ----------
       house_rooms.json의 furniture 배열과 같은 형식으로 낸다. */
    exportJSON(roomKey) {
      return JSON.stringify({
        _note: 'data/house_rooms.json 의 rooms.' + roomKey + '.furniture 에 그대로 붙여넣으면 기본 배치가 된다',
        room: roomKey,
        furniture: (getRoomDef().furniture || []).map(f => {
          const o = { preset: f.preset, x: +(f.x || 0).toFixed(2), z: +(f.z || 0).toFixed(2) };
          if (f.rot) o.rot = f.rot;
          if (f.y != null) o.y = f.y;
          return o;
        })
      }, null, 2);
    },

    download(roomKey) {
      const blob = new Blob([api.exportJSON(roomKey)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `furniture_${roomKey}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },

    async importJSON(text) {
      const o = typeof text === 'string' ? JSON.parse(text) : text;
      const list = Array.isArray(o) ? o : (o.furniture || []);
      if (!Array.isArray(list)) throw new Error('furniture 배열이 없다');
      snapshot();
      getRoomDef().furniture = list;
      selIdx = -1; marker.visible = false;
      await apply();
    },

    /* 브라우저에 임시 저장 — 새로고침해도 유지 */
    saveLocal(roomKey) {
      localStorage.setItem('byeot.deco.' + roomKey, api.exportJSON(roomKey));
    },
    loadLocal(roomKey) {
      const t = localStorage.getItem('byeot.deco.' + roomKey);
      return t ? api.importJSON(t) : Promise.resolve(false);
    },
    hasLocal(roomKey) { return !!localStorage.getItem('byeot.deco.' + roomKey); },
    clearLocal(roomKey) { localStorage.removeItem('byeot.deco.' + roomKey); },

    attach() {
      el.addEventListener('pointerdown', onDown, true);
      el.addEventListener('pointermove', onMove, true);
      el.addEventListener('pointerup', onUp, true);
    },
    detach() {
      el.removeEventListener('pointerdown', onDown, true);
      el.removeEventListener('pointermove', onMove, true);
      el.removeEventListener('pointerup', onUp, true);
    }
  };
  api.attach();
  return api;
}
