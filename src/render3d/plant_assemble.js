/* ============================================================
   render3d/plant_assemble.js — 방에 놓을 몬스테라를 "생장 창과 같은 코드"로 조립한다
   ------------------------------------------------------------
   ★ 이 파일은 조립 로직을 **한 줄도 갖고 있지 않다.**
     plant_grow.html 의 본문 스크립트를 그대로 가져와 함수 스코프에서 평가하고,
     그 안의 buildPlant() 를 불러 THREE.Group 을 받아 온다.

   왜 이렇게 했나 (박사님께 드리는 근거)
   ------------------------------------------------------------
   plant_sample.js 는 잎 5장을 고정 배치표로 놓는 자리채움이었다. 방과 확대가
   서로 다른 물건이라 "크는 게 보이지" 않았다. 한 벌로 합쳐야 한다.

   ㉠ 조립부를 모듈로 추출하고 plant_grow.html 이 import 하게 → **못 한다.**
      tools/test_maturation.mjs 가 plant_grow.html 의 **마지막 인라인 <script> 블록을
      정규식으로 뽑아 node:vm 에서 돌린다.** 본문을 type="module" 로 바꾸면 그 정규식이
      안 맞아 A~M 재현이 통째로 죽고, 별도 .js 로 빼면 vm 안에서 그 코드가 사라진다.
      안전망을 부수면서 안전선을 지킬 수는 없다.
   ㉡ 복사 → 두 벌이 되어 반드시 어긋난다. 박사님이 걱정하신 그것이다.
   ㉢ 오프스크린 iframe → WebGL 컨텍스트가 갈라진다. 폰에서 비싸다.

   ㉣ **원본을 텍스트로 가져와 이 페이지의 THREE 로 평가한다** ← 채택
      test_maturation.mjs 가 node:vm 에서 하는 일과 같은 것을 브라우저에서 한다
      (같은 정규식 · 같은 init() 제거). 그래서
        · 원본은 **한 글자도 안 고친다** → 재현 A~M·첫 플레이 전부 그대로
        · 복사본이 없다 → 어긋날 수가 없다
        · WebGL 컨텍스트가 하나다 → 결과 Group 을 방 씬에 그대로 얹는다
      대가는 "런타임에 HTML 을 fetch 한다" 하나뿐이고, 실패하면 호출부가
      plant_sample.js 로 내려앉게 되어 있다(room_view.js).

   한계 (정직하게)
   ------------------------------------------------------------
   · ★★ **무늬종(variegata) 스킨은 「쓸 때 한 장」씩 받는다** (2026-08-18. 그전에는 아예 안 받았다)
     ------------------------------------------------------------
     실측(2026-08-16 낮): `ASSET_FILES` 113개 중 `skins/` 가 100장 443.4MB 였다.
     ★ **2026-08-16 밤 — 33.8MB 로 줄었다**(텍스처 2048 → 1024 · JPEG q88 4:4:4).
       갈래는 하나도 안 줄였다(19갈래 × 3판 = 57 그대로). 원본은 `skins/_orig/` 에 있다.
       자세한 것은 `docs/handoff/skinshrink-to-plan.md`.
     그래서 예전에는 여기서 `skins/` 를 **ASSET_FILES 에서 통째로 지우고** 원본 loadAssets 를
     불렀다. 무늬가 **났더라도** 방에서는 민무늬로 그려졌다(캐논이 깨진 채였다).

     2026-08-17 에 원본이 바뀌었다 — `loadAssets` 는 이제 **skins/ 를 스스로 건너뛰고**,
     그 잎이 실제로 그 무늬를 쓸 때 `ensureSkin(k)` 이 **그 한 장만** 받는다.
     ⇒ 그때부터 여기서 목록을 지우는 일은 **「안 받게 하는 것」이 아니라 「받을 수 없게 하는 것」**
       하나만 하고 있었다(`ensureSkin` 은 `ASSET_FILES[k]` 가 없으면 그 자리에서 거짓을 준다).
     ⇒ 그래서 지우지 않는다. **부팅 때 받는 양은 한 바이트도 안 늘고**(loadAssets 가 안 받는다),
       무늬가 난 잎이 그려질 때만 그 한 장이 온다.

     ⚠ 늦게 오므로 **처음 한 번은 기본잎으로 그려진다.** 도착하면 다시 그려야 한다 —
       `onSkinChange(cb)` 로 알린다(호출부 room_view.js 가 그 그루만 다시 짓는다).
     ⚠ `opt.lazySkins:false` 를 주면 옛 동작(통째로 지우기)으로 돌아간다.

   · ★★ **이 인스턴스는 「빛 이력」이 없다. 그래서 스스로 굴리면 답이 정해져 있다.**
     `setDailyLight` 을 한 번도 안 부르므로 `dli7()` 이 늘 null 이고, 그 결과
       - `calcVarieProb()` = **0** → `varieRoll` 이 **언제나 false** (무늬가 날 수 없다)
       - `calcMatureProb()` = 하한(roll_lo) → `matCatchUp` 이 잎마다 **딱 한 번 10%**
     실측(seed 92158 · 2026-08-16): 방 조립은 **유효 1000일에도 갈라진 잎 0장**이었다.
     같은 시드를 확대창에서 하루씩 걸으면 DLI 4.8(반지하 창턱)에서도 유효 300일에
     잎 5장 중 2장, 1000일에 8장 중 7장이 갈라진다.
     ⇒ **방이 자기 굴림으로 그리면 확대창과 다른 그루가 된다.** 그래서 아래
       `assemble({ leafState })` 로 **정본이 정한 잎별 상태를 받아** 그린다.
       안 주면 예전 그대로 굴린다(옛 호출부가 안 깨진다).

   · plant_grow.html 의 localStorage 튜닝 저장본(mcfg_default)은 안 읽는다.
     그 창에서 슬라이더를 만져 저장해 둔 상태는 방에 반영되지 않는다(기본값+ADJ_TUNED).
============================================================ */

/* 저장소 뿌리 — 이 파일이 src/render3d/ 에 있다는 사실로만 푼다.
   호스트 페이지가 뿌리에 있든 tools/ 아래에 있든 같은 곳을 가리켜야 한다. */
const ROOT = new URL('../../', import.meta.url);
const AT = p => new URL(p, ROOT).href;

