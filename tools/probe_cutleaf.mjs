/* ============================================================
   tools/probe_cutleaf.mjs — **잘린 마디의 잎에 열쇠가 달렸나**를 잰다 (2026-08-17 신설)
   ------------------------------------------------------------
   ── 왜 있나 ──────────────────────────────────────────────────
   박사님 원문: *"잘린 원본은 잘려야 되는데 잘리기 전 모습 그대로네."*
   삽수를 자르면 코어 장부에서는 잎이 준다(`propagation §motherLeafStats`). 그런데 방에 선
   몬스테라는 잎을 그대로 달고 있다 — 형태의 정본인 `plant_grow` 에 「이 마디를 잘랐다」를
   알려 줄 창구가 없었기 때문이다. 방은 이미 `leafState()` 를 받아 그리므로
   (`plant_assemble §__setLeafState`), 없던 것은 **어느 잎이 딸려 갔나를 잇는 열쇠**뿐이다.

   ⇒ `cuttableNodes()` 가 마디마다 `leafBirths` · `leafKeys` 를 내게 했다. 이 자는 그것이
     **새지 않는지**를 잰다. 생장 규칙·확률·난수는 한 글자도 안 건드렸다.

   ── 무엇을 재나 (★ 켜고 끈 것을 여기 적는다) ────────────────
   대상은 **브라우저에서 실제로 도는 `plant_grow.html`** 이다(vm 스텁이 아니다).
   빛은 `setDailyLightSteady(DLI)` 로 못 박고, 진행도는 `setGrowth(day)` 로 세운다.
   낙엽은 정본 그대로 둔다(`drop_enabled` 를 안 건드린다 = 초보 기본값).

     A  칸이 실제로 온다 — 마디마다 `leafBirths`·`leafKeys` 가 있고 길이가 `leaves` 와 같다
     B  ★밑동 마디(n0#0)의 열쇠 = 지금 달려 있는 잎 전부 (leafStats 와 대조)
     C  ★`leafBirth` 가 잎마다 유일한가 — **중복 개수를 센다**(지어내지 않고 잰다)
     D  ★`leafKeys` 는 유일한가
     E  ★`leafState()` 의 열쇠 집합과 밑동 마디의 `leafBirths` 관계 — 같은가 · 어느 쪽이 큰가
     F  growth_adapter 가 그 칸을 **그대로 통과**시키나 (iframe + 진짜 어댑터로 잰다)
     G  ★`leafKeysOfNodes()` — 마디 여럿을 주면 겹치는 잎을 한 번만 내나 · 모르는 마디는 missing 인가
     H  ★읽기 전용 — 이 칸이 붙어도 형태·성숙·잎 상태가 한 글자도 안 바뀌나

   ── 쓰는 법 ─────────────────────────────────────────────────
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_cutleaf.mjs

   ⚠ 이 자는 **아무 파일도 안 고친다.** 재기만 한다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 480000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const DAYS = [60, 120, 200, 365];
/* 92158 은 게임이 실제로 쓰는 씨앗이다(plant_assemble.js 기본값). 나머지는 넓게 훑으려고 같이 돈다. */
const SEEDS = [92158, 1, 5, 7, 33, 42, 101, 555, 777, 8888, 12345, 24601, 40503, 99999];
const DLI = 12.16;      // 밝은 자리 — 무늬·성숙이 실제로 나야 무늬 칸도 같이 재진다

let bad = 0;
const ok = (name, cond, got) => {
  console.log(`${cond ? '  OK' : 'FAIL'}  ${name}${got == null ? '' : '\n        → ' + got}`);
  if (!cond) bad++;
};
const line = (s) => console.log('        ' + s);

const page = await launch({ width: 900, height: 700, dpr: 1 });
const errs = [];
page.on(m => {
  if (m.method === 'Runtime.exceptionThrown')
    errs.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
});

await page.goto(`${BASE}/plant_grow.html`);
await page.waitFor(`typeof cuttableNodes==='function' && typeof setGrowth==='function'
                    && typeof plantSeed==='function' && typeof thLoaded==='function' && thLoaded()`, 180000, 300);
await sleep(1200);

/* ══════════════════════════════════════════════════════════════════════
   1차 — plant_grow 안에서 직접 잰다 (A~E · H)
   ══════════════════════════════════════════════════════════════════════ */
