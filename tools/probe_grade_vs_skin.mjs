/* ============================================================
   probe_grade_vs_skin.mjs — 「잎의 «등급»과 화면의 «그림»이 만나나」 ([growth] 소유)
   ------------------------------------------------------------
   ★ 2026-09-07 · [leaf] 가 「등급이 안 갈린다」를 걸어서 찾았고, 이 자가 «까닭»을 잰다.

   ⚠ 먼저 갈라 둘 것 — 중간잎에서 «안 갈리는 것»은 흠이 아니라 **박사님 확정**이다:
     varie_grades.json §midCommon (2026-08-16)
     원문: 「중간잎은 하프문만 있는 걸로 그냥 ㄱ, 성숙 때 확률적으로 분류되는 걸로.」
     ⇒ 등급마다 중간잎이 다르면 그림이 등급을 «미리 말해» 버린다. 그래서 공용 못을 쓴다.

   ★ 그러니 물음은 하나다 — **「성숙할 때 «비로소» 갈리나」**
     설계는 「성숙 때 assets 로 갈린다」인데, plant_grow 의 성숙잎 고르개는
     `matAlboNumOf(leafBirth, alboMid, matRoll)` 이고 ⇒ ★ 인자에 «등급이 없다».
     ⇒ 그래서 이 자는 「등급을 바꾸면 그림이 바뀌나」를 안 묻는다(인자가 없으니 재나마나다).
     ⇒ ⇒ 대신 ★ **「공용 못에서 성숙했을 때 «어느 등급의 그림»에 닿나」**를 훑는다.
        그 분포가 등급 하나로 안 모이면 ⇒ 그림은 «굴림»이 정하는 것이고 값과 따로 돈다.

   ⚠ 서버가 떠 있어야 한다:  python tools/serve.py 8971
     BYEOT_URL=http://localhost:8971 node tools/probe_grade_vs_skin.mjs
   ⛔ 값·확률·짝짓기는 한 톨도 안 건드린다. 읽고 세기만 한다.
============================================================ */
import fs from 'node:fs';
import { launch } from './test_cdp.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VG=JSON.parse(fs.readFileSync(path.join(ROOT,'data/balance/varie_grades.json'),'utf8'));
const MG={}; for(const g of VG.grades) for(const a of (g.assets||[])) if(Number.isInteger(a.matNum)) MG[a.matNum]=g.id;
const pool=VG.midCommon.pool.map(x=>x.id);
const p=await launch({width:900,height:700,dpr:1,mobile:false});
await p.goto(`${process.env.BYEOT_URL || 'http://localhost:8971'}/plant_grow.html`);
await p.waitFor('typeof matFromMid === "function"',120000,300);
const out=await p.eval(`(()=>{const ids=${JSON.stringify(pool)};
 const nums=new Set();
 for(const id of ids) for(let n=1;n<=ALBO_MID_MAX;n++){ const f=ASSET_FILES['leaf_mid_albo'+n]; if(f&&f.includes(id)) nums.add(n); }
 const tally={};
 for(const n of nums){ for(let i=0;i<4000;i++){ const v=matFromMid(n, i/4000); tally[v]=(tally[v]||0)+1; } }
 return JSON.stringify({nums:[...nums].sort((a,b)=>a-b), tally});})()`);
const R=JSON.parse(out);
const total=Object.values(R.tally).reduce((a,b)=>a+b,0);
const byGrade={};
for(const [n,c] of Object.entries(R.tally)){
  const g = +n===0 ? '⛔ 무늬 «없는» 기본 성숙잎' : (MG[n] || '(등급표에 없는 그림)');
  byGrade[g]=(byGrade[g]||0)+c;
}
console.log('공용 못이 쓰는 중간잎 번호 ('+R.nums.length+'개):', R.nums.join(','));
console.log('\n★ 그 못에서 성숙했을 때 «그림»이 어느 등급으로 뜨나 (굴림 고르게 훑음)');
for(const [g,c] of Object.entries(byGrade).sort((a,b)=>b[1]-a[1]))
  console.log('   '+g.padEnd(26)+(c/total*100).toFixed(1)+'%');
await p.close();
