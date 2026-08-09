/* ============================================================
   tools/test_siru_each.mjs — 시루는 **하나하나가 제 물건**이다 · 2026-08-09 신설
   ------------------------------------------------------------
     node tools/test_siru_each.mjs        (브라우저가 필요 없다 — 규칙만 본다)

   ★ 왜 이 검사가 필요한가.
     박사님이 폰으로 플레이하시고 주신 지시:
       *"콩나물시루 아이템만 있어서 그걸 드래그 하면 하나씩 따로따로 설치되게 하고싶어.
         지금 콩나물시루를 뭉태기로 설치가 되는데 내가 의도한건 콩나물시루 하나하나가
         각개 움직이고 각개 물주고 햇으면 좋겠어."*

     그전까지 자리는 **작물마다 하나**였고(`site.slotId`) 시루 N개가 그 위에 무리로 섰다.
     그래서 ① 끌면 가방의 시루가 전부 한 자리에 쏟아지고 ② 물도 거두기도 자리 단위였다.
     자리를 시루로 내리는 변경은 세이브·조도 계약·방뷰가 전부 걸린 큰 수술이라,
     **무엇이 약속인지 여기 못 박는다.**

   ══ 무엇을 보나 ═══════════════════════════════════════════════════════════
     A  자리가 시루마다다 — 하나를 옮겨도 나머지가 안 따라온다
     B  ★ 놓아야 자란다 · 가방의 빈 시루는 물도 안 받고 하루도 안 먹는다
     C  ★ 빛이 시루마다다 — 같은 날 어두운 데와 밝은 데의 품질이 갈린다
     D  각개 물주기 · 각개 수확 · 각개 다시 심기
     E  ★★ 옛 세이브 — 무리로 저장된 판이 각개로 열리고, **진행이 안 사라진다**
     F  ★★ 재고 — 세울 수 없으면 **한 톨도 안 빠진다** (test_resow_atomic 과 같은 규약)
     G  계약(조도)에 시루가 **하나씩 따로** 실린다 — 열쇠가 안 겹친다

   ⚠ 조도 엔진은 한 줄도 안 건드렸다. 여기서도 **계약이 낸 값만** 쓴다.
============================================================ */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createFirstPlayState, placeBeansprout, placeCrop, addCropPot, makeCropPot,
  waterBeansprout, harvestBeansprout, resowBeansprout, advanceBeansproutDay,
  ensureCropPots, syncCropLead, cropPotList, cropPotPlaced, placedCropPots, idleCropPots,
  beansproutReady, readyCropPots, FIRST_PLAY_RULES, firstPlayRulesFromBalance
} from '../src/game/first_play.js';
import { newState, placeSiru, waterSiru, resowCrop, placedItems } from '../src/game/state.js';
import { stockOf } from '../src/game/shop.js';
import { serialize, deserialize } from '../src/game/save.js';

let pass = 0, fail = 0;
const ok = (n, c, v = '') => {
  if (c) { pass++; console.log(`  OK  ${n}` + (v ? `  → ${v}` : '')); }
  else { fail++; console.log(`  FAIL ${n}` + (v ? `  → ${v}` : '')); }
};

