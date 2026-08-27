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
/* ★★ [Char] 이 재는 부분만 떼어 내보내 줬다(`bb918c4`) — **한 벌을 같이 쓴다.**
   ⚠ `shootAll.open()` 은 **안 쓴다.** 그건 제 페이지를 따로 띄우는데, 그러면
     진행은 내 페이지에서 돌고 그림은 남의 페이지에서 찍혀 **같은 순간이 아니게 된다.**
   ⇒ `settle`(움직임이 멎기를 기다림) 과 `saveSidecar`(곁파일) 만 가져다 **내 페이지로** 부른다. */
import { settle as settleAnim, saveSidecar } from './shoot_screens.mjs';

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
/* ══════════════════════════════════════════════════════════════════════════
   ★★★ **게으름** — `--lazy 0.2` (2026-08-24 · [Plan] 계율 ㊵)
   --------------------------------------------------------------------------
   지금까지 낸 숫자는 **전부 「완벽한 사람」 하나**다:
     매일 빠짐없이 물을 주고 · 열여섯을 어긋나게 돌리고 · 한 번도 안 잊고 ·
     거둔 날 그날 다시 심는다. ⇒ **사람이 그러지 않는다.**
   ⇒ ★ 그래서 「자의 실패」만 고쳐 왔는데(오늘 네 번), **「자의 성공」은 아무도 안 봤다** —
     ***사람은 «못 할 짓»을 해서 성공했을 수 있다.***
   ⇒ ⇒ **실패는 눈에 띄어 고치는데, 성공은 안 고친다.**

   ★ 그래서 **값**으로 둔다(0/1 이 아니다) — 「얼마나 게을러야 못 닿나」를 재려는 것이다.
     `--lazy 0`   지금까지의 판 = **위쪽 한계**(완벽한 사람). ⛔ 지우지 않는다
     `--lazy 0.2` 다섯 번에 한 번 거른다
   ⚠ **씨앗과 날짜로 정한다 — 굴리지 않는다.** 같은 씨앗·같은 게으름이면 **같은 판**이라야
     둘을 견줄 수 있다. `Math.random` 을 쓰면 판마다 달라 비교가 안 된다.
   ⚠ 이것은 **밸런스 값이 아니라 자의 손버릇**이다. 판의 규칙은 한 톨도 안 건드린다.

   ══ ★ **벌이 무엇인가 — 코드로 읽었다**(굴리기 전에 알아야 결과를 읽는다) ═════════════
     `first_play.js:2241`  `needsWater: placed && sown && !harvested && startedOnDay == null`
     ⇒ ★ **물주기는 「회전 시작」 한 번뿐이다.** 매일 주는 것이 아니다.
     ⇒ ⇒ 그러니 **거르면 「그 시루의 회전이 하루 늦게 시작」**된다.
       · 늦어진다 ✅ — 수확이 밀리고 그만큼 **수입이 준다**
       · 죽는다   ✖ — 시루는 안 죽는다(삽수와 다르다)
       · 공짜다   ✖ — **아니다.** 그래서 이 실험이 뜻을 갖는다
     ⇒ 「다시 심기」를 거르는 것도 같다 — 다음 회전이 하루 밀린다.

   ══ ⚠⚠ **이 자가 못 재는 것 — 셋. 적어 둔다** ═══════════════════════════════════
     ㉠ 이 게으름은 **긴 눈으로는 고르다** — 재 보니 400일에 21.0%(`--lazy 0.2` · 씨앗 1).
        ⚠ 다만 **짧은 구간에서는 뭉친다** — 같은 판의 첫 열나흘이 `01011110000000` 이었다
          (d4~d7 넉 줄 연속). 해시가 그런 것이지 **일부러 만든 것이 아니다.**
        ★ 그래서 **「사람은 몰아서 빼먹는다」를 어느 정도는 흉내 낸다.** 다만 **그건 우연이고,
          「바쁜 주」처럼 «까닭이 있는 뭉침»은 아니다.** 그 차이를 재고 싶으면 따로 만들어야 한다.
     ㉡ ★ **어긋내기를 안 잰다.**
        ⚠ 「물을 거르면 저절로 어긋난다」로 적으면 **장점처럼 읽힌다. 그게 아니다** —
          어긋냄   = **고르게** 벌리기 → 최저점을 **올린다**
          흐트러짐 = 무작위           → ★ 최저점을 **내릴 수도** 있다
        ⇒ ★★ 어긋내기는 **총수입을 안 바꾸고 「수입의 고름」을 바꾼다.** 그리고 고름은
          **파산 시점**에 걸린다 — 몰아서 들어오면 그 사이에 0원이 된다.
          ⇒ 그 값어치는 **평균이 아니라 최저점**에서 난다. **이 자는 그걸 안 잰다.**
     ㉢ ★ **「할 줄 알고 게으르지도 않은데 신경을 못 쓰는」 사람**을 안 잰다.
        어긋내기는 **달력을 머릿속에 들고 있어야** 하는 일이다. 퀘스트도 대사도 그것을
        가르치지만(quest.js:394 · dialogue.js:640), **아는 것과 해내는 것은 다르다.**
     ⇒ ⛔ 셋 다 **안 잰다.** 「사람을 다 쟀다」로 읽지 마라.
   ══════════════════════════════════════════════════════════════════════════ */
const LAZY = Math.max(0, Math.min(1, Number(arg('lazy', 0)) || 0));
/* 씨앗·날·무슨 일 → 0~1. 같은 셋이면 늘 같은 값이다(굴림이 아니다) */
const lazyRoll = (day, tag) => {
  let h = 2166136261 ^ SEED;
  const str = day + ':' + tag;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
};
/* 오늘 이 일을 «거를까». 게으름이 0 이면 절대 안 거른다 */
const beLazy = (tag) => {
  if (LAZY <= 0) return false;
  const skip = lazyRoll(R.today, tag) < LAZY;
  /* ★ 거른 날을 **그대로 남긴다** — 나중에 「왜 이 판이 느렸나」를 되짚을 유일한 근거다 */
  if (skip) { R.did['lazy:' + tag] = (R.did['lazy:' + tag] || 0) + 1;
              (R.lazyDays = R.lazyDays || []).push({ day: R.today, tag }); }
  return skip;
};
const SIRU_MAX = Number(arg('sirus', 16));
/* ★★ **튜토를 «끝까지» 밟는 손** (2026-08-24 · 박사님 설계)
   튜토 끝 = 「무늬 조건(잎3 하프문)」 + 「지갑 2,000,000」이고, 그 돈을 «어떻게 모으든» 된다.
     ⓐ pot   그루째 중고에 내놓고 연락이 오면 판다
     ⓒ crop  아무것도 안 팔고 채소로만 모은다(지금까지의 판이 이것이다)
   ⚠ ⓑ(삽수 일부만)는 **아직 안 붙인다** — 무엇을 자를지가 정해져야 한다.
   ⛔ 값은 하나도 안 건드린다. 화면에 있는 단추를 «사람처럼 누를» 뿐이다. */
