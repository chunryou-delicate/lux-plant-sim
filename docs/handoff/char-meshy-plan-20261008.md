# char 몫 — Meshy 로 만들면 게임에 «실제로» 쓰일 것 (2026-10-08 · 아직 안 씀)

총괄 14:20 청 · 박사님 «메시 기간이 얼마 안 남았으면 다 쓰는 방향» · 잔액 2,009(총괄).
house 의 `docs/handoff/meshy-plan-20261008.md` 에 붙일 char 절이다(그 파일이 아직 없어 따로 썼다).
크레딧 값은 Meshy 안내표: retexture 10 · image→3D(텍스처) 30 · rig 5(걷기·뛰기 포함) · animate 3 · image→image 6(nano-banana-2).

## 넣는 것

| 차례 | 항목 | 크레딧 | 쓰는 곳 | 왜 지금 |
|---|---|---|---|---|
| 1 | **주인공 계절 옷 3벌**(봄·가을·겨울 · 여름 = 지금 크림 티) — ★ 길 ①: 지금 hero.glb 에 `retexture` | **30** (10×3 · 첫 벌이 시험) | `v2_hero.js` 가 계절에 맞는 텍스처를 입힌다(char) · 계절 값은 core 가 넘긴다 | D1 로 원룸부터 계절이 흐른다 — 겨울에 반팔이다 |
| 2 | **주인공 일 클립** 물주기·심기·거두기(서서)·거두기(쭈그려) — hero 몸에 `animate` | **12** (3×4) · hero 리그 작업 id 가 없으면 `rig` **+5** | `v2_hero.js actClipFrom` 이 동작마다 제 클립을 낸다(char) — 지금은 셋 다 crouch_arm 하나 | 매일 하는 동작이라 가장 자주 보인다 |
| 3 | 주인공 잠깐 몸짓 2~3(머리 긁기 · 기지개 · 둘러보기) — `animate` | **9** (3×3) | room_view `IDLE_BREAK` — 지금 hero 는 빈 목록(`hero ? [] :`) · core 가 hero 목록을 열어야 한다 | 선택 — 서 있을 때 덜 굳어 보인다 |

**합 51 · (리그 다시 하면 56).**

### 길 ① 계절 옷 = `retexture` 를 고른 까닭
- 몸·뼈·클립 11개·몸짓 무게(_WEIGHTS_EMOTE)·팔 고친 것·손 높이 표를 **그대로** 쓴다 — 옷만 바뀐다
- 소매·코트는 «부피 없이 그려진» 판이다(팔 살에 소매를 칠한다). 폰에서 사람은 몸 폭 44 CSS px — 부피 차이는 안 보인다
- ⛔ 막힐 수 있는 것 두 가지 — 첫 벌(10)로 먼저 잰다:
  ① retexture 가 정점·UV 를 바꾸면 → 우리 UV 로 «3D 가까운 면에서 색 떠오기»로 다시 굽는다(새 자 · 0)
  ② 머리색이 바뀌면 → `recolor_hero_tex.py` · `hair_lift_tex.py`(D3·D24)를 다시 돌린다(0)
- 판정: `shot_body_still --tex`(같은 자 전후) + `probe_hair_onscreen`(폰 화면 머리색) · 얼굴·머리 모양이 그대로인지

### 길 ② (길 ① 이 막히거나 «부피 있는 옷»을 원하실 때) — 옷 입은 몸 통째(char-outfit-whole 규칙)
한 벌 = 그림 6 + image→3D 30 + rig 5 + 클립 6개(idle·sit·sleep·crouch·cheer·wave) 18 = **59** · 세 벌 **177**.
⚠ 벌마다 얼굴·머리가 새로 그려진다 — D3(초상화 정본)에서 어긋날 수 있다. 뒤 손질(팔 회전 옮기기 · 몸짓 무게 · 머리색 · 손 높이 표)은 크레딧 0 이지만 벌마다 다시 한다.

## 안 넣는 것 (재 보고 뺐다)
- **원룸·엔딩 장면에 서는 사람** — 없다. 엔딩 장면은 2D 원화(`ev_home_ending` · Higgsfield)이고 원룸에 다른 사람(NPC)이 없다 ⇒ Meshy 0
- **몬이 3D** — 게임 것(`assets/characters/3d/lq/char_mascot_sprout.glb`)을 그려 보니 정본과 맞다(테라코타 화분 · 몬스테라 잎 · 연두 몸) ⇒ 0

