/* tools/probe_hero_m.mjs — 남녀 «추후 분기»의 길 · 화면(core · 2026-10-10 · plan-branch-job-gender §3)
   ?hero=m 을 강제한 판 — 남 그림이 아직 없으니 **f 로 떨어지면서 경고**가 서고 판은 그대로 돈다:
     ① 방이 선다(몸은 v2 hero2 'f' 로 · 경고 «3D 몸(v2 hero2_m.glb)»)
     ② 위 칸 «나» 얼굴 = portrait_jachwi_m_neutral(있는 남 초상)
     ③ 대사창 — 있는 남 낯(think)은 jachwi_m_think · 없는 낯(beam 줄)은 jachwi_m_neutral + 경고(같은 것은 한 번)
     ④ 몬이 낯은 성별과 상관없다
     ⑤ 깃발 없이 켜면(f) 경고가 하나도 없고 «나» 얼굴은 portrait_jachwi_neutral(예전 그대로)
   python tools/serve.py 9300 · node tools/probe_hero_m.mjs */
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9300';
let bad = 0; const ok = (c, m) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${m}`); if (!c) bad++; };
const page = await launch();
const warns = [];
page.on((method, p) => {
  if (method === 'Runtime.consoleAPICalled' && p && (p.type === 'warning' || p.type === 'error'))
    warns.push((p.args || []).map(a => a.value ?? a.description ?? '').join(' '));
});
await page.send('Runtime.enable');
const J = async js => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const skip = async () => { for (let i = 0; i < 40; i++) {
  if (await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`) !== 'true') break;
  await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s && s.offsetParent) s.click(); else { const x=document.getElementById('dlgBox'); if(x)x.click(); }})()`, false); await sleep(200); } };
const faceOf = async (id) => {
  await page.eval(`(()=>window.__dlgOpen([${JSON.stringify(id)}]))()`, false); await sleep(800);
  const u = await J(`(()=>(document.getElementById('dlgFace').style.backgroundImage.split('"')[1] || ''))()`);
  await skip(); return String(u).replace(/^.*\//, '');
};
const genderWarns = () => warns.filter(w => /\[성별\]/.test(w));
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__byeotSkipDayAnim=true; try{ if(!sessionStorage.__hm){ localStorage.clear(); sessionStorage.__hm='1'; } }catch(e){}` });
  /* ── m ── */
  await page.goto(`${BASE}/game.html?hero=m`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(5000); await skip();
  const st = await J(`(()=>({ rv: !!window.__rv, failed: document.getElementById('stage').classList.contains('room-failed'), me: document.getElementById('meFace').src.replace(/^.*\\//, '') }))()`);
  console.log('m —', JSON.stringify(st), '경고', JSON.stringify(genderWarns()));
  ok(st.rv && !st.failed, '① 방이 선다(남 몸이 없어도)');
  ok(genderWarns().some(w => /3D 몸\(v2 hero2_m\.glb\)/.test(w)), '① 경고 «3D 몸(v2 hero2_m.glb) — m 판이 없어 f 로»');
  ok(st.me === 'portrait_jachwi_m_neutral.png', `② «나» 얼굴 = 남 neutral(${st.me})`);
  const think = await faceOf('statusHomeNear');   /* 첫 줄 자취생 think */
  ok(think === 'portrait_jachwi_m_think.png', `③ 있는 남 낯 think → ${think}`);
  const n0 = genderWarns().length;
  const beam1 = await faceOf('questAlKeepWinter');   /* 첫 줄 자취생 winter — 남 판 없음 */
  ok(beam1 === 'portrait_jachwi_m_neutral.png', `③ 없는 남 낯 winter → ${beam1}`);
  ok(genderWarns().length === n0 + 1 && /portrait_jachwi_m_winter/.test(genderWarns().slice(-1)[0] || ''), `③ 경고 한 줄(${genderWarns().slice(-1)[0] || '없음'})`);
  const moni = await faceOf('statusHomeQuarter');
  ok(/^portrait_moni_/.test(moni), `④ 몬이 낯은 성별과 상관없다(${moni})`);
  /* ── f(깃발 없음) ── */
  warns.length = 0;
  await page.goto(`${BASE}/game.html`); await page.waitFor('!!window.__rv', 600000, 500); await sleep(5000); await skip();
  const sf = await J(`(()=>({ me: document.getElementById('meFace').src.replace(/^.*\\//, '') }))()`);
  const tf = await faceOf('statusHomeNear');
  console.log('f —', JSON.stringify(sf), tf, '경고', JSON.stringify(genderWarns()));
  ok(sf.me === 'portrait_jachwi_neutral.png' && tf === 'portrait_jachwi_think.png', `⑤ f 판 — 예전 그대로(${sf.me} · ${tf})`);
  ok(genderWarns().length === 0, '⑤ f 판 — [성별] 경고 0');
} catch (e) { console.log('  FAIL 탈 —', e && e.message); bad++; }
finally { await page.close(); }
console.log(bad ? `probe_hero_m: FAIL (${bad})` : 'probe_hero_m: PASS');
process.exit(bad ? 1 : 0);
