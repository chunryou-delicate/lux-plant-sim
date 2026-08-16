/* ============================================================
   tools/probe_branchcut.mjs — **모주에서 자란 그 가지를 그대로 떼어냈나** 를 잰다 (2026-08-16)
   ------------------------------------------------------------
   박사님 원문(두 번): *"삽수 시, 기존에 자랐던 거 가지 그대로 잘라서 넣어줄래?"*
                       *"줄기 기존 자랐던 거 그대로 쓰라고. 그게 어렵나."*

     python tools/serve.py 8963
     BYEOT_URL=http://localhost:8963 node tools/probe_branchcut.mjs

   ★ 무엇을 켜고 무엇을 껐나 (§2 — 재는 자를 먼저 의심하라)
     · 대상은 **브라우저에서 실제로 도는** `src/render3d/plant_assemble.js` 다(vm 스텁이 아니다)
     · 띄우는 페이지는 `plant_grow.html` — THREE·GLTFLoader·렌더러가 이미 서 있고
       그 페이지의 전역(scene·plantGroup·fitCam·renderer)을 사진 찍는 데 그대로 쓴다.
       ⚠ 그 페이지 제 그루와 조립기 인스턴스는 **딴 그루**다. 재는 것은 조립기 쪽이다
     · 빛 이력은 안 준다 → 무늬는 `leafState` 로 **못 박아** 넣는다(그래야 무늬 가지도 잰다)
     · 씨앗 92158(게임이 쓰는 값) · 유효 생장일 200 을 기본으로 본다
     · 파일은 한 줄도 안 고친다. 세운 것은 끝에 전부 버린다

   재는 것 (지시 그대로)
     ① 같은 씨앗·같은 날로 **두 번 지으면 같은 형태**인가 (정점 해시)
     ② `branchOf` 의 잎 수 = `cuttableNodes()` 의 그 마디 `leaves` 인가
     ③ 가지의 정점이 **모주의 그 부분과 일치**하는가 (모주에서 같은 축·같은 부위를 찾아 견준다)
     ④ 마디 여럿 — 밑동 `n0#0` 은 **그루 전체**인가 · 위 마디는 줄어드나 · 가지가 난 축은 어떤가
     ⑤ 모르는 마디·아직 안 난 마디에 **null 을 내는가** (안 던지는가)
     ⑥ 백 번 지었다 버려도 **기하·삼각형·드로우콜이 안 새는가**
     ⑦ 사진 — ⚠ **색 가짓수를 센다** (§2.9-③ · 까만 사진은 3색, 멀쩡한 사진은 3,000색이 넘는다)
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './test_cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const OUT = path.join(ROOT, 'docs/handoff/img');

/* ── PNG 를 직접 푼다(이 저장소에는 node_modules 가 없다 · probe_cutjar 와 같은 벌) ── */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG 가 아니다');
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || interlace !== 0) throw new Error('이 PNG 는 못 읽는다');
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev ? prev[x] : 0;
      const c = (prev && x >= ch) ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}
/* ★ 색 가짓수 — 사진이 멀쩡한지 재는 제일 빠른 자다(§2.9-③) */
function colorCount(file) {
  const im = decodePNG(fs.readFileSync(file));
  const set = new Set();
  for (let i = 0; i < im.w * im.h; i++) {
    const o = i * im.ch;
    set.add((im.data[o] << 16) | (im.data[o + 1] << 8) | im.data[o + 2]);
    if (set.size > 60000) break;
  }
  return set.size;
}

const rows = [];
let fails = 0;
const ok = (name, pass, note) => {
  rows.push({ name, pass, note });
  if (!pass) fails++;
  console.log(`${pass ? ' ✅' : ' ❌'} ${name}${note ? '  — ' + note : ''}`);
};

