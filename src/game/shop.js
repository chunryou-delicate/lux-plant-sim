/* ============================================================
   game/shop.js — 인터넷 주문 상점 · 판매 (core 소유) · 2026-08-03 신설
   ------------------------------------------------------------
   박사님 확정(2026-08-03):
     "콩나물 시루를 처음에 주는데 그 이후엔 화분이나 시루용기, 씨앗들을 **인터넷 주문 상점**을
      해서 **하루 이틀 뒤에 오는** 형태로"
     "무늬종 하나 **잭팟** 터뜨려서 팔고 이사 가는 형태로 (꾸준히 모으면 오래 걸리고)"

   정본은 `docs/shop.md`. 값의 근거는 전부 거기에 적혀 있고 **여기서 새 숫자를 만들지 않는다.**
   가격 공식은 `docs/propagation.md` §6, 상점 마진은 `docs/sale_economy.md` §5,
   씨앗값은 `docs/food_economy.md` §3 이다.

   ★ 이 파일이 지키는 선 셋.

     ① **주문은 바로 안 온다.** 사는 순간 돈은 나가고 물건은 1~2일 뒤에 온다.
        그래서 "지금 필요해서 지금 산다"가 아니라 **"미리 시켜 둔다"** 가 된다 —
        배송 중인 것이 상태에 있고 세이브에도 남는다(save.js packShop).

     ② **코어는 잎을 세지 않는다.** 값은 `무늬 잎 비율 v` 가 정하는데, 그 v 는 growth 소유다
        (state.js 머리말 — "생장 나이·잎 수 → growth. 코어는 읽기만 한다").
        그래서 `sellPot` 은 잎 수·무늬 잎 수를 **받아야만** 돌고, 없으면 던진다.
        `propagation.js` 의 `takeCutting` 이 마디 목록 없이는 던지는 것과 같은 규칙이다.

     ③ **파산해도 막히지 않는다.** 돈이 없으면 주문이 안 되는 것뿐이고, 몬스테라는 계속
        자라고 무늬 굴림도 계속 돈다(빛만 되면). 잭팟이 늦어질 뿐 길이 닫히지 않는다.
        §파산 참고.

   ★ THREE 를 쓰지 않는다. DOM 도 타이머도 모른다.
============================================================ */

/* ★ 작물 표를 읽는다 — 씨앗 품목·한 회전분의 정본은 first_play 다(값을 여기 베끼지 않는다).
   ⚠ 순환이 아니다: first_play 는 `place.js` 하나만 import 하고 shop 을 안 부른다. */
import { CROP_KINDS, cropKindIndexOf, cropCycleSavedWon, FIRST_PLAY_RULES,
         slotFitsDiameter } from './first_play.js';

export const SHOP_SCHEMA = 'shop/1';

/* ============================================================
   ① 상점 마진 — 살 때는 정가 × 1.4
   ------------------------------------------------------------
   `sale_economy.md` §3 가격표 머리말: "정가. 살 때는 ×1.4 = 상점 마진".
   즉 **정가는 파는 값**이고 사는 값은 그 1.4배다. 여기서 다시 정하지 않고 그 한 줄을 쓴다.
============================================================ */
export const BUY_MARKUP = 1.4;

/* ============================================================
   ② 품목표 — 값은 전부 근거가 있다 (docs/shop.md §2)
   ------------------------------------------------------------
   listWon  정가(= 파는 값). 사는 값은 listWon × BUY_MARKUP 를 100원 단위로 올림한다.
   leadDays 주문한 날로부터 며칠 뒤에 도착하나. 박사님 "하루 이틀 뒤".
            **가벼운 것(씨앗 봉투)은 1일 · 부피가 있는 것(용기·화분)은 2일**로 갈랐다.
            규칙이 하나라 외우기 쉽고, "급하면 씨앗부터"라는 판단이 생긴다.
============================================================ */
export const CATALOG = Object.freeze({
  /* ★★ 1,500 → **1,000원** (2026-08-04 박사님 확정 "씨앗을 줄여").
     ⚠⚠ **지갑에서 실제로 나가는 씨앗값은 여기다.** `first_play.FIRST_PLAY_RULES.seedWonPerSiru`
       가 아니다 — 재파종(state.resowCrop)은 미리 주문해 둔 재고를 쓰고, 돈은 주문할 때
       `orderItem` 이 이 값으로 뺀다. 그래서 저쪽만 고치면 **순액이 한 푼도 안 바뀐다.**
       두 값은 늘 같아야 한다(둘 다 "콩 씨앗 1시루분"이다). 하나만 고치면 화면이 말하는 값과
       지갑에서 나가는 값이 갈린다 — 실제로 이 판이 그 상태였다.
     근거는 first_play.js §seedWonPerSiru 와 같다: 실제 나물콩 1시루분이 700~1,200원이고,
     1,500원이면 씨앗값이 절감의 70%를 먹어 순액이 하루 180원(지출의 0.9%)밖에 안 남았다. */
  /* ★★★ 2026-08-09 — **정본을 한 자리로 모았다.** 값을 여기 안 적고 작물 표에서 읽는다.
     예전에는 `CROP_KINDS[0].seedWonPerPot` 과 여기 두 곳에 같은 숫자가 있었고,
     "늘 같은 값이어야 한다"는 주석만으로 지키게 되어 있었다 — 실제로 갈렸다.
     이제 **가리키는 것**이라 갈릴 수가 없다. `tools/test_econ.mjs` 가 그 등식도 못 박는다.
     ⚠ 여기는 **정가**(=파는 값)다. 실구매가는 `buyPriceOf` 가 ×1.4·100원 올림으로 낸다:
       정가 350원 → **실구매 500원** (박사님 확정값은 실구매 쪽이다). */
  bean_seed: Object.freeze({
    id: 'bean_seed', ko: '콩 씨앗 (1시루분)', kind: 'seed',
    listWon: CROP_KINDS[0].seedWonPerPot, leadDays: 1,
    note: 'first_play.CROP_KINDS.beansprout.seedWonPerPot 이 정본이다(여기서 읽는다). ' +
          '정가 350원 → 실구매 500원 (2026-08-09 박사님 확정)'
  }),
  /* ⚠ 콩 씨앗과 **더는 같은 값이 아니다** (2026-08-04). 예전 근거였던 "콩 1시루와 같은 값"은
     콩 쪽이 내려가면서 끊겼다 — 이 값은 sale_economy.md §3 가 직접 적은 1,500원으로 선다.
     몬스테라 씨앗은 파는 물건(수입)의 씨앗이고 콩은 지출을 막는 물건이라 축이 애초에 다르다. */
  monstera_seed: Object.freeze({
    id: 'monstera_seed', ko: '몬스테라 씨앗 (1립)', kind: 'seed',
    listWon: 1_500, leadDays: 1,
    note: 'docs/sale_economy.md §3 가격표 — "몬스테라 씨앗 1립 1,500"'
  }),
  /* ★★ 2026-08-09 박사님 확정 — **실구매 7,000 → 5,000원.**
     ⚠ 여기는 정가라 5,000 을 그대로 적으면 실구매가 7,000원 그대로다.
     ⚠⚠ **정가 3,500 이 아니다.** 3,500 × 1.4 = 4,900 인데 4,900 은 이미 100원 단위라
       올림이 아무 일도 안 한다 — 실구매가 **4,900원**이 된다(재서 확인했다).
       실구매 5,000원을 내는 정가는 3,500 < L ≤ 3,571 구간이고, 그 안의 고른 값이 **3,550원**이다
       (3,550 × 1.4 = 4,970 → 100원 올림 5,000). `tools/test_econ.mjs §D` 가 이 값을 잰다. */
  siru: Object.freeze({
    id: 'siru', ko: '콩나물 시루 (차광 용기)', kind: 'container',
    listWon: 3_550, leadDays: 2,
    note: '2026-08-09 박사님 확정 — 정가 3,550원 → 실구매 5,000원. ' +
          '예전 근거(sale_economy.md §4 "묘목 5,000원")는 정가 5,000원이었는데 ' +
          '그러면 실구매가 7,000원이 된다 — 박사님이 정하신 것은 **실구매** 쪽이다'
  }),
  pot: Object.freeze({
    id: 'pot', ko: '검은 모종포트', kind: 'container',
    listWon: 5_000, leadDays: 2,
    note: 'docs/propagation.md §4 CONTAINERS.soil — 값이 없어 시루와 같은 소품 가격대'
  }),
  jar: Object.freeze({
    id: 'jar', ko: '유리 수경병', kind: 'container',
    listWon: 5_000, leadDays: 2,
    note: 'docs/propagation.md §4 CONTAINERS.jar (pot_glassjar.glb · 0.13m) — 같은 소품 가격대'
  }),
  /* ── 2종째 작물 무순 (2026-08-05 · first_play.js §작물 종류) ─────────────────
     ★ 콩 씨앗과 같은 규약이다 — 정본은 작물 표이고 여기서 **읽는다**(2026-08-09). */
  radish_seed: Object.freeze({
    id: 'radish_seed', ko: '무 씨앗 (1판분)', kind: 'seed',
    listWon: CROP_KINDS[1].seedWonPerPot, leadDays: 1,
    note: '실제 무씨 시세 100g 1,758원 · 1kg 18,000원(=1,800원/100g). 한 판(20×30cm)에 ' +
          '20~30g 쓰므로 350~530원 — 그 한가운데. ' +
          'first_play.CROP_KINDS.musun.seedWonPerPot 이 정본이다(여기서 읽는다)'
  }),
  sprout_tray: Object.freeze({
    id: 'sprout_tray', ko: '새싹 재배판', kind: 'container',
    listWon: 3_000, leadDays: 2,
    note: '시루(5,000원)보다 싸다 — **차광 뚜껑이 없는** 얕은 플라스틱 트레이라서다. ' +
          '★ 값이 이 자리인 이유는 개수다: 무순은 7일 주기라 매일 거두려면 7판이 든다. ' +
          '시루와 같은 값이면 용기값 회수가 40일을 넘어 2종째가 영영 안 돈다(재현 ' +
          'tools/probe_crop_cases.mjs 가 그 회수일을 낸다). plan 확인 대기'
  }),

  /* ── 화분 넷 (2026-08-08 · §②-2 화분 종류) ────────────────────────────
     ⚠⚠ **값을 새로 짓지 않았다.** 넷 다 5,000원인데, 그건 이 표가 이미
       `siru`·`pot`·`jar` 셋에 매겨 둔 값 그대로다(docs/shop.md §2 「용기값 5,000원」 —
       *"정본에 있는 가장 싼 완제품(sale_economy.md §4 묘목 5,000원)"* · *"용기 셋은
       전부 그 자리에 있다(0.12~0.36m 소품)"*). 새 화분 넷도 0.13~0.28m 소품이라
       **같은 문장이 그대로 적용된다.** 크기로 값을 가르려면 새 눈금을 지어내야 하는데,
       이 창은 `data/balance/` 를 읽기만 한다 — 그래서 안 갈랐다.
     ★ 검산으로도 같은 자리다. `pot`(검은 모종포트 0.1314)과 `jar`(유리 수경병 0.0970)는
       지름이 서로 35% 다른데 **이미 같은 값**이다. 즉 이 표는 처음부터
       「소품 화분은 크기가 달라도 5,000원」으로 서 있었고, 넷은 그 줄에 선다.
     ⏸ 종류마다 값을 다르게 하려면 `data/balance/` 에 shop 항목이 필요하다 — 박사님 판단. */
  pot_concrete_round: Object.freeze({
    id: 'pot_concrete_round', ko: '회색 콘크리트 화분', kind: 'container',
    listWon: 5_000, leadDays: 2, potKind: 'concrete_round',
    note: 'docs/shop.md §2 용기값 5,000원과 같은 줄 — 0.1801m 소품'
  }),
  pot_terracotta: Object.freeze({
    id: 'pot_terracotta', ko: '테라코타 화분 (나무받침)', kind: 'container',
    listWon: 5_000, leadDays: 2, potKind: 'terracotta',
    note: 'docs/shop.md §2 용기값 5,000원과 같은 줄 — 0.2010m 소품'
  }),
  pot_ceramic: Object.freeze({
    id: 'pot_ceramic', ko: '크림도자기 화분 (나무받침)', kind: 'container',
    listWon: 5_000, leadDays: 2, potKind: 'ceramic',
    note: '★ 몬스테라가 **신고 오는** 화분이다(state.ARRIVAL.potAsset). 값이 붙은 이유는 ' +
          '하나뿐이다 — 다른 화분으로 갈아 낀 뒤 되돌리려면 살 데가 있어야 한다. ' +
          'docs/shop.md §2 용기값 5,000원과 같은 줄 — 0.2020m 소품'
  }),
  pot_concrete_square: Object.freeze({
    id: 'pot_concrete_square', ko: '콘크리트 사각 화분', kind: 'container',
    listWon: 5_000, leadDays: 2, potKind: 'concrete_square',
    note: '★ 값은 같은데 **자리를 잃는다** — 0.2755m 라 반지하 14칸 중 4칸에만 올라간다. ' +
          '이 화분이 치르는 값은 돈이 아니라 자리다(§②-2 ★네모의 값). ' +
          'docs/shop.md §2 용기값 5,000원과 같은 줄'
  })
});

/* 사는 값. 100원 단위로 올림한다 — 2,100 처럼 지갑에서 셀 수 있는 수가 되게. */
export function buyPriceOf(itemId) {
  const it = CATALOG[itemId];
  if (!it) throw new Error(`[상점] 모르는 품목입니다: ${itemId} (아는 것: ${Object.keys(CATALOG).join(', ')})`);
  return Math.ceil(it.listWon * BUY_MARKUP / 100) * 100;
}

export function catalogList() {
  return Object.values(CATALOG).map(it => ({
    id: it.id, ko: it.ko, kind: it.kind,
    listWon: it.listWon, buyWon: buyPriceOf(it.id), leadDays: it.leadDays, note: it.note
  }));
}

