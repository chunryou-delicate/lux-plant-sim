/* ============================================================
   game/contract.js — 계약 객체 `daily_light/1` 검증 (core 소유)
   ------------------------------------------------------------
   light_adapter 에서 떼어냈다(2026-08-01). 이유는 하나다:
   **THREE 없이도 불러야 해서다.** 밸런스 자동 시뮬은 헤드리스로 도는데,
   light_adapter 는 house.js(THREE)를 import 하므로 Node에서 그냥 못 올린다.

   ★ NaN·음수 방어가 여기 있는 이유
     rng() < NaN 은 오류도 없이 항상 false 라, 무늬·갈라짐이 영영 안 나와도 아무도 모른다.
     growth 쪽에도 방어가 있지만 코어가 만들 때도 본다 — 두 번 보는 게 맞다.
============================================================ */
import { BANDS } from '../engine/daily_light.js';

export const CONTRACT_SCHEMA = 'daily_light/1';

export function validateContract(report) {
  const problems = [];
  if (!report || report.schema !== CONTRACT_SCHEMA) {
    problems.push(`계약 스키마가 아닙니다: ${report && report.schema}`);
    return { ok: false, problems, badSlots: new Set() };
  }
  const badSlots = new Set();
  const num = (v) => typeof v === 'number' && isFinite(v) && v >= 0;

  for (const s of report.slots || []) {
    for (const k of ['dli', 'dli_daylight', 'dli_lamp']) {
      if (!num(s[k])) { problems.push(`${s.slotId} · ${k}=${s[k]}`); badSlots.add(s.slotId); }
    }
    /* 밴드 이름에 로직을 걸지 않는다(개칭 진행 중). 목록에 있는지만 본다. */
    if (s.band !== 'unknown' && !BANDS.includes(s.band)) {
      problems.push(`${s.slotId} · 모르는 밴드 "${s.band}"`);
    }
  }
  if (!report.best) problems.push('best 슬롯이 없습니다 (슬롯 0개?)');
  return { ok: problems.length === 0, problems, badSlots };
}
