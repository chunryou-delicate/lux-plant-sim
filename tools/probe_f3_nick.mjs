/* F3 그루 이름 자(core 11-03 · plan-ui-fun §F3 · «F3 이름 창 글» da5daa9c) — ⚠ 써 두기만(총괄 11-03 · 크롬은 새 종 덩이 뒤)
   판: T 투룸 가게 첫날 C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json(몬스테라 pot_01 · 삽수 둘 · 새 종 둘)
   단언(390 · 일부 360)
     ㉮ 몬스테라 [자세히] ✎ → 이름 «콩이» → 제목 «콩이» · 아래 줄 앞 «몬스테라 · » · 기록 줄 «✎ 몬스테라 이름을 «콩이»로 지었습니다»
     ㉯ 세이브 · 다시 켜기 뒤 제목 그대로 «콩이»
     ㉰ 비우면 «원래 이름으로» 단추 → 제목 «몬스테라» · 기록 «✎ «콩이» 이름을 지웠습니다»
     ㉲ 360 — 제목(8자 이름 + ✎) 한 줄
     ㉴ 힌트 두 갈래(이름 없음 «한글 · 숫자 · 띄어쓰기로 8자까지 씁니다» · 있음 «비워 두면 «몬스테라»로 돌아갑니다»)
     ㉵ «abc» · «ㅋㅋ» · 같은 이름(새 종 원래 이름 «핑크프린세스») → 까닭 줄 + 첫 단추 회색 · 조합 중(compositionstart) 입력은 안 잼(까닭 줄 안 바뀜)
     ㉶ 기록 줄 바꿈 «✎ «콩이» 이름을 «달»로 바꿨습니다» · 삽수 · 새 종 이름도 같은 창
     ㉷ 360 — 힌트 · 까닭 줄 한 줄 · [자세히] 아래 줄은 꺾이면 낱말 사이에서만
   ★ 11-04 크롬 첫 판 뒤(총괄 가름) — 제목 줄은 글 노드 사각형만 센다(top 2px 묶음 · ✎ 단추의 사각형이 «줄»로 세어져 «달» 한 글자도 3줄로 나왔다) · ✎ 은 세로 가운데가 첫 글자 줄 안(penIn)
     ㉸ 이름 창에서 [이 이름으로]가 꺼진 동안 손가락 없음 · 까닭 줄이 .warn 으로 보이고 단추 opacity ≤ 0.5 · 켜진 뒤엔 손가락이 [그만두기]가 아님
   (㉱ 팔기 창 한 줄 · ㉳ 생일은 F3 ③ 자로)
   예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_T = process.env.SAVE || 'C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_T)) { ok(false, '세이브 없음', SAVE_T); process.exit(1); }
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const dlg = async () => { for (let i = 0; i < 160; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); } };
const W = async (w) => { await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: w === 360 ? 780 : 844, deviceScaleFactor: 2, mobile: false }); await sleep(1300); };
const boot = async (raw) => {
  await W(390);
  await page.goto(`${BASE}/data/balance/homes.json`);
  if (raw != null) await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(raw)}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
  await dlg(); await bannerOff(); await sleep(1000);
};
const LINES = `(el => { if (!el || !el.textContent) return null; const rg=document.createRange(); rg.selectNodeContents(el); return new Set([...rg.getClientRects()].filter(q=>q.width>0).map(q=>Math.round(q.top))).size; })`;
/* ★ 11-04 — 제목 줄: 글 노드 사각형만(top 2px 묶음) · ✎ 은 세로 가운데가 첫 글자 줄 안인가 */
const TLINE = `(t => { if (!t) return { lines: null, penIn: null }; const rg = document.createRange(); const tops = []; let first = null;
  for (const n of t.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.width > 0) { tops.push(q.top); if (!first || q.top < first.top) first = q; } }
  tops.sort((a, b) => a - b); let k = 0, st = null; for (const x of tops) { if (st === null || x - st > 2) { k++; st = x; } }
  const pen = t.querySelector('.nickPen'); let penIn = null;
  if (pen && first) { const r = pen.getBoundingClientRect(); const cy = (r.top + r.bottom) / 2; penIn = cy >= first.top - 2 && cy <= first.bottom + 2; }
  return { lines: k, penIn }; })`;
