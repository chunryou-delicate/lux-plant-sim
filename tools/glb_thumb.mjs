/* ============================================================
   tools/glb_thumb.mjs — GLB 하나를 알파 있는 PNG 썸네일로 찍는다 (2026-08-11 신설)

     python tools/serve.py 8963
     node tools/glb_thumb.mjs <glb 경로> <낼 png 경로> [--url=http://localhost:8963]

   왜 있나 · 어떤 각으로 찍나는 `tools/glb_thumb.html` 머리글에 적었다.
   ⚠ 서버가 먼저 떠 있어야 한다 — GLTFLoader 가 file:// 에서 안 돈다.

   내는 것 (2026-08-15 더함)
   -------------------------
       <폴더>/thumbs/<이름>.png
       <폴더>/thumbs/index.json      GLB 이름 -> 썸네일 이름 · **실측 크기(m)**

   ★ 색인을 내는 이유는 `make_thumbs.py` 와 같다 — 「원본 이름 → 썸네일 이름」 규칙을
     읽는 쪽이 다시 짜면 두 곳이 갈린다. **만든 쪽이 적어 주고 읽는 쪽은 찾아보기만 한다.**
     그래서 `manifest.json` 은 한 줄도 안 건드린다. manifest 는 손으로 쓰는 파일로 남는다.

   ★ 크기를 같이 적는 이유 — 자리 판정이 **지름 하나로** 돈다(`first_play.slotFitsDiameter`).
     찍을 때 이미 재고 있던 값이라 버리지 않고 적는다. 나중에 따로 재면 두 곳이 갈린다.

   ⚠⚠ **그 크기는 GLB 자체 크기지 실제 크기가 아니다.** Meshy 산출물은 긴 축이 1 또는 2 로
     정규화돼 있다 — 모종삽이 `x=2` 로 나온다. 실제 미터는 `manifest.json` 의
     `scale_to_real` 을 곱해야 한다. 절차적로 만든 것(선반·작물)만 이미 실제 미터다.
     색인의 `sizeMeans` 줄에 같은 말을 적어 둔다. **라벨 없는 숫자가 이 저장소를 열 번 데였다.**
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
/* ── 색인 ─────────────────────────────────────────────────────
   `make_thumbs.py` 와 같은 규약이다 — **만든 쪽이 적어 주고 읽는 쪽은 찾아보기만 한다.**
   「GLB 이름 → 썸네일 이름」 규칙을 읽는 쪽이 다시 짜면 두 곳이 갈리기 때문이다.

   ⚠ 이어 붙인다. `--all` 은 이미 있는 것을 건너뛰므로, 이번에 찍은 것만 적으면
      앞서 찍어 둔 줄이 지워진다.
   ⚠ 크기를 모르는 줄은 `m: null` 로 둔다 — 이 고침(2026-08-15) 전에 찍힌 썸네일은
      크기를 안 적어 두었다. **짐작해서 채우지 않는다.**
   ⚠ 찍을 것이 하나도 없을 때도 부른다 — 이미 다 찍힌 폴더가 색인만 없는 경우가 있다. */
function writeIndex(dirs, made) {
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const idxPath = path.join(dir, 'index.json');
    let thumbs = {};
    if (fs.existsSync(idxPath)) {
      try { thumbs = (JSON.parse(fs.readFileSync(idxPath, 'utf8')).thumbs) || {}; }
      catch { thumbs = {}; }          // 깨졌으면 다시 짓는다
    }
    Object.assign(thumbs, (made && made.get(dir)) || {});

    /* 색인에 없는 채 파일만 있는 썸네일도 줄은 남긴다 — 「있다」는 사실이 「크기를 안다」보다 먼저다 */
    for (const f of fs.readdirSync(dir)) {
      if (!f.toLowerCase().endsWith('.png')) continue;
      const glbName = f.replace(/\.png$/i, '.glb');
      if (!thumbs[glbName]) thumbs[glbName] = { png: f, m: null, view: null };
    }

    const known = Object.values(thumbs).filter(v => v && v.m).length;
    fs.writeFileSync(idxPath, JSON.stringify({
      note: 'tools/glb_thumb.mjs 가 만든다. 손으로 고치지 말 것. GLB 이름 -> 썸네일 이름 · GLB 자체 크기',
      /* ★ 이 숫자는 **GLB 파일이 가진 크기**이지 실제 크기가 아니다.
         Meshy 산출물은 긴 축이 1 또는 2 로 정규화돼 있다(모종삽이 x=2 로 나온다).
         실제 미터는 `assets/manifest.json` 의 `scale_to_real` 을 곱해야 나온다.
         절차적로 만든 것(선반·작물)은 이미 실제 미터라 배율이 1.0 이다. */
      sizeMeans: 'GLB 원본 바운딩박스. 실제 미터 = 이 값 × manifest.scale_to_real',
      tool: 'tools/glb_thumb.mjs',
      updated: new Date().toISOString().slice(0, 10),
      thumbs: Object.fromEntries(Object.entries(thumbs).sort(([a], [b]) => a.localeCompare(b))),
    }, null, 1) + '\n', 'utf8');
    console.log(`  색인 ${path.relative(process.cwd(), idxPath).replace(/\\/g, '/')} — ` +
                `${Object.keys(thumbs).length}줄 (크기 아는 것 ${known})`);
  }
}

if (!jobs.length) {
  console.log('찍을 것이 없다 (이미 다 있음 — 다시 찍으려면 --force)');
  /* 그래도 색인은 손본다. 안 그러면 이미 다 찍힌 폴더는 색인이 영영 안 생긴다 */
  if (ALL) writeIndex([path.resolve(ALL.slice(6).replace(/\\/g, '/').replace(/\/$/, ''), 'thumbs')], null);
  process.exit(0);
}

const page = await launch({ width: 640, height: 640, dpr: 1, mobile: false });
await page.goto(`${BASE}/tools/glb_thumb.html`);
await page.waitFor('typeof window.__thumb === "function"', 60000, 200);

/* 찍은 것을 폴더별로 모아 둔다 — 아래 §색인 에서 한 번에 적는다 */
const made = new Map();   // thumbs 폴더(절대경로) -> { <glb 이름>: {png, m, view} }

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

  const dir = path.dirname(j.out);
  if (!made.has(dir)) made.set(dir, {});
  made.get(dir)[path.basename(j.glb)] = {
    png: path.basename(j.out),
    /* 가로 · 세로 · 높이(m). 자리 판정이 지름 하나로 도니(first_play.slotFitsDiameter)
       찍을 때 재 둔 값을 적어 둔다. 나중에 다시 재면 두 곳이 갈린다. */
    m: { x: size.x, z: size.z, y: size.y },
    view: VIEW,
  };
  console.log(`  ok  ${path.basename(j.out).padEnd(34)} ${(fs.statSync(j.out).size / 1024).toFixed(0).padStart(4)} KB` +
              `   크기 ${size.x} × ${size.z} × ${size.y} m`);
}

writeIndex(new Set([...made.keys(), ...jobs.map(j => path.dirname(j.out))]), made);

console.log(`\n찍은 것 ${ok} · 못 찍은 것 ${bad}`);
process.exit(bad ? 1 : 0);
