# Meshy 크레딧 쓰기 — [house] 주문표 (2026-10-09)

> **승인됨** (총괄 11:10): 박사님이 «다 쓰기 안»을 고르셨고 «앞으로 만들어야 되는 것까지 싹 — 몬스테라 잎 모양 이상한 것이라든지 다른 식물 모듈들»을 덧붙이셨다.
> 잔액 2,009 를 **house 약 1,000** · leaf(몬스테라 잎 고침 + 다른 식물 모듈) 약 780 · char(긴 생머리 주인공 + 클립 + 계절 옷) 약 170 으로 나눈다.
> ⛔ **크레딧을 쓰는 호출은 총괄이 돌린다.** house 는 이 표를 쓰고, 받은 GLB 를 게임에 잇는다(크레딧 0).
> 기계로 읽을 판: **`docs/handoff/meshy-order-house-20261009.json`** — 점마다 두 호출의 인자 그대로(프롬프트 600자 · 참조 그림 있음 · 이미 있는 파일 안 덮음을 거쳐 냈다).

## 어제 표에서 바로잡는 것

1. **한 점 44 → 39.** 면 줄이기는 `meshy_image_to_3d` 안의 `should_remesh` + `target_polycount` 로 건다. 규칙표에 덧값이 없다. 따로 `meshy_remesh`(5)를 돌릴 까닭이 없다.
2. **«매트리스 — 낮잠·눕기»는 틀렸다.** 앉기·눕기 단추는 프리셋 type 이 `bed`·`chair` 일 때만 뜬다(game.html `restType`). 매트리스·소파는 **그림만** 된다. 눕기·앉기를 붙이려면 core 한 줄 + plan 문안이 필요하다 — 따로 정할 일이다.
3. **«스툴 — 화분 받침»** — 스툴은 자리(slots)가 없다. 예비로 내렸다.
4. **«원룸 바닥은 안 자라니 올려 주는 가구가 손잡이»는 반만 맞다.** 쟀다(빈 원룸 · real · 몬스테라 자람 2.7):

   | 어디 | 높이 0.10 | 0.62 | 0.80 | 1.05 |
   |---|---|---|---|---|
   | 창 가운데 앞(x 0.5 · z −2.30) 여름 등0 / 등3 | 0.7 / 1.7 | **3.0** / 4.5 | **3.7** / 5.4 | 2.4 / 4.7 |
   | 같은 자리 겨울 등0 / 등3 | 0.3 / 1.2 | 1.1 / 2.6 | 1.4 / **3.1** | 0.9 / **3.2** |
   | 창 앞이지만 벽에서 0.45m(z −2.05) 여름 등0 | 1.2 | 2.4 | 2.2 | 1.2 |
   | 창 폭 밖(x −1.5 · 2.0) 여름 등0 | 0.1~0.5 | 0.2~0.8 | 0.2~0.8 | 0.1~0.8 |

   (뒷벽 z −2.50 · 창 x −0.7~1.7 · 아랫변 0.775)
   ⇒ 올리는 가구는 **창에 바짝(벽에서 0.2m) · 0.6~0.8m 높이**일 때만 여름에 등 없이 자란다. 벽에서 0.45m 만 떨어져도 안 자란다. 겨울엔 등과 같이 가야 한다. 창 폭 밖에서는 높이를 올려도 안 자란다 — **자리(창 앞)가 높이보다 먼저다.**
   그래서 13번 큐브 수납장(윗면 0.78 ≈ 원룸 창 아랫변 0.775)을 B 에서 골랐다 — 창 앞 벽에 붙이면 윗면이 창턱 높이가 된다(창턱 받침 `oneroom-sill` 과 겹치는지는 이을 때 잰다).

## 값 · 몫

| | 점 | 크레딧 |
|---|---|---|
| 본 (A 10 + B 7) | 17 | 17 × 39 = **663** |
| 다시 뽑기 30 % | | **199** (원화 다시 9 · 3D 다시 30) |
| 소계 | | **862** |
| 예비 (다시 뽑기가 남을 때만 · 이 차례로) | 3 | 117 |
| 다 하면 | 20 | **979** |

## 돌리는 법 — 점마다 두 호출

1. **원화** `meshy_image_to_image` — `ai_model: "nano-banana-pro"` · `reference_file_paths: [style_keyframe_a.png, 표의 «둘째 참조»]` · `prompt: 앞머리 + EN` — **9**
   - 넘기기 전에 그림을 본다(넷): ① 물건 하나만 ② 바닥판·그림자판·액자가 없다 — char 가 겪었다: Meshy 가 그림을 «액자에 든 그림»으로 읽고 액자째 구웠다(`char-bodybase-2.md`) ③ 단 수·단 높이 비율이 표와 맞다 ④ 앞면이 왼쪽 아래를 본다.
   - 어긋나면 **여기서** 다시 뽑는다(9) — 3D 를 다시 뽑는 것(30)보다 싸다.
2. **3D** `meshy_image_to_3d` — `input_task_id: <원화 task>` · `ai_model: "meshy-7.1"` · `should_texture: true` · `texture_resolution: "2k"` · `enable_pbr: false` · `should_remesh: true` · `target_polycount: 표의 면 수` · `topology: "triangle"` · `target_formats: ["glb"]` — **30**
   - 면 수는 지금 v2 가구(4.8천~1.5만 면)에 맞췄다.
3. **저장** (박사님 규칙 — 받으면 바로): 원화 `assets/gen/v2_furn/c_<이름>.png` · 3D `assets/gen/v2_furn/raw_<이름>.glb`(+ base_color) · task_id 는 `assets/gen/v2_tasks.json` 의 `"house_20261009"` · 크레딧은 `assets/manifest.json` `_credit_log` 에 한 줄.
   - 14번 책장만 이름이 `bookshelf` 다 — `c_shelf.png`·`assets/v2/furniture/shelf.glb` 는 이미 있다(에타제르 것). 안 덮는다.
4. **차례**: 표의 # 차례로. 9번(원룸 창)을 받으면 house 가 바로 틀 두께를 잰다 → 넘어야 18번(반지하 창)을 돌린다.

## 주문표

