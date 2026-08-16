/* ============================================================
   tools/sim_realgame.mjs — **진짜 게임을 브라우저에서 몰아서** 반지하 한 판을 굴린다
   ------------------------------------------------------------
     python tools/serve.py 8977
     BYEOT_URL=http://localhost:8977 node tools/sim_realgame.mjs --route=C --seeds=1,2,3

   ══ 왜 새로 만드나 ═══════════════════════════════════════════════════════
   `tools/test_banjiha_routes.mjs`(낡은 재현)는 `plant_grow.html` 을 **node 안에서**
   올려 놓고 코어 함수를 직접 불러 판을 굴린다. 그 길이 진짜 게임과 다른 답을 낸다 —
   같은 자리(`growthDays() 70`)에서 브라우저는 잎 2장, 낡은 재현은 잎 3장·무늬 2장이었다.
   원인을 캐는 대신 **재는 자를 갈아엎는다**(박사님 지시 2026-08-16).

   ⇒ 이 자는 `game.html` 을 헤드리스 크롬에 띄우고 **사람이 누르는 것만** 누른다.
     헤드리스 생장 엔진을 한 줄도 안 쓴다. `plant_grow` 를 node 에서 로드하지 않는다.

   ══ ★★ 시계가 둘이다 — 날짜는 **반드시 둘 다** 적는다 ═════════════════════
     `S.day`      달력. 첫 플레이 중에도 흐른다. 식물이 이 시계로 자란다
     `ts.day`     튜토. **첫 플레이가 끝나기 전에는 0 에 멈춰 있다**. 계절이 이 시계다
   START-HERE §2.9-⑤ 가 「하나만 찍혀 있어 네 번 헛짚었다」고 적어 둔 그 사고다.

   ══ ★ 무엇을 켜고 무엇을 껐나 (표 머리에 그대로 적는다) ═══════════════════
     켠 것 ① `?fast=1` · `window.__byeotSkipDayAnim`  「넘어가는 중」 900ms 연출을 끈다
     켠 것 ② `window.__rv.setActInstant(true)`         걸어가기·모션 연출을 끈다
     켠 것 ③ iframe 의 `plantSeed(n)`                  판마다 다른 개체를 세운다(아래 §씨앗)
     ⚠ ①②는 **규칙을 한 톨도 안 바꾼다.** 둘 다 게임이 이미 갖고 있는 검사용 문이고
       (`game.html §dayAnimOff` · `room_view.js:6900`), 연출을 건너뛴 뒤 **같은 `done()`** 을 부른다.
     ⚠ 안 켜면 동작 하나가 **7~8초**다(실측). 한 판이 몇 시간이 되어 한 판도 못 돌린다.
     ⛔ 밸런스·규칙·값은 **하나도 안 건드린다.** 돈·재고·체력을 넣어 주지 않는다.

   ══ ★ 씨앗 — 이 자가 유일하게 게임 상태에 손대는 자리 ══════════════════════
   진짜 게임의 몬스테라 개체는 `plant_grow.html` 의 `SEED = 92158` **하나로 못 박혀** 있다
   (`plant_grow.html:184`). 그래서 브라우저 판은 몇 번을 굴려도 그루가 똑같다.
   낡은 재현이 40판을 낸 것은 씨앗을 40개 굴렸기 때문이다.
   ⇒ 견주려면 여기서도 굴려야 한다. **도착(setGrowth) 전에** iframe 의 `plantSeed(n)` 을
     한 번 부른다 — plant_grow 창의 [씨앗] 단추가 부르는 그 함수다.
   ⚠ 안 굴리면 「40판」이 아니라 「같은 판 40번」이다. 그건 지어낸 표다.

   ══ ⚠ 이 파일이 지키는 것 ════════════════════════════════════════════════
   · `game.html` · `src/game/**` · 낡은 재현을 **한 글자도 안 고친다**
   · 상태(`window.__S()`)는 **읽기만** 한다. 판을 굴리는 것은 언제나 DOM 단추다
   · 없는 판을 지어내지 않는다. 못 돌린 것은 못 돌렸다고 적는다
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './test_cdp.mjs';

const BASE = process.env.BYEOT_URL || 'http://localhost:8977';
const ARG = Object.fromEntries(process.argv.slice(2)
  .filter(s => s.startsWith('--'))
  .map(s => { const i = s.indexOf('='); return i < 0 ? [s.slice(2), '1'] : [s.slice(2, i), s.slice(i + 1)]; }));

const ROUTES = {
  /* 낡은 재현의 셋을 그대로 흉내 낸다(test_banjiha_routes §G) */
  A: { ko: '경로 A (등 없이 · 바로 삽수)',          buyLamp: false, startCutTday: 0,  days: 240 },
  B: { ko: '경로 B (등 사고 · 바로 삽수)',          buyLamp: true,  startCutTday: 0,  days: 240 },
  C: { ko: '경로 C (한 박자 늦게 · 튜토 12일부터)',  buyLamp: true,  startCutTday: 12, days: 360 }
};
const DARK = 'banjiha-dresser:1';        // 콩나물 자리 (peak DLI 0.04)
const SILL = 'banjiha-sill:0';           // 몬스테라 자리 (peak DLI 3.77)

