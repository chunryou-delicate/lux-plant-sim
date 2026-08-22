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

export const SIZES = [
  { id: '320x568',   w: 320,  h: 568,  dpr: 2, why: '제일 좁다 — 여기서 제일 잘 깨진다' },
  { id: '390x844',   w: 390,  h: 844,  dpr: 3, why: '아이폰 표준' },
  { id: '430x932',   w: 430,  h: 932,  dpr: 3, why: '프로맥스' },
  { id: '844x390',   w: 844,  h: 390,  dpr: 3, why: '★ 가로 — 세로용 배치가 무너진다' },
  { id: '932x430',   w: 932,  h: 430,  dpr: 3, why: '★ 가로(넓음)' },
  { id: '768x1024',  w: 768,  h: 1024, dpr: 2, why: '태블릿' },
  { id: '1920x1080', w: 1920, h: 1080, dpr: 1, why: 'PC' },
];

/* ★ 기본값은 **로컬**이다.
   ⚠ 처음엔 올려둔 사이트(GitHub Pages)를 기본값으로 뒀다. [Asset] 이 잡았다.
     그러면 환경변수를 안 준 사람은 **오늘 고친 것이 하나도 안 든 판**을 찍는데,
     **화면이 멀쩡히 뜨니 아무도 눈치 못 챈다.** 기본값이 조용히 거짓말을 한다.
   ⇒ 올려둔 사이트를 보려면 **일부러** BYEOT_URL 을 줘야 한다. */
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:8780';
const OUT = process.env.SHOT_OUT || 'docs/engine/shots/qa';
/* 부팅이 끝났는지 — 기존 프로브(probe_qa_boot.mjs)가 쓰는 것과 같은 표시를 본다 */
const READY = process.env.SHOT_READY || '!!window.__rv';

/** 해상도별로 한 장씩 찍는다. 파일 이름은 규약을 따른다. */
export async function shoot(pages, seq, name) {
  const num = String(seq).padStart(2, '0');
  const made = [];
  for (const p of pages) {
    const f = `${OUT}/${p.__size.id}/${num}_${name}.png`;
    try {
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
          const occluded = [], offscreen = [], tiny = [], clipped = [];
          for (const el of document.querySelectorAll(sel)) {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;                 // 안 보이는 것은 뺀다
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
            const id = el.id || el.className || el.tagName;
            const label = (el.innerText || el.value || '').trim().slice(0, 14);
            const tag = id + (label ? '(' + label + ')' : '');
            if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) {
              offscreen.push(tag); continue;
            }
            if (r.width < 32 || r.height < 32) tiny.push(tag + ':' + Math.round(r.width) + 'x' + Math.round(r.height));
            if (el.scrollWidth > el.clientWidth + 2) clipped.push(tag);
            const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
            const y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
            const hit = document.elementFromPoint(x, y);
            if (hit && hit !== el && !el.contains(hit) && !hit.contains(el))
              occluded.push(tag + ' ← ' + (hit.id || hit.className || hit.tagName));
          }
          return { ready: !!window.__rv, errorText: err,
                   scrollX: document.documentElement.scrollWidth > innerWidth + 2,
                   occluded, offscreen, tiny, clipped };
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
    /* ★ 부팅을 못 본 것은 **혼자 다시** 띄운다(밤샘 규칙: 붉은 것은 단독으로 다시 잰다).
       실제로 일곱을 한꺼번에 띄웠더니 두 개가 부팅에 실패했는데,
       단독으로 재니 멀쩡했다. **부하였지 버그가 아니었다.** */
    for (let k = 0; k < out.length; k++) {
      if (out[k].__ready) continue;
      const s2 = out[k].__size;
      console.log(`  ↻ ${s2.id} 부팅을 못 봐서 혼자 다시 띄운다`);
      try { await out[k].close(); } catch { }
      const again = await one(s2);
      if (again) out[k] = again;
    }
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

  /* ★ 여기서부터는 [core] 가 진행을 밟으며 부를 자리다.
     아직 하네스가 없어서 **부팅 한 장까지만** 찍는다.
     진행을 여기서 흉내내면 [core] 와 두 벌이 되므로 안 한다. */

  await shootAll.close(pages);
  clearTimeout(WD);
  console.log('\n다음: python tools/check_shot_anomaly.py ' + OUT);
  console.log('⚠ 찍힌 것이 「괜찮다」는 뜻은 아니다. 깨졌는지만 자가 본다.');
}
