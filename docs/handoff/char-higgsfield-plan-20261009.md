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
- 참조 더: `REF_PORTRAIT_STYLE` = assets/characters/portraits/portrait_jachwi_neutral.png (결만 — 다른 사람) · `REF_BANCHAN_OWNER` = assets/characters/ref/npc_banchan_owner_ref.png (ev_neighbor_order A 의 사장님) · `REF_HERO2_TOY` = assets/v2/char/_src/hero2/img_01a11e70-223b-705a-b82f-1a80de034747.png (hero2 의 3D 장난감 기준 그림) · `REF_MONI_3D` = assets/characters/ref/moni_3d_ref.png (게임 몬이 3D 앞모습 · 흰 바탕)

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


---

## 첫 주문 판정 (총괄 93e2fd7a · 18줄 36장 · gpt_image_2_5 · 2026-10-09 char)

검수 ①~⑦ 을 장마다 크게(2048 원본 잘라) 봤다. 머리 밝기는 11장 모두 61~73(정본 58 이상 · `illust_hair_lift` 불필요 — 글의 «clearly brown, NOT black» 이 먹었다).

### 장면 — 고른 판
| 그림 | 고름 | 버림 | 까닭 |
|---|---|---|---|
| `ev_furniture_shop` | **a** | b | a: 몬이가 3단 화분 받침 «위에» 앉아 «이거» 를 몸으로 보여 준다 · 장바구니 천가방 = 가게 나들이. b: 몬이가 스툴 쪽을 가리켜 «무엇»이 흐림(일꾼 권 b 와 다름) |
| `ev_pp_trade_offer` | **b** | a | b: 쪽지가 맞바꿈 화살표 그림(글자 없음) — «바꿀래?»가 그림으로 읽힌다 · 손에 든 삽수 무늬가 또렷. 흠: PP 화분이 게시판 받침에 걸림(어색하나 읽힘). a: 쪽지가 빈 종이 · 손 삽수 무늬 약함 |
| `ev_pp_trade_done` | **b** | a | 둘 다 통과. b: 몬이가 반짝이며 환호(REF_MONI_CHEER 결) · 손이 화분을 감싸는 모양 깔끔 |
| `ev_al_corm` | **a** | b | a: 손끝으로 흙에서 구근을 «들어 올리는» 순간(뿌리·흙 떨어짐) — 글 그대로의 가까운 판. b: 이미 들고 있음 · 모종삽 |
| `ev_al_sprout_varie` | **b** | a | b: 흙 위로 구근이 보이고 거기서 무늬 화살촉 잎 — 앞 판 ev_al_corm 과 이어진다. a 도 통과(몬이 눈 감고 웃음) |
| `ev_home_mark_quarter` | **a(임시)** | b | ⚠ 다시 뽑기 — 아래. 지금 판은 자리만 채움(core 가 이름으로 걸 수 있게) |
| `ev_home_mark_half` | **b(임시)** | a | ⚠ 다시 뽑기 — 아래. b 가 집이 a 보다 작아 quarter→¾ 사이 크기 |
| `ev_home_mark_threequarter` | **a** | b | a: 뒷모습 · 집이 가까워짐 · 창이 빛남 — 이 판이 다시 뽑는 셋의 구도 참조(REF_ROAD). b: 잎 하나뿐인 몬이(실패) |
| `ev_home_mark_near` | **a(임시)** | b | ⚠ 다시 뽑기 — 둘 다 집이 ¾ 와 같은 거리 |
| `ev_oneroom_full` | **a** | b | a: 얼굴이 보이고 선반 가득 · 몬이 환호. b: 등을 돌려 표정이 안 보임 |
| `ev_first_story_end` | **a** | b | a: 노을 창가 · 큰 몬스테라 · 몬이 — 글 그대로. b: 큰 몬스테라 없음(실패) |

게임 판: `assets/illust/<이름>.png` 1024² RGB(ev_neighbor_order 와 같은 규격 · 원본 2048 LANCZOS 축소). 원본 PNG 는 저장소 밖 `_hf_masters`.

