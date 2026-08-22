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

/* ============================================================
   ②-3 ★★★ 가구 — **117개를 손으로 안 적는다. 프리셋에서 읽어 짓는다** (2026-08-17)
   ------------------------------------------------------------
   박사님 확정(2026-08-17):
     *"**가구 판매/구매도 열자. 등 기구 해금될 때.** 가구 상점은 방 탭에 같이 포함되게 만들자.
       가구는 다양하게 **이미 다 만들어둔 걸로** 알고 있고, **창호나 이런 거 말고 가구만** 넣어서
       해줘. **판매는 가구 클릭하면 나오는 팝업 탭에 추가로 버튼** 만들어서 넣어줘.
       그리고 **가구 가격을 좀 비싸게** 책정하는 게 좋을 듯."*
     그리고 값에 대해: *"**가구 크기 일부 수정한 거 있잖아. 지금 거에 맞춰서.**"*

   ══ ★ 왜 표를 안 적나 ═══════════════════════════════════════════════════════
   `data/furniture_presets.json` 에 프리셋이 **117개**다. 여기 베끼면 프리셋이 늘 때마다
   상점이 낡고, 이름·크기가 **두 벌**이 되어 갈린다(§2.8 이 가르친 바로 그 사고).
   ⇒ **프리셋을 읽어서 짓는다.** 프리셋이 늘면 상점도 저절로 는다.

   ══ ★★★ 크기는 어디서 오나 — **`size_m` 하나뿐이다** ════════════════════════
   ⚠⚠ **프리셋의 `w`·`d`·`h` 로 부피를 재면 절반이 틀린다. 재서 확인했다.**
     그 셋은 **빌더에 넘기는 밑값**이라 안 적힌 것이 많고(협탁은 셋 다 없다) 뜻도 다르다 —
     천장등 `h: 0.35` 는 **갓 높이**인데 실제 크기는 줄까지 **0.55** 다(펜던트 둘도 그렇다).
     안 적힌 칸을 0 으로 읽으면 값이 밑값(30,000원)으로 주저앉고, 적힌 칸만 믿으면
     같은 가구가 방마다 다른 값이 된다.
   ⇒ **크기의 정본은 빌더**(`render3d/furniture_pastel.js` 의 `userData.size`)다.
     그 값을 **프리셋 파일의 `size_m` 칸에 박아 두었다**(손으로 적은 것이 아니라 빌더를
     실제로 돌려 받아 적었다). 상점은 그 칸 하나만 본다.
   ⚠ **그래서 검사가 반드시 있어야 한다** — `tools/test_furnishop.mjs §A` 가 117개를
     빌더로 다시 지어 `size_m` 과 한 톨이라도 다르면 깨뜨린다. 값이 두 벌인 것을 검사가
     못 박아 지키는 형태이고, 이 저장소가 「빛 문턱이 세 곳에 있어」 겪은 사고의 예방이다.
   ⚠ 방 정의(`house_rooms.json`)가 프리셋을 덮어쓸 수 있다(창턱 깊이 0.24 → 0.30 이 그렇다).
     **덮어쓴 크기는 그 방에서만의 값**이라 상점 값(프리셋 값)과 다를 수 있다 —
     파는 값을 낼 때는 부르는 쪽이 덮어쓴 크기를 넘길 수 있게 열어 두었다(§furnitureQuoteOf).

   ══ ★★ 무엇을 팔고 무엇을 안 파나 — **이름으로 안 뺀다** ═══════════════════════
   박사님 *"창호나 이런 거 말고 가구만"*. 프리셋에는 가구가 아닌 것이 섞여 있다.
   하나하나 이름으로 빼면 프리셋이 늘 때마다 낡으므로 **데이터 칸으로 금을 긋는다.**

     ① **조명이다**      `grow` · `has_light` · `type` 이 `lamp_*`·`growlight_*`·
                        `desk_lamp`·`string_light`
                        ⇒ 식물등은 이미 따로 판다(`tutorial.buyLamp`)고, 장식등은 밝기 계통이라
                          사고팔면 방의 조도가 조용히 바뀐다. 그건 가구 일이 아니다.
                        ⚠ `shelf_growrack_2tier`(그로우랙)도 여기로 뺐다 — `has_light` 가 켜져
                          **등이 달린 것처럼 생겼는데 `lighting_presets.fixtures` 에 없어 빛을
                          한 톨도 안 낸다.** 팔면 화면이 거짓말을 하게 된다.
     ② **벽·창에 붙는다** `mount` 가 `wall`·`window`·`under-shelf`·`ceiling`
                        ⇒ 박사님이 말씀하신 「창호나 이런 거」가 정확히 이것이다. 창턱 받침·
                          벽걸이 선반·액자·벽시계·칠판·게시판이 한 번에 걸린다.
                        ★ `corner`·`lean-wall` 은 **안 뺀다** — 바닥에 서는 가구다
                          (코너 선반·사다리 선반). 「mount 가 있으면 뺀다」로 하면 그 둘을 잃는다.
     ③ **매단다**        `room` 에 「천장」 ⇒ 이 게임에는 **매다는 자리가 없다**.
                        (`§POT_KINDS` 가 마크라메 행잉 화분을 같은 까닭으로 뺐다 — 선례를 따른다)
     ④ **살림집이 아니다** `room` 에 「학원」·「교실」·「사무」 ⇒ 교탁·학생책상·사물함.
                        ⚠ 이 넷은 **자유 글자 칸**이라 제일 약한 금이다. 새 프리셋이 딴 낱말을
                          쓰면 새어 나온다 — 다만 **새어도 「가구가 하나 더 팔린다」일 뿐**이라
                          조용히 틀리지 않는다.
     ⑤ **가전이다**      `appliance: true` ⇒ 냉장고·TV·주방 카운터.
                        ⚠ 이 셋만은 **데이터가 스스로 못 가른다**(바닥에 서고 빛도 안 낸다).
                          그래서 프리셋 파일에 **거르는 칸을 하나 더했다**. 이름 목록이 아니라
                          데이터 칸이므로 코드가 안 낡는다.
     ⑥ **크기를 모른다**  `size_m` 이 없거나 부피가 0 ⇒ **값을 지어내지 않는다.** 안 판다.
                        (지금은 0개다 — 117개가 전부 크기를 갖는다)

   ⇒ 지금 결과: **가구 81 · 걸러 낸 것 36**(조명 11 · 붙박이 12 · 학원 9 · 가전 3 · 매단 것 1).
     목록은 `docs/handoff/furnishop-to-plan.md` 에 표로 있다.
   ⏸ 판단이 갈릴 만한 것 셋을 **일부러 남겼다**(박사님이 보고 옮기실 수 있게):
     전신 거울(세워 두는 가구로 봤다) · 사무 의자·넓은 책상(「학원·사무」라 걸렸다).

   ══ ★★★ 값 — **부피 하나로 센다** ═══════════════════════════════════════════
       정가 = 100원올림( 밑값 30,000 + 140,000 × 부피[㎥] )
       실구매 = `buyPriceOf` (정가 × 1.4 · 100원 올림) — 다른 품목과 **같은 규칙**이다

   ★ 왜 갈래 계수를 안 뒀나. 갈래마다 계수를 매기려면 **60여 개의 숫자를 지어내야** 한다.
     지어낸 값은 근거가 없어 다음 사람이 못 고친다(*"지어낸 값이 실패다"*). 재 보니
     **부피 하나로도 한국 실거래가 범위에 전부 들어왔다** — 협탁 5.6만(실 5~8만) ·
     책상 13.3만(실 10~20만) · 옷장 25.8만(실 20~40만) · 2인 소파 32.5만(실 30~60만) ·
     싱글 침대 41.1만(실 20~40만). 계수를 더 얹을 자리가 안 나왔다.

   ★★ **두 상수는 지어낸 것이 아니라 이 게임의 돈에 맞춘 것이다.**
     · **밑값 30,000원** — 실구매 42,000원이 되어 **식물등(25,000원)의 1.68배**다.
       ⇒ 「제일 싼 가구도 식물등보다 비싸다」가 이 상수의 뜻이다. 박사님 *"좀 비싸게"* 다.
     · **㎥당 140,000원** — 싱글 침대(1.88㎥) 실구매가 **410,500원 = 월세(20만) 2.05달치**로
       떨어지는 눈금이다. ⇒ 「큰 가구 하나 = 월세 두 달」이 이 상수의 뜻이다.
     ⇒ 그래서 **제일 싼 것 러그 46,700원(월세 0.23달) ~ 제일 비싼 것 이층 침대 733,600원
       (월세 3.67달 · 시작돈 150만의 49%)** 사이에 81개가 선다.

   ══ ★★★ 되사는 값 — **정가의 30%** (실구매가의 21.4%) ═══════════════════════
   ⚠ 이 저장소에 이미 있는 되사기 규칙은 **잉여 채소 85%** 하나인데 **그것을 안 따랐다.**
     채소는 오늘 거둔 상품이고 가구는 **중고**다. 그리고 결정적인 이유가 따로 있다:
   ★★ **재서 정했다 — 85%로 두면 반지하 탈출이 깨진다.**
     반지하에 팔 수 있는 가구가 여섯이고(침대·책상·의자·서랍장·3단선반·협탁) 정가 합이
     **626,300원**이다. 85%면 **532,000원**이 그냥 생긴다 — 이사비 200만의 27%이고,
     하프문 그루를 판 뒤 남는 여유(21만원 · START-HERE §6)의 **2.5배**다.
     ⇒ 「침대를 팔아 이사 간다」가 열려 **하프문이 탈출의 축이 아니게 된다.**
   ⇒ 30%로 두면 여섯을 통째로 팔아도 **187,600원** — **월세 한 달치(20만)의 94%**이고
     이사비의 **9.4%** 다. 「가구를 팔면 한 달을 버틴다」는 되고 「가구를 팔아 나간다」는 안 된다.
     그리고 되사려면 877,000원이라 **판 값의 4.7배** — 홧김에 못 판다.
   ⚠ 100원 단위 **내림**이다(사는 값은 올림). 중고를 넘기는 쪽이 손해를 본다.
============================================================ */

/* 가구 품목 id 는 `furn_` 으로 시작한다 — `CATALOG` 의 이름과 절대 안 겹치게. */
export const FURNITURE_ITEM_PREFIX = 'furn_';
export const furnitureItemIdOf = (preset) => FURNITURE_ITEM_PREFIX + preset;
export const isFurnitureItemId = (id) => typeof id === 'string' && id.startsWith(FURNITURE_ITEM_PREFIX);
export const presetOfFurnitureItemId = (id) =>
  isFurnitureItemId(id) ? id.slice(FURNITURE_ITEM_PREFIX.length) : null;

export const FURNITURE_RULES = Object.freeze({
  baseWon: 30_000,        // 밑값(정가) — 실구매 42,000원 = 식물등 25,000원의 1.68배
  volWonPerM3: 140_000,   // ㎥당(정가) — 싱글 침대 실구매 410,500원 = 월세 2.05달치
  resaleRate: 0.30,       // 되사는 값 = 정가의 30% (재서 정했다 — 위 ★★★)
  leadDays: 2             // 배송. 부피가 있는 것은 2일 — §② 머리말 규칙 그대로다
});

/* 「가구가 아닌 것」의 금 — **전부 데이터 칸이다.** 위 §무엇을 팔고 무엇을 안 파나 */
const FURN_LIGHT_TYPE = /^(?:lamp_|growlight_)|^(?:desk_lamp|string_light)$/;
export const FURNITURE_FIXED_MOUNTS = Object.freeze(['wall', 'window', 'under-shelf', 'ceiling']);
const FURN_HANGING_ROOM = /천장/;
const FURN_OFFHOME_ROOM = /학원|교실|사무/;

/* 걸러 낸 까닭 — **사람이 읽는 말이다.** 표를 뽑을 때도 화면이 물을 때도 이 한 벌을 쓴다. */
export const FURNITURE_KIND_KO = Object.freeze({
  furniture: '가구',
  lighting: '조명 — 식물등은 따로 팔고 장식등은 밝기 계통이다',
  fixture: '벽·창 붙박이 — 박사님이 말씀하신 「창호나 이런 거」',
  hanging: '매다는 것 — 이 게임에 매다는 자리가 없다',
  school: '살림집 가구가 아니다 (학원·교실·사무)',
  appliance: '가전이다',
  unsized: '크기를 모른다 — 값을 지어내지 않는다'
});

/* 프리셋 한 줄이 무엇인가. **아무것도 안 바꾼다(순수).**
   반환 { kind, why } · kind 가 'furniture' 면 상점에 낸다. */
