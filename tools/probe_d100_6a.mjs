/* 총괄 D100 #6 ㉠ 자(core 11-01 · 비판 다섯째 판 Day 45 d45_lamp1 «이미 밝은 창턱 위에 달림 · 새 밝은 자리 0 인지 몰랐다») — 390×844
   판: 총괄 humanQ g premove(반지하 Day 134 · 벽부형 하나 산 판) — 첫 등을 «아직 안 단» 때로 되돌린다(손질: tutorial.lamp.placed 0 · lamps.count 0)
   손: [가방] 등 칸 누르기 → 확인 바 «여기에 벽부형 식물등을 달까요?»
   ㉮ 확인 바 빛 줄(#placeConfirmFit)이 «등 밑 가장 밝아지는 자리 — {자리} 밝기 {d0} → {d1}»(또는 «새로 밝아지는 자리가 거의 없습니다»)를 말한다
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-master/d_66841206/humanQ/humanQ_g_premove.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const raw = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
const st = raw.state || raw;
st.tutorial.lamp.placed = 0; st.lamps = { ...(st.lamps || {}), count: 0 };
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(JSON.stringify(raw))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await page.waitFor('!!window.__rv', 240000, 500); await sleep(4000);
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (!t) return; await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
await dlgOnly();
const cell = await J(`(()=>{ window.__byeotSheet.open('bag'); const c=document.querySelector('#bagGrid [data-lampbag]'); return c ? c.getAttribute('data-lampbag') : null; })()`);
await sleep(600);
if (cell) await page.eval(`(()=>{ const c=document.querySelector('#bagGrid [data-lampbag]'); if (c) c.click(); return 1; })()`, false);
let cf = null;
for (let i = 0; i < 16; i++) {
  await sleep(500);
  cf = await J(`(()=>{ const on=document.getElementById('stage').classList.contains('confirming'); const f=document.getElementById('placeConfirmFit');
    return { on, who: (document.getElementById('placeConfirmWho')||{}).textContent || '', fit: f && f.style.display !== 'none' ? f.textContent : '' }; })()`);
  if (cf.on) break;
}
console.log('  등 칸', cell, '확인 바', JSON.stringify(cf));
if (OUT) await page.shot(`${OUT}/390_d100_6a.png`);
ok(!!cell && cf && cf.on && /달까요/.test(cf.who), '판 — 가방 등 칸을 누르니 «… 달까요?» 확인 바', JSON.stringify({ cell, cf }));
ok(!!cf && (/등 밑 가장 밝아지는 자리 — .+ 밝기 [\d.]+ → [\d.]+/.test(cf.fit) || /새로 밝아지는 자리가 거의 없습니다/.test(cf.fit)), '㉮ #6 확인 바가 «어디가 얼마나 밝아지나»를 말한다', JSON.stringify(cf));
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_d100_6a: 빨강 ${bad}` : 'probe_d100_6a: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
