# assets/ui — 유료 호출 기록

저장소 규칙: 유료 API(Meshy/Higgsfield)를 쓸 때마다 **한 줄씩** 남긴다.
창 여럿이 같은 계정을 쓰므로 이 기록이 없으면 충전 시점을 못 잡는다.
(전체 합계는 `assets/manifest.json` 의 `_credit_log` 가 정본. 이 파일은 UI 창 몫만 적는다.)

| 날짜 | 창 | 서비스 | 모델 | 용도 | 장수 | 크레딧 |
|---|---|---|---|---|---|---|
| 2026-08-03 | ui | higgsfield | nano_banana_pro | 아이템 카드 프레임(9-slice) `panel_frame` | 1 | 2 |
| 2026-08-03 | ui | higgsfield | nano_banana_pro | 아이템 슬롯 판 `slot_plate` | 1 | 2 |
| 2026-08-03 | ui | higgsfield | nano_banana_pro | 자원 아이콘 2×2 시트(날짜·밥·동전·창) | 1 | 2 |
| 2026-08-03 | ui | higgsfield | nano_banana_pro | 버튼 배경 판 `button_plate` | 1 | 2 |
| 2026-08-03 | ui | higgsfield | nano_banana_pro | 몬스테라 아이템 썸네일 `item_monstera` | 1 | 2 |
| 2026-08-03 | ui-2 | higgsfield | nano_banana_pro | 폰 UI 아이콘 **3×3 시트 1장 = 9개** `ui9_raw` | 1 | 2 |
| 2026-08-03 | portrait | higgsfield | nano_banana_pro | 자취생 대화 초상화 **1×3 시트 1장 = 3표정** `portrait_jachwi_raw` | 1 | 2 |
| 2026-08-03 | portrait | higgsfield | nano_banana_pro | 몬이 대화 초상화 1×3 시트 (v1 — 잎이 칸 경계에 잘려 폐기) | 1 | 2 |
| 2026-08-03 | portrait | higgsfield | nano_banana_pro | 몬이 대화 초상화 **1×3 시트 1장 = 3표정** `portrait_moni_raw` | 1 | 2 |

**합계 18크레딧** (생성 9장). 잔액 809 → 799 → 797 → **791**.

대화 초상화(`assets/characters/portraits/`)는 **생성 3장 6크레딧**. 6장 납품이다.
v1 을 한 번 버린 건 참조 이미지 탓이었다 — 3D 렌더 참조를 세로 기준으로만
맞춰 넣어서 몬이 잎이 참조에서 이미 잘려 있었고, 생성기가 그 잘림을 그대로
따라 그렸다. **참조 이미지가 잘려 있으면 결과도 잘린다.** 렌더러를 가로·세로
둘 다 맞추게 고치고(`portraits/_ref/render_ref.py`) 다시 뽑아 해결했다.

2차(폰 세로 배치·이동 UI)는 **생성 1장 2크레딧**만 썼다. 나머지는 전부
`_raw/` 재활용 아니면 절차적 생성이다. 3×3 시트가 2×2 보다 확실히 남는다 —
칸당 341px 라 96~128px 아이콘으로 쓰기에 남고, 9칸이 한 번에 톤이 맞는다.

## 생성물에서 파생시킨 파일 — 추가 과금 없음

| 원본(`_raw/`) | 나온 파일 | 방법 |
|---|---|---|
| `icons_raw.png` | `icon_day` · `icon_food` · `icon_coin` · `icon_window` | 2×2 사분면 분할 → 96px |
| `button_raw.png` | `button_plate_amber` · `_slate` · `_sage` | 곱하기 틴트 3색 → 320×125 |
| `frame_raw.png` | `panel_frame` 192px | 알파 bbox 크롭. 테두리 11px · 모서리 17px → **border-image-slice 30** |
| `slot_raw.png` | `slot_plate` 128px | 알파 bbox 크롭 |
| `monstera_raw.png` | `item_monstera` 256px | 알파 bbox 크롭 + 정사각 패딩 |
| `slot_raw.png` | **`bar_plate` 192px** | 알파 bbox 크롭 → 9-slice 균질화 → 베벨 대비 0.5배 |
| `button_raw.png` | **`chip_plate` 192px** | 위와 같음 + `#968F84` 곱하기 틴트 |
| `ui9_raw.png` | `icon_move`·`icon_cancel`·`icon_confirm` 128px | 3×3 시트 1행 |
| `ui9_raw.png` | `icon_light_sun`·`_half`·`_cloud` 96px | 3×3 시트 2행 |
| `ui9_raw.png` | `item_siru_open`·`_closed`·`item_beansprout` 128px | 3×3 시트 3행 |
| (없음) | `ring_spot`·`_ok`·`_no` 512×288 | **절차적** — 타원 링 + 글로우, 크레딧 0 |
| (없음) | `sheet_light` 288×96 · `sheet_mode` 384×128 | 위 아이콘을 가로로 이어 붙인 스프라이트 |

