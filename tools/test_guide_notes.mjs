/* ============================================================
   tools/test_guide_notes.mjs — 「첫걸음 쪽지」와 자유 이동 발소리를 **화면에서** 잰다
   ------------------------------------------------------------
   FIXLIST-2026-08-16 §A(안내 다섯) · §E-3(자유 이동 걷기 소리)

   이 도구가 답해야 하는 것은 넷이다.

     ① **안 겹치나**  — 같은 순간에 두 안내가 뜨면 플레이어는 둘 다 안 읽는다.
                       이 저장소가 제일 자주 앓는 병이라 여기서 **세어서** 못 박는다:
                       쪽지(`#coach`)가 떠 있는 동안 손가락(`#hint`)은 반드시 꺼져 있어야 한다.
     ② **실제로 뜨나** — 코드가 바뀐 것과 화면이 바뀐 것은 다른 말이다(START-HERE §2).
                       그래서 `display` 를 묻는 것이 아니라 **화면 사각형**을 잰다.
     ③ **한 번만 뜨나** — 두 번째부터는 안내가 아니라 잔소리다.
     ④ **발소리가 안 끊기나 / 안 늘어붙나** — 자유 이동 중에 켜지고, 도착하면 꺼지고,
                       창을 흐리게 하면 그 자리에서 꺼져야 한다.
                       ⚠ 「켜 놓고 안 끄는 길」이 하나라도 있으면 발소리가 영영 난다.

   쓰는 법
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_guide_notes.mjs
     … --shot docs/handoff/img/guide      (사진을 남긴다)

   ⚠ `localStorage.clear()` 는 **`goto` 뒤에** 부른다(빈 문서에서 부르면 SecurityError).
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => {
  console.error('⏱ 자가 제한을 넘겨 멈춥니다 — 재는 중에 멈춘 것입니다.');
  process.exit(2);
}, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const SHOT = argOf('--shot', null);

let pass = 0, fail = 0;
const ok = (t, why) => { pass++; console.log('  OK  ' + t + (why ? '  → ' + why : '')); };
const no = (t, why) => { fail++; console.log('  FAIL ' + t + (why ? '  → ' + why : '')); };
const is = (c, t, why) => (c ? ok(t, why) : no(t, why));

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on((m, p) => {
  if (m === 'Runtime.exceptionThrown')
    errs.push(p.exceptionDetails.text + ' ' + ((p.exceptionDetails.exception || {}).description || ''));
});

/* ── 화면에 **실제로 보이는** 안내를 센다 ──────────────────────────────
   `display` 가 아니라 사각형을 잰다. 숨은 것을 「떠 있다」로 세면 겹침을 못 본다.
   ★ 이 목록이 곧 「지금 있는 안내 통로」다 — 새 통로가 늘면 여기 한 줄을 더한다. */
const VISIBLE = `(() => {
  const box = (id) => { const e = document.getElementById(id); if (!e) return null;
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    const on = r.width > 1 && r.height > 1 && cs.display !== 'none' && cs.visibility !== 'hidden'
               && +cs.opacity > 0.05 && r.bottom > 0 && r.top < innerHeight;
    return on ? { w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top) } : null; };
  const marks = [...document.querySelectorAll('#marks .mark')].filter(e => {
    const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; }).length;
  return {
    coach:     box('coach'),          /* 첫걸음 쪽지 (새 통로) */
    hint:      box('hint'),           /* 손가락 */
    quest:     box('quest'),          /* 아래 한 줄 */
    guide:     box('guide'),          /* 안내판 [?] */
    dropLabel: box('dropLabel'),      /* 옮기는 동안 */
    placeHint: box('placeHint'),      /* 배치 모드 */
    banners:   [...document.querySelectorAll('#event > *')].length,
    marks,
    talking:   document.getElementById('stage').classList.contains('talking'),
    coachNow:  (window.__byeotCoach ? window.__byeotCoach.now() : null),
    coachSeen: (window.__byeotCoach ? window.__byeotCoach.seen() : [])
  };
})()`;

