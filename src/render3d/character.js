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

const BASE = './assets/characters/3d';
/* idle·walking 원본은 메시를 통째로 다시 담고 있어 14MB씩이다.
   tools/strip_anim_glb.js 로 클립만 뽑아 70KB/35KB로 줄인 파생본을 쓴다.
   (원본 assets/characters 는 다른 작업창 담당이라 건드리지 않는다) */
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
  const g = await load(`${BASE}/char_${charId}_rigged.glb`);
  const model = g.scene;

  /* 크기 정규화 — 키 1.65m로 맞춘다.
     ★ Box3.setFromObject 를 쓰면 안 된다. 스킨드 메시는 정점이 뼈 행렬로 움직이는데
       Box3는 메시 노드의 월드 행렬만 보므로 0.01m 같은 엉뚱한 값이 나온다(실측 확인).
       바인드 포즈가 들어 있는 geometry.boundingBox 가 실제 크기다(이 에셋은 1.70m). */
  let bindH = 0, bindMinY = 0;
  model.traverse(o => {
    if (o.isSkinnedMesh && !bindH) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      bindH = bb.max.y - bb.min.y;
      bindMinY = bb.min.y;
    }
  });
  const targetH = opt.height ?? 1.65;
  const k = bindH > 0.05 ? targetH / bindH : 1;
  model.scale.setScalar(k);
  model.position.y = -bindMinY * k;          // 발바닥을 y=0에

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
  let emoteBusy = false;

  const ctl = {
    root, model, mixer, actions,
    get position() { return root.position; },

    setPosition(x, z, y = 0) { root.position.set(x, y, z); },

    /* 바닥의 (x,z)로 걸어가기 */
    moveTo(x, z) {
      if (emoteBusy) return;
      target.set(x, root.position.y, z);
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

    update(dt) {
      mixer.update(dt);
      if (!moving) return;
      const d = target.clone().sub(root.position);
      d.y = 0;
      const dist = d.length();
      if (dist < 0.06) { moving = false; if (!emoteBusy) play('idle'); return; }
      d.normalize();
      root.position.addScaledVector(d, Math.min(SPEED * dt, dist));
      // 진행 방향 바라보기 (부드럽게)
      const want = Math.atan2(d.x, d.z);
      let diff = want - root.rotation.y;
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
