/* ============================================================
   tools/gen_room_profile.mjs — data/profiles/room_profile.*.json 을 **노드에서** 다시 뽑는다
   ------------------------------------------------------------
     node tools/gen_room_profile.mjs                 # 기본 banjiha — 지금 파일과 대조만 한다
     node tools/gen_room_profile.mjs --write         # 다르면 파일에 쓴다
     node tools/gen_room_profile.mjs --rooms=banjiha,oneroom --write

   ── 왜 만들었나 ────────────────────────────────────────────────
   여태 프로필은 `_profile_gen.html` 로만 뽑았다. 브라우저를 띄우고 손으로 저장해
   붙여 넣는 길이라, 「고칠 때마다 다시 뽑기」가 사실상 안 됐다. 그래서 자리 좌표를
   건드릴 때마다 프로필이 조용히 낡았다.
   이 도구는 **같은 정본**(`light_adapter.profile`)을 부른다. 물리를 다시 쓰지 않는다.
   하네스(스텁 DOM + three)는 `tools/test_floorlight.mjs` 와 글자 그대로 같다.

   ── 브라우저 것과 같은가 ────────────────────────────────────────
   ★ 재서 확인했다: 아무것도 안 고친 상태에서 이 도구를 돌리면
     `data/profiles/room_profile.banjiha.json` 이 **바이트 단위로 같게** 나온다
     (`--write` 없이 돌리면 "SAME" 이 뜬다). 그러니 브라우저 대신 이걸 써도 된다.

   ⚠ 임시 uid(TEMP~) 가 있는 방은 `light_adapter.profile` 이 일부러 던진다.
     apartment·classroom·greenhouse·tworoom 이 그렇다 — 이 도구로는 못 뽑는다.
     그 파일들은 2026-08-02 것이고 이미 낡았다(예: oneroom 은 파일 11칸, 지금 15칸).
============================================================ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toUrl = (rel) => 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');
const dataOf = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', rel), 'utf8'));

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const ROOMS = (args.find(a => a.startsWith('--rooms=')) || '--rooms=banjiha').slice(8)
  .split(',').map(s => s.trim()).filter(Boolean);

/* ── 스텁 DOM (three 가 캔버스를 만든다) ── */
const stubCtx = () => new Proxy({}, { get: (t, k) => {
  if (k === 'createImageData' || k === 'getImageData')
    return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
  if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
  if (k === 'measureText') return () => ({ width: 0 });
  return () => {};
} });
const stubEl = () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {},
                        addEventListener() {}, getContext: () => stubCtx() });
globalThis.document = {
  createElement: (t) => (t === 'canvas'
    ? { width: 1, height: 1, style: {}, getContext: () => stubCtx(), toDataURL: () => '' } : stubEl()),
  createElementNS: () => stubEl(), addEventListener() {}, getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [], body: stubEl(), documentElement: stubEl()
};
globalThis.window = globalThis;
globalThis.self = globalThis;
const realError = console.error, realWarn = console.warn;
console.error = () => {}; console.warn = () => {};
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'vendor', 'three', 'three.min.js'), 'utf8'));

const { createLightEngine } = await import(toUrl('src/game/light_adapter.js'));
const light = createLightEngine({
  houseRooms: dataOf('house_rooms.json'), winPresets: dataOf('window_presets.json').presets,
  doorPresets: dataOf('door_presets.json').presets, finishes: dataOf('room_finishes.json'),
  furnPresets: dataOf('furniture_presets.json').presets, lightPresets: dataOf('lighting_presets.json'),
  shadePresets: dataOf('shading_presets.json'), lightTh: dataOf('balance/light_thresholds.json'),
  weatherBalance: dataOf('balance/weather.json')
});
console.error = realError; console.warn = realWarn;

let changed = 0;
for (const id of ROOMS) {
  light.build(id);
  const prof = light.profile([0, 1, 2]);
  const file = path.join(ROOT, 'data', 'profiles', `room_profile.${id}.json`);
  const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  /* ★ generatedAt/By 는 **옛 파일 것을 그대로 물려받는다** — 물리가 안 바뀌었는데
     날짜만 달라져서 "바뀌었다"로 보이면 대조가 못 쓸 물건이 된다. 내용이 실제로
     달라졌을 때만 아래에서 새로 찍는다. */
  prof.generatedAt = (old && old.generatedAt) || new Date().toISOString().slice(0, 10);
  prof.generatedBy = (old && old.generatedBy) || 'tools/gen_room_profile.mjs (light_adapter.profile)';
  const bodyOf = (p) => JSON.stringify({ ...p, generatedAt: null, generatedBy: null });
  const same = old && bodyOf(old) === bodyOf(prof);
  if (same) { console.log(`${id}: SAME (${prof.slots.length}칸 · 안 씀)`); continue; }
  changed++;
  const best = prof.slots.reduce((a, b) => b.ratio > a.ratio ? b : a);
  console.log(`${id}: DIFF (${prof.slots.length}칸 · best ${best.slotId} ratio ${best.ratio})`);
  if (old) {
    const oldBy = new Map(old.slots.map(s => [s.slotId, s]));
    for (const s of prof.slots) {
      const o = oldBy.get(s.slotId);
      if (!o) { console.log(`   + ${s.slotId} 새 자리`); continue; }
      const dp = ['x', 'y', 'z'].map(k => +(s.point[k] - o.point[k]).toFixed(4));
      if (dp.some(v => v !== 0) || o.ratio !== s.ratio)
        console.log(`   ~ ${s.slotId.padEnd(20)} 자리 ${JSON.stringify(o.point)} → ${JSON.stringify(s.point)}` +
                    ` · ratio ${o.ratio} → ${s.ratio} · ppfd [${o.ppfd}] → [${s.ppfd}]`);
    }
  }
  /* ★ `tools/test_banjiha_profile.mjs` 의 LIVE 표도 여기서 뽑는다. 그 검사는 집을 안 짓기
     때문에 스스로 라이브 값을 낼 수 없다 — 손으로 적던 자리라 제일 잘 낡던 표다. */
  const bestLive = prof.slots.reduce((a, b) => b.ratio > a.ratio ? b : a);
  console.log(`   ── test_banjiha_profile 의 LIVE 표 (맑음·여름·등 0개) ──`);
  console.log(`   best: '${bestLive.slotId}',`);
  console.log('   dli: {');
  for (const s of prof.slots) {
    light.clearCache();
    const v = +light.dliOfSlot(s.slotId, { weather: 'clear', season: 'summer', lampCount: 0, litHours: 0 }).toFixed(2);
    console.log(`     '${s.slotId}': ${v},`);
  }
  console.log('   }');
  if (WRITE) {
    prof.generatedAt = new Date().toISOString().slice(0, 10);
    prof.generatedBy = 'tools/gen_room_profile.mjs (light_adapter.profile)';
    fs.writeFileSync(file, JSON.stringify(prof, null, 2) + '\n', 'utf8');
    console.log(`   → 썼다: data/profiles/room_profile.${id}.json`);
  }
}
if (!WRITE && changed) console.log('\n(--write 를 붙이면 파일에 쓴다)');
process.exit(0);
