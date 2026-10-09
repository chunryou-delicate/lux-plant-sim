/* ============================================================
   tools/test_furnishop.mjs — 가구를 사고 파는 길 (2026-08-17)
   ------------------------------------------------------------
   ⚠ **이 파일 하나로 이번 판정을 다 한다.** 박사님: *"쓰잘데기없는 하네스나 검수는
     없애버려"* — 중간 진단용으로 쓴 것들은 저장소 밖에서 돌리고 버렸다.

   ★ 브라우저가 필요 없다. `vendor/three/three.min.js` 를 node 에서 그대로 불러
     **가구 빌더를 실제로 돌린다** — 그것이 §A 의 요점이다.

     A 크기   141개를 빌더로 다시 지어 `size_m` 과 **한 톨이라도 다르면 깨진다**
              ⇒ 「값 매기기가 쓴 크기」와 「빌더가 내는 크기」가 두 벌이 될 수 없다
     B 거르기 가구 87 · 안 내는 가구 18 · 걸러 낸 것 36. 걸러 낸 것이 정말 가구가 아닌가
     C 값     규칙대로 나오나 · 제일 싼 것~제일 비싼 것 · 되사는 값
     D 문     등 해금 **전에는 목록에 없고** 주문도 막힌다 · 해금 뒤에는 있다
     E 사기   재고가 늘고 돈이 그만큼 나간다
     F 팔기   못 파는 네 경우가 전부 막히고 **까닭을 말한다**
     G 세이브 판 것·놓은 것이 왕복한다 · **옛 세이브가 그대로 열린다**
============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); }
};
const won = (n) => Number(n).toLocaleString() + '원';

/* ── 불러오기 ───────────────────────────────────────────────── */
const shop = await import(pathToFileURL(path.join(ROOT, 'src/game/shop.js')).href);
const state = await import(pathToFileURL(path.join(ROOT, 'src/game/state.js')).href);
const save = await import(pathToFileURL(path.join(ROOT, 'src/game/save.js')).href);
const tutorial = await import(pathToFileURL(path.join(ROOT, 'src/game/tutorial.js')).href);
const PRESETS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/furniture_presets.json'), 'utf8'));
const LIGHTING = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/lighting_presets.json'), 'utf8'));
const HOUSE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/house_rooms.json'), 'utf8'));

/* ════════════════════════════════════════════════════════════
   A. 크기 — **빌더가 정본이다.** `size_m` 이 그 값과 같아야 한다
   ⚠ 이 절이 이 파일의 존재 이유다. 값을 매기는 shop.js 는 THREE 를 못 쓰므로
     크기를 데이터에서 읽는다 — 두 벌이 되는 순간 값이 조용히 틀린다.
════════════════════════════════════════════════════════════ */
console.log('\nA. 크기 — 빌더가 내는 값과 size_m 이 같은가');
{
  globalThis.THREE = require(path.join(ROOT, 'vendor/three/three.min.js'));
  const { buildFurniture } =
    await import(pathToFileURL(path.join(ROOT, 'src/render3d/furniture_pastel.js')).href);

  const bad = [], missing = [];
  const r4 = (v) => +(+v).toFixed(4);
  for (const [id, p] of Object.entries(PRESETS.presets)) {
    if (!p.size_m) { missing.push(id); continue; }
    const s = buildFurniture(p.type || id, p).userData.size;
    if (!s) { missing.push(id); continue; }
    if (r4(s.w) !== p.size_m.w || r4(s.d) !== p.size_m.d || r4(s.h) !== p.size_m.h)
      bad.push(`${id}: 빌더 ${r4(s.w)}×${r4(s.d)}×${r4(s.h)} ≠ size_m ${p.size_m.w}×${p.size_m.d}×${p.size_m.h}`);
  }
  ok(`size_m 이 없는 프리셋 0개`, missing.length === 0, missing.join(', '));
  ok(`141개 전부 빌더와 같다`, bad.length === 0, bad.slice(0, 8).join(' | '));
  ok(`프리셋이 141개다`, Object.keys(PRESETS.presets).length === 141,
     String(Object.keys(PRESETS.presets).length));

  /* ⚠ `w`·`d`·`h` 를 그대로 믿으면 안 된다는 증거를 검사로 남긴다 —
     이 셋이 갈리는 프리셋이 실제로 있고, 그래서 size_m 이 따로 있다. */
  const drift = Object.entries(PRESETS.presets).filter(([id, p]) =>
    ['w', 'd', 'h'].some(k => p[k] != null && Math.abs(p[k] - p.size_m[k]) > 1e-9));
  ok(`w·d·h 와 size_m 이 다른 프리셋이 있다 (그래서 size_m 이 필요하다)`, drift.length > 0,
     `지금 ${drift.map(([id]) => id).join(', ')}`);
  /* ⚠⚠ **여기 숫자를 박지 마라.** 2026-08-17 에 딴 창이 발자국(`w`·`d`)을 정수 칸에 물리면서
     117개 전부에 `w`·`d` 를 채웠고, 그 순간 「셋 다 없는 것 28개」라고 박아 둔 줄이 빨개졌다.
     ⇒ 세는 것은 **`h`** 다 — 키는 대개 빌더가 계산해서 내므로(의자 `sh+0.45`) 앞으로도
       프리셋에 안 적힌다. 몇 개인지는 **찍기만** 하고 「0보다 크다」만 못 박는다. */
  const noH = Object.entries(PRESETS.presets).filter(([, p]) => p.h == null);
  ok(`키(h)가 프리셋에 없는 것이 ${noH.length}개 — 부피로 값을 매기려면 size_m 이라야 한다`,
     noH.length > 0);
}

