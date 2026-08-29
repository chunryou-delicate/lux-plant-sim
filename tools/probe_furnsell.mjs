/* tools/probe_furnsell.mjs — **가구를 «눌러서» 파는 길이 실제로 되나**
   ------------------------------------------------------------------
   총괄 금 ③: *"붙이고 «눌러» 보십시오. ⛔ 읽어서 「됐다」 하지 마십시오."*
   재는 것: ① 단추가 «뜨나»(갈래가 아닌 것에는 안 뜨나) ② 첫 탭이 «되묻나»(값·자리 수)
            ③ 둘째 탭에 «팔리나» — 돈·자리·3D·세이브 ④ ★ 화분 얹힌 것이 «막히나»(두 겹)
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4000);
for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
const J = async (e, t = 60000) => JSON.parse(await page.eval(e, true, t));
/* 가구 하나를 고른다 — 3D 광선 대신 §furnPicked.select 를 그대로 부른다(같은 함수다) */
const pick = (uid) => page.eval(`(()=>{ const f=(window.__rv.furniture()||[]).find(x=>x.uid===${JSON.stringify(uid)});
  if(!f) return 'no'; window.__furn.clear(); window.__furn.select({ ...f, name: f.preset }, 195, 400); return 'ok'; })()`);
const btn = () => J(`(()=>{ const b=document.getElementById('furnSell');
  return JSON.stringify({ 보이나: !!(b && b.style.display !== 'none'), 글자: b? b.textContent.trim():null,
    되묻는중: !!(b && b.classList.contains('armed')) }); })()`);
const tapSell = () => page.eval(`(()=>{ const b=document.getElementById('furnSell');
  if(!b) return 'no'; b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:9,pointerType:'touch'}));
  return 'ok'; })()`);
/* 알림은 #event 한 칸에 쌓인다(§banners) — 글자를 그대로 읽는다 */
const bannerKo = () => J(`(()=>{ const el=document.getElementById('event');
  return JSON.stringify({ 말: el? (el.textContent||'').replace(/\s+/g,' ').trim().slice(0,120) : null }); })()`);
const board = () => J(`(()=>{ const S=window.__S();
  return JSON.stringify({ 지갑:S.tutorial.cashWon, 자리:(window.__io.light.room.slots||[]).length,
    방가구:(window.__io.light.room.def.furniture||[]).length,
    '3D 가구':(window.__rv.furniture()||[]).length,
    판것:(S.home.furnitureSold||[]).slice() }); })()`);

console.log('■ 판 —', JSON.stringify(await board()));
console.log('');
console.log('=== ① 단추가 뜨나 ===');
for (const uid of ['banjiha-dresser', 'banjiha-sill', 'banjiha-growlight-stand']) {
  console.log('  ' + uid, await pick(uid), JSON.stringify(await btn()));
}
console.log('');
console.log('=== ④ 화분이 얹힌 가구를 누르면 — 막히나 ===');
console.log(' ', JSON.stringify(await J(`(()=>{ const S=window.__S();
  const slot=(window.__io.light.room.slots||[]).find(s=>String(s.slotId).startsWith('banjiha-dresser:'));
  S.emptyPots = S.emptyPots || [];
  S.emptyPots.push({ id:'probe-empty', slotId: slot.slotId, at:null });
  return JSON.stringify({ 얹은자리: slot.slotId }); })()`)));
await pick('banjiha-dresser');
await tapSell(); await sleep(600);
console.log('  누른 뒤 —', JSON.stringify(await btn()), '·', JSON.stringify(await bannerKo()));
console.log('  ⇒ 판 것 —', JSON.stringify(await J(`JSON.stringify((window.__S().home.furnitureSold||[]))`)));
await page.eval(`(()=>{ const S=window.__S();
  S.emptyPots=(S.emptyPots||[]).filter(p=>p.id!=='probe-empty'); })()`, false);
await sleep(300);
console.log('');
console.log('=== ②③ 되묻고 파나 ===');
await pick('banjiha-dresser');
const b0 = await board();
await tapSell(); await sleep(500);
console.log('  첫 탭 —', JSON.stringify(await btn()));
const t0 = Date.now();
await tapSell();
for (let i = 0; i < 40; i++) {
  await sleep(400);
  const sold = await page.eval(`String(((window.__S().home.furnitureSold)||[]).length>0)`);
  if (sold === 'true') break;
}
await sleep(2500);
const b1 = await board();
console.log('  둘째 탭 —', JSON.stringify(await bannerKo()));
console.log('  ★ 판 뒤 —', JSON.stringify(b1));
console.log('  ⇒ 달라진 것 —', JSON.stringify({
  '들어온 돈': b1.지갑 - b0.지갑, '자리': b0.자리 + '→' + b1.자리,
  '방 가구': b0.방가구 + '→' + b1.방가구, '3D 가구': b0['3D 가구'] + '→' + b1['3D 가구'],
  'ms': Date.now() - t0 }));
console.log('  단추 —', JSON.stringify(await btn()));
console.log('');
console.log('=== ③-b 새로 켜도 팔린 채로 있나(세이브) ===');
await page.eval(`(()=>{ try{ if(window.__save) window.__save(); }catch(e){} })()`, false);
await sleep(1200);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 500);
await sleep(3000);
console.log(' ', JSON.stringify(await board()));
await page.shot('docs/handoff/img/furnsell.png').catch(() => {});
await page.close(); clearTimeout(wd);
