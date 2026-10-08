/* ============================================================
   probe_cut_open_banjiha.mjs — 반지하에서 «자르기가 실제로 열리는 날» (D25 근거 · [growth] 소유 · 2026-10-08)
   ------------------------------------------------------------
   ★ 무엇을 견주나
     ㉠ «잎 2장» 날 — 퀘스트 first_cut 이 지금 여는 조건(모주 잎 ≥ 2)
     ㉡ «✂ 가 실제로 열리는» 날 — propagation §cutBlockedReason 그대로(게임과 같은 두 문):
        ① 무늬이면서 다 자란(matured = 갈라진) 잎 ≥ 2  (박사님 08-24 · varieMaturedLeaves — game.html §varieMaturedLeavesNow 와 같은 셈)
        ② 초보 모주 문(cutEndsMother) — 자르고도 모주에 잎이 남는 마디가 하나라도 있나
     ⇒ 둘 사이 날수 = 퀘스트는 열렸는데 자를 수 없는 «빈 날»
   ★ 판: 반지하 · novice 빛(room_profile.banjiha · 원룸 이사 전) · banjiha-sill:0 · 첫 그루(프롤로그 무늬 보장 [2,3])
        · 도착 생장일 45 · 물 늘 줌 · 코어 걸음(밝기 속도 적립 · loop.js §growthStepsOf) · 등은 LAMP_DAY 일째부터 LAMPS 개
   ⚠ 날 수는 «도착한 뒤 게임 날»이다(도착 = 게임 Day 11). 게임 Day 47 에 등을 달면 LAMP_DAY=36.

     BYEOT_URL=http://localhost:9321 LAMPS=1 LAMP_DAY=36 SEEDS=40 DAYS=400 node tools/probe_cut_open_banjiha.mjs
     (등 없이: LAMPS=0)
   ⛔ 값·확률·문턱은 안 건드린다.
============================================================ */
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './test_cdp.mjs';
import { createProfileLight } from '../src/game/room_profile.js';
import { GROWTH_STEPS_MAX } from '../src/game/loop.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const BASE = process.env.BYEOT_URL || 'http://localhost:8971';
const SLOT = process.env.SLOT || 'banjiha-sill:0', MODE = process.env.MODE || 'novice';
const LAMPS = Number(process.env.LAMPS || 0), LAMP_DAY = Number(process.env.LAMP_DAY || 36);
const SEEDS = Number(process.env.SEEDS || 40), DAYS = Number(process.env.DAYS || 400), YD0 = Number(process.env.YD0 || 135);
/* ★ 2026-10-08 GATE — «가정 문»을 잰다(게임 코드는 안 바꾼다 · 총괄 D25 물음)
     rule    박사님 규칙(08-24) 그대로 — 무늬이면서 다 자란 잎 ≥ 2 (기본)
     varie1  (ㄴ) 무늬이면서 다 자란 잎 ≥ 1 로 낮췄다면
     leaf3   (ㄷ) 셋째 잎이 «났을 때»(다 자라기 전) 열었다면
   가정 판에서도 «초보 모주 문»(cutEndsMother)은 그대로 본다 — 무늬 문만 바꿔 끼운다(varieMaturedLeaves 를 넉넉히 넘겨 그 문만 비킨다).
   ★ 함정 — 열린 날, 자를 수 있는 마디 가운데 «자르면 모주에 무늬 잎이 한 장도 안 남는» 마디가 있나.
     (propagation §cutBlockedReason 주석의 「산반을 잘라 모주에 무지 한 장만 남는」을 넓힌 것 · 마디가 데려가는 잎 = cuttableNodes().leafBirths) */
const GATE = process.env.GATE || 'rule';
const TH = J('data/balance/light_thresholds.json'), T = TH.plants.monstera_deliciosa;
const BY = J('data/growth_tuning.json').growth_speed.by_band;
const bandOf = d => d < T.die ? 'critical' : d < T.survive ? 'poor' : d < T.min ? 'stagnant'
  : d < T.best_lo ? 'slow' : d <= T.best_hi ? 'best' : d <= T.max ? 'good' : 'over';
const P = J('data/profiles/room_profile.banjiha.json');
const light = createProfileLight({ ...P, uidStable: true },
  { thresholds: TH, weather: J('data/balance/weather.json'), electricity: J('data/balance/electricity.json') });
