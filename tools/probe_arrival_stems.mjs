/* ============================================================
   tools/probe_arrival_stems.mjs — 진행도별 "줄기 몇 개"를 잰다
   ------------------------------------------------------------
   왜 재나 — 도착 진행도(state.ARRIVAL.growthDays)를 "줄기 1개"로 내리려는데,
   혹(가지)이 나는 날은 산식으로 안 나온다. plant_grow.html §growTopology ④ 가
   "어떤 생장점의 잎이 중간잎이 되는 순간 예비혹 후보 중 랜덤 딱 1개"라서,
   t0 + n·spawnStep 같은 식으로 짐작하면 틀린다. 그래서 돌려서 잰다.

   ★무엇을 세나 — **축(axis)** 이다. plant_grow §growTopology 주석 그대로
     "축 = 생장점 하나. 잎 1개 + 그 아래로 쌓이는 마디들(segs)".
     흙에서 갈라져 나온 대(줄기)가 화면에 하나 더 보이는 사건 = 축이 하나 는 것이다.
     마디(seg)는 한 대 안에서 위로 쌓이는 마디라 세면 "줄기 수"가 아니다.
     잎(leaf)은 축마다 1장이라 축 수와 같이 움직인다(leafStats 와 대조해서 확인한다).

   ★읽기만 한다 — topologyNow(ageOf(d)) 는 그리기 없이 같은 트리를 낸다.
     setGrowth 로 하루씩 점프하면 성숙 이력(MAT_STATE)이 섞이는데, 축이 나는 판정
     (leafM >= stageYoung)은 시간만 보므로 트리 구조는 그 이력과 무관하다.

   쓰기: node tools/probe_arrival_stems.mjs
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한을 넘겨 멈춥니다.');
  process.exit(2);
}, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
/* 92158 은 게임이 실제로 쓰는 씨앗이다(plant_assemble.js:287 의 기본값).
   나머지는 "랜덤이 끼면 씨앗마다 답이 다를 수 있다"를 확인하려고 같이 돌린다. */
const SEEDS = [92158, 1, 7, 12345, 40503, 99999, 24601, 8888];

const page = await launch({ width: 900, height: 700, dpr: 1 });
await page.goto(`${BASE}/plant_grow.html`);
await page.waitFor(`typeof topologyNow === 'function' && typeof ageOf === 'function'`, 120000, 300);
await sleep(1500);

/* 한 씨앗에 대해 day 범위를 전부 훑는다. 페이지 안에서 한 번에 돈다(왕복 비용 0). */
const sweep = async (seed, from, to) => page.eval(`(()=>{
  SEED = ${seed}>>>0;
  const out = [];
  for (let d = ${from}; d <= ${to}; d++) {
    const g = ageOf(d);
    const axes = topologyNow(g);
    let stems = 0, segs = 0, leaves = 0;
    for (const ax of axes) {
      if (ax.birth > g) continue;                 // 아직 안 난 가지
      stems++;
      for (const s of ax.segs) if (s.birth <= g) segs++;
      if (g >= ax.leafBirth) leaves++;            // 축마다 잎 1장
    }
    out.push({ d, stems, segs, leaves });
  }
  return out;
})()`);

const rows = {};
for (const s of SEEDS) rows[s] = await sweep(s, 1, 260);

/* ── ① 10일 간격 표 (게임이 쓰는 씨앗) ── */
const main = rows[92158];
console.log('\n== 씨앗 92158 (게임이 실제로 쓰는 값) — 10일 간격 ==');
console.log('진행도  줄기(축)  마디(seg)  잎');
for (let d = 20; d <= 200; d += 10) {
  const r = main.find(x => x.d === d);
  console.log(String(d).padStart(5), String(r.stems).padStart(7), String(r.segs).padStart(9), String(r.leaves).padStart(5));
}

/* ── ② 1→2 로 넘어가는 날을 1일 단위로 ── */
console.log('\n== 줄기 수가 바뀌는 날 (씨앗별) ==');
console.log('씨앗       줄기1 시작  줄기2 시작  줄기3 시작  1개인 구간 길이');
for (const s of SEEDS) {
  const r = rows[s];
  const firstAt = (n) => { const h = r.find(x => x.stems >= n); return h ? h.d : null; };
  const a1 = firstAt(1), a2 = firstAt(2), a3 = firstAt(3);
  console.log(String(s).padEnd(10),
    String(a1).padStart(10), String(a2).padStart(11), String(a3).padStart(11),
    String(a2 != null && a1 != null ? (a2 - a1) : '-').padStart(14));
}

/* ── ③ 잎이 나는 날도 같이 (도착 화면에 잎이 0장이면 안 된다) ── */
console.log('\n== 씨앗 92158 — 줄기 1개 구간 상세 (잎이 언제 붙나) ==');
for (const r of main.filter(x => x.d >= 20 && x.d <= 120)) {
  if (r.d % 2) continue;
  console.log(`d=${String(r.d).padStart(3)} 줄기 ${r.stems} · 마디 ${String(r.segs).padStart(2)} · 잎 ${r.leaves}`);
}

/* ── ④ 후보 진행도에서 실제 접근자(leafStats/cuttableNodes)와 대조 ── */
const CANDS = (process.env.BYEOT_CANDS || '60,70,80,90,100,110,120').split(',').map(Number);
console.log('\n== setGrowth 로 실제 상태를 만들어 접근자와 대조 ==');
for (const d of CANDS) {
  const v = await page.eval(`(()=>{ SEED=92158; matResetAll&&matResetAll(); setGrowth(${d});
    const ls = leafStats(), cn = cuttableNodes(), ph = growthPhase();
    const g = ageOf(${d});
    const axes = topologyNow(g).filter(a=>a.birth<=g);
    return { d:${d}, 축:axes.length, 마디:cn.length, 잎:ls.leaves, 성숙잎:ls.matureLeaves,
             단계:ph.phaseKo, 다음:ph.nextPhaseKo,
             줄기등급:[...new Set(cn.map(x=>x.stem))].join('/') }; })()`);
  console.log(JSON.stringify(v, null, 0));
}

await page.close();