const CARD = `(()=>{ const t=document.getElementById('dTitle'); const pen=t && t.querySelector('.nickPen'); const tx=t ? [...t.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('') : null;
  return { on: document.getElementById('detail').classList.contains('on'), title: tx, pen: !!pen, aria: pen ? pen.getAttribute('aria-label') : null, sub: (document.getElementById('dSub')||{}).textContent,
           tLines: ${TLINE}(t).lines, penIn: ${TLINE}(t).penIn, penW: pen ? Math.round(pen.getBoundingClientRect().width) : null, penH: pen ? Math.round(pen.getBoundingClientRect().height) : null }; })()`;
const openCard = (kind, id) => J(`(()=>{ window.__detailOpen(${JSON.stringify(kind)}, { id: ${JSON.stringify(id)} }); return 1; })()`);
const pen = () => J(`(()=>{ const b=document.querySelector('#dTitle .nickPen'); if (!b) return false; b.click(); return true; })()`);
const NK = `window.__byeotNick ? window.__byeotNick() : null`;
const type = async (v) => { await J(`(()=>{ const i=document.getElementById('nickInput'); i.value=${JSON.stringify(v)}; i.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()`); await sleep(250); return J(NK); };
const go = async () => { await J(`(()=>{ document.getElementById('nickGo').click(); return 1; })()`); await sleep(700); };
const logTail = () => J(`(window.__S().log||[]).slice(-3).map(x=>x && x.msg)`);

await boot(fs.readFileSync(SAVE_T, 'utf8'));
const ids = await J(`(()=>{ const S0=window.__S(); return { pot: (S0.pots[0]||{}).id, cut: ((S0.cuttings||[]).find(c=>c && c.status!=='dead')||{}).id, sp: ((S0.species||{}).pots||[]).map(q=>({ id: q.id, sp: q.species })) }; })()`);
/* ㉮ ㉴ */
await openCard('monstera', ids.pot); await sleep(600);
const c0 = await J(CARD);
await pen(); await sleep(500);
const n0 = await J(NK);
if (OUT) await page.shot(`${OUT}/390_f3_panel_none.png`);
const n1 = await type('콩이');
await go();
const c1 = await J(CARD); const l1 = await logTail();
if (OUT) await page.shot(`${OUT}/390_f3_card_named.png`);
console.log('  ㉮', JSON.stringify({ c0, n0, n1, c1, l1 }));
ok(!c0.탈 && c0.pen && c0.aria === '이름 짓기' && c0.penW >= 32 && c0.penH >= 32 && n0.open && n0.title === '이름을 지어 주세요' && n0.sub === '몬스테라' && n0.value === '' && n0.hint === '한글 · 숫자 · 띄어쓰기로 8자까지 씁니다' && n0.go === '이 이름으로' && n0.goDisabled === false,
   '㉮ ㉴ ✎(32px · «이름 짓기») → 이름 창(제목 · 아래 줄 원래 이름 · 빈칸 · 힌트 «한글 · 숫자 · 띄어쓰기로 8자까지 씁니다» · «이 이름으로»)', JSON.stringify({ c0, n0 }));
ok(!c1.탈 && c1.title === '콩이' && c1.aria === '이름 바꾸기' && /^몬스테라 · /.test(c1.sub || '') && (l1 || []).includes('✎ 몬스테라 이름을 «콩이»로 지었습니다'),
   '㉮ 이름 «콩이» → 제목 «콩이» · 아래 줄 앞 «몬스테라 · » · 기록 «✎ 몬스테라 이름을 «콩이»로 지었습니다»', JSON.stringify({ c1, l1 }));