/* ============================================================
   ②-2 ★★ 화분 종류 — 「바꿔 낀다」가 무엇을 바꾸나 (2026-08-08)
   ------------------------------------------------------------
   박사님 원문: *"화분 종류를 늘려서 바꿔 낄 수 있도록 해줘."*

   ══ 먼저 — 지금은 어떻게 도나 ═══════════════════════════════════════════
   화분은 **한 종류밖에 없다.** `state.givePlant` 가 `potAsset: ARRIVAL.potAsset`
   ('monstera/pot.glb') 하나를 못 박고, 세이브는 그 칸을 이미 적었다가 그대로 되세운다
   (save.js §packPot.potAsset). 즉 **그릇은 이미 세이브를 왕복하는데 고를 데가 없었다.**
   지름은 아예 상태에 없다 — `first_play.FIRST_PLAY_ASSETS.monsteraPotDiameterM = 0.202`
   라는 **상수 하나**가 그 자리에 서 있고, 자리 판정 셋이 전부 그 값을 본다:
     `first_play.slotFitsDiameter`  숫자로 확인된 maxPotD 만 받는다(모르면 못 받는다)
     `place.fitsOn` · `place.slotHolds`  면 한도와 견준다
     `room_view.potFits` · `rotationSafeDiameter`  실제 메시로 다시 잰다

   ══ ★★ 그래서 이 일의 핵심은 겉모습이 아니라 **지름**이다 ═════════════════
   화분을 바꾸면 지름이 바뀌고, 지름이 바뀌면 **놓을 수 있는 자리가 바뀐다.**
   반지하 14칸의 한도는 창턱 0.21 · 선반 0.25 × 9 · 서랍장 0.42 × 2 · 책상 0.57 × 2 다.
     0.2755m 짜리 네모 화분  →  **4칸**  (창턱 한 칸과 선반 아홉 칸을 잃는다)
     나머지 넷              →  14칸
   ⇒ **네모 화분이 치르는 값은 돈이 아니라 자리다.** 잃는 창턱이 이 방에서 제일 밝은
     자리(DLI 4.80)라 「예뻐 보여서 갈아 꼈더니 안 자란다」가 실제로 일어난다.
     그 사실이 화면에 안 뜨면 조용히 틀리는 유형이 된다 — §canSwapPot 이 그래서 있다.

   ══ 지름은 **잰 값이다. 지어내지 않았다** ══════════════════════════════════
   `tools/test_pots.mjs` 가 GLB 를 직접 열어 `2 × max √(x²+z²)`(회전 무관 지름)를 재고
   매니페스트의 `scale_to_real` 을 곱한다. 그 값을 0.1mm 단위로 **올림**한 것이 아래 표다.
     · 회전 무관 지름인 이유 — bbox 로 재면 네모 화분이 통과한다.
       `pot_concrete_square` 는 bbox 0.20 인데 대각선이 0.2755 다. 돌리면 안 들어간다
       (`room_view.rotationSafeDiameter` 머리말 · core-to-house.md 2026-08-02 ④).
     · 올림인 이유 — 내리면 실제보다 작게 세어 "들어간다"고 해 놓고 겹친다
       (`place.js` §올림이다).
   ★ 검산: 크림도자기 화분의 잰 값이 0.201983 이고 올리면 **0.202** — 이 저장소가
     예전부터 손으로 적어 두던 `FIRST_PLAY_ASSETS.monsteraPotDiameterM` 과 **한 자리도
     안 다르다.** 재는 방법이 맞다는 증거이고, 검사가 그 등식을 못 박는다.
   ⚠ 못 잰 것은 안 넣었다:
     · `pots/pot_macrame_hanging.glb`(마크라메 행잉 · 0.1794) — **걸이**다. 방의 자리는
       전부 상판 위 좌표(onUid + top)라 매다는 자리가 없다. 지름은 쟀지만 그 지름으로
       갈 자리가 없으므로 품목이 될 수 없다.
     · `pots/pot_glassjar.glb`(유리 수경병 · 0.0970) — 이미 `CATALOG.jar` 이고
       **물꽂이 삽수 용기**다(propagation.CONTAINERS.jar · 팔 때 돌아온다).
       흙이 없어 몬스테라를 심는 그릇이 아니다.
     · `pots/pot_macrame.glb` — 매니페스트에 없다. `scale_to_real` 이 없어 **실제 크기를
       못 잰다.** 짐작한 지름은 「창턱을 통과한 뒤 바닥까지 삐져나오는」 사고가 된다.

   ══ ★ 색은 지름을 안 바꾼다 ═════════════════════════════════════════════
   민트·핑크는 같은 지오메트리의 **다시 칠한 판**이라 잰 지름이 소수 여섯째 자리까지 같다.
   그래서 이 표는 둘을 갈라 둔다 — 이게 박사님 질문 「무엇이 바뀌나」의 답이기도 하다.
     **색 갈아입기** 겉모습만 바뀐다. 지름이 그대로라 **자리를 절대 못 잃는다**
     **모양 갈아끼우기** 지름이 바뀐다. **자리를 잃을 수 있다**
   ⇒ 값을 치르는 것은 모양이고 색은 아니다. 그래서 색은 따로 안 판다(§colors).
============================================================ */

/* ★ 아무것도 안 고른 화분이 신고 있는 것. `state.ARRIVAL.potAsset` 과 **같은 값이어야 한다.**
   ⚠ `state.js` 를 import 하지 않는다 — 그쪽이 이 파일을 부르므로 순환이 된다
     (`CATALOG.bean_seed` 와 `first_play.seedWonPerSiru` 가 서로를 못 부르는 것과 같은 규약).
     둘이 갈리면 도착한 화분의 지름을 이 표가 모르게 된다. 검사가 등식을 고정한다. */
export const DEFAULT_POT_ASSET = 'monstera/pot.glb';

/* 지름을 0.1mm 눈금으로 **올린다**. 표의 값이 이 함수를 거친 결과와 같아야 한다(검사). */
export const ceilPotDiameter = (m) => Math.ceil(m * 1e4 - 1e-9) / 1e4;

/* 종류마다 ① 한글 이름 ② 잰 지름 ③ 상점 품목 ④ 색 갈래.
   `measuredM` 은 **GLB 에서 실제로 나온 값**이고 `diameterM` 은 그것을 올린 값이다.
   둘 다 적는 이유: 검사가 재현할 수 있어야 하고, 나중에 에셋이 바뀌면 어디가 어긋났는지
   한눈에 보여야 한다. */
export const POT_KINDS = Object.freeze({
  nursery: Object.freeze({
    id: 'nursery', ko: '검은 모종포트', itemId: 'pot',
    asset: 'pots/pot_nursery_black.glb',
    measuredM: 0.131304, diameterM: 0.1314,
    colors: Object.freeze([
      Object.freeze({ id: 'base', ko: '검정', asset: 'pots/pot_nursery_black.glb' })
    ]),
    /* ★ 새 품목을 안 만들었다 — `CATALOG.pot` 이 이미 이 물건이다
       (propagation.CONTAINERS.soil.itemId === 'pot'). 그래서 **재고를 나눠 쓴다**:
       몬스테라에 갈아 끼우면 삽수를 심을 포트가 하나 준다. 그게 사실이라 그대로 둔다. */
    note: '이미 있는 품목(CATALOG.pot)이다. 삽수용 포트와 같은 재고를 쓴다'
  }),
  concrete_round: Object.freeze({
    id: 'concrete_round', ko: '회색 콘크리트 화분', itemId: 'pot_concrete_round',
    asset: 'pots/pot_concrete_round.glb',
    measuredM: 0.180070, diameterM: 0.1801,
    colors: Object.freeze([
      Object.freeze({ id: 'base', ko: '회색', asset: 'pots/pot_concrete_round.glb' }),
      Object.freeze({ id: 'mint', ko: '민트', asset: 'pots/pot_concrete_round_c1.glb' }),
      Object.freeze({ id: 'pink', ko: '핑크', asset: 'pots/pot_concrete_round_c2.glb' })
    ]),
    note: '원형이라 대각선이 안 튄다 — bbox 1.858×2.000 인데 회전 무관 지름이 2.0008 이다'
  }),
  terracotta: Object.freeze({
    id: 'terracotta', ko: '테라코타 화분 (나무받침)', itemId: 'pot_terracotta',
    asset: 'pots/pot_terracotta_wood.glb',
    measuredM: 0.200907, diameterM: 0.2010,
    colors: Object.freeze([
      Object.freeze({ id: 'base', ko: '테라코타', asset: 'pots/pot_terracotta_wood.glb' }),
      Object.freeze({ id: 'mint', ko: '민트', asset: 'pots/pot_terracotta_wood_c1.glb' }),
      Object.freeze({ id: 'pink', ko: '핑크', asset: 'pots/pot_terracotta_wood_c2.glb' })
    ]),
    note: '창턱 한도 0.21 을 9mm 차이로 통과한다 — 기본 화분과 사실상 같은 자리를 쓴다'
  }),
  ceramic: Object.freeze({
    id: 'ceramic', ko: '크림도자기 화분 (나무받침)', itemId: 'pot_ceramic',
    asset: 'monstera/pot.glb',
    measuredM: 0.201983, diameterM: 0.2020,
    colors: Object.freeze([
      Object.freeze({ id: 'base', ko: '크림', asset: 'monstera/pot.glb' }),
      Object.freeze({ id: 'mint', ko: '민트', asset: 'monstera/pot_c1.glb' }),
      Object.freeze({ id: 'pink', ko: '핑크', asset: 'monstera/pot_c2.glb' })
    ]),
    /* ★ 이 줄이 옛 판을 지킨다 — 도착 화분이 그대로 이 종류이고 지름도 그대로 0.202 다 */
    note: '★ 도착 화분(DEFAULT_POT_ASSET). 잰 값을 올리면 0.202 로, ' +
          'first_play.FIRST_PLAY_ASSETS.monsteraPotDiameterM 과 **같은 값이어야 한다**'
  }),
  concrete_square: Object.freeze({
    id: 'concrete_square', ko: '콘크리트 사각 화분', itemId: 'pot_concrete_square',
    asset: 'pots/pot_concrete_square.glb',
    measuredM: 0.275434, diameterM: 0.2755,
    colors: Object.freeze([
      Object.freeze({ id: 'base', ko: '콘크리트', asset: 'pots/pot_concrete_square.glb' })
    ]),
    /* ★★ 네모의 값 — bbox 로는 0.20 이라 창턱(0.21)을 통과하는 것처럼 보인다.
       대각선이 0.2755 라 실제로는 못 올라간다. 이 한 줄이 회전 무관 지름을 쓰는 이유이고
       (room_view.rotationSafeDiameter 머리말이 바로 이 파일을 예로 든다),
       동시에 「바꿔 끼면 자리가 바뀐다」를 눈에 보이게 만드는 유일한 화분이다. */
    note: '★ 네모다. bbox 0.20 인데 대각선 0.2755 — 창턱과 선반을 못 쓴다'
  })
});

/* 에셋 경로 → 종류·색. 색 판까지 전부 실린다(민트 화분도 제 종류를 안다). */
const POT_ASSET_INDEX = (() => {
  const m = new Map();
  for (const k of Object.values(POT_KINDS))
    for (const c of k.colors) m.set(c.asset, { kind: k, color: c });
  return m;
})();

export function potKindList() {
  return Object.values(POT_KINDS).map(k => ({
    id: k.id, ko: k.ko, itemId: k.itemId, asset: k.asset,
    diameterM: k.diameterM, measuredM: k.measuredM,
    listWon: CATALOG[k.itemId].listWon, buyWon: buyPriceOf(k.itemId),
    leadDays: CATALOG[k.itemId].leadDays,
    colors: k.colors.map(c => ({ ...c })), note: k.note
  }));
}

/* 이 에셋을 아는가. **모르면 지름을 지어내지 않는다** — 부르는 쪽이 먼저 물어본다. */
export const knowsPotAsset = (asset) => POT_ASSET_INDEX.has(asset);

/* 에셋 경로 → 종류. 모르면 null (던지지 않는다 — 화면이 매 프레임 부를 수 있다). */
export function potKindOfAsset(asset) {
  const hit = POT_ASSET_INDEX.get(asset);
  return hit ? hit.kind : null;
}
export function potColorOfAsset(asset) {
  const hit = POT_ASSET_INDEX.get(asset);
  return hit ? hit.color : null;
}

/* ★ 화분 하나의 지름[m]. **자리 판정이 쓰는 유일한 창구다.**
     asset  `pot.potAsset` 문자열. 비어 있으면 도착 화분으로 본다
   ⚠ 모르는 에셋이면 **던진다.** 조용히 기본값(0.202)으로 떨어뜨리면 더 굵은 화분이
     창턱을 통과해 버린다 — `slotFitsDiameter` 가 「모르는 maxPotD 는 못 받는다」로
     서 있는 것과 같은 이유다. 던지기 싫으면 `knowsPotAsset` 으로 먼저 물어라. */
export function potDiameterOf(asset) {
  const key = asset == null || asset === '' ? DEFAULT_POT_ASSET : asset;
  const hit = POT_ASSET_INDEX.get(key);
  if (!hit)
    throw new Error(`[상점] 모르는 화분 에셋입니다: ${key} — 지름을 잴 수 없어 자리를 정할 수 없습니다 ` +
                    `(아는 것: ${[...POT_ASSET_INDEX.keys()].join(', ')})`);
  return hit.kind.diameterM;
}

/* 이 지름이 올라갈 수 있는 자리 목록. 판정은 `first_play.slotFitsDiameter` 하나뿐이다 —
   여기서 다시 재면 화면과 코어가 갈린다.
     slots  방의 슬롯 배열(`io.light.room.slots` 모양 · maxPotD 를 가진 것) */
export function potSlotsThatHold(diameterM, slots) {
  if (!Number.isFinite(diameterM))
    throw new Error(`[상점] 화분 지름이 유한한 숫자가 아닙니다: ${diameterM}`);
  return (slots || []).filter(s => slotFitsDiameter(s, diameterM));
}
export const potSlotCount = (diameterM, slots) => potSlotsThatHold(diameterM, slots).length;

