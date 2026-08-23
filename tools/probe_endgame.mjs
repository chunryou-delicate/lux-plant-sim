/* ============================================================
   tools/probe_endgame.mjs — **튜토 끝에 «무엇을 팔면 나가나»**
   ------------------------------------------------------------
   박사님 설계(2026-08-23) 세 갈래를 값으로 세운다:
     ⓐ 어느 정도 돈이 있으면 «삽수해서 일부만» 팔고    ⓑ 돈이 없으면 «그루째»
     ⓒ 채소로 모아서 그루째 «살려서»
   ⇒ ★ 셋이 서로 다른 길이 아니라 **「지갑 하나의 눈금」**이다. 이 자가 그 눈금을 낸다.

   ⚠ 값은 전부 `data/balance/varie_grades.json` 에서 읽는다 — **하나도 안 박는다.**
   ⚠ 무지(plain) 잎도 값에 든다(20,000원). `shop.js:1760` 의 검산이 그렇게 센다.

     node tools/probe_endgame.mjs                 (프롤로그 잎 셋)
     node tools/probe_endgame.mjs plain,sanban,halfmoon,plain   (잎 넷 · 넷째가 무지)
============================================================ */
import { readFileSync } from 'node:fs';
const J = JSON.parse(readFileSync('./data/balance/varie_grades.json', 'utf8'));
const G = {}; for (const g of J.grades) G[g.id] = { won: g.leafWon, varie: g.varie !== false, ko: g.ko };
const S = J.sale;
const { TUTORIAL_RULES } = await import('../src/game/tutorial.js');
const NEED = TUTORIAL_RULES.moveOutCostWon;

const val = (ls, mult) => {
  if (!ls.length) return 0;
  const sum = ls.reduce((a, k) => a + G[k].won, 0);
  const kinds = new Set(ls.filter(k => G[k].varie)).size;
  return Math.round(sum * mult * (S.synergy[kinds] ?? 1));
};

const leaves = (process.argv[2] || 'plain,sanban,halfmoon').split(',').map(s => s.trim());
for (const k of leaves) if (!G[k]) { console.error('모르는 등급: ' + k); process.exit(2); }

console.log(`이사비 ${NEED.toLocaleString()}원 · potMult ${S.potMult} · cuttingMult ${S.cuttingMult}`);
console.log(`잎 — ${leaves.map(k => G[k].ko).join(' + ')}`);
const whole = val(leaves, S.potMult);
console.log(`\nⓑ 그루째 팔기 — ${whole.toLocaleString()}원  ` +
            `⇒ ★ 지갑이 ${Math.max(0, NEED - whole).toLocaleString()}원 있으면 나간다`);
console.log(`ⓒ 그루를 «안» 팔기 — 지갑만으로 ${NEED.toLocaleString()}원을 모아야 한다`);

console.log('\nⓐ 삽수로 «일부만» 팔기 — 무엇을 자르면 얼마가 드나');
const vIdx = leaves.map((k, i) => [k, i]).filter(([k]) => G[k].varie);
const seen = new Set(), rows = [];
for (let m = 1; m < (1 << vIdx.length); m++) {
  const cut = [], rest = [...leaves];
  for (let b = 0; b < vIdx.length; b++) if (m & (1 << b)) cut.push(vIdx[b][0]);
  for (const c of cut) { const i = rest.indexOf(c); if (i >= 0) rest.splice(i, 1); }
  const key = [...cut].sort().join(',');
  if (seen.has(key)) continue; seen.add(key);
  rows.push({ ko: cut.map(k => G[k].ko).join('+'), c: val(cut, S.cuttingMult),
              r: val(rest, S.potMult), left: rest.filter(k => G[k].varie).length });
}
rows.sort((a, b) => (NEED - a.c) - (NEED - b.c));
for (const x of rows)
  console.log(`   자를 잎 ${x.ko.padEnd(20)} 삽수 ${String(x.c.toLocaleString()).padStart(9)}원` +
              ` | ★ 지갑 ${String(Math.max(0, NEED - x.c).toLocaleString()).padStart(9)}원이면 나간다` +
              ` | 남는 모주 ${String(x.r.toLocaleString()).padStart(9)}원` +
              (x.left ? ` (무늬 ${x.left}장)` : ' ⚠ 무늬 없음 — 살린 것이 아니다'));
console.log('\n⚠ 「남는 모주」에 무늬가 없으면 ⓐ 의 뜻(살려서 넘어간다)이 죽는다 —');
console.log('   그건 ⓑ 를 비싸게 한 것뿐이다. ⇒ ★ 그 갈래를 어디에 둘지는 밸런스다. 여기서는 재기만 한다.');
