/* ============================================================
   tools/probe_qa_full.mjs — 처음부터 끝까지 **손으로** 해 본다 (QA 전용 · 읽기만)
   ------------------------------------------------------------
   ★ 고치지 않는다. 눌러 보고 무엇이 안 먹는지 적을 뿐이다.
   ★ 폰과 PC 를 같은 각본으로 돈다 — 최근 버그가 PC 에서만 난 것이 여럿이다.
       QA_VIEW=phone  390×844 · 진짜 터치 입력(Input.dispatchTouchEvent)
       QA_VIEW=pc     1440×900 · 진짜 마우스 입력(Input.dispatchMouseEvent)
   ★ 「눌렀는데 아무 일도 안 난다」를 재는 방법 —
     누르기 전후로 상태 지문(day·돈·물준날·회전·stage class·시트 열림…)을 찍어
     **달라진 게 없으면 '먹통'** 으로 표시한다. 짐작이 아니라 잰 것이다.

   쓰는 법
     python tools/serve.py 8991
     BYEOT_URL=http://127.0.0.1:8991 QA_VIEW=phone node tools/probe_qa_full.mjs
============================================================ */
import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 1500000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'http://127.0.0.1:8991';
const VIEW = (process.env.QA_VIEW || 'phone').toLowerCase();
const PC = VIEW === 'pc';
const W = PC ? 1440 : 390, H = PC ? 900 : 844;
const OUT = 'docs/engine/shots/qa';
const TAG = process.env.QA_TAG || ('full-' + VIEW);

const page = await launch({ width: W, height: H, dpr: PC ? 1 : 2, mobile: !PC });
if (!PC) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

/* ── 예외·경고를 단계 이름과 함께 모은다 ───────────────── */
let STEP = '부팅';
const errs = [], warns = [];
page.on((m, p) => {
  if (m === 'Runtime.exceptionThrown')
    errs.push({ step: STEP, msg: ((p.exceptionDetails.text || '') + ' ' +
      ((p.exceptionDetails.exception || {}).description || '')).slice(0, 400) });
  if (m === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(p.type))
    warns.push({ step: STEP, msg: (p.type + ': ' + (p.args || [])
      .map(a => a.value ?? a.description ?? a.type).join(' ')).slice(0, 240) });
});

/* ── 손가락 / 마우스 ────────────────────────────────────
   ★CDP 는 렌더러가 이벤트를 삼킬 때까지 답을 안 준다. 안 오면 재는 도구가 통째로 멈춘다.
     그래서 하나하나에 시한을 건다. */
let STALLS = 0;
const cap = (label, pr, ms = 15000) => Promise.race([pr,
  new Promise(r => { const t = setTimeout(() => { STALLS++; console.error('  ⏱멈춤 ' + label); r('TIMEOUT'); }, ms); t.unref && t.unref(); })]);

const M = (type, x, y, extra = {}) => cap('m:' + type, page.send('Input.dispatchMouseEvent',
  { type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, ...extra }));
const touchDown = (x, y) => cap('down', page.send('Input.dispatchTouchEvent',
  { type: 'touchStart', touchPoints: [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 8, radiusY: 8, force: 1 }] }));
const touchMove = (x, y) => cap('move', page.send('Input.dispatchTouchEvent',
  { type: 'touchMove', touchPoints: [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 8, radiusY: 8, force: 1 }] }));
const touchUp = () => cap('up', page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }));

async function down(x, y) { PC ? await M('mousePressed', x, y, { buttons: 1 }) : await touchDown(x, y); }
async function move(x, y) { PC ? await M('mouseMoved', x, y, { buttons: 1 }) : await touchMove(x, y); }
async function up(x, y) { PC ? await M('mouseReleased', x, y, { buttons: 0 }) : await touchUp(); }

async function tapXY(x, y, hold = 70, after = 200) {
  await down(x, y); await sleep(hold); await up(x, y); await sleep(after);
}
async function dragXY(x0, y0, x1, y1, steps = 14, holdMs = 180) {
  await down(x0, y0); await sleep(holdMs);
  for (let i = 1; i <= steps; i++) {
    await move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
    await sleep(35);
  }
  await sleep(160); await up(x1, y1); await sleep(450);
}

const rectOf = id => cap('rect:' + id, page.eval(`(()=>{const e=document.getElementById(${JSON.stringify(id)});
  if(!e) return null; const r=e.getBoundingClientRect();
  return {x:+(r.left+r.width/2).toFixed(1), y:+(r.top+r.height/2).toFixed(1),
          w:+r.width.toFixed(1), h:+r.height.toFixed(1),
          vis:e.offsetParent!==null && r.width>0 && r.height>0, dis:!!e.disabled,
          txt:(e.textContent||'').trim().slice(0,26)};})()`)).then(v => v === 'TIMEOUT' ? null : v);

/* 그 자리에 실제로 무엇이 있나 — 「눌렀는데 딴 게 먹었다」를 잡는 창구 */
const topAt = (x, y) => page.eval(`(()=>{ const e=document.elementFromPoint(${Math.round(x)},${Math.round(y)});
  if(!e) return null; return { id:e.id||null, cls:(e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className||'').toString().slice(0,50),
    tag:e.tagName, txt:(e.textContent||'').trim().slice(0,24) }; })()`);

/* ── 상태 지문 ───────────────────────────────────────── */
const snap = () => page.eval(`(()=>{ let S={}; try{S=window.__S()||{}}catch(e){}
  const fp=S.firstPlay||{}, b=fp.beansprout||{};
  const v=id=>{const e=document.getElementById(id); return e?[e.offsetParent!==null,!!e.disabled]:null;};
  return { day:S.day, 돈:S.tutorial&&S.tutorial.cashWon, 회전:b.harvestCount,
    시루:!!(b.slotId||b.at), 물준날:b.wateredOnDay, 나이:b.ageDays, 거둠:b.harvested,
    화분:(S.pots||[]).length, 화분자리:(S.pots&&S.pots[0]&&S.pots[0].slotId)||null,
    화분물:(S.pots&&S.pots[0]&&S.pots[0].wateredOnDay),
    삽수:(S.cuttings||[]).length,
    재고:S.shop&&S.shop.stock, 주문:((S.shop&&S.shop.orders)||[]).map(o=>o.itemId+'@'+o.arrivesOnDay),
    stage:document.getElementById('stage').className,
    sheet:document.getElementById('sheet').getAttribute('aria-hidden'),
    detail:document.getElementById('detail').getAttribute('aria-hidden'),
    hardLock:document.body.dataset.hardLock||null,
    quest:(document.getElementById('quest').textContent||'').trim().slice(0,44),
    banner:(document.getElementById('event').textContent||'').trim().slice(0,70),
    btn:{next:v('next'),ff:v('ff'),water:v('waterCrop'),harv:v('harvestCrop'),
         sow:v('resow'),pot:v('waterPot')},
    marks:(()=>{try{return window.__marks.list().map(m=>m.ko)}catch(e){return ['?']}})(),
    가구판:v('furnActions'), 식물판:v('plantActions') }; })()`);

