/* ══ playshot — 실제로 눌러 가며 «걸음마다» 찍는다 ═══════════════════════════════
   ------------------------------------------------------------------------------
   2026-08-23 박사님: *"실제 인게임으로 진행하면서 스샷 찍어가면서 진행해보라는거엿는데"*

   ⚠ `night_play.mjs` 와 다르다. 그쪽은 **빨리 많이 돌려 숫자를 내는** 자다
     (스샷은 boot·arrive·varie·lamp·gameover 같은 **사건**에만 찍는다 — 밤새 14장).
     이쪽은 **한 걸음마다** 찍는다. 찾으려는 것이 「숫자」가 아니라 **「어색한 그림」**이라서다.

   ★★ 그리고 **겹친 쌍을 자동으로 뽑는다.** 2026-08-23 아침에 눈으로 찾은 것이
     거의 다 겹침이었다(할 일 상자가 알림 제목을 덮음 · 같은 문장이 두 곳 · 손가락이 탭을 가림).
     ⇒ 사람이 볼 것을 줄여 준다. **판정은 안 한다 — 겹쳤다는 사실만 적는다.**

   쓰기:
     BYEOT_URL=http://localhost:8963 node tools/playshot.mjs --tag core --days 12
     옵션  --tag <이름>   산출 폴더 이름 (창마다 다르게 — 남의 것을 안 덮는다)
           --days N      며칠까지 진행할지 (기본 10)
           --size WxH    화면 크기 (기본 390x844)
   산출:
     tools/_out/playshot/<tag>/NNN_<걸음>.png      그림
     tools/_out/playshot/<tag>/NNN_<걸음>.json     그때 보이던 글자·사각형·겹친 쌍
     tools/_out/playshot/<tag>/_list.md            한눈에 보는 목록 (★ 이것부터 읽어라)
   ════════════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launch, sleep } from './test_cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d;
};
const TAG   = String(arg('tag', 'main'));
const DAYS  = Number(arg('days', 10));
const SIZE  = String(arg('size', '390x844'));
const [W, H] = SIZE.split('x').map(Number);
const BASE  = process.env.BYEOT_URL || 'http://localhost:8963';
const OUT   = path.join(ROOT, 'tools', '_out', 'playshot', TAG);
fs.mkdirSync(OUT, { recursive: true });

const page = await launch({ width: W, height: H, dpr: 2, mobile: false });
const errs = [];
page.on(m => { if (m.method === 'Runtime.exceptionThrown')
  errs.push((m.params.exceptionDetails.exception || {}).description || ''); });

const ev = (js, aw = true) => page.eval(js, aw);
let seq = 0;
const rows = [];

/* ══ 그때 화면에 «보이는» 것을 모은다 ═══════════════════════════════════════════
   ⚠ `offsetParent` 로 거른다 — display:none 은 물론 부모가 접힌 것도 같이 걸러진다.
   ⚠ 글자가 없는 칸(그림·빈 상자)은 겹침 셈에서 뺀다. 겹쳐도 사람이 안 읽으니 탈이 아니다.
     ★ 다만 **손가락(손짓)은 글자가 없어도 넣는다** — 남을 가리면 그게 탈이다. */
