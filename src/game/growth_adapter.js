/* ============================================================
   game/growth_adapter.js — growth 경계 (core 소유)
   ------------------------------------------------------------
   plant_grow.html 은 일반 <script> 라 함수가 그 문서의 전역에만 있다.
   그래서 iframe 으로 띄우고 contentWindow 로 부른다. 파일은 건드리지 않는다.
   ★ growth가 나중에 ES 모듈로 내주면(다개체 리팩터) 고칠 파일은 이것 하나다.

   ★ 코어는 여기서 '죽음·수확'을 판정하지 않는다. v0엔 그 개념 자체가 없고,
     v1에서도 vigor()·isDead() 를 읽기만 한다 (growth 소유).
============================================================ */

/* 계약 객체에서 이 화분 자리의 DLI를 코어가 직접 꺼낸다.

   ★ 왜 setDailyLight(계약, slotId) 를 안 쓰나
     growth 쪽 수신부가 slots 를 x.id 로 찾는데(plant_grow.html), 계약은 x.slotId 로 낸다.
     그대로 부르면 '못 찾음 → best 로 대체'가 매번 일어나 화분이 딴 자리 빛을 먹는다.
     v0는 코어가 직접 찾아 숫자로 넘긴다. 패치는 core-to-growth.md 로 요청해 뒀다. */
export function dliFromContract(report, slotId, warn) {
  const slots = (report && report.slots) || [];
  const s = slots.find(x => x && (x.slotId === slotId || x.id === slotId));
  if (!s) {
    if (warn) warn(`슬롯 ${slotId} 이(가) 계약에 없습니다 — 오늘 빛을 넘기지 않습니다`);
    return null;   // 조용히 best 로 떨어지지 않는다. 티가 나야 고친다.
  }
  const v = s.dli;
  if (typeof v !== 'number' || !isFinite(v) || v < 0) {
    if (warn) warn(`슬롯 ${slotId} 의 DLI가 이상합니다: ${v} — 넘기지 않습니다`);
    return null;
  }
  return v;
}

/* ★ 준비 완료의 기준 (2026-08-02 계약) — 이 다섯이 다 있어야 게임 경로를 연다.
   `setGrowth` 만 보고 준비됐다고 하면 옛 인터페이스로 돌아가 저광 정지가 통째로 사라진다. */
export const REQUIRED_GROWTH_FNS =
  ['setDailyLight', 'advanceTo', 'calendarDay', 'growthDays', 'growthBlocked', 'setGrowth'];

