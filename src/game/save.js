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
  SCHEMA, SIM_MODES, ARRIVAL, newState, pot0, pushLog, migratePots, rehomePot,
  /* ★ 여러 그루 (2026-08-15) — 화분마다 제 그루 이름과 제 빛 이력을 갖는다 */
  MAIN_GROWTH_ID, growthIdOf, syncPotLead
} from './state.js';
import { createFirstPlayState, placeBeansprout, placeCrop, cropSites, cropKindOf,
         ensureCropPots, syncCropLead } from './first_play.js';
import { createTutorialState } from './tutorial.js';
import { inRoom, isFreeSlotId, makeAt } from './place.js';
import { PROPAGATION_SCHEMA, rehomeCuttings, syncCuttingLeaves,
         VARIE_LIGHT } from './propagation.js';
import { SHOP_SCHEMA, createShopState, SALE_KINDS } from './shop.js';
/* 체력 — 규칙(최대치)은 저쪽 것이다. 세이브는 남은 양만 싣는다(docs/stamina.md) */
import { STAMINA_MAX, createStaminaState } from './stamina.js';
import { STORY_SCHEMA, createStoryState } from './oneroom.js';

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
  /* ⚠ 2026-08-17 — 한때 `cutContainers` 를 여기 넣었다가 **하루 만에 뺐다.** 박사님이
     「용도로 그릇을 가르지 마라」로 물리셨고 빈 그릇 목록이 `emptyPots` 하나가 됐다.
     칸이 는 것이 아니라 **줄었다** — 아래 §emptyPots 가 갈래(`container`)를 같이 싣는다. */
  'pots', 'emptyPots', 'cuttings', 'firstPlay', 'story', 'tutorial', 'shop', 'perks', 'stamina', 'dliHist', 'ledger', 'log'
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
    /* ★★ `fedDays` — growth 에게 **실제로 먹인 하루의 수** (2026-08-05 신설).
       ------------------------------------------------------------
       예전에는 「돌본 날」과 「먹인 날」이 늘 같아서 `daysPlanted` 하나면 됐다.
       밝기가 속도를 정하게 되면서(loop.js §growthSpeedOf) 밝은 날은 하루에 **두 걸음**을
       걷는다 — 그날 `dliHist` 에 두 칸이 쌓이는데 `daysPlanted` 는 1 만 는다.
       ⇒ 복원 때 `hist.length !== daysPlanted` 가 「깨진 턴」이라고 **잘못 경고했다.**
         재생 자체는 정확했다(hist 한 칸당 advanceTo 한 번이 곧 그 걸음이다).
       ⇒ 그래서 짝이 되는 값을 따로 적는다. 검사 대상은 `daysPlanted` 가 아니라 이쪽이다.
       ⚠ 옛 세이브에는 이 칸이 없다. 그때는 `daysPlanted` 로 떨어뜨린다 —
         속도가 도입되기 전 세이브라 둘이 같았던 것이 사실이다. */
    fedDays: needInt(p.fedDays ?? p.daysPlanted ?? 0, `${path}.fedDays`, { min: 0 }),
    arrivedOnDay: needInt(p.arrivedOnDay ?? 0, `${path}.arrivedOnDay`, { min: 0 }),
    /* ★★ 마지막으로 물 준 날 (2026-08-07 · state.js §몬스테라 물주기).
       ⚠ **옛 세이브에는 이 칸이 없다.** 여기서 0 으로 떨어뜨리지 **않는다** —
         300일째 세이브를 열자마자 "물 준 지 300일"이 되어 그 판의 몬스테라가 영영 안 자란다.
         `null` 로 두고 **읽는 쪽에서 그 판의 오늘로 채운다**(아래 §복원).
         `fedDays` 가 `daysPlanted` 로 떨어지는 것과 다른 이유다 — 그쪽은 옛 판에서 둘이
         **같았던 것이 사실**이라 근거가 있고, 이쪽은 **근거가 없다.** 지어내지 않는다. */
    wateredOnDay: p.wateredOnDay == null
      ? null : needInt(p.wateredOnDay, `${path}.wateredOnDay`, { min: 0 }),
    arrivalGrowthDays: needInt(p.arrivalGrowthDays ?? ARRIVAL.growthDays,
                               `${path}.arrivalGrowthDays`, { min: 0 }),
    /* ★★ 여러 그루 (2026-08-15 · state §MAIN_GROWTH_ID) — **생장 창의 어느 그루냐.**
       순서(pots[0])로 정하면 첫 화분을 파는 날 이름이 통째로 밀려 모든 화분이 남의 형태를
       되세운다. 그래서 화분이 제 이름을 들고 다닌다.
       ⚠ 옛 세이브에는 이 칸이 없다 — 그때는 화분이 하나뿐이었으므로 `__main__` 이 사실이다. */
    growthId: optStr(p.growthId, `${path}.growthId`) || MAIN_GROWTH_ID,
    /* ★ 그 그루의 씨앗(모양·색). **안 적으면 열 때마다 다른 모양의 그루가 선다.**
       ⚠ 첫 그루(선물)는 null 이다 — 그 씨앗은 생장 창이 자기 것으로 들고 있고(맨 위 §growth),
         코어가 여기서 덮어쓰면 그 판의 몬스테라가 세이브 왕복에 얼굴이 바뀐다. */
    growthSeed: p.growthSeed == null ? null
      : needInt(p.growthSeed, `${path}.growthSeed`, { min: 0 }),
    /* ★★ 이 그루가 받은 빛 이력 — **첫 화분만 예외다.**
       첫 화분의 이력은 맨 위 `dliHist` 에 있다(대표 칸 · 옛 이름 그대로). 여기 또 적으면
       같은 배열이 세이브에 두 번 들어가고, 둘이 갈리는 날 어느 쪽이 정본인지 알 수 없게 된다.
       ⇒ 그래서 **한 그루짜리 판의 세이브는 예전과 한 글자도 다르지 않다.**
       ★ 자르지 않는다 — 표시용이 아니라 growth 복원의 유일한 입력이다(맨 위 §growth). */
    ...(i === 0 ? {} : {
      dliHist: needArr(p.dliHist || [], `${path}.dliHist`)
        .map((v, j) => (v == null ? null : needNum(v, `${path}.dliHist[${j}]`)))
    }),
    /* ★ 번식 흔적 (2026-08-03) — **반드시 같이 적는다.**
       `cuts`·`pendingCutLoss` 는 "이 모주에서 무엇을 잘라냈나"이고, growth 가 다개체 리팩터에서
       형태에 반영할 때까지 코어가 들고 있는 유일한 기록이다. 안 적으면 저장 한 번에
       잘라낸 사실이 통째로 사라진다 — 삽수는 남았는데 모주는 안 잘린 세이브가 된다.
       `gen`·`varieChance` 는 계통 값이라 세대 감쇠(0.8ⁿ)가 세이브 왕복에서 초기화되면 안 된다. */
    gen: needInt(p.gen ?? 0, `${path}.gen`, { min: 0 }),
    varieChance: p.varieChance == null ? null : needNum(p.varieChance, `${path}.varieChance`, { min: 0 }),
    motherEnded: !!p.motherEnded,
    cuts: needArr(p.cuts || [], `${path}.cuts`).map((x, j) => {
      const cp = `${path}.cuts[${j}]`;
      needObj(x, cp);
      return {
        day: needInt(x.day ?? 0, `${cp}.day`, { min: 0 }),
        cuttingId: needStr(x.cuttingId, `${cp}.cuttingId`),
        nodeId: needStr(x.nodeId, `${cp}.nodeId`),
        stem: needStr(x.stem, `${cp}.stem`),
        leaves: needInt(x.leaves ?? 0, `${cp}.leaves`, { min: 0 })
      };
    }),
    pendingCutLoss: p.pendingCutLoss == null ? null : {
      leaves: needInt(p.pendingCutLoss.leaves ?? 0, `${path}.pendingCutLoss.leaves`, { min: 0 }),
      nodes: needInt(p.pendingCutLoss.nodes ?? 0, `${path}.pendingCutLoss.nodes`, { min: 0 })
    },
    /* ★★★ 잎별 **무늬 등급 장부** (2026-08-17 · 확정문 §5 · shop.js §⑥-3).
       ------------------------------------------------------------
       `{ [leafBirth]: 'sanban'|'halfmoon'|'fullmoon' }` — 열쇠는 growth 가 잎마다 들고 다니는
       `leafBirth` 다(코어가 새로 짓는 이름이 아니다. `growth_adapter.leafState()` 가 그것으로 줄을 맞춘다).
       ⚠⚠ **왜 화분에 적나.** growth 의 `VARIE_STATE` 는 참·거짓 한 칸뿐이라 종류가 안 들어간다.
         `plant_grow.html` 은 이 창의 쓰기 영역 밖이라 칸을 늘릴 수가 없다 —
         그래서 **등급만** 코어가 든다(잎 수는 여전히 growth 가 센다).
       ⚠ 안 적으면 저장 한 번에 **프롤로그 그루의 하프문 잎이 산반이 되어 196만원짜리가
         147만원이 된다**(재서 확인했다). 이사비 200만을 넘기는 판이 통째로 바뀐다.
       ⚠ 무늬가 아직 안 정해진 잎은 **아예 안 적는다**(칸이 없는 것이 「모른다」다).
         빈 장부는 `null` 이 아니라 `{}` 로 적는다 — 옛 세이브(칸 없음)와 새 판(무늬 없음)이
         같은 모양이라 굳이 가를 것이 없다. */
    leafGrades: (() => {
      const src = p.leafGrades;
      if (!src || typeof src !== 'object' || Array.isArray(src)) return {};
      const out = {};
      for (const [k, v] of Object.entries(src)) {
        const n = Number(k);
        if (!Number.isFinite(n)) throw fail('corrupt', `${path}.leafGrades 의 열쇠가 숫자가 아닙니다: ${k}`);
        if (v == null) continue;                       // 「모른다」는 칸을 안 만든다
        out[String(k)] = needStr(v, `${path}.leafGrades[${k}]`);
      }
      return out;
    })(),
    /* ★★ 잎별 **드러남 장부** (2026-08-16 · shop.js §⑥-4b · 박사님 *"성숙 때 확률적으로 분류"*).
       `{ [leafBirth]: true }` — 「그 잎의 등급을 **화면이 이미 말했다**」는 표시다.
       ⚠⚠ 위 `leafGrades` 와 뜻이 다르다. 저것은 「값이 얼마인가」(잎이 날 때 정해진다)이고
         이것은 「플레이어가 아는가」(잎이 **성숙할 때** 알려 준다)다. 두 시점이 갈라졌으므로
         칸도 갈라야 한다 — 한 칸에 섞으면 「값은 정해졌는데 아직 안 알려 줬다」를 적을 데가 없다.
       ⚠ 안 적으면 저장 한 번에 **이미 본 알림이 다시 뜬다.** 등급이 바뀌는 것은 아니라
         값이 흔들리지는 않지만, 배너가 되풀이되면 그것을 새 잎으로 읽게 된다.
       ⚠ 옛 세이브에는 이 칸이 없다 — 빈 표로 열린다. 그 판의 이미 성숙한 무늬 잎은
         다음 턴에 한 번 더 알림이 뜬다. **없던 표시를 지어내지 않는다.** */
    leafGradesSeen: (() => {
      const src = p.leafGradesSeen;
      if (!src || typeof src !== 'object' || Array.isArray(src)) return {};
      const out = {};
      for (const k of Object.keys(src)) {
        const n = Number(k);
        if (!Number.isFinite(n)) throw fail('corrupt', `${path}.leafGradesSeen 의 열쇠가 숫자가 아닙니다: ${k}`);
        if (src[k]) out[String(k)] = true;        // 거짓은 칸을 안 만든다(「안 알렸다」가 곧 없음이다)
      }
      return out;
    })(),
    /* ★★ 중고 거래에 올려 둔 게시글 id (2026-08-17 · shop.js §⑦-0).
       ⚠ 안 적으면 저장 한 번에 **올려 둔 그루가 「안 올린 것」이 된다** — 게시글은 남아
         연락까지 오는데 그루 쪽은 아무 표시가 없어 화면이 [올리기]를 또 내민다. */
    listing: optStr(p.listing, `${path}.listing`)
  };
}

/* ★ 삽수 한 칸 (2026-08-03).
   ------------------------------------------------------------
   여기는 **화분과 규칙이 다르다.** 화분은 "코어가 아는 세 칸"만 적고 형태를 growth 에게
   되세우게 하는데, 삽수는 growth 를 아예 안 쓴다(한 그루 전용이라 굴릴 창구가 없다).
   즉 삽수는 **코어가 전부 아는 물건**이라 상태를 통째로 적는 게 맞다 — 되세울 남의 창이 없다.

   ★ 굴림 결과(`variegated`·`varieRolled`)를 적는 이유. 안 적으면 복원할 때 다시 굴리게 되고
     같은 세이브를 두 번 열면 무늬가 달라진다. 굴림은 결정적(cuttingHash)이라 재현은 되지만,
     **결과를 적어 두는 쪽이 규칙이 바뀌어도 안 흔들린다.**
   ★ `warned` 도 적는다. 안 적으면 복원 뒤 이미 한 경고가 다시 나가고, 더 나쁘게는
     "경고 없이 죽었다" 검사가 통과해 버린다. */
