/* ============================================================
   game/propagation.js — 삽수(번식) (core 소유) · 2026-08-03 신설
   ------------------------------------------------------------
   정본: docs/propagation.md. 여기 있는 것은 그 문서의 §1·§3·§5 를 코드로 옮긴 것뿐이고,
   숫자는 전부 그 문서에 근거가 적혀 있다. **여기서 새 숫자를 만들지 않는다.**

   ★ 이 파일이 지키는 선 셋. 나머지 결정은 전부 여기서 나온다.

     ① **삽수는 지어낸 개체가 아니다.** 어느 마디를 잘랐고 그 조각이 잎을 몇 장 품고 있었는지는
        **모주에서 읽어 온 값**이라야 한다. 코어가 잎 수를 계산하면 그 순간 캐논이 둘로 갈린다
        (state.js 머리말 — "생장 나이·잎 수 → growth. 코어는 읽기만 한다").
        그래서 `takeCutting` 은 마디 목록을 **받아야만** 돌고, 없으면 던진다.

     ② **형태는 여기서 안 그린다.** plant_grow.html 은 한 그루 전용이라
        (docs/handoff/growth-multiplant-design.md) 두 번째 개체를 굴릴 창구가 없다.
        삽수는 **논리로만** 돈다 — 날짜·상태·물려받은 것. 3D 는 `cuttingViewModel()` 이
        낸 표시 모형을 방 뷰가 그리면 되고, 그 배선은 이 창 몫이 아니다.
        ★ 그래서 **삽수는 S.pots 로 승격되지 않는다.** 다개체 리팩터 전에 승격시키면
          하루 진행이 안 되는 유령 화분이 생긴다 — `promoteToPot` 이 그 자리에서 던진다.

     ③ **조용히 사라지지 않는다.** 죽음은 경고 → 기한 → 소멸 순서고, 매 단계가 로그다.
        경고 없이 사라진 삽수는 버그로 본다(tools/test_propagation.mjs 가 그걸 본다).

   ★ THREE 를 쓰지 않는다. 자리(at)는 place.js 의 것 하나를 그대로 쓴다 —
     화분·콩나물 시루와 **같은 불변식**이다(추천 자리 위면 안정 id, 벗어나면 `free:{id}`).
============================================================ */
import { resolvePlacement, atFromSlot, isFreeSlotId, inRoom } from './place.js';
import { useStock, assertStockAll, shopOf, CATALOG,
/* ★★ 2026-08-17 — 무늬 **등급**(종류)은 전부 shop 이 읽는다.
   ⚠ 정본은 `data/balance/varie_grades.json` 이고 읽는 자리는 `shop.js` 한 곳이다.
     여기서 갈래 이름('sanban' 등)이나 확률을 다시 적지 않는다(확정문 §5 ★). */
         varieGradeFromLight, varieLightStepOfBand, varieGradeRules } from './shop.js';
/* ★ 체력 — 하루에 돌볼 수 있는 양. **규칙도 값도 전부 그쪽 모듈이 갖는다**(docs/stamina.md).
   여기서 새 비용을 만들지 않는다 — `ACT_COST.cut` · `ACT_COST.repot` 을 그대로 쓴다.
   ⚠ 이 import 는 한 방향이다: propagation → stamina. stamina 는 아무것도 안 부른다. */
import { canAct as canActStamina, spend as spendStamina } from './stamina.js';

/* ★ 2026-08-17 — `cutting/1`(키메라 세 갈래) → **`cutting/2`**(빛이 정한다).
   ⚠ 이 값으로 **막지 않는다.** 옛 판(`cutting/1`)이 그대로 열려야 하고, 실제로 열린다 —
     아무도 이 문자열을 견주지 않는다(save.js 는 적어만 둔다). 바꾼 까닭은 하나다:
     세이브를 열어 봤을 때 「어느 규칙으로 만들어진 삽수인가」가 눈에 보여야 한다. */
export const PROPAGATION_SCHEMA = 'cutting/2';

/* ============================================================
   ① 자를 수 있는 마디 — 캐논의 stem 등급 (docs/propagation.md §1)
   ------------------------------------------------------------
   petiole(가는 잎자루)·잎 하나만으로는 새 생장점을 못 낸다. 실제 몬스테라도 그렇다.
   ★ 이 목록은 캐논(byeot_growth_chart_인계.md)의 이름을 그대로 쓴다 — 코어가 새로 짓지 않는다.
============================================================ */
export const CUTTABLE_STEMS = Object.freeze(['pink', 'thick', 'main']);
export const isCuttableStem = (s) => CUTTABLE_STEMS.includes(s);

/* 마디 하나의 계약. **모주에서 읽어 온 것**이라야 한다 — 코어가 채우는 칸이 하나도 없다.
     nodeId           그 마디를 다시 가리킬 수 있는 이름(캐논의 축·마디 식별자)
     stem             petiole | pink | thick | main
     leaves           그 마디부터 위(생장점 방향)로 딸려 나오는 잎 수
     variegatedLeaves 그중 **이미 무늬로 난** 잎 수 (물리적으로 같은 잎이 딸려간다)
     growthDays       그 조각이 자란 유효 생장일 (growth 소유 값. 코어는 적어만 둔다)
   ⚠ 빠진 칸을 0 으로 메꾸지 않는다 — 0 으로 메꾸면 "잎 없는 삽수"가 조용히 생긴다. */
export function assertCutNode(node, path = 'node') {
  if (!node || typeof node !== 'object' || Array.isArray(node))
    throw new Error(`[삽수] ${path} 가 마디 객체가 아닙니다 — 모주에서 읽은 마디를 넘겨 주세요`);
  if (typeof node.nodeId !== 'string' || !node.nodeId)
    throw new Error(`[삽수] ${path}.nodeId 가 비어 있지 않은 문자열이 아닙니다: ${node.nodeId}`);
  if (typeof node.stem !== 'string' || !node.stem)
    throw new Error(`[삽수] ${path}.stem 이 없습니다 — 캐논의 stem 등급(petiole/pink/thick/main)이 필요합니다`);
  for (const k of ['leaves', 'variegatedLeaves']) {
    if (!Number.isInteger(node[k]) || node[k] < 0)
      throw new Error(`[삽수] ${path}.${k} 가 0 이상의 정수가 아닙니다: ${node[k]} — ` +
                      `모르는 값을 0 으로 메꾸지 않습니다`);
  }
  if (node.variegatedLeaves > node.leaves)
    throw new Error(`[삽수] ${path}: 무늬 잎 ${node.variegatedLeaves}장이 전체 잎 ${node.leaves}장보다 많습니다`);
  if (node.growthDays != null && (!Number.isFinite(node.growthDays) || node.growthDays < 0))
    throw new Error(`[삽수] ${path}.growthDays 가 0 이상의 숫자가 아닙니다: ${node.growthDays}`);
  return node;
}

/* ============================================================
   ② 두 갈래 — 확정 수치 (docs/propagation.md §3)
   ------------------------------------------------------------
   ★★★ 2026-08-17 박사님이 **혹 일수를 다시 정하셨다.**
     원문: *"각 줄기에 따른 영향이니까 둘 다 영향은 받겠지. 다만 **잎이 1장으로 쪼개야
     수경이 가능**하도록 해서 혹이 빠르게 올라오도록"*

     |            | 뿌리 | 혹(다음 마디) | 죽나 |
     |---|---|---|---|
     | 물꽂이     |  12 (그대로) | **32 → 20** | 죽을 수 있다(그대로) |
     | 화분 직삽  |  24 (그대로) | **없음 → 45** | 안 죽는다(그대로) |

   ══ 왜 20 과 45 인가 — 씨앗과 견준 값이다 (박사님과 같이 재서 고른 값) ═══════
   몬스테라 씨앗은 **1,500원 · 배송 1일 · 첫 잎 유효 30일**이다(`shop.CATALOG.monstera_seed` ·
   `growth_adapter` 도착 유효 45). 삽수를 뜰 이유가 생기려면 **씨앗보다 빨라야** 한다.
     · 물꽂이 20일 → 씨앗(30일)보다 10일 빠르다. **뜰 이유가 생긴다.**
     · 화분 45일 → 씨앗보다 15일 느리다. 「느리지만 죽지 않는 길」로 남는다(25일 차이).
   ⚠ 박사님이 *"30일 정도 차이(30/60)?"* 라 하셨는데 **60일은 씨앗의 두 배**라 화분이
     죽은 선택이 된다. 그래서 20/45 를 권했고 박사님이 받으셨다.

   ══ 무엇이 안 바뀌었나 ═════════════════════════════════════════════════════
     rootDays 12   `growth_tuning.mature_prob.gauge_days` 와 같은 12. 그대로다.
     직삽     24   12 × 2. 물꽂이보다 **정확히 뿌리내림 기간 하나(12일)만큼** 느리다. 그대로다.
     유예     8 / 초보 16. 그대로다.

   ⚠⚠ **기한이 같이 움직였다.** 기한 = 혹 + 유예이므로 **40 → 28**(초보 48 → 36)이다.
     예전 주석은 *"40 은 캐논 `P.spawnStep`(마디 주기)라 마디 주기 한 바퀴를 넘기면 죽는다"*
     였다. **그 근거는 이제 안 선다** — 혹이 20일로 당겨졌으므로 기한도 같이 당겨진다.
     ★ 새 근거는 **혹이 난 뒤의 유예 8일이 그대로라는 것** 하나다. 「혹이 나면 8일 안에
       분갈이해라」가 규칙이고, 혹이 언제 나든 그 8일은 안 변한다. 근거가 하나로 줄었다.

   ★★ **물꽂이는 잎 1장이라야 한다** (아래 §WATER_LEAF_MAX). 잎이 여러 장이면 화분만이다.
     이건 확률이 아니라 **조건**이다 — 박사님 원문 *"잎이 1장으로 쪼개야 수경이 가능"*.

   ★ 뿌리내리는 동안은 **두 갈래 다 빛과 무관하다.** 뿌리는 광합성이 아니라 저장양분으로 낸다.
     혹도 마찬가지다 — 날짜만 센다. 빛이 걸리는 곳은 **새 잎**과 **무늬 확률**뿐이고,
     그게 docs/propagation.md §3 의 "등은 증식의 세금이 아니다" 를 지키는 자리다.
============================================================ */
export const METHODS = Object.freeze({
  water: Object.freeze({
    id: 'water', ko: '물꽂이',
    rootDays: 12,
    nodeDays: 20,          // ★ 2026-08-17 — 32 → 20 (씨앗 30일보다 빠르게)
    graceDays: 8,          // 혹이 난 뒤 분갈이 유예 (자유·고수)
    graceDaysNovice: 16,   // ★ 초보(스토리)는 두 배 — 아래 §초보 참고
    canDie: true,
    /* ★ 잎 몇 장까지 이 방식으로 갈 수 있나. `null` 이면 제한 없다.
       물꽂이는 **1장뿐**이다(박사님 2026-08-17). 조건이지 확률이 아니다. */
    maxLeaves: 1
  }),
  pot: Object.freeze({
    id: 'pot', ko: '화분 직삽',
    rootDays: 24,
    nodeDays: 45,          // ★ 2026-08-17 — 없음 → 45 (씨앗 30일보다 느린 안전한 길)
    graceDays: null,
    graceDaysNovice: null,
    canDie: false,         // ★ 기한이 없다. 느린 대신 안전하다 — 혹이 나도 안 죽는다
    maxLeaves: null        // 여러 장짜리 조각은 화분으로만 간다
  })
});

/* ★ 물꽂이가 받는 잎 수 — 위 `METHODS.water.maxLeaves` 를 가리키는 이름 하나.
   ⚠ 숫자를 두 곳에 적지 않는다. 화면·검사가 이 이름을 읽는다. */
export const WATER_LEAF_MAX = METHODS.water.maxLeaves;

/* 그 방식이 이 잎 수를 받나. 못 받으면 **사람이 읽을 수 있는 사유**를 낸다(없으면 null). */
export function methodLeafBlock(method, leaves) {
  const m = METHODS[method];
  if (!m || m.maxLeaves == null) return null;
  const n = Number.isInteger(leaves) ? leaves : 0;
  if (n <= m.maxLeaves) return null;
  return `${m.ko}는 잎 ${m.maxLeaves}장짜리 조각만 받습니다 — 이 마디는 잎 ${n}장입니다. ` +
         `잎이 여러 장이면 ${METHODS.pot.ko}(흙)으로 심습니다`;
}

/* 용기. **방 슬롯을 차지하는 것은 용기**이고 삽수는 그 안에 산다.
   ⏸ 물꽂이 트레이(batch · 6칸 · 등급 ×0.8)는 **에셋이 없어서 이번 범위 밖**이다
      (docs/propagation.md §4 ⏸ — `container_tray_s.glb` 재사용 가능 여부가 leaf 판단 대기).
      규칙(capacity·gradeMult)은 여기 적어 두되 `takeCutting` 이 막는다 — 자리만 잡아 둔 것이다. */
/* ★★★ 2026-08-17 — **`accepts` 가 늘었다: 그 그릇에 무엇이 들어갈 수 있나.**
   ------------------------------------------------------------
   박사님: *"용도가 아니라 **거기 심어지는 거**에 따라 나뉘어야지."*
   ⇒ 그릇에 「삽수용/씨앗용」 딱지를 붙이지 않는다. 대신 **그릇마다 받는 것**을 적어 두고,
     [심기] 팝업의 목록을 그 규칙이 좁힌다(`state.plantableInto`).
       검은 모종포트 : 씨앗도 삽수도 들어간다 — 흙 그릇이니 당연하다
       유리 수경병   : **삽수만** — 물에 씨앗을 넣을 수는 없다. 그래서 그 팝업엔 삽수만 뜬다
   ★ 이건 새 규칙이 아니라 **원래 그랬던 것을 적은 것**이다. 지금까지는 「씨앗은 화분,
     삽수는 병」이 코드 두 군데에 나뉘어 있었고 표에 없었다. 표에 있어야 화면이 물어볼 수 있다. */
export const CONTAINERS = Object.freeze({
  jar:  Object.freeze({ id: 'jar',  ko: '유리 수경병',   method: 'water', capacity: 1,
                        gradeMult: 1.0, assetId: 'pots/pot_glassjar.glb', realMaxM: 0.13, ready: true,
                        /* 상점 품목 열쇠 · 팔 때 돌아오나 (아래 ★용기값 참고) */
                        itemId: 'jar',  returnsOnSale: true,
                        accepts: Object.freeze(['cutting']) }),
  tray: Object.freeze({ id: 'tray', ko: '물꽂이 트레이', method: 'water', capacity: 6,
                        gradeMult: 0.8, assetId: null,                    realMaxM: 0.36, ready: false,
                        itemId: null,   returnsOnSale: false,
                        accepts: Object.freeze(['cutting']) }),
  soil: Object.freeze({ id: 'soil', ko: '검은 모종포트', method: 'pot',   capacity: 1,
                        gradeMult: 1.0, assetId: null,                    realMaxM: 0.12, ready: true,
                        itemId: 'pot',  returnsOnSale: false,
                        accepts: Object.freeze(['seed', 'cutting']) })
});

/* ============================================================
   ★★ 용기값 — 자르는 데 **돈과 이틀**이 든다 (2026-08-03)
   ------------------------------------------------------------
   박사님 확정: *"꾸준수입도 가능하지. 삽수 팔거나 하는 걸로."*
   그러려면 삽수 한 개의 **순액**이 나와야 하고, 순액이 나오려면 원가가 실제로 걸려야 한다.
   예전에는 `opt.container` 가 그냥 문자열이라 병이 **공짜로 무한히** 나왔다 —
   그 상태로 "삽수를 팔면 얼마 남나"를 재면 그 답은 거짓이다.

     · 자르기 = 용기 재고 하나를 **쓴다**(`shop.useStock`). 없으면 던진다.
       용기는 배송 2일이라(`shop.CATALOG`) **미리 시켜 둬야** 자를 수 있다.
     · 유리 수경병은 팔 때 **돌아온다**(`returnsOnSale`) — 물꽂이는 병에서 뽑아 보내지
       병째 보내지 않는다. 그래서 첫 병만 7,000원이고 두 번째부터는 시간만 든다.
     · 검은 모종포트는 흙째 나가므로 **안 돌아온다.** 분갈이(`repotCutting`)도 포트를 쓴다.

   ⚠ 재고를 안 보고 자르는 길은 남기지 않았다. 하나라도 열어 두면 그 길로 경제가 샌다.
============================================================ */
export function containerItemOf(container) {
  const c = CONTAINERS[container];
  return c ? c.itemId : null;
}
export function containerCostWonOf(container) {
  const it = CATALOG[containerItemOf(container)];
  return it ? it.listWon : 0;                 // 참고용(정가). 실제 결제는 shop.buyPriceOf 다
}

/* 용기를 재고로 돌려놓는다. `shop.useStock` 의 반대짝이고, 여기서만 쓴다 —
   상점이 "판 것"으로 세지 않게 값은 안 건드린다(돌아온 것은 수입이 아니다). */
export function returnContainer(S, itemId, qty = 1) {
  if (!itemId || !S) return 0;
  const shop = shopOf(S);
  shop.stock[itemId] = (shop.stock[itemId] || 0) + qty;
  return shop.stock[itemId];
}

/* ============================================================
   ★★ 초보(스토리)에서 죽는 것이 맞는가 — 결론과 근거 (박사님 질문에 대한 답)
   ------------------------------------------------------------
   확정된 원칙: *"초보 모드에서는 잎이 바래도 안 죽는다"* (docs/story_arc.md §0).
   그런데 삽수는 기한을 넘기면 죽는다. **이 둘은 모순이 아니다.** 갈리는 지점이 셋이다.

     ㉮ **약속의 대상이 다르다.** "안 죽는다"는 *심어서 키우던 그루*에 대한 약속이다.
        자리를 잘못 골라도 되돌릴 수 있게 하려는 것이고, 그래서 `health.drop_enabled=false` 다.
        삽수는 아직 그루가 아니라 **플레이어가 방금 자기 손으로 만든, 뿌리도 없는 조각**이다.

     ㉯ **죽는 사유가 환경이 아니라 행동이다.** loop.js 가 `band==='critical'` 로 죽이는 것을
        금지한 이유는 "반지하 산세는 맑음↔흐림으로 밴드를 매일 오가므로 운으로 죽는다" 였다.
        여기는 운이 없다 — **분갈이라는 행동 하나**를 안 한 것이고, 32일 동안 예고된다.
        운으로 죽으면 배울 게 없지만 안 해서 죽으면 다음엔 한다.

     ㉰ **죽음이 있는 길은 선택지이고, 안 골라도 게임이 굴러간다.**
        화분 직삽(24일·기한 없음)이 항상 열려 있다. 겁나면 느린 길을 고르면 되고,
        그래도 엔딩까지 간다. 이게 초보 원칙을 안 깨는 결정적인 이유다 —
        **강요된 사망이 아니라 값을 치르고 사는 속도**다.

   그 위에 초보 완충 넷을 얹는다:
     ① 유예가 8일이 아니라 **16일** (기한 40일 → 48일)
     ② 경고가 **혹 발생 즉시 · 유예 절반 · 마지막 3일 매일** — 최소 5회
     ③ 죽기 전이면 **언제든 분갈이하면 산다**(되돌릴 수 있다). 죽은 뒤에는 못 되돌린다
     ④ **모주는 절대 안 죽는다** — 삽수 하나를 잃어도 원본과 계통은 남는다.
        손실이 "삽수 1개 + 그 32일"로 끝나고 진행이 막히지 않는다
============================================================ */
export function isNoviceMode(S) {
  /* 스토리 모드 **전체**가 초보다(docs/story_arc.md §0). 코어에서 그 신호는 둘이다:
       · sim.mode === 'novice'
       · 스토리가 아직 도는 중이다 — 반지하 튜토가 켜져 있고 ④ 엔딩을 아직 안 봤다

     ★★ 2026-08-05 정정 — 예전에는 `!S.tutorial.movedOut` 이었다. 그러면 **② 탈출에서
       초보가 꺼진다.** 그런데 story_arc.md §0 이 못 박은 범위는 *"①반지하 → ②탈출 →
       ③원룸 → ④내 집 마련 엔딩 ← 여기까지"* 다. ③④ 가 통째로 빠져 있었던 것이고,
       그 판에서는 이사하는 순간 삽수 유예가 16일 → 8일로 줄고 모주를 끝내는 자르기가
       열린다(§키메라·§2). **초보는 죽지 않는다는 약속이 이사 버튼에서 깨졌다.**
     ★ 새 이벤트 체계를 만들지 않았다 — `S.story.ending.doneOnDay` 한 칸을 읽을 뿐이다.
       ⚠ 여기서 oneroom.js 를 import 하지 않는다: 그쪽이 propagation 을 부르므로 순환이 된다
         (shop ↔ propagation 과 같은 규약). 대신 **읽기만** 한다.
       ⚠ 둘이 갈리면 초보가 반씩 켜진다 — tools/test_oneroom.mjs 검사 F 가 등식을 고정한다. */
  if (!S) return false;
  if (S.sim && S.sim.mode === 'novice') return true;
  if (!(S.tutorial && S.tutorial.enabled)) return false;
  const end = S.story && S.story.ending;
  return !(end && end.doneOnDay != null);
}

