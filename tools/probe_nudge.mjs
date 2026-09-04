/* tools/probe_nudge.mjs — **독촉 낯 넷이 «빈 날»에 «한 줄»씩, «날»에 따라 갈려 나오나** (2026-09-02)
   ------------------------------------------------------------------
   박사님: "퀘스트 안 하면 몬이가 매일매일 독촉하도록". [plan] plan-quest-nudge · 총괄 결정 ㉮(열린 날을 적는다).
   재는 법: 시루를 놓고 심고 물까지 준 뒤(손가락 따라) [다음 날]만 «열여덟 번» 누른다.
     첫 수확(d5)이 지나면 order_seed 가 열리고 사람은 «아무것도 안 한다» ⇒ 빈 날이 이어진다.
   재는 것: ① 어느 날 어느 독촉이 나왔나(__dlgLog) ② 하루에 독촉이 «둘» 나온 날은 없나
            ③ 다른 대사가 있는 날엔 «안» 나오나 ④ 「열린 날」이 세이브에 «실리나»(§save)
   ⛔ 값(날 문턱)은 [plan] 밑값 — 여기서 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 1770), H = Number(process.env.H || 1188);
const DAYS = Number(process.env.DAYS || 18);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 600000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4500);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1);
  await sleep(80); await m('mouseReleased', x, y, 0); await sleep(800); };
const clearDlg = async () => { for (let i = 0; i < 40; i++) {
  const t = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`);
  if (t !== 'true') return true;
  await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false);
  await sleep(200); } return false; };
const quiet = async () => { for (let i = 0; i < 3; i++) { await clearDlg(); await sleep(500); } };
const tapHint = async () => {
  const at = JSON.parse(await page.eval(`(()=>{ const t=document.querySelector('.hintTarget');
    const d=document.getElementById('hintDim'); const hole=(d&&d.dataset.hole||'').split(',').map(Number);
    if (t) { const r=t.getBoundingClientRect(); if (r.width>0) return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2, 짚:t.id||t.className }); }
    if (hole.length===3 && hole.every(Number.isFinite)) return JSON.stringify({ x:hole[0], y:hole[1], 짚:'(점)' });
    return 'null'; })()`));
  if (!at) return null;
  await tapAt(at.x, at.y); await quiet();
  return at.짚;
};
/* ① 첫날 — 손가락을 따라 심고 물까지 준다(가르침 그대로) */
await quiet();
const path = [];
for (let i = 0; i < 12; i++) {
  const st = JSON.parse(await page.eval(`(async()=>{ const fp=await import('/src/game/first_play.js'); const S=window.__S();
    const r=(fp.cropPotList(S.firstPlay,S.day)||[])[0]||{}; return JSON.stringify({ 물필요:!!r.needsWater, 자람:!!r.growing, 심어야:!!r.needsSow, 놓임:!!r.placed }); })()`, true, 30000));
  if (st.놓임 && st.자람) break;
  const who = await tapHint(); path.push(who || '(없음)'); if (!who) break;
}
console.log('■ 첫날 걸음 —', path.join(' → '));
/* ② 그 뒤로는 [다음 날]만 — 손가락이 무엇을 짚든 «안 따른다». 빈 날을 만든다 */
const nextDay = async () => {
  for (let k = 0; k < 4; k++) {
    await quiet();
    const go = JSON.parse(await page.eval(`(()=>{
      const pop=document.querySelector('.pop.on');
      const b = pop ? [...pop.querySelectorAll('button.go')].find(x=>!x.disabled) : null;
      const n = b || document.getElementById('next');
      if(!n || n.disabled) return 'null'; const r=n.getBoundingClientRect();
      return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2, id:n.id }); })()`));
    if (!go) { await sleep(400); continue; }
    const before = await page.eval(`String(window.__S().day)`);
    await tapAt(go.x, go.y); await quiet();
    const after = await page.eval(`String(window.__S().day)`);
    if (after !== before) return true;
  }
  return false;
};
const d0 = Number(await page.eval(`String(window.__S().day)`));
for (let i = 0; i < DAYS; i++) { if (!await nextDay()) { console.log('⚠ 하루를 못 넘겼다 — 여기서 멈춘다'); break; } }
/* ③ 대사 기록에서 날마다 «무엇이» 나왔나 */
const log = JSON.parse(await page.eval(`JSON.stringify((window.__dlgLog||[]).map(e=>({ d:e.day, id:e.id })))`));
const byDay = {};
for (const e of log) { (byDay[e.d] = byDay[e.d] || []).push(e.id); }
const opened = JSON.parse(await page.eval(`JSON.stringify((window.__S().stamina||{}).questsOpenedOn||null)`));
const taken = JSON.parse(await page.eval(`JSON.stringify((window.__S().stamina||{}).questsTaken||[])`));
console.log('■ 열린 날(questsOpenedOn) —', JSON.stringify(opened), '· 끝난 것 —', JSON.stringify(taken));
console.log('');
console.log('=== 날마다 나온 대사 (독촉은 ★) ===');
const isNudge = id => /^nudge/.test(id);
let twice = [], withOthers = [], seen = {};
for (const d of Object.keys(byDay).map(Number).sort((a, b) => a - b)) {
  const ids = byDay[d]; const n = ids.filter(isNudge);
  if (n.length > 1) twice.push(d);
  if (n.length && ids.some(x => !isNudge(x))) withOthers.push(d);
  for (const x of n) if (seen[x] == null) seen[x] = d;
  console.log(`  d${String(d).padStart(2)}  ${ids.map(x => isNudge(x) ? '★' + x : x).join(' · ')}`);
}
/* ④ 세이브에 실리나 — 저장 후 되읽어 같은가 */
const round = JSON.parse(await page.eval(`(async()=>{ try {
  const sv=await import('/src/game/save.js'); const S=window.__S();
  const out=sv.serialize(S); const raw=(typeof out==='string')?JSON.parse(out):JSON.parse(JSON.stringify(out));
  const back=raw.state && raw.state.stamina && raw.state.stamina.questsOpenedOn;
  return JSON.stringify({ 실림: !!back, 같음: JSON.stringify(back||null)===JSON.stringify((S.stamina||{}).questsOpenedOn||null) });
} catch(e){ return JSON.stringify({ 탈:e.message }); } })()`, true, 30000));
console.log('');
console.log('=== 판정 ===');
const ok = (ko, v, why) => console.log(`  ${v ? 'OK  ' : 'FAIL'} ${ko}  → ${why}`);
ok('열린 날이 적힌다', !!opened && Object.keys(opened).length >= 3, JSON.stringify(opened));
ok('독촉이 «나온다»(빈 날에 하나라도)', Object.keys(seen).length >= 1, JSON.stringify(seen));
ok('★ 하루에 독촉이 «둘» 나온 날이 없다', twice.length === 0, twice.length ? 'd' + twice.join(',d') : '없음');
ok('★ 다른 대사가 있는 날엔 독촉이 «안» 나온다(맨 뒤)', withOthers.length === 0, withOthers.length ? 'd' + withOthers.join(',d') : '없음');
ok('낯이 «날»에 따라 갈린다(권함 → 궁금 순)',
   (seen.nudgeOffer == null || seen.nudgeAsk == null) || seen.nudgeOffer < seen.nudgeAsk, JSON.stringify(seen));
ok('세이브에 실리고 되읽어도 같다', !!(round.실림 && round.같음), JSON.stringify(round));
await page.shot('docs/handoff/img/nudge.png').catch(() => {});
await page.close(); clearTimeout(wd);
