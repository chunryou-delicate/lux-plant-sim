/* tools/leaf/_shot_midleaf.mjs — **«중간잎»까지 걸어서 등급 A/B**
   ★ 총괄이 붙인 셋:
     ① 나갈 자리를 «반드시» 받는다 — 없으면 «안 돌린다»(오늘 세 번 덮어썼다 · §2.9 63)
     ② ★ 「중간잎이 났나」를 «먼저» 찍는다 — 「같다」와 「아직 안 났다」가 같은 그림으로 온다(65)
     ③ 갈리면 닫고, 같으면 «성숙잎까지 밀지 말고» 남기고 멈춘다
   ⛔ 아무것도 안 고친다. */
import { launch, sleep } from '../test_cdp.mjs';
import fs from 'node:fs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
/* ★① 나갈 자리를 안 주면 «안 돌린다» */
const OUT = process.env.OUTSHOT;
if (!OUT) { console.error('⛔ OUTSHOT= 나갈 자리를 주십시오 (덮어쓰기 막개)'); process.exit(2); }
if (fs.existsSync(OUT)) { console.error('⛔ 이미 있는 파일입니다 —', OUT, '· 다른 이름을 주십시오'); process.exit(2); }
const SAVE = fs.readFileSync(process.env.SAVE || 'docs/handoff/saves/leaf_sill.json','utf8');
const MAX = Number(process.env.MAX || 200);
const wd=setTimeout(()=>{console.error('⏱ 자가 제한');process.exit(2);},555000); wd.unref?.();
const page = await launch({ width:390, height:844, dpr:2 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source:
  `try{ localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); }catch(e){}` });
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv',150000,300); await sleep(9000);
const quiet=async()=>{for(let k=0;k<4;k++){for(let i=0;i<40;i++){
  if(await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`)!=='true')break;
  await page.eval(`(()=>{const x=document.getElementById('dlgBox'); if(x)x.click();})()`,false); await sleep(150);} await sleep(340);}};
const water=()=>page.eval(`(()=>{const b=document.getElementById('waterPot');
  if(b&&!b.disabled&&b.offsetParent!==null){b.click();return 'o';}
  for(const m of document.querySelectorAll('.mark')){ if(/몬스테라.*물|물.*몬스테라/.test(m.textContent||'')){m.click();return 'm';} }
  return '-';})()`);
const nextDay=()=>page.eval(`(()=>{for(const id of ['mealGo','next']){const b=document.getElementById(id);
  if(b&&!b.disabled&&b.offsetParent!==null){b.click();return id;}}return 'none';})()`);
const now=()=>page.eval(`(()=>{try{const g=window.__io.growth;const p=g.growthPhase();
  const l=g.leafState()||[];
  return JSON.stringify({단계:p.phaseId,진행:+p.progress01.toFixed(2),유효:g.growthDays(),day:window.__S().day,
    줄:l.length, 성숙:l.filter(r=>r&&r.matured).length,
    무늬성숙:l.filter(r=>r&&r.matured&&r.varie).length});}catch(e){return '{}';}})()`);
await quiet();
console.log('세이브:', process.env.SAVE || 'leaf_sill', '· 나갈 자리:', OUT);
console.log('시작:', await now());
let s=null,w=0;
for(let d=0; d<MAX; d++){
  s=JSON.parse(await now());
  /* ★② 「중간잎이 났나」를 단계로 본다 */
  const GOAL=process.env.GOAL||'mid';
  const hit = GOAL==='varie' ? (s.무늬성숙>0)
            : GOAL==='mature' ? (s.성숙>0 || /mature|adult/i.test(s.단계||''))
                              : /mid|mature/i.test(s.단계||'');
  if(hit){ console.log('★★ 닿음:', JSON.stringify(s)); break; }
  const r=await water(); if(r!=='-') w++;
  if(d%12===0) console.log(`  +${String(d).padStart(3)}일 ${JSON.stringify(s)}`);
  const n=await nextDay(); if(n==='none'){ await quiet(); await sleep(180); }
  await sleep(360);
  if(d%8===7) await quiet();
}
console.log('마지막:', JSON.stringify(s), '· 물', w, '번');
/* ★② 단계 이름을 그대로 남긴다 — 「안 났다」와 「같다」를 뒤에서 가를 수 있게 */
console.log('★ 단계 전문:', await page.eval(`(()=>{try{return JSON.stringify(window.__io.growth.growthPhase());}catch(e){return 'ERR';}})()`));
await quiet();
await page.eval(`(()=>{const h=document.getElementById('hint'); if(h)h.classList.remove('on');
  const d=document.getElementById('hintDim'); if(d)d.style.display='none';})()`,false);
await sleep(400);
const z=await page.eval(`(()=>{try{const b=[...document.querySelectorAll('button')].find(x=>/확대|크게/.test(x.textContent||''));
  if(b){b.click();return 'btn';} return 'none';}catch(e){return 'ERR';}})()`);
await sleep(11000);
/* ★★ 뜬 창을 «다» 닫는다 — 가계부·구호·끝창이 확대창을 덮는다.
   ⚠ 실측(2026-09-07): 두 판 다 «3번째 달 가계부»가 덮여서 「화소가 같다」가 나왔다.
     그건 잎을 견준 것이 아니라 «창을 견준» 것이었다. 하마터면 그대로 낼 뻔했다. */
for (let k=0;k<8;k++){
  const hit = await page.eval(`(()=>{const t=[...document.querySelectorAll('button')].find(b=>{
      const r=b.getBoundingClientRect(); if(r.width<8||r.height<8||b.offsetParent===null) return false;
      return /^(알겠습니다|고맙습니다|확인|닫기|×)$/.test((b.textContent||'').trim()); });
    if(!t) return 'none'; t.click(); return (t.textContent||'').trim().slice(0,8);})()`);
  if (hit==='none') break;
  console.log('   창 닫음:', hit); await sleep(700); await quiet();
}
await page.eval(`(()=>{for(const id of ['reliefBox','gameOver','monthBox','detail']){const e=document.getElementById(id); if(e)e.style.display='none';}})()`,false).catch(()=>{});
await sleep(800);
/* ★★ 찍기 «전»에 「식물이 정말 보이나」를 자가 스스로 본다 — 안 보이면 안 찍는다 */
const seen = await page.eval(`(()=>{const c=document.getElementById('roomCanvas');
  const pops=[...document.querySelectorAll('.pop,.card')].filter(e=>e.offsetParent!==null
    && e.getBoundingClientRect().width>200 && e.getBoundingClientRect().height>200);
  return JSON.stringify({덮은창:pops.map(e=>e.id||e.className).slice(0,4), 판:!!c});})()`);
console.log('★ 덮은 것:', seen);
if (JSON.parse(seen).덮은창.length) { console.error('⛔ 아직 창이 덮고 있다 — 안 찍는다'); await page.close(); process.exit(3); }
await page.shot(OUT);
console.log('찍음:', OUT, '· 확대:', z);
/* ★ 그림 «열쇠»를 읽는다 — 「값은 무늬인데 그림은 민무늬」를 이것으로 잡는다 */
console.log('★ 쓰는 그림 열쇠:', await page.eval(`(()=>{try{
  const w=window.__growWin||window; 
  if(typeof w.leafSkinsAll==='function') return JSON.stringify(w.leafSkinsAll());
  return 'no-api';}catch(e){return 'ERR '+e.message;}})()`));
/* ★ 판을 남긴다 — 다음에 «이어» 걷는다(200일을 다시 걷지 않게) */
if (process.env.DUMP) {
  const raw = await page.eval(`(()=>{try{return localStorage.getItem('byeot/save/1')||'';}catch(e){return '';}})()`);
  if (raw && raw.length > 1000) { fs.writeFileSync(process.env.DUMP, raw); console.log('★ 판 남김:', process.env.DUMP, raw.length, '자'); }
  else console.log('⛔ 판을 못 남겼다 —', (raw||'').length, '자');
}
console.log('잎:', await page.eval(`(()=>{try{return JSON.stringify(window.__io.growth.leafState().map(r=>({생:r.leafBirth,무늬:r.varie,성숙:r.matured})));}catch(e){return 'ERR';}})()`));
await page.close();
