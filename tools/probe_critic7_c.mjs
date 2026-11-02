/* 비판 7판 7C2 자(core 11-02 · 총괄 가름 · [plan] plan-to-core-critic7 §3 ebe8b78e) — 원룸 «밝은 칸 비우기» 고리 끊기
   ⛔ 비판 7판 S(S41 · S43_trayplace · S45): 할 일 «무순 판 하나를 옮겨 밝은 칸을 비우세요»를 따라 무순 판을 가방으로 빼면, 가방 손가락 «… 놓으세요»의
      누르기 자동 자리(§provisionalSpot)가 그 판을 방금 비운 밝은 칸에 도로 놓아 할 일이 «밝은 칸을 비우세요»로 돌아갔다(고리)
   판: 비판 6판 S Day 97 세이브(C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json · 원룸 · 프로필은 안 건드림) — 손질
     ① «비우세요» 판: 몬스테라 pot_02 를 3단 선반 1번(어둠 · 시루 crop_01_09 는 가방으로) · 창턱 1번엔 무순 판 crop_02_05 그대로(밝은 칸이 다 판으로 참)
     ② «옮기세요» 판: ① + 무순 판 crop_02_05 를 가방으로(사람이 [가방으로] 뺀 꼴 · slotId · at = null) — 창턱 1번이 밝은 빈 칸
   단언
     ㉮ ① 할 일 갈래 'clear' «무순 판 하나를 옮겨 밝은 칸을 비우세요»
     ㉯ ② 할 일 'go' «몬스테라 화분을 밝은 빈 칸으로 옮기세요»(새 글) · 그 칸 = 창턱 1번
     ㉰ ② 가방 무순 판을 누르면(자동 자리) 그 밝은 빈 칸(창턱 1번)에 안 놓는다
     ㉱ ② 손가락 [식물] → 그루 줄 [📍 자리] → 자리 고르기 창 그 칸 줄 «여기가 밝은 빈 칸입니다»
     ㉲ 360 — 그 줄 말풍선이 다른 줄 글을 안 덮는다 · 예외 0 · J 단언엔 !탈
     ㉳ 걸어서(390) — 그 줄 누름 → 화분이 그 칸 · 할 일 걷힘 → 손가락 가방 판 → 판 [확인] 뒤에도 그 칸은 화분 하나 · 할 일이 «비우세요»로 안 돌아감
     ㉴ 총괄(7C2 꼬리 · 430 · 390 · 360) — 긴 할 일 글에도 [식물] 손가락이 옆에 서고 손 · 말풍선이 다른 기둥 칸을 안 덮음 · 좁힌 칩이 [🔆 빛 분포 보기] · [?] · 배너와 겹침 0 · 두 줄 안 · 줄임표 0 ·
        손가락이 다른 데로 가면 칩이 원래 폭
     ㉵ 총괄(7C2 꼬리 · 390) — 확인 창 동안 «여기에 둘까요?» 배너 제목 한 줄 · 숨은 칩을 안 비킴 · 기둥 · [?] · 빛 분포 단추 · 손가락과 겹침 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_S = process.env.SAVE_S || 'C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_S)) { ok(false, '세이브 없음', SAVE_S); process.exit(1); }
const BRIGHT = 'oneroom-sill:0', DARK = 'banjiha-etagere:0';
const stage = (recalled) => { const w = JSON.parse(fs.readFileSync(SAVE_S, 'utf8')); const s = w.state; s.stamina.left = s.stamina.max;
  const siru = s.firstPlay.beansprout.pots.find(p => p.slotId === DARK);
  const pot = s.pots.find(p => p.id === 'pot_02');
  pot.slotId = DARK; pot.at = siru ? { ...siru.at } : pot.at;
  if (siru) { siru.slotId = null; siru.at = null; }
  if (recalled) { const t = Object.values(s.firstPlay.crops || {}).flatMap(v => (v && v.pots) || []).find(p => p.id === 'crop_02_05'); t.slotId = null; t.at = null; }
  if (recalled) s.tutorial.heatChipSeen = true;   /* ㉴ — 칩 바로 밑 [🔆 빛 분포 보기]가 선 판(총괄: 비판 7판 S 사진 판) */
  return JSON.stringify(w); };
