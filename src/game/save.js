/* ============================================================
   game/save.js — 저장·복원 (core 소유) · 2026-08-03 신설
   ------------------------------------------------------------
   브라우저를 닫아도 게임이 남는다. 자유 배치가 들어오면서 잃는 것이 커졌다 —
   옮긴 가구·화분 좌표가 통째로 날아가던 것을 여기서 막는다.

   ★ 원칙 셋. 이 파일의 모든 결정이 여기서 나온다.
     ① **반쯤 읽은 세이브가 제일 나쁘다.** 못 읽으면 던진다(`err.saveReason`).
        조용히 기본값으로 메꾸면 "게임은 열렸는데 내 집이 아닌" 상태가 된다.
     ② **남의 창 상태는 저장하지 않는다.** growth 의 유효 생장일·잎·성숙 게이지,
        house 의 조도·밴드는 각자 소유다. 코어가 아는 것만 적고, 나머지는 **되세운다**.
     ③ **호출부가 잊을 수 없게 만든다.** 가구 자리표는 조도 창에 얹어야 살아나는데,
        그걸 "부르는 걸 잊지 마세요" 로 두면 반드시 잊는다 — 그래서 못 얹으면 던진다.

   ============================================================
   ★ growth 를 어떻게 되세우는가 — **이력 재생(replay)** (문서: 이 주석이 정본)
   ------------------------------------------------------------
   저장하는 것: 코어가 아는 것뿐이다.
       pot.arrivalGrowthDays   도착 시점 진행도(코어가 넘긴 값이라 코어가 안다)
       pot.arrivedOnDay · daysPlanted
       S.dliHist               코어가 growth 에게 **실제로 넘긴 하루치 빛**(null 포함)
   저장하지 않는 것: 유효 생장일(GROWTH) · 달력(CAL_DAY) · 잎 성숙 게이지 · 잎 건강.
       전부 growth 소유다. 베껴 두면 growth 가 규칙을 바꾸는 순간 조용히 어긋난다.

   되세우는 법 — growth 의 **자기 계약을 그대로 다시 밟는다**:
       ① setGrowth(arrivalGrowthDays)      도착 지점으로 점프 (givePlant 와 같은 한 번)
       ② dliHist 를 순서대로   setDailyLight(v) → advanceTo(달력+1)
   이건 근사가 아니라 **재현**이다. 유효 생장일이 얼마인지 코어가 계산하지 않는다 —
   같은 입력을 같은 순서로 넣고 growth 가 스스로 세게 한다. 저광 정지도 그대로 재현된다.
   (`S.dliHist` 는 loop.js 에서 `setDailyLight` 와 1:1 로 쌓인다. 그래서 이력이 곧 입력이다.)

   ⚠ 이 방법으로도 **못 되세우는 것** — 조용히 넘기지 않고 여기 적어 둔다:
     · growth 의 씨앗(SEED). 성숙 굴림·중간잎 잠금이 `matHash(SEED, leafBirth, rolls)` 라
       씨앗이 바뀌면 **같은 이력인데 다른 잎**이 나온다. 씨앗은 growth 소유(자기 localStorage)라
       코어가 저장하지도 강제하지도 않는다. 같은 브라우저면 그대로 유지된다.
     · 어긋난 상태(S.desync)에서 저장한 세이브. growth 만 하루 더 간 턴이 있으면
       이력이 그 하루를 모른다 — 복원 뒤 형태가 하루 뒤처질 수 있다. 그래서 desync 는
       **지우지 않고 같이 저장**하고 복원 때 로그로 알린다.
     · 재생 비용. 하루가 곧 `advanceTo` 한 번이고 그 안에서 3D 를 다시 그린다.
       200일 세이브면 200번 돈다 — 빠르지 않다. 대신 정확하다. 지름길은 두지 않는다
       (유효 생장일을 저장해 점프하면 그 순간 growth 상태를 복제하는 것이 된다).
============================================================ */

import {
  SCHEMA, SIM_MODES, ARRIVAL, newState, pot0, pushLog, migratePots, rehomePot
} from './state.js';
import { createFirstPlayState, placeBeansprout } from './first_play.js';
import { createTutorialState } from './tutorial.js';
import { inRoom, isFreeSlotId, makeAt } from './place.js';

/* 저장 봉투의 스키마. **모르는 값이면 읽지 않는다**(fail-loud). */
export const SAVE_SCHEMA = 'game_save/1';
export const SUPPORTED_SAVE_SCHEMAS = Object.freeze([SAVE_SCHEMA]);

/* localStorage 기본 열쇠. 호출부가 바꿔 쓸 수 있게 상수로만 둔다 —
   이 모듈은 localStorage 를 **직접 만지지 않는다**(테스트에 가짜를 넣을 수 있어야 한다). */
export const SAVE_KEY = 'byeot/save/1';

/* ★ 로그 상한 = **메모리 상한과 같은 200** (state.pushLog 가 200에서 shift 한다).
   이 수를 고른 이유는 하나다: 저장·복원 왕복에서 **아무것도 안 잃기 위해서**다.
   200보다 작게 자르면 "저장했다 불렀더니 기록이 줄어 있는" 상태가 되고, 크게 잡아도
   메모리가 이미 200에서 버리므로 의미가 없다. 로그는 표시용이라 판정에 안 쓰인다.
   (한 줄 100바이트로 잡아도 20KB — localStorage 5MB 안에서 넉넉하다.) */
export const LOG_KEEP = 200;

/* ★ dliHist 는 **자르지 않는다.** 표시용 이력이 아니라 growth 복원의 유일한 입력이기 때문이다
   (위 §growth 참고). 한 칸을 버리면 그만큼 형태가 덜 자란 채로 복원된다.
   숫자 하나가 JSON 에서 5~8바이트라 1000일이어도 10KB 아래다 — 자를 이유가 없다. */