/* ============================================================
   ★★ 바꿔 끼기 — 무엇을 바꾸고, 무엇을 안 바꾸나
   ------------------------------------------------------------
   바뀌는 것  ① 겉모습(`pot.potAsset`)  ② **지름**(그 에셋에서 잰 값)
              ③ 그래서 **놓을 수 있는 자리**
   안 바뀌는 것 그루 자체다. 잎 수·유효 생장일·무늬는 화분을 안 본다
              (`priceOf` 는 잎으로만 값을 매기고, growth 는 화분 지름을 입력으로 안 받는다).
              **분갈이가 아니라 그릇 바꾸기**라서 그렇다. 자란 속도가 화분 크기로 달라지면
              그건 새 생장 규칙이고, 생장 규칙은 이 창 것이 아니다(⏸ 박사님 판단).

   ★ 굵어져서 지금 자리에 못 있게 되면 **막는다. 몰래 옮기지 않는다.**
     옮겨 주면 그 자리의 밝기가 달라져 **그루의 앞날이 바뀐다** — 화분을 바꿨을 뿐인데
     자란다/안 자란다가 뒤집힌다. 이 저장소가 `slotFitsDiameter` 를 「모르면 못 받는다」로
     둔 것과 같은 방향이고, 되돌릴 수 없는 일을 조용히 하지 않는다는 규약이기도 하다.
     ⇒ 화면은 "먼저 옮기고 나서 갈아 끼우세요"라고 말하면 된다. 자리를 고르는 것은 사람이다.
   ★ 가늘어지는 쪽은 언제나 된다 — 지금 자리가 더 굵은 것을 이미 받고 있었으므로.
============================================================ */

/* 갈아 낄 수 있나. **상태를 안 바꾼다** — 화면이 [갈아 끼우기] 를 회색으로 만들 때도,
   코어가 실제로 갈아 끼우기 직전에도 같은 함수를 본다(판정을 두 벌 만들지 않는다).
     S
     asset   갈아 낄 화분 에셋(색 판도 된다)
     opt.potId  (없으면 S.pots[0])
     opt.slots  방의 슬롯 배열. 있으면 "지금 자리에 계속 있을 수 있나"까지 본다
   반환 { ok, reason, asset, kind, color, fromAsset, fromDiameterM, diameterM,
          slotId, wider, fits, holdCount } */
export function canSwapPot(S, asset, opt = {}) {
  const pots = (S && S.pots) || [];
  const p = opt.potId ? pots.find(x => x.id === opt.potId) : pots[0];
  if (!p) return { ok: false, reason: '갈아 끼울 화분이 없습니다 — 아직 그루가 없습니다' };
  if (!knowsPotAsset(asset))
    return { ok: false, reason: `모르는 화분입니다: ${asset}`, fromAsset: p.potAsset || DEFAULT_POT_ASSET };

  const kind = potKindOfAsset(asset), color = potColorOfAsset(asset);
  const fromAsset = p.potAsset || DEFAULT_POT_ASSET;
  const fromD = knowsPotAsset(fromAsset) ? potDiameterOf(fromAsset) : null;
  const d = potDiameterOf(asset);
  const base = { asset, kind, color, fromAsset, fromDiameterM: fromD, diameterM: d,
                 slotId: p.slotId || null, wider: fromD != null && d > fromD + 1e-9 };

  if (asset === fromAsset) return { ...base, ok: false, reason: '이미 그 화분입니다' };
  if (stockOf(S, kind.itemId) < 1) {
    const inbound = incomingOf(S, kind.itemId);
    return { ...base, ok: false,
             reason: `${kind.ko}가 없습니다 — ` +
                     (inbound ? `${inbound}개가 배송 중입니다` : '먼저 주문해 주세요') };
  }

  /* 자리 판정. 슬롯을 안 주면 **자리는 안 본 것**이라고 말한다(봤다고 하지 않는다). */
  if (!opt.slots) return { ...base, ok: true, reason: null, fits: null, holdCount: null };
  const holdCount = potSlotCount(d, opt.slots);
  const here = p.slotId ? (opt.slots || []).find(s => s && s.slotId === p.slotId) : null;
  /* 아직 아무 데도 안 놓았거나 자유 좌표면 슬롯이 없다 — 그때는 자리 문제가 없다.
     자유 좌표의 면 판정은 `place.fitsOn` 이 놓을 때 한다. 여기서 그 일을 대신하지 않는다. */
  const fits = here ? slotFitsDiameter(here, d) : null;
  if (fits === false)
    return { ...base, ok: false, fits, holdCount,
             reason: `${kind.ko}(지름 ${(d * 100).toFixed(1)}cm)는 지금 자리에 안 올라갑니다 ` +
                     `(한도 ${Number.isFinite(here.maxPotD) ? (here.maxPotD * 100).toFixed(1) + 'cm' : '알 수 없음'}) — ` +
                     `먼저 화분을 옮기고 나서 갈아 끼워 주세요 (지금 이 화분이 올라가는 자리 ${holdCount}칸)` };
  return { ...base, ok: true, reason: null, fits, holdCount };
}

/* ============================================================
   ③ 상태
============================================================ */
/* ============================================================
   ★★ 판 돈은 **갈래별로** 쌓는다 (2026-08-13 박사님 확정)
   ------------------------------------------------------------
   원문(「식물 판 것이 뺄셈으로만 나온다 — 주석만 달까 / 통을 나눌까」에 대한 답):
   *"㉯ 로 하자. 그리고 **미리 해 둬, 다양해질 테니**"*

   ══ 무엇이 문제였나 ═════════════════════════════════════════════════════
   `earnedWon` **한 칸**에 판 돈이 전부 몰려 있었다. 그래서 가계부가 「식물 판 것」을
   **뺄셈**으로 구했다 — `전체 − 채소 판 것`(`game.html §monthCloseNow`).
   ⇒ **파는 갈래가 하나 늘면 그것이 조용히 「식물 판 것」에 섞인다.** 합이 여전히 맞아서
     대차로도 안 잡히고, 화면은 아무 말도 안 한다.

   ══ 그래서 둘을 뒀다 ════════════════════════════════════════════════════
     earnedWon        합계. **안 지운다** — save.js:685 가 저장하고 game.html:3499 가 읽는다
     earnedBy[kind]   갈래별. ★ **합은 늘 earnedWon 과 같다**(tools/test_saleledger.mjs 가 고정)

   ══ ★ 「미리 해 둔다」가 무슨 뜻인가 — **모르는 갈래는 던진다** ══════════
   `credit` 이 `SALE_KINDS` 에 없는 이름을 받으면 **그 자리에서 던진다.**
   새 판매를 만드는 사람이 이름을 여기 올리게 강제하는 것이 요점이다 — 안 그러면
   그 돈이 어느 통엔가 조용히 섞이고, 그게 바로 방금 고친 병이다.
============================================================ */
export const SALE_KINDS = Object.freeze([
  'pot',          // 그루째 (sellPot)
  'cutting',      // 삽수 (sellCutting)
  'crop',         // 잉여 채소 (state.sellCropSurplus → creditCropSurplus)
  /* ⏸ 곳간 채소 — **아직 아무도 안 쓴다.** 지금은 잉여와 함께 `crop` 으로 들어온다.
     가르려면 `state.sellPantryCrop` 이 `creditCropSurplus(S, won, { kind: 'cropPantry' })`
     로 불러야 하는데 `state.js` 가 이번 창의 쓰기 영역 밖이다 — 받는 쪽만 미리 뚫어 둔다.
     ⚠ 그 둘의 **정본은 이미 따로 있다**: `firstPlay.food.totalPantrySoldWon` ·
       `totalSurplusSoldWon`. 그래서 지금도 가계부는 둘을 가를 수 있다(escapecut-to-plan §판 돈 통). */
  'cropPantry',
  /* ★ 옛 세이브에서 온 몫 — 「예전 판 · 종류 모름」. 아래 §migrateEarnedBy(save.js) */
  'unknown'
]);
const EMPTY_EARNED_BY = () => SALE_KINDS.reduce((o, k) => (o[k] = 0, o), {});

export function createShopState() {
  return {
    schema: SHOP_SCHEMA,
    seq: 0,
    /* 배송 중인 주문. 도착하면 여기서 빠지고 stock 으로 옮겨간다. */
    orders: [],
    /* 도착해서 방에 쌓여 있는 것. `{ itemId: 개수 }` */
    stock: {},
    spentWon: 0,
    earnedWon: 0,
    /* ★ 갈래별 판 돈 — 위 §판 돈은 갈래별로. 합이 곧 `earnedWon` 이다 */
    earnedBy: EMPTY_EARNED_BY(),
    /* ★★ 중고 거래에 올려 둔 것 (2026-08-17 · 아래 §⑦-0 중고 거래).
       ⚠ **주문(`orders`)과 같은 무게의 칸이다** — 안 적으면 저장 한 번에 올려 둔 물건이
         「올린 적 없는 것」이 되고, 물건에 붙은 표(`p.listing`·`c.listing`)만 남아
         **영영 못 파는 유령**이 된다. save.js §packMarket 이 적는다. */
    listings: [],
    listSeq: 0,
    /* 중고 거래가 열린 튜토 일자. 한 번 열리면 안 닫힌다(아래 §marketGate) */
    marketOpenedOnDay: null
  };
}

/* 갈래 칸을 늘 있는 모양으로 만들어 낸다. 옛 세이브·옛 하네스가 만든 상점에도
   이 칸이 없을 수 있어서, 읽는 자리마다 `|| 0` 을 흩뿌리지 않고 여기서 한 번 세운다. */
export function earnedByOf(S) {
  const shop = shopOf(S);
  if (!shop.earnedBy || typeof shop.earnedBy !== 'object') shop.earnedBy = EMPTY_EARNED_BY();
  for (const k of SALE_KINDS) if (!Number.isFinite(shop.earnedBy[k])) shop.earnedBy[k] = 0;
  return shop.earnedBy;
}

/* ★ 가계부가 한 번에 읽는 값 — **화면이 뺄셈을 안 하게** 하려고 낸다.
   반환 { byKind, plantWon, cropWon, unknownWon, totalWon, earnedWon, balanced } */
export function saleLedgerOf(S) {
  const by = { ...earnedByOf(S) };
  const shop = shopOf(S);
  const plantWon = by.pot + by.cutting;
  const cropWon = by.crop + by.cropPantry;
  const totalWon = SALE_KINDS.reduce((n, k) => n + by[k], 0);
  return {
    byKind: by, plantWon, cropWon, unknownWon: by.unknown, totalWon,
    earnedWon: shop.earnedWon,
    /* ★ 이 값이 거짓이면 어딘가가 `earnedWon` 을 직접 만졌다는 뜻이다. 숨기지 않는다. */
    balanced: totalWon === Math.round(shop.earnedWon || 0)
  };
}

export function shopOf(S) {
  if (!S.shop) S.shop = createShopState();
  return S.shop;
}

export function stockOf(S, itemId) { return (shopOf(S).stock[itemId] || 0); }
export function pendingOrders(S) { return shopOf(S).orders.map(o => ({ ...o })); }

/* 배송 중인 것까지 세어 준다 — "이미 시켰는데 또 시키는" 실수를 화면이 막을 수 있게. */
export function incomingOf(S, itemId) {
  return shopOf(S).orders.reduce((n, o) => n + (o.itemId === itemId ? o.qty : 0), 0);
}

/* ============================================================
   ④ 주문 — ★결제는 지금, 물건은 나중
   ------------------------------------------------------------
   ★ 왜 결제가 먼저인가. 인터넷 주문이 그렇고, 게임 규칙으로도 그래야 한다 —
     도착할 때 결제하면 "일단 다 시켜 놓고 돈 생기면 받는" 무한 예약이 된다.
     지금 돈이 나가야 **"이번 주에 뭘 시킬까"** 가 결정이 된다.
   ⚠ 취소는 없다. 되돌릴 수 있으면 배송 시간이 벌이 아니게 된다.

     S
     itemId  CATALOG 의 열쇠
     qty     개수 (1 이상 정수)
     opt.log 로그 콜백
   반환 { orderId, itemId, qty, unitWon, totalWon, arrivesOnDay, cashWon, events } */
export function orderItem(S, itemId, qty = 1, opt = {}) {
  const it = CATALOG[itemId];
  if (!it) throw new Error(`[상점] 모르는 품목입니다: ${itemId} (아는 것: ${Object.keys(CATALOG).join(', ')})`);
  if (!Number.isInteger(qty) || qty < 1)
    throw new Error(`[상점] 개수가 1 이상의 정수가 아닙니다: ${qty}`);

  const shop = shopOf(S);
  const ts = S.tutorial && S.tutorial.enabled ? S.tutorial : null;
  const unitWon = buyPriceOf(itemId);
  const totalWon = unitWon * qty;

  if (ts && ts.cashWon < totalWon) {
    const e = new Error(`[상점] 돈이 모자랍니다 — ${it.ko} ${qty}개 ${totalWon.toLocaleString()}원 ` +
                        `(지금 ${ts.cashWon.toLocaleString()}원)`);
    e.tutorialInput = true;                 // 안내지 고장이 아니다
    throw e;
  }
  if (ts) {
    ts.cashWon -= totalWon;
    if (!ts.crop) ts.crop = { spentWon: 0, soldWon: 0 };
    ts.crop.spentWon += totalWon;
  }
  shop.spentWon += totalWon;

  shop.seq += 1;
  const order = {
    orderId: `ord_${String(shop.seq).padStart(3, '0')}`,
    itemId, qty, unitWon, totalWon,
    orderedOnDay: S.day,
    arrivesOnDay: S.day + it.leadDays
  };
  shop.orders.push(order);

  if (typeof opt.log === 'function')
    opt.log(`🛒 ${it.ko} ${qty}개 주문 — ${totalWon.toLocaleString()}원 · ` +
            `${it.leadDays}일 뒤(Day ${order.arrivesOnDay}) 도착`);

  return { ...order, cashWon: ts ? ts.cashWon : null,
           events: [{ id: 'shop_ordered', ko: `${it.ko}를 주문했습니다`,
                      itemId, qty, totalWon, arrivesOnDay: order.arrivesOnDay }] };
}

