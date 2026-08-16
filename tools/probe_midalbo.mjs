/* ============================================================
   tools/probe_midalbo.mjs — 무늬 그림을 **재서** 등급으로 묶는 자 (2026-08-16 신설)

       node tools/probe_midalbo.mjs              # 중간잎 42갈래를 잰다
       node tools/probe_midalbo.mjs --mat        # 성숙잎 57장(19갈래)을 잰다 — 자를 검정하는 쪽
       node tools/probe_midalbo.mjs --all        # 둘 다
       node tools/probe_midalbo.mjs --json       # 표 대신 JSON

   ── 왜 있나 ──────────────────────────────────────────────────
   박사님 정의가 정본이다:
       산반  = 점박이·반점이 **흩어진** 것
       하프문 = **특이색 + 반반**으로 갈린 것
       풀문  = **완전** 특수색
   앞 창이 섬네일을 **눈으로 보고** 차콜을 틀리게 묶었다(START-HERE §2.9).
   그래서 이 자는 눈을 안 쓴다.

   ── 무엇을 재나 ─────────────────────────────────────────────
   잰 대상: `assets/monstera/skins/thumbs/<glb이름>.png` (512×512 · 흰 배경 불투명)
   ⚠ **텍스처(_base_color.png)가 아니라 섬네일**이다. 커밋 4b280f6 의 숫자를
     그대로 재현하는 쪽이 섬네일이었다(차콜 1,480 · 모브 9,880 — 검산해서 맞췄다).

       ① 으뜸 색   — 순백(255,255,255)을 뺀 나머지의 최빈 RGB
       ② 색 가짓수 — 순백을 뺀 서로 다른 RGB 개수      ← ①② 가 커밋 4b280f6 의 자다
       ③ 초록비    — 잎 화소 중 「초록」 화소의 비율    ← 「완전 특수색」을 가른다
       ④ 갈림거리  — 초록 무리와 특수색 무리의 **무게중심 거리** ÷ 잎 반지름
       ⑤ 덩어리도  — 특수색 화소 중 8-이웃이 전부 특수색인 것의 비율
                     (점박이는 작아서 낮고, 반반으로 갈린 덩어리는 높다)   ← ④⑤ 가 반반 vs 점박이

   ③~⑤ 는 **가장자리 안티앨리어싱을 2겹 깎은 잎 속살**에서만 잰다.
   안 깎으면 흰 배경과 잎 사이의 회색 띠가 통째로 「특수색 고리」로 잡힌다.

   ── 문턱은 어디서 왔나 (★ 눈으로 안 정했다) ────────────────────
   성숙잎 19갈래는 **이미 등급이 정해져 있다**(`data/balance/varie_grades.json`).
   그것을 정답지로 놓고 ③④⑤ 의 문턱을 맞췄다. `--mat` 이 그 채점표를 낸다.
   ⇒ 자가 정답지를 몇 개나 맞히는지가 **이 자를 믿을 근거**다. 어긋난 갈래는 표에 남긴다.

   ⚠ 이 자는 **아무 파일도 안 고친다.** 재기만 한다.
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THUMBS = path.join(ROOT, 'assets/monstera/skins/thumbs');

/* ───────── PNG 디코드 (의존성 없이) ─────────
   섬네일은 전부 RGBA·8비트·비인터레이스다(재서 확인함). 그 경우만 받는다. */
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
  if (depth !== 8) throw new Error(`비트깊이 ${depth} 는 못 읽는다`);
  if (interlace !== 0) throw new Error('인터레이스 PNG 는 못 읽는다');
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  if (!ch) throw new Error(`색타입 ${ctype} 는 못 읽는다(팔레트 미지원)`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= ch) ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v = (v + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c))) & 255;
      }
      cur[x] = v;
    }
  }
  return { w, h, ch, data: out };
}

/* ───────── 「초록인가」 — ★ 밝기를 빼고 잰다 ─────────
   ⚠ 처음엔 생 RGB 로 `G - max(R,B) >= 10` 을 썼다가 **틀렸다.**
     섬네일은 한쪽에서 빛을 받아 그늘이 지는데, 그늘진 초록은 R·G·B 가 다 같이 내려가
     차가 좁아진다. 그래서 「반쪽만 초록」으로 잡혀 멀쩡한 잎이 하프문이 됐다.
   ⇒ **색도**(r/(r+g+b), g/(r+g+b), b/(r+g+b))로 잰다. 밝기가 곱해져도 색도는 안 변한다.
   0.03 은 성숙잎 정답지로 맞춘 값이다 — 잎 초록은 0.10 이상, 민트·크림은 0.02 아래다. */
