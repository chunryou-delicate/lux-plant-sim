/* ============================================================
   tools/probe_crop_balance.mjs — **확정문 §5 의 살림 표를 엔진으로 다시 뽑는다**
   ------------------------------------------------------------
     node tools/probe_crop_balance.mjs

   박사님 확정문(`docs/handoff/plan-2026-08-17-crop-balance.md`) §5 의 표(파산 165일 등)는
   **손으로 세운 모형**이다. 그 문서가 스스로 적어 두었다:
     *"⚠⚠ 이 표는 손으로 세운 모형이다. 붙인 뒤 반드시 `first_play.js` 엔진으로 다시 굴려
       표를 내라. 다르면 **엔진이 맞고 이 표가 틀린 것이다.**"*
   그리고 `overlap-to-plan.md` 가 **잉여를 안 팔고 세는 잘못**을 한 번 잡아냈다.
   ⇒ 이 프로브는 **엔진으로 · 잉여까지 팔아서** 다시 잰다.

   ══ ★★ 무엇을 켜고 무엇을 껐나 (START-HERE §2 첫째 규칙) ═══════════════════════
     · 엔진      `src/game/first_play.js` 정본. 규칙 사본을 안 갈아 끼운다(지금 게임 그대로)
     · 방·자리   반지하 14칸. **DLI 는 확정문 §4 의 표**를 그대로 쓴다(아래 CELLS ⚠ 참고)
     · 지갑      `tutorial.createTutorialState` 그대로 — 시작돈·월세·하루 지출은 그 파일이 정본
     · 씨앗값    다시 심을 때마다 **실구매가**(`shop.buyPriceOf`)가 지갑에서 나간다
     · 용기값    ⚠ **안 뺐다.** 처음부터 N개를 갖고 시작한 것으로 본다
     · 손        하루에 **최대 5개**만 물을 준다(체력 5)
     · 파는 것   ★ **매일 남는 것을 판다** — 곳간 판매(`takePantryCrop`)로. 잉여 계통은 늘 0 이다
     · 안 켠 것  몬스테라 · 삽수 · 상점 물건 · 계절 · 3D. 「채소만으로 며칠 버티나」를 잰다
============================================================ */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  firstPlayRulesFromBalance, createFirstPlayState, makeCropPot,
  waterBeansprout, advanceBeansproutDay, harvestBeansprout,
  eatFromPantry, resowBeansprout, cropSiteOf, cropQualityOf,
  cropMealPlan, cropCycleGrams, cropSellWonPerGram,
  pantrySaleQuote, takePantryCrop, pantryLotsOf, cropSurplusQuote, takeCropSurplus,
  formatGram, CROP_KINDS
} from '../src/game/first_play.js';
import { createTutorialState, tutorialDay, TUTORIAL_RULES } from '../src/game/tutorial.js';
import { buyPriceOf } from '../src/game/shop.js';

const BALANCE = JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8'));
const R = firstPlayRulesFromBalance(BALANCE);
const won = n => Math.round(n).toLocaleString('ko-KR');

/* ══ 반지하 14칸 — 확정문 §4 의 표 ═══════════════════════════════════════════
   ⚠⚠ **끝값만 확정문에 있다.** *"서랍장 0·1 · 선반 0~2 = 0.05~0.14 · 책상1 · 선반 3~5 =
     0.19~0.22 · 책상0 · 선반 6~8 = 0.48~0.60 · 창턱 4.80"*. 사이 값은 그 범위 안에
     고르게 폈다 — **지어낸 값이라고 여기 적어 둔다.**
   ★ 그래도 답이 안 흔들리는 까닭은 확정문 §4 가 적어 둔 그것이다: 경계(콩나물 0.3·1.0 ·
     무순 0.35·0.15)가 **0.22 와 0.48 사이의 빈 틈**에 있어서, 그 틈 어디를 골라도 같은 답이다.
   ⚠ 딱 하나 예외 — 무순의 **0.15** 경계는 어두운 무리 **안**(0.14 와 0.19 사이)에 떨어진다.
     그래서 「무순을 어두운 칸에 놓는」 잘못된 배치에서만 사이 값이 답을 조금 움직인다. */
