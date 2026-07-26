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
    onChange             // () => void     — 조도 재계산
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

  function snap(v) { return Math.round(v / SNAP) * SNAP; }

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
  function onDown(e) {
    if (e.button === 2) return;          // 우클릭은 해제(바깥에서 처리)
    if (!enabled) return;
    const i = pickFurniture(e);
    if (i < 0) { selIdx = -1; marker.visible = false; api.onSelect && api.onSelect(-1, null); return; }
    selIdx = i;
    const f = getRoomDef().furniture[i];
    const p = floorAt(e);
    dragOff = p ? { x: (f.x || 0) - p.x, z: (f.z || 0) - p.z } : { x: 0, z: 0 };
    dragging = true;
    snapshot();
    markerTo(i);
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
    const f = getRoomDef().furniture[selIdx];
    const fp = footprint(selIdx);
    // 발자국 절반만큼 안쪽으로 — 가구가 벽을 뚫고 나가지 않게
    const mx = Math.max(0, S.w / 2 - fp.w / 2), mz = Math.max(0, S.d / 2 - fp.d / 2);
    f.x = Math.max(-mx, Math.min(mx, snap(p.x + dragOff.x)));
    f.z = Math.max(-mz, Math.min(mz, snap(p.z + dragOff.z)));
    marker.position.set(f.x, 0.02, f.z);
    e.preventDefault(); e.stopPropagation();
  }

  async function onUp(e) {
    if (!enabled || !dragging) return;
    dragging = false;
    await apply();
  }

  const el = renderer.domElement;

  const api = {
    onSelect: null,

    get enabled() { return enabled; },
    setEnabled(v) {
      enabled = !!v;
      if (!enabled) { selIdx = -1; dragging = false; marker.visible = false; }
      el.style.cursor = enabled ? 'crosshair' : '';
      return enabled;
    },
    get selected() { return selIdx; },

    /* 바깥(main.js)에서 쓰는 것들 — 선택 해제 · 클릭 판정 재사용 */
    deselect() { selIdx = -1; dragging = false; marker.visible = false;
                 api.onSelect && api.onSelect(-1, null); },
    pickAt(e) { return pickFurniture(e); },

    async rotate(deg = ROT_STEP) {
      if (selIdx < 0) return;
      snapshot();
      const f = getRoomDef().furniture[selIdx];
      f.rot = (((f.rot || 0) + deg) % 360 + 360) % 360;
      await apply();
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