const GREEN_MARGIN = 0.03;
function isGreen(r, g, b) {
  const s = r + g + b + 1;
  return g / s - Math.max(r, b) / s >= GREEN_MARGIN;
}

/* ───────── 섬네일 한 장을 잰다 ───────── */
function measure(file) {
  const img = decodePNG(fs.readFileSync(file));
  const { w, h, ch, data } = img;
  const at = (x, y) => (y * w + x) * ch;

  /* ① ② — 순백만 뺀 나머지. 커밋 4b280f6 과 **같은 자**다. */
  const counts = new Map();
  let dom = null, domN = 0;
  /* mask0: 순백이 아닌 화소 */
  const mask0 = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y), r = data[i], g = data[i + 1], b = data[i + 2];
    if (r === 255 && g === 255 && b === 255) continue;
    mask0[y * w + x] = 1;
    const key = (r << 16) | (g << 8) | b;
    const n = (counts.get(key) || 0) + 1;
    counts.set(key, n);
    if (n > domN) { domN = n; dom = [r, g, b]; }
  }
  const uniq = counts.size;
  if (!uniq) return null;

  /* 잎 속살 — mask0 을 2겹 깎는다(안티앨리어싱 고리 제거) */
  let m = mask0;
  for (let pass = 0; pass < 2; pass++) {
    const nm = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (!m[y * w + x]) continue;
      if (m[(y - 1) * w + x] && m[(y + 1) * w + x] && m[y * w + x - 1] && m[y * w + x + 1]) nm[y * w + x] = 1;
    }
    m = nm;
  }

  /* ③ 초록비 · ④ 갈림거리 · ⑤ 덩어리도 */
  const spec = new Uint8Array(w * h);   // 특수색(=초록이 아닌) 잎 화소
  let nLeaf = 0, nGreen = 0;
  let gx = 0, gy = 0, sx = 0, sy = 0, cx = 0, cy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    const i = at(x, y);
    nLeaf++; cx += x; cy += y;
    if (isGreen(data[i], data[i + 1], data[i + 2])) { nGreen++; gx += x; gy += y; }
    else { spec[y * w + x] = 1; sx += x; sy += y; }
  }
  if (!nLeaf) return null;
  const nSpec = nLeaf - nGreen;
  const greenFrac = nGreen / nLeaf;
  const radius = Math.sqrt(nLeaf / Math.PI);

  let sepD = null;
  if (nGreen > 0 && nSpec > 0) {
    const dx = gx / nGreen - sx / nSpec, dy = gy / nGreen - sy / nSpec;
    sepD = Math.hypot(dx, dy) / radius;
  }

  /* ⑤ 덩어리도 — **적은 쪽** 무리로 잰다.
     점박이는 적은 쪽이 잘아서 속살이 거의 없고, 반반으로 갈린 쪽은 통짜라 속살이 대부분이다. */
  const minorIsGreen = nGreen <= nSpec;
  const nMinor = Math.min(nGreen, nSpec);
  let blockness = null, biggest = null;
  if (nMinor > 0) {
    /* 적은 쪽 마스크를 만든다(초록이 적은 쪽이면 spec 의 여집합) */
    const mm2 = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      const isSpec = spec[y * w + x] === 1;
      if (minorIsGreen ? !isSpec : isSpec) mm2[y * w + x] = 1;
    }
    /* ⑥ 최대덩어리비 — 적은 쪽이 **몇 조각인가**.
       반반으로 갈린 잎은 한 조각(≈1.0)이고, 점박이는 수십~수백 조각이라 제일 큰 것도 잘다.
       ★ 갈림거리(④)보다 이쪽이 곧다 — 자리가 어디냐가 아니라 「한 덩어리냐」를 곧장 센다. */
    const seen = new Uint8Array(w * h);
    const stack = new Int32Array(w * h);
    let best = 0;
    for (let p0 = 0; p0 < w * h; p0++) {
      if (!mm2[p0] || seen[p0]) continue;
      let sp = 0, n = 0;
      stack[sp++] = p0; seen[p0] = 1;
      while (sp) {
        const q = stack[--sp]; n++;
        const qx = q % w, qy = (q / w) | 0;
        if (qx > 0 && mm2[q - 1] && !seen[q - 1]) { seen[q - 1] = 1; stack[sp++] = q - 1; }
        if (qx < w - 1 && mm2[q + 1] && !seen[q + 1]) { seen[q + 1] = 1; stack[sp++] = q + 1; }
        if (qy > 0 && mm2[q - w] && !seen[q - w]) { seen[q - w] = 1; stack[sp++] = q - w; }
        if (qy < h - 1 && mm2[q + w] && !seen[q + w]) { seen[q + w] = 1; stack[sp++] = q + w; }
      }
      if (n > best) best = n;
    }
    biggest = best / nMinor;
    let inner = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (!mm2[y * w + x]) continue;
      if (mm2[(y - 1) * w + x - 1] && mm2[(y - 1) * w + x] && mm2[(y - 1) * w + x + 1] &&
          mm2[y * w + x - 1] && mm2[y * w + x + 1] &&
          mm2[(y + 1) * w + x - 1] && mm2[(y + 1) * w + x] && mm2[(y + 1) * w + x + 1]) inner++;
    }
    blockness = inner / nMinor;
  }
  const minShare = nMinor / nLeaf;
  return { dom, uniq, nLeaf, greenFrac, minShare, sepD, blockness, biggest };
}

