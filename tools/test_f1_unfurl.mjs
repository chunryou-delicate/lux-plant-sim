/* tools/test_f1_unfurl.mjs — F1 새 잎 펼치기 세이브 칸(core 11-04 · plan-ui-fun §F1 · 총괄 가름) · node 만
   ㉮ S.unfurl(펼침 대기 줄) · S.album(처음 본 꼴)이 저장 → 불러오기 왕복에서 그대로
   ㉯ 칸 없는 판(옛 세이브 · 아직 안 씀)은 불러온 뒤에도 칸이 없다(talk 와 같은 결 · 지어내지 않음)
   ㉰ 깨진 줄(객체 아님)은 안 싣고 · 숫자 아닌 album 값은 안 싣는다
   빨강 먼저: 72bfab29(고치기 전 — 칸을 안 실어 ㉮ 빨강) */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newState } from '../src/game/state.js';
import { serialize, deserialize } from '../src/game/save.js';
import { firstPlayRulesFromBalance } from '../src/game/first_play.js';
import { nullGrowth } from '../src/game/sim.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FP_RULES = firstPlayRulesFromBalance(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/balance/characters.json'), 'utf8')));
function stubLight(slotIds) {
  const slots = slotIds.map((id, i) => ({ slotId: id, x: i * 0.3, y: 1.0, z: 0, maxPotD: 0.4 }));
  const room = () => ({ id: 'banjiha', slots, size: { w: 6, d: 5, h: 2.5 }, surfaces: new Set(slotIds.map(s => String(s).split(':')[0])) });
  return { build() { return room(); }, clearCache() {}, setFurnitureOverrides() {}, setFurnitureEdits() {}, setLampAims() {}, lampList() { return []; },
           furnitureList() { return []; }, get room() { return room(); } };
}
const stubGrowth = () => { const g = nullGrowth(14); return { ...g, multi: () => true, addPlant() {}, select() {}, setGrowth: (d) => g.setGrowth(d), setDailyLight: (v) => g.setDailyLight(v), advanceTo: (d) => g.advanceTo(d) }; };
const round = (S) => deserialize(JSON.stringify(serialize(S)), { light: stubLight(['banjiha-sill:0', 'banjiha-desk:0']), growth: stubGrowth(), firstPlayRules: FP_RULES });
const fresh = () => { const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: FP_RULES }); S.day = 40; return S; };
const results = [];
const check = (name, fn) => { try { fn(); results.push(['OK  ', name]); } catch (e) { results.push(['FAIL', name, (e && e.message || String(e)).split('\n')[0].slice(0, 260)]); } };

check('㉮ S.unfurl · S.album 이 저장 → 불러오기 왕복에서 그대로', () => {
  const S = fresh();
  S.unfurl = [{ potId: 'pot_01', leafBirth: 33.5, day: 40, leafNo: 5, title: '✨ 5번째 잎 — 하프문', sub: '5번째 잎이 다 자랐습니다 — 무늬는 하프문', img: './assets/illust/cards/card_mon_half_a.png', card: 'card_mon_half_a' }];
  S.album = { card_mon_sanban_b: 21, card_mon_half_a: 40 };
  const S2 = round(S);
  assert.deepEqual(S2.unfurl, S.unfurl, `펼침 줄: ${JSON.stringify(S2.unfurl)}`);
  assert.deepEqual(S2.album, S.album, `처음 본 꼴: ${JSON.stringify(S2.album)}`);
});
check('㉯ 칸 없는 판은 불러온 뒤에도 칸이 없다', () => {
  const S2 = round(fresh());
  assert.equal(S2.unfurl, undefined, `unfurl: ${JSON.stringify(S2.unfurl)}`);
  assert.equal(S2.album, undefined, `album: ${JSON.stringify(S2.album)}`);
  const S3 = fresh(); S3.unfurl = []; S3.album = {};
  const S4 = round(S3);
  assert.equal(S4.unfurl, undefined, '빈 줄이 칸으로 남았습니다'); assert.equal(S4.album, undefined, '빈 album 이 칸으로 남았습니다');
});
check('㉰ 깨진 줄 · 숫자 아닌 album 값은 안 싣는다', () => {
  const S = fresh();
  S.unfurl = [null, 'x', { potId: 'pot_02', leafBirth: 7, day: 39 }];
  S.album = { card_a: 12, card_b: 'x', card_c: null };
  const S2 = round(S);
  assert.deepEqual(S2.unfurl, [{ potId: 'pot_02', leafBirth: 7, day: 39, leafNo: null, title: null, sub: null, img: null, card: null }], JSON.stringify(S2.unfurl));
  assert.deepEqual(S2.album, { card_a: 12 }, JSON.stringify(S2.album));
});

let fail = 0;
for (const [st, name, msg] of results) { if (st === 'FAIL') fail++; console.log(`${st}  ${name}${msg ? '\n      → ' + msg : ''}`); }
console.log(fail ? `\ntest_f1_unfurl: 빨강 ${fail}` : '\ntest_f1_unfurl: 다 통과');
process.exit(fail ? 1 : 0);
