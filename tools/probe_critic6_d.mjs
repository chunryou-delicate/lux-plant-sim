/* 비판 6판 #13 d05 꼴 자(core 11-02 · 총괄 «상점 줄 말풍선이 줄 글을 덮는 것») — 360 · 390 · 430
   ⛔ 사진 d05_004(390 · Day 5): 손가락이 «콩 씨앗» 줄 [주문]을 짚는데 말풍선 «여기서 씨앗을 주문합니다 — 하루 뒤에 옵니다»가
      그 줄의 이름 · «1일 뒤 도착» · 값(500원)을 덮었다. 비판 다섯째 판 #10 고침이 «짚는 줄 글은 비킬 글에서 뺀다»로 둬
      위(갈래 탭 · 윗줄)가 막히면 왼쪽으로 물러나 제 줄 글 위에 앉았다.
   판: 하네스 humanQ 씨앗 g 의 Day 11 · 29 아침 세이브(자가 하네스를 돌려 뜬다 · probe_minor5_10 과 같은 손)
     ㉠ «씨앗 주문» 걸음(d05 꼴) — Day 11 을 손질: 콩 씨앗 재고 0 · 콩 씨앗 주문 없음 · 첫 시루는 거둔 채(다시 심을 몫 · 씨앗이 떨어진 판)
        ⇒ updateHint 의 seedNeed 갈래가 «여기서 씨앗을 주문합니다 …»로 콩 씨앗 줄 [주문]을 짚는다
     ㉡ Day 29 그대로 — 새싹 재배판 줄 [주문](probe_minor5_10 판 · 손질 없음)
   손: 세이브마다 손가락이 짚은 [상점]을 누르고(없으면 연다) 손가락을 다시 묻는다(window.__byeotHint) · 시트가 다 펴질 때까지 기다림
   잰다(시트 안 · 굴림 칸 안에 보이는 것만): 말풍선(.say)과 손(글자 자리)이 덮은 ① 짚는 줄 글 ② 다른 글 ③ 다른 단추 · 손과 짚는 단추 사이 틈 — 사진(OUT)
   단언: ㉮ 손가락이 그 줄 [주문]을 짚는다 ㉯ 짚는 줄 글(이름 · 도착 · 값)을 안 덮는다 ㉰ 다른 글 · 단추를 안 덮는다 ㉱ 손이 그 단추에 닿는다(틈 ≤ 14px · 손 흔들림 6px 포함) · 예외 0
   ㉢ 덤(390 · 같은 고침) — 판매 창(바닥 [🧺 남는 채소 N판 팔기]) 말풍선 «여기를 눌러 보세요»가 [그만두기]를 안 덮는다
      (plan f373262a 대조 ⑤ 사진 390_c6c_c12_popup · 까닭: 창 «밑»에 깔린 바닥 단추 글을 비킬 글로 세어 말풍선이 옆 단추 위로 밀렸다)
      판: 비판 6판 A100 세이브(C:/Users/pc/byeot-core-keep/critic6/ · probe_critic6_c ㉲ 와 같은 손질 — 보유 채소 꾸러미 세 벌) */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DUMP = process.env.C6D_DUMP_DIR || path.join(os.tmpdir(), 'byeot-critic6-d');