const COLLECT = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const seen = [];
  const HAND = ['hint','finger','handcue','dragcue'];
  document.querySelectorAll('body *').forEach(el => {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    /* 제 글자만 — 자식이 가진 글자는 자식이 낸다 */
    let own = '';
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
    own = own.replace(/\\s+/g, ' ').trim();
    const id = el.id || '';
    const isHand = HAND.some(k => (id + ' ' + el.className).toLowerCase().includes(k));
    if (!own && !isHand) return;
    seen.push({ el, id, tag: el.tagName.toLowerCase(),
                cls: String(el.className || '').slice(0, 40),
                text: own.slice(0, 60), hand: isHand,
                x: Math.round(r.x), y: Math.round(r.y),
                w: Math.round(r.width), h: Math.round(r.height) });
  });
  /* ── 겹친 쌍 — 넓이의 25% 넘게 물리면 적는다 ───────────────────────────────
     ⚠ 부모·자식은 뺀다(당연히 물린다). 같은 자리에 겹쳐 그리는 것도 판정 안 한다. */
  const ov = [];
  for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) {
    const a = seen[i], b = seen[j];
    /* ★ 부모·자식은 «당연히» 물린다 — 세면 진짜가 묻힌다. 2026-08-23 첫 판에서
       baghelp ⇄ 그 안의 <b> 가 아홉 줄을 차지했다. */
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const inter = ix * iy;
    if (inter <= 0) continue;
    const small = Math.min(a.w * a.h, b.w * b.h);
    if (inter / small < 0.25) continue;
    ov.push({ a: (a.id || a.cls || a.tag) + ' «' + (a.text || (a.hand ? '손짓' : '')) + '»',
              b: (b.id || b.cls || b.tag) + ' «' + (b.text || (b.hand ? '손짓' : '')) + '»',
              물린비율: Math.round(inter / small * 100) });
  }
  /* ── 화면 밖 ─────────────────────────────────────────────────────────────── */
  const off = seen.filter(s => s.x < -4 || s.y < -4 || s.x + s.w > vw + 4 || s.y + s.h > vh + 4)
                  .map(s => (s.id || s.cls) + ' «' + s.text + '» ' + s.x + ',' + s.y);
  /* ── 같은 글자가 두 곳에 ──────────────────────────────────────────────────── */
  const byText = {};
  for (const s of seen) if (s.text.length >= 6) (byText[s.text] = byText[s.text] || []).push(s.id || s.cls);
  const dup = Object.entries(byText).filter(([, v]) => v.length > 1)
                    .map(([t, v]) => t + '  ← ' + v.join(' · '));
  const 덮개 = ['questPanel','sheet','guide','buyPanel','mealPanel','monthPanel','slotPanel']
    .filter(id => { const e=document.getElementById(id); return e && e.offsetParent; });
  const S = (() => { try { const s = window.__S(); return {
      day: s.day, money: s.money, sta: s.stamina && s.stamina.cur,
      next잠김: (()=>{const n=document.getElementById('next'); return !n ? '없음' : (n.disabled ? '잠김' : '');})(),
      할일: (()=>{ try { const q=window.__quest&&window.__quest(); return q?(q.ko||q.id):null; } catch { return null; } })()
    }; } catch { return {}; } })();
  for (const s2 of seen) delete s2.el;          /* 참조는 안 내보낸다 */
  return JSON.stringify({ state: S, 떠있는덮개: 덮개, 겹침: ov, 화면밖: off, 같은글자두곳: dup, 보이는것: seen });
})()`;

const settle = async () => {
  try { await ev(`(async()=>{ if(!document.getAnimations) return 0;
    for(let i=0;i<30;i++){ const n=document.getAnimations().filter(a=>a.playState==='running').length;
      if(!n) return i; await new Promise(r=>setTimeout(r,100)); } return 30; })()`); } catch { }
  await sleep(250);
};

const shot = async (step) => {
  await settle();
  const no = String(++seq).padStart(3, '0');
  const base = `${no}_${step}`;
  try { await page.shot(path.join(OUT, base + '.png')); } catch (e) { return; }
  let info = {};
  try { info = JSON.parse(await ev(COLLECT)); } catch (e) { info = { readError: String(e.message) }; }
  fs.writeFileSync(path.join(OUT, base + '.json'), JSON.stringify(info, null, 1));
  const st = info.state || {};
  rows.push({ no, step, day: st.day, money: st.money, 덮개: (info.떠있는덮개||[]).join('·'),
              겹침: (info.겹침 || []).length, 화면밖: (info.화면밖 || []).length,
              같은글자: (info.같은글자두곳 || []).length,
              file: base + '.png' });
  console.log(`${no} ${step.padEnd(18)} day=${st.day ?? '?'} 덮개=${(info.떠있는덮개||[]).join('·')||'없음'} 겹침=${(info.겹침||[]).length} 밖=${(info.화면밖||[]).length} 같은글자=${(info.같은글자두곳||[]).length}`);
};

/* 대사가 떠 있으면 넘긴다 — 사람이 하듯 상자를 누른다 */
const talking = () => ev(`(()=>{const s=document.getElementById('stage');
  return !!(s&&s.classList.contains('talking'));})()`);
const tapTalk = async (max = 30) => {
  for (let i = 0; i < max; i++) {
    if (!(await talking())) return i;
    await ev(`(()=>{const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false);
    await sleep(320);
  }
  return max;
};
const closeGuide = async () => {
  for (let i = 0; i < 10; i++) {
    const on = await ev(`(()=>{const g=document.getElementById('guide');
      return !!(g&&g.classList.contains('on'));})()`);
    if (!on) return;
    await ev(`(()=>{const b=document.getElementById('guideClose'); if(b&&b.offsetParent)b.click();})()`, false);
    await sleep(250);
  }
};
/* ★★ 2026-08-23 [House] 가 잡음 — **28장 중 27장이 「할 일」 시트에 덮여 있었다.**
   `navQuest` 가 여는 것은 `__byeotSheet` 가 «아니라» 따로 뜨는 패널이라
   `sheet.close()` 로 안 닫혔고, 그 뒤 스물일곱 걸음이 «같은 덮개 그림»이 됐다.
   ⇒ 걸음마다 «떠 있는 덮개를 전부» 닫는다. 안 닫으면 그 뒤가 통째로 헛것이다(계율 ㉛). */
