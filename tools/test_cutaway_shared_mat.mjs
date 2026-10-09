/* ============================================================
   tools/test_cutaway_shared_mat.mjs — 벽 컷어웨이가 «나눠 쓰는 재질»을 건드려 남의 것까지 바꾸나 ([house] · 2026-10-10)
   ------------------------------------------------------------
     BYEOT_URL=http://127.0.0.1:9330 [SHOT=out.png] node tools/test_cutaway_shared_mat.mjs     (헤드리스 크롬 하나)
   왜: 투룸 가게 30일 뒤 진열대가 텅 빈 고장(core b5d1885d · 총괄 MAJOR). 가구 옷 «대리» 메시(옛 상자)는 숨김 재질
       한 벌(furniture_dress hideMat)을 문·창 대리와 같이 썼다. 칸막이 컷어웨이(house.js setShadowOnly · cut 'always')가
       문 대리의 그 재질 colorWrite 를 끄면 진열대 대리까지 같이 꺼져, 받침 광선이 진열대를 «그림자 전용»으로 건너뛰었다.
       같은 꼴이 문 옷(GLB)에도 있다 — 앞문과 칸막이 문이 door_wood 한 벌을 써서, 한 벽을 깎으면 다른 벽 문이 같이 사라진다.
   잰다(진짜 방 뷰 tools/room_view_demo.html?room=tworoom&engine=1):
     A 가구 대리(visible:false 재질) — colorWrite·depthWrite 가 켜져 있다(벽 컷어웨이가 못 건드린다)
     B 벽 옷(문 GLB) — 벽마다 재질이 따로다(다른 벽 옷과 재질 하나도 안 나눔 · 창 옷은 trims 라 컷어웨이가 재질을 안 만진다)
     C 벽 옷 재질의 colorWrite = 그 벽이 서 있나(_stub 아님) — 기본 카메라 · 다시 지은 뒤 · 반대쪽으로 돈 카메라 세 번
     D 숨김 재질은 컷어웨이가 안 바꾼다 — 문·창 대리의 숨김 재질도 colorWrite 켜짐
     E 벽 걸이는 제 벽을 따라 숨는다 — 왼벽(hang-3 · 기본 카메라에서 섬)·오른벽(hang-5 · 기본에서 깎임)에 하나씩 걸고 돌기 전후(house.js syncWallHang)
   대조: 고치기 전 판(b5d1885d)에서 «다시 지은 뒤» A·D 가 빨갛다(10-10 house 가 먼저 돌려 봄 · 첫 빌드는 초록 — 위 다시 짓기 주석).
============================================================ */
import fs from 'node:fs';
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9330';
const SHOT = process.env.SHOT || null;
let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { if (cond) { pass++; console.log(`PASS  ${label}`); } else { fail++; console.log(`FAIL  ${label}${extra ? '  — ' + extra : ''}`); } };

