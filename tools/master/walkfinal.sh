# 사용: bash tools/master/walkfinal.sh <커밋>   — node 검사 · dump · 크롬 걸음 · 옛 세이브(8b2c6f41 로 뜬 것)
export CDP_GL=gpu   # 10-31 박사님 «CPU 왤케» — 그래픽카드(d3d11 · RTX 3090)로. FAIL 이 나오면 그 검사만 CDP_GL 없이(swiftshader) 다시 돌려 가른다
M=/c/Users/pc/AppData/Local/Temp/byeot-master; R=$1; V=$M/pin_$R; MW=C:/Users/pc/AppData/Local/Temp/byeot-master
T=$(cd "$(dirname "$0")" && pwd)   # 이 스크립트가 있는 폴더(저장소 tools/master) — 형제 도구는 여기서 찾는다
REPO=/c/Users/pc/Desktop/빛식물/lux-plant-sim
[ -d "$V" ] || { mkdir -p "$V" && git -C "$REPO" archive $R data game.html plant_grow.html src tools vendor | tar -x -C "$V" && mkdir -p "$V/docs/handoff/img"; }
[ -e "$V/assets" ] || powershell -c "New-Item -ItemType Junction -Path '$(cygpath -w $V)\assets' -Target 'C:\Users\pc\Desktop\빛식물\lux-plant-sim\assets' | Out-Null"
echo "pin=$V assets=$( [ -f $V/assets/manifest.json ] && echo ok )"
cd "$V"
python $T/serve_rev.py "$V" $R 9321 $M/serve_$R.log > $M/serve_$R.out 2>&1 &
SP=$!
for i in $(seq 1 40); do c=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9321/game.html); [ "$c" = 200 ] && break; sleep 0.5; done
echo "server http=$c"
export BYEOT_URL=http://127.0.0.1:9321
echo "== node"
for t in test_ending_flow probe_oneroom_econ probe_lamp_when test_crop_seat test_save test_oneroom test_save_roundtrip test_first_play test_propagation test_quest test_quest_chip test_dialogue_coverage test_tutorial test_stamina test_elec test_resow_atomic test_pantrysale test_cropsale test_econ test_job_breed probe_crop_grams test_events_banjiha; do
  [ -f tools/$t.mjs ] || { echo "$t 없음"; continue; }
  timeout 600 node tools/$t.mjs > $M/${R}_$t.log 2>&1; echo "$t exit=$?"
done
echo "== dump"
mkdir -p $M/d_$R
for spec in 'switchW:3200' 'breedR:1300' 'careR:1300' 'shop71h:1300' 'shop45:1200'; do
  n=${spec%%:*}; d=${spec##*:}
  timeout 1500 node tools/probe_branches.mjs --one "{\"name\":\"$n\",\"seed\":\"g\",\"targets\":[5000000],\"days\":$d,\"dump\":\"$MW/d_$R/$n\"}" > $M/${R}_dump_$n.log 2>&1; echo "dump $n exit=$? files=$(ls $M/d_$R/$n 2>/dev/null | wc -l)"
done
echo "== 크롬 걸음"
mkdir -p $M/shots_$R
for pair in probe_switch_walk:switchW probe_breed_walk:breedR probe_care_walk:careR probe_species2_walk:shop71h probe_day_walk:shop45; do
  t=${pair%%:*}; n=${pair##*:}; mkdir -p $M/shots_$R/$t
  DUMP=$M/d_$R/$n OUTDIR=$M/shots_$R/$t timeout 1500 node tools/$t.mjs > $M/${R}_$t.log 2>&1; echo "$t exit=$?"; tail -1 $M/${R}_$t.log | cut -c1-160
done
mkdir -p $M/shots_$R/force5
CYCLES=3 OUTDIR=$M/shots_$R/force5 timeout 2400 node tools/probe_force5.mjs > $M/${R}_force5.log 2>&1; echo "force5 exit=$?"; grep "판정" -A6 $M/${R}_force5.log | head -7
for t in test_sellpopup test_questui test_guide_notes test_place_confirm test_lampswitch test_siru_pick test_siru_each test_multisiru test_dawn6 test_bagcell probe_lightview probe_b1_move probe_b2_unpack probe_d96_ev probe_d96_cards probe_m4_cam probe_m6_water probe_m10_spot probe_d99a probe_d99b probe_d99c probe_d99d probe_d99e probe_f_lamp_top test_quiet probe_questchain probe_d100a probe_d100b probe_d100_5 probe_d100_78 probe_d100_8a probe_d100_6 probe_d100_6a probe_minor3 probe_minor5 probe_cutting_ui probe_minor5_9 probe_minor5_10 probe_minor5_11 probe_minor5_14 probe_minor5_15 probe_minor5_15m probe_minor5_home probe_minor5_pot probe_critic6_a probe_critic6_b probe_ending_walk probe_houseC_furnlight; do
  [ -f tools/$t.mjs ] || { echo "$t 없음"; continue; }
  mkdir -p $M/shots_$R/$t; OUTDIR=$M/shots_$R/$t timeout 900 node tools/$t.mjs > $M/${R}_$t.log 2>&1; echo "$t exit=$?"; tail -1 $M/${R}_$t.log | cut -c1-120
done
echo "== 옛 세이브(8b2c6f41 코드로 뜸)"
O=$M/old_8b2c
if [ ! -d "$O" ] || [ -z "$(ls $O 2>/dev/null)" ]; then
  python $T/serve_rev.py $M/pin_8b2c6f41 8b2c6f41 9323 $M/serve_old8b2c.log > $M/serve_old8b2c.out 2>&1 &
  OP=$!
  for i in $(seq 1 40); do c2=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9323/game.html); [ "$c2" = 200 ] && break; sleep 0.5; done
  OLD_URL=http://127.0.0.1:9323 LABEL=8b2c OUT=$MW/old_8b2c timeout 1500 node tools/probe_old_save_make.mjs > $M/${R}_old_make.log 2>&1; echo "old_make exit=$? files=$(ls $O 2>/dev/null | wc -l)"
  kill $OP 2>/dev/null; sleep 1
fi
mkdir -p $M/shots_$R/old
OLD=$MW/old_8b2c OUTDIR=$M/shots_$R/old timeout 1500 node tools/probe_old_saves.mjs > $M/${R}_old_saves.log 2>&1; echo "old_saves exit=$?"; tail -2 $M/${R}_old_saves.log | cut -c1-160
kill $SP 2>/dev/null; sleep 1; echo "server stopped"
echo "untracked=$(grep -c UNTRACKED $M/serve_$R.log)"
echo "chrome 9xxx 남음: $(powershell -c "(Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -match 'headless' }).Count")"
