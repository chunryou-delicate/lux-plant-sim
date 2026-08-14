/* ============================================================
   tools/test_monstera_canon.mjs — 몬스테라 캐논이 실제로 지켜지나 (2026-08-16)
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_monstera_canon.mjs

   ★ 왜 이 검사가 있나. 캐논(docs/byeot_growth_chart_인계.md)은 문서에만 있었고,
     「지금 코드가 정말 그런가」를 아무도 재고 있지 않았다. 이 저장소가 열세 번 당한
     사고가 정확히 그것이다 — **낡은 문서가 재는 자가 된다.**
     그래서 여기서는 문서를 읽지 않고 **엔진에게 직접 묻는다.**

   ⚠⚠ **이 검사는 「지금 이렇다」를 못 박는 자가 아니다.** 캐논이 말하는 것만 건다.
     지금 코드가 캐논과 어긋난 것이 하나 있는데(가지의 발아 순서 — 아래 §F 참고)
     **일부러 안 걸었다.** 어긋난 상태를 검사가 정상으로 못 박으면 고치는 쪽이
     검사를 깨게 된다(START-HERE §2). 그 항목은 재서 **찍어만 준다.**

   재는 것
     A 씨앗 발아 순서 — 잎자루(마디)가 먼저, 새순이 나중
     B 변이는 **잎마다** 독립 판정이고, 한 번 정하면 안 바뀐다
     C mid → 성숙(갈라짐)은 **시간이 아니라 확률**이다
     D 빛 이력이 없으면 무늬 확률이 **0** 이다(정정 2026-08-03 이 여기 걸린다)
     E 빛이 다르면 다르게 자란다 — 어두우면 유효 생장일이 **안 오른다**
     F (표시만) 가지의 발아 순서 — 잎자루보다 새순이 먼저 나온다
     G 방 조립기가 `leafState` 를 받으면 정본과 같은 잎을 그린다
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const _WD = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 600000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WD);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };

const page = await launch({ width: 400, height: 600, dpr: 1, mobile: false });
await page.goto(`${BASE}/plant_grow.html?embed=game`);
await page.waitFor('typeof window.setGrowth === "function"', 180000, 300);
await page.waitFor('window.thLoaded() === true', 180000, 300);
await sleep(2000);

const P = await page.eval(`JSON.stringify(leafStageParams())`).then(JSON.parse);
console.log(`격자: seedEnd ${P.seedEnd} · petGrow ${P.petGrow} · spawnStep ${P.spawnStep} · ` +
            `matSpan ${P.matSpan} · stageYoung ${P.stageYoung} · stageMid ${P.stageMid}`);

/* ── A. 씨앗 발아 순서 ── */
console.log('\nA. 발아 순서 — 씨앗 → 잎자루 → 새순');
{
  const r = await page.eval(`(()=>{ const a=topologyNow(${P.seedEnd + 1})[0];
    const seg=a.segs.filter(s=>s.birth<=${P.seedEnd + 1}).length;
    return JSON.stringify({birth:a.birth, leafBirth:a.leafBirth, seg}); })()`).then(JSON.parse);
  ok(r.seg >= 1, `밑동 축이 나자마자 잎자루 마디가 있다 (마디 ${r.seg}개)`);
  ok(r.leafBirth > r.birth,
     `새순은 그 뒤에 난다 — 축 ${r.birth} → 잎 ${r.leafBirth} (${r.leafBirth - r.birth}일 뒤)`);
  const noLeaf = await page.eval(`(()=>{ const g=${P.seedEnd + Math.floor(P.petGrow / 2)};
    const a=topologyNow(g)[0]; return g < a.leafBirth && a.segs.filter(s=>s.birth<=g).length>=1; })()`);
  ok(noLeaf, `그 사이(잎자루가 자라는 동안)에는 잎이 없다`);
}

