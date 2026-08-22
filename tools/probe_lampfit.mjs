/* ============================================================
   tools/probe_lampfit.mjs — **집게등이 찍은 데 안 붙는다**를 숫자로 (house)
   ------------------------------------------------------------
   무엇을 재나
     방 안 한 점(x,z)을 찍었을 때 `room_view §lampFit` 이 **어느 상판을 고르나**.
     그 고르는 규칙을 여기 그대로 옮겨 적었다(호출하지 않는다 — 브라우저가 필요하다).

       cands = XZ 로 그 점을 품는 상판 전부 (pad 0.25)
       고르는 것 = |mount.y − wantY| 가 제일 작은 것
       wantY = pos.y 가 오면 그것, **안 오면 등이 지금 서 있는 y**

   ★ 두 가지를 나란히 낸다 — 무엇이 달라지는지 한눈에 보라고.
       [지금]   pos.y 를 **안 넘긴다** — `game.html:12786` 이 { x, z, lift } 만 준다
       [고친 뒤] pos.y = **커서가 얹힌 상판의 y** — 즉 손가락이 가리킨 높이를 살린다

   왜 아픈가
     반지하에서 창턱은 **유일한 밝은 자리**다 — 창턱 3.68 · 선반 맨 윗칸 0.51 (7배).
     그런데 집게등(y 1.1364)에게는 선반(0.794)이 창턱(1.585)보다 가깝다.
     ⇒ **창턱을 정확히 찍어도 선반이 이긴다.**
     ⇒ 그리고 되먹임이 있다 — 한 번 선반에 붙으면 wantY 가 0.794 가 되어 창턱이 **더** 멀어진다.
       **등이 아래에 갇힌다.**

   쓰는 법
     node tools/probe_lampfit.mjs              (반지하)
     node tools/probe_lampfit.mjs oneroom      (다른 방)
   ⚠ 이 도구는 `lampFit` 을 **베껴 적은 것**이다. 저쪽이 바뀌면 여기도 같이 고쳐야 한다.
     진짜 회귀 잠금은 브라우저를 쓰는 `test_lampmove.mjs` 2부가 할 일이다.
============================================================ */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataOf = r => JSON.parse(fs.readFileSync(path.join(ROOT,'data',r),'utf8'));
const stubCtx = () => new Proxy({}, { get: (t,k) => {
  if (k==='createImageData'||k==='getImageData') return (w=1,h=1)=>({data:new Uint8ClampedArray(Math.max(1,w*h*4)),width:w,height:h});
  if (k==='createLinearGradient'||k==='createRadialGradient') return ()=>({addColorStop(){}});
  if (k==='measureText') return ()=>({width:0});
  return ()=>{}; } });
const stubEl = () => ({ style:{}, dataset:{}, appendChild(){}, setAttribute(){}, getContext:()=>stubCtx(), width:0, height:0 });
globalThis.document = { createElement: stubEl, body: stubEl(), getElementById: ()=>stubEl() };
globalThis.window = globalThis;
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'vendor/three/three.min.js'),'utf8'));
const { createLightEngine } = await import(pathToFileURL(path.join(ROOT,'src/game/light_adapter.js')).href);
const HOUSE = dataOf('house_rooms.json'), TH = dataOf('balance/light_thresholds.json');
const mk = mutate => { const hr = JSON.parse(JSON.stringify(HOUSE)); mutate(hr);
  return createLightEngine({ houseRooms:hr, winPresets:dataOf('window_presets.json').presets,
    doorPresets:dataOf('door_presets.json').presets, finishes:dataOf('room_finishes.json'),
    furnPresets:dataOf('furniture_presets.json').presets, lightPresets:dataOf('lighting_presets.json'),
    shadePresets:dataOf('shading_presets.json'), lightTh:TH, weatherBalance:dataOf('balance/weather.json') }); };
const SKY = { weather:'clear', season:'summer' };
const read = eng => { const r = eng.build('banjiha');
  return r.slots.map(s => { eng.clearCache(); return [s.slotId, +eng.dliOfSlot(s.slotId,{...SKY,lampCount:2}).toFixed(4)]; }); };


const ROOM = process.argv[2] || 'banjiha';
const PAD = 0.25;                      // lampFit 이 pointInMountXZ 에 주는 여유 — 집게는 가장자리에 문다
const eng = mk(() => {});
const r = eng.build(ROOM);
r.built.room.updateMatrixWorld(true);

const inMount = (m, x, z) => {
  const rr = (m.rot || 0) * Math.PI / 180, c = Math.cos(rr), s = Math.sin(rr);
  const dx = x - m.x, dz = z - m.z;
  const u = dx * c - dz * s, v = dx * s + dz * c;
  return Math.abs(u) <= m.w / 2 + PAD && Math.abs(v) <= m.d / 2 + PAD;
};

/* room_view.lampMounts — **화분 자리가 있는 상판**만 물릴 데가 된다 */
const nodes = new Map();
for (const g of r.built.furniture.children)
  if (g.userData && g.userData.uid && g.userData.size) nodes.set(g.userData.uid, g);
