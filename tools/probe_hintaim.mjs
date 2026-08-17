/* 손가락이 **가리키는 그것 위에** 있나 (2026-08-17)
   ══════════════════════════════════════════════════════════════════
   박사님 사진: 「씨앗을 미리 주문해 두세요」 손가락이 [상점] 탭이 아니라
   그 오른쪽 빈 곳을 가리키고 있었다. 말풍선이 화면 밖으로 안 나가려고 오른쪽으로
   밀리는데 손가락이 말풍선 한가운데에 묶여 있어 **같이 딸려간 것**이다.

   ⚠ 이 자는 **말풍선 자리로 판정하지 않는다** — 말풍선은 밀려야 맞다.
     `.hand` 의 한가운데와 **대상(`.hintTarget`)의 한가운데**가 얼마나 벌어졌나로 잰다.
   ⚠ 옆 자세(`#hint.side`)는 일부러 옆에 서므로 가로 견줌에서 뺀다 — 대신 **세로**를 본다. */
import { launch, sleep } from './test_cdp.mjs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 900000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on(m => { if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception || {}).description || ''); });

await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);

const clearTalk = async () => {
  for (let i = 0; i < 14; i++) {
    const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (!busy) return;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
      const b=document.getElementById('dlgBox'); if(b)b.click();
      const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
    await sleep(220);
  }
};
await clearTalk();

/* 손가락 한 컷 — 손끝과 대상의 한가운데가 얼마나 벌어졌나 */
const aim = () => page.eval(`(()=>{
  const h=document.getElementById('hint');
  if (!h || !h.classList.contains('on')) return JSON.stringify(null);
  const t=document.querySelector('.hintTarget');
  const hand=h.querySelector('.hand'), say=h.querySelector('.say');
  if (!t || !hand) return JSON.stringify(null);
  const hr=hand.getBoundingClientRect(), tr=t.getBoundingClientRect(), sr=say.getBoundingClientRect();
  const side=h.classList.contains('side');
  return JSON.stringify({
    말: (say.textContent||'').trim(),
    대상: t.id || t.dataset.tab || t.className.split(' ')[0] || '?',
    자세: side ? '옆' : '위',
    손x: +(hr.left+hr.width/2).toFixed(1), 대상x: +(tr.left+tr.width/2).toFixed(1),
    손y: +(hr.top+hr.height/2).toFixed(1), 대상y: +(tr.top+tr.height/2).toFixed(1),
    말풍선x: +(sr.left+sr.width/2).toFixed(1),
    벌어짐x: +Math.abs(hr.left+hr.width/2 - (tr.left+tr.width/2)).toFixed(1),
    벌어짐y: +Math.abs(hr.top+hr.height/2 - (tr.top+tr.height/2)).toFixed(1) });
})()`);

/* 첫 플레이를 굴리며 손가락이 바뀔 때마다 한 컷씩 — 대문은 probe_cutting_ui 것을 그대로 */
const waitAct = async (ms = 15000) => {
  const t0 = Date.now();
  const acting = () => page.eval(`(()=>{ try { return !!window.__byeotWalkSfx().acting; }
    catch { return document.getElementById('actBar').style.display !== 'none'; } })()`);
  for (let i = 0; i < 6; i++) { if (await acting()) break; await sleep(120); }
  while (Date.now() - t0 < ms) { if (!(await acting())) { await sleep(250); return true; } await sleep(250); }
  return false;
};
const rowAct = async (act) => {
  for (let k = 0; k < 8; k++) {
    const hit = await page.eval(`(()=>{ const b=[...document.querySelectorAll(
      '#siruList button[data-act="${act}"]')].find(x=>!x.disabled); if(!b) return false; b.click(); return true; })()`);
    if (!hit) break;
    await waitAct(); await sleep(350); await clearTalk();
  }
};

const seen = new Map();
const snap = async (where) => {
  const r = JSON.parse(await aim());
  if (!r) return;
  const key = r.말 + '|' + r.대상;
  if (!seen.has(key)) { seen.set(key, r); console.log(`  [${where}] ${JSON.stringify(r)}`); }
};

await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src, {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
await sleep(1200);
await snap('놓은 뒤');
await page.eval(`(()=>{ const S=window.__S(); S.shop.stock.bean_seed = 9; })()`, false);

console.log('── 첫 플레이를 굴리며 손가락을 모은다 ──────────────────────');
for (let i = 0; i < 40; i++) {
  await page.eval(`(()=>{const S=window.__S(); if(S.stamina) S.stamina.usedToday=0;})()`, false);
  /* ★ 시트가 닫힌 채로도 한 컷 — 박사님 사진이 그 상태다 */
  await page.eval(`(()=>{ try{window.__byeotSheet.close()}catch{} })()`, false); await sleep(400);
  await snap(`${i}일`);
  await page.eval(`window.__byeotSheet.open('plants')`, false); await sleep(400);
  await snap(`${i}일·시트`);
  await rowAct('plant'); await rowAct('water'); await rowAct('harvest'); await rowAct('sow');
  /* ★ 씨앗이 떨어지는 날이 있어야 [상점] 손가락이 뜬다 — 그날을 일부러 만든다 */
  if (i === 3) await page.eval(`(()=>{ const S=window.__S(); S.shop.stock.bean_seed = 0; })()`, false);
  await page.eval(`(()=>{ try{window.__byeotSheet.close()}catch{} })()`, false); await sleep(300);
  await page.eval(`(()=>{try{document.getElementById('next').click()}catch{}})()`, false);
  await sleep(900); await clearTalk();
  if (await page.eval(`window.__S().pots.length > 0`) && i > 8) break;
}

console.log('');
console.log('── 판정 ──────────────────────────────────────────────');
let bad = 0, n = 0;
for (const [, r] of seen) {
  n++;
  /* 위 자세 — 손가락은 대상 한가운데에서 **12px 안**이어야 한다(손 그림 자체가 30px 다) */
  const ok = r.자세 === '옆' ? r.벌어짐y <= 24 : r.벌어짐x <= 12;
  if (!ok) { bad++; console.log(`  ✘ ${r.말} → ${r.대상} · ${r.자세} · 벌어짐 x${r.벌어짐x} y${r.벌어짐y}` +
    (r.자세 === '위' ? ` (말풍선은 ${r.말풍선x}, 대상은 ${r.대상x})` : '')); }
}
console.log(bad ? `✘ 손가락 ${n} 개 중 ${bad} 개가 딴 데를 가리킨다`
                : `✔ 손가락 ${n} 개가 모두 제 대상 위에 있다`);
console.log('예외', errs.length, errs.slice(0, 2).join(' | '));
await page.close();
process.exit(bad ? 1 : 0);
