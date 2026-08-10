/* ============================================================
   tools/test_nextday_gate.mjs — [다음 날] 문지기 · 오류 상자 · 2026-08-10 신설
   ------------------------------------------------------------
     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/test_nextday_gate.mjs

   ★ 왜 이 검사가 필요한가 — 박사님이 폰으로 Day 92 를 플레이하시다 **판이 멈췄다.**
     사진 두 가지가 같이 왔다:
       ① [다음 날]이 안 넘어간다. 시루는 방에 서 있는데 「가방의 콩나물 시루를 먼저 방 안에
          놓아 주세요」가 뜬다.
       ② 같은 경고가 두 번씩 · 두 종류가 **네 개** 쌓여 무대와 버튼을 덮었다.

   ① 의 원인 — 문지기가 `S.firstPlay.beansprout.slotId` 하나를 봤다. 시루가 각개가 되면서
     자리의 정본은 **시루마다**(`pots[i].slotId`/`at`)로 내려왔고, 그 칸은 대표 시루의
     **읽기용 사본**일 뿐이다(first_play.js §자리는 시루마다 따로다). 사본이 비면 방에
     시루가 서 있어도 하루가 안 갔다.
   ② 의 원인 — 오류를 `insertAdjacentHTML('afterbegin', …)` 로 **앞에 붙이기만** 하고
     지우는 곳이 없었다. `#side` 가 없어서 전부 하단 액션바(`#bottom`)에 붙었고,
     바가 자라 버튼을 밀어냈다. 2026-08-08 에 배너에서 이미 고친 그 병이다.

   ══ 무엇을 보나 ═══════════════════════════════════════════════════════════
     A  하나도 안 놓은 판은 **여전히 막는다** — 그건 옳은 안내다
     B  ★ 오류 상자는 **하나만** 산다 — 다섯 번 일으켜도 상자 하나, 「×5」로 접힌다
     C  ★ 오류가 떠 있어도 **밑의 버튼이 눌린다** (상자가 무대를 가로채면 안 된다)
     D  눌러서 닫힌다 · 닫힌 상자는 포인터를 안 먹는다
     E  ★★ 시루가 방에 선 판에서 **[다음 날]이 실제로 넘어간다** — 자리 사본이 비어 있어도
     F  ★ 그때 사본이 **고쳐진다** — loop.js 가 그 칸으로 「작물을 자라게 할까」를 가른다
     G  다시 심기 실패는 **다시 심기의 일**이다 — 그 실패가 [다음 날]을 막지 않는다
     I  ★ 콩나물만 안 본다 — **무순만 놓은 판도** 하루가 간다

   ⚠ 폰 폭 390px 로 잰다. 상자가 버튼을 덮는지는 폭이 좁을 때 드러난다.
   ⚠ `BYEOT_URL` 은 **서버 주소**다(페이지 주소를 넣으면 404 로 죽는다).
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const SHOT_DIR = fileURLToPath(new URL('../docs/engine/shots/qa/', import.meta.url));

let bad = 0, seen = 0;
const ok = (name, cond, got) => {
  seen++;
  console.log(`${cond ? '  OK' : 'FAIL'}  ${name}${got == null || got === '' ? '' : '  → ' + got}`);
  if (!cond) bad++;
};

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(3500);

/* 대사·안내판을 걷는다 — 덮개가 남아 있으면 누름이 방에 안 닿는다(test_place_confirm 과 같다) */
const clear = () => page.eval(`(()=>{ const g=document.getElementById('guide'); if(g) g.classList.remove('on');
  const s=document.getElementById('stage'); if(s) s.classList.remove('talking'); })()`, false);
const clickId = (id) => page.eval(`(()=>{const e=document.getElementById('${id}');
  if(!e||e.disabled) return false; e.click(); return true;})()`);
/* ⚠ **고정 `sleep` 으로 기다리지 않는다.** 검사를 줄줄이 돌리면 기계가 바빠져
   「7초면 되겠지」가 안 되는 날이 온다 — 실제로 이 파일이 배치 실행에서만 한 번 넘어졌다.
   조건이 참이 될 때까지 **묻는다.** 못 기다리면 false 를 돌려주고 그 자리에서 FAIL 이 뜬다. */
