/* 반지하 튜토리얼 — 첫 플레이 **그 뒤** (2026-08-03)
 *
 * 첫 플레이(`first_play.js`)는 Day 0~16 한 흐름만 담는다. 이 파일은 그 뒤부터
 * **원룸으로 이사할 때까지**를 담는다. `docs/story_arc.md` 가 정본이다.
 *
 *   ① 반지하 ← 여기          ② 탈출(이사)  ③ 원룸  ④ 삽수로 내 집 마련 엔딩
 *
 * ★순수하다. DOM 도 타이머도 모른다. 화면은 game.html 이 그린다.
 *
 * ★수치는 전부 근거가 있다. 지어낸 값이 없다 —
 *   식비·지출은 `food_economy.md`, 자금·이사비는 `game_flow.md`,
 *   계절 길이는 `src/engine/weather.js`, 종료 조건은 `story_arc.md` §1.
 */

import { seasonOf, DAYS_PER_SEASON } from '../engine/weather.js';

/* weather.js 는 **연중 절대 일수**를 받는다(0~359, 봄→여름→가을→겨울 각 90일).
   "여름 45일째"를 그 축으로 옮기려면 여름이 시작하는 90 을 더해야 한다 —
   45 를 그냥 넣으면 봄 45일째가 되어 계절이 통째로 어긋난다(실제로 그랬다). */
const SEASON_START = Object.freeze({ spring: 0, summer: 90, autumn: 180, winter: 270 });

export const TUTORIAL_RULES = Object.freeze({
  /* ★게임 시작 = 여름 45일차. 0일차면 90일 내내 여름이라 계절이 아예 안 나오고,
     식물등의 존재 이유도 같이 사라진다(story_arc.md §2).
     45 를 고른 이유: 첫 플레이(16일)를 여름 고정으로 끝내고 나면 가을까지 29일이
     남는다. 표준 진행이면 가을 안에 이사하고, 늦으면 겨울을 맞는다 — 세 경로가 성립한다. */
  startSeason: 'summer',
  startSeasonDay: 45,

  startCashWon: 1_000_000,        // game_flow.md — "없음"이 정체성이라 안 올린다
  moveOutCostWon: 1_500_000,      // 원룸 보증금 + 첫 달 월세 + 이사비. 실비 근거가 있어 안 내린다
  rentWon: 300_000,               // 반지하 월세
  rentGraceDays: 30,              // ★첫 달 유예. plan 권고 — 서사 장치이고 정체성을 안 건드린다
  dailySpendWon: 20_000,          // 식비 7,500 + 공과·전기 2,500 + 그 밖 (food_economy.md)
  mealCostWon: 2_500,             // 한 끼. 콩나물 한 끼가 이만큼을 아낀다

  /* 식물등 — 필수가 아니라 선택이다. 하루 지출보다 조금 커서 망설임이 생기고,
     전기는 거의 공짜라 부담이 사는 순간 한 번뿐이다(story_arc.md §4). */
  lampPriceWon: 25_000,
  lampWatt: 12, lampHours: 12, kwhWon: 160,   // 12W × 12h × 160원/kWh = 23원/일
  lampUnlockSeason: 'autumn'                  // 가을 진입에 해금 — 겨울 전 선택지가 생긴다
});

/* ── 알림 시점 (2026-08-03) ────────────────────────────────────────────
   ★규칙이 아니라 **말이 나올 자리**다. 살림 수치(월세·등값)는 위 TUTORIAL_RULES 가 갖고,
     여기 셋은 "언제 말을 거나"만 정한다. 값을 바꿔도 경제는 안 바뀐다. */
const RENT_NOTICE_DAYS = 7;    // 유예 만료 이레 전에 미리 알린다
const LAMP_NUDGE_DAY = 7;      // 가을 이레째까지 등을 안 샀으면 한 번만 짚는다
const WINTER_STILL_DAY = 10;   // 겨울 열하루째까지 반지하면 한 번 더

/* 학습 체크리스트 — story_arc.md §1. ★넷 다 **코어가 이미 내는 값**으로 판정한다.
   새 신호를 만들면 그게 또 어긋난다. */
export const LEARNING = Object.freeze({
  harvest:     { ko: '콩나물 첫 수확 · 식비 절감 확인' },
  cropDark:    { ko: '콩나물을 어두운 자리에 두었다' },
  plantWindow: { ko: '몬스테라를 높은 창가 자리에 두었다' },
  spear:       { ko: '말린 새순을 보았다' }
});
const LEARNING_KEYS = Object.keys(LEARNING);