| # | 안 | 프리셋 | 무엇 | 크기 w×d×h (m) | 단 · 높이 | 게임에서 | 참조 그림(둘째) | 면 수 | 받을 경로 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | A | `plant_step_3` | 계단식 플랜트대 3단 | 0.90×0.28×0.61 | 3단 · 왼→오 계단 · 판 윗면 0.20 / 0.40 / 0.60m (x −0.30 / 0 / +0.30) | 원룸 창 앞에 두는 창가 단 | `c_desk.png` | 6,000 | `assets/v2/furniture/plant_step_3.glb` |
| 2 | A | `plant_pedestal` | 화분 받침대(높은) | 0.25×0.25×0.62 | 1단 · 둥근 윗판 0.62m | 바닥 화분을 0.62m 로 올림 | `c_desk.png` | 4,000 | `assets/v2/furniture/plant_pedestal.glb` |
| 3 | A | `shelf_cart_3tier` | 이동 카트 3단 | 0.50×0.25×0.82 | 3단 · 판 윗면 0.11 / 0.44 / 0.77m(같은 간격) · 손잡이 0.95m(오른쪽 끝) | 빛 따라 끌고 다니는 단 | `c_shelf.png` | 10,000 | `assets/v2/furniture/shelf_cart_3tier.glb` |
| 4 | A | `shelf_ladder_4tier` | 사다리 선반 4단 | 0.66×0.42×1.30 | 4단 · 판 윗면 0.03 / 0.45 / 0.88 / 1.30m · 깊이 0.30→0.15 · 위로 갈수록 좁아짐(폭 −10%/단) | 벽 기댐 · 높은 단이 창빛을 받음 | `c_shelf.png` | 8,000 | `assets/v2/furniture/shelf_ladder_4tier.glb` |
| 5 | A | `greenhouse_cabinet` | 미니 온실장(틀만) | 0.70×0.40×1.50 | 3단 · 판 윗면 0.39 / 0.76 / 1.14m(높이의 1/4·2/4·3/4) · ⚠ 유리 없이 «틀만» | 식물 갈래 상징 · 자리 6 | `c_shelf.png` | 10,000 | `assets/v2/furniture/greenhouse_cabinet.glb` |
| 6 | A | `low_table` | 좌식 테이블 | 1.00×0.50×0.32 | 상판 0.32m(두께 0.04) | 원룸 살림 상판 · 화분·시루 자리 | `c_desk.png` | 4,000 | `assets/v2/furniture/low_table.glb` |
| 7 | A | `wardrobe` | 옷장 | 1.00×0.58×1.90 | — (자리 없음 · 대리 윗면 1.90m) | 원룸 살림 · 가장 큰 가림 | `c_drawer.png` | 6,000 | `assets/v2/furniture/wardrobe.glb` |
| 8 | A | `mattress` | 바닥 매트리스 | 1.05×1.95×0.28 | — (긴 쪽이 깊이 d · 베개는 뒤 −Z · 총 높이 0.25m) | 원룸 미니멀 잠자리(그림) | `c_bed.png` | 8,000 | `assets/v2/furniture/mattress.glb` |
| 9 | A | `win_studio_cross` | 원룸 창틀(틀만) | 2.40×0.14×1.45 | — 바깥틀 0.09 · 십자살 0.045 · 깊이 0.14 · 네 칸 같은 크기 | 원룸 뒷벽 큰 창 — 늘 보인다 | `c_drawer.png` | 4,000 | `assets/v2/house/win_studio_cross.glb` |
| 10 | A | `door_wood` | 원룸 현관문 | 0.95×0.14×2.05 | — 문틀 0.09(좌·우·위) · 문짝 두께 0.05 · 둥근 손잡이 오른쪽 · 바닥에서 0.92m | 원룸 앞벽 문 — 앞벽은 카메라 쪽일 때 컷어웨이로 내려간다(코드 읽음 · 화면으로 안 잼) | `c_drawer.png` | 4,000 | `assets/v2/house/door_wood.glb` |
| 11 | B | `growlight_clip` | 식물등 집게 | 0.20×0.24×0.42 | — 등 머리 윗쪽 앞(y 0.38 · z +0.14) · LED 원판 지름 0.14 은 코드 것을 그대로 둔다 | 반지하·원룸 둘 다 · 빛의 주인공 | `c_shelf.png` | 6,000 | `assets/v2/furniture/growlight_clip.glb` |
| 12 | B | `growlight_stand` | 식물등 거치(스탠드) | 0.45×0.38×1.50 | — 판 가운데가 기둥 오른쪽 0.28m · 판 0.30×0.16 · 판 밑면 1.36m | 반지하·원룸 둘 다 · 빛의 주인공 | `c_shelf.png` | 6,000 | `assets/v2/furniture/growlight_stand.glb` |
| 13 | B | `cube_storage` | 큐브 수납장 | 0.75×0.25×0.78 | 상판 0.78m(원룸 창 아랫변 0.775 와 같은 높이) | 창 앞 벽에 붙이면 윗면이 창턱 높이 | `c_cabinet.png` | 8,000 | `assets/v2/furniture/cube_storage.glb` |
| 14 | B | `shelf` | 책장 | 0.80×0.30×1.50 | 4칸 · 판 윗면 0.02 / 0.39 / 0.77 / 1.14m(같은 간격 h/4) | 상판·단 자리 8 | `c_cabinet.png` | 8,000 | `assets/v2/furniture/bookshelf.glb` |
| 15 | B | `shelf_corner_3tier` | 코너 선반 3단 | 0.50×0.50×1.05 | 3단 · 부채꼴 판 윗면 0.03 / 0.54 / 1.05m · 직각 모서리가 뒤−왼(−X −Z) | 모서리 단 자리 6 | `c_shelf.png` | 6,000 | `assets/v2/furniture/shelf_corner_3tier.glb` |
| 16 | B | `clothes_rack` | 옷걸이 행거 | 1.00×0.45×1.62 | — (자리 없음 · 살대 가구 → 고르기 껍데기) | 원룸 살림 · 가림 | `c_drying_rack.png` | 15,000 | `assets/v2/furniture/clothes_rack.glb` |
| 17 | B | `sofa` | 2인 소파 | 1.60×0.82×0.85 | — 좌석 윗면 0.55 · 등받이 윗면 0.85(프리셋 h 1.1 은 가림 상자 값) | 원룸 살림(그림 · 지금은 앉기 단추 없음) | `c_bed.png` | 12,000 | `assets/v2/furniture/sofa.glb` |
| 18 | 예비 | `win_banjiha_letterbox` | 반지하 창틀(가로 띠 · 틀만) | 2.20×0.14×0.55 | — 세로살 둘 · 세 칸 · 9번이 «틀 두께» 검사를 넘었을 때만 | 반지하 뒷벽 창(첫 방) — 늘 보인다 | `c_drawer.png` | 4,000 | `assets/v2/house/win_banjiha_letterbox.glb` |
| 19 | 예비 | `coffee_table` | 커피 테이블 | 0.95×0.52×0.38 | 2단 · 아래 선반 윗면 0.18 · 상판 0.38m | 상판 자리 | `c_desk.png` | 5,000 | `assets/v2/furniture/coffee_table.glb` |
| 20 | 예비 | `stool` | 스툴 | 0.36×0.36×0.45 | 좌판 0.45m | 작은 받침 · 자리(slots) 없음 — 화분이 올라가는지는 이을 때 잰다 | `c_chair.png` | 4,000 | `assets/v2/furniture/stool.glb` |

