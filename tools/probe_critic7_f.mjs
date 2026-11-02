/* 비판 7판 7C6 자(core 11-02 · 총괄 가름 · fc6211e4 에서 남은 것) — «… 둘까요?» 확인 바와 손가락이 놓일 점 · 제목을 덮지 않는다
   ⛔ 비판 7판 MINOR #6(S43_trayplace «4번»을 손이 가림 · d45_lamp 제목 «식물등을») · #7(d11_mplace · d13_place · d15_p1 · d45_lamp — 창턱 · 서랍장 · 창 위가 확인 바 밑에 가려 어디인지 못 봄)
   판: 비판 6판 S Day 97 세이브(C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json · 원룸 · 프로필 안 건드림) — 손질: 놓인 무순 판 · 시루 하나를 가방으로 빼고, 가방 그 칸을 눌러 누르기 자동 자리의 확인 바를 띄움
     자리 넷: 창턱 2번(무순 판 crop_02_04) · 협탁(시루 crop_01_12) · 책상 1번(시루 crop_01_10) · 서랍장 2번(시루 crop_01_13) × 360 · 390
     + 등 다는 창(총괄 7C6 꼬리 · 비판 6판 A100 · 등 하나 가졌고 안 달음 · 가방 등 칸 누름 · 놓일 점 = 등 자리 — 게임 손잡이 __byeotPlacePt)
   단언(자리 × 폭마다)
     ㉮ 확인 바가 놓일 점을 안 덮는다(점이 바 네모 밖 · 8px 여유) · 비킨 바가 할 일 칩 · 빛 분포 단추 · [?] 를 안 덮는다
     ㉯ 손가락(손 · 말풍선 글)이 확인 바 제목 «… 둘까요?» 글을 안 덮는다
     ㉰ 손가락(손 · 말풍선 글)이 놓일 점(±10px)을 안 덮는다 · 손가락은 켜져 있고 [확인]을 짚는다
     ㉱ 말풍선 글(보일 때)이 낱말 안에서 안 꺾인다(좁힌 옆자리 «둘까 / 요» 꼴)
     예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_S = process.env.SAVE_S || 'C:/Users/pc/byeot-core-keep/critic6/saveS_d97.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_S)) { ok(false, '세이브 없음', SAVE_S); process.exit(1); }
const CASES = [{ id: 'crop_02_04', kind: 'musun', ko: '창턱 2번' }, { id: 'crop_01_12', kind: 'beansprout', ko: '협탁' }, { id: 'crop_01_10', kind: 'beansprout', ko: '책상 1번' }, { id: 'crop_01_13', kind: 'beansprout', ko: '서랍장 2번' }];
/* 등 다는 판(총괄 7C6 꼬리 · 비판 7판 d45_lamp «여기에 벽부형 식물등을 달까요?») — 비판 6판 A100 세이브 · 등 하나 가졌고 안 달음(probe_critic6_a ㉲ C5 와 같은 손질) */
const SAVE_A = process.env.SAVE_A || 'C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json';
const stageLamp = () => { const w = JSON.parse(fs.readFileSync(SAVE_A, 'utf8')); const s = w.state; s.stamina.left = s.stamina.max;
  s.tutorial.lamp.placed = 0; s.lamps.count = 0; s.stamina.questsTaken = (s.stamina.questsTaken || []).filter(x => x !== 'buy_lamp');
  if (s.talk) { for (const k of ['seen', 'recent']) if (Array.isArray(s.talk[k])) s.talk[k] = s.talk[k].filter(x => x !== 'questDoneBuyLamp'); }
  return JSON.stringify(w); };
const stage = (rid) => { const w = JSON.parse(fs.readFileSync(SAVE_S, 'utf8')); const s = w.state; s.stamina.left = s.stamina.max;
  for (const t of [...s.firstPlay.beansprout.pots, ...Object.values(s.firstPlay.crops || {}).flatMap(v => (v && v.pots) || [])].filter(p => p.id === rid)) { t.slotId = null; t.at = null; }
  return JSON.stringify(w); };
