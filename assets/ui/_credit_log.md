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
| 2026-08-03 | portrait-3 | higgsfield | nano_banana_pro | 자취생 여 시트 — 화풍 탐색 2장 · 머리띠 나와 폐기 | 2 | 4 |
| 2026-08-03 | portrait-3 | higgsfield | nano_banana_pro | 자취생 남 시트 — 목 늘어나고 마젠타 번져 폐기 2장 | 2 | 4 |
| 2026-08-03 | portrait-3 | higgsfield | nano_banana_pro | 안 끝나고 매달린 작업 2건 — 다시 걸어야 했다 | 2 | 4 |
| 2026-08-03 | portrait-3 | higgsfield | nano_banana_pro | 덤 남자 시트 — 얼굴만 크게 나와(몸통 없음) 폐기 | 1 | 2 |
| 2026-08-03 | portrait-3 | higgsfield | nano_banana_pro | **몬이 2×2 시트 1장 = 4표정** `v3_moni_raw` | 1 | 2 |
| 2026-08-03 | portrait-3 | higgsfield | nano_banana_pro | **자취생 여 A·B 시트 = 6표정** `v3_jachwi_f_{a,b}_raw` | 2 | 4 |
| 2026-08-03 | portrait-3 | higgsfield | nano_banana_pro | **자취생 남 A·B 시트 = 6표정** `v3_jachwi_m_{a,b}_raw` | 2 | 4 |
| 2026-08-03 | portrait-3 | higgsfield | nano_banana_pro | **덤 C 시트 여·남 = 6표정**(think·proud·blank) | 2 | 4 |

**합계 48크레딧** (생성 24장). 잔액 809 → 799 → 797 → 791 → 783 → **753**.

3차(대화 초상화 화풍 확정본)는 **생성 15장 30크레딧**으로 **납품 22장**을 만들었다.
쓸모없이 태운 것은 **14크레딧(7장)** — 화풍 탐색 2, 남자 해부 2, 덤 프레이밍 1,
그리고 **끝나지 않은 작업 2**. 생성기가 이따금 `in_progress` 로 멈춰 있는다.
같은 요청을 다시 걸면 대개 1분 안에 나온다. **크레딧은 그대로 나간다** — 창을
띄워 두고 기다리지 말고 다시 걸되, 로그에는 두 번 다 적어야 잔액이 맞는다.

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

## 4차 납품 — 확정 화풍으로 다시 뽑은 초상화 22장

박사님이 화풍 1번·2번을 고르셨다. 이 두 장을 **참조 이미지로 넣어** 다시 뽑았다.
말로 묘사하는 것보다 훨씬 정확하다. 1차 6장은 `portraits/_old/` 로 옮겨 두었다.
**CSS 배선은 하지 않았다** — `game.html` 은 코어 창 몫이다.

| 인물 | 파일 | 표정 |
|---|---|---|
| 자취생 여 | `portrait_jachwi_*.png` | neutral · worry · cry · surprise · happy · tired **+덤** think · proud · blank |
| 자취생 남 | `portrait_jachwi_m_*.png` | 위와 같은 9키 |
| 몬이 | `portrait_moni_*.png` | neutral · excited · sad · curious |

전부 600×800 · 3:4 · 투명 RGBA, 합계 약 1.0MB. 자르는 것은 `_raw/derive3.py`.
확인용 대조 시트는 `portraits/_style/_contact3_{dark,light}.png`,
전체 비교 페이지는 `portraits/_style/compare.html`.

### 밟은 함정 넷 — 다음 창은 피해 가라

**★ 참조에 있는 것은 결과에 나온다.** 화풍 1번은 3D 저폴리의 머리 하이라이트를
물려받아 **정수리에 회색 띠**가 있었다. 프롬프트로 "머리띠 그리지 말 것"을 아무리
박아도 소용없었다(세 번 연속 나왔다). **참조 이미지에서 띠를 지워서 올리니** 한 번에
사라졌다. 2차 창의 "참조가 잘려 있으면 결과도 잘린다"와 같은 이야기다.
지우는 코드는 `_ref/make_ref_in.py` 의 `deband()`.

**★ 흉상 시트는 연결 성분만으로 안 갈린다.** 2차는 "1/N 로 자르지 말고 연결 성분으로"
였는데, 3차는 크롭이 타이트해져 세 인물의 **옷자락이 시트 아래에서 서로 닿는다.**
그러면 `label` 이 셋을 한 덩어리로 묶는다. 정확히 1/3 로 자르면 머리가 잘린다.
**열별 전경 화소 수의 골짜기**를 기대 경계 ±12% 안에서 찾아 자르면 둘 다 해결된다
(실측 골짜기는 1344 중 0~134px).

**★ 키 색을 조각 전체의 최빈색으로 잡으면 안 된다.** 흉상 크롭이 타이트하면 제일 흔한
색이 마젠타가 아니라 **크림색 티셔츠**다. 티셔츠를 배경으로 알고 인물을 통째로
지워 버린다(두 장이 그렇게 날아갔다). **인물 마스크 바깥 화소 중 최빈색**으로 재야 한다.

**★ 시트가 둘이면 bbox 폭으로 배율을 맞추면 안 된다.** 인물이 크게 그려진 시트는
머리카락이 칸 경계에 닿아 bbox 폭이 **칸 너비로 잘려** 시트가 달라도 같은 값이 나온다.
**정수리에서 일정 비율 내려간 지점들의 가로폭 중앙값**(`head_width`)을 쓰면 안 잘린다.
실측으로 여 A 시트가 여 B 보다 0.91 배 작게 그려져 있었고, 이걸로 잡았다.

남자는 첫 시도에서 **목이 기린처럼 늘어나고** 어깨 둘레로 **마젠타가 인물 안까지**
배어 나왔다. 프롬프트에 "보통 길이의 짧은 목 · 크루넥 · 인물 안에 분홍이 없을 것"을
박아 고쳤다. 버린 판은 `_raw/_bad_jachwi_m_neck.png` 로 남겼다.