/* ════════════════════════════════════════════════════════════
   B. 거르기 — 무엇을 팔고 무엇을 안 파나
════════════════════════════════════════════════════════════ */
console.log('\nB. 거르기 — 가구가 아닌 것이 안 들어왔나');
{
  const all = shop.furnitureAllList();
  const by = {};
  for (const r of all) (by[r.shopKind] ||= []).push(r.preset);
  console.log('   갈래별: ' + Object.entries(by).map(([k, v]) => `${k} ${v.length}`).join(' · '));

  /* ★ 2026-10-04 — 「가구」는 **가구점에 뜨는 가구**다. 팔리지만 가구점에 안 내는 것(shop_listed:false · 박사님 쓰레기봉투)은 따로 센다 */
  const listedN = all.filter(r => r.shopKind === 'furniture' && r.listed).length;
  const unlistedN = all.filter(r => r.shopKind === 'furniture' && !r.listed).length;
  /* 2026-10-04 박사님 결정 — 반지하 소품 넷이 진짜 가구가 됐다: 117 → 120(난방기·쓰레기봉투·배낭 · 건조대는 원래 있었다) ·
     가구점 81 → 83(난방기·배낭) · 쓰레기봉투는 «팔리는데 0원»이라 가구점에 안 낸다(안 내는 가구 1)
     2026-10-09 총괄 D44 — 브라운관 TV(tv_crt · v2 monitor.glb)가 새 가구로: 120 → 121 · 가구점 83 → 84 (값은 크기 규칙 그대로)
     2026-10-10 [house] 가게 진열대(shop_display · plan D59 · 투룸 가게 방에 처음부터) — 가구점에 안 낸다: 121 → 122 · 안 내는 가구 1 → 2 · 가구점 84 그대로 
     2026-10-10 [house] 새 러그 셋(체크 · 잎무늬 · 러너 · 총괄 «B 넣습니다» · 값은 크기 규칙): 122 → 125 · 가구점 84 → 87 
     2026-10-10 [house] 벽 걸이 v1 열다섯(포스터·액자·엽서·달력 · mount wall-hang · 총괄) + 가게 주문판(안 냄): 125 → 141 · 가구점 87 그대로(벽 걸이는 core 가 걸이 자리 고르기를 붙일 때까지 안 냄 → 그때 102) · 안 내는 가구 2 → 18 */
  ok('가구 87 · 안 내는 가구 18 · 전체 141', listedN === 87 && unlistedN === 18 && all.length === 141,
     `가구 ${listedN} · 안 내는 가구 ${unlistedN} / 전체 ${all.length}`);

  /* ★ 조명은 **`lighting_presets.fixtures` 로 되짚어 확인한다** — 규칙이 코드에 있으므로
     그 규칙이 실제 조명 표를 다 덮는지는 데이터로 재야 한다. 새 등이 표에 들어왔는데
     규칙이 못 잡으면 여기서 빨개진다. */
  const leak = Object.keys(LIGHTING.fixtures || {})
    .filter(id => PRESETS.presets[id])
    .filter(id => shop.furnitureKindOf(id, PRESETS.presets[id]).kind !== 'lighting');
  ok('조명 표(lighting_presets.fixtures)에 있는 것은 전부 「조명」으로 걸린다', leak.length === 0,
     leak.join(', '));

  /* 걸러 낸 것에 「식물등」·「창턱」·「액자」가 실제로 들어 있나 — 이름 한 벌만 짚는다 */
  const kindOf = (id) => all.find(r => r.preset === id).shopKind;
  ok('식물등 셋이 안 팔린다', ['growlight_clip', 'growlight_bar', 'growlight_stand']
     .every(id => kindOf(id) === 'lighting'));
  ok('창턱 받침·벽걸이 선반·액자·벽시계·칠판이 안 팔린다',
     ['shelf_sill_pot1', 'shelf_sill_pot4', 'shelf_wall_1tier', 'picture_frame', 'wall_clock',
      'blackboard', 'bulletin_board'].every(id => kindOf(id) === 'fixture'));
  ok('냉장고·TV·주방 카운터가 안 팔린다',
     ['fridge', 'tv', 'kitchen'].every(id => kindOf(id) === 'appliance'));
  /* ★ 바닥에 서는 선반은 **안 걸러진다** — 「mount 가 있으면 뺀다」로 하면 이 둘을 잃는다 */
  ok('코너 선반·사다리 선반은 가구다 (mount 가 있어도 바닥에 선다)',
     ['shelf_corner_3tier', 'shelf_ladder_4tier'].every(id => kindOf(id) === 'furniture'));
  ok('걸러 낸 것에는 값이 없다 (지어내지 않는다)',
     all.filter(r => r.shopKind !== 'furniture').every(r => r.listWon === null));
}