function packCutting(c, i) {
  const path = `cuttings[${i}]`;
  needObj(c, path);
  const src = needObj(c.source, `${path}.source`);
  return {
    id: needStr(c.id, `${path}.id`),
    schema: needStr(c.schema || PROPAGATION_SCHEMA, `${path}.schema`),
    motherPotId: optStr(c.motherPotId, `${path}.motherPotId`),
    motherPlantId: optStr(c.motherPlantId, `${path}.motherPlantId`),
    cutOnDay: needInt(c.cutOnDay ?? 0, `${path}.cutOnDay`, { min: 0 }),
    source: {
      nodeId: needStr(src.nodeId, `${path}.source.nodeId`),
      stem: needStr(src.stem, `${path}.source.stem`),
      leaves: needInt(src.leaves ?? 0, `${path}.source.leaves`, { min: 0 }),
      variegatedLeaves: needInt(src.variegatedLeaves ?? 0, `${path}.source.variegatedLeaves`, { min: 0 }),
      growthDays: src.growthDays == null ? null : needNum(src.growthDays, `${path}.source.growthDays`, { min: 0 }),
      /* ★★★ 2026-08-17 — **자를 때 모주가 며칠짜리였나 · 어떤 씨앗이었나.**
         ------------------------------------------------------------
         ⚠⚠ **이 두 칸이 통째로 빠져 있었다** (2026-08-16 에 `propagation.takeCutting` 이
           적기 시작했는데 세이브가 안 따라왔다). 그래서 저장 한 번에 값이 사라졌고,
           `tools/test_propagation.mjs` 검사 I(「원본에서 딸려온 값이 안 살아났습니다」)가
           **이 창이 손대기 전부터 빨갛게 있었다** — HEAD 판으로 돌려서 확인했다.
         ★ 무엇이 망가지나: 방이 「자른 그 가지」를 그리려면 **그때의 모주를 그대로 다시
           지어야** 하고(`plant_assemble.branchOf`), 그러려면 유효 생장일과 씨앗이 있어야 한다.
           둘이 없으면 방은 옛 길(대체 표현)로 간다 — 저장했다 열면 병 속 가지가 달라진다.
         ⚠ 0 으로 메꾸지 않는다. 0 은 「갓 심은 그루」라 다시 지으면 **씨앗 한 톨**이
           병에 들어앉는다(propagation.js §motherGrowthDays 의 그 경고 그대로). */
      motherGrowthDays: src.motherGrowthDays == null
        ? null : needNum(src.motherGrowthDays, `${path}.source.motherGrowthDays`, { min: 0 }),
      motherSeed: src.motherSeed == null
        ? null : needNum(src.motherSeed, `${path}.source.motherSeed`)
    },
    /* ★★ 2026-08-17 — **가방에 있는 삽수는 이 둘이 `null` 이다**(propagation §⑤-2).
       자르기와 담기가 두 걸음으로 갈리면서 「아직 용기를 안 정한 조각」이 생겼다.
       ⚠ `needStr` 로 두면 그 판이 **저장도 복원도 안 된다**(빈 문자열이 아니라 null 이다).
         0 이나 'water' 로 메꾸면 더 나쁘다 — 가방에 있는 조각이 물꽂이인 척하고
         하루가 흘러 기한이 붙는다. 그래서 `optStr` 이다.
       ⚠ 옛 세이브에는 언제나 값이 있다 — `optStr` 은 그 값을 그대로 통과시킨다. */
    method: optStr(c.method, `${path}.method`),
    container: optStr(c.container, `${path}.container`),
    /* **어느 그릇에서 왔나**(`state.emptyPots[].id`). 가방이면 null.
       ⚠ 안 적으면 저장 한 번에 그 이름이 사라져, 회수했을 때 **다른 이름의 그릇**이 선다.
         방뷰는 이름으로 3D 를 잡으므로 그 순간 병 하나가 사라지고 새 병이 튀어나온다. */
    inContainerId: optStr(c.inContainerId, `${path}.inContainerId`),
    /* ★★ 시계의 기준일 — **「자른 날」이 아니라 「용기에 들어간 날」**(propagation §clockDayOf).
       ⚠ 안 적으면 열 때마다 `cutOnDay` 로 되돌아가 **가방에 오래 뒀던 삽수의 기한이
         앞당겨진다**(심하면 넣자마자 죽는다). 옛 세이브에는 이 칸이 없고, 그때는
         `clockDayOf` 가 `cutOnDay` 로 읽으므로 값이 한 톨도 안 달라진다. */
    clockOnDay: c.clockOnDay == null ? null : needInt(c.clockOnDay, `${path}.clockOnDay`, { min: 0 }),
    gen: needInt(c.gen ?? 1, `${path}.gen`, { min: 0 }),
    varieChance: needNum(c.varieChance ?? 0, `${path}.varieChance`, { min: 0 }),
    variegated: !!c.variegated,
    varieRolled: !!c.varieRolled,
    /* ★★ 자란 잎 (2026-08-04 삽수 생장) — **반드시 같이 적는다.**
       `leafVarie` 는 「어느 잎이 무늬인가」이고, 그 배열이 곧 자를 마디 목록과 그 마디의 `w` 다
       (propagation.js §삽수가 자란다). 안 적으면 저장 한 번에 자란 잎이 통째로 사라지고
       삽수가 자른 날 크기로 되돌아간다 — 게다가 `w` 가 달라져 계통 판단이 어긋난다.
       ⚠ 옛 세이브에는 이 칸이 없다. 그때는 `source` 로 되메운다(propagation.cuttingStatsNow 와 같은 규칙). */
    leafVarie: needArr(
      Array.isArray(c.leafVarie)
        ? c.leafVarie
        : Array.from({ length: (c.source && c.source.leaves) || 0 },
                     (_, i) => i < ((c.source && c.source.variegatedLeaves) || 0)),
      `${path}.leafVarie`).map(v => !!v),
    /* ★★★ 잎별 **무늬 등급** (2026-08-17 · 확정문 §5 — 「무늬는 개수가 아니라 종류다」).
       ------------------------------------------------------------
       `leafGrade[i]` 는 `leafVarie[i]` 와 **같은 자리의 같은 잎**이다.
         · 민무늬 잎     → `null`
         · 등급이 정해진 무늬 잎 → 'sanban'|'halfmoon'|'fullmoon' (정본은 varie_grades.json)
         · 아직 못 정한 무늬 잎  → `null` ★ **산반으로 굳히지 않는다**
       ⚠⚠ 안 적으면 **저장 한 번에 하프문 잎이 산반이 된다** — 값이 반 넘게 준다
         (잎 한 장 750,000 → 350,000). `leafVarie` 를 안 적으면 잎이 사라지던 것과 같은 무게다.
       ⚠ **길이를 `leafVarie` 에 맞춘다.** 옛 세이브에는 이 칸이 아예 없어 전부 `null` 이 되고,
         그 판의 무늬 잎은 값을 매길 때 산반으로 읽힌다(확정문 §5). 그 사실은 조용히 넘기지
         않고 `migrateVarieGrades` 가 기록에 남긴다.
       ⚠ 문자열 검사를 한다 — 모르는 갈래 이름이 세이브에서 상태로 새어 들어오면
         `priceOf` 가 그 자리에서 던진다(값 매기기가 통째로 막힌다). */
    leafGrade: needArr(
      Array.isArray(c.leafVarie)
        ? c.leafVarie.map((v, k) => (v && Array.isArray(c.leafGrade) ? (c.leafGrade[k] ?? null) : null))
        : [],
      `${path}.leafGrade`).map((g, k) => (g == null ? null : needStr(g, `${path}.leafGrade[${k}]`))),
    leafDays: needInt(c.leafDays ?? 0, `${path}.leafDays`, { min: 0 }),
    grewLeaves: needInt(c.grewLeaves ?? 0, `${path}.grewLeaves`, { min: 0 }),
    /* ★★ 2026-08-17 — **빛이 정한 무늬 소질** (propagation.js §③).
       `varieLightBand` 가 `null` 이면 **아직 안 정해졌다**는 뜻이고, 정해지면
       'dark'|'mid'|'bright' 가 적힌다. ⚠ 이 칸을 안 적으면 저장 한 번에 「이미 정해진 것」이
       미정으로 돌아가 **밝은 데서 정한 80% 가 다음 자리의 빛으로 다시 정해진다.**
       `varieFromCut` 은 「무늬 마디에서 떴나」 — 빛 판정을 기다리는 대상인지의 정본이다. */
    varieLightBand: optStr(c.varieLightBand, `${path}.varieLightBand`),
    /* ⚠ 옛 세이브에는 이 칸이 **없다.** 0/false 로 메꾸면 옛 무늬 삽수가 빛 판정에서 통째로
       빠져 「무늬 삽수인데 소질이 영영 모주 값」이 된다. 그래서 **세이브에 적혀 있는 것으로
       되메운다** — 자를 때 무늬 잎이 딸려왔나(`source.variegatedLeaves`). 지어낸 값이 아니고,
       바로 위 `leafVarie` 가 옛 세이브를 되메우는 방식과 같다. */
    varieFromCut: c.varieFromCut == null
      ? ((c.source && c.source.variegatedLeaves) || 0) >= 1
      : !!c.varieFromCut,
    /* ⏸ 계통 갈래(원복·유지·고스트) — **2026-08-17 에 규칙에서 빠졌다.**
       ⚠ 그래도 **계속 적고 계속 읽는다.** 옛 판에 적혀 있는 칸이고, 안 읽으면 그 판이 안 열린다.
         새 삽수는 언제나 `null` 이라 이 칸이 조용히 비어 간다(그게 맞는 모습이다). */
    lineage: optStr(c.lineage, `${path}.lineage`),
    lineageKnown: !!c.lineageKnown,
    cutW: c.cutW == null ? null : needNum(c.cutW, `${path}.cutW`, { min: 0 }),
    /* ⏸ 고스트 기한 — 규칙에서 빠졌다(고스트로 안 죽는다). 칸은 읽되 `migrateCuttingRules`
       가 열 때 지운다. 여기서 지우지 않는 이유: 이 함수는 **쓸 때도 읽을 때도 같은 것**이라
       여기서 지우면 「저장했더니 값이 달라졌다」가 된다(save.js 머리말 규칙). */
    ghostDeadlineDay: c.ghostDeadlineDay == null
      ? null : needInt(c.ghostDeadlineDay, `${path}.ghostDeadlineDay`, { min: 0 }),
    motherCuttingId: optStr(c.motherCuttingId, `${path}.motherCuttingId`),
    slotId: optStr(c.slotId, `${path}.slotId`),
    at: packAt(c.at, `${path}.at`),
    status: needStr(c.status, `${path}.status`),
    days: needInt(c.days ?? 0, `${path}.days`, { min: 0 }),
    rootedOnDay: c.rootedOnDay == null ? null : needInt(c.rootedOnDay, `${path}.rootedOnDay`, { min: 0 }),
    nodeOnDay: c.nodeOnDay == null ? null : needInt(c.nodeOnDay, `${path}.nodeOnDay`, { min: 0 }),
    pottedOnDay: c.pottedOnDay == null ? null : needInt(c.pottedOnDay, `${path}.pottedOnDay`, { min: 0 }),
    deadlineDay: c.deadlineDay == null ? null : needInt(c.deadlineDay, `${path}.deadlineDay`, { min: 0 }),
    warned: needArr(c.warned || [], `${path}.warned`).map((w, j) => needStr(w, `${path}.warned[${j}]`)),
    potted: !!c.potted,
    /* ★★ 중고 거래에 올려 둔 게시글 id (2026-08-17 · shop.js §⑦-0).
       ⚠ **한 벌로 적어야 한다** — 게시글(`shop.listings`)만 적고 이 표를 안 적으면,
         열었을 때 「게시글은 있는데 아무 삽수도 자기가 올라간 줄 모르는」 판이 된다.
         ⇒ 그래서 `unpack` 이 열자마자 둘을 맞춰 본다(아래 §reconcileMarket). */
    listing: optStr(c.listing, `${path}.listing`)
  };
}

/* ============================================================
   ★★ 옛 삽수 이관 — 「키메라 세 갈래」로 만들어진 판을 연다 (2026-08-17)
   ------------------------------------------------------------
   2026-08-17 에 박사님이 삽수 규칙을 갈아엎으셨다(propagation.js §③). 옛 세이브에는
   그 전 규칙이 실제로 적혀 있다 — `lineage`(revert/chimera/ghost) · `ghostDeadlineDay` ·
   그리고 그 규칙이 정한 `varieChance`. **그 판이 안 열리면 이번 일이 실패다.**

   ★ 이 함수가 하는 일은 셋뿐이고, **전부 「없어진 규칙의 흔적을 끄는 것」**이다.
     지어내는 값이 하나도 없다.

     ① **고스트 시계를 끈다**(`ghostDeadlineDay → null`).
        고스트로 죽는 규칙이 없어졌다. 안 끄면 그 판의 삽수가 **없어진 규칙으로 죽는다.**
     ② **고스트의 `varieChance = 1` 을 천장(0.80)으로 낮춘다.**
        1 은 「흰 조직만 남았다」를 뜻하던 값이지 무늬율이 아니었다. 그대로 두면
        새 잎이 **100% 무늬**로 나서 새 규칙의 천장(박사님 *"천정 80%"*)을 넘는다.
        ⚠ **뺏는 쪽이 아니라 맞추는 쪽이다** — 그 삽수는 원래 죽을 것이었는데 이제 산다.
     ③ **말한다.** 옛 무늬 삽수는 이제 「놓인 자리의 빛이 소질을 정한다」로 바뀌었다.
        ⚠ `varieFromCut` 되메우기는 **`packCutting` 이 한다**(위 §varieFromCut) — 쓸 때와
          읽을 때가 같아야 하는 칸이라 그쪽이 맞는 자리다. 여기서는 세기만 한다.
        ★ 그리고 `varieLightBand` 는 **안 채운다.** 그 판은 빛을 잰 적이 없고, 잰 척하면
          거짓말이 된다. 미정으로 두면 다음 하루에 그 자리의 빛으로 정해진다.

   ★ 「옛 판이다」의 표시로 **`lineage` 가 적혀 있나**를 쓴다. 새 삽수는 그 칸이 언제나 null 이라
     (propagation.js §takeCutting) 지금 판이 여기 걸리는 일이 없다.

   ⚠ **`lineage` 는 안 지운다.** 「예전 판에서 무엇이었나」는 사실이고, 지우면 그 사실이
     사라진다. 규칙에서만 뺐다(propagation.js §⏸ 키메라와 같은 사상).
   ⚠ **이미 새 규칙으로 도는 판은 안 건드린다** — `varieLightBand` 가 적혀 있거나
     `lineage` 가 없으면 손대지 않는다. 뭉개면 저장할 때마다 값이 흔들린다
     (`migrateVarieSale` 이 「칸이 없다」와 「0건이다」를 가른 것과 같은 규칙).
   반환 사람이 읽을 로그 줄들(없으면 빈 배열). */
