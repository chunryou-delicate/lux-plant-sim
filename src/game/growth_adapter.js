/* ============================================================
   game/growth_adapter.js — growth 경계 (core 소유)
   ------------------------------------------------------------
   plant_grow.html 은 일반 <script> 라 함수가 그 문서의 전역에만 있다.
   그래서 iframe 으로 띄우고 contentWindow 로 부른다. 파일은 건드리지 않는다.
   ★ growth가 나중에 ES 모듈로 내주면(다개체 리팩터) 고칠 파일은 이것 하나다.

   ★ 코어는 여기서 '죽음·수확'을 판정하지 않는다. v0엔 그 개념 자체가 없다.
     활력(vigor)은 표시 취소·구현 보류라(2026-08-02) **훅조차 두지 않는다** — 아래 참고.
============================================================ */

/* ★★ 프롤로그에서 **몇 번째 잎들**을 무늬로 못 박나 (2026-08-13 확정 · 2026-08-15 두 장).
   *"2번째 잎일 때 나와서 탈출하는 게 안 늘어지고 좋을 거 같긴 해서"* → **"응 그렇게 해줘"**(두 장)
   ⚠ 이것은 **확률이 아니다.** 캐논의 20%(`plant_grow.P.varieProb`)는 한 글자도 안 바뀌고,
     이 값이 가리키는 잎만 굴림에 진 뒤에 참으로 덮인다(plant_grow §프롤로그 보장).

   ══ ★ 왜 **2·3** 인가 — 재서 골랐다 (2026-08-15 · tools/_probe_prologue2) ═══════
   반지하 창턱에서 잎이 **화면에 보이는 날**(도착 뒤 며칠. 성숙도 0.22 — 그전엔 말린 새순이라
   무늬가 안 보인다). 등 0개(평균 DLI 4.80) / 등 1개(5.15):

     잎1  1일 / 1일     ← **도착할 때 이미 달고 온다**
     잎2  36일 / 29일
     잎3  91일 / 73일
     잎4  168일 / 135일
     잎5  —   / 224일

   ⇒ **잎1 은 쓸 수 없다.** 두 가지 이유가 다 걸린다.
      ① 도착 시점엔 빛 이력이 0 이라 `calcVarieProb` 이 **0** 이다(캐논 §D). 굴림은 반드시 지고,
        그 잎의 무늬 여부는 `setGrowth` **안에서** 이미 false 로 못 박힌다 —
        보장을 켜는 것은 그 `setGrowth` 가 **끝난 뒤**라(아래 setGrowth) 이미 늦다.
      ② 켤 수 있게 순서를 바꿔도, 그러면 **선물이 도착하자마자 무늬**다. 프롤로그가
        「자라는 것을 지켜보다 놀라는」 이야기가 아니게 된다.
   ⇒ **잎4 는 너무 늦다** — 168일이면 파산선(89~109일)을 한참 지난 뒤다. 프롤로그가 안 된다.
   ⇒ 남는 것이 **2·3** 이고, 둘째 장이 등 0개 91일 · 등 1개 73일이다. 등을 켜면 파산선 안쪽으로
      확실히 들어온다 — 「등을 켜라」는 그전에 배우는 것이라 결도 맞는다. */
export const PROLOGUE_VARIE_LEAVES = Object.freeze([2, 3]);
/* 옛 이름 — 첫 장. 이 값 하나만 읽던 호출부가 안 깨지게 남긴다. */
export const PROLOGUE_VARIE_LEAF_NO = PROLOGUE_VARIE_LEAVES[0];

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

/* ★★ 잎 이름표 색인 — `leafBirth` → 그 값을 나눠 쓰는 잎들의 축 경로 (2026-08-17).
   `plant_grow §leafAxisKeys()` 가 낸 줄을 묶기만 한다. **여기서 이름을 짓지 않는다** —
   짓는 자리는 `plant_grow §axisPathsOf` 하나고, 두 벌로 지으면 언젠가 갈린다.
   ⚠ 접근자가 없는 옛 `plant_grow` 면 **null** 이다(빈 Map 이 아니다 — 「이름표가 없다」와
     「이름표가 하나도 안 붙은 그루다」는 다른 말이고, 뒤엣것은 거짓말이 된다).
   ★ 경로는 정렬해서 낸다. 안 하면 같은 그루인데 부를 때마다 `leafKey` 가 딴 잎을 가리킬 수 있다. */
