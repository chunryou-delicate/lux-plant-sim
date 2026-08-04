/* ============================================================
   tools/probe_crop_cycle.mjs — 콩나물 한 회전이 하루 얼마를 아끼나
   ------------------------------------------------------------
   박사님 물음(2026-08-03): "시루를 많이 사서 다량 생산하면 지금 어떻게 되는 거야?"
   박사님 안(2026-08-04): "5일 주기로 3천원 아끼는 걸로 하고, 다른 종류를 추가하면
                           추가 2000원(주기에 따라), 그다음은 1000원(주기에 따라)"

   ★감으로 답하지 않는다. 실제 first_play.js 를 loop.nextDay 와 **같은 순서**로 돌린다.
     (거둔 날에도 곳간에서 하루치를 꺼내 먹는다 — 이 순서를 틀리면 답이 통째로 달라진다.)

   ★ 2026-08-04 개편 — 재는 것이 넷으로 늘었다:
       ① 시루 개수      같은 종류를 늘려도 절감이 안 는다는 것을 눈으로 본다
       ② 자리(품질)     어두운 자리 vs 밝은 자리 — 빛 축이 살아 있나
       ③ ★물주기       며칠에 한 번 주면 얼마나 늦어지나 — 물 축이 실제로 도나
       ④ ★수확 미루기  수확이 **손 동작**이 된 뒤(first_play.js §수확), 안 거두면 얼마를 잃나
                        — 따로 만든 벌이 아니라 **회전이 멈춰서** 잃는 것임을 눈으로 본다
============================================================ */
import { readFileSync } from 'node:fs';
import { createFirstPlayState, firstPlayRulesFromBalance, placeBeansprout,
         advanceBeansproutDay, harvestBeansprout, eatFromPantry, resowBeansprout,
         waterBeansprout, beansproutReady,
         cropCycleSavedWon, CROP_KINDS, FIRST_PLAY_RULES } from '../src/game/first_play.js';
import { buyPriceOf } from '../src/game/shop.js';

/* ★★ 지갑에서 실제로 나가는 씨앗값은 **상점 사는 값**이다 (2026-08-04).
   재파종(state.resowCrop)은 미리 주문해 둔 재고를 쓰고, 돈은 주문할 때 `orderItem` 이 뺀다.
   `rules.seedWonPerSiru` 는 정가(표시용)라 그걸로 재면 살림이 실제보다 싸게 나온다 —
   실제로 이 판이 한동안 그 상태였다(정가만 내려서 순액이 한 푼도 안 바뀌었다). */
const SEED_BUY = buyPriceOf('bean_seed');

/* ★자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다.
   이게 없어서 측정 하나가 21시간 매달려 있었다. 헤드리스 크롬은 무언가를
   기다리다 영영 안 끝나는 일이 실제로 생긴다. 시간은 환경변수로 늘릴 수 있다. */
const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한 ' + Math.round(_WATCHDOG_MS / 1000) + '초를 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
/* ★타이머가 프로세스를 붙잡으면 안 된다 — unref 를 빠뜨려서
   재기를 다 끝낸 도구가 제한 시간까지 안 죽고 매달려 있었다(넣자마자 났다). */
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const R = firstPlayRulesFromBalance(JSON.parse(readFileSync('./data/balance/characters.json', 'utf8')));

console.log(`규칙 — 자라는 날 ${R.harvestDays}일(★물을 준 날로 센다 · ★거두는 것은 손 동작) · ` +
            `하루 식비 ${R.dailyFoodWon.toLocaleString()}원 · ` +
            `씨앗 정가 ${R.seedWonPerSiru.toLocaleString()}원 → **사는 값 ${SEED_BUY.toLocaleString()}원**/시루`);
console.log(`작물 종류 ${CROP_KINDS.length}종(${CROP_KINDS.map(k => k.ko).join('·')}) — ` +
            `종류 순번별 한 회전 절감 ${FIRST_PLAY_RULES.cropKindSavedWon.map(w => w.toLocaleString() + '원').join(' → ')}`);
console.log(`  ⤷ 지금 도는 합계 ${R.cropSavedWonPerCycle.toLocaleString()}원/회전 · ` +
            `하루 상한 ${R.dailyCropSaveWon.toLocaleString()}원 · 곳간 한도 ${R.cropSavedWonPerCycle.toLocaleString()}원`);
console.log(`품질(자리가 정한다) — ` +
            R.quality.map(q => `${q.ko} ${q.meals}끼 상당 = ${cropCycleSavedWon(R, q.meals, 0).toLocaleString()}원/회전`).join(' · '));
console.log('');

/* 하루를 loop.nextDay 와 같은 순서로 굴린다.
     waterEvery   며칠에 한 번 물을 주나 (1 = 매일)
     harvestLag   거둘 수 있게 된 뒤 **며칠 뒤에** [수확하기]를 누르나 (0 = 그날 바로)
   ★★ 2026-08-04 — 수확이 손 동작이 됐다(first_play.js §수확). 그래서 이 자가 밟는 하루는
     게임 화면과 **같은 순서**다:
       [물 주기](어제 날짜) → [다음 날](여기서 하루가 가고 곳간에서 한 입 꺼낸다)
       → 화면이 오늘 날짜로 바뀐다 → [수확하기] → [다시 심기]
     ⚠ 순서가 틀리면 답이 통째로 달라진다. 수확을 [다음 날] **앞**에 두면 거두는 날이 하루씩
       밀려 회전이 5일이 아니라 6일이 되고, 하루평균이 저 혼자 17% 내려간다(실제로 그랬다).
     ⚠ 거둔 날의 절감은 **다음 [다음 날]** 부터 나간다 — 예전(자동 수확)과의 유일한 차이다.
   반환 { total, days, spoiled, harvests, dry, waited, row } */
