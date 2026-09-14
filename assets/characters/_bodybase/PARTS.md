# 부품 목록 — 자취녀(여캐)·남캐 갈아입히기

2026-09-13~14 · 총괄. 전부 `char_*_base_v19_rigged.glb` 의 24본 뼈대에 이식됨 — 클립 하나(`*_v19_walk.glb`)로 다 움직인다.

## 어떻게 입히나
- 몸: `*_body_v19_under_<옷>.glb` (그 옷 아래 몸 면을 지운 몸) + 옷 + 머리 + `*_face_eyes1.glb`(눈)
- 눈 그림은 `assets/characters/eyes/eyes_*.png` 여섯 종 — `glb_face_decal.py` 로 갈아 끼운다
- 새 부품은 `tools/char/make_part.py` (시트 → 굽기 → 떼기 → 감싸 맞추기 → 무게 이식) 한 줄. 색은 `pick_color.py` 로 잰다
- ⚠ 질 낮음 표시는 텍스처가 얼룩지거나 떼기가 덜 된 것 — 게임에 넣기 전 눈으로 볼 것

## ★ 2026-09-14 낮 — 「지직지직·매칭 안 됨」 고침
- 렌더러(가짜 점) · refit(옷 구김·가슴 찢김) · 남캐 맨몸(접시 가슴·구멍) 세 가지를 고치고 옷 128벌을 전부 다시 감쌌다. README 3~4절.
- 옷마다 `masks/<옷>_mask.json`(지울 몸 면 번호). 조합은 `tools/char/glb_apply_masks.py` 로 합집합.
- 전 부품 표: `docs/handoff/img/bodytest/catalog/catalog_<누구>_<종류>.png` (같은 자세·같은 크기, 옷 밑 몸 면 지운 상태)

## 몇 개 (2026-09-14 · 26차까지)
- 여캐 머리 13
- 여캐 상의 20
- 여캐 하의 17
- 여캐 신발 23
- 여캐 원피스 4
- 여캐 세트 1
- 여캐 소품 4
- 여캐 모자 1
- 여캐 눈 1
- 남캐 머리 9
- 남캐 상의 20
- 남캐 하의 17
- 남캐 신발 18
- 남캐 세트 2
- 남캐 소품 1
- 남캐 모자 1
- 남캐 눈 1
- 질 낮음 표시 7개 · 정본 맨몸 `char_yeoja_base_v19_rigged.glb` / `char_namja_base_v19_rigged.glb` · 클립 `yeoja_v19_walk.glb` / `namja_v19_walk.glb`

