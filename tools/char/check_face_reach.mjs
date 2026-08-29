/* 초상화가 **실제로 불리는가**를 센다.
 *
 * 2026-08-29 · [Char] 이 만들었다.
 *
 * ■ ★ 왜 만들었나 — 같은 자리를 두 번 밟았다
 *
 * 오늘 나는 「게임이 캐릭터 2종을 쓴다」고 셌다가 틀렸다. `CHAR_ASSET` **표에 적힌 것**을
 * 세고, **거기에 무엇이 들어오는지**는 안 봤다. 실제로 들어오는 값은 `'jachwi'` 하나였다.
 *
 *     ★★ 표를 세면 「쓸 «수 있는» 것」이 세어지고,
 *        호출부를 세야 「쓰는 것」이 세어진다.
 *
 * 초상화도 똑같은 모양이다. `FACE_FILE` 에 표정이 적혀 있어도, **그 표정을 쓰는 대사가
 * 안 도는 자리에 있으면** 그림은 영영 안 뜬다. 그래서 같은 자를 초상화에 댄다.
 *
 * ■ ★★ 이 자가 세는 길 — 다리가 넷이다
 *
 *     ① EVENT_SCRIPT          사건 이름 → 대사
 *     ② QUEST_OPEN/DONE_SCRIPT 퀘스트 → 대사
 *     ③ scriptOf 안의 가지     season · rent 는 «코드로» 갈린다 (표에 없다)
 *     ④ game.html 의 붙박이    dlgOpen('monsteraMoved') 처럼 이름을 직접 준다
 *     ⑤ CHATTER               작은 말은 pickChatter 가 고른다
 *
 * ⚠ ③④ 를 빼면 **멀쩡한 대사가 「안 불린다」로 찍힌다.** 처음에 그렇게 만들어서
 *   `autumnCame` 같은 것이 유령으로 나왔다.
 *
 * ■ ⛔ 이 자가 **못** 하는 것 — 여기가 중요하다
 *
 * 이 자는 「**부를 수 있는 길이 있나**」까지만 안다. 「**그 길을 실제로 걷나**」는 모른다.
 * 사건이 나야 대사가 뜨는데, 그 사건이 나는 조건은 이 자가 못 판정한다.
 * ⇒ ★ 그러므로 O 는 「닿는다」가 아니라 **「닿을 «길»은 있다」**까지다.
 *   ⛔ **이 자만 보고 「고장이다」라고 적지 말 것.** 실제로 돌려서 봐야 한다.
 *
 * ■ 쓰는 법
 *
 *     node tools/char/check_face_reach.mjs
 *     node tools/char/check_face_reach.mjs --selftest   # ★ 관문이 켜지나
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  SCRIPTS, EVENT_SCRIPT, QUEST_OPEN_SCRIPT, QUEST_DONE_SCRIPT, CHATTER,
} from '../../src/game/dialogue.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* ★ FACE_FILE 은 game.html 안에 있다(모듈이 아니다). 그 덩이만 떼어 읽는다.
   ⚠ 표를 손으로 옮겨 적으면 game.html 이 바뀔 때 «조용히» 낡는다. 그래서 읽어 온다. */
function readFaceFile() {
  const html = readFileSync(join(ROOT, 'game.html'), 'utf8');
  const i = html.indexOf('const FACE_FILE = {');
  if (i < 0) throw new Error('game.html 에서 FACE_FILE 을 못 찾았다 — 이름이 바뀌었나');
  let depth = 0, j = html.indexOf('{', i);
  for (let k = j; k < html.length; k++) {
    if (html[k] === '{') depth++;
    else if (html[k] === '}' && --depth === 0) { j = k; break; }
  }
  const body = html.slice(html.indexOf('{', i), j + 1);
  return (0, eval)('(' + body + ')');
}

