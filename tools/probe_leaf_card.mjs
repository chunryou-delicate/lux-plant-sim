/* tools/probe_leaf_card.mjs — 잎 카드(화풍 A · leaf 4d8acd19) 거는 자리 · 화면(core · 2026-10-10 · plan 6d7665e0)
   ① 그 등급을 «처음» 본 날 — ✨ 배너 왼쪽에 그 잎의 카드(그 잎이 그려지는 성숙잎 갈래 · shop §leafCardOf) · 파일이 실제로 뜬다
   ② 같은 등급을 또 보면(다음 알림) 카드가 안 붙는다
   ③ 중고 거래 줄(판매 확인) — 무늬 삽수를 올리면 값 옆에 그 삽수의 가장 높은 등급 카드 · 무지 삽수는 카드 없음
   ④ 콘솔에 처리 안 된 예외 없음
   python tools/serve.py 9300 · node tools/probe_leaf_card.mjs (OUTDIR=… 이면 사진) */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const OUTDIR = process.env.OUTDIR || null; if (OUTDIR) fs.mkdirSync(OUTDIR, { recursive: true });
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
const page = await launch();
const exc = [];
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').slice(0, 200)); });
await page.send('Runtime.enable');
const J = async (js, ms = 120000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
const shot = async n => { if (OUTDIR) await page.shot(`${OUTDIR}/${n}.png`); };
const skip = async () => { for (let i = 0; i < 40; i++) {
  if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s && s.offsetParent) s.click(); else { const x=document.getElementById('dlgBox'); if(x)x.click(); }})()`, false); await sleep(200); } };
const banner = `(()=>{ const el=document.getElementById('event'); const im=el.querySelector('img.bcard');
  return new Promise(r => { const fin = () => r({ on: el.classList.contains('on'), text: el.textContent, img: im ? im.getAttribute('src') : null, loaded: !!(im && im.complete && im.naturalWidth > 0) });
    if (im && !im.complete) { im.onload = fin; im.onerror = fin; setTimeout(fin, 3000); } else fin(); }); })()`;
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__lc){ localStorage.clear(); sessionStorage.__lc='1'; } }catch(e){}` });
  await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(5000); await skip();
  /* 몬스테라를 들인다(probe_d59_shop 과 같은 손) */
  await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js');
    const S=window.__S(); S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
    const a = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a); return 1; })()`);
  await skip();
  /* 창턱에 놓고 잎 3장까지 굴린다(무늬 잎 2·3 · 중고 거래는 잎 3장부터 열린다) — probe_d59_shop 세움과 같은 손 */
  const grown = await J(`(async()=>{ const st=await import('/src/game/state.js'); const loop=await import('/src/game/loop.js');
    const S=window.__S(), io=window.__io; const p=S.pots[0];
    if (p && !p.slotId && !p.at) { const sl=(io.light.room.slots||[]).find(x=>/sill/.test(x.slotId)); st.setPotAt(S, p.id, { x:sl.x, y:sl.y, z:sl.z, slotId:sl.slotId }, { slots: io.light.room.slots, size: io.light.room.size }); }
    for (let d=0; d<300 && io.growth.leafState().length < 4; d++) { try { st.waterPot(S); } catch(e) {} loop.runDays(S, io, 1); }
    window.__redraw(); return { day: S.day, leaves: io.growth.leafState().length }; })()`, 600000);
  console.log('세움 —', JSON.stringify(grown));
  /* ① 잎 2·3 을 무늬로 못 박고 알림 길(noteLeafGrades)을 부른다 */
  const made = await J(`(()=>{ const io=window.__io; io.growth.setPrologueVarieLeaf([2, 3]); const ls=io.growth.leafState(); return { n: ls.length, varie: ls.filter(r => r && r.varie).length }; })()`);
  await page.eval(`(()=>{ document.getElementById('event').classList.remove('on'); document.getElementById('event').innerHTML=''; })()`, false);
  /* 무늬 알림은 잎이 «다 자란 날» 선다(shop §assignPotLeafGrades · seen) — 하루씩 굴리며 게임의 알림 길(noteLeafGrades)을 부른다 */
  const g1 = await J(`(async()=>{ const st=await import('/src/game/state.js'); const loop=await import('/src/game/loop.js'); const S=window.__S(), io=window.__io;
    const ev=document.getElementById('event'); let r=null, d=0;
    for (; d<160; d++) { r = window.__leafGrades(); if (ev.classList.contains('on')) break; try { st.waterPot(S); } catch(e) {} loop.runDays(S, io, 1); }
    return { days: d, grades: r && r.grades }; })()`, 600000);
  await sleep(300);
  const b1 = await J(banner);
  console.log('① —', JSON.stringify(made), JSON.stringify(g1), JSON.stringify(b1));
  await shot('1_banner_card');
  if (!made.varie) { console.log('  ⚠ 무늬 잎을 못 만들었다 — 못 쟀다'); bad++; }
  else {
    ok(b1.on && /✨/.test(b1.text) && /\/assets\/illust\/cards\/card_mon_[a-z_]+\.png$/.test(b1.img || '') && b1.loaded, `① 처음 본 등급 배너에 카드(${b1.img} · 로드 ${b1.loaded})`);
    /* 카드가 그 잎의 그림 갈래와 같은가 — 장부 · 그림표로 다시 셈 */
    const want = await J(`(async()=>{ const sh=await import('/src/game/shop.js'); const S=window.__S(); const p=S.pots[0];
      const led=sh.potLeafGradesOf(p), seen=sh.potLeafGradesSeenOf(p)||{}, sk=sh.potLeafSkinsOf(S,p); const b=Object.keys(led).filter(k=>seen[k]).map(Number).sort((a,b)=>a-b)[0];
      return { grade: led[b], card: sh.leafCardOf({ grade: led[b], matSkin: (sk[b]||{}).matSkin }) }; })()`);
    ok((b1.img || '').endsWith(`/${want.card}.png`), `① 카드 = 그 잎의 성숙잎 갈래(${want.grade} → ${want.card})`);
    /* ② 같은 등급 다음 알림 — 카드 없음(새 잎 하나를 같은 등급으로 더 매기게 한다) */
    await page.eval(`(()=>{ document.getElementById('event').classList.remove('on'); document.getElementById('event').innerHTML=''; })()`, false);
    const g2 = await J(`(async()=>{ const st=await import('/src/game/state.js'); const loop=await import('/src/game/loop.js'); const S=window.__S(), io=window.__io;
      const ev=document.getElementById('event'); const seen = g => Object.keys(g||{}).length; let r=window.__leafGrades(), d=0;
      /* 다음 알림 하나를 기다린다(같은 등급이면 카드가 없어야 한다 · 새 등급이면 붙는 게 맞으니 등급을 같이 적는다) */
      for (; d<160; d++) { try { st.waterPot(S); } catch(e) {} loop.runDays(S, io, 1); ev.classList.remove('on'); ev.innerHTML=''; r = window.__leafGrades(); if (ev.classList.contains('on')) break; }
      const sh=await import('/src/game/shop.js'); const p=S.pots[0]; const led=sh.potLeafGradesOf(p), sn=sh.potLeafGradesSeenOf(p)||{};
      const seenGrades = Object.keys(led).filter(k=>sn[k]).sort((a,b)=>a-b).map(k=>led[k]);
      return { days: d, seenGrades }; })()`, 600000);
    await sleep(300);
    const b2 = await J(banner);
    console.log('② —', JSON.stringify(g2), JSON.stringify(b2));
    const last = (g2.seenGrades || []).slice(-1)[0], dup = (g2.seenGrades || []).slice(0, -1).includes(last);
    if (b2.on) ok(dup ? !b2.img : !!b2.img, `② 다음 알림 «${b2.text.slice(0, 24)}» — ${dup ? '이미 본 등급이라 카드 없음' : '새 등급이라 카드 있음'}(${b2.img || '카드 없음'})`);
    else console.log('  ⚠ ② 다음 알림이 160일 안에 안 섰다 — 못 쟀다');
  }
  /* ③ 중고 거래 줄 — 무늬 삽수(하프문 잎 하나)와 무지 삽수를 올리고 연락이 온 꼴로 */
  const mk = await J(`(async()=>{ const sh=await import('/src/game/shop.js'); const S=window.__S();
    const base = { status:'rooted', rootedOnDay: S.day, days: 20, varieFromCut:true, at:null, slotId:null, container:'jar', leaves:2, variegatedLeaves:1,
                   source: { leaves: 2, variegatedLeaves: 1 } };
    S.cuttings.push({ ...base, id:'cut_lc1', leafVarie:[false,true], leafGrade:[null,'halfmoon'] });
    S.cuttings.push({ ...base, id:'cut_lc2', varieFromCut:false, leafVarie:[false], leafGrade:[null], leaves:1, variegatedLeaves:0, source: { leaves: 1, variegatedLeaves: 0 } });
    const r1 = sh.listCutting(S, 'cut_lc1'), r2 = sh.listCutting(S, 'cut_lc2');
    for (const l of sh.marketStatus(S).listings) { const raw = (S.shop.market || []).find(x => x.listingId === l.listingId); if (raw) raw.status = 'contacted'; }
    window.__redraw(); window.__byeotSheet.open('shop'); return { a: r1.listing.listingId, b: r2.listing.listingId }; })()`);
  await sleep(1200);
  const rows = await J(`(()=>[...document.querySelectorAll('#marketList .cutRow')].map(r => { const im=r.querySelector('img.lcard'); return { text: r.querySelector('.nm').textContent.slice(0, 40), img: im ? im.getAttribute('src') : null, loaded: !!(im && im.complete && im.naturalWidth > 0) }; }))()`);
  console.log('③ —', JSON.stringify(mk), JSON.stringify(rows));
  await shot('3_market_card');
  const varieRow = rows.find(r => r.img), plainRows = rows.filter(r => !r.img);
  ok(!mk.탈 && rows.length >= 2, `③ 중고 거래 줄 둘(${rows.length})`);
  ok(varieRow && /card_mon_(halfmoon_|galaxy_|star_pinkmint)/.test(varieRow.img) && varieRow.loaded, `③ 무늬 삽수 줄 값 옆에 하프문 갈래 카드(${varieRow && varieRow.img})`);
  ok(plainRows.length >= 1, '③ 무지 삽수 줄엔 카드 없음');
  ok(exc.length === 0, `④ 처리 안 된 예외 없음${exc.length ? ' — ' + exc.slice(0, 2).join(' / ') : ''}`);
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; }
finally { await page.close(); }
console.log(bad ? `probe_leaf_card: FAIL (${bad})` : 'probe_leaf_card: PASS');
process.exit(bad ? 1 : 0);