export const DLI_HIST_KEEP = null;

/* newState 가 내는 칸 목록. 코어에 새 칸이 생기면 **여기서 걸린다** —
   조용히 안 저장되는 칸이 생기는 것이 제일 나쁘다. */
const KNOWN_STATE_KEYS = Object.freeze([
  'schema', 'day', 'timeScale', 'sim', 'home', 'lamps',
  'pots', 'firstPlay', 'tutorial', 'dliHist', 'ledger', 'log'
]);

/* ---------------------------------------------------------------
   오류 — 이유를 코드로 낸다. 화면 문구는 호출부가 고른다.
     empty         저장된 것이 없다(빈 칸·null)
     broken_json   JSON 이 깨졌다
     unknown_schema 모르는 세이브다(다른 버전·다른 게임)
     corrupt       봉투는 읽혔는데 안이 이상하다
     unknown_room  그 방을 이 빌드가 모른다
     needs_light   가구 자리표가 있는데 조도 창을 안 줬다
     needs_rules   밸런스 계약(첫 플레이 규칙)을 안 줬다
     needs_growth  화분이 있는데 생장 창을 안 줬다
     quota / storage  저장소 쪽 실패
--------------------------------------------------------------- */
function fail(reason, msg) {
  const e = new Error(`[세이브] ${msg}`);
  e.saveReason = reason;
  return e;
}

/* ---------------------------------------------------------------
   ★ 순수 JSON 검사 — 함수·순환참조·NaN 을 **저장 전에** 잡는다
   JSON.stringify 는 함수를 조용히 지우고 NaN 을 null 로 바꾼다. 그게 바로
   "저장은 됐는데 값이 하나 사라진" 세이브의 출처라 여기서 던진다.
--------------------------------------------------------------- */
export function assertPlainJson(v, path = '$', seen = new Set()) {
  const t = typeof v;
  if (v === null || t === 'string' || t === 'boolean') return v;
  if (t === 'number') {
    if (!Number.isFinite(v)) throw fail('corrupt', `${path} 가 유한한 숫자가 아닙니다: ${v}`);
    return v;
  }
  if (t === 'function') throw fail('corrupt', `${path} 에 함수가 들어 있습니다`);
  if (t === 'undefined') throw fail('corrupt', `${path} 가 undefined 입니다 — null 로 적어 주세요`);
  if (t === 'symbol' || t === 'bigint') throw fail('corrupt', `${path} 가 ${t} 입니다`);
  if (seen.has(v)) throw fail('corrupt', `${path} 에서 순환참조가 생겼습니다`);
  seen.add(v);
  if (Array.isArray(v)) {
    v.forEach((x, i) => assertPlainJson(x, `${path}[${i}]`, seen));
  } else {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null)
      throw fail('corrupt', `${path} 가 순수 객체가 아닙니다: ${Object.prototype.toString.call(v)}`);
    for (const [k, x] of Object.entries(v)) assertPlainJson(x, `${path}.${k}`, seen);
  }
  seen.delete(v);
  return v;
}

/* ---------------------------------------------------------------
   값 읽기 도우미 — 이상하면 **그 자리를 말하며** 던진다
--------------------------------------------------------------- */
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
function needInt(v, path, { min = -Infinity } = {}) {
  if (!Number.isInteger(v) || v < min)
    throw fail('corrupt', `${path} 가 ${min > -Infinity ? min + ' 이상 ' : ''}정수가 아닙니다: ${v}`);
  return v;
}
function needNum(v, path, { min = -Infinity } = {}) {
  if (!isNum(v) || v < min)
    throw fail('corrupt', `${path} 가 유한한 숫자가 아닙니다: ${v}`);
  return v;
}
function optNum(v, path) { return v == null ? null : needNum(v, path); }
function needStr(v, path) {
  if (typeof v !== 'string' || !v) throw fail('corrupt', `${path} 가 비어 있지 않은 문자열이 아닙니다: ${v}`);
  return v;
}
function optStr(v, path) {
  if (v == null) return null;
  return needStr(v, path);
}
function needObj(v, path) {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw fail('corrupt', `${path} 가 객체가 아닙니다`);
  return v;
}
function needArr(v, path) {
  if (!Array.isArray(v)) throw fail('corrupt', `${path} 가 배열이 아닙니다`);
  return v;
}

/* ============================================================
   ① 저장
============================================================ */

/* 자리(at) 한 칸. 좌표가 없으면 **null 로 적는다** — 0으로 메꾸지 않는다. */
function packAt(at, path) {
  if (at == null) return null;
  needObj(at, path);
  return {
    x: needNum(at.x, `${path}.x`), y: needNum(at.y, `${path}.y`), z: needNum(at.z, `${path}.z`),
    rotY: at.rotY == null ? 0 : needNum(at.rotY, `${path}.rotY`),
    onUid: at.onUid == null ? null : needStr(at.onUid, `${path}.onUid`),
    occIdx: at.occIdx == null ? null : needInt(at.occIdx, `${path}.occIdx`, { min: 0 })
  };
}

function packPot(p, i) {
  const path = `pots[${i}]`;
  needObj(p, path);
  return {
    id: needStr(p.id, `${path}.id`),
    slotId: optStr(p.slotId, `${path}.slotId`),
    at: packAt(p.at, `${path}.at`),
    plantId: optStr(p.plantId, `${path}.plantId`),
    potAsset: optStr(p.potAsset, `${path}.potAsset`),
    variegated: !!p.variegated,
    /* ★ 코어가 아는 세 칸만 적는다. 유효 생장일은 여기 없다(growth 소유) */
    daysPlanted: needInt(p.daysPlanted ?? 0, `${path}.daysPlanted`, { min: 0 }),
    arrivedOnDay: needInt(p.arrivedOnDay ?? 0, `${path}.arrivedOnDay`, { min: 0 }),
    arrivalGrowthDays: needInt(p.arrivalGrowthDays ?? ARRIVAL.growthDays,
                               `${path}.arrivalGrowthDays`, { min: 0 })
  };
}