## 싸고 쓰일 수 있는 덤 (박사님이 «다 쓰는 쪽»이면)
| 항목 | 크레딧 | 쓰는 곳 |
|---|---|---|
| 잠옷 한 벌 (retexture) | 10 | 눕기(sleep) 동안만 입힌다 — v2_hero |
| 비 오는 날 겉옷 (retexture) | 10 | 원룸 날씨가 흐른다(D1) — 비 오는 날 |

## ⚠ 후보 — 박사님 결정 대기 · 크레딧 셈에 따로
**주인공 머리 «모양»**(지금 긴 생머리). 바꾸시면 hero 를 새로 만든다:
그림 6 + image→3D 30(+정밀 5) + rig 5 + 클립 6개 18 = **59~64**, 그리고 위 1(계절 옷 30)을 새 몸에 **다시**.
- 덤으로 풀리는 것: 묶거나 짧은 머리면 «머리카락이 팔에 묶인» 문제(몸짓 무게 · 바늘)가 뿌리째 없어진다
- ⇒ ★ **차례 1(계절 옷)은 이 결정 뒤가 맞다** — 먼저 하면 머리를 바꿀 때 30 이 버려진다. 2·3(클립)은 뼈 이름으로 옮겨 쓰니 새 몸에도 그대로 쓰인다 ⇒ 먼저 해도 된다.

---

# ★ 주문표 — 총괄이 그대로 돌린다 (2026-10-09 · 박사님 승인: 머리 «초상화처럼 긴 생머리» · Meshy «다 쓰기 안»)

⛔ 크레딧 쓰는 호출은 총괄 창이 한다. char 는 «관문»(G1~G4)마다 받은 것을 재고 다음으로 넘긴다 — 관문을 건너뛰지 않는다.
⛔ 받은 것을 게임에 잇는 일(뼈 이름 맞추기 · 팔 확인 · fixBackHair · 몸짓 무게 · 머리색 D3/D24 · 손 높이 표 · v2_hero)은 char 가 한다. 그동안 게임의 hero.glb 는 «안» 바꾼다.

## 왜 A포즈인가 (재서 정했다)
- 지금 hero 는 **T포즈**로 떴다 ⇒ Meshy 클립이 팔을 든다(걷기 82° · idle 38° · crouch 47°) · 긴 머리가 팔 무게를 받는다(머리 정점 11,343 · 몸짓 무게까지 만들어 막았다)
- 옛 자취녀 몸들은 **A포즈**(manifest `pipeline_3d`: multi_image_to_3d · a-pose)로 떴고 같은 Meshy 클립에서 팔이 자연스러웠다(걷기 13.8° · idle 18.0°)
- ⇒ 새 주인공은 `pose_mode: "a-pose"` · 그림부터 «팔이 몸에서 40° · 머리와 팔 사이 틈»으로 그린다

## 경로·장부
- 참조 그림(크레딧 0 · char 가 만들어 둠): `assets/characters/portraits/portrait_jachwi_neutral.png`(얼굴·머리 정본) · `assets/v2/char/_ref/hero_v1_front.png` / `_left.png` / `_back.png`(지금 3D 주인공 · D24 색 · 몸 비율·결)
- 받는 곳: `assets/v2/char/_src/hero2/` (아래 이름 그대로)
- **작업 id 장부**: 단계마다 받은 task_id 를 이 파일 맨 아래 «장부» 표에 적는다(총괄이 적거나 char 에 보내면 char 가 적는다). ★ `rig` 의 task_id 가 클립(animate) 전부의 열쇠다.
- 절대 경로 앞머리 `C:/Users/pc/Desktop/빛식물/lux-plant-sim/` (아래 `ROOT/`). ⚠ 한글 경로를 Meshy 가 못 읽으면 참조 그림을 `C:/Users/pc/AppData/Local/Temp/hero2_ref/` 로 복사해 그 경로를 쓴다.

## ① 새 주인공 (긴 생머리 · A포즈) — 9 + 30 + 5 + 18 = 62 (다시 뽑기 여유 별도)

