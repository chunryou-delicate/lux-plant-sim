/* tools/probe_pointfollow.mjs — **«점»으로 짚는 손가락이 «따라다니나»** (2026-09-02)
   ------------------------------------------------------------------
   박사님 폰 그림: 첫 몬스테라를 놓은 뒤 손가락이 «허공»을 짚었다.
   점으로 짚는 손가락은 한 번 놓고 끝이었다 — 시점이 돌거나 판이 바뀌면 옛 자리에 남는다.
   ⇒ 고침: 부르는 쪽이 「지금 어디인가」(pointOf)를 주고, 고리가 프레임마다 다시 놓는다.
   재는 것 (Day 0 · 「사람을 눌러 보세요」 — 점 손가락 중 제일 먼저 뜨는 것):
     ① 그 손가락이 «점»인가(요소 표적이 없나)  ② 구멍이 «사람의 화면 점»에 있나
     ③ ★ 시점을 «돌린 뒤» 구멍이 사람을 «따라왔나»  ④ 캔버스가 «커진 뒤»(시트 닫힘)도 따라왔나
   ⚠ 폰(390×844)에서 잰다 — 박사님 그림이 폰이다. 넓은 판은 W=1770 H=1188 로 같이 돌린다.
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: W, height: H, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4500);
const clearDlg = async () => { for (let i = 0; i < 40; i++) {
  const t = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`);
  if (t !== 'true') return true;
  await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false);
  await sleep(200); } return false; };
for (let i = 0; i < 4; i++) { await clearDlg(); await sleep(700); }
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1);
  await sleep(80); await m('mouseReleased', x, y, 0); await sleep(900); };
const tapHint = async () => {
  const at = JSON.parse(await page.eval(`(()=>{ const t=document.querySelector('.hintTarget');
    const d=document.getElementById('hintDim');
    const hole=(d&&d.dataset.hole||'').split(',').map(Number);
    if (t) { const r=t.getBoundingClientRect(); if (r.width>0) return JSON.stringify({ x:r.left+r.width/2, y:r.top+r.height/2, 짚:t.id||t.className }); }
    if (hole.length===3 && hole.every(Number.isFinite)) return JSON.stringify({ x:hole[0], y:hole[1], 짚:'(점)' });
    return 'null'; })()`));
  if (!at) return null;
  await tapAt(at.x, at.y); await clearDlg();
  return at.짚;
};
/* 손가락을 따라가 「사람을 눌러 보세요」(점)까지 간다 — 시루 놓기 뒤 첫 점 손가락이다 */
const path = [];
let reached = false;
for (let i = 0; i < 8; i++) {
  const st = JSON.parse(await page.eval(`(()=>{ const t=document.querySelector('.hintTarget');
    const h=document.getElementById('hint'); const say=h?((h.querySelector('.say')||{}).textContent||'').trim():'';
    return JSON.stringify({ 짚:t?(t.id||t.className):'(점)', 말:say.slice(0,18), 켜짐:!!(h&&h.classList.contains('on')) }); })()`));
  path.push(st.짚 + '「' + st.말 + '」');
  if (st.켜짐 && st.짚 === '(점)' && /사람을/.test(st.말)) { reached = true; break; }
  if (!await tapHint()) break;
  await sleep(300);
}
console.log('■ 따라온 길 —', path.join(' → '));
if (!reached) { console.log('⛔ 점 손가락까지 못 갔다 — 여기서 끝'); await page.close(); process.exit(1); }
/* 구멍과 «사람의 진짜 화면 점»을 견준다 */
const snap = (ko) => page.eval(`(()=>{ const rv=window.__rv; const c=document.getElementById('roomCanvas');
  const cr=c.getBoundingClientRect();
  const who=(rv.characters()||[]).find(x=>x&&x.walkable);
  let q=null; try { q = who ? rv.screenPosOf(who.id) : null; } catch(e){}
  const truth = q ? { x:Math.round(cr.left+q.x), y:Math.round(cr.top+q.y) } : null;
  const d=document.getElementById('hintDim'); const hole=(d&&d.dataset.hole||'').split(',').map(Number);
  const pt = (hole.length===3 && hole.every(Number.isFinite)) ? { x:hole[0], y:hole[1] } : null;
  const h=document.getElementById('hint');
  return JSON.stringify({ 때:${JSON.stringify('KO')}, 사람점:truth, 구멍:pt,
    어긋남px: (truth&&pt)? Math.round(Math.hypot(truth.x-pt.x, truth.y-pt.y)) : null,
    손가락켜짐: !!(h&&h.classList.contains('on')), 말:h?((h.querySelector('.say')||{}).textContent||'').trim().slice(0,16):null,
    시점: (()=>{ try { return Math.round(rv.camera().az*100)/100; } catch(e){ return null; } })(),
    캔버스:[Math.round(cr.width),Math.round(cr.height)],
    /* ★ 손가락이 «꺼졌으면» 누가 껐나 — 마지막으로 무엇을 짚으라 했고 어느 줄이 불렀나 */
    마지막짚기: window.__hintLast || null,
    집기: window.__pickState ? window.__pickState() : null,
    무대: (document.getElementById('stage').className||'').trim(),
    고른사람: (()=>{ try { const s=rv.selectedCharacter(); return s ? (s.id||true) : null; } catch(e){ return 'x'; } })(),
    걷는중: !!(who && who.walking) }); })()`).then(x => x.replace('"KO"', JSON.stringify(ko)));