/* ───────── 문턱 — 성숙잎 19갈래 정답지로 맞춘 값 ─────────
   ⚠ 바꿀 때는 반드시 `--mat` 로 채점표를 다시 뽑아라. */
export const CUTS = {
  minShareOne: 0.15,   // 적은 쪽이 이보다 작으면 「한 색짜리 잎」(잎맥·꼭지 몫이 이만큼 된다)
  sepHalf:     0.35,   // 두 무리의 무게중심이 이만큼 벌어지면 **자리로 갈렸다**
  blockHalf:   0.55,   // 적은 쪽이 이만큼 속살이면 점이 아니라 **덩어리**다
  minShareHalf: 0.35,  // 적은 쪽이 잎의 이만큼을 차지하면 「반쪽」이라 부를 만하다
  blockSolid:  0.85,   // 그런데 둘레가 거의 없다 = 통짜 덩어리 하나. 점박이는 여기 못 온다
};
function classify(mm) {
  const f = n => n === null ? '—' : n.toFixed(2);
  /* ㉠ 한 색짜리인가 — 적은 쪽이 10% 미만이면 잎이 통째로 한 색이다 */
  if (mm.minShare < CUTS.minShareOne) {
    return mm.greenFrac >= 0.5
      ? { id: 'sanban',   why: `한 색(적은쪽 ${(mm.minShare * 100).toFixed(1)}%)인데 **초록**이다 — 특수색이 아니다` }
      : { id: 'fullmoon', why: `한 색(적은쪽 ${(mm.minShare * 100).toFixed(1)}%)이고 초록이 아니다 — 완전 특수색` };
  }
  /* ㉡ 두 색인가 — 「반반」은 두 길 중 하나로 잡힌다.
       ⓐ 두 무리의 무게중심이 벌어져 있다(한쪽에 몰렸다)
       ⓑ 적은 쪽이 잎의 1/3 이상인데 둘레가 거의 없다(통짜 덩어리로 나눠 가졌다)
     ⚠ ⓑ 를 뒤에 더한 이유: 「하프문-그린흰」은 흰 쪽이 잎 **한가운데**를 차지해
       무게중심이 안 벌어진다(갈림 0.16). ⓐ 만으로는 그 갈래를 놓쳤다 — 재서 잡았다. */
  if (mm.sepD !== null && mm.blockness !== null && mm.sepD >= CUTS.sepHalf && mm.blockness >= CUTS.blockHalf)
    return { id: 'halfmoon', why: `갈림 ${f(mm.sepD)} · 덩어리 ${f(mm.blockness)} — 두 색이 한쪽으로 몰렸다` };
  if (mm.blockness !== null && mm.minShare >= CUTS.minShareHalf && mm.blockness >= CUTS.blockSolid)
    return { id: 'halfmoon', why: `적은쪽 ${(mm.minShare * 100).toFixed(0)}% · 덩어리 ${f(mm.blockness)} — 통짜로 나눠 가졌다` };
  return { id: 'sanban', why: `갈림 ${f(mm.sepD)} · 덩어리 ${f(mm.blockness)} — 흩어져 있다` };
}

