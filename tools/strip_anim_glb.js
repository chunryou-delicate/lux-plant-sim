/* ============================================================
   tools/strip_anim_glb.js — 애니메이션만 남긴 GLB 만들기
   ------------------------------------------------------------
   왜: assets/characters/3d 의 *_idle.glb / *_walking.glb 는 메시·텍스처를
       통째로 다시 담고 있어 하나에 12~17MB다. 캐릭터 하나 띄우는 데
       rigged + idle + walking = 40MB+ 를 받게 된다.
       반면 anim/*.glb 는 클립만 들어 있어 0.1MB다. 같은 형태로 줄인다.

   무엇을: 메시·재질·이미지·스킨을 버리고 노드(뼈대)와 애니메이션,
           그리고 애니메이션이 참조하는 accessor/bufferView만 남긴다.

   ★ 원본(assets/characters)은 읽기만 한다. 결과는 assets/derived/char_clips/ 에 쓴다.
     (캐릭 에셋은 다른 작업창 담당이라 건드리지 않는다)

   사용: node tools/strip_anim_glb.js
============================================================ */
const fs = require('fs');
const path = require('path');

const SRC = 'assets/characters/3d';
const OUT = 'assets/derived/char_clips';

function readGLB(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546C67) throw new Error('GLB 아님: ' + file);
  let off = 12, json = null, bin = null;
  while (off < b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4);
    const data = b.slice(off + 8, off + 8 + len);
    if (type === 0x4E4F534A) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004E4942) bin = data;
    off += 8 + len + ((4 - (len % 4)) % 4 === 0 ? 0 : 0);
    off = off + ((4 - (off % 4)) % 4);
  }
  return { json, bin };
}

function writeGLB(file, json, bin) {
  const js = Buffer.from(JSON.stringify(json), 'utf8');
  const jsPad = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const binPad = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)]);
  const total = 12 + 8 + jsPad.length + (binPad.length ? 8 + binPad.length : 0);
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546C67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsPad.length, 12); out.writeUInt32LE(0x4E4F534A, 16);
  jsPad.copy(out, 20);
  if (binPad.length) {
    const o = 20 + jsPad.length;
    out.writeUInt32LE(binPad.length, o); out.writeUInt32LE(0x004E4942, o + 4);
    binPad.copy(out, o + 8);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out);
  return total;
}

function strip(srcFile, outFile) {
  const { json: j, bin } = readGLB(srcFile);
  if (!j.animations || !j.animations.length) return null;

  // 애니메이션이 쓰는 accessor만 모은다
  const accUsed = new Set();
  for (const a of j.animations)
    for (const s of (a.samplers || [])) { accUsed.add(s.input); accUsed.add(s.output); }

  const accList = [...accUsed].sort((x, y) => x - y);
  const accMap = new Map(accList.map((old, i) => [old, i]));

  // 그 accessor가 쓰는 bufferView만, 새 BIN으로 재배치
  const bvUsed = [...new Set(accList.map(i => j.accessors[i].bufferView).filter(v => v != null))];
  const bvMap = new Map();
  const chunks = [];
  let off = 0;
  const newBV = [];
  for (const old of bvUsed) {
    const bv = j.bufferViews[old];
    const start = bv.byteOffset || 0;
    const buf = bin.slice(start, start + bv.byteLength);
    const pad = (4 - (off % 4)) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad, 0)); off += pad; }
    bvMap.set(old, newBV.length);
    newBV.push({ buffer: 0, byteOffset: off, byteLength: bv.byteLength,
                 ...(bv.byteStride ? { byteStride: bv.byteStride } : {}) });
    chunks.push(buf); off += buf.length;
  }
  const newBin = Buffer.concat(chunks);

  const newAcc = accList.map(i => {
    const a = { ...j.accessors[i] };
    a.bufferView = bvMap.get(j.accessors[i].bufferView);
    delete a.sparse;
    return a;
  });

  // 노드는 뼈대 계층만 남긴다(메시·스킨 참조 제거)
  const newNodes = (j.nodes || []).map(n => {
    const o = { ...n };
    delete o.mesh; delete o.skin; delete o.camera;
    return o;
  });

  const newAnims = j.animations.map(a => ({
    ...a,
    samplers: (a.samplers || []).map(s => ({ ...s, input: accMap.get(s.input), output: accMap.get(s.output) }))
  }));

  const out = {
    asset: j.asset || { version: '2.0' },
    scene: j.scene ?? 0,
    scenes: j.scenes || [{ nodes: [0] }],
    nodes: newNodes,
    accessors: newAcc,
    bufferViews: newBV,
    buffers: [{ byteLength: newBin.length }],
    animations: newAnims
  };
  const size = writeGLB(outFile, out, newBin);
  return { size, clips: newAnims.map(a => a.name) };
}

// ---- 실행 ----
const chars = [...new Set(fs.readdirSync(SRC)
  .filter(f => /_rigged\.glb$/.test(f))
  .map(f => f.replace(/^char_/, '').replace(/_rigged\.glb$/, '')))];

let saved = 0;
for (const c of chars) {
  for (const kind of ['idle', 'walking']) {
    const src = path.join(SRC, `char_${c}_${kind}.glb`);
    if (!fs.existsSync(src)) { console.log(`  - 없음 ${c}/${kind}`); continue; }
    const out = path.join(OUT, `char_${c}_${kind}.glb`);
    try {
      const r = strip(src, out);
      const before = fs.statSync(src).size;
      saved += before - r.size;
      console.log(`  ✓ ${c}/${kind}  ${(before/1048576).toFixed(1)}MB → ${(r.size/1024).toFixed(0)}KB  [${r.clips}]`);
    } catch (e) { console.log(`  ✗ ${c}/${kind}: ${e.message}`); }
  }
}
console.log(`\n총 절약 ${(saved/1048576).toFixed(0)} MB`);
