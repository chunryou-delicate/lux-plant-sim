# 2종째 작물 — 무순 (2026-08-05 · 코어 창)

> 박사님: *"하나더 돌려서 추가 식비도움식물 한두개 추가해"*
> **한 개만 넣었다.** 두 개째는 끼니 상한이 막는다 — 아래 §3.

**수치·근거·재현표의 정본은 [`docs/food_economy.md` §10](../food_economy.md) 이다.**
이 문서는 **다른 창이 붙여야 할 것**만 적는다.

---

## 1. 무엇이 들어왔나

| | 값 |
|---|---|
| 작물 | **무순** (`musun`) — 빛이 콩나물과 **정반대**다. 밝아야 3끼 |
| 주기 | **7일** (콩나물 5일과 서로소 → 거두는 날이 엇갈렸다 겹쳤다 한다) |
| 회전당 절감 | **2,000원** — 새로 정한 값이 아니라 `cropKindSavedWon[1]` 의 빈자리를 채운 것 |
| 씨앗 | `radish_seed` 400원 (사는 값 600원) |
| 용기 | `sprout_tray` 3,000원 (사는 값 4,200원) |

**3종은 안 넣었다** — 자취생 끼니 상한(2끼 = 5,000원)에 2종이 **정확히** 닿는다.
3종째는 하루 저감을 한 푼도 못 늘린다(6,000 > 5,000). 표의 1,000원 자리는 남겼다:
상한이 1인당이라 가장·주부(식구 4)는 20,000원이고 거기서는 산다.

---

## 2. ★ 화면(game.html)에 붙일 것 — **이 창이 안 건드렸다**

코어는 전부 준비됐다. `opt.kind` 만 넘기면 된다.

| 하는 일 | 부르는 함수 | 비고 |
|---|---|---|
| 재배판 놓기 | `setCropAt(S, at, { kind: 'musun', ... })` | 없으면 콩나물(옛 동작 그대로) |
| 물 주기 | `waterCrop(S, { kind: 'musun' })` · `{ all: true }` | **종류마다 따로 시작한다** — 이게 시차의 손이다 |
| 다시 심기 / 판 늘리기 | `resowCrop(S, { kind: 'musun', sirus: n })` | 씨앗·용기 재고를 작물이 정한 품목에서 뺀다 |
| 거두기 | `harvestCrop(S, io)` — **그대로** | 익은 것을 종류 가리지 않고 다 거둔다 |

**새로 생긴 상태 칸** (둘 다 배열이고 순서는 콩나물 → 무순):

```
turn.cropWater.byKind[]    { kind, kindKo, needsWater, waiting, idleIds, idleDays,
                             startedToday, placed, sirus, ageDays, harvestDays, wateredOnDay }
turn.cropHarvest.byKind[]  { kind, kindKo, ready, readyCount, readyIds, placed, harvested,
                             ageDays, harvestDays, daysLeft, nextReadyInDays, growingCount,
                             harvestedCount, idleCount, sirus, cycle }
harvestCrop() 반환 .byKind[]  { kind, kindKo, pots, savedWon }
perPot[].kind / .kindKo       시루 한 칸이 어느 작물인가
```

⚠ **옛 칸은 안 깨진다.** `cropWater.sirus`·`ageDays`·`harvestDays`·`cycle` 은 여전히
**콩나물 값**이다(화면이 "시루 N개 · N/5일"을 그 칸으로 그린다). 대신
`ready`·`canHarvest`·`needsWater`·`readyCount`·`idleCount` 는 **종류를 다 세어** 낸다 —
안 그러면 무순이 익어도 [수확하기]가 안 켜진다.

**상점**은 손댈 것이 없다. `catalogList()` 에 `radish_seed`·`sprout_tray` 가 자동으로 실린다.

---

## 3. ★ 3D (room_view.js) — **에셋은 이미 다 있다.** 배선만 남았다

`room_view.buildPlantGroup` 이 아는 kind 가 `monstera`·`beansprout` 둘뿐이다(805행 근처).
**이 창은 room_view.js 를 안 건드렸다.** 지금은 무순 자리가 시루로 그려진다.

