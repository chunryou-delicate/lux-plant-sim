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

/* ══ VARIE=1 — «무늬 잎이 갈라진 판»으로 견준다 (2026-10-08 · D4) ══════════════════════════
   ⚠ 기본 판(잎 1장 · 무늬 없음)으로는 방과 확대가 «무늬 그림»에서 갈리는 것을 못 잡았다.
     2026-10-07 에 실제 게임 260일로 재 보니 확대는 등급 그림(leaf_mat21), 방은 굴림(leaf_mat4 = 산반)이었다
     (probe_room_zoom_varie_skin). 그래서 이 갈래는 창턱에서 DAYS 일을 «게임 하루 진행 그대로» 키운다 —
     날마다 물(state.waterPot) · loop.runDays · 턴마다 게임이 하는 등급 두 줄(game.html §noteLeafGrades 와 같은 함수:
     shop.assignPotLeafGrades → potLeafSkinsOf → 확대 창 setLeafSkins).
   ⚠ 울타리 ④ — 무늬 잎이 한 장도 «갈라지지» 않았으면 FAIL. 그러면 이 갈래가 아무것도 안 잰 것이다.
   ⚠ [core] 가 방에 그림표를 넘기기 전에는 이 갈래가 «붉은 것이 맞다». 고친 뒤 초록이 된다. */
const VARIE = process.env.VARIE === '1', DAYS = Number(process.env.DAYS || 260);
if (VARIE) {
  const grown = await J(`(async()=>{ const st=await import('/src/game/state.js'); const lp=await import('/src/game/loop.js'); const sh=await import('/src/game/shop.js');
    const S=window.__S(), io=window.__io; const errs=[];
    for (let d=0; d<${DAYS}; d++){
      try { st.waterPot(S); } catch(e) { if(errs.length<3) errs.push('물:'+e.message.slice(0,50)); }
      lp.runDays(S, io, 1, (t) => { try {
        sh.assignPotLeafGrades(S, { leafState: io.growth.leafState(), band: (t&&t.growthSpeed&&t.growthSpeed.band)||null });
        const w=document.getElementById('growth').contentWindow, p0=(S.pots||[])[0];
        if (w && w.setLeafSkins && p0) w.setLeafSkins(Object.entries(sh.potLeafSkinsOf(S, p0)||{}).map(([lb,v])=>({leafBirth:+lb, ...v})));
      } catch(e) { if(errs.length<3) errs.push('등급:'+e.message.slice(0,60)); } });
    }
    const ls=io.growth.leafState()||[];
    return { errs, 무늬: ls.filter(r=>r.varie).length, 갈라진무늬: ls.filter(r=>r.varie&&r.matured).length }; })()`, 1800000);
  console.log(`키웠다(${DAYS}일) —`, JSON.stringify(grown));
  if (!(grown.갈라진무늬 >= 1)) { console.log(`⛔ 울타리④ 갈라진 무늬 잎이 «0장» — 이 판은 무늬 그림을 안 잰다`); process.exitCode = 1; await page.close(); process.exit(1); }
  console.log(`✅ 울타리④ 갈라진 무늬 잎 ${grown.갈라진무늬}장`);
}

await sleep(800);
await page.eval(`(()=>{ try { window.__redraw(); } catch(e) {} })()`, false);   /* 무거운 다시 그리기는 기다리지 않고 부른다 */
await sleep(VARIE ? 9000 : 3500);   /* VARIE — 무늬 그림이 한 장씩 늦게 온다. 덜 오면 열쇠가 잠깐 기본잎으로 보인다(leafSkinUsedAll §key) */

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