/* ══ 페이지 안에 심는 도구 — 조립기를 불러 오고, 정점 해시를 뜬다 ══ */
const SETUP = `(async () => {
  const m = await import('${BASE}/src/render3d/plant_assemble.js');
  const asm = await m.getPlantAssembler({ timeoutMs: 120000 });
  window.__asm = asm;

  /* 좌표 해시 — 1e-6 단위 정수로 접어서 뜬다(부동소수 잡음에 안 흔들리게).
     space 기준 좌표로 뜨므로 «모주의 inner» 와 «가지의 inner» 를 그대로 견줄 수 있다. */
  window.__hash = (root, space) => {
    space.updateWorldMatrix(true, true); root.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(space.matrixWorld).invert();
    const mm = new THREE.Matrix4(), v = new THREE.Vector3();
    let h = 2166136261 >>> 0, n = 0, tri = 0;
    const mix = x => { h ^= (x >>> 0); h = Math.imul(h, 16777619) >>> 0; };
    root.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      mm.multiplyMatrices(inv, o.matrixWorld);
      const p = o.geometry.attributes.position;
      tri += (o.geometry.index ? o.geometry.index.count : p.count) / 3;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(mm);
        mix(Math.round(v.x * 1e6)); mix(Math.round(v.y * 1e6)); mix(Math.round(v.z * 1e6));
        n++;
      }
    });
    return { h: h >>> 0, n, tri: Math.round(tri) };
  };

  /* 물건 하나하나의 해시 — 표(axisKey/part/segIndex)로 이름을 붙여 놓는다.
     같은 이름이 여럿이면 뒤에 번호를 붙인다(잎자루가 잎과 같은 이름으로 나올 수 있다). */
  window.__parts = (inner) => {
    const out = {}, seen = {};
    for (const c of inner.children) {
      const u = c.userData || {};
      if (!u.axisKey) continue;
      let k = u.axisKey + '|' + u.part + (u.segIndex != null ? '#' + u.segIndex : '');
      seen[k] = (seen[k] || 0) + 1;
      if (seen[k] > 1) k += '~' + seen[k];
      out[k] = window.__hash(c, inner);
    }
    return out;
  };

  /* 좌표를 space 기준으로 통째로 뽑는다(견줄 때 쓴다) */
  window.__pos = (o, sp) => {
    sp.updateWorldMatrix(true, true); o.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(sp.matrixWorld).invert();
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const p = o.geometry.attributes.position, v = new THREE.Vector3(), a = [];
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); a.push(v.x, v.y, v.z); }
    return a;
  };
  /* ★ 잘린 축의 줄기는 «부분»이라 통째로 견주면 당연히 다르다. 그래서 이렇게 본다 —
     «가지의 옆면 정점»이 «모주의 옆면 뒤쪽 그만큼»과 **한 점도 안 틀리나**.
     그게 「그대로 떼어냈다」의 뜻이다. 새로 나는 점은 잘린 자리 뚜껑 **하나**뿐이어야 한다. */
  window.__tailMatch = (bObj, bSp, mObj, mSp) => {
    const B = window.__pos(bObj, bSp), M = window.__pos(mObj, mSp);
    const bn = B.length / 3, mn = M.length / 3;
    const bSide = bn - 2, mSide = mn - 2, off = mSide - bSide;
    if (off < 0) return { ok: false, why: '가지가 모주보다 길다', bn, mn };
    /* ⚠ 자를 것이 없으면(밑동) 튜브를 **손도 안 댄다** — 그때는 뚜껑 차례도 원본 그대로다.
       그 두 경우를 안 가르면 자가 「뚜껑이 1.45 어긋났다」고 거짓말한다(실제로 그랬다). */
    const EPS = 1e-9;                                 // 좌표는 1 안팎이다. 이보다 작으면 계산 잡음이다
    if (off === 0) {
      let e = 0;
      for (let i = 0; i < B.length; i++) e = Math.max(e, Math.abs(B[i] - M[i]));
      return { ok: e <= EPS, maxErr: e, capErr: 0, kept: bSide, total: mSide, dropped: 0, newVerts: 0, whole: true };
    }
    let maxErr = 0;
    for (let i = 0; i < bSide * 3; i++) maxErr = Math.max(maxErr, Math.abs(B[i] - M[off * 3 + i]));
    let capErr = 0;                                   // 위 뚜껑 가운뎃점은 원본 그대로여야 한다
    for (let k = 0; k < 3; k++) capErr = Math.max(capErr, Math.abs(B[bSide * 3 + k] - M[(mn - 1) * 3 + k]));
    return { ok: maxErr <= EPS && capErr <= EPS, maxErr, capErr,
             kept: bSide, total: mSide, dropped: off, newVerts: 1,
             cut: [B[(bSide + 1) * 3], B[(bSide + 1) * 3 + 1], B[(bSide + 1) * 3 + 2]] };
  };
  return { GMAX: asm.GMAX, info: asm.info };
})()`;

