/* ============================================================
   tools/probe_arrival_ingame.mjs — **게임 화면으로** 도착을 확인한다
   ------------------------------------------------------------
   "코드가 맞다"와 "화면에서 그렇다"는 다르다. 이 자는 game.html 을 실제로 띄우고
   플레이어가 누르는 버튼만 눌러서 세 가지를 눈으로 본다:
     ① 몬스테라가 **언제** 오나 (몇 일차 · 몇 회전째)
     ② 와서 **줄기가 몇 개**인가
     ③ **2개째가 실제로 나는가** (며칠 뒤에)
   누르는 것은 [물 주기] · [다음 날] · [콩나물 거두기] · [콩나물 다시 심기] · 상점 [주문] 뿐이다.

   쓰기: node tools/probe_arrival_ingame.mjs
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 900000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const OUT = 'docs/engine/shots/arrival';

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await sleep(7000);

const click = (id) => page.eval(`(()=>{const e=document.getElementById('${id}');
  if(!e||e.disabled||e.offsetParent===null) return false; e.click(); return true;})()`);
/* 서랍(시트) 안에 있는 버튼 — 화면에 안 떠 있어도 누른 것과 같은 일이 일어난다.
   서랍을 여닫는 동작까지 흉내 내면 재기가 대사·애니메이션에 휘둘린다. */
const force = (id) => page.eval(`(()=>{const e=document.getElementById('${id}');
  if(!e||e.disabled) return false; e.click(); return true;})()`);
const skip = async () => {
  for (let i = 0; i < 20; i++) {
    const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
    if (!t) break;
    await page.eval(`document.getElementById('dlgBox').click()`, false); await sleep(220);
  }
};
await click('dlgSkip'); await sleep(800); await skip();
await click('guideClose'); await sleep(600);

/* 시루를 가장 어두운 자리(서랍장)에 놓는다 — 드래그가 게임의 실제 경로다 */
await page.eval(`(()=>{ const rv=window.__rv, c=document.getElementById('roomCanvas').getBoundingClientRect();
  const sp=rv.screenPosOf('banjiha-dresser:1');
  window.__drag.begin('beansprout', document.getElementById('cropThumb').src, {clientX:c.left+c.width*0.9, clientY:c.top+40});
  window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y}); window.__drag.end(); })()`, false);
await sleep(1500); await skip();

const snap = () => page.eval(`(()=>{ const S=window.__S();
  const b=S.firstPlay&&S.firstPlay.beansprout;
  let ls=null, gd=null, ph=null, cn=null;
  try{ ls=window.__io.growth.leafStats(); }catch(e){}
  try{ gd=window.__io.growth.growthDays(); }catch(e){}
  try{ ph=window.__io.growth.growthPhase(); }catch(e){}
  try{ cn=window.__io.growth.cuttableNodes(); }catch(e){}
  const gw=document.getElementById('growth');
  let stems=null;
  try{ const W=gw.contentWindow, g=W.ageOf(W.growthDays());
       stems=W.topologyNow(g).filter(a=>a.birth<=g).length; }catch(e){}
  return { day:S.day, 회전:b&&b.harvestCount, 화분:S.pots.length,
           유효:gd, 줄기:stems, 잎:ls&&ls.leaves, 마디:cn&&cn.length,
           단계:ph&&ph.phaseKo, 완료:!!(S.firstPlay&&S.firstPlay.completed) }; })()`);

/* 방 화면은 멀어서 줄기 수가 안 읽힌다 — 플레이어가 화분을 탭했을 때 뜨는
   확대(plant_grow 오버레이)가 실제로 그루를 보는 화면이다. 그걸 찍는다. */
const zoomShot = async (name) => {
  await page.eval(`(()=>{ try{ window.__byeotZoom.open(); }catch(e){} })()`, false);
  await sleep(2500);
  const f = await page.shot(`${OUT}/${name}`);
  await page.eval(`(()=>{ try{ window.__byeotZoom.close(); }catch(e){} })()`, false);
  await sleep(600);
  return f;
};

const rows = [];
let arrivedAt = null, twoStemAt = null;
for (let d = 0; d < 70; d++) {
  /* 거뒀으면 씨앗을 시키고 다시 심는다 (상점은 서랍 안이다) */
  await page.eval(`(()=>{ const b=document.querySelector('[data-buy="bean_seed"]');
    if(b && !b.disabled) b.click(); return !!b; })()`, false);
  await force('resow'); await sleep(250);
  await click('waterCrop'); await sleep(200);
  await click('next'); await sleep(900); await skip();
  await click('harvestCrop'); await sleep(900); await skip();

  const r = await snap();
  rows.push(r);
  if (!arrivedAt && r.화분 > 0) {
    arrivedAt = r;
    console.log('★도착 →', JSON.stringify(r));
    await sleep(1200);
    await page.shot(`${OUT}/ingame_arrival.png`);
    await zoomShot('ingame_arrival_zoom.png');
    /* 도착하면 플레이어가 하는 일 — 창턱으로 옮긴다 */
    await page.eval(`(()=>{ const s=document.getElementById('slot');
      if(s){ s.value='banjiha-sill:0'; s.dispatchEvent(new Event('change',{bubbles:true})); } })()`, false);
    await sleep(1500); await skip();
  }
  if (arrivedAt && !twoStemAt && r.줄기 >= 2) {
    twoStemAt = r;
    console.log('★2개째 →', JSON.stringify(r));
    await sleep(1200);
    await page.shot(`${OUT}/ingame_two_stems.png`);
    await zoomShot('ingame_two_stems_zoom.png');
  }
  if (twoStemAt && r.잎 >= 2) {
    console.log('★2개째의 첫 잎 →', JSON.stringify(r));
    await sleep(1200);
    await page.shot(`${OUT}/ingame_two_leaves.png`);
    await zoomShot('ingame_two_leaves_zoom.png');
    break;
  }
}

console.log('\n일차  회전 화분 유효 줄기 잎 마디 단계');
for (const r of rows)
  console.log(String(r.day).padStart(4), String(r.회전).padStart(4), String(r.화분).padStart(4),
              String(r.유효).padStart(4), String(r.줄기).padStart(4), String(r.잎).padStart(3),
              String(r.마디).padStart(4), r.단계 || '');
console.log('\n도착:', JSON.stringify(arrivedAt));
console.log('2개째:', JSON.stringify(twoStemAt));
await page.close();