/* 첫 플레이 — `rules` 는 **안 적는다.** 밸런스 정본(data/balance/characters.json)에서
   불러올 때 다시 유도한다. 세이브에 굳히면 밸런스를 고쳐도 옛 세이브만 옛 값으로 돈다. */
function packFirstPlay(fp) {
  if (!fp) return null;
  const b = needObj(fp.beansprout, 'firstPlay.beansprout');
  const f = needObj(fp.food, 'firstPlay.food');
  const m = needObj(fp.monstera, 'firstPlay.monstera');
  const gp = m.growthPhase;
  return {
    enabled: !!fp.enabled,
    phase: needStr(fp.phase, 'firstPlay.phase'),
    completed: !!fp.completed,
    beansprout: {
      slotId: optStr(b.slotId, 'firstPlay.beansprout.slotId'),
      at: packAt(b.at, 'firstPlay.beansprout.at'),
      ageDays: needInt(b.ageDays ?? 0, 'firstPlay.beansprout.ageDays', { min: 0 }),
      harvestDays: needInt(b.harvestDays ?? 0, 'firstPlay.beansprout.harvestDays', { min: 0 }),
      dliHist: needArr(b.dliHist || [], 'firstPlay.beansprout.dliHist')
        .map((v, i) => needNum(v, `firstPlay.beansprout.dliHist[${i}]`, { min: 0 })),
      harvested: !!b.harvested,
      quality: optStr(b.quality, 'firstPlay.beansprout.quality'),
      meals: needInt(b.meals ?? 0, 'firstPlay.beansprout.meals', { min: 0 }),
      avgDli: optNum(b.avgDli, 'firstPlay.beansprout.avgDli')
    },
    food: {
      pantryMeals: needInt(f.pantryMeals ?? 0, 'firstPlay.food.pantryMeals', { min: 0 }),
      lastHarvestMeals: needInt(f.lastHarvestMeals ?? 0, 'firstPlay.food.lastHarvestMeals', { min: 0 }),
      lastFoodSavedWon: needNum(f.lastFoodSavedWon ?? 0, 'firstPlay.food.lastFoodSavedWon', { min: 0 }),
      totalFoodSavedWon: needNum(f.totalFoodSavedWon ?? 0, 'firstPlay.food.totalFoodSavedWon', { min: 0 }),
      cashFoodWon: needNum(f.cashFoodWon ?? 0, 'firstPlay.food.cashFoodWon', { min: 0 })
    },
    monstera: {
      arrived: !!m.arrived,
      slotId: optStr(m.slotId, 'firstPlay.monstera.slotId'),
      at: packAt(m.at, 'firstPlay.monstera.at'),
      /* ★ 단계 표시는 growth 가 낸 **관측 기록**이다. 판정에 안 쓰고 화면 문구로만 쓰므로
         그대로 적어 둔다 — 복원 직후 재생이 끝나기 전 화면이 빈칸이 되지 않게. */
      growthPhase: gp == null ? null : {
        phaseId: optStr(gp.phaseId, 'firstPlay.monstera.growthPhase.phaseId'),
        phaseKo: optStr(gp.phaseKo, 'firstPlay.monstera.growthPhase.phaseKo'),
        progress01: optNum(gp.progress01, 'firstPlay.monstera.growthPhase.progress01'),
        nextPhaseId: optStr(gp.nextPhaseId, 'firstPlay.monstera.growthPhase.nextPhaseId'),
        nextPhaseKo: optStr(gp.nextPhaseKo, 'firstPlay.monstera.growthPhase.nextPhaseKo')
      }
    }
  };
}

/* 튜토리얼 — 여기도 `rules` 는 안 적는다(정본은 tutorial.TUTORIAL_RULES · docs/story_arc.md). */
function packTutorial(ts) {
  if (!ts) return null;
  const lamp = needObj(ts.lamp, 'tutorial.lamp');
  const rent = needObj(ts.rent, 'tutorial.rent');
  const learned = {};
  for (const [k, v] of Object.entries(needObj(ts.learned, 'tutorial.learned'))) learned[k] = !!v;
  return {
    enabled: !!ts.enabled,
    day: needInt(ts.day ?? 0, 'tutorial.day', { min: 0 }),
    cashWon: needNum(ts.cashWon ?? 0, 'tutorial.cashWon'),
    seasonRunning: !!ts.seasonRunning,
    lamp: {
      unlocked: !!lamp.unlocked,
      owned: needInt(lamp.owned ?? 0, 'tutorial.lamp.owned', { min: 0 }),
      litHours: needNum(lamp.litHours ?? 0, 'tutorial.lamp.litHours', { min: 0 })
    },
    rent: {
      paidCount: needInt(rent.paidCount ?? 0, 'tutorial.rent.paidCount', { min: 0 }),
      nextDueDay: needInt(rent.nextDueDay ?? 0, 'tutorial.rent.nextDueDay', { min: 0 })
    },
    learned,
    movedOut: !!ts.movedOut,
    bankrupt: !!ts.bankrupt
  };
}

/* 가구 자리표 — `{ uid: {x, z, rot, y?} }`. rot 는 도(°)다(place.validateFurnitureAt 규약). */
function packFurniture(tbl) {
  const out = {};
  for (const [uid, p] of Object.entries(tbl || {})) {
    const path = `home.furniture['${uid}']`;
    needObj(p, path);
    out[uid] = {
      x: needNum(p.x, `${path}.x`), z: needNum(p.z, `${path}.z`),
      rot: p.rot == null ? 0 : needNum(p.rot, `${path}.rot`),
      ...(p.y == null ? {} : { y: needNum(p.y, `${path}.y`) })
    };
  }
  return out;
}

