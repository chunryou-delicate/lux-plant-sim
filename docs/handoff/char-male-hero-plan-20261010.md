# 남자 주인공 — 정본 후보와 뒤따를 주문 (char · 2026-10-10)

박사님 10-10 «옛날 기획한 대로 직업이랑 남녀별로 추후에 분기되도록도 해» · plan `plan-branch-job-gender-20261010.md` §4 · 총괄: 생김새는 캐릭터 정체라 **박사님이 고른다**(D3 결) — 그래서 먼저 neutral 후보 셋만 뽑는다. ⛔ 크레딧은 총괄이 돌린다.

## 1. 한 세계에 서려면 — 얼굴 · 머리 · 옷 · 키
| | 여 정본(지금) | 옛 남(char_namja_jachwi · portrait_jachwi_m_*) | 남 정본이 맞출 것 |
|---|---|---|---|
| 얼굴(초상) | 초상 결 — 가는 선 · 짙은 눈선 · 갈색 눈동자 · 볼 홍조 · 600×800 · 판 끝까지 흉상(바닥 799) | **같은 결**이다(같은 눈 그림 · 홍조) · ⚠ 흉상이 짧다(바닥 672 — 어깨가 판 아래까지 안 내려옴) | 같은 결 · 같은 틀(판 끝까지) — 후보 글에 «image 1 과 같은 틀» |
| 머리 색 | 초상 밝기 59.7 · [68,56,57] · 3D hero2 [95,78,80](초상 × 1.4 · D24) | 초상 62.2 · [72,58,58] — **이미 같은 집안** · 옛 3D 는 붉은 갈색 [74,45,38] | 초상은 여 초상과 같은 값 · 3D 는 hero2 와 같은 값([95,78,80] · recolor_hero_tex 0 크레딧) |
| 머리 모양 | 긴 생머리 · 일자 앞머리 | 짧은 머리 · 부드러운 앞머리 | ⚖ 박사님 고르기(후보 A 옛 결 · B 부드러운 중간 길이 · C 이마 보이는 단정한 짧은 머리) |
| 옷 | 크림 라운드 티 · 회색 조거 · 회색·흰 신발 | 초상 크림 티 ✔ · 옛 3D 는 **청바지**(✗) | 크림 티 · 회색 조거 · 회색·흰 신발 — 계절 옷 일곱을 같은 팔레트로(여 outfit 과 짝) |
| 3D 결 | hero2 — 장난감 치비(턴어라운드 b) · **A포즈** | 옛 lq 치비 · A포즈 | 같은 장난감 결 · 같은 머리 비 · **A포즈**(⚠ plan §4 표의 «T포즈»는 바꿔 읽을 것 — hero2 에서 T포즈면 긴 머리가 팔에 묶였다 · 클립·뼈를 hero2 와 같이 쓰려면 A포즈) |
| 키(게임 자) | 리그 키 1.4 · 걷기 walkMps 0.729 | 1.898(옛 판 단위) | 리그 키 1.4 로 같게(권함) — 방·가구 크기 감이 안 흔들린다. 쭈그리기·살피기·걷기 표는 몸마다 다시 잰다(build 의 extras) |
| 뼈·동작 | 24뼈 이름 · Meshy 동작 13(번호 표) | 24뼈(옛) | 같은 24뼈 이름 · 같은 동작 번호 13 — 클립·v2_hero 코드를 그대로 쓴다 |
| 3D 뜨기 | Meshy | — | 박사님 10-10: **Meshy · Tripo 두 판을 떠서 G2 로 고른다**(g2_check.py · 손끝 벌림 · 머리–팔 2% · 얼굴 쪽) |

- ⚠ 자 한계(적어 둠): g2_check 의 «얼굴 쪽 찾기»는 짧은 머리(목덜미 살)에서 틀린다 — 옛 namja_jachwi 를 거꾸로 돌렸다. 짧은 머리 판은 그림으로 앞을 확인할 것.

