/* tools/probe_zoom.mjs — **확대 보기에 «들어가서» 재본다** (2026-09-06 아침 · 박사님 Day 36·37 폰 그림)
   ------------------------------------------------------------------
   ① 그루 메뉴에 「확대 보기」가 뜨나 ② 누르면 확대에 들어가나 ③ 확대 «화면 안»에 「시야 돌아가기」가 «보이나»(rect · 화면 안 · 위 띠에 안 가림)
   ④ 확대 중 손가락(#hint)이 «안 보이나» ⑤ 확대 중 [상점] 띠·탭을 누르면 «확대가 닫히고 시트가 열리나»(갇힘 풀기) ⑥ 「시야 돌아가기」를 누르면 돌아오나
   ⑦ 대사가 닫힌 뒤 복귀 도중에 그루를 고르면 카메라 복귀를 끊고(talk-out-cut) 메뉴가 곧 멎나
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
/* ★ 09-25 — 폰에서 그루 칸이 가방 시트 «아래로 넘쳐»(y 1035 > 844 · 안 false) 못 누르고 지나간 판이 있었다(그 판은 ①②③ 빨강·열쇠 null) — 먼저 보이게 굴린다 */
await page.eval(`(()=>{ const c=document.querySelector('#bagGrid [data-potbag]'); if (c) c.scrollIntoView({ block:'center' }); })()`, false); await sleep(300);
const cell = await rectOf('#bagGrid [data-potbag]');
console.log('■ 가방 그루 칸 —', JSON.stringify(cell));
/* ★ 2026-09-25 — [확인]이 «뜰 때까지» 기다린다(고정 0.9초였다 → 기계가 바쁘면 못 보고 지나쳐 «놓는 중»인 채로 남았다: placeConfirm 이 메뉴를 덮어 ②~⑤ 빨강) */
/*   뜬 뒤에도 [확인]은 화분을 따라 흐른다(placeFloatMenu · 프레임마다) — «두 번 잰 자리가 같을 때» 누른다. 누른 뒤 놓는 중이 남으면 다시(최대 3번). 흐름·다시 누름은 ■ 줄로 찍는다 */
/* 카메라가 멎을 때까지(최대 4초) — 기다린 ms 를 돌려준다 */
const camStill = async () => { let w = 0;
  for (; w < 4000; w += 100) { const b = await J(`(()=>{ try { const b=window.__rv.camBusy ? window.__rv.camBusy() : null; return !!(b && b.tween); } catch(e) { return false; } })()`); if (!b) break; await sleep(100); }
  if (w) await sleep(250); return w; };
