# leaf Meshy 주문표 — 몬스테라 어색한 잎 고치기 · 다른 식물 모듈 (2026-10-09 · [leaf])

> 박사님(총괄 창 10-09 11:10): «다 쓰기 안» + «앞으로 만들어야 되는 것까지 싹 — 몬스테라 잎 모양 이상한 것이라든지 아니면 다른 식물 모듈들».
> **크레딧 쓰는 호출은 총괄이 돌린다.** 이 문서는 «총괄이 그대로 돌릴 수 있는 주문표»다. 받은 GLB를 잇고 재는 일은 leaf 가 한다.
> leaf 몫 예산 ≈ 780 크레딧. 아래 합계 730(필수 90 · 재시도 몫 90 · 선택 30 · 다른 식물 520) — 50 남김.

---

## 0. 공통 — 모든 retexture 줄이 같은 옵션을 쓴다

| 칸 | 값 | 까닭 |
|---|---|---|
| 도구 | `meshy_retexture` | 모양은 좋은 잎(캔버스)을 그대로 쓰고 무늬만 새로 입힌다 — 모양이 이상한 것이 문제라서 |
| `model_url` | 캔버스 GLB 의 raw 주소 `https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/<경로>` | 저장소가 공개라 열린다(10-09 · 여섯 개 모두 raw 크기 = 로컬 크기 확인) |
| 스타일 입력(하나만) | `image_style_url` = **지금 그 가족의 썸네일**(위에서 본 잎 · `assets/monstera/skins/thumbs/<이름>.png` 의 raw 주소) | 무늬 «가족»의 얼굴(색·무늬 종류)을 남기려고. 모양은 캔버스가 정한다 |
| 대안(첫 판이 무늬를 못 살리면 재시도 몫으로) | `text_style_prompt` = 표의 «대안 프롬프트» | 같은 가족을 말로 다시 |
| `ai_model` | `"meshy-6"` | `remove_lighting` 이 meshy-6 에서만 먹는다 |
| `remove_lighting` | `true` | 밑색에 빛·그림자를 굽지 않는다 — 게임이 빛을 따로 준다(방·확대창) |
| `enable_original_uv` | `true` | 캔버스의 UV 를 그대로(Meshy 가 만든 UV 라 쓸 만하다). 무늬가 찢기면 재시도 몫에서 `false` |
| `texture_resolution` | `"2k"` | 2K 가 10 크레딧. 지금 잎 텍스처가 모두 2048 |
| `enable_pbr` | `false` | 지금 잎은 밑색 하나만 쓴다 |
| `target_formats` | `["glb"]` | |
| 받을 경로 | `assets/monstera/skins/_incoming1009/<표의 받을 이름>.glb` | leaf 가 보고 나서 제자리 이름으로 옮긴다(아래 §3) |
| 크레딧 | **줄마다 10** | |

⚠ **쨍(_v1)·차분(_v2) 판은 주문하지 않는다.** 기본판 하나만 받아 leaf 가 기존 색 바꿈 규칙(A/HSV · `tools/leaf/recolor_calm.py` 의 PICK 표)으로 만든다 — 크레딧 0. 그래서 가족 하나에 10 이다(30 이 아니다).

---

## 1. ① 몬스테라 — «모양이 이상한» 잎 9가족 (필수 90)

**고른 법.** 성숙 60 · 중간 48 GLB 전부를 자로 재고(`tools/leaf/leaf_audit.py` — 이음매 법선 갈림 · 채움 · 메시 수 · 밝기 대비) 위에서 본 썸네일을 같은 크기로 늘어놓아 눈으로 골랐다. 자가 튀운 것(앞뒤 두 겹 · 이음매 갈림 24~100%)과 눈이 어색하다고 본 것이 겹치는 것을 먼저 넣었다.
그림: `img/leaf1009/meshy_cands.png`(왼쪽 지금 · 오른쪽 캔버스).

