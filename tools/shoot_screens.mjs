/* tools/shoot_screens.mjs — 화면비율·기종별로 띄워 자리마다 찍는다 (읽기만)
   ══════════════════════════════════════════════════════════════════════
   2026-08-23 밤 · [Char] · [core] 하네스와 붙일 「찍는 쪽」이다.

   사용자 지시:
     "핸드폰 화면비율별(가로세로, 폭, 길이 등) 기종별( ex 아이폰) 등에서 다 잘되도록"

   ■ 경계 (총괄 확정)
       [core]  진행을 밟는다 — 첫 판을 처음부터 끝까지
       [Char]  ★ 찍는다 — 해상도별로 띄우고, 자리마다 찍는다
     둘이 붙는 접점이 **파일 이름 규약**이다:

         docs/engine/shots/qa/{해상도}/{순번}_{자리}.png

     순번을 앞에 두는 것은 **파일 이름 순서가 곧 컷 순서**여야 하기 때문이다.
     `check_shot_anomaly.py` 의 「앞 컷과 동일(화면이 안 넘어감)」 검사가 그 순서로 돈다.
     해상도로 폴더를 가르는 것은 **크기가 다른 그림끼리 비교하면 헛걸리기** 때문이다.

   ■ [core] 가 쓰는 법 — 진행을 밟다가 자리마다 한 줄
       import { shootAll, shoot } from './shoot_screens.mjs';
       const pages = await shootAll.open();          // 해상도 7개를 한꺼번에 띄운다
       await shoot(pages, 1, 'boot');                // 7장이 한 번에 찍힌다
       ... 진행 ...
       await shoot(pages, 2, 'bag_open');
       await shootAll.close(pages);

   ■ 혼자 돌리는 법 (하네스 없이도 지금 된다)
       node tools/shoot_screens.mjs                  # 부팅까지 찍는다
       BYEOT_URL=http://127.0.0.1:8780 node tools/shoot_screens.mjs

   ■ ★ 왜 이 일곱인가 — **극단부터**다. 가운데는 대개 된다.
     그리고 사용자가 「가로세로」를 **먼저** 적으셨다. 가로가 제일 잘 깨진다.
*/
import fs from 'fs';
import { launch, sleep } from './test_cdp.mjs';

const ONLY = (process.env.SHOT_SIZES || '').split(',').filter(Boolean);
export const SIZES = ([
  { id: '320x568',   w: 320,  h: 568,  dpr: 2, why: '제일 좁다 — 여기서 제일 잘 깨진다' },
  { id: '390x844',   w: 390,  h: 844,  dpr: 3, why: '아이폰 표준' },
  { id: '430x932',   w: 430,  h: 932,  dpr: 3, why: '프로맥스' },
  { id: '844x390',   w: 844,  h: 390,  dpr: 3, why: '★ 가로 — 세로용 배치가 무너진다' },
  { id: '932x430',   w: 932,  h: 430,  dpr: 3, why: '★ 가로(넓음)' },
  { id: '768x1024',  w: 768,  h: 1024, dpr: 2, why: '태블릿' },
  { id: '1920x1080', w: 1920, h: 1080, dpr: 1, why: 'PC' },
]).filter(s => !ONLY.length || ONLY.includes(s.id));   // SHOT_SIZES=320x568 처럼 골라 돌린다

/* ★ 기본값은 **로컬**이다.
   ⚠ 처음엔 올려둔 사이트(GitHub Pages)를 기본값으로 뒀다. [Asset] 이 잡았다.
     그러면 환경변수를 안 준 사람은 **오늘 고친 것이 하나도 안 든 판**을 찍는데,
     **화면이 멀쩡히 뜨니 아무도 눈치 못 챈다.** 기본값이 조용히 거짓말을 한다.
   ⇒ 올려둔 사이트를 보려면 **일부러** BYEOT_URL 을 줘야 한다. */
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:8780';
const OUT_ROOT = process.env.SHOT_OUT || 'docs/engine/shots/qa';
/* ★ 판마다 폴더를 새로 만든다 — **다시 찍는 것이 앞 판을 지우면 안 된다.**
   ⚠ [Asset] 이 잡았다: 내 2차 촬영이 `320x568/01_boot.png` 를 덮어써서,
     그 창이 *"처음엔 방이 또렷이 보였다"* 던 것을 **확인할 길이 없어졌다.**
     근거 하나가 사라진 것이다.
   ⇒ 내가 낸 말을 내 도구가 안 지키고 있었다 — **「무엇을 하든 가진 것은 남긴다.」**
   ⇒ 그리고 판이 여럿 남아야 **「판마다 다르다」를 나중에 증명**할 수 있다. */
