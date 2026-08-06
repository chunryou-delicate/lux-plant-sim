/* 산 시루가 실제로 판에 들어가나 (2026-08-06)
   ------------------------------------------------------------
   박사님: "콩나물 시루랑 콩을 사는데 뭐가 와야 되는데 사지기만 하고 안 오네".
   원인은 화면이 `resowCrop` 에 `sirus` 를 안 넘긴 것이었다. 그러면 `sirusAdded` 가 0 이라
   `siru` 재고가 영영 안 빠진다 — 돈만 나가고 판은 그대로다.

   이 검사는 **규칙 모듈만** 부른다. 화면이 무엇을 넘기는지는 game.html 이 정하지만,
   넘기기만 하면 규칙이 제대로 받는다는 것을 여기서 못박아 둔다.
   ⚠ 화면 코드를 베껴 적지 않는다 — 그러면 검사가 화면을 검사하는 게 아니라
     내가 화면이라고 믿는 것을 검사하게 된다(전에 F-1 에서 그랬다). */
import { readFileSync } from 'node:fs';
import { newState, resowCrop, cropHarvestStatus } from '../src/game/state.js';
import { firstPlayRulesFromBalance } from '../src/game/first_play.js';
import { stockOf } from '../src/game/shop.js';

const RULES = firstPlayRulesFromBalance(JSON.parse(
  readFileSync(new URL('../data/balance/characters.json', import.meta.url), 'utf8')));

let bad = 0;
const ok = (name, cond, got) => {
  console.log(`${cond ? '  OK' : 'FAIL'}  ${name}${cond ? '' : '  → ' + got}`);
  if (!cond) bad++;
};

const S = newState({ firstPlay: true, firstPlayRules: RULES });
if (!S.firstPlay || !S.firstPlay.enabled) { console.log('첫 플레이가 안 도는 판입니다'); process.exit(0); }

/* 시루 하나를 놓고 거둔 상태로 만든다 — 다시 심기의 정상 경로 */
const b = S.firstPlay.beansprout;
b.slotId = 'banjiha-desk:0';
b.at = { x: 0, y: 0.74, z: 0 };
for (const p of (b.pots || [])) { p.harvested = true; p.ageDays = 4; }
const had = cropHarvestStatus(S).sirus;
ok('A-1 처음 시루 수는 1이다', had === 1, had);

/* 재고를 넣어 준다 — 상점을 거치지 않고 직접 넣는다(여기서 볼 것은 심기지 주문이 아니다) */
const shop = S.shop || (S.shop = {});
shop.stock = { ...(shop.stock || {}), siru: 2, bean_seed: 5 };
S.stamina && (S.stamina.left = 10);

const r = resowCrop(S, { sirus: had + 2 });
ok('B-1 시루가 3개가 된다', r.sirus === 3, r.sirus);
ok('B-2 늘어난 시루는 2개다', r.sirusAdded === 2, r.sirusAdded);
ok('B-3 씨앗은 3봉지 든다 (거둔 1 + 새 2)', r.seedsUsed === 3, r.seedsUsed);
ok('B-4 siru 재고가 0이 된다', stockOf(S, 'siru') === 0, stockOf(S, 'siru'));
ok('B-5 bean_seed 재고가 2가 된다', stockOf(S, 'bean_seed') === 2, stockOf(S, 'bean_seed'));

/* 재고 없이 늘리려 하면 던져야 한다 — 조용히 늘면 시루가 공짜가 된다 */
let threw = null;
try { resowCrop(S, { sirus: 4 }); } catch (e) { threw = e; }
ok('C-1 시루 재고가 없으면 못 늘린다', !!threw, '안 던졌습니다');
ok('C-2 시루 수는 그대로 3이다', cropHarvestStatus(S).sirus === 3, cropHarvestStatus(S).sirus);

console.log(bad ? `\n${bad}개 떨어졌습니다` : '\n모두 통과');
process.exit(bad ? 1 : 0);
