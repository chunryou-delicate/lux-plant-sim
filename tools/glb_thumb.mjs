/* ============================================================
   tools/glb_thumb.mjs — GLB 하나를 알파 있는 PNG 썸네일로 찍는다 (2026-08-11 신설)

     python tools/serve.py 8963
     node tools/glb_thumb.mjs <glb 경로> <낼 png 경로> [--url=http://localhost:8963]

   왜 있나 · 어떤 각으로 찍나는 `tools/glb_thumb.html` 머리글에 적었다.
   ⚠ 서버가 먼저 떠 있어야 한다 — GLTFLoader 가 file:// 에서 안 돈다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const urlArg = process.argv.slice(2).find(a => a.startsWith('--url='));
const BASE = (urlArg && urlArg.slice(6)) || process.env.BYEOT_URL || 'http://localhost:8963';

if (args.length < 2) {
  console.error('쓰는 법: node tools/glb_thumb.mjs <glb 경로> <낼 png 경로>');
  process.exit(2);
}
const [glbRel, outRel] = args;

const page = await launch({ width: 640, height: 640, dpr: 1, mobile: false });
await page.goto(`${BASE}/tools/glb_thumb.html`);
await page.waitFor('typeof window.__thumb === "function"', 60000, 200);

/* 서버 기준 경로로 넘긴다 — 페이지가 /tools/ 에 있으므로 절대 경로가 안전하다 */
const glbUrl = '/' + glbRel.replace(/\\/g, '/').replace(/^\.?\//, '');
await page.eval(`window.__thumb(${JSON.stringify(glbUrl)})`, false);
await page.waitFor('window.__done === true', 120000, 200);

const err = await page.eval(`window.__err`);
if (err) { console.error('FAIL ' + err); process.exit(1); }

const size = await page.eval(`window.__size`);
const dataUrl = await page.eval(`window.__png`);
const b64 = String(dataUrl).split(',')[1];
const out = path.resolve(outRel);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(b64, 'base64'));

console.log(`찍었다 ${outRel}`);
console.log(`  물건 크기(m)  x ${size.x} · y ${size.y} · z ${size.z}`);
console.log(`  파일 크기     ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
process.exit(0);
