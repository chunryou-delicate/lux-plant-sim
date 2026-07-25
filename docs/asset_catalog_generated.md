# 볕 · 집/방 에셋 카탈로그 (자동 생성)

> 이 파일은 데이터에서 **자동 생성**됩니다. 원본은 `data/*.json` + `src/render3d/*.js`.
> 모든 에셋은 **코드 생성**(GLB 아님) — 파라미터만 바꿔 찍어냅니다.

## 생성 원칙
- **기하적인 것(창틀·가구·방)은 코드**: 선이 반듯하고 두께가 균일하며, 파라미터화로 종류를 무한 확장.
- **유기적인 것(잎·캐릭터)만 GLB**: Meshy 산출물.
- 색은 데이터(팔레트)로 분리 → 같은 형태를 색만 바꿔 변형 생성.

## 1. 가구 — 프리셋 104종 / 빌더 59종(프리셋이 쓰는 것 58종)

빌더 = `src/render3d/furniture_pastel.js`의 함수. 프리셋 = 그 빌더에 치수·색을 넣은 조합.

| 빌더(type) | 프리셋 수 | 프리셋 id |
|---|---|---|
| `bed` | 5 | bed_single, bed_double, bed_single_maple, bed_single_white, bed_single_mint |
| `desk` | 5 | desk, desk_wide, desk_white, desk_walnut, desk_mint |
| `chair` | 5 | chair, chair_mint, chair_butter, chair_blush, chair_charcoal |
| `sofa` | 5 | sofa, sofa_blush, sofa_sage, sofa_sky, sofa_charcoal |
| `shelf_etagere` | 5 | shelf_etagere_3tier, shelf_ladder_4tier, shelf_etagere_3tier_white, shelf_etagere_3tier_walnut, shelf_etagere_3tier_mint |
| `chair_arm` | 5 | chair_arm, chair_arm_blush, chair_arm_sage, chair_arm_sky, chair_arm_lilac |
| `shelf` | 4 | shelf, shelf_low, shelf_white, shelf_walnut |
| `stool` | 4 | stool, stool_mint, stool_blush, stool_charcoal |
| `wardrobe` | 3 | wardrobe, wardrobe_white, wardrobe_mint |
| `dresser` | 3 | dresser, dresser_white, dresser_sky |
| `table_round` | 3 | table_round, table_round_white, table_round_walnut |
| `nightstand` | 3 | nightstand, nightstand_white, nightstand_mint |
| `coffee_table` | 3 | coffee_table, coffee_table_walnut, coffee_table_white |
| `cube_storage` | 3 | cube_storage, cube_storage_mint, cube_storage_sky |
| `low_table` | 3 | low_table, low_table_white, low_table_walnut |
| `rug` | 2 | rug, rug_mint |
| `lamp_pendant` | 2 | lamp_pendant, lamp_pendant_cone |
| `table` | 1 | table |
| `lamp_floor` | 1 | lamp_floor |
| `lamp_ceiling` | 1 | lamp_ceiling |
| `fridge` | 1 | fridge |
| `kitchen` | 1 | kitchen |
| `tv` | 1 | tv |
| `shelf_windowsill` | 1 | shelf_windowsill |
| `shelf_wall` | 1 | shelf_wall_1tier |
| `shelf_stool` | 1 | shelf_stool_1 |
| `shelf_cart` | 1 | shelf_cart_3tier |
| `shelf_growrack` | 1 | shelf_growrack_2tier |
| `chair_office` | 1 | chair_office |
| `bench` | 1 | bench |
| `bed_bunk` | 1 | bed_bunk |
| `bed_loft` | 1 | bed_loft |
| `mattress` | 1 | mattress |
| `vanity` | 1 | vanity |
| `clothes_rack` | 1 | clothes_rack |
| `storage_box` | 1 | storage_box |
| `mirror` | 1 | mirror |
| `desk_lamp` | 1 | desk_lamp |
| `plant_tray` | 1 | plant_tray_window |
| `shelf_corner` | 1 | shelf_corner_3tier |
| `plant_step` | 1 | plant_step_3 |
| `plant_pedestal` | 1 | plant_pedestal |
| `plant_grid` | 1 | plant_grid_wall |
| `plant_hanger` | 1 | plant_hanger |
| `greenhouse_cabinet` | 1 | greenhouse_cabinet |
| `lamp_wall` | 1 | lamp_wall |
| `string_light` | 1 | string_light |
| `growlight_clip` | 1 | growlight_clip |
| `growlight_bar` | 1 | growlight_bar |
| `growlight_stand` | 1 | growlight_stand |
| `shoe_cabinet` | 1 | shoe_cabinet |
| `tv_stand` | 1 | tv_stand |
| `drying_rack` | 1 | drying_rack |
| `room_divider` | 1 | room_divider |
| `laundry_basket` | 1 | laundry_basket |
| `picture_frame` | 1 | picture_frame |
| `wall_clock` | 1 | wall_clock |
| `floor_cushion` | 1 | floor_cushion |

