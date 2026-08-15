/* ============================================================
   tools/test_prologue_varie.mjs — 프롤로그 보장이 **캐논을 깨지 않는가** (2026-08-13)
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_prologue_varie.mjs

   ★ 박사님 확정: *"프롤로그니까 약간 치트성으로 이때만 확정적으로 가이드겸해서
     20프로지만 운좋게 나오는 거로 하면… 2번째 잎일 때 나와서"*

   ★★ 여기서 재는 것은 「보장이 도는가」가 아니라 **「그 보장이 캐논을 안 깨는가」** 다.
     캐논(byeot_growth_chart_인계)은 *"변이는 잎마다 독립 판정, 기본 20%"* 이고,
     보장은 **그 굴림에 진 잎 한 장만** 참으로 덮는 장치라야 한다.
     넷 중 하나라도 어긋나면 그건 확률을 건드린 것이다:

       ① **기본이 꺼져 있다** — 아무도 안 켜면 아무 일도 안 난다
          (단독 확대창·방 조립기 `plant_assemble` 이 그 경우다. 거기서 돌면 캐논이 갈린다)
       ② 켜도 **`P.varieProb` 은 그대로 0.20** 이다
       ③ **딱 한 장이다** — 두 번째 잎에만 붙는다
       ④ **같은 씨앗을 겹쳐 보면 달라진 잎이 그 한 장뿐이다** ← 이게 제일 센 자다.
          난수 스트림이 한 칸이라도 밀렸으면 뒤쪽 잎의 판정이 같이 흔들린다.

   ⚠ 이 검사를 `test_monstera_canon.mjs` 에 안 넣었다 — 그 파일에 다른 창의 작업이
     커밋 안 된 채 들어 있어서(§J 방 조립기) 같이 커밋되면 남의 작업을 쓸어 담는다.
     캐논이 「20%」를 못 박는 자는 그쪽 §B 이고, 여기는 **그 §B 가 살아 있나**를 잰다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const _WD = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WD);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };

const page = await launch({ width: 400, height: 600, dpr: 1, mobile: false });
await page.goto(`${BASE}/plant_grow.html?embed=game`);
await page.waitFor('typeof window.setGrowth === "function"', 180000, 300);
await page.waitFor('window.thLoaded() === true', 180000, 300);
await sleep(1500);

/* ── A. 창구가 있고, 기본이 꺼져 있다 ── */
console.log('\nA. 창구 · 기본값');
{
  const r = await page.eval(`JSON.stringify({
    hasSet: typeof setPrologueVarieLeaf === 'function',
    hasGet: typeof prologueVarieState === 'function',
    st: (typeof prologueVarieState==='function') ? prologueVarieState() : null,
    prob: P.varieProb })`).then(JSON.parse);
  ok(r.hasSet && r.hasGet, '창구 둘이 있다 — setPrologueVarieLeaf · prologueVarieState');
  ok(r.st && r.st.leafNo === 0,
     `부팅 기본은 **꺼짐**이다 (leafNo ${r.st && r.st.leafNo}) — 안 켜면 안 돈다`);
  ok(r.prob === 0.20, `확률 정본이 캐논값이다 — varieProb ${r.prob}`);
}