function leafKeyIndex(fn) {
  const f = fn('leafAxisKeys');
  if (!f) return null;
  let rows = null;
  try { rows = f(); } catch { return null; }
  if (!Array.isArray(rows)) return null;
  const m = new Map();
  for (const r of rows) {
    if (!r || !Number.isFinite(r.leafBirth) || typeof r.leafKey !== 'string' || !r.leafKey) continue;
    const a = m.get(r.leafBirth); if (a) a.push(r.leafKey); else m.set(r.leafBirth, [r.leafKey]);
  }
  for (const a of m.values()) a.sort();
  return m;
}

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

    /* ════════════════════════════════════════════════════════════════════
       ★★ 여러 그루 (2026-08-15 · plant_grow §다개체 등록부)
       ────────────────────────────────────────────────────────────────────
       아래의 `setDailyLight`·`advanceTo`·`leafStats`… 는 **지금 꽂혀 있는 그루**의 것이다.
       그루를 고르는 것은 `select(id)` 하나뿐이고, 그 뒤의 모든 창구가 그 그루를 가리킨다.
       ⇒ 그래서 42개 함수의 모양이 한 글자도 안 바뀌었다(설계 §전역 교체).

       ★ 첫 그루의 id 는 `__main__` 이다 — plant_grow 가 부팅 때부터 갖고 있던 그 그루다.
         한 그루짜리 판에서 `select('__main__')` 은 **아무 일도 안 한다**(이미 그것이라서).
       ⚠ 옛 plant_grow 에는 이 창구가 없다. 그때는 `multi()` 가 false 다 —
         호출부는 그루가 둘 이상이면 **열지 말아야 한다**(조용히 한 그루에 겹쳐 쓰면
         두 화분이 같은 형태를 공유하는, 제일 늦게 발견되는 사고가 난다). */
    multi()      { return !!fn('selectPlant') && !!fn('addPlant'); },
    plantIds()   { const f = fn('plantIds'); return f ? f() : null; },
    current()    { const f = fn('currentPlant'); return f ? f() : null; },
    plantInfo(id){ const f = fn('plantInfo'); return f ? f(id) : null; },

    /* 이 그루를 꽂는다. **없으면 던진다** — 조용히 딴 그루를 굴리면 그 화분은 영영 안 자란다. */
    /* ★ 2026-08-17 — 확대창의 화분을 갈아 끼운다(§plant_grow.setPotAsset).
       ⚠ 옛 확대창에는 이 창구가 없다 — 그때는 **아무 일도 안 한다**(던지지 않는다).
         화분 모양 하나 때문에 확대창이 안 열리면 안 된다. */
    setPotAsset(path) { const f = fn('setPotAsset'); return f ? f(path) : false; },
    select(id) {
      const f = fn('selectPlant');
      if (!f) throw new Error(
        `[생장] plant_grow 에 selectPlant 가 없습니다 — 여러 그루를 굴릴 수 없습니다 (요청: ${id})`);
      return f(id);
    },
    /* 새 그루를 등록한다(꽂지는 않는다). `{ id, seed, day, calDay, slotId }` */
    addPlant(spec) {
      const f = fn('addPlant');
      if (!f) throw new Error('[생장] plant_grow 에 addPlant 가 없습니다 — 새 그루를 만들 수 없습니다');
      return f(spec);
    },
    /* 그루를 거둔다. 기본 그루는 못 지운다(plant_grow 가 던진다). */
    removePlant(id) {
      const f = fn('removePlant');
      if (!f) throw new Error('[생장] plant_grow 에 removePlant 가 없습니다');
      return f(id);
    },

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
      /* ⚠⚠⚠ **여기 「한 번만」이 «씨앗 그루를 지키고» 있다** (2026-08-27 · [growth] 확인)
         ------------------------------------------------------------
         `prologueArmed` 는 모듈 수준이라 **판에서 한 번만** 켜진다. 그래서 나중에 심는 그루
         (상점 `monstera_seed` 로 키운 것)에는 이 보장이 **다시 안 걸린다.**
         ⇒ ★ 그것이 **맞는 동작**이다 — 「축복은 한 번뿐」이 그 뜻이고, plant_grow 쪽도
           그루마다 갈리게 돼 있다(`_plantInstall` 이 그 그루 것으로 갈아 끼운다 ·
           `addPlant` 는 `prologue:{leafNos:[],given:[]}` 로 **비운 채** 만든다).
         ⚠⚠ **그런데 여기서는 «안 걸어서» 맞은 것이지 «못 걸게 막아서» 맞은 것이 아니다.**
           ⇒ ⛔ 그러니 **이 줄을 「그루가 바뀌면 다시 건다」로 고치면 그 순간 축복이 «퍼진다».**
             씨앗 그루에도 잎 2·3 무늬가 보장되고, 튜토 엔딩의 「저 방에선 씨앗부터」가 거짓이 된다.
         ★ 재 둔 값(창턱 DLI 2.78~4.12 · [growth] `calcVarieProb` 실측):
```
           씨앗 그루가 무늬 «두 장»을 얻을 확률 — 잎 3장까지 «5%» · 잎 8장까지 28%
           프롤로그 그루는 잎 2·3 이 «확정» ⇒ ★ 그 차이가 「축복」이다
``` */
      if (!prologueExplicit && !prologueArmed) {
        prologueArmed = true;
        const g = fn('setPrologueVarieLeaf');
        /* ★ 배열을 넘긴다 — 옛 plant_grow 는 숫자만 받으므로 던지거나 조용히 첫 장만 켠다.
           던지면 아래 catch 가 배선을 되돌리고, 그 판은 보장 없이 캐논대로 돈다(지어내지 않는다). */
        if (g) { try { g(PROLOGUE_VARIE_LEAVES.slice()); } catch { prologueArmed = false; } }
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
       반환 `[{ nodeId, stem, leaves, variegatedLeaves, leafBirths, leafKeys, growthDays }]` 또는 **null**.

       ★★ 2026-08-17 — 줄마다 **딸려 나갈 잎의 열쇠**가 붙었다(plant_grow §cuttableNodes).
         `leafBirths: number[]`  그 잎들의 `leafBirth` — `leafState()` 가 내는 줄의 열쇠와 같은 칸
         `leafKeys:   string[]`  그 잎들의 축 경로(`n0`·`n0.1`·`n0.1:1`) — 잎마다 **유일하다**
         두 배열은 자리로 짝이고 길이는 `leaves` 와 같다.
       ⚠ `leafBirth` 는 **잎마다 유일하지 않다** — 쌍혹(가지 둘이 같은 날 나는 것)이면 두 잎이
         한 값을 나눠 쓴다. 그 값으로 잎을 지우면 **둘 다** 지워진다. 유일한 것은 `leafKeys` 다.
       ⚠ 이 어댑터는 이 칸을 **그대로 통과**시킨다(배열을 손대지 않는다).
         옛 plant_grow 는 이 칸이 아예 없다 — 그때는 `undefined` 다. 빈 배열로 메꾸지 않는다.

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

    /* ★★ 마디 여럿에 딸린 **잎 열쇠**를 한 벌로 모아 준다 (2026-08-17).
       ------------------------------------------------------------
       ══ 왜 있나 ═══════════════════════════════════════════════════════════
       삽수를 자르면 코어 장부에서는 잎이 준다(`propagation §motherLeafStats` 가 `lostLeaves`
       를 뺀다). 그런데 **방에 선 그루는 잎을 그대로 달고 있었다** — 형태의 정본이
       `plant_grow` 이고 거기에 「이 마디를 잘랐다」를 알려 줄 창구가 없었기 때문이다.
       방은 이미 `leafState()` 를 받아 그리므로(`plant_assemble §__setLeafState`), 없던 것은
       **「어느 잎이 잘려 나갔나」를 잇는 열쇠**뿐이다. 그 열쇠를 여기서 모아 낸다.

       인자   nodeIds  `cuttableNodes()` 의 `nodeId` 하나 또는 배열
       반환   `{ nodeIds, leafBirths, leafKeys, missing, twins }` 또는 **null**
         leafBirths  딸려 나갈 잎들의 `leafBirth` (leafState 의 줄과 맞물리는 값)
         leafKeys    같은 잎들의 유일한 열쇠(축 경로). `leafBirths[i]` 와 자리로 짝이다
         missing     못 찾은 nodeId · 열쇠 칸이 없는 마디 — **빈 값으로 안 메꾼다**
         twins       `leafBirths` 안에서 **겹치는 값**(쌍혹). 이 값으로 지우면 둘 다 지워진다
       ★ 여러 마디를 주면 **겹치는 잎은 한 번만** 낸다(`leafKeys` 로 추린다). 위·아래 마디를
         같이 고르면 위쪽 잎이 두 번 세어져 「지운 잎보다 더 많이 사라지는」 일이 난다.
       ⚠ 접근자가 없거나 옛 plant_grow(열쇠 칸이 없는 것)면 **null 이다.**
         0 이나 빈 배열로 메꾸지 않는다 — 빈 배열은 「딸려 갈 잎이 없다」는 **거짓말**이고,
         그러면 호출부가 아무 잎도 안 지운 채 「지웠다」고 여긴다(이 파일의 규약, cuttableNodes 참고).
       ⚠ 삽수를 모주로 자를 때(`propagation.cuttableNodesOfCutting`)의 마디는 여기 없다 —
         그 마디는 코어가 자기 장부에서 만든 것이고 growth 의 트리에 없다. `missing` 으로 나온다. */
    leafKeysOfNodes(nodeIds) {
      const f = fn('cuttableNodes');
      if (!f) return null;
      let list = null;
      try { list = f(); } catch { return null; }
      if (!Array.isArray(list)) return null;
      /* 열쇠 칸을 내는 plant_grow 인가. 하나도 없으면 옛 파일이다 — 지어내지 않고 null. */
      const hasKeys = (n) => !!n && Array.isArray(n.leafBirths) && Array.isArray(n.leafKeys)
        && n.leafBirths.length === n.leafKeys.length;
      if (!list.some(hasKeys)) return null;

      const want = (Array.isArray(nodeIds) ? nodeIds : [nodeIds])
        .filter(x => typeof x === 'string' && x);
      const byId = new Map();
      for (const n of list) if (n && typeof n.nodeId === 'string') byId.set(n.nodeId, n);

      const leafBirths = [], leafKeys = [], missing = [], seen = new Set();
      for (const id of want) {
        const n = byId.get(id);
        if (!hasKeys(n)) { missing.push(id); continue; }
        for (let i = 0; i < n.leafKeys.length; i++) {
          const k = n.leafKeys[i];
          if (seen.has(k)) continue;                 // 겹치는 마디를 같이 골랐다 — 잎은 한 장이다
          seen.add(k);
          leafKeys.push(k); leafBirths.push(n.leafBirths[i]);
        }
      }
      const cnt = new Map();
      for (const b of leafBirths) cnt.set(b, (cnt.get(b) || 0) + 1);
      const twins = [...cnt.entries()].filter(([, c]) => c > 1).map(([b]) => b);
      return { nodeIds: want, leafBirths, leafKeys, missing, twins };
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

    /* ★★ **잎 자람의 눈금** (2026-08-26 · 박사님 *"그루값은 «자란 정도에 따라» 달리 값을 책정한다"*)
       반환 `{ matSpan, stageYoung, stageMid, spawnStep, seedEnd, petGrow }` 또는 **null**.

       ⚠ 왜 이어야 하나 — 「자란 정도」를 셈하려면 **셋이 다 있어야** 한다:
```
         leafStats().growthDays    지금 T
         ★ leafStageParams().matSpan  나눌 폭      ← 이것이 «안 나와 있었다»
         leafState()[].leafBirth   잎마다 태어난 때
         ⇒ leafM = clamp01((T − leafBirth) / matSpan)     (plant_grow §leafM — 렌더러가 쓰는 그 값)
```
       ⇒ ★ 실측(`tools/probe_leafm.mjs`)이 그 자리에서 멈췄다 — 「leafStageParams: false」.
       ⚠ 못 읽으면 **null 이다. 값을 지어내지 않는다** — `leafStats`·`cuttableNodes` 와 같은 규약.
         0 이나 1 로 메꾸면 「다 안 자랐다」나 「다 자랐다」가 되어 **그루값이 통째로 틀린다.**
       ⚠⚠ 그리고 이 창구는 **값을 안 정한다.** 「어떻게 비례할까」는 부르는 쪽 몫이다. */
    /* ★★★ **잎마다 「달렸나」와 「얼마나 자랐나」** (2026-08-26 · [growth] `5d707e4`)
       반환 `[{ leafBirth, onPlant, leafM }]` 또는 접근자가 없으면 **null**.

       ⚠⚠ 왜 이 창구여야 하나 — **여기 말고는 «못 잰다»**:
         · 「달렸나」의 정본은 `g = ageOf(day)` 로 재는데, `g` 는 «곡선 변환»이라
           `leafStats().growthDays`(= day) 와 **같지 않다.** 내가 그 둘을 같다고 여겨
           leafM 을 손으로 셈했다가 **틀린 값을 하루 썼다**(2026-08-26 물림).
         · ⇒ ★ 그래서 **growth 가 «거기서 재서» 넘긴다.** 이 파일은 곡선을 몰라도 된다.

       ★ 거를 때는 **`onPlant === true`** 를 쓴다. ⛔ **`leafM > 0` 으로 거르면 안 된다** —
         「아직 안 난 잎」과 「오늘 «막 난» 잎」이 **둘 다 leafM 0** 이라 «갈리지 않는다».
         그 함정이 이 값이 생긴 까닭이다.
       ⚠ 목록에 «없는» leafBirth 는 `onPlant` 가 undefined 라 자연히 걸러진다(안전한 쪽).
       ⚠ 못 읽으면 **null 이다.** 빈 배열로 안 메꾼다 — 빈 배열은 「잎이 하나도 안 달렸다」가 된다. */
    leafOnPlant() {
      const f = fn('leafOnPlantAll');
      if (!f) return null;
      const r = f();
      return Array.isArray(r) ? r : null;
    },

    leafStageParams() {
      const f = fn('leafStageParams');
      if (!f) return null;
      const p = f();
      return (p && typeof p === 'object' && !Array.isArray(p)) ? p : null;
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
    /* ★★ 2026-08-17 — `opt.grades` 를 주면 줄마다 **무늬 등급**(`grade`)을 얹어 낸다.
       ------------------------------------------------------------
       확정문 §5 가 *"`leafState` · 세이브 · 3D 스킨 고르기가 **같은 값 하나**를 봐야 한다"*
       고 못 박았다. 그런데 growth 의 `varieStateAll()` 은 **참·거짓**만 낸다 — 종류가 없다.
       (`plant_grow.html` 의 `VARIE_STATE` 가 그 모양이고 그 파일은 이 창 것이 아니다.)
       ⇒ 그래서 **종류는 코어 장부**(`pot.leafGrades` · shop.js §⑥-3)가 들고, 여기서 **합친다.**
         합치는 자리가 하나라야 방(room_view)과 값(shop)이 같은 줄을 본다.
       ⚠ 여기서 등급을 **지어내지 않는다.** 장부에 없는 잎은 `grade: null` 이다 —
         「무늬인데 등급은 아직 모른다」가 실제로 있는 상태다(빛을 못 잰 자리).
       ⚠ 안 주면 예전 그대로다(`grade` 칸 자체가 안 붙는다). 옛 호출부가 안 깨진다.
         grades  `{ [leafBirth]: 'sanban'|'halfmoon'|'fullmoon' }` */
    /* ★★★ 2026-08-17 — 줄마다 **잎의 유일한 이름표**가 붙는다 (박사님 *"각각 따로 자라야지"*).
       ──────────────────────────────────────────────────────────────────────
       ── 설명 먼저 ──────────────────────────────────────────────────────────
       잎은 **이미 각각 따로 자란다**(축이 따로고 무늬 굴림도 따로다). 문제는 **이름표**였다.
       이 함수가 합치는 세 접근자가 전부 `leafBirth` 로만 적혀 있어서, **쌍혹**(혹 하나에서
       가지가 둘 나는 것)에서 같은 날 난 두 잎이 **한 줄을 나눠 쓴다.** 그 줄에 「잘렸다」를
       찍으면 **안 자른 쌍둥이까지 사라진다**(실측 56판 중 25판 · cutleaf-to-plan §5).
       ⇒ `plant_grow §leafAxisKeys()` 가 내는 축 경로를 여기서 **줄에 얹는다.**
         그 값은 `cuttableNodes().leafKeys` 와 **같은 값**이다(같은 `axisPathsOf` 가 짓는다).

       ── 붙는 칸 둘 (기존 칸은 하나도 안 없앴다) ────────────────────────────
         `leafKeys: string[]`  이 줄을 나눠 쓰는 잎들의 이름표 **전부**. 보통 길이 1,
                               **쌍혹이면 2 이상**이다. 아직 안 난 잎이면 **빈 배열**이다.
         `leafKey:  string|null`  줄이 잎 한 장을 가리킬 때 그 이름표. **못 가르면 `null`** —
                               `null` 은 「이 줄 하나로는 어느 잎인지 모른다」는 정직한 답이다.
                               0 이나 아무 값으로 메꾸지 않는다(이 파일의 규약).
       ⚠ **줄 수는 안 바뀐다**(기본값). 늘리면 `shop.js §assignPotLeafGrades` 가 줄 **차례**로
         잎 번호를 매기므로(`leafNo = i + 1`) 프롤로그 못박기가 통째로 밀린다 —
         그루 값이 조용히 달라진다. 그래서 **늘리는 것은 `opt.perLeaf` 로만** 연다.

       ── `opt.perLeaf` — **잎 한 장에 한 줄** ───────────────────────────────
         `leafState({ perLeaf:true })` 면 쌍혹 줄이 잎 수만큼 갈라지고 `leafKey` 가 **전부 유일**하다.
         갈라진 줄은 나머지 칸(`varie`·`matured`·`fade`·`dropped`·`grade`)을 **그대로 복사**한다 —
         정본 장부가 `leafBirth` 로만 적혀 있어 쌍둥이별 값이 **애초에 없기 때문**이다.
         지어내지 않고 「같은 값을 나눠 쓰고 있다」를 있는 그대로 낸다.
       ⚠ 이름표를 못 내는 옛 `plant_grow`(=`leafAxisKeys` 가 없다)면 `perLeaf` 는 **null** 이다.
         빈 배열도 옛 모양도 아니다 — 갈라 달라고 했는데 못 갈랐으면 그렇다고 말해야 한다. */
    leafState(opt = {}) {
      const fv = fn('varieStateAll'), fm = fn('matStateAll'), fh = fn('leafHealthAll');
      if (!fv && !fm && !fh) return null;
      const grades = (opt && opt.grades && typeof opt.grades === 'object') ? opt.grades : null;
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
      const list = [...out.values()].sort((a, b) => a.leafBirth - b.leafBirth);
      /* ★ 등급을 얹는다. **무늬가 아닌 잎에는 안 얹는다** — 민무늬 잎에 등급이 붙어 있으면
         화면이 그것을 그리려 들고, 그러면 값과 화면이 그 자리에서 갈린다. */
      if (grades) for (const r of list) r.grade = (r.varie && grades[r.leafBirth]) || null;

      /* ★★ 이름표를 얹는다 (위 §leafKey). 못 내는 옛 plant_grow 면 칸 자체가 안 붙는다. */
      const keysOf = leafKeyIndex(fn);
      if (keysOf) for (const r of list) {
        const a = keysOf.get(r.leafBirth) || [];
        r.leafKeys = a.slice();
        r.leafKey = a.length === 1 ? a[0] : null;   // 쌍둥이거나 아직 안 난 잎이면 못 가른다
      }
      if (!opt.perLeaf) return list;
      if (!keysOf) return null;                     // 갈라 달라고 했는데 못 가른다 — 지어내지 않는다
      const per = [];
      for (const r of list) {
        const a = r.leafKeys || [];
        if (!a.length) { per.push(r); continue; }   // 아직 안 난 잎 — 축이 없어 이름표도 없다
        for (const k of a) per.push({ ...r, leafKey: k });
      }
      return per;
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
