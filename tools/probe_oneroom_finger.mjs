/* tools/probe_oneroom_finger.mjs — **이사한 원룸에서 첫 걸음들에 손가락이 서나** (2026-09-06 밤 · 총괄 ⑤)
   ------------------------------------------------------------------
   헤드리스는 방을 두 번째로 못 짓는다(probe_oneroom_boot) ⇒ 같은 손: 이사한 판을 «저장해 두고 새로 켠다».
   재는 것: 새로 켠 원룸에서 ① 손가락이 «무엇»을 짚나(스무 걸음) ② 그 걸음이 판을 바꾸나 ③ 가방의 가구·그루가 «놓이나»
   ⛔ 값 0. 못 재는 것은 못 잰다고 적는다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 1770), H = Number(process.env.H || 1188);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 480000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1);
  await sleep(80); await m('mouseReleased', x, y, 0); await sleep(700); };
const skip = async (n = 120) => {   /* 원룸 도착 대사가 길다(실측: 스무 번으로는 talking 이 안 걷혔다) */
  for (let i = 0; i < n; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (b !== 'true') break;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
      const x=document.getElementById('dlgBox'); if(x)x.click(); const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
    await sleep(250);
  }
};
const fingerAt = () => page.eval(`(()=>{ const h=document.getElementById('hint');
  if (!h || !h.classList.contains('on')) return 'null';
  const r=h.getBoundingClientRect(); const t=document.querySelector('.hintTarget'); const tr=t?t.getBoundingClientRect():null;
  const d=document.getElementById('hintDim'); const hole=(d&&d.dataset.hole||'').split(',').map(Number);
  const at = tr && tr.width ? { x:tr.left+tr.width/2, y:tr.top+tr.height/2 }
           : (hole.length===3 && hole.every(Number.isFinite)) ? { x:hole[0], y:hole[1] } : { x:r.left+r.width/2, y:r.top+r.height/2 };
  return JSON.stringify({ x:at.x, y:at.y, 짚는것: t ? (t.id || (t.className||'').split(' ')[0]) : '(점)',
    말: ((h.querySelector('.say')||{}).textContent||'').trim().slice(0,40), 덮개: !!(d && d.classList.contains('on')) }); })()`);
const snap = () => page.eval(`(()=>{ const S=window.__S(); const fp=S.firstPlay||{};
  return JSON.stringify({ 날:S.day, 방:S.home.room, 이사:!!(S.tutorial&&S.tutorial.movedOut), fp단계:fp.phase, fp끝:!!fp.completed,
    가구가방:((S.home||{}).furnitureBag||[]).length, 가구놓음:((S.home||{}).furnitureAdded||[]).length,
    그루:(S.pots||[]).map(p=>({ id:p.id, 자리:p.slotId||(p.at?'free':null) })),
    할일:(document.getElementById('quest').textContent||'').trim().slice(0,30),
    무대:document.getElementById('stage').className }); })()`);
await skip();
/* 이사 — 상태만 넘기고 저장, 새로 켠다(probe_oneroom_boot 와 같은 손) */
/* ★ 「첫 플레이 «끝» 뒤」의 이사다(총괄 ⑤) — 첫 판(Day 0 · place_beansprout)에서 이사하면 손가락은 첫 플레이 것을 짚는다(실측: 이사 true 인데 할 일이 「시루를 놓아 보세요」).
   첫 플레이 끝은 코어 사실(fp.completed)로 세운다 — 세운 판이다. «걸어서» 첫 새순까지 가는 것은 36일이라 여기서는 안 걷는다(적는다). */
await page.eval(`(()=>{ const S=window.__S(); const ts=S.tutorial; const fp=S.firstPlay;
  if (fp) { fp.completed = true; fp.phase = 'spear_furled'; }
  ts.cashWon = ts.rules.moveOutCostWon + 100000;
  ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day }; window.__redraw(); })()`, false);
await sleep(600);
await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false);
await sleep(6000); await skip();
console.log('■ 이사 직후 —', await snap());
await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){} })()`, false);
await sleep(1200);
await page.goto(`${BASE}/game.html`);
let stood = false;
for (let i = 0; i < 150; i++) { await sleep(1000); if (await page.eval(`String(!!window.__rv)`) === 'true') { stood = true; break; } }
console.log('■ 새로 켠 원룸 —', stood ? '섰다' : '★★ 안 섰다', await snap());
await sleep(2000); await skip();
/* ★ 실측(n2): 새로 켠 원룸에서 talking 이 30초를 넘겨도 안 걷혔다 — 어떤 대사인지, 눌 단추가 있는지 «적고», 보이는 단추를 눌러 본다 */
for (let i = 0; i < 6; i++) {
  const d = JSON.parse(await page.eval(`(()=>{ const s=document.getElementById('stage'); if(!s.classList.contains('talking')) return 'null';
    const box=document.getElementById('dlgBox'); const btns=[...document.querySelectorAll('#dlg button, #dlgBox button, .dlg button')]
      .filter(b=>b.getBoundingClientRect().width>0).map(b=>({ id:b.id, 글:(b.textContent||'').trim().slice(0,16) }));
    return JSON.stringify({ 글:(box?box.textContent:'').trim().replace(/\\s+/g,' ').slice(0,120), 단추:btns, 무대:s.className }); })()`));
  if (!d) break;
  console.log(`  ⚠ 대사가 안 걷힘 — ${JSON.stringify(d)}`);
  const clicked = await page.eval(`(()=>{ const bs=[...document.querySelectorAll('#dlg button, #dlgBox button, .dlg button')].filter(b=>b.getBoundingClientRect().width>0 && !b.disabled);
    const b=bs.find(x=>/다음|확인|닫기|알겠|응|네/.test(x.textContent||'')) || bs[0]; if(!b) return 'none'; b.click(); return b.id||(b.textContent||'').trim().slice(0,10); })()`);
  console.log(`     ↳ 눌렀다: ${clicked}`);
  await sleep(600); await skip();
}
console.log('');
console.log('=== 손가락 스무 걸음 ===');
const steps = [];
let same = 0, last = '';
for (let i = 0; i < 20; i++) {
  await skip();
  const f = JSON.parse(await fingerAt());
  const before = await snap();
  if (!f) { steps.push({ i, 손가락: null, 판: before }); console.log(`  ${String(i).padStart(2)}  ⛔ 손가락 없음  · ${before}`); break; }
  const sig = f.짚는것 + '|' + f.말;
  same = sig === last ? same + 1 : 0; last = sig;
  await tapAt(f.x, f.y); await sleep(600); await skip(10);
  const after = await snap();
  const changed = before !== after;
  steps.push({ i, 손가락: sig, 덮개: f.덮개, 바뀜: changed });
  console.log(`  ${String(i).padStart(2)}  👉 ${f.짚는것.padEnd(12)} 「${f.말}」 덮개:${f.덮개 ? 'O' : 'X'}  판 ${changed ? '바뀜' : '그대로'}`);
  if (same >= 4) { console.log('  ⛔ 같은 손가락 다섯 번 · 판 그대로 — 여기가 막힌 데'); break; }
}
console.log('');
console.log('■ 끝 —', await snap());
await page.shot('docs/handoff/img/oneroom_finger.png').catch(() => {});
await page.close(); clearTimeout(wd);
