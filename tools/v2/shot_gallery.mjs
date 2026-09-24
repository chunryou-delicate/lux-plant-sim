/* 보이는 층 v2 — glb_gallery.html 을 헤드리스 크롬으로 찍는다. 크레딧 0.
   node tools/v2/shot_gallery.mjs <out.png> <a.glb,b.glb,...> [--w=1400 --h=900 --anim --t=0.4 --clip=0]
   ⚠ 이 자는 «생성 GLB 가 어떻게 생겼나»만 본다. 게임 안의 모습은 tools/playshot.mjs 로 본다(판정은 그쪽). */
import { launch, sleep } from '../test_cdp.mjs';
const a = process.argv.slice(2).filter(x => !x.startsWith('--'));
const o = Object.fromEntries(process.argv.slice(2).filter(x => x.startsWith('--')).map(x => { const [k, v] = x.slice(2).split('='); return [k, v ?? '1']; }));
const [out, files] = a;
const base = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: +(o.w || 1400), height: +(o.h || 900) });
let url = `${base}/tools/v2/glb_gallery.html?files=${encodeURIComponent(files)}`;
if (o.anim) url += `&anim=1&t=${o.t || 0.4}&clip=${o.clip || 0}`;
await page.goto(url);
await page.waitFor('window.__ready === true', 120000);
await sleep(300);
const info = await page.eval('JSON.stringify(window.__info)');
await page.shot(out);
console.log(info);
await page.close();
