/* ============================================================
   tools/probe_crop_cycle.mjs — 시루 개수별로 하루하루 얼마가 절감되나
   ------------------------------------------------------------
   박사님 물음: "시루를 많이 사서 다량 생산하면 지금 어떻게 되는 거야?
                 4일에 한 번씩 하루치 5천원 아끼는 거야?"
   ★감으로 답하지 않는다. 실제 first_play.js 를 loop.nextDay 와 **같은 순서**로 돌린다.
     (자라는 날에도 곳간은 매일 꺼내 먹는다 — 이 순서를 틀리면 답이 통째로 달라진다.
      실제로 한 번 틀렸다: 곳간을 안 먹였더니 시루 6개나 1개나 같은 값이 나왔다.)
============================================================ */
/* 시루 개수별로 하루하루 얼마가 절감되나 — 실제 코드로 돌린다 */
import { readFileSync } from 'node:fs';
import { createFirstPlayState, firstPlayRulesFromBalance, placeBeansprout,

         advanceBeansproutDay, eatFromPantry, resowBeansprout } from '../src/game/first_play.js';
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
const R = firstPlayRulesFromBalance(JSON.parse(readFileSync('./data/balance/characters.json','utf8')));
console.log(`규칙 — 자라는 날 ${R.harvestDays}일 · 한 끼 ${R.mealWon}원 · 하루 식비 ${R.dailyFoodWon}원 · 하루 상한 ${R.dailyCropMealCap}끼 · 씨앗 ${R.seedWonPerSiru}원/시루`);
console.log(`품질 — ${R.quality.map(q=>`${q.ko} ${q.meals}끼`).join(' · ')}`);
console.log(`보관 한도 = 상한 ${R.dailyCropMealCap} x 회전 ${R.harvestDays} = ${R.dailyCropMealCap*R.harvestDays}끼\n`);
for (const sirus of [1,2,3,4,6]) {
  const fp = createFirstPlayState({ enabled: true, rules: R });
  placeBeansprout(fp, 'dark');
  fp.beansprout.sirus = sirus;
  let total = 0, spoiled = 0; const row = [];
  for (let d = 1; d <= 12; d++) {
    let saved = 0, ev = null;
    /* 실제 loop.nextDay 와 같은 순서다 — 자라는 날에도 곳간은 매일 꺼내 먹는다 */
    if (!fp.beansprout.harvested) {
      ev = advanceBeansproutDay(fp, 0.05);
      if (ev.harvested) { saved = ev.foodSavedWon; spoiled += ev.spoiledMeals || 0; }
    }
    if (!(ev && ev.harvested)) saved = eatFromPantry(fp).foodSavedWon;
    if (ev && ev.harvested) resowBeansprout(fp, { sirus });
    total += saved;
    row.push(saved ? (saved/1000)+'천' : '·');
  }
  console.log(`시루 ${sirus}개 | ${row.join(' ')} | 12일 합계 ${total.toLocaleString()}원 · 하루평균 ${Math.round(total/12).toLocaleString()}원 · 버린 끼니 ${spoiled}`);
}