export function migrateCuttingRules(S) {
  const out = [];
  let ghostClocks = 0, ceiled = 0, marked = 0;
  for (const c of (S && S.cuttings) || []) {
    if (!c) continue;
    if (c.ghostDeadlineDay != null) { c.ghostDeadlineDay = null; ghostClocks++; }
    if (!c.lineage) continue;                         // 새 삽수 — 옛 규칙의 흔적이 없다
    if (c.lineage === 'ghost' && Number.isFinite(c.varieChance) && c.varieChance > VARIE_LIGHT.bright) {
      c.varieChance = VARIE_LIGHT.bright;
      ceiled++;
    }
    if (c.varieFromCut && !c.varieLightBand) marked++;
  }
  if (ghostClocks)
    out.push(`예전 판의 고스트 기한 ${ghostClocks}건을 껐습니다 — ` +
             `2026-08-17 부터 고스트로 시들지 않습니다`);
  if (ceiled)
    out.push(`예전 판의 고스트 삽수 ${ceiled}건의 새 잎 무늬율을 ` +
             `${Math.round(VARIE_LIGHT.bright * 100)}%(천장)로 맞췄습니다`);
  if (marked)
    out.push(`예전 판의 무늬 삽수 ${marked}건은 놓인 자리의 빛이 새 잎 무늬율을 정합니다`);
  return out;
}

/* ============================================================
   ★★★ 옛 판의 무늬 잎을 **산반으로 읽는다** — 그리고 그 사실을 남긴다 (2026-08-17)
   ------------------------------------------------------------
   확정문 §5: *"옛 세이브에는 등급이 없다. 무늬 잎이 있는 옛 판은 **산반으로 읽는다**
   (제일 흔한 것). ★ 조용히 하지 말고 **기록에 남겨라**."*

   ★ 이 함수는 **아무 값도 안 바꾼다.** 세는 것과 말하는 것이 전부다.
     ⇒ 등급을 여기서 채워 넣으면 「모른다」가 「산반으로 정해졌다」로 굳어 버리고,
       그 뒤로는 그 잎이 빛으로 다시 정해질 길이 영영 막힌다. 값을 매길 때만
       `shop.leafGradeListOf` 가 산반으로 편다 — 되돌릴 수 있는 자리에만 둔다.

   ⚠ **「옛 판이다」의 표시**는 `raw` 에 `leafGrade`·`leafGrades` 칸이 **아예 없다**는 것이다.
     비어 있는 것(`{}` · 전부 null)과 없는 것은 다르다 — 새 판도 무늬가 나기 전에는 비어 있다.
     그래서 정리된 상태가 아니라 **세이브에서 온 날것**을 본다
     (`migrateVarieSale` 이 「칸이 없다」와 「0건이다」를 가른 것과 같은 규칙).
   반환 사람이 읽을 로그 줄들(없으면 빈 배열). */
export function migrateVarieGrades(S, raw) {
  const out = [];
  const rawPots = (raw && Array.isArray(raw.pots)) ? raw.pots : [];
  const rawCuts = (raw && Array.isArray(raw.cuttings)) ? raw.cuttings : [];

  let oldCuts = 0, oldCutLeaves = 0;
  (S.cuttings || []).forEach((c, i) => {
    if (!c || rawCuts[i] == null || rawCuts[i].leafGrade !== undefined) return;
    const v = (c.leafVarie || []).reduce((n, x) => n + (x ? 1 : 0), 0);
    if (v > 0) { oldCuts++; oldCutLeaves += v; }
  });
  const oldPots = (S.pots || []).filter((p, i) => p && rawPots[i] != null &&
                                                  rawPots[i].leafGrades === undefined).length;

  if (oldCuts)
    out.push(`예전 판의 삽수 ${oldCuts}개(무늬 잎 ${oldCutLeaves}장)에 등급이 없습니다 — ` +
             `값을 매길 때 **산반**으로 읽습니다(확정문 §5)`);
  if (oldPots)
    out.push(`예전 판의 그루 ${oldPots}개에 잎별 등급 장부가 없습니다 — ` +
             `이미 난 무늬 잎은 **산반**으로 읽고, 앞으로 나는 잎부터 자리의 빛이 등급을 정합니다`);
  return out;
}

/* ★★ 옛 세이브 이전 — **한 칸짜리 옛 상태를 시루 목록으로** (2026-08-04).
   `ensureCropPots` 한 함수가 그 일을 한다(first_play.js). 여기서 부르는 이유는
   **쓸 때도 읽을 때도 같은 모양이라야** 하기 때문이다: 옛 세이브를 읽어 바로 다시 저장해도
   같은 값이 나온다. 이 함수는 원본을 안 건드린다(사본을 만들어 옮긴다) — 검증 도중에
   상태가 바뀌면 던졌을 때 반쯤 옮겨진 상태가 남는다. */
function cropPotsOf(b) {
  if (Array.isArray(b.pots) && b.pots.length) return b.pots;
  return ensureCropPots({ ...b, pots: null }).pots;
}

/* ★ 불러온 시루의 좌표를 **좌표 객체로** 되세운다 (2026-08-09 · 시루마다 자리).
   세이브에서 온 `at` 은 그냥 JSON 이다. 화분(`S.pots`)·자리 사본이 `makeAt` 을 거치는 것과
   같은 이유로 시루도 거쳐야 한다 — 안 거치면 좌표 불변식(방 안인가·가구 위인가)이
   확인되지 않은 값이 상태에 그대로 앉는다. */
function restoreCropPotAts(site) {
  for (const p of (site && site.pots) || [])
    if (p) p.at = p.at ? makeAt(p.at) : null;
}

/* 첫 플레이 — `rules` 는 **안 적는다.** 밸런스 정본(data/balance/characters.json)에서
   불러올 때 다시 유도한다. 세이브에 굳히면 밸런스를 고쳐도 옛 세이브만 옛 값으로 돈다. */
/* ★★ 작물 자리 하나를 적는다 (2026-08-05 · first_play §작물 자리).
   ------------------------------------------------------------
   ★ **0번 자리(콩나물)는 여전히 `beansprout` 이라는 이름으로 적는다.** 이름을 안 바꾼 근거는
     first_play.js §작물 자리 ★★ 에 있다 — 요약하면 ① 옛 세이브가 그 이름이고 ② 화면(game.html·
     room_view.js)이 그 이름을 읽는데 그 파일들은 이 창 소유가 아니다.
   ★ 1번부터는 `firstPlay.crops[]` 로 **덧붙인다.** 옛 세이브에는 이 칸이 아예 없고,
     없으면 `createFirstPlayState` 가 만든 빈 자리가 그대로 남는다 = **옛 판이 그대로 열린다.**
   ⚠ `crops` 에 0번을 또 넣지 않는다. 같은 객체를 두 번 실으면 `assertPlainJson` 이
     순환참조로 보고 던진다(그 함수는 본 객체를 다시 안 본다). */
function packCropSite(site, path) {
  const o = needObj(site, path);
  return {
    kind: needStr(o.kind, `${path}.kind`),
    slotId: optStr(o.slotId, `${path}.slotId`),
    at: packAt(o.at, `${path}.at`),
    harvestDays: needInt(o.harvestDays ?? 0, `${path}.harvestDays`, { min: 0 }),
    sirus: needInt(o.sirus ?? 0, `${path}.sirus`, { min: 0 }),
    cycle: needInt(o.cycle ?? 1, `${path}.cycle`, { min: 1 }),
    harvestCount: needInt(o.harvestCount ?? 0, `${path}.harvestCount`, { min: 0 }),
    harvestMeals: needInt(o.harvestMeals ?? 0, `${path}.harvestMeals`, { min: 0 }),
    wateredOnDay: o.wateredOnDay == null ? null
      : needInt(o.wateredOnDay, `${path}.wateredOnDay`, { min: 0 }),
    /* ★ 정본은 pots 다 — 대표 칸(ageDays·dliHist…)은 불러올 때 syncCropLead 가 다시 세운다.
       ⚠ 여기서는 `ensureCropPots` 로 채우지 않는다. 2종째는 **빈 것이 정상**이라
         지어내면 안 산 재배판이 공짜로 생긴다(first_play.ensureCropPots 의 ★★). */
    pots: needArr(o.pots || [], `${path}.pots`).map((p, i) => packCropPot(p, `${path}.pots[${i}]`))
  };
}

