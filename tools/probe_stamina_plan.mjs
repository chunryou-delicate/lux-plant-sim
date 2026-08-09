/* ★ 확정된 체력 설계를 미리 재 본다 — 일자별 · 케이스별 (2026-08-09 · 박사님 확정)
 *
 *   node tools/probe_stamina_plan.mjs                (표 전부)
 *   node tools/probe_stamina_plan.mjs --days 250
 *   node tools/probe_stamina_plan.mjs --only A       (§A 일자별만)
 *
 * ══ 확정된 규칙 (박사님) ═══════════════════════════════════════════════════
 *   ① 시작 최대체력 **5** (지금 코드는 10)
 *   ② 물주기·수확·심기가 **전부 시루마다** 손을 쓴다 (지금 코드는 수확·심기가 일괄 1손)
 *   ③ 경험치 = **쓴 체력의 총량**. 채소 행동은 1씩이니 「한 행동 = 1 경험치」다
 *   ④ 경험치 **100 마다 최대체력 +1**, **최대 10** 까지
 *   ⑤ 퀘스트 보상 **+1** — 「시루 5개를 분배로 5주기 싹 완료」하면 한 번
 *   ⑥ 시작 시루 2개(가이드가 분배를 가르친다) → 퀘스트로 3개를 더 받아 5개
 *
 * ⚠ ④와 ⑤가 겹치는 방식은 **아직 안 정해졌다.** 둘 다 낸다:
 *     갈래 ㉮ 퀘스트 +1 이 **상한 10 안** → 도달이 빨라진다
 *     갈래 ㉯ 퀘스트 +1 이 **상한 밖**   → 11 이 된다
 *
 * ══ ★★ 코드를 한 글자도 안 고친다 — 어떻게 재나 ════════════════════════════
 * 지금 코드의 체력은 **상한 10 · 수확/심기 일괄 1손**이라 확정 규칙과 다르다. 그래서
 *   · 엔진 쪽 체력은 **막지 않게 풀어 두고**(`S.stamina.max`·`left` 를 크게)
 *   · **확정 규칙의 예산을 이 프로브가 직접 셈한다**(`sim = {max, left, xp}`)
 *   · 행동은 **시루 하나씩** 실제 API 로 부른다 —
 *     `harvestCrop(S, io, {potIds:[id]})` · `resowCrop(S, {potIds:[id]})` · `waterCrop(S, {potIds:[id]})`
 *     (셋 다 2026-08-09 에 각개 인자가 붙었다. 그래서 규칙을 안 고치고도 각개로 셀 수 있다)
 *   · 예산이 모자라 못 부른 행동은 **안 부르고 「못 함」으로 적는다** — 그러면 회전이 실제로 밀린다
 * ⇒ 회전·수확량·돈은 전부 **엔진이 낸 진짜 값**이고, 체력만 확정 규칙으로 센다.
 *
 * ⚠ 밸런스 값을 하나도 안 바꾼다. 한 칸도 손으로 계산해 넣지 않는다.
 *
 * ══ 케이스 넷 ═══════════════════════════════════════════════════════════════
 *   ㉠ 시루 2개 · 분배        가이드 직후 = **게임 시작 직후의 모습**. 퀘스트 전이라 보상도 없다
 *   ㉡ 시루 5개 · 분배        퀘스트를 다 깬 뒤
 *   ㉢ 시루 5개 · 같은 날     분배를 안 배운 사람
 *   ㉣ 시루 5개 + 무순 3판    작물이 둘
 * ★ 퀘스트(⑤)는 「5개를 **분배로** 5주기 싹」이라 ㉡·㉣ 만 받는다 — ㉢(같은 날)은 조건이 아니고
 *   ㉠(2개)은 개수가 모자란다. 그래서 케이스마다 최대체력이 다르게 자란다.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { newState, pot0, setPotSlot, resowCrop, waterCrop, waterPot,
         sellCropSurplus, givePlant, ARRIVAL } from '../src/game/state.js';
import { nextDay, harvestCrop } from '../src/game/loop.js';
import { firstPlayRulesFromBalance, placeBeansprout, placeCrop, moveMonstera, cropPotList,
         beansproutReady, cropSites, cropSiteOf, idleCropPots, placedCropPots,
         CROP_SITE_IDS } from '../src/game/first_play.js';
import { TUTORIAL_RULES, seasonAt, dailyCashOutWon, yearDay0Of } from '../src/game/tutorial.js';
import { orderItem, stockOf, incomingOf, buyPriceOf } from '../src/game/shop.js';
import { STAMINA_MAX } from '../src/game/stamina.js';

const T0 = Date.now();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = argOf('--only', null);
const DAYS = Number(argOf('--days', 250));

const BASE_PROFILE = J('../data/profiles/room_profile.banjiha.json');
const LIGHT_TH = J('../data/balance/light_thresholds.json');
const WEATHER_BAL = J('../data/balance/weather.json');
const CHARS = J('../data/balance/characters.json');
const RULES = firstPlayRulesFromBalance(CHARS);
const DARK = 'banjiha-dresser:1';     // 콩나물 — 어두워야 하얗고 아삭
const SILL = 'banjiha-sill:0';        // 몬스테라 · 무순 — 밝아야 한다
const DESK = 'banjiha-desk:0';        // 무순 자리(콩나물과 달라야 한다 — 빛 요구가 정반대)
const CYCLE_DAYS = 5;                 // 콩나물 한 회전(CROP_KINDS[0].harvestDays). 흩는 갈래 수다

/* ★ 봄으로 갈아 끼운 규칙 사본. 저장소 값은 안 고친다. */
const SPRING = Object.freeze({ ...TUTORIAL_RULES, startSeason: 'spring', startSeasonDay: 0 });
const DAILY_OUT = dailyCashOutWon({ rules: SPRING, movedOut: false });
const RENT = SPRING.rentWon;