export function graceDaysOf(method, novice) {
  const m = METHODS[method];
  if (!m || !m.canDie) return null;
  return novice ? m.graceDaysNovice : m.graceDays;
}

/* ★★ 시계가 언제 시작했나 — 「자른 날」이 아니라 **「용기에 들어간 날」**이다 (2026-08-17).
   ------------------------------------------------------------
   ⚠ 자르기와 담기가 두 걸음으로 갈리면서(§⑤-2) 이 둘이 **더 이상 같은 날이 아니다.**
     가방에 열흘 두었다가 병에 꽂으면 자른 날은 열흘 전이고 물꽂이는 오늘 시작한다.
   ⚠ 그대로 `cutOnDay` 를 쓰면 **기한이 열흘 앞당겨진다** — 넣자마자 이미 지난 기한이
     붙어 그 삽수가 첫날 죽는다. 그래서 시계의 기준일을 따로 든다.
   ★ 옛 세이브·옛 호출부(자르면서 바로 담는 길)에는 이 칸이 없거나 `cutOnDay` 와 같다 —
     그때는 값이 한 톨도 안 달라진다(`tools/test_cutcontainer.mjs` 검사 ⑧ 이 그걸 고정한다). */
export function clockDayOf(c) {
  return Number.isFinite(c && c.clockOnDay) ? c.clockOnDay : (c && c.cutOnDay) || 0;
}

/* 기한(절대 게임일). `null` 이면 기한 자체가 없다(화분 직삽). */
export function deadlineDayOf(c, novice) {
  const m = METHODS[c.method];
  if (!m || !m.canDie) return null;
  return clockDayOf(c) + m.nodeDays + graceDaysOf(c.method, novice);
}

/* ============================================================
   ③ 무늬 상속 — **빛이 정한다** (2026-08-17 박사님 확정으로 전면 개편)
   ------------------------------------------------------------
   박사님 원문: *"응 어렵게 하고 있었네 니가. 이건 **게임이니까 좀 단순화**하자."*
   · *"2. 마디에 잎수에 따른 확률은 생각하지말자."*
   · *"다 쪼개서 … 변이인 경우 그 **변이 확률을 확 올리자**(천정 80%)"*
   · *"**50% 오르고 빛 조건에 따라서 20~80퍼** 왔다갔다 하게 하는 게 어떨까"*

   ══ ⛔ 없앤 것 — **마디의 잎 수로 굴리던 세 갈래** ═══════════════════════════
   아래 §키메라(2026-08-04)가 `w = 무늬잎÷잎` 으로 **원복 / 유지 / 고스트**를 굴렸다.
   **그 굴림이 통째로 빠진다.** 자를 때 주사위를 안 던지고, **고스트로 죽는 일이 없다.**

   ★ 그런데 **함수는 안 지웠다.** 왜인지 적어 둔다(START-HERE §2 규칙 2 — 「지금 그렇다」와
     「그렇게 하기로 했다」를 갈라 적는다):
       ① **옛 세이브에 `lineage` 가 적혀 있다.** `save.js §packCutting` 이 그 칸을 읽고 쓰고,
          그 판이 안 열리면 이번 일이 실패다. 값을 읽으려면 이름이 살아 있어야 한다.
       ② `chimeraOddsOf` 는 **순수 함수**다. 부르는 데가 없으면 아무 일도 안 한다 —
          지우는 쪽의 값어치가 「검사 하나가 깨지는 것」밖에 없다.
       ③ 되살릴 문을 남기는 것이 이 저장소의 수법이다(`rules.cropOverlapTiredEnabled` 선례).
     ⇒ **부르는 데를 다 걷었고**(`takeCutting` · `stepCuttings` · `cuttingSnapshot`),
       함수마다 **「2026-08-17 이 대체했다」**를 머리에 적었다. 게임은 이것들을 안 탄다.

   ══ ★ 새 규칙 — **변이 줄기를 떼면 그 개체의 변이 확률이 빛으로 정해진다** ═══════
       | 자리     | 변이 확률 |
       |---|---|
       | 어두움   | **20%** |
       | 중간     | **50%** |
       | 밝음     | **80%** |

   ★ **밝을수록 높다.** 내가 그 방향을 권했고 박사님이 받으셨다. 까닭 셋:
     ① 실제로 무늬종은 밝은 데서 무늬가 유지되고 어두우면 초록으로 돌아간다
     ② **이 게임의 뼈대가 「빛이 주인공」**이다
     ③ 밝은 칸을 **무순**이 이미 원한다 — 육종까지 끼면 **자리 다툼이 셋**이 된다

   ══ ★★ 어느 밝기 축을 쓰나 — **몬스테라 축이 이미 있다** (재서 정했다) ═══════════
   박사님 지시: *"새 문턱을 만들지 마라 — 어느 축을 쓸지 재서 정하고 까닭을 적어라
   (콩나물 축 0.3/1.0 · 무순 축 0.35/0.15 중 어느 쪽인가, 아니면 몬스테라 전용 축이 있나)."*

   ⇒ **몬스테라 전용 축이 이미 있다.** `engine/daily_light.judgeDLI` 의 밴드 일곱이고,
     그 임계값은 `data/growth_tuning.json` 의 몬스테라 사본이다:

       die 0.5 · survive 1.2 · min 3 · best_lo 5 · best_hi 11 · max 16
       critical <0.5 · poor <1.2 · stagnant <3 · slow <5 · best ≤11 · good ≤16 · over >16

   ★★ **채소 축은 못 쓴다 — 재 보면 상수가 된다.** 콩나물 경계는 0.3·1.0 이고 무순은
     0.15·0.35 인데, **몬스테라가 살 수 있는 가장 어두운 자리도 이미 그 위**다
     (몬스테라 `min` = 3 DLI). 반지하 창턱만 해도 3.77~4.8 DLI 다.
     ⇒ 채소 축으로 재면 **몬스테라가 서는 모든 칸이 「밝음」**이 되어 축이 아무 일도 안 한다.
       「빛으로 정해진다」가 「언제나 80%」가 된다. 그래서 안 쓴다.

   ★★ **몬스테라 축의 셋 가르기는 이미 코어에 있다.** `loop.js §NO_GROW_BANDS` 가
     `critical·poor·stagnant` 를 「안 자라는 빛」으로 묶어 두었다. 그 금을 그대로 쓴다:

       어두움 = critical · poor · stagnant   (안 자라는 빛 — 이미 있던 묶음)
       중간   = slow                          (`min`~`best_lo`. 반지하 창턱 4.8 이 여기다)
       밝음   = best · good · over            (`best_lo` 위 — 등을 켜야 닿는다. 선반 11.8 이 여기다)

   ⚠ `over`(과광)를 **밝음에 넣었다.** 무늬 유지를 좌우하는 것은 빛의 세기 자체이고,
     과광의 벌은 **잎이 타는 것**(growth 소유)이라 계통이 다르다. 「밝을수록 높다」가
     중간에 꺾이면 자리 고르기가 설명이 안 된다.
   ★ 새 문턱을 하나도 안 만들었다 — 위 세 줄은 **있는 밴드 이름을 묶은 것**뿐이다.

   ══ ★ 어느 순간에 정해지나 — **뿌리를 낸 날** (판단필요 · §보고서) ═════════════
   박사님 말씀은 *"변이 줄기를 **떼면**"* 이다. 그런데 **자르는 순간에는 빛을 잴 수가 없다** —
   `takeCutting` 은 화면이 부르고 조도 계약은 `loop.js` 가 쥐고 있다(`opt.lightOf`).
   화면(`game.html`·`ui.js`)은 이번 창의 ⛔ 목록이라 인자를 하나 더 받게 만들 수가 없다.
   ⇒ **뿌리내리는 그 날** 그 자리의 밴드로 정한다. 그 편이 규칙으로도 낫다:
     ① 배선이 이미 있다 — `stepCuttings(opt.lightOf)` 가 매일 그 자리의 밴드를 낸다
     ② 뽑기가 아니라 **빛에서 바로 나오는 값**이라, 「자른 뒤에 흔들어 결과를 바꾼다」는
        옛 걱정(§키메라 굴림 주석)이 성립하지 않는다. 흔들려면 **밝은 칸을 실제로 내줘야** 한다
     ③ 그래서 박사님이 원하신 **자리 다툼 셋**이 여기서 실제로 생긴다 —
        뿌리내리는 12일(물꽂이) 동안 밝은 칸 하나를 삽수에게 내주는가가 판단이 된다
   ⚠ 빛을 못 재면(하네스·자리 없음) **안 정한다.** 잴 수 있는 날까지 미룬다 —
     0 으로도 「중간」으로도 메꾸지 않는다. 모르는 것으로 벌하지도 상 주지도 않는다.

   ══ ④ 유전 — **그대로 물려받되 더 오르지 않는다** ═══════════════════════════
   박사님: *"일단 **안 오르는 걸로** 하되 **결정할 수 있게 파라메터를 넣어둬**"*
   ⇒ 자식은 부모 값을 그대로 받고, **세대마다 안 오른다.** 손잡이는 아래
     `VARIE_RULES.genRise` 이고 **기본은 0(꺼짐)** 이다.

   ══ ⑤ 무지 삽수 — **개체만 는다** ══════════════════════════════════════════
   박사님: *"무지인 경우 … 확률 상승은 상관없지. **변이인 줄기만 영향**받는 거지."*
   ⇒ 무지 마디에서 뜬 삽수는 **모주 값을 그대로** 받는다(안 오르고 **안 내린다**).
     빛도 안 본다. 얻는 것은 **속도**뿐이다 — 씨앗보다 빨리 혹이 난다.
   ★ 대가는 이미 있다: **모주의 가지 하나를 잃는다**(등급이 내려갈 수 있다). 씨앗은 모주를 안 건드린다.
============================================================ */

/* ★★ 빛 → 변이 확률. 박사님 확정 셋(20 / 50 / 80). 천장이 80% 다. */
export const VARIE_LIGHT = Object.freeze({ dark: 0.20, mid: 0.50, bright: 0.80 });
export const VARIE_LIGHT_KO = Object.freeze({ dark: '어두움', mid: '중간', bright: '밝음' });

/* 몬스테라 밴드(daily_light.judgeDLI) → 셋. **새 문턱이 아니라 있는 이름을 묶은 것**이다.
   ⚠ 여기 없는 밴드('unknown' 등)는 `null` 이다 — 모르면 안 정한다.
   ★★ 2026-08-17 — **표를 여기 안 적는다.** 무늬 등급 확률(확정문 §3)이 같은 밝기 셋을
     쓰므로 두 곳에 적으면 반드시 갈린다. 정본은 `data/balance/varie_grades.json` 의
     `lightBands` 이고 여기서는 **가리킨다** — `CATALOG.bean_seed` 가 작물 표를 가리키는
     것과 같은 규약이다(shop.js §② ★★★ "가리키는 것이라 갈릴 수가 없다"). */
export const VARIE_LIGHT_BANDS = Object.freeze({ ...varieGradeRules().lightBands });

export function varieLightStepOf(band) {
  return varieLightStepOfBand(band);
}

/* ★★ 손잡이 — 나중에 「대마다 오르게」를 켤 수 있게 남긴 문 (박사님 ④).
   ⚠ **기본은 꺼짐(0)** 이다. 켜려면 `S.rules.cuttingVarieGenRise` 에 0~1 을 적으면
     대를 이을 때마다 **남은 거리의 그만큼**이 오른다. 천장(80%)은 그래도 안 넘는다.
   선례: `rules.cropOverlapTiredEnabled` · `pantryCapWon` — 되살릴 문을 남기는 그 수법. */
export const VARIE_RULES = Object.freeze({ genRise: 0 });

export function varieGenRiseOf(S) {
  const v = S && S.rules && S.rules.cuttingVarieGenRise;
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : VARIE_RULES.genRise;
}

/* 그 자리의 빛이 정하는 변이 확률. 못 재면 `null`(안 정한다).
     band  daily_light 밴드 이름
     gen   몇 대째인가 — 손잡이가 꺼져 있으면 **아무 일도 안 한다** */
export function varieChanceFromLight(band, opt = {}) {
  const step = varieLightStepOf(band);
  if (!step) return null;
  let p = VARIE_LIGHT[step];
  const rise = Number.isFinite(opt.genRise) ? opt.genRise : VARIE_RULES.genRise;
  const gen = Number.isInteger(opt.gen) ? Math.max(1, opt.gen) : 1;
  /* ⚠ 기본은 rise = 0 이라 이 반복문이 **한 번도 안 돈다.** 켜야만 돈다. */
  for (let g = 1; g < gen && rise > 0; g++) p = p + (1 - p) * rise;
  return +Math.min(p, VARIE_LIGHT.bright).toFixed(6);
}

/* ============================================================
   ⏸ 여기서부터 §키메라 — **2026-08-17 이 위 §빛 으로 대체했다.**
   ------------------------------------------------------------
   ⚠ 아래 글과 함수는 **2026-08-04 박사님 확정**이었고 게임이 실제로 그렇게 돌았다.
     오늘 박사님이 바꾸셨으므로 **게임은 더 이상 이것을 안 탄다.** 지우지 않은 까닭은
     위 §③ 머리말의 셋(옛 세이브 · 순수 함수 · 되살릴 문)이다.
   ⚠ 새 규칙을 여기서 찾지 마라. 지금 도는 것은 위 `VARIE_LIGHT` 다.

   ══ 옛 규칙(대체됨) — 박사님 원문 ═════════════════════════════════════════
   *"삽수는 자라야지 실제와 같지. 실제도 알보가 유지될 확률도 있지만
   다시 원복될 확률도 있던데"* · *"삽수 시 이후 무늬 확률은 랜덤으로 올라가되 이전처럼
   무늬 100퍼는 아니게 천장이 있게, 그리고 올라간 확률은 유전되게"*

   ══ 예전에는 무엇이었나 ═════════════════════════════════════════════════════
   `varieChance = 모주값 × gradeMult(0.8)` — **세대마다 반드시 줄어드는 감쇠 하나**였다.
   그래서 삽수를 뜰 이유가 「지금 이 조각을 판다」밖에 없었다. 대를 이을수록 나빠지므로
   **육종이라는 행위 자체가 손해**였다. 박사님 지시는 이 방향을 뒤집으라는 것이다.

   ══ 새 규칙 — 실제 알보 몬스테라가 그렇게 번식한다 ═══════════════════════════
   알보 무늬는 색소 유전자가 아니라 **키메라**다. 생장점이 유전자가 다른 세포층으로
   겹쳐 쌓여 있고(periclinal chimera · L1/L2/L3), 겨드랑눈은 그 층에서 조직을 물려받는다.
   그래서 삽수 하나의 운명이 실제로 셋으로 갈린다 — 조사(2026-08-04)와 박사님 말씀이 같다.

     ㉮ **원복(reversion)** — 눈이 **초록 조직만** 물려받았다. 무늬가 빠지고 민짜가 된다.
        삽수에서 흔하다. 한국 시장 용어로 「무늬 퇴화」다.
     ㉯ **유지(키메라)** — 눈이 **두 조직을 다** 물려받았다. 무늬가 이어지고 짙어질 수 있다.
     ㉰ **고스트(전백)** — 눈이 **흰 조직만** 물려받았다. 엽록소가 없어 광합성을 못 한다.
        조사에서 확인: 「고스트 잎이 연달아 나면 성장점 안의 정상 세포가 죽은 것이고
        그루가 결국 죽는다」. 순수한 흰 삽수는 저장양분이 떨어지면 **살지 못한다.**
        ★ 다만 **뿌리는 낸다.** 뿌리내림은 광합성이 아니라 줄기에 든 저장양분으로 하는 일이라
          엽록소와 무관하다(조사에서 확인 — "아주 창백한 조각도 뿌리는 내지만, 스스로를
          못 먹여서 그 뒤에 멈춘다"). 그래서 고스트는 **뿌리내리고, 팔 수 있고, 그 뒤에 죽는다.**
        ★★ 그 결과 고스트의 벌은 **돈이 아니라 계통**이다 — 그 조각은 팔면 값을 받지만
          거기서 대가 끊긴다. 자를 마디를 잘못 골라도 지갑이 비지는 않는다.

   ══ 확률을 어떻게 정하나 — **자른 마디가 정한다** ═════════════════════════════
   ⚠ 먼저 정직하게: **몬스테라 알보의 원복률·전백률을 잰 자료는 세상에 없다.** 찾아봤고 없었다
     (조사 2026-08-04 — 논문도 종묘장 통계도 없고, 숫자를 적어 둔 블로그는 출처가 없다).
     그래서 **숫자를 베끼지 않고 기전에서 끌어냈다.** 기전 쪽은 자료가 있다.

   층이 둘(초록·흰)이고 눈이 그 둘을 각각 물려받나 마나로 갈린다고 보면 확률이 저절로 나온다.
   `w` = 자른 마디가 달고 있는 **무늬 잎의 비율**(= 그 자리 조직이 얼마나 희냐. 화면에 보인다).

       원복  = (1−w)²        유지 = 2·w·(1−w)        고스트 = w²

   ★ 이 셋을 **지어내지 않았다.** 층 둘을 각각 뽑는 것에서 그대로 떨어지는 값이고, 합이 1이다.
     자료가 받쳐 주는 것은 기전이다 — 겨드랑눈은 생장점의 층 구조를 물려받고(그래서 마디
     삽수가 무늬를 이어 준다), 부정아는 층을 못 물려받아 무늬가 깨진다(Marcotrigiano 1993).
   ★ **크기가 터무니없지 않다는 것도 확인된다.** 아프리칸바이올렛 부정아 실측에서 키메라로
     남은 비율이 3.7% · 30% 였다(Frontiers 2017). 우리 모델의 최대치는 `w=0.5` 의 **50%** 로
     그보다 후하다 — 마디 삽수는 부정아보다 유리하므로 방향이 맞고, 게임이 더 너그러운 쪽이다.
   ★★ 그래서 **실제 육종가의 판단이 그대로 게임이 된다** — 조사에서 확인한 조언과 같다
      (*"너무 희지도 너무 푸르지도 않은, 균형 잡힌 무늬의 잎에서 잘라라"*).
   ⚠ 다만 그 조언의 **비율(반반)은 근거가 없는 통설**이다(조사에서 확인). 우리가 반반을 최적으로
     둔 것은 그 통설을 베낀 것이 아니라 `2w(1−w)` 의 꼭짓점이 거기라서다 — 식이 먼저고 통설이 뒤다.
   ⚠ 그리고 자료는 **「잎의 무늬로 자식을 예측할 수 있다」를 명시적으로 부정한다** —
     잎은 이미 지나간 생장점의 산물이고 마디마다 세포 분포가 따로다. 그래서 `w` 를
     **예측이 아니라 확률을 기울이는 값**으로만 쓴다. 이 코드가 하는 일이 정확히 그것이다.

     | 자른 마디 w | 원복 | 유지 | 고스트 | |
     |---|---|---|---|---|
     | 0 (민무늬 마디)   | 100% |  0%  |  0%  | 무늬가 없으면 물려줄 것도 없다 |
     | 1/3               | 44.4%| 44.4%| 11.1%| |
     | **1/2 (반반)**    | 25%  | **50%** | 25% | ★유지가 최대. 육종가가 여기를 고른다 |
     | 2/3               | 11.1%| 44.4%| 44.4%| |
     | 1 (전부 무늬)     |  0%  |  0%  | **100%** | ★반드시 죽는다 |

   ★★★ **천장이 여기서 저절로 나온다.** 박사님이 짚으신 그대로다 —
     소질이 오를수록 그루의 잎이 희어지고, 희어질수록 잘라 낸 것이 고스트로 죽는다.
     `varieP` 에 상한을 **규칙으로 박지 않았다.** 1.0 에 가까워지는 계통은 후손이 안 남아
     스스로 끊긴다. 「5일 주기라 시루 5개가 천장」과 같은 꼴 — 규칙에서 나온 상한이다.
     한 세대를 넘길 확률이 아무리 좋아도 `max 2w(1−w) = 0.5` 라 **대를 이을수록 기하급수로 어렵다.**

   ══ 소질이 얼마나 오르나 ═════════════════════════════════════════════════════
       유지된 자식의 varieP = 모주 varieP + (1 − 모주 varieP) × w × u,   u ~ 균등(0,1)

   ★ 왜 이 꼴인가. ① **남은 거리의 일부만** 오르므로 오를수록 덜 오른다(수확체감).
     ② **w 가 곱해진다** — 무늬가 짙은 자리에서 잘라야 많이 오른다. 그런데 짙을수록
     고스트로 죽으므로, 「많이 오르는 선택」과 「살아남는 선택」이 서로 당긴다.
     ③ `u` 가 박사님의 *"랜덤으로 올라가되"* 다.
   ★ 원복한 자식은 **0 이다** — 초록 조직만 남았으므로. 옛 규칙의 *"plain 은 복제해도 영원히 0"*
     (0 × 0.8 = 0)이 여기서 같은 자리를 지킨다.

   ══ ★ 헛수고가 되지 않는 이유 — 셋 ═══════════════════════════════════════════
     ① **모주는 안 깎인다.** 자식이 원복해도 모주의 `varieChance` 는 그대로다.
        떨어지기만 하는 판이 원리적으로 없다 — 잃는 것은 그 가지 하나뿐이다.
     ② **원복한 자식도 팔린다.** 딸려간 무늬 잎은 **물리적으로 같은 잎**이라 그대로 붙어 있다.
        계통은 끝나도 그 삽수는 무늬 삽수 값(80,000원)을 받는다.
     ③ **민무늬 마디를 자르면 아무 위험이 없다**(w=0 → 고스트 0%). 꾸준수입 경로는
        위험을 전혀 안 진다. 위험은 **소질을 올리려 할 때만** 생긴다.
============================================================ */
export const VARIE = Object.freeze({
  variegatedMother: 0.195,   // 무늬 모주의 새 잎 무늬율(최적 관리 · normal 기준)
  plainMother: 0             // ★ plain 은 복제해도 영원히 0 이다
});

