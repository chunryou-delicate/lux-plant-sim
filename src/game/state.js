/* ============================================================
   game/state.js — 게임 상태 S (core 소유)
   ------------------------------------------------------------
   여기 있는 건 '루프가 세는 것'뿐이다.
     · 며칠 지났나 · 어느 방 · 어느 슬롯 · 등 몇 개 · 어떤 모드
   여기 없는 것(다른 창 소유이므로 절대 복제하지 않는다):
     · 생장 나이·잎 수         → growth (ageOf·growthDays). 코어는 읽기만 한다
     · DLI·밴드·전기요금       → house (계약 객체 daily_light/1)
     · 임계값·계수·확률        → data/balance/*.json (plan)

   ★ 고사·수확·경제가 없다. 자리도 만들지 않는다.
     활력(vigor)은 표시 취소·구현 보류다(2026-08-02) — 자리를 만들면 판정이 코어로 샌다.
============================================================ */

export const SCHEMA = 'game_state/1';

/* ★ 시뮬 모드 — 판정 단위가 모드마다 다르다.
     real   날씨·계절을 굴린다. 판정 단위 = 계절별 7일 이동평균.
            peak·연평균은 판정에 쓰지 않는다(data/balance/weather.json 규약).
     novice 날씨·계절 계수를 1.0으로 고정한다. 맑음·여름에 못박히므로
            peak가 곧 실제값이 되고, peak 금지 규약이 적용되지 않는다.
   ⚠ v0는 real 로만 검증한다. novice 는 '자리'다 — 값(중간 난이도 계수 등)은 plan 미정. */
export const SIM_MODES = {
  real:   { ko: '실전 (날씨·계절 굴림)', rollWeather: true,  rollSeason: true,  weather: null,    season: null },
  novice: { ko: '초보 (계수 1.0 고정)',  rollWeather: false, rollSeason: false, weather: 'clear', season: 'summer' }
};

export function newState(opt = {}) {
  return {
    schema: SCHEMA,
    day: 0,

    /* 시간 3모드가 이 숫자 하나로 갈린다 — 하드코딩 금지(plan-to-core §미해결). v0 미사용. */
    timeScale: { minutesPerGameDay: 30 },

    /* 모드. seasonK/weatherK 는 '중간 난이도'가 생길 때 쓸 자리다(null = 모드 기본). */
    sim: { mode: opt.mode || 'real', seed: 0, weatherK: null, seasonK: null },

    home: { room: opt.room || 'banjiha' },

    /* 식물등 — 방에 이미 놓인 grow 기구를 앞에서부터 n개 켠다.
       개수·PPFD·와트를 코어가 지어내지 않는다(house의 lightRigs + lighting_presets). */
    lamps: { count: 0, litHours: 12 },

    /* ★ 화분 — **비어 있게 시작한다** (2026-08-02).
       몬스테라는 플레이어가 143일 키운 게 아니라 **이미 자란 개체가 도착**하는 것이다.
       앱을 열었다고 Day 0부터 식물이 있으면 안 된다 — 도착 이벤트(Day 4 선물, 이번 범위 밖)나
       테스트 초기화 경계(givePlant)가 만들 때 생긴다. v0는 1개 (growth가 한 그루 전용). */
    pots: [],

    /* 코어가 따로 쌓는 DLI 이력. 용도는 두 가지뿐:
         ① growth의 dli7()과 대조(어긋나면 배선이 틀린 것)
         ② 30일 검수 리포트의 '문턱 넘는 주 비율'
       ★ 판정에는 쓰지 않는다. 고사·활력은 취소·보류다(2026-08-02). */
    dliHist: [],

    /* 경제는 3단계다. 표시만 하고 차감하지 않는다. */
    ledger: { today: { in: 0, out: 0 }, total: 0, electricityWon: 0 },

    log: []
  };
}

export function pot0(S) { return S.pots[0] || null; }
export function hasPlant(S) { return S.pots.length > 0; }