const DAYS = [11, 29];
const WIDTHS = (process.env.C6D_W || '360,390,430').split(',').map(Number);
if (OUT) fs.mkdirSync(OUT, { recursive: true });
if (!DAYS.every(d => fs.existsSync(path.join(DUMP, `humanQ_g_d${d}.json`))))
  execFileSync(process.execPath, [path.join(HERE, 'probe_branches.mjs'), '--one', JSON.stringify({ name: 'humanQ', seed: 'g', days: Math.max(...DAYS) + 1, dump: DUMP, dumpDays: DAYS })],
    { maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
/* ㉠ 씨앗 주문 걸음 손질 — 콩 씨앗이 떨어진 판(재고 0 · 주문 없음 · 거둔 시루 하나) */
const noSeed = (txt) => { const w = JSON.parse(txt); const s = w.state;
  s.shop.stock.bean_seed = 0; s.shop.orders = (s.shop.orders || []).filter(o => o.itemId !== 'bean_seed');
  s.firstPlay.beansprout.pots[0].harvested = true; return JSON.stringify(w); };
const CASES = [
  { key: 'seed', day: 11, stage: noSeed, buy: 'bean_seed', say: /^여기서 씨앗을 주문합니다/, ko: '㉠ 씨앗 주문(d05 꼴 · Day 11 손질)' },
  { key: 'tray', day: 29, stage: t => t, buy: 'sprout_tray', say: /새싹 재배판을 주문합니다/, ko: '㉡ 새싹 재배판(Day 29)' }
];
const SAVE_A = process.env.SAVE_A || 'C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json';
/* 잴 그릇 — 짚는 것이 떠 있는 창(.pop.on) 안이면 그 창 · 아니면 시트 */
const measure = (J) => J(`(()=>{
  const h=document.getElementById('hint'); const t=document.querySelector('.hintTarget');
  if (!h || !h.classList.contains('on') || !t) return { on:false, t: t ? (t.id||t.className) : null };
  const box=(t.closest&&t.closest('.pop.on'))||document.getElementById('sheet');
  const R=q=>[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)];
  const area=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  const sayR=(h.querySelector('.say')||h).getBoundingClientRect();
  const handG=(()=>{ const n=h.querySelector('.hand'); if(!n) return sayR; const rg=document.createRange(); rg.selectNodeContents(n); return rg.getBoundingClientRect(); })();
  const sheet=box, sb=document.getElementById('sheetbody'), sbr=sb?sb.getBoundingClientRect():null;
  const row=t.closest?t.closest('.shopRow'):null;
  const vis=e=>{ const cs=getComputedStyle(e); return !!e.offsetParent && cs.visibility!=='hidden' && +cs.opacity>0.05; };
  const inView=(el,q)=>!(sbr && sb.contains(el) && (q.bottom<=sbr.top+1 || q.top>=sbr.bottom-1)) && q.bottom>0 && q.top<innerHeight;
  const texts=[]; const tw=document.createTreeWalker(sheet,NodeFilter.SHOW_TEXT); let n;
  while((n=tw.nextNode())){ if(!(n.textContent||'').trim()) continue; const el=n.parentElement; if(!el||!vis(el)||t.contains(el)) continue;
    const rg=document.createRange(); rg.selectNodeContents(n);
    for(const q of rg.getClientRects()){ if(q.width<1||q.height<1||!inView(el,q)) continue; texts.push({ t:n.textContent.trim().slice(0,18), own:!!(row&&row.contains(el)), q }); } }
  const btns=[...sheet.querySelectorAll('button')].filter(b=>b!==t&&vis(b)).map(b=>({ el:b, t:(b.textContent||'').trim().slice(0,14), q:b.getBoundingClientRect() })).filter(x=>x.q.width>0&&inView(x.el,x.q));
  const hitT=[], hitB=[];
  for(const [pn,pr] of [['말',sayR],['손',handG]]){
    for(const x of texts){ const a=area(pr,x.q); if(a>4) hitT.push({ p:pn, t:x.t, own:x.own, a:Math.round(a) }); }
    for(const x of btns){ const a=area(pr,x.q); if(a>4) hitB.push({ p:pn, t:x.t, a:Math.round(a) }); } }
  const tr=t.getBoundingClientRect();
  const gap=Math.max(0, tr.left-handG.right, handG.left-tr.right, tr.top-handG.bottom, handG.top-tr.bottom);
  return { on:true, tid:t.id||null, inPop:!!(t.closest&&t.closest('.pop.on')), inShop:!!(document.getElementById('shopList')||{contains:()=>false}).contains(t), buy:(t.dataset&&t.dataset.buy)||null,
           say:((h.querySelector('.say')||{}).textContent||'').slice(0,40), cls:h.className, say_r:R(sayR), hand_r:R(handG), target:R(tr), row: row?R(row.getBoundingClientRect()):null,
           handGap:Math.round(gap), hitT, hitB };
})()`);
const exc = [];
for (const w of WIDTHS) {
  const page = await launch({ width: w, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
  for (const C of CASES) {
    const f = path.join(DUMP, `humanQ_g_d${C.day}.json`);
    if (!fs.existsSync(f)) { ok(false, `${w} ${C.ko} 세이브 없음`, f); continue; }
    await page.goto(`${BASE}/data/balance/homes.json`);
    await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(C.stage(fs.readFileSync(f, 'utf8')))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
    await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
    await dlgOnly();
    /* 사람처럼 — 손가락이 짚은 [상점]을 누른다(짚은 것이 없으면 상점을 연다) · 시트가 다 펴질 때까지 기다린 뒤 다시 묻는다 */
    await page.eval(`(()=>{ const t=document.querySelector('.hintTarget'); if (t && /상점/.test(t.textContent||'')) t.click(); else window.__byeotSheet.open('shop'); return 1; })()`, false); await sleep(2500);
    /* ★ 11-03 core(regs13 · 번갈아 c6ad_alt — HEAD 판 · 고친 판 둘 다 ㉠ 한 너비만 손가락 on:false · 빨강 너비가 회차마다 바뀜(390 · 430) = 헤드리스 프레임 멈춤 흔들림 · 총괄 가름)
         ⇒ 시트를 연 뒤 움직임을 끝 상태로(getAnimations().finish()) · 10×10 찍기로 프레임 한 장 · 손가락 on 은 최대 네 번(0.6초 간격 · 잴 때마다 프레임 한 장) 다시 잰다 · 끝내 off 면 빨강 그대로 · tries 적음 */
    await page.eval(`(()=>{ for (const a of document.getAnimations()) { try { a.finish(); } catch (e) { void e; } } return 1; })()`, false);
    let m = null, tries = 0;
    for (; tries < 4; tries++) {
      await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 10, clip: { x: 0, y: 0, width: 10, height: 10, scale: 1 } });
      await page.eval(`(()=>{ try { window.__byeotHint(); } catch (e) { void e; } return 1; })()`, false); await sleep(tries ? 600 : 1200);
      m = await measure(J); if (m.탈 || m.on) break;
      if (tries === 0 && OUT) await page.shot(`${OUT}/${w}_c6d_${C.key}_first_off.png`);   /* 총괄 11-03 — 첫 잼에 꺼져 있던 순간(덤프 실은 뒤 첫 상점 · 손가락이 늦게 뜨나 8C 후보) */
    }
    if (m && !m.탈) m.tries = tries;
    console.log(`  ${w} ${C.key} 손가락 다시 잼 tries=${tries}${m && m.on ? '' : ' · 끝내 off'}`);
    console.log(`${w} ${C.ko}`, JSON.stringify(m));
    if (OUT) await page.shot(`${OUT}/${w}_c6d_${C.key}.png`);
    const pre = `${w} ${C.ko}`;
    ok(!m.탈 && m.on === true && m.inShop === true && m.buy === C.buy && C.say.test(m.say || ''), `${pre} ㉮ 손가락이 그 줄 [주문]을 짚는다`, JSON.stringify({ on: m.on, buy: m.buy, say: m.say, 탈: m.탈 }));
    ok(!m.탈 && m.on === true && m.hitT.filter(x => x.own).length === 0, `${pre} ㉯ 짚는 줄 글(이름 · 도착 · 값)을 안 덮는다`, JSON.stringify(m.hitT && m.hitT.filter(x => x.own)));
    ok(!m.탈 && m.on === true && m.hitT.filter(x => !x.own).length === 0 && m.hitB.length === 0, `${pre} ㉰ 다른 글 · 단추를 안 덮는다`, JSON.stringify({ t: m.hitT && m.hitT.filter(x => !x.own), b: m.hitB }));
    ok(!m.탈 && m.on === true && m.handGap <= 14, `${pre} ㉱ 손이 그 단추에 닿는다(틈 ≤ 14px · 손 흔들림 6px 포함)`, JSON.stringify({ gap: m.handGap, hand: m.hand_r, target: m.target, cls: m.cls }));
  }
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
/* ═══ ㉢ 덤 — 판매 창 말풍선(390 · A100 · 보유 채소 꾸러미 세 벌) ═══ */
if (fs.existsSync(SAVE_A)) {
  const page = await launch({ width: 390, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  const w = JSON.parse(fs.readFileSync(SAVE_A, 'utf8'));
  { const f = w.state.firstPlay.food; const lots = (f.pantryLots || []).slice(); f.pantryLots = [...lots, ...lots.map(l => ({ ...l })), ...lots.map(l => ({ ...l }))];
    f.pantryWon = f.pantryLots.reduce((a, l) => a + (l.won || 0), 0); }
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(JSON.stringify(w))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
  for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
  await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false); await sleep(1200);
  const s0 = await J(`(()=>{ const b=document.getElementById('sellSurplusBtn'); if (!(b && b.style.display !== 'none' && b.offsetParent)) return { shown: false }; b.click(); return { shown: true, t: (b.textContent||'').trim() }; })()`);
  await sleep(1500);
  await page.eval(`(()=>{ try { window.__byeotHint(); } catch (e) { void e; } return 1; })()`, false); await sleep(1200);
  const m = await measure(J);
  console.log('390 ㉢ 판매 창', JSON.stringify({ s0, ...m }));
  if (OUT) await page.shot(`${OUT}/390_c6d_sellpop.png`);
  ok(!m.탈 && s0.shown === true && m.on === true && m.inPop === true, '390 ㉢ 판매 창이 떴고 손가락이 그 창 단추를 짚는다', JSON.stringify({ s0, on: m.on, tid: m.tid, say: m.say }));
  ok(!m.탈 && m.on === true && m.hitT.length === 0 && m.hitB.length === 0, '390 ㉢ 말풍선 · 손이 그 창의 다른 글 · 단추([그만두기])를 안 덮는다', JSON.stringify({ t: m.hitT, b: m.hitB }));
  ok(!m.탈 && m.on === true && m.handGap <= 14, '390 ㉢ 손이 그 단추에 닿는다(틈 ≤ 14px · 손 흔들림 6px 포함)', JSON.stringify({ gap: m.handGap, hand: m.hand_r, target: m.target, cls: m.cls }));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
} else ok(false, '㉢ 세이브 없음', SAVE_A);
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_critic6_d: 빨강 ${bad}` : 'probe_critic6_d: 다 통과');
process.exit(bad ? 1 : 0);