const tap = async (x, y) => {
  await page.eval(`(()=>{ const c=document.getElementById('roomCanvas');
    c.dispatchEvent(new PointerEvent('pointerdown',{clientX:${x},clientY:${y},bubbles:true,pointerId:1,pointerType:'touch',isPrimary:true}));
    c.dispatchEvent(new MouseEvent('mousedown',{clientX:${x},clientY:${y},bubbles:true}));
    window.dispatchEvent(new MouseEvent('mouseup',{clientX:${x},clientY:${y},bubbles:true}));
    c.dispatchEvent(new PointerEvent('pointerup',{clientX:${x},clientY:${y},bubbles:true,pointerId:1,pointerType:'touch',isPrimary:true}));
  })()`, false);
  await sleep(500);
};

console.log(`\n══ 첫걸음 쪽지 · 발소리 — ${BASE} · 390×844 ══\n`);

await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 120000, 300);
await sleep(6000);
/* 오프닝 대사를 건너뛴다 — 대사가 떠 있으면 쪽지는 규칙상 안 뜬다(그것도 아래에서 잰다) */
await page.eval(`(()=>{ try{document.getElementById('dlgSkip').click()}catch{} })()`, false);
await sleep(1200);
await page.eval(`(()=>{ try{document.getElementById('guideClose').click()}catch{} })()`, false);
await sleep(800);

/* ══ ⓪ 지금 있는 안내를 센다 — 새 것을 얹기 전의 바닥값 ═══════════════════ */
const base = await page.eval(VISIBLE);
console.log('== ⓪ 첫 화면에 떠 있는 안내 ==');
console.log('   ' + JSON.stringify(base));
is(!base.coach, '⓪ 첫 화면에는 쪽지가 없다 — 아무것도 안 눌렀으니까');
if (SHOT) await page.shot(`${SHOT}/coach_00_boot.png`);

/* ══ ① A-1 사람을 누르면 「자유 이동」 쪽지 ═══════════════════════════════ */
console.log('\n== ① A-1 사람을 눌러 자유 이동 ==');
const rect = await page.eval(`(()=>{ const r=document.getElementById('roomCanvas').getBoundingClientRect();
  return {l:r.left,t:r.top,w:r.width,h:r.height}; })()`);
const jp = await page.eval(`(()=>{ try{ return window.__rv.characterScreenPos('jachwi'); }catch{ return null; } })()`);
if (!jp) {
  no('① 자취생이 화면에 없다 — 이 검사를 못 돈다');
} else {
  await page.eval(`window.__rv.selectCharacter(null)`, false);
  await sleep(300);
  await tap(Math.round(rect.l + jp.x), Math.round(rect.t + jp.y));
  const a = await page.eval(VISIBLE);
  is(!!a.coach && a.coachNow === 'walk', '① 사람을 누르면 쪽지가 **화면에** 뜬다',
     JSON.stringify(a.coach) + ' · ' + a.coachNow);
  is(!a.hint, '①-b ★ 같은 순간에 손가락은 꺼져 있다 (겹침 0)', a.hint ? JSON.stringify(a.hint) : '없음');
  const txt = await page.eval(`(document.getElementById('coachBody')||{}).textContent||''`);
  is(/바닥/.test(txt) && /걸어/.test(txt), '①-c 쪽지가 「바닥을 누르면 걸어간다」를 말한다', txt.slice(0, 40));
  if (SHOT) await page.shot(`${SHOT}/coach_01_walk.png`);

  /* ③ 한 번만 — 닫고 다시 눌러도 안 뜬다 */
  await page.eval(`window.__byeotCoach.hide()`, false);
  await page.eval(`window.__rv.selectCharacter(null)`, false);
  await sleep(400);
  await tap(Math.round(rect.l + jp.x), Math.round(rect.t + jp.y));
  const b = await page.eval(VISIBLE);
  is(!b.coach, '①-d ★ 두 번째부터는 안 뜬다 (한 번 보면 끝)', b.coachNow || '없음');
}

