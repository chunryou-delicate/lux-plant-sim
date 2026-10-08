/* tools/lib/byeot_harness.mjs — **브라우저 없이 한 판을 굴리는 하네스** (2026-10-08 · core)
   ------------------------------------------------------------------
   tools/test_ending_flow.mjs · probe_oneroom_econ.mjs 에 같은 꼴로 들어 있던 것을 한 벌로 뗐다(갈래 판 probe_branches 가 쓴다):
     makeGrowth(seed)       plant_grow.html 본문을 vm 으로 돌린 생장 창(진짜 생장 수) — 판마다 새 그루
     makeSwitchingLight()   방을 바꿀 수 있는 조도 창(game.html buildRoom 자리) · 프로필 room_profile.<방>.json
     questSnapshotOf(S, io) quest.js §스냅샷 계약 — game.html questSnapshotNow 와 같은 칸을 S·생장에서 읽는다(지어내지 않는다 · 모르면 null)
   ⚠ 값·규칙은 하나도 안 바꾼다. data/** 는 읽기만(⛔ data/profiles 쓰기). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARRIVAL, pot0, hasPlant } from '../../src/game/state.js';
import { firstPlayRulesFromBalance, cropSites, cropPotList } from '../../src/game/first_play.js';
import { createProfileLight } from '../../src/game/room_profile.js';
import { cuttingsOf } from '../../src/game/propagation.js';
import { storyOf } from '../../src/game/oneroom.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const readJSON = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
export const RULES = firstPlayRulesFromBalance(readJSON('data/balance/characters.json'));

function makeThree() {
  class V3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new V3(this.x, this.y, this.z); } copy(v) { return this.set(v.x, v.y, v.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; } sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    lengthSq() { return this.x ** 2 + this.y ** 2 + this.z ** 2; } length() { return Math.sqrt(this.lengthSq()); }
    normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
    crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
    lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
    applyAxisAngle() { return this; } distanceTo(v) { return this.clone().sub(v).length(); }
  }
  const nop = function () { return new Proxy({}, handler); };
  const handler = {
    get(t, k) { if (k === 'then') return undefined; if (k === Symbol.toPrimitive) return () => 0;
                if (!(k in t)) t[k] = new Proxy(nop, handler); return t[k]; },
    apply() { return new Proxy({}, handler); },
    construct() { return new Proxy({ position: new V3(), rotation: new V3(), scale: new V3(1, 1, 1) }, handler); }
  };
  return new Proxy({ Vector3: V3, Vector2: V3 }, handler);
}
let G = null;
async function growthCtx() {
  if (G) return G;
  const html = fs.readFileSync(path.join(ROOT, 'plant_grow.html'), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const main = blocks[blocks.length - 1];
  const src = main.replace(/\n\s*init\(\);\s*updateCam\(\);\s*$/, '\n/* init() 제거(헤드리스) */\n');
  if (src === main) throw new Error('plant_grow.html 의 init() 호출부를 못 찾았습니다');
  const tuning = fs.readFileSync(path.join(ROOT, 'data', 'growth_tuning.json'), 'utf8');
  const el = () => ({ value: '', textContent: '', checked: false, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; }, insertAdjacentHTML() {}, focus() {}, remove() {} });
  const ctx = { THREE: makeThree(), console: { log() {}, warn() {}, error() {} },
    document: { getElementById() { return null; }, createElement: el, querySelector() { return null; }, querySelectorAll() { return []; },
                addEventListener() {}, body: el(), documentElement: el() },
    location: { search: '', href: 'http://localhost/plant_grow.html' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
    fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(tuning)) }),
    Math, JSON, Date, Object, Array, Number, String, Boolean, Map, Set, Error, isFinite, isNaN, parseFloat, parseInt };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'plant_grow.html' });
  for (let i = 0; i < 400 && !ctx.thLoaded(); i++) await new Promise(r => setImmediate(r));
  if (!ctx.thLoaded()) throw new Error('임계값 정본(data/growth_tuning.json)이 안 실렸습니다');
  G = ctx;
  return G;
}
/* 판마다 새 그루(씨앗) — 생장 창은 한 벌을 돌려 쓴다(test_ending_flow §standGrowth 와 같다) */
export async function makeGrowth(seed) {
  const g = await growthCtx();
  try { g.plantSeed(seed); } catch { }
  g.matResetAll(); g.resetDailyLight(); g.setGrowth(ARRIVAL.growthDays);
  return { assertContract: () => true, setDailyLight: d => g.setDailyLight(d),
    advanceTo(d) { const r = g.advanceTo(d); return { ...r, drawn: true, drawError: null }; },
    setGrowth(d) { const r = g.setGrowth(d); return { ...r, drawn: true, drawError: null }; },
    calendarDay: () => g.calendarDay(), growthDays: () => g.growthDays(), growthBlocked: () => g.growthBlocked(),
    growthPhase: () => g.growthPhase(), dli7: () => g.dli7(), dliCV: () => g.dliCV(), ageOf: d => g.ageOf(d),
    cuttableNodes: () => g.cuttableNodes(), leafStats: () => g.leafStats(),
    /* growth_adapter §leafState 와 같은 합치기(varieStateAll · matStateAll · leafHealthAll 을 leafBirth 로) */
    leafState: () => {
      const out = new Map(); const row = lb => { if (!Number.isFinite(lb)) return null; let r = out.get(lb);
        if (!r) { r = { leafBirth: lb, varie: false, matured: false, fade: 0, dropped: false }; out.set(lb, r); } return r; };
      try { for (const v of (g.varieStateAll ? g.varieStateAll() : [])) { const r = row(v && v.leafBirth); if (r) r.varie = !!v.varie; } } catch { }
      try { for (const m of (g.matStateAll ? g.matStateAll() : [])) { const r = row(m && m.leafBirth); if (r) r.matured = !!m.matured; } } catch { }
      try { for (const h of (g.leafHealthAll ? g.leafHealthAll() : [])) { const r = row(h && h.leafBirth); if (r) { r.fade = Number.isFinite(h.fade) ? h.fade : 0; r.dropped = !!h.dropped; } } } catch { }
      return out.size ? [...out.values()].sort((a, b) => a.leafBirth - b.leafBirth) : null;
    } };
}

