/* ============================================================
   tools/probe_crop_cases.mjs — 경우별 살림을 **나란히** 놓고 날짜로 비교한다
   ------------------------------------------------------------
   박사님: "시루 1개/2개/3개, 1개이다가 더 사는 경우 — 일별로 어떻게 변화하는지 표로.
            케이스별로 날짜에 따른 변화를 **바로 비교 가능하게** 해줘."

   ★★ 2026-08-04 새 규칙으로 다시 짰다 (first_play.js §물주기 · §겹침).
     물은 **회전 시작**이다 — 심고 물을 줘야 그날이 0일차이고 5일 뒤에 거둔다.

       **`3개·같은날` vs `3개·시차` 가 핵심 대조다.**
       둘은 시루값·씨앗값이 같다. 다른 것은 **물을 언제 주느냐** 하나뿐이다.
       ★시차를 만든 쪽이 순이득에서 이겨야 한다 — 안 이기면 이 설계가 안 선 것이다.

   ★★ 2026-08-05 — **2종째(무순)가 들어왔다.** 이 자가 재는 것이 하나 더 늘었다:

       **`콩5` vs `콩5+무순N` 이 새 핵심 대조다.**
       종류를 늘리는 것이 실제로 값이 있나 · 끼니 상한이 먼저 잘라 버리지는 않나.
       ★ 그리고 **3종째는 여기서 안 돌린다** — 자취생은 끼니 상한(5,000원)에 막혀
         하루 저감이 한 푼도 안 는다. 그건 시뮬이 아니라 산수라 아래 §상한 이 바로 보여 준다.

   ★실제 first_play.js 를 loop.nextDay 와 **같은 순서**로 돌린다.
     (자라는 날에도 곳간은 매일 꺼내 먹는다 — 이 순서를 틀리면 답이 통째로 달라진다.)

     node tools/probe_crop_cases.mjs [--days 60] [--daily] [--slots]
============================================================ */
import { readFileSync } from 'node:fs';
import * as FP from '../src/game/first_play.js';
import { buyPriceOf } from '../src/game/shop.js';

