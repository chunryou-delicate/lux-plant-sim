/* tools/_probe_buyback.mjs — **판 몬스테라를 «되살» 길이 있나 · 되사면 «그 그루»인가 «새 그루»인가** (2026-09-07 · 총괄 물음)
   ⚠ 걸음 차례가 파일 차례다 — ②-c·②-e·②-f 는 ③④(씨앗 심기) «뒤»에 돈다. 그래서 그 줄들이 보는 그루는 «씨앗 그루»다.
     (내가 그 순서를 못 보고 「판 그루가 사람 눈에 남는다」로 읽었다 — 물렸다. 깨끗한 갈래는 `_probe_soldghost.mjs`)
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
console.log('① 상점 품목 —', JSON.stringify(await J(`(async()=>{ const sh=await import('/src/game/shop.js');
  return Object.values(sh.CATALOG).map(i=>({ id:i.id, ko:i.ko, kind:i.kind, 정가:i.listWon })); })()`)));
console.log('   ⇒ kind 갈래 —', JSON.stringify(await J(`(async()=>{ const sh=await import('/src/game/shop.js');
  const k={}; for (const i of Object.values(sh.CATALOG)) k[i.kind]=(k[i.kind]||0)+1; return k; })()`)));
/* ② 도착 그루를 세우고 → 팔고 → S.pots 를 본다 */
console.log('② 팔기 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js'); const sh=await import('/src/game/shop.js'); const S=window.__S();
  S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
  const arrived = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, arrived);
  const before = (S.pots||[]).map(p=>({ id:p.id, varie:!!p.variegated, placedOnce:p.placedOnce }));
  const l = sh.listPot(S, { potId: before[0].id, leaves: 3, variegatedLeaves: 1 });
  /* 연락은 1~7일 뒤에 온다(MARKET_CONTACT_DAYS) — 자는 그 날을 «앞당겨» 세운다(값이 아니라 날짜) */
  const lo = sh.listingOf(S, l.listing.listingId); if (lo) { lo.contactOnDay = S.day; lo.status = 'contacted'; }
  const d = sh.dealListing(S, l.listing.listingId);
  return { 판값: d.won ?? (d.price&&d.price.won) ?? null, 판뒤화분: (S.pots||[]).map(p=>p.id), 판그루기록: Object.keys(S).filter(k=>/sold|판|archive/i.test(k)), before }; })()`, 60000)));
/* ②-b 판 «직후» — 생장 창(plant_grow)에 그 그루가 남나. 호출부는 io.growth.reset()(= resetDailyLight · 빛 장부)만 부른다 */
console.log('②-b 판 직후 생장 창 —', JSON.stringify(await J(`(()=>{ const g=window.__io.growth; const out={};
  try { out.multi = g.multi ? g.multi() : null; } catch(e) { out.multi='탈'; }
  try { out.plantIds = g.plantIds ? g.plantIds() : null; } catch(e) { out.plantIds='탈'; }
  try { out.current = g.current ? g.current() : null; } catch(e) { out.current='탈'; }
  try { out.leafStats = g.leafStats ? g.leafStats() : null; } catch(e) { out.leafStats='탈'; }
  try { out.화분수 = (window.__S().pots||[]).length; } catch(e) {}
  return out; })()`)));
/* ③④ 씨앗을 사서 심으면 — 새 그루인가 · 축복이 붙나 */
console.log('③④ 씨앗 심기 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const sh=await import('/src/game/shop.js'); const S=window.__S();
  const shop = sh.shopStatus(S); const stock = { ...(shop.stock||{}) };
  S.shop.stock[st.SEED_ITEM_ID] = (S.shop.stock[st.SEED_ITEM_ID]||0) + 1;
  S.shop.stock[st.SEED_POT_ITEM_ID] = (S.shop.stock[st.SEED_POT_ITEM_ID]||0) + 1;
  const before = (S.pots||[]).map(p=>p.id);
  const pot = st.plantMonsteraSeed(S, window.__io, {});
  const now = (S.pots||[]).map(p=>({ id:p.id, growthDays:p.growthDays ?? null, varie:!!p.variegated, prologue: p.prologue||null }));
  return { 씨앗값: sh.CATALOG[st.SEED_ITEM_ID].listWon, 심기함수: 'plantMonsteraSeed', before, 심은뒤: now }; })()`, 60000)));
