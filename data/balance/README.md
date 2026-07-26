# data/balance/ — 튜닝값 (plan 소유)

**밸런싱은 이 폴더만 고친다.** 코드 파일을 열 이유가 없어야 한다.

| 파일 | 내용 |
|---|---|
| `characters.json` | 캐릭터 다이얼 — 시작자금·수입·식구수·전기면제·목표 |
| `homes.json` | 집값·월세·보증금·이사비 **(경제 필드만 plan)** |
| `light_thresholds.json` | DLI 밴드 임계값 · 무늬종 계수 · 광주기 밴드 *(이동 대기 — 아래)* |
| `growth_tuning.json` | 생장 확률 곡선 *(이동 대기 — 아래)* |

## 경계

- `data/` (상위) = **house 소유**. 구조·에셋 정의(`house_rooms.json`·프리셋류)
- `data/balance/` = **plan 소유**. 기획이 정하는 숫자
- `homes.json`은 **한 파일을 둘이 나눠 쓴다**
  - plan: `rent` · `deposit` · `moveCost` · `utility` · `notes`
  - house: `peakDLI` · `slots` ← **실측으로 덮어씀. plan은 건드리지 않는다**

## 아직 안 옮긴 것

`light_thresholds.json` · `growth_tuning.json`은 **코드가 경로로 읽고 있어**
plan이 혼자 옮기면 그 사이 깨진다.

| 파일 | 읽는 곳 | 소유 창 |
|---|---|---|
| `light_thresholds.json` | `src/main.js:28` · `_dli_probe.html:16` | house |
| `growth_tuning.json` | `plant_grow.html` | growth |

→ **각 소유 창이 "파일 이동 + 경로 수정"을 한 커밋으로** 처리한다(무중단).
요청은 `docs/handoff/plan-to-house.md` · `plan-to-growth.md` 에 나가 있다.

## 값을 고치기 전에

**왜 그 숫자인지가 `docs/GAME_PLAN.md`에 있다.** 근거를 안 보고 고치면
설계가 조용히 깨진다 — 실제로 아파트 갈라짐 마진이 그렇게 깨졌다(GAME_PLAN §6).
