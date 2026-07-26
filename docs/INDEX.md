# 볕(byeot) · lux-plant-sim — 마스터 인덱스

> **최종 갱신 2026-07-26.** 이 파일 하나로 프로젝트 전체 맥락을 잡는다.
> 세부는 아래 raw 링크로 연다(WebFetch). 링크는 `main` 기준.

## 한 줄 정체
**"빛이 진짜"** — 물리 기반 실내 조도(lux/PPFD) 엔진 위에 얹은 저폴리 3D 식물 키우기.
엔진 하나에 껍데기 둘: **LUX·CAST**(`tool.html`, 조도 진단 도구) / **볕 게임**(현재 집중).

헌법: *얕게 누구나 / 깊게 덕후 · 엔진 먼저, 게임 항상 염두 · 데이터는 깊게 기본플레이는 단순 ·*
***한 번에 하나씩, 재미 확인 후 다음.***
타깃: 식집사(조명 전문가 아님). 리포 `chunryou-delicate/lux-plant-sim`.

---

# ★ 0. 창 구조 — 새 창이면 여기부터

작업은 **여러 창이 병렬로** 돈다. **남의 파일은 절대 직접 수정하지 않는다.**
`git add` 파일 지정으로는 못 막는 게 2026-07-26에 확인됐다(동시 편집으로 작업이 통째로 날아감).

| 창 | 담당 | 소유 파일 |
|---|---|---|
| **`plan`** | 기획·밸런싱 | `docs/*` (단 `docs/engine/` 제외) · **`data/balance/*`** — 코드 파일 0개 |
| **`growth`** | 생장 시뮬 | `plant_grow.html` |
| **`house`** | 집·방·조도 엔진 | `src/engine/*` · `src/render3d/*` · `data/*`(구조·에셋 정의) · `_dli_probe.html` · **`docs/engine/*`** |
| **`char`** | 캐릭터 | `assets/characters/*` |
| **`leaf`** | 잎·줄기·작물 에셋 | `assets/monstera/*` · 작물 에셋 |
| **`core`** ★신설 | **게임 루프** | `src/game/*` · `game.html` — **둘 다 아직 없다. 지금 착수 대상** |

> `index.html`은 **house 소유**다(3D 방 뷰어 = `src/main.js` 껍데기).
> core는 거기 얹지 말고 **`game.html`을 새로 만든다** — 한 파일 두 주인이 이번 충돌의 원인이었다.
> 착수 지시: **`handoff/plan-to-core.md`**

## 데이터가 둘로 갈린다

```
data/           house — 구조·에셋 정의 (house_rooms · 창틀/가구/조명/차광 프리셋)
data/balance/   plan  — 튜닝값 (characters · homes(경제) · light_thresholds* · growth_tuning*)
```
`*` = 코드가 경로로 읽고 있어 **소유 창이 "이동+경로수정"을 한 커밋으로** 처리 대기.

**빛 실측과 경제는 완전히 분리됐다**(2026-07-26) — 한 파일을 나눠 쓰지 않는다.

| | 어디 |
|---|---|
| 빛 실측 `peakDLI`·`slots`·`dark`·`avg7` | `data/house_rooms.json` → `rooms.{id}.measured` (house) |
| 경제 `rent`·`deposit`·`moveCost`·`utility` | `data/balance/homes.json` (plan) |

## 인계는 대화가 아니라 파일로

```
docs/handoff/{내창}-to-{상대창}.md
```
- 작업 시작할 때 `docs/handoff/*-to-{내창}.md` **먼저 읽는다**
- **받은 파일은 손대지 않는다.** 응답·처리표시는 **자기 방향 파일**에
- 커밋은 **파일 지정**. `git add .` 금지

→ 규칙 전문·파일 소유표: **`docs/handoff/README.md`**
https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/handoff/README.md

---

# ★ 1. 기획 정본

기획 논의는 **이 문서 하나를 고친다.** 나머지 기획 문서는 근거 보관용이다.

