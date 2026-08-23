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
  /* ══ ⚠ ① 을 고쳤다 — **「첫 기록의 지갑」으로 재면 판마다 달라진다** ═══════════════
     씨앗 1 은 첫 기록이 d0(1,500,000) 이고 씨앗 2 는 d2(1,290,000) 였다.
     ⇒ **같은 물음에 판마다 다른 잣대**를 댄 셈이라 가로질러 못 견줬다.
     ⇒ ★ 그래서 「시작 자금을 넘었나」가 아니라 **「지갑의 최고점이 언제였나」**로 묻는다.
       앞쪽(열흘 안)에 있으면 **첫날이 제일 부자**라는 뜻이고, 그것이 원래 재려던 것이다.
     ⚠ 판정은 안 바뀐다 — 씨앗 1·2 는 어느 잣대로 재도 못 넘었다. **잣대만 하나로 만든다.** */
  const best = days.reduce((a, b) => (b.cash > a.cash ? b : a));
  const start = best.cash;
  const earlyBest = best.day <= 10;
  /* ② 봉우리 — 주기마다의 최고점. 창을 겹치지 않게 자른다.
     ⚠⚠ **첫날(시작 자금)은 빼고 센다.** 안 그러면 첫 창의 최고점이 늘 시작 자금이라
       「봉우리가 낮아진다」가 **공짜로 참**이 된다 — 잰 것이 아니라 정의가 그런 것이 된다.
       ⇒ ★ 첫날은 `start` 로 따로 들고, 봉우리는 **그 뒤로만** 센다. */
  /* ⚠ ② 도 고쳤다 — **고정 창(30일)으로 자르면 «자르는 자리»를 탄다.**
     씨앗 2 는 d91 500,000 과 d92 486,000 이 **둘 다 봉우리로 잡혀** 그 사이가 내림으로 보였다.
     ⇒ ★ 판이 다른 것이 아니라 **자가 그런 것**이었다.
     ⇒ 그래서 골과 같은 방식으로 **동네 최고점**을 찾고, 스무 날 안이면 같은 봉우리로 본다.
     ⚠⚠ **그러면 봉우리가 적게 잡힌다** — 줄곧 내려가는 줄에는 동네 최고점이 «거의 없다».
       ⇒ ★ 그러니 ②는 **「몇 개나 잡혔나」로 읽지 마라.** 잡힌 것이 적다는 것 자체가
         「오르내리지 않고 내려가기만 한다」는 뜻이다. **①·④ 가 이 표의 뼈대**이고 ②는 곁이다. */
  const after0 = days.slice(1);
  const peaks = [];
  for (let i = 1; i < after0.length - 1; i++) {
    const a = after0[i - 1].cash, b = after0[i].cash, c = after0[i + 1].cash;
    /* ⚠ 지갑이 0 인 날은 봉우리가 아니다 — 죽고 나서 평평해진 구간이라
       `b >= a && b >= c` 에 걸려 «0원 봉우리»가 잡혔다(씨앗 2 의 d130). */
    if (b > 0 && b >= a && b >= c) {
      const lastP = peaks[peaks.length - 1];
      if (lastP && after0[i].day - lastP.day < 20) { if (b > lastP.cash) { lastP.day = after0[i].day; lastP.cash = b; } }
      else peaks.push({ day: after0[i].day, cash: b });
    }
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
  /* ══ ⑥ ★★★ **흑자로 돌아선 날 — 「실측한 본전 시루 수」** (2026-08-23) ══════════
     ------------------------------------------------------------------
     퀘스트 `siru16` 이 **"열여섯이면 버틴다 · 여기서부터 하루가 마이너스에서 플러스로 돈다"**
     라고 «가르친다». 그 말이 맞는지 재는 자다. 값(`FIRST_PLAY_RULES`)으로 셈하면 **약 25개**가
     나오는데, 셈과 견줄 수 있는 것은 **실제로 돌아선 날의 시루 수** 하나뿐이다.

     ⚠⚠ **두 잣대를 «같이» 낸다. 하나로는 못 잰다.**
       ㉮ **이레 내리 오른 첫 날** — 총괄이 물은 그 잣대다. 눈에 보이는 「돌아섬」이다.
          ⚠ 그런데 월세가 서른 날마다 20만 원씩 «한 번에» 빠진다. 그 앞뒤로는 이레가 안 찬다.
       ㉯ **서른 날 벌이가 처음 플러스가 된 날** — 월세 한 주기를 통째로 담는 창이라
          **월세 덩어리에 안 흔들린다.** 「본전」이라는 말에는 이쪽이 더 가깝다.
     ⇒ ★ 둘이 어긋나면 **㉯를 믿고 ㉮는 곁으로 읽어라.** 어긋나는 것 자체가 「월세가
       덩어리로 온다」는 뜻이고, 그것도 판에 대해 말해 주는 값이다. */
  let up7 = null;
  for (let i = 1; i + 6 < days.length; i++) {
    let ok = true;
    for (let k = 0; k < 7; k++) if (!(days[i + k].cash > days[i + k - 1].cash)) { ok = false; break; }
    if (ok) { up7 = days[i]; break; }
  }
  /* ⚠⚠⚠ **덩어리 수입이 든 창은 «세지 않는다».** 처음 붙였을 때 씨앗 3 이
     「d91 에 서른 날 벌이가 플러스 · 시루 15개」로 나왔는데 — **그건 벌이가 아니라
     구제금(`reliefWon` 500,000)**이었다. `did` 에 `pop:relief 1` 이 그대로 있었고
     d91 하루에만 +351,701 이 들어왔다. ⇒ ★ 하마터면 **「본전은 15개」**라고 낼 뻔했다.
     ⇒ 그래서 **하루에 20만 원 넘게 들어온 날**은 덩어리로 보고 그 날이 든 창을 건너뛴다.
       (구제금 50만 · 그루 판매 백만 대 — 둘 다 「시루가 벌어들인 것」이 아니다.
        시루로 버는 것은 한 판 3,500원짜리라 20만을 하루에 못 넘는다)
     ⚠ 건너뛴 날은 **반드시 찍는다.** 안 찍으면 「그 구간이 원래 없었다」로 읽힌다. */
  const LUMP = 200000;
  const lumpDays = [];
  for (let i = 1; i < days.length; i++)
    if (days[i].cash - days[i - 1].cash >= LUMP) lumpDays.push(days[i].day);
  const hasLump = (a, b) => lumpDays.some(d => d > a && d <= b);
  let win30 = null;
  for (let i = 0; i + RENT_CYCLE < days.length; i++) {
    const a = days[i], b = days[i + RENT_CYCLE];
    if (hasLump(a.day, b.day)) continue;
    if (b.cash > a.cash) { win30 = { at: b, from: a }; break; }
  }
  const last = days[days.length - 1];
  return {
    file: path.basename(file), seed: R.seed, lazy: R.lazy || 0, ended: R.ended,
    lastDay: last.day, start, bestDay: best.day, earlyBest, peaks, dips, maxVarie, varieAt,
    harvests: last.harvests, sirus: last.sirus, up7, win30, lumpDays
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
  console.log(`  ① 지갑의 최고점 — d${r.bestDay} ${r.start.toLocaleString()}원` +
    (r.earlyBest ? '  ⇒ ⛔ **첫날이 제일 부자다**(열흘 안) — 그 뒤로 한 번도 못 넘었다'
                 : '  ⇒ ★ 중간에 더 높이 올라간 적이 있다'));
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

  /* ⑥ ★★★ 흑자로 돌아선 날 — **그 날의 시루 수가 「실측한 본전 수」다** */
  const S16 = 16;                      /* 퀘스트 siru16 이 가르치는 수 — 견주기만 한다 */
  if (!r.up7 && !r.win30) {
    console.log('  ⑥ 흑자로 돌아선 날 — ⛔ **없다.** 끝까지 한 번도 안 돌아섰다');
    if (r.lumpDays && r.lumpDays.length)
      console.log(`     ⚠ 덩어리 수입이 든 날은 뺐다 — ${r.lumpDays.map(d => 'd' + d).join(' · ')} ` +
                  '(구제금·그루 판매 — 시루가 번 것이 아니다)');

  } else {
    if (r.win30) {
      const n = r.win30.at.sirus;
      console.log(`  ⑥ 서른 날 벌이가 처음 플러스 — d${r.win30.at.day} · 그때 시루 **${n}개** ` +
        `(d${r.win30.from.day} ${r.win30.from.cash.toLocaleString()} → ${r.win30.at.cash.toLocaleString()})`);
      console.log(`     ⇒ ★ **실측한 본전 수 = ${n}개** — 퀘스트가 가르치는 ${S16}개와 ` +
        (n === S16 ? '**같다**' : `**${Math.abs(n - S16)}개 ${n > S16 ? '많다' : '적다'}** ` +
                                  `⇒ ⚠ 게임이 «틀린 것을 가르치고» 있다`));
    } else {
      console.log('  ⑥ 서른 날 벌이 — ⛔ 한 번도 플러스가 안 됐다');
    }
    if (r.lumpDays && r.lumpDays.length)
      console.log(`     ⚠ 덩어리 수입이 든 날은 뺐다 — ${r.lumpDays.map(d => 'd' + d).join(' · ')} ` +
                  '(구제금·그루 판매 — 시루가 번 것이 아니다)');
    if (r.up7) console.log(`     (곁 · 이레 내리 오른 첫 날 — d${r.up7.day} · 그때 시루 ${r.up7.sirus}개)`);
    else       console.log('     (곁 · 이레 내리 오른 날은 없다 — 월세가 서른 날마다 덩어리로 온다)');
  }
}

/* 여러 판이면 한눈에 — ⚠ 파산일 평균은 **안 낸다**(운이 섞인다 · [Plan]) */
if (runs.length > 1) {
  console.log('\n══ 한눈에 ══');
  console.log('  ⑤ 무늬 3장에 닿은 판 — ' +
    `${runs.filter(r => r.maxVarie >= 3).length}/${runs.length}` +
    '  (최대 장수: ' + runs.map(r => `씨앗${r.seed}:${r.maxVarie}`).join(' · ') + ')');
  console.log('  ① 첫날이 제일 부자였던 판 — ' +
    `${runs.filter(r => r.earlyBest).length}/${runs.length}`);
  console.log('  ② 봉우리가 줄곧 낮아진 판 — ' +
    `${runs.filter(r => r.peaks.every((p, i) => i === 0 || p.cash <= r.peaks[i - 1].cash)).length}/${runs.length}`);
  console.log('  ③ 고비 수 — ' + runs.map(r => `씨앗${r.seed}:${r.dips.length}`).join(' · '));
  console.log(`  ④ 넷째 잎 날(d${LEAF4_DAY})까지 산 판 — ` +
    `${runs.filter(r => r.lastDay >= LEAF4_DAY).length}/${runs.length}` +
    '  (' + runs.map(r => `씨앗${r.seed}:${r.lastDay}일`).join(' · ') + ')');
  console.log('  끝난 날 — ' + runs.map(r => `씨앗${r.seed}:${r.lastDay}일(${r.ended})`).join(' · '));
}