/* 빛 줄 — 도착 날(1)부터. 등은 LAMP_DAY 일째부터 켠다 */
const dli = [], mult = [];
for (let d = 1; d <= DAYS; d++) {
  const n = (LAMPS > 0 && d >= LAMP_DAY) ? LAMPS : 0;
  const s = (light.daily(d, { sim: { mode: MODE, yearDay0: YD0 }, lamps: { count: n, litHours: 12 }, pots: [], placedItems: [] }).report.slots || []).find(x => x.slotId === SLOT);
  dli.push(s ? s.dli : 0);
  const w = dli.slice(-7), a = w.reduce((x, y) => x + y, 0) / w.length;
  let m = BY[bandOf(a)]; if (typeof m !== 'number' || m < 1) m = 1; mult.push(Math.min(m, GROWTH_STEPS_MAX));
}
const page = await launch({ width: 900, height: 700, dpr: 1, mobile: false });
await page.goto(`${BASE}/plant_grow.html`);
await page.waitFor('typeof cuttableNodes === "function"', 120000, 300);
await page.waitFor('TH_LOADED === true', 120000, 300);
const R = JSON.parse(await page.eval(`(async()=>{ const pr = await import('/src/game/propagation.js');
  const sh = await import('/src/game/shop.js'); sh.installVarieGrades(await (await fetch('/data/balance/varie_grades.json')).json());
  const S0 = ${JSON.stringify({ dli, mult })}; const res=[];
  const S = { sim:{ mode:'novice' }, tutorial:{}, pots:[{ id:'p1', cuts:[] }], cuttings:[] };
  for (let s=1; s<=${SEEDS}; s++){
    plantSeed(s*7919); setPrologueVarieLeaves([2,3]); resetDailyLight(); setGrowth(45);
    let credit=0; const r={ two:null, cut:null, trap:null, trap1:null, leavesAt:null, maxWon:null, won3:null, m3:null };
    for (let k=0; k<S0.dli.length; k++){
      const blocked=!!growthBlocked(); let steps=1;
      if(!blocked){ credit+=S0.mult[k]; steps=Math.min(${GROWTH_STEPS_MAX},Math.floor(credit+1e-9)); credit-=steps; steps=Math.max(1,steps); }
      for(let i=0;i<steps;i++){ setDailyLight(S0.dli[k]); advanceTo(calendarDay()+1); }
      if (r.two==null && leafStats().leaves >= 2) r.two = k+1;
      const on = leafOnPlantAll().filter(x=>x.onPlant).map(x=>x.leafBirth);
      const vm = varieStateAll().filter(v=>v.varie && matureOf(v.leafBirth) && on.includes(v.leafBirth)).length;
      const G=${JSON.stringify(GATE)};
      const cond = G==='varie1' ? vm>=1 : G==='leaf3' ? leafStats().leaves>=3 : vm>=2;
      if (cond) {
        const nodes = cuttableNodes()||[];
        const vmArg = G==='rule' ? vm : 99;      /* 가정 판: 무늬 문만 비키고 초보 모주 문은 그대로 */
        const ok = nodes.filter(n=>pr.cutBlockedReason(S,nodes,n.nodeId,{pot:S.pots[0], varieMaturedLeaves:vmArg})==null);
        if (ok.length) {
          r.cut = k+1; r.leavesAt = leafStats().leaves;
          const varieOn = new Set(varieStateAll().filter(v=>v.varie && on.includes(v.leafBirth)).map(v=>v.leafBirth));
          r.trap = ok.some(n=>{ const c=new Set(n.leafBirths||[]); return [...c].some(lb=>varieOn.has(lb)) && ![...varieOn].some(lb=>!c.has(lb)); });
          /* 좁은 뜻(주석 그대로): 자르고 나면 모주에 잎이 «무지 한 장만» 남는 마디가 있나 */
          const onU=[...new Set(on)].sort((a,b)=>a-b);
          r.trap1 = ok.some(n=>{ const c=new Set(n.leafBirths||[]); const left=onU.filter(lb=>!c.has(lb)); return [...c].some(lb=>varieOn.has(lb)) && left.length===1 && !varieOn.has(left[0]); });
          /* ★ 값(2026-10-08 총괄 물음) — 열린 날 자를 수 있는 마디마다 삽수 값(shop.priceOf · leafM 반영).
               등급: 잎2 산반 · 잎3 하프문(프롤로그 못박기) · 그 밖 무늬 잎은 legacy(산반) · 민무늬는 plain */
          const lm = new Map(leafOnPlantAll().map(x=>[x.leafBirth, x.leafM]));
          const plainId = sh.plainGradeId();
          const gradeOf = lb => { if(!varieOn.has(lb)) return plainId; const rk=onU.indexOf(lb)+1; return rk===2?'sanban':rk===3?'halfmoon':'sanban'; };
          const vals = ok.map(n=>{ const lbs=(n.leafBirths||[]).slice(); const gs=lbs.map(gradeOf); const ms=lbs.map(lb=>lm.has(lb)?lm.get(lb):1);
            const pz=sh.priceOf({ species:'monstera', leaves:lbs.length, variegatedLeaves:gs.filter(g=>g!==plainId).length, leafGrades:gs, leafM:ms, form:'cutting' });
            return { won:pz.won, has3: onU[2]!=null && lbs.includes(onU[2]) }; });
          r.maxWon = Math.max(...vals.map(v=>v.won));
          const v3 = vals.filter(v=>v.has3); r.won3 = v3.length ? Math.max(...v3.map(v=>v.won)) : null;
          r.m3 = (onU[2]!=null && lm.has(onU[2])) ? +lm.get(onU[2]).toFixed(3) : null;
          break;
        }
      }
    }
    res.push(r);
  }
  return JSON.stringify(res); })()`, true, 3600000));