/* ㉴ 있음 힌트 · ㉵ 까닭 넷 · 조합 */
await pen(); await sleep(500);
const h1 = await J(NK);
const bAbc = await type('abc'), bJamo = await type('ㅋㅋ'), bLong = await type('가나다라마바사아자'), bDup = await type('핑크프린세스');
/* ㉸ 꺼진 동안(같은 이름) — 반 초 지킴이가 돈 뒤 손가락 · 까닭 줄 · 단추 흐림 */
const HZ = `(()=>{ const h=document.getElementById('hint'), t=document.querySelector('.hintTarget'), p=document.getElementById('nickPanel'), g=document.getElementById('nickGo'), w=document.getElementById('nickHint');
  const on=h.classList.contains('on'); const wr=w.getBoundingClientRect(), pr=p.querySelector('.popcard') ? p.querySelector('.popcard').getBoundingClientRect() : p.getBoundingClientRect();
  const say=on ? h.querySelector('.say') : null; const sr=say ? say.getBoundingClientRect() : null;
  const ov = sr && sr.width>0 ? Math.max(0,Math.min(wr.right,sr.right)-Math.max(wr.left,sr.left))*Math.max(0,Math.min(wr.bottom,sr.bottom)-Math.max(wr.top,sr.top)) : 0;
  return { on, target: t ? (t.id || t.className) : null, inPanel: !!(t && p.contains(t)), goDisabled: g.disabled, goOpacity: +getComputedStyle(g).opacity,
           why: w.textContent, warn: w.classList.contains('warn'), whyShown: wr.width>0 && wr.height>0 && getComputedStyle(w).visibility!=='hidden' && wr.top>=pr.top && wr.bottom<=pr.bottom && wr.bottom<=innerHeight, sayOverWhy: Math.round(ov) }; })()`;
await sleep(900); const hz0 = await J(HZ);
await J(`(()=>{ const i=document.getElementById('nickInput'); i.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true})); i.value='ㅋ'; i.dispatchEvent(new InputEvent('input',{bubbles:true, isComposing:true})); return 1; })()`); await sleep(250);
const bComp = await J(NK);
await J(`(()=>{ const i=document.getElementById('nickInput'); i.value='콩'; i.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})); return 1; })()`); await sleep(250);
const bEnd = await J(NK);
await sleep(900); const hz1 = await J(HZ);   /* ㉸ 켜진 뒤 */
if (OUT) await page.shot(`${OUT}/390_f3_panel_why.png`);
console.log('  ㉵', JSON.stringify({ h1, bAbc, bJamo, bLong, bDup, bComp, bEnd }));
ok(!h1.탈 && h1.hint === '비워 두면 «몬스테라»로 돌아갑니다' && h1.value === '콩이', '㉴ 이름이 있을 때 힌트 «비워 두면 «몬스테라»로 돌아갑니다»', JSON.stringify(h1));
ok(bAbc.hint === '이름은 한글 · 숫자 · 띄어쓰기만 씁니다' && bAbc.warn && bAbc.goDisabled && bJamo.hint === 'ㄱ · ㅏ 같은 낱자는 못 씁니다' && bJamo.goDisabled
   && bDup.hint === '다른 그루가 쓰는 이름입니다' && bDup.goDisabled,
   '㉵ «abc» · «ㅋㅋ» · 같은 이름 → 까닭 줄 + 첫 단추 회색', JSON.stringify({ bAbc, bJamo, bLong, bDup }));
ok(bComp.hint === bDup.hint && bEnd.goDisabled === false && !bEnd.warn, '㉵ 조합 중(compositionstart)엔 안 잼 · compositionend 에 잼', JSON.stringify({ bComp, bEnd }));
console.log('  ㉸', JSON.stringify({ hz0, hz1 }));
ok(!hz0.탈 && hz0.goDisabled === true && !(hz0.on && hz0.inPanel) && hz0.warn && hz0.whyShown && hz0.sayOverWhy === 0 && hz0.goOpacity <= 0.5,
   `㉸ [이 이름으로]가 꺼진 동안 손가락 없음(${hz0.on ? hz0.target : '없음'}) · 까닭 줄 «${hz0.why}» 보임 · 단추 흐림 ${hz0.goOpacity}`, JSON.stringify(hz0));
