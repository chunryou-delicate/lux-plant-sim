/* tools/probe_potvalue.mjs — **그루값이 「자란 정도」로 어떻게 달라지나** (박사님 ①② 판단용)
   ------------------------------------------------------------------
   ⚠ 이것은 «한 판을 굴린 것»이 아니다. 생장만 날짜별로 세워 놓고
     **그날의 잎 자람 배수(leafM)를 «게임에게 물어»** 그루값을 셈한 것이다.
     ⇒ ★ 「굴린 것」과 「셈한 것」을 갈라 적으려고 일부러 이렇게 만들었다.
   등급은 프롤로그 규약대로다 — 잎1 무지 · 잎2 산반 · 잎3 하프문(shop.js §prologueGrades).
   ⛔ 값은 안 바꾼다. 밑값은 «가정»으로 얹어 셈만 한다. */
import { launch, sleep } from './test_cdp.mjs';
import { priceOf } from '../src/game/shop.js';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const FROM = +(process.env.BYEOT_FROM || 45), TO = +(process.env.BYEOT_TO || 170), STEP = +(process.env.BYEOT_STEP || 5);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 600000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
const PROLOGUE = ['plain', 'sanban', 'halfmoon'];
const gradesFor = (n) => Array.from({ length: n }, (_, i) => PROLOGUE[i] || 'plain');
const FLOORS = [0, 0.2, 0.3, 0.5];
const won = (grades, m, f) => priceOf({ leaves: grades.length, leafGrades: grades,
  form: 'pot', leafM: m.map(v => Math.max(f, v)) }).won;
console.log('■ 잎 자람 배수는 «게임에게 물은 것»(io.growth.leafOnPlant)이고, 그루값은 «셈»이다');
console.log('■ 이사비 2,000,000원 · 등급은 프롤로그 규약(무지·산반·하프문)');
console.log('');
console.log('생장일  잎  자람 배수                    밑값0        밑값0.2      밑값0.3      밑값0.5');
const rows = [];
for (let d = FROM; d <= TO; d += STEP) {
  const r = JSON.parse(await page.eval(`(()=>{ try{
    window.__io.growth.setGrowth(${d});
    const rows = window.__io.growth.leafOnPlant ? window.__io.growth.leafOnPlant() : null;
    if (!Array.isArray(rows)) return JSON.stringify({ err: 'leafOnPlant 없음' });
    const on = rows.filter(x=>x && x.onPlant===true).sort((a,b)=>a.leafBirth-b.leafBirth);
    return JSON.stringify({ m: on.map(x=>Number.isFinite(x.leafM)? +x.leafM.toFixed(3) : 0) });
  }catch(e){ return JSON.stringify({ err:e.message }); } })()`));
  if (r.err) { console.log(d, '⛔', r.err); continue; }
  const g = gradesFor(r.m.length);
  const cells = FLOORS.map(f => won(g, r.m, f).toLocaleString().padStart(11)).join(' ');
  console.log(String(d).padStart(5), String(r.m.length).padStart(3), ' [' + r.m.join(', ') + ']'.padEnd(2),
              cells);
  rows.push({ d, m: r.m, won: Object.fromEntries(FLOORS.map(f => [f, won(g, r.m, f)])) });
}
console.log('');
console.log('■ 이사비 2,000,000 에 «그루값만으로» 닿는 첫 생장일');
for (const f of FLOORS) {
  const hit = rows.find(x => x.won[f] >= 2000000);
  console.log('  밑값 ' + String(f).padEnd(4), hit ? `생장 ${hit.d}일` : '⛔ ' + TO + '일까지 «안 닿음»');
}
await page.close(); clearTimeout(wd);
