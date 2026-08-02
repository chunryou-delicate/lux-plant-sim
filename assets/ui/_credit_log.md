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

**합계 10크레딧** (생성 5장). 호출 전 잔액 809 → 예상 잔액 799.

## 생성물에서 파생시킨 파일 — 추가 과금 없음

| 원본(`_raw/`) | 나온 파일 | 방법 |
|---|---|---|
| `icons_raw.png` | `icon_day` · `icon_food` · `icon_coin` · `icon_window` | 2×2 사분면 분할 → 96px |
| `button_raw.png` | `button_plate_amber` · `_slate` · `_sage` | 곱하기 틴트 3색 → 320×125 |
| `frame_raw.png` | `panel_frame` 192px | 알파 bbox 크롭. 테두리 11px · 모서리 17px → **border-image-slice 30** |
| `slot_raw.png` | `slot_plate` 128px | 알파 bbox 크롭 |
| `monstera_raw.png` | `item_monstera` 256px | 알파 bbox 크롭 + 정사각 패딩 |

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
