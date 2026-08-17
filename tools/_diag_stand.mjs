/* 셋째 등(거치형)이 실제로 무엇을 밝히나 — 등 2개 대비 3개 (2026-08-17) */
import { readFileSync } from 'node:fs';
import { createLightEngine } from '../src/game/light_adapter.js';
const light = createLightEngine({ room: 'banjiha', mode: 'novice', seed: 1 });
const slots = light.slots ? light.slots() : null;
const ids = (slots || []).map(s => s.slotId || s.id).filter(Boolean);
const at = (n) => { const m = light.dliBySlot ? light.dliBySlot(n) : null; return m; };
const a = at(2), b = at(3);
if (!a || !b) { console.log('손잡이 없음 — 어댑터 이름 확인 필요', Object.keys(light).join(' ')); process.exit(0); }
const rows = Object.keys(b).map(k => ({ 자리: k, 등2: +(a[k]||0).toFixed(2), 등3: +(b[k]||0).toFixed(2) }))
  .map(r => ({ ...r, 늘어남: +(r.등3 - r.등2).toFixed(2) }))
  .sort((x,y)=> y.늘어남 - x.늘어남);
console.log('── 셋째 등이 밝히는 자리 (많이 늘어난 차례) ──');
for (const r of rows.slice(0,8)) console.log(`  ${r.자리.padEnd(24)} ${String(r.등2).padStart(6)} → ${String(r.등3).padStart(6)}  (+${r.늘어남})`);
console.log('  … 아래 6개');
for (const r of rows.slice(-4)) console.log(`  ${r.자리.padEnd(24)} ${String(r.등2).padStart(6)} → ${String(r.등3).padStart(6)}  (+${r.늘어남})`);
const over = rows.filter(r => r.등3 > 16.0);
console.log(over.length ? `⚠ 과광(16.0) 넘는 자리 ${over.length}개: ${over.map(r=>r.자리+' '+r.등3).join(' , ')}` : '✔ 과광 16.0 넘는 자리 없음');
const grew = rows.filter(r => r.등2 < 6.0 && r.등3 >= 6.0);
console.log(grew.length ? `★ 갈라짐 문턱 6.0 을 새로 넘는 자리: ${grew.map(r=>r.자리+' '+r.등3).join(' , ')}` : '— 6.0 을 새로 넘는 자리는 없다');