/* 시루/재배판 한 칸. 0번 자리와 1번부터가 **같은 검증**을 타야 세이브가 안 갈린다. */
function packCropPot(p, w) {
  const o = needObj(p, w);
  return {
    id: needStr(o.id, `${w}.id`),
    /* ★★ **시루마다의 자리** (2026-08-09 · first_play §자리는 시루마다 따로다).
       ------------------------------------------------------------
       ⚠ 안 적으면 저장 한 번에 시루들이 **한 자리로 뭉친다** — 불러올 때 `ensureCropPots` 가
         자리 사본(대표 시루의 자리) 하나를 시루 전부에 베끼기 때문이다. 각개로 흩어 놓은
         판이 통째로 되돌아간다.
       ⚠ **옛 세이브에는 이 칸이 없다.** 그때는 둘 다 null 로 적히고, 불러오는 쪽에서
         `ensureCropPots` 가 자리 사본을 시루마다 베껴 채운다 — 옛 판은 실제로 한 자리에
         무리로 서 있었으므로 그것이 그때의 사실이다(지어낸 값이 아니다).
       ★ 그래서 옛 세이브가 **각개 모양으로 열린다**: 자리는 겹쳐 있지만 하나씩 집어 옮길 수 있다. */
    slotId: optStr(o.slotId, `${w}.slotId`),
    at: packAt(o.at, `${w}.at`),
    startedOnDay: o.startedOnDay == null ? null
      : needInt(o.startedOnDay, `${w}.startedOnDay`, { min: 0 }),
    idleSinceDay: needInt(o.idleSinceDay ?? 0, `${w}.idleSinceDay`, { min: 0 }),
    /* ★★ **씨앗을 뿌렸나** (2026-08-11 · first_play §sown).
       ⚠ 안 적으면 껐다 켜는 순간 **안 심은 재배판이 심긴 판이 된다** — 씨앗 한 봉지를
         안 쓰고 회전이 도는 판이고, 그 사고가 이 저장소에 이미 있다(`arrivalSlotId`).
       ⚠ **옛 세이브에는 이 칸이 없다.** 그때는 「놓기 = 심기」였으므로 없는 것이 곧
         심은 것이다 — 반대로 잡으면 돌아가던 판의 콩나물이 통째로 물을 못 받는다. */
    sown: o.sown !== false,
    ageDays: needInt(o.ageDays ?? 0, `${w}.ageDays`, { min: 0 }),
    dliHist: needArr(o.dliHist || [], `${w}.dliHist`)
      .map((v, j) => needNum(v, `${w}.dliHist[${j}]`, { min: 0 })),
    harvested: !!o.harvested,
    quality: optStr(o.quality, `${w}.quality`),
    meals: needInt(o.meals ?? 0, `${w}.meals`, { min: 0 }),
    avgDli: optNum(o.avgDli, `${w}.avgDli`),
    cycle: needInt(o.cycle ?? 1, `${w}.cycle`, { min: 1 }),
    harvestCount: needInt(o.harvestCount ?? 0, `${w}.harvestCount`, { min: 0 }),
    harvestMeals: needInt(o.harvestMeals ?? 0, `${w}.harvestMeals`, { min: 0 }),
    savedWon: needNum(o.savedWon ?? 0, `${w}.savedWon`, { min: 0 }),
    overlapIndex: needInt(o.overlapIndex ?? 0, `${w}.overlapIndex`, { min: 0 })
  };
}

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
      /* ★ 0번 자리의 종류. 옛 세이브에는 없다 — 없으면 콩나물이다(그때는 그것뿐이었다) */
      kind: needStr(b.kind || 'beansprout', 'firstPlay.beansprout.kind'),
      slotId: optStr(b.slotId, 'firstPlay.beansprout.slotId'),
      at: packAt(b.at, 'firstPlay.beansprout.at'),
      ageDays: needInt(b.ageDays ?? 0, 'firstPlay.beansprout.ageDays', { min: 0 }),
      harvestDays: needInt(b.harvestDays ?? 0, 'firstPlay.beansprout.harvestDays', { min: 0 }),
      dliHist: needArr(b.dliHist || [], 'firstPlay.beansprout.dliHist')
        .map((v, i) => needNum(v, `firstPlay.beansprout.dliHist[${i}]`, { min: 0 })),
      harvested: !!b.harvested,
      quality: optStr(b.quality, 'firstPlay.beansprout.quality'),
      meals: needInt(b.meals ?? 0, 'firstPlay.beansprout.meals', { min: 0 }),
      avgDli: optNum(b.avgDli, 'firstPlay.beansprout.avgDli'),
      /* ★ 회전 (2026-08-03) — 안 적으면 저장 한 번에 시루 수가 1로 돌아가고
         "몇 번째 수확인가"가 사라져 첫 수확 대사가 다시 나온다. */
      sirus: needInt(b.sirus ?? 1, 'firstPlay.beansprout.sirus', { min: 1 }),
      cycle: needInt(b.cycle ?? 1, 'firstPlay.beansprout.cycle', { min: 1 }),
      harvestCount: needInt(b.harvestCount ?? 0, 'firstPlay.beansprout.harvestCount', { min: 0 }),
      harvestMeals: needInt(b.harvestMeals ?? 0, 'firstPlay.beansprout.harvestMeals', { min: 0 }),
      /* ★ 마지막으로 회전을 시작한 날 (2026-08-04) — **절대 게임일**이라 복원 뒤에도 맞는다.
         ⚠ 정본은 아래 `pots[].startedOnDay` 다. 이 칸은 화면이 읽는 사본이고,
           불러올 때 `syncCropLead` 가 pots 에서 다시 세운다. */
      wateredOnDay: b.wateredOnDay == null ? null
        : needInt(b.wateredOnDay, 'firstPlay.beansprout.wateredOnDay', { min: 0 }),
      /* ★★ 시루마다 자기 회전 (2026-08-04 · first_play.js §시루마다 자기 회전).
         **여기가 정본이다.** 위 칸들(ageDays·dliHist·harvested…)은 대표 시루의 사본이라
         불러올 때 pots 에서 다시 세워진다 — 두 정본을 남기지 않는다.
         ⚠ `dryDays`·`dryRun`(마른 날)은 **사라졌다.** 물이 회전 시작이 되면서 그 개념 자체가
           없어졌다(§물주기). 옛 세이브에 그 칸이 있어도 그냥 안 읽는다 — 잃을 진행이 없다.
         ⚠ 옛 세이브에는 pots 가 아예 없다. 그때는 `ensureCropPots` 가 한 칸짜리 옛 상태를
           그대로 첫 시루로 옮긴다(아래 unpack) — 진행·이력·수확 횟수가 한 개도 안 사라진다. */
      pots: needArr(cropPotsOf(b), 'firstPlay.beansprout.pots')
        .map((p, i) => packCropPot(p, `firstPlay.beansprout.pots[${i}]`))
    },
    /* ★★ 2종째부터의 작물 자리 (2026-08-05 · 위 §작물 자리).
       옛 세이브에는 없다 → `[]` 로 적히고, 불러올 때 새 상태의 빈 자리가 그대로 남는다. */
    crops: needArr(fp.crops || [], 'firstPlay.crops')
      .map((s, i) => packCropSite(s, `firstPlay.crops[${i}]`)),
    food: {
      /* ★ 곳간은 **원**이다 (2026-08-04 · first_play.js §작물 종류).
         ⚠ 옛 세이브는 `pantryMeals`(끼니)를 갖고 있다. 스키마를 올려 통째로 못 읽게 하는 대신
           **여기서 한 번 환산한다** — 한 끼 2,500원이라는 사실은 지금도 정본(characters.json)이라
           지어낸 값이 아니다. 환산 뒤에는 끼니 칸을 안 적는다(두 정본을 남기지 않는다). */
      pantryWon: needNum(
        f.pantryWon ?? (Number.isFinite(f.pantryMeals) ? f.pantryMeals * 2_500 : 0),
        'firstPlay.food.pantryWon', { min: 0 }),
      /* ★★ 곳간을 이루는 꾸러미 목록 (2026-08-15 · first_play §곳간 판매).
         ⚠ **정본은 바로 위 `pantryWon`(총액)이다.** 여기는 그 총액이 무엇으로 이루어졌나를
           적는 칸이라, 어긋나거나 아예 없어도 판이 안 깨진다 — 불러온 뒤 `pantryLotsOf` 가
           총액에 맞춰 다시 세운다(옛 세이브가 바로 그 길로 열린다: 없음 → `[]` → 하루치씩 쪼갬).
         ★ 그래서 이 칸을 안 적어도 **잃는 진행이 없다.** 잃는 것은 「어느 날 무엇을 거뒀나」
           라는 이야기뿐이고, 안 적으면 팔 때 「곳간에 있던 것」으로만 뜬다.
         ⚠ 선례 — `pantryMeals → pantryWon`(바로 위)이 스키마를 올려 통째로 막는 대신
           **여기서 한 번 환산**했다. 이번도 같은 자리에 같은 방식으로 붙인다. */
      pantryLots: needArr(f.pantryLots || [], 'firstPlay.food.pantryLots')
        .map((l, i) => {
          const o = needObj(l, `firstPlay.food.pantryLots[${i}]`);
          return {
            kind: optStr(o.kind, `firstPlay.food.pantryLots[${i}].kind`),
            day: o.day == null ? null
               : needInt(o.day, `firstPlay.food.pantryLots[${i}].day`, { min: 0 }),
            won: needNum(o.won ?? 0, `firstPlay.food.pantryLots[${i}].won`, { min: 0 }),
            meals: needInt(o.meals ?? 0, `firstPlay.food.pantryLots[${i}].meals`, { min: 0 })
          };
        }),
      /* ★★ 오늘 밥상에서 고른 몫 (2026-08-16 · first_play §eatFromPantry).
         ⚠ **null 과 0 을 갈라서 싣는다.** null = 안 골랐다(상한까지 먹는다) ·
           0 = 안 먹기로 골랐다. 한 칸으로 뭉개면 「모아서 팔려고 0g 을 고른 판」이
           새로고침 한 번에 4,867원을 먹어 치운다 — `sown` 칸과 같은 종류의 사고다
           (musunsow §2: 화이트리스트에 안 적으면 저장 한 번에 사라진다). */
      mealPlanWon: f.mealPlanWon == null ? null
        : needNum(f.mealPlanWon, 'firstPlay.food.mealPlanWon', { min: 0 }),
      /* ★★ **작물마다 갈라 고른 g** (2026-08-18 · first_play §갈라 고르기 · 고칠 목록 G-19).
         `{ beansprout: 300, musun: 0 }` 모양이고 null = 안 갈랐다.
         ⚠ **null 과 「전부 0」을 갈라서 싣는다** — 바로 위 `mealPlanWon` 이 겪은 그것과
           같은 사고다. `{beansprout:0, musun:0}`(= 오늘은 아무것도 안 먹는다)을 null 로
           뭉개면 새로고침 한 번에 상한까지 먹어 치운다.
         ★ 옛 세이브에는 이 칸이 없다 → null 로 열린다. **옛 판은 예전 그대로 돈다**
           (`eatFromPantry` 가 null 을 「안 골랐다」로 읽는다). 잃을 진행이 없다.
         ⚠ 모르는 작물 이름은 여기서 **던진다** — 조용히 콩나물로 굴리면 그 판의 밥상이
           통째로 거짓이 된다(first_play `cropKindIndexOf` 와 같은 결). */
      mealPlanByKind: (() => {
        const src = f.mealPlanByKind;
        if (src == null) return null;
        needObj(src, 'firstPlay.food.mealPlanByKind');
        const out = {};
        for (const k of Object.keys(src)) {
          cropKindOf(k);                       // 모르는 작물이면 던진다
          out[k] = needInt(Math.round(src[k] ?? 0),
                           `firstPlay.food.mealPlanByKind.${k}`, { min: 0 });
        }
        return out;
      })(),
      /* ★ 겹침을 세는 기억 (2026-08-04 · first_play.js §겹침). 안 남기면 저장 한 번에
         "오늘 이미 둘을 거뒀다"가 사라져, 불러온 뒤 셋째가 온전한 값을 받는다. */
      harvestDay: f.harvestDay == null ? null
        : needInt(f.harvestDay, 'firstPlay.food.harvestDay', { min: 0 }),
      harvestedOnDay: needInt(f.harvestedOnDay ?? 0, 'firstPlay.food.harvestedOnDay', { min: 0 }),
      /* ★★ 그날 종류별로 몇 번째까지 거뒀나 (2026-08-05 · first_play §겹침).
         겹침을 **종류마다 따로** 세게 되면서 합계 한 칸으로는 못 이어 센다 —
         저장 뒤 같은 날 또 거두면 순번이 0 으로 돌아가 규칙이 조용히 새어 나간다.
         옛 세이브에는 없다 → `{}` 로 시작한다(그때는 종류가 하나라 합계가 곧 순번이었다). */
      harvestedOnDayByKind: (() => {
        const src = f.harvestedOnDayByKind;
        if (!src || typeof src !== 'object') return {};
        const out = {};
        for (const k of Object.keys(src))
          out[k] = needInt(src[k] ?? 0, `firstPlay.food.harvestedOnDayByKind.${k}`, { min: 0 });
        return out;
      })(),
      lastHarvestMeals: needInt(f.lastHarvestMeals ?? 0, 'firstPlay.food.lastHarvestMeals', { min: 0 }),
      lastFoodSavedWon: needNum(f.lastFoodSavedWon ?? 0, 'firstPlay.food.lastFoodSavedWon', { min: 0 }),
      totalFoodSavedWon: needNum(f.totalFoodSavedWon ?? 0, 'firstPlay.food.totalFoodSavedWon', { min: 0 }),
      cashFoodWon: needNum(f.cashFoodWon ?? 0, 'firstPlay.food.cashFoodWon', { min: 0 }),
      lastSpoiledWon: needNum(f.lastSpoiledWon ?? 0, 'firstPlay.food.lastSpoiledWon', { min: 0 }),
      /* ★★ 잉여 판매 (2026-08-06 · first_play §잉여 판매).
         ⚠ 이 블록은 열쇠를 **하나하나 적는** 모양이라, `fp.food` 에 칸을 늘려도
           여기 안 적으면 **저장하는 순간 사라진다.** cropsale 창이 그걸 직접 확인했다:
             surplusWon 6,000 · totalSurplusSoldWon 4,200 → 저장 → 복원 → **0 · 0**
           안 넘긴 잉여를 안고 저장하면 그만큼 잃는다(판 돈은 지갑에 든 뒤라 안 잃는다).
         ★ 옛 세이브에는 이 칸이 없다 → 0 으로 연다. 잃을 진행이 없다.
         ★ 복원 쪽은 `Object.assign(fp.food, saved.food)` 라 고칠 것이 없다. */
      surplusWon: needNum(f.surplusWon ?? 0, 'firstPlay.food.surplusWon', { min: 0 }),
      lastSurplusWon: needNum(f.lastSurplusWon ?? 0, 'firstPlay.food.lastSurplusWon', { min: 0 }),
      totalSurplusSoldWon: needNum(f.totalSurplusSoldWon ?? 0,
                                   'firstPlay.food.totalSurplusSoldWon', { min: 0 }),
      /* ★ 곳간 채소를 팔아 받은 돈 누계 (2026-08-15 · §곳간 판매). 옛 세이브엔 없다 → 0 */
      totalPantrySoldWon: needNum(f.totalPantrySoldWon ?? 0,
                                  'firstPlay.food.totalPantrySoldWon', { min: 0 })
    },
    monstera: {
      arrived: !!m.arrived,
      slotId: optStr(m.slotId, 'firstPlay.monstera.slotId'),
      at: packAt(m.at, 'firstPlay.monstera.at'),
      /* ★ 2026-08-10 — 유도 카운터를 싣는다(growth-to-plan §㉢). 안 실으면 저장하고 다시 열 때마다
         0 부터 다시 세어, 「10일이 지나도 그대로면 옮겨 보세요」가 저장할 때마다 뒤로 밀린다.
         옛 세이브는 `guide` 가 없어 복원 때 기본값(newMonsteraGuide)이 그대로 남는다. */
      guide: m.guide ? {
        days:      optNum(m.guide.days,      'firstPlay.monstera.guide.days'),
        moved:     !!m.guide.moved,
        movedDays: optNum(m.guide.movedDays, 'firstPlay.monstera.guide.movedDays'),
        grewOnce:  !!m.guide.grewOnce,
        /* ★ 2026-08-29 — 「자리를 배웠나」(first_play §hinted). 안 실으면 새로고침에
           되살아나 같은 말을 또 한다. 옛 세이브는 없으니 거짓이다 — 그게 맞다(아직 안 배웠다). */
        hinted:    !!m.guide.hinted,
        lampHinted: !!m.guide.lampHinted
      } : null,
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
    /* ★ 튜토 확정 무늬 (2026-08-03) — **반드시 남긴다.**
       안 적으면 저장 한 번에 "이미 준 무늬"가 없던 일이 되어 다시 받는다(잭팟이 두 번 난다).
       반대로 `nodeIds` 를 잃으면 팔 때 값이 조용히 떨어진다. 둘 다 조용히 틀리는 유형이다. */
    varieGrant: {
      nodeIds: needArr((ts.varieGrant || {}).nodeIds || [], 'tutorial.varieGrant.nodeIds')
        .map((v, i) => needStr(String(v), `tutorial.varieGrant.nodeIds[${i}]`)),
      count: needInt((ts.varieGrant || {}).count ?? 0, 'tutorial.varieGrant.count', { min: 0 }),
      lastDay: (ts.varieGrant || {}).lastDay == null ? null
        : needInt(ts.varieGrant.lastDay, 'tutorial.varieGrant.lastDay', { min: 0 })
    },
    /* ★★ 무늬 삽수를 판 적이 있나 (2026-08-13) — **반지하 탈출의 둘째 축**이다.
       뜻은 `tutorial.js §무늬 삽수를 판 적이 있다` 가 갖는다. 안 적으면 저장 한 번에
       「판 적 있다」가 없던 일이 되어 **이미 판 사람이 방에 갇힌다.**
       ⚠ 옛 세이브에는 이 칸이 아예 없다 — 아래 §무늬 삽수 판매 이관 이 옮긴다. */
    varieSale: {
      count: needInt((ts.varieSale || {}).count ?? 0, 'tutorial.varieSale.count', { min: 0 }),
      firstDay: (ts.varieSale || {}).firstDay == null ? null
        : needInt(ts.varieSale.firstDay, 'tutorial.varieSale.firstDay', { min: 0 }),
      wonTotal: needNum((ts.varieSale || {}).wonTotal ?? 0, 'tutorial.varieSale.wonTotal', { min: 0 }),
      /* 옛 세이브에서 옮겨 온 것이면 그 사유가 남는다 — 「실제로 판 것」과 갈라 읽으려고 */
      migrated: (ts.varieSale || {}).migrated == null ? null
        : needStr(String(ts.varieSale.migrated), 'tutorial.varieSale.migrated')
    },
    /* ★★ 2026-08-24 — **무늬 잎을 낸 적**(이사 둘째 축 · tutorial §noteVarieLeaf).
       ⚠ 안 담으면 불러오기에서 「낸 적 있다」가 없던 일이 되어 **이미 낸 사람이 방에 갇힌다** —
         바로 위 `varieSale` 과 똑같은 자리다.
       ⚠ 옛 세이브에는 이 칸이 없다. 그때는 `false` 로 서고, `canMoveOut` 이
         「판 적」(`varieSale`)을 `||` 로 같이 보므로 **이미 판 사람은 그대로 나간다.**
       ⚠ `ever` 는 **한 번 참이면 안 내린다** — 여기서도 되돌리지 않는다. */
    varieLeaf: {
      ever: !!(ts.varieLeaf || {}).ever,
      firstDay: (ts.varieLeaf || {}).firstDay == null ? null
        : needInt(ts.varieLeaf.firstDay, 'tutorial.varieLeaf.firstDay', { min: 0 }),
      where: (ts.varieLeaf || {}).where == null ? null
        : needStr(String(ts.varieLeaf.where), 'tutorial.varieLeaf.where')
    },
    /* 살림 장부 — 상점에 쓴 돈·판 돈. 안 적으면 "얼마 벌었나"가 저장 왕복에서 사라진다. */
    crop: {
      spentWon: needNum((ts.crop || {}).spentWon ?? 0, 'tutorial.crop.spentWon', { min: 0 }),
      soldWon: needNum((ts.crop || {}).soldWon ?? 0, 'tutorial.crop.soldWon', { min: 0 })
    },
    movedOut: !!ts.movedOut,
    bankrupt: !!ts.bankrupt
  };
}