곱하기 틴트값: amber `#FFBA60` · slate `#4C485C` · sage `#B0D68A`.
슬레이트는 처음 `#6C6A7E` 로 뽑았다가 화면에서 다시 잡았다 — 밝아서 `.ghost` 가
주 버튼(`다음 날`)보다 눈에 띄었다. **버튼 위계는 색이 정한다, 크기가 아니다.**

전부 96색 양자화(FASTOCTREE)로 줄였다. 납품 파일 합계 **약 30KB** (줄이기 전 394KB).
평판·아이콘이라 화면에서 밴딩이 안 보이는 것을 실제로 확인하고 줄였다.

## 배경 키잉 규약 — 다음 창도 이대로 하면 된다

원화를 **순수 마젠타 `#FF00FF` 배경**으로 뽑아 두고 로컬에서 알파로 뺐다.
투명 PNG 를 직접 요청하는 것보다 결과가 깨끗하고, 다시 뽑느라 크레딧을 또 쓰지 않아도 된다.
디스필은 `min(r,b) > g` 인 픽셀만 건드린다 — 초록 잎·테라코타 화분은 걸리지 않는다.

`_raw/` 는 원본 보관용이다. **지우지 말 것** — 톤을 다시 맞출 때 재생성 없이 다시 뽑는다.

칸마다 마젠타 색조가 미세하게 다르게 나온다(`#FE01FC` ~ `#FF23FF`). 순수 마젠타 하나로
키잉하면 칸에 따라 테두리가 남는다. **칸별로 제일 흔한 색을 키 색으로 잡아야** 깨끗하다.

**★ 완전 투명 기준도 255 가 아니라 그 칸의 키 색이어야 한다** (초상화 창에서 밟음).
`알파 = (255 - 마젠타다움) / (255 - 문턱)` 으로 재면 `#FE01FC` 짜리 배경은
마젠타다움이 251 이라 알파가 2~3% 남는다. 낱장으로 보면 안 보이는데 어두운 UI
위에 얹으면 **네모난 판**으로 드러난다. 분모·분자의 255 를 `min(키r,키b) - 키g`
로 바꾸면 배경이 정확히 0 이 된다.

**칸을 1/3 로 자르지 말 것.** 생성기는 "칸 경계를 넘지 말라"고 못 박아도 인물을
경계 밖으로 삐져나오게 그리고, "구분선 넣지 말라"고 해도 검은 세로선을 그린다.
**연결 성분(scipy `label`)으로 나누면** 둘 다 저절로 해결된다 — 인물들은 화면에서
x 구간이 겹쳐도 서로 닿아 있지 않아 성분이 정확히 갈리고, 구분선은 따로 노는
작은 성분이라 큰 것 N개만 고르면 빠진다.

## 2차 납품 — 폰 세로(390×844 @2x) 배치·이동 UI

기준은 **디바이스 픽셀 = CSS × 2**. 아래 크기는 전부 디바이스 픽셀이다.

