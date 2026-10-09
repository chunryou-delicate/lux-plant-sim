/* tools/probe_old_saves.mjs — **옛 판 세이브를 지금 판에 싣는다**(core · 2026-10-10 · 총괄 «옛 판 세이브 싣기 걸음»)
   ------------------------------------------------------------------
   오늘 세이브 칸이 많이 늘었다(새 두 종 · 가게 · 성별 · 캐릭터 · 벽 걸이 …). 박사님 폰에 남은 옛 세이브가 새 판에서 서는지 잰다.
   세이브는 probe_old_save_make 가 «옛 코드로» 뜬 것(<LABEL>_<단계>.json · localStorage 글 그대로).
     OLD=<폴더> BYEOT_URL=http://127.0.0.1:9320 node tools/probe_old_saves.mjs     (OUTDIR=… 이면 사진)
   세이브마다:
     ① 이어 붙었다 — 날·방이 세이브와 같다(못 읽으면 게임이 «새로 시작»으로 간다 — 그것을 잡는다)
     ② 방이 선다 · ③ 처리 안 된 예외 0 · ④ 할 일 칩 글
     ⑤ [다음 날] — 하루 간다(막히면 그 까닭 글을 적는다 · 첫 플레이 문지기 «시루» 면 옛 판과 같은 막힘)
     ⑥ 저장 → 다시 켬 왕복 — 그 판 그대로 */
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9320';
const OLD = process.env.OLD;
const OUTDIR = process.env.OUTDIR || null; if (OUTDIR) fs.mkdirSync(OUTDIR, { recursive: true });
if (!OLD) { console.error('OLD=<probe_old_save_make 폴더> 가 필요합니다'); process.exit(2); }
const wd = setTimeout(() => { console.error('⏱ 자가 제한(40분)'); process.exit(2); }, 2400000); wd.unref && wd.unref();
const files = fs.readdirSync(OLD).filter(f => /\.json$/.test(f)).sort();
const rows = []; let bad = 0;
const ok = (c, m, extra) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) bad++; return c; };
const broke = (save, what, got, want, sev) => rows.push({ save, what, got, want, sev });
const page = await launch();
const exc = [], warns = [];
page.on((method, p) => {
  if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 200));
  if (method === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'warning')) warns.push(`${p.type}: ` + (p.args || []).map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
});
await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true;` });
const J = async (js, ms = 180000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
const shot = async n => { if (OUTDIR) await page.shot(`${OUTDIR}/${n}.png`); };
const talk = async (max = 80) => { for (let i = 0; i < max; i++) {
  if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') return;
  await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(160); } };
const digest = `(()=>{ const S=window.__S(); return { day:S.day, room:S.home.room, cash:S.tutorial.cashWon, moved:!!S.tutorial.movedOut, pots:(S.pots||[]).length,
  cuts:(S.cuttings||[]).length, added:(S.home.furnitureAdded||[]).length, job:S.story.job && S.story.job.id, hero:S.hero || null, sp:S.species ? S.species.pots.length : null }; })()`;
const view = `(()=>({ rv: !!window.__rv, room: window.__rv && window.__rv.roomId, failed: document.getElementById('stage').classList.contains('room-failed'),
  chip: (document.getElementById('questChipText') || {}).textContent || '', quest: ((document.getElementById('quest') || {}).textContent || '').slice(0, 60),
  lost: (window.__S().log || []).some(l => /못 읽어 새로 시작/.test(l.msg || '')) }))()`;
const boot = async () => { await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(5000); await talk(); };
try {
  for (const f of files) {
    const name = f.replace(/\.json$/, '');
    const text = fs.readFileSync(path.join(OLD, f), 'utf8');
    const want = JSON.parse(text).state;
    const e0 = exc.length, w0 = warns.length;
    await page.goto(`${BASE}/data/balance/homes.json`);
    await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(text)}); return 1; })()`, false);
    await boot();
    const d0 = await J(digest), v = await J(view);
    console.log(`[${name}] 실음 —`, JSON.stringify(d0), JSON.stringify(v));
    await shot(`${name}_1_boot`);
    if (!ok(!v.lost && d0.day === want.day && d0.room === want.home.room, `[${name}] ① 이어 붙었다(Day ${want.day} · ${want.home.room} → Day ${d0.day} · ${d0.room})`))
      broke(name, '이어 붙기', `Day ${d0.day} · ${d0.room}${v.lost ? ' · «못 읽어 새로 시작»' : ''}`, `Day ${want.day} · ${want.home.room}`, '높음');
    if (!ok(v.rv && !v.failed, `[${name}] ② 방이 선다(${v.room})`)) broke(name, '방', JSON.stringify(v), '방뷰', '높음');
    if (!ok(!!(v.chip || v.quest), `[${name}] ④ 할 일 글(${v.chip || v.quest})`)) broke(name, '할 일 칩', '비었다', '글', '중간');
    /* ⑤ 하루 */
    await page.eval(`(()=>{ const n=document.getElementById('mealGo'); if(n) n.click(); })()`, false); await sleep(2500); await talk(); await sleep(600);
    const d1 = await J(digest);
    if (d1.day !== d0.day + 1) {
      const why = await J(`(()=>({ next: ((document.getElementById('mealGo')||{}).textContent||'').trim().slice(0,40), hint: ((document.getElementById('hint')||{}).textContent||'').trim().slice(0,60),
        banner: ((document.getElementById('event')||{}).textContent||'').trim().slice(0,60) }))()`);
      const gate = /시루/.test(JSON.stringify(why));
      console.log(`  · [다음 날]이 안 갔다 — ${JSON.stringify(why)}${gate ? ' (첫 플레이 문지기 · 옛 판과 같은 막힘)' : ''}`);
      if (!ok(gate, `[${name}] ⑤ [다음 날](${d0.day} → ${d1.day})`, gate ? '시루 문지기' : '')) broke(name, '[다음 날]', JSON.stringify(why), '하루 감', '높음');
    } else ok(true, `[${name}] ⑤ [다음 날](${d0.day} → ${d1.day})`);
    /* ⑥ 저장 왕복 */
    await page.eval(`(()=>{ try { window.__redraw(); } catch(e){} })()`, false); await sleep(1300);
    const before = await J(digest);
    await boot();
    const after = await J(digest);
    const same = JSON.stringify(before) === JSON.stringify(after);
    if (!ok(same, `[${name}] ⑥ 저장 → 다시 켬 왕복`, same ? '' : JSON.stringify({ before, after }))) broke(name, '세이브 왕복', JSON.stringify(after), JSON.stringify(before), '높음');
    const ne = exc.slice(e0);
    if (!ok(ne.length === 0, `[${name}] ③ 처리 안 된 예외 0`, ne.slice(0, 2).join(' / '))) broke(name, '예외', ne.slice(0, 2).join(' / '), '0', '높음');
    const nw = warns.slice(w0).filter(w => /세이브|저장|못 읽|migrat|옛/.test(w));
    if (nw.length) console.log(`  · 세이브 쪽 경고 ${nw.length} — ${[...new Set(nw)].slice(0, 3).join(' / ')}`);
    await shot(`${name}_2_after`);
  }
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; broke('걸음', '탈', e && e.message, '끝까지', '높음'); }
finally { await page.close(); }
console.log('\n■ 깨진 곳 표');
if (!rows.length) console.log('  (없음)');
for (const r of rows) console.log(`  | ${r.save} | ${r.what} | 실제 ${r.got} | 기대 ${r.want} | ${r.sev} |`);
console.log(bad ? `probe_old_saves: FAIL (${bad})` : 'probe_old_saves: PASS');
process.exit(bad ? 1 : 0);