await page.close();
const q = (a, f) => { const v = a.filter(x => x != null).sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(f * (v.length - 1)))] : null; };
const two = R.map(r => r.two), cut = R.map(r => r.cut), gap = R.map(r => (r.two != null && r.cut != null) ? r.cut - r.two : null);
console.log(`[문 ${GATE}] 반지하 ${SLOT} · ${MODE} · 등 ${LAMPS}${LAMPS ? `(도착 뒤 ${LAMP_DAY}일째부터)` : ''} · 첫 그루(잎2·3 무늬) · 도착 생장일 45 · ${SEEDS}판 · ${DAYS}일 · «도착 뒤 게임 날»`);
console.log(`  ㉠ 잎 2장(지금 first_cut 열림)   중앙 ${q(two, .5)} · 90% ${q(two, .9)}`);
const GATE_KO = { rule: '박사님 규칙: 무늬 갈라진 잎 ≥ 2', varie1: '가정 (ㄴ): 무늬 갈라진 잎 ≥ 1', leaf3: '가정 (ㄷ): 셋째 잎이 남' }[GATE] || GATE;
console.log(`  ㉡ ✂ 열림(${GATE_KO} + 초보 모주 문)   중앙 ${q(cut, .5)} · 90% ${q(cut, .9)} · ${DAYS}일 안에 안 열림 ${cut.filter(x => x == null).length}/${SEEDS}`);
console.log(`  ⇒ 빈 날(㉡−㉠)   중앙 ${q(gap, .5)} · 90% ${q(gap, .9)}`);
const opened = R.filter(r => r.cut != null).length;
console.log(`  ⚠ 함정 넓은 뜻(자르면 모주에 무늬 잎이 한 장도 안 남는 마디가 있음)   ${R.filter(r => r.trap).length}/${opened} 판`);
console.log(`  ₩ 열린 날 «제일 값나가는» 자를 수 있는 삽수   중앙 ${q(R.map(r => r.maxWon), .5)}원 · 10% ${q(R.map(r => r.maxWon), .1)}원`);
console.log(`  ₩ 하프문 잎(잎3)을 데려가는 삽수   중앙 ${q(R.map(r => r.won3), .5)}원 · 10% ${q(R.map(r => r.won3), .1)}원 · 잎3 자란 정도(leafM) 중앙 ${q(R.map(r => r.m3), .5)} · leafM < 0.1(갓 난 잎) ${R.filter(r => r.m3 != null && r.m3 < 0.1).length}/${opened} 판`);
console.log(`  ⚠ 함정 좁은 뜻(자르면 모주에 «무지 한 장만» 남는 마디가 있음 · cutBlockedReason 주석의 그것)   ${R.filter(r => r.trap1).length}/${opened} 판 · 열린 날 잎 수 중앙 ${q(R.map(r => r.leavesAt), .5)}`);
