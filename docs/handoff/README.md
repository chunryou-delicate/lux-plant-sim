# 창 간 인계 규칙

박사님이 창 사이를 복붙하지 않게 하려는 것. **넘길 건 대화 말고 파일로.**

## 파일 이름

```
docs/handoff/{내창}-to-{상대창}.md
```

창 이름: `growth`(생장시뮬) · `leaf`(잎·줄기) · `char`(캐릭터) · `house`(집·가구) · `plan`(기획)

## 형식

```markdown
# 2026-07-26 · plan → growth

## 요청 / 보고
(무엇을 왜)

## 인터페이스
```js
// 붙여 쓸 수 있는 코드블록
```

## 미해결
- [ ] ...
```

## 절차

1. **작업 시작할 때** `docs/handoff/*-to-{내창}.md` 를 먼저 읽는다
2. **★ 받은 인계 파일은 손대지 않는다.** 응답은 **자기 방향 파일**에 쓴다
   ```
   plan → house 요청 ·처리표시 : plan-to-house.md   (plan이 씀)
   house → plan 보고 ·처리보고 : house-to-plan.md   (house가 씀)
   ```
   상대가 보고를 올리면 **읽고 내 파일에** `[처리됨]`을 표시하거나 지운다.
   (남의 파일에 직접 표시하면 그것도 무단 편집이다 — 2026-07-26 보완)
3. 커밋은 **파일 지정**. `git add .` 금지 — 창이 여럿이라 남의 작업이 딸려 들어간다
4. **파일 이동은 소유 창이 한다.** 코드가 경로로 읽는 파일은
   *이동 + 경로 수정*을 **한 커밋**으로 처리해야 무중단이다.
   남의 코드가 읽는 파일이면 옮기지 말고 handoff로 요청한다

## 파일 소유 (박사님 확정 2026-07-26)

| 창 | 소유 파일 |
|---|---|
| `growth` | `plant_grow.html` |
| `house` | `src/engine/*` · `src/render3d/*` · `data/*`(구조·에셋 정의) · `_dli_probe.html` · **`docs/engine/*`** |
| `char` | `assets/characters/*` |
| `leaf` | `assets/monstera/*` · 잎·작물 에셋 |
| **`plan`** | **`docs/*`**(`docs/engine/` 제외) · **`data/balance/*`**. 그 외 코드 파일 0개. |

### docs 분할 (2026-07-26)

| 폴더 | 소유 | 왜 |
|---|---|---|
| `docs/engine/` | **house** | 조도 물리·회귀 기준선. **코드와 같이 움직여야 한다** |
| | | `light_contract` · `lux_sampling` · `greenhouse_plan` · `rooms_progression` |
| `docs/` 나머지 | **plan** | 기획. `balance_decisions` · `env_difficulty_axis` 포함 |

**남의 파일은 절대 직접 수정 금지.** `git add` 파일 지정으로는 못 막는다는 게
2026-07-26에 확인됐다(동시 편집으로 작업이 통째로 날아감).
필요하면 handoff에 **"붙일 수 있는 코드"** 형태로 써주고 **소유 창이 적용한다.**

### ★ `data/balance/` — 튜닝값은 plan (2026-07-26 신설)

`plan`이 코드 파일을 0개로 유지하려면 **밸런싱 숫자가 JSON에 모여 있어야 한다.**
폴더로 갈랐다:

```
data/           house — 구조·에셋 정의 (house_rooms · 프리셋류 · shading_presets)
data/balance/   plan  — 튜닝값
                  characters.json · homes.json(경제 필드)
                  light_thresholds.json · growth_tuning.json   ← 이동 대기
```

> `homes.json`은 **한 파일을 둘이 나눠 쓴다.**
> plan = `rent`·`deposit`·`moveCost`·`utility`·`notes` / house = `peakDLI`·`slots`(실측으로 덮어씀).
> 서로의 필드를 건드리지 않는다.

**임계값·계수가 아직 코드 안에 있으면 handoff로 `data/balance/` 외부화를 요청한다.**
그게 이 충돌의 근본 해결이다. 자세한 현황은 `data/balance/README.md`.
