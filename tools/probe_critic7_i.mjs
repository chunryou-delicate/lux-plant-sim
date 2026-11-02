/* 비판 7판 7C10 ① 자(core 11-03 · 총괄 가름 · 비판 7판 MINOR #16 d17_zoom) — 🔍 확대 화면에서 [다음 날]이 정보 카드(#growGauge)를 덮지 않는다
   ⛔ 비판 7판 A Day 17: 확대 화면 [다음 날]이 카드 오른쪽 귀퉁이를 덮고 섰다(글줄 · 띠는 비켰으나 카드 테두리 · 바탕이 단추 밑)
   판: 비판 6판 A100 세이브(C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json · 프로필 안 건드림) — 손질: 작물은 다 자라는 중(돌봄 손가락 없음)
   단언(390 · 360)
     ㉮ 그루 메뉴 [확대 보기] → stage.zoom
     ㉯ [다음 날]이 화면 안에 보이고 · 카드와 안 겹침 · [시야 돌아가기]와 안 겹침
     ㉰ 카드 글줄 · 띠가 카드 안쪽 폭을 다 씀(오른쪽 비움 ≤ 16px)
     ㉱ [시야 돌아가기]를 누르면 확대가 닫히고 [다음 날]이 제자리(바닥 오른쪽 · 확대 전과 같은 bottom)
     ㉲ 카드가 밑의 plant_grow 보기 단추를 다 덮음(글줄이 한 줄로 줄어 카드가 낮아져도)
     예외 0 · J 단언엔 !탈 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE_A = process.env.SAVE_A || 'C:/Users/pc/byeot-core-keep/critic6/saveA_d100.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
if (!fs.existsSync(SAVE_A)) { ok(false, '세이브 없음', SAVE_A); process.exit(1); }
const stage = () => { const w = JSON.parse(fs.readFileSync(SAVE_A, 'utf8')); const s = w.state;
  for (const p of s.firstPlay.beansprout.pots) if (p.slotId) Object.assign(p, { sown: true, harvested: false, ageDays: 1, startedOnDay: s.day - 1, idleSinceDay: s.day - 1 });
  for (const v of Object.values(s.firstPlay.crops || {})) for (const p of ((v && v.pots) || [])) if (p.slotId) Object.assign(p, { sown: true, harvested: false, ageDays: 1, startedOnDay: s.day - 1, idleSinceDay: s.day - 1 });
  return JSON.stringify(w); };
const exc = [];
const R = `const rr=q=>q&&q.width?[Math.round(q.left),Math.round(q.top),Math.round(q.right),Math.round(q.bottom)]:null;`;
const ovr = (a, b) => !!a && !!b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
for (const W of [390, 360]) {
  const page = await launch({ width: W, height: 844, dpr: 2 });
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(stage())}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(3500);
  for (let i = 0; i < 120; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) break; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); }
  await J(`(()=>{ try { window.__byeotSheet.close(); } catch (e) { void e; } return 1; })()`); await sleep(1200);
  for (let i = 0; i < 20; i++) { const on = await J(`document.getElementById('event').classList.contains('on')`); if (on !== true) break; await J(`(()=>{ document.getElementById('event').click(); return 1; })()`); await sleep(400); }
  const camStill = async () => { let n = 0; for (let i = 0; i < 60 && n < 2; i++) { const b = await J(`(()=>{ try { const c = window.__rv.camBusy(); return !!(c && (c.tween || c.down)); } catch (e) { return false; } })()`); n = b === false ? n + 1 : 0; await sleep(200); } };
  await camStill();
  const nx0 = await J(`(()=>{ ${R} return rr(document.getElementById('next').getBoundingClientRect()); })()`);
  const key = await J(`(()=>{ const ps = window.__rv.plants ? window.__rv.plants() : []; const p = ps.find(x => x && x.potId === 'pot_01') || ps.find(x => x && x.potId); return p ? p.key : null; })()`);
  await J(`(()=>{ window.__picked.select(${JSON.stringify(key)}); return 1; })()`); await sleep(700); await camStill();
  const zb = await J(`(()=>{ const b = document.getElementById('pickZoom'); if (!b || !b.offsetParent) return false; b.click(); return true; })()`); await sleep(1800);
  await J(`(()=>{ for (const a of document.getAnimations()) { try { a.finish(); } catch (e) { void e; } } return 1; })()`); await sleep(300);
  const z = await J(`(()=>{ ${R} const st=document.getElementById('stage'), nx=document.getElementById('next'), gg=document.getElementById('growGauge'), cz=document.getElementById('closeZoom');
    const ncs=getComputedStyle(nx); const g=gg.getBoundingClientRect(), gcs=getComputedStyle(gg), innerR=g.right-parseFloat(gcs.paddingRight)-parseFloat(gcs.borderRightWidth);
    const rows=[...gg.querySelectorAll('.gg-row,.gg-bar')].filter(e=>e.offsetParent).map(e=>Math.round(innerR - e.getBoundingClientRect().right));
    const n=nx.getBoundingClientRect(); const cx=n.left+n.width/2, cy=n.top+n.height/2; const at=document.elementFromPoint(cx, cy);
    return { zoom: st.classList.contains('zoom'), next: rr(n), nextVis: ncs.display !== 'none' && ncs.visibility !== 'hidden' && +ncs.opacity > 0.2, nextTop: !!(at && (at === nx || nx.contains(at))),
      card: rr(g), close: rr(cz.getBoundingClientRect()), rowGap: rows, vw: innerWidth, vh: innerHeight }; })()`);
  console.log(`  ${W} 확대`, JSON.stringify({ key, zb, nx0, ...z }));
  if (OUT) await page.shot(`${OUT}/${W}_c7i_zoom.png`);
  ok(!z.탈 && zb && z.zoom, `㉮ ${W} 그루 메뉴 [확대 보기] → 확대`, JSON.stringify({ key, zb, zoom: z.zoom }));
  ok(!z.탈 && z.nextVis && z.nextTop && z.next && z.next[0] >= 0 && z.next[2] <= z.vw && z.next[1] >= 0 && z.next[3] <= z.vh, `㉯ ${W} 확대 중 [다음 날]이 화면 안에 보이고 위에 섬`, JSON.stringify({ next: z.next, vis: z.nextVis, top: z.nextTop }));
  ok(!z.탈 && !ovr(z.next, z.card), `㉯ ${W} [다음 날]이 정보 카드를 안 덮음`, JSON.stringify({ next: z.next, card: z.card }));
  ok(!z.탈 && !ovr(z.next, z.close), `㉯ ${W} [다음 날]과 [시야 돌아가기]가 안 겹침`, JSON.stringify({ next: z.next, close: z.close }));
  ok(!z.탈 && Array.isArray(z.rowGap) && z.rowGap.length > 0 && z.rowGap.every(g => g <= 16), `㉰ ${W} 카드 글줄 · 띠가 카드 폭을 다 씀(오른쪽 비움 ≤ 16px)`, JSON.stringify(z.rowGap));
  /* ㉲ 카드가 밑의 plant_grow 보기 단추(앞 · 좌 · 우 · 위 · 자동회전 · 바닥격자)를 다 덮는다 — 글줄이 한 줄로 줄어 카드가 낮아지면 그 줄이 카드 위로 드러났다(11-03 x_7c10 · 390) */
  const pg = await J(`(()=>{ const f=document.getElementById('growth'); const fr=f.getBoundingClientRect(); const d=f.contentDocument; if(!d) return { noDoc:true };
    const out=[]; for (const e of d.querySelectorAll('button')) { const q=e.getBoundingClientRect(); const cs=d.defaultView.getComputedStyle(e); if (!q.width || cs.display==='none' || cs.visibility==='hidden') continue;
      const r=[Math.round(fr.left+q.left), Math.round(fr.top+q.top), Math.round(fr.left+q.right), Math.round(fr.top+q.bottom)]; if (r[3] > 500 && r[1] < innerHeight) out.push({ t: (e.textContent||'').trim().slice(0,8), r }); }
    return out; })()`);
  ok(!pg.탈 && !pg.noDoc && Array.isArray(pg) && pg.length > 0 && pg.every(b => z.card && b.r[1] >= z.card[1] && b.r[3] <= z.card[3]), `㉲ ${W} 카드가 밑의 plant_grow 보기 단추 ${Array.isArray(pg) ? pg.length : '?'}개를 다 덮음(카드 위 끝 ${z.card && z.card[1]})`, JSON.stringify({ card: z.card, out: Array.isArray(pg) ? pg.filter(b => !(z.card && b.r[1] >= z.card[1] && b.r[3] <= z.card[3])) : pg }));
  await J(`(()=>{ document.getElementById('closeZoom').click(); return 1; })()`); await sleep(1500);
  await J(`(()=>{ for (const a of document.getAnimations()) { try { a.finish(); } catch (e) { void e; } } return 1; })()`); await sleep(300);
  const back = await J(`(()=>{ ${R} return { zoom: document.getElementById('stage').classList.contains('zoom'), next: rr(document.getElementById('next').getBoundingClientRect()) }; })()`);
  console.log(`  ${W} 돌아옴`, JSON.stringify(back));
  ok(!back.탈 && !back.zoom && back.next && nx0 && back.next[3] === nx0[3], `㉱ ${W} [시야 돌아가기] 뒤 [다음 날] 제자리(아래 끝 ${nx0 && nx0[3]})`, JSON.stringify({ before: nx0, after: back.next, zoom: back.zoom }));
  try { await page.close(); } catch (e) { void e; }
}
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `\nprobe_critic7_i: 빨강 ${bad}` : '\nprobe_critic7_i: 다 통과');
process.exit(bad ? 1 : 0);