/* ★★ 무늬 삽수 판매 이관 — **옛 세이브가 방에 갇히지 않게** (2026-08-13)
   ------------------------------------------------------------
   탈출의 둘째 축이 「배움 넷」에서 「무늬 삽수를 판 적이 있다」로 바뀌었다
   (`tutorial.js §두 축`). 그런데 **옛 세이브에는 그 칸이 없다** — 그대로 열면
   이미 무늬 삽수를 팔았던 사람도 `count = 0` 이 되어 **[이사]가 도로 잠긴다.**
   ⚠ 값을 지어내면 안 되지만, **약속을 뺏어서도 안 된다.** 그래서 세이브에 **이미 적혀 있는
     사실**만으로 판단하고, 판단이 갈리면 **관대한 쪽**으로 연다. 조건을 새로 만든 쪽이
     증명 책임을 지는 것이 맞다(선례: 위 §pantryMeals → pantryWon 환산 · §wateredOnDay).

   ★ 여는 사유 셋 — 전부 세이브에 적혀 있는 값이다:
     ㄱ `movedOut` 이 참이다 — **이미 나간 판**이다. 되돌리면 방이 두 개가 된다
     ㄴ **옛 조건이 이미 참이었다**(돈 ≥ 이사비 · 배움 넷) — 저장된 그 순간 [이사] 단추가
        실제로 열려 있던 판이다. 새 축을 소급해 닫는 것은 그 사람에게서 이미 준 것을 뺏는 일이다
     ㄷ **확정 무늬 마디를 잘라냈는데 그 삽수가 지금 없다** —
        `varieGrant.count − varieGrant.nodeIds.length` 가 잘려 나간 무늬 마디 수이고,
        그보다 **살아 있는 무늬 삽수가 적으면** 그 차이만큼은 손을 떠났다는 뜻이다.
        판 것인지 시든 것인지는 세이브에 안 적혀 있다 — 그래서 **판 것으로 친다**(관대한 쪽).
   ⚠ 셋 다 아니면 **안 연다.** 그 판은 아직 무늬 삽수를 만져 본 적이 없는 판이고,
     지금부터 잘라 팔면 된다 — 잃는 진행이 없다.
   ★ 옮겨 온 것은 `migrated` 에 사유가 남는다. 「실제로 판 것」과 갈라서 읽을 수 있어야
     나중에 이 줄이 왜 참인지를 다시 셀 수 있다. */
function migrateVarieSale(S, ts) {
  const v = ts.varieSale;
  if ((v.count || 0) > 0) return null;                    // 이미 값이 있으면 손대지 않는다
  const g = ts.varieGrant || {};
  const cutAwayVarie = Math.max(0, (g.count || 0) - ((g.nodeIds || []).length));
  const liveVarie = (S.cuttings || [])
    .filter(c => c && c.status !== 'dead' && (c.variegatedLeaves || 0) >= 1).length;
  const why = ts.movedOut ? 'moved-out'
            : (ts.cashWon >= ts.rules.moveOutCostWon &&
               Object.values(ts.learned).every(Boolean)) ? 'old-gate'
            : cutAwayVarie > liveVarie ? 'varie-cut-gone'
            : null;
  if (!why) return null;
  v.count = 1;
  /* ⚠ **판 날은 세이브에 없다.** 지어내지 않고 「그 판의 오늘」로 채운다 —
     위 §wateredOnDay 가 쓴 것과 같은 사상이다(잃는 쪽이 아니라 안전한 쪽). */
  v.firstDay = ts.day;
  v.migrated = why;
  return why;
}

/* ★ 스토리 ③④ (2026-08-05) — 원룸에 들어온 날과 엔딩을 본 날.
   ★ **단계(stage)는 안 적는다.** 단계는 `tutorial.movedOut` 과 아래 `ending.doneOnDay` 에서
     유도한다(oneroom.stageOf). 적어 두면 둘이 갈렸을 때 어느 쪽이 사실인지 알 수 없다.
   ⚠ `doneOnDay` 를 잃으면 **끝난 판이 다시 안 끝난 판**이 되고, 초보 모드도 다시 켜진다
     (propagation.isNoviceMode 가 이 값을 본다). 조용히 틀리는 유형이라 반드시 남긴다. */
function packStory(story) {
  if (!story) return null;
  const end = needObj(story.ending || {}, 'story.ending');
  const optDay = (v, path) => (v == null ? null : needInt(v, path, { min: 0 }));
  return {
    schema: needStr(story.schema || STORY_SCHEMA, 'story.schema'),
    movedInOnDay: optDay(story.movedInOnDay, 'story.movedInOnDay'),
    ending: {
      reachedOnDay: optDay(end.reachedOnDay, 'story.ending.reachedOnDay'),
      doneOnDay: optDay(end.doneOnDay, 'story.ending.doneOnDay')
    }
  };
}

/* ★ 상점 (2026-08-03) — **배송 중인 주문이 세이브의 핵심**이다.
   돈은 이미 나갔고 물건은 아직 안 왔으므로, 안 적으면 저장 한 번에 **돈만 사라진다.**
   `arrivesOnDay` 는 절대 게임일이라 복원 뒤에도 그대로 맞는다(상대 일수로 적으면 어긋난다). */
function packShop(shop) {
  if (!shop) return null;
  const stock = {};
  for (const [k, v] of Object.entries(shop.stock || {}))
    stock[k] = needInt(v ?? 0, `shop.stock['${k}']`, { min: 0 });
  return {
    schema: needStr(shop.schema || SHOP_SCHEMA, 'shop.schema'),
    seq: needInt(shop.seq ?? 0, 'shop.seq', { min: 0 }),
    orders: needArr(shop.orders || [], 'shop.orders').map((o, i) => {
      const path = `shop.orders[${i}]`;
      needObj(o, path);
      return {
        orderId: needStr(o.orderId, `${path}.orderId`),
        itemId: needStr(o.itemId, `${path}.itemId`),
        qty: needInt(o.qty ?? 0, `${path}.qty`, { min: 1 }),
        unitWon: needNum(o.unitWon ?? 0, `${path}.unitWon`, { min: 0 }),
        totalWon: needNum(o.totalWon ?? 0, `${path}.totalWon`, { min: 0 }),
        orderedOnDay: needInt(o.orderedOnDay ?? 0, `${path}.orderedOnDay`, { min: 0 }),
        arrivesOnDay: needInt(o.arrivesOnDay ?? 0, `${path}.arrivesOnDay`, { min: 0 })
      };
    }),
    stock,
    spentWon: needNum(shop.spentWon ?? 0, 'shop.spentWon', { min: 0 }),
    earnedWon: needNum(shop.earnedWon ?? 0, 'shop.earnedWon', { min: 0 }),
    /* ★★ 갈래별 판 돈 (2026-08-13 · shop.js §판 돈은 갈래별로).
       안 적으면 저장 한 번에 「무엇을 팔아 번 돈인가」가 통째로 사라지고, 가계부가
       다시 뺄셈으로 돌아간다. ⚠ 합계(`earnedWon`)는 **그대로 둔다** — 지우면
       save.js:685 를 읽는 game.html 의 월 장부가 그 자리에서 깨진다.
       ⚠ 옛 세이브에는 이 칸이 없다 → 아래 §판 돈 갈래 이관 이 옮긴다. */
    earnedBy: SALE_KINDS.reduce((o, k) => {
      o[k] = needNum((shop.earnedBy || {})[k] ?? 0, `shop.earnedBy.${k}`, { min: 0 });
      return o;
    }, {}),
    /* ★★ 중고 거래 게시글 (2026-08-17 · shop.js §⑦-0) — **주문과 같은 무게의 칸이다.**
       ------------------------------------------------------------
       ⚠ 안 적으면 저장 한 번에 **올려 둔 물건이 통째로 사라진다.** 물건 자체는 안 없어지지만
         (게시글은 표만 붙인다) 연락도 값도 없어져서 「올렸는데 아무 일도 안 일어난다」가 된다.
       ★ 게시글은 **전부 숫자와 짧은 글자**다 — 물건을 안 담기 때문이다(§⑦-0 §물건을 안 치운다).
         그래서 이 함수가 통째로 검증할 수 있다. 물건을 담았다면 그럴 수 없었다.
       ★ `contactOnDay` 는 **절대 게임일**이다(`orders.arrivesOnDay` 와 같은 규약) —
         상대 일수로 적으면 복원 뒤 연락이 오는 날이 밀린다. */
    listings: needArr(shop.listings || [], 'shop.listings').map((l, i) => {
      const path = `shop.listings[${i}]`;
      needObj(l, path);
      return {
        listingId: needStr(l.listingId, `${path}.listingId`),
        kind: needStr(l.kind, `${path}.kind`),
        refId: needStr(l.refId, `${path}.refId`),
        ko: needStr(l.ko, `${path}.ko`),
        won: needNum(l.won ?? 0, `${path}.won`, { min: 0 }),
        leaves: needInt(l.leaves ?? 0, `${path}.leaves`, { min: 0 }),
        variegatedLeaves: needInt(l.variegatedLeaves ?? 0, `${path}.variegatedLeaves`, { min: 0 }),
        grade: needStr(l.grade || 'plain', `${path}.grade`),
        gradeKo: needStr(l.gradeKo || '무지', `${path}.gradeKo`),
        listedOnDay: needInt(l.listedOnDay ?? 0, `${path}.listedOnDay`, { min: 0 }),
        contactOnDay: needInt(l.contactOnDay ?? 0, `${path}.contactOnDay`, { min: 0 }),
        waitDays: needInt(l.waitDays ?? 0, `${path}.waitDays`, { min: 0 }),
        buyerKo: needStr(l.buyerKo || '동네 이웃', `${path}.buyerKo`),
        status: needStr(l.status || 'waiting', `${path}.status`),
        contactedOnDay: l.contactedOnDay == null
          ? null : needInt(l.contactedOnDay, `${path}.contactedOnDay`, { min: 0 })
      };
    }),
    listSeq: needInt(shop.listSeq ?? 0, 'shop.listSeq', { min: 0 }),
    /* ★ 문이 열린 날. **열린 사실 자체가 저장돼야 한다** — 그루를 판 뒤에는 잎이 0장이라
       이 칸이 없으면 옛 판을 열 때 문이 도로 닫힌다(shop.js §marketGate ★한 번 열리면). */
    marketOpenedOnDay: shop.marketOpenedOnDay == null
      ? null : needInt(shop.marketOpenedOnDay, 'shop.marketOpenedOnDay', { min: 0 })
  };
}

/* ★★ 게시글 ↔ 물건 맞추기 — **한쪽만 남은 판을 고친다** (2026-08-17)
   ------------------------------------------------------------
   게시글은 `shop.listings` 에, 표는 물건(`pot.listing`·`cutting.listing`)에 있다.
   **둘 다 저장하므로 정상 판에서는 늘 맞는다.** 그래도 맞춰 보는 까닭은 셋이다.

     ① **옛 세이브**에는 둘 다 없다 → 아무 일도 안 일어난다(빈 목록 · 표 없음). 안전하다.
     ② **판을 손으로 고친 판**(하네스·검사·개발용) 에서는 갈릴 수 있다.
     ③ ★ **삽수가 시들면 물건이 사라진다.** `stepMarket` 이 그 게시글을 내리지만,
        시든 그 날 저장하고 [다음 날]을 안 누른 채 다시 열면 게시글만 남는다.

   ⇒ 고치는 방향은 **한 가지뿐이다: 물건이 없는 게시글은 내린다.**
     반대로 물건에 붙은 표가 가리키는 게시글이 없으면 **표를 뗀다.**
   ⚠ 게시글을 **만들어 내지 않는다.** 표만 있고 게시글이 없을 때 게시글을 지어내면
     연락 날짜와 값을 지어내야 하고, 그건 세이브가 없는 값을 만드는 일이다.
   반환 { dropped, untagged } — 0/0 이면 아무 일도 안 했다는 뜻이다. */
