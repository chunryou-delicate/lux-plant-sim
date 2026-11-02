/* 비판 6판 넷째 묶음 꼬리 자(core 11-02 · 총괄 덤 ③ ② · [plan] §19 cc0556b1) — [식물] 창이 돌봄 점을 가렸을 때 창 안 «같은 손» 줄 단추를 짚나
   ⛔ [식물] 창을 열어 시루 판을 보는 중, 익은 시루 [🥣 거두기] 줄이 보이는데 손가락은 기둥 [식물] «한 번 더 누르면 닫힙니다»를 짚었다(사람 판에서도 · core 잼 11-02)
   판: 비판 6판 A100 세이브(C:/Users/pc/byeot-core-keep/critic6/ · 프로필은 안 건드림) — 손질: 체력 가득 · 콩나물 시루 셋 익힘(crop_01_03 · 04 · 05 · ageDays 6)
   손: [식물] 창은 __byeotSheet.open('plants')(기둥 [식물]과 같은 문) · 줄은 사람처럼 굴려 보이게(scrollIntoView) · 손가락은 __byeotHint() 로 다시 묻는다
   단언(총괄 다섯 · plan §19 잴 차례)
     ㉮ 390 — 익은 줄이 굴림 칸 밖(창을 막 연 판)이면 예전처럼 «닫는 문»(기둥 [식물] · «한 번 더 누르면 닫힙니다») · 창은 안 굴린다
     ㉯ 390 — 익은 줄을 굴려 보이게 하면 손이 창 안 [🥣 거두기]에 닿고 말은 «여기서도 거둘 수 있습니다»(창 밖 기둥 [식물]이 아님) · 맨 위에 보이는 줄
     ㉰ 390 — 그 단추를 누르면 손가락이 그 자리에 멎지 않는다(다음 익은 줄 · 다른 할 일)
     ㉱ 390 — 창을 닫으면 방 안 표지 «거둘 때가 됐습니다»
     ㉲ 360 — 같은 판에서 말풍선이 두 줄 안 · 낱말 안 꺾임 없음 · 화면 안
     ㉳ 넓은 화면(1990×1188 · 옆 시트) — 점이 안 가려 지금처럼 방 안 표지(창 안 줄 단추가 아님)
     ㉴ 체력 0 — 줄 단추를 안 짚는다 · ㉵ 글 셋(손잡이)
     ㉶ [plan] §20 ㉠(총괄) — 심기 갈래는 그 줄 작물 씨앗이 있는 줄만: 손질(무 씨앗 0 · 콩 씨앗 2 · 콩나물 crop_01_01 심을 차례 · 무순 crop_02_05 안 심음)에서
        무순 줄을 굴려 보이고 콩나물 줄은 화면 밖 → 무순 [🌱 심기]를 안 짚고 «닫는 문» · 콩나물 줄을 굴려 보이면 그 [🌱 심기]
        ⛔ 줄 단추를 «꺼지지 않음»으로만 걸러, 씨앗 0 인 무순 [🌱 심기](안 심은 줄은 씨앗 0 에도 안 꺼짐)를 «여기서도 심을 수 있습니다»로 짚었다(누르면 «⚠ 안 됐습니다»)
   예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_A = process.env.SAVE_A || 'C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_A)) { ok(false, '세이브 없음', SAVE_A); process.exit(1); }
const RIPE = ['crop_01_03', 'crop_01_04', 'crop_01_05'];
const stage = (staminaLeft) => { const w = JSON.parse(fs.readFileSync(SAVE_A, 'utf8')); const s = w.state;
  s.stamina.left = staminaLeft == null ? s.stamina.max : staminaLeft;
  for (const p of s.firstPlay.beansprout.pots) if (RIPE.includes(p.id)) { p.ageDays = 6; p.startedOnDay = s.day - 6; p.sown = true; p.harvested = false; }
  return JSON.stringify(w); };
const exc = [];
const open = async (w, h = 844, dpr = 2) => {
  const page = await launch({ width: w, height: h, dpr });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  const boot = async (txt) => {
    await page.goto(`${BASE}/data/balance/homes.json`);
    await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(txt)}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
    await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
    for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
  };
  return { page, J, boot };
};
/* 손가락 잼 — 짚는 것 · 말 · 손과 짚는 것 사이 틈 · 말풍선 줄 수 · 낱말 안 꺾임 */
const HINT = `(()=>{ const R=q=>[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)]; const h=document.getElementById('hint'); const t=document.querySelector('.hintTarget');
  if (!h || !h.classList.contains('on') || !t) return { on:false, t: t ? (t.id || t.className) : null };
  const say=h.querySelector('.say'); const rg=document.createRange(); rg.selectNodeContents(h.querySelector('.hand')); const hq=rg.getBoundingClientRect(), tq=t.getBoundingClientRect(), sq=say.getBoundingClientRect();
  const gap=Math.max(0, tq.left-hq.right, hq.left-tq.right, tq.top-hq.bottom, hq.top-tq.bottom);
  const tn=say.firstChild; const breaks=[]; let rows=0;
  if (tn && tn.nodeType===3) { const s=tn.textContent; const r1=document.createRange(); let prev=null; for (let i=0;i<s.length;i++) { r1.setStart(tn,i); r1.setEnd(tn,i+1); const q=r1.getBoundingClientRect(); if (!q.width) continue; const m=q.top+q.height/2; if (prev==null) rows=1; else if (m-prev>8) { rows++; breaks.push([s[i-1]||'', s[i]]); } prev=m; } }
  return { on:true, tid: t.id || null, tcls: (t.className||'').toString().slice(0,40), act: t.dataset ? (t.dataset.act || (t.dataset.plantwater ? 'plantwater' : null) || (t.dataset.sow ? 'sow-pot' : null)) : null, siru: t.dataset ? t.dataset.siru || null : null,
    inSheet: !!document.getElementById('sheet').contains(t), isMark: !!(t.classList && t.classList.contains('mark')), say: say.textContent, gap: Math.round(gap), rows, breaks, sayR: R(sq), iw: innerWidth }; })()`;
