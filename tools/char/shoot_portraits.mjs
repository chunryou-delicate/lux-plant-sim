/* 초상화가 대사창에서 **무엇을 가리는가**를 찍는다.
 *
 * 2026-08-30 · [Char]
 *
 * ■ 무엇을 보려는가
 *
 * 초상화는 대사 상자 **위로 솟는다**(`#dlgFace{bottom:100%; margin-bottom:-18px}`).
 * 폰에서 화면 높이의 **22%** 를 차지한다(README §10). ⇒ **그 자리에 무엇이 있었나.**
 * 글은 안 가린다(상자 밖이다). ⚠ 가릴 만한 것은 **화면 아래쪽 단추와 칩**이다.
 *
 * ■ ★ 세로만 찍는다 — 가로는 «안 보는 자리»다
 *
 * [Plan] 판정(2026-08-30 `af0ce6b`): 「볕」은 세로로 하는 놀이다.
 * ⇒ 가로폰에서 초상화가 70px 이 되는 것은 **고칠 것이 아니라 안 보는 자리**다(README §10-2).
 *   ⚠ 그래도 «한 판은» 찍는다 — 「안 본 것」과 「안 하는 것」은 다르고,
 *     **한 번은 봐 두어야 「안 한다」고 적을 수 있다.**
 *
 * ■ ★★ 대사를 «단추 없이» 연다
 *
 * `window.__dlgOpen(ids)` 가 game.html 에 있다(2026-08-21 [core] 가 만든 재는 손잡이).
 * 도착 대사는 두 바퀴를 굴려야 나오는데 그 길을 매번 걸을 수 없다.
 *   ⚠ **읽기용이 아니다** — 진짜로 큐에 넣는다. 그래서 재는 것이 «실제로 뜨는» 그 대사다.
 *
 * ■ ⛔ 다른 창과 Chrome 을 «겹쳐 쓰지 말 것»
 *
 * 겹쳐 띄우면 부팅이 밀려 **「고장」처럼 보인다.** 내가 실제로 그렇게 물렸다 —
 * 「네 해상도가 부팅을 안 한다」고 적었다가, 하나씩 돌리니 일곱이 다 `ready=true` 였다.
 * ⇒ 그래서 여기 기본 `SHOT_BATCH` 를 **1** 로 둔다. 느려도 **거짓말을 안 한다.**
 *
 * ■ 쓰는 법
 *
 *     node tools/char/shoot_portraits.mjs                 # 세로 넷 + 가로 하나
 *     SHOT_SIZES=390x844 node tools/char/shoot_portraits.mjs
 */
import { launch } from '../test_cdp.mjs';
import { settle, saveSidecar } from '../shoot_screens.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const BASE = process.env.BYEOT_URL || 'http://localhost:8000';
/* ⚠⚠ `waitFor` 는 **CSS 선택자가 아니라 JS 식**을 받는다(`test_cdp.mjs:135`).
   처음에 `'#stage'` 라 적었다. 그건 «문자열이라 늘 참»이라 —
   ⇒ ⛔ **부팅을 기다리지 않고 그 자리에서 통과**한다. 그리고 «성공처럼» 보인다.
     ⇒ ★ 아직 안 뜬 화면을 찍고 「가리는 것이 없다」고 적었을 것이다.
   ⇒ ★★ `shoot_screens.mjs:73` 이 쓰는 것을 그대로 쓴다 — 그쪽이 실물로 다듬은 식이다. */
const READY = process.env.SHOT_READY || '!!window.__rv';

