/* ============================================================
   tools/probe_shelf_lift.mjs — 3단 선반을 올리면 **빛이 따라오나** (G-12)
   ------------------------------------------------------------
   박사님: *"3단 거치대가 서랍장이나 책상 위로도 올라가게 해 줘. … 창턱 위치로 비슷하게
            올라가면 그 빛량 가능하도록 하거나 이렇게 자유롭게"*

   ★ 이 자가 답할 것은 **하나**다 — 가구를 올리면 그 위 자리의 조도가 따라 오르나.
     안 따라오면 그것이 이 일의 핵심이고, 따라오면 남는 일은 「올릴 길을 내는 것」뿐이다.

   무엇을 켜고 무엇을 껐나
     · 실제 game.html · 반지하 · 등 0개(자연광만) · localStorage 비움
     · **파일을 안 고친다** — 조도 엔진의 `setFurnitureOverrides` 로 런타임에만 올린다
       (data/house_rooms.json 은 지금 다른 창이 잡고 있다)
     · 견줄 자리: 3단 선반 9칸 · 창턱 1칸 · 서랍장·책상
     · 높이는 셋 — 0(바닥) · 0.80(서랍장 상판) · 1.55(창턱 높이)
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';

const page = await launch({ width: 1000, height: 800, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);

const LIFTS = [0, 0.80, 1.55];
const raw = await page.eval(`(()=>{ const L = window.__io.light;
  /* 맑음·여름·등 0 — novice 모드가 실제로 도는 하늘이다(START-HERE §2.9 ④) */
  const SKY = { weather: 'clear', season: 'summer', lampCount: 0, litHours: 12 };
  const list = L.furnitureList();
  const me = list.find(f => f.uid === 'banjiha-etagere');
  const out = { furn: list.map(f=>({uid:f.uid, preset:f.preset, x:f.x, z:f.z, y:f.y??0})), runs: [] };
  const read = () => {
    const m = {};
    for (const s of L.room.slots)
      m[s.slotId] = { y:+(s.y??0).toFixed(3), dli:+L.dliOfSlot(s.slotId, SKY).toFixed(2) };
    return m;
  };
  for (const lift of ${JSON.stringify(LIFTS)}) {
    L.setFurnitureOverrides(lift === 0 ? {}
      : { 'banjiha-etagere': { x: me.x, z: me.z, rot: me.rot ?? 0, y: lift } });
    L.clearCache();
    out.runs.push({ lift, slots: read() });
  }
  L.setFurnitureOverrides({});          /* 반드시 되돌린다 — 안 그러면 다음 검사가 낡은 방을 잰다 */
  L.clearCache();
  out.restored = read();
  return JSON.stringify(out); })()`);

const o = JSON.parse(raw);
const ids = Object.keys(o.runs[0].slots);
console.log(`\n반지하 · 등 0개(자연광만) · 3단 선반(banjiha-etagere)을 통째로 올려 본다\n`);
console.log('자리'.padEnd(22) + LIFTS.map(l => `y+${l.toFixed(2)}`.padStart(16)).join(''));
console.log('-'.repeat(22 + 16 * LIFTS.length));
for (const id of ids) {
  const cells = o.runs.map(r => {
    const v = r.slots[id];
    return v ? `${v.y.toFixed(2)}m ${v.dli.toFixed(2)}`.padStart(16) : ''.padStart(16);
  });
  console.log(id.padEnd(22) + cells.join(''));
}
console.log('-'.repeat(22 + 16 * LIFTS.length));

/* 되돌렸나 — 안 되돌리면 다음 검사가 흔들린다 */
let drift = 0;
for (const id of ids)
  drift = Math.max(drift, Math.abs((o.restored[id] || {}).dli - o.runs[0].slots[id].dli) || 0);
console.log(`되돌린 뒤 어긋남 ${drift.toFixed(4)}  (0 이어야 한다)`);

const top = 'banjiha-etagere:8';
const a = o.runs[0].slots[top], c = o.runs[2].slots[top];
if (a && c) console.log(`\n★ 3단 맨 윗칸 ${top} — 바닥에서 ${a.y}m/${a.dli} → 창턱높이로 올리면 ${c.y}m/${c.dli}`
  + `  (창턱 ${o.runs[0].slots['banjiha-sill:0'] ? o.runs[0].slots['banjiha-sill:0'].dli : '?'})`);
console.log(`\nJSON=${raw}`);
await page.close();
