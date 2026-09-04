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
/* 코어에게 콩나물 주기를 묻는 한 줄 — 판정에서 쓴다(날짜를 자에 안 박는다) */
const HD = "(async()=>{ const fp=await import('/src/game/first_play.js');"
         + " return String(fp.cropKindOf('beansprout').harvestDays); })()";
/* ⚠ 바퀴 수에 맞춰 늘린다 — 한 바퀴에 대략 오 분이다(고정해 두면 긴 걸음이 늘 잘린다) */
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000 + 320000 * GOAL);
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
  const p0=(S.pots||[])[0];
  return JSON.stringify({ 날:S.day,
    몬자리: p0 ? (p0.slotId || (p0.at ? 'free' : null)) : null,
    탭: tab ? tab.id : null,
    /* ★ 「할 일」 한 줄도 걸음마다 적는다 — 오늘 겪은 병이 「할 일과 손가락이 «다른 말»을 한다」였다.
       걸음 줄에 «둘 다» 있어야 눈으로 바로 갈린다(총괄: 자에 그것이 없어 한 번 더 걸어야 했다). */
    할일: (document.getElementById('quest').textContent||'').trim().slice(0,26),
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
let taps = 0, lastDay = -1, lastSig = '', same = 0, deepDone = false, dry = 0;
for (let i = 0; i < 60 * GOAL; i++) {
  await quiet();
  const st = JSON.parse(await now());
  if (st.거둔횟수 >= GOAL) { console.log(`  ✔ ${GOAL}번째 수확 — Day ${st.날} · 손 ${taps}개 · 체력 ${st.체력}`); break; }
  /* ★★★★ 2026-08-31 — **안내가 «제 뜻대로» 끝나는 자리를 «실패로 세지 않는다».**
     두 바퀴를 거두면 거두기·물주기 손가락을 «일부러» 뗀다(박사님 2026-08-17 · §taughtBasics).
     ⇒ 그 뒤로 이 자는 따라갈 손가락이 없어 하루만 넘기게 되고, 예전엔 그것이
       「손가락 끊김 79번 · Day 91」로 붉게 나왔다 — ⛔ 자가 «거짓으로» 우는 것이다.
     ★ 그러니 「안내가 끝났다」로 적고 멈춘다. 그 뒤는 «안내가 아니라 살림»이다. */
  /* ⚠ **한 번 비었다고 끝난 것이 아니다** — 대사·연출 중에는 잠깐 비고, 그 사이에 끊으면
     그 뒤의 걸음(선물 받기·창턱 옮기기)을 통째로 놓친다(실측에서 한 번 그렇게 잘렸다).
     ⇒ «잇달아 세 번» 비어야 끝으로 본다. */
  /* ★ 2026-09-04 — 「세팅 끝 = 손가락 없음」 탈출구를 «뗐다»([plan] ②: 세팅 끝은 «덮개»만 끄고 손가락은 살림 안내로 잇는다).
     그러니 세팅 끝 뒤에 손가락이 없는 것은 뜻대로가 아니라 «끊긴 길»이다 — 아래 예전 자(잇달아 셋 비면 안내 끝)가 그대로 잰다. */
  /* ★ 2026-09-04 — 손이 바쁘면(사람이 물 주러·거두러 가는 중 · .mark.acting) «기다린다». 그 사이 손가락은 일부러 쉬므로 「손가락 없음」이 아니다.
     ⚠ 헤드리스는 연출이 느려(2fps 안팎) 한 동작이 열 몇 초 걸린다 — 60초까지. */
  for (let w = 0; w < 120; w++) {
    const busy = await page.eval(`String(!!document.querySelector('#marks .mark.acting'))`);
    if (busy !== 'true') break;
    await sleep(500);
  }
  if ((st.거둔횟수 || 0) >= 2 && !JSON.parse(await fingerAt())) dry++; else dry = 0;
  if (dry >= 3) {
    log.push(`Day ${String(st.날).padStart(2)} · ✔ 안내가 끝났다 — 두 바퀴를 거두면 손가락을 뗀다(뜻대로)`);
    break;
  }
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
        상점줄: (()=>{ const l=document.getElementById('shopList');
          if(!l) return null; const r=l.getBoundingClientRect();
          return { 칸수:l.children.length, 보임:l.offsetParent!==null,
                   네모:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
                   살것:[...l.querySelectorAll('[data-buy]')].map(b=>b.getAttribute('data-buy')).slice(0,6) }; })(),
        문:['navShop','tabShop','openBag'].map(id=>{ const e=document.getElementById(id);
          if(!e) return id+':없음'; const r=e.getBoundingClientRect();
          return id+':'+(r.width>0&&r.top<innerHeight?'보임':'안보임')+
                 (e.getAttribute('aria-selected')==='true'?'(고름)':''); }),
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
  log.push(`Day ${String(st.날).padStart(2)} · 체력${st.체력} · ${String(f.짚는것).padEnd(11)} 「${f.말}」` +
           `
              할 일 「${st.할일}」` +
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
    /* ★ 가방에 «무엇이» 들었나 · 배너가 «무슨 말»을 했나 — 「눌러도 아무 일이 없다」의 답이 여기 있다 */
    log.push('   · 가방과 배너 — ' + await page.eval(`(()=>{
      const S=window.__S();
      /* 배너의 임자는 #event 다 — #banner 로 물었다가 늘 null 을 받았다(내가 만든 판) */
      const b=document.getElementById('event');
      return JSON.stringify({
        화분들:(S.pots||[]).map(p=>({ id:p.id, 자리:p.slotId||null, 좌표:!!p.at,
                                      놓은적:p.placedOnce, 이름:p.ko||p.name||null })),
        가방칸:[...document.querySelectorAll('#bagGrid [data-potbag]')].map(c=>c.getAttribute('data-potbag')),
        배너: b ? { 보임:b.offsetParent!==null, 글:(b.textContent||'').trim().slice(0,50) } : null,
        할일:(document.getElementById('quest').textContent||'').trim().slice(0,40) }); })()`));
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
  /* ★★ 가방의 그루 칸을 짚었을 때는 **손짓이 어디까지 가나**를 통째로 적는다.
     「눌러도 아무 일이 없다」의 답이 그 사이에 있다(총괄 [d11]). 한 번만 적는다. */
  const deep = /bagslot/.test(String(f.짚는것)) && !deepDone;
  if (deep) {
    deepDone = true;
    await page.eval(`(()=>{ window.__ev=[];
      const b=document.querySelector('#bagGrid [data-potbag]');
      if (b) for (const t of ['pointerdown','pointerup','mousedown','mouseup','click'])
        b.addEventListener(t, ()=>window.__ev.push('칸:'+t), true);
      for (const t of ['pointerdown','pointermove','pointerup','pointercancel'])
        addEventListener(t, ()=>window.__ev.push('창:'+t), true);
    })()`, false);
  }
  /* ★ **누르기 «전»에 겨눈 곳을 확인한다** — 짚는 것과 «그 점에 실제로 잡히는 것»이 다르면
     내가 엉뚱한 데를 누르는 것이고, 그러면 「눌러도 안 된다」가 «자가 만든 판»이 된다.
     ⚠ 오늘 그 함정에 한 번 빠졌다(덮개 구멍이 딴 데 뚫려 있었다). */
  {
    const aim = await page.eval(`(()=>{ const t=document.querySelector('.hintTarget');
      const el=document.elementFromPoint(${Math.round(f.x)}, ${Math.round(f.y)});
      if (!t || !el) return 'null';
      const 맞나 = (el === t) || t.contains(el) || el.contains(t);
      if (맞나) return 'null';
      return JSON.stringify({ 짚는것:(t.id||t.className||'').toString().slice(0,28),
        그점:(el.id||el.tagName+'.'+(el.className||'').toString().split(' ')[0]) }); })()`);
    const o = JSON.parse(aim);
    if (o) log.push('     ⚠ 겨눈 곳이 다르다 — ' + JSON.stringify(o));
  }
  /* ★★★★ 2026-08-31 — **「끌어 보세요」는 «끌어야» 한다.**
     ⚠ 이 자는 손가락이 짚는 곳을 «누르기»만 했다. 그런데 창턱으로 옮기는 걸음은
       **잡아서 끄는** 손짓이라 누르기로는 영영 안 지나간다(총괄 자도 그래서 못 낸다).
     ⇒ 말에 「끌어」가 있으면 «끈다». 잡는 자리는 방에 선 그 화분이고,
       자유 좌표라 자리 열쇠가 없으면 **방 안 아무 데서나** 잡는다 —
       지금 손버릇(direct)은 「잡은 자리로 온다」라 끌어 놓는 점이 곧 갈 자리다. */
  if (/끌어/.test(String(f.말 || ''))) {
    const gp = JSON.parse(await page.eval(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0];
      const rv=window.__rv, c=document.getElementById('roomCanvas');
      if(!c) return 'null';
      const r=c.getBoundingClientRect();
      let sp=null;
      try { if (p && p.slotId && rv && rv.screenPosOf) sp = rv.screenPosOf(p.slotId); } catch(e){}
      if (sp) return JSON.stringify({ x:Math.round(r.left+sp.x), y:Math.round(r.top+sp.y), 잡은곳:'화분' });
      return JSON.stringify({ x:Math.round(r.left+r.width*0.5), y:Math.round(r.top+r.height*0.62), 잡은곳:'방바닥' }); })()`));
    if (gp) {
      await mouse('mouseMoved', gp.x, gp.y, 0);
      await mouse('mousePressed', gp.x, gp.y, 1);
      for (let k = 1; k <= 12; k++) {
        await mouse('mouseMoved', gp.x + (f.x - gp.x) * k / 12, gp.y + (f.y - gp.y) * k / 12, 1);
        await sleep(45);
      }
      await sleep(250);
      await mouse('mouseReleased', f.x, f.y, 0);
      await sleep(1500);
      log.push('     ↳ ★ «끌었다»(' + gp.잡은곳 + ') — ' + await page.eval(`(()=>{ const S=window.__S();
        return JSON.stringify({ 화분:(S.pots||[]).map(p=>({ 자리:p.slotId, 좌표:!!p.at })),
          확인바:(()=>{ const b=document.getElementById('placeOk');
            if(!b) return false; const r=b.getBoundingClientRect(); return r.width>0&&r.height>0; })(),
          아래글:(document.getElementById('dropLabel').textContent||'').trim().slice(0,26) }); })()`));
      taps++; lastDay = st.날;
      continue;
    }
  }
  /* ★ 2026-09-02 — 밥상 창에 닿으면 «설명 상자»가 서 있나·펴졌나를 한 번 적는다(④ plan-bapsang-guide-box).
     첫 밥상(Day 5)은 펴져 있어야 하고, 셋째 날 뒤 밥상은 접혀 있어야 한다 — 그 둘을 걸음이 다 지난다. */
  if (String(f.짚는것) === 'mealGo') {
    log.push('     ↳ 밥상 설명 상자 — ' + await page.eval(`(()=>{ const g=document.getElementById('mealGuide');
      if(!g) return '"없다"'; const r=g.getBoundingClientRect();
      let rec=null; try { rec=JSON.parse(localStorage.getItem('byeot.mealGuideOpens')||'null'); } catch(e){}
      return JSON.stringify({ 보임:r.width>0&&r.height>0, 펴짐:g.open, 몇번째:rec&&rec.n,
        제목:(g.querySelector('summary')||{}).textContent, 문단:g.querySelectorAll('.mg1').length,
        높이:Math.round(r.height) }); })()`));
  }
  await tapPoint(f.x, f.y);
  if (deep) {
    /* ★★★ **누름이 안 먹으면 «끌어» 본다** — 박사님 낱말이 「«끌어놓는» 거」였다.
       ⚠ 총괄 자는 누르기만 낸다(합성 손짓으로 끌기를 못 낸다). 끌기는 여기서만 잰다.
       ⚠ 그리고 이건 «걸어서» 온 판이다 — 세운 판이 아니다(총괄 청). */
    const stillBag = await page.eval(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0];
      return String(!!(p && !p.slotId && !p.at)); })()`);
    if (stillBag === 'true') {
      const at = JSON.parse(await page.eval(`(()=>{ const b=document.querySelector('#bagGrid [data-potbag]');
        const c=document.getElementById('roomCanvas');
        if(!b||!c) return 'null';
        const r=b.getBoundingClientRect(), rc=c.getBoundingClientRect();
        return JSON.stringify({ x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2),
          rx:Math.round(rc.left+rc.width*0.5), ry:Math.round(rc.top+rc.height*0.72) }); })()`));
      if (at) {
        const mm = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
          { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
        await mm('mouseMoved', at.x, at.y, 0);
        await mm('mousePressed', at.x, at.y, 1);
        for (let k = 1; k <= 10; k++) {
          await mm('mouseMoved', at.x + (at.rx - at.x) * k / 10, at.y + (at.ry - at.y) * k / 10, 1);
          await sleep(45);
        }
        await sleep(200);
        await mm('mouseReleased', at.rx, at.ry, 0);
        await sleep(1600);
        log.push('     ↳ ★★ «끌어» 봤다 — ' + await page.eval(`(()=>{ const S=window.__S();
          return JSON.stringify({ 화분:(S.pots||[]).map(p=>({ 자리:p.slotId, 좌표:!!p.at, 놓은적:p.placedOnce })),
            확인바:(()=>{ const b=document.getElementById('placeOk');
              if(!b) return false; const r=b.getBoundingClientRect(); return r.width>0&&r.height>0; })(),
            아래글:(document.getElementById('dropLabel').textContent||'').trim().slice(0,26),
            배너:(()=>{ const b=document.getElementById('event'); return b?((b.textContent||'').trim().slice(0,40)):null; })() }); })()`));
      } else log.push('     ↳ ⚠ 끌 칸을 못 찾았다');
    }
    log.push('     ↳ ★ 손짓이 간 곳 — ' + await page.eval(`(()=>{
      const S=window.__S();
      return JSON.stringify({ 받은것:(window.__ev||[]),
        집기: window.__pickState ? window.__pickState() : null,
        끌기: window.__dragState ? window.__dragState() : null,
        /* ⚠ 탈을 «통째로» 낸다 — 끝의 셋만 보다가 「던짐」을 놓쳤다(오늘 그 판에 한 번 속았다) */
        탈전부:(window.__errs||[]).slice(-10),
        아래글:(document.getElementById('dropLabel').textContent||'').trim().slice(0,24),
        화분:(S.pots||[]).map(p=>({ 자리:p.slotId, 좌표:!!p.at, 놓은적:p.placedOnce })),
        확인바:(()=>{ const b=document.getElementById('placeOk');
          if(!b) return null; const r=b.getBoundingClientRect(); return { 보임:r.width>0&&r.height>0 }; })(),
        배너:(()=>{ const b=document.getElementById('event');
          return b?((b.textContent||'').trim().slice(0,50)):null; })() }); })()`));
  }
  /* ★ 누른 «직후»에 배너를 한 번 훔쳐본다 — 배너는 몇 초 뒤 사라져서,
     제자리걸음이 잡힐 때쯤이면 「아무 말도 없었다」로 보인다(자가 거짓말하는 꼴). */
  {
    const bn = await page.eval(`(()=>{ const b=document.getElementById('event');
      if(!b) return 'null'; const t=(b.textContent||'').trim();
      return JSON.stringify({ 보임:b.offsetParent!==null, 글:t.slice(0,60) }); })()`);
    const o = JSON.parse(bn);
    if (o && o.글) log.push('     ↳ 배너 — ' + o.글);
  }
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
/* ══════════════════════════════════════════════════════════════════════════
   ★★★ **판정** — 이 자는 재기만 하는 것이 아니라 «지키는 자»이기도 하다.
   한 줄로: **손가락만 따라가면 판이 돈다.** 그것이 무너지면 여기서 붉게 선다.
   ⚠ 날짜를 박지 않는다 — 콩나물 주기(코어)에서 세어 나온 것에 하루 여유를 준다.
   ⚠ 「손가락 없음」은 «몇 번까지»로 견준다. 대사·연출 중에는 손가락이 일부러 쉬므로
     한두 번은 자연스럽다(0 으로 못 박으면 자가 거짓으로 붉어진다).
   ══════════════════════════════════════════════════════════════════════════ */
{
  const 끝 = JSON.parse(await now());
  const 굳음 = log.some(l => /제자리걸음/.test(l));
  const 없음 = log.filter(l => /손가락 없음/.test(l)).length;
  /* ⚠ 주기를 여기 안 박는다 — 코어에게 묻는다(작물이 바뀌어도 자가 저절로 맞는다) */
  let 주기 = 5;
  try { 주기 = Number(await page.eval(HD, true, 30000)) || 5; } catch { }
  const 마지노 = (주기 + 1) * GOAL;
  const 판정 = [
    /* ⚠ 손가락이 이끄는 것은 «두 바퀴»까지다(그 뒤는 일부러 뗀다). 그 너머를 요구하지 않는다. */
    ['한 바퀴가 돈다 (거둔 횟수)', 끝.거둔횟수 >= Math.min(GOAL, 2),
     끝.거둔횟수 + '/' + Math.min(GOAL, 2)],
    ['제자리걸음이 없다', !굳음, 굳음 ? '있다' : '없다'],
    ['마지노(' + 마지노 + '일) 안에 끝난다', 끝.날 <= 마지노, 'Day ' + 끝.날],
    ['손가락이 끊긴 자리가 적다', 없음 <= 2 * GOAL, 없음 + '번'],
    /* ★ 박사님이 받는 문 — 「몬스테라가 «창턱에 섰나»」. 자리 이름을 박지 않고 계통만 본다. */
    ['몬스테라가 창턱에 섰다', /sill/.test(String(끝.몬자리 || '')), String(끝.몬자리 || '(아직)')],
  ];
  console.log('');
  console.log('=== ★ 판정 — 손가락만 따라가면 판이 도나 ===');
  let bad = 0;
  for (const [ko, ok, v] of 판정) { if (!ok) bad++; console.log('  ' + (ok ? 'OK  ' : 'FAIL') + ' ' + ko + '  → ' + v); }
  console.log('');
  console.log(bad ? ('⛔ ' + bad + '개가 떨어졌습니다') : '✓ 다 통과');
  if (bad) process.exitCode = 1;
}
/* ★★★ 2026-09-02 — **「퀘스트가 «뜬 날» + «무엇이 열었나»」** ([plan] 청 · 총괄 ③).
   ⚠ 「뜬 날」은 «걸어야» 나오고, 「열쇠」는 코어의 `opens` 를 «그대로» 찍는다 — 내가 옮겨 적지 않는다.
   ⚠ 「after」는 «열리는 조건»이지 «뜨는 차례»가 아니다 — 몬스테라는 사슬 «밖»(두 바퀴)에서 온다. */
{
  const rows = JSON.parse(await page.eval(`(async()=>{
    const q=await import('/src/game/quest.js'); const d=await import('/src/game/dialogue.js');
    const open2q = {}; for (const [qid, sid] of Object.entries(d.QUEST_OPEN_SCRIPT||{})) open2q[sid]=qid;
    const done2q = {}; for (const [qid, sid] of Object.entries(d.QUEST_DONE_SCRIPT||{})) done2q[sid]=qid;
    const all = (q.QUESTS||q.MAIN_QUESTS||[]);
    const byId = {}; for (const x of all) byId[x.id]=x;
    const seenOpen = {}, seenDone = {};
    for (const e of (window.__dlgLog||[])) {
      if (open2q[e.id] && seenOpen[open2q[e.id]]==null) seenOpen[open2q[e.id]] = e.day;
      if (done2q[e.id] && seenDone[done2q[e.id]]==null) seenDone[done2q[e.id]] = e.day;
    }
    /* ⚠ 정규식을 «안 쓴다» — 틀(템플릿) 안에서 역슬래시가 녹아 브라우저가 「Invalid group」으로 던졌다(실측).
       화살표 «뒤»만 남기고 공백을 접는다. 그것으로 충분하다 — 열쇠는 사람이 «읽는» 것이다. */
    const src = f => { try { const t=String(f); const i=t.indexOf('=>');
      return (i>=0 ? t.slice(i+2) : t).split(String.fromCharCode(10)).join(' ').split(/ +/).join(' ').trim().slice(0,90); } catch(e){ return '?'; } };

    return JSON.stringify(all.map(x => ({ id:x.id, 뜬날: seenOpen[x.id] ?? null, 끝난날: seenDone[x.id] ?? null,
      after: x.after || null, 열쇠: src(x.opens) }))); })()`, true, 30000));
  console.log('');
  console.log('=== ★ 퀘스트가 «뜬 날» + «열쇠»(코어 opens 그대로) ===');
  for (const r of rows)
    console.log(`  ${r.id.padEnd(14)} 뜬 d${r.뜬날 == null ? '—' : r.뜬날}  끝 d${r.끝난날 == null ? '—' : r.끝난날}  after:${String(r.after||'—').padEnd(14)} 열쇠: ${r.열쇠}`);
}
await page.shot('docs/handoff/img/force5.png').catch(() => {});
await page.close(); clearTimeout(wd);
