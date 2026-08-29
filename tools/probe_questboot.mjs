/* tools/probe_questboot.mjs — **새로고침하면 할 일이 «되돌아간다»** (박사님 사진 · Day 0)
   probe_questalive 실측: 시루를 놓으면 「물을 주세요」로 넘어가는데,
   ★ 새로고침하면 시루가 `banjiha-sill:0` 에 «놓여 있는데도» 「시루를 방 안에 놓아 보세요」로 돌아간다.
   ⇒ 무엇이 안 남는지 «상태를 열어» 본다. ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
const calm = async () => { for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250); } };
await calm();
const dump = () => page.eval(`(()=>{ const S=window.__S();
  let snap=null, view=null;
  try{ snap=window.__questSnap(); }catch(e){ snap={err:e.message}; }
  try{ view=window.__questView(); }catch(e){ view={err:e.message}; }
  const q=(document.getElementById('quest')||{}).textContent||'';
  return JSON.stringify({
    '할 일': q.trim().replace(/\s+/g,' ').slice(0,40),
    시루: (()=>{ try{ const p=(S.firstPlay.beansprout.pots||[])[0];
      return { slotId:p.slotId||null, at:!!p.at, sown:!!p.sown, startedOnDay:p.startedOnDay??null }; }
      catch(e){ return 'err'; } })(),
    'snap.cropPots': (snap && snap.cropPots) || null,
    'S.quests 칸': Object.keys(S.quests || {}),
    'S.quests': JSON.stringify(S.quests || null).slice(0,180),
    'view.done': (view && view.doneIds) || (view && view.done) || null,
    'view.todo': (view && (view.todo || (view.line && view.line.todo))) || null
  }); })()`);
console.log('=== 놓기 전 ==='); console.log(' ', await dump());
await page.eval(`(()=>{ try{ const S=window.__S(); const p=(S.firstPlay.beansprout.pots||[])[0];
  p.slotId='banjiha-sill:0'; p.at=null; window.__redraw(); }catch(e){} })()`, false);
await sleep(1200);
console.log('\n=== 시루를 자리에 놓은 뒤(상태로) ==='); console.log(' ', await dump());
await page.eval(`(()=>{ try{ window.__byeotHint(); }catch(e){} })()`, false);
await sleep(600);
console.log('\n=== 새로고침 ===');
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000); await calm();
console.log(' ', await dump());
await page.close(); clearTimeout(wd);