/* 밸런스 값은 정본에서 온다 — 여기서 숫자를 지으면 검사가 게임과 다른 판을 본다 */
const RULES = firstPlayRulesFromBalance(JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8')));
const CYCLE = RULES.harvestDays;

/* 시루 n개를 만들어 **자리는 안 준 채로** 둔다 — 가방에 있는 빈 시루다 */
function fpWith(n) {
  const fp = createFirstPlayState({ enabled: true, rules: RULES });
  for (let i = 1; i < n; i++) addCropPot(fp, 'beansprout', { day: 0 });
  return fp;
}
const potsOf = fp => fp.beansprout.pots;

console.log('\n══ A. 자리가 시루마다다 ════════════════════════════════════════');
{
  const fp = fpWith(3);
  /* 셋을 각자 다른 자리에 놓는다 */
  placeCrop(fp, 'beansprout', 'dark-a', { potId: potsOf(fp)[0].id });
  placeCrop(fp, 'beansprout', 'dark-b', { potId: potsOf(fp)[1].id });
  placeCrop(fp, 'beansprout', 'bright-c', { potId: potsOf(fp)[2].id });
  ok('A-1 시루 셋이 각자 다른 자리에 선다',
     potsOf(fp).map(p => p.slotId).join(',') === 'dark-a,dark-b,bright-c',
     potsOf(fp).map(p => p.slotId).join(','));

  /* 하나만 옮긴다 — 나머지는 그대로여야 한다 */
  placeCrop(fp, 'beansprout', 'moved', { potId: potsOf(fp)[1].id });
  ok('A-2 하나를 옮겨도 나머지가 안 따라온다',
     potsOf(fp).map(p => p.slotId).join(',') === 'dark-a,moved,bright-c',
     potsOf(fp).map(p => p.slotId).join(','));

  /* `potId` 없이 부르면 예전 뜻 그대로 — **전부** 간다(옛 호출부가 안 깨진다) */
  placeCrop(fp, 'beansprout', 'all-here');
  ok('A-3 potId 를 안 주면 예전처럼 전부 간다 (옛 호출부 호환)',
     potsOf(fp).every(p => p.slotId === 'all-here'),
     potsOf(fp).map(p => p.slotId).join(','));

  /* 자리 사본은 **대표 시루의 것**이고, 정본은 pots 다 */
  placeCrop(fp, 'beansprout', 'lead-spot', { potId: potsOf(fp)[0].id });
  syncCropLead(fp.beansprout);
  ok('A-4 자리 사본(site.slotId)은 놓인 시루 중 하나를 가리킨다',
     potsOf(fp).some(p => p.slotId === fp.beansprout.slotId), fp.beansprout.slotId);
}

console.log('\n══ B. 놓아야 자란다 — 가방의 빈 시루는 하루를 안 먹는다 ═══════════');
{
  const fp = fpWith(3);
  placeCrop(fp, 'beansprout', 'dark-a', { potId: potsOf(fp)[0].id });
  ok('B-1 하나만 놓았으면 놓인 것은 1개', placedCropPots(fp.beansprout).length === 1);
  ok('B-2 나머지 둘은 가방에 있다', idleCropPots(fp.beansprout).length === 2);

  const w = waterBeansprout(fp, 0, { all: true });
  ok('B-3 [전부 주기]도 **놓인 것에만** 간다', w.started === 1, `${w.started}개`);

  for (let d = 1; d <= CYCLE; d++) advanceBeansproutDay(fp, 0.2);
  ok('B-4 가방의 시루는 하루를 안 먹는다',
     potsOf(fp)[1].ageDays === 0 && potsOf(fp)[2].ageDays === 0,
     potsOf(fp).map(p => p.ageDays).join(','));
  ok('B-5 놓은 시루만 다 자랐다', potsOf(fp)[0].ageDays === CYCLE, potsOf(fp)[0].ageDays);
  ok('B-6 그때 거둘 것은 1개다', readyCropPots(fp.beansprout).length === 1);
}

console.log('\n══ C. 빛이 시루마다다 — 같은 날 품질이 갈린다 ═══════════════════');
{
  const fp = fpWith(2);
  placeCrop(fp, 'beansprout', 'dark', { potId: potsOf(fp)[0].id });
  placeCrop(fp, 'beansprout', 'bright', { potId: potsOf(fp)[1].id });
  waterBeansprout(fp, 0, { all: true });
  /* ★ 자리마다 다른 값을 넘긴다. 이 표는 `loop.js` 가 하루치 계약에서 뽑아 넘기는 것과
     **같은 모양**이다 — 조도를 여기서 새로 만들지 않는다. */
  for (let d = 1; d <= CYCLE; d++)
    advanceBeansproutDay(fp, 0.2, { dliBySlot: { dark: 0.2, bright: 1.4 } });
  ok('C-1 둘 다 다 자랐다', potsOf(fp).every(p => p.ageDays === CYCLE));
  const h = harvestBeansprout(fp, { day: CYCLE });
  const q = h.perPot.map(p => p.quality);
  ok('C-2 ★어두운 자리와 밝은 자리의 품질이 **갈린다**', q[0] !== q[1], q.join(' / '));
  ok('C-3 어두운 쪽이 하얗고 아삭하다', q[0] === 'crisp_white', q[0]);
  /* 표를 안 주면 예전처럼 자리 대표값 하나로 돈다 — 옛 호출부가 안 깨진다 */
  const fp2 = fpWith(2);
  placeCrop(fp2, 'beansprout', 'dark');
  waterBeansprout(fp2, 0, { all: true });
  for (let d = 1; d <= CYCLE; d++) advanceBeansproutDay(fp2, 0.2);
  const h2 = harvestBeansprout(fp2, { day: CYCLE });
  ok('C-4 표를 안 주면 예전처럼 한 값으로 돈다',
     h2.perPot.every(p => p.quality === h2.perPot[0].quality), h2.perPot.map(p => p.quality).join('/'));
}

console.log('\n══ D. 각개 물주기 · 각개 수확 · 각개 다시 심기 ═════════════════');
{
  const fp = fpWith(3);
  for (const p of potsOf(fp)) placeCrop(fp, 'beansprout', 'dark', { potId: p.id });

  /* ① 각개 물주기 — 고른 시루만 시작한다 */
  const target = potsOf(fp)[2].id;
  const w = waterBeansprout(fp, 0, { potIds: [target] });
  ok('D-1 고른 시루 하나만 시작한다', w.started === 1 && w.startedIds[0] === target,
     JSON.stringify(w.startedIds));
  ok('D-2 나머지 둘은 아직 대기다', w.waiting === 2, w.waiting);

  /* ② 각개 수확 — 셋을 다 시작해 놓고 하나만 거둔다 */
  waterBeansprout(fp, 0, { all: true });
  for (let d = 1; d <= CYCLE; d++) advanceBeansproutDay(fp, 0.2);
  ok('D-3 셋 다 익었다', readyCropPots(fp.beansprout).length === 3);
  const h = harvestBeansprout(fp, { day: CYCLE, potIds: [target] });
  ok('D-4 ★고른 시루 하나만 거둬진다', h.harvestedPots === 1, h.harvestedPots);
  ok('D-5 나머지 둘은 그대로 익은 채로 서 있다', readyCropPots(fp.beansprout).length === 2);
  ok('D-6 그러니 겹침이 안 물린다 (한 개는 온전한 값)',
     h.perPot[0].savedWon === h.perPot[0].fullWon,
     `${h.perPot[0].savedWon} / ${h.perPot[0].fullWon}`);

  /* ③ 각개 다시 심기 */
  const r = resowBeansprout(fp, { day: CYCLE, potIds: [target] });
  ok('D-7 ★고른 시루 하나만 다시 심어진다', r.resown === 1, r.resown);
  ok('D-8 다시 심은 시루는 자리를 안 잃는다',
     potsOf(fp).find(p => p.id === target).slotId === 'dark');
  /* potIds 를 안 주면 예전 뜻 — 거둔 것을 다 심는다 */
  harvestBeansprout(fp, { day: CYCLE });
  const r2 = resowBeansprout(fp, { day: CYCLE });
  ok('D-9 potIds 를 안 주면 거둔 것을 다 심는다 (옛 호출부 호환)', r2.resown === 2, r2.resown);
}

console.log('\n══ E. 옛 세이브 — 무리로 저장된 판이 각개로 열린다 ═══════════════');
{
  /* 옛 모양: `pots` 칸이 아예 없고 자리 사본 하나에 `sirus: 3` 이 실려 있다 */
  const old = {
    kind: 'beansprout', slotId: 'banjiha-desk:0', at: null,
    harvestDays: CYCLE, sirus: 3, cycle: 2,
    ageDays: 2, dliHist: [0.2, 0.2], harvested: false, quality: null, meals: 0,
    avgDli: 0.2, harvestCount: 1, harvestMeals: 3, wateredOnDay: 4
  };
  ensureCropPots(old);
  ok('E-1 옛 한 칸이 시루 3개로 열린다', old.pots.length === 3, old.pots.length);
  ok('E-2 ★셋 다 **그때 서 있던 자리**를 그대로 갖는다 (지어낸 값이 아니다)',
     old.pots.every(p => p.slotId === 'banjiha-desk:0'),
     old.pots.map(p => p.slotId).join(','));
  ok('E-3 진행(자란 날·빛 이력)이 안 사라진다',
     old.pots.every(p => p.ageDays === 2 && p.dliHist.length === 2));
  ok('E-4 시작일도 그대로다 (옛 wateredOnDay 가 회전 시작이 된다)',
     old.pots.every(p => p.startedOnDay === 4));
  /* 그리고 그 판에서 **하나만** 집어 옮길 수 있다 — 그게 「각개로 열린다」의 뜻이다 */
  const fp = createFirstPlayState({ enabled: true, rules: RULES });
  fp.beansprout = { ...fp.beansprout, ...old };
  placeCrop(fp, 'beansprout', 'somewhere-else', { potId: fp.beansprout.pots[1].id });
  ok('E-5 ★옛 판에서도 시루 하나만 집어 옮길 수 있다',
     fp.beansprout.pots.map(p => p.slotId).join(',') ===
       'banjiha-desk:0,somewhere-else,banjiha-desk:0',
     fp.beansprout.pots.map(p => p.slotId).join(','));
}

console.log('\n══ F. 재고 — 세울 수 없으면 한 톨도 안 빠진다 ═══════════════════');
{
  const S = newState({ firstPlay: true, firstPlayRules: RULES });
  S.shop = S.shop || {}; S.shop.stock = { ...(S.shop.stock || {}), siru: 2, bean_seed: 2 };
  /* 처음 받은 시루 하나가 가방에 있다 — 그것부터 선다(재고를 안 쓴다) */
  const r1 = placeSiru(S, 'dark-a', {});
  ok('F-1 처음 받은 시루가 먼저 선다 — 재고를 안 쓴다',
     r1.fromStock === false && stockOf(S, 'siru') === 2 && stockOf(S, 'bean_seed') === 2,
     `siru ${stockOf(S, 'siru')} · seed ${stockOf(S, 'bean_seed')}`);

  const r2 = placeSiru(S, 'dark-b', {});
  ok('F-2 그다음부터 재고에서 나간다 (시루 1 · 씨앗 1)',
     r2.fromStock === true && stockOf(S, 'siru') === 1 && stockOf(S, 'bean_seed') === 1,
     `siru ${stockOf(S, 'siru')} · seed ${stockOf(S, 'bean_seed')}`);
  ok('F-3 판에 선 것은 2개다', placedCropPots(S.firstPlay.beansprout).length === 2);

  /* 씨앗이 없으면 던진다. 그때 **시루도 안 빠진다** — 이 순서가 이 검사의 전부다 */
  S.shop.stock.bean_seed = 0;
  const before = { siru: stockOf(S, 'siru'), pots: S.firstPlay.beansprout.pots.length };
  let threw = null;
  try { placeSiru(S, 'dark-c', {}); } catch (e) { threw = e; }
  ok('F-4 씨앗이 없으면 던진다', !!threw, threw && threw.message);
  ok('F-5 ★★던지고도 시루 재고가 그대로다', stockOf(S, 'siru') === before.siru,
     `${before.siru} → ${stockOf(S, 'siru')}`);
  ok('F-6 던지고도 빈 시루가 상태에 안 남는다',
     S.firstPlay.beansprout.pots.length === before.pots,
     `${before.pots} → ${S.firstPlay.beansprout.pots.length}`);

  /* 좌표가 나빠 못 놓아도 마찬가지다 */
  S.shop.stock.bean_seed = 2;
  const before2 = { siru: stockOf(S, 'siru'), seed: stockOf(S, 'bean_seed'),
                    pots: S.firstPlay.beansprout.pots.length };
  let threw2 = null;
  try { placeSiru(S, '', {}); } catch (e) { threw2 = e; }
  ok('F-7 자리를 안 주면 던진다', !!threw2, threw2 && threw2.message);
  ok('F-8 ★그때도 재고·상태가 그대로다',
     stockOf(S, 'siru') === before2.siru && stockOf(S, 'bean_seed') === before2.seed &&
     S.firstPlay.beansprout.pots.length === before2.pots,
     `siru ${stockOf(S, 'siru')} · seed ${stockOf(S, 'bean_seed')} · pots ${S.firstPlay.beansprout.pots.length}`);
}

console.log('\n══ G. 조도 계약 — 시루가 하나씩 따로 실린다 ═════════════════════');
{
  const S = newState({ firstPlay: true, firstPlayRules: RULES });
  S.shop = S.shop || {}; S.shop.stock = { ...(S.shop.stock || {}), siru: 3, bean_seed: 3 };
  placeSiru(S, 'a', {}); placeSiru(S, 'b', {}); placeSiru(S, 'c', {});
  const items = placedItems(S).filter(i => i.crop);
  ok('G-1 놓인 시루 수만큼 실린다', items.length === 3, items.length);
  ok('G-2 ★열쇠(id)가 시루마다 다르다 — 겹치면 뒤엣것이 앞엣것을 덮는다',
     new Set(items.map(i => i.id)).size === 3, items.map(i => i.id).join(','));
  ok('G-3 자리도 시루마다 다르다',
     new Set(items.map(i => i.slotId)).size === 3, items.map(i => i.slotId).join(','));
  /* 아직 안 놓은 시루는 안 실린다 — 방에 없는 것은 자리를 안 차지한다 */
  addCropPot(S.firstPlay, 'beansprout', { day: 0 });
  ok('G-4 가방의 빈 시루는 계약에 안 실린다',
     placedItems(S).filter(i => i.crop).length === 3);
}

console.log('\n══ H. 화면이 읽는 목록 (cropPotList) ═══════════════════════════');
{
  const fp = fpWith(3);
  placeCrop(fp, 'beansprout', 'dark', { potId: potsOf(fp)[0].id });
  waterBeansprout(fp, 0, { potIds: [potsOf(fp)[0].id] });
  advanceBeansproutDay(fp, 0.2);
  const rows = cropPotList(fp, 1).filter(r => r.kind === 'beansprout');
  ok('H-1 시루 수만큼 줄이 난다', rows.length === 3, rows.length);
  ok('H-2 놓인 줄은 하나다', rows.filter(r => r.placed).length === 1);
  ok('H-3 자라는 줄의 게이지가 1/N 이다',
     Math.abs(rows[0].progress01 - 1 / CYCLE) < 1e-9, rows[0].progress01);
  ok('H-4 가방 줄은 「가방에 있다」로 읽힌다',
     rows[1].inBag === true && rows[1].needsWater === false);
  ok('H-5 사람이 부르는 이름(순번)이 붙는다', rows.map(r => r.ord).join(',') === '1,2,3');
}

console.log(`\n${pass + fail}개 중 ${pass}개 통과` + (fail ? ` · ${fail}개 실패` : ' — 전부 통과'));
if (fail) process.exit(1);