/* ── B·C·D. 무늬·성숙 ── */
console.log('\nB. 변이는 잎마다 독립 · 한 번 정하면 안 바뀐다');
{
  const r = await page.eval(`(()=>{
    matResetAll(); resetDailyLight(); setGrowth(0); setDailyLightSteady(8);
    for(let d=1; d<=400; d++) advanceTo(d);
    const a=varieStateAll().map(x=>[x.leafBirth, x.varie]);
    // 빛을 바꿔도 이미 난 잎의 무늬 판정은 안 흔들려야 한다
    resetDailyLight(); setDailyLightSteady(0.4);
    for(let d=401; d<=430; d++) advanceTo(d);
    const b=varieStateAll().map(x=>[x.leafBirth, x.varie]);
    return JSON.stringify({a, b, keys:a.length}); })()`).then(JSON.parse);
  ok(r.keys >= 2, `잎(leafBirth)마다 칸이 하나씩 있다 — ${r.keys}칸: ${JSON.stringify(r.a)}`);
  ok(JSON.stringify(r.a) === JSON.stringify(r.b.slice(0, r.a.length)),
     `빛을 8 → 0.4 로 떨어뜨려도 이미 난 잎의 판정이 안 바뀐다`);
}

console.log('\nC. mid → 성숙은 시간이 아니라 확률');
{
  const r = await page.eval(`(()=>{
    matResetAll(); resetDailyLight(); setGrowth(0); setDailyLightSteady(4.8);
    for(let d=1; d<=300; d++) advanceTo(d);
    const m=matStateAll();
    return JSON.stringify({ st:leafStats(),
      rolls:m.reduce((a,b)=>a+b.rolls,0), failed:m.filter(x=>!x.matured&&x.rolls>0).length,
      rows:m.map(x=>[x.leafBirth,x.rolls,x.matured?1:0]) }); })()`).then(JSON.parse);
  ok(r.rolls > r.st.matureLeaves,
     `굴림이 성공보다 많다 — 굴림 ${r.rolls}회 / 성숙 ${r.st.matureLeaves}장 (실패가 실재한다)`);
  ok(r.failed > 0,
     `시간이 다 됐는데도 아직 안 갈라진 잎이 있다 — ${r.failed}장 ${JSON.stringify(r.rows)}`);
}

console.log('\nD. 빛 이력이 없으면 무늬 확률이 0');
{
  const r = await page.eval(`(()=>{ matResetAll(); resetDailyLight();
    return JSON.stringify({ vp:calcVarieProb({}), d7:dli7() }); })()`).then(JSON.parse);
  ok(r.d7 === null && r.vp === 0, `빛 이력 없음 → 무늬 확률 ${r.vp} (dli7 ${r.d7})`);
}

/* ── E. 빛이 다르면 다르게 자란다 ── */
console.log('\nE. 빛이 다르면 다르게 자란다');
{
  /* ⚠ setGrowth 는 달력도 같이 옮긴다. advanceTo 는 **하루씩만** 받으므로
     거기서부터 이어 걸어야 한다(여기서 1일부터 세면 delta 가 음수라 던진다). */
  const run = (dli) => page.eval(`(()=>{ matResetAll(); resetDailyLight(); setGrowth(45);
    setDailyLightSteady(${dli});
    const c0=calendarDay();
    for(let d=c0+1; d<=c0+70; d++) advanceTo(d);
    return JSON.stringify({eff:growthDays(), st:leafStats(), gauge:matGaugeStep()}); })()`).then(JSON.parse);
  const bright = await run(4.8), dark = await run(0.1);
  ok(bright.eff > 45 + 60, `밝은 자리(4.8) — 70일에 유효 45 → ${bright.eff}`);
  ok(dark.eff === 45, `어두운 자리(0.1) — 70일에 유효 45 → ${dark.eff} (안 자란다)`);
  ok(dark.gauge === 0, `어두우면 성숙 기회 자체가 안 온다 (게이지 걸음 ${dark.gauge})`);
}

