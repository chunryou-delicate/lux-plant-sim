/* ★ 봄, 하루하루 — 운용 여섯 가지를 나란히 (2026-08-09 · 박사님 지시)
 *
 *   node tools/probe_spring_table.mjs             (표 전부)
 *   node tools/probe_spring_table.mjs --only A    (§A 만)
 *
 * 박사님 원문:
 *   *"하루하루 1일차 2일차 행동에 따른 벌이나 주는거를 봄 표로 해서 비교해볼까?
 *     시루를 1개 운용 2개 운용 3개 운용 같은날 운용 5일주기 분배 운용 무순 추가 운용 등?"*
 *
 * ══ 운용 여섯 ═══════════════════════════════════════════════════════════════
 *   ㉠ 시루 1개              기준선. 게임 시작 직후의 모습이다
 *   ㉡ 시루 2개 · 분배        하루에 하나씩 물을 준다 (거두는 날이 어긋난다)
 *   ㉢ 시루 3개 · 분배
 *   ㉣ 시루 3개 · **같은 날**  세 개에 같은 날 물을 준다 (거두는 날이 겹친다)
 *   ㉤ 시루 5개 · 분배        ★콩나물 주기가 5일이라 **5개가 딱 맞는 짜임**이다
 *   ㉥ ㉤ + 무순 3개          작물이 두 종류가 된다
 *
 * ★ ㉢ 과 ㉣ 가 짝이다 — 개수는 같고 **손 쓰는 법만** 다르다. 겹침 벌이 거기서 나온다.
 * ★ ㉤ 는 박사님이 처음 그리신 그 짜임이다: *"5일 주기니까 5개까지 1일씩 안 겹치게 하면
 *   저감량이 매일 다 3000 아녀?"*(first_play.js §겹침). 그게 실제로 그런지 잰다.
 *
 * ══ 길이 — 31일 ════════════════════════════════════════════════════════════
 *   ① 콩나물 주기가 5일이라 **여섯 바퀴**가 돈다(지시의 "두 번 이상"을 넉넉히 넘는다)
 *   ② 월세가 **1일차와 31일차** 두 번 걸린다(유예 폐지 · rentFirstDueDay 1 · 주기 30).
 *      한 번만 보면 "목돈이 한 번 있었다"이고, 두 번 봐야 **돌아온다**는 것이 보인다
 *   ③ 무순 주기가 7일이라 **네 바퀴 반**이 돈다 — 콩나물과 박자가 어긋나는 것이 드러난다
 *
 * ══ ⚠ 이 재현이 실제 판과 다른 점 둘 (숨기지 않는다) ════════════════════════
 *   ① **첫 플레이를 건너뛴다**(`fp.completed = true`). 튜토 시계는 첫 플레이가 끝나야 돌고
 *      그 16일은 돈도 계절도 멈춰 있다(`tutorial.tutorialDay` 첫 줄). 박사님이 물으신
 *      「1일차 2일차」는 **살림이 도는 첫날**이므로 거기서부터 센다.
 *   ② **계절을 봄으로 갈아 끼운다** — 규칙 사본에 `startSeason: 'spring'`. 저장소 값은 안 고친다.
 *
 * ⚠ 밸런스 값을 하나도 안 바꾼다. 한 칸도 손으로 계산해 넣지 않는다 — 전부 돌려서 나온 값이다.
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
import { firstPlayRulesFromBalance, placeBeansprout, placeCrop, moveMonstera,
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
const DAYS = Number(argOf('--days', 31));

const BASE_PROFILE = J('../data/profiles/room_profile.banjiha.json');
const LIGHT_TH = J('../data/balance/light_thresholds.json');
const WEATHER_BAL = J('../data/balance/weather.json');
const CHARS = J('../data/balance/characters.json');
const RULES = firstPlayRulesFromBalance(CHARS);
const DARK = 'banjiha-dresser:1';     // 콩나물 — 어두워야 하얗고 아삭
const SILL = 'banjiha-sill:0';        // 몬스테라 · 무순 — 밝아야 한다
const DESK = 'banjiha-desk:0';        // 무순 자리(콩나물과 달라야 한다 — 빛 요구가 정반대)

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



/* ══ 운용 여섯 ═══════════════════════════════════════════════════════════════
   siru      콩나물 시루 수
   spread    true = 하루에 하나씩 물(분배) · false = 그날 대기 중인 것을 전부(같은 날)
   musun     무순 판 수 (0 이면 안 쓴다)
   ⚠ 「같은 날」도 **시루마다 손을 쓴다**(waterCrop 을 시루 수만큼 부른다). 시루가 각개가 되면서
     물주기가 시루 하나를 잡는 동작이 됐기 때문이다(커밋 6a86287). 한 번에 다 주는 길
     (`waterCrop(S, {all:true})`)도 코드에 있고 그건 손이 **하나**만 든다 — §D 에서 그 차이를 잰다. */
