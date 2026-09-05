/* tools/probe_movemarks.mjs — **시루를 «옮기면» 말풍선·단추(씨앗 심기·물 주기)가 사라지나** (2026-09-06 아침 · 박사님)
   ------------------------------------------------------------------
   세운 판: 시루를 놓고(심기 전) → 방의 시루를 눌러 [옮기기] → 딴 칸으로 끌어 놓기 → [확인] → «옮기기 전/후»를 견준다:
   말풍선(#marks .mark) 몇 개·글 · 아래 단추(#waterCrop·#harvestCrop) 보임 · [식물] 줄 단추(data-act) · picked.mode · stage 클래스 · .mark.acting
   판: W×H(밑값 1770×1188 · 폰은 W=390 H=844) · 진짜 마우스. ⛔ 값 0. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 1770), H = Number(process.env.H || 1188);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(80); await m('mouseReleased', x, y, 0); await sleep(700); };
const dragTo = async (x0, y0, x1, y1) => { await m('mouseMoved', x0, y0, 0); await m('mousePressed', x0, y0, 1);
  for (let k = 1; k <= 12; k++) { await m('mouseMoved', x0 + (x1 - x0) * k / 12, y0 + (y1 - y0) * k / 12, 1); await sleep(40); }
  await sleep(250); await m('mouseReleased', x1, y1, 0); await sleep(1000); };
const clearDlg = async () => { for (let i = 0; i < 40; i++) { const t = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`); if (t !== 'true') return; await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(150); } };
const J = async (js) => JSON.parse(await page.eval(`(()=>{ try { return JSON.stringify((${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`));
const tapEl = async (sel) => { const r = await J(`(()=>{ const all=[...document.querySelectorAll(${JSON.stringify(sel)})]; const b=all.find(e=>{ const r=e.getBoundingClientRect(); return r.width>0&&r.height>0; }); if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`); if (!r) return false; await tapAt(r.x, r.y); return true; };
const dump = (tag) => J(`(()=>{ const st=document.getElementById('stage');
  const marks=[...document.querySelectorAll('#marks .mark')].map(e=>({ 글:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,14), 보임:e.getBoundingClientRect().width>0, cls:e.className }));
  const btn=id=>{ const b=document.getElementById(id); if(!b) return null; const r=b.getBoundingClientRect(); return { 보임:r.width>0&&getComputedStyle(b).display!=='none', 잠김:!!b.disabled, 글:(b.textContent||'').trim().slice(0,16) }; };
  const rows=[...document.querySelectorAll('#siruList button[data-act]')].map(b=>({ act:b.dataset.act, 잠김:!!b.disabled, 보임:b.getBoundingClientRect().width>0 }));
  const S=window.__S(); const pots=(S.firstPlay&&S.firstPlay.beansprout&&S.firstPlay.beansprout.pots)||[];
  return { tag:${JSON.stringify('')}+${JSON.stringify(tag)}, 무대:st.className, picked:{ mode: window.__picked?window.__picked.mode:null, id: window.__picked?window.__picked.potId:null, confirming: window.__picked?window.__picked.confirming:null }, drag:{ on: window.__drag?window.__drag.on:null, what: window.__drag?window.__drag.what:null },
    말풍선:marks, waterCrop:btn('waterCrop'), harvestCrop:btn('harvestCrop'), 줄단추:rows, 시루:pots.map(p=>({ id:p.id, 자리:p.slotId||(p.at?'free':null) })), 손:(document.getElementById('hint')||{}).className }; })()`);
await clearDlg();
/* 첫 플레이 손가락 그대로 두고 — 시루를 놓는다(가방 칸 → [확인]) */
/* 가방을 열고(폰은 [가방] 띠 · 넓은 판은 탭) 시루 칸 → [확인]. 사이사이 대사를 넘긴다 */
if (!(await tapEl('#openBag'))) await tapEl('#tabBag'); await sleep(600); await clearDlg();
await tapEl('#cropThumb'); await sleep(1000); await clearDlg();
await tapEl('#placeOk'); await sleep(1000); await clearDlg();
const before = await dump('옮기기 전');
console.log('■ 옮기기 전 —', JSON.stringify(before));
/* 방의 시루를 눌러 [옮기기] */
const siruId = before.시루[0] && before.시루[0].id;
const key = await J(`(()=>{ const S=window.__S(); const p=(S.firstPlay.beansprout.pots||[])[0]; return p ? (p.slotId || ('free:'+p.id)) : null; })()`);
const cr = await J(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect(); return {l:r.left,t:r.top,w:r.width,h:r.height}; })()`);
const sp = await J(`window.__rv.screenPosOf(${JSON.stringify(key)})`);
console.log('■ 시루 —', siruId, key, JSON.stringify(sp));
if (sp) {
  /* ⚠ 첫 플레이의 울타리가 시루 누름을 막는다(구멍은 말풍선). 박사님은 세 번 눌러 지나갔을 것 — 자는 «고르기»를 게임 함수로 한다(picked.select) */
  await page.eval(`(()=>{ try { window.__picked.select(${JSON.stringify(key)}); } catch(e) {} })()`, false); await sleep(600);
  const mv = await J(`(()=>{ const b=document.getElementById('pickMove'); if(!b) return null; const r=b.getBoundingClientRect(); return { 보임:r.width>0, x:r.left+r.width/2, y:r.top+r.height/2 }; })()`);
  console.log('■ 시루 누른 뒤 — picked', JSON.stringify(await J(`(()=>({ mode: window.__picked&&window.__picked.mode, id: window.__picked&&window.__picked.potId, 무대: document.getElementById('stage').className }))()`)), '· [옮기기]', JSON.stringify(mv));
  if (mv && mv.보임) {
    await page.eval(`document.getElementById('pickMove').click()`, false); await sleep(600);
    console.log('■ [옮기기] 뒤 —', JSON.stringify(await J(`(()=>({ mode: window.__picked&&window.__picked.mode, 무대: document.getElementById('stage').className, 아래글:(document.getElementById('dropLabel')||{}).textContent }))()`)));
    /* 딴 칸으로 끌어 놓는다 — 시루 자리에서 오른쪽 아래로 140px */
    const sp2 = await J(`window.__rv.screenPosOf(${JSON.stringify(key)})`);
    /* 갈 자리 = 시루가 올라가는(maxPotD ≥ 시루 지름) «빈» 자리 하나 — 허공에 놓으면 「가구·벽에 걸립니다」로 옮김 자체가 안 일어난다(첫 판 실측) */
    const dst = await J(`(()=>{ const rv=window.__rv; const d=(rv.plantPotD&&rv.plantPotD('beansprout'))||0.24;
      const s=(rv.slots()||[]).find(x=>!x.occupied && Number.isFinite(x.maxPotD) && x.maxPotD>=d && x.slotId!==${JSON.stringify(key)}); if(!s) return null;
      const p=rv.screenPosOf(s.slotId); return p ? { slotId:s.slotId, x:p.x, y:p.y } : null; })()`);
    console.log('■ 갈 자리 —', JSON.stringify(dst));
    if (dst) await dragTo(cr.l + sp2.x, cr.t + sp2.y, cr.l + dst.x, cr.t + dst.y);
    else await dragTo(cr.l + sp2.x, cr.t + sp2.y, cr.l + sp2.x + 140, cr.t + sp2.y + 40);
    console.log('■ 끌어 놓은 뒤 —', JSON.stringify(await J(`(()=>({ mode: window.__picked&&window.__picked.mode, 무대: document.getElementById('stage').className, 아래글:(document.getElementById('dropLabel')||{}).textContent, 확인바:(()=>{ const b=document.getElementById('placeOk'); const r=b?b.getBoundingClientRect():null; return !!(r&&r.width>0); })() }))()`)));
    const okd = await tapEl('#placeOk'); await sleep(900); await clearDlg();
    console.log('■ [확인] —', okd);
  }
}
/* ★ 왜 사라졌나 — 줄(cropPotList)·자리 열쇠·방의 그루 열쇠·화면 자리를 같이 찍는다 */
console.log('■ 옮긴 뒤 속 —', await page.eval(`(async()=>{ try { const fp=await import('/src/game/first_play.js'); const S=window.__S();
  const rows=(fp.cropPotList(S.firstPlay,S.day)||[]).map(r=>({ id:r.id, kind:r.kind, placed:!!r.placed, slotId:r.slotId||null, at:!!r.at, needsSow:!!r.needsSow, harvested:!!r.harvested, ready:!!r.ready }));
  const pots=(S.firstPlay.beansprout.pots||[]).map(p=>({ id:p.id, slotId:p.slotId||null, at:p.at?{x:+p.at.x.toFixed(2),z:+p.at.z.toFixed(2)}:null }));
  const plants=(window.__rv.plants()||[]).map(p=>({ key:p.key, potId:p.potId, kind:p.kind }));
  const keys=rows.map(r=>r.slotId||(r.at?('free:'+r.id):null)); const sp=keys.map(k=>k?window.__rv.screenPosOf(k):null);
  return JSON.stringify({ rows, pots, plants, keys, sp }); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 30000));
const after = await dump('옮기기 뒤');
console.log('■ 옮기기 뒤 —', JSON.stringify(after));
await sleep(1500);
const later = await dump('1.5초 뒤');
console.log('■ 1.5초 뒤 —', JSON.stringify(later));
/* 시트 밖(빈 데)을 한 번 눌러 고르기를 풀면? */
await tapAt(cr.l + cr.w * 0.5, cr.t + cr.h * 0.9); await sleep(800);
console.log('■ 빈 데 누른 뒤 —', JSON.stringify(await dump('빈 데')));
const ok = (ko, v, why) => console.log(`  ${v ? 'OK  ' : 'FAIL'} ${ko}  → ${why}`);
const liveMarks = d => (d.말풍선 || []).filter(x => x.보임).length;
ok('옮긴 뒤에도 말풍선이 있다', liveMarks(after) >= 1 || liveMarks(later) >= 1, `전 ${liveMarks(before)} · 직후 ${liveMarks(after)} · 1.5초 뒤 ${liveMarks(later)}`);
ok('옮긴 뒤 [식물] 줄 단추(심기)가 있다', (later.줄단추 || []).some(r => r.act === 'plant' || r.act === 'sow'), JSON.stringify(later.줄단추));
await page.shot(`docs/handoff/img/movemarks_${W}.png`).catch(() => {});
await page.close(); clearTimeout(wd);