export function furnitureKindOf(presetId, p) {
  if (!p || typeof p !== 'object') return { kind: 'unsized', why: FURNITURE_KIND_KO.unsized };
  const type = p.type || presetId;
  const k =
      (p.grow || p.has_light || FURN_LIGHT_TYPE.test(type)) ? 'lighting'
    : (p.mount && FURNITURE_FIXED_MOUNTS.includes(p.mount)) ? 'fixture'
    : FURN_HANGING_ROOM.test(p.room || '') ? 'hanging'
    : FURN_OFFHOME_ROOM.test(p.room || '') ? 'school'
    : p.appliance === true ? 'appliance'
    : !(p.size_m && p.size_m.w > 0 && p.size_m.d > 0 && p.size_m.h > 0) ? 'unsized'
    : 'furniture';
  return { kind: k, why: FURNITURE_KIND_KO[k] };
}

/* 부피[㎥]. **`size_m` 하나만 본다** — `w`·`d`·`h` 는 빌더 밑값이라 뜻이 다르다(위 ⚠⚠). */
export function furnitureVolumeOf(sizeM) {
  const s = sizeM;
  if (!s || !(s.w > 0) || !(s.d > 0) || !(s.h > 0)) return 0;
  return s.w * s.d * s.h;
}

/* 정가(= 파는 값의 뿌리). 100원 올림 — 다른 품목과 같은 눈금이다. */
export function furniturePriceOf(sizeM) {
  const vol = furnitureVolumeOf(sizeM);
  if (!(vol > 0))
    throw new Error('[가구] 크기를 몰라 값을 매길 수 없습니다 — size_m 이 필요합니다');
  const R = FURNITURE_RULES;
  return Math.ceil((R.baseWon + R.volWonPerM3 * vol) / 100) * 100;
}

/* 되사는 값. **100원 내림**이다(사는 값은 올림) — 중고를 넘기는 쪽이 손해를 본다. */
export function furnitureResaleWonOf(listWon) {
  if (!(listWon > 0)) return 0;
  return Math.floor(listWon * FURNITURE_RULES.resaleRate / 100) * 100;
}

/* ── 프리셋 표를 꽂는다 ─────────────────────────────────────────────────
   규약은 `installVarieGrades` 와 같다: **파일이 정본이고, 못 읽으면 빈 표로 돈다.**
   ⚠ 밑값(하드코딩 사본)을 **안 둔다.** 117개를 여기 베끼면 이 절이 막으려는 그 사고가 된다.
     못 읽으면 가구가 **한 줄도 안 뜬다** — 조용히 틀리는 대신 아예 없다. */
let _FURN = Object.freeze({ presets: {}, items: new Map(), all: [] });

export function installFurniturePresets(json) {
  const presets = (json && json.presets) || {};
  const items = new Map(), all = [];
  for (const [presetId, p] of Object.entries(presets)) {
    const { kind, why } = furnitureKindOf(presetId, p);
    const sizeM = p.size_m && p.size_m.w > 0 ? { w: p.size_m.w, d: p.size_m.d, h: p.size_m.h } : null;
    const volumeM3 = furnitureVolumeOf(sizeM);
    const listWon = kind === 'furniture' ? furniturePriceOf(sizeM) : null;
    const row = Object.freeze({
      id: furnitureItemIdOf(presetId), preset: presetId, type: p.type || presetId,
      ko: p.name_ko || presetId, kind: 'furniture',            // 상점 갈래(탭)
      shopKind: kind, why,                                     // 가구인가 · 아니면 왜 아닌가
      sizeM, volumeM3,
      listWon, leadDays: FURNITURE_RULES.leadDays,
      note: `data/furniture_presets.json §${presetId} — 크기는 size_m(빌더가 낸 값)`
    });
    all.push(row);
    if (kind === 'furniture') items.set(row.id, row);
  }
  _FURN = Object.freeze({ presets, items, all: Object.freeze(all) });
  return _FURN;
}

/* 프리셋 117 줄 전부 — **걸러 낸 것까지 낸다.** 표를 뽑고 까닭을 보여 주는 창구다. */
export function furnitureAllList() { return _FURN.all.map(r => ({ ...r })); }

/* ★ 저절로 한 번 읽는다 — `varie_grades` 와 **같은 규약**(브라우저 fetch · node fs).
   실패하면 가구가 안 뜰 뿐 게임은 돈다. */
const FURNITURE_PRESETS_URL = new URL('../../data/furniture_presets.json', import.meta.url);
try {
  const j = FURNITURE_PRESETS_URL.protocol === 'file:'
    ? JSON.parse((await import('node:fs')).readFileSync(FURNITURE_PRESETS_URL, 'utf8'))
    : await fetch(FURNITURE_PRESETS_URL.href).then(r => (r.ok ? r.json() : null));
  if (j) installFurniturePresets(j);
} catch { /* 못 읽으면 가구가 안 뜬다 — 위 ⚠ */ }

/* 품목 하나를 찾는다 — **`CATALOG` 와 가구 표를 한 창구로 본다.**
   ⚠ 값·재고·주문을 다루는 자리는 전부 이것을 쓴다. `CATALOG[id]` 를 직접 읽으면
     가구가 「모르는 품목」이 된다. */
export function catalogItemOf(itemId) {
  return CATALOG[itemId] || _FURN.items.get(itemId) || null;
}
/* 품목의 한글 이름. **모르면 id 를 그대로 낸다**(화면이 죽지 않게) */
export const catalogKoOf = (itemId) => {
  const it = catalogItemOf(itemId);
  return it ? it.ko : String(itemId);
};

/* ★★ 가구 상점의 문 — **등 기구가 해금될 때 열린다** (박사님: *"등 기구 해금될 때"*)
   ------------------------------------------------------------
   정본은 `tutorial.js` 의 `ts.lamp.unlocked`(가을 진입에 켜진다 · §lampUnlockSeason)다.
   여기서 계절을 다시 세지 않는다 — 세면 두 벌이 된다.
   ⚠ 열리기 전에는 **목록에 아예 안 뜬다.** 이 저장소는 못 사는 것을 안 띄운다
     (무순·수경병·식물등이 이미 그 규칙이다 — `game.html §drawShop`).
   ⚠ 첫 플레이가 꺼진 판(검수·재현)에서는 **안 감춘다** — 다른 갈래와 같은 규약이다. */
export function furnitureShopOpen(S) {
  const ts = S && S.tutorial;
  if (!ts || !ts.enabled) return { open: true, reason: null };
  const open = !!(ts.lamp && ts.lamp.unlocked);
  return { open, reason: open ? null
    : '가구는 아직 살 수 없습니다 — 식물등이 열리는 때(가을)에 같이 열립니다' };
}

/* 상점에 낼 가구 목록. **문이 닫혀 있으면 빈 목록**이다(위 ⚠). */
export function furnitureCatalogList(S) {
  if (!furnitureShopOpen(S).open) return [];
  return [..._FURN.items.values()].map(it => ({
    id: it.id, ko: it.ko, kind: it.kind, preset: it.preset, type: it.type,
    sizeM: it.sizeM, volumeM3: it.volumeM3,
    listWon: it.listWon, buyWon: buyPriceOf(it.id),
    resaleWon: furnitureResaleWonOf(it.listWon),
    leadDays: it.leadDays, note: it.note
  })).sort((a, b) => a.buyWon - b.buyWon || a.id.localeCompare(b.id));
}

/* ★ 이 가구가 얼마짜리인가 — **묻기만 한다.** 화면이 팝업에 값을 적을 때 쓴다.
     presetId  프리셋 이름 (`roomView.furniture()` 의 `preset`)
     opt.sizeM 방이 크기를 덮어썼으면 그 크기(없으면 프리셋 크기)
   반환 { ok, reason, preset, ko, sizeM, listWon, buyWon, resaleWon, shopKind }
   ⚠ 「가구가 아닌 것」이면 `ok:false` 이고 **왜 아닌지**를 말한다(§FURNITURE_KIND_KO). */
export function furnitureQuoteOf(presetId, opt = {}) {
  const p = _FURN.presets[presetId];
  if (!p) return { ok: false, reason: `모르는 가구입니다: ${presetId}`, preset: presetId };
  const { kind, why } = furnitureKindOf(presetId, p);
  const ko = p.name_ko || presetId;
  const base = { preset: presetId, ko, shopKind: kind };
  if (kind !== 'furniture')
    return { ...base, ok: false, reason: `${ko}은(는) 사고팔 수 없습니다 — ${why}` };
  const sizeM = opt.sizeM && opt.sizeM.w > 0 ? opt.sizeM : p.size_m;
  const listWon = furniturePriceOf(sizeM);
  return { ...base, ok: true, reason: null, sizeM: { ...sizeM }, volumeM3: furnitureVolumeOf(sizeM),
           listWon, buyWon: markupWonOf(listWon),
           resaleWon: furnitureResaleWonOf(listWon), itemId: furnitureItemIdOf(presetId) };
}

/* 판 돈을 지갑에 넣는다 — 그루·삽수·채소와 **같은 문**(`credit`)으로 들어온다.
   ⚠ 무엇이 얼마인지는 여기서 안 정한다. `furnitureQuoteOf` 가 낸 값을 받는다. */
export function creditFurnitureSale(S, won, opt = {}) {
  const v = Math.round(won);
  if (!Number.isFinite(v) || v < 0)
    throw new Error(`[가구] 판 값이 올바르지 않습니다: ${won}`);
  const r = credit(S, v, 'furniture');
  if (typeof opt.log === 'function')
    opt.log(`💰 ${opt.ko || '가구'}를 넘겼습니다 — ${v.toLocaleString()}원`);
  return r;
}

/* 정가 → 사는 값. **마진과 눈금을 적은 자리는 여기 하나다** — 두 벌이 되면 갈린다. */
export const markupWonOf = (listWon) => Math.ceil(listWon * BUY_MARKUP / 100) * 100;

/* 사는 값. 100원 단위로 올림한다 — 2,100 처럼 지갑에서 셀 수 있는 수가 되게. */
export function buyPriceOf(itemId) {
  const it = catalogItemOf(itemId);
  if (!it) throw new Error(`[상점] 모르는 품목입니다: ${itemId} (아는 것: ${Object.keys(CATALOG).join(', ')} · ` +
                           `가구 ${_FURN.items.size}종)`);
  return markupWonOf(it.listWon);
}