function nextRun(root) {
  let n = 1;
  try {
    const seen = fs.readdirSync(root).filter(x => /^run\d+$/.test(x))
      .map(x => +x.slice(3));
    if (seen.length) n = Math.max(...seen) + 1;
  } catch { /* 폴더가 아직 없다 */ }
  return 'run' + String(n).padStart(2, '0');
}
const RUN = process.env.SHOT_RUN || nextRun(OUT_ROOT);
const OUT = `${OUT_ROOT}/${RUN}`;
/* 부팅이 끝났는지 — 기존 프로브(probe_qa_boot.mjs)가 쓰는 것과 같은 표시를 본다 */
const READY = process.env.SHOT_READY || '!!window.__rv';

/** 움직임이 멎기를 기다린다 — **연출 중에 찍으면 헛것이 나온다.**
    ⚠ [core] 가 찾았다: 날 넘어가는 연출(`#dayAnim`)이 화면을 덮는 중이면
      그 아래 단추가 「가려짐」으로 나온다. 갈래로 거르는 것보다 **안 만드는 편**이 낫다.
    ⚠ 그리고 `.open` 같은 **상태 클래스는 미끄러지기보다 먼저 바뀐다.**
      그래서 클래스가 아니라 **실제로 움직임이 멎었나**를 본다. */
async function settle(page, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    let running = null;
    try {
      running = await page.eval('(()=>{ try { return document.getAnimations ? '
        + 'document.getAnimations().filter(a=>a.playState==="running").length : 0; } '
        + 'catch(e){ return 0; } })()');
    } catch { return; }
    if (!running) return;
    await sleep(200);
  }
}