/* ④ game.html 이 이름을 직접 주는 자리 */
function literalCalls() {
  const html = readFileSync(join(ROOT, 'game.html'), 'utf8');
  const out = new Set();
  for (const m of html.matchAll(/dlgOpen\(\s*'([A-Za-z][A-Za-z0-9_]*)'/g)) out.add(m[1]);
  for (const m of html.matchAll(/dlg\.push\(\s*'([A-Za-z][A-Za-z0-9_]*)'/g)) out.add(m[1]);
  return out;
}

/* ★★ 「아직 안 쓰는 대사」는 «흠»이 아니라 «상태»다 — 그 선언을 «읽어» 온다.
   ⚠ 안 읽으면 이 자가 매번 헛울음을 운다. 그러면 사람이 이 자를 안 보게 된다.
   ⇒ 실제로 `monsteraStalled` 가 그렇다 — [story2] 가 찾고 [Plan] 이 2026-08-29 에
     「원룸이 열릴 때 붙인다」로 «남기기로 정했다». 내가 오늘 그걸 다시 찾았을 뿐이다. */
function declaredUnused() {
  const src = readFileSync(join(ROOT, 'tools', 'test_dialogue_coverage.mjs'), 'utf8');
  const m = src.match(/NOT_YET_USED\s*=\s*new Set\(\[([^\]]*)\]/);
  if (!m) return new Set();      // ⚠ 없어지면 «빈 집합»이라 다시 울린다. 그게 맞다
  return new Set([...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]));
}

/* ③ scriptOf 안에서 «코드로» 갈리는 것. 표에 없으므로 손으로 적는다.
   ⚠ 손으로 적은 것은 낡는다. 그래서 dialogue.js 에 그 이름이 아직 있는지 «되짚는다». */
const BRANCHED = ['autumnCame', 'winterCame', 'rentFirst', 'rentAgain'];

/* ★ 표가 «일부러» 안 가리키는 그림. 까닭을 적는다 — 안 적으면 다음 사람이 「고장」으로 읽는다.
   ⚠ 그냥 빼면 진짜로 잊힌 것이 여기 섞여 안 보인다. 그래서 «세어서» 따로 찍는다. */
const DECLARED_OFF = [
  [/^portrait_jachwi_m_/, 'game.html §FACE_FILE — 자취남 9장은 이번 판에 안 쓴다(사용자 결정). '
    + '안 쓰는 길을 열어 두면 나중에 「왜 이게 있지」가 된다'],
];

function reachable() {
  const r = new Map();          // 대사이름 -> 어느 다리로 닿나
  const add = (s, how) => { if (s && !r.has(s)) r.set(s, how); };
  for (const s of Object.values(EVENT_SCRIPT)) add(s, 'EVENT_SCRIPT');
  for (const s of Object.values(QUEST_OPEN_SCRIPT)) add(s, 'QUEST_OPEN');
  for (const s of Object.values(QUEST_DONE_SCRIPT)) add(s, 'QUEST_DONE');
  for (const s of BRANCHED) add(s, 'scriptOf 가지');
  for (const s of literalCalls()) add(s, 'game.html 붙박이');
  for (const c of (CHATTER || [])) add(typeof c === 'string' ? c : c && c.id, 'CHATTER');
  add('god1', 'scriptsForEvents 가 monsteraArrived 앞에 끼운다');
  return r;
}

function main() {
  const FACE_FILE = readFaceFile();
  const reach = reachable();
  const keys = Object.keys(SCRIPTS);

  /* ── ⑴ 안 불리는 대사 ───────────────────────────────────────── */
  const declared = declaredUnused();
  const notyet = keys.filter(k => !reach.has(k) && !k.startsWith('chat') && declared.has(k));
  const orphan = keys.filter(k => !reach.has(k) && !k.startsWith('chat') && !declared.has(k));

  /* ── ⑵ 표정 인구조사 — 닿는 것과 안 닿는 것을 «갈라서» 센다 ── */
  const tally = {};             // who -> face -> {on, off}
  for (const [sid, lines] of Object.entries(SCRIPTS)) {
    const live = reach.has(sid) || sid.startsWith('chat');
    for (const l of lines) {
      if (!l || !l.who) continue;
      const f = l.face || 'base';
      ((tally[l.who] ||= {})[f] ||= { on: 0, off: 0 })[live ? 'on' : 'off']++;
    }
  }

  const live = keys.filter(k => reach.has(k) || k.startsWith('chat')).length;
  console.log('■ 대사 ' + keys.length + '개 · 닿을 길이 있는 것 ' + live + '개');
  console.log();

  if (notyet.length) {
    console.log('· 「아직 안 씀」으로 «선언된» 것 ' + notyet.length + '개 — 흠이 아니라 상태다:');
    for (const k of notyet) console.log('   ' + k.padEnd(22) + SCRIPTS[k].length + '줄');
    console.log('   ⇒ test_dialogue_coverage.mjs 의 NOT_YET_USED 에서 읽었다. 까닭도 거기 있다.');
    console.log();
  }
  if (orphan.length) {
    console.log('⚠ 부르는 데를 «못 찾은» 대사 ' + orphan.length + '개 — «선언도 없다»:');
    for (const k of orphan) console.log('   ' + k.padEnd(22) + SCRIPTS[k].length + '줄');
    console.log('   ⇒ ⛔ 「고장」이 아니다. **이 자가 못 찾은 것일 수도 있다.**');
    console.log('      dlgOpen 에 변수로 넘기는 길이 있으면 이 자는 못 본다.');
    console.log();
  }

  console.log('■ 표정이 «실제로 뜰 길이 있나»');
  console.log();
  for (const who of Object.keys(tally).sort()) {
    const map = FACE_FILE[who];
    console.log('  ' + who
      + (map ? '' : '   ⚠ FACE_FILE 에 이 화자가 없다 → 초상화 자체가 안 뜬다'));
    for (const f of Object.keys(tally[who]).sort()) {
      const t = tally[who][f];
      const png = map && map[f];
      const mark = !map ? '-' : png ? '' : '⛔ 표에 없는 키 → 조용히 neutral';
      console.log('     ' + f.padEnd(10)
        + '닿는 줄 ' + String(t.on).padStart(3)
        + ' · 안 닿는 줄 ' + String(t.off).padStart(3) + '   '
        + (png ? '→ ' + png : '').padEnd(13) + mark);
    }
    /* ★ 거꾸로도 본다 — 표에 있는데 «아무 대사도 안 쓰는» 표정 */
    if (map) {
      const unused = Object.keys(map).filter(f => !(tally[who] || {})[f]);
      if (unused.length) {
        console.log('     ★★ 표에 있으나 «쓰는 대사가 없는» 표정: ' + unused.join(' · '));
        console.log('        ⇒ 그림은 있는데 아무도 안 부른다. 오늘 CHAR_ASSET 과 같은 모양이다.');
      }
    }
    console.log();
  }

  /* ── ⑶ ★★ 그림으로 다시 센다 — «키»가 아니라 «파일»이다 ────────────────
     ⚠ 처음에 키로만 셌다가 한 칸 어긋났다. `jachwi.curious → think` 별칭 때문에
       **키 `think` 는 아무 대사도 안 쓰는데 그림 `think.png` 는 뜬다**(curious 4줄).
     ⇒ ★ 물음이 「그림이 뜨나」이면 «별칭을 거친 뒤»를 세야 한다.
       키로 세면 멀쩡히 뜨는 그림을 「안 쓴다」고 적게 된다. */
  console.log('■ ★ 그림으로 다시 센다 (별칭을 거친 뒤 — 이게 「뜨나」의 답이다)');
  console.log();
  for (const who of Object.keys(FACE_FILE).sort()) {
    const map = FACE_FILE[who];
    const shown = {};
    for (const [f, png] of Object.entries(map)) {
      const t = (tally[who] || {})[f];
      shown[png] = (shown[png] || 0) + (t ? t.on : 0);
    }
    console.log('  ' + who);
    for (const png of Object.keys(shown).sort()) {
      const n = shown[png];
      const via = Object.entries(map).filter(([, v]) => v === png).map(([k]) => k);
      console.log('     portrait_' + who + '_' + (png + '.png').padEnd(14)
        + String(n).padStart(3) + '줄'
        + (n ? '' : '   ⛔ 한 줄도 안 쓴다 — 파일은 있는데 «안 뜬다»')
        + (via.length > 1 ? '   (' + via.join(' · ') + ' 로 온다)' : ''));
    }
    console.log();
  }

  /* ── ⑷ ★ 마지막 다리 — «디스크에 있는데 표에 아예 없는» 그림 ──────────
     ⇒ 이건 「표에 있으나 안 불림」의 «반대쪽»이다. 표를 세면 이쪽은 영영 안 보인다. */
  const want = new Set();
  for (const [who, map] of Object.entries(FACE_FILE))
    for (const png of Object.values(map)) want.add('portrait_' + who + '_' + png + '.png');
  const have = readdirSync(join(ROOT, 'assets', 'characters', 'portraits'))
    .filter(f => f.endsWith('.png'));
  const off = f => DECLARED_OFF.find(([re]) => re.test(f));
  const ghost = have.filter(f => !want.has(f) && !off(f));
  const declaredOff = have.filter(f => !want.has(f) && off(f));
  const missing = [...want].filter(f => !have.includes(f));

  console.log('■ ★ 표 «밖»의 그림 — 디스크에 있는데 FACE_FILE 이 안 가리키는 것');
  console.log();
  if (missing.length) {
    console.log('  ⛔ 표가 가리키는데 «파일이 없다» ' + missing.length + '개 — 대사가 빈 얼굴로 뜬다:');
    for (const f of missing) console.log('     ' + f);
    console.log();
  }
  console.log('  그림 ' + have.length + '장 = 표가 가리키는 것 ' + (have.length - ghost.length - declaredOff.length)
    + '장 + «일부러» 안 가리키는 것 ' + declaredOff.length + '장 + ★ 설명 없는 것 ' + ghost.length + '장');
  console.log();
  if (declaredOff.length) {
    for (const [re, why] of DECLARED_OFF) {
      const n = declaredOff.filter(f => re.test(f)).length;
      if (n) console.log('  · ' + n + '장 ... ' + why);
    }
    console.log();
  }
  if (ghost.length) {
    console.log('  ⛔ ★ 아무 데서도 안 불리고 «까닭도 안 적힌» 것 ' + ghost.length + '장:');
    for (const f of ghost) console.log('     ' + f);
    console.log('     ⇒ 지울 것인지 이을 것인지 사람이 정해야 한다.');
    console.log();
  }

  console.log('⛔ 이 자는 「부를 «길»이 있나」까지만 안다. 그 길을 실제로 걷는지는 모른다.');
  console.log('   사건이 나는 조건은 못 판정한다. **돌려 보기 전에는 「뜬다」고 적지 말 것.**');
  console.log('   ★ 이 저장소가 그걸 비싸게 배웠다 — `monsteraMoved` 는 «불리기는 불렸는데»');
  console.log('     조건(arrivalSlotId)이 죽어 있었다. 그때도 검사는 초록이었고 사람은 그 대사를');
  console.log('     한 번도 못 봤다 (test_dialogue_coverage.mjs:572). **나도 같은 데까지만 본다.**');
}

/* ★ 관문이 켜지나 — 안 꺼지는 검사는 검사가 아니다.
   오늘 나는 「물음표가 찍혔나」로 검사해 0개를 냈다가, 눈으로 보니 75개가 틀려 있었다. */
function selftest() {
  const FACE_FILE = readFaceFile();
  let bad = 0;
  const ok = (t, why) => { console.log('   ' + (t ? 'O' : 'X') + '  ' + why); if (!t) bad++; };

  ok(FACE_FILE && FACE_FILE.jachwi && FACE_FILE.moni,
    'game.html 에서 FACE_FILE 을 읽어 온다 (손으로 옮겨 적지 않았다)');
  ok(FACE_FILE.jachwi.curious === 'think',
    'jachwi.curious 가 think 별칭이다 — 읽은 값이 진짜 표다');
  const r = reachable();
  ok(r.has('monsteraMoved'),
    "game.html 붙박이 dlgOpen('monsteraMoved') 를 잡는다 (④ 다리)");
  ok(r.has('autumnCame'),
    'scriptOf 가지(season) 를 잡는다 — ③ 을 빼면 멀쩡한 대사가 유령이 된다');
  ok(BRANCHED.every(k => SCRIPTS[k]),
    '손으로 적은 BRANCHED 넷이 아직 SCRIPTS 에 다 있다 (낡지 않았다)');
  ok(!r.has('이런대사는없다'), '없는 이름은 안 잡는다');

  console.log();
  console.log('자 검사 ' + (bad === 0 ? '통과' : '실패 ' + bad + '건'));
  console.log('⚠ 통과가 「초상화가 뜬다」는 뜻이 아니다. **자가 안 망가졌다**까지다.');
  process.exit(bad ? 1 : 0);
}

if (process.argv.includes('--selftest')) selftest();
else main();
