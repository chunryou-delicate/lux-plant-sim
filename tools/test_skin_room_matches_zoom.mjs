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

   ★ 2026-10-09 — 끝에 «새 두 종(PP · AL)» 단계를 더했다(게임 판 S.species.pots · core da423fb6). 아래 §새 두 종.
   ★ 2026-10-09 — 끝에 «조립 차례» 단계(어린 그루를 늙은 그루 뒤에 지어도 무늬가 사나 · 총괄 🔴 · leaf 82239a5e). 아래 §조립 차례.

   ⚠ 서버가 떠 있어야 한다:  python tools/serve.py 8971
     BYEOT_URL=http://localhost:8971 node tools/test_skin_room_matches_zoom.mjs
   ⛔ 값·밸런스는 한 톨도 안 건드린다. 놓고 · 그리고 · 읽을 뿐이다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const page = await launch({ width: 1770, height: 1188, dpr: 1 });
/* ★ 2026-10-08 — localStorage 를 «부팅 전»에 비우고 «한 번만» 연다. [leaf] 알림: 열기 → 비우기 → 다시 열기는
   붐빌 때 둘째 부팅이 300초에도 안 섰다. sessionStorage 표시로 «처음 한 번만» 비운다(새로 고침에 또 비우지 않게). */
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{ if(!sessionStorage.__growthCleared){ localStorage.clear(); sessionStorage.__growthCleared='1'; } }catch(e){}` });
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

/* ══ 무늬 판 — «무늬 잎이 갈라진 판»으로 견준다 (2026-10-08 · D4) · ★ 기본이다. VARIE=0 이면 옛 «잎 1장» 판 ═══
   ⚠ 기본 판(잎 1장 · 무늬 없음)으로는 방과 확대가 «무늬 그림»에서 갈리는 것을 못 잡았다.
     2026-10-07 에 실제 게임 260일로 재 보니 확대는 등급 그림(leaf_mat21), 방은 굴림(leaf_mat4 = 산반)이었다
     (probe_room_zoom_varie_skin). 그래서 이 갈래는 창턱에서 DAYS 일을 «게임 하루 진행 그대로» 키운다 —
     날마다 물(state.waterPot) · loop.runDays · 턴마다 게임이 하는 등급 두 줄(game.html §noteLeafGrades 와 같은 함수:
     shop.assignPotLeafGrades → potLeafSkinsOf → 확대 창 setLeafSkins).
   ⚠ 울타리 ④ — 무늬 잎이 한 장도 «갈라지지» 않았으면 FAIL. 그러면 이 갈래가 아무것도 안 잰 것이다.
   ★ [core] 가 방에 그림표를 넘긴 뒤(f6f1fb02 · b9817f04) 기본으로 올렸다. 그 전에는 방이 굴림이라 붉었다
     (2026-10-07 probe_room_zoom_varie_skin: 하프문 잎256 확대 leaf_mat21 · 방 leaf_mat4).
   ⚠ 260일을 키우므로 몇 분 걸린다. 빨리 보려면 VARIE=0(옛 잎 1장 판 — 무늬 그림은 못 잡는다). */
const VARIE = process.env.VARIE !== '0', DAYS = Number(process.env.DAYS || 260);
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

  /* ══ ★ 새 두 종(D45 · 2026-10-09 [growth]) — 게임 판 그대로: S.species.pots → 방(core cutpot spec → youngPlantOf) · 확대(setSpeciesView) ══
     ⚠ 확대를 «게임이» 여는 한 줄(setSpeciesView)은 core 차례다(da423fb6 때 «다음 차례»). 그때까지는 이 검사가 확대 창구를 직접 부른다 —
       core 가 부르는 꼴({ species, plant, potD } · seed·lightAz 안 줌)을 그대로 따른다. core 가 이으면 «게임이 연 확대»를 읽게 바꾼다.
     ★ 잎마다 자리·눕힘까지의 견줌은 tools/test_species_room_zoom(같은 그리개 · 그리는 층)이 한다. 여기는 «게임 판이 같은 그루를 두 곳에
       같은 잎으로 세우나»를 본다 — 잎 수 · 무늬 판 · 판 목록(정본 leafRows) · AL 구근은 둘 다 «화분만».
     울타리: 방에 «실제로 그려졌나»(drawn · 잎 수 > 0) · 판이 다 온 뒤 견줌 · 확대를 끄면 몬스테라 창구가 돌아오나 */
  const spBad = (m) => { console.log('⛔ ' + m); fail++; };
  console.log('\n  ── 새 두 종(게임 판) ──');
  const spIds = await J(`(async()=>{ const sp=await import('/src/game/species.js'); const S=window.__S(), io=window.__io; const R=sp.speciesRules();
    const used=new Set((S.pots||[]).map(p=>p.slotId).filter(Boolean));
    const free=(io.light.room.slots||[]).filter(s=>!used.has(s.slotId) && !/sill/.test(s.slotId));
    const put=(species, plant)=>{ const q=sp.addSpeciesPot(S, species, { plant, origin:'test' }); const s=free.shift(); sp.setSpeciesAt(S, q.id, { slotId:s.slotId }); return q.id; };
    const pp=R.newPlant('pink_princess', { seed:4242, pinks:[0,0.3,0.7,0.95], nodes:8 });
    const al=R.newPlant('alocasia_frydek', { seed:77, origin:'from_varie_mother', motherKind:'sector' }); for (let d=0; d<160; d++) R.stepDay(al, { dli:6, season:'summer' });
    const corm=R.newPlant('alocasia_frydek', { seed:5, origin:'shop' });
    const out={ pp:put('pink_princess', pp), al:put('alocasia_frydek', al), corm:put('alocasia_frydek', corm) };
    try { window.__redraw(); } catch(e) {}
    return out; })()`, 60000);
  if (!spIds || spIds.탈) spBad(`새 두 종을 판에 못 세웠다 — ${JSON.stringify(spIds)}`);
  else {
    /* 방 — 판이 다 올 때까지(무늬 판이 한 장씩 늦게 온다 · core 가 도착 뒤 다시 짓는다) */
    let rooms = null;
    for (let i = 0; i < 60; i++) {
      rooms = await J(`(()=>{ const ps=window.__rv.plants()||[]; const o={};
        for (const [k,id] of Object.entries(${JSON.stringify(spIds)})) { const p=ps.find(x=>x.potId===id); o[k]=p ? (p.young||null) : '없음'; } return o; })()`);
      const ready = Object.values(rooms).every(y => y && y !== '없음' && (y.drawn === false || !y.skinsPending));
      if (ready) break;
      if (i % 10 === 9) await page.eval(`(()=>{ try { window.__redraw(); } catch(e) {} })()`, false);
      await sleep(500);
    }
    /* 확대 — core 가 부를 꼴 그대로(seed·lightAz 안 줌) · 받는 중 0 까지 */
    const zooms = await J(`(async()=>{ const sp=await import('/src/game/species.js'); const S=window.__S(); const R=sp.speciesRules();
      const w=document.getElementById('growth').contentWindow; const o={};
      for (const [k,id] of Object.entries(${JSON.stringify(spIds)})) { const q=sp.speciesPotOf(S, id);
        const call=()=>w.setSpeciesView({ species:q.species, plant:q.plant, potD:0.18 });
        let r=await call(); for (let i=0; i<60 && r && r.skinsPending; i++) { await new Promise(z=>setTimeout(z,250)); r=await call(); }
        o[k]={ drawn:r.drawn, leafCount:r.leafCount, want:r.leafCountWanted, varie:(r.varieLeafKeys||[]).slice().sort(),
               assets:(r.leaves||[]).map(l=>l.asset), rule:(R.leafRows(q.plant)||[]).map(x=>x.asset) }; }
      const off=await w.setSpeciesView(null);
      o.__back={ on:off.on, skins:Array.isArray(w.leafSkinUsedAll && w.leafSkinUsedAll()) };
      return o; })()`, 120000);
    for (const k of ['pp', 'al']) {
      const m = rooms[k], z = zooms[k];
      if (!m || m === '없음' || !m.drawn || !(m.leafCount > 0)) { spBad(`${k}: 방에 «안 그려졌다»(${JSON.stringify(m)}) — 재는 것이 아니다`); continue; }
      const rv = (m.varieLeafKeys || []).slice().sort();
      const same = z && z.drawn && z.leafCount === m.leafCount && z.want === m.leafCountWanted && m.leafCount === m.leafCountWanted &&
                   JSON.stringify(z.varie) === JSON.stringify(rv) && JSON.stringify(z.assets) === JSON.stringify(z.rule);
      if (!same) spBad(`${k}: 방 잎 ${m.leafCount}/${m.leafCountWanted} · 무늬 ${JSON.stringify(rv)} ≠ 확대 잎 ${z && z.leafCount}/${z && z.want} · 무늬 ${JSON.stringify(z && z.varie)} (판 = 정본 ${z && JSON.stringify(z.assets) === JSON.stringify(z.rule)})`);
      else console.log(`✅ ${k}: 방 = 확대 — 잎 ${m.leafCount} · 무늬 판 ${rv.length}가지 · 판 목록 = 정본 leafRows`);
    }
    { const m = rooms.corm, z = zooms.corm;
      if (!(m && m !== '없음' && m.drawn === false && z && z.drawn === false)) spBad(`AL 구근(잎 0): 방 ${JSON.stringify(m)} · 확대 ${JSON.stringify(z)} — 둘 다 «화분만»이어야 한다`);
      else console.log('✅ AL 구근(잎 0) — 방도 확대도 화분만'); }
    if (!(zooms.__back && zooms.__back.on === false && zooms.__back.skins)) spBad(`확대를 끄면 몬스테라 창구가 돌아와야 한다 — ${JSON.stringify(zooms.__back)}`);
    else console.log('✅ 확대를 끄면 몬스테라로 돌아온다(leafSkinUsedAll 그대로)');
  }

  /* ══ ★ 조립 차례 (2026-10-09 · 총괄 🔴 · leaf 82239a5e 잡음) — «어린 그루를 늙은 그루 뒤에» 지어도 무늬가 산다 ══
     방 조립기는 한 인스턴스가 그루를 번갈아 짓는다. 앞 그루(늙은 모주 400일)보다 어린 그루(62일)를 지으면 원본 setGrowth 의
     «뒤로 가기» matResetAll() 이 방금 꽂은 잎 상태·무늬 표를 지워 무늬 잎이 민잎(leaf_mid1)으로 나왔다 — 확대는 무늬, 방은 민잎.
     고침: plant_assemble §assemble 이 plantSeed 앞에서 생장일을 «조용히» 내려놓는다(TAIL __lowerGrowthQuiet · 원본 안 바꿈).
     대조: 고치기 전 같은 차례로 «400일 뒤 화분 · 작은 그루 → leaf_mid1»(tools/leaf/_check_asm_order 머리 10-09 기록).
     ⚠ 그림(무늬 판)을 먼저 받아 둔 뒤 잰다 — 늦게 와서 민잎인 것과 갈라야 한다(울타리). */
  console.log('\n  ── 조립 차례(어린 그루를 늙은 그루 뒤에) ──');
  const ord = await J(`(async()=>{ const pa=await import('/src/render3d/plant_assemble.js'); const asm=await pa.getPlantAssembler({});
    const keys=p=>{ const ks=[]; if(p) p.traverse(x=>{ const k=x.userData&&x.userData.assetKey; if(k&&/^leaf/.test(k)) ks.push(k); }); return ks; };
    const SEED=4154389251, SKIN='leaf_mid_albo7';
    const pot=()=>keys(asm.assemble({ growthDays:62, seed:SEED, leafState:[{leafBirth:36, varie:true}], leafSkins:[{leafBirth:36, mid:SKIN, mat:'leaf_mat7'}] }));
    const young=()=>keys(asm.youngPlantOf({ seed:SEED, leaves:[{varie:true, midSkin:SKIN, matSkin:'leaf_mat7', matured:false}], nextLeaf01:0.45, potD:0.12, grewLeaves:0 }));
    asm.assemble({ growthDays:1, seed:999 }); pot(); for (let i=0; i<200 && asm.skinsPending(); i++) await new Promise(r=>setTimeout(r,100));
    const o={ skin:SKIN, pending:asm.skinsPending() };
    asm.assemble({ growthDays:1, seed:999 });     o['화분 · 1일 그루 뒤']=pot();
    asm.assemble({ growthDays:400, seed:12345 }); o['화분 · 400일 그루 뒤']=pot();
    asm.assemble({ growthDays:1, seed:999 });     o['작은 그루 · 1일 그루 뒤']=young();
    asm.assemble({ growthDays:400, seed:12345 }); o['작은 그루 · 400일 그루 뒤']=young();
    try { window.__redraw(); } catch(e) {}
    return o; })()`, 180000);
  if (!ord || ord.탈 || ord.pending) spBad(`조립 차례 판을 못 세웠다(무늬 판이 덜 옴?) — ${JSON.stringify(ord).slice(0, 200)}`);
  else for (const k of Object.keys(ord).filter(k => k !== 'skin' && k !== 'pending')) {
    const has = Array.isArray(ord[k]) && ord[k].includes(ord.skin);
    if (!has) spBad(`조립 차례 — ${k}: 무늬(${ord.skin})가 빠졌다 ${JSON.stringify(ord[k])}`);
    else console.log(`✅ 조립 차례 — ${k}: ${ord.skin}`);
  }

  console.log('\nskin_room_matches_zoom: ' + (fail ? 'FAIL' : 'PASS'));
  process.exitCode = fail ? 1 : 0;
  await page.close();
}