/* ★ 세로가 먼저다. 가로는 «한 판만» — 안 보는 자리라는 것을 «보고» 적으려고. */
const ONLY = (process.env.SHOT_SIZES || '').split(',').filter(Boolean);
const SIZES = [
  { id: '320x568', w: 320, h: 568, dpr: 2, why: '제일 좁다' },
  { id: '390x844', w: 390, h: 844, dpr: 3, why: '★ 아이폰 표준 — 이것이 본판이다' },
  { id: '430x932', w: 430, h: 932, dpr: 3, why: '프로맥스' },
  { id: '1920x1080', w: 1920, h: 1080, dpr: 1, why: 'PC — 초상화가 화면 높이의 절반' },
  { id: '844x390', w: 844, h: 390, dpr: 3, why: '⚠ 가로 — «안 보는 자리»임을 보려고 한 판만' },
].filter(s => !ONLY.length || ONLY.includes(s.id));

/* 찍을 자리 — 오늘 이은 얼굴 둘이 들어 있다 */
const SHOTS = [
  { name: 'numb', ids: ['brokeTalk'], why: '★ 오늘 이은 얼굴. 파산 첫 줄' },
  { name: 'proud', ids: ['harvest'], why: '★ 오늘 이은 얼굴. 첫 수확' },
  { name: 'moni', ids: ['monsteraArrived'], why: '몬이 — 초상화가 가장 자주 뜨는 화자' },
  { name: 'god', ids: ['god1'], why: '식물신 — 얼굴이 «없는» 화자(noface). 배치가 다르다' },
];

/* ★ 무엇이 가려지나를 «픽셀이 아니라 DOM 으로» 잰다.
   ⚠ 그림만 보고 「가렸다」고 적으면 안 된다 — 오늘 이 방이 그것으로 여러 번 물렸다. */
const PROBE = `(() => {
  const r = el => { if (!el) return null; const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const face = document.getElementById('dlgFace');
  const fb = face && face.getBoundingClientRect();
  const hidden = [];
  if (fb && fb.width > 1) {
    /* 초상화 네모 안의 점 아홉을 찍어 «맨 위에 무엇이 있나» 를 본다.
       ⚠ elementFromPoint 는 pointer-events:none 을 «건너뛴다» — 초상화 자신이 그렇다.
         그래서 초상화가 «덮고 있는» 것이 그대로 잡힌다. 그게 우리가 알고 싶은 것이다. */
    for (let i = 1; i <= 3; i++) for (let j = 1; j <= 3; j++) {
      const x = fb.x + fb.width * i / 4, y = fb.y + fb.height * j / 4;
      const e = document.elementFromPoint(x, y);
      if (!e) continue;
      const id = e.id || e.className || e.tagName;
      const tappable = e.closest('button, [role=button], .mark, .bagslot, .siru, .navbar > *');
      hidden.push({ at: i + ',' + j, el: String(id).slice(0, 40),
                    tappable: tappable ? (tappable.id || tappable.className || tappable.tagName) : null });
    }
  }
  return {
    face: r(face), box: r(document.getElementById('dlgBox')),
    text: r(document.getElementById('dlgText')),
    faceUrl: face ? getComputedStyle(face).backgroundImage.slice(0, 200) : null,
    noface: !!(document.getElementById('dlgBox') || {}).classList
            && document.getElementById('dlgBox').classList.contains('noface'),
    talking: document.getElementById('stage').classList.contains('talking'),
    vw: innerWidth, vh: innerHeight,
    faceH: getComputedStyle(document.getElementById('dlgBox')).getPropertyValue('--faceH').trim(),
    under: hidden,
  };
})()`;

