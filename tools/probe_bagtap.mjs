/* tools/probe_bagtap.mjs — **가방 칸을 «누르면»(끌지 않고) 무슨 일이 나나**
   ------------------------------------------------------------------
   가방 설명글이 갈려 있다(박사님 사진):
     시루     — "시루 칸을 «끌거나 누르면» … 누르면 게임이 빈 자리를 골라 세운 뒤
                 ★«자리를 고르는 화면»으로"
     몬스테라 — "이 칸을 ★«끌어» 방에 놓으세요"          ⇐ 「누르면」이 «없다»
   ⇒ ★ 박사님 말씀 *"시루 «옮길 때처럼» 그 «배치할수있는 칸»들이 나오고 해야되는데"* 의
     「칸들」이 그 «자리를 고르는 화면»일 수 있다. 눌러서 가른다.
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 420000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
for (let i = 0; i < 40; i++) {
  const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (busy !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const b=document.getElementById('dlgBox'); if(b)b.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
console.log('SETUP —', await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[];
  const p={ id:'pot_bag', itemId:'pot', plantId:'monstera', leafGrades:{}, leafGradesSeen:{},
            cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
            arrivalGrowthDays:45, dliHist:[], placedOnce:false, slotId:null, at:null };
  S.pots.length=0; S.pots.push(p); window.__redraw();
  return JSON.stringify({ pots:S.pots.length }); })()`));
await sleep(2000);

const look = () => page.eval(`(()=>{ const S=window.__S(), p=(S.pots||[])[0], pk=window.__picked||{};
  const vis=(e)=>{ if(!e) return false; const cs=getComputedStyle(e);
    return cs.display!=='none'&&cs.visibility!=='hidden'&&+cs.opacity>0.05; };
  let rings=0; try{ window.__rv.three.scene.traverse(o=>{ if(o.userData&&o.userData.highlightSlotId) rings++; }); }catch(e){}
  const pc=document.getElementById('placeConfirm');
  return JSON.stringify({
    화분자리: p?p.slotId:null, 놓인적: p?p.placedOnce:null,
    골라진것: pk.slotId||null, 확인모드: !!pk.confirming, 모드: pk.mode||null,
    금색네모: rings,
    '배치확인바 보이나': vis(pc),
    '배치확인바 글': pc ? (pc.textContent||'').trim().replace(/\s+/g,' ').slice(0,60) : '없음',
    시트: (()=>{ const s=document.getElementById('sheet'); return s&&s.classList.contains('open')?'열림':'닫힘'; })()
  }); })()`);

const tap = async (sel, name) => {
  await page.eval(`try{ window.__byeotSheet.open('bag') }catch(e){}`, false);
  await sleep(1300);
  const c = JSON.parse(await page.eval(`(()=>{ const e=document.querySelector('${sel}');
    if(!e) return JSON.stringify({err:'칸 없음'});
    if(e.scrollIntoView) e.scrollIntoView({block:'center'});
    const r=e.getBoundingClientRect();
    return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),
      nm:((e.querySelector('.nm')||{}).textContent||'?').trim(),
      hint:((e.querySelector('.eta')||{}).textContent||'').trim()}); })()`));
  if (c.err) { console.log(`\n=== ${name} — ⛔ ${c.err}`); return; }
  await sleep(400);
  console.log(`\n=== ${name} «${c.nm}» ===`);
  console.log('  칸 안내글 —', c.hint || '(없음)');
  console.log('  누르기 전 —', await look());
  const p = { x: c.x, y: c.y, radiusX: 12, radiusY: 12, force: 1, id: 1 };
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await sleep(90);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(1800);
  console.log('  ★ 누른 뒤 —', await look());
};
await tap('[data-potbag]', '몬스테라');
await tap('[data-place]',  '시루');
await page.close(); clearTimeout(wd);