/* ============================================================
   ⑤ 하루 — 도착
   ------------------------------------------------------------
   loop.nextDay 가 **날짜를 올린 뒤에** 한 번 부른다. 그래야 "1일 뒤"가 다음 날 아침이 된다.
   ★ 조용히 도착하지 않는다. 도착은 사건이라 events 로 나가고 로그에도 남는다.
============================================================ */
export function stepShop(S, opt = {}) {
  const shop = shopOf(S);
  const events = [], arrived = [];
  if (!shop.orders.length) return { events, arrived };

  const still = [];
  for (const o of shop.orders) {
    if (o.arrivesOnDay > S.day) { still.push(o); continue; }
    shop.stock[o.itemId] = (shop.stock[o.itemId] || 0) + o.qty;
    arrived.push(o);
    const it = CATALOG[o.itemId];
    const e = { id: 'shop_arrived', ko: `${it ? it.ko : o.itemId} ${o.qty}개가 도착했습니다`,
                itemId: o.itemId, qty: o.qty, orderId: o.orderId };
    events.push(e);
    if (typeof opt.log === 'function') opt.log('📦 ' + e.ko);
  }
  shop.orders = still;
  return { events, arrived };
}

/* ★★ 2026-08-09 신설 — **묻기만 한다. 아무것도 안 바꾼다.**
   ------------------------------------------------------------
   왜 따로 두나. 한 동작이 재고를 **둘 이상** 쓰면 `useStock` 을 줄줄이 부르는 것이
   위험하다 — 첫째가 빠진 뒤 둘째가 던지면 첫째는 돌아오지 않는다.
   (실제로 `resowCrop` 이 시루를 먼저 빼고 씨앗에서 던져 시루 14,000원이 사라졌다.)
   그런 자리는 `assertStock` 으로 **전부 먼저 묻고**, 통과한 뒤에만 뺀다.

   ⚠ 같은 품목을 두 몫으로 물으면 안 된다 — 3개+3개를 따로 물으면 5개뿐인 재고가 둘 다 통과한다.
     한 동작이 같은 품목을 여러 번 쓰면 **합쳐서 한 번** 물어야 한다(`assertStockAll` 이 합쳐 준다). */
export function assertStock(S, itemId, qty = 1) {
  const have = shopOf(S).stock[itemId] || 0;
  if (have < qty) {
    const it = CATALOG[itemId];
    const inbound = incomingOf(S, itemId);
    const e = new Error(`[상점] ${it ? it.ko : itemId}이(가) ${qty}개 필요한데 ${have}개뿐입니다 — ` +
      (inbound ? `${inbound}개가 배송 중입니다(기다리거나 더 주문하세요)` : '먼저 주문해 주세요'));
    e.tutorialInput = true;
    throw e;
  }
  return have;
}

/* 여러 품목을 **한꺼번에** 묻는다. 같은 품목이 여러 번 오면 더해서 묻는다(위 ⚠).
   needs: [{ itemId, qty }, …] — qty 가 0 이하면 안 묻는다(안 쓰는 몫이다). */
export function assertStockAll(S, needs = []) {
  const want = new Map();
  for (const n of needs) {
    if (!n || !n.itemId || !(n.qty > 0)) continue;
    want.set(n.itemId, (want.get(n.itemId) || 0) + n.qty);
  }
  for (const [itemId, qty] of want) assertStock(S, itemId, qty);
  return true;
}

/* 재고를 쓴다. 없으면 던진다 — 조용히 0으로 굴리면 "공짜로 무한히 나오는" 경제가 된다. */
export function useStock(S, itemId, qty = 1) {
  const shop = shopOf(S);
  const have = assertStock(S, itemId, qty);
  shop.stock[itemId] = have - qty;
  return shop.stock[itemId];
}

/* ============================================================
   ⑥ ★★ 값 — **잎 한 장씩 값을 매긴다** (2026-08-04 박사님 지시로 전면 개편)
   ------------------------------------------------------------
   박사님 원문: *"가격을 낮춰. 무늬 삽수 가격 자체를 낮춰. 무늬 희귀등급별 차등가격 필요.
   (…) 그리고 잘 큰 화분은 훨씬 더 비싸게"*

   ══ 무엇이 잘못돼 있었나 — 표가 그대로 말한다 ═══════════════════════════════
   옛 공식은 `값 = 단위가 × 잎수 × (1 + 60·v²)` 이고 `v` 가 **무늬 잎 비율**이었다.
   비율이라 **잎이 적을수록 값이 올랐다.**

     잎 5장 중 2장 무늬 530,000  <  잎 3장 중 2장 무늬 830,000
     극단이 **잎 1장짜리 무늬 삽수 732,000원** — 무늬 잎 하나만 떼면 모주보다 비쌌다.

   즉 **잘 키우는 것이 손해**였고, 최적 전략이 "무늬 잎마다 잘라서 따로 팔기"였다.
   박사님 지시 넷은 전부 이것을 뒤집는다.

   ══ 새 공식 — 한국 무늬식물 시장이 실제로 값을 부르는 방식 그대로 ═════════════
   조사(2026-08-04): 한국 알보몬 시장은 값을 **「잎 1장당」** 으로 부른다
   (`엽수 5엽 · 잎당 30만` 꼴. 식테크 거품기 잎당 30만~80만, 2023년 ~5만으로 붕괴).
   그래서 그루값을 하나의 곱이 아니라 **잎마다의 합**으로 매긴다.

       값 = 민무늬 잎 수 × 크기단가  +  무늬 잎 수 × 성체단가 × 등급배수

   ★★ **무늬 잎에는 크기 프리미엄을 안 먹인다.** 크기단가가 삽수 12,000 / 성체 10,000 으로
     작은 쪽이 비싼 것은 *"작아도 최소 이만큼은 받는다"* 는 **소품 하한**이고(propagation.md §6),
     그건 민무늬 잎에나 붙는 말이다. 무늬 잎 값은 무늬가 정한다.
     ⚠ 안 갈라 두면 **경계에서 값이 꺾인다.** 실제로 처음 짤 때 그랬고 검사 E 가 잡았다:
       잎2·무늬1 = 92,000 → 잎3·무늬1 = 86,667. 잎이 한 장 늘었는데 값이 준다 —
       고치려던 그 병이 경계 한 칸에 그대로 남아 있었다. 무늬 잎을 성체 단가로 고정하면
       잎이 늘 때 **더해지기만** 하므로 그 자리가 원리적으로 사라진다.

   ★ 이 형태가 박사님 지시 셋을 **동시에** 만족시킨다. 우연이 아니라 형태가 그렇다.
     ① **잎 수에 우상향** — 잎이 한 장 늘면 값이 반드시 는다(비율이 안 들어간다).
     ② **떼어 팔기가 절대 이득이 아니다** — 합이라서 쪼개도 총합이 같고, 쪼개다 등급이
        내려가면 오히려 준다(아래 ★증명).
     ③ **무늬 삽수가 싸진다** — 잎 1장짜리 무늬 삽수 732,000 → **80,000원**.

   ★★ 증명 — 떼어 팔기는 왜 이득일 수 없나.
     그루를 A·B 두 조각으로 쪼개면 잎은 그대로 나뉜다. 값이 잎별 합이므로
     쪼갠 뒤의 합은 **등급배수가 안 내려갈 때만** 원래와 같다. 그런데 등급은
     **무늬 잎 장수**로 정하므로 쪼개면 양쪽 다 장수가 줄어 등급이 내려가거나 그대로다.
     따라서 `쪼갠 합 ≤ 통째 값` 이고, 등호는 무늬 잎이 한쪽에 몰릴 때뿐이다.
     ⇒ **"키워서 팔기"가 언제나 같거나 이득이다.**

   ══ 등급 — 실제 한국 시장 용어를 쓴다 (조사 2026-08-04) ══════════════════════
   무늬 등급 이름은 지어내지 않고 한국 무늬식물 시장에서 실제로 쓰는 말을 가져왔다.
   선호 순서도 시장이 매긴 그대로다 — **무지 < 산반 < 섹터 < 하프문**.

     무지(민무늬)  무늬가 없다. 「무지 잎」은 알보의 값을 깎는 말로 쓰인다
     산반(散斑)    잎 전체에 붓으로 튀긴 듯 잘게 흩뿌려진 무늬. 마블(marble)과 같은 말.
                   ★시장이 산반을 권하는 이유가 **생리적 안전**이다 — 초록(광합성)과
                     흰색(광합성 불가)이 고르게 섞여 있어 그루가 버틴다
     섹터          흰 부분이 큼직한 덩어리로 앉은 것(sectoral). 산반보다 위
     하프문        잎이 주맥에서 반으로 갈려 한쪽이 흰 것. **식테크의 정점**이고
                   경매 최고가가 여기서 나온다. 줄기까지 반반으로 갈리면 더 오른다

   ★ **고스트(전백)는 이 사다리에 없다.** 잎 전체가 흰 것을 한국 시장은 「고스트」라 부르는데,
     값의 꼭대기가 아니라 **경고**로 읽는다 — 고스트 잎이 연달아 나면 성장점 안의 정상 세포가
     죽었다는 뜻이고 그루가 결국 죽는다. 그래서 고스트는 **등급이 아니라 죽음**이고,
     `propagation.js` §키메라가 그것을 다룬다. 값을 매기는 자리에는 아예 안 나온다.
     ★★ 이게 곧 **천장**이다. 「가장 흰 것이 가장 비싸다」가 아니므로 무늬를 끝까지 밀어붙이는
       길이 값으로 보상받지 않는다 — 상한을 규칙으로 박지 않아도 사다리 자체가 거기서 끝난다.

   ⚠ 조사가 같이 알려 준 것: 이 이름들은 원래 **잎 한 장의 무늬 모양**을 가리키는 말이다.
     그루 단위 축은 시장에서 「엽수 + 성장점 상태」로 따로 말한다. 그런데 코어는 잎 하나하나의
     무늬 모양을 모른다 — growth 가 내주는 것은 `variegatedLeaves`(무늬 잎이 **몇 장인가**)뿐이다.
     그래서 여기서는 그 이름들을 **그루의 무늬가 어디까지 굳었나**에 붙여 쓴다.
     잎마다 다른 무늬 모양을 값에 넣으려면 growth 가 잎별 무늬 종류를 내줘야 한다
     (`docs/handoff/core-to-growth.md` 에 요청을 적어 두었다). 지금 없는 것을 지어내지 않는다.

   ══ 배수는 어디서 왔나 — **셋 다 이미 있던 값이다** ═════════════════════════════
   셋 다 **성체 잎당 단가에 대한 비**로 통일했다(위 ★★ 무늬 잎은 성체 단가를 쓴다).
     산반  8             `sale_economy.md` 「몬스테라 삽수(알보) 80,000」 ÷ 10,000
     섹터  320/9 ≈ 35.556 `sale_economy.md` 「포토스 희귀무늬 성체 800,000」 ÷ (3,750×6)
     하프문 61             옛 공식의 상한 `1 + 60·1²` — 값의 꼭대기를 안 올렸다는 뜻이다
   ★ 새 숫자를 하나도 만들지 않았다. 바뀐 것은 **그 배수가 언제 붙느냐**뿐이다:
     예전에는 잎 비율이 높으면 붙었고(그래서 잎 1장이 제일 유리했다),
     이제는 **무늬 잎 장수**가 쌓여야 붙는다(그래서 잘 큰 그루라야 한다).
============================================================ */

/* ★ 등급 — 무늬 잎 **장수**로만 정한다. 비율로 정하면 민무늬 잎이 한 장 나는 순간
   등급이 내려가 **잘 키운 벌**이 된다(그게 옛 공식의 병이었다). 장수는 늘기만 하므로
   값이 잎 수에 대해 절대 안 꺾인다. 위 ★증명이 성립하는 것도 이 성질 때문이다. */
export const VARIE_GRADES = Object.freeze([
  Object.freeze({ id: 'plain',    ko: '무지',   minVarieLeaves: 0, leafMult: 1 }),
  Object.freeze({ id: 'sanban',   ko: '산반',   minVarieLeaves: 1, leafMult: 8 }),
  Object.freeze({ id: 'sector',   ko: '섹터',   minVarieLeaves: 2, leafMult: 320 / 9 }),
  /* ★★ 2026-08-09 박사님 확정 — **61 → 640/9 (≈71.11).** 「섹터의 정확히 두 배」다.
     ------------------------------------------------------------
     ★ 왜 하프문만 올릴 수 있나. 산반 8 과 섹터 320/9 는 **실제 시장가에서 나온 값**이라
       못 건드린다. 그런데 하프문 61 은 조사값이 아니라 **옛 공식의 상한 `1 + 60·1²`** 을
       그대로 물려받은 것이다(위 「배수는 어디서 왔나」). 근거가 제일 약한 자리였다.
     ★ 그리고 비율이 이상했다 — 산반 → 섹터가 **4.4배** 뛰는데 섹터 → 하프문은 **1.7배**뿐이다.
       하프문이 「식테크의 정점」이고 경매 최고가가 거기서 나온다면서 프리미엄이 더 작았다.
       섹터의 두 배(640/9)가 그 사다리를 제 모양으로 만든다.
     ⚠ 왜 지금 올리나 — **이사비 200만원을 하프문 하나로 넘기기 위해서다.**
       61 이면 잎 11장 중 무늬 3장이 191만원이라 **9만원이 모자라 아무도 못 나갔다**
       (`test_banjiha_routes` 가 이사 성공 0/40 으로 잡았다). 640/9 면 221만원이 된다.
     ⚠ 분수로 두는 것도 일부러다 — 섹터가 `320/9` 라 소수로 쓰면 「두 배」가 안 맞는다. */
  Object.freeze({ id: 'halfmoon', ko: '하프문', minVarieLeaves: 3, leafMult: 640 / 9 })
]);

/* ★★ 삽수에는 등급을 안 붙인다 — 산반까지다.
   ------------------------------------------------------------
   왜. **삽수는 그 무늬가 유지될지 아직 아무도 모른다.** 조사에서 확인한 그대로다 —
   삽수는 원복(무늬 퇴화)할 수도, 고스트로 죽을 수도 있고, 그 판정은 뿌리내린 뒤에 난다
   (`propagation.js` §키메라). 시장이 값을 쳐 주는 것은 **무늬가 굳은 것이 확인된 그루**다.
   그래서 잎 1~2장짜리 조각은 무늬가 아무리 많아도 「산반」 값을 받는다.

   ★ 이 한 줄이 박사님의 *"무늬 삽수 가격 자체를 낮춰"* 를 실제로 성립시킨다.
     이게 없으면 잎 2장 전부 무늬인 삽수가 섹터 등급을 받아 854,400원이 된다 —
     고친 병이 그대로 돌아온다. 지금은 160,000원이 상한이다. */
