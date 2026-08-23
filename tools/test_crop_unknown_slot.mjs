/* ============================================================
   test_crop_unknown_slot.mjs — 「모르는 자리」가 «최상 품질»로 새지 않는가 ([growth] 소유)
   ------------------------------------------------------------
   ★ 왜 이 검사가 있나 (2026-08-23)

   콩나물 최상 대역은 `minDli 0 · maxDli 0.3` 이고 **하한이 없다**(first_play.js:204).
   그래서 **0 이 흘러들면 「하얗고 아삭」(3끼 · 500g · 최대 돈)** 이 된다.

   ⚠ 그리고 헤드리스 `room_profile` 은 자유 좌표(`free:…`)를 모른다.
     `dliOfSlot` 에 물으면 **0 이 돌아온다. 그 0 은 「어둡다」가 아니라 「모른다」다.**

   ⇒ ★ **그런데 작물은 그 길을 «안 탄다.**» `cropDliFromReport` 를 타고, 그것은 **던진다.**
     [core] 가 2026-08-03 에 이미 막아 뒀다(first_play.js:1880 · 2310 주석).

   ★★ **이 검사는 그 울타리가 «없어지지 않게» 지키는 것이다.**
     누가 나중에 "던지지 말고 0 을 쓰자"로 바꾸면 — 그 순간 위 사슬이 이어져
     **검사가 초록인 채로 수확량이 2.5배(200g→500g)가 된다.** 조용히.

   ⚠ 나는 실제로 이 병이 «있다»고 두 창에 보고했다가 물렀다. 함수 둘을 섞었다 —
     `dliOfSlot`(0 을 낸다)을 보고 `cropDliFromReport`(던진다)의 이야기를 했다.
     ⇒ **그래서 이 검사를 남긴다.** 다음 사람이 나처럼 헷갈리면 여기서 답을 본다.

     node tools/test_crop_unknown_slot.mjs
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { cropDliFromReport, cropQualityOf } from '../src/game/first_play.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

let pass = 0, fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}  → ${got}`); }
};

const P = J('data/profiles/room_profile.banjiha.json');
const light = createProfileLight({ ...P, uidStable: true }, {
  thresholds: J('data/balance/light_thresholds.json'),
  weather: J('data/balance/weather.json'),
  electricity: J('data/balance/electricity.json'),
});
const { report } = light.daily(10, {
  sim: { mode: 'novice', yearDay0: 135 }, lamps: { count: 0, litHours: 12 },
  pots: [], placedItems: [],
});

/* ── ① 전제: 정적 프로필에는 자유 좌표가 실리지 않는다 ─────────────────── */
ok('① 계약에 자유 좌표(free:) 자리가 하나도 없다',
   report.slots.every(s => !String(s.slotId).startsWith('free:')),
   report.slots.filter(s => String(s.slotId).startsWith('free:')).map(s => s.slotId).join(','));

/* ── ② 전제: 0 이 흘러들면 «최상»이 된다. 이것이 위험의 크기다 ──────────── */
const q0 = cropQualityOf('beansprout', 0);
ok('② 콩나물은 0 이면 「하얗고 아삭」(최상 3끼)이다 — 그래서 0 이 새면 안 된다',
   q0.id === 'crisp_white' && q0.meals === 3, `${q0.id}/${q0.meals}끼`);

/* ── ③ ★ 본체: 그런데도 «던진다». 이 줄이 이 파일의 전부다 ──────────────── */
let threw = null;
try { cropDliFromReport(report, 'free:crop_01'); }
catch (e) { threw = e; }
ok('③ ★ 모르는 자리를 물으면 «던진다» — 조용히 0 을 쓰지 않는다',
   threw !== null, threw === null ? '조용히 돌아왔다 ⇒ 울타리가 사라졌다' : '');

/* ── ④ 오류가 «까닭»을 말하는가. 안 그러면 다음 사람이 조건을 의심한다 ──── */
ok('④ 오류 문구가 room_profile 을 이름으로 짚는다',
   !!threw && /room_profile|방 프로파일/.test(threw.message),
   threw ? threw.message.slice(0, 80) : '(안 던짐)');

/* ── ⑤ 이름 붙은 자리는 멀쩡히 값을 낸다 — ③ 이 과잉이 아님을 보인다 ───── */
let sill = null;
try { sill = cropDliFromReport(report, 'banjiha-sill:0'); } catch (e) { sill = String(e.message); }
ok('⑤ 이름 붙은 자리는 그대로 값을 낸다 (③ 이 멀쩡한 자리까지 막지 않는다)',
   typeof sill === 'number' && sill > 0, sill);

console.log(`\ncrop_unknown_slot: ${fail ? `FAIL (${fail}건)` : `PASS (${pass}건)`}`);
process.exitCode = fail ? 1 : 0;
