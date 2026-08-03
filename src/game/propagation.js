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
import { useStock, shopOf, CATALOG } from './shop.js';

export const PROPAGATION_SCHEMA = 'cutting/1';

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
   ★ 네 숫자 전부 이미 있는 값에서 나왔다. 새로 만든 것은 하나도 없다.

     rootDays 12   `growth_tuning.mature_prob.gauge_days` 와 같은 12.
                   실제 몬스테라 물꽂이 뿌리 2~3주의 앞쪽이고, 관찰 리듬이 이미 12일이다.
     nodeDays 32   12(뿌리) + 20. 20 은 캐논 `P.bumpGrow` — "혹이 다 돋는 데 걸리는 간격".
     기한     40   32 + 유예 8 = 40 이고, 40 은 캐논 `P.spawnStep`(마디 주기)다.
                   ★ **마디 주기 한 바퀴를 통째로 넘기면 죽는다** — 외우기 쉽고 근거가 하나다.
     직삽     24   12 × 2. 물꽂이보다 **정확히 뿌리내림 기간 하나(12일)만큼** 느리다.
                   차이가 딱 한 덩어리라 "물꽂이가 12일 빠르다"로 읽힌다.
                   24 < 40 이라 마디 주기 안에 들어간다 — 느려도 한 주기를 넘기지는 않는다.

   ★ 뿌리내리는 동안은 **두 갈래 다 빛과 무관하다.** 뿌리는 광합성이 아니라 저장양분으로 낸다.
     그래서 증식은 어두운 칸에서 되고, 슬롯 압박은 그 뒤 '육성'으로 넘어간다
     (docs/propagation.md §3 — "등은 증식의 세금이 아니다").
============================================================ */
export const METHODS = Object.freeze({
  water: Object.freeze({
    id: 'water', ko: '물꽂이',
    rootDays: 12,
    nodeDays: 32,          // 자른 날부터 다음 마디(혹)가 나기까지
    graceDays: 8,          // 혹이 난 뒤 분갈이 유예 (자유·고수)
    graceDaysNovice: 16,   // ★ 초보(스토리)는 두 배 — 아래 §초보 참고
    canDie: true
  }),
  pot: Object.freeze({
    id: 'pot', ko: '화분 직삽',
    rootDays: 24,
    nodeDays: null,
    graceDays: null,
    graceDaysNovice: null,
    canDie: false          // ★ 기한이 없다. 느린 대신 안전하다
  })
});

/* 용기. **방 슬롯을 차지하는 것은 용기**이고 삽수는 그 안에 산다.
   ⏸ 물꽂이 트레이(batch · 6칸 · 등급 ×0.8)는 **에셋이 없어서 이번 범위 밖**이다
      (docs/propagation.md §4 ⏸ — `container_tray_s.glb` 재사용 가능 여부가 leaf 판단 대기).
      규칙(capacity·gradeMult)은 여기 적어 두되 `takeCutting` 이 막는다 — 자리만 잡아 둔 것이다. */