/* ★ 저장 객체를 만든다. 순수 JSON 이고 함수·Map·Set·순환참조가 없다(끝에서 검사한다).
     opt.now         저장 시각(테스트 주입용). 없으면 지금
     opt.appVersion  빌드 표식(있으면 적는다). 없으면 null */
export function serialize(S, opt = {}) {
  needObj(S, 'S');

  /* ★ 코어에 새 칸이 생겼는데 여기 안 적히면 **조용히 안 저장된다.** 그걸 막는다. */
  const fresh = Object.keys(newState({}));
  const missed = fresh.filter(k => !KNOWN_STATE_KEYS.includes(k));
  if (missed.length)
    throw fail('corrupt',
      `state.js 에 새 칸이 생겼습니다: ${missed.join(', ')} — save.js 에 저장 방법을 정해 주세요 ` +
      `(조용히 빠뜨리면 그 칸만 사라진 세이브가 됩니다)`);

  const home = needObj(S.home, 'home');
  const sim = needObj(S.sim, 'sim');
  const lamps = needObj(S.lamps, 'lamps');
  const ledger = needObj(S.ledger, 'ledger');
  const today = needObj(ledger.today, 'ledger.today');
  const when = opt.now instanceof Date ? opt.now : new Date(opt.now ?? Date.now());
  if (Number.isNaN(when.getTime())) throw fail('corrupt', `저장 시각이 올바르지 않습니다: ${opt.now}`);

  const save = {
    saveSchema: SAVE_SCHEMA,
    /* ★ 언제·무엇으로 저장했나 — 이어하기 화면이 이걸 보여 주고, 스키마 판올림도 이걸 본다 */
    savedAt: when.toISOString(),
    savedAtMs: when.getTime(),
    gameSchema: needStr(S.schema || SCHEMA, 'schema'),
    appVersion: opt.appVersion == null ? null : String(opt.appVersion),

    state: {
      day: needInt(S.day ?? 0, 'day', { min: 0 }),
      timeScale: {
        minutesPerGameDay: needNum((S.timeScale || {}).minutesPerGameDay ?? 30,
                                   'timeScale.minutesPerGameDay', { min: 0 })
      },
      sim: {
        mode: needStr(sim.mode, 'sim.mode'),
        seed: needInt(sim.seed ?? 0, 'sim.seed'),
        weatherK: optNum(sim.weatherK, 'sim.weatherK'),
        seasonK: optNum(sim.seasonK, 'sim.seasonK')
      },
      home: { room: needStr(home.room, 'home.room'), furniture: packFurniture(home.furniture) },
      lamps: {
        count: needInt(lamps.count ?? 0, 'lamps.count', { min: 0 }),
        litHours: needNum(lamps.litHours ?? 0, 'lamps.litHours', { min: 0 })
      },
      pots: needArr(S.pots || [], 'pots').map(packPot),
      firstPlay: packFirstPlay(S.firstPlay),
      tutorial: packTutorial(S.tutorial),
      /* ★ 자르지 않는다 — growth 복원의 입력이다(맨 위 §growth). null 은 '못 잰 날'이라 그대로 둔다. */
      dliHist: needArr(S.dliHist || [], 'dliHist')
        .map((v, i) => (v == null ? null : needNum(v, `dliHist[${i}]`))),
      ledger: {
        today: { in: needNum(today.in ?? 0, 'ledger.today.in'), out: needNum(today.out ?? 0, 'ledger.today.out') },
        total: needNum(ledger.total ?? 0, 'ledger.total'),
        electricityWon: needNum(ledger.electricityWon ?? 0, 'ledger.electricityWon')
      },
      /* 마지막 LOG_KEEP 개 (= 메모리 상한과 같은 수. 위 상수 주석 참고) */
      log: needArr(S.log || [], 'log').slice(-LOG_KEEP).map((e, i) => ({
        day: needInt(e.day ?? 0, `log[${i}].day`, { min: 0 }),
        msg: String(e.msg ?? '')
      })),
      /* ★ 어긋난 채로 저장했으면 그 사실도 같이 남긴다 — 지우면 복원 뒤 형태가 하루
         어긋나 있는데 아무도 모른다. 복원 때 로그로 알린다. */
      desync: S.desync == null ? null : {
        coreDay: needInt(S.desync.coreDay ?? 0, 'desync.coreDay', { min: 0 }),
        growthCalendar: S.desync.growthCalendar == null ? null
          : needInt(S.desync.growthCalendar, 'desync.growthCalendar'),
        reason: String(S.desync.reason ?? ''),
        note: S.desync.note == null ? null : String(S.desync.note)
      }
    }
  };

  /* ★ 여기까지 왔으면 순수 JSON 이어야 한다. 아니면 저장하지 않고 던진다. */
  assertPlainJson(save);
  return save;
}

/* ============================================================
   ② 복원
============================================================ */

/* 봉투를 연다. **모르는 스키마는 여기서 멈춘다.** */
function openEnvelope(raw) {
  if (raw == null) throw fail('empty', '저장된 것이 없습니다');
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) throw fail('empty', '저장된 것이 없습니다(빈 문자열)');
    try { raw = JSON.parse(s); }
    catch (e) { throw fail('broken_json', `세이브 JSON 이 깨졌습니다 — ${e.message}`); }
  }
  needObj(raw, '세이브');
  const sch = raw.saveSchema;
  if (typeof sch !== 'string' || !sch)
    throw fail('unknown_schema',
      'saveSchema 가 없습니다 — 이 게임의 세이브가 아니거나 옛 형식입니다. 읽지 않았습니다');
  if (!SUPPORTED_SAVE_SCHEMAS.includes(sch))
    throw fail('unknown_schema',
      `모르는 세이브 스키마입니다: ${sch} (읽을 수 있는 것: ${SUPPORTED_SAVE_SCHEMAS.join(', ')}) — ` +
      `반쯤 읽느니 안 읽습니다`);
  /* 코어 상태 스키마도 본다. 여기가 올라갔는데 변환기가 없으면 그 역시 '모르는 세이브'다. */
  const gs = raw.gameSchema;
  if (typeof gs !== 'string' || !gs)
    throw fail('unknown_schema', 'gameSchema 가 없습니다 — 봉투는 맞는데 안이 비어 있습니다');
  if (gs !== SCHEMA)
    throw fail('unknown_schema',
      `모르는 게임 상태 스키마입니다: ${gs} (지금은 ${SCHEMA}) — 변환기가 없어 읽지 않았습니다`);
  needObj(raw.state, 'state');
  return raw;
}

