/* 비판 6판 가름 C 묶음 ㉠(core 11-02 · 총괄 C1 · C2 · C3①② · C5 · C6 · C7 · C10) — 390×844
   판 셋(비판 6판 크롬 프로필 localStorage 를 새 이름 복사본에서 읽어 낸 세이브 — C:/Users/pc/byeot-core-keep/critic6/ · 프로필은 안 건드림):
     A100  = 비판 A Day 100(반지하 · 안 팖 · 체력 0 · 등 1)              SAVE_A
     A100L = A100 에서 «등을 아직 안 단» 판으로 고친 것(lamp.placed 0 · buy_lamp 안 끝남 — Day 50 꼴 · 세이브 손질은 이것 하나) — 같은 파일에서 만든다
     S97   = 비판 S Day 97(원룸 · 통째 판 · 화분 1)                       SAVE_S
   ㉮ C1  새 판 Day 0(덮개 · 울타리 켬): 바닥 단추(#resow · #harvestCrop)를 사람 손으로 한 번 누르면 단추가 받는다(울타리가 안 먹는다) — 작업 전 빨강
         ⚠ 단추를 «보이게» 하는 것만 손질(첫날엔 바닥 단추가 안 선다) · 단추가 받았나는 단추에 단 잡기 귀(누름 셈)로 잰다 — 단추 본디 일은 안 돈다
   ㉯ C7  A100: 체력 0 바닥 단추 «오늘 손이 다 떨어졌습니다»가 하나 · 회색 판 / «씨앗을 사러 갑니다» 손가락은 내일 몫(§seedTomorrowOf)이 차면 안 짚는다
   ㉰ C10 A100: [몬스테라 내놓기] → 경고 창(원천 0)에서 «아직»이 호박 판 · [그래도 내놓는다]가 회색 판 · .go 표는 그대로
   ㉱ C2  A100: 내놓기 → 연락(contactOnDay 손질 · probe_d100b 와 같은 손) → 거래 → 그 자리에서 몬이 «이사비도 모였어 … 이사는 [방]에서 해»(P3 afterSale) ·
         칩 «[방]에서 원룸으로 이사할 수 있습니다» · 할 일 판 머리 «이사는 [방] › [원룸으로 이사]에서 합니다»([plan] 507ba40d §3) ·
         손가락대로 돌봄을 하고 나면 손가락 [방] «이사는 여기서 합니다» → [방]을 누르면 [원룸으로 이사] «누르면 이사를 한 번 더 묻습니다»
   ㉲ C5 · C6  A100L: [식물] › [🔆 빛 분포 보기] → 가방 등 칸 → [확인] → 범례 «등 1개» · 할 일 칩이 «식물등을 달아…»가 아님(그 자리에서)
         → 방 위 [🔆 빛 분포 끄기] → 같은 자리에 [🔆 빛 분포 보기] → 누르면 다시 켜짐
   ㉳ C3①②③ S97: [식물] › [📍 자리] 목록 줄마다 밝기 낱말(빛 분포 낱말 · 같은 함수) · 시루 · 재배판이 앉은 칸은 목록에 없다 · 손가락은 [그만두기]를 안 짚는다 ·
         가장 어두운 줄로 옮기면 할 일 칩이 ㉮ «화분을 밝은 자리로 옮기세요»(손가락 [식물] › [📍 자리] › 가장 밝은 줄 · 옮기면 걷힘) 또는
         ㉯ «{무순 판|시루} 하나를 옮겨 밝은 칸을 비우세요»(경고 goBestTaken «제일 밝은 …에는 …이 있습니다»)
   예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9452', OUT = process.env.OUT || null;
const SAVE_A = process.env.SAVE_A || 'C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json';
const SAVE_S = process.env.SAVE_S || 'C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
let page = null, J = null;
const boot = async (saveText) => {
  if (page) { try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); } }
  page = await launch({ width: 390, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); ${saveText != null ? `localStorage.setItem('byeot/save/1', ${JSON.stringify(saveText)}); localStorage.setItem('byeot.guideSeen','1');` : ''} return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
};
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (!t || t.탈) return; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(280); } };
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(60); await m('mouseReleased', x, y, 0); };
const tapSel = async (sel) => {
  const measureAt = () => J(`(()=>{ const b=document.querySelector(${JSON.stringify(sel)}); if (!b) return null; b.scrollIntoView({ block: 'center' }); const q=b.getBoundingClientRect(); const x=q.left+q.width/2, y=q.top+q.height/2; const top=document.elementFromPoint(x,y); return { x, y, hit: !!(top && (top===b || b.contains(top))), t: (b.textContent||'').replace(/\\s+/g,' ').slice(0,60) }; })()`);
  let r = null;
  for (let k = 0; k < 15; k++) { const a = await measureAt(); await sleep(300); const b = await measureAt();
    r = b; if (!a || !b || b.탈) continue; if (b.hit && b.y > 10 && b.y < 834 && Math.abs(a.y - b.y) < 2) break; }
  if (r && r.hit) await tapAt(r.x, r.y);
  return r;
};
const camStill = async () => { let n = 0; for (let i = 0; i < 60 && n < 2; i++) { const b = await J(`(()=>{ try { return !!window.__rv.camBusy(); } catch (e) { return false; } })()`); n = b === false ? n + 1 : 0; await sleep(200); } };
const hintNow = () => J(`(()=>{ const h=document.getElementById('hint'); const on=!!(h && h.classList.contains('on')); const t=document.querySelector('.hintTarget');
  return { on, say: on ? (h.querySelector('.say')||h).textContent.replace(/\\s+/g,' ').trim().slice(0,60) : '', tid: t ? (t.id || t.getAttribute('data-slot') || (t.getAttribute('data-plantwhere') ? 'where:' + t.getAttribute('data-plantwhere') : '') || t.className || t.tagName) : null }; })()`);
const chipNow = () => J(`(()=>({ head: ((document.querySelector('#questChip b')||{}).textContent||''), body: ((document.getElementById('questChipText')||{}).textContent||''), on: document.getElementById('questChip').classList.contains('on') }))()`);
const saveA = fs.readFileSync(SAVE_A, 'utf8'), saveS = fs.readFileSync(SAVE_S, 'utf8');

/* ═══ ㉮ C1 — 새 판 Day 0 ═══ */
await boot(null);
await dlgOnly(); await camStill(); await sleep(1500);
const c1 = [];
for (const id of ['resow', 'harvestCrop']) {
  const r = await J(`(()=>{ const d=document.getElementById('hintDim'); const b=document.getElementById(${JSON.stringify(id)});
    if (!d || !b) return { 탈: '요소 없음' };
    b.style.display=''; b.disabled=false; b.textContent='시험 단추';
    window.__c1hits = window.__c1hits || {}; window.__c1hits[${JSON.stringify(id)}] = 0;
    if (!b.__c1ear) { b.__c1ear = true; b.addEventListener('click', (e) => { window.__c1hits[${JSON.stringify(id)}]++; e.stopImmediatePropagation(); e.preventDefault(); }, true); }
    const q=b.getBoundingClientRect(); const v=(d.dataset.hole||'').split(',').map(Number);
    const x=q.left+q.width/2, y=q.top+q.height/2; const inHole = v.length===3 && Math.hypot(x-v[0], y-v[1]) <= v[2];
    const top=document.elementFromPoint(x,y);
    return { dim: d.classList.contains('on'), x, y, inHole, top: top ? (top.id||top.tagName) : null }; })()`);
  if (r && !r.탈) { await tapAt(r.x, r.y); await sleep(250); }
  const hits = await J(`(window.__c1hits||{})[${JSON.stringify(id)}] || 0`);
  const knock = await J(`document.getElementById('hint').classList.contains('knock')`);
  c1.push({ id, ...r, hits, knock });
  await J(`(()=>{ const b=document.getElementById(${JSON.stringify(id)}); b.style.display='none'; return 1; })()`);
  await sleep(600);
}
console.log('  ㉮', JSON.stringify(c1));
ok(c1.every(x => !x.탈 && x.dim && !x.inHole), '판 ㉮ — 덮개(울타리)가 켜져 있고 단추는 구멍 밖', JSON.stringify(c1.map(x => [x.id, x.dim, x.inHole, x.top])));
ok(c1.every(x => x.hits === 1), '㉮ C1 바닥 단추(다시 심기 · 거두기)는 손가락이 딴 데를 짚어도 한 번에 먹힌다', JSON.stringify(c1.map(x => [x.id, x.hits])));