### 파라미터 구조
```
buildFurniture(type, { w,h,d,  color, accent, gloss,  tiers/rows, ladder, ... })
  → Group (바닥 y=0 기준)
  userData.size_m       {w,d,h}         실제 치수(m)
  userData.slots        [{x,y,z}]       ★화분 놓는 자리(로컬 m)
  userData.tier_heights [y,...]         단 높이 → 조도 입력
  userData.tier_depths_m/tier_max_pot_d 단별 깊이 / 올릴 수 있는 최대 화분 지름
```

### 컬러웨이 14색 (어떤 가구에나 적용)
`oak` 오크 #d9c3a9 · `maple` 메이플 #e6d6bb · `walnut` 월넛 #b08a63 · `cream` 크림 #eae2d6 · `white` 화이트 #f2f0ec · `gray` 연회색 #cfd8dc · `charcoal` 차콜 #5b6067 · `mint` 민트 #c9d6d2 · `sage` 세이지 #d3d9c6 · `blush` 블러시 #e6d3d0 · `sky` 파스텔블루 #cddbe6 · `butter` 버터 #eee0bd · `terra` 테라코타 #d9a88b · `lilac` 라일락 #ddd4e6

### 식물 배치용 선반 21종 (슬롯 보유)
| 프리셋 | 이름 | 크기 | mount | 특성 |
|---|---|---|---|---|
| `shelf` | 책장 | 0.8×1.5 | floor | - |
| `shelf_low` | 낮은 책장 | 1×0.85 | floor | - |
| `shelf_windowsill` | 선반-창턱-확장 | 1×0.16 | window | window |
| `shelf_wall_1tier` | 선반-벽걸이-1단 | 0.8×0.22 | wall | wall |
| `shelf_stool_1` | 선반-스툴-1단 | 0.28×0.355×0.28 | floor | - |
| `shelf_etagere_3tier` | 선반-다단-3단 | 0.72×0.794×0.28 | floor | - |
| `shelf_ladder_4tier` | 선반-사다리-4단 | 0.66×1.3×0.42 | lean-wall | lean-wall |
| `shelf_cart_3tier` | 선반-카트-3단 | 0.46×0.82×0.34 | floor | 이동식 |
| `shelf_growrack_2tier` | 선반-그로우랙-2단 | 0.8×1.16×0.35 | floor | 자체조명 |
| `shelf_white` | 책장(화이트) | 0.8×1.5 | floor | - |
| `shelf_walnut` | 책장(월넛) | 0.8×1.5 | floor | - |
| `plant_tray_window` | 창가 물받이 트레이 | 0.9×0.18 | window | window |
| `shelf_corner_3tier` | 코너 선반-3단 | 0.5×1.05 | corner | corner |
| `plant_step_3` | 계단식 플랜트대-3단 | 0.9×0.28 | floor | - |
| `plant_pedestal` | 화분 받침대(높은) | 0.26×0.62 | floor | - |
| `plant_grid_wall` | 벽 그리드(걸이) | 0.9×0.9 | wall | wall |
| `plant_hanger` | 행잉 플랜터 | 0.26×0.75 | floor | - |
| `greenhouse_cabinet` | 미니 온실장 | 0.7×1.5×0.4 | floor | - |
| `shelf_etagere_3tier_white` | 다단 선반(화이트) | 0.72×0.794×0.28 | floor | - |
| `shelf_etagere_3tier_walnut` | 다단 선반(월넛) | 0.72×0.794×0.28 | floor | - |
| `shelf_etagere_3tier_mint` | 다단 선반(민트) | 0.72×0.794×0.28 | floor | - |

## 2. 창틀 — 39종

빌더 `src/render3d/window_frame.js` → `buildWindowFrame(w, h, opts)`
```
opts = { shape: rect|circle|arch,  pattern: grid|cross|letterbox|slim|curtainwall|none,
         cols, rows, FT(외곽틀), BT(살), depth, corner: sharp|round, sill, sillDepth,
         frameColor, gloss: matte|satin|gloss,
         glass: { type: clear|green-tint|frosted|glassblock|none, transmittance, tintColor } }
```
★ 창 크기(w·h)는 프리셋이 아니라 **방(house_rooms.json)**에서 지정 — 프리셋=룩, 방=크기/위치.

### 빛 공학 연결 필드 (조도 계산이 읽을 값)
- `glass.transmittance` 0~1 — 유리 투과율 (재질 userData에도 보존)
- `light.illumMul` — 실내 광량 계수, `light.diffuse` — 확산광 여부(간유리·유리블럭)