/* 세이브를 안 열고 겉만 본다 — 제목 화면의 "이어하기 (Day 12 · 어제)" 용.
   ★ 여기서도 모르는 스키마는 `ok:false` 다. '읽을 수 있는 척' 하지 않는다. */
export function describe(raw) {
  try {
    const env = openEnvelope(raw);
    const st = env.state;
    return {
      ok: true, saveSchema: env.saveSchema, gameSchema: env.gameSchema,
      savedAt: env.savedAt ?? null, savedAtMs: env.savedAtMs ?? null,
      appVersion: env.appVersion ?? null,
      day: st.day ?? null, room: (st.home && st.home.room) || null,
      hasPlant: Array.isArray(st.pots) && st.pots.length > 0,
      firstPlayDone: !!(st.firstPlay && st.firstPlay.completed)
    };
  } catch (e) {
    return { ok: false, reason: e.saveReason || 'corrupt', message: e.message };
  }
}

/* 방을 어디서 얻는가 — 조도 창을 주면 **거기서 얻는다**(가구 자리표를 얹은 뒤의 방이라야
   슬롯 좌표가 맞다). 안 주면 호출부가 넘긴 slots·size 를 쓴다. */
function roomOf(S, opt) {
  const light = opt.light || null;
  const furn = S.home.furniture || {};
  if (light) {
    if (typeof light.setFurnitureOverrides !== 'function' || typeof light.build !== 'function')
      throw fail('needs_light', 'opt.light 가 조도 창이 아닙니다 — setFurnitureOverrides·build 가 필요합니다');
    /* ★ 표가 비어 있어도 반드시 부른다. 안 부르면 **직전 게임에서 옮긴 가구**가 그대로 남는다 —
       "새 세이브를 불렀는데 남의 방"이 되는 조용한 사고다. */
    light.setFurnitureOverrides(furn, { rebuild: false });
    let room;
    try { room = light.build(S.home.room); }
    catch (e) {
      if (/모르는 방/.test(e.message)) throw fail('unknown_room', `이 빌드가 모르는 방입니다: ${S.home.room}`);
      throw e;
    }
    return { slots: room.slots || [], size: room.size || null, surfaces: room.surfaces || null,
             appliedFurniture: true, roomId: room.id };
  }

  /* ★ 조도 창이 없으면 **가구를 옮긴 세이브는 복원하지 않는다.**
     자리표를 못 얹은 채로 열면 화분 좌표는 저장 때 그대로인데 가구·그림자는 기본 자리라
     "같은 자리인데 다른 밝기"가 된다 — 조용히 틀리는 유형이라 여기서 막는다.
     헤드리스 검사처럼 정말 필요한 경우만 `allowUnappliedFurniture: true` 로 명시해서 연다. */
  if (Object.keys(furn).length && !opt.allowUnappliedFurniture)
    throw fail('needs_light',
      `옮긴 가구 ${Object.keys(furn).length}개가 있는 세이브입니다 — opt.light(조도 창)를 주세요. ` +
      `io.light.setFurnitureOverrides 를 얹지 않으면 그 자리 밝기가 저장 전과 달라집니다`);

  return { slots: opt.slots || [], size: opt.size || null, surfaces: opt.surfaces || null,
           appliedFurniture: false, roomId: S.home.room };
}

/* 자리를 잃은 물건을 회수한다. **조용히 옮기지 않는다** — 전부 로그로 남긴다. */
function reseat(S, room, report) {
  const log = (m) => { report.rehomed.push(m); pushLog(S, '🔧 복원 — ' + m); };

  /* 옛 세이브(at 없이 slotId 만)는 여기서 좌표가 채워진다 */
  const mig = migratePots(S, room.slots);
  report.migrated = mig;
  if (mig.filled.length)
    pushLog(S, `🔧 복원 — 옛 세이브 좌표 ${mig.filled.length}건을 슬롯에서 채웠습니다`);
  for (const s of mig.skipped)
    pushLog(S, `⚠ 복원 — ${s.id} 의 좌표를 못 채웠습니다: ${s.why}`);

  /* 화분 — 없어진 슬롯·사라진 가구·방 밖 좌표는 state.rehomePot 규칙으로 회수한다.
     v0 는 한 그루라 rehomePot 이 pot0 만 본다(코어 규약). */
  if (pot0(S)) rehomePot(S, room.slots, log, { size: room.size, surfaces: room.surfaces });

  /* 콩나물 시루 — 화분과 같은 검사를 받는다. 안 하면 방 밖 좌표가 남아
     매일 `light_adapter.slotsFor` 가 던진다(게임이 통째로 멈춘다). */
  const fp = S.firstPlay;
  const b = fp && fp.enabled ? fp.beansprout : null;
  if (b && (b.slotId || b.at)) {
    let why = null;
    if (b.at) {
      if (room.size && !inRoom(b.at, room.size)) why = '자리가 방 밖입니다';
      else if (b.at.onUid && room.surfaces && !room.surfaces.has(b.at.onUid))
        why = `받치던 ${b.at.onUid} 이(가) 사라졌습니다`;
    } else if (b.slotId && !isFreeSlotId(b.slotId) &&
               !(room.slots || []).some(s => s && s.slotId === b.slotId)) {
      why = `슬롯 ${b.slotId} 이(가) 이 방에 없습니다`;
    }
    if (why) {
      const dest = (room.slots || [])[0] || null;
      if (!b.harvested && dest) {
        placeBeansprout(fp, dest.slotId, { slots: room.slots });
        log(`시루 회수 — ${why} · ${dest.slotId} 로 옮겼습니다`);
      } else {
        /* 이미 수확했거나 갈 자리가 없으면 자리만 비운다 — 수확 결과는 이미 확정이라
           옮길 이유가 없고, 그대로 두면 계약이 방 밖 좌표를 실어 매일 던진다. */
        b.at = null;
        if (why.startsWith('슬롯')) b.slotId = null;
        log(`시루 자리 해제 — ${why}`);
      }
    }
  }
}

