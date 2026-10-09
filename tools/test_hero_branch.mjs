/* tools/test_hero_branch.mjs — 직업·남녀 «추후 분기»의 길(core · 2026-10-10 · plan-branch-job-gender-20261010 §3) — 노드만
   A 성별 한 곳 — 기본 'f' · 옛 세이브(칸 없음) 'f' · 미리 보기 깃발 · 모르는 성별은 던진다
   B 'f' 판은 예전과 같은 이름 — 초상 이름 · 고르기 표가 경고 없이 'f' 를 낸다
   C 'm' 을 강제하면 그림이 없는 것은 떨어지면서 경고 한 줄(같은 것은 한 번)
       초상: 있는 아홉은 jachwi_m_{키} · 없는 키는 jachwi_m_neutral · 몸(v2 hero2_m)·옷(outfit/m)은 'f'
   D 남 초상 «있다»고 적은 아홉이 실제로 있다 · FACE_FILE(자취생) 키 중 남 판이 없는 것 = char 주문 목록(찍기만)
   E 캐릭터 id = data/balance/characters.json · 진로 id = game.html 진로 카드(JOB_KO) · 둘은 안 겹친다(한 낱말 두 방)
   F 세이브 왕복 — hero·character 가 살아 돌아오고 · 칸 없는 판은 칸을 안 세운다(기본) */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as HB from '../src/game/hero_branch.js';
import { JOB_IDS, JOB_IDS_RESERVED, JOB_OPEN } from '../src/game/job_shop.js';
import { newState } from '../src/game/state.js';
import { serialize, deserialize } from '../src/game/save.js';
import { firstPlayRulesFromBalance } from '../src/game/first_play.js';
import { nullGrowth } from '../src/game/sim.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let bad = 0;
const T = (name, fn) => { try { fn(); console.log('PASS ', name); } catch (e) { bad++; console.log('FAIL ', name, '\n     ', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e); } };
const caught = () => { const out = []; return { warn: m => out.push(m), out }; };

T('A 성별 한 곳 — 기본 f · 옛 판 f · 깃발 · 모르는 성별', () => {
  assert.equal(HB.heroGenderOf({}), 'f');
  assert.equal(HB.heroGenderOf(null), 'f');
  assert.equal(HB.heroGenderOf({ hero: { gender: 'x' } }), 'f', '모르는 값은 f');
  assert.equal(HB.heroGenderOf({ hero: { gender: 'm' } }), 'm');
  assert.equal(HB.heroGenderOf({}, { override: 'm' }), 'm', '미리 보기 깃발');
  assert.equal(HB.heroGenderOf({ hero: { gender: 'm' } }, { override: 'f' }), 'f');
  const S = {}; HB.setHeroGender(S, 'm'); assert.deepEqual(S.hero, { gender: 'm' });
  assert.throws(() => HB.setHeroGender(S, 'x'));
  assert.equal(HB.characterOf({}), 'jachwi');
  assert.equal(HB.characterOf({ character: 'researcher' }), 'researcher');
  assert.equal(HB.characterOf({ character: 'shop' }), 'jachwi', '진로 id 는 캐릭터가 아니다');
});

T('B f 판은 예전과 같은 이름 — 경고 없음', () => {
  HB._resetGenderWarnings(); const w = caught();
  for (const f of ['neutral', 'beam', 'winter', 'think', 'numb'])
    assert.equal(HB.portraitNameOf('jachwi', f, 'f', w.warn), 'jachwi_' + f);
  assert.equal(HB.portraitNameOf('moni', 'excited', 'm', w.warn), 'moni_excited', '몬이는 성별이 없다');
  assert.equal(HB.pickByGender({ f: 'hero2.glb', m: null }, 'f', '몸', w.warn), 'hero2.glb');
  assert.equal(HB.pickByGender({ f: 'jachwi_f', m: 'namja_jachwi' }, 'f', '옛 몸', w.warn), 'jachwi_f');
  assert.deepEqual(w.out, [], 'f 판에서 경고가 났다');
});

T('C m 강제 — 없는 그림은 떨어지면서 경고 한 줄(같은 것은 한 번)', () => {
  HB._resetGenderWarnings(); const w = caught();
  assert.equal(HB.portraitNameOf('jachwi', 'think', 'm', w.warn), 'jachwi_m_think', '있는 남 초상');
  assert.equal(w.out.length, 0);
  assert.equal(HB.portraitNameOf('jachwi', 'beam', 'm', w.warn), 'jachwi_m_beam', '있는 남 낯(char a6c09ee8)');
  assert.equal(w.out.length, 0);
  /* 없는 키(앞으로 여자 판에만 새 낯이 생기는 경우) — 같은 성별 neutral + 경고 한 번 */
  assert.equal(HB.portraitNameOf('jachwi', 'zz_new', 'm', w.warn), 'jachwi_m_neutral', '없는 키는 같은 성별 neutral');
  assert.equal(HB.portraitNameOf('jachwi', 'zz_new', 'm', w.warn), 'jachwi_m_neutral');
  assert.equal(w.out.length, 1, '같은 경고가 두 번 났다: ' + w.out.join(' / '));
  assert.match(w.out[0], /portrait_jachwi_m_zz_new/);
  /* 몸·옷 — m 칸이 null 이면 f + 경고 */
  assert.equal(HB.pickByGender({ f: 'hero2.glb', m: null }, 'm', '3D 몸(v2 hero2_m.glb)', w.warn), 'hero2.glb');
  const outfits = { spring: 'spring.jpg' };
  assert.equal(HB.pickByGender({ f: outfits, m: null }, 'm', '옷 그림(outfit/m)', w.warn), outfits);
  assert.equal(w.out.length, 3, w.out.join(' / '));
  assert.ok(w.out.slice(1).every(m => /'m' 판이 아직 없어 'f' 로/.test(m)), w.out.join(' / '));
  /* 있는 m 칸은 경고 없이 */
  assert.equal(HB.pickByGender({ f: 'jachwi_f', m: 'namja_jachwi' }, 'm', '옛 몸(lq)', w.warn), 'namja_jachwi');
  assert.equal(w.out.length, 3);
  console.log('      경고 —', w.out.join(' | '));
});

