/* tools/probe_zoom.mjs — **확대 보기에 «들어가서» 재본다** (2026-09-06 아침 · 박사님 Day 36·37 폰 그림)
   ------------------------------------------------------------------
   ① 그루 메뉴에 「확대 보기」가 뜨나 ② 누르면 확대에 들어가나 ③ 확대 «화면 안»에 「시야 돌아가기」가 «보이나»(rect · 화면 안 · 위 띠에 안 가림)
   ④ 확대 중 손가락(#hint)이 «안 보이나» ⑤ 확대 중 [상점] 띠·탭을 누르면 «확대가 닫히고 시트가 열리나»(갇힘 풀기) ⑥ 「시야 돌아가기」를 누르면 돌아오나
   판: W×H(폰 390×844 / 1770×1188) · 진짜 마우스 · 첫 플레이 울타리는 끔(uiwire 와 같은 손). ⛔ 값 0. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
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
const clearDlg = async () => { for (let i = 0; i < 40; i++) { const t = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`); if (t !== 'true') return; await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(150); } };
const J = async (js) => JSON.parse(await page.eval(`(()=>{ try { return JSON.stringify((${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`));
const rectOf = (sel) => J(`(()=>{ const b=document.querySelector(${JSON.stringify(sel)}); if(!b) return null; const r=b.getBoundingClientRect(); const cs=getComputedStyle(b);
  const top=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return { 보임: r.width>0 && cs.display!=='none' && cs.visibility!=='hidden', 안:(r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth),
  x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2), w:Math.round(r.width), 글:(b.textContent||'').trim().slice(0,14), 위에:(top? (top===b||b.contains(top)) ? '자기' : (top.id||top.className||top.tagName).toString().slice(0,20) : null) }; })()`);
const ok = (ko, v, why) => console.log(`  ${v ? 'OK  ' : 'FAIL'} ${ko}  → ${why}`);
await clearDlg();
/* 첫날은 손가락을 따라 시루를 놓고 심고 물을 준다(probe_nudge 와 같은 손) — 그래야 [다음 날]이 열린다 */
const tapHint = async () => { const at = await J(`(()=>{ const t=document.querySelector('.hintTarget'); const d=document.getElementById('hintDim'); const hole=(d&&d.dataset.hole||'').split(',').map(Number);
    if (t) { const r=t.getBoundingClientRect(); if (r.width>0) return { x:r.left+r.width/2, y:r.top+r.height/2, 짚:t.id||t.className }; }
    if (hole.length===3 && hole.every(Number.isFinite)) return { x:hole[0], y:hole[1], 짚:'(점)' }; return null; })()`);
  if (!at) return null; await tapAt(at.x, at.y); await clearDlg(); return at.짚; };
for (let i = 0; i < 12; i++) { const st = await J(`(()=>{ const S=window.__S(); const p=(S.firstPlay.beansprout.pots||[])[0]; return { 자람: !!(p && p.startedOnDay != null) }; })()`); if (st.자람) break; const who = await tapHint(); if (!who) break; }
/* 몬스테라는 «도착»해야 있다(세 바퀴 뒤 · loop.js §markMonsteraArrived) — 세운 판: 거둔 횟수를 도착 문턱(MONSTERA_ARRIVAL_RULE.harvestCount)으로 세우고 하루를 넘긴다 */
/* 도착을 코어 함수로 «그대로» 세운다(loop.js §markMonsteraArrived 가 하는 두 줄): state.givePlant → first_play.markMonsteraArrived */
console.log('■ 도착 세움 —', await page.eval(`(async()=>{ try { const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js'); const S=window.__S();
  const arrived = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, arrived); try { window.__redraw(); } catch(e){} return JSON.stringify({ ok:true, pot:(S.pots||[]).length }); } catch(e) { return JSON.stringify({ 탈:e.message }); } })()`, true, 30000));