function run({ sirus = 1, dli = 0.05, days = 30, waterEvery = 1, harvestLag = 0 } = {}) {
  const fp = createFirstPlayState({ enabled: true, rules: R });
  placeBeansprout(fp, 'dark', { day: 0 });
  fp.beansprout.sirus = sirus;
  let total = 0, spoiled = 0, harvests = 0, dry = 0, seed = 0, waited = 0;
  let readySince = null;
  const row = [];
  for (let d = 1; d <= days; d++) {
    /* ── 플레이어의 행위 ①: 물주기. d-1 이 "지금 화면에 뜬 날"이다(loop 은 증가 전 S.day 를 본다) */
    const shown = d - 1;
    if (shown % waterEvery === 0) waterBeansprout(fp, shown);
    const watered = fp.beansprout.wateredOnDay === shown;

    /* ── [다음 날] ─ 하루가 간다. ★여기서는 안 거둬진다 */
    if (!fp.beansprout.harvested) {
      const ev = advanceBeansproutDay(fp, dli, { watered });
      if (ev.dry) dry++;
    }
    total += eatFromPantry(fp).foodSavedWon;
    row.push(fp.food.lastFoodSavedWon ? (fp.food.lastFoodSavedWon / 100) + '' : '·');

    /* ── 플레이어의 행위 ②: 수확. **누르지 않으면 아무 일도 안 난다** */
    if (beansproutReady(fp.beansprout)) {
      if (readySince == null) readySince = d;
      if (d - readySince >= harvestLag) {
        const ev = harvestBeansprout(fp);
        harvests++; spoiled += ev.spoiledWon || 0; readySince = null;
        /* ── 플레이어의 행위 ③: 다시 심기 (거둔 그 날에 바로) */
        resowBeansprout(fp, { sirus, day: d });
        seed += sirus * SEED_BUY;
      } else waited++;
    }
  }
  return { total, days, spoiled, harvests, dry, seed, waited, row };
}

const won = n => Math.round(n).toLocaleString() + '원';

console.log('① 시루 개수 — 같은 작물을 여러 시루 돌리면 (30일 · 어두운 자리 DLI 0.05 · 매일 물)');
for (const sirus of [1, 2, 3, 4, 6]) {
  const r = run({ sirus, days: 30 });
  console.log(`  시루 ${sirus}개 | 30일 절감 ${won(r.total)} · 하루평균 ${won(r.total / r.days)} · ` +
              `씨앗값 ${won(r.seed)} · 순액 하루평균 ${won((r.total - r.seed) / r.days)} · 수확 ${r.harvests}번`);
}

console.log('\n② 자리(빛) — 품질이 절감을 가른다 (30일 · 시루 1개 · 매일 물)');
for (const [ko, dli] of [['어두운 자리', 0.05], ['살짝 밝은 자리', 0.6], ['밝은 자리', 2.0]]) {
  const r = run({ dli, days: 30 });
  console.log(`  ${ko}(DLI ${dli}) | 30일 절감 ${won(r.total)} · 하루평균 ${won(r.total / r.days)} · 수확 ${r.harvests}번`);
}

console.log('\n③ ★물주기 — 빼먹으면 회전이 늘어 하루평균이 스스로 내려간다 (30일 · 시루 1개 · 어두운 자리)');
for (const every of [1, 2, 3]) {
  const r = run({ waterEvery: every, days: 30 });
  console.log(`  ${every === 1 ? '매일' : every + '일에 한 번'} | 30일 절감 ${won(r.total)} · ` +
              `하루평균 ${won(r.total / r.days)} · 수확 ${r.harvests}번 · 마른 날 ${r.dry}일`);
}
console.log('  ⤷ 죽지 않는다. 늦어질 뿐이고, 늦어진 만큼 하루평균이 내려가는 것이 벌의 전부다.');

console.log('\n④ ★수확 미루기 — 안 거두면 **회전이 멈춘다.** 따로 만든 벌은 없다 (30일 · 시루 1개 · 어두운 자리)');
for (const lag of [0, 1, 2, 3, 5]) {
  const r = run({ harvestLag: lag, days: 30 });
  console.log(`  ${lag === 0 ? '그날 바로' : lag + '일 미룸'} | 30일 절감 ${won(r.total)} · ` +
              `하루평균 ${won(r.total / r.days)} · 수확 ${r.harvests}번 · ` +
              `씨앗값 ${won(r.seed)} · 순액 하루평균 ${won((r.total - r.seed) / r.days)} · ` +
              `안 거두고 지나간 날 ${r.waited}일`);
}
console.log('  ⤷ 품질도 절감액도 안 깎였다(수확 ' + won(R.cropSavedWonPerCycle) + '/회전 그대로).');
console.log('    잃는 것은 **회전 수**뿐이다 — 물주기와 같은 사상이고, 벌은 시간 하나다.');