/* ── B. 같은 씨앗을 겹쳐 본다 — 달라진 잎이 그 한 장뿐인가 ── */
console.log('\nB. 보장 켬/끔을 겹쳐 본다 (seed 92158 · DLI 8 · 400일)');
{
  const r = await page.eval(`(()=>{
    const probBefore = P.varieProb;
    plantSeed(92158); matResetAll(); resetDailyLight(); setPrologueVarieLeaf(0);
    setGrowth(0); setDailyLightSteady(8); for(let d=1; d<=400; d++) advanceTo(d);
    const plain = varieStateAll().map(x=>[x.leafBirth, x.varie, x.prologue]);
    plantSeed(92158); matResetAll(); resetDailyLight(); setPrologueVarieLeaf(2);
    setGrowth(0); setDailyLightSteady(8); for(let d=1; d<=400; d++) advanceTo(d);
    const armed = varieStateAll().map(x=>[x.leafBirth, x.varie, x.prologue]);
    const probAfter = P.varieProb, st = prologueVarieState();
    setPrologueVarieLeaf(0);
    return JSON.stringify({ plain, armed, probBefore, probAfter, st }); })()`).then(JSON.parse);

  console.log(`    보장 없이: ${JSON.stringify(r.plain)}`);
  console.log(`    보장 켜고: ${JSON.stringify(r.armed)}`);
  ok(r.probBefore === 0.20 && r.probAfter === 0.20,
     `켜도 확률 정본이 그대로다 — ${r.probBefore} → ${r.probAfter}`);
  ok(r.plain.length === r.armed.length,
     `잎 수가 같다 — ${r.plain.length}장 (난수 스트림이 안 밀렸다)`);
  ok(r.plain.every(x => !x[2]), '보장을 끄면 표식이 한 장도 안 붙는다');

  const marked = r.armed.filter(x => x[2]);
  ok(marked.length <= 1, `보장 표식은 많아야 한 장이다 (${marked.length}장)`);
  /* ★ 제일 센 자 — 두 판에서 **달라진 잎**이 보장 그 한 장뿐이라야 한다 */
  const diff = r.armed.filter((x, i) => r.plain[i] && r.plain[i][1] !== x[1]).map(x => x[0]);
  ok(diff.length <= 1, `보장 말고는 한 잎도 안 바뀐다 — 달라진 잎 ${diff.length}장 ${JSON.stringify(diff)}`);
  if (marked.length) {
    const idx = r.armed.findIndex(x => x[2]);
    ok(idx === 1, `보장이 붙은 것은 **두 번째** 잎이다 (${idx + 1}번째 · leafBirth ${r.armed[idx][0]})`);
    ok(diff.length === 1 && diff[0] === r.armed[idx][0], `달라진 잎이 곧 그 잎이다 — leafBirth ${diff[0]}`);
    ok(r.armed.slice(2).every(x => !x[2]),
       `세 번째 잎부터는 안 붙는다 — 뒤 ${r.armed.length - 2}장 전부 굴림`);
    /* 캐논이 살아 있다는 직접 증거 — 보장이 안 붙은 잎 중에도 무늬가 나야 한다 */
    const rolled = r.armed.filter((x, i) => i !== idx && x[1]).length;
    ok(rolled > 0, `보장 밖에서도 굴림으로 무늬가 난다 — ${rolled}장 (20% 가 살아 있다)`);
  } else {
    console.log('    (이 씨앗은 두 번째 잎이 굴림으로 이미 무늬라 보장이 안 쓰였다 — 그것도 규칙이다)');
  }
}

/* ── C. 이미 무늬가 났으면 안 준다 · 한 번만 준다 ── */
console.log('\nC. 안 주는 경우');
{
  const r = await page.eval(`(()=>{
    /* varieProb 1.0 = 첫 잎부터 무조건 무늬(튜닝용 값 — 끝나고 되돌린다).
       이미 무늬가 난 판에서는 보장이 **한 장도 안 붙어야** 한다. */
    P.varieProb = 1;
    plantSeed(92158); matResetAll(); resetDailyLight(); setPrologueVarieLeaf(2);
    setGrowth(0); setDailyLightSteady(8); for(let d=1; d<=200; d++) advanceTo(d);
    const all = varieStateAll();
    const st = prologueVarieState();
    P.varieProb = 0.20; setPrologueVarieLeaf(0);
    plantSeed(92158); matResetAll(); resetDailyLight();
    return JSON.stringify({ marked: all.filter(x=>x.prologue).length, leaves: all.length, st }); })()`)
    .then(JSON.parse);
  ok(r.marked === 0,
     `이미 무늬가 난 그루에는 **덤을 안 준다** — 잎 ${r.leaves}장 중 보장 ${r.marked}장`);
  ok(r.st.leafBirth === null && r.st.used === false, '장부도 안 적힌다 (used=false)');
}

