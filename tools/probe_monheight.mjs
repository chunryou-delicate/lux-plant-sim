/* ============================================================
   tools/probe_monheight.mjs — 몬스테라가 창을 뚫나 (G-10)
   ------------------------------------------------------------
   박사님: *"몬스테라 식물 높이를 줄이자. 지금 **잎 3개 날 때 거의 창문 위를 뚫어**"*

   무엇을 켜고 무엇을 껐나
     · 조립기(plant_assemble)에 **직접** 물어서 잰다 — 방뷰를 거치지 않는다
     · 씨앗은 정본 씨앗 92158 · potD 는 방뷰가 쓰는 값(MONSTERA_POT_D 0.20)
     · 잎 수는 조립기가 실제로 세운 leaf_* 노드 수(정본 leafStats 와 §H 에서 대조됨)
     · 무늬(leafState)는 **안 넘긴다** — 키는 무늬와 무관하다

   창·자리 (data/house_rooms.json 반지하)
     창 중심 cy 1.77 · 높이 h 0.55  ⇒ 아랫변 **1.495m** · 윗변 **2.045m**
     천장 2.30m · 몬스테라 도착 자리 = 책상 banjiha-desk:0 (자리 y 0.74)
   ⇒ 화면에서 보이는 그루 꼭대기 = 자리 y + 그루 키
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';

const WIN_LO = 1.495, WIN_HI = 2.045, CEIL = 2.30;
const page = await launch({ width: 900, height: 700, dpr: 1, mobile: false });
await page.goto(`${BASE}/plant_grow.html`);
await page.waitFor('typeof setGrowth === "function"', 180000, 300);
await sleep(2500);

/* 유효 생장일을 촘촘히 훑어 **잎 수가 바뀌는 날**과 그때 키를 잡는다 */
const DAYS = [30, 45, 60, 70, 80, 100, 120, 140, 150, 170, 190, 220, 260, 290, 365, 440];
const raw = await page.eval(`(async()=>{
  const m = await import('/src/render3d/plant_assemble.js');
  const asm = await m.getPlantAssembler({});
  const out = [];
  for (const d of ${JSON.stringify(DAYS)}) {
    const g = asm.assemble({ growthDays: d, seed: 92158, potD: 0.20 });
    let leaf = 0;
    g.traverse(o => { const k = o.userData && o.userData.assetKey; if (k && /^leaf_/.test(k)) leaf++; });
    const bb = new THREE.Box3().setFromObject(g);
    /* ★ 자리 y 는 화분 밑면이다. 그러니 비교할 값도 원점(=밑면)부터 잎 꼭대기까지,
       즉 max.y 다 — (max.y - min.y) 통짜 키가 아니다. headroom.js MONSTERA_TOP 도
       같은 자를 쓴다. 처음에 통짜 키로 쟀다가 그 표와 3cm 어긋났고,
       그 3cm 는 화분이 원점보다 아래로 내려간 몫이었다. */
    out.push({ d, leaf, h: +bb.max.y.toFixed(4), below: +bb.min.y.toFixed(4),
               span: +(bb.max.y - bb.min.y).toFixed(4) });
  }
  return JSON.stringify(out); })()`);
const rows = JSON.parse(raw);

const SLOTS = [['책상(도착 자리) banjiha-desk:0', 0.74],
               ['서랍장 banjiha-dresser:0', 0.80],
               ['창턱 banjiha-sill:0', 1.585],
               ['바닥(3단 선반 1칸) banjiha-etagere:0', 0.03]];
console.log(`\n창 아랫변 ${WIN_LO}m · 윗변 ${WIN_HI}m · 천장 ${CEIL}m\n`);
console.log('유효일  잎  잎꼭대기[m] 화분아래  ' + SLOTS.map(s => s[0].split(' ')[0].padStart(9)).join(''));
console.log('-'.repeat(78));
for (const r of rows) {
  const tops = SLOTS.map(([, y]) => (y + r.h));
  const mark = tops.map(t => (t > CEIL ? '천' : t > WIN_HI ? '뚫' : t > WIN_LO ? '창' : ' ·'));
  console.log(String(r.d).padStart(5) + String(r.leaf).padStart(5) + r.h.toFixed(3).padStart(11) + r.below.toFixed(3).padStart(9) + '  '
    + tops.map((t, i) => (t.toFixed(2) + mark[i]).padStart(9)).join(''));
}
console.log('-'.repeat(78));
console.log('· = 창 아래 · 창 = 창에 걸침 · 뚫 = 창 윗변을 넘음 · 천 = 천장을 넘음');
const first3 = rows.find(r => r.leaf >= 3);
if (first3) {
  const top = 0.74 + first3.h;
  console.log(`\n★ 잎 ${first3.leaf}장이 처음 서는 날 = 유효 ${first3.d}일 · 그루 키 ${first3.h.toFixed(3)}m`);
  console.log(`  책상(0.74) 위에서 꼭대기 ${top.toFixed(3)}m — 창 윗변 ${WIN_HI} 을 ${(top - WIN_HI).toFixed(3)}m ${top > WIN_HI ? '넘는다' : '안 넘는다'}`);
  console.log(`  창 윗변에 딱 맞추려면 배율 ${((WIN_HI - 0.74) / first3.h).toFixed(3)} · 창 한가운데(1.77)면 ${((1.77 - 0.74) / first3.h).toFixed(3)}`);
}
console.log(`\nJSON=${raw}`);
await page.close();
