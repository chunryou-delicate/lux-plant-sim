/* ============================================================
   render3d/species_draw.js — 새 종(D45 · 핑크프린세스 · 알로카시아) 그리개 ([growth] 소유 · 2026-10-09)
   ------------------------------------------------------------
   ★ «방»과 «확대»가 **같은 이 파일**을 부른다 — 그래서 둘이 갈릴 수가 없다(총괄: 방 = 확대).
       방    src/render3d/plant_assemble.js  youngPlantOf({ species, plant }) → 이 그리개
       확대  plant_grow.html                 setSpeciesView({ species, plant }) → 이 그리개
     둘 다 normalizeAsset 은 «원본 plant_grow 의 그 함수»를 넘겨준다(방은 조립기가 평가한 원본 · 확대는 원본 그 자체).
   ★ 몬스테라는 여기 없다 — 몬스테라 그림은 원본 plant_grow(캐논)가 그린다. 이 종들은 원본에 그리개가 없어 «새로 세운 것»이고 두 벌이 아니다.
     빌리는 것:  잎 GLB 정규화 = 원본 normalizeAsset(leaf 가 몬스테라 규약으로 만든 판 — 잎자루 포함 · 자루 끝 원점 · 높이 1 · 잎몸이 +Z 로 기움)
                 잎 상태(단계·등급·크기·판) = 정본 species_growth.leafRows(그루 상태) — 여기서 안 굴린다
                 모양 값(마디 사이·줄기·눕힘·단계마다 조정표 한 줄) = data/growth_species.json 의 그 종 draw 칸
   ★ 크기는 «실제 미터»다(leaf_size_m · plan 실측). 그릇에 맞춰 줄이는 것은 부르는 쪽 몫이다.
   ★ 판(GLB)은 «쓸 때 한 장»씩 받는다 — 받는 중이면 그 잎이 빠진 채 나오고 userData.skinsPending > 0 · 도착하면 onArrive 를 부른다(다시 그릴 것).

     const D = await loadSpeciesDrawer({ THREE, normalizeAsset, onArrive, onProtoGeometry });
     const g = D.draw({ species: 'pink_princess', plant });   // THREE.Group(밑동 y=0) | null
============================================================ */
import { createSpeciesRules, u01 } from '../growth/species_growth.js';

const ROOT = new URL('../../', import.meta.url);
const AT = p => new URL(p, ROOT).href;
/* 눕힘을 잴 때 빼는 자루 밑 띠 — 정규화 높이의 8%(원본 normalizeAsset 이 자루 끝을 잡는 띠와 같은 폭) · 흙에 묻히는 밑동이다 */
export const SOIL_BAND = 0.08;

/* 두 정본(growth_species.json · light_thresholds.json)을 이 파일 기준 경로로 읽어 그리개를 세운다 — 어느 페이지에서 불러도 같은 곳 */
export async function loadSpeciesDrawer(opt = {}) {
  const get = async p => { const r = await fetch(AT(p)); if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json(); };
  const [spec, th] = await Promise.all([get('data/growth_species.json'), get('data/balance/light_thresholds.json')]);
  return createSpeciesDrawer({ ...opt, spec, rules: createSpeciesRules(spec, th) });
}