const closeOverlays = async () => {
  for (let round = 0; round < 6; round++) {
    const closed = await ev(`(()=>{ let n=0;
      for (const id of ['questGo','questClose','guideClose','buyCancel','placeCancel','slotClose']) {
        const b=document.getElementById(id); if (b && b.offsetParent) { b.click(); n++; }
      }
      try { const s=window.__byeotSheet; if (s&&s.close) { s.close(); } } catch(e){}
      return n; })()`);
    await sleep(300);
    if (!closed) return round;
  }
  return 6;
};

const click = async (id) => {
  const ok = await ev(`(()=>{const b=document.getElementById(${JSON.stringify(id)});
    if(!b||!b.offsetParent) return false; b.click(); return true;})()`);
  await sleep(500);
  return ok;
};

/* 가방의 시루를 방에 끌어다 놓는다 — night_play §placeOneSiru 와 같은 창구(`__drag`)를 쓴다.
   ⚠ 자리 표를 여기서 새로 짓지 않는다. 이미 찬 자리를 빼고 «남은 첫 자리»를 고른다. */
const placeSiru = async () => {
  const slot = await ev(`(()=>{ const S=window.__S();
    const taken = new Set();
    for (const p of (S.pots||[])) if (p.slotId) taken.add(p.slotId);
    const b=(S.firstPlay&&S.firstPlay.beansprout)||{};
    for (const p of (b.pots||[])) if (p && p.slotId) taken.add(p.slotId);
    const free=(window.__io.light.room.slots||[]).map(x=>x.slotId).filter(id=>!taken.has(id));
    return free[0]||''; })()`);
  if (!slot) return false;
  const ok = await ev(`(()=>{ try { const rv=window.__rv;
    const c=document.getElementById('roomCanvas').getBoundingClientRect();
    const sp=rv.screenPosOf(${JSON.stringify(slot)}); if(!sp) return false;
    const th=document.getElementById('cropThumb');
    window.__drag.begin('beansprout', th?th.src:'', {clientX:c.left+c.width*0.9, clientY:c.top+40});
    window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y});
    window.__drag.end(); return true; } catch(e) { return false; } })()`);
  if (ok) { await sleep(700); await tapTalk(); }
  return ok;
};

