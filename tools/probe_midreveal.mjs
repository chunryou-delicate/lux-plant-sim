/* ============================================================
   tools/probe_midreveal.mjs — **등급을 언제 정할 것인가**를 값으로 잰다 (G-17)
   ------------------------------------------------------------
   박사님: *"중간잎은 하프문만 있는 걸로 그냥 ㄱ, **성숙 때 확률적으로 분류**되는 걸로."*

   「성숙 때 분류」를 코드로 옮기는 길이 둘이다. 이 도구는 **둘의 값을 나란히 재서**
   어느 쪽을 골랐는지의 근거를 남긴다.

     ㉮ **장부 쓰기를 성숙 때로 옮긴다** — 잎이 성숙해야 `pot.leafGrades` 에 적는다
     ㉯ **장부는 잎이 날 때 쓰고, 드러내는 것만 성숙 때로 미룬다** ← 고른 길

   ⚠ 재는 것은 **프롤로그 그루값**이다(확정문 §2 · 1,960,000원). 그 수가 이사비 200만과
     한 벌이라(START-HERE §6) 흔들리면 판이 통째로 바뀐다.

   ★ 브라우저가 필요 없다 — 값 계통(shop.js)만 쓴다.

     node tools/probe_midreveal.mjs
============================================================ */
import fs from 'node:fs';
import {
  installVarieGrades, assignPotLeafGrades, potLeafGradesOf, potLeafGradeListOf,
  prologueLeafGradeListOf, potPriceOf, midCommonRule, midSkinPoolOf, leafSkinsFor,
  varieGradeRules
} from '../src/game/shop.js';

const ROOT = new URL('../', import.meta.url);
installVarieGrades(JSON.parse(fs.readFileSync(new URL('data/balance/varie_grades.json', ROOT), 'utf8')));

const won = (n) => (n == null ? '—' : n.toLocaleString() + '원');
const MOVE_COST = 2_000_000;                      // 이사비 (확정문 · START-HERE §6)

/* 프롤로그 그루 한 판: 잎 3장 · 무늬 2장(잎2·잎3). 확정문 §4 가 등급을 못 박은 그루다. */
const mkState = () => ({ day: 40, sim: { seed: 4242 }, tutorial: { enabled: true },
                         pots: [{ id: 'pot_01' }], cuttings: [] });
const rows = (maturedUpTo) =>            // maturedUpTo: 몇 번째 잎까지 성숙했나(0 = 하나도 안 성숙)
  [1, 2, 3].map(no => ({ leafBirth: no * 100, varie: no >= 2, matured: no <= maturedUpTo,
                         fade: 0, dropped: false }));

/* 그루값 — 장부가 있으면 장부로, 비었으면 프롤로그 다리로(§prologueLeafGradeListOf) */
function potWon(S) {
  const pot = S.pots[0];
  const list = potLeafGradeListOf(pot, 3, 2) || prologueLeafGradeListOf(S, pot, 3, 2);
  return { won: potPriceOf({ leaves: 3, variegatedLeaves: 2, leafGrades: list }).won,
           list: list ? list.join('/') : '(장부·다리 둘 다 없음)' };
}

console.log('\n══ G-17 「성숙 때 분류」 — 두 길의 값 ══\n');
console.log(`프롤로그 그루: 잎 3장(무지·산반·하프문) · 이사비 ${won(MOVE_COST)}`);
console.log(`확정문 §2 의 값 = ${won(1_960_000)} (이사비에 ${won(MOVE_COST - 1_960_000)} 모자란다)\n`);

/* ── ㉯ 고른 길 — 지금 코드 그대로 ────────────────────────────────────── */
const now = [];
for (const m of [0, 1, 2, 3]) {
  const S = mkState();
  const r = assignPotLeafGrades(S, { leafState: rows(m), band: 'slow' });
  const q = potWon(S);
  now.push({ '성숙한 잎': m, '장부': Object.keys(potLeafGradesOf(S.pots[0])).length,
             '드러난 잎': r.assigned.length, '잎 등급': q.list, '그루값': won(q.won),
             '196만인가': q.won === 1_960_000 ? '✔' : '✘' });
}
console.log('㉯ **지금 코드** — 장부는 잎이 날 때 · 드러내기만 성숙 때');
console.table(now);

/* ── ㉮ 안 고른 길 — 장부 쓰기 자체를 성숙 때로 미뤘다면 ────────────────
   ⚠ 코드를 고쳐서 재지 않는다. **성숙한 잎만 넘겨** 같은 상태를 만든다 —
     장부 쓰기를 성숙 때로 미룬다는 것은 곧 「안 성숙한 잎은 목록에 없는 것과 같다」다. */
const alt = [];
for (const m of [0, 1, 2, 3]) {
  const S = mkState();
  /* 성숙한 잎만 등급이 적힌다 = 성숙한 줄만 넘긴 것과 같은 장부가 된다 */
  assignPotLeafGrades(S, { leafState: rows(m).filter(r => r.matured), band: 'slow' });
  const q = potWon(S);
  alt.push({ '성숙한 잎': m, '장부': Object.keys(potLeafGradesOf(S.pots[0])).length,
             '잎 등급': q.list, '그루값': won(q.won),
             '196만인가': q.won === 1_960_000 ? '✔' : '✘',
             '차액': won(q.won - 1_960_000) });
}
console.log('\n㉮ **안 고른 길** — 장부 쓰기까지 성숙 때로 미뤘다면');
console.table(alt);

const broken = alt.filter(r => r['196만인가'] === '✘');
console.log(`\n⇒ ㉮ 는 네 경우 중 **${broken.length}가지에서 196만이 깨진다.**`);
console.log('   까닭: 잎2 만 성숙하면 장부에 한 칸이 생겨 `prologueLeafGradeListOf` 다리가 꺼진다');
console.log('   (그 다리는 **장부가 완전히 비었을 때만** 산다). 등급 없는 잎3 은 산반으로 떨어지고');
console.log('   하프문 750,000원이 사라진다. ⇒ ㉯ 를 골랐다.\n');

/* ── 중간잎 통일이 실제로 켜져 있나 ──────────────────────────────────── */
const mc = midCommonRule();
console.log('══ 중간잎 통일 ══');
console.log(`켜짐: ${mc.enabled} · 갈래: ${mc.fromGrade} · 안 켜진 까닭: ${mc.why ?? '—'}`);
const tbl = [];
for (const g of varieGradeRules().grades.filter(x => x.varie)) {
  const mids = new Set(), mats = new Set();
  for (let lb = 1; lb <= 120; lb++) {
    const s = leafSkinsFor(g.id, 4242, 'potA', lb);
    mids.add(s.midSkin); mats.add(s.matSkin);
  }
  tbl.push({ 등급: g.ko, '중간잎 가짓수': mids.size, '중간잎': [...mids].sort().join(' '),
             '성숙잎 가짓수': mats.size });
}
console.table(tbl);
console.log('⇒ 중간잎 칸이 세 등급 모두 같으면 **그림으로 등급을 못 알아본다.**');
console.log(`   통일 칸: ${midSkinPoolOf('sanban').join(' ')}\n`);