## 2. 지금 돌릴 것 — neutral 후보 셋 (글마다 2장 · gpt_image_2_5 max 2k · 6장 ≈ 54)
- image 1 = 여 정본 neutral(결·틀만 · 다른 사람) · A 만 image 2 = 옛 남 neutral(흰 바탕 `assets/characters/ref/male_src/portrait_jachwi_m_neutral_white.png`)
- 검수(char): ① 여 정본과 같은 결·같은 틀 ② 여 얼굴을 안 닮았나(성별만 바꾼 얼굴 X) ③ 머리 색이 여 초상과 같은 짙은 갈색 ④ 크림 티 ⑤ 손·글자 없음
- 박사님께 보일 때: 후보 셋을 여 정본 neutral 과 나란히 · 같은 크기(fit_portrait)
- ★ 값 차이도 같이 보일 것: **A(옛 결)를 고르면 이미 있는 남 초상 아홉을 살려 여섯만 더 뽑는다**(6 × 9 = 54). B·C 면 열넷을 새로(14 × 9 = 126)

```json
[
 {
  "name": "portrait_jachwi_m_neutral_candA",
  "kind": "portrait",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_neutral_candA.png",
  "why": "옛 결 — 이미 있는 남 초상 아홉(portrait_jachwi_m_*)의 그 사람. 고르면 아홉을 그대로 살리고 모자란 여섯만 뽑는다(싸다)",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "quality": "max",
   "resolution": "2k",
   "count": 2,
   "prompt": "A young man in his early twenties who lives alone - a DIFFERENT person from the woman in image 1 (do not copy her face or her long hair), but clearly from the same world and palette: cream round-neck t-shirt, very dark brown hair (the same hair color as image 1, not pure black). Calm neutral expression, mouth closed, looking straight at the viewer. He is the young man in image 2 - the same face and the same short hair with a soft fringe; redraw him in the framing of image 1. Flat 2D anime bust portrait in exactly the art style of image 1 (clean thin dark-brown lines, soft flat shading, the same eye drawing with dark eyeliner and brown irises, soft pink blush), the same framing and size as image 1 (head and shoulders, top of the hair near the top edge, shoulders reaching the bottom edge), plain pure white background, no text.",
   "medias": [
    {
     "value": "assets/characters/portraits/portrait_jachwi_neutral.png",
     "role": "image_references"
    },
    {
     "value": "assets/characters/ref/male_src/portrait_jachwi_m_neutral_white.png",
     "role": "image_references"
    }
   ]
  }
 },
 {
  "name": "portrait_jachwi_m_neutral_candB",
  "kind": "portrait",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_neutral_candB.png",
  "why": "부드러운 결 — 앞머리가 이마를 덮는 중간 길이 · 순한 눈매",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "quality": "max",
   "resolution": "2k",
   "count": 2,
   "prompt": "A young man in his early twenties who lives alone - a DIFFERENT person from the woman in image 1 (do not copy her face or her long hair), but clearly from the same world and palette: cream round-neck t-shirt, very dark brown hair (the same hair color as image 1, not pure black). Calm neutral expression, mouth closed, looking straight at the viewer. Hair: soft medium-length hair with a side-swept fringe falling over the forehead and covering the ears halfway; gentle, slightly droopy eyes; a quiet, kind impression. Flat 2D anime bust portrait in exactly the art style of image 1 (clean thin dark-brown lines, soft flat shading, the same eye drawing with dark eyeliner and brown irises, soft pink blush), the same framing and size as image 1 (head and shoulders, top of the hair near the top edge, shoulders reaching the bottom edge), plain pure white background, no text.",
   "medias": [
    {
     "value": "assets/characters/portraits/portrait_jachwi_neutral.png",
     "role": "image_references"
    }
   ]
  }
 },
 {
  "name": "portrait_jachwi_m_neutral_candC",
  "kind": "portrait",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_neutral_candC.png",
  "why": "단정한 결 — 이마가 보이는 짧은 머리 · 밝은 눈매",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "quality": "max",
   "resolution": "2k",
   "count": 2,
   "prompt": "A young man in his early twenties who lives alone - a DIFFERENT person from the woman in image 1 (do not copy her face or her long hair), but clearly from the same world and palette: cream round-neck t-shirt, very dark brown hair (the same hair color as image 1, not pure black). Calm neutral expression, mouth closed, looking straight at the viewer. Hair: short neat hair with the forehead showing (a two-block cut, short sides); slightly brighter, friendly eyes; a tidy, cheerful impression. Flat 2D anime bust portrait in exactly the art style of image 1 (clean thin dark-brown lines, soft flat shading, the same eye drawing with dark eyeliner and brown irises, soft pink blush), the same framing and size as image 1 (head and shoulders, top of the hair near the top edge, shoulders reaching the bottom edge), plain pure white background, no text.",
   "medias": [
    {
     "value": "assets/characters/portraits/portrait_jachwi_neutral.png",
     "role": "image_references"
    }
   ]
  }
 }
]
```

