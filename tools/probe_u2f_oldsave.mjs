/* U2-f ㉳ 자(총괄 11-04 · [plan] plan-nudge-u2f-20261104 잴 차례 ㉳) — 옛 세이브: questsWaitedOn 에 «칩 아닌 날» 기록이 없다 → 다시 켠 첫날 칩 줄 날수는 예전 셈
   세이브마다: 싣기 → game.html → 대사 넘김 → [다음 날] DAYS 번(기본 3) — 날마다 몬이 줄(__dlgLog) · 칩 · 칩 줄 열린 날 / 기다린 날 · 범용 셋(nudgeOffer · Ask · Worry · Back)
   적기만(표) + 단언: [다음 날]이 간다 · 처리 안 된 예외 0 · «다시 켠 첫날 걱정» 수를 적는다(FIRST_WORRY_MAX 를 주면 그 수 이하 단언)
   SAVES = 쉼표로 이은 경로(없으면 아래 기본 열) */
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9451', OUT = process.env.OUT || null;
const DAYS = Number(process.env.DAYS || 3);
const DEF = ['C:/Users/pc/AppData/Local/Temp/byeot-master/old_8b2c/8b2c_banjiha.json', 'C:/Users/pc/AppData/Local/Temp/byeot-master/old_8b2c/8b2c_oneroom.json',
  'C:/Users/pc/AppData/Local/Temp/byeot-master/old_8b2c/8b2c_nearEnd.json',
  'C:/Users/pc/byeot-core-keep/critic8/tworoom_shop_first.json', 'C:/Users/pc/byeot-core-keep/critic8/tworoom_care_first.json',
  'C:/Users/pc/byeot-core-keep/critic8/tworoom_breed_first.json', 'C:/Users/pc/byeot-core-keep/critic8/ready_d445.json',
  'C:/Users/pc/byeot-core-keep/critic8/careR_g_d720.json', 'C:/Users/pc/byeot-core-keep/u2e/moved_8aa170ce.json'];
