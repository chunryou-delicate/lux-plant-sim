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


---

## G — 첫 장 ev_neighbor_order (총괄 3d535306 · gpt_image_2_5 max · 2048²)
- ✔ 둘 다 통과(머리 갈색 · 몬이 화분+잎 둘 · 반지하 계단 · 바구니) ⇒ **A** — 구도가 깔끔하고 꽃무늬 앞치마 사장님이 또렷하다(다음 «첫 손님» 얼굴로 씀)
- 게임 이름 `assets/illust/ev_neighbor_order.png`(1024) · 사장님 상반신을 `assets/characters/ref/npc_banchan_owner_ref.png` 로 잘라 둠
- 총괄이 고친 한 줄(주인공 = image 1 · 다른 어른은 다른 사람) — 아래 둘에도 넣었다

## ② 식물 가게 (plan 01574f9c · 손님 표 c13b4f0e · D59)
- 손님 초상 여섯 결(손님 표 group 그대로: shop · student · elder · couple · plant · office) — ★ shop = 첫 손님 반찬가게 사장님 얼굴(참조 `REF_BANCHAN_OWNER`)
- 주인공 앞치마 초상(2D) · 장면 둘(가게 연 날 · 간판 단 날)
- 주인공 앞치마 «옷»(3D)은 hero2 옷 길 그대로 — Meshy `meshy_retexture`(input_task_id 01a11e76 · enable_original_uv · 10) 글: «… Outfit: plain sage-green work apron over a cream round-neck t-shirt, grey joggers, grey-white shoes.» → `apply_outfit_tex.py` → `outfit/apron.jpg` · v2_hero 옷 이름 'apron' 은 char 가 연다 · 가게에 있을 때 입히기는 core
- 참조 더: `REF_PORTRAIT_STYLE` = assets/characters/portraits/portrait_jachwi_neutral.png (결만 — 다른 사람) · `REF_BANCHAN_OWNER` = assets/characters/ref/npc_banchan_owner_ref.png (ev_neighbor_order A 의 사장님) · `REF_HERO2_TOY` = assets/v2/char/_src/hero2/img_01a11e70-223b-705a-b82f-1a80de034747.png (hero2 의 3D 장난감 기준 그림) · `REF_MONI_3D` = docs/handoff/img/hero/… 대신 assets/characters/3d/lq/char_mascot_sprout.glb 를 그린 그림 — 없으면 REF_MONI 하나로

## ③ 유니티 몫 (박사님 «나중에 유니티로 만들 것도 생각해서»)
- 턴어라운드: ★ **두 결** — (가) 지금 게임 hero2 와 같은 «3D 장난감 치비» 결(참조 hero2 기준 그림) ⇒ multi-image-to-3D 로 갈 것 · (나) 정본 초상 결 전신(2D · 원화·UI 기준)
  - 시트 한 장에 앞·옆·뒤·3/4 를 같이 그리게 한다(한 그림 안에서 같은 사람이 지켜진다) → char 가 칸별로 잘라 multi-image-to-3D 입력(앞·옆·뒤)으로
  - Higgsfield 의 «character-sheet» 길이 있으면(`get_workflow_instructions {workflow:"character-sheet"}`) 그것을 먼저 쓰고 같은 글을 넣는다
  - ★ A포즈 · 머리와 팔 사이 틈 — hero2 에서 잰 교훈(T포즈면 클립이 팔을 들고 긴 머리가 팔에 묶였다 · A포즈로 머리 정점 팔 무게 55.8%→0.4%)
- 표정 시트: 주인공 12 · 몬이 12(지금 대사 얼굴 키와 같은 차례) — 유니티 블렌드셰이프·스프라이트 기준
- 3D 로 가기(총괄 · Higgsfield 안 Meshy): 시트 (가) → 앞·옆·뒤 → multi-image-to-3D(a-pose · 3만 면 · 2k) → rig(height 1.4) → 동작은 hero2 와 같은 번호(idle 0 · sit 32 · sleep 267 · repot 274 · cheer 49 · wave 28 · 285 · 278 · 277 · 281 · 36 · 25 · 47) → 받으면 char 가 G2~G4 와 같은 자로 잰다(뼈 · 팔 벌림 · 머리 팔 무게 · 다이어트)