const CELLS = Object.freeze([
  { id: 'dresser:0', dli: 0.05, group: 'dark' },
  { id: 'dresser:1', dli: 0.09, group: 'dark' },
  { id: 'shelf:0', dli: 0.11, group: 'dark' },
  { id: 'shelf:1', dli: 0.13, group: 'dark' },
  { id: 'shelf:2', dli: 0.14, group: 'dark' },
  { id: 'desk:1', dli: 0.19, group: 'dark' },
  { id: 'shelf:3', dli: 0.20, group: 'dark' },
  { id: 'shelf:4', dli: 0.21, group: 'dark' },
  { id: 'shelf:5', dli: 0.22, group: 'dark' },
  { id: 'desk:0', dli: 0.48, group: 'bright' },
  { id: 'shelf:6', dli: 0.52, group: 'bright' },
  { id: 'shelf:7', dli: 0.56, group: 'bright' },
  { id: 'shelf:8', dli: 0.60, group: 'bright' },
  { id: 'sill:0', dli: 4.80, group: 'sill' }        // 몬스테라 자리 — 작물은 안 놓는다
]);
const DARK = CELLS.filter(c => c.group === 'dark').map(c => c.id);
const BRIGHT = CELLS.filter(c => c.group === 'bright').map(c => c.id);
const DLI_BY_SLOT = Object.fromEntries(CELLS.map(c => [c.id, c.dli]));

/* ══ ① 자리별 품질 — 확정문 §4 의 표가 코드에서도 그대로 나오나 ═══════════════ */
function table(head, rows) {
  const w = head.map((h, i) => Math.max(String(h).length, ...rows.map(r => String(r[i]).length)));
  const line = r => '  ' + r.map((c, i) => String(c).padStart(w[i])).join(' | ');
  console.log(line(head));
  console.log('  ' + w.map(x => '-'.repeat(x)).join('-+-'));
  for (const r of rows) console.log(line(r));
  console.log('');
}

console.log('\n' + '═'.repeat(78));
console.log('★ ① 반지하 14칸 — 자리마다 두 작물이 몇 g 을 내나 (확정문 §4 를 엔진으로 확인)');
console.log('═'.repeat(78) + '\n');
table(['칸', 'DLI', '콩나물', '무순'],
  CELLS.map(c => {
    const b = cropQualityOf('beansprout', c.dli), m = cropQualityOf('musun', c.dli);
    return [c.id, c.dli.toFixed(2),
            `${b.ko} ${cropCycleGrams(R, b.meals, 0, 0)}g`,
            `${m.ko} ${cropCycleGrams(R, m.meals, 0, 1)}g`];
  }));

/* ⇒ 확정문 §4 의 결론이 코드에서 그대로 나오는지 못 박는다 */
for (const c of CELLS.filter(c => c.group === 'dark'))
  assert.equal(cropQualityOf('beansprout', c.dli).meals, 3, `어두운 칸 ${c.id} 이 콩나물 최상이 아니다`);
for (const c of CELLS.filter(c => c.group === 'bright'))
  assert.equal(cropQualityOf('musun', c.dli).meals, 3, `밝은 칸 ${c.id} 이 무순 최상이 아니다`);

/* ══ 하루에 나오는 g — 확정문 §2 의 본전선 셈을 엔진으로 ═══════════════════════ */
console.log('★ 밝은 칸 하나를 두고 둘이 다툰다 (확정문 §2)\n');
{
  const bq = cropQualityOf('beansprout', 0.54), mq = cropQualityOf('musun', 0.54);
  const bg = cropCycleGrams(R, bq.meals, 0, 0) / CROP_KINDS[0].harvestDays;
  const mg = cropCycleGrams(R, mq.meals, 0, 1) / CROP_KINDS[1].harvestDays;
  const eat = i => R.cropMealPortionWon / CROP_KINDS[i].mealPortionGrams;
  table(['작물', '그 칸 품질', '하루에 나오는 g', '밥 원/g', '파는 원/g', '하루 값(밥으로)'],
    [['콩나물', bq.ko, bg.toFixed(1), eat(0).toFixed(2), CROP_KINDS[0].sellWonPerGram,
      won(bg * eat(0))],
     ['무순', mq.ko, mg.toFixed(1), eat(1).toFixed(2), CROP_KINDS[1].sellWonPerGram,
      won(mg * eat(1))]]);
  console.log(`  본전선 = 콩나물 g/일 ÷ 무순 g/일 = ${(bg / mg).toFixed(2)}배` +
              ` · 실제 밥 효율 비 = ${(eat(1) / eat(0)).toFixed(2)}배` +
              ` ⇒ 밝은 칸에서 무순이 ${((mg * eat(1)) / (bg * eat(0))).toFixed(2)}배\n`);
}

/* ══ ② 살림 — 파산일과 200일 잔액 ═══════════════════════════════════════════
   ★ 하루 순서: ① 익은 것 거두기 → 다시 심기(씨앗값) ② 물 주기(최대 5개)
                ③ 밥(`eatFromPantry`) ④ **남는 것 팔기** ⑤ 하루 넘기기(월세·지출)
   ⚠ ④ 에서 「내일 먹을 몫」을 남길지 말지가 갈림길이라 **두 벌을 다 잰다.** */