function reconcileMarket(S) {
  const shop = S.shop;
  if (!shop || !Array.isArray(shop.listings)) return { dropped: 0, untagged: 0 };
  const pots = S.pots || [], cuttings = S.cuttings || [];
  const alive = l => l.kind === 'pot'
    ? pots.some(p => p.id === l.refId)
    : cuttings.some(c => c.id === l.refId && c.status !== 'dead');
  const before = shop.listings.length;
  shop.listings = shop.listings.filter(alive);
  const ids = new Set(shop.listings.map(l => l.listingId));
  let untagged = 0;
  for (const it of [...pots, ...cuttings])
    if (it.listing && !ids.has(it.listing)) { delete it.listing; untagged++; }
  return { dropped: before - shop.listings.length, untagged };
}

/* ★★ 판 돈 갈래 이관 — **옛 판에서 돈이 사라진 것처럼 보이면 안 된다** (2026-08-13)
   ------------------------------------------------------------
   옛 세이브에는 `shop.earnedBy` 칸이 없다. 그대로 열면 **갈래별 합이 `earnedWon` 보다 작다** —
   가계부에서 번 돈이 통째로 증발한 것처럼 보이고, 「합계 = 갈래별 합」 검사도 깨진다.
   ⇒ 모자란 몫을 **`unknown`(예전 판 · 종류 모름)** 에 담는다. 0 으로 두거나 조용히 지우지 않는다.
   ★ 이 함수는 **차이만** 본다. 그래서 두 경우를 한 길로 다룬다:
       ① 옛 세이브(칸 자체가 없다)          → 전액이 `unknown` 으로 간다
       ② 어쩌다 갈래 합이 합계와 어긋난 판  → 그 차이만 `unknown` 으로 간다
     ⚠ 반대로 갈래 합이 **더 큰** 경우는 안 만진다 — 그건 누가 `earnedWon` 을 직접 깎았다는
       뜻이라 조용히 맞춰 주면 원인이 묻힌다. `saleLedgerOf().balanced` 가 거짓으로 남아 드러난다. */