## 주문 JSON — ② 식물 가게 · ③ 유니티
```json
{
 "shop": [
  {
   "name": "portrait_npc_shop",
   "kind": "portrait",
   "save_as": "assets/characters/portraits/_hf/portrait_npc_shop.png",
   "used_in": "식물 가게 주문판 손님 초상 — shop · 동네 가게 사람 — ★ 첫 손님 반찬가게 사장님(banchan_owner) 얼굴 · 2층 카페·빵집·미용실…도 이 그림 · 주문 줄 대사의 얼굴(plan 이 손님 group → 초상 키 · core 가 띄움)",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "count": 2,
    "prompt": "The SAME woman as image 2: middle-aged shop owner, short curly brown perm, round cheerful face, floral beige apron over a mauve sweater, warm laughing smile. Use image 1 only for the art style - this is a DIFFERENT person, not the heroine. Flat 2D anime bust portrait in exactly the art style of image 1 (clean thin lines, soft flat shading), same framing and size as image 1, plain pure white background, no text.",
    "medias": [
     {
      "value": "REF_PORTRAIT_STYLE",
      "role": "<models_explore get 의 참조 role>"
     },
     {
      "value": "REF_BANCHAN_OWNER",
      "role": "<models_explore get 의 참조 role>"
     }
    ]
   },
   "then": "python tools/char/fit_portrait.py <고른.png> assets/characters/portraits/portrait_npc_shop.png"
  },
  {
   "name": "portrait_npc_student",
   "kind": "portrait",
   "save_as": "assets/characters/portraits/_hf/portrait_npc_student.png",
   "used_in": "식물 가게 주문판 손님 초상 — student · 학생·자취생 · 주문 줄 대사의 얼굴(plan 이 손님 group → 초상 키 · core 가 띄움)",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "count": 2,
    "prompt": "A university student, short black hair, round glasses, grey hoodie and backpack strap, shy smile. Use image 1 only for the art style - this is a DIFFERENT person, not the heroine. Flat 2D anime bust portrait in exactly the art style of image 1 (clean thin lines, soft flat shading), same framing and size as image 1, plain pure white background, no text.",
    "medias": [
     {
      "value": "REF_PORTRAIT_STYLE",
      "role": "<models_explore get 의 참조 role>"
     }
    ]
   },
   "then": "python tools/char/fit_portrait.py <고른.png> assets/characters/portraits/portrait_npc_student.png"
  },
  {
   "name": "portrait_npc_elder",
   "kind": "portrait",
   "save_as": "assets/characters/portraits/_hf/portrait_npc_elder.png",
   "used_in": "식물 가게 주문판 손님 초상 — elder · 어르신 — 예전 윗집 할머니도 이 그림 · 주문 줄 대사의 얼굴(plan 이 손님 group → 초상 키 · core 가 띄움)",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "count": 2,
    "prompt": "A kind elderly grandmother, grey hair in a low bun, beige knit cardigan, gentle smile, small reading glasses on a chain. Use image 1 only for the art style - this is a DIFFERENT person, not the heroine. Flat 2D anime bust portrait in exactly the art style of image 1 (clean thin lines, soft flat shading), same framing and size as image 1, plain pure white background, no text.",
    "medias": [
     {
      "value": "REF_PORTRAIT_STYLE",
      "role": "<models_explore get 의 참조 role>"
     }
    ]
   },
   "then": "python tools/char/fit_portrait.py <고른.png> assets/characters/portraits/portrait_npc_elder.png"
  },
  {
   "name": "portrait_npc_couple",
   "kind": "portrait",
   "save_as": "assets/characters/portraits/_hf/portrait_npc_couple.png",
   "used_in": "식물 가게 주문판 손님 초상 — couple · 부부·가족 — 첫 집을 산 부부도 이 그림 · 주문 줄 대사의 얼굴(plan 이 손님 group → 초상 키 · core 가 띄움)",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "count": 2,
    "prompt": "A young married couple side by side, both bust in frame, warm smiles, casual knitwear, leaning slightly together. Use image 1 only for the art style - this is a DIFFERENT person, not the heroine. Flat 2D anime bust portrait in exactly the art style of image 1 (clean thin lines, soft flat shading), same framing and size as image 1, plain pure white background, no text.",
    "medias": [
     {
      "value": "REF_PORTRAIT_STYLE",
      "role": "<models_explore get 의 참조 role>"
     }
    ]
   },
   "then": "python tools/char/fit_portrait.py <고른.png> assets/characters/portraits/portrait_npc_couple.png"
  },
  {
   "name": "portrait_npc_plant",
   "kind": "portrait",
   "save_as": "assets/characters/portraits/_hf/portrait_npc_plant.png",
   "used_in": "식물 가게 주문판 손님 초상 — plant · 식물 좋아하는 사람(화원 견습생 등) · 주문 줄 대사의 얼굴(plan 이 손님 group → 초상 키 · core 가 띄움)",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "count": 2,
    "prompt": "A plant-loving young florist apprentice, tied-back auburn hair, green canvas apron, holding a tiny potted plant, bright eyes. Use image 1 only for the art style - this is a DIFFERENT person, not the heroine. Flat 2D anime bust portrait in exactly the art style of image 1 (clean thin lines, soft flat shading), same framing and size as image 1, plain pure white background, no text.",
    "medias": [
     {
      "value": "REF_PORTRAIT_STYLE",
      "role": "<models_explore get 의 참조 role>"
     }
    ]
   },
   "then": "python tools/char/fit_portrait.py <고른.png> assets/characters/portraits/portrait_npc_plant.png"
  },
  {
   "name": "portrait_npc_office",
   "kind": "portrait",
   "save_as": "assets/characters/portraits/_hf/portrait_npc_office.png",
   "used_in": "식물 가게 주문판 손님 초상 — office · 회사·일터 · 주문 줄 대사의 얼굴(plan 이 손님 group → 초상 키 · core 가 띄움)",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "count": 2,
    "prompt": "A tired but kind office worker in a light blue shirt with a lanyard ID badge, neat short hair, soft smile. Use image 1 only for the art style - this is a DIFFERENT person, not the heroine. Flat 2D anime bust portrait in exactly the art style of image 1 (clean thin lines, soft flat shading), same framing and size as image 1, plain pure white background, no text.",
    "medias": [
     {
      "value": "REF_PORTRAIT_STYLE",
      "role": "<models_explore get 의 참조 role>"
     }
    ]
   },
   "then": "python tools/char/fit_portrait.py <고른.png> assets/characters/portraits/portrait_npc_office.png"
  },
  {
   "name": "portrait_jachwi_apron",
   "kind": "portrait",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_apron.png",
   "used_in": "가게 줄 대사의 주인공 얼굴(앞치마) — 키 'apron'(plan 배정 · core FACE_FILE)",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "count": 2,
    "prompt": "Same heroine as image 1, same face and hair, now wearing a plain sage-green work apron over her cream tee, calm confident smile. Flat 2D anime bust portrait in exactly the art style of image 1 (clean thin lines, soft flat shading), same framing and size as image 1, plain pure white background, no text.",
    "medias": [
     {
      "value": "REF_JACHWI",
      "role": "<models_explore get 의 참조 role>"
     }
    ]
   },
   "then": "python tools/char/fit_portrait.py <고른.png> assets/characters/portraits/portrait_jachwi_apron.png"
  },
  {
   "name": "ev_shop_open",
   "kind": "scene",
   "save_as": "assets/illust/_hf/ev_shop_open.png",
   "used_in": "가게 연 날 — 사건 shop_open(주문판 소개 대사 위 · #sceneArt)",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "1:1",
    "count": 2,
    "prompt": "Opening day of her small home plant shop in a two-room apartment: shelves of potted monstera, pink princess and alocasia, a small cork order board with paper slips (no readable text); she wears a sage-green apron and smiles at the door; Moni cheers on a shelf. The woman in image 1 is the heroine; anyone else is a DIFFERENT person (do not copy her face). Heroine (image 1): LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs. Moni (image 2): tiny light-green sprout INSIDE a terracotta pot with two holed monstera leaves - never remove pot or leaves. 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no readable text, no border.",
    "medias": [
     {
      "value": "REF_JACHWI",
      "role": "<models_explore get 의 참조 role>"
     },
     {
      "value": "REF_MONI_CHEER",
      "role": "<models_explore get 의 참조 role>"
     },
     {
      "value": "REF_STYLE",
      "role": "<models_explore get 의 참조 role>"
     }
    ]
   }
  },
  {
   "name": "ev_shop_sign",
   "kind": "scene",
   "save_as": "assets/illust/_hf/ev_shop_sign.png",
   "used_in": "간판 단 날 — 단골 10명 이정표(§3 · 몬이 «간판을 달자!» 위)",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "1:1",
    "count": 2,
    "prompt": "Daytime outside her apartment window/door: a small wooden shop sign with a leaf drawing (no readable text) has just been hung; she in a sage-green apron and Moni look up at it proudly; two friendly neighbors wave. The woman in image 1 is the heroine; anyone else is a DIFFERENT person (do not copy her face). Heroine (image 1): LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs. Moni (image 2): tiny light-green sprout INSIDE a terracotta pot with two holed monstera leaves - never remove pot or leaves. 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no readable text, no border.",
    "medias": [
     {
      "value": "REF_JACHWI",
      "role": "<models_explore get 의 참조 role>"
     },
     {
      "value": "REF_MONI_CHEER",
      "role": "<models_explore get 의 참조 role>"
     },
     {
      "value": "REF_STYLE",
      "role": "<models_explore get 의 참조 role>"
     }
    ]
   }
  }
 ],
 "unity": [
  {
   "name": "sheet_hero_turnaround_toy",
   "kind": "sheet",
   "save_as": "assets/characters/sheets/_hf/sheet_hero_turnaround_toy.png",
   "used_in": "유니티 주인공 3D(지금 게임 hero2 와 같은 몸 결) — 시트를 앞·옆·뒤·3/4 로 잘라 multi-image-to-3D",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "16:9",
    "count": 2,
    "prompt": "Character turnaround sheet on a plain pure white background: FRONT, LEFT SIDE, BACK and 3/4 views of the SAME character side by side, full body, same scale, A-pose (arms straight down 40 degrees from the body, palms in), even flat lighting, no shadows, no text. The heroine as a chibi 3D toy figure exactly like image 2 (same head-to-body ratio, soft toy shading), with face and hair from image 1: LONG straight dark chocolate-brown hair (clearly brown, NOT black) falling down the back, blunt bangs, front locks inside the shoulder line with a clear gap from the arms; cream round-neck tee, grey joggers, grey-white shoes.",
    "medias": [
     {
      "value": "REF_JACHWI",
      "role": "<models_explore get 의 참조 role>"
     },
     {
      "value": "REF_HERO2_TOY",
      "role": "<models_explore get 의 참조 role>"
     }
    ]
   }
  },
  {
   "name": "sheet_hero_turnaround_anime",
   "kind": "sheet",
   "save_as": "assets/characters/sheets/_hf/sheet_hero_turnaround_anime.png",
   "used_in": "유니티 2D/일러 기준(정본 D3 결 전신) — 3D 가 아니라 원화·UI 쪽 기준",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "16:9",
    "count": 2,
    "prompt": "Character turnaround sheet on a plain pure white background: FRONT, LEFT SIDE, BACK and 3/4 views of the SAME character side by side, full body, same scale, A-pose (arms straight down 40 degrees from the body, palms in), even flat lighting, no shadows, no text. The heroine in the flat 2D anime style of image 1, full body (head about 1/6 of height), same face and hair as image 1, cream tee, grey joggers.",
    "medias": [
     {
      "value": "REF_JACHWI",
      "role": "<models_explore get 의 참조 role>"
     }
    ]
   }
  },
  {
   "name": "sheet_moni_turnaround",
   "kind": "sheet",
   "save_as": "assets/characters/sheets/_hf/sheet_moni_turnaround.png",
   "used_in": "유니티 몬이 3D — 시트를 잘라 multi-image-to-3D(리깅은 잎 둘·몸 정도 · 사람 리그 아님)",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "16:9",
    "count": 2,
    "prompt": "Character turnaround sheet on a plain pure white background: FRONT, LEFT SIDE, BACK and 3/4 views of the SAME character side by side, full body, same scale, A-pose (arms straight down 40 degrees from the body, palms in), even flat lighting, no shadows, no text. Moni from image 1: tiny chubby light-green sprout sitting INSIDE the SAME terracotta pot with the SAME two holed monstera leaves (never remove pot or leaves), soft 3D toy look like image 2.",
    "medias": [
     {
      "value": "REF_MONI",
      "role": "<models_explore get 의 참조 role>"
     },
     {
      "value": "REF_MONI_3D",
      "role": "<models_explore get 의 참조 role>"
     }
    ]
   }
  },
  {
   "name": "sheet_hero_expressions",
   "kind": "sheet",
   "save_as": "assets/characters/sheets/_hf/sheet_hero_expressions.png",
   "used_in": "유니티 표정(블렌드셰이프·스프라이트 기준) · 지금 대사 얼굴 키 열과 같은 차례",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "4:3",
    "count": 2,
    "prompt": "Expression sheet of the SAME heroine as image 1, flat 2D anime style of image 1: a 3x4 grid of bust heads with the same framing, plain white background, no text labels. Expressions: neutral, happy, beaming proud, calm proud smile, surprised, curious, thinking, worried, crying, tired, numb (frozen), determined.",
    "medias": [
     {
      "value": "REF_JACHWI",
      "role": "<models_explore get 의 참조 role>"
     }
    ]
   }
  },
  {
   "name": "sheet_moni_expressions",
   "kind": "sheet",
   "save_as": "assets/characters/sheets/_hf/sheet_moni_expressions.png",
   "used_in": "유니티 몬이 표정 · 지금 몬이 얼굴 키 열과 같은 차례",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "4:3",
    "count": 2,
    "prompt": "Expression sheet of Moni from image 1 (light-green sprout INSIDE a terracotta pot with two holed monstera leaves - keep pot and leaves in every cell), flat 2D style of image 1: a 3x4 grid, plain white background, no text labels. Expressions: neutral, cheer, calm, teaching, curious, proud, worried, sad, surprised, excited, sleepy, shh.",
    "medias": [
     {
      "value": "REF_MONI",
      "role": "<models_explore get 의 참조 role>"
     }
    ]
   }
  }
 ]
}
```
