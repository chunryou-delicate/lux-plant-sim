/* ============================================================
   tools/night_play.mjs — **첫 판을 처음부터 끝까지 실제로 밟는다**
   ------------------------------------------------------------
   사용자 지시(2026-08-23 밤):
     *"실제 게임을 코어나 플랜이 처음부터 실제로 반복적으로 돌려서 이벤트나 어색한거
       찾아내는게 가능하면 그렇게해줘"* · *"튜토부분이라도 확실하게 끝내는 것으로"*

   ⇒ 이 자는 `banjiha_routes` 와 **다른 것을 잰다.** 저쪽은 엔진을 직접 부르는 재현이고,
     여기는 **game.html 을 띄워 화면의 단추를 누른다.** 그래서 대사·퀘스트·손가락 안내·
     체력·잠금처럼 **화면에만 있는 것**이 같이 걸린다.

   ══ ★★★ 이 자가 지켜야 할 것 — 「안 한 것」을 「못 한 것」으로 읽지 않기 ═══════════
   2026-08-23 에 `test_balance_routes` 가 **모주에 물을 한 번도 안 줘서** A·B·C 를 전부
   0% 로 냈다(`waterPot` 이 import 에도 없었다). 같은 판을 `banjiha_routes` 는 38·60·100%
   라고 한다. **판이 그런 것이 아니라 재는 자가 그랬다.**
   ⇒ 그래서 이 자는 **자기가 무엇을 했는지 세어서 같이 찍는다**(§did).
     물 준 횟수가 0 인데 「안 자란다」고 적으면 그 보고는 거짓말이다.
   ⇒ 그리고 **속임수를 안 쓴다.** 체력을 되돌리거나 씨앗을 꽂아 넣지 않는다 —
     그것들이 막는다면 **그게 곧 찾으려던 것**이다. (probe_cutting_ui 는 삽수 배선만
     보려고 둘 다 쓴다. 목적이 다르다.)

     python tools/serve.py 8971 .        (다른 창에서)
     node tools/night_play.mjs --seed 1 --days 400 --shots

   내는 것 — tools/_out/night/
     play_<seed>.json    한 판의 전부(날짜별 눈금 · 대사 · 오류 · 한 일)
     play_<seed>.log     사람이 읽는 요약
     shot_<seed>_*.png   자리마다 한 장
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools', '_out', 'night');
fs.mkdirSync(OUT, { recursive: true });

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d;
};
const SEED = Number(arg('seed', 1));
const DAYS = Number(arg('days', 400));
const SHOTS = !!arg('shots', false);
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';

/* ★ 자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다 */
const WD = Number(process.env.BYEOT_NIGHT_TIMEOUT_MS || 1800000);
const wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다'); process.exit(2); }, WD);
wd.unref && wd.unref();

/* ══ 한 판이 남기는 것 ═══════════════════════════════════════════════ */
const R = {
  seed: SEED, startedAt: new Date().toISOString(),
  /* ★ §did — **내가 무엇을 했나.** 이 칸이 없으면 위 ⚠ 의 병을 그대로 앓는다 */
  did: { next: 0, plant: 0, water: 0, harvest: 0, sow: 0, waterPot: 0, place: 0,
         buySeed: 0, buyLamp: 0, dlgTap: 0, sheetOpen: 0 },
  days: [],            // 날마다 한 줄
  dialog: [],          // 뜬 대사 (day, who, text)
  quests: [],          // 퀘스트가 열리고 닫힌 자리
  console: [],         // 오류·경고·예외
  shots: [],
  blocked: null,       // 막혔으면 무엇이
  ended: null          // 'movedOut' | 'dayLimit' | 'stuck' | 'bankrupt' | 'gameOver'
};
const note = (s) => { console.log(s); R.log = (R.log || []); R.log.push(s); };

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
page.on((m, p) => {
  try {
    if (m === 'Runtime.exceptionThrown')
      R.console.push({ kind: 'exception', day: R.today,
                       text: p.exceptionDetails.text + ' ' + ((p.exceptionDetails.exception || {}).description || '') });
    else if (m === 'Log.entryAdded' && (p.entry.level === 'error' || p.entry.level === 'warning'))
      R.console.push({ kind: p.entry.level, day: R.today, text: p.entry.text });
    else if (m === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'warning'))
      R.console.push({ kind: 'console.' + p.type, day: R.today,
                       text: (p.args || []).map(a => a.value ?? a.description ?? '').join(' ') });
  } catch { }
});

