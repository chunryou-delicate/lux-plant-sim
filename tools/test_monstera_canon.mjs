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
     H 방 조립기는 **받은 유효일 그대로** 그린다 (도착 45일이 365일로 안 커진다)
     I 무늬는 **쓸 때 받는다** — 부팅 때 skins/ 를 안 받고, 나면 그 장만 받아 실제로 그린다
     J **방(3D)에도 무늬 잎이 난다** — 정본이 무늬라 한 잎만, 원본 텍스처 그대로
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

/* ★ 부팅 직후의 짐 — **여기서 재야 한다.** 아래 절들이 빛 8 로 키우면서 무늬를 받게 되므로,
   나중에 재면 「부팅 때 안 받았다」를 확인할 수가 없다(§I 가 이 값을 쓴다). */
const BOOT = await page.eval(`JSON.stringify({
  glb: performance.getEntriesByType('resource').filter(r=>/\\.glb$/.test(r.name)).length,
  mb: +(performance.getEntriesByType('resource').reduce((a,r)=>a+(r.transferSize||0),0)/1048576).toFixed(2),
  skins: (typeof skinsLoaded==='function') ? skinsLoaded() : null })`).then(JSON.parse);

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

/* ── F. 가지의 발아 순서 — ★2026-08-17 고침. 이제 진짜로 건다 ──
   전에는 여기서 재서 찍어만 주었다. 가지 축이 격자 밖(격자+bumpGrow)에서 태어나는데
   마디는 격자에서만 나서, 잎(축+petGrow)이 첫 마디보다 4일 먼저 났기 때문이다.
   지금은 축이 나는 그 날 첫 마디를 같이 심는다 — 밑동(§A)과 **같은 규칙**이다.
   ⇒ 캐논이 지켜지므로 검사로 올렸다. 실측 전/후는 docs/handoff/monsterabranch-to-plan.md */
console.log('\nF. 가지의 발아 순서 — 눈 → 잎자루 먼저 → 그 끝에서 새순 (§A 와 같은 순서)');
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
  for (const x of r) console.log('    ' + JSON.stringify(x));
  ok(r.filter(x => x.leaf && x.seg === 0).length === 0,
     `새순이 났는데 잎자루(마디)가 0개인 나이가 없다`);

  /* 축 하나하나가 밑동과 같은 규칙을 따르는가 — 첫 마디는 제 생일에, 잎은 그 뒤 petGrow 일에 */
  const s = await page.eval(`(()=>{
    const bad=[], seen=[];
    for(const seed of [92158, 12345, 55555]){
      plantSeed(seed);
      for(const a of topologyNow(600)){
        if(!a.segs.length) continue;                       // 갓 난 축(아직 이 날에 안 닿음)은 건너뛴다
        seen.push(1);
        if(a.segs[0].birth !== a.birth) bad.push({seed, br:!!a.from, birth:a.birth, seg0:a.segs[0].birth});
        if(a.leafBirth !== a.birth+${P.petGrow}) bad.push({seed, leafBirth:a.leafBirth, birth:a.birth});
      }
    }
    plantSeed(92158);                                      // ⚠ 뒤 절이 기본 시드로 잰다. 반드시 되돌린다
    return JSON.stringify({bad, n:seen.length}); })()`).then(JSON.parse);
  ok(s.bad.length === 0,
     `축 ${s.n}개(시드 3개) 전부 「첫 마디 = 제 생일 · 잎 = 그 뒤 ${P.petGrow}일」 ${JSON.stringify(s.bad).slice(0, 200)}`);

  /* 나이를 하루씩 걸어도 어긋나는 날이 없는가 — 어긋남은 4일짜리라 띄엄띄엄 재면 놓친다 */
  const w = await page.eval(`(()=>{ const bad=[];
    for(let g=${P.seedEnd}; g<=400; g++)
      for(const a of topologyNow(g)){
        if(g < a.leafBirth) continue;
        if(a.segs.filter(x=>x.birth<=g).length===0) bad.push({g, br:!!a.from, leafBirth:a.leafBirth});
      }
    return JSON.stringify({n:bad.length, head:bad.slice(0,6)}); })()`).then(JSON.parse);
  ok(w.n === 0, `나이 ${P.seedEnd}~400 을 하루씩 걸어도 잎자루 없는 새순이 없다 ` +
                `(어긋난 날 ${w.n}${w.n ? ' ' + JSON.stringify(w.head) : ''})`);
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
    /* ★ 조립기를 **연 직후** 몇 장 받았나 — §J 가 "부팅 때 0장"을 여기서 가져다 쓴다.
       (싱글턴이라 §J 에서는 다시 열 수가 없다. 여는 순간을 지나치면 못 잰다) */
    if (window.__asmBoot0 == null) window.__asmBoot0 = asm.skinsLoaded();
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

