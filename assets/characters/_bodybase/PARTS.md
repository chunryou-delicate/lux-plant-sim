# 부품 목록 — 자취녀(여캐)·남캐 갈아입히기

2026-09-13~14 · 총괄. 전부 `char_*_base_v19_rigged.glb` 의 24본 뼈대에 이식됨 — 클립 하나(`*_v19_walk.glb`)로 다 움직인다.

## 어떻게 입히나
- 몸: `*_body_v19_under_<옷>.glb` (그 옷 아래 몸 면을 지운 몸) + 옷 + 머리 + `*_face_eyes1.glb`(눈)
- 눈 그림은 `assets/characters/eyes/eyes_*.png` 여섯 종 — `glb_face_decal.py` 로 갈아 끼운다
- 새 부품은 `tools/char/make_part.py` (시트 → 굽기 → 떼기 → 감싸 맞추기 → 무게 이식) 한 줄. 색은 `pick_color.py` 로 잰다
- ⚠ 질 낮음 표시는 텍스처가 얼룩지거나 떼기가 덜 된 것 — 게임에 넣기 전 눈으로 볼 것

| 누구 | 종류 | 파일 | KB |
|---|---|---|---|
| 남캐 | ? | `namja_shirt1_navy_rigged.glb` | 6,746 |
| 남캐 | ? | `namja_shirt1_rigged.glb` | 1,721 |
| 남캐 | 맨몸 | `char_namja_base_v17_rigged.glb` | 6,791 |
| 남캐 | 맨몸 | `char_namja_base_v19_rigged.glb` | 9,986 |
| 남캐 | 맨몸 | `char_namja_base_v3_rigged.glb` | 8,205 |
| 남캐 | 맨몸 | `char_yeoja_base_rigged.glb` | 13,792 |
| 남캐 | 맨몸 | `char_yeoja_base_v10_rigged.glb` | 5,172 |
| 남캐 | 맨몸 | `char_yeoja_base_v13_rigged.glb` | 8,205 |
| 남캐 | 맨몸 | `char_yeoja_base_v17_rigged.glb` | 6,580 |
| 남캐 | 맨몸 | `char_yeoja_base_v19_rigged.glb` | 7,057 |
| 남캐 | 맨몸 | `char_yeoja_base_v3t_rigged.glb` | 7,506 |
| 남캐 | 맨몸 | `char_yeoja_base_v4_rigged.glb` | 7,656 |
| 남캐 | 머리 | `namja_hair1_short_rigged.glb` | 5,700 |
| 남캐 | 머리 | `namja_hair2_wavy_rigged.glb` | 7,029 |
| 남캐 | 머리 | `namja_hair3_buzz_rigged.glb` ⚠ 질 낮음 | 2,307 |
| 남캐 | 머리 | `namja_hair4_spiky_rigged.glb` ⚠ 질 낮음 | 6,088 |
| 남캐 | 머리 | `namja_hair5_curly_rigged.glb` | 4,733 |
| 남캐 | 머리 | `namja_hair6_manbun_rigged.glb` | 5,104 |
| 남캐 | 머리 | `namja_hair7_ashgray_rigged.glb` | 3,821 |
| 남캐 | 머리 | `namja_hair8_blonde_rigged.glb` | 5,401 |
| 남캐 | 모자 | `namja_hat1_cap_rigged.glb` | 4,058 |
| 남캐 | 상의 | `namja_top10_raincoat_rigged.glb` | 6,028 |
| 남캐 | 상의 | `namja_top11_track_rigged.glb` | 4,440 |
| 남캐 | 상의 | `namja_top12_grayhoodie_rigged.glb` | 5,452 |
| 남캐 | 상의 | `namja_top13_whiteshirt_rigged.glb` | 3,457 |
| 남캐 | 상의 | `namja_top14_vest_rigged.glb` | 3,134 |
| 남캐 | 상의 | `namja_top17_camp_rigged.glb` | 7,332 |
| 남캐 | 상의 | `namja_top18_blackturtle_rigged.glb` | 9,504 |
| 남캐 | 상의 | `namja_top19_biker_rigged.glb` ⚠ 질 낮음 | 6,456 |
| 남캐 | 상의 | `namja_top20_whitetee_rigged.glb` ⚠ 질 낮음 | 2,843 |
| 남캐 | 상의 | `namja_top2_hoodie_rigged.glb` | 5,004 |
| 남캐 | 상의 | `namja_top3_tee_rigged.glb` | 3,590 |
| 남캐 | 상의 | `namja_top5_coat_rigged.glb` | 5,720 |
| 남캐 | 상의 | `namja_top6_shirt_rigged.glb` | 4,845 |
| 남캐 | 상의 | `namja_top7_dressshirt_rigged.glb` | 2,791 |
| 남캐 | 상의 | `namja_top8_denim_rigged.glb` | 6,091 |
| 남캐 | 상의 | `namja_top9_yellowtee_rigged.glb` | 3,647 |
| 남캐 | 소품 | `namja_acc1_apron_rigged.glb` | 4,391 |
| 남캐 | 신발 | `namja_shoes10_orange_rigged.glb` | 3,453 |
| 남캐 | 신발 | `namja_shoes11_slides_rigged.glb` | 3,415 |
| 남캐 | 신발 | `namja_shoes12_oxford_rigged.glb` | 2,755 |
| 남캐 | 신발 | `namja_shoes14_bsandals_rigged.glb` | 2,643 |
| 남캐 | 신발 | `namja_shoes15_chelsea_rigged.glb` | 3,806 |
| 남캐 | 신발 | `namja_shoes16_workboots_rigged.glb` | 4,399 |
| 남캐 | 신발 | `namja_shoes1_sneakers_rigged.glb` | 2,497 |
| 남캐 | 신발 | `namja_shoes2_black_rigged.glb` | 2,478 |
| 남캐 | 신발 | `namja_shoes4_boots_rigged.glb` | 2,933 |
| 남캐 | 신발 | `namja_shoes5_red_rigged.glb` | 2,485 |
| 남캐 | 신발 | `namja_shoes6_dress_rigged.glb` | 3,068 |
| 남캐 | 신발 | `namja_shoes7_white_rigged.glb` | 3,740 |
| 남캐 | 신발 | `namja_shoes8_rubber_rigged.glb` | 3,148 |
| 남캐 | 신발 | `namja_shoes9_rubber2_rigged.glb` | 2,989 |
| 남캐 | 하의 | `namja_bottom10_jogger_rigged.glb` | 3,832 |
| 남캐 | 하의 | `namja_bottom11_blacktrousers_rigged.glb` | 3,609 |
| 남캐 | 하의 | `namja_bottom13_wshorts_rigged.glb` | 4,233 |
| 남캐 | 하의 | `namja_bottom14_wooltrousers_rigged.glb` ⚠ 질 낮음 | 5,000 |
| 남캐 | 하의 | `namja_bottom15_dgjeans_rigged.glb` | 5,913 |
| 남캐 | 하의 | `namja_bottom1_chino_rigged.glb` | 5,493 |
| 남캐 | 하의 | `namja_bottom2_jeans_rigged.glb` | 3,506 |
| 남캐 | 하의 | `namja_bottom4_navy_rigged.glb` | 2,884 |
| 남캐 | 하의 | `namja_bottom5_kshorts_rigged.glb` | 3,390 |
| 남캐 | 하의 | `namja_bottom6_blackjeans_rigged.glb` | 4,302 |
| 남캐 | 하의 | `namja_bottom7_workpants_rigged.glb` | 3,543 |
| 남캐 | 하의 | `namja_bottom8_darkblue_rigged.glb` | 2,568 |
| 남캐 | 하의 | `namja_bottom9_trackpants_rigged.glb` | 3,635 |
| 남캐 | 한 벌 | `namja_set1_sweater_rigged.glb` | 10,370 |
| 남캐 | 한 벌 | `namja_set2_suit_rigged.glb` | 5,379 |
| 여캐 | ? | `yeoja_shirt1_rigged.glb` | 6,050 |
| 여캐 | 머리 | `yeoja_hair10_pink_rigged.glb` | 6,615 |
| 여캐 | 머리 | `yeoja_hair11_blackwavy_rigged.glb` | 14,786 |
| 여캐 | 머리 | `yeoja_hair1_rigged.glb` | 8,191 |
| 여캐 | 머리 | `yeoja_hair2_bob_rigged.glb` | 5,992 |
| 여캐 | 머리 | `yeoja_hair3_pony_rigged.glb` | 6,737 |
| 여캐 | 머리 | `yeoja_hair4_twin_rigged.glb` | 7,680 |
| 여캐 | 머리 | `yeoja_hair5_shortwavy_rigged.glb` | 5,213 |
| 여캐 | 머리 | `yeoja_hair6_ashblonde_rigged.glb` | 12,074 |
| 여캐 | 머리 | `yeoja_hair7_braid_rigged.glb` | 4,341 |
| 여캐 | 머리 | `yeoja_hair8_bun_rigged.glb` | 4,896 |
| 여캐 | 머리 | `yeoja_hair9_pixie_rigged.glb` | 6,653 |
| 여캐 | 모자 | `yeoja_hat1_beanie_rigged.glb` | 12,520 |
| 여캐 | 상의 | `yeoja_top10_puffer_rigged.glb` | 4,256 |
| 여캐 | 상의 | `yeoja_top11_gardentee_rigged.glb` | 3,461 |
| 여캐 | 상의 | `yeoja_top12_labcoat_rigged.glb` | 5,332 |
| 여캐 | 상의 | `yeoja_top13_blackturtle_rigged.glb` | 2,442 |
| 여캐 | 상의 | `yeoja_top14_sailor_rigged.glb` | 4,018 |
| 여캐 | 상의 | `yeoja_top15_parka_rigged.glb` | 7,741 |
| 여캐 | 상의 | `yeoja_top16_raincoat_rigged.glb` | 4,886 |
| 여캐 | 상의 | `yeoja_top17_biker_rigged.glb` | 6,271 |
| 여캐 | 상의 | `yeoja_top18_denim_rigged.glb` | 5,025 |
| 여캐 | 상의 | `yeoja_top2_hoodie_rigged.glb` | 4,245 |
| 여캐 | 상의 | `yeoja_top3_blouse_rigged.glb` | 4,130 |
| 여캐 | 상의 | `yeoja_top4_cardigan_rigged.glb` | 3,417 |
| 여캐 | 상의 | `yeoja_top5_coat_rigged.glb` | 4,264 |
| 여캐 | 상의 | `yeoja_top6_tank_rigged.glb` | 2,794 |
| 여캐 | 상의 | `yeoja_top7_track_rigged.glb` | 4,142 |
| 여캐 | 상의 | `yeoja_top8_orange_rigged.glb` | 4,290 |
| 여캐 | 상의 | `yeoja_top9_turtle_rigged.glb` | 7,191 |
| 여캐 | 소품 | `yeoja_acc1_scarf_rigged.glb` | 3,286 |
| 여캐 | 소품 | `yeoja_acc2_apron_rigged.glb` | 5,834 |
| 여캐 | 소품 | `yeoja_acc3_ribbon_rigged.glb` | 2,658 |
| 여캐 | 소품 | `yeoja_acc4_kneesocks_rigged.glb` | 2,755 |
| 여캐 | 신발 | `yeoja_shoes10_loafers_rigged.glb` | 3,647 |
| 여캐 | 신발 | `yeoja_shoes11_chunky_rigged.glb` | 2,326 |
| 여캐 | 신발 | `yeoja_shoes12_redboots_rigged.glb` | 3,146 |
| 여캐 | 신발 | `yeoja_shoes13_gray_rigged.glb` | 2,340 |
| 여캐 | 신발 | `yeoja_shoes14_bloafers_rigged.glb` | 3,096 |
| 여캐 | 신발 | `yeoja_shoes15_tanboots_rigged.glb` | 2,712 |
| 여캐 | 신발 | `yeoja_shoes16_kneeboots_rigged.glb` | 3,526 |
| 여캐 | 신발 | `yeoja_shoes17_tealboots_rigged.glb` | 3,146 |
| 여캐 | 신발 | `yeoja_shoes18_hitops_rigged.glb` | 4,202 |
| 여캐 | 신발 | `yeoja_shoes19_pink_rigged.glb` | 2,439 |
| 여캐 | 신발 | `yeoja_shoes1_sneakers_rigged.glb` | 2,719 |
| 여캐 | 신발 | `yeoja_shoes20_redcanvas_rigged.glb` | 3,055 |
| 여캐 | 신발 | `yeoja_shoes2_flats_rigged.glb` | 2,291 |
| 여캐 | 신발 | `yeoja_shoes3_sandals_rigged.glb` | 2,524 |
| 여캐 | 신발 | `yeoja_shoes4_slippers_rigged.glb` | 2,521 |
| 여캐 | 신발 | `yeoja_shoes5_boots_rigged.glb` | 2,796 |
| 여캐 | 신발 | `yeoja_shoes6_fluffy_rigged.glb` | 2,771 |
| 여캐 | 신발 | `yeoja_shoes7_osandals_rigged.glb` | 2,818 |
| 여캐 | 신발 | `yeoja_shoes8_running_rigged.glb` | 2,928 |
| 여캐 | 신발 | `yeoja_shoes9_rainboots_rigged.glb` | 4,079 |
| 여캐 | 원피스 | `yeoja_dress1_yellow_rigged.glb` | 8,870 |
| 여캐 | 원피스 | `yeoja_dress2_knit_rigged.glb` ⚠ 질 낮음 | 4,511 |
| 여캐 | 원피스 | `yeoja_dress3_hoodie_rigged.glb` ⚠ 질 낮음 | 4,999 |
| 여캐 | 원피스 | `yeoja_dress4_sundress_rigged.glb` | 4,135 |
| 여캐 | 하의 | `yeoja_bottom10_jeans2_rigged.glb` | 2,948 |
| 여캐 | 하의 | `yeoja_bottom11_navyskirt_rigged.glb` | 13,227 |
| 여캐 | 하의 | `yeoja_bottom12_burgskirt_rigged.glb` | 3,310 |
| 여캐 | 하의 | `yeoja_bottom13_leggings2_rigged.glb` | 2,610 |
| 여캐 | 하의 | `yeoja_bottom14_redmini_rigged.glb` | 3,049 |
| 여캐 | 하의 | `yeoja_bottom1_jeans_rigged.glb` | 3,200 |
| 여캐 | 하의 | `yeoja_bottom2_skirt_rigged.glb` | 7,470 |
| 여캐 | 하의 | `yeoja_bottom3_shorts_rigged.glb` | 2,767 |
| 여캐 | 하의 | `yeoja_bottom4_wshorts_rigged.glb` | 3,551 |
| 여캐 | 하의 | `yeoja_bottom5_leggings_rigged.glb` | 3,292 |
| 여캐 | 하의 | `yeoja_bottom6_overalls_rigged.glb` | 4,351 |
| 여캐 | 하의 | `yeoja_bottom7_cordskirt_rigged.glb` | 7,530 |
| 여캐 | 하의 | `yeoja_bottom8_widepants_rigged.glb` | 3,298 |
| 여캐 | 하의 | `yeoja_bottom9_graypants_rigged.glb` | 3,075 |
| 여캐 | 한 벌 | `yeoja_set1_pajama_rigged.glb` | 6,049 |

