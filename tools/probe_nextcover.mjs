/* [다음 날]·왼쪽 아래 단추를 **대사 상자가 덮나** — 해상도별 (박사님 민원 ②)
   ⚠ 앞선 자는 「그때 마침 대사가 떠 있었나」에 따라 답이 달라졌다. 여기서는
     대사를 **일부러 띄워 놓고** 잰다 — 그래야 해상도 탓인지 대사 탓인지가 갈린다. */
import { launch, sleep } from './test_cdp.mjs';
const _wd = setTimeout(() => { console.error('⏱ 자가 제한 초과'); process.exit(2); }, 900000);
_wd.unref && _wd.unref(); process.on('exit', () => clearTimeout(_wd));
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const SIZES = [[1920,1080],[1600,900],[1440,900],[1366,768],[1280,800],[1152,864],[1024,768],[390,844]];
for (const [w, h] of SIZES) {
  const page = await launch({ width: w, height: h, dpr: 1, mobile: false });
  await page.goto(`${BASE}/game.html`);
  await page.eval(`localStorage.clear()`, false);
  await page.goto(`${BASE}/game.html`);
  await page.waitFor('window.__byeotBooted === true', 180000, 300);
  await sleep(6000);
  const r = await page.eval(`(()=>{
    /* ★ 두 판을 잰다 — **대사 없을 때**와 **대사 떠 있을 때**. 하나만 재면
       「대사 탓인지 해상도 탓인지」가 안 갈린다. */
    const st = document.getElementById('stage');
    st.classList.remove('talking');
    const 대사없이 = (() => { const o = {};
      for (const id of ['next','waterCrop','harvestCrop','waterPot']) {
        const b = document.getElementById(id); if (!b) continue;
        const wasHidden = b.style.display === 'none'; if (wasHidden) b.style.display = '';
        const r = b.getBoundingClientRect();
        const e = document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
        o[id] = !!(e && (e === b || b.contains(e)));
        if (wasHidden) b.style.display = 'none';
      } return o; })();
    st.classList.add('talking');
    const box = document.getElementById('dlgBox').getBoundingClientRect();
    const out = {};
    for (const id of ['next','waterCrop','harvestCrop','waterPot']) {
      const b = document.getElementById(id); if (!b) continue;
      const wasHidden = b.style.display === 'none';
      if (wasHidden) b.style.display = '';
      const r = b.getBoundingClientRect();
      const 겹침 = !(r.right <= box.left || r.left >= box.right || r.bottom <= box.top || r.top >= box.bottom);
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      const el = document.elementFromPoint(cx, cy);
      out[id] = { 겹침, 눌리나: !!(el && (el === b || b.contains(el))),
                  덮은것: (el && (el.id || el.tagName)) || null };
      if (wasHidden) b.style.display = 'none';
    }
    return JSON.stringify({ 화면:[innerWidth,innerHeight], 대사없이눌리나: 대사없이,
      대사상자:[Math.round(box.left),Math.round(box.top),Math.round(box.width),Math.round(box.height)],
      단추: out });
  })()`);
  console.log(`${String(w).padStart(4)}x${String(h).padStart(4)}`, r);
  await page.close();
}