/** 해상도별로 한 장씩 찍는다. 파일 이름은 규약을 따른다. */
export async function shoot(pages, seq, name) {
  const num = String(seq).padStart(2, '0');
  const made = [];
  for (const p of pages) {
    const f = `${OUT}/${p.__size.id}/${num}_${name}.png`;
    try {
      await settle(p);                    // ★ 움직임이 멎은 뒤에 찍는다
      await p.shot(f);
      /* ★ 곁파일 — 그림만으로는 **오류 화면인지 알 수 없다.**
         실제로 부팅에 실패한 붉은 오류 상자를 찍었는데 `check_shot_anomaly` 가
         「안 깨졌다」로 통과시켰다. 글자를 읽는 것은 픽셀이 아니라 **DOM 이 할 일**이다. */
      let state = { ready: !!p.__ready };
      try {
        state = await p.eval(`(()=>{
          const t = (document.body && document.body.innerText || '');
          const err = /불러오지 못|읽지 못했습니다|경로 미상/.test(t);
          /* ★ 「눌러야 하는 것이 다른 것에 가려졌나」 — [Asset] 이 눈으로 짚은 갈래다.
             픽셀로는 못 본다. **elementFromPoint 로 가운데를 찔러 보면** 안다:
             내가 아니라 남이 잡히면 그 위에 무엇이 덮여 있는 것이다.
             08-22 민원 "해상도에 따라 [다음 날] 버튼 클릭 오류" 가 이 갈래로 보인다. */
          const sel = 'button,[role=button],a[href],input,select,.btn,#next,#mealGo';
          const occluded = [], partly = [], offscreen = [], tiny = [], clipped = [],
                outside = [], disabledOff = [], inClosedPanel = [],
                coveredBySheet = [], coveredByModal = [], coveredByAnim = [];
          /* ★★ **덮은 것이 무엇이냐**로 갈린다. [core] 갈래를 그대로 쓴다.
             시트가 열려 그 아래가 덮이는 것 · 모달이 떠서 덮이는 것은 **정상**이다.
             아무것도 안 떴는데 남이 잡히는 것만 진짜 「가려짐」이다.
             ⇒ 오늘 세 번 같은 자리에서 틀렸다(꺼짐 · 닫힌 시트 · 부하).
               **안 보이는 데는 까닭이 여럿이고, 까닭을 안 찍으면 전부 「가려짐」이 된다.** */
          const coverKind = (top) => {
            let a = top, n = 0;
            while (a && n++ < 8) {
              const id = (a.id || '') + ' ' + (typeof a.className === 'string' ? a.className : '');
              /* ★ 여섯째 갈래 — **연출**. [core] 가 찾았다(next <- dayAnim).
                 날 넘어가는 연출이 화면을 덮는 중이면 그 아래가 안 잡히는 것이 정상이다.
                 ⇒ 오늘 네 번째로 같은 자리다 — 꺼짐 · 시트 · 모달 · 연출. */
              if (/anim|fade|curtain|transition|dayAnim/i.test(id)) return 'anim';
              if (/sheet/i.test(id)) return 'sheet';
              if (/modal|dialog|overlay|panel|popup/i.test(id) || a.getAttribute
                  && a.getAttribute('role') === 'dialog') return 'modal';
              a = a.parentElement;
            }
            return null;
          };
          /* ★★ 「꺼짐」과 「가려짐」은 **다른 병**이다. 뭉뚱그리면 안 된다.
             ⚠ 내가 뭉뚱그려서 틀렸다 — next(다음 날) 이 「대사창에 덮였다」로 나왔는데,
               game.html:839 에 '#stage.talking #next { opacity:.35; pointer-events:none }'
               이 있다. **일부러 끈 것**이다. 그리고 elementFromPoint 는
               pointer-events:none 인 것을 **건너뛰고 그 밑을 잡는다.**
               즉 **꺼져 있으면 언제나 「남이 잡힌다」로 나온다.**
             ⇒ 찌르기 전에 **자기 상태부터** 본다. [Asset] 이 잡아 줬다. */
          const isOff = (el, cs) => cs.pointerEvents === 'none'
                        || parseFloat(cs.opacity) < 0.5 || el.disabled === true;
          const vis = (el) => {
            const cs = getComputedStyle(el);
            return !(cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0);
          };
          const tagOf = (el) => {
            const id = el.id || (typeof el.className === 'string' ? el.className : '') || el.tagName;
            const label = (el.innerText || el.value || '').trim().slice(0, 14);
            return id + (label ? '(' + label + ')' : '');
          };
          /* ★ 가운데 한 점이 아니라 **아홉 점**을 찔러 본다.
             [Asset] 이 눈으로 본 「초상화가 방과 글자를 절반쯤 가린다」는
             가운데만 보면 안 걸린다. **일부만 가려도 누르기 어렵다.** */
          const probe = (el, r) => {
            let self = 0, other = 0, top = null;
            for (const fx of [0.15, 0.5, 0.85]) for (const fy of [0.15, 0.5, 0.85]) {
              const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width * fx));
              const y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height * fy));
              const hit = document.elementFromPoint(x, y);
              if (!hit) continue;
              if (hit === el || el.contains(hit) || hit.contains(el)) self++;
              else { other++; top = top || hit; }
            }
            return { self, other, top };
          };
          for (const el of document.querySelectorAll(sel)) {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height || !vis(el)) continue;
            const tag = tagOf(el);
            const cs2 = getComputedStyle(el);
            if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) {
              /* ★★ 화면 밖이라고 다 병이 아니다. **닫힌 패널 안**일 수 있다.
                 ⚠ 내가 여기서 틀렸다 — 'tabBag 이 화면 밖이라 가방을 못 연다'고 올렸는데,
                   조상 'sheet' 가 top:849(창 높이 844)였다. **가방 시트가 닫혀서 아래로
                   내려가 있던 것**이고 그 안의 탭이 밖인 것은 **정상**이다.
                 ⇒ 조상이 밀려서 밖에 있는 것과, 제가 밖에 있는 것을 가른다. */
              let closed = null, a = el.parentElement, n = 0;
              while (a && n++ < 6) {
                const ar = a.getBoundingClientRect();
                if (ar.height > 0 && (ar.top >= innerHeight - 8 || ar.bottom <= 8
                    || ar.left >= innerWidth - 8 || ar.right <= 8)) { closed = a; break; }
                a = a.parentElement;
              }
              if (closed) inClosedPanel.push(tag + ' ⊂ ' + tagOf(closed));
              else offscreen.push(tag);
              continue;
            }
            if (r.width < 32 || r.height < 32)
              tiny.push(tag + ':' + Math.round(r.width) + 'x' + Math.round(r.height));
            if (el.scrollWidth > el.clientWidth + 2) clipped.push(tag);
            /* ④ 부모 밖으로 삐져나갔나 — [Asset] 이 가로에서 본 「초상화가 대사창 위로
               삐져나와 잘린다」가 이것이다. 부모가 넘침을 자르면 그만큼 안 보인다. */
            const par = el.parentElement;
            if (par) {
              const pr = par.getBoundingClientRect();
              const po = getComputedStyle(par).overflow;
              /* ★ 방향을 나눈다 — [Asset]: 초상화는 **원래 아래로 걸쳐 놓는 그림**이다.
                 아래로 나가는 것은 정상일 수 있고, **위·옆으로 나가면 사고**다. */
              const up = Math.max(0, pr.top - r.top);
              const side = Math.max(0, pr.left - r.left) + Math.max(0, r.right - pr.right);
              if (po !== 'visible' && (up + side) > Math.min(r.width, r.height) * 0.25)
                outside.push(tag + ' ← ' + tagOf(par) + (up > side ? ' 위로 ' : ' 옆으로 ')
                             + Math.round(up + side) + 'px');
            }
            if (isOff(el, cs2)) { disabledOff.push(tag); continue; }   // 일부러 끈 것 — 가려짐이 아니다
            const q = probe(el, r);
            if (q.other) {
              const kind = coverKind(q.top);
              const line = tag + ' ← ' + tagOf(q.top);
              if (kind === 'anim') coveredByAnim.push(line);
              else if (kind === 'sheet') coveredBySheet.push(line);
              else if (kind === 'modal') coveredByModal.push(line);
              else if (!q.self) occluded.push(line);
              else if (q.other >= 3) partly.push(tag + ' ' + q.other + '/9 ← ' + tagOf(q.top));
            }
          }
          /* ③ **눌러야 하는 것만이 아니라 「보여야 하는 것」도 가려진다.**
             [Asset] 이 본 「초상화가 방과 글자를 가린다」가 그것이다.
             방(캔버스)·대사 글자·안내 문구는 못 누르지만 **안 보이면 못 논다.** */
          const SHOW = 'canvas,#dlgText,#dlgWho,[class*=hint],[id*=hint],[class*=quest]';
          for (const el of document.querySelectorAll(SHOW)) {
            const r = el.getBoundingClientRect();
            if (r.width < 40 || r.height < 40 || !vis(el)) continue;
            if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
            const q = probe(el, r);
            if (q.other >= 4) partly.push('[보여야] ' + tagOf(el) + ' ' + q.other + '/9 ← ' + tagOf(q.top));
          }
          /* ② 같은 문구가 두 번 — [Asset] 이 본 것. 글자를 모아 겹치는 것을 센다. */
          const seen = new Map(), dup = [];
          for (const el of document.querySelectorAll('p,div,span,li,h1,h2,h3,button')) {
            if (el.children.length || !vis(el)) continue;       // 잎 노드만
            const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
            if (t.length < 8) continue;
            const r = el.getBoundingClientRect();
            if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
            if (seen.has(t)) { if (!dup.includes(t)) dup.push(t.slice(0, 30)); }
            else seen.set(t, 1);
          }
          /* ★ 「지금 꺼야 맞는 상태인가」를 같이 찍는다.
             대사 중이면 진행 단추가 꺼져 있는 것이 정상이다. 이 한 칸이 그것을 가른다. */
          const stage = document.querySelector('#stage');
          const talking = !!(stage && stage.classList.contains('talking'));
          return { ready: !!window.__rv, errorText: err, talking,
                   scrollX: document.documentElement.scrollWidth > innerWidth + 2,
                   occluded, partly, offscreen, tiny, clipped, outside,
                   disabledOff, inClosedPanel, coveredBySheet, coveredByModal, coveredByAnim,
                   animating: (document.getAnimations ? document.getAnimations()
                     .some(a => a.playState === 'running') : null),
                   dupText: dup.slice(0, 5) };
        })()`);
      } catch { }
      state.ready = state.ready && !!p.__ready;
      fs.writeFileSync(f.replace(/\.png$/, '.json'), JSON.stringify(state));
      made.push(f);
    }
    catch (e) { console.error(`  ✗ ${p.__size.id} ${name}: ${e.message}`); }
  }
  return made;
}

