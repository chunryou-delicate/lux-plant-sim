/* ============================================================
   tools/probe_reach_live.mjs — **실제로 걸어 보고** 재는 자 (G-9)
   ------------------------------------------------------------
   probe_reach.mjs 는 「이렇게 될 것이다」를 계산한다. 이 자는 게임을 실제로 굴려
   `roomView.actAt(자리,'water')` 를 자리마다 부르고 **끝난 뒤 어디에 서 있나**를 잰다.
   예측과 실측이 갈리면 예측이 거짓말이다 — 그걸 잡으라고 두 벌을 둔다.

   무엇을 켜고 무엇을 껐나
     · 실제 game.html · localStorage 비우고 새로 시작 · 반지하 · 데스크톱 1280×900
     · 연출은 **켠 채**로 잰다(setActInstant 안 쓴다). 걷는 것이 재는 대상이다
     · 자리는 slots() 전부 — **안 자른다**
     · 자리마다 먼저 **정해진 출발점**으로 걸어 보내 놓고 부른다

   ⚠⚠ 출발점이 결과를 바꾼다 — 이걸로 한 번 헛짚었다 (2026-08-16)
     처음에는 「화면에서 제일 먼 바닥 점」으로 보내 놓고 쟀다. 그렇게 재니 고침 **전**에도
     14곳이 다 통과해서 *"재현이 안 된다"* 로 읽힐 뻔했다. 실제로는 **그 출발점이
     제일 나쁜 출발점이 아니었을 뿐**이다. 길찾기는 출발점에서 갈 수 있는 칸만 훑으므로
     (floor_nav §path) 어디서 출발하느냐에 따라 세우는 자리가 달라진다.
     ⇒ BYEOT_FROM 으로 **자리마다 제일 나쁜 출발점**을 지정한다(probe_reach.mjs 의 worstFrom).
       안 주면 예전처럼 「제일 먼 점」으로 간다 — 그건 **느슨한 자**다.

   BYEOT_FROM='{"banjiha-etagere:1":{"x":-1.9,"z":-1.4}, ...}'

   내는 값
     gap    끝난 뒤 캐릭터 → 자리 거리 [m]  ← ACT_REACH 1.45 와 겨루는 그 값
     fail   onFail 이 온 사유 (없으면 '-')
     walked 실제로 움직인 거리 [m]
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const TAG = process.env.BYEOT_TAG || 'after';
const FROM = process.env.BYEOT_FROM ? JSON.parse(process.env.BYEOT_FROM) : {};

const page = await launch({ width: 1280, height: 900, dpr: 1, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(6000);

/* 대사·안내를 걷어낸다 — 말풍선이 떠 있으면 캔버스 클릭이 먹히지 않는다 */
await page.eval(`(()=>{const e=document.getElementById('dlgSkip'); if(e&&e.offsetParent) e.click();})()`, false);
await sleep(900);
for (let i = 0; i < 25; i++) {
  const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
  if (!t) break;
  await page.eval(`document.getElementById('dlgBox').click()`, false); await sleep(220);
}
await page.eval(`(()=>{const e=document.getElementById('guideClose'); if(e&&e.offsetParent) e.click();})()`, false);
await sleep(700);

const slots = JSON.parse(await page.eval(`JSON.stringify(window.__rv.slots().map(s=>s.slotId))`));
console.log(`\n자리 ${slots.length}곳 · 연출 켠 채 실제로 걸어서 잰다 (tag=${TAG})\n`);

const rows = [];
for (const id of slots) {
  /* ① 정해진 출발점으로 보낸다. 없으면 대상에서 제일 먼 바닥 점으로 (§⚠ 출발점) */
  const want = FROM[id] || null;
  await page.eval(`(()=>{ const rv=window.__rv, r=document.getElementById('roomCanvas').getBoundingClientRect();
    const t=rv.resolveKey(${JSON.stringify(id)});
    const want=${JSON.stringify(want)};
    let best=null;
    for(const fx of [0.08,0.2,0.32,0.44,0.56,0.68,0.8,0.92]) for(const fy of [0.5,0.6,0.7,0.8,0.9]){
      const x=r.left+r.width*fx, y=r.top+r.height*fy;
      const w=rv.walkTo('jachwi', x, y);
      if(!w||!w.ok) continue;
      /* 출발점을 정했으면 **거기에 제일 가까운** 점, 아니면 대상에서 **제일 먼** 점 */
      const d = want ? -Math.hypot(w.x-want.x, w.z-want.z)
                     :  Math.hypot(w.x-t.pos.x, w.z-t.pos.z);
      if(!best||d>best.d) best={x,y,d};
    }
    if(best) rv.walkTo('jachwi', best.x, best.y); })()`, false);
  await sleep(5000);

  /* ② 실제로 부른다. 연출을 끝까지 기다린다 */
  const r = JSON.parse(await page.eval(`(async()=>{ const rv=window.__rv;
    const c0=rv.characters().find(c=>c.id==='jachwi');
    const p0={x:c0.pos.x,z:c0.pos.z};
    let fail=null;
    const res=await rv.actAt(${JSON.stringify(id)}, 'water', { onFail:(w)=>{ fail=w||'(사유 없음)'; } });
    const c1=rv.characters().find(c=>c.id==='jachwi');
    const t=rv.resolveKey(${JSON.stringify(id)});
    return JSON.stringify({ id:${JSON.stringify(id)},
      gap:+Math.hypot(c1.pos.x-t.pos.x, c1.pos.z-t.pos.z).toFixed(3),
      walked:+Math.hypot(c1.pos.x-p0.x, c1.pos.z-p0.z).toFixed(3),
      ok:!!res.ok, fail: fail||'-' }); })()`, true, 60000));
  rows.push(r);
  console.log(`${String(r.id).padEnd(22)} gap ${String(r.gap.toFixed(2)).padStart(5)}m  걸음 ${String(r.walked.toFixed(2)).padStart(5)}m  ${r.ok ? '✔' : '✘ ' + r.fail}`);
  /* ★ 사진 — 「고쳤다」를 글자로만 쓰지 않는다. 재현이 되는 그 자리를 찍는다.
     ⚠ 이 자리는 **바닥을 눌러서는 못 가는 데**다(재서 확인했다 — 화면에서 찍을 수 있는
       점 중 제일 나쁜 것도 1.39m 라 안 터진다). 앞 동작이 캐릭터를 거기 세워 놓기 때문에
       나는 사고라, 이 차례를 그대로 밟아야만 나온다. 그래서 여기서 찍는다. */
  if (id === 'banjiha-dresser:1' || !r.ok) {
    const f = `docs/handoff/img/reach/${TAG}_${String(id).replace(/[^\w]/g, '_')}.png`;
    await page.shot(f).catch(() => { });
    console.log(`    사진 → ${f}`);
  }
}

const worst = rows.reduce((a, b) => (b.gap > a.gap ? b : a));
const bad = rows.filter(r => !r.ok);
console.log('-'.repeat(70));
console.log(`제일 먼 gap  ${worst.gap.toFixed(2)}m  (${worst.id})   ·  실패 ${bad.length}곳`);
if (bad.length) console.log(bad.map(b => `  ✘ ${b.id} — ${b.fail}`).join('\n'));
await page.shot(`docs/handoff/img/reach_${TAG}.png`).catch(() => { });
console.log(`\nJSON=${JSON.stringify(rows)}`);
await page.close();