const DAYS = 200;
const SEED = { beansprout: buyPriceOf('bean_seed'), musun: buyPriceOf('radish_seed') };

/* 배치 — 시루/재배판을 어느 칸에 세우나. 칸이 모자라면 **돌려 쓴다**(한 칸에 여럿 선다) */
function seatsOf(list, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[i % list.length]);
  return out;
}

function live(plan, opt = {}) {
  const days = opt.days || DAYS;
  const keepMeal = opt.keepMeal === true;
  const fp = createFirstPlayState({ enabled: true, rules: R });
  /* 콩나물 — 첫 시루가 이미 하나 있다 */
  const bs = cropSiteOf(fp, 'beansprout');
  bs.pots = [];
  plan.bean.forEach((slot, i) => bs.pots.push(
    makeCropPot(`crop_01_${String(i + 1).padStart(2, '0')}`, { slotId: slot, at: { x: 0, y: 0, z: 0 } })));
  const ms = cropSiteOf(fp, 'musun');
  ms.pots = [];
  plan.musun.forEach((slot, i) => ms.pots.push(
    makeCropPot(`crop_02_${String(i + 1).padStart(2, '0')}`, { slotId: slot, at: { x: 0, y: 0, z: 0 } })));

  const ts = createTutorialState({ enabled: true });
  let brokeDay = null, ate = 0, sold = 0, seedSpent = 0, harvests = 0, soldG = 0, ateG = 0;
  for (let day = 0; day < days; day++) {
    /* ① 익은 것을 거두고 다시 심는다.
       ⚠⚠ **`harvestBeansprout` 은 종류를 안 가린다** — 익은 것을 통째로 거둔다(§수확).
         처음에 작물마다 한 번씩 불렀더니, 콩나물 차례에서 무순까지 거둬 버리고
         **무순은 다시 안 심겨서** 200일 내내 회전이 1번뿐이었다(재배판 4개가 0개와 같은 표를
         냈다). 거두기는 **한 번**, 다시 심기는 **작물마다** 한다. */
    const ripeCount = {};
    for (const kind of ['beansprout', 'musun']) {
      const site = cropSiteOf(fp, kind);
      const hd = site.harvestDays;
      ripeCount[kind] = site.pots.filter(
        p => !p.harvested && p.startedOnDay != null && p.ageDays >= hd).length;
    }
    if (ripeCount.beansprout + ripeCount.musun > 0) {
      harvestBeansprout(fp, { day });
      for (const kind of ['beansprout', 'musun']) {
        if (!ripeCount[kind]) continue;
        harvests += ripeCount[kind];
        resowBeansprout(fp, { day, kind });
        seedSpent += ripeCount[kind] * SEED[kind];
        ts.cashWon -= ripeCount[kind] * SEED[kind];
      }
    }
    /* ② 물 — 하루에 다섯 개까지(체력 5). 두 작물에 나눠 준다.
       ⚠⚠ **무순부터 준다.** 처음에 콩나물부터 줬더니 시루가 8개만 넘어도 손 다섯이 콩나물에
         다 쓰여 **무순이 200일 내내 한 번도 시작을 못 했다**(재배판 4개가 회전 4번뿐이었다).
         그러면 「재배판 0 vs 4」를 재는 이 표가 통째로 거짓이 된다.
       ★ 무순을 먼저 주는 것이 사람이 할 법한 선택이기도 하다 — 주기가 7일이라 자주 안 오고,
         한 번 밀리면 회전 하나가 통째로 늦어진다. */
    /* ★★★ **띄엄으로 준다** (2026-08-04 박사님 그림 · first_play §겹침).
       하루에 그 작물의 **주기분 한 몫**(= 올림(개수 ÷ 주기))만 시작한다. 그러면 거두는 날이
       고르게 퍼져 매일 조금씩 들어온다.
       ⚠⚠ **이것이 이번 셈에서 아주 커졌다.** 몰아서 다 시작하면 무순 4판이 **7일에 한 번**
         1.2kg 을 한꺼번에 내는데, 몫 규칙은 하루에 200g 만 밥으로 쳐 준다 — 나머지 1kg 은
         12.50원/g 이 아니라 8원/g 에 팔린다. 몰아 주기와 띄엄 주기의 차이를 §④ 에서 잰다. */
    let hands = 5;
    for (const kind of ['musun', 'beansprout']) {
      if (hands <= 0) break;
      const site = cropSiteOf(fp, kind);
      const n = site.pots.length;
      if (!n) continue;
      const want = opt.burst ? hands : Math.max(1, Math.ceil(n / site.harvestDays));
      const r = waterBeansprout(fp, day, { kind, count: Math.min(hands, want) });
      hands -= (r.started || 0);
    }
    /* ③ 밥 */
    const bite = eatFromPantry(fp);
    ate += bite.savedWon; ateG += bite.savedGrams;
    /* ④ 남는 것을 판다 — 곳간 판매(§곳간 판매)로. 꾸러미는 **앞(먼저 거둔 것)부터** 나간다.
       `keepMeal` 이면 작물마다 **내일 한 몫**(콩나물 300g · 무순 200g)을 남긴다.
       ★ 확정문 §3 이 말한 그것이다 — *"콩나물은 첫 300g만 먹고 나머지는 판다."*
       ⚠ 한 몫보다 더 남길 까닭이 없다. 같은 작물 둘째 몫은 4.00원/g 이라 파는 값(7원/g)보다
         싸서 어차피 안 먹힌다(§몫 ④). 쌓아 두면 그냥 안 팔린 재고다. */
    let guard = 0;
    while (guard++ < 400) {
      const lots = pantryLotsOf(fp);
      if (!lots.length) break;
      const ki = lots[0].kind === CROP_KINDS[1].id ? 1 : 0;
      const keep = keepMeal ? CROP_KINDS[ki].mealPortionGrams : 0;
      const mine = lots.filter(l => (l.kind === CROP_KINDS[1].id ? 1 : 0) === ki);
      const gOfKind = mine.reduce((a, l) => a + Math.round(l.won / 10), 0);
      const firstG = Math.round(lots[0].won / 10);
      if (gOfKind - firstG < keep) break;      // 팔면 내일 그 작물의 몫이 모자란다
      const q = pantrySaleQuote(fp, 1);
      if (!q.canSell) break;
      const r = takePantryCrop(fp, 1);
      sold += r.won; soldG += q.pendingGrams; ts.cashWon += r.won;
    }
    /* 잉여 계통(늘 0 이다)도 비운다 — overlap 보고가 잡아낸 「안 팔고 세는」 잘못을 안 밟는다 */
    const sq = cropSurplusQuote(fp);
    if (sq.canSell) { const r = takeCropSurplus(fp); sold += r.won; ts.cashWon += r.won; }
    /* ⑤ 하루가 간다 */
    tutorialDay(ts, { firstPlayDone: true, savedWon: bite.savedWon, lampCount: 0 });
    advanceBeansproutDay(fp, { beansprout: 0.2, musun: 0.54 }, { dliBySlot: DLI_BY_SLOT });
    if (brokeDay == null && ts.bankrupt) brokeDay = ts.day;
  }
  return { brokeDay, cashAtEnd: ts.cashWon, ate, sold, seedSpent, harvests, ateG, soldG,
           restWon: fp.food.pantryWon };
}