const sweep = JSON.parse(await page.eval(`(()=>{
  const DAYS=${JSON.stringify(DAYS)}, SEEDS=${JSON.stringify(SEEDS)}, DLI=${DLI};
  const rows=[], leak=[], dupBirthRows=[], dupKeyRows=[], stateRows=[];
  let nNodes=0, nCase=0, twinCases=0;
  for(const seed of SEEDS) for(const day of DAYS){
    plantSeed(seed); matResetAll(); setDailyLightSteady(DLI); setGrowth(day);
    const nodes=cuttableNodes(), st=leafStats();
    nCase++;
    const root=nodes.find(n=>n.nodeId==='n0#0');
    // ── A: 칸이 있고 길이가 맞나 (마디 전수)
    for(const n of nodes){
      nNodes++;
      const hb=Array.isArray(n.leafBirths), hk=Array.isArray(n.leafKeys);
      if(!hb || !hk || n.leafBirths.length!==n.leaves || n.leafKeys.length!==n.leaves)
        leak.push({seed, day, nodeId:n.nodeId, leaves:n.leaves,
                   births: hb? n.leafBirths.length : null, keys: hk? n.leafKeys.length : null});
    }
    // ── C/D: 유일성 — 밑동 마디(그루 전체)에서 센다
    if(root){
      const b=root.leafBirths, k=root.leafKeys;
      const dupB=b.length-new Set(b).size, dupK=k.length-new Set(k).size;
      // ⚠ 여기서 births 를 정렬하면 keys 와 짝이 어긋나 **자가 거짓말을 한다**(한 번 그렇게 냈다).
      //   두 배열은 자리로 짝이므로 짝지어서 낸다. 겹친 값이 어느 잎끼리인지도 같이 낸다.
      if(dupB){
        const pair=b.map((x,i)=>k[i]+'='+x).join(' ');
        const seen=new Map(); for(let i=0;i<b.length;i++){ const a=seen.get(b[i])||[]; a.push(k[i]); seen.set(b[i],a); }
        const who=[...seen.entries()].filter(([,a])=>a.length>1).map(([v,a])=>v+' ← '+a.join(' + ')).join(' · ');
        dupBirthRows.push({seed, day, leaves:root.leaves, dup:dupB, pair, who});
      }
      if(dupK) dupKeyRows.push({seed, day, leaves:root.leaves, dup:dupK, keys:k.join(',')});
      const twin=nodes.some(n=>n.stem==='main'||n.nodeId.includes(':'));
      if(twin) twinCases++;
      // ── E: leafState(어댑터가 합치는 세 장부)의 열쇠 집합과 견준다
      const stateKeys=new Set();
      for(const v of varieStateAll()) stateKeys.add(v.leafBirth);
      for(const m of matStateAll())   stateKeys.add(m.leafBirth);
      for(const h of leafHealthAll()) stateKeys.add(h.leafBirth);
      const rootSet=new Set(b);
      const onlyRoot=[...rootSet].filter(x=>!stateKeys.has(x));
      const onlyState=[...stateKeys].filter(x=>!rootSet.has(x));
      const g=ageOf(growthDays());
      // 지금 달려 있는 잎만 추린 leafState 줄 수 — 잎보다 적으면 그만큼 「한 칸을 나눠 쓴」 것이다
      const liveState=[...stateKeys].filter(x=>x<=g).length;
      stateRows.push({seed, day, leaves:root.leaves, rootKeys:rootSet.size, stateKeys:stateKeys.size,
                      onlyRoot:onlyRoot.length, onlyState:onlyState.length,
                      onlyStateUnborn:onlyState.filter(x=>x>g).length,
                      liveState, collapsed:root.leaves-liveState,
                      onlyStateSample:onlyState.slice(0,4)});
      rows.push({seed, day, nodes:nodes.length, leaves:root.leaves, statLeaves:st.leaves,
                 varie:root.variegatedLeaves, twin,
                 rootBirths:b.slice(), rootKeys:k.slice()});
    } else rows.push({seed, day, nodes:nodes.length, leaves:0, statLeaves:st.leaves, root:false});
  }
  return JSON.stringify({rows, leak, dupBirthRows, dupKeyRows, stateRows, nNodes, nCase, twinCases});
})()`));

