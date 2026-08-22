/* ============================================================
   test_no_ghost_checks.mjs — 「떨어질 수 없는 검사」를 잡는다 ([growth] 소유)
   ------------------------------------------------------------
   ★ 왜 이 파일이 있나 (2026-08-23)

   검사 80개를 훑다가 **조건 자리에 `true` 가 박힌 단언 넷**을 찾았다.
   무슨 일이 있어도 초록이라 **검사인 척하는 자리**다.

     ok('옛 세이브는 … 로 열린다', true)        ← 아무것도 안 잰다
     } else ok('★★ 대사가 없어 바로 떴다', true) ← 「건너뛴 것」을 「통과」로 찍는다

   ⚠ 둘은 같은 병이 아니다.
     · 앞엣것 — 바로 위 줄이 진짜로 재고 있어 **커버리지 손실은 없다. 통과 수만 부풀린다**
     · 뒤엣것 — 조건이 안 맞아 **못 잰 것**인데 초록으로 보인다.
       ★ 이쪽이 나쁘다. **「건너뜀」이라는 갈래가 없는 것**이 병이다

   ⇒ 그래서 **막기만 하지 않는다.** 막기만 하면 `assert.ok(true)` 로 우회한다.
     **갈 곳을 만든다** — 건너뛸 때는 `skip(이름, 왜 건너뛰나)` 를 쓴다.
     이 검사는 `skip` 을 **허용하고 따로 센다.** 통과 수에 안 섞이면 화면에서 보인다.

   ★ 글자로 훑지 않는다 (§2.9 ⑮ — 글자로 훑으면 내가 겨눈 것 말고 다른 게 잡힌다).
     실제로 처음 쓴 정규식이 `assert.ok(a > f(low, 1),` 의 **안쪽 인자 `, 1)` 을 잡았다.
     그래서 **괄호를 세어 인자를 실제로 가른다.** 문자열·주석·템플릿 안은 안 본다.

     node tools/test_no_ghost_checks.mjs
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'tools');

/* 단언 이름들 — 이 저장소의 검사들이 실제로 쓰는 것 (파일마다 자기 ok 를 만들어 쓴다) */
const ASSERT_CALLS = ['ok', 'assert.ok', 'check', 't'];
/* 건너뛸 때 쓰라고 만든 갈래. 잡지 않고 따로 센다. */
const SKIP_CALLS = ['skip'];

/* ── 주석·문자열을 공백으로 덮는다. 자리(offset)는 그대로 둬야 줄 번호가 안 밀린다 ── */
function blankOutNonCode(src) {
  const out = src.split('');
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') { out[i] = ' '; i++; } continue; }
    if (c === '/' && d === '*') {
      out[i] = out[i + 1] = ' '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] !== '\n') out[i] = ' '; i++; }
      if (i < n) { out[i] = out[i + 1] = ' '; i += 2; }
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out[i] = ' '; i++;
      while (i < n) {
        if (src[i] === '\\') { out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
        if (src[i] === q) { out[i] = ' '; i++; break; }
        if (src[i] !== '\n') out[i] = ' ';
        i++;
      }
      continue;
    }
    i++;
  }
  return out.join('');
}

/* ── 여는 괄호에서 짝을 찾아 인자를 가른다. 괄호를 실제로 센다 ── */
function splitArgs(code, openIdx) {
  let depth = 0, start = openIdx + 1;
  const args = [];
  for (let i = openIdx; i < code.length; i++) {
    const c = code[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) { args.push(code.slice(start, i)); return { args, end: i }; }
    } else if (c === ',' && depth === 1) { args.push(code.slice(start, i)); start = i + 1; }
  }
  return null;                                  // 짝이 안 맞는다 — 안 본다
}

/* ── 이름 앞이 식별자 문자면 다른 함수다(`lookOk(` 등). 그런 것은 거른다 ── */
function findCalls(code, name) {
  const hits = [];
  const plain = name.split('.').pop();
  let from = 0;
  for (;;) {
    const i = code.indexOf(plain + '(', from);
    if (i < 0) break;
    from = i + 1;
    const before = code[i - 1];
    if (before && /[A-Za-z0-9_$]/.test(before)) continue;              // 이름의 꼬리
    if (name.includes('.') && code.slice(0, i).trimEnd().slice(-(name.length - plain.length)) !== name.slice(0, -plain.length)) {
      /* assert.ok — 앞이 정확히 'assert.' 여야 한다 */
      if (code.slice(Math.max(0, i - 7), i) !== 'assert.') continue;
    } else if (before === '.') continue;                               // obj.ok( — 우리 것이 아니다
    hits.push(i + plain.length);                                       // 여는 괄호 자리
  }
  return hits;
}

const ALWAYS_TRUE = /^\s*(true|1|!0|!!1)\s*$/;
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

const ghosts = [];
const skips = [];
const files = fs.readdirSync(DIR).filter(f => /^test_.*\.mjs$/.test(f)).sort();

for (const f of files) {
  if (f === path.basename(fileURLToPath(import.meta.url))) continue;   // 자기 자신은 안 본다
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const code = blankOutNonCode(src);
  for (const name of ASSERT_CALLS) {
    for (const open of findCalls(code, name)) {
      const cut = splitArgs(code, open);
      if (!cut || cut.args.length < 2) continue;                       // 인자 하나짜리는 조건이 없다
      /* 조건 자리 — 이 저장소의 ok/check 는 (이름, 조건, …) 꼴이다 */
      const cond = cut.args[1];
      if (!ALWAYS_TRUE.test(cond)) continue;
      ghosts.push({ f, line: lineOf(src, open), call: name,
                    text: src.split('\n')[lineOf(src, open) - 1].trim().slice(0, 96) });
    }
  }
  for (const name of SKIP_CALLS)
    for (const open of findCalls(code, name))
      skips.push({ f, line: lineOf(src, open) });
}

/* ── 보고 ─────────────────────────────────────────────────────────────── */
console.log(`검사 ${files.length - 1}개를 봤다 (자기 자신 제외).\n`);

if (skips.length) {
  console.log(`건너뜀 ${skips.length}건 — 통과 수에 안 넣는다. 이건 병이 아니다:`);
  for (const s of skips) console.log(`  ${s.f}:${s.line}`);
  console.log('');
}

if (ghosts.length) {
  console.log(`★ 떨어질 수 없는 단언 ${ghosts.length}건 — 조건 자리에 상수가 박혀 있다:\n`);
  for (const g of ghosts) console.log(`  ${g.f}:${g.line}\n     ${g.text}`);
  console.log(`
  ⇒ 고치는 법은 자리마다 다르다. **갈라 보라.**
     · 바로 위·아래에서 이미 재고 있다면 → **그 줄을 지운다.** 통과 수만 부풀리고 있다
     · 조건이 안 맞아 못 잰 것이라면    → **skip(이름, 왜 건너뛰나)** 로 바꾼다.
                                          이 검사가 그것은 따로 세고 통과로 안 친다
     ⚠ assert.ok(true) 로 우회하지 말 것 — 그것도 여기서 잡힌다.
       「건너뛴 것」이 「통과」로 보이면 다음 사람이 그 자리를 다 재어진 것으로 읽는다.`);
}

console.log(`\nno_ghost_checks: ${ghosts.length ? `FAIL (${ghosts.length}건)` : 'PASS'}`);
process.exitCode = ghosts.length ? 1 : 0;
