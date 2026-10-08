/* tools/probe_moncard.mjs — **식물 시트 맨 위 몬스테라 카드가 확대창 게이지와 같은 값을 말하나** (2026-10-08 · [plan] plan-leafwait ③-3) · probe_leafwait 의 판 세우기를 그대로 쓴다
   (옛 머리 — tools/probe_leafwait.mjs 「진짜 생장 창에서 turn.leafWait 칸이 읽히나」 (2026-10-08 · [plan] plan-leafwait ③)
   ------------------------------------------------------------------
   칸 셈 자체는 tools/test_leaf_wait.mjs(가짜 하루)가 본다. 여기는 «배선»만 본다:
     ① 잎 줄을 생장 창(leafOnPlant)에서 읽나 — leaves·youngestLeafM 이 null 이 아닌가
     ② 창턱 · 밴드 낱말 · 자란 날 · 기다린 날이 하루마다 움직이나
     ③ 확대창을 열면 zoomOpenedSinceArrival 이 참이 되나
     ④ 상태 줄(status*)이 대사 기록(__dlgLog)에 나오나 — 나오면 어느 날 무엇이
   ⚠ 판은 «지름길»로 세운다: 선물 그루를 창턱(banjiha-sill:0)에 바로 주고 arrived 를 켠다. 물은 사흘마다 준다.
     그래서 이 자는 «보통 판의 날짜»를 안 잰다 — 그것은 night_play guided(총괄)가 잰다.
   판: 폰 390×844. DAYS(기본 24). ⛔ 값 0. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:9300';
const DAYS = Number(process.env.DAYS || 24);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 900000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 240000, 500);
await sleep(3500);
const J = async (e) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${e})); } catch(e) { return JSON.stringify({ 탈:e.message }); } })()`, true, 60000));
const clearDlg = async () => { for (let i = 0; i < 60; i++) { const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return; await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(120); } };
await clearDlg();
/* 첫날 [다음 날] 문지기는 «방에 선 시루»를 본다 — 손가락대로 시루를 놓는다(probe_walk_trap ① 과 같은 걸음) */
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(80); await m('mouseReleased', x, y, 0); await sleep(700); };
for (let i = 0; i < 8; i++) {
  const placed = await J(`(()=>{ try { return window.__S().firstPlay.beansprout.pots.some(p=>p && (p.slotId || p.at)); } catch(e) { return false; } })()`);
  const say = await J(`(()=>{ const h=document.getElementById('hint'); return h ? ((h.querySelector('.say')||{}).textContent||'').trim() : ''; })()`);
  if (placed && !/둘까요/.test(say)) break;
  const at = await J(`(()=>{ const t=document.querySelector('.hintTarget'); if(!t) return null; const r=t.getBoundingClientRect(); return r.width>0 ? { x:r.left+r.width/2, y:r.top+r.height/2 } : null; })()`);
  if (!at) break; await tapAt(at.x, at.y); await clearDlg();
}
console.log('■ 시루 놓음 —', await J(`window.__S().firstPlay.beansprout.pots.some(p=>p && (p.slotId || p.at))`));
console.log('■ 판 세우기 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const S=window.__S();
  if(!(S.pots||[]).length) st.givePlant(S, window.__io, { slotId:'banjiha-sill:0' });
  const p=S.pots[0]; S.firstPlay.monstera.arrived=true; p.arrivedOnDay=S.day;
  try { window.__redraw && window.__redraw(); } catch(e){}
  return { day:S.day, pot:p.id, slotId:p.slotId, arrivedOnDay:p.arrivedOnDay }; })()`)));
await sleep(1500);
const nextDay = async () => {
  await clearDlg();
  const d0 = await J(`window.__S().day`);
  /* 카메라·창이 늦게 서면 한 번에 안 넘어간다 — 날이 바뀔 때까지 다시 누른다(최대 여덟 번) */
  for (let k = 0; k < 8; k++) {
    if (k) { await sleep(700); if ((await J(`window.__S().day`)) !== d0) break; }
    const r = await J(`(()=>{ const p=document.querySelector('.pop.on'); const b=p ? [...p.querySelectorAll('button.go,button.primary')].find(x=>!x.disabled) : null;
      if (b) { b.click(); return 'pop'; } const n=document.getElementById('next'); if(!n||n.disabled) return null; n.click(); return 'next'; })()`);
    await sleep(900); await clearDlg();
    if (r !== 'pop' && (await J(`window.__S().day`)) !== d0) break;
  }
};

for (let i = 0; i < Number(process.env.DAYS || 3); i++) { if (i % 3 === 0) await J(`(async()=>{ const st=await import('/src/game/state.js'); try { st.waterPot(window.__S()); } catch(e) {} return 1; })()`); await nextDay(); }
await page.eval(`(()=>{ try { window.__byeotSheet.open('plants'); } catch(e){} window.__redraw && window.__redraw(); })()`, false);
await sleep(800);
const card = await J(`(()=>{ const t=id=>(document.getElementById(id)||{}).textContent||''; const b=document.getElementById('monCard'); const p=document.getElementById('pagePlants');
  return { shown: !!(b && getComputedStyle(b).display!=='none'), first: p ? (p.querySelector('.box,.quest')||{}).id : null,
           leaves: t('mcLeaves'), phase: t('mcPhase'), next: t('mcNext'), fill: (document.getElementById('mcFill')||{style:{}}).style.width, where: t('mcWhere'),
           ggPhase: t('ggPhase'), ggNext: t('ggNext'), ggFill: (document.getElementById('ggFill')||{style:{}}).style.width,
           lw: window.__leafWait(), dli: /\d+\.\d+\s*(mol|DLI)/.test(b ? b.textContent : '') }; })()`);
console.log('■ 카드 —', JSON.stringify(card));
let fail = 0;
const ok = (c, msg) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${msg}`); if (!c) fail++; };
ok(card.shown, '카드가 보인다(초보 판 · 그루 있음)');
ok(card.phase === card.ggPhase && card.next === card.ggNext && card.fill === card.ggFill, `확대창 게이지와 같은 값(${card.phase} ${card.next} ${card.fill})`);
ok(/몬스테라 · 잎 \d+장/.test(card.leaves) && (!card.lw || card.leaves.includes(`잎 ${card.lw.leaves}장`)), `잎 줄 — ${card.leaves}`);
ok(/자리 {2}(자라지 않는 빛|자라는 빛|밝은 빛 — 무늬가 좋아지는 자리)/.test(card.where), `자리 줄 — ${card.where} (밴드 ${card.lw && card.lw.band})`);
ok(!card.dli && !/일 뒤|일 남/.test(card.leaves + card.next + card.where), '날수·DLI 숫자를 안 쓴다');
if (process.env.SHOT) await page.shot(process.env.SHOT);
await page.close(); clearTimeout(wd);
console.log(fail ? `\nprobe_moncard: FAIL ${fail}` : '\nprobe_moncard: PASS');
process.exit(fail ? 1 : 0);
