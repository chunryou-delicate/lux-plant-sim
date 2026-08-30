/* tools/probe_desync.mjs — **desync 가 나면 «코어 이력»에 그 하루가 남나**
   ------------------------------------------------------------------
   [growth] 물음(2026-08-30): `loop.js` 가 desync 에 「오늘 DLI 입력은 growth 이력에
   남았을 «수» 있음」이라 적었는데 — ★ 「있음」이 아니라 「있을 수」다. 확정할 수 있나?
   ⇒ 그리고 그쪽 제안: 「desync 세이브면 dliHist 길이가 fedDays 와 맞나를 보면 잡힌다」.
     ⇒ ⚠ 그것도 여기서 «재서» 본다 — 맞는 말인지.

   재는 법: 생장 창이 `advanceTo` 에서 **던지게** 만들고 하루를 넘긴다(그 길로만 desync 가 난다).
   ⛔ 값은 안 바꾼다. 코드도 안 고친다.
     node tools/probe_desync.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newState, potHist } from '../src/game/state.js';
import { nextDay } from '../src/game/loop.js';
import { firstPlayRulesFromBalance } from '../src/game/first_play.js';
import { nullGrowth } from '../src/game/sim.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FP_RULES = firstPlayRulesFromBalance(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'data/balance/characters.json'), 'utf8')));

/* 조도 창 흉내 — 자리 하나에 빛을 준다 */
function stubLight() {
  const slots = [{ slotId: 'banjiha-sill:0', x: 0, y: 1.5, z: -1.9, maxPotD: 0.4, dli: 3.5 }];
  const room = { id: 'banjiha', slots, size: { w: 6, d: 5, h: 2.5 }, surfaces: new Set(['banjiha-sill']) };
  return {
    room, build() { return room; }, clearCache() {},
    skyFor() { return { season: 'summer', weather: 'clear', k: 1 }; },
    /* ⚠ `daily` 는 셋을 낸다 — report·sky·check. 처음에 report 만 냈다가
       `nextDay` 가 `check.ok` 에서 던졌다(잰 판이 아니라 «자»가 틀린 것이었다). */
    daily() { return { report: { slots: slots.map(s => ({ slotId: s.slotId, dli: s.dli })),
                                energy: { won: 0 } },
                       sky: { season: 'summer', weather: 'clear', k: 1 },
                       check: { ok: true, problems: [], badSlots: new Set() } }; },
    dliOfSlot() { return 3.5; }, growLampCount() { return 2; },
    lampList() { return []; }, furnitureList() { return []; }
  };
}
/* 생장 창 흉내 — ★ `advanceTo` 에서 «던진다». setDailyLight 은 «이미 받은 뒤»다 */
function throwingGrowth() {
  const g = nullGrowth(14);
  const seen = [];
  return {
    ...g,
    seen,
    setDailyLight(v) { seen.push(v); return g.setDailyLight(v); },
    advanceTo() { throw new Error('[재는 판] advanceTo 가 던졌습니다'); },
    calendarDay() { return g.calendarDay(); }
  };
}

const S = newState({ room: 'banjiha', mode: 'novice', firstPlay: false });
S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: 'banjiha-sill:0',
              at: { x: 0, y: 1.5, z: -1.9 }, placedOnce: true, variegated: false,
              daysPlanted: 3, fedDays: 3, arrivedOnDay: 0, wateredOnDay: 0,
              arrivalGrowthDays: 45, growthId: '__main__' });
/* ⚠ 이력과 fedDays 를 «맞춰» 둔다 — 어긋난 채로 시작하면 ②의 답이 내 판 탓이 된다.
   (처음에 fedDays 3 · 이력 0 으로 두고 「어긋난다 ⇒ 잡힌다」로 읽을 뻔했다. 그건 내가 만든 어긋남이다.) */
/* ⚠ 정본은 «화분의» 이력이다 — `S.dliHist` 는 첫 화분 것을 가리키는 «대표 칸»일 뿐이다
   (state §potHist: 첫 화분이면 S.dliHist 를 그 배열로 «맞춰» 준다). 그래서 화분에 적는다. */
S.pots[0].dliHist = [3.5, 3.5, 3.5];
const growth = throwingGrowth();
const io = { light: stubLight(), growth };

const before = { day: S.day, hist: potHist(S, S.pots[0]).length, fedDays: S.pots[0].fedDays };
let threw = null;
try { nextDay(S, io); } catch (e) { threw = e; }
const after = { day: S.day, hist: potHist(S, S.pots[0]).length, fedDays: S.pots[0].fedDays };

const j = (o) => JSON.stringify(o);
console.log('■ 하루를 넘겼고 생장 창이 던졌습니다 —', threw ? threw.message : '(안 던졌다?!)');
console.log('  · 턴 상태 —', j({ turnState: threw && threw.turnState,
                                 coreRolledBack: threw && threw.coreRolledBack }));
console.log('  · desync —', j(S.desync || null));
console.log('');
console.log('=== ① 코어 이력에 그 하루가 «쌓였나» ===');
console.log(' ', j({ 전: before, 후: after,
  '이력이 늘었나': after.hist > before.hist,
  '엔진이 받은 빛': growth.seen.length,
  판정: after.hist === before.hist
    ? '✔ 코어 이력에는 «안 쌓였다» — 던지면 push 가 아예 안 지나간다'
    : '★ 코어 이력에 쌓였다' }));
console.log('');
console.log('=== ② [growth] 제안 — 「dliHist 길이 ⇄ fedDays」로 잡히나 ===');
console.log(' ', j({ '이력 길이': after.hist, fedDays: after.fedDays,
  맞나: after.hist === after.fedDays,
  판정: after.hist === after.fedDays
    ? '⛔ 둘이 «맞는다» ⇒ 이 자로는 desync 를 «못 잡는다»'
    : '✔ 어긋난다 ⇒ 이 자로 잡힌다' }));
console.log('');
console.log('=== ③ 그러면 «무엇이» 어긋나 있나 ===');
/* ⚠ «이 턴»만 견준다 — 엔진이 받은 칸은 이 판에서 센 것이고 코어 이력은 «처음부터»의 길이라
   그냥 빼면 엉뚱한 수가 난다(처음에 −2 가 나왔다. 두 자의 «기준»이 달랐다). */
console.log(' ', j({ '코어 날': S.day,
  '이 턴에 엔진이 받은 칸': growth.seen.length,
  '이 턴에 코어가 쌓은 칸': after.hist - before.hist,
  '어긋남': growth.seen.length - (after.hist - before.hist),
  뜻: '엔진은 오늘 빛을 «한 칸 더» 먹었는데 코어 이력에는 그 칸이 없다 — ' +
      '세이브는 «코어 이력»만 싣는다(save §restoreGrowth) ⇒ 복원하면 그 한 칸이 없는 판이 선다' }));