const OUT = join('_out', 'char_portraits');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('여는 곳: ' + BASE + '/game.html');
  console.log('찍는 곳: ' + OUT + '/{해상도}/{자리}.png');
  console.log('⚠ 한 번에 하나씩 띄운다 — 겹치면 부팅이 밀려 「고장」처럼 보인다.\n');

  const report = [];
  for (const s of SIZES) {
    let p = null;
    try {
      p = await launch({ width: s.w, height: s.h, dpr: s.dpr });
      await p.goto(BASE + '/game.html');
      let ready = true;
      try { await p.waitFor(READY, 240000, 400); } catch { ready = false; }
      console.log('  띄움 ' + s.id + '  (' + s.why + ')' + (ready ? '' : '  ⚠ 부팅 표시 못 봄'));
      if (!ready) { report.push({ size: s.id, ready: false }); continue; }
      /* ★ 「같은 화면을 여러 번 찍었나」를 자가 «스스로» 본다.
         ⛔ 실제로 그렇게 넷을 찍고도 「✓」 넷이 찍혀 성공처럼 보였다. */
      const seenPng = [];

      for (const sh of SHOTS) {
        /* ⚠⚠ **먼저 큐를 비운다.** 안 비우면 «앞 줄이 그대로 떠 있다».
           `__dlgOpen` 은 «큐에 붙일» 뿐 보이는 줄을 안 바꾼다.
           ⇒ ⛔ 처음에 이걸 안 하고 넷을 찍었더니 **네 장이 다 같았다** —
             같은 크기 · 같은 그림(`jachwi_tired`), 내 대사 넷 중 «아무것도 아닌» 것.
             ⇒ ★ 그런데 `__dlgOpen` 은 «참»을 돌려줬고 그림도 넷 다 저장됐다.
               ⛔ 「열렸다」와 「그 줄이 보인다」는 다르다 — 오늘의 그 갈래가 또 나왔다. */
        await p.eval("(()=>{ const b=document.getElementById('dlgSkip'); "
          + 'if (b) b.click(); return true; })()');
        await sleep(200);
        const opened = await p.eval('window.__dlgOpen(' + JSON.stringify(sh.ids) + ')');
        if (opened === false || String(opened).startsWith('ERR')) {
          console.log('    - ' + sh.name + ': 안 열렸다 (' + opened + ')');
          report.push({ size: s.id, shot: sh.name, opened: false, note: String(opened) });
          continue;
        }
        await settle(p);
        await sleep(300);
        const m = await p.eval(PROBE);
        const f = join(OUT, s.id, sh.name + '.png');
        mkdirSync(dirname(f), { recursive: true });
        await p.shot(f);
        await saveSidecar(p, f, { ready: true, probe: m, why: sh.why });
        const tap = (m.under || []).filter(u => u.tappable);
        const png = String(m.faceUrl || '').match(/portrait_[a-z_]+\.png/);
        console.log('    ✓ ' + sh.name.padEnd(6)
          + ' 얼굴 ' + (m.face ? m.face.w + '×' + m.face.h : '없음')
          + ' · ' + (png ? png[0] : (m.noface ? 'noface' : '그림없음'))
          + (tap.length ? '  ⚠ 누를 것 ' + tap.length + '개를 덮는다' : ''));
        seenPng.push(png ? png[0] : (m.noface ? '(noface)' : '(없음)'));
        report.push({ size: s.id, shot: sh.name, ...m });
      }
      if (seenPng.length > 1 && new Set(seenPng).size === 1) {
        console.error('  ⛔⛔ ' + s.id + ': ' + seenPng.length
          + '장이 «전부 같은 그림»이다 (' + seenPng[0] + ')');
        console.error('     ⇒ 대사가 «안 바뀐» 것이다. 이 판의 그림은 «믿지 말 것».');
        report.push({ size: s.id, sameShotWarning: seenPng });
      }
    } catch (e) {
      console.error('  ✗ ' + s.id + ': ' + e.message);
      report.push({ size: s.id, error: e.message });
    } finally { try { p && await p.close(); } catch { } }
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1), 'utf8');
  console.log('\n적었다: ' + join(OUT, 'report.json'));
  console.log('⛔ 그림만 보고 「가렸다」고 적지 말 것 — report.json 의 `under` 가 «누가 밑에 있나»를 말한다.');
  if (!report.some(r => r.face)) {
    console.error('⛔ 한 장도 못 찍었다.');
    process.exit(3);          // ★ 「아무것도 안 했는데 0 으로 끝나는 것」을 막는다
  }
}

run();