const LIGHT_DATA = { lightTh: readJSON('data/balance/light_thresholds.json'), weatherBalance: readJSON('data/balance/weather.json') };
const PROFILES = {};
export function profileOf(id) {
  if (!PROFILES[id]) {
    const p = readJSON(`data/profiles/room_profile.${id}.json`);
    const warn = console.warn; console.warn = () => { };
    try { PROFILES[id] = { p, light: createProfileLight(p.uidStable === true ? p : { ...p, uidStable: true }, LIGHT_DATA) }; }
    finally { console.warn = warn; }
  }
  return PROFILES[id];
}
export function makeSwitchingLight(start = 'banjiha') {
  let cur = profileOf(start).light;
  return { daily: (day, S) => cur.daily(day, S), skyFor: (day, sim) => cur.skyFor(day, sim), dliOfSlot: (ref, o) => cur.dliOfSlot(ref, o),
           clearCache: () => cur.clearCache(), thresholdsOf: (p, v) => cur.thresholdsOf(p, v), growLampCount: () => cur.growLampCount(),
           get room() { return cur.room; }, build(roomId) { cur = profileOf(roomId).light; return cur.room; } };
}
export const atOf = (light, id) => { const s = (light.room.slots || []).find(x => x.slotId === id); return s ? { x: s.x, y: s.y, z: s.z } : null; };

/* ══ 퀘스트 스냅샷 — game.html §questSnapshotNow 와 같은 칸(quest.js §스냅샷 계약) ══════════
   ⚠ mealKinds 는 턴(firstPlayEvent.portions)에서 · 모르면 [] · cash/target 은 부르는 쪽이 준다 */
export function questSnapshotOf(S, io, opt = {}) {
  const fp = S.firstPlay || {};
  const ts = S.tutorial || {};
  let cropPots = [];
  try { cropPots = (cropPotList(fp, S.day) || []).map(r => ({ kind: r.kind || 'beansprout', harvestCount: r.harvestCount || 0,
                                                               placed: !!r.placed, watered: r.startedOnDay != null || !!r.growing || !!r.ready || !!r.harvested })); } catch { cropPots = []; }
  let motherLeaves = 0, motherVarieLeaves = 0, motherVarieMatured = 0;
  if (hasPlant(S)) {
    try { const st = io.growth.leafStats(); motherLeaves = (st && st.leaves) || 0; motherVarieLeaves = (st && st.variegatedLeaves) || 0; } catch { }
    try { const ls = io.growth.leafState ? io.growth.leafState() : null; motherVarieMatured = Array.isArray(ls) ? ls.filter(r => r && r.varie && r.matured && !r.dropped).length : null; } catch { motherVarieMatured = null; }
  }
  const cuts = (cuttingsOf(S) || []).map(c => ({ method: c.method, status: c.status, varieFromCut: !!c.varieFromCut,
                                                 varieLightBand: c.varieLightBand || null, rootedOnDay: Number.isInteger(c.rootedOnDay) ? c.rootedOnDay : null }));
  let story = null; try { story = storyOf(S); } catch { story = null; }
  const movedOut = !!ts.movedOut;
  return {
    day: S.day, firstPlayDone: !!fp.completed,
    cropHarvestTotal: (() => { try { return cropSites(fp).reduce((a, s) => a + (s.harvestCount || 0), 0); } catch { return 0; } })(),
    cropPots, mealKinds: opt.mealKinds || [], motherLeaves, motherVarieLeaves, motherVarieMatured,
    cuttings: cuts, varieSaleCount: (ts.varieSale && ts.varieSale.count) || 0,
    lampUnlocked: !!(ts.lamp && ts.lamp.unlocked), lampOwned: (ts.lamp && ts.lamp.owned) || 0,
    lampPlaced: ts.lamp && Number.isInteger(ts.lamp.placed) ? ts.lamp.placed : null,
    monsteraArrived: !!(fp.monstera && fp.monstera.arrived), monsteraHomed: !!(fp.monstera && fp.monstera.guide && fp.monstera.guide.moved),
    movedOut, movedInOnDay: story && Number.isInteger(story.movedInOnDay) ? story.movedInOnDay : null,
    bagPlants: movedOut ? (S.pots || []).filter(p => p && p.placedOnce === false && !p.slotId && !p.at).length : null,
    varieSalesSinceMove: (movedOut && story && Number.isInteger(story.varieSaleAtMove)) ? Math.max(0, ((ts.varieSale && ts.varieSale.count) || 0) - story.varieSaleAtMove) : (movedOut ? null : 0),
    cashWon: Number.isFinite(ts.cashWon) ? ts.cashWon : null,
    targetWon: Number.isFinite(opt.targetWon) ? opt.targetWon : null
  };
}
export { pot0 };
