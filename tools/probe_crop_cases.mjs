/* ============================================================
   tools/probe_crop_cases.mjs — 경우별 살림을 **나란히** 놓고 날짜로 비교한다
   ------------------------------------------------------------
   박사님: "시루 1개/2개/3개, 1개이다가 더 사는 경우 — 일별로 어떻게 변화하는지 표로.
            케이스별로 날짜에 따른 변화를 **바로 비교 가능하게** 해줘."

   ★★ 2026-08-04 새 규칙으로 다시 짰다 (first_play.js §물주기 · §겹침).
     물은 **회전 시작**이다 — 심고 물을 줘야 그날이 0일차이고 5일 뒤에 거둔다.
     그래서 이 자가 재는 것이 바뀌었다:

       **`3개·같은날` vs `3개·시차` 가 핵심 대조다.**
       둘은 시루값·씨앗값이 같다. 다른 것은 **물을 언제 주느냐** 하나뿐이다.
       ★시차를 만든 쪽이 순이득에서 이겨야 한다 — 안 이기면 이 설계가 안 선 것이다.

   ★실제 first_play.js 를 loop.nextDay 와 **같은 순서**로 돌린다.
     (자라는 날에도 곳간은 매일 꺼내 먹는다 — 이 순서를 틀리면 답이 통째로 달라진다.)

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
/* ★ 지갑에서 실제로 나가는 값은 **상점 사는 값**이다 — 재파종은 미리 주문해 둔 재고를 쓰고,
   돈은 주문할 때 나간다. `rules.seedWonPerSiru` 는 정가(표시용)라 그걸로 재면 살림이 싸게 나온다. */
const SEED = buyPriceOf('bean_seed');
/* ★시루는 **소모품이 아니다.** 한 번 사면 계속 쓴다 — 매 회전 드는 것은 씨앗뿐이다.
   ★ **첫 시루는 처음에 받은 것이라 안 센다** (state.resowCrop 의 `sirusAdded` 규약과 같다).
     예전에 이 자가 1개짜리 판에도 7,000원을 물렸는데, 그건 게임에서 실제로 안 나가는 돈이다. */
const SIRU = buyPriceOf('siru');

/* ── 경우 정의 ─────────────────────────────────────────────
   sirus     이 판이 굴리는 시루 수
   stagger   시루 사이의 물 주는 간격(일). 0 = 같은 날 전부 시작
             ★이것이 **플레이어의 손**이다. 규칙이 주는 것이 아니다. */
const CASES = [
  { id: '1개',       sirus: 1, stagger: 0 },
  { id: '3개·같은날', sirus: 3, stagger: 0 },
  { id: '3개·시차',   sirus: 3, stagger: 1 },
  { id: '5개·같은날', sirus: 5, stagger: 0 },
  { id: '5개·시차',   sirus: 5, stagger: 1 },
  { id: '6개·시차',   sirus: 6, stagger: 1 }
];

/* 한 판을 돈다. 화면에서 플레이어가 밟는 순서를 그대로 밟는다:
     [물 주기](대기 시루 하나) → [다음 날] → (곳간에서 오늘 몫) → [수확하기] → [다시 심기]
   ⚠ 거두기·다시 심기·물 주기가 **같은 날에 다 일어날 수 있다** — 화면에서도 그렇다.
     그래서 회전이 5일 그대로 돈다(하루 쉬지 않는다). */