### 프롬프트 (영어 그대로 넣는다 · 앞머리는 모두 같다)

앞머리: `One object alone on a plain off-white background. No floor, room, frame, border, text or shadow. 3/4 isometric view from front-left above, front facing lower-left, centered. Cozy hand-painted matte style like the reference.`

뜻: 물건 하나만 · 흰 바탕 · 바닥·방·액자·테두리·글자·그림자 없이 · 왼쪽 앞 위에서 본 3/4 등각 · 앞면이 왼쪽 아래 · 가운데 · 참조 방 그림처럼 손그림 무광.

1. **계단식 플랜트대 3단** (앞머리 포함 485자)
   - EN `A 3-step wooden plant stand: three flat boards rising left to right like stairs, each board on two thin round legs (front and back). 0.90 m wide, 0.28 m deep, 0.61 m tall. Board tops at 0.20 / 0.40 / 0.60 m. Light beige wood #e0d5c2, legs #c3b49c. Boards empty.`
   - 뜻 나무 계단식 화분대 3단 — 판 셋이 왼쪽에서 오른쪽으로 계단처럼 오르고, 판마다 가는 다리 둘(앞·뒤). 폭 0.90 · 깊이 0.28 · 높이 0.61. 판 윗면 0.20/0.40/0.60. 밝은 베이지 나무, 다리는 조금 진하게. 판 위는 비움.
2. **화분 받침대(높은)** (앞머리 포함 427자)
   - EN `A tall round plant pedestal: round flat top 0.25 m across, one slim column, round foot a bit smaller than the top. 0.62 m tall (height = 2.5 x top width). Top #e0d5c2, column and foot #c3b49c. Top empty.`
   - 뜻 높은 둥근 화분 받침 — 지름 0.25 둥근 윗판 · 가는 기둥 하나 · 윗판보다 조금 작은 둥근 발. 높이 0.62(윗판 지름의 2.5배). 윗판 비움.
3. **이동 카트 3단** (앞머리 포함 566자)
   - EN `A 3-tier rolling utility cart: three flat solid trays with low side rails, four thin corner posts, four small caster wheels, a push handle rising above the right end. Body 0.50 m wide, 0.25 m deep, 0.82 m tall, handle top 0.95 m. Tray tops at 0.11 / 0.44 / 0.77 m, evenly spaced. Pale mint-gray #dfe6e4 trays, gray #b9c2c7 posts. Trays empty.`
   - 뜻 바퀴 달린 3단 카트 — 낮은 난간 두른 판 셋 · 가는 모서리 기둥 넷 · 작은 바퀴 넷 · 오른쪽 끝 위로 솟은 손잡이. 몸 0.50×0.25×0.82 · 손잡이 끝 0.95. 판 윗면 0.11/0.44/0.77(같은 간격). 옅은 민트 회색 판 · 회색 기둥. 판 비움.
4. **사다리 선반 4단** (앞머리 포함 569자)
   - EN `A leaning ladder shelf: two long side rails leaning back toward the wall, four flat shelves getting narrower and shallower toward the top (depth 0.30 to 0.15 m). 0.66 m wide, 0.42 m deep at the floor, 1.30 m tall. Shelf tops at 0.03 / 0.45 / 0.88 / 1.30 m: bottom shelf on the floor, top shelf at the very top. Light wood #e3d3bd. Shelves empty.`
   - 뜻 벽에 기대는 사다리 선반 — 긴 옆대 둘이 벽 쪽으로 기울고, 판 넷이 위로 갈수록 좁고 얕아짐(깊이 0.30→0.15). 폭 0.66 · 바닥 깊이 0.42 · 높이 1.30. 판 윗면 0.03/0.45/0.88/1.30(맨 아래는 바닥, 맨 위는 꼭대기). 밝은 나무. 판 비움.
5. **미니 온실장(틀만)** (앞머리 포함 545자)
   - EN `A mini greenhouse cabinet, FRAME ONLY: slim metal frame with four corner posts, solid top and bottom plates, three flat inner shelves. NO glass panels, NO doors, all sides open. 0.70 m wide, 0.40 m deep, 1.50 m tall. Shelf tops at 0.39 / 0.76 / 1.14 m (1/4, 2/4, 3/4 of the height). Pale blue-gray #cfd8dc. Shelves empty.`
   - 뜻 미니 온실장 «틀만» — 가는 쇠틀 · 모서리 기둥 넷 · 윗판·밑판 · 안 선반 셋. 유리·문 없이 사방 트임. 0.70×0.40×1.50. 판 윗면 0.39/0.76/1.14(높이의 1/4·2/4·3/4). 옅은 청회색. 선반 비움. (유리는 게임 코드 것을 그대로 쓴다)
6. **좌식 테이블** (앞머리 포함 402자)
   - EN `A low Korean floor table: rectangular wooden top on four short legs. 1.00 m wide, 0.50 m deep, only 0.32 m tall, top 4 cm thick. Warm light wood #e5d3b8, legs #cbbba2. Top empty.`
   - 뜻 낮은 좌식 테이블 — 네모 나무 상판에 짧은 다리 넷. 1.00×0.50 · 높이 0.32 · 상판 두께 4cm. 따뜻한 밝은 나무. 상판 비움.
