/* 가방 안 그루 이어하기 — 거짓 «⚠ 복원» 경고가 없다(core 11-03 · 총괄 post19 덧붙임)
   이사(oneroom §clearPlacements)는 그루를 «가방»(slotId · at 없음 · placedOnce === false)으로 둔다. 그 판을 저장했다가 불러오면
   §migratePots 가 그 그루를 «좌표를 못 채움»으로 세어 save.js §reseat 가 «⚠ 복원 — pot_01 의 좌표를 못 채웠습니다: slotId 가 없습니다»를 적었다.
   단언
     ㉮ 가방 안 몬스테라(이사 날 꼴)를 저장 → 불러오기 — 기록에 «⚠ 복원 … 좌표를 못 채웠습니다» 줄이 없다 · migratePots skipped 0
     ㉯ 그 그루는 그대로 가방 안이다(slotId · at 없음 · placedOnce 거짓 · 잎 셈 칸 그대로)
     ㉰ 옛 모양(placedOnce 칸 없음 · slotId 없음)은 지금처럼 skipped 로 센다(고침이 좁다)
   ⛔ 값 · 하네스 안 건드림 · 조도 엔진 없이(빈 자리 표) */
import assert from 'node:assert/strict';
import { newState, migratePots } from '../src/game/state.js';
import { serialize, deserialize } from '../src/game/save.js';

const results = [];
const check = (n, f) => { try { f(); results.push(['PASS', n]); } catch (e) { results.push(['FAIL', n, e.message]); } };

const bagged = () => {
  const S = newState({ room: 'banjiha' });
  if (!S.pots.length) S.pots.push({ id: 'pot_01', plantId: 'monstera_deliciosa', variegated: false, daysPlanted: 3 });
  const p = S.pots[0];
  p.slotId = null; p.at = null; p.placedOnce = false;   /* oneroom §clearPlacements 와 같은 꼴 */
  return S;
};

check('㉮ 가방 안 몬스테라 저장 → 불러오기 — «⚠ 복원 … 좌표를 못 채웠습니다» 줄 없음', () => {
  const S = bagged();
  const n0 = (S.log || []).length;
  const back = deserialize(serialize(S), { allowMissingGrowth: true });
  const lines = (back.log || []).slice(0).map(x => x && x.msg).filter(m => typeof m === 'string' && m.includes('좌표를 못 채웠습니다'));
  assert.equal(lines.length, 0, `★거짓 경고가 섰습니다 — ${JSON.stringify(lines)} (기록 ${n0} → ${(back.log || []).length})`);
});
check('㉮ migratePots — 가방 안 그루는 skipped 0', () => {
  const S = bagged();
  const r = migratePots(S, []);
  assert.equal((r.skipped || []).length, 0, `★skipped ${JSON.stringify(r.skipped)}`);
});
check('㉯ 그 그루는 그대로 가방 안(자리 · 좌표 없음 · placedOnce 거짓)', () => {
  const S = bagged();
  const back = deserialize(serialize(S), { allowMissingGrowth: true });
  const p = back.pots.find(x => x && x.id === S.pots[0].id);
  assert.ok(p, '그루를 잃었습니다');
  assert.ok(!p.slotId && !p.at && p.placedOnce === false, `★가방 꼴이 아닙니다 — ${JSON.stringify({ slotId: p.slotId, at: p.at, placedOnce: p.placedOnce })}`);
});
check('㉰ 옛 모양(placedOnce 칸 없음 · slotId 없음)은 지금처럼 skipped 로 센다', () => {
  const S = newState({ room: 'banjiha' });
  S.pots.length = 0;
  S.pots.push({ id: 'pot_old', plantId: 'monstera_deliciosa', variegated: false, daysPlanted: 3 });
  const r = migratePots(S, []);
  assert.equal((r.skipped || []).filter(x => x.id === 'pot_old').length, 1, `skipped ${JSON.stringify(r.skipped)}`);
});

let bad = 0;
for (const [k, n, m] of results) { console.log(`${k === 'PASS' ? '  OK' : 'FAIL'}  ${n}${m ? '  → ' + m : ''}`); if (k !== 'PASS') bad++; }
console.log(bad ? `test_bag_pot_restore: 빨강 ${bad}` : 'test_bag_pot_restore: 다 통과');
process.exit(bad ? 1 : 0);