const until = async (expr, ms = 25000) => {
  try { await page.waitFor(expr, ms, 200); return true; } catch { return false; }
};
const errOn = `(()=>{const b=document.getElementById('errBox');
  return !!(b && b.classList.contains('on'));})()`;
const errSays = (re) => `(()=>{const b=document.getElementById('errBox');
  return !!(b && b.classList.contains('on') && ${re}.test(b.textContent||''));})()`;
await clear();

/* 오류 상자의 지금 모습 — 상자 수 · 접힌 횟수 · 포인터를 먹나 · 높이 */
const errSnap = () => page.eval(`(()=>{
  const b = document.getElementById('errBox');
  if (!b) return { exists:false, on:false, rows:0, pe:'none', text:'', h:0, boxes:0 };
  const cs = getComputedStyle(b);
  const r = b.getBoundingClientRect();
  return {
    exists:true,
    on: b.classList.contains('on'),
    boxes: document.querySelectorAll('#errBox').length,
    rows: b.querySelectorAll('.err').length,
    strays: document.querySelectorAll('.err').length - b.querySelectorAll('.err').length,
    pe: cs.pointerEvents,
    display: cs.display,
    text: (b.textContent||'').replace(/\\s+/g,' ').trim().slice(0,120),
    h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom)
  }; })()`);

const dayNow = () => page.eval(`window.__S().day`);
const potSnap = () => page.eval(`(()=>{ const S=window.__S(), b=S.firstPlay.beansprout;
  return { copy: b.slotId, placed:(b.pots||[]).filter(p=>p&&(p.slotId||p.at)).length,
           pots:(b.pots||[]).length }; })()`);

console.log('\n══ A. 하나도 안 놓은 판은 여전히 막는다 ══════════════════════════');
let s0 = await potSnap();
ok('A-0 아직 아무 시루도 안 놓였다', s0.placed === 0, JSON.stringify(s0));
const dA = await dayNow();
await clickId('next');
await until(errOn, 20000);
ok('A-1 ★하루가 안 간다 (옳은 막음)', (await dayNow()) === dA, `day ${dA}`);
let e = await errSnap();
ok('A-2 안내가 뜬다', e.on === true && /놓아 주세요/.test(e.text), e.text);

console.log('\n══ B. 오류 상자는 하나만 산다 ══════════════════════════════════');
for (let i = 0; i < 4; i++) {
  const n = i + 2;
  await clickId('next');
  await until(errSays(`/×${n}/`), 20000);
}
e = await errSnap();
ok('B-1 ★다섯 번 눌러도 상자는 **하나**다', e.boxes === 1, `#errBox ${e.boxes}개`);
ok('B-2 ★같은 말은 한 줄로 접힌다', e.rows === 1, `줄 ${e.rows}개`);
ok('B-3 몇 번 났는지는 남는다 (×5)', /×5/.test(e.text), e.text);
ok('B-4 상자 밖에 떠도는 .err 가 없다', e.strays === 0, `떠도는 것 ${e.strays}개`);
ok('B-5 화면 높이를 안 넘는다', e.h <= 844 * 0.45, `높이 ${e.h}px`);

/* 서로 다른 말 넷을 억지로 넣어 「많아야 셋 + …외 N개」를 잰다 */
await page.eval(`(()=>{ for (const t of ['가짜 오류 1','가짜 오류 2','가짜 오류 3','가짜 오류 4'])
  window.__errBox.push(t); })()`, false);
await sleep(200);
e = await errSnap();
ok('B-6 ★많아야 셋 + 「…외 N개」', e.rows === 4 && /외 2개/.test(e.text), `줄 ${e.rows} · ${e.text}`);