/* ⚠ **가구는 여기 안 나온다.** 가구는 `furnitureCatalogList(S)` 가 따로 낸다 —
   이 목록은 [상점] 탭이 그대로 쓰고, 가구를 섞으면 117줄이 씨앗·그릇 사이에 선다
   (`game.html §shopGroupOf` 가 모르는 갈래를 「채소 키우는 그릇」으로 떨어뜨린다). */
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
  /* ★ 가구 (2026-08-17 · 아래 §⑨). **여기 이름을 올리는 것이 갈래를 새로 만드는 유일한 길이다** —
     안 올리고 `credit` 을 부르면 그 자리에서 던진다(위 §「미리 해 둔다」). */
  'furniture',
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
  const it = catalogItemOf(itemId);
  if (!it) throw new Error(`[상점] 모르는 품목입니다: ${itemId} (아는 것: ${Object.keys(CATALOG).join(', ')})`);
  if (!Number.isInteger(qty) || qty < 1)
    throw new Error(`[상점] 개수가 1 이상의 정수가 아닙니다: ${qty}`);
  /* ★ 가구는 **문이 열려야 주문된다**(§②-3 §가구 상점의 문). 목록에서 감추는 것만으로는
     안 된다 — 화면이 아니라 창구가 막아야 「목록에 없는 것을 주문하는」 길이 안 남는다. */
  if (isFurnitureItemId(itemId)) {
    const gate = furnitureShopOpen(S);
    if (!gate.open) { const e = new Error('[상점] ' + gate.reason); e.tutorialInput = true; throw e; }
  }

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
    const it = catalogItemOf(o.itemId);
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
    const it = catalogItemOf(itemId);
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

   ══ ★★★ 2026-08-17 — 등급이 **장수에서 종류로** 바뀌었다 ════════════════════
   박사님 확정문: `docs/handoff/plan-2026-08-17-varie-grade.md`.
   박사님과 코드가 **다른 축을 보고 있었다.** 박사님은 처음부터 *무늬의 종류(패턴)* 를
   말씀하셨고, 코드는 *무늬 잎이 몇 장인가* 로 등급을 매기고 있었다.
   박사님 원문: *"어쩐지 산반이 너무 싸더라고."* — 코드에서 산반은 9만원이었다.

   ⇒ 아래 §VARIE_GRADES 이후는 전부 **`data/balance/varie_grades.json` 이 정본**이다.
     여기 코드는 읽기만 한다. 갈래 이름도 숫자도 코드에 안 박는다(§2.8 사고의 원인).

   ══ ⛔ 없앤 것 ① — **「섹터」 갈래** ════════════════════════════════════════
   옛 사다리는 넷이었다(무지 < 산반 < 섹터 < 하프문). 확정문은 **셋**이다
   (산반 · 하프문 · **풀문**). 섹터는 갈 곳이 없어 지운다.
   ★ 지우면서 **왜 지웠는지와 그 값이 어디서 왔는지**를 남긴다 — 근거가 사라지면
     다음 사람이 "이 값 어디서 왔지" 로 다시 헤맨다(§2.6 「낡은 주석이 재는 자가 된다」).

     산반  8             `sale_economy.md` 「몬스테라 삽수(알보) 80,000」 ÷ 10,000
     ⛔섹터 320/9 ≈ 35.556 `sale_economy.md` 「포토스 희귀무늬 성체 800,000」 ÷ (3,750×6)
                          ★ **실제 시장가에서 나온 값**이었다. 지어낸 수가 아니다 —
                            그래서 2026-08-09 에 「산반 8 과 섹터 320/9 는 못 건드린다」고
                            적어 두었고, 하프문만 640/9 로 올렸다.
                          ⇒ 그럼에도 지운다. 값이 틀려서가 아니라 **축이 바뀌어서**다:
                            섹터는 「무늬 잎 2장」이라는 장수 칸에 붙어 있던 이름이고,
                            종류 축에는 대응하는 에셋 갈래가 없다(`mon_*` 열아홉 중 어느 것도
                            「흰 덩어리가 큼직하게 앉은 것」이 아니다. 하프문이 그 자리를 먹는다).
     하프문 640/9 ≈ 71.11  옛 공식 상한 61 의 후계. 「섹터의 정확히 두 배」로 정했었다
                          ⇒ 이 배수도 없어졌다. 지금은 **잎 한 장 750,000원**이라는 절대값이다.

   ══ ⛔ 없앤 것 ② — **`CUTTING_GRADE_CAP`(삽수 등급 뚜껑)** ═══════════════════
   *"잎 3장 미만이면 산반까지"* 라는 뚜껑이 있었다. 그 뚜껑의 근거는 하나였다 —
   *"삽수는 그 무늬가 유지될지 아직 아무도 모른다"*(원복·고스트가 뿌리내린 뒤에 갈렸다).
   ★ **그 근거가 2026-08-17 삽수 단순화로 사라졌다.** 원복도 고스트도 걷혔다
     (`propagation.js` §③ — 박사님 *"이건 게임이니까 좀 단순화하자"*).
   ⇒ 남은 뜻 「삽수는 싸다」는 **×1.0 대 ×1.4** 가 대신한다(확정문 §2).
     즉 삽수냐 그루냐는 **잎 수가 아니라 파는 길**(`listCutting`/`listPot`)이 정한다.
     ★ 덤 — 잎 3장짜리 삽수가 뚜껑을 빠져나가던 구멍도 같이 막힌다.

   ══ ★ 고스트(전백)는 여전히 이 사다리에 **없다** ════════════════════════════
   잎 전체가 흰 것을 한국 시장은 「고스트」라 부르는데 값의 꼭대기가 아니라 **경고**로 읽는다.
   ⇒ 「가장 흰 것이 가장 비싸다」가 아니므로 무늬를 끝까지 밀어붙이는 길이 값으로 보상받지 않는다.
   ⚠ **`fullalbo`(알보-전체흰) 에셋은 풀문에 들어 있다.** 모순이 아니다 — 저건 잎 한 장의
     무늬 모양(전백 잎)이고, 「고스트」는 *그루의 성장점이 죽었다* 는 진단이다. 축이 다르다.
============================================================ */

/* ============================================================
   ⑥-0 ★★ 등급표를 **파일에서 읽는다** — `data/balance/varie_grades.json`
   ------------------------------------------------------------
   ★ 박사님이 코드를 안 고치고 갈래를 옮길 수 있어야 한다(확정문 §1 ★★ · 박사님 요청 1).
     그래서 갈래 묶음(§1) · 값과 배수(§2) · 빛별 확률(§3) 이 **전부 그 파일**에 있고,
     이 파일은 **읽는 자리 하나**다.

   ★ 규약은 `stamina.js §staminaRulesFrom` 과 같다 — **파일이 이기고, 없는 칸은 밑값이 채운다.**
     던지지 않는다: 밸런스 파일 하나 때문에 게임이 안 열리면 안 된다.

   ⚠⚠ **밑값(`FALLBACK`)이 왜 여기 있나 — 그리고 왜 위험하지 않은가.**
     §2.8 이 가르친 사고가 「같은 숫자가 두 곳에 있다가 갈리는 것」이라 밑값은 원래 위험하다.
     그런데 값이 아예 없으면 파일을 못 읽는 순간 **값이 0원이 되거나 던진다.**
     ⇒ 그래서 밑값을 두되 **`tools/test_variegrade.mjs` 검사 A 가 파일과 밑값이 같은지를
       한 줄도 안 봐주고 못 박는다.** 갈리면 검사가 그 자리에서 깨진다 — 조용히 갈릴 수 없다.

   ★ 읽는 길이 셋이다. 셋 다 같은 표로 수렴한다:
     ① **저절로** — 이 모듈이 열릴 때 한 번 읽어 본다(아래 top-level await).
        브라우저면 `fetch`, node 면 `node:fs`. 실패하면 조용히 밑값으로 돈다.
     ② **꽂아 준다** — `installVarieGrades(json)`. game.html 이 다른 밸런스 파일처럼
        한 줄로 꽂고 싶을 때 쓴다(`staminaRulesFrom` 과 같은 모양).
     ③ **밑값** — 위 둘이 다 안 되면.
============================================================ */

/* 밑값. ⚠ **정본이 아니다.** 정본은 `data/balance/varie_grades.json` 이고
   이 표는 그 파일을 못 읽었을 때만 산다(검사 A 가 둘이 같은지 고정한다). */
const VARIE_GRADES_FALLBACK = Object.freeze({
  schema: 'varie_grades/1',
  grades: [
    { id: 'plain',    ko: '무지',   varie: false, leafWon:    20_000, assets: [] },
    { id: 'sanban',   ko: '산반',   varie: true,  leafWon:   350_000, midAssets: [
      { id: 'heart_albo_2672_3',         ko: '알보-크림민트',    midNums: [35, 6, 7] },
      { id: 'heart_lime_2672_0',         ko: '라임-형광',        midNums: [34, 8, 9] },
      { id: 'heart_marble_2652',         ko: '마블-실버',        midNums: [32, 10, 11] },
      { id: 'heart_speckle_2657',        ko: '스페클-실버점',    midNums: [33, 12, 13] },
      { id: 'pothos_cream_marble',       ko: '마블-크림그린',    midNums: [37, 14, 15] },
      { id: 'pothos_cream_vein',         ko: '잎맥-크림',        midNums: [36, 16, 17] },
      { id: 'pothos_marble_greenyellow', ko: '마블-그린옐로우',  midNums: [39, 18, 19] },
      { id: 'pothos_marble_whitegreen',  ko: '마블-흰그린',      midNums: [40, 20, 21] },
      { id: 'pothos_mint_dot',           ko: '스페클-민트흰점',  midNums: [38, 22, 23] },
      { id: 'pothos_mint_dot_34',        ko: '스페클-민트흰점2', midNums: [24, 25, 26] },
      { id: 'pothos_silver_droplet',     ko: '실버-물방울',      midNums: [41, 27, 28] }
    ], assets: [
      { id: 'speckle_greencream', ko: '스페클-그린크림',     matNum: 13 },
      { id: 'zebra',              ko: '제브라-그린흰',       matNum: 31 },
      { id: 'star_greenwhite',    ko: '별무늬-그린흰',       matNum: 46 },
      { id: 'star_greenyellow',   ko: '별무늬-그린옐로우',   matNum: 40 },
      { id: 'star_palegreen',     ko: '별무늬-페일그린',     matNum: 4 },
      { id: 'green_yellow',       ko: '오로레아-그린옐로우', matNum: 22 },
      { id: 'green_lemonpatch',   ko: '라임-레몬패치',       matNum: 25 },
      { id: 'neon_lime',          ko: '네온-라임',           matNum: 28 }
    ] },
    { id: 'halfmoon', ko: '하프문', varie: true,  leafWon:   750_000, midAssets: [
      { id: 'heart_halfmoon_v2_stem', ko: '하프문-크림민트', midNums: [29, 30, 31] }
    ], assets: [
      { id: 'halfmoon_greenwhite', ko: '하프문-그린흰',   matNum: 34 },
      { id: 'halfmoon_greencream', ko: '하프문-그린크림', matNum: 52 },
      { id: 'galaxy_tealgold',     ko: '갤럭시-틸골드',   matNum: 10 },
      { id: 'galaxy_darkteal',     ko: '갤럭시-다크틸',   matNum: 19 },
      { id: 'star_pinkmint',       ko: '별무늬-핑크민트', matNum: 7 }
    ] },
    { id: 'fullmoon', ko: '풀문',   varie: true,  leafWon: 1_150_000, midAssets: [
      { id: 'monstera_leaf_fullalbo', ko: '알보-전체흰중기', midNums: [1, 2, 3] },
      { id: 'pothos_whitegreen_29',   ko: '알보-흰연두',     midNums: [42, 4, 5] }
    ], assets: [
      { id: 'variegata_pink', ko: '핑크-로즈핑크',     matNum: 1 },
      { id: 'variegata_gold', ko: '오로레아-골드',     matNum: 16 },
      { id: 'rose_pink',      ko: '핑크-로즈',         matNum: 43 },
      { id: 'mauve',          ko: '모브-라벤더그레이', matNum: 37 },
      { id: 'fullalbo',       ko: '알보-전체흰',       matNum: 55 },
      /* ★ 2026-08-16 — 차콜을 여기 넣었다(박사님: *"3은 니가 정해"*).
         눈으로 안 정하고 **섬네일을 재서** 정했다: 으뜸색 (21,25,25) · 색 1,480가지로
         초록 기미가 없고 잎 전체가 한 색이다 — 모브·알보와 같은 무리다.
         자세한 것은 `data/balance/varie_grades.json` §_unassignedDoc. */
      { id: 'charcoal',       ko: '차콜-다크그린',     matNum: 49 }
    ] }
  ],
  /* ★★ 2026-08-16 박사님 확정 — 중간잎은 **등급과 상관없이 한 못**에서 뽑는다(§⑥-4b)
     ★★ 2026-08-23 — 못이 **1갈래 → 14갈래**가 됐다(plan `ca8607b`). 1갈래면 감춰지는 것이
       아니라 「무늬잎은 다 저 그림」이라는 **새 규칙이 읽힌다** — 목적이 뒤집힌다.
     ⚠ 아래 목록은 `data/balance/varie_grades.json` 의 것과 **한 톨도 다르면 안 된다.**
       여기는 파일을 못 읽었을 때만 사는 사본이고, 갈리면 「파일을 고쳤는데 게임은 옛 값」이
       조용히 선다. `test_variegrade A-2` 가 그 자리를 막고 서 있다 — 파일을 고치면
       **여기도 같이 고쳐야 검사가 통과한다.** 그것이 이 사본을 두고도 안 갈리는 유일한 방법이다.
     ⚠ `midNums` 는 여기서도 안 적는다 — 번호의 정본은 위 `midAssets` 표 하나다. */
  midCommon: { enabled: true, fromGrade: 'halfmoon', pool: [
      { id: 'heart_albo_2672_3' },
      { id: 'heart_marble_2652' },
      { id: 'heart_speckle_2657' },
      { id: 'pothos_cream_marble' },
      { id: 'pothos_cream_vein' },
      { id: 'pothos_marble_whitegreen' },
      { id: 'pothos_mint_dot' },
      { id: 'pothos_mint_dot_34' },
      { id: 'pothos_silver_droplet' },
      { id: 'heart_halfmoon_v2_stem' },
      { id: 'monstera_leaf_fullalbo' },
      { id: 'pothos_whitegreen_29' }
  ] },
  sale: { cuttingMult: 1.0, potMult: 1.4, synergy: { 0: 1.0, 1: 1.0, 2: 1.25, 3: 1.5 } },
  lightGrade: {
    dark:   { sanban: 0.90, halfmoon: 0.09, fullmoon: 0.01 },
    mid:    { sanban: 0.70, halfmoon: 0.25, fullmoon: 0.05 },
    bright: { sanban: 0.45, halfmoon: 0.40, fullmoon: 0.15 }
  },
  lightBands: {
    critical: 'dark', poor: 'dark', stagnant: 'dark',
    slow: 'mid',
    best: 'bright', good: 'bright', over: 'bright'
  },
  legacyGradeId: 'sanban',
  prologueGrades: { 1: 'plain', 2: 'sanban', 3: 'halfmoon' },
  /* ✅ 2026-08-16 — 비었다. 차콜을 풀문에 넣어 19갈래가 다 자리를 잡았다(위 ★). */
  unassignedAssets: []
});