/* ⏸ **대체됨(2026-08-17).** 자른 마디의 무늬 짙기 w → 세 갈래 확률. 합은 언제나 1이다.
   ⚠ 게임은 이 함수를 **안 부른다.** 남겨 둔 까닭은 §③ 머리말 셋. */
export function chimeraOddsOf(w) {
  const c = Math.max(0, Math.min(1, Number.isFinite(w) ? w : 0));
  return { revert: (1 - c) * (1 - c), chimera: 2 * c * (1 - c), ghost: c * c, w: c };
}

export const LINEAGE_KO = Object.freeze({
  revert:  '원복 — 무늬가 빠졌다',
  chimera: '무늬를 물려받았다',
  ghost:   '고스트 — 엽록소가 없다'
});

/* ⏸ **대체됨(2026-08-17).** 화면이 자르기 전에 물어보던 창구 — 「이 마디를 자르면 무엇을 거나」.
   ⚠ 이제 자를 때 **거는 것이 없다.** 결과를 정하는 것은 그 삽수를 **어디에 두느냐**(빛)이고,
     그건 자르기 창이 아니라 자리를 고르는 순간에 보일 값이다.
   ★ 그 자리를 대신하는 것이 `cutPlanOf(node, container)` 다(아래 §자르기 전에 보이는 것).
   ⚠ 게임은 이 함수를 **안 부른다**(`game.html` 도 원래 안 불렀다 — 재서 확인했다).
   반환 { w, revert, chimera, ghost, ko, warn } */
export function cutRiskOf(node) {
  const leaves = (node && node.leaves) || 0;
  const varie = (node && node.variegatedLeaves) || 0;
  const o = chimeraOddsOf(leaves > 0 ? varie / leaves : 0);
  const p = (x) => Math.round(x * 100) + '%';
  return {
    ...o,
    ko: varie === 0
      ? '민무늬 마디 — 무늬가 안 따라갑니다(위험도 없습니다)'
      : `무늬 ${varie}/${leaves}장 — 원복 ${p(o.revert)} · 무늬 유지 ${p(o.chimera)} · 고스트 ${p(o.ghost)}`,
    warn: o.ghost >= 0.5
      ? (o.ghost >= 1 ? '★달린 잎이 전부 무늬입니다 — 잘라 내면 반드시 고스트가 되어 시듭니다'
                      : '★고스트 위험이 절반을 넘습니다 — 무늬가 덜한 마디가 안전합니다')
      : null
  };
}

/* ============================================================
   ★★ 자르기 전에 보이는 것 — `cutPlanOf` (2026-08-17 · `cutRiskOf` 를 대신한다)
   ------------------------------------------------------------
   자를 때 거는 것이 없어졌으므로 화면이 말할 것도 바뀌었다. 이제 알려 줄 것은 **셋**이다:
     ① 이 마디를 이 용기로 갈 수 있나 (물꽂이는 잎 1장뿐)
     ② 며칠에 뿌리가 나고 며칠에 혹이 나나
     ③ **무늬 마디라면** — 어디에 두느냐로 새 잎 무늬율이 20~80% 사이에서 갈린다
   ★ ③ 을 숨기면 자리 고르기가 도박이 된다. 이건 확률이 아니라 **선택지 표**라 숨길 이유가 없다.
   ⚠ 숫자를 문구에 손으로 적지 않는다(START-HERE §2.8) — 전부 위 상수에서 읽어 짓는다.
   반환 { ok, why, method, methodKo, rootDays, nodeDays, canDie, graceDays,
          variegated, lightTable:[{step,ko,chance}], ko } */
export function cutPlanOf(S, node, container, opt = {}) {
  const cont = CONTAINERS[container] || null;
  const m = cont ? METHODS[cont.method] : null;
  const leaves = (node && node.leaves) || 0;
  const varie = (node && node.variegatedLeaves) || 0;
  const why = !cont ? `모르는 용기입니다: ${container}`
            : !cont.ready ? `${cont.ko} 는 아직 못 씁니다`
            : methodLeafBlock(cont.method, leaves);
  const novice = opt.novice != null ? !!opt.novice : isNoviceMode(S);
  const lightTable = Object.keys(VARIE_LIGHT).map(step => ({
    step, ko: VARIE_LIGHT_KO[step], chance: VARIE_LIGHT[step]
  }));
  /* ★★ 2026-08-17 — 자리가 정하는 것이 **둘**이 됐다 (확정문 §3).
       ① 새 잎이 무늬로 나나 (`lightTable` · 20/50/80%)
       ② 그 무늬가 **어느 등급**이 되나 (`gradeTable` · 산반/하프문/풀문)
     ★ 둘 다 숨기지 않는다. 확률이 아니라 **선택지 표**라 숨길 이유가 없다(§cutPlanOf 머리말).
     ⚠ 숫자를 문구에 손으로 안 적는다 — 전부 정본(varie_grades.json)에서 읽어 짓는다. */
  const GR = varieGradeRules();
  const gradeTable = Object.keys(GR.lightGrade).map(step => ({
    step, ko: VARIE_LIGHT_KO[step] || step,
    expectedWon: Object.entries(GR.lightGrade[step])
      .reduce((n, [gid, pr]) => n + pr * ((GR.byId.get(gid) || {}).leafWon || 0), 0),
    grades: Object.entries(GR.lightGrade[step]).map(([gid, pr]) => ({
      grade: gid, ko: (GR.byId.get(gid) || {}).ko || gid, chance: pr,
      leafWon: (GR.byId.get(gid) || {}).leafWon || 0
    }))
  }));
  /* 이 마디를 자르면 **딸려가는 잎의 등급**. 화면이 「하프문 잎이 따라간다」를 말할 수 있게 */
  const carried = Array.isArray(node && node.leafGrades)
    ? node.leafGrades.filter(Boolean).map(gid => ({
        grade: gid, ko: (GR.byId.get(gid) || {}).ko || gid,
        leafWon: (GR.byId.get(gid) || {}).leafWon || 0 }))
    : [];
  const p = (x) => Math.round(x * 100) + '%';
  return {
    ok: !why, why: why || null,
    gradeTable, carriedGrades: carried,
    method: cont ? cont.method : null, methodKo: m ? m.ko : null,
    rootDays: m ? m.rootDays : null, nodeDays: m ? m.nodeDays : null,
    canDie: !!(m && m.canDie),
    graceDays: cont ? graceDaysOf(cont.method, novice) : null,
    variegated: varie > 0,
    lightTable,
    ko: why ? why
      : (m.rootDays + '일 뒤 뿌리 · ' + m.nodeDays + '일 뒤 혹' +
         (m.canDie ? ` — 그때부터 ${graceDaysOf(cont.method, novice)}일 안에 분갈이해야 삽니다`
                   : ' — 기한도 죽음도 없습니다')) +
        (varie > 0
          ? ` · 무늬 마디입니다 — 새 잎 무늬율은 **놓는 자리**가 정합니다(` +
            lightTable.map(t => `${t.ko} ${p(t.chance)}`).join(' · ') + ')'
          : '')
  };
}

/* ⏸ **대체됨(2026-08-17).** 굴림 하나로 갈래를 정한다. `roll` 은 0~1.
   ⚠ 게임은 이 함수를 **안 부른다** — 자를 때 주사위를 안 던진다. */
export function rollLineage(w, roll) {
  const o = chimeraOddsOf(w);
  const r = Math.max(0, Math.min(1, roll));
  if (r < o.revert) return 'revert';
  if (r < o.revert + o.chimera) return 'chimera';
  return 'ghost';
}

/* ⏸ **대체됨(2026-08-17).** 유지된 자식의 소질 — 남은 거리의 `w × u` 만큼 오른다.
   ⚠ 게임은 이 함수를 **안 부른다.** 지금 소질을 정하는 것은 `varieChanceFromLight` 다. */
export function varieChanceRise(motherChance, w, u) {
  const m = Math.max(0, Math.min(1, Number.isFinite(motherChance) ? motherChance : 0));
  const cw = Math.max(0, Math.min(1, Number.isFinite(w) ? w : 0));
  const cu = Math.max(0, Math.min(1, Number.isFinite(u) ? u : 0));
  return +(m + (1 - m) * cw * cu).toFixed(6);
}

export function varieChanceOf(mother) {
  if (mother && Number.isFinite(mother.varieChance)) return mother.varieChance;
  return mother && mother.variegated ? VARIE.variegatedMother : VARIE.plainMother;
}

/* ⏸ 용기 등급 감쇠. 트레이(batch 0.8)가 열리면 다시 쓴다 — 지금은 둘 다 1.0 이라
   곱해도 값이 안 바뀐다. **세대 감쇠(0.8ⁿ)는 위 키메라 모델로 대체됐다** — 감쇠가
   세대마다 확정으로 걸리면 박사님의 "확률이 올라가되 유전되게"가 성립할 수 없다. */
export function gradeMultOf(container) {
  const c = CONTAINERS[container];
  return c ? c.gradeMult : 1;
}

/* 결정적 난수. 같은 세이브를 몇 번 불러도 같은 답이 나와야 한다 —
   growth 의 `matHash` 와 같은 사상이고, 씨앗은 코어가 이미 가진 `S.sim.seed` 다. */
export function cuttingHash(seed, id, salt = 0) {
  let h = (seed >>> 0) ^ (salt | 0) * 0x9e3779b1;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2545f491) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/* ============================================================
   ★★ 유한성 — 자를 수 있는 것은 **모주가 실제로 가진 만큼**뿐이다 (2026-08-03)
   ------------------------------------------------------------
   박사님 지시: *"⚠ 무한 증식이 되면 안 된다. 자를 수 있는 마디는 유한하고, 자르면 모주가
   잎을 잃는다(pot.pendingCutLoss). 그 제약을 실제로 걸어라."*

   ★ 왜 코어가 막아야 하나. growth 는 **잘라낸 것을 모른다** — plant_grow 는 한 그루 전용이라
     형태를 되돌리는 창구가 없고, 그래서 `takeCutting` 은 지금도 손실을 `pot.pendingCutLoss` 에
     **적어만 둔다**(위 ④ 주석). 그 말은 growth 의 `cuttableNodes()` 가 **잘린 뒤에도 안 잘린
     그루를 계속 낸다**는 뜻이다. 그 목록을 그대로 믿고 자르면 잎 2장짜리 그루에서 삽수가
     영원히 나온다 — 경제가 그 자리에서 끝난다.

   ★ 무엇으로 막나 — **총량 하나**다.
       잘라낸 잎의 합(`pendingCutLoss.leaves`) ≤ 모주의 잎 수(`leafStats().leaves`)
     이 부등식만 지키면 무한 증식이 물리적으로 불가능하다. 모주가 잎을 새로 내면
     오른쪽이 커져 **그만큼만** 다시 열린다 — 그게 "꾸준수입의 속도"가 된다.

   ★ 왜 마디 트리를 안 따라가나(대안을 버린 이유). nodeId 는 `n0.1:1#3` 처럼 **경로**라
     문자열을 파싱하면 "어느 마디가 어느 마디 위인가"를 코어가 다시 셀 수 있다. 안 했다 —
     그 규칙은 growth 소유의 id 형식에 코어를 묶고, growth 가 형식을 바꾸는 날
     **오류 없이 틀린 필터**가 된다(무한 증식이 조용히 열린다). 총량은 형식과 무관하다.
     대신 **같은 마디를 두 번 자르는 것**은 id 로 막는다(그건 형식과 상관없는 동일성이다).

   ⚠ 그래서 이 필터는 "이 마디가 아직 달려 있나"를 완벽히 알지는 못한다. 아는 것은
     **잘라낸 총량을 넘지 않는다**는 것뿐이고, 그게 경제가 필요로 하는 전부다.
     정확한 형태 반영은 growth 의 다개체 리팩터 몫이다(docs/handoff/core-to-growth.md).
============================================================ */

/* 모주의 잎 수. **코어가 세지 않는다** — growth 가 낸 목록에서 읽는다.
   밑동 마디를 자르면 그루가 통째로 딸려오므로 `leafStats().leaves` 와 항상 같다
   (tools/test_cuttable.mjs 검사 K 가 그 등식을 고정한다). */
export function motherLeavesOf(nodes) {
  let max = 0;
  for (const n of nodes || []) if (Number.isInteger(n.leaves) && n.leaves > max) max = n.leaves;
  return max;
}

export function cutLossOf(pot) {
  const l = pot && pot.pendingCutLoss;
  return { leaves: (l && l.leaves) || 0, nodes: (l && l.nodes) || 0 };
}

/* 지금 몇 장을 더 자를 수 있나.
   반환 { motherLeaves, lostLeaves, leftLeaves, cutNodeIds } */
export function cutBudgetOf(S, nodes, opt = {}) {
  /* ★ 모주가 삽수면 총량 장부가 **필요 없다.** 삽수의 잎은 코어가 들고 있어서
     자르는 그 자리에서 실제로 빠지기 때문이다(`takeCutting` 이 `leafVarie` 를 자른다).
     화분은 growth 가 형태를 되돌리는 창구가 없어서 「적어만 두는」 장부가 필요했다 —
     그 사정이 삽수에는 없으므로, 없는 장부를 흉내 내지 않는다.
     ⚠ 그래서 삽수의 `cutNodeIds` 도 비어 있다. 같은 이름(`cut_01#1`)이 다시 나올 수 있는데,
       그때는 **정말로 다른 마디**다 — 앞의 잎은 이미 떨어져 나갔고 새로 난 잎이 그 자리다. */
  if (opt.motherCuttingId || opt.motherCutting) {
    const c = opt.motherCutting ||
              (S.cuttings || []).find(x => x.id === opt.motherCuttingId) || null;
    const n = cuttingStatsNow(c).leaves;
    return { motherLeaves: n, lostLeaves: 0, leftLeaves: n, cutNodeIds: [], motherKind: 'cutting' };
  }
  const pot = opt.pot || (opt.potId ? (S.pots || []).find(p => p.id === opt.potId) : (S.pots || [])[0]);
  const motherLeaves = Number.isInteger(opt.motherLeaves) ? opt.motherLeaves : motherLeavesOf(nodes);
  const lost = cutLossOf(pot);
  return {
    motherLeaves,
    lostLeaves: lost.leaves,
    leftLeaves: Math.max(0, motherLeaves - lost.leaves),
    cutNodeIds: ((pot && pot.cuts) || []).map(c => c.nodeId),
    motherKind: 'pot'
  };
}

/* growth 가 낸 목록에서 **지금 실제로 자를 수 있는 것만** 남긴다.
   ★ `takeCutting` 이 자기 안에서 이걸 한 번 더 돌린다 — 호출부가 잊어도 새지 않는다.
   ★ 걸러 내는 사유를 같이 낸다(`why`) — 화면이 "왜 이 마디는 회색인가"를 말할 수 있게. */
export function cuttableNow(S, nodes, opt = {}) {
  if (!Array.isArray(nodes)) return [];
  const b = cutBudgetOf(S, nodes, opt);
  const cut = new Set(b.cutNodeIds);
  const out = [];
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue;
    if (!isCuttableStem(n.stem)) continue;                       // 잎꽂이는 안 된다(§①)
    if (!Number.isInteger(n.leaves) || n.leaves < 1) continue;   // 잎 없는 조각은 상품이 아니다
    if (cut.has(n.nodeId)) continue;                             // 이미 잘라낸 마디
    if (n.leaves > b.leftLeaves) continue;                       // ★총량 — 없는 잎을 잘라낼 수 없다
    out.push(n);
  }
  return out;
}

/* ★ 지금 모주에 **실제로 남아 있는** 잎 집계. growth 의 `leafStats()` 에서 잘라낸 만큼을 뺀다.
   ⚠ 이게 없으면 `shop.sellPot` 에 growth 의 날값이 그대로 들어가 **이미 팔아 버린 잎을 또 판다.**
     growth 는 잘린 것을 모르므로(위 §유한성) 빼 주는 것은 코어 몫이다.
   반환 { leaves, variegatedLeaves, lostLeaves, rawLeaves } — 못 재면 null(0 으로 안 메꾼다). */
export function motherStatsNow(S, stats, opt = {}) {
  if (!stats || typeof stats !== 'object' || !Number.isInteger(stats.leaves)) return null;
  const pot = opt.pot || (opt.potId ? (S.pots || []).find(p => p.id === opt.potId) : (S.pots || [])[0]);
  const lost = cutLossOf(pot).leaves;
  const leaves = Math.max(0, stats.leaves - lost);
  /* 무늬 잎도 같이 깎는다 — 다만 **덜 깎는 쪽**으로 둔다(무늬가 남아 있을 수도 있으므로
     전체 잎을 넘지 않게만 자른다). 넘치게 세면 안 판 잎을 판 게 된다. */
  const varie = Math.min(leaves, Math.max(0, stats.variegatedLeaves || 0));
  return { leaves, variegatedLeaves: varie, lostLeaves: lost, rawLeaves: stats.leaves };
}

/* ★ 이 마디를 자르면 **모주가 끝나나** — 자른 뒤 모주에 잎이 한 장도 안 남는 경우.
   ------------------------------------------------------------
   판정 자체는 예전부터 `takeCutting` 안에 있었다. 밖으로 뺀 이유는 하나다 —
   **화면이 같은 답을 물어볼 데가 없었다.** 그래서 game.html 의 자르기 목록에는
   초보에서 던질 마디가 그대로 떠 있었고, 누르면 예외가 났다(실제로 났다.
   tools/probe_cutting_ui.mjs 가 그걸 잡았다). 두 곳에서 세면 반드시 어긋난다.

   ⚠ 여기서 새 규칙을 만들지 않았다. 식은 `takeCutting` 이 쓰던 그것 그대로고,
     `takeCutting` 이 이제 이 함수를 부른다 — 셈은 한 곳에만 있다. */
export function cutEndsMother(S, nodes, nodeId, opt = {}) {
  const node = (nodes || []).find(n => n && n.nodeId === nodeId);
  if (!node) return false;
  return cutBudgetOf(S, nodes, opt).leftLeaves - node.leaves < 1;
}

/* 왜 못 자르나 — 사람이 읽을 수 있는 사유. 없으면 null(자를 수 있다).
   ★★ 2026-08-17 — `opt.container` 를 받는다. 「이 마디를 **이 용기로**」가 사유를 가르기
     때문이다: 잎 두 장짜리 마디는 흙에는 되고 병에는 안 된다(§WATER_LEAF_MAX).
     ⚠ 안 넘기면 용기 사유를 **안 본다** — 예전 호출부가 그대로 돌게 하려는 것이다.
       그 대신 `takeCutting` 이 자기 안에서 용기까지 넣어 다시 묻는다(새는 길이 없다).
     ⇒ 화면은 단추마다 `{ container: cid }` 를 같이 넘겨야 「병에」가 회색이 된다
       (game.html 패치는 보고서에 코드째 있다). */
