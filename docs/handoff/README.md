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
2. 처리한 항목은 그 파일에 **`[처리됨]`** 표시를 단다 (지우지 말 것 — 기록이다)
3. 커밋은 **파일 지정**. `git add .` 금지 — 창이 여럿이라 남의 작업이 딸려 들어간다

## 파일 소유 (박사님 확정 2026-07-26)

| 창 | 소유 파일 |
|---|---|
| `growth` | `plant_grow.html` |
| `house` | `src/engine/*` · `src/render3d/*` · `data/house_rooms.json` 등 방·가구 데이터 · `_dli_probe.html` |
| `char` | `assets/characters/*` |
| `leaf` | `assets/monstera/*` · 잎·작물 에셋 |
| **`plan`** | **`docs/*` 만. 코드 파일 0개.** |

**남의 파일은 절대 직접 수정 금지.** `git add` 파일 지정으로는 못 막는다는 게
2026-07-26에 확인됐다(동시 편집으로 작업이 통째로 날아감).
필요하면 handoff에 **"붙일 수 있는 코드"** 형태로 써주고 **소유 창이 적용한다.**

### `data/*.json` — 밸런싱 값은 plan이 고친다

`plan`이 코드 파일을 0개로 유지하려면 **밸런싱 숫자가 JSON에 있어야 한다.**
그래서 데이터는 성격으로 가른다:

| 종류 | 파일 | 소유 |
|---|---|---|
| **밸런싱 값** (기획이 정하는 숫자) | `characters.json` · `homes.json`의 경제 필드 · `light_thresholds.json` · (신설 예정) `growth_tuning.json` | **plan** |
| **구조·실측 값** (엔진이 만드는 숫자) | `house_rooms.json` · `window_presets` · `furniture_presets` · `homes.json`의 `peakDLI`·`slots` | **house** |

> `homes.json`은 **한 파일을 둘이 나눠 쓴다.**
> plan = `rent`·`deposit`·`moveCost`·`utility`·`notes` / house = `peakDLI`·`slots`(실측으로 덮어씀).
> 서로의 필드를 건드리지 않는다.

**임계값·계수가 아직 코드 안에 있으면 handoff로 JSON 외부화를 요청한다.**
그게 이 충돌의 근본 해결이다.
