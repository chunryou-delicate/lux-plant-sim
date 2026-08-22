/* ============================================================
   tools/run_house_checks.mjs — **house 검사를 한 번에 돌린다**
   ------------------------------------------------------------
   왜 있나
     저장소에 `tools/test_*.mjs` 가 83개인데 **전체를 도는 자리가 없다.** 하나씩 손으로 돈다.
     ⇒ 새로 세운 검사는 **세운 사람만 돌린다.** 그 사람이 자리를 뜨면 **아무도 안 돈다.**
     2026-08-23 밤에 셋을 새로 세웠는데(`test_furn_clash` · `test_measured_fresh` ·
     `test_floorlight ⑤`) 그대로 두면 다음 사람이 있는 줄도 모른다.

   ⚠ **house 것만 돈다.** 83개 전부는 이 창 몫이 아니다 — 남의 검사를 여기서 돌리면
     남의 붉음을 내가 지고, 그러면 이 자를 아무도 안 본다.
     ⇒ 아래 목록은 **`docs/handoff/team-map.md` §② 세계 층**이 가진 것들이다.
     ⚠⚠ **닫힌 목록이 아니다.** house 검사를 새로 세우면 **이유와 함께** 여기 더해라.

   ⛔ **「알려진 붉음은 봐준다」를 넣지 마라.** 지금 셋이 붉은데 **그게 맞다** —
     전부 밸런스라 아침 결정이다(`docs/handoff/STATUS.md §house` 의 ⏸ 목록).
     여기서 초록으로 만들면 **고쳐진 것과 미룬 것을 못 가린다.**

     node tools/run_house_checks.mjs
     node tools/run_house_checks.mjs --quiet     결과 줄만
   ★ 브라우저가 필요한 것(`test_lampmove` 2·3부)은 BYEOT_URL 을 넘겨야 다 돈다.
     안 넘기면 그 부분을 건너뛴다 — 건너뛴 것도 아래에 적힌다.
============================================================ */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUIET = process.argv.includes('--quiet');

/* 줄마다 「왜 house 것인가」를 적는다 — 안 적으면 다음 사람이 모르고 지운다 */
const CHECKS = [
  ['test_floorlight.mjs',      '방 여섯의 조도 사다리 · 자리가 칸 한가운데인가 · 자리 이름이 안정한가'],
  ['test_furn_clash.mjs',      '방 데이터의 가구가 서로 박혀 있나 (furnitureFit 이 데이터를 안 본다)'],
  ['test_measured_fresh.mjs',  'measured 가 낡았나 — roomRev · 닿은 것 · 값이 실제로 다른가'],
  ['test_furn_size.mjs',       '가구 상판이 0.25 격자에 물렸나'],
  ['test_banjiha_profile.mjs', '반지하 정적 프로필 ↔ 라이브 조도가 같은가'],
  ['test_lampaim.mjs',         '식물등을 겨눴을 때 PPFD·DLI (얼린 표)'],
  ['test_lampmove.mjs',        '식물등 옮기기 · 2부 방뷰 계약 · 3부 화면의 그 손짓'],
  ['test_oneroom_room.mjs',    '원룸이 반지하보다 낫고 과하지 않은가 · 반지하 회귀']
];

const rows = [];
for (const [file, why] of CHECKS) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', file)],
                      { cwd: ROOT, encoding: 'utf8', timeout: 600000 });
  const out = ((r.stdout || '') + (r.stderr || ''));
  const last = out.trim().split('\n').filter(l => /PASS|FAIL|SKIP/.test(l)).pop() || '(출력 없음)';
  const skipped = /SKIP/.test(out);
  const okRun = r.status === 0 && !r.error;
  rows.push({ file, why, ok: okRun, line: last.trim(), skipped,
              died: !!r.error || r.status === null });
  if (!QUIET) {
    console.log((okRun ? '  ✔ ' : '  ✘ ') + file.padEnd(26) + last.trim());
    if (!okRun) for (const l of out.split('\n').filter(l => /^FAIL|^\s+✘/.test(l)).slice(0, 4))
      console.log('        ' + l.trim());
  }
}

const bad = rows.filter(r => !r.ok);
const skip = rows.filter(r => r.skipped);
console.log('');
console.log('house 검사 ' + rows.length + '개 · 초록 ' + (rows.length - bad.length) + ' · 붉음 ' + bad.length +
            (skip.length ? ' · 건너뜀 있음 ' + skip.length : ''));
if (skip.length && !process.env.BYEOT_URL)
  console.log('  ⚠ BYEOT_URL 을 안 넘겨 브라우저 부분을 건너뛴 검사가 있습니다: ' +
              skip.map(r => r.file).join(', '));
if (bad.length) {
  console.log('  붉은 것: ' + bad.map(r => r.file).join(' · '));
  console.log('  ⚠ 「알려진 붉음」인지 새로 깨진 것인지는 ' + '`' + 'docs/handoff/STATUS.md §house' + '`' +
              ' 의 ⏸ 목록과 견주십시오.');
  console.log('  ⛔ 여기에 봐주기 목록을 넣어 초록으로 만들지 마십시오 — 고쳐진 것과 미룬 것을 못 가립니다.');
}
process.exit(bad.length ? 1 : 0);
