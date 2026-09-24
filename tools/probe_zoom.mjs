/* tools/probe_zoom.mjs — **확대 보기에 «들어가서» 재본다** (2026-09-06 아침 · 박사님 Day 36·37 폰 그림)
   ------------------------------------------------------------------
   ① 그루 메뉴에 「확대 보기」가 뜨나 ② 누르면 확대에 들어가나 ③ 확대 «화면 안»에 「시야 돌아가기」가 «보이나»(rect · 화면 안 · 위 띠에 안 가림)
   ④ 확대 중 손가락(#hint)이 «안 보이나» ⑤ 확대 중 [상점] 띠·탭을 누르면 «확대가 닫히고 시트가 열리나»(갇힘 풀기) ⑥ 「시야 돌아가기」를 누르면 돌아오나
   판: W×H(폰 390×844 / 1770×1188) · 진짜 마우스 · 첫 플레이 울타리는 끔(uiwire 와 같은 손). ⛔ 값 0.
   ★ 2026-09-25 고침(보이는 층 v2 뒤 ②③⑤ 빨강 — docs/handoff/core-probe-zoom-v2-20260925.md):
     · 누르기 전에 «대화를 닫고 카메라가 멎기를» 기다린다. v2 카메라 연출이 대사 뒤 제자리로 돌아가는 동안 메뉴·[확인]이 그루를 따라 흘러 바닥이 눌렸다
     · 도착을 정말 세운다 — 전에는 거둔 횟수를 안 세워 매 판 「콩나물을 수확하기 전에는…」 탈이 났고 arrived:false 판에서 쟀다
     · Q='?v2=0' 처럼 주소 뒤 물음표 줄을 받는다(판 견주기) */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
/* Q — 주소 뒤에 붙일 물음표 줄(예: Q='?v2=0' · '?v2cam=0'). 판을 견줄 때 쓴다. 비우면 기본 판 */
const Q = process.env.Q || '';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html${Q}`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html${Q}`);
console.log(`■ 판 — ${W}×${H} · 주소 game.html${Q || '(기본)'}`);
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
  S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
  const arrived = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, arrived); try { window.__redraw(); } catch(e){} return JSON.stringify({ ok:true, pot:(S.pots||[]).length }); } catch(e) { return JSON.stringify({ 탈:e.message }); } })()`, true, 30000));
await sleep(800); await clearDlg();
await page.eval(`(()=>{ try { const S=window.__S(); if (S.firstPlay) S.firstPlay.enabled=false; window.__byeotHint&&window.__byeotHint(); window.__redraw(); } catch(e){} })()`, false); await sleep(500);
console.log('■ 도착 —', await J(`(()=>{ const S=window.__S(); return { day:S.day, arrived: !!(S.firstPlay.monstera&&S.firstPlay.monstera.arrived), pots:(S.pots||[]).length }; })()`));
/* 몬스테라 그루를 가방에서 놓는다(가방 칸 [data-potbag] 누름 → [확인]) */
await page.eval(`(()=>{ const t=document.getElementById('openBag')||document.getElementById('tabBag'); if(t) t.click(); })()`, false); await sleep(600);
const cell = await rectOf('#bagGrid [data-potbag]');
console.log('■ 가방 그루 칸 —', JSON.stringify(cell));
/* ★ 2026-09-25 — [확인]이 «뜰 때까지» 기다린다(고정 0.9초였다 → 기계가 바쁘면 못 보고 지나쳐 «놓는 중»인 채로 남았다: placeConfirm 이 메뉴를 덮어 ②~⑤ 빨강) */
/*   뜬 뒤에도 [확인]은 화분을 따라 흐른다(placeFloatMenu · 프레임마다) — «두 번 잰 자리가 같을 때» 누른다. 누른 뒤 놓는 중이 남으면 다시(최대 3번). 흐름·다시 누름은 ■ 줄로 찍는다 */
/* 카메라가 멎을 때까지(최대 4초) — 기다린 ms 를 돌려준다 */
const camStill = async () => { let w = 0;
  for (; w < 4000; w += 100) { const b = await J(`(()=>{ try { const b=window.__rv.camBusy ? window.__rv.camBusy() : null; return !!(b && b.tween); } catch(e) { return false; } })()`); if (!b) break; await sleep(100); }
  if (w) await sleep(250); return w; };
const placing = () => J(`(()=>{ const e=document.getElementById('placeConfirm'); if(!e) return false; const r=e.getBoundingClientRect(); return r.width>0 && getComputedStyle(e).display!=='none'; })()`);
if (cell && cell.보임) { await tapAt(cell.x, cell.y); const tries = [];
  for (let t = 0; t < 3; t++) {
    await clearDlg(); const camW = await camStill();   /* 대화 중 누름은 대화가 먹는다 · 대화가 닫히면 v2 카메라가 돌아가며 [확인]이 흐른다 */
    let okb = null, first = null, prev = null;
    for (let i = 0; i < 60; i++) { okb = await rectOf('#placeOk'); if (okb && okb.보임) { first = first || okb; if (prev && prev.x === okb.x && prev.y === okb.y) break; prev = okb; } await sleep(150); }
    if (!(okb && okb.보임)) { tries.push('안 뜸'); break; }
    const talkAt = await J(`document.getElementById('stage').classList.contains('talking')`);
    await tapAt(okb.x, okb.y); const talkAfter = await J(`document.getElementById('stage').classList.contains('talking')`); await sleep(900); await clearDlg();
    const still = await placing();
    tries.push(`${first.x},${first.y}→${okb.x},${okb.y} 누름(위에 ${okb.위에} · 대화 ${talkAt}→${talkAfter} · 카메라 ${camW}ms 기다림) · 남음 ${still}`);
    if (!still) break;
  }
  console.log('■ 놓기 [확인] —', JSON.stringify(tries)); }
const key = await J(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0]; return p ? (p.slotId || (p.at ? 'free:'+p.id : null)) : null; })()`);
console.log('■ 그루 열쇠 —', key);
/* 메뉴 열기 — 게임 함수로 고른다(울타리 없음) */
await page.eval(`(()=>{ try { window.__picked.select(${JSON.stringify(key)}); } catch(e) {} })()`, false); await sleep(600);
/* ★ 2026-09-25 — 카메라가 «멎은 뒤» 누른다. v2 카메라 연출은 대사가 닫히면 0.14초 뒤 0.72초 동안 제자리로 돌아간다(camera_moves CAM_MOVES.talk.outMs).
   그 사이 메뉴는 그루를 따라 흐르고(plantMenuFollow · 프레임마다), 흐르는 단추를 누르면 바닥이 눌려 «옮기기»가 시작된다 ⇒ ②③ 빨강 · ⑤ 까지 번진다(가방 탭에 갇힘).
   ②가 묻는 것은 「단추가 듣나」다 — 흐름은 따로 ■ 줄로 찍는다(사람 눈에도 1초 안쪽으로 보인다) */