console.log('\n══ 잰 조건 ════════════════════════════════════════════════');
console.log(`  plant_grow.html 을 브라우저에서 직접 굴린다 (${BASE})`);
console.log(`  빛 setDailyLightSteady(${DLI}) 고정 · 진행도 setGrowth(day) 점프 · 낙엽은 정본 기본값`);
console.log(`  씨앗 ${SEEDS.length}개 × 생장일 ${DAYS.join('·')} = ${sweep.nCase}판 · 마디 ${sweep.nNodes}개`);
console.log(`  그중 쌍혹(가지 둘)이 난 판 ${sweep.twinCases}건\n`);

/* ── A ─────────────────────────────────────────────────────────────── */
console.log('══ A · 칸이 실제로 오고 길이가 leaves 와 같다 ══');
ok('A leafBirths.length · leafKeys.length 가 그 마디의 leaves 와 정확히 같다 (마디 전수)',
   sweep.leak.length === 0,
   sweep.leak.length ? `열쇠가 새는 마디 ${sweep.leak.length}개 — ` +
     sweep.leak.slice(0, 6).map(x => `seed${x.seed}/${x.day}일 ${x.nodeId}: leaves ${x.leaves} vs births ${x.births} keys ${x.keys}`).join(' | ')
     : `마디 ${sweep.nNodes}개 전부 일치`);

/* ── B ─────────────────────────────────────────────────────────────── */
console.log('\n══ B · 밑동 마디(n0#0)가 그루 전체를 품는다 ══');
{
  const wrong = sweep.rows.filter(r => r.root !== false && r.leaves !== r.statLeaves);
  ok('B 밑동 마디의 잎 수 = leafStats().leaves (다른 코드 경로와 대조)',
     wrong.length === 0,
     wrong.length ? wrong.slice(0, 6).map(r => `seed${r.seed}/${r.day}일 ${r.leaves} vs ${r.statLeaves}`).join(' | ')
                  : `${sweep.rows.length}판 전부 일치`);
}

/* ── C · ★ leafBirth 는 유일한가 ────────────────────────────────────── */
console.log('\n══ C · ★leafBirth 가 잎마다 유일한가 — 재서 정한다 ══');
if (sweep.dupBirthRows.length === 0) {
  ok('C leafBirth 가 이 표본 안에서는 잎마다 유일했다', true,
     `${sweep.rows.length}판에서 중복 0건 (⚠ 「이 표본 안에서」다. 쌍혹이 안 났으면 못 잡는다)`);
} else {
  console.log(`  ★ 유일하지 않다 — ${sweep.rows.length}판 중 ${sweep.dupBirthRows.length}판에서 겹쳤다`);
  for (const d of sweep.dupBirthRows.slice(0, 6))
    line(`seed ${d.seed} · ${d.day}일 · 잎 ${d.leaves}장 · 겹친 값 ${d.dup}개`
       + `\n            잎(열쇠=leafBirth): ${d.pair}\n            겹친 자리: ${d.who}`);
  ok('C ★그래서 leafBirth 하나로는 잎을 못 가른다 — 유일한 열쇠를 따로 낸다(leafKeys)', true,
     `중복 ${sweep.dupBirthRows.length}판 / ${sweep.rows.length}판`);
  ok('C-2 ★겹치는 판은 **쌍혹 판과 정확히 같은 수**다 — 겹침의 출처가 쌍혹임을 가리킨다',
     sweep.dupBirthRows.length === sweep.twinCases,
     `겹친 판 ${sweep.dupBirthRows.length} · 쌍혹 판 ${sweep.twinCases}`);
}

/* ── D · leafKeys 는 유일한가 ───────────────────────────────────────── */
console.log('\n══ D · leafKeys 는 유일한가 ══');
ok('D ★leafKeys 는 한 판 안에서 겹치지 않는다', sweep.dupKeyRows.length === 0,
   sweep.dupKeyRows.length ? sweep.dupKeyRows.slice(0, 6).map(d => `seed${d.seed}/${d.day}일 겹침 ${d.dup}개: ${d.keys}`).join(' | ')
                           : `${sweep.rows.length}판 전부 유일`);

