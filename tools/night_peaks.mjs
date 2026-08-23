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
  const last = days[days.length - 1];
  return {
    file: path.basename(file), seed: R.seed, lazy: R.lazy || 0, ended: R.ended,
    lastDay: last.day, start, over, peaks, dips,
    harvests: last.harvests, sirus: last.sirus
  };
}

const runs = collect(process.argv.slice(2)).map(f => { try { return readRun(f); } catch { return null; } })
                                           .filter(Boolean);
if (!runs.length) { console.error('읽을 판이 없습니다'); process.exit(2); }

for (const r of runs) {
  console.log(`\n■ ${r.file} — 씨앗 ${r.seed}` + (r.lazy ? ` · 게으름 ${r.lazy}` : ' · 완벽한 사람') +
              ` · ${r.ended} · ${r.lastDay}일 · 수확 ${r.harvests} · 시루 ${r.sirus}`);
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
}

/* 여러 판이면 한눈에 — ⚠ 파산일 평균은 **안 낸다**(운이 섞인다 · [Plan]) */
if (runs.length > 1) {
  console.log('\n══ 한눈에 ══');
  console.log('  ① 시작 자금을 넘은 판 — ' +
    `${runs.filter(r => r.over.length).length}/${runs.length}`);
  console.log('  ② 봉우리가 줄곧 낮아진 판 — ' +
    `${runs.filter(r => r.peaks.every((p, i) => i === 0 || p.cash <= r.peaks[i - 1].cash)).length}/${runs.length}`);
  console.log('  ③ 고비 수 — ' + runs.map(r => `씨앗${r.seed}:${r.dips.length}`).join(' · '));
  console.log('  끝난 날 — ' + runs.map(r => `씨앗${r.seed}:${r.lastDay}일(${r.ended})`).join(' · '));
}
