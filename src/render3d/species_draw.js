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

   ★ 2026-10-23 D71 — 두 종 더(총괄 · plan-species2-shop-spec §3 · 이름은 core 와 맞춤)
     스킨답서스 'scindapsus' — 꼴 trailing(늘어지는 덩굴): 흙 → 화분 테두리 → 화분 옆면 → 받침 끝 → 바닥.
       draw({ species, plant, potD, hang:{ dropM, potH, az?, edgeM? } })
         dropM = 떨어지는 높이(m · 규칙 stepDay 의 dropM 과 같은 수 · house 자리 plantSlots[].dropM) · potH = 흙 → 받침(방뷰 addYoungPlant 의 baseY)
         az = 늘어뜨릴 방위(그루 기준 · house dropDir [x,z] 면 Math.atan2(x, z) − 그루 회전) · edgeM = 화분 가운데 → 받침 끝(house dropEdgeM · 없으면 «화분이 끝에 붙어 있다»)
         hang 이 없으면 줄기는 화분 옆면을 따라 받침에 눕는다(userData.hangGiven = false — 메꾼 것을 숨기지 않는다).
       sizeM 은 «화분 위 몫»(오르는 줄기 · 그 잎)만 잰다 — 늘어진 줄기는 칸 붐빔(D55)에 안 든다. 늘어진 몫은 userData.hang.
     칼라테아 'calathea' — 꼴 rosette + 잎마다 curl(0 펴짐 ~ 1 다 말림 · 잎몸을 가운데 맥 축으로 겉면 쪽으로 만다) · night:true 면 잎을 세운다(그림만).
     판마다 뼈대가 다르면 draw.adj_by_asset[판 경로] = { skin_scale, stage_real_m, pitch_fix_deg, mirror_x } — leaf 뼈대 조정표 규약(자루 끝에서 안쪽부터 기울기 → 거울 → 배율 · assets/plants/skeleton_table.json).
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
  const proto = new Map(), pending = new Set(), failed = new Set();
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

  /* 정점 — 판 공간에서 밑동 띠(SOIL_BAND) 위인 정점만 · 틀(보정 뒤) 공간 좌표로.
     samples (y, z) 는 눕힘(X 축) 재기용 · pts3 (x, y, z · 둘에 하나)는 축으로 세운 잎(D71)의 맨 아래 재기용 */
  function samplesOf(frame, src) {
    const out = [], o3 = [], v = new THREE.Vector3();
    frame.updateMatrixWorld(true);
    const frameInv = new THREE.Matrix4().copy(frame.matrixWorld).invert();
    const srcInv = new THREE.Matrix4().copy(src.matrixWorld).invert();
    const toFrame = new THREE.Matrix4().multiplyMatrices(frameInv, src.matrixWorld), m1 = new THREE.Matrix4();
    src.traverse(m => {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
      m1.multiplyMatrices(srcInv, m.matrixWorld);
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m1);
        if (v.y < SOIL_BAND) continue;
        v.applyMatrix4(toFrame); out.push(v.y, v.z);
        if (!(i & 1)) o3.push(v.x, v.y, v.z);
      }
    });
    return { yz: new Float32Array(out), xyz: new Float32Array(o3) };
  }

  /* ★ D71 칼라테아 말린 잎 — 잎몸을 가운데 맥(자루 끝 → 잎끝 축 a)을 축으로 겉면(n · 자세 A 의 −Z) 쪽으로 만다.
       옆 좌표 s 를 반지름 R 원통에 감는다: s' = R sin(s/R) · h' = h + R(1 − cos(s/R)) · 가장자리(s = 폭 w)가 q × curl_roll_deg 돈다.
       판을 깎지 않고 기하만 휜다 — 말림 몫 0.1 칸마다 판 하나에 한 벌(캐시 · 프로토 기하로 알림). */
  const curled = new Map();
  function curledProto(path, pr, q, D) {
    const key = path + '|' + q;
    if (curled.has(key)) return curled.get(key);
    pr.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(pr.matrixWorld).invert(), v = new THREE.Vector3();
    const meshes = []; pr.traverse(m => { if (m.isMesh && m.geometry && m.geometry.attributes.position) meshes.push(m); });
    const rels = meshes.map(m => new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    let tip = new THREE.Vector3(0, 1, 0), far = 0;
    meshes.forEach((m, k) => { const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(rels[k]); const d = v.lengthSq(); if (d > far) { far = d; tip.copy(v); } } });
    const a = tip.clone().normalize();
    const l = new THREE.Vector3().crossVectors(a, new THREE.Vector3(0, 0, -1)).normalize();
    const n = new THREE.Vector3().crossVectors(l, a).normalize();
    let w = 0; const tipLen = Math.sqrt(far);
    meshes.forEach((m, k) => { const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(rels[k]); if (v.dot(a) > 0.35 * tipLen) w = Math.max(w, Math.abs(v.dot(l))); } });
    const theta = q * (D.curl_roll_deg ?? 300) * Math.PI / 180, R = w > 1e-6 && theta > 1e-6 ? w / theta : Infinity;
    const c = pr.clone(true), cm = []; c.traverse(m => { if (m.isMesh && m.geometry && m.geometry.attributes.position) cm.push(m); });
    cm.forEach((m, k) => {
      const g2 = m.geometry.clone(), pos = g2.attributes.position, back = new THREE.Matrix4().copy(rels[k]).invert();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(rels[k]);
        const s = v.dot(l), h = v.dot(n), al = v.dot(a), t = s / R;
        v.copy(a).multiplyScalar(al).addScaledVector(l, R * Math.sin(t)).addScaledVector(n, h + R * (1 - Math.cos(t))).applyMatrix4(back);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      pos.needsUpdate = true; g2.computeVertexNormals(); g2.computeBoundingBox(); g2.computeBoundingSphere();
      m.geometry = g2;
      if (onProtoGeometry) onProtoGeometry(g2.uuid);                 // 프로토 기하 — 부르는 쪽이 버리면 안 된다
    });
    curled.set(key, c);
    return c;
  }

  /* «잎 한 장의 틀» = 판(또는 말린 판) + 뼈대 보정(leaf 조정표 규약: 자루 끝에서 안쪽부터 기울기 → 거울 → 배율).
     틀마다 한 번 짓고(캐시) 잎마다 clone 한다. key = 판 경로 | 말림 몫 */
  const frames = new Map();
  function frameOf(path, D, curlQ) {
    const pr = asset(path);
    if (!pr) return null;
    const key = path + '|' + curlQ;
    if (frames.has(key)) return frames.get(key);
    const fx = (D.adj_by_asset && D.adj_by_asset[path]) || {};
    const src = (curlQ > 0 ? curledProto(path, pr, curlQ, D) : pr).clone(true);
    const pitch = new THREE.Group(); pitch.rotation.x = (Number(fx.pitch_fix_deg) || 0) * Math.PI / 180; pitch.add(src);
    const node = new THREE.Group(); if (fx.mirror_x) node.scale.x = -1; node.add(pitch);
    const sm = samplesOf(node, src);
    const fr = { node, skinScale: Number.isFinite(fx.skin_scale) ? fx.skin_scale : 1, stageReal: fx.stage_real_m || null, samples: sm.yz, pts3: sm.xyz };
    frames.set(key, fr);
    return fr;
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

  /* 그린다 — o = { species, plant(그루 상태) | rows(leafRows), seed?, lightAz?, potD?, hang?(SC), night?(CA) } */
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
    let drawn = 0, clamped = 0, hangInfo = null;
    const nightMult = o.night && Number.isFinite(D.night_tilt_mult) ? D.night_tilt_mult : 1;   // D71 칼라테아 밤 — 잎을 세운다(그림만)

    /* 잎 한 장(틀 clone · 재질은 잎마다 떼어 냄 · 크기) — 판이 아직 없으면 null(받는 중) */
    const makeLeaf = (row) => {
      const curlQ = Number.isFinite(row.curl) && row.curl > 0 ? Math.max(0.1, Math.round(row.curl * 10) / 10) : 0;
      const fr = frameOf(row.asset, D, curlQ);
      if (!fr) { missing.push(row.asset); return null; }
      const a = (D.adj && D.adj[row.stage]) || {};
      const skin = /\/skins\//.test(row.asset);
      const inst = new THREE.Group(); inst.add(fr.node.clone(true));
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
      /* 크기 — 판이 단계마다 쓸 실측(stage_real_m · leaf 넓이 맞춤)을 주면 그것, 아니면 단계 실측 × skin_scale */
      const real = fr.stageReal && Number.isFinite(fr.stageReal[row.stage]) ? fr.stageReal[row.stage] : (row.size_m || 0.1) * fr.skinScale;
      inst.scale.setScalar(real * (a.scale ?? 1));
      if (skin) varieKeys.add(row.asset);
      return { inst, fr, a };
    };
    const note = (piv, row, L, extra) => {
      piv.userData = { part: 'leaf', leafNo: row.no, stage: row.stage, grade: row.grade, asset: row.asset, scale: L.inst.scale.x, ...extra };
      if (Number.isFinite(row.curl)) piv.userData.curl = row.curl;
      pivots.push(piv); drawn++;
    };

    const placeLeaf = (row, i, base, az, parent = body) => {
      const L = makeLeaf(row);
      if (!L) return;
      const { inst, fr, a } = L;
      const want = Math.min(D.max_tilt_deg ?? 90, (a.tilt_deg ?? 0) + (N - 1 - i) * (D.older_tilt_deg ?? 0)) * nightMult * deg;
      const piv = new THREE.Group();
      piv.position.copy(base);
      piv.rotation.order = 'YXZ';                                // 눕힘(X) 먼저 · 방위(Y) 나중 — 잎몸이 +Z 로 기운 판이라 바깥으로 눕는다
      piv.add(inst);
      /* ★ 흙 밑으로 안 들어가게 — 눕힌 잎의 가장 낮은 곳이 흙(y=0) 밑이면 들어가지 않을 만큼만 눕힌다.
           재는 것은 정점 — 기하 상자 모서리로 재면 밑동이 흙에 붙은 AL 은 하나도 못 눕는다(처음 그렇게 짜서 걸렸다).
           자루 밑 SOIL_BAND 는 흙에 묻히는 밑동이라 안 잰다. 눕힘 0 이면 그 위 정점은 다 base.y 위라 늘 답이 있다.
           눕힘은 X 축이라 높이만 보면 된다(방위 Y 는 높이를 안 바꾼다). */
      const smp = fr.samples, sc = inst.scale.x;
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
      parent.add(piv);
      note(piv, row, L, { tiltWant: want, tilt });
    };
    /* 축으로 세우는 잎(D71 늘어진 줄기) — t = 자루 끝 → 잎끝 · n = 겉면(자세 A 의 −Z 가 n 을 본다) · t ⟂ n
       axesOf(t, n) → 틀 축 · lowOf → 그 자세에서 잎 맨 아래(자루 끝 기준 · 미터)
       pick(low) → { t, n, ground, pose } — 바닥(ground)을 뚫는 자세면 부르는 쪽이 바꾼다 · 그래도 낮으면 그만큼 들어 올린다 */
    const axesOf = (t, n) => { const Y = t.clone().normalize(), Z = n.clone().negate().normalize(); return { X: new THREE.Vector3().crossVectors(Y, Z).normalize(), Y, Z }; };
    const lowOf = (fr, sc, t, n) => { const { X, Y, Z } = axesOf(t, n), p3 = fr.pts3; let lo = 0;
      for (let k = 0; k < p3.length; k += 3) { const yy = X.y * p3[k] + Y.y * p3[k + 1] + Z.y * p3[k + 2]; if (yy < lo) lo = yy; }
      return lo * sc; };
    const placeLeafAxes = (row, pos, pick, parent) => {
      const L = makeLeaf(row);
      if (!L) return null;
      const sc = L.inst.scale.x, ch = pick((t, n) => lowOf(L.fr, sc, t, n));
      const { X, Y, Z } = axesOf(ch.t, ch.n);
      const p = pos.clone(), lo = lowOf(L.fr, sc, ch.t, ch.n);
      let lifted = 0;
      if (Number.isFinite(ch.ground) && p.y + lo < ch.ground) { lifted = ch.ground - (p.y + lo); p.y += lifted; }
      const piv = new THREE.Group();
      piv.position.copy(p);
      piv.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
      piv.add(L.inst);
      parent.add(piv);
      note(piv, row, L, { tiltWant: null, tilt: null, pose: ch.pose, lifted });
      return ch.pose;
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
    } else if (D.form === 'trailing') {
      /* ★ D71 늘어지는 덩굴 — 길: 흙 가운데 → 바깥으로 휘어 오름(rise) → 테두리 → 화분 옆면(pot) → 받침 끝까지 누움(lie) → 바닥까지(hang) → 바닥에 누움(lie · 끝없이).
           잎은 줄기 밑에서 잰 길이 at 자리에. 바닥에 닿은 그루(plant.atFloor)는 끝이 바닥에 닿게 그린다(규칙 상한과 화분 꼴이 몇 cm 갈려도 떠 보이지 않게). */
      const H = o.hang && typeof o.hang === 'object' ? o.hang : null;
      const potR = (Number.isFinite(o.potD) && o.potD > 0 ? o.potD : (D.pot_d_m ?? 0.18)) / 2;
      const potH = H && Number.isFinite(H.potH) ? Math.max(0, H.potH) : (D.pot_h_m ?? 0.13);
      const drop = H && Number.isFinite(H.dropM) ? Math.max(0, H.dropM) : 0;
      const az = H && Number.isFinite(H.az) ? H.az : az0;
      const u = new THREE.Vector3(Math.sin(az), 0, Math.cos(az)), Y = new THREE.Vector3(0, 1, 0);
      const topRow = rows[rows.length - 1];
      const r = (D.stem_r_m && D.stem_r_m[topRow.stage]) ?? 0.003;
      const off = potR + r + 0.004;                                                   // 화분 테두리 바깥
      const edge = H && Number.isFinite(H.edgeM) ? Math.max(off, H.edgeM + r + 0.006) : off;
      const P = (h, y) => u.clone().multiplyScalar(h).setY(y);
      const pts = [P(0, 0), P(potR * (D.rise_out ?? 0.5), D.rise_m ?? 0.06), P(off, D.rim_up_m ?? 0.02), P(off + 0.004, -potH + r)];
      const kinds = ['rise', 'rise', 'pot'];
      if (edge > off + 0.01) { pts.push(P(edge, -potH + r)); kinds.push('lie'); }
      if (drop > 0.01) { const e = pts[pts.length - 1]; pts.push(P(Math.max(edge, off + 0.004) + 0.01, e.y - drop)); kinds.push('hang'); }
      { const e = pts[pts.length - 1]; pts.push(e.clone().addScaledVector(u, 50)); kinds.push('lie'); }
      const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + pts[k].distanceTo(pts[k - 1]));
      const rimS = cum[2], floorS = cum[pts.length - 2];
      const at = (s) => {
        let k = 0; while (k < kinds.length - 1 && s > cum[k + 1]) k++;
        const seg = cum[k + 1] - cum[k], f = seg > 0 ? Math.min(1, Math.max(0, (s - cum[k]) / seg)) : 0;
        return { pos: pts[k].clone().lerp(pts[k + 1], f), kind: kinds[k], tan: pts[k + 1].clone().sub(pts[k]).normalize() };
      };
      const plantLen = o.plant && Number.isFinite(o.plant.lengthM) ? o.plant.lengthM : (Number.isFinite(topRow.at) ? topRow.at : 0);
      const atFloor = !!(o.plant && o.plant.atFloor);
      const len = atFloor ? Math.max(plantLen, floorS) : plantLen;
      const stemMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(D.stem_color || '#7a9a52'), roughness: 0.7 });
      stemMat.userData = { cloned: true };
      const hangG = new THREE.Group(); hangG.name = 'speciesHang'; g.add(hangG);
      const tube = (s0, s1, parent) => {
        if (!(s1 - s0 > 0.004)) return;
        const n = Math.max(2, Math.ceil((s1 - s0) / 0.008)), ps = [];
        for (let k = 0; k <= n; k++) ps.push(at(s0 + (s1 - s0) * k / n).pos);
        const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ps, false, 'centripetal'), n * 2, r, 6, false), stemMat);
        m.castShadow = true; m.receiveShadow = true; m.userData.part = 'stem';
        parent.add(m);
      };
      tube(0, Math.min(len, rimS), body);
      tube(rimS, len, hangG);
      const side = (D.side_deg ?? 35) * deg, beta = (D.hang_leaf_deg ?? 40) * deg;
      const floorY = pts[pts.length - 1].y - r;                                       // 바닥(dropM 이 없으면 받침) 높이
      const potGround = edge > off + 0.01 ? -potH : floorY;                           // 화분 옆면 잎 밑 — 받침이 앞으로 나와 있으면 받침 윗면
      let hangLeaves = 0;
      rows.forEach((row, i) => {
        const s = Math.min(len, Number.isFinite(row.at) ? row.at : (i + 1) * 0.04);
        const q = at(s), sgn = row.no % 2 ? 1 : -1;
        const jit = (k) => (u01(seed, row.no, 103 + k) * 2 - 1) * (D.jitter_deg ?? 0) * deg;   // 잎마다 조금씩(씨앗 · 마디 번호) — 사다리처럼 안 보이게
        const w = u.clone().applyAxisAngle(Y, sgn * side + jit(0));                  // 좌우로 엇갈린 바깥
        if (q.kind === 'rise') { placeLeaf(row, i, q.pos, Math.atan2(w.x, w.z)); return; }
        const pos = q.pos.clone().addScaledVector(w, r);
        /* 누운 잎 — 겉면이 위 · 그 몫의 바닥(받침 윗면 또는 바닥)에 맞춰 든다 */
        const g0 = q.kind === 'lie' ? q.pos.y - r : q.kind === 'pot' ? potGround : floorY;
        const lie = { t: w.clone().addScaledVector(Y, 0.25), n: Y.clone().addScaledVector(w, -0.25), ground: g0, pose: 'lie' };
        if (q.kind === 'lie') placeLeafAxes(row, pos, () => lie, hangG);
        else {
          /* 늘어진 잎 — 끝이 아래·바깥 · 겉면이 바깥·조금 위. 잎끝이 바닥을 뚫으면(바닥 바로 위 마디) 바닥에 눕힌다 */
          const bj = beta + jit(1);
          const hang = { t: Y.clone().multiplyScalar(-Math.cos(bj)).addScaledVector(w, Math.sin(bj)),
                         n: w.clone().multiplyScalar(Math.cos(bj)).addScaledVector(Y, Math.sin(bj)), ground: g0, pose: 'hang' };
          placeLeafAxes(row, pos, low => (pos.y + low(hang.t, hang.n) < g0 ? lie : hang), hangG);
        }
        hangLeaves++;
      });
      hangInfo = { given: !!H, potHGiven: !!(H && Number.isFinite(H.potH)), potDGiven: Number.isFinite(o.potD) && o.potD > 0, dropM: drop, potH, az, edgeDrawnM: edge, lengthM: len, plantLengthM: plantLen, floorLenM: floorS, rimLenM: rimS,
        atFloor, hangLeaves, lowestY: -potH - drop };
    } else return null;                                          // 모르는 꼴 — 지어내지 않는다

    /* 크기 — «화분 위 몫»(body)만. 늘어진 줄기(hang)는 칸 붐빔(D55)에 안 든다 · PP·AL 은 body 가 곧 그루 전체(예전과 같은 수) */
    const bb = new THREE.Box3().setFromObject(body);
    g.userData = {
      isPlantAssembled: true, kind: 'youngPlant', species, seed,
      leafCount: drawn, leafCountWanted: N, leafRows: rows.map(r => ({ ...r })),
      leaves: [], leafPivots: pivots, droppedParts: [],
      varieLeafKeys: [...varieKeys], missingAssets: missing,
      skinsPending: missing.filter(a => pending.has(a)).length,
      failedAssets: missing.filter(a => failed.has(a)),
      growthDays: null, nextLeaf01Given: true, tiltClamped: clamped, night: nightMult !== 1,
      sizeM: { h: bb.isEmpty() ? 0 : (bb.max.y - bb.min.y), d: bb.isEmpty() ? 0 : rotSafeDiameter(body) }
    };
    if (hangInfo) { g.userData.hang = hangInfo; g.userData.hangGiven = hangInfo.given; }
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