/* 파일 한 장 → 쓸 수 있는 규칙 한 벌. **파일이 이기고 없는 칸은 밑값**(stamina 규약).
   ⚠ 던지지 않는다. 대신 어디서 왔는지를 `source` 에 적는다(화면·검사가 물을 수 있게). */
export function varieGradesFrom(json) {
  const F = VARIE_GRADES_FALLBACK;
  const j = (json && typeof json === 'object') ? json : null;
  const rows = Array.isArray(j && j.grades) && j.grades.length ? j.grades : F.grades;
  const grades = rows.map(g => Object.freeze({
    id: String(g.id),
    ko: String(g.ko ?? g.id),
    /* ★ 「무늬인가」는 **적힌 대로** 읽는다. id 로 짐작하지 않는다 —
       박사님이 갈래를 늘리시면 짐작이 그 자리에서 거짓이 된다. */
    varie: !!g.varie,
    leafWon: Number.isFinite(g.leafWon) ? g.leafWon : 0,
    assets: Object.freeze((Array.isArray(g.assets) ? g.assets : []).map(a => Object.freeze({
      id: String(a.id), ko: String(a.ko ?? a.id),
      matNum: Number.isInteger(a.matNum) ? a.matNum : null
    }))),
    /* ★ 중간잎 그림(2026-08-16). 성숙잎과 달리 **세 번호를 다 적는다** —
       `midNums` 가 연속이 아닌 갈래가 있어서 「대표+1+2」로 접을 수 없다(§⑥-4). */
    midAssets: Object.freeze((Array.isArray(g.midAssets) ? g.midAssets : []).map(a => Object.freeze({
      id: String(a.id), ko: String(a.ko ?? a.id),
      midNums: Object.freeze((Array.isArray(a.midNums) ? a.midNums : []).filter(Number.isInteger))
    })).filter(a => a.midNums.length))
  }));
  const sale = (j && j.sale) || F.sale;
  const synRaw = (sale && sale.synergy) || F.sale.synergy;
  const synergy = {};
  for (const [k, v] of Object.entries(synRaw)) {
    const n = Number(k);
    if (Number.isInteger(n) && n >= 0 && Number.isFinite(v) && v > 0) synergy[n] = v;
  }
  const lg = (j && j.lightGrade) || F.lightGrade;
  const lightGrade = {};
  for (const [step, row] of Object.entries(lg)) {
    if (!row || typeof row !== 'object') continue;
    const clean = {};
    for (const [gid, p] of Object.entries(row)) if (Number.isFinite(p) && p > 0) clean[gid] = p;
    lightGrade[step] = Object.freeze(clean);
  }
  const lb = (j && j.lightBands) || F.lightBands;
  const lightBands = {};
  for (const [band, step] of Object.entries(lb))
    if (typeof step === 'string' && lightGrade[step]) lightBands[band] = step;
  const pg = (j && j.prologueGrades) || F.prologueGrades;
  const prologueGrades = {};
  for (const [k, v] of Object.entries(pg)) {
    const n = Number(k);
    if (Number.isInteger(n) && n >= 1 && grades.some(g => g.id === v)) prologueGrades[n] = v;
  }
  const byId = new Map(grades.map(g => [g.id, g]));
  const legacyGradeId = byId.has(j && j.legacyGradeId) ? j.legacyGradeId : F.legacyGradeId;
  /* ★★ 중간잎 통일 (2026-08-16 · §⑥-4b). **켠 것도 끈 것도 파일이 정한다.**
     ⚠ `fromGrade` 가 모르는 이름이거나 그 등급에 중간잎이 없으면 **안 켠다.**
       조용히 다른 갈래로 떨어지면 화면이 왜 그 그림인지 아무도 못 밝힌다. */
  const mcRaw = (j && j.midCommon) || F.midCommon;
  const mcFrom = (mcRaw && typeof mcRaw.fromGrade === 'string') ? mcRaw.fromGrade : null;
  const mcGrade = mcFrom ? byId.get(mcFrom) : null;
  /* ★★ 2026-08-23 — **못을 갈래 목록으로 넓힌다**(`plan-to-asset-midcommon.md §3`).
     ------------------------------------------------------------
     왜 넓히나 — 목적은 「등급을 감추는 것」이지 「한 장만 쓰는 것」이 아니다.
     한 갈래뿐이면 감춰지는 게 아니라 *"무늬잎은 다 저 그림"* 이라는 **새 규칙이 읽힌다.**
     갈래가 많을수록 잘 감춰진다 — 늘리는 것이 기획을 되돌리는 게 아니라 완성하는 것이다.
     ⚠ 성립 조건 하나 — **모든 무늬 잎이 같은 못에서 뽑아야 한다.** 등급마다 못이 다르면
       그림이 다시 등급을 말한다. 그게 애초에 막으려던 것이다.

     ⚠ **하프문 칸에 갈래를 더 넣는 길(㉯)은 안 쓴다.** 지금 코드로 당장 되지만,
       `midCommon` 을 끄는 날 그 갈래들이 하프문의 것으로 남아 하프문이 산반처럼 보인다.
       오늘 도는 임시 방편이 내일의 거짓말이 되는 그 모양이다.

     ★ 표를 정본으로 삼는다 — `pool` 은 **어느 갈래를 쓸지**만 말하고, 그 갈래의 `midNums` 는
       `midAssets` 표에서 가져온다. 목록이 번호까지 지어내면 표와 두 벌이 되고,
       오타 하나가 **없는 그림**으로 조용히 떨어진다(§8-3 이 막으려는 그 사고다).
       그래서 `midNums` 를 적어 보내면 **표와 같은지 대조**하고, 다르면 그 줄을 버리고 까닭을 적는다. */
  const midAssetById = new Map();
  for (const g of grades) for (const a of g.midAssets) midAssetById.set(a.id, a);
  const poolProblems = [];
  const pool = [];
  for (const e of (Array.isArray(mcRaw && mcRaw.pool) ? mcRaw.pool : [])) {
    const id = e && e.id != null ? String(e.id) : '';
    const known = id ? midAssetById.get(id) : null;
    if (!known) { poolProblems.push(`모르는 갈래다: ${id || '(id 가 없다)'}`); continue; }
    const want = Array.isArray(e.midNums) ? e.midNums.filter(Number.isInteger) : null;
    if (want && want.length && String(want) !== String(known.midNums)) {
      poolProblems.push(`${id} 의 midNums 가 표와 다르다: [${want}] ≠ [${known.midNums}]`);
      continue;
    }
    if (pool.some(a => a.id === known.id)) { poolProblems.push(`${id} 가 두 번 적혔다`); continue; }
    pool.push(known);
  }
  const midCommon = Object.freeze({
    enabled: !!(mcRaw && mcRaw.enabled && (pool.length || (mcGrade && mcGrade.midAssets.length))),
    /* 옛 모양. `pool` 이 비었을 때만 쓰인다 — 세이브·밑값이 안 깨지게 남긴다 */
    fromGrade: (mcGrade && mcGrade.midAssets.length) ? mcGrade.id : null,
    /* 새 모양. 있으면 이것이 이긴다 */
    pool: Object.freeze(pool.map(a => Object.freeze({ id: a.id, ko: a.ko, midNums: a.midNums }))),
    /* ★ 버린 줄과 그 까닭 — 조용히 빠지면 「목록을 넣었는데 안 먹는다」가 된다 */
    poolProblems: Object.freeze(poolProblems),
    /* 왜 안 켜졌는지를 남긴다 — 「켰는데 안 먹는다」를 화면·검사가 물을 수 있게 */
    why: !mcRaw || !mcRaw.enabled ? '꺼져 있다'
       : pool.length ? null
       : Array.isArray(mcRaw.pool) && mcRaw.pool.length
           ? `pool 이 다 버려졌다: ${poolProblems.join(' · ')}`
       : !mcFrom ? 'fromGrade 도 pool 도 없다'
       : !mcGrade ? `모르는 등급이다: ${mcFrom}`
       : !mcGrade.midAssets.length ? `${mcFrom} 에 중간잎 갈래가 없다`
       : null
  });
  /* 에셋 갈래 이름·`leaf_mat` 번호 → 등급. **3D 스킨과 값이 같은 것을 보게 하는 표다** */
  const assetIndex = new Map(), matIndex = new Map(), midIndex = new Map();
  for (const g of grades) for (const a of g.assets) {
    assetIndex.set(a.id, g);
    if (a.matNum != null) matIndex.set(a.matNum, g);
  }
  /* 중간잎도 같은 결로 — `leaf_mid_albo{n}` 번호 하나하나가 등급을 가리킨다.
     ⚠ 갈래 id 는 `assetIndex` 에 **같이 넣는다**(성숙·중간이 이름을 안 겹친다 — 검사 G-mid 가 못 박는다). */
  for (const g of grades) for (const a of g.midAssets) {
    assetIndex.set(a.id, g);
    for (const n of a.midNums) midIndex.set(n, g);
  }
  return Object.freeze({
    schema: (j && typeof j.schema === 'string') ? j.schema : F.schema,
    grades: Object.freeze(grades),
    plainId: (grades.find(g => !g.varie) || grades[0]).id,
    varieGrades: Object.freeze(grades.filter(g => g.varie)),
    byId,
    sale: Object.freeze({
      cuttingMult: Number.isFinite(sale.cuttingMult) ? sale.cuttingMult : F.sale.cuttingMult,
      potMult: Number.isFinite(sale.potMult) ? sale.potMult : F.sale.potMult,
      synergy: Object.freeze(synergy)
    }),
    lightGrade: Object.freeze(lightGrade),
    lightBands: Object.freeze(lightBands),
    midCommon,
    legacyGradeId,
    prologueGrades: Object.freeze(prologueGrades),
    unassignedAssets: Object.freeze(
      (Array.isArray(j && j.unassignedAssets) ? j.unassignedAssets : F.unassignedAssets)
        .map(a => Object.freeze({ ...a }))),
    assetIndex, matIndex, midIndex,
    source: j ? 'data/balance/varie_grades.json' : '(밑값 · src/game/shop.js)'
  });
}

let _VARIE = varieGradesFrom(null);

/* ★ 등급 목록. **옛 이름을 그대로 쓴다**(화면·재현이 이 이름으로 표를 그린다).
   ⚠ 모양이 바뀌었다: 옛 `{ minVarieLeaves, leafMult }` 가 **없다.**
     지금은 `{ id, ko, varie, leafWon, assets }` 다 — 장수가 아니라 **잎 한 장 값**이다.
   ★ `const` 가 아니라 `let` 인 까닭: 정본을 꽂으면 이 이름이 새 표를 가리켜야 하고,
     ESM 의 산 바인딩이라 **이미 import 해 간 쪽도 같이 바뀐다**(사본이 안 생긴다). */
export let VARIE_GRADES = _VARIE.grades;

/* ★ 지금 도는 등급표. **읽는 자리는 여기 하나다.** */
export function varieGradeRules() { return _VARIE; }

/* 정본 한 장을 꽂는다. game.html 이 `staminaRulesFrom` 처럼 한 줄로 쓸 수 있게.
   ⚠ `null` 을 주면 밑값으로 되돌린다(검사가 그렇게 쓴다). */
export function installVarieGrades(json) {
  _VARIE = varieGradesFrom(json);
  VARIE_GRADES = _VARIE.grades;
  return _VARIE;
}

/* ★ 저절로 한 번 읽어 본다 — **배선이 없어도 정본이 실제로 닿게** 하는 자리다.
   ⚠ 실패해도 아무 일도 안 난다(밑값이 이미 서 있다). 그래서 `catch` 가 조용하다.
   ⚠ 브라우저는 `fetch`, node 는 `node:fs` 다 — node 에서 `fetch('file:…')` 는 던진다.
     프로토콜로 갈라서 각자 되는 길을 쓴다. */
