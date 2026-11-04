/* 비판 7판 7C8 자(core 11-02 · 총괄 가름 · [plan] plan-to-core-critic7 §13 f0a9b8e5) — 거래 연락이 온 동안 할 일 칩 · 손가락 [상점] → [거래하기]
   ⛔ 비판 7판 S Day 94(S4_d94 · S5_shop): «📩 연락이 왔습니다 — [상점]에서 거래하세요» 알림이 손일 한 번에 걷힌 뒤 칩은 «무늬 잎 0/2», 손가락은 [다음 날],
      상점 안에서도 손가락은 [거래하기]를 안 짚음 — 남는 표시는 [상점] 주황 점뿐
   판: 비판 6판 A100 세이브(C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json · 프로필 안 건드림) — 손질: 체력 가득 · 씨앗 넉넉 · 작물은 다 자라는 중(돌봄 손가락 없음) ·
       중고 거래에 몬스테라(pot_01) 매물 — 연락 온(contacted) 하나 · ㉰ 는 둘
   단언
     ㉮ 390 — 할 일 칩 «📩 [상점]에서 거래하세요» · 손가락 기둥 [상점] «연락이 왔습니다 — 거래하러 갑니다» → [상점] 열면 손가락 [거래하기] «누르면 팔기 전에 한 번 더 묻습니다» →
        누르면 확인 창(되돌릴 수 없음 — [판다] / [그래도 판다])이 먼저 섬(돈 · 매물 그대로)
     ㉯ 360 · 시트 [식물] 탭 — ㉠ 말풍선이 두 줄 안 · 칩 · [?] 를 안 덮음
     ㉰ 연락 둘 — 손가락은 맨 위 연락 온 줄의 [거래하기] 하나
     ㉱ [내리기] 뒤 — 칩 · 손가락이 거래를 안 말함
     ㉲ 390 · 360 [거래하기]는 손만(총괄 11-03) — 손 가운데 x 가 [거래하기] 좌우 안 · 같은 줄 [내리기] 밖 · 말풍선 글 숨음
     예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_A = process.env.SAVE_A || 'C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_A)) { ok(false, '세이브 없음', SAVE_A); process.exit(1); }
const CHIP = '📩 [상점]에서 거래하세요', SAY_DOOR = '연락이 왔습니다 — 거래하러 갑니다', SAY_DEAL = '누르면 팔기 전에 한 번 더 묻습니다';
const stage = (n = 1) => { const w = JSON.parse(fs.readFileSync(SAVE_A, 'utf8')); const s = w.state;
  s.stamina.left = s.stamina.max; s.shop.stock.bean_seed = 20; s.shop.stock.radish_seed = 20;
  for (const p of s.firstPlay.beansprout.pots) if (p.slotId) Object.assign(p, { sown: true, harvested: false, ageDays: 1, startedOnDay: s.day - 1, idleSinceDay: s.day - 1 });
  for (const v of Object.values(s.firstPlay.crops || {})) for (const p of ((v && v.pots) || [])) if (p.slotId) Object.assign(p, { sown: true, harvested: false, ageDays: 1, startedOnDay: s.day - 1, idleSinceDay: s.day - 1 });
  const mk = (i, won) => ({ listingId: `mk_00${i}`, kind: 'pot', refId: 'pot_01', ko: '몬스테라', won, leaves: 3, variegatedLeaves: 1, grade: 'plain', gradeKo: '무지',
    listedOnDay: s.day - 4, contactOnDay: s.day, waitDays: 4, buyerKo: i === 1 ? '동네 이웃' : '옆 동네 사람', status: 'contacted', contactedOnDay: s.day });
  s.shop.listings = n === 2 ? [mk(1, 750000), mk(2, 700000)] : [mk(1, 750000)]; s.shop.listSeq = n;
  s.pots[0].listing = 'mk_001';
  return JSON.stringify(w); };
const exc = [];
const FRESH = process.env.FRESH !== '0';   /* ★ 11-04 — boot 마다 새 크롬(open 안) */
const open = async (W) => {
  /* ★ 11-04 — boot 마다 새 크롬(reg68: 한 크롬에서 세이브를 다시 열자 셋째 boot 무렵 렌더러 3.46GB · 빈 커밋 1.32 에서 지킴이가 닫음) · FRESH=0 이면 예전 꼴 */
  let page = null, booted = false;
  const fresh = async () => { if (page) { try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); } }
    page = await launch({ width: W, height: 844, dpr: 2 });
    page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
    await page.send('Runtime.enable');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  };
  await fresh();
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  const boot = async (txt) => {
    if (FRESH && booted) await fresh();
    booted = true;
    await page.goto(`${BASE}/data/balance/homes.json`);
    await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(txt)}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
    await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
    for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
    await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1200);
    let n = 0; for (let i = 0; i < 60 && n < 2; i++) { const b = await J(`(()=>{ try { return !!window.__rv.camBusy(); } catch (e) { return false; } })()`); n = b === false ? n + 1 : 0; await sleep(200); }
    for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) break; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); }
    await sleep(800);
  };
  const H = () => J(`(async()=>{ try { window.__byeotHint(); } catch (e) { void e; } await new Promise(r=>setTimeout(r,900));
    const rr=q=>q&&q.width?[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)]:null;
    const h=document.getElementById('hint'), t=document.querySelector('.hintTarget'), say=h.querySelector('.say'), c=document.getElementById('questChip'), cs=getComputedStyle(c);
    const lines=(()=>{ const rg=document.createRange(); rg.selectNodeContents(say); return new Set([...rg.getClientRects()].filter(q=>q.width>0).map(q=>Math.round(q.top))).size; })();
    return { on: h.classList.contains('on'), tid: t ? (t.id || null) : null, deal: t && t.dataset ? t.dataset.deal || null : null, say: say.textContent, sayR: rr(say.getBoundingClientRect()), lines,
      handR: (()=>{ const rg=document.createRange(); rg.selectNodeContents(h.querySelector('.hand')); return rr(rg.getBoundingClientRect()); })(),
      chip: (document.getElementById('questChipText')||{}).textContent || '', chipR: (cs.visibility !== 'hidden' && c.classList.contains('on')) ? rr(c.getBoundingClientRect()) : null,
      help: rr(document.getElementById('guideOpen').getBoundingClientRect()), firstDeal: (document.querySelector('#marketList [data-deal]')||{dataset:{}}).dataset.deal || null }; })()`);
  /* ★ 11-03 — 시트가 올라오는 움직임이 헤드리스 프레임 멈춤에 걸리면 [거래하기]가 «안 보임»으로 잡혀 손가락이 시트 닫기 문으로 갔다(fm58 세 번 중 한 번) ⇒ 누른 뒤 움직임을 끝 상태로 · 10×10 찍기로 프레임 한 장 */
  const settle = async () => { await J(`(()=>{ for (const a of document.getAnimations()) { try { a.finish(); } catch (e) { void e; } } return 1; })()`);
    await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 10, clip: { x: 0, y: 0, width: 10, height: 10, scale: 1 } }); await sleep(300); };
  return { page: { shot: (...a) => page.shot(...a), close: () => page.close() }, J, boot, H, settle };   /* ★ 11-04 — page 는 boot 마다 갈리니 바깥엔 «지금 page» 손잡이(바깥은 shot · close 만 씀) */
};
const ovr = (a, b) => !!a && !!b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
/* ㉲(총괄 11-03 가름 · 사진 390_c7g_deal) — [거래하기]는 «손만»: 손 가운데 x 가 [거래하기] 좌우 안 · 같은 줄 [내리기] 좌우 밖 · 말풍선 글은 숨음(handOnly)
     ⛔ 말풍선이 아래로 가 그 오른쪽 끝 밑의 손 👆 이 [내리기] 밑에 서서 [내리기]를 짚는 것으로 읽혔다(fm50 · 7C8 첫 고침) */