export function cutBlockedReason(S, nodes, nodeId, opt = {}) {
  const node = (nodes || []).find(n => n && n.nodeId === nodeId);
  if (!node) return `모르는 마디입니다: ${nodeId}`;
  if (opt.container) {
    const cont = CONTAINERS[opt.container];
    if (!cont) return `모르는 용기입니다: ${opt.container}`;
    const lb = methodLeafBlock(cont.method, node.leaves);
    if (lb) return `${nodeId} — ${lb}`;
  }
  if (!isCuttableStem(node.stem))
    return `${nodeId} 는 stem 이 '${node.stem}' 이라 자를 수 없습니다 — ` +
           `${CUTTABLE_STEMS.join('/')} 마디라야 새 생장점을 냅니다 (잎꽂이는 안 됩니다)`;
  if (!Number.isInteger(node.leaves) || node.leaves < 1)
    return `${nodeId} 에 잎이 없습니다 — 잎이 없는 조각은 뿌리 낼 에너지가 없습니다(propagation.md §3)`;
  const b = cutBudgetOf(S, nodes, opt);
  if (b.cutNodeIds.includes(nodeId))
    return `${nodeId} 는 이미 잘라낸 마디입니다 — 같은 마디가 두 번 나오지 않습니다`;
  if (node.leaves > b.leftLeaves)
    return `${nodeId} 는 잎 ${node.leaves}장짜리인데 모주에 ${b.leftLeaves}장만 남았습니다 ` +
           `(잎 ${b.motherLeaves}장 중 ${b.lostLeaves}장을 이미 잘랐습니다) — ` +
           `새 잎이 날 때까지 기다려야 합니다`;
  /* ★ 초보에서 모주를 끝내는 자르기 — `takeCutting` 이 던지는 마지막 사유다.
     예전에는 여기 없어서 **화면이 "왜 회색인가"를 말할 수 없었다**(그래서 안 회색이었고
     누르면 던졌다). 사유를 내는 곳은 한 군데라야 한다는 이 함수의 취지 그대로다. */
  if (isNoviceMode(S) && cutEndsMother(S, nodes, nodeId, opt))
    return `${nodeId} 를 자르면 모주에 예비혹이 하나도 안 남아 모주가 끝납니다 — ` +
           `초보 모드에서는 이 마디를 자를 수 없습니다`;
  return null;
}

/* ============================================================
   ★★ 삽수가 자란다 — 그리고 삽수에서 또 자를 수 있다 (2026-08-04 박사님 확정)
   ------------------------------------------------------------
   박사님 원문: *"응 맞어. 삽수는 자라야지 실제와 같지."*

   ★ 왜 이게 있어야 하나. *"올라간 확률은 유전되게"* 가 성립하려면 **자식이 잎을 내야** 한다.
     예전 삽수는 `established`("자리를 잡았다")에서 멈추고 새 잎이 안 났다 — 물려받은 확률을
     쓸 일이 영영 없었다. 그러면 유전이라는 말 자체가 장부에만 있는 값이 된다.

   ══ 코어가 잎을 세는 것이 이 저장소 원칙과 안 부딪히나 ═══════════════════════
   안 부딪힌다. 원칙은 *"생장 나이·잎 수 → growth. 코어는 읽기만 한다"* 인데 그 대상은
   **growth 가 그리는 그루(S.pots)** 다. 삽수는 처음부터 growth 가 아예 모르는 물건이고
   (`docs/propagation.md` §7-2 — "삽수는 growth 를 안 쓰고 코어가 전부 아는 물건"),
   `c.source.leaves` 도 이미 코어가 들고 있던 값이다. 여기서 늘어난 것은 「그 값이 자란다」뿐이다.
   ⚠ 그래도 **캐논을 새로 짓지는 않았다.** 아래 두 숫자 다 이미 있던 것이다.

   ══ 규칙 넷 ═════════════════════════════════════════════════════════════════
     ① **흙에 자리를 잡은 뒤부터 난다**(`established`). 물꽂이는 뿌리만 내고 잎은 안 낸다 —
        실제로도 그렇고, 그래야 분갈이가 「죽음을 피하는 일」을 넘어 **키우는 일**이 된다.
     ② **32일에 한 장.** `METHODS.water.nodeDays` 와 **같은 32** 다 — 그 값의 뜻이 애초에
        *"자른 날부터 다음 마디(혹)가 나기까지"* 이고, 몬스테라는 마디 하나에 잎 하나다.
        새 숫자를 안 만들었고, 뜻이 정확히 겹친다.
     ③ **빛이 있어야 쌓인다.** 어두운 자리에 둔 삽수는 날짜만 가고 잎이 안 난다.
        판정은 코어가 안 한다 — 그 자리의 DLI 를 growth 의 밴드로 물어본다(`opt.lightOf`).
        ★ 이게 무한 증식을 막는 힘의 절반이다. 잎이 나야 자를 수 있고, 잎은 **빛과 자리**가 낸다.
     ④ **새 잎의 무늬는 그 삽수의 `varieChance` 로 굴린다.** 물려받은 소질이 여기서 쓰인다.

   ══ 잎을 어떻게 들고 있나 ═══════════════════════════════════════════════════
   `c.leafVarie` = 아래(오래된 잎)부터 위(생장점)로 늘어놓은 참/거짓 배열이다.
   ★ 개수만 들고 있으면 **어느 잎이 무늬인지**를 잃어서 「이 마디를 자르면 무늬가 몇 장 딸려오나」
     를 못 낸다 — 그 값이 곧 위 §키메라의 `w` 라, 게임의 판단 자체가 사라진다.
   `c.leaves` · `c.variegatedLeaves` 는 그 배열에서 나온 값이고 `syncCuttingLeaves` 한 곳에서만
   갱신한다(두 곳에서 세면 반드시 어긋난다). shop.js 가 그 둘을 읽는다 — 순환 import 를 피한다.
============================================================ */

/* 삽수가 잎 한 장을 내는 데 걸리는 날. 위 ② — METHODS.water.nodeDays 와 같은 값이다.
   ⚠⚠ **2026-08-17 — 그래서 32 → 20 으로 같이 움직였다.** 손으로 고친 것이 아니라
     묶어 둔 이름이 따라온 것이다. 묶음을 안 푼 까닭은 뜻이 그대로이기 때문이다:
     *"혹 = 다음 마디 = 잎 한 장"* — 몬스테라는 마디 하나에 잎 하나다.
   ★ 이 값이 **삽수의 값어치를 만든다.** 잎이 나야 잘라 팔 등급이 오르고, 20일이면
     씨앗(첫 잎 30일)보다 빠르다. 밸런스에 미치는 몫은 재서 적었다
     (docs/handoff/cutting2-to-plan.md §실측). */
export const CUTTING_LEAF_DAYS = METHODS.water.nodeDays;

/* ★★★ 2026-08-17 — **수경은 다음 혹이 나면 성장을 멈춘다** (박사님 ③).
   ------------------------------------------------------------
   원문: *"수경은 다음 혹이 나면 성장을 멈추고"*

   ══ 재 보니 **이미 그랬다** — 그래도 못을 박는다 ═══════════════════════════
   ★ 지금 그렇다: 잎이 나는 자리는 `stepCuttings` §①-3 **하나**뿐이고 그 조건이
     `status === 'established'` 다. 물꽂이는 `rooting → rooted → node` 로만 가고
     `established` 에 **닿는 길이 없다**(닿는 순간은 분갈이인데, 분갈이는 `method` 를
     'pot' 으로 바꾼다). 그래서 물꽂이 삽수는 애초에 잎이 한 장도 안 났다 —
     §삽수가 자란다 규칙 ① 이 *"물꽂이는 뿌리만 내고 잎은 안 낸다"* 로 못 박아 둔 그것이다.
   ★ 그렇게 하기로 했다: 그래도 **조건을 글로 적는다.** 까닭 둘 —
     ① 박사님이 규칙으로 말씀하신 것이라 코드에 그 문장이 있어야 다음 사람이 안 되묻는다
     ② 「established 에 못 닿는다」는 **딴 계통의 사정**이다. 언젠가 물꽂이가 자리를 잡게
        열리는 날(트레이·수경 전용 그릇) 이 조건이 없으면 **말없이 규칙이 깨진다.**
   ⚠⚠ **기한(죽는 것)은 안 걷었다.** 박사님 확정: *"혹이 나면 성장이 멈추되 기한은 그대로."*
     멈추는 것은 **잎**뿐이고 분갈이 기한은 그대로 돈다(§⑥ ③경고 → ④죽음).
   ⚠ **흙(`pot`)은 안 본다.** 박사님은 **수경**만 말씀하셨다 — 흙은 혹이 나도 계속 자란다.
     그래서 조건에 `method === 'water'` 가 들어 있고, 그 한 글자가 두 갈래를 가른다. */
export function leafGrowthStopped(c) {
  return !!(c && c.method === 'water' && c.nodeOnDay != null);
}

/* ★★ 2026-08-17 — 잎마다 **등급**도 같이 들고 있다 (확정문 §5).
   `c.leafGrade[i]` 는 `c.leafVarie[i]` 와 **같은 자리의 같은 잎**이다.
   ⚠ 배열 둘을 따로 두면 언젠가 길이가 갈린다 — 그래서 `syncCuttingLeaves` 한 곳에서만
     손대고, 여기가 **길이를 맞추는 유일한 자리**다(길이는 늘 `leafVarie` 가 정한다).
   ⚠ 옛 세이브에는 `leafGrade` 가 없다. 그때 무늬 잎은 **산반으로 읽는다**(확정문 §5) —
     지어내는 것이 아니라 확정문이 정해 준 규칙이고, `save.js §migrateVarieGrades` 가 기록에 남긴다. */
export function syncCuttingLeaves(c) {
  const arr = Array.isArray(c.leafVarie) ? c.leafVarie : [];
  const g = Array.isArray(c.leafGrade) ? c.leafGrade : [];
  const known = varieGradeRules().byId;
  c.leafGrade = arr.map((v, i) => {
    if (!v) return null;                                   // 민무늬 잎은 등급이 없다
    const row = known.get(g[i]);
    /* ⚠ 모르는 것을 **여기서 산반으로 굳히지 않는다.** `null` 로 남긴다 —
       「아직 모른다」와 「산반으로 정해졌다」는 다른 말이고, 굳히면 나중에 빛으로
       정할 기회가 사라진다. 값을 매길 때만 `shop.leafGradeListOf` 가 산반으로 편다. */
    return (row && row.varie) ? g[i] : null;
  });
  c.leaves = arr.length;
  c.variegatedLeaves = arr.reduce((n, v) => n + (v ? 1 : 0), 0);
  /* ⚠ 민무늬 자리는 `null` 이다 — 민무늬 등급 id 를 적어 두지 않는다.
     `shop.leafGradeListOf` 가 null 자리를 민무늬로 편다(세이브 칸을 늘리지 않는다). */
  return c;
}

/* 지금 이 삽수의 잎 집계. **`c.source` 는 안 본다** — source 는 「자를 때 딸려온 것」이라
   영원히 안 변하는 기록이고, 지금 값은 자란 만큼 다르다. 둘을 섞으면 자란 삽수를 팔 때
   안 자란 값을 받는다. 옛 세이브(배열이 없는 것)는 source 로 되메운다. */
export function cuttingStatsNow(c) {
  if (!c) return { leaves: 0, variegatedLeaves: 0, leafGrades: [] };
  if (Array.isArray(c.leafVarie)) {
    const known = varieGradeRules().byId;
    const g = Array.isArray(c.leafGrade) ? c.leafGrade : [];
    return { leaves: c.leafVarie.length,
             variegatedLeaves: c.leafVarie.reduce((n, v) => n + (v ? 1 : 0), 0),
             /* ★ 값을 매기는 자리(`shop.listCutting`)에 **그대로 넘길 수 있는 모양**이다.
                ⚠ 등급을 모르는 무늬 잎은 `null` 이다 — 산반으로 펴는 것은 `priceOf` 몫이다.
                  여기서 펴면 화면이 「산반이다」라고 단정하게 된다(사실은 미정이다). */
             leafGrades: c.leafVarie.map((v, i) => {
               if (!v) return null;
               const row = known.get(g[i]);
               return (row && row.varie) ? g[i] : null;
             }) };
  }
  /* 옛 세이브 — 배열이 아예 없다. 무늬 잎이 몇 장이었나만 안다(등급은 미정이다) */
  const s = c.source || {};
  const n = s.leaves || 0, v = s.variegatedLeaves || 0;
  return { leaves: n, variegatedLeaves: v,
           leafGrades: Array.from({ length: n }, () => null) };
}

/* 삽수에서 자를 수 있는 마디. **코어가 지어내는 것이 아니라 자기가 가진 잎을 읽는 것**이다.
   ★ `i = 0` 은 안 낸다 — 밑동을 자르면 모주(그 삽수)가 통째로 딸려가 자르는 의미가 없다.
     그래서 삽수에서는 「모주가 끝나는 자르기」가 애초에 목록에 없다.
   ★ stem 을 'pink' 로 둔 근거: `i ≥ 1` 이므로 그 마디의 잎은 생장점 잎보다 최소
     한 주기(32일) 먼저 났다. 캐논의 `stemTrans`(마디가 묵어 pink 가 되는 데 걸리는 시간)
     와 같은 자리이고, 코어가 새 등급을 만들지 않는다. */
export function cuttableNodesOfCutting(c) {
  const arr = (c && Array.isArray(c.leafVarie)) ? c.leafVarie : [];
  const grades = (c && Array.isArray(c.leafGrade)) ? c.leafGrade : [];
  const out = [];
  for (let i = 1; i < arr.length; i++) {
    const carried = arr.slice(i);
    out.push({
      nodeId: `${c.id}#${i}`,
      stem: 'pink',
      leaves: carried.length,
      variegatedLeaves: carried.reduce((n, v) => n + (v ? 1 : 0), 0),
      /* ★★ 딸려가는 잎의 **등급**도 같이 낸다 (확정문 §5) — 하프문 잎을 자르면 하프문이
         따라가야 한다. 개수만 넘기면 그 자리에서 산반으로 떨어져 값이 반으로 준다.
         ⚠ `assertCutNode` 는 이 칸을 요구하지 않는다 — 화분 마디(growth 가 내는 것)에는
           아직 없는 칸이라 필수로 만들면 자르기가 통째로 막힌다. */
      leafGrades: carried.map((v, k) => (v ? (grades[i + k] || null) : null)),
      growthDays: null
    });
  }
  return out;
}

/* 자르는 대상(모주)을 하나로 본다 — 화분이든 삽수든.
   반환 { kind:'pot'|'cutting', obj } · 못 찾으면 던진다 */
function motherOf(S, opt) {
  if (opt.motherCuttingId) {
    const c = (S.cuttings || []).find(x => x.id === opt.motherCuttingId);
    if (!c) throw new Error(`[삽수] 모르는 모주 삽수: ${opt.motherCuttingId}`);
    if (c.status === 'dead') throw new Error(`[삽수] ${c.id} 는 이미 시들었습니다 — 자를 수 없습니다`);
    if (c.status !== 'established')
      throw new Error(`[삽수] ${c.id} 는 아직 자리를 잡지 않았습니다 — ` +
        `흙에 자리를 잡은 뒤에 자를 수 있습니다 (지금 ${CUTTING_STATUS_KO[c.status] || c.status})`);
    return { kind: 'cutting', obj: c };
  }
  const pot = opt.potId ? (S.pots || []).find(p => p.id === opt.potId) : (S.pots || [])[0];
  if (!pot) throw new Error('[삽수] 자를 모주가 없습니다 — 화분이 비어 있습니다');
  return { kind: 'pot', obj: pot };
}

/* ============================================================
   ④ 자르기
============================================================ */

function nextCuttingId(S) {
  let n = 1;
  const used = new Set((S.cuttings || []).map(c => c.id));
  while (used.has(`cut_${String(n).padStart(2, '0')}`)) n++;
  return `cut_${String(n).padStart(2, '0')}`;
}

/* 모주에서 삽수를 하나 뗀다.
   ------------------------------------------------------------
   ★★★ 2026-08-17 — **자르기와 담기가 두 걸음으로 갈렸다** (박사님 ①②⑤).
     원문: *"삽수하면 삽수된 줄기·잎은 템 형식으로 가방에 들어오도록 하고 / 유리병을 먼저
     가구처럼 배치하고 거기다 넣고 싶은 삽수를 드래그해서 배치하거나 … / 화분 배치 후
     거기다가 심을 수 있도록 하자"*

   ⚠ 예전 머리말은 *"자르기와 담기는 한 동작이다 — 나눠 두면 아무 데도 안 사는 상태가
     생긴다"* 였다. **그 걱정이 이번에 답을 얻었다**: 나눠 둔 조각은 「아무 데도 안 사는
     것」이 아니라 **가방에 사는 물건**이다(`status:'bag'`). 그리고 이 저장소에는 그 손버릇이
     이미 있다 — 시루·재배판·화분이 전부 「빈 그릇을 놓고 → 심는다」 두 걸음이다
     (`state.placeEmptyPot` → `plantMonsteraSeed`, `state.placeSiru(sow:false)` → `state.sowCrop`).
     **새 사상을 만들지 않고 그 길을 그대로 따랐다.**

   ★ 그래서 `opt.container` 가 **선택**이 됐다. 두 길 다 돈다:
       주면 (옛 길)   자른 그 자리에서 용기를 쓰고 담는다 — 값도 순서도 예전 그대로다
       안 주면 (새 길) 삽수만 난다. **재고를 한 톨도 안 깎는다** — 깎는 것은 「용기를 놓을 때」다
   ⚠ 옛 길을 없애지 않았다. 검사·재현·`game.html` 의 옛 단추가 아직 그 길로 부른다.

   ★ 용기를 안 정해도 **자를 때 정해지는 것은 전부 그대로 적는다** — 무늬·등급·`cutW` ·
     `motherGrowthDays`·`motherSeed`·`source`. 그 값들은 **모주에서 읽어 온 것**이라
     용기와 아무 상관이 없다(§① — 코어가 지어내지 않는다).
   ★ 체력(`ACT_COST.cut`)은 **두 길 다 든다.** 자르는 것이 손이지 담는 것이 손이 아니다.

     S
     opt.potId      모주 화분 id (없으면 S.pots[0])
     opt.nodes      ★ 모주의 마디 목록. **필수** — 코어가 지어내지 않는다.
                    growth_adapter.cuttableNodes() 또는 같은 모양의 값
     opt.nodeId     그중 어느 마디를 자르나
     opt.container  'jar' | 'soil' — **없어도 된다**(가방으로 온다). tray 는 에셋 미정이라 막힌다
     opt.at         놓을 좌표. opt.slots·size·snapDist 는 setPotAt 과 같다
     opt.varieChance  모주의 새 잎 무늬율(정본은 growth). 없으면 varieChanceOf(모주)
     opt.log        로그 콜백
   반환 삽수 객체(S.cuttings 에 들어간 그것) */
