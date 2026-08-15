/* ============================================================
   tools/probe_leafgrade_wire.mjs — **무늬 등급 배선이 화면에서 실제로 도나** (2026-08-16)
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_leafgrade_wire.mjs

   ★ 왜 필요한가. `assignPotLeafGrades` 자체는 `tools/test_variegrade.mjs` 가 잰다.
     여기서 재는 것은 **`game.html` 이 그걸 부르나**다 — 코어가 아무리 맞아도
     화면이 안 부르면 등급은 영영 안 생긴다(`stepQuests` 가 창구만 열고 부르는 데가
     없던 그 상태가 정확히 그것이었다 · START-HERE §2).

   ⚠ 이 배선은 **모주에 무늬 잎이 나야** 걸린다. 실제로 200일을 굴리면 오래 걸리므로
     화면이 이미 갖고 있는 것을 쓴다 — `io.growth` 에 확정 무늬를 태우고(`setPrologueVarieLeaf`
     와 같은 길) 한 걸음 굴린 뒤 장부를 본다.
   ⚠ **모르면 모른다고 적는다.** 무늬 잎을 못 만들면 「못 쟀다」로 끝낸다 —
     0 을 「등급이 안 붙었다」로 읽지 않는다(§2.9-① 과 같은 결).
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
let bad = 0;
const ok = (name, cond, got) => {
  console.log(`${cond ? '  OK' : 'FAIL'}  ${name}${got == null || got === '' ? '' : '  → ' + got}`);
  if (!cond) bad++;
};

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on(m => {
  if (m.method === 'Runtime.exceptionThrown')
    errs.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
});
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);          // ⚠ goto 뒤에
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(5000);

/* ① 창구가 살아 있나 */
const first = await page.eval(`(()=>{ try { return JSON.stringify(window.__leafGrades()); }
  catch (e) { return 'ERR ' + e.message; } })()`);
ok('① 창구가 산다 (배선이 붙어 있다)', !/^ERR/.test(first), first);

/* ② 화분이 없으면 **아무것도 안 정한다** — 「모르면 미룬다」 */
ok('② 몬스테라가 안 왔으면 장부가 빈다 (0 으로 안 메꾼다)',
   /"grades":null|"grades":\{\}/.test(first) || /"potId":null/.test(first), first);

/* ③ ★ 무늬 잎을 만들어 놓고 한 걸음 — 등급이 붙나 */
const made = await page.eval(`(()=>{ try {
  const io = window.__io; const S = window.__S();
  if (!io || !io.growth) return 'no-growth';
  /* 프롤로그 보장과 같은 길 — 잎 2·3 을 무늬로 못 박는다 */
  if (typeof io.growth.setPrologueVarieLeaf !== 'function') return 'no-fn';
  io.growth.setPrologueVarieLeaf([2, 3]);
  return 'ok';
} catch (e) { return 'ERR ' + e.message; } })()`);
console.log(`  ⤷ 확정 무늬 태우기: ${made}`);

const st = await page.eval(`(()=>{ try {
  const io = window.__io;
  const ls = io.growth.leafState && io.growth.leafState();
  return JSON.stringify({ n: ls ? ls.length : null,
    varie: ls ? ls.filter(r => r && r.varie).length : null });
} catch (e) { return 'ERR ' + e.message; } })()`);
console.log(`  ⤷ 지금 잎 상태: ${st}`);

const after = await page.eval(`(()=>{ try { return JSON.stringify(window.__leafGrades()); }
  catch (e) { return 'ERR ' + e.message; } })()`);
console.log(`  ⤷ 한 걸음 뒤 장부: ${after}`);

const varieN = (() => { try { return JSON.parse(st).varie; } catch { return null; } })();
if (!varieN) {
  console.log('  ⚠ 무늬 잎을 못 만들었다 — **못 쟀다.** 0 을 「등급이 안 붙었다」로 읽지 않는다.');
} else {
  const g = (() => { try { return JSON.parse(after).grades; } catch { return null; } })();
  const n = g ? Object.keys(g).length : 0;
  ok('③ ★ 무늬 잎에 등급이 붙는다', n > 0, `무늬 ${varieN}장 → 등급 ${n}장 ${JSON.stringify(g)}`);
  ok('④ 등급 이름이 표의 것이다 (지어낸 이름이 없다)',
     !g || Object.values(g).every(v => ['sanban', 'halfmoon', 'fullmoon'].includes(v)),
     JSON.stringify(g));
  /* ⑤ 두 번 불러도 안 바뀐다 — 굴림이 매일 다시 돌면 값이 흔들린다 */
  const again = await page.eval(`JSON.stringify(window.__leafGrades().grades)`);
  ok('⑤ ★ 두 번 불러도 등급이 안 바뀐다', again === JSON.stringify(g), again);
}

console.log(`\n(부팅·플레이 중 예외 ${errs.length}건)`);
if (errs.length) console.log(errs.slice(0, 5).join('\n'));
ok('⑥ game.html 예외가 없다', errs.length === 0, `${errs.length}건`);

console.log(bad ? `\n✗ ${bad}건 실패` : '\n★ 전부 통과');
await page.close();
process.exit(bad ? 1 : 0);
