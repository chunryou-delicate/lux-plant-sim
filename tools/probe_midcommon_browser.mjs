/* ============================================================
   tools/probe_midcommon_browser.mjs — **중간잎 통일이 브라우저에서도 켜지나** (G-17)
   ------------------------------------------------------------
   node 에서 켜지는 것과 브라우저에서 켜지는 것은 다른 말이다 —
   `shop.js` 는 파일을 **fetch 로** 읽고, 못 읽으면 조용히 밑값으로 돈다(§⑥-0).
   그래서 「파일에 적었다」가 「게임이 그렇게 돈다」가 아니다. 여기서 그것을 잰다.

     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_midcommon_browser.mjs
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
let bad = 0;
const ok = (name, cond, got) => {
  console.log(`${cond ? '  OK' : 'FAIL'}  ${name}${got == null ? '' : '  → ' + got}`);
  if (!cond) bad++;
};

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on(m => {
  if (m.method === 'Runtime.exceptionThrown')
    errs.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
});
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__byeotBooted', 180000, 300);
await sleep(1500);

const r = JSON.parse(await page.eval(`(async () => {
  const S = await import('${BASE}/src/game/shop.js');
  const R = S.varieGradeRules();
  const mc = S.midCommonRule();
  const per = {};
  for (const g of R.grades.filter(x => x.varie)) {
    const mids = new Set(), mats = new Set();
    for (let lb = 1; lb <= 90; lb++) {
      const s = S.leafSkinsFor(g.id, 4242, 'pot_01', lb);
      mids.add(s.midSkin); mats.add(s.matSkin);
    }
    per[g.ko] = { mid: [...mids].sort(), matCount: mats.size };
  }
  return JSON.stringify({ source: R.source, mc, per });
})()`));

console.log('\n══ G-17 중간잎 통일 — 브라우저 실측 ══\n');
console.log('등급표 출처: ' + r.source);
ok('① 브라우저도 정본 파일을 읽는다 (밑값으로 안 떨어졌다)',
   r.source === 'data/balance/varie_grades.json', r.source);
ok('② 중간잎 통일이 켜져 있다', r.mc.enabled === true,
   `enabled=${r.mc.enabled} · fromGrade=${r.mc.fromGrade} · why=${r.mc.why}`);

const keys = Object.keys(r.per);
const first = r.per[keys[0]].mid.join(',');
for (const k of keys)
  console.log(`   ${k}: 중간잎 ${r.per[k].mid.join(' ')} · 성숙잎 ${r.per[k].matCount}가지`);
ok('③ ★ 세 등급의 중간잎이 **같은 칸**이다 (그림으로 등급을 못 알아본다)',
   keys.every(k => r.per[k].mid.join(',') === first), first);
ok('④ 성숙잎은 등급마다 다르다 (거기서 갈린다)',
   keys.every(k => r.per[k].matCount >= 10),
   keys.map(k => `${k} ${r.per[k].matCount}`).join(' · '));

console.log(`\n예외 ${errs.length}건` + (errs.length ? '\n  ' + errs.join('\n  ') : ''));
console.log(bad ? `\n✘ ${bad}건 실패` : '\n★ 전부 통과');
await page.close();
process.exit(bad ? 1 : 0);
