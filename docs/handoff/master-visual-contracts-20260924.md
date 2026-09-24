# 보이는 층 다시 짜기 — 지켜야 할 계약 (2026-09-24 밤)

다른 창이 점호 답으로 넘긴 것을 모았다. 빌드 중인 모든 에이전트는 이것을 어기면 안 된다.

## [house] claude-29 — 조도 엔진이 render3d 를 직접 부른다
조도 엔진(`src/game/light_adapter.js:15·16·19`)이 `buildHouse`(house.js) · `ppfdSum`·`aimVector`(lighting_sim.js) · `faintGrainTexture`(textures.js)를 부른다.
보이는 층을 바꿔도 아래 다섯은 같은 값이어야 한다.
1. `userData.size` — 가림 상자(occluders, house.js:821). GLB 로 바꿔도 **프리셋 크기** 그대로. GLB 바운딩 박스로 바꾸지 않는다
2. `userData.slots` — 자리(plantSlots, house.js:933). furniture_pastel.js §tierSlots 가 낸다
3. `userData.occIdx` — 자기 자리를 자기가 안 가리게 (house.js:820)
4. `lightRigs` pos/base — 등 발광점·노드 (house.js:860). lampFit 은 노드, PPFD 는 발광점
5. `userData.lampShade` 는 g 의 직접 자식 · `hangFromCeiling` (main.js·room_view 가 그렇게 찾는다)
- `lighting_sim.js` 는 조도 엔진이다. 손대지 않는다
- `scene.js sunLight.shadow.radius=4` 는 08-23 「볕 얼룩」을 고친 값이다(11 이면 어두운 바닥에 밝은 조각)
- 확인: `BYEOT_URL=http://localhost:8971 node tools/run_house_checks.mjs` ⇒ **기준 초록 7 · 붉음 2** [잰 것 · 2026-09-24 21:32 · HEAD 9e854d70 · v2 변경 «전»]: ✘ `test_floorlight` 7/9(①-3 skyViewK 선형 · ③-2 단계마다 남는 것) · ✘ `test_oneroom_room` 3/9(①-2 · ③ · ③-2 · ④ · ⑤) — 둘 다 08-30 원룸을 빈 방으로 비운 뒤 알려진 것. **판정은 개수가 아니라 칸 단위** — 이 목록 밖의 ✘ 가 나오면 v2 변경 탓이다. 기준 원본은 house 창 `$TEMP/house_baseline_2132.txt` (⚠ 처음 받은 「초록 8 · 붉음 1」은 원룸을 비우기 전의 낡은 수였다 — house 정정)
- `test_banjiha_profile` 이 붉으면 `gen_room_profile --write` 로 덮지 말 것(얼린 표가 두 벌) — house 창에 넘긴다

## [core] claude-1a — room_view 창구
- game.html 이 부르는 창구: `restingOn()`(game.html 11938·14368·15090) · `standUp()`(15091) · `floorPointAt()`(14751). 이름과 반환 모양을 바꾸면 앉기·눕기·낮잠 단추와 가구 끌어 놓기가 끊긴다
- 밖에서 쥐는 것: `worldToScreen` · `surfaceTopAt` · `characters().hipsY` · `leafSkinsInRoom`(그루가 없으면 null)
- 앉는 높이는 박은 수가 아니다. 클립이 끝난 자세의 골반 높이 hipsLocal 을 재서 «뿌리 = 좌석 면 − hipsLocal» (room_view 8873 부근, ACT_SPEC 8252 sit/sleep hold). 이 방식은 남긴다. 잰 값: 골반 0.465 = 좌석 0.465
- 다 만든 뒤 돌릴 자: `node tools/probe_nap.mjs`(16/16) · `probe_movemarks.mjs` · `probe_zoom.mjs`(6/6) · `test_skin_room_matches_zoom.mjs`(PASS). 넷 다 지금 초록

- ⚠ 위 줄 번호(11938·8873 등)는 2026-09-24 21시 기준이다. game.html·room_view.js 를 고치면 밀린다 — 찾을 때는 이름(`restingOn` · `ACT_SPEC` · `hipsLocal`)으로 찾는다 [core 보충]

## [char] claude-44 — 새 GLB 를 크레딧 없이 재는 자
- `strip_stray_parts.py <glb> --count` 덩어리 수 · `check_skeleton_match.py` 24본 클립이 붙는지 · `shot_body_still.mjs` 네 각도
- 원화 넷을 다 열어 볼 것. 견줄 그림은 같은 자·같은 음영으로

## 아트 기준
`assets/gen/v2_room/style_keyframe_a.png` — 따뜻한 디오라마. 노란 꽃무늬 벽지 · 노란 장판 · 높은 창의 아침 빛 · 생활 소품이 꽉 찬 반지하.
