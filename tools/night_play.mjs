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
const OUTROOT = path.join(ROOT, 'tools', '_out', 'night');

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d;
};
const SEED = Number(arg('seed', 1));
const DAYS = Number(arg('days', 400));
const SHOTS = !!arg('shots', false);
/* ★ 해상도 축 — 사용자: *"핸드폰 화면비율별·기종별에서 다 잘되도록"*.
   같은 판을 크기만 바꿔 밟으면 「좁으면 못 누르는 자리」가 그 자리에서 난다. */
const W = Number(arg('w', 390)), H = Number(arg('h', 844));
/* ★★ **안내를 따르나 / 무시하나** — [Plan] 이 세운 경우의 수 축.
   `--play guided` (기본) 퀘스트 사슬이 시키는 대로 시루를 늘린다
   `--play minimal`         시루 하나로 버틴다 — 첫 판이 그랬고 136일에 게임오버였다
   ⚠ 값을 안 바꾼다. **사람이 무엇을 하느냐**만 바꾼다. */
const PLAY = String(arg('play', 'guided'));
const SIRU_MAX = Number(arg('sirus', 16));
const SIZE = `${W}x${H}`;
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';

/* ★ 자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다 */
const WD = Number(process.env.BYEOT_NIGHT_TIMEOUT_MS || 1800000);
const wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다'); process.exit(2); }, WD);
wd.unref && wd.unref();

/* ══ 한 판이 남기는 것 ═══════════════════════════════════════════════ */
const R = {
  seed: SEED, startedAt: new Date().toISOString(),
  /* ★ §did — **내가 무엇을 했나.** 이 칸이 없으면 위 ⚠ 의 병을 그대로 앓는다 */
  play: PLAY,
  did: { next: 0, plant: 0, water: 0, harvest: 0, sow: 0, waterPot: 0, place: 0,
         buySeed: 0, buyLamp: 0, buySiru: 0, placeSiru: 0, dlgTap: 0, sheetOpen: 0 },
  days: [],            // 날마다 한 줄
  dialog: [],          // 뜬 대사 (day, who, text)
  quests: [],          // 퀘스트가 열리고 닫힌 자리
  console: [],         // 오류·경고·예외
  shots: [],
  /* ★ 눌리지 않는 자리 — 덮임·화면 밖·너무 작음(§probeHit) */
  hit: {},
  size: `${W}x${H}`,
  blocked: null,       // 막혔으면 무엇이
  ended: null          // 'movedOut' | 'dayLimit' | 'stuck' | 'bankrupt' | 'gameOver'
};
const note = (s) => { console.log(s); R.log = (R.log || []); R.log.push(s); };

/* ★ 해상도별로 폴더를 가른다([Char] 규약) — 순번이 앞이라 **파일 이름 순서가 곧 컷 순서**다.
   크기가 섞이면 그쪽 「앞 컷과 같음」 검사가 헛걸린다. */
const OUT = path.join(OUTROOT, SIZE);
fs.mkdirSync(OUT, { recursive: true });
let shotSeq = 0;

const page = await launch({ width: W, height: H, dpr: 2, mobile: false });
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
/* ★ 순번은 **사건 순서**다 — 파일 이름 앞에 붙어 **정렬이 곧 컷 순서**가 된다([Char] 규약).
   그래야 「앞 컷과 사실상 같다(화면이 안 넘어갔나)」 검사가 그 순서로 돈다.
   자리마다 번호를 띄엄띄엄 준다 — 사이에 새 자리를 끼워 넣기 좋다. */
const SHOT_NO = { boot: 1, arrive: 10, varie: 20, lamp: 30, moveout: 80,
                  gameover: 90, stuck: 95, lock: 96, nomove: 97, end: 98 };
const shot = async (tag) => {
  if (!SHOTS) return;
  const no = SHOT_NO[tag] != null ? SHOT_NO[tag] : (40 + (++shotSeq));
  const f = path.join(OUT, `${String(no).padStart(3, '0')}_d${String(R.today).padStart(3, '0')}_${tag}.png`);
  try { await page.shot(f); R.shots.push({ day: R.today, tag, file: path.basename(f) }); } catch { }
};