필요한 것 — `assets/manifest.json` 에 **이미 있는 것들**이다. 새로 만들 것이 없다:

| 쓸 것 | manifest id | 파일 | 크기(m) |
|---|---|---|---|
| 무순 몸통 소/중/대 | 428 / 430 / 432 | `sprout_radish_{s,m,l}.glb` | 0.015 / 0.028 / 0.044 (w) |
| 용기(재배판) | 440 | `container_tray_s.glb` | **0.36 × 0.055 × 0.24** |

배선 지점 셋:
1. `buildPlantGroup` 에 `kind === 'musun'` 가지 — 시루 대신 `container_tray_s`,
   몸통은 `sprout_radish_{s,m,l}` (콩나물과 **같은 단계 규칙**을 쓰면 된다).
2. `SIRU_D`(1386행·4764행) 옆에 `TRAY_D` — 재배판은 **정사각이 아니다**(0.36 × 0.24).
3. `state.placedItems(S)` 가 이제 `crop_kind` 를 같이 싣는다 — 그걸 보고 가르면 된다.

★ **크기가 문제다** — [`food_economy.md` §10.7](../food_economy.md) 참고.
재배판 0.36 m 는 창턱(`maxPotD` 0.21)·선반(0.25)에 **안 올라간다.**
지금 코드는 안 막지만(`placeCrop` 은 `maxPotD` 를 안 본다 — 자유 좌표로 놓인다),
추천 자리 목록에는 안 뜬다. **작은 재배판(0.20 안팎)을 만들지 말지는 기획 판단**이라
이 창이 안 정했다.

---

## 4. 이름을 안 바꿨다 — `fp.beansprout` 은 이제 **0번 자리**라는 뜻이다

종류가 늘었으니 `beansprout` 은 계통 전체의 이름으로는 거짓말이다. 그래도 안 바꿨다:

1. **세이브가 그 이름이다.** `save.packFirstPlay` 가 `firstPlay.beansprout.*` 를 칸마다
   이름으로 검증하며 적는다. 바꾸면 옛 판이 안 열리고, 열리게 하려면 이전(migration)
   코드를 또 만들어야 하는데 그건 이 일이 사려던 값이 아니다.
2. **화면이 그 이름을 읽는다.** `game.html`·`room_view.js` 가 `fp.beansprout.ageDays` 를
   직접 읽는데 **그 두 파일은 이 창 소유가 아니다.** 바꾸면 내가 못 고치는 파일이 깨진다.
3. 바꿔서 얻는 것이 **읽기 편함뿐**이다. 셈도 규칙도 한 줄 안 나아진다.

⇒ 대신 창구를 하나 뒀다. **새 코드는 이것만 쓴다:**

```js
cropSites(fp)          // 모든 작물 자리 (0번 = 콩나물, 순서 = CROP_KINDS 순서)
cropSiteOf(fp, kindId) // 그 종류의 자리 (없으면 null)
```

`fp.crops` 는 **1번부터의 자리들**이다(0번은 안 들어 있다). 옛 세이브에는 이 칸이 없고,
없으면 새 상태가 만든 **빈 자리**가 그대로 남는다 = 옛 판이 그대로 열린다.
안 산 재배판이 공짜로 생기지 않는 것까지 재 봤다.

---

## 5. 검사

| | |
|---|---|
| `test_first_play` · `_attacks` · `test_save` · `test_loop_errors` · `test_tutorial` · `test_fastforward` | PASS |
| `test_propagation` · `test_free_place` · `test_roomview_place` | PASS |
| `test_banjiha_routes` | **PASS** (경로 C 40/40 · A·B 31/40 — 손대기 전과 같다) |

⚠ 손대기 전 기준선에서는 `test_banjiha_routes` 가 **FAIL 2건**이었다
(`E 값 — 잎 2장 이하…` · `H-1 확정 무늬는 플레이어가 한 일에 붙는다`).
둘 다 상점 값·확정 무늬 쪽이라 작물과 무관하고, 같은 시각에 `shop.js`·`propagation.js` 를
고치던 다른 창이 있었다. **이 창이 고친 것이 아니다** — 지금 PASS 인 것은 그쪽 덕이다.