/* ── E · leafState 와의 관계 ────────────────────────────────────────── */
console.log('\n══ E · ★leafState() 의 열쇠 집합과 밑동 마디의 leafBirths ══');
{
  const noOnlyRoot = sweep.stateRows.filter(r => r.onlyRoot > 0);
  ok('E-1 밑동이 품은 열쇠는 **전부** leafState 안에 있다 (열쇠가 맞물린다)',
     noOnlyRoot.length === 0,
     noOnlyRoot.length ? noOnlyRoot.slice(0, 6).map(r => `seed${r.seed}/${r.day}일 leafState 에 없는 열쇠 ${r.onlyRoot}개`).join(' | ')
                       : `${sweep.stateRows.length}판 전부 포함`);
  const equal = sweep.stateRows.filter(r => r.onlyState === 0).length;
  const extraAllUnborn = sweep.stateRows.every(r => r.onlyState === r.onlyStateUnborn);
  console.log(`  ⚠ 두 집합이 **같지는 않다** — 같은 판 ${equal}/${sweep.stateRows.length}건.`);
  console.log(`     leafState 쪽이 늘 크거나 같다(초과 열쇠가 ${extraAllUnborn ? '전부' : '일부만'} **아직 안 난 잎**이다).`);
  for (const r of sweep.stateRows.slice(0, 6))
    line(`seed ${r.seed} · ${r.day}일 — 밑동 ${r.rootKeys}개 / leafState ${r.stateKeys}개 `
       + `· 초과 ${r.onlyState}개(안 난 잎 ${r.onlyStateUnborn}개) ${r.onlyStateSample.length ? '예: ' + r.onlyStateSample.join(',') : ''}`);
  ok('E-2 leafState 의 **초과분은 전부 아직 안 난 잎**이다 (장부가 미리 굴려 둔 것)',
     extraAllUnborn,
     extraAllUnborn ? '초과 열쇠 중 leafBirth > 현재 나이 가 아닌 것 0개'
                    : sweep.stateRows.filter(r => r.onlyState !== r.onlyStateUnborn).slice(0, 4)
                        .map(r => `seed${r.seed}/${r.day}일 초과 ${r.onlyState} 중 안 난 잎 ${r.onlyStateUnborn}`).join(' | '));
  /* ★ 여기가 이 자의 제일 무거운 발견이다 — 쌍혹이면 잎 두 장이 leafState 한 줄을 나눠 쓴다.
     그 줄에 dropped 를 찍으면 **두 장이 같이 사라진다.** 얼마나 자주인지 재서 낸다. */
  const collapsed = sweep.stateRows.filter(r => r.collapsed > 0);
  const lost = collapsed.reduce((n, r) => n + r.collapsed, 0);
  console.log(`  ⚠⚠ leafState 는 **잎 한 장에 한 줄이 아니다** — ${collapsed.length}/${sweep.stateRows.length}판에서`
    + ` 잎보다 줄이 적다(모자란 줄 합계 ${lost}장분).`);
  for (const r of collapsed.slice(0, 5))
    line(`seed ${r.seed} · ${r.day}일 — 달린 잎 ${r.leaves}장인데 leafState 줄은 ${r.liveState}줄 (${r.collapsed}장이 남의 줄을 같이 씀)`);
  console.log('     ⇒ 그 줄에 dropped 를 찍으면 **쌍둥이 잎이 같이 사라진다.** game.html 이 알아야 할 값이다.');
}

/* ── 표 한 장 ───────────────────────────────────────────────────────── */
console.log('\n══ 표 · seed 92158 (게임이 실제로 쓰는 씨앗) ══');
console.log('  생장일 | 마디 | 잎 | 무늬 | 쌍혹 | 밑동 leafBirths | 밑동 leafKeys');
for (const r of sweep.rows.filter(x => x.seed === 92158))
  console.log(`  ${String(r.day).padStart(5)} | ${String(r.nodes).padStart(4)} | ${String(r.leaves).padStart(2)} | `
    + `${String(r.varie).padStart(4)} | ${r.twin ? ' 있음' : ' 없음'} | ${(r.rootBirths || []).join(',')} | ${(r.rootKeys || []).join(',')}`);

/* ══════════════════════════════════════════════════════════════════════
   2차 — 진짜 어댑터로 잰다 (F · G) — iframe + growth_adapter.js
   ══════════════════════════════════════════════════════════════════════ */