/* 지문을 견준다 — 달라진 게 없으면 「먹통」 */
const fp = s => JSON.stringify(s);
async function tap(id, hold = 70, after = 200) {
  const r = await rectOf(id);
  if (!r) return { id, ok: false, why: '없음' };
  if (!r.vis) return { id, ok: false, why: '안보임' };
  if (r.dis) return { id, ok: false, why: '비활성', txt: r.txt };
  /* ★ 진짜로 그 자리에 그 버튼이 있나 — 무엇이 덮고 있으면 눌러도 딴 게 먹는다 */
  const t = await topAt(r.x, r.y);
  await tapXY(r.x, r.y, hold, after);
  return { id, ok: true, txt: r.txt, 덮은것: (t && t.id === id) ? null : t };
}

const T = [];
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ');
  T.push(s); console.log(s); };
const FIND = [];   /* 잰 사실만 쌓는다 */
const found = (sev, 무엇, 어떻게) => { FIND.push({ sev, step: STEP, 무엇, 어떻게 }); log(`  ⚑[${sev}] ${무엇} — ${어떻게}`); };

async function clearTalk(max = 30) {
  for (let i = 0; i < max; i++) {
    const t = await page.eval(`document.getElementById('stage').classList.contains('talking')`);
    if (!t) return i;
    const r = await rectOf('dlgBox');
    if (!(r && r.vis)) break;
    await tapXY(r.x, r.y, 60, 260);
  }
  return -1;
}
async function clearGuide() {
  const r = await rectOf('guideClose');
  if (r && r.vis) { await tapXY(r.x, r.y, 70, 350); return true; }
  return false;
}
/* ══ ★★★ 2026-08-23 — **[다음 날] 뒤에 문이 둘 더 있다** ═══════════════════════
   ------------------------------------------------------------
   이 자는 `tap('next')` 뒤에 날이 안 가면 **「치명」을 내고 `break` 로 멈췄다.**
   그런데 그 「치명」은 **제품이 아니라 이 자였다** — `#next` 는 곳간이 차 있으면
   **밥상(`#mealPanel`)** 을 열고, 월세 낸 날은 그 앞에 **첫 달 가계부(`#monthPanel`)** 를
   연다. 거기서 각각 [이대로 다음 날 ▸]·[✕] 를 눌러야 비로소 날이 간다.
   ⇒ 실측(`night_play`): [다음 날] 214번 중 **밥상이 88번(41%)** · 가계부 5번.
   ⇒ [growth] 가 잡은 것: 이 자가 **일 1 에서 멈췄고**, 그 뒤 「34일을 돌려도 몬스테라가
     안 옴」까지 스스로 만들어 놓고 버그로 보고했다. **자가 자기가 만든 증상을 보고했다.**
   ⇒ ★ 그래서 `qa-to-plan.md:233` 「뒤쪽 절반을 아무도 안 봤다」에 원인이 붙는다 —
     게을러서가 아니라 **자가 첫날에 멈췄기 때문**이다.
   ⚠ 순서가 있다: **가계부가 먼저, 밥상이 나중**이다(둘이 같이 뜨는 날이 있다).
   ⚠ 안 뜨면 아무것도 안 한다 — 없는 단추를 누르지 않는다. */
async function clearDayGates() {
  let did = 0;
  for (let i = 0; i < 4; i++) {
    const g1 = await rectOf('monthGo');                     /* 첫 달 가계부 */
    if (g1 && g1.vis) { await tapXY(g1.x, g1.y, 70, 350); did++; continue; }
    const gx = await rectOf('monthClose');                  /* ✕ 로도 닫힌다 */
    if (gx && gx.vis) { await tapXY(gx.x, gx.y, 70, 350); did++; continue; }
    const g2 = await rectOf('mealGo');                      /* 오늘 밥상 */
    if (g2 && g2.vis) { await tapXY(g2.x, g2.y, 70, 350); did++; continue; }
    break;
  }
  return did;
}
async function calm() { await clearTalk(); await clearGuide(); await clearDayGates(); }

/* ★ 시트 — **폰은 아래에서 올라오는 서랍**이고, **PC 는 오른쪽에 늘 붙은 판**이다
     (game.html @media: PC 에서는 #openBag 이 없고 #sheetScrim 이 display:none).
   그래서 여는 길이 다르다. 어느 쪽이든 **눌러서** 연다. */
const sheetOpen = () => page.eval(`document.getElementById('sheet').getAttribute('aria-hidden')==='false'`);
async function openSheet(tabId) {
  const ob = await rectOf('openBag');
  if (ob && ob.vis && !ob.dis && !(await sheetOpen())) await tapXY(ob.x, ob.y, 70, 400);
  /* ★열리는 동안은 재지 않는다 — 스크림이 위에 있으면 자리도 크기도 아직 거짓이다 */
  for (let i = 0; i < 20 && !(await sheetOpen()); i++) await sleep(200);
  await sleep(450);
  if (tabId) {
    const t = await rectOf(tabId);
    if (t && t.vis) await tapXY(t.x, t.y, 70, 650);
    else return { 길: '탭을 못 찾음', tab: t };
  }
  await sleep(350);
  return { 길: (ob && ob.vis) ? '가방버튼' : 'PC고정판', tab: tabId, 열림: await sheetOpen() };
}
/* ★ 닫는 것도 눌러서 — 폰은 스크림을 누른다(game.html: scrim click → closeSheet).
   PC 는 닫는 것이 아니라 늘 붙어 있는 판이라 그대로 둔다. */
async function closeSheet() {
  const ob = await rectOf('openBag');
  if (!(ob && ob.vis)) return 'PC고정판';
  for (let i = 0; i < 5; i++) {
    if (!(await sheetOpen())) return '닫힘';
    const sc = await page.eval(`(()=>{const s=document.getElementById('sheetScrim');
      const sh=document.getElementById('sheet').getBoundingClientRect();
      if(!s||getComputedStyle(s).display==='none') return null;
      return {x:Math.round(innerWidth/2), y:Math.max(8,Math.round(sh.top/2))};})()`);
    if (sc) await tapXY(sc.x, sc.y, 60, 600); else break;
  }
  const still = await sheetOpen();
  if (still) found('심각', '시트(가방)가 스크림을 눌러도 안 닫힘', `${VIEW}: [가방] → 시트 위쪽 어두운 곳 탭`);
  return still ? '안닫힘' : '닫힘';
}
/* ★★ 2026-08-10 — 시루 손잡이는 **[가방]의 격자 칸**이다(큰 카드는 없앴다).
   ⚠ id 는 그대로 `cropThumb` 이라 아래 길은 안 바뀐다. 탭을 훑는 것도 그대로 둔다 —
     칸이 어느 탭에 사는지를 이 도구가 알아야 할 이유가 없다. */
