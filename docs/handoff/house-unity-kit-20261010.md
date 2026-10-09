# 유니티 몫 — 방 키트 · 이음 없는 겉감 4k ([house] · 2026-10-10 · 총괄 «유니티 판이 house 쪽에서 쓸 것»)

박사님 «나중에 유니티로 만들 것도 생각해서 뽑아». 웹 판(three.js)과 같은 결(style_keyframe_a)로 뽑은 것을 한곳에 적는다.
파일은 옮기지 않았다. 아래 경로가 원본이다(크기가 커서 두 벌을 안 둔다 · 키트 하나 6~12MB).

## 1. 방 키트 소품 여덟 — Tripo H3.1 detailed · PBR(색 · 금속거칠기 · 노멀) · 6.7k~7.7k 면

⚠ Tripo 는 **가장 긴 변을 1.0** 으로 낸다. 유니티에서는 아래 «실제 크기»로 맞춘다. 앞 방향도 GLB 마다 다르다 — 아래 «긴 축»을 보고 돌린다.

| 파일(assets/gen/v2_hf/unity/) | 무엇 | 긴 축(1.0) · 받은 상자 | 실제 크기(제안) | 원화 |
|---|---|---|---|---|
| kit_wall_pipes.glb | 벽 배관(노출 · 반지하 계단실) | Z · 0.16×0.65×1.0 | 높이 1.2m | c_wall_pipes_2 |
| kit_meter_box.glb | 전기 계량함(벽) | Y · 0.53×1.0×0.25 | 높이 0.40m | c_meter_box_1 |
| kit_window_well_grate.glb | 반지하 창 우물 덮개 | Z · 0.75×0.43×1.0 | 폭 1.0m | c_window_well_grate_2 |
| kit_wall_shelf_bracket.glb | 벽 선반(받침쇠 둘) | Z · 0.42×0.50×1.0 | 폭 0.60m | c_wall_shelf_bracket_1 |
| kit_wall_clothes_rail.glb | 벽걸이 옷걸이 봉 | Z · 0.66×0.40×1.0 | 폭 0.80m | c_wall_clothes_rail_2 |
| kit_door_mat.glb | 현관 매트(잎 테두리) | Z · 0.81×0.07×1.0 | 0.75×0.45m | c_door_mat_1 |
| kit_pendant_lamp.glb | 천장 펜던트 등(크림 원뿔 갓) | Y · 0.38×1.0×0.37 | 줄 포함 0.9m | c_pendant_lamp_1 |
| kit_shoe_rack_small.glb | 작은 신발장(열린 두 단) | X · 1.0×0.77×0.47 | 폭 0.60m | c_shoe_rack_small_2 |

- 웹 판에도 쓸 수 있다(반지하 계단실·현관 꾸밈). 그때는 tools/glb_tex_webp.py 로 색만 1024 webp 로 줄인다(PBR 맵은 웹이 안 쓴다).

## 2. 이음 없는 겉감 4k(4096²) — nano_banana_2_1

고른 판(k)과 웹 판의 축척을 같이 적는다(«한 장 = 실제 몇 m»).

| 겉감 | 고른 판 | 한 장 = | 이음(2×2 · 가장자리 비) | 메모 |
|---|---|---|---|---|
| 반지하 벽지 | tex_banjiha_wallpaper_**1** | 1.5m(꽃 간격 15cm) | 0.8 / 1.3 · 좋음 | 웹은 k3 2k(같은 무늬) |
| 반지하 장판 | tex_banjiha_lino_**2** | 1.4m | 1.5 / 2.4 | |
| 원룸 벽지 | tex_oneroom_wallpaper_**2** | 1.2m | 1.3 / 3.0 | 크림 무지(r2_4 참조) |
| 원룸 마루 | tex_oneroom_oak_**2** | 1.2m(판 12줄 · 폭 10cm) | 2.5 / **7.1** — 판 이음 줄이 보인다 | 유니티에서 50% 밀어 이음을 메운다 |
| 빌라 벽돌(창 없음) | tex_villa_brick_**1** | 2.0m | 1.3 / 0.6 · 좋음 | 금 적은 쪽. outside.js 상자 겉감 후보 |
| 콘크리트 벽 | tex_concrete_wall_**4** | 2.0m | — | 일꾼 고름 |
| 콘크리트 천장 | tex_concrete_ceiling_**1** | 2.0m | — | |
| 계단 인조석 | tex_stair_terrazzo_**1** | 1.0m | — | |

- 색만(albedo) 있다. 노멀·거칠기는 유니티에서 높이 그림으로 굽는다(벽지는 거칠기 0.9 한 값으로 충분).
- 웹 판에 쓴 2k 는 방 색에 맞춰 평균 색을 손본 것이다(tools/tex_room_tile.py). 4k 원본은 손보지 않았다 — 유니티 조명에서 다시 맞춘다.

## 3. 모듈 조각(벽 · 바닥 · 창 · 문) — 크레딧 0

생성 모델은 치수가 안 맞아 조각을 짜 맞출 수 없다. 그래서 house 가 코드 판(house.js)에서 **치수 그대로** GLB 로 낸다(GLTFExporter · 다음 차례).
- 이미 있는 것: 창틀 assets/v2/house/win_studio_cross.glb · win_semi_letterbox.glb · 문 door_wood.glb.
- 낼 것: 벽 1m 조각(두께 0.2 · 높이 2.3/2.5) · 창 구멍 벽(위 둘 크기) · 문 구멍 벽 · 바닥 1×1 · 걸레받이 띠. 단위는 m, 앞 = +Z.