export const CUTTING_GRADE_CAP = 'sanban';

export const UNIT_WON = Object.freeze({
  monstera: Object.freeze({ cutting: 12_000, adult: 10_000 }),   // propagation.md §6 표 (숫자를 안 바꿨다)
  pothos:   Object.freeze({ cutting:  3_000, adult:  3_750 })
});

/* ★★ 소품 하한 — `cutting` 값을 **잎당 웃돈이 아니라 그루당 최저가**로 읽는다 (2026-08-04)
   ------------------------------------------------------------
   정본(propagation.md §6)이 삽수 단가를 12,000 으로 둔 이유는 한 줄로 적혀 있다:
   *"작아도 **최소 이만큼은** 받는다는 소품 프리미엄"*. 그건 **하한**을 말하는 문장이다.
   그런데 코드는 그것을 **잎마다 붙는 2,000원 웃돈**으로 읽고 있었고, 그래서
   잎이 적을수록 잎당 값이 비쌌다 — 값의 병(잎 비율 v)과 **같은 방향의 병**이 하나 더 있었던 셈이다.

   ⚠ 실제로 재서 잡았다(검사 E). 잎 4장 민무늬 40,000원짜리를 2장+2장으로 쪼개면
     24,000+24,000 = 48,000원이라 **뜯어 파는 쪽이 8,000원 더 남았다.**
     문장대로 하한으로 읽으면 잎당 값이 어디서나 같아져 그 이득이 사라진다.

   ★ 지금 남는 최대 이득은 「잎 2장 민무늬(20,000) → 1장+1장(24,000)」의 **4,000원**뿐이고,
     그건 용기값 7,000원보다 작다 — **실비를 못 넘기므로 실제로는 손해다.**
     (게다가 초보에서는 모주를 끝내는 자르기가 막혀 있어 그 수 자체가 없다.)
     하한을 0 으로 없애면 이득이 정확히 0 이 되지만, 그러면 정본의 「몬스테라 삽수 12,000」이
     깨지고 꾸준수입이 17% 준다. **정본을 지키면서 실질 이득을 없애는 쪽**을 골랐다. */
export const minSaleWonOf = (species) => (UNIT_WON[species] || {}).cutting || 0;

/* 잎 몇 장부터 성체로 보나 — propagation.md §6: "잎 1~2장이면 삽수, 3장부터 성체".
   ★ 이제 이 값이 가르는 것은 **단가가 아니라 등급 상한**이다(잎당 값은 어디서나 같다).
   ★ 삽수가 자라게 되면서(2026-08-04) 뜻이 하나 늘었다 — **자라서 잎 3장이 된 삽수는
     그 순간부터 등급 상한이 풀린다.** "키우면 값이 붙는다"가 여기서도 같은 규칙이다. */
export const ADULT_MIN_LEAVES = 3;

/* 무늬 잎 비율. **값에는 더 이상 안 쓴다**(위 §병폐) — 화면 표시·기록용으로만 남긴다.
   지우지 않은 이유: 「이 그루가 얼마나 무늬인가」는 여전히 사람이 읽는 값이고,
   옛 세이브·재현이 이 이름으로 기록을 남겨 뒀다. */
export function varieRatio(leaves, variegatedLeaves) {
  if (!Number.isInteger(leaves) || leaves < 1)
    throw new Error(`[상점] 잎 수가 1 이상의 정수가 아닙니다: ${leaves} — 값은 잎으로 매깁니다`);
  if (!Number.isInteger(variegatedLeaves) || variegatedLeaves < 0)
    throw new Error(`[상점] 무늬 잎 수가 0 이상의 정수가 아닙니다: ${variegatedLeaves}`);
  if (variegatedLeaves > leaves)
    throw new Error(`[상점] 무늬 잎 ${variegatedLeaves}장이 전체 잎 ${leaves}장보다 많습니다`);
  return variegatedLeaves / leaves;
}

/* 무늬 잎 장수 → 등급. 삽수(잎 1~2장)면 상한을 건다.
   반환 VARIE_GRADES 의 한 줄(얼려 둔 객체 그대로) */
export function varieGradeOf(variegatedLeaves, { isCutting = false } = {}) {
  let g = VARIE_GRADES[0];
  for (const row of VARIE_GRADES) if (variegatedLeaves >= row.minVarieLeaves) g = row;
  if (isCutting) {
    const capIdx = VARIE_GRADES.findIndex(r => r.id === CUTTING_GRADE_CAP);
    const myIdx = VARIE_GRADES.indexOf(g);
    if (myIdx > capIdx) g = VARIE_GRADES[capIdx];
  }
  return g;
}

/* 값을 매긴다. 순수 함수라 화면이 "지금 팔면 얼마"를 미리 보여줄 수 있다.
     species 'monstera' | 'pothos'
   반환 { won, v, leaves, variegatedLeaves, plainLeaves, size, grade, gradeKo,
          gradeCapped, unitWon, leafMult, multiplier } */
export function priceOf({ species = 'monstera', leaves, variegatedLeaves = 0 } = {}) {
  const unit = UNIT_WON[species];
  if (!unit) throw new Error(`[상점] 모르는 종입니다: ${species} (아는 것: ${Object.keys(UNIT_WON).join(', ')})`);
  const v = varieRatio(leaves, variegatedLeaves);          // 검사도 여기서 같이 한다
  const size = leaves >= ADULT_MIN_LEAVES ? 'adult' : 'cutting';
  const g = varieGradeOf(variegatedLeaves, { isCutting: size === 'cutting' });
  const raw = varieGradeOf(variegatedLeaves);
  const plainLeaves = leaves - variegatedLeaves;
  /* 잎당 값은 **어디서나 같다**(위 ★★ 소품 하한). 그래서 잎을 어떻게 나눠도 합이 안 커진다 */
  const raw$ = plainLeaves * unit.adult + variegatedLeaves * unit.adult * g.leafMult;
  const floorWon = minSaleWonOf(species);
  const won = Math.round(Math.max(raw$, floorWon));
  return {
    won,
    v, leaves, variegatedLeaves, plainLeaves, size,
    grade: g.id, gradeKo: g.ko, gradeCapped: g.id !== raw.id,
    unitWon: unit.adult, floorWon, floored: raw$ < floorWon, leafMult: g.leafMult,
    /* 옛 이름과의 다리 — 「민무늬 잎 한 장 값의 몇 배인가」. 화면이 배수 하나로 말할 때 쓴다 */
    multiplier: won / (unit.adult * leaves)
  };
}

/* ★ 150만원(원룸 이사 자금)을 만들려면 무늬 잎이 몇 장이라야 하나 — **역산**.
   `docs/shop.md` §1 의 표를 내는 함수다. 화면이 "이 그루를 몇 장 더 무늬로 만들면 되나"를
   말할 수 있게 코어가 셈을 갖는다(문서와 코드가 갈리지 않게).
   ★ 공식이 등급 계단이라 닫힌 역함수가 없다 — **한 장씩 올려 보고 처음 넘는 장수**를 낸다.
     계단이 몇 개 안 되고 잎 수도 작아서 이게 가장 정직하다(근사식을 쓰면 경계에서 어긋난다).
   반환 { leaves, size, needVarieLeaves, wonAtNeed, maxWon } · 불가능하면 needVarieLeaves = null */
export function varieLeavesNeededFor(targetWon, { species = 'monstera', leaves } = {}) {
  if (!UNIT_WON[species]) throw new Error(`[상점] 모르는 종입니다: ${species}`);
  if (!Number.isInteger(leaves) || leaves < 1)
    throw new Error(`[상점] 잎 수가 1 이상의 정수가 아닙니다: ${leaves}`);
  const size = leaves >= ADULT_MIN_LEAVES ? 'adult' : 'cutting';
  const maxWon = priceOf({ species, leaves, variegatedLeaves: leaves }).won;
  for (let n = 0; n <= leaves; n++) {
    const q = priceOf({ species, leaves, variegatedLeaves: n });
    if (q.won >= targetWon)
      return { leaves, size, needVarieLeaves: n, wonAtNeed: q.won, grade: q.grade, maxWon };
  }
  return { leaves, size, needVarieLeaves: null, wonAtNeed: null, grade: null, maxWon };
}

/* ============================================================
   ⑦ 판매
   ------------------------------------------------------------
   ★ 코어는 잎을 세지 않는다(머리말 ②). 그루를 팔 때는 growth 가 낸 잎 수·무늬 잎 수를
     **받아야** 한다. 삽수는 다르다 — 삽수는 growth 를 아예 안 쓰고 코어가 전부 아는 물건이라
     (`docs/propagation.md` §7-2) `c.source.leaves` · `c.source.variegatedLeaves` 를 그대로 쓴다.

   ⚠⚠ **2026-08-17 — 몬스테라 것은 상점이 안 산다.** 그루도 삽수도 **중고 거래**로만 나간다
     (박사님: *"몬스테라 연관된 것 자체가 다 상점에는 그냥 안 팔리게 해 줘"*).
     `sellPot`·`sellCutting` 은 **던지는 이정표**로만 남아 있다 — 아래 §⑦-0 을 읽어라.
     ★ **채소는 안 옮겼다.** 잉여·곳간 채소는 식료품이라 상점이 맞다(`creditCropSurplus`).
============================================================ */

function credit(S, won, kind) {
  /* ★ 모르는 갈래는 **여기서 던진다** — 위 §판 돈은 갈래별로.
     새 판매를 만드는 사람이 `SALE_KINDS` 에 이름을 올리게 강제하는 자리다.
     조용히 「기타」로 받아 주면 그 돈이 어느 통엔가 섞이고, 그게 이번에 고친 병이다. */
  if (!SALE_KINDS.includes(kind))
    throw new Error(`[상점] 모르는 판매 갈래입니다: ${kind} — ` +
      `src/game/shop.js §SALE_KINDS 에 먼저 이름을 올려 주세요 (지금: ${SALE_KINDS.join(', ')})`);
  const ts = S.tutorial && S.tutorial.enabled ? S.tutorial : null;
  const shop = shopOf(S);
  shop.earnedWon += won;
  /* ★ 합계와 갈래는 **같은 줄에서** 오른다. 떨어뜨려 두면 언젠가 한쪽만 오른다 */
  earnedByOf(S)[kind] += won;
  if (ts) {
    ts.cashWon += won;
    if (!ts.crop) ts.crop = { spentWon: 0, soldWon: 0 };
    /* ⚠⚠ **이름이 거짓말을 한다 — 재서 적어 둔다** (2026-08-13).
       `ts.crop.soldWon` 은 이름이 「채소」인데 **판 것 전부**가 들어온다(그루·삽수·채소).
       짝인 `ts.crop.spentWon` 도 마찬가지로 **산 것 전부**를 받는다(§orderItem — 병·포트까지).
       ⇒ 이 칸의 실제 뜻은 「채소」가 아니라 **「상점 총 장부」**다. `tutorial.js §crop` 의
         주석(*"여기는 합계만 센다"*)이 원래 그 뜻이었고, 이름만 안 따라온 것이다.
       ★ **값은 안 건드렸다.** 뜻을 좁히면 `tools/test_banjiha_routes.mjs:544`(「씨앗·시루값」으로
         읽는 자리)와 `test_cropsale.mjs:329` 의 숫자가 같이 움직인다 — 그건 값을 바꾸는 일이고
         이번 일(「어느 통에 담느냐」)의 범위 밖이다. 갈래별 통은 위 `shop.earnedBy` 가 갖는다.
       ⇒ 이 칸을 「채소만」으로 좁힐지 이름을 고칠지는 plan 판단이다(escapecut-to-plan §판 돈 통). */
    ts.crop.soldWon += won;
    if (ts.bankrupt && ts.cashWon > 0) ts.bankrupt = false;
  }
  return { won, kind, cashWon: ts ? ts.cashWon : null };
}

