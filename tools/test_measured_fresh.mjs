/* ============================================================
   tools/test_measured_fresh.mjs — **낡은 표에 켜지는 경고등** (house 소유)
   ------------------------------------------------------------
   왜 있나
     2026-08-23 아침에 반지하 `measured` 가 **반만 낡아** 있었다 — 날짜·roomRev 는
     08-02 인데 어두운 자리 좌표만 누군가 최신으로 고쳐 두었다. 통째로 낡으면
     「낡았구나」 하고 의심하는데, **반만 맞으면 믿게 된다.**
     그날 하루에 같은 종류가 넷 나왔다(얼린 표 셋 + 두 표가 갈린 것 하나).
     넷 다 **초록이면서 낡은 것을 보고 있었다.** 그것을 알려 주는 등이 없었다.

   무엇을 재나 — 셋을 따로 잰다. 섞으면 또 「반만 맞는 표」가 된다.
     A  `roomRev` 가 **진짜 커밋**을 가리키나
     B  `measuredAt` 뒤로 **이 방 값에 닿는 것**이 바뀌었나        ← 넓게 잡는다
     C  ★ **그래서 값이 실제로 달라졌나** — 지금 재서 견준다        ← 이게 판정이다

   ★ B 는 「의심하라」이고 C 가 「틀렸다」이다. **B 만 걸리면 안 떨어뜨린다** —
     넓게 잡은 자가 늘 붉으면 아무도 안 본다. B 만 걸린 방은 「다시 재서 확인했다.
     `measuredAt` 만 갱신하면 닫힌다」로 안내한다.
     ⚠ **닫는 길이 비싸면 사람이 검사를 끈다.** 그래서 한 명령으로 닫게 해 두었다.

   닫는 문:
     BYEOT_REGEN=1 node tools/test_measured_fresh.mjs
       → 값이 **같은** 방은 `measured.slots.verifiedAt` 에 오늘을 적어 준다.
       → 값이 **다른** 방은 안 건드린다. 그건 날짜 문제가 아니라 다시 재야 할 일이다.

   ⚠⚠ **`measuredAt` 은 안 건드린다 — 하마터면 이 등이 잡으라는 함정을 이 등이 만들 뻔했다.**
     `measuredAt` 은 `measured` **블록 전체**의 날짜다. 그런데 이 검사는 `slots` 만 본다.
     `slots` 가 같다고 `measuredAt` 을 오늘로 올리면 **`space`·`area` 는 안 재고
     「최신」이라고 말하는 표**가 된다 — 그것이 바로 2026-08-23 아침의 반지하다.
     그래서 이 검사가 아는 것만 적는 칸을 따로 둔다: `slots.verifiedAt`.
     ★ **자기가 안 본 것에 도장을 찍으면 안 된다.**

   ⚠⚠ **이 검사가 보는 것은 `measured.slots` 뿐이다.**
     `space`(가구 없는 공간 격자)와 `area`(바닥 면적·등 상한)는 여기서 못 잰다 —
     0.25m 격자를 훑는 일이라 브라우저 도구(`_space_probe.html`)가 있어야 한다.
     곧 **이 등이 초록이어도 `space`·`area` 는 낡았을 수 있다.**
     닫힌 목록인 척하지 않는다.
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


import { execSync } from 'node:child_process';

const git = a => { try { return execSync('git ' + a, { cwd: ROOT, encoding: 'utf8' }).trim(); }
                   catch { return ''; } };
/* ⚠ Date.now() 를 안 쓴다 — 검사 결과가 날마다 달라지면 회귀 검사가 아니다.
   마지막 커밋 날짜를 「오늘」로 삼는다. */
const today = git('log -1 --format=%cs') || '9999-12-31';

/* == B 의 목록 - 「이 방 값에 닿을 수 있는 것」 =============================
   * 넓게 잡는다. 좁게 잡아 놓치면 낡은 표가 초록으로 남고 **영영 안 본다.**
     넓게 잡아 헛경고가 나면 사람이 **한 번 더 볼 뿐**이다 - 비용이 한 번이다.
   * 오늘 사고가 그 증거다: 협탁 2x2(`ca3f8f8`)와 셋째 등(`d0bc365`)이
     **`house_rooms.json` 밖에서** 왔다. 그 파일만 봤으면 둘 다 놓쳤다.
   !! **이 목록은 닫힌 목록이 아니다.** 아래 여덟은 「안다」이고, 조도에 닿는 것이
     이것뿐이라는 뜻이 아니다. 빠진 것을 찾으면 **이유와 함께** 여기 더해라.
   ! 줄마다 「왜 여기 있나」를 적어 둔다 - 안 적으면 다음 사람이 모르고 지운다. */
