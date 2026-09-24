# hero.glb 재기 — 2026-09-24 · [Char] · 크레딧 0

대상 `assets/v2/char/hero.glb` (e1157774). 파일은 **읽기만** 했다.

## 판정 — ✔ 쓸 만하다
| 물음 | 답 |
|---|---|
| 덩어리 | ✔ 1개 100% · 정점 25,478 · 면 30,540 (판·액자 없음) |
| 크기 | 키 1.10 · 가로 0.83(T포즈 팔 포함) · 깊이 0.43 |
| 뼈대 | ✔ 24본 이름·차례·부모 관계 기존과 같다 (`check_skeleton_match` O) |
| 클립 8개 | walk·idle·sit·sleep·doze·crouch·wave·cheer — 전부 24본만 친다(뼈 밖 0) |
| 클립이 몸을 늘이나 | ✔ 안 늘인다 — Spine·LeftLeg 길이가 모든 클립에서 ×1.00. Hips 만 흔들리는데 이것은 «자리 이동»이다 |
| 생김새 | `hero_4views.png` (재질 없이 형태만 · 정면·좌·뒤·3/4) — 긴 생머리+앞머리 · 티셔츠 · 조거 바지 · 신발 · 치비 · 네 각도가 서로 맞는다 |

⚠ 옛 `assets/characters/3d/anim/` 클립을 hero 에 얹지 말 것 — 그 클립은 키 1.7 몸의 뼈 길이(translation)를 덮어써 hero 가 늘어난다. hero 는 제 클립 8개를 쓴다.

## ⛔ 재다가 드러난 «내 자» 버그 둘 — 고쳤다
1. **끼워 넣은 버퍼(byteStride)를 무시했다.** hero 는 POSITION·NORMAL·UV·JOINTS·WEIGHTS 를 stride 52 로 한데 끼웠다.
   `strip_stray_parts.py`·`probe_body_fit.py`·`transfer_weights.py` 가 연속으로 읽어 «키 2.05 정육면체 · 482덩어리 · 판이 섞였다 · 리깅 쓰지 말 것»을 냈다 — **멀쩡한 몸을 물릴 뻔했다.**
   파일의 min/max(키 1.10)와 달라서 잡았다. ⇒ stride 를 읽고, **읽은 범위가 min/max 와 다르면 멈추는 관문**을 넣었다.
   (9/8 뒤 총괄이 지은 `glb_probe.py`·`glb_shot.py` 는 처음부터 stride 를 읽었다 — 그것으로 그림을 냈다)
2. **`transfer_weights --selftest` 가 9/14 부터 늘 떨어지고 있었다**(뼈 칸 13.59% 다름).
   9/14 에 이식을 「최근접 1개」→「이웃 12개 섞기」로 바꾸면서 시험은 그대로 두었다. 섞으면 자기 자신에게도 똑같이 안 나온다.
   ⇒ 시험을 k=1(섞지 않음)·뼈마다 무게 비교로 바로잡았다. 일부러 망친 무게로는 **떨어지는 것**도 확인했다.
   ⚠ k=12 섞기가 잘 섞는지는 이 시험으로 못 본다 — 걸어 보고 눈으로 볼 일.

## 되풀이 확인 (고친 뒤)
- 옛 파일 `char_jachwi_f_rigged` · `char_yeoja_base_v4_rigged` ⇒ 여전히 1덩어리 100% · 키 1.7000 (예전 답과 같음)
- 이식 자기시험 ⇒ jachwi_f ✔ · hero ✔ · 망친 무게 ⛔(떨어짐)