/* ── H. 방 조립기는 받은 유효일 그대로 그린다 ──
   ★ 2026-08-17 — 「방에서는 크고 확대하면 작다」가 여기서 났다. 방이 유효일을 **못 받으면**
     room_view 가 데모 기본값(365일)으로 짐작해 그린다. 도착(유효 45일) 순간과 세이브를
     다시 연 직후가 그랬다 — 잎 한 장짜리 대신 다섯 장짜리가 섰다
     (실측·그림 docs/handoff/monsterasize-to-plan.md §2).
   ⚠ 짐작하는 자리는 room_view.js 라 이 창이 못 고쳤다. 여기서는 **조립기 쪽 계약**을 건다 —
     「받은 날짜대로 그린다」가 깨지면 그때는 조립기가 범인이다. */
console.log('\nH. 방 조립기 — 받은 유효일 그대로 그린다');
{
  const truth = await page.eval(`(()=>{ plantSeed(92158); matResetAll(); resetDailyLight();
    const out={}; for(const d of [45,150,365]){ setGrowth(d); out[d]=leafStats().leaves; }
    return JSON.stringify(out); })()`).then(JSON.parse);
  const room = await page.eval(`(async()=>{
    const m = await import('/src/render3d/plant_assemble.js');
    const asm = await m.getPlantAssembler({});
    const out={};
    for(const d of [45,150,365]){
      const g = asm.assemble({growthDays:d, seed:92158, potD:0.20});
      let leaf=0; g.traverse(o=>{ const k=o.userData&&o.userData.assetKey;
        if(k && /^leaf_/.test(k)) leaf++; });
      const bb=new THREE.Box3().setFromObject(g);
      out[d]={ days:g.userData.growthDays, leaf, h:+(bb.max.y-bb.min.y).toFixed(4) };
    }
    return JSON.stringify(out); })()`).then(JSON.parse);
  for (const d of [45, 150, 365])
    console.log(`    유효 ${d}일 — 정본 잎 ${truth[d]} · 방 잎 ${room[d].leaf} · 방 키 ${room[d].h}m`);
  ok([45, 150, 365].every(d => room[d].days === d), `방이 받은 날짜를 그대로 적는다`);
  ok([45, 150, 365].every(d => room[d].leaf === truth[d]),
     `방의 잎 수가 정본과 같다 (${[45, 150, 365].map(d => room[d].leaf + '/' + truth[d]).join(' · ')})`);
  ok(room[45].h < room[365].h * 0.55,
     `도착(45일) 그루가 한 해(365일) 그루보다 확실히 작다 — ${room[45].h}m vs ${room[365].h}m`);
}

/* ── I. 무늬는 쓸 때 받는다 ──
   ★ 2026-08-17 — 부팅 때 이 창(확대 iframe)이 GLB 113장 436.7MB 를 받고 있었다.
     그중 skins/ 100장이 422MB 고, **첫 화면에는 한 장도 안 쓰인다.**
     이제 그 잎이 실제로 그 무늬를 쓸 때 한 장씩 받는다(plant_grow.html §ensureSkin).
   ⚠⚠ **안 받고 안 그리면 그건 고친 게 아니라 지운 것이다.** 그래서 여기서
     「무늬가 실제로 화면에 나오는가」까지 본다. */