**캔버스(모양 기준)** — 썸네일에서 실루엣이 고르고 한 덩이인 것 넷:
- 성숙 A `assets/monstera/monstera_leaf_mature.glb` (기본 성숙잎 · 갈라짐 고름)
- 성숙 B `assets/monstera/skins/mon_halfmoon_greenwhite.glb` (하프문 그린흰 · 대칭)
- 성숙 C `assets/monstera/skins/mon_rose_pink.glb` (핑크-로즈 · 갈라짐 많음)
- 중간 D `assets/monstera/skins/heart_lime_2672_0.glb` (평평한 하트) · 중간 E `assets/monstera/skins/pothos_whitegreen_29.glb` (매끈한 하트)
  ⇒ 캔버스를 셋으로 나눈 까닭: 한 그루에 무늬 잎이 여럿 달릴 때 모두 같은 실루엣이면 복사한 티가 난다.

| # | 등급 · 가족(지금 파일) | 지금 어색한 것 [눈 + 자] | 캔버스 | `image_style_url` (raw 경로) | 대안 `text_style_prompt` | 받을 이름 | 크레딧 |
|---|---|---|---|---|---|---|---|
| M1 | 산반 · 제브라 `mon_zebra.glb` | 두 쪽으로 말린 덩어리 · 앞뒤 두 겹 · 이음매 갈림 99.7% | A | `assets/monstera/skins/thumbs/mon_zebra.png` | `Monstera deliciosa leaf, dark green with thin white zebra stripes running from midrib to edge, pastel low-poly game asset, flat albedo, no lighting` | `mon_zebra_new.glb` | 10 |
| M2 | 하프문 · 별무늬-핑크민트 `mon_star_pinkmint.glb` | 가장자리 너덜 · 무늬가 번져 얼룩 · 윗끝 뾰족 | C | `…/thumbs/mon_star_pinkmint.png` | `Monstera leaf, half pink-white and half mint green split along the midrib, small white star-shaped flecks, pastel low-poly, flat albedo` | `mon_star_pinkmint_new.glb` | 10 |
| M3 | 하프문 · 그린크림 `mon_halfmoon_greencream.glb` | 비대칭 · 흰 덩어리가 한쪽에 뭉침 · 가장자리 너덜 | B | `…/thumbs/mon_halfmoon_greencream.png` | `Monstera leaf, exactly half creamy white and half deep green divided along the midrib (half-moon variegation), pastel low-poly, flat albedo` | `mon_halfmoon_greencream_new.glb` | 10 |
| M4 | 산반 · 라임-레몬패치 `mon_green_lemonpatch.glb` | 구겨진 종이처럼 물결 | A | `…/thumbs/mon_green_lemonpatch.png` | `Monstera leaf, deep green with a few lemon-yellow patches near the edge, pastel low-poly, flat albedo` | `mon_green_lemonpatch_new.glb` | 10 |
| M5 | 산반 · 네온-라임 `mon_neon_lime.glb` | 부풀어 둥글고 갈라짐이 거의 없음(몬스테라로 안 읽힘) | C | `…/thumbs/mon_neon_lime.png` | `Monstera leaf, bright neon lime-yellow green with slightly darker veins, pastel low-poly, flat albedo` | `mon_neon_lime_new.glb` | 10 |
| M6 | 풀문 · 오로레아-골드 `mon_variegata_gold.glb` | 가장자리가 말려 올라감 | B | `…/thumbs/mon_variegata_gold.png` | `Monstera leaf, large golden-yellow (aurea) sectors covering about half the leaf, rest green, pastel low-poly, flat albedo` | `mon_variegata_gold_new.glb` | 10 |
| m1 | 중간 · 알보-크림민트 `heart_albo_2672_3.glb` | 각진 저폴리(면이 깎여 보임) | E | `…/thumbs/heart_albo_2672_3.png` | `young heart-shaped monstera leaf, cream white with soft mint green edges, pastel low-poly, flat albedo` | `heart_albo_2672_3_new.glb` | 10 |
| m2 | 중간 · 마블-크림그린 `pothos_cream_marble.glb` | 나비처럼 V 로 접힘 · 앞뒤 두 겹 · 이음매 24% (지금은 ADJ ry 1.57 로 «칼날» 만 피함) | D | `…/thumbs/pothos_cream_marble.png` | `young heart-shaped leaf, green and cream marbled streaks, pastel low-poly, flat albedo` | `pothos_cream_marble_new.glb` | 10 |
| m3 | 중간 · 스페클-민트흰점2 `pothos_mint_dot_34.glb` | 오목하게 접힘 · 앞뒤 두 겹 · 이음매 30% | D | `…/thumbs/pothos_mint_dot_34.png` | `young heart-shaped leaf, teal green with small white speckle dots, pastel low-poly, flat albedo` | `pothos_mint_dot_34_new.glb` | 10 |

