/* tools/probe_seed_ledger.mjs — **씨앗 그루의 무늬 잎이 등급 장부에 적히나**(core · 2026-10-24 · 총괄 D82 ④)
   ------------------------------------------------------------------
   예전 화면(noteLeafGrades)은 «지금 꽂힌 그루»(첫 화분)만 장부에 적어 씨앗 그루의 무늬 잎이 값·그림에서 산반(legacy)으로 떨어졌다.
   이 자는 하네스 세이브(원룸 판)를 싣고 → 빈 밝은 자리에 몬스테라 씨앗을 심고(state §plantMonsteraSeed · 게임 손과 같은 함수) →
   [다음 날]을 화면 손으로 눌러 → 씨앗 그루의 «무늬 잎 수(생장 정본)»와 «장부에 적힌 무늬 잎 수»가 같은지 본다.
     DUMP=<probe_branches --dump 폴더> PFX=careR_g STAGE=care0 BYEOT_URL=http://127.0.0.1:9300 node tools/probe_seed_ledger.mjs
   ⚠ 값을 안 바꾼다(씨앗·그릇 재고 하나씩만 채움 — 심는 손을 위한 것 · 씨앗 그루 물은 날마다 채운다 — 하네스와 같은 지름길 · 재는 것은 장부다).
   ⚠ 읽기는 생장 창 select(그루 id)로 — 이번 고침(loop selectPlantFor 내보냄)에 안 기대야 고치기 전 판(HEAD)에도 같은 자를 댈 수 있다 */
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
const DUMP = process.env.DUMP, PFX = process.env.PFX || 'careR_g', STAGE = process.env.STAGE || 'care0';   /* 투룸(빈 자리가 많다) */
const DAYS = +(process.env.DAYS || 70);
const SEED = process.env.SEED ? +process.env.SEED : null;   /* 그루 씨앗(생장 난수) — probe_seed_varie --real 이 «무늬를 낸 씨앗»으로 고른 것 */
const OUT = process.env.OUTDIR || null; if (OUT) fs.mkdirSync(OUT, { recursive: true });
if (!DUMP) { console.error('DUMP=<probe_branches --dump 폴더> 가 필요합니다'); process.exit(2); }
const wd = setTimeout(() => { console.error('⏱ 자가 제한(30분)'); process.exit(2); }, 1800000); wd.unref && wd.unref();

let bad = 0;
const ok = (c, m, extra) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) bad++; return c; };
const page = await launch();
const exc = [];
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js, ms = 180000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
const talk = async (max = 80) => { for (let i = 0; i < max; i++) { const on = await J(`document.getElementById('stage').classList.contains('talking')`); if (!on) return; await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(160); } };
const closePops = () => page.eval(`(()=>{ for (const id of ['monthClose','shopEndGo']) { const b=document.getElementById(id); if (b && b.offsetParent) b.click(); } return 1; })()`, false);