const OPS = [
  { id: '㉠', ko: '시루 1개',            siru: 1, spread: true,  musun: 0 },
  { id: '㉡', ko: '시루 2개 · 분배',      siru: 2, spread: true,  musun: 0 },
  { id: '㉢', ko: '시루 3개 · 분배',      siru: 3, spread: true,  musun: 0 },
  { id: '㉣', ko: '시루 3개 · 같은 날',   siru: 3, spread: false, musun: 0 },
  { id: '㉤', ko: '시루 5개 · 분배',      siru: 5, spread: true,  musun: 0 },
  { id: '㉥', ko: '㉤ + 무순 3판',        siru: 5, spread: true,  musun: 3 }
];

function play(op, seed = 1) {
  const light = createProfileLight(structuredClone(BASE_PROFILE),
    { lightTh: LIGHT_TH, weatherBalance: WEATHER_BAL });
  const io = { light, growth: standGrowth(seed) };
  /* ★ `novice` 는 **계절을 여름으로 고정**한다(state.MODES). 봄을 보려면 `real` 이라야 한다.
     `yearDay0: 0`(= 봄 0일)에서 시작한다 — 날씨도 같이 굴지만 여섯 판이 같은 씨앗·같은 날을
     쓰므로 비교는 깨끗하다. 콩나물은 어두운 자리라 날씨를 거의 안 타고, 무순만 조금 탄다. */
  const S = newState({ mode: 'real', room: 'banjiha', firstPlay: true, firstPlayRules: RULES,
                       yearDay0: yearDay0Of(SPRING) });
  const ts = S.tutorial;
  ts.rules = SPRING;
  /* ⚠ 첫 플레이를 건너뛴다 — 머리말 §다른 점 ①. 살림이 도는 첫날부터 세려는 것이다. */
  S.firstPlay.completed = true;

  /* 콩나물 — 첫 시루는 선물이다(placeBeansprout). 나머지는 **산다.** */
  placeBeansprout(S.firstPlay, DARK, { slots: light.room.slots });
  const bs = cropSiteOf(S.firstPlay, 'beansprout');

  /* 몬스테라 — 도착 개체를 창턱에 둔다. 「몬스테라는 며칠이나 할 일이 있나」를 같이 세려는 것이다. */
  try { givePlant(S, io, {}); } catch { /* 이미 있으면 그대로 */ }
  try { if (pot0(S)) setPotSlot(S, pot0(S), SILL, light.room.slots); } catch {}
  try { moveMonstera(S.firstPlay, SILL, { slots: light.room.slots }); } catch {}

  const rows = [];

  for (let d = 1; d <= DAYS; d++) {
    const cashBefore = ts.cashWon;
    let watered = 0, harvested = 0, sown = 0, pot = 0, bought = 0, spent = 0;

    /* ── ① 사기 — 모자란 시루·씨앗을 시킨다(배송 시루 2일 · 씨앗 1일) ──────── */
    const haveSiru = placedCropPots(bs).length + idleCropPots(bs).length +
                     stockOf(S, 'siru') + incomingOf(S, 'siru');
    if (haveSiru < op.siru) {
      try { const o = orderItem(S, 'siru', op.siru - haveSiru); spent += o.totalWon; bought++; } catch {}
    }
    if (op.musun) {
      const ms = cropSiteOf(S.firstPlay, 'musun');
      const haveTray = (ms ? placedCropPots(ms).length + idleCropPots(ms).length : 0) +
                       stockOf(S, 'sprout_tray') + incomingOf(S, 'sprout_tray');
      if (haveTray < op.musun) {
        try { const o = orderItem(S, 'sprout_tray', op.musun - haveTray); spent += o.totalWon; bought++; } catch {}
      }
      if (stockOf(S, 'radish_seed') + incomingOf(S, 'radish_seed') < op.musun) {
        try { const o = orderItem(S, 'radish_seed', op.musun); spent += o.totalWon; bought++; } catch {}
      }
    }
    if (stockOf(S, 'bean_seed') + incomingOf(S, 'bean_seed') < op.siru) {
      try { const o = orderItem(S, 'bean_seed', op.siru - stockOf(S, 'bean_seed') - incomingOf(S, 'bean_seed'));
            spent += o.totalWon; bought++; } catch {}
    }

    /* ⚠ 무순은 `placeCrop` 으로 못 놓는다 — 2종째는 판이 **0개에서 시작**해서 옮길 것이 없다
       (`placeCrop` 이 "놓을 새싹 재배판가 없습니다"로 던진다). 재고에서 판을 만드는 것은
       `resowCrop(kind:'musun', sirus:N)` 쪽이다(state.resowCrop §floor). 아래 ⑥에서 한다. */

    /* ── ③ 하루 넘기기 ───────────────────────────────────────────────────── */
    const turn = nextDay(S, io).turn;
    const t = turn && turn.tutorial;

    /* ── ④ 수확 ─────────────────────────────────────────────────────────── */
    if (beansproutReady(S.firstPlay)) {
      try { const r = harvestCrop(S, io); if (r) harvested += r.harvestedPots || 1; } catch {}
    }

    /* ── ⑤ 잉여 팔기 ─────────────────────────────────────────────────────── */
    let surplus = 0;
    try { const r = sellCropSurplus(S); if (r && r.won > 0) surplus = r.won; } catch {}

    /* ── ⑥ 다시 심기 ─────────────────────────────────────────────────────── */
    /* ★ `sirus` 를 안 주면 **지금 개수 그대로** 다시 심는다 — 시루가 안 는다(state.resowCrop).
       가진 만큼까지만 올린다. 모자라면 던지고 아무것도 안 빠진다(커밋 1da8e99 이 그렇게 고쳤다). */
    if (stockOf(S, 'bean_seed') >= 1) {
      const want = Math.min(op.siru, placedCropPots(bs).length + idleCropPots(bs).length + stockOf(S, 'siru'));
      try { const r = resowCrop(S, { sirus: want, at: DARK, slots: light.room.slots });
            if (r) sown += r.seedsUsed || 1; } catch {}
    }
    if (op.musun && stockOf(S, 'radish_seed') >= 1) {
      const ms = cropSiteOf(S.firstPlay, 'musun');
      const wantM = Math.min(op.musun, (ms ? placedCropPots(ms).length + idleCropPots(ms).length : 0) + stockOf(S, 'sprout_tray'));
      try { const r = resowCrop(S, { kind: 'musun', sirus: wantM, at: DESK, slots: light.room.slots });
            if (r) sown += r.seedsUsed || 1; } catch {}
    }

    /* ★★ 물주기는 **하루가 시작된 뒤**에 한다 — `nextDay` 가 체력을 다시 채우기 때문이다
       (`stamina.resetDay`). 물을 턴 앞에서 주면 그 손은 **어제 몫**에서 빠져 나가고, 그러면
       한 화면에 「어제 물 + 오늘 수확」이 섞여 하루 체력이 엉뚱하게 찍힌다(처음에 그렇게 찍혔다).
       ⇒ 하루 순서를 [다음 날] → 수확 → 다시 심기 → 물주기 로 둔다. 손 셋이 **같은 하루 몫**이다. */
    /* ── ② 물주기 — 이 판의 「손 쓰는 법」이 여기서 갈린다 ─────────────────── */
    if (op.spread) {
      try { if (waterCrop(S).watered) watered++; } catch {}          // 하루에 **하나**
    } else if (placedCropPots(bs).length + idleCropPots(bs).length >= op.siru) {
      /* ★ 「같은 날 운용」은 **다 모인 뒤에 한꺼번에 시작한다.** 시루가 하나씩 도착하는 대로
         물을 주면 저절로 어긋나 버려서 겹침이 안 일어난다 — 그러면 이 판이 ㉢ 과 같아진다.
         시루가 다 놓일 때까지 기다렸다가 같은 날 시작하는 것이 이 운용의 내용이다. */
      for (let k = 0; k < 20; k++) {                                  // 대기 중인 것을 **다** — 손은 하나씩
        let ok = false;
        try { ok = !!waterCrop(S).watered; } catch { break; }
        if (!ok) break;
        watered++;
      }
    }
    if (op.musun) {
      try { if (waterCrop(S, { kind: 'musun' }).watered) watered++; } catch {}
    }
    /* 몬스테라 — 마르면 준다. 「몬스테라가 며칠이나 할 일을 주나」를 세는 자리다. */
    try { if (waterPot(S).watered) pot++; } catch {}


    const staAfter = S.stamina ? S.stamina.left : STAMINA_MAX;
    rows.push({
      day: t ? t.day : null,
      season: turn && turn.sky ? turn.sky.season : null,
      watered, harvested, sown, pot, bought,
      staUsed: STAMINA_MAX - staAfter,
      staLeft: staAfter,
      savedWon: (t && t.savedWon) || 0,          // 곳간에서 꺼낸 밥값
      surplusWon: surplus,                        // 잉여를 팔아 들어온 현금
      baseWon: (t && t.dailyBaseWon) || 0,        // 살림(월세 몫 뺀 하루 지출)
      powerWon: (t && t.electricityWon) || 0,
      rentWon: (t && t.rentWon) || 0,
      shopWon: spent,
      cashWon: ts.cashWon,
      dCash: ts.cashWon - cashBefore,
      /* ★ 「할 일이 없는 날」 — 물주기·수확·심기 중 **하나도 일어나지 않은 날**.
         눌러서 실제로 무언가 난 것만 센다. 짐작이 아니라 결과다. */
      idle: (watered + harvested + sown) === 0,
      idleAll: (watered + harvested + sown + pot) === 0   // 몬스테라까지 아무것도 없는 날
    });
  }
  return { op, rows, S };
}

