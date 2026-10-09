# 사건 원화 다시 칠하기 · 원룸·엔딩 장면 — 계획 (char · 2026-10-08)

총괄 판 ③④ · 결정 D3(주인공 정본 = 초상화 · `assets/characters/LOOK.md`).
⛔ **10-08 02시 Higgsfield 연결이 끊겨 있다**(`MCP server "claude.ai Higgsfield" is not connected`) — 생성은 하나도 안 했다.
다시 잇는 일은 박사님이 claude.ai 커넥터 설정에서 해야 한다(Kling 도 같은 처지).

## 지금 있는 것 — 왜 다시 칠하나
`assets/illust/ev_*`(2400×1792) 는 도감(`docs/dogam/data_items.json`)만 쓴다. 게임 코드는 안 부른다.
- 몬이: 화분 없는 «초록 공룡»으로 그려졌다 — 정본(테라코타 화분에 든 새싹 · 몬스테라 잎)과 다르다
- 주인공: 수채 갈색 머리 · 청바지 — 정본(긴 생머리 · 일자 앞머리 · 아주 짙은 갈색 · 크림 티)과 다르다

## 그릴 것과 파일 이름
기존 이름 꼴(`ev_<사건>_<판>.png`)을 따른다. 새 판은 끝에 `_v2` 를 붙여 옛 판을 덮지 않는다.

| 사건 | 파일 | 장면 |
|---|---|---|
| 몬스테라 도착 | `ev_monstera_arrive_v2.png` | 어두운 반지하 · 가방 속 줄기 하나뿐인 화분을 들여다보는 주인공 · 곁의 몬이 |
| 첫 무늬 | `ev_first_varie_v2.png` | 창턱의 몬스테라 · 흰 무늬 섞인 새 잎 · 놀란 주인공 · 기뻐하는 몬이 |
| 반지하 떠나기 | `ev_moveout_v2.png` | 상자 몇 개 · 몬스테라 화분을 안고 계단을 오르는 주인공 · 몬이 |
| ★ 원룸 도착 | `ev_oneroom_arrive.png` | 높은 창으로 빛이 드는 빈 원룸 · 상자 · 화분을 내려놓는 주인공 |
| ★ 원룸 첫날 | `ev_oneroom_firstday.png` | «바깥이 그대로 들어와»(plan D1 문안) — 창밖 계절빛 · 창가 몬스테라 · 몬이 |
| ★ 내 집 마련(엔딩) | `ev_home_ending.png` | 내 집 문 앞/창가 · 잘 자란 몬스테라와 삽수 화분들 · 주인공과 몬이 |

엔딩 화면은 아직 없다(`src/game/ending.js` 는 규칙 뼈대뿐 · 그림 이름 칸 없음) ⇒ 위 이름을 core 에 알리고 붙일 때 그대로 쓴다.

## 주문 — 붙여 쓸 것
참조 그림: `assets/characters/portraits/portrait_jachwi_neutral.png` · `portrait_moni_neutral.png`(기쁜 장면은 `_cheer`). 둘을 올려 «같은 인물» 참조로 건다.
프롬프트 = 장면 한 줄 + LOOK.md 의 자취녀 블록 + 몬이 블록 + **몸 절(아래 그대로)**:
```
CRITICAL: the character MUST still be sitting inside the SAME terracotta flower pot,
and its arms MUST still be the big monstera leaves with splits and holes.
Do not remove the pot. Do not remove the leaves. Do not give it a shell.
```
(LOOK.md 실측: 이 절을 빼면 세 번 중 세 번 화분·잎이 사라졌고, 넣으면 두 번 다 지켰다)

## 고르는 자 — 사건마다 3~5장 뽑아 하나
1. 머리: 긴 생머리 · 일자 앞머리 · 아주 짙은 갈색(검정 아님) — 단발·묶음·곱슬이면 탈락
2. 옷: 크림·아이보리 반팔 티 — 흰 티면 탈락
3. 몬이: 테라코타 화분 안 · 몬스테라 잎 · 사람의 38% 크기 — 화분·잎 하나라도 없으면 탈락
4. 화풍: 2D 납작 만화체 — 3D·클레이면 탈락
5. 장면 사실: 반지하는 창이 높고 어둡다 · 원룸은 밝다 · 몬스테라는 그 사건의 잎 수에 맞다
6. 손가락·글자 깨짐 없음
고른 까닭은 장마다 한 줄씩 이 파일 아래에 적는다.