export const shootAll = {
  /** 해상도 전부를 띄우고 게임을 연다. 실패한 것은 빼고 돌려준다. */
  async open(url = `${BASE}/game.html`) {
    /* ★ 한꺼번에 띄운다.
       ⚠ 처음엔 하나씩 띄웠는데 **일곱 번째까지 못 가고 제한에 걸렸다.**
         헤드리스는 GPU 가 없어 소프트웨어 GL 로 도니 부팅이 느리다(한 판에 1~3분).
         7 × 그것은 못 기다린다. 서로 기다릴 이유가 없으니 나란히 띄운다. */
    const BATCH = +(process.env.SHOT_BATCH || 2);
    const out = [];
    for (let i = 0; i < SIZES.length; i += BATCH) {
      const part = await Promise.all(SIZES.slice(i, i + BATCH).map(one));
      out.push(...part.filter(Boolean));
    }
    /* ⚠ 여기서 물렀다 — 처음엔 **찍기 전에** 부팅 실패한 것을 혼자 다시 띄웠다.
       그런데 재시도는 하나에 최대 4분이고 넷이 실패하니 **16분**, 제한을 넘겨
       **한 장도 못 찍고 끝났다.** 재시도가 촬영을 통째로 잡아먹은 것이다.
       ⇒ **먼저 찍고, 재시도는 그 뒤에** 한다. 무엇을 하든 **가진 것은 남긴다.** */
    return out;

    async function one(s) {
      try {
        const p = await launch({ width: s.w, height: s.h, dpr: s.dpr });
        p.__size = s;
        await p.goto(url);
        p.__ready = true;
        try { await p.waitFor(READY, 240000, 400); }
        catch (e) { p.__ready = false; }
        console.log(`  띄움 ${s.id}  (${s.why})${p.__ready ? '' : '  ⚠ 부팅 표시 못 봄'}`);
        return p;
      } catch (e) {
        console.error(`  ✗ ${s.id} 못 띄웠다: ${e.message}`);
        return null;
      }
    }
  },
  async close(pages) { for (const p of pages) { try { await p.close(); } catch { } } },
};

