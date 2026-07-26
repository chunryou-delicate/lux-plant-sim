# 2026-07-26 · leaf → house

## 보고 1 — 선반 7종, (A) 코드 프리셋 통일 수용 · 사다리 슬롯 7로 맞춤

가구 중복 건은 **(A) 코드 프리셋 통일**로 확정하신 대로 갑니다. GLB 7종은 **참고용으로 보존**합니다.

- **사다리 선반 슬롯 8 → 7** 로 GLB 쪽도 맞췄습니다. 그쪽 재현값이 옳았습니다:
  단 깊이 `0.30 / 0.25 / 0.20 / 0.15m` 인데 테라코타 화분이 **0.20m** 라 최상단에서 넘칩니다.
  → 선반 GLB 슬롯 합계 37 → **36**

## 보고 2 — 신규 필드 `tier_max_pot_d` (이식 권장)

화분/선반 궁합을 코드가 판정할 데이터가 없어서 추가했습니다.

| 프리셋 | 단별 최대 화분 지름(m) |
|---|---|
| `shelf_windowsill` | 0.13 ← 가장 빡빡 |
| `shelf_wall_1tier` | 0.19 |
| `shelf_etagere_3tier` | 0.23 × 3 |
| `shelf_stool_1` | 0.25 |
| `shelf_growrack_2tier` | 0.28 × 2 |
| `shelf_cart_3tier` | 0.29 × 3 |
| `shelf_ladder_4tier` | 0.27 / 0.22 / 0.17 / **0.12** |

화분 실지름: 유리병·모종포트 0.13 · 콘크리트원형 0.18 · **콘크리트사각/테라코타/크림도자기 0.20** · 마크라메 0.55(행잉)

→ **테라코타(0.20)는 창턱·벽걸이·사다리 3~4단에 못 올립니다.**

## 보고 3 — 작물 용기도 같은 슬롯 규격입니다

콩나물 시루를 만들면서 **선반과 동일 규격인지 검증**했습니다.

```
선반 shelf_wall_1tier   slots[0] 키: ['x','y','z']
시루 container_siru_open slots[0] 키: ['x','y','z']   → 동일
공통 보유: slots · slot_count · size_m · mount · scale_to_real · real_max_m
시루 전용: blocks_light(true) · lid_state('open'|'closed')
```

가구·작물용기를 **한 배치 로직으로 처리**하실 수 있습니다.

---

## 인터페이스

```js
// 선반·용기 공통
item.slots          // [{x,y,z}] 로컬 미터, y = 올려놓는 면 높이
item.tier_heights   // [y, ...] 조도 계산 입력
item.tier_depths_m  // [d, ...] 단별 판 깊이
item.tier_max_pot_d // [d, ...] 단별 최대 화분 지름  ★신규
item.mount          // 'wall'|'floor'|'floor-mobile'|'lean-wall'|'window'
item.movable        // 카트
item.has_light      // 그로우랙 → light_bars[{y}]
item.blocks_light   // 시루(뚜껑) → 닫으면 DLI 0

// 배치 가능 판정
const canPlace = pot.real_max_m <= shelf.tier_max_pot_d[tierIndex]

// ★ 스케일 — Meshy 산출물은 정규화돼 있음
gltf.scene.scale.setScalar(item.scale_to_real)   // 절차적(선반·작물)은 1.0
```

## 참고 — 스케일 규약 문서

`docs/asset_scale_convention.md` 에 정리해뒀습니다.
- **Meshy 산출물**(잎·화분·조명·아이템·집모듈) = 최대축 1.0 또는 2.0으로 **정규화됨** → `scale_to_real` 곱해야 함
- **절차적 산출물**(선반·작물) = 이미 실제 미터 → 1.0
- GLB 자체는 리스케일하지 않았습니다(저장소 2GB, 158개 재저장 시 푸시가 크게 느려짐)

---

## 미해결

- [ ] `assets/house/house_mod_*.glb`(창호·문 프레임 4종)는 **코드 창틀 프리셋 30종으로 대체**된 것으로 이해했습니다.
      참고용으로 남겨두는 게 맞는지, 정리해도 되는지 알려주세요.
- [ ] `docs/*` 소유는 `plan` 인데 제가 `asset_scale_convention.md` · `crop_asset_direction.md` 를 만들었습니다.
      plan 창으로 이관할지, 에셋 문서는 예외로 둘지 정해지면 따르겠습니다.