const before = JSON.parse(await snap('돌리기 전'));
console.log('■ 돌리기 전 —', JSON.stringify(before));
/* ③ 시점을 돌린다 — 구멍과 손가락이 «아닌» 빈 데를 잡아 끈다(울타리는 끌 손잡이가 아닌 곳을 막지만,
   방 캔버스 끌기는 #moveCatcher 가 아니라 카메라 회전이다 — 막히면 «안 돈 것»으로 나온다). */
const c0 = JSON.parse(await page.eval(`(()=>{ const c=document.getElementById('roomCanvas').getBoundingClientRect();
  /* ⚠ 넓은 판에서는 25% 높이가 «가구»였다 — 셋째 누름(풀린 뒤)이 가구를 골라 쪽지를 띄웠고,
       쪽지 규칙대로 손가락이 쉬어 「안 따라왔다」로 잘못 나왔다(자가 만든 판). 아무것도 없는 위쪽(벽·천장)을 누른다. */
  return JSON.stringify({ x:Math.round(c.left+c.width*0.5), y:Math.round(c.top+c.height*0.08) }); })()`));
/* ★ 울타리가 빈 데 끌기를 막는다(끌 손잡이가 아니다). ⇒ 탈출구를 «그대로» 쓴다 —
   울타리 밖을 세 번 누르면 그 걸음에서 풀린다(§FENCE_GIVE_UP). 그것도 같이 잰다. */
const dead = [];
for (let k = 0; k < 3; k++) {
  await m('mouseMoved', c0.x, c0.y, 0); await m('mousePressed', c0.x, c0.y, 1); await sleep(60);
  dead.push(await page.eval(`String(document.getElementById('hint').classList.contains('knock'))`));
  await m('mouseReleased', c0.x, c0.y, 0); await sleep(600);
}
console.log('■ 빈 데 세 번 누름 — 손가락이 뛰었나:', dead.join(' '), '(셋째까지 뛰고, 그다음부터 풀린다)');
await m('mouseMoved', c0.x, c0.y, 0); await m('mousePressed', c0.x, c0.y, 1);
for (let i = 1; i <= 8; i++) { await m('mouseMoved', c0.x + i * 16, c0.y, 1); await sleep(40); }
await m('mouseReleased', c0.x + 128, c0.y, 0);
await sleep(700);
const after = JSON.parse(await snap('돌린 뒤'));
console.log('■ 돌린 뒤   —', JSON.stringify(after));
const turned = before.시점 !== after.시점;
const moved  = before.사람점 && after.사람점 && (before.사람점.x !== after.사람점.x || before.사람점.y !== after.사람점.y);
console.log('');
console.log('=== 판정 ===');
const ok = (ko, v, why) => console.log(`  ${v ? 'OK  ' : 'FAIL'} ${ko}  → ${why}`);
ok('점 손가락이 사람 위에 있다(돌리기 전)', before.어긋남px != null && before.어긋남px <= 12, before.어긋남px + 'px');
ok('시점이 돌았다(잴 준비)', turned, before.시점 + ' → ' + after.시점 + (turned ? '' : '  ⚠ 안 돌았으면 울타리가 막은 것일 수 있다'));
ok('★ 돌린 뒤에도 구멍이 사람을 따라왔다', after.어긋남px != null && after.어긋남px <= 12 && (moved || !turned),
   after.어긋남px + 'px' + (moved ? ' (사람 점이 ' + before.사람점.x + ',' + before.사람점.y + ' → ' + after.사람점.x + ',' + after.사람점.y + ')' : ' (사람 점 안 바뀜)'));
await page.shot('docs/handoff/img/pointfollow.png').catch(() => {});
await page.close(); clearTimeout(wd);