/* ══ 세는 것들 ═══════════════════════════════════════════════════════════ */
function streaks(rows, key) {
  let best = 0, cur = 0, at = null, bestAt = null;
  rows.forEach((r, i) => {
    if (r[key]) { if (!cur) at = i + 1; cur++; if (cur > best) { best = cur; bestAt = at; } }
    else cur = 0;
  });
  return { best, bestAt };
}
const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
const won = v => v == null ? '—' : Math.round(v).toLocaleString();
const pct = (a, b) => b ? (a / b * 100).toFixed(0) + '%' : '—';

const RUNS = OPS.map(op => play(op));

/* ══════════════════════════════════════════════════════════════════════════ */
console.log('══ 봄, 하루하루 — 운용 여섯 (probe_spring_table) ═══════════════════');
console.log(`★ 계절 ${RUNS[0].rows[0].season} · ${DAYS}일 · 반지하 · 콩나물 서랍장(어둡게) · 무순 책상(밝게)`);
console.log(`★ 살림 하루 ${won(DAILY_OUT)}원 + 월세 ${won(RENT)}원(1일·31일) · 체력 하루 ${STAMINA_MAX}`);
console.log(`★ 값: 시루 ${won(buyPriceOf('siru'))}원 · 콩씨앗 ${won(buyPriceOf('bean_seed'))}원 · ` +
            `무순판 ${won(buyPriceOf('sprout_tray'))}원 · 무씨 ${won(buyPriceOf('radish_seed'))}원`);