const placing = () => J(`(()=>{ const e=document.getElementById('placeConfirm'); if(!e) return false; const r=e.getBoundingClientRect(); return r.width>0 && getComputedStyle(e).display!=='none'; })()`);
if (cell && cell.보임 && cell.안) { await tapAt(cell.x, cell.y); const tries = [];
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
/* ⑦ 끊기 갈래(2026-09-25 · 총괄 camera_moves cutOut) — 대사가 닫힌 «뒤» 복귀 트윈이 도는 사이에 그루를 고르면
   복귀를 그 자리에서 끊는다(talk-out-cut). 끊지 않으면 메뉴가 남은 복귀(420ms) 동안 흐른다.
   조건: 메뉴를 닫아 둔 채 모니 대사 한 줄(nudgeBackLamp)을 열고 → 닫고 → CUT_MS(기본 130 · 복귀가 막 시작된 때) 뒤 __picked.select(key)
   ★ 무엇을 재나 — «메뉴가 몇 px 흐르나»가 아니다. 끊어도 메뉴는 남은 거리만큼 간다(camTo 최소 120ms). 끊기가 바꾸는 것은 «얼마나 오래 흐르나»다.
     그래서 고른 뒤 프레임마다 메뉴 자리를 찍어 «마지막으로 움직인 때»(멎는 데 걸린 ms)를 잰다. 통과: talk-out-cut 기록 · 멎음 ≤ 220ms(120 + 프레임 틈)
     대조(끊기 없는 옛 camera_moves): 남은 복귀 ≈ 350ms 이상 흐른다 — 이것이 빨강으로 나와야 이 갈래가 쓸모 있다
   ⚠ 판이 «흐름을 만들 수 있어야» 잰다. 기본 시점은 이미 가장 가까운 줌이라 10% 다가가기가 막혀 대사 자리 = 제자리였다.
     그래서 먼저 30% 물러난 시점(사람이 휠로 물러난 것과 같다)에서 대사를 연다.
   SKIP(초록 아님): 쪽 rAF 가 500ms 에 10번 밑(데스크톱 1770 은 헤드리스 소프트 렌더라 조용한 기계에서도 1~2번 — 폰 크기로 잰다)
                    · 고른 때가 복귀 창 밖 · 대사 자리와 제자리의 그루 화면 거리 < 20px */
const CUT_MS = Number(process.env.CUT_MS || 130);
await page.eval(`(()=>{ try { window.__picked.clear(); window.__byeotSheet.close(); } catch(e) {} })()`, false); await sleep(400);
const backOff = await J(`(()=>{ try { const c=window.__rv.camera(); const g=window.__rv.camTo({ dist: c.dist * 1.3 }, 120); return { 전: +c.dist.toFixed(2), 후: +g.dist.toFixed(2) }; } catch(e) { return { 탈:e.message }; } })()`);
await sleep(300); await camStill();
const dlgOn = await J(`(()=>{ const r=window.__dlgOpen('nudgeBackLamp'); return { 열기: String(r), 말중: document.getElementById('stage').classList.contains('talking') }; })()`);
/* talk-in 이 «다 다가갈 때까지» 기다린다(최대 6초) — 고정 1.5초로는 바쁜 기계에서 트윈이 한 걸음도 안 가 «대사 자리 = 제자리»가 됐다 */
let talkWait = 0;
for (; talkWait < 6000; talkWait += 150) { const r = await J(`(()=>{ try { const m=window.__v2&&window.__v2.cam&&window.__v2.cam.stats(); const b=window.__rv.camBusy(); return { on: !!(m&&m.on), in: !!(m&&m.own==='talk'), tw: !!b.tween }; } catch(e) { return { on:false }; } })()`);
  if (!r.on) break; if (r.in && !r.tw) break; await sleep(150); }
await sleep(talkWait < 6000 ? 200 : 0);
/* 그림이 돌아야 잰다 — 쪽 rAF 가 500ms 에 10번 안쪽이면(=20fps 밑) 흐름이 «안 생긴 것»과 «못 본 것»을 가를 수 없다 */
const frames = Number(await page.eval(`(async()=>{ let n=0; const t0=performance.now(); await new Promise(r=>{ const f=()=>{ n++; if (performance.now()-t0<500) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return String(n); })()`, true, 30000));
const cut = JSON.parse(await page.eval(`(async()=>{ try {
  const st=document.getElementById('stage'); const sl=ms=>new Promise(r=>setTimeout(r,ms));
  const cam=()=>(window.__v2&&window.__v2.cam&&window.__v2.cam.stats) ? window.__v2.cam.stats() : null;
  const plant=()=>{ try { const p=window.__rv.screenPosOf(${JSON.stringify(key)}); return p ? { x:Math.round(p.x), y:Math.round(p.y) } : null; } catch(e) { return null; } };
  const pose=()=>{ try { const c=window.__rv.camera(); return { az:+c.az.toFixed(3), el:+c.el.toFixed(3), d:+c.dist.toFixed(2), tx:+c.target.x.toFixed(2), tz:+c.target.z.toFixed(2) }; } catch(e) { return null; } };
  const cTalk=pose(), pTalk=plant();   /* 대사 자리 — 복귀가 만들 수 있는 흐름의 한쪽 끝 */
  for (let i=0; i<30 && st.classList.contains('talking'); i++) { const b=document.getElementById('dlgBox'); if (b) b.click(); for (let k=0; k<20 && st.classList.contains('talking'); k++) await sl(20); }
  if (st.classList.contains('talking')) return JSON.stringify({ 탈:'대화가 안 닫힘' });
  const t0=performance.now();
  await sl(${CUT_MS});
  const tw = (()=>{ try { return !!window.__rv.camBusy().tween; } catch(e) { return null; } })();
  window.__picked.select(${JSON.stringify(key)});
  const t1=performance.now();
  await new Promise(r=>setTimeout(r,0));   /* 카메라 연출은 stage class 를 MutationObserver 로 본다 — 한 번 넘겨 준 뒤 읽는다 */
  const bz = (()=>{ try { const b=window.__rv.camBusy(); return { tween:b.tween, ms:b.tweenMs ?? '창구 없음', 남음:b.tweenLeftMs ?? null }; } catch(e) { return null; } })();
  const rect=()=>{ const b=document.getElementById('pickZoom'); if(!b) return null; const r=b.getBoundingClientRect(); return r.width>0 ? { x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2) } : null; };
  const trace=[]; await new Promise(res=>{ const f=()=>{ const t=performance.now()-t1; trace.push({ t:Math.round(t), m:rect(), p:plant() }); if (t<900) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  await sl(300); const pEnd=plant(), cEnd=pose();
  let settle=0, travel=0; for (let i=1;i<trace.length;i++) { const a=trace[i-1].m, b=trace[i].m; if (a && b && (Math.abs(a.x-b.x)+Math.abs(a.y-b.y))>=1) settle=trace[i].t; }
  { const a=trace[0]&&trace[0].m, b=trace[trace.length-1]&&trace[trace.length-1].m; travel = (a&&b) ? Math.abs(a.x-b.x)+Math.abs(a.y-b.y) : null; }
  const m=cam();
  return JSON.stringify({ 닫고고름ms: Math.round(t1-t0), 고를때트윈: tw, 연출: m ? m.on : null, picked: st.classList.contains('picked'),
    기록: m ? m.last.filter(x => +x.split(' ')[0] >= t0 - 5).map(x => '+' + Math.round(+x.split(' ')[0] - t0) + 'ms ' + x.split(' ').slice(1).join(' ')) : null,
    고른뒤트윈: bz, 멎음ms: settle, 흐른px: travel, 프레임수: trace.length, 그루: { 대사중: pTalk, 끝: pEnd }, 카메라: { 대사중: cTalk, 끝: cEnd } });
} catch(e) { return JSON.stringify({ 탈:e.message }); } })()`, true, 60000));
console.log('■ ⑦ 끊기 갈래 — 물러남', JSON.stringify(backOff), '· 다가가기 기다림', `${talkWait}ms`, '· 쪽 rAF/500ms', frames, '· 대사 열기', JSON.stringify(dlgOn), '· 잰 것', JSON.stringify(cut));
const dist2 = (a, b) => (a && b) ? Math.abs(a.x - b.x) + Math.abs(a.y - b.y) : null;
const room = cut && cut.그루 ? dist2(cut.그루.대사중, cut.그루.끝) : null;   /* 가능 흐름 — 대사 자리와 제자리의 거리 */
const didCut = !!(cut && (cut.기록 || []).some(x => /talk-out-cut/.test(x)));
const snap = !!(cut && (cut.기록 || []).some(x => /talk-out-snap/.test(x)));
const why = `멎음 ${cut && cut.멎음ms}ms · 흐른 ${cut && cut.흐른px}px · 가능 흐름 ${room}px · 끊음 ${didCut}${snap ? ' (snap 길)' : ''} · 닫고 ${cut && cut.닫고고름ms}ms 뒤 고름 · 그때 트윈 ${cut && cut.고를때트윈} · 쪽 rAF ${frames}/500ms`;
if (cut && cut.연출 === false) ok('⑦ (연출 꺼짐) 대사 뒤 곧바로 고른 메뉴가 «안 흐른다»', !!cut.picked && cut.흐른px === 0, why);
else if (!(cut && cut.닫고고름ms <= 480)) console.log(`  SKIP ⑦ 고른 때가 복귀 창(대사 닫힘 뒤 60~480ms) 밖이다 — 기계가 바빠 늦었다  → ${why}`);
else if (snap && !didCut) console.log(`  SKIP ⑦ 복귀가 시작되기 «전»에 골랐다(talk-out-snap 길) — 끊기 갈래가 아니다  → ${why}`);
else if (!(cut && cut.고를때트윈)) console.log(`  SKIP ⑦ 고를 때 복귀 트윈이 돌고 있지 않았다 — 끊을 것이 없다  → ${why}`);
else {
  /* ★ 판정은 «고른 직후 카메라 트윈이 몇 ms 짜리인가»로 한다 — 끊었으면 새 짧은 트윈(camTo 최소 120ms), 안 끊었으면 원래 복귀(420ms)가 이어진다.
       이 값은 프레임과 무관하다(트윈의 t0·ms 는 camTo 때 정해진다). 멎는 데 걸린 ms 는 그림이 넉넉히 돌 때만 덧붙여 본다 */
  const bz = cut && cut.고른뒤트윈;
  const shortTween = !!(bz && typeof bz.ms === 'number' && bz.ms <= 150);
  const settleOk = !(frames >= 10 && room >= 20) || (cut.멎음ms <= 220);
  const why2 = `${why} · 고른 직후 트윈 ${bz ? `${bz.ms}ms(남음 ${bz.남음}ms)` : '?'}${frames >= 10 && room >= 20 ? '' : ' · 멎음은 참고만(그림 드묾/흐름 작음)'}`;
  ok('⑦ 복귀 도중 고르면 «끊고»(talk-out-cut) 짧은 트윈으로 곧 멎는다', !!(cut && cut.picked) && didCut && shortTween && settleOk, why2);
}
await page.close(); clearTimeout(wd);
