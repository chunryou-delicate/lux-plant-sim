/* tools/probe_force5.mjs — **첫 바퀴를 «손가락만 따라» 걸어 본다**
   ------------------------------------------------------------------
   박사님(2026-08-30): *"처음 5일 넘기는 건 강제하자. 중간에 뭐 넣으면 까먹으니까.
     「5일 넘겨보자」라고 가이드하면서 계속 손가락 가이드 [다음 날]로"*
   ⇒ 총괄이 먼저 재라 한 것: ★ **「물 줄 날」이 그 강제 구간 «안»에 있나.**
     울타리가 선 뒤로는 손가락이 [다음 날]만 짚으면 «나머지가 다 막힌다» —
     물 주는 날에 [다음 날]만 짚으면 콩나물이 안 자란다. 그러면 강제가 죽이는 길이 된다.
   재는 법: 손가락이 짚는 것만 누르며 첫 수확까지 간다. 날마다 무엇을 짚었나 적는다.
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
/* ★ 몇 바퀴까지 걸을까 — 첫 수확이 밑값이고, CYCLES=2 로 두 바퀴째까지 본다
   (두 바퀴째라야 「거두기 → 다시 심기 → 물」의 체력을 «걸으며» 잴 수 있다) */
const GOAL = Number(process.env.CYCLES || 1);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 560000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await page.eval(`(()=>{ window.__errs=[];
  for (const k of ['warn','error']) { const o=console[k].bind(console);
    console[k]=(...a)=>{ try{ window.__errs.push(k+' | '+a.map(x=>(x&&x.message)?x.message:String(x)).join(' ').slice(0,110)); }catch{} o(...a); }; }
  addEventListener('error', e=>window.__errs.push('던짐 | '+(e.message||'')));
})()`, false);
await sleep(5000);
const mouse = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapPoint = async (x, y) => {
  await mouse('mouseMoved', x, y, 0);
  await mouse('mousePressed', x, y, 1);
  await sleep(70);
  await mouse('mouseReleased', x, y, 0);
  await sleep(650);
};
const clearDlg = async () => {
  for (let i = 0; i < 40; i++) {
    const t = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`);
    if (t !== 'true') return true;
    await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false);
    await sleep(200);
  }
  return false;
};
const quiet = async () => { for (let i = 0; i < 3; i++) { await clearDlg(); await sleep(600); } };
const fingerAt = () => page.eval(`(()=>{ const h=document.getElementById('hint');
  if (!h || !h.classList.contains('on')) return 'null';
  const r=h.getBoundingClientRect();
  const t=document.querySelector('.hintTarget');
  const tr=t?t.getBoundingClientRect():null;
  const d=document.getElementById('hintDim');
  const hole=(d&&d.dataset.hole||'').split(',').map(Number);
  const at = tr && tr.width ? { x:tr.left+tr.width/2, y:tr.top+tr.height/2 }
           : (hole.length===3 && hole.every(Number.isFinite)) ? { x:hole[0], y:hole[1] }
           : { x:r.left+r.width/2, y:r.top+r.height/2 };
  return JSON.stringify({ x:at.x, y:at.y,
    짚는것: t ? (t.id || (t.className||'').split(' ')[0]) : '(점)',
    말: ((h.querySelector('.say')||{}).textContent||'').trim().slice(0,30) }); })()`);
const now = () => page.eval(`(async()=>{ const fp=await import('/src/game/first_play.js');
  const S=window.__S(); const rs=fp.cropPotList(S.firstPlay, S.day)||[];
  /* ★ 체력도 같이 적는다 — 「손이 몇인가」를 «읽은 표»가 아니라 «걸으며» 확인한다 */
  const stm=await import('/src/game/stamina.js');
  const sv=(()=>{ try { return stm.staminaView(S); } catch(e) { return null; } })();
  const tab=[...document.querySelectorAll('[role=tab]')].find(t=>t.getAttribute('aria-selected')==='true');
  return JSON.stringify({ 날:S.day,
    탭: tab ? tab.id : null,
    체력: sv ? (sv.left ?? sv.now ?? null) + '/' + (sv.max ?? null) : null,
    거둔횟수: ((S.firstPlay&&S.firstPlay.beansprout&&S.firstPlay.beansprout.harvestCount)||0),
    /* ⚠ 이름을 «코어가 부르는 대로» 쓴다 — 예전에 watered·canHarvest 로 물었다가
       늘 거짓을 받았다(그런 자리가 없다). 자가 없는 것을 물으면 조용히 거짓이 나온다.
       ⚠⚠ 그리고 «포개»를 이 안에 쓰지 않는다 — 틀을 거기서 끝낸다(오늘 또 그러셨다). */
    줄: rs.map(r=>({ 종:r.kind, 놓임:!!r.placed, 심어야:!!r.needsSow, 물필요:!!r.needsWater,
                     자람:!!r.growing, 익음:!!r.ready, 거둠:!!r.harvested,
                     남은날:r.daysLeft, 나이:r.ageDays })) }); })()`, true, 30000);
await quiet();
console.log('■ 켠 직후 —', await now());
console.log('');
console.log('=== 손가락만 따라 첫 수확까지 ===');
const log = [];
let taps = 0, lastDay = -1, lastSig = '', same = 0;
for (let i = 0; i < 60 * GOAL; i++) {
  await quiet();
  const st = JSON.parse(await now());
  if (st.거둔횟수 >= GOAL) { console.log(`  ✔ ${GOAL}번째 수확 — Day ${st.날} · 손 ${taps}개 · 체력 ${st.체력}`); break; }
  let f = JSON.parse(await fingerAt());
  /* ★ 쪽지가 떠 있으면 손가락은 «일부러» 쉰다(§coach 규율 ⓑ: 둘이 같이 뜨면 둘 다 안 읽힌다).
     ⇒ 그건 끊긴 길이 아니라 «읽는 동안»이다. 사람처럼 기다렸다가 다시 본다.
     ⚠ 안 기다리면 그 열 초를 「손가락 없음」으로 적게 된다 — 자가 거짓말을 한다. */
  if (!f) {
    for (let k = 0; k < 8; k++) {
      const c = await page.eval(`String(document.getElementById('stage').classList.contains('coaching'))`);
      if (c !== 'true') break;
      await sleep(2000);
    }
    await sleep(600);
    f = JSON.parse(await fingerAt());
  }
  if (!f) {
    /* ★ 손가락이 없으면 «길이 끊긴 것»이다. 그래도 걸음을 멈추지 않는다 —
       사람은 [다음 날]을 누르며 버틴다. 끊긴 자리를 적고 하루를 넘겨 본다.
       ⇒ 그래야 「강제 구간 안에 물 줄 날이 있나」를 끝까지 볼 수 있다. */
    log.push(`Day ${String(st.날).padStart(2)} · ⛔ 손가락 없음 — 스스로 [다음 날]` +
             (st.줄[0] ? `  (물필요:${st.줄[0].물필요 ? 'O' : 'X'} 심어야:${st.줄[0].심어야 ? 'O' : 'X'}` +
                          ` 익음:${st.줄[0].익음 ? 'O' : 'X'} 남은날:${st.줄[0].남은날})` : ''));
    /* ★ 길이 끊긴 «까닭»을 그 자리에서 적는다 — 뒤에서 되짚으려면 판이 필요하다 */
    log.push('   · 그때 화면 — ' + await page.eval(`(()=>{
      const sh=document.getElementById('sheet');
      const f=(id)=>{ const b=document.getElementById(id); if(!b) return null;
        const r=b.getBoundingClientRect();
        return { 보임:b.offsetParent!==null, 잠김:!!b.disabled, 폭:Math.round(r.width),
                 글:(b.textContent||'').trim().slice(0,18) }; };
      const marks=[...document.querySelectorAll('#marks .mark')].map(m=>{
        const r=m.getBoundingClientRect();
        return { 글:(m.getAttribute('aria-label')||m.textContent||'').trim().slice(0,14),
                 네모:[Math.round(r.left),Math.round(r.top),Math.round(r.width)] }; });
      const rowBtns=[...document.querySelectorAll('[data-act]')].map(b=>b.getAttribute('data-act'));
      return JSON.stringify({ 무대:(document.getElementById('stage').className||'').trim(),
        시트열림:!!(sh&&sh.classList.contains('open')),
        시트네모:(()=>{ const r=sh?sh.getBoundingClientRect():null;
          return r?[Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]:null; })(),
        말풍선:marks, 시트줄단추:rowBtns,
        waterCrop:f('waterCrop'), harvestCrop:f('harvestCrop'),
        /* ★ 개수 창(사는 길의 «세 걸음째») — 여기서 손가락이 끊긴 적이 있다 */
        개수창:(()=>{ const p=document.getElementById('buyPanel');
          if(!p) return null; const r=p.getBoundingClientRect();
          return { 열림:p.getAttribute('aria-hidden')!=='true', 폭:Math.round(r.width),
                   보임:p.offsetParent!==null }; })(),
        buyGo:f('buyGo'),
        /* ★ 어느 «줄»이 손가락을 껐나 — 이걸 보려고 __hintLast 를 뒀다 */
        열린창: [...document.querySelectorAll('.pop.on')].map(x=>x.id||x.className),
        줄단추: [...document.querySelectorAll('[data-act]')].map(x=>{
          const r=x.getBoundingClientRect();
          return { 일:x.getAttribute('data-act'), 잠김:!!x.disabled,
                   보임:x.offsetParent!==null, 네모:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)] }; }),
        마지막짚기: window.__hintLast || null,
        집기: window.__pickState ? window.__pickState() : null }); })()`));
    const n = JSON.parse(await page.eval(`(()=>{ const b=document.getElementById('next');
      if (!b || b.disabled) return 'null'; const r=b.getBoundingClientRect();
      return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2 }); })()`));
    if (!n) { log.push('   ⛔ [다음 날]도 못 누른다 — 여기서 정말 막힌다'); break; }
    await tapPoint(n.x, n.y);
    taps++;
    continue;
  }
  log.push(`Day ${String(st.날).padStart(2)} · 체력${st.체력} · ${String(st.탭).padEnd(9)} · ${String(f.짚는것).padEnd(11)} 「${f.말}」` +
           (st.줄[0] ? `  (물필요:${st.줄[0].물필요 ? 'O' : 'X'} 심어야:${st.줄[0].심어야 ? 'O' : 'X'}` +
            ` 익음:${st.줄[0].익음 ? 'O' : 'X'} 남은날:${st.줄[0].남은날})` : ''));
  /* ★ **제자리걸음을 잡는다** — 같은 것을 짚는데 판이 «하나도» 안 바뀌면 그건 멈춘 것이다.
     울타리가 선 뒤로는 다른 것을 누를 수도 없으니, 이 자리가 곧 «판이 죽는» 자리다. */
  const sig = st.날 + '|' + f.짚는것 + '|' + JSON.stringify(st.줄);
  if (sig === lastSig) { same++; } else { same = 0; lastSig = sig; }
  if (same >= 5) {
    log.push(`   ⛔⛔ 제자리걸음 — 같은 것을 ${same + 1}번 짚었는데 판이 안 바뀐다. 여기서 멈춘다.`);
    /* ★ 멈춘 «까닭»을 그 자리에서 적는다 — 나중에 다시 세우려면 판이 필요하다 */
    log.push('   · 그때 화면 — ' + await page.eval(`(()=>{
      const st=document.getElementById('stage'); const sh=document.getElementById('sheet');
      const el=document.elementFromPoint(${Math.round(0)} || 0, 0);
      return JSON.stringify({ 무대:(st.className||'').trim(), 시트열림:!!(sh&&sh.classList.contains('open')),
        아래글:(document.getElementById('dropLabel').textContent||'').trim().slice(0,30),
        탈:(window.__errs||[]).slice(-3) }); })()`));
    log.push('   · 단추 둘 — ' + await page.eval(`(()=>{
      const f=(id)=>{ const b=document.getElementById(id); if(!b) return null;
        const r=b.getBoundingClientRect();
        return { 네모:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
                 보임:b.offsetParent!==null, 잠김:!!b.disabled,
                 글:(b.textContent||'').trim().slice(0,16) }; };
      return JSON.stringify({ harvestCrop:f('harvestCrop'), waterCrop:f('waterCrop'),
        짚는것:(()=>{ const t=document.querySelector('.hintTarget'); return t?(t.id||t.className):null; })() }); })()`));
    log.push('   · 시트 쪽 — ' + await page.eval(`(()=>{
      const pages=[...document.querySelectorAll('.sheetpage')].map(p=>p.id+(p.classList.contains('on')?'*':''));
      const acts=[...document.querySelectorAll('[data-act]')].map(b=>{
        const r=b.getBoundingClientRect(); const pg=b.closest('.sheetpage');
        return { 일:b.getAttribute('data-act'), 쪽:pg?pg.id:null, 켜짐:pg?pg.classList.contains('on'):null,
                 네모:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)] }; });
      const box=document.getElementById('siruBox');
      return JSON.stringify({ 쪽들:pages, 줄단추:acts,
        시루상자: box ? { display:box.style.display, 보임:box.offsetParent!==null } : null }); })()`));
    log.push('   · 짚은 점에서 잡히는 것 — ' + await page.eval(`(()=>{
      const el=document.elementFromPoint(${Math.round(f.x)}, ${Math.round(f.y)});
      return el ? (el.id || el.tagName + '.' + (el.className||'').split(' ')[0]) : 'null'; })()`));
    break;
  }
  await tapPoint(f.x, f.y);
  taps++;
  lastDay = st.날;
}
for (const l of log) console.log('  ' + l);
console.log('');
console.log('=== ★ 총괄이 물은 것 — 물 줄 날이 그 사이에 있나 ===');
{
  const water = log.filter(l => /물 주|물을 주|waterCrop|물을 줄/.test(l));
  const shop = log.filter(l => /주문|상점|씨앗|시루를 하나|무순/.test(l));
  const nextDay = log.filter(l => /next|하루/.test(l));
  console.log('  · 물 주는 손가락이 뜬 날 —', water.length ? water.length + '번' : '없음');
  for (const l of water) console.log('      ' + l);
  console.log('  · ⛔ 사는 갈래가 끼어든 날 —', shop.length ? shop.length + '번' : '없음');
  for (const l of shop) console.log('      ' + l);
  console.log('  · [다음 날]을 짚은 날 —', nextDay.length + '번');
}
console.log('');
console.log('■ 끝 —', await now());
await page.shot('docs/handoff/img/force5.png').catch(() => {});
await page.close(); clearTimeout(wd);