async function findCropThumb() {
  for (const tab of ['tabBag', 'tabPlants']) {
    await openSheet(tab);
    const th = await rectOf('cropThumb');
    if (th && th.vis && th.w > 0) return { th, tab };
  }
  return { th: null, tab: null };
}
/* 고른 것을 푼다 — 앞 시험이 남긴 선택이 다음 시험을 가리면 안 된다 */
async function unpick() {
  for (const id of ['furnClose', 'pickClose']) {
    const r = await rectOf(id);
    if (r && r.vis) await tapXY(r.x, r.y, 60, 350);
  }
}

/* ★ 말풍선이 진짜 손잡이다 — 아래 버튼은 **말풍선이 있으면 일부러 안 뜬다**
   (game.html §refreshOverlays: "같은 일을 두 번 말하지 않는다").
   그래서 「거두기」·「물 주기」는 말풍선을 눌러야 한다. */
const markList = () => page.eval(`(()=>{ const box=document.getElementById('marks');
  if(!box) return []; return [...box.children].map(el=>{const r=el.getBoundingClientRect();
    return {key:el.dataset.key, txt:(el.textContent||'').trim().slice(0,26),
            x:+(r.left+r.width/2).toFixed(1), y:+(r.top+r.height/2).toFixed(1),
            vis:el.style.display!=='none'&&r.width>0};}); })()`);
async function tapMark(re, waitMs = 5200) {
  const ms = await markList();
  const m = ms.find(x => x.vis && re.test(x.txt));
  if (!m) return { ok: false, why: '그런 말풍선 없음', 있는것: ms.map(x => x.txt) };
  await tapXY(m.x, m.y, 80, 300);
  await sleep(waitMs);
  await calm();
  return { ok: true, txt: m.txt };
}
/* 아래 버튼이 있으면 버튼으로, 없으면 말풍선으로 — 사람이 하는 그대로 */
async function doAction(btnId, re, waitMs = 5200) {
  const r = await rectOf(btnId);
  if (r && r.vis && !r.dis) { const t = await tap(btnId); await sleep(waitMs); await calm(); return { 길: '버튼', ...t }; }
  const mk = await tapMark(re, waitMs);
  return { 길: '말풍선', ...mk };
}
/* ★ 되묻는 버튼(confirmOnce) — 상점 [주문]은 **두 번** 눌러야 나간다 (game.html §confirmOnce) */
async function tapTwice(x, y) {
  await tapXY(x, y, 70, 500);
  const asked = await topAt(x, y);
  await tapXY(x, y, 70, 1200);
  return asked;
}

/* 방 캔버스 좌표 */
const canvasRect = () => page.eval(`(()=>{const c=document.getElementById('roomCanvas').getBoundingClientRect();
  return {l:c.left,t:c.top,w:c.width,h:c.height};})()`);
const slotXY = async id => {
  const v = await page.eval(`(()=>{ try{ const c=document.getElementById('roomCanvas').getBoundingClientRect();
    const p=window.__rv.screenPosOf(${JSON.stringify(id)});
    return p?{x:c.left+p.x,y:c.top+p.y}:null; }catch(e){ return null } })()`);
  return v;
};

/* ══════════════════════════════════════════════════════════
   ① 처음부터 시작
══════════════════════════════════════════════════════════ */
log(`━━━ ${TAG} (${W}×${H}, ${PC ? '마우스' : '터치'}) BASE=${BASE} ━━━`);
await page.goto(`${BASE}/game.html`); await sleep(1800);
await page.eval(`(()=>{try{localStorage.clear()}catch(e){}})()`, false);
const t0 = Date.now();
await page.goto(`${BASE}/game.html`);
try { await page.waitFor(`!!window.__rv`, 300000, 500); }
catch (e) { log('✗ 방이 영영 안 떴습니다 — ' + e.message); found('치명', '방(__rv)이 안 뜬다', '새로 켜기'); }
log('부팅 __rv ms=' + (Date.now() - t0));
await sleep(3500);

STEP = '① 오프닝';
log('첫 대사 넘김 횟수=' + await clearTalk());
log('안내 닫기=' + await clearGuide());
let s = await snap();
log('시작 ' + fp(s));
await page.shot(`${OUT}/${TAG}_01_start.png`);

/* ★ 소지금·배너가 다른 것을 덮고 있나 — 눈이 아니라 자리로 잰다 */
{
  const overlap = await page.eval(`(()=>{ const out=[];
    const R=id=>{const e=document.getElementById(id); if(!e||e.offsetParent===null) return null;
      const r=e.getBoundingClientRect(); return r.width>0&&r.height>0?r:null;};
    const hit=(a,b)=>a&&b&&!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top);
    /* 소지금 숫자가 무엇에 가려졌나 */
    const food=document.getElementById('resFood');
    if(food){ const r=food.getBoundingClientRect();
      const top=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
      out.push({무엇:'소지금(resFood)', 자리:[+r.left.toFixed(0),+r.top.toFixed(0),+r.width.toFixed(0),+r.height.toFixed(0)],
        맨위:top?(top.id||top.className||top.tagName):null, 값:(food.textContent||'').trim()}); }
    /* 배너가 아래 버튼 띠를 덮나 */
    const ev=R('event'), bt=R('bottom'), nx=R('next');
    out.push({무엇:'배너 vs 아래띠', 덮나:hit(ev,bt), 덮나_다음날:hit(ev,nx),
      배너높이:ev?+ev.height.toFixed(0):null, 배너글:(document.getElementById('event').textContent||'').trim().slice(0,50)});
    return out; })()`);
  log('겹침 검사 ' + fp(overlap));
  for (const o of overlap) {
    if (o.무엇 === '소지금(resFood)' && o.맨위 && !/resFood/.test(String(o.맨위)))
      found('보통', '소지금 숫자가 ' + o.맨위 + ' 에 가려짐', '첫 화면에서 그대로');
    if (o.덮나_다음날) found('심각', '경고 배너가 [다음 날] 버튼을 덮음', '첫 화면에서 그대로');
  }
}

/* ── 빈 자리를 눌러 본다 — 시루 상세가 뜨면 안 된다 ── */
STEP = '① 빈 자리 탭';
{
  /* ★ 빈 자리만 고른다 — 무언가 놓인 자리는 상세가 떠도 맞다 */
  const ids = await page.eval(`(()=>{ try{ return (window.__rv.slots?window.__rv.slots():[])
    .filter(s=>!s.occupied).map(s=>s.slotId).slice(0,60) }catch(e){ return [] } })()`);
  log('자리 목록 ' + ids.length + '개 ' + fp(ids.slice(0, 14)));
  let tested = 0;
  for (const id of ids) {
    if (tested >= 6) break;
    const p = await slotXY(id);
    if (!p) continue;
    const b = await snap();
    await tapXY(p.x, p.y, 70, 700);
    const a = await snap();
    tested++;
    const opened = b.detail !== a.detail && a.detail === 'false';
    const zoom = /zoom/.test(a.stage) && !/zoom/.test(b.stage);
    log(`  빈자리 '${id}' 탭 → detail=${a.detail} stage=${a.stage.slice(0, 40)}`);
    if (opened) found('심각', `빈 자리 '${id}' 를 눌렀는데 상세 카드가 뜸`, `방 자리 '${id}' 탭`);
    if (zoom) found('심각', `빈 자리 '${id}' 를 눌렀는데 확대가 열림`, `방 자리 '${id}' 탭`);
    if (a.detail === 'false') { await tap('dClose'); await sleep(400); }
    if (/zoom/.test(a.stage)) { await tap('closeZoom'); await sleep(500); }
    await unpick();
    await calm();
  }
}