## 3. 고른 뒤 — 초안(지금 안 돌림 · 고른 neutral 원본을 `<고른 남 neutral 원본>` 자리에)
- 초상 키(여 FACE_FILE 과 같은 키): A 면 curious · scissors · bulb · beam · winter · apron 여섯만 · B·C 면 열넷 전부. count 1(고른 얼굴을 지키는 편집이라 한 장으로 넉넉 — 틀리면 그 줄만 다시)
- 앞치마 판(beam · think · surprise · happy `_apron`)은 여와 같은 길(그 키 초상 + 앞치마 초상 → `fit_portrait --match`)
- 장난감 턴어라운드(유니티·3D 입력 · 16:9 4k · 2장) — ★ 팔 벌림을 «45° · 몸통과 틈이 보이게»로 세게 적었다(여 Meshy 판이 손끝 0.245 로 붙어 머리–팔 무게가 안 고쳐졌다)
- 표정 시트(3×4 · 4k · 1장)
- 가장·주부·연구자 콘셉트(한 장에 남·녀 둘 · 옛 3D 옷 결 그대로 · 2k · 1장씩) — 새 판 캐릭터 «열림 차례»(plan §5-6)는 박사님 몫이라 콘셉트만

```json
{
 "portrait_keys": [
  {
   "name": "portrait_jachwi_m_happy",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_happy.png",
   "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_happy.png --ref assets/characters/portraits/portrait_jachwi_m_neutral.png --tol 8 --pockets",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "The SAME young man as image 1 - same face, same hair, same framing and size, same art style - now with this expression: a warm open smile, eyes slightly crescent. Plain pure white background, no text.",
    "medias": [
     {
      "value": "<고른 남 neutral 원본>",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "portrait_jachwi_m_worry",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_worry.png",
   "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_worry.png --ref assets/characters/portraits/portrait_jachwi_m_neutral.png --tol 8 --pockets",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "The SAME young man as image 1 - same face, same hair, same framing and size, same art style - now with this expression: worried, brows drawn together, a slight frown. Plain pure white background, no text.",
    "medias": [
     {
      "value": "<고른 남 neutral 원본>",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "portrait_jachwi_m_cry",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_cry.png",
   "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_cry.png --ref assets/characters/portraits/portrait_jachwi_m_neutral.png --tol 8 --pockets",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "The SAME young man as image 1 - same face, same hair, same framing and size, same art style - now with this expression: crying, tears on the cheeks, mouth wavering. Plain pure white background, no text.",
    "medias": [
     {
      "value": "<고른 남 neutral 원본>",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "portrait_jachwi_m_surprise",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_surprise.png",
   "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_surprise.png --ref assets/characters/portraits/portrait_jachwi_m_neutral.png --tol 8 --pockets",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "The SAME young man as image 1 - same face, same hair, same framing and size, same art style - now with this expression: surprised, eyes wide, mouth open. Plain pure white background, no text.",
    "medias": [
     {
      "value": "<고른 남 neutral 원본>",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "portrait_jachwi_m_tired",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_tired.png",
   "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_tired.png --ref assets/characters/portraits/portrait_jachwi_m_neutral.png --tol 8 --pockets",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "The SAME young man as image 1 - same face, same hair, same framing and size, same art style - now with this expression: tired, half-closed eyes, shoulders slightly slumped. Plain pure white background, no text.",
    "medias": [
     {
      "value": "<고른 남 neutral 원본>",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "portrait_jachwi_m_think",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_think.png",
   "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_think.png --ref assets/characters/portraits/portrait_jachwi_m_neutral.png --tol 8 --pockets",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "The SAME young man as image 1 - same face, same hair, same framing and size, same art style - now with this expression: thinking, eyes looking up to the side, lips slightly parted. Plain pure white background, no text.",
    "medias": [
     {
      "value": "<고른 남 neutral 원본>",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "portrait_jachwi_m_curious",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_curious.png",
   "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_curious.png --ref assets/characters/portraits/portrait_jachwi_m_neutral.png --tol 8 --pockets",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "The SAME young man as image 1 - same face, same hair, same framing and size, same art style - now with this expression: curious, head tilted slightly, an asking look. Plain pure white background, no text.",
    "medias": [
     {
      "value": "<고른 남 neutral 원본>",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "portrait_jachwi_m_proud",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_proud.png",
   "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_proud.png --ref assets/characters/portraits/portrait_jachwi_m_neutral.png --tol 8 --pockets",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "The SAME young man as image 1 - same face, same hair, same framing and size, same art style - now with this expression: a calm proud smile, mouth closed. Plain pure white background, no text.",
    "medias": [
     {
      "value": "<고른 남 neutral 원본>",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "portrait_jachwi_m_numb",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_numb.png",
   "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_numb.png --ref assets/characters/portraits/portrait_jachwi_m_neutral.png --tol 8 --pockets",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "The SAME young man as image 1 - same face, same hair, same framing and size, same art style - now with this expression: frozen, a blank stare, lost for words. Plain pure white background, no text.",
    "medias": [
     {
      "value": "<고른 남 neutral 원본>",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "portrait_jachwi_m_scissors",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_scissors.png",
   "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_scissors.png --ref assets/characters/portraits/portrait_jachwi_m_neutral.png --tol 8 --pockets",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "The SAME young man as image 1 - same face, same hair, same framing and size, same art style - now with this expression: holding small garden scissors near his chin, pondering, eyes to the side. Plain pure white background, no text.",
    "medias": [
     {
      "value": "<고른 남 neutral 원본>",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "portrait_jachwi_m_bulb",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_bulb.png",
   "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_bulb.png --ref assets/characters/portraits/portrait_jachwi_m_neutral.png --tol 8 --pockets",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "The SAME young man as image 1 - same face, same hair, same framing and size, same art style - now with this expression: surprised, eyes wide, holding a small round brown corm (bulb) up in his palm. Plain pure white background, no text.",
    "medias": [
     {
      "value": "<고른 남 neutral 원본>",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "portrait_jachwi_m_beam",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_beam.png",
   "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_beam.png --ref assets/characters/portraits/portrait_jachwi_m_neutral.png --tol 8 --pockets",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "The SAME young man as image 1 - same face, same hair, same framing and size, same art style - now with this expression: beaming with pride, both hands clasped at his chest, eyes slightly wet. Plain pure white background, no text.",
    "medias": [
     {
      "value": "<고른 남 neutral 원본>",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "portrait_jachwi_m_winter",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_winter.png",
   "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_winter.png --ref assets/characters/portraits/portrait_jachwi_m_neutral.png --tol 8 --pockets",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "The SAME young man as image 1 - same face, same hair, same framing and size, same art style - now with this expression: worried, wearing a cream knit sweater and a red scarf, looking down gently. Plain pure white background, no text.",
    "medias": [
     {
      "value": "<고른 남 neutral 원본>",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "portrait_jachwi_m_apron",
   "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_apron.png",
   "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_apron.png --ref assets/characters/portraits/portrait_jachwi_m_neutral.png --tol 8 --pockets",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "3:4",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "The SAME young man as image 1 - same face, same hair, same framing and size, same art style - now with this expression: a calm confident smile, wearing a plain sage-green work apron over the cream tee. Plain pure white background, no text.",
    "medias": [
     {
      "value": "<고른 남 neutral 원본>",
      "role": "image_references"
     }
    ]
   }
  }
 ],
 "turnaround": {
  "name": "sheet_hero_m_turnaround_toy",
  "save_as": "assets/characters/sheets/_hf/sheet_hero_m_turnaround_toy.png",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "16:9",
   "quality": "max",
   "resolution": "4k",
   "count": 2,
   "prompt": "Character turnaround sheet on a plain pure white background: FRONT, LEFT SIDE, BACK and 3/4 views of the SAME character side by side, full body, same scale, A-pose with the arms clearly away from the body (about 45 degrees, a visible gap between arms and torso, palms in), even flat lighting, no shadows, no text. The young man as a chibi 3D toy figure exactly like image 2 (same head-to-body ratio, soft toy shading), with the face and hair of image 1 (very dark brown hair, clearly brown, not black); cream round-neck tee, grey joggers, grey-white shoes. identical original character on all views, same proportions and colors in every view, single subject only, no other people, no props, no furniture, no background objects, pure white seamless background, no text, no labels, no watermark, no frame borders",
   "medias": [
    {
     "value": "<고른 남 neutral 원본>",
     "role": "image_references"
    },
    {
     "value": "assets/v2/char/_src/hero2/img_01a11e70-223b-705a-b82f-1a80de034747.png",
     "role": "image_references"
    }
   ]
  }
 },
 "expressions": {
  "name": "sheet_hero_m_expressions",
  "save_as": "assets/characters/sheets/_hf/sheet_hero_m_expressions.png",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "4:3",
   "quality": "max",
   "resolution": "4k",
   "count": 1,
   "prompt": "Expression sheet of the SAME young man as image 1, flat 2D anime style of image 1: a 3x4 grid of bust heads with the same framing, plain white background, no text labels. Expressions: neutral, happy, beaming proud, calm proud smile, surprised, curious, thinking, worried, crying, tired, numb (frozen), determined. identical original character on all views, same proportions and colors in every view, single subject only, no other people, no props, no furniture, no background objects, pure white seamless background, no text, no labels, no watermark, no frame borders",
   "medias": [
    {
     "value": "<고른 남 neutral 원본>",
     "role": "image_references"
    }
   ]
  }
 },
 "job_concepts": [
  {
   "name": "concept_breadwinner",
   "ko": "가장",
   "save_as": "assets/characters/sheets/_hf/concept_breadwinner.png",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "16:9",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "Character concept sheet on a plain pure white background: two separate full-body chibi 3D toy figures standing side by side, a man on the left and a woman on the right (two different people of the same role, not a couple), front view, relaxed A-pose, soft toy shading exactly like image 1, no text, no labels. They are breadwinners in their forties: white button-up shirt, grey slacks, brown belt, brown shoes, tired but warm faces.",
    "medias": [
     {
      "value": "assets/v2/char/_src/hero2/img_01a11e70-223b-705a-b82f-1a80de034747.png",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "concept_housewife",
   "ko": "주부",
   "save_as": "assets/characters/sheets/_hf/concept_housewife.png",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "16:9",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "Character concept sheet on a plain pure white background: two separate full-body chibi 3D toy figures standing side by side, a man on the left and a woman on the right (two different people of the same role, not a couple), front view, relaxed A-pose, soft toy shading exactly like image 1, no text, no labels. They are homemakers in their thirties: beige short-sleeve shirt, olive-green trousers, white sneakers, cozy and capable.",
    "medias": [
     {
      "value": "assets/v2/char/_src/hero2/img_01a11e70-223b-705a-b82f-1a80de034747.png",
      "role": "image_references"
     }
    ]
   }
  },
  {
   "name": "concept_researcher",
   "ko": "연구자",
   "save_as": "assets/characters/sheets/_hf/concept_researcher.png",
   "tool": "generate_image",
   "params": {
    "model": "gpt_image_2_5",
    "aspect_ratio": "16:9",
    "quality": "max",
    "resolution": "2k",
    "count": 1,
    "prompt": "Character concept sheet on a plain pure white background: two separate full-body chibi 3D toy figures standing side by side, a man on the left and a woman on the right (two different people of the same role, not a couple), front view, relaxed A-pose, soft toy shading exactly like image 1, no text, no labels. They are plant researchers in their thirties: cream lab coat with a small leaf pin, olive-green trousers, light shoes, curious bright eyes.",
    "medias": [
     {
      "value": "assets/v2/char/_src/hero2/img_01a11e70-223b-705a-b82f-1a80de034747.png",
      "role": "image_references"
     }
    ]
   }
  }
 ]
}
```

