# 유니티 몫 — 식물 쪽이 넘길 것 (2026-10-09 · [leaf])

> 총괄(10-09): «유니티 판이 식물 쪽에서 쓸 것 — 예: 종마다 단계별 3D · 투명 잎 텍스처 · 무늬 마스크». 박사님: «나중에 유니티로 만들 것도 생각해서 뽑아».
> 이 문서는 «유니티가 식물 쪽에서 받을 것»의 목록 · 지금 있는 것 · 만드는 길(크레딧 0 / Higgsfield) · 차례다. 그루를 조립하는 규칙(마디·잎 난 때·성숙 굴림)은 growth 몫이라 여기 없다.

## 0. 지금 웹판이 식물을 그리는 법 — 유니티로 갈 때 바뀌는 자리

| 칸 | 지금(웹 · three.js) | 유니티에서 |
|---|---|---|
| 잎 | GLB 한 덩이(메시 1 · 잎자루 품음) — 몬스테라 단계 6(말린 순 · 펴지는 순 · 어린 · 중간1·2 · 성숙) + 무늬 잎(성숙 19 가족 · 중간 통일 풀 12 · 각각 쨍/차분 판) · 핑크프린세스 3단계 + 7판 · 알로카시아 3단계 + 4판 | 같은 메시를 쓰되 축·원점·미터를 규약으로 맞춰 넘긴다(§1 U1) |
| 텍스처 | 밑색 하나 · **142 GLB 중 120 이 1024**(웹 무게로 줄였다) · 2048 원본은 `skins/_orig` · `_incoming1009` 에 남아 있다 | 2048 로 다시 굽는다(같은 색 손질 · §1 U2) |
| 크기·각도 | GLB 는 높이 1 로 맞추고 코드 조정표(plant_grow ADJ)가 키운다 · 실측은 manifest `real_max_m` | 미터로 구운 메시 + 자료 JSON(§1 U8) |
| 무늬 | 텍스처를 통째로 갈아 끼운다(가족마다 · 판마다 한 장) | **초록 밑판 + 무늬 마스크 + 무늬색** 을 셰이더가 섞는다 — 성숙 때 무늬가 «서서히» 드러나게(캐논: 값은 날 때 · 그림은 성숙 때) · 쨍/차분은 색 값 둘(§1 U3) |
| 빛 | 방 빛만 | 잎 비침(뒤에서 빛 받으면 밝아짐) — 빛 게임이라 값어치가 크다(§1 U5) |

## 1. 넘길 것 — 목록