/* ── 시루 놓기 ── */
STEP = '① 시루 놓기';
await calm();
{
  await unpick();
  const got = await findCropThumb();
  log('시루 카드가 있는 탭 = ' + got.tab + ' sheet=' + (await snap()).sheet);
  let th = got.th;
  /* ★ 안 보이면 **왜** 안 보이는지 잰다 — 짐작하지 않는다 */
  if (!(th && th.vis && th.w > 0)) {
    /* ⚠ `cropCard` 는 없어졌다(2026-08-10). 칸(`.bagslot`)을 대신 잰다 — 없어도 안 터지게 */
    const why = await page.eval(`(()=>{ const e=document.getElementById('cropThumb'); if(!e) return {없음:true};
      const card=e.closest('.bagslot'); const cs=card?getComputedStyle(card):null;
      const r=e.getBoundingClientRect(), cr=card?card.getBoundingClientRect():{left:0,top:0,width:0,height:0};
      const page=document.getElementById('pageBag'); const pr=page.getBoundingClientRect();
      const top=document.elementFromPoint(Math.max(1,r.left+r.width/2), Math.max(1,r.top+r.height/2));
      return { 썸네일:[+r.left.toFixed(0),+r.top.toFixed(0),+r.width.toFixed(0),+r.height.toFixed(0)],
        카드:[+cr.left.toFixed(0),+cr.top.toFixed(0),+cr.width.toFixed(0),+cr.height.toFixed(0)],
        칸display:cs?cs.display:null, 칸visibility:cs?cs.visibility:null, 칸높이:cs?cs.height:null,
        판:[+pr.left.toFixed(0),+pr.top.toFixed(0),+pr.width.toFixed(0),+pr.height.toFixed(0)],
        판보임:page.offsetParent!==null, 판클래스:page.className,
        맨위:top?(top.id||top.className||top.tagName):null,
        스크롤:[page.scrollTop,page.scrollHeight,page.clientHeight] }; })()`);
    log('  시루 썸네일이 안 보인다 — 왜 ' + fp(why));
    /* 스크롤해서 나오나 */
    await page.eval(`(()=>{const e=document.getElementById('cropThumb');
      const c=e&&e.closest('.bagslot'); c&&c.scrollIntoView({block:'center'});})()`, false);
    await sleep(500);
    th = await rectOf('cropThumb');
    log('  스크롤 뒤 ' + fp(th));
    if (!(th && th.vis && th.w > 0))
      found('심각', '시트 어느 탭에서도 콩나물 시루 칸이 화면에 안 나옴', `${VIEW}: [가방]·[식물] 탭 둘 다 → cropThumb (${fp(why)})`);
  }
  log('시루 썸네일 ' + fp(th));
  await page.shot(`${OUT}/${TAG}_02_bag.png`);
  if (th && th.vis && th.w > 0) {
    const cr = await canvasRect();
    const tx = cr.l + cr.w * 0.5, ty = cr.t + cr.h * 0.62;
    await down(th.x, th.y); await sleep(250);
    const on1 = await page.eval(`(()=>{try{return !!window.__drag.on}catch(e){return 'ERR'}})()`);
    for (let i = 1; i <= 16; i++) { await move(th.x + (tx - th.x) * i / 16, th.y + (ty - th.y) * i / 16); await sleep(45); }
    const mid = await page.eval(`(()=>{try{return JSON.stringify({on:window.__drag.on,best:!!window.__drag.best,
      lb:(document.getElementById('dropLabel').textContent||'').slice(0,40)})}catch(e){return 'ERR'}})()`);
    await up(tx, ty); await sleep(2600);
    log(`  끌기: 누른직후on=${on1} 끄는중=${mid}`);
  }
  await calm();
  s = await snap();
  log('놓은 뒤 ' + fp(s));
  if (!s.시루) {
    /* 끌어서 안 되면 [두기] 버튼 길로 한 번 더 — 어느 길이 막혔는지 갈라 본다 */
    found('심각', '끌어다 놓기로 시루가 안 놓임', `${VIEW}: [${got.tab}] 탭 → 시루 썸네일을 방으로 끌기`);
    /* ★★ 2026-08-10 — [두기] 드롭다운 길은 **없어졌다**(길을 하나로 줄였다).
       남은 둘째 길은 **칸을 누르는 것**이다 — 끌기와 같은 손잡이의 다른 손짓이라,
       어느 쪽이 막혔는지는 여전히 갈라 볼 수 있다(§startPhonePlace). */
    await findCropThumb();
    const sel = await page.eval(`(()=>{const s=document.getElementById('cropSlot');
      if(!s) return null;
      return {숨은자료칸:true, 값:s.value, 칸수:s.options.length};})()`);
    const pc2 = await page.eval(`(()=>{const b=document.querySelector('.bagslot[data-place="beansprout"]');
      if(!b) return false; b.click(); return true;})()`);
    await sleep(2400); await calm();
    s = await snap();
    log('  [칸 누르기] 길 자리고르개=' + fp(sel) + ' 눌림=' + fp(pc2) + ' → 시루=' + s.시루);
    if (!s.시루) found('치명', '칸을 눌러도 시루가 안 놓임', `${VIEW}: 가방 격자의 시루 칸 → 누르기 (눌림=${fp(pc2)})`);
  }
  await closeSheet();
  await page.shot(`${OUT}/${TAG}_03_placed.png`);
}

/* ── 말풍선을 눌러 본다 — 「눌러도 안 먹는다」 ── */
STEP = '① 말풍선 탭';
{
  await calm();
  for (let round = 0; round < 3; round++) {
    const mk = await page.eval(`(()=>{ const box=document.getElementById('marks');
      return [...box.children].map(el=>{const r=el.getBoundingClientRect();
        return {key:el.dataset.key, txt:(el.textContent||'').trim().slice(0,24),
                x:+(r.left+r.width/2).toFixed(1), y:+(r.top+r.height/2).toFixed(1),
                w:+r.width.toFixed(1), h:+r.height.toFixed(1), vis:el.style.display!=='none'};}); })()`);
    if (!mk.length) { log('말풍선 없음(라운드 ' + round + ')'); break; }
    const m = mk.find(x => x.vis);
    if (!m) break;
    /* 누르고 떼는 사이에 표적이 얼마나 움직이나 — 「도망가는 버튼」을 잰다 */
    await down(m.x, m.y); await sleep(140);
    const m2 = await page.eval(`(()=>{ const el=document.querySelector('#marks .mark'); if(!el) return null;
      const r=el.getBoundingClientRect(); return {x:+(r.left+r.width/2).toFixed(1), y:+(r.top+r.height/2).toFixed(1)}; })()`);
    await up(m.x, m.y); await sleep(2600);
    const drift = m2 ? +Math.hypot(m2.x - m.x, m2.y - m.y).toFixed(1) : null;
    await calm();
    const a = await snap();
    log(`말풍선 '${m.txt}' 탭 → 흔들림=${drift}px 결과 ${fp({ 물준날: a.물준날, 회전: a.회전, day: a.day, stage: a.stage.slice(0, 30) })}`);
    if (drift != null && drift > 6) found('보통', `말풍선이 누르는 동안 ${drift}px 움직임`, '말풍선을 누른 채 0.14초 뒤 다시 잼');
    await sleep(600);
  }
}