/* ============================================================
   ⑦-0 ★★★ 중고 거래 — **몬스테라는 상점에 안 팔린다. 올려 두고 연락을 기다린다**
   ------------------------------------------------------------
   박사님 확정(2026-08-17):
     *"판매는 **상점에 파는 게 아니라 당근 같은 곳에 올려서 판다**는 개념으로 했으면 좋겠어.
       **일주일 정도 안에 랜덤으로 연락 와서 거래**하게. 그리고 그 기능은 **잎이 2장 이상**일 때
       열리게?"*   ·   *"**몬스테라 연관된 것 자체가 다 상점에는 그냥 안 팔리게** 해 줘."*

   ══ ★ 무엇이 바뀌나 — **한 걸음이 두 걸음이 된다** ═══════════════════════════
   예전에는 [팔기] 한 번에 물건이 사라지고 돈이 들어왔다. 이제는 이렇다.

       [올리기]  값을 매겨 올린다 (값은 `priceOf` 가 낸 것 그대로다)
          ↓      ★ 물건은 **아직 내 것이고 그 자리에 그대로 있다**
       기다린다   1~7일 뒤 랜덤으로 연락이 온다
          ↓
       [거래]    누르면 **그때** 물건이 나가고 돈이 들어온다

   ══ ★★ 물건을 **안 치운다** — 이것이 이 설계의 뼈대다 ════════════════════════
   올릴 때 물건을 상태에서 빼면(옛 `sellPot` 이 그랬다) 세 가지가 한꺼번에 어려워진다:
     ① **취소**가 「없앤 것을 되살리기」가 된다 — 되살리다 한 칸이라도 빠지면 조용히 다른 물건이 된다
     ② **그루**는 growth 3D 를 못 되살린다(`growthNeedsReset` 은 편도다 · 아래 §dealListing)
     ③ 세이브가 **물건을 두 곳**(상태와 게시글)에 적게 된다 — 갈리는 날 어느 쪽이 정본인지 모른다
   ⇒ 그래서 물건에 **표만 붙인다**(`pot.listing` · `cutting.listing` = 게시글 id).
     취소는 그 표를 떼는 것이고, 거래가 성사될 때 비로소 물건이 나간다.
     ★ 세이브가 쉬워지는 것이 덤이 아니라 **요점**이다 — 게시글은 전부 숫자와 짧은 글자라
       `save.js` 가 통째로 검증할 수 있다. 물건이 게시글 안에 들어 있으면 그럴 수 없다.

   ══ ⚠ 값은 **올릴 때 얼린다** ════════════════════════════════════════════════
   당근이 그렇고, 화면이 적은 값과 들어오는 돈이 갈리면 안 되기 때문이다.
   ⇒ 올린 뒤에 잎이 나도 값이 안 오르고, 잎을 잘라 내도 값이 안 내린다.
   ⚠⚠ **그래서 「올려 둔 그루에서 삽수를 자르는」 길을 막아야 한다** — 안 막으면 잎을 다
     떼어 팔고도 통째 값을 그대로 받는다(`priceOf` §증명이 막아 둔 바로 그 이득이 돌아온다).
     막는 자리는 `propagation.cutBlockedReason` 인데 그 파일이 이번 창의 쓰기 영역 밖이라
     **화면(`game.html`)이 막고, 코어에 넣을 코드를 보고서에 적어 두었다**
     (`docs/handoff/market-to-plan.md §못 한 것`). ⇒ `isListed(S, …)` 가 그 판정의 유일한 창구다.

   ══ ★ 며칠에 걸리나 — **1~7일 랜덤** (재서 정했다) ═══════════════════════════
   박사님 「일주일 정도 안에」를 그대로 읽었다. 재서 확인한 것 둘:
     · 이 게임의 기다림은 이미 이 눈금이다 — 배송 1~2일 · 콩나물 5일 · **무순 7일** ·
       물꽂이 뿌리 12일 · 직삽 24일. 7일은 **무순 한 바퀴**라 새로 배울 눈금이 아니다.
     · 평균이 4일이다. 삽수를 팔아 버는 꾸준수입이 **평균 4일씩 밀릴 뿐** 끊기지 않는다
       (여러 개를 한꺼번에 올릴 수 있게 둔 까닭이 이것이다 — 아래 ★).
   ⚠ 난수는 `Math.random` 이 아니라 **씨앗 난수**다(`propagation.cuttingHash` 와 같은 규약).
     같은 세이브를 몇 번 열어도 같은 날 연락이 와야 한다.

   ══ ★★ 값이 흔들리나 — **안 흔든다. 제값이다** (재서 정했다) ═════════════════
   박사님이 물으신 자리이고, **재 보니 흔들 수 없는 자리**였다.
     반지하 탈출은 「하프문 그루를 팔아 **이사비 200만**을 만든다」인데, 그 판의 값이
     **221만원**이다(잎 11장 중 무늬 3장 · START-HERE §6). 여유가 **21만원 = 9.5%** 뿐이다.
     ⇒ ±10% 만 흔들어도 **탈출이 동전던지기가 된다.** 그건 「파는 길」을 바꾸는 일이 아니라
       **밸런스를 바꾸는 일**이고, 이번 지시는 *"값은 한 톨도 안 건드린다"* 였다.
   ⏸ 「깎는 사람」을 넣으려면 이사비·하프문 배수와 **한 벌로** 움직여야 한다 — plan 몫이다
     (`market-to-plan.md §판단 필요`).

   ══ ★ 여러 개를 한꺼번에 올릴 수 있나 — **있다** (재서 정했다) ═══════════════
   「하나씩」이 더 단순해 보이지만 **재 보면 그쪽이 더 큰 변경**이다.
   삽수 판매는 이 게임의 **꾸준수입 경로**다(`propagation.md` §7). 하나씩으로 묶으면
   최대 판매 속도가 **평균 4일에 한 건**으로 잘린다 — 기다림을 넣는 일에 **처리량 제한**이
   덤으로 딸려 오고, 그건 값을 안 건드렸어도 밸런스를 건드린 것이다.
   ⇒ 동시에 올리기를 열어 두면 바뀌는 것은 **처음 한 번의 지연**뿐이다.

   ══ ★ 안 팔리면? — **기한이 없다. 연락은 반드시 오고, 누를 때까지 기다린다** ═══
   기한을 두면 「올렸는데 조용히 사라졌다」가 생긴다 — 이 저장소가 제일 자주 앓는 병이다
   (`quiet-to-plan §1`). 연락은 7일 안에 반드시 오고, 그 뒤로는 [거래]를 누를 때까지 선다.
   ⚠ 예외가 하나 있다 — **삽수가 시들면** 게시글이 내려간다(팔 물건이 없어졌다).
     그때는 조용히 지우지 않고 **사건으로 말한다**(§stepMarket).

   ══ ⚠ 「판 돈 통」은 안 늘렸다 ═══════════════════════════════════════════════
   `SALE_KINDS` 는 **「무엇을 팔았나」**이지 「어디서 팔았나」가 아니다. 중고로 팔아도 그루는
   그루고 삽수는 삽수라 `'pot'`·`'cutting'` 그대로다 — 가계부의 `plantWon` 이 그대로 맞는다.
   ⇒ 갈래를 늘리면 옛 세이브의 같은 돈이 다른 통에 담겨 **가계부가 갈린다.**
============================================================ */

export const MARKET_MIN_LEAVES = 2;
/* 며칠 뒤에 연락이 오나. **양끝을 포함한다**(1일 = 다음 날 아침) */
export const MARKET_CONTACT_DAYS = Object.freeze({ min: 1, max: 7 });
/* 게시글이 설 수 있는 갈래. `SALE_KINDS` 중 **식물 둘**이다(채소는 상점이 산다) */
export const MARKET_KINDS = Object.freeze(['pot', 'cutting']);
/* 연락한 사람. 값에 아무 영향이 없고 **「사람이 연락했다」를 화면이 말할 수 있게** 있다.
   ⚠ 이름을 늘려도 값이 안 바뀐다 — 고르는 데 쓰는 난수가 값 난수와 다른 소금(salt)이다. */
export const MARKET_BUYERS = Object.freeze([
  '동네 이웃', '식물 모으는 분', '근처 카페 사장님', '같은 동 사시는 분', '첫 식물이라는 분'
]);

/* 조사(을/를·이/가·은/는). ★ 값과 아무 상관이 없고 **글이 사람 말처럼 읽히게** 있다 —
   「몬스테라을(를)」 같은 괄호가 화면에 뜨면 그 문장은 사람이 안 읽는다.
   ⚠ 받침이 있는지만 본다. 한글이 아니면 받침 없음으로 친다(숫자·영문). */
const hasJong = (s) => {
  const t = String(s == null ? '' : s).trim();
  if (!t) return false;
  const c = t.charCodeAt(t.length - 1);
  return c >= 0xAC00 && c <= 0xD7A3 ? ((c - 0xAC00) % 28) !== 0 : false;
};
export const josa = (s, withJong, without) => `${s}${hasJong(s) ? withJong : without}`;

/* 며칠 뒤인지를 **화면에 안 적는다** — 랜덤이라는 것이 이 기능의 요점이고, 날짜를 미리
   알려 주면 기다림이 「그날까지 [다음 날]을 N번 누르기」라는 사무가 된다.
   ⇒ 대신 **범위**를 말한다. 숫자는 여기서 짓지 않고 `MARKET_CONTACT_DAYS` 에서 읽는다. */
export const marketWaitKo = () => `${MARKET_CONTACT_DAYS.max}일 안에 연락이 옵니다`;

/* 결정적 난수 — `propagation.cuttingHash` 와 **같은 사상**이다(같은 세이브 = 같은 답).
   ⚠ propagation 을 import 하지 않는다(그쪽이 이 파일을 부르므로 순환이 된다).
     그래서 같은 모양을 여기 한 벌 둔다. 검사가 두 함수가 같은 값을 내는지 못 박는다. */
export function marketHash(seed, id, salt = 0) {
  let h = (seed >>> 0) ^ (salt | 0) * 0x9e3779b1;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2545f491) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/* 게시글 칸을 늘 있는 모양으로 만들어 낸다(`earnedByOf` 와 같은 규약 — 옛 세이브·옛 하네스가
   만든 상점에는 이 칸이 없다. 읽는 자리마다 `|| []` 를 흩뿌리지 않고 여기서 한 번 세운다). */
export function marketOf(S) {
  const shop = shopOf(S);
  if (!Array.isArray(shop.listings)) shop.listings = [];
  if (!Number.isInteger(shop.listSeq)) shop.listSeq = 0;
  return shop.listings;
}

export function listingOf(S, listingId) {
  return marketOf(S).find(l => l.listingId === listingId) || null;
}

/* 이 물건이 올라가 있나. **판정의 유일한 창구다** — `.listing` 을 여기저기서 읽으면
   옛 세이브(칸 없음)에서 조용히 갈린다.
     what  화분 객체 · 삽수 객체 · 또는 그 id 문자열 */
export function isListed(S, what) {
  if (!what) return false;
  const id = typeof what === 'string' ? what : what.id;
  const lid = typeof what === 'string' ? null : what.listing;
  return marketOf(S).some(l => l.listingId === lid || l.refId === id);
}
/* 그 물건의 게시글. 없으면 null */
export function listingFor(S, what) {
  if (!what) return null;
  const id = typeof what === 'string' ? what : what.id;
  return marketOf(S).find(l => l.refId === id) || null;
}

/* ★★ 잎 2장 — **문이 언제 열리나** (박사님: *"그 기능은 잎이 2장 이상일 때 열리게?"*)
   ------------------------------------------------------------
   ★ 왜 2장인가 — **우연이 아니다.** 프롤로그가 **잎 2장·3장에 무늬를 보장한다**(`44c208d` ·
     `loop.js §prologueVarie`). 즉 「잎이 2장이 되는 날」과 「무늬가 처음 나는 날」이 거의 같다.
     ⇒ 팔 만한 것이 처음 생기는 날에 파는 길이 열린다. 화면은 그 말을 그대로 해야 한다
       (`game.html §marketHint` — *"잎이 2장이 되면 무늬가 나고, 그때 내놓을 수 있습니다"*).
   ★ **한 번 열리면 안 닫힌다**(`shop.marketOpenedOnDay`). 안 그러면 그루를 판 다음 날
     잎 수가 0이 되어 **삽수를 못 팔게 된다** — 판 것 때문에 못 팔게 되는 것은 말이 안 된다.
   ⚠ 그래서 이 함수는 **묻는 김에 연다.** 여는 일이 되돌아가지 않으므로 어디서 불러도 같다
     (화면이 매 프레임 불러도 안전하다). 코어가 잎을 세지 않는다는 규약(머리말 ②)은 그대로다 —
     잎 수는 **받는다**.
     opt.leaves  growth 가 센 모주 잎 수. 모르면 넘기지 마라(지어내지 않는다)
   반환 { open, openedOnDay, need, leaves, reason } */
export function marketGate(S, opt = {}) {
  const shop = shopOf(S);
  const need = MARKET_MIN_LEAVES;
  const leaves = Number.isInteger(opt.leaves) ? opt.leaves : null;
  if (!Number.isInteger(shop.marketOpenedOnDay)) shop.marketOpenedOnDay = null;
  if (shop.marketOpenedOnDay == null && leaves != null && leaves >= need)
    shop.marketOpenedOnDay = S.day;
  const open = shop.marketOpenedOnDay != null;
  return {
    open, openedOnDay: shop.marketOpenedOnDay, need, leaves,
    reason: open ? null
      : (leaves == null
          ? `아직 내놓을 수 없습니다 — 몬스테라 잎이 ${need}장이 되면 열립니다`
          : `아직 내놓을 수 없습니다 — 잎 ${leaves}/${need}장 ` +
            `(잎이 ${need}장이 되면 무늬가 나고, 그때부터 내놓을 수 있습니다)`)
  };
}

/* 게시글 하나를 만든다. **값은 여기서 안 정한다** — 부르는 쪽이 `priceOf` 로 매긴 것을 받는다. */
function pushListing(S, { kind, refId, ko, price }) {
  if (!MARKET_KINDS.includes(kind))
    throw new Error(`[중고] 모르는 게시 갈래입니다: ${kind} (아는 것: ${MARKET_KINDS.join(', ')})`);
  const shop = shopOf(S);
  marketOf(S);
  shop.listSeq += 1;
  const listingId = `mk_${String(shop.listSeq).padStart(3, '0')}`;
  const seed = (S.sim && S.sim.seed) || 0;
  const span = MARKET_CONTACT_DAYS.max - MARKET_CONTACT_DAYS.min + 1;
  const waitDays = MARKET_CONTACT_DAYS.min + Math.floor(marketHash(seed, listingId, 7) * span);
  const buyerKo = MARKET_BUYERS[Math.floor(marketHash(seed, listingId, 13) * MARKET_BUYERS.length)];
  const l = {
    listingId, kind, refId, ko,
    won: price.won,
    leaves: price.leaves, variegatedLeaves: price.variegatedLeaves,
    grade: price.grade, gradeKo: price.gradeKo,
    listedOnDay: S.day,
    /* 절대 게임일이다 — 상대 일수로 적으면 세이브 왕복에서 어긋난다(`orders.arrivesOnDay` 규약) */
    contactOnDay: S.day + waitDays,
    waitDays, buyerKo,
    status: 'waiting'
  };
  shop.listings.push(l);
  return l;
}