const ev = (expr, want = true) => page.eval(expr, want);
const click = (id) => ev(`(()=>{try{document.getElementById('${id}').click()}catch{}})()`, false);
const shownClick = async (id) => {
  const on = await ev(`(()=>{ const e=document.getElementById('${id}');
    return !!e && e.style.display !== 'none' && !e.disabled; })()`);
  if (on) { await click(id); return true; }
  return false;
};
const shot = async (tag) => {
  if (!SHOTS) return;
  const f = path.join(OUT, `shot_${SEED}_${String(R.today).padStart(3, '0')}_${tag}.png`);
  try { await page.shot(f); R.shots.push({ day: R.today, tag, file: path.basename(f) }); } catch { }
};

/* 동작(걸어가기+모션)이 끝날 때까지 — probe_cutting_ui §waitAct 와 같은 판단.
   ⚠ 하단 막대로 재면 안 된다(말풍선이 있으면 막대가 아예 안 뜬다). `acting` 이 정본이다. */
const waitAct = async (ms = 15000) => {
  const t0 = Date.now();
  const acting = () => ev(`(()=>{ try { return !!window.__byeotWalkSfx().acting; }
    catch { return document.getElementById('actBar').style.display !== 'none'; } })()`);
  for (let i = 0; i < 4; i++) { if (await acting()) break; await sleep(70); }
  while (Date.now() - t0 < ms) { if (!(await acting())) { await sleep(120); return true; } await sleep(150); }
  return false;
};

/* ★ 대사를 **읽으면서** 넘긴다 — 무엇이 떴는지가 이 자의 알맹이 중 하나다.
   ⚠ [건너뛰기]를 안 쓴다. 그건 큐를 통째로 비워서 **뜬 것을 못 보게** 한다. */
const tapTalk = async (max = 40) => {
  for (let i = 0; i < max; i++) {
    const t = await ev(`document.getElementById('stage').classList.contains('talking')`);
    if (!t) break;
    const line = await ev(`(()=>{ const w=document.getElementById('dlgWho'),
      x=document.getElementById('dlgText');
      return JSON.stringify({ who:(w&&w.textContent)||'', text:(x&&x.textContent)||'' }); })()`);
    try {
      const o = JSON.parse(line);
      const last = R.dialog[R.dialog.length - 1];
      if (o.text && !(last && last.day === R.today && last.text === o.text))
        R.dialog.push({ day: R.today, who: o.who, text: o.text });
    } catch { }
    await ev(`document.getElementById('dlgBox').click()`, false);
    R.did.dlgTap++;
    await sleep(90);
  }
};

/* 시루 줄의 단추 — `#siruList [data-act=…]`.
   ⚠ 아래 `#waterCrop`·`#harvestCrop` 은 말풍선이 같은 말을 하면 감춰진다(§markSays).
     줄 단추는 늘 거기 있으므로 이쪽을 누른다. */
const rowAct = async (act, max = 8) => {
  let n = 0;
  for (let k = 0; k < max; k++) {
    const before = R.console.length;
    const hit = await ev(`(()=>{ const b=[...document.querySelectorAll(
      '#siruList button[data-act="${act}"]')].find(x=>!x.disabled); if(!b) return false; b.click(); return true; })()`);
    if (!hit) break;
    n++; await waitAct(); await sleep(140); await tapTalk();
    /* ⚠ 던졌으면 **그 날은 그만한다.** 같은 단추를 여덟 번 누르면 오류가 여덟 줄 쌓여
       「무엇이 처음 틀렸나」가 파묻힌다(실제로 하루에 8건씩 160건이 쌓였다). */
    if (R.console.length > before) { R.did[act + 'Threw'] = (R.did[act + 'Threw'] || 0) + 1; break; }
  }
  R.did[act] = (R.did[act] || 0) + n;
  return n;
};

/* ★★★ **[다음 날]은 한 번의 누름이 아니다.**
   ------------------------------------------------------------
   눌러 보고 알았다 — `#next` 를 누르면 **밥상(`#mealPanel`)이 뜨고 거기서 「이대로 다음 날 ▸」
   (`#mealGo`)를 눌러야 날이 간다.** 월세 낸 날은 그 앞에 **한 달 가계부**(`#monthPanel`)도 선다.
   ⇒ 첫 굴림에서 날짜가 **한 번 걸러** 갔던 까닭이 이것이다. 판이 막힌 것이 아니라
     **재는 자가 하루의 절반만 밟고 있었다.**
   ⚠ 밥상은 **매일 사람이 고르는 것**이다. 기본값 그대로 [이대로 다음 날]을 누른다 —
     여기서 양을 바꾸면 그건 밸런스를 만지는 것이라 안 한다.
   ⚠ 여는 순서가 판마다 다르므로 **닫힐 때까지 몇 바퀴 돈다.** */