### 1-1 기준 그림 — `meshy_image_to_image` · **9**
```json
{ "ai_model": "nano-banana-pro",
  "reference_file_paths": ["ROOT/assets/characters/portraits/portrait_jachwi_neutral.png",
                           "ROOT/assets/v2/char/_ref/hero_v1_front.png",
                           "ROOT/assets/v2/char/_ref/hero_v1_back.png"],
  "generate_multi_view": false,
  "prompt": "Full-body FRONT view of the same chibi 3D character as image 2: same head-to-body ratio, same soft 3D toy style, same outfit. Standing straight in A-pose: arms straight down, 40 degrees away from the body, palms in, feet slightly apart. Face and hair exactly like image 1: LONG straight very dark brown hair (not black), blunt straight bangs, front locks fall onto the chest, the rest down the back; clear gap between hair and arms. Big warm-brown eyes, pink blush. Cream round-neck short-sleeve t-shirt, light grey jogger pants, grey-white shoes. Plain white background, even light." }
```
받기: `meshy_download_model { task_id, task_type: "image-to-image", save_to: "ROOT/assets/v2/char/_src/hero2/img_<task_id>.png" }`
**1-1b (G1 다시일 때)** — 같은 인자, 글만 아래로(593자 · 머리를 어깨 «뒤»로 · 앞머리 두 가닥만 어깨선 «안»으로 · 팔 45°):
`Full-body FRONT view of the same chibi 3D character as image 2: same head-to-body ratio, same soft 3D toy style, same outfit. A-pose: arms straight down, 45 degrees away from the body, palms in, feet apart. Face and hair like image 1: LONG straight very dark brown hair (not black), blunt straight bangs. Hair falls BEHIND the shoulders down the back; only two thin front locks hang inside the shoulder line onto the chest. Shoulders and sleeves fully visible, empty space between hair and arms. Big warm-brown eyes, pink blush. Cream short-sleeve t-shirt, grey jogger pants. White background.`

**G1 (char · 0)** — 고르는 자: ①긴 생머리·일자 앞머리·아주 짙은 갈색(검정 아님) ②팔이 몸에서 30~45° · 머리와 팔 사이 틈 ③크림 티(흰 티 아님) ④지금 3D 와 같은 머리:몸 비율 ⑤손가락·옷 깨짐 없음. 하나라도 어긋나면 같은 주문으로 한 번 더(9).

### 1-2 3D 뜨기 — `meshy_image_to_3d` · **30**
```json
{ "input_task_id": "<G1 에서 고른 image-to-image task_id>",
  "ai_model": "latest", "model_type": "standard", "pose_mode": "a-pose",
  "should_texture": true, "texture_resolution": "2k", "enable_pbr": false,
  "image_enhancement": false,
  "should_remesh": true, "target_polycount": 30000, "topology": "triangle",
  "multi_view_thumbnails": true, "target_formats": ["glb"] }
```
- `target_polycount 30000` — 지금 hero 와 같은 급(면 30,540). 폰 · 리그 한도(30만) 둘 다 맞고 remesh(5)가 따로 안 든다
- `image_enhancement: false` — 정본 그림의 색·결을 지킨다
받기: `{ task_id, task_type: "image-to-3d", format: "glb", save_to: "ROOT/assets/v2/char/_src/hero2/img3d_<task_id>.glb" }`
**G2 (char · 0)** — 한 덩어리 · 면 수 · 앞·옆·뒤 그림(얼굴·뒷머리 길이) · 머리 텍셀 색 · 머리와 팔 정점 사이 거리(바인드). 어긋나면 1-2 를 한 번 더(30) 또는 1-1 부터.

### 1-3 리그 — `meshy_rig` · **5** (걷기·뛰기 공짜로 딸려 온다)
```json
{ "input_task_id": "<1-2 task_id>", "height_meters": 1.4 }
```
- `1.4` — 게임 키(HERO_H 1.40)와 같게 ⇒ 감싸는 배율이 1 에 가깝다
받기: `{ task_id, task_type: "rigging", format: "glb", save_to: "ROOT/assets/v2/char/_src/hero2/rig_<task_id>.glb" }` (걷기·뛰기 GLB 도 같은 폴더)
**G3 (char · 0)** — 24뼈 이름·차례가 지금 hero 와 같나(`check_skeleton_match`) · 걷기 팔 벌림각(`probe_arm_spread` · 목표 ≤ 25°) · 머리 정점의 팔 무게 수(지금 11,343 과 견줌). ★ 이 task_id 를 장부에 — 아래 클립 전부가 이것으로 간다.