## 옷 아래 몸(옷마다 하나)

- `namja_body_v19_under_camp.glb`
- `namja_body_v19_under_coat.glb`
- `namja_body_v19_under_denim.glb`
- `namja_body_v19_under_garden.glb`
- `namja_body_v19_under_lounge.glb`
- `namja_body_v19_under_mbiker.glb`
- `namja_body_v19_under_outfit2.glb`
- `namja_body_v19_under_outfit3.glb`
- `namja_body_v19_under_outfit4.glb`
- `namja_body_v19_under_raincoat.glb`
- `namja_body_v19_under_shirt1.glb`
- `namja_body_v19_under_shirt6.glb`
- `namja_body_v19_under_suit.glb`
- `namja_body_v19_under_track.glb`
- `namja_body_v19_under_turtle.glb`
- `namja_body_v19_under_vest.glb`
- `yeoja_body_v19_under_biker.glb`
- `yeoja_body_v19_under_dress1.glb`
- `yeoja_body_v19_under_garden.glb`
- `yeoja_body_v19_under_hoodiedress.glb`
- `yeoja_body_v19_under_knitdress.glb`
- `yeoja_body_v19_under_labcoat.glb`
- `yeoja_body_v19_under_outfit2.glb`
- `yeoja_body_v19_under_outfit3.glb`
- `yeoja_body_v19_under_outfit4.glb`
- `yeoja_body_v19_under_outfit5.glb`
- `yeoja_body_v19_under_overalls.glb`
- `yeoja_body_v19_under_pajama.glb`
- `yeoja_body_v19_under_parka.glb`
- `yeoja_body_v19_under_puffer.glb`
- `yeoja_body_v19_under_raincoat.glb`
- `yeoja_body_v19_under_sailor.glb`
- `yeoja_body_v19_under_shirt1.glb`
- `yeoja_body_v19_under_summer.glb`
- `yeoja_body_v19_under_sundress.glb`
- `yeoja_body_v19_under_track.glb`
- `yeoja_body_v19_under_turtle.glb`