### 초상 — 고른 판
| 그림 | 고름 | 까닭 |
|---|---|---|
| `portrait_jachwi_scissors` | **a** | 가위 쥔 손 모양 자연스러움. b 도 통과 |
| `portrait_jachwi_bulb` | **a** | a·b 거의 같음 — 손바닥 구근이 조금 더 또렷 |
| `portrait_jachwi_beam` | **b** | 눈물 맺힌 활짝 · 맞잡은 손이 a 보다 깔끔 |
| `portrait_jachwi_winter` | **b** | 글 «looking down gently» 그대로(a 는 정면) |
| `portrait_moni_bulb` | **b** | 구근을 «자랑스럽게» 치켜듦 · 반짝 표시 |
| `portrait_moni_shh` | **a** | 잎 끝을 입에. b: 구멍 난 잎이 셋(실패) |
| `portrait_moni_scissors` | **a** | 가위를 잎으로 조심히. b: 잎이 날 위에 걸침(실패) |

게임 판: `assets/characters/portraits/<이름>.png` 600×800 투명 — `fit_portrait.py --ref <정본 neutral> --tol 8 --pockets`.
- ⛔ 기본(허용 26)으로 깎았더니 크림 티가 순백 바탕에서 23~28 밖에 안 떨어져 어깨로 배경이 먹어 들어갔다(beam 소매 통째로 뚫림) ⇒ `--tol 8`(바탕 흔들림 ≤2)
- ⛔ 머리채와 팔 사이 · 잎 구멍 · 몬이 몸과 잎 사이의 «안 이어진» 흰 틈이 남았다 ⇒ `--pockets`(가운데 띠 · 위 0.40 안 = 눈 반짝임·눈물만 남김). 첫 판은 «둘레가 어두우면 눈»으로 갈라 몬이 눈이 뚫렸다 — 위치로 바꿈. 자홍 바탕에 놓고 일곱 장 다 봄
- 머리는 정본 초상과 같은 «아주 짙은 갈색»(초상 결 그대로 — 올리지 않음)

### 다시 뽑기 3줄 (6장) — 이정표 넷을 «한 벌»로
- 까닭: 이정표 넷은 같은 길의 네 순간이다. 지금 판은 quarter·half 가 **앞모습(집을 등지고 걸어 나옴)** · ¾ 는 뒷모습 · near 는 집이 ¾ 와 같은 거리. 넷이 차례로 뜨면 «방향이 뒤집히고 마지막에 안 다가간다».
- 고침: ¾ a(뒷모습 · 집으로 걸어감)를 **구도 참조 image 4 `REF_ROAD` = `assets/illust/ev_home_mark_threequarter.png`** 로 넣고, 거리만 글로 바꾼다(quarter 아주 멀리 · half 작게 · near 집 문 앞 크게).
- 받으면 같은 이름으로 갈아 끼운다(core 거는 자리는 그대로).

```json
[
 {
  "name": "ev_home_mark_quarter",
  "kind": "scene",
  "retake": true,
  "why": "a·b 둘 다 앞모습 — 집을 등지고 «집에서 걸어 나오는» 그림이 된다. ¾(a)는 뒷모습이라 넷이 한 벌로 안 읽힌다",
  "save_as": "assets/illust/ev_home_mark_quarter.png",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "SAME place, SAME camera and SAME composition as image 4: a winding dirt path over gentle green hills up to a small cream house with an orange roof and a sunny window. She is seen from BEHIND (back view), walking AWAY from the viewer TOWARD the house, carrying Moni in her arms. She has just crossed the first hill: the house is still very far, a tiny speck on the farthest hill, much smaller than in image 4; several hills lie between her and it. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border.",
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
     "value": "REF_ROAD",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "ev_home_mark_half",
  "kind": "scene",
  "retake": true,
  "why": "quarter 와 같은 까닭(앞모습 · 집을 등짐)",
  "save_as": "assets/illust/ev_home_mark_half.png",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "SAME place, SAME camera and SAME composition as image 4: a winding dirt path over gentle green hills up to a small cream house with an orange roof and a sunny window. She is seen from BEHIND (back view), walking AWAY from the viewer TOWARD the house, carrying Moni in her arms. She stands on top of the second hill, exactly halfway: the house is small but clearly visible, smaller than in image 4. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border.",
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
     "value": "REF_ROAD",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 },
 {
  "name": "ev_home_mark_near",
  "kind": "scene",
  "retake": true,
  "why": "a·b 둘 다 집이 ¾ 판과 같은 거리(언덕 위 작게) — «집 앞 문»이 안 된다(총괄 지적 그대로)",
  "save_as": "assets/illust/ev_home_mark_near.png",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "1:1",
   "count": 2,
   "prompt": "SAME place, SAME camera and SAME composition as image 4: a winding dirt path over gentle green hills up to a small cream house with an orange roof and a sunny window. She is seen from BEHIND (back view), walking AWAY from the viewer TOWARD the house, carrying Moni in her arms. She has ARRIVED: she stands right at the small wooden gate of the house's front yard; the house is CLOSE and LARGE, filling the upper half of the frame, its sunny window glowing warm and its front door just ahead, MUCH closer than in image 4. The hills she crossed lie behind and below. She is the woman in image 1: same face, LONG straight dark chocolate-brown hair (clearly brown, NOT black), blunt bangs, cream tee, grey joggers. Moni is image 2: tiny light-green sprout sitting INSIDE a terracotta pot with two holed monstera leaves - never remove the pot or the leaves. Draw in the 2D storybook style of image 3 (ink lines, soft warm wash), full-frame eye-level scene, no text, no border.",
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
     "value": "REF_ROAD",
     "role": "<models_explore get gpt_image_2_5 의 참조 role>"
    }
   ]
  }
 }
]
```