| # | 무엇 | 지금 | 만드는 길 | 크레딧 |
|---|---|---|---|---|
| U1 | **잎 메시 — 종 × 단계**(몬스테라 6 · PP 3 · AL 3 · 스킨답서스 3 · 칼라데아 3). 규약: 자루 끝 = 원점 · +Y 위 · +Z = 잎 겉면 · 미터(real_max_m) · LOD0 삼각 3~6천 · LOD1 ≈ 1천 | 몬스테라·PP·AL 있음(웹 GLB) · 스킨답서스·칼라데아 **없음** | 있는 것: 축·원점·크기만 맞춰 내보냄(스크립트) · LOD1 은 메시 줄이기 도구(gltfpack — 설치 확인 필요) · 없는 둘: Higgsfield Tripo H3.1 PBR(get_cost 9 · detailed 12) — **② 원화 검수 뒤 3D 주문표를 따로** 낸다 | 있는 것 0 · 새 종 ≈ 110(따로) |
| U2 | **밑색 텍스처 2048**(빛 안 구움) | 120/142 가 1024 | 2048 원본에 같은 색 손질(`lift_base` · `stage_meshy1009.py PARAMS` · `recolor_calm` 쨍/차분)을 다시 | 0 |
| U3 | **무늬 마스크 + 초록 밑판 + 무늬색 표** — 마스크 R = 무늬 몫(부드러운 경계) · G = 무늬 안 «둘째 색» 몫 · 표 = 밑판색·무늬색1·2·«잎 전체 특수색» 여부 | 없음 → **오늘 세움**: `tools/leaf/varie_mask.py` | UV 섬을 그려 잎 화소만 → Lab k-평균(4) → 초록 색상 무리 = 밑판(기준 초록에서 ΔE 40 넘으면 «전체 특수색») → 마스크 · 굳힌 마스크로 밑판 채움. 성숙 19 가족 실측 아래 §2 | 0 |
| U4 | **투명 잎 그림**(위에서 본 잎 · 알파 2048) — 먼 거리 LOD2(판 한 장) · UI · 2D | 썸네일은 512 · 흰 바탕 | `tools/glb_thumb` `--view=top` 을 2048·투명으로 — 3D 와 무늬가 정확히 같다 · 마스크도 같은 각으로 찍어 «판 마스크» | 0 |
| U5 | **비침(두께) 맵** — 잎맥은 두껍고 잎몸은 얇게 | 없음 | 밑색 밝기 결에서(스크립트) 또는 상수 · 셰이더는 유니티 쪽 | 0 |
| U6 | **펴짐 움직임**(말린 순 → 펴짐 → 어린잎) | 웹은 단계마다 GLB 를 갈아 끼움 · 정점 수가 달라 블렌드셰이프 불가 | 같은 메시를 굽혀 만든 «말린 꼴» 모프(손일) 또는 갈아 끼움 유지 — **유니티 판 방향 뒤** ⏸ | 0(손일) |
| U7 | 줄기 토막 · 잎집 · 마디 혹 · 화분 | 웹 GLB 있음(`assets/monstera/stem_*` · `leaf_sheath` · pots) | U1 규약으로 내보냄 | 0 |
| U8 | **식물 자료 JSON** — 종 · 단계 · 실측 · 무늬 가족 → 마스크·색·등급(산반/하프문/풀문)·한글명 · 판(쨍/차분) 색 | manifest · `varie_grades.json` · 종 표에 흩어져 있다 | 한 장으로 뽑는 스크립트 → 유니티 ScriptableObject | 0 |
| U9 | 카드 그림(손그림 · 2k · 결 A/B) | **Higgsfield 주문 ① 이 지금 돌고 있다**(총괄) | 검수·manifest 는 leaf | (주문 ①) |

## 2. U3 무늬 마스크 — 성숙 19 가족 실측 (10-09 · 1024 텍스처 · 크레딧 0)

`python tools/leaf/varie_mask.py <out> assets/monstera/skins/mon_*.glb` — 가족마다 `_mask.png`(R·G) · `_base.png` · `_colors.json` · 시트.
칸: 무늬 % = 잎 화소 중 마스크 몫 · 남음 % = 밑판에 남은 무늬 화소(0 이어야) · 납작 ΔE = 밑판 + 무늬색 하나로 다시 칠했을 때 무늬 자리의 원본과 차(잎맥·결을 얼마나 잃나 — 참고)