/* ════════════════════════════════════════════════════════════
   C. 값 — 규칙대로 나오나 · 「비싸게」가 얼마인가
════════════════════════════════════════════════════════════ */
console.log('\nC. 값');
{
  const R = shop.FURNITURE_RULES;
  const open = { tutorial: { enabled: true, lamp: { unlocked: true } } };
  const list = shop.furnitureCatalogList(open);
  ok('열리면 87줄', list.length === 87, String(list.length));
  /* 2026-10-09 [plan] 한 줄 소개(intro_ko) — 칸이 있는 가구만 실린다 */
  { const crt = list.find(r => r.preset === 'tv_crt');
    ok('브라운관 TV 한 줄 소개가 목록에 실린다 · 칸 없는 가구는 null', !!crt && crt.intro === '안 켜지는 옛 TV — 화면에 작은 집 하나'
       && list.every(r => r.intro === (typeof PRESETS.presets[r.preset].intro_ko === 'string' ? PRESETS.presets[r.preset].intro_ko : null)), crt ? String(crt.intro) : '없음'); }   // 10-10 벽 걸이 열다섯도 소개가 있다 — «프리셋 칸 그대로»로 넓힘

  /* 규칙 그대로인가 — 한 줄도 예외가 없어야 한다 */
  const off = list.filter(it => {
    const vol = it.sizeM.w * it.sizeM.d * it.sizeM.h;
    return it.listWon !== Math.ceil((R.baseWon + R.volWonPerM3 * vol) / 100) * 100
        || it.buyWon !== Math.ceil(it.listWon * 1.4 / 100) * 100
        || it.resaleWon !== Math.floor(it.listWon * R.resaleRate / 100) * 100;
  });
  ok('83줄이 전부 규칙(밑값 + ㎥단가 → ×1.4 → 되사기 30%)대로다', off.length === 0,
     off.slice(0, 3).map(x => x.id).join(', '));

  const lo = list[0], hi = list[list.length - 1];
  console.log(`   제일 싼 것  ${lo.ko} — 정가 ${won(lo.listWon)} · 실구매 ${won(lo.buyWon)} · 되사는 값 ${won(lo.resaleWon)}`);
  console.log(`   제일 비싼 것 ${hi.ko} — 정가 ${won(hi.listWon)} · 실구매 ${won(hi.buyWon)} · 되사는 값 ${won(hi.resaleWon)}`);

  /* ★ 「비싸게」를 **이 게임의 돈으로** 못 박는다. 이 셋이 값의 뜻이다. */
  const LAMP = 25_000, RENT = 200_000, START = 1_500_000;
  ok(`제일 싼 가구(${won(lo.buyWon)})도 식물등(${won(LAMP)})보다 비싸다`, lo.buyWon > LAMP);
  const bed = list.find(x => x.preset === 'bed_single');
  ok(`싱글 침대 ${won(bed.buyWon)} = 월세 ${(bed.buyWon / RENT).toFixed(2)}달치 (두 달 언저리)`,
     bed.buyWon / RENT > 1.8 && bed.buyWon / RENT < 2.3);
  ok(`제일 비싼 가구도 시작돈(${won(START)})의 절반을 안 넘는다 — ${(hi.buyWon / START * 100).toFixed(0)}%`,
     hi.buyWon < START / 2);

  /* ★★ **탈출이 안 깨지는가** — 이 검사가 되사기 30% 의 근거다 */
  const MOVE_WON = 2_000_000;
  let sum = 0;
  for (const f of HOUSE.rooms.banjiha.furniture) {
    const q = shop.furnitureQuoteOf(f.preset,
      { sizeM: (f.w != null || f.d != null || f.h != null)
          ? { ...PRESETS.presets[f.preset].size_m, ...(f.w != null ? { w: f.w } : {}),
              ...(f.d != null ? { d: f.d } : {}), ...(f.h != null ? { h: f.h } : {}) }
          : undefined });
    if (q.ok) sum += q.resaleWon;
  }
  console.log(`   반지하 가구를 통째로 팔면 ${won(sum)} — 월세의 ${(sum / RENT * 100).toFixed(0)}% · 이사비의 ${(sum / MOVE_WON * 100).toFixed(1)}%`);
  ok('반지하 가구를 다 팔아도 이사비의 15% 를 못 넘는다 (하프문이 탈출의 축으로 남는다)',
     sum < MOVE_WON * 0.15, won(sum));
  ok('그래도 월세 한 달치 언저리는 된다 (「팔면 한 달 버틴다」)',
     sum > RENT * 0.7, won(sum));
}