export function takeCutting(S, opt = {}) {
  if (!S || !Array.isArray(S.cuttings))
    throw new Error('[삽수] S.cuttings 가 없습니다 — 옛 상태입니다(state.newState 를 쓰세요)');

  const M = motherOf(S, opt);
  const pot = M.kind === 'pot' ? M.obj : null;
  const momCut = M.kind === 'cutting' ? M.obj : null;

  /* ★ 마디 목록의 출처가 모주 종류에 따라 다르다 — 그리고 **그게 원칙 그대로**다.
       화분  : growth 가 그린 그루라 코어가 잎 수를 모른다 → `opt.nodes` 를 **받아야** 한다
       삽수  : growth 가 아예 모르는 물건이고 잎을 코어가 들고 있다 → 코어가 **읽어서** 낸다
     지어내는 것이 아니라 자기 장부를 읽는 것이라 "실제 자란 것을 자른다"가 그대로 성립한다. */
  const nodes = Array.isArray(opt.nodes) && opt.nodes.length
    ? opt.nodes
    : (momCut ? cuttableNodesOfCutting(momCut) : null);
  if (!Array.isArray(nodes) || !nodes.length)
    throw new Error(momCut
      ? `[삽수] ${momCut.id} 에서 자를 마디가 없습니다 — 잎이 두 장 이상이라야 자릅니다 ` +
        `(지금 ${cuttingStatsNow(momCut).leaves}장)`
      : '[삽수] 모주의 마디 목록(opt.nodes)이 없습니다 — ' +
        '어느 마디를 잘랐는지가 결과에 따라가야 하므로 코어가 잎 수를 지어내지 않습니다 ' +
        '(growth_adapter.cuttableNodes 참고)');
  nodes.forEach((n, i) => assertCutNode(n, `nodes[${i}]`));

  /* 모주를 가리키는 열쇠 하나 — 아래 판정 함수들이 전부 이걸 그대로 받는다.
     화분이냐 삽수냐를 함수마다 다시 가르면 한 군데만 고쳐지는 날이 온다. */
  const mkey = momCut ? { motherCuttingId: momCut.id, motherCutting: momCut } : { potId: pot.id };

  const node = nodes.find(n => n.nodeId === opt.nodeId);
  if (!node) throw new Error(`[삽수] 모르는 마디입니다: ${opt.nodeId} ` +
    `(자를 수 있는 것: ${cuttableNow(S, nodes, mkey).map(n => n.nodeId).join(', ') || '없음'})`);

  /* ★ 잎꽂이·잎 없는 조각·이미 잘라낸 마디·없는 잎을 자르는 것 — 사유는 한 곳에서 낸다.
     (예전에는 여기서 stem·잎 수만 봤고, "이미 잘라낸 마디"와 "총량 초과"가 통째로 없었다.) */
  const blocked = cutBlockedReason(S, nodes, node.nodeId, mkey);
  if (blocked) throw new Error('[삽수] ' + blocked);

  /* ★ 모주를 끝내는 자르기(③) — **모주에 잎이 한 장도 안 남는** 경우.
     초보(스토리)에서는 **실행 자체가 없다**(propagation.md §2). 자유·고수에서는 경고만 한다.
     ★ 판정을 "다른 마디가 목록에 남아 있나"에서 **"잎이 남나"** 로 바꿨다(2026-08-03).
       growth 목록에는 이미 잘려 나간 자리도 그대로 남아 있어서(위 §유한성) 마디 개수로 세면
       거짓말이 된다 — 잎을 다 잘라낸 뒤에도 "아직 마디가 넷 남았다"고 통과시킨다.
       남은 잎으로 세면 형태를 몰라도 항상 맞고, 초보에서 **모주가 최소 한 장을 지킨다.**
     ★ 초보에서 막는 일 자체는 이제 **위 `blocked` 가 한다**(2026-08-04). 여기서 따로 던지지
       않는 이유는 화면 때문이다 — 사유를 `cutBlockedReason` 밖에 두면 game.html 이
       "왜 이 마디는 회색인가"를 물어볼 데가 없어서 **던질 마디를 멀쩡히 눌리게** 띄운다
       (실제로 그랬고 tools/probe_cutting_ui.mjs 가 잡았다). 여기 남은 값은 자유 모드의
       경고와 `pot.motherEnded` 기록에만 쓴다. */
  const wouldEndMother = cutEndsMother(S, nodes, node.nodeId, mkey);
  const novice = isNoviceMode(S);

  /* ★★ 용기 — **안 주면 가방으로 온다**(2026-08-17 · 위 머리말).
     ⚠ 「안 줬다」와 「모르는 것을 줬다」를 가른다. 후자는 여전히 던진다 —
       오타를 조용히 가방으로 흘려보내면 화면이 「병에 꽂았다」고 믿는 판이 생긴다. */
  const cont = opt.container == null ? null : CONTAINERS[opt.container];
  if (opt.container != null && !cont)
    throw new Error(`[삽수] 모르는 용기입니다: ${opt.container} ` +
      `(아는 것: ${Object.keys(CONTAINERS).join(', ')})`);
  if (cont && !cont.ready)
    throw new Error(`[삽수] ${cont.ko} 는 아직 못 씁니다 — 에셋이 정해지지 않았습니다 ` +
      `(docs/propagation.md §4 ⏸ 물꽂이 트레이). 유리 수경병(jar)이나 화분 직삽(soil)을 쓰세요`);

  /* ★★ 잎 1장이라야 물꽂이가 된다 (2026-08-17 박사님 · §WATER_LEAF_MAX).
     ------------------------------------------------------------
     ★ 사유를 내는 곳은 `methodLeafBlock` **한 곳**이다 — `cutBlockedReason` 도 그것을 부른다.
       두 곳에서 세면 「목록에는 눌리는데 누르면 던지는」 마디가 다시 생긴다.
     ⚠ `tutorialInput` 을 붙인다 — 고장이 아니라 **안내**다(다른 용기를 고르면 된다).
       안 붙이면 game.html 이 이걸 사고로 읽어 판을 잠근다(`isRecoverable`).
     ★ 용기를 안 정했으면 **여기서 안 묻는다.** 잎 수로 갈리는 것은 「어느 용기에 넣나」이고,
       그 물음은 넣을 때 `putCuttingIn` 이 **같은 함수로** 다시 한다(새는 길이 없다). */
  if (cont) {
    const lb = methodLeafBlock(cont.method, node.leaves);
    if (lb) { const e = new Error(`[삽수] ${node.nodeId} — ${lb}`); e.tutorialInput = true; throw e; }
  }

  /* ★★ 체력 — 오늘 자를 손이 남았나 (docs/stamina.md · `ACT_COST.cut`).
     ------------------------------------------------------------
     ★ **아무것도 바꾸기 전에** 묻는다. 여기 바로 아래에서 용기 재고가 빠지므로, 뒤에서 물으면
       「병만 나가고 삽수는 없는」 판이 남는다 — `state.waterCrop` 이 지키는 그 순서 그대로다.
     ★ 위의 검증(마디·용기·초보)이 **먼저** 나는 것도 일부러다. 체력이 바닥이어도 잎꽂이 마디는
       여전히 잎꽂이라, 사유를 체력으로 덮으면 화면이 틀린 안내를 한다.
     ⚠ `tutorialInput` 을 붙인다 — 이건 고장이 아니라 안내다(game.html `isRecoverable`).
       안 붙이면 판이 통째로 잠긴다. */
  {
    const st = canActStamina(S, 'cut');
    if (!st.ok) { const e = new Error('[삽수] ' + st.reason); e.tutorialInput = true; throw e; }
  }

  /* ★ 용기를 실제로 쓴다 — 여기서 재고가 하나 빠진다(§용기값). 없으면 `useStock` 이 던지고,
     그 예외에는 "몇 개가 배송 중인지"까지 들어 있다. 상태는 아직 아무것도 안 바뀌었다.
     ⚠⚠ **용기를 안 정했으면 한 톨도 안 깎는다**(2026-08-17). 깎는 자리는 「용기를 방에
       놓을 때」(`placeCutContainer`) 하나로 옮겼다 — 두 곳에서 깎으면 병 하나로 두 번 낸다. */
  if (cont && cont.itemId) useStock(S, cont.itemId, 1);

  const method = cont ? cont.method : null;
  const mom = momCut || pot;
  const motherChance = Number.isFinite(opt.varieChance) ? opt.varieChance : varieChanceOf(mom);

  /* ★★★ 2026-08-17 — **주사위를 안 던진다.**
     ------------------------------------------------------------
     예전에는 여기서 `rollLineage(w, ...)` 로 원복/유지/고스트를 굴렸다(§⏸ 키메라).
     박사님이 *"마디에 잎수에 따른 확률은 생각하지말자"* 로 걷으셨다. 그래서 이 자리에는
     굴림이 하나도 없고, 갈리는 것은 **무늬 마디냐 아니냐** 둘뿐이다:

       무늬 마디 (variegatedLeaves ≥ 1) → 새 잎 무늬율을 **빛이 정한다.**
                                          뿌리내리는 날까지 **미뤄 둔다**(§③ ─ 어느 순간에)
       무지 마디 (variegatedLeaves = 0) → **모주 값 그대로.** 안 오르고 안 내린다(§⑤)

     ★ `w` 는 **계속 적는다**(`cutW`). 규칙에서는 빠졌지만 「어떤 마디를 잘랐나」는
       사후에 재현·설명할 때 쓰는 기록이고, 옛 세이브와 칸이 같아야 왕복이 안 깨진다.
     ★ `lineage` 는 **새 삽수에 안 적는다**(null). 옛 세이브의 그 칸은 그대로 열린다 —
       거기 적힌 값은 「예전 규칙으로 정해졌던 갈래」라는 기록으로만 남는다. */
  const w = node.leaves > 0 ? node.variegatedLeaves / node.leaves : 0;
  const id = opt.id || nextCuttingId(S);
  const varieCut = node.variegatedLeaves > 0;
  /* 미정일 때도 **숫자는 넣어 둔다**(모주 값). null 을 넣으면 세이브가 0 으로 메꾸고,
     그러면 「아직 안 정했다」와 「0 으로 정해졌다」가 구분이 안 된다.
     ⇒ 「아직 안 정했다」는 `varieLightBand === null` 한 칸이 말한다. */
  const childChance = motherChance;

  const c = {
    id,
    schema: PROPAGATION_SCHEMA,
    motherPotId: pot ? pot.id : null,
    motherCuttingId: momCut ? momCut.id : null,
    motherPlantId: (pot && pot.plantId) || (momCut && momCut.motherPlantId) || null,
    cutOnDay: S.day,
    /* ★ 원본에서 물리적으로 딸려온 것. 굴리지 않는다. **영원히 안 변한다** —
       지금 잎 수는 `leafVarie` 가 갖는다(§삽수가 자란다). */
    source: {
      nodeId: node.nodeId,
      stem: node.stem,
      leaves: node.leaves,
      variegatedLeaves: node.variegatedLeaves,
      growthDays: Number.isFinite(node.growthDays) ? node.growthDays : null,
      /* ★★★ 2026-08-16 — **자를 때 모주가 며칠짜리였나** (박사님: *"줄기 기존 자랐던 거
         그대로 쓰라고"*).
         ══════════════════════════════════════════════════════════════════
         ★ 방이 「자른 그 가지」를 그리려면 **그때의 모주를 그대로 다시 지어야** 한다
           (`plant_assemble.branchOf` — 같은 씨앗·같은 유효 생장일이면 같은 형태가 나온다).
           그런데 그 날짜가 세이브 어디에도 없었다:
             · `source.growthDays` 는 **그 조각이 자란 날**이지 모주 것이 아니다
             · `cutOnDay` 는 **달력 날**이라 유효 생장일과 다르다(마른 날은 안 세어진다)
             · 되짚을 수도 없다 — 지난 빛 이력을 다시 굴려야 한다
         ⇒ **자르는 그 자리에서 적어 둔다.** 형태의 정본은 growth 이므로 코어가 세지 않고
           부르는 쪽이 준 값을 그대로 받는다(`io.growth.growthDays()`).
         ⚠ 안 주면 `null` 이다. **0 으로 메꾸지 않는다** — 0 은 「갓 심은 그루」라는 뜻이라
           그걸로 다시 지으면 **씨앗 한 톨**이 병에 들어앉는다. `null` 이면 방이 옛 길로 간다.
         ⚠ 씨앗도 같이 적는다. 씨앗이 다르면 같은 날짜라도 **다른 그루**가 나온다. */
      motherGrowthDays: Number.isFinite(opt.motherGrowthDays) ? opt.motherGrowthDays : null,
      motherSeed: Number.isFinite(opt.motherSeed) ? opt.motherSeed : null
    },
    /* ★ 지금 달고 있는 잎. 아래(오래된 것)부터 위(생장점)로.
       ★★ 딸려온 무늬 잎을 **위쪽에** 둔다. growth 는 「무늬 잎이 몇 장인가」만 주고 어느 자리인지는
         안 주므로 코어가 자리를 정해야 하는데, 위쪽이 맞다:
         ① 무늬는 **지금 생장점이 내는 것**이고, 생장점에 가까운 잎이 최근 것이다
            (조사 2026-08-04 — "잎은 이미 지나간 생장점의 산물이라 예측이 안 된다"의 뒷면이다.
             그 말은 곧 **최근 잎일수록 지금 조직을 반영한다**는 뜻이다).
         ② ⚠ 아래쪽에 두면 **버그가 된다.** 자를 수 있는 마디는 `i ≥ 1`(밑동은 안 낸다)이라
            무늬 잎이 전부 `i=0` 에 몰려 있으면 어느 마디를 잘라도 `w = 0` 이다 —
            대를 잇는 길이 원리적으로 막힌다. 처음에 아래쪽으로 짰다가
            tools/probe_varie_lineage.mjs 가 「2000판 전부 원복」으로 잡았다. */
    leafVarie: Array.from({ length: node.leaves },
                          (_, i) => i >= node.leaves - node.variegatedLeaves),
    /* ★★ 딸려온 잎의 **등급** (2026-08-17 확정문 §5). 출처가 셋이고 우선순위가 그 순서다:
         ① `opt.leafGrades`  부르는 쪽이 준 것 (화면이 모주 장부 `pot.leafGrades` 에서 읽어 넘긴다)
         ② `node.leafGrades` 마디가 들고 온 것 (모주가 삽수면 `cuttableNodesOfCutting` 이 채운다)
         ③ 없으면          `legacyVarieGradeId()`(산반) — `syncCuttingLeaves` 가 편다
       ⚠ ③ 은 **지어내는 값이 아니다.** 확정문 §5 가 「등급을 모르는 무늬 잎은 산반으로 읽는다」로
         정했고, 그 자리를 옛 세이브와 똑같이 쓴다. 대신 어디서 왔는지가 아래 `leafGradeSrc` 에 남는다. */
    leafGrade: (() => {
      const src = Array.isArray(opt.leafGrades) ? opt.leafGrades
                : Array.isArray(node.leafGrades) ? node.leafGrades : null;
      return Array.from({ length: node.leaves }, (_, i) =>
        (i >= node.leaves - node.variegatedLeaves ? ((src && src[i]) || null) : null));
    })(),
    leafDays: 0,                 // 빛이 든 날만 쌓인다. CUTTING_LEAF_DAYS 마다 잎 한 장
    grewLeaves: 0,               // 자기가 낸 잎 수(딸려온 것 제외) — 재현·표시용
    /* ★★ 2026-08-17 — 용기를 안 정했으면 **둘 다 null 이다.**
       ⚠ 「아직 안 정했다」를 0 이나 'water' 로 메꾸지 않는다 — 메꾸면 가방에 있는 조각이
         물꽂이인 척하고 하루가 흘러 기한이 붙는다. `null` 이라야 `stepCuttings` 가 건너뛴다. */
    method,
    container: cont ? cont.id : null,
    /* **어느 그릇에서 왔나** — 되돌릴 때(`takeCuttingOut`) 같은 이름·같은 자리로 세우려는 것.
       ⚠ `container` 는 「무슨 그릇이냐」(갈래)이고 이 칸은 「그 그릇의 이름」(개체)이다.
         옛 길(자르면서 담기)은 갈래만 있고 이름이 없다 — 그래서 여기가 null 일 수 있다. */
    inContainerId: null,
    /* 시계의 기준일 — §clockDayOf. 담긴 채로 났으면 자른 날이 곧 기준일이다. */
    clockOnDay: cont ? S.day : null,
    gen: Number.isInteger(mom.gen) ? mom.gen + 1 : 1,
    /* 앞으로 날 **새 잎**의 무늬율. 무지 마디면 이 값이 끝이고(§⑤),
       무늬 마디면 뿌리내리는 날 **빛이 덮어쓴다**(§③). */
    varieChance: childChance,
    /* ★★ 빛이 정했나 — `null` 이면 **아직 안 정했다.** 정해지면 'dark'|'mid'|'bright' 가 적힌다.
       ⚠ 이 한 칸이 「미정」과 「0 으로 정해졌다」를 가른다. 숫자로 뭉개면 구분이 사라진다. */
    varieLightBand: null,
    /* ★ 무늬 마디에서 떴나 — 빛 판정을 기다리는 대상인가. 자를 때 확정되고 안 변한다. */
    varieFromCut: varieCut,
    /* ⏸ `lineage` 는 **새 삽수에 안 적는다**(2026-08-17). 옛 세이브의 그 칸만 남는다 */
    lineage: opt.lineage || null,
    lineageKnown: false,
    cutW: +w.toFixed(6),         // 자를 때 그 마디가 얼마나 희었나(사후 검증·재현용)
    /* 이 삽수가 '무늬 개체'인가. 딸려온 무늬 잎이 있으면 그렇다 — 굴릴 것이 없다 */
    variegated: varieCut,
    varieRolled: true,
    slotId: null,
    at: null,
    /* ★ 용기가 없으면 **가방**이다 — 자리도 시계도 없다(§CUTTING_STATUS_KO.bag) */
    status: cont ? 'rooting' : 'bag',
    days: 0,
    rootedOnDay: null,
    nodeOnDay: null,
    deadlineDay: null,
    warned: [],
    potted: false
  };
  syncCuttingLeaves(c);

  S.cuttings.push(c);
  if (opt.at) setCuttingAt(S, c, opt.at, opt);

  /* ★ 실제로 잘랐으니 손을 쓴다. **던진 뒤가 아니라 성공한 뒤**에 깎는다 —
     실패한 동작에 체력을 물리면 "아무 일도 안 났는데 오늘이 끝났다"가 된다
     (loop.harvestCrop 의 그 주석과 같은 규칙이다). */
  spendStamina(S, 'cut');

  const log = typeof opt.log === 'function' ? opt.log : null;
  /* 어디로 갔나 — 로그 한 조각. 용기를 안 정했으면 **가방**이다(문구를 두 벌로 안 쓴다) */
  const whereKo = cont ? `${cont.ko} · ${METHODS[method].ko}` : '가방';

  /* ── 모주가 받는 영향 ────────────────────────────────────────────────
     ★ 모주가 삽수면 **잎이 그 자리에서 실제로 빠진다.** 코어가 그 잎을 들고 있기 때문이다.
       화분은 그럴 수 없다 — growth 가 자기 형태를 되돌리는 창구가 없어서(plant_grow 계약에
       그런 함수가 없다) **적어만 둔다.** "줄였다"고 말하면 화면과 어긋난 거짓말이 되고,
       아무 데도 안 적으면 잘라낸 사실이 사라진다.
       growth 가 다개체 리팩터에서 그 표를 읽어 적용한다(docs/handoff/core-to-growth.md). */
  if (momCut) {
    const at = Number(String(node.nodeId).split('#')[1]);
    momCut.leafVarie = (momCut.leafVarie || []).slice(0, at);   // 그 마디 위가 통째로 떨어져 나갔다
    /* ★ 등급 배열도 **같은 자리에서** 자른다. 길이가 갈리면 남은 잎의 등급이 한 칸씩 밀린다 */
    momCut.leafGrade = (momCut.leafGrade || []).slice(0, at);
    syncCuttingLeaves(momCut);
    /* ⚠ 삽수 모주에는 `cuts` 장부를 안 남긴다. 화분의 그것은 **아직 안 반영된 손실**을 적어 두는
       것이라 뜻이 있는데(growth 가 형태를 못 깎으므로), 삽수는 잎이 바로 위에서 빠져서
       적어 둘 미반영분이 없다. 없는 뜻의 장부를 두면 세이브에 안 실린 상태가 하나 생긴다. */
    if (log)
      log(`✂ 삽수 ${momCut.id} 의 ${node.nodeId} 마디를 잘랐습니다 — ` +
          `잎 ${node.leaves}장${node.variegatedLeaves ? ` (무늬 ${node.variegatedLeaves}장)` : ''} · ` +
          `${whereKo} · ${momCut.id} 에 잎 ${momCut.leaves}장이 남았습니다`);
  } else {
    if (!Array.isArray(pot.cuts)) pot.cuts = [];
    pot.cuts.push({ day: S.day, cuttingId: id, nodeId: node.nodeId, stem: node.stem, leaves: node.leaves });
    pot.pendingCutLoss = {
      leaves: ((pot.pendingCutLoss && pot.pendingCutLoss.leaves) || 0) + node.leaves,
      nodes: ((pot.pendingCutLoss && pot.pendingCutLoss.nodes) || 0) + 1
    };
    pot.motherEnded = !!pot.motherEnded || wouldEndMother;
    if (log) {
      log(`✂ ${pot.id} 의 ${node.nodeId}(${node.stem}) 마디를 잘랐습니다 — ` +
          `잎 ${node.leaves}장${node.variegatedLeaves ? ` (무늬 ${node.variegatedLeaves}장)` : ''} · ` +
          `${whereKo}`);
      log(`  ⤷ 모주 형태 반영은 대기 중입니다(잎 -${pot.pendingCutLoss.leaves} · ` +
          `마디 -${pot.pendingCutLoss.nodes}) — 생장 창이 다개체 리팩터에서 적용합니다`);
      if (wouldEndMother) log(`⚠ ${pot.id} 에 예비혹이 남지 않았습니다 — 모주는 새 생장점을 못 냅니다`);
    }
  }

  if (log) {
    /* ★★ 2026-08-17 — 「무엇을 걸었나」가 아니라 **「무엇이 자리로 갈리나」**를 적는다.
       거는 것이 없어졌으므로(주사위를 안 던진다) 도박 결과를 감출 이유도 없다.
       ⚠ 숫자를 손으로 적지 않는다 — `cutPlanOf` 가 상수에서 읽어 짓는다(§2.8). */
    if (varieCut) {
      const t = Object.keys(VARIE_LIGHT)
        .map(s => `${VARIE_LIGHT_KO[s]} ${Math.round(VARIE_LIGHT[s] * 100)}%`).join(' · ');
      log(`  ⤷ 무늬 마디입니다(무늬 ${node.variegatedLeaves}/${node.leaves}장) — ` +
          `새 잎 무늬율은 **뿌리내리는 자리의 빛**이 정합니다: ${t}`);
    }
    if (method === 'water')
      log(`  ⤷ ${METHODS.water.rootDays}일 뒤 뿌리 · ${METHODS.water.nodeDays}일 뒤 혹 → ` +
          `그때부터 ${graceDaysOf('water', novice)}일 안에 분갈이해야 삽니다`);
    else if (method === 'pot')
      log(`  ⤷ ${METHODS.pot.rootDays}일 뒤 자리를 잡고 ${METHODS.pot.nodeDays}일 뒤 혹이 납니다 — ` +
          `기한도 죽음도 없습니다`);
    else
      /* ★ 가방에 있는 동안은 **하루가 안 간다.** 그 사실을 말해 준다 — 안 말하면
         플레이어가 「꽂는 걸 잊어서 늦어졌다」를 버그로 읽는다(조용한 실패의 반대쪽). */
      log(`  ⤷ 가방에 들어왔습니다 — 방에 놓은 용기에 넣어야 시작합니다 ` +
          `(넣기 전에는 날이 안 갑니다)`);
  }
  return c;
}

