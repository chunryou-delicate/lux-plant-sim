# Higgsfield 주문표 — 오늘 생긴 순간들 (char · 2026-10-09)

총괄 청: 박사님 «힉스필드 많이 써라» · «필요한 만큼». ⛔ 크레딧 쓰는 호출은 총괄이 돌린다. 제 세션은 Higgsfield 가 아직 «not connected»라 모델 조회를 못 했다 — 참조 role 은 총괄이 `models_explore get` 으로 채운다.

## 고른 것
- 도구 `generate_image` · 모델 `gpt_image_2_5`(Higgsfield 기본 «참조 편집» 모델) — 참조로 같은 사람을 지키는 길. 더 나은 참조 모델이 조회되면 그것으로(같은 글)
- 참조(총괄이 media_upload → media_id 로 바꿔 끼움): `REF_JACHWI` = assets/characters/portraits/portrait_jachwi_neutral.png · `REF_MONI` = assets/characters/portraits/portrait_moni_neutral.png · `REF_MONI_CHEER` = assets/characters/portraits/portrait_moni_cheer.png · `REF_STYLE` = assets/illust/ev_home_ending.png · `REF_BANJIHA` = assets/illust/ev_moveout_sold.png · `REF_ONEROOM` = assets/illust/ev_oneroom_firstday.png
- ★ 결 참조는 방 키프레임이 아니라 **이미 통과한 우리 그림 `ev_home_ending.png`** — 키프레임은 아이소 단면·회색 바탕 결을 끌고 왔었다(Meshy 판 떠나기 r1)
- count 2(한 글에 두 장 — 고르는 자로 나은 것) · 장면 1:1(core #sceneArt 정사각) · 초상 3:4 흰 바탕 → fit_portrait
- 차례: ★ **ev_neighbor_order 한 장 먼저** → char 가 결·사람 판정(0) → 나머지

## 검수(char · 0 · 장마다)
- ① 머리 긴 생머리·일자 앞머리·짙은 갈색(검정 아님 — 어두우면 tools/char/illust_hair_lift.py 로 0 크레딧)
- ② 크림 티·회색 바지(겨울 초상은 스웨터·목도리)
- ③ 몬이 테라코타 화분 안·몬스테라 잎 둘(하나라도 없으면 다시)
- ④ 2D(3D·클레이 X) · 장면은 눈높이 꽉 찬 화면(아이소 단면·테두리 X)
- ⑤ 장면 사실(반찬가게 바구니 · 핑크프린세스 분홍 잎 · 구근 · 이정표 넷 같은 구도)
- ⑥ 손가락·글자 깨짐 · 읽히는 글자 없음
- ⑦ 초상: 기존 초상과 같은 결·같은 크기 · 흰 바탕(fit_portrait 가 투명 600×800 · 바닥 621 로)

## 쓰일 자리 — 요약
| 그림 | 게임의 자리 | 누가 거나 |
|---|---|---|
| `ev_neighbor_order` | 반찬가게 주문 D35 — 대사 neighborOrder(사건 neighbor_order) | core(#sceneArt · 사건 대사) |
| `ev_furniture_shop` | 가구점 첫날 D47 — furnitureShopOpen(등 장면 뒤 한 줄) | plan(줄 art 칸) · core |
| `ev_pp_trade_offer` | 핑크프린세스 교환 «바꿀래?» — ppTradeOffer · 두 번째 물음 ppTradeOfferAgain 도 같은 그림 | core(#sceneArt · 사건 대사) |
| `ev_pp_trade_done` | 교환함 — ppTradeDone | core(#sceneArt · 사건 대사) |
| `ev_al_corm` | 흙 속 구근 발견 — alAsleepCorms(사건 al_asleep · corms>0) | core(#sceneArt · 사건 대사) |
| `ev_al_sprout_varie` | 구근에서 무늬 싹 — alSproutVarie | core(#sceneArt · 사건 대사) |
| `ev_home_mark_quarter` | 집 자금 이정표 D51 — statusHomeQuarter «첫 고개는 넘었어» · 넷이 한 벌(같은 구도) | plan(줄 art 칸) · core |
| `ev_home_mark_half` | 집 자금 이정표 D51 — statusHomeHalf «온 길이 남은 길보다 길어졌어» · 넷이 한 벌(같은 구도) | plan(줄 art 칸) · core |
| `ev_home_mark_threequarter` | 집 자금 이정표 D51 — statusHomeThreeQuarter «마지막 고개만 남았어» · 넷이 한 벌(같은 구도) | plan(줄 art 칸) · core |
| `ev_home_mark_near` | 집 자금 이정표 D51 — statusHomeNear «…집이 보이는 것 같다» · 넷이 한 벌(같은 구도) | plan(줄 art 칸) · core |
| `ev_oneroom_full` | «키워서 늘리기의 보람» — endingReady(집 자금이 다 모인 날) 권함 · 또는 원룸 «한 해» 줄 | plan(줄 art 칸) · core |
| `ev_first_story_end` | D28 덮개 «여기까지 — 첫 이야기» 뒤 그림 — 엔딩 대사·마무리 카드 다음 | core(D28 덮개) |
| `portrait_jachwi_scissors` | 가위 들고 고민 — questPpHoldPink·ppPinkWarn 의 자취 줄 · 키 'scissors' | plan(얼굴 키 배정) · core(FACE_FILE) |
| `portrait_jachwi_bulb` | 구근 보고 놀람 — alAsleepCorms 첫 줄 · 키 'bulb' | plan(얼굴 키 배정) · core(FACE_FILE) |
| `portrait_jachwi_beam` | 뿌듯함(활짝 — 지금 proud 는 잔잔한 미소) — 이정표·교환함·구근 싹 · 키 'beam' | plan(얼굴 키 배정) · core(FACE_FILE) |
| `portrait_jachwi_winter` | 겨울잠 걱정 — statusAlSleeping·겨울 줄 · 키 'winter' | plan(얼굴 키 배정) · core(FACE_FILE) |
| `portrait_moni_bulb` | 몬이 구근 — alAsleepCorms «구근 하나가 새 그루가 돼» · 키 'bulb' | plan(얼굴 키 배정) · core(FACE_FILE) |
| `portrait_moni_shh` | 겨울잠 «자는 중이야» — statusAlSleeping · 키 'shh' | plan(얼굴 키 배정) · core(FACE_FILE) |
| `portrait_moni_scissors` | 가위 조심 — questPpHoldPink·ppPinkWarn 의 몬이 줄 · 키 'scissors' | plan(얼굴 키 배정) · core(FACE_FILE) |

장면 12 · 초상 7 · 글마다 2장 ⇒ 38장

## 주문 JSON (장마다 그대로)
```json
[
 {
  "name": "ev_neighbor_order",
  "kind": "scene",
  "save_as": "assets/illust/ev_neighbor_order.png",
  "used_in": "반찬가게 주문 D35 — 대사 neighborOrder(사건 neighbor_order)",
  "who": "core(#sceneArt · 사건 대사)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "At the half-basement door at the foot of narrow stairs, a kind middle-aged side-dish shop owner in an apron happily carries off a basket of bean sprouts and radish sprouts; she bows, surprised and happy; Moni cheers. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border. Setting like image 4.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_MONI_CHEER",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_STYLE",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_BANJIHA",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "ev_furniture_shop",
  "kind": "scene",
  "save_as": "assets/illust/ev_furniture_shop.png",
  "used_in": "가구점 첫날 D47 — furnitureShopOpen(등 장면 뒤 한 줄)",
  "who": "plan(줄 art 칸) · core",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "A small cozy neighborhood furniture shop with wooden shelves and plant stands on display; she looks around, curious and hopeful; Moni points at a plant stand. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_MONI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_STYLE",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "ev_pp_trade_offer",
  "kind": "scene",
  "save_as": "assets/illust/ev_pp_trade_offer.png",
  "used_in": "핑크프린세스 교환 «바꿀래?» — ppTradeOffer · 두 번째 물음 ppTradeOfferAgain 도 같은 그림",
  "who": "core(#sceneArt · 사건 대사)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "In a stairwell, a plant-swap note pinned on a board (no readable text) beside a small pot of Pink Princess philodendron, dark leaves splashed with bubblegum pink; she holds her own small potted variegated monstera cutting, thinking; Moni looks up asking. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border. Setting like image 4.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_MONI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_STYLE",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_BANJIHA",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "ev_pp_trade_done",
  "kind": "scene",
  "save_as": "assets/illust/ev_pp_trade_done.png",
  "used_in": "교환함 — ppTradeDone",
  "who": "core(#sceneArt · 사건 대사)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "She happily holds a small pot of Pink Princess philodendron, its dark leaves splashed with bubblegum pink; Moni cheers beside her. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_MONI_CHEER",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_STYLE",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "ev_al_corm",
  "kind": "scene",
  "save_as": "assets/illust/ev_al_corm.png",
  "used_in": "흙 속 구근 발견 — alAsleepCorms(사건 al_asleep · corms>0)",
  "who": "core(#sceneArt · 사건 대사)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "Close-up: in a pot whose Alocasia leaves have all withered, her fingers lift a small round brown corm (bulb) out of the soil; she is surprised; Moni beside her, teaching gesture. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_MONI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_STYLE",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "ev_al_sprout_varie",
  "kind": "scene",
  "save_as": "assets/illust/ev_al_sprout_varie.png",
  "used_in": "구근에서 무늬 싹 — alSproutVarie",
  "who": "core(#sceneArt · 사건 대사)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "Close-up: a tiny new Alocasia sprout from a corm, its arrow-shaped leaf splashed with cream variegation; she gasps happily; Moni cheers. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_MONI_CHEER",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_STYLE",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "ev_home_mark_quarter",
  "kind": "scene",
  "save_as": "assets/illust/ev_home_mark_quarter.png",
  "used_in": "집 자금 이정표 D51 — statusHomeQuarter «첫 고개는 넘었어» · 넷이 한 벌(같은 구도)",
  "who": "plan(줄 art 칸) · core",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "Storybook vista, same composition every time: a winding path over four gentle hills toward a small house with a sunny window on the farthest hill. She walks the path carrying Moni in her arms. She has just crossed the first hill; the house is still far and tiny. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_MONI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_STYLE",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "ev_home_mark_half",
  "kind": "scene",
  "save_as": "assets/illust/ev_home_mark_half.png",
  "used_in": "집 자금 이정표 D51 — statusHomeHalf «온 길이 남은 길보다 길어졌어» · 넷이 한 벌(같은 구도)",
  "who": "plan(줄 art 칸) · core",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "Storybook vista, same composition every time: a winding path over four gentle hills toward a small house with a sunny window on the farthest hill. She walks the path carrying Moni in her arms. She stands on top of the second hill, exactly halfway; the house looks closer. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_MONI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_STYLE",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "ev_home_mark_threequarter",
  "kind": "scene",
  "save_as": "assets/illust/ev_home_mark_threequarter.png",
  "used_in": "집 자금 이정표 D51 — statusHomeThreeQuarter «마지막 고개만 남았어» · 넷이 한 벌(같은 구도)",
  "who": "plan(줄 art 칸) · core",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "Storybook vista, same composition every time: a winding path over four gentle hills toward a small house with a sunny window on the farthest hill. She walks the path carrying Moni in her arms. She climbs the last hill; the house is near, its window glowing. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_MONI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_STYLE",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "ev_home_mark_near",
  "kind": "scene",
  "save_as": "assets/illust/ev_home_mark_near.png",
  "used_in": "집 자금 이정표 D51 — statusHomeNear «…집이 보이는 것 같다» · 넷이 한 벌(같은 구도)",
  "who": "plan(줄 art 칸) · core",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "Storybook vista, same composition every time: a winding path over four gentle hills toward a small house with a sunny window on the farthest hill. She walks the path carrying Moni in her arms. She stops right before the house gate, the sunny window bright ahead. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_MONI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_STYLE",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "ev_oneroom_full",
  "kind": "scene",
  "save_as": "assets/illust/ev_oneroom_full.png",
  "used_in": "«키워서 늘리기의 보람» — endingReady(집 자금이 다 모인 날) 권함 · 또는 원룸 «한 해» 줄",
  "who": "plan(줄 art 칸) · core",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "Her studio room in bright sun: every shelf and plant stand is full of thriving monstera and cutting pots she grew; she stands back admiring, proud; Moni cheers. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border. Setting like image 4.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_MONI_CHEER",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_STYLE",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_ONEROOM",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "ev_first_story_end",
  "kind": "scene",
  "save_as": "assets/illust/ev_first_story_end.png",
  "used_in": "D28 덮개 «여기까지 — 첫 이야기» 뒤 그림 — 엔딩 대사·마무리 카드 다음",
  "who": "core(D28 덮개)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "Evening in her new sunny home, quiet: she sits by the window beside the tall monstera with Moni, watching a soft sunset, peaceful, a chapter closing. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_MONI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    },
    {
     "value": "REF_STYLE",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "portrait_jachwi_scissors",
  "kind": "portrait",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_scissors.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_scissors.png",
  "used_in": "가위 들고 고민 — questPpHoldPink·ppPinkWarn 의 자취 줄 · 키 'scissors'",
  "who": "plan(얼굴 키 배정) · core(FACE_FILE)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "count": 2,
   "prompt": "She holds small garden scissors near her chin, pondering, eyes to the side. Same character and same art style as image 1 (flat 2D anime portrait, clean thin lines, soft flat shading): bust portrait, same framing and size as image 1, plain pure white background, no text.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "portrait_jachwi_bulb",
  "kind": "portrait",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_bulb.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_bulb.png",
  "used_in": "구근 보고 놀람 — alAsleepCorms 첫 줄 · 키 'bulb'",
  "who": "plan(얼굴 키 배정) · core(FACE_FILE)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "count": 2,
   "prompt": "Surprised, eyes wide, holding a small round brown bulb (corm) up in her palm. Same character and same art style as image 1 (flat 2D anime portrait, clean thin lines, soft flat shading): bust portrait, same framing and size as image 1, plain pure white background, no text.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "portrait_jachwi_beam",
  "kind": "portrait",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_beam.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_beam.png",
  "used_in": "뿌듯함(활짝 — 지금 proud 는 잔잔한 미소) — 이정표·교환함·구근 싹 · 키 'beam'",
  "who": "plan(얼굴 키 배정) · core(FACE_FILE)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "count": 2,
   "prompt": "Beaming with pride, both hands clasped at her chest, eyes slightly wet. Same character and same art style as image 1 (flat 2D anime portrait, clean thin lines, soft flat shading): bust portrait, same framing and size as image 1, plain pure white background, no text.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "portrait_jachwi_winter",
  "kind": "portrait",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_winter.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_winter.png",
  "used_in": "겨울잠 걱정 — statusAlSleeping·겨울 줄 · 키 'winter'",
  "who": "plan(얼굴 키 배정) · core(FACE_FILE)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "count": 2,
   "prompt": "Worried, wearing a cream knit sweater and a red scarf, looking down gently. Same character and same art style as image 1 (flat 2D anime portrait, clean thin lines, soft flat shading): bust portrait, same framing and size as image 1, plain pure white background, no text.",
   "medias": [
    {
     "value": "REF_JACHWI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "portrait_moni_bulb",
  "kind": "portrait",
  "save_as": "assets/characters/portraits/_hf/portrait_moni_bulb.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_moni_bulb.png",
  "used_in": "몬이 구근 — alAsleepCorms «구근 하나가 새 그루가 돼» · 키 'bulb'",
  "who": "plan(얼굴 키 배정) · core(FACE_FILE)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "count": 2,
   "prompt": "Moni proudly holds up a small round brown bulb with its leaves, teaching. Same character and same art style as image 1: Moni, tiny chubby light-green sprout sitting INSIDE the SAME terracotta pot with the SAME two holed monstera leaves (never remove pot or leaves), bust framing like image 1, plain pure white background, no text.",
   "medias": [
    {
     "value": "REF_MONI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "portrait_moni_shh",
  "kind": "portrait",
  "save_as": "assets/characters/portraits/_hf/portrait_moni_shh.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_moni_shh.png",
  "used_in": "겨울잠 «자는 중이야» — statusAlSleeping · 키 'shh'",
  "who": "plan(얼굴 키 배정) · core(FACE_FILE)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "count": 2,
   "prompt": "Moni puts a leaf tip to its mouth: shh, someone is sleeping. Same character and same art style as image 1: Moni, tiny chubby light-green sprout sitting INSIDE the SAME terracotta pot with the SAME two holed monstera leaves (never remove pot or leaves), bust framing like image 1, plain pure white background, no text.",
   "medias": [
    {
     "value": "REF_MONI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "portrait_moni_scissors",
  "kind": "portrait",
  "save_as": "assets/characters/portraits/_hf/portrait_moni_scissors.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_moni_scissors.png",
  "used_in": "가위 조심 — questPpHoldPink·ppPinkWarn 의 몬이 줄 · 키 'scissors'",
  "who": "plan(얼굴 키 배정) · core(FACE_FILE)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "count": 2,
   "prompt": "Moni holds tiny garden scissors carefully with its leaves, cautioning. Same character and same art style as image 1: Moni, tiny chubby light-green sprout sitting INSIDE the SAME terracotta pot with the SAME two holed monstera leaves (never remove pot or leaves), bust framing like image 1, plain pure white background, no text.",
   "medias": [
    {
     "value": "REF_MONI",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 }
]
```
