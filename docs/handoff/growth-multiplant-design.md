# 다개체 리팩터 설계 — growth 창

**2026-08-01 · 설계만. 착수는 core 요청 시점.**

`plant_grow.html`을 여러 그루가 각자 다른 슬롯 DLI를 받도록 바꾸는 방법.
core가 어댑터 형태를 협의하자고 했으므로 먼저 구조를 확정해 둔다.

---

## 조사 결과 — 지속 상태는 8개뿐이다

파일의 최상위 선언 78개를 전수 조사했다. 겁먹을 규모가 아니다.

| 분류 | 개수 | 비고 |
|---|---|---|
| 개체 상태로 보이는 것 | 11개 | |
| 그중 **매 빌드 재계산되는 파생값** | 5개 | 옮길 필요 없다 |
| **진짜 지속 상태** | **7개 + 그룹 1** | 이것만 개체 객체로 |
| 공용(모든 그루가 함께 씀) | 14개 | 그대로 둔다 |

### 파생값 — 개체 객체에 넣지 않는다

`buildPlant()` 도입부에서 매번 다시 만든다. 옮기면 오히려 두 곳이 어긋난다.

```js
rng = mulberry32(SEED)                        // SEED에서
seedColor() → PLANT_HUE·PLANT_SAT·PLANT_MID   // SEED에서
PLANT_AGE  = gf                               // GROWTH에서
PLANT_GROW = 1 + growAmt*…                    // GROWTH에서
PLACED·STEMS·USE_COUNT                        // 빌드 스크래치. 매번 초기화
SOIL_Y                                        // addPot()이 화분에서 계산
```

### 진짜 지속 상태 — 이것만 묶는다

```js
{ seed, day, slotId, dli, dliHist, propMode, vigor, group }
```

| 필드 | 지금 이름 | 비고 |
|---|---|---|
| `seed` | `SEED` | 개체성(모양·색) |
| `day` | `GROWTH` | 경과일 |
| `slotId` | `PLANT_SLOT` | 놓인 자리 |
| `dli` | `PLANT_DLI` | 오늘 빛 |
| `dliHist` | `DLI_HIST` | 최근 14일 |
| `propMode` | `PROP_MODE` | 번식 방식 |
| `vigor` | (v1에 생김) | 체력 |
| `group` | `plantGroup` | 이 그루의 THREE 그룹 |

---

## 방식 — 전역 교체(context swap). 함수 42개를 안 고친다

개체 상태를 만지는 함수가 **42개**다. 전부 인자를 받게 고치면 큰 수술이고
그만큼 버그가 들어온다. 그럴 필요가 없다 — **생장은 동기 처리**라서
"한 번에 한 그루씩" 굴리면 된다.

```js
const PLANTS = new Map();          // slotId → 개체 상태

function usePlant(id, fn){
  const p = PLANTS.get(id); if(!p) return null;
  // 개체 상태를 전역에 꽂는다
  SEED=p.seed; GROWTH=p.day; PLANT_SLOT=p.slotId; PLANT_DLI=p.dli;
  DLI_HIST.length=0; DLI_HIST.push(...p.dliHist);
  PROP_MODE=p.propMode; plantGroup=p.group;
  try { return fn(p); }
  finally {                        // ★ 예외가 나도 반드시 되돌린다
    p.seed=SEED; p.day=GROWTH; p.dli=PLANT_DLI;
    p.dliHist=DLI_HIST.slice(); p.propMode=PROP_MODE;
  }
}
```

**왜 이게 안전한가** — `buildPlant()`가 이미 매 호출마다 전역을 새로 세팅하고
`plantGroup`을 비웠다 다시 채운다. 즉 함수들은 원래부터 "지금 전역에 꽂힌 그루"를
그린다. 그루를 바꿔 꽂는 것뿐이다.

**한계** — 진짜 동시 실행은 안 된다(비동기 중간에 다른 그루를 꽂으면 깨진다).
지금 구조에 비동기 생장은 없고, 생길 이유도 없다. 생기면 그때 방식 C로 간다.

### 코어가 쓰는 모습

```js
addPlant({ slotId:'apartment-shelf-20:0', seed:92158, day:0 });
usePlant('apartment-shelf-20:0', () => { setDailyLight(report, 'apartment-shelf-20:0'); nextDay(); });
usePlant('banjiha-floor-3:1',    () => { setDailyLight(report, 'banjiha-floor-3:1');    nextDay(); });
```

**기존 호출부는 안 바뀐다.** `setDailyLight`·`nextDay`·`vigor` 전부 그대로다.
한 그루만 쓸 때는 `usePlant` 없이 지금처럼 부르면 된다(기본 개체 하나를 자동으로 둔다).

---

## 고려했다가 접은 것

| 방식 | 왜 접었나 |
|---|---|
| **A. 함수 42개에 `plant` 인자 추가** | 수술 범위가 크고 그만큼 버그가 들어온다. 얻는 건 "동시 실행"인데 필요가 없다 |
| **C. 파일 전체를 팩토리로 감싸기** | 개체 코드와 공용 코드가 파일 전체에 섞여 있어 가르는 것 자체가 큰 작업이다. ES 모듈로 낼 때 같이 하는 게 맞다 |

**C는 버리는 게 아니라 나중 것이다.** core가 `import { createPlant }` 형태를 원하면
그때 A/C를 한 번에 한다 — 그전까지는 B로 충분하다.

---

## 착수 조건

- core가 **실제로 화분을 둘 이상 굴리기 시작할 때.** 그전에 하면 쓰이지 않는 구조를 만들게 된다
- 착수하면 `growth-to-core.md`에 어댑터 형태를 먼저 적고 시작한다

## 같이 해야 할 것

- **`vigor`도 같은 객체에 넣는다.** v1에서 체력을 만들 때 이 리팩터가 이미 있으면 바로 들어간다.
  순서가 반대면 vigor를 전역으로 만들었다가 다시 옮기는 두 번 일이 된다
- 개체가 여럿이면 **`PET_COLOR`·`PET_AXIS` 캐시는 공용으로 둔다** — 에셋 단위라 그루와 무관하다

## 미리 알아둘 함정

- **`DLI_HIST`가 `const` 배열이다.** 참조를 바꿀 수 없으니 `length=0` + `push(...)`로 갈아야 한다.
  `DLI_HIST = p.dliHist` 로 쓰면 조용히 안 먹는다
- **`plantGroup`은 `let`이라 갈아 끼울 수 있다.** 다만 scene에서 뗐다 붙이지 말고
  **개체마다 그룹을 만들어 scene에 계속 두고** 참조만 바꾼다. 안 그러면 다른 그루가 화면에서 사라진다
- `buildPlant()`가 `clearGroup(plantGroup)`으로 **그 그룹만** 비우므로 다른 그루는 영향받지 않는다