T('D 남 초상 — 있다고 적은 것은 있다 · 모자란 키(char 주문)', () => {
  const dir = path.join(ROOT, 'assets/characters/portraits');
  for (const k of HB.PORTRAIT_M_HAVE) assert.ok(fs.existsSync(path.join(dir, `portrait_jachwi_m_${k}.png`)), `없다: portrait_jachwi_m_${k}.png`);
  const html = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
  const m = html.match(/const FACE_FILE = \{([\s\S]*?)\n\};/); assert.ok(m, 'FACE_FILE 을 못 찾았다');
  const block = m[1].slice(m[1].indexOf('jachwi:'), m[1].indexOf('moni:'));
  const files = [...new Set([...block.matchAll(/(\w+)\s*:\s*'([^']+)'/g)].map(x => x[2]))];
  assert.ok(files.length >= 10, '자취생 표를 못 읽었다: ' + files.join(','));
  const missing = files.filter(f => !HB.PORTRAIT_M_HAVE.includes(f));
  console.log(`      자취생 낯 ${files.length} · 남 판 있음 ${files.length - missing.length} · 모자람(char 주문) ${missing.join(' · ') || '없음'}`);
  assert.deepEqual(missing, [], '여자 판 낯 중 남 판이 없는 것: ' + missing.join(','));   /* 10-10 a6c09ee8 — 다 섰다 · 새 낯이 여자 판에만 생기면 여기서 빨개진다(char 주문) */
});

T('E 캐릭터 id = characters.json · 진로 id = 진로 카드 · 둘은 안 겹친다', () => {
  const C = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/balance/characters.json'), 'utf8'));
  const ids = (C.characters || C).map(c => c.id);
  assert.deepEqual([...ids].sort(), [...HB.CHARACTER_IDS].sort());
  const html = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
  const jk = html.slice(html.indexOf('const JOB_KO'), html.indexOf('const JOB_KO') + 1500);
  const cards = [...jk.matchAll(/\{ id: '(\w+)'/g)].map(x => x[1]);
  assert.deepEqual(cards, [...JOB_IDS], '진로 카드 id 와 JOB_IDS 가 갈렸다: ' + cards.join(','));
  assert.ok(JOB_OPEN.every(j => JOB_IDS.includes(j)));
  for (const j of [...JOB_IDS, ...JOB_IDS_RESERVED]) assert.ok(!HB.CHARACTER_IDS.includes(j), `한 낱말 두 방: ${j}`);
});

T('F 세이브 왕복 — hero·character · 칸 없는 판', () => {
  const FP = firstPlayRulesFromBalance(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/balance/characters.json'), 'utf8')));
  const light = { build() { return this.room; }, clearCache() {}, setFurnitureOverrides() {}, setFurnitureEdits() {}, setLampAims() {},
                  lampList() { return []; }, furnitureList() { return []; },
                  get room() { return { id: 'banjiha', slots: [{ slotId: 'banjiha-sill:0', x: 0, y: 1, z: 0, maxPotD: 0.4 }], size: { w: 6, d: 5, h: 2.5 }, surfaces: new Set(['banjiha-sill']) }; } };
  const growth = () => { const g = nullGrowth(14); return { ...g, multi: () => true, addPlant() {}, select() {} }; };
  const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: true, firstPlayRules: FP });
  const plain = deserialize(JSON.stringify(serialize(S)), { light, growth: growth(), firstPlayRules: FP });
  assert.ok(!('hero' in plain) && !('character' in plain), '칸 없는 판에 칸이 섰다');
  assert.equal(HB.heroGenderOf(plain), 'f'); assert.equal(HB.characterOf(plain), 'jachwi');
  HB.setHeroGender(S, 'm'); S.character = 'researcher';
  const back = deserialize(JSON.stringify(serialize(S)), { light, growth: growth(), firstPlayRules: FP });
  assert.equal(HB.heroGenderOf(back), 'm'); assert.equal(HB.characterOf(back), 'researcher');
});

console.log(bad ? `hero_branch: FAIL (${bad})` : 'hero_branch: PASS');
process.exit(bad ? 1 : 0);