/* ══ 헤드리스 생장 엔진 (probe_lamp_econ.mjs · test_balance_routes.mjs 와 같은 하네스) ══ */
function makeThree() {
  class V3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new V3(this.x, this.y, this.z); }
    copy(v) { return this.set(v.x, v.y, v.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    lengthSq() { return this.x ** 2 + this.y ** 2 + this.z ** 2; }
    length() { return Math.sqrt(this.lengthSq()); }
    normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
    crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
    lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
    applyAxisAngle() { return this; }
    distanceTo(v) { return this.clone().sub(v).length(); }
  }
  const nop = function () { return new Proxy({}, handler); };
  const handler = {
    get(t, k) {
      if (k === 'then') return undefined;
      if (k === Symbol.toPrimitive) return () => 0;
      if (!(k in t)) t[k] = new Proxy(nop, handler);
      return t[k];
    },
    apply() { return new Proxy({}, handler); },
    construct() { return new Proxy({ position: new V3(), rotation: new V3(), scale: new V3(1, 1, 1) }, handler); }
  };
  return new Proxy({ Vector3: V3, Vector2: V3 }, handler);
}
function loadGrowth() {
  const html = fs.readFileSync(path.join(ROOT, 'plant_grow.html'), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const main = blocks[blocks.length - 1];
  assert.ok(main && main.length > 20000, 'plant_grow.html 본문 스크립트를 못 찾았습니다');
  const src = main.replace(/\n\s*init\(\);\s*updateCam\(\);\s*$/, '\n/* init() 제거(헤드리스) */\n');
  assert.notEqual(src, main, 'init() 호출부를 못 찾았습니다');
  const tuning = fs.readFileSync(path.join(ROOT, 'data', 'growth_tuning.json'), 'utf8');
  const el = () => ({
    value: '', textContent: '', checked: false, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; }, insertAdjacentHTML() {}, focus() {}, remove() {}
  });
  const ctx = {
    THREE: makeThree(), console: { log() {}, warn() {}, error() {} },
    document: { getElementById() { return null; }, createElement: el, querySelector() { return null; },
      querySelectorAll() { return []; }, addEventListener() {}, body: el(), documentElement: el() },
    location: { search: '', href: 'http://localhost/plant_grow.html' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    setTimeout, clearTimeout, setInterval() { return 0; }, clearInterval() {},
    fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(tuning)) }),
    Math, JSON, Date, Object, Array, Number, String, Boolean, Map, Set, Error, isFinite, isNaN, parseFloat, parseInt
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'plant_grow.html' });
  return ctx;
}
const G = loadGrowth();
for (let i = 0; i < 200 && !G.thLoaded(); i++) await new Promise(r => setImmediate(r));
assert.ok(G.thLoaded(), '임계값 정본(data/growth_tuning.json)이 안 실렸습니다');