/* ══════════════════════════════════════════════════════════
   ② 회전: 물 주기 → 며칠 → 수확 → 다시 심기 → 몬스테라
══════════════════════════════════════════════════════════ */
STEP = '② 회전';
let arrivalDay = null;
const dead = [];              /* 눌렀는데 아무 일도 안 난 것 */
for (let d = 0; d < 34; d++) {
  await calm();
  const b0 = await snap();

  const ms0 = (await markList()).filter(m => m.vis).map(m => m.txt);

  /* 물 주기 — 아래 버튼이 없으면 말풍선으로 */
  if (ms0.some(t => /물 주기/.test(t)) || (await rectOf('waterCrop'))?.vis) {
    const r = await doAction('waterCrop', /물 주기/);
    const a = await snap();
    log(`  물주기(${r.길}) ${fp(r)} 물준날 ${b0.물준날}→${a.물준날}`);
    if (r.ok && a.물준날 === b0.물준날 && a.day === b0.day) {
      dead.push({ 무엇: '물주기', 길: r.길, day: b0.day });
      found('심각', `[물 주기](${r.길})를 눌렀는데 물준날이 그대로`, `일 ${b0.day} · ${r.길} 탭`);
    }
  }
  await calm();

  /* 거두기 */
  const ms1 = (await markList()).filter(m => m.vis).map(m => m.txt);
  if (ms1.some(t => /거두기|수확/.test(t)) || (await rectOf('harvestCrop'))?.vis) {
    const b = await snap();
    const r = await doAction('harvestCrop', /거두기|수확/, 6000);
    const a = await snap();
    log(`  거두기(${r.길}) ${fp(r)} 회전 ${b.회전}→${a.회전} 돈 ${b.돈}→${a.돈}`);
    if (r.ok && a.회전 === b.회전) {
      dead.push({ 무엇: '거두기', 길: r.길, day: b.day });
      found('치명', `[거두기](${r.길})를 눌렀는데 회전수가 그대로`, `일 ${b.day} · 말풍선 '${r.txt || ''}' 탭`);
    }
  }
  await calm();

  /* 다시 심기 */
  const sr = await rectOf('resow');
  const ms2 = (await markList()).filter(m => m.vis).map(m => m.txt);
  if ((sr && sr.vis && !sr.dis) || ms2.some(t => /심기/.test(t))) {
    const b = await snap();
    const r = await doAction('resow', /심기/, 5000);
    const a = await snap();
    log(`  다시심기(${r.길}) ${fp(r)} 나이 ${b.나이}→${a.나이} 재고 ${fp(b.재고)}→${fp(a.재고)}`);
    if (r.ok && fp(b) === fp(a)) {
      dead.push({ 무엇: '다시심기', 길: r.길, day: b.day });
      found('심각', `[다시 심기](${r.길})를 눌렀는데 아무것도 안 바뀜`, `일 ${b.day}`);
    }
  } else if (sr && sr.vis && sr.dis) {
    /* 씨앗이 없다 — 상점에서 산다 (③ 을 여기서 겸한다) */
    STEP = '③ 상점';
    await openSheet('tabShop');
    const info = await page.eval(`(()=>{const b=document.querySelector('[data-buy="bean_seed"]');
      if(!b) return {why:'버튼없음', 있는것:[...document.querySelectorAll('[data-buy]')].map(x=>x.dataset.buy)};
      b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect();
      return {x:+(r.left+r.width/2).toFixed(1),y:+(r.top+r.height/2).toFixed(1),
        vis:b.offsetParent!==null&&r.height>0, dis:!!b.disabled,
        txt:(b.textContent||'').trim().slice(0,40)};})()`);
    log('  상점 [콩 씨앗] ' + fp(info));
    if (info && info.vis && !info.dis) {
      const b = await snap();
      const asked = await tapTwice(info.x, info.y);       /* ★두 번 — 되묻는 버튼이다 */
      const a = await snap();
      log('  주문(두 번 눌러) 되묻기=' + fp(asked) + ' → ' + fp({ 돈: a.돈, 재고: a.재고, 주문: a.주문, 배너: a.banner }));
      if (fp(b.주문) === fp(a.주문) && fp(b.재고) === fp(a.재고) && b.돈 === a.돈)
        found('심각', '상점 [콩 씨앗]을 두 번 눌러도 주문·재고·돈이 그대로', `${VIEW}: 상점 탭 → [주문] → [정말 주문?] (되묻기=${fp(asked)})`);
    }
    await closeSheet();
    STEP = '② 회전';
    const sr2 = await rectOf('resow');
    if (sr2 && sr2.vis && !sr2.dis) { await tap('resow'); await sleep(4600); await calm(); }
  }
  await calm();

  /* 몬스테라가 왔나 */
  s = await snap();
  if (s.화분 > 0 && arrivalDay == null) { arrivalDay = s.day; log('★몬스테라 도착 일=' + s.day); break; }

  /* 다음 날 */
  const nb = await snap();
  const nr = await tap('next'); await sleep(2200); await calm();
  const na = await snap();
  log(`[일 ${na.day}] 물=${na.물준날} 나이=${na.나이} 회전=${na.회전} 돈=${na.돈} 재고=${fp(na.재고)} 말풍선=${fp(na.marks)}`);
  if (nr.ok && na.day === nb.day) {
    dead.push({ btn: 'next', day: nb.day });
    found('치명', '[다음 날]을 눌렀는데 날이 안 넘어감', `일 ${nb.day} · 버튼 탭 (덮은것=${fp(nr.덮은것)})`);
    break;
  }
  if (!nr.ok) { log('  [다음 날] 못 누름 ' + fp(nr)); if (nr.why === '비활성') { await sleep(1500); continue; } break; }
}
await page.shot(`${OUT}/${TAG}_04_cycle.png`);