/* ═══ ㉯ ㉰ ㉱ — A100 ═══ */
await boot(saveA);
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await camStill(); await sleep(1500);
const c7 = await J(`(()=>{ const vis = id => { const b=document.getElementById(id); return !!(b && b.style.display !== 'none' && b.offsetParent && getComputedStyle(b).display !== 'none'); };
  const ids=['harvestCrop','waterCrop','resow']; const tired = ids.filter(id => vis(id) && document.getElementById(id).classList.contains('tired'));
  const same = ids.filter(id => vis(id) && /손이 다 떨어졌/.test(document.getElementById(id).textContent||''));
  const b = tired[0] ? document.getElementById(tired[0]) : null; const cs = b ? getComputedStyle(b) : null;
  const S=window.__S(); return { left: S.stamina && S.stamina.left, tired, same, bg: cs ? cs.backgroundImage.slice(0,80) : null }; })()`);
const seed = await J(`window.__byeotSeedTomorrow ? window.__byeotSeedTomorrow('beansprout') : { 없음: true }`);
const h7 = await hintNow();
if (OUT) await page.shot(`${OUT}/390_c6a_c7_zero.png`);
console.log('  ㉯', JSON.stringify({ c7, seed, h7 }));
ok(!c7.탈 && c7.left === 0, '판 ㉯ — 체력 0', JSON.stringify(c7));
ok(!c7.탈 && c7.same.length === 1 && c7.tired.length === 1, '㉯ C7 «오늘 손이 다 떨어졌습니다» 바닥 단추는 하나', JSON.stringify(c7));
ok(!c7.탈 && /gradient/.test(c7.bg || '') && /142, 139, 150/.test(c7.bg || ''), '㉯ C7 그 단추는 회색 판', c7.bg);
/* 작업 전 판엔 손잡이가 없다(없음) — 그 판은 «씨앗을 사러» 손가락이 섰나만 본다(비판 사진 A100_lampcheck 와 같은 판) */
ok(!h7.탈 && !seed.탈 && !seed.없음 && (/씨앗을 사러/.test(h7.say || '') === (seed.want > 0 && seed.have < seed.want)), '㉯ C7 «씨앗을 사러 갑니다»는 내일 몫(§seedTomorrowOf)이 모자랄 때만', JSON.stringify({ h7, seed }));
/* ㉰ C10 */
await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
await tapSel('#sellPlant'); await sleep(1000);
const c10 = await J(`(()=>{ const p=document.getElementById('varieAsk'); const g=document.getElementById('varieAskGo'), c=document.getElementById('varieAskCancel');
  const bi = el => getComputedStyle(el).backgroundImage; const fl = el => parseFloat(getComputedStyle(el).flexGrow);
  return { on: p.classList.contains('on'), warn: p.dataset.warn, go: (g.textContent||''), goBg: bi(g).replace(/^.*\\//,'').slice(0,40), cBg: bi(c).replace(/^.*\\//,'').slice(0,40), goFlex: fl(g), cFlex: fl(c), goIsGo: g.classList.contains('go') }; })()`);