const exc = [];
const ovr = (a, b) => !!a && !!b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
for (const W of [360, 390]) {
  const page = await launch({ width: W, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  const bannerOff = async () => { for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) return; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(500); } };
  for (const C of [...CASES, { id: 'lamp', kind: 'lamp', ko: '등 다는 창' }]) {
    await page.goto(`${BASE}/data/balance/homes.json`);
    await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(C.kind === 'lamp' ? stageLamp() : stage(C.id))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
    await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
    for (let i = 0; i < 80; i++) { const tk = await J(`document.getElementById('stage').classList.contains('talking')`); if (tk !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
    await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1500); await bannerOff();
    await J(`(()=>{ window.__byeotSheet.open('bag'); return 1; })()`); await sleep(1500);
    const tap = await J(`(()=>{ const c=${C.kind === 'lamp' ? "document.getElementById('__lampbag__')" : `document.querySelector('.bagslot[data-place="${C.kind}"]')`}; if (!c) return { 없음: true }; c.click(); return { 누름: true }; })()`);
    await sleep(2500); await bannerOff(); await sleep(1200);
    const M = await J(`(async()=>{ try { window.__byeotHint(); } catch (e) { void e; } await new Promise(r=>setTimeout(r,900));
      const rr=q=>q&&q.width?[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)]:null;
      const pc=document.getElementById('placeConfirm'), who=document.getElementById('placeConfirmWho'), h=document.getElementById('hint'), t=document.querySelector('.hintTarget');
      const tb=el=>{ if(!el) return null; const rg=document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect(); };
      const sayEl=h.querySelector('.say'), sayShown = getComputedStyle(sayEl).display !== 'none';
      const sid = window.__picked && window.__picked.slotId; let pt=null;
      try { const q = window.__byeotPlacePt ? window.__byeotPlacePt() : null; if (q) pt=[q.x, q.y]; else { const p = window.__rv.screenPosOf(sid); const c=document.getElementById('roomCanvas').getBoundingClientRect(); if (p) pt=[Math.round(c.left+p.x), Math.round(c.top+p.y)]; } } catch (e) { pt = null; }
      const vis=e=>{ if(!e) return null; const cs=getComputedStyle(e); if (cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<0.05) return null; return rr(e.getBoundingClientRect()); };
      return { confirming: document.getElementById('stage').classList.contains('confirming'), sid, chip: vis(document.getElementById('questChip')), heat: vis(document.getElementById('lightHeatOff')), help: vis(document.getElementById('guideOpen')), who: (who && who.textContent)||null, whoR: rr(tb(who)), pc: rr(pc.getBoundingClientRect()), pt,
        hint: { on: h.classList.contains('on'), cls: h.className, tid: t ? t.id || null : null, say: sayEl.textContent, sayShown, sayR: sayShown ? rr(sayEl.getBoundingClientRect()) : null, handR: rr(tb(h.querySelector('.hand'))),
          split: (()=>{ const tn=sayEl.firstChild; if (!sayShown || !tn || tn.nodeType !== 3) return []; const tx=tn.textContent, out=[]; let i=0;
            for (const wd of tx.split(' ')) { if (wd) { const rg=document.createRange(); rg.setStart(tn, i); rg.setEnd(tn, i + wd.length); if ([...rg.getClientRects()].filter(q=>q.width>0).length > 1) out.push(wd); } i += wd.length + 1; } return out; })() } }; })()`);
    console.log(`  ${W} ${C.ko}`, JSON.stringify({ tap, M }));
    if (OUT) await page.shot(`${OUT}/${W}_c7f_${C.id}.png`);
    const ptBox = M.pt ? [M.pt[0] - 10, M.pt[1] - 10, M.pt[0] + 10, M.pt[1] + 10] : null;
    ok(!M.탈 && M.confirming && !!M.pt && !!M.pc && !(M.pt[0] >= M.pc[0] - 8 && M.pt[0] <= M.pc[2] + 8 && M.pt[1] >= M.pc[1] - 8 && M.pt[1] <= M.pc[3] + 8), `㉮ ${W} ${C.ko} — 확인 바가 놓일 점을 안 덮는다`, JSON.stringify({ pt: M.pt, pc: M.pc, sid: M.sid }));
    ok(!M.탈 && !!M.pc && !ovr(M.pc, M.chip) && !ovr(M.pc, M.heat) && !ovr(M.pc, M.help), `㉮ ${W} ${C.ko} — 비킨 확인 바가 할 일 칩 · 빛 분포 단추 · [?] 를 안 덮는다`, JSON.stringify({ pc: M.pc, chip: M.chip, heat: M.heat, help: M.help }));
    ok(!M.탈 && !!M.whoR && !ovr(M.hint.handR, M.whoR) && !ovr(M.hint.sayR, M.whoR), `㉯ ${W} ${C.ko} — 손가락이 확인 바 제목 «${M.who}»을 안 덮는다`, JSON.stringify({ who: M.whoR, hand: M.hint.handR, say: M.hint.sayR, cls: M.hint.cls }));
    ok(!M.탈 && Array.isArray(M.hint.split) && M.hint.split.length === 0, `㉱ ${W} ${C.ko} — 말풍선 글이 낱말 안에서 안 꺾인다(«둘까 / 요» 꼴 없음)`, JSON.stringify({ split: M.hint.split, say: M.hint.sayR, cls: M.hint.cls }));
    ok(!M.탈 && M.hint.on && M.hint.tid === 'placeOk' && !!ptBox && !ovr(M.hint.handR, ptBox) && !ovr(M.hint.sayR, ptBox), `㉰ ${W} ${C.ko} — 손가락이 [확인]을 짚고 놓일 점을 안 덮는다`, JSON.stringify({ tid: M.hint.tid, pt: M.pt, hand: M.hint.handR, say: M.hint.sayR, cls: M.hint.cls }));
  }
  try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_critic7_f: 빨강 ${bad}` : 'probe_critic7_f: 다 통과');
process.exit(bad ? 1 : 0);