## 못 한 것
- 생성 0장(연결 끊김). 크레딧 미사용

---

## ★ 갈래마다 참인가 (2026-10-08 13시 · 박사님 «게임하는 사람이 이리 튈지 저리 튈지 모르니» · 총괄 청)

### 가르는 값 — 새로 만들지 않는다. 이미 있는 것만 읽는다
| 값 | 뜻 | 임자 |
|---|---|---|
| `story.branchAtMove` | 이사 순간 들고 온 것: `keep`(모주 화분이 있다) · `cuttings`(모주 없음 · 무늬 삽수 있음) · `sold`(둘 다 없음 · 시루·씨앗뿐) | plan-oneroom-quests-v2 §3 · core 가 이사 순간 한 번 적는다 |
| 처음 본 무늬 등급 | `varieSeen` 이 뜬 그 잎의 등급(산반 · 하프문 · 드물게 풀문) | core(사건 때 넘김) |
| 엔딩 때 몬스테라 수 | ★ «계약 단추를 누른 순간» 가진 몬스테라(그루+삽수 그루)가 하나라도 있나 — branchAtMove 가 아니다(plan 답) | core |

### 원칙 — «모든 갈래에서 참인 것만 그린다». 갈래가 장면의 뜻일 때만 판을 나눈다
- 장소가 갈래마다 다를 수 있으면 **배경을 빼고 가까이**(사람·몬이·그 물건) 그린다
- 계절·시각이 플레이마다 다르면(이사 날은 88~158일 · 원룸부터 계절이 흐른다 D1) **계절 물건(눈·단풍·벚꽃)과 밤낮 단서를 안 그린다**
- 방 가구는 사람이 사고 옮긴다 ⇒ 가구 배치를 그리지 않는다(창 높이처럼 방의 «뼈»만)

### 여섯 장 → 갈래별 판
| 그림 | 언제 뜨나 | 갈래에 따라 거짓이 되는 것 | 판 | 고르는 값 |
|---|---|---|---|---|
| 몬스테라 도착 | Day 12 · 반지하 · 모든 판 | 없음 — 갈래가 나뉘기 전이다 | `ev_monstera_arrive_v2` 1장 (잎 하나 · 줄기 하나 — 엔딩 대사 「저 방에서 잎 하나였던 애가」와 맞춘다) | — |
| 첫 무늬 | `varieSeen` — 대개 반지하 · `keep` 로 무늬 전에 이사하면 드물게 원룸 · 창턱일 수도 등 아래일 수도 | ① 잎 무늬 꼴(산반 «뿌린 점» vs 하프문 «반쪽 흰») — 다른 등급을 그리면 배운 사람이 틀린다 ② 방·빛(창턱/등) | **가까이 · 배경 없음** 2장: `ev_first_varie_sanban` · `ev_first_varie_halfmoon` (풀문은 드물어 하프문 판을 같이 쓰거나 나중) | 처음 본 무늬 등급 |
| 반지하 떠나기 | 이사 단추 | ★ 손에 든 것 — `keep` 큰 화분 · `cuttings` 작은 삽수 화분 몇 · `sold` 몬스테라 없음 | **3장**: `ev_moveout_keep` · `_cuttings` · `_sold` — 셋 다 박스 넷(대사 「박스 네 개」) · 시루 · 몬이. `sold` 는 몬이가 박스 위 | `branchAtMove` |
| 원룸 도착 | `moved_in_oneroom` | 내려놓는 것(위와 같음) · 창밖 계절 | **1장 · 모든 갈래에서 참**: 박스·몬이·«눈높이 창»(대사 「창이 눈높이에 있네」) — 식물은 박스 속/틀 밖. 창밖은 계절 물건 없이 하늘빛만 | — |
| 원룸 첫날 | 이사 다음 날 | 창가 식물 · 계절 | **1장 · 모든 갈래에서 참**: 창으로 드는 «바깥 빛»과 사람·몬이(대사 「바깥이 그대로 들어와」) — 식물·계절 물건 없음 | — |
| 내 집 마련 | 엔딩 단추 | ★ 몬스테라가 있나 — `sold` 판은 무늬 원천이 없어 원룸 ② 에서 막힌다(D22) · 현금만으로 엔딩에 닿으면 몬스테라 없이 올 수 있다 | **2장**: `ev_home_ending` (볕 드는 새 방 · 자란 몬스테라와 삽수 화분들 · 사람·몬이) · `ev_home_ending_noplant` (같은 방 · 몬스테라 없이 시루·작은 화분) | 엔딩 때 몬스테라 수 |

