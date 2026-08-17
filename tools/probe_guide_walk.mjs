/* ★★★ 손가락만 따라가며 처음부터 굴린다 — 가이드 검수 (2026-08-17)
   ══════════════════════════════════════════════════════════════════
   박사님: *"니가 실제로 해 보면서 스샷 찍어 가면서 제대로 됐는지 확인하면서
           가이드 순서라든지 이상한 거 없는지 직접 검수하면서 가이드 검수해."*

   ★ 이 자의 규율 — **손가락이 시키는 것만 누른다.** 내가 아는 길로 질러가면
     그건 플레이어가 겪는 길이 아니다. 손가락이 없으면 [다음 날]을 누른다.
     그 두 가지 말고는 아무것도 안 한다(재고를 넣거나 체력을 풀지 않는다).
   ⇒ 그러면 로그가 곧 **「손가락만 믿고 따라간 사람이 본 것」**이 된다.
     막히면 그건 가이드의 구멍이고, 헛도는 날이 있으면 그것도 가이드의 구멍이다.

   ⚠ 대사·안내판은 **닫기만** 한다(사람도 그렇게 한다). 건너뛰기는 대사에만 쓴다.
   ⚠ 사진은 걸음마다가 아니라 **날마다** 찍는다 — 걸음마다 찍으면 볼 수가 없다. */
import { launch, sleep } from './test_cdp.mjs';
import { mkdirSync } from 'node:fs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 1500000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const DAYS = +(process.env.BYEOT_WALK_DAYS || 26);
const OUT = 'docs/handoff/img/guidewalk';
mkdirSync(OUT, { recursive: true });

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on(m => { if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception || {}).description || ''); });

await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);

/* ── 화면을 읽는 눈 ─────────────────────────────────────────────── */
const look = () => page.eval(`(()=>{
  const txt = e => e ? (e.textContent||'').replace(/\\s+/g,' ').trim() : null;
  const h = document.getElementById('hint');
  const on = !!(h && h.classList.contains('on'));
  const t = document.querySelector('.hintTarget');
  const stage = document.getElementById('stage');
  const guide = document.getElementById('guide');
  const S = window.__S ? window.__S() : null;
  return JSON.stringify({
    day: S ? S.day : null,
    돈: S ? S.wallet : null,
    체력: S && S.stamina ? (S.stamina.max - S.stamina.usedToday) + '/' + S.stamina.max : null,
    첫플: !!(S && S.firstPlay && S.firstPlay.enabled && !S.firstPlay.completed),
    손가락: on ? txt(h.querySelector('.say')) : null,
    대상: on && t ? (t.id || t.dataset.act || t.className.split(' ')[0]) : null,
    대상글: on && t ? (txt(t)||'').slice(0, 30) : null,
    할일: txt(document.getElementById('questLine')) || txt(document.querySelector('#quest .qline'))
          || txt(document.getElementById('quest')),
    대사중: !!(stage && stage.classList.contains('talking')),
    대사: stage && stage.classList.contains('talking') ? (txt(document.getElementById('dlgBox'))||'').slice(0,120) : null,
    안내판: !!(guide && guide.classList.contains('on')),
    가계부: (()=>{ const m=document.getElementById('monthPanel')||document.getElementById('month');
      const sub=document.getElementById('monthSub'), t=document.getElementById('monthTitle');
      const on = !!(sub && sub.offsetParent);
      return on ? ((t?t.textContent:'')+' · '+(sub?sub.textContent:'')).replace(/\s+/g,' ').trim() : null; })(),
    배너: (txt(document.getElementById('banners'))||'').slice(-90) || null,
    아래: [...document.querySelectorAll('#hud button, #actions button')]
            .filter(b=>b.offsetParent && !b.disabled).map(b=>(txt(b)||'').slice(0,28)).slice(0,6)
  });
})()`);

