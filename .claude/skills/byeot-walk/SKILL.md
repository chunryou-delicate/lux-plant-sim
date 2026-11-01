---
name: byeot-walk
description: 볕 총괄 «끝 걸음» — 커밋 하나를 고정 복사본(git archive)으로 걸어 재는 절차. node 검사 · dump · 크롬 걸음 · force5 · 브라우저 묶음 · 옛 세이브 · 사진 재실행 · 멈춘 걸음 다시 · 사진 직접 보기. core/plan 이 게임 해시를 올렸을 때, 박사님께 «고쳤다»고 아뢰기 전, 비판 판을 띄우기 전에 쓴다.
---

# 끝 걸음 — 커밋 하나를 고정 판으로 걸어 잰다

작업 트리 하나를 여러 창이 쓰므로 «지금 작업 트리»로 재면 남의 미완료가 섞인다. 커밋 하나를 `git archive` 로 떠서(코드) 에셋만 작업 트리에서 빌려(junction) 잰다.

## 0. 미리 볼 것

- 빈 메모리 4GB 이상: `powershell -NoProfile -Command "[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB,1)"`
- 이 창이 띄운 헤드리스 크롬이 없어야 한다(창마다 하나). 남은 크롬은 부모 프로세스로 누구 것인지 가른다 — 남의 것은 건드리지 않는다.
- 포트 9321 이 비었나.
- 해시가 origin/main 에 있나: `git fetch -q origin && git log --oneline -3 origin/main`

## 1. 돌린다(백그라운드 · 약 2시간)

```bash
bash tools/master/walk_then_shots.sh <R>
```

- 일터는 `C:/Users/pc/AppData/Local/Temp/byeot-master/` 이다: `pin_<R>`(고정 복사본 · assets junction) · `walk_<R>.out` · `shots_<R>.out` · `<R>_<자>.log` · `shots_<R>/`.
- walkfinal 순서: node 22 → dump 5(probe_branches · 씨앗 g) → 긴 크롬 걸음 5(dump 를 실음) → force5 CYCLES=3 → 브라우저 묶음 → 옛 세이브(8b2c6f41 로 뜬 것).
- 그 뒤 shots_probes 가 `OUT=` 를 켜고 사진 자를 다시 돌린다.

## 2. 읽는다 — 줄마다 판정

| 줄 | 초록 |
|---|---|
| node `exit=0` 스물둘 | 다 0 |
| dump `files=N` | 0 이 아님 |
| 크롬 걸음 다섯 | `PASS` · exit=124 나 «멈춤»은 3절로 |
| force5 `★ 판정` 다섯 줄 | 다 OK · 손가락 끊김 0 · 마지노 안 |
| 브라우저 묶음 | exit=0 · 끝 줄 «다 통과/PASS» |
| 옛 세이브 | `probe_old_saves: PASS` |
| `untracked=0` · 남은 크롬 | 0 · 이 창 것 없음 |

## 3. 빨강 가르기 — 게임 탓인가, 자·판 탓인가

- **로그가 멈춤**(마지막 줄 뒤로 몇 분 안 늚 · `!!window.__rv` 600초): 판 탓 의심. `bash tools/master/rerun_stalled.sh <R>` 로 혼자 다시. 5분 멈추면 그 node 가 띄운 크롬만 CDP 로 닫고 넘어간다. 혼자 돌려 PASS 면 판 탓이다.
- **시트·카메라가 덜 멎은 때 누름**(첫 탭 y > 844 · 사진엔 시트가 미끄러지는 중): 자 시간 탓. `bash tools/master/shots_probes.sh <R> <자>` 로 혼자 다시. 또 빨강이면 core 에 자 기다림을 고쳐 달라고 한다.
- **exit 2 · `⛔ OUTDIR=`/`OUT=`**: 도구가 사진 폴더를 안 넘긴 것이다. 자가 시작도 안 했다. 초록이 아니다.
- **그 밖**: 게임 탓 후보다. 사진 · 재현 순서 · 자 이름 · 줄을 core 에 넘긴다. 같은 자를 작업 전 해시로도 돌려 «언제부터»를 붙이면 좋다.

## 4. 사진은 직접 본다

- 자가 초록이어도 사진에서 고장이 나온다(10-10 빈 진열대 · 11-01 경고 창 손가락). 새로 고친 자리 사진은 하나씩 Read 로 본다.
- 볼 것: 손가락이 짚는 것과 배너·할 일이 같은 말인가 · 글이 잘리거나 겹치나 · 못 하는 일을 누르라고 하나(그 행동 비용을 `src/game/stamina.js` ACT_COST 로 확인).

## 5. 끝

- 결과를 캠페인 문서 기록 줄에 적는다(CRLF — Python `newline=''`).
- 박사님께는 «잰 것 · 못 잰 것 · 따로 다시 돌린 것»을 나눠 아뢴다. 안 돈 검사는 초록이라 하지 않는다.
- ⛔ `pin_<R>` · 로그 · 사진 · 프로필은 지우지 않는다(박사님 직접 금지).

## 6. 새 자를 더할 때

- core 가 «회귀 목록에 더할 자»를 주면 `tools/master/walkfinal.sh` 브라우저 묶음 `for t in …` 줄에 넣는다.
- 사진을 남겨야 할 자는 `tools/master/walk_then_shots.sh` 의 shots 목록에도 넣는다.

## 고친 기록

| 날 | 실패 | 까닭 | 고친 줄 | 확인 |
|---|---|---|---|---|
| 11-01 | 걸음 중 `pin_*/assets` 연결이 사라짐 | Temp 쓸림(저장소 센스 의심) | 시험 앞 manifest.json 읽힘 확인 · 없으면 연결 다시 | ✓ |
| 11-01 | 도구(serve_rev.py)가 Temp 와 함께 사라짐 | Temp 쓸림 | keep 폴더 → 11-02 저장소 `tools/master/` 로 | 확인 전 |
| 11-02 | probe_houseC_furnlight exit 2 | 묶음이 OUTDIR 을 안 넘김 | 묶음 전체에 `OUTDIR=$M/shots_$R/$t` | 확인 전(OUTDIR 준 따로 돌림은 PASS · 고친 walkfinal 은 다음 걸음에서) |
| 11-02 | 긴 걸음 넷이 로그 멈춘 채 1500초 | 혼자 돌리니 넷 다 PASS(106~272초) → 판 탓(23:3x~01:00 · 원인 미상) | `rerun_stalled.sh`: 5분 멈춤 감시 + 그 node 의 크롬만 CDP close | ✓ 스크립트(02:18 다섯 PASS) · 멈춤 감시 자체는 아직 안 걸려 봄 |