| 누구 | 종류 | 파일 | KB | 마스크 |
|---|---|---|---|---|
| 여캐 | 머리 | `yeoja_hair10_pink_rigged.glb` | 6,615 |  |
| 여캐 | 머리 | `yeoja_hair11_blackwavy_rigged.glb` | 14,786 |  |
| 여캐 | 머리 | `yeoja_hair12_spacebuns_rigged.glb` | 5,170 |  |
| 여캐 | 머리 | `yeoja_hair13_longstraight_rigged.glb` | 7,841 |  |
| 여캐 | 머리 | `yeoja_hair1_rigged.glb` | 8,191 |  |
| 여캐 | 머리 | `yeoja_hair2_bob_rigged.glb` | 5,992 |  |
| 여캐 | 머리 | `yeoja_hair3_pony_rigged.glb` | 6,737 |  |
| 여캐 | 머리 | `yeoja_hair4_twin_rigged.glb` | 7,680 |  |
| 여캐 | 머리 | `yeoja_hair5_shortwavy_rigged.glb` | 5,213 |  |
| 여캐 | 머리 | `yeoja_hair6_ashblonde_rigged.glb` | 12,074 |  |
| 여캐 | 머리 | `yeoja_hair7_braid_rigged.glb` | 4,341 |  |
| 여캐 | 머리 | `yeoja_hair8_bun_rigged.glb` | 4,896 |  |
| 여캐 | 머리 | `yeoja_hair9_pixie_rigged.glb` | 6,653 |  |
| 여캐 | 상의 | `yeoja_top10_puffer_rigged.glb` | 4,256 | O |
| 여캐 | 상의 | `yeoja_top11_gardentee_rigged.glb` | 3,461 | O |
| 여캐 | 상의 | `yeoja_top12_labcoat_rigged.glb` | 5,332 | O |
| 여캐 | 상의 | `yeoja_top13_blackturtle_rigged.glb` | 2,442 | O |
| 여캐 | 상의 | `yeoja_top14_sailor_rigged.glb` | 4,018 | O |
| 여캐 | 상의 | `yeoja_top15_parka_rigged.glb` | 7,741 | O |
| 여캐 | 상의 | `yeoja_top16_raincoat_rigged.glb` | 4,886 | O |
| 여캐 | 상의 | `yeoja_top17_biker_rigged.glb` | 6,271 | O |
| 여캐 | 상의 | `yeoja_top18_denim_rigged.glb` | 5,025 | O |
| 여캐 | 상의 | `yeoja_top19_purplecardi_rigged.glb` | 6,793 | O |
| 여캐 | 상의 | `yeoja_top20_orangehoodie_rigged.glb` | 6,640 | O |
| 여캐 | 상의 | `yeoja_top21_peacoat_rigged.glb` | 4,612 | O |
| 여캐 | 상의 | `yeoja_top2_hoodie_rigged.glb` | 4,245 | O |
| 여캐 | 상의 | `yeoja_top3_blouse_rigged.glb` | 4,130 | O |
| 여캐 | 상의 | `yeoja_top4_cardigan_rigged.glb` | 3,417 | O |
| 여캐 | 상의 | `yeoja_top5_coat_rigged.glb` | 4,264 | O |
| 여캐 | 상의 | `yeoja_top6_tank_rigged.glb` | 2,794 | O |
| 여캐 | 상의 | `yeoja_top7_track_rigged.glb` | 4,142 | O |
| 여캐 | 상의 | `yeoja_top8_orange_rigged.glb` | 4,290 | O |
| 여캐 | 상의 | `yeoja_top9_turtle_rigged.glb` | 7,191 | O |
| 여캐 | 하의 | `yeoja_bottom10_jeans2_rigged.glb` | 2,948 | O |
| 여캐 | 하의 | `yeoja_bottom11_navyskirt_rigged.glb` | 13,227 | O |
| 여캐 | 하의 | `yeoja_bottom12_burgskirt_rigged.glb` | 3,310 | O |
| 여캐 | 하의 | `yeoja_bottom13_leggings2_rigged.glb` | 2,610 | O |
| 여캐 | 하의 | `yeoja_bottom14_redmini_rigged.glb` | 3,049 | O |
| 여캐 | 하의 | `yeoja_bottom15_plaidskirt_rigged.glb` | 5,136 | O |
| 여캐 | 하의 | `yeoja_bottom16_sweatpants_rigged.glb` | 3,323 | O |
| 여캐 | 하의 | `yeoja_bottom17_grayskirt_rigged.glb` | 3,190 | O |
| 여캐 | 하의 | `yeoja_bottom1_jeans_rigged.glb` | 3,200 | O |
| 여캐 | 하의 | `yeoja_bottom2_skirt_rigged.glb` | 7,470 | O |
| 여캐 | 하의 | `yeoja_bottom3_shorts_rigged.glb` | 2,767 | O |
| 여캐 | 하의 | `yeoja_bottom4_wshorts_rigged.glb` | 3,551 | O |
| 여캐 | 하의 | `yeoja_bottom5_leggings_rigged.glb` | 3,292 | O |
| 여캐 | 하의 | `yeoja_bottom6_overalls_rigged.glb` | 4,351 | O |
| 여캐 | 하의 | `yeoja_bottom7_cordskirt_rigged.glb` | 7,530 | O |
| 여캐 | 하의 | `yeoja_bottom8_widepants_rigged.glb` | 3,298 | O |
| 여캐 | 하의 | `yeoja_bottom9_graypants_rigged.glb` | 3,075 | O |
| 여캐 | 신발 | `yeoja_shoes10_loafers_rigged.glb` | 3,647 | O |
| 여캐 | 신발 | `yeoja_shoes11_chunky_rigged.glb` | 2,326 | O |
| 여캐 | 신발 | `yeoja_shoes12_redboots_rigged.glb` | 3,146 | O |
| 여캐 | 신발 | `yeoja_shoes13_gray_rigged.glb` | 2,340 | O |
| 여캐 | 신발 | `yeoja_shoes14_bloafers_rigged.glb` | 3,096 | O |
| 여캐 | 신발 | `yeoja_shoes15_tanboots_rigged.glb` | 2,712 | O |
| 여캐 | 신발 | `yeoja_shoes16_kneeboots_rigged.glb` | 3,526 | O |
| 여캐 | 신발 | `yeoja_shoes17_tealboots_rigged.glb` | 3,146 | O |
| 여캐 | 신발 | `yeoja_shoes18_hitops_rigged.glb` | 4,202 | O |
| 여캐 | 신발 | `yeoja_shoes19_pink_rigged.glb` | 2,439 | O |
| 여캐 | 신발 | `yeoja_shoes1_sneakers_rigged.glb` | 2,719 | O |
| 여캐 | 신발 | `yeoja_shoes20_redcanvas_rigged.glb` | 3,055 | O |
| 여캐 | 신발 | `yeoja_shoes21_loafers2_rigged.glb` | 3,481 | O |
| 여캐 | 신발 | `yeoja_shoes22_blueslippers_rigged.glb` | 2,790 | O |
| 여캐 | 신발 | `yeoja_shoes23_laceboots_rigged.glb` | 3,588 | O |
| 여캐 | 신발 | `yeoja_shoes2_flats_rigged.glb` | 2,291 | O |
| 여캐 | 신발 | `yeoja_shoes3_sandals_rigged.glb` | 2,524 | O |
| 여캐 | 신발 | `yeoja_shoes4_slippers_rigged.glb` | 2,521 | O |
| 여캐 | 신발 | `yeoja_shoes5_boots_rigged.glb` | 2,796 | O |
| 여캐 | 신발 | `yeoja_shoes6_fluffy_rigged.glb` | 2,771 | O |
| 여캐 | 신발 | `yeoja_shoes7_osandals_rigged.glb` | 2,818 | O |
| 여캐 | 신발 | `yeoja_shoes8_running_rigged.glb` | 2,928 | O |
| 여캐 | 신발 | `yeoja_shoes9_rainboots_rigged.glb` | 4,079 | O |
| 여캐 | 원피스 | `yeoja_dress1_yellow_rigged.glb` | 8,870 | O |
| 여캐 | 원피스 | `yeoja_dress2_knit_rigged.glb` ⚠ 질 낮음 | 4,511 | O |
| 여캐 | 원피스 | `yeoja_dress3_hoodie_rigged.glb` ⚠ 질 낮음 | 4,999 | O |
| 여캐 | 원피스 | `yeoja_dress4_sundress_rigged.glb` | 4,135 | O |
| 여캐 | 세트 | `yeoja_set1_pajama_rigged.glb` | 6,049 | O |
| 여캐 | 소품 | `yeoja_acc1_scarf_rigged.glb` | 3,286 | O |
| 여캐 | 소품 | `yeoja_acc2_apron_rigged.glb` | 5,834 | O |
| 여캐 | 소품 | `yeoja_acc3_ribbon_rigged.glb` | 2,658 | O |
| 여캐 | 소품 | `yeoja_acc4_kneesocks_rigged.glb` | 2,755 | O |
| 여캐 | 모자 | `yeoja_hat1_beanie_rigged.glb` | 12,520 |  |
| 여캐 | 눈 | `yeoja_face_eyes1.glb` | 298 |  |
| 남캐 | 머리 | `namja_hair1_short_rigged.glb` | 5,700 |  |
| 남캐 | 머리 | `namja_hair2_wavy_rigged.glb` | 7,029 |  |
| 남캐 | 머리 | `namja_hair3_buzz_rigged.glb` ⚠ 질 낮음 | 2,307 |  |
| 남캐 | 머리 | `namja_hair4_spiky_rigged.glb` ⚠ 질 낮음 | 6,088 |  |
| 남캐 | 머리 | `namja_hair5_curly_rigged.glb` | 4,733 |  |
| 남캐 | 머리 | `namja_hair6_manbun_rigged.glb` | 5,104 |  |
| 남캐 | 머리 | `namja_hair7_ashgray_rigged.glb` | 3,821 |  |
| 남캐 | 머리 | `namja_hair8_blonde_rigged.glb` | 5,401 |  |
| 남캐 | 머리 | `namja_hair9_undercut_rigged.glb` | 3,647 |  |
| 남캐 | 상의 | `namja_top10_raincoat_rigged.glb` | 6,028 | O |
| 남캐 | 상의 | `namja_top11_track_rigged.glb` | 4,440 | O |
| 남캐 | 상의 | `namja_top12_grayhoodie_rigged.glb` | 5,452 | O |
| 남캐 | 상의 | `namja_top13_whiteshirt_rigged.glb` | 3,457 | O |
| 남캐 | 상의 | `namja_top14_vest_rigged.glb` | 3,134 | O |
| 남캐 | 상의 | `namja_top17_camp_rigged.glb` | 7,332 | O |
| 남캐 | 상의 | `namja_top18_blackturtle_rigged.glb` | 9,504 | O |
| 남캐 | 상의 | `namja_top19_biker_rigged.glb` ⚠ 질 낮음 | 6,456 | O |
| 남캐 | 상의 | `namja_top20_whitetee_rigged.glb` ⚠ 질 낮음 | 2,843 | O |
| 남캐 | 상의 | `namja_top21_trench_rigged.glb` | 5,231 | O |
| 남캐 | 상의 | `namja_top22_utility_rigged.glb` | 6,195 | O |
| 남캐 | 상의 | `namja_top23_yellowhoodie_rigged.glb` | 4,488 | O |
| 남캐 | 상의 | `namja_top24_burgundyknit_rigged.glb` | 9,044 | O |
| 남캐 | 상의 | `namja_top2_hoodie_rigged.glb` | 5,004 | O |
| 남캐 | 상의 | `namja_top3_tee_rigged.glb` | 3,590 | O |
| 남캐 | 상의 | `namja_top5_coat_rigged.glb` | 5,720 | O |
| 남캐 | 상의 | `namja_top6_shirt_rigged.glb` | 4,845 | O |
| 남캐 | 상의 | `namja_top7_dressshirt_rigged.glb` | 2,791 | O |
| 남캐 | 상의 | `namja_top8_denim_rigged.glb` | 6,091 | O |
| 남캐 | 상의 | `namja_top9_yellowtee_rigged.glb` | 3,647 | O |
| 남캐 | 하의 | `namja_bottom10_jogger_rigged.glb` | 3,832 | O |
| 남캐 | 하의 | `namja_bottom11_blacktrousers_rigged.glb` | 3,609 | O |
| 남캐 | 하의 | `namja_bottom13_wshorts_rigged.glb` | 4,233 | O |
| 남캐 | 하의 | `namja_bottom14_wooltrousers_rigged.glb` ⚠ 질 낮음 | 5,000 | O |
| 남캐 | 하의 | `namja_bottom15_dgjeans_rigged.glb` | 5,913 | O |
| 남캐 | 하의 | `namja_bottom16_jeans3_rigged.glb` | 2,948 | O |
| 남캐 | 하의 | `namja_bottom17_cargo_rigged.glb` | 4,973 | O |
| 남캐 | 하의 | `namja_bottom18_bluejeans_rigged.glb` | 3,273 | O |
| 남캐 | 하의 | `namja_bottom19_charcoal_rigged.glb` | 4,621 | O |
| 남캐 | 하의 | `namja_bottom1_chino_rigged.glb` | 5,493 | O |
| 남캐 | 하의 | `namja_bottom2_jeans_rigged.glb` | 3,506 | O |
| 남캐 | 하의 | `namja_bottom4_navy_rigged.glb` | 2,884 | O |
| 남캐 | 하의 | `namja_bottom5_kshorts_rigged.glb` | 3,390 | O |
| 남캐 | 하의 | `namja_bottom6_blackjeans_rigged.glb` | 4,302 | O |
| 남캐 | 하의 | `namja_bottom7_workpants_rigged.glb` | 3,543 | O |
| 남캐 | 하의 | `namja_bottom8_darkblue_rigged.glb` | 2,568 | O |
| 남캐 | 하의 | `namja_bottom9_trackpants_rigged.glb` | 3,635 | O |
| 남캐 | 신발 | `namja_shoes10_orange_rigged.glb` | 3,453 | O |
| 남캐 | 신발 | `namja_shoes11_slides_rigged.glb` | 3,415 | O |
| 남캐 | 신발 | `namja_shoes12_oxford_rigged.glb` | 2,755 | O |
| 남캐 | 신발 | `namja_shoes14_bsandals_rigged.glb` | 2,643 | O |
| 남캐 | 신발 | `namja_shoes15_chelsea_rigged.glb` | 3,806 | O |
| 남캐 | 신발 | `namja_shoes16_workboots_rigged.glb` | 4,399 | O |
| 남캐 | 신발 | `namja_shoes17_white2_rigged.glb` | 2,088 | O |
| 남캐 | 신발 | `namja_shoes18_hiking_rigged.glb` | 4,044 | O |
| 남캐 | 신발 | `namja_shoes19_whitesneak_rigged.glb` | 2,692 | O |
| 남캐 | 신발 | `namja_shoes1_sneakers_rigged.glb` | 2,497 | O |
| 남캐 | 신발 | `namja_shoes20_brownboots_rigged.glb` | 3,441 | O |
| 남캐 | 신발 | `namja_shoes2_black_rigged.glb` | 2,478 | O |
| 남캐 | 신발 | `namja_shoes4_boots_rigged.glb` | 2,933 | O |
| 남캐 | 신발 | `namja_shoes5_red_rigged.glb` | 2,485 | O |
| 남캐 | 신발 | `namja_shoes6_dress_rigged.glb` | 3,068 | O |
| 남캐 | 신발 | `namja_shoes7_white_rigged.glb` | 3,740 | O |
| 남캐 | 신발 | `namja_shoes8_rubber_rigged.glb` | 3,148 | O |
| 남캐 | 신발 | `namja_shoes9_rubber2_rigged.glb` | 2,989 | O |
| 남캐 | 세트 | `namja_set1_sweater_rigged.glb` | 10,370 | O |
| 남캐 | 세트 | `namja_set2_suit_rigged.glb` | 5,379 | O |
| 남캐 | 소품 | `namja_acc1_apron_rigged.glb` | 4,391 | O |
| 남캐 | 모자 | `namja_hat1_cap_rigged.glb` | 4,058 |  |
| 남캐 | 눈 | `namja_face_eyes1.glb` | 298 |  |