| 파일 | 크기 | 용도 | 붙이는 법 |
|---|---|---|---|
| `bar_plate.png` | 192² | 하단 액션 바 · 상단 상태 바 · 팝업 판 **공용** | `border-image: url() 23 fill / 23px` (CSS 로는 `11.5px`). 중앙색 `#433C33` |
| `chip_plate.png` | 192² | 바 안의 탭 가능한 칩/버튼 판 | `border-image: url() 16 fill / 16px` |
| `ring_spot.png` | 512×288 | 선택된 자리 링+글로우. 흰색 마스터 | 3D 위에 얹기. 색을 바꾸려면 `mask-image` + `background-color` |
| `ring_spot_ok.png` | 512×288 | 놓을 수 있는 자리(sage) | 위와 같음 |
| `ring_spot_no.png` | 512×288 | 못 놓는 자리(clay) | 위와 같음 |
| `icon_move/cancel/confirm.png` | 128² | 옮기기 · 취소 · 확인 | 낱장 |
| `sheet_mode.png` | 384×128 | 위 3개 가로 스프라이트 | `background-position: 0 / -128px / -256px` |
| `icon_light_sun/half/cloud.png` | 96² | 자리 밝기 해·반해·구름 | 낱장 |
| `sheet_light.png` | 288×96 | 위 3개 가로 스프라이트 | `background-position: 0 / -96px / -192px` |
| `item_siru_open/closed.png` | 128² | 콩나물 시루 열림·닫힘 | 인벤토리 슬롯 |
| `item_beansprout.png` | 128² | 콩나물 다발 | 인벤토리 슬롯 |

`ring_spot` 은 **바깥쪽으로만** 번지게 하고 가장자리 알파가 정확히 0 이 되도록 반지름을
캔버스의 0.375 로 잡았다. 처음엔 글로우가 안쪽까지 채워져 3D 위에서 **네모난 테**가
보였다. 오버레이는 가장자리 알파를 재고 넘겨야 한다.

바 판은 `slot_raw` 그대로 쓰면 베벨이 세서 **액자처럼 튄다**. 대비를 0.5배로 눌렀다.
화면 주인공은 3D 방과 식물이다.

기존 `crops/thumbs/beansprout_*.png` 는 46px 에서 흰 실오라기로만 읽혔다(보고된 대로).
새 `item_beansprout` 는 굵은 올리브 테두리가 있어 같은 46px 에서 형태가 남는다.

## 3차 납품 — 대화 초상화 6장 (`assets/characters/portraits/`)

**그림만 만들었다. CSS 배선은 하지 않았다** — `game.html` 은 코어 창 몫이다.

| 파일 | 크기 | 화자 | 표정 | 쓰이는 곳 |
|---|---|---|---|---|
| `portrait_jachwi_neutral.png` | 600×800 | 자취생 | 기본 | 대사 대부분 |
| `portrait_jachwi_happy.png` | 600×800 | 자취생 | 기뻐함 | 수확·성공 |
| `portrait_jachwi_worried.png` | 600×800 | 자취생 | 걱정 | 식물이 시들 때 |
| `portrait_moni_neutral.png` | 600×800 | 몬이 | 기본 | 안내 |
| `portrait_moni_excited.png` | 600×800 | 몬이 | 신남 | 칭찬 |
| `portrait_moni_sad.png` | 600×800 | 몬이 | 시무룩 | 식물이 안 자랄 때 |

- 전부 **3:4 · 투명 배경 RGBA**. 합계 약 240KB.
- **식물신 초상화는 없다.** `docs/first_play.md` §식물신 = "대사 한 줄, 외형 없음".
  화면에서는 빛·실루엣으로만 처리한다.
- 자취생은 **흉상**이라 아래·좌우가 프레임 밖으로 흘러나간다(의도). 몬이는
  잎·화분까지 **통째로** 들어가고 세 표정이 **같은 배율·같은 기준선**이다.
  몬이가 프레임을 다 안 채우는 것도 의도다 — 몬이는 0.375m 로 **작다**.
- 표정 교체는 파일만 바꾸면 된다. 세 장의 얼굴 위치가 같다.

원본 시트는 `portraits/_raw/*_raw.png` (3168×1344). `_raw/derive.py` 를 다시 돌리면
크레딧 없이 다시 자른다 — 규격이 바뀌면 `AR`·`DELIV_H` 만 고치면 된다.
3D 참조 렌더는 `portraits/_ref/` 에 있고 `_ref/render_ref.py` 가 GLB 에서 다시 뽑는다.
