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
  bean_seed: Object.freeze({
    id: 'bean_seed', ko: '콩 씨앗 (1시루분)', kind: 'seed',
    listWon: 500, leadDays: 1,
    note: 'docs/food_economy.md §3 — 실제 시세 700~1,200원의 한가운데. ' +
          'first_play.FIRST_PLAY_RULES.seedWonPerSiru 와 **같은 값이어야 한다**'
  }),
  /* ⚠ 콩 씨앗과 **더는 같은 값이 아니다** (2026-08-04). 예전 근거였던 "콩 1시루와 같은 값"은
     콩 쪽이 내려가면서 끊겼다 — 이 값은 sale_economy.md §3 가 직접 적은 1,500원으로 선다.
     몬스테라 씨앗은 파는 물건(수입)의 씨앗이고 콩은 지출을 막는 물건이라 축이 애초에 다르다. */
  monstera_seed: Object.freeze({
    id: 'monstera_seed', ko: '몬스테라 씨앗 (1립)', kind: 'seed',
    listWon: 1_500, leadDays: 1,
    note: 'docs/sale_economy.md §3 가격표 — "몬스테라 씨앗 1립 1,500"'
  }),
  siru: Object.freeze({
    id: 'siru', ko: '콩나물 시루 (차광 용기)', kind: 'container',
    listWon: 5_000, leadDays: 2,
    note: 'docs/shop.md §2 — 정본에 용기값이 없어 sale_economy.md §4 의 "묘목 5,000원"' +
          '(정본에 있는 가장 싼 완제품)을 소품 가격대의 기준으로 삼았다. plan 확인 대기'
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
     ⚠⚠ 콩 씨앗과 같은 규약이다 — **지갑에서 실제로 나가는 값은 여기다.**
       `CROP_KINDS.musun.seedWonPerPot`(정가·표시용)와 늘 같은 값이어야 한다. */
  radish_seed: Object.freeze({
    id: 'radish_seed', ko: '무 씨앗 (1판분)', kind: 'seed',
    listWon: 400, leadDays: 1,
    note: '실제 무씨 시세 100g 1,758원 · 1kg 18,000원(=1,800원/100g). 한 판(20×30cm)에 ' +
          '20~30g 쓰므로 350~530원 — 그 한가운데. 콩(500원)보다 씨가 잘아 조금 덜 든다. ' +
          'first_play.CROP_KINDS.musun.seedWonPerPot 과 **같은 값이어야 한다**'
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
export function createShopState() {
  return {
    schema: SHOP_SCHEMA,
    seq: 0,
    /* 배송 중인 주문. 도착하면 여기서 빠지고 stock 으로 옮겨간다. */
    orders: [],
    /* 도착해서 방에 쌓여 있는 것. `{ itemId: 개수 }` */
    stock: {},
    spentWon: 0,
    earnedWon: 0
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
  Object.freeze({ id: 'halfmoon', ko: '하프문', minVarieLeaves: 3, leafMult: 61 })
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
============================================================ */

function credit(S, won, kind) {
  const ts = S.tutorial && S.tutorial.enabled ? S.tutorial : null;
  const shop = shopOf(S);
  shop.earnedWon += won;
  if (ts) {
    ts.cashWon += won;
    if (!ts.crop) ts.crop = { spentWon: 0, soldWon: 0 };
    ts.crop.soldWon += won;
    if (ts.bankrupt && ts.cashWon > 0) ts.bankrupt = false;
  }
  return { won, kind, cashWon: ts ? ts.cashWon : null };
}

/* 화분에 심긴 그루를 통째로 판다. **이사 자금을 만드는 그 한 방**이다.
     opt.leaves            growth 가 센 잎 수            ★필수
     opt.variegatedLeaves  그중 무늬 잎 수                ★필수
     opt.potId             (없으면 S.pots[0])
     opt.species           기본 'monstera'
   ⚠ 판 그루는 **사라진다.** growth 쪽 형태까지 코어가 지울 수는 없으므로
     (plant_grow 는 한 그루 전용이고 되돌릴 창구가 없다) 호출부가 화면을 정리해야 한다.
     그 사실을 반환값 `growthNeedsReset` 으로 알린다 — 조용히 넘기지 않는다. */
export function sellPot(S, opt = {}) {
  const pots = S.pots || [];
  const p = opt.potId ? pots.find(x => x.id === opt.potId) : pots[0];
  if (!p) throw new Error('[상점] 팔 그루가 없습니다 — 화분이 비어 있습니다');
  if (!Number.isInteger(opt.leaves))
    throw new Error('[상점] 잎 수(opt.leaves)를 주세요 — 값은 잎으로 매기고, ' +
      '잎 수는 growth 소유라 코어가 지어내지 않습니다 (io.growth 가 낸 값을 넘겨 주세요)');
  const q = priceOf({ species: opt.species || 'monstera',
                      leaves: opt.leaves,
                      variegatedLeaves: opt.variegatedLeaves || 0 });
  const idx = pots.indexOf(p);
  pots.splice(idx, 1);
  const r = credit(S, q.won, 'pot');
  if (typeof opt.log === 'function')
    opt.log(`💰 ${p.id} 을(를) 팔았습니다 — 잎 ${q.leaves}장 중 무늬 ${q.variegatedLeaves}장 ` +
            `(v ${q.v.toFixed(3)}) · ${q.won.toLocaleString()}원`);
  return { ...r, price: q, potId: p.id, growthNeedsReset: true,
           events: [{ id: 'plant_sold', ko: '그루를 팔았습니다', won: q.won,
                      leaves: q.leaves, variegatedLeaves: q.variegatedLeaves, v: q.v }] };
}

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

/* 삽수를 판다. 코어가 전부 아는 물건이라 잎 수를 받지 않는다. */
export function sellCutting(S, cuttingOrId, opt = {}) {
  const list = S.cuttings || [];
  const c = typeof cuttingOrId === 'string' ? list.find(x => x.id === cuttingOrId) : cuttingOrId;
  if (!c) throw new Error(`[상점] 모르는 삽수: ${cuttingOrId}`);
  if (c.status === 'dead') throw new Error(`[상점] ${c.id} 는 이미 시들었습니다 — 팔 수 없습니다`);
  if (!SELLABLE_CUTTING_STATUS.includes(c.status)) {
    const e = new Error(`[상점] ${c.id} 는 아직 뿌리가 없습니다 — 뿌리내린 뒤에 팔 수 있습니다 ` +
      `(지금 ${c.days}일째)`);
    e.tutorialInput = true;                 // 안내지 고장이 아니다
    throw e;
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
  S.cuttings = list.filter(x => x !== c);
  const r = credit(S, q.won, 'cutting');
  /* ★ 유리 수경병은 돌아온다 — 물꽂이는 병에서 뽑아 보내지 병째 보내지 않는다.
     흙에 심긴 것(soil)은 흙째 나가므로 안 돌아온다. 규칙은 propagation.CONTAINERS 가 갖고
     여기서는 그 표를 읽기만 한다(값을 두 곳에서 정하지 않는다).
     ⚠ 순환 import 를 피하려고 표를 베끼지 않고 **반환값으로 알린다** — 호출부가 아니라
       loop/게임이 아니라 여기서 바로 처리해야 하므로, 표만 지역 상수로 둔다(아래 한 줄). */
  const returned = CONTAINER_RETURNS[c.container] || null;
  if (returned) {
    const shop = shopOf(S);
    shop.stock[returned] = (shop.stock[returned] || 0) + 1;
  }
  if (typeof opt.log === 'function')
    opt.log(`💰 삽수 ${c.id} 를 팔았습니다 — 잎 ${q.leaves}장 중 무늬 ${q.variegatedLeaves}장 ` +
            `(v ${q.v.toFixed(3)}) · ${q.won.toLocaleString()}원` +
            (returned ? ` · ${CATALOG[returned].ko} 는 남습니다` : ''));
  return { ...r, price: q, cuttingId: c.id, containerReturned: returned,
           events: [{ id: 'cutting_sold', ko: '삽수를 팔았습니다', won: q.won,
                      leaves: q.leaves, variegatedLeaves: q.variegatedLeaves, v: q.v }] };
}

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

     콩나물  700원 / 3,000원 = **23.3%**
     무순    600원 / 2,000원 = **30.0%**

   ⚠ 정가(500·400원)로 셈하면 16.7% / 20.0% 가 나온다 — **틀린 값이다.**
     지갑에서 나가는 것은 정가가 아니다(econgap 이 실제로 그렇게 한 번 틀렸다).
   ★ 판매가를 여기서 막지 않는다. **재서 보여 줄 뿐**이다 — 손익분기 아래로 두는 것은
     고장이 아니라 판단이고, 그 판단은 박사님 것이다. */
export function cropBreakEvenRate(kindId = 'beansprout') {
  const k = CROP_KINDS[cropKindIndexOf(kindId)];
  const fullWon = cropCycleSavedWon(FIRST_PLAY_RULES, FIRST_PLAY_RULES.qualityMaxMeals,
                                    cropKindIndexOf(kindId));
  if (!(fullWon > 0)) throw new Error(`[상점] ${kindId} 의 한 회전분이 0원입니다`);
  return buyPriceOf(k.seedItemId) / fullWon;
}

/* 잉여를 넘긴 값을 지갑에 넣는다. **얼마인지는 여기서 안 정한다** —
   `first_play.takeCropSurplus` 가 낸 값을 그대로 받는다(값의 정본을 둘로 만들지 않는다).
   ⚠ 이 함수는 장부를 안 비운다. 비우는 것은 그쪽이고 묶는 것은 `state.sellCropSurplus` 다. */
export function creditCropSurplus(S, won, opt = {}) {
  const v = Math.round(won);
  if (!Number.isFinite(v) || v < 0)
    throw new Error(`[상점] 잉여 판매액이 올바르지 않습니다: ${won}`);
  const r = credit(S, v, 'crop');
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
    earnedWon: shop.earnedWon
  };
}