| 가족 | 무늬 % | 둘째 % | 남음 % | 판정 |
|---|---|---|---|---|
| 하프문-그린흰 | 54.2 | 0 | 0 | ✓ |
| 하프문-그린크림 | 56.4 | 0 | 0 | ✓ |
| 제브라-그린흰 | 32.7 | 0 | 0 | ✓ (처음 판은 밑판에 줄무늬 16% 남음 → 굳힌 마스크 · 무늬 자리 밝기로 고침) |
| 별무늬-그린흰 · 별무늬-그린옐로우 · 별무늬-페일그린 | 34.3 · 59.5 · 17.4 | 3.9 · 37.5 · 9.3 | 0 · 0.3 · 3.8 | ✓ (그린옐로우: 크림 + 금 두 색) |
| 라임-레몬패치 | 22.4 | 9.5 | 0 | ✓ |
| 오로레아-골드 | 64.7 | 15.5 | 0 | ✓ (처음 판은 «전체 특수색»으로 잘못 읽음 → 초록 색상 무리 기준으로 고침) |
| 핑크-로즈 | 93.8 | 0 | 0 | ✓ |
| 네온-라임 · 핑크-로즈핑크 · 모브 · 차콜 | 100 | 0 | 0 | ✓ «잎 전체 특수색»(밑판 = 기준 초록) |
| 알보-전체흰 | 91.0 | 0 | 0 | ✓ |
| 오로레아-그린옐로우 | 57.5 | 35.8 | 0 | △ 둘째 색이 노란 연두 — 무늬로 볼 만함(눈으로 한 번 더) |
| **스페클-그린크림** | 53.8 | 34.0 | 0 | ✗ 둘째 색이 «밝은 초록 그늘» — 밑판 쪽으로 넣어야 · 덮어쓰기 한 줄 |
| **갤럭시-틸골드** | 2.8 | 0 | 0 | ✗ 틸 자체가 특수색인데 금빛 잎맥만 잡음 → «전체 특수색»으로 덮어씀 · ⚠ 이 GLB 텍스처 안에 잎 그림 통째가 들어 있다(아틀라스가 이상함 — 웹 화면엔 문제없음) |
| **갤럭시-다크틸** | 43.4 | 40.5 | 4.8 | ✗ 짙은 틸을 둘째 색으로 읽음 → «전체 특수색» + 크림 점은 둘째 채널로 덮어씀 |
**렌더로 확인(같은 크기 · 위에서 · `glb_thumb --view=top`)**: 하프문-그린흰 · 라임-레몬패치 · 별무늬-그린흰 · 제브라 넷을 «원본 · 초록 밑판을 입힌 것 · 마스크를 입힌 것»으로 찍었다 — 밑판은 잎 위에서 무늬가 다 지워지고 마스크는 무늬 자리에 꼭 맞는다. 텍스처 그림에서 밑판에 남아 보이던 흰·노란 조각은 **아틀라스 빈 자리**(잎에 안 쓰이는 화소)였다. 남은 흠 둘: 밑판에 UV 이음매를 따라 옅은 선(섬 가장자리 화소) · 레몬패치는 잎자루 끝 갈색을 둘째 색으로 잡음(자루 = 밑동 8% 띠라 위치로 뺄 수 있다). 그림 `img/leaf1009/unity_mask_render.png` · 텍스처 판 `img/leaf1009/unity_mask_19tex.png`(앞 여섯 가족).
⇒ **자동 15/19 · 손볼 4**(덮어쓰기 표를 도구에 한 줄씩 둔다). 중간 통일 풀 12 · PP 7판 · AL 4판도 같은 도구로(다음).
⚠ **마스크는 그 GLB 의 UV 에 붙는다.** 유니티가 다른 메시(예: Tripo 새 메시)를 쓰면 그 메시에서 다시 뽑아야 한다 — 그때는 Higgsfield `meshy_v5_retexture`(원래 UV · PBR · get_cost 9.5/장)로 무늬판을 그 메시에 입혀 뽑는다.

## 3. 박사님께 물을 것 (QUESTION)

**유니티 판의 결** — 웹과 같은 «파스텔 저폴리»(면이 보이는 잎)로 가나, 더 세밀한 잎(노멀맵 · 매끈한 면)으로 가나.
- 왜 지금: U1·U3 가 «지금 메시를 쓰나 · 새 메시를 뽑나»로 갈린다.
- 같은 결이면: 추가 크레딧 0 · 마스크(U3)가 지금 메시에 바로 붙는다 · 새 종 둘만 3D.
- 세밀판이면: 종 × 단계 17 메시를 Tripo detailed(12) ≈ 204 + 무늬판을 새 메시에 입히기(성숙 19 · 중간 12 · PP 4 · AL 3 ≈ 38 × 9.5 ≈ 361) ⇒ **≈ 565** — 시험 한 줄(몬스테라 성숙 민무늬 · 12)로 먼저 본다.
- 권함: **같은 결**로 기본 묶음을 먼저(크레딧 0) · 세밀판은 시험 한 줄 그림을 보고 정한다.

