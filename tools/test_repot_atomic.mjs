/* ★ 분갈이는 통째로 되거나 통째로 안 되거나 — `repotCutting` 조용한 실패 (2026-08-09 신설)
 *
 *   node tools/test_repot_atomic.mjs
 *
 * ══ 무엇이 문제였나 ═══════════════════════════════════════════════════════
 * `repotCutting` 이 **먼저 상태를 찍고 자리를 나중에 줬다**:
 *
 *     c.potted = true; c.status = 'established';   ← 먼저
 *     if (opt.at) setCuttingAt(S, c, opt.at, opt);  ← 던질 수 있는 일이 뒤
 *
 * 자리 주기가 던지면 삽수는 「흙에 선」 것으로 바뀐 채 `slotId` 가 **null 로 남는다.**
 * 그러면 하루 빛이 `null` 이라 **오류 없이 영영 안 자란다** — 죽지도 않는다.
 * 화면에는 멀쩡히 서 있고 아무도 못 알아챈다. `docs/silent_failures.md` 가 말하는 그 유형이다.
 *
 * ⇒ 고친 규칙: **잴 것을 다 잰 뒤에 쓴다.** 던지면 아무것도 안 바뀐다.
 *   `state.resowCrop`·`state.placeSiru` 가 `shop.assertStockAll` 로 세운 순서와 같은 사상이고,
 *   `tools/test_resow_atomic.mjs` 가 그 본보기다.
 *
 * ══ 무엇을 켜고 무엇을 껐나 ═══════════════════════════════════════════════
 * 브라우저를 안 띄운다. 생장 엔진도 안 쓴다 — 마디 목록은 주입한다
 * (test_cutstamina.mjs 와 같은 이유: plant_grow.html 은 한 그루 전용이라 못 읽어 온다).
 */
import assert from 'node:assert';
import { newState } from '../src/game/state.js';
import { stockOf } from '../src/game/shop.js';
import { takeCutting, repotCutting, stepCuttings } from '../src/game/propagation.js';

const results = [];
const check = (n, f) => { try { f(); results.push(['PASS', n]); }
                          catch (e) { results.push(['FAIL', n, e.message]); } };

const NODES = () => ([
  { nodeId: 'ax0#0', stem: 'pink',  leaves: 1, variegatedLeaves: 0, growthDays: 60 },
  { nodeId: 'ax0#1', stem: 'thick', leaves: 2, variegatedLeaves: 1, growthDays: 80 },
  { nodeId: 'base',  stem: 'main',  leaves: 6, variegatedLeaves: 2, growthDays: 120 }
]);

/* 뿌리를 낸 삽수 하나가 물꽂이에 있는 판 */
function rooted() {
  const S = newState({ room: 'banjiha', mode: 'real' });
  S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', slotId: null, at: null,
                variegated: true, varieChance: 0.2 });
  S.shop.stock.jar = 5;
  S.shop.stock.pot = 5;
  const c = takeCutting(S, { nodes: NODES(), nodeId: 'ax0#0', container: 'jar' });
  for (let i = 0; i < 12; i++) { S.day++; stepCuttings(S); }
  return { S, c };
}

const snap = c => JSON.stringify(c);

/* ══ A · 자리가 올바르면 통째로 된다 (되는 길이 안 막혔나) ══════════════════ */
check('A 자리를 주면 분갈이가 되고 그 자리를 갖는다', () => {
  const { S, c } = rooted();
  const before = stockOf(S, 'pot');
  repotCutting(S, c.id, { at: { x: 0.4, y: 0, z: 0.4 } });
  assert.equal(c.potted, true, '흙으로 안 옮겨졌습니다');
  assert.equal(c.status, 'established', '자리를 못 잡았습니다');
  assert.ok(c.slotId, `slotId 가 ${c.slotId} 입니다 — 자리 없이 흙에 서 있습니다`);
  assert.ok(c.at && Number.isFinite(c.at.x), 'at 좌표가 없습니다');
  assert.equal(stockOf(S, 'pot'), before - 1, '모종포트가 안 나갔습니다');
});

/* ══ B · ★자리 주기가 던지면 **아무것도** 안 바뀐다 — 이게 그 버그다 ══════════
   좌표에 z 가 없다. `place.makeAt` 이 "빠진 좌표를 0으로 메꾸지 않는다"라서 던진다. */
check('B ★자리가 잘못되면 던지고, 삽수는 병에 그대로 남는다 (조용한 실패 없음)', () => {
  const { S, c } = rooted();
  const before = { pot: stockOf(S, 'pot'), jar: stockOf(S, 'jar'), c: snap(c) };
  assert.throws(() => repotCutting(S, c.id, { at: { x: 0.4, y: 0 } }), /배치/,
    '잘못된 자리인데 분갈이가 됐습니다');
  assert.equal(snap(c), before.c,
    `던졌는데 삽수가 바뀌었습니다 — potted=${c.potted} status=${c.status} slotId=${c.slotId}`);
  assert.equal(stockOf(S, 'pot'), before.pot, '던졌는데 모종포트가 나갔습니다');
  assert.equal(stockOf(S, 'jar'), before.jar, '던졌는데 병이 돌아왔습니다');
});

/* ══ C · ★그 뒤에 제대로 된 자리로 다시 하면 된다 (되돌릴 수 있는 상황이다) ══
   조용한 실패의 진짜 벌은 "안 자란다"가 아니라 **다시 할 수 없게 되는 것**이었다:
   `potted` 가 이미 true 라 두 번째 시도는 "이미 흙에 있습니다"로 막혔다. */
check('C ★던진 뒤 제대로 된 자리로 다시 하면 된다 — 「이미 흙에 있습니다」로 안 막힌다', () => {
  const { S, c } = rooted();
  try { repotCutting(S, c.id, { at: { x: 0.4, y: 0 } }); } catch { /* 위 B 가 본다 */ }
  repotCutting(S, c.id, { at: { x: 0.4, y: 0, z: 0.4 } });
  assert.equal(c.potted, true, '두 번째 시도가 안 먹혔습니다');
  assert.ok(c.slotId, '두 번째 시도에서도 자리가 안 붙었습니다');
});

/* ══ D · ★자리를 안 주는 옛 경로는 그대로다 (규칙을 새로 만들지 않았다) ══════ */
check('D 자리를 안 주면 예전처럼 자리 없이 분갈이된다 (경로를 안 없앴다)', () => {
  const { S, c } = rooted();
  repotCutting(S, c.id);
  assert.equal(c.potted, true, '자리 없는 분갈이가 막혔습니다');
  assert.equal(c.slotId, null, '자리를 안 줬는데 자리가 생겼습니다');
});

let fail = 0;
for (const [tag, n, msg] of results) {
  console.log(`${tag}  ${n}` + (msg ? `\n      → ${msg}` : ''));
  if (tag === 'FAIL') fail++;
}
console.log(fail ? `\n✕ ${fail}개 실패` : '\n✓ 전부 통과');
process.exit(fail ? 1 : 0);