const VARIE_GRADES_URL = new URL('../../data/balance/varie_grades.json', import.meta.url);
try {
  const j = VARIE_GRADES_URL.protocol === 'file:'
    ? JSON.parse((await import('node:fs')).readFileSync(VARIE_GRADES_URL, 'utf8'))
    : await fetch(VARIE_GRADES_URL.href).then(r => (r.ok ? r.json() : null));
  if (j) installVarieGrades(j);
} catch { /* 밑값으로 돈다 — 위 ⚠ */ }

/* ⏸ **2026-08-17 부터 값에 안 쓴다.** 잎 한 장 값은 이제 등급표(`leafWon`)가 갖는다.
   ⚠ 지우지 않은 까닭 둘 — ① `tools/test_ending_flow.mjs` 가 재현용 목표액으로 이 이름을
     읽는다(`UNIT_WON.monstera.cutting`) ② 「예전에 잎 한 장이 얼마였나」는 사실이라
     지우면 값이 왜 이렇게 뛰었는지를 설명할 근거가 사라진다(민무늬 잎 10,000 → 20,000).
   ⚠ 새 코드에서 이 표로 값을 매기지 마라. `varieGradeRules().byId.get(id).leafWon` 이다. */
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
     깨지고 꾸준수입이 17% 준다. **정본을 지키면서 실질 이득을 없애는 쪽**을 골랐다.

   ⏸ **2026-08-17 부터 값에 안 걸린다.** 제일 싼 잎(무지)이 20,000원이라 12,000원 하한은
     원리적으로 못 걸린다. 이름은 남기되 `priceOf` 는 더 이상 안 부른다 —
     죽은 규칙이 살아 있는 척하면 다음 사람이 그것으로 진단한다(§2.6 「낡은 주석이 재는 자」). */
export const minSaleWonOf = (species) => (UNIT_WON[species] || {}).cutting || 0;

/* 잎 몇 장부터 성체로 보나 — propagation.md §6: "잎 1~2장이면 삽수, 3장부터 성체".
   ⏸ **2026-08-17 부터 값을 안 가른다.** 등급 뚜껑이 걷혔으므로(§⑥ ⛔ 없앤 것 ②)
     이 값이 정하는 것은 `priceOf().size` 라는 **표시 이름 하나**뿐이다.
     삽수냐 그루냐는 이제 `form`(파는 길)이 정한다. */
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

/* ============================================================
   ⑥-1 ★★ 등급을 다루는 자 넷 — **이름·번호·빛·옛 판**
============================================================ */

/* 등급 한 줄. 모르는 id 면 `null`(던지지 않는다 — 화면이 매 프레임 물어볼 수 있다). */
export function varieGradeOf(gradeId) {
  return _VARIE.byId.get(gradeId) || null;
}
/* 민무늬 등급의 id. 코드에 'plain' 을 박지 않는다 — 파일이 이름을 바꿀 수 있다. */
export const plainGradeId = () => _VARIE.plainId;
/* 등급을 모를 때 값이 떨어지는 자리(확정문 §5 — 옛 판의 무늬 잎은 산반으로 읽는다). */
export const legacyVarieGradeId = () => _VARIE.legacyGradeId;

/* ★★ 3D 스킨과 **같은 값을 보게 하는 표** (확정문 §5 ⚠).
   ------------------------------------------------------------
   `plant_grow.html` 은 성숙 무늬를 `leaf_mat{n}` 키로 고르고(`pickLeafKey` → `matFromMid`),
   그 n 은 `skins/mon_*.glb` 한 장을 가리킨다. 대표 번호는 1,4,7,… 이고 그 뒤 둘은
   **같은 메시의 리텍스처본(-쨍/-차분)** 이라 같은 갈래다.
   ⇒ 그래서 등급표는 갈래마다 **대표 번호(matNum)** 를 들고 있고, 여기서 셋을 다 낸다.
   ⚠ 화면에 분홍이 떠 있는데 값은 산반이면 그게 제일 나쁜 거짓말이다(확정문 §5). */
export function gradeOfMatNum(n) {
  if (!Number.isInteger(n) || n < 1) return null;
  /* 대표로 접는다 — 2·3 은 1 의 -쨍/-차분이다(plant_grow §ADJ_ALIAS 와 같은 규칙) */
  return _VARIE.matIndex.get(n - ((n - 1) % 3)) || null;
}
export function gradeOfSkinAsset(assetId) { return _VARIE.assetIndex.get(assetId) || null; }
/* 그 등급이 쓸 수 있는 `leaf_mat` 키들. 대표 + -쨍 + -차분. */
export function skinKeysOfGrade(gradeId) {
  const g = _VARIE.byId.get(gradeId);
  if (!g) return [];
  const out = [];
  for (const a of g.assets)
    if (a.matNum != null) out.push(`leaf_mat${a.matNum}`, `leaf_mat${a.matNum + 1}`, `leaf_mat${a.matNum + 2}`);
  return out;
}

/* ============================================================
   ⑥-1b ★★ **중간잎도 같은 등급에서 고른다** (2026-08-16)
   ------------------------------------------------------------
   박사님: *"세 번째 변이가 중간잎에서는 하프문 발현이 아닌가 보지?"*
          → *"중간잎 말고 **성숙잎 가는 것도 그럼 확정으로 해야겠네. 둘 다.**"*

   ══ 무엇이 어긋나 있었나 ═════════════════════════════════════════════════
   무늬 그림이 **두 벌**인데 둘이 안 이어져 있었다:
     · 중간잎 `leaf_mid_albo1~42`  — 등급이 없었다. growth 가 아무 거나 골랐다
     · 성숙잎 `leaf_mat1~57`(mon_*) — 등급이 있다(§⑥-1)
   ⇒ 중간에 점박이던 잎이 다 자라 반반이 될 수 있었다. 캐논이 남겨 둔 자리다 —
     *"★성숙 특수무늬는 앞선 mid 의 특수 형태를 따라 그룹핑(일관성) — 미구현, 향후."*

   ══ 왜 그림끼리 안 잇고 **등급**으로 잇나 ═══════════════════════════════
   중간잎은 14갈래, 성숙잎은 19갈래다. **짝이 없다**(그린 시기가 다르다).
   ⇒ 이을 수 있는 것은 **등급**뿐이다. 같은 잎은 중간이든 다 자랐든 **같은 등급 안**에서 고른다.
     그러면 「중간에 점박이 → 다 자라 반반」이 원리적으로 안 난다.

   ⚠ `midNums` 가 연속이 아닌 갈래가 있다(알보-흰연두 = 42·4·5). 성숙잎처럼 「대표+1+2」로
     접으면 **엉뚱한 그림**이 나온다 — 그래서 표가 세 번호를 다 들고 있다.
============================================================ */

/* 그 등급이 쓸 수 있는 `leaf_mid_albo` 키들. (성숙잎의 `skinKeysOfGrade` 와 짝) */
export function midSkinKeysOfGrade(gradeId) {
  const g = _VARIE.byId.get(gradeId);
  if (!g) return [];
  const out = [];
  for (const a of g.midAssets) for (const n of a.midNums) out.push(`leaf_mid_albo${n}`);
  return out;
}
/* `leaf_mid_albo{n}` 의 n → **표가 그 번호를 적어 둔 등급**. 모르면 `null`(던지지 않는다).
   ⚠⚠ 2026-08-16 부터 이것은 **「그 잎의 등급」이 아니다.** 중간잎 통일(§⑥-4b)이 켜져 있으면
     산반 잎도 하프문 갈래의 중간잎을 쓴다 — 그림에서 등급을 되읽으면 **거짓말이 된다.**
     이 함수는 표를 검사·정리할 때 쓰는 것이지 판정에 쓰는 것이 아니다.
     잎의 등급은 장부(`pot.leafGrades`) 하나가 정본이다. */
export function gradeOfMidNum(n) {
  if (!Number.isInteger(n) || n < 1) return null;
  return _VARIE.midIndex.get(n) || null;
}

/* ============================================================
   ⑥-4b ★★★ **중간잎은 한 갈래다** — 등급은 성숙 때 드러난다 (2026-08-16 박사님 확정)
   ------------------------------------------------------------
   박사님: *"**중간잎은 하프문만 있는 걸로 그냥 ㄱ**, **성숙 때 확률적으로 분류**되는 걸로."*

   ══ 무엇이 문제였나 ═══════════════════════════════════════════════════════
   §⑥-4 는 중간잎도 **등급별로** 뽑게 했다. 그러면 그림이 등급을 미리 말한다 —
   풀문이 될 잎은 중간부터 전백이고, 하프문이 될 잎은 늘 하프문-크림민트다
   (중간잎 하프문이 **한 갈래뿐**이라 특히 티가 난다 · `midalbo-to-plan.md §9-①`).
   ⇒ 잎이 나는 순간에 등급이 화면에 드러나 「자라 봐야 안다」가 사라진다.

   ══ 무엇을 옮겼고 무엇을 안 옮겼나 ═══════════════════════════════════════
   ★ **옮긴 것: 드러나는 시점.** 중간잎은 등급과 무관하게 한 갈래(`midCommon.fromGrade`)
     에서 뽑고, **성숙잎에서 비로소 등급대로** 갈린다.
   ★ **안 옮긴 것: 정하는 시점.** 등급은 여전히 **잎이 날 때** 정한다(§⑥-3).
     ⚠⚠ 재서 그렇게 정했다. 장부 쓰기를 성숙 때로 미루면 **프롤로그 그루가
       1,960,000 → 1,008,000 원**이 된다(`tools/probe_midreveal.mjs` 실측):
       잎2 만 성숙하고 잎3 이 아직이면 장부에 한 칸이 생겨 `prologueLeafGradeListOf`
       다리가 꺼지고(그 다리는 **장부가 비었을 때만** 산다), 등급 없는 잎3 이
       `legacyGradeId`(산반)로 떨어져 하프문 750,000원이 통째로 사라진다.
       확정문 §2 의 「196만 · 이사비에 4만 모자란다」가 그 자리에서 깨진다.
   ⇒ 값은 잎이 날 때 조용히 정하고, **드러나는 것(그림·알림)만** 성숙 때로 미룬다.
     알림 쪽은 §⑥-3 `assignPotLeafGrades` 의 `revealed` 가 맡는다.

   ⚠ 표(`midAssets` 42키)는 **한 줄도 안 지웠다.** 지우면 잰 근거가 사라진다 —
     `midCommon.enabled` 를 false 로 하면 그 자리에서 예전 동작으로 돌아간다.
============================================================ */

/* 지금 중간잎 통일이 켜져 있나. `{ enabled, fromGrade, why }` — `why` 는 **안 켜진 까닭**이다. */
export function midCommonRule() { return _VARIE.midCommon; }

/* ★ **그 잎이 실제로 쓸** 중간잎 키들. 통일이 켜져 있으면 등급을 안 본다.
   ⚠ `midSkinKeysOfGrade` 와 가른 이유 — 저것은 **표가 무엇을 적어 뒀나**이고
     이것은 **화면이 무엇을 그리나**다. 둘을 한 함수로 두면 검사가 표를 못 잰다. */
export function midSkinPoolOf(gradeId) {
  const mc = _VARIE.midCommon;
  if (!mc.enabled) return midSkinKeysOfGrade(gradeId);
  /* ★ 목록이 있으면 목록이 이긴다(2026-08-23). 없으면 예전처럼 등급 하나에서 뽑는다 —
     세이브·밑값이 안 깨지게 두 모양을 다 받는다. */
  if (mc.pool.length) {
    const out = [];
    for (const a of mc.pool) for (const n of a.midNums) out.push(`leaf_mid_albo${n}`);
    return out;
  }
  return midSkinKeysOfGrade(mc.fromGrade);
}

/* ★★ 빛 → 등급 (확정문 §3). `step` 은 'dark'|'mid'|'bright', `roll` 은 0~1.
   ------------------------------------------------------------
   ⚠ **여기서 「무늬가 나나 마나」를 굴리지 않는다.** 그건 캐논의 20% 이고 growth 소유다.
     이 함수가 정하는 것은 **난 뒤의 등급**뿐이다.
   ⚠ 못 재면 `null` 이다 — 모르는 것으로 벌하지도 상 주지도 않는다(propagation §③ 규약).
   ★ 확률은 파일이 갖는다. 순서는 표에 적힌 순서 그대로다(누적으로 자른다). */