### 1-4 게임이 쓰는 클립 6 — `meshy_animate` · 3 × 6 = **18**
```json
{ "rig_task_id": "<1-3 task_id>", "action_id": <아래 번호> }
```
| 이름 | action_id | 게임에서 |
|---|---|---|
| idle | 0 | 서 있기 |
| sit | 32 (여) | 앉기 끝 1초 |
| sleep | 267 | 눕기 |
| crouch | 274 (repot) | 물·심기·거두기 «손을 뻗어 내림» — 손 높이 표를 새로 잰다 |
| cheer | 49 | 첫 새순 · 첫 무늬 |
| wave | 28 | 몬이 첫 인사 |
받기: `{ task_id, task_type: "animation", format: "glb", save_to: "ROOT/assets/v2/char/_src/hero2/anim_<이름>_<task_id>.glb" }`
**G4 (char · 0)** — 클립마다 팔 벌림각 · 머리 들림. 걷기·idle 이 25° 넘으면 지금처럼 «팔 회전만 옮기기»(크레딧 0)로 고친다. 그 뒤 char 가 한 파일로 묶어 게임에 잇는다.

## ② 일 클립 4 · 잠깐 몸짓 3 — 3 × 7 = **21** (1-3 rig_task_id 로 · G3 뒤면 1-4 와 함께 돌려도 된다)
| 이름 | action_id | 게임에서 |
|---|---|---|
| water | 285 (opendoor — 옛 물주기 자리) | 물주기 |
| harvest | 278 | 서서 거두기 |
| harvest_low | 277 | 낮은 화분 거두기 |
| pickup | 276 | 물뿌리개·도구 집기 |
| scratch | 36 | 잠깐 몸짓(머리 긁적) |
| nod | 25 | 잠깐 몸짓(끄덕) |
| listen | 47 | 잠깐 몸짓(듣기) |
- 잠깐 몸짓은 core 가 room_view `IDLE_BREAK` 의 hero 목록을 열어야 쓰인다(char 가 청한다)

## ③ 계절 옷 3 + 잠옷 + 비 겉옷 — `meshy_retexture` · 10 × 5 = **50** (★ ①이 G3 를 지난 뒤)
```json
{ "input_task_id": "<1-2 task_id — 리그 전 3D>", "ai_model": "latest",
  "enable_original_uv": true, "texture_resolution": "2k", "enable_pbr": false,
  "text_style_prompt": "<아래 글>" }
```
- `input_task_id` 로 주면 UV 를 그대로 쓴다(Meshy 기본) ⇒ char 가 «그림만» 떼어 리그된 몸에 입힌다(뼈·클립·무게 그대로)
- 글 = 앞말 + 옷:
  - 앞말: `Same character, same face, same skin. Keep the hair exactly: long straight very dark brown hair (not black), blunt bangs. Soft 3D toy-like texture, flat even colors, no logos or text. Hands stay bare skin. Outfit: `
  - spring: `light pastel-green cardigan over a cream t-shirt with long sleeves down to the wrists, light beige long pants, white sneakers.`
  - autumn: `mustard-yellow long-sleeve knit sweater, dark brown long pants, brown shoes.`
  - winter: `thick cream long-sleeve knit sweater, a red knit scarf around the neck, dark grey padded long pants, brown boots.`
  - pajama: `pale blue striped long-sleeve pajama top and pajama pants, soft grey slippers.`
  - rain: `bright yellow hooded raincoat with long sleeves (hood down), dark grey long pants, yellow rain boots.`
받기: `{ task_id, task_type: "retexture", format: "glb", save_to: "ROOT/assets/v2/char/_src/hero2/retex_<이름>_<task_id>.glb" }`
**G5 (char · 0)** — UV 가 그대로인가(정점·UV 수 비교) · 머리색이 D3·D24 그대로인가(바뀌었으면 0 크레딧 자로 되돌림) · 얼굴이 그대로인가. ★ spring 하나를 먼저 돌려 G5 를 지난 뒤 나머지 넷.