const exc = [];
const open = async (w) => {
  const page = await launch({ width: w, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  const boot = async (txt) => {
    await page.goto(`${BASE}/data/balance/homes.json`);
    await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(txt)}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
    await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
    for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
    await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1000);
    let n = 0; for (let i = 0; i < 60 && n < 2; i++) { const b = await J(`(()=>{ try { return !!window.__rv.camBusy(); } catch (e) { return false; } })()`); n = b === false ? n + 1 : 0; await sleep(200); }
  };
  const hint = () => J(`(async()=>{ try { window.__byeotHint(); } catch (e) { void e; } await new Promise(r=>setTimeout(r,900)); const h=document.getElementById('hint'), t=document.querySelector('.hintTarget');
    return { on: h.classList.contains('on'), tid: t ? t.id || null : null, slot: t && t.dataset ? t.dataset.slot || null : null, where: t && t.dataset ? t.dataset.plantwhere || null : null, say: (h.querySelector('.say')||{}).textContent,
             sayR: (()=>{ const q=h.querySelector('.say').getBoundingClientRect(); return [Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)]; })() }; })()`);
  return { page, J, boot, hint };
};
/* ═══ ㉮ ① 비우세요 판 ═══ */
{
  const { page, J, boot } = await open(390);
  await boot(stage(false));
  const pd = await J(`window.__byeotPotDark ? window.__byeotPotDark() : null`);
  console.log('  ㉮ ① 판', JSON.stringify(pd));
  ok(!!pd && !pd.탈 && pd.kind === 'clear' && pd.ko === '무순 판 하나를 옮겨 밝은 칸을 비우세요', '㉮ ① 할 일 «무순 판 하나를 옮겨 밝은 칸을 비우세요»(밝은 칸이 다 판으로 참)', JSON.stringify(pd));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
/* ═══ ㉯ ㉰ ㉱ ② 옮기세요 판 ═══ */
const NAV = `(()=>{ const h=document.getElementById('hint'), c=document.getElementById('questChip'), sp=c.querySelector('span');
  const rr=e=>{ if(!e) return null; const q=e.getBoundingClientRect(); if(!q.width) return null; const cs=getComputedStyle(e); if (cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return null; return [Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)]; };
  const lh = parseFloat(getComputedStyle(sp).lineHeight) || 15.5, ev=document.getElementById('event');
  const others = [...document.querySelectorAll('#navbar button')].filter(b => b.id !== 'navPlants').map(b => ({ id: b.id, r: rr(b) })).filter(x => x.r);
  return { cls: h.className, navSide: h.classList.contains('navSide'), say: rr(h.querySelector('.say')), hand: rr(h.querySelector('.hand')), tr: rr(document.getElementById('navPlants')),
    chip: rr(c), chipMax: getComputedStyle(c).maxWidth, chipW: Math.round(c.getBoundingClientRect().width), lines: Math.round(sp.getBoundingClientRect().height / lh), clipped: sp.scrollHeight > sp.clientHeight + 1,
    heat: rr(document.getElementById('lightHeatOff')), help: rr(document.getElementById('guideOpen')), ev: ev && ev.classList.contains('on') ? rr(ev) : null, others,
    /* 낱말 안 꺾임 — 낱말마다 Range 줄 네모가 둘 이상이면 그 낱말이 두 줄에 걸쳤다 · 말풍선 줄 수 */
    split: (()=>{ const s=h.querySelector('.say'), tn=s.firstChild; if (!tn || tn.nodeType !== 3) return []; const t=tn.textContent, out=[]; let i=0;
      for (const wd of t.split(' ')) { if (wd) { const rg=document.createRange(); rg.setStart(tn, i); rg.setEnd(tn, i + wd.length); const n=[...rg.getClientRects()].filter(q=>q.width>0).length; if (n > 1) out.push(wd); } i += wd.length + 1; }
      return out; })(),
    sayLines: (()=>{ const s=h.querySelector('.say'); const rg=document.createRange(); rg.selectNodeContents(s); return new Set([...rg.getClientRects()].filter(q=>q.width>0).map(q=>Math.round(q.top))).size; })() }; })()`;
const ovr = (a, b) => !!a && !!b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
for (const w of [430, 390, 360]) {
  const { page, J, boot, hint } = await open(w);
  await boot(stage(true));
  const pd = await J(`window.__byeotPotDark ? window.__byeotPotDark() : null`);
  if (w === 390) {
    console.log('  ㉯ ② 판', JSON.stringify(pd));
    ok(!!pd && !pd.탈 && pd.kind === 'go' && pd.ko === '몬스테라 화분을 밝은 빈 칸으로 옮기세요', '㉯ ② 할 일 «몬스테라 화분을 밝은 빈 칸으로 옮기세요»', JSON.stringify(pd));
    /* ㉰ 가방 무순 판 누르기 — 자동 자리 */
    await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1500);
    const tap = await J(`(()=>{ const c=document.querySelector('#pageBag .bagslot[data-place="musun"]') || document.querySelector('.bagslot[data-place="musun"]'); if (!c) return { 없음: true }; c.click(); return { 누름: true }; })()`);
    await sleep(1800);
    const placed = await J(`(()=>{ const S=window.__S(); const t=Object.values(S.firstPlay.crops||{}).flatMap(v=>(v&&v.pots)||[]).find(p=>p.id==='crop_02_05'); return { slot: t ? t.slotId : null, confirming: document.getElementById('stage').classList.contains('confirming') }; })()`);
    console.log('  ㉰ 가방 무순 판 누름', JSON.stringify({ tap, placed }));
    if (OUT) await page.shot(`${OUT}/390_c7c_trayplace.png`);
    /* ㉵ 총괄(7C2 꼬리 · c_fix5/390_c7c_trayplace) — 확인 창 동안 «여기에 둘까요?» 배너: 제목 한 줄 · 숨은 칩을 안 비킴(폭) · 보이는 것(기둥 · [?] · 빛 분포 단추 · 손가락)과 겹침 0 */
    const bn = await J(`(()=>{ const rr=e=>{ if(!e) return null; const cs=getComputedStyle(e); if (cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<0.05) return null; const q=e.getBoundingClientRect(); if(!q.width) return null; return [Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)]; };
      const ev=document.getElementById('event'), b=ev.querySelector('b'), tn=b ? [...b.childNodes].find(n=>n.nodeType===3 && n.textContent.trim()) : null;
      const tl = tn ? (()=>{ const rg=document.createRange(); rg.selectNodeContents(tn); return new Set([...rg.getClientRects()].filter(q=>q.width>0).map(q=>Math.round(q.top))).size; })() : null;
      const handR = (()=>{ const h=document.getElementById('hint'); if (!h.classList.contains('on')) return null; const rg=document.createRange(); rg.selectNodeContents(h.querySelector('.hand')); const q=rg.getBoundingClientRect(); return q.width>1 ? [Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)] : null; })();
      const cb = document.getElementById('questChip').getBoundingClientRect();   /* 숨은 칩의 자리(배치는 남는다) — 배너가 이 왼쪽 끝에 묶이면 «숨은 것을 비킨» 것 */
      return { on: ev.classList.contains('on'), title: tn ? tn.textContent.trim() : null, titleLines: tl, ev: rr(ev), chip: rr(document.getElementById('questChip')), chipBox: cb.width ? [Math.round(cb.left),Math.round(cb.top),Math.round(cb.right),Math.round(cb.bottom)] : null,
        nav: rr(document.getElementById('navbar')), help: rr(document.getElementById('guideOpen')), heat: rr(document.getElementById('lightHeatOff')), say: rr(document.querySelector('#hint.on .say')), hand: handR }; })()`);
    console.log('  ㉵ 확인 창 배너', JSON.stringify(bn));
    const bw = bn.ev ? bn.ev[2] - bn.ev[0] : 0;
    ok(!bn.탈 && bn.on && bn.title === '여기에 둘까요?' && bn.titleLines === 1 && !bn.chip && !!bn.chipBox && !!bn.ev && bn.ev[2] > bn.chipBox[0] + 8, '㉵ 확인 창 동안 배너 제목 «여기에 둘까요?» 한 줄 · 숨은 할 일 칩을 안 비킴(배너 오른쪽 끝이 숨은 칩 왼쪽 끝을 넘는다)', JSON.stringify({ title: bn.title, lines: bn.titleLines, ev: bn.ev, w: bw, chip: bn.chip, chipBox: bn.chipBox }));
    ok(!bn.탈 && !!bn.ev && ![bn.nav, bn.help, bn.heat, bn.say, bn.hand].some(o => ovr(bn.ev, o)), '㉵ 배너가 기둥 · [?] · [🔆 빛 분포 보기] · 손가락과 겹침 0', JSON.stringify(bn));
    ok(!placed.탈 && !tap.없음 && !!placed.slot && placed.slot !== 'oneroom-sill:0', '㉰ 가방 무순 판을 누르면 그 밝은 빈 칸(창턱 1번)에 안 놓는다(자동 자리)', JSON.stringify({ tap, placed }));
    /* [취소]로 가방에 되돌림 */
    await J(`(()=>{ const b=document.getElementById('placeCancel'); if (b && b.offsetParent) b.click(); return 1; })()`); await sleep(1200);
    await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1000);
    /* [취소] 배너가 걷힐 때까지(배너가 뜬 동안은 칩이 숨고 말풍선 글이 접힌다 — ㉴ 를 그 판에서 재지 않게 · 누르면 닫힘) */
    for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) break; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(500); }
    await sleep(1200);
  }
  /* ㉱ 손가락 사슬 [식물] → [📍 자리] → 그 칸 줄 */
  const h1 = await hint();
  /* ㉴ 총괄(7C2 꼬리 · c3_dark) — [식물] 손가락이 옆에 서고 · 손 · 말풍선이 다른 기둥 칸을 안 덮고 · 좁힌 칩이 빛 분포 · [?] · 배너와 안 겹치고 · 두 줄 안 · 줄임표 0 */
  const n1 = await J(NAV);
  console.log(`  ㉴ ${w} [식물] 손가락 · 칩`, JSON.stringify(n1));
  if (OUT) await page.shot(`${OUT}/${w}_c7c_navfinger.png`);
  ok(!n1.탈 && h1.tid === 'navPlants' && /side/.test(n1.cls) && /toRight/.test(n1.cls) && !!n1.say && !!n1.tr && n1.say[1] < n1.tr[3] && n1.say[3] > n1.tr[1], `㉴ ${w} [식물] 손가락이 옆(가로)에서 짚는다(말풍선이 그 칸 높이 안)`, JSON.stringify({ tid: h1.tid, cls: n1.cls, say: n1.say, tr: n1.tr }));
  ok(!n1.탈 && !(n1.others || []).some(o => ovr(n1.say, o.r) || ovr(n1.hand, o.r)), `㉴ ${w} 손 · 말풍선이 [상점] · [방] 등 다른 기둥 칸을 안 덮는다`, JSON.stringify((n1.others || []).filter(o => ovr(n1.say, o.r) || ovr(n1.hand, o.r)).map(o => o.id)));
  ok(!n1.탈 && !!n1.chip && !ovr(n1.say, n1.chip), `㉴ ${w} 말풍선이 할 일 칩을 안 덮는다`, JSON.stringify({ say: n1.say, chip: n1.chip }));
  ok(!n1.탈 && Array.isArray(n1.split) && n1.split.length === 0, `㉴ ${w} 말풍선 «여기서 화분 자리를 옮깁니다» 낱말 안 꺾임 없음(${n1.sayLines}줄)`, JSON.stringify({ split: n1.split, lines: n1.sayLines }));
  ok(!n1.탈 && !!n1.chip && !!n1.heat && !ovr(n1.chip, n1.heat) && !ovr(n1.chip, n1.help) && !ovr(n1.chip, n1.ev) && n1.lines <= 2 && !n1.clipped,
     `㉴ ${w} 칩이 [🔆 빛 분포 보기] · [?] · 배너와 겹침 0 · 글 ${n1.lines}줄 · 줄임표 0`, JSON.stringify({ chip: n1.chip, max: n1.chipMax, heat: n1.heat, help: n1.help, ev: n1.ev, lines: n1.lines, clipped: n1.clipped, navSide: n1.navSide }));
  await J(`(()=>{ window.__byeotSheet.open('plants'); return 1; })()`); await sleep(1500);
  const h2 = await hint();
  const n2 = await J(NAV);
  console.log(`  ㉴ ${w} 손가락이 다른 데로 간 뒤 칩`, JSON.stringify({ tid: h2.tid, where: h2.where, navSide: n2.navSide, chipMax: n2.chipMax, chipW: n2.chipW, lines: n2.lines }));
  ok(!n2.탈 && h2.tid !== 'navPlants' && !n2.navSide && n2.chipMax !== '156px', `㉴ ${w} 손가락이 다른 데로 가면 칩이 원래 폭(좁힘 풀림)`, JSON.stringify({ tid: h2.tid, navSide: n2.navSide, chipMax: n2.chipMax, chipW: n2.chipW, before: n1.chipW }));
  await J(`(()=>{ const b=document.querySelector('[data-plantwhere="pot_02"]'); if (b) b.click(); return !!b; })()`); await sleep(1500);
  const h3 = await hint();
  const rows = await J(`[...document.querySelectorAll('#slotList [data-slot]')].map(b=>{ const q=b.getBoundingClientRect(); const sm=(b.querySelector('small')||b).getBoundingClientRect(); return { s: b.dataset.slot, r:[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)], txt:[Math.round(sm.left),Math.round(sm.top),Math.round(sm.right),Math.round(sm.bottom)] }; })`);
  console.log(`  ㉱ ${w} 사슬`, JSON.stringify({ h1: [h1.tid, h1.say], h2: [h2.tid, h2.where, h2.say], h3 }));
  if (OUT) await page.shot(`${OUT}/${w}_c7c_where.png`);
  if (w === 390) {
    ok(!h1.탈 && h1.on && h1.tid === 'navPlants' && h1.say === '여기서 화분 자리를 옮깁니다', '㉱ 손가락 [식물] «여기서 화분 자리를 옮깁니다»', JSON.stringify(h1));
    ok(!h2.탈 && h2.on && h2.where === 'pot_02' && h2.say === '누르면 옮길 자리를 고릅니다', '㉱ 손가락 그루 줄 [📍 자리] «누르면 옮길 자리를 고릅니다»', JSON.stringify(h2));
  }
  ok(!h3.탈 && h3.on && h3.slot === 'oneroom-sill:0' && h3.say === '여기가 밝은 빈 칸입니다', `㉱ ${w} 자리 고르기 창 그 칸 줄(창턱 1번) «여기가 밝은 빈 칸입니다»`, JSON.stringify(h3));
  const ov = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  const others = (rows || []).filter(x => x.s !== 'oneroom-sill:0');
  ok(!h3.탈 && Array.isArray(rows) && !others.some(o => ov(h3.sayR, o.txt)), `㉲ ${w} 그 줄 말풍선이 다른 줄 글을 안 덮는다`, JSON.stringify({ say: h3.sayR, hits: others.filter(o => ov(h3.sayR, o.txt)).map(o => o.s) }));
  if (w === 390) {
    /* ㉳ 걸어서 — 그 줄을 누르면 화분이 그 칸으로 · 할 일 줄 걷힘 → 손가락이 가방 판 → 판을 눌러 [확인] 해도 그 칸에 안 겹치고 할 일이 «비우세요»로 안 돌아간다(고리 없음) */
    await J(`(()=>{ const b=document.querySelector('#slotList [data-slot="oneroom-sill:0"]'); if (b) b.click(); return !!b; })()`);
    let mv = null; for (let i = 0; i < 40; i++) { mv = await J(`(()=>{ const p=window.__S().pots.find(x=>x.id==='pot_02'); return { slot: p.slotId, pd: window.__byeotPotDark() }; })()`); if (mv && mv.slot === BRIGHT) break; await sleep(300); }
    await sleep(1500);
    console.log('  ㉳ 줄 누른 뒤', JSON.stringify(mv));
    ok(!!mv && !mv.탈 && mv.slot === BRIGHT && mv.pd === null, '㉳ 그 줄을 누르면 몬스테라가 창턱 1번으로 · 어두운 화분 할 일 걷힘', JSON.stringify(mv));
    await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1200);
    const h4 = await hint();
    console.log('  ㉳ 다음 손가락', JSON.stringify([h4.tid, h4.say]));
    ok(!h4.탈 && h4.on && /놓/.test(h4.say || ''), '㉳ 다음 손가락은 가방 판 놓기', JSON.stringify([h4.tid, h4.say]));
    await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1500);
    const tap2 = await J(`(()=>{ const c=document.querySelector('.bagslot[data-place="musun"]'); if (!c) return { 없음: true }; c.click(); return { 누름: true }; })()`);
    await sleep(1800);
    await J(`(()=>{ const b=document.getElementById('placeOk'); if (b && b.offsetParent) b.click(); return !!b; })()`); await sleep(2000);
    const end = await J(`(()=>{ const S=window.__S(); const t=Object.values(S.firstPlay.crops||{}).flatMap(v=>(v&&v.pots)||[]).find(p=>p.id==='crop_02_05'); const p=S.pots.find(x=>x.id==='pot_02');
      const same = (S.pots||[]).concat(Object.values(S.firstPlay.crops||{}).flatMap(v=>(v&&v.pots)||[]), S.firstPlay.beansprout.pots||[]).filter(x=>x && x.slotId==='oneroom-sill:0').map(x=>x.id);
      return { tray: t ? t.slotId : null, pot: p.slotId, onBright: same, pd: window.__byeotPotDark() }; })()`);
    console.log('  ㉳ 판 놓은 뒤', JSON.stringify({ tap2, end }));
    if (OUT) await page.shot(`${OUT}/390_c7c_walked.png`);
    ok(!end.탈 && !tap2.없음 && !!end.tray && end.tray !== BRIGHT && end.pot === BRIGHT && end.onBright.length === 1 && end.pd === null, '㉳ 판을 놓아도 창턱 1번은 몬스테라 하나 · 할 일이 «비우세요»로 안 돌아감(고리 없음)', JSON.stringify(end));
  }
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_critic7_c: 빨강 ${bad}` : 'probe_critic7_c: 다 통과');
process.exit(bad ? 1 : 0);