const clearPops = async (rounds = 6) => {
  for (let i = 0; i < rounds; i++) {
    const did = await ev(`(()=>{
      const up = (id) => { const e=document.getElementById(id);
        return !!e && e.getAttribute('aria-hidden')==='false'; };
      const hit = (id) => { const b=document.getElementById(id);
        if(!b||b.disabled) return false; b.click(); return true; };
      if (up('reliefBox')  && hit('reliefOk'))   return 'relief';
      if (up('monthPanel') && hit('monthClose')) return 'month';
      if (up('mealPanel')  && hit('mealGo'))     return 'meal';
      if (up('buyPanel')   && hit('buyCancel'))  return 'buy';
      return '';
    })()`);
    if (!did) return i;
    R.did['pop:' + did] = (R.did['pop:' + did] || 0) + 1;
    await sleep(220); await tapTalk();
  }
  return rounds;
};

/* 상점에서 **한 가지를 주문한다** — 사람이 밟는 그 길 그대로:
   [상점] 탭 → 그 줄의 [주문] → 개수 팝업의 [주문].
   ⚠ 줄이 없거나(안 열린 물건) 잠겼으면 **아무것도 안 한다.** 재고를 꽂아 넣지 않는다. */
const order = async (itemId) => {
  const hit = await ev(`(()=>{ const b=document.querySelector('#shopList [data-buy="${itemId}"]');
    if(!b || b.disabled) return false; b.click(); return true; })()`);
  if (!hit) return false;
  await sleep(200);
  const went = await ev(`(()=>{ const p=document.getElementById('buyPanel');
    if(!p || p.getAttribute('aria-hidden')==='true') return false;
    const g=document.getElementById('buyGo'); if(!g || g.disabled){
      const c=document.getElementById('buyCancel'); if(c) c.click(); return false; }
    g.click(); return true; })()`);
  await sleep(200); await tapTalk();
  return went;
};

/* ══ 상태 한 줄 — 지어내지 않는다. 못 읽으면 null 을 둔다 ══════════════ */
const SNAP = `(()=>{ const S=window.__S(); const ts=S.tutorial||{};
  let ls=null; try{ ls=window.__io.growth.leafStats(); }catch{}
  const p=(S.pots||[])[0]||null;
  const b=S.firstPlay&&S.firstPlay.beansprout||{};
  return JSON.stringify({
    day:S.day, tday:ts.day??null, cash:ts.cashWon??null,
    /* 체력 — **화면이 적은 그 값을 읽는다**(#resSta). S.stamina 를 짚었다가 늘 null 이었다.
       ⚠ 코어 함수를 여기서 새로 부르지 않는다 — 사람이 보는 숫자가 정본이다 */
    sta:(document.getElementById('resSta')||{}).textContent||null,
    pots:(S.pots||[]).length, potSlot:p?p.slotId:null, potDry:p?!!p.dry:null,
    leaves:ls?ls.leaves:null, varie:ls?ls.variegatedLeaves:null,
    sirus:b.sirus??null, harvests:b.harvestCount??null,
    fpDone:!!(S.firstPlay&&S.firstPlay.completed), movedOut:!!ts.movedOut,
    lamp:(ts.lamp&&ts.lamp.owned)??null, lampOpen:!!(ts.lamp&&ts.lamp.unlocked),
    seed:(S.shop&&S.shop.stock&&S.shop.stock.bean_seed)??null,
    bankrupt:!!ts.bankrupt,
    hardLock: document.body.dataset.hardLock||'',
    gameOver: document.getElementById('gameOver') ?
      document.getElementById('gameOver').getAttribute('aria-hidden')!=='true' : false,
    nextOff: (()=>{const n=document.getElementById('next'); return !n||n.disabled;})(),
    quest: (()=>{ try { const q=window.__quest && window.__quest(); return q?q.id||q.ko||null:null; } catch { return null; } })()
  }); })()`;
const snap = async () => { try { return JSON.parse(await ev(SNAP)); } catch (e) { return { readError: String(e.message) }; } };

/* ══════════════════════════════════════════════════════════════════
   판 굴리기
   ══════════════════════════════════════════════════════════════════ */
