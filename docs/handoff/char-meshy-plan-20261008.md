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
| 1-1 그림 | | | G1 |
| 1-2 3D | | | G2 |
| 1-3 리그 ★ | | | G3 |
| 1-4 클립 6 | | | G4 |
| ② 클립 7 | | | G4 |
| ③ 옷 5 | | | G5 |