const SAVES = (process.env.SAVES ? process.env.SAVES.split(',') : DEF).filter(Boolean);
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const GEN = ['nudgeOffer', 'nudgeAsk', 'nudgeWorry', 'nudgeBack'];
const exc = [];
let page = null;
const fresh = async () => { if (page) { try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); } }
  page = await launch({ width: 390, height: 844, dpr: 1 });   /* 11-04 메모리 — 사진 판정 없음 · 배율 1 */
  page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200)); });
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` }); };
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const talk = async () => { for (let i = 0; i < 120; i++) { const t = await J(`document.getElementById('stage').classList.contains('talking')`); if (t !== true) return i;
  await page.eval(`(()=>{ const b=document.getElementById('dlgBox'); if(b) b.click(); return 1; })()`, false); await sleep(180); } return 120; };
const shut = async () => { for (let i = 0; i < 12; i++) { const on = await J(`(()=>{ const p=document.querySelector('.pop.on'); if(!p) return false; const x=p.querySelector('.close,[data-close],button.no,button.cancel'); if(x){ x.click(); return true; } return 'stuck'; })()`);
  if (on !== true) return on; await sleep(300); } return 'stuck'; };
const chipNow = `(()=>{ const S=window.__S(), st=S.stamina||{}; let v=null; try { v=window.__questView && window.__questView(); } catch(e) {}
  const c=v && v.chip ? v.chip.id : null; const f=v && v.fresh && v.fresh[0] ? v.fresh[0].id : null;
  return { day:S.day, room:S.home && S.home.room, chip:c, chipWait: !!(v && v.chip && v.chip.waiting), fresh:f, on: c && st.questsOpenedOn ? st.questsOpenedOn[c] ?? null : null, waited: c && st.questsWaitedOn ? st.questsWaitedOn[c] ?? null : null,
           waitedN: st.questsWaitedOn ? Object.keys(st.questsWaitedOn).length : 0 }; })()`;
let firstWorry = 0;
const rows = [];
for (const f of SAVES) {
  const name = path.basename(f, '.json');
  if (!fs.existsSync(f)) { console.log(`  (없음) ${f}`); continue; }
  await fresh();
  await page.goto(`${BASE}/data/balance/homes.json`);
  await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(f, 'utf8'))}); localStorage.setItem('byeot.guideSeen','1'); return 1; })()`, false);
  await page.goto(`${BASE}/game.html`);
  try { await page.waitFor('!!window.__rv', 300000, 500); } catch (e) { ok(false, `[${name}] 방이 안 섬`, e.message); continue; }
  await sleep(3500); await talk(); await shut();
  const c0 = await J(chipNow);
  const n0 = await J(`(window.__dlgLog||[]).length`);
  console.log(`[${name}] 실음 — ${JSON.stringify(c0)}`);
  const days = [];
  for (let k = 0; k < DAYS; k++) {
    const d0 = await J(`window.__S().day`);
    /* [다음 날] — 밥상 창이 열리면 그때만 [이대로 다음 날](red80 첫 판은 둘을 다 눌러 하루가 두 번 갔다) */
    await page.eval(`(()=>{ const n=document.getElementById('next'); if(n && !n.disabled) n.click(); return 1; })()`, false); await sleep(900);
    if ((await J(`window.__S().day`)) === d0) {
      await page.eval(`(()=>{ const g=document.getElementById('mealGo'); const p=g && g.closest('.pop'); if(g && (!p || p.classList.contains('on'))) g.click(); return 1; })()`, false); }
    await sleep(2500);
    await talk(); await shut(); await sleep(500); await talk();
    const d1 = await J(`window.__S().day`);
    const said = await J(`(window.__dlgLog||[]).slice(${n0}).filter(e=>e.day===${JSON.stringify(d1)}).map(e=>e.id)`);
    const c1 = await J(chipNow);
    days.push({ d0, d1, said, chip: c1 });
    console.log(`  [${name}] ${d0} → ${d1} · 칩 ${c1.chip}${c1.chipWait ? '(기다림)' : ''}${c1.fresh ? ' · 새 줄 ' + c1.fresh : ''} · 열린 날 ${c1.on} · 기다린 날 ${c1.waited} · 말 ${JSON.stringify(said)}`);
    if (d1 === d0) break;
  }
  /* 첫 누름부터 안 넘어가는 판(옛 반지하 세이브 · 시루를 안 놓은 첫 플레이 문지기 — 옛 판과 같은 막힘 · probe_old_saves ⑤)은 적기만 */
  const stuck0 = days.length === 1 && days[0].d1 === days[0].d0;
  const hint0 = stuck0 ? await J(`(window.__hintLast && window.__hintLast.say) || null`) : null;
  if (stuck0) console.log(`  [${name}] [다음 날] 첫 누름부터 막힘(적기만 · 손가락 «${hint0}»)`);
  else ok(days.length > 0 && days.every(x => Number.isFinite(x.d1) && x.d1 === x.d0 + 1), `[${name}] [다음 날] ${DAYS}번 간다`, JSON.stringify(days.map(x => `${x.d0}→${x.d1}`)));
  const g1 = days[0] ? days[0].said.filter(id => GEN.includes(id)) : [];
  if (g1.includes('nudgeWorry')) firstWorry++;
  rows.push({ name, day: c0.day, room: c0.room, chip0: c0.chip, first: g1, all: days.flatMap(x => x.said.filter(id => GEN.includes(id) || /^nudge/.test(id))) });
  if (OUT) await page.shot(`${OUT}/${name}_after.png`);
}
console.log('\n■ 다시 켠 첫날 · 범용 셋(적기만)');
for (const r of rows) console.log(`  ${r.name} Day ${r.day} ${r.room} · 칩 ${r.chip0} · 첫날 범용 ${JSON.stringify(r.first)} · ${DAYS}일 독촉 ${JSON.stringify(r.all)}`);
console.log(`  다시 켠 첫날 걱정(nudgeWorry) 판 수: ${firstWorry} / ${rows.length}`);
if (process.env.FIRST_WORRY_MAX != null) ok(firstWorry <= Number(process.env.FIRST_WORRY_MAX), `다시 켠 첫날 걱정 ${firstWorry} ≤ ${process.env.FIRST_WORRY_MAX}`);
ok(exc.length === 0, '처리 안 된 예외 0', exc.slice(0, 3).join(' / '));
try { await page.close(); } catch (e) { console.log('  (탭 닫기 탈)', e.message); }
console.log(bad ? `probe_u2f_oldsave: 빨강 ${bad}` : 'probe_u2f_oldsave: 다 통과');
process.exit(bad ? 1 : 0);
