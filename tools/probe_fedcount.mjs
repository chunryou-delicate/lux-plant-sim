/* tools/probe_fedcount.mjs — **엔진이 받은 빛 칸수 ⇄ 코어가 쌓은 칸수, 늘 맞나**
   ------------------------------------------------------------------
   [growth] 가 `dliFedCount()` 를 냈다(누적 · 읽기 전용). 코어 쪽 짝은 Σ `pots[i].fedDays` 다.
   ⇒ 그 둘이 «갈리면» desync 다 — 엔진만 앞선 상태이고, 그 차만큼 무늬가 다시 굴려진다.
   ⚠ 그런데 **「갈리면 desync」가 되려면 «평상시에는 맞아야»** 한다. 안 맞으면 이 자는
     늘 붉어서 아무도 안 본다. ⇒ 그래서 **먼저 그것부터 잰다.**
   재는 것: ① 하루하루 넘기며 둘이 맞나 ② 새로 켜서 «되감아 세운 뒤»에도 맞나
   ⛔ 값은 안 바꾼다. 고치지도 않는다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const DAYS = Number(process.env.DAYS || 8);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
const J = async (e, t = 60000) => JSON.parse(await page.eval(e, true, t));
const skip = async (n = 30) => {
  for (let i = 0; i < n; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (b !== 'true') break;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
      const x=document.getElementById('dlgBox'); if(x)x.click();
      const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
    await sleep(200);
  }
};
const counts = () => J(`(()=>{ const S=window.__S();
  let fed=0; for(const p of (S.pots||[])) fed += (p.fedDays|0);
  let eng=null; try{ eng = window.__io.growth.dliFedCount(); }catch(e){ eng='탈:'+e.message; }
  return JSON.stringify({ 날:S.day, '엔진이 받은 칸':eng, '코어 fedDays 합':fed,
    '코어 이력 칸':((S.pots||[])[0]||{}).dliHist ? S.pots[0].dliHist.length : null,
    맞나: eng === fed }); })()`);
await skip();
/* 그루를 세워 창턱에 놓는다 — 놓아야 하루가 형태에 먹힌다 */
console.log('■ 그루 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js');
  const S=window.__S(); if(!(S.pots||[]).length) st.givePlant(S, window.__io);
  const p=(S.pots||[])[0];
  const slot=(window.__io.light.room.slots||[]).find(s=>String(s.slotId).startsWith('banjiha-sill:'));
  p.slotId=slot.slotId; p.at=null; p.placedOnce=true; window.__redraw();
  return JSON.stringify({ 화분:p.id, 자리:p.slotId, fedDays:p.fedDays }); })()`)));
await sleep(600);
console.log('■ 처음 —', JSON.stringify(await counts()));
console.log('');
console.log(`=== ① ${DAYS}일을 넘기며 ===`);
for (let d = 0; d < DAYS; d++) {
  /* ⚠ [다음 날] 단추는 첫 플레이가 «문»을 걸어 둔다(시루 물주기 등 · test_nextday_gate).
     여기서 재는 것은 「엔진과 코어가 나란한가」라 ⇒ ★ 코어의 하루를 «곧바로» 부른다.
     화면을 안 지나지만 `nextDay` 는 게임이 쓰는 «그 함수»다 — 흉내가 아니다. */
  const r = await page.eval(`(async()=>{ const loop=await import('/src/game/loop.js');
    try{ loop.nextDay(window.__S(), window.__io); return 'ok'; }
    catch(e){ return '탈: ' + e.message; } })()`, true, 60000);
  if (r !== 'ok') { console.log('  ⚠ 하루가 안 갔습니다 —', r); break; }
  await sleep(400);
  if (d % 2 === 1 || d === DAYS - 1) console.log('  ', JSON.stringify(await counts()));
}
console.log('');
console.log('=== ② 새로 켜서 되감아 세운 뒤 ===');
await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){} })()`, false);
await sleep(1500);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 500);
await sleep(5000);
console.log(' ', JSON.stringify(await counts()));
console.log('');
console.log('=== ③ 하루 더 넘겨도 맞나 ===');
console.log(' ', await page.eval(`(async()=>{ const loop=await import('/src/game/loop.js');
  try{ loop.nextDay(window.__S(), window.__io); return '하루 갔습니다'; }
  catch(e){ return '탈: ' + e.message; } })()`, true, 60000));
await sleep(600);
console.log(' ', JSON.stringify(await counts()));
console.log('');
console.log('=== ④ ⚠ 그루가 «판을 떠나면» 어떻게 되나 (팔기·죽음의 흉내) ===');
/* ★ 코어 쪽 짝이 Σ fedDays 라면, 그루가 목록에서 빠지는 순간 그 합이 «줄어든다».
   엔진의 누적은 안 줄어드므로 ⇒ 그날부터 «영영» 갈린 것으로 보인다.
   ⚠ 이것이 「갈리면 desync」를 그대로 못 쓰는 까닭이다. 재서 확인한다. */
console.log(' ', JSON.stringify(await J(`(()=>{ const S=window.__S();
  const before = (S.pots||[]).reduce((n,p)=>n+(p.fedDays|0),0);
  const gone = S.pots.pop();                       /* 판 셈 치고 목록에서 뺀다 */
  const after = (S.pots||[]).reduce((n,p)=>n+(p.fedDays|0),0);
  let eng=null; try{ eng = window.__io.growth.dliFedCount(); }catch(e){}
  S.pots.push(gone);                               /* ★ 되돌린다 — 재기만 한다 */
  return JSON.stringify({ '뺀 그루':gone.id, '코어 합 전':before, '코어 합 후':after,
    '엔진 누적':eng, 맞나: eng === after,
    판정: eng === after ? '✔ 그대로 맞는다' : '★ 갈린다 — 판 그루의 칸은 엔진에 남는다' }); })()`)));
await page.close(); clearTimeout(wd);