/* 원본 스크립트를 이 페이지에서 돌리기 위해 넘겨 주는 것들.
   ★ 원본은 전역 document/localStorage/fetch 를 그대로 쓴다. 함수 인자로 같은 이름을
     넘기면 그 스코프 안에서만 가려진다 — 원본을 안 고치고 격리하는 유일한 방법이다. */

/* 화면이 없는 자리에 쓰는 가짜 DOM 노드.
   원본 buildPlant 는 마지막 줄에서 document.getElementById('stat').innerHTML 을 쓴다.
   null 을 돌려주면 거기서 던진다 — 다 그려 놓고 마지막에 터지는, 제일 헷갈리는 실패다. */
function stubEl() {
  return {
    innerHTML: '', textContent: '', value: '', checked: false,
    dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, insertAdjacentHTML() {}, addEventListener() {}, removeEventListener() {},
    setAttribute() {}, getAttribute() { return null; }, focus() {}, remove() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, getContext() { return null; }
  };
}

/* getElementById 만 가리고 createElement 는 진짜를 쓴다 —
   잎자루 색을 텍스처에서 뽑을 때 진짜 <canvas> 2D 컨텍스트가 필요하다. */
function stubDocument(realDoc) {
  const shared = stubEl();
  return {
    getElementById() { return shared; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement: (t) => realDoc.createElement(t),
    createElementNS: (ns, t) => realDoc.createElementNS(ns, t),
    addEventListener() {}, removeEventListener() {},
    body: shared, documentElement: shared
  };
}

/* 원본은 './data/growth_tuning.json' 을 페이지 상대 경로로 읽는다.
   tools/ 아래 페이지에서 열면 404 가 난다 — 뿌리 기준으로 다시 매어 준다. */
function rootFetch(url, opt) {
  const s = String(url);
  return fetch(/^[a-z]+:|^\//i.test(s) ? s : AT(s.replace(/^\.\//, '')), opt);
}

/* ============================================================
   원본 스크립트 뽑기 — test_maturation.mjs 와 **같은 규칙**을 쓴다.
   여기와 저기가 다른 규칙을 쓰면, 한쪽만 통과하는 날이 온다.
============================================================ */
async function fetchGrowthSource() {
  const r = await fetch(AT('plant_grow.html'));
  if (!r.ok) throw new Error(`plant_grow.html 을 못 읽었습니다 (${r.status}) — 파일이 아니라 서버로 여십시오`);
  const html = await r.text();
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const main = blocks[blocks.length - 1];
  if (!main || main.length < 20000)
    throw new Error('plant_grow.html 본문 스크립트를 못 찾았습니다 — <script> 구조가 바뀌었습니다');
  /* ★ init() 만 걷어낸다. 그 위는 한 글자도 안 바꾼다.
     (test_maturation.mjs 62행과 같은 치환이다 — 같이 바꿔야 한다면 둘 다 터진다) */
  const src = main.replace(/\n\s*init\(\);\s*updateCam\(\);\s*$/, '\n/* init() 제거(방 조립) */\n');
  if (src === main) throw new Error('init() 호출부를 못 찾았습니다 — plant_grow.html 끝이 바뀌었습니다');
  return src;
}

/* 평가 뒤에 덧붙이는 꼬리 — 밖에서 만질 손잡이만 낸다.
   ★ 여기에 조립 로직을 쓰지 않는다. 쓰는 순간 두 벌이 된다. */
const TAIL = `
;return {
  buildPlant, setGrowth, plantSeed, growthPhase, phaseAt, ageOf, dayOfAge,
  growthDays, calendarDay, matResetAll, setDailyLightSteady, resetDailyLight,
  loadAssets, thLoaded, GMAX, ASSET_FILES, ASSETS,
  /* ★ 읽기 창구 둘 (2026-08-16 · §branchOf) — 떼어낸 가지가 **정본과 같은가**를
     여기서 바로 물어보려고 낸다. 원본이 이미 갖고 있던 함수를 그대로 낼 뿐이다. */
  cuttableNodes, leafStats,
  /* ★ 무늬 한 장 늦게 받기 (2026-08-18) — 원본이 2026-08-17 에 낸 손잡이를 그대로 낸다.
     여기에 로직을 쓰지 않는다. 쓰는 순간 두 벌이 된다. */
  ensureSkin, skinsPending, skinsLoaded, isSkinKey,
  /* 원본의 3D 무대는 init() 이 만든다. 그걸 걷어냈으니 담을 그릇만 밖에서 준다. */
  __setPlantGroup(g){ plantGroup = g; },
  /* 방의 창 방향 = 이 그루가 받는 빛의 방향. 굴광성이 그쪽으로 기울게 한다. */
  __setLight(az, photo){ if(az!=null) LIGHT_AZ = az; if(photo!=null) PHOTO = photo; },
  /* ★★ 정본이 정한 **잎별 상태**를 이 인스턴스에 그대로 앉힌다 (2026-08-16).
     ------------------------------------------------------------
     ⚠ 이 블록은 템플릿 문자열 안이다 — **역따옴표를 쓰지 마라**(문자열이 그 자리에서 끝난다).
     ⚠ 이것은 "밖에서 성숙을 켜는 세터"가 아니다. 원본이 세터를 안 둔 이유는
       *굴림이 장식이 되지 않게*였고, 그 대상은 **판정을 하는 그루**(확대창)다.
       여기 인스턴스는 판정을 하면 안 되는 **그리개**다 — 빛 이력이 없어서 굴리면
       무늬 0 · 갈라짐 거의 0 으로 답이 정해져 있다(위 §한계). 그러니 여기서 굴리는 것이
       오히려 "두 벌"이고, 정본을 받아 그리는 것이 한 벌로 되돌리는 일이다.
     ★ rolls:1 을 박아 두는 이유: matCatchUp 이 rolls>0 인 잎을 건너뛴다.
       목록에 든 잎은 이 인스턴스가 **다시 굴리지 않는다.**
     ★ 아직 안 성숙한 잎에 locked:true 를 주는 것도 같은 뜻이다 —
       "이 잎은 중간잎이다"를 정본이 이미 정했다는 표시지, 새 규칙이 아니다.
     반환: 실제로 앉힌 잎 수 */
  __setLeafState(list){
    matResetAll();
    if(!Array.isArray(list)) return 0;
    let n = 0;
    for(const it of list){
      const lb = it && it.leafBirth;
      if(typeof lb !== 'number' || !isFinite(lb)) continue;
      VARIE_STATE.set(lb, !!it.varie);
      MAT_STATE.set(lb, { gauge: it.matured ? 0 : 1, matured: !!it.matured,
                          rolls: 1, locked: !it.matured });
      const f = Math.max(0, Math.min(1, Number(it.fade) || 0));
      if(f > 0 || it.dropped) LEAF_HEALTH.set(lb, { fade: f, dropped: !!it.dropped, hold: 0 });
      n++;
    }
    return n;
  },
  __params(){ return { seedEnd:P.seedEnd, sproutEnd:P.sproutEnd, spawnStep:P.spawnStep,
                       matSpan:P.matSpan, stageYoung:P.stageYoung, stageMid:P.stageMid }; }
};`;

/* ============================================================
   싱글턴 — 한 페이지에 한 번만 평가하고 한 번만 GLB 를 싣는다.
   방에 여러 그루가 놓여도 에셋은 한 벌이다.
============================================================ */
let _instance = null;

export function isPlantAssemblerReady() { return !!(_instance && _instance.settled && _instance.ok); }

/* 실패했으면 다시 안 부른다 — 매 화분마다 510MB 짜리 실패를 반복할 이유가 없다 */
export function plantAssemblerError() { return _instance && _instance.settled ? _instance.err : null; }

/**
 * getPlantAssembler(opt) → Promise<assembler>
 *   opt.preloadKeys  더 실을 ASSET_FILES 키(무늬 스킨 등). 기본은 skins/ 제외 전부
 *   opt.timeoutMs    GLB 로딩 상한. 넘으면 거절한다(방이 영원히 안 뜨는 것보다 낫다)
 */
export function getPlantAssembler(opt = {}) {
  if (_instance) return _instance.promise;
  const rec = { settled: false, ok: false, err: null, promise: null };
  _instance = rec;
  rec.promise = build(opt).then(
    a => { rec.settled = true; rec.ok = true; return a; },
    e => { rec.settled = true; rec.err = e; throw e; }
  );
  return rec.promise;
}

async function build(opt) {
  if (typeof THREE === 'undefined') throw new Error('THREE 미로드');
  if (!THREE.GLTFLoader) throw new Error('GLTFLoader 미로드');

  const src = await fetchGrowthSource();

  /* ★ new Function 으로 **함수 스코프**를 만든다. 원본의 let/const/function 전역이
     이 스코프에 갇혀 호스트 페이지(game.html)의 이름과 절대 안 부딪친다.
     인자 이름으로 document/fetch 등을 가려 화면 없는 환경에서도 돌게 한다. */
  let factory;
  try {
    factory = new Function(
      'THREE', 'document', 'window', 'self', 'globalThis', 'localStorage', 'fetch',
      'location', 'requestAnimationFrame', 'cancelAnimationFrame',
      'setInterval', 'clearInterval', 'addEventListener', 'removeEventListener',
      'innerWidth', 'innerHeight', 'console',
      '"use strict";\n' + src + TAIL);
  } catch (e) {
    throw new Error(`plant_grow.html 본문을 못 읽어들였습니다: ${e.message}`);
  }

  /* 원본이 콘솔에 쏟는 것 중 "load fail" 은 스킨 미로딩이라 예상된 것이다.
     그것까지 그대로 흘리면 방 데모 기록창이 100줄 넘게 빨개져 진짜 문제가 묻힌다. */
  const quiet = {
    log() {},
    info() {},
    warn: (...a) => { const s = a.join(' '); if (!/^(load fail|norm fail)/.test(s)) console.warn('[생장모듈]', ...a); },
    error: (...a) => console.error('[생장모듈]', ...a)
  };

  const noop = () => 0;
  const G = factory(
    THREE, stubDocument(document), {}, {}, {},
    { getItem() { return null; }, setItem() {}, removeItem() {} },
    rootFetch,
    { search: '', href: AT('plant_grow.html') },
    noop, noop, noop, noop, noop, noop, 390, 844, quiet);

  /* 조립 결과를 받아 낼 그릇. 원본은 이 그룹을 비우고 다시 채운다.
     ★ GLB 를 싣기 **전에** 물려야 한다. 원본은 임계값 정본(growth_tuning.json)이 실리면
       그 자리에서 redraw() 를 부르는데, 그릇이 없으면 거기서 한 번 터진다(로그가 지저분해진다). */
  const stage = new THREE.Group();
  G.__setPlantGroup(stage);

  /* ── GLB ──
     ★ 원본 `loadAssets` 는 **skins/ 를 스스로 건너뛴다**(2026-08-17 §ensureSkin).
       그러니 여기서 목록을 지울 이유가 없다 — 지우면 부팅이 가벼워지는 게 아니라
       **나중에 한 장 받는 길까지 막힌다.** 목록에 남겨 두고, 그 잎이 그 무늬를 쓸 때 받는다.
     ⚠ `opt.lazySkins:false` 면 옛 동작(통째로 지우기)이다. 무늬가 절대 안 나온다. */
  const want = new Set(opt.preloadKeys || []);
  const skinKeys = new Set();                        // 이 목록에 든 assetKey = 무늬 스킨이다
  const dropped = [];
  for (const [k, v] of Object.entries(G.ASSET_FILES)) {
    if (!String(v).startsWith('skins/')) continue;
    skinKeys.add(k);
    if (opt.lazySkins === false && !want.has(k)) { dropped.push(k); delete G.ASSET_FILES[k]; }
  }

  const t0 = performance.now();
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('몬스테라 GLB 로딩이 너무 오래 걸립니다')), opt.timeoutMs ?? 45000);
    G.loadAssets(() => { clearTimeout(to); res(); });
  });
  /* ⚠ `preloadKeys` 로 지정한 무늬는 **loadAssets 가 안 싣는다**(그쪽은 skins/ 를 건너뛴다).
     지정한 뜻은 "여는 동안 받아 둬라"이므로 여기서 받고 기다린다. 안 그러면 이 옵션이
     조용히 아무 일도 안 하는 손잡이가 된다. */
  const preSkins = [...want].filter(k => skinKeys.has(k) && G.ASSET_FILES[k]);
  if (preSkins.length) await Promise.all(preSkins.map(k =>
    new Promise(res => { if (!G.ensureSkin(k, () => res())) res(); })));
  const loadMs = Math.round(performance.now() - t0);

  /* ★ 원본(ASSETS) 이 들고 있는 기하 목록.
     조립본은 THREE.clone(true) 로 만들어져 **기하를 원본과 공유한다.** 호출부가
     화분을 치우며 geometry.dispose() 를 부르면 원본까지 GPU 에서 내려가 다음 그루가
     다시 올려야 한다(매일 다시 짓는 화면에서는 그대로 프레임 값이 된다).
     어느 기하가 공유본인지 여기서 표시해 둔다 — 판단은 호출부가 한다. */
  const protoGeo = new Set();
  function scanProtoGeo() {
    for (const k in G.ASSETS) {
      const p = G.ASSETS[k];
      if (p && p.traverse) p.traverse(o => { if (o.isMesh && o.geometry) protoGeo.add(o.geometry.uuid); });
    }
  }
  scanProtoGeo();
  /* ⚠⚠ 무늬는 **여기 이후에** 온다. 그때 다시 훑지 않으면 새로 온 무늬의 기하가 이 목록에
     없어서, 호출부가 화분을 치울 때 `dispose()` 로 **원본 무늬를 GPU 에서 내려 버린다** —
     다음에 같은 무늬를 그리면 빈 잎이 된다. 받은 장수가 바뀌면 다시 훑는다(§skinScan). */
  let skinScan = G.skinsLoaded();

  /* 마지막으로 조립한 값 — 같은 값이면 두 번 안 짓는다 */
  let lastKey = null, lastResult = null;

  /* ── ★ 무늬가 도착하면 알린다 (2026-08-18) ──
     ------------------------------------------------------------
     `ensureSkin` 은 원본 안에서 `redraw()` 로 **원본의 그루**를 다시 그린다. 그런데 방의
     그루는 `assemble()` 이 이미 stage 에서 **꺼내 간 뒤**라 그 redraw 가 방에는 안 닿는다.
     ⇒ 호출부가 그 그루를 다시 지을 수 있게 여기서 알린다.
     ⚠ 원본에 훅을 달 수 없다(plant_grow.html 은 다른 창 것이다). 그래서 **밖에서 지켜본다** —
       받는 중일 때만 도는 시계라, 받을 것이 없으면 한 번도 안 돈다. */
  const skinSubs = new Set();
  let skinTimer = null, lastLoaded = G.skinsLoaded();
  function watchSkins() {
    if (skinTimer) return;
    skinTimer = setInterval(() => {
      const pend = G.skinsPending(), loaded = G.skinsLoaded();
      const changed = loaded !== lastLoaded;
      lastLoaded = loaded;
      if (!pend) { clearInterval(skinTimer); skinTimer = null; }
      if (!changed && pend) return;
      if (!changed && !pend) return;                 // 다 실패했다 — 알릴 그림이 없다
      for (const f of skinSubs) { try { f({ loaded, pending: pend }); } catch (e) { console.warn('[생장모듈] 무늬 알림 실패', e); } }
    }, 150);
  }

  /* ── 단계 이름 → 유효 생장일 ──
     ------------------------------------------------------------
     ★ 정확한 길은 호출부가 growthDays() 를 그대로 넘기는 것이다. 아래는 그게 없을 때의 길이다.

     game.html 은 growthPhase() 의 {phaseId, progress01} 만 넘긴다. progress01 은
     **그 단계 안에서의 진행도**라 되짚을 수가 없다 — spear_furled 는 축이 날 때마다
     되풀이되므로 같은 (단계, 진행도) 가 여러 날에 걸쳐 나온다.
     "처음 그 단계에 닿는 날"로 찍으면 146일짜리 첫 플레이 개체가 방에서는 15일짜리
     새싹으로 보인다(실제로 그랬다).

     그래서 **단조**로 되짚는다. 형태 진행은 뒤로 안 가므로, 지금 그 자리에 서 있는 날을
     하한으로 주면 "그 날 이후 처음 오는 그 단계"가 유일하게 정해진다. 턴마다 한 번씩
     불리는 한(게임이 그렇다) 실제 타임라인을 그대로 따라간다.

     ⚠ 표는 성숙 이력이 비었을 때 한 번만 만든다(그래야 값이 안 흔들린다).
       그래서 leaf_mature 는 표에 안 나올 수 있다 — 성숙은 굴림에 성공해야 나오기 때문이다.
       그 경우 null 을 돌려주고 호출부가 마지막 수단으로 내려간다. */
  const PHASE_LIMIT = 420;         // 첫 주기 몇 바퀴면 충분하다. 전 구간(1095)은 비싸다
  const phaseRuns = new Map();     // phaseId → [[시작일, 끝일), ...]
  (function buildPhaseTable() {
    let prev = null, start = 0;
    const push = (id, a, b) => {
      if (!phaseRuns.has(id)) phaseRuns.set(id, []);
      phaseRuns.get(id).push([a, b]);
    };
    for (let d = 0; d <= PHASE_LIMIT; d++) {
      let id;
      try { id = G.phaseAt(d); } catch (e) { break; }
      if (id !== prev) {
        if (prev !== null) push(prev, start, d);
        prev = id; start = d;
      }
    }
    if (prev !== null) push(prev, start, PHASE_LIMIT + 1);
  })();

  const assembler = {
    /* 진단용 — 무엇을 얼마나 실었나 */
    info: { loadMs, loadedKeys: Object.keys(G.ASSET_FILES).length, skippedSkins: dropped.length,
            lazySkins: opt.lazySkins !== false, skinKeys: skinKeys.size },

    /* ★ 무늬 — 지금 몇 장 받는 중인가 · 몇 장 받았나 (2026-08-18) */
    skinsPending() { return G.skinsPending(); },
    skinsLoaded() { return G.skinsLoaded(); },
    /* 무늬가 한 장 도착할 때마다 부른다. 되돌려 주는 것은 **끊는 함수**다.
       ⚠ 여기서 다시 assemble 을 부르는 것은 **호출부 몫**이다 — 어느 그루가 그 무늬를
         쓰는지는 여기가 모른다(이 인스턴스는 그루를 한 벌만 기억한다). */
    onSkinChange(cb) { skinSubs.add(cb); return () => skinSubs.delete(cb); },

    GMAX: G.GMAX,
    params: G.__params(),

    /* phaseId(+단계 내 진행도) → 유효 생장일. 모르는 단계면 null.
       minDay 는 "형태는 뒤로 안 간다"는 하한이다 — 지금 그 자리에 서 있는 날을 주면
       되풀이되는 단계도 어느 바퀴인지 정해진다. */
    daysForPhase(phaseId, p01, minDay) {
      const runs = phaseRuns.get(phaseId);
      if (!runs || !runs.length) return null;
      const t = Math.max(0, Math.min(1, +p01 || 0));
      const at = r => Math.round(r[0] + (r[1] - 1 - r[0]) * t);
      const lo = Number.isFinite(minDay) ? minDay : -1;
      for (const r of runs) if (lo >= r[0] && lo < r[1]) return Math.max(lo, at(r));   // 아직 그 단계 안
      for (const r of runs) if (r[0] >= lo) return at(r);                              // 그 뒤 첫 바퀴
      return at(runs[runs.length - 1]);
    },
    phaseOfDays(days) {
      try { return G.phaseAt(Math.max(0, Math.round(days))); } catch (e) { return null; }
    },

    /**
     * assemble({ growthDays, seed, potD, lightAz, photo, leafState }) → THREE.Group
     *   바닥 y=0 기준. 화분 지름이 potD[m] 가 되도록 통째로 줄인다.
     *   ★ 동기 함수다. GLB 는 이미 다 실려 있다 — 진행도가 바뀔 때마다
     *     네트워크를 타면 빨리감기에서 프레임이 끊긴다.
     *
     *   leafState  ★ **정본(확대창)이 정한 잎별 상태.** 형태는 여기서 짓지만 상태는 안 짓는다.
     *              `[{ leafBirth, varie, matured, fade, dropped }]`
     *              growth 쪽 `varieStateAll()`·`matStateAll()`·`leafHealthAll()` 을
     *              leafBirth 로 합치면 그대로 이 모양이다.
     *              **안 주면 예전 그대로** — 이 인스턴스가 스스로 굴린다(위 §한계 참고).
     */
    assemble(o = {}) {
      const days = Math.max(0, Math.min(G.GMAX, Math.round(o.growthDays ?? 0)));
      const seed = (o.seed ?? 92158) >>> 0;
      const potD = o.potD ?? 0.20;
      const az = o.lightAz ?? Math.PI * 0.5;
      const photo = o.photo ?? 0.5;
      const leafState = Array.isArray(o.leafState) ? o.leafState : null;

      /* 무늬가 새로 왔으면 「원본과 나눠 쓰는 기하」 목록을 다시 훑는다 (§skinScan) */
      { const sl = G.skinsLoaded(); if (sl !== skinScan) { skinScan = sl; scanProtoGeo(); } }

      /* 잎 상태도 열쇠에 넣는다 — 안 넣으면 「같은 날인데 갈라짐만 바뀐」 하루가 안 그려진다 */
      const stateKey = leafState
        ? leafState.map(s => `${s.leafBirth}${s.varie ? 'v' : ''}${s.matured ? 'm' : ''}` +
                             `${s.dropped ? 'x' : ''}${s.fade ? '.' + Math.round(s.fade * 10) : ''}`).join(',')
        : '';
      const key = `${days}|${seed}|${az.toFixed(3)}|${photo.toFixed(2)}|${stateKey}`;
      if (key !== lastKey) {
        G.__setLight(az, photo);
        /* 씨앗이 바뀌면 성숙 이력을 버린다(원본 plantSeed 가 하는 일 그대로).
           그리기는 어차피 아래에서 다시 하므로 여기서 난 예외는 삼킨다. */
        try { G.plantSeed(seed); } catch (e) { /* plantSeed 안의 buildPlant 실패 — 바로 아래에서 다시 짓는다 */ }
        /* ★ plantSeed 뒤 · setGrowth 앞이라야 한다. 앞이면 plantSeed 의 matResetAll 이 지우고,
           뒤면 setGrowth 안의 matCatchUp 이 이미 제 굴림을 해 버린 뒤다. */
        if (leafState) G.__setLeafState(leafState);
        const r = G.setGrowth(days);        // 원본 경로 그대로: matCatchUp → buildPlant
        if (!r || !r.drawn) throw new Error(`몬스테라 조립 실패: ${(r && r.drawError) || '알 수 없음'}`);
        lastKey = key;
        lastResult = null;
      }

      /* stage 에 담긴 것을 새 그룹으로 옮긴다. 다음 조립이 stage 를 비우므로
         복제가 아니라 **이관**해야 한다(복제하면 잎 100장이 두 벌이 된다).

         ★ 두 겹으로 싼다. 바깥(g)은 배율 1 이고 안(inner)이 줄어든다.
           호출부는 `rotationSafeDiameter(potPart, 화분그룹)` 으로 자리 한도를 보는데,
           그 함수는 **기준 그룹의 로컬 좌표계**에서 재므로 바깥에 배율을 걸면 그 배율이
           측정에서 빠진다 — 0.20m 화분이 0.90m 로 읽혀 자리마다 "안 들어간다"가 뜬다
           (실제로 그랬다. 그리고 호출부가 한 번 더 줄여 식물이 4분의 1로 나왔다). */
      const inner = new THREE.Group();
      let pot = null;
      for (const c of [...stage.children]) {
        stage.remove(c);
        inner.add(c);
        if (!pot && c.userData && c.userData.assetKey === 'pot') pot = c;
      }
      lastKey = null;                        // stage 를 비웠으니 다음엔 다시 지어야 한다
      if (!inner.children.length) throw new Error('몬스테라 조립 결과가 비었습니다');

      /* 화분이 없는 시기(씨앗)에도 화분은 항상 있다. 폴백 화분이면 assetKey 가 없다. */
      if (!pot) pot = inner.children[0];

      const g = new THREE.Group();
      g.add(inner);

      /* 크기 — 원본은 화분 지름 ≈1 유닛으로 짓는다. 방의 자리 한도에 맞춘다.
         ★ bbox 가 아니라 회전 무관 지름으로 잰다. 네모 화분은 돌리면 안 들어간다
           (core-to-house.md 2026-08-02 ④ · room_view.js 와 같은 기준). */
      const d0 = rotSafeDiameter(pot, inner);
      inner.scale.setScalar(d0 > 1e-6 ? potD / d0 : 1);

      g.userData.isPlantAssembled = true;
      g.userData.kind = 'monstera';
      g.userData.potPart = pot;
      g.userData.growthDays = days;
      g.userData.seed = seed;
      /* room_view.applyLook 이 밴드·시듦을 얹을 때 쓴다. 원본은 잎을 pivot 으로
         묶지 않으므로(마디 트리다) 처짐은 그룹 전체에 못 준다 — 색만 얹는다. */
      g.userData.leaves = [];
      /* ★ 무늬 잎에 표를 단다 (2026-08-18).
         ------------------------------------------------------------
         ⚠⚠ **무늬 텍스처에 단색 틴트를 씌우면 안 된다**(캐논 — 무늬가 곧 텍스처다).
           원본은 `KEEP_TEX` 로 그 잎을 tintObj 에서 빼 두었는데, 방에는 그 위에 **밴드 색**과
           **시듦 색**을 얹는 층이 하나 더 있다(room_view.applyLook). 그 층이 무늬를 덮으면
           캐논이 방에서만 깨진다 — 화면으로는 "무늬가 안 나온다"와 구별이 안 된다.
         ⇒ 잎 홀더의 assetKey 가 skins/ 것이고 **그 메시가 텍스처를 들고 있으면** 표를 단다.
         ★ 위에서 아래로 훑는다 — 잎몸 메시에는 assetKey 가 없고 홀더에만 있다.
         ★★ **`map` 이 있는 메시만** 단다. 같은 홀더 안에는 엽초도 들어 있는데(addSheathLocal)
           그쪽은 원본이 `tintObj` 로 줄기색을 칠하면서 map 을 지운 것이라 **무늬가 아니다.**
           통째로 달면 엽초가 밴드 색을 안 받아 잎만 시들고 엽초는 새것인 그루가 된다.
           실측(2026-08-18): 홀더 아래 메시 11개 중 map 이 있는 것은 5개(=잎몸)뿐이었다. */
      const varieKeys = new Set();
      (function markSkin(o, on) {
        const k = o.userData && o.userData.assetKey;
        const here = on || (k ? skinKeys.has(k) : false);
        if (here) {
          if (k && skinKeys.has(k)) varieKeys.add(k);
          const mats = o.isMesh ? (Array.isArray(o.material) ? o.material : (o.material ? [o.material] : [])) : [];
          if (mats.some(m => m && m.map)) o.userData.varieSkin = true;
        }
        for (const c of o.children) markSkin(c, here);
      })(g, false);
      g.userData.varieLeafKeys = [...varieKeys];

      g.traverse(oo => {
        if (!oo.isMesh) return;
        oo.castShadow = true; oo.receiveShadow = true;
        /* 원본과 나눠 쓰는 기하는 버리면 안 된다 — 호출부가 이 표시를 보고 건너뛴다 */
        if (oo.geometry && protoGeo.has(oo.geometry.uuid)) oo.userData.sharedGeometry = true;
      });

      /* ★ 이 그루가 아직 못 받은 무늬가 있으면 지금 받는 중이다 — 도착하면 다시 지어야 한다 */
      g.userData.skinsPending = G.skinsPending();
      if (g.userData.skinsPending) watchSkins();

      lastResult = g;
      return g;
    },

    /* ══════════════════════════════════════════════════════════════════════
       ★★★ branchOf — **모주에서 자란 그 가지를 그대로 떼어낸다** (2026-08-16)
       ══════════════════════════════════════════════════════════════════════
       박사님 원문(두 번): *"삽수 시, 기존에 자랐던 거 가지 그대로 잘라서 넣어줄래?"*
                          *"줄기 기존 자랐던 거 그대로 쓰라고."*

       지금까지 병 속의 줄기·잎은 **방 뷰가 새로 지어낸 것**이었다(원기둥 + 등급만 맞춘
       잎 GLB). 그래서 「자른 그 가지」가 아니라 **비슷하게 생긴 다른 가지**가 들어 있었다.

       ★ 지어낼 것이 하나도 없다. 같은 씨앗·같은 생장일이면 `assemble()` 이 **같은 형태**를
         낸다(이 파일의 존재 이유다). 그러니 **자를 때의 씨앗·생장일로 모주를 다시 지어,
         그 마디에서 위로 딸려 나가는 것만 떼어내면** 줄기 굵기·잎 무늬·휘어진 각도가
         전부 자란 그대로 나온다.

       어떻게 떼어내나 — `plant_grow §마디 표` 가 메시마다 적어 둔 표를 읽는다:
         `axisKey`  그 메시가 속한 축의 경로(`n0`·`n0.1`·`n0.1:1`)
         `part`     'stem' | 'bump' | 'leaf'
         `segIndex` 혹이 앉은 마디 번호 · `segT` 마디 경계의 t · `tubSeg`/`radSeg` 튜브 격자
       ⇒ 딸려 나가는 것 = ① 그 축의 잎 ② 그 축의 `segIndex ≥ i` 인 혹
                          ③ **그 축의 마디 i 이상에서 난 가지 전부**(그 아래로 통째로)
                          ④ 그 축의 줄기 튜브 중 **마디 i 위쪽**
         ③ 은 이름만 봐도 안다 — 가지의 경로는 `<부모경로>.<난 마디 번호>` 라서
         `axisKey` 가 `A.` 로 시작하면 그 다음 토막이 곧 「어느 마디에서 났나」다.
         (`cuttableNodes §carried` 가 트리를 타고 세는 것과 **같은 규칙**이다)

       ④ 는 **정점을 새로 만들지 않는다.** 튜브는 링 (tubSeg+1)개 × (radSeg+1)점 짜리
         규칙적인 격자라, 자를 링부터 끝까지를 **그대로 베껴 오면** 좌표가 한 비트도
         안 바뀐다. 새로 만드는 것은 **잘린 자리를 막는 뚜껑 한 장**뿐이다(안 막으면
         줄기 속이 들여다보인다).

       반환
         THREE.Group — **밑동이 원점**이다(병에 그대로 꽂을 수 있게).
         **null** — 모르는 마디 · 아직 안 난 마디 · 씨앗 · 조립 실패.
                    0 도 빈 그룹도 아니다(이 파일들의 규약이다 — 모르면 안 만든다).
       인자
         nodeId      `cuttableNodes()` 가 낸 그 이름(`n0#2`). **이것 하나가 어느 가지인지 정한다**
         growthDays  ★ **자를 때 모주의 유효 생장일**이다(조각이 자란 날이 아니다)
         seed        모주의 씨앗
         leafState   자를 때의 잎별 상태(안 주면 이 인스턴스가 굴린다 — 위 §한계)
         potD/lightAz/photo  모주를 그릴 때 쓴 값 그대로. 크기가 방의 모주와 같아진다

       userData (호출부가 검사·배치에 쓴다)
         kind:'cutting' · nodeId · axisKey · segIndex
         growthDays · seed · scale(모주와 같은 배율)
         leaves:[]            room_view.applyLook 이 처짐을 얹을 자리(모주와 같은 규약)
         leafCount            실제로 딸려 온 **잎 수**
         node                 정본 `cuttableNodes()` 의 그 줄(stem·leaves·leafBirths·leafKeys…)
         varieLeafKeys        딸려 온 무늬 잎 열쇠
         cutDir               자른 자리에서 줄기가 뻗는 방향(세워 꽂고 싶으면 이걸로 돌린다)
         sizeM {h,d}          떼어낸 뒤의 실제 높이·회전무관 지름[m] — 병에 맞춰 줄일 때 쓴다
         skinsPending         아직 못 받은 무늬가 있나(있으면 도착 뒤 다시 지어야 한다)
    */
    branchOf(o = {}) {
      const nodeId = String((o && o.nodeId) || '');
      const mm = /^(n[0-9.:]*)#(\d+)$/.exec(nodeId);
      if (!mm) return null;                                  // 이름 꼴이 아니면 짓지 않는다
      const axisKey = mm[1], segIndex = +mm[2];

      let mother = null;
      try {
        mother = assembler.assemble({ growthDays: o.growthDays, seed: o.seed, potD: o.potD,
                                      lightAz: o.lightAz, photo: o.photo, leafState: o.leafState });
      } catch (e) { return null; }

      /* ★ 정본에 그 마디가 있나 — 없으면 **아무것도 안 만든다.**
         (모르는 이름·아직 안 난 마디가 여기서 걸린다. 지어내지 않는 자리다) */
      let row = null;
      try { row = (G.cuttableNodes() || []).find(r => r && r.nodeId === nodeId) || null; }
      catch (e) { row = null; }
      if (!row) { disposeTree(mother); return null; }

      const inner = mother.children[0];
      if (!inner || !inner.children.length) { disposeTree(mother); return null; }
      const s = inner.scale.x;

      const keep = [];
      for (const c of [...inner.children]) if (inCut(c.userData, axisKey, segIndex)) keep.push(c);

      const stem = keep.find(c => c.userData && c.userData.part === 'stem');
      if (!stem || !stem.userData.segT) { disposeTree(mother); return null; }
      const segT = stem.userData.segT, tubSeg = stem.userData.tubSeg, radSeg = stem.userData.radSeg;
      /* 마디 번호가 이 축이 실제로 그린 마디 수를 넘으면 — 아직 안 난 마디다 */
      if (!(segIndex >= 0 && segIndex <= segT.length - 2)) { disposeTree(mother); return null; }

      /* 자를 링 — 마디 i 가 시작하는 t 를 링 번호로 바꾼다.
         ⚠ 링은 t 를 tubSeg 등분한 자리라 자른 면이 마디 경계에서 최대 반 링만큼 어긋난다
           (한 마디가 링 10개 안팎이니 마디 길이의 5% 안이다). 정점을 **옮기지는 않는다** —
           옮기면 그때부터 「자란 그대로」가 아니게 된다. */
      const ringFrom = Math.max(0, Math.min(tubSeg - 1, Math.round(segT[segIndex] * tubSeg)));
      const info = tubeRingInfo(stem.geometry, tubSeg, radSeg, ringFrom);
      if (!info) { disposeTree(mother); return null; }
      if (ringFrom > 0) {
        const sliced = sliceTube(stem.geometry, tubSeg, radSeg, ringFrom, info);
        if (!sliced) { disposeTree(mother); return null; }
        stem.geometry.dispose();                     // 이 기하는 매 조립마다 새로 나므로 원본과 안 나눠 쓴다
        stem.geometry = sliced;
        delete stem.userData.sharedGeometry;
      }

      const g = new THREE.Group();
      const inner2 = new THREE.Group();
      inner2.scale.setScalar(s);
      /* 밑동이 원점에 오게 — 안쪽 그룹을 통째로 민다. 물건의 좌표는 하나도 안 건드린다 */
      inner2.position.set(-info.center.x * s, -info.center.y * s, -info.center.z * s);
      g.add(inner2);
      for (const c of keep) { inner.remove(c); inner2.add(c); }

      /* ★ 남은 모주는 여기서 버린다. 안 버리면 자를 때마다 그루 한 벌씩 GPU 에 쌓인다 */
      disposeTree(mother);
      lastResult = null;

      /* 딸려 온 잎 수 — 잎 표가 붙은 축의 가짓수다(한 축에 잎 하나가 이 파일의 규약) */
      const leafAx = new Set();
      const varieKeys = new Set();
      for (const c of inner2.children) {
        const u = c.userData || {};
        if (u.part === 'leaf' && u.axisKey) leafAx.add(u.axisKey);
      }
      g.traverse(oo => {
        const k = oo.userData && oo.userData.assetKey;
        if (k && skinKeys.has(k)) varieKeys.add(k);
      });

      const bb = new THREE.Box3().setFromObject(g);
      g.userData.isPlantAssembled = true;
      g.userData.kind = 'cutting';
      g.userData.nodeId = nodeId;
      g.userData.axisKey = axisKey;
      g.userData.segIndex = segIndex;
      g.userData.growthDays = mother.userData.growthDays;
      g.userData.seed = mother.userData.seed;
      g.userData.scale = s;
      g.userData.leaves = [];                        // 모주와 같은 규약(room_view.applyLook)
      g.userData.leafCount = leafAx.size;
      g.userData.node = row;
      g.userData.varieLeafKeys = [...varieKeys];
      g.userData.cutDir = { x: info.dir.x, y: info.dir.y, z: info.dir.z };
      g.userData.sizeM = { h: bb.isEmpty() ? 0 : (bb.max.y - bb.min.y),
                           d: rotSafeDiameter(g, g) };
      g.userData.skinsPending = G.skinsPending();
      if (g.userData.skinsPending) watchSkins();
      return g;
    }
  };
  return assembler;

  /* ── 이 아래는 branchOf 의 손발이다. 그리기 규칙을 한 개도 안 갖고 있다 ── */

  /* 그 물건이 「마디 i 위쪽」에 딸려 나가나.
     ★ `cuttableNodes §carried` 와 **같은 규칙**을 이름으로만 판정한다 —
       가지의 경로가 `<부모>.<난 마디>` 라서 트리를 다시 안 타도 된다. */
  function inCut(u, A, i) {
    if (!u || !u.axisKey) return false;              // 화분·씨앗처럼 표가 없는 것은 안 딸려간다
    if (u.axisKey === A)
      return u.part === 'stem' || u.part === 'leaf' || (u.part === 'bump' && u.segIndex >= i);
    if (u.axisKey.slice(0, A.length + 1) !== A + '.') return false;
    const idx = parseInt(u.axisKey.slice(A.length + 1), 10);   // 다음 토막 = 이 가지가 난 마디
    return Number.isFinite(idx) && idx >= i;
  }

  /* 튜브의 링 하나가 어디 있고 어디를 보나.
     ★ 링의 점들은 「가운뎃점 + 반지름 × 단위원」이라, 마지막(겹치는) 점을 뺀 평균이
       **정확히 가운뎃점**이다. 짐작이 아니라 만드는 식(makeStemTube)에서 나오는 값이다. */
  function tubeRingInfo(geo, tubSeg, radSeg, ring) {
    const pos = geo && geo.attributes && geo.attributes.position;
    if (!pos || !Number.isFinite(tubSeg) || !Number.isFinite(radSeg)) return null;
    const per = radSeg + 1;
    if ((tubSeg + 1) * per + 2 > pos.count) return null;       // 격자가 안 맞는다 — 짐작하지 않는다
    const mid = r => {
      const v = new THREE.Vector3(), a = new THREE.Vector3();
      for (let j = 0; j < radSeg; j++) { v.fromBufferAttribute(pos, r * per + j); a.add(v); }
      return a.multiplyScalar(1 / radSeg);
    };
    const center = mid(ring);
    const dir = mid(Math.min(tubSeg, ring + 1)).sub(center);
    if (dir.lengthSq() < 1e-12) dir.set(0, 1, 0);
    return { center, dir: dir.normalize() };
  }

  /* 링 ringFrom 부터 끝까지를 **그대로 베낀다**(좌표·법선·UV·정점색 한 비트도 안 바꾼다).
     새로 만드는 것은 잘린 자리 뚜껑 하나뿐이다. */
  function sliceTube(geo, tubSeg, radSeg, ringFrom, info) {
    const A = geo.attributes;
    if (!A || !A.position || !A.normal || !A.uv) return null;
    const per = radSeg + 1, rings = tubSeg - ringFrom + 1;
    const from = ringFrom * per, sideN = rings * per;
    const topOld = (tubSeg + 1) * per + 1;                     // 원본의 위 뚜껑 가운뎃점
    const cut = (src, n) => {
      const out = new src.array.constructor((sideN + 2) * n);
      out.set(src.array.subarray(from * n, from * n + sideN * n), 0);
      out.set(src.array.subarray(topOld * n, (topOld + 1) * n), sideN * n);        // 위 뚜껑 그대로
      out.set(src.array.subarray(from * n, from * n + n), (sideN + 1) * n);        // 아래 뚜껑 = 첫 링 값에서 시작
      return out;
    };
    const pos = cut(A.position, 3), nor = cut(A.normal, 3), uv = cut(A.uv, 2);
    const topC = sideN, botC = sideN + 1;
    pos[botC * 3] = info.center.x; pos[botC * 3 + 1] = info.center.y; pos[botC * 3 + 2] = info.center.z;
    nor[botC * 3] = -info.dir.x; nor[botC * 3 + 1] = -info.dir.y; nor[botC * 3 + 2] = -info.dir.z;
    uv[botC * 2] = 0.5; uv[botC * 2 + 1] = 0.5;

    const idx = [];
    for (let i = 1; i < rings; i++) for (let j = 1; j <= radSeg; j++) {
      const a = per * (i - 1) + (j - 1), b = per * i + (j - 1), c = per * i + j, d = per * (i - 1) + j;
      idx.push(a, b, d, b, c, d);
    }
    const topRing = per * (rings - 1);
    for (let j = 0; j < radSeg; j++) idx.push(topC, topRing + j + 1, topRing + j);   // 위(원본과 같은 감김)
    for (let j = 0; j < radSeg; j++) idx.push(botC, j, j + 1);                       // 아래(자른 면)

    const out = new THREE.BufferGeometry();
    out.setIndex(idx);
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (A.color) out.setAttribute('color', new THREE.Float32BufferAttribute(cut(A.color, 3), 3));
    return out;
  }

  /* 안 쓰는 것을 GPU 에서 내린다.
     ⚠ **원본과 나눠 쓰는 기하는 안 버린다**(§protoGeo). 버리면 다음 그루가 빈 잎이 된다.
       재질은 `cloned` 표가 붙은 것만 — plant_grow §clearGroup 과 같은 규칙이다. */
  function disposeTree(root) {
    if (!root) return;
    root.traverse(o => {
      if (!o.isMesh) return;
      if (o.geometry && !(o.userData && o.userData.sharedGeometry) && !protoGeo.has(o.geometry.uuid))
        o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const mt of ms) if (mt && mt.userData && mt.userData.cloned) mt.dispose();
    });
    if (root.parent) root.parent.remove(root);
    root.clear ? root.clear() : (root.children.length = 0);
  }
}

/* 회전 무관 지름 = 2 × max √(x²+z²). room_view.js 와 같은 식이다.
   (모듈 경계를 넘겨 부르면 순환 참조가 되어 여기 한 벌 더 둔다 — 7줄이고 식이 고정이다) */
function rotSafeDiameter(obj, space) {
  const ref = space || obj;
  ref.updateWorldMatrix(true, true);
  obj.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(ref.matrixWorld).invert();
  const m = new THREE.Matrix4(), v = new THREE.Vector3();
  let maxR2 = 0;
  obj.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      const r2 = v.x * v.x + v.z * v.z;
      if (r2 > maxR2) maxR2 = r2;
    }
  });
  return 2 * Math.sqrt(maxR2);
}