console.log('\nI. 무늬는 쓸 때 받는다 — 부팅 때 안 받고, 나면 그 장만 받아 그린다');
{
  console.log(`    부팅 직후: GLB ${BOOT.glb}장 · ${BOOT.mb}MB · 무늬 ${BOOT.skins}장`);
  ok(BOOT.skins === 0, `부팅 때는 무늬를 한 장도 안 받는다 (${BOOT.skins}장)`);
  ok(BOOT.glb <= 20, `부팅 GLB 가 스무 장 안쪽이다 (${BOOT.glb}장 · ${BOOT.mb}MB)`);

  /* varieProb 1.0 은 **튜닝용 값**이다(plant_grow.html §varieProb 설명) — 모든 잎을 무늬로
     만들어 「나면 나오나」를 보기 위한 것이지 밸런스를 바꾸는 것이 아니다. 끝나고 되돌린다. */
  await page.eval(`(()=>{ P.varieProb=1; plantSeed(92158); matResetAll(); resetDailyLight();
    setGrowth(0); setDailyLightSteady(8); for(let d=1; d<=400; d++) advanceTo(d); })()`, false);
  await page.waitFor('skinsPending() === 0', 180000, 200);
  await sleep(1500);
  const r = await page.eval(`(()=>{
    const keys={}, tex=[];
    plantGroup.traverse(o=>{ const k=o.userData&&o.userData.assetKey; if(!k) return;
      keys[k]=(keys[k]||0)+1;
      if(!/^leaf_mat\\d|albo/.test(k)) return;
      o.traverse(m=>{ if(!m.isMesh||!m.material||!m.material.map) return;
        tex.push([k, '#'+m.material.color.getHexString()]); }); });
    const varieMesh=Object.keys(keys).filter(k=>/^leaf_mat\\d|albo/.test(k)).length;
    return JSON.stringify({ varieMesh, tex, skins:skinsLoaded(),
      glb: performance.getEntriesByType('resource').filter(r=>/\\.glb$/.test(r.name)).length,
      mb: +(performance.getEntriesByType('resource').reduce((a,r)=>a+(r.transferSize||0),0)/1048576).toFixed(2) }); })()`)
    .then(JSON.parse);
  console.log(`    무늬를 켜고 400일: 무늬 잎 ${r.varieMesh}종 · 받은 무늬 ${r.skins}장 · ` +
              `누적 GLB ${r.glb}장 ${r.mb}MB`);
  ok(r.varieMesh > 0 && r.skins > 0,
     `무늬가 나면 그 장을 받아 **실제로 그린다** (무늬 잎 ${r.varieMesh}종 · 받은 무늬 ${r.skins}장)`);
  ok(r.skins < 40, `그래도 100장을 다 받지는 않는다 — 그 그루가 쓰는 것만 ${r.skins}장`);
  /* 캐논: 무늬 텍스처에 단색 틴트 금지. 텍스처가 살아 있고 색이 흰색(=안 덮음)이어야 한다 */
  ok(r.tex.length > 0 && r.tex.every(t => t[1] === '#ffffff'),
     `무늬 텍스처가 살아 있고 단색으로 안 덮인다 ${JSON.stringify(r.tex.slice(0, 3))}`);

  await page.eval(`(()=>{ P.varieProb=0.20; plantSeed(92158); matResetAll(); resetDailyLight(); })()`, false);
}

/* ── J. 방(3D)에도 무늬 잎이 난다 ──
   ★ 2026-08-18 — 그전까지 무늬는 **확대창에서만** 보였다. 방은 `leafState` 로 `varie` 칸을
     이미 받고 있었는데, 조립기가 `skins/` 를 ASSET_FILES 에서 통째로 지우고 열어서
     `ensureSkin` 이 그 자리에서 거짓을 돌려주었다 — 무늬 잎이 조용히 기본잎으로 앉았다.
   ⚠⚠ 여기서 거는 것은 넷이다. 넷째가 제일 중요하다.
     ① 무늬가 난 잎이 있으면 방이 그 무늬를 **받아서 그린다**
     ② **무늬가 하나도 안 난 그루는 한 장도 안 받는다** — 캐논: 변이는 잎마다 독립이다.
        그루째 무늬로 칠하면 여기가 깨진다
     ③ 한 그루가 받는 무늬는 100장이 아니라 그 그루가 쓰는 몇 장뿐이다
     ④ **무늬 텍스처는 원본 그대로다** — 재질색 #ffffff · map 살아 있음(단색 틴트 금지) */
