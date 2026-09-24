/* ============================================================
   game/camera_moves.js — 카메라 연출 (v2 · 2026-09-25)
   ------------------------------------------------------------
   방을 찍는 카메라가 가끔 «숨을 쉰다». 셋뿐이다.
     ① 대화가 열리면(#stage.talking) 말하는 쪽으로 10% 다가가고, 말하는 이를
        대사 상자·초상화에 안 가리는 칸으로 살짝 옮겨 담는다. 닫히면 돌아온다.
     ② 물 주기·거두기에 손이 닿는 순간, 그 자리로 살짝 밀었다가 곧 돌아온다.
        (동작 1.5초 안에 다 끝난다 — 동작이 끝났을 때 화면은 이미 제자리다)
     ③ 사람이 카메라를 만지면(끌기·핀치·휠) 그 자리에서 연출을 버린다. 되돌리지도 않는다.

   ★ 카메라는 room_view 의 궤도 트윈(setCam)으로만 움직인다 — view.camTo · view.camBusy.
     방위(az)·상하각(el)은 안 건드린다. 거리와 보는 점만 옮긴다.
   ★ «내 것인가»는 카메라가 내가 건 목표에 있나(또는 그리 가는 중인가)로 가린다.
     다르면 누군가(사람 · 화면 크기 바뀜 · 자리 확대) 가져간 것이다 → 손을 뗀다.
   ★ 타이머는 대화가 열려 있고 방이 아직 안 섰을 때만 잠깐 돈다. 매 프레임 도는 것이 없다
     (렌더는 트윈 동안만 바쁘다 — room_view 의 LV_BUSY 30fps, 끝나면 다시 쉰다).

   끄기: ?v2=0 (v2 전부) · ?v2cam=0 · localStorage 'byeot.v2cam' = '0'
   재기: tools/probe_v2_camaudio.mjs
============================================================ */

/* v2 스위치 — window.__v2 에 적어 둔다(다른 v2 모듈과 같은 버릇) */
export function v2Flag(key) {
  const w = typeof window !== 'undefined' ? window : {};
  w.__v2 = w.__v2 || {};
  let on = true;
  try {
    const q = new URLSearchParams((w.location && w.location.search) || '');
    if (q.get('v2') === '0' || q.get(key) === '0') on = false;
  } catch { }
  try {
    if (on && w.localStorage && (w.localStorage.getItem('byeot.v2') === '0'
        || w.localStorage.getItem('byeot.' + key) === '0')) on = false;
  } catch { }
  w.__v2[key] = on;
  return on;
}

/* 세기 — 눈에 «느껴질» 만큼만 */
export const CAM_MOVES = {
  talk: {
    closer: 0.90,            // 10% 다가간다
    shift: 0.30,             // (축을 못 읽을 때만) 보는 점을 말하는 이 쪽으로 30%
    center: 0.18,            // 가려지지 않는 칸 안에서 가운데로 조금 더 — 다가가는 느낌
    capX: 0.24, capY: 0.16,  // 한 번에 화면을 이만큼보다 더 밀지 않는다(폭·높이 비)
    top: 0.13,               // 위 띠(HUD·할 일)는 안 쓴다
    inMs: 1000, outMs: 720, retargetMs: 1100, retargetM: 0.6
  },
  act: {
    water:   { closer: 0.94, shift: 0.18 },
    harvest: { closer: 0.92, shift: 0.22 },
    inMs: 430, holdMs: 220, outMs: 650       // 합 1.3초 < 동작 1.5초(ACT_SPEC.sec)
  }
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const poseOf = c => ({ az: c.az, el: c.el, dist: c.dist, target: { x: c.target.x, y: c.target.y, z: c.target.z } });
function near(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.az - b.az) < 2e-3 && Math.abs(a.el - b.el) < 2e-3
      && Math.abs(a.dist - b.dist) < Math.max(2e-3, b.dist * 2e-3)
      && d3(a.target, b.target) < 5e-3;
}
function toward(home, f, closer, shift) {
  const t = home.target;
  return { az: home.az, el: home.el, dist: home.dist * closer,
           target: { x: t.x + (f.x - t.x) * shift, y: t.y + (f.y - t.y) * shift, z: t.z + (f.z - t.z) * shift } };
}
/* 화면에 실제로 보이는 사각형(캔버스 기준) — 숨었으면 null */
function rectIn(el, cr) {
  if (!el || !el.getBoundingClientRect) return null;
  try {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return null;
  } catch { }
  const r = el.getBoundingClientRect();
  if (!(r.width > 2 && r.height > 2)) return null;
  return { x0: r.left - cr.left, x1: r.right - cr.left, y0: r.top - cr.top, y1: r.bottom - cr.top };
}