export function varieGradeFromLight(step, roll) {
  const row = _VARIE.lightGrade[step];
  if (!row) return null;
  const r = Math.max(0, Math.min(1, Number.isFinite(roll) ? roll : 0));
  let acc = 0;
  let last = null;
  for (const [gid, p] of Object.entries(row)) {
    last = gid;
    acc += p;
    if (r < acc) return gid;
  }
  return last;                 // 확률 합이 1 에 살짝 못 미쳐도 표 밖으로 안 새게
}
/* 몬스테라 밴드 이름 → 밝기 셋. 여기 없는 밴드는 `null`(모르면 안 정한다). */
export function varieLightStepOfBand(band) {
  return (band && _VARIE.lightBands[band]) || null;
}
/* 그 자리의 무늬 잎 한 장 기대값 — 화면이 「밝은 데 두면 얼마나 이득인가」를 말할 때. */
export function varieGradeExpectedWon(step) {
  const row = _VARIE.lightGrade[step];
  if (!row) return null;
  let won = 0;
  for (const [gid, p] of Object.entries(row)) {
    const g = _VARIE.byId.get(gid);
    if (g) won += p * g.leafWon;
  }
  return won;
}

/* ★ 잎 등급 목록을 늘 같은 모양으로 편다. **여기가 옛 판을 받는 유일한 문이다.**
     leaves            전체 잎 수
     variegatedLeaves  그중 무늬 잎 수 (등급을 모를 때)
     leafGrades        잎별 등급 id 배열 (알 때). 길이가 모자라면 위 둘로 메운다
   ⚠ 등급을 모르는 무늬 잎은 `legacyGradeId`(산반)로 **값을 매길 때만** 떨어진다.
     ledger 에 적지 않는다 — 「모른다」와 「산반으로 정해졌다」는 다른 말이다(확정문 §5). */
export function leafGradeListOf({ leaves, variegatedLeaves = 0, leafGrades = null } = {}) {
  if (!Number.isInteger(leaves) || leaves < 0)
    throw new Error(`[상점] 잎 수가 0 이상의 정수가 아닙니다: ${leaves}`);
  const plain = _VARIE.plainId, legacy = _VARIE.legacyGradeId;
  if (Array.isArray(leafGrades) && leafGrades.length) {
    const out = [];
    let unknownVarie = Math.max(0, variegatedLeaves - leafGrades.filter(
      g => g && _VARIE.byId.get(g) && _VARIE.byId.get(g).varie).length);
    for (let i = 0; i < leaves; i++) {
      const g = leafGrades[i];
      if (g && _VARIE.byId.has(g)) { out.push(g); continue; }
      /* ⚠⚠ **모르는 이름은 던진다.** `null`(모른다)과 「없는 갈래 이름」은 다르다 —
         후자는 상태가 깨졌다는 뜻이고, 조용히 민무늬로 세면 하프문 잎이 20,000원이 된다.
         `credit` 이 모르는 판매 갈래에 대해 하는 것과 같은 방식이다(어디를 고칠지 말한다). */
      if (typeof g === 'string' && g)
        throw new Error(`[상점] 모르는 무늬 등급입니다: ${g} — ` +
          `data/balance/varie_grades.json 에 없는 이름입니다 ` +
          `(아는 것: ${[..._VARIE.byId.keys()].join(', ')})`);
      /* 배열이 짧거나 빈 칸이면 — 남은 무늬 잎을 먼저 채우고 나머지는 민무늬다 */
      if (unknownVarie > 0) { out.push(legacy); unknownVarie--; } else out.push(plain);
    }
    return out;
  }
  if (!Number.isInteger(variegatedLeaves) || variegatedLeaves < 0)
    throw new Error(`[상점] 무늬 잎 수가 0 이상의 정수가 아닙니다: ${variegatedLeaves}`);
  if (variegatedLeaves > leaves)
    throw new Error(`[상점] 무늬 잎 ${variegatedLeaves}장이 전체 잎 ${leaves}장보다 많습니다`);
  return Array.from({ length: leaves }, (_, i) => (i >= leaves - variegatedLeaves ? legacy : plain));
}

/* ============================================================
   ⑥-2 ★★★ 값 — **잎 등급의 합 × 파는 길 × 시너지** (확정문 §2)
   ------------------------------------------------------------
       잎 값 합 = Σ(그 잎 등급의 leafWon)
       삽수     = 잎 값 합 × 1.0        ← 등급표가 곧 삽수 값이다
       그루     = 잎 값 합 × 1.4        ← 뿌리·수형이 있는 완성체
       시너지   = 서로 다른 **무늬** 등급이 2종이면 ×1.25 · 3종이면 ×1.50

   ★ 앞 공식의 좋은 성질 셋이 **그대로 남는다** (형태가 여전히 「잎별 합」이라서다):
     ① **잎 수에 우상향** — 잎이 늘면 값이 반드시 는다(비율이 안 들어간다)
     ② **떼어 팔기가 이득일 수 없다** — 쪼개면 ㉮ 그루 ×1.4 가 삽수 ×1.0 이 되고
        ㉯ 등급 종수가 갈려 시너지가 내려간다. 합은 같은데 곱만 작아진다
     ③ **잘 키우는 것이 언제나 낫다**
   ⚠ 옛 「소품 하한 12,000원」은 **없어졌다.** 하한의 뜻은 *"작아도 최소 이만큼"* 이었는데
     이제 제일 싼 잎(무지)이 20,000원이라 하한이 원리적으로 안 걸린다. 죽은 규칙을 남기면
     다음 사람이 그것으로 진단한다(§2.6).

     species  'monstera' | 'pothos' — ⏸ 지금 등급표는 몬스테라 것 하나뿐이다.
              포토스는 게임에 없고(`UNIT_WON` 에만 남아 있다) 등급표도 없다.
     form     'cutting'(×1.0 · 기본) | 'pot'(×1.4)
     ⚠ **기본이 'cutting' 인 까닭**: 확정문 §2 가 *"위 표가 곧 삽수 값이다"* 라고 못 박았다.
       그루를 매길 때는 부르는 쪽이 `form: 'pot'` 을 **줘야 한다**(listPot 이 그렇게 부른다).
   반환 { won, leaves, variegatedLeaves, plainLeaves, leafGrades, byGrade, leafSumWon,
          form, formMult, varieKinds, synergy, grade, gradeKo, v, size, multiplier } */
export function priceOf({ species = 'monstera', leaves, variegatedLeaves = 0,
                          leafGrades = null, form = 'cutting' } = {}) {
  if (!UNIT_WON[species])
    throw new Error(`[상점] 모르는 종입니다: ${species} (아는 것: ${Object.keys(UNIT_WON).join(', ')})`);
  if (form !== 'cutting' && form !== 'pot')
    throw new Error(`[상점] 모르는 파는 길입니다: ${form} (아는 것: cutting, pot)`);
  const list = leafGradeListOf({ leaves, variegatedLeaves, leafGrades });
  const byGrade = {};
  let leafSumWon = 0, varie = 0;
  const kinds = new Set();
  for (const gid of list) {
    const g = _VARIE.byId.get(gid);
    if (!g) throw new Error(`[상점] 모르는 무늬 등급입니다: ${gid} ` +
      `(아는 것: ${[..._VARIE.byId.keys()].join(', ')} — data/balance/varie_grades.json)`);
    byGrade[gid] = (byGrade[gid] || 0) + 1;
    leafSumWon += g.leafWon;
    if (g.varie) { varie++; kinds.add(gid); }
  }
  const formMult = form === 'pot' ? _VARIE.sale.potMult : _VARIE.sale.cuttingMult;
  const synergy = _VARIE.sale.synergy[kinds.size] ?? 1;
  const won = Math.round(leafSumWon * formMult * synergy);
  /* 「제일 높은 등급」 하나 — 화면이 한 마디로 말할 때 쓴다(값은 위 합이 정한다) */
  let top = _VARIE.byId.get(_VARIE.plainId);
  for (const gid of kinds) {
    const g = _VARIE.byId.get(gid);
    if (g && g.leafWon > top.leafWon) top = g;
  }
  return {
    won,
    leaves: list.length, variegatedLeaves: varie, plainLeaves: list.length - varie,
    leafGrades: list, byGrade, leafSumWon,
    form, formMult, varieKinds: kinds.size, synergy,
    grade: top.id, gradeKo: top.ko,
    /* ── 옛 이름들. 화면·재현이 읽던 칸이라 남긴다(값의 뜻은 위에 있다) ── */
    v: list.length ? varie / list.length : 0,
    size: list.length >= ADULT_MIN_LEAVES ? 'adult' : 'cutting',
    gradeCapped: false,                    // ⛔ 등급 뚜껑이 없어졌다(§⑥ ⛔ 없앤 것 ②)
    multiplier: list.length ? won / (UNIT_WON[species].adult * list.length) : 0
  };
}

/* 짧은 이름 둘 — 부르는 쪽이 `form` 을 빠뜨려 **그루를 1.4배 싸게 매기는** 실수를 막는다 */
export const potPriceOf = (opt = {}) => priceOf({ ...opt, form: 'pot' });
export const cuttingPriceOf = (opt = {}) => priceOf({ ...opt, form: 'cutting' });

/* ★ 목표액(이사비 등)을 만들려면 무늬 잎이 몇 장이라야 하나 — **역산**.
   ★★ 2026-08-17 — 등급이 종류가 되면서 **답이 하나가 아니다.** 「무늬 잎 3장」이라 해도
     산반 셋과 하프문 셋의 값이 두 배 넘게 다르다. 그래서 등급마다 따로 낸다.
     ⚠ 옛 반환칸(`needVarieLeaves`)은 **어느 등급으로 셌는지를 같이 봐야 뜻이 선다.**
       기본은 `legacyGradeId`(산반 · 제일 흔한 것)라 「최소한 이만큼」이 아니라
       「흔한 무늬로만 채우면 이만큼」이다 — 화면 문구가 그렇게 말해야 한다.
     opt.grade  어느 등급으로 채워 볼 것인가 (기본 legacyGradeId)
     opt.form   'cutting'(기본) | 'pot'
   반환 { leaves, size, form, grade, needVarieLeaves, wonAtNeed, maxWon, byGrade } */
export function varieLeavesNeededFor(targetWon, { species = 'monstera', leaves,
                                                  grade = null, form = 'cutting' } = {}) {
  if (!UNIT_WON[species]) throw new Error(`[상점] 모르는 종입니다: ${species}`);
  if (!Number.isInteger(leaves) || leaves < 1)
    throw new Error(`[상점] 잎 수가 1 이상의 정수가 아닙니다: ${leaves}`);
  const plain = _VARIE.plainId;
  const fill = (gid, n) =>
    Array.from({ length: leaves }, (_, i) => (i >= leaves - n ? gid : plain));
  const one = (gid) => {
    const maxWon = priceOf({ species, leaves, leafGrades: fill(gid, leaves), form }).won;
    for (let n = 0; n <= leaves; n++) {
      const q = priceOf({ species, leaves, leafGrades: fill(gid, n), form });
      if (q.won >= targetWon)
        return { needVarieLeaves: n, wonAtNeed: q.won, maxWon };
    }
    return { needVarieLeaves: null, wonAtNeed: null, maxWon };
  };
  const byGrade = {};
  for (const g of _VARIE.varieGrades) byGrade[g.id] = one(g.id);
  const gid = (grade && _VARIE.byId.has(grade)) ? grade : _VARIE.legacyGradeId;
  const r = byGrade[gid] || one(gid);
  return {
    leaves, form, grade: gid,
    size: leaves >= ADULT_MIN_LEAVES ? 'adult' : 'cutting',
    needVarieLeaves: r.needVarieLeaves, wonAtNeed: r.wonAtNeed, maxWon: r.maxWon,
    byGrade
  };
}

