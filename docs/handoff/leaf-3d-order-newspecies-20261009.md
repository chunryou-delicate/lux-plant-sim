# leaf 새 종 3D 주문표 — 스킨답서스 · 칼라데아 (2026-10-09 · [leaf])

> 총괄(10-09): «새 종의 3D 는 Meshy 잔액을 기다리지 말고 Higgsfield 로 · ② 검수가 끝나면 3D 주문표».
> ⛔ 크레딧 쓰는 호출은 총괄이 돌린다. 주문 그대로: `leaf-3d-order-newspecies-20261009.json`(12줄). 받은 GLB 를 재고 잇는 일은 leaf.

## 0. 고른 것

| 칸 | 값 | 까닭 |
|---|---|---|
| 밑 메시 | `generate_3d` · `tripo_h3_1_image_to_3d` · `texture: true` · `pbr: true` · `texture_quality: detailed` · `geometry_quality: standard` · `face_limit: 5000` · `orientation: align_image` (get_cost 12) | 한 장 그림 → 잎 GLB 가 가장 싸고 PBR 이 같이 온다(유니티 몫). ⚠ 총괄 시험에서 `detailed + pbr false` 가 failed — pbr true 로. 5000 면 = 지금 잎 규약(3~6천) |
| 무늬판 | `generate_3d` · `meshy_v5_retexture` · `model_url` = 그 단계 밑 메시 결과 GLB 주소 · `image_style_url` = 고른 무늬 2D(raw 주소) · `text_style_prompt` · `enable_original_uv: true` · `enable_pbr: false` (get_cost 9.5) | **한 종 안의 판은 한 뼈대**(PP·AL 과 같은 규약 — 단계마다 조정표 한 줄 · 유니티 마스크가 같은 UV 에 붙는다) |
| 입력 2D | ② 검수에서 고른 판(manifest `chosen_version`) — SC2 a · SC3 a · SC4 a · SC5 b · CA1 b · CA2 a · CA3 a · CA4 b · CA5 a · ⏸ **SC1 은 다시 뽑기(r2) 뒤** | 고른 까닭은 주문표 `leaf-higgsfield-order-20261009.md §7` |

## 1. 줄

| 이름 | 무엇 | 입력 | 받을 곳(`assets/plants/<종>/_incoming1009/`) | 값 |
|---|---|---|---|---|
| SC_young_3d | 스킨답서스 어린잎 밑 메시 | SC1 r2 고른 판 ⏸ | `sc_leaf_young.glb` | 12 |
| SC_mid_3d | 스킨답서스 중간잎 | SC2_a | `sc_leaf_mid.glb` | 12 |
| SC_mature_3d | 스킨답서스 성숙잎 | SC3_a | `sc_leaf_mature.glb` | 12 |
| CA_young_3d | 칼라데아 어린잎(오비폴리아 줄무늬 = 원래 무늬) | CA1_b | `ca_leaf_young.glb` | 12 |
| CA_mid_3d | 칼라데아 중간잎 | CA2_a | `ca_leaf_mid.glb` | 12 |
| CA_mature_3d | 칼라데아 성숙잎 | CA3_a | `ca_leaf_mature.glb` | 12 |
| SC_mature_marblequeen | 성숙 · 마블퀸(흰 마블) | SC_mature_3d + SC4_a | `sc_mature_marblequeen.glb` | 9.5 |
| SC_mature_njoy | 성숙 · 엔조이(흰 가장자리 조각) | SC_mature_3d + SC5_b | `sc_mature_njoy.glb` | 9.5 |
| SC_mid_marblequeen | 중간 · 마블퀸 | SC_mid_3d + SC4_a | `sc_mid_marblequeen.glb` | 9.5 |
| SC_mid_njoy | 중간 · 엔조이 | SC_mid_3d + SC5_b | `sc_mid_njoy.glb` | 9.5 |
| CA_mature_whitefusion | 성숙 · 화이트퓨전(흰 붓질 마블) | CA_mature_3d + CA5_a | `ca_mature_whitefusion.glb` | 9.5 |
| CA_mid_whitefusion | 중간 · 화이트퓨전 | CA_mid_3d + CA4_b | `ca_mid_whitefusion.glb` | 9.5 |
⇒ **129** + 재시도 몫 ≈ 30(무늬를 못 살리면 `image_style_url` 을 빼고 글만으로 · 메시가 두 덩이·두 겹이면 같은 그림 다시) = **≈ 159**.
차례: 밑 메시 다섯(SC_young 빼고) → 무늬판 여섯 → SC1 r2 뒤 SC_young.

## 2. 받은 뒤 leaf 가 하는 일 (크레딧 0)
1. `leaf_audit.py` — 메시 1 · 이음매 법선 갈림 < 5%(넘으면 `weld_normals.py`) · 채움 ≤ 100%(앞뒤 두 겹 아님) · 삼각 3~6천.
2. 규약(leaf-meshy-plan §2-b): 잎자루를 품고 자루 끝이 가장 아래 · 긴 축 세로 · 밑색 하나. 무늬판이 밑 메시와 정점·UV 가 같은지 잰다.
3. 웹 판: 텍스처 1024 JPEG(`shrink` 규약) · 유니티 키트: 2048 그대로(`unity_kit.py tex` 가 `_incoming` 을 후보로 찾는다) · 무늬 마스크(`unity_kit.py mask`).
4. 썸네일(위에서) · manifest(`잎·스킨답서스·…` · `real_max_m` = 주문표 실측) · 같은 크기로 PP·AL 잎과 나란히 그림 → growth 에 넘김(종 프로필 · 덩굴·로제트 규칙은 growth 몫 — 그루 기준 그림 SC6·CA6 이 있다).

## 3. 무늬판이 안 서면 — Tripo 로 따로 (박사님 원칙 10-10 «Meshy 가 잘 안 되면 Tripo 로»)

판정(leaf · 받은 무늬판마다): ① **UV 같음** — 밑 메시와 정점 수·UV 좌표가 같은가(장부 `leaf_20261009_r2_3d.json` 의 «UV 같음» + leaf 가 GLB 를 열어 다시 잼) ② **무늬가 섰나** — 위에서 찍어 무늬 원화와 같은 크기로 나란히(마블·가장자리 조각·붓질이 읽히나).
둘 중 하나라도 ✗ 면 **Meshy 로 다시 뜨지 않고** 그 줄만 JSON `fallback_tripo` 로 돌린다 — 무늬 원화(SC4_a · SC5_b · CA5_a · CA4_b)를 `tripo_h3_1_image_to_3d`(detailed · pbr · 5000 · 12/줄).
⚠ 대가(알고 고른다): 그 무늬판은 밑 메시와 **다른 뼈대** — growth 조정표가 판마다 한 줄 · 같은 단계라도 잎 꼴이 조금 다르다 · 유니티 마스크는 GLB 마다 뽑으니 문제없음. 중간 무늬판(SC_mid_*)은 무늬 원화가 성숙 꼴뿐이라 같은 원화를 쓰고 게임이 중간 크기로 줄인다(눈에 띄면 중간 꼴 무늬 원화를 2D 로 먼저 · 2.75×2).