**재시도 몫 90** — 한 줄당 한 번 더. 첫 판이 «무늬 가족을 못 알아보겠다»거나 «UV 가 찢겼다»면 같은 줄을 대안 프롬프트 · `enable_original_uv:false` 로 다시. 안 쓰면 남는다.

### 1-b. 크레딧 0 — leaf 가 손으로 고칠 것 (주문 안 함)
| 가족 | 어색한 것 | 손질 |
|---|---|---|
| 갤럭시-틸골드 `mon_galaxy_tealgold` | 방·확대창에서 잎이 작아 보임 | GLB 에 잎자루 토막(둘째 메시 110정점)이 붙어 «높이 1» 맞춤에서 잎몸 몫이 줄었다 → 조정표 scale 로 맞춘다 |
| 알보-전체흰 `mon_fullalbo` | «흰»인데 베이지·누렇게 보임 | 밑색 채도·색상만 손질(색 바꿈 도구) |
| 마블-실버 중간 `heart_marble_2652` | 너무 어두워 폰에서 무지로 읽힘(대비 낮음) | 밑색 밝기 올림 |
| 하프문 중간 29~31 | 찢김 | 10-07 법선 맞춤으로 이미 고침(962d85c3) |

### 1-c. 선택 — plan·박사님이 정할 것 (30)
| # | 무엇 | 까닭 | 크레딧 |
|---|---|---|---|
| G1·G2 | 하프문 등급의 갤럭시 두 가족(틸골드 mat10~12 · 다크틸 19~21)을 «반달이 또렷한» 무늬로 retexture | 폰·방 거리에서 점박이로 보여 산반과 안 갈린다(10-08 원룸 사진 · 10-07 ΔE 표). ⚠ 가족 얼굴이 바뀌므로 등급표를 쥔 plan 이 정한다 | 20 |
| Y1 | 어린 알보 잎 `monstera_leaf_young_albo` 에 «보이는» 무늬 | 지금 그림에 무늬가 없다(색만 뺀 잎). 대사가 «지금은 안 보여»라 일부러 둔 것 — 바꿀지 plan 이 정한다 | 10 |

---

## 2. ② 다른 식물 모듈 — 4종 (520)

### 2-a. 고른 넷과 까닭(한 줄씩)
| 종 | 까닭 | 지금 조립기와 |
|---|---|---|
| **필로덴드론 핑크프린세스** | 분홍 무늬 비율로 값이 갈리는 대표 «무늬 시장» 식물 — 지금 등급(반달·마블) 체계를 그대로 쓴다 | 잎자루+하트/화살 잎몸 · 몬스테라와 같은 꼴 → **바로 붙는다** |
| **알로카시아 (프라이덱 · 무늬종 오키나와실버)** | 잎이 적고 커서 폰·방 거리에서 잘 보인다 · 무늬종이 비싸다 | 긴 잎자루 끝 화살잎 하나씩 → **바로 붙는다** |
| **스킨답서스 (마블퀸 · 엔조이)** | 한국 입문 1순위 · 하트잎은 지금 중간잎 하트와 거의 같아 재사용이 쉽다 | ⚠ 덩굴(늘어지는 줄기) — 조립기에 «늘어지는 줄기» 갈래가 있어야 한다(growth 일) |
| **칼라데아 (오비폴리아 · 화이트퓨전)** | 줄무늬가 원래 무늬(변이 아님) — 등급 대신 «잎 말림·빛 반응»이 놀이 · 화이트퓨전은 변이종 | 로제트(밑동에서 잎자루가 바로) · 잎자루+둥근 잎몸 → 붙지만 잎 나는 규칙은 새로 |
⇒ 권하는 차례: 핑크프린세스 → 알로카시아(조립 그대로) → 스킨답서스·칼라데아(growth 손질 뒤).