console.log('');

/* ── §A ㉤ 5일 주기 분배 운용 — 하루하루 전부 ───────────────────────────── */
function daily(run, title) {
  console.log(`── ${title} ──`);
  console.log('| 일 | 물 | 수확 | 심기 | 몬 | 체력 | 곳간절감 | 잉여판매 | 살림 | 전기 | 월세 | 상점 | 그날 증감 | 누적 현금 |');
  console.log('|----|----|------|------|----|------|----------|----------|------|------|------|------|-----------|-----------|');
  for (const r of run.rows) {
    console.log(`| ${String(r.day).padStart(2)} | ${(r.watered || '·')} | ${(r.harvested || '·')} | ` +
      `${(r.sown || '·')} | ${(r.pot || '·')} | ${r.staUsed}/${STAMINA_MAX} | ` +
      `${(r.savedWon ? won(r.savedWon) : '·').padStart(8)} | ${(r.surplusWon ? won(r.surplusWon) : '·').padStart(8)} | ` +
      `${won(r.baseWon).padStart(6)} | ${String(r.powerWon || '·').padStart(4)} | ` +
      `${(r.rentWon ? won(r.rentWon) : '·').padStart(7)} | ${(r.shopWon ? won(r.shopWon) : '·').padStart(6)} | ` +
      `${((r.dCash >= 0 ? '+' : '') + won(r.dCash)).padStart(9)} | ${won(r.cashWon).padStart(9)} |` +
      (r.idle ? '  ← 할 일 없음' : ''));
  }
  console.log('');
}
if (!ONLY || ONLY === 'A') daily(RUNS[4], '§A ㉤ 시루 5개 · 분배 (5일 주기에 딱 맞는 짜임)');
if (!ONLY || ONLY === 'B') daily(RUNS[3], '§B ㉣ 시루 3개 · 같은 날 (겹쳐서 거둔다)');
if (!ONLY || ONLY === 'C') daily(RUNS[0], '§C ㉠ 시루 1개 (게임 시작 직후의 모습)');