const routeIds = (ARG.route || 'A,B,C').split(',').map(s => s.trim().toUpperCase());
const seeds = (ARG.seeds || '1,2,3,4,5').split(',').map(s => +s.trim()).filter(Number.isFinite);
const OUTJSON = ARG.out || null;
const DAYCAP = ARG.days ? +ARG.days : null;
const VERBOSE = !!ARG.v;
const SHOTDIR = ARG.shots || null;

const WD_MS = +(process.env.BYEOT_SIM_TIMEOUT_MS || 8 * 3600 * 1000);
const wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다'); process.exit(2); }, WD_MS);
wd.unref && wd.unref();

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
const errs = [];
page.on((m, p) => {
  if (m === 'Runtime.exceptionThrown')
    errs.push(((p.exceptionDetails.exception || {}).description || p.exceptionDetails.text || '').slice(0, 200));
});
const ev = (expr, awaitP = true) => page.eval(expr, awaitP);

/* 대사·가이드를 넘긴다 */
async function walk(max = 40) {
  for (let i = 0; i < max; i++) {
    const busy = await ev(`(()=>{const s=document.getElementById('stage'),
      g=document.getElementById('guide');
      const on=!!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));
      if(!on) return false;
      const k=document.getElementById('dlgSkip'); if(k) k.click();
      const b=document.getElementById('dlgBox'); if(b) b.click();
      const c=document.getElementById('guideClose'); if(c) c.click();
      return true;})()`);
    if (!busy) return true;
    await sleep(120);
  }
  return false;
}
/* 동작(걸어가기+모션)이 끝날 때까지.
   ⚠⚠ **`#actBar` 만 보면 안 된다.** 말풍선이 진행을 그릴 수 있으면 게임이 하단 막대를
     **숨긴다**(`game.html §actBar` 첫 줄 `markGauge(...) → b.style.display='none'`).
     그것 때문에 이 자가 「끝났다」로 읽고 다음 날로 넘어가, **심기 한 번이 여덟 날에 걸쳐**
     끝났다(실측). 「회전이 0」으로 보인 진짜 까닭이 이것이다. */
