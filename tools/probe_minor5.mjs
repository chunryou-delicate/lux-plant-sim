/* 비판 다섯째 판(72b78895) MINOR 자(core 11-01) — 390×844
   ㉮ #13 가계부 — 반찬가게 주문(D35 · Day 90~110 첫 수확)의 돈이 그 달 장부 «들어온 돈»에 줄로 선다 · «장부에 안 잡힌 것»이 그 돈만큼 뜨지 않는다
        판: 하네스 humanQ 씨앗 g Day 89 아침 세이브(probe_branches --one dumpDays · 월세 Day 91) — [다음 날] → Day 90 시루 거두기 → [다음 날] → 월세 날 가계부
   ㉯ #18 몬스테라에 물을 주면 그 그루 위로 뜨는 글자(#floats .float)가 선다(마르지 않은 날에도)
   ㉱ #16 물 셈 한 곳(목록 줄 · 자세히 · 단추) · ㉲ #12 반지하 범례 «철 따라 안 바뀜»
   ㉰ #12 빛 분포 범례 철 = [방] 판 철 — 이사 첫날(원룸 · 판: 총괄 humanQ g premove → 이사) 범례 «…겨울…» 과 [방] «겨울 N일째»
   예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE89 = process.env.SAVE89 || 'C:/Users/pc/AppData/Local/Temp/byeot-core/dumps_m5/humanQ_g_d89.json';
const SAVEMV = process.env.SAVEMV || 'C:/Users/pc/AppData/Local/Temp/byeot-master/d_66841206/humanQ/humanQ_g_premove.json';
const ONLY = process.env.ONLY || '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
/* 판마다 새 크롬 — 같은 탭에서 두 번째로 부팅하면 방뷰(__rv)가 안 서 240초를 기다리다 멎었다(11-01 · 판 A 뒤 판 B) */
let page = null;
const openPage = async () => {
  if (page) await page.close();
  page = await launch({ width: 390, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
};
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const boot = async (file) => {
  await openPage();
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(file, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
};
const banners = [];
const bannerNow = async () => { const t = await J(`(()=>{ const e=document.getElementById('event'); return e && e.classList.contains('on') ? (e.innerText||'').replace(/\\s+/g,' ').slice(0,160) : ''; })()`); if (typeof t === 'string' && t && banners[banners.length - 1] !== t) banners.push(t); return t; };
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { await bannerNow(); const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
/* 하루 넘기기 — [다음 날] · 밥상 창 · 가계부 창은 열린 그대로 돌려준다(가계부를 읽으려고) */
const nextDay = async () => {
  const d0 = await J(`window.__S().day`);
  await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } const b=document.getElementById('next'); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.click(); return 1; })()`, false);
  let month = null;
  for (let i = 0; i < 40; i++) {
    await sleep(400); await bannerNow();
    const st = await J(`(()=>({ day: window.__S().day, meal: !!(document.getElementById('mealGo')||{}).offsetParent, month: document.getElementById('monthPanel').classList.contains('on'), talking: document.getElementById('stage').classList.contains('talking') }))()`);
    if (st.month && !month) month = await J(`(()=>({ rows: (document.getElementById('monthRows')||{}).innerText || '' }))()`);
    if (st.meal) { await page.eval(`(()=>{ const g=document.getElementById('mealGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false); continue; }
    if (st.month) { await page.eval(`(()=>{ const g=document.getElementById('monthGo'); if (g && g.offsetParent) g.click(); return 1; })()`, false); continue; }
    if (st.talking) { await dlgOnly(); continue; }
    if (st.day !== d0 && i > 6) break;
  }
  await dlgOnly();
  return { day: await J(`window.__S().day`), month };
};
const floatsSeen = async (ms) => { const seen = []; const t0 = Date.now(); while (Date.now() - t0 < ms) { const f = await J(`[...document.querySelectorAll('#floats .float')].map(e=>e.textContent)`); if (Array.isArray(f)) for (const x of f) if (!seen.includes(x)) seen.push(x); await sleep(120); } return seen; };

if (!ONLY || ONLY === 'A') {
  /* ── ㉮ #13 · ㉯ #18 · ㉱ #16 · ㉲ #12 반지하 ── */
  await boot(SAVE89);
  await dlgOnly();
  const d1 = await nextDay();
  console.log('  Day 89 → ', JSON.stringify(d1));
  /* 물 셈 읽기 — [식물] 목록 줄(첫 그루) · 바닥 단추 #waterPot */
  const readWater = () => J(`(()=>{ window.__byeotSheet.open('plants'); const row=document.querySelector('#plantList .siruRow .nm small'); const b=document.getElementById('waterPot');
    return { list: row ? row.textContent : null, btn: b ? b.textContent : null, can: !!b && !b.disabled, day: window.__S().day }; })()`);
  /* 물 — 걸어가서 주는 손이라 몇 초 걸린다 · 뜨는 글자를 지켜보며 그 그루 wateredOnDay 가 오늘이 될 때까지(12초) */
  const waterNow = async () => { await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } const b=document.getElementById('waterPot'); b.style.display=''; b.click(); return 1; })()`, false);
    const seen = []; const t0 = Date.now(); let done = false;
    while (Date.now() - t0 < 12000) {
      const f = await J(`[...document.querySelectorAll('#floats .float')].map(e=>e.textContent)`); if (Array.isArray(f)) for (const x of f) if (!seen.includes(x)) seen.push(x);
      if (!done) done = await J(`(()=>{ const S=window.__S(); const p=(S.pots||[])[0]; return !!p && p.wateredOnDay === S.day; })()`) === true;
      if (done && seen.length) break;
      await sleep(150);
    }
    await sleep(600); await dlgOnly(); return { watered: done, floats: seen }; };
  const w1 = await readWater();
  let water = null, w2 = null;
  if (w1.can === true) { water = { day: w1.day, ...(await waterNow()) }; w2 = await readWater(); }
  /* ㉱ #16 — 줄 수 없는 날 목록 줄 «물은 N일 뒤» = 단추 «(N일 뒤)» · «물 준 지 d/i일» 없음 */
  const wNo = [w1, w2].find(w => w && w.can === false) || null;
  console.log('  물 셈', JSON.stringify({ w1, w2 }));
  const nList = wNo && (wNo.list || '').match(/물은 (\d+)일 뒤/), nBtn = wNo && (wNo.btn || '').match(/\((\d+)일 뒤\)/);
  ok(!!wNo && !wNo.탈 && !!nList && !!nBtn && nList[1] === nBtn[1] && !/물 준 지 \d+\/\d+일/.test(wNo.list || ''), '㉱ #16 [식물] 목록 줄 «물은 N일 뒤» = 단추 «(N일 뒤)»', JSON.stringify(wNo));
  ok(!!w2 ? /💧 물 줄 수 있습니다/.test(w1.list || '') : true, '㉱ #16 줄 수 있는 날 목록 줄 «💧 물 줄 수 있습니다»', JSON.stringify(w1));
  /* ㉱ #16 자세히 줄 «물 준 지 d일 · …» */
  await page.eval(`(()=>{ window.__byeotSheet.open('plants'); const b=document.querySelector('#plantList [data-plantzoom]'); if (b) b.click(); return 1; })()`, false);
  await sleep(900);
  const det = await J(`(()=>{ const r=[...document.querySelectorAll('#detail .row')].find(x=>/물 준 지/.test(x.textContent)); return r ? r.textContent.replace(/\\s+/g,' ').trim() : null; })()`);
  await page.eval(`(()=>{ const d=document.getElementById('dClose'); if (d) d.click(); return 1; })()`, false); await sleep(500);
  console.log('  자세히 물 줄', JSON.stringify(det));
  ok(typeof det === 'string' && /^물 준 지\s*\d+일 · (\d+일 뒤에 줄 수 있습니다|지금 줄 수 있습니다|말랐습니다)$/.test(det) && (!nBtn || !/일 뒤에/.test(det) || det.includes(`${nBtn[1]}일 뒤에`)), '㉱ #16 자세히 «물 준 지 d일 · N일 뒤에 줄 수 있습니다»(« / i» 없음 · 단추와 같은 N)', JSON.stringify(det));
  /* ㉲ #12 반지하 범례 — «철 따라 안 바뀜 · 등 n개»(맑음 · 여름 없음) */
  await page.eval(`(()=>{ window.__byeotSheet.open('plants'); const b=document.getElementById('lightHeat'); if (b) b.click(); return 1; })()`, false);
  await sleep(1500);
  await page.eval(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false);
  await sleep(1500);
  /* 범례 상자 = 줄바꿈(<br>)을 제 자식으로 가진 가장 안쪽 div · 첫 줄(첫 <br> 앞)이 몇 줄로 접히나(plan: 폭 276px 안 · 한 줄) */
  const capB = await J(`(()=>{ const ds=[...document.querySelectorAll('div')].filter(x=>x.querySelector(':scope > br') && /^빛\\s*·/.test((x.innerText||'').trim()) && /등 \\d+개/.test(x.innerText||'')); const d=ds.pop(); if (!d) return null;
    const br=d.querySelector(':scope > br'); const rg=document.createRange(); rg.setStart(d,0); rg.setEndBefore(br);
    const tops=[...new Set([...rg.getClientRects()].filter(q=>q.width>0).map(q=>Math.round(q.top)))]; const bx=d.getBoundingClientRect();
    return { t: (d.innerText||'').replace(/\\s+/g,' '), first: (d.innerText||'').split('\\n')[0], lines: tops.length, firstW: Math.round(rg.getBoundingClientRect().width), boxW: Math.round(bx.width) }; })()`);
  console.log('  반지하 범례', JSON.stringify(capB));
  if (OUT) await page.shot(`${OUT}/390_minor5_bjlight.png`);
  ok(!!capB && !capB.탈 && /철 따라 안 바뀜 · 등 \d+개/.test(capB.first) && !/여름|맑음/.test(capB.t), '㉲ #12 반지하 범례 첫 줄 «… · 철 따라 안 바뀜 · 등 n개»(맑음 · 여름 없음)', JSON.stringify(capB));
  ok(!!capB && capB.lines === 1, '㉲ #12 반지하 범례 첫 줄이 한 줄에 든다(폰 390)', JSON.stringify(capB && { lines: capB.lines, firstW: capB.firstW, boxW: capB.boxW }));
  await page.eval(`(()=>{ const b=document.getElementById('lightHeat'); if (b && /끄기/.test(b.textContent)) b.click(); return 1; })()`, false); await sleep(800);
  /* ㉮ Day 90 — 익은 시루 하나 거두기(시루 줄 단추 · 손이 누르는 그 단추) */
  const cashBefore = await J(`window.__S().tutorial.cashWon`);
  const hv = await J(`(()=>{ window.__byeotSheet.open('plants'); const b=[...document.querySelectorAll('#siruList button[data-act="harvest"]')].find(x=>!x.disabled); if (!b) return null; b.click(); return 1; })()`);
  for (let i = 0; i < 30; i++) { await bannerNow(); await sleep(300); }
  await dlgOnly();
  const after = await J(`(()=>{ const S=window.__S(); let m=null; try { m=JSON.parse(localStorage.getItem('byeot.month')); } catch (e) { m={탈:e.message}; } return { day:S.day, nb:S.tutorial.neighborOrderDay, cash:S.tutorial.cashWon, run: m && m.cur && m.cur.run ? { neighbor: m.cur.run.neighbor || 0, harvests: m.cur.run.harvests } : null }; })()`);
  console.log('  거둔 뒤', JSON.stringify({ hv, cashBefore, ...after }), '· 배너', JSON.stringify(banners.filter(b => /반찬가게/.test(b))));
  ok(hv === 1 && after.nb === after.day && !after.탈, '판 — Day 90 첫 수확에 반찬가게 주문이 났다', JSON.stringify({ hv, after }));
  /* 월세 날(Day 91)까지 — 가계부 창 · 물을 아직 못 줬으면 줄 수 있는 날 준다 */
  let month = null;
  for (let k = 0; k < 4 && !month; k++) {
    const dd = await nextDay(); if (dd.month) month = dd.month;
    if (!water) { const w = await readWater(); if (w.can === true) water = { day: w.day, ...(await waterNow()) }; }
  }
  for (let k = 0; k < 4 && !water; k++) { await nextDay(); const w = await readWater(); if (w.can === true) water = { day: w.day, ...(await waterNow()) }; }
  const rows = (month && month.rows) || '';
  console.log('  가계부', JSON.stringify(rows.replace(/\s+/g, ' ').slice(0, 600)));
  if (OUT) await page.shot(`${OUT}/390_minor5_month.png`);
  const gapM = rows.match(/장부에 안 잡힌 것\s*([−-]?[\d,]+)/);
  const gapWon = gapM ? +gapM[1].replace(/[−,-]/g, '') : 0;
  ok(!!month && /반찬가게에 판 것/.test(rows) && /^\s*200,000/.test(rows.split('반찬가게에 판 것')[1] || ''), '㉮ #13 가계부 «들어온 돈»에 «반찬가게에 판 것 200,000원»', rows.replace(/\s+/g, ' ').slice(0, 300));
  ok(!!month && gapWon < 200000, '㉮ #13 «장부에 안 잡힌 것»이 반찬가게 돈만큼 뜨지 않는다', gapM ? gapM[0] : '줄 없음');
  console.log('  몬스테라 물', JSON.stringify(water));
  ok(!!water && water.floats.some(t => /물을 줬습니다/.test(t)), '㉯ #18 몬스테라에 물을 주면 그 그루 위로 «💧 물을 줬습니다»', JSON.stringify(water));
}

if (!ONLY || ONLY === 'B') {
  /* ── ㉰ #12 이사 첫날 범례 철 ── */
  await boot(SAVEMV);
  await dlgOnly();
  /* [다음 날] 한 번 — «지난 턴»이 반지하 턴이 된다(비판 판 Day 96 과 같은 꼴: 이사 첫날 범례가 지난 턴 하늘을 읽음).
     ⚠ 세이브(Day 134 · 189만)는 이사비(200만)에 모자라다 — 하네스는 그날 채소를 팔아 채웠다(게임 손으로는 상점 팔기 여러 걸음).
       범례 셈과 무관한 돈이라 probe_d100b 와 같은 손질(이사비 + 302,780원)로 이사 문만 연다 */
  const mv0 = await nextDay();
  await J(`(()=>{ const ts=window.__S().tutorial; ts.cashWon = ts.rules.moveOutCostWon + 302780; window.__redraw(); return 1; })()`);
  const cashMv = await J(`(()=>({ day: window.__S().day, cash: window.__S().tutorial.cashWon, need: window.__S().tutorial.rules.moveOutCostWon }))()`);
  console.log('  이사 전날 →', JSON.stringify({ mv0, cashMv }));
  for (let i = 0; i < 6; i++) {
    const mv = await J(`(()=>({ moved: !!window.__S().tutorial.movedOut, panel: document.getElementById('movePanel').classList.contains('on') }))()`);
    if (mv.moved) break;
    if (mv.panel) await page.eval(`(()=>{ document.getElementById('moveGo').click(); return 1; })()`, false);
    else await page.eval(`(()=>{ window.__byeotSheet.open(); window.__byeotSheet.tab('room'); document.getElementById('moveOut').click(); return 1; })()`, false);
    await sleep(1200); await dlgOnly();
  }
  for (let i = 0; i < 20; i++) { await bannerNow(); await sleep(400); }
  await page.waitFor('!!window.__rv', 240000, 500); await sleep(2000);
  await dlgOnly();
  const room = await J(`(()=>{ window.__byeotSheet.open(); window.__byeotSheet.tab('room'); return { moved: !!window.__S().tutorial.movedOut, day: window.__S().day, season: (document.getElementById('tutSeason')||{}).textContent || '' }; })()`);
  await sleep(500);
  await page.eval(`(()=>{ window.__byeotSheet.open('plants'); const b=document.getElementById('lightHeat'); if (b) b.click(); return 1; })()`, false);
  await sleep(2500);
  const cap = await J(`(()=>{ const d=[...document.querySelectorAll('div')].find(x=>/^빛\\s*·/.test((x.innerText||'').trim()) && /등 \\d+개/.test(x.innerText||'')); return d ? (d.innerText||'').replace(/\\s+/g,' ') : null; })()`);
  console.log('  이사 첫날', JSON.stringify(room), '· 범례', JSON.stringify(cap));
  if (OUT) await page.shot(`${OUT}/390_minor5_light.png`);
  const SE = ['봄', '여름', '가을', '겨울'];
  const roomSe = SE.find(s => (room.season || '').startsWith(s));
  const capSe = SE.find(s => new RegExp(`· ${s} ·`).test(cap || ''));
  ok(!room.탈 && room.moved === true && !!roomSe, '판 — 이사했다 · [방] 판 철', JSON.stringify(room));
  ok(typeof cap === 'string' && !!capSe && capSe === roomSe, '㉰ #12 이사 첫날 빛 분포 범례 철 = [방] 판 철', JSON.stringify({ roomSe, capSe, cap }));

  /* ── ㉳ 총괄 MINOR — 원룸 배너 «🪴 빈 화분을 놓았습니다» 위에 말풍선 «들고 온 채소를 놓으세요» 글이 겹치지 않는다
        (겹치면 배너가 걷힐 때까지 글만 접힘 · 손가락은 그대로) · 손: 가구를 다 놓고(사람처럼) → 가방 빈 화분(모종포트) 칸 → [확인] ── */
  await page.eval(`(()=>{ window.__byeotSheet.open('plants'); const b=document.getElementById('lightHeat'); if (b && /끄기/.test(b.textContent)) b.click(); try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`, false);
  await sleep(800);
  for (let i = 0; i < 12; i++) {
    const uid = await J(`(()=>{ window.__byeotSheet.open('bag'); const b=document.querySelector('#bagGrid [data-furnbag]'); return b ? b.getAttribute('data-furnbag') : null; })()`);
    if (!uid || uid.탈) break;
    await page.eval(`(()=>{ const b=document.querySelector('#bagGrid [data-furnbag="${uid}"]'); if (b) b.click(); return 1; })()`, false);
    await sleep(2500); await dlgOnly();
    if (await J(`!!document.querySelector('#bagGrid [data-furnbag="${uid}"]')`) === true) break;
  }
  const potCell = await J(`(()=>{ window.__byeotSheet.open('bag'); const c=document.querySelector('#bagGrid [data-place^="monsteraSeed"]'); if (!c) return null; c.click(); return c.getAttribute('data-place'); })()`);
  let confOn = false;
  for (let i = 0; i < 10 && !confOn; i++) { await sleep(400); confOn = await J(`document.getElementById('stage').classList.contains('confirming')`) === true; }
  if (confOn) await page.eval(`(()=>{ document.getElementById('placeOk').click(); return 1; })()`, false);
  const samples = [];
  for (let i = 0; i < 16; i++) {
    await sleep(300);
    samples.push(await J(`(()=>{ const ev=document.getElementById('event'), h=document.getElementById('hint'); const s=h && h.querySelector('.say');
      const on=!!(ev && ev.classList.contains('on')), hon=!!(h && h.classList.contains('on'));
      const er=ev.getBoundingClientRect(), sr=s ? s.getBoundingClientRect() : null; const vis=!!(s && getComputedStyle(s).display!=='none' && sr && sr.width>0);
      const over=on && hon && vis && sr.left<er.right && sr.right>er.left && sr.top<er.bottom && sr.bottom>er.top;
      return { ev: on ? (ev.innerText||'').replace(/\\s+/g,' ').slice(0,40) : '', hint: hon ? ((s && s.textContent)||'').slice(0,30) : '', vis, over }; })()`));
    if (i === 3 && OUT) await page.shot(`${OUT}/390_minor5_banner.png`);
  }
  const both = samples.filter(x => x && /빈 화분/.test(x.ev || '') && x.hint);
  console.log('  빈 화분 배너', JSON.stringify({ potCell, confOn, both: both.length, over: samples.filter(x => x && x.over).length, s: samples.slice(0, 6) }));
  /* ⚠ 모종포트 칸은 확인 바 없이 바로 놓인다(비판 판 #21 «확인 없이 바로 놓임») — 확인 바는 판 조건이 아니다 */
  ok(!!potCell && !potCell.탈 && both.length > 0, '판 — 원룸 빈 화분 배너가 뜬 동안 손가락이 서 있다', JSON.stringify({ potCell, confOn, s: samples.slice(0, 4) }));
  ok(samples.every(x => x && !x.탈 && !x.over), '㉳ 배너 «🪴 빈 화분을 놓았습니다»와 말풍선 글이 겹치지 않는다(겹치면 글이 접힌다)', JSON.stringify(samples.filter(x => !x || x.탈 || x.over).slice(0, 3)));
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_minor5: 빨강 ${bad}` : 'probe_minor5: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