## 4. 3D 뒤따름(총괄 · plan §4)
- ★ **첫 자 = G2 «머리–팔 2% 안 머리 정점»**(`g2_check.py`) — 리그 성패를 리그 «전»에 말한다(10-10 여 유니티 주인공에서 배움):
  Meshy 판 1,482 → 리그 뒤 머리 팔 무게 12.3% · 0 크레딧 고치기로 안 고쳐짐(떼면 바늘 · 두면 가닥이 들림) / Tripo 판 **0** → 리그 날것은 22.1% 였어도 전부 떼서 0.0% · 바늘 없음.
  ⇒ 턴어라운드를 고를 때부터 «팔과 몸통 틈 · 머리 끝이 팔에 안 닿음»을 보고, 3D 두 판(Meshy · Tripo) 중 2% 안 0 인 쪽을 고른다. 짧은 머리면 대개 0 이지만 앞머리·옆머리가 어깨에 닿는지 그대로 잰다.
- ★ 그림 읽기: 도구는 재질 바탕색(`strip_stray_parts.base_color_image`)을 따라간다 — Tripo 는 images[0] 이 노멀 맵이다. 새 도구도 이것으로 읽을 것.
- 턴어라운드 고름 → 칸 넷(같은 정사각 · 같은 축척 · 같은 바닥선 — 몬이 b 자르기와 같은 법) → Meshy multi-image · Tripo multiview 두 판 → G2(g2_check) → 고른 판 앞=+Z(glb_face_z) → rig 1.4 + 동작 13(Meshy 계정 44) → build_hero_unity 와 같은 길(머리 무게 · 색 · 클립 · extras) → `hero2_m.glb`
- 옷 일곱: hero2 와 같은 길(retexture → apply_outfit_tex) — 남 몸 UV 가 따로라 `outfit/m/*.jpg`
- 게임에 들일 때(core 66dfb4c0 길): `hero2_m.glb` 의 scene extras 에 **`hero: 'hero2_m'`** 을 박는다 — v2_hero setOutfit 이 `hero2` · `hero2_m` 만 옷을 입힌다(1180e092). 그다음 v2_hero 의 `pickByGender({ f: …, m: null })` 두 곳(몸 · 옷 표)의 m 칸만 채운다. 옷 그림 캐시는 이미 «성별:이름» 열쇠다