/* ══════════════════════════════════════════════════════════
   ② 몬스테라 — 고르기 · 옮기기 · 물 주기
══════════════════════════════════════════════════════════ */
STEP = '② 몬스테라';
if (arrivalDay != null) {
  await calm();
  s = await snap();
  const p = await slotXY(s.화분자리);
  log('몬스테라 자리 ' + s.화분자리 + ' 화면 ' + fp(p));
  if (p) {
    const b = await snap();
    await tapXY(p.x, p.y, 80, 900);
    const a1 = await snap();
    log('  화분 탭 → 식물판 ' + fp(a1.식물판) + ' 이름=' + await page.eval(`(document.getElementById('pickedName')||{}).textContent`));
    if (!(a1.식물판 && a1.식물판[0])) found('심각', '몬스테라를 눌렀는데 [옮기기/돌리기] 판이 안 뜸', `방에서 화분(${s.화분자리}) 탭`);
    /* ★유령 마우스 — 골랐는데 곧바로 풀리나 */
    await sleep(1400);
    const a2 = await snap();
    if (a1.식물판 && a1.식물판[0] && !(a2.식물판 && a2.식물판[0]))
      found('심각', '화분을 골랐는데 1.4초 뒤 저절로 풀림', '화분 탭 후 가만히 둠');

    if (a2.식물판 && a2.식물판[0]) {
      const mv = await tap('pickMove'); await sleep(700);
      log('  [옮기기] ' + fp(mv) + ' stage=' + (await snap()).stage.slice(0, 50));
      const cr = await canvasRect();
      await dragXY(p.x, p.y, cr.l + cr.w * 0.72, cr.t + cr.h * 0.42, 14, 220);
      await sleep(2200); await calm();
      const a3 = await snap();
      log('  옮긴 뒤 자리 ' + b.화분자리 + '→' + a3.화분자리 + ' stage=' + a3.stage.slice(0, 50));
      if (a3.화분자리 === b.화분자리) found('보통', '몬스테라 [옮기기] 뒤 끌어도 자리가 안 바뀜', '화분 탭 → [옮기기] → 창가 쪽으로 끌기');
      if (/moving|placing/.test(a3.stage)) {
        found('심각', '옮기기 모드가 안 풀림(stage 에 moving/placing 남음)', '화분 [옮기기] → 끌어 놓기');
        await page.eval(`(()=>{try{window.__picked&&window.__picked.clear&&window.__picked.clear()}catch(e){}})()`, false);
      }
      await page.shot(`${OUT}/${TAG}_05_moved.png`);
    }
    /* 돌리기 */
    await tapXY(p.x, p.y, 80, 800);
    const tr = await tap('pickTurn'); await sleep(900);
    log('  [돌리기] ' + fp(tr) + ' stage=' + (await snap()).stage.slice(0, 50));
    await tap('pickClose'); await sleep(500);
    await calm();
  }
  /* 몬스테라 물 주기 — 마를 때까지 며칠 넘긴다 */
  for (let d = 0; d < 10; d++) {
    await calm();
    const st = await snap();
    if (st.btn.pot && st.btn.pot[0] && !st.btn.pot[1]) {
      const b = await snap();
      await tap('waterPot'); await sleep(5200); await calm();
      const a = await snap();
      log(`  몬스테라 물주기 ${b.화분물}→${a.화분물}`);
      if (a.화분물 === b.화분물) found('심각', '[몬스테라에 물 주기]를 눌렀는데 물준날이 그대로', `일 ${b.day} · 버튼 탭`);
      break;
    }
    const nb = await snap(); await tap('next'); await sleep(2200); await calm();
    const na = await snap();
    if (na.day === nb.day) { found('치명', '[다음 날]이 안 먹음(몬스테라 구간)', `일 ${nb.day}`); break; }
    log(`  [일 ${na.day}] 몬물버튼=${fp(na.btn.pot)} 말풍선=${fp(na.marks)}`);
  }
} else {
  log('몬스테라가 34일 안에 안 왔습니다 — 이 구간 못 쟀습니다');
  found('보통', '34일을 돌려도 몬스테라가 안 옴(못 쟀다)', '① 각본을 34일까지 돌림');
}

/* ══════════════════════════════════════════════════════════
   ③ 상점에서 사고 ④ 가방에서 꺼내기
══════════════════════════════════════════════════════════ */
STEP = '③ 상점·가방';
{
  await calm();
  await openSheet('tabShop');
  const list = await page.eval(`(()=>[...document.querySelectorAll('[data-buy]')].map(b=>{const r=b.getBoundingClientRect();
    return {id:b.dataset.buy, dis:!!b.disabled, vis:b.offsetParent!==null&&r.height>0,
            x:+(r.left+r.width/2).toFixed(1), y:+(r.top+r.height/2).toFixed(1),
            txt:(b.textContent||'').trim().slice(0,34)};}))()`);
  log('상점 목록 ' + fp(list));
  await page.shot(`${OUT}/${TAG}_06_shop.png`);
  const buyable = list.filter(x => x.vis && !x.dis);
  if (!buyable.length) log('  살 수 있는 것이 없습니다(돈·잠금)');
  for (const it of buyable.slice(0, 2)) {
    const b = await snap();
    await page.eval(`(()=>{const b=document.querySelector('[data-buy=${JSON.stringify(it.id)}]'); b&&b.scrollIntoView({block:'center'});})()`, false);
    await sleep(400);
    const r2 = await page.eval(`(()=>{const b=document.querySelector('[data-buy=${JSON.stringify(it.id)}]');
      if(!b) return null; const r=b.getBoundingClientRect();
      return {x:+(r.left+r.width/2).toFixed(1),y:+(r.top+r.height/2).toFixed(1),dis:!!b.disabled};})()`);
    if (!r2 || r2.dis) continue;
    const asked = await tapTwice(r2.x, r2.y);            /* ★두 번 — 되묻는 버튼이다 */
    const a = await snap();
    log(`  샀다 '${it.id}' 되묻기=${fp(asked)} 돈 ${b.돈}→${a.돈} 재고 ${fp(a.재고)} 주문 ${fp(a.주문)} 배너=${a.banner}`);
    if (b.돈 === a.돈 && fp(b.주문) === fp(a.주문) && fp(b.재고) === fp(a.재고))
      found('심각', `상점 '${it.id}' 를 두 번 눌러도 아무것도 안 바뀜`, `${VIEW}: 상점 탭 → '${it.id}' [주문] 두 번 (되묻기=${fp(asked)})`);
  }
  /* 가방에서 꺼내기 */
  await openSheet('tabBag');
  const bag = await page.eval(`(()=>{ const g=document.getElementById('bagGrid');
    const cards=[...g.querySelectorAll('button,[data-item],.itemcard')].map(e=>{const r=e.getBoundingClientRect();
      return {id:e.id||e.dataset.item||null, txt:(e.textContent||'').trim().slice(0,30),
              x:+(r.left+r.width/2).toFixed(1), y:+(r.top+r.height/2).toFixed(1),
              vis:e.offsetParent!==null&&r.height>0};});
    return {빈안내:document.getElementById('bagEmpty').offsetParent!==null,
            개수:(document.getElementById('bagCount').textContent||'').trim(), 칸:cards.slice(0,10)}; })()`);
  log('가방 ' + fp(bag));
  await page.shot(`${OUT}/${TAG}_07_bag2.png`);
  const item = (bag.칸 || []).find(c => c.vis);
  if (item) {
    const b = await snap();
    await tapXY(item.x, item.y, 70, 900);
    const a = await snap();
    log(`  가방칸 '${item.txt}' 탭 → detail=${a.detail} sheet=${a.sheet}`);
    if (fp(b) === fp(a)) found('보통', `가방 물건 '${item.txt}' 을 눌렀는데 아무 일도 안 남`, '가방 탭 → 물건 칸 탭');
    if (a.detail === 'false') { await tap('dClose'); await sleep(400); }
  } else if (!bag.빈안내) {
    found('보통', '가방이 비지 않았는데 누를 칸을 못 찾음(못 쟀다)', '가방 탭');
  } else log('  가방이 비어 있어 「꺼내기」를 못 쟀습니다');
  await closeSheet();
}