async function waitAct(ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const busy = await ev(`(()=>{
      const b=document.getElementById('actBar');
      if (b && b.style.display !== 'none') return true;
      return !!document.querySelector('#marks .mark.acting');})()`);
    if (!busy) return true;
    await sleep(100);
  }
  return false;
}
/* 상점 주문 — [주문] → 개수 창 → [N개 주문] (2026-08-18 부터 이 길이다) */
async function order(itemId, qty = 1) {
  return ev(`(()=>{
    const b=document.querySelector('[data-buy="${itemId}"]'); if(!b) return false;
    b.click();
    for(let i=1;i<${qty};i++){const p=document.getElementById('buyPlus'); if(p&&!p.disabled)p.click();}
    const g=document.getElementById('buyGo');
    const ok = !!(g && !g.disabled);
    if(ok) g.click();
    const c=document.getElementById('buyCancel'); if(c) c.click();
    return ok;})()`);
}

/* ══ 한 판 ══════════════════════════════════════════════════════════════ */
async function playRun(routeId, seed) {
  const R = ROUTES[routeId];
  const maxDays = DAYCAP || R.days;
  const t0 = Date.now();

  /* ── 부팅 ── ⚠ `localStorage.clear()` 는 goto **뒤에**(빈 문서에서는 SecurityError) */
  await page.goto(`${BASE}/game.html?fast=1`);
  await ev(`localStorage.clear()`, false);
  await page.goto(`${BASE}/game.html?fast=1`);
  await page.waitFor('!!window.__rv', 180000, 300);
  await page.waitFor('window.__byeotBooted === true', 180000, 300);
  await ev(`window.__byeotSkipDayAnim = true`, false);
  await ev(`(()=>{ try{ return window.__rv.setActInstant(true); }catch(e){ return null; } })()`);
  await sleep(3000);
  await walk();

  /* ── ★씨앗을 굴린다 (위 §씨앗) ── */
  const seedSet = await ev(`(()=>{ try{
      const w = document.getElementById('growth').contentWindow;
      if (typeof w.plantSeed !== 'function') return null;
      return w.plantSeed(${seed >>> 0});
    }catch(e){ return null; } })()`);

  /* ── 시루를 어두운 자리에 놓는다 (끌어 놓기가 게임의 실제 길이다) ── */
  await ev(`(()=>{ const rv=window.__rv,
      c=document.getElementById('roomCanvas').getBoundingClientRect();
    const sp=rv.screenPosOf('${DARK}'); if(!sp) return false;
    window.__drag.begin('beansprout', document.getElementById('cropThumb').src,
                        {clientX:c.left+c.width*0.9, clientY:c.top+40});
    window.__drag.move({clientX:c.left+sp.x, clientY:c.top+sp.y});
    window.__drag.end(); return true; })()`);
  await sleep(800); await walk();

  const rows = [];
  let arrival = null, firstPlayEnd = null, lampBuy = null, movedOut = null,
      bankrupt = null, firstCut = null, firstList = null, potListed = null, varieSoldAt = null,
      potQuote = null;
  let movedSlot = false, lastDay = -1, stuck = 0;

  for (let step = 0; step < maxDays; step++) {
    /* ── ① ★오늘 할 일 — **말풍선을 누른다** ────────────────────────────
       ⚠ 여기서 헛짚었다. 아래 `#waterCrop`·`#harvestCrop`·`#resow` 는 **말풍선이 같은
         말을 하고 있으면 `display:none`** 이다(`game.html §markSays`). 그 셋만 두드리면
         30일을 굴려도 회전이 0이다 — "게임이 안 돈다"가 아니라 **누르는 자리가 틀렸다.**
       ⇒ 말풍선이 정본이고 아래 단추가 예비다. 말풍선은 급한 것 하나만 뜨므로 여러 번 돈다. */
    for (let i = 0; i < 10; i++) {
      const r = JSON.parse(await ev(`(()=>{
        const S=window.__S();
        const sig=()=>[...document.querySelectorAll('#marks .mark')].map(e=>e.textContent).join('|')
          + '#' + ((S.stamina||{}).usedToday||0) + '#' + S.day;
        const before=sig();
        const re=/거두기|씨앗 심기|물 주기|분갈이/;
        const m=[...document.querySelectorAll('#marks .mark')].find(x=>re.test(x.textContent||''));
        let did=null;
        if(m){ m.click(); did='mark'; }
        else {
          const shown=(id)=>{const e=document.getElementById(id);
            if(!e||e.disabled) return null;
            const cs=getComputedStyle(e);
            if(e.style.display==='none'||cs.display==='none'||cs.visibility==='hidden') return null;
            return e;};
          for(const id of ['harvestCrop','resow','waterCrop','waterPot']){
            const e=shown(id); if(e){ e.click(); did=id; break; } }
        }
        return JSON.stringify({did, before});})()`));
      if (!r.did) break;
      await waitAct(); await walk(6);
      const after = await ev(`(()=>{const S=window.__S();
        return [...document.querySelectorAll('#marks .mark')].map(e=>e.textContent).join('|')
          + '#' + ((S.stamina||{}).usedToday||0) + '#' + S.day;})()`);
      if (after === r.before) break;      // 아무것도 안 바뀐다 — 체력이 다 됐거나 막혔다
    }

    /* ── ② 하루치 살림을 **한 번에** 읽고, 되묻기 없는 손짓은 그 자리에서 한다 ──
         · 연락 온 중고 거래를 거래한다 (돈이 들어오는 유일한 자리)
         · 도착했으면 몬스테라를 창턱으로 옮긴다
         · 뿌리내린 삽수를 내놓는다
         · 식물등을 산다 (경로 B·C · 가을에 열린다)
       그리고 **결정이 필요한 것**(무늬 마디 고르기 · 주문 · 모주 내놓기)은 값만 실어 온다.
       ⚠⚠ **모주가 없으면 잎을 안 적는다.** plant_grow 는 부팅 때부터 시연용 그루를 들고
         있어서(잎 3장·유효 120일) 도착 전에 `leafStats()` 를 그대로 적으면 「첫날부터
         잎 3장」이라는 거짓말이 된다 — `test_questui B-2` 가 지키는 그 줄이다. */
    const D = JSON.parse(await ev(`(()=>{
      const S=window.__S(), ts=S.tutorial;
      const t=(id)=>{const e=document.getElementById(id); return e?(e.textContent||'').replace(/\\s+/g,' ').trim():'';};
      const num=s=>Number((String(s).match(/([\\d,]+)원/)||[0,'0'])[1].replace(/,/g,''));
      const out={ acted:[] };

      /* 연락 온 것을 그날 전부 거래한다 */
      for(let i=0;i<5;i++){ const b=document.querySelector('#marketList [data-deal]');
        if(!b) break; b.click(); out.acted.push('deal'); }

      /* 도착했으면 창턱으로 (사람이 하는 일) */
      if(S.pots.length>0){ const s=document.getElementById('slot');
        if(s && !s.disabled && s.value!=='${SILL}'){
          s.value='${SILL}'; s.dispatchEvent(new Event('change',{bubbles:true}));
          out.acted.push('slot'); } }

      /* 뿌리내린 삽수를 내놓는다 */
      for(let i=0;i<5;i++){ const b=document.querySelector('#cutList [data-list]');
        if(!b||b.disabled) break; b.click(); out.acted.push('list'); }

      /* 식물등 — 경로가 사기로 한 판에서만 부른다(아래 wantLamp) */
      out.lampBtn = (()=>{const b=document.getElementById('buyLamp');
        return b ? { off:!!b.disabled, ko:b.textContent } : null;})();
      out.lampOwned = (ts.lamp||{}).owned||0;

      /* 자를 마디 — **무늬부터** 고르려고 줄을 그대로 실어 온다 */
      out.cutRows=[...document.querySelectorAll('#cutNodes .cutRow')].map(r=>{
        const nm=(r.querySelector('.nm')||{}).textContent||'';
        const m=nm.match(/잎 (\\d+)장/), v=nm.match(/무늬 (\\d+)장/);
        return { leaves:m?+m[1]:null, varie:v?+v[1]:0,
                 btns:[...r.querySelectorAll('[data-cut]')]
                   .map(b=>({node:b.dataset.cut, cont:b.dataset.cont, off:!!b.disabled})) };
      }).filter(r=>r.btns.length && r.leaves!=null);
      out.dying = (S.cuttings||[]).some(c=>c.status==='node');
      out.repotBtn = !!document.querySelector('#cutList [data-repot]:not([disabled])');

      const st=S.shop.stock||{};
      const inc=(S.shop.orders||[]).reduce((a,o)=>{a[o.itemId]=(a[o.itemId]||0)+o.qty;return a;},{});
      out.stock={ bean_seed:(st.bean_seed||0)+(inc.bean_seed||0),
                  jar:(st.jar||0)+(inc.jar||0), pot:(st.pot||0)+(inc.pot||0) };

      /* 이사 판단에 쓰는 값 — **화면이 적어 놓은 것을 읽는다**(여기서 다시 안 센다) */
      out.learnDone = /배울 것은 다 해 봤습니다/.test(t('tutCheck'));
      out.sellOff = (document.getElementById('sellPlant')||{}).disabled !== false;
      out.potWon = num(t('sellPlant'));
      out.cutWon = 0;
      for (const b of document.querySelectorAll('#cutList [data-list]')) out.cutWon += num(b.textContent);
      for (const w of document.querySelectorAll('#marketList .won')) out.cutWon += num(w.textContent);
      out.potListed = ((S.shop||{}).listings||[]).some(l=>l.kind==='pot');
      out.moveOutOn = (()=>{const b=document.getElementById('moveOut'); return !!b && !b.disabled;})();

      /* ── 오늘 한 줄 ── */
      const b0=(S.firstPlay&&S.firstPlay.beansprout)||{};
      let ls=null, gd=null, cal=null;
      if(S.pots.length>0){
        try{ ls=window.__io.growth.leafStats(); }catch(e){}
        try{ gd=window.__io.growth.growthDays(); }catch(e){}
        try{ cal=window.__io.growth.calendarDay(); }catch(e){}
      }
      out.row={ day:S.day, tday:ts.day, cash:ts.cashWon,
        bankrupt:!!ts.bankrupt, movedOut:!!ts.movedOut,
        completed:!!(S.firstPlay&&S.firstPlay.completed), pots:S.pots.length,
        leaves: ls?ls.leaves:null, varie: ls?ls.variegatedLeaves:null, gd, cal,
        harvests:b0.harvestCount||0, sirus:b0.sirus||0,
        cuts:(S.cuttings||[]).filter(c=>c.status!=='dead').length,
        listings:((S.shop||{}).listings||[]).length,
        varieSold:((ts.varieSale||{}).count||0),
        /* ★ 확정 무늬 장부 — 코어는 이걸 세우는데 화면이 안 읽는다(보고서 §없는 손잡이) */
        grantCount:((ts.varieGrant||{}).count)||0,
        grantNodes:(((ts.varieGrant||{}).nodeIds)||[]).length };
      return JSON.stringify(out);})()`));

    const row = D.row;
    rows.push(row);
    if (D.acted.length) await walk(8);

    if (!arrival && row.pots > 0) arrival = { day: row.day, tday: row.tday, gd: row.gd, leaves: row.leaves };
    if (!firstPlayEnd && row.completed) firstPlayEnd = { day: row.day, tday: row.tday, gd: row.gd, leaves: row.leaves, varie: row.varie };
    if (!bankrupt && row.bankrupt) bankrupt = { day: row.day, tday: row.tday };
    if (!varieSoldAt && row.varieSold > 0) varieSoldAt = { day: row.day, tday: row.tday };
    if (!firstList && row.listings > 0) firstList = { day: row.day, tday: row.tday };
    if (row.movedOut) { movedOut = { day: row.day, tday: row.tday, gd: row.gd, leaves: row.leaves }; break; }

    /* ── ③ 식물등 ── */
    if (R.buyLamp && !lampBuy && D.lampBtn && !D.lampBtn.off) {
      await ev(`(()=>{const b=document.getElementById('buyLamp'); if(b&&!b.disabled) b.click();})()`, false);
      await sleep(120); await walk();
      const own = await ev(`window.__S().tutorial.lamp.owned`);
      if (own > 0) lampBuy = { day: row.day, tday: row.tday };
    }

    /* ── ④ 씨앗을 미리 시켜 둔다 (배송 1일) ── */
    if (D.stock.bean_seed < 1) await order('bean_seed', 1);

    /* ── ⑤ ★삽수 — **무늬 마디부터** 자른다. 그게 이사 자금이다 ──
       ⚠ 처음에는 「회색이 아닌 첫 단추」를 눌렀다. 그러면 민무늬를 먼저 집어
         무늬가 와도 안 자른다 — 실측으로 경로 C 한 판이 튜토 91일에 파산했다. */
    if (row.tday >= R.startCutTday) {
      const varieRows = D.cutRows.filter(r => r.varie > 0).sort((a, b) => a.leaves - b.leaves);
      const target = varieRows[0] || D.cutRows.filter(r => r.leaves === 1)[0] || null;
      if (target) {
        /* 물꽂이는 잎 한 장짜리만 받는다 — 여러 장은 흙으로 (propagation §WATER_LEAF_MAX) */
        const wantCont = target.leaves <= 1 ? 'jar' : 'soil';
        const wantItem = wantCont === 'jar' ? 'jar' : 'pot';
        const btn = target.btns.find(b => b.cont === wantCont) || target.btns.find(b => !b.off) || null;
        if (btn && !btn.off) {
          await ev(`(()=>{const b=document.querySelector(
            '#cutNodes [data-cut="${btn.node}"][data-cont="${btn.cont}"]');
            if(b && !b.disabled) b.click();})()`, false);
          await waitAct(); await walk(6);
          if (!firstCut) firstCut = { day: row.day, tday: row.tday };
        } else if (row.cuts === 0 && (D.stock[wantItem] || 0) === 0) {
          await order(wantItem, 1);       // 회색인 흔한 까닭은 용기가 없는 것이다
        }
      }
      /* 혹이 난 삽수는 분갈이한다 — 안 하면 시들어 사라진다 */
      if (D.dying) {
        if (!D.stock.pot) await order('pot', 1);
        if (D.repotBtn) {
          await ev(`(()=>{const b=document.querySelector('#cutList [data-repot]');
            if(b&&!b.disabled) b.click();})()`, false);
          await waitAct(); await walk(6);
        }
      }
    }

    /* ── ⑥ 이사 — 낡은 재현과 **같은 판단**이다(test_banjiha_routes §④):
       배움이 끝났고 · 둘째 축(무늬 삽수를 판 적이 있다)이 열렸고 ·
       지갑 + 삽수 + 그루가 이사비에 닿으면 **그루를 내놓는다.** */
    if (!potListed && D.learnDone && row.varieSold > 0 && !D.sellOff) {
      const need = await ev(`window.__S().tutorial.rules.moveOutCostWon`);
      if (row.cash < need && row.cash + D.cutWon + D.potWon >= need) {
        /* 되묻는다 — 두 번 눌러야 나간다(confirmOnce) */
        await ev(`(()=>{const b=document.getElementById('sellPlant'); if(b&&!b.disabled) b.click();})()`, false);
        await sleep(90);
        await ev(`(()=>{const b=document.getElementById('sellPlant'); if(b&&!b.disabled) b.click();})()`, false);
        await sleep(120); await walk(6);
        /* ══ ★★★ 올리고 나서 **진짜 값을 보고 모자라면 내린다** ═══════════════════════
           ------------------------------------------------------------
           ⚠⚠ 여기서 판이 통째로 죽었다(실측). [몬스테라 내놓기 (N원)] 단추에 적힌 N 은
             `priceOf`(삽수 값 ×1.0 · 등급 안 봄)인데, 실제로 올라간 값은 `listPot` 이
             매긴 것이라 **다르다.** 그 차이를 모르고 팔면 「돈은 모자라는데 그루는 없는」
             막다른 길이 된다 — 경로 C 씨앗 다섯 판이 전부 그렇게 죽었다.
           ★ 내리는 것은 **게임이 내주는 길**이다: *"내리면 아무 일도 없던 것이 됩니다"*
             (`game.html §drawMarket`). 한 푼도 안 움직인다. 사람이 값을 보고 무르는 그 손짓이다.
           ⇒ 올린 값을 읽어 **닿지 않으면 그 자리에서 내린다.** 잎이 더 나면 다시 본다. */
        const q = JSON.parse(await ev(`(()=>{const S=window.__S();
          const L=((S.shop||{}).listings||[]);
          const p=L.find(l=>l.kind==='pot');
          const other=L.filter(l=>l.kind!=='pot').reduce((a,l)=>a+(l.won||0),0);
          return JSON.stringify({ listedWon: p?p.won:null, id:p?p.listingId:null,
            other, cash:S.tutorial.cashWon });})()`));
        if (q.listedWon != null) {
          potQuote = potQuote || { day: row.day, tday: row.tday, shownWon: D.potWon, listedWon: q.listedWon };
          if (q.cash + q.other + q.listedWon >= need) potListed = { day: row.day, tday: row.tday };
          else {
            await ev(`(()=>{const b=document.querySelector('#marketList [data-unlist]');
              if(b) b.click();})()`, false);
            await sleep(120); await walk(6);
          }
        }
      }
    }
    /* ── ⑦ 나갈 수 있으면 나간다 ── */
    if (D.moveOutOn) {
      await ev(`(()=>{const b=document.getElementById('moveOut'); if(b&&!b.disabled) b.click();})()`, false);
      await sleep(400); await walk();
    }

    if (VERBOSE && (step % (+ARG.every || 10) === 0))
      console.log(`    d${row.day}/t${row.tday} 잎${row.leaves}(무${row.varie}) 유효${row.gd} ` +
                  `${row.cash.toLocaleString()}원 회전${row.harvests} 삽수${row.cuts} 글${row.listings} ` +
                  `무판${row.varieSold} 확정무늬${row.grantCount}`);

    /* ── ⑧ 하루를 넘긴다. [다음 날] → 밥상 창 → [이대로 다음 날 ▸] ──
       ⚠ `#next` 는 **시루를 놓기 전엔 안 열린다** — 안 놓고 누르면 날짜가 0에 머무는데
         화면이 아무 말도 안 한다(START-HERE §2.9). 그래서 아래 `stuck` 이 지켜본다. */
    await ev(`(()=>{
      const n=document.getElementById('next');
      if(n && !n.disabled) n.click();
      const m=document.getElementById('mealPanel');
      if(m && m.classList.contains('on')){const g=document.getElementById('mealGo'); if(g) g.click();}
    })()`, false);
    try { await page.waitFor(`window.__S().day > ${row.day}`, 30000, 60); } catch { }
    await walk();
    /* 월세 낸 날의 가계부 팝업 등 — 읽는 창이라 닫는다(게임이 내주는 그 손잡이로) */
    await ev(`(()=>{ for(let i=0;i<4;i++){ try{ if(!window.__byeotPopClose()) break; }catch(e){ break; } } })()`, false);

    if (row.day === lastDay) { stuck++; if (stuck >= 3) break; } else { stuck = 0; }
    lastDay = row.day;
  }

  if (SHOTDIR) {
    try { await page.shot(path.join(SHOTDIR, `${routeId}_seed${seed}_last.png`)); } catch { }
  }
  const last = rows[rows.length - 1] || null;
  return {
    route: routeId, seed, seedSet, ms: Date.now() - t0,
    arrival, firstPlayEnd, lampBuy, firstCut, firstList, varieSoldAt, potListed, potQuote, movedOut, bankrupt,
    last, days: rows.length, rows
  };
}