/* ══ ★★★ **누르기 전에 찔러 본다** ([Char] 방식 · `document.elementFromPoint`) ══════════
   ------------------------------------------------------------
   ⚠⚠ `el.click()` 은 **덮인 단추도 그냥 누른다.** 손가락은 못 누르는데 자는 눌린다 —
     그러면 *"눌렀는데 안 됐다"* 를 **이 자가 영영 못 잡는다.**
   실제로 [Char] 이 320×568 에서 **[다음 날 ▸] 한가운데를 찌르니 대사 글자(`dlgText`)가
   잡히는 것**을 숫자로 냈다(08-22 민원 *"해상도에 따라 [다음 날] 버튼 클릭 오류"*).
   ⇒ 그래서 **누르기 전에 한 번 찌른다.** 남이 잡히면 `occluded`, 화면 밖이면 `offscreen`,
     32px 미만이면 `tiny` 로 적는다. **판정은 여기서 안 한다 — 사실만 적는다.**
   ⚠ 찔러 보고 **막혀도 그냥 누른다.** 여기서 멈추면 그 뒤가 안 보인다 —
     찾으려는 것은 「막힌 자리」지 「멈춘 자리」가 아니다. */
const probeHit = async (id) => {
  /* ⚠ **날 넘어가는 연출(`#dayAnim`)이 끝나기를 기다린다.** 그 사이에는 화면 전체가
     덮이는 것이 맞다 — 안 기다리면 「[다음 날]이 dayAnim 에 덮임」이라는 헛것이 난다.
     실제로 그렇게 났다. 안 보이는 데는 까닭이 여럿이고, 까닭을 안 가르면 전부 「가려짐」이 된다. */
  for (let i = 0; i < 25; i++) {
    const on = await ev(`(()=>{const e=document.getElementById('dayAnim');
      return !!e && e.getAttribute('aria-hidden')==='false';})()`);
    if (!on) break;
    await sleep(120);
  }
  let r = null;
  try { r = JSON.parse(await ev(`(()=>{ const e=document.getElementById(${JSON.stringify(id)});
    if(!e) return JSON.stringify({miss:true});
    const b=e.getBoundingClientRect();
    if(b.width<=0||b.height<=0) return JSON.stringify({hidden:true});
    const cx=b.left+b.width/2, cy=b.top+b.height/2;
    const off = b.right<=0||b.bottom<=0||b.left>=innerWidth||b.top>=innerHeight;
    const hit = document.elementFromPoint(cx,cy);
    const mine = !!hit && (hit===e || e.contains(hit) || hit.contains(e));
    /* ★★ **덮인 것과 「지금은 덮여 있어도 되는 것」을 가른다.**
       ⚠ 모달(밥상·가계부·주문)이 떠 있으면 그 아래가 덮이는 것이 **맞다.**
       ⚠ 대사 중에는 #stage.talking 이 pointer-events:none 을 건다([Asset] 실측) —
         **꺼진 것**이지 가려진 것이 아니다. 갈라서 안 찍으면 **정상을 버그로 잡는다.** */
    const modal = [...document.querySelectorAll('.pop')].some(p=>p.getAttribute('aria-hidden')==='false');
    const talking = document.getElementById('stage').classList.contains('talking');
    /* ★ 요소 **자신의** 상태를 본다 — 「꺼진 것」은 일부러 그런 것일 수 있다.
       game.html:839 이 대사 중에 #next 를 pointer-events:none · opacity .35 로 끈다.
       그걸 「가려짐」으로 찍으면 **고친 흔적을 병으로 잡는다.** */
    const st = getComputedStyle(e);
    const dis = !!e.disabled || st.pointerEvents === 'none' || (+st.opacity || 1) < 0.5;
    /* ★★ **시트 안인가.** 탭 다섯은 #sheet 안에 있고, 시트는 안 열리면 translateY 로
       화면 아래에 내려가 있다. 그 상태로 찌르면 **「탭이 화면 밖」이라는 헛것**이 난다 —
       닫힌 서랍 안의 물건이 안 보이는 것을 고장이라 하는 셈이다.
       ⚠ 반대로 시트가 **열려 있으면** 그 아래의 [다음 날]이 덮이는 것도 맞다. */
    const sh = document.getElementById('sheet');
    const sheetOpen = !!sh && sh.classList.contains('open');
    const inSheet = !!sh && sh.contains(e);
    return JSON.stringify({ w:Math.round(b.width), h:Math.round(b.height), off, modal, talking, dis,
      sheetOpen, inSheet,
      tiny: b.width<32||b.height<32,
      /* 태그 이름만 적으면 「BUTTON 이 덮음」이 되어 어느 단추인지 영영 모른다.
         id · class · 글자 · 가장 가까운 id 조상까지 적는다 — 찾을 수 있어야 보고가 된다. */
      occludedBy: mine?null:(hit ? ([hit.id||'', hit.className||'',
        (hit.textContent||'').trim().slice(0,18),
        (hit.closest&&hit.closest('[id]')&&hit.closest('[id]').id)||''].filter(Boolean).join(' | ')
        || hit.tagName) : null) }); })()`)); }
  catch { return null; }
  if (!r || r.miss) return r;
  /* 모달이 떠 있을 때의 덮임은 **적되 갈라 적는다** — 그건 정상일 수 있다 */
  /* ★★ 셋을 가른다 — **꺼짐 / 가려짐 / 밖으로**.
     · 꺼짐   자기가 꺼져 있다(disabled · pointer-events:none · opacity<0.5)
              ⇒ **일부러일 수 있다.** 다만 「지금 누를 때가 아니다」이므로 자도 기다려야 한다
     · 가려짐 ★ **안 꺼졌는데 남이 잡힌다** ⇒ 이게 진짜 버그다
     · 밖으로 화면 밖 — 좁은 기종에서 난다
     ⚠ 모달이 떠 있으면 그 아래가 덮이는 것이 맞다. 따로 적는다. */
  let kind = null;
  if (r.inSheet && !r.sheetOpen) kind = 'inClosedSheet';      /* 서랍이 닫혀 있다 — 정상 */
  else if (r.off) kind = 'offscreen';
  else if (r.dis) kind = r.talking ? 'offWhileTalking' : 'disabled';
  else if (r.occludedBy) kind = r.modal ? 'coveredByModal'
                             : (!r.inSheet && r.sheetOpen) ? 'coveredBySheet' : 'occluded';
  else if (r.tiny) kind = 'tiny';
  if (kind) {
    const key = `${kind}:${id}`;
    if (!R.hit[key]) R.hit[key] = { id, kind, firstDay: R.today, n: 0, by: r.occludedBy, w: r.w, h: r.h };
    R.hit[key].n++;
  }
  return r;
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
const order = async (itemId, want = 1) => {
  const hit = await ev(`(()=>{ const b=document.querySelector('#shopList [data-buy="${itemId}"]');
    if(!b || b.disabled) return false; b.click(); return true; })()`);
  if (!hit) return false;
  await sleep(200);
  /* ★ 개수를 맞춘다 — [＋]를 눌러 올린다. **돈이 모자라면 [＋]가 잠기므로 거기서 멎는다**
     (그것이 곧 「살 수 있는 만큼만 산다」다 — 돈을 만들어 내지 않는다).
     ⚠ 시루 하나에 씨앗 하나가 든다. 개수를 안 맞추면 [다시 심기]가 매일 던진다
       — 실제로 스무 날에 열다섯 번 던졌다. */
  for (let k = 1; k < want; k++) {
    const up = await ev(`(()=>{ const p=document.getElementById('buyPlus');
      if(!p || p.disabled) return false; p.click(); return true; })()`);
    if (!up) break;
    await sleep(60);
  }
  const went = await ev(`(()=>{ const p=document.getElementById('buyPanel');
    if(!p || p.getAttribute('aria-hidden')==='true') return false;
    const g=document.getElementById('buyGo'); if(!g || g.disabled){
      const c=document.getElementById('buyCancel'); if(c) c.click(); return false; }
    g.click(); return true; })()`);
  await sleep(200); await tapTalk();
  return went;
};

/* 사람이 늘 눌러야 하는 자리들 — 한 바퀴 찔러 본다.
   ⚠ [Char] 이 320×568 에서 **탭이 통째로 화면 밖**인 것을 잡았다(가방·식물·상점·방·할 일).
     가려진 것이 아니라 나가 있다 ⇒ 좁은 기종에서는 아예 못 누른다.
     그 목록을 여기 그대로 둔다 — 「눌러야 하는데 못 누른다」가 한 줄로 난다. */
/* ⚠⚠ **찌를 때를 맞춰야 한다.** 탭은 시트가 **열려야** 볼 수 있고, [다음 날]은 시트가
   **닫혀야** 볼 수 있다. 아무 때나 찌르면 「탭이 화면 밖」·「다음 날이 덮임」이 둘 다
   헛것으로 난다 — 실제로 처음에 그렇게 났다. 서랍을 닫아 놓고 안이 안 보인다고 한 셈이다. */
const OPEN_IDS  = ['tabRoom', 'tabPlants', 'tabShop', 'tabBag', 'tabQuest'];
/* ★ `btnMusic` 을 넣는다 — [Char] 이 1920 에서 「대사창에 덮인다」고 냈다.
   ⚠ 남의 측정이라 **내가 다시 잰다.** 갈래 다섯을 갈라 찍으므로 헛것이면 헛것으로 난다. */
const CLOSE_IDS = ['next', 'meChip', 'guideOpen', 'questChip', 'btnMusic'];
/* ⚠⚠ **서랍이 멈출 때까지 기다린다.** `#sheet` 는 `transform` 으로 미끄러져 오르내린다 —
   닫으라고 하고 곧바로 찌르면 **아직 덮고 있는 중**이라 「[다음 날]이 상점 줄에 덮임」이 난다.
   열 때도 마찬가지로 **탭이 아직 화면 밖**이다. 둘 다 실제로 그렇게 났다.
   ⇒ 정해진 시간을 자지 않고 **자리가 두 번 같아질 때까지** 본다(부하에 안 흔들린다). */
const settleSheet = async (wantOpen, ms = 2500) => {
  const t0 = Date.now();
  let last = null, same = 0;
  while (Date.now() - t0 < ms) {
    const r = JSON.parse(await ev(`(()=>{const s=document.getElementById('sheet');
      return JSON.stringify({ open: s.classList.contains('open'),
                              top: Math.round(s.getBoundingClientRect().top), h: innerHeight });})()`));
    /* ⚠ **자리가 두 번 같은 것만으로는 모자란다** — 미끄러지기가 아직 시작을 안 했으면
       처음 두 번이 당연히 같다. 실제로 그래서 「탭이 화면 밖」이 또 났다.
       ⇒ **목표 상태가 됐는지**를 먼저 보고, 그 다음에 자리가 멎기를 기다린다. */
    /* ★★ **클래스가 아니라 자리로 판정한다.** `.open` 은 곧바로 붙고 떨어지는데
       미끄러지기는 그 뒤에 일어난다 — 클래스만 보면 **아직 덮고 있는 중에** 통과한다.
       실제로 그래서 「[다음 날]이 상점 줄에 덮임」이 두 번이나 났다.
       ⇒ 닫힘 = 서랍이 **화면 아래로 다 내려갔다** · 열림 = **위로 다 올라왔다**. */
    const there = wantOpen ? (r.top < r.h - 40) : (r.top >= r.h - 2);
    if (r.open === wantOpen && there) { if (last === r.top && ++same >= 1) return r.top; last = r.top; }
    else { last = null; same = 0; }
    await sleep(90);
  }
  return last;
};
const sweepHits = async () => {
  const was = await ev(`(()=>{const s=document.getElementById('sheet');
    return !!s && s.classList.contains('open');})()`);
  await ev(`window.__byeotSheet.close()`, false); await settleSheet(false);
  for (const id of CLOSE_IDS) await probeHit(id);
  await ev(`window.__byeotSheet.open('plants')`, false); await settleSheet(true);
  for (const id of OPEN_IDS) await probeHit(id);
  if (!was) { await ev(`window.__byeotSheet.close()`, false); await settleSheet(false); }
};

/* 시루 하나를 방에 끌어다 놓는다 — 사람이 [가방]에서 끌어 내리는 그 손짓이다.
   ⚠ 자리는 **빈 자리 중에서** 고른다. 이미 뭐가 있는 자리에 겹쳐 놓지 않는다. */
const placeOneSiru = async () => {
  const slot = await ev(`(()=>{ const S=window.__S();
    const taken = new Set();
    for (const p of (S.pots||[])) if (p.slotId) taken.add(p.slotId);
    const b=(S.firstPlay&&S.firstPlay.beansprout)||{};
    for (const p of (b.pots||[])) if (p && p.slotId) taken.add(p.slotId);
    const free=(window.__io.light.room.slots||[]).map(x=>x.slotId).filter(id=>!taken.has(id));
    return free[0]||''; })()`);
  if (!slot) return false;
  const ok = await ev(`(()=>{ const rv=window.__rv;
    const c=document.getElementById('roomCanvas').getBoundingClientRect();
    let sp=null; try { sp=rv.screenPosOf(${JSON.stringify(slot)}); } catch { return false; }
    if(!sp) return false;
    const th=document.getElementById('cropThumb');
    window.__drag.begin('beansprout', th?th.src:'', {clientX:c.left+c.width*0.9, clientY:c.top+40});
    window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y});
    window.__drag.end(); return true; })()`);
  if (ok) { R.did.placeSiru++; await sleep(600); await tapTalk(); }
  return ok;
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
await sweepHits();                 /* ★ 첫 화면에서 한 바퀴 — 좁은 기종은 여기서 이미 난다 */
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
  /* ★★ **안내를 따르는 판은 시루를 늘린다**(§PLAY). 본 퀘스트 사슬이 5 → 8 → 16 을 시킨다.
     첫 굴림은 하나로 버티다 136일에 게임오버였는데, 그건 **판이 그런 게 아니라 안 늘린 것**이다
     ([Plan] 실측 「시루 1개 → 126일 파산」과 겹친다). 늘리는 판이 진짜 답이다.
     ⚠ 살 수 있을 때만 산다 — 돈을 만들어 내지 않는다. 자리가 없으면 안 산다. */
  /* ★★ **퀘스트가 지금 시키는 수**를 읽는다 — 「안내를 그대로 따른다」는 그런 뜻이다.
     ⚠ 목표를 처음부터 16 으로 두면 **사람이 안 하는 짓**이 된다: 스무 날에 지갑
       1,500,000 → 5,000 원이 됐다. 퀘스트는 5 → 8 → 16 으로 **차례로** 연다.
     ⚠ 하루에 하나씩만 산다. 한꺼번에 사면 그것도 사람이 아니다.
     ⚠ 못 읽으면 1 로 둔다 — 모르면 안 늘리는 쪽이 덜 해롭다(지어내지 않는다). */
  let wantSiru = 1;
  if (PLAY === 'guided') {
    try {
      const n = await ev(`(()=>{ try { const v=window.__questView();
        let m=0; for (const q of (v&&v.all)||[]) {
          if (q.state === 'locked') continue;              /* 아직 안 열린 줄은 안 따른다 */
          const k = q.need && q.need.sirus;
          if (Number.isInteger(k)) m = Math.max(m, k); }
        return m; } catch { return 0; } })()`);
      if (Number.isInteger(n) && n > 0) wantSiru = Math.min(n, SIRU_MAX);
    } catch { }
  }
  const needSiru = (before.sirus || 0) < wantSiru;
  /* 씨앗은 **시루 수만큼** 있어야 한 바퀴가 돈다 — 0 일 때만 사면 늘 모자란다 */
  const needSeed = (before.seed || 0) < (before.sirus || 1);
  if (needSeed || needSiru || (before.lampOpen && before.lamp === 0)) {
    await ev(`window.__byeotSheet.open('shop')`, false); await sleep(150);
    if (needSiru) { if (await order('siru', 1)) R.did.buySiru++; }   /* 하루에 하나씩 */
    if (needSeed) { if (await order('bean_seed', Math.max(1, (before.sirus || 1) - (before.seed || 0)))) R.did.buySeed++; }
    if (before.lampOpen && before.lamp === 0) { if (await order('growlight')) R.did.buyLamp++; }
  }
  /* 산 시루는 **가방에 온다.** 끌어다 놓아야 쓴다 — 안 놓으면 영영 가방에 남는다 */
  /* ⚠ **놓을 시루가 있을 때만 놓는다.** 없는데 끌면 손짓만 나가고 아무 일도 안 난다 —
     실측으로 마흔 날에 **120번**이 그렇게 헛돌았다(시간만 먹는다). */
  if (PLAY === 'guided') {
    for (let k = 0; k < 3; k++) {
      const have = await ev(`(()=>{ const S=window.__S();
        const b=(S.firstPlay&&S.firstPlay.beansprout)||{};
        const loose=((b.pots||[]).filter(p=>p&&!p.slotId).length)
                  + ((S.shop&&S.shop.stock&&S.shop.stock.siru)||0);
        return loose > 0; })()`);
      if (!have) break;
      if (!(await placeOneSiru())) break;
    }
  }

  await ev(`window.__byeotSheet.close()`, false); await settleSheet(false);

  /* ── 다음 날 ── */
  let canNext = await ev(`(()=>{const n=document.getElementById('next'); return !!n && !n.disabled;})()`);
  if (!canNext) {
    /* ⚠ **곧바로 「막혔다」고 하지 않는다.** 사람은 한 번 더 해 본다 —
       놓는 중이면 취소하고, 팝업이 떠 있으면 닫고, 대사가 있으면 넘긴다.
       그러고도 안 되면 그때가 진짜 막힌 것이다. */
    await ev(`(()=>{const b=document.getElementById('placeCancel'); if(b) b.click();})()`, false);
    await clearPops(); await tapTalk(); await sleep(400);
    canNext = await ev(`(()=>{const n=document.getElementById('next'); return !!n && !n.disabled;})()`);
  }
  if (!canNext) {
    let why = null;
    try { why = await ev(`(()=>{ const open=[...document.querySelectorAll('[aria-hidden="false"]')]
      .map(e=>e.id).filter(Boolean);
      return JSON.stringify({ open, stage:document.getElementById('stage').className,
        lock:document.body.dataset.hardLock||'' }); })()`); } catch { }
    R.blocked = `Day ${before.day} — [다음 날]이 안 눌린다 · ${why}`;
    R.ended = 'stuck'; await shot('stuck'); break;
  }
  await probeHit('next');            /* ★ 누르기 전에 찔러 본다(§probeHit) — 시트는 바로 위에서 닫았다 */
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
  /* ⚠ **성기게라도 남긴다**([Char]): 사건 자리는 **무엇이 일어날지 아는 곳**이라
     거기만 찍으면 **모르는 것은 영영 안 보인다.** 긴 판에서만 드러나는 것이 있다 —
     소지금 자릿수가 칸을 넘거나, 날짜가 세 자리가 되며 줄이 밀리거나, 목록이 길어져 넘치거나.
     ⚠ 찔러 보기(§sweepHits)는 서른 날마다 그대로 — 그건 그림이 아니라 판정이라 싸다. */
  if (d % 30 === 0) await sweepHits();
  if (d === 60 || d === 150 || d === 270 || d === 390) await shot('d' + d);
  /* 가진 것은 남긴다 — 긴 판이 중간에 죽으면 서른 몇 분이 통째로 사라진다.
     열흘마다 지금까지 것을 써 둔다. 끝에 다시 쓰므로 손해가 없다. */
  if (d % 10 === 0) { try { dump(); } catch { } }

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

/* 지금까지 것을 파일에 쏟는다 — 중간에도, 끝에도 부른다 */
function dump() {
  fs.writeFileSync(path.join(OUT, `play_${SEED}.json`), JSON.stringify(R, null, 1), 'utf8');
}

function finish() {
  R.endedAt = new Date().toISOString();
  const last = R.days[R.days.length - 1] || {};
  const lines = [];
  lines.push(`■ 씨앗 ${SEED} · ${PLAY} — ${R.ended}${R.blocked ? ' · ' + R.blocked : ''}`);
  lines.push(`  달력 ${last.day ?? 0}일 · 튜토 ${last.tday ?? '—'}일 · 지갑 ${(last.cash ?? 0).toLocaleString()}원 · ` +
             `잎 ${last.leaves ?? '—'}장(무늬 ${last.varie ?? '—'}) · 수확 ${last.harvests ?? '—'}회 · 등 ${last.lamp ?? '—'}개`);
  lines.push(`  ★내가 한 일 — ${Object.entries(R.did).map(([k, v]) => k + ' ' + v).join(' · ')}`);
  const bad = R.console.filter(c => c.kind !== 'warning' && c.kind !== 'console.warning');
  lines.push(`  콘솔 — 오류·예외 ${bad.length}건 · 경고 ${R.console.length - bad.length}건`);
  for (const c of bad.slice(0, 15)) lines.push(`     ✘ Day ${c.day} ${c.text.slice(0, 160)}`);
  lines.push(`  대사 ${R.dialog.length}줄 · 스크린샷 ${R.shots.length}장 · 화면 ${SIZE}`);
  /* ★ 「진짜 못 누르는 것」과 「지금은 덮여 있어도 되는 것」을 갈라 적는다 */
  const REAL = ['offscreen', 'occluded', 'tiny'];
  const hits = Object.values(R.hit);
  const noTouch = hits.filter(h => REAL.includes(h.kind));
  const okish = hits.filter(h => !REAL.includes(h.kind));
  if (noTouch.length) {
    lines.push(`  ★⚠ 손가락이 못 닿는 자리 ${noTouch.length}가지 —`);
    for (const h of noTouch) lines.push(`     · ${h.kind} ${h.id} ${h.w}x${h.h}` +
      (h.kind === 'occluded' && h.by ? ` ← ${String(h.by).slice(0, 40)} 가 덮음` : '') +
      ` (Day ${h.firstDay} 부터 ${h.n}번)`);
  } else lines.push('  손가락이 못 닿는 자리 — 없음(찔러 본 것 중에서)');
  if (okish.length)
    lines.push('  (참고 · 덮여 있어도 되는 때 — ' +
      okish.map(h => `${h.id}:${h.kind}×${h.n}`).join(' · ') + ')');
  /* ★ 같은 대사가 두 번 뜬 자리 — 「중복으로 있어」의 그 물음 */
  const seen = new Map(), dup = [];
  for (const t of R.dialog) { const k = t.text; if (seen.has(k)) dup.push({ text: k, days: [seen.get(k), t.day] }); else seen.set(k, t.day); }
  if (dup.length) { lines.push(`  ⚠ 같은 대사가 두 번 뜬 자리 ${dup.length}건`); for (const x of dup.slice(0, 8)) lines.push(`     · Day ${x.days.join('·')} 「${x.text.slice(0, 50)}」`); }
  const txt = lines.join('\n');
  dump();
  fs.writeFileSync(path.join(OUT, `play_${SEED}.log`), txt + '\n', 'utf8');
  console.log('\n' + txt);
  console.log(`\n→ ${path.relative(ROOT, path.join(OUT, `play_${SEED}.json`))}`);
}
finish();
await page.close();
clearTimeout(wd);
process.exit(R.ended === 'movedOut' ? 0 : 1);