## 4. 차례 (leaf · 크레딧 0 먼저)

1. U3 — 덮어쓰기 4줄 넣고 성숙 19 · 중간 풀 12 · PP 7 · AL 4 전부 · 시트 · 장부
2. U2 — 2048 다시 굽기(같은 색 손질 값)
3. U4 — 위에서 본 투명 2048 + 판 마스크
4. U8 — 자료 JSON
5. U1 — 규약(원점·축·미터) 맞춘 GLB 묶음 · LOD1(gltfpack 있으면)
6. 새 종 3D — ② 원화 검수 뒤 Higgsfield 3D 주문표(따로)

내는 곳: `unity_kit/plants/<종>/`(mesh · tex · mask · card · plant_kit.json). ⚠ 2048 PNG 가 수백 장이라 무겁다 — **저장소에 넣을지·어디에 둘지는 총괄**이 정한다(밑색은 JPEG 2048 · 마스크는 PNG 8비트 두 채널로 줄일 수 있다).

## 5. 10-09 진행 — U2·U3 끝 (총괄 결정: 기본 키트는 지금 결 · 저장소 밖 `빛식물/unity_kit/plants/`)

- 만드는 법·도구: `tools/leaf/unity_kit.py tex|mask` · `tools/leaf/UNITY_KIT_README.md` · 확인용 한 가족 `docs/unity_kit_sample/`
- **U2 2048**: 잎 GLB 142 중 **140 이 2048**(나머지 둘 `leaf_sheath`·`stem_knob` 는 텍스처가 없는 GLB). 어디서 찾았나(1024 로 줄여 지금 텍스처와 PSNR · 35dB): `_orig` 71 · 이미 2048 20 · Meshy 아홉 가족 다시 손질 9 · 쨍(vivid) 10 · 차분(pick1·2·3) 13 · PP·AL 원본 12 · allpink 3 · depink 1 — 장부 `unity_kit/plants/kit_log.json`. `depink` 의 흐림 반지름을 너비에 맞춰 늘렸다(1024 면 그대로 · 2048 에서 26.8 → 38.1dB).
- **U3 마스크 47**(무늬판만 · 쨍/차분은 기본판 마스크를 같이 쓴다). 덮어쓰기 9줄(`varie_mask.OVERRIDE` · 까닭 한 줄씩): 갤럭시 둘 · 스페클-그린크림 · 별무늬-그린옐로우(1024↔2048 문턱) · 알보-크림민트 · 알로카시아 셋 · 민트점34. 렌더로 확인: 성숙 넷 · 중간·PP·AL 여섯(밑판에서 무늬가 지워지고 마스크가 무늬 자리에 맞음 · 민트점34 는 잎맥도 조금 잡음 △).
- **10-10 U4·U8·U1 끝** — 키트 809MB(저장소 밖):
  - U4 위에서 본 2048 투명 142 + 판 마스크 46: `glb_thumb` 썸네일은 «흰 바탕» 규약이라(알파 없음) 흰·검 두 번 찍어 차로 알파(흰 무늬에 구멍 없음 · `--bg=` 를 더함 · 기본 흰 그대로) · 테두리 반투명 0.2% · 눈으로 확인.
  - U1 구움 142: 자루 끝(맨 아래 8% 띠 XZ 무게중심 — `normalizeAsset` anchorBottom 과 같은 셈) = 원점 · +Y · **가장 긴 축 = real_max_m**(manifest 규약 «최대축» — 첫 판은 높이로 맞춰 옆으로 넓은 중간잎이 1.27배 컸다 · 고침) · 노드 변환은 정점에 녹임(법선·면 같은 쪽 0.9959 전후 같음) · 141 다 최대축 = 실측(어긋남 0) · 실측 없는 1(`mon_variegata_greenwhite_stem`)은 높이 1. 줄기 GLB 는 긴 축이 이미 Y(게임 LONGY 돌림 없음과 같음).
  - U8 `plant_kit.json`: 종 3 · 단계 24 · 무늬판 46(등급·한글명·쨍/차분·마스크·밑판·색·위에서·유니티 메시). PP·AL 등급은 species.js 표로 · 알로카시아 «크림 중심»만 하프문으로 «추정»(guess 칸).
  - 남은 것: U5 비침 맵 · U6 펴짐(유니티 판 방향 뒤) · 잎 돌림(ADJ)을 표로 넘길지는 growth 와.