/* ══ ② A-2 가구를 누르면 「가구 이동」 쪽지 ═══════════════════════════════ */
console.log('\n== ② A-2 가구 이동 ==');
await page.eval(`window.__rv.selectCharacter(null)`, false);
await sleep(300);
/* 침대를 화면에서 찾아 누른다 — 자리는 방뷰에 물어본다(좌표를 지어내지 않는다) */
const fp = await page.eval(`(()=>{ try{
  const f=(window.__rv.furniture()||[]).find(x=>/bed|dresser|desk/.test(x.uid));
  if(!f) return null; const p=window.__rv.screenPosOf(f.uid);
  return p ? { uid:f.uid, x:p.x, y:p.y } : null; }catch{ return null; } })()`);
if (!fp) {
  no('② 가구를 화면에서 못 찾았다 — 이 검사를 못 돈다');
} else {
  await tap(Math.round(rect.l + fp.x), Math.round(rect.t + fp.y));
  await sleep(400);
  const c = await page.eval(VISIBLE);
  const picked = await page.eval(`document.getElementById('stage').classList.contains('furnpicked')`);
  is(picked, '②-0 가구가 골라졌다', fp.uid);
  is(!!c.coach && c.coachNow === 'furn', '② 가구를 누르면 쪽지가 뜬다',
     JSON.stringify(c.coach) + ' · ' + c.coachNow);
  is(!c.hint, '②-b ★ 같은 순간에 손가락은 꺼져 있다 (겹침 0)', c.hint ? JSON.stringify(c.hint) : '없음');
  if (SHOT) await page.shot(`${SHOT}/coach_02_furn.png`);
  /* 옮기기에 들어가면 쪽지는 걷힌다 — 그때는 `#dropLabel` 이 말한다(통로 하나) */
  await page.eval(`(()=>{ const b=document.getElementById('furnMove');
    b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:2,isPrimary:true})); })()`, false);
  await sleep(500);
  const d = await page.eval(VISIBLE);
  is(!d.coach, '②-c 옮기기에 들어가면 쪽지가 걷힌다 — 그 자리는 [떨굼표시]가 말한다',
     d.dropLabel ? '떨굼표시 ' + JSON.stringify(d.dropLabel) : '떨굼표시 없음');
  await page.eval(`(()=>{ try{ furnPicked && furnPicked.clear && furnPicked.clear(); }catch{}
                          try{ document.getElementById('furnClose').click(); }catch{} })()`, false);
  await sleep(400);
}

/* ══ ③ 대사가 뜨면 쪽지가 안 뜬다 (겹침을 구조로 막았나) ═══════════════════ */
console.log('\n== ③ 겹침 규율 ==');
await page.eval(`window.__byeotCoach.hide()`, false);
const blocked = await page.eval(`(()=>{
  const st = document.getElementById('stage');
  const had = st.classList.contains('talking');
  st.classList.add('talking');
  const r = window.__byeotCoach.show('pot');       /* 아직 안 본 쪽지 */
  st.classList.toggle('talking', had);
  return r; })()`);
is(blocked === false, '③ 대사가 떠 있으면 쪽지를 안 낸다', '돌려준 값 ' + blocked);
const notes = await page.eval(`window.__byeotCoach.notes()`);
/* ★★ 2026-08-19 — **셋 → 넷.** 2026-08-16 에 이 줄을 박을 때는 A-1·A-2·A-3 셋이었는데,
   2026-08-17 에 `walkTip`(A-1b · 「사람을 눌러 보세요」)이 들어오면서 넷이 됐다.
   **검사가 안 따라와 그날부터 계속 빨갰다**(스태시로 확인 · 2026-08-19).
   ⇒ 뜻은 그대로다 — *쪽지가 무분별하게 늘지 않는다*. 그래서 **수가 아니라 이름**으로 못 박는다.
     이름으로 재면 「하나 늘었다」와 「엉뚱한 것이 들어왔다」가 갈린다. */
const NOTE_IDS = ['walk', 'walkTip', 'furn', 'pot'];
is(Array.isArray(notes) && notes.length === NOTE_IDS.length && NOTE_IDS.every(k => notes.includes(k)),
   '③-b 쪽지는 넷뿐이다 (A-1 walk · A-1b walkTip · A-2 furn · A-3 pot)', String(notes));

