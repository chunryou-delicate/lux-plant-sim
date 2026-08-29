/* tools/leaf/_shot_potcolor.mjs — 화분 색 판이 «폰에서» 읽히나 (2026-08-29 · leaf)

   방에 화분 셋을 놓고 기본·민트(_c1)·핑크(_c2) 로 갈아 끼운 뒤 390×844 로 찍는다.

   ⚠⚠ 1판이 «못 쓰는 판»이었다 — 놓은 **뒤에** potAsset 을 넣고 `__redraw` 만 불렀다.
     그런데 `swapPotMesh` 는 **방을 조립할 때** 불린다(`room_view.js:2019`).
     그래서 셋 다 기본 화분인 채로 찍혔을 수 있는데 **그것을 확인하지 않았다.**
   ⇒ ★ 그래서 둘을 고쳤다:
       ① 값을 넣은 뒤 **페이지를 다시 불러** 방을 새로 조립시킨다(세이브를 왕복한다)
       ② ★★ **어떤 GLB 를 실제로 받았는지 그물로 잡아 찍는다.**
          「색이 갈렸다」를 짐작이 아니라 **받은 파일 이름으로** 말한다.
*/
import { launch, sleep } from '../test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const OUT  = process.argv[2] || 'C:/Users/pc/AppData/Local/Temp/claude/c--Users-pc-Desktop----/67e12a96-f07d-43a9-9536-b9d00602285c/scratchpad';
const A = ['pots/pot_concrete_round.glb', 'pots/pot_concrete_round_c1.glb', 'pots/pot_concrete_round_c2.glb'];

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const got = [];
page.on((m, p) => { if (m === 'Network.requestWillBeSent' && /pot[^/]*\.glb/i.test(p.request?.url || ''))
                      got.push((p.request.url.split('/assets/')[1] || p.request.url)); });

await page.goto(`${BASE}/game.html`); await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300); await sleep(6000);

const clear = async () => { for (let i = 0; i < 30; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (!b) return;
  await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;} const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false);
  await sleep(250); } };
await clear();

await page.eval(`(()=>{const S=window.__S();
  S.shop.stock.monstera_seed=3; S.shop.stock.pot_concrete_round=3;
  if(S.firstPlay&&S.firstPlay.monstera)S.firstPlay.monstera.arrived=true;
  if(S.stamina)S.stamina.usedToday=0; window.__redraw&&window.__redraw();})()`, false);
await sleep(400);
for (let i = 0; i < 3; i++) { await page.eval(`window.__placePot('monsteraSeed:pot_concrete_round')`, false); await sleep(1600); }

const set = await page.eval(`(()=>{const S=window.__S();
  const A=${JSON.stringify(A)};
  const list=(S.pots&&S.pots.length?S.pots:(S.emptyPots||[]));
  list.slice(0,3).forEach((p,i)=>{ p.potAsset=A[i]; });

  return JSON.stringify(list.slice(0,3).map(p=>({id:p.id,a:p.potAsset,slot:p.slotId})));})()`);
console.log('  색 지정:', set);
await sleep(600);

/* ★★ 2판도 못 쓰는 판이었다 — `window.__save` 가 «없어서» 아무것도 안 실렸고,
   다시 부르니 potAsset 이 통째로 사라졌다(그물이 monstera/pot.glb 하나만 잡았다).
   ⇒ 다시 부르지 않는다. 방을 **그 자리에서 다시 조립**시킨다 — `roomView.setRoom` 이 그 문이다. */
got.length = 0;
await page.eval(`window.__rv.setRoom('banjiha')`, false);
await sleep(7000);
await clear();
console.log('  ★ 다시 부른 뒤 실제로 받은 화분 GLB:', JSON.stringify([...new Set(got)]));
console.log('  화분 상태:', await page.eval(`(()=>{const S=window.__S();
  const list=(S.pots&&S.pots.length?S.pots:(S.emptyPots||[]));
  return JSON.stringify(list.slice(0,3).map(p=>({id:p.id,a:p.potAsset,slot:p.slotId})));})()`));
await page.shot(`${OUT}/potcolor_room.png`);
console.log('  찍음 potcolor_room.png');
await page.close();