7. **옷장** (앞머리 포함 458자)
   - EN `A two-door wardrobe: tall plain box, two flat closed doors with a thin center gap, two slim vertical handles beside the gap at mid height. 1.00 m wide, 0.58 m deep, 1.90 m tall. Warm off-white #eae2d6 body, honey wood #c8b18a handles.`
   - 뜻 두 문 옷장 — 키 큰 민짜 상자 · 닫힌 납작한 문 둘 · 가운데 가는 문틈 · 틈 곁 가는 세로 손잡이 둘(가운데 높이). 1.00×0.58×1.90. 따뜻한 미색 몸 · 꿀색 나무 손잡이.
8. **바닥 매트리스** (앞머리 포함 484자)
   - EN `A floor mattress with no bed frame, lying flat: 1.05 m wide, 1.95 m long, 16 cm thick, long side running from front to back. A folded light-blue #dce6ea blanket over the front half, one white pillow at the back end. Total height 0.25 m. Cream #f2efe9 mattress.`
   - 뜻 틀 없는 바닥 매트리스 — 바닥에 납작하게. 폭 1.05 · 길이 1.95(앞에서 뒤로 길게) · 두께 16cm. 앞쪽 반에 개어 둔 옅은 하늘색 이불 · 뒤 끝에 흰 베개 하나. 총 높이 0.25. 크림색.
9. **원룸 창틀(틀만)** (앞머리 포함 567자)
   - EN `A wide window frame, FRAME ONLY, seen almost from the front: rectangular frame split into 4 equal panes by one vertical and one horizontal bar crossing at the exact center. NO glass: the panes are open holes. 2.40 m wide, 1.45 m tall, 0.14 m deep. Outer bars 0.09 m, cross bars 0.045 m: thin, straight, crisp square corners. Off-white #f8f4ec.`
   - 뜻 넓은 창틀 «틀만» — 거의 정면. 가운데서 정확히 엇갈리는 세로살·가로살 하나씩으로 같은 크기 네 칸. 유리 없이 구멍. 2.40×1.45 · 깊이 0.14. 바깥틀 0.09 · 십자살 0.045 — 가늘고 곧게, 모서리 각지게. 미색.
10. **원룸 현관문** (앞머리 포함 483자)
   - EN `An apartment front door with its frame: flat warm wood slab door #c9a36a in a slim frame on the left, right and top, round brass knob on the right at hip height, closed, no glass. 0.95 m wide, 2.05 m tall, frame 0.14 m deep, door 5 cm thick. Simple and clean.`
   - 뜻 아파트 현관문과 문틀 — 따뜻한 나무색 납작한 문짝 · 좌·우·위 가는 문틀 · 오른쪽 허리 높이 둥근 놋쇠 손잡이 · 닫힘 · 유리 없음. 0.95×2.05 · 문틀 깊이 0.14 · 문짝 두께 5cm. 단순하게.
11. **식물등 집게** (앞머리 포함 497자)
   - EN `A clip-on grow lamp: small spring clamp at the bottom, slim gooseneck arm, round lamp head at the top front tilted forward and down, flat round underside where the light disc sits. 0.20 m wide, 0.24 m deep, 0.42 m tall. Light gray #dfe3e6, a soft lilac glow under the head.`
   - 뜻 집게형 식물등 — 아래 작은 용수철 집게 · 가는 구스넥 · 위 앞쪽에 앞·아래로 기운 둥근 등 머리 · 머리 밑은 빛 원판이 붙는 납작한 면. 0.20×0.24×0.42. 옅은 회색 · 머리 밑 옅은 라일락 빛.
12. **식물등 거치(스탠드)** (앞머리 포함 524자)
   - EN `A floor grow-light stand: round heavy base 0.38 m across, one tall slim pole, a short arm at the top reaching to the right, a flat rectangular LED panel 0.30 x 0.16 m under the arm end facing down, its center 0.28 m right of the pole. 1.50 m tall. Light gray #cfd4d8, soft lilac glow under the panel.`
   - 뜻 바닥 거치형 식물등 — 지름 0.38 무거운 둥근 받침 · 가는 긴 기둥 하나 · 꼭대기에서 오른쪽으로 뻗은 짧은 팔 · 팔 끝 밑에 아래를 보는 납작한 LED 판 0.30×0.16(가운데가 기둥에서 오른쪽 0.28). 높이 1.50. 옅은 회색 · 판 밑 라일락 빛.
13. **큐브 수납장** (앞머리 포함 461자)
   - EN `A low cube storage unit: 2 x 2 equal open square cubbies, fabric bins in the bottom-left and top-right cubbies, the other two open. Flat plain top. 0.75 m wide, 0.25 m deep, 0.78 m tall. Warm off-white #eae2d6 wood, pale gray-beige bins.`
   - 뜻 낮은 큐브 수납장 — 같은 크기 네모 칸 2×2 · 왼쪽 아래와 오른쪽 위 칸에 천 바구니 · 나머지 둘은 트임 · 윗면 민짜. 0.75×0.25×0.78. 따뜻한 미색 나무 · 옅은 회베이지 바구니.
14. **책장** (앞머리 포함 561자)
   - EN `An open bookshelf with four equal open compartments: two side panels, top and bottom boards, three inner shelves evenly spaced, thin back panel. 0.80 m wide, 0.30 m deep, 1.50 m tall. Shelf tops at 0.02 / 0.39 / 0.77 / 1.14 m. Warm off-white wood #e8dfd2. Shelves almost empty: only two thin books at the far left of the top compartment.`
   - 뜻 트인 책장 — 같은 크기 네 칸 · 옆판 둘 · 위·아래 판 · 같은 간격 안 선반 셋 · 얇은 뒤판. 0.80×0.30×1.50. 판 윗면 0.02/0.39/0.77/1.14. 따뜻한 미색 나무. 거의 비움 — 맨 위 칸 왼쪽 끝에 얇은 책 두 권만.
