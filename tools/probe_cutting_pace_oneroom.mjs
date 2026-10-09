/* ============================================================
   probe_cutting_pace_oneroom.mjs — 원룸 «화분대가 커지는 맛»의 빠르기: 뿌리낸 삽수가 1·3·6·9달에 잎 몇 장 · 무늬 몇 장 ([growth] · 2026-10-09)
   ------------------------------------------------------------
   ★ 총괄 물음(박사님 «계속 돌려» · 값 0 · 재기만): 원룸의 재미가 «화분대가 커지는 맛»(D41 · D46)으로 갔다 —
     그 맛이 원룸 8~12달 안에 느껴지는 빠르기인가. 그리고 «작은 그루가 "자랐다"로 읽히는 잎 수»에 언제 닿나.
   ★ 삽수는 growth 엔진이 아니라 core(propagation §stepCuttings)가 키운다 — 그 규칙을 «읽어서» 그대로 센다(크롬 없음):
     ① 흙에 자리 잡은 뒤(established)부터. 그날 DLI 의 밴드가 NO_GROW_BANDS(loop.js)가 아니면 하루가 쌓인다
        (밴드는 몬스테라 문턱 · 무늬 삽수는 need_mult 배 — plant_grow §bandOf 와 같은 자)
     ② CUTTING_LEAF_DAYS(propagation)일이 쌓이면 잎 한 장
     ③ 새 잎 무늬: roll < youngVarieChanceOf(c.varieChance)(D40 ×2 · 상한 — growth_tuning varie_boost)
        무늬 삽수(varieFromCut)의 c.varieChance = VARIE_LIGHT[뿌리낸 날 그 자리 밴드의 걸음](dark·mid·bright) · 민무늬 삽수 = 0
   ★ 자리 넷(총괄): 창턱 등0 · 창턱 등1(oneroom-sill:0) · 에타제르 맨 윗단 + 집게등 · 에타제르 가운데단(banjiha-etagere:6 · :3)
     «집게등» = 원룸 프로필의 등 셋째 자리(에타제르 위) «하나만» 켠 몫 [셈] — ppfd[3] − ppfd[2](등 셋을 켠 값에서 둘을 켠 값을 뺌)
     가운데단은 등 없이 · 그리고 «윗단에 단 그 집게등이 비추는» 몫을 따로 한 줄
   ★ 시작: 원룸 1일째에 흙에 자리 잡음(들고 온 잎 1장) · 이사 계절(YD0) 둘 · 무늬는 판마다 굴림이 달라 SEEDS 판 중앙·10%·90%
     MONTH=30일 · 1·3·6·9달 = 30·90·180·270일 · «자랐다» 잎 수 = GROWN(기본 3 — leaf 와 맞출 값 · 아래 키 표 참고)
     YD0S=135,315 SEEDS=400 GROWN=3 OUT=docs/handoff/growth-cutting-pace-oneroom.json node tools/probe_cutting_pace_oneroom.mjs
   ⛔ 값·확률·문턱은 안 건드린다.
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileLight } from '../src/game/room_profile.js';
import { NO_GROW_BANDS } from '../src/game/loop.js';
import { CUTTING_LEAF_DAYS, VARIE_LIGHT, varieLightStepOf, youngVarieChanceOf, varieBoostRules } from '../src/game/propagation.js';
import { judgeDLI, thresholdsFor, lampDLI } from '../src/engine/daily_light.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const FILE = process.env.PROFILE || 'data/profiles/room_profile.oneroom.json';
const YD0S = (process.env.YD0S || '135,315').split(',').map(Number);
const SEEDS = Number(process.env.SEEDS || 400), GROWN = Number(process.env.GROWN || 3), DAYS = Number(process.env.DAYS || 400);
const MONTHS = [1, 3, 6, 9, 12], MONTH = 30;
const TH = J('data/balance/light_thresholds.json'), P = J(FILE);
const W = J('data/balance/weather.json'), E = J('data/balance/electricity.json');
const prof = Object.fromEntries(P.slots.map(s => [s.slotId, s]));
const bandOf = (dli, varie) => judgeDLI(dli, thresholdsFor(TH, 'monstera_deliciosa', varie)).band;
/* 자리 — slot · 등 수 · 덧붙는 등 ppfd(집게등 하나만 켠 몫) */
const clip = sid => prof[sid].ppfd[3] - prof[sid].ppfd[2];
const PLACES = [
  { id: 'sill0',  ko: '창턱 등0',                    slot: 'oneroom-sill:0',     lamps: 0, extra: 0 },
  { id: 'sill1',  ko: '창턱 등1',                    slot: 'oneroom-sill:0',     lamps: 1, extra: 0 },
  { id: 'etTop',  ko: '에타제르 맨 윗단 + 집게등',   slot: 'banjiha-etagere:6',  lamps: 0, extra: clip('banjiha-etagere:6') },
  { id: 'etMid',  ko: '에타제르 가운데단(등 없음)',   slot: 'banjiha-etagere:3',  lamps: 0, extra: 0 },
  { id: 'etMidC', ko: '에타제르 가운데단 + 윗단 집게등', slot: 'banjiha-etagere:3', lamps: 0, extra: clip('banjiha-etagere:3') }
];
/* 무늬 굴림 — 판마다 다른 굴림(xorshift · 씨앗 고정이라 다시 돌려도 같다) */
const rng = s => { let x = (s * 2654435761) >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };
const q = (a, f) => { const v = a.slice().sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(f * (v.length - 1)))]; };
console.log(`══ 원룸 삽수 빠르기 — ${FILE} · roomRev ${String(P.roomRev || '').split(' ')[0]} · real · 원룸 1일째 흙에 자리 잡음(들고 온 잎 1장) · 무늬 ${SEEDS}판`);
console.log(`   잎 한 장 = 자라는 날 ${CUTTING_LEAF_DAYS}일 · D40 배율 ${JSON.stringify(varieBoostRules())} · VARIE_LIGHT ${JSON.stringify(VARIE_LIGHT)} · «자랐다» = 잎 ${GROWN}장`);
const rows = [];
for (const YD0 of YD0S) {
  console.log(`\n── 이사 YD0 ${YD0} ──  (잎 = 들고 온 1 + 난 잎 · 무늬 = 중앙[10%~90%] · 1·3·6·9·12달)`);
  for (const pl of PLACES) {
    const light = createProfileLight({ ...P, uidStable: true }, { thresholds: TH, weather: W, electricity: E });
    const dli = [];
    for (let d = 1; d <= DAYS; d++) {
      const rep = light.daily(d, { sim: { mode: 'real', yearDay0: YD0 }, lamps: { count: pl.lamps, litHours: 12 }, pots: [], placedItems: [] }).report;
      const s = (rep.slots || []).find(x => x.slotId === pl.slot);
      dli.push((s ? s.dli : 0) + (pl.extra ? lampDLI(pl.extra, 12) : 0));
    }
    for (const varie of [false, true]) {
      /* 잎이 나는 날(굴림과 무관 · 무늬 삽수는 문턱이 need_mult 배) */
      let acc = 0; const leafDays = [];
      for (let d = 1; d <= DAYS; d++) { if (!NO_GROW_BANDS.has(bandOf(dli[d - 1], varie))) acc++; if (acc >= CUTTING_LEAF_DAYS) { acc -= CUTTING_LEAF_DAYS; leafDays.push(d); } }
      const leavesAt = m => 1 + leafDays.filter(d => d <= m * MONTH).length;
      /* 무늬 소질 — 뿌리낸 날(1일째) 그 자리 밴드의 걸음 */
      const step = varie ? varieLightStepOf(bandOf(dli[0], false)) : null;
      const chance = varie ? (step ? VARIE_LIGHT[step] : 0) : 0;
      const pRoll = youngVarieChanceOf(chance) || 0;
      const varieAt = {};
      for (const m of MONTHS) {
        const n = leafDays.filter(d => d <= m * MONTH).length, per = [];
        for (let s = 1; s <= SEEDS; s++) { const r = rng(s * 7919 + m); let v = 0; for (let i = 0; i < n; i++) if (r() < pRoll) v++; per.push(v); }
        varieAt[m] = { p50: q(per, 0.5), p10: q(per, 0.1), p90: q(per, 0.9) };
      }
      const grownDay = leafDays[GROWN - 2] ?? null;     // 들고 온 1 + (GROWN−1) 장째가 난 날
      const row = { yearDay0: YD0, place: pl.id, ko: pl.ko, variegated: varie, lightStep: step, varieChance: chance, rollP: pRoll,
        leaves: Object.fromEntries(MONTHS.map(m => [m, leavesAt(m)])), varieLeaves: varieAt, grownDay, firstLeafDay: leafDays[0] ?? null };
      rows.push(row);
      const f = m => `${String(leavesAt(m)).padStart(2)}(${varieAt[m].p50}${varie ? `[${varieAt[m].p10}~${varieAt[m].p90}]` : ''})`;
      console.log(`   ${(pl.ko + (varie ? ' · 무늬' : ' · 민무늬')).padEnd(34)} ${MONTHS.map(f).join('  ')}   첫 새 잎 ${row.firstLeafDay ?? '—'}일 · 잎 ${GROWN}장 ${grownDay ?? '안 닿음'}${grownDay ? '일' : ''}${varie ? ` · 소질 ${step || '—'} ${chance} → 굴림 ${pRoll}` : ''}`);
    }
  }
}
console.log(`\n   (잎 = 그 달 끝까지의 잎 수(들고 온 1 포함) · 괄호 = 무늬 잎 중앙[10%~90%] · ${SEEDS}판 굴림)`);
if (process.env.OUT) fs.writeFileSync(path.join(ROOT, process.env.OUT), JSON.stringify({ meta: { profile: FILE, roomRev: String(P.roomRev || '').split(' ')[0], mode: 'real', seeds: SEEDS, grown: GROWN, month: MONTH, leafEvery: CUTTING_LEAF_DAYS, varieBoost: varieBoostRules(), varieLight: VARIE_LIGHT, start: '원룸 1일째 흙에 자리 잡음 · 들고 온 잎 1' }, rows }, null, 1));
