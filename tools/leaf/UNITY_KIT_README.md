# 유니티 식물 키트 — 만드는 법 ([leaf] 2026-10-09)

키트는 **저장소 밖**(`<저장소 위>/unity_kit/plants/`)에 만든다. 저장소에서 크레딧 0 으로 언제든 다시 만들 수 있는 파생물이라 저장소에 안 넣는다(총괄 10-09 · pack 5.95 GiB). 무엇을 왜 넘기나는 `docs/handoff/leaf-unity-kit-20261009.md`.

## 만드는 명령

```bash
python tools/serve.py 9340 &                       # U4(위에서 찍기)만 서버가 필요하다
python tools/leaf/unity_kit.py tex                 # U2 — 잎 GLB 마다 2048 밑색을 찾아 넣는다
python tools/leaf/unity_kit.py mask                # U3 — 무늬 마스크 · 초록 밑판 · 무늬색 표
```
`--out=<경로>` 로 내는 곳을 바꾸고 `--only=mon_zebra,pp_leaf` 로 일부만 만든다.

## 나오는 것

```
unity_kit/plants/
  kit_log.json                 이름 → 2048 을 어디서 찾았나(후보 · PSNR) · 마스크 실측
  monstera/mesh/<이름>.glb     같은 메시·같은 UV · 밑색만 2048 JPEG q95(4:4:4)
  monstera/mask/<이름>_mask.png    R = 무늬 몫(부드러운 경계) · G = 무늬 안 «둘째 색» 몫 · B = 0
  monstera/mask/<이름>_base.png    초록 밑판(무늬 자리를 밑판 초록으로 · 원래 밝기 결은 조금 남김)
  monstera/mask/<이름>_colors.json 밑판색 · 무늬색1·2 · «잎 전체 특수색» 여부 · 실측
  pink_princess/… · alocasia/…  같은 꼴
```

## 2048 을 어디서 찾나 (`tex`)

추측하지 않고 잰다 — 후보마다 1024 로 줄여 **지금 게임 텍스처와 PSNR**, 35dB 넘는 첫 후보를 쓴다.
① 지금 GLB 가 이미 2048 ② `skins/_orig/`(08-16 1024 로 줄이기 전 원본 · 676f1781) ③ Meshy 10-09 아홉 가족: `_incoming1009/<가족>_new.glb` + `stage_meshy1009.PARAMS` ④ 쨍(_v1)·차분(_v2): 2048 기본판에 `recolor_calm` 의 vivid · redo(PICK·1·2·3) · dim ⑤ 핑크프린세스·알로카시아: 같은 종 `_incoming1009` 원본 · 그 원본에 `depink`·`allpink`(이 둘은 해상도 따라 조금 갈려 30dB 넘으면 «파생»으로 받는다).
못 찾으면 장부에 «1024 만»으로 적고 지금 GLB 를 그대로 둔다 — **늘려서 2048 인 척하지 않는다.**

## ⚠ 알고 쓸 것

- **마스크는 그 GLB 의 UV 에 붙는다.** 유니티가 다른 메시(예: Tripo·Meshy 로 새로 뽑은 메시)를 쓰면 그 메시에서 마스크를 다시 뽑아야 한다 — 무늬판을 새 메시에 입히는 길은 Higgsfield `meshy_v5_retexture`(원래 UV · PBR).
- 쨍·차분 판은 마스크를 따로 안 만든다 — 같은 기본판 마스크에 색 값만 다르다(`_colors.json`).
- 자동 판정이 틀린 가족은 `tools/leaf/varie_mask.py` 의 `OVERRIDE` 표에 한 줄씩(까닭과 함께) 있다.
- 메시는 지금 웹 규약 그대로다(높이 1 로 맞춰 쓰고 크기·각도는 plant_grow 조정표 · 실측은 manifest `real_max_m`). 유니티 규약(자루 끝 원점 · +Y 위 · 미터)으로 굽는 단계(U1)는 다음.