/* ════════════════════════════════════════════════════════════
   D. 문 — 등 해금 전에는 없다
════════════════════════════════════════════════════════════ */
console.log('\nD. 문 — 등 기구 해금될 때 열린다');
{
  const S = { day: 1, tutorial: { enabled: true, cashWon: 1_000_000, lamp: { unlocked: false } },
              shop: shop.createShopState() };
  ok('해금 전 목록이 비어 있다', shop.furnitureCatalogList(S).length === 0);
  ok('해금 전 문이 닫혀 있고 까닭을 말한다',
     !shop.furnitureShopOpen(S).open && /가을/.test(shop.furnitureShopOpen(S).reason || ''));
  let threw = null;
  try { shop.orderItem(S, 'furn_desk', 1); } catch (e) { threw = e; }
  ok('해금 전에는 목록에 없는 것을 직접 주문해도 막힌다', !!threw && threw.tutorialInput === true,
     threw ? threw.message : '안 막혔다');
  ok('막혀도 돈이 안 나갔다', S.tutorial.cashWon === 1_000_000);

  S.tutorial.lamp.unlocked = true;
  ok('해금 뒤 목록에 87줄이 뜬다', shop.furnitureCatalogList(S).length === 87);
}

/* ════════════════════════════════════════════════════════════
   E. 사기 — 재고가 늘고 돈이 그만큼 나간다
════════════════════════════════════════════════════════════ */
console.log('\nE. 사기');
{
  const S = { day: 3, tutorial: { enabled: true, cashWon: 1_000_000, lamp: { unlocked: true } },
              shop: shop.createShopState() };
  const before = S.tutorial.cashWon;
  const price = shop.buyPriceOf('furn_nightstand');
  const o = shop.orderItem(S, 'furn_nightstand', 2);
  ok(`협탁 2개 주문 — ${won(price * 2)} 나갔다`, before - S.tutorial.cashWon === price * 2,
     `${before - S.tutorial.cashWon}`);
  ok('아직 재고가 0 이다 (배송 중)', shop.stockOf(S, 'furn_nightstand') === 0);
  S.day = o.arrivesOnDay;
  const r = shop.stepShop(S);
  ok('도착하면 재고가 2 가 된다', shop.stockOf(S, 'furn_nightstand') === 2);
  ok('도착이 사건으로 나오고 한글 이름을 말한다',
     r.events.length === 1 && /협탁/.test(r.events[0].ko), JSON.stringify(r.events[0] || {}));

  /* 판 돈 통 — 새 갈래가 실제로 열렸나 */
  ok('판매 갈래에 furniture 가 있다', shop.SALE_KINDS.includes('furniture'));
}