/* ============================================================
   ⑤ 자리 — 화분·시루와 **같은 함수**를 탄다
============================================================ */
export function setCuttingAt(S, cuttingOrId, at, opt = {}) {
  const c = typeof cuttingOrId === 'string'
    ? (S.cuttings || []).find(x => x.id === cuttingOrId) : cuttingOrId;
  if (!c) throw new Error(`[삽수] 모르는 삽수: ${cuttingOrId}`);
  /* 불변식은 place.resolvePlacement 한 곳에만 있다 — 화분(setPotAt)·시루(setCropAt)와 같은 함수다 */
  const r = resolvePlacement(c.id, at, opt);
  c.at = r.at;
  c.slotId = r.slotId;
  /* ★ 그릇은 따로 안 옮긴다 — **삽수가 그릇을 지고 있다**(§⑤-2 ★★). 든 그릇은 빈 그릇
     목록에 없으므로 옮길 줄 자체가 없고, 그래서 「병만 제자리에 남는」 어긋남이 원리적으로 없다. */
  return { cuttingId: c.id, slotId: r.slotId, at: r.at, snappedTo: r.snappedTo, dist: r.dist };
}

/* ============================================================
   ⑤-2 ★★★ **용기를 먼저 놓고, 나중에 넣는다** (2026-08-17 · 박사님 ②④⑤⑥)
   ------------------------------------------------------------
   박사님 원문:
     ② *"유리병을 먼저 가구처럼 배치하고 거기다 넣고 싶은 삽수를 드래그해서 배치하거나
        유리병을 골라서 넣을 수 있도록 하자"*
     ④ *"수경 재배 중 클릭 누르면 팝업 기능에 다시 삽수 인벤으로 기능을 넣어서 …"*
     ⑤ *"화분 배치 후 거기다가 심을 수 있도록 하자"*
     ⑥ *"그 후 유리병도 클릭 시 인벤 회수 버튼이 있도록"*
   그리고 2026-08-17 추가: *"삽수 후 수경 안 하고 바로 화분 심는 것도 가능하도록 하자 동일하게."*

   ══ 왜 새 사상이 아닌가 ═══════════════════════════════════════════════════
   이 저장소에는 **이미 같은 손버릇이 셋** 있다. 전부 「빈 그릇을 놓고 → 심는다」다:
       시루     `state.placeSiru(sow:false)` → `state.sowCrop`
       재배판   같은 길(2026-08-11 무순이 먼저 왔고 2026-08-16 콩나물이 따라왔다)
       화분     `state.placeEmptyPot`        → `state.plantMonsteraSeed`
   ⇒ 여기서는 그 길을 **베끼지 않고 그대로 따른다.** 순서 계약도 같다:
       ① 던질 수 있는 것을 다 던져 본다(용기 갈래 · 재고 · 자리)
       ② 다 됐으면 재고를 뺀다   ③ 목록에 남긴다
     중간에 던지면 아무것도 안 바뀐다.

   ══ ★★★ 2026-08-17 고쳐 씀 — **용기는 한 갈래다** (박사님이 물리셨다) ═══════════
   ⚠ 처음에 나는 `S.cutContainers`(삽수용)와 `state.emptyPots`(씨앗용)를 **갈라 두었다.**
     박사님이 그 구분을 통째로 물리셨다. 원문:
       *"**삽수 꽂기가 뭐야? 용도가 아니라 거기 심어지는 거에 따라 나뉘어야지.**
         지금 채소 씨앗 심는 거랑은 다르게. **씨앗심기 누르면 심을 수 있는 인벤 템 리스트가
         팝업으로 나와서 고르도록** 하자."*
   ⇒ **「삽수용 포트」와 「씨앗용 화분」이라는 구분이 없다.** 놓을 때는 그냥 빈 그릇이고,
     **거기 무엇이 들어가느냐는 「심을 때」 고른다.** 규칙이 목록을 좁힐 뿐이다 —
     유리 수경병은 삽수만 받으므로(`accepts`) 그 팝업에는 삽수만 뜬다.

   ══ 그래서 목록이 **하나**다 — `S.emptyPots` ═════════════════════════════
   `S.cutContainers` 를 **통째로 걷었다**(하루 살았다). 방에 놓인 빈 그릇은 전부
   `S.emptyPots` 한 줄기로 산다. 뜻은 예전과 **똑같다** — *"놓았지만 아직 아무것도 안 들어간 그릇"*.
     한 줄 = { id, container, itemId, at, slotId, placedOnDay, usedOnDay }
       id           `pot_02` … 방에서 이 그릇을 가리키는 이름.
                    ⚠ 씨앗을 심으면 **이 id 가 그대로 화분 id 가 된다**(state.plantMonsteraSeed
                      가 `opt.id` 로 받는다). 그래서 `S.pots` 와 이름이 겹치면 안 된다.
       container    'jar' | 'soil'  (CONTAINERS 의 열쇠). **옛 줄에는 없다** → itemId 로 읽는다
       itemId       상점 품목 열쇠 — 걷을 때 이 이름으로 돌려준다
       at · slotId  자리. 화분·시루와 **같은 규약**(place.resolvePlacement)
       usedOnDay    한 번이라도 무언가 들어앉았나 — **걷을 때 돌아오나**가 이 칸으로 갈린다

   ★★ **`cuttingId` 칸이 없다.** 이 목록에는 **빈 그릇만** 산다:
        · 씨앗이 들어가면  → `S.pots` 로 승격되고 이 줄은 빠진다 (예전 그대로)
        · 삽수가 들어가면  → **삽수가 그릇을 지고 간다**(`c.container`·`c.at`·`c.slotId`) 이 줄은 빠진다
        · 삽수를 도로 빼면 → 그 그릇이 **이 목록으로 돌아온다**(같은 id·같은 자리)
     ⇒ 양쪽에서 서로를 가리키는 칸이 없으므로 **어긋날 곳이 없다.** 그리고 화면은
       「이 그릇이 어느 목록 것인가」를 영영 안 물어도 된다 — 그것이 박사님이 물리신 그 물음이다.

   ══ 왜 이 파일이 그 목록을 만지나 (판단) ═════════════════════════════════
   칸은 `state.js` 가 내고(`newState`) 화면이 읽는 이름도 그쪽 것인데, 쓰는 함수는 여기 있다.
     ① **규칙이 여기 있다** — 어느 갈래가 어느 방식인지(`method`) · 무엇을 받는지(`accepts`) ·
        팔 때 돌아오는지(`returnsOnSale`) · 에셋이 정해졌는지(`ready`). 전부 `CONTAINERS` 다.
     ② **거꾸로는 순환이다.** `state.js` 가 `plantableInto`·`plantInto` 를 내려면
        여기를 import 해야 한다(state → propagation). 그러면 여기서 state 를 못 부른다.
        ⇒ 그래서 이 파일은 `S.emptyPots` 를 **직접** 만진다. 이 저장소가 이미 쓰는 수법이다
          (`shop.js` 가 `ts.varieSale` 을 직접 적는다 — *"거꾸로 import 하면 순환이 된다"*).
     ③ `state.placeEmptyPot`·`removeEmptyPot` 은 **그대로 산다** — 아래 창구로 넘길 뿐이다.
        화면(`game.html`)이 부르던 이름이 하나도 안 바뀐다.
============================================================ */

/* 방에 놓인 **빈 그릇** 목록. 이름은 `state.js §emptyPots` 것이다(위 ★★ 참고). */
export function emptyContainersOf(S) { return (S && S.emptyPots) || []; }

export function containerRowOf(S, id) {
  if (!id) return null;
  return emptyContainersOf(S).find(x => x && x.id === id) || null;
}

/* 상점 품목 → 용기 갈래. **옛 줄에는 `container` 칸이 없다** — 그때 읽는 길이다.
   ⚠ 지어내지 않는다. 표에 없으면 `null` 이고, 부르는 쪽이 기본값을 정한다. */
export function containerKindOfItem(itemId) {
  if (!itemId) return null;
  for (const k of Object.keys(CONTAINERS))
    if (CONTAINERS[k].itemId === itemId) return k;
  return null;
}

/* 이 줄이 무슨 그릇인가. 적혀 있으면 그것, 없으면 품목으로 읽고, 그래도 모르면 흙이다
   (옛 `emptyPots` 는 전부 `itemId:'pot'` 이라 흙으로 읽히는 것이 맞다). */
export function containerKindOf(row) {
  if (!row) return null;
  return row.container || containerKindOfItem(row.itemId) || 'soil';
}

/* ★ 이름은 **화분과 같은 우물**에서 뽑는다. 씨앗을 심으면 이 id 가 그대로 화분 id 가 되므로
   (`state.plantMonsteraSeed(opt.id)`) `S.pots` 와 겹치면 자리·세이브·방뷰가 갈린다.
   ⚠ `state.nextPotId` 와 **같은 식**이다. 두 벌이 된 것은 순환 import 를 피하려는 것뿐이고,
     둘이 갈리면 이름이 겹치므로 한쪽을 고치면 다른 쪽도 고쳐야 한다(검사가 그 겹침을 본다). */
function nextContainerId(S) {
  const used = new Set([...(S.pots || []), ...(S.emptyPots || [])].map(p => p && p.id));
  for (let i = 2; i < 1000; i++) {
    const id = `pot_${String(i).padStart(2, '0')}`;
    if (!used.has(id)) return id;
  }
  throw new Error('[용기] 그릇 이름이 바닥났습니다');
}

/* 빈 용기 하나를 방에 놓는다. **여기서 재고가 빠진다**(§용기값 — 깎는 자리는 한 곳이다).
     container  'jar' | 'soil'
     at         놓을 좌표. opt.slots·size·snapDist 는 setCuttingAt 과 같다
     opt.id     이름을 지정하고 싶을 때(재현·검사용)
     opt.log    로그 콜백
   반환 { id, container, containerKo, itemId, at, slotId, left } */
export function placeCutContainer(S, container, at, opt = {}) {
  if (!S) throw new Error('[용기] 상태가 없습니다');
  const cont = CONTAINERS[container];
  if (!cont) throw new Error(`[용기] 모르는 용기입니다: ${container} ` +
    `(아는 것: ${Object.keys(CONTAINERS).join(', ')})`);
  if (!cont.ready)
    throw new Error(`[용기] ${cont.ko} 는 아직 못 씁니다 — 에셋이 정해지지 않았습니다 ` +
      `(docs/propagation.md §4 ⏸ 물꽂이 트레이)`);
  if (!cont.itemId)
    throw new Error(`[용기] ${cont.ko} 는 상점 품목이 없어 놓을 수 없습니다`);

  /* ★★★ 2026-08-17 — **어느 화분을 골랐나** (박사님: *"화분 구매 시 모양이 안 나와…
     배치해도 처음 화분하고 똑같에"* · *"화분1+모종포트1 해야 배치되는 거야?"*)
     ══════════════════════════════════════════════════════════════════
     ⚠⚠ 여기까지는 그릇을 **셋**만 알았다(유리병 · 트레이 · 검은 모종포트). 꾸미는 화분
       넷(`shop.POT_KINDS`)은 이 표에 없어서 `containerKindOfItem` 이 `null` 을 내고
       **검은 모종포트로 떨어졌다.** 그래서 콘크리트 사각 화분을 골라도
         · 나가는 재고가 **검은 모종포트**였고(그래서 「둘이 드는 것처럼」 보였다)
         · 놓인 그릇의 모양이 **기본 화분**이었다.
       실측: 사각 1 · 모종포트 1 로 시작해 사각을 놓았더니 **모종포트가 0** 이 됐다.
     ⇒ 그릇의 **방식**(흙에 심는다)은 그대로 두고, 실제로 나가는 **품목**과 **모양·지름**만
       갈아 낀다. 방식을 새로 만들면 삽수 계통이 통째로 갈라진다.
     ⚠ 안 주면 예전 그대로다 — 옛 세이브·옛 호출부가 한 글자도 안 바뀐다. */
  const itemId = opt.itemId || cont.itemId;
  /* ① **묻기만 한다.** 여기서는 한 톨도 안 뺀다 (state.placeEmptyPot 이 쓰던 그 순서) */
  assertStockAll(S, [{ itemId, qty: 1 }]);
  const id = opt.id || nextContainerId(S);
  /* ② 자리 — 여기서 재 본다(던질 수 있다). 아직 아무것도 안 썼다 */
  const spot = resolvePlacement(id, at, opt);
  /* ③ 다 됐다. 이제 뺀다 */
  useStock(S, itemId, 1);
  if (!Array.isArray(S.emptyPots)) S.emptyPots = [];
  const row = { id, container: cont.id, itemId,
                /* ★ 고른 화분의 모양·지름 — 없으면 그릇 기본값이다(§opt.itemId) */
                ...(opt.potAsset ? { potAsset: opt.potAsset } : {}),
                ...(Number.isFinite(opt.potD) ? { potD: opt.potD } : {}),
                at: spot.at, slotId: spot.slotId, placedOnDay: S.day,
                /* ★ 한 번이라도 무언가 들어앉았나 — **걷을 때 돌아오나**가 여기서 갈린다.
                   검은 모종포트는 흙째 쓰는 소모품이라(`returnsOnSale:false`) 한 번 쓰면
                   안 돌아오고, 유리 수경병은 소모품이 아니라 언제나 돌아온다.
                   ⚠ 이 칸이 없으면 「심고 → 빼고 → 걷고」로 포트가 공짜가 된다(경제가 샌다). */
                usedOnDay: opt.usedOnDay == null ? null : opt.usedOnDay };
  S.emptyPots.push(row);
  const log = typeof opt.log === 'function' ? opt.log : null;
  if (log) log(`🫙 빈 ${cont.ko}를 놓았습니다 — [🌱 심기]를 눌러 ` +
               `${cont.accepts.includes('seed') ? '씨앗이나 삽수를' : '삽수를'} 골라 주세요`);
  return { ...row, containerKo: cont.ko, accepts: cont.accepts, left: S.emptyPots.length };
}

/* 빈 용기를 방에서 걷어 **재고로 돌려준다** (박사님 ⑥).
   ★ 이 목록에는 **빈 그릇만** 있으므로(§⑤-2 머리말) 「안에 뭐가 들었나」를 물을 것이 없다.
     삽수가 든 그릇은 애초에 이 목록에 없다 — 삽수가 지고 있다. 화면이 그 그릇을 누르면
     **삽수 팝업**이 뜨고 거기 [가방으로](`takeCuttingOut`)가 있다. 그것이 「먼저 빼야 한다」다.
   ★ 돌려주는 것은 `returnContainer` 다 — 상점이 「판 것」으로 안 세게(돌아온 것은 수입이 아니다). */
export function removeContainer(S, containerId, opt = {}) {
  const ct = containerRowOf(S, containerId);
  if (!ct) {
    /* ⚠ 못 찾은 까닭이 「삽수가 들고 있다」일 수 있다. 그러면 **그렇게 말해 준다** —
       「모르는 용기」라고만 하면 화면이 왜 안 되는지를 못 말한다(조용한 실패의 사촌이다). */
    const held = (S.cuttings || []).find(c => c && c.inContainerId === containerId);
    if (held) {
      const e = new Error(`[용기] 그 그릇에는 삽수 ${held.id} 가 들어 있습니다 — ` +
        `먼저 삽수를 가방으로 빼 주세요(takeCuttingOut)`);
      e.tutorialInput = true; throw e;
    }
    throw new Error(`[용기] 모르는 용기입니다: ${containerId}`);
  }
  S.emptyPots = emptyContainersOf(S).filter(x => x !== ct);
  /* ★ 돌아오나 — **`CONTAINERS` 가 정한다**(여기서 갈래 이름을 다시 적지 않는다).
       유리 수경병 : 소모품이 아니다 → 언제나 돌아온다
       검은 모종포트 : 흙째 쓴다 → **한 번이라도 들어앉았던 것이 있으면 안 돌아온다**
     ⚠ 안 쓴 채로 걷는 것은 「잘못 놓았다」를 되돌리는 일이라 둘 다 돌아온다. */
  const kind = containerKindOf(ct);
  const cont = CONTAINERS[kind] || {};
  const returns = !!ct.itemId && (cont.returnsOnSale === true || ct.usedOnDay == null);
  if (returns) returnContainer(S, ct.itemId, 1);
  const log = typeof opt.log === 'function' ? opt.log : null;
  if (log) log(`📦 ${cont.ko || kind} 를 걷었습니다` +
               (returns ? ' — 가방으로 돌아왔습니다' : ' (한 번 쓴 것이라 돌아오지 않습니다)'));
  return { id: ct.id, container: kind, itemId: ct.itemId, returned: returns,
           left: emptyContainersOf(S).length };
}

/* ★★ 넣기 — 가방의 삽수를 방에 놓인 용기에 넣는다. **여기서 시계가 시작된다.**
   ------------------------------------------------------------
   ★ `status:'rooting'` · `days:0` · `clockOnDay = 오늘` 이다. 「자른 날」이 아니라
     **넣은 날**이 기준이다(§clockDayOf) — 안 그러면 가방에 오래 둔 조각이 첫날 죽는다.
   ⚠ **한 그릇에 하나**다(`capacity` 1). 이미 든 그릇에 또 넣으면 던진다.
   ⚠ 잎 수 조건은 `methodLeafBlock` **그 함수**가 다시 본다 — 잎 두 장짜리는 병에 안 들어가고
     흙에는 들어간다(§WATER_LEAF_MAX). 사유를 두 곳에서 짓지 않는다.
   ★ **재고를 안 건드린다.** 용기값은 놓을 때 이미 냈다.
   ★ **체력을 안 쓴다** — `state.sowCrop`(놓인 용기에 씨앗 뿌리기)이 안 쓰는 그 판단 그대로다.
     자르는 것이 손이고(`ACT_COST.cut` 은 `takeCutting` 이 이미 물렸다) 꽂는 것은 그 손의 뒷마무리다.
     ⚠ 이건 **판단**입니다 — 물리게 하려면 `canActStamina(S,'sow')` 한 줄이고, 그때는
       밸런스 창과 같이 정해야 합니다.
   반환 삽수 객체 */
export function putCuttingIn(S, cuttingOrId, containerId, opt = {}) {
  const c = typeof cuttingOrId === 'string'
    ? (S.cuttings || []).find(x => x.id === cuttingOrId) : cuttingOrId;
  if (!c) throw new Error(`[삽수] 모르는 삽수: ${cuttingOrId}`);
  if (c.status === 'dead') throw new Error(`[삽수] ${c.id} 는 이미 시들었습니다`);
  if (c.container || c.inContainerId) {
    const e = new Error(`[삽수] ${c.id} 는 이미 ` +
      `${(CONTAINERS[c.container] || {}).ko || c.container} 에 들어 있습니다 — ` +
      `먼저 가방으로 빼 주세요`);
    e.tutorialInput = true; throw e;
  }
  const ct = containerRowOf(S, containerId);
  if (!ct) {
    /* ⚠ 이미 삽수가 든 그릇이면 **그렇게 말해 준다**(빈 그릇만 목록에 있으므로 못 찾는다) */
    const held = (S.cuttings || []).find(x => x && x.inContainerId === containerId);
    const e = new Error(held
      ? `[삽수] 그 그릇에는 이미 삽수 ${held.id} 가 들어 있습니다 — 그릇 하나에 하나입니다`
      : `[삽수] 모르는 용기입니다: ${containerId} — 방에 놓인 빈 그릇이라야 합니다`);
    if (held) e.tutorialInput = true;
    throw e;
  }
  const kind = containerKindOf(ct);
  const cont = CONTAINERS[kind];
  if (!cont) throw new Error(`[삽수] 용기 ${ct.id} 의 갈래가 이상합니다: ${kind}`);
  /* ★ **그 그릇이 삽수를 받나** — 「용도」가 아니라 그릇의 규칙이다(§accepts).
     지금은 셋 다 삽수를 받으므로 이 줄이 안 걸린다. 그래도 적어 둔다 — 씨앗만 받는
     그릇이 생기는 날 말없이 새지 않게. */
  if (!cont.accepts.includes('cutting')) {
    const e = new Error(`[삽수] ${cont.ko} 에는 삽수를 못 넣습니다`);
    e.tutorialInput = true; throw e;
  }

  /* ⚠ 잎 수 — 사유를 내는 곳은 `methodLeafBlock` 한 곳이다(위 ★) */
  {
    const lb = methodLeafBlock(cont.method, cuttingStatsNow(c).leaves);
    if (lb) { const e = new Error(`[삽수] ${c.id} — ${lb}`); e.tutorialInput = true; throw e; }
  }

  /* ★★ 그릇이 **목록에서 빠진다** — 이제 이 그릇은 삽수가 지고 다닌다(§⑤-2 머리말 ★★).
     ⚠ 여기서 빼야 「빈 그릇 목록」이 정말로 빈 것만 담는다. 안 빼면 화면이 그 그릇에
       또 [심기]를 내밀고, 방뷰가 빈 그릇과 든 그릇을 **두 번** 그린다. */
  S.emptyPots = emptyContainersOf(S).filter(x => x !== ct);

  c.container = cont.id;
  c.method = cont.method;
  /* ★ 어느 그릇에서 왔나 — **되돌릴 때 같은 이름·같은 자리로 세우기 위한 것**이다.
     ⚠ 「지금 어느 목록에 있나」가 아니다. 그 그릇은 지금 목록에 없다. */
  c.inContainerId = ct.id;
  c.status = 'rooting';
  c.days = 0;
  c.clockOnDay = S.day;
  c.rootedOnDay = null;
  c.nodeOnDay = null;
  c.deadlineDay = null;
  c.warned = [];
  c.potted = false;
  c.at = ct.at;
  c.slotId = ct.slotId;

  const log = typeof opt.log === 'function' ? opt.log : null;
  if (log) {
    const m = METHODS[cont.method];
    log(`🫙 삽수 ${c.id} 를 ${cont.ko} 에 넣었습니다 — ${m.ko} 시작` +
        (m.canDie
          ? ` (${m.rootDays}일 뒤 뿌리 · ${m.nodeDays}일 뒤 혹 → ` +
            `그때부터 ${graceDaysOf(cont.method, isNoviceMode(S))}일 안에 분갈이해야 삽니다)`
          : ` (${m.rootDays}일 뒤 자리를 잡고 ${m.nodeDays}일 뒤 혹 — 기한도 죽음도 없습니다)`));
  }
  return c;
}