/* ── D. `shown` — 무늬가 **화면에 보이는** 순간을 낸다 ──
   ★ 왜 필요한가. 잎이 세어지는 날(leafStats)과 무늬가 보이는 날이 다르다:
     `drawLeafStage` 는 성숙도 0.22 아래를 말린 새순·펴지는 중으로 그려 무늬가 안 보인다.
     화면이 「운이 좋았다」를 말하는 날은 **보이는 날**이라야 한다. */
console.log('\nD. shown — 무늬가 실제로 그려지는 날을 낸다');
{
  const r = await page.eval(`(()=>{
    plantSeed(92158); matResetAll(); resetDailyLight(); setPrologueVarieLeaf(2);
    setDailyLightSteady(4.8); setGrowth(45);
    const rows=[];
    for(const stop of [70, 80, 90, 120]){
      while(growthDays()<stop) advanceTo(calendarDay()+1);
      rows.push([stop, leafStats().variegatedLeaves, prologueVarieState().shown,
                 growthPhase().phaseId]);
    }
    setPrologueVarieLeaf(0);
    return JSON.stringify(rows); })()`).then(JSON.parse);
  for (const [g, v, shown, ph] of r)
    console.log(`    유효 ${g} · leafStats 무늬 ${v}장 · shown ${shown} · ${ph}`);
  const counted = r.find(x => x[1] > 0), shown = r.find(x => x[2]);
  ok(counted && shown, 'leafStats 가 세는 날과 보이는 날이 둘 다 잡힌다');
  ok(counted && shown && counted[0] <= shown[0],
     `보이는 날이 세는 날보다 **뒤**다 — 세는 유효 ${counted && counted[0]} → 보이는 유효 ${shown && shown[0]}`);
  ok(shown && shown[0] >= 90, `무늬가 보이기 전에 참이 되지 않는다 (유효 ${shown && shown[0]})`);
}

/* ── E. ★★ 두 장 보장 (2026-08-15 박사님 확정 — 잎 2·3) ──
   ★ 한 장이면 어느 쪽으로도 못 간다: 모주에 두면 탈출이 안 열리고, 떼면 모주가 0 등급이 된다.
     두 장이라야 「한 장은 잘라 꽂고 한 장은 남긴다」가 성립한다.
   ⚠ 여기서도 재는 것은 **캐논이 안 깨졌는가**다 — 확률·난수 스트림·잎 수가 그대로여야 한다. */