⇒ 6장 → **10장**(1 + 2 + 3 + 1 + 1 + 2). 갈래마다 다 나누면 14장이다 — 도착·첫날은 «참인 것만»으로 한 장씩 줄였다.

### ⚠ 그림 밖 — 같은 갈래에서 «대사»가 거짓이 되는 줄 (plan 몫 · char 는 찾기만 했다)
| 대사 | 어디 | 거짓이 되는 갈래 |
|---|---|---|
| 몬이 「화분은 내가 안고 갈까?」 | `movedOut` | `sold` — 안을 몬스테라 화분이 없다 |
| 자취 「박스 네 개. 여기서 산 게 백 일이 넘는데.」 | `movedOut` | 100일 전에 이사한 판(첫 플레이 끝 88일 안팎 — forks ①) |
| 자취 「…자르는 건 해 봤어.」 | `movedInOneroom` | `sold` 로 한 번도 안 자르고 그루째 판 판 |
| 자취 「저 방에서 잎 하나였던 애가…」 · 몬이 「잘라서 늘렸지. 한 그루가 둘이 되고.」 | 엔딩 문안(plan-ending-home ②-C 5·6) | `sold`(그 그루를 팔았다) · 엔딩 때 몬스테라 0 |
- 그림을 `branchAtMove` 로 고르면 같은 값으로 대사도 고를 수 있다 — 값 하나로 그림·대사를 같이 맞춘다.

### 정해진 것 (plan 답 · 10-08 13시대)
- 대사 넷은 plan 이 «어느 갈래에서나 참»인 말로 고쳤다 — 대사는 branchAtMove 를 안 읽는다
  (「짐은 내가 들고 갈까?」 · 「여기서 산 날이 꽤 되는데.」 · 「…그럼 자르는 데부터네.」 · 엔딩 「저 방에서 잎 하나로 시작했는데…」/「빛을 모은 거야. 잎 하나씩.」)
- 엔딩 2장 유지 — «일찍 그루째 판» 판은 사실상 엔딩에 안 오지만, «엔딩 때 몬스테라 0»은 다른 길로 온다
  (엔딩 직전 다 팔기 · 모주를 크게 키워 통째로 팔아 목표에 닿기 — 잎 6장 그루 최고 1,197만 · M4)
- 이사·도착 컷 장면은 «이삿날 낮»빛 — 이사·도착 대사엔 시각 말이 없다(「불 끄고 가자」는 낮밤 다 참)
- plan 이 갈래 지도(plan-branch-map)에 «그림·대사가 갈래를 타는 자리» 칸으로 넣는다

---

## ★ 주문표 — Meshy 그림(nano-banana-pro · 9) · 총괄이 그대로 돌린다 (2026-10-09)

Higgsfield 끊김 · Kling 크레딧 0 ⇒ Meshy `meshy_image_to_image`. 참조 셋: **① 초상화(얼굴·머리 정본 D3)** · **② 몬이 초상화(화분+잎 몸)** · **③ 방 키프레임(2D 그림책 결)**. hero2(3D 치비) 그림은 결이 섞여 뺐다 — 옷은 글로.
- 열 장 × 9 = **90** (다시 뽑기 여유 별도). ★ **ev_home_ending 한 장을 먼저** 돌려 결(2D·정본·몬이 몸)을 G 로 본 뒤 나머지 아홉
- 한글 경로는 총괄이 ASCII 로 옮긴다(주문 안 `ROOT` 는 `C:/Users/pc/Desktop/빛식물/lux-plant-sim/`)
- 검수(char · 0 · 장마다): ①머리 긴 생머리·일자 앞머리·아주 짙은 갈색(검정 아님) ②크림 티 ③몬이 테라코타 화분 안·몬스테라 잎 둘(하나라도 없으면 다시) ④2D(3D·클레이면 다시) ⑤장면 사실(갈래별 손에 든 것 · 계절 물건 없음 · 첫 무늬 무늬 꼴) ⑥손가락·글자 깨짐 없음 ⑦사람 둘이 초상화와 같은 사람으로 보이나
- ★ **엔딩 자리**: `game.html #homeArt` 가 `assets/illust/ev_home_ending.png` 를 이미 부른다 — 계약 직후 전체 화면 장면에 쓰이고, 그 뒤 대사 → 마무리 카드 → **D28 «여기까지 — 첫 이야기» 덮개**(그 덮개 안에는 안 쓰인다). 몬스테라 0 판(`_noplant`)은 core 가 고르게 청한다