export function createGrowthAdapter(iframe) {
  const win = () => (iframe && iframe.contentWindow) || null;
  const fn = (name) => {
    const w = win();
    return w && typeof w[name] === 'function' ? w[name] : null;
  };
  let setGrowthCalls = 0;          // ★ 일일 루프에서 0회여야 한다(감시용)

  /* iframe 안의 스크립트가 다 돌 때까지 기다린다(three.js·GLB 로드가 있어 몇 초 걸린다) */
  function missing() { return REQUIRED_GROWTH_FNS.filter(n => !fn(n)); }

  /* ★ 함수가 있다고 준비된 게 아니다 (2026-08-02, 브라우저에서 잡힘).
     plant_grow 는 임계값 정본(data/growth_tuning.json)을 **비동기로** 싣는다.
     전역 함수는 그 전에 이미 존재하므로, 함수만 보고 열면 첫 며칠이 통째로
     "임계값 정본이 안 실렸습니다"로 정지한다 — 실제로 유효 143에서 안 움직였다.
     `growthMin()` 은 정본이 없으면 **던지도록** 되어 있어(plant_grow) 문자열 없이 판정할 수 있다.
     ⚠ 계약 함수가 아니라 정황 증거다. growth 에 `thLoaded()` 를 요청해 뒀다 — 생기면 그걸 쓴다. */
  function thresholdsLoaded() {
    const w = win();
    /* ① 정본 경로 — growth 가 thLoaded() 를 내면 이것만 본다.
       ★ 그때 아래 ② 프로브 블록은 통째로 지운다(요청해 뒀다: core-to-growth 2026-08-02). */
    if (w && typeof w.thLoaded === 'function') return !!w.thLoaded();

    /* ② 임시 — thLoaded() 가 없는 동안만 쓴다 */

    /* 정본 미로드를 **의미로** 확인한다 — 문자열도, 내부 변수도 보지 않는다.
       "자랄 만큼 밝은 빛을 넣었는데도 정지"면 아직 준비가 안 된 것이다.
       ⚠ growthMin() 은 못 쓴다 — 코드 기본값이 있어 정본 없이도 값을 돌려준다(그래서 안 던진다).
       프로브로 넣은 값은 바로 지운다(resetDailyLight). 게임 시작 전이라 이력이 비어 있다. */
    const sdl = fn('setDailyLight'), blocked = fn('growthBlocked'), reset = fn('resetDailyLight');
    if (!sdl || !blocked) return true;                 // 알 수 없으면 막지 않는다
    let loaded = false;
    try {
      const gm = fn('growthMin');
      let probe = 100;
      try { const v = gm && gm(); if (typeof v === 'number' && isFinite(v)) probe = v * 10 + 10; } catch {}
      sdl(probe);
      loaded = blocked() === null;
    } catch { loaded = false; }
    finally { try { reset && reset(); } catch {} }
    return loaded;
  }

  function ready(timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        if (missing().length === 0 && thresholdsLoaded()) return resolve(true);
        if (Date.now() - t0 > timeoutMs)
          return reject(new Error(
            !fn('setDailyLight')
              ? 'plant_grow.html 을 부를 수 없습니다. ' +
                'file:// 로 열면 iframe 접근이 막힙니다 — tools/serve.py 로 띄워 주세요.'
              : missing().length
                ? `plant_grow.html 의 생장 계약이 낡았습니다 — 없는 함수: ${missing().join(', ')}.\n` +
                  `코어는 setGrowth 로 하루를 진행하지 않습니다(저광 정지가 무시됩니다).`
                : 'plant_grow.html 이 임계값 정본(data/growth_tuning.json)을 못 실었습니다 — ' +
                  '서버로 열었는지 확인해 주세요. 그 상태로 열면 첫날부터 형태가 정지합니다.'));
        setTimeout(tick, 120);
      };
      tick();
    });
  }

  return {
    ready, missing,
    has: (name) => !!fn(name),

    /* 하루치 빛 — 숫자로 넘긴다. ★ null 도 반드시 넘긴다(어제 값이 남으면 안 된다). */
    setDailyLight(dli) { const f = fn('setDailyLight'); return f ? f(dli) : null; },

    /* ★ 하루 진행 — 코어의 일일 루프는 이것만 쓴다.
       달력은 하루 가고, 유효 생장(형태)은 빛이 될 때만 쌓인다.
       반환 { calDay, growth, grew, blocked } · 하루가 아닌 값을 주면 growth 가 던진다. */
    advanceTo(calDay) { const f = fn('advanceTo'); return f ? f(calDay) : null; },
    calendarDay()     { const f = fn('calendarDay');    return f ? f() : null; },
    growthDays()      { const f = fn('growthDays');     return f ? f() : null; },
    growthBlocked()   { const f = fn('growthBlocked');  return f ? f() : null; },

    /* ⚠ 점프다. **초기 형태 배치·디버그 전용** — 일일 루프에서 부르지 않는다.
       개체가 생길 때 한 번(도착 진행도 143) 쓰는 게 전부다.
       ★ 함수가 없으면 null 을 돌려주지 않고 **던진다**(2026-08-02).
       null 을 돌려주면 "도착은 했는데 형태는 0일"인 개체가 조용히 생긴다 —
       도착은 성공/실패가 갈려야 하는 원자적 사건이다(state.givePlant 참고). */
    setGrowth(days) {
      const f = fn('setGrowth');
      if (!f) throw new Error('[생장] setGrowth 가 없습니다 — 개체를 만들 수 없습니다 ' +
        `(없는 함수: ${missing().join(', ') || 'setGrowth'})`);
      setGrowthCalls++;
      return f(days);
    },
    setGrowthCalls: () => setGrowthCalls,

    /* ★ 갈라짐 표시는 반드시 이걸 쓴다 (growth 요청, 2026-08-01).
       `bandOf(오늘값).fenestrating` 은 넘긴 하루 값 기준이라 오늘만 반짝 넘어도 true다.
       실제 판정(`calcMatureProb`)은 7일 평균을 보므로, 하루 값으로 "갈라짐 시작!"을 띄우면
       거짓말이 된다 — 반지하·등1개가 정확히 그 경우다(하루 6.02 넘음 / 7일평균 5.82 못 넘음). */
    canFenestrate(varie) { const f = fn('canFenestrate'); return f ? f(!!varie) : null; },

    /* 읽기 전용 — growth가 진짜 쓴 값. 코어 계산과 대조하는 용도. */
    dli7()   { const f = fn('dli7');   return f ? f() : null; },
    dliCV()  { const f = fn('dliCV');  return f ? f() : null; },
    ageOf(d) { const f = fn('ageOf');  return f ? f(d) : null; },
    bandOf(dli, varie) { const f = fn('bandOf'); return f ? f(dli, varie) : null; },
    reset()  { const f = fn('resetDailyLight'); return f ? f() : null; },

    /* v1에 생긴다(체력 모델). 지금은 없으므로 null — 코어는 이 값으로 판정하지 않는다. */
    vigor()  { const f = fn('vigor');   return f ? f() : null; },
    isDead() { const f = fn('isDead');  return f ? f() : null; }
  };
}
