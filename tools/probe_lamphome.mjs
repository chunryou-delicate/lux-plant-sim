/* ============================================================
   tools/probe_lamphome.mjs — **식물등 최초 자리**가 몬스테라와 얼마나 떨어져 있나 (§D-2)
   ------------------------------------------------------------
   박사님 §D-2: *"식물등 최초 위치 이상, 몬스테라 위쪽으로"*

   이 도구는 **고치지 않는다.** 세 가지만 잰다:
     ① 방에 달린 등 기구가 몇 개고 **어느 순서**인가 (등을 하나 사면 어느 것이 켜지나)
     ② 그 기구가 몬스테라의 **도착 자리**·**가야 할 자리**에서 얼마나 떨어져 있나
     ③ 등 0/1/2 개일 때 자리별 DLI — 자리를 옮기면 **무엇이 흔들리는지**의 전·후 표

   ⚠ 자리를 실제로 옮기는 것은 `data/house_rooms.json` 을 고치는 일이고
     그 파일은 **다른 창이 잡고 있다**(2026-08-16 창 배분). 그래서 여기서는 재기만 한다.

     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_lamphome.mjs
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 300000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const ROOM = argOf('--room', 'banjiha');

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html?engine=1&room=${ROOM}`);
await page.waitFor('!!window.__io && !!window.__io.light && !!window.__io.light.room', 120000, 300);
await sleep(1500);

const info = await page.eval(`(() => {
  const L = window.__io.light, room = L.room;
  const d3 = (a, b) => Math.hypot(a.x - b.x, (a.y||0) - (b.y||0), a.z - b.z);
  const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  /* ⚠ 발광점의 이름이 무엇인지 **묻지 않고 짐작하면** 표가 통째로 null 이 된다(그렇게 한 번 났다).
     그래서 열쇠 목록을 같이 낸다 — 재는 자가 무엇을 읽었는지 보이게. */
  const at = (r) => (r && (r.pos || r.at || r.p || r)) || {};
  const rigs = (room.growRigs || []).map((r, i) => {
    const p = at(r);
    return { i, uid: r.uid, preset: r.preset || r.kind || null,
      x: Number.isFinite(+p.x) ? +(+p.x).toFixed(3) : null,
      y: Number.isFinite(+p.y) ? +(+p.y).toFixed(3) : null,
      z: Number.isFinite(+p.z) ? +(+p.z).toFixed(3) : null,
      keys: Object.keys(r).join(',') };
  });
  const slots = (room.slots || []).map(s => ({ slotId: s.slotId, x: +(+s.x).toFixed(3),
    y: +(+s.y).toFixed(3), z: +(+s.z).toFixed(3) }));
  const pick = id => slots.find(s => s.slotId === id) || null;
  return { room: room.id || null, rigCount: rigs.length, rigs, slots,
           arrival: pick('${ROOM}-desk:0'), sill: pick('${ROOM}-sill:0'),
           dist: rigs.filter(r => r.x != null).map(r => ({ uid: r.uid,
             '도착(책상)': pick('${ROOM}-desk:0') ? +d2(r, pick('${ROOM}-desk:0')).toFixed(3) : null,
             '창턱':       pick('${ROOM}-sill:0') ? +d2(r, pick('${ROOM}-sill:0')).toFixed(3) : null })) };
})()`);

console.log(`\n══ §D-2 식물등 최초 자리 — ${info.room || ROOM} ══\n`);
console.log('기구 ' + info.rigCount + '개 (등을 하나 사면 **맨 앞** 것이 켜진다 — light_adapter.rigsOn = growRigs.slice(0, n))');
console.table(info.rigs);
console.log('\n몬스테라 도착 자리 ' + JSON.stringify(info.arrival));
console.log('몬스테라가 가야 할 자리(창턱) ' + JSON.stringify(info.sill));
console.log('\n등 ↔ 화분 **평면 거리**[m]');
console.table(info.dist);

/* ── 등 0/1/2 개일 때 자리별 DLI ── 자리를 옮기면 이 표가 흔들린다 */
const dli = await page.eval(`(() => {
  const L = window.__io.light;
  const out = [];
  for (const s of (L.room.slots || [])) {
    const row = { slotId: s.slotId };
    for (const n of [0, 1, 2]) {
      let v = null;
      try { v = L.dliOfSlot(s.slotId, { weather: 'clear', season: 'summer', lampCount: n, litHours: 12 }); }
      catch (e) { v = null; }
      row['등' + n] = (v == null ? null : +(+v).toFixed(2));
    }
    out.push(row);
  }
  return out;
})()`);
console.log('\n자리별 DLI (맑음·여름 · 점등 12h) — **지금 값**이다');
console.table(dli);

await page.close();
