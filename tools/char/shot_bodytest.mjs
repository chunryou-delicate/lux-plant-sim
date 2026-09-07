/* 기존 클립(A포즈로 구운 것)을 «새 T포즈 맨몸»에 얹어 «살 접힘»을 볼 그림을 찍는다.
 *
 * 2026-09-07 · [Char] · 크레딧 0
 *
 * ■ ⛔⛔ 두 번 물리고 이 꼴이 되었다 — 그대로 적는다
 *
 *   ① 2.5초만 기다리고 찍었다 ⇒ 19MB 로딩이 안 끝나 **직전 몸이 찍혔다.** 그림이 «한 칸» 밀렸다
 *      ⇒ ★ 오늘 대사창에서 겪은 것과 «같은 것»이다(#dlgSkip 없이 찍어 4장이 같은 프레임).
 *        ⇒ ⇒ ⛔ 그때 만든 「같은 그림 잡아내는 자」를 이번엔 «안 넣었다».
 *   ② 기다림을 넣었더니 이번엔 **두 몸이 «겹쳐» 찍혔다.**
 *      뷰어는 갈아끼울 때 앞엣것을 지우는데, 로드가 «겹치면» 늦게 끝난 쪽이 V.root 를 덮어
 *      앞엣것이 씬에 남는다. ⇒ 옷 입은 몸과 흰 맨몸이 한 화면에 같이 섰다.
 *
 * > ★★★ 그래서 **한 장마다 페이지를 «새로 연다».** 느리지만 겹칠 «자리»가 없다.
 * > ⇒ ⇒ 기다림을 길게 하는 것으로는 못 막는다 — 앞엣것이 «언제» 끝나는지 모르기 때문이다.
 *
 * ⛔ 이 자는 «판정하지 않는다». 그림만 낸다 — 판정은 눈이 한다.
 */
import { launch } from '../test_cdp.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const BASE = process.env.BYEOT_URL || 'http://localhost:8000';
const URL = BASE + '/assets/characters/_bodytest_compare.html';
const OUT = join('docs', 'handoff', 'img', 'bodytest');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CLIPS = ['idle', 'cheer'];              // 서 있는 것 · 팔이 머리 위로 가는 것
const WHO = [['char_jachwi_f', '기존'], ['char_bodytest', '새몸']];

/* 그 파일이 «받아졌나»를 브라우저에게 묻는다 */
async function waitLoaded(p, want) {
  for (let i = 0; i < 45; i++) {
    await sleep(700);
    const n = await p.eval('JSON.stringify(performance.getEntriesByType("resource")'
      + '.filter(e=>e.name.includes(' + JSON.stringify(want) + ') && e.responseEnd>0).length)');
    if (JSON.parse(n) > 0) return true;
  }
  return false;
}

/* 캔버스 자리가 «거의 단색»이면 사람이 안 그려진 것이다 */
function emptyCanvas(f) {
  const py = [
    'import sys',
    'from PIL import Image',
    'import numpy as np',
    'a=np.asarray(Image.open(sys.argv[1]).convert("RGB"),float)',
    'h,w,_=a.shape',
    'c=a[int(h*0.20):int(h*0.75), int(w*0.05):int(w*0.45)]',
    /* ⚠ 문턱 6.0 은 «흰 맨몸»을 「비었다」로 잘못 읽었다(거짓 경보). 2.0 으로 내린다 */
    'print(1 if c.std()<2.0 else 0)',
  ].join(String.fromCharCode(10));
  try { return execFileSync('python', ['-c', py, f], { encoding: 'utf8' }).trim() === '1'; }
  catch { return false; }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const c of CLIPS) {
    for (const [key, ko] of WHO) {
      const p = await launch({ width: 1200, height: 760, dpr: 2 });
      try {
        await p.goto(URL);
        await p.waitFor('!!document.getElementById("pick") && document.getElementById("pick").options.length>0', 60000, 300);
        /* ★ 페이지가 «스스로» 첫 캐릭터(기존 자취녀)를 싣는다. 그것부터 기다린다.
           ⚠ 기본과 «같은 것»을 다시 고르면 지우고 다시 싣느라 «빈 화면»이 찍힌다 —
             2026-09-07 에 그렇게 한 장을 버렸다. */
        await waitLoaded(p, '3d/char_jachwi_f_rigged.glb');
        await sleep(1500);

        const r = await p.eval('(()=>{ try {'
          + ' const pk=document.getElementById("pick"), cl=document.getElementById("clip");'
          + ' pk.value=' + JSON.stringify(key) + '; pk.onchange();'
          + ' if(![...cl.options].some(o=>o.value===' + JSON.stringify(c) + '))'
          + '   return JSON.stringify({ok:false,reason:"클립 없음"});'
          + ' cl.value=' + JSON.stringify(c) + '; cl.onchange();'
          + ' return JSON.stringify({ok:true});'
          + ' } catch(e){ return JSON.stringify({ok:false,reason:e.message}); } })()');
        const v = JSON.parse(r);
        if (!v.ok) { console.log('  ' + c + '/' + ko + ': ⛔ ' + v.reason); continue; }

        const want = key === 'char_bodytest'
          ? '_bodytest/body_female_t1_rigged.glb' : '3d/' + key + '_rigged.glb';
        const ok = await waitLoaded(p, want);
        await sleep(4000);
        const err = await p.eval('document.getElementById("err").textContent');
        const f = join(OUT, c + '_' + (key === 'char_bodytest' ? 'new' : 'old') + '.png');
        await p.shot(f);
        /* ★★ 「말이 되나」 칸 — 사람이 «안 그려졌으면» 캔버스가 거의 단색이다 */
        const flat = emptyCanvas(f);
        console.log('  ' + c.padEnd(7) + '/' + ko + '  ' + (ok ? '' : '⚠ 못 받음 ')
          + (err ? '⚠ ' + err : '✔') + (flat ? '  ⛔⛔ 그림이 «비었다» — 아무도 안 그려졌다' : '')
          + '  → ' + f);
      } catch (e) { console.error('  ✗ ' + c + '/' + ko + ': ' + e.message); }
      finally { try { await p.close(); } catch {} }
    }
  }
  console.log('\n⛔ 이 자는 판정하지 않는다. ★ 그림을 «눈으로» 볼 것.');
}
main();
