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
  bean_seed: Object.freeze({
    id: 'bean_seed', ko: '콩 씨앗 (1시루분)', kind: 'seed',
    listWon: 1_500, leadDays: 1,
    note: 'docs/food_economy.md §3 — "씨앗(콩) 1시루분 1,500원"'
  }),
  monstera_seed: Object.freeze({
    id: 'monstera_seed', ko: '몬스테라 씨앗 (1립)', kind: 'seed',
    listWon: 1_500, leadDays: 1,
    note: 'docs/sale_economy.md §3 가격표 — "몬스테라 씨앗 1립 1,500 · 콩 1시루와 같은 값"'
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

/* 재고를 쓴다. 없으면 던진다 — 조용히 0으로 굴리면 "공짜로 무한히 나오는" 경제가 된다. */
export function useStock(S, itemId, qty = 1) {
  const shop = shopOf(S);
  const have = shop.stock[itemId] || 0;
  if (have < qty) {
    const it = CATALOG[itemId];
    const inbound = incomingOf(S, itemId);
    const e = new Error(`[상점] ${it ? it.ko : itemId}이(가) ${qty}개 필요한데 ${have}개뿐입니다 — ` +
      (inbound ? `${inbound}개가 배송 중입니다(기다리거나 더 주문하세요)` : '먼저 주문해 주세요'));
    e.tutorialInput = true;
    throw e;
  }
  shop.stock[itemId] = have - qty;
  return shop.stock[itemId];
}

/* ============================================================
   ⑥ ★★ 값 — `docs/propagation.md` §6 의 공식 하나
   ------------------------------------------------------------
       값 = 단위기본가 × 크기 × (1 + K·v²)        K = 60
         v = 그 그루의 **무늬 잎 비율** (0~1)
         크기 = 잎(마디) 수
       잎 1~2장 → 삽수 가격표 · 잎 3장~ → 성체 가격표 (같은 문서 §6)

   ★ v 를 **잎 비율로 읽는다.** 그게 propagation.md §6 의 문장 그대로다 —
     "v 는 소질 등급이 아니라 그 그루에 실제로 난 무늬 잎의 비율이다. 플레이어는 잎을 세어서
      값을 읽는다." 코어가 안 보이는 값을 지어내지 않는다는 원칙과도 맞는다.

   ⚠ **정본 안에서 어긋나는 곳이 하나 있다** — 같은 문서의 검산표는 「몬스테라 삽수(알보)
     80,000」을 `12,000 × 6.667`(v = 0.307)로 맞춘다. 그런데 잎 1장짜리 삽수의 그 한 장이
     무늬면 잎 비율로는 v = 1.0 이고 값이 732,000원이 된다. 즉 검산표의 v 는 **라벨(무늬 짙기)**
     이고 §6 본문의 v 는 **잎 비율**이라, 둘이 같은 기호를 다르게 쓰고 있다.
     여기서는 **본문의 정의(잎 비율)** 를 따르고, 그 사실을 `docs/shop.md` §3 에 적어 두었다.
     이 선택이 곧 "잭팟이 성립하느냐"를 가르므로 plan 판단이 필요하다(보고 ⑥).
============================================================ */
export const PRICE_K = 60;
export const UNIT_WON = Object.freeze({
  monstera: Object.freeze({ cutting: 12_000, adult: 10_000 }),   // propagation.md §6 표
  pothos:   Object.freeze({ cutting:  3_000, adult:  3_750 })
});
/* 잎 몇 장부터 성체 가격표인가 — propagation.md §6: "잎 1~2장이면 삽수, 3장부터 성체". */
export const ADULT_MIN_LEAVES = 3;

/* 무늬 잎 비율. 잎이 없으면 값을 매길 수 없다(0으로 굴리지 않는다). */
export function varieRatio(leaves, variegatedLeaves) {
  if (!Number.isInteger(leaves) || leaves < 1)
    throw new Error(`[상점] 잎 수가 1 이상의 정수가 아닙니다: ${leaves} — 값은 잎으로 매깁니다`);
  if (!Number.isInteger(variegatedLeaves) || variegatedLeaves < 0)
    throw new Error(`[상점] 무늬 잎 수가 0 이상의 정수가 아닙니다: ${variegatedLeaves}`);
  if (variegatedLeaves > leaves)
    throw new Error(`[상점] 무늬 잎 ${variegatedLeaves}장이 전체 잎 ${leaves}장보다 많습니다`);
  return variegatedLeaves / leaves;
}

/* 값을 매긴다. 순수 함수라 화면이 "지금 팔면 얼마"를 미리 보여줄 수 있다.
     species 'monstera' | 'pothos'
   반환 { won, v, leaves, variegatedLeaves, grade, unitWon, multiplier } */
export function priceOf({ species = 'monstera', leaves, variegatedLeaves = 0 } = {}) {
  const unit = UNIT_WON[species];
  if (!unit) throw new Error(`[상점] 모르는 종입니다: ${species} (아는 것: ${Object.keys(UNIT_WON).join(', ')})`);
  const v = varieRatio(leaves, variegatedLeaves);
  const grade = leaves >= ADULT_MIN_LEAVES ? 'adult' : 'cutting';
  const unitWon = unit[grade];
  const multiplier = 1 + PRICE_K * v * v;
  return {
    won: Math.round(unitWon * leaves * multiplier),
    v, leaves, variegatedLeaves, grade, unitWon, multiplier
  };
}

/* ★ 150만원(원룸 이사 자금)을 만들려면 무늬 잎이 몇 장이라야 하나 — **역산**.
   `docs/shop.md` §1 의 표를 내는 함수다. 화면이 "이 그루를 몇 장 더 무늬로 만들면 되나"를
   말할 수 있게 코어가 셈을 갖는다(문서와 코드가 갈리지 않게).
   반환 { leaves, needV, needVarieLeaves, wonAtNeed } · 불가능하면 needVarieLeaves = null */
export function varieLeavesNeededFor(targetWon, { species = 'monstera', leaves } = {}) {
  const unit = UNIT_WON[species];
  if (!unit) throw new Error(`[상점] 모르는 종입니다: ${species}`);
  if (!Number.isInteger(leaves) || leaves < 1)
    throw new Error(`[상점] 잎 수가 1 이상의 정수가 아닙니다: ${leaves}`);
  const grade = leaves >= ADULT_MIN_LEAVES ? 'adult' : 'cutting';
  const base = unit[grade] * leaves;
  const need = (targetWon / base - 1) / PRICE_K;          // = v²
  const needV = need <= 0 ? 0 : Math.sqrt(need);
  if (needV > 1) return { leaves, grade, needV, needVarieLeaves: null, wonAtNeed: null,
                          maxWon: Math.round(base * (1 + PRICE_K)) };
  const n = Math.ceil(needV * leaves);
  return { leaves, grade, needV, needVarieLeaves: n,
           wonAtNeed: priceOf({ species, leaves, variegatedLeaves: n }).won,
           maxWon: Math.round(base * (1 + PRICE_K)) };
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
  const q = priceOf({ species: opt.species || 'monstera',
                      leaves: c.source.leaves,
                      variegatedLeaves: c.source.variegatedLeaves });
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