/* ★ 9 는 지시서 목록에 없지만 **확정문 §5 가 세운 그 판**이라 같이 잰다(시루 9 + 재배판 4) */
const SIRUS = [1, 3, 5, 8, 9, 12, 16, 20, 25];
const TRAYS = [0, 4];
const dayKo = d => d == null ? '안 남' : `${d}일`;

console.log('═'.repeat(78));
console.log('★★★ ② 살림 — 파산일과 200일 잔액 (엔진 · 잉여까지 판다)');
console.log('═'.repeat(78));
console.log(`  시작돈 ${won(TUTORIAL_RULES.startCashWon)}원 · 월세 ${won(TUTORIAL_RULES.rentWon)}원/` +
            `${TUTORIAL_RULES.rentPeriodDays}일 · 하루 지출 ${won(TUTORIAL_RULES.dailySpendWon)}원 · ` +
            `씨앗 콩 ${won(SEED.beansprout)} / 무 ${won(SEED.musun)}원 · 용기값은 안 뺐다 · ` +
            `등 없음 · 하루 5개까지 물 준다`);
console.log(`  배치 — 콩나물은 **어두운 9칸**, 무순은 **밝은 4칸**(확정문 §4). 칸이 모자라면 돌려 쓴다\n`);

for (const [ko, opt] of [['㉠ 다 팔기 (곳간을 매일 비운다)', { keepMeal: false }],
                         ['㉡ 내일 한 몫은 남기고 팔기', { keepMeal: true }]]) {
  console.log(`── ${ko} ──`);
  const rows = [];
  for (const trays of TRAYS) for (const n of SIRUS) {
    const r = live({ bean: seatsOf(DARK, n), musun: seatsOf(BRIGHT, trays) }, opt);
    rows.push([`시루 ${n} · 판 ${trays}`, dayKo(r.brokeDay), won(r.cashAtEnd),
               r.harvests, won(r.ate), won(r.sold), won(r.seedSpent)]);
  }
  table(['배치', '파산일', '200일 잔액', '거둔 회전', '밥값 절감', '판 돈', '씨앗값'], rows);
}