if (OUT) await page.shot(`${OUT}/390_c6a_c10_warn.png`);
console.log('  ㉰', JSON.stringify(c10));
ok(!c10.탈 && c10.on && c10.warn === '1', '판 ㉰ — 내놓기 경고 창(원천 0)', JSON.stringify(c10));
ok(!c10.탈 && /amber/.test(c10.cBg) && /slate/.test(c10.goBg) && c10.cFlex > c10.goFlex, '㉰ C10 주 단추는 «아직»(호박 판 · 넓게) · [그래도 내놓는다]는 회색 판', JSON.stringify(c10));
ok(!c10.탈 && c10.goIsGo, '㉰ C10 .go 표는 그대로 [그래도 …](옷만 바꿈)', JSON.stringify(c10));
/* ㉱ C2 — 그대로 내놓고 → 연락 → 거래 */
await tapSel('#varieAskGo'); await sleep(1200); await dlgOnly();
await J(`(()=>{ const S=window.__S(); for (const l of (S.shop.listings||[])) if (l.kind==='pot') l.contactOnDay = S.day + 1; return 1; })()`);
await page.eval(`(()=>{ window.__byeotSheet.close(); return 1; })()`, false); await sleep(600);
await page.eval(`(()=>{ const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
await sleep(1500); await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false);
await sleep(3000); await dlgOnly(); await sleep(1500); await dlgOnly();
await page.eval(`(()=>{ window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(1200);
await tapSel('#marketList [data-deal]'); await sleep(900);
await tapSel('#varieAskGo'); await sleep(1500);
const lines2 = [];
const grabAll = async () => { for (let i = 0; i < 90; i++) { const t = await J(`(()=>({ on: document.getElementById('stage').classList.contains('talking'), l: (document.getElementById('dlgText')||{}).textContent || '' }))()`);
  if (!t || t.탈 || !t.on) return; if (t.l && lines2[lines2.length - 1] !== t.l) lines2.push(t.l); await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(300); } };
await grabAll(); await sleep(800); await grabAll();
await page.eval(`(()=>{ window.__byeotSheet.close(); return 1; })()`, false); await sleep(1500); await grabAll();
const mv0 = await J(`(()=>{ const S=window.__S(); const ts=S.tutorial; return { day: S.day, cash: ts.cashWon, moved: !!ts.movedOut, pots: (S.pots||[]).length }; })()`);
console.log('  ㉱ 판 뒤 대사', JSON.stringify(lines2));
ok(!mv0.탈 && mv0.pots === 0 && mv0.cash >= 2000000 && !mv0.moved, '판 ㉱ — 모그루를 팔아 이사비가 찼다(아직 안 감)', JSON.stringify(mv0));
{ const iSold = lines2.findIndex(l => /무늬가 남은 게 없어/.test(l)), iMove = lines2.findIndex(l => /이사비도 모였어/.test(l));
  ok(iMove >= 0 && lines2.some(l => /이사는 \[방\]에서 해/.test(l)), '㉱ C2 · P3 판 그 자리에서 몬이 «이사비도 모였어 … 이사는 [방]에서 해»(move_ready afterSale)', JSON.stringify(lines2));
  ok(iSold >= 0 && iMove > iSold, '㉱ P3 차례 — 판 뒤 대사(«이제 무늬가 남은 게 없어») 다음에 «이사비도 모였어»', JSON.stringify({ iSold, iMove })); }
const chip2 = await chipNow();
await page.eval(`(()=>{ window.__byeotSheet.open('quest'); return 1; })()`, false); await sleep(1200);
const board2 = await J(`(()=>({ tab: (document.getElementById('questSubTab')||{}).textContent || '' }))()`);
if (OUT) await page.shot(`${OUT}/390_c6a_c2_board.png`);
await page.eval(`(()=>{ window.__byeotSheet.close(); return 1; })()`, false); await sleep(1500);
console.log('  ㉱', JSON.stringify({ chip2, board2 }));
ok(!chip2.탈 && chip2.body === '[방]에서 원룸으로 이사할 수 있습니다', '㉱ C2 칩 «[방]에서 원룸으로 이사할 수 있습니다»', JSON.stringify(chip2));
ok(!board2.탈 && board2.tab === '이사는 [방] › [원룸으로 이사]에서 합니다', '㉱ C2 할 일 판 머리 «이사는 [방] › [원룸으로 이사]에서 합니다»(«기다리면 열립니다» 아님)', JSON.stringify(board2));
/* 돌봄을 손가락대로(바닥 단추 · 말풍선) 다 하거나 체력이 떨어질 때까지 — 그 뒤 손가락이 [방] */
const fingers = [];
let h2 = null;
for (let i = 0; i < 40; i++) {
  await camStill();
  h2 = await hintNow(); fingers.push(h2 && (h2.tid || '없음') + ':' + (h2.say || ''));
  if (!h2 || h2.탈 || h2.tid === 'navRoom' || h2.tid === 'next') break;
  /* 돌봄(말풍선 · 바닥 돌봄 단추)만 누른다 — 손가락이 그 밖(상점 · 가방 …)을 짚으면 거기서 멈추고 아래 단언이 가른다 */
  const tgt = await J(`(()=>{ const t=document.querySelector('.hintTarget'); if (!t) return null; const care = !!(t.closest('#marks') || ['harvestCrop','waterCrop','waterPot','resow'].includes(t.id));
    if (!care) return { care: false }; const q=t.getBoundingClientRect(); return { care: true, x: q.left+q.width/2, y: q.top+q.height/2 }; })()`);
  if (!tgt || tgt.탈 || !tgt.care) break;
  await tapAt(tgt.x, tgt.y); await sleep(1800);
  for (let k = 0; k < 20; k++) { const a = await J(`(()=>{ const b=document.getElementById('actBar'); return !!(b && b.style.display !== 'none'); })()`); if (!a || a.탈) break; await sleep(400); }
  await dlgOnly();
  await J(`(()=>{ const p=document.querySelector('.pop.on'); if (p) { const c=p.querySelector('button.ghost'); if (c) c.click(); } return 1; })()`);
}
const sta2 = await J(`(()=>{ const S=window.__S(); return { left: S.stamina && S.stamina.left }; })()`);
if (OUT) await page.shot(`${OUT}/390_c6a_c2_chip.png`);
console.log('  ㉱ 손가락 차례', JSON.stringify({ fingers, sta2 }));
ok(!h2.탈 && h2.on && h2.tid === 'navRoom' && h2.say === '이사는 여기서 합니다', '㉱ C2 돌봄 뒤 손가락이 [방] «이사는 여기서 합니다»([다음 날] 아님)', JSON.stringify({ h2, fingers }));
await tapSel('#navRoom'); await sleep(1800);
let h3 = null; for (let i = 0; i < 12; i++) { h3 = await hintNow(); if (h3 && h3.on && h3.tid === 'moveOut') break; await sleep(500); }
if (OUT) await page.shot(`${OUT}/390_c6a_c2_room.png`);
console.log('  ㉱ [방] 뒤', JSON.stringify(h3));
ok(!h3.탈 && h3.on && h3.tid === 'moveOut' && h3.say === '누르면 이사를 한 번 더 묻습니다', '㉱ C2 [방]을 누르면 손가락이 [원룸으로 이사] «누르면 이사를 한 번 더 묻습니다»', JSON.stringify(h3));

/* ═══ ㉲ C5 · C6 — A100L(등을 아직 안 단 판) ═══ */
const wA = JSON.parse(saveA);
wA.state.tutorial.lamp.placed = 0; wA.state.lamps.count = 0;
wA.state.stamina.questsTaken = (wA.state.stamina.questsTaken || []).filter(x => x !== 'buy_lamp');
/* 한 번뿐인 대사 기록도 Day 50 꼴로(그 판은 questDoneBuyLamp 를 이미 본 세이브라 대화 상자가 막는다 — [plan] 0400a798 대 봄 2) */
if (wA.state.talk) { for (const k of ['seen', 'recent']) if (Array.isArray(wA.state.talk[k])) wA.state.talk[k] = wA.state.talk[k].filter(x => x !== 'questDoneBuyLamp'); }
await boot(JSON.stringify(wA));
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await camStill(); await sleep(1500);
const l0 = await J(`(()=>{ const S=window.__S(); return { owned: S.tutorial.lamp.owned, placed: S.tutorial.lamp.placed, count: S.lamps.count }; })()`);
const chipL0 = await chipNow();
await page.eval(`(()=>{ window.__byeotSheet.open('plants'); return 1; })()`, false); await sleep(1200);
/* ★ 11-03 core(regs13 ㉲ 빨강 — [식물] 시트를 연 뒤 1.2초에 #lightHeat 를 눌렀는데 빛 분포가 안 켜짐 · 시트가 올라오는 움직임이 헤드리스 프레임 멈춤에 걸려 누름이 빗나간 꼴 · 총괄 가름)
     ⇒ 누르기 전에 움직임을 끝 상태로(getAnimations().finish()) · 10×10 찍기로 프레임 한 장 */
await page.eval(`(()=>{ for (const a of document.getAnimations()) { try { a.finish(); } catch (e) { void e; } } return 1; })()`, false);
await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 10, clip: { x: 0, y: 0, width: 10, height: 10, scale: 1 } }); await sleep(300);
await tapSel('#lightHeat'); await sleep(2500); await dlgOnly();
const leg0 = await J(`(()=>{ const t=[...document.querySelectorAll('.byeot-lightgrid div')].map(e=>e.textContent||'').find(s=>/등\\s\\d+개/.test(s)&&s.length<200); return { on: !!(window.__rv.lightHeatmap()||{}).on, legend: t ? (t.match(/등\\s\\d+개/)||[''])[0].replace(/\\s/g,' ') : null }; })()`);   /* ★ 11-02 «등»·«n개» 사이 안 꺾는 빈칸([plan] §18 덤 ①) */
await page.eval(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`, false); await sleep(1200);
await tapSel('#__lampbag__'); await sleep(1800);
const pok = await tapSel('#placeOk'); await sleep(2500);
const l1 = await J(`(()=>{ const S=window.__S(); return { placed: S.tutorial.lamp.placed, count: S.lamps.count, heat: !!(window.__rv.lightHeatmap()||{}).on }; })()`);
const leg1 = await J(`(()=>{ const t=[...document.querySelectorAll('.byeot-lightgrid div')].map(e=>e.textContent||'').find(s=>/등\\s\\d+개/.test(s)&&s.length<200); return t ? (t.match(/등\\s\\d+개/)||[''])[0].replace(/\\s/g,' ') : null; })()`);
const lines5 = []; for (let w = 0; w < 10; w++) { const t0 = await J(`document.getElementById('stage').classList.contains('talking')`); if (t0 === true) break; await sleep(400); }
for (let i = 0; i < 60; i++) { const t = await J(`(()=>({ on: document.getElementById('stage').classList.contains('talking'), l: (document.getElementById('dlgText')||{}).textContent || '' }))()`); if (!t.on) break; if (t.l && lines5[lines5.length - 1] !== t.l) lines5.push(t.l); await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(280); }
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1500);
const chipL1 = await chipNow();
const done5 = await J(`(window.__S().stamina.questsTaken||[]).includes('buy_lamp')`);
if (OUT) await page.shot(`${OUT}/390_c6a_c5_lamp.png`);
console.log('  ㉲ C5', JSON.stringify({ l0, chipL0, leg0, pok: pok && pok.hit, l1, leg1, chipL1, done5, lines5: lines5.slice(0, 4) }));
ok(!l0.탈 && l0.owned >= 1 && l0.placed === 0, '판 ㉲ — 가방에 안 단 등(Day 50 꼴)', JSON.stringify(l0));
ok(!leg0.탈 && leg0.on && leg0.legend === '등 0개', '판 ㉲ — 빛 분포 켬 · 범례 «등 0개»', JSON.stringify(leg0));
ok(!l1.탈 && l1.placed === 1 && l1.heat, '판 ㉲ — 등을 달았다(빛 분포 켠 채)', JSON.stringify(l1));
ok(leg1 === '등 1개', '㉲ C5 단 그 자리에서 범례가 «등 1개»', String(leg1));
ok(done5 === true && !/식물등을 달아/.test(chipL1.body || ''), '㉲ C5 단 그 자리에서 할 일 buy_lamp 가 끝난다(칩이 «식물등을 달아…» 아님)', JSON.stringify({ done5, chipL1, chipL0 }));
ok(lines5[0] === '등을 달았다. 손바닥만 하네.', '㉲ P5 단 그 자리에서 몬이 questDoneBuyLamp «등을 달았다. 손바닥만 하네.»', JSON.stringify(lines5));
/* C6 */
const offPt = await tapSel('#lightHeatOff'); await sleep(1500);
const c6a = await J(`(()=>{ const b=document.getElementById('lightHeatOff'); const q=b.getBoundingClientRect(); return { heat: !!(window.__rv.lightHeatmap()||{}).on, shown: b.style.display !== 'none' && q.width > 0, t: (b.textContent||'').trim(), x: Math.round(q.left+q.width/2), y: Math.round(q.top+q.height/2) }; })()`);
if (OUT) await page.shot(`${OUT}/390_c6a_c6_off.png`);
await tapSel('#lightHeatOff'); await sleep(2000);
const c6b = await J(`(()=>{ const b=document.getElementById('lightHeatOff'); return { heat: !!(window.__rv.lightHeatmap()||{}).on, t: (b.textContent||'').trim(), seen: !!window.__S().tutorial.heatChipSeen }; })()`);
console.log('  ㉲ C6', JSON.stringify({ off: offPt && { x: Math.round(offPt.x), y: Math.round(offPt.y) }, c6a, c6b }));
ok(!c6a.탈 && !c6a.heat && c6a.shown && /빛 분포 보기/.test(c6a.t) && offPt && Math.abs(offPt.y - c6a.y) < 3, '㉲ C6 끈 뒤 같은 자리에 [🔆 빛 분포 보기]가 남는다', JSON.stringify(c6a));
ok(!c6b.탈 && c6b.heat && /끄기/.test(c6b.t) && c6b.seen, '㉲ C6 그것을 누르면 다시 켜진다(깃발 heatChipSeen 세이브)', JSON.stringify(c6b));

/* ═══ ㉳ C3①②③ — S97 ═══ */
await boot(saveS);
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await camStill(); await sleep(1500);
const cropSlots = await J(`(()=>{ const fp=window.__S().firstPlay; const all=[...((fp.beansprout||{}).pots||[]), ...Object.values(fp.crops||{}).flatMap(v=>(v&&v.pots)||[])];
  return all.map(p=>p&&p.slotId).filter(x=>x && !/^free:/.test(x)); })()`);
const openWhere = async () => { await page.eval(`(()=>{ window.__byeotSheet.open('plants'); return 1; })()`, false); await sleep(1200); await tapSel('[data-plantwhere]'); await sleep(1500); };
const listNow = () => J(`(()=>{ const rows=[...document.querySelectorAll('#slotList [data-slot]')].map(b=>({ s: b.dataset.slot, dli: parseFloat(b.dataset.dli), here: b.disabled, small: (b.querySelector('small')||{}).textContent||'' })); return { on: document.getElementById('slotPanel').classList.contains('on'), rows }; })()`);
await openWhere();
const w0 = await listNow(); let hw0 = null; for (let i = 0; i < 6; i++) { hw0 = await hintNow(); await sleep(400); }
if (OUT) await page.shot(`${OUT}/390_c6a_c3_where.png`);
console.log('  ㉳ 목록', JSON.stringify({ rows: w0.rows, hw0, cropSlots }));
const WORD = /^(지금 여기 있습니다 · )?(어둠|그늘|밝음|아주 밝음)$/;
ok(!w0.탈 && w0.on && w0.rows.length >= 1, '판 ㉳ — 자리 목록이 섰다', JSON.stringify(w0).slice(0, 200));
ok(!w0.탈 && w0.rows.every(r => WORD.test(r.small.trim())), '㉳ C3① 줄마다 밝기 낱말(어둠 · 그늘 · 밝음 · 아주 밝음)', JSON.stringify(w0.rows.map(r => r.small)));
ok(!w0.탈 && !cropSlots.탈 && w0.rows.every(r => r.here || !cropSlots.includes(r.s)), '㉳ C3 목록에 시루 · 재배판이 앉은 칸이 없다(겹쳐 서지 않게)', JSON.stringify(w0.rows.filter(r => !r.here && cropSlots.includes(r.s)).map(r => r.s)));
ok(!hw0.탈 && hw0.tid !== 'slotCancel', '㉳ C3② 손가락이 [그만두기]를 안 짚는다', JSON.stringify(hw0));
/* ㉳-2 · ㉳-3 — 6판 S Day 90 꼴(화분이 어두운 자리)을 세이브 손질로 세운다(이 S97 판은 화분이 이미 창턱으로 옮겨져 있고 빈 칸이 없다).
     ㉯ 판 S97y: 화분 ↔ 책상 시루(banjiha-desk:0) 자리를 맞바꿈 — 화분은 어둠, 창턱 1번 칸엔 무순 판(그대로) + 시루
     ㉮ 판 S97z: 화분을 책상 시루 자리로 · 그 시루와 창턱 1번 칸 무순 판은 책상 위 빈 점(free)으로 — 창턱 1번 칸이 빈다 */
const mk = (fn) => { const w = JSON.parse(saveS); const st = w.state; const fp = st.firstPlay;
  const all = [...fp.beansprout.pots, ...Object.values(fp.crops).flatMap(v => (v && v.pots) || [])];
  fn(st, all); return JSON.stringify(w); };
const S97y = mk((st, all) => { const pot = st.pots[0], siru = all.find(x => x.slotId === 'banjiha-desk:0');
  const ps = pot.slotId, pa = pot.at; pot.slotId = siru.slotId; pot.at = { ...siru.at }; siru.slotId = ps; siru.at = { ...pa }; });
const S97z = mk((st, all) => { const pot = st.pots[0], siru = all.find(x => x.slotId === 'banjiha-desk:0'), tray = all.find(x => x.slotId === 'oneroom-sill:0');
  pot.slotId = siru.slotId; pot.at = { ...siru.at };
  siru.slotId = 'free:' + siru.id; siru.at = { ...siru.at, x: 2.375, z: 1.875 };
  tray.slotId = 'free:' + tray.id; tray.at = { ...siru.at, x: 2.625, z: 1.875 }; });
/* ㉳-2 ㉯ */
await boot(S97y);
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await camStill(); await sleep(1500);
const pdY = await J(`window.__byeotPotDark ? window.__byeotPotDark() : { 탈: '손잡이 없음' }`);
const chipY = await chipNow();
const warnY = await J(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0]; return window.__byeotDarkWarn && p ? window.__byeotDarkWarn(p.id) : '손잡이 없음'; })()`);
await page.eval(`(()=>{ window.__byeotSheet.open('quest'); return 1; })()`, false); await sleep(1200);
const boardY = await J(`(document.getElementById('questSubTab')||{}).textContent || ''`);
await page.eval(`(()=>{ window.__byeotSheet.close(); return 1; })()`, false); await sleep(1200);
let chipY2 = null; for (let i = 0; i < 6; i++) { chipY2 = await chipNow(); if (chipY2 && chipY2.on) break; await sleep(400); }
if (OUT) await page.shot(`${OUT}/390_c6a_c3_clear.png`);
ok(!chipY2.탈 && chipY2.on && chipY2.body === chipY.body, '㉳-2 할 일 탭을 연 채 시트를 닫으면 칩이 돌아온다([plan] 0400a798 대 봄 3 · 총괄 사진 c3_clear)', JSON.stringify(chipY2));
console.log('  ㉳-2 ㉯', JSON.stringify({ pdY, chipY, warnY, boardY }));
ok(!pdY.탈 && pdY && pdY.kind === 'clear', '판 ㉳-2 — 화분 어둠 · 밝은 칸은 다 참(작물)', JSON.stringify(pdY));
ok(!chipY.탈 && /^(무순 판|시루) 하나를 옮겨 밝은 칸을 비우세요$/.test(chipY.body), '㉳-2 C3③ ㉯ 칩 «{무순 판|시루} 하나를 옮겨 밝은 칸을 비우세요»', JSON.stringify(chipY));
ok(boardY === '지금 할 것 — ' + chipY.body, '㉳-2 C3③ 할 일 판 머리도 같은 줄', boardY);
ok(/^여기는 몬스테라가 자라기엔 어둡습니다 — 제일 밝은 .+에는 (무순 판|시루)가 있습니다$/.test(String(warnY)), '㉳-2 C3 경고 goBestTaken «제일 밝은 …에는 …가 있습니다»', String(warnY));
/* ㉳-3 ㉮ */
await boot(S97z);
await dlgOnly(); await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await camStill(); await sleep(1500);
const pdZ = await J(`window.__byeotPotDark ? window.__byeotPotDark() : { 탈: '손잡이 없음' }`);
const chipZ = await chipNow();
let hp = null; for (let i = 0; i < 10; i++) { hp = await hintNow(); if (hp && hp.on && hp.tid === 'navPlants') break; await sleep(400); }
if (OUT) await page.shot(`${OUT}/390_c6a_c3_dark.png`);
console.log('  ㉳-3 ㉮', JSON.stringify({ pdZ, chipZ, hp }));
ok(!pdZ.탈 && pdZ && pdZ.kind === 'go', '판 ㉳-3 — 화분 어둠 · 밝은 빈 칸 있음', JSON.stringify(pdZ));
/* ★ 2026-11-02 core 7C2 — 할 일 'go' 글 정본은 «몬스테라 화분을 밝은 빈 칸으로 옮기세요»([plan] plan-to-core-critic7 §3 ㉠) */
ok(!chipZ.탈 && chipZ.body === '몬스테라 화분을 밝은 빈 칸으로 옮기세요', '㉳-3 C3③ ㉮ 칩 «몬스테라 화분을 밝은 빈 칸으로 옮기세요»(7C2 글)', JSON.stringify(chipZ));
ok(!hp.탈 && hp.tid === 'navPlants' && hp.say === '여기서 화분 자리를 옮깁니다', '㉳-3 C3③ 손가락 [식물] «여기서 화분 자리를 옮깁니다»', JSON.stringify(hp));
await tapSel('#navPlants'); await sleep(1600);
let hq = null; for (let i = 0; i < 10; i++) { hq = await hintNow(); if (hq && /^where:/.test(hq.tid || '')) break; await sleep(400); }
ok(!hq.탈 && /^where:/.test(hq.tid || '') && hq.say === '누르면 옮길 자리를 고릅니다', '㉳-3 C3③ [식물] 뒤 손가락 [📍 자리] «누르면 옮길 자리를 고릅니다»', JSON.stringify(hq));
await tapSel('[data-plantwhere]'); await sleep(1500);
const w1 = await listNow(); let hw1 = null; for (let i = 0; i < 8; i++) { hw1 = await hintNow(); if (hw1 && hw1.on) break; await sleep(400); }
const best1 = (w1.rows || []).filter(r => !r.here && Number.isFinite(r.dli)).sort((a, b) => b.dli - a.dli)[0];
if (OUT) await page.shot(`${OUT}/390_c6a_c3_where2.png`);
console.log('  ㉳-3 목록', JSON.stringify({ rows: w1.rows, best1, hw1 }));
ok(!hw1.탈 && hw1.on && best1 && hw1.tid === best1.s && hw1.tid !== 'slotCancel', '㉳-3 C3② 자리 창 손가락이 가장 밝은 줄([그만두기] 아님)', JSON.stringify({ hw1, best1 }));
ok(!hw1.탈 && hw1.say === '여기가 밝은 빈 칸입니다', '㉳-3 7C2 그 줄 말풍선 «여기가 밝은 빈 칸입니다»', JSON.stringify(hw1));
if (best1) { await tapSel(`#slotList [data-slot="${best1.s}"]`); await sleep(2000); await dlgOnly(); }
await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1500); await dlgOnly();
const pd2 = await J(`window.__byeotPotDark()`); const chip4 = await chipNow();
console.log('  ㉳-3 옮긴 뒤', JSON.stringify({ pd2, chip4 }));
ok(pd2 === null && chip4.body !== '몬스테라 화분을 밝은 빈 칸으로 옮기세요' && chip4.body !== '화분을 밝은 자리로 옮기세요', '㉳-3 C3③ 밝은 자리로 옮기면 그 할 일 줄이 걷힌다', JSON.stringify({ pd2, chip4 }));

try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
ok(exc.length === 0, '처리 안 된 예외 0', JSON.stringify(exc.slice(0, 5)));
console.log(bad ? `probe_critic6_a: 빨강 ${bad}` : 'probe_critic6_a: 다 통과');
process.exit(bad ? 1 : 0);
