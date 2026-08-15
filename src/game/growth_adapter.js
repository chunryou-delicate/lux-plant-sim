/* ============================================================
   game/growth_adapter.js — growth 경계 (core 소유)
   ------------------------------------------------------------
   plant_grow.html 은 일반 <script> 라 함수가 그 문서의 전역에만 있다.
   그래서 iframe 으로 띄우고 contentWindow 로 부른다. 파일은 건드리지 않는다.
   ★ growth가 나중에 ES 모듈로 내주면(다개체 리팩터) 고칠 파일은 이것 하나다.

   ★ 코어는 여기서 '죽음·수확'을 판정하지 않는다. v0엔 그 개념 자체가 없다.
     활력(vigor)은 표시 취소·구현 보류라(2026-08-02) **훅조차 두지 않는다** — 아래 참고.
============================================================ */

/* ★★ 프롤로그에서 **몇 번째 잎**을 무늬로 못 박나 (2026-08-13 박사님 확정).
   *"2번째 잎일 때 나와서 탈출하는 게 안 늘어지고 좋을 거 같긴 해서"*
   ⚠ 이것은 **확률이 아니다.** 캐논의 20%(`plant_grow.P.varieProb`)는 한 글자도 안 바뀌고,
     이 값이 가리키는 잎 한 장만 굴림에 진 뒤에 참으로 덮인다(plant_grow §프롤로그 보장). */
export const PROLOGUE_VARIE_LEAF_NO = 2;

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
  ['setDailyLight', 'advanceTo', 'calendarDay', 'growthDays', 'growthBlocked', 'growthPhase', 'setGrowth'];

/* 준비 완료 = 위 일곱 동작 함수 + `thLoaded() === true`.
   함수가 있다고 준비된 게 아니다 — 임계값 정본은 비동기로 실린다(2026-08-02 브라우저에서 잡힘). */
export const REQUIRED_GROWTH_STATE = ['thLoaded'];

