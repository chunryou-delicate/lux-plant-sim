/* tools/probe_reach_uses.mjs — **문 앞 통로에 놓으면 «침대·의자·책상·문 앞까지 못 갑니다»를 말하나** (2026-10-08 · core · 총괄 13:35 E)
   ------------------------------------------------------------
   [house] house-place-freedom-20261008 ④: 바닥 칸 하나에 화분을 놓으면 «처음 서는 자리 → 문 앞» 길이 끊기는 칸이 있다
     (반지하 6칸 · x −1.63~−1.13 · z 1.13~1.38 / 원룸 빈 방 1칸 (−1.88, 1.88)).
   세이브로 켜고(SAVE=) 손 길 그대로:
     ① 놓기 전 — 가구 곁(roomView.besideReach)·문 앞(roomView.doorReach) 전부 닿음
     ② 몬스테라를 골라 [옮기기] → 바닥 POINT 로 «끈 만큼» 끌어 놓기(picked.down/move/up · 확인 바 길)
        → 확인 바 #placeConfirmWarn 에 «못 갑니다»/«문 앞 길이 막» 이 섰나 · 그때 무엇이 끊겼나
     ③ [다시 옮기기] 로 창턱(SILL)에 되돌리면 길 경고가 «없다»
   SAVE= (필수) · OUTDIR= (필수 · 비어 있어야) · POINT=-1.38,1.25 · SILL=banjiha-sill:0 · BYEOT_URL=(기본 127.0.0.1:9300)
   ⚠ 값 0 · 화면 손질 0. */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const OUTDIR = process.env.OUTDIR, SAVEF = process.env.SAVE;
if (!OUTDIR || !SAVEF) { console.error('⛔ SAVE= OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ OUTDIR 가 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const [PX, PZ] = String(process.env.POINT || '-1.38,1.25').split(',').map(Number);
const SILL = process.env.SILL || 'banjiha-sill:0';
const SAVE = fs.readFileSync(SAVEF, 'utf8');
const page = await launch({ width: 390, height: 844, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 300000, 500);
  await page.waitFor(`(()=>{ try { return window.__rv.characters().some(c=>c.walkable); } catch(e){ return false; } })()`, 120000, 500);
  await sleep(3000);
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`));
  const clear = async () => { for (let i = 0; i < 40; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return String(!!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on')));})()`);
    if (b !== 'true') return;
    await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false); await sleep(250); } };
  await clear();
  const uses = `(async()=>{ const rv=window.__rv; const P=await (await fetch('/data/furniture_presets.json')).json(); const PR=P.presets||P;
    const fl=(rv.furniture()||[]).filter(f=>['bed','chair','desk'].includes((PR[f.preset]||{}).type));
    const me=rv.characters().find(c=>c.walkable);
    return { 사람: me && me.pos ? [+me.pos.x.toFixed(2), +me.pos.z.toFixed(2)] : null, 가구: fl.map(f=>f.uid+':'+JSON.stringify(rv.besideReach(f.uid))), 문: rv.doorReach() }; })()`;
  const u0 = await J(uses);
  console.log('놓기 전 —', JSON.stringify(u0));
  ok(!u0.탈 && (u0.가구 || []).every(s => /"ok":true/.test(s)) && (u0.문 || []).every(d => d.ok), '놓기 전엔 가구 곁·문 앞 전부 닿는다');
  /* ② 몬스테라를 바닥 POINT 로 — 확인 바 길(손가락이 부르는 그 함수) */
  const moveTo = (fromKey, screenJs) => J(`(async()=>{ const P=window.__picked;
    P.clear(); P.confirming=true; P.select(${JSON.stringify(fromKey)}); P.beginMove();
    const r=document.getElementById('roomCanvas').getBoundingClientRect(); const t=${screenJs};
    if(!t) return {탈:'화면 자리를 못 얻었다'};
    P.down({clientX:P.originX, clientY:P.originY}); P.move({clientX:r.left+t.x, clientY:r.top+t.y}); P.up();
    await new Promise(z=>setTimeout(z,900));
    const p=window.__S().pots[0]; const w=document.getElementById('placeConfirmWarn');
    return { 자리:p.slotId, at:p.at && [+p.at.x.toFixed(2), +p.at.z.toFixed(2)], 확인바:document.getElementById('stage').classList.contains('confirming'),
             경고: w && w.style.display!=='none' ? w.textContent : null }; })()`);
  const k0 = await J(`(()=>{ const p=window.__S().pots[0]; return p.slotId || ('free:'+p.id); })()`);
  const a = await moveTo(k0, `window.__rv.worldToScreen(${PX}, 0, ${PZ})`);
  console.log('통로에 —', JSON.stringify(a));
  const u1 = await J(uses);
  console.log('놓은 뒤 —', JSON.stringify(u1));
  const cut = (u1.가구 || []).some(s => /"ok":false/.test(s)) || (u1.문 || []).some(d => !d.ok);
  ok(cut, `통로(${a.at}) 에 놓으면 무엇인가 끊긴다(house ④)`);
  ok(typeof a.경고 === 'string' && /못 갑니다|문 앞 길이 막/.test(a.경고), `확인 바 — «${a.경고}»`);
  await page.shot(`${OUTDIR}/corridor.png`);
  /* ③ 창턱으로 되돌림 */
  const k1 = await J(`(()=>{ const p=window.__S().pots[0]; return p.slotId || ('free:'+p.id); })()`);
  const b = await moveTo(k1, `window.__rv.screenPosOf(${JSON.stringify(SILL)})`);
  console.log('창턱으로 —', JSON.stringify(b));
  ok(!b.경고 || !/못 갑니다|문 앞 길이 막/.test(b.경고), `창턱에선 길 경고 없음 — «${b.경고}»`);
  await page.shot(`${OUTDIR}/back_sill.png`);
} finally { await page.close(); }
console.log(bad ? `probe_reach_uses: FAIL (${bad})` : 'probe_reach_uses: PASS');
process.exit(bad ? 1 : 0);