```json
[
 {
  "name": "ev_home_ending",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_cheer.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Her own sunny home: warm sunlight through a big window. A tall healthy monstera and small cutting pots by the window. She smiles, eyes wet with joy; Moni cheers. She (image 1): young Korean woman, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, warm-brown eyes, pink blush, cream round-neck tee, grey joggers. Moni (image 2): tiny light-green sprout mascot sitting INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Style of image 3: 2D storybook illustration, clean ink lines, soft warm wash, NOT 3D."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_home_ending.png"
  },
  "used_in": "★ 게임에 이미 걸린 자리: game.html #homeArt — 계약 직후 전체 화면 장면(그 뒤 대사 → 마무리 카드 → D28 «여기까지 — 첫 이야기» 덮개). D28 덮개 «안»에는 안 쓰인다",
  "pick_by": "계약 단추 누른 순간 몬스테라 ≥1"
 },
 {
  "name": "ev_home_ending_noplant",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_cheer.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Her own sunny home: warm sunlight through a big window, empty bright floor. She smiles, eyes wet with joy; Moni cheers beside her. She (image 1): young Korean woman, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, warm-brown eyes, pink blush, cream round-neck tee, grey joggers. Moni (image 2): tiny light-green sprout mascot sitting INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Style of image 3: 2D storybook illustration, clean ink lines, soft warm wash, NOT 3D."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_home_ending_noplant.png"
  },
  "used_in": "같은 자리 · 몬스테라 0 판 — core 가 파일 이름을 고르게 청(지금은 ev_home_ending 하나만 부름)",
  "pick_by": "계약 단추 누른 순간 몬스테라 0"
 },
 {
  "name": "ev_oneroom_arrive",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Daytime, empty small studio room, window at eye level showing plain sky (no snow, no leaves). She sets down a cardboard box and looks at the window; Moni on a box. No plants. She (image 1): young Korean woman, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, warm-brown eyes, pink blush, cream round-neck tee, grey joggers. Moni (image 2): tiny light-green sprout mascot sitting INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Style of image 3: 2D storybook illustration, clean ink lines, soft warm wash, NOT 3D."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_oneroom_arrive.png"
  },
  "used_in": "원룸 도착(moved_in_oneroom) — 아직 안 걸림(core)",
  "pick_by": "모든 갈래 한 장"
 },
 {
  "name": "ev_oneroom_firstday",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Morning in a small studio. Soft outside light pours through an eye-level window onto the floor. She stands at the window, calm; Moni beside her. Plain sky, no plants. She (image 1): young Korean woman, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, warm-brown eyes, pink blush, cream round-neck tee, grey joggers. Moni (image 2): tiny light-green sprout mascot sitting INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Style of image 3: 2D storybook illustration, clean ink lines, soft warm wash, NOT 3D."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_oneroom_firstday.png"
  },
  "used_in": "원룸 첫날 «바깥이 그대로 들어와» — 아직 안 걸림(core)",
  "pick_by": "모든 갈래 한 장"
 },
 {
  "name": "ev_moveout_keep",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Daytime. She climbs narrow half-basement stairs hugging a big monstera in a pot; four cardboard boxes at the door; Moni rides on the top box. She (image 1): young Korean woman, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, warm-brown eyes, pink blush, cream round-neck tee, grey joggers. Moni (image 2): tiny light-green sprout mascot sitting INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Style of image 3: 2D storybook illustration, clean ink lines, soft warm wash, NOT 3D."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_moveout_keep.png"
  },
  "used_in": "반지하 떠나기(moved_out) — 아직 안 걸림 · 도감",
  "pick_by": "branchAtMove = keep"
 },
 {
  "name": "ev_moveout_cuttings",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Daytime. She climbs narrow half-basement stairs holding a tray of small cutting pots; four cardboard boxes at the door; Moni rides on the top box. She (image 1): young Korean woman, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, warm-brown eyes, pink blush, cream round-neck tee, grey joggers. Moni (image 2): tiny light-green sprout mascot sitting INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Style of image 3: 2D storybook illustration, clean ink lines, soft warm wash, NOT 3D."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_moveout_cuttings.png"
  },
  "used_in": "같은 자리",
  "pick_by": "branchAtMove = cuttings"
 },
 {
  "name": "ev_moveout_sold",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Daytime. She climbs narrow half-basement stairs carrying a small bean-sprout jar, no other plants; four cardboard boxes; Moni rides on the top box. She (image 1): young Korean woman, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, warm-brown eyes, pink blush, cream round-neck tee, grey joggers. Moni (image 2): tiny light-green sprout mascot sitting INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Style of image 3: 2D storybook illustration, clean ink lines, soft warm wash, NOT 3D."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_moveout_sold.png"
  },
  "used_in": "같은 자리",
  "pick_by": "branchAtMove = sold"
 },
 {
  "name": "ev_first_varie_sanban",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_cheer.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Close-up, no background: a young monstera leaf speckled with tiny white dots. She looks surprised then proud; Moni cheers with leaves up. She (image 1): young Korean woman, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, warm-brown eyes, pink blush, cream round-neck tee, grey joggers. Moni (image 2): tiny light-green sprout mascot sitting INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Style of image 3: 2D storybook illustration, clean ink lines, soft warm wash, NOT 3D."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_first_varie_sanban.png"
  },
  "used_in": "첫 무늬(varieSeen) — 아직 안 걸림 · 도감 ev_first_varie",
  "pick_by": "처음 본 무늬 = 산반"
 },
 {
  "name": "ev_first_varie_halfmoon",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_cheer.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Close-up, no background: a monstera leaf exactly half white, half green. She gasps, delighted; Moni cheers with leaves up. She (image 1): young Korean woman, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, warm-brown eyes, pink blush, cream round-neck tee, grey joggers. Moni (image 2): tiny light-green sprout mascot sitting INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Style of image 3: 2D storybook illustration, clean ink lines, soft warm wash, NOT 3D."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_first_varie_halfmoon.png"
  },
  "used_in": "같은 자리",
  "pick_by": "처음 본 무늬 = 하프문(풀문도 이 판)"
 },
 {
  "name": "ev_monstera_arrive_v2",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Dim half-basement room with a high small window. She kneels by an open backpack, surprised: inside is a small pot with ONE monstera stem and one leaf. Moni beside her, smiling. She (image 1): young Korean woman, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, warm-brown eyes, pink blush, cream round-neck tee, grey joggers. Moni (image 2): tiny light-green sprout mascot sitting INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Style of image 3: 2D storybook illustration, clean ink lines, soft warm wash, NOT 3D."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_monstera_arrive_v2.png"
  },
  "used_in": "몬스테라 도착(Day 12) — 아직 안 걸림 · 도감 ev_monstera_arrive",
  "pick_by": "모든 갈래 한 장"
 }
]
```

