# 보이는 층 v2 — 결과 (2026-09-25 03시)

박사님 지시: 「울트라코드로 모두 진행 · 새벽 3시까지」 · 기획 docs/handoff/master-visual-plan-20260924.md · 계약 master-visual-contracts-20260924.md

## 전후
- 데스크톱: docs/handoff/img/v2_before_after_desk.png
- 폰: docs/handoff/img/v2_before_after_phone.png
- 원본 캡처: tools/_out/playshot/v2_before_{desk,phone} · v2_after_{desk,phone} (둘 다 실제 게임을 playshot 으로 1일 눌러 찍음)

## 바뀐 것 (전부 주소 뒤 `?v2=0` 으로 한꺼번에 끈다)
| 갈래 | 새 파일 | 끄기 |
|---|---|---|
| 후처리 — 따뜻한 색보정·가장자리 어둡게·등/창 번짐·FXAA, 데스크톱은 그늘 모서리(SSAO)+MSAA | src/render3d/postfx.js | `?v2fx=0` |
| 창빛 기둥·먼지·등 달무리 — 해 방향 따라 움직이고 밤엔 꺼짐 | src/render3d/atmosphere.js | `?v2atm=0` |
| 겉감 — 노란 꽃무늬 벽지·창 밑 물 얼룩·걸레받이·노란 장판·시멘트 천장 | src/render3d/room_materials.js | `?v2mat=0` |
| 가구 옷 입히기(침대·책상·의자·서랍장·협탁) + 소품(건조대·난방기·배낭+신발·쓰레기봉투 등) | src/render3d/furniture_dress.js | `?v2furn=0` |
| 주인공 교체 — 새 치비 1벌, 클립 8(걷기·서기·앉기·눕기·졸기·쪼그려 앉기·손 흔들기·환호) | src/game/v2_hero.js · assets/v2/char/hero.glb | `?v2hero=0` |
| 카메라 연출(대화 때 10% 다가감, 물·거두기 때 살짝 밀기) + 반지하 방 소리(냉장고 웅·창 너머 발소리·밤비, ♪ 따라감) | src/game/camera_moves.js · src/game/ambience.js | `?v2cam=0` · `?v2amb=0` |

지킨 것: 가구는 원래 상자를 «보이지 않는 판정용»으로 남기고 새 3D 를 층 1(광선 안 맞음)에 얹었다 — 화분 자리·격자·앉는 높이·조도 계산은 원래 상자를 그대로 쓴다. 검토 6건 모두 계약 위반 0.

합치기 뒤 검토 반영: 번짐 낮춤(밝은 장판이 하얗게 뜨던 것) · 러그(흰 테두리 사진)와 빨래 바구니(책상 발치 삐져나옴) 뺌 · 천장등 달무리 낮춤 · 냉장고 소리 절반.

## 검사 — 기준선(합치기 전, 같은 밤) 과 칸 단위로
| 검사 | 전 | 후 | 판정 |
|---|---|---|---|
| probe_nap | 16/16 | rc0 | 초록 |
| probe_movemarks | rc0 | rc0 | 초록 |
| test_skin_room_matches_zoom | PASS | PASS | 초록 |
| test_place_confirm | rc0 | rc0 | 초록 |
| test_siru_pick | ✘ 자리 null | ✘ 같은 판정 | 원래 붉음 |
| probe_zoom | ✘ ② ③ | ✘ ② ③ ⑤ | ⚠ ⑤ 새로 붉음 — 아래 |
| test_guide_notes | 33/33 | 32/33 → 단독 재실행 33/33 | 초록(첫 판은 부하 탓) |
| run_house_checks | 초록 7 · 붉음 2 | (아래 보고에 적는다) | |
| test_perf_budget | 5/1 (부하) | rc0 (6/6) | 초록 |

⚠ 이 밤 기계가 계속 과부하였다(빌더 6개가 크롬을 동시에 돌림). 파이썬 서버(tools/serve.py)가 부하 속에서 연결을 거절해 첫 검사 판 다섯이 «방이 안 떴다»로 떨어졌고, 노드 정적 서버로 다시 돌린 값만 위에 적었다.
⚠ guide_notes ⑤-1 은 단독 재실행에서 통과했다(부하 탓). probe_zoom ⑤ 는 원인을 못 가렸다. game.html 변경은 소리·카메라 연결 셋뿐이고 배치는 안 건드렸다. 아침에 [core] 창이 조용한 기계에서 `?v2=0` 과 견줘 다시 잰다.

## 남은 것
- 주인공 서기 자세가 팔을 벌린 A자에 가깝다(Meshy 기본 Idle). 어깨 키를 내리거나 다른 idle 클립(Idle_02~15)으로 바꾼다
- 러그: 위에서 본 알파 있는 그림을 새로 뽑아야 한다
- 소품 면 수(난방기 5.6만·건조대 4.2만)를 5~10k 로 더 줄인다 · 폰 성능 실측
- 데스크톱 그늘 모서리(SSAO) 는 스위프트셰이더에서만 봤다
- 환경음은 귀로 못 들었다(헤드리스). 폰 스피커로 한 번 듣고 크기를 정한다
- 스토리·튜토·초기 가이드·몬스테라 개선은 박사님 지시대로 «앞에 것부터» — 이 뒤에 한다. 당사자 창 의견은 master-story-inputs-20260925.md