/* ══ 굴리기 ═════════════════════════════════════════════════════════════ */
const START = new Date();
console.log(`START ${START.toISOString()}  (${BASE})`);
console.log(`경로 ${routeIds.join(',')} · 씨앗 ${seeds.join(',')}`);
console.log(`켠 것 — fast=1 · __byeotSkipDayAnim · __rv.setActInstant(true) · plantSeed(씨앗)`);
console.log(`끈 것 — 없음. 돈·재고·체력을 넣어 주지 않는다\n`);

const all = [];
for (const rid of routeIds) {
  if (!ROUTES[rid]) { console.log(`⚠ 모르는 경로: ${rid}`); continue; }
  console.log(`══ ${ROUTES[rid].ko} ══════════════════════════════════`);
  for (const sd of seeds) {
    let r = null;
    try { r = await playRun(rid, sd); }
    catch (e) { console.log(`  씨앗 ${sd} — ⛔ ${e.message}`); continue; }
    all.push(r);
    if (OUTJSON) {
      fs.mkdirSync(path.dirname(OUTJSON), { recursive: true });
      fs.writeFileSync(OUTJSON, JSON.stringify({ start: START, base: BASE, runs: all }, null, 1));
    }
    const a = r.arrival, f = r.firstPlayEnd, m = r.movedOut, b = r.bankrupt;
    console.log(`  씨앗 ${String(sd).padStart(3)} · ${(r.ms / 60000).toFixed(1)}분 · ${r.days}일` +
      ` | 도착 ${a ? `달${a.day}/튜${a.tday}` : '—'}` +
      ` | 첫플끝 ${f ? `달${f.day}/튜${f.tday}·잎${f.leaves}(무${f.varie})` : '—'}` +
      ` | 이사 ${m ? `달${m.day}/튜${m.tday}` : '✕'}` +
      ` | 파산 ${b ? `달${b.day}/튜${b.tday}` : '—'}` +
      ` | 끝 잎${r.last && r.last.leaves}(무${r.last && r.last.varie})/유효${r.last && r.last.gd}`);
  }
}

