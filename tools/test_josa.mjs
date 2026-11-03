/* 조사 자(core 11-03 · 일곱째 묶음 8C6 첫머리 · 총괄 · plan 25224e96) — node · 고치기 전 빨강을 먼저 본다
   ㉮ 정본 josa 가 숫자 끝을 읽는다 — «몬스테라 1을 · 2를 · 3을 · 6을 · 7을 · 8을 · 9를 · 10을» · (으)로는 ㄹ 받침이면 «로»(1로 · 7로 · 8로 · 3으로 · 6으로 · 0으로)
   ㉯ 받침 없는 종 넷(알로카시아 · 칼라테아 · 스킨답서스 · 핑크프린세스)은 «…를 놓았습니다» · 받침 있는 그릇 «새싹 재배판을 · 유리 수경병을»
   ㉰ 이름 뒤에 박은 조사가 소스에 없다(종 이름 · «몬스테라{n}» · 그릇 · 상품 · 화분 이름) — game.html · state · first_play · propagation · shop
   ㉱ shop.js 는 정본(src/game/josa.js)을 그대로 다시 내보낸다(부르는 자리 안 바뀜) · game.html josaRo 는 정본 jongOf 로 센다 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let bad = 0, n = 0;
const check = async (name, fn) => { n++; try { await fn(); console.log(`  OK  ${name}`); } catch (e) { bad++; console.log(`FAIL  ${name}\n      ${e.message}`); } };
const SHOP = await import(pathToFileURL(path.join(ROOT, 'src/game/shop.js')).href);
const josa = SHOP.josa;

await check('㉮ 숫자 끝 — 을/를 · (으)로', () => {
  const got = ['몬스테라 1', '몬스테라 2', '몬스테라 3', '몬스테라 6', '몬스테라 7', '몬스테라 8', '몬스테라 9', '몬스테라 10'].map(s => josa(s, '을', '를'));
  assert.deepEqual(got, ['몬스테라 1을', '몬스테라 2를', '몬스테라 3을', '몬스테라 6을', '몬스테라 7을', '몬스테라 8을', '몬스테라 9를', '몬스테라 10을']);
  assert.equal(josa('몬스테라 1', '은', '는'), '몬스테라 1은');
  assert.equal(typeof SHOP.jongOf, 'function', 'shop.js 가 jongOf 를 내보내지 않습니다');
  const ro = s => s + (SHOP.jongOf(s) && SHOP.jongOf(s) !== 8 ? '으로' : '로');
  assert.deepEqual(['칸 1', '칸 7', '칸 8', '칸 3', '칸 6', '칸 10', '칸 2', '서울', '창턱'].map(ro), ['칸 1로', '칸 7로', '칸 8로', '칸 3으로', '칸 6으로', '칸 10으로', '칸 2로', '서울로', '창턱으로']);
});
await check('㉯ 받침 없는 종 넷 · 받침 있는 그릇', () => {
  for (const s of ['알로카시아', '칼라테아', '스킨답서스', '핑크프린세스']) assert.equal(josa(s, '을', '를') + ' 놓았습니다', `${s}를 놓았습니다`);
  assert.equal(josa('새싹 재배판', '을', '를'), '새싹 재배판을');
  assert.equal(josa('새싹 재배판', '이', '가'), '새싹 재배판이');
  assert.equal(josa('유리 수경병', '을', '를'), '유리 수경병을');
  assert.equal(josa('시루', '을', '를'), '시루를');
});
await check('㉰ 이름 뒤에 박은 조사가 소스에 없음', () => {
  const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const BAD = [
    ['game.html', /SPECIES_KO\[[a-z.]+\] \|\| '새 식물'\}(을|를)/g],
    ['game.html', /몬스테라\$\{(n|nth)\}(을|를|은|는|이|가)/g],
    ['game.html', /\$\{ko\}(을 가방에|가 자라던|를 놓았습니다)/g],
    ['game.html', /\$\{nm\}를 가방에/g],
    ['src/game/state.js', /containerKo\}(을|를|이|가)/g],
    ['src/game/first_play.js', /containerKo\}(을|를|이|가) /g],
    ['src/game/propagation.js', /\$\{cont\.ko\}(을|를)/g],
    ['src/game/shop.js', /\$\{(it|kind)\.ko\}(을|를|이|가)/g]
  ];
  const hits = [];
  for (const [f, re] of BAD) { const m = rd(f).match(re); if (m) hits.push(`${f}: ${m.slice(0, 3).join(' | ')} (${m.length})`); }
  assert.equal(hits.length, 0, hits.join(' ; '));
});
await check('㉱ shop.js 는 정본을 다시 내보냄 · josaRo 는 jongOf', async () => {
  const J = await import(pathToFileURL(path.join(ROOT, 'src/game/josa.js')).href);
  assert.equal(SHOP.josa, J.josa, 'shop.js josa 가 정본과 다릅니다');
  const g = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
  const i = g.indexOf('function josaRo('); assert.ok(i > 0, 'josaRo 없음');
  assert.ok(/jongOf\(t\)/.test(g.slice(i, i + 400)), 'josaRo 가 정본 jongOf 로 안 셉니다');
});
console.log(bad ? `\ntest_josa: 빨강 ${bad}/${n}` : `\ntest_josa: 다 통과 ${n}`);
process.exit(bad ? 1 : 0);
