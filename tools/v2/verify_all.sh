#!/bin/bash
# 보이는 층 v2 — 합친 뒤 돌리는 검사 묶음. 계약 문서(docs/handoff/master-visual-contracts-20260924.md)의 자를 한 번에 돌린다.
# 쓰기: bash tools/v2/verify_all.sh PORT OUTDIR
#   PORT   이 검사 전용 서버 포트(serve.py 를 여기서 띄우고 끝나면 내린다)
#   OUTDIR 결과 로그를 쓸 곳
# ⚠ run_house_checks 기준(2026-09-24 21:32 실측): 초록 7 · 붉음 2 — floorlight ①-3·③-2 · oneroom_room ①-2·③·③-2·④·⑤. 칸 단위로 견준다.
PORT=${1:-8990}; OUT=${2:-tools/_out/v2_verify}
cd "$(dirname "$0")/../.." || exit 1
mkdir -p "$OUT"
python tools/serve.py "$PORT" > "$OUT/serve.log" 2>&1 &
SP=$!
sleep 2
export BYEOT_URL=http://localhost:$PORT
run() { local n="$1"; shift; local t0=$(date +%s); timeout 900 "$@" > "$OUT/$n.log" 2>&1; local rc=$?; echo "$n rc=$rc $(( $(date +%s) - t0 ))s | $(grep -aE 'PASS|FAIL|✔|✘|[0-9]+/[0-9]+' "$OUT/$n.log" | tail -1 | cut -c1-140)"; }
run house_checks    node tools/run_house_checks.mjs
run probe_nap       node tools/probe_nap.mjs
run probe_movemarks node tools/probe_movemarks.mjs
run probe_zoom      node tools/probe_zoom.mjs
run skin_zoom       node tools/test_skin_room_matches_zoom.mjs
run snap            node tools/test_snap.mjs
run furn_size       node tools/test_furn_size.mjs
run place_grid      node tools/test_place_grid.mjs
run uiwire          node tools/test_uiwire.mjs
run place_confirm   node tools/test_place_confirm.mjs
run siru_pick       node tools/test_siru_pick.mjs
run guide_notes     node tools/test_guide_notes.mjs
run sfx             node tools/test_sfx.mjs
run perf_budget     node tools/test_perf_budget.mjs
run first_play      node tools/test_first_play.mjs
kill $SP 2>/dev/null
echo "done → $OUT"