console.log('\nJ. 방(3D)에도 무늬 잎이 난다 — 난 잎만 · 원본 텍스처 그대로');
{
  /* 정본에서 「모든 잎이 무늬」인 잎 상태를 만든다. varieProb 1.0 은 §I 와 같은 튜닝용 값이다. */
  const truth = await page.eval(`(()=>{
    P.varieProb=1; plantSeed(92158); matResetAll(); resetDailyLight();
    setGrowth(0); setDailyLightSteady(8);
    for(let d=1; d<=400; d++) advanceTo(d);
    const v=new Map(varieStateAll().map(x=>[x.leafBirth,x.varie]));
    const h=new Map(leafHealthAll().map(x=>[x.leafBirth,x]));
    const seen=new Set(), out=[];
    for(const m of matStateAll()){ seen.add(m.leafBirth);
      out.push({leafBirth:m.leafBirth, varie:!!v.get(m.leafBirth), matured:!!m.matured,
                fade:(h.get(m.leafBirth)||{}).fade||0, dropped:!!(h.get(m.leafBirth)||{}).dropped}); }
    for(const [lb,varie] of v) if(!seen.has(lb))
      out.push({leafBirth:lb, varie:!!varie, matured:false, fade:0, dropped:false});
    P.varieProb=0.20;                       // ⚠ 반드시 되돌린다(밸런스 값이다)
    return JSON.stringify({days:growthDays(), st:leafStats(), leafState:out}); })()`).then(JSON.parse);

  const r = await page.eval(`(async()=>{
    const m = await import('/src/render3d/plant_assemble.js');
    const asm = await m.getPlantAssembler({});
    const D=${truth.days}, LS=${JSON.stringify(truth.leafState)};
    const PLAIN = LS.map(s=>({...s, varie:false}));
    const look = (g)=>{ const keys=new Set(); let mesh=0; const tex=[];
      g.traverse(o=>{ const k=o.userData&&o.userData.assetKey;
        if(k && /albo|^leaf_mat\\d/.test(k)) keys.add(k);
        if(o.isMesh && o.userData.varieSkin){ mesh++;
          if(o.material) tex.push(['#'+o.material.color.getHexString(), !!o.material.map]); } });
      return { keys:[...keys], mesh, tex }; };
    const settle = async ()=>{ for(let i=0;i<600 && asm.skinsPending()>0;i++) await new Promise(r=>setTimeout(r,100)); };

    const first  = look(asm.assemble({growthDays:D, seed:92158, potD:0.20, leafState:LS}));
    const asked  = asm.skinsPending();
    await settle();
    const after  = look(asm.assemble({growthDays:D, seed:92158, potD:0.20, leafState:LS}));
    const loaded = asm.skinsLoaded();

    /* 무늬 판정이 하나도 없는 같은 그루 — 여기서 한 장이라도 더 받으면 그루째 칠한 것이다 */
    const plain  = look(asm.assemble({growthDays:D, seed:92158, potD:0.20, leafState:PLAIN}));
    const plainAsked = asm.skinsPending();
    await settle();
    return JSON.stringify({ boot: window.__asmBoot0, first, asked, after, loaded,
                            plain, plainAsked, added: asm.skinsLoaded()-loaded }); })()`).then(JSON.parse);

  console.log(`    조립기를 연 직후 무늬 ${r.boot}장 · 첫 조립에서 ${r.asked}장을 청했다`);
  console.log(`    받은 뒤 방이 그린 무늬: ${r.after.keys.join(', ') || '없음'} (메시 ${r.after.mesh}개 · 받은 무늬 ${r.loaded}장)`);
  console.log(`    무늬 판정 없는 같은 그루: 무늬 ${r.plain.keys.length}종 · 더 받은 것 ${r.added}장`);

  ok(r.boot === 0, `방 조립기도 **열 때는** 무늬를 한 장도 안 받는다 (${r.boot}장)`);
  ok(r.first.keys.length === 0 && r.asked > 0,
     `처음엔 기본잎으로 그리고 그 자리에서 ${r.asked}장을 청한다 (늦게 받는다)`);
  ok(r.after.keys.length > 0 && r.after.mesh > 0,
     `무늬가 도착하면 방이 **실제로 그린다** — ${r.after.keys.length}종 · 메시 ${r.after.mesh}개`);
  ok(r.after.mesh === truth.st.leaves,
     `무늬 표가 붙은 메시가 잎 수와 같다 — ${r.after.mesh} = 잎 ${truth.st.leaves}장 (엽초까지 물들지 않는다)`);
  ok(r.loaded < 40, `그 그루가 쓰는 것만 받는다 — 100장이 아니라 ${r.loaded}장`);
  ok(r.plain.keys.length === 0 && r.plainAsked === 0 && r.added === 0,
     `무늬가 안 난 그루는 한 장도 안 받고 한 장도 안 그린다 (그루째 칠하지 않는다)`);
  ok(r.after.tex.length > 0 && r.after.tex.every(t => t[0] === '#ffffff' && t[1]),
     `방의 무늬 텍스처가 **원본 그대로**다 — ${JSON.stringify(r.after.tex.slice(0, 3))}`);
}

await page.close();
console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과');
process.exit(fails ? 1 : 0);
