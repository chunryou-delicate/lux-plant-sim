/* 사람이 화면에서 **몇 픽셀인가** — 화면 크기 × 서 있는 자리로 «재서» 표를 만든다.
 *
 * 2026-08-30 밤 · [Char]
 *
 * ■ ⛔ 왜 «또» 재나 — 내가 세 번 셈해서 세 번 틀렸다
 *
 *     1차  거리·화각을 코드에서 읽어 셈  ⇒ [core] 실측의 «2배»
 *     2차  같은 식에 실측값을 넣어도     ⇒ 여전히 «2배»
 *     3차  실측 «한 점»에서 화면비로 늘림 ⇒ «2.5배» (98 이라 했는데 248 이었다)
 *
 * > ★★★ 세 번 다 같은 뿌리다 — **「한 점을 재고 나머지를 «셈»으로 채운다」.**
 * > ⇒ ⇒ 그래서 이 자는 **셈을 «한 번도» 안 한다. 자리마다 «걸어가서 찍는다».**
 *
 * ■ ⛔⛔ **「치웠다 세우기」를 버렸다 — 그 자가 «그럴듯한 거짓»을 냈다**
 *
 * 처음엔 `setCharacter(null)` 로 사람을 치우고 두 장을 견줬다.
 * ⇒ ⛔ **폭이 «916px» 로 나왔다.** 사람일 리 없다.
 *   그리고 자리를 바꿔도 키가 «안 변했다»(310·300·304) — 앞서 3.6배를 봤는데.
 * ⇒ ★ 까닭: `setCharacter(null)` 은 **「놓인 것을 «전부» 치운다」** — 몬이도, 그림자도.
 *   ⇒ ⇒ ★★ 그러니 「다른 화소」가 «사람»이 아니라 «방이 다시 그려진 것»이었다.
 *
 * > ★★★ **다행히 «폭»을 같이 찍어서 잡았다.** 키만 찍었으면 310px 을 그대로 냈을 것이다.
 * > ⇒ ⇒ **재는 자에 「말이 되나」를 보는 칸을 «같이» 두어야 한다.**
 *
 * ■ ✔ 그래서 — **게임에게 «묻는다». [core] 가 `hipsY` 를 붙여 주었다(91afd4c)**
 *
 *     characters()[i].hipsY   Hips 뼈의 «월드» y (m)
 *     ⇒ ★ 자리를 옮기며 hipsY 와 pos.y 를 읽고, 그 «세계 거리»를 화면에서 재면
 *       화면 픽셀 키가 나온다 — ⛔ 그런데 그것도 «셈»이다.
 *     ⇒ ⇒ ★★ 그래서 **찍은 그림에서 «자로» 잰다.** 다만 «사람만» 잡는 법으로:
 *       사람을 «걸어가게» 하고 «움직이는 동안 두 장»을 찍는다 — 방은 안 움직인다.
 *
 * ⚠⚠ 처음에 `rv.screenPosOf(x, y, z)` 로 하려 했다. ⛔ 그건 **`screenPosOf(slotId)`** 다 —
 *   «슬롯 id»를 받지 세계좌표를 안 받는다. ⇒ ★ **또 이름만 보고 넘겨짚었다**(오늘 두 번째).
 *
 * ■ ⛔ 이 자가 «못» 하는 것
 *
 *   · 「몇 px 이면 옷 모양이 보이나」는 못 정한다. **수만 낸다**
 *   · 사람이 «실제로 그 자리에 얼마나 서 있나»는 모른다 — 자리를 «내가» 정해 준 것이다
 */
import { launch } from '../test_cdp.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

/* 두 그림의 «다른 화소»가 감싸는 네모를 낸다. 파이썬(PIL)에게 시킨다 —
   node 에 그림 라이브러리를 들이지 않으려는 것이다. */
function diffHeight(a, b, dpr) {
  const py = `
import sys, warnings; warnings.filterwarnings('ignore')
from PIL import Image
import numpy as np
A = np.asarray(Image.open(sys.argv[1]).convert('RGB'), float)
B = np.asarray(Image.open(sys.argv[2]).convert('RGB'), float)
if A.shape != B.shape: print(''); sys.exit()
d = np.abs(A - B).mean(axis=2)
ys, xs = np.nonzero(d > 18)
if not len(ys): print('')
else: print('%d %d' % (xs.max()-xs.min()+1, ys.max()-ys.min()+1))
`;
  try {
    const r = execFileSync('python', ['-c', py, a, b], { encoding: 'utf8' }).trim();
    if (!r) return null;
    const [w, h] = r.split(/\s+/).map(Number);
    return { w: Math.round(w / dpr), h: Math.round(h / dpr) };   // CSS px 로
  } catch (e) { return null; }
}

const BASE = process.env.BYEOT_URL || 'http://localhost:8000';
const OUT = join('_out', 'char_px');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 화면 — 세로 셋 + PC. ⚠ 가로는 [Plan] 이 「안 보는 자리」로 판정했다(README §10-2) */
const SIZES = [
  { id: '320x568', w: 320, h: 568, dpr: 2 },
  { id: '390x844', w: 390, h: 844, dpr: 3 },
  { id: '430x932', w: 430, h: 932, dpr: 3 },
  { id: '1920x1080', w: 1920, h: 1080, dpr: 1 },
];