/* ============================================================
   ⑥-3 ★★★ 잎마다 등급을 **기억한다** — `pot.leafGrades` (확정문 §5)
   ------------------------------------------------------------
   확정문 §5 의 첫 줄이 이것이다: *"잎마다 등급을 기억해야 한다. 지금은 `varie: true/false`
   뿐이다. `leafState` · 세이브 · 3D 스킨 고르기가 **같은 값 하나**를 봐야 한다."*

   ══ 왜 **코어**가 들고 있나 (재서 정했다) ═══════════════════════════════════
   먼저 정직하게: 원래 자리는 growth 다. 무늬가 나는 것도, 어느 무늬로 그릴지 고르는 것도
   `plant_grow.html` 이 한다(`VARIE_STATE` · `matFromMid` → `leaf_mat{n}`).
   ⚠ 그런데 **`VARIE_STATE` 는 참·거짓 한 칸**이다. 종류가 안 들어간다.
     그 파일은 이번 창의 쓰기 영역 밖이라 칸을 늘릴 수가 없다.
   ⇒ 그래서 **코어가 잎별 등급 장부를 든다.** 열쇠는 `leafBirth` — growth 가 이미 잎마다
     들고 다니는 이름이고(`growth_adapter.leafState()` 가 그것으로 줄을 맞춘다),
     코어가 새로 짓는 이름이 아니다.
   ⚠ **잎 수를 코어가 세는 것이 아니다.** 목록은 받고, 등급만 적는다(머리말 ② 그대로다).

   ══ ⚠ 아직 안 닿은 곳 — 3D ═════════════════════════════════════════════════
   `skinKeysOfGrade(id)` 로 **어느 스킨이 그 등급인지**는 낼 수 있게 해 뒀다(§⑥-1).
   그런데 `plant_grow.html` 의 무늬 고르기는 **잎마다가 아니라 그루 한 벌**(`P.matAlboPick`)
   이라, 잎별로 강제하려면 그 파일에 손잡이가 하나 있어야 한다.
   ⇒ **못 한 것으로 보고한다.** 지금 값과 화면이 어긋날 수 있고, 안 어긋난 척하지 않는다
     (`docs/handoff/variegrade-to-plan.md §화면이 뭘 불러야 하나`).
============================================================ */

/* 장부를 늘 있는 모양으로. (`earnedByOf`·`marketOf` 와 같은 규약) */
export function potLeafGradesOf(pot) {
  if (!pot) return {};
  if (!pot.leafGrades || typeof pot.leafGrades !== 'object' || Array.isArray(pot.leafGrades))
    pot.leafGrades = {};
  return pot.leafGrades;
}

/* ★★ **드러난 잎 장부** — `pot.leafGradesSeen` (2026-08-16 · §⑥-4b)
   ------------------------------------------------------------
   `{ [leafBirth]: true }` — 「이 잎의 등급을 **화면이 이미 말했다**」는 표시다.
   ⚠⚠ 등급 장부(`leafGrades`)와 **뜻이 다르다.** 저것은 「값이 얼마인가」이고
     이것은 「플레이어가 아는가」다. 두 시점이 갈라졌으므로 칸도 갈라야 한다 —
     한 칸에 둘을 섞으면 「값은 정해졌는데 아직 안 알려 줬다」를 적을 데가 없다.
   ⚠ 안 적으면 저장 한 번에 **이미 본 알림이 다시 뜬다**(`save.js §화분 한 칸` 에 같이 넣었다).
   ⚠ 옛 세이브에는 이 칸이 없다 — 그때는 빈 표가 맞다. 다만 그 판의 이미 성숙한 잎은
     다음 턴에 한 번 알림이 뜬다(없던 표시를 지어내지 않는다). */
export function potLeafGradesSeenOf(pot) {
  if (!pot) return {};
  if (!pot.leafGradesSeen || typeof pot.leafGradesSeen !== 'object' || Array.isArray(pot.leafGradesSeen))
    pot.leafGradesSeen = {};
  return pot.leafGradesSeen;
}

/* ★ 장부 → `priceOf` 가 받는 잎별 등급 배열. 장부가 비었으면 `null`(옛 판 규칙으로 떨어진다).
   ⚠ 아는 것만 채우고 **모르는 칸은 `null` 로 둔다** — `leafGradeListOf` 가 거기서
     「등급을 모르는 무늬 잎」을 산반으로 편다. 모르는 것을 민무늬로 세면 값을 깎게 된다. */
export function potLeafGradeListOf(pot, leaves, variegatedLeaves = 0) {
  const led = pot && pot.leafGrades;
  if (!led || !Number.isInteger(leaves) || leaves < 1) return null;
  const known = Object.keys(led)
    .map(k => ({ lb: Number(k), gid: led[k] }))
    .filter(x => Number.isFinite(x.lb) && _VARIE.byId.get(x.gid) && _VARIE.byId.get(x.gid).varie)
    .sort((a, b) => a.lb - b.lb)
    .map(x => x.gid);
  if (!known.length) return null;
  /* 무늬 잎은 **위쪽(최근)** 에 있다 — propagation §leafVarie 가 같은 규약이다.
     장부가 지금 달린 무늬 잎보다 많으면(잘라 냈다·떨어졌다) 최근 것부터 센다. */
  const take = known.slice(-Math.max(0, Math.min(variegatedLeaves, leaves)));
  const out = new Array(leaves).fill(null);
  for (let i = 0; i < take.length; i++) out[leaves - take.length + i] = take[i];
  return out;
}

/* ★★★ **배선이 오기 전의 다리** — 프롤로그 그루의 등급을 장부 없이도 세운다 (확정문 §4)
   ------------------------------------------------------------
   ⚠⚠ 이 함수가 왜 있는지를 재서 적는다. 없으면 **판이 실제로 망가진다.**

   장부(`pot.leafGrades`)는 `assignPotLeafGrades` 가 채우는데, 그것을 부르는 자리는
   화면(`game.html` 턴 끝)이다. 그 파일은 이번 창의 ⛔ 목록이라 못 건드린다.
   ⇒ 배선이 오기 전까지 장부가 **늘 비어 있고**, 그러면 확정문 §5 의 옛 판 규칙이 걸려
     **무늬 잎이 전부 산반**(제일 싼 무늬)으로 읽힌다.

   ══ 그 값이 얼마나 나쁜가 — 재서 적는다 ═══════════════════════════════════
   반지하 탈출판(잎 11장 중 무늬 3장)의 그루값
     · 장부 없이 전부 산반   8×20,000 + 3×350,000 = 1,210,000 → ×1.4 = **1,694,000원**
     · §4 를 세우면          8×20,000 + 산반+하프문+산반      → ×1.4×1.25 = **2,817,500원**
   이사비가 2,000,000원이라 **앞의 값으로는 아무도 못 나간다.**
   실제로 `test_banjiha_routes` 가 이 다리 없이 A 13% · B 13% · C 28% 로 주저앉았다
   (다리 전 기준선 A 38% · B 60% · C 100%).

   ══ ★ 이것은 「지어내기」가 아니다 ════════════════════════════════════════
   확정문 §4 가 **프롤로그 한 그루의 등급을 못 박았다**(잎1 무지 · 잎2 산반 · 잎3 하프문).
   프롤로그는 잎 2·3 에 무늬를 **보장**하므로(`loop.js §prologueVarie`), 그 그루에서
   **제일 오래된 무늬 잎 둘이 곧 잎2·잎3** 이다. 그래서 잎 번호를 몰라도 정해진다.
   ⚠ 그 밖의 무늬 잎(4번째부터)은 **안 정한다** — 그건 빛이 정할 몫이라 산반으로 떨어진다.
   ⚠ 장부가 한 칸이라도 있으면 **이 다리는 안 탄다.** 배선이 오면 저절로 죽는 코드다.
   ⚠ 프롤로그 그루가 아니면(튜토가 꺼졌거나 둘째 화분이면) 안 탄다.
   반환 잎별 등급 배열 · 안 걸리면 `null` */
export function prologueLeafGradeListOf(S, pot, leaves, variegatedLeaves = 0) {
  const pots = (S && S.pots) || [];
  if (!pot || !pots[0] || pot.id !== pots[0].id) return null;
  if (!(S.tutorial && S.tutorial.enabled)) return null;
  if (!Number.isInteger(leaves) || leaves < 1 || !(variegatedLeaves > 0)) return null;
  const led = pot.leafGrades;
  if (led && typeof led === 'object' && Object.keys(led).length) return null;   // 장부가 이긴다
  /* 잎 번호 순서대로 못박힌 **무늬** 등급만 뽑는다(잎1 무지는 무늬가 아니라 빠진다) */
  const fixed = Object.keys(_VARIE.prologueGrades)
    .map(Number).sort((a, b) => a - b)
    .map(n => _VARIE.prologueGrades[n])
    .filter(gid => { const g = _VARIE.byId.get(gid); return g && g.varie; });
  if (!fixed.length) return null;
  /* 무늬 잎은 위쪽(최근)에 모아 센다 — `leafGradeListOf` 와 같은 규약.
     그중 **제일 아래(오래된) 것부터** 못박힌 등급을 앉힌다. */
  const out = new Array(leaves).fill(null);
  const base = leaves - Math.min(variegatedLeaves, leaves);
  for (let i = 0; i < fixed.length && base + i < leaves; i++) out[base + i] = fixed[i];
  return out;
}

/* ★★ 무늬가 난 잎에 **등급을 정해 적는다.** 하루에 한 번(턴 끝) 부르면 된다.
     opt.pot / opt.potId  (없으면 S.pots[0])
     opt.leafState  `growth_adapter.leafState()` 가 낸 목록  ★필수
     opt.band       그 자리의 몬스테라 밴드 이름  (또는 opt.step 으로 'dark'|'mid'|'bright')
     opt.seed       (기본 S.sim.seed) — 같은 세이브면 같은 답이 나와야 한다
     opt.prologue   프롤로그 못박기를 쓸 것인가 (기본: 튜토가 켜져 있고 첫 화분이면 쓴다)
   ★ **한 번 정하면 안 바뀐다.** 이미 적힌 잎은 건드리지 않는다(growth 의 `varieRoll` 과 같은 사고).
   ⚠ **빛을 못 재면 안 정한다.** 다음 날 다시 묻는다 — 0 으로도 「중간」으로도 안 메꾼다
     (`propagation.resolveVarieLight` 와 같은 규약).
   ⚠ 프롤로그 못박기(확정문 §4)는 **빛과 무관하게** 먼저 걸린다. 그래야 「첫 판은 늘 같은 그림」이 된다.

   ══ ★★ 2026-08-16 — **정하는 것과 드러내는 것을 갈랐다** (§⑥-4b · 박사님 확정) ══════
   박사님: *"성숙 때 확률적으로 분류되는 걸로."*
   ⇒ 등급은 여전히 **잎이 날 때** 정해 장부에 적는다(값 계통이 그 위에 서 있다 — 옮기면
     프롤로그 그루가 196만 → 100.8만이 된다. §⑥-4b 의 ⚠⚠ 를 읽어라).
     드러나는 것만 **잎이 성숙할 때**로 미뤘다. 그래서 반환이 둘로 갈린다:
       `graded`   이번에 **장부에 적힌** 잎 (조용하다 · 값이 여기서 선다)
       `assigned` 이번에 **화면에 드러난** 잎 (성숙했고 아직 안 알린 잎 · 배너는 이것을 쓴다)
   ⚠ `assigned` 의 뜻이 바뀌었다 — 예전에는 「막 적힌 잎」이었다. 부르는 자리(game.html
     `noteLeafGrades`)는 **한 글자도 안 고쳐도** 배너가 성숙 때로 미뤄진다. 그것이 이 모양을
     고른 까닭이다(`game.html` 은 이번 창의 ⛔ 목록이다).
   ⚠ 「이미 알렸다」는 `pot.leafGradesSeen` 에 적는다(§potLeafGradesSeenOf).
     `leafState` 줄에 `matured` 가 없으면(옛 접근자) 아무것도 안 드러난다 — 지어내지 않는다.
   반환 { grades, seen, graded, assigned, revealed, pending, step, events } */