/* ══ ④ §E-3 자유 이동 발소리 ═════════════════════════════════════════════ */
console.log('\n== ④ §E-3 자유 이동 발소리 ==');
await page.eval(`window.__rv.selectCharacter('jachwi')`, false);
await sleep(300);
const before = await page.eval(`window.__byeotWalkSfx()`);
is(before && before.on === false, '④-0 걷기 전에는 발소리가 꺼져 있다', JSON.stringify(before));

/* 실제로 걷게 한다 — 방 한가운데 바닥으로 보낸다(`walkTo` 는 화면 좌표를 받는다) */
const sent = await page.eval(`window.__rv.walkTo('jachwi', ${Math.round(rect.l + rect.w * 0.42)}, ${Math.round(rect.t + rect.h * 0.62)})`);
await sleep(400);
const during = await page.eval(`(()=>({ sfx: window.__byeotWalkSfx(),
  walking: window.__rv.characters().some(c=>c.walking) }))()`);
is(sent && sent.ok, '④-1 자유 이동이 실제로 시작됐다', JSON.stringify(sent));
is(during.walking ? during.sfx.on === true : true,
   '④-2 ★ 걷는 동안 발소리가 켜진다', JSON.stringify(during));
if (SHOT) await page.shot(`${SHOT}/coach_03_walk_sfx.png`);

/* 도착하면 꺼진다 */
await page.waitFor(`!window.__rv.characters().some(c=>c.walking)`, 15000, 200).catch(() => {});
await sleep(400);
const after = await page.eval(`window.__byeotWalkSfx()`);
is(after && after.on === false, '④-3 ★ 도착하면 발소리가 멎는다', JSON.stringify(after));

/* 중간에 끊었을 때 — 걷다가 세우면 그 자리에서 멎는다.
   ⚠ 갈 자리를 **하나만 찍어 두면 안 된다.** 앞 걸음이 끝난 자리가 어디냐에 따라
     그 점이 「거기에는 못 섭니다」가 된다 — 실제로 한 번 그렇게 헛짚었다.
     ⇒ 몇 점을 훑어 **실제로 갈 수 있는 첫 점**을 쓴다. */
const walkSomewhere = async () => {
  for (const [fx, fy] of [[0.50, 0.60], [0.42, 0.55], [0.58, 0.62], [0.35, 0.58], [0.50, 0.68]]) {
    const r = await page.eval(`window.__rv.walkTo('jachwi', ${Math.round(rect.l + rect.w * fx)}, ${Math.round(rect.t + rect.h * fy)})`);
    if (r && r.ok) return r;
  }
  return { ok: false, reason: '갈 수 있는 점을 못 찾았다' };
};
const sent2 = await walkSomewhere();
await sleep(300);
await page.eval(`window.__rv.stopWalk('jachwi')`, false);
await sleep(400);
const stopped = await page.eval(`window.__byeotWalkSfx()`);
is(sent2 && sent2.ok, '④-4 두 번째 자유 이동도 시작된다', JSON.stringify(sent2));
is(stopped && stopped.on === false, '④-5 ★ 도중에 세워도 멎는다', JSON.stringify(stopped));

/* 창이 흐려졌을 때 — 걷는 도중에 blur 를 내면 그 자리에서 멎어야 한다.
   ★★ **한 번 끄는 것으로는 모자란다.** 재는 쪽(120ms 틱)이 사람이 아직 걷는 것을 보고
     도로 켤 수 있기 때문이다 — 그래서 **여러 틱을 지난 뒤에** 묻는다.
     이게 「켜 놓고 안 끄는 길」을 잡는 유일한 방법이다. */
const sent3 = await walkSomewhere();
await sleep(160);
/* ⚠ **흐리게 할 때 실제로 걷고 있었는지**를 같이 찍는다. 안 걷는 사이에 껐다 켜 놓고
   「멎었다」고 적으면 그것이 곧 재는 자의 거짓말이다(START-HERE §2.9). */
const atBlur = await page.eval(`(()=>({ walking: window.__rv.characters().some(c=>c.walking),
  sfx: window.__byeotWalkSfx().on }))()`);
