/* ============================================================
   tools/probe_crop_cases.mjs — 경우별 살림을 **나란히** 놓고 날짜로 비교한다
   ------------------------------------------------------------
   박사님: "시루 1개/2개/3개, 1개이다가 더 사는 경우(물 준 경우·띄엄띄엄),
            1개 + 다른 종류 추가(물 준 경우·띄엄띄엄) —
            일별로 어떻게 변화하는지(원래식비/저감식비/나간식비/자산) 표로.
            근데 케이스별로 날짜에 따른 변화를 **바로 비교 가능하게** 해줘."

   ★그래서 경우마다 표를 따로 내지 않는다. **가로가 경우, 세로가 날짜**다.
     같은 날 줄에서 옆으로 훑으면 어느 쪽이 나은지가 바로 보인다.

   ★실제 first_play.js 를 loop.nextDay 와 **같은 순서**로 돌린다.
     (자라는 날에도 곳간은 매일 꺼내 먹는다 — 이 순서를 틀리면 답이 통째로 달라진다.
      실제로 한 번 틀렸다: 곳간을 안 먹였더니 시루 6개나 1개나 같은 값이 나왔다.)

     node tools/probe_crop_cases.mjs [--days 30]
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
const DAYS = +(argv[argv.indexOf('--days') + 1] || 0) || 30;
const RULES = FP.firstPlayRulesFromBalance(
  JSON.parse(readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8')));

const DARK = 0.05;                 // 어두운 자리 — 품질 최상
const START_CASH = 1_000_000;      // tutorial.js startCashWon
/* ★ 지갑에서 실제로 나가는 값은 **상점 사는 값**이다 (2026-08-04) — 재파종은 미리 주문해 둔
   재고를 쓰고, 돈은 주문할 때 나간다. `rules.seedWonPerSiru` 는 정가(표시용)라
   그걸로 재면 살림이 실제보다 싸게 나온다. */
const SEED = buyPriceOf('bean_seed');

/* 있으면 쓴다 — 수확이 손 동작이 되기 전/후 양쪽에서 이 자가 돈다 */
const hasHarvestAction = typeof FP.harvestBeansprout === 'function';
const hasWater = typeof FP.waterBeansprout === 'function';

/* ── 경우 정의 ─────────────────────────────────────────────
   sirusAt(day)  그날 가지고 있는 시루 수 (늘려 사는 경우를 표현)
   waters(day)   그날 물을 주나
   kinds         지금 도는 작물 종류 수 (2종째는 아직 작물이 없다 — 아래 주석) */
const CASES = [
  { id: '1개',        sirus: () => 1,                     water: () => true },
  { id: '2개',        sirus: () => 2,                     water: () => true },
  { id: '3개',        sirus: () => 3,                     water: () => true },
  { id: '늘려가기',    sirus: d => (d < 8 ? 1 : d < 16 ? 2 : 3), water: () => true },
  { id: '늘려·띄엄',   sirus: d => (d < 8 ? 1 : d < 16 ? 2 : 3), water: d => d % 2 === 1 },
  { id: '1개·띄엄',    sirus: () => 1,                     water: d => d % 2 === 1 }
];