/* ★ 판 «직후» 확대 창을 열면 «사람 눈»에 그 그루가 보이나 — 「있나」와 «보이나»는 다르다(총괄 ①②③) */
console.log('②-c 판 직후 확대 창 —', JSON.stringify(await J(`(async()=>{ const S=window.__S();
  try { if (S.firstPlay) S.firstPlay.enabled = false; window.__byeotHint && window.__byeotHint(); window.__redraw(); } catch(e){}
  const z = window.__byeotZoom; const opened = z ? z.open('__main__') : null; await new Promise(r=>setTimeout(r,1500));
  const g = document.getElementById('growth'); const r = g ? g.getBoundingClientRect() : null; const cs = g ? getComputedStyle(g) : null;
  return { 열렸나: !!(z && z.isOpen()), 무대: document.getElementById('stage').className,
           확대창: r ? { w:Math.round(r.width), h:Math.round(r.height), opacity: cs.opacity, 보임: r.width>0 && cs.opacity!=='0' } : null,
           돌아가기: (()=>{ const b=document.getElementById('closeZoom'); const q=b?b.getBoundingClientRect():null; return !!(q&&q.width>0); })() }; })()`, 60000)));
await page.shot('docs/handoff/img/sold_zoom.png').catch(() => {});
/* 사람 눈에 «어디»에 남나 — 방(3D) · [식물] 탭 목록 · 확대 단추 */
console.log('②-e 판 직후 사람 눈 —', JSON.stringify(await J(`(()=>{ 
  let plants=null; try { plants=(window.__rv.plants()||[]).map(p=>({key:p.key, potId:p.potId, kind:p.kind})); } catch(e) { plants='탈'; }
  try { window.__byeotSheet.open('plants'); } catch(e) {}
  const list=document.getElementById('plantList')||document.getElementById('pagePlants');
  return { 방그루: plants, 식물탭글: list ? (list.innerText||'').replace(/\s+/g,' ').trim().slice(0,120) : null,
           확대단추: (()=>{ const b=document.getElementById('pickZoom'); const r=b?b.getBoundingClientRect():null; return !!(r&&r.width>0); })() }; })()`, 30000)));
console.log('②-d 확대 창 «안»(iframe) —', await page.eval(`(async()=>{ try {
  const g=document.getElementById('growth'); const d=g&&g.contentDocument; if(!d) return '못 봄(다른 문서)';
  const c=d.querySelector('canvas'); const leaves=(d.body&&d.body.innerText||'').replace(/\s+/g,' ').slice(0,90);
  return JSON.stringify({ 캔버스: !!c, 글: leaves }); } catch(e) { return '못 봄: '+e.message; } })()`, true, 30000));
/* ②-f [식물] 탭에 남은 줄의 「🔍 확대」를 «눌러 본다» — 팔린 그루인데 누르면 무엇이 나나 */
console.log('②-f 남은 줄의 [확대] 누름 —', JSON.stringify(await J(`(()=>{
  const bs=[...document.querySelectorAll('#sheet button')].filter(b=>/확대/.test(b.textContent||'') && b.getBoundingClientRect().width>0);
  if (!bs.length) return { 단추: '없음' };
  const before = { 화분: (window.__S().pots||[]).map(p=>p.id), 그루id: (()=>{ try { return window.__io.growth.plantIds(); } catch(e) { return null; } })() };
  bs[0].click();
  const after = { 화분: (window.__S().pots||[]).map(p=>p.id) };
  return { 단추: (bs[0].textContent||'').trim().slice(0,10), 누르기전: before, 누른직후: after }; })()`, 30000)));
await sleep(1500);
console.log('②-g 누른 뒤 —', JSON.stringify(await J(`(()=>({ zoom: document.getElementById('stage').classList.contains('zoom'),
  무대: document.getElementById('stage').className,
  배너: ((document.getElementById('event')||{}).textContent||'').trim().replace(/\s+/g,' ').slice(0,80),
  확대창보임: (()=>{ const g=document.getElementById('growth'); const r=g?g.getBoundingClientRect():null; const cs=g?getComputedStyle(g):null; return !!(r&&r.width>0&&cs.opacity!=='0'); })(),
  화분수: (window.__S().pots||[]).length }))()`, 30000)));
await page.shot('docs/handoff/img/sold_zoom_click.png').catch(() => {});
/* ⑤ 판 뒤 «생장 창»에 그 그루가 남나 — 호출부는 io.growth.reset()(= resetDailyLight · 빛 장부)만 부른다 */
console.log('⑤ 판 뒤 생장 창 —', JSON.stringify(await J(`(()=>{ const g=window.__io.growth; const out={};
  try { out.multi = g.multi ? g.multi() : null; } catch(e) { out.multi='탈'; }
  try { out.current = g.current ? g.current() : null; } catch(e) { out.current='탈'; }
  try { out.leafStats = g.leafStats ? g.leafStats() : null; } catch(e) { out.leafStats='탈'; }
  try { out.화분수 = (window.__S().pots||[]).length; } catch(e) {}
  return out; })()`)));
await page.close();
