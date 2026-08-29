/* tools/probe_sellscreen.mjs — **파는 화면에 «이사비»가 보이나** ([Plan]·총괄 ②)
   [Plan] 뜻: 「팔면 못 나간다」를 «말하지» 말고, ★ 「지금 팔면 얼마」와 「이사에 얼마」를
   «나란히» 놓아 사람이 «스스로 뺄셈»하게 한다.
   ⇒ ★ 그러려면 그 화면에 «둘 다» 있어야 한다. 있으면 아무것도 안 해도 된다.
   ⛔ 값은 안 바꾼다. 화면 글자만 읽는다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(5000);
for (let i = 0; i < 40; i++) {
  const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
    return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
  if (b !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
    const x=document.getElementById('dlgBox'); if(x)x.click();
    const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
  await sleep(250);
}
/* d87 언저리 꼴 — 잎3(무지+산반+하프문) · 창턱 */
console.log('■ 세우기 —', await page.eval(`(()=>{ const S=window.__S(); S.pots=S.pots||[];
  S.pots.length=0;
  S.pots.push({ id:'pot_a', itemId:'pot', plantId:'monstera',
    leafGrades:{ 36:'plain', 136:'sanban', 256:'halfmoon' }, leafGradesSeen:{},
    cuts:[], daysPlanted:0, fedDays:0, arrivedOnDay:S.day, wateredOnDay:S.day,
    arrivalGrowthDays:165, dliHist:[], placedOnce:true, slotId:'banjiha-sill:0', at:null });
  try{ S.firstPlay.monstera.arrived=true; }catch(e){}
  window.__redraw();
  try{ window.__io.growth.setGrowth(165); window.__redraw(); }catch(e){}
  return JSON.stringify({ 지갑:(S.tutorial||{}).cashWon ?? null }); })()`));
await sleep(3000);
await page.eval(`try{ window.__byeotSheet.open('shop') }catch(e){}`, false);
await sleep(1600);
const scan = () => page.eval(`(()=>{ const NL=String.fromCharCode(10);
  const t=(document.getElementById('sheet')||document.body).innerText||'';
  const lines=t.split(NL).map(s=>s.trim()).filter(Boolean);
  const pick=(words)=>lines.filter(s=>words.some(w=>s.indexOf(w)>=0)).slice(0,5);
  return JSON.stringify({
    '이사 글자 있나': ['2,000,000','200만','이사'].some(w=>t.indexOf(w)>=0),
    '이사 줄': pick(['이사','나가','2,000,000','200만']),
    '내놓기 줄': pick(['내놓','팔기','판매']),
    '소지금 줄': pick(['소지금'])
  }); })()`);
console.log('');
console.log('=== ① [상점] 화면 ===');
console.log(' ', await scan());
/* 중고 탭이 따로 있으면 그쪽도 */
console.log('');
console.log('=== ② 「내놓기」 단추를 눌러 본다 ===');
console.log('  단추 —', await page.eval(`(()=>{ const bs=[...document.querySelectorAll('#sheet button')]
  .filter(b=>/내놓|팔기|판매/.test(b.textContent||''));
  if(!bs.length) return '⛔ 못 찾음';
  const b=bs[0]; const r=b.getBoundingClientRect();
  b.click();
  return '눌렀다: ' + (b.textContent||'').trim().slice(0,40); })()`));
await sleep(1500);
console.log(' ', await scan());
console.log('');
console.log('=== ③ 그 화면에 뜬 글 (앞 500자) ===');
console.log(await page.eval(`(()=>{ const t=(document.getElementById('sheet')||document.body).innerText||'';
  return t.replace(new RegExp(String.fromCharCode(10)+'{2,}','g'), String.fromCharCode(10)).slice(0,500); })()`));
await page.close(); clearTimeout(wd);