/* ══ 진행 ═════════════════════════════════════════════════════════════════════ */
await page.goto(`${BASE}/game.html`);
await ev(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(5000);

await shot('boot');                                   /* ① 첫 화면 그대로 */
if (await talking()) { await shot('dlg_first'); }
const n1 = await tapTalk(); if (n1) await shot('dlg_done');
await closeGuide();

/* ② 탭 다섯을 하나씩 열어 본다 — 사람이 처음에 하는 일이다 */
for (const t of ['bag', 'plants', 'shop', 'room']) {
  await ev(`(()=>{ const s=window.__byeotSheet; if(!s) return; s.open&&s.open(); s.tab&&s.tab(${JSON.stringify(t)}); })()`, false);
  await sleep(700);
  await shot('tab_' + t);
}
await ev(`(()=>{ const s=window.__byeotSheet; s&&s.close&&s.close(); })()`, false);
await sleep(400);
await click('navQuest'); await shot('tab_quest');
await closeOverlays();
await shot('room_only');            /* ★ 이제 «정말» 방만 보여야 한다 */

/* ③ 날짜를 밀며 걸음마다 찍는다 */
let day = 0;
for (let i = 0; i < DAYS * 3 && day < DAYS; i++) {
  await closeGuide();
  await closeOverlays();            /* ★ 덮개가 남아 있으면 그 뒤가 전부 같은 그림이 된다 */
  if (await talking()) { await shot('talk_d' + day); await tapTalk(); }
  /* ★ 놓을 시루가 가방에 있으면 놓는다 — 첫날은 이걸 해야 날짜가 넘어간다 */
  const idle = await ev(`(()=>{ try { const b=window.__S().firstPlay.beansprout||{};
    return (b.pots||[]).filter(p=>p && !p.slotId && !p.at && !p.harvested).length; } catch { return 0; } })()`);
  if (idle > 0 && (await placeSiru())) { await shot('시루놓기_d' + day); }
  /* 물·수확 단추가 떠 있으면 누른다 — 사람이 하는 순서 그대로 */
  for (const b of ['waterCrop', 'harvestCrop', 'resow', 'waterPot']) {
    if (await click(b)) { await shot(b + '_d' + day); await tapTalk(); }
  }
  const moved = await click('next');
  if (!moved) { await shot('next_안눌림_d' + day); break; }
  await sleep(900);
  /* 밥상·가계부가 뜨면 찍고 넘긴다 */
  const panel = await ev(`(()=>{const m=document.getElementById('mealPanel'),
    o=document.getElementById('monthPanel');
    return (m&&m.offsetParent?'meal':'') || (o&&o.offsetParent?'month':'') || '';})()`);
  if (panel) { await shot(panel + '_d' + day); await click('mealGo'); await sleep(700); }
  await sleep(700);
  const nd = await ev(`(()=>{ try { return window.__S().day; } catch { return -1; } })()`);
  if (nd === day) { await shot('날짜안감_d' + day); break; }
  day = nd;
  if (day % 2 === 0 || day <= 4) await shot('day' + String(day).padStart(3, '0'));
  const over = await ev(`(()=>{const g=document.getElementById('gameOver');
    return !!(g&&g.offsetParent);})()`);
  if (over) { await shot('gameover_d' + day); break; }
}
await shot('end');

/* ══ 목록 ═════════════════════════════════════════════════════════════════════ */
const md = [];
md.push(`# playshot — ${TAG} (${SIZE})`, '');
md.push(`돌린 날: 실행 시점 · 걸음 ${rows.length} 장 · 예외 ${errs.length} 건`, '');
md.push('| # | 걸음 | day | ★떠있는덮개 | 겹침 | 화면밖 | 같은글자 | 그림 |');
md.push('|---|---|---|---|---|---|---|---|');
for (const r of rows)
  md.push(`| ${r.no} | ${r.step} | ${r.day ?? ''} | ${r.덮개 || ''} | ${r.겹침 || ''} | ${r.화면밖 || ''} | ${r.같은글자 || ''} | ${r.file} |`);
md.push('', '## 겹친 쌍 (전부 모음 — 판정은 안 했다. 사실만 적는다)', '');
for (const r of rows) {
  let j = {}; try { j = JSON.parse(fs.readFileSync(path.join(OUT, r.no + '_' + r.step + '.json'), 'utf8')); } catch { }
  const ov = j.겹침 || [];
  if (!ov.length) continue;
  md.push(`### ${r.no} ${r.step}`);
  for (const o of ov) md.push(`- ${o.물린비율}% — ${o.a}  ⇄  ${o.b}`);
  md.push('');
}
md.push('## 같은 글자가 두 곳에', '');
const dupAll = new Set();
for (const r of rows) {
  let j = {}; try { j = JSON.parse(fs.readFileSync(path.join(OUT, r.no + '_' + r.step + '.json'), 'utf8')); } catch { }
  for (const d of (j.같은글자두곳 || [])) dupAll.add(d);
}
for (const d of dupAll) md.push('- ' + d);
if (errs.length) { md.push('', '## 예외', ''); for (const e of errs.slice(0, 10)) md.push('- ' + e.slice(0, 200)); }
fs.writeFileSync(path.join(OUT, '_list.md'), md.join('\n'));
console.log('\n★ 목록: ' + path.join(OUT, '_list.md'));
console.log('★ 그림 ' + rows.length + '장 · 예외 ' + errs.length + '건');
await page.close();
