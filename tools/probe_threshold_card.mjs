/* ============================================================
   probe_threshold_card.mjs — 「문턱 한 장」 ([growth] 소유)
   ------------------------------------------------------------
   ★ 왜 이 자가 있나 (2026-08-30)

   방·가구가 자꾸 바뀐다. 그때마다 내가 400일을 굴려 표를 내는데,
   ⇒ ⛔ 그 표는 «그 배치»의 표라 배치가 바뀌면 낡는다.

   ★ 그런데 «문턱»은 안 낡는다. 「이 자리의 빛이 얼마면 무엇이 되나」는
     자리가 어디든 같다. ⇒ 그러면 누가 무엇을 어디에 놓든 «읽어서» 답이 난다.

   ⚠⚠ 자가 셋이다. 섞으면 몇 배 틀린다:
     몬스테라  «7일 이동평균»              — 관문·밴드·갈라짐이 다 이것
     콩나물    «자라는 5일 동안의 하루 평균» — 어두울수록 좋다(상한만 있다)
     무순      «자라는 7일 동안의 하루 평균» — 밝을수록 좋다(하한만 있다)
   ⇒ ★ 그래서 「7일평균 3.0」과 「무순 7일 3.0」은 «다른 수»다. 앞은 이동평균, 뒤는 자라는 동안.

   ⚠ 등 DLI 에는 날씨 계수를 «안» 곱한다(엔진 확인). 밖에서 ×0.643 하면 틀린다.

     node tools/probe_threshold_card.mjs
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as FP from '../src/game/first_play.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const T  = J('data/balance/light_thresholds.json').plants.monstera_deliciosa;
const GS = J('data/growth_tuning.json').growth_speed.by_band;
const VG = J('data/balance/varie_grades.json');

console.log('══ 문턱 한 장 — 「이 자리의 빛이 얼마면 무엇이 되나」');
console.log('   ⚠ 자가 셋이다. 아래 표마다 «어느 자»인지 적었다.\n');

console.log('① 몬스테라  [자: 7일 «이동»평균]');
const rows = [
  ['~ ' + T.die,               'critical', '죽는다'],
  [T.die + ' ~ ' + T.survive,  'poor',     '버틴다 — 안 자란다'],
  [T.survive + ' ~ ' + T.min,  'stagnant', '정체 — 안 자란다'],
  ['★ ' + T.min + ' ~ ' + T.best_lo, 'slow', '자란다. 무늬는 굴림'],
  [T.best_lo + ' ~ ' + T.best_hi, 'best',  '★ 잘 자란다'],
  [T.best_hi + ' ~ ' + T.max,  'good',     '잘 자란다'],
  [T.max + ' ~',               'over',     '과광'],
];
console.log('   DLI 대역        밴드        하루가 유효 며칠   무늬 단계   뜻');
for (const [range, band, ko] of rows) {
  const mult = GS[band] ?? 0;
  const step = (VG.lightBands && VG.lightBands[band]) || '—';
  console.log('   ' + range.padEnd(15) + band.padEnd(11)
    + String(mult).padEnd(18) + step.padEnd(11) + ko);
}
console.log('   ★ 갈라짐(성숙잎)은 ' + T.fenestrate + ' 부터 · 무늬가 잘 나는 대역은 '
  + (T.best_lo * 1.4).toFixed(1) + ' ~ ' + (T.best_hi * 1.4).toFixed(1) + ' (best × 1.4)');

console.log('\n② 무늬 등급  [자: 그 잎이 «날 때»의 밴드]');
for (const k of ['dark', 'mid', 'bright']) {
  const g = VG.lightGrade[k];
  const owner = Object.entries(VG.lightBands).filter(([, v]) => v === k).map(([b]) => b).join('·');
  console.log('   ' + k.padEnd(8) + '(' + owner + ')');
  console.log('      ' + Object.entries(g).map(([id, p]) => {
    const w = (VG.grades.find(x => x.id === id) || {});
    return `${id} ${Math.round(p * 100)}%${w.leafWon ? ' (' + w.leafWon.toLocaleString() + '원)' : ''}`;
  }).join(' · '));
}

console.log('\n③ 작물  [자: «자라는 기간» 동안의 하루 평균 — 이동평균이 아니다]');
for (const kind of ['beansprout', 'musun']) {
  const K = FP.cropKindOf(kind);
  console.log('   ' + K.ko + '  (자라는 ' + K.harvestDays + '일)');
  for (const q of K.quality) {
    const lo = q.minDli ?? 0, hi = q.maxDli;
    const range = (hi === Infinity ? lo + ' 이상' : lo + ' ~ ' + hi);
    console.log('      ' + range.padEnd(14) + q.ko.padEnd(14) + q.meals + '끼');
  }
}
console.log('\n⚠ 등 DLI 에는 날씨 계수를 안 곱한다. 자연광만 계절·날씨로 흔들린다.');
