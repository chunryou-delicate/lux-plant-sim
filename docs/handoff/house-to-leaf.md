# 2026-07-26 · house → leaf

## `assets/house/house_mod_*.glb` 4종 — **코드에선 안 씁니다. 다만 지우진 마세요**

이해하신 게 맞습니다. 창호·문은 전부 코드 프리셋으로 생성합니다.

```
data/window_presets.json  →  src/render3d/house.js 가 박스 기하로 조립
data/door_presets.json    →  같음
```

**참조를 전부 뒤졌습니다 — 코드에서 쓰는 곳이 0곳입니다.**

```
house_mod_window_normal.glb    ← 참조 0 (assets/manifest.json 에만 등재)
house_mod_window_banjiha.glb   ← 참조 0
house_mod_glass_panel.glb      ← 참조 0
house_mod_door.glb             ← 참조 0
합계 8.0MB
```

### 그런데도 제 판단으로 안 지웁니다

사용자 방침이 **"생성물은 묻지 말고 전부 `assets/` 에 보관"** 입니다(깃 푸쉬 대비).
쓰지 않는다는 것과 지워도 된다는 것은 다릅니다 — **8MB 삭제는 사용자 결정**이라고 봅니다.

정리하고 싶으시면 사용자에게 물어보시고, 승인 나면 `assets/house/` 는 house 소유이므로
**여기에 적어 주시면 제가 지웁니다.** 그때 같이 정리할 것:

```
assets/manifest.json          해당 4개 항목 (4676·4695·4714·4817행 부근)
assets/house/src/*_src.png    원화 3장 (source_2d)
```

원화 PNG는 3D를 다시 뽑을 때 필요하니 **GLB만 지우고 원화는 남기는 쪽**을 권합니다.

---

## `docs/*` 소유 — plan 이관을 권합니다

`asset_scale_convention.md` · `crop_asset_direction.md` 건입니다.
저도 같은 상황이었고, **사용자가 `docs/engine/` 을 house 소유로 승인**해 줬습니다.

즉 **"docs 전체가 plan"이 아니라 하위 폴더로 쪼개는 방식**이 이미 인정됐습니다.
`docs/assets/` 를 leaf 소유로 달라고 plan에 요청하시면 같은 근거로 통과할 것 같습니다.
소유 표에 새 줄이 필요하니 `docs/handoff/README.md` 갱신은 plan이 해야 합니다.

---

## 참고 — 방별 실측이 갱신됐습니다

작물 에셋 배치에 쓰실 수 있어 적어 둡니다. **peak가 아니라 7일평균이 판정 기준**입니다.

| 방 | 슬롯 | peak | 7일평균(여름) | 무광(<0.3) 자리 |
|---|---|---|---|---|
| 반지하 | 13 | 0.55 | 0.25 | 9 |
| 원룸 | 11 | 4.77 | 2.20 | 1 |
| 학원교실 | 32 | 5.49 | 2.53 | 10 |
| 투룸 | 20 | 5.64 | 2.60 | 2 |
| 아파트 | 83 | 6.02 | 2.77 | 20 |
| 온실 | 64 | 13.01 | 5.99 | 9 |

원본은 `data/house_rooms.json` 의 `rooms.{id}.measured` 입니다.

**반지하에 0.55~0.48 짜리 4칸**이 있습니다. 관엽엔 부족하고 콩나물엔 밝은 죽은 구간이라
**새싹채소·상추 같은 저광 작물이 들어오면 딱 맞는 자리**입니다. 작물 기획 때 참고하세요.

## 미해결

- [ ] GLB 4종 정리는 **사용자 승인 후** 이 파일에 적어 주세요. 제가 지웁니다
