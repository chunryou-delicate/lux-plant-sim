/* 비판 8판 8C1 자(core 11-03 · 총괄 가름 · [plan] plan-to-core-critic8 §1 8P1 6762ca5f) — 진로 화면 [방 둘러보기] 뒤 갇힘 풀기
   ⛔ 비판 8판 BLOCKER #1(A_021 · A_025 · A_028 · A_032): 계약 → 엔딩 → 진로 화면 [방 둘러보기] → 옛 원룸 · [다음 날]은 «다음 장이 준비되면 이어집니다»만(두 번 눌러도 같음) ·
      방 · 할 일 · ? · 상태 어디에도 진로로 가는 단추 없음 · 새로 고침해야 진로 화면 복귀
      (시계 07:31 → 06:17 · 본 대사 다시 나옴은 그 «새로 고침» 탓 — 하루 시계 dayElapsed01 은 세이브에 안 담겨 다시 켜면 새벽 · 아침 대사가 다시 선다 · [방 둘러보기]는 시계를 안 돌림 — 아래 ㉮ 에서 잼)
   판: 비판 8판 ready 세이브(C:/Users/pc/AppData/Local/Temp/byeot-critic8/saves/ready_d445.json · Day 445 · 원룸 · 현금 5,063,924 · 프로필 안 건드림) → [할 일] [내 집 마련하기] → [계약한다] → 엔딩 → [다음] → 진로 화면
   단언
     ㉮ [방 둘러보기] 뒤 — [다음 날] 자리 «🏡 진로 고르기 ▸» · 할 일 칩 «🏡 진로를 골라야 다음 날로 갑니다» · 손가락 그 단추 «둘러본 뒤 여기서 진로를 고릅니다» · 시계 · 날 그대로
     ㉯ 그 단추를 누르면 진로 화면(카드 셋)이 다시 선다 · 날 그대로
     ㉰ 다시 [방 둘러보기] → 할 일 칩을 누르면 진로 화면(할 일 탭 막다른 길 아님)
     ㉱ 기록 «🏡 다음 장 — 무엇을 하며 살까» · «준비 중» 글 없음(기록 · 진로 화면 밑글)
     ㉲ [가게를 연다] 뒤 — [다음 날] 자리가 예전 [다음 날] · 칩이 진로 잠김 글 아님
     ㉳ 360 — [🏡 진로 고르기 ▸] 글이 안 잘림 · 예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-critic8/saves/ready_d445.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE)) { ok(false, '세이브 없음', SAVE); process.exit(1); }
const BTN = '🏡 진로 고르기 ▸', CHIP = '🏡 진로를 골라야 다음 날로 갑니다', FINGER = '둘러본 뒤 여기서 진로를 고릅니다';
const exc = [];
for (const W of [390, 360]) {
  const page = await launch({ width: W, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
  const dlg = async () => { for (let i = 0; i < 120; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
  const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); } };
  const ST = `(async()=>{ try { window.__byeotHint(); } catch (e) { void e; } await new Promise(r=>setTimeout(r,900)); const h=document.getElementById('hint'), t=document.querySelector('.hintTarget'), nb=document.getElementById('next');
    return { when: document.getElementById('resWhen').textContent, day: document.getElementById('resDay').textContent, chapter: document.getElementById('chapterEnd').classList.contains('on'),
      cards: document.querySelectorAll('#jobCards [data-job]').length, next: (nb.textContent||'').trim(), nextCut: nb.scrollWidth > nb.clientWidth + 1,
      chip: (document.getElementById('questChipText')||{}).textContent || '', hint: { on: h.classList.contains('on'), tid: t ? t.id || null : null, say: (h.querySelector('.say')||{}).textContent },
      sub: (document.getElementById('chapterEndSub')||{}).textContent || '', job: !!(window.__S().jobShop || window.__S().job) }; })()`;
  await dlg(); await bannerOff();
  await J(`(()=>{ window.__byeotSheet.open('quest'); return 1; })()`); await sleep(1500);
  await J(`(()=>{ const b=document.querySelector('[data-act="homeAsk"]'); if (b) b.click(); return !!b; })()`); await sleep(1200);
  await J(`(()=>{ const b=document.getElementById('homeGo'); if (b) b.click(); return !!b; })()`); await sleep(1500);
  await dlg(); await sleep(800);
  await J(`(()=>{ const b=document.getElementById('homeNext'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(2500); await dlg();
  const c0 = await J(ST);
  console.log(`  ${W} 진로 화면`, JSON.stringify(c0));
  if (W === 390) ok(!c0.탈 && c0.chapter && c0.cards >= 1 && !/준비 중/.test(c0.sub), '판 — 진로 화면(카드) · 밑글에 «준비 중» 없음', JSON.stringify({ chapter: c0.chapter, cards: c0.cards, sub: c0.sub }));
  /* ㉮ [방 둘러보기] */
  await J(`(()=>{ document.getElementById('chapterLook').click(); return 1; })()`); await sleep(1500); await dlg(); await bannerOff();
  const a = await J(ST);
  console.log(`  ㉮ ${W} 둘러보기 뒤`, JSON.stringify(a));
  if (OUT) await page.shot(`${OUT}/${W}_c8a_look.png`);
  ok(!a.탈 && !a.chapter && a.next === BTN && a.chip === CHIP && a.hint.on && a.hint.tid === 'next' && a.hint.say === FINGER && a.day === c0.day,
     `㉮ ${W} [방 둘러보기] 뒤 — [다음 날] 자리 «${BTN}» · 칩 «${CHIP}» · 손가락 «${FINGER}» · 날 그대로`, JSON.stringify({ next: a.next, chip: a.chip, hint: a.hint, day: [c0.day, a.day], when: [c0.when, a.when] }));
  if (W === 360) ok(!a.탈 && a.nextCut === false, '㉳ 360 — [🏡 진로 고르기 ▸] 글이 안 잘림', JSON.stringify({ next: a.next, cut: a.nextCut }));
  if (W === 390) {
    /* ㉯ 그 단추 */
    await J(`(()=>{ document.getElementById('next').click(); return 1; })()`); await sleep(1500);
    const b = await J(ST);
    console.log('  ㉯ 단추 누름', JSON.stringify(b));
    ok(!b.탈 && b.chapter && b.cards >= 1 && b.day === a.day, '㉯ [🏡 진로 고르기 ▸]를 누르면 진로 화면(카드)이 다시 섬 · 날 그대로', JSON.stringify({ chapter: b.chapter, cards: b.cards, day: b.day }));
    /* ㉰ 칩 */
    await J(`(()=>{ document.getElementById('chapterLook').click(); return 1; })()`); await sleep(1500); await dlg(); await bannerOff();
    await J(`(()=>{ document.getElementById('questChip').click(); return 1; })()`); await sleep(1500);
    const c = await J(ST);
    console.log('  ㉰ 칩 누름', JSON.stringify(c));
    ok(!c.탈 && c.chapter && c.cards >= 1, '㉰ 할 일 칩을 누르면 진로 화면(할 일 탭 막다른 길 아님)', JSON.stringify({ chapter: c.chapter, cards: c.cards }));
    /* ㉱ 기록 */
    const lg = await J(`(()=>{ const s=JSON.stringify(window.__S()); return { title: s.includes('🏡 다음 장 — 무엇을 하며 살까'), old: s.includes('직업 고르기(준비 중)') }; })()`);
    ok(!lg.탈 && lg.title && !lg.old, '㉱ 기록 «🏡 다음 장 — 무엇을 하며 살까» · «직업 고르기(준비 중)» 없음', JSON.stringify(lg));
    /* ㉲ [가게를 연다] */
    await J(`(()=>{ const b=document.querySelector('#jobCards [data-job="shop"]'); if (b) b.click(); return !!b; })()`); await sleep(4000); await dlg(); await sleep(1500); await dlg(); await bannerOff();
    const d = await J(ST);
    console.log('  ㉲ 가게 연 뒤', JSON.stringify(d));
    if (OUT) await page.shot(`${OUT}/390_c8a_shop.png`);
    ok(!d.탈 && !d.chapter && d.next !== BTN && /다음 날/.test(d.next) && d.chip !== CHIP, '㉲ [가게를 연다] 뒤 — [다음 날] 예전 꼴 · 칩이 진로 잠김 글 아님', JSON.stringify({ next: d.next, chip: d.chip }));
  }
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_critic8_a: 빨강 ${bad}` : 'probe_critic8_a: 다 통과');
process.exit(bad ? 1 : 0);
