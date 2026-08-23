/* ============================================================
   tools/check_doc_links.mjs — **문서가 가리키는 자가 실재하나** (house 신설)
   ------------------------------------------------------------
   2026-08-23. 시작은 작았다 — 내 임시 도구를 지우려다 이걸 봤다:
     `docs/engine/slot_cell_align.md`(정본)가 *"잰 자는 여기 있다"* 로 가리키는 파일이
     **미추적**이었다. ⇒ **정본이 없는 파일을 증거로 대고 있었다.**
   ⇒ 훑어 보니 **나만 그런 게 아니었다.** 문서가 가리키는데 **파일이 아예 없는 것**이 여럿이고,
     `src/game/propagation.js` 같은 **코드 주석**도 없는 파일을 가리킨다.

   ★ 왜 아픈가 — 이 저장소는 **「왜 그 값인가」를 자(도구)로 증명해 온 곳**이다.
     자가 사라지면 **값은 남고 근거만 사라진다.** 그러면 다음 사람은
     **「믿거나 다시 재거나」** 둘 중 하나인데, 대개 믿는다.

   무엇을 보나
     `tools/...` 로 적힌 곳을 전부 모아 **① 파일이 있나 ② git 이 아나** 를 본다.
       없음    ⇒ ★ 가리키는데 **없다.** 지워졌거나 이름이 바뀌었다
       미추적  ⇒ ⚠ 있지만 **남의 컴퓨터에는 없다.** 커밋 안 됐다
   ⚠ **판정하지 않는다.** 「지워라」도 「커밋해라」도 안 한다 — 어느 쪽이 맞는지는
     그 문서를 쓴 창이 안다. **여기서는 「가리키는데 없다」만 말한다.**
   ⚠ `_` 로 시작하는 임시 도구를 문서가 가리키는 것 자체는 잘못이 아니다 —
     **그 문서가 「임시 도구」라고 같이 적었다면** 읽는 사람이 안다. 그것까지는 못 가른다.

     node tools/check_doc_links.mjs
     node tools/check_doc_links.mjs --owner house    (그 이름이 든 문서만)
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ONLY = (process.argv.find(a => a.startsWith('--owner=')) || '').split('=')[1] || null;

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) walk(rel, out);
    else if (/\.(md|js|mjs|html)$/.test(e.name)) out.push(rel);
  }
  return out;
};
const files = [...walk('docs'), ...walk('src'), 'game.html', 'index.html']
  .filter(f => fs.existsSync(path.join(ROOT, f)));

const tracked = new Set(execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n'));
const hits = new Map();                       // 대상 → 가리키는 곳들
for (const f of files) {
  let txt = '';
  try { txt = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { continue; }
  if (ONLY && !txt.includes(ONLY)) continue;
  for (const m of txt.matchAll(/tools\/[_a-zA-Z0-9]+\.(?:mjs|html|py|js)/g)) {
    const t = m[0];
    if (!hits.has(t)) hits.set(t, new Set());
    hits.get(t).add(f);
  }
}

const gone = [], untracked = [];
for (const [t, from] of [...hits].sort()) {
  const exists = fs.existsSync(path.join(ROOT, t));
  if (!exists) gone.push([t, [...from]]);
  else if (!tracked.has(t)) untracked.push([t, [...from]]);
}
const show = (title, rows, mark) => {
  console.log('');
  console.log(title + ' — ' + rows.length + '개');
  for (const [t, from] of rows)
    console.log('  ' + mark + ' ' + t.padEnd(38) + ' ← ' + from.slice(0, 3).join(' · ') +
                (from.length > 3 ? ' … 그 밖 ' + (from.length - 3) : ''));
};
console.log('문서·코드가 가리키는 tools/ 경로 ' + hits.size + '군데를 봤다.');
show('★ 가리키는데 «없다»', gone, '✖');
show('⚠ 있지만 «커밋 안 됐다» (남의 컴퓨터에는 없다)', untracked, '△');
console.log('');
console.log('⚠ 판정하지 않는다 — 지울지 커밋할지는 그 문서를 쓴 창이 안다.');
console.log('   여기서는 「가리키는데 없다」만 말한다.');
process.exit(gone.length ? 1 : 0);