/* opt.view    () => roomView (다시 켜져도 늘 지금 것을 본다)
   opt.stage   #stage — 'talking' 클래스를 지켜본다
   opt.whoEl   #dlgWho — 말하는 이가 바뀌는 것을 지켜본다(선택)
   opt.speaker () => 'jachwi' | 'moni' | 'god' | …
   opt.box     () => #dlgBox (아래를 덮는 대사 상자) · opt.face () => #dlgFace (초상화) */
export function createCameraMoves(opt = {}) {
  const ON = v2Flag('v2cam');
  let own = null;          // { kind:'talk'|'act', home, goal, focus }
  let talking = false;
  let retryT = 0, backT = 0, actT = 0, retries = 0;
  const st = { on: ON, talkIn: 0, talkOut: 0, actPush: 0, retarget: 0, lost: 0, skipped: 0, last: [] };
  const note = (s) => { st.last.push(Math.round(performance.now()) + ' ' + s); if (st.last.length > 16) st.last.shift(); };
  const api = { stats: () => ({ ...st, last: st.last.slice(), talking, own: own ? own.kind : null,
                                goal: own ? own.goal : null }),
                act() { return false; }, dispose() { } };
  if (!ON) return api;

  const view = () => {
    try {
      const v = opt.view && opt.view();
      return v && typeof v.camTo === 'function' && typeof v.camBusy === 'function' ? v : null;
    } catch { return null; }
  };

  /* 사람이 쥐고 있나 · 다른 트윈이 도나 — 새로 시작할 때만 본다 */
  function free(v) {
    const b = v.camBusy();
    return !(b.down || b.dragging || b.pinch || b.walkDrag || b.zoom || b.focused || b.tween);
  }
  /* 아직 내 것인가 — 내가 건 목표에 있거나 그리 가는 중이면 내 것이다 */
  function ours(v) {
    if (!own || !v) return false;
    const b = v.camBusy();
    if (b.dragging || b.pinch || b.zoom || b.focused) return false;
    return near(b.tweenTo || v.camera(), own.goal);
  }
  function charFocus(v, id) {
    let cs = null; try { cs = v.characters(); } catch { }
    const c = (cs || []).find(x => x.id === id);
    if (!c || !c.pos) return null;
    const hy = Number.isFinite(c.hipsY) ? c.hipsY : c.pos.y + 0.6;
    return { x: c.pos.x, y: hy + 0.18, z: c.pos.z, foot: c.pos.y };
  }
  /* 누구를 담나 + 몸의 크기(위·아래·옆 m) — 칸 안에 «몸이 통째로» 들어가게 */
  function talkFocus(v, who) {
    if (who === 'god') {                   // 식물신 — 방의 몬스테라(화분이 있는 그루)
      let ps = null; try { ps = v.plants(); } catch { }
      const p = (ps || []).find(x => x.potId) || (ps || [])[0];
      if (p && p.pos) return { x: p.pos.x, y: p.pos.y + 0.3, z: p.pos.z, ext: { up: 0.5, down: 0.35, w: 0.3 } };
    }
    const j = charFocus(v, 'jachwi'), m = charFocus(v, 'moni');
    const ext = (c) => ({ up: 0.55, down: Math.max(0.2, c.y - c.foot + 0.05), w: 0.3 });
    /* 둘이 가까우면 둘 사이를 본다 — 대사가 오가도 카메라가 안 흔들린다 */
    if (j && m && Math.hypot(j.x - m.x, j.z - m.z) < 2.2) {
      const f = { x: (j.x + m.x) / 2, y: (j.y + m.y) / 2, z: (j.z + m.z) / 2 };
      const e = ext(j);
      f.ext = { up: j.y - f.y + e.up, down: f.y - Math.min(j.foot, m.foot) + 0.05,
                w: Math.hypot(j.x - m.x, j.z - m.z) / 2 + 0.3 };
      return f;
    }
    const c = (who === 'moni' && m) ? m : (j || m);
    return c ? { ...c, ext: ext(c) } : null;
  }
  const whoNow = () => { try { return opt.speaker ? opt.speaker() : null; } catch { return null; } };

  /* 가려지지 않는 칸 — 위 띠 밑 · 대사 상자 위 · 초상화 옆(또는 위) 중 넓은 쪽 */
  function freeRect(cr, cw, ch) {
    const T = CAM_MOVES.talk;
    let x0 = 0, x1 = cw, y0 = ch * T.top, y1 = ch;
    const get = (fn) => { try { return fn ? rectIn(fn(), cr) : null; } catch { return null; } };
    const box = get(opt.box);
    if (box && box.y0 < y1 && box.x1 - box.x0 > cw * 0.5) y1 = Math.max(y0 + 60, box.y0);
    const face = get(opt.face);
    if (face && face.y0 < y1 - 20 && face.x1 > x0 && face.x0 < x1) {
      const left = (face.x0 + face.x1) / 2 < cw / 2;
      const beside = left ? { x0: Math.max(x0, face.x1), x1, y0, y1 } : { x0, x1: Math.min(x1, face.x0), y0, y1 };
      const above = { x0, x1, y0, y1: Math.max(y0 + 60, Math.min(y1, face.y0)) };
      const area = q => Math.max(0, q.x1 - q.x0) * Math.max(0, q.y1 - q.y0);
      return area(beside) >= area(above) ? beside : above;
    }
    return { x0, x1, y0, y1 };
  }
  /* 대화 틀을 푼다. 방위·상하각이 같으면 카메라 축도 같다 — 그래서 지금 그린 카메라의 축으로
     «당긴 뒤 이 점이 화면 어디에 찍히나»를 정확히 셀 수 있다(보는 점을 옮겨도 깊이는 안 바뀐다) */
  function talkGoal(v, home, f) {
    const T = CAM_MOVES.talk;
    const fallback = () => toward(home, f, T.closer, T.shift);
    let three = null; try { three = v.three; } catch { }
    const cam = three && three.cam, cv = three && three.renderer && three.renderer.domElement;
    if (!cam || !cam.matrixWorld || !cv || !cv.getBoundingClientRect) return fallback();
    const cr = cv.getBoundingClientRect(), cw = cr.width, ch = cr.height;
    if (!(cw > 40 && ch > 40)) return fallback();
    const e = cam.matrixWorld.elements;
    const R = { x: e[0], y: e[1], z: e[2] }, U = { x: e[4], y: e[5], z: e[6] }, B = { x: e[8], y: e[9], z: e[10] };
    const tanV = Math.tan(cam.fov * Math.PI / 360);
    const d1 = home.dist * T.closer;
    const D = { x: Math.cos(home.el) * Math.sin(home.az), y: Math.sin(home.el), z: Math.cos(home.el) * Math.cos(home.az) };
    const P = { x: f.x - (home.target.x + D.x * d1), y: f.y - (home.target.y + D.y * d1), z: f.z - (home.target.z + D.z * d1) };
    const xc = dot(P, R), yc = dot(P, U), zc = -dot(P, B);
    if (!(zc > 0.2)) return fallback();
    const ppm = ch / (2 * zc * tanV);                          // 그 깊이에서 1m 가 몇 px 인가
    const p0 = { x: cw / 2 + xc * ppm, y: ch / 2 - yc * ppm }; // 당기기만 했을 때 찍히는 자리
    const fr = freeRect(cr, cw, ch), x = f.ext || { up: 0.55, down: 0.7, w: 0.3 };
    const lo = { x: fr.x0 + x.w * ppm + 10, y: fr.y0 + x.up * ppm + 8 };
    const hi = { x: fr.x1 - x.w * ppm - 10, y: fr.y1 - x.down * ppm - 8 };
    const want = { x: lo.x <= hi.x ? clamp(p0.x, lo.x, hi.x) : (fr.x0 + fr.x1) / 2,
                   y: lo.y <= hi.y ? clamp(p0.y, lo.y, hi.y) : (lo.y + hi.y) / 2 };
    want.x += ((fr.x0 + fr.x1) / 2 - want.x) * T.center;
    want.y += ((fr.y0 + fr.y1) / 2 - want.y) * T.center;
    const dx = clamp(want.x - p0.x, -T.capX * cw, T.capX * cw);
    const dy = clamp(want.y - p0.y, -T.capY * ch, T.capY * ch);
    /* 화면에서 dx 만큼 옮기려면 카메라(=보는 점)는 반대로 간다. 화면 y 는 아래가 + */
    const a = -dx / ppm, b = dy / ppm;
    const t = home.target;
    return { az: home.az, el: home.el, dist: d1,
             target: { x: t.x + a * R.x + b * U.x, y: t.y + a * R.y + b * U.y, z: t.z + a * R.z + b * U.z } };
  }

  function tryTalkIn() {
    clearTimeout(retryT);
    if (!talking) return;
    if (own && own.kind === 'talk') return;
    const v = view();
    const oursAct = own && own.kind === 'act' && ours(v);
    const f = v && talkFocus(v, whoNow());
    if (!v || !f || !(oursAct || free(v))) {
      /* 방이 아직 안 섰거나 사람이 쥐고 있다 — 대화가 이어지는 동안 조금씩 늦춰 다시 본다 */
      retries++;
      retryT = setTimeout(tryTalkIn, Math.min(1000, 250 + retries * 60));
      return;
    }
    clearTimeout(actT);
    const home = oursAct ? own.home : poseOf(v.camera());
    const goal = v.camTo(talkGoal(v, home, f), CAM_MOVES.talk.inMs);
    own = { kind: 'talk', home, goal, focus: f };
    st.talkIn++; note('talk-in ' + (whoNow() || '?'));
  }
  function retarget() {
    if (!talking || !own || own.kind !== 'talk') return;
    const v = view();
    if (!ours(v)) return;
    const f = talkFocus(v, whoNow());
    if (!f || d3(f, own.focus) < CAM_MOVES.talk.retargetM) return;
    own.goal = v.camTo(talkGoal(v, own.home, f), CAM_MOVES.talk.retargetMs);
    own.focus = f;
    st.retarget++; note('retarget ' + (whoNow() || '?'));
  }
  function talkOut() {
    clearTimeout(backT);
    if (talking || !own || own.kind !== 'talk') return;
    const v = view();
    if (!ours(v)) { own = null; st.lost++; note('talk-lost'); return; }   // 누가 가져갔다 → 손을 뗀다
    if (v.camBusy().down) { backT = setTimeout(talkOut, 200); return; }   // 누르고 있는 동안은 기다린다
    v.camTo(own.home, CAM_MOVES.talk.outMs);
    own = null; st.talkOut++; note('talk-out');
  }
  function onStage() {
    const now = !!(opt.stage && opt.stage.classList.contains('talking'));
    if (now === talking) { if (now) retarget(); return; }
    talking = now;
    if (now) { clearTimeout(backT); retries = 0; tryTalkIn(); }
    else {
      clearTimeout(retryT);
      /* 대사가 곧바로 이어 열리는 경우가 있다 — 잠깐 기다려 들썩이지 않게 한다 */
      backT = setTimeout(talkOut, 140);
    }
  }

  /* ② 물 주기·거두기 — 손이 닿는 순간 한 번(game.html doAct 의 onArrive) */
  api.act = (kind, key) => {
    try {
      const A = CAM_MOVES.act, k = A[kind];
      if (!k || talking || own) { st.skipped++; return false; }
      const v = view();
      if (!v || !free(v)) { st.skipped++; return false; }
      let t = null; try { t = v.resolveKey(key); } catch { }
      if (!t || !t.pos) { st.skipped++; return false; }
      const j = charFocus(v, 'jachwi');
      const f = { x: t.pos.x * 0.7 + (j ? j.x : t.pos.x) * 0.3,
                  y: Math.max(t.pos.y + 0.2, 0.45),
                  z: t.pos.z * 0.7 + (j ? j.z : t.pos.z) * 0.3 };
      const home = poseOf(v.camera());
      const goal = v.camTo(toward(home, f, k.closer, k.shift), A.inMs);
      own = { kind: 'act', home, goal, focus: f };
      st.actPush++; note('act-push ' + kind);
      clearTimeout(actT);
      const back = () => {
        if (!own || own.kind !== 'act') return;
        const vv = view();
        if (!ours(vv)) { own = null; st.lost++; note('act-lost'); return; }
        if (vv.camBusy().down) { actT = setTimeout(back, 120); return; }
        vv.camTo(own.home, A.outMs);
        own = null;
      };
      actT = setTimeout(back, A.inMs + A.holdMs);
      return true;
    } catch (e) { console.warn('[카메라 연출]', e && e.message); return false; }
  };

  let mo = null;
  try {
    if (opt.stage && typeof MutationObserver === 'function') {
      mo = new MutationObserver(() => { try { onStage(); } catch (e) { console.warn('[카메라 연출]', e && e.message); } });
      mo.observe(opt.stage, { attributes: true, attributeFilter: ['class'] });
      if (opt.whoEl) mo.observe(opt.whoEl, { childList: true, characterData: true, subtree: true });
      onStage();
    }
  } catch (e) { console.warn('[카메라 연출] 못 붙였다 —', e && e.message); }

  api.dispose = () => {
    clearTimeout(retryT); clearTimeout(backT); clearTimeout(actT);
    try { mo && mo.disconnect(); } catch { }
    own = null;
  };
  return api;
}