const TOUCHES = [
  ['data/furniture_presets.json',      '가구 크기·자리 수. ca3f8f8 이 협탁을 2×2 로 키워 자리가 움직였다'],
  ['data/lighting_presets.json',       '등의 PPFD·거리. 등 값이 바뀌면 「등 전부」 칸이 통째로 움직인다'],
  ['data/window_presets.json',         '창 크기·투과율 — 자연광이 들어오는 입구다'],
  ['data/shading_presets.json',        '차광. 온실이 이것으로 갈린다'],
  ['data/balance/weather.json',        'avg7 = peak × E. E 가 바뀌면 둘째 칸이 다 움직인다'],
  ['src/render3d/furniture_pastel.js', '자리 좌표를 내는 곳. 2026-08-23 에 여기서 18칸이 움직였다'],
  ['src/render3d/house.js',            '방을 짓고 차폐 상자를 낸다 — skyViewK 도 여기서 곱한다'],
  ['src/engine/lux.js',                '조도 셈 그 자체']
];

/* == house_rooms.json 은 **그 방 절만** 본다 ================================
   ! 파일 통째로 보면 남의 방을 고칠 때마다 여섯 방이 다 붉어진다. 그러면 늘 붉고,
     늘 붉으면 아무도 안 본다. 방마다 「그 방 절이 마지막으로 달라진 커밋」을 캔다.
   ! `measured` 자신은 빼고 견준다 - 안 그러면 값을 갱신한 커밋이 「방이 바뀌었다」로
     잡혀 자기 꼬리를 문다. */
function lastRoomChange(roomId) {
  const shas = git('log --format=%H -60 -- data/house_rooms.json').split('\n').filter(Boolean);
  const sub = sha => {
    try {
      const j = JSON.parse(execSync('git show ' + sha + ':data/house_rooms.json',
                                    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 }));
      const r = j.rooms && j.rooms[roomId];
      if (!r) return null;
      const c = { ...r }; delete c.measured;
      return JSON.stringify(c);
    } catch { return null; }
  };
  let cur = sub(shas[0]);
  for (let i = 1; i < shas.length; i++) {
    const prev = sub(shas[i]);
    if (prev !== cur) return { sha: shas[i - 1].slice(0, 7), date: git('log -1 --format=%cs ' + shas[i - 1]) };
    cur = prev;
  }
  return { sha: '-', date: '0000-00-00' };
}

const HR = dataOf('house_rooms.json');
const E = 0.643;                       // weatherE('summer') - avg7 = peak x E
const eng = mk(() => {});
const ROOMS = ['banjiha', 'oneroom', 'classroom', 'tworoom', 'apartment', 'greenhouse'];
const dirty = new Set(git('status --porcelain').split('\n').map(l => l.slice(3).trim()).filter(Boolean));

let fail = 0, pass = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '\n      ' + extra : '')); }
};

const fresh = [];      // 값은 같고 날짜만 낡은 방 - REGEN 이 닫아 준다
console.log('== 방마다: A roomRev · B 닿은 것 · C 값 ========================');

