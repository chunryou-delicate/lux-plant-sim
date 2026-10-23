/* tools/leaf/_shot_repose.mjs — 다시 세운 스킨답서스(repose_leaf · 10-23 D71)를 원본과 «같은 카메라 · 같은 크기»로 나란히 찍는다
   leaf_compare.html(확대창 빛 · normalizeAsset 자 · 높이 1 = 게임의 real_max_m · 두 판 다 가장 긴 축이 높이)로 판마다 한 장씩 찍고 OUT 에 둔다.
   a = 원본(_out/sc_orig · _hf_masters 사본) · b = 다시 세운 판(assets) · 보는 각 = VIEWS(기본 front · 3q · side 는 둘이 앞뒤로 겹쳐 못 씀)
   ⛔ 아무것도 안 고친다. 쓰기: BYEOT_URL=http://127.0.0.1:8991 node tools/leaf/_shot_repose.mjs <OUT 폴더> */
import { launch, sleep } from '../test_cdp.mjs';
import fs from 'node:fs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const L = ['sc_leaf_young', 'sc_leaf_mid', 'sc_leaf_mature', 'skins/sc_leaf_mature_marblequeen', 'skins/sc_leaf_mature_njoy'];
const page = await launch({ width: 700, height: 700, dpr: 1 });
for (const view of (process.env.VIEWS || 'front,3q').split(',')) for (const n of L) {
  /* leaf_compare 는 front·top 만 a 를 왼쪽에 둔다 — 3q 는 카메라가 −X 쪽이라 a 가 오른쪽에 온다 ⇒ 원본이 늘 왼쪽에 오게 바꿔 넣는다 */
  const [L1, R1] = [`/_out/sc_orig/${n}.glb`, `/assets/plants/scindapsus/${n}.glb`];
  const [A1, B1] = (view === 'front' || view === 'top') ? [L1, R1] : [R1, L1];
  const q = `a=${A1}&b=${B1}&view=${view}&size=700x700`;
  await page.goto(`${BASE}/tools/leaf/leaf_compare.html?${q}`);
  await page.waitFor('window.__ready === true', 60000, 200);
  const err = await page.eval('window.__err || ""'); if (err) console.log('FAIL', n, view, err);
  const f = `${OUT}/${view}_${n.split('/').pop()}.png`; await page.shot(f); console.log('ok', f);
  await sleep(100);
}
process.exit(0);