## 6. 자세한 판 시험 한 줄 (총괄이 Higgsfield 로 돌림 · ≈ 17.5)

지금 잎을 위에서·옆에서 그대로 찍은 그림은 빛을 안 쓴 납작한 색이라(`glb_thumb` 규약) 3D 가 깊이를 못 읽는다 → **2D 한 장을 먼저 빛 받은 그림으로**, 그것을 3D 로.
1. `generate_image` · `gpt_image_2_5` · `quality: high` · `resolution: 2k` · `aspect_ratio: 1:1` · `background: opaque` · `count: 2` · 참조(`image_references`) = `C:\Users\pc\Desktop\빛식물\unity_kit\pilot\monstera_leaf_mature_3q_2048.png`(지금 성숙잎 3/4 · 2048 · 모양 기준)
   글: `A single Monstera deliciosa mature leaf with its petiole, the same silhouette, splits and holes as image 1, 3/4 view, petiole pointing down, the whole leaf visible and centered, plain healthy deep green with natural veins and a soft waxy sheen, soft even studio light with gentle shading so the leaf's curvature is readable, isolated on a plain pure white background, no pot, no shadow, no text.`
   → 받을 곳 `unity_kit/pilot/mon_mature_detail_2d_{a,b}.png`
2. 고른 한 장으로 `generate_3d` · `tripo_h3_1_image_to_3d` · `pbr: true` · `texture: true` · `texture_quality: detailed` · `geometry_quality: standard` · `face_limit: 8000` · `orientation: align_image` (get_cost 12) — ⚠ 총괄 시험에서 `detailed + pbr false` 가 failed 였다 → pbr true 로
   → `unity_kit/pilot/mon_mature_detail.glb`
3. leaf: 지금 성숙잎과 **같은 크기·같은 각·같은 빛**으로 나란히(방 · 확대창 각) 찍어 박사님께 올릴 그림을 만든다.

### 6-b. 10-10 1단계 결과 → 글 고쳐 다시 (leaf 판정)
받은 두 장(`unity_kit/pilot/mon_mature_detail_2d_{a,b}.png`)은 빛은 받았지만 **사진 같은 윤기 잎**이다 — 이걸로 3D 를 뜨면 «사진 결 vs 지금 저폴리»를 견주게 된다. 박사님께 여쭐 것은 «결은 그대로 · 더 세밀하게»라서 고른다면 «부드러운 그림 결의 세밀한 잎»이어야 한다 ⇒ 2단계(Tripo)로 안 넘기고 1단계만 다시(2장 · 5.5).
참조: ① 지금 성숙잎 3/4(모양) ② `REF_STYLE_B` = `assets/raw/plants/pink_princess/PP2_clean.png`(지금 잎의 파스텔 색).
글: `A single Monstera deliciosa mature leaf with its petiole, the same silhouette, splits and holes as image 1, 3/4 view, petiole pointing down, the whole leaf visible and centered. Stylized soft 3D game render, NOT a photo: smooth gently curved surface (not faceted, not low-poly), soft natural veins, matte finish with no glossy highlights, the soft pastel green palette of image 2, soft even studio light with gentle shading so the curvature reads. Isolated on a plain pure white background, no pot, no shadow, no text.`