const waitAct = async (ms = 15000) => {
  const t0 = Date.now();
  const acting = () => page.eval(`(()=>{ try { return !!window.__byeotWalkSfx().acting; }
    catch { return false; } })()`);
  for (let i = 0; i < 6; i++) { if (await acting()) break; await sleep(120); }
  while (Date.now() - t0 < ms) { if (!(await acting())) { await sleep(250); return true; } await sleep(250); }
  return false;
};
/* ★ 지나간 대사를 모은다 — 「같은 말이 두 번 나오나」를 재려면 흘려보내면 안 된다 */
const said = [];
/* 대사·안내판은 **닫기만** 한다 */
const clearTalk = async () => {
  for (let i = 0; i < 30; i++) {
    const busy = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (!busy) return;
    const line = await page.eval(`(()=>{ const b=document.getElementById('dlgBox');
      return b ? (b.textContent||'').replace(/\s+/g,' ').trim().slice(0,60) : ''; })()`);
    if (line) said.push(`${line}`);
    await page.eval(`(()=>{const g=document.getElementById('guideClose'); if(g&&g.offsetParent){g.click();return;}
      const b=document.getElementById('dlgBox'); if(b)b.click();})()`, false);
    await sleep(260);
  }
};
/* 손가락이 가리키는 그것을 누른다 */
const tapHint = () => page.eval(`(()=>{ const t=document.querySelector('.hintTarget');
  if(!t) return 'none';
  const name = t.id || t.dataset.act || (t.textContent||'').trim().slice(0,20);
  t.click(); return name; })()`);

const log = [];
let stuck = 0, lastKey = '';
console.log('── 손가락만 따라간다 ─────────────────────────────────────');

for (let step = 0; step < DAYS * 8; step++) {
  await clearTalk();
  const v = JSON.parse(await look());
  const key = `${v.day}|${v.손가락}|${v.할일}`;
  /* 날이 바뀌면 사진 한 장 */
  if (!log.length || log[log.length - 1].day !== v.day) {
    await sleep(500);
    await page.shot(`${OUT}/day${String(v.day).padStart(2, '0')}.png`);
  }
  if (v.가계부 && !log.some(x => x.가계부 === v.가계부)) console.log(`  ★ 가계부 — ${v.가계부}`);
  log.push(v);
  if (key === lastKey) stuck++; else stuck = 0;
  lastKey = key;
  if (stuck > 6) { console.log(`⚠ ${v.day}일에서 여섯 걸음째 아무것도 안 바뀝니다 — 손가락만으로는 못 갑니다`); break; }

  if (v.손가락) {
    const who = await tapHint();
    console.log(`  ${String(v.day).padStart(2)}일 · 손가락「${v.손가락}」→ ${who}`);
    await waitAct(); await sleep(700);
  } else {
    /* ★ 손가락이 없으면 **사람이 하듯 시트를 먼저 닫아 본다.** 시트가 열린 채로는
       손가락이 쉬게 되어 있어(§updateHint `!sheetOpen`), 안 닫으면 이 자가
       「안내가 없다」고 잘못 말한다 — 그건 자의 잘못이지 게임의 잘못이 아니다. */
    const wasOpen = await page.eval(`document.getElementById('sheet').classList.contains('open')`);
    if (wasOpen) {
      await page.eval(`(()=>{ try{window.__byeotSheet.close()}catch{} })()`, false);
      await sleep(700);
      const again = JSON.parse(await look());
      if (again.손가락) { console.log(`  ${String(v.day).padStart(2)}일 · 시트를 닫자 손가락이 났다`); continue; }
    }
    const ok = await page.eval(`(()=>{ const b=document.getElementById('next');
      if(!b || b.disabled || !b.offsetParent) return false; b.click(); return true; })()`);
    if (!ok) { console.log(`  ${String(v.day).padStart(2)}일 · 손가락 없음 · [다음 날]도 못 누름 — 멈춥니다`); break; }
    console.log(`  ${String(v.day).padStart(2)}일 · 손가락 없음 → [다음 날]`);
    await sleep(1100);
  }
  if (v.day >= DAYS) break;
}

/* ── 정리 ───────────────────────────────────────────────────────── */
console.log('');
console.log('── 날마다 무엇이 보였나 ──────────────────────────────────');
let prev = null;
for (const v of log) {
  const key = `${v.day}|${v.손가락}|${v.할일}`;
  if (key === prev) continue;
  prev = key;
  console.log(`${String(v.day).padStart(2)}일 ${v.첫플 ? '[튜토]' : '[본편]'} 할일「${v.할일 || '—'}」` +
              ` 손가락「${v.손가락 || '—'}」→${v.대상 || '—'}`);
}
/* ── 같은 대사가 두 번 나왔나 ─────────────────────────────── */
console.log('');
console.log('── 되풀이된 대사 ────────────────────────────────────────');
{
  const n = new Map();
  for (const l of said) { const k = l.split('|').slice(1).join('|'); n.set(k, (n.get(k) || 0) + 1); }
  const dup = [...n].filter(([, c]) => c > 1);
  if (!dup.length) console.log('  없음');
  for (const [k, c] of dup) console.log(`  ${c}번 — ${k}`);
}
console.log('');
console.log('예외', errs.length, errs.slice(0, 3).join(' | '));
console.log(`사진 ${OUT}/`);
await page.close();
