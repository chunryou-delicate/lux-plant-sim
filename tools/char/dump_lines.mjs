/* 대사를 **화자·낯별로 뽑아** 사람이 읽기 좋게 낸다.
 *
 * 2026-09-07 · [Char] · 크레딧 0
 *
 * ■ 왜
 *
 * [Plan] 이 「어느 줄이 어느 낯인가」를 정하려면 **줄을 읽어야** 한다.
 * 그런데 지금은 `dialogue.js` 2천 줄을 뒤져야 한다.
 * ⇒ ★ 한 낯이 지고 있는 줄을 **한자리에 모아** 준다. 그것뿐이다.
 *
 * ■ ⛔ 이 자가 «하지 않는» 것 — 여기가 중요하다
 *
 * **가르지 않는다.** 나는 오늘 [Plan] 이 준 «가르는 자»를 기계로 돌렸다가
 * **231줄을 「안 걸림」으로 남겼다.** `teach` 의 「«왜냐하면»이 숨어 있음」을
 * 기계가 못 본다 — 「무순은 반대야」와 「나는 몬이야」가 **글자로는 같은 꼴**이다.
 *
 * > ★★ 그래서 이 자는 **「볼 곳」만 모은다. 「답」을 내지 않는다.**
 *
 * ■ 쓰는 법
 *
 *     node tools/char/dump_lines.mjs moni            # 몬이 전부, 낯별로
 *     node tools/char/dump_lines.mjs jachwi base     # 자취녀의 base 만
 *     node tools/char/dump_lines.mjs moni --out docs/handoff/x.md
 */
import { SCRIPTS } from '../../src/game/dialogue.js';
import { writeFileSync } from 'node:fs';

/* ⚠⚠ 처음에 `--out` «뒤의 값»까지 자리 인자로 먹었다 ⇒ 그것이 «낯 이름»이 되어
     「낯 0가지」가 나왔다. ★ 오늘 `silhouette.py` 에서 «똑같이» 겪은 것이다.
   ⇒ ⇒ ★★ 이름 붙은 인자는 **값까지 «걷어내고»** 나머지를 자리 인자로 본다.
     ⇒ 다행히 자가 「낯 0가지」로 «소리를 냈다». 안 냈으면 16줄짜리를 넘길 뻔했다. */
let argv = process.argv.slice(2);
let outPath = null;
const outIdx = argv.indexOf('--out');
if (outIdx >= 0) {
  if (outIdx + 1 >= argv.length) throw new Error('--out 뒤에 파일 이름을 주십시오');
  outPath = argv[outIdx + 1];
  argv = argv.slice(0, outIdx).concat(argv.slice(outIdx + 2));   // ★ 값까지 걷는다
}
const pos = argv.filter(a => !a.startsWith('--'));
const who = pos[0] || 'moni';
const onlyFace = pos[1] || null;

const rows = [];
for (const [k, v] of Object.entries(SCRIPTS))
  v.forEach((l, i) => {
    if (l && l.who === who) rows.push({ k, i, face: l.face || 'base', t: String(l.text || '') });
  });

const by = {};
for (const r of rows) (by[r.face] = by[r.face] || []).push(r);
const faces = Object.keys(by).sort((a, b) => by[b].length - by[a].length)
  .filter(f => !onlyFace || f === onlyFace);

const L = [];
L.push('# ' + who + ' 대사 — 낯별로 모음');
L.push('');
L.push('자동 생성 · `tools/char/dump_lines.mjs` · 크레딧 0');
L.push('');
L.push('> ⛔ **이 자는 «가르지» 않는다. 「볼 곳」만 모은다.**');
L.push('> ⇒ 기계로 가르려다 231줄을 남긴 적이 있다 — 「무순은 반대야」와');
L.push('>   「나는 몬이야」가 «글자로는 같은 꼴»이다. 갈리는 것은 «뜻»이다.');
L.push('');
L.push('```');
L.push('전체 ' + rows.length + '줄 · 낯 ' + Object.keys(by).length + '가지');
for (const f of Object.keys(by).sort((a, b) => by[b].length - by[a].length))
  L.push('  ' + f.padEnd(10) + String(by[f].length).padStart(4) + '줄  '
    + (by[f].length / rows.length * 100).toFixed(0) + '%');
L.push('```');
L.push('');

for (const f of faces) {
  L.push('---');
  L.push('');
  L.push('## `' + f + '` — ' + by[f].length + '줄');
  L.push('');
  let cur = null;
  for (const r of by[f]) {
    if (r.k !== cur) { L.push(''); L.push('**' + r.k + '**'); cur = r.k; }
    L.push('- `[' + r.i + ']` ' + r.t);
  }
  L.push('');
}

const text = L.join('\n');
if (outPath) {
  writeFileSync(outPath, text, 'utf8');
  console.log('썼다: ' + outPath + '  (' + rows.length + '줄 · 낯 ' + faces.length + '가지)');
} else {
  console.log(text);
}