const page = await launch({ width: 1100, height: 800, dpr: 1 });
try {
  await page.goto(`${BASE}/tools/room_view_demo.html?room=tworoom&shot=wide&engine=1`);
  for (let i = 0; i < 90; i++) { const t = await page.eval('document.title'); if (/DONE/.test(t)) break; await sleep(400); }
  /* 옷이 다 올 때까지(문 둘 · 진열대) */
  let ready = null;
  for (let i = 0; i < 60; i++) {
    ready = JSON.parse(await page.eval(`JSON.stringify((() => { const r = window.__v2 && window.__v2.furn && window.__v2.furn.report();
      if (!r) return null; const f = r.furniture || {}; return { doors: Object.keys(f).filter(k => /^(door|win):/.test(k)).length, display: !!f['tworoom-shop-display'] }; })())`));
    if (ready && ready.doors >= 2 && ready.display) break;
    await sleep(500);
  }
  ok('옷이 섰다(문·창 옷 둘 이상 · 진열대)', ready && ready.doors >= 2 && ready.display, JSON.stringify(ready));
  await sleep(800);

  const measure = () => page.eval(`JSON.stringify((() => {
    const b = window.engine.room.built;
    const shellOf = o => { for (let p = o; p; p = p.parent) for (const k in b.shells) if (b.shells[k] === p) return k; return null; };
    /* A — 가구 대리 */
    const furnHidden = [];
    b.furniture.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material || [])) if (m && m.visible === false) furnHidden.push({ uid: (o.parent && o.parent.userData.uid) || null, cw: m.colorWrite, dw: m.depthWrite }); });
    /* B·C·D — 벽 아래 옷과 숨김 재질 */
    const dressMats = {}, shellHidden = [], stubOf = {};
    for (const k in b.shells) {
      const sh = b.shells[k]; stubOf[k] = sh.userData._stub == null ? null : !!sh.userData._stub;
      sh.traverse(o => {
        if (!o.isMesh || o.userData.isStub) return;
        let inDress = false; for (let p = o; p && p !== sh; p = p.parent) if (p.userData && p.userData.v2dress) { inDress = true; break; }
        for (const m of [].concat(o.material || [])) {
          if (!m) continue;
          if (m.visible === false) shellHidden.push({ k, cw: m.colorWrite });
          else if (inDress) (dressMats[k] = dressMats[k] || new Set()).add(m);
        }
      });
    }
    const shared = [];
    const ks = Object.keys(dressMats);
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      let n = 0; for (const m of dressMats[ks[i]]) if (dressMats[ks[j]].has(m)) n++;
      if (n) shared.push(ks[i] + '~' + ks[j] + ':' + n);
    }
    const wrong = [];
    for (const k of ks) { if (stubOf[k] == null) continue; for (const m of dressMats[k]) if (m.colorWrite !== !stubOf[k]) { wrong.push(k + ' cw ' + m.colorWrite + ' stub ' + stubOf[k]); break; } }
    const hang = {}; for (const g of b.furniture.children) if (g.userData && g.userData.mount === 'wall-hang') hang[g.userData.uid] = g.visible && g.children.some(c => c.visible);
    return { hang, furnHidden: furnHidden.length, furnOff: furnHidden.filter(x => !x.cw || !x.dw).map(x => x.uid),
             dressShells: ks.map(k => k + ':' + dressMats[k].size), stubOf, shared, wrong,
             shellHidden: shellHidden.length, shellHiddenOff: shellHidden.filter(x => !x.cw).map(x => x.k) };
  })())`).then(JSON.parse);

  const check = (tag, r) => {
    ok(`${tag} A 가구 대리 숨김 재질 colorWrite·depthWrite 켜짐 (${r.furnHidden}개)`, r.furnHidden > 0 && r.furnOff.length === 0, '꺼진 것 ' + [...new Set(r.furnOff)].slice(0, 6).join(','));
    ok(`${tag} B 벽 옷 재질이 벽마다 따로 (${r.dressShells.join(' · ') || '없음'})`, r.dressShells.length >= 1 && r.shared.length === 0, '나눔 ' + r.shared.join(' '));   // 투룸은 옷 입은 문이 앞벽 하나(칸막이 문은 프리셋 없음 · 창 옷은 trims)
    ok(`${tag} C 벽 옷 colorWrite = 벽이 서 있나`, r.wrong.length === 0, r.wrong.join(' | '));
    ok(`${tag} D 벽 대리 숨김 재질 colorWrite 켜짐 (${r.shellHidden}개)`, r.shellHiddenOff.length === 0, '꺼진 벽 ' + [...new Set(r.shellHiddenOff)].join(','));
  };
  const r1 = await measure();
  console.log('  벽 상태', JSON.stringify(r1.stubOf));
  check('기본 카메라 ·', r1);
  /* 다시 짓기 — 고장은 여기서 난다. 첫 빌드는 옷 GLB 가 늦게 와 컷어웨이가 먼저 돈다(숨김 재질이 아직 안 붙음).
     GLB 를 이미 받은 뒤 방을 다시 지으면(벽 걸이 하나 → 다음 날 · core b5d1885d) 옷이 곧바로 붙고 «그 뒤» 컷어웨이가
     새 벽을 처음 깎으며 문 대리의 숨김 재질을 끈다 — 가구 대리가 같은 한 벌이면 같이 꺼진다 */
  await page.eval(`(async () => { const v = window.view, e = window.engine;
    e.setFurnitureEdits([], [{ uid: 'add-poster_seaside-cut', preset: 'poster_seaside', ...v.hangPose('tworoom-hang-3', 'poster_seaside') },
                             { uid: 'add-poster_moon-cut', preset: 'poster_moon', ...v.hangPose('tworoom-hang-5', 'poster_moon') }]);
    await v.refreshFurniture(); return 1; })()`, true, 120000);
  await sleep(2500);
  const r1b = await measure();
  console.log('  벽 상태(다시 지은 뒤)', JSON.stringify(r1b.stubOf));
  check('다시 지은 뒤 ·', r1b);
  ok('다시 지은 뒤 · E 서 있는 왼벽 그림은 보이고 깎인 오른벽 그림은 숨는다', r1b.hang['add-poster_seaside-cut'] === true && r1b.hang['add-poster_moon-cut'] === false, JSON.stringify(r1b.hang));
  if (SHOT) { await page.shot(SHOT); console.log('  사진', SHOT); }

  /* 반대쪽으로 돈다 — 앞벽은 서고 뒤벽이 깎인다 · 칸막이는 늘 밑동 */
  await page.eval(`(() => { const v = window.view; const cur = v.camTo({}, 120); v.camTo({ az: cur.az + Math.PI }, 150); return 1;   /* camTo({}) = 지금 자리를 돌려준다 */ })()`);
  let r2 = null;
  for (let i = 0; i < 20; i++) { await sleep(400); r2 = await measure(); if (JSON.stringify(r2.stubOf) !== JSON.stringify(r1.stubOf)) break; }
  console.log('  벽 상태(돈 뒤)', JSON.stringify(r2.stubOf));
  ok('돈 뒤 벽 상태가 바뀌었다(자가 정말 두 경우를 봤나)', JSON.stringify(r2.stubOf) !== JSON.stringify(r1.stubOf));
  check('돈 카메라 ·', r2);
  ok('돈 카메라 · E 깎인 왼벽 그림은 숨고 선 오른벽 그림은 보인다', r2.hang['add-poster_seaside-cut'] === false && r2.hang['add-poster_moon-cut'] === true, JSON.stringify(r2.hang));
  if (SHOT) { const s2 = SHOT.replace(/\.png$/i, '_turned.png'); await page.shot(s2); console.log('  사진', s2); }
} finally { await page.close(); }
console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
