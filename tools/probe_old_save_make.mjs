/* tools/probe_old_save_make.mjs — **옛 판 게임 코드로 «진짜» 세이브를 뜬다**(core · 2026-10-10 · 총괄 «옛 판 세이브 싣기»)
   ------------------------------------------------------------------
   박사님 폰에 남아 있을 옛 세이브가 새 판에서 서는지 재려면, 세이브는 «그 옛 코드»가 써야 한다(지금 코드로 뜬 세이브는 옛 칸을 모른다).
   ⇒ 옛 커밋을 작은 복사본(git archive · assets 는 연결)으로 띄우고, 그 게임이 «제 손으로» 저장한 localStorage(byeot/save/1)를 떠 온다.
   옛 판에도 있던 손잡이만 쓴다: window.__S · __io · __rv · __redraw · 코어 모듈(state · first_play · loop) · #moveOut/#moveGo 단추.
     OLD_URL=http://127.0.0.1:9321 LABEL=1007 OUT=<폴더> node tools/probe_old_save_make.mjs
   뜨는 것(<LABEL>_<단계>.json — localStorage 글 그대로):
     banjiha  선물 그루를 창턱에 놓고 30일(물 줌)            · oneroom 이사(단추) → 원룸 창턱에 그루 → 20일
     nearEnd  원룸 · 지갑을 목표 바로 밑(4,990,000)으로 두고 하루 — 엔딩 «직전» 판
   START_SAVE=<파일>(그 옛 판의 probe_force5 로 «걸은» 세이브)를 주면 거기서 시작한다 — 퀘스트·체력·시루 칸이 사람 손으로 찬 판이라
     지름길 판보다 폰 세이브에 가깝다. 단계 이름 앞에 W 가 붙는다(Wbanjiha · Woneroom · WnearEnd)
   ⚠ 판을 세우는 손질(선물 · 이사 조건 · 지갑)은 «세이브의 꼴»을 얻으려는 것이다 — 재는 것은 그 세이브를 새 판이 읽느냐다(probe_old_saves). */
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.OLD_URL; const LABEL = process.env.LABEL || 'old'; const OUT = process.env.OUT;
const START = process.env.START_SAVE || null; const PFX = START ? 'W' : '';
if (!BASE || !OUT) { console.error('OLD_URL · OUT 가 필요합니다'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const wd = setTimeout(() => { console.error('⏱ 자가 제한(20분)'); process.exit(2); }, 1200000); wd.unref && wd.unref();
const page = await launch();
const exc = [];
page.on((method, p) => { if (method === 'Runtime.exceptionThrown') exc.push(((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || '').split('\n')[0].slice(0, 160)); });
await page.send('Runtime.enable');
const J = async (js, ms = 300000) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, ms));
const skip = async () => { for (let k = 0; k < 3; k++) { for (let i = 0; i < 60; i++) {
  if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s && s.offsetParent) s.click(); else { const x=document.getElementById('dlgBox'); if(x)x.click(); }})()`, false); await sleep(160); } await sleep(300); } };
const boot = async () => { await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(4500); await skip(); };
const grab = async (stage) => {
  await page.eval(`(()=>{ try { window.__redraw(); } catch(e){} })()`, false); await sleep(1500);
  const text = await J(`(()=>localStorage.getItem('byeot/save/1'))()`);
  if (!text || typeof text !== 'string') { console.log(`  ✘ ${stage} — 세이브가 없다`); return null; }
  const j = JSON.parse(text);
  const f = path.join(OUT, `${LABEL}_${PFX}${stage}.json`);
  fs.writeFileSync(f, text);
  console.log(`  ✔ ${stage} — Day ${j.state.day} · ${j.state.home.room} · 지갑 ${j.state.tutorial && j.state.tutorial.cashWon} · ${text.length}자 → ${path.basename(f)}`);
  return j;
};
/* 그루를 그 방 창턱에 놓고 n 일(물 줌) — 코어 함수 */
const grow = (n) => J(`(async()=>{ const st=await import('/src/game/state.js'); const loop=await import('/src/game/loop.js');
  const S=window.__S(), io=window.__io; const p=S.pots[0];
  if (p && !p.slotId && !p.at) { const sl=(io.light.room.slots||[]).find(x=>/sill/.test(x.slotId)) || (io.light.room.slots||[])[0];
    try { st.setPotAt(S, p.id, { x:sl.x, y:sl.y, z:sl.z, slotId:sl.slotId }, { slots: io.light.room.slots, size: io.light.room.size }); } catch(e) { st.setPotSlot && st.setPotSlot(S, p, sl.slotId, io.light.room.slots); } }
  for (let d=0; d<${n}; d++) { try { st.waterPot(S); } catch(e) {} loop.runDays(S, io, 1); }
  return { day: S.day, room: S.home.room, leaves: (io.growth.leafStats()||{}).leaves }; })()`);
try {
  if (START) {
    await page.goto(`${BASE}/data/balance/homes.json`);
    await page.eval(`(()=>{ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(fs.readFileSync(START, 'utf8'))}); return 1; })()`, false);
  } else { await page.goto(`${BASE}/game.html`); await page.eval('localStorage.clear()', false); }
  await boot();
  /* ── 반지하 중반 ── 걸은 판이면 몬스테라가 이미 왔을 수 있다(없으면 같은 손으로 들인다) */
  await J(`(async()=>{ const st=await import('/src/game/state.js'); const fp=await import('/src/game/first_play.js');
    const S=window.__S(); if ((S.pots||[]).length) return 0;
    S.firstPlay.beansprout.harvestCount = Math.max(S.firstPlay.beansprout.harvestCount||0, fp.MONSTERA_ARRIVAL_RULE.harvestCount); S.firstPlay.beansprout.harvested = true;
    const a = st.givePlant(S, window.__io, { slotId:null }); fp.markMonsteraArrived(S.firstPlay, a); return 1; })()`);
  await skip();
  console.log('반지하 —', JSON.stringify(await grow(30)));
  await grab('banjiha');
  /* ── 원룸(이사 단추) ── */
  await page.eval(`(()=>{ const S=window.__S(); const ts=S.tutorial; ts.cashWon = ts.rules.moveOutCostWon + 3000000; ts.lamp.unlocked = true;
    ts.varieLeaf = { ever:true, count:1, firstOnDay:S.day }; window.__redraw(); })()`, false); await sleep(600);
  await page.eval(`(()=>{ const b=document.getElementById('moveOut'); if(b){ b.disabled=false; b.click(); } })()`, false); await sleep(1500); await skip();
  for (let i = 0; i < 4; i++) {
    const moved = await J(`(()=>!!window.__S().tutorial.movedOut)()`);
    if (moved) break;
    await page.eval(`(()=>{ const p=document.getElementById('movePanel'); const g=document.getElementById('moveGo');
      if (p && p.classList.contains('on') && g) g.click(); else { const b=document.getElementById('moveOut'); if (b) { b.disabled=false; b.click(); } }
      const a=[...document.querySelectorAll('button')].find(x=>x.offsetParent && /^(이사한다|이사하기|옮긴다)/.test(x.textContent.trim())); if (a) a.click(); })()`, false);
    await sleep(2500); await skip();
  }
  await sleep(5000); await skip();
  await boot();
  const mv = await J(`(()=>({ moved: !!window.__S().tutorial.movedOut, room: window.__S().home.room }))()`);
  console.log('이사 —', JSON.stringify(mv));
  if (mv.moved) {
    console.log('원룸 —', JSON.stringify(await grow(20)));
    await grab('oneroom');
    await page.eval(`(()=>{ window.__S().tutorial.cashWon = 4990000; })()`, false);
    console.log('엔딩 직전 —', JSON.stringify(await grow(1)));
    await grab('nearEnd');
  } else console.log('  ✘ 이사를 못 했다 — oneroom · nearEnd 는 못 떴다');
} catch (e) { console.log('  ✘ 탈 —', e && e.message); }
finally { await page.close(); }
console.log(`옛 판 예외 ${exc.length}건${exc.length ? ' — ' + [...new Set(exc)].slice(0, 3).join(' / ') : ''}`);
process.exit(0);