const reHint = async (J) => { await J(`(()=>{ try { window.__byeotHint(); } catch (e) { void e; } return 1; })()`); await sleep(900); return J(HINT); };
const DOOR = '한 번 더 누르면 닫힙니다', ROW = '여기서도 거둘 수 있습니다', MARK = '거둘 때가 됐습니다';
/* 익은 시루 줄 [거두기]를 사람처럼 굴려 보이게 — 맨 위 익은 줄 */
const scrollRipe = (J) => J(`(()=>{ const b=[...document.querySelectorAll('#siruList button[data-act="harvest"]')][0]; if (!b) return false; b.scrollIntoView({ block: 'center' }); return true; })()`);

/* ═══ ㉮ ~ ㉱ 390 ═══ */
{
  const { page, J, boot } = await open(390);
  await boot(stage());
  await J(`(()=>{ window.__byeotSheet.open('plants'); return 1; })()`); await sleep(1500);
  /* 창을 막 연 판 — 굴림 칸을 맨 위로(익은 줄은 화면 밖) */
  await J(`(()=>{ const sb=document.getElementById('sheetbody'); if (sb) sb.scrollTop = 0; return 1; })()`); await sleep(500);
  const vis0 = await J(`[...document.querySelectorAll('#siruList button[data-act="harvest"]')].map(b=>{ const q=b.getBoundingClientRect(); const c=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2); return !!(q.width && q.top>=0 && q.bottom<=innerHeight && c && (c===b||b.contains(c))); })`);
  const a0 = await reHint(J);
  console.log('  ㉮ 창 막 연 판', JSON.stringify({ vis0, a0 }));
  if (OUT) await page.shot(`${OUT}/390_c6f_door.png`);
  ok(!a0.탈 && Array.isArray(vis0) && vis0.length >= 1 && !vis0.some(Boolean) && a0.on && a0.tid === 'navPlants' && a0.say === DOOR, '㉮ 익은 줄이 화면 밖이면 예전처럼 «닫는 문»(기둥 [식물] · «한 번 더 누르면 닫힙니다»)', JSON.stringify({ vis0, tid: a0.tid, say: a0.say }));
  /* 굴려 보이게 */
  await scrollRipe(J); await sleep(700);
  const a1 = await reHint(J);
  console.log('  ㉯ 줄을 굴려 보인 판', JSON.stringify(a1));
  if (OUT) await page.shot(`${OUT}/390_c6f_row.png`);
  ok(!a1.탈 && a1.on && a1.inSheet && a1.act === 'harvest' && RIPE.includes(a1.siru) && a1.say === ROW && a1.gap <= 14, '㉯ 손이 창 안 [🥣 거두기]에 닿고 «여기서도 거둘 수 있습니다»(창 밖 기둥 [식물] 아님)', JSON.stringify({ tid: a1.tid, act: a1.act, siru: a1.siru, say: a1.say, gap: a1.gap }));
  const top = await J(`(()=>{ const vis=[...document.querySelectorAll('#siruList button[data-act="harvest"]')].filter(b=>{ const q=b.getBoundingClientRect(); const c=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2); return q.width && q.top>=0 && q.bottom<=innerHeight && c && (c===b||b.contains(c)); }); vis.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top); return vis.length ? vis[0].dataset.siru : null; })()`);
  ok(!a1.탈 && a1.siru === top, '㉯ 익은 줄이 여럿이면 화면에서 맨 위에 보이는 줄', JSON.stringify({ hint: a1.siru, top }));
  ok(!a1.탈 && a1.on && a1.rows >= 1 && a1.rows <= 2 && a1.breaks.every(([x, y]) => /\s/.test(x) || /\s/.test(y)) && a1.sayR[0] >= 0 && a1.sayR[2] <= a1.iw, '㉯ 390 말풍선 두 줄 안 · 낱말 안 꺾임 없음 · 화면 안', JSON.stringify({ rows: a1.rows, breaks: a1.breaks, sayR: a1.sayR }));
  /* 누르면 멎지 않음 */
  const pressed = a1.siru || top;   /* 작업 전 판(손가락이 줄을 안 짚음)에서도 다음 단언까지 가게 — 맨 위 줄을 누름 */
  await J(`(()=>{ const b=document.querySelector('#siruList button[data-siru="${pressed}"][data-act="harvest"]'); if (b) b.click(); return !!b; })()`);
  for (let i = 0; i < 40; i++) { const r = await J(`!!(window.__S().firstPlay.beansprout.pots.find(p=>p.id==='${pressed}')||{}).harvested`); if (r === true) break; await sleep(300); }
  for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
  await sleep(1500); await scrollRipe(J); await sleep(700);
  const a2 = await reHint(J);
  console.log('  ㉰ 누른 뒤', JSON.stringify(a2));
  if (OUT) await page.shot(`${OUT}/390_c6f_after.png`);
  ok(!a2.탈 && a2.on && !(a2.act === 'harvest' && a2.siru === pressed), '㉰ 누른 뒤 손가락이 그 자리에 멎지 않는다(다음 익은 줄 · 다른 할 일)', JSON.stringify({ pressed, now: { tid: a2.tid, act: a2.act, siru: a2.siru, say: a2.say } }));
  /* 창을 닫으면 방 안 표지 */
  await J(`(()=>{ window.__byeotSheet.close(); return 1; })()`); await sleep(1500);
  const a3 = await reHint(J);
  console.log('  ㉱ 창 닫은 뒤', JSON.stringify(a3));
  ok(!a3.탈 && a3.on && a3.isMark && a3.say === MARK, '㉱ 창을 닫으면 방 안 표지 «거둘 때가 됐습니다»', JSON.stringify({ tcls: a3.tcls, say: a3.say }));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
/* ═══ ㉲ 360 ═══ */
{
  const { page, J, boot } = await open(360);
  await boot(stage());
  await J(`(()=>{ window.__byeotSheet.open('plants'); return 1; })()`); await sleep(1500);
  await scrollRipe(J); await sleep(700);
  const b1 = await reHint(J);
  console.log('  ㉲ 360', JSON.stringify(b1));
  if (OUT) await page.shot(`${OUT}/360_c6f_row.png`);
  ok(!b1.탈 && b1.on && b1.inSheet && b1.act === 'harvest' && b1.say === ROW && b1.rows >= 1 && b1.rows <= 2 && b1.breaks.every(([x, y]) => /\s/.test(x) || /\s/.test(y)) && b1.sayR[0] >= 0 && b1.sayR[2] <= b1.iw,
     '㉲ 360 줄 단추 «여기서도 거둘 수 있습니다» — 두 줄 안 · 낱말 안 꺾임 없음 · 화면 안', JSON.stringify({ act: b1.act, say: b1.say, rows: b1.rows, breaks: b1.breaks, sayR: b1.sayR }));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
/* ═══ ㉳ 넓은 화면 ═══ */
{
  const { page, J, boot } = await open(1990, 1188, 1);
  await boot(stage());
  await J(`(()=>{ try { window.__byeotSheet.open('plants'); } catch (e) { void e; } return 1; })()`); await sleep(1500);
  const w1 = await reHint(J);
  console.log('  ㉳ 넓은 화면', JSON.stringify(w1));
  if (OUT) await page.shot(`${OUT}/1990_c6f_wide.png`);
  ok(!w1.탈 && w1.on && w1.isMark && !w1.inSheet && w1.say === MARK, '㉳ 넓은 화면(옆 시트)은 지금처럼 방 안 표지 «거둘 때가 됐습니다»(창 안 줄 단추 아님)', JSON.stringify({ tcls: w1.tcls, inSheet: w1.inSheet, say: w1.say }));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
/* ═══ ㉴ 체력 0 · ㉵ 글 셋 ═══ */
{
  const { page, J, boot } = await open(390);
  await boot(stage(0));
  await J(`(()=>{ window.__byeotSheet.open('plants'); return 1; })()`); await sleep(1500);
  await scrollRipe(J); await sleep(700);
  const z = await reHint(J);
  console.log('  ㉴ 체력 0', JSON.stringify(z));
  ok(!z.탈 && !(z.on && z.inSheet && /^(harvest|water|plant|sow)$/.test(z.act || '')), '㉴ 체력 0 이면 창 안 줄 단추를 안 짚는다', JSON.stringify({ on: z.on, tid: z.tid, act: z.act, say: z.say }));
  const ko = await J(`window.__byeotSheetRowKo || null`);
  ok(!ko || !ko.탈, '㉵ 손잡이', JSON.stringify(ko));
  ok(!!ko && ko.harvest === '여기서도 거둘 수 있습니다' && ko.water === '여기서도 물을 줄 수 있습니다' && ko.sow === '여기서도 심을 수 있습니다', '㉵ 글 셋([plan] §19)', JSON.stringify(ko));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
/* ═══ ㉶ 심기 갈래 — 그 줄 작물 씨앗(§markLive «심»과 같은 문) ═══ */
{
  const w = JSON.parse(fs.readFileSync(SAVE_A, 'utf8')); const s = w.state;
  s.stamina.left = s.stamina.max; s.shop.stock.bean_seed = 2; s.shop.stock.radish_seed = 0;
  const b1 = s.firstPlay.beansprout.pots.find(p => p.id === 'crop_01_01'); Object.assign(b1, { sown: false, harvested: false, ageDays: 0, startedOnDay: null });
  const m5 = s.firstPlay.crops['0'].pots.find(p => p.id === 'crop_02_05'); Object.assign(m5, { sown: false, harvested: false, ageDays: 0, startedOnDay: null });
  const { page, J, boot } = await open(390);
  await boot(JSON.stringify(w));
  await J(`(()=>{ window.__byeotSheet.open('plants'); return 1; })()`); await sleep(1500);
  const seeRow = (id) => J(`(()=>{ const b=document.querySelector('#siruList button[data-siru="${id}"][data-act="plant"]'); if (!b) return { 없음: true }; b.scrollIntoView({ block: 'center' }); return { kind: b.dataset.kind }; })()`);
  const vis = (id) => J(`(()=>{ const b=document.querySelector('#siruList button[data-siru="${id}"][data-act="plant"]'); if (!b) return null; const q=b.getBoundingClientRect(); const c=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2); return !!(q.width && q.top>=0 && q.bottom<=innerHeight && c && (c===b||b.contains(c))); })()`);
  const sm = await seeRow('crop_02_05'); await sleep(700);
  const v = { musun: await vis('crop_02_05'), bean: await vis('crop_01_01') };
  const c1 = await reHint(J);
  console.log('  ㉶ 무순 줄만 보임', JSON.stringify({ sm, v, c1 }));
  if (OUT) await page.shot(`${OUT}/390_c6f_sow_musun.png`);
  ok(!c1.탈 && v.musun === true && v.bean === false && !(c1.inSheet && c1.siru === 'crop_02_05'), '㉶ 무 씨앗 0 인 무순 [🌱 심기]를 안 짚는다(콩나물 줄은 화면 밖)', JSON.stringify({ v, tid: c1.tid, act: c1.act, siru: c1.siru, say: c1.say }));
  /* 예전(② 앞 5d403ed2)에도 이 판은 심기 표지가 «닫는 문» 갈래에 안 닿아 [다음 날] 갈래의 닫는 문(«[다음 날]이 가려졌습니다 — 한 번 더 누르면 닫힙니다»)이 섰다 */
  ok(!c1.탈 && c1.on && c1.tid === 'navPlants' && /한 번 더 누르면 닫힙니다$/.test(c1.say || ''), '㉶ 짚을 줄이 없으면 예전 «닫는 문»(기둥 [식물])', JSON.stringify({ tid: c1.tid, say: c1.say }));
  await seeRow('crop_01_01'); await sleep(700);
  const c2 = await reHint(J);
  console.log('  ㉶ 콩나물 줄 보임', JSON.stringify(c2));
  if (OUT) await page.shot(`${OUT}/390_c6f_sow_bean.png`);
  ok(!c2.탈 && c2.on && c2.inSheet && c2.siru === 'crop_01_01' && c2.act === 'plant' && c2.say === '여기서도 심을 수 있습니다', '㉶ 콩나물 줄을 굴려 보이면 그 [🌱 심기] «여기서도 심을 수 있습니다»', JSON.stringify({ tid: c2.tid, act: c2.act, siru: c2.siru, say: c2.say }));
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_critic6_f: 빨강 ${bad}` : 'probe_critic6_f: 다 통과');
process.exit(bad ? 1 : 0);