### G — 첫 장(ev_home_ending · task 01a1201f-fc9f-7378-9a26-1d8b00be7773) 판정
- ✔ 2D 그림책 결 · 긴 생머리·일자 앞머리 · 크림 티·회색 바지 · 기쁨의 눈물 · 몬이 화분 안·잎 둘 · 창가 몬스테라·삽수 화분 · 손·글자 깨짐 없음
- ⚠ 머리 밝기 35(정본 초상화 60) — «검정» 쪽 ⇒ 크레딧 0 으로 머리 덩어리만 밝기 ×1.63(`tools/char/illust_hair_lift.py` · 색조 그대로 · 가장자리 흐림) ⇒ [48,30,29] → [78,49,47]
  · 원본은 `assets/illust/ev_home_ending_meshy1.png` 로 두고, 고친 것을 게임이 부르는 `ev_home_ending.png` 로 · 전후 `docs/handoff/img/hero/ev_home_ending_hair_lift.png`
- 나머지 아홉: 머리 문구를 «dark chocolate-brown hair (clearly brown, NOT black)» 로 세게(위 JSON 에 반영 · 10곳) — 나와도 어두우면 같은 도구로 맞춘다

### G — 나머지 아홉 판정 (총괄 10-09 · 9×9)
| 그림 | 판정 | 까닭 |
|---|---|---|
| ev_home_ending_noplant | ✔ | 몬스테라 없이 볕 드는 빈 방 · 기쁨의 눈물 · 머리 밝기 56 |
| ev_oneroom_arrive | ✔ | 빈 방 · 눈높이 창 · 하늘만 · 박스·몬이 · 머리 55 |
| ev_moveout_cuttings | ✔ | 삽수 화분 판 · 박스 · 몬이(살짝 잘린 단면 결이나 한 판만 보이는 장면이라 둠) |
| ev_moveout_sold | ✔ | 몬스테라 없이 박스·시루 · 몬이 |
| ev_first_varie_halfmoon | ✔ | 반쪽 흰 잎 · 몬이 화분 안 · 머리 59 |
| ev_first_varie_sanban | ⛔ 다시 | 점무늬가 «잎»이 아니라 «몬이 몸»에 찍혔다 — 장면의 뜻이 틀림 |
| ev_oneroom_firstday | ⛔ 다시 | 선반에 작은 화분 + 가구가 다 들어찬 방(가구는 사람이 사고 놓는 것 — 그리지 않기로 한 원칙) |
| ev_moveout_keep | ⛔ 다시 | 방 키프레임을 따라 아이소 디오라마·짙은 회색 바탕 — 다른 장과 결이 다름 |
| ev_monstera_arrive_v2 | ⛔ 다시 | 가방 속 화분 잎이 둘 + 회색 테두리 — 엔딩 대사 «잎 하나로 시작했는데»와 맞추려면 잎 하나 |

