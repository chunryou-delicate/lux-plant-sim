/* tools/probe_dark_place.mjs — **놓는 순간 «여기선 안 자란다»를 말하나** (2026-10-08 · core · 총괄 13:35 A·B)
   ------------------------------------------------------------
   세이브로 켜고(SAVE= · 몬스테라가 창턱에 선 판 — 예: leaf `_make_oneroom_save NOMOVE=1`) 화면 손 길 그대로 잰다:
     ① 확인 바 길 — 몬스테라를 골라 [옮기기] → 어두운 칸으로 «끈 만큼» 끌어 놓기 → [확인] 바의 경고 글(#placeConfirmWarn)
     ② 확인 바 없는 옮기기 — 같은 손으로 다른 어두운 칸 → 배너(#event)
     ③ 창턱으로 되돌리기 — 경고가 «없어야» 한다(밝은 데서 말하면 거짓)
     ④ 빈 화분 누르기(__placePot) — 배너에 빛 한 줄이 섰나(놓인 자리가 어두울 때만)
   찍기: OUTDIR(비어 있어야) 에 confirm_dark.png · banner_dark.png · back_sill.png · emptypot.png
   SAVE= (필수) · OUTDIR= (필수) · DARK=banjiha-dresser:1,banjiha-etagere:0 · SILL=banjiha-sill:0 · BYEOT_URL=(기본 127.0.0.1:9300)
   ⚠ 값 0 · 화면 손질 0(고른 그루를 «끈 만큼» 옮기는 picked.down/move/up 은 손가락이 부르는 그 함수다). */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const OUTDIR = process.env.OUTDIR, SAVEF = process.env.SAVE;