console.log('\n══ C. 오류가 떠 있어도 밑의 버튼이 눌린다 ═══════════════════════');
const hit = await page.eval(`(()=>{
  const n = document.getElementById('next');
  const r = n.getBoundingClientRect();
  const el = document.elementFromPoint(Math.round(r.left+r.width/2), Math.round(r.top+r.height/2));
  const box = document.getElementById('errBox');
  const br = box.getBoundingClientRect(), nr = r;
  const overlap = !(br.bottom <= nr.top || nr.bottom <= br.top || br.right <= nr.left || nr.right <= br.left);
  return { hitId: el ? (el.id || el.tagName) : null, overlap,
           errBottom: Math.round(br.bottom), nextTop: Math.round(nr.top) }; })()`);
ok('C-1 ★[다음 날] 한가운데를 짚으면 **버튼이 잡힌다**', hit.hitId === 'next', JSON.stringify(hit));
ok('C-2 ★상자가 하단 액션바를 안 덮는다', hit.overlap === false,
   `상자 밑 ${hit.errBottom} · 버튼 위 ${hit.nextTop}`);

console.log('\n══ D. 눌러서 닫힌다 · 닫히면 포인터를 안 먹는다 ═════════════════');
await page.eval(`document.getElementById('errBox').click()`, false);
await sleep(200);
e = await errSnap();
ok('D-1 ★누르면 사라진다', e.on === false && e.rows === 0, JSON.stringify({ on: e.on, rows: e.rows }));
ok('D-2 ★꺼진 상자는 포인터를 안 먹는다', e.pe === 'none' || e.display === 'none',
   `pointer-events:${e.pe} · display:${e.display}`);

console.log('\n══ E. 시루가 선 판에서는 하루가 간다 (자리 사본이 비어도) ════════');
ok('E-0 [방에 배치하기] 를 누른다', await clickId('cropPlaceStart'));
await until(`(window.__S().firstPlay.beansprout.pots||[]).some(p=>p&&(p.slotId||p.at))`, 25000);
await clear();
await clickId('placeOk');
await until(`!document.getElementById('stage').classList.contains('picked')`, 15000);
await clear();
let s1 = await potSnap();
ok('E-1 시루가 방에 섰다', s1.placed === 1, JSON.stringify(s1));

/* ★★ 박사님 판을 여기서 만든다 — **시루는 방에 서 있는데 자리 사본만 비었다.**
   이 한 줄이 Day 92 를 멈춰 세운 그 상태다. */
await page.eval(`(()=>{ const b=window.__S().firstPlay.beansprout; b.slotId=null; b.at=null; })()`, false);
s1 = await potSnap();
ok('E-2 ★사본은 비었는데 시루는 서 있다 (박사님 판)',
   s1.copy === null && s1.placed === 1, JSON.stringify(s1));

const dE = await dayNow();
await clickId('next');
/* 하루가 갔거나 · 오류가 떴거나 — **둘 중 하나가 날 때까지** 기다린다.
   「하루가 가기만」 기다리면 막힌 판에서 시간만 끌다 시간 초과로 죽는다(원인이 안 보인다). */
await until(`window.__S().day === ${dE + 1} || ${errOn}`, 30000); await clear();
const dE2 = await dayNow();
ok('E-3 ★★[다음 날]이 실제로 넘어간다', dE2 === dE + 1, `day ${dE} → ${dE2}`);
e = await errSnap();
ok('E-4 그때 오류 상자가 안 뜬다', e.on === false, e.text);

console.log('\n══ F. 사본이 고쳐진다 — 안 고치면 작물만 조용히 안 자란다 ═══════');
const s2 = await potSnap();
ok('F-1 ★자리 사본이 다시 세워졌다 (loop.js:594 가 이 칸을 본다)',
   !!s2.copy && s2.placed === 1, JSON.stringify(s2));

console.log('\n══ G. 다시 심기 실패는 [다음 날]을 안 막는다 ════════════════════');
/* 아직 아무것도 안 거둔 판에서 [다시 심기]를 부른다 — `resowCrop` 이 안내를 던진다 */
/* ⚠ [다시 심기]는 캐릭터가 **걸어간 뒤에** 규칙을 부른다(doAct) — 그래서 실패도 늦게 온다.
   짧게 기다리면 아직 아무 일도 안 난 판을 재게 된다(실제로 한 번 그랬다). */