const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
console.log('\n══ 이사 성공률 · 탈출 일수 (달력 / 튜토 **둘 다**) ═══════════════');
console.log('| 경로 | 판수 | 이사 성공 | 탈출 달력일 중앙값 | 탈출 튜토일 중앙값 | 파산 판 |');
console.log('|---|---|---|---|---|---|');
for (const rid of routeIds) {
  const rs = all.filter(r => r.route === rid);
  if (!rs.length) continue;
  const ok = rs.filter(r => r.movedOut), br = rs.filter(r => r.bankrupt);
  console.log(`| ${rid} | ${rs.length} | ${ok.length}/${rs.length} (${Math.round(ok.length / rs.length * 100)}%) | ` +
    `${ok.length ? median(ok.map(r => r.movedOut.day)) : '—'} | ${ok.length ? median(ok.map(r => r.movedOut.tday)) : '—'} | ${br.length} |`);
}
const END = new Date();
console.log(`\n예외 ${errs.length}건${errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(`END ${END.toISOString()} · 총 ${((END - START) / 60000).toFixed(1)}분`);
if (OUTJSON) {
  fs.writeFileSync(OUTJSON, JSON.stringify({ start: START, end: END, base: BASE, runs: all }, null, 1));
  console.log(`⭳ ${OUTJSON}`);
}
await page.close();
process.exit(0);