is(atBlur.walking && atBlur.sfx, '④-6a 흐리게 하기 **직전에** 실제로 걷고 있었고 소리도 났다',
   JSON.stringify(atBlur));
await page.eval(`window.dispatchEvent(new Event('blur'))`, false);
await sleep(500);                                  /* 틱 네 번을 지나 보낸다 */
const blurOff = await page.eval(`(()=>({ sfx: window.__byeotWalkSfx(),
  walking: window.__rv.characters().some(c=>c.walking) }))()`);
is(blurOff && blurOff.sfx.on === false, '④-6 ★ 창이 흐려지면 멎고, 틱이 여러 번 지나도 안 되켜진다',
   JSON.stringify(blurOff) + ' · 보냈나 ' + JSON.stringify(sent3));
/* 되돌아오면 다시 켜진다 — 영영 조용해지면 그것도 고장이다 */
await page.eval(`window.dispatchEvent(new Event('focus'))`, false);
await sleep(300);
const backOn = await page.eval(`(()=>({ sfx: window.__byeotWalkSfx(),
  walking: window.__rv.characters().some(c=>c.walking) }))()`);
is(backOn.walking ? backOn.sfx.on === true : backOn.sfx.muted === false,
   '④-6b ★ 창이 돌아오면 다시 켜진다 (영영 조용해지지 않는다)', JSON.stringify(backOn));
await page.eval(`window.__rv.stopWalk('jachwi')`, false);
await sleep(400);

/* 방뷰가 없어져도 늘어붙지 않는다 — 가장 나쁜 길을 흉내 낸다 */
const gone = await page.eval(`(()=>{ const rv = window.__rv;
  const old = rv.characters; rv.characters = () => { throw new Error('없어진 척'); };
  return new Promise(res => setTimeout(() => { const s = window.__byeotWalkSfx();
    rv.characters = old; res(s); }, 400)); })()`);
is(gone && gone.on === false, '④-7 ★ 방뷰가 던져도 발소리가 안 남는다', JSON.stringify(gone));

/* ══ ⑤ A-3 · A-4 · A-5 — **가방 한 줄**과 무순 카드 ═════════════════════════
   ★ 이 셋은 쪽지가 아니라 **시트 안**에서 말한다. 시트는 방 위를 통째로 덮으므로
     쪽지·손가락·말풍선·배너와 물리적으로 겹칠 수가 없다 — 그것이 여기를 고른 이유다. */
console.log('\n== ⑤ A-3·A-4·A-5 가방 한 줄 ==');
await page.eval(`(()=>{ try{ window.__byeotSheet.open('tabBag'); }catch{} })()`, false);
await sleep(900);
/* ⚠ 시트는 굴러간다 — 굴려서 보이게 한 뒤에 잰다. 「굴려야 보인다」는 안 보이는 것이 아니다 */
await page.eval(`(()=>{ const e=document.querySelector('#bagGrid .baghelp');
  if(e) e.scrollIntoView({block:'center'}); })()`, false);
await sleep(400);
const bag1 = await page.eval(`(()=>{ const e=document.querySelector('#bagGrid .baghelp');
  if(!e) return null; const r=e.getBoundingClientRect();
  return { txt:e.textContent, w:Math.round(r.width), h:Math.round(r.height), t:Math.round(r.top),
           inView: r.top < innerHeight && r.bottom > 0 }; })()`);
is(!!bag1 && bag1.inView, '⑤-1 가방 한 줄이 **화면에** 있다', bag1 ? JSON.stringify(bag1).slice(0, 160) : '없음');
is(!!bag1 && /끌면/.test(bag1.txt) && /게임이 빈 자리를 골라/.test(bag1.txt),
   '⑤-2 A-3 ★ 「끌면 그 자리 · 누르면 게임이 고른다」를 갈라 말한다', bag1 ? bag1.txt.slice(0, 100) : '');
is(!!bag1 && /하나씩/.test(bag1.txt) && /끌거나 누르면/.test(bag1.txt),
   '⑤-2b ★ 옛 안내(「끌거나 누르면 한 번에 하나씩」)를 안 버렸다 — 덧붙였을 뿐이다',
   bag1 ? bag1.txt.slice(0, 60) : '');