/* ───────── 정본에서 읽는다 — 코드에 이름을 안 박는다 ───────── */
function readSources() {
  const html = fs.readFileSync(path.join(ROOT, 'plant_grow.html'), 'utf8');
  const block = html.slice(html.indexOf('const ASSET_FILES='));
  const files = {};   // 스킨키 -> glb 베이스이름
  for (const m of block.matchAll(/(?<![A-Za-z0-9_])(leaf_(?:mid_albo|mat)\d+)\s*:\s*'skins\/([A-Za-z0-9_]+)\.glb'/g))
    if (!files[m[1]]) files[m[1]] = m[2];
  const ko = {};
  const koBlock = html.slice(html.indexOf('const ADJ_KO='), html.indexOf('const ASSET_FILES='));
  for (const m of koBlock.matchAll(/(?<![A-Za-z0-9_])(leaf_(?:mid_albo|mat)\d+)\s*:\s*'([^']*)'/g)) if (!ko[m[1]]) ko[m[1]] = m[2];

  const grades = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/balance/varie_grades.json'), 'utf8'));
  const matGrade = {};   // leaf_matN -> 등급 id (정답지)
  const matKo = {};
  for (const g of grades.grades) for (const a of (g.assets || [])) {
    if (a.matNum == null) continue;
    matGrade['leaf_mat' + a.matNum] = g.id;
    matKo['leaf_mat' + a.matNum] = a.ko;
  }
  return { files, ko, grades, matGrade, matKo };
}

/* ───────── 표 ───────── */
const pad = (s, n) => { s = String(s); let w = 0; for (const c of s) w += (c.charCodeAt(0) > 0x1100 ? 2 : 1); return s + ' '.repeat(Math.max(0, n - w)); };
const rgb = d => d ? `(${d[0]},${d[1]},${d[2]})` : '—';

function run(keys, srcs, title) {
  const rows = [];
  for (const k of keys) {
    const base = srcs.files[k];
    if (!base) { rows.push({ key: k, err: 'ASSET_FILES 에 없다' }); continue; }
    const f = path.join(THUMBS, base + '.png');
    if (!fs.existsSync(f)) { rows.push({ key: k, base, err: '섬네일이 없다' }); continue; }
    let mm;
    try { mm = measure(f); } catch (e) { rows.push({ key: k, base, err: '못 쟀다: ' + e.message }); continue; }
    if (!mm) { rows.push({ key: k, base, err: '못 쟀다: 잎 화소가 0' }); continue; }
    rows.push({ key: k, base, ko: srcs.ko[k] || '', ...mm, ...classify(mm) });
  }
  console.log(`\n══ ${title} ══ (잰 것: 섬네일 512×512 · 순백 제외 · 속살 2겹 깎음)`);
  console.log(pad('스킨키', 18) + pad('이름', 28) + pad('으뜸색', 16) + pad('색가짓수', 10) + pad('초록비', 9) + pad('적은쪽', 9) + pad('갈림', 7) + pad('덩어리', 8) + pad('최대조각', 10) + '판정');
  for (const r of rows) {
    if (r.err) { console.log(pad(r.key, 18) + pad(r.ko || '', 28) + r.err); continue; }
    console.log(pad(r.key, 18) + pad(r.ko, 28) + pad(rgb(r.dom), 16) + pad(r.uniq, 10) +
      pad((r.greenFrac * 100).toFixed(1) + '%', 9) + pad((r.minShare * 100).toFixed(1) + '%', 9) +
      pad(r.sepD === null ? '—' : r.sepD.toFixed(2), 7) +
      pad(r.blockness === null ? '—' : r.blockness.toFixed(2), 8) +
      pad(r.biggest === null ? '—' : r.biggest.toFixed(2), 10) + r.id);
  }
  return rows;
}

/* ───────── ★ 판이 아니라 **갈래**로 정한다 ─────────
   에셋은 한 갈래가 세 판이다 — 기본 · `_v1`(쨍) · `_v2`(차분).
   **같은 무늬를 색만 달리 구운 것**이라 등급이 갈리면 안 된다. 그런데 한 판씩 재면 갈린다
   (실측: 하프문-크림민트가 기본·쨍은 하프문인데 차분만 산반으로 떨어졌다 — 차분판이
    크림 쪽까지 초록으로 눌러서다).
   ⇒ 세 판을 다 재고 **많은 쪽으로** 갈래를 정한다. 비기면 **기본판**을 따른다.
   ⚠ 정본(varie_grades.json)도 갈래 단위로 적혀 있다. 채점도 갈래 단위로 한다. */
const kindOf = base => base.replace(/_v[12]$/, '');