const ENDING = String(arg('ending', 'crop'));
/* 이사비 — **규칙에서 읽는다.** 자에 수를 안 박는다(오늘만 세 번 낡은 수에 데었다). */
const MOVE_WON = (await import('../src/game/tutorial.js')).TUTORIAL_RULES.moveOutCostWon;
const SIZE = `${W}x${H}`;
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';

/* ★ 자가 제한 — 재는 도구가 재는 대상보다 오래 살면 안 된다 */
const WD = Number(process.env.BYEOT_NIGHT_TIMEOUT_MS || 1800000);
/* ⚠⚠⚠ **자가 제한에 걸리면 «적어 둔 것까지 잃는다»** (2026-08-23 실측)
   팔기를 붙인 판이 d100 에서 이 줄에 걸렸는데, `process.exit(2)` 가 곧바로 나가는 바람에
   **마지막 갈무리(`finish`)가 안 돌았다.** 남은 것은 열흘마다 떨구는 중간 파일뿐이었고,
   `.log` 은 «어젯밤 것이 그대로» 남아 있어서 하마터면 **다른 판의 기록을 이 판 것으로
   읽을 뻔했다**(실제로 한 번 그렇게 읽었다).
   ⇒ ★ 그래서 **나가기 전에 갈무리를 부른다.** `finish` 는 아래에서 정의되므로 창구를 하나 둔다. */
let onWatchdog = null;
const wd = setTimeout(() => {
  console.error('⏱ 자가 제한을 넘겨 멈춥니다 — 여기까지를 갈무리합니다');
  if (typeof onWatchdog === 'function') { try { onWatchdog('timeout'); } catch (e) { console.error(e.message); } }
  process.exit(2);
}, WD);
wd.unref && wd.unref();