## 5. 정해진 판 — 후보 A a (총괄 10-10 · 박사님 «니가 잘 골라») · 지금 돌릴 것

- 고름: **A a** — 옛 남 초상과 얼굴 겹침(NCC) a 0.840 · b 0.844 로 비김 ⇒ 눈으로: a 의 둥근 머리·가운데 앞머리가 옛 happy·proud·worry 와 맞고 b 는 정수리가 높고 뾰족하다
- 정본: `assets/characters/portraits/portrait_jachwi_m_neutral.png` 를 A a 로 갈았다 — `fit_portrait --match <옛 neutral> --match-min 0.8` 로 **옛 아홉과 같은 얼굴 자리·크기**(눈·코·입 높이가 같은 줄 · 그림으로 봄). 옛 판은 `_old/portrait_jachwi_m_neutral_v1.png`
  - `--match-min` 을 새로 열었다: 옷만 바꾼 같은 그림은 0.95 언저리, 같은 사람을 새로 그린 판은 0.84 언저리였다(기본 0.9 그대로)
- 옛 남 초상 여덟(happy·cry·numb·proud·surprise·think·tired·worry)은 그대로 쓴다(core 66dfb4c0 길 · 'm' 이면 jachwi_m_{키})

### ① 모자란 남 낯 여섯 (count 1 · ≈54)
- image 1 = 고른 A a 원본(`assets/characters/portraits/_hf/portrait_jachwi_m_neutral_candA_a.jpg`) · 받으면 `fit_portrait --match portrait_jachwi_m_neutral.png --match-min 0.7` — 다른 표정이라 겹침이 낮아도 같은 원본에서 나와 틀이 같다(0.7 밑이면 멈춤 · 눈으로 볼 것)
- 검수: ① 얼굴·머리가 A a 그대로 ② 표정 뜻(여 같은 키와 같은 뜻) ③ 손가락 ④ winter 는 크림 니트·빨간 목도리 · apron 은 세이지 앞치마