| 프리셋 | 방 | 형태 | pattern | 유리 | 투과 | 광량× | 확산 |
|---|---|---|---|---|---|---|---|
| `win_semi_letterbox` | 반지하 | rect | letterbox 3×1 | frosted | 0.55 | 0.57 | O |
| `win_block_retro` | 반지하(레트로) | rect | grid 3×3 | glassblock | 0.45 | 0.47 | O |
| `win_semi_narrow` | 반지하(소형) | rect | letterbox 2×1 | frosted | 0.55 | 0.57 | O |
| `win_bath_block` | 욕실 | rect | grid 2×2 | glassblock | 0.45 | 0.47 | O |
| `win_bath_frost` | 욕실(소형) | rect | slim 1×2 | frosted | 0.55 | 0.57 | O |
| `win_studio_cross` | 원룸 | rect | cross 2×2 | clear | 0.92 | 1 |  |
| `win_apt_big` | 아파트 거실 | rect | grid 3×2 | clear | 0.92 | 1.05 |  |
| `win_apt_wide` | 아파트 베란다 | rect | grid 2×2 | clear | 0.92 | 1 |  |
| `win_apt_balcony` | 아파트 발코니 | rect | grid 4×2 | clear | 0.92 | 1.05 |  |
| `win_apt_picture` | 아파트 픽처 | rect | none 1×1 | clear | 0.92 | 1.1 |  |
| `win_academy_slim` | 학원/사무 | rect | slim 1×2 | green-tint | 0.8 | 0.82 |  |
| `win_office_grid` | 사무 | rect | grid 2×3 | clear | 0.92 | 1 |  |
| `win_office_black` | 사무(모던) | rect | grid 3×2 | clear | 0.92 | 1 |  |
| `win_loft_steel` | 로프트 | rect | grid 4×3 | clear | 0.92 | 1 |  |
| `win_storefront` | 스토어프론트 | rect | none 1×1 | clear | 0.92 | 1.1 |  |
| `win_cafe_clean` | 카페 | rect | none 1×1 | clear | 0.92 | 1 |  |
| `win_kids_round` | 아기자기 | rect | grid 2×2 | clear | 0.92 | 1 |  |
| `win_greenhouse_wall` | 온실 | rect | curtainwall 3×2 | clear | 0.92 | 1.15 |  |
| `win_sunroom_wide` | 선룸 | rect | curtainwall 4×2 | clear | 0.92 | 1.15 |  |
| `win_veranda_open` | 베란다(개방) | rect | none 1×1 | none | 1 | 1.2 |  |
| `win_gallery_triple` | 갤러리 | rect | curtainwall 5×1 | clear | 0.92 | 1.1 |  |
| `win_cafe_porthole` | 카페(원형) | circle | none 1×1 | clear | 0.92 | 1 |  |
| `win_attic_porthole` | 다락(원형) | circle | cross 2×2 | frosted | 0.55 | 0.57 | O |
| `win_stained_grid` | 스테인드 | rect | grid 4×4 | green-tint | 0.8 | 0.82 |  |
| `win_louver_vent` | 루버창 | rect | slim 1×7 | frosted | 0.55 | 0.57 | O |
| `win_wall_curtain` | 벽체 전체창 | rect | curtainwall 4×3 | clear | 0.92 | 1.1 |  |
| `win_balcony_slide` | 베란다 통창 | rect | grid 3×1 | clear | 0.92 | 1.1 |  |
| `win_panorama_pic` | 파노라마 픽처 | rect | none 1×1 | clear | 0.92 | 1.1 |  |
| `win_sunroom_full` | 선룸 전면 | rect | curtainwall 5×2 | clear | 0.92 | 1.1 |  |
| `win_loft_wall` | 로프트 벽체창 | rect | grid 5×4 | clear | 0.92 | 1.1 |  |
| `win_plant_sill` | 식물창(선반) | rect | grid 2×2 | clear | 0.92 | 1 |  |
| `win_bay_plant` | 베이 식물창 | rect | cross 2×2 | clear | 0.92 | 1 |  |
| `win_arch_garden` | 아치 정원창 | arch | grid 2×2 | clear | 0.92 | 1 |  |
| `win_arch_tall` | 아치 세로창 | arch | grid 1×2 | clear | 0.92 | 1.05 |  |
| `win_conservatory` | 온실 아치 | arch | curtainwall 3×2 | clear | 0.92 | 1.15 |  |
| `win_bay_bench` | 깊은 인방(벤치) | rect | grid 2×2 | clear | 0.92 | 1 |  |
| `win_euro_arch` | 유럽 아치창 | arch | grid 2×3 | clear | 0.92 | 1.05 |  |
| `win_curtainwall_full` | 전면 커튼월 | rect | curtainwall 4×3 | clear | 0.92 | 1.2 |  |
| `win_greenhouse_full` | 온실 벽체 | rect | curtainwall 5×3 | clear | 0.92 | 1.25 |  |