export function createGrowthAdapter(iframe) {
  const win = () => (iframe && iframe.contentWindow) || null;
  const fn = (name) => {
    const w = win();
    return w && typeof w[name] === 'function' ? w[name] : null;
  };
  let setGrowthCalls = 0;          // ★ 일일 루프에서 0회여야 한다(감시용)
  /* 프롤로그 보장(아래 setGrowth 참고) — 자동으로 한 번만 켠다 · 호스트가 직접 켜면 손을 뗀다 */
  let prologueArmed = false, prologueExplicit = false;

  /* iframe 안의 스크립트가 다 돌 때까지 기다린다(three.js·GLB 로드가 있어 몇 초 걸린다) */
  function missing() { return REQUIRED_GROWTH_FNS.filter(n => !fn(n)); }

  /* ★ 함수가 있다고 준비된 게 아니다 (2026-08-02, 브라우저에서 잡힘).
     plant_grow 는 임계값 정본(data/growth_tuning.json)을 **비동기로** 싣는다.
     전역 함수는 그 전에 이미 존재하므로, 함수만 보고 열면 첫 며칠이 통째로
     "임계값 정본이 안 실렸습니다"로 정지한다 — 실제로 유효 143에서 안 움직였다.

     growth 가 `thLoaded()` 접근자를 내줬으므로 **그 상태를 직접 묻는다.**
     (한때 "밝은 빛을 넣어 보고 정지 여부로 추정하는" 프로브를 썼는데 지웠다 —
      추정 대신 상태를 묻는 게 맞고, 프로브는 이력을 건드릴 위험도 있었다.
      `growthMin()` 도 못 쓴다: 코드 기본값이 있어 정본 없이도 값을 돌려준다.) */
  function thresholdsLoaded() {
    const f = fn('thLoaded');
    if (!f) return false;                 // 접근자가 없으면 '준비 안 됨'으로 본다
    try { return !!f(); } catch { return false; }
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
                : !fn('thLoaded')
                  ? 'plant_grow.html 에 thLoaded() 가 없습니다 — 정본 로딩을 확인할 수 없어 열지 않습니다.'
                  : 'plant_grow.html 이 임계값 정본(data/growth_tuning.json)을 못 실었습니다 — ' +
                    '서버로 열었는지 확인해 주세요. 그 상태로 열면 첫날부터 형태가 정지합니다.'));
        setTimeout(tick, 120);
      };
      tick();
    });
  }

  /* ★ ready 이후에 계약이 사라질 수 있다 (2026-08-02).
     iframe 을 새로고침하면 contentWindow 가 갈리고 전역 함수가 잠시(또는 영영) 없어진다.
     그때 null 을 돌려주면 **턴이 반쯤 진행된 채로 조용히 지나간다** — 달력만 가고 형태는 그대로,
     그런데 화면엔 아무 말도 없다. 그래서 계약 함수는 전부 **없으면 던진다.** */
  function must(name) {
    const f = fn(name);
    if (!f) throw new Error(
      `[생장] ${name} 을(를) 부를 수 없습니다 — plant_grow 가 다시 로딩됐거나 계약이 사라졌습니다` +
      `${missing().length ? ` (없는 함수: ${missing().join(', ')})` : ''}`);
    return f;
  }

  /* 상태를 건드리기 전에 한 번에 확인한다 — 루프가 이걸 먼저 부른다(부분 진행 방지). */
  function assertContract() {
    const gone = missing();
    if (gone.length) throw new Error(
      `[생장] 계약이 끊겼습니다 — 없는 함수: ${gone.join(', ')}. ` +
      `plant_grow 를 다시 불러온 것 같습니다. 오늘 턴은 진행하지 않았습니다`);
    if (!thresholdsLoaded()) throw new Error(
      '[생장] 임계값 정본이 실리지 않았습니다 — 오늘 턴은 진행하지 않았습니다');
    return true;
  }

  return {
    ready, missing, assertContract,
    has: (name) => !!fn(name),

    /* 하루치 빛 — 숫자로 넘긴다. ★ null 도 반드시 넘긴다(어제 값이 남으면 안 된다). */
    setDailyLight(dli) { return must('setDailyLight')(dli); },

    /* ★ 하루 진행 — 코어의 일일 루프는 이것만 쓴다.
       달력은 하루 가고, 유효 생장(형태)은 빛이 될 때만 쌓인다.
       반환 { calDay, growth, grew, blocked, drawn, drawError, hudError }
         drawn      3D 무대를 다시 그렸는가. **false 면 화면의 식물은 낡은 것**
         drawError  3D 실패 사유 · hudError growth 자체 HUD 실패 사유(둘은 끝까지 별개 경계)
       ⚠ 그리기가 터져도 growth 는 예외를 안 던진다 — 논리 진행은 이미 끝났기 때문이다.
         그래서 코어가 `drawn` 을 안 보면 "게이지는 오르는데 그림은 멈춘" 상태를 아무도 모른다.
       ⚠ 옛 growth 는 이 세 필드를 안 낸다(undefined = 정보 없음). 실패로 읽지 말 것. */
    advanceTo(calDay) { return must('advanceTo')(calDay); },
    calendarDay()     { return must('calendarDay')(); },
    growthDays()      { return must('growthDays')(); },
    growthBlocked()   { return must('growthBlocked')(); },
    /* novice 형태 게이지의 정본. 생장일·단계 경계를 코어에 복제하지 않는다.
       반환 { phaseId, phaseKo, progress01, nextPhaseId, nextPhaseKo }
       ★ 한글 이름도 growth 가 낸 것을 쓴다 — 코어가 자기 표를 들면 단계가 바뀔 때
         **오류 없이 틀린 라벨**이 뜬다. 모르는 키는 growth 가 키 그대로 낸다. */
    growthPhase()     { return must('growthPhase')(); },

    /* ⚠ 점프다. **초기 형태 배치·디버그 전용** — 일일 루프에서 부르지 않는다.
       개체가 생길 때 한 번(도착 진행도 = state.ARRIVAL.growthDays) 쓰는 게 전부다.
       없으면 던진다 — null 을 돌려주면 "도착은 했는데 형태는 0일"인 개체가 조용히 생긴다.
       도착은 성공/실패가 갈려야 하는 원자적 사건이다(state.givePlant 참고). */
    /* 반환 { growth, calDay, drawn, drawError, hudError } — 도착(개체 생성)이 이걸 쓴다.
       `drawn` 을 안 보면 "화분은 있는데 화면엔 없는" 개체가 생긴다(state.givePlant 참고). */
    setGrowth(days) {
      const f = must('setGrowth'); setGrowthCalls++;
      const r = f(days);
      /* ★★ 프롤로그 보장을 **여기서** 켠다 (2026-08-13 · plant_grow §프롤로그 보장).
         ------------------------------------------------------------
         박사님 확정: *"프롤로그니까 … 이때만 확정적으로 … 2번째 잎일 때 나와서"*.
         ★ 왜 이 자리인가 — `setGrowth` 는 **개체 도착 한 번**뿐이다(위 주석·state.givePlant·
           save.js §growth). 그 한 번이 곧 프롤로그이고, 그 뒤 하루 진행은 전부 `advanceTo` 라
           여기를 다시 안 지난다. 그래서 「첫 플레이에서만」이 배선 하나로 성립한다.
         ★ 확률은 안 건드린다. 켜지는 것은 **그 한 잎만 참으로 덮는 장부**이고,
           3번째 잎부터는 캐논대로 잎마다 20% 다.
         ⚠ 세이브를 다시 불러도 같은 답이다 — 재생이 도착부터 되밟으므로(save.js) 같은 잎이
           같은 자리에서 다시 덮인다. 굴리는 것이 아니라 **못 박는** 것이라 그렇다.
         ⚠ `explicit` 이 서 있으면 안 건드린다 — 호스트가 직접 정한 값이 항상 이긴다. */
      if (!prologueExplicit && !prologueArmed) {
        prologueArmed = true;
        const g = fn('setPrologueVarieLeaf');
        if (g) { try { g(PROLOGUE_VARIE_LEAF_NO); } catch { prologueArmed = false; } }
      }
      return r;
    },
    setGrowthCalls: () => setGrowthCalls,

    /* ★ 프롤로그 보장을 직접 켜고 끈다. `n = 0` 이면 끈다(정식 모드·튜닝 도구의 기본값).
       호스트가 한 번이라도 부르면 위 자동 배선은 손을 뗀다. */
    setPrologueVarieLeaf(n) {
      prologueExplicit = true;
      const f = fn('setPrologueVarieLeaf');
      return f ? f(n) : null;                 // 옛 plant_grow 면 null — 지어내지 않는다
    },
    /* 지금 상태 { leafNo, used, leafBirth } · 접근자가 없으면 null */
    prologueVarie() { const f = fn('prologueVarieState'); return f ? f() : null; },

    /* ★ 갈라짐 표시는 반드시 이걸 쓴다 (growth 요청, 2026-08-01).
       `bandOf(오늘값).fenestrating` 은 넘긴 하루 값 기준이라 오늘만 반짝 넘어도 true다.
       실제 판정(`calcMatureProb`)은 7일 평균을 보므로, 하루 값으로 "갈라짐 시작!"을 띄우면
       거짓말이 된다 — 반지하·등1개가 정확히 그 경우다(하루 6.02 넘음 / 7일평균 5.82 못 넘음). */
    canFenestrate(varie) { const f = fn('canFenestrate'); return f ? f(!!varie) : null; },

    /* ★ 삽수용 — 모주의 **자를 수 있는 마디 목록** (2026-08-03).
       반환 `[{ nodeId, stem, leaves, variegatedLeaves, growthDays }]` 또는 **null**.

       ★ [처리됨 2026-08-03 growth 창] 접근자가 붙었다. 이제 실제 목록이 온다.
         plant_grow.html 이 `buildPlant` 이 그리던 마디 트리 시뮬을 `growTopology()` 로 꺼내
         그리기 없이도 같은 트리를 낼 수 있게 했고, `cuttableNodes()` 가 그걸 읽어 낸다.
         (그전엔 `axisTimeline` 뿐이라 「어느 마디에서 어느 가지가 났나」와 「그 잎이 무늬인가」가
          없었고, 그 둘 없이는 "이 조각이 잎 몇 장을 품고 있나"를 못 냈다.)
         ⚠ 옛 plant_grow 를 물리면 여전히 null 이다 — 그 경우의 규약은 아래 그대로다.

       ★ 그래서 **추정하지 않는다.** 여기서 잎 수를 지어내면 삽수가
         "실제 자랐던 것을 자른 것"이 아니라 코어가 만든 새 개체가 된다 —
         이 기능의 존재 이유가 그 자리에서 사라진다.
         null 이면 호출부는 자르기 UI 를 **열지 않으면 된다**(propagation.takeCutting 은
         마디 목록 없이는 던진다). 요청은 docs/handoff/core-to-growth.md 에 적어 뒀다. */
    cuttableNodes() {
      const f = fn('cuttableNodes');
      if (!f) return null;
      const list = f();
      return Array.isArray(list) ? list : null;
    },

    /* ★ 판매·표시용 — 지금 이 그루의 잎 집계 (2026-08-03).
       반환 `{ leaves, variegatedLeaves, matureLeaves, growthDays }` 또는 **null**.

       가격 공식(`단위기본가 × 크기 × (1+60·v²)`, docs/propagation.md §6)의 크기와 v 가
       여기서 온다. **코어는 잎을 세지 않는다** — 형태는 growth 소유라 셀 근거가 없다.

       ⚠ 접근자가 없으면 **null 이다. 0 으로 메꾸지 않는다.** cuttableNodes 와 같은 규칙이다 —
         0 을 내면 "값 0원짜리 그루"가 조용히 생기고, 지어낸 잎 수를 내면 안 판 잎을 판 게 된다.
         호출부는 null 이면 판매 화면을 열지 않으면 된다.
       ⚠ 바랜 잎은 **안 빠져 있다**(떨어진 잎만 빠진다). growth 의 결정이고 사유는
         plant_grow.html 의 leafStats 주석에 있다 — 코어가 여기서 다시 깎지 말 것. */
    leafStats() {
      const f = fn('leafStats');
      if (!f) return null;
      const s = f();
      return (s && typeof s === 'object' && !Array.isArray(s)) ? s : null;
    },

    /* ★★ 잎별 상태 — **방이 확대창과 같은 그루를 그리게 하는 값** (2026-08-16).
       반환 `[{ leafBirth, varie, matured, fade, dropped }]` 또는 접근자가 없으면 **null**.

       ══ 왜 필요한가 (실측) ══════════════════════════════════════════════════
       방(`render3d/plant_assemble.js`)은 plant_grow 의 본문을 **다른 인스턴스로** 돌려
       형태를 짓는다. 그런데 그 인스턴스에는 `setDailyLight` 이 한 번도 안 들어가므로
       `dli7()` 이 늘 null 이고, 그래서
         · `calcVarieProb()` = 0     → 무늬가 **날 수 없다**
         · `calcMatureProb()` = 하한 → 잎마다 딱 한 번 10%
       실측(seed 92158): 방 조립은 **유효 1000일에도 갈라진 잎 0장**이었다. 같은 시드를
       확대창에서 하루씩 걸으면 반지하 창턱(DLI 4.8)에서도 유효 300일에 5장 중 2장,
       1000일에 8장 중 7장이 갈라진다.
       ⇒ **형태만 방이 짓고, 상태는 정본이 정한 것을 넘긴다.** 그 창구가 이 함수다.

       ⚠ 여기서 값을 지어내지 않는다 — 세 접근자를 leafBirth 로 합치기만 한다.
         하나라도 없으면 그 칸을 비운다(0 으로 안 메꾼다). 셋 다 없으면 null 이다.
       ⚠ 바램(`fade`)은 **유효 생장일이 멈춘 채로도 움직인다**(어두운 자리). 그래서
         호출부는 `growthDays` 가 그대로여도 이 값을 매일 다시 넘겨야 한다 —
         방뷰의 `needsRebuild` 가 그 변화를 보고 다시 짓는다. */
    leafState() {
      const fv = fn('varieStateAll'), fm = fn('matStateAll'), fh = fn('leafHealthAll');
      if (!fv && !fm && !fh) return null;
      const out = new Map();
      const row = (lb) => {
        if (!Number.isFinite(lb)) return null;
        let r = out.get(lb);
        if (!r) { r = { leafBirth: lb, varie: false, matured: false, fade: 0, dropped: false }; out.set(lb, r); }
        return r;
      };
      try { for (const v of (fv ? fv() : [])) { const r = row(v && v.leafBirth); if (r) r.varie = !!v.varie; } } catch { }
      try { for (const m of (fm ? fm() : [])) { const r = row(m && m.leafBirth); if (r) r.matured = !!m.matured; } } catch { }
      try {
        for (const h of (fh ? fh() : [])) {
          const r = row(h && h.leafBirth);
          if (r) { r.fade = Number.isFinite(h.fade) ? h.fade : 0; r.dropped = !!h.dropped; }
        }
      } catch { }
      return [...out.values()].sort((a, b) => a.leafBirth - b.leafBirth);
    },

    /* 표시·대조 전용(판정에 안 쓴다) — 없으면 화면에 '—' 로 두면 되므로 던지지 않는다. */
    dli7()   { const f = fn('dli7');   return f ? f() : null; },
    dliCV()  { const f = fn('dliCV');  return f ? f() : null; },
    ageOf(d) { const f = fn('ageOf');  return f ? f(d) : null; },
    bandOf(dli, varie) { const f = fn('bandOf'); return f ? f(dli, varie) : null; },
    reset()  { const f = fn('resetDailyLight'); return f ? f() : null; },

    /* ★ vigor()·isDead() 훅은 **제거했다** (2026-08-02).
       활력 표시가 취소됐고(novice 는 형태 진행도 한 축, 활력은 숨김·감소 없음),
       고수 모드 활력도 보류다. 지금 계약 밖이므로 자리조차 두지 않는다 —
       "있으니까 언젠가 읽겠지"가 되면 판정이 코어로 새어 들어온다. */
  };
}