try {
  const text = fs.readFileSync(path.join(DUMP, `${PFX}_${STAGE}.json`), 'utf8');
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(text)}); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(5000); await talk();
  /* 씨앗을 심는다 — 빈 자리 중 오늘 가장 밝은 데(게임 손: state.plantMonsteraSeed) */
  const sown = await J(`(async()=>{ const st=await import('/src/game/state.js'); const SPM=await import('/src/game/species.js'); const loop=await import('/src/game/loop.js');
    const S=window.__S(), io=window.__io, slots=io.light.room.slots||[], size=io.light.room.size; const sky=io.light.skyFor(S.day,S.sim);
    const occ=new Set([...(S.pots||[]).map(p=>p.slotId), ...(S.cuttings||[]).map(c=>c.slotId), ...SPM.speciesPotsOf(S).map(q=>q.slotId)].filter(Boolean));
    let b=null,bd=-1; for (const sl of slots){ if(occ.has(sl.slotId)) continue; let d=-1; try{ d=io.light.dliOfSlot(sl.slotId, loop.lightOptsOf(S, sky)); }catch(e){ d=-1; } if(d>bd){bd=d;b=sl;} }
    if (!b) return { err: '빈 자리 없음' };
    S.shop.stock[st.SEED_ITEM_ID]=(S.shop.stock[st.SEED_ITEM_ID]||0)+1; S.shop.stock[st.SEED_POT_ITEM_ID]=(S.shop.stock[st.SEED_POT_ITEM_ID]||0)+1;
    const pot = st.plantMonsteraSeed(S, io, { slots, size, at: { x:b.x, y:b.y, z:b.z }, log: ()=>{}, ...(${JSON.stringify(SEED)} != null ? { seed: ${JSON.stringify(SEED)} } : {}) });
    pot.slotId = b.slotId; window.__redraw && window.__redraw();
    return { potId: pot.id, growthId: pot.growthId, slot: b.slotId, dli: +bd.toFixed(2), pots: S.pots.length }; })()`);
  console.log('[심음] —', JSON.stringify(sown));
  if (!ok(sown && sown.potId && !sown.err, `씨앗 그루를 심었다(${sown && sown.slot} · DLI ${sown && sown.dli})`, sown && sown.err)) throw new Error('못 심어 못 잼');
  let firstV = null;
  for (let d = 1; d <= DAYS; d++) {
    await closePops();
    await page.eval(`(()=>{ const S=window.__S(); const p=S.pots.find(x=>x.id===${JSON.stringify(sown.potId)}); if (p) p.wateredOnDay = S.day; return 1; })()`, false);
    await page.eval(`(()=>{ const n=document.getElementById('mealGo') || document.getElementById('next'); if(n) n.click(); })()`, false); await sleep(1800); await talk(); await closePops();
    if (d % 10 === 0 || d === DAYS) {
      const r = await J(`(async()=>{ const shop=await import('/src/game/shop.js'); const loop=await import('/src/game/loop.js'); const st=await import('/src/game/state.js');
        const S=window.__S(), io=window.__io; const pot=S.pots.find(p=>p.id===${JSON.stringify(sown.potId)}); if(!pot) return { gone:true };
        io.growth.select(pot.growthId); const ls=io.growth.leafStats(); const vs=(io.growth.leafState()||[]).filter(r=>r.varie && !r.dropped).map(r=>r.leafBirth);
        st.selectLeadPlant(S, io.growth);
        const led=shop.potLeafGradesOf(pot)||{}; const p0=S.pots[0]; const led0=shop.potLeafGradesOf(p0)||{};
        return { day:S.day, leaves:ls.leaves, varie:ls.variegatedLeaves, varieBirths:vs, ledger:led, ledgerN:Object.keys(led).length, leadLedgerN:Object.keys(led0).length }; })()`);
      console.log(`  ${d}일 —`, JSON.stringify(r));
      if (r && r.varie > 0 && firstV == null) firstV = r;
      if (d === DAYS) {
        if (!ok(r && !r.gone && !r.탈, `씨앗 그루가 ${DAYS}일 뒤에도 있다`, JSON.stringify(r).slice(0, 160))) break;
        /* 무늬 잎이 하나도 없으면 장부를 잰 것이 아니다 — «못 잼»으로 떨어진다(늘 참 금지) */
        ok(r.varie > 0, `씨앗 그루가 무늬 잎을 냈다(${r.varie}장 · 못 내면 장부를 못 잼)`);
        const missing = (r.varieBirths || []).filter(b => !(String(b) in (r.ledger || {})));
        ok(r.varie > 0 && missing.length === 0, `씨앗 그루의 무늬 잎이 다 장부에 있다(무늬 ${r.varie} · 장부 ${r.ledgerN} · 빠진 잎 ${JSON.stringify(missing)})`);
        ok(Object.values(r.ledger || {}).every(g => typeof g === 'string' && g.length > 0), '장부 등급이 다 이름이다', JSON.stringify(r.ledger));
        ok(r.leadLedgerN > 0, `첫 화분 장부는 그대로 있다(${r.leadLedgerN})`);
      }
    }
  }
  console.log('  · 씨앗 그루 첫 무늬 —', JSON.stringify(firstV));
  if (OUT) await page.shot(`${OUT}/seed_ledger.png`);
  ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 2).join(' / '));
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; }
finally { await page.close(); }
console.log(bad ? `probe_seed_ledger: FAIL (${bad})` : 'probe_seed_ledger: PASS');
process.exit(bad ? 1 : 0);