/* ★ growth 되세우기 — 이력 재생. 자세한 근거는 파일 맨 위 §growth.
     growth  growth_adapter(브라우저) 또는 같은 계약의 스텁(sim.nullGrowth)
   반환 { needed, method, jumpTo, replayedDays, calendarDay, growthDays, blocked, warnings } */
export function restoreGrowth(S, growth, opt = {}) {
  const p = pot0(S);
  const warnings = [];
  if (!p) return { needed: false, method: null, jumpTo: null, replayedDays: 0,
                   calendarDay: null, growthDays: null, blocked: null, warnings };

  for (const n of ['setGrowth', 'setDailyLight', 'advanceTo'])
    if (typeof growth?.[n] !== 'function')
      throw fail('needs_growth', `생장 창에 ${n} 이(가) 없습니다 — 형태를 되세울 수 없습니다`);
  /* 임계값 정본이 안 실린 채로 재생하면 **모든 날이 정지**로 지나가 씨앗이 남는다.
     growth_adapter.assertContract 가 그걸 본다 — 있으면 먼저 묻는다. */
  if (typeof growth.assertContract === 'function') growth.assertContract();

  let jumpTo = p.arrivalGrowthDays;
  if (!Number.isInteger(jumpTo) || jumpTo < 0) {
    jumpTo = ARRIVAL.growthDays;
    warnings.push(`화분에 도착 진행도가 없어 코어 기본값(${jumpTo}일)으로 세웠습니다`);
  }

  const hist = S.dliHist || [];
  /* 교차검증 — 이 둘은 loop.js 에서 같은 자리에서 늘어난다. 다르면 중간에 턴이 깨진 것이라
     재생 길이가 실제와 다를 수 있다. 조용히 넘기지 않는다. */
  if (hist.length !== p.daysPlanted)
    warnings.push(`빛 이력 ${hist.length}일 ≠ 돌본 날 ${p.daysPlanted}일 — ` +
                  `중간에 깨진 턴이 있어 형태가 그만큼 어긋날 수 있습니다`);
  if (S.desync)
    warnings.push(`어긋난 상태에서 저장된 세이브입니다(${S.desync.reason || '사유 미상'}) — ` +
                  `형태가 하루 어긋날 수 있습니다`);

  /* ① 도착 지점으로 점프. givePlant 와 같은 사상 — 못 그렸으면 거기서 멈춘다. */
  const jump = growth.setGrowth(jumpTo);
  if (jump && jump.drawn === false)
    throw fail('corrupt', `도착 형태를 화면에 그리지 못했습니다${jump.drawError ? ` — ${jump.drawError}` : ''}`);
  let cal = jump && Number.isFinite(jump.calDay) ? jump.calDay
          : (typeof growth.calendarDay === 'function' ? growth.calendarDay() : jumpTo);

  /* ② 그날의 빛을 그대로 다시 먹인다. 코어는 자라는 규칙을 모른다 — growth 가 센다. */
  let lastDrawError = null, drawFails = 0;
  for (let i = 0; i < hist.length; i++) {
    growth.setDailyLight(hist[i]);
    const st = growth.advanceTo(cal + 1);
    cal = st && Number.isFinite(st.calDay) ? st.calDay : cal + 1;
    if (st && st.drawn === false) { drawFails++; lastDrawError = st.drawError || '사유 미상'; }
  }
  /* 재생 도중의 그리기 실패는 화면에 안 남는다 — 다음 날이 덮어 그리기 때문이다.
     그래도 몇 번 났는지는 남긴다(전부 실패했으면 마지막 화면도 낡은 것이다). */
  if (drawFails) warnings.push(`재생 중 그리기 실패 ${drawFails}일 (마지막 사유: ${lastDrawError})`);

  const growthDays = typeof growth.growthDays === 'function' ? growth.growthDays() : null;
  const blocked = typeof growth.growthBlocked === 'function' ? growth.growthBlocked() : null;

  const out = { needed: true, method: 'replay', jumpTo, replayedDays: hist.length,
                calendarDay: cal, growthDays, blocked, warnings };
  pushLog(S, `🌿 복원 — 도착 ${jumpTo}일로 점프한 뒤 빛 이력 ${hist.length}일을 다시 걸었습니다` +
             (growthDays == null ? '' : ` (유효 ${growthDays}일)`));
  for (const w of warnings) pushLog(S, '⚠ 복원 — ' + w);
  return out;
}

/* ★ 저장 객체 → S.
     raw   저장 객체 또는 그 JSON 문자열
     opt
       light                  조도 창(권장). 주면 가구 자리표를 **여기서 얹고** 방을 다시 조립한다
       slots · size · surfaces  light 를 안 줄 때 쓰는 방 정보
       rules                  튜토리얼 규칙(기본 TUTORIAL_RULES)
       firstPlayRules         첫 플레이 밸런스 계약(첫 플레이 세이브면 필수)
       growth                 생장 창. 화분이 있으면 여기서 이력을 재생한다
       allowMissingGrowth     생장 창 없이 열겠다고 **명시**할 때만 true
       allowUnappliedFurniture 가구 자리표를 못 얹고 열겠다고 명시할 때만 true
       report                 배열/함수를 주면 복원 보고서를 여기에도 넘긴다
   반환 S — 그대로 게임에 넣으면 된다.
   ⚠ 못 읽으면 **던진다**(`err.saveReason`). 반쯤 읽은 상태를 돌려주지 않는다. */
