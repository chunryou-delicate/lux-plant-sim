/* B-5 를 **게임 길로** 잰다 — 「가구를 옮기면 위에 얹힌 것이 같이 가나」.
   ★ 방뷰만 보면 안 된다. 3D 는 따라가는데 **세이브가 안 따라가면** 새로고침에 되돌아간다.
     그래서 ① 옮긴 직후 3D ② 그때의 S.pots.at ③ 다시 그린 뒤 3D — 셋을 다 찍는다. */
import { launch, sleep } from './test_cdp.mjs';
const _wd = setTimeout(() => { console.error('⏱'); process.exit(2); }, 420000); _wd.unref && _wd.unref();
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);
await page.eval(`(()=>{ for(let i=0;i<40;i++){ try{ document.getElementById('dlgSkip').click() }catch{} } })()`, false);
await sleep(1500);

/* ① 책상 윗면 **자유 좌표 칸**에 빈 화분을 놓는다 — 게임이 실제로 쓰는 길(placeEmptyPot) */
const put = await page.eval(`(()=>{ const rv=window.__rv, S=window.__S();
  rv.showSlotRings(true, { potD: 0.20 });
  const cells = rv.guideCells({ potD: 0.20 }).filter(c=>c.uid==='banjiha-desk' && c.fits);
  const c = cells[0];
  let err=null;
  try { window.__byeotPlaceAt = c; } catch(e){}
  /* 게임의 배치 창구를 그대로 부른다 */
  try { window.__byeotTestPlace = true; } catch(e){}
  return JSON.stringify({ cell: c, pots: (S.pots||[]).length }); })()`);
console.log('① 놓을 칸 ' + put);

/* 게임 함수가 전역이 아니면 방뷰 + 상태를 직접 쓴다 — 상태 쪽 계약을 그대로 태운다 */
const before = await page.eval(`(async()=>{ const rv=window.__rv, S=window.__S();
  const c = window.__byeotPlaceAt;
  /* S.pots 에 자유 좌표 화분을 하나 만든다(게임이 놓는 모양 그대로) */
  const at = { x:c.x, y:c.y, z:c.z, rotY:0, onUid:'banjiha-desk', occIdx:null };
  S.pots.push({ id:'probe1', slotId:'free:probe1', at, kind:'monstera', days:60, sownDay:0 });
  await rv.setPlantAt('probe1', at, { kind:'monstera', days:60 });
  return JSON.stringify({ statePots: S.pots.map(p=>({id:p.id, slotId:p.slotId, at:p.at})),
                          view: rv.plants().map(p=>({key:p.key, pos:p.pos})),
                          desk: rv.furniture().find(f=>f.uid==='banjiha-desk') }); })()`);
console.log('② 옮기기 전 ' + before);

const after = await page.eval(`(async()=>{ const rv=window.__rv, S=window.__S();
  const f = rv.furniture().find(x=>x.uid==='banjiha-desk');
  let err=null, r=null;
  try { r = await rv.commitFurnitureAt('banjiha-desk', { x:f.x-0.5, z:f.z, rot:f.rot, step: rv.moveStep() }); }
  catch(e){ err = e.message; }
  return JSON.stringify({ r, err,
    statePots: S.pots.map(p=>({id:p.id, slotId:p.slotId, at:p.at})),
    view: rv.plants().map(p=>({key:p.key, pos:p.pos})),
    desk: rv.furniture().find(x=>x.uid==='banjiha-desk') }); })()`);
console.log('③ 옮긴 직후 ' + after);

/* ④ 방을 **상태에서 다시 그린다** — 세이브가 안 따라갔으면 여기서 되돌아간다 */
const redraw = await page.eval(`(async()=>{ const rv=window.__rv, S=window.__S();
  /* 상태의 at 으로 다시 세운다(새로고침이 하는 일과 같다) */
  for (const p of S.pots) { try { await rv.setPlantAt(p.id, p.at, { kind:p.kind, days:p.days }); } catch(e){} }
  return JSON.stringify({ view: rv.plants().map(p=>({key:p.key, pos:p.pos})) }); })()`);
console.log('④ 상태로 다시 그린 뒤 ' + redraw);
await page.close();