```json
[
 {
  "name": "portrait_jachwi_m_curious",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_curious.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_curious.png --match assets/characters/portraits/portrait_jachwi_m_neutral.png --match-min 0.7 --tol 8 --pockets",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "quality": "max",
   "resolution": "2k",
   "count": 1,
   "prompt": "The SAME young man as image 1 - same face, same short very dark brown hair with the soft fringe, same framing and size, same flat 2D anime art style - now with this expression: curious, head tilted slightly, an asking look. Plain pure white background, no text.",
   "medias": [
    {
     "value": "assets/characters/portraits/_hf/portrait_jachwi_m_neutral_candA_a.jpg",
     "role": "image_references"
    }
   ]
  }
 },
 {
  "name": "portrait_jachwi_m_scissors",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_scissors.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_scissors.png --match assets/characters/portraits/portrait_jachwi_m_neutral.png --match-min 0.7 --tol 8 --pockets",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "quality": "max",
   "resolution": "2k",
   "count": 1,
   "prompt": "The SAME young man as image 1 - same face, same short very dark brown hair with the soft fringe, same framing and size, same flat 2D anime art style - now with this expression: holding small garden scissors near his chin, pondering, eyes to the side. Plain pure white background, no text.",
   "medias": [
    {
     "value": "assets/characters/portraits/_hf/portrait_jachwi_m_neutral_candA_a.jpg",
     "role": "image_references"
    }
   ]
  }
 },
 {
  "name": "portrait_jachwi_m_bulb",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_bulb.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_bulb.png --match assets/characters/portraits/portrait_jachwi_m_neutral.png --match-min 0.7 --tol 8 --pockets",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "quality": "max",
   "resolution": "2k",
   "count": 1,
   "prompt": "The SAME young man as image 1 - same face, same short very dark brown hair with the soft fringe, same framing and size, same flat 2D anime art style - now with this expression: surprised, eyes wide, holding a small round brown corm (bulb) up in his palm. Plain pure white background, no text.",
   "medias": [
    {
     "value": "assets/characters/portraits/_hf/portrait_jachwi_m_neutral_candA_a.jpg",
     "role": "image_references"
    }
   ]
  }
 },
 {
  "name": "portrait_jachwi_m_beam",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_beam.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_beam.png --match assets/characters/portraits/portrait_jachwi_m_neutral.png --match-min 0.7 --tol 8 --pockets",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "quality": "max",
   "resolution": "2k",
   "count": 1,
   "prompt": "The SAME young man as image 1 - same face, same short very dark brown hair with the soft fringe, same framing and size, same flat 2D anime art style - now with this expression: beaming with pride, both hands clasped at his chest, eyes slightly wet. Plain pure white background, no text.",
   "medias": [
    {
     "value": "assets/characters/portraits/_hf/portrait_jachwi_m_neutral_candA_a.jpg",
     "role": "image_references"
    }
   ]
  }
 },
 {
  "name": "portrait_jachwi_m_winter",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_winter.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_winter.png --match assets/characters/portraits/portrait_jachwi_m_neutral.png --match-min 0.7 --tol 8 --pockets",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "quality": "max",
   "resolution": "2k",
   "count": 1,
   "prompt": "The SAME young man as image 1 - same face, same short very dark brown hair with the soft fringe, same framing and size, same flat 2D anime art style - now with this expression: worried, wearing a cream knit sweater and a red scarf, looking down gently. Plain pure white background, no text.",
   "medias": [
    {
     "value": "assets/characters/portraits/_hf/portrait_jachwi_m_neutral_candA_a.jpg",
     "role": "image_references"
    }
   ]
  }
 },
 {
  "name": "portrait_jachwi_m_apron",
  "save_as": "assets/characters/portraits/_hf/portrait_jachwi_m_apron.png",
  "then": "python tools/char/fit_portrait.py <받은.png> assets/characters/portraits/portrait_jachwi_m_apron.png --match assets/characters/portraits/portrait_jachwi_m_neutral.png --match-min 0.7 --tol 8 --pockets",
  "tool": "generate_image",
  "params": {
   "model": "gpt_image_2_5",
   "aspect_ratio": "3:4",
   "quality": "max",
   "resolution": "2k",
   "count": 1,
   "prompt": "The SAME young man as image 1 - same face, same short very dark brown hair with the soft fringe, same framing and size, same flat 2D anime art style - now with this expression: a calm confident smile, wearing a plain sage-green work apron over the cream tee. Plain pure white background, no text.",
   "medias": [
    {
     "value": "assets/characters/portraits/_hf/portrait_jachwi_m_neutral_candA_a.jpg",
     "role": "image_references"
    }
   ]
  }
 }
]
```

