/* tools/probe_siru_badge.mjs — **시루 «N일» 표지가 상태대로 뜨나** (2026-10-08 · [house] house-siru-badge-spec-20261008)
   ------------------------------------------------------------------
   걸음: 손가락대로 시루를 놓고 → 시트 줄 단추로 심고·물 주고 → [다음 날]만 눌러 나이 0·1·3·5 → 거두기 · 그때마다 표지·말풍선을 읽는다.
   잰다: ① 자라는 날 표지 = 「🌱 {ageDays}/{harvestDays}」(줄 값 그대로) · 날마다 는다
         ② 말풍선(심기·물·거두기)이 떠 있는 시루엔 표지가 안 뜬다(같은 말 두 번 X)
         ③ 표지가 방 화면 안에 선다
         ④ ?sbadge=0 판엔 표지가 없다(같은 빌드 나란히 · SHOT_DIR 이면 같은 크기로 찍는다)
   판: 폰 390×844. ⛔ 값 0(그림만). */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:9300';
const SHOT_DIR = process.env.SHOT_DIR || null;
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 900000);
wd.unref && wd.unref();
let fail = 0;
const ok = (c, msg, got) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${msg}${got !== undefined ? ' → ' + JSON.stringify(got) : ''}`); if (!c) fail++; };

async function walk(q, tag) {
  const page = await launch({ width: 390, height: 844, dpr: 1 });
  await page.goto(`${BASE}/game.html${q}`); await page.eval('localStorage.clear()', false); await page.goto(`${BASE}/game.html${q}`);
  await page.waitFor('!!window.__rv', 240000, 500); await sleep(3000);
  const J = async (e) => JSON.parse(await page.eval(`(()=>{ try { return JSON.stringify((${e})); } catch(e) { return JSON.stringify({ 탈:e.message }); } })()`));
  const clearDlg = async () => {
    for (let i = 0; i < 60; i++) {
      const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
      if (t !== true) return;
      await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(140);
    }
  };
  const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
  const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(80); await m('mouseReleased', x, y, 0); await sleep(700); };
  await clearDlg();
  for (let i = 0; i < 8; i++) {
    const placed = await J(`(()=>{ try { return window.__S().firstPlay.beansprout.pots.some(p=>p && (p.slotId || p.at)); } catch(e) { return false; } })()`);
    const say = await J(`(()=>{ const h=document.getElementById('hint'); return h ? ((h.querySelector('.say')||{}).textContent||'').trim() : ''; })()`);
    if (placed && !/둘까요/.test(say)) break;
    const at = await J(`(()=>{ const t=document.querySelector('.hintTarget'); if(!t) return null; const r=t.getBoundingClientRect(); return r.width>0 ? { x:r.left+r.width/2, y:r.top+r.height/2 } : null; })()`);
    if (!at) break;
    await tapAt(at.x, at.y); await clearDlg();
  }
  const read = () => J(`(()=>{
    const box=document.getElementById('siruBadges'); const boxOn = box && getComputedStyle(box).display!=='none';
    const b=[...document.querySelectorAll('#siruBadges .sbadge')].filter(e=>boxOn && getComputedStyle(e).display!=='none');
    const mk=[...document.querySelectorAll('#marks .mark')].filter(e=>e.style.display!=='none' && !document.getElementById('marks').classList.contains('busy')).map(e=>e.getAttribute('aria-label'));
    const c=document.getElementById('roomCanvas').getBoundingClientRect();
    const all=[...document.querySelectorAll('#siruBadges .sbadge')].map(e=>({ t:(e.textContent||'').trim(), disp:e.style.display }));
    const h=document.getElementById('hint');
    const why = { busy: box && box.classList.contains('busy'), all, hintOn: !!(h && h.classList.contains('on')), hintSay: h ? ((h.querySelector('.say')||{}).textContent||'').trim().slice(0,20) : null,
                  stage: document.getElementById('stage').className.slice(0,80) };
    return { day: window.__S().day, marks: mk, why,
             badges: b.map(e=>{ const r=e.getBoundingClientRect(); return { t:(e.textContent||'').trim(), inCanvas: r.left>=c.left && r.right<=c.right && r.top>=c.top && r.bottom<=c.bottom }; }) }; })()`);
  const rowAct = async (act) => {
    for (let i = 0; i < 24; i++) {
      const r = await J(`(()=>{ try { window.__byeotSheet.open('plants'); } catch(e){} const b=[...document.querySelectorAll('button[data-act="${act}"]')].find(x=>!x.disabled); if(!b) return false; b.click(); return true; })()`);
      if (r) return true;
      await sleep(500); await clearDlg();
    }
    return false;
  };
  const closeSheet = async () => { try { await page.eval(`window.__byeotSheet.close()`, false); } catch { } await sleep(500); };
  const nextDay = async () => {
    await clearDlg();
    const d0 = await J(`window.__S().day`);
    for (let k = 0; k < 8; k++) {
      await J(`(()=>{ const p=document.querySelector('.pop.on'); const g=p ? [...p.querySelectorAll('button.go,button.primary')].find(x=>!x.disabled) : null; if (g) { g.click(); return 1; } const n=document.getElementById('next'); if (n && !n.disabled) n.click(); return 1; })()`);
      await sleep(1300); await clearDlg();
      if ((await J(`window.__S().day`)) !== d0) break;
    }
    await sleep(600);
  };
  const log = [];
  const snap = async (label) => {
    await closeSheet(); await sleep(400);
    const r = await read(); log.push({ label, ...r });
    console.log(`  [${tag}] ${label} —`, JSON.stringify(r));
    if (SHOT_DIR) await page.shot(`${SHOT_DIR}/siru_badge_${tag}_${label}.png`);
    return r;
  };
  await snap('놓음');
  await rowAct('plant'); await sleep(900); await clearDlg();
  await snap('심음');
  await rowAct('water'); await sleep(900); await clearDlg();
  await snap('물줌_나이0');
  const ages = [];
  for (let d = 0; d < 6; d++) {
    await nextDay();
    const r = await snap(`날${d + 1}`); ages.push(r);
    if (r.marks.some(x => /거두기/.test(x || ''))) break;
  }
  await rowAct('harvest'); await sleep(1500); await clearDlg();
  await snap('거둠');
  await page.close();
  return { ages, log };
}

const A = await walk('', 'on');
const growDays = A.ages.filter(r => r.badges.length && /^🌱 \d+\/\d+$/.test(r.badges[0].t));
ok(growDays.length >= 2, `① 자라는 날 표지 「🌱 n/5」 — ${A.ages.map(r => `d${r.day}:${r.badges.map(b => b.t).join('|') || '-'}`).join(' ')}`);
const ageOf = r => +r.badges[0].t.match(/(\d+)\//)[1];
ok(growDays.every((r, i) => i === 0 || ageOf(r) >= ageOf(growDays[i - 1])), '① 나이가 날마다 는다(줄 값 그대로)');
const both = A.log.filter(r => r.marks.length && r.badges.length);
ok(both.length === 0, `② 말풍선이 떠 있는 때엔 표지가 없다(같은 말 두 번 X) — 겹친 때 ${both.length}`, both.map(r => r.label));
ok(A.log.every(r => r.badges.every(b => b.inCanvas)), '③ 표지는 방 화면 안에 선다');
const B = await walk('?sbadge=0', 'off');
ok(B.log.every(r => r.badges.length === 0), '④ ?sbadge=0 판엔 표지가 없다(같은 빌드 나란히)');
clearTimeout(wd);
console.log(fail ? `\nprobe_siru_badge: FAIL ${fail}` : '\nprobe_siru_badge: PASS');
process.exit(fail ? 1 : 0);