/* ★★ 삽수가 지고 있던 그릇을 **빈 그릇 목록에 도로 세운다.**
   ------------------------------------------------------------
   부르는 데가 둘이다 — **회수**(`takeCuttingOut`)와 **죽음**(`stepCuttings §④`).
   ★ 왜 죽을 때도 세우나: **유리병은 안 시든다.** 삽수가 말라 죽었다고 병까지 없어지면
     아무도 말 안 한 7,000원짜리 벌이 하나 붙는 것이고, 그건 이 파일이 §③ 에서 금지한
     「조용히 사라지는 것」이다. 그릇은 남고 안에 든 것만 사라진다 — 그게 실제 그림이다.
   ⚠ **`usedOnDay` 를 적는다.** 한 번 무언가 들어앉았던 그릇이다 — 안 적으면
     「심고 → 죽고 → 걷고」로 모종포트가 새것이 되어 돌아온다(경제가 샌다).
   ⚠ 왔던 이름(`inContainerId`)을 그대로 쓰되, 그 이름이 이미 쓰이고 있으면 새로 뽑는다 —
     겹친 이름을 밀어 넣으면 자리·세이브·방뷰가 서로 다른 것을 가리킨다. */
function putContainerBack(S, c) {
  const cont = CONTAINERS[c.container] || null;
  if (!Array.isArray(S.emptyPots)) S.emptyPots = [];
  const wantId = c.inContainerId && !containerRowOf(S, c.inContainerId) &&
                 !(S.pots || []).some(p => p && p.id === c.inContainerId)
    ? c.inContainerId : nextContainerId(S);
  const ct = { id: wantId, container: c.container || null,
               itemId: cont ? cont.itemId : null,
               at: c.at || null, slotId: c.slotId || null,
               placedOnDay: S.day, usedOnDay: S.day };
  S.emptyPots.push(ct);
  return ct;
}

/* ★★ 회수 — 삽수를 가방으로 되돌린다. **용기는 방에 빈 채로 남는다**(박사님 ④).
   ------------------------------------------------------------
   ══ 언제 되나 — **살아 있으면 언제든** (판단 · 까닭을 적으라 하셨다) ══════════
   박사님 ④ 는 *"혹이 나서 성장이 멈춘 삽수를 다시 인벤으로"* 다. 「혹 난 뒤에만」으로 좁힐
   수도 있었는데 **안 좁혔다.** 넷이다:
     ① 그 말씀은 **「혹 난 것도 되돌릴 수 있어야 한다」는 요구**이지 「그 전에는 못 뺀다」는
        금지가 아니다. 넓게 열어도 요구가 그대로 지켜진다.
     ② **넣기가 아무 때나 되는데 빼기만 막으면 되돌릴 길이 없다.** 잎 1장짜리를 엉뚱한
        병에 꽂은 실수가 영영 안 풀리고 병 재고까지 묶인다. 이 저장소는 「놓은 것은 걷을 수
        있다」를 이미 규칙으로 삼는다(`state.removeEmptyPot`).
     ③ **남용이 이득이 되는 길이 없다.** 빼면 시계가 멈추고, 다시 넣으면 `days:0` 으로
        **처음부터** 다시 돈다(위 `putCuttingIn`). 빼는 것은 언제나 **손해이거나 본전**이다.
     ④ 규칙이 하나면 화면도 하나다 — 팝업의 [가방으로] 단추가 회색이 되는 경우가 없다.
   ⚠ 죽은 삽수는 못 뺀다. 그건 이미 사라진 것이고 되돌릴 수 없다(§⑥ 과 같은 규약).
   ⚠⚠ **분갈이 기한을 걷은 것이 아니다.** 기한은 그대로 돈다(박사님 확정 —
     *"혹이 나면 성장이 멈추되 기한은 그대로"*). 회수는 그 기한을 **피하는 또 하나의 길**이고,
     대신 시계가 처음으로 돌아가므로 값을 치른다.

   ★ **그릇을 목록에 도로 세운다** — 왔던 이름(`inContainerId`)과 지금 자리 그대로.
     옛 길로 담긴 삽수(자르면서 바로 병에 꽂은 것 · `inContainerId` 가 없다)도 마찬가지로
     그 자리에 세워 준다 — 병은 물리적으로 거기 있었으니 남는 것이 맞고, 재고는 안 건드린다
     (놓을 때 이미 냈다). 안 그러면 회수가 병 하나를 조용히 없앤다.
   ⚠ **`usedOnDay` 를 적는다.** 이 그릇에는 삽수가 들어앉아 있었다 — 안 적으면
     「심고 → 빼고 → 걷고」로 모종포트가 새것이 되어 돌아온다(경제가 샌다).
   반환 { cuttingId, containerId, container } */
export function takeCuttingOut(S, cuttingOrId, opt = {}) {
  const c = typeof cuttingOrId === 'string'
    ? (S.cuttings || []).find(x => x.id === cuttingOrId) : cuttingOrId;
  if (!c) throw new Error(`[삽수] 모르는 삽수: ${cuttingOrId}`);
  if (c.status === 'dead')
    throw new Error(`[삽수] ${c.id} 는 이미 시들었습니다 — 되돌릴 수 없습니다`);
  if (c.status === 'bag' || (!c.container && !c.inContainerId)) {
    const e = new Error(`[삽수] ${c.id} 는 이미 가방에 있습니다`);
    e.tutorialInput = true; throw e;
  }

  const kind = c.container || null;
  const cont = CONTAINERS[kind] || null;
  const ct = putContainerBack(S, c);
  const contKo = (cont && cont.ko) || kind;
  c.container = null;
  c.method = null;
  c.inContainerId = null;
  c.status = 'bag';
  c.days = 0;
  c.clockOnDay = null;
  c.rootedOnDay = null;
  c.nodeOnDay = null;
  c.deadlineDay = null;
  c.warned = [];
  c.potted = false;
  c.at = null;
  c.slotId = null;

  const log = typeof opt.log === 'function' ? opt.log : null;
  if (log) log(`🎒 삽수 ${c.id} 를 ${contKo} 에서 꺼내 가방에 넣었습니다 — ` +
               `${contKo} 는 방에 빈 채로 남습니다 (다시 넣으면 처음부터 시작합니다)`);
  return { cuttingId: c.id, containerId: ct.id, container: kind };
}

/* ★ 자리를 잃은 삽수를 회수한다 — 화분(state.rehomePot)과 **같은 두 경우**만 본다.
     ① 올라앉았던 가구가 사라졌다   ② 방이 바뀌어 그 좌표가 방 밖이다
   조용히 옮기지 않는다. 갈 자리가 없으면 자리만 비우되 삽수는 살려 둔다 —
   자리가 없다고 죽이면 방을 옮겼다는 이유로 삽수가 사라진다(유령의 반대쪽 사고). */
export function rehomeCuttings(S, room, log) {
  const out = [];
  /* ★★ 2026-08-17 — **빈 그릇(`S.emptyPots`)도 같이 본다.** 삽수가 든 그릇은 삽수가 지고
     있어서 아래에서 같이 옮겨지지만, 빈 그릇은 **아무도 안 봤다** — 받치던 가구가 사라지면
     허공에 남는다. 빈 화분이 생긴 2026-08-16 부터 있던 구멍이고 여기서 같이 막는다.
     ⚠ 규칙을 새로 짓지 않는다 — 아래 삽수와 **똑같은 두 경우**(가구가 사라졌다 · 방 밖이다)다. */
  for (const ct of emptyContainersOf(S)) {
    let why = null;
    if (ct.at) {
      if (room && room.size && !inRoom(ct.at, room.size)) why = '자리가 방 밖입니다';
      else if (ct.at.onUid && room && room.surfaces && !room.surfaces.has(ct.at.onUid))
        why = `받치던 ${ct.at.onUid} 이(가) 사라졌습니다`;
    } else if (ct.slotId && !isFreeSlotId(ct.slotId) &&
               !((room && room.slots) || []).some(s => s && s.slotId === ct.slotId)) {
      why = `슬롯 ${ct.slotId} 이(가) 이 방에 없습니다`;
    }
    if (!why) continue;
    const dest = ((room && room.slots) || [])[0] || null;
    if (dest && [dest.x, dest.y, dest.z].every(v => Number.isFinite(v))) {
      ct.at = atFromSlot(dest); ct.slotId = dest.slotId;
      if (log) log(`용기 ${ct.id} 회수 — ${why} · ${ct.slotId} 로 옮겼습니다`);
    } else {
      ct.at = null; ct.slotId = null;
      if (log) log(`용기 ${ct.id} 자리 해제 — ${why}`);
    }
    out.push({ id: ct.id, why, kind: 'container' });
  }
  for (const c of S.cuttings || []) {
    /* ★ 가방에 있는 조각은 자리가 없다 — 회수할 것이 없다 */
    if (c.status === 'bag' || (!c.at && !c.slotId)) continue;
    let why = null;
    if (c.at) {
      if (room && room.size && !inRoom(c.at, room.size)) why = '자리가 방 밖입니다';
      else if (c.at.onUid && room && room.surfaces && !room.surfaces.has(c.at.onUid))
        why = `받치던 ${c.at.onUid} 이(가) 사라졌습니다`;
    } else if (c.slotId && !isFreeSlotId(c.slotId) &&
               !((room && room.slots) || []).some(s => s && s.slotId === c.slotId)) {
      why = `슬롯 ${c.slotId} 이(가) 이 방에 없습니다`;
    }
    if (!why) continue;

    /* ★ 회수 자리는 **state.rehomePot 과 같은 규칙**이다 — 슬롯 목록의 첫 자리(=가장 밝은 자리).
       좌표를 `atFromSlot` 으로 그대로 옮긴다. 여기서 방 치수 검사를 다시 걸지 않는다:
       "방이 바뀌어 옛 좌표가 방 밖"인 상황에서 새 방의 추천 자리로 옮기는 중인데,
       그 자리를 옛 치수로 재면 회수 자체가 던진다(화분이 이미 그 규칙을 쓴다). */
    const dest = ((room && room.slots) || [])[0] || null;
    if (dest && [dest.x, dest.y, dest.z].every(v => Number.isFinite(v))) {
      c.at = atFromSlot(dest);
      c.slotId = dest.slotId;
      if (log) log(`삽수 ${c.id} 회수 — ${why} · ${c.slotId} 로 옮겼습니다`);
    } else {
      c.at = null; c.slotId = null;
      if (log) log(`삽수 ${c.id} 자리 해제 — ${why} (삽수는 살아 있습니다)`);
    }
    /* ★ 그릇은 따로 안 옮긴다 — 삽수가 지고 있다(§⑤-2 ★★) */
    out.push({ id: c.id, why });
  }
  return out;
}

/* ============================================================
   ⑥ 하루 — 진행·경고·죽음
   ------------------------------------------------------------
   ★ 순서가 계약이다: **경고가 죽음보다 먼저** 나간다. 같은 날 둘 다 나는 일은 없다 —
     마지막 경고는 기한 하루 전에 이미 나갔다.
============================================================ */
export const CUTTING_STATUS_KO = Object.freeze({
  /* ★★ 2026-08-17 — **가방**. 잘라만 두고 아직 용기에 안 넣은 조각이다(§⑤-2).
     ⚠ 이 상태에서는 **하루가 안 간다** — `days` 도 기한도 안 돈다. 시계는 넣을 때 시작한다. */
  bag: '가방에 있다 — 용기에 넣어야 시작한다',
  rooting: '뿌리내리는 중',
  rooted: '뿌리를 냈다',
  node: '혹이 났다 — 분갈이 필요',
  established: '자리를 잡았다',
  dead: '죽었다'
});

/* 그날 경고를 낼 것인가. 반환값은 경고 열쇠(중복 방지용) 또는 null. */
function warnKeyFor(daysLeft, grace, novice) {
  if (daysLeft <= 0) return null;
  if (daysLeft === grace) return 'w_node';                 // 혹이 난 그 날
  if (daysLeft === Math.ceil(grace / 2)) return 'w_half';  // 유예 절반
  if (novice && daysLeft <= 3) return `w_last${daysLeft}`;  // 초보는 마지막 3일 매일
  if (!novice && daysLeft === 1) return 'w_last1';
  return null;
}

/* ⏸ **대체됨(2026-08-17).** 고스트가 뿌리내린 뒤 버티던 날.
   ⚠ **고스트로 죽는 일이 없어졌다**(박사님). 이 상수는 옛 세이브를 읽을 때 사유를 적기 위해
     이름만 남는다 — `stepCuttings` 는 이제 이 시계를 안 돌린다. */
export const GHOST_DECLINE_DAYS = CUTTING_LEAF_DAYS;

/* ★★ 빛이 무늬 소질을 정하는 순간 — **뿌리를 낸 날** (2026-08-17 §③).
   ------------------------------------------------------------
   무늬 마디에서 뜬 삽수(`varieFromCut`)만 대상이다. 무지 삽수는 모주 값 그대로라 여기 안 온다.
   ⚠ 빛을 못 재면 **아무것도 안 한다.** 다음 날 다시 묻는다 — 모르면 안 정한다(§③).
   ★ 그래서 이 함수는 뿌리내림 뒤에도 매일 불린다. 한 번 정해지면(`varieLightBand`) 안 바뀐다. */
function resolveVarieLight(S, c, lit, events, log) {
  if (!c.varieFromCut || c.varieLightBand) return;
  const step = varieLightStepOf(lit && lit.band);
  if (!step) return;                                  // 못 쟀다 — 내일 다시
  const p = varieChanceFromLight(lit.band, { gen: c.gen, genRise: varieGenRiseOf(S) });
  if (p == null) return;
  c.varieLightBand = step;
  c.varieChance = p;
  c.variegated = true;
  const e = { id: 'cutting_varie_light', cuttingId: c.id, step, band: lit.band, varieChance: p,
              ko: `삽수 ${c.id} — ${VARIE_LIGHT_KO[step]}은 자리에서 뿌리를 냈습니다. ` +
                  `새 잎 무늬율 ${(p * 100).toFixed(0)}%` };
  events.push(e);
  if (log) log('✨ ' + e.ko);
}

/* ⏸ **대체됨(2026-08-17).** 갈래가 드러나던 순간의 로그·사건.
   ⚠ **옛 세이브 전용**이다 — 새 삽수는 `lineage` 가 null 이라 여기 안 온다.
     옛 판의 삽수가 뿌리를 낼 때 「예전 규칙으로 정해져 있던 갈래」를 한 번 말해 준다.
     고스트라도 **더는 죽지 않는다** — 그 사실을 문구에 적는다(조용히 규칙을 바꾸지 않는다). */
function revealLineage(c, events, log) {
  if (c.lineageKnown || !c.lineage) return;
  c.lineageKnown = true;
  if (c.lineage === 'ghost') {
    const e = { id: 'cutting_ghost', cuttingId: c.id,
                ko: `삽수 ${c.id} — 예전 판에서 정해진 고스트입니다. ` +
                    `규칙이 바뀌어 **이제 시들지 않습니다**(2026-08-17)` };
    events.push(e);
    if (log) log('👻 ' + e.ko);
  } else if (c.lineage === 'revert') {
    const e = { id: 'cutting_revert', cuttingId: c.id,
                ko: `삽수 ${c.id} — 예전 판에서 무늬가 빠진(원복) 삽수입니다` +
                    (c.variegatedLeaves ? ` (달고 있던 무늬 잎 ${c.variegatedLeaves}장은 그대로입니다)` : '') };
    events.push(e);
    if (log) log('🌿 ' + e.ko);
  } else {
    const e = { id: 'cutting_chimera', cuttingId: c.id,
                ko: `삽수 ${c.id} — 예전 판에서 무늬를 물려받은 삽수입니다. 새 잎 무늬율 ` +
                    `${((c.varieChance || 0) * 100).toFixed(1)}%` };
    events.push(e);
    if (log) log('✨ ' + e.ko);
  }
}

/* 하루 진행. loop.nextDay 가 하루에 한 번 부른다.
     opt.log      로그 콜백(코어는 pushLog 를 넘긴다)
     opt.lightOf  ★ (삽수) → { dli, grows } | null. **빛 판정은 코어가 안 한다** —
                  그 자리의 DLI 와 "그 빛이면 자라나"는 둘 다 growth 소유다(loop.js 가 물어 준다).
                  없으면 삽수는 **안 자란다**(잎이 안 는다). 뿌리내림·기한은 빛과 무관하므로
                  그대로 돈다 — 그게 propagation.md §3 의 "등은 증식의 세금이 아니다" 다.
   반환 { events, died, warnings, grewLeaves } */