export const CONTAINERS = Object.freeze({
  jar:  Object.freeze({ id: 'jar',  ko: '유리 수경병',   method: 'water', capacity: 1,
                        gradeMult: 1.0, assetId: 'pots/pot_glassjar.glb', realMaxM: 0.13, ready: true,
                        /* 상점 품목 열쇠 · 팔 때 돌아오나 (아래 ★용기값 참고) */
                        itemId: 'jar',  returnsOnSale: true }),
  tray: Object.freeze({ id: 'tray', ko: '물꽂이 트레이', method: 'water', capacity: 6,
                        gradeMult: 0.8, assetId: null,                    realMaxM: 0.36, ready: false,
                        itemId: null,   returnsOnSale: false }),
  soil: Object.freeze({ id: 'soil', ko: '검은 모종포트', method: 'pot',   capacity: 1,
                        gradeMult: 1.0, assetId: null,                    realMaxM: 0.12, ready: true,
                        itemId: 'pot',  returnsOnSale: false })
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
  /* 스토리 모드 전체가 초보다(docs/story_arc.md §0). 코어에서 그 신호는 둘이다:
       · sim.mode === 'novice'
       · 반지하 튜토리얼이 켜져 있다(=스토리 진행 중) */
  if (!S) return false;
  if (S.sim && S.sim.mode === 'novice') return true;
  return !!(S.tutorial && S.tutorial.enabled && !S.tutorial.movedOut);
}

export function graceDaysOf(method, novice) {
  const m = METHODS[method];
  if (!m || !m.canDie) return null;
  return novice ? m.graceDaysNovice : m.graceDays;
}

/* 기한(절대 게임일). `null` 이면 기한 자체가 없다(화분 직삽). */
export function deadlineDayOf(c, novice) {
  const m = METHODS[c.method];
  if (!m || !m.canDie) return null;
  return c.cutOnDay + m.nodeDays + graceDaysOf(c.method, novice);
}

/* ============================================================
   ③ 무늬 상속 — 두 갈래로 나뉜다 (docs/propagation.md §5)
   ------------------------------------------------------------
   ㉮ **딸려간 잎** — 굴리지 않는다. 유전이 아니라 **물리적으로 같은 잎**이다.
      무늬 잎 2장짜리 조각을 자르면 삽수도 무늬 잎 2장으로 시작한다. 100%다.
      (같은 논리로 잠긴 중간잎도 잠긴 채 딸려간다 — propagation.md §5)
   ㉯ **앞으로 날 새 잎** — 세대마다 `gradeMult` 가 곱해진다. batch 0.8 / individual 1.0.
      0.8ⁿ = 0.5 → n ≈ 3.1 이라 **삽수 3세대마다 무늬가 반으로 준다.**

   ⚠ **기준 확률의 정본은 growth 의 `calcVarieProb` 다.** 코어는 감쇠만 곱한다.
     아래 두 값은 propagation.md §5 표(최적관리 normal 19.5%)에서 온 **잠정 기본값**이고,
     호출부가 `opt.varieChance` 로 덮어쓸 수 있다 — first_play.FIRST_PLAY_RULES 와 같은 자리다.
============================================================ */
export const VARIE = Object.freeze({
  variegatedMother: 0.195,   // 무늬 모주의 새 잎 무늬율(최적 관리 · normal 기준)
  plainMother: 0             // ★ plain 은 복제해도 영원히 0 이다 (0 × 0.8 = 0)
});

export function varieChanceOf(pot) {
  if (pot && Number.isFinite(pot.varieChance)) return pot.varieChance;
  return pot && pot.variegated ? VARIE.variegatedMother : VARIE.plainMother;
}

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
  const pot = opt.pot || (opt.potId ? (S.pots || []).find(p => p.id === opt.potId) : (S.pots || [])[0]);
  const motherLeaves = Number.isInteger(opt.motherLeaves) ? opt.motherLeaves : motherLeavesOf(nodes);
  const lost = cutLossOf(pot);
  return {
    motherLeaves,
    lostLeaves: lost.leaves,
    leftLeaves: Math.max(0, motherLeaves - lost.leaves),
    cutNodeIds: ((pot && pot.cuts) || []).map(c => c.nodeId)
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

/* 왜 못 자르나 — 사람이 읽을 수 있는 사유. 없으면 null(자를 수 있다). */
export function cutBlockedReason(S, nodes, nodeId, opt = {}) {
  const node = (nodes || []).find(n => n && n.nodeId === nodeId);
  if (!node) return `모르는 마디입니다: ${nodeId}`;
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
  return null;
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

/* 모주에서 삽수를 하나 떼어 용기에 담는다. **자르기와 담기는 한 동작**이다 —
   실제로도 자르자마자 병에 꽂거나 심고, 나눠 두면 "잘라 놓고 안 담은 조각"이라는
   아무 데도 안 사는 상태가 생긴다.

     S
     opt.potId      모주 화분 id (없으면 S.pots[0])
     opt.nodes      ★ 모주의 마디 목록. **필수** — 코어가 지어내지 않는다.
                    growth_adapter.cuttableNodes() 또는 같은 모양의 값
     opt.nodeId     그중 어느 마디를 자르나
     opt.container  'jar' | 'soil'  (tray 는 에셋 미정이라 막힌다)
     opt.at         놓을 좌표. opt.slots·size·snapDist 는 setPotAt 과 같다
     opt.varieChance  모주의 새 잎 무늬율(정본은 growth). 없으면 varieChanceOf(모주)
     opt.log        로그 콜백
   반환 삽수 객체(S.cuttings 에 들어간 그것) */
export function takeCutting(S, opt = {}) {
  if (!S || !Array.isArray(S.cuttings))
    throw new Error('[삽수] S.cuttings 가 없습니다 — 옛 상태입니다(state.newState 를 쓰세요)');

  const pot = opt.potId ? (S.pots || []).find(p => p.id === opt.potId) : (S.pots || [])[0];
  if (!pot) throw new Error('[삽수] 자를 모주가 없습니다 — 화분이 비어 있습니다');

  const nodes = opt.nodes;
  if (!Array.isArray(nodes) || !nodes.length)
    throw new Error('[삽수] 모주의 마디 목록(opt.nodes)이 없습니다 — ' +
      '어느 마디를 잘랐는지가 결과에 따라가야 하므로 코어가 잎 수를 지어내지 않습니다 ' +
      '(growth_adapter.cuttableNodes 참고)');
  nodes.forEach((n, i) => assertCutNode(n, `nodes[${i}]`));

  const node = nodes.find(n => n.nodeId === opt.nodeId);
  if (!node) throw new Error(`[삽수] 모르는 마디입니다: ${opt.nodeId} ` +
    `(자를 수 있는 것: ${cuttableNow(S, nodes, { potId: pot.id }).map(n => n.nodeId).join(', ') || '없음'})`);

  /* ★ 잎꽂이·잎 없는 조각·이미 잘라낸 마디·없는 잎을 자르는 것 — 사유는 한 곳에서 낸다.
     (예전에는 여기서 stem·잎 수만 봤고, "이미 잘라낸 마디"와 "총량 초과"가 통째로 없었다.) */
  const blocked = cutBlockedReason(S, nodes, node.nodeId, { potId: pot.id });
  if (blocked) throw new Error('[삽수] ' + blocked);

  /* ★ 모주를 끝내는 자르기(③) — **모주에 잎이 한 장도 안 남는** 경우.
     초보(스토리)에서는 **실행 자체가 없다**(propagation.md §2). 자유·고수에서는 경고만 한다.
     ★ 판정을 "다른 마디가 목록에 남아 있나"에서 **"잎이 남나"** 로 바꿨다(2026-08-03).
       growth 목록에는 이미 잘려 나간 자리도 그대로 남아 있어서(위 §유한성) 마디 개수로 세면
       거짓말이 된다 — 잎을 다 잘라낸 뒤에도 "아직 마디가 넷 남았다"고 통과시킨다.
       남은 잎으로 세면 형태를 몰라도 항상 맞고, 초보에서 **모주가 최소 한 장을 지킨다.** */
  const leftAfter = cutBudgetOf(S, nodes, { potId: pot.id }).leftLeaves - node.leaves;
  const wouldEndMother = leftAfter < 1;
  const novice = isNoviceMode(S);
  if (wouldEndMother && novice)
    throw new Error(`[삽수] ${node.nodeId} 를 자르면 모주에 예비혹이 하나도 안 남아 모주가 끝납니다 — ` +
      `초보 모드에서는 이 마디를 자를 수 없습니다`);

  const cont = CONTAINERS[opt.container];
  if (!cont) throw new Error(`[삽수] 모르는 용기입니다: ${opt.container} ` +
    `(아는 것: ${Object.keys(CONTAINERS).join(', ')})`);
  if (!cont.ready)
    throw new Error(`[삽수] ${cont.ko} 는 아직 못 씁니다 — 에셋이 정해지지 않았습니다 ` +
      `(docs/propagation.md §4 ⏸ 물꽂이 트레이). 유리 수경병(jar)이나 화분 직삽(soil)을 쓰세요`);

  /* ★ 용기를 실제로 쓴다 — 여기서 재고가 하나 빠진다(§용기값). 없으면 `useStock` 이 던지고,
     그 예외에는 "몇 개가 배송 중인지"까지 들어 있다. 상태는 아직 아무것도 안 바뀌었다. */
  if (cont.itemId) useStock(S, cont.itemId, 1);

  const method = cont.method;
  const id = opt.id || nextCuttingId(S);

  const motherChance = Number.isFinite(opt.varieChance) ? opt.varieChance : varieChanceOf(pot);
  const c = {
    id,
    schema: PROPAGATION_SCHEMA,
    motherPotId: pot.id,
    motherPlantId: pot.plantId || null,
    cutOnDay: S.day,
    /* ★ 원본에서 물리적으로 딸려온 것. 굴리지 않는다 */
    source: {
      nodeId: node.nodeId,
      stem: node.stem,
      leaves: node.leaves,
      variegatedLeaves: node.variegatedLeaves,
      growthDays: Number.isFinite(node.growthDays) ? node.growthDays : null
    },
    method,
    container: cont.id,
    gen: Number.isInteger(pot.gen) ? pot.gen + 1 : 1,
    /* 앞으로 날 **새 잎**의 무늬율 — 세대마다 gradeMult 가 곱해진다 */
    varieChance: +(motherChance * cont.gradeMult).toFixed(6),
    /* 이 삽수가 '무늬 개체'인가. 딸려온 무늬 잎이 있으면 굴릴 것도 없이 그렇다 */
    variegated: node.variegatedLeaves > 0,
    varieRolled: node.variegatedLeaves > 0,
    slotId: null,
    at: null,
    status: 'rooting',
    days: 0,
    rootedOnDay: null,
    nodeOnDay: null,
    deadlineDay: null,
    warned: [],
    potted: false
  };

  S.cuttings.push(c);
  if (opt.at) setCuttingAt(S, c, opt.at, opt);

  /* ── 모주가 받는 영향 ────────────────────────────────────────────────
     ★ 코어는 모주의 **형태를 못 깎는다.** growth 가 자기 형태를 되돌리는 창구가 없기 때문이다
       (plant_grow 계약에 그런 함수가 없다). 그래서 지금은 **적어만 둔다** —
       "줄였다"고 말하면 화면과 어긋난 거짓말이 되고, 아무 데도 안 적으면 잘라낸 사실이 사라진다.
       growth 가 다개체 리팩터에서 이 표를 읽어 적용한다(docs/handoff/core-to-growth.md). */
  if (!Array.isArray(pot.cuts)) pot.cuts = [];
  pot.cuts.push({ day: S.day, cuttingId: id, nodeId: node.nodeId, stem: node.stem, leaves: node.leaves });
  pot.pendingCutLoss = {
    leaves: ((pot.pendingCutLoss && pot.pendingCutLoss.leaves) || 0) + node.leaves,
    nodes: ((pot.pendingCutLoss && pot.pendingCutLoss.nodes) || 0) + 1
  };
  pot.motherEnded = !!pot.motherEnded || wouldEndMother;

  const log = typeof opt.log === 'function' ? opt.log : null;
  if (log) {
    log(`✂ ${pot.id} 의 ${node.nodeId}(${node.stem}) 마디를 잘랐습니다 — ` +
        `잎 ${node.leaves}장${node.variegatedLeaves ? ` (무늬 ${node.variegatedLeaves}장)` : ''} · ` +
        `${cont.ko} · ${METHODS[method].ko}`);
    log(`  ⤷ 모주 형태 반영은 대기 중입니다(잎 -${pot.pendingCutLoss.leaves} · ` +
        `마디 -${pot.pendingCutLoss.nodes}) — 생장 창이 다개체 리팩터에서 적용합니다`);
    if (wouldEndMother) log(`⚠ ${pot.id} 에 예비혹이 남지 않았습니다 — 모주는 새 생장점을 못 냅니다`);
    if (method === 'water')
      log(`  ⤷ ${METHODS.water.rootDays}일 뒤 뿌리 · ${METHODS.water.nodeDays}일 뒤 혹 → ` +
          `그때부터 ${graceDaysOf('water', novice)}일 안에 분갈이해야 삽니다`);
    else
      log(`  ⤷ ${METHODS.pot.rootDays}일 뒤 자리를 잡습니다 — 기한도 죽음도 없습니다`);
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
  return { cuttingId: c.id, slotId: r.slotId, at: r.at, snappedTo: r.snappedTo, dist: r.dist };
}

/* ★ 자리를 잃은 삽수를 회수한다 — 화분(state.rehomePot)과 **같은 두 경우**만 본다.
     ① 올라앉았던 가구가 사라졌다   ② 방이 바뀌어 그 좌표가 방 밖이다
   조용히 옮기지 않는다. 갈 자리가 없으면 자리만 비우되 삽수는 살려 둔다 —
   자리가 없다고 죽이면 방을 옮겼다는 이유로 삽수가 사라진다(유령의 반대쪽 사고). */
export function rehomeCuttings(S, room, log) {
  const out = [];
  for (const c of S.cuttings || []) {
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

/* 하루 진행. loop.nextDay 가 하루에 한 번 부른다.
     opt.log   로그 콜백(코어는 pushLog 를 넘긴다)
   반환 { events, died, warnings } — 빨리감기·UI 가 이걸 보고 멈추거나 띄운다. */
export function stepCuttings(S, opt = {}) {
  const log = typeof opt.log === 'function' ? opt.log : null;
  const novice = isNoviceMode(S);
  const events = [], died = [], warnings = [];
  if (!S || !Array.isArray(S.cuttings) || !S.cuttings.length) return { events, died, warnings };

  const alive = [];
  for (const c of S.cuttings) {
    if (c.status === 'dead') { died.push(c); continue; }
    c.days++;
    const m = METHODS[c.method];
    if (!m) throw new Error(`[삽수] ${c.id} 의 방식이 이상합니다: ${c.method}`);

    /* ① 뿌리 */
    if (c.status === 'rooting' && c.days >= m.rootDays) {
      c.rootedOnDay = S.day;
      /* ★ 무늬 굴림은 여기서 딱 한 번. 딸려온 무늬 잎이 있으면 이미 확정이라 안 굴린다.
         결과를 상태에 적어 두므로 세이브를 다시 불러도 같은 답이다. */
      if (!c.varieRolled) {
        const roll = cuttingHash((S.sim && S.sim.seed) || 0, c.id, 1);
        c.variegated = roll < c.varieChance;
        c.varieRolled = true;
      }
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

    /* ② 혹 — 여기서부터 기한이 돈다 (물꽂이만) */
    if (m.canDie && c.status === 'rooted' && c.days >= m.nodeDays) {
      c.status = 'node';
      c.nodeOnDay = S.day;
      c.deadlineDay = deadlineDayOf(c, novice);
      events.push({ id: 'cutting_node', cuttingId: c.id,
                    ko: `삽수 ${c.id} — 다음 마디(혹)가 났습니다. ` +
                        `${graceDaysOf(c.method, novice)}일 안에 분갈이해야 삽니다` });
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
        const e = { id: 'cutting_died', cuttingId: c.id,
                    ko: `삽수 ${c.id} 가 시들어 사라졌습니다 — ` +
                        `혹이 난 뒤 ${grace}일 안에 분갈이하지 않았습니다` };
        events.push(e); died.push(c);
        if (log) log('💀 ' + e.ko);
        continue;                                     // 살아남은 목록에 넣지 않는다 = 사라진다
      }
    }
    alive.push(c);
  }

  /* ★ "죽어서 없어진다" — 배열에서 뺀다. 다만 **로그가 먼저 남은 뒤**다(위 순서). */
  S.cuttings = alive;
  return { events, died, warnings };
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
  if (c.status === 'rooting')
    throw new Error(`[삽수] ${c.id} 는 아직 뿌리가 없습니다 — ` +
      `${METHODS[c.method].rootDays}일째부터 옮길 수 있습니다 (지금 ${c.days}일째)`);

  /* ★ 분갈이도 **포트를 하나 쓴다**. 옮겨 심으려면 심을 그릇이 있어야 한다 —
     이게 없으면 "죽는 길을 피하는 것"이 공짜가 되고, 물꽂이의 기한이 벌이 아니게 된다.
     ★ 빠져나온 병은 **돌아온다**(returnsOnSale 과 같은 이유 — 병은 소모품이 아니다). */
  const from = CONTAINERS[c.container] || null;
  useStock(S, CONTAINERS.soil.itemId, 1);
  if (from && from.returnsOnSale && from.itemId) returnContainer(S, from.itemId);

  c.potted = true;
  c.container = 'soil';
  c.method = 'pot';
  c.status = 'established';
  c.deadlineDay = null;
  c.pottedOnDay = S.day;
  if (opt.at) setCuttingAt(S, c, opt.at, opt);

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
  return {
    id: c.id, method: c.method, methodKo: m.ko || c.method,
    container: c.container, containerKo: (CONTAINERS[c.container] || {}).ko || c.container,
    status: c.status, statusKo: CUTTING_STATUS_KO[c.status] || c.status,
    days: c.days, gen: c.gen,
    leaves: c.source.leaves, variegatedLeaves: c.source.variegatedLeaves,
    variegated: c.variegated, varieChance: c.varieChance,
    motherPotId: c.motherPotId, nodeId: c.source.nodeId,
    daysLeft: deadline == null ? null : deadline - S.day,
    graceDays: graceDaysOf(c.method, novice),
    slotId: c.slotId, at: c.at
  };
}

/* 방 뷰가 그릴 표시 모형. **여기서 THREE 를 쓰지 않는다** —
   무엇을 그릴지만 말하고, 그리는 것은 방 뷰(다른 창) 몫이다. */
export function cuttingViewModel(c) {
  const cont = CONTAINERS[c.container] || {};
  return {
    id: c.id,
    assetId: cont.assetId,               // null 이면 아직 에셋이 없다 — 대체 표현을 쓰라는 뜻
    diameterM: cont.realMaxM || 0.12,
    at: c.at, slotId: c.slotId,
    leaves: c.source.leaves,
    variegated: c.variegated,
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