## 합
| | 크레딧 |
|---|---|
| ① 새 주인공(그림 9 · 3D 30 · 리그 5 · 클립 18) | 62 |
| ② 일 클립 4 · 잠깐 몸짓 3 | 21 |
| ③ 옷 5벌 | 50 |
| **합** | **133** |
| 다시 뽑기 여유(그림 2번 18 · 3D 1번 30) | +48 → **181** |

## 장부 (task_id — 받는 대로 적는다)
| 단계 | task_id | 받은 파일 | 관문 |
|---|---|---|---|
| 1-1 그림 | `01a11e70-223b-705a-b82f-1a80de034747` | `_src/hero2/img_01a11e70-….png` | ⛔ G1 다시 — 긴 생머리·앞머리·짙은 갈색 ✓ · 팔 41.7°/40.7° ✓ · 크림 티 ✓ · ⛔ 옆머리 덩어리가 어깨를 덮고 소매 위까지 내려와 위팔에 닿음(틈 0px · `docs/handoff/img/hero/hero2_g1_hair_arm_mask.png` 빨강=머리·초록=팔) ⇒ 이대로 뜨면 리그가 머리를 팔에 다시 묶는다 |
| 1-1b 그림 | `01a11e73-12c1-76ea-8147-bd52ba3bef33` | `_src/hero2/img_01a11e73-….png` | 어깨는 비었다 ✓ · ⛔ 뒷머리가 팔 뒤로 «손 높이까지» 내려온다(걷기 때 손·아래팔에 묶이거나 파고들 새 위험 · fixBackHair 상자 밖) · 머리 거의 검정 [40,27,25] · 머리:키 ≈0.35(덜 치비 · 1-1 ≈0.40) · 앞머리가 가는 두 가닥이라 초상화와 멀다 |
| ★ G1 결정 | **1-1(`01a11e70`)로 1-2** | | 까닭: 1-1 의 «어깨에 얹힌 머리»는 지금 hero 에서 이미 크레딧 0 도구(팔 회전 옮기기 · fixBackHair · 몸짓 무게)로 푼 문제이고, A포즈라 팔이 움직이는 폭이 T포즈의 약 1/3(41°→18° vs 90°→18°). 1-1b 는 그 문제 대신 새 위험(손 높이 뒷머리)과 정본에서 먼 것(검정 · 비율 · 앞머리) 셋을 얻었다. 세 번째 그림은 안 뽑는다 |
| 1-2 3D | `01a11e76-9f8e-7016-9e28-5d3c10b8d1a5` | `_src/hero2/img3d_01a11e76-….glb` (+ `_base_color.png`) | ✔ G2 통과 — 한 덩어리 100% · 정점 27,599 · 면 30,226 · A포즈 · 긴 생머리·일자 앞머리·크림 티 · 앞옆뒤 `docs/handoff/img/hero/hero2_g2_4views.png` · ⚠ 머리 텍셀 [61,37,46] 자줏빛 ⇒ 리그 뒤 D3·D24 자로 맞춤(0) · 머리-팔 묶임은 리그 뒤 G3 에서 «팔 무게 받는 머리 정점 수»로 지금 hero(11,343)와 같은 자로 견준다 |
| 1-3 리그 ★ | **`01a11e7a-322a-748f-9f2e-b72090b5f5b3`** | `_src/hero2/rig_01a11e7a-….glb` · 걷기·뛰기 `_src/hero2/clips/walking.glb` · `running.glb`(몸 벗김) | ✔ G3 통과 — 24뼈 이름·계층 지금 hero 와 같음(check_skeleton_match O) · 걷기 팔 벌림 **11.0°**(지금 hero 제 걷기 82° · 팔 옮긴 walk_arm 12.6°) ⇒ 팔 옮기기 필요 없음 · 머리 정점 중 팔 무게 >0.5 **0.4%(66)** vs 지금 hero **55.8%(7,882)** (>0.01 은 54.6% vs 77.0% — 위팔에 살짝 닿을 뿐) |
| 1-4 클립 6 | idle `01a11e88-5a75-7530-96d6-9c728cebc514` · sit `…-5c47-7749-ad26-97b098fbcde4` · sleep `…-5e18-773d-aaf6-17a138fa78da` · crouch `…-5fc1-737d-be9c-fab8ea744480` · cheer `…-614b-767c-b2ed-1e7eef80e163` · wave `…-62e4-7593-a1af-26fa17e1e000` | `_src/hero2/anim_<이름>_01a11e88-….glb` · 몸 벗김 `_src/hero2/clips/<이름>.glb` | ✔ G4 — 팔 벌림 idle 15.7° · crouch 24.2° · walk 11.0°(팔 옮기기 필요 없음) · cheer 는 9.03초 «응원»이라 팔이 가장 높은 3.4~6.4초만 씀 |
| ② 클립 7 | water `01a11e88-646e-70c7-b8e6-076b1e7adfa4`(open_door_1) · harvest `…-6614-7346-805a-e75c206fd70f` · harvest_low `…-67ba-7231-a689-4612f4ad1989` · pickup `…-6954-7594-b01c-8f0a66730a44` · scratch `…-6b0e-7422-8a3d-0f7a2e26d420` · nod `…-6cd4-72ca-9aa1-f416998d7cf0` · listen `…-6e73-75b6-ba40-bca657b3932a` | 같은 꼴 | ✔ G4 — water 가 «문 열기»로 온 것은 맞다: 옛 게임도 물주기에 문 열기(285)의 0.30~1.80초(팔을 앞으로 뻗는 마디)를 썼다(room_view ACT_SPEC.water) ⇒ 다시 안 돌림 |
| ③ 옷 5 | | | G5 |

