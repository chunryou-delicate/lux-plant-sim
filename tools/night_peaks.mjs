/* ============================================================
   tools/night_peaks.mjs — **지갑이 어디로 가고 있나**를 판마다 읽는다
   ------------------------------------------------------------
   [Plan] 2026-08-24 · 씨앗 1 판에서 찾은 것:
     지갑이 **한 번도 시작 자금(1,500,000)을 안 넘는다.** 첫날이 제일 부자다.
     ⇒ ★★ *"「못 닿는다」가 아니다 — «가고 있지도 않다».
            못 닿는다 = 가다가 모자란다 / 이 판 = 방향이 반대다"*
     그리고 **봉우리가 낮아진다**: 737,699 → 593,099 → 413,300.
     ⇒ 월세가 30일마다니 **톱니 자체는 당연**하다. 문제는 **봉우리가 낮아지는 것**이다 —
       회복이 **전보다 낮은 곳까지만** 온다.

   ⇒ 그래서 이 자가 내는 것은 셋이다:
     ① 지갑이 시작 자금을 **넘은 적이 있나**  ← 예/아니오 하나. 제일 빨리 나온다
     ② **봉우리 추세** — 월세 주기마다의 최고점
     ③ **고비가 몇 번 오나** — 골의 개수와 깊이
   ⚠ **파산일 다섯을 평균 내는 것보다 이쪽이 훨씬 많이 말한다**([Plan]) —
     파산일에는 **운이 섞이는데 봉우리 추세는 안 섞인다.**

     node tools/night_peaks.mjs [파일...]        (없으면 _out/night 아래 play_*.json 전부)
============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools', '_out', 'night');

/* ⚠ 시작 자금·월세 주기를 **여기서 짓지 않는다** — 판의 첫날 지갑이 곧 시작 자금이고,
   주기는 아래에서 「골이 몇 번 왔나」로 세므로 상수를 안 박는다. */
const RENT_CYCLE = 30;                 // 월세 주기(일). 봉우리를 자를 창 크기로만 쓴다

/* ══ ★★★ **넷째 잎이 오는 날 — d158** ═══════════════════════════════════════════
   [growth] 가 박사님 간격표에서 냈고, 내가 실측으로 교차검산했다. 셈은 이렇다:
     간격표(누적 «유효 생장일»)  30 · 70 · 120 · ★190 · 290       (박사님 확정)
     도착 개체는 유효 «45» 에서 시작한다(`state.js ARRIVAL.growthDays`)
     도착일 d13  ⇒  게임일 = 13 + (유효 − 45)
     ⇒ 잎2 d38 · 잎3 d88 · ★ **잎4 d158** · 잎5 d258
   ⇒ ★ 실측(씨앗 1)이 d13 · d39 · d89 — **한 칸도 안 어긋난다.** 두 창이 다른 길로 같은 수에 닿았다.

   ⚠⚠ **무늬 잎 셋째 장은 넷째 잎이 «무늬여야» 온다.** 창턱은 속도 축이 안 열려(밴드 'slow')
     무늬 확률이 **0.50 이 천장**이다 — 등을 셋 사도 안 오른다([growth] 실측).
     ⇒ ★ 그러니 **「d158」이 아니라 「반은 d158, 반은 그 뒤」**다: 50% d158 · 25% d258 · 12.5% 그 뒤.
   ⚠ 이 수는 **이 자가 지은 것이 아니다.** 간격표는 박사님 것이고 45 는 코어 것이다.
     둘 중 하나가 움직이면 **여기도 같이 움직여야 한다.** */
const LEAF4_DAY = 158;

function collect(files) {
  if (files.length) return files;
  const out = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (/^play_.*\.json$/.test(f.name)) out.push(p);
    }
  };
  try { walk(OUT); } catch { }
  return out.sort();
}