export function createSpeciesDrawer({ THREE, normalizeAsset, spec, rules, assetUrl, onArrive, onProtoGeometry }) {
  if (!THREE || typeof normalizeAsset !== 'function' || !spec || !rules) throw new Error('[종 그림] THREE · normalizeAsset · spec · rules 가 다 있어야 한다');
  const urlOf = assetUrl || (p => AT('assets/' + String(p).split('/').map(encodeURIComponent).join('/')));
  const proto = new Map(), pending = new Set(), failed = new Set(), samples = new Map();
  let loader = null;

  function asset(path) {
    if (proto.has(path)) return proto.get(path);
    if (!path || failed.has(path) || pending.has(path)) return null;
    pending.add(path);
    const done = () => { try { onArrive && onArrive({ loaded: proto.size, pending: pending.size }); } catch (e) { console.warn('[종 그림] 도착 알림 실패', e); } };
    (loader ||= new THREE.GLTFLoader()).load(urlOf(path),
      gl => {
        try {
          const pr = normalizeAsset(gl.scene, false, true);
          pr.traverse(m => { if (m.isMesh && m.geometry && onProtoGeometry) onProtoGeometry(m.geometry.uuid); });   // 프로토 기하 — 부르는 쪽이 버리면 안 된다
          proto.set(path, pr);
        } catch (e) { failed.add(path); console.warn('[종 그림] 잎 정규화 실패', path, e && e.message); }
        pending.delete(path); done();
      },
      undefined,
      () => { pending.delete(path); failed.add(path); console.warn('[종 그림] 잎 GLB 를 못 실었습니다 —', path); done(); });
    return null;
  }

  /* 잎 판 하나의 정점 (y, z) — 정규화 좌표 · 밑동 띠(SOIL_BAND) 위만 · 판마다 한 번 */
  function samplesOf(path, pr) {
    if (samples.has(path)) return samples.get(path);
    const out = [], v = new THREE.Vector3();
    pr.updateMatrixWorld(true);
    pr.traverse(m => {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); if (v.y >= SOIL_BAND) out.push(v.y, v.z); }
    });
    const arr = new Float32Array(out);
    samples.set(path, arr);
    return arr;
  }

  /* 회전 무관 지름 = 2 × max √(x²+z²) — room_view · plant_assemble 과 같은 식(7줄 · 식이 고정 · 모듈 경계를 안 넘기려고 한 벌 둔다) */
  function rotSafeDiameter(obj) {
    obj.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert(), m = new THREE.Matrix4(), v = new THREE.Vector3();
    let r2 = 0;
    obj.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
      m.multiplyMatrices(inv, o.matrixWorld); const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); r2 = Math.max(r2, v.x * v.x + v.z * v.z); } });
    return 2 * Math.sqrt(r2);
  }

  /* 그린다 — o = { species, plant(그루 상태) | rows(leafRows), seed?, lightAz? } */
  function draw(o = {}) {
    const species = o.species;
    const S = spec.species[species];
    const D = S && S.draw;
    if (!D) return null;
    let rows = Array.isArray(o.rows) ? o.rows : null;
    if (!rows && o.plant) { try { rows = rules.leafRows(o.plant); } catch (e) { return null; } }
    if (!rows || !rows.length) return null;
    const seed = (o.seed ?? (o.plant && o.plant.seed) ?? 0) >>> 0;
    const deg = Math.PI / 180, N = rows.length;
    const az0 = u01(seed, 0, 101) * Math.PI * 2;                 // 그루마다 다른 첫 방위
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const varieKeys = new Set(), missing = [], pivots = [];
    let drawn = 0, clamped = 0;

    const placeLeaf = (row, i, base, az) => {
      const pr = asset(row.asset);
      if (!pr) { missing.push(row.asset); return; }
      const a = (D.adj && D.adj[row.stage]) || {};
      const skin = /\/skins\//.test(row.asset);
      const inst = pr.clone(true);
      inst.traverse(m => {
        if (!m.isMesh) return;
        m.userData.sharedGeometry = true;
        /* 재질은 잎마다 떼어 낸다 — 방이 밴드 색을 재질에 얹으므로 나눠 쓰면 다른 그루까지 물든다 */
        const one = mt => { if (!mt) return mt; const c = mt.clone(); c.userData = Object.assign({}, c.userData, { cloned: true }); return c; };
        m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        /* 무늬판 잎몸은 틴트 금지 표(몬스테라 assemble 과 같은 규약) — 민무늬 판은 밴드 색을 받는다 */
        if (skin && mats.some(mt => mt && mt.map)) m.userData.varieSkin = true;
      });
      inst.scale.setScalar((row.size_m || 0.1) * (a.scale ?? 1));
      const want = Math.min(D.max_tilt_deg ?? 90, (a.tilt_deg ?? 0) + (N - 1 - i) * (D.older_tilt_deg ?? 0)) * deg;
      const piv = new THREE.Group();
      piv.position.copy(base);
      piv.rotation.order = 'YXZ';                                // 눕힘(X) 먼저 · 방위(Y) 나중 — 잎몸이 +Z 로 기운 판이라 바깥으로 눕는다
      piv.add(inst);
      /* ★ 흙 밑으로 안 들어가게 — 눕힌 잎의 가장 낮은 곳이 흙(y=0) 밑이면 들어가지 않을 만큼만 눕힌다.
           재는 것은 정점 — 기하 상자 모서리로 재면 밑동이 흙에 붙은 AL 은 하나도 못 눕는다(처음 그렇게 짜서 걸렸다).
           자루 밑 SOIL_BAND 는 흙에 묻히는 밑동이라 안 잰다. 눕힘 0 이면 그 위 정점은 다 base.y 위라 늘 답이 있다.
           눕힘은 X 축이라 높이만 보면 된다(방위 Y 는 높이를 안 바꾼다). */
      const smp = samplesOf(row.asset, pr), sc = inst.scale.x;
      const lowAt = t => { const c = Math.cos(t), sn = Math.sin(t); let lo = Infinity;
        for (let k = 0; k < smp.length; k += 2) { const yy = smp[k] * c - smp[k + 1] * sn; if (yy < lo) lo = yy; }
        return base.y + sc * lo; };
      let tilt = want;
      if (want > 0 && smp.length && lowAt(want) < 0) {
        let lo = 0, hi = want;
        for (let k = 0; k < 12; k++) { const mid = (lo + hi) / 2; if (lowAt(mid) >= 0) lo = mid; else hi = mid; }
        tilt = lo; clamped++;
      }
      piv.rotation.set(tilt, az + (a.ry_deg ?? 0) * deg, 0);
      piv.userData = { part: 'leaf', leafNo: row.no, stage: row.stage, grade: row.grade, asset: row.asset, scale: inst.scale.x, tiltWant: want, tilt };
      body.add(piv); pivots.push(piv);
      if (skin) varieKeys.add(row.asset);
      drawn++;
    };

    if (D.form === 'vine') {
      /* 덩굴 — 흙에서 줄기가 오르고 잎 한 장마다 마디 하나(아래 = 오래된 잎) */
      const leanAz = Number.isFinite(o.lightAz) ? o.lightAz : az0 + Math.PI / 3, lean = (D.lean_deg ?? 0) * deg;
      const dir = new THREE.Vector3(Math.sin(lean) * Math.sin(leanAz), Math.cos(lean), Math.sin(lean) * Math.cos(leanAz)).normalize();
      const stemMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(D.stem_color || '#4a3036'), roughness: 0.75 });
      stemMat.userData = { cloned: true };
      const up = new THREE.Vector3(0, 1, 0);
      let p = new THREE.Vector3(0, 0, 0);
      rows.forEach((row, i) => {
        const len = (D.internode_m && D.internode_m[row.stage]) ?? 0.02, r = (D.stem_r_m && D.stem_r_m[row.stage]) ?? 0.004;
        const q = p.clone().addScaledVector(dir, len);
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, len, 8, 1), stemMat);
        cyl.position.copy(p).addScaledVector(dir, len / 2);
        cyl.quaternion.setFromUnitVectors(up, dir);
        cyl.castShadow = true; cyl.receiveShadow = true;
        cyl.userData.part = 'stem';
        body.add(cyl);
        placeLeaf(row, i, q, az0 + i * (D.phyllotaxis_deg ?? 137.5) * deg);
        p = q;
      });
    } else if (D.form === 'rosette') {
      /* 로제트 — 잎자루가 구근에서 곧장 오른다. 가장 새 잎이 가운데서 가장 곧게 */
      rows.forEach((row, i) => {
        const az = az0 + i * (D.phyllotaxis_deg ?? 137.5) * deg, r = D.spread_m ?? 0;
        placeLeaf(row, i, new THREE.Vector3(Math.sin(az) * r, 0, Math.cos(az) * r), az);
      });
    } else return null;                                          // 모르는 꼴 — 지어내지 않는다

    const bb = new THREE.Box3().setFromObject(g);
    g.userData = {
      isPlantAssembled: true, kind: 'youngPlant', species, seed,
      leafCount: drawn, leafCountWanted: N, leafRows: rows.map(r => ({ ...r })),
      leaves: [], leafPivots: pivots, droppedParts: [],
      varieLeafKeys: [...varieKeys], missingAssets: missing,
      skinsPending: missing.filter(a => pending.has(a)).length,
      failedAssets: missing.filter(a => failed.has(a)),
      growthDays: null, nextLeaf01Given: true, tiltClamped: clamped,
      sizeM: { h: bb.isEmpty() ? 0 : (bb.max.y - bb.min.y), d: bb.isEmpty() ? 0 : rotSafeDiameter(g) }
    };
    return g;
  }

  return {
    draw,
    pending: () => pending.size,
    loaded: () => proto.size,
    info: () => ({ loaded: proto.size, pending: pending.size, failed: [...failed] }),
    species: () => Object.keys(spec.species).filter(k => spec.species[k] && spec.species[k].draw)
  };
}