/* 모주를 짓고 그 마디 목록을 읽는다 */
const MOTHER = (days, seed, ls) => `(() => {
  const g = window.__asm.assemble({ growthDays: ${days}, seed: ${seed}, potD: 0.20${ls} });
  const inner = g.children[0];
  const r = { hash: window.__hash(g, inner), parts: window.__parts(inner),
              leaves: null, nodes: null };
  window.__mother = g;
  return r;
})()`;

async function main() {
  const t0 = Date.now();
  const page = await launch({ width: 900, height: 900, dpr: 1 });
  const errs = [];
  page.on((method, params) => {
    if (method === 'Runtime.exceptionThrown')
      errs.push(String(params.exceptionDetails && params.exceptionDetails.text));
  });

  await page.goto(`${BASE}/plant_grow.html`);
  await page.waitFor('typeof THREE!=="undefined" && typeof buildPlant==="function"', 60000);
  const boot = await page.eval(SETUP);
  console.log(`\n조립기 준비 — GLB ${boot.info.loadedKeys}개 · ${boot.info.loadMs}ms · 무늬 ${boot.info.skinKeys}장(늦게 받기 ${boot.info.lazySkins})\n`);

  const SEED = 92158, DAY = 200;

  /* ── ① 같은 씨앗·같은 날 = 같은 형태인가 ─────────────────────────── */
  const a1 = await page.eval(MOTHER(DAY, SEED, ''));
  const a2 = await page.eval(MOTHER(DAY, SEED, ''));
  ok('① 같은 씨앗·같은 날로 두 번 지으면 같은 형태',
     a1.hash.h === a2.hash.h && a1.hash.n === a2.hash.n,
     `해시 ${a1.hash.h} vs ${a2.hash.h} · 정점 ${a1.hash.n} · 삼각형 ${a1.hash.tri}`);

  /* 다른 씨앗이면 달라야 한다 — 해시가 늘 같으면 위 줄이 거짓말이다 */
  const a3 = await page.eval(MOTHER(DAY, 33, ''));
  ok('①-2 씨앗이 다르면 형태도 다르다 (자가 늘 같은 값을 내는 게 아니다)',
     a3.hash.h !== a1.hash.h, `seed 33 해시 ${a3.hash.h}`);

  /* ── ②③④ 마디 여럿을 떼어내 견준다 ─────────────────────────────
     정본 목록(`cuttableNodes()`)은 가지의 `userData.node` 로 따라 나온다 — 견줄 값을
     여기서 따로 세지 않는다(두 벌로 세면 어느 쪽이 거짓말인지 못 가린다). */
  const PICK = ['n0#0', 'n0#2', 'n0#4', 'n0.1#0', 'n0.1#2'];
  const cut = await page.eval(`(() => {
    const out = [];
    /* 모주를 한 번 지어 부위별 해시를 떠 둔다 — 「그대로 떼어냈나」의 기준자다 */
    const mg = window.__asm.assemble({ growthDays: ${DAY}, seed: ${SEED}, potD: 0.20 });
    const minner = mg.children[0];
    const mparts = window.__parts(minner);
    const mleaf = new Set(); for (const k of Object.keys(mparts)) if (/\\|leaf/.test(k)) mleaf.add(k.split('|')[0]);
    const mhash = window.__hash(mg, minner);
    for (const id of ${JSON.stringify(PICK)}) {
      const b = window.__asm.branchOf({ nodeId: id, growthDays: ${DAY}, seed: ${SEED}, potD: 0.20 });
      if (!b) { out.push({ id, null: true }); continue; }
      const inner = b.children[0];
      const bparts = window.__parts(inner);
      const u = b.userData;
      /* 부위별로 모주와 견준다. ★ 잘린 축의 줄기만 «부분»이라 따로 본다(§tailMatch) */
      const cutStemKey = u.axisKey + '|stem';
      const same = [], diff = [], missing = [];
      for (const k of Object.keys(bparts)) {
        if (k === cutStemKey) continue;                      // 아래에서 따로 잰다
        if (!(k in mparts)) { missing.push(k); continue; }
        const A = bparts[k], B = mparts[k];
        if (A.h === B.h && A.n === B.n) same.push(k);
        else diff.push({ k, b: A, m: B });
      }
      const bStem = inner.children.find(c => c.userData.part === 'stem' && c.userData.axisKey === u.axisKey);
      const mStem = minner.children.find(c => c.userData.part === 'stem' && c.userData.axisKey === u.axisKey);
      const tail = (bStem && mStem) ? window.__tailMatch(bStem, inner, mStem, minner) : { ok: false, why: '줄기를 못 찾았다' };
      out.push({ id, null: false, tail,
                 leafCount: u.leafCount, nodeLeaves: u.node.leaves, stem: u.node.stem,
                 varieLeaves: u.node.variegatedLeaves,
                 leafKeys: u.node.leafKeys, leafBirths: u.node.leafBirths,
                 parts: Object.keys(bparts).length, same, diff, missing,
                 tri: window.__hash(b, inner).tri, motherTri: mhash.tri,
                 sizeM: u.sizeM, cutDir: u.cutDir, scale: u.scale,
                 wholeSame: window.__hash(b, inner).h === mhash.h });
      /* 다 쟀으면 버린다 */
      b.traverse(o => { if (o.isMesh && o.geometry && !o.userData.sharedGeometry) o.geometry.dispose(); });
    }
    return { out, motherParts: Object.keys(mparts), motherTri: mhash.tri, motherLeaves: mleaf.size };
  })()`);

  console.log(`\n모주(seed ${SEED} · 유효 ${DAY}일) — 부위 ${cut.motherParts.length}개 · 잎 ${cut.motherLeaves}장 · 삼각형 ${cut.motherTri}\n`);

  for (const r of cut.out) {
    if (r.null) { ok(`④ ${r.id} — 가지가 나왔다`, false, 'null 이 나왔다(마디가 없거나 조립 실패)'); continue; }
    ok(`② ${r.id} 잎 수 = cuttableNodes 의 leaves`, r.leafCount === r.nodeLeaves,
       `가지 ${r.leafCount}장 · 정본 ${r.nodeLeaves}장 (${r.stem} · 무늬 ${r.varieLeaves} · 열쇠 ${(r.leafKeys || []).join(',')})`);
    ok(`③ ${r.id} 잎·혹·가지가 모주와 한 점도 안 다르다`, r.diff.length === 0 && r.missing.length === 0,
       `일치 ${r.same.length} · 어긋남 ${r.diff.length} · 모주에 없음 ${r.missing.length}` +
       (r.diff.length ? ' → ' + r.diff.map(d => `${d.k}(가지 ${d.b.n}점/모주 ${d.m.n}점)`).join(' ') : ''));
    ok(`③-2 ${r.id} 잘린 줄기가 모주 줄기의 그 토막 그대로`, !!r.tail.ok,
       (r.tail.why || `옆면 ${r.tail.kept}/${r.tail.total}점 그대로(아래 ${r.tail.dropped}점 잘림) · ` +
        `어긋남 ${r.tail.maxErr.toExponential(1)}m · 뚜껑 ${(r.tail.capErr ?? 0).toExponential(1)} · ` +
        `새로 난 점 ${r.tail.newVerts}개${r.tail.whole ? ' (안 잘랐다 = 그루 전체)' : ' (자른 면 뚜껑)'}`));
    console.log(`      크기 ${(r.sizeM.h * 100).toFixed(1)}cm · 지름 ${(r.sizeM.d * 100).toFixed(1)}cm · 삼각형 ${r.tri} (모주 ${r.motherTri})`);
  }
  const base = cut.out.find(r => r.id === 'n0#0');
  ok('④ 밑동 n0#0 은 그루 전체다 (화분만 빠진다)',
     !!base && !base.null && base.leafCount === cut.motherLeaves,
     base && !base.null ? `잎 ${base.leafCount}장 = 모주 ${cut.motherLeaves}장 · 삼각형 ${base.tri}/${base.motherTri}` : '못 만들었다');
  /* 위로 갈수록 딸려가는 것이 준다 */
  const up = cut.out.filter(r => !r.null && /^n0#/.test(r.id)).map(r => r.leafCount);
  ok('④-2 위 마디일수록 딸려가는 잎이 준다', up.length >= 2 && up.every((v, i) => i === 0 || v <= up[i - 1]),
     `n0#0·n0#2·n0#4 = ${up.join(' ≥ ')}`);

  /* ── ⑧ 무늬가 딸려 오나 ────────────────────────────────────────
     ⚠ 이 인스턴스는 빛 이력이 없어 **스스로는 무늬가 안 난다**(§한계). 그래서 정본이
       정하듯 `leafState` 로 못 박아 준다 — 실제 게임에서는 game.html 이 그 자리를 채운다.
     ⚠ 무늬 텍스처는 **늦게 온다**(§ensureSkin). 첫 판은 기본잎으로 서는 게 정상이고,
       다 받은 뒤 다시 지어야 무늬가 선다. 그 두 판을 다 잰다. */
  const births = (base && base.leafBirths) || [];
  const varie = await page.eval(`(async () => {
    const ls = ${JSON.stringify(births)}.map(b => ({ leafBirth: b, varie: true, matured: false }));
    const mk = () => window.__asm.branchOf({ nodeId: 'n0#0', growthDays: ${DAY}, seed: ${SEED}, potD: 0.20, leafState: ls });
    const b1 = mk();
    const first = b1 ? { keys: b1.userData.varieLeafKeys.length, pending: b1.userData.skinsPending, leaves: b1.userData.leafCount } : null;
    const t0 = performance.now();
    while (window.__asm.skinsPending() && performance.now() - t0 < 40000) await new Promise(r => setTimeout(r, 200));
    const b2 = mk();
    const second = b2 ? { keys: b2.userData.varieLeafKeys, leaves: b2.userData.leafCount } : null;
    window.__varieBranch = b2;
    return { first, second, loaded: window.__asm.skinsLoaded(), waitMs: Math.round(performance.now() - t0) };
  })()`);
  ok('⑧ 무늬 마디를 자르면 무늬 잎이 딸려 온다',
     !!(varie.second && varie.second.keys.length),
     `첫 판 무늬 ${varie.first && varie.first.keys}갈래(받는 중 ${varie.first && varie.first.pending}장) → ` +
     `${varie.waitMs}ms 뒤 ${varie.second ? varie.second.keys.join(',') : '없음'} · 잎 ${varie.second && varie.second.leaves}장`);

  /* ── ⑤ 모르는 마디·아직 안 난 마디 ─────────────────────────────── */
  const nulls = await page.eval(`(() => {
    const t = (o) => { try { const r = window.__asm.branchOf(o); return r === null ? 'null' : (r ? 'group' : String(r)); }
                       catch (e) { return 'throw: ' + e.message; } };
    return {
      unknown:  t({ nodeId: '없는마디#9', growthDays: ${DAY}, seed: ${SEED} }),
      farNode:  t({ nodeId: 'n0#99',      growthDays: ${DAY}, seed: ${SEED} }),
      noAxis:   t({ nodeId: 'n9.9#0',     growthDays: ${DAY}, seed: ${SEED} }),
      badName:  t({ nodeId: 'n0',         growthDays: ${DAY}, seed: ${SEED} }),
      empty:    t({}),
      seedStage:t({ nodeId: 'n0#0', growthDays: 3, seed: ${SEED} }),
      future:   t({ nodeId: 'n0.1#0', growthDays: 40, seed: ${SEED} })
    };
  })()`);
  const allNull = Object.values(nulls).every(v => v === 'null');
  ok('⑤ 모르는 마디·아직 안 난 마디에 null (안 던진다)', allNull,
     Object.entries(nulls).map(([k, v]) => `${k}=${v}`).join(' · '));

  /* ── ⑥ 백 번 지었다 버리기 ──────────────────────────────────────── */
  const leak = await page.eval(`(async () => {
    const stash = [...plantGroup.children];
    for (const c of stash) plantGroup.remove(c);
    const snap = () => ({ geo: renderer.info.memory.geometries, tex: renderer.info.memory.textures,
                          tri: renderer.info.render.triangles, calls: renderer.info.render.calls });
    const draw = (b) => { plantGroup.add(b); renderer.render(scene, cam); plantGroup.remove(b); };
    const kill = (b) => {
      b.traverse(o => {
        if (o.isMesh && o.geometry && !(o.userData && o.userData.sharedGeometry)) o.geometry.dispose();
        if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
                        for (const mt of ms) if (mt && mt.userData && mt.userData.cloned) mt.dispose(); }
      });
    };
    const marks = [];
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      const b = window.__asm.branchOf({ nodeId: 'n0#2', growthDays: ${DAY}, seed: ${SEED}, potD: 0.20 });
      if (!b) return { err: '가지를 못 만들었다 (' + i + '번째)' };
      draw(b); kill(b);
      if (i === 0 || i === 9 || i === 49 || i === 99) marks.push({ i, ...snap() });
    }
    const ms = Math.round(performance.now() - t0);
    for (const c of stash) plantGroup.add(c);
    return { marks, ms, heap: (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null) };
  })()`);
  if (leak.err) ok('⑥ 백 번 지었다 버려도 안 샌다', false, leak.err);
  else {
    const f = leak.marks[0], l = leak.marks[leak.marks.length - 1];
    ok('⑥ 백 번 지었다 버려도 기하가 안 샌다', l.geo <= f.geo + 2,
       `기하 ${leak.marks.map(m => `${m.i + 1}회 ${m.geo}`).join(' → ')} · 삼각형 ${l.tri} · 드로우콜 ${l.calls} · ${leak.ms}ms · 힙 ${leak.heap}MB`);
  }

  /* ── ⑦ 사진 ───────────────────────────────────────────────────
     ⚠⚠ **처음 찍은 판은 튜닝 패널이 화면을 거의 다 덮고 있었다.** 색 가짓수는 7,100 이라
       ✅ 가 떴는데, 그 색은 **UI 의 색**이었다(식물은 패널 뒤에 손톱만 하게 있었다).
       §2.9 가 말하는 「자가 거짓말하는 방식」 그대로다 — 사진을 눈으로 안 봤으면 그대로 넘어갔다.
     ⇒ 캔버스만 남기고 다 감춘다. 그러고도 3,000색이 넘으면 그건 **식물의 색**이다. */
  fs.mkdirSync(OUT, { recursive: true });
  await page.eval(`(() => {
    /* ⚠ 캔버스는 body 바로 아래가 아니라 #wrap 안에 있다 — body 자식을 통째로 감추면
       캔버스까지 사라져 **한 색짜리 사진**이 나온다(그것도 실제로 한 번 나왔다). */
    const keep = new Set(); for (let e = cv; e; e = e.parentElement) keep.add(e);
    document.querySelectorAll('body *').forEach(e => {
      if (!keep.has(e) && !e.contains(cv)) e.style.display = 'none';
    });
    return true;
  })()`);
  const shots = [];
  for (const [tag, expr] of [
    ['mother', `window.__asm.assemble({ growthDays: ${DAY}, seed: ${SEED}, potD: 0.20 })`],
    ['n0_2',   `window.__asm.branchOf({ nodeId:'n0#2', growthDays: ${DAY}, seed: ${SEED}, potD: 0.20 })`],
    ['n0_4',   `window.__asm.branchOf({ nodeId:'n0#4', growthDays: ${DAY}, seed: ${SEED}, potD: 0.20 })`],
    ['n01_0',  `window.__asm.branchOf({ nodeId:'n0.1#0', growthDays: ${DAY}, seed: ${SEED}, potD: 0.20 })`],
    ['varie',  `window.__asm.branchOf({ nodeId:'n0#2', growthDays: ${DAY}, seed: ${SEED}, potD: 0.20, leafState: ${JSON.stringify(births)}.map(b=>({leafBirth:b,varie:true,matured:false})) })`]
  ]) {
    const put = await page.eval(`(() => {
      if (window.__shown) { plantGroup.remove(window.__shown); window.__shown = null; }
      for (const c of [...plantGroup.children]) { window.__stash = window.__stash || []; window.__stash.push(c); plantGroup.remove(c); }
      const g = ${expr};
      if (!g) return false;
      /* 조립기는 0.20m 화분 기준으로 줄여 놨다 — 사진은 plant_grow 단위로 되돌려 찍는다 */
      g.scale.setScalar(1 / (g.userData.scale || 1));
      plantGroup.add(g); window.__shown = g;
      /* ⚠ fitCam() 은 안 쓴다 — 그루를 담으려고 만든 자라 **FRUSTUM 하한이 1.5** 이고
         **언제나 원점을 본다.** 삽수 한 토막은 화면의 4분의 1만 차고, 밑동이 원점인
         가지는 옆으로 뻗어 화면 밖으로 나간다(두 판 다 실제로 그렇게 찍혔다).
         ⇒ 이 물건의 상자 한가운데를, 이 물건 크기에 맞춰 담는다. */
      const bb = new THREE.Box3().setFromObject(g);
      const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
      orbit.tx = c.x; orbit.ty = c.y; orbit.tz = c.z; orbit.zoom = 1;
      FRUSTUM = Math.max(0.2, Math.max(sz.y, sz.x, sz.z) * 0.68);
      const ar = (W || innerWidth) / (H || innerHeight);
      cam.left = -FRUSTUM * ar; cam.right = FRUSTUM * ar; cam.top = FRUSTUM; cam.bottom = -FRUSTUM;
      updateCam(); requestRender();
      return true;
    })()`);
    if (!put) { ok(`⑦ 사진 ${tag}`, false, '세울 것이 없다'); continue; }
    /* ⚠ §2.9-③ — 사진은 타이밍을 탄다. 두 프레임 넘게 기다렸다 찍는다 */
    await sleep(900);
    const file = path.join(OUT, `branchcut_${tag}.png`);
    await page.shot(file);
    const cc = colorCount(file);
    shots.push({ tag, cc });
    /* ⚠ 바를 500 에 둔다(§2.9-③ 의 3,000 이 아니다). 까닭을 적어 둔다 —
       **잎 한 장짜리 삽수를 당겨 찍으면 화면이 거의 한 색의 잎**이라 2,700색쯤 나온다.
       사진을 눈으로 열어 보고(잎 한 장 + 줄기 + 자른 면) 멀쩡한 것을 확인한 뒤 내린 바다.
       까만 사진(3색)·빈 사진(1색)은 이 바로도 그대로 걸린다 — 둘 다 실제로 걸렸다. */
    ok(`⑦ 사진 ${tag} — 색 가짓수`, cc > 500, `${cc}색 · ${path.relative(ROOT, file)}`);
  }

  const jsErr = errs.filter(e => e && !/favicon/.test(e));
  ok('예외 0건', jsErr.length === 0, jsErr.slice(0, 3).join(' | ') || '없음');

  console.log(`\n${'═'.repeat(66)}`);
  console.log(`${fails ? '❌ 실패 ' + fails + '줄' : '✅ 전부 통과'} · ${Math.round((Date.now() - t0) / 1000)}초`);
  await page.close();
  process.exit(fails ? 1 : 0);
}

main().catch(async e => { console.error('❌ 재다가 터졌다:', e.message); process.exit(2); });