export function stepCuttings(S, opt = {}) {
  const log = typeof opt.log === 'function' ? opt.log : null;
  const lightOf = typeof opt.lightOf === 'function' ? opt.lightOf : null;
  const novice = isNoviceMode(S);
  const events = [], died = [], warnings = [];
  let grewLeaves = 0;
  if (!S || !Array.isArray(S.cuttings) || !S.cuttings.length)
    return { events, died, warnings, grewLeaves };

  const alive = [];
  for (const c of S.cuttings) {
    if (c.status === 'dead') { died.push(c); continue; }
    /* ★★ 2026-08-17 — **가방에 있는 삽수는 하루가 안 간다**(§⑤-2 · CUTTING_STATUS_KO.bag).
       ⚠ 여기서 안 걸러 내면 바로 아래 `METHODS[c.method]` 가 `undefined` 라 **던진다** —
         가방에 조각 하나만 있어도 하루 넘기기가 통째로 막힌다.
       ★ 굶기는 것이 아니다. 자리도 빛도 없는 물건이라 셀 것이 없을 뿐이고,
         시계는 `putCuttingIn` 이 켠다(그것이 박사님 ② 의 뜻이다). */
    if (c.status === 'bag' || !c.method) { alive.push(c); continue; }
    c.days++;
    const m = METHODS[c.method];
    if (!m) throw new Error(`[삽수] ${c.id} 의 방식이 이상합니다: ${c.method}`);

    /* ★ 오늘 이 자리의 빛. **판정은 코어가 안 한다** — growth 의 밴드를 받아 쓸 뿐이다.
       예전에는 잎 자라는 데서만 물었는데, 이제 **무늬 소질도 빛이 정하므로**(§③)
       한 번 물어 두 곳이 같이 쓴다. 하루에 두 번 물으면 같은 날 빛이 둘이 될 수 있다. */
    const lit = lightOf ? lightOf(c) : null;

    /* ① 뿌리 */
    if (c.status === 'rooting' && c.days >= m.rootDays) {
      c.rootedOnDay = S.day;
      /* ⏸ 옛 세이브의 갈래를 **드러내기만** 한다(2026-08-17 · 새 삽수는 lineage 가 null).
         ⚠ 예전에는 여기서 「lineage 가 없으면 옛 규칙으로 한 번 굴린다」를 했다.
           **그 굴림을 걷었다** — 지금은 lineage 가 없는 것이 정상이고, 굴릴 규칙도 없다. */
      revealLineage(c, events, log);
      /* ⚠ 고스트 시계를 **안 건다.** 옛 세이브가 들고 온 값도 여기서 지운다(§고스트 시계). */
      c.ghostDeadlineDay = null;

      if (m.canDie) {
        c.status = 'rooted';
        events.push({ id: 'cutting_rooted', cuttingId: c.id,
                      ko: `삽수 ${c.id} — 뿌리를 냈습니다${c.variegated ? ' (무늬)' : ''}` });
      } else {
        /* 화분 직삽은 뿌리가 곧 활착이다 — 기한도 다음 단계도 없다 */
        c.status = 'established';
        c.potted = true;
        events.push({ id: 'cutting_established', cuttingId: c.id,
                      ko: `삽수 ${c.id} — 화분에서 자리를 잡았습니다${c.variegated ? ' (무늬)' : ''}` });
      }
      if (log) log('🌱 ' + events[events.length - 1].ko);
    }

    /* ①-2 ★★ **빛이 무늬 소질을 정한다** (2026-08-17 §③) — 뿌리를 낸 뒤부터.
       ⚠ 예전에 여기 있던 것은 「고스트 시계」였다. **통째로 걷었다** —
         박사님이 세 갈래를 없애시면서 *"고스트로 죽는 일이 없다"* 가 됐다.
       ★ 뿌리내림 자체는 여전히 빛과 무관하다. 빛이 걸리는 것은 **소질과 새 잎**뿐이다. */
    if (c.status !== 'rooting') resolveVarieLight(S, c, lit, events, log);

    /* ①-3 ★ 자란다 — 흙에 자리를 잡은 뒤부터, 빛이 든 날만 (§삽수가 자란다).
       ⚠ 2026-08-17 — 「고스트는 안 자란다」를 걷었다. 고스트가 안 죽으니 멈춰 세울 까닭도 없다.
         옛 판의 고스트는 그냥 무늬 소질이 높은 삽수로 이어진다(§save.migrate 가 천장으로 낮춘다). */
    /* ⚠⚠ 2026-08-17 — `leafGrowthStopped` 가 여기 걸린다: **수경은 혹이 나면 잎이 멈춘다**
       (박사님 ③). 흙은 안 걸린다 — 혹이 나도 계속 자란다. 까닭은 그 함수 머리말. */
    if (c.status === 'established' && !leafGrowthStopped(c)) {
      if (lit && lit.grows) {
        c.leafDays = (c.leafDays || 0) + 1;
        while (c.leafDays >= CUTTING_LEAF_DAYS) {
          c.leafDays -= CUTTING_LEAF_DAYS;
          /* 새 잎의 무늬 — **물려받은 소질**이 여기서 쓰인다. 잎마다 따로, 한 번만 굴린다
             (growth 의 `varieRoll` 과 같은 사고 — 한 번 정하면 안 바뀐다). */
          const idx = (c.leafVarie || []).length;
          const seed = (S.sim && S.sim.seed) || 0;
          const roll = cuttingHash(seed, `${c.id}L${idx}`, 4);
          const varie = roll < (c.varieChance || 0);
          /* ★★ 무늬가 났으면 **어느 등급인가**를 그 자리에서 정한다 (확정문 §3).
             ------------------------------------------------------------
             ⚠ **소금(salt)을 따로 쓴다**(4 → 5). 같은 난수로 「났나」와 「무엇인가」를 둘 다
               정하면 둘이 붙어 버린다 — 무늬가 겨우 난 잎(roll 이 문턱 바로 아래)은 언제나
               제일 흔한 등급이 되고, 「어두운 데서도 아주 드물게 풀문」이 원리적으로 사라진다.
             ⚠ 못 재면(빛 미정) **`null` 로 둔다.** `syncCuttingLeaves` 가 값을 매길 때만
               산반으로 편다 — 「모른다」와 「산반으로 정해졌다」는 다른 말이다.
             ★ 어느 밝기로 굴리나 — 이 삽수의 `varieLightBand`(뿌리내린 날 정해진 것)를 먼저 보고,
               없으면 오늘 그 자리의 밴드를 쓴다. 두 벌의 빛 축을 만들지 않는다. */
          const step = c.varieLightBand || varieLightStepOf(lit && lit.band);
          const grade = varie && step
            ? varieGradeFromLight(step, cuttingHash(seed, `${c.id}G${idx}`, 5))
            : null;
          c.leafVarie = [...(c.leafVarie || []), varie];
          c.leafGrade = [...(c.leafGrade || []), grade];
          c.grewLeaves = (c.grewLeaves || 0) + 1;
          syncCuttingLeaves(c);
          grewLeaves++;
          const gko = grade ? (varieGradeRules().byId.get(grade) || {}).ko : null;
          const e = { id: 'cutting_leaf', cuttingId: c.id, variegated: varie, grade: grade || null,
                      ko: `삽수 ${c.id} — 새 잎이 났습니다${varie ? ` (무늬 — ${gko || '등급 미정'}!)` : ''} · ` +
                          `잎 ${c.leaves}장 중 무늬 ${c.variegatedLeaves}장` };
          events.push(e);
          if (log) log((varie ? '🌟 ' : '🍃 ') + e.ko);
        }
      }
    }

    /* ② 혹(다음 마디) — ★★ 2026-08-17 부터 **두 갈래 다 난다.**
       ------------------------------------------------------------
       예전에는 `m.canDie` 로 막아 두어 화분 직삽에는 혹이 **영영 안 났다**(nodeDays 가 null).
       박사님이 화분에 45일을 주셨으므로 그 문을 연다. 갈리는 것은 **기한**뿐이다:
         물꽂이 : 혹 → 분갈이 기한이 돈다(안 하면 죽는다)
         화분   : 혹 → 그것으로 끝. 기한도 죽음도 없다(`deadlineDayOf` 가 null 을 낸다)
       ★ 날짜만 센다 — 빛과 무관하다(§②). 혹은 저장양분이 내는 것이라 광합성이 아니다.
       ★ `nodeOnDay` 하나로 「이미 났나」를 본다. 상태(`status`)로 보면 화분 쪽은
         이미 `established` 라 조건을 못 쓴다 — 그래서 날짜 칸을 열쇠로 삼는다. */
    if (c.nodeOnDay == null && Number.isFinite(m.nodeDays) && c.days >= m.nodeDays &&
        c.status !== 'rooting') {
      c.nodeOnDay = S.day;
      if (m.canDie) {
        c.status = 'node';
        c.deadlineDay = deadlineDayOf(c, novice);
        events.push({ id: 'cutting_node', cuttingId: c.id, needsRepot: true,
                      ko: `삽수 ${c.id} — 다음 마디(혹)가 났습니다. ` +
                          `${graceDaysOf(c.method, novice)}일 안에 분갈이해야 삽니다` });
      } else {
        events.push({ id: 'cutting_node', cuttingId: c.id, needsRepot: false,
                      ko: `삽수 ${c.id} — 다음 마디(혹)가 났습니다. 흙에 있으니 기한은 없습니다` });
      }
      if (log) log('🪴 ' + events[events.length - 1].ko);
    }

    /* ③ 경고 → ④ 죽음. **경고가 먼저다.** */
    if (c.status === 'node' && Number.isFinite(c.deadlineDay)) {
      const daysLeft = c.deadlineDay - S.day;
      const grace = graceDaysOf(c.method, novice);
      const key = warnKeyFor(daysLeft, grace, novice);
      if (key && !c.warned.includes(key)) {
        c.warned.push(key);
        const w = { id: 'cutting_warn', cuttingId: c.id, daysLeft,
                    ko: `삽수 ${c.id} — 분갈이까지 ${daysLeft}일 남았습니다. ` +
                        `안 하면 시들어 사라집니다` };
        warnings.push(w); events.push(w);
        if (log) log('⚠ ' + w.ko);
      }
      if (daysLeft <= 0) {
        /* ★ 경고 없이 죽지 않는다. 경고가 하나도 안 나갔으면 그건 배선 오류다 —
           조용히 죽이지 말고 티가 나게 남긴다(플레이어에게는 죽음이 이미 확정이라
           되돌리지는 않는다. 다음 회차에서 고칠 수 있게 로그로 박아 둔다). */
        if (!c.warned.length && log)
          log(`⛔ 삽수 ${c.id} 가 경고 없이 기한을 넘겼습니다 — 경고 배선을 확인해 주세요`);
        c.status = 'dead';
        c.diedOnDay = S.day;
        /* ★★ 2026-08-17 — **그릇은 안 죽는다.** 빈 그릇으로 방에 남는다(§putContainerBack).
           ⚠ 이 줄이 없으면 유리병이 삽수와 같이 조용히 사라진다 — 말 안 한 벌이 하나 붙는다. */
        const back = c.container ? putContainerBack(S, c) : null;
        const e = { id: 'cutting_died', cuttingId: c.id, containerId: back ? back.id : null,
                    ko: `삽수 ${c.id} 가 시들어 사라졌습니다 — ` +
                        `혹이 난 뒤 ${grace}일 안에 분갈이하지 않았습니다` +
                        (back ? ` (${(CONTAINERS[back.container] || {}).ko || back.container} 는 ` +
                                `방에 빈 채로 남습니다)` : '') };
        events.push(e); died.push(c);
        if (log) log('💀 ' + e.ko);
        continue;                                     // 살아남은 목록에 넣지 않는다 = 사라진다
      }
    }
    alive.push(c);
  }

  /* ★ "죽어서 없어진다" — 배열에서 뺀다. 다만 **로그가 먼저 남은 뒤**다(위 순서). */
  S.cuttings = alive;
  return { events, died, warnings, grewLeaves };
}

/* ============================================================
   ⑦ 분갈이 — 물꽂이를 흙으로 옮긴다. 죽기 전이면 언제든 된다
============================================================ */
export function repotCutting(S, cuttingOrId, opt = {}) {
  const c = typeof cuttingOrId === 'string'
    ? (S.cuttings || []).find(x => x.id === cuttingOrId) : cuttingOrId;
  if (!c) throw new Error(`[삽수] 모르는 삽수: ${cuttingOrId}`);
  if (c.status === 'dead')
    throw new Error(`[삽수] ${c.id} 는 이미 사라졌습니다 — 되돌릴 수 없습니다`);
  if (c.potted)
    throw new Error(`[삽수] ${c.id} 는 이미 흙에 있습니다`);
  /* ★ 2026-08-17 — 가방에 있는 조각은 옮길 것이 없다. **먼저 넣어야** 한다(§⑤-2).
     ⚠ 이 줄이 없으면 바로 아래 `METHODS[c.method].rootDays` 가 `undefined` 에서 터진다 —
       사유 없는 TypeError 는 화면이 안내로 못 읽는다. */
  if (c.status === 'bag' || !c.method) {
    const e = new Error(`[삽수] ${c.id} 는 가방에 있습니다 — ` +
      `먼저 방에 놓은 용기에 넣어 주세요(putCuttingIn)`);
    e.tutorialInput = true; throw e;
  }
  if (c.status === 'rooting')
    throw new Error(`[삽수] ${c.id} 는 아직 뿌리가 없습니다 — ` +
      `${METHODS[c.method].rootDays}일째부터 옮길 수 있습니다 (지금 ${c.days}일째)`);

  /* ★★ 체력 — 오늘 분갈이할 손이 남았나 (docs/stamina.md · `ACT_COST.repot`).
     ★ **재고를 만지기 전에** 묻는다. 뒤에서 물으면 포트만 빠지고 삽수는 병에 남는다.
     ⚠ 여기서 막히는 것은 **되돌릴 수 있는 상황**이다 — 기한 안이면 내일 하면 되고,
       그래서 `tutorialInput` 이 맞다(고장이 아니라 "오늘은 여기까지"라는 안내다). */
  {
    const st = canActStamina(S, 'repot');
    if (!st.ok) { const e = new Error('[삽수] ' + st.reason); e.tutorialInput = true; throw e; }
  }

  /* ★ 분갈이도 **포트를 하나 쓴다**. 옮겨 심으려면 심을 그릇이 있어야 한다 —
     이게 없으면 "죽는 길을 피하는 것"이 공짜가 되고, 물꽂이의 기한이 벌이 아니게 된다.
     ★ 빠져나온 병은 **돌아온다**(returnsOnSale 과 같은 이유 — 병은 소모품이 아니다). */
  const from = CONTAINERS[c.container] || null;

  /* ★★★ 2026-08-09 — **자리를 먼저 정하고, 다 되면 그때 상태를 찍는다.**
     ------------------------------------------------------------
     예전에는 `potted = true` · `status = 'established'` 를 먼저 찍고 자리를 **나중에** 줬다.
     자리 주기(`resolvePlacement`)가 던지면 삽수는 이미 「흙에 선」 것으로 바뀌어 있는데
     `slotId` 가 없어 **빛이 null 이 된다.** 오류는 던져졌지만 판은 이미 바뀐 뒤라,
     그 삽수는 살아 있고 죽지도 않으면서 **영영 안 자란다** — 조용한 실패다.
     ⇒ 던질 수 있는 일을 **다 끝낸 뒤에** 상태를 바꾼다. 던지면 아무것도 안 바뀐다.
     (같은 날 `state.resowCrop`·`state.placeSiru` 도 같은 병이었고 `shop.assertStockAll` 로
      「묻고 나서 빼는」 순서를 세웠다. `tools/test_resow_atomic.mjs` 가 그 본보기다.)
     ★ 왜 `resolvePlacement` 를 직접 부르나 — `setCuttingAt` 은 **재는 일과 쓰는 일**을
       한 함수에 담고 있다. 재는 쪽만 먼저 부르면 순서를 가를 수 있다(그 함수는 순수하다). */
  const spot = opt.at ? resolvePlacement(c.id, opt.at, opt) : null;

  /* ⚠ 순서가 계약이다: ① **던질 수 있는 것을 다 던져 본다**(체력·자리) → ② 재고를 뺀다
       → ③ 상태를 찍는다 → ④ 체력을 깎는다.
     `useStock` 도 모자라면 던지지만 그때는 아직 상태를 안 찍었으므로 판이 안 바뀐다.
     자리를 ② 뒤로 미루면 「포트만 빠지고 삽수는 병에 남는」 예전 병으로 돌아간다. */
  useStock(S, CONTAINERS.soil.itemId, 1);
  /* ★ 병은 **예전 그대로 재고로 돌아온다** — 물꽂이는 병에서 뽑아 옮겨 심는다(§용기값).
     ★★ 2026-08-17 — 한때 「방에 서 있는 병이 둘이 된다」를 걱정해 이 줄을 갈랐었다.
       **목록을 하나로 합치면서 그 걱정이 사라졌다**: 삽수가 든 그릇은 빈 그릇 목록에
       애초에 없다(삽수가 지고 있다). 그러니 여기서 돌려줘도 겹칠 그릇이 없다.
       ⇒ 손에 남은 병을 가방에 넣는 것이고, 그것이 플레이어가 실제로 하는 일이다.
     ⚠ 그래서 이 줄은 2026-08-17 이전과 **한 글자도 안 다르다**(검사 C 가 그것을 잰다). */
  if (from && from.returnsOnSale && from.itemId) returnContainer(S, from.itemId);

  c.potted = true;
  c.inContainerId = null;
  c.container = 'soil';
  c.method = 'pot';
  c.status = 'established';
  c.deadlineDay = null;
  c.pottedOnDay = S.day;
  if (spot) { c.at = spot.at; c.slotId = spot.slotId; }

  /* ★ 성공한 뒤에 깎는다 (위 takeCutting 과 같은 규칙) */
  spendStamina(S, 'repot');

  const log = typeof opt.log === 'function' ? opt.log : null;
  if (log) log(`🪴 삽수 ${c.id} 를 분갈이했습니다 — 이제 죽지 않습니다` +
               `${c.variegated ? ' (무늬 개체)' : ''}`);
  return c;
}

/* ============================================================
   ⑧ 읽기 — 화면·다른 창이 쓰는 것
============================================================ */
export function cuttingsOf(S) { return (S && S.cuttings) || []; }

export function cuttingSnapshot(S, c) {
  const novice = isNoviceMode(S);
  const m = METHODS[c.method] || {};
  const deadline = c.status === 'node' ? c.deadlineDay : null;
  const now = cuttingStatsNow(c);
  /* ⚠ 2026-08-17 — **고스트 기한은 이제 없다.** 예전에는 둘 중 급한 쪽을 냈다.
     남은 기한은 분갈이 하나뿐이라 `daysLeft` 도 그것 하나다. `ghostDaysLeft` 는
     화면이 아직 읽고 있을 수 있어 **null 로 계속 낸다**(칸을 조용히 없애지 않는다). */
  const ghostLeft = null;
  const potLeft = deadline == null ? null : deadline - S.day;
  const daysLeft = potLeft;
  return {
    id: c.id, method: c.method, methodKo: m.ko || c.method,
    container: c.container, containerKo: (CONTAINERS[c.container] || {}).ko || c.container,
    /* ★★ 2026-08-17 — 어느 그릇에서 왔나 · 가방에 있나 (§⑤-2).
       화면이 [가방으로] 단추와 [넣기] 단추를 가르는 근거가 이 두 칸이다. */
    inContainerId: c.inContainerId || null,
    inBag: c.status === 'bag' || !c.method,
    /* ★ 수경이 혹으로 멈췄나 (박사님 ③) — 화면이 「왜 잎이 안 느나」를 말할 근거 */
    leafGrowthStopped: leafGrowthStopped(c),
    status: c.status, statusKo: CUTTING_STATUS_KO[c.status] || c.status,
    days: c.days, gen: c.gen,
    /* ★ **지금** 달고 있는 잎이다. `c.source` 는 자를 때 딸려온 기록이라 자란 뒤에는 다르다 */
    leaves: now.leaves, variegatedLeaves: now.variegatedLeaves,
    sourceLeaves: c.source.leaves, sourceVariegatedLeaves: c.source.variegatedLeaves,
    grewLeaves: c.grewLeaves || 0,
    variegated: c.variegated, varieChance: c.varieChance,
    /* ★★ 2026-08-17 — 빛이 소질을 정했나. `null` 이면 아직 안 정해졌다(뿌리 전이거나 빛을 못 쟀다).
       화면이 「어두운 데 두면 20%, 밝은 데 두면 80%」를 말할 근거가 이 두 칸이다. */
    varieLightBand: c.varieLightBand || null,
    varieLightKo: c.varieLightBand ? (VARIE_LIGHT_KO[c.varieLightBand] || null) : null,
    varieFromCut: !!c.varieFromCut,
    varieLightPending: !!c.varieFromCut && !c.varieLightBand,
    /* ⏸ 갈래 — **옛 세이브에만 있다.** 새 삽수는 언제나 null 이다 */
    lineage: c.lineageKnown ? (c.lineage || null) : null,
    lineageKo: c.lineageKnown ? (LINEAGE_KO[c.lineage] || null) : null,
    cutW: c.cutW ?? null,
    /* ★ 혹이 났나 — 화분 직삽에도 이제 혹이 난다(기한은 없다) */
    nodeOnDay: c.nodeOnDay ?? null,
    nodeDays: (METHODS[c.method] || {}).nodeDays ?? null,
    /* 다음 잎까지 — 빛이 드는 날만 준다. 화면이 "왜 안 자라나"를 말할 수 있게 같이 낸다 */
    leafDays: c.leafDays || 0, leafEveryDays: CUTTING_LEAF_DAYS,
    canCut: c.status === 'established' && now.leaves >= 2,
    motherPotId: c.motherPotId, motherCuttingId: c.motherCuttingId || null,
    nodeId: c.source.nodeId,
    daysLeft, ghostDaysLeft: ghostLeft,
    graceDays: graceDaysOf(c.method, novice),
    slotId: c.slotId, at: c.at
  };
}

/* 방 뷰가 그릴 표시 모형. **여기서 THREE 를 쓰지 않는다** —
   무엇을 그릴지만 말하고, 그리는 것은 방 뷰(다른 창) 몫이다. */
export function cuttingViewModel(c) {
  const cont = CONTAINERS[c.container] || {};
  const now = cuttingStatsNow(c);
  return {
    id: c.id,
    assetId: cont.assetId,               // null 이면 아직 에셋이 없다 — 대체 표현을 쓰라는 뜻
    diameterM: cont.realMaxM || 0.12,
    at: c.at, slotId: c.slotId,
    leaves: now.leaves,                  // ★ 자란 만큼 큰다 — 그려야 하는 것은 지금 모습이다
    variegatedLeaves: now.variegatedLeaves,
    variegated: c.variegated,
    ghost: c.lineageKnown && c.lineage === 'ghost',
    label: `${cont.ko || c.container} · ${CUTTING_STATUS_KO[c.status] || c.status}`
  };
}

/* ★ 삽수를 화분(S.pots)으로 승격 — **이번 범위 밖이다.**
   S.pots 에 두 번째 화분을 넣는 순간 loop.nextDay 가 그걸 못 굴린다(pot0 만 본다).
   화분은 있는데 하루가 안 가는 유령이 생기므로, 조용히 만들지 않고 여기서 던진다. */
export function promoteToPot() {
  throw new Error('[삽수] 삽수를 두 번째 화분으로 승격하는 것은 아직 못 합니다 — ' +
    'plant_grow.html 이 한 그루 전용이라 두 그루를 동시에 굴릴 창구가 없습니다 ' +
    '(docs/handoff/growth-multiplant-design.md). 그 리팩터가 끝난 뒤에 열립니다');
}