function run(cs) {
  const fp = FP.createFirstPlayState({ enabled: true, rules: RULES });
  FP.placeBeansprout(fp, 'dark');
  let cash = START_CASH, spentSeed = 0, sirusNow = 0;
  const rows = [];
  for (let day = 1; day <= DAYS; day++) {
    /* ① 시루를 더 샀나 — 늘어난 만큼 씨앗값이 나간다 */
    const want = cs.sirus(day);
    if (want > sirusNow) {
      const add = want - sirusNow;
      spentSeed += add * SEED; cash -= add * SEED;
      fp.beansprout.sirus = want;
      sirusNow = want;
    }
    /* ② 물 — 준 날만 자란다 */
    const watered = cs.water(day);
    if (watered) { try { FP.waterBeansprout(fp, day); } catch { } }

    /* ③ 하루 — loop.nextDay 와 같은 순서 */
    let ev = null, saved = 0, state = '';
    if (!fp.beansprout.harvested) {
      /* ⚠ 하루는 `{watered}` 를 받는다. 날짜가 아니다 —
         물주기는 waterBeansprout 이 따로 적고, 하루는 "오늘 줬나"만 본다. */
      ev = FP.advanceBeansproutDay(fp, DARK, { watered });
      state = `자람 ${fp.beansprout.ageDays}/${fp.beansprout.harvestDays}`;
    }
    /* ④ ★거두기는 손 동작이다. 이 자는 "부지런한 사람"을 재므로 되는 날 바로 거둔다 —
       미루는 경우는 그 자체가 따로 재야 할 경우다. */
    /* ⚠ 거두는 것과 **먹는 것은 다른 일**이고, **순서가 계약이다** (2026-08-04 고침).
       화면에서 플레이어는 [다음 날]을 누르고(그 안에서 곳간이 한 번 열린다) 그다음에
       [수확하기]를 누른다. 그래서 곳간이 **먼저**다 — 뒤집으면 거둔 날에 새 곳간을 바로
       열어 하루 상한이 그 자리에서 깨지고, 회전마다 하루치가 공짜로 더 나온다.
       (예전에는 `h.foodSavedWon`(없는 칸)을 읽어 곳간을 아예 안 열었다 — 30일에 3,000원이 사라졌다.) */
    saved = FP.eatFromPantry(fp).foodSavedWon || 0;
    if (FP.beansproutReady(fp.beansprout)) {
      FP.harvestBeansprout(fp);
      state = '거둠';
    }
    /* ⑤ 다 거뒀으면 바로 다시 심는다 — 씨앗값이 또 나간다 */
    if (fp.beansprout.harvested) {
      spentSeed += sirusNow * SEED; cash -= sirusNow * SEED;
      FP.resowBeansprout(fp, { sirus: sirusNow });
      state = '거둠 → 다시 심음';
    }
    const out = RULES.dailyFoodWon - saved;
    cash -= out;
    rows.push({ day, watered, sirus: sirusNow, state, saved, out, cash });
  }
  return { rows, spentSeed };
}

const runs = CASES.map(c => ({ ...c, ...run(c) }));
const won = n => Math.round(n).toLocaleString('ko-KR');

console.log(`\n규칙 — 자라는 날 ${RULES.harvestDays}일 · 하루 식비 ${won(RULES.dailyFoodWon)}원 · ` +
            `씨앗 ${won(SEED)}원/시루(사는 값) · 회전당 절감 ${won(RULES.cropKindSavedWon?.[0] ?? 0)}원`);
console.log(`수확 손 동작: ${hasHarvestAction ? '있음' : '없음(자동)'} · 물주기: ${hasWater ? '있음' : '없음'}\n`);

const head = (t) => {
  console.log(`\n── ${t} ` + '─'.repeat(Math.max(0, 60 - t.length)));
  console.log('Day │ ' + CASES.map(c => c.id.padStart(9)).join(' │ '));
  console.log('────┼─' + CASES.map(() => '─'.repeat(9)).join('─┼─'));
};
const table = (title, pick) => {
  head(title);
  for (let i = 0; i < DAYS; i++)
    console.log(String(runs[0].rows[i].day).padStart(3) + ' │ ' +
      runs.map(r => String(pick(r.rows[i])).padStart(9)).join(' │ '));
};

table('그날 저감액 (원)', r => (r.saved ? won(r.saved) : '·'));
table('그날 나간 식비 (원)', r => won(r.out));
table('보유금 (원) — 시작 100만, 씨앗값 포함', r => won(r.cash));

console.log('\n── 합계 ' + '─'.repeat(54));
console.log('     │ ' + CASES.map(c => c.id.padStart(9)).join(' │ '));
for (const [label, f] of [
  ['총저감', r => won(r.rows.reduce((a, x) => a + x.saved, 0))],
  ['씨앗값', r => '-' + won(r.spentSeed)],
  ['순이득', r => won(r.rows.reduce((a, x) => a + x.saved, 0) - r.spentSeed)],
  ['하루평균', r => won((r.rows.reduce((a, x) => a + x.saved, 0) - r.spentSeed) / DAYS)],
  ['끝 보유금', r => won(r.rows[DAYS - 1].cash)]
]) console.log(label.padEnd(4) + ' │ ' + runs.map(r => String(f(r)).padStart(9)).join(' │ '));

console.log(`\n⚠ 2종째 작물(+2,000원)은 아직 **작물 자체가 없다.** 규칙상 자리만 있어서`);
console.log(`  여기서는 안 돌린다 — 없는 것을 있는 것처럼 표에 적으면 안 된다.`);
console.log(`  작물이 생기면 이 자에 경우를 한 줄 더해 같은 표에서 바로 비교된다.\n`);
