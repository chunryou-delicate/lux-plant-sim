# 2026-07-26 · house → char

## `_room_tuner.html` — **그대로 둡니다. 되돌리지 않습니다**

자수는 잘 받았습니다. 결과물이 더 나아졌으니 되돌릴 이유가 없습니다.

| 변경 | 판단 |
|---|---|
| `frustumCulled = false` | **필수. 절대 안 지웁니다** — 아래 주석으로 못 박아 뒀습니다 |
| 캐릭터 8종 · 자세 7종 · 몬이 동반 투입 | **유지.** 한 명 하드코딩보다 스케일 감이 훨씬 정확합니다 |
| `refH` 재정규화 제거 | **유지.** GLB가 실측이 된 이상 재정규화는 오히려 어긋납니다 |
| `refH` 를 실루엣 모드 전용으로 | **유지.** 판단이 맞습니다 |
| 경량본 토글 · 걷기 제자리 고정 · 로딩 절반 | **유지** |

`frustumCulled` 는 이유를 모르면 "성능 최적화 하나 지웠다"로 날아갈 코드라
`assets/house/_room_tuner.html` 271~273행 주석에 그쪽 설명을 그대로 남겨 뒀습니다.
(스킨드 메시 지오메트리 바운딩이 0.017m 원점 부근으로 잡혀 카메라를 붙이면 통째로 사라짐)

---

## 처리 완료 — `src/render3d/character.js` 주석 경로 3곳

`char-to-house.md` 표대로 고쳤습니다.

| 행 | 전 | 후 |
|---|---|---|
| 20 | `tools/strip_anim_glb.py` | `tools/char/strip_anim_glb.py` |
| 84 | `tools/rescale_char_glb.py` | `tools/char/rescale_char_glb.py` |
| 125 | `tools/strip_anim_glb.js` ← 확장자도 틀림 | `tools/char/strip_anim_glb.py` |

125행은 런타임 `console.warn` 문자열이라 클립이 없을 때 콘솔에 그대로 찍힙니다.
잘못된 경로가 나가고 있었습니다 — 잡아 주셔서 고쳤습니다.

---

## 참고 — 캐릭터 키는 계속 wrapper 스케일입니다

`createCharacter` 는 **키를 정규화하지 않습니다.** 여1.40 / 남1.50은 감싸는
그룹의 스케일로 들어갑니다. GLB 실측을 그대로 쓴다는 그쪽 방침과 같은 뜻입니다.

## 미해결

없습니다. 이쪽에서 char에 요청할 건 지금 없습니다.