/* ══════════════════════════════════════════════════════════
   ④ 가구 옮기기·돌리기 · 등 옮기기
══════════════════════════════════════════════════════════ */
STEP = '④ 가구·등';
{
  await calm();
  const furn = await page.eval(`(()=>{ try{ const c=document.getElementById('roomCanvas').getBoundingClientRect();
    const list=(window.__rv.furniture?window.__rv.furniture():[]).slice(0,40);
    return list.map(f=>({uid:f.uid, name:f.name||f.preset, movable:f.movable, x:f.x, z:f.z})); }
    catch(e){ return {err:String(e)} } })()`);
  log('가구 ' + fp(Array.isArray(furn) ? furn.slice(0, 12) : furn));
  /* 화면에서 가구를 집는다 — pickFurnitureAt 이 쓰는 좌표로 */
  const target = await page.eval(`(()=>{ try{ const rv=window.__rv;
    const c=document.getElementById('roomCanvas').getBoundingClientRect();
    const list=(rv.furniture?rv.furniture():[]).filter(f=>f.movable!==false);
    for(const f of list){ let p=null; try{ p=rv.screenPosOf(f.uid) }catch(e){}
      if(p) return {uid:f.uid,name:f.name||f.preset,x:c.left+p.x,y:c.top+p.y}; }
    return null; } catch(e){ return {err:String(e)} } })()`);
  log('집을 가구 ' + fp(target));
  if (target && target.x != null) {
    const b = await snap();
    await tapXY(target.x, target.y, 80, 1000);
    const a1 = await snap();
    log(`  가구 탭 → 가구판 ${fp(a1.가구판)} 이름=${await page.eval(`(document.getElementById('furnName')||{}).textContent`)}`);
    if (!(a1.가구판 && a1.가구판[0])) {
      found('보통', `가구(${target.name})를 눌렀는데 [옮기기/돌리기] 판이 안 뜸`, '방에서 가구 탭');
    } else {
      /* ★ 가구판이 아래 버튼 띠를 덮나 (PC 에서 실제로 났던 것) */
      const cover = await page.eval(`(()=>{ const f=document.getElementById('furnActions').getBoundingClientRect();
        const out={};
        for(const id of ['next','ff','openBag']){ const e=document.getElementById(id); if(!e||e.offsetParent===null){out[id]=null;continue;}
          const r=e.getBoundingClientRect();
          out[id]={덮나:!(f.right<=r.left||r.right<=f.left||f.bottom<=r.top||r.bottom<=f.top),
                   맨위:(()=>{const t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return t?(t.id||t.tagName):null})()};}
        return out; })()`);
      log('  가구판 겹침 ' + fp(cover));
      for (const [k, v] of Object.entries(cover))
        if (v && v.덮나 && v.맨위 !== k) found('심각', `가구 버튼 띠가 [${k}] 를 덮어 못 누름`, '가구 탭 → 아래 버튼 확인');

      /* ★ 자리 표시 네모가 가구보다 큰가 — **재서** 견준다.
         네모 한 변 = half*2 (m). 가구 상판 = size.w × size.d (m).
         자리 id 'banjiha-dresser:0' 의 앞부분이 가구 uid 다. */
      const rings = await page.eval(`(()=>{ try{
        const rs=window.__rv.slotRings?window.__rv.slotRings():[];
        const fs=window.__rv.furniture()||[];
        return rs.map(r=>{ const uid=String(r.slotId).split(':')[0];
          const f=fs.find(f=>f.uid===uid);
          const side=(r.half||0)*2;
          return { slotId:r.slotId, 네모변:+side.toFixed(3),
                   가구:f?f.uid:null, 가구폭:f?+f.size.w.toFixed(3):null, 가구깊이:f?+f.size.d.toFixed(3):null,
                   넘치나:!!(f && (side > f.size.w + 1e-6 || side > f.size.d + 1e-6)) }; });
      }catch(e){ return {err:String(e)} } })()`);
      log('  자리표시 ' + fp(rings));
      const over = Array.isArray(rings) ? rings.filter(r => r.넘치나) : [];
      if (over.length) found('보통', `자리 표시 네모가 가구보다 큼 ${over.length}개`,
        `${VIEW}: rv.slotRings() vs rv.furniture().size — ${fp(over.slice(0, 4))}`);

      const mv = await tap('furnMove'); await sleep(800);
      log('  [옮기기] ' + fp(mv) + ' stage=' + (await snap()).stage.slice(0, 50));
      const cr = await canvasRect();
      await dragXY(target.x, target.y, target.x + cr.w * 0.10, target.y + cr.h * 0.06, 14, 220);
      await sleep(2000); await calm();
      const a2 = await page.eval(`(()=>{ try{ const f=(window.__rv.furniture()||[]).find(f=>f.uid===${JSON.stringify(target.uid)});
        return f?{x:+f.x.toFixed(3),z:+f.z.toFixed(3),rot:f.rot}:null }catch(e){ return {err:String(e)} } })()`);
      log('  옮긴 뒤 ' + fp(a2) + ' stage=' + (await snap()).stage.slice(0, 50));
      const st2 = await snap();
      if (/furnmoving|moving|placing/.test(st2.stage))
        found('심각', '가구 옮기기 모드가 안 풀림', '가구 탭 → [옮기기] → 끌어 놓기');
      await page.shot(`${OUT}/${TAG}_08_furn.png`);

      /* 돌리기 — ★옮긴 뒤라 화면 자리가 바뀌었다. **다시 재서** 집는다 */
      await unpick();
      const now = await page.eval(`(()=>{ try{ const c=document.getElementById('roomCanvas').getBoundingClientRect();
        const p=window.__rv.screenPosOf(${JSON.stringify(target.uid)});
        return p?{x:c.left+p.x,y:c.top+p.y}:null }catch(e){return null} })()`);
      log('  돌리려고 다시 집는다 ' + fp(now));
      if (now) await tapXY(now.x, now.y, 80, 1000);
      const before = await page.eval(`(()=>{ try{ const f=(window.__rv.furniture()||[]).find(f=>f.uid===${JSON.stringify(target.uid)}); return f?f.rot:null }catch(e){return null} })()`);
      const tr = await tap('furnTurn'); await sleep(700);
      const cr2 = await canvasRect();
      await dragXY(cr2.l + cr2.w * 0.4, cr2.t + cr2.h * 0.5, cr2.l + cr2.w * 0.62, cr2.t + cr2.h * 0.5, 12, 200);
      await sleep(1500); await calm();
      const after = await page.eval(`(()=>{ try{ const f=(window.__rv.furniture()||[]).find(f=>f.uid===${JSON.stringify(target.uid)}); return f?f.rot:null }catch(e){return null} })()`);
      log(`  [돌리기] ${fp(tr)} rot ${before}→${after}`);
      if (tr.ok && before === after) found('보통', '가구 [돌리기] 뒤 끌어도 각도가 안 바뀜', '가구 탭 → [돌리기] → 좌우로 끌기');
      await tap('furnClose'); await sleep(500);
    }
    await calm();
  }

  /* 등 옮기기 */
  const lamps = await page.eval(`(()=>{ try{ const c=document.getElementById('roomCanvas').getBoundingClientRect();
    return (window.__rv.lamps()||[]).map(l=>{ let p=null; try{p=window.__rv.screenPosOf(l.uid)}catch(e){}
      return {uid:l.uid,name:l.name,mountId:l.mountId, x:p?c.left+p.x:null, y:p?c.top+p.y:null}; }); }
    catch(e){ return {err:String(e)} } })()`);
  log('등 ' + fp(lamps));
  const lamp = Array.isArray(lamps) ? lamps.find(l => l.x != null) : null;
  if (lamp) {
    /* ★ 등을 누르면 **켜지고 꺼진다**(room_view §⑧-e) — 고르기가 아니다. 그것부터 잰다 */
    const on0 = await page.eval(`(()=>{try{return window.__rv.lampOn(${JSON.stringify(lamp.uid)})}catch(e){return {err:String(e)}}})()`);
    await tapXY(lamp.x, lamp.y, 80, 1000);
    const on1 = await page.eval(`(()=>{try{return window.__rv.lampOn(${JSON.stringify(lamp.uid)})}catch(e){return {err:String(e)}}})()`);
    const a = await snap();
    log(`  등 탭 → 스위치 ${fp(on0)}→${fp(on1)} · 가구판 ${fp(a.가구판)} 이름=${await page.eval(`(document.getElementById('furnName')||{}).textContent`)}`);
    if (on0 === on1) found('보통', '등을 눌러도 켜지거나 꺼지지 않음', `${VIEW}: 방에서 등(${lamp.name}) 탭`);
    await tapXY(lamp.x, lamp.y, 80, 900);   /* 원래대로 되돌린다 */
    /* 등 옮기기는 **길게 눌러 가구로 집는** 길이다. 그 길이 있나 본다 */
    const f = await page.eval(`(()=>{try{const r=window.__rv.pickFurnitureAt(${Math.round(lamp.x)},${Math.round(lamp.y)});
      return r?{uid:r.uid,name:r.name}:null}catch(e){return {err:String(e)}}})()`);
    log('  그 자리의 가구 판정 ' + fp(f));
    if (a.가구판 && a.가구판[0]) {
      const before = await page.eval(`(()=>{ try{ const l=(window.__rv.lamps()||[]).find(l=>l.uid===${JSON.stringify(lamp.uid)}); return l?{x:l.x,z:l.z,mountId:l.mountId}:null }catch(e){return null} })()`);
      await tap('furnMove'); await sleep(800);
      const cr = await canvasRect();
      await dragXY(lamp.x, lamp.y, lamp.x + cr.w * 0.08, lamp.y + cr.h * 0.05, 14, 220);
      await sleep(2000); await calm();
      const after = await page.eval(`(()=>{ try{ const l=(window.__rv.lamps()||[]).find(l=>l.uid===${JSON.stringify(lamp.uid)}); return l?{x:l.x,z:l.z,mountId:l.mountId}:null }catch(e){return null} })()`);
      log(`  등 옮김 ${fp(before)}→${fp(after)}`);
      if (fp(before) === fp(after)) found('보통', '등 [옮기기] 뒤 끌어도 자리가 안 바뀜', '등 탭 → [옮기기] → 끌기');
      await page.shot(`${OUT}/${TAG}_09_lamp.png`);
      await tap('furnClose'); await sleep(400);
    } else log('  등은 고르는 것이 아니라 켜고 끄는 것이라 [옮기기]는 못 쟀습니다');
  } else log('  옮길 수 있는 등이 목록에 없습니다 — 못 쟀습니다');
  await calm();
}