### ② 장난감 턴어라운드 (16:9 · 4k · count 2 · ≈30)
- image 1 = A a 원본 · image 2 = hero2 장난감 기준 그림. ★ 팔 45° · 몸통과 틈 · 머리가 어깨·팔에 안 닿음(G2 «머리–팔 2%» 가 리그 성패를 미리 말한다 — §4 첫 자)
- 검수: 네 칸이 같은 사람·같은 축척 · 신발 앞뒤가 맞음(여 판 a 는 뒤에서 뒤꿈치가 트였다) · 팔과 몸통 사이 흰 틈

```json
{
 "name": "sheet_hero_m_turnaround_toy",
 "save_as": "assets/characters/sheets/_hf/sheet_hero_m_turnaround_toy.png",
 "tool": "generate_image",
 "then": "char: 칸 넷을 같은 정사각 · 같은 축척 · 같은 바닥선으로 잘라 assets/characters/sheets/_hf/crops/hero_m_<a|b>_{front,side,back,three_quarter}.png (몬이 b 자르기와 같은 법)",
 "params": {
  "model": "gpt_image_2_5",
  "aspect_ratio": "16:9",
  "quality": "max",
  "resolution": "4k",
  "count": 2,
  "prompt": "Character turnaround sheet on a plain pure white background: FRONT, LEFT SIDE, BACK and 3/4 views of the SAME character side by side, full body, same scale, A-pose with the arms clearly away from the body (about 45 degrees, a clear visible gap between the arms and the torso, palms in), even flat lighting, no shadows, no text. The young man as a chibi 3D toy figure exactly like image 2 (same head-to-body ratio, same soft toy shading), with the face and the short hair of image 1 (very dark chocolate-brown hair, clearly brown, not black; the hair does not touch the shoulders or arms); cream round-neck tee, grey joggers, grey-white shoes. identical original character on all views, same proportions and colors in every view, single subject only, no other people, no props, no furniture, no background objects, pure white seamless background, no text, no labels, no watermark, no frame borders",
  "medias": [
   {
    "value": "assets/characters/portraits/_hf/portrait_jachwi_m_neutral_candA_a.jpg",
    "role": "image_references"
   },
   {
    "value": "assets/v2/char/_src/hero2/img_01a11e70-223b-705a-b82f-1a80de034747.png",
    "role": "image_references"
   }
  ]
 }
}
```