/* 한 판을 읽어 셋을 낸다. ⚠ 못 읽는 칸은 **null 로 둔다** — 0 으로 안 메꾼다 */
function readRun(file) {
  const R = JSON.parse(fs.readFileSync(file, 'utf8'));
  const days = (R.days || []).filter(d => d && Number.isFinite(d.cash));
  if (!days.length) return null;
  const start = days[0].cash;
  /* ① 시작 자금을 넘은 적이 있나 — **첫날 자신은 안 센다**(그게 출발점이다) */
  const over = days.slice(1).filter(d => d.cash > start);
  /* ② 봉우리 — 주기마다의 최고점. 창을 겹치지 않게 자른다.
     ⚠⚠ **첫날(시작 자금)은 빼고 센다.** 안 그러면 첫 창의 최고점이 늘 시작 자금이라
       「봉우리가 낮아진다」가 **공짜로 참**이 된다 — 잰 것이 아니라 정의가 그런 것이 된다.
       ⇒ ★ 첫날은 `start` 로 따로 들고, 봉우리는 **그 뒤로만** 센다. */
  const after0 = days.slice(1);
  const peaks = [];
  for (let i = 0; i < after0.length; i += RENT_CYCLE) {
    const win = after0.slice(i, i + RENT_CYCLE);
    if (!win.length) continue;
    const best = win.reduce((a, b) => (b.cash > a.cash ? b : a));
    peaks.push({ day: best.day, cash: best.cash });
  }
  /* ③ 고비 — **오르다 내려가 다시 오르는** 골. 마지막 0 은 골이 아니라 끝이다 */
  const dips = [];
  for (let i = 1; i < days.length - 1; i++) {
    const a = days[i - 1].cash, b = days[i].cash, c = days[i + 1].cash;
    if (b < a && b < c) {
      const last = dips[dips.length - 1];
      /* 톱니의 잔물결을 골로 세지 않는다 — 앞 골에서 열흘 안이면 같은 고비로 본다 */
      if (last && days[i].day - last.day < 10) { if (b < last.cash) { last.day = days[i].day; last.cash = b; } }
      else dips.push({ day: days[i].day, cash: b });
    }
  }
  /* ══ ⑤ ★★★ **무늬 잎이 몇 장까지 갔나** — 이사 자금의 «전부»가 여기서 나온다 ══════
     `tutorial.js:130` 이 못 박아 두었다: *"콩나물은 **버티는 수단이지 이사 자금이 아니다**.
     이사 자금은 **무늬 개체 하나를 팔아 한 번에** 만든다."*
     ⇒ ★ 그러니 **지갑이 내려가는 것은 설계**다. 물음은 「낮아지나」가 아니라 **「얼마나 빨리」**다.
     ⇒ ⇒ ★★ 그리고 **팔 물건이 여무느냐**가 먼저다:
       [Plan] 실측 — 하프문 3장 그루가 **1,830,000원**인데 이사비는 **2,000,000원**이다.
       ⇒ **최고로 키워 팔아도 170,000원이 모자란다.** 살림돈이 **남아 있을 때** 팔아야 닿는다.
     ⇒ ⇒ ⇒ 그래서 **「몇 장까지 갔나」와 「며칠에 갔나」를 같이** 낸다 —
       *"살림돈이 남아 있을 때 여물었나, 마른 뒤에 여물었나."* */
  let maxVarie = 0;
  const varieAt = [];                       // 무늬 잎이 처음 N 장이 된 날
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const v = Number.isFinite(d.varie) ? d.varie : null;
    if (v == null) continue;
    while (v > maxVarie) {
      maxVarie++;
      /* ★★ **팔 수 있었던 창** — 그 장수가 된 «뒤로» 지갑이 얼마까지 올랐나.
         [Plan] 실측: 하프문 3장 그루가 1,830,000 이고 이사비가 2,000,000 이라
         **살림돈이 170,000 남아 있을 때** 팔면 닿는다.
         ⇒ ★ 그러니 「여문 날의 지갑」만으로는 모자라다 — **여문 뒤에 «한 번이라도»
           그만큼 있었나**를 봐야 「팔 수 있었던 날이 있었나」가 나온다.
         ⚠ 170,000 을 여기 안 박는다 — 사람이 보고 재게 «수»만 낸다. */
      const rest = days.slice(i);
      const best = rest.reduce((a, b) => (b.cash > a.cash ? b : a));
      varieAt.push({ n: maxVarie, day: d.day, cash: d.cash,
                     afterBestDay: best.day, afterBestCash: best.cash });
    }
  }
  const last = days[days.length - 1];
  return {
    file: path.basename(file), seed: R.seed, lazy: R.lazy || 0, ended: R.ended,
    lastDay: last.day, start, over, peaks, dips, maxVarie, varieAt,
    harvests: last.harvests, sirus: last.sirus
  };
}

const runs = collect(process.argv.slice(2)).map(f => { try { return readRun(f); } catch { return null; } })
                                           .filter(Boolean);
if (!runs.length) { console.error('읽을 판이 없습니다'); process.exit(2); }