if (!OUTDIR || !SAVEF) { console.error('⛔ SAVE= OUTDIR='); process.exit(2); }
fs.mkdirSync(OUTDIR, { recursive: true }); if (fs.readdirSync(OUTDIR).length) { console.error('⛔ OUTDIR 가 비어 있지 않다'); process.exit(2); }
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const DARK = String(process.env.DARK || 'banjiha-dresser:1,banjiha-etagere:0').split(',');
const SILL = process.env.SILL || 'banjiha-sill:0';
const SAVE = fs.readFileSync(SAVEF, 'utf8');
const page = await launch({ width: 390, height: 844, dpr: 1 });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('!!window.__rv', 300000, 500); await sleep(5000);
  const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 60000));
  const clear = async () => { for (let i = 0; i < 40; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return String(!!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on')));})()`);
    if (b !== 'true') return;
    await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false); await sleep(250); } };
  await clear();
  /* 고른 그루를 «끈 만큼» 다른 칸으로 — 손가락 길(picked.down → move → up) */
  const moveTo = (fromKey, toSlot, confirming) => J(`(async()=>{ const P=window.__picked, rv=window.__rv;
    P.clear(); P.confirming=${confirming ? 'true' : 'false'}; P.select(${JSON.stringify(fromKey)}); P.beginMove();
    const r=document.getElementById('roomCanvas').getBoundingClientRect(); const t=rv.screenPosOf(${JSON.stringify(toSlot)});
    if(!t) return {탈:'칸이 화면에 없다'};
    P.down({clientX:P.originX, clientY:P.originY}); P.move({clientX:r.left+t.x, clientY:r.top+t.y}); P.up();
    await new Promise(z=>setTimeout(z,600));
    const S=window.__S(), p=S.pots[0];
    const w=document.getElementById('placeConfirmWarn'), ev=document.getElementById('event');
    return { 자리:p.slotId, 확인바:document.getElementById('stage').classList.contains('confirming'),
             경고:w && w.style.display!=='none' ? w.textContent : null, 배너:ev && ev.classList.contains('on') ? ev.textContent : null,
             판정:window.__byeotDarkPlace(p.slotId || ('free:'+p.id)) }; })()`);
  const start = await J(`(()=>{ const S=window.__S(); const p=S.pots[0]; return { 날:S.day, 자리:p.slotId, 판정:window.__byeotDarkPlace(p.slotId) }; })()`);
  console.log('시작 —', JSON.stringify(start));
  ok(start.판정 && start.판정.warn == null, `창턱(${start.자리})은 경고 없음 — ${JSON.stringify(start.판정 && start.판정.band)}`);

  console.log('① 확인 바 길');
  const a = await moveTo(start.자리, DARK[0], true);
  console.log('  ', JSON.stringify(a));
  ok(a.확인바 === true, '확인 바가 섰다');
  ok(a.판정 && a.판정.band && a.판정.band.dark === true, `${a.자리} 는 안 자라는 띠(${a.판정 && a.판정.band && a.판정.band.band} · DLI ${a.판정 && a.판정.band && a.판정.band.dli && a.판정.band.dli.toFixed(2)})`);
  ok(typeof a.경고 === 'string' && /어둡습니다/.test(a.경고), `확인 바 경고 — «${a.경고}»`);
  await page.shot(`${OUTDIR}/confirm_dark.png`);
  await J(`(()=>{ const b=document.getElementById('placeOk'); if(b) b.click(); return !!b; })()`);
  await sleep(800); await clear();

  console.log('② 확인 바 없는 옮기기');
  const k1 = await J(`(()=>{ const p=window.__S().pots[0]; return p.slotId || ('free:'+p.id); })()`);
  const b = await moveTo(k1, DARK[1] || DARK[0], false);
  console.log('  ', JSON.stringify(b));
  ok(b.확인바 === false, '확인 바 없음');
  ok(!b.판정 || !b.판정.band || !b.판정.band.dark || (typeof b.배너 === 'string' && /어둡습니다/.test(b.배너)), `어두우면 배너 — «${b.배너}»`);
  await page.shot(`${OUTDIR}/banner_dark.png`);
  await sleep(400); await clear();

  console.log('③ 창턱으로 되돌리기');
  const k2 = await J(`(()=>{ const p=window.__S().pots[0]; return p.slotId || ('free:'+p.id); })()`);
  const c = await moveTo(k2, SILL, true);
  console.log('  ', JSON.stringify(c));
  ok(c.경고 == null || !/어둡습니다/.test(c.경고), `창턱에선 빛 경고 없음 — «${c.경고}»`);
  await page.shot(`${OUTDIR}/back_sill.png`);
  await J(`(()=>{ const b=document.getElementById('placeOk'); if(b) b.click(); return !!b; })()`);
  await sleep(800); await clear();

  console.log('④ 빈 화분 누르기');
  const e = await J(`(async()=>{ const S=window.__S(); const sh=await import('/src/game/shop.js');
    try { S.shop.stock[sh.SEED_POT_ITEM_ID || 'pot_concrete_square'] = (S.shop.stock['pot_concrete_square']||0) + 1; } catch(_){}
    const r=window.__placePot('monsteraSeed:pot_concrete_square'); await new Promise(z=>setTimeout(z,600));
    const ep=(S.emptyPots||[]).slice(-1)[0]; const ev=document.getElementById('event');
    return { r, 자리: ep && (ep.slotId || 'free'), 판정: ep ? window.__byeotDarkPlace(ep.slotId || ('free:'+ep.id)) : null, 배너: ev && ev.classList.contains('on') ? ev.textContent : null }; })()`);
  console.log('  ', JSON.stringify(e));
  if (e.판정 && e.판정.band) ok(e.판정.band.dark ? /어둡습니다/.test(e.배너 || '') : !/어둡습니다/.test(e.배너 || ''), `빈 화분 배너가 띠와 맞는다(${e.판정.band.band}) — «${e.배너}»`);
  else console.log('  (빈 화분을 못 놓았거나 못 쟀다 — 세지 않음)');
  await page.shot(`${OUTDIR}/emptypot.png`);
} finally { await page.close(); }
console.log(bad ? `probe_dark_place: FAIL (${bad})` : 'probe_dark_place: PASS');
process.exit(bad ? 1 : 0);