for (const id of ROOMS) {
  const m = (HR.rooms[id] || {}).measured || {};
  const rec = m.slots || {};
  /* ⚠ 「언제 이후를 의심하나」의 기준은 **slots 를 마지막으로 확인한 날**이다.
     `measuredAt`(블록 전체) 과 `slots.verifiedAt`(이 검사가 확인한 날) 중 늦은 쪽. */
  const at = [m.measuredAt || '0000-00-00', rec.verifiedAt || '0000-00-00'].sort().pop();

  /* A - roomRev 가 진짜 커밋인가 */
  const revSha = String(m.roomRev || '').trim().split(/\s+/)[0];
  const revOk = !!revSha && git('cat-file -t ' + revSha) === 'commit';
  ok('A ' + id + ' · roomRev 가 진짜 커밋을 가리킨다', revOk,
     'roomRev="' + m.roomRev + '" — 이 이름의 커밋이 없습니다. 날짜만 적혔거나 사라진 해시입니다.');

  /* B - measuredAt 뒤로 닿은 것 (넓게) */
  const since = [];
  const rc = lastRoomChange(id);
  if (rc.date > at) since.push('house_rooms.json §' + id + ' (' + rc.sha + ' ' + rc.date + ')');
  for (const [f, why] of TOUCHES) {
    const d = git('log -1 --format=%cs -- ' + f);
    if (d && d > at) since.push(f + ' (' + git('log -1 --format=%h -- ' + f) + ' ' + d + ') — ' + why);
    if (dirty.has(f)) since.push(f + ' — ⚠ 커밋 안 된 수정이 있습니다');
  }

  /* C - 그래서 값이 달라졌나. **여기가 판정이다.** */
  const room = eng.build(id);
  let best = 0;
  for (const s of room.slots) {
    eng.clearCache();
    best = Math.max(best, eng.dliOfSlot(s.slotId, { weather: 'clear', season: 'summer', litHours: 12, lampCount: 0 }));
  }
  const now = { peak: +best.toFixed(2), avg7: +(best * E).toFixed(2), count: room.slots.length };
  const bad = [];
  if (rec.peak_summer !== now.peak) bad.push('peak_summer ' + rec.peak_summer + ' → ' + now.peak);
  if (rec.avg7_summer !== now.avg7) bad.push('avg7_summer ' + rec.avg7_summer + ' → ' + now.avg7);
  if (rec.count !== now.count) bad.push('count ' + rec.count + ' → ' + now.count);

  ok('C ' + id + ' · measured.slots 가 지금 잰 값과 같다  (기록 ' + at + ')', bad.length === 0,
     bad.join(' · ') + '\n      ⇒ 날짜를 고쳐서 닫지 마십시오. **다시 재야 하는 값**입니다.');

  if (since.length) {
    if (bad.length === 0) {
      fresh.push(id);
      console.log('  ⏸ ' + id + ' · ' + at + ' 뒤로 ' + since.length + '가지가 닿았는데 **값은 같다**');
      for (const s of since.slice(0, 3)) console.log('      · ' + s);
      if (since.length > 3) console.log('      · … 그 밖 ' + (since.length - 3));
      console.log('      ⇒ 다시 재서 확인했습니다. BYEOT_REGEN=1 로 날짜만 닫습니다.');
    } else {
      console.log('  ⚠ ' + id + ' · ' + at + ' 뒤로 닿은 것 ' + since.length + '가지 — 위 C 가 그 결과입니다');
      for (const s of since.slice(0, 4)) console.log('      · ' + s);
    }
  }
}

/* == 닫는 문 - 값이 같은 방만 날짜를 옮긴다 ================================ */
if (process.env.BYEOT_REGEN) {
  if (!fresh.length) { console.log('\n닫을 방이 없습니다 (값이 다른 방은 안 건드립니다).'); process.exit(fail ? 1 : 0); }
  const p = path.join(ROOT, 'data', 'house_rooms.json');
  let txt = fs.readFileSync(p, 'utf8'), n = 0;
  for (const id of fresh) {
    /* `slots` 절 안에 verifiedAt 을 적는다. 있으면 갈고, 없으면 `"count":` 앞에 새로 넣는다.
       ⚠ measuredAt 은 손대지 않는다(위 머리말). */
    const was = HR.rooms[id].measured.slots.verifiedAt || null;
    const i = txt.indexOf('"' + id + '"');
    if (i < 0) continue;
    if (was) {
      const needle = '"verifiedAt": "' + was + '"';
      const k = txt.indexOf(needle, i);
      if (k < 0) continue;
      txt = txt.slice(0, k) + '"verifiedAt": "' + today + '"' + txt.slice(k + needle.length);
    } else {
      const k = txt.indexOf('"count":', i);
      if (k < 0) continue;
      const NL = String.fromCharCode(10);
      const ind = txt.slice(txt.lastIndexOf(NL, k) + 1, k);
      txt = txt.slice(0, k) +
            '"verifiedAt": "' + today + '",' + NL + ind +
            '"_verifiedAt_note": "★ 이 날 tools/test_measured_fresh.mjs 가 slots 를 다시 재서 위 값과 같은 것을 확인했다. ⚠ 이 도장은 slots 에만 찍힌다 — space·area 는 그 검사가 안 본다. 그 둘의 날짜는 measuredAt 이다.",' + NL + ind +
            txt.slice(k);
    }
    n++;
    console.log('  ' + id + ': slots.verifiedAt ' + (was || '(없음)') + ' → ' + today);
  }
  JSON.parse(txt);
  fs.writeFileSync(p, txt);
  console.log('\n' + n + '개 방의 slots 도장(verifiedAt)을 갱신했습니다.');
  console.log('⚠ measuredAt 은 안 건드렸습니다 — space·area 는 이 검사가 안 보므로 도장을 찍을 자격이 없습니다.');
  process.exit(0);
}

console.log('\n⚠ 이 등은 measured.slots 만 봅니다 — space·area 는 브라우저 격자 도구가 있어야 잽니다.');
console.log('   곧 **이 등이 초록이어도 space·area 는 낡았을 수 있습니다.**');
console.log('\nmeasured_fresh: ' + (fail ? 'FAIL' : 'PASS') + ' — ' + pass + '/' + (pass + fail) +
            (fresh.length ? '  (날짜만 낡은 방 ' + fresh.length + '개 — REGEN 으로 닫힘)' : ''));
process.exit(fail ? 1 : 0);