function byKind(rows, srcs) {
  const kinds = new Map();
  for (const r of rows) {
    if (r.err) continue;
    const k = kindOf(r.base);
    if (!kinds.has(k)) kinds.set(k, []);
    kinds.get(k).push(r);
  }
  const out = [];
  for (const [kind, rs] of kinds) {
    const votes = {};
    for (const r of rs) votes[r.id] = (votes[r.id] || 0) + 1;
    let top = null, topN = 0, tie = false;
    for (const [id, n] of Object.entries(votes)) {
      if (n > topN) { top = id; topN = n; tie = false; }
      else if (n === topN) tie = true;
    }
    const baseRow = rs.find(r => r.base === kind) || rs[0];
    if (tie) top = baseRow.id;
    out.push({ kind, id: top, votes, rows: rs, baseRow, unanimous: topN === rs.length });
  }
  return out;
}

/* ───────── 들머리 ───────── */
const argv = process.argv.slice(2);
const wantMat = argv.includes('--mat') || argv.includes('--all');
const wantMid = argv.includes('--mid') || argv.includes('--all') || (!argv.includes('--mat'));
const asJson = argv.includes('--json');
const srcs = readSources();
const out = {};

if (wantMat) {
  const keys = Object.keys(srcs.files).filter(k => k.startsWith('leaf_mat')).sort((a, b) => +a.slice(8) - +b.slice(8));
  const rows = run(keys, srcs, '성숙잎 — 자를 검정하는 쪽 (정답지가 있다)');
  const kinds = byKind(rows, srcs);
  out.mat = rows; out.matKinds = kinds;
  /* 정답지: matNum -> glb 갈래 */
  const truthOf = {};
  for (const [k, g] of Object.entries(srcs.matGrade)) if (srcs.files[k]) truthOf[kindOf(srcs.files[k])] = { g, ko: srcs.matKo[k] };
  let ok = 0, bad = 0;
  console.log('\n── 채점 — **갈래 단위** (varie_grades.json 이 정답지) ──');
  for (const kd of kinds) {
    const t = truthOf[kd.kind];
    if (!t) continue;
    const hit = t.g === kd.id;
    hit ? ok++ : bad++;
    const v = Object.entries(kd.votes).map(([a, b]) => `${a}×${b}`).join(' ');
    console.log(`  ${hit ? '✓' : '✗'} ${pad(kd.kind, 28)}${pad(t.ko, 24)}정답 ${pad(t.g, 10)}자 ${pad(kd.id, 10)}(${v})`);
  }
  console.log(`  맞음 ${ok} · 어긋남 ${bad} · 정답률 ${(ok / (ok + bad) * 100).toFixed(0)}%`);
  out.score = { ok, bad };
}
if (wantMid) {
  const keys = Object.keys(srcs.files).filter(k => k.startsWith('leaf_mid_albo')).sort((a, b) => +a.slice(13) - +b.slice(13));
  const rows = run(keys, srcs, '중간잎 42갈래(= 무늬 14갈래 × 세 판)');
  const kinds = byKind(rows, srcs);
  out.mid = rows; out.midKinds = kinds;
  console.log('\n── 갈래로 묶은 결과 (세 판 중 많은 쪽 · 비기면 기본판) ──');
  for (const kd of kinds) {
    const v = Object.entries(kd.votes).map(([a, b]) => `${a}×${b}`).join(' ');
    const keysOf = kd.rows.map(r => r.key.replace('leaf_mid_albo', '')).join(',');
    console.log(`  ${pad(kd.kind, 30)}${pad(kd.baseRow.ko, 24)}${pad(kd.id, 10)}${pad(kd.unanimous ? '만장' : '갈림', 6)}(${v})  키 ${keysOf}`);
  }
  const tallyK = {}, tally = {};
  for (const kd of kinds) tallyK[kd.id] = (tallyK[kd.id] || 0) + 1;
  for (const kd of kinds) tally[kd.id] = (tally[kd.id] || 0) + kd.rows.length;
  console.log('\n── 몇 개씩 나뉘었나 ──');
  for (const g of ['sanban', 'halfmoon', 'fullmoon']) console.log(`  ${pad(g, 12)}갈래 ${pad(tallyK[g] || 0, 4)}· 스킨 ${tally[g] || 0}`);
}
if (asJson) console.log('\n' + JSON.stringify(out, (k, v) => k === 'rows' || k === 'baseRow' ? undefined : v, 2));