- **GAME_PLAN.md** — 캐릭터·시간·확률·경제·번식·연구자 통합
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/GAME_PLAN.md

---

# 2. 지금 상태 (2026-07-26)

## 되어 있는 것

| 축 | 상태 |
|---|---|
| **조도 엔진** | ✅ `src/engine/daylight_lux.js` — **`tool.html`과 게임이 같은 물리식을 공유**한다. 거리적응 샘플링·창 향·천창(3D 법선)·차광·실내 유리 감쇠 |
| **하루치 계약** | ✅ `daily_light/1` — 슬롯별 DLI·밴드·갈라짐·과광·전기요금을 하루 1회 객체 하나로 |
| **집/방** | ✅ 방 6종 · 창틀 39 · 가구 115 · 조명 24 · 차광 12 · 문 8 · 마감 27 · 유리 셰이더 · **슬롯 안정 ID** |
| **생장 엔진** | ✅ `plant_grow.html` — 몬스테라 3년(1095일) 프로시저럴. 이음새 없는 줄기 튜브, 잎↔엽초 일체화, 변이 발현 |
| **★ 빛 → 생장 연결** | ✅ `varieProb`·`matureProb` = f(DLI 7일평균, 변동계수). **조도가 실제로 확률을 움직인다** |
| **최소 루프 v0** | ✅ `plant_grow.html`에 **[다음 날]** — 날씨 굴림 → DLI → 생장 1틱 → 말 피드백 |
| **캐릭터** | ✅ 11종(여 6·남 5) + 마스코트 **몬이** · 표준 24본 리깅 · 모션 19종(128 클립) · 경량본 37 |
| **에셋** | ✅ 몬스테라 부품 22 + 스킨 104(잎·엽초·무늬종) · 포토스 26 · 원화 130 |

## 안 되어 있는 것

| | |
|---|---|
| **게임 루프** | ❌ `src/game/` 없음. 턴을 순서대로 도는 코어가 없다 |
| **경제** | ❌ 식비·월세 지출 코드 없음. 전기요금은 **계산만** 되어 계약에 실려 온다 |
| 물·온도·습도 | ❌ 계약 객체에 `null` 자리만 |
| 다개체 | ❌ `plant_grow.html`은 **한 그루 전용**(전역 상태) |

## 우선순위 — 지금 하나뿐

```
① ★ 최소 루프 재미 확인   ← 지금 유일한 우선순위
② A4 말 피드백 → 재미 확인선
③ 3단계 경제  ④ 4단계 번식(킬러)  ⑤ 스토리·가격표
```
**①이 끝날 때까지 나머지 숫자는 문서에만 기록하고 진행하지 않는다.**
*(기획서를 먼저 다 쓰면 엔지니어 함정 — 재미 확인이 항상 앞)*

---

# 3. 문서 지도

## 기획 (plan 소유 · `docs/`)

| 문서 | 내용 |
|---|---|
| **GAME_PLAN.md** | ★ **정본** |
| `handoff/README.md` | 창 규칙·파일 소유표 |
| **`game_flow.md`** | ★ **한 판이 어떻게 흘러가나** — 캐릭터×모드×초·중·후반 · 지루한 구간 |
| `balance_decisions.md` | **왜 그 숫자인지.** 값 바꾸기 전 필독 (모드별 판정 단위 §②′) |
| `env_difficulty_axis.md` | 시뮬 깊이 난이도축(빛→물→온도→습도) |
| `food_economy.md` · `sale_economy.md` | 지출(식비·콩나물) / 수입(삽수·실생·상점) |
| `researcher_track.md` · `time_modes.md` | 연구자 논문=재현성 / 시간 3모드 |
| `game_loop_spec.md` | 게임 루프 구현 명세(코어 인계용) |
| `crop_asset_direction.md` | 작물 10종 에셋 구조 |
| `게임기획_해야할것_v3.md` | 통합 전 원본 |

