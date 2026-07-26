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

export function createGrowthAdapter(iframe) {
  const win = () => (iframe && iframe.contentWindow) || null;
  const fn = (name) => {
    const w = win();
    return w && typeof w[name] === 'function' ? w[name] : null;
  };

  /* iframe 안의 스크립트가 다 돌 때까지 기다린다(three.js·GLB 로드가 있어 몇 초 걸린다) */
  function ready(timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        if (fn('setDailyLight') && fn('setGrowth')) return resolve(true);
        if (Date.now() - t0 > timeoutMs)
          return reject(new Error('plant_grow.html 을 부를 수 없습니다. ' +
            'file:// 로 열면 iframe 접근이 막힙니다 — tools/serve.py 로 띄워 주세요.'));
        setTimeout(tick, 120);
      };
      tick();
    });
  }

  return {
    ready,
    has: (name) => !!fn(name),

    /* 하루치 빛 — 숫자로 넘긴다(위 dliFromContract 참고) */
    setDailyLight(dli) { const f = fn('setDailyLight'); return f ? f(dli) : null; },

    /* 생장 1틱. 화분을 심은 지 며칠 됐나를 넘긴다(게임 날짜가 아니라). */
    setGrowth(days) { const f = fn('setGrowth'); return f ? f(days) : null; },

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