R.today = 0;
await page.goto(`${BASE}/game.html`);
await ev('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
try { await page.waitFor('!!window.__rv', 150000, 300); }
catch (e) { R.ended = 'bootFail'; R.blocked = '부팅이 안 됐다 — ' + e.message; finish(); }
await sleep(5000);

/* 씨앗을 고정한다 — **판을 바꾸려는 것이 아니라 같은 판을 여러 번 굴리려는 것**이다 */
await ev(`(()=>{ const S=window.__S(); if(S.sim) S.sim.seed=${SEED}; })()`, false);

await tapTalk();
await click('guideClose'); await sleep(400);
await shot('boot');

/* 시루를 어두운 자리에 놓는다 — 첫 손짓이다(가방에서 끌어다 놓기) */
await ev(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src,
    {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
await sleep(1200);
R.did.place++;

await ev(`window.__byeotSheet.open('plants')`, false); R.did.sheetOpen++; await sleep(400);

let stuckDays = 0, lastCash = null, lastLeaves = null;
for (let d = 1; d <= DAYS; d++) {
  R.today = d;
  const before = await snap();

  /* ── 오늘 할 일 ── (사람이 [식물] 탭에서 하는 순서 그대로) */
  await ev(`window.__byeotSheet.open('plants')`, false); await sleep(120);
  await rowAct('plant');
  await rowAct('water');
  await rowAct('harvest');
  await rowAct('sow');

  /* 모주 — 자리를 안 잡았으면 창턱에 놓고, 마르면 물을 준다.
     ⚠ **이 줄이 없으면 balance_routes 와 같은 병을 앓는다**(§⚠). */
  if (before.pots > 0) {
    if (!before.potSlot) {
      const ok = await ev(`(()=>{ const s=document.getElementById('slot');
        if(!s) return false; s.value='banjiha-sill:0'; s.dispatchEvent(new Event('change'));
        const b=document.getElementById('placePot'); if(b&&!b.disabled){b.click(); return true;} return false; })()`);
      if (ok) { R.did.place++; await waitAct(); await tapTalk(); }
    }
    if (await shownClick('waterPot')) { R.did.waterPot++; await waitAct(); await tapTalk(); }
  }

  /* 씨앗·시루·등 — **상점 탭에서 주문한다.**
     ⚠⚠ 2026-08-18 부터 [주문]은 **개수 팝업**을 거친다(§buyPanel). 줄 단추만 누르고 말면
       팝업이 열린 채 아무것도 안 시켜지고, 그 뒤 [다시 심기]가 매일 「먼저 주문해 주세요」로
       던진다 — **첫 판이 여기서 통째로 선다.** 실제로 첫 굴림이 그랬다(씨앗 0 · 다시심기 160번 실패). */
  if (before.seed === 0 || (before.lampOpen && before.lamp === 0)) {
    await ev(`window.__byeotSheet.open('shop')`, false); await sleep(150);
    if (before.seed === 0) { if (await order('bean_seed')) R.did.buySeed++; }
    if (before.lampOpen && before.lamp === 0) { if (await order('growlight')) R.did.buyLamp++; }
  }

  await ev(`window.__byeotSheet.close()`, false); await sleep(100);

  /* ── 다음 날 ── */
  const canNext = await ev(`(()=>{const n=document.getElementById('next'); return !!n && !n.disabled;})()`);
  if (!canNext) {
    R.blocked = `Day ${before.day} — [다음 날]이 안 눌린다(hardLock="${before.hardLock}")`;
    R.ended = 'stuck'; await shot('stuck'); break;
  }
  await click('next'); R.did.next++;
  await sleep(450); await tapTalk();
  await clearPops();            /* ★ 밥상·가계부를 지나야 비로소 날이 간다 */
  await tapTalk();

  const after = await snap();
  R.days.push({ d, ...after });

  /* 자리마다 한 장 — 도착 · 첫 무늬 · 등 · 이사 */
  if (before.pots === 0 && after.pots > 0) await shot('arrive');
  if ((before.varie || 0) === 0 && (after.varie || 0) > 0) await shot('varie');
  if (before.lamp === 0 && after.lamp > 0) await shot('lamp');
  if (d % 30 === 0) await shot('d' + d);

  /* ★★ 날짜가 안 갔으면 **그 자리에서 무엇이 열려 있었나**를 적는다.
     이 줄이 없으면 「안 간다」까지만 알고 **왜인지는 영영 모른다.** */
  if (after.day === before.day) {
    let why = null;
    try { why = JSON.parse(await ev(`(()=>{
      const open=[...document.querySelectorAll('[aria-hidden="false"]')].map(e=>e.id).filter(Boolean);
      const vis=(id)=>{const e=document.getElementById(id); if(!e) return null;
        const st=getComputedStyle(e); return (st.display!=='none'&&st.visibility!=='hidden')?id:null;};
      return JSON.stringify({ open,
        stage: document.getElementById('stage').className,
        body: document.body.className, lock: document.body.dataset.hardLock||'',
        shown: ['actBar','placeConfirm','plantActions','furnActions','coach','moveCatcher','buyPanel','monthPanel','sheetScrim']
                 .map(vis).filter(Boolean),
        nextDisabled: (()=>{const n=document.getElementById('next'); return !n||n.disabled;})(),
        acting: (()=>{ try { return !!window.__byeotWalkSfx().acting; } catch { return null; } })() }); })()`)); } catch { }
    R.days[R.days.length - 1].whyNoDay = why;
  }
  if (after.gameOver) { R.ended = 'gameOver'; await shot('gameover'); break; }
  if (after.movedOut) { R.ended = 'movedOut'; await shot('moveout'); break; }
  if (after.hardLock) {
    R.blocked = `Day ${after.day} — 판이 잠겼다(hardLock="${after.hardLock}")`;
    R.ended = 'stuck'; await shot('lock'); break;
  }
  /* 아무것도 안 움직이는 날이 이어지면 막힌 것이다 — 돈도 잎도 날짜도 */
  if (after.day === before.day) stuckDays++; else stuckDays = 0;
  if (stuckDays >= 3) {
    R.blocked = `Day ${after.day} — [다음 날]을 눌러도 날짜가 3번 안 갔다`;
    R.ended = 'stuck'; await shot('nomove'); break;
  }
  lastCash = after.cash; lastLeaves = after.leaves;
}
if (!R.ended) R.ended = 'dayLimit';

/* ★ 대사 큐 기록 — 무엇이 언제 큐에 들어갔나(game.html §__dlgLog) */
try { R.dlgLog = JSON.parse(await ev(`JSON.stringify(window.__dlgLog||[])`)); } catch { }
await shot('end');

function finish() {
  R.endedAt = new Date().toISOString();
  const last = R.days[R.days.length - 1] || {};
  const lines = [];
  lines.push(`■ 씨앗 ${SEED} — ${R.ended}${R.blocked ? ' · ' + R.blocked : ''}`);
  lines.push(`  달력 ${last.day ?? 0}일 · 튜토 ${last.tday ?? '—'}일 · 지갑 ${(last.cash ?? 0).toLocaleString()}원 · ` +
             `잎 ${last.leaves ?? '—'}장(무늬 ${last.varie ?? '—'}) · 수확 ${last.harvests ?? '—'}회 · 등 ${last.lamp ?? '—'}개`);
  lines.push(`  ★내가 한 일 — ${Object.entries(R.did).map(([k, v]) => k + ' ' + v).join(' · ')}`);
  const bad = R.console.filter(c => c.kind !== 'warning' && c.kind !== 'console.warning');
  lines.push(`  콘솔 — 오류·예외 ${bad.length}건 · 경고 ${R.console.length - bad.length}건`);
  for (const c of bad.slice(0, 15)) lines.push(`     ✘ Day ${c.day} ${c.text.slice(0, 160)}`);
  lines.push(`  대사 ${R.dialog.length}줄 · 스크린샷 ${R.shots.length}장`);
  /* ★ 같은 대사가 두 번 뜬 자리 — 「중복으로 있어」의 그 물음 */
  const seen = new Map(), dup = [];
  for (const t of R.dialog) { const k = t.text; if (seen.has(k)) dup.push({ text: k, days: [seen.get(k), t.day] }); else seen.set(k, t.day); }
  if (dup.length) { lines.push(`  ⚠ 같은 대사가 두 번 뜬 자리 ${dup.length}건`); for (const x of dup.slice(0, 8)) lines.push(`     · Day ${x.days.join('·')} 「${x.text.slice(0, 50)}」`); }
  const txt = lines.join('\n');
  fs.writeFileSync(path.join(OUT, `play_${SEED}.json`), JSON.stringify(R, null, 1), 'utf8');
  fs.writeFileSync(path.join(OUT, `play_${SEED}.log`), txt + '\n', 'utf8');
  console.log('\n' + txt);
  console.log(`\n→ ${path.relative(ROOT, path.join(OUT, `play_${SEED}.json`))}`);
}
finish();
await page.close();
clearTimeout(wd);
process.exit(R.ended === 'movedOut' ? 0 : 1);