/* ════════════════════════════════════════════════════════════
   F. 팔기 — 못 파는 네 경우가 전부 막히고 까닭을 말한다
════════════════════════════════════════════════════════════ */
console.log('\nF. 팔기');
{
  const mk = () => ({
    day: 50, schema: 'game_state/1',
    tutorial: { enabled: true, cashWon: 100_000, lamp: { unlocked: true } },
    shop: shop.createShopState(),
    home: { room: 'banjiha', furniture: {} },
    lamps: { count: 0, litHours: 12, aim: {} },
    pots: [], emptyPots: [], cuttings: []
  });

  /* ① 가구가 아니다 */
  {
    const S = mk();
    const q = state.furnitureSellQuote(S, 'banjiha-sill', { preset: 'shelf_sill_pot1', riders: [] });
    ok('① 창턱 받침은 못 판다 — 「벽·창 붙박이」라고 말한다',
       !q.ok && /붙박이/.test(q.reason), q.reason);
    const q2 = state.furnitureSellQuote(S, 'banjiha-growlight-bar',
                                        { preset: 'growlight_bar', riders: [] });
    ok('① 식물등도 못 판다 — 「조명」이라고 말한다', !q2.ok && /조명/.test(q2.reason), q2.reason);
  }
  /* ② 위에 화분이 올라가 있다 — 추천 자리와 자유 좌표 **둘 다** */
  {
    const S = mk();
    S.pots = [{ id: 'p1', slotId: 'banjiha-desk:0' }];
    const q = state.furnitureSellQuote(S, 'banjiha-desk', { preset: 'desk', riders: [] });
    ok('② 책상 위에 화분(추천 자리)이 있으면 못 판다', !q.ok && /화분/.test(q.reason), q.reason);

    const S2 = mk();
    S2.cuttings = [{ id: 'c1', slotId: 'free:1', at: { x: 0, y: 0.74, z: 0, onUid: 'banjiha-desk' } }];
    const q2 = state.furnitureSellQuote(S2, 'banjiha-desk', { preset: 'desk', riders: [] });
    ok('② 책상 위에 삽수(자유 좌표)가 있으면 못 판다', !q2.ok && /삽수/.test(q2.reason), q2.reason);
  }
  /* ③ 다른 가구를 받치고 있다 */
  {
    const S = mk();
    const q = state.furnitureSellQuote(S, 'banjiha-dresser',
                                       { preset: 'dresser', riders: ['banjiha-nightstand'] });
    ok('③ 위에 다른 가구가 있으면 못 판다', !q.ok && /다른 가구/.test(q.reason), q.reason);
    let threw = null;
    try { state.furnitureSellQuote(S, 'banjiha-dresser', { preset: 'dresser' }); }
    catch (e) { threw = e; }
    ok('③ riders 를 안 주면 **던진다** (지어내지 않는다)', !!threw && /riders/.test(threw.message),
       threw ? threw.message : '안 던졌다');
  }
  /* ④ 방이 못 박았다 */
  {
    const S = mk();
    const q = state.furnitureSellQuote(S, 'banjiha-bed',
                                       { preset: 'bed_single', riders: [], fixed: true });
    ok('④ 방이 못 박은 것은 못 판다', !q.ok && /붙박이/.test(q.reason), q.reason);
  }
  /* ⑤ 판다 — 돈이 들어오고 방에서 걷힌다 */
  {
    const S = mk();
    state.setFurniturePlacement(S, 'banjiha-nightstand', { x: 0.4, z: -1.6, rot: 0 });
    const cash0 = S.tutorial.cashWon;
    const q = state.furnitureSellQuote(S, 'banjiha-nightstand', { preset: 'nightstand', riders: [] });
    ok('⑤ 팔 수 있다', q.ok, q.reason || '');
    const r = state.sellFurniture(S, 'banjiha-nightstand', { preset: 'nightstand', riders: [] });
    ok(`⑤ 되사는 값 ${won(r.won)} 이 지갑에 들어왔다`, S.tutorial.cashWon - cash0 === r.won);
    ok('⑤ 판 가구로 적혔다', state.isFurnitureSold(S, 'banjiha-nightstand'));
    ok('⑤ 자리표에서도 걷혔다', !('banjiha-nightstand' in S.home.furniture));
    ok('⑤ 판 돈이 furniture 통에 담겼다', shop.saleLedgerOf(S).byKind.furniture === r.won);
    ok('⑤ 합계와 갈래별 합이 맞는다', shop.saleLedgerOf(S).balanced);
    let again = null;
    try { state.sellFurniture(S, 'banjiha-nightstand', { preset: 'nightstand', riders: [] }); }
    catch (e) { again = e; }
    ok('⑤ 두 번 못 판다', !!again && /이미 팔았습니다/.test(again.message),
       again ? again.message : '두 번 팔렸다');
  }
  /* ⑥ 사서 놓은 가구를 팔면 재고가 아니라 **방에서** 빠진다 */
  {
    const S = mk();
    shop.shopOf(S).stock['furn_stool'] = 1;
    const put = state.placeBoughtFurniture(S, 'furn_stool', { x: 1, z: 1, rot: 0 });
    ok('⑥ 사서 놓으면 재고가 줄고 방에 한 줄이 는다',
       shop.stockOf(S, 'furn_stool') === 0 && state.addedFurniture(S).length === 1);
    state.sellFurniture(S, put.uid, { riders: [] });
    ok('⑥ 그것을 팔면 방 목록에서 빠진다 (판 목록에는 안 들어간다)',
       state.addedFurniture(S).length === 0 && !state.isFurnitureSold(S, put.uid));
  }
}

