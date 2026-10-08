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

/* ══ ★★ 2026-10-08 [plan] M4 — D9 값표(새 공식) · plan-d8-d9-measure-20261008.md §2 M4 ═══════════════════
     node tools/probe_endgame.mjs --table [--csv tools/_out/m4_value_table.csv]
   M3(무늬 키워 팔기 도달 곡선)의 «닿은 날»을 읽는 자(sanity)다 — 셈만 한다. 판을 안 굴린다.
   ⚠ 값은 전부 파일에서 읽는다: 잎값·그루 배수·시너지·밝기별 등급(varie_grades.json) ·
     삽수 새 잎의 무늬율(propagation.VARIE_LIGHT — 뿌리내린 날 밴드) · 삽수 잎 하나 날수(CUTTING_LEAF_DAYS).
   ⚠ 잎값은 다 자란 잎(leafM 1) 기준이다. 갓 펼친 잎은 leafM 0 이라 값이 0 이다(shop.js §priceOf leafM) —
     M3 의 «닿은 날»이 잎 수 셈보다 늦게 나오는 것은 자의 흠이 아니라 규칙이다. */
if (process.argv.includes('--table')) {
  const { VARIE_LIGHT, CUTTING_LEAF_DAYS } = await import('../src/game/propagation.js');
  const LG = J.lightGrade;                                   // { dark|mid|bright: { sanban, halfmoon, fullmoon } }
  const ids = J.grades.map(g => g.id);                       // plain, sanban, halfmoon, fullmoon
  const W = k => G[k].won, ko = k => G[k].ko;
  const fmt = n => Math.round(n).toLocaleString('ko-KR');
  const pad = (s, n) => String(s).padStart(n);
  console.log('══ M4 값표 — 새 공식(잎마다 등급값의 합 × 꼴 배수 × 시너지) ══');
  console.log(`꼴 배수: 삽수 ×${S.cuttingMult} · 그루 ×${S.potMult} · 시너지(서로 다른 무늬 종류 수) ${JSON.stringify(S.synergy)}`);
  console.log('⓪ 잎 한 장 값(leafM 1) — ' + ids.map(k => `${ko(k)} ${fmt(W(k))}`).join(' · '));

  /* ① 밴드별 «새 잎 한 장» 기대값 — 삽수가 뿌리내린 날 밴드가 무늬율(VARIE_LIGHT)과 등급 분포(lightGrade)를 정한다 */
  console.log('\n① 밴드별 새 잎 한 장 기대값 [셈] — 무늬율 × 무늬일 때 등급 기대값 + (1−무늬율) × 무지');
  const leafDist = {};
  for (const b of ['dark', 'mid', 'bright']) {
    const p = VARIE_LIGHT[b], d = LG[b];
    const eV = Object.entries(d).reduce((a, [k, q]) => a + q * W(k), 0);
    leafDist[b] = { plain: 1 - p, ...Object.fromEntries(Object.entries(d).map(([k, q]) => [k, p * q])) };
    console.log(`   ${b.padEnd(6)} 무늬율 ${pad((p * 100).toFixed(0) + '%', 4)} · 무늬일 때 ${pad(fmt(eV), 9)}원` +
                ` · 새 잎 한 장 ${pad(fmt(p * eV + (1 - p) * W('plain')), 9)}원` +
                ` (산반 ${(d.sanban * 100).toFixed(0)}% · 하프문 ${(d.halfmoon * 100).toFixed(0)}% · 풀문 ${(d.fullmoon * 100).toFixed(0)}%)`);
  }

  /* ② 잎 1~6장 × 등급 조합 → 삽수(잎 하나씩 따로) · 그루 값. 조합은 중복조합 전부(209줄) — 화면엔 장수마다 요약, 전부는 CSV */
  const combos = n => { const out = []; const rec = (i, left, acc) => {
    if (i === ids.length - 1) { out.push([...acc, left]); return; }
    for (let c = left; c >= 0; c--) rec(i + 1, left - c, [...acc, c]); }; rec(0, n, []); return out; };
  const potOf = cnt => { const sum = cnt.reduce((a, c, i) => a + c * W(ids[i]), 0);
    const kinds = cnt.filter((c, i) => c > 0 && G[ids[i]].varie).length;
    return Math.round(sum * S.potMult * (S.synergy[kinds] ?? 1)); };
  const cutsOf = cnt => cnt.reduce((a, c, i) => a + c * Math.round(W(ids[i]) * S.cuttingMult * (S.synergy[G[ids[i]].varie ? 1 : 0] ?? 1)), 0);
  const csv = ['leaves,' + ids.join(',') + ',pot_won,cuttings_won,pot_minus_cuttings'];
  console.log('\n② 잎 n장 × 등급 조합 — 그루째 vs 잎마다 삽수로 [셈] (전부: --csv)');
  console.log('   n | 조합 수 | 그루 최저 ~ 최고           | 무늬 없는 그루 | 산반만 n장 그루 · 삽수 | 하프문만 n장 그루 · 삽수 | 셋 섞임(최고 시너지) 그루');
  for (let n = 1; n <= 6; n++) {
    const cs = combos(n); const pots = cs.map(potOf);
    for (const c of cs) csv.push([n, ...c, potOf(c), cutsOf(c), potOf(c) - cutsOf(c)].join(','));
    const only = k => { const c = ids.map(x => (x === k ? n : 0)); return `${fmt(potOf(c))} · ${fmt(cutsOf(c))}`; };
    const mix = n >= 3 ? fmt(Math.max(...cs.filter(c => c.slice(1).every(x => x > 0)).map(potOf))) : '—';
    console.log(`   ${n} | ${pad(cs.length, 6)} | ${pad(fmt(Math.min(...pots)), 9)} ~ ${pad(fmt(Math.max(...pots)), 11)} | ${pad(only('plain'), 15)} | ${pad(only('sanban'), 22)} | ${pad(only('halfmoon'), 24)} | ${pad(mix, 10)}`);
  }
  console.log('   ⚠ 그루는 ×' + S.potMult + ' 라 늘 «잎마다 삽수» 합보다 비싸다 — 대신 그루를 팔면 무늬 원천이 사라진다(D22 · sellLastVarie).');

  /* ③ 밴드별 «잎 n장이 다 새로 난» 그루·삽수 기대값 — 잎마다 ① 의 분포로 굴린 정확한 기댓값(4^n 펼침) */
  console.log('\n③ 밴드별 기대값 — 잎 n장이 그 밴드에서 새로 났을 때 [셈 · 정확 기댓값]');
  console.log('   n | ' + ['dark', 'mid', 'bright'].map(b => `${b} 그루 · 삽수 합`.padEnd(26)).join(' | '));
  for (let n = 1; n <= 6; n++) {
    const cells = ['dark', 'mid', 'bright'].map(b => {
      const pr = ids.map(k => leafDist[b][k] || 0);
      let ePot = 0; const total = ids.length ** n;
      for (let m = 0; m < total; m++) { let x = m, p = 1; const cnt = ids.map(() => 0);
        for (let j = 0; j < n; j++) { const k = x % ids.length; x = Math.floor(x / ids.length); p *= pr[k]; cnt[k]++; }
        if (p > 0) ePot += p * potOf(cnt); }
      const eCut = n * ids.reduce((a, k, i) => a + pr[i] * Math.round(W(k) * S.cuttingMult), 0);
      return `${pad(fmt(ePot), 11)} · ${pad(fmt(eCut), 11)}`; });
    console.log(`   ${n} | ` + cells.join(' | '));
  }

  /* ④ K 닿기 — «무늬 삽수 한 장(잎 하나) = 밴드 기대값»으로 몇 장 팔아야 하나 · 삽수 잎 하나 날수로 어림 */
  console.log(`\n④ K 에 닿으려면 — 무늬 삽수(잎 하나)를 몇 장 팔아야 하나 [셈 · 하한 어림]`);
  console.log(`   무늬 삽수 한 장 값 = 그 잎의 등급값(무늬가 이미 있는 마디를 자른 것). 새로 키운 잎은 ① 의 밴드 기대값.`);
  const Ks = [3_000_000, 5_000_000, 7_000_000, 10_000_000, 15_000_000];
  console.log('   K           | ' + ['dark', 'mid', 'bright'].map(b => `${b}(무늬 잎 기대)`.padEnd(18)).join(' | ') + ' | 산반만 | 하프문만');
  for (const K of Ks) {
    const per = b => { const p = VARIE_LIGHT[b]; const eV = Object.entries(LG[b]).reduce((a, [k, q]) => a + q * W(k), 0);
      return `${pad(Math.ceil(K / eV), 3)}장 (새 잎 ${pad(Math.ceil(K / (p * eV + (1 - p) * W('plain'))), 3)}장)`; };
    console.log(`   ${pad(fmt(K), 11)} | ` + ['dark', 'mid', 'bright'].map(b => per(b).padEnd(18)).join(' | ') +
                ` | ${pad(Math.ceil(K / W('sanban')), 4)}장 | ${pad(Math.ceil(K / W('halfmoon')), 4)}장`);
  }
  console.log(`   ⚠ «새 잎 n장»은 무지 잎까지 센 수다(무늬율 ${Object.entries(VARIE_LIGHT).map(([b, p]) => `${b} ${p * 100}%`).join(' · ')}).`);
  console.log(`   ⚠ 삽수 잎 하나에 ${CUTTING_LEAF_DAYS}일(propagation CUTTING_LEAF_DAYS) — 그루가 하나면 하루 하나도 안 난다.` +
              ` 위 장수 ÷ (동시에 기르는 삽수 수) × ${CUTTING_LEAF_DAYS}일 이 «닿은 날»의 하한이다. M3 가 이보다 빠르면 자를 의심한다.`);

  const ci = process.argv.indexOf('--csv');
  if (ci > 0 && process.argv[ci + 1]) {
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const { dirname } = await import('node:path');
    mkdirSync(dirname(process.argv[ci + 1]), { recursive: true });
    writeFileSync(process.argv[ci + 1], csv.join('\n') + '\n', 'utf8');
    console.log(`\nCSV ${csv.length - 1}줄 → ${process.argv[ci + 1]}`);
  }
  process.exit(0);
}

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