function run(cs) {
  const fp = FP.createFirstPlayState({ enabled: true, rules: RULES });
  FP.placeBeansprout(fp, 'dark');
  let cash = START_CASH, spentSeed = 0, spentSiru = 0;

  /* 시루를 사 둔다 — 첫 시루는 받은 것이라 안 센다. 용기값은 **한 번만** 나간다. */
  const add = cs.sirus - 1;
  if (add > 0) {
    spentSiru += add * SIRU; cash -= add * SIRU;
    for (let i = 0; i < add; i++)
      fp.beansprout.pots.push(FP.makeCropPot(`crop_01_0${i + 2}`));
    FP.syncCropLead(fp.beansprout);
  }

  /* 마지막으로 물을 준 날 — 시차를 지키려고 센다. `stagger` 만큼 벌어지면 다음 시루를 시작한다 */
  let lastWaterDay = -99;
  const rows = [];
  for (let day = 1; day <= DAYS; day++) {
    /* ① [물 주기] — 대기 중인 시루가 있고, 시차 간격이 찼으면 **하나**를 시작한다.
       ★ stagger 0 이면 그날 대기를 전부 시작한다(= [전부 주기]). */
    const st = FP.beansproutWaterStatus(fp, day);
    if (st && st.waiting > 0 && (day - lastWaterDay) >= Math.max(1, cs.stagger)) {
      FP.waterBeansprout(fp, day, { all: cs.stagger === 0 });
      lastWaterDay = day;
    }

    /* ② [다음 날] — 시작한 시루만 나이를 먹는다 */
    FP.advanceBeansproutDay(fp, DARK);

    /* ③ 곳간에서 오늘 몫. **거두기보다 먼저**다 — 화면에서 [다음 날] 안에 일어난다.
       뒤집으면 거둔 날에 새 곳간을 바로 열어 하루 상한이 그 자리에서 깨진다. */
    const saved = FP.eatFromPantry(fp).foodSavedWon || 0;

    /* ④ [수확하기] — 익은 시루를 한 번에 거둔다 */
    let state = '', got = 0, lost = 0;
    if (FP.beansproutReady(fp.beansprout)) {
      const h = FP.harvestBeansprout(fp, { day });
      got = h.cycleSavedWon; lost = h.overlapLostWon;
      state = `거둠 ${h.harvestedPots}`;
    }
    /* ⑤ [다시 심기] — 거둔 시루만. 씨앗값이 그만큼 나간다. **물은 안 준다**(다음 턴에 준다) */
    const ripe = fp.beansprout.pots.filter(p => p.harvested).length;
    if (ripe > 0) {
      spentSeed += ripe * SEED; cash -= ripe * SEED;
      FP.resowBeansprout(fp, { day });
      state += ' → 다시 심음';
      /* ★ 같은 날 바로 물을 줄 수 있다 — 시차 판은 간격을 지키느라 미룬다 */
      if (cs.stagger === 0) { FP.waterBeansprout(fp, day, { all: true }); lastWaterDay = day; }
    }
    const out = RULES.dailyFoodWon - saved;
    cash -= out;
    rows.push({ day, sirus: fp.beansprout.pots.length, state, saved, got, lost, out, cash });
  }
  return { rows, spentSeed, spentSiru };
}

const runs = CASES.map(c => ({ ...c, ...run(c) }));
const won = n => Math.round(n).toLocaleString('ko-KR');
const sum = (r, k) => r.rows.reduce((a, x) => a + x[k], 0);
const net = r => sum(r, 'saved') - r.spentSeed - r.spentSiru;

console.log(`\n규칙 — 자라는 날 ${RULES.harvestDays}일 · 하루 식비 ${won(RULES.dailyFoodWon)}원 · ` +
            `씨앗 ${won(SEED)}원/시루(사는 값) · 시루 ${won(SIRU)}원/개(첫 개는 받은 것) · ` +
            `한 회전 절감 ${won(RULES.cropKindSavedWon?.[0] ?? 0)}원`);
console.log(`물 = **회전 시작**(회전당 한 번) · 겹치면 ${RULES.cropKindSavedWon.join(' → ')}원\n`);

const head = (t) => {
  console.log(`\n── ${t} ` + '─'.repeat(Math.max(0, 62 - t.length)));
  console.log('Day │ ' + CASES.map(c => c.id.padStart(9)).join(' │ '));
  console.log('────┼─' + CASES.map(() => '─'.repeat(9)).join('─┼─'));
};
const table = (title, pick) => {
  head(title);
  for (let i = 0; i < DAYS; i++)
    console.log(String(runs[0].rows[i].day).padStart(3) + ' │ ' +
      runs.map(r => String(pick(r.rows[i])).padStart(9)).join(' │ '));
};

if (argv.includes('--daily')) {
  table('그날 저감액 (원)', r => (r.saved ? won(r.saved) : '·'));
  table('그날 거둔 값 (원) — 괄호는 겹쳐서 못 받은 몫', r =>
    r.got ? won(r.got) + (r.lost ? `(-${won(r.lost)})` : '') : '·');
  table('보유금 (원) — 시작 100만', r => won(r.cash));
}

console.log('\n── 합계 ' + '─'.repeat(56));
console.log('     │ ' + CASES.map(c => c.id.padStart(9)).join(' │ '));
for (const [label, f] of [
  ['총저감', r => won(sum(r, 'saved'))],
  ['겹쳐손실', r => (sum(r, 'lost') ? '-' + won(sum(r, 'lost')) : '·')],
  ['씨앗값', r => '-' + won(r.spentSeed)],
  ['시루값', r => (r.spentSiru ? '-' + won(r.spentSiru) : '·')],
  ['순이득', r => won(net(r))],
  ['하루평균', r => won(net(r) / DAYS)],
  ['끝 보유금', r => won(r.rows[DAYS - 1].cash)]
]) console.log(label.padEnd(4) + ' │ ' + runs.map(r => String(f(r)).padStart(9)).join(' │ '));