const byKey = new Map();
for (const s of (r.built.plantSlots || [])) {
  const owner = String(s.slotId).slice(0, String(s.slotId).lastIndexOf(':'));
  const g = nodes.get(owner); if (!g) continue;
  const key = owner + '@' + s.y.toFixed(3);
  if (!byKey.has(key)) {
    const sz = g.userData.size;
    byKey.set(key, { uid: owner, y: s.y, x: +g.position.x.toFixed(4), z: +g.position.z.toFixed(4),
                     w: sz.w, d: sz.d, rot: +((g.rotation.y || 0) * 180 / Math.PI).toFixed(2) });
  }
}
const mounts = [...byKey.values()].sort((a, b) => a.y - b.y);

/* 그 점에서 커서가 실제로 얹히는 상판 — 눈에 보이는 것은 **제일 위**다.
   (진짜 UI 는 광선을 쏜다. 여기서는 그 점을 품는 상판 중 제일 높은 것으로 대신한다.) */
const topAt = (x, z) => {
  const c = mounts.filter(m => inMount(m, x, z));
  return c.length ? c[c.length - 1] : null;
};
/* lampFit 의 고르는 규칙 */
const pick = (x, z, wantY) => {
  const c = mounts.filter(m => inMount(m, x, z));
  if (!c.length) return null;
  c.sort((a, b) => Math.abs(a.y - wantY) - Math.abs(b.y - wantY));
  return c[0];
};

const clip = (r.built.lightRigs || []).find(g => g.id === 'growlight_clip');
console.log('방 ' + ROOM + ' · 물릴 상판 ' + mounts.length + '개');
for (const m of mounts) console.log('   ' + m.uid.padEnd(24) + ' y ' + m.y.toFixed(3).padStart(6) + '  ' + m.w.toFixed(2) + 'x' + m.d.toFixed(2));
if (!clip) { console.log('\n이 방엔 집게등이 없습니다.'); process.exit(0); }
console.log('\n집게등 ' + clip.uid + ' 지금 y ' + clip.pos.y.toFixed(4));

/* 상판마다: 그 상판 위를 찍었을 때 그 상판에 붙나 */
console.log('\n상판                       점수   [지금] 맞음   [고친 뒤] 맞음');
let t0 = 0, h0 = 0, t1 = 0, h1 = 0;
for (const m of mounts) {
  let n = 0, a = 0, b = 0;
  for (let x = m.x - m.w / 2 - PAD; x <= m.x + m.w / 2 + PAD; x += 0.05)
    for (let z = m.z - m.d / 2 - PAD; z <= m.z + m.d / 2 + PAD; z += 0.05) {
      if (topAt(x, z) !== m) continue;        // 커서가 이 상판에 얹힌 점만 센다
      n++;
      if (pick(x, z, clip.pos.y) === m) a++;  // [지금]  등의 지금 높이가 기준
      if (pick(x, z, m.y) === m) b++;         // [고친 뒤] 커서가 얹힌 상판의 높이가 기준
    }
  if (!n) continue;
  t0 += n; h0 += a; t1 += n; h1 += b;
  const p = x => (100 * x / n).toFixed(0).padStart(3) + '%';
  console.log('   ' + m.uid.padEnd(24) + String(n).padStart(5) + '   ' + p(a) + '        ' + p(b) +
              (a < n ? '   ★' : ''));
}
console.log('\n합계   [지금] ' + h0 + '/' + t0 + ' = ' + (100 * h0 / t0).toFixed(0) + '%   →   [고친 뒤] ' +
            h1 + '/' + t1 + ' = ' + (100 * h1 / t1).toFixed(0) + '%');

/* 되먹임 — 한 번 낮은 데 붙으면 높은 데가 더 멀어진다 */
console.log('\n== 되먹임: 선반에 한 번 붙였다가 창턱을 다시 찍으면 ==');
const sill = mounts.find(m => /sill/.test(m.uid));
const low  = mounts.filter(m => m !== sill).sort((a, b) => b.y - a.y)[0];
if (sill && low) {
  const now  = pick(sill.x, sill.z, clip.pos.y);
  const after = pick(sill.x, sill.z, low.y);      // 낮은 데 붙은 뒤 다시 창턱을 찍는다
  console.log('   창턱 한가운데를 찍음');
  console.log('     처음(등 y ' + clip.pos.y.toFixed(3) + ')          → ' + (now ? now.uid : '없음'));
  console.log('     ' + low.uid + '(y ' + low.y.toFixed(3) + ') 에 붙은 뒤 → ' + (after ? after.uid : '없음'));
  console.log('     [고친 뒤]                       → ' + (pick(sill.x, sill.z, sill.y) || {}).uid);
  if (now !== sill && after !== sill) console.log('   ★ 두 번 다 창턱이 아니다 — 등이 아래에 갇힌다');
}