if (SHOT) await page.shot(`${SHOT}/coach_04_baghelp_first.png`);

/* 시루를 하나 놓아 본 뒤 — 줄이 **바뀌어야** 한다(A-4 「넷쯤 놓기」) */
/* ⚠ **손으로 누른다.** `startPhonePlace` 는 모듈 안에 있어 밖에서 못 부른다 —
   부를 수 있는 것만 재면 「화면에서 되나」를 못 잰다(그것이 이 저장소의 계율이다). */
const placed = await page.eval(`(()=>{ const c=document.querySelector('#bagGrid .bagslot[data-place="beansprout"]');
  if(!c) return '시루 칸이 없다'; c.click(); return true; })()`);
await sleep(1200);
/* 놓은 뒤 [확인] — 이것도 **손으로** 누른다(폰은 pointerdown 이 답이다) */
await page.eval(`(()=>{ const b=document.getElementById('placeOk');
  if(b) b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:3,isPrimary:true})); })()`, false);
await sleep(900);
await page.eval(`(()=>{ try{ window.__byeotSheet.open('tabBag'); }catch{} })()`, false);
await sleep(900);
await page.eval(`(()=>{ const e=document.querySelector('#bagGrid .baghelp');
  if(e) e.scrollIntoView({block:'center'}); })()`, false);
await sleep(400);
const bag2 = await page.eval(`(()=>{ const e=document.querySelector('#bagGrid .bagmore');
  return e ? e.textContent : null; })()`);
is(placed === true, '⑤-3 시루를 하나 놓았다', String(placed));
/* ★ 첫 판이 들고 시작하는 시루는 **하나뿐**이다(재서 알았다). 그 하나를 놓으면 가방이 비고,
   그때 필요한 말은 「더 놓아라」가 아니라 **「더 사서 갈라 놓아라」**다 — 그것이 §A-4 다.
   ⚠ 「넷」이라는 수를 문구에서 찾지 않는다. 개수를 박지 않는 것이 이 줄의 규율이라, 검사가
     그 수를 요구하면 검사가 값을 못박는 셈이 된다(START-HERE §2 「검사가 고장을 못 박는다」). */
is(!!bag2 && /시루가/.test(bag2) && /상점|오는 중/.test(bag2),
   '⑤-4 A-4 ★ 가방이 빈 뒤에도 안내가 남고, 「더 사서 갈라 놓아라」로 넘어간다',
   bag2 ? bag2.slice(0, 110) : '없음');
if (SHOT) await page.shot(`${SHOT}/coach_05_baghelp_more.png`);

/* ── A-5 무순 카드 — **걸음마다 다른 말**을 하나 ──
   ⚠ 이 카드는 몬스테라가 온 뒤에만 뜬다(`musunOpenNow`). 거기까지 실제로 굴리면 검사가
     몇 분짜리가 되므로 **상태를 그 시점으로 세워 놓고** 화면을 다시 그리게 한다.
     ⚠ 그러면 「실제로 그 날에 그렇게 뜨나」는 못 재는 것이다 — 재는 것은 **문구의 갈래**뿐이다.
       모르는 것은 모른다고 적는다. */
