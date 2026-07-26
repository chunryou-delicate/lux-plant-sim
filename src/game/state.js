/* ============================================================
   game/state.js — 게임 상태 S (core 소유)
   ------------------------------------------------------------
   여기 있는 건 '루프가 세는 것'뿐이다.
     · 며칠 지났나 · 어느 방 · 어느 슬롯 · 등 몇 개 · 어떤 모드
   여기 없는 것(다른 창 소유이므로 절대 복제하지 않는다):
     · 생장 나이·잎 수·vigor  → growth (ageOf/vigor). 코어는 읽기만 한다
     · DLI·밴드·전기요금       → house (계약 객체 daily_light/1)
     · 임계값·계수·확률        → data/balance/*.json (plan)

   ★ v0에는 고사·수확·경제가 없다. 자리도 만들지 않는다 —
     "이동평균으로 만들었다가 체력 모델로 바꾸는" 두 번 일을 피하려는 것.
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

    /* ★ 화분. v0는 1개 (growth가 한 그루 전용).
       slotId 하나로 자리를 기억한다 — 가구를 옮겨도·세이브해도 안 바뀐다. */
    pots: [{
      id: 'pot_01',
      slotId: null,
      plantId: 'monstera_deliciosa',
      variegated: false,
      daysPlanted: 0
    }],

    /* 코어가 따로 쌓는 DLI 이력. 용도는 두 가지뿐:
         ① growth의 dli7()과 대조(어긋나면 배선이 틀린 것)
         ② 30일 검수 리포트의 '문턱 넘는 주 비율'
       ★ 판정에는 쓰지 않는다. 고사는 growth의 vigor 몫(v1). */
    dliHist: [],

    /* 경제는 3단계다. 표시만 하고 차감하지 않는다. */
    ledger: { today: { in: 0, out: 0 }, total: 0, electricityWon: 0 },

    log: []
  };
}

export function pot0(S) { return S.pots[0]; }

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