/* 게시글을 화면이 읽는 모양으로. **화면이 다시 세지 않게** 여기서 다 낸다. */
export function marketStatus(S) {
  const list = marketOf(S).map(l => ({
    ...l,
    /* ⚠⚠ **`daysLeft` 를 화면에 적지 마라.** 며칠 뒤인지가 보이면 랜덤이라는 것이 없어지고
       기다림이 「그날까지 [다음 날] N번 누르기」라는 사무가 된다(§marketWaitKo).
       검사·재현이 쓰라고 내는 값이다. 화면이 쓸 것은 아래 `sinceDays` 다. */
    daysLeft: Math.max(0, l.contactOnDay - S.day),
    /* 올린 지 며칠 — 「기다리는 중이다」를 화면이 말할 때 쓴다. 앞날을 안 흘린다 */
    sinceDays: Math.max(0, S.day - l.listedOnDay),
    contacted: l.status === 'contacted'
  }));
  const contacted = list.filter(l => l.contacted);
  const waiting = list.filter(l => !l.contacted);
  return {
    listings: list, contacted, waiting,
    count: list.length, contactedCount: contacted.length, waitingCount: waiting.length,
    /* ★ 「연락 온 것이 있다」는 **상태**다 — [상점] 단추에 점을 붙이는 자리(quiet §1) */
    contactedWon: contacted.reduce((n, l) => n + l.won, 0),
    totalWon: list.reduce((n, l) => n + l.won, 0),
    openedOnDay: shopOf(S).marketOpenedOnDay ?? null
  };
}

/* ★ 그루를 중고 거래에 올린다. **아직 팔린 것이 아니다** — 돈은 `dealListing` 이 낸다.
     opt.leaves            growth 가 센 잎 수            ★필수
     opt.variegatedLeaves  그중 무늬 잎 수                ★필수
     opt.potId             (없으면 S.pots[0])
     opt.species           기본 'monstera'
     opt.gateLeaves        문 판정에 쓸 모주 잎 수(없으면 opt.leaves 를 쓴다)
   ⚠ 화분은 **방에 그대로 있다.** 위 §물건을 안 치운다. */
export function listPot(S, opt = {}) {
  const pots = S.pots || [];
  const p = opt.potId ? pots.find(x => x.id === opt.potId) : pots[0];
  if (!p) throw new Error('[중고] 올릴 그루가 없습니다 — 화분이 비어 있습니다');
  if (!Number.isInteger(opt.leaves))
    throw new Error('[중고] 잎 수(opt.leaves)를 주세요 — 값은 잎으로 매기고, ' +
      '잎 수는 growth 소유라 코어가 지어내지 않습니다 (io.growth 가 낸 값을 넘겨 주세요)');
  const gate = marketGate(S, { leaves: Number.isInteger(opt.gateLeaves) ? opt.gateLeaves : opt.leaves });
  if (!gate.open) { const e = new Error('[중고] ' + gate.reason); e.tutorialInput = true; throw e; }
  if (p.listing && listingOf(S, p.listing)) {
    const e = new Error(`[중고] ${p.id} 은(는) 이미 올려 두었습니다`); e.tutorialInput = true; throw e;
  }
  const q = priceOf({ species: opt.species || 'monstera',
                      leaves: opt.leaves,
                      variegatedLeaves: opt.variegatedLeaves || 0 });
  const l = pushListing(S, { kind: 'pot', refId: p.id, ko: '몬스테라', price: q });
  p.listing = l.listingId;
  if (typeof opt.log === 'function')
    opt.log(`📮 몬스테라를 중고 거래에 올렸습니다 — 잎 ${q.leaves}장 중 무늬 ${q.variegatedLeaves}장 · ` +
            `${q.won.toLocaleString()}원 · ${marketWaitKo()}`);
  return { listing: l, price: q, potId: p.id,
           events: [{ id: 'market_listed', ko: '몬스테라를 중고 거래에 올렸습니다',
                      listingId: l.listingId, kind: 'pot', won: q.won,
                      waitDays: l.waitDays, contactOnDay: l.contactOnDay }] };
}

/* ★ 그루를 통째로 판다 — **없어졌다.** 아래 §sellPot 이 이정표다(던진다). */

/* ============================================================
   ★★ 삽수는 **뿌리내려야 팔린다** (2026-08-03 · 박사님 확정)
   ------------------------------------------------------------
   원문: *"꾸준수입은 삽수를 파는 것으로 성립시킨다. **자르고 → 뿌리내리고 → 판다.**"*

   예전에는 자른 그 날 바로 팔렸다. 그러면 "자르기"가 곧 "돈"이라 **기다림이 없고**,
   물꽂이 12일 · 직삽 24일이라는 두 갈래의 차이도 값이 아니게 된다.
   뿌리 없는 조각은 상품이 아니다 — 실제로도 그렇고, 게임에서도 그래야 시간이 값이 된다.

     rooting      아직 못 판다 (물꽂이 12일 · 직삽 24일 · propagation.METHODS)
     rooted       판다 — 뿌리를 냈다
     node         판다 — 혹까지 났다 (분갈이 기한이 도는 중)
     established  판다 — 자리를 잡았다
     dead         못 판다
============================================================ */
export const SELLABLE_CUTTING_STATUS = Object.freeze(['rooted', 'node', 'established']);

/* 팔 때 돌아오는 용기 — `propagation.CONTAINERS[*].returnsOnSale` 과 **같은 표**다.
   propagation 이 shop 을 import 하므로 반대로 부르면 순환이 된다. 그래서 여기 한 줄만 둔다.
   ⚠ 둘이 갈리면 병이 사라지거나 늘어난다 — tools/test_propagation.mjs 가 등식을 고정한다. */
export const CONTAINER_RETURNS = Object.freeze({ jar: 'jar' });

/* ★ 삽수를 중고 거래에 올린다. 코어가 전부 아는 물건이라 잎 수를 받지 않는다.
   ⚠ 삽수는 **목록에 그대로 남는다** — 분갈이도 되고 자라기도 한다(§물건을 안 치운다).
     값만 얼린다. 시들면 게시글이 내려간다(§stepMarket). */
export function listCutting(S, cuttingOrId, opt = {}) {
  const list = S.cuttings || [];
  const c = typeof cuttingOrId === 'string' ? list.find(x => x.id === cuttingOrId) : cuttingOrId;
  if (!c) throw new Error(`[중고] 모르는 삽수: ${cuttingOrId}`);
  if (c.status === 'dead') throw new Error(`[중고] ${c.id} 는 이미 시들었습니다 — 올릴 수 없습니다`);
  if (!SELLABLE_CUTTING_STATUS.includes(c.status)) {
    const e = new Error(`[중고] ${c.id} 는 아직 뿌리가 없습니다 — 뿌리내린 뒤에 올릴 수 있습니다 ` +
      `(지금 ${c.days}일째)`);
    e.tutorialInput = true;                 // 안내지 고장이 아니다
    throw e;
  }
  /* ★ 문은 **모주 잎 수**가 연다. 삽수만 남은 판(모주를 이미 판 판)에서는 이미 열려 있다 —
     문이 한 번 열리면 안 닫히기 때문이다(§marketGate). 그래서 여기서는 열려 있는지만 묻는다. */
  const gate = marketGate(S, { leaves: Number.isInteger(opt.gateLeaves) ? opt.gateLeaves : undefined });
  if (!gate.open) { const e = new Error('[중고] ' + gate.reason); e.tutorialInput = true; throw e; }
  if (c.listing && listingOf(S, c.listing)) {
    const e = new Error(`[중고] ${c.id} 는 이미 올려 두었습니다`); e.tutorialInput = true; throw e;
  }
  /* ★ **지금** 달고 있는 잎으로 값을 매긴다 (2026-08-04 — 삽수가 자라게 되면서).
     `c.source` 는 「자를 때 딸려온 것」이라 영원히 안 변하는 기록이다. 그걸로 값을 매기면
     반 년을 키운 삽수를 자른 날 값에 팔게 된다 — 「키우면 값이 붙는다」가 그 자리에서 깨진다.
     ⚠ propagation.js 를 import 하지 않는다(그쪽이 이 파일을 부르므로 순환이 된다).
       그래서 propagation 이 잎을 건드릴 때마다 `c.leaves`·`c.variegatedLeaves` 를 맞춰 둔다
       (`syncCuttingLeaves` 한 곳에서만 한다). 옛 세이브에는 그 칸이 없어 `source` 로 떨어진다. */
  const leaves = Number.isInteger(c.leaves) ? c.leaves : c.source.leaves;
  const varieLeaves = Number.isInteger(c.variegatedLeaves)
    ? c.variegatedLeaves : c.source.variegatedLeaves;
  const q = priceOf({ species: opt.species || 'monstera', leaves, variegatedLeaves: varieLeaves });
  const l = pushListing(S, { kind: 'cutting', refId: c.id, ko: '몬스테라 삽수', price: q });
  c.listing = l.listingId;
  if (typeof opt.log === 'function')
    opt.log(`📮 삽수 ${c.id} 를 중고 거래에 올렸습니다 — 잎 ${q.leaves}장 중 무늬 ${q.variegatedLeaves}장 · ` +
            `${q.won.toLocaleString()}원 · ${marketWaitKo()}`);
  return { listing: l, price: q, cuttingId: c.id,
           events: [{ id: 'market_listed', ko: '삽수를 중고 거래에 올렸습니다',
                      listingId: l.listingId, kind: 'cutting', won: q.won,
                      waitDays: l.waitDays, contactOnDay: l.contactOnDay }] };
}

/* ============================================================
   ⑦-1 ★ 하루 — **연락이 온다**
   ------------------------------------------------------------
   `loop.nextDay` 가 **날짜를 올린 뒤에** `stepShop` 바로 뒤에서 한 번 부른다.
   그래야 「1일 뒤 연락」이 다음 날 아침이 된다(배송과 같은 규약).
   ★ 조용히 오지 않는다 — 연락은 사건이라 events 로 나가고 기록에도 남는다.
   ⚠ 팔 물건이 사라진 게시글(시든 삽수)은 **여기서 내려간다.** 조용히 지우지 않고 말한다.
============================================================ */
export function stepMarket(S, opt = {}) {
  const list = marketOf(S);
  const events = [], contacted = [], withdrawn = [];
  if (!list.length) return { events, contacted, withdrawn };

  const still = [];
  for (const l of list) {
    /* 물건이 아직 있나. 그루는 `S.pots`, 삽수는 `S.cuttings` 다 — 시든 삽수는 목록에서 빠진다 */
    const alive = l.kind === 'pot'
      ? (S.pots || []).some(p => p.id === l.refId)
      : (S.cuttings || []).some(c => c.id === l.refId && c.status !== 'dead');
    if (!alive) {
      withdrawn.push(l);
      const e = { id: 'market_withdrawn', ko: `${l.ko} 게시글을 내렸습니다 — 팔 물건이 없어졌습니다`,
                  listingId: l.listingId, kind: l.kind, won: l.won };
      events.push(e);
      if (typeof opt.log === 'function') opt.log('📭 ' + e.ko);
      continue;
    }
    still.push(l);
    if (l.status === 'contacted' || l.contactOnDay > S.day) continue;
    l.status = 'contacted';
    l.contactedOnDay = S.day;
    contacted.push(l);
    const e = { id: 'market_contact',
                ko: `${josa(l.buyerKo, '이', '가')} ${josa(l.ko, '을', '를')} 사고 싶다고 연락했습니다`,
                listingId: l.listingId, kind: l.kind, won: l.won, buyerKo: l.buyerKo };
    events.push(e);
    if (typeof opt.log === 'function')
      opt.log(`📩 ${e.ko} — ${l.won.toLocaleString()}원 · [상점]에서 거래할 수 있습니다`);
  }
  shopOf(S).listings = still;
  return { events, contacted, withdrawn };
}