/* ── 혼자 돌릴 때 ───────────────────────────────────────────────── */
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
    process.argv[1].endsWith('shoot_screens.mjs')) {
  const WD = setTimeout(() => { console.error('⏱ 제한을 넘겨 멈춥니다.'); process.exit(2); },
    +(process.env.SHOT_TIMEOUT_MS || 600000));
  WD.unref && WD.unref();

  console.log(`여는 곳: ${BASE}/game.html`
    + (process.env.BYEOT_URL ? '' : '   ← 기본값(로컬). 서버가 떠 있어야 한다'));
  console.log(`찍는 곳: ${OUT}/{해상도}/{순번}_{자리}.png\n`);
  const pages = await shootAll.open();
  if (!pages.length) { console.error('한 개도 못 띄웠다.'); process.exit(1); }

  await sleep(1200);                       // 첫 그림이 안정되기를 기다린다
  let n = (await shoot(pages, 1, 'boot')).length;
  console.log(`\n01_boot  ${n}장`);

  /* ── UI 자리 (날짜를 안 넘긴다 — [core] 와 겹치지 않는 선) ──────────
     ★ 시트를 연 한 컷이 필요하다. [Plan] 이 문구 중복을 이렇게 갈랐다:
       "아래 퀘스트 줄은 시트를 열면 가린다. 같은 한 줄을 두 곳이 나눠 볼 뿐이다."
     ⇒ **가림이 실제로 도는지는 아직 아무도 안 봤다.** 이 한 장이 그것을 답한다.
     누르지 않고 game.html 이 내놓은 손잡이를 쓴다(2797행 window.__byeotSheet). */
  for (const p of pages) {
    try {
      await p.eval("(()=>{ try { window.__byeotSheet && window.__byeotSheet.open('tabBag');"
                 + " return 1; } catch(e){ return 0; } })()");
    } catch { /* 손잡이가 없으면 건너뛴다 */ }
  }
  await sleep(600);
  const n2 = (await shoot(pages, 2, 'sheet_open')).length;
  console.log(`02_sheet_open  ${n2}장`);

  /* ★ 여기서부터는 [core] 가 진행을 밟으며 부를 자리다.
     아직 하네스가 없어서 **부팅 한 장까지만** 찍는다.
     진행을 여기서 흉내내면 [core] 와 두 벌이 되므로 안 한다. */

  await shootAll.close(pages);
  clearTimeout(WD);
  console.log('\n다음: python tools/check_shot_anomaly.py ' + OUT);
  console.log('⚠ 찍힌 것이 「괜찮다」는 뜻은 아니다. 깨졌는지만 자가 본다.');
}