/* ════════════════════════════════════════════════════════════
   G. 세이브 — 왕복하나 · 옛 세이브가 그대로 열리나
════════════════════════════════════════════════════════════ */
console.log('\nG. 세이브');
{
  const S = state.newState({ room: 'banjiha', mode: 'novice' });
  S.tutorial = tutorial.createTutorialState({ enabled: true });
  S.tutorial.lamp.unlocked = true;
  S.shop = shop.createShopState();
  shop.shopOf(S).stock['furn_stool'] = 1;
  state.placeBoughtFurniture(S, 'furn_stool', { x: 1.2, z: 0.8, rot: 90 }, { uid: 'add-stool-1' });
  state.sellFurniture(S, 'banjiha-chair', { preset: 'chair', riders: [] });

  const packed = save.serialize(S, { now: new Date('2026-08-17T09:00:00Z') });
  const raw = JSON.stringify(packed);
  const S2 = save.deserialize(raw, {});
  assert.deepEqual(S2.home.furnitureSold, ['banjiha-chair']);
  ok('판 가구가 왕복한다', S2.home.furnitureSold.length === 1);
  assert.deepEqual(S2.home.furnitureAdded,
                   [{ uid: 'add-stool-1', preset: 'stool', x: 1.2, z: 0.8, rot: 90 }]);
  ok('사서 놓은 가구가 왕복한다 (프리셋까지)', S2.home.furnitureAdded.length === 1);
  ok('판 돈 통도 왕복한다', shop.saleLedgerOf(S2).byKind.furniture === shop.saleLedgerOf(S).byKind.furniture);

  /* ★ 옛 세이브 — 두 칸을 통째로 지운 판이 그대로 열려야 한다 */
  const old = JSON.parse(raw);
  delete old.state.home.furnitureSold;
  delete old.state.home.furnitureAdded;
  delete old.state.shop.earnedBy;
  const S3 = save.deserialize(JSON.stringify(old), {});
  ok('옛 세이브(두 칸 없음)가 던지지 않고 열린다', !!S3);
  assert.deepEqual(S3.home.furnitureSold, []);
  assert.deepEqual(S3.home.furnitureAdded, []);
  ok('옛 세이브는 「아무것도 안 팔았고 안 놓았다」로 열린다 — 방이 원래 그대로다', true);
  ok('옛 세이브의 판 돈은 unknown 으로 옮겨져 합이 맞는다', shop.saleLedgerOf(S3).balanced);
}

