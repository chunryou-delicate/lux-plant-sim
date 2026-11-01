# 사용: bash shots_probes.sh <R> <자 이름...>  — 고정 판 서버 9321 · OUT 을 켜고 자를 다시 돌려 사진을 남긴다
M=/c/Users/pc/AppData/Local/Temp/byeot-master; R=$1; shift; V=$M/pin_$R
T=$(cd "$(dirname "$0")" && pwd)   # 이 스크립트가 있는 폴더(저장소 tools/master) — 형제 도구는 여기서 찾는다
cd $V
python $T/serve_rev.py "$V" $R 9321 $M/serve_${R}_shots.log > $M/serve_${R}_shots.out 2>&1 &
SP=$!
for i in $(seq 1 40); do c=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9321/game.html); [ "$c" = 200 ] && break; sleep 0.5; done
echo "server http=$c"
export BYEOT_URL=http://127.0.0.1:9321 CDP_GL=gpu
for t in "$@"; do
  OUT=C:/Users/pc/AppData/Local/Temp/byeot-master/shots_$R/$t timeout 1500 node tools/$t.mjs > $M/${R}_shot_$t.log 2>&1; echo "$t exit=$? shots=$(ls $M/shots_$R/$t 2>/dev/null | wc -l)"; tail -1 $M/${R}_shot_$t.log | cut -c1-160
done
kill $SP; echo "server stopped"