await sleep(800); await clearDlg();
await page.eval(`(()=>{ try { const S=window.__S(); if (S.firstPlay) S.firstPlay.enabled=false; window.__byeotHint&&window.__byeotHint(); window.__redraw(); } catch(e){} })()`, false); await sleep(500);
console.log('■ 도착 —', await J(`(()=>{ const S=window.__S(); return { day:S.day, arrived: !!(S.firstPlay.monstera&&S.firstPlay.monstera.arrived), pots:(S.pots||[]).length }; })()`));
/* 몬스테라 그루를 가방에서 놓는다(가방 칸 [data-potbag] 누름 → [확인]) */
await page.eval(`(()=>{ const t=document.getElementById('openBag')||document.getElementById('tabBag'); if(t) t.click(); })()`, false); await sleep(600);
const cell = await rectOf('#bagGrid [data-potbag]');
console.log('■ 가방 그루 칸 —', JSON.stringify(cell));
if (cell && cell.보임) { await tapAt(cell.x, cell.y); await sleep(900); const okb = await rectOf('#placeOk'); if (okb && okb.보임) await tapAt(okb.x, okb.y); await sleep(900); await clearDlg(); }
const key = await J(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0]; return p ? (p.slotId || (p.at ? 'free:'+p.id : null)) : null; })()`);
console.log('■ 그루 열쇠 —', key);
/* 메뉴 열기 — 게임 함수로 고른다(울타리 없음) */
await page.eval(`(()=>{ try { window.__picked.select(${JSON.stringify(key)}); } catch(e) {} })()`, false); await sleep(600);
const z0 = await rectOf('#pickZoom');
ok('① 그루 메뉴에 「확대 보기」', z0 && z0.보임 && z0.글 === '확대 보기', JSON.stringify(z0));
if (z0 && z0.보임) await tapAt(z0.x, z0.y); await sleep(1500);
const inZoom = await J(`document.getElementById('stage').classList.contains('zoom')`);
ok('② 누르면 확대에 들어간다(stage.zoom)', inZoom === true, String(inZoom));
const cz = await rectOf('#closeZoom');
ok('③ 확대 화면에 「시야 돌아가기」가 «보인다»(화면 안 · 안 가림)', cz && cz.보임 && cz.안 && cz.위에 === '자기' && /시야 돌아가기/.test(cz.글), JSON.stringify(cz));
const hint = await J(`(()=>{ const h=document.getElementById('hint'); const cs=h?getComputedStyle(h):null; return { on:!!(h&&h.classList.contains('on')), display: cs?cs.display:null }; })()`);
ok('④ 확대 중 손가락이 «안 보인다»', !hint.on || hint.display === 'none', JSON.stringify(hint));
await page.shot(`docs/handoff/img/zoom_${W}.png`).catch(() => {});
/* ⑤ 확대 중 [상점] 띠·탭 누름 → 확대 닫히고 시트 열림 */
const nav = (await rectOf('#navShop')) || null; const tab = (await rectOf('#tabShop')) || null;
const door = (nav && nav.보임) ? nav : ((tab && tab.보임) ? tab : null);
console.log('■ 상점 문 —', JSON.stringify(door));
if (door) { await tapAt(door.x, door.y); await sleep(900); }
const after = await J(`(()=>({ zoom: document.getElementById('stage').classList.contains('zoom'), sheet: document.getElementById('sheet').classList.contains('open'), tab: (document.querySelector('#sheet [role=tab][aria-selected=true]')||{}).id||null }))()`);
ok('⑤ 확대 중 [상점]을 누르면 확대가 «닫히고» 시트가 «열린다»', after && !after.zoom && (after.sheet || W >= 1000) && after.tab === 'tabShop', JSON.stringify(after));   /* 넓은 판은 시트가 «늘 펴져» open 표가 없다 — 탭이 바뀌면 열린 것 */
/* ⑥ 다시 확대 → 「시야 돌아가기」 누르면 돌아온다 */
await page.eval(`(()=>{ try { window.__byeotSheet.close(); window.__picked.select(${JSON.stringify(key)}); } catch(e) {} })()`, false); await sleep(600);
const z1 = await rectOf('#pickZoom'); if (z1 && z1.보임) await tapAt(z1.x, z1.y); await sleep(1500);
const cz2 = await rectOf('#closeZoom'); if (cz2 && cz2.보임) await tapAt(cz2.x, cz2.y); await sleep(900);
const back = await J(`document.getElementById('stage').classList.contains('zoom')`);
ok('⑥ 「시야 돌아가기」를 누르면 돌아온다', back === false, String(back));
await page.close(); clearTimeout(wd);