/* ══ 한 판이 남기는 것 ═══════════════════════════════════════════════ */
const R = {
  seed: SEED, startedAt: new Date().toISOString(),
  /* ★ §did — **내가 무엇을 했나.** 이 칸이 없으면 위 ⚠ 의 병을 그대로 앓는다 */
  play: PLAY, lazy: LAZY,
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
  /* ★ 찍기 전에 **움직임이 멎기를 기다린다** — 연출 중에 찍으면 그림도 판정도 헛것이 된다.
     `getAnimations()` 가 없는 브라우저면 0 을 돌려주므로 그냥 안 기다린다(안전하다). */
  try { await settleAnim(page); } catch { }
  try {
    await page.shot(f);
    R.shots.push({ day: R.today, tag, file: path.basename(f) });
    /* 곁파일 — 그 순간의 `ready·talking·occluded·disabledOff·errorLines…` 를 같은 이름 .json 으로.
       ⚠ 그림만 남기면 「왜 이상한가」를 사람이 눈으로 다시 찾아야 한다. */
    try { await saveSidecar(page, f, { day: R.today, seed: SEED, tag, play: PLAY }); } catch { }
  } catch { }
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
   ⚠⚠ **2026-08-23 정정 — 여기 있던 말이 틀렸다.** 있던 말:
     *"기본값 그대로 [이대로 다음 날]을 누른다 — 여기서 양을 바꾸면 그건 밸런스를 만지는 것이라 안 한다."*
   ⇒ ⛔ **밥상에서 [최대]를 누르는 것은 밸런스를 만지는 것이 아니다.** 그건 «사람의 손»이다.
     밸런스는 확률·배수·«값»이고, 이건 게임이 사람에게 내주는 «고르개»다. 둘을 내가 안 갈랐다.
   ★ 그 탓에 이 하네스는 **곳간에 콩나물이 쌓여 있는데 매일 밥을 사 먹었다** —
     `mealCostWon 2,500 × 2끼 = 하루 5,000원`. 138일이면 **69만 원**이다.
     그러고서 「열여섯 개를 돌려도 적자」라고 말할 뻔했다.
   ⇒ ★ 이제 **[최대](`#mealAll`)를 먼저 누르고** [이대로 다음 날]을 누른다.
   ⚠⚠⚠ **2026-08-23 다시 정정 — 이 흠은 «없었다».** 붙여 놓고 굴려 보니
     `pop:mealmax` 가 **0회**다. 까닭은 `game.html:9860` —
       `$('mealAll').disabled = ms.grams >= ms.maxGrams`
     ⇒ ★ **밥상은 기본값이 이미 「최대」다.** 곳간은 처음부터 다 쓰이고 있었다.
       씨앗 9(30일)에서 하루 빠지는 돈이 d10~15 −9,273 → d25~30 −4,587 로 «줄었다» —
       시루가 늘자 곳간이 밥값을 덮은 것이다.
   ⇒ ⇒ ⛔ **그러니 「곳간에 쌓였는데 밥을 사 먹었다」는 내 말이 틀렸다.** 총괄에게 그대로 냈다.
     실제 흠은 **㉮ 하나**였다 — 「안 팔았다」. 아래 `sellSurplus` 가 그것이다.
   ★ 그래도 이 줄을 «안 지운다» — 상한을 손으로 낮추는 날 이 자리가 그대로 살아나고,
     무엇보다 **「눌러 봤더니 잠겨 있더라」가 여기 적혀 있어야** 다음 사람이 또 안 헤맨다.
   ⚠ 여는 순서가 판마다 다르므로 **닫힐 때까지 몇 바퀴 돈다.** */
/* ══ ⚠⚠⚠ **판 이름에 「무엇을 한 판인지」를 넣는다** (2026-08-23) ═══════════════
   여태 이름이 `play_<씨앗>.json` 뿐이었다. 그래서 **팔기를 붙인 판을 씨앗 1 로 던졌더니
   어젯밤 씨앗 1 의 140일 기록을 «말없이 덮어썼다».** `tools/_out` 은 .gitignore 라 되돌릴
   데도 없었다(다행히 씨앗 2·3 이 같은 판이라 밑값은 남았다).
   ⇒ ★ 이제 **한 일이 이름에 남는다** — `--tag` 를 주면 그것이, 안 주면 손버릇이 붙는다.
   ⚠ 「덮어쓰기 전에 물어본다」로 안 푼다 — 밤새 도는 자에게 물음은 곧 멈춤이다. */
const TAG = String(arg('tag', '') || '') ||
            '';
const STEM = `play_${SEED}${LAZY > 0 ? '_lazy' + LAZY : ''}${TAG ? '_' + TAG : ''}`;

const clearPops = async (rounds = 6) => {
  for (let i = 0; i < rounds; i++) {
    const did = await ev(`(()=>{
      const up = (id) => { const e=document.getElementById(id);
        return !!e && e.getAttribute('aria-hidden')==='false'; };
      const hit = (id) => { const b=document.getElementById(id);
        if(!b||b.disabled) return false; b.click(); return true; };
      if (up('reliefBox')  && hit('reliefOk'))   return 'relief';
      if (up('monthPanel') && hit('monthClose')) return 'month';
      if (up('mealPanel')) {
        /* ★★ **한 상에 두 가지를 올린다.** 밥상에 갈래가 둘 이상 뜨면(작물이 둘일 때만 뜬다)
           갈래마다 [＋]를 눌러 조금씩 담는다 — 그래야 crop_mix(한 상에 두 가지)가 닫히고
           그 뒤 사슬(siru5_cycle5 → siru8 → siru16)이 열린다.
           ⚠ 기본값만 누르면 **한 가지만 담긴다.** 그것이 이 하네스가 사슬을 못 열던 까닭이다.
           ⚠ 양을 정하지 않는다 — [＋]가 잠기면 거기서 멎는다. */
        const plus = [...document.querySelectorAll('[data-mealkind-plus]')].filter(b2=>!b2.disabled);
        if (plus.length >= 2) { for (const b2 of plus) b2.click(); return 'mealkind'; }
        /* ★ **[최대]로 곳간을 먹는다** — 하루에 한 번만이다(누른 날을 창에 적어 둔다).
           ⚠ 하루에 두 번 이상 누르면 이 고리가 안 끝난다. */
        const dayNow = (window.__S && window.__S().sim && window.__S().sim.day) || -1;
        if (window.__nightMealAllDay !== dayNow && hit('mealAll')) {
          window.__nightMealAllDay = dayNow; return 'mealmax';
        }
        if (hit('mealGo')) return 'meal';
      }
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

/* ══ ★★★ **거둔 것을 돈으로 바꾼다** (2026-08-23) ═══════════════════════════════
   ------------------------------------------------------------
   ⚠⚠ **오늘 찾은 것 중 제일 큰 흠이다.** 이 하네스는 140일 동안 시루 17개를 돌리고도
     `#sellPantry`(「보유 채소 팔기」)를 **한 번도 안 눌렀다.** did 에 `sell` 항목 자체가 없었다.
     ⇒ 그래서 「d91~d140 에 지갑이 오른 날이 0일」이 났고, 하마터면
       **「열여섯 개를 돌려도 적자」**라고 말할 뻔했다. 판이 아니라 **손이 없던 것**이다.

   ★ 순서가 중요하다 — **먹는 쪽이 파는 쪽보다 1.5배 낫다.**
     먹으면 (3,500 − 500) / 5일 = 600원/일 · 팔면 (3,500×0.7 − 500) / 5일 = 390원/일
     ⇒ ★ 그러니 **끼니를 먼저 채우고(`#mealAll`) 남는 것만 판다.** 반대로 하면
       「팔아서 밥이 없어 사 먹는」 사람이 된다 — 아무도 그렇게 안 논다.

   ★ 얼마를 남기나 — **이레치 밥값(2,500×2×7 = 35,000원어치 ≈ 10판)**을 두고 나머지를 판다.
     ⚠ 이것은 **밸런스 값이 아니라 손버릇**이다. 게임 값은 한 글자도 안 건드린다.
     ⚠ 곳간에 상한이 없고(`pantryCapWon` 이 `pantryCapEnabled` 없이는 Infinity) 질림도
       걷혔으니(`cropOverlapTiredIndex` 가 0) **쟁여도 안 상한다** — 그래도 팔아 두는 까닭은
       월세가 서른 날마다 한 번에 20만 원씩 오기 때문이다.
   ══════════════════════════════════════════════════════════════════════════ */
const KEEP_LOTS = 10;                    /* 남겨 둘 판 수 — 이레치 밥값 */
const sellSurplus = async () => {
  const was = await ev(`(()=>{const s=document.getElementById('sheet');
    return s.classList.contains('open');})()`) === 'true' || false;
  await ev(`window.__byeotSheet.open('shop')`, false); await settleSheet(true);
  /* ① 「보유 채소 팔기」가 잠겨 있으면 팔 것이 없다 — 아무것도 안 한다 */
  const opened = await ev(`(()=>{ const b=document.getElementById('sellPantry');
    if(!b || b.disabled) return false; b.click(); return true; })()`);
  let sold = 0;
  if (opened) {
    await sleep(220);
    /* ② [최대]로 올린 뒤 남길 만큼 [−] 로 내린다 — 사람이 밟는 그 길이다 */
    await ev(`(()=>{const a=document.getElementById('pantryAll'); if(a&&!a.disabled) a.click();})()`, false);
    await sleep(120);
    for (let k = 0; k < KEEP_LOTS; k++) {
      const down = await ev(`(()=>{const m=document.getElementById('pantryMinus');
        if(!m || m.disabled) return false; m.click(); return true; })()`);
      if (!down) break;
      await sleep(40);
    }
    /* ③ 판다 — [이 값에 팔기]가 잠겨 있으면(0판이면) 물러난다 */
    const went = await ev(`(()=>{const g=document.getElementById('pantryGo');
      if(!g || g.disabled) return false; g.click(); return true; })()`);
    if (went) { sold = 1; R.did.sellPantry = (R.did.sellPantry || 0) + 1; }
    else await ev(`(()=>{const c=document.getElementById('pantryCancel'); if(c) c.click();})()`, false);
    await sleep(200); await tapTalk();
  }
  if (!was) { await ev(`window.__byeotSheet.close()`, false); await settleSheet(false); }
  return sold;
};

/* ══ ★★★ **그루째 내놓고 · 연락 오면 팔고 · 이사한다** (2026-08-24) ═══════════
   ------------------------------------------------------------
   ⚠ 「판다」가 한 번의 누름이 아니다. 눌러 보고 알았다:
     ① `#sellPlant` 「몬스테라 내놓기」 → **중고 거래에 «올린다»**(`askListPot`)
        ⚠ `confirmOnce` 라 **두 번 눌러야** 한다(첫 번째는 「내놓습니까?」로 바뀔 뿐이다)
     ② 며칠 뒤 연락이 온다 (`MARKET_CONTACT_DAYS` 1~7일 · 랜덤)
     ③ `#marketList [data-deal]` 「거래하기」를 눌러야 **비로소 돈이 들어온다**
     ④ 그러고 `#moveOut` 「원룸으로 이사」가 열린다
   ⇒ ★ 넷 중 하나만 빠져도 「팔았는데 돈이 없다」가 된다. 어제 그 꼴을 두 번 봤다. */
/* ⚠⚠⚠ **너무 «일찍» 팔면 판이 끝난다** (2026-08-24 실측)
   ------------------------------------------------------------
   처음엔 「팔 수 있으면 곧바로」로 짰다. 그랬더니 이렇게 됐다:
```
     d37  잎 2장(무지1+산반1)에서 「몬스테라 내놓기 «(518,000원)»」이 열렸다
     d38  팔았다 ⇒ 지갑 795,766 → 1,300,666 · ★ 화분수 «0»
     ⇒ ⛔ 그루가 사라졌다. 이사비 2,000,000 은 «영영» 못 채운다. 되돌릴 수 없다
```
   ⇒ ★★ 이건 «두 가지»다. ㉠ 내 손버릇이 틀렸고 ㉡ 게임에 «막다른 길»이 있다.
     ㉠ 사람은 「팔 수 있으니 판다」로 안 논다 — **「팔면 나갈 수 있을 때」 판다.**
     ㉡ 그런데 게임은 **잎 2장에서 그 문을 연다**(`MARKET_MIN_LEAVES = 2`).
        박사님이 삽수에서 막으려 하신 함정의 **더 큰 얼굴**이다 — 삽수는 잎 하나를 잃고,
        그루째는 **판을 잃는다.**
   ⇒ ★ 그래서 이 손은 **「팔면 이사비에 닿는가」를 먼저 본다.** 안 닿으면 «안 판다».
   ⚠ 값을 안 박는다 — 이사비는 화면(`#moveOut` 언저리)이 아니라 규칙에서 오므로
     **「팔고 나서 이사가 열리는가」로 판정할 수 없다**(팔면 되돌릴 수 없다).
     ⇒ 단추 글자에 적힌 값과 지금 지갑을 더해 본다. 사람이 하는 것과 같은 셈이다. */
const potWorthNow = async () => {
  const t = await ev(`(()=>{ const b=document.getElementById('sellPlant');
    return b ? (b.textContent||'') : ''; })()`);
  const m = String(t).replace(/,/g, '').match(/(\d{4,})/);
  return m ? Number(m[1]) : null;
};
const listPot = async () => {
  const was = await ev(`(()=>{const s=document.getElementById('sheet');return s.classList.contains('open')?'1':'';})()`);
  await ev(`window.__byeotSheet.open('shop')`, false); await settleSheet(true);
  /* ⚠ 두 번 누른다 — confirmOnce 는 첫 누름에 «묻기»만 한다 */
  const done = await ev(`(()=>{ const b=document.getElementById('sellPlant');
    if(!b || b.disabled) return false; b.click(); b.click(); return true; })()`);
  if (done) R.did.listPot = (R.did.listPot || 0) + 1;
  await sleep(300); await tapTalk();
  if (!was) { await ev(`window.__byeotSheet.close()`, false); await settleSheet(false); }
  return done;
};
const takeDeal = async () => {
  const was = await ev(`(()=>{const s=document.getElementById('sheet');return s.classList.contains('open')?'1':'';})()`);
  await ev(`window.__byeotSheet.open('shop')`, false); await settleSheet(true);
  const hit = await ev(`(()=>{ const b=document.querySelector('#marketList [data-deal]');
    if(!b || b.disabled) return false; b.click(); return true; })()`);
  if (hit) R.did.deal = (R.did.deal || 0) + 1;
  await sleep(400); await tapTalk(); await clearPops();
  if (!was) { await ev(`window.__byeotSheet.close()`, false); await settleSheet(false); }
  return hit;
};
/* ★ 이사 — **열려 있으면 누른다.** 그 날이 곧 「튜토가 끝난 날」이다. */
const tryMoveOut = async () => {
  const was = await ev(`(()=>{const s=document.getElementById('sheet');return s.classList.contains('open')?'1':'';})()`);
  await ev(`window.__byeotSheet.open('room')`, false); await settleSheet(true);
  const hit = await ev(`(()=>{ const b=document.getElementById('moveOut');
    if(!b || b.disabled) return false; b.click(); b.click(); return true; })()`);
  if (hit) { R.did.moveOut = (R.did.moveOut || 0) + 1; R.movedOutOnDay = R.today; }
  await sleep(500); await tapTalk(); await clearPops();
  if (!was) { await ev(`window.__byeotSheet.close()`, false); await settleSheet(false); }
  return hit;
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
/* ══════════════════════════════════════════════════════════════════════════
   작물 하나를 방에 끌어다 놓는다 — 가구 상판이 차면 **바닥**에 놓는다.
   --------------------------------------------------------------------------
   ⚠⚠ 2026-08-24 — 예전에는 `light.room.slots`(=가구 상판)**에서만** 골랐다.
     그래서 시루가 **13개에서 멈췄고**, 그것을 「이 방은 자리가 13뿐」이라고 적을 뻔했다.
     ★ 박사님: *"뭔소리야 **시루는 땅바닥에 놓으면 되는데**."* — 그리고 실측으로 놓인다:
       바닥에 끌면 `free:crop_01_02` 처럼 **자리 이름 없이 좌표로** 선다.
     ⇒ ⇒ ★★ **「자리가 13뿐」은 방이 아니라 «자»의 한계였다.**
   ⚠ 바닥 점은 **찍어 봐야 안다** — 가구·벽 위로 떨어지면 안 놓인다.
     그래서 **놓였는지를 세어 확인하고 안 되면 다음 점**으로 간다. 짐작으로 안 넘어간다.
   ★ 콩나물은 어두운 자리라 **바닥이 오히려 맞다**(그늘이다). 무순만 밝은 상판을 찾는다.
   ══════════════════════════════════════════════════════════════════════════ */
const cropPlacedCount = () => ev('(()=>{ try { const S=window.__S(); let n=0;'
  + ' const b=(S.firstPlay&&S.firstPlay.beansprout)||{};'
  + ' for (const p of (b.pots||[])) if (p && (p.slotId||p.at)) n++;'
  + ' for (const st of (S.firstPlay&&S.firstPlay.crops)||[])'
  + '   for (const p of (st&&st.pots)||[]) if (p && (p.slotId||p.at)) n++;'
  + ' return n; } catch { return -1; } })()');

const placeCrop = async (kind, bright) => {
  const sortExpr = bright ? 'key(b2) - key(a)' : 'key(a) - key(b2)';
  /* ① 빈 상판을 밝기로 줄 세운다 — 무순은 밝은 쪽, 콩나물은 어두운 쪽.
     ⚠ 밝기는 **조도 보고**로 잰다. 높이(y)는 「높다/낮다」지 「밝다/어둡다」가 아니다. */
  const slot = await ev('(()=>{ const S=window.__S();'
    + ' const taken=new Set();'
    + ' for (const p of (S.pots||[])) if (p.slotId) taken.add(p.slotId);'
    + ' const b=(S.firstPlay&&S.firstPlay.beansprout)||{};'
    + ' for (const p of (b.pots||[])) if (p && p.slotId) taken.add(p.slotId);'
    + ' for (const st of (S.firstPlay&&S.firstPlay.crops)||[]) { if (st&&st.slotId) taken.add(st.slotId);'
    + '   for (const p of (st&&st.pots)||[]) if (p&&p.slotId) taken.add(p.slotId); }'
    + ' const all=(window.__io.light.room.slots||[]).filter(x=>!taken.has(x.slotId));'
    + ' if (!all.length) return "";'
    + ' let dli=null;'
    + ' try { const r=window.__io.light.daily(window.__S().day, window.__S()).report;'
    + '   dli=new Map((r.slots||[]).map(x=>[x.slotId, x.dli])); } catch(e){}'
    + ' const key=(x)=> (dli && dli.has(x.slotId) && Number.isFinite(dli.get(x.slotId)))'
    + '   ? dli.get(x.slotId) : x.y;'
    + ' all.sort((a,b2)=> ' + sortExpr + ');'
    + ' return all[0].slotId; })()');

  const before = await cropPlacedCount();
  const drop = async (expr) => {
    await ev('(()=>{ const rv=window.__rv;'
      + ' const c=document.getElementById("roomCanvas").getBoundingClientRect();'
      + ' const p = ' + expr + '; if(!p) return;'
      + ' window.__drag.begin(' + JSON.stringify(kind) + ', "", {clientX:c.left+c.width*0.9, clientY:c.top+40});'
      + ' window.__drag.move({clientX:p.x, clientY:p.y});'
      + ' window.__drag.end(); })()', false);
    await sleep(700);
    return (await cropPlacedCount()) > before;
  };

  if (slot) {
    const ok = await drop('(()=>{ let sp=null; try { sp=rv.screenPosOf(' + JSON.stringify(slot) + '); } catch {}'
      + ' return sp ? {x:c.left+sp.x, y:c.top+sp.y} : null; })()');
    if (ok) return true;
  }
  /* ② 상판이 차거나 안 먹으면 **바닥**에 놓는다. 점을 여럿 찍어 보고 놓인 것을 받는다.
     ⚠ 같은 점만 계속 찍으면 이미 놓인 것 위라 안 놓인다 — 그래서 여러 점을 돈다. */
  const FLOOR = [[0.50, 0.72], [0.70, 0.70], [0.50, 0.62], [0.35, 0.66], [0.62, 0.64],
                 [0.45, 0.76], [0.58, 0.76], [0.30, 0.72], [0.75, 0.64], [0.40, 0.60]];
  for (const [fx, fy] of FLOOR) {
    const ok = await drop('({x:c.left+c.width*' + fx + ', y:c.top+c.height*' + fy + '})');
    if (ok) return true;
  }
  return false;
};

const placeOneSiru = async () => {
  const ok = await placeCrop('beansprout', false);
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
    /* ★ **곳간에 얼마어치 있나** — 「거둔 것이 돈이 되는가」를 이 줄 없이는 못 읽는다.
       지갑만 보면 「수확 8회인데 지갑이 안 오른다」까지만 보이고 그 뒤가 안 보였다. */
    pantry:(()=>{ try { const f=S.firstPlay; return (f&&f.food&&f.food.pantryWon!=null)?Math.round(f.food.pantryWon):null; } catch(e){ return null; } })(),
    /* ★★★ **잎 «등급»과 그루 값** (2026-08-23) — 이것이 없어서 판 하나를 못 읽었다.
       ⚠ 무늬는 «몇 장»이 아니라 «무슨 등급»이 값을 정한다:
         plain 20,000 · sanban 350,000 · halfmoon 750,000 · fullmoon 1,150,000
         그루 = 잎 값 합 × potMult 1.4 × synergy[서로 다른 무늬 등급 «종수»]
       ⇒ ★ 산반+산반 이면 1,008,000 이라 이사비 2,000,000 에 «크게» 못 미치고,
         산반+하프문 이면 1,960,000 이라 «사만 원» 모자란다. **같은 「무늬 2장」인데 판이 갈린다.**
       ⚠⚠ 이 줄이 없으면 판이 끝나는 순간 그 판의 등급을 «영영» 못 본다 — 창이 닫히면 끝이다.
         실제로 220일 판 하나를 그렇게 잃었다. */
    /* __leafGrades() 는 { grades, potId, band } 를 낸다(game.html:10622) — 등급 줄과
       속도 띠만 챙긴다. ⚠ 화면을 안 건드린다. 읽기용 손잡이다.
       ⚠⚠ 이 안에는 백틱을 쓰지 않는다 — 오늘만 «네» 번째다. */
    grades:(()=>{ try {
      const g = window.__leafGrades && window.__leafGrades();
      return (g && g.grades) || null;
    } catch(e){ return null; } })(),
    band:(()=>{ try {
      const g = window.__leafGrades && window.__leafGrades();
      return (g && g.band) || null;
    } catch(e){ return null; } })(),
    /* ★★★ **잎마다 「얼마나 자랐나」**(leafM) — 2026-08-26
       박사님: 그루값은 «자란 정도에 따라» 달리 책정한다.
         leafM = clamp01((T - leafBirth) / matSpan)   (plant_grow §leafM · 렌더러가 쓰는 값)
       ⚠⚠⚠ 2026-08-26 정정 — 이 셈은 «틀렸다». growthDays 가 T 가 아니다.
         plant_grow:3343  const day = …GROWTH…,  ★ g = ageOf(day);
                          return { …, growthDays: ★ day }      ⇐ 넘기는 것은 «day»
         plant_grow:3348  if (ax.birth > g || ★ g < ax.leafBirth || …) continue;   ⇐ 판정은 «g»
         plant_grow §ageOf  g = ageOf(day) 는 «곡선 변환»이다 — day 와 «같지 않다»
       ⇒ ⛔ 그러니 아래 값은 「day 를 g 인 양 쓴」 것이라 참 leafM 이 아니다.
         40일 판에서 「하루 1/120 씩 곧게 오른다」가 나온 것은 그 구간에서 ageOf 가
         우연히 곧았을 뿐일 수 있다. ⇒ ★ 어댑터에 g 가 실릴 때까지 이 칸을 믿지 마라.
       ⚠⚠ 이 안에는 백틱을 쓰지 않는다 — 오늘 «여섯» 번째다.
       ⚠ 셋이 다 있어야 셈이 된다 — leafStats().growthDays · leafStageParams().matSpan · leafState()[].leafBirth
       ⚠ 못 읽으면 null 이다. 0 이나 1 로 «안 메꾼다» — 0 이면 「다 안 자랐다」,
         1 이면 「다 자랐다」가 되어 그루값이 통째로 틀린다.
       ⚠⚠ 이 안에는 백틱을 쓰지 않는다 — 브라우저 쪽 템플릿 안이다. */
    /* ★★★ **잎마다 「달렸나」와 「얼마나 자랐나」** — [growth] 가 «거기서 재서» 넘긴다.
       ⚠⚠ 여기 있던 것은 «틀렸다» — leafStats().growthDays(= day) 를 g 인 양 써서 셈했다.
         g = ageOf(day) 는 곡선 변환이라 day 와 같지 않다. 하루 동안 틀린 값을 적었다.
       ★ 거를 때는 onPlant === true 를 쓴다. leafM > 0 으로 거르면 «막 난 잎»이 같이 빠진다.
       ⚠ 못 읽으면 null 이다. 빈 배열로 안 메꾼다.
       ⚠⚠ 이 안에는 백틱을 쓰지 않는다 — 오늘 여섯 번 깨뜨렸다. */
    leafM:(()=>{ try {
      const g = window.__io && window.__io.growth;
      const rows = g && g.leafOnPlant && g.leafOnPlant();
      if (!Array.isArray(rows)) return null;
      const st = g.leafState && g.leafState();
      const varieOf = {};
      if (Array.isArray(st)) for (const r of st) if (r) varieOf[r.leafBirth] = { v: !!r.varie, mat: !!r.matured };
      return rows.map(r => ({
        lb: r.leafBirth,
        on: !!r.onPlant,
        m: Math.round((Number.isFinite(r.leafM) ? r.leafM : 0) * 100) / 100,
        v: !!(varieOf[r.leafBirth] && varieOf[r.leafBirth].v),
        mat: !!(varieOf[r.leafBirth] && varieOf[r.leafBirth].mat)
      }));
    } catch(e){ return null; } })(),
    growthT:(()=>{ try {
      const g = window.__io && window.__io.growth;
      const st = g && g.leafStats && g.leafStats();
      return st && Number.isFinite(st.growthDays) ? st.growthDays : null;
    } catch(e){ return null; } })(),
    /* ★★★ **튜토가 끝날 수 있는 날** — 이 세 줄이 오늘의 물음을 잰다.
       moveOk  이사 단추가 «열렸나» ⇒ 처음 참이 되는 날이 곧 「튜토가 끝날 수 있는 날」
       listed  중고에 올라간 건수 · dealOk 연락이 와서 «거래하기»가 떴나
       potBtn  「몬스테라 내놓기」 단추 글자 — 값이 거기 적힌다
       ⚠ 누르지 않는다. 여기서는 «보기»만 한다(누르는 것은 tryMoveOut 이 따로 한다). */
    moveOk:(()=>{ try { const b=document.getElementById('moveOut');
      return b ? !b.disabled : null; } catch(e){ return null; } })(),
    listed:(()=>{ try { return document.querySelectorAll('#marketList [data-deal]').length
      + document.querySelectorAll('#marketList .lrow').length; } catch(e){ return null; } })(),
    dealOk:(()=>{ try { return !!document.querySelector('#marketList [data-deal]'); } catch(e){ return null; } })(),
    potBtn:(()=>{ try { const b=document.getElementById('sellPlant');
      return b ? ((b.textContent||'').replace(/\s+/g,' ').trim() + (b.disabled?' [잠김]':'')) : null; } catch(e){ return null; } })(),
    /* ★ 프롤로그 못박기가 «켜졌나» — 어제는 「화분이 하나뿐」으로 «유추»했다. 유추는 기록이 아니다. */
    /* ★★★ **가방에서 끌 수 있나** (2026-08-27 · 박사님 "아직도안된다 몬스테라 처음 가방에서드래그")
       ⚠ 시트를 «열지 않는다» — 열면 판이 흔들린다. 칸이 안 그려져 있으면 null 이다.
       ⚠⚠ 이 안에는 백틱을 쓰지 않는다. */
    bagDrag:(()=>{ try {
      const cells = document.querySelectorAll('.bagslot');
      if (!cells.length) return null;
      const d = window.__drag, rv = window.__rv;
      const out = [];
      for (const c of cells) {
        /* ⚠⚠⚠ 2026-08-27 — data-place 만 보면 «틀린다». 가방의 몬스테라 칸은
           data-potbag 을 쓰고 bindDrag(b, 'monstera', …) 로 손이 걸린다(game.html:6528).
           ⇒ ⛔ 그것을 「못놓음」으로 찍는 바람에 「끌 것이 없는 칸」이라고 잘못 냈다.
           ⚠⚠ 이 안에는 백틱을 쓰지 않는다 — 오늘 «일곱» 번째다. */
        const what = c.getAttribute('data-place')
                  || (c.getAttribute('data-potbag') ? 'monstera' : null);
        const ko = ((c.querySelector('.nm') || {}).textContent || '?').slice(0, 10);
        /* ★ 어느 판에 있는 칸인가 — 가방인지 상점인지. 「가방에 몬스테라가 있다」를 가르려면 필요하다 */
        const page = (c.closest && c.closest('[id^=page]')) ? c.closest('[id^=page]').id : '?';
        const full = ((c.querySelector('.nm') || {}).textContent || '') + '|' + (c.getAttribute('title') || '');
        if (!what) { out.push(page + '/' + full.slice(0, 30) + ':«못놓음»'); continue; }
        const hand = c.classList.contains('draggable') ? 'CELL'
                   : c.querySelector('.draggable') ? 'IMG' : 'NONE';
        let ids = -1, dis = null;
        try { const r = d.slotsFor(what); ids = (r.ids || []).length; dis = !!(r.sel && r.sel.disabled); } catch (e) {}
        let on = false;
        try { d.end && d.end(); d.begin(what, '', { clientX: 100, clientY: 400, pointerId: 1 }, null);
              on = !!d.on; d.end && d.end(); } catch (e) {}
        out.push(ko + ':' + hand + '/자리' + ids + (dis ? '/잠김' : '') + (on ? '/★켜짐' : '/⛔안켜짐'));
      }
      return out;
    } catch(e){ return null; } })(),
    prologue:(()=>{ try { const S2=window.__S(); const ps=(S2.pots||[]);
      return !!(S2.tutorial && S2.tutorial.enabled && ps[0]); } catch(e){ return null; } })(),
    potWon:(()=>{ try {
      const el = document.getElementById('sellPlant');
      return el ? (el.textContent || '').replace(/\s+/g,' ').trim() : null;
    } catch(e){ return null; } })(),
    fpDone:!!(S.firstPlay&&S.firstPlay.completed), movedOut:!!ts.movedOut,
    lamp:(ts.lamp&&ts.lamp.owned)??null, lampOpen:!!(ts.lamp&&ts.lamp.unlocked),
    seed:(S.shop&&S.shop.stock&&S.shop.stock.bean_seed)??null,
    /* 무순 — 판이 이미 서 있나 · 재배판/무 씨앗 재고(§musun) */
    /* ⚠⚠ **fp.crops 는 배열이다**(first_play §cropSites — CROP_KINDS.slice(1).map(...)).
       처음에 fp.crops.musun 으로 물었는데 배열이라 늘 undefined 였고, 그래서
       **재배판을 놓고도 「안 놓았다」로 읽어** 매일 다시 놓으려 들었다(35일에 18번).
       ⇒ 자리는 **처음부터 있다**(그래야 화면이 「살 수 있다」를 띄운다). 그러니
         「자리가 있나」가 아니라 **「놓였나(slotId)」·「심었나(sown)」**를 봐야 한다. */
    musun: (()=>{ try { const fp=S.firstPlay||{};
      for (const st of (fp.crops||[])) {
        if (!st || st.kind !== 'musun') continue;
        if (st.slotId) return true;
        for (const p of (st.pots||[])) if (p && (p.slotId || p.sown)) return true;
      }
      return false; } catch { return false; } })(),
    /* 심었나 — 놓기와 심기가 다른 걸음이라 따로 본다(§buy) */
    /* 놓인 무순 판이 몇 개인가 — 씨앗을 그만큼 갖고 있어야 한 바퀴가 돈다 */
    musunPots: (()=>{ try { const fp=S.firstPlay||{}; let n=0;
      for (const st of (fp.crops||[])) { if (!st || st.kind!=='musun') continue;
        for (const p of (st.pots||[])) if (p && (p.slotId||p.at)) n++; }
      return n; } catch { return 0; } })(),
    musunSown: (()=>{ try { const fp=S.firstPlay||{};
      for (const st of (fp.crops||[])) { if (!st || st.kind !== 'musun') continue;
        for (const p of (st.pots||[])) if (p && p.sown) return true; }
      return false; } catch { return false; } })(),
    /* 무순 자리를 그대로 한 줄 적어 둔다 — 「왜 안 열리나」를 짐작으로 답하지 않으려는 것 */
    musunSite: (()=>{ try { const fp=S.firstPlay||{};
      const st=(fp.crops||[]).find(x=>x&&x.kind==='musun');
      return st ? { slot: st.slotId||null, pots:(st.pots||[]).map(p=>({s:p&&p.slotId||null, sown:!!(p&&p.sown)})) } : null;
    } catch { return null; } })(),
    tray:(S.shop&&S.shop.stock&&S.shop.stock.sprout_tray)??0,
    radish:(S.shop&&S.shop.stock&&S.shop.stock.radish_seed)??0,
    bankrupt:!!ts.bankrupt,
    hardLock: document.body.dataset.hardLock||'',
    gameOver: document.getElementById('gameOver') ?
      document.getElementById('gameOver').getAttribute('aria-hidden')!=='true' : false,
    nextOff: (()=>{const n=document.getElementById('next'); return !n||n.disabled;})(),
    /* ★ 퀘스트 사슬이 실제로 도나 — 「열린 줄」과 「끝낸 줄」을 그대로 적는다.
       ⚠ window.__quest 는 없는 이름이었다(늘 null 이었다). __questView 가 정본이다.
       ⚠⚠ 이 안에는 **백틱을 쓰지 않는다** — 통째로 템플릿 문자열이라 그 자리에서 깨진다.
          오늘만 세 번 깨뜨렸다. */
    qNow: (()=>{ try { const v=window.__questView(); return (v&&v.next&&v.next.id)||null; } catch { return null; } })(),
    qDone: (()=>{ try { const v=window.__questView();
      return ((v&&v.all)||[]).filter(x=>x&&x.state==='done').map(x=>x.id); } catch { return null; } })()
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
  /* ★ 게으름은 **물주기와 다시 심기**에만 건다(§LAZY).
     ⚠ 거두기는 안 거른다 — 다 자란 것을 안 거두는 사람은 없다. 그건 게으름이 아니라 딴 판이다.
     ⚠ 심기(첫 파종)도 안 거른다 — 놓자마자 심는 것이 한 손짓이다. */
  await rowAct('plant');
  if (!beLazy('water')) await rowAct('water');
  await rowAct('harvest');
  if (!beLazy('sow')) await rowAct('sow');

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
  /* ⚠⚠ **재고를 쌓지 않는다.** 앞 판이 시루를 **53개 사서 13개만 놓았다** —
     못 놓은 40개(3,550원 × 40 ≈ 14만원)가 **재고에 묶여** 지갑이 그만큼 얇아졌다.
     ⇒ 사람은 손에 있는 것을 먼저 놓고 나서 산다. **재고가 있으면 안 산다.**
     ⚠ 「빈 상판이 있나」는 **안 본다** — 상판이 차도 **바닥에 놓을 수 있다**(§placeCrop).
       그걸 조건으로 걸었다가 「자리가 13뿐」이라는 헛것을 만들 뻔했다. */
  const siruStock = await ev(`(()=>{ try { const S=window.__S();
    return (S.shop&&S.shop.stock&&S.shop.stock.siru)||0; } catch { return 0; } })()`);
  const needSiru = (before.sirus || 0) < wantSiru && (siruStock | 0) < 1;
  /* 씨앗은 **놓인 시루 수만큼** 있어야 한 바퀴가 돈다 — 0 일 때만 사면 늘 모자라고,
     목표 수만큼 사면 남는다(앞 판은 **17개가 남은 채** 끝났다) */
  const needSeed = (before.seed || 0) < (before.sirus || 1);
  if (needSeed || needSiru || (before.lampOpen && before.lamp === 0)) {
    await ev(`window.__byeotSheet.open('shop')`, false); await sleep(150);
    if (needSiru) { if (await order('siru', 1)) R.did.buySiru++; }   /* 하루에 하나씩 */
    /* ★★ **무순을 기른다.** 이게 없으면 본 퀘스트 사슬이 첫 줄에서 막힌다:
         crop_mix(한 상에 두 가지 · ★무순) → siru5_cycle5 → siru8 → siru16
       ⇒ 콩나물만 기르던 판은 `crop_mix` 가 안 닫혀 **그 뒤가 통째로 잠긴 채** 141일을 굴렀고
         141일에 파산했다. 「가이드대로 놀았다」가 아니었다 — **첫 줄만 따른 것**이다.
       ⚠ 무순은 **재배판(sprout_tray) + 무 씨앗(radish_seed)** 둘이 있어야 한다
         (game.html §musunNeed 가 그 둘을 순서대로 시킨다). 하나만 사면 아무 일도 안 난다. */
    /* ⚠⚠ **놓기와 심기는 다른 걸음이다.** 앞서는 「무순이 있나」 하나로 물어서,
       판을 놓고 나면 무 씨앗을 영영 안 샀다 — 예순 날에 [심기]가 **43번 던졌다**.
       ⇒ 걸음마다 따로 묻는다: **판이 없으면 판을, 판은 있는데 안 심었으면 씨앗을.** */
    if (PLAY === 'guided') {
      if (!before.musun && (before.tray || 0) < 1)
        { if (await order('sprout_tray', 1)) R.did.buyTray = (R.did.buyTray || 0) + 1; }
      /* ⚠⚠ 앞 판이 **무 씨앗을 못 사서 심기가 95번 던졌다** — 무순 수입이 통째로 빠졌다.
         까닭: 「안 심었을 때만」 사게 해 뒀는데, 무순은 거두면 다시 안 심은 상태가 되고
         그때 재고가 0 이면 그날부터 계속 던진다. ⇒ **놓인 판 수만큼 늘 갖고 있게** 한다
         (콩 씨앗과 같은 결이다). 돈이 모자라면 [＋]가 잠겨 거기서 멎는다. */
      else if (before.musun && (before.radish || 0) < (before.musunPots || 1))
        { if (await order('radish_seed', Math.max(1, (before.musunPots || 1) - (before.radish || 0))))
            R.did.buyRadish = (R.did.buyRadish || 0) + 1; }
    }
    /* ⚠ 앞 판은 콩 씨앗이 **44개까지 쌓였다** — 모자란 만큼만 산다(넘치면 돈이 묶인다) */
    if (needSeed) { if (await order('bean_seed', Math.max(1, Math.min(8, (before.sirus || 1) - (before.seed || 0))))) R.did.buySeed++; }
    if (before.lampOpen && before.lamp === 0) { if (await order('growlight')) R.did.buyLamp++; }
  }
  /* 산 시루는 **가방에 온다.** 끌어다 놓아야 쓴다 — 안 놓으면 영영 가방에 남는다 */
  /* ⚠ **놓을 시루가 있을 때만 놓는다.** 없는데 끌면 손짓만 나가고 아무 일도 안 난다 —
     실측으로 마흔 날에 **120번**이 그렇게 헛돌았다(시간만 먹는다). */
  /* 산 재배판을 **밝은 자리에** 내려놓는다 — 안 놓으면 가방에 남고 `crop_mix` 가 안 닫힌다 */
  if (PLAY === 'guided' && !before.musun && (before.tray || 0) > 0) {
    if (await placeCrop('musun', true)) { R.did.placeMusun = (R.did.placeMusun || 0) + 1;
      await sleep(600); await tapTalk(); }
  }
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
  /* ★★ **거둔 것을 돈으로 바꾼다** — 닷새마다 한 번이면 넉넉하다(회전이 닷새다).
     ⚠ 날마다 부르면 시트를 여닫느라 한 판이 두 배로 길어진다. */
  if (R.today % 5 === 0) { try { await sellSurplus(); } catch { } }
  /* ★★ 튜토를 끝까지 밟는다 — ⓐ 는 「내놓기 → 연락 → 거래 → 이사」 넷을 다 밟아야 한다.
     ⚠ ⓒ 는 안 판다. 그래도 **이사 단추는 매일 눌러 본다** — 채소로만 200만에 닿는 날이
       언제인지가 ⓒ 의 답이고, 그건 「열렸을 때 눌러 보는 것」으로만 잰다. */
  if (!R.movedOutOnDay) {
    try {
      if (ENDING === 'pot' && !R.did.listPot) {
        /* ★ 「팔면 나갈 수 있는가」 — 그루값 + 지금 지갑이 이사비에 닿아야 판다 */
        const worth = await potWorthNow();
        const cash = (R.days[R.days.length - 1] || {}).cash || 0;
        if (worth != null && worth + cash >= MOVE_WON) await listPot();
        else if (worth != null) R.did.potTooCheap = (R.did.potTooCheap || 0) + 1;
      }
      if (ENDING === 'pot' && R.did.listPot && !R.did.deal) await takeDeal();
      await tryMoveOut();
    } catch { }
  }
  /* ⚠⚠ **날 넘어가는 연출이 끝나기를 기다린다.** 안 기다리면 «날이 갔는데 상태를 먼저 읽어»
     「날짜가 안 갔다」로 읽는다 — 실측: 씨앗 2 가 d41 에서 그렇게 멈췄고, 그때 열려 있던 것이
     `dayAnim` 하나였다. ★ 크롬을 둘 띄워 느려지자 드러났다.
     ⇒ **판이 막힌 것이 아니라 자가 일찍 본 것**이다. 오늘 여러 번 본 그 모양이다. */
  for (let i = 0; i < 40; i++) {
    const on = await ev(`(()=>{const e=document.getElementById('dayAnim');
      return !!e && e.getAttribute('aria-hidden')==='false';})()`);
    if (!on) break;
    await sleep(120);
  }

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
  /* ★★ **어디서 벌어졌나** — [Plan]: 게으름의 벌은 **시루 수에 반비례**한다.
     시루 1개면 하루 거르는 것이 그날 수입의 **전부**이고, 16개면 **1/16** 이다.
     ⇒ 그래서 같은 --lazy 0.2 라도 **d0~d40 과 d100~ 이 다른 값**이다.
     ⇒ ⇒ ★ 「닿았나/못 닿았나」로만 읽으면 **그 갈림이 안 보인다.** 눈금을 따로 남긴다. */
  if (d === 40 || d === 80 || d === 120 || d === 160 || d === 200) {
    (R.marks = R.marks || []).push({ day: after.day, cash: after.cash,
                                     harvests: after.harvests, sirus: after.sirus });
  }

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
  /* ⚠ 게으름마다 파일을 가른다 — 안 그러면 다음 판이 앞 판을 덮어 **견줄 것이 없어진다** */
  fs.writeFileSync(path.join(OUT, `${STEM}.json`), JSON.stringify(R, null, 1), 'utf8');
}

/* ★ 자가 제한이 부를 창구를 잇는다 — `function` 선언이라 여기서 이어도 위에서 부른다 */
onWatchdog = (why) => { R.watchdog = why || true; finish(); };

function finish() {
  R.endedAt = new Date().toISOString();
  /* ══ ★★ **자가 스스로 소리를 낸다** (2026-08-23) ═══════════════════════════
     오늘 「주석에 경고를 박는 것」이 세 번 다 소용없었다 — 읽는 사람이 없으면 경고가 아니다.
     ⇒ ★ 그래서 **없으면 없다고 갈무리에 적는다.** 판이 끝난 뒤에야 「그게 없네」를 아는 일이
       오늘만 두 번이었다(로그 하나 · 잎 등급 하나). 둘 다 되돌릴 수 없었다.
     ⛔ 던져서 판을 죽이지는 않는다 — 밤새 도는 자를 사소한 것으로 멈추면 그게 더 나쁘다. */
  const missing = [];
  const arrived = R.days.some(d => d && d.leaves != null && d.day >= 13);
  if (arrived && !R.days.some(d => d && d.grades)) missing.push('잎 등급(grades)');
  if (!R.days.some(d => d && d.pantry != null)) missing.push('곳간(pantry)');
  if (missing.length) R.missing = missing;
  /* ★ 자가 제한에 걸려 불려 왔으면 그것도 적어 둔다 — 「끝난 꼴」이 빈 채로 남으면
     다음 사람이 「끝까지 돈 판」으로 읽는다. 실제로 내가 한 번 그렇게 읽었다. */
  if (R.ended == null && R.watchdog) R.ended = 'timeout';
  const last = R.days[R.days.length - 1] || {};
  const lines = [];
  if (R.missing && R.missing.length)
    lines.push(`⚠⚠ **이 판에 «없는 기록»** — ${R.missing.join(' · ')}` +
               String.fromCharCode(10) +
               '   ⇒ ★ 창이 닫히면 되돌릴 수 없다. 다음 판을 던지기 «전»에 자에 붙여라.');
  lines.push(`■ 씨앗 ${SEED} · ${PLAY}` +
    (LAZY > 0 ? ` · 게으름 ${LAZY}` : ' · ★완벽한 사람(위쪽 한계)') +
    ` — ${R.ended}${R.blocked ? ' · ' + R.blocked : ''}`);
  lines.push(`  달력 ${last.day ?? 0}일 · 튜토 ${last.tday ?? '—'}일 · 지갑 ${(last.cash ?? 0).toLocaleString()}원 · ` +
             `잎 ${last.leaves ?? '—'}장(무늬 ${last.varie ?? '—'}) · 수확 ${last.harvests ?? '—'}회 · 등 ${last.lamp ?? '—'}개`);
  lines.push(`  ★내가 한 일 — ${Object.entries(R.did).map(([k, v]) => k + ' ' + v).join(' · ')}`);
  if (LAZY > 0) {
    const ld = R.lazyDays || [];
    lines.push(`  ★거른 날 ${ld.length}번 — ` +
      ld.slice(0, 12).map(x => `d${x.day}:${x.tag}`).join(' · ') + (ld.length > 12 ? ' …' : ''));
  }
  const bad = R.console.filter(c => c.kind !== 'warning' && c.kind !== 'console.warning');
  lines.push(`  콘솔 — 오류·예외 ${bad.length}건 · 경고 ${R.console.length - bad.length}건`);
  for (const c of bad.slice(0, 15)) lines.push(`     ✘ Day ${c.day} ${c.text.slice(0, 160)}`);
  if ((R.marks || []).length)
    lines.push('  ★눈금 — ' + R.marks.map(m =>
      `d${m.day}: 지갑 ${(m.cash || 0).toLocaleString()} · 수확 ${m.harvests} · 시루 ${m.sirus}`).join(' | '));
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
  fs.writeFileSync(path.join(OUT, `${STEM}.log`), txt + String.fromCharCode(10), 'utf8');
  console.log('\n' + txt);
  console.log(`
→ ${path.relative(ROOT, path.join(OUT, `${STEM}.json`))}`);
}
finish();
await page.close();
clearTimeout(wd);
process.exit(R.ended === 'movedOut' ? 0 : 1);