export function createTutorialState(opt = {}) {
  const R = opt.rules || TUTORIAL_RULES;
  return {
    enabled: !!opt.enabled,
    rules: R,
    day: 0,                       // 게임 시작으로부터 며칠
    cashWon: R.startCashWon,
    /* 계절이 흐르기 시작하는 시점. 첫 플레이(novice·여름 고정) 동안은 멈춰 있다. */
    seasonRunning: false,
    lamp: { unlocked: false, owned: 0, litHours: R.lampHours },
    rent: { paidCount: 0, nextDueDay: R.rentGraceDays },   // 첫 달은 유예라 30일 뒤부터
    learned: LEARNING_KEYS.reduce((o, k) => (o[k] = false, o), {}),
    movedOut: false,
    bankrupt: false
  };
}

/* ── 계절 ─────────────────────────────────────────────────────────────── */

/* 게임 n일차 → 연중 절대 일수. weather.js 의 달력 위에 시작점만 얹는다 —
   새 시간 체계를 안 만든다. */
function yearDay(ts, day) {
  const base = (SEASON_START[ts.rules.startSeason] ?? 0) + ts.rules.startSeasonDay;
  const Y = DAYS_PER_SEASON * 4;
  return ((base + Math.max(0, day)) % Y + Y) % Y;
}
export function seasonAt(ts, day) { return seasonOf(yearDay(ts, day)); }
/* 그 계절이 며칠째인가. 화면이 "가을 12일째"처럼 적을 때 쓴다. */
export function seasonDayAt(ts, day) { return yearDay(ts, day) % DAYS_PER_SEASON; }
export const SEASON_KO = Object.freeze({ spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' });

/* ── 돈 ───────────────────────────────────────────────────────────────── */

/* 하루 전기값. 식물등 몫만 실계산하고 나머지는 dailySpendWon 안에 상수로 들어 있다
   (food_economy.md 의 결정 그대로 — 실측 23원/일이 월세 30만 옆에서 먼지가 되지 않게). */
export function lampElectricityWon(ts) {
  const R = ts.rules;
  const kwh = (R.lampWatt * ts.lamp.owned * ts.lamp.litHours) / 1000;
  return Math.round(kwh * R.kwhWon);
}

/* 콩나물이 아껴 준 오늘 식비. 끼니 하나가 mealCostWon 을 아낀다. */
export function foodSavedWon(ts, mealsUsed) {
  return Math.max(0, Math.round(mealsUsed || 0)) * ts.rules.mealCostWon;
}

export function buyLamp(ts) {
  if (!ts.lamp.unlocked) throw new Error('[튜토] 식물등은 아직 살 수 없습니다');
  if (ts.cashWon < ts.rules.lampPriceWon) {
    const e = new Error('[튜토] 돈이 모자랍니다 — 식물등 ' + ts.rules.lampPriceWon.toLocaleString() + '원');
    e.tutorialInput = true;                 // 안내지 고장이 아니다
    throw e;
  }
  ts.cashWon -= ts.rules.lampPriceWon;
  ts.lamp.owned += 1;
  /* ★사는 것은 **턴 밖**에서 일어난다(버튼). 그래서 다음 하루를 기다리지 않고
     여기서 바로 신호를 낸다 — 하루 뒤에 "샀네" 하면 산 순간이 조용해진다.
     호출부는 이 events 를 dialogue.createStoryteller().events() 에 그대로 넘기면 된다. */
  return { owned: ts.lamp.owned, cashWon: ts.cashWon,
           events: [{ id: 'lamp_bought', ko: '식물등을 샀습니다' }] };
}

/* ── 하루 ─────────────────────────────────────────────────────────────── */

/* 하루가 지났을 때 튜토리얼 쪽에서 일어나는 일.
   ★첫 플레이가 끝나기 전에는 계절도 돈도 안 움직인다 — 그 7~16일은 배우는 구간이지
     살림을 하는 구간이 아니다(first_play.md §0: novice·맑음·여름 고정). */
export function tutorialDay(ts, { firstPlayDone = false, mealsUsed = 0 } = {}) {
  if (!ts.enabled) return null;
  if (!firstPlayDone) return { skipped: '첫 플레이 진행 중' };

  ts.seasonRunning = true;
  ts.day += 1;
  const R = ts.rules;
  const ev = [];

  /* 지출 — 콩나물로 아낀 만큼은 빼고 낸다 */
  const saved = foodSavedWon(ts, mealsUsed);
  const power = lampElectricityWon(ts);
  const out = Math.max(0, R.dailySpendWon - saved) + power;
  ts.cashWon -= out;

  /* ★유예가 끝나 간다 (2026-08-03 추가) — 월세가 **처음 돈으로 느껴지는 자리**다.
     30일째에 30만 원이 그냥 빠지면 놀라기만 하고 준비할 기회가 없다. 이레 전에 알린다.
     새 규칙이 아니라 이미 있는 nextDueDay 를 읽기만 한다 — 상태를 늘리지 않았다. */
  if (ts.rent.paidCount === 0 && ts.day === ts.rent.nextDueDay - RENT_NOTICE_DAYS)
    ev.push({ id: 'rent_soon', ko: '월세 유예가 ' + RENT_NOTICE_DAYS + '일 뒤 끝납니다',
              dueDay: ts.rent.nextDueDay, rentWon: R.rentWon });

  /* 월세 — 첫 달은 유예다(집주인 사정·보증금 상계라는 서사 장치) */
  let rentPaid = 0;
  if (ts.day >= ts.rent.nextDueDay) {
    rentPaid = R.rentWon;
    ts.cashWon -= rentPaid;
    ts.rent.paidCount += 1;
    ts.rent.nextDueDay += 30;
    /* ★첫 달과 그 뒤는 다른 사건이다 — 첫 달은 유예가 끝난 날이고, 그 뒤는 반복이다.
       대사도 갈린다(dialogue.rentFirst / rentAgain). */
    ev.push({ id: 'rent', ko: '월세 ' + R.rentWon.toLocaleString() + '원',
              first: ts.rent.paidCount === 1, count: ts.rent.paidCount });
  }

  /* 식물등 해금 — 가을에 들어서면 살 수 있다 */
  const season = seasonAt(ts, ts.day);
  const seasonDay = seasonDayAt(ts, ts.day);
  if (!ts.lamp.unlocked && season === R.lampUnlockSeason) {
    ts.lamp.unlocked = true;
    ev.push({ id: 'lamp_unlocked', ko: '식물등을 살 수 있게 되었습니다',
              priceWon: R.lampPriceWon });
  }
  const prevSeason = seasonAt(ts, ts.day - 1);
  /* ★계절 이름을 같이 싣는다 — 가을과 겨울은 대사가 완전히 다르다.
     싣지 않으면 화면이 ko 문자열을 뜯어 봐야 하고, 그건 조용히 틀리는 종류다. */
  if (season !== prevSeason)
    ev.push({ id: 'season', ko: SEASON_KO[season] + '이 되었습니다', season, prevSeason });

  /* ★안 사는 것도 답이다 (story_arc.md §4) — 그래서 재촉이 아니라 한 번만 짚는다.
     해금일을 따로 저장하지 않는다: 해금은 가을 0일째라 "가을 7일째"가 곧 이레 뒤다. */
  if (ts.lamp.unlocked && ts.lamp.owned === 0 &&
      season === R.lampUnlockSeason && seasonDay === LAMP_NUDGE_DAY)
    ev.push({ id: 'lamp_skipped', ko: '식물등을 아직 사지 않았습니다' });

  /* ★겨울까지 못 나간 경우 — **실패가 아니라 더딘 것**이다(박사님 지시).
     겨울에 들어선 것만으로 한 번, 열흘이 지나도 그대로면 한 번 더 짚는다. */
  if (season === 'winter' && !ts.movedOut && seasonDay === WINTER_STILL_DAY)
    ev.push({ id: 'winter_still', ko: '겨울 ' + (WINTER_STILL_DAY + 1) + '일째 · 아직 반지하' });

  /* ★파산은 스토리 모드에서 끝이 아니다 — 초보 모드라 죽지 않는다(story_arc.md §0).
     0원 아래로는 안 내려가고, 표시로만 알린다. 게임을 끝내지 않는다. */
  if (ts.cashWon < 0) {
    ts.cashWon = 0;
    if (!ts.bankrupt) { ts.bankrupt = true; ev.push({ id: 'broke', ko: '돈이 다 떨어졌습니다' }); }
  } else if (ts.bankrupt && ts.cashWon > 0) ts.bankrupt = false;

  return { day: ts.day, season, seasonDay: seasonDayAt(ts, ts.day),
           cashWon: ts.cashWon, spentWon: out, savedWon: saved,
           electricityWon: power, rentWon: rentPaid, events: ev };
}

/* ── 배움 ─────────────────────────────────────────────────────────────── */

/* 체크리스트를 코어가 내는 값으로 채운다. ★한 번 켜지면 안 꺼진다 —
   배운 것을 나중에 자리를 옮겼다고 되돌리면 "배웠다"가 아니라 "지금 그렇게 두었다"가 된다. */
export function noteLearning(ts, ev = {}) {
  if (!ts.enabled) return ts.learned;
  const R = ts.rules;
  /* ① 첫 수확 · 식비 절감 */
  if (ev.harvested && (ev.foodSavedWon || 0) > 0) ts.learned.harvest = true;
  /* ② 콩나물을 어두운 자리에 — ★자리를 검사하지 않고 품질로 본다.
     콩나물은 빛을 받으면 초록이 되고 써진다. 3끼가 나오는 구간이 곧 어두운 자리라,
     **품질이 곧 배치의 증거**다(story_arc.md §1). 다른 방·다른 슬롯에서도 성립한다. */
  if (ev.harvested && ev.cropAvgDli != null && ev.cropAvgDli <= 0.3) ts.learned.cropDark = true;
  /* ③ 몬스테라를 밝은 자리에 — ★자리 이름이 아니라 DLI 로 본다.
     banjiha-sill:0 만 인정하면 다른 방에서 성립하지 않는다. 배운 것은 "창턱"이 아니라 "밝은 자리"다. */
  if (ev.plantDli7 != null && ev.plantMinDli != null && ev.plantDli7 >= ev.plantMinDli)
    ts.learned.plantWindow = true;
  /* ④ 말린 새순 */
  if (ev.spearFurled) ts.learned.spear = true;
  return ts.learned;
}

export function learningLeft(ts) {
  return LEARNING_KEYS.filter(k => !ts.learned[k]).map(k => ({ id: k, ko: LEARNING[k].ko }));
}

/* ── 이사 ─────────────────────────────────────────────────────────────── */

/* 종료 조건은 **두 축을 함께** 본다(story_arc.md §1).
   돈만 모으면 자동으로 끝나는 구조를 피하되, 돈을 아예 빼지도 않는다. */
export function canMoveOut(ts) {
  const need = ts.rules.moveOutCostWon;
  const money = ts.cashWon >= need;
  const left = learningLeft(ts);
  return {
    ok: money && left.length === 0,
    money, needWon: need, haveWon: ts.cashWon, shortWon: Math.max(0, need - ts.cashWon),
    learningLeft: left
  };
}

export function moveOut(ts) {
  const c = canMoveOut(ts);
  if (!c.ok) {
    const why = !c.money
      ? '이사 자금이 ' + c.shortWon.toLocaleString() + '원 모자랍니다'
      : '아직 못 해 본 것이 있습니다 — ' + c.learningLeft.map(x => x.ko).join(' · ');
    const e = new Error('[튜토] ' + why);
    e.tutorialInput = true;
    throw e;
  }
  ts.cashWon -= ts.rules.moveOutCostWon;
  ts.movedOut = true;
  /* ★반지하 구간의 끝이다. buyLamp 와 같은 이유로 여기서 신호를 낸다 —
     이사는 턴이 아니라 버튼이라, 다음 하루를 기다리면 장면이 하루 늦게 나온다. */
  return { movedOut: true, cashWon: ts.cashWon,
           events: [{ id: 'moved_out', ko: '원룸으로 이사했습니다' }] };
}

/* 화면이 "다음에 무엇을 하면 되나"를 적을 때 쓴다. 코어에 새 계산을 만들지 않는다. */
export function tutorialGoal(ts) {
  if (!ts.enabled) return null;
  if (ts.movedOut) return { id: 'done', ko: '원룸으로 이사했습니다' };
  const c = canMoveOut(ts);
  if (c.ok) return { id: 'ready', ko: '원룸으로 이사할 수 있습니다' };
  if (c.learningLeft.length) return { id: 'learn', ko: c.learningLeft[0].ko };
  return { id: 'money', ko: '이사 자금 ' + c.shortWon.toLocaleString() + '원이 더 필요합니다' };
}