### 2-b. 조립기가 받는 꼴(지금 몬스테라 규약 그대로 — `plant_grow.html §normalizeAsset`)
- GLB **한 덩이**(메시 1개 · 잎자루 토막을 따로 두지 않는다 — 두 겹·토막이 ① 의 어색함 원인이었다) · 삼각형 3~5천(몬스테라 잎 3.1~6.6천)
- **잎자루를 품는다**(`USE_PETIOLE=false` — 잎 GLB 에 자루가 들어 있다) · 자루 끝이 **가장 아래**(밑동 8% 띠의 무게중심이 정렬점)
- 가장 긴 축이 세로(아니면 `forceLongY` 로 돌린다) · 크기는 아무래도 된다(높이 1 로 맞춘 뒤 조정표·실측으로 키운다)
- 밑색 텍스처 하나(2048 · PBR 없음) · 빛을 굽지 않은 밑색
- 파일: `assets/plants/<종>/<종>_leaf_young.glb · _leaf_mid.glb · _leaf_mature.glb` · 무늬판 `assets/plants/<종>/skins/<종>_<무늬>.glb` · manifest 갈래 `잎·<종>·어린/중간/성숙` · `real_max_m`(아래 실측)
- ⚠ 종 프로필(잎 나는 간격 · 잎자루 길이 · 잎 수 · 무늬 규칙)은 growth 가 plant_grow 에 새로 세워야 한다 — 이 주문표는 «그림»만 만든다.

### 2-c. 만드는 길 (종마다 같은 꼴)
1. **2D 입력 그림** — Higgsfield `generate_image`(Meshy 크레딧 아님 · 장당 1) · 종마다 잎 셋(어린·중간·성숙) + 무늬 둘 = 5장(+고르기 여분 5). 받을 곳 `assets/raw/plants/<종>/`.
   프롬프트 틀: `single <종 영문> leaf with its petiole, isolated on plain white background, 3/4 view, petiole pointing down, full leaf visible, pastel low-poly 3D game asset style, soft even light, no pot, no shadow`
   (어린: `small young rolled-open leaf` · 중간: `half-grown leaf` · 성숙: `fully grown leaf`)
2. **모양** — `meshy_image_to_3d` · `file_path` = 위 그림(로컬 절대경로) · `ai_model:"meshy-6"` · `should_texture:true` · `remove_lighting:true` · `texture_resolution:"2k"` · `target_formats:["glb"]` · `should_remesh:true` · `target_polycount:4000` → **30/장 × 3 = 90**
3. **무늬판** — `meshy_retexture` · `input_task_id` = 2 의 성숙·중간 작업 id · `text_style_prompt` = 아래 · 나머지는 §0 그대로 → **10/장 × 4 = 40**
4. 받을 곳 `assets/plants/<종>/_incoming1009/`
⇒ **종마다 130 · 넷 520**

| 종 | 영문(프롬프트) | 무늬판 4장(성숙 2 · 중간 2) `text_style_prompt` 요지 | 실측 [짐작 · 일반 원예 값 — plan 확인] |
|---|---|---|---|
| 핑크프린세스 | `Philodendron erubescens 'Pink Princess'` | ① 반달 분홍(잎맥 따라 절반 분홍) ② 분홍 마블(점·붓질) — 성숙·중간 각각 | 성숙 잎몸 15~25cm · 자루 10~20 · 중간 8~12 · 어린 4~6 · 화분 Ø12~15 ⇒ 몬스테라 성숙잎(0.65m)의 ≈0.35배 |
| 알로카시아 | `Alocasia 'Frydek' velvet arrowhead leaf` · 무늬 `Alocasia macrorrhiza 'Okinawa Silver'` | ① 크림 마블(오키나와실버) ② 크림 반달 | 성숙 잎몸 30~45 · 자루 30~60 · 중간 15~20 · 어린 6~8 · 화분 Ø15~18 ⇒ ≈0.6배 |
| 스킨답서스 | `Epipremnum aureum 'Marble Queen' heart leaf` | ① 흰 마블(마블퀸) ② 흰 가장자리 조각(엔조이) | 잎몸 6~12 · 자루 3~6 · 덩굴 · 걸이 화분 Ø12 ⇒ ≈0.15배 |
| 칼라데아 | `Calathea orbifolia round striped leaf` · 무늬 `Calathea 'White Fusion'` | ① 은빛 줄무늬(원래 무늬 · 오비폴리아) ② 흰 붓질 마블(화이트퓨전) | 잎몸 20~30(둥금) · 자루 15~30 · 로제트 · 화분 Ø15~17 ⇒ ≈0.4배 |

---