15. **코너 선반 3단** (앞머리 포함 547자)
   - EN `A corner shelf: three quarter-circle (fan-shaped) flat shelves and three thin posts; the right-angle corner points to the back-left wall corner, the curved edge faces the viewer. Radius 0.50 m, 1.05 m tall. Shelf tops at 0.03 / 0.54 / 1.05 m: on the floor, middle, top. Warm off-white #e8dfd2, posts #cbbfae. Shelves empty.`
   - 뜻 모서리 선반 — 부채꼴(4분원) 판 셋 · 가는 기둥 셋 · 직각 꼭짓점은 뒤−왼 벽 모서리로, 둥근 변은 보는 쪽으로. 반지름 0.50 · 높이 1.05. 판 윗면 0.03/0.54/1.05(바닥·가운데·꼭대기). 미색 · 기둥 조금 진하게. 판 비움.
16. **옷걸이 행거** (앞머리 포함 476자)
   - EN `A simple standing clothes rail: two slim upright posts on flat foot bars, one horizontal hanging bar at the top, five pastel shirts on hangers (pale blue, pink, sage, lilac). 1.00 m wide, 0.45 m deep at the feet, 1.62 m tall. Light taupe metal #cbbfae.`
   - 뜻 서 있는 옷걸이 행거 — 납작한 발대 위 가는 기둥 둘 · 꼭대기 가로 봉 하나 · 옷걸이에 걸린 파스텔 셔츠 다섯(하늘·분홍·세이지·라일락). 1.00×0.45(발) · 높이 1.62. 옅은 토프색 쇠.
17. **2인 소파** (앞머리 포함 448자)
   - EN `A 2-seat sofa: low backrest across the back, two armrests, two seat cushions, four short wooden legs. 1.60 m wide, 0.82 m deep, seat top 0.55 m, backrest top 0.85 m. Soft sage-gray #c9d6d2 fabric, off-white #eef2f0 cushions.`
   - 뜻 2인 소파 — 뒤를 가로지르는 낮은 등받이 · 팔걸이 둘 · 좌석 쿠션 둘 · 짧은 나무 다리 넷. 1.60×0.82 · 좌석 윗면 0.55 · 등받이 윗면 0.85. 부드러운 세이지 회색 천 · 미색 쿠션.
18. **반지하 창틀(가로 띠 · 틀만)** (앞머리 포함 546자)
   - EN `A wide low basement window frame, FRAME ONLY, seen almost from the front: long horizontal rectangle split by two thin vertical bars into 3 equal panes. NO glass: the panes are open holes. 2.20 m wide, 0.55 m tall, 0.14 m deep. Outer bars 0.09 m, inner bars 0.045 m: thin, straight, crisp square corners. Pale gray #e2e4e6.`
   - 뜻 넓고 낮은 반지하 창틀 «틀만» — 거의 정면 · 가늘은 세로살 둘로 같은 크기 세 칸 · 유리 없이 구멍. 2.20×0.55 · 깊이 0.14. 바깥틀 0.09 · 세로살 0.045 — 가늘고 곧게. 옅은 회색.
19. **커피 테이블** (앞머리 포함 435자)
   - EN `A low coffee table: rectangular top on four legs with a lower shelf near the floor. 0.95 m wide, 0.52 m deep, top at 0.38 m, lower shelf top at 0.18 m. Warm light wood #e5d3b8, legs #cbbba2. Both surfaces empty.`
   - 뜻 낮은 커피 테이블 — 네모 상판 · 다리 넷 · 바닥 가까이 아래 선반. 0.95×0.52 · 상판 0.38 · 아래 선반 윗면 0.18. 따뜻한 밝은 나무. 두 판 다 비움.
20. **스툴** (앞머리 포함 372자)
   - EN `A small round wooden stool: round flat seat 0.36 m across, four straight slim legs. 0.45 m tall. Light beige wood #e0d5c2, legs #c3b49c. Seat empty.`
   - 뜻 작은 둥근 나무 스툴 — 지름 0.36 둥근 좌판 · 곧고 가는 다리 넷. 높이 0.45. 밝은 베이지 나무. 좌판 비움.

## 원화 검수 (총괄 · 2026-10-09) — 받은 것과 고칠 것

[총괄 검수] 원화 17점 → `assets/gen/v2_furn/c_<이름>.png`(1024²) · 지금까지 house 153.
- 통과 → 3D: 6 · 7 · 10 · 11 · 14 · 16 · 17
- 치수 글씨·치수선만 지우고 3D: 2 · 3 · 8 → `c_<이름>_clean.png`(물체 볼록 껍질 안은 안 건드림)
- 원화 다시(→ `c_<이름>_r2.png`): 1 계단 방향·판 모양 · 4 맨 아래·맨 위 단 높이 · 5 단 수 · 12 치수 글씨 + 공중 빛 번짐(«판 밑면만 라일락»으로 고침) · 13 있을 수 없는 모양 · 15 바탕이 황갈색
- **이을 때 돌릴 것**(앞면 방향): 10 문 · 11 집게등 · 14 책장 · 16 행거는 앞이 오른쪽 아래 → **90°** · 3 카트는 손잡이가 왼쪽 끝 → **180°**(앞뒤 같은 모양). 거울 뒤집기는 없다.

### 9 원룸 창 원화 — 틀 두께 [잰 것 · house]

`c_win_studio_cross.png` 의 앞면에서 판마다 «앞면 모서리 ~ 앞면 모서리»를 밝기 꺾임으로 쟀다(세로틀은 줄 y 330·720, 가로틀은 칸 x 350). 앞면 폭 668px · 앞면 높이 526px.
옷 층이 2.40×1.45 로 따로 늘이므로 «같은 축 안의 비율»이 그대로 m 로 간다(평행 투영이라 친 셈 — 손그림이라 ±2px ≈ ±0.007m).

| 판 | px | 늘인 뒤 m | 표 m | 배 |
|---|---|---|---|---|
| 왼 세로틀 | 30 / 668 | 0.108 | 0.09 | ×1.20 |
| 오른 세로틀 | 35 / 668 | 0.126 | 0.09 | ×1.40 |
| **세로 십자살** | 26 / 668 | **0.093** | 0.045 | **×2.08** |
| 위 가로틀 | 37 / 526 | 0.102 | 0.09 | ×1.13 |
| 아래 가로틀 | 33 / 526 | 0.091 | 0.09 | ×1.01 |
| **가로 십자살** | 26 / 526 | **0.072** | 0.045 | **×1.59** |
| 유리(구멍) 면적 | 폭 86.4% × 높이 81.7% = **70.6%** | | 76.6% | 보이는 유리가 빛 드는 유리의 **92%** |