/* ══ ③ ★ 자리를 잘 고른 것이 정말 최선인가 — 아무렇게나 놓은 판과 견준다 ═════════ */
console.log('═'.repeat(78));
console.log('★★ ③ 어두운 9칸 콩나물 + 밝은 4칸 무순이 **정말 최선인가**');
console.log('═'.repeat(78));
console.log('  ⚠ 같은 개수(시루 9 · 재배판 4)로 **자리만** 바꿔 견준다. 다른 것은 다 같다.\n');
{
  const ALL = DARK.concat(BRIGHT);                     // 창턱은 몬스테라 자리라 뺀다
  const mix = (n, m) => {                              // 씨 고정 셔플 — 「아무렇게나」
    let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pool = ALL.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return { bean: seatsOf(pool, n), musun: seatsOf(pool.slice().reverse(), m) };
  };
  const PLANS = [
    ['㉠ 확정문대로 (콩=어두운 9 · 무순=밝은 4)', { bean: seatsOf(DARK, 9), musun: seatsOf(BRIGHT, 4) }],
    ['㉡ 뒤바꿈     (콩=밝은 9 · 무순=어두운 4)', { bean: seatsOf(BRIGHT, 9), musun: seatsOf(DARK, 4) }],
    ['㉢ 아무렇게나 (섞어서)', mix(9, 4)],
    ['㉣ 콩나물만   (어두운 13칸에 13개)', { bean: seatsOf(ALL, 13), musun: [] }],
    ['㉤ 무순만     (13칸에 13판)', { bean: [], musun: seatsOf(ALL, 13) }]
  ];
  const rows = [];
  for (const [ko, plan] of PLANS) {
    const r = live(plan, { keepMeal: true });
    rows.push([ko, dayKo(r.brokeDay), won(r.ate), won(r.sold), won(r.seedSpent),
               won(r.ate + r.sold - r.seedSpent), formatGram(r.ateG), formatGram(r.soldG)]);
  }
  table(['배치', '파산일', '밥값 절감', '판 돈', '씨앗값', '★순이득', '먹은 g', '판 g'], rows);
}

console.log('★ 읽는 법 — ㉠ 이 나머지보다 오래 버티면 「빛 분포를 읽어야 나오는 답」이 참이다.');
console.log('  ㉠ 과 ㉢ 의 차이가 곧 **자리를 고른 값어치**다.\n');

/* ══ ④ ★★ 띄엄으로 돌리는 것과 몰아서 돌리는 것 ═══════════════════════════════
   「몫」이 하루 단위라, 한꺼번에 거두면 그날 몫을 넘긴 몫이 **밥이 아니라 팔 것**이 된다.
   ⇒ 겹침의 벌을 걷으면서 얕아졌던 「짜임새를 산다」가 **여기서 다시 깊어졌는지**를 잰다. */
console.log('═'.repeat(78));
console.log('★★ ④ 띄엄으로 돌리기 vs 몰아서 돌리기 — 「짜임새」가 아직 값이 되나');
console.log('═'.repeat(78));
console.log('  ⚠ 자리·개수·파는 방식이 다 같다. 갈리는 것은 **물을 언제 주나** 하나다.\n');
{
  const rows = [];
  for (const [n, t] of [[5, 0], [9, 4], [12, 4], [16, 4]]) {
    const plan = { bean: seatsOf(DARK, n), musun: seatsOf(BRIGHT, t) };
    const a = live(plan, { keepMeal: true });
    const b = live(plan, { keepMeal: true, burst: true });
    rows.push([`시루 ${n} · 판 ${t}`, dayKo(a.brokeDay), dayKo(b.brokeDay),
               won(a.ate), won(b.ate), won(a.sold), won(b.sold),
               won(a.ate + a.sold - a.seedSpent), won(b.ate + b.sold - b.seedSpent)]);
  }
  table(['배치', '파산(띄엄)', '파산(몰아)', '밥값(띄엄)', '밥값(몰아)',
         '판 돈(띄엄)', '판 돈(몰아)', '순이득(띄엄)', '순이득(몰아)'], rows);
}