### core 거는 자리 (sceneArtOf · 대사 scriptId → 그림)
| 대사(scriptId) | 그림 | 메모 |
|---|---|---|
| neighborOrder | `ev_neighbor_order` | 사건 neighbor_order · 이미 있는 그림인데 sceneArtOf 에 아직 없음 |
| furnitureShopOpen | `ev_furniture_shop` | D47 가구점 첫 날 |
| ppTradeOffer · ppTradeOfferAgain | `ev_pp_trade_offer` | 두 번째 물음도 같은 그림 |
| ppTradeDone | `ev_pp_trade_done` |  |
| alAsleepCorms | `ev_al_corm` | al_asleep · corms>0 |
| alSproutVarie | `ev_al_sprout_varie` | alSproutPlain 은 그림 없음(안 띄움) |
| statusHomeQuarter | `ev_home_mark_quarter` | ⚠ status 한 줄(status:true) — 상태 줄이 대사 상자(#sceneArt 길)로 뜨는지 core 가 확인 · 안 뜨면 그 줄만 카드로 |
| statusHomeHalf | `ev_home_mark_half` | 같음 |
| statusHomeThreeQuarter | `ev_home_mark_threequarter` | 같음 |
| statusHomeNear | `ev_home_mark_near` | 같음 |
| endingReady | `ev_oneroom_full` | char 권함 — plan 이 줄 art 칸으로 다른 줄에 박으면 그것이 먼저(sceneArtOf 첫 줄) |
| #chapterEnd(D28 덮개 · 지금 jobCards 판) | `ev_first_story_end` | 덮개 카드 위 그림 — #homeArt 처럼 img 하나 · 없으면 숨김(onerror) |

### FACE_FILE 키 (core 표 · plan 이 줄마다 배정)
- jachwi: { scissors: 'scissors', bulb: 'bulb', beam: 'beam', winter: 'winter' } · moni: { bulb: 'bulb', shh: 'shh', scissors: 'scissors' }
- 파일 이름 = `portrait_<화자>_<키>.png`(지금 규약 그대로). 배정 전에는 «쓰는 대사가 없는 표정»으로 찍힌다 — 흠이 아니라 상태(9-07 몬이 다섯과 같음)


---

## ②③ 판정 (총괄 7941df03 · 30장 · 장부 assets/gen/hf_runs/char2_20261009.json · 2026-10-09 char)

### ① 사장님 참조 — 갈았다
- ⛔ 내가 잘라 둔 `assets/characters/ref/npc_banchan_owner_ref.png`(348×553)는 **주인공**이었다(사장님은 오른쪽 귀퉁이 팔 하나). 자르기 좌표를 반대편으로 잡은 잘못이다.
- 총괄 일꾼이 ev_neighbor_order A 에서 다시 자른 판(940×1253 · 바구니 든 사장님 상반신)으로 바꿨다. ②의 npc_shop 은 이미 이 판으로 뽑혀 있어 다시 뽑을 것 없다.

### ② 식물 가게 — 고른 판
| 그림 | 고름 | 까닭 |
|---|---|---|
| `portrait_npc_shop` | **b** | a 는 눈 감고 크게 웃는 얼굴(장면 그대로)인데, 이 한 장이 «동네 가게 사람» 여섯(손님 표 group shop)의 얼굴로 매번 뜬다 — 한순간 표정보다 눈 뜬 웃음이 오래 본다. 다른 손님 초상도 모두 눈을 떴다. 파마·자줏빛 스웨터·꽃 앞치마가 같아 D35 장면의 사장님으로 바로 읽힌다(일꾼 권 a 와 다름) |
| `portrait_npc_student` | **a** | a·b 거의 같음 |
| `portrait_npc_elder` | **a** | 안경줄·쪽찐 머리 또렷 |
| `portrait_npc_couple` | **c** | 아내 웨이브 밝은 갈색 단발 · 먼지장미 카디건 / 남편 짧은 검은 머리 · 남색 니트. 손님 표(shop_customers.json)엔 생김새가 없어 어긋나는 것 없음 — 일꾼이 정한 그대로 둔다. a·b 는 아내가 주인공 얼굴(실패) |
| `portrait_npc_plant` | **a** | 초록 앞치마 · 작은 화분 |
| `portrait_npc_office` | **b** | 글 «tired but kind» — b 가 눈가가 조금 지쳤다 |
| `portrait_jachwi_apron` | **a** | 잔잔한 미소 · 세이지 앞치마 |
| `ev_shop_open` | **a** | 문 앞에서 맞이하는 손짓 · 선반의 몬스테라·핑크프린세스·알로카시아 · 몬이 환호 |
| `ev_shop_sign` | **b** | 글 «막 단 간판을 올려다본다» 그대로(a 는 아직 거는 중) · 몬이를 안고 · 이웃 둘이 손 흔듦 |

게임 판: 초상 `assets/characters/portraits/portrait_<이름>.png` 600×800 투명(`fit_portrait --ref portrait_jachwi_neutral.png --tol 8 --pockets` · 자홍 바탕에 일곱 장 다 봄) · 장면 `assets/illust/ev_shop_open.png` · `ev_shop_sign.png` 1024(머리 66.5 · 61.8 — 올릴 것 없음).

### ③ 유니티 — 고른 판
| 시트 | 고름 | 까닭 |
|---|---|---|
| 장난감 턴어라운드 | **b** | 앞·옆·뒤 신발이 맞다(a 는 뒤에서 뒤꿈치가 트인 신). 총괄이 이미 3D 를 건 판 — 맞다 |
| 초상 결 턴어라운드 | **a** | 좁은 A포즈 · 앞머리가 팔에서 떨어짐 · 2D 원화·UI 기준 |
| 몬이 턴어라운드 | **b** | 잎이 몸에서 떨어져 섬 · 실루엣이 3D 에 가장 깨끗 |
| 표정 시트 주인공 | **a** | 12칸이 서로 또렷(얼어붙음·결심) |
| 표정 시트 몬이 | **a** | 12칸 모두 화분+잎 둘 · 슬픔(눈물)과 걱정이 갈림 |

- 몬이 b 를 칸 넷으로 잘라 둠(0 크레딧 · 몬이 3D 가 필요해지면 바로 입력): `assets/characters/sheets/_hf/crops/moni_b_{front,side,back,three_quarter}.png` — ★ 네 칸 **같은 정사각 1102 · 같은 축척 · 같은 바닥선**(칸마다 크기를 따로 잡으면 옆모습이 커 보여 multi-image 입력이 어긋난다)

### 머리 — 올리지 않는다(잰 값)
| 그림 | 머리 밝기 | R−B |
|---|---|---|
| 정본 초상 neutral · proud · happy | 59.7 · 62.7 · 56.9 | 11 · 11 · 13 |
| 새 초상 scissors(첫 주문) | 58.0 | 10 |
| 앞치마 초상 a | 60.1 | 10 |
| 표정 시트 a(첫 칸) | 60.9 | 11 |
| 초상 결 턴어라운드 a(앞) | 66.2 | 10 |
| 장난감 턴어라운드 b(앞) | 79.9 | 25 |
| 장면 ev_home_ending(올린 뒤) | 56.5 | 30 |
- 초상 결(2D 초상·표정 시트·초상 결 턴어라운드)은 **게임 안 초상 20여 장과 같은 값**이다. 앞치마 초상만 올리면 초상들 사이에서 혼자 갈색이 된다 ⇒ 그대로 둔다.
- 초상 결이 장면보다 «덜 붉은» 것(R−B 10 대 30)은 초상 결 자체의 차이다. 초상 전부를 갈색 쪽으로 옮길지는 따로 정할 일(박사님 몫) — 정하면 `illust_hair_lift` 를 초상 전부에 같은 값으로 건다(0 크레딧).

### core 거는 자리 (② 가게)
| 자리 | 그림 |
|---|---|
| 사건 shop_open(대사 shopOpen) | `ev_shop_open` |
| 퀘스트 간판 단 날(questDoneShopSign) | `ev_shop_sign` |
| 손님 얼굴(손님 표 group → 초상) | `portrait_npc_<group>` — shop · student · elder · couple · plant · office(손님 표 groups 이름 그대로) |
| 자취생 가게 얼굴(FACE_FILE 키 · plan 배정) | `portrait_jachwi_apron` → 키 'apron' 권함 |

### 이정표 다시 뽑기 받음 (총괄 a80d6841 · 장부 assets/gen/hf_runs/char_reroll_20261009.json)
- 여섯 장 모두 뒷모습 · ¾ 와 같은 길·카메라 · 몬이 화분+잎 둘. 넷이 «점 → 작게 → 가까이 → 대문 앞» 차례가 된다.
- 고름: **quarter r2a**(먼 언덕의 점 · 사람이 ¾ 처럼 왼쪽 가운데 · 오른쪽 울타리) · **half r2a**(같은 자리 · 집이 작게) · **near r2a**(대문이 열려 있고 창이 환함 · 왼쪽에 지나온 언덕이 보여 길이 이어진다)
- 같은 이름으로 갈아 끼움(`assets/illust/ev_home_mark_{quarter,half,near}.png` 1024 · 머리 69.6 · 70.6 · 67.4). plan 이 이미 줄 art 칸에 걸었다(407b0543) — 그대로 뜬다.

### 유니티 3D G2 — Meshy 판 (총괄 a80d6841 · `assets/v2/char/_src/hero_unity/hero_toy_b_meshy_mv_559fef1a.glb`)
자: `tools/char/g2_check.py <받은.glb> <hero2 리그 전 img3d_01a11e76.glb>` — hero2 가 G2 를 통과한 판과 같은 자로 나란히.
| 잰 것 | Meshy 유니티 | hero2 리그 전(01a11e76) |
|---|---|---|
| 덩어리 | 1 (100%) | 1 (100%) |
| 정점 · 면 | 31,131 · 30,917 | 27,599 · 30,226 |
| 키 · 가로/세로 | 1.899 · 0.49 | 1.903 · 0.65 |
| 손끝 가로 거리(키 비 · A포즈 벌림) | 0.245 | 0.323 |
| 머리 텍셀 색 · 밝기 | [43,22,21] · 27.9 | [61,37,46] · 45.0 |
| 뒷머리 끝 높이(키 비) | 0.31 | 0.30 |
| 머리–팔(살) 2% 안 머리 정점 · 4% 안 | 1,482 · 2,821 | 431 · 990 |
- 그림: `docs/handoff/img/hero/unity_g2_meshy_vs_hero2.png`(앞·옆·뒤·3/4 텍스처) · `unity_g2_hair_arm.png`(빨강 = 팔 2% 안 머리 · 파랑 = 팔 살)
- ✔ **통과** — 한 덩어리 · 면 수 hero2 와 같은 급 · 긴 생머리(허리) · 일자 앞머리 · 크림 티 · 회색 바지 · 신발 앞뒤가 맞음 · 얼굴 또렷
- ⚠ 팔이 몸에 더 붙었다(벌림 0.245 대 0.323). 그래서 뒷머리 끝이 아래팔 높이에서 닿는 정점이 hero2 의 3.4배다(닿는 «자리»는 hero2 와 같다 — 그림 빨강). ⇒ 리그 뒤 **G3** 에서 «팔 무게 받는 머리 정점 %»를 hero2 와 같은 자로 재고, 넘치면 `fix_hair_weights.py`(hero2 에서 55.8%→0.4% 로 고친 길 · 0 크레딧)
- ⚠ 머리가 hero2 날것보다 더 어둡다(27.9) — 리그 뒤 `recolor_hero_tex.py` 로 정본 머리 [95,78,80] 에 맞춘다(0 크레딧 · hero2 와 같은 길)
- Tripo 3만 면 판이 오면 같은 자로 한 줄 더 잰다. 견줄 것은 «팔 벌림»과 «머리–팔 2%» — Tripo 가 둘 다 확실히 낫지 않으면 Meshy 로 간다(리그·동작·다이어트 길이 hero2 에서 검증됨)


---

## 앞치마 판 낯 넷 (plan 96500c11 · 2026-10-09 char · 뽑는 때는 총괄)

- 까닭: 가게 판에서 자취생 얼굴은 앞치마 한 줄(apron) 말고는 앞치마 없는 옷으로 뜬다(3D 몸은 core 가 가게 판에서 앞치마로 바꿈). plan 이 가게 판 표정 키를 셌다: beam 5 · think 5 · apron 3 · surprise 3 · happy 3 · scissors 2 · winter 2 · tired 2 · curious 1 · worry 1 · bulb 1
- ⇒ **beam · think · surprise · happy 넷**이면 가게 판 줄의 대부분이 덮인다(winter 는 겨울 옷이라 안 바꾼다 · 나머지는 한두 줄)
- 참조: image 1 = 그 키의 지금 초상을 흰 바탕에 눕힌 것 `assets/characters/ref/apron_src/portrait_jachwi_<키>_white.png`(얼굴·표정·손을 지킨다) · image 2 = 앞치마 초상 a(옷만 가져온다)
- 글마다 2장 ⇒ 8장. 검수: ① 표정이 원래 키와 같나(특히 beam 눈물 · surprise 벌린 입) ② 머리·얼굴이 원래 초상과 같나 ③ 앞치마가 세이지 초록 · 끈이 목에 걸림 ④ 손가락
- 받으면: fit_portrait(위 `then`) → `portrait_jachwi_<키>_apron.png` → core 에 한 줄 청 «가게 판(story.job.id==='shop')이면 FACE 파일에 `_apron` 이 있으면 그것 먼저»

```json
[
 {
  "name": "portrait_jachwi_beam_apron",
  "kind": "portrait",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_beam_apron.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_beam_apron.png --ref assets/characters/portraits/portrait_jachwi_neutral.png --tol 8 --pockets",
  "used_in": "가게 판 자취생 beam 5줄 — 첫 손님 · 간판 · «동네에서 식물 하면 여기래» (plan 96500c11 셈)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "quality": "max",
   "resolution": "2k",
   "count": 2,
   "prompt": "Redraw image 1 exactly - SAME woman, SAME facial expression, SAME pose, SAME hands, SAME framing and size, SAME hair (long straight, blunt bangs, same color as image 1) - and change ONLY her clothes: she now wears the plain sage-green work apron over her cream round-neck tee exactly like image 2. Flat 2D anime bust portrait in the art style of image 1 (clean thin lines, soft flat shading), plain pure white background, no text.",
   "medias": [
    {
     "value": "assets/characters/ref/apron_src/portrait_jachwi_beam_white.png",
     "role": "image_references"
    },
    {
     "value": "assets/characters/portraits/_hf/portrait_jachwi_apron_a.jpg",
     "role": "image_references"
    }
   ]
  }
 },
 {
  "name": "portrait_jachwi_think_apron",
  "kind": "portrait",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_think_apron.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_think_apron.png --ref assets/characters/portraits/portrait_jachwi_neutral.png --tol 8 --pockets",
  "used_in": "가게 판 자취생 think 5줄 — 가게 잡담 둘 포함 (plan 96500c11 셈)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "quality": "max",
   "resolution": "2k",
   "count": 2,
   "prompt": "Redraw image 1 exactly - SAME woman, SAME facial expression, SAME pose, SAME hands, SAME framing and size, SAME hair (long straight, blunt bangs, same color as image 1) - and change ONLY her clothes: she now wears the plain sage-green work apron over her cream round-neck tee exactly like image 2. Flat 2D anime bust portrait in the art style of image 1 (clean thin lines, soft flat shading), plain pure white background, no text.",
   "medias": [
    {
     "value": "assets/characters/ref/apron_src/portrait_jachwi_think_white.png",
     "role": "image_references"
    },
    {
     "value": "assets/characters/portraits/_hf/portrait_jachwi_apron_a.jpg",
     "role": "image_references"
    }
   ]
  }
 },
 {
  "name": "portrait_jachwi_surprise_apron",
  "kind": "portrait",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_surprise_apron.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_surprise_apron.png --ref assets/characters/portraits/portrait_jachwi_neutral.png --tol 8 --pockets",
  "used_in": "가게 판 자취생 surprise 3줄 (plan 96500c11 셈)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "quality": "max",
   "resolution": "2k",
   "count": 2,
   "prompt": "Redraw image 1 exactly - SAME woman, SAME facial expression, SAME pose, SAME hands, SAME framing and size, SAME hair (long straight, blunt bangs, same color as image 1) - and change ONLY her clothes: she now wears the plain sage-green work apron over her cream round-neck tee exactly like image 2. Flat 2D anime bust portrait in the art style of image 1 (clean thin lines, soft flat shading), plain pure white background, no text.",
   "medias": [
    {
     "value": "assets/characters/ref/apron_src/portrait_jachwi_surprise_white.png",
     "role": "image_references"
    },
    {
     "value": "assets/characters/portraits/_hf/portrait_jachwi_apron_a.jpg",
     "role": "image_references"
    }
   ]
  }
 },
 {
  "name": "portrait_jachwi_happy_apron",
  "kind": "portrait",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_happy_apron.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_happy_apron.png --ref assets/characters/portraits/portrait_jachwi_neutral.png --tol 8 --pockets",
  "used_in": "가게 판 자취생 happy 3줄 (plan 96500c11 셈)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "quality": "max",
   "resolution": "2k",
   "count": 2,
   "prompt": "Redraw image 1 exactly - SAME woman, SAME facial expression, SAME pose, SAME hands, SAME framing and size, SAME hair (long straight, blunt bangs, same color as image 1) - and change ONLY her clothes: she now wears the plain sage-green work apron over her cream round-neck tee exactly like image 2. Flat 2D anime bust portrait in the art style of image 1 (clean thin lines, soft flat shading), plain pure white background, no text.",
   "medias": [
    {
     "value": "assets/characters/ref/apron_src/portrait_jachwi_happy_white.png",
     "role": "image_references"
    },
    {
     "value": "assets/characters/portraits/_hf/portrait_jachwi_apron_a.jpg",
     "role": "image_references"
    }
   ]
  }
 }
]
```

### 앞치마 판 낯 넷 받음 (총괄 · 장부 assets/gen/hf_runs/char_apron4_20261009.json)
- 여덟 장 모두 얼굴·표정·손이 원래 초상 그대로 · 옷만 세이지 앞치마. 고름: **넷 다 a**(원래 초상과 얼굴 겹침 NCC 가 a 쪽이 같거나 높다: beam 0.969/0.944 · think 0.970/0.959 · surprise 0.960/0.950 · happy 0.957/0.956)
- ⚠ 몸을 더 넣어 얼굴이 원래보다 6~11% 작게 왔다. 기본 fit_portrait(인물 키로 맞춤)는 흉상이 판을 다 채워 얼굴 크기를 못 돌린다 ⇒ 같은 화자가 줄마다 얼굴 크기가 튄다
  ⇒ `fit_portrait.py --match <원래 초상>`: 원래 초상의 눈·코·입 네모를 틀로 배율을 훑어(NCC) 원래 판에 해당하는 네모를 잘라 냄. 눈·입 높이가 원래와 같은 줄에 선다(그림으로 봄)
- 게임 판: `assets/characters/portraits/portrait_jachwi_{beam,think,surprise,happy}_apron.png` 600×800 투명 · core 에 «가게 판이면 `_apron` 먼저» 한 줄 청함

### 유니티 3D — Tripo G2 두 줄 · Meshy G3 (총괄 a459c237 · 2026-10-10 char)
**Tripo 3만 면 판 G2** (`g2_check.py` · ⚠ Tripo 는 얼굴이 +X 를 보고 왔다 — 노드 회전 없이 정점에 구워짐. 자가 이제 얼굴 쪽을 찾아 돌려 잰다)
| 잰 것 | Tripo | Meshy | hero2 리그 전 |
|---|---|---|---|
| 덩어리 · 면 | 1 · 29,277 | 1 · 30,917 | 1 · 30,226 |
| 손끝 가로 거리(키 비) | **0.265** | 0.245 | 0.323 |
| 머리–팔 2% 안 머리 정점(가장 가까움) | **0 (0.032)** | 1,482 (0.000) | 431 (0.000) |
| 머리 색 · 밝기 | [99,82,77] · 85.9 (정본 [95,78,80] 에 이미 가깝다) | [43,22,21] · 27.9 | [61,37,46] · 45.0 |
- 리그 전에 앞=+Z 로 돌려 구운 판: `assets/v2/char/_src/hero_unity/hero_toy_b_tripo_mv30k_0cbeb136_facez.glb`(`tools/char/glb_face_z.py` · 다시 잰 얼굴 각 0° · 그림 `docs/handoff/img/hero/unity_g2_tripo_facez.png`)

**Meshy 리그 G3** (rig_01a12114 · 클립 13 + 걷기·뛰기)
- ✔ 뼈 24 이름·계층 hero2 와 같음(check_skeleton_match O) · 걷기 팔 벌림 평균 11.3°(hero2 11.0°)
- ⛔ 머리 정점 중 팔 무게 >0.5 **12.3%(2,594)** — hero2 리그 0.4%(66). 자는 hero2 수를 그대로 되낸다(54.6% · 0.4%)
- 0 크레딧 고치기(`fix_hair_weights.py`)를 셋 다 그려 봄(`docs/handoff/img/hero/unity_g3_weights.png` · `unity_g3_near_tight.png` · cheer·wave·idle·walk 앞·옆·뒤·3/4):
  - 전부 떼기: 머리는 곧으나 어깨·든 팔에 **바늘**(늘어난 삼각형)
  - 팔 뼈 거리로 서서히 0.08~0.20(hero2 몸짓 무게와 같은 값): 바늘 없음 · 그러나 팔 무게 >0.5 가 **7.6%** 남아 cheer 에서 앞 가닥이 팔 쪽으로 들린다(hero2 몸짓 무게는 0.3%)
  - 0.04~0.12 로 좁히기: 3.5% · **바늘이 돌아온다**
  - 까닭: 이 몸은 팔이 몸에 붙어(0.245) 뒷머리 끝이 아래팔에 얹혀 있다 — 팔 뼈 곁 머리는 떼면 찢기고 두면 딸려 간다
- ⇒ **판정: 0 크레딧 도구로 안 고쳐진다 ⇒ 박사님 «Meshy 가 잘 안 되면 Tripo 로»(10-10) — Tripo 판으로 간다.** Tripo 는 머리–팔 2% 안 정점이 0 이라 hero2 처럼 리그만으로 깨끗할 것이다(리그 뒤 같은 자로 다시 잰다)
- 붙일 것(총괄 · Meshy 계정): Tripo facez 판에 rig(키 1.4 · 5) + 동작 13(같은 번호 · 39) = 44 / 잔액 56
- 받으면: `python tools/char/build_hero_unity.py <rig.glb> <clips 폴더> assets/v2/char/hero_unity.glb` — 머리 무게(--near) · 머리·티 색(hero2 값) · 클립 15 를 게임 이름으로(crouch ← repot · inspect ← a281) · 쓰는 구간·몸짓 구간을 extras 와 곁 .json 에 · 관문 «머리 팔 무게 >0.5 ≤ 0.5%»
- Meshy 클립 15 는 몸을 벗겼다(5.2MB → 47~376KB · 뼈+트랙만) — Tripo 가 막히면 되돌아올 판으로 둔다
