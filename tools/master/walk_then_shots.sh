M=/c/Users/pc/AppData/Local/Temp/byeot-master; R=$1
T=$(cd "$(dirname "$0")" && pwd)   # 이 스크립트가 있는 폴더(저장소 tools/master) — 형제 도구는 여기서 찾는다
cd $M && bash $T/walkfinal.sh $R > walk_$R.out 2>&1; echo "walkfinal exit=$?"
bash $T/shots_probes.sh $R probe_d100a probe_d100b probe_d100_78 probe_d100_8a probe_d100_6 probe_d100_6a probe_minor3 probe_minor5 probe_minor5_10 probe_minor5_11 probe_minor5_15 probe_minor5_home probe_critic6_a > $M/shots_$R.out 2>&1; echo "shots exit=$?"
