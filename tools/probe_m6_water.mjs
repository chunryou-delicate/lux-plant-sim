/* 비판 셋째 판 MAJOR #6 자(core 10-31) — «💧 몬스테라에 물 주기»를 눌러도 아무 일 · 아무 말 없음(A Day 18 · 14번)
   판: 반지하 세이브를 «막 연» 첫 화면(지난 턴 없음) · 390×844
   손질(재는 것 · 지어낸 판): 첫 그루 wateredOnDay 를 하루씩 앞당겨 단추가 처음 «물 주기»로 켜지는 날(경계)을 찾는다 — 그날이 갈림이 나는 날
   ㉮ 단추가 «물 주기»면 눌렀을 때 물이 든다(wateredOnDay = 오늘)
   ㉯ 단추가 «아직 촉촉»일 때 말풍선/단추를 눌러도 말이 있다(묶음 · 낱개 둘 다) — 배너 «아직 촉촉합니다»
   예외 0 */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300', OUT = process.env.OUT || null;
const SAVE = process.env.SAVE || 'C:/Users/pc/AppData/Local/Temp/byeot-core/ev/dump/humanQ_g_d36.json';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const exc = [];
const page = await launch({ width: 390, height: 844, dpr: 2 });
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
await page.goto(`${BASE}/data/balance/homes.json`);
await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(SAVE, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
await page.goto(`${BASE}/game.html`); await page.waitFor('window.__byeotBooted === true', 300000, 500); await sleep(4000);
const dlgOnly = async () => { for (let i = 0; i < 80; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (!t) return; await page.eval(`(()=>{ const s=document.getElementById('dlgSkip'); if(s) s.click(); const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(250); } };
await dlgOnly(); await sleep(800);
const banner = () => J(`(()=>{ const e=document.getElementById('event'); return e && e.classList.contains('on') ? (e.innerText||'').replace(/\\s+/g,' ').slice(0,120) : ''; })()`);
const btn = () => J(`(()=>{ const b=document.getElementById('waterPot'); const S=window.__S(); const p=(S.pots||[])[0]; return { t: b.textContent, dis: b.disabled, shown: b.style.display !== 'none', day: S.day, w: p ? p.wateredOnDay : null, sta: S.stamina && S.stamina.left, room: S.home && S.home.room }; })()`);
const b0 = await btn();
console.log('  판', JSON.stringify(b0));
/* 경계 찾기 — 하루씩 앞당겨 단추가 처음 «물 주기»(disabled=false)가 되는 날 */
let k = null, seen = [];
for (let d = 0; d <= 20; d++) {
  const r = await J(`(()=>{ const S=window.__S(); S.pots[0].wateredOnDay = S.day - ${d}; window.__redraw(); const b=document.getElementById('waterPot'); return { dis: b.disabled, t: b.textContent }; })()`);
  seen.push(`${d}:${r.dis ? '×' : '○'}`);
  if (!r.dis) { k = d; break; }
}
console.log('  경계', k, seen.join(' '));
ok(k != null, '판 — 단추가 «물 주기»로 켜지는 날을 찾았다', seen.join(' '));
/* ㉮ 경계 날에 단추를 누른다(사람 손 · doAct 걸음 · 묶음 단추) */
const w0 = await J(`window.__S().pots[0].wateredOnDay`);
await page.eval(`(()=>{ const b=document.getElementById('waterPot'); b.style.display=''; b.click(); return 1; })()`, false);
let w1 = w0, said = '';
for (let i = 0; i < 30 && w1 === w0; i++) { await sleep(500); w1 = await J(`window.__S().pots[0].wateredOnDay`); if (!said) said = await banner(); }
const day = await J(`window.__S().day`);
if (OUT) await page.shot(`${OUT}/390_m6_press.png`);
ok(w1 === day, '㉮ 단추가 «물 주기»인 날 누르면 물이 든다(지난 턴 없는 첫 화면)', JSON.stringify({ before: w0, after: w1, day, banner: said }));
/* ㉯ 아직 촉촉(오늘 준 판)일 때 누르면 말한다 — 단추를 숨겨도 click 은 온다(말풍선 길) */
await sleep(1500);
await page.eval(`(()=>{ const e=document.getElementById('event'); if (e) e.click(); return 1; })()`, false); await sleep(500);
await J(`(()=>{ const S=window.__S(); S.pots[0].wateredOnDay = S.day; window.__redraw(); return 1; })()`);
await page.eval(`(()=>{ const b=document.getElementById('waterPot'); b.style.display=''; b.disabled=false; b.click(); return 1; })()`, false);
let said2 = '';
for (let i = 0; i < 20 && !said2; i++) { await sleep(500); said2 = await banner(); }
ok(/아직 촉촉/.test(said2), '㉯ 아직 촉촉한데 눌러도 말이 있다', said2 || '(말 없음)');
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
console.log(bad ? `probe_m6_water: 빨강 ${bad}` : 'probe_m6_water: 다 통과');
await page.close(); process.exit(bad ? 1 : 0);
