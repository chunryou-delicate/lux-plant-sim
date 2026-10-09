# 유니티 키트 확인용 한 가족 (하프문-그린흰 · [leaf] 10-09)

키트 전체는 저장소 밖(`<저장소 위>/unity_kit/plants/`)에 있다 — 만드는 법은 `tools/leaf/UNITY_KIT_README.md`. 여기는 꼴 확인용 한 가족뿐이다.

| 파일 | 무엇 |
|---|---|
| `monstera/mon_halfmoon_greenwhite.glb` | 지금 게임 메시 그대로 · 밑색만 2048(JPEG q95 · `_orig` 원본 · PSNR 42.9dB) |
| `monstera/mon_halfmoon_greenwhite_mask.png` | R = 무늬 몫 · G = 둘째 색 몫(이 가족은 0) · **이 GLB 의 UV 에 붙는다** |
| `monstera/mon_halfmoon_greenwhite_base.jpg` | 초록 밑판(키트에선 PNG · 여기만 무게로 JPEG) |
| `monstera/mon_halfmoon_greenwhite_colors.json` | 밑판색 · 무늬색 · 실측(무늬 54% · 밑판에 남은 무늬 0%) |

셰이더(유니티 몫)는 `lerp(밑판, 무늬색 또는 원래 밑색, mask.R × 드러남)` 꼴 — 성숙 때 드러남을 0→1 로.
