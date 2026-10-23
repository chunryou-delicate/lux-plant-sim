/* ============================================================
   tools/test_hang_jobs.mjs — 진로가 방에 남기는 것(2026-10-24 · [house] · 총괄 D83 · 끝맺음 명세 §2-3 · D75)
   ------------------------------------------------------------
   브라우저가 필요 없다(hang_spots.js 순수 함수 + 데이터 파일).
     A 판 이름   진로를 따른다 — 가게 order_board «가게 주문판» · 돌봄 care_board «맡김판» · 육종 memo_board «메모판».
                 진로 키를 안 주면(core 가 넘기기 전) 지금 이름 그대로 · 판이 아닌 것은 늘 그대로
     B 판 셋     한 모델·한 크기·한 자리 — 프리셋 셋이 같은 size_m · wall-hang · 가구점에 안 냄 · 옷 order_board.glb · 판 자리에만
     C 까닭      판을 판 자리 밖에 걸면 «X판은 X판 자리에만 겁니다»(진로 이름) · code 'board_only' · 진로 키 없으면 옛 글 그대로
     D 간판      가게 입간판(단골 10)과 돌봄 칠판 간판(살린 10)은 한 자리 — 먼저 선 것이 남고 뒤에 닿은 진로의 10 은 배너 ·
                 방 꾸밈 표에 간판 깃발(shopSign) 소품이 하나뿐인가(둘째 간판이 생기면 signOf 를 다시 봐야 한다)
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const { BOARD_KIND, BOARD_BY_JOB, boardAs, hangFits, hangSpotsOf, signOf, SIGN_JOBS } =
  await import(pathToFileURL(path.join(ROOT, 'src/game/hang_spots.js')).href);
const { JOB_IDS } = await import(pathToFileURL(path.join(ROOT, 'src/game/job_shop.js')).href);

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); }
};
const P = J('data/furniture_presets.json').presets;
const tworoom = J('data/house_rooms.json').rooms.tworoom;
const nameOf = (preset, job) => (P[boardAs(preset, job)] || {}).name_ko;

console.log('A 판 이름이 진로를 따른다');
ok('진로 키가 JOB_IDS 와 같다(shop · care · breed)', JSON.stringify(Object.keys(BOARD_BY_JOB).sort()) === JSON.stringify([...JOB_IDS].sort()),
   `${Object.keys(BOARD_BY_JOB)} ↔ ${JOB_IDS}`);
ok('받은 판(order_board)이 가게 «가게 주문판» · 돌봄 «맡김판» · 육종 «메모판»',
   nameOf('order_board', 'shop') === '가게 주문판' && nameOf('order_board', 'care') === '맡김판' && nameOf('order_board', 'breed') === '메모판',
   ['shop', 'care', 'breed'].map(j => nameOf('order_board', j)).join(' / '));
ok('돌봄에서 받은 판(care_board)도 같은 셈', ['shop', 'care', 'breed'].map(j => nameOf('care_board', j)).join('/') === '가게 주문판/맡김판/메모판',
   ['shop', 'care', 'breed'].map(j => nameOf('care_board', j)).join(' / '));
ok('진로 키가 없거나 모르면 지금 이름 그대로(order_board «가게 주문판» · care_board «맡김판»)',
   [undefined, null, '', 'shopkeeper'].every(j => nameOf('order_board', j) === '가게 주문판' && nameOf('care_board', j) === '맡김판'));
ok('판이 아닌 프리셋은 진로가 무엇이든 그대로', ['wall_planter', 'shop_display', 'poster_moon', 'nope'].every(p => JOB_IDS.every(j => boardAs(p, j) === p)));

console.log('B 판 셋은 한 모델 · 한 크기 · 한 자리');
const boards = Object.keys(BOARD_KIND);
const dress = fs.readFileSync(path.join(ROOT, 'src/render3d/furniture_dress.js'), 'utf8');
const furnLine = id => (dress.match(new RegExp(`^\\s*${id}:\\s*\\{[^\\n]*`, 'm')) || [''])[0];
ok('BOARD_BY_JOB 의 판이 다 판 갈래(BOARD_KIND)다', Object.values(BOARD_BY_JOB).every(b => BOARD_KIND[b] === 'order_board'));
ok('판 프리셋이 다 있다 · wall-hang · 가구점에 안 냄', boards.every(b => P[b] && P[b].mount === 'wall-hang' && P[b].shop_listed === false),
   boards.map(b => `${b}:${P[b] ? P[b].mount + '/' + P[b].shop_listed : '없음'}`).join(' '));
ok('size_m 이 셋 다 주문판과 같다', boards.every(b => JSON.stringify(P[b].size_m) === JSON.stringify(P.order_board.size_m)),
   boards.map(b => JSON.stringify(P[b].size_m)).join(' '));
ok('옷이 셋 다 order_board.glb · yaw −90(새 3D 0)', boards.every(b => /file: 'furniture\/order_board\.glb'/.test(furnLine(b)) && /yaw: -90\b/.test(furnLine(b))),
   boards.map(b => furnLine(b).trim().slice(0, 70)).join(' | '));
const spot = hangSpotsOf(tworoom).find(s => s.only === 'order_board');
ok('투룸 판 자리 하나(only:order_board)에 셋 다 걸린다', !!spot && boards.every(b => hangFits(spot, b, P[b].size_m).ok), spot ? spot.id : '판 자리 없음');
ok('판 자리에 판이 아닌 것은 안 걸린다(other_only)', !!spot && hangFits(spot, 'poster_moon', P.poster_moon.size_m).code === 'other_only');

console.log('C 판을 판 자리 밖에 걸 때의 까닭');
const plain = hangSpotsOf(tworoom).find(s => !s.only);
const why = (b, j) => hangFits(plain, b, P[b].size_m, j);
const GAME_RE = /(주문판|맡김판|메모판)은 \1 자리에만/;      // game.html hangChoices 가 세는 꼴(메모판까지)
ok('진로 키 없으면 옛 글 그대로(주문판 · 맡김판)', why('order_board').reason === '주문판은 주문판 자리에만 겁니다' && why('care_board').reason === '맡김판은 맡김판 자리에만 겁니다',
   `${why('order_board').reason} | ${why('care_board').reason}`);
ok('진로 키를 주면 그 진로의 판 이름(가게 주문판 · 돌봄 맡김판 · 육종 메모판)',
   JOB_IDS.map(j => why('order_board', j).reason).join('|') === '주문판은 주문판 자리에만 겁니다|맡김판은 맡김판 자리에만 겁니다|메모판은 메모판 자리에만 겁니다',
   JOB_IDS.map(j => why('order_board', j).reason).join(' | '));
ok("code 'board_only' · 글이 «X판은 X판 자리에만» 꼴", boards.every(b => [null, ...JOB_IDS].every(j => why(b, j).code === 'board_only' && GAME_RE.test(why(b, j).reason))));
ok('판이 아닌 것은 진로 키를 줘도 그대로(크기 까닭 · too_wide)', hangFits(plain, 'poster_moon', { w: 9, h: 0.1 }, 'care').code === 'too_wide');

console.log('D 간판 한 자리');
const s = d => JSON.stringify(signOf(d));
ok('간판 진로는 가게 · 돌봄 둘(JOB_IDS 안)', JSON.stringify(SIGN_JOBS) === '["shop","care"]' && SIGN_JOBS.every(j => JOB_IDS.includes(j)));
ok('아무도 10 전이면 간판 없음', s({}) === s({ shop: null, care: null }) && signOf(undefined).on === false && signOf({ shop: null, care: undefined }).on === false);
ok('가게만 10 → 가게 간판', s({ shop: 130, care: null }) === '{"on":true,"by":"shop","banner":[]}', s({ shop: 130, care: null }));
ok('돌봄만 10 → 돌봄 칠판 간판', s({ shop: null, care: 400 }) === '{"on":true,"by":"care","banner":[]}', s({ shop: null, care: 400 }));
ok('가게 10 뒤 돌봄 10 → 가게 간판이 남고 돌봄 10 은 배너(명세 §2-3)', s({ shop: 130, care: 700 }) === '{"on":true,"by":"shop","banner":["care"]}', s({ shop: 130, care: 700 }));
ok('돌봄 10 뒤 가게 10 → 돌봄 간판이 남고 가게 10 은 배너(같은 셈)', s({ shop: 900, care: 400 }) === '{"on":true,"by":"care","banner":["shop"]}', s({ shop: 900, care: 400 }));
ok('진로를 바꿔도 간판이 남는다 — 지금 진로가 아니라 날짜로 본다', signOf({ shop: 130, care: null }).on === true);
ok('0일도 날이다 · 글자·NaN 은 날이 아니다', signOf({ shop: 0 }).by === 'shop' && signOf({ shop: '130', care: NaN }).on === false);
const signProps = (dress.match(/flag:\s*'shopSign'/g) || []).length;
ok('방 꾸밈 표에 간판 깃발(shopSign) 소품이 하나 — 한 자리', signProps === 1, `shopSign 소품 ${signProps}`);

console.log(`\n${fail === 0 ? '✅' : '❌'} 통과 ${pass} · 실패 ${fail}`);
console.log(`hang_jobs: ${fail === 0 ? 'PASS' : 'FAIL'} (${pass}/${pass + fail})`);   // run_house_checks 가 이 줄을 센다(PASS|FAIL)
process.exit(fail === 0 ? 0 : 1);