function migrateEarnedBy(shop) {
  const by = shop.earnedBy || (shop.earnedBy = {});
  for (const k of SALE_KINDS) if (!Number.isFinite(by[k])) by[k] = 0;
  const sum = SALE_KINDS.reduce((n, k) => n + by[k], 0);
  const gap = Math.round(shop.earnedWon || 0) - sum;
  if (gap > 0) by.unknown += gap;
  return gap > 0 ? gap : 0;
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

/* ★ 판 가구 — uid 목록. **중복은 걷는다**(같은 것을 두 번 적을 일이 없다) */
function packSoldFurniture(list) {
  const out = [];
  for (const [i, uid] of needArr(list || [], 'home.furnitureSold').entries()) {
    const u = needStr(uid, `home.furnitureSold[${i}]`);
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

/* ★ 사서 놓은 가구 — `[{uid, preset, x, z, rot, y?}]`. rot 는 도(°)다(자리표와 같은 규약).
   ⚠ `preset` 을 반드시 적는다 — 이것이 없으면 다시 켤 때 **무슨 가구인지 모른다.**
     자리표(`home.furniture`)에는 프리셋이 안 실린다(원래 방 정의가 갖고 있었으므로). */
function packAddedFurniture(list) {
  return needArr(list || [], 'home.furnitureAdded').map((f, i) => {
    const path = `home.furnitureAdded[${i}]`;
    needObj(f, path);
    return {
      uid: needStr(f.uid, `${path}.uid`),
      preset: needStr(f.preset, `${path}.preset`),
      x: needNum(f.x, `${path}.x`), z: needNum(f.z, `${path}.z`),
      rot: f.rot == null ? 0 : needNum(f.rot, `${path}.rot`),
      ...(f.y == null ? {} : { y: needNum(f.y, `${path}.y`) })
    };
  });
}

/* ★★ 2026-08-30 — **가방에 든 가구** `[{uid, preset, y?}]` (원룸 이사 · state §carriedFurniture)
   ⚠ **안 실으면 새로고침에 짐이 사라진다.** 2026-08-30 에 `coachPending` 이 그랬다 —
     기다리던 쪽지가 화면 변수라 새로고침에 없어졌고, 아무도 몰랐다.
   ⚠ `preset` 을 반드시 적는다 — 없으면 다시 켤 때 **무슨 가구인지 모른다**(§packAddedFurniture 와 같은 까닭).
   ★ 자리(x·z·rot)는 **안 적는다** — 가방에 든 것은 자리가 없다. 놓을 때 생긴다. */
function packCarriedFurniture(list) {
  const out = [], seen = new Set();
  for (const [i, f] of needArr(list || [], 'home.furnitureBag').entries()) {
    const path = `home.furnitureBag[${i}]`;
    needObj(f, path);
    const uid = needStr(f.uid, `${path}.uid`);
    if (seen.has(uid)) continue;               // 두 번 담긴 것은 하나로(§carryFurniture 와 같은 규약)
    seen.add(uid);
    out.push({ uid, preset: needStr(f.preset, `${path}.preset`),
               ...(f.y == null ? {} : { y: needNum(f.y, `${path}.y`) }) });
  }
  return out;
}

/* 등 겨누기 표 — `{ 등 uid: {yaw, tilt} }`. 둘 다 도(°)다.
   ★ 겨눈 등만 담긴다. 빈 표 = 안 겨눔이고, 옛 세이브에는 이 칸 자체가 없어 빈 표가 된다
     (docs/growlight_aim.md §2 · state.lamps.aim 주석).
   ⚠ 여기서 범위(±180 · 0~75 …)를 검사하지 않는다 — 범위는 프리셋이 갖고 방마다 다른
     기구가 놓이므로, 세이브가 그 표를 복제하면 두 정본이 생긴다.
     실제 적용 시점에 light_adapter.setLampAims 가 검사하고 범위 밖이면 던진다. */
function packLampAims(tbl) {
  const out = {};
  for (const [uid, a] of Object.entries(tbl || {})) {
    const path = `lamps.aim['${uid}']`;
    needObj(a, path);
    out[uid] = { yaw: needNum(a.yaw ?? 0, `${path}.yaw`), tilt: needNum(a.tilt ?? 0, `${path}.tilt`) };
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
      home: { room: needStr(home.room, 'home.room'), furniture: packFurniture(home.furniture),
              /* ★★ 2026-08-17 — 가구를 사고 팔면서 생긴 두 칸(state.js §가구를 사고 판다).
                 ⚠ 안 적으면 **판 가구가 다시 켤 때 되살아나고** 사서 놓은 가구는 사라진다.
                   자리표(`furniture`)만으로는 「무엇이 방에 있나」를 못 적는다 — 그 표는
                   **옮긴 자리**일 뿐이다. */
              furnitureSold: packSoldFurniture(home.furnitureSold),
              furnitureAdded: packAddedFurniture(home.furnitureAdded),
              furnitureBag: packCarriedFurniture(home.furnitureBag) },
      lamps: {
        count: needInt(lamps.count ?? 0, 'lamps.count', { min: 0 }),
        litHours: needNum(lamps.litHours ?? 0, 'lamps.litHours', { min: 0 }),
        aim: packLampAims(lamps.aim)
      },
      pots: needArr(S.pots || [], 'pots').map(packPot),
      /* ★★ 2026-08-16 — **빈 화분**(놓았지만 아직 안 심은 것 · `state.js §emptyPots`).
         ⚠ 그루가 없으므로 `packPot` 을 안 쓴다 — 빛 이력도 생장 창도 없는 물건이다.
           네 칸뿐이고, 그 넷이 없으면 방에서 자리를 잃는다.
         ★ 세이브 계통이 **이 칸을 안 적으면 던지게** 돼 있어서 여기 붙였다
           (실측: `state.js 에 새 칸이 생겼습니다: emptyPots` 로 검사 셋이 빨개졌다).
           그 장치가 없었으면 **화분만 조용히 사라지는 세이브**가 됐다. */
      emptyPots: needArr(S.emptyPots || [], 'emptyPots').map((p, i) => {
        const path = `emptyPots[${i}]`;
        needObj(p, path);
        return {
          id: needStr(p.id, `${path}.id`),
          itemId: needStr(p.itemId, `${path}.itemId`),
          /* ★★ 2026-08-17 — **무슨 그릇인가**(검은 모종포트 · 유리 수경병). 박사님이
             「용도로 가르지 마라」 하셔서 빈 그릇이 한 목록으로 합쳐졌고, 그러면서
             갈래를 줄마다 들고 있어야 한다.
             ⚠ 옛 세이브에는 이 칸이 없다 — 그때는 `itemId` 로 읽는다
               (`propagation.containerKindOf`). 지어내는 값이 아니라 **되읽는 것**이다. */
          container: optStr(p.container, `${path}.container`),
          /* ★★ 한 번이라도 무언가 들어앉았나 — 걷을 때 재고로 돌아오나가 이 칸으로 갈린다.
             ⚠ 안 적으면 저장 한 번에 **쓴 포트가 새것이 된다**(「심고 빼고 걷고」가 공짜가 된다). */
          usedOnDay: p.usedOnDay == null ? null : needInt(p.usedOnDay, `${path}.usedOnDay`, { min: 0 }),
          slotId: optStr(p.slotId, `${path}.slotId`),
          at: packAt(p.at, `${path}.at`),
          placedOnDay: needInt(p.placedOnDay ?? 0, `${path}.placedOnDay`, { min: 0 })
        };
      }),
      cuttings: needArr(S.cuttings || [], 'cuttings').map(packCutting),
      firstPlay: packFirstPlay(S.firstPlay),
      story: packStory(S.story),
      tutorial: packTutorial(S.tutorial),
      shop: packShop(S.shop),
      /* ★ 보상으로 켜지는 편의 기능 (2026-08-04 · state.js §perks).
         지금은 `autoHarvest` 하나뿐이고 **늘 false** 다. 그래도 지금 싣는다 —
         나중에 켜질 때 세이브 규약을 같이 넓히는 것을 잊으면 "보상을 받았는데 껐다 켜면
         사라지는" 유형이 난다. 칸이 먼저 있어야 그 유형이 아예 안 생긴다.
         ⚠ 없는(옛) 세이브는 아래 복원에서 기본값(전부 꺼짐)으로 열린다. */
      perks: { autoHarvest: !!(S.perks || {}).autoHarvest },
      /* ★★ 체력 — 하루에 돌볼 수 있는 양 (2026-08-05 · docs/stamina.md).
         **`left` 만 싣는다.** `max` 는 규칙(stamina.STAMINA_MAX)이지 판의 상태가 아니다 —
         세이브에 넣으면 나중에 최대치를 바꿔도 옛 판만 옛 값으로 도는 유령이 생긴다.
         `spentToday` 도 안 싣는다. 표시용이고 날이 바뀌면 어차피 0 이다.
         ⚠ 옛 세이브에는 이 칸이 없다 — 그때는 **가득 찬 채로** 연다(아래 복원).
           0 으로 열면 "껐다 켰더니 오늘 아무것도 못 한다"가 된다. */
      /* ★★★ 2026-08-09 — **`max` 와 `xp` 를 같이 싣는다.**
         위 주석이 *"`max` 는 규칙이지 판의 상태가 아니다"* 라고 적어 둔 것은 그때 맞았다 —
         **누구나 10이었기 때문이다.** 이제 최대체력이 오른다(stamina.js §경험치).
         그러므로 `max` 는 규칙이 아니라 **그 판이 쌓은 것**이다. 안 실으면 불러올 때마다
         시작값으로 되돌아간다 — 레벨은 안 내려간다(박사님 확정).
         ⚠ `spentToday`·`levelUps` 는 여전히 안 싣는다. 앞은 날이 바뀌면 0 이고,
           뒤는 「아직 안 보여 준 것」이라 판의 사실이 아니라 화면의 사정이다. */
      stamina: {
        left: needInt(((S.stamina || {}).left ?? STAMINA_MAX), 'stamina.left', { min: 0 }),
        max: needInt(((S.stamina || {}).max ?? STAMINA_MAX), 'stamina.max', { min: 1 }),
        xp: needInt(((S.stamina || {}).xp ?? 0), 'stamina.xp', { min: 0 }),
        totalSpent: needInt(((S.stamina || {}).totalSpent ?? 0), 'stamina.totalSpent', { min: 0 }),
        questsTaken: needArr(((S.stamina || {}).questsTaken || []), 'stamina.questsTaken')
          .map((q, i) => needStr(q, `stamina.questsTaken[${i}]`))
      },
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
    /* ★ 등 겨누기도 같은 규약으로 얹는다 (2026-08-06).
       가구와 똑같이 **비어 있어도 반드시 부른다** — 안 부르면 직전 게임에서 겨눈 각도가
       남아 "새 세이브를 불렀는데 등이 딴 데를 본다"가 된다.
       ⚠ 방을 조립한 **뒤**에 얹는다. 겨눌 수 있는지는 지금 방에 놓인 기구가 아는 것이라
         조립 전에는 uid 를 검증할 수 없다. */
    if (typeof light.setLampAims === 'function') {
      const aims = S.lamps && S.lamps.aim ? S.lamps.aim : {};
      const here = new Set((typeof light.lampList === 'function' ? light.lampList() : []).map(l => l.uid));
      /* 지금 방에 없는 등의 각도는 남겨 두되 안 얹는다 — 방을 옮겨 다니면 정상이고,
         돌아오면 그 각도를 다시 쓴다(가구 자리표와 같은 판단). */
      const mine = {}; for (const [uid, a] of Object.entries(aims)) if (here.has(uid)) mine[uid] = a;
      light.setLampAims(mine);
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
  /* ★★ 2026-08-17 — **자리가 움직인 판**(state §migratePots resnap). 조용히 넘기지 않는다 —
     그 화분의 밝기가 조금 달라질 수 있고, 말 없이 바뀌면 다음 사람이 코드에서 까닭을 찾는다. */
  if (mig.resnapped && mig.resnapped.length)
    pushLog(S, `🔧 복원 — 자리가 움직여 ${mig.resnapped.length}개를 그 자리로 다시 앉혔습니다`);

  /* 화분 — 없어진 슬롯·사라진 가구·방 밖 좌표는 state.rehomePot 규칙으로 회수한다.
     v0 는 한 그루라 rehomePot 이 pot0 만 본다(코어 규약). */
  if (pot0(S)) rehomePot(S, room.slots, log, { size: room.size, surfaces: room.surfaces });

  /* ★ 삽수 — 화분·시루와 **같은 검사**를 받는다 (2026-08-03).
     안 하면 방을 옮긴 세이브에서 삽수가 방 밖 좌표로 남아 매일 계약이 던지거나,
     화면에 안 보이는데 상태에는 살아 있는 **유령**이 된다.
     ⚠ 자리를 잃었다고 죽이지 않는다 — 죽음의 사유는 기한 하나뿐이다(propagation.js). */
  const cut = rehomeCuttings(S, room, log);
  report.cuttingsRehomed = cut;

  /* 작물 자리 — 화분과 같은 검사를 받는다. 안 하면 방 밖 좌표가 남아
     매일 `light_adapter.slotsFor` 가 던진다(게임이 통째로 멈춘다).
     ★ 2026-08-05 — **자리마다** 돈다. 콩나물 하나만 검사하면 무순 판이 방 밖 좌표로 남아
       같은 고장이 그대로 난다(자리가 종류마다 따로다 — first_play §작물 자리). */
  /* ★★ 2026-08-09 — **시루 하나하나가 검사를 받는다**(first_play §자리는 시루마다 따로다).
     자리 사본(site) 하나만 보면 대표 시루만 회수되고 나머지는 방 밖 좌표로 남아
     `light_adapter.slotsFor` 가 매일 던진다 — 게임이 통째로 멈추는 그 고장이다. */
  const fp = S.firstPlay;
  if (fp && fp.enabled) for (const site of cropSites(fp)) {
    if (!site) continue;
    ensureCropPots(site);
    const kindId = site.kind || 'beansprout';
    const boxKo = cropKindOf(kindId).containerKo;
    for (const p of (site.pots || [])) {
      if (!p || !(p.slotId || p.at)) continue;
      let why = null;
      if (p.at) {
        if (room.size && !inRoom(p.at, room.size)) why = '자리가 방 밖입니다';
        else if (p.at.onUid && room.surfaces && !room.surfaces.has(p.at.onUid))
          why = `받치던 ${p.at.onUid} 이(가) 사라졌습니다`;
      } else if (p.slotId && !isFreeSlotId(p.slotId) &&
                 !(room.slots || []).some(s => s && s.slotId === p.slotId)) {
        why = `슬롯 ${p.slotId} 이(가) 이 방에 없습니다`;
      }
      if (!why) continue;
      const dest = (room.slots || [])[0] || null;
      if (!p.harvested && dest) {
        placeCrop(fp, kindId, dest.slotId, { slots: room.slots, potId: p.id });
        log(`${boxKo} 회수 — ${why} · ${dest.slotId} 로 옮겼습니다`);
      } else {
        /* 이미 수확했거나 갈 자리가 없으면 자리만 비운다 — 수확 결과는 이미 확정이라
           옮길 이유가 없고, 그대로 두면 계약이 방 밖 좌표를 실어 매일 던진다. */
        p.at = null;
        if (why.startsWith('슬롯')) p.slotId = null;
        log(`${boxKo} 자리 해제 — ${why}`);
      }
    }
    syncCropLead(site);
  }
}

/* ★ growth 되세우기 — 이력 재생. 자세한 근거는 파일 맨 위 §growth.
     growth  growth_adapter(브라우저) 또는 같은 계약의 스텁(sim.nullGrowth)
   반환 { needed, method, jumpTo, replayedDays, calendarDay, growthDays, blocked, warnings } */
export function restoreGrowth(S, growth, opt = {}) {
  const pots = (S && S.pots) || [];
  const warnings = [];
  if (!pots.length) return { needed: false, method: null, jumpTo: null, replayedDays: 0,
                             calendarDay: null, growthDays: null, blocked: null,
                             plants: [], warnings };

  for (const n of ['setGrowth', 'setDailyLight', 'advanceTo'])
    if (typeof growth?.[n] !== 'function')
      throw fail('needs_growth', `생장 창에 ${n} 이(가) 없습니다 — 형태를 되세울 수 없습니다`);
  /* 임계값 정본이 안 실린 채로 재생하면 **모든 날이 정지**로 지나가 씨앗이 남는다.
     growth_adapter.assertContract 가 그걸 본다 — 있으면 먼저 묻는다. */
  if (typeof growth.assertContract === 'function') growth.assertContract();

  /* ★★ 여러 그루 (2026-08-15) — 화분마다 **제 이력을 제 그루에** 다시 건다.
     ⚠ 그루를 못 고르는 생장 창에 화분 둘을 물리면 **던진다.** 조용히 한 그루에 겹쳐 걸면
       마지막 화분의 형태만 남고 나머지는 그 형태를 자기 것이라 믿는다. */
  const canMulti = typeof growth.multi === 'function' && growth.multi();
  if (pots.length > 1 && !canMulti)
    throw fail('needs_growth',
      `화분이 ${pots.length}개인 세이브인데 생장 창이 그루를 하나만 굴립니다 — ` +
      `plant_grow 에 selectPlant/addPlant 가 있는지 확인해 주세요`);

  const per = pots.map((p, i) => restoreOnePlant(S, growth, p, i, pots.length, canMulti));
  for (const r of per) warnings.push(...r.warnings);
  if (S.desync)
    warnings.push(`어긋난 상태에서 저장된 세이브입니다(${S.desync.reason || '사유 미상'}) — ` +
                  `형태가 하루 어긋날 수 있습니다`);

  /* ★ 옛 칸은 **첫 화분의 것**이다 — 화면·검사가 그 이름을 읽고 있고, 한 그루짜리 판에서는
     그것이 곧 그 판의 전부다. 그루마다의 값은 `plants` 에 있다. */
  const lead = per[0];
  const out = { needed: true, method: 'replay',
                jumpTo: lead.jumpTo, replayedDays: lead.replayedDays,
                calendarDay: lead.calendarDay, growthDays: lead.growthDays,
                blocked: lead.blocked, plants: per, warnings };
  for (const r of per)
    pushLog(S, `🌿 복원 — ${pots.length > 1 ? `[${r.potId}] ` : ''}` +
               `도착 ${r.jumpTo}일로 점프한 뒤 빛 이력 ${r.replayedDays}일을 다시 걸었습니다` +
               (r.growthDays == null ? '' : ` (유효 ${r.growthDays}일)`));
  for (const w of warnings) pushLog(S, '⚠ 복원 — ' + w);
  return out;
}

/* 화분 하나를 되세운다. 규칙은 예전과 한 줄도 안 다르다 — **무엇에 대고 하느냐**만 달라졌다.
   반환 { potId, growthId, jumpTo, replayedDays, calendarDay, growthDays, blocked, warnings } */
function restoreOnePlant(S, growth, p, i, total, canMulti) {
  const warnings = [];
  const growthId = growthIdOf(p);
  /* ★ 첫 그루(`__main__`)는 생장 창이 부팅 때부터 갖고 있다 — 만들지 않는다.
     ★ 화분이 하나뿐이고 그것이 기본 그루면 `select` 조차 안 부른다(옛 길 그대로). */
  if (growthId !== MAIN_GROWTH_ID) {
    /* 씨앗을 같이 넘긴다 — 안 넘기면 열 때마다 **다른 모양의 그루**가 선다.
       `growthSeed` 가 없는 화분은 생장 창이 알아서 고른다(그 판에서만 흔들린다). */
    growth.addPlant({ id: growthId, day: 0,
                      ...(Number.isInteger(p.growthSeed) ? { seed: p.growthSeed } : {}) });
  }
  if (total > 1 || growthId !== MAIN_GROWTH_ID) growth.select(growthId);

  let jumpTo = p.arrivalGrowthDays;
  if (!Number.isInteger(jumpTo) || jumpTo < 0) {
    jumpTo = ARRIVAL.growthDays;
    warnings.push(`화분에 도착 진행도가 없어 코어 기본값(${jumpTo}일)으로 세웠습니다`);
  }
  if (!Number.isInteger(jumpTo) || jumpTo < 0) {
    jumpTo = ARRIVAL.growthDays;
    warnings.push(`화분에 도착 진행도가 없어 코어 기본값(${jumpTo}일)으로 세웠습니다`);
  }

  /* ★ 이력의 정본은 **화분마다**다(state §syncPotLead). 첫 화분의 것이 곧 `S.dliHist` 다. */
  const hist = (Array.isArray(p.dliHist) ? p.dliHist : (i === 0 ? S.dliHist : null)) || [];
  /* 교차검증 — 이 둘은 loop.js 에서 같은 자리에서 늘어난다. 다르면 중간에 턴이 깨진 것이라
     재생 길이가 실제와 다를 수 있다. 조용히 넘기지 않는다.
     ★★ 재는 대상은 `daysPlanted`(돌본 날)가 아니라 **`fedDays`(먹인 날)**다 (2026-08-05).
       밝은 날은 하루에 두 걸음을 걸어 `dliHist` 에 두 칸이 쌓인다 — 그때 `daysPlanted` 로
       재면 멀쩡한 세이브가 「깨진 턴」으로 잡힌다. 위 §fedDays 참고.
     ⚠ 옛 세이브는 `fedDays` 가 없어 `daysPlanted` 로 떨어진다(그 시절엔 둘이 같았다). */
  const fed = Number.isInteger(p.fedDays) ? p.fedDays : p.daysPlanted;
  if (hist.length !== fed)
    warnings.push(`${total > 1 ? `[${p.id}] ` : ''}빛 이력 ${hist.length}일 ≠ growth 에 먹인 날 ${fed}일 — ` +
                  `중간에 깨진 턴이 있어 형태가 그만큼 어긋날 수 있습니다`);

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
  if (drawFails) warnings.push(`${total > 1 ? `[${p.id}] ` : ''}재생 중 그리기 실패 ${drawFails}일 ` +
                               `(마지막 사유: ${lastDrawError})`);

  const growthDays = typeof growth.growthDays === 'function' ? growth.growthDays() : null;
  const blocked = typeof growth.growthBlocked === 'function' ? growth.growthBlocked() : null;

  return { potId: p.id, growthId, jumpTo, replayedDays: hist.length,
           calendarDay: cal, growthDays, blocked, warnings };
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
  /* ★ 옛 세이브에는 이 두 칸이 없다 → 빈 목록으로 열린다 = 「아무것도 안 팔았고 안 놓았다」.
     그 판의 방은 `house_rooms.json` 그대로이므로 **옛 판이 저장될 때와 똑같이 열린다.** */
  S.home.furnitureSold = packSoldFurniture(home.furnitureSold);
  S.home.furnitureAdded = packAddedFurniture(home.furnitureAdded);
  S.home.furnitureBag = packCarriedFurniture(home.furnitureBag);
  /* ★ aim 이 없는 옛 세이브는 빈 표 = 「안 겨눔」으로 열린다 (2026-08-06).
     조용히 메꾸는 게 아니라 **없음이 곧 뜻을 갖는** 경우다 — 안 겨눈 등의 물리는
     옛 식과 비트 단위로 같으므로, 옛 세이브는 저장될 때와 똑같은 빛을 다시 본다. */
  S.lamps = {
    count: needInt((st.lamps || {}).count ?? 0, 'state.lamps.count', { min: 0 }),
    litHours: needNum((st.lamps || {}).litHours ?? 12, 'state.lamps.litHours', { min: 0 }),
    aim: packLampAims((st.lamps || {}).aim)
  };
  /* ★ 빈 화분을 되세운다. **옛 세이브에는 이 칸이 없다** — 그때는 빈 배열이 맞다
     (그 판에는 빈 화분이라는 것 자체가 없었다). 조용히 0 으로 메꾸는 것이 아니라
     **없던 것이 없는 것**이다. */
  S.emptyPots = needArr(st.emptyPots || [], 'state.emptyPots').map((p, i) => ({
    id: needStr(p.id, `state.emptyPots[${i}].id`),
    itemId: needStr(p.itemId, `state.emptyPots[${i}].itemId`),
    /* ★ 옛 줄에는 `container` 가 없다 — **0 으로 메꾸듯 'soil' 을 박지 않는다.**
       `null` 로 두면 `propagation.containerKindOf` 가 `itemId` 로 읽어 준다(되읽기지 지어내기가 아니다). */
    container: p.container == null ? null : String(p.container),
    usedOnDay: Number.isFinite(p.usedOnDay) ? p.usedOnDay : null,
    slotId: p.slotId == null ? null : String(p.slotId),
    at: p.at ? { x: +p.at.x, y: +p.at.y, z: +p.at.z } : null,
    placedOnDay: Number.isFinite(p.placedOnDay) ? p.placedOnDay : 0
  }));
  /* ══ ⚠ 2026-08-17 — **하루 살았던 `cutContainers` 를 되받는다** ═══════════════════
     그날 아침에 「삽수용 그릇」을 따로 낸 판이 있었고, 저녁에 박사님이 그 구분을 물리셨다.
     그 사이에 저장한 판이 있으면 **방에 놓은 병이 통째로 사라진다.** 그래서 읽어서
     `emptyPots` 로 옮긴다 — 지어내는 값이 하나도 없다(칸 이름이 그대로 겹친다).
     ★ 그때 「삽수가 들어 있던」 줄(`cuttingId` 가 적힌 것)은 **안 옮긴다.** 지금 규약에서는
       든 그릇을 삽수가 지고 있으므로(`c.container`) 옮기면 그릇이 둘이 된다. */
  for (const t of (Array.isArray(st.cutContainers) ? st.cutContainers : [])) {
    if (!t || t.cuttingId) continue;
    if (S.emptyPots.some(p => p.id === t.id)) continue;
    S.emptyPots.push({
      id: needStr(t.id, 'state.cutContainers[].id'),
      itemId: t.itemId == null ? 'pot' : String(t.itemId),
      container: t.container == null ? null : String(t.container),
      usedOnDay: Number.isFinite(t.usedOnDay) ? t.usedOnDay : null,
      slotId: t.slotId == null ? null : String(t.slotId),
      at: t.at ? { x: +t.at.x, y: +t.at.y, z: +t.at.z } : null,
      placedOnDay: Number.isFinite(t.placedOnDay) ? t.placedOnDay : 0
    });
  }
  S.pots = needArr(st.pots || [], 'state.pots').map((p, i) => {
    const q = packPot(p, i);
    /* 좌표는 place.makeAt 를 통과시켜 정본 모양으로 세운다(방 경계는 아래 회수 단계에서 본다) */
    /* ★ 물 준 날이 없는 옛 세이브는 **그 판의 오늘**로 채운다(위 §wateredOnDay).
       지어낼 값이 없으면 잃는 쪽이 아니라 **안전한 쪽**으로 채운다 —
       ensureCropPots 가 옛 시루를 옮길 때 쓴 사상과 같다. */
    return { ...q, at: q.at ? makeAt(q.at) : null,
             wateredOnDay: q.wateredOnDay ?? S.day };
  });
  /* 삽수 — 쓸 때와 **같은 검증**을 읽을 때도 태운다(화분과 같은 규칙) */
  S.cuttings = needArr(st.cuttings || [], 'state.cuttings').map((c, i) => {
    const q = packCutting(c, i);
    /* ★ `leaves`·`variegatedLeaves` 는 `leafVarie` 에서 나온 값이라 **저장하지 않고 다시 센다.**
       두 벌로 저장하면 언젠가 어긋나고, 어긋난 쪽이 값(shop.sellCutting)으로 새어 나간다. */
    return syncCuttingLeaves({ ...q, at: q.at ? makeAt(q.at) : null });
  });
  /* ══ ⚠⚠ 이관 알림은 **여기서 못 적는다** — 아래 `S.log = …` 가 통째로 덮어쓴다 ══════
     ★★ 2026-08-17 재서 잡았다. `migrateCuttingRules` 는 2026-08-17 에 붙으면서
       `pushLog(S, '✂ ' + m)` 을 **바로 여기서** 불렀는데, 그 아래 `S.log = needArr(st.log …)`
       가 로그 배열을 **세이브에서 온 것으로 갈아 끼운다.** 그래서 그 알림은 **한 번도 화면에
       뜬 적이 없다.** 「말한다」고 적혀 있는 줄이 실제로는 말하지 않고 있었다.
       (START-HERE §2 — 「고쳤다」를 화면 확인 없이 쓰지 않는다. 그 반대쪽 사고다.)
     ⇒ 이관은 **여기서 돌리고**(상태를 실제로 고쳐야 하니까) **알림만 모아 두었다가**
       `S.log` 가 선 뒤에 적는다. 아래 §이관 알림. */
  const migrateNotes = [
    ...migrateCuttingRules(S).map(m => '✂ ' + m),
    /* ★★★ 옛 판의 무늬 잎을 **산반으로 읽는다** — 확정문 §5 가 「기록에 남기라」고 했다.
       ⚠ `st`(날것)를 같이 넘긴다 — 「칸이 없다」와 「비어 있다」를 가르려면 정리 전 값이 필요하다 */
    ...migrateVarieGrades(S, st).map(m => '🎨 ' + m)
  ];
  S.dliHist = needArr(st.dliHist || [], 'state.dliHist')
    .map((v, i) => (v == null ? null : needNum(v, `state.dliHist[${i}]`)));
  /* ★★ 빛 이력을 화분에 되돌린다 (2026-08-15 다개체 · state §syncPotLead).
     첫 화분의 이력은 맨 위 `dliHist`(대표 칸)에 있고, 둘째부터는 제 칸에 있다.
     ⚠ **사본을 만들지 않는다** — 첫 화분은 `S.dliHist` 와 같은 배열을 가리켜야 한다.
       사본이면 하루가 갈 때마다 둘이 갈리고, 저장할 때 어느 쪽을 적었는지에 따라
       복원한 형태가 조용히 달라진다. */
  S.pots.forEach((q, i) => {
    if (i === 0) { q.dliHist = S.dliHist; return; }
    if (!Array.isArray(q.dliHist)) q.dliHist = [];
  });
  syncPotLead(S);
  const led = needObj(st.ledger || {}, 'state.ledger');
  S.ledger = {
    today: { in: needNum((led.today || {}).in ?? 0, 'state.ledger.today.in'),
             out: needNum((led.today || {}).out ?? 0, 'state.ledger.today.out') },
    total: needNum(led.total ?? 0, 'state.ledger.total'),
    electricityWon: needNum(led.electricityWon ?? 0, 'state.ledger.electricityWon')
  };
  S.log = needArr(st.log || [], 'state.log')
    .map((e, i) => ({ day: needInt(e.day ?? 0, `state.log[${i}].day`, { min: 0 }), msg: String(e.msg ?? '') }));
  /* ★ §이관 알림 — 로그가 선 **뒤에** 적는다. 위 §이관 알림의 ⚠⚠ 를 읽어라.
     ⚠ 이 자리를 위로 되돌리면 알림이 다시 조용히 사라진다. */
  for (const m of migrateNotes) pushLog(S, m);
  if (st.desync) S.desync = { ...st.desync };

  /* 첫 플레이 — 규칙은 **지금 정본**에서 오고, 진행 상태만 세이브에서 온다 */
  if (fpSaved) {
    const saved = packFirstPlay(fpSaved);                 // 쓸 때와 **같은 검증**을 읽을 때도 태운다
    const fp = createFirstPlayState({ enabled: fpEnabled, rules: opt.firstPlayRules });
    fp.phase = saved.phase;
    fp.completed = saved.completed;
    Object.assign(fp.beansprout, saved.beansprout,
                  { at: saved.beansprout.at ? makeAt(saved.beansprout.at) : null });
    /* ★ 대표 칸(ageDays·harvested…)은 **pots 에서 다시 세운다** — 세이브에 두 정본이 있으면
       하나가 조용히 낡는다. pots 가 정본이므로 그쪽으로 맞춘다. */
    restoreCropPotAts(fp.beansprout);
    ensureCropPots(fp.beansprout);
    syncCropLead(fp.beansprout);
    /* ★★ 2종째부터의 자리 (2026-08-05). **새 상태가 만든 자리에 덮어쓴다** —
       세이브에 없는 종류(나중에 3종이 생기면 옛 세이브가 그 경우다)는 빈 자리로 남는다.
       ⚠ 세이브에만 있고 지금 빌드가 모르는 종류는 **버린다.** 지어내면 CROP_KINDS 에 없는
         종류의 값을 셈해야 하는데 그 값이 없다(cropKindOf 가 던진다). */
    for (const s of (saved.crops || [])) {
      const site = (fp.crops || []).find(x => x.kind === s.kind);
      if (!site) continue;
      Object.assign(site, s, { at: s.at ? makeAt(s.at) : null });
      restoreCropPotAts(site);
      syncCropLead(site);
    }
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
    ts.varieGrant = { ...ts.varieGrant, ...t.varieGrant };
    ts.varieSale = { ...ts.varieSale, ...t.varieSale };
    /* ★ 2026-08-24 — 무늬 잎 이력(§varieLeaf). 없으면 처음 상태 그대로(ever:false)다.
       ⚠ 따로 이관하지 않는다 — 옛 세이브에서 「낸 적」을 되짚을 근거가 없다.
         대신 `canMoveOut` 이 「판 적」을 `||` 로 같이 보므로 **이미 판 사람은 안 갇힌다.** */
    ts.varieLeaf = { ...ts.varieLeaf, ...t.varieLeaf };
    ts.crop = { ...ts.crop, ...t.crop };
    ts.movedOut = t.movedOut; ts.bankrupt = t.bankrupt;
    /* ★★ 옛 세이브에는 `varieSale` 칸이 **아예 없다** — 위 §무늬 삽수 판매 이관.
       ⚠ 「없다」와 「0건이다」는 다른 말이다. 그래서 `t.varieSale`(없으면 0으로 채워진다)이
         아니라 **날 세이브에 그 칸이 있었는지**를 본다. 뭉개면 실제로 0건인 판까지
         매번 다시 이관돼 「판 적 없는데 열린」 방이 된다. */
    if (st.tutorial.varieSale == null) migrateVarieSale(S, ts);
    S.tutorial = ts;
  }

  /* 스토리 ③④ — 없는(옛) 세이브면 **처음 상태**로 연다.
     ★ 그래도 단계는 안 틀린다: 옛 세이브에 `tutorial.movedOut = true` 가 있으면
       `oneroom.stageOf` 가 그것만 보고 ③ 원룸이라고 답한다(단계를 저장 안 하는 이유가 이것이다). */
  S.story = st.story ? { ...createStoryState(), ...packStory(st.story) } : createStoryState();

  /* 상점 — 쓸 때와 **같은 검증**을 읽을 때도 태운다. 없는(옛) 세이브면 빈 상점으로 연다. */
  S.shop = st.shop ? { ...createShopState(), ...packShop(st.shop) } : createShopState();
  /* ★★ 갈래별 판 돈 — 옛 판은 이 칸이 없어 합이 모자란다. 그 몫을 「예전 판 · 종류 모름」에
     담는다(위 §판 돈 갈래 이관). 조용히 지우면 번 돈이 사라진 것처럼 보인다. */
  {
    const moved = migrateEarnedBy(S.shop);
    if (moved > 0)
      pushLog(S, `📒 예전 판이라 판 돈의 종류를 모릅니다 — ${moved.toLocaleString()}원을 ` +
                 `「종류 모름」으로 옮겼습니다`);
  }
  /* ★ 중고 거래 게시글과 물건을 맞춘다(위 §게시글 ↔ 물건 맞추기).
     ⚠ **화분·삽수가 다 선 뒤에** 불러야 한다 — 여기가 그 자리다(S.pots·S.cuttings 는 위에서 섰다).
     옛 판에서는 아무 일도 안 한다(둘 다 비어 있다). 무슨 일이 일어났으면 **말한다.** */
  {
    const m = reconcileMarket(S);
    if (m.dropped > 0)
      pushLog(S, `📭 팔 물건이 없어진 중고 게시글 ${m.dropped}건을 내렸습니다`);
    if (m.untagged > 0)
      pushLog(S, `🔧 올라간 적 없는 표시 ${m.untagged}개를 지웠습니다`);
  }

  /* 보상 — 없는(옛) 세이브면 전부 꺼진 채로 연다. 지어내지 않는다(state.js §perks). */
  if (st.perks) S.perks.autoHarvest = !!st.perks.autoHarvest;

  /* 체력 — 없는(옛) 세이브면 **가득 찬 채로** 연다(위 §stamina).
     `max` 는 규칙에서 새로 오므로 최대치를 바꾸면 옛 판도 그 값으로 돈다.
     ⚠ 저장된 `left` 가 지금 최대치보다 크면 잘라 낸다 — 최대치를 낮춘 뒤 열면 그럴 수 있다. */
  /* ★★ 2026-08-09 — `max`·`xp` 를 세이브에서 되찾는다. 안 되찾으면 키운 레벨이 불러올
     때마다 사라진다 — 레벨은 안 내려간다(stamina.js §경험치).
     ⚠ 칸이 아예 없는 옛 세이브는 **시작값으로 가득 찬 채** 열린다. 던지지 않는다. */
  S.stamina = createStaminaState(opt.staminaRules || undefined);
  if (st.stamina) {
    if (Number.isInteger(st.stamina.max) && st.stamina.max > 0) S.stamina.max = st.stamina.max;
    if (Number.isInteger(st.stamina.xp) && st.stamina.xp >= 0) S.stamina.xp = st.stamina.xp;
    if (Number.isInteger(st.stamina.totalSpent) && st.stamina.totalSpent >= 0)
      S.stamina.totalSpent = st.stamina.totalSpent;
    if (Array.isArray(st.stamina.questsTaken))
      S.stamina.questsTaken = st.stamina.questsTaken.filter(q => typeof q === 'string');
    S.stamina.left = Number.isInteger(st.stamina.left)
      ? Math.max(0, Math.min(S.stamina.max, st.stamina.left))
      : S.stamina.max;
  }

  /* ── 무결성 ──────────────────────────────────────────────── */
  const report = {
    saveSchema: env.saveSchema, savedAt: env.savedAt ?? null,
    room: S.home.room, day: S.day,
    appliedFurniture: false, furnitureNotInRoom: [],
    migrated: { filled: [], skipped: [] }, rehomed: [], cuttingsRehomed: [], growth: null,
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