/* ── §D 여섯 운용 나란히 ───────────────────────────────────────────────── */
if (!ONLY || ONLY === 'D') {
  console.log('── §D 여섯 운용 나란히 — 누적 현금 ──');
  console.log('| 일 | ' + OPS.map(o => o.id.padStart(9)).join(' | ') + ' |');
  console.log('|----|' + OPS.map(() => '-----------').join('|') + '|');
  for (let i = 0; i < DAYS; i++) {
    console.log(`| ${String(i + 1).padStart(2)} | ` +
      RUNS.map(r => won(r.rows[i].cashWon).padStart(9)).join(' | ') + ' |');
  }
  console.log('');
  console.log('── §D-2 여섯 운용 — 30일 합계 ──');
  console.log('| 운용 | 곳간절감 | 잉여판매 | 벌이 합 | 상점 | 체력 합 | 하루 최대 체력 | 끝 현금 |');
  console.log('|------|----------|----------|---------|------|---------|----------------|---------|');
  for (const r of RUNS) {
    const saved = sum(r.rows, 'savedWon'), sur = sum(r.rows, 'surplusWon');
    console.log(`| ${(r.op.id + ' ' + r.op.ko).padEnd(20)} | ${won(saved).padStart(8)} | ${won(sur).padStart(8)} | ` +
      `${won(saved + sur).padStart(7)} | ${won(sum(r.rows, 'shopWon')).padStart(6)} | ` +
      `${String(sum(r.rows, 'staUsed')).padStart(7)} | ` +
      `${String(Math.max(...r.rows.map(x => x.staUsed))).padStart(14)} | ` +
      `${won(r.rows[r.rows.length - 1].cashWon).padStart(7)} |`);
  }
  console.log('');
}

/* ── §E 할 일이 없는 날 ────────────────────────────────────────────────── */
if (!ONLY || ONLY === 'E') {
  console.log('── §E ★[빨리감기]를 없앨 근거 — 할 일이 없는 날 ──');
  console.log('  「할 일 없음」 = 물주기·수확·심기 중 **하나도 일어나지 않은 날**. [다음 날]만 누르는 날이다.');
  console.log('| 운용 | 빈 날 | 몫 | 최장 연속 | 그게 언제부터 | 첫 10일 중 빈 날 | 몬스테라까지 빈 날 |');
  console.log('|------|-------|-----|-----------|---------------|------------------|--------------------|');
  for (const r of RUNS) {
    const idle = r.rows.filter(x => x.idle).length;
    const st = streaks(r.rows, 'idle');
    const first10 = r.rows.slice(0, 10).filter(x => x.idle).length;
    const idleAll = r.rows.filter(x => x.idleAll).length;
    console.log(`| ${(r.op.id + ' ' + r.op.ko).padEnd(20)} | ${String(idle).padStart(5)} | ${pct(idle, DAYS).padStart(3)} | ` +
      `${(st.best + '일').padStart(9)} | ${(st.bestAt ? st.bestAt + '일차부터' : '—').padStart(13)} | ` +
      `${(first10 + '일').padStart(16)} | ${(idleAll + '일').padStart(18)} |`);
  }
  console.log('');
  console.log('  ── 빈 날이 **어디에** 몰리나 (● = 할 일 있음 · · = 빈 날) ──');
  for (const r of RUNS)
    console.log(`  ${r.op.id} ${r.op.ko.padEnd(14)} ${r.rows.map(x => x.idle ? '·' : '●').join('')}`);
  console.log(`     ${' '.repeat(17)}1    5    10   15   20   25   30`);
  console.log('');
  console.log('  ★ 몬스테라 — 물을 준 날이 며칠인가 (잎 하나에 72일이라 거의 매일 할 게 없다)');
  for (const r of RUNS)
    console.log(`  ${r.op.id} 몬스테라 물주기 ${String(sum(r.rows, 'pot')).padStart(2)}일 / ${DAYS}일`);
  console.log('');
}

