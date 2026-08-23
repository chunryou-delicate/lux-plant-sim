/* ============================================================
   tools/probe_pantrysale.mjs — **「팔면 몇 % 받습니다」가 참말인가**
   ------------------------------------------------------------
   [Plan] 물음: *"무순을 팔 때 화면이 몇 %라고 말합니까"*
   ⚠ 코드만 읽어서는 **못 하는 말**이다(계율 ㊱). 그래서 «눌러서» 본다.

   ★ 재는 것 셋
     ① 곳간이 «콩나물뿐»일 때 화면이 말하는 %
     ② 곳간이 «무순뿐»일 때
     ③ ★ «섞였을» 때 — 화면은 `pantrySellN`(처음엔 1판) 기준으로 셈하므로
       「맨 앞 한 판」의 비율을 말할 수 있다. 그러면 섞인 곳간에서 «틀린 수»가 된다.
   ⇒ 엔진이 내는 참값과 나란히 찍어 **어긋나면 그 자리에서 보인다.**

   ⚠ 이 자는 곳간을 «만들어 넣는다» — 판을 굴리지 않는다. game.html 이 내준
     읽기용 손잡이(`__S`·`__redraw`)를 쓰는, 그 파일이 적어 둔 그대로의 진단 용도다.
   ⚠ 값은 하나도 안 바꾼다. 곳간 꾸러미만 세워 놓고 «화면이 뭐라 하나»를 본다.

     python tools/serve.py 8972 .
     BYEOT_URL=http://localhost:8972 node tools/probe_pantrysale.mjs
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 240000);
wd.unref && wd.unref();

const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);

/* 곳간을 세워 놓는다 — 꾸러미 몇 판. day/meals 는 화면이 읽는 값이라 참되게 넣는다. */
const setPantry = async (lots) => page.eval(`(async()=>{ try{
  const S = window.__S(), fp = S.firstPlay;
  if (!fp || !fp.food) return JSON.stringify({ err: '첫 플레이 상태가 없다' });
  fp.food.pantryLots = ${JSON.stringify(lots)};
  fp.food.pantryWon = ${lots.reduce((a, l) => a + l.won, 0)};
  window.__redraw();
  return JSON.stringify({ ok: true });
} catch(e){ return JSON.stringify({ err: e.message }); } })()`);

/* 화면이 뭐라 하나 · 엔진이 뭐라 하나 — 나란히 */
const read = async () => page.eval(`(async()=>{ try{
  const St = await import('/src/game/state.js');
  const S = window.__S();
  const hint = (document.getElementById('pantryHint')||{}).textContent || '';
  const btn  = (document.getElementById('sellPantry')||{}).textContent || '';
  const one  = St.pantrySaleStatus(S, 1);      /* 화면이 처음 쓰는 값 — 한 판 */
  const all  = St.pantrySaleStatus(S, 999);    /* 곳간을 다 팔 때 */
  return JSON.stringify({ hint: hint.replace(/\s+/g,' ').trim(), btn: btn.trim(),
    oneRate: Math.round(one.rate*100), oneWon: one.won, oneLots: one.lots,
    allRate: Math.round(all.rate*100), allWon: all.won, allLots: all.lots });
} catch(e){ return JSON.stringify({ err: e.message }); } })()`);

const L = (kind, n, won) => Array.from({ length: n }, (_, i) => ({ kind, day: 10 + i, won, meals: 3 }));
const CASES = [
  ['① 콩나물만 3판',            [...L('beansprout', 3, 10000)]],
  ['② 무순만 3판',              [...L('musun', 3, 7000)]],
  ['③ ★ 섞임 — 콩나물 먼저',    [...L('beansprout', 2, 10000), ...L('musun', 2, 7000)]],
  ['④ ★ 섞임 — 무순 먼저',      [...L('musun', 2, 7000), ...L('beansprout', 2, 10000)]]
];

for (const [ko, lots] of CASES) {
  const s = JSON.parse(await setPantry(lots));
  if (s.err) { console.log(ko, '✘', s.err); continue; }
  await sleep(300);
  const r = JSON.parse(await read());
  if (r.err) { console.log(ko, '✘', r.err); continue; }
  console.log(`\n${ko}`);
  console.log(`   화면 단추 — ${r.btn}`);
  console.log(`   화면 안내 — ${r.hint}`);
  console.log(`   엔진 — 한 판 ${r.oneRate}% (${r.oneWon.toLocaleString()}원) · ` +
              `다 팔면 ${r.allRate}% (${r.allLots}판 ${r.allWon.toLocaleString()}원)`);
  const said = (r.hint.match(/(\d+)%/) || [])[1];
  if (said == null) console.log('   ⇒ ⚠ 화면이 %를 «안 말한다»');
  else if (Number(said) === r.allRate) console.log(`   ⇒ ✔ 화면 ${said}% = 다 팔 때의 참값`);
  else if (Number(said) === r.oneRate) console.log(`   ⇒ ⚠ 화면 ${said}% 는 «한 판» 기준이다 — 다 팔면 ${r.allRate}% 다`);
  else console.log(`   ⇒ ⛔ 화면 ${said}% 가 «둘 다 아니다» (한 판 ${r.oneRate}% · 다 ${r.allRate}%)`);
}
await page.close(); clearTimeout(wd);