for (const r of runs) {
  console.log(`\n■ ${r.file} — 씨앗 ${r.seed}` + (r.lazy ? ` · 게으름 ${r.lazy}` : ' · 완벽한 사람') +
              ` · ${r.ended} · ${r.lastDay}일 · 수확 ${r.harvests} · 시루 ${r.sirus}`);
  /* ⑤ 가 제일 먼저다 — 이사 자금의 전부가 무늬 개체 하나에서 나온다(§⑤) */
  console.log(`  ⑤ 무늬 잎 최대 ${r.maxVarie}장` +
    (r.maxVarie >= 3 ? ' — ★ 하프문(3장)에 닿았다 · 팔 것이 여문다'
                     : ' — ⛔ 3장에 «안» 닿았다 · 팔 것이 «안» 여문다') +
    '');
  for (const v of r.varieAt)
    console.log(`     ${v.n}장 d${v.day} · 그날 지갑 ${v.cash.toLocaleString()}` +
      ` · 그 뒤 최고 d${v.afterBestDay} ${v.afterBestCash.toLocaleString()}`);
  if (r.maxVarie < 3) console.log(`     ⇒ ⛔ 3장에 안 닿았으니 **팔 수 있었던 날이 하루도 없다**`);
  /* ① 이 제일 먼저다 — 다섯 다 「아니오」면 그것으로 이미 답이다 */
  console.log(`  ① 시작 자금(${r.start.toLocaleString()}원)을 넘은 적 — ` +
    (r.over.length
      ? `★예 · ${r.over.length}일 · 제일 높았던 날 d${r.over.reduce((a, b) => b.cash > a.cash ? b : a).day} ` +
        `${r.over.reduce((a, b) => b.cash > a.cash ? b : a).cash.toLocaleString()}원`
      : '⛔아니오 — **첫날이 제일 부자다**'));
  console.log('  ② 봉우리 — ' + r.peaks.map(p => `d${p.day} ${p.cash.toLocaleString()}`).join(' → '));
  const down = r.peaks.every((p, i) => i === 0 || p.cash <= r.peaks[i - 1].cash);
  console.log('     ⇒ ' + (down ? '★ 줄곧 낮아진다 — 회복이 전보다 낮은 곳까지만 온다'
                                 : '한 번이라도 올라간 적이 있다'));
  console.log(`  ③ 고비 ${r.dips.length}번 — ` +
    (r.dips.length ? r.dips.map(d => `d${d.day} ${d.cash.toLocaleString()}`).join(' · ') : '없음'));
  /* ④ ★ **넷째 잎 날까지 살았나** — 그게 「팔 물건이 여물 기회가 «있기라도» 했나」다 */
  const alive = r.lastDay >= LEAF4_DAY;
  console.log(`  ④ 넷째 잎이 오는 날(d${LEAF4_DAY})까지 — ` +
    (alive ? `★ 살았다(d${r.lastDay}). 그때 무늬 ${r.maxVarie}장`
           : `⛔ 못 살았다 — d${r.lastDay} 에 끝. **${LEAF4_DAY - r.lastDay}일 모자람**`));
}

/* 여러 판이면 한눈에 — ⚠ 파산일 평균은 **안 낸다**(운이 섞인다 · [Plan]) */
if (runs.length > 1) {
  console.log('\n══ 한눈에 ══');
  console.log('  ⑤ 무늬 3장에 닿은 판 — ' +
    `${runs.filter(r => r.maxVarie >= 3).length}/${runs.length}` +
    '  (최대 장수: ' + runs.map(r => `씨앗${r.seed}:${r.maxVarie}`).join(' · ') + ')');
  console.log('  ① 시작 자금을 넘은 판 — ' +
    `${runs.filter(r => r.over.length).length}/${runs.length}`);
  console.log('  ② 봉우리가 줄곧 낮아진 판 — ' +
    `${runs.filter(r => r.peaks.every((p, i) => i === 0 || p.cash <= r.peaks[i - 1].cash)).length}/${runs.length}`);
  console.log('  ③ 고비 수 — ' + runs.map(r => `씨앗${r.seed}:${r.dips.length}`).join(' · '));
  console.log(`  ④ 넷째 잎 날(d${LEAF4_DAY})까지 산 판 — ` +
    `${runs.filter(r => r.lastDay >= LEAF4_DAY).length}/${runs.length}` +
    '  (' + runs.map(r => `씨앗${r.seed}:${r.lastDay}일`).join(' · ') + ')');
  console.log('  끝난 날 — ' + runs.map(r => `씨앗${r.seed}:${r.lastDay}일(${r.ended})`).join(' · '));
}