/* ── §F 드러난 것 셋 ───────────────────────────────────────────────────── */
if (!ONLY || ONLY === 'F') {
  const R = Object.fromEntries(RUNS.map(r => [r.op.id, r]));
  console.log('── §F 드러난 것 ──');
  const a = R['㉢'], b = R['㉣'];
  const aS = sum(a.rows, 'savedWon') + sum(a.rows, 'surplusWon');
  const bS = sum(b.rows, 'savedWon') + sum(b.rows, 'surplusWon');
  console.log(`  ① 겹침 벌 — ㉢(3개 분배) 벌이 ${won(aS)}원 vs ㉣(3개 같은 날) ${won(bS)}원 ` +
              `= **${won(aS - bS)}원 차이** (${DAYS}일)`);
  console.log(`     곳간절감만 보면 ${won(sum(a.rows, 'savedWon'))} vs ${won(sum(b.rows, 'savedWon'))}원 · ` +
              `잉여판매는 ${won(sum(a.rows, 'surplusWon'))} vs ${won(sum(b.rows, 'surplusWon'))}원`);
  const e = R['㉤'], f = R['㉥'];
  console.log(`  ② 무순 — ㉤ 벌이 ${won(sum(e.rows, 'savedWon') + sum(e.rows, 'surplusWon'))}원 vs ` +
              `㉥ ${won(sum(f.rows, 'savedWon') + sum(f.rows, 'surplusWon'))}원 · ` +
              `상점 ${won(sum(e.rows, 'shopWon'))} → ${won(sum(f.rows, 'shopWon'))}원`);
  let firstDiff = null;
  for (let i = 0; i < DAYS; i++)
    if (f.rows[i].savedWon !== e.rows[i].savedWon) { firstDiff = i + 1; break; }
  console.log(`     곳간절감이 처음 갈리는 날 = **${firstDiff ? firstDiff + '일차' : '없음'}**`);
  console.log(`  ③ 체력 — 하루 상한 ${STAMINA_MAX}. 운용별 하루 최대 사용:`);
  for (const r of RUNS) {
    const mx = Math.max(...r.rows.map(x => x.staUsed));
    const day = r.rows.findIndex(x => x.staUsed === mx) + 1;
    console.log(`     ${r.op.id} ${r.op.ko.padEnd(16)} 최대 ${mx}/${STAMINA_MAX} (${day}일차)` +
                (mx >= STAMINA_MAX ? '  ★손이 모자란다' : ''));
  }
  console.log(`  ⇒ 몇 개째부터 손이 모자라나 — 아래 §G 가 시루 수를 올려 가며 잰다.`);
  console.log('');
}

/* ── §G 체력이 몇 개째에 모자라나 ──────────────────────────────────────── */
if (!ONLY || ONLY === 'G') {
  console.log('── §G ★체력 — 시루 몇 개째부터, 어느 날에 손이 모자라나 ──');
  console.log('| 시루 | 분배: 하루 최대 체력 | 같은 날: 하루 최대 체력 | 같은 날에 손이 모자란 날 |');
  console.log('|------|----------------------|-------------------------|--------------------------|');
  for (const n of [1, 3, 5, 7, 8, 9, 10, 12]) {
    const sp = play({ id: 'x', ko: 'x', siru: n, spread: true, musun: 0 });
    const sm = play({ id: 'x', ko: 'x', siru: n, spread: false, musun: 0 });
    const spMax = Math.max(...sp.rows.map(x => x.staUsed));
    const smMax = Math.max(...sm.rows.map(x => x.staUsed));
    const shortDays = sm.rows.filter(x => x.staLeft === 0).length;
    console.log(`| ${String(n).padStart(4)} | ${String(spMax).padStart(20)} | ${String(smMax).padStart(23)} | ` +
      `${(shortDays ? shortDays + '일' : '없음').padStart(24)} |` + (smMax >= STAMINA_MAX ? '  ★' : ''));
  }
  console.log('');
}
console.log(`(${((Date.now() - T0) / 1000).toFixed(0)}초)`);
