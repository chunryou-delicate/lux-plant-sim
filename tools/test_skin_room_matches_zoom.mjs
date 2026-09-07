/* ============================================================
   test_skin_room_matches_zoom.mjs — 「방이 그리는 그림」과 「확대가 그리는 그림」이 같은가
   ([growth] 소유 · 2026-09-07)
   ------------------------------------------------------------
   ★ 왜 이 검사가 있나 — **그 사고는 이미 두 번 났다.**
     bf5dd20 「몬스테라 — 방과 확대가 «다른 그루»였다. 정본의 잎 상태를 받아 그리게 했다」
     7b573cb 「무늬가 «방에서는» 안 보였다」
     ⇒ 고쳤는데 «다시 갈렸는지 물을 자»가 없었다. 사람이 눈으로 봐야만 알았다. 그것을 없앤다.

   ★ 무엇을 맞대나 — `leafBirth` 로 짝지어 `key`(지금 쓰는 그림 열쇠)를 견준다.
     확대  `window.__io.growth.leafSkinUsedAll()`   (plant_grow 의 그 함수)
     방    `window.__rv.leafSkinsInRoom()`          (방이 지금 그리는 것)
     ⇒ 둘 다 [core] 가 2026-09-07 에 낸 읽기 전용 창구다(59319df).

   ⚠⚠ **저절로 초록이 되는 자리가 있다 — 그래서 울타리를 셋 친다.**
     ① 그루가 «없으면» 둘 다 부팅 기본값(잎 3줄)을 낸다 ⇒ 아무것도 안 재고 «같다»가 된다.
        ⇒ 그루가 실제로 있는지 `S.pots` 로 먼저 본다. 없으면 **FAIL** 이다.
     ② 줄이 0 개면 견줄 것이 없다 ⇒ 그것도 **FAIL** 이다. 「0/0 이 맞았다」는 답이 아니다.
     ③ `null` 은 「모른다」이고 `[]` 는 「없다」다. 둘을 섞지 않는다 — null 이면 **FAIL** 이다.
     ⇒ ★ 이 셋이 오늘(2026-09-07) 이 판에서 여섯 번 데인 그 모양이다:
       **「한 칸이 두 가지를 말하면 안 된다」 · 「빈칸과 조용함이 같아 보이면 안 된다」**

   ⚠ 서버가 떠 있어야 한다:  python tools/serve.py 8971
     BYEOT_URL=http://localhost:8971 node tools/test_skin_room_matches_zoom.mjs
   ⛔ 값·밸런스는 한 톨도 안 건드린다. 놓고 · 그리고 · 읽을 뿐이다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const page = await launch({ width: 1770, height: 1188, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4500);

const J = async (js, ms = 30000) => JSON.parse(await page.eval(
  `(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));

/* ── 그루를 창턱에 세운다 (자리 세우는 손은 [core] `_skin_check.mjs` 것을 그대로 빌렸다) */
const put = await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js');
  const S=window.__S();
  S.firstPlay.beansprout.harvestCount = fp.MONSTERA_ARRIVAL_RULE.harvestCount; S.firstPlay.beansprout.harvested = true;
  const a = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a);
  const p=(S.pots||[])[0]; const slots=window.__io.light.room.slots||[];
  const slot=slots.find(x=>/sill/.test(x.slotId));
  st.setPotAt(S, p.id, { x:slot.x, y:slot.y, z:slot.z, slotId:slot.slotId }, { slots, size: window.__io.light.room.size });
  return { 자리:(S.pots||[])[0].slotId, 그루수:(S.pots||[]).length }; })()`, 60000);
console.log('그루를 세웠다 —', JSON.stringify(put));

await sleep(800);
await page.eval(`(()=>{ try { window.__redraw(); } catch(e) {} })()`, false);   /* 무거운 다시 그리기는 기다리지 않고 부른다 */
await sleep(3500);

const r = await J(`(()=>({ 그루수:(window.__S().pots||[]).length,
  확대: window.__io.growth.leafSkinUsedAll ? window.__io.growth.leafSkinUsedAll() : '창구없음',
  방:   window.__rv.leafSkinsInRoom     ? window.__rv.leafSkinsInRoom()     : '창구없음' }))()`);

let fail = 0;
const bad = (m) => { console.log('⛔ ' + m); fail++; };

/* ── 울타리 ① 그루가 있어야 한다 (없으면 둘 다 부팅 기본값을 내고 저절로 같아진다) */
if (!(r.그루수 >= 1)) bad(`그루가 «없다»(pots ${r.그루수}) — 이 판은 부팅 기본값을 견주게 된다. 재는 것이 아니다`);
else console.log(`✅ 울타리① 그루 ${r.그루수}그루가 실제로 서 있다`);

/* ── 울타리 ③ null 은 「모른다」다. [] 와 섞지 않는다 */
for (const [ko, v] of [['확대', r.확대], ['방', r.방]]) {
  if (v === '창구없음') bad(`${ko} 창구가 «없다» — [core] 59319df 가 들어왔는지 보라`);
  else if (v === null)  bad(`${ko} 가 null(모른다)을 냈다 — 그릴 준비가 안 됐거나 창구가 안 닿는다`);
  else if (!Array.isArray(v)) bad(`${ko} 가 배열이 아니다: ${JSON.stringify(v).slice(0,80)}`);
}
if (fail) { console.log('\nskin_room_matches_zoom: FAIL'); process.exitCode = 1; await page.close(); }
else {
  /* ── 울타리 ② 견준 줄이 0 이면 그것도 실패다 */
  const zoom = new Map(r.확대.map(x => [x.leafBirth, x]));
  const room = new Map(r.방  .map(x => [x.leafBirth, x]));
  const keys = [...new Set([...zoom.keys(), ...room.keys()])].sort((a,b)=>a-b);
  if (keys.length === 0) bad('견줄 잎이 «한 장도» 없다 — 0/0 이 맞은 것은 답이 아니다');
  else console.log(`✅ 울타리② 견준 잎 ${keys.length}장`);

  console.log('\n  잎(leafBirth)   확대 열쇠           방 열쇠             ');
  for (const lb of keys) {
    const z = zoom.get(lb), m = room.get(lb);
    const zk = z ? String(z.key) : '⛔ 확대에 없음';
    const mk = m ? String(m.key) : '⛔ 방에 없음';
    const same = z && m && z.key === m.key && z.midNum === m.midNum && z.matNum === m.matNum;
    if (!same) fail++;
    console.log(`   ${String(lb).padStart(6)}        ${zk.padEnd(20)}${mk.padEnd(20)}${same ? '✅' : '⚠ 갈렸다'}`);
  }
  console.log(`\n⇒ 갈린 잎 ${fail}/${keys.length}` + (fail ? '' : '   ★ 방과 확대가 «같은 그림»을 그린다'));
  console.log('\nskin_room_matches_zoom: ' + (fail ? 'FAIL' : 'PASS'));
  process.exitCode = fail ? 1 : 0;
  await page.close();
}