/* ============================================================
   ⑦-2 ★★★ 거래 — **여기가 돈이 들어오는 순간이다**
   ------------------------------------------------------------
   ★★ 「무늬 삽수를 팔았나」 깃발이 서는 자리도 **여기다**(반지하 탈출의 둘째 축).
     ⇒ **재서 정했다.** 후보가 둘이었다: 「올린 순간」과 「돈이 들어오는 순간」.
       ㉮ 올린 순간이면 **취소해도 깃발이 선다** — 아무것도 안 팔고 문이 열린다.
         「팔았나」라는 이름이 그 자리에서 거짓이 된다.
       ㉯ 돈이 들어오는 순간이면 **화면이 「팔았습니다」라고 말한 그 순간**과 같다.
         `tutorial.js §무늬 삽수를 판 적이 있다` 가 *"플레이어가 화면에서 본 것은 값이다"*
         라고 적어 둔 바로 그 근거가 여기서도 그대로 선다.
     ⇒ ㉯ 다. 옛 세이브는 안 깨진다 — 이미 선 깃발(`ts.varieSale.count`)은 아무도 안 지운다.
============================================================ */
export function dealListing(S, listingId, opt = {}) {
  const l = listingOf(S, listingId);
  if (!l) throw new Error(`[중고] 모르는 게시글: ${listingId}`);
  if (l.status !== 'contacted') {
    const e = new Error(`[중고] ${josa(l.ko, '은', '는')} 아직 연락이 안 왔습니다 — ` +
      `아직 아무도 연락하지 않았습니다 (${marketWaitKo()})`);
    e.tutorialInput = true;
    throw e;
  }
  const q = { won: l.won, leaves: l.leaves, variegatedLeaves: l.variegatedLeaves,
              grade: l.grade, gradeKo: l.gradeKo };
  const shop = shopOf(S);
  let containerReturned = null, potId = null, cuttingId = null, growthNeedsReset = false;

  if (l.kind === 'pot') {
    const pots = S.pots || [];
    const p = pots.find(x => x.id === l.refId);
    if (!p) throw new Error(`[중고] 팔 그루가 없습니다: ${l.refId}`);
    pots.splice(pots.indexOf(p), 1);
    potId = p.id;
    /* ⚠ 판 그루는 **사라진다.** growth 쪽 형태까지 코어가 지울 수는 없으므로
       (plant_grow 는 한 그루 전용이고 되돌릴 창구가 없다) 호출부가 화면을 정리해야 한다.
       그 사실을 반환값으로 알린다 — 조용히 넘기지 않는다.
       ★ **올릴 때가 아니라 여기서** 낸다. 올릴 때 내면 취소가 3D 를 되살려야 한다. */
    growthNeedsReset = true;
  } else {
    const list = S.cuttings || [];
    const c = list.find(x => x.id === l.refId);
    if (!c) throw new Error(`[중고] 팔 삽수가 없습니다: ${l.refId}`);
    S.cuttings = list.filter(x => x !== c);
    cuttingId = c.id;
    /* ★ 유리 수경병은 돌아온다 — 물꽂이는 병에서 뽑아 보내지 병째 보내지 않는다.
       흙에 심긴 것(soil)은 흙째 나가므로 안 돌아온다. 규칙은 propagation.CONTAINERS 가 갖고
       여기서는 그 표를 읽기만 한다(값을 두 곳에서 정하지 않는다). */
    containerReturned = CONTAINER_RETURNS[c.container] || null;
    if (containerReturned)
      shop.stock[containerReturned] = (shop.stock[containerReturned] || 0) + 1;
  }

  shop.listings = shop.listings.filter(x => x !== l);
  const r = credit(S, l.won, l.kind);

  /* ★★ 「무늬 삽수를 판 적이 있다」 — **반지하 탈출의 둘째 축**이다 (2026-08-13 박사님 확정).
     ⚠ 뜻과 규칙은 여기가 아니라 **`tutorial.js §무늬 삽수를 판 적이 있다`** 가 갖는다.
       여기서 직접 적는 이유는 하나뿐이다: `tutorial.js` 가 이 파일의 `priceOf` 를 쓰므로
       거꾸로 import 하면 **순환**이 된다. `ts.crop.soldWon` 을 적는 것과 같은 방식이다.
     ★ 판정 근거는 **매긴 값에 무늬 잎이 실렸나** 하나다 — 계통은 안 본다(까닭은 tutorial.js).
     ⚠ 옛 세이브에는 `ts.varieSale` 칸이 없다 — 없으면 만들어 쓴다. */
  const ts = S.tutorial && S.tutorial.enabled ? S.tutorial : null;
  if (ts && l.kind === 'cutting' && q.variegatedLeaves >= 1) {
    const v = ts.varieSale || (ts.varieSale = { count: 0, firstDay: null, wonTotal: 0, migrated: null });
    v.count = (v.count || 0) + 1;
    v.wonTotal = (v.wonTotal || 0) + q.won;
    if (v.firstDay == null) v.firstDay = ts.day;
  }
  if (typeof opt.log === 'function')
    opt.log(`💰 ${josa(l.buyerKo, '과', '와')} ${l.ko} 거래를 마쳤습니다 — 잎 ${q.leaves}장 중 ` +
            `무늬 ${q.variegatedLeaves}장 · ${q.won.toLocaleString()}원` +
            (containerReturned ? ` · ${CATALOG[containerReturned].ko} 는 남습니다` : ''));
  return {
    ...r, price: q, listing: l, listingId: l.listingId, kind: l.kind,
    potId, cuttingId, containerReturned, growthNeedsReset,
    /* ⚠ 옛 이름을 그대로 낸다 — 화면·검사가 「무엇을 팔았나」로 갈래를 읽는다 */
    events: [{ id: l.kind === 'pot' ? 'plant_sold' : 'cutting_sold',
               ko: l.kind === 'pot' ? '그루를 팔았습니다' : '삽수를 팔았습니다',
               won: q.won, leaves: q.leaves, variegatedLeaves: q.variegatedLeaves,
               listingId: l.listingId, buyerKo: l.buyerKo }]
  };
}

/* ★ 게시글을 내린다 — **한 푼도 안 움직인다.** 물건은 애초에 안 나갔으므로 표만 뗀다.
   ⚠ 취소를 막지 않는다. 막으면 잘못 올린 그루가 영영 묶여 **판이 잠긴다**
     (상점 주문의 *"취소는 없다"* 와 다른 자리다 — 저쪽은 **돈이 이미 나갔고** 배송 시간이
      벌이지만, 이쪽은 나간 것이 아무것도 없다). */
export function cancelListing(S, listingId, opt = {}) {
  const l = listingOf(S, listingId);
  if (!l) throw new Error(`[중고] 모르는 게시글: ${listingId}`);
  const shop = shopOf(S);
  shop.listings = shop.listings.filter(x => x !== l);
  const item = l.kind === 'pot'
    ? (S.pots || []).find(p => p.id === l.refId)
    : (S.cuttings || []).find(c => c.id === l.refId);
  if (item) delete item.listing;
  if (typeof opt.log === 'function') opt.log(`📭 ${l.ko} 게시글을 내렸습니다 — 그대로 남아 있습니다`);
  return { listing: l, listingId: l.listingId, kind: l.kind, refId: l.refId,
           events: [{ id: 'market_cancelled', ko: `${l.ko} 게시글을 내렸습니다`,
                      listingId: l.listingId, kind: l.kind }] };
}

/* ============================================================
   ⑦-3 ⛔ **없어진 창구 둘** — 이름만 남겨 던진다 (2026-08-17)
   ------------------------------------------------------------
   박사님: *"몬스테라 연관된 것 자체가 다 상점에는 그냥 안 팔리게 해 줘."*

   ★ 왜 지우지 않고 **던지게** 두나. 지우면 부르는 쪽이 `SyntaxError` 로 죽는데,
     그 말에는 **어디로 가야 하는지가 없다.** 이 저장소에는 이 둘을 부르는 재현 도구가
     여섯 벌 있다(`tools/probe_econ` · `probe_economy_gap` · `probe_elec` ·
     `probe_lamp_econ` · `probe_three_layers` · `probe_tutorial_length`).
     ⇒ **부르는 순간 옮겨 갈 길을 적은 채로 던진다.** `credit` 이 모르는 갈래에 대해 하는 것과
       같은 방식이다 — 조용히 되지 않고, 어디를 고쳐야 하는지 말한다.
   ⚠ **조용히 「올리기」로 바꿔치기하지 않았다.** 그러면 돈이 안 들어왔는데 들어온 줄 알고
     세는 재현이 생긴다(START-HERE §2 — 「고장난 상태를 검사가 정상으로 못 박은 것」).
============================================================ */
const MOVED_TO_MARKET = (was, now) =>
  `[상점] ${was} 은(는) 없어졌습니다 — **몬스테라 것은 상점에서 안 팔립니다.** ` +
  `중고 거래로 가세요: ${now}(S, …) 로 올리고 → [다음 날]로 연락을 기다리고(stepMarket) → ` +
  `dealListing(S, listingId) 에서 돈이 들어옵니다 ` +
  `(까닭은 src/game/shop.js §⑦-0 · docs/handoff/plan-2026-08-17-market.md)`;

export function sellPot() { throw new Error(MOVED_TO_MARKET('sellPot', 'listPot')); }
export function sellCutting() { throw new Error(MOVED_TO_MARKET('sellCutting', 'listCutting')); }

/* ============================================================
   ★★ 잉여 채소 — 지갑에 닿는 자리 (2026-08-06 신설)
   ------------------------------------------------------------
   무엇을 파는지·왜 그것만 파는지는 **first_play.js §잉여 판매**가 전부 갖고 있다.
   여기 있는 것은 두 가지뿐이다: **돈으로 바꾸는 한 줄**과 **손익분기를 재는 자**.

   ★ 왜 여기 있나 — `credit` 이 여기 있기 때문이다. 그루(`sellPot`)·삽수(`sellCutting`)와
     **같은 문**으로 들어와야 `ts.crop.soldWon`·`shop.earnedWon`·파산 해제가 한 곳에서 돈다.
============================================================ */

/* ★★ 손익분기 — **이 아래로 팔면 씨앗값도 못 건진다.**
   ------------------------------------------------------------
   한 회전을 돌리는 데 지갑에서 나가는 것은 **씨앗값**이고, 그 값은 정가가 아니라
   `buyPriceOf`(정가 × 1.4 · 100원 올림)다. 한 회전이 낼 수 있는 최대는 최상 품질(3끼)의
   한 회전분이다. 그 둘의 비가 손익분기다.

     콩나물  500원 / 3,000원 = **16.7%**   (2026-08-09 — 씨앗 실구매가 700 → 500원)
     무순    600원 / 1,867원 = **32.1%**   (2026-08-09 — 무순 회전분 2,000 → 2,800×2/3)

   ⚠ 정가(350·400원)로 셈하면 11.7% / 21.4% 가 나온다 — **틀린 값이다.**
     지갑에서 나가는 것은 정가가 아니다(econgap 이 실제로 그렇게 한 번 틀렸다).
   ★ 판매가를 여기서 막지 않는다. **재서 보여 줄 뿐**이다 — 손익분기 아래로 두는 것은
     고장이 아니라 판단이고, 그 판단은 박사님 것이다. */
export function cropBreakEvenRate(kindId = 'beansprout') {
  const k = CROP_KINDS[cropKindIndexOf(kindId)];
  /* ⚠⚠ 2026-08-17 — **셋째 인자를 0 으로 못 박았다.** 예전에는 `cropCycleSavedWon(R, 3, i)`
     처럼 인자 셋으로 불렀고, 그러면 넷째(`kindIndex`)가 셋째(`tiredIndex`)를 따라가
     **무순에 질림 배율 ×2/3 이 같이 걸렸다.** 질림이 걷힌 지금(first_play §질림 2026-08-17)
     그 곱은 없는 벌이라, 무순 손익분기가 20.0% 대신 32.1% 로 **잘못 나온다.**
     ⇒ 「어느 작물인가」와 「몇 번째로 거뒀나」는 다른 축이다. 넷째 인자로 갈라서 넘긴다. */
  const fullWon = cropCycleSavedWon(FIRST_PLAY_RULES, FIRST_PLAY_RULES.qualityMaxMeals,
                                    0, cropKindIndexOf(kindId));
  if (!(fullWon > 0)) throw new Error(`[상점] ${kindId} 의 한 회전분이 0원입니다`);
  return buyPriceOf(k.seedItemId) / fullWon;
}

/* 잉여를 넘긴 값을 지갑에 넣는다. **얼마인지는 여기서 안 정한다** —
   `first_play.takeCropSurplus` 가 낸 값을 그대로 받는다(값의 정본을 둘로 만들지 않는다).
   ⚠ 이 함수는 장부를 안 비운다. 비우는 것은 그쪽이고 묶는 것은 `state.sellCropSurplus` 다. */
/* ★ 2026-08-13 — `opt.kind` 를 **받을 수 있게** 뚫어 뒀다(기본은 예전 그대로 `'crop'`).
   지금 이 함수를 부르는 데가 둘인데(`state.sellCropSurplus` 잉여 · `state.sellPantryCrop` 곳간)
   **둘 다 `'crop'` 으로 들어온다** — 실측으로 확인했다. 가르려면 곳간 쪽이
   `{ kind: 'cropPantry' }` 를 넘기면 되고, `state.js` 는 이번 창의 쓰기 영역 밖이라 안 고쳤다.
   ⚠ 그렇다고 지금 가계부가 둘을 **못 가르는 것은 아니다** — 그 둘의 정본은
     `firstPlay.food.totalPantrySoldWon` · `totalSurplusSoldWon` 으로 이미 따로 있다.
     여기서 또 나누면 **정본이 두 벌**이 된다. 그래서 받는 쪽만 뚫고 값은 안 나눴다. */
export function creditCropSurplus(S, won, opt = {}) {
  const v = Math.round(won);
  if (!Number.isFinite(v) || v < 0)
    throw new Error(`[상점] 잉여 판매액이 올바르지 않습니다: ${won}`);
  const r = credit(S, v, opt.kind || 'crop');
  if (typeof opt.log === 'function')
    opt.log(`💰 잉여 채소를 넘겼습니다 — ${v.toLocaleString()}원`);
  return r;
}

/* ============================================================
   ⑧ ★ 파산해도 막히지 않는다 (박사님 질문에 대한 답)
   ------------------------------------------------------------
   질문: "잭팟이 안 터지면? 그래도 파산으로 게임이 끝나면 안 된다 — 어떻게 할지 정하고 근거를 대라."

   **새 구제 장치를 만들지 않았다.** 이미 있는 규칙 셋이 겹쳐서 이미 안 막힌다.

     ㉮ **0원 아래로 안 내려간다.** `tutorial.tutorialDay` 가 0에서 잡고 하루는 그대로 간다
        (story_arc.md §0 — 스토리 모드 전체가 초보다). 파산은 표시이지 종료가 아니다.
     ㉯ **잭팟은 시간이 걸릴 뿐 확률이 0이 아니다.** 무늬는 잎이 날 때마다 굴려지고
        (`calcVarieProb` · growth 소유), 몬스테라는 돈이 없어도 계속 자란다.
        즉 **돈이 없는 동안에도 잭팟은 계속 굴러간다** — 이게 이 설계의 핵심이다.
        "돈이 떨어지면 아무것도 못 한다"가 아니라 "기다리는 일만 남는다"가 된다.
     ㉰ **콩나물은 이미 받은 시루가 남는다.** 씨앗을 못 사면 회전이 멈추지만, 멈춘다고
        시루가 사라지지 않는다 — 돈이 조금이라도 생기면(2,100원) 바로 다시 돈다.
        하루 지출(20,000원)의 10분의 1이라 회복 문턱이 낮다.

   ⚠ 그래서 **"파산 = 정지"가 아니라 "파산 = 기다림"** 이다. 겨울까지 가는 경로 C 가
     실패가 아니라 더딘 것이라는 story_arc.md §2 의 판정과 같은 모양이다.
============================================================ */

/* 지금 상황을 한 줄로 — 화면이 "무엇을 하면 되나"를 적을 때 쓴다. */
export function shopStatus(S) {
  const shop = shopOf(S);
  return {
    stock: { ...shop.stock },
    orders: shop.orders.map(o => ({ ...o, daysLeft: o.arrivesOnDay - S.day })),
    spentWon: shop.spentWon,
    earnedWon: shop.earnedWon,
    /* ★ 2026-08-13 — 갈래별 판 돈(§판 돈은 갈래별로). 화면이 「식물 판 것」을
       **뺄셈으로 구하지 않아도** 되게 여기서 같이 낸다. `earnedWon` 은 그대로 남는다. */
    sales: saleLedgerOf(S),
    /* ★ 2026-08-17 — 중고 거래에 올려 둔 것(§⑦-0). 「올렸는데 아무 일도 없다」가 안 되게
       화면이 **한 번에** 읽는다. 점([상점] 단추)도 이 값을 본다. */
    market: marketStatus(S)
  };
}