/* ── F. 가지의 발아 순서 — ★캐논과 어긋난다. 걸지 않고 찍어만 준다 ── */
console.log('\nF. (표시만) 가지의 발아 순서 — ⚠ 캐논과 어긋나 있다');
{
  const r = await page.eval(`(()=>{
    const out=[];
    for(const g of [110,120,130,136,140,150]){
      const ax=topologyNow(g).filter(a=>a.from);
      if(!ax.length){ out.push({g, br:0}); continue; }
      const a=ax[0];
      out.push({g, br:ax.length, birth:a.birth, leafBirth:a.leafBirth,
                seg:a.segs.filter(s=>s.birth<=g).length, leaf:g>=a.leafBirth});
    }
    return JSON.stringify(out); })()`).then(JSON.parse);
  const bad = r.filter(x => x.leaf && x.seg === 0);
  for (const x of r) console.log('    ' + JSON.stringify(x));
  console.log(bad.length
    ? `    ⚠ 잎자루(마디)가 0개인데 새순이 먼저 나는 구간이 있다 — ${bad.map(x => 'g' + x.g).join(', ')}\n` +
      `      캐논은 「눈 → 가는 잎자루 먼저(새순 없이) → 그 끝에서 새순」이다.\n` +
      `      고치려면 생장 격자·난수 스트림이 움직인다 → docs/handoff/monstera-to-plan.md §3`
    : `    (지금은 어긋나지 않는다 — 고쳐졌으면 이 절을 검사로 올려라)`);
}

/* ── G. 방 조립기가 정본 상태를 받아 그리나 ── */
console.log('\nG. 방 조립기 — leafState 를 받으면 정본과 같은 잎을 그린다');
{
  const truth = await page.eval(`(()=>{
    matResetAll(); resetDailyLight(); setGrowth(0); setDailyLightSteady(4.8);
    for(let d=1; d<=300; d++) advanceTo(d);
    const v=new Map(varieStateAll().map(x=>[x.leafBirth,x.varie]));
    const h=new Map(leafHealthAll().map(x=>[x.leafBirth,x]));
    const seen=new Set(), out=[];
    for(const m of matStateAll()){ seen.add(m.leafBirth);
      out.push({leafBirth:m.leafBirth, varie:!!v.get(m.leafBirth), matured:!!m.matured,
                fade:(h.get(m.leafBirth)||{}).fade||0, dropped:!!(h.get(m.leafBirth)||{}).dropped}); }
    for(const [lb,varie] of v) if(!seen.has(lb))
      out.push({leafBirth:lb, varie:!!varie, matured:false, fade:(h.get(lb)||{}).fade||0, dropped:false});
    return JSON.stringify({days:growthDays(), st:leafStats(), leafState:out}); })()`).then(JSON.parse);

  const cnt = await page.eval(`(async()=>{
    const m = await import('/src/render3d/plant_assemble.js');
    const asm = await m.getPlantAssembler({});
    const count = (g)=>{ let mat=0, leaf=0;
      g.traverse(o=>{ const k=o.userData&&o.userData.assetKey; if(!k) return;
        if(/^leaf_/.test(k)) leaf++; if(/^leaf_mature|^leaf_mat\\d/.test(k)) mat++; });
      return {leaf, mat}; };
    const off = count(asm.assemble({growthDays:${truth.days}, seed:92158, potD:0.20}));
    const on  = count(asm.assemble({growthDays:${truth.days}, seed:92158, potD:0.20,
                                    leafState:${JSON.stringify(truth.leafState)}}));
    return JSON.stringify({off, on}); })()`).then(JSON.parse);

  console.log(`    정본(창턱 4.8 · 유효 ${truth.days}일): 잎 ${truth.st.leaves} · 갈라짐 ${truth.st.matureLeaves}`);
  console.log(`    방(상태 안 넘김): 갈라짐 ${cnt.off.mat} · (넘김): ${cnt.on.mat}`);
  ok(cnt.on.mat === truth.st.matureLeaves,
     `leafState 를 넘기면 방의 갈라진 잎 수가 정본과 같다 (${cnt.on.mat} = ${truth.st.matureLeaves})`);
  ok(cnt.off.mat < truth.st.matureLeaves,
     `안 넘기면 모자란다 — 방이 자기 굴림으로는 ${cnt.off.mat}장밖에 못 낸다(빛 이력이 없어서)`);
}

await page.close();
console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과');
process.exit(fails ? 1 : 0);