const musun = await page.eval(`(() => {
  const S = window.__S();
  try { S.firstPlay.monstera.arrived = true; } catch (e) { return { err: String(e) }; }
  try { (S.shop = S.shop || {}).stock = S.shop.stock || {}; S.shop.stock.sprout_tray = 1; } catch { }
  /* 다시 그리게 만든다 — 화면을 그리는 길을 새로 내지 않고 있는 손잡이를 쓴다 */
  try { document.getElementById('lamps').dispatchEvent(new Event('change')); } catch { }
  const card = document.getElementById('musunCard');
  const cue = card && card.querySelector('.dragcue');
  const cs = card ? getComputedStyle(card) : null;
  return { shown: !!(cs && cs.display !== 'none'),
           state: (document.getElementById('musunState') || {}).textContent || '',
           cue: cue ? cue.textContent : null,
           cueShown: !!(cue && getComputedStyle(cue).display !== 'none') };
})()`);
await sleep(500);
/* ★★★ 2026-08-30 — **무순 «카드»는 화면에서 없어졌다.** 2026-08-16 에 박사님이
   *"카드 없애고"* 하셔서 `drawMusun` 이 `hide` 로 늘 접는다(game.html §drawMusun `const hide = true`).
   손잡이는 **가방 격자 칸**으로 갔다. 그러니 「카드가 뜨나」는 이제 없는 것을 묻는 것이다.
   ⇒ 재는 «뜻»은 그대로다 — **「안내가 «놓기»를 말하나」**. 그 말은 카드가 접혀도 살아 있다
     (`.dragcue` 는 카드 안에 있지만 글은 같은 함수가 짓는다).
   ⚠ 「심기」까지 한 문장에 넣던 것도 낡았다 — 지금은 걸음마다 «다른 말»을 한다
     (① 아직 안 놓았다 → ② 놓았는데 안 심었다 → ③ 심었는데 물 전). 한 문장에 둘을 넣으라고
     우기면 그 갈래를 도로 뭉개게 된다. ⇒ 여기서는 ①의 말만 본다. */
is(!!musun.cue, '⑤-8 무순 안내 글이 서 있다 (카드는 접혔어도)', JSON.stringify(musun).slice(0, 140));
is(!!musun.cue && /끌어서|놓/.test(musun.cue),
   '⑤-9 A-5 ★ 첫 걸음은 «놓기»라고 말한다', musun.cue || '없음');
if (SHOT) { await page.eval(`(()=>{ try{ window.__byeotSheet.open('tabPlants'); }catch{} })()`, false);
            await sleep(700); await page.shot(`${SHOT}/coach_07_musun.png`); }
/* ★ 시트가 열려 있으면 손가락은 쉬어야 한다 — 안 그러면 시트 **위에** 얹혀 글씨를 덮는다.
   (사진으로 잡은 겹침이라 여기서 못 박는다 · §updateHint 마지막 갈래) */
const overSheet = await page.eval(`(()=>{ const h=document.getElementById('hint');
  const open=document.getElementById('sheet').classList.contains('open');
  const r=h.getBoundingClientRect();
  return { open, hintOn: h.classList.contains('on'), w:Math.round(r.width) }; })()`);
is(overSheet.open ? !overSheet.hintOn : true,
   '⑤-10 ★ 시트가 열려 있는 동안 손가락이 시트 위에 안 얹힌다', JSON.stringify(overSheet));

/* 안내판 [?] — 자유 이동·가구 이동을 **되찾을 자리**가 있나 (쪽지는 한 번뿐이다) */
await page.eval(`(()=>{ try{ window.__byeotSheet.close(); }catch{} })()`, false);
await sleep(500);
await page.eval(`document.getElementById('guideOpen').click()`, false);
await sleep(900);
const gtips = await page.eval(`[...document.querySelectorAll('#guide .gtip')].map(e=>e.textContent)`);
const joined = (gtips || []).join(' | ');
is(/사람을 누르면/.test(joined), '⑤-5 A-1 ★ 안내판에 「사람을 누르면 걸어간다」가 있다');
is(/가구/.test(joined) && /옮기기/.test(joined), '⑤-6 A-2 ★ 안내판에 「가구를 누르면 [옮기기]」가 있다');
is(!/\[이동\]|\[회전\]/.test(joined), '⑤-7 ★ **없는 단추 이름**([이동]·[회전])을 더는 안 댄다');
if (SHOT) await page.shot(`${SHOT}/coach_06_guidepanel.png`);
await page.eval(`document.getElementById('guideClose').click()`, false);
await sleep(400);

/* ══ ⑥ 부팅 예외 ═══════════════════════════════════════════════════════ */
console.log('\n== ⑤ 예외 ==');
is(errs.length === 0, '⑥ game.html 예외 0건', errs.length ? errs.slice(0, 3).join(' | ') : '0건');

await page.close();
console.log(`\n${fail ? '✗' : '✓'} ${pass}/${pass + fail} 통과${fail ? ` (실패 ${fail})` : ''}\n`);
process.exit(fail ? 1 : 0);