export function assignPotLeafGrades(S, opt = {}) {
  const pots = (S && S.pots) || [];
  const pot = opt.pot || (opt.potId ? pots.find(p => p.id === opt.potId) : pots[0]);
  const rows = Array.isArray(opt.leafState) ? opt.leafState : null;
  const step = opt.step || varieLightStepOfBand(opt.band);
  const grades = potLeafGradesOf(pot);
  const seen = potLeafGradesSeenOf(pot);
  const graded = [], assigned = [], events = [];
  let pending = 0;
  if (!pot || !rows)
    return { grades, seen, graded, assigned, revealed: assigned, pending, step: step || null, events };

  const usePrologue = opt.prologue != null
    ? !!opt.prologue
    : !!(S.tutorial && S.tutorial.enabled && pots[0] && pot.id === pots[0].id);
  const seed = Number.isFinite(opt.seed) ? opt.seed : ((S.sim && S.sim.seed) || 0);
  const sorted = [...rows].filter(r => r && Number.isFinite(r.leafBirth))
                          .sort((a, b) => a.leafBirth - b.leafBirth);

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    if (!r.varie) continue;                       // 무늬가 아닌 잎은 등급이 없다
    const leafNo = i + 1;
    /* ── ㉠ 정하기 (조용하다) ─────────────────────────────────────────── */
    if (!grades[r.leafBirth]) {                   // 이미 정해졌으면 안 바꾼다
      const fixed = usePrologue ? _VARIE.prologueGrades[leafNo] : null;
      let gid = null, why = null;
      if (fixed && _VARIE.byId.get(fixed) && _VARIE.byId.get(fixed).varie) {
        gid = fixed; why = 'prologue';
      } else if (step) {
        gid = varieGradeFromLight(step, marketHash(seed, `LG${pot.id}#${r.leafBirth}`, 21));
        why = 'light';
      }
      if (!gid) { pending++; continue; }          // 못 쟀다 — 내일 다시(모르면 안 정한다)
      grades[r.leafBirth] = gid;
      graded.push({ leafBirth: r.leafBirth, leafNo, grade: gid,
                    gradeKo: _VARIE.byId.get(gid).ko, why });
    }
    /* ── ㉡ 드러내기 (성숙한 잎만 · 한 번만) ──────────────────────────── */
    if (!r.matured) continue;                     // 아직 중간잎이다 — 티 내지 않는다
    if (seen[r.leafBirth]) continue;              // 이미 알렸다
    const gid = grades[r.leafBirth];
    const g = _VARIE.byId.get(gid);
    if (!g) continue;
    seen[r.leafBirth] = true;
    /* ★ 그림 두 벌은 **적어 두지 않고 등급에서 되뽑는다**(§⑥-4).
       중간잎은 통일 갈래에서, 성숙잎만 등급대로 나온다(§⑥-4b). */
    const skins = leafSkinsFor(gid, seed, pot.id, r.leafBirth);
    /* ★ 「왜 그 등급인가」 — 이번에 적힌 잎이면 적힌 그대로, 예전에 적힌 잎이면 **되짚는다.**
       ⚠ 되짚기는 짐작이라 못 박지 않는다(장부에 사유 칸이 없다). 화면 문구에만 쓴다. */
    const justNow = graded.find(x => x.leafBirth === r.leafBirth);
    const fixedNow = usePrologue ? _VARIE.prologueGrades[leafNo] : null;
    const why = justNow ? justNow.why
      : (fixedNow && _VARIE.byId.get(fixedNow) && _VARIE.byId.get(fixedNow).varie) ? 'prologue' : 'light';
    assigned.push({ leafBirth: r.leafBirth, leafNo, grade: gid, gradeKo: g.ko, why, matured: true,
                    midSkin: skins && skins.midSkin, matSkin: skins && skins.matSkin });
    events.push({ id: 'leaf_grade', leafBirth: r.leafBirth, leafNo, grade: gid,
                  midSkin: skins && skins.midSkin, matSkin: skins && skins.matSkin,
                  ko: `${leafNo}번째 잎이 다 자랐습니다 — 무늬는 **${g.ko}**, 잎 한 장 ` +
                      `${g.leafWon.toLocaleString()}원` +
                      /* ⚠ 자리 이야기는 **빛을 실제로 잰 턴에만** 붙인다. `step` 이 없는데
                         「어두운 자리」라 적으면 그것이 곧 재는 자의 거짓말이다. */
                      (why === 'light' && step
                        ? ` (${step === 'bright' ? '밝은' : step === 'mid' ? '중간' : '어두운'} 자리)` : '') });
  }
  return { grades, seen, graded, assigned, revealed: assigned, pending, step: step || null, events };
}

/* ============================================================
   ⑥-4 ★★★ 잎 하나의 **그림 두 벌을 같이 뽑는다** — `leafSkinsFor` (2026-08-16)
   ------------------------------------------------------------
   박사님: *"중간잎 말고 성숙잎 가는 것도 그럼 확정으로 해야겠네. 둘 다."*

   ══ ⚠⚠ 왜 **안 적고 되뽑나** — 재서 정했다 ═══════════════════════════════
   확정문 §5 의 제일 굵은 줄이 *"두 벌이 되면 반드시 어긋난다"* 다.
   그림을 장부에 따로 적으면 등급 장부와 **두 벌**이 되고, 언젠가 갈린다.
   ★ 그리고 적어도 **안 남는다**: `save.js §화분 한 칸` 은 화분에서 적을 칸을 **이름으로 골라
     적는다**(흰 목록). `pot.leafSkins` 같은 새 칸은 저장 한 번에 **조용히 사라진다.**
     즉 「적는 길」은 save.js 를 같이 고쳐야 성립하는데, 그 파일은 이번 창의 것이 아니다.
   ⇒ 그림은 **등급 + 시드 + 화분 + `leafBirth` 의 순수 함수**로 둔다.
     · 두 벌이 안 생긴다 — 갈릴 것이 없다
     · 저장·불러오기를 건너도 **같은 답**이 나온다(같은 세이브면 같은 그림)
     · **옛 세이브**에도 저절로 선다 — 등급만 있으면 그림이 따라 나온다(아래 ⚠)
   ⚠ 굴림은 `assignPotLeafGrades` 가 쓰는 **`marketHash` 그대로**다. 소금만 다르다
     (21=등급 · 23=중간잎 · 29=성숙잎). 소금이 달라야 등급과 그림이 같이 움직이지 않는다.

   ⚠ **표를 고치면 그림이 바뀐다.** 등급은 그대로고 그림만 바뀐다 — 표가 정본이라 그게 맞다.
     한 판 안에서는 표가 안 바뀌므로 「한 번 정해지면 안 바뀐다」가 성립한다.

   ⚠ 갈래마다 판이 셋씩이라 **키를 고르게 뽑는 것 = 갈래를 고르게 뽑는 것**이다.
     ★ 갈래마다 판 수가 달라지면 이 말이 거짓이 된다 — `test_variegrade` 검사 G-mid 가
       「모든 갈래가 세 판」을 못 박아 그 순간 깨지게 해 뒀다.
============================================================ */
export const LEAF_SKIN_SALT = Object.freeze({ grade: 21, mid: 23, mat: 29 });

/* 등급 하나 → 그 잎이 쓸 그림 두 벌. 무늬가 아닌 등급이거나 모르는 등급이면 `null`. */
export function leafSkinsFor(gradeId, seed, potId, leafBirth) {
  const g = _VARIE.byId.get(gradeId);
  if (!g || !g.varie) return null;
  /* ★ 2026-08-16 — 중간잎은 **통일 갈래**에서 뽑는다(§⑥-4b). 성숙잎만 등급대로 갈린다. */
  const mids = midSkinPoolOf(gradeId);
  const mats = skinKeysOfGrade(gradeId);
  const pick = (arr, salt) => {
    if (!arr.length) return null;
    const r = marketHash(seed, `LS${potId}#${leafBirth}`, salt);
    return arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];
  };
  return {
    grade: g.id, gradeKo: g.ko,
    midSkin: pick(mids, LEAF_SKIN_SALT.mid),     // 'leaf_mid_albo29' — 없으면 null
    matSkin: pick(mats, LEAF_SKIN_SALT.mat)      // 'leaf_mat34'      — 없으면 null
  };
}

/* ★ 화분 하나의 **잎별 그림표**. 화면(3D)이 물어보는 자리다.
     `{ [leafBirth]: { grade, gradeKo, midSkin, matSkin, fromLegacy } }`
   ⚠ 등급 장부에 없는 잎은 **아예 안 들어간다**(모르는 것을 지어내지 않는다).
   ⚠ `opt.varieLeafBirths` 를 주면 **등급이 없는 무늬 잎**도 채운다 — 옛 세이브가 그 꼴이다.
     확정문 §5 대로 `legacyGradeId`(산반)로 떨어뜨리고 **`fromLegacy: true` 로 표시한다.**
     ★ 조용히 하지 않는다. 부르는 쪽이 그 표시를 보고 기록에 남길 수 있다. */
export function potLeafSkinsOf(S, pot, opt = {}) {
  const out = {};
  if (!pot) return out;
  const seed = Number.isFinite(opt.seed) ? opt.seed : ((S && S.sim && S.sim.seed) || 0);
  const led = potLeafGradesOf(pot);
  for (const [k, gid] of Object.entries(led)) {
    const lb = Number(k);
    if (!Number.isFinite(lb)) continue;
    const s = leafSkinsFor(gid, seed, pot.id, lb);
    if (s) out[k] = { ...s, fromLegacy: false };
  }
  const extra = Array.isArray(opt.varieLeafBirths) ? opt.varieLeafBirths : [];
  for (const lb of extra) {
    if (!Number.isFinite(lb) || out[String(lb)]) continue;
    const s = leafSkinsFor(_VARIE.legacyGradeId, seed, pot.id, lb);
    if (s) out[String(lb)] = { ...s, fromLegacy: true };
  }
  return out;
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

/* ══════════════════════════════════════════════════════════════════════════
   ★★★ 그루 값을 **묻기만** 한다 — 올리지 않는다 (2026-08-16 · 박사님)
   ──────────────────────────────────────────────────────────────────────────
   박사님: *"그루째로 팔 때 웃돈 주고 파는 당근이 75만원이야… 저러면 안 되잖아."*

   ★ 재 보니 **화면과 코어가 서로 다른 값을 세고 있었다.**
     화면 단추(`game.html §drawShop`)는 `priceOf({leaves, variegatedLeaves})` 를 불렀다 —
       ① `form` 을 안 줘서 **삽수 값(×1.0)** 으로 매겨졌다(그루는 ×1.4)
       ② `leafGrades` 를 안 줘서 무늬 잎이 **전부 산반**으로 떨어졌다(하프문 75만이 사라진다)
     그런데 실제로 올리는 `listPot` 은 `potPriceOf` + 장부 등급을 쓴다. 잰 값:
       화면 단추 **720,000원**  ·  진짜 값 **1,960,000원**  (2.7배)
     ⇒ 사람은 「그루째 파는 게 삽수 한 대와 비슷하네」로 읽는다. 실제로는 세 배다.

   ★★ **왜 함수를 새로 파나.** 등급을 얻는 길이 셋(넘겨받은 것 → 장부 → 프롤로그 다리)인데,
     그 순서를 화면이 따로 적으면 **또 갈린다.** 갈린 것을 고치면서 갈릴 자리를 남기지 않는다.
     ⇒ 값을 정하는 곳은 **여기 하나**다. `listPot` 도 이것을 부른다.
   ⚠ 아무것도 안 바꾼다(순수). 문(`marketGate`)도 안 본다 — 문은 올릴 때 보는 것이지
     값을 묻는 데 필요한 것이 아니다. 「얼마짜리인가」는 못 팔 때도 답이 있다.
   반환 priceOf 의 반환에 `gradesFrom` 한 칸을 더한 것 */
export function quotePot(S, opt = {}) {
  const pots = S.pots || [];
  const p = opt.potId ? pots.find(x => x.id === opt.potId) : pots[0];
  if (!p) throw new Error('[중고] 값을 매길 그루가 없습니다 — 화분이 비어 있습니다');
  if (!Number.isInteger(opt.leaves))
    throw new Error('[중고] 잎 수(opt.leaves)를 주세요 — 잎 수는 growth 소유라 코어가 지어내지 않습니다');
  const varieN = opt.variegatedLeaves || 0;
  const fromOpt = Array.isArray(opt.leafGrades) ? opt.leafGrades : null;
  const fromLedger = fromOpt ? null : potLeafGradeListOf(p, opt.leaves, varieN);
  const fromPrologue = (fromOpt || fromLedger) ? null
                     : prologueLeafGradeListOf(S, p, opt.leaves, varieN);
  const q = potPriceOf({ species: opt.species || 'monstera',
                         leaves: opt.leaves, variegatedLeaves: varieN,
                         leafGrades: fromOpt || fromLedger || fromPrologue });
  q.gradesFrom = fromOpt ? 'opt' : fromLedger ? 'ledger' : fromPrologue ? 'prologue' : 'legacy';
  q.potId = p.id;
  return q;
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
  /* ★★ 값은 **`quotePot` 하나가 정한다**(2026-08-16). 여기서 다시 세지 않는다 —
     화면이 따로 세다가 720,000 vs 1,960,000 으로 갈렸던 자리다(§quotePot).
     그루는 `form:'pot'`(×1.4)이고, 잎별 등급은 넘겨받은 것 → 코어 장부 → 프롤로그 다리 순으로 얻는다. */
  const q = quotePot(S, { ...opt, potId: p.id });
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
  /* ★ 잎별 등급은 삽수가 **자기가 들고 있다**(`c.leafGrade` · propagation §삽수가 자란다).
     옛 세이브에는 그 칸이 없다 — 그때는 `leafGradeListOf` 가 무늬 잎을 산반으로 편다(확정문 §5). */
  const q = cuttingPriceOf({ species: opt.species || 'monstera', leaves,
                             variegatedLeaves: varieLeaves,
                             leafGrades: Array.isArray(c.leafGrade) ? c.leafGrade : null });
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
