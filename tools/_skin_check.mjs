/* _skin_check — 「확대가 쓰는 그림 열쇠」와 「방이 쓰는 그림 열쇠」를 «둘 다» 읽어 본다([growth] 청 ㉠㉡ · 2026-09-07)
   ⛔ 값 0 · 읽기만. 없으면 «null»(모른다)이어야 하고 []가 아니어야 한다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const page = await launch({ width: 1770, height: 1188, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4500);
const J = async (js, ms = 30000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
console.log('0 켠 직후 —', JSON.stringify(await J(`(()=>({ 확대: window.__io.growth.leafSkinUsedAll ? window.__io.growth.leafSkinUsedAll() : '창구없음',
  방: window.__rv.leafSkinsInRoom ? window.__rv.leafSkinsInRoom() : '창구없음' }))()`)));
console.log('1 그루 세움 —', JSON.stringify(await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js'); const S=window.__S();
  S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
  const a = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a);
  const p=(S.pots||[])[0]; const slots=window.__io.light.room.slots||[]; const slot=slots.find(x=>/sill/.test(x.slotId));
  st.setPotAt(S, p.id, { x:slot.x, y:slot.y, z:slot.z, slotId:slot.slotId }, { slots, size: window.__io.light.room.size });
  return { 자리:(S.pots||[])[0].slotId }; })()`, 60000)));
await sleep(800);
await page.eval(`(()=>{ try { window.__redraw(); } catch(e) {} })()`, false);   /* ⚠ 무거운 다시 그리기는 «기다리지 않고» 부른다 — 기다리면 CDP 가 약속을 놓친다 */
await sleep(3000);
const r = await J(`(()=>({ 확대: window.__io.growth.leafSkinUsedAll(), 방: window.__rv.leafSkinsInRoom() }))()`);
console.log('2 둘을 맞댐 —', JSON.stringify(r).slice(0, 700));
const keyOf = (x) => Array.isArray(x) ? x.map(v => v && v.key).join(',') : String(x);
console.log('   ⇒ 확대 열쇠:', keyOf(r.확대), '· 방 열쇠:', keyOf(r.방));
await sleep(4000);
const r2 = await J(`(async()=>{ const m=await import('/src/render3d/plant_assemble.js');
  let asm=null, 탈=null; try { asm = await m.getPlantAssembler({}); } catch(e) { 탈 = e.message; }
  return { 방: window.__rv.leafSkinsInRoom(), 방그루: (window.__rv.plants()||[]).length,
           조립기: asm ? Object.keys(asm).filter(k=>/leafSkin|leafStats/.test(k)) : null, 탈 }; })()`, 60000);
console.log('3 조금 뒤 다시 —', JSON.stringify(r2).slice(0, 400));
await page.close();
