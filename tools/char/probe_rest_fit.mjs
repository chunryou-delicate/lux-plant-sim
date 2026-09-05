/* 앉기·눕기가 **가구에 맞나**를 «미터로» 잰다.
 *
 * 2026-08-30 밤 · [Char]
 *
 * ■ 왜
 *
 * `docs/handoff/img/nap_sit.png` · `nap_sleep.png` · `nap_nap.png` 를 눈으로 보니
 * **앉은 사람이 의자 뒤에 떠 있고, 누운 사람이 침대 위로 떠서 축이 어긋나** 보였다.
 * ⇒ ⛔ **「보인다」로는 못 고친다.** 총괄 청: **「어긋나면 «어느 축 몇 m» 인지」.**
 *
 * ■ ★ 무엇을 재나 — 게임이 «이미 미터로» 갖고 있다. 셈하지 않고 «받아 온다»
 *
 *     rv.characters()  → { id, pos:{x,y,z}, yaw, ground:{ y, target, clips:{이름:값} } }
 *     rv.furniture()   → { uid, preset, size:{w,h,d}, x, y, z, rot }
 *     rv.actAt(가구uid, 'sit'|'sleep')   ⚠ 첫 인자는 «가구 uid» 다 (game.html:14956)
 *
 * ⇒ ★★ `ground.clips[클립이름]` 이 **그 클립의 바닥 보정값**이다. 「뜸」이 여기 있다.
 *
 * ■ ⚠ 이 자를 만들며 두 번 죽었다 — 다음 사람이 안 겪게 적는다
 *
 *   ① `setCharacter()` 는 «three 객체를 담은 약속»을 돌려준다
 *      ⇒ ⛔ 그대로 받으면 CDP 가 「Object reference chain is too long」으로 죽는다
 *      ⇒ ★ **모든 eval 이 «원시값»만 내게 한다.** `.then(()=>'ok')` 로 감싼다
 *   ② `actAt` 의 첫 인자를 «캐릭터 키»로 줬다 ⇒ 「모르는 슬롯: jachwi」
 *      ⇒ 서명은 `actAt(key, kind, opt)` 인데 그 `key` 가 «가구 uid» 다
 *      ⇒ ⇒ ★ **이름만 보고 넘겨짚었다.** 호출부(game.html:14956)를 봤어야 했다
 *
 * ■ ⛔ 이 자가 «못» 하는 것
 *
 *   「얼마나 어긋나야 흠인가」는 못 정한다. **수만 낸다.**
 *   그리고 「보기 싫은가」는 28×68px 에서 봐야 한다 — 이 자는 «미터»를 잰다. 다른 물음이다.
 */
import { launch } from '../test_cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BYEOT_URL || 'http://localhost:8000';
const OUT = join('_out', 'rest_fit');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 앉을 것·누울 것을 preset 으로 고른다. ⚠ uid 를 손으로 박으면 방이 바뀔 때 낡는다. */
const WANT = [
  { act: 'sit', match: /chair|stool/i, ko: '앉기' },
  { act: 'sleep', match: /bed/i, ko: '눕기' },
];

const CHAR = "(window.__rv.characters()||[]).find(c=>c.id==='jachwi')||null";