const waitedCam = await camStill();
console.log('■ 카메라 멎기를 기다림 —', waitedCam ? `${waitedCam}ms(연출이 돌아가던 중)` : '0ms(이미 멎음)');
const z0 = await rectOf('#pickZoom');
/* ■ 누르기 «직전»에 메뉴가 움직이나 — 카메라 트윈(v2 camMoves 가 대화 뒤 돌아가는 것 등)이 돌면 메뉴가 그루를 따라 흐른다 */
const camNow = () => J(`(()=>{ try { const b=window.__rv.camBusy ? window.__rv.camBusy() : null; const m=(window.__v2&&window.__v2.cam&&window.__v2.cam.stats) ? window.__v2.cam.stats() : null;
  return { 지금: Math.round(performance.now()), tween: b ? b.tween : '창구 없음', down: b ? b.down : null, 연출: m ? { on:m.on, 말중:m.talking, 쥠:m.own, 들:m.talkIn, 남:m.talkOut, 잃:m.lost, 밈:m.actPush, 끝:m.last.slice(-4) } : null }; } catch(e) { return '탈'; } })()`);
const cam0 = await camNow(); await sleep(300); const z0b = await rectOf('#pickZoom');
console.log('■ 누르기 직전 — 카메라', JSON.stringify(cam0), '· 메뉴 300ms 사이 흐름', z0 && z0b ? `${z0b.x - z0.x},${z0b.y - z0.y}px` : '(없음)');
ok('① 그루 메뉴에 「확대 보기」', z0 && z0.보임 && z0.글 === '확대 보기', JSON.stringify(z0));
if (z0 && z0.보임) await tapAt(z0.x, z0.y); await sleep(1500);
const inZoom = await J(`document.getElementById('stage').classList.contains('zoom')`);
if (!inZoom && z0) console.log('■ ② 빗나감 — 누른 자리', `${z0.x},${z0.y}`, '에 지금 있는 것', JSON.stringify(await J(`(()=>{ const e=document.elementFromPoint(${z0.x},${z0.y}); return e ? (e.id||e.className||e.tagName).toString().slice(0,30) : null; })()`)), '· 메뉴 지금', JSON.stringify(await rectOf('#pickZoom')));
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