const resow = await page.eval(`(()=>{ const b=document.getElementById('resow');
  if(!b) return 'no-button'; b.style.display=''; b.disabled=false; b.click(); return 'clicked'; })()`);
await until(errSays('/수확하지 않았습니다/'), 30000); await clear();
e = await errSnap();
ok('G-1 다시 심기가 실패해 안내가 뜬다',
   resow === 'clicked' && /수확하지 않았습니다|다시 심/.test(e.text), `${resow} · ${e.text}`);
ok('G-2 ★그 실패가 버튼을 안 잠근다 (hardLock 이 아니다)',
   await page.eval(`document.body.dataset.hardLock !== '1' && !document.getElementById('next').disabled`));
/* ⚠ 기다리기 전에 상자를 비운다 — 켜진 채로 두면 「오류가 떴다」가 처음부터 참이라
   아무것도 안 기다리고 지나간다(재는 척만 하는 검사가 된다). */
await page.eval(`window.__errBox.clear()`, false);
const dG = await dayNow();
await clickId('next');
await until(`window.__S().day === ${dG + 1} || ${errOn}`, 30000); await clear();
ok('G-3 ★★다시 심기 실패 뒤에도 하루가 간다', (await dayNow()) === dG + 1, `day ${dG}`);

console.log('\n══ I. 콩나물만 보지 않는다 — 무순만 놓은 판도 하루가 간다 ═══════');
/* 콩나물 시루를 **가방으로** 보내고, 그 자리에 무순 재배판 하나를 세운다.
   ⚠ 옛 문지기는 여기서 「가방의 콩나물 시루를 …」이라며 막았다 — 방에는 무순이 서 있는데도. */
const musun = await page.eval(`(()=>{ const S=window.__S(), fp=S.firstPlay;
  const b=fp.beansprout, p0=b.pots[0];
  const slot=p0.slotId, at=p0.at?{...p0.at}:null;
  p0.slotId=null; p0.at=null; b.slotId=null; b.at=null;      /* 콩나물은 전부 가방으로 */
  const m=(fp.crops||[]).find(s=>s&&s.kind==='musun');
  if(!m) return {ok:false, why:'무순 자리가 없다'};
  m.pots=[{ id:'crop_02_01', slotId:slot, at, ageDays:0, dliHist:[], harvested:false,
            startedOnDay:null, idleSinceDay:S.day, quality:null, meals:0, avgDli:null,
            cycle:1, harvestCount:0, harvestMeals:0, savedWon:0, overlapIndex:0 }];
  return {ok:true, slot, beanCopy:b.slotId}; })()`);
ok('I-0 콩나물은 가방 · 무순만 방에 섰다', musun.ok === true, JSON.stringify(musun));
await page.eval(`window.__errBox.clear()`, false);
const dI = await dayNow();
await clickId('next');
await until(`window.__S().day === ${dI + 1} || ${errOn}`, 30000); await clear();
const dI2 = await dayNow();
ok('I-1 ★★무순만 놓은 판도 하루가 간다', dI2 === dI + 1, `day ${dI} → ${dI2}`);
e = await errSnap();
ok('I-2 ★「콩나물 시루를 놓아 주세요」로 안 막는다', !/놓아 주세요/.test(e.text), e.text);

/* 증거 사진 — 「고쳤다」는 화면에서 본 것이어야 한다(docs/handoff/README §검사) */
if (!process.argv.includes('--no-shots')) {
  await page.eval(`window.__errBox.push('⚠ 안 됐습니다 — 고친 뒤 다시 눌러 주세요<br>가방의 시루를 먼저 방 안에 놓아 주세요')`, false);
  await sleep(500);
  try { console.log('  사진 ' + await page.shot(SHOT_DIR + 'errbox_390.png')); } catch (e) { console.log('  사진 실패 ' + e.message); }
}

console.log(`\n${bad ? '⛔' : '★'} ${seen - bad}/${seen} 통과`);
await page.close();
process.exit(bad ? 1 : 0);