console.log('\n══ F·G · growth_adapter 를 실제로 물려서 잰다 (iframe) ══');
const adapt = JSON.parse(await page.eval(`(async ()=>{
  const M = await import('${BASE}/src/game/growth_adapter.js');
  const ifr = document.createElement('iframe');
  ifr.style.cssText='position:fixed;left:-9999px;width:600px;height:400px';
  ifr.src='${BASE}/plant_grow.html';
  document.body.appendChild(ifr);
  await new Promise(r=>{ ifr.onload=r; setTimeout(r, 60000); });
  const ad = M.createGrowthAdapter(ifr);
  await ad.ready(60000);
  const w = ifr.contentWindow;
  const out={};

  const stand=(seed, day)=>{ w.plantSeed(seed); w.matResetAll(); w.setDailyLightSteady(${DLI}); w.setGrowth(day); };

  // ── F: 통과 여부 — 어댑터가 낸 것과 창 안에서 직접 부른 것이 같은가
  stand(92158, 200);
  const direct = w.cuttableNodes(), viaAd = ad.cuttableNodes();
  out.same = JSON.stringify(direct)===JSON.stringify(viaAd);
  out.hasCols = Array.isArray(viaAd[0] && viaAd[0].leafBirths) && Array.isArray(viaAd[0] && viaAd[0].leafKeys);
  out.sample = viaAd.map(n=>({nodeId:n.nodeId, stem:n.stem, leaves:n.leaves,
                              births:n.leafBirths, keys:n.leafKeys, days:n.growthDays}));
  out.leafState = ad.leafState();

  // ── G: leafKeysOfNodes
  const root=viaAd.find(n=>n.nodeId==='n0#0');
  const up  =viaAd.filter(n=>n.nodeId.startsWith('n0#')).sort((a,b)=>b.nodeId.localeCompare(a.nodeId))[0];
  out.g_root = ad.leafKeysOfNodes('n0#0');
  out.g_arr  = ad.leafKeysOfNodes([root.nodeId, up.nodeId]);          // 겹치는 두 마디
  out.g_up   = ad.leafKeysOfNodes([up.nodeId]);
  out.g_none = ad.leafKeysOfNodes(['없는마디#9']);
  out.g_empty= ad.leafKeysOfNodes([]);
  out.upId   = up.nodeId;
  out.rootLeaves = root.leaves;

  // 쌍혹이 실제로 난 개체에서 twins 칸이 그 잎을 짚나 (seed 33 · 365일 — 1차에서 겹친 판)
  stand(33, 365);
  out.twinCase = ad.leafKeysOfNodes('n0#0');
  out.twinLeaves = (ad.cuttableNodes().find(n=>n.nodeId==='n0#0')||{}).leaves;
  out.twinStateRows = (ad.leafState()||[]).length;
  stand(92158, 200);

  // ── 옛 plant_grow 흉내 — 접근자를 잠깐 지우면 null 인가 (0·[] 로 안 메꾸는지)
  const keep = w.cuttableNodes;
  try { w.cuttableNodes = undefined; out.g_old = ad.leafKeysOfNodes(['n0#0']); }
  finally { w.cuttableNodes = keep; }
  // 열쇠 칸이 없는 옛 목록을 흉내 낸다
  try {
    w.cuttableNodes = ()=> keep().map(n=>({nodeId:n.nodeId, stem:n.stem, leaves:n.leaves,
                                           variegatedLeaves:n.variegatedLeaves, growthDays:n.growthDays}));
    out.g_oldcols = ad.leafKeysOfNodes(['n0#0']);
  } finally { w.cuttableNodes = keep; }

  // ── H: 읽기 전용 — 매 턴 불러도 결과가 같은가
  const run=(probe)=>{
    w.plantSeed(92158); w.matResetAll(); w.setGrowth(0);
    const turns=[];
    for(let i=0;i<160;i++){
      w.setDailyLightSteady(i<90? 12.16 : 0.6);
      turns.push(ad.advanceTo(ad.calendarDay()+1));
      if(probe){ ad.cuttableNodes(); ad.leafKeysOfNodes(['n0#0','n0#1']); }
    }
    return JSON.stringify({turns, growth:ad.growthDays(), cal:ad.calendarDay(),
                           mat:w.matStateAll(), health:w.leafHealthAll(),
                           tl:w.axisTimeline(w.ageOf(ad.growthDays())).map(a=>[a.birth,a.leafBirth,a.segs.length])});
  };
  out.pure = run(false)===run(true);
  return JSON.stringify(out);
})()`));