/* ★ 도착 진행도 — growth 확정값 (2026-08-02 · growth STATUS "첫 플레이 초기 유효 진행도 = 143일").
   143일 상태 = 비갈라짐 중간잎 2장·새순 없음. 적정광 3턴 뒤 146에서 말린 새순이 나온다.
   ⚠ 이 숫자는 growth 소유다. 코어는 도착 시 한 번 넘기기만 한다. */
export const ARRIVAL = {
  plantId: 'monstera_deliciosa',
  growthDays: 143,
  potAsset: 'monstera/pot.glb'      // 회전 무관 지름 0.202 ≤ 창턱 0.21 (core-to-house ④)
};

/* ★ 개체 생성 = **도착**. 여기서만 setGrowth 를 쓴다(점프 1회).
   그 뒤 일일 진행은 전부 advanceTo 다 — 이 경계를 흐리면 저광 정지가 무시된다.

   pot.daysPlanted 는 **플레이어가 돌본 날**이라 0부터 센다.
   growth 안의 달력·유효 진행도는 143에서 시작한다. 둘은 다른 축이다. */
/* ★ 원자적이다 (2026-08-02) — 형태를 못 세우면 개체도 안 생긴다.
   순서가 중요하다: **setGrowth 가 성공한 뒤에만** 화분·로그를 남긴다.
   반대로 하면 "화분은 있는데 형태는 0일(=씨앗)"인 개체가 조용히 남는다.
   던지면 S 는 손대기 전 상태 그대로다 — 부분 성공이 없다. */
export function givePlant(S, io, opt = {}) {
  if (S.pots.length) return pot0(S);                     // 이미 있으면 다시 만들지 않는다

  const g = io && io.growth;
  const growthDays = opt.growthDays ?? ARRIVAL.growthDays;
  if (!g || typeof g.setGrowth !== 'function')
    throw new Error('[도착] 생장 창이 준비되지 않았습니다 — setGrowth 를 부를 수 없어 개체를 만들지 않습니다');
  if (typeof g.has === 'function' && !g.has('setGrowth'))
    throw new Error('[도착] plant_grow 에 setGrowth 가 없습니다 — 개체를 만들지 않습니다');

  /* ① 형태부터 세운다. 여기서 던지면 아래로 내려가지 않는다(화분·로그 0) */
  g.setGrowth(growthDays);

  /* ② 성공했으니 개체를 남긴다 */
  const pot = {
    id: opt.id || 'pot_01',
    slotId: opt.slotId || null,
    plantId: opt.plantId || ARRIVAL.plantId,
    potAsset: ARRIVAL.potAsset,
    variegated: false,
    daysPlanted: 0,                                      // 플레이어가 돌본 날
    arrivedOnDay: S.day,
    arrivalGrowthDays: growthDays
  };
  S.pots.push(pot);
  pushLog(S, `🪴 몬스테라가 도착했습니다 — 이미 ${growthDays}일 자란 개체입니다`);
  return pot;
}

export function modeOf(S) { return SIM_MODES[S.sim.mode] || SIM_MODES.real; }

/* 슬롯이 사라졌을 때(가구 삭제·방 전환) 화분을 어디로 보낼지 — 코어가 정한다(house-to-core §slotId).
   v0 규칙: 가장 밝은 자리로 자동 회수하고 로그를 남긴다. 조용히 옮기지 않는다. */
export function rehomePot(S, slots, log) {
  const p = pot0(S);
  if (p.slotId && slots.some(s => s.slotId === p.slotId)) return p.slotId;
  const dest = slots[0] ? slots[0].slotId : null;
  if (log) log(p.slotId
    ? `화분 회수 — 슬롯 ${p.slotId} 이(가) 사라져 ${dest} 로 옮겼습니다`
    : `화분 배치 — ${dest}`);
  p.slotId = dest;
  return dest;
}

export function pushLog(S, msg) {
  S.log.push({ day: S.day, msg });
  if (S.log.length > 200) S.log.shift();
  return msg;
}
