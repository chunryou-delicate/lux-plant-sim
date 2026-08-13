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
const flags = process.argv.slice(2).filter(a => a.startsWith('--'));
const urlArg = flags.find(a => a.startsWith('--url='));
const BASE = (urlArg && urlArg.slice(6)) || process.env.BYEOT_URL || 'http://localhost:8963';
const FORCE = flags.includes('--force');
/* 잎은 위에서 봐야 무늬가 읽힌다 — `--view=top` (§glb_thumb.html §보는 각) */
const VIEW = (flags.find(a => a.startsWith('--view=')) || '--view=3q').slice(7);

/* ★ 한 벌 찍기 — `--all <폴더>` 면 그 폴더의 GLB 를 전부 찍어 `<폴더>/thumbs/` 에 넣는다.
   ⚠ 브라우저를 **한 번만** 띄운다. GLB 마다 새로 띄우면 28개에 5분이 넘는다. */
const allDir = (() => { const i = args.indexOf('--all'); return null; })();
const ALL = flags.find(a => a.startsWith('--all='));

let jobs = [];
if (ALL) {
  const dir = ALL.slice(6).replace(/\\/g, '/').replace(/\/$/, '');
  const abs = path.resolve(dir);
  for (const f of fs.readdirSync(abs)) {
    if (!f.toLowerCase().endsWith('.glb')) continue;
    const out = path.join(abs, 'thumbs', f.replace(/\.glb$/i, '.png'));
    if (!FORCE && fs.existsSync(out)) continue;
    jobs.push({ glb: `${dir}/${f}`, out });
  }
} else if (args.length >= 2) {
  jobs = [{ glb: args[0], out: path.resolve(args[1]) }];
} else {
  console.error('쓰는 법: node tools/glb_thumb.mjs <glb> <png>   |   --all=<폴더> [--force]');
  process.exit(2);
}
if (!jobs.length) { console.log('찍을 것이 없다 (이미 다 있음 — 다시 찍으려면 --force)'); process.exit(0); }

const page = await launch({ width: 640, height: 640, dpr: 1, mobile: false });
await page.goto(`${BASE}/tools/glb_thumb.html`);
await page.waitFor('typeof window.__thumb === "function"', 60000, 200);

let ok = 0, bad = 0;
for (const j of jobs) {
  /* 앞 판을 지우고 다시 시작한다 — 한 화면에 둘이 겹치면 둘 다 못 쓴다 */
  await page.eval(`window.__reset()`, false);
  const glbUrl = '/' + j.glb.replace(/\\/g, '/').replace(/^\.?\//, '');
  await page.eval(`window.__thumb(${JSON.stringify(glbUrl)}, ${JSON.stringify(VIEW)})`, false);
  await page.waitFor('window.__done === true', 120000, 150);

  const err = await page.eval(`window.__err`);
  if (err) { console.log(`FAIL ${j.glb} — ${err}`); bad++; continue; }

  const size = await page.eval(`window.__size`);
  const b64 = String(await page.eval(`window.__png`)).split(',')[1];
  fs.mkdirSync(path.dirname(j.out), { recursive: true });
  fs.writeFileSync(j.out, Buffer.from(b64, 'base64'));
  ok++;
  console.log(`  ok  ${path.basename(j.out).padEnd(34)} ${(fs.statSync(j.out).size / 1024).toFixed(0).padStart(4)} KB` +
              `   크기 ${size.x} × ${size.z} × ${size.y} m`);
}
console.log(`\n찍은 것 ${ok} · 못 찍은 것 ${bad}`);
process.exit(bad ? 1 : 0);