ok('F-1 어댑터가 낸 목록이 창 안에서 직접 부른 것과 **한 글자도 안 다르다**', adapt.same);
ok('F-2 ★leafBirths·leafKeys 칸이 어댑터를 **그대로 통과**한다 (배열이 살아서 온다)', adapt.hasCols);
console.log('\n  seed 92158 · 유효 200일 · DLI ' + DLI + ' 의 마디 전부:');
console.log('   마디       등급     잎  leafBirths        leafKeys');
for (const n of adapt.sample)
  console.log(`   ${n.nodeId.padEnd(10)} ${String(n.stem).padEnd(8)} ${String(n.leaves).padStart(2)}  `
    + `${(n.births || []).join(',').padEnd(17)} ${(n.keys || []).join(',')}`);
console.log('  같은 순간 leafState(): ' + JSON.stringify(adapt.leafState));

console.log('');
ok('G-1 leafKeysOfNodes("n0#0") 가 밑동 잎 전부를 낸다',
   adapt.g_root && adapt.g_root.leafKeys.length === adapt.rootLeaves,
   `잎 ${adapt.rootLeaves}장 · 열쇠 ${adapt.g_root && adapt.g_root.leafKeys.length}개 → ${JSON.stringify(adapt.g_root)}`);
ok('G-2 ★겹치는 두 마디(밑동 + 위 마디)를 같이 줘도 잎이 두 번 안 세어진다',
   adapt.g_arr && adapt.g_arr.leafKeys.length === adapt.rootLeaves,
   `n0#0 + ${adapt.upId} → 열쇠 ${adapt.g_arr && adapt.g_arr.leafKeys.length}개 (밑동만 해도 ${adapt.rootLeaves}개)`);
ok('G-3 위 마디만 주면 그 마디가 품은 것만 온다',
   adapt.g_up && adapt.g_up.leafKeys.length >= 1 && adapt.g_up.leafKeys.length <= adapt.rootLeaves,
   `${adapt.upId} → ${JSON.stringify(adapt.g_up)}`);
ok('G-4 모르는 마디는 missing 으로 나온다 — 빈 값으로 안 메꾼다',
   adapt.g_none && adapt.g_none.missing.length === 1 && adapt.g_none.leafKeys.length === 0,
   JSON.stringify(adapt.g_none));
ok('G-5 ★옛 plant_grow(접근자 없음)면 **null** 이다 — 0 도 빈 배열도 아니다',
   adapt.g_old === null, String(adapt.g_old));
ok('G-6 ★열쇠 칸이 없는 옛 목록이면 **null** 이다 — 빈 배열로 안 메꾼다',
   adapt.g_oldcols === null, String(adapt.g_oldcols));
ok('G-7 쌍혹 없는 개체는 twins 가 빈 배열이다',
   adapt.g_root && Array.isArray(adapt.g_root.twins) && adapt.g_root.twins.length === 0,
   `seed 92158 · 200일 → twins = ${JSON.stringify(adapt.g_root && adapt.g_root.twins)}`);
ok('G-8 ★쌍혹 개체는 twins 가 겹친 leafBirth 를 실제로 짚는다 (leafState 줄이 잎보다 적다)',
   adapt.twinCase && adapt.twinCase.twins.length > 0
     && adapt.twinStateRows < adapt.twinLeaves,
   `seed 33 · 365일 → 잎 ${adapt.twinLeaves}장 · leafState ${adapt.twinStateRows}줄 · `
   + `twins ${JSON.stringify(adapt.twinCase && adapt.twinCase.twins)}\n`
   + `        ${JSON.stringify(adapt.twinCase)}`);

console.log('');
ok('H ★매 턴 불러도 형태·성숙·잎 상태가 한 글자도 안 바뀐다 (읽기 전용)', adapt.pure === true);

console.log(`\n예외 ${errs.length}건` + (errs.length ? '\n  ' + errs.join('\n  ') : ''));
if (errs.length) bad++;
console.log(bad ? `\n✘ ${bad}건 실패` : '\n★ 전부 통과');
await page.close();
process.exit(bad ? 1 : 0);