## 엔진 (house 소유 · `docs/engine/`)

조도 물리·회귀 기준선. **코드와 같이 움직인다.** (2026-07-26 이동 완료)

| 문서 | 내용 |
|---|---|
| `engine/light_contract.md` | ★ 계약 객체 `daily_light/1` 전문 · 밴드 정의 · 광주기 |
| `engine/rooms_progression.md` | 창 향 · 베란다 2겹 · 방별 실측 |
| `engine/greenhouse_plan.md` | 온실 차광·천창 실측 |
| `engine/lux_sampling.md` | 거리적응 샘플링 기준선 |

## 생장 엔진 근거

`몬스테라_생장로직_정밀.md` · `모듈형_식물성장.md` · `몬스테라_생장엔진_진행.md`

## 에셋·파이프라인

`byeot_asset_pipeline_master.md` · `asset_scale_convention.md` · `asset_sources.md` ·
`character_material_constraint.md` · `house_asset_direction.md` · `에셋창_전달_잎접합.md`

## 도구(LUX·CAST)

`tool_stopline.md` · `db_review_and_step5.md` · `byeot_cc_*.md` · `조도툴_TODO_정리.md`

---

# 4. 코드·데이터

## 실행 파일

| 파일 | |
|---|---|
| `plant_grow.html` | ★ 몬스테라 생장 생성기 + **최소 루프 [다음 날]** |
| `tool.html` | LUX·CAST 조도·적합성 도구 |
| `index.html` | 3D 게임뷰(집/방 렌더) |
| `_dli_probe.html` | 방별 DLI 실측 프로브 |
| `assets_index.html` · `assets_gallery.html` | 에셋 인덱스·갤러리 |

## 소스

```
src/engine/    daylight_lux.js(물리 핵심) · daily_light.js(계약) · daylight.js · lighting.js
src/render3d/  house.js · furniture*.js · window_frame.js · lighting_sim.js · character.js · scene.js …
src/game/      ❌ 아직 없음 — 게임 루프가 들어갈 자리
```

## 데이터

```
data/          house_rooms(방6) · window_presets(39) · furniture_presets(115) · door(8)
               lighting_presets(24) · shading_presets(12) · room_finishes(27) · frame_colors(13)
               plants.json(79종) · light_sources.json(10) · catalog.json(61)
data/balance/  characters.json · homes.json   ← plan 소유. README.md에 경계 설명
```

**에셋을 이름으로 찾으려면 `assets/manifest.json`** (한글명 `name_ko` 포함).

---

# 5. 에셋 현황

| | 수량 |
|---|---|
| 몬스테라 부품 GLB | **22** |
| 몬스테라 스킨(잎·엽초·무늬종) | **104** |
| 포토스 계열 | **26** |
| 캐릭터 3D | **11종** + 마스코트 몬이 / 경량본 37 |
| 모션 클립 | **19종** (캐릭터별 128 파일, 표준 24본이라 어느 캐릭터에나 붙음) |
| 집 GLB | 4 (대부분 절차적 생성) |
| 원화·참조 이미지 | **130** (`assets/existing/`) |

> 캐릭터 아틀라스는 **머티리얼 1장**이라 부위별 교체·모프가 불가능하다 →
> 마스크 텍스처로 우회. `character_material_constraint.md` 참고.

---

# 6. 규칙

- **큰 변경(새 문서·새 시스템·소유 변경)이 있으면 이 INDEX도 같이 갱신한다.**
  진입점이 낡으면 새 창이 몇 주 전 상태로 이해한다
- 값을 바꾸기 전에 `balance_decisions.md`를 읽는다. **왜 그 숫자인지가 거기 있다**
- 남의 파일은 handoff로 요청한다. **"붙일 수 있는 코드"** 형태로 써주면 소유 창이 적용한다

## 앱 raw (코드 공유용)
`https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/plant_grow.html`
`https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/tool.html`