### ③~⑤ (총괄) — 3D Meshy·Tripo 두 판 → G2(g2_check · 2% 줄 먼저 · 짧은 머리라 얼굴 쪽은 그림으로) → 고른 판 glb_face_z → Higgsfield 3d_rigging(키 1.4 · 동작 13 같은 번호) → char: build_hero_unity 와 같은 길로 hero2_m.glb(extras.hero='hero2_m') · 옷은 기본(크림 티·회색 조거)만 — 옷 일곱은 미룸

### ①② 받음 (총괄 · 장부 assets/gen/hf_runs/char_male_20261010.json · 10-10 char)
- ① 낯 여섯 — 여섯 다 A a 그 사람 · 같은 틀 · 표정 뜻 맞음(winter 니트·빨간 목도리 · apron 세이지 앞치마). 게임 판 `assets/characters/portraits/portrait_jachwi_m_{curious,scissors,bulb,beam,winter,apron}.png`
  - 얼굴로 맞추니 넷(scissors 0.88 · bulb 0.87 · beam 0.93 · apron 0.98)은 원본 A a 와 «똑같은 네모»(x −46..1777 · y 12..2442)로 맞았다 = 같은 원본의 편집판은 틀이 같다. 고개 기울인 curious(0.68)·목도리 winter(0.59)는 얼굴로 못 찾는다(엉뚱한 배율 +5%)
  - ⇒ `fit_portrait --match <정본> --match-via <A a 원본>` — 자리는 원본으로 찾고 이 그림을 그 네모로 자른다. 여섯을 다 이 길로(한 네모) · 자홍 바탕·눈코입 줄로 정본·옛 happy 와 견줌
  - 이제 남 낯 열다섯 키가 다 있다(옛 여덟 + 정본 + 새 여섯) — core 66dfb4c0 «모자란 남 낯» 0
- ② 턴어라운드 **a** — b 는 옆모습 팔이 앞으로 나와 앞모습(옆으로 45°)과 어긋난다. a 는 옆에서 팔이 곧게 내려와 A포즈와 맞다. 둘 다 짧은 머리라 머리–팔이 안 닿는다
  - 칸 넷 `assets/characters/sheets/_hf/crops/hero_m_toy_a_{front,side,back,three_quarter}.png` — 같은 정사각 1874 · 같은 축척 · 같은 바닥선 1809. 장부에 칸 상자가 없어 연결 덩어리로 찾았다(옆–뒤 · 뒤–3/4 사이 틈이 25px 뿐이라 «틈 40px 미만 잇기»는 셋을 한 덩어리로 묶었다 — 덩어리로 가름)
