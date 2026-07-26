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

## 파일 소유

| 창 | 소유 파일 |
|---|---|
| `growth` | `plant_grow.html` |
| `house` | `src/render3d/*` · `src/engine/*` · `data/house_rooms.json` · `_dli_probe.html` |
| `char` | `assets/characters/*` |
| `leaf` | `assets/monstera/*` |
| `plan` | `docs/*` · `data/characters.json` · `data/homes.json` |

**남의 파일은 함수 호출만.** 고쳐야 하면 handoff로 요청한다.