## 3. 조명 · 식물등

계산 모듈 `src/render3d/lighting_sim.js` — 거리 역제곱 감쇠, 광주기, 전기요금, 분위기 점수.

| 기구 | 식물등 | W | 기준PPFD@거리 | 반경 | 기본 스펙트럼 | 가격 |
|---|---|---|---|---|---|---|
| `growlight_clip` 식물등-클립형 | 🌱 | 12 | 120@0.3m | 0.35m | redblue | 18,000원 |
| `growlight_bar` 식물등-바(선반밑) | 🌱 | 20 | 180@0.3m | 0.5m | full | 34,000원 |
| `growlight_stand` 식물등-스탠드 | 🌱 | 36 | 250@0.4m | 0.7m | full | 72,000원 |
| `lamp_ceiling` 천장등 |  | 30 | 12@1.5m | 2.2m | warm | 25,000원 |
| `lamp_floor` 플로어 스탠드 |  | 15 | 8@1m | 1.2m | warm | 39,000원 |
| `lamp_pendant` 펜던트 등 |  | 24 | 10@1.2m | 1.6m | warm | 45,000원 |
| `lamp_wall` 벽등 |  | 10 | 5@0.8m | 1m | warm | 22,000원 |
| `string_light` 스트링 라이트 |  | 6 | 2@0.6m | 1.4m | warm | 12,000원 |
| `desk_lamp` 책상 조명 |  | 8 | 15@0.4m | 0.5m | warm | 19,000원 |

**스펙트럼 트레이드오프** (효율 vs 분위기)
| id | 이름 | 광합성효율 | 예쁨 | 색 |
|---|---|---|---|---|
| `full` | 풀스펙트럼 | ×1 | 1 | #fff4e2 |
| `redblue` | 적청 LED | ×1.25 | 0.35 | #d9a8ff |
| `warm` | 웜 화이트 | ×0.55 | 1.1 | #ffe0b8 |

**광주기 프리셋**: `off`(끄기) · `night`(밤에만(18–24)) · `morning`(아침 보충(6–10)) · `photo12`(광주기 12h(7–19)) · `photo16`(광주기 16h(6–22)) · `always`(상시(24h))
**전기 단가**: 160원/kWh

## 4. 방

| 방 | 크기(W×D×H) | 벽/바닥/천장 | 창 | 문 | 칸막이 | 가구 |
|---|---|---|---|---|---|---|
| `banjiha` 반지하 | 5×4×2.3 | w_concrete/f_cement/c_concrete | 1 | 1 | 0 | 9 |
| `oneroom` 원룸 | 6×5×2.5 | w_cream/f_oak/c_white | 1 | 1 | 0 | 10 |
| `apartment` 아파트 | 8×6×2.6 | w_pure/f_oak/c_white | 2 | 1 | 1 | 11 |
| `classroom` 학원교실 | 8×6×2.8 | -/-/- | 3 | 1 | 0 | 0 |
| `greenhouse` 온실 | 5×5×2.8 | -/-/- | 0 | 1 | 0 | 0 |
| `tworoom` 투룸 | 7×5×2.5 | w_cream/f_oak/c_white | 2 | 1 | 1 | 9 |

### 마감재 팔레트
- 벽지 10종: 크림 화이트, 퓨어 화이트, 민트, 파스텔 블루, 파스텔 핑크, 버터 옐로, 세이지, 연회색, 시멘트(반지하), 베이지
- 바닥 12종: 오크 (원목)(plank), 월넛 (원목)(plank), 메이플 (원목)(plank), 애쉬 그레이 (원목)(plank), 화이트 (타일)(tile), 그레이 (타일)(tile), 우드 (타일2)(tile2), 베이지 (타일2)(tile2), 그레이 (타일2)(tile2), 시멘트(반지하), 카펫 베이지, 파스텔 핑크
- 천장 5종: 화이트, 크림, 연회색, 시멘트(반지하), 우드 서까래
- 문 8종: 기본 문 (크림), 기본 문 (화이트), 우드 문, 찐우드 문, 민트 문, 간유리 문, 유리 문, 차콜 스틸 문

## 5. 소스 파일
| 파일 | 내용 |
|---|---|
| `src/render3d/furniture_pastel.js` | 가구 빌더(36종) |
| `src/render3d/window_frame.js` | 창틀·문 빌더 |
| `src/render3d/house.js` | 방 조립(벽·바닥·천장·칸막이·개구부·가구·조명 배치) |
| `src/render3d/lighting_sim.js` | 조명 계산(순수함수) |
| `data/*.json` | 프리셋 데이터 |