async function main() {
  console.log('여는 곳: ' + BASE + '/game.html');
  const p = await launch({ width: 1280, height: 800, dpr: 1 });
  const out = [];
  try {
    await p.goto(BASE + '/game.html');
    try { await p.waitFor('!!window.__rv', 240000, 400); }
    catch { console.error('⛔ 부팅 표시 못 봄'); process.exit(3); }

    console.log('사람 세우는 중 … ' + await p.eval(
      "window.__rv.setCharacter('jachwi').then(()=>'ok').catch(e=>'ERR '+e.message)"));
    await sleep(1500);

    const furn = JSON.parse(await p.eval('JSON.stringify(window.__rv.furniture())'));
    console.log('\n■ 가구 — 게임이 «미터로» 갖고 있는 값');
    /* ⚠⚠ node 의 console.log 는 `%-20s` · `%4.2f` 같은 «폭·정밀도»를 안 받는다.
       ⇒ 글자 그대로 찍힌다. ★ 나는 `check_face_reach` 에서 이미 겪고 고쳐 놓고 «또» 했다.
         ⇒ padEnd/toFixed 로 «내가» 맞춘다. */
    for (const f of furn)
      console.log('  ' + f.uid.padEnd(24) + f.preset.padEnd(20)
        + [f.size.w, f.size.h, f.size.d].map(v => v.toFixed(2)).join(' × ') + ' m'
        + '   자리 (' + [f.x, f.y, f.z].map(v => v.toFixed(2)).join(', ') + ')'
        + '  rot ' + f.rot);
    out.push({ what: 'furniture', data: furn });

    for (const w of WANT) {
      const f = furn.find(x => w.match.test(x.preset) || w.match.test(x.uid));
      console.log('\n■ ' + w.ko + ' (' + w.act + ')');
      if (!f) { console.log('  ⛔ 맞는 가구가 없다'); continue; }

      const r = await p.eval('(()=>{ const v = window.__rv.actAt('
        + JSON.stringify(f.uid) + ', ' + JSON.stringify(w.act) + ', {});'
        + " return (v&&v.then) ? v.then(()=>'ok').catch(e=>'ERR '+e.message) : String(v); })()");
      console.log('  actAt(%s, %s) → %s', f.uid, w.act, r);

      /* ★ 걸어가서 앉는다 — 도착까지 기다리고 «여러 프레임» 잰다(클립이 돈다) */
      await sleep(6000);
      const frames = [];
      for (let i = 0; i < 6; i++) {
        frames.push(JSON.parse(await p.eval('JSON.stringify(' + CHAR + ')')));
        await sleep(500);
      }
      const cs = frames.filter(Boolean);
      if (!cs.length) { console.log('  ⛔ 사람을 못 찾았다'); continue; }

      /* ⚠⚠ 처음에 `f.y + f.size.h` 를 「앉는 면」이라 썼다. ⛔ 틀렸다 —
         `size.h` 는 «가구 전체 높이»다(의자 등받이 · 침대 헤드보드 포함).
         의자 0.89 는 «등받이 꼭대기»고 앉는 면이 아니다.
         ⇒ ★ 그래서 「높이 차 −0.89」 같은 «뜻 없는 수»가 나왔다.
           ⇒ ⇒ ★★ 오늘 세 번째로 «자를 다른 물건에 댔다».
         ⇒ ✔ 게임이 `surfaceTopAt(x, z)` 를 갖고 있다. **그것을 쓴다 — 셈하지 않는다.** */
      const top = await p.eval('(()=>{ try { const v = window.__rv.surfaceTopAt('
        + f.x + ', ' + f.z + '); return (typeof v === "number") ? v'
        + ' : (v && typeof v.y === "number") ? v.y : JSON.stringify(v); }'
        + " catch(e){ return 'ERR ' + e.message; } })()");
      const ys = cs.map(c => c.pos.y);
      const gy = cs.map(c => (c.ground && c.ground.y) || 0);
      const clips = cs[cs.length - 1].ground && cs[cs.length - 1].ground.clips;
      const dx = cs[0].pos.x - f.x, dz = cs[0].pos.z - f.z;

      const sgn = v => (v >= 0 ? '+' : '') + v.toFixed(3);
      const num = typeof top === 'number';
      console.log('  앉는/눕는 면 y = ' + (num ? top.toFixed(3) + ' m' : String(top))
        + '   [surfaceTopAt — ★ 게임이 준 값. 셈 아님]');
      console.log('  가구 «전체» 높이 = ' + f.size.h.toFixed(2)
        + ' m  ⚠ 이건 등받이·헤드보드까지다. 앉는 면이 아니다');
      console.log('  사람 pos.y     = ' + Math.min(...ys).toFixed(3)
        + ' ~ ' + Math.max(...ys).toFixed(3) + ' m');
      if (num) console.log('  ★ 높이 차      = ' + sgn(Math.min(...ys) - top)
        + ' m   (+ 면 «떠 있다» · − 면 «박혔다»)');
      console.log('  ★ 자리 차      = x ' + sgn(dx) + ' · z ' + sgn(dz)
        + ' m   (가구 «중심» 대비)');
      console.log('  ground.y       = ' + Math.min(...gy).toFixed(4)
        + ' ~ ' + Math.max(...gy).toFixed(4) + ' · clips = ' + JSON.stringify(clips));
      console.log('  yaw = ' + cs[0].yaw.toFixed(3) + ' rad ('
        + (cs[0].yaw * 180 / Math.PI).toFixed(1) + '°) · 가구 rot = ' + f.rot);
      out.push({ what: w.act, furniture: f, top, frames: cs,
                 dyMin: Math.min(...ys) - top, dx, dz });
    }
  } finally { try { await p.close(); } catch { } }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'rest_fit.json'), JSON.stringify(out, null, 1), 'utf8');
  console.log('\n적었다: ' + join(OUT, 'rest_fit.json'));
  console.log('⛔ 이 자는 «수»만 낸다. 「얼마나 어긋나야 흠인가」는 사람이 정한다.');
  if (!out.some(o => o.what === 'sit' || o.what === 'sleep')) process.exit(3);
}

main();