/* ★★ 성적표 — 이 자가 존재하는 이유다. 사람이 표를 읽고 판단하지 않게 **자가 판정한다.** */
const by = id => runs.find(r => r.id === id);
const one = by('1개'), same5 = by('5개·같은날'), full = by('5개·시차'), over = by('6개·시차');
console.log(`\n── 성적표 (${DAYS}일) ` + '─'.repeat(48));
const line = (ok, s) => console.log(`${ok ? '✅' : '❌'} ${s}`);
/* ★★ 박사님 그림 그대로 — 5일 주기 · 시루 5개 · 하루씩 걸러 물 = **매일 3,000원** */
const cycleWon = RULES.cropKindSavedWon[0];
const settled = full.rows.slice(RULES.harvestDays + full.sirus);   // 회전이 다 자리잡은 뒤
const everyDayFull = settled.length > 0 && settled.every(r => r.saved === cycleWon);
line(everyDayFull,
  `완전 시차 = 매일 ${won(cycleWon)}원 : 자리잡은 뒤 ` +
  `Day ${settled.length ? settled[0].day : '-'}~${DAYS} 하루 저감 = ` +
  `${[...new Set(settled.map(r => won(r.saved)))].join(' / ')}원`);
line(sum(full, 'lost') === 0,
  `완전 시차는 안 겹친다 : 겹쳐서 못 받은 몫 ${won(sum(full, 'lost'))}원`);
line(net(full) > net(same5),
  `시차 > 같은날 : 5개·시차 ${won(net(full))}원 vs 5개·같은날 ${won(net(same5))}원 ` +
  `(차이 ${won(net(full) - net(same5))}원)`);
line(net(full) > net(one),
  `시차 > 1개    : 5개·시차 ${won(net(full))}원 vs 1개 ${won(net(one))}원 ` +
  `(차이 ${won(net(full) - net(one))}원)`);
/* ★★ 천장은 **규칙에서 나온다** — 5일 주기면 5개가 상한이다.
   6개째는 저감을 한 푼도 못 늘리고 용기값·씨앗값만 더 나간다.
   ⚠ 겹쳐서 깎이는 것이 아니라 **아예 자리가 없다**: 하루에 하나씩만 시작할 수 있으므로
     6번째 시루는 늘 하루를 기다리고, 그 하루가 6개째를 무의미하게 만든다.
     같은 날 몰아 시작하면 그때는 겹침으로 깎인다(5개·같은날이 그 경우다).
   ⇒ 어느 길로 가도 5개가 천장이다. 따로 박은 값이 아니다. */
line(sum(over, 'saved') <= sum(full, 'saved') && net(over) < net(full),
  `천장이 주기에서 나온다 : 6개·시차 총저감 ${won(sum(over, 'saved'))}원 = ` +
  `5개·시차 ${won(sum(full, 'saved'))}원 (안 는다) · 순이득은 ` +
  `${won(net(over))}원 < ${won(net(full))}원 (돈만 더 나간다)`);
/* ★ 시루는 **투자**다 — 용기값을 회수하기 전까지는 1개짜리가 앞선다. 날짜를 숨기지 않고 낸다.
   보유금 차이가 곧 순이득 차이다(하루 식비는 두 판이 같다). */
const flip = full.rows.findIndex((r, i) => r.cash > one.rows[i].cash);
console.log(`ℹ 시루값 회수 : 5개·시차가 1개짜리를 앞지르는 날 = ` +
  (flip < 0 ? `${DAYS}일 안에는 없음 (더 길게 재 보라)` : `Day ${full.rows[flip].day}`) +
  ` — 시루는 그날까지는 **투자**다`);

console.log(`\n⚠ 2종째 작물(+2,000원)은 아직 **작물 자체가 없다.** 규칙상 자리만 있어서`);
console.log(`  여기서는 안 돌린다 — 없는 것을 있는 것처럼 표에 적으면 안 된다.`);
console.log(`  작물이 생기면 이 자에 경우를 한 줄 더해 같은 표에서 바로 비교된다.`);
console.log(`  일별 표는 \`--daily\` 로 본다.\n`);