export function deserialize(raw, opt = {}) {
  const env = openEnvelope(raw);
  const st = env.state;

  const home = needObj(st.home, 'state.home');
  const sim = needObj(st.sim, 'state.sim');
  const mode = needStr(sim.mode, 'state.sim.mode');
  if (!SIM_MODES[mode])
    throw fail('corrupt', `모르는 시뮬 모드입니다: ${mode} (아는 것: ${Object.keys(SIM_MODES).join(', ')})`);

  const fpSaved = st.firstPlay;
  const fpEnabled = !!(fpSaved && fpSaved.enabled);
  if (fpEnabled && !opt.firstPlayRules)
    throw fail('needs_rules',
      '첫 플레이 세이브인데 밸런스 계약(firstPlayRules)을 안 주셨습니다 — ' +
      'first_play.firstPlayRulesFromBalance(characters.json) 를 넘겨 주세요');

  /* 뼈대는 newState 로 만든다 — 나중에 칸이 늘어도 기본값이 채워진다 */
  const S = newState({ room: needStr(home.room, 'state.home.room'), mode,
                       firstPlay: fpEnabled, firstPlayRules: opt.firstPlayRules });
  S.day = needInt(st.day ?? 0, 'state.day', { min: 0 });
  S.timeScale.minutesPerGameDay =
    needNum((st.timeScale || {}).minutesPerGameDay ?? S.timeScale.minutesPerGameDay,
            'state.timeScale.minutesPerGameDay', { min: 0 });
  S.sim.seed = needInt(sim.seed ?? 0, 'state.sim.seed');
  S.sim.weatherK = optNum(sim.weatherK, 'state.sim.weatherK');
  S.sim.seasonK = optNum(sim.seasonK, 'state.sim.seasonK');
  S.home.furniture = packFurniture(home.furniture);       // 같은 검증을 읽을 때도 한 번 더
  S.lamps = {
    count: needInt((st.lamps || {}).count ?? 0, 'state.lamps.count', { min: 0 }),
    litHours: needNum((st.lamps || {}).litHours ?? 12, 'state.lamps.litHours', { min: 0 })
  };
  S.pots = needArr(st.pots || [], 'state.pots').map((p, i) => {
    const q = packPot(p, i);
    /* 좌표는 place.makeAt 를 통과시켜 정본 모양으로 세운다(방 경계는 아래 회수 단계에서 본다) */
    return { ...q, at: q.at ? makeAt(q.at) : null };
  });
  S.dliHist = needArr(st.dliHist || [], 'state.dliHist')
    .map((v, i) => (v == null ? null : needNum(v, `state.dliHist[${i}]`)));
  const led = needObj(st.ledger || {}, 'state.ledger');
  S.ledger = {
    today: { in: needNum((led.today || {}).in ?? 0, 'state.ledger.today.in'),
             out: needNum((led.today || {}).out ?? 0, 'state.ledger.today.out') },
    total: needNum(led.total ?? 0, 'state.ledger.total'),
    electricityWon: needNum(led.electricityWon ?? 0, 'state.ledger.electricityWon')
  };
  S.log = needArr(st.log || [], 'state.log')
    .map((e, i) => ({ day: needInt(e.day ?? 0, `state.log[${i}].day`, { min: 0 }), msg: String(e.msg ?? '') }));
  if (st.desync) S.desync = { ...st.desync };

  /* 첫 플레이 — 규칙은 **지금 정본**에서 오고, 진행 상태만 세이브에서 온다 */
  if (fpSaved) {
    const saved = packFirstPlay(fpSaved);                 // 쓸 때와 **같은 검증**을 읽을 때도 태운다
    const fp = createFirstPlayState({ enabled: fpEnabled, rules: opt.firstPlayRules });
    fp.phase = saved.phase;
    fp.completed = saved.completed;
    Object.assign(fp.beansprout, saved.beansprout,
                  { at: saved.beansprout.at ? makeAt(saved.beansprout.at) : null });
    Object.assign(fp.food, saved.food);
    Object.assign(fp.monstera, saved.monstera,
                  { at: saved.monstera.at ? makeAt(saved.monstera.at) : null });
    S.firstPlay = fp;
  }

  /* 튜토리얼 — 여기도 규칙은 지금 정본 */
  if (st.tutorial) {
    const t = packTutorial(st.tutorial);
    const ts = createTutorialState({ enabled: t.enabled, rules: opt.rules });
    ts.day = t.day; ts.cashWon = t.cashWon; ts.seasonRunning = t.seasonRunning;
    ts.lamp = { ...ts.lamp, ...t.lamp };
    ts.rent = { ...ts.rent, ...t.rent };
    for (const k of Object.keys(ts.learned)) if (k in t.learned) ts.learned[k] = t.learned[k];
    ts.movedOut = t.movedOut; ts.bankrupt = t.bankrupt;
    S.tutorial = ts;
  }

  /* ── 무결성 ──────────────────────────────────────────────── */
  const report = {
    saveSchema: env.saveSchema, savedAt: env.savedAt ?? null,
    room: S.home.room, day: S.day,
    appliedFurniture: false, furnitureNotInRoom: [],
    migrated: { filled: [], skipped: [] }, rehomed: [], growth: null,
    desyncAtSave: !!st.desync
  };

  const room = roomOf(S, opt);
  report.appliedFurniture = room.appliedFurniture;
  /* 지금 방에 없는 uid 의 자리표 — 방을 옮겨 다니면 정상이다(표는 방을 안 가린다).
     그래서 지우지도 경고하지도 않고 보고서에만 적는다. */
  if (opt.light && typeof opt.light.furnitureList === 'function') {
    const here = new Set(opt.light.furnitureList().map(f => f.uid));
    report.furnitureNotInRoom = Object.keys(S.home.furniture).filter(u => !here.has(u));
  }

  reseat(S, room, report);

  /* ── growth ──────────────────────────────────────────────── */
  if (S.pots.length) {
    if (opt.growth) {
      report.growth = restoreGrowth(S, opt.growth, opt);
    } else if (opt.allowMissingGrowth) {
      pushLog(S, '⚠ 복원 — 생장 창 없이 열었습니다. 화면의 식물은 이 세이브의 형태가 아닙니다');
      report.growth = { needed: true, method: null, skipped: true };
    } else {
      throw fail('needs_growth',
        `화분이 있는 세이브입니다 — opt.growth(생장 창)를 주세요. ` +
        `빛 이력 ${S.dliHist.length}일을 다시 걸어야 형태가 저장 전과 같아집니다 ` +
        `(정말 형태 없이 열려면 allowMissingGrowth: true 를 명시하세요)`);
    }
  }

  if (typeof opt.report === 'function') opt.report(report);
  else if (Array.isArray(opt.report)) opt.report.push(report);
  return S;
}