/* ★자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다. */
const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한을 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const argv = process.argv.slice(2);
const DAYS = +(argv[argv.indexOf('--days') + 1] || 0) || 60;
const RULES = FP.firstPlayRulesFromBalance(
  JSON.parse(readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8')));

/* ── 자리의 빛 — **반지하 실측값**이다 (room_profile.banjiha.json · 맑음/여름/등 0개) ──
   ★ 지어낸 숫자가 아니다. `--slots` 로 그 표를 그대로 찍는다.
     DARK   banjiha-dresser:1 = 0.04  — 가장 어두운 자리(콩나물 최상)
     SHELF  banjiha-etagere:6 = 0.40  — 등 없이 창턱 말고 가장 밝은 자리
     SILL   banjiha-sill:0    = 3.77  — 창턱. **몬스테라가 여기 있어야 산다**(아래 §자리 경쟁)
     LAMP   banjiha-etagere:4 = 2.22  — 식물등 1개를 켰을 때 열리는 자리 */
const DARK = 0.04;
const SHELF = 0.40;
const SILL = 3.77;
const LAMP_SHELF = 2.22;

const START_CASH = 1_000_000;      // tutorial.js startCashWon
/* ★ 지갑에서 실제로 나가는 값은 **상점 사는 값**이다 — 재파종은 미리 주문해 둔 재고를 쓰고,
   돈은 주문할 때 나간다. `seedWonPerPot` 는 정가(표시용)라 그걸로 재면 살림이 싸게 나온다. */
const PRICE = {
  beansprout: { seed: buyPriceOf('bean_seed'), box: buyPriceOf('siru') },
  musun: { seed: buyPriceOf('radish_seed'), box: buyPriceOf('sprout_tray') }
};
/* ★시루는 **소모품이 아니다.** 한 번 사면 계속 쓴다 — 매 회전 드는 것은 씨앗뿐이다.
   ★ **첫 시루는 처음에 받은 것이라 안 센다** (state.resowCrop 의 `sirusAdded` 규약과 같다).
     ⚠ 무순 재배판은 **첫 판부터 산다** — 게임이 주는 것은 콩나물 시루 하나뿐이다. */
const FREE_BOXES = { beansprout: 1, musun: 0 };

/* ── 경우 정의 ─────────────────────────────────────────────
   plan[종류] = { count 용기 수 · stagger 물 주는 간격(일) · dli 그 자리의 빛 }
     stagger 0 = 같은 날 전부 시작   ★이것이 **플레이어의 손**이다. 규칙이 주는 것이 아니다.
   ⚠ count 0 이면 그 작물은 아예 안 기른다(자리도 안 놓는다). */
const CASES = [
  { id: '콩1',        plan: { beansprout: { count: 1, stagger: 0, dli: DARK } } },
  { id: '콩5·같은날',  plan: { beansprout: { count: 5, stagger: 0, dli: DARK } } },
  { id: '콩5·시차',    plan: { beansprout: { count: 5, stagger: 1, dli: DARK } } },
  { id: '콩6·시차',    plan: { beansprout: { count: 6, stagger: 1, dli: DARK } } },
  /* ★ 2종째 — 무순을 **등 없이 선반(0.40)** 에 둔다. 창턱은 몬스테라 몫이라 못 쓴다(§자리 경쟁).
     그래서 품질이 2끼(=회전당 1,333원)로 깎인다 — 그게 등을 사기 전의 정직한 값이다. */
  { id: '콩5+무3선반', plan: { beansprout: { count: 5, stagger: 1, dli: DARK },
                               musun: { count: 3, stagger: 1, dli: SHELF } } },
  { id: '콩5+무7선반', plan: { beansprout: { count: 5, stagger: 1, dli: DARK },
                               musun: { count: 7, stagger: 1, dli: SHELF } } },
  /* ★ 식물등(2.5만원)을 사면 선반이 2.22 로 올라 무순이 3끼(2,000원)가 된다.
     ⚠ 등값·전기값은 이 표에 안 넣는다 — 그 둘은 몬스테라 몫으로 이미 나가는 돈이라
       무순 앞으로 달면 이중으로 세는 것이 된다. **빛만 달라진 판**으로 읽어야 맞다. */
  { id: '콩5+무7등',   plan: { beansprout: { count: 5, stagger: 1, dli: DARK },
                               musun: { count: 7, stagger: 1, dli: LAMP_SHELF } } },
  /* ★ 창턱을 무순에게 준 판. **몬스테라를 밀어낸 값**은 여기 안 나온다(§자리 경쟁 참고) */
  { id: '콩5+무7창턱', plan: { beansprout: { count: 5, stagger: 1, dli: DARK },
                               musun: { count: 7, stagger: 1, dli: SILL } } },
  /* ★ 같은 날 몰아 주면 어떻게 깎이나 — 2종에서도 시차가 이겨야 한다 */
  { id: '콩5+무7같은날', plan: { beansprout: { count: 5, stagger: 0, dli: DARK },
                                 musun: { count: 7, stagger: 0, dli: LAMP_SHELF } } }
];

/* 한 판을 돈다. 화면에서 플레이어가 밟는 순서를 그대로 밟는다:
     [물 주기](종류마다 대기 하나) → [다음 날] → (곳간에서 오늘 몫) → [수확하기] → [다시 심기]
   ⚠ 거두기·다시 심기·물 주기가 **같은 날에 다 일어날 수 있다** — 화면에서도 그렇다.
     그래서 회전이 주기 그대로 돈다(하루 쉬지 않는다). */
function run(cs) {
  const fp = FP.createFirstPlayState({ enabled: true, rules: RULES });
  const kinds = Object.keys(cs.plan).filter(k => cs.plan[k].count > 0);
  const dliMap = {};
  let cash = START_CASH, spentSeed = 0, spentBox = 0;

  for (const kindId of kinds) {
    const p = cs.plan[kindId];
    FP.placeCrop(fp, kindId, `slot-${kindId}`);
    dliMap[kindId] = p.dli;
    const site = FP.cropSiteOf(fp, kindId);
    /* 용기를 사 둔다 — 콩나물 첫 시루만 받은 것이라 안 센다. 용기값은 **한 번만** 나간다. */
    const add = p.count - (site.pots || []).length;
    const paid = Math.max(0, p.count - FREE_BOXES[kindId]);
    spentBox += paid * PRICE[kindId].box; cash -= paid * PRICE[kindId].box;
    for (let i = 0; i < add; i++)
      site.pots.push(FP.makeCropPot(`${FP.CROP_SITE_IDS[kindId]}_${String(i + 2).padStart(2, '0')}`));
    FP.syncCropLead(site);
  }

  /* 마지막으로 물을 준 날 — 종류마다 따로 센다. 시차 간격이 차면 다음 용기를 시작한다 */
  const lastWater = {};
  for (const k of kinds) lastWater[k] = -99;
  const rows = [];
  for (let day = 1; day <= DAYS; day++) {
    /* ① [물 주기] — 종류마다, 대기가 있고 시차 간격이 찼으면 **하나**를 시작한다.
       ★ stagger 0 이면 그날 대기를 전부 시작한다(= [전부 주기]). */
    for (const kindId of kinds) {
      const p = cs.plan[kindId];
      const st = FP.beansproutWaterStatus(fp, day).byKind.find(x => x.kind === kindId);
      if (st && st.waiting > 0 && (day - lastWater[kindId]) >= Math.max(1, p.stagger)) {
        FP.waterBeansprout(fp, day, { kind: kindId, all: p.stagger === 0 });
        lastWater[kindId] = day;
      }
    }

    /* ② [다음 날] — 시작한 것만 나이를 먹는다. DLI 는 **자리마다** 다르다(2종이 그래서 있다) */
    FP.advanceBeansproutDay(fp, dliMap);

    /* ③ 곳간에서 오늘 몫. **거두기보다 먼저**다 — 화면에서 [다음 날] 안에 일어난다.
       뒤집으면 거둔 날에 새 곳간을 바로 열어 하루 상한이 그 자리에서 깨진다. */
    const saved = FP.eatFromPantry(fp).foodSavedWon || 0;

    /* ④ [수확하기] — 익은 것을 종류 가리지 않고 한 번에 거둔다 */
    let state = '', got = 0, lost = 0;
    if (FP.beansproutReady(fp)) {
      const h = FP.harvestBeansprout(fp, { day });
      got = h.cycleSavedWon; lost = h.overlapLostWon;
      state = (h.byKind || []).map(g => `${g.kindKo[0]}${g.pots}`).join('+');
    }
    /* ⑤ [다시 심기] — 거둔 것만. 씨앗값이 그만큼 나간다. **물은 안 준다**(다음 턴에 준다) */
    for (const kindId of kinds) {
      const site = FP.cropSiteOf(fp, kindId);
      const ripe = site.pots.filter(p => p.harvested).length;
      if (!ripe) continue;
      spentSeed += ripe * PRICE[kindId].seed; cash -= ripe * PRICE[kindId].seed;
      FP.resowBeansprout(fp, { kind: kindId, day });
      /* ★ 같은 날 바로 물을 줄 수 있다 — 시차 판은 간격을 지키느라 미룬다 */
      if (cs.plan[kindId].stagger === 0) {
        FP.waterBeansprout(fp, day, { kind: kindId, all: true });
        lastWater[kindId] = day;
      }
    }
    const out = RULES.dailyFoodWon - saved;
    cash -= out;
    rows.push({ day, state, saved, got, lost, out, cash });
  }
  return { rows, spentSeed, spentBox };
}

const runs = CASES.map(c => ({ ...c, ...run(c) }));
const won = n => Math.round(n).toLocaleString('ko-KR');
const sum = (r, k) => r.rows.reduce((a, x) => a + x[k], 0);
const net = r => sum(r, 'saved') - r.spentSeed - r.spentBox;

console.log(`\n규칙 — 하루 식비 ${won(RULES.dailyFoodWon)}원 · 하루 곳간 상한 ` +
            `${won(RULES.dailyCropSaveWon)}원 (끼니 상한 ${won(RULES.cropMealCapWon)}원)`);
for (const k of FP.CROP_KINDS)
  console.log(`  ${k.ko.padEnd(4)} 주기 ${k.harvestDays}일 · 회전당 ` +
    `${won(RULES.cropKindSavedWon[FP.cropKindIndexOf(k.id)])}원(최상) · ` +
    `씨앗 ${won(PRICE[k.id].seed)}원 · ${k.containerKo} ${won(PRICE[k.id].box)}원 · ` +
    `${k.wantsLight ? '밝아야 좋다' : '어두워야 좋다'}`);
console.log(`물 = **회전 시작**(회전당 한 번) · 같은 종류가 같은 날 겹치면 ` +
            `${RULES.cropKindSavedWon.join(' → ')}원\n`);

const head = (t) => {
  console.log(`\n── ${t} ` + '─'.repeat(Math.max(0, 74 - t.length)));
  console.log('Day │ ' + CASES.map(c => c.id.padStart(11)).join(' │ '));
  console.log('────┼─' + CASES.map(() => '─'.repeat(11)).join('─┼─'));
};
const table = (title, pick) => {
  head(title);
  for (let i = 0; i < DAYS; i++)
    console.log(String(runs[0].rows[i].day).padStart(3) + ' │ ' +
      runs.map(r => String(pick(r.rows[i])).padStart(11)).join(' │ '));
};

if (argv.includes('--daily')) {
  table('그날 저감액 (원)', r => (r.saved ? won(r.saved) : '·'));
  table('그날 거둔 값 (원) — 괄호는 겹쳐서 못 받은 몫', r =>
    r.got ? won(r.got) + (r.lost ? `(-${won(r.lost)})` : '') : '·');
  table('보유금 (원) — 시작 100만', r => won(r.cash));
}

console.log('\n── 합계 ' + '─'.repeat(70));
console.log('     │ ' + CASES.map(c => c.id.padStart(11)).join(' │ '));
for (const [label, f] of [
  ['총저감', r => won(sum(r, 'saved'))],
  ['겹쳐손실', r => (sum(r, 'lost') ? '-' + won(sum(r, 'lost')) : '·')],
  ['씨앗값', r => '-' + won(r.spentSeed)],
  ['용기값', r => (r.spentBox ? '-' + won(r.spentBox) : '·')],
  ['순이득', r => won(net(r))],
  ['하루평균', r => won(net(r) / DAYS)],
  ['끝 보유금', r => won(r.rows[DAYS - 1].cash)]
]) console.log(label.padEnd(4) + ' │ ' + runs.map(r => String(f(r)).padStart(11)).join(' │ '));

/* ★★ 성적표 — 이 자가 존재하는 이유다. 사람이 표를 읽고 판단하지 않게 **자가 판정한다.** */
const by = id => runs.find(r => r.id === id);
const one = by('콩1'), same5 = by('콩5·같은날'), full = by('콩5·시차'), over = by('콩6·시차');
const mix3 = by('콩5+무3선반'), mix7 = by('콩5+무7선반');
const mixLamp = by('콩5+무7등'), mixSame = by('콩5+무7같은날');
console.log(`\n── 성적표 (${DAYS}일) ` + '─'.repeat(60));
const line = (ok, s) => console.log(`${ok ? '✅' : '❌'} ${s}`);
/* ★★ 박사님 그림 그대로 — 5일 주기 · 시루 5개 · 하루씩 걸러 물 = **매일 3,000원** */
const cycleWon = RULES.cropKindSavedWon[0];
const settled = full.rows.slice(RULES.harvestDays + 5);   // 회전이 다 자리잡은 뒤
const everyDayFull = settled.length > 0 && settled.every(r => r.saved === cycleWon);
line(everyDayFull,
  `완전 시차 = 매일 ${won(cycleWon)}원 : 자리잡은 뒤 ` +
  `Day ${settled.length ? settled[0].day : '-'}~${DAYS} 하루 저감 = ` +
  `${[...new Set(settled.map(r => won(r.saved)))].join(' / ')}원`);
line(sum(full, 'lost') === 0,
  `완전 시차는 안 겹친다 : 겹쳐서 못 받은 몫 ${won(sum(full, 'lost'))}원`);
line(net(full) > net(same5),
  `시차 > 같은날 : 콩5·시차 ${won(net(full))}원 vs 콩5·같은날 ${won(net(same5))}원 ` +
  `(차이 ${won(net(full) - net(same5))}원)`);
line(net(full) > net(one),
  `시차 > 1개    : 콩5·시차 ${won(net(full))}원 vs 콩1 ${won(net(one))}원 ` +
  `(차이 ${won(net(full) - net(one))}원)`);
line(sum(over, 'saved') <= sum(full, 'saved') && net(over) < net(full),
  `천장이 주기에서 나온다 : 콩6·시차 총저감 ${won(sum(over, 'saved'))}원 = ` +
  `콩5·시차 ${won(sum(full, 'saved'))}원 (안 는다) · 순이득은 ` +
  `${won(net(over))}원 < ${won(net(full))}원 (돈만 더 나간다)`);

/* ── ★★ 2종째가 실제로 값이 있나 ───────────────────────────── */
console.log('');
line(net(mixLamp) > net(full),
  `2종이 1종보다 낫다(등 있는 자리) : 콩5+무7등 ${won(net(mixLamp))}원 vs ` +
  `콩5만 ${won(net(full))}원 (차이 ${won(net(mixLamp) - net(full))}원)`);
line(net(mix7) > net(full),
  `2종이 1종보다 낫다(등 없이 선반) : 콩5+무7선반 ${won(net(mix7))}원 vs ` +
  `콩5만 ${won(net(full))}원 (차이 ${won(net(mix7) - net(full))}원)`);
line(net(mixLamp) > net(mixSame),
  `2종에서도 시차가 이긴다 : 시차 ${won(net(mixLamp))}원 vs 같은날 ${won(net(mixSame))}원 ` +
  `(차이 ${won(net(mixLamp) - net(mixSame))}원)`);
line(net(mixLamp) > net(mix7),
  `빛이 값이다 : 같은 판 수인데 등 있는 자리 ${won(net(mixLamp))}원 vs 선반 ${won(net(mix7))}원 ` +
  `(차이 ${won(net(mixLamp) - net(mix7))}원 — 자리 하나가 이만큼이다)`);
/* 용기값 회수 — 무순은 첫 판부터 사야 하므로 **투자 회수일**이 곧 "들일 만한가"의 답이다 */
for (const [label, r] of [['콩5·시차', full], ['콩5+무7등', mixLamp], ['콩5+무7선반', mix7]]) {
  const flip = r.rows.findIndex((x, i) => x.cash > one.rows[i].cash);
  console.log(`ℹ 용기값 회수 : ${label.padEnd(11)} 가 콩1 을 앞지르는 날 = ` +
    (flip < 0 ? `${DAYS}일 안에는 없음` : `Day ${r.rows[flip].day}`));
}

/* ── ★★ 끼니 상한 (보고 ⑤) — **3종을 안 넣은 이유가 여기 있다** ───────────── */
console.log(`\n── 끼니 상한 ` + '─'.repeat(66));
const capWon = RULES.cropMealCapWon;
let acc = 0;
for (let i = 0; i < RULES.cropKindSavedWon.length; i++) {
  acc += RULES.cropKindSavedWon[i];
  const eff = Math.min(acc, capWon);
  const kindKo = FP.CROP_KINDS[i] ? FP.CROP_KINDS[i].ko : '(3종째 · 아직 없음)';
  console.log(`  ${i + 1}종까지(${kindKo}) : 한 회전 합계 ${won(acc)}원 → ` +
    `하루 저감 상한 ${won(eff)}원` +
    (acc > capWon ? `  ⛔ 상한이 이긴다 — ${won(acc - capWon)}원이 버려진다` : ''));
}
console.log(`  ⇒ 자취생(1인)은 **2종에서 정확히 상한에 닿는다**(${won(capWon)}원). ` +
            `3종째는 하루 저감을 한 푼도 못 늘린다.`);
console.log(`  ⇒ 상한의 정본은 characters.json._meta.cropMealCapPerPerson(2끼) 이고 **1인당**이다 —`);
console.log(`     가장·주부(식구 4)는 상한이 ${won(capWon * 4)}원이라 3종째가 그대로 산다.`);
console.log(`     그래서 표의 1,000원 자리를 지우지 않았다.`);
console.log(`  지금 상한에 걸려 있나: ${RULES.cropCapBinding ? '⛔ 예' : '아니오(딱 맞다)'}`);

/* ── ★★ 자리 경쟁 (보고 ④) — 실측 DLI 로 판정한다 ───────────────── */
if (argv.includes('--slots') || true) {
  const TH = JSON.parse(readFileSync(
    new URL('../data/balance/light_thresholds.json', import.meta.url), 'utf8'));
  const M = TH.plants.monstera_deliciosa;
  console.log(`\n── 자리 경쟁 (반지하 · 맑음/여름 실측) ` + '─'.repeat(40));
  console.log(`   몬스테라 밴드 — 고사 ${M.die} 미만 · 쇠약 ~${M.survive} · 정체 ~${M.min} · ` +
              `최적 ${M.best_lo}~${M.best_hi} · 갈라짐 ${M.fenestrate} 이상`);
  const SLOTS = [
    ['banjiha-sill:0', 3.77, 5.61], ['banjiha-desk:0', 0.48, 0.97],
    ['banjiha-etagere:6', 0.40, 5.87], ['banjiha-etagere:7', 0.38, 12.20],
    ['banjiha-etagere:4', 0.18, 2.22], ['banjiha-dresser:1', 0.04, 0.09]
  ];
  const monVerdict = d => d < M.die ? '고사' : d < M.survive ? '쇠약' : d < M.min ? '정체'
    : d < M.best_lo ? '느린성장' : d <= M.best_hi ? '최적' : d <= M.max ? '성장' : '과광';
  console.log('   자리                 등0     등1  │ 콩나물(등0/등1)   무순(등0/등1)   몬스테라(등0/등1)');
  for (const [id, d0, d1] of SLOTS) {
    const q = (kind, d) => `${FP.cropQualityOf(kind, d).meals}끼`;
    console.log(`   ${id.padEnd(19)}${String(d0).padStart(5)}  ${String(d1).padStart(6)}  │ ` +
      `${q('beansprout', d0)}/${q('beansprout', d1)}`.padEnd(17) +
      `${q('musun', d0)}/${q('musun', d1)}`.padEnd(15) +
      `${monVerdict(d0)}/${monVerdict(d1)}`);
  }
  console.log(`   ⇒ ★**등이 없으면 창턱 하나뿐이다.** DLI 1.0 을 넘는 자리가 sill:0(3.77) 하나이고,`);
  console.log(`      나머지는 전부 ${M.die}(고사선) 아래다 — 몬스테라가 갈 데가 없다.`);
  console.log(`      무순에게 창턱을 주면 몬스테라는 **늦어지는 게 아니라 죽는다.**`);
  console.log(`   ⇒ ★식물등(2.5만원)을 사면 etagere 가 2.22~12.20 으로 올라 **둘 다 산다.**`);
  console.log(`      오히려 등을 켠 선반 꼭대기(12.20)가 창턱(5.61)보다 밝고, 갈라짐선(${M.fenestrate})을`);
  console.log(`      창턱은 못 넘는다 — 등을 산 판에서는 **몬스테라가 선반으로 가는 게 낫다.**`);
  console.log(`   ⇒ 그래서 이 경쟁의 답은 "누가 이기나"가 아니라 **"등을 언제 사나"** 다.`);
  console.log(`      지금까지 식물등의 이유는 몬스테라뿐이었다. 이제 식비에도 이유가 생겼다.`);
  console.log(`   ⚠ **안 맞춘 것** — 에셋 정본의 새싹 재배판이 0.36×0.24m 라 창턱(maxPotD 0.21)·`);
  console.log(`      선반(0.25)의 **추천 자리에는 안 올라간다.** 올라가는 곳 중 가장 밝은 것이`);
  console.log(`      desk:0(0.48 → 2끼)이고 등을 켜도 0.97 이라 3끼 문턱(1.0)을 못 넘는다.`);
  console.log(`      ⇒ 지금 코드는 안 막는다(placeCrop 이 maxPotD 를 안 본다 — 자유 좌표로 놓인다).`);
  console.log(`        고칠지 말지는 기획 판단이라 억지로 안 맞췄다. docs/food_economy.md §10.7`);
}

console.log(`\n  일별 표는 \`--daily\` 로 본다.\n`);