const HD = (J) => J(`(()=>{ const rr=q=>q&&q.width?[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)]:null; const h=document.getElementById('hint');
  const rg=document.createRange(); rg.selectNodeContents(h.querySelector('.hand')); const hq=rg.getBoundingClientRect(); const d=document.querySelector('#marketList [data-deal]'); const row=d && (d.closest('.mkRow, .shopRow, li, .row') || d.parentElement);
  const u=row ? row.querySelector('[data-unlist]') : null; const sv=getComputedStyle(h.querySelector('.say'));
  return { on: h.classList.contains('on'), handOnly: h.classList.contains('handOnly'), sayShown: sv.display !== 'none', handC: hq.width ? Math.round(hq.left + hq.width / 2) : null, hand: rr(hq), deal: rr(d && d.getBoundingClientRect()), unlist: rr(u && u.getBoundingClientRect()) }; })()`);
const handOk = (q) => !!q && !q.탈 && q.on && q.handOnly && !q.sayShown && q.handC != null && !!q.deal && !!q.unlist && q.handC > q.deal[0] && q.handC < q.deal[2] && (q.handC < q.unlist[0] || q.handC > q.unlist[2]);
/* ═══ ㉮ ㉰ ㉱ — 390 ═══ */
{
  const { page, J, boot, H, settle } = await open(390);
  await boot(stage(1));
  const a = await H();
  console.log('  ㉮ 처음', JSON.stringify(a));
  if (OUT) await page.shot(`${OUT}/390_c7g_door.png`);
  ok(!a.탈 && a.chip === CHIP, `㉮ 할 일 칩 «${CHIP}»`, JSON.stringify(a.chip));
  ok(!a.탈 && a.on && a.tid === 'navShop' && a.say === SAY_DOOR, `㉮ 손가락 기둥 [상점] «${SAY_DOOR}»`, JSON.stringify({ tid: a.tid, say: a.say }));
  await J(`(()=>{ document.getElementById('navShop').click(); return 1; })()`); await sleep(1600); await settle();
  const b = await H();
  console.log('  ㉮ 상점 연 뒤', JSON.stringify(b));
  if (OUT) await page.shot(`${OUT}/390_c7g_deal.png`);
  ok(!b.탈 && b.on && b.deal === 'mk_001' && b.say === SAY_DEAL, `㉮ 상점 탭 — 손가락 [거래하기] «${SAY_DEAL}»`, JSON.stringify({ deal: b.deal, say: b.say, tid: b.tid }));
  { const q = await HD(J); console.log('  ㉲ 390 손', JSON.stringify(q));
    ok(handOk(q), '㉲ 390 [거래하기]는 손만 — 손 가운데 x 가 [거래하기] 좌우 안 · [내리기] 좌우 밖 · 말풍선 글 숨음', JSON.stringify(q)); }
  const m0 = await J(`(()=>({ cash: window.__S().tutorial.cashWon, n: (window.__S().shop.listings||[]).length }))()`);
  await J(`(()=>{ const d=document.querySelector('#marketList [data-deal]'); if (d) d.click(); return !!d; })()`); await sleep(1500);
  const pop = await J(`(()=>{ const p=[...document.querySelectorAll('.pop.on')].pop(); const S=window.__S(); return { pop: p ? (p.innerText||'').replace(/\\s+/g,' ').slice(0,120) : null, cash: S.tutorial.cashWon, n: (S.shop.listings||[]).length }; })()`);
  console.log('  ㉮ [거래하기] 누름', JSON.stringify({ m0, pop }));
  if (OUT) await page.shot(`${OUT}/390_c7g_dealpop.png`);
  ok(!pop.탈 && !!pop.pop && /되돌릴 수 없/.test(pop.pop) && pop.cash === m0.cash && pop.n === m0.n, '㉮ [거래하기]를 누르면 확인 창이 먼저 섬(돈 · 매물 그대로)', JSON.stringify({ m0, pop }));
  await J(`(()=>{ const p=[...document.querySelectorAll('.pop.on')].pop(); const b=p && [...p.querySelectorAll('button')].find(x=>/그만|취소|닫/.test(x.textContent||'')); if (b) b.click(); return !!b; })()`); await sleep(1200);
  /* ㉰ 연락 둘 */
  await boot(stage(2));
  await J(`(()=>{ document.getElementById('navShop').click(); return 1; })()`); await sleep(1600); await settle();
  const c = await H();
  console.log('  ㉰ 연락 둘', JSON.stringify(c));
  ok(!c.탈 && c.on && !!c.firstDeal && c.deal === c.firstDeal && c.say === SAY_DEAL, '㉰ 연락 둘 — 손가락은 맨 위 연락 온 줄의 [거래하기] 하나', JSON.stringify({ deal: c.deal, first: c.firstDeal }));
  /* ㉱ [내리기] 뒤 */
  await boot(stage(1));
  await J(`(()=>{ document.getElementById('navShop').click(); return 1; })()`); await sleep(1600); await settle();
  await J(`(()=>{ const u=document.querySelector('#marketList [data-unlist]'); if (u) u.click(); return !!u; })()`); await sleep(1500);
  await J(`(()=>{ const p=[...document.querySelectorAll('.pop.on')].pop(); const b=p && [...p.querySelectorAll('button.go, button.primary')].find(x=>/내리/.test(x.textContent||'')); if (b) b.click(); return !!b; })()`); await sleep(1200);
  await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1200);
  for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) break; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); }
  const d = await H();
  const left = await J(`(window.__S().shop.listings||[]).length`);
  console.log('  ㉱ [내리기] 뒤', JSON.stringify({ left, d }));
  ok(!d.탈 && left === 0 && d.chip !== CHIP && d.say !== SAY_DOOR && d.say !== SAY_DEAL, '㉱ [내리기] 뒤 — 칩 · 손가락이 거래를 안 말함', JSON.stringify({ left, chip: d.chip, tid: d.tid, say: d.say }));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