다시 넷(9×4 = 36) — 글 고침: 키프레임은 «선과 물빛만», 아이소 단면 아님·테두리 없음을 못 박음 · 장면별 고침. 받기 `_r2`(덮지 않음):
```json
[
 {
  "name": "ev_first_varie_sanban",
  "why_retake": "잎이 아니라 몬이 몸에 점이 찍혔다(장면의 뜻이 틀림)",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_cheer.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Close-up: she holds a potted monstera whose new leaf is speckled with many tiny WHITE dots; the dots are on the plant leaf only. Moni stays plain light green, cheering. She (image 1): LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, brown eyes, blush, cream tee, grey joggers. Moni (image 2): tiny light-green sprout INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Line and warm wash of image 3, NOT its isometric cutaway: full-frame eye-level scene, no border."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_first_varie_sanban_r2.png"
  }
 },
 {
  "name": "ev_oneroom_firstday",
  "why_retake": "선반에 화분 하나 + 가구가 다 들어찬 방(가구는 사람이 사고 놓는 것)",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Morning in a small, almost empty studio: only two closed cardboard boxes, no furniture, no plants. Soft outside light pours through an eye-level window. She stands at the window; Moni beside her. She (image 1): LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, brown eyes, blush, cream tee, grey joggers. Moni (image 2): tiny light-green sprout INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Line and warm wash of image 3, NOT its isometric cutaway: full-frame eye-level scene, no border."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_oneroom_firstday_r2.png"
  }
 },
 {
  "name": "ev_moveout_keep",
  "why_retake": "방 키프레임을 따라 아이소 디오라마·회색 바탕 — 결이 다름",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Daytime. She climbs narrow half-basement stairs hugging a big monstera in a pot; four cardboard boxes at the door; Moni rides on the top box. She (image 1): LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, brown eyes, blush, cream tee, grey joggers. Moni (image 2): tiny light-green sprout INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Line and warm wash of image 3, NOT its isometric cutaway: full-frame eye-level scene, no border."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_moveout_keep_r2.png"
  }
 },
 {
  "name": "ev_monstera_arrive_v2",
  "why_retake": "잎이 둘 + 회색 테두리 — 엔딩 «잎 하나로 시작했는데»와 맞춤",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Dim half-basement room, high small window. She kneels by an open backpack, surprised: inside is a small pot with ONE single monstera stem bearing exactly ONE leaf. Moni beside her, smiling. She (image 1): LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, brown eyes, blush, cream tee, grey joggers. Moni (image 2): tiny light-green sprout INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Line and warm wash of image 3, NOT its isometric cutaway: full-frame eye-level scene, no border."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_monstera_arrive_v2_r2.png"
  }
 }
]
```