function standGrowth(seed) {
  try { G.plantSeed(seed); } catch { /* 3D 무대 없음 */ }
  G.matResetAll(); G.resetDailyLight(); G.setGrowth(ARRIVAL.growthDays);
  return {
    assertContract: () => true,
    setDailyLight: d => G.setDailyLight(d),
    advanceTo(d) { const r = G.advanceTo(d); return { ...r, drawn: true, drawError: null }; },
    setGrowth(d) { const r = G.setGrowth(d); return { ...r, drawn: true, drawError: null }; },
    calendarDay: () => G.calendarDay(), growthDays: () => G.growthDays(),
    growthBlocked: () => G.growthBlocked(), growthPhase: () => G.growthPhase(),
    dli7: () => G.dli7(), dliCV: () => G.dliCV(), ageOf: d => G.ageOf(d),
    cuttableNodes: () => G.cuttableNodes(), leafStats: () => G.leafStats()
  };
}




/* ══ 확정 규칙의 예산 ══════════════════════════════════════════════════════ */
const START_MAX = 5, LEVEL_CAP = 10, QUEST_BONUS = 1;
const QUEST_SIRUS = 5, QUEST_CYCLES = 5;

/* ★★ 2026-08-09 박사님 정정 — **경험치 100 고정이 아니라 레벨마다 다르다.**
   원문: *"10 쓰면 1, 20 쓰면 1, 30 쓰면 1, 40 쓰면 1 이런 식으로.
          레벨당 필요 경험치 차이를 주면 되지."*
   ⇒ 「100 고정」은 버렸다. 그건 첫 레벨업이 70일이나 걸려서 초반이 통째로 빈 채로 남는다.
   ★ 박사님이 「차이를 주면 되지」라고만 하셨고 눈금은 안 못 박으셨다. 그래서 셋을 나란히 잰다.
     `step` = 그 레벨로 올라가는 데 **더 드는** 경험치. 아래 `cum` 이 누적이다. */
const CURVES = [
  { id: 'ⓐ', ko: '기본  10·20·30·40·50', step: [10, 20, 30, 40, 50] },
  { id: 'ⓑ', ko: '가파름 10·25·45·70·100', step: [10, 25, 45, 70, 100] },
  { id: 'ⓒ', ko: '완만  10·15·20·25·30', step: [10, 15, 20, 25, 30] }
];
for (const c of CURVES) {
  c.cum = []; let a = 0;
  for (const v of c.step) { a += v; c.cum.push(a); }
}

/* 갈래 ㉮ = 퀘스트가 상한 안 · ㉯ = 상한 밖 */
function maxOf(sim, questInCap, curve) {
  let lv = START_MAX;
  for (const need of curve.cum) if (sim.xp >= need) lv++;
  lv = Math.min(LEVEL_CAP, lv);
  return questInCap ? Math.min(LEVEL_CAP, lv + (sim.quest ? QUEST_BONUS : 0))
                    : lv + (sim.quest ? QUEST_BONUS : 0);
}

const CASES = [
  { id: '㉠', ko: '시루 2개 · 분배',   siru: 2, spread: true,  musun: 0, quest: false },
  { id: '㉡', ko: '시루 5개 · 분배',   siru: 5, spread: true,  musun: 0, quest: true },
  { id: '㉢', ko: '시루 5개 · 같은 날', siru: 5, spread: false, musun: 0, quest: false },
  { id: '㉣', ko: '시루 5개 + 무순 3판', siru: 5, spread: true, musun: 3, quest: true }
];