ok(!hz1.탈 && hz1.goDisabled === false && hz1.target !== 'nickCancel', `㉸ 켜진 뒤 손가락이 [그만두기]가 아님(${hz1.on ? hz1.target : '없음'})`, JSON.stringify(hz1));
/* ㉶ 바꿈 */
await type('달'); await go(); const l2 = await logTail(); const c2 = await J(CARD);
ok(c2.title === '달' && (l2 || []).includes('✎ «콩이» 이름을 «달»로 바꿨습니다'), '㉶ 바꿈 기록 «✎ «콩이» 이름을 «달»로 바꿨습니다»', JSON.stringify({ c2, l2 }));
/* ㉲ ㉷ 360 */
await pen(); await sleep(400); await type('가나다라마바사아'); await go();
await W(360); await openCard('monstera', ids.pot); await sleep(800);
const c360 = await J(CARD);
await pen(); await sleep(400); const n360 = await type('ㅋㅋ'); const nl = await J(`${LINES}(document.getElementById('nickHint'))`);
if (OUT) await page.shot(`${OUT}/360_f3_card_8.png`);
await J(`(()=>{ document.getElementById('nickCancel').click(); return 1; })()`); await sleep(300);
await W(390);
console.log('  ㉲ ㉷ 360', JSON.stringify({ c360, n360, nl }));
ok(!c360.탈 && c360.title === '가나다라마바사아' && c360.tLines === 1 && c360.penIn === true && nl === 1, `㉲ ㉷ 360 — 제목(8자) 한 줄 · ✎ 같은 줄 · 까닭 줄 한 줄(제목 ${c360.tLines}줄 · ✎ ${c360.penIn} · 까닭 ${nl}줄)`, JSON.stringify({ c360, nl }));
/* ㉯ 세이브 · 다시 켜기 */
/* 이름을 붙이면 곧 저장(§commitNick saveNow) — 세이브를 지우지 않고 다시 켠다 · (총괄) 다시 켜기가 값을 안 움직이는지(8C14 «저장 → 다시 켜면 새벽»과 안 섞임) */
const VAL = `(()=>{ const S0=window.__S(); return { day: S0.day, cash: S0.tutorial && S0.tutorial.cashWon, left: S0.stamina && S0.stamina.left, max: S0.stamina && S0.stamina.max }; })()`;
const v0 = await J(VAL);
await boot(null);
await openCard('monstera', ids.pot); await sleep(600); const cR = await J(CARD); const v1 = await J(VAL);
console.log('  ㉯ 다시 켜기', JSON.stringify({ cR, v0, v1 }));
ok(!cR.탈 && cR.title === '가나다라마바사아', '㉯ 세이브 · 다시 켜기 뒤 제목 그대로', JSON.stringify(cR));
ok(!v0.탈 && !v1.탈 && v1.day === v0.day && v1.cash === v0.cash && v1.left === v0.left && v1.max === v0.max,
   '㉯ 다시 켜기 뒤 날 · 돈 · 체력이 저장 전과 같다(이름 저장이 값을 안 움직임)', JSON.stringify({ v0, v1 }));
/* ㉰ 비우기 */
await pen(); await sleep(400); const nE = await type(''); await go(); const cE = await J(CARD); const lE = await logTail();
ok(!nE.탈 && nE.go === '원래 이름으로' && cE.title === '몬스테라' && cE.aria === '이름 짓기' && (lE || []).includes('✎ «가나다라마바사아» 이름을 지웠습니다') && !(cE.sub || '').startsWith('몬스테라 · '),
   '㉰ 비우면 «원래 이름으로» → 제목 «몬스테라» · 기록 «… 이름을 지웠습니다»', JSON.stringify({ nE, cE, lE }));
/* ㉶ 삽수 · 새 종 같은 창 */
if (ids.cut) { await openCard('cutting', ids.cut); await sleep(500); await pen(); await sleep(400); await type('아기'); await go(); }
const cc = ids.cut ? await J(CARD) : null;
const sp = ids.sp[0]; if (sp) { await openCard('species', sp.id); await sleep(500); await pen(); await sleep(400); await type('분홍이'); await go(); }
const cs = sp ? await J(CARD) : null;
if (OUT) await page.shot(`${OUT}/390_f3_species_named.png`);
ok((!ids.cut || (cc && cc.title === '아기' && /삽수 \d · /.test(cc.sub || ''))) && (!sp || (cs && cs.title === '분홍이' && cs.sub.startsWith(`${{ pink_princess: '핑크프린세스', alocasia_frydek: '알로카시아' }[sp.sp] || ''} · `))),
   '㉶ 삽수 · 새 종도 같은 창 · 아래 줄 앞 원래 이름', JSON.stringify({ cc, cs }));

ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `probe_f3_nick: 빨강 ${bad}` : 'probe_f3_nick: 다 통과');
process.exit(bad ? 1 : 0);