/* ══════════════════════════════════════════════════════════
   ⑤ 저장 → 새로고침 → 이어하기
══════════════════════════════════════════════════════════ */
STEP = '⑤ 저장·이어하기';
{
  await calm();
  const before = await snap();
  await sleep(1200);
  const saved = await page.eval(`(()=>{ const keys=Object.keys(localStorage);
    const raw=localStorage.getItem('byeot/save/1');
    return {키들:keys, 있나:!!raw, 길이:raw?raw.length:0}; })()`);
  log('저장 ' + fp(saved));
  if (!saved.있나) found('치명', '세이브가 localStorage 에 없음', '플레이 후 byeot/save/1 확인');
  await page.goto(`${BASE}/game.html`);
  try { await page.waitFor(`!!window.__rv`, 300000, 500); } catch (e) { found('치명', '이어하기에서 방이 안 뜸', '새로고침'); }
  await sleep(4000); await calm();
  const after = await snap();
  const keys = ['day', '돈', '회전', '시루', '화분', '화분자리', '재고'];
  const diff = keys.filter(k => fp(before[k]) !== fp(after[k]))
    .map(k => `${k}: ${fp(before[k])}→${fp(after[k])}`);
  log('  전 ' + fp(Object.fromEntries(keys.map(k => [k, before[k]]))));
  log('  후 ' + fp(Object.fromEntries(keys.map(k => [k, after[k]]))));
  if (diff.length) found('심각', '새로고침 뒤 이어한 상태가 다름 — ' + diff.join(' · '), '플레이 → 새로고침');
  await page.shot(`${OUT}/${TAG}_10_resume.png`);

  /* 이어한 뒤에도 버튼이 살아 있나 */
  const nb = await snap();
  const nr = await tap('next'); await sleep(2200); await calm();
  const na = await snap();
  log(`  이어한 뒤 [다음 날] ${fp(nr)} 일 ${nb.day}→${na.day}`);
  if (nr.ok && na.day === nb.day) found('치명', '이어하기 뒤 [다음 날]이 안 먹음', '새로고침 → [다음 날]');
}

/* ── 마무리 ── */
STEP = '마무리';
log('');
log('■ 먹통(눌렀는데 안 바뀜) ' + fp(dead));
log('■ 멈춤(CDP 응답 없음) 횟수 ' + STALLS);
log('■ 예외 ' + fp(errs.slice(0, 25)));
log('■ 경고(중복 제거) ' + fp([...new Map(warns.map(w => [w.msg, w])).values()].slice(0, 25)));
log('■ 찾은 것 ' + FIND.length + '건');
for (const f of FIND) log(`   [${f.sev}] (${f.step}) ${f.무엇} — 재현: ${f.어떻게}`);
await page.shot(`${OUT}/${TAG}_99_end.png`);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/${TAG}_log.txt`, T.join('\n'), 'utf8');
fs.writeFileSync(`${OUT}/${TAG}_find.json`,
  JSON.stringify({ view: VIEW, find: FIND, dead, errs, stalls: STALLS }, null, 1), 'utf8');
await page.close();