function play(cs, { questInCap = true, days = DAYS, curve = CURVES[0] } = {}) {
  const light = createProfileLight(structuredClone(BASE_PROFILE),
    { lightTh: LIGHT_TH, weatherBalance: WEATHER_BAL });
  const io = { light, growth: standGrowth(1) };
  const S = newState({ mode: 'real', room: 'banjiha', firstPlay: true, firstPlayRules: RULES,
                       yearDay0: yearDay0Of(SPRING) });
  const ts = S.tutorial;
  ts.rules = SPRING;
  S.firstPlay.completed = true;
  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });
  try { givePlant(S, io, {}); } catch {}
  try { if (pot0(S)) setPotSlot(S, pot0(S), SILL, light.room.slots); } catch {}
  try { moveMonstera(S.firstPlay, SILL, { slots: light.room.slots }); } catch {}

  const sim = { xp: 0, quest: false, left: START_MAX };
  const rows = [];
  let prevMax = START_MAX;

  for (let d = 1; d <= days; d++) {
    /* ── 사기 ─────────────────────────────────────────────────────────── */
    const bs = cropSiteOf(S.firstPlay, 'beansprout');
    const have = (bs.pots || []).length + stockOf(S, 'siru') + incomingOf(S, 'siru');
    if (have < cs.siru) { try { orderItem(S, 'siru', cs.siru - have); } catch {} }
    if (cs.musun) {
      const ms = cropSiteOf(S.firstPlay, 'musun');
      const haveT = ((ms && ms.pots) || []).length + stockOf(S, 'sprout_tray') + incomingOf(S, 'sprout_tray');
      if (haveT < cs.musun) { try { orderItem(S, 'sprout_tray', cs.musun - haveT); } catch {} }
      if (stockOf(S, 'radish_seed') + incomingOf(S, 'radish_seed') < cs.musun) {
        try { orderItem(S, 'radish_seed', cs.musun); } catch {}
      }
    }
    if (stockOf(S, 'bean_seed') + incomingOf(S, 'bean_seed') < cs.siru) {
      try { orderItem(S, 'bean_seed', cs.siru - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed')); } catch {}
    }

    /* ── 하루 넘기기 ───────────────────────────────────────────────────── */
    const turn = nextDay(S, io).turn;
    const t = turn && turn.tutorial;
    /* ⚠ 엔진 체력은 막지 않게 풀어 둔다 — 확정 규칙은 아래 sim 이 센다(머리말 참고) */
    if (S.stamina) { S.stamina.max = 999; S.stamina.left = 999; }

    const max = maxOf(sim, questInCap, curve);
    if (max > prevMax) rows.push({ levelUpAt: d, from: prevMax, to: max });
    sim.left = max;

    /* ── 오늘 차례가 온 것 ─────────────────────────────────────────────── */
    const list = cropPotList(S.firstPlay, S.day);
    const ready = list.filter(p => p.ready);
    const resow = list.filter(p => p.needsResow);
    const water = list.filter(p => p.needsWater);
    const potDry = (() => { try { return !!(pot0(S) && waterPotStatus(S).needsWater); } catch { return false; } })();

    /* ★ 물 줄 시루는 운용이 정한다 — 분배는 하루 ceil(N/주기) 개, 같은 날은 전부 */
    const waterCap = cs.spread ? Math.ceil(cs.siru / CYCLE_DAYS) : water.length;
    const wantWater = water.slice(0, waterCap);

    const want = ready.length + resow.length + wantWater.length + (potDry ? 1 : 0);

    /* ── 실제로 한다 — 예산이 있는 만큼만. 못 한 것은 적는다 ──────────────── */
    let didH = 0, didS = 0, didW = 0, didP = 0, didG = 0;
    /* ★ 「못 한 것」은 **예산이 막은 횟수**를 직접 센다. `차례 − 한 것` 으로 빼면
       중간에 늘어난 시루·다시 센 물주기 목록 때문에 음수가 나온다(처음에 그랬다). */
    let blocked = 0;
    const spend = () => (sim.left >= 1 ? (sim.left--, sim.xp++, true) : (blocked++, false));

    for (const p of ready) {
      if (!spend()) break;
      try { harvestCrop(S, io, { potIds: [p.id] }); didH++; } catch { sim.left++; sim.xp--; }
    }
    /* ★ 잉여는 손이 안 든다(파는 것은 상점 일이다) */
    try { sellCropSurplus(S); } catch {}
    /* ★★ `at` 을 **안 넘긴다.** `potIds` 는 **이미 놓인 시루**를 가리키는 것이라 자리를 다시 줄
       이유가 없고, 넘기면 「이미 수확한 시루는 옮길 수 없습니다」로 던진다.
       처음에 `at` 을 같이 넘겨서 심기가 닷새에 한 번만 성공했고, 그래서 한 회전이 손 3개가
       아니라 2개로 돌았다(`한 것 1/0/1/0`). game.html:3893 도 `at` 없이 부른다.
       ⚠ id 는 `p.id`(`crop_01_01` 꼴) 그대로다 — 방뷰 열쇠(`free:` 접두사)를 붙이면
         조용히 「아직 수확하지 않았습니다」로 떨어진다. */
    for (const p of resow) {
      if (!spend()) break;
      try { resowCrop(S, { kind: p.kind, potIds: [p.id],
                           slots: light.room.slots, size: light.room.size }); didS++; }
      catch { sim.left++; sim.xp--; }
    }
    /* ★ **새 시루를 놓는 것도 「심기」다** — 한 손이 든다. `resowCrop` 은 `sirus` 를 올려야
       개수가 는다(potIds 로는 안 는다). 하나씩 올려서 하나에 한 손이 되게 한다.
       ⚠ 이걸 빼면 시루가 영영 1개라 「차례가 하루 1개」로만 찍힌다(처음에 그렇게 찍혔다). */
    for (const [kindId, target, at] of [['beansprout', cs.siru, DARK], ['musun', cs.musun, DESK]]) {
      if (!target) continue;
      for (let g = 0; g < target; g++) {
        const site = cropSiteOf(S.firstPlay, kindId);
        const now = ((site && site.pots) || []).length;
        if (now >= target || stockOf(S, kindId === 'musun' ? 'sprout_tray' : 'siru') < 1) break;
        if (!spend()) break;
        try { resowCrop(S, { kind: kindId, sirus: now + 1, at, slots: light.room.slots }); didG++; }
        catch { sim.left++; sim.xp--; break; }
      }
    }
    /* ★ 새로 놓은 시루까지 보게 **다시 센다** — 위에서 목록을 뜬 뒤에 시루가 늘었을 수 있다 */
    const water2 = cropPotList(S.firstPlay, S.day).filter(p => p.needsWater);
    const cap2 = cs.spread ? Math.ceil(cs.siru / CYCLE_DAYS) + (cs.musun ? 1 : 0) : water2.length;
    for (const p of water2.slice(0, cap2)) {
      if (!spend()) break;
      try { waterCrop(S, { kind: p.kind, potIds: [p.id] }); didW++; } catch { sim.left++; sim.xp--; }
    }
    if (potDry && spend()) { try { waterPot(S); didP++; } catch { sim.left++; sim.xp--; } }

    /* ── 퀘스트 — 「시루 5개를 분배로 5주기 싹 완료」 ───────────────────────── */
    if (cs.quest && !sim.quest) {
      const bp = cropPotList(S.firstPlay, S.day).filter(p => p.kind === 'beansprout');
      if (bp.length >= QUEST_SIRUS && bp.every(p => (p.cycle || 1) > QUEST_CYCLES)) sim.quest = true;
    }

    const did = didH + didS + didW + didP + didG;
    const missed = blocked;
    prevMax = max;
    rows.push({
      day: t ? t.day : d, max, used: max - sim.left, left: sim.left, xp: sim.xp,
      quest: sim.quest,
      nReady: ready.length, nResow: resow.length, nWater: wantWater.length, potDry: potDry ? 1 : 0,
      want: want + didG, did, missed,
      didH, didS, didW, didP, didG,
      savedWon: (t && t.savedWon) || 0,
      cashWon: ts.cashWon,
      idle: (want + didG) === 0
    });
  }
  return { cs, curve, rows: rows.filter(r => r.day != null), ups: rows.filter(r => r.levelUpAt != null) };
}

/* 몬스테라가 목마른가 — 없으면 조용히 false */
function waterPotStatus(S) {
  const p = pot0(S);
  if (!p) return { needsWater: false };
  const dry = p.waterUntilDay != null ? (S.day >= p.waterUntilDay) : (p.wateredOnDay == null);
  return { needsWater: !!dry };
}

const won = v => v == null ? '—' : Math.round(v).toLocaleString();
const pct = (a, b) => b ? (a / b * 100).toFixed(0) + '%' : '—';
const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('══ 확정된 체력 설계 — 일자별 · 케이스별 (probe_stamina_plan) ═══════');
console.log(`★ 시작 최대체력 ${START_MAX} · 상한 ${LEVEL_CAP} · 퀘스트 +${QUEST_BONUS} · 경험치 = 쓴 체력`);
for (const c of CURVES) console.log(`   곡선 ${c.id} ${c.ko} — 레벨당 ${c.step.join(' · ')} (누적 ${c.cum.join(' · ')})`);
console.log('★ 물·수확·심기가 전부 시루마다 한 손 (지금 코드의 일괄 1손이 아니다 — 프로브가 셈한다)');
console.log(`★ 봄 · ${DAYS}일 · 반지하`);
console.log('');

const RUNS = CASES.map(cs => ({ cs, inCap: play(cs, { questInCap: true }), outCap: play(cs, { questInCap: false }) }));

/* ── §A 일자별 (첫 31일은 하루씩) ────────────────────────────────────────── */
if (!ONLY || ONLY === 'A') {
  for (const r of RUNS.slice(0, 3)) {
    console.log(`── §A ${r.cs.id} ${r.cs.ko} — 첫 31일 (하루씩) ──`);
    console.log('| 일 | 거둘 | 심을 | 물줄 | 놓을 | 몬 | 한 것 | ★못 한 것 | 쓴/최대 | 경험 | 최대체력 |');
    console.log('|----|------|------|------|------|----|-------|-----------|---------|------|----------|');
    for (const x of r.inCap.rows.slice(0, 31)) {
      console.log(`| ${String(x.day).padStart(2)} | ${String(x.nReady||'·').padStart(4)} | ` +
        `${String(x.nResow||'·').padStart(4)} | ${String(x.nWater||'·').padStart(4)} | ` +
        `${String(x.didG||'·').padStart(4)} | ${String(x.potDry||'·').padStart(2)} | ` +
        `${(x.didH+'/'+x.didS+'/'+x.didW+'/'+x.didP).padStart(9)} | ${(x.missed ? '★' + x.missed + '개' : '·').padStart(9)} | ` +
        `${(x.used + '/' + x.max).padStart(7)} | ${String(x.xp).padStart(4)} | ` +
        `${String(x.max).padStart(8)} |` + (x.idle && !x.did ? '  ← 할 일 없음' : '') +
        (x.missed > 0 ? '  ← ★손이 모자라 밀렸다' : ''));
    }
    console.log('');
  }
}

/* ── §B 레벨업이 언제 오나 — 곡선 셋 × 케이스 넷 ────────────────────────── */
if (!ONLY || ONLY === 'B') {
  console.log('── §B ★★ 레벨업 — 며칠째에 오나 (곡선 셋을 나란히) ──');
  for (const cv of CURVES) {
    console.log(`
  ── 곡선 ${cv.id} ${cv.ko}  (누적 ${cv.cum.join(' · ')}) ──`);
    console.log('| 케이스 | 하루 경험치 | 5→6 | 6→7 | 7→8 | 8→9 | 9→10 | 사이 간격(일) | 퀘스트 | ★10 도달 | 80일 안? | 250일 최대 |');
    console.log('|--------|-------------|------|------|------|------|-------|---------------|--------|-----------|----------|------------|');
    for (const cs of CASES) {
      for (const [ko, inCap] of [['㉮상한안', true], ['㉯상한밖', false]]) {
        const run = play(cs, { questInCap: inCap, curve: cv, days: DAYS });
        const at = n => { const u = run.ups.find(u => u.to === n); return u ? u.levelUpAt : null; };
        const days = [6, 7, 8, 9, 10].map(at);
        const gaps = [];
        for (let i = 1; i < days.length; i++)
          gaps.push(days[i] != null && days[i - 1] != null ? days[i] - days[i - 1] : null);
        const q = run.rows.find(x => x.quest);
        const ten = run.ups.find(u => u.to >= 10);
        const xpd = (run.rows[run.rows.length - 1].xp / run.rows.length).toFixed(2);
        console.log(`| ${(cs.id + ' ' + ko).padEnd(14)} | ${String(xpd).padStart(11)} | ` +
          days.map(d => String(d == null ? '—' : d).padStart(4)).join(' | ') + ` | ` +
          gaps.map(g => g == null ? '—' : String(g)).join(',').padStart(13) + ` | ` +
          `${(q ? q.day + '일' : '—').padStart(6)} | ${(ten ? ten.levelUpAt + '일' : '★안 닿는다').padStart(9)} | ` +
          `${(ten && ten.levelUpAt <= 80 ? '○' : '✕').padStart(8)} | ` +
          `${String(run.rows[run.rows.length - 1].max).padStart(10)} |`);
      }
    }
  }
  console.log('');
}

/* ── §C 체력 5로 시루 몇 개까지 ──────────────────────────────────────────── */
if (!ONLY || ONLY === 'C') {
  console.log('── §C ★ 체력이 5일 때 시루 몇 개까지 굴러가나 ──');
  console.log('| 시루 | 분배 | 하루 최대 차례 | 못 한 날 | 첫 「못 함」 | 같은 날: 하루 최대 차례 | 같은 날 못 한 날 |');
  console.log('|------|------|----------------|----------|--------------|-------------------------|------------------|');
  for (const n of [2, 3, 4, 5, 6, 7, 8, 10]) {
    const sp = play({ id: 'x', ko: 'x', siru: n, spread: true, musun: 0, quest: false }, { days: 60 });
    const sm = play({ id: 'x', ko: 'x', siru: n, spread: false, musun: 0, quest: false }, { days: 60 });
    const spT = sp.rows.slice(9), smT = sm.rows.slice(9);
    const spMiss = spT.filter(x => x.missed > 0), smMiss = smT.filter(x => x.missed > 0);
    console.log(`| ${String(n).padStart(4)} | ${'분배'.padStart(4)} | ${String(Math.max(...spT.map(x => x.want))).padStart(14)} | ` +
      `${String(spMiss.length + '일').padStart(8)} | ${(spMiss.length ? spMiss[0].day + '일차' : '—').padStart(12)} | ` +
      `${String(Math.max(...smT.map(x => x.want))).padStart(23)} | ${String(smMiss.length + '일').padStart(16)} |` +
      (spMiss.length ? '  ★' : ''));
  }
  console.log('');
}

/* ── §D 할 일 없는 날 ────────────────────────────────────────────────────── */
if (!ONLY || ONLY === 'D') {
  console.log('── §D 할 일 없는 날 (앞 표와 같은 잣대 · 첫 31일) ──');
  console.log('| 케이스 | 빈 날 | 몫 | 못 한 날 | 31일 곳간절감 |');
  console.log('|--------|-------|-----|----------|---------------|');
  for (const r of RUNS) {
    const t = r.inCap.rows.slice(0, 31);
    console.log(`| ${(r.cs.id + ' ' + r.cs.ko).padEnd(20)} | ${String(t.filter(x => x.idle).length).padStart(5)} | ` +
      `${pct(t.filter(x => x.idle).length, 31).padStart(3)} | ${String(t.filter(x => x.missed > 0).length + '일').padStart(8)} | ` +
      `${won(sum(t, 'savedWon')).padStart(13)} |`);
  }
  console.log('');
  for (const r of RUNS)
    console.log(`  ${r.cs.id} ${r.cs.ko.padEnd(16)} ` +
      r.inCap.rows.slice(0, 31).map(x => x.missed > 0 ? '★' : (x.idle ? '·' : '●')).join(''));
  console.log(`     ${' '.repeat(19)}1    5    10   15   20   25   30`);
  console.log('  (● 할 일 있음 · · 빈 날 · ★ 손이 모자라 못 한 날)');
  console.log('');
}
console.log(`(${((Date.now() - T0) / 1000).toFixed(0)}초 · ${DAYS}일)`);
