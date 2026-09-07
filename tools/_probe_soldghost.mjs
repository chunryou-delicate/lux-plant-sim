/* _probe_soldghost — **몬스테라를 판 «뒤» 다시 그리면 그루가 되살아나나** (2026-09-07 · 총괄 ②의 끝걸음)
   앞 자(_probe_buyback)에서 판 뒤 화분 0 이었는데 잠시 뒤 `pot_02` 가 있었다. 「무엇이 그것을 만들었나」만 «하나씩» 갈라 본다.
   ⛔ 값 0 · 고치지 않는다. 읽기만. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const page = await launch({ width: 1770, height: 1188, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
const J = async (js, ms = 30000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
const pots = () => J(`(()=>({ 화분: (window.__S().pots||[]).map(p=>p.id), 그루id: (()=>{ try { return window.__io.growth.plantIds(); } catch(e) { return null; } })(), 도착: !!(window.__S().firstPlay.monstera||{}).arrived }))()`);
console.log('0 켠 직후 —', JSON.stringify(await pots()));
console.log('1 도착 세움 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js'); const S=window.__S();
  S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
  const a = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a);
  return { 화분: (S.pots||[]).map(p=>p.id) }; })()`, 60000)));
console.log('2 팔기 —', JSON.stringify(await J(`(async()=>{ const sh=await import('/src/game/shop.js'); const S=window.__S();
  const l = sh.listPot(S, { potId: (S.pots||[])[0].id, leaves: 3, variegatedLeaves: 1 });
  const lo = sh.listingOf(S, l.listing.listingId); lo.contactOnDay = S.day; lo.status = 'contacted';
  const d = sh.dealListing(S, l.listing.listingId);
  return { 판값: d.price ? d.price.won : null, 판뒤화분: (S.pots||[]).map(p=>p.id), growthNeedsReset: !!d.growthNeedsReset }; })()`, 60000)));
console.log('3 판 직후 —', JSON.stringify(await pots()));
console.log('4 draw() 만 —', JSON.stringify(await J(`(()=>{ try { window.__redraw(); } catch(e){} return { 화분: (window.__S().pots||[]).map(p=>p.id) }; })()`)));
await sleep(600);
console.log('5 syncRoom 지난 뒤 —', JSON.stringify(await pots()));
console.log('6 하루 넘김 —', JSON.stringify(await J(`(()=>{ const n=document.getElementById('next'); if (n && !n.disabled) n.click(); return { 눌렀나: !!(n && !n.disabled) }; })()`)));
await sleep(2500);
console.log('7 하루 뒤 —', JSON.stringify(await pots()));
console.log('   ⇒ 사람 눈([식물] 탭) —', await page.eval(`(()=>{ try { window.__byeotSheet.open('plants'); } catch(e){}
  const el=document.getElementById('pagePlants'); return el ? (el.innerText||'').replace(/\\s+/g,' ').trim().slice(0,140) : null; })()`));
await page.close();