⇒ **못 넘는다 — 원화 다시(9).** 총괄 눈대중(«십자살이 두 배쯤 · 3/4 시점»)과 같다. 3D 로 가면 Meshy 가 가는 살을 더 굵히는 쪽이라(예전 창틀 GLB) 더 벌어진다.
넘는 줄(3D 를 받아 다시 잰다): 틀·살 모두 표의 **±25%** 안(틀 0.068~0.113 · 살 0.034~0.056) · 보이는 유리 **95%** 이상. ⚠ 이 줄은 house 가 정한 **어림**이다(재서 정한 값이 아니다). 줄 가까이에서 갈리면 코드 창과 같은 픽셀로 나란히 찍어 박사님 눈에 맡긴다.
r2 프롬프트(앞머리 없이 이것 통째 · 553자):
`One window frame alone on a plain off-white background: no wall, no glass, no text, no shadow. Straight front view, only slightly from above-left so the 0.14 m depth shows as a thin edge. Cozy hand-painted matte style like the reference. Rectangle 2.40 m wide x 1.45 m tall, split into 4 equal open panes by one vertical and one horizontal bar crossing at the exact center. Outer frame very thin: 0.09 m, about 1/27 of the width. The two cross bars are HALF as thick as the outer frame (0.045 m). Straight crisp edges, square corners. Off-white #f8f4ec.`
뜻: 창틀만 · 흰 바탕 · 벽·유리·글자·그림자 없음 · **거의 정면**(깊이 0.14 가 가는 모서리로만 보이게) · 2.40×1.45 · 정가운데 십자로 같은 네 칸 · 바깥틀 아주 가늘게(폭의 1/27) · **십자살은 바깥틀의 절반**.
r2 도 못 넘으면 9·18 은 접고 코드 창틀을 그대로 둔다(빛과 보이는 것이 이미 같다) — 남는 60 은 다시 뽑기 몫으로 돌린다.

### 9 원룸 창 r2 — 틀 두께 [잰 것 · house · 10-09]

`c_win_studio_cross_r2.png` 는 **원근** 그림이다(왼 변 높이 ≈562px · 오른 변 ≈753px). 그래서 세로 판은 «그 x 의 앞면 높이»로 그 자리 배율을 내고, 가로 축 줄어듦(k = 0.74)은 앞면 폭 전체가 2.40 이 되게 맞췄다. 맞춘 판으로 십자 세로살 가운데가 1.22m(표 1.20)에 떨어진다 — 셈이 맞는다는 표지.

| 판 | 잰 것 | 늘인 뒤 m | 표 m | 배 |
|---|---|---|---|---|
| 왼 · 오른 세로틀 | 25 · 35px | 0.087 · 0.092 | 0.09 | ×0.97 · ×1.02 ✔ |
| **세로 십자살** | 26px | **0.078** | 0.045 | **×1.74** ✘ |
| 위 · 아래 가로틀 | 칸 x 300 · 680 에서 4.4~4.7% | 0.064~0.068 | 0.09 | ×0.72~0.76 (줄 밑 살짝) |
| **가로 십자살** | 4.4~4.6% | **0.064~0.066** | 0.045 | **×1.43~1.47** ✘ |
| 보이는 유리 | 폭 89.3% × 높이 86.5% = 77.2% | | 76.6% | **101%** ✔ |

⇒ 유리는 맞았다(가로틀이 가늘어지고 살이 굵어져 서로 갚았다). **살은 여전히 1.5~1.7 배**로 줄을 못 넘는다. ⇒ 아래 «회색 상자 길»로 r3 한 번(9).

### 회색 상자 길 (총괄 제안 (나)) — 참조 그림 [house · 10-09]

글로 단 높이·단 수·살 굵기를 시켜서는 두 번 다 안 맞았다(1 · 4 · 5 · 9). ⇒ **지금 자리(slots)가 맞는 코드 가구**를 찍어 그 그림으로 모양을 박는다.
(가) «모델에 맞춰 자리 높이를 고친다»는 고르지 않았다 — 자리 높이가 곧 화분 높이고 빛 값이다(창 앞 0.6~0.8m 가 자람을 가른다 · 위 «바로잡음 4»). 원화 하나에 맞춰 게임 값을 옮기지 않는다.