/* ════════════════════════════════════════════════════════════
   H. 가구점에 안 내는 가구 · 되파는 값을 프리셋이 정한다 (박사님 2026-10-04 결정)
   ⚠ 시험 프리셋 둘을 «얹어서» 꽂고 재고, 끝나면 진짜 표로 되돌린다. 값(0원)은 박사님 것이고 칸은 [House] 것이다 —
     여기서는 «칸을 읽는 규칙»만 잰다
════════════════════════════════════════════════════════════ */
console.log('\nH. 안 내는 가구 · 프리셋이 정한 되파는 값 (2026-10-04)');
{
  const T_SIZE = { w: 0.334, d: 0.603, h: 0.4 };          // 쓰레기봉투 빌더 크기(집 창이 낸 값)
  shop.installFurniturePresets({ presets: { ...PRESETS.presets,
    __t_trash: { type: 'box', name_ko: '시험 쓰레기봉투', size_m: T_SIZE, shop_listed: false, resale_won: 0 },
    __t_cheap: { type: 'box', name_ko: '시험 싼 가구', size_m: T_SIZE, resale_won: 5_000 } } });
  try {
    const open = { tutorial: { enabled: true, lamp: { unlocked: true } } };
    const list = shop.furnitureCatalogList(open);
    ok('안 내는 가구는 가구점 목록에 없다', !list.some(x => x.preset === '__t_trash'));
    ok('안 내는 가구는 주문 품목도 아니다 (catalogItemOf → null)', shop.catalogItemOf('furn___t_trash') === null);
    const cheap = list.find(x => x.preset === '__t_cheap');
    ok('resale_won 만 있는 가구는 가구점에 뜨고, 목록의 되사는 값이 그 값이다', !!cheap && cheap.resaleWon === 5_000,
       cheap ? String(cheap.resaleWon) : '안 뜸');
    const q = shop.furnitureQuoteOf('__t_trash');
    ok('안 내는 가구도 «가구»다 — 값을 물으면 ok · 되파는 값 0 · listed false',
       q.ok && q.resaleWon === 0 && q.listed === false, JSON.stringify({ ok: q.ok, r: q.resaleWon, l: q.listed }));
    const qs = shop.furnitureQuoteOf('__t_trash', { sizeM: { w: 1, d: 1, h: 1 } });
    ok('방이 크기를 덮어써도 프리셋이 정한 되파는 값은 그대로다', qs.resaleWon === 0);

    const S = { day: 50, schema: 'game_state/1',
      tutorial: { enabled: true, cashWon: 100_000, lamp: { unlocked: true } },
      shop: shop.createShopState(), home: { room: 'banjiha', furniture: {} },
      lamps: { count: 0, litHours: 12, aim: {} }, pots: [], emptyPots: [], cuttings: [] };
    const sq = state.furnitureSellQuote(S, 'banjiha-trash', { preset: '__t_trash', riders: [] });
    ok('방에 놓인 안 내는 가구는 팔 수 있다(치우기)', sq.ok && sq.won === 0 && sq.listed === false, sq.reason || '');
    const logs = [];
    const cash0 = S.tutorial.cashWon;
    const sold = state.sellFurniture(S, 'banjiha-trash', { preset: '__t_trash', riders: [], log: (m) => logs.push(m) });
    ok('팔면 0원 — 지갑이 그대로다', S.tutorial.cashWon === cash0);
    /* ★ 0원으로 «정한» 것의 말 — [plan] plan-zero-won-furniture.md ④ (값은 박사님 결정 그대로) */
    ok('0원으로 정한 가구는 «치우기»다 (quote·판 결과 clearOnly)', sq.clearOnly === true && sold.clearOnly === true);
    ok('로그는 「🪑 …를 치웠습니다」 한 줄 — 「팔았습니다」·「0원」·「넘겼습니다」가 없다',
       logs.length === 1 && /치웠습니다$/.test(logs[0]) && !logs.some(m => /팔았습니다|0원|넘겼습니다/.test(m)), JSON.stringify(logs));
    ok('사건 말도 「치웠습니다」 · id 는 furniture_sold 그대로',
       sold.events[0].id === 'furniture_sold' && /치웠습니다$/.test(sold.events[0].ko), JSON.stringify(sold.events[0]));
    ok('셈으로 값이 나온 가구는 «치우기»가 아니다', shop.furnitureQuoteOf('__t_cheap').clearOnly === false
       && shop.furnitureQuoteOf('nightstand').clearOnly === false);
    ok('판 가구로 적혀 방에서 걷힌다', state.isFurnitureSold(S, 'banjiha-trash'));
    ok('판 돈 통과 합이 맞는다(0원도 «판 것»으로 센다)',
       shop.saleLedgerOf(S).balanced && (shop.saleLedgerOf(S).byKind.furniture || 0) === 0);
    ok('안 내는 가구는 «산 값의 N%»를 지어내지 않는다', logs.length > 0 && logs.every(m => !/산 값/.test(m)), JSON.stringify(logs));

    /* 모양이 틀린 칸은 던진다 — 지어내지 않는다 */
    const bad = (extra) => {
      try { shop.installFurniturePresets({ presets: { __b: { type: 'box', size_m: T_SIZE, ...extra } } }); return null; }
      catch (e) { return e; }
    };
    const e1 = bad({ resale_won: -100 }), e2 = bad({ resale_won: '0' }), e3 = bad({ resale_won: 12.5 }), e4 = bad({ shop_listed: 'no' });
    ok('resale_won 이 음수·글자·소수면 던진다', !!e1 && !!e2 && !!e3 && /resale_won/.test(e1.message),
       [e1, e2, e3].map(e => e && e.message).join(' | '));
    ok('shop_listed 가 true/false 가 아니면 던진다', !!e4 && /shop_listed/.test(e4.message), e4 ? e4.message : '안 던짐');
  } finally {
    shop.installFurniturePresets(PRESETS);                // 진짜 표로 되돌린다
  }
  ok('진짜 표로 되돌렸다 — 가구점 87줄',
     shop.furnitureCatalogList({ tutorial: { enabled: true, lamp: { unlocked: true } } }).length === 87);
}

console.log(`\n${fail === 0 ? '✅' : '❌'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