console.log('\nE. 두 장 보장 — 잎 2·3 (seed 92158 · DLI 8 · 400일)');
{
  const r = await page.eval(`(()=>{
    const probBefore = P.varieProb;
    plantSeed(92158); matResetAll(); resetDailyLight(); setPrologueVarieLeaf(0);
    setGrowth(0); setDailyLightSteady(8); for(let d=1; d<=400; d++) advanceTo(d);
    const plain = varieStateAll().map(x=>[x.leafBirth, x.varie, x.prologue]);
    plantSeed(92158); matResetAll(); resetDailyLight(); setPrologueVarieLeaf([2,3]);
    setGrowth(0); setDailyLightSteady(8); for(let d=1; d<=400; d++) advanceTo(d);
    const armed = varieStateAll().map(x=>[x.leafBirth, x.varie, x.prologue]);
    const st = prologueVarieState(), probAfter = P.varieProb;
    setPrologueVarieLeaf(0);
    return JSON.stringify({ plain, armed, st, probBefore, probAfter }); })()`).then(JSON.parse);

  console.log(`    보장 없이: ${JSON.stringify(r.plain)}`);
  console.log(`    2·3 보장: ${JSON.stringify(r.armed)}`);
  console.log(`    장부: leafNos ${JSON.stringify(r.st.leafNos)} · 준 잎 ` +
              `${JSON.stringify(r.st.leaves.map(l => [l.leafNo, l.leafBirth]))}`);
  ok(r.probBefore === 0.20 && r.probAfter === 0.20,
     `두 장을 켜도 확률 정본이 그대로다 — ${r.probBefore} → ${r.probAfter}`);
  ok(r.plain.length === r.armed.length,
     `잎 수가 같다 — ${r.plain.length}장 (난수 스트림이 안 밀렸다)`);
  ok(JSON.stringify(r.st.leafNos) === JSON.stringify([2, 3]), '목록이 2·3 이다');

  const varied = r.armed.filter(x => x[1]).length;
  ok(varied >= 2, `무늬 잎이 **두 장 이상**이다 — ${varied}장 (한 장이면 여기서 못 나간다)`);
  const marked = r.armed.map((x, i) => x[2] ? i + 1 : 0).filter(Boolean);
  ok(marked.length > 0 && marked.every(n => n === 2 || n === 3),
     `보장 표식이 2·3번째 잎에만 붙는다 — ${JSON.stringify(marked)}`);
  /* ★ 제일 센 자 — 두 판에서 달라진 잎이 **보장 준 그 잎들뿐**이라야 한다 */
  const diff = r.armed.filter((x, i) => r.plain[i] && r.plain[i][1] !== x[1]).map(x => x[0]);
  const givenBirths = r.st.leaves.map(l => l.leafBirth);
  ok(diff.every(b => givenBirths.includes(b)),
     `보장 말고는 한 잎도 안 바뀐다 — 달라진 잎 ${JSON.stringify(diff)} · 준 잎 ${JSON.stringify(givenBirths)}`);
  ok(r.armed.slice(3).every(x => !x[2]),
     `네 번째 잎부터는 안 붙는다 — 뒤 ${Math.max(0, r.armed.length - 3)}장 전부 굴림`);
}

/* ── F. 두 장을 켜도 「이미 다 났으면」 안 준다 ── */
console.log('\nF. 두 장 보장 — 운으로 이미 두 장이 났으면 덤을 안 준다');
{
  const r = await page.eval(`(()=>{
    P.varieProb = 1;                                   /* 첫 잎부터 무조건 무늬(튜닝용) */
    plantSeed(92158); matResetAll(); resetDailyLight(); setPrologueVarieLeaf([2,3]);
    setGrowth(0); setDailyLightSteady(8); for(let d=1; d<=200; d++) advanceTo(d);
    const all = varieStateAll(), st = prologueVarieState();
    P.varieProb = 0.20; setPrologueVarieLeaf(0);
    plantSeed(92158); matResetAll(); resetDailyLight();
    return JSON.stringify({ marked: all.filter(x=>x.prologue).length, leaves: all.length, st }); })()`)
    .then(JSON.parse);
  ok(r.marked === 0,
     `이미 두 장이 난 그루에는 덤을 안 준다 — 잎 ${r.leaves}장 중 보장 ${r.marked}장`);
  ok(r.st.leaves.length === 0, '장부도 안 적힌다');
}

/* ── G. 한 장짜리 옛 호출(숫자 하나)이 그대로 산다 ── */
console.log('\nG. 옛 호출부 — setPrologueVarieLeaf(2) 가 예전과 같다');
{
  const r = await page.eval(`(()=>{
    plantSeed(92158); matResetAll(); resetDailyLight();
    const one = setPrologueVarieLeaf(2);
    const two = setPrologueVarieLeaf([2,3]);
    setPrologueVarieLeaf(0);
    return JSON.stringify({ one, two }); })()`).then(JSON.parse);
  ok(JSON.stringify(r.one.leafNos) === JSON.stringify([2]) && r.one.leafNo === 2,
     `숫자 하나를 넘기면 한 장이다 — leafNos ${JSON.stringify(r.one.leafNos)} · 옛 이름 leafNo ${r.one.leafNo}`);
  ok(r.two.leafNo === 2, `옛 이름(leafNo)은 **첫 장**을 낸다 — ${r.two.leafNo}`);
}

await page.close();
console.log(fails ? `\nprologue_varie: FAIL ${fails}건` : '\nprologue_varie: PASS');
process.exit(fails ? 1 : 0);
