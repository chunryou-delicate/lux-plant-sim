# 사용: bash tools/master/rerun_stalled.sh <커밋>  — 끝 걸음에서 멈춘 긴 크롬 걸음 넷 + houseC 만 따로 다시(11-02 처음 씀 · 출력 꼬리 _re4)
# 멈춤 감시: 로그가 STALL 초 동안 안 늘면 «멈춤»으로 적고 끔 · 전체 상한 CAP 초
M=/c/Users/pc/AppData/Local/Temp/byeot-master; R=$1; V=$M/pin_$R
T=$(cd "$(dirname "$0")" && pwd)   # 이 스크립트가 있는 폴더(저장소 tools/master) — 형제 도구는 여기서 찾는다
STALL=${STALL:-300}; CAP=${CAP:-2400}
[ -f $V/assets/manifest.json ] || { echo "assets 연결 없음 — 멈춤"; exit 3; }
cd "$V"
python $T/serve_rev.py "$V" $R 9321 $M/serve_${R}_re4.log > $M/serve_${R}_re4.out 2>&1 &
SP=$!
for i in $(seq 1 40); do c=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9321/game.html); [ "$c" = 200 ] && break; sleep 0.5; done
echo "server http=$c"
export BYEOT_URL=http://127.0.0.1:9321 CDP_GL=gpu
close_mine() {  # $1=node 의 MSYS pid — 그 node 가 띄운 크롬(부모 = 그 node)만 CDP Browser.close · 밖에서 node 를 죽이면 test_cdp 의 exit 길이 안 돈다
  local wp=$(cat /proc/$1/winpid 2>/dev/null); [ -n "$wp" ] || return
  for port in $(powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='chrome.exe' and ParentProcessId=$wp\" | ForEach-Object { if (\$_.CommandLine -match '--remote-debugging-port=(\d+)') { \$Matches[1] } }"); do
    node $T/cdp_close.mjs ${port//$'\r'/}
  done
}
watch_run() {  # $1=이름 $2=로그 · 나머지=명령
  local name=$1 log=$2; shift 2
  local t0=$(date +%s) last=0 lastchg=$(date +%s)
  "$@" > "$log" 2>&1 &
  local P=$!
  while kill -0 $P 2>/dev/null; do
    sleep 15
    local now=$(date +%s) sz=$(stat -c %s "$log" 2>/dev/null || echo 0)
    if [ "$sz" != "$last" ]; then last=$sz; lastchg=$now; fi
    if [ $((now - lastchg)) -ge $STALL ]; then echo "$name 멈춤 — 로그 ${STALL}초 안 늚 ($(date +%H:%M:%S) · 마지막 줄 아래)"; tail -1 "$log" | cut -c1-160; close_mine $P; kill $P 2>/dev/null; wait $P 2>/dev/null; return 99; fi
    if [ $((now - t0)) -ge $CAP ]; then echo "$name 상한 ${CAP}초"; close_mine $P; kill $P 2>/dev/null; wait $P 2>/dev/null; return 124; fi
  done
  wait $P; local rc=$?
  echo "$name exit=$rc ($(date +%H:%M:%S) · $(( $(date +%s) - t0 ))초)"; tail -1 "$log" | cut -c1-160
  return $rc
}
for pair in probe_breed_walk:breedR probe_care_walk:careR probe_species2_walk:shop71h probe_day_walk:shop45; do
  t=${pair%%:*}; n=${pair##*:}; mkdir -p $M/shots_${R}_re4/$t
  DUMP=$M/d_$R/$n OUTDIR=$M/shots_${R}_re4/$t watch_run $t $M/${R}_re4_$t.log node tools/$t.mjs
done
mkdir -p $M/shots_${R}_re4/probe_houseC_furnlight
OUTDIR=$M/shots_${R}_re4/probe_houseC_furnlight watch_run probe_houseC_furnlight $M/${R}_re4_probe_houseC_furnlight.log node tools/probe_houseC_furnlight.mjs
kill $SP 2>/dev/null; sleep 1; echo "untracked=$(grep -c UNTRACKED $M/serve_${R}_re4.log)"