- 자: `tools/shot_furn_ref.mjs` — 코드 가구를 평행 투영 · 흰 바탕 · 찰흙 한 빛깔(#a89f92)로 찍는다. 앞(+Z)이 왼쪽 아래, 창은 거의 정면. 온실장은 유리를 뺀다.
  `BYEOT_URL=http://127.0.0.1:9330 node tools/shot_furn_ref.mjs plant_step_3 shelf_ladder_4tier greenhouse_cabinet win_studio_cross`
- 나온 것: `assets/gen/v2_furn/ref_plant_step_3.png` · `ref_shelf_ladder_4tier.png` · `ref_greenhouse_cabinet.png` · `ref_win_studio_cross.png`
- 부르는 법: `reference_file_paths: [ref_<이름>.png, style_keyframe_a.png]` — **모양 그림이 첫째**. 받을 이름 `c_<이름>_r3.png`.
- 프롬프트(통째 · 앞머리 없이): `Repaint the FIRST reference image. Keep its exact shape, proportions, number of parts, board heights, bar thicknesses and camera angle - do not add, remove or move anything. Only change the surface: cozy hand-painted matte style like the second reference room, soft outlines. One object alone on a plain off-white background: no floor, no frame, no text, no shadow. Colors: ` + 끝말
  - 1 계단식: `light beige wood #e0d5c2 boards, legs #c3b49c. Boards empty.` (434자)
  - 4 사다리: `light wood #e3d3bd shelves and rails. Shelves empty.` (426자)
  - 5 온실장: `pale blue-gray #cfd8dc metal frame and shelves, NO glass. Shelves empty.` (446자)
  - 9 원룸 창: `off-white #f8f4ec painted frame, NO glass, open panes.` (428자)
  - 뜻: 첫째 참조 그림을 «다시 칠»한다 — 모양·비율·부품 수·단 높이·살 굵기·시점은 그대로(더하지도 빼지도 옮기지도 말 것) · 겉만 둘째 참조 방처럼 손그림 무광 · 물건 하나 · 흰 바탕 · 바닥·액자·글자·그림자 없음 · 색은 끝말대로.
- 받으면 house 가 r2 때와 같은 자로 단 높이·살 굵기를 다시 잰다. r3 도 못 넘는 것은 코드 가구를 그대로 둔다(빛·자리는 이미 맞다).

## 이은 것 [house · 10-09 · 크레딧 0]

사진: `docs/handoff/img/house_20261009/fit_v2furn9.png` — 줄마다 왼쪽 코드 가구 · 오른쪽 v2 옷, 같은 카메라·같은 픽셀(`tools/probe_dress_fit.mjs`).

| # | 프리셋 | 받은 파일 | yaw | 자리 높이 오차(입힌 뒤 다시 잼) | 비고 |
|---|---|---|---|---|---|
| 2 | plant_pedestal | `assets/v2/furniture/plant_pedestal.glb` | 0 | 0 | 세로/가로 1.24(기둥이 조금 길쭉) |
| 6 | low_table | `low_table.glb` | 0 | ≤0.2mm | |
| 7 | wardrobe | `wardrobe.glb` | 0 | 0 | |
| 8 | mattress | `mattress.glb` | 0 | ≤3.8mm | 베개 뒤(−Z) |
| 17 | sofa | `sofa.glb` | 0 | ≤0.6mm(좌석 쿠션) | 등받이 1.12m — 코드 소파(0.85)보다 높지만 빛이 보는 가림 상자(1.1)와 같다 |
| 13 | cube_storage | `cube_storage.glb` | 0 | ≤0.6mm | |
| 3 | shelf_cart_3tier | `shelf_cart_3tier.glb` | 0 | ≤0.8mm(세 단) | 겹단 · 손잡이 +X 끝 |
| 14 | shelf(책장) | `bookshelf.glb` | 0 | ≤0.7mm(네 단) | 겹단 · Meshy 받침대를 꺾은 선으로 눌렀다 |
| 15 | shelf_corner_3tier | `shelf_corner_3tier.glb` | **90** | ≤0.1mm(세 단) | 겹단 · 가운데 판 짙은 얼룩을 텍스처에서 덮음(아래) |

- **돌림(yaw)은 원화가 아니라 GLB 로 정한다.** Meshy 는 원화를 어느 쪽에서 그렸든 앞을 +Z 로 내보냈다(13점을 한 장에 찍어 봄). 총괄 검수의 «10·11·14·16 은 90° · 3 은 180°»는 원화 기준이라 GLB 에는 안 맞았다 — 14·3 은 0 이다. 코너 선반만 판 무게중심으로 재서 90.
- **겹단 맞추기 새로 지음**(`furniture_dress.js` `tierFracs` · `remapTiers`): Meshy 판 높이는 코드 단 높이와 비율이 다르다(책장: 판 5.7/29.9/53.2/77.1% · 코드 1.2/26.2/51.1/76.2% — 배율 하나로는 밑단이 6.5cm 뜬다). ⇒ 단마다 «위를 보는 면»과 짝짓고, GLB 세로를 단 높이대로 **꺾은 선**으로 늘인다. 판은 단 높이에 정확히 앉고 사이 기둥이 늘거나 준다. 입힌 뒤 같은 자로 다시 재서 오차를 적는다(셈을 안 믿는다).
  ⇒ 이 길이면 **r2 원화도 살릴 수 있다**(1 계단식 0.31/0.45/0.60 · 4 사다리 0.12/0.43/0.75/1.06 · 5 온실장 판 넷) — 판 «수»만 자리 단 수 이상이면 높이는 맞춘다. 단, 사다리처럼 기운 옆대는 단마다 꺾여 보일 수 있다 — 3D 를 받아 찍어 보고 정한다.
- **코드 코너 선반 고침**(`furniture_pastel.js` `B.shelf_corner`): 부채꼴 판 셋이 발자국 **뒤로 0.5m** 나가 그려져 있었다(z −0.75~−0.25 · 기둥·자리는 발자국 안) — 자리에 놓은 화분이 판 없는 허공에 섰다. 판을 발자국 안(직각 꼭짓점 뒤-왼)으로. 빛은 크기 상자·자리를 보므로 안 바뀐다 · 코너 선반은 지금 어느 방에도 없다.
- **코너 선반 얼룩**: Meshy 가 가운데 판에 짙은 갈색을 구웠다(원화엔 없음). `tools/glb_tex_patch_band.py` 로 그 판(높이 48.5~53.5%) 면이 쓰는 텍스처 자리에서 밝기 150 밑을 판 색 [224,203,179]으로 덮었다. 다시 뽑기(retexture 10) 안 씀.
- **받는 길**: 가구점 옷은 lazy(놓였을 때만 받는다). 그리고 옷 층이 «없는 옷 하나»에 FURN 파일 **전부**를 받던 것을 «방에 놓인 것만»으로 고쳤다 — 13벌이 늘어 소파 하나 사도 5MB 를 받을 판이었다.
- **텍스처**: `tools/glb_tex_webp.py` — gltf-transform 이 저장소에 없어 같은 판(1024 · webp · EXT_texture_webp)을 파이썬으로. 1.6~4.3MB → 0.19~0.85MB(지금 v2 가구 0.24~0.77MB 와 같은 결).
- 확인: 작업 전 판(`DRESS_MOD` = HEAD 의 furniture_dress)과 지금 판으로 침대·책상·의자·서랍장·협탁·건조대·난방기·쓰레기·가방 9점이 **같은 값**. 게임 부팅(반지하 Day 0)에서 침대·책상·의자·서랍장이 v2 옷 그대로. `run_house_checks` 초록 9 · 붉음 1(`test_floorlight` ①-3 «표본이 너무 적습니다» — HEAD 판에서도 같은 붉음 · 08-30 원룸을 비운 뒤 알려진 것, master-visual-contracts) · `test_furnishop` 68/68(가구점 83줄 그대로).
- ⚠ 옷 층 `report()` 는 다시 입힐 때 비워지고 이미 입은 것은 안 적는다(옛 버릇 · 게임에서 소품 4점만 보인다). 자는 한 번만 dress() 하고 기다리게 했다. 고치지는 않았다(그림·판정 무관).

### 아직 안 이은 것

| # | 무엇 | 까닭 · 할 일 |
|---|---|---|
| 11 · 12 | 식물등 집게 · 거치 | LED(`lampShade`)는 코드 것을 보이게 남겨야 한다(밤빛이 그 메시를 찾는다 · 계약 5). GLB 를 발자국 상자에 맞추면 등 머리·판이 코드 LED 자리와 어긋난다(거치: GLB 기둥이 상자 한끝에 있어 가운데 맞춤이면 0.13m 밀림). ⇒ «받침 가운데 → 코드 받침, 등 판 → 코드 LED» 두 점으로 맞추는 길을 짓는다. GLB 는 받아 두었다 |
| 16 | 옷걸이 행거 | 다음 차례(자리 없음 · 상자 맞춤). GLB 받아 둠 |
| 10 | 현관문 | 가구가 아니라 집 껍데기(`buildDoor`) — 컷어웨이 때 벽과 함께 옅어져야 한다. 새 길. GLB 받아 둠(`assets/v2/house/door_wood.glb`) |
| 1 · 4 · 5 · 9 · 18 | 계단식 · 사다리 · 온실장 · 창 둘 | r3(회색 상자 참조) 또는 r2 + 꺾은 선 — 3D 를 받으면 같은 자로 잰다 |

## 받은 뒤 — [house] 가 잇는다 (크레딧 0)

1. `gltf-transform` 로 텍스처 1024 webp 로 줄여 «받을 경로»에 둔다(v2 때와 같은 판 · 0aa8b850).
2. 옷 층(`src/render3d/furniture_dress.js` FURN)에 프리셋 → 파일 · yaw · probes 를 단다. **프리셋 크기(size_m)는 안 바꾼다** — 가구점 값이 크기에서 나온다(add-furniture-checklist ②).
3. ⚠ **지금 코드로는 바로 안 되는 것** — 이을 때 house 가 짓는다:
   - **겹단 선반(3 · 4 · 5 · 14 · 15)**: 옷 층의 «윗면 맞추기»는 자리(u,v)에서 **맨 위 면만** 잰다(`topFrac`). 단이 위아래로 겹치면 아래 단이 어긋난다. 이미 뽑은 v2 `shelf.glb`(에타제르)를 안 쓰고 색만 바꾼(RESTYLE) 까닭이 이것이다(`RESTYLE` 주석 «단·자리 계약»). ⇒ 단마다 맞추는 자를 새로 짓고, 단마다 높이 오차를 재서 표로 낸다.
   - **4 사다리**: 프리셋 type 이 `shelf_etagere` 라 RESTYLE 이 먼저 먹는다 → 프리셋 id 로 비켜 준다. 아래 단이 발자국(d 0.42) 밖 앞으로 나온다(자리 z +0.31) — x·z 늘이기와 같이 잰다.
   - **5 온실장**: GLB 는 틀만 받는다. 유리 판은 코드 것을 보이게 남긴다(대리 숨기기에서 유리를 뺀다). Meshy GLB 는 색 텍스처뿐이라(`enable_pbr: false`) 유리가 투명하게 안 나온다 — 유리째 뽑으면 막힌 상자로 보인다.
   - **11 · 12 식물등**: LED(`userData.lampShade`)는 코드 것을 보이게 둔다 · `g` 의 직계 자식 그대로 · `lightRigs` 발광점·노드는 안 건드린다(master-visual-contracts 4·5). 몸통 대리만 숨긴다. 탭 차례(등이 가구보다 먼저)도 그대로다. 두 방(반지하 · 원룸)에 다 있는 가구라 첫 판부터 보인다.
   - **9 · 10 · 18 창·문**: 가구가 아니라 집 껍데기(`window_frame.js` `buildWindowFrame` · `buildDoor`)다 → 새 길을 낸다. 빛은 **코드 창 구멍**으로만 든다. GLB 틀이 코드 틀보다 두꺼우면 «보이는 유리 < 빛이 드는 유리»가 된다. ⇒ 같은 픽셀로 나란히 놓고 유리 면적 %를 재서 넘어야 넣는다. 예전 Meshy 창틀(`assets/house/house_mod_window_normal.glb` · 썸네일 `assets/house/thumbs/`)은 틀이 두껍고 구멍 모서리가 깎여 **참조 0** 으로 남았다 — 같은 일이 날 수 있다. 문은 앞벽 컷어웨이를 따라 옅어져야 한다(`buildDoor` 의 재질 clone 과 같은 판).
   - **16 행거**: 살대 가구 → 고르기 껍데기(`pickShell`).
   - **8 · 17 매트리스 · 소파**: 그림만. 눕기 · 앉기는 위 «바로잡음 2».
4. 다 이으면: `?v2furn=0` 과 같은 픽셀로 나란히 · `tools/probe_pick_props.mjs` 진짜 마우스 18점 · `run_house_checks` · 가구점 줄 수(`test_furnishop`)가 안 바뀌었나.

## 크레딧 없이 할 것

- 이미 뽑아 둔 v2 소품이 아직 안 이어져 있다 — `assets/v2/props/` laundry · desk_set · monitor · plush_clock · kitchen. 잇기만 하면 된다.

## 이번 house 몫에서 뺀 것 (어제 «다 쓰기» 안에 있던 것)

| 무엇 | 까닭 |
|---|---|
| 식물등 바 | 0.70×0.06×0.05 얇은 막대 — 코드 그림으로 넉넉하다 |
| 화분 4종 v2 결 | leaf 몫(다른 식물 모듈)과 겹칠 수 있다 — 총괄이 leaf 와 함께 본다 |
| 원형 테이블 · 낮은 책장 | 1,000 안에 맞추느라 — 상판 자리는 6 · 14 · 13 · 19 가 낸다 |

## [char] 몫 · [leaf] 몫

(총괄이 받아 합친다)