/* ═══ ㉯ 360 · 시트 [식물] 탭 ═══ */
{
  const { page, J, boot, H, settle } = await open(360);
  await boot(stage(1));
  await J(`(()=>{ window.__byeotSheet.open('plants'); return 1; })()`); await sleep(1500); await settle();
  const e = await H();
  console.log('  ㉯ 360 식물 탭', JSON.stringify(e));
  if (OUT) await page.shot(`${OUT}/360_c7g_plants.png`);
  ok(!e.탈 && e.on && (e.tid === 'navShop' || e.tid === 'tabShop') && e.say === SAY_DOOR && e.lines <= 2 && !ovr(e.sayR, e.chipR) && !ovr(e.handR, e.chipR) && !ovr(e.sayR, e.help),
     `㉯ 360 시트 [식물] 탭 — 손가락 [상점] «${SAY_DOOR}» 두 줄 안(${e.lines}줄) · 칩 · [?] 안 덮음`, JSON.stringify({ tid: e.tid, lines: e.lines, say: e.sayR, chip: e.chipR, help: e.help }));
  await J(`(()=>{ const t=document.getElementById('tabShop'); if (t && t.offsetParent) t.click(); else document.getElementById('navShop').click(); return 1; })()`); await sleep(1600); await settle();
  const e2 = await H(); const q3 = await HD(J);
  console.log('  ㉲ 360 상점 탭', JSON.stringify({ deal: e2.deal, say: e2.say, q3 }));
  if (OUT) await page.shot(`${OUT}/360_c7g_deal.png`);
  ok(!e2.탈 && e2.deal === 'mk_001' && handOk(q3), '㉲ 360 [거래하기]는 손만 — 손 가운데 x 가 [거래하기] 좌우 안 · [내리기] 좌우 밖 · 말풍선 글 숨음', JSON.stringify({ deal: e2.deal, q3 }));
  try { await page.close(); } catch (e2) { console.log('  (탭 닫기 탈)', e2.message); }
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_critic7_g: 빨강 ${bad}` : 'probe_critic7_g: 다 통과');
process.exit(bad ? 1 : 0);