## 3. 받은 뒤 leaf 가 하는 일 (잇기 · 재기)
1. `_incoming1009/` 를 연다 → `leaf_audit.py` 로 잰다: **메시 1개 · 이음매 법선 갈림 < 5% · 채움(앞뒤 두 겹이면 100% 넘음) ≤ 100%**. 안 맞으면 재시도 몫으로 돌려 달라고 총괄에.
2. 썸네일(위에서 본 잎)을 같은 크기로 «지금 · 캔버스 · 새것» 셋 나란히 — 무늬 가족을 알아보나 · 실루엣이 캔버스와 같은가(눈).
3. 제자리 이름으로 옮긴다(① 은 같은 파일 이름으로 갈아 끼움 — `ASSET_FILES`·등급표 손질 0) · 옛 것은 `skins/_orig/` 로. 쨍/차분 판을 색 바꿈으로 만든다.
4. 조정표(ADJ) — 캔버스 가족의 조정값을 옮겨 적는다(모양이 캔버스니까) · `buildPlant` 로 확대창 확인.
5. **같은 크기로 전후**: 폰 390×844 · 확대창 · 방 옆 각도 — `tools/leaf/_shot_matgrid.mjs`(확대창) · `_shot_room_varie.mjs SAVE=`(방). 그림은 `img/leaf1009/`.
6. manifest · 썸네일 · leaf-index 에 적고 경로 박아 커밋 → push → 총괄에 «바뀐 것 · 실측 · 정한 것 · 못 한 것».
7. ② 는 GLB 규약(§2-b) 검사 · 높이 1 맞춤 뒤 자루 끝 위치 · 실측 비율로 화분 옆에 세워 같은 크기 그림 → growth 에 넘김(종 프로필은 growth).

## 4. 합계
| 묶음 | 크레딧 |
|---|---|
| ① 필수 9줄 | 90 |
| ① 재시도 몫(안 쓰면 남음) | 90 |
| ① 선택(plan 결정) | 30 |
| ② 4종 × 130 | 520 |
| **합** | **730** (예산 ≈780 · 50 남김) |
※ ② 의 2D 입력 그림은 Higgsfield(장당 1 · 약 40장)라 위 합에 안 들어간다.

---

## 5. 10-09 받은 것 · 한 것 (① 9가족)

| 단계 | 결과 |
|---|---|
| 받음 | 9줄 SUCCEEDED(총괄 · 90) → `assets/monstera/skins/_incoming1009/<이름>_new.glb` · 2.1~3.0MB · 메시 1 · 2048 JPEG |
| 자 | 9 모두 메시 1 · 이음매 법선 갈림 0% · 채움 = 캔버스 (`leaf_audit.py`) |
| 모양 | 같은 썸네일 도구(`glb_thumb --view=top`)로 옛·새: 말림·너덜·접힘이 다 풀림 — `img/leaf1009/meshy9_color_rounds.png` |
| 색 | Meshy 가 전부 짙게 · 골드 빨강 · 핑크 진홍 · 라임 올리브 · 알보 회녹으로 쏠림 → 크레딧 0 손질: 옛 썸네일과 색상·채도·밝기를 재서(`match_family_color.py`) `lift_base.py`(HSV 감마·채도배·색상°) 1~3회. 값은 `stage_meshy1009.py PARAMS` |
| 크기 | 텍스처 1024 JPEG 로 → GLB 270~450KB(옛 100~470KB) |
| 세 판 | 쨍(_v1) = `recolor_calm.redo_vivid` · 차분(_v2) = `recolor_calm.redo`(PICK 판) — 옛 가족과 같은 규칙 · `img/leaf1009/meshy9_final27.png` |
| 확대창 | 저장소 파일을 안 바꾸고 화면 안에서만 «새 GLB + 캔버스 조정값»(`_shot_matgrid OVR`) — 같은 빌드 전후 `meshy9_zoom_mature.png` · `meshy9_zoom_mid.png` |
| 들이기 | 조정표 12줄(9가족 ← 캔버스 · 중간 잎집 3)을 growth 에 청 → 그 커밋 직후 GLB 27개를 같은 이름으로 갈아 넣는다 |

### 새 식물 원화 1차(nano-banana-pro 10장 · 90)
`img/leaf1009/newplant_2d_round1.png` — 모양: PP1·PP2·PP3·AL1·AL2 · 무늬 견본만: PP4·PP5·AL4·AL5 · 다시 뽑기: AL3(갈라짐 · 견본 AL2).