/* ============================================================
   ③ 저장소 — localStorage 는 **주입**받는다(이 모듈은 직접 안 만진다)
============================================================ */

function isQuotaError(e) {
  if (!e) return false;
  const n = e.name || '';
  return n === 'QuotaExceededError' || n === 'NS_ERROR_DOM_QUOTA_REACHED' ||
         e.code === 22 || e.code === 1014;
}

/* 저장한다.
   ★ 실패의 등급을 가른다:
       직렬화 실패(함수·NaN·새 칸)  → **던진다.** 배선 오류라 화면에 알릴 게 아니라 고쳐야 한다.
       저장소 실패(용량·차단)        → `{ok:false, reason}` 을 낸다. 게임을 멈출 일이 아니고
                                       "저장하지 못했습니다"를 띄우면 되는 상황이다.
   반환 { ok, bytes, key, reason?, message? } */
export function saveTo(storage, key, S, opt = {}) {
  if (!storage || typeof storage.setItem !== 'function')
    throw fail('storage', '저장소가 없습니다 — localStorage 같은 것을 넘겨 주세요');
  const k = key || SAVE_KEY;
  const save = serialize(S, opt);                 // 여기서 터지면 던진다(위 주석 참고)
  const text = JSON.stringify(save);
  try {
    storage.setItem(k, text);
  } catch (e) {
    if (isQuotaError(e))
      return { ok: false, reason: 'quota', key: k, bytes: text.length,
               message: `저장 공간이 가득 찼습니다 (${text.length.toLocaleString()}바이트). ` +
                        `다른 세이브를 지우거나 브라우저 저장 공간을 비워 주세요` };
    return { ok: false, reason: 'storage', key: k, bytes: text.length,
             message: `저장소에 쓰지 못했습니다 — ${e.message}` };
  }
  return { ok: true, key: k, bytes: text.length, savedAt: save.savedAt };
}

/* 불러온다. **조용히 실패하지 않는다** — 빈 값·깨진 JSON·모르는 스키마를 각각 다르게 낸다.
   반환 { ok:true, S, report, savedAt } | { ok:false, reason, message } */
export function loadFrom(storage, key, opt = {}) {
  if (!storage || typeof storage.getItem !== 'function')
    throw fail('storage', '저장소가 없습니다 — localStorage 같은 것을 넘겨 주세요');
  const k = key || SAVE_KEY;
  let text;
  try { text = storage.getItem(k); }
  catch (e) { return { ok: false, reason: 'storage', message: `저장소를 읽지 못했습니다 — ${e.message}` }; }
  if (text == null || (typeof text === 'string' && text.trim() === ''))
    return { ok: false, reason: 'empty', message: '저장된 게임이 없습니다' };

  const report = [];
  try {
    const S = deserialize(text, { ...opt, report });
    return { ok: true, S, report: report[0] || null, key: k,
             savedAt: (report[0] && report[0].savedAt) || null };
  } catch (e) {
    /* saveReason 이 없는 예외는 우리가 예상 못 한 것이다 — 삼키지 않고 그대로 올린다.
       (배치 검증이 던지는 RangeError 등은 세이브가 아니라 배선 문제일 수 있다) */
    if (!e.saveReason) throw e;
    return { ok: false, reason: e.saveReason, message: e.message, error: e };
  }
}

/* 세이브를 지운다. 있었으면 true. */
export function clear(storage, key) {
  if (!storage || typeof storage.removeItem !== 'function')
    throw fail('storage', '저장소가 없습니다 — localStorage 같은 것을 넘겨 주세요');
  const k = key || SAVE_KEY;
  let had = false;
  try { had = storage.getItem(k) != null; } catch { had = false; }
  storage.removeItem(k);
  return had;
}

/* 저장소를 열지 않고 겉만 본다(제목 화면용). 없으면 { ok:false, reason:'empty' }. */
export function peek(storage, key) {
  if (!storage || typeof storage.getItem !== 'function')
    throw fail('storage', '저장소가 없습니다 — localStorage 같은 것을 넘겨 주세요');
  let text;
  try { text = storage.getItem(key || SAVE_KEY); }
  catch (e) { return { ok: false, reason: 'storage', message: e.message }; }
  if (text == null || (typeof text === 'string' && text.trim() === ''))
    return { ok: false, reason: 'empty', message: '저장된 게임이 없습니다' };
  return describe(text);
}