---

# ★ 주문표 ④ — 새 손짓 넷 (2026-10-09 · 총괄 «살아 보이게 · 많아야 15»)

새 손짓: 핑크프린세스 가위로 자르기 · 알로카시아 흙 속 구근 찾기·심기 · 가구 놓기 · 화분대 위 그루 살피기.
⇒ 이미 있는 hero2 클립(같은 Meshy 동작 · 옛 라이브러리 번호)에 대 보고 «정말 없는 것»만 새로.

| 손짓 | 클립 | 크레딧 | 까닭 |
|---|---|---|---|
| 가위로 자르기 | **재사용** harvest(278 서서 따기) 0.30~2.10초 · 무릎 0.45m 밑은 harvest_low 0.30~2.40 | 0 | 손을 잎 높이로 뻗어 집는 몸 — 자르는 손과 같다 |
| 구근 찾기 | **재사용** harvest_low(277 쭈그려 따기) — 높은 화분이면 harvest | 0 | 낮은 데 손을 넣어 집는다 |
| 구근 심기 | **재사용** crouch(274) — 심기(sow)와 같은 손 높이 표 | 0 | 이미 심기가 이 길 |
| 가구 놓기 | **재사용** crouch(274) — 바닥까지 굽히기 | 0 | 원본(9.57초)을 재 보니 0~2.5초 «굽혀 바닥에 손» · 5~7초 «옆 허리 높이에 놓기». 가구는 바닥이라 앞 구간 |
| 살피기 | ★ **새로** «굽혀 살펴보기» 281 (옛 라이브러리 «식물 상태 관찰») | **3** | 맞는 클립이 없다 — 서서 화분 쪽으로 몸을 숙여 보는 몸 |

**합 3.** (옛 라이브러리 번호는 manifest 의 18개뿐이라 그 밖은 번호를 지어내지 않는다)

```json
{ "tool": "meshy_animate", "args": { "rig_task_id": "01a11e7a-322a-748f-9f2e-b72090b5f5b3", "action_id": 281 },
  "save": { "tool": "meshy_download_model", "task_type": "animation", "format": "glb",
            "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/v2/char/_src/hero2/anim_inspect_<task_id>.glb" } }
```
받은 뒤(char · 0): 몸 벗기기(clips/inspect.glb) → hero2 에 «inspect» 로 붙이기 → «가장 숙인 3초»를 extras.emoteWin.inspect 로 → 다이어트(쓰는 구간만 · 관문) → 그려 보기.

게임 쪽(v2_hero · 이미 열어 둠): `actClip('cut'|'dig')` → 거두기 클립 · `'inspect'` → inspect(받기 전엔 듣기 구간) · 심기·놓기는 쭈그리기. 거는 자리(어떤 손짓에 어떤 이름)는 core.