/* 자리 — 방 안쪽(먼 데) · 가운데 · 앞쪽(가까운 데).
   ⚠ 좌표는 방 크기에서 받아 온다. 손으로 박으면 방이 바뀔 때 낡는다. */
const SPOTS = [
  { key: '안쪽', t: 0.80 },      // 카메라에서 먼 쪽
  { key: '가운데', t: 0.50 },
  { key: '앞쪽', t: 0.15 },      // 카메라에 가까운 쪽
];

const H_M = 1.40;                // 자취녀 키(m) — [leaf] 실측, manifest 에 있다

async function main() {
  console.log('여는 곳: ' + BASE + '/game.html');
  const rows = [];
  for (const s of SIZES) {
    let p = null;
    try {
      p = await launch({ width: s.w, height: s.h, dpr: s.dpr });
      await p.goto(BASE + '/game.html');
      try { await p.waitFor('!!window.__rv', 240000, 400); }
      catch { console.log('  ⚠ ' + s.id + ' 부팅 표시 못 봄'); continue; }
      await p.eval("window.__rv.setCharacter('jachwi').then(()=>'ok').catch(e=>'e')");
      await sleep(1500);

      /* ⚠ 몬이를 «안» 세운다 — 사람 뒤에 붙어 있어 차이에 같이 잡힌다 */
      const room = JSON.parse(await p.eval('JSON.stringify(window.__rv.roomSize())'));
      console.log('\n■ ' + s.id + '  (방 ' + JSON.stringify(room) + ')');

      for (const sp of SPOTS) {
        /* 방 깊이(z)를 t 로 나눠 자리를 잡는다 */
        const z = (room.d ? (-room.d / 2 + room.d * sp.t) : (-1 + 2 * sp.t));
        const x = 0;
        const w = await p.eval('(()=>{ const v = window.__rv.walkTo(' + x + ', ' + z + ');'
          + " return (v&&v.then) ? v.then(()=>'ok').catch(e=>'ERR '+e.message) : String(v); })()");
        await sleep(4500);
        const pos = JSON.parse(await p.eval('(()=>{ const c=(window.__rv.characters()||[])'
          + ".find(c=>c.id==='jachwi'); return JSON.stringify(c?c.pos:null); })()"));

        mkdirSync(join(OUT, s.id), { recursive: true });
        const fA = join(OUT, s.id, sp.key + '_a.png');
        const fB = join(OUT, s.id, sp.key + '_b.png');
        /* ★ 사람만 «움직이는» 두 순간을 찍는다 — 방은 안 움직인다.
           ⇒ 걷는 중에 두 장. 그 차이가 «사람이 지나간 자리»다. */
        await p.eval('window.__rv.walkTo(' + (x + 0.9) + ', ' + z + ')');
        await sleep(250);
        await p.shot(fA);
        await sleep(700);
        await p.shot(fB);
        await sleep(2500);

        const px = diffHeight(fA, fB, s.dpr);
        if (px == null) { console.log('  ' + sp.key + ': 차이를 못 찾음 (' + w + ')'); continue; }

        /* ★★ 관문 — 「말이 되나」. 사람은 «세로로 긴» 것이다.
           ⛔ 폭이 키보다 크면 사람이 아니다(앞서 916px 이 그랬다). */
        /* ⚠⚠ 처음에 «1.6배»로 뒀다. ⛔ 너무 헐거웠다 —
           390×844 에서 「키 310 · 폭 317」이 «통과»했다. 사람 폭이 키와 같을 리 없다.
           ⇒ ★ 사람은 대략 폭:키 = 1:2.5 다. 0.7 로 죈다.
           ⇒ ⇒ ★★ 관문을 «통과했는데도 틀린» 것이 이 자의 두 번째 거짓말이었다. */
        const sane = px.h > 8 && px.w <= px.h * 0.7;
        console.log('  ' + sp.key.padEnd(5) + ' z=' + z.toFixed(2).padStart(6)
          + '  키 ' + String(px.h).padStart(4) + ' px · 폭 ' + String(px.w).padStart(4)
          + (sane ? '   ✔' : '   ⛔ 폭이 키보다 크다 — «사람이 아니다». 이 칸은 버린다'));
        if (!sane) continue;
        rows.push({ size: s.id, spot: sp.key, z: +z.toFixed(3),
                    px: px.h, pxw: px.w, pct: +(px.h / s.h * 100).toFixed(2), pos });
      }
    } catch (e) { console.error('  ✗ ' + s.id + ': ' + e.message); }
    finally { try { p && await p.close(); } catch { } }
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'char_px.json'), JSON.stringify(rows, null, 1), 'utf8');
  console.log('\n적었다: ' + join(OUT, 'char_px.json') + '  (' + rows.length + '칸)');
  console.log('⛔ 이 표는 «잰 것»이다. ★ 사이를 셈으로 메우지 말 것 — 세 번 다 2배 틀렸다.');
  if (!rows.length) process.exit(3);
}

main();