### G — 다시 넷(r2) 판정
| 그림 | 판정 | 까닭 |
|---|---|---|
| ev_oneroom_firstday_r2 | ✔ → `ev_oneroom_firstday.png` | 거의 빈 방 · 박스 둘 · 창빛 · 몬이 화분+잎 |
| ev_moveout_keep_r2 | ✔ → `ev_moveout_keep.png` | 눈높이 계단 · 큰 몬스테라 · 박스 · 몬이 |
| ev_first_varie_sanban_r2 | ⛔ r3 | 점은 잎에만 ✓ · 그런데 몬이가 몬스테라 화분 흙에 작은 얼굴로만 — 제 화분·잎 둘이 없다(LOOK «몸» 절) |
| ev_monstera_arrive_v2_r2 | ⛔ r3 | 잎 하나 ✓ · 그런데 선반·벽에 다른 화분 여럿 — 반지하엔 시루와 이 몬스테라뿐(침대·책상은 반지하 기본 가구라 괜찮다) |

r3 둘(9×2 = 18):
```json
[
 {
  "name": "ev_first_varie_sanban",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_cheer.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Close-up: she holds a potted monstera; its new leaf is speckled with tiny WHITE dots (only that leaf). Moni sits in its OWN separate pot beside her, plain light green, with its own two leaves, cheering. She (image 1): LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, brown eyes, blush, cream tee, grey joggers. Moni (image 2): tiny light-green sprout INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Line and warm wash of image 3, NOT its isometric cutaway: full-frame eye-level scene, no border."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_first_varie_sanban_r3.png"
  }
 },
 {
  "name": "ev_monstera_arrive_v2",
  "tool": "meshy_image_to_image",
  "args": {
   "ai_model": "nano-banana-pro",
   "reference_file_paths": [
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_jachwi_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/characters/portraits/portrait_moni_neutral.png",
    "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/gen/v2_room/style_keyframe_a.png"
   ],
   "generate_multi_view": false,
   "prompt": "Dim half-basement room, high small window, a bed and a desk; NO other plants anywhere. She kneels by an open backpack, surprised: inside is a small pot with ONE monstera stem and exactly ONE leaf. Moni beside her. She (image 1): LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, brown eyes, blush, cream tee, grey joggers. Moni (image 2): tiny light-green sprout INSIDE a terracotta pot with two holed monstera leaves; keep pot and leaves. Line and warm wash of image 3, NOT its isometric cutaway: full-frame eye-level scene, no border."
  },
  "save": {
   "tool": "meshy_download_model",
   "task_type": "image-to-image",
   "save_to": "C:/Users/pc/Desktop/빛식물/lux-plant-sim/assets/illust/ev_monstera_arrive_v2_r3.png"
  }
 }
]
```

### G — r3 둘 판정 · 끝 (더 안 뽑는다)
| 그림 | 고른 판 | 까닭 |
|---|---|---|
| ev_first_varie_sanban | **r3** | 몬이 제 화분·잎 둘 ✓ · 점은 잎에만 ✓. 뒤 선반 작은 화분은 반지하 채소 화분일 수 있어 거짓이 아니다. 머리 밝기 56(통과한 장들 55~61과 같은 자리 — 노란 방 배경 대비로 짙어 보일 뿐)이라 손대지 않음 |
| ev_monstera_arrive_v2 | **r2** | r3 은 «잎 둘» + 몬이가 가방 주머니 속 작은 새싹 — 이 장면의 핵심 둘(잎 하나 · 몬이)이 다 틀렸다. r2 는 핵심 둘이 맞고 흠은 배경 선반 화분들(Day 12 엔 시루뿐 — 곁가지)뿐 |
- 더 뽑지 않는 까닭: 뽑을 때마다 다른 데가 틀어졌다(r2 산반 몬이 몸 빠짐 → r3 고침 · r2 도착 맞음 → r3 틀어짐). 핵심이 맞은 판을 고른다.
- ⇒ **열 장 다 섰다**: ev_home_ending · _noplant · ev_oneroom_arrive · ev_oneroom_firstday · ev_moveout_keep/_cuttings/_sold · ev_first_varie_sanban/_halfmoon · ev_monstera_arrive_v2. Meshy 그림 9×(10+4+2) = **144** 크레딧.
