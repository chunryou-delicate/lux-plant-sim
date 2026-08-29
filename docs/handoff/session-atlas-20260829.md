# 세션 지도 — 누가 무엇을 쥐고, 무엇이 어디로 흐르나

**2026-08-29 · 총괄(claude-64) 작성**
`docs/handoff/team-map.md`(규약)와 `multi-session-ops.md`(운영)의 **그림판**이다.
저 둘이 「무엇을 지켜야 하나」를 적고, 이 문서는 **「지금 누가 어디에 서 있나」**를 그린다.

---

## 0. 한 장으로

```mermaid
graph TB
    U["👤 박사님<br/>결정 · 실제 플레이 · 최종 판단"]
    M["🎯 총괄 claude-64<br/>중계 · 계율 관리 · 우선순위"]

    U <==> M

    subgraph M2["만드는 창"]
        CORE["⚙️ core / claude-60<br/>게임 코어 · 헤드리스 하네스"]
        GROW["🌱 growth / claude-8e<br/>생장 · 조도 · 작물 품질"]
        HOUSE["🏠 House / claude-6e<br/>집 · 방 · 가구 · 조도 시뮬"]
    end

    subgraph M3["정하는 창 · 그리는 창"]
        PLAN["📐 Plan / claude-78<br/>기획 · 문안 · 밸런스 판단"]
        CHAR["🧍 Char / claude-0c<br/>캐릭터 에셋 · 도구"]
        LEAF["🍃 leaf / claude-db<br/>잎·줄기 에셋 ⚠ 무응답"]
    end

    M --> CORE & GROW & HOUSE & PLAN & CHAR
    M -.- LEAF

    PLAN <-.직접.-> CORE
    GROW <-.직접.-> HOUSE
    GROW <-.직접.-> PLAN
    CHAR <-.직접.-> PLAN

    style U fill:#4a3b1a,stroke:#d9a441,stroke-width:3px,color:#fff
    style M fill:#1a3a4a,stroke:#4aa3d9,stroke-width:3px,color:#fff
    style LEAF fill:#3a2020,stroke:#a04040,stroke-dasharray:5 5,color:#fff
```

> ★ **점선은 「창끼리 직접」이다.** 2026-08-27 §2.9 ㊺ 이후 **권장**으로 바뀌었다 — 까닭은 §4.

---

## 1. 세션별 상세

### ⚙️ core — `claude-60`

| | |
|---|---|
| **소유** | `src/game/*` · `game.html` · `tools/night_play.mjs` · `tools/probe_*`(코어 것) |
| **하는 일** | 게임 코어 구현 · **헤드리스로 판을 실제로 굴려** 튜토가 끝나는지 잰다 |
| **쓰는 자** | CDP(Chrome DevTools Protocol) — 브라우저를 열어 누르고 끌고 찍는다 |
| **못 하는 것** | 밸런스 값 변경(박사님 승인) · 남의 파일 |
| **자의 한계** | ⚠ **CDP 터치는 「진짜 손짓 처리」를 안 지나간다** — 폰에서만 나는 병은 못 잡는다 |

```mermaid
graph LR
    A["night_play.mjs<br/>판을 굴린다"] --> B["game.html<br/>실제 게임"]
    B --> C["기록<br/>지갑·잎·무늬·수확"]
    C --> D["표<br/>「며칠에 얼마」"]
    D -.->|밸런스 판단| P["Plan"]
    D -.->|박사님 결정 필요| M["총괄"]
    style A fill:#1a2a3a,color:#fff
    style D fill:#2a3a1a,color:#fff
```

---

### 🌱 growth — `claude-8e`

| | |
|---|---|
| **소유** | `plant_grow.html`(생장 형태 · 조도 관문 · 단계 계약) · `tools/probe_*`(생장 것) |
| **하는 일** | 「잎이 언제 나나」 · 「자리마다 몇 그램인가」 · 「등이 무엇을 하나」를 **잰다** |
| **안 하는 것** | ⛔ **잰 수에 «뜻»을 붙이지 않는다** — 그건 Plan 몫 |
| **막힌 것** | 원룸(박사님 「반지하 먼저」) · C7 바닥 조도 계약(House와 짝) |

**이 창이 낸 것 중 판을 바꾼 표**

```mermaid
graph TB
    G["growth 실측"]
    G --> G1["등 0→1<br/>몬스테라 유효 19일 → 405일"]
    G --> G2["3단 선반<br/>500 / 350 / 200g"]
    G --> G3["반지하는 등 셋을 사도<br/>밝기 문턱에 못 닿는다"]

    G1 --> R1["★ 「등이 곧 길」이<br/>수로 확인됨"]
    G2 --> R2["★ 한 가구에서<br/>배우고·잃고·되찾는다"]
    G3 --> R3["★★ 반지하는 살리고<br/>원룸은 값을 매긴다<br/>= 이사의 까닭"]

    style R3 fill:#3a2a1a,stroke:#d9a441,stroke-width:2px,color:#fff
```

---

### 📐 Plan — `claude-78`

| | |
|---|---|
| **소유** | `docs/*`(engine 제외) · `data/balance/*` · `data/growth_tuning.json` |
| **하는 일** | 문안 · 뜻 · 밸런스 **판단**. ⛔ 코드는 한 줄도 안 만진다 |
| **연속 기록** | **판정에 쓰이는 값 변경 «0»** — 나흘째 |
| **막힌 것** | 없음(박사님 답이 다 옴) |

**이 창이 세운 갈래들**

```mermaid
graph TB
    subgraph S1["말이 낡는 방식"]
        A1["규칙을 말한 줄<br/>→ 안 낡는다"]
        A2["값을 말한 줄<br/>→ 낡는다"]
        A3["★ 값에서 «나온» 말<br/>→ 낡아도 티가 안 난다"]
    end
    subgraph S2["문서가 낡는 방식"]
        B1["화면을 «가리키는» 것<br/>→ 따라 고쳐진다"]
        B2["★ 셈을 «담은» 것<br/>→ 혼자 낡는다"]
    end
    subgraph S3["막다른 길"]
        C1["되돌릴 수 있다<br/>→ 배움"]
        C2["★ 못 되돌린다<br/>→ 벌"]
    end
    style A3 fill:#3a2a1a,color:#fff
    style B2 fill:#3a2a1a,color:#fff
    style C2 fill:#3a2020,color:#fff
```

---

### 🏠 House — `claude-6e`

| | |
|---|---|
| **소유** | `src/render3d/*` · `src/engine/*` · `data/house_rooms.json` · `docs/engine/*` · `tools/serve.py` |
| **하는 일** | 방·가구·창호 · **조도 시뮬** · 정적 프로필 |
| **안 만지는 것** | ⛔ `src/game/*` · `game.html` (core 것) |
| **검사** | `run_house_checks.mjs` — 지금 **초록 4 · 붉음 3** (셋 다 「프로필로 풀릴 게 아닌 것」) |

---

### 🧍 Char — `claude-0c`

| | |
|---|---|
| **소유** | `assets/characters/*` · `assets/derived/*` · `tools/char/*` |
| **하는 일** | 캐릭터 GLB 8종 · 모션 128클립 · 대화 초상화 22장 |
| **크레딧** | 잔액 **4,475** (오늘 27 사용) |
| **닫은 것** | 3D 얼굴 표정 — ⛔ **폰에서 이목구비가 0픽셀**이라 값이 없다(본인 판단) |

---

### 🍃 leaf — `claude-db` ⚠

| | |
|---|---|
| **상태** | **점호 무응답 · 나흘째** |
| **대기 중인 결정** | C1 식물등 실루엣(ⓐ+ⓑ) · C2 그대로 · C3 민트로 · C4 말린 새순 |
| **⚠ 위험** | 박사님이 답을 주셨는데 **받을 창이 없다** |

---

## 2. 소유 지도 — 파일이 누구 것인가

```mermaid
graph TB
    ROOT["lux-plant-sim/"]

    ROOT --> SG["src/game/*<br/>game.html"]
    ROOT --> PG["plant_grow.html"]
    ROOT --> SE["src/engine/*<br/>src/render3d/*"]
    ROOT --> DOCS["docs/*"]
    ROOT --> DB["data/balance/*"]
    ROOT --> DH["data/house_rooms.json"]
    ROOT --> AC["assets/characters/*"]
    ROOT --> AL["assets/(잎·줄기)"]

    SG --> CORE["⚙️ core"]
    PG --> GROW["🌱 growth"]
    SE --> HOUSE["🏠 House"]
    DH --> HOUSE
    DOCS --> PLAN["📐 Plan"]
    DB --> PLAN
    AC --> CHAR["🧍 Char"]
    AL --> LEAF["🍃 leaf ⚠"]

    style CORE fill:#1a2a3a,color:#fff
    style GROW fill:#1a3a1a,color:#fff
    style HOUSE fill:#2a2a3a,color:#fff
    style PLAN fill:#3a2a1a,color:#fff
    style CHAR fill:#2a1a3a,color:#fff
    style LEAF fill:#3a2020,stroke-dasharray:5 5,color:#fff
```

> ⛔ **남의 마당은 「넘긴다」.** 오늘 Char가 `test_lampaim.mjs`(core 것)와
> `house_rooms.json`(House 것)을 **찾고 안 고치고 넘겼다.** 그게 맞는 꼴이다.

---

## 3. 일이 흐르는 순서

```mermaid
sequenceDiagram
    participant U as 👤 박사님
    participant M as 🎯 총괄
    participant P as 📐 Plan
    participant C as ⚙️ core
    participant G as 🌱 growth

    U->>M: 실제로 해 보다 막힌 것
    M->>C: 「무엇이 안 되나」 (갈래로 좁혀서)
    C->>C: 눌러서 재현
    C-->>M: 「무엇이 되돌렸나」 한 줄
    M-->>U: 물음이 값이면 여쭙기

    Note over M,C: ⛔ 값(확률·배수·가격·일수)은<br/>박사님 승인 없이 못 고침

    U->>M: 결정
    M->>C: 원문 그대로 옮김
    C->>C: 붙이고 눌러서 확인
    C->>G: 정의를 물어야 하면 직접
    G-->>C: 답 (읽었나 돌렸나 밝혀서)
    C->>P: 문안이 필요하면 직접
    P-->>C: 글자 + 자리
    C-->>M: 깃 배포까지 확인
    M-->>U: 링크
```

---

## 4. ⚠ 왜 「창끼리 직접」이 되었나 — §2.9 ㊺

```mermaid
graph LR
    G["🌱 growth<br/>자에 모드·등·기간 박음 ✔"]
    P["📐 Plan<br/>표 머리에 박음 ✔"]
    M["🎯 총괄이 «옮기는 말»<br/>⛔ 아무것도 안 박힘"]
    X["★ 여기가 마지막 구멍"]

    G --> M
    P --> M
    M --> X

    style M fill:#3a2020,stroke:#a04040,stroke-width:2px,color:#fff
    style X fill:#4a1a1a,stroke:#d94141,stroke-width:3px,color:#fff
```

**이틀 동안 그 구멍으로 넷이 났다**

| 옮긴 것 | 빠진 조건 | 결과 |
|---|---|---|
| `0.70` | 출처 | core가 그 위에 셈을 쌓음 |
| `무늬 3장 = 1,830,000` | 출처 | ★ **예순 날을 헛짚음** |
| growth의 `real` 표 | 모드 | 「무순은 창턱뿐」이라는 **없는 흠** |
| `400일에 19일` | 모드 | 「축복은 등이 열어 준다」 — 실제로는 **자리**가 연다 |

> ## **수만 옮기면 «반»만 옮긴 것이다. 조건이 나머지 반이다.**

---

## 5. 지금 판 — 2026-08-29

```mermaid
graph TB
    subgraph NOW["지금 도는 것"]
        N1["⚙️ core — 옮기기 손가락 «두 걸음»"]
        N2["📐 Plan — 가이드 문안 · 대사 정정"]
    end
    subgraph WAIT["대기"]
        W1["🌱 growth — House 신호(바닥 조도 계약)"]
        W2["🏠 House — growth와 짝"]
        W3["🧍 Char — 초상화 적용"]
        W4["🍃 leaf — ⚠ 무응답"]
    end
    subgraph DONE["닫힌 것 (오늘)"]
        D1["가방 끌기 — 손짓을 창에 걸기"]
        D2["할 일이 안 넘어가던 것 — draw() 빠짐"]
        D3["가방으로 넣어도 안 사라지던 것"]
    end
    style W4 fill:#3a2020,stroke-dasharray:5 5,color:#fff
    style DONE fill:#1a2a1a,color:#fff
```

### 남은 박사님 결정

| # | 무엇 | 누가 막혀 있나 |
|---|---|---|
| **그루값** | 「자란 정도에 따라」 붙이면 튜토 끝이 **d88 → 약 d137**(49일 밀림) | core |
| **밑값** | 갓 난 잎도 «얼마쯤»은 값을 줄까 (0.3이면 d87에 100만) | core |
| **ⓒ 문턱** | 삽수 일부만 팔기 — 625,000(껍데기) vs 1,250,000(무늬 한 장) | core · Plan |
| **잎 에셋 넷** | C1~C4 — ⚠ **받을 창(leaf)이 무응답** | — |

---

## 6. 규율 — 어기면 판이 무너지는 것

```mermaid
graph TB
    R1["⛔ git add . 금지<br/>내 파일만 지정해 커밋"]
    R2["⛔ Chrome 은 한 창씩<br/>동시에 돌리면 «거짓 실패»"]
    R3["⛔ 밸런스 값은 박사님 승인<br/>확률·배수·가격·일수·자리 수"]
    R4["⛔ data/profiles/* 쓰기 금지<br/>gen_room_profile --write 금지"]
    R5["★ 커밋 메시지는 -F - <<'EOF'<br/>백틱이 셸에 삼켜진다"]
    R6["★ 남의 마당은 «넘긴다»<br/>고치지 않는다"]

    style R3 fill:#3a2020,stroke:#a04040,stroke-width:2px,color:#fff
```

> ★ **R3에 딸린 것** — *「옆 창이 전한 말」은 그 규칙을 못 푼다.*
> core가 2026-08-25에 세웠고, **그날 안에 두 번 살렸다.**
> 총괄이 전한 수가 이틀에 네 번 틀렸기 때문이다.

---

## 7. §2.9 — 재는 자가 거짓말하는 **마흔다섯** 가지

이 방이 이틀에 스무 번 넘게 물렸고, **전부 「읽고 말한 것」**이었다.
그중 오늘 새로 선 것들:

```mermaid
mindmap
  root((§2.9 · 45))
    읽기
      ㊱ 읽은 말과 누른 말
      ㊱-c 방향이 빠진다
      ㊱-d 잰 것 «옆»의 것을 말한다
    낡음
      ㊶ 스스로 선 것은 혼자 낡는다
      ㊶-b 가리킨 곳이 낡으면
    셈
      ㊷ 밑이 같으면 셋이 아니라 하나
    빠짐
      ㊲-e 있는데 한 군데 빠진 것
      ㊸ 세지 말고 «돌려라»
    전달
      ㊺ 수를 옮길 때 조건도
    막이
      ㊹ 경고문은 못 막는다<br/>자가 던지게 하라
```

### 오늘 이 방이 배운 것 하나

> **읽어서 낸 «수»는 대개 죽고, 읽어서 낸 «뜻»은 죽거나 «받쳐진다».**
> ⇒ 「읽었으니 버려라」가 아니라 **「읽었으면 «재라» — 살 수도 있다」.**

Plan이 오래전에 이야기로 써 둔 *「반지하는 살리는 것 · 원룸은 값을 정하는 것」*이
오늘 growth 실측으로 **살아났다.** 이 방에서 읽은 것이 살아난 첫 번째다.

---

## 8. 나흘 걸린 하나 — 왜 그렇게 오래 걸렸나

```mermaid
graph TB
    A["박사님: 「인벤 몬스테라 드래그가 안 됨」"]
    B["core: 자리 목록이 잠기면 바닥까지 막힘 → 고침"]
    C["박사님: 「아직도 안 된다」"]
    D["core: 「끌 것이 없는 칸」 → ⛔ 틀림"]
    E["core: 「누르기에 확인 화면이 없다」 → 붙임"]
    F["박사님: 「여전히 안 옮겨져」"]
    G["core: 안내글이 display:none → 고침"]
    H["박사님: 「배치된 이동은 되는데<br/>가방에서 빼는 게 안 된다」"]
    I["★ core: 가방이 닫히며<br/>손가락 붙잡기가 풀린다 → 고침"]

    A-->B-->C-->D-->E-->F-->G-->H-->I

    style H fill:#4a3b1a,stroke:#d9a441,stroke-width:3px,color:#fff
    style I fill:#1a3a1a,stroke:#41d941,stroke-width:2px,color:#fff
```

**무엇이 시간을 먹었나**

| 원인 | 몇 번 |
|---|---|
| 「무엇이 안 되나」를 안 물었다 (끌기냐 누르기냐, 가방이냐 방이냐) | **3** |
| core 자(CDP)가 진짜 손가락을 못 흉내 낸다 | **2** |
| 총괄이 조건을 빼고 옮겼다 (「스크롤 전」 y=1218) | **1** |
| 재현 판이 박사님 판과 달랐다 (가방이 짧았다) | **1** |

> ★ **박사님이 「배치된 이동은 되는데 가방에서 빼는 게 안 된다」고 갈라 주신 그 한 줄이**
> **나흘을 한 시간으로 줄였다.** 「되는 쪽」이 있으면 「안 되는 쪽」이 보인다.

---

## 9. 이 문서를 읽는 새 창에게

1. **먼저** `docs/handoff/START-HERE.md` §2.9 를 읽어라. 마흔다섯 개다.
2. 그다음 이 문서로 **누가 무엇을 쥐었는지** 본다.
3. `team-map.md`(규약)와 `multi-session-ops.md`(운영)이 「어떻게 일하나」다.
4. ⛔ **「코드를 읽어 보니 …인 것 같다」로 고장을 보고하지 마라.**
   눌러 보고 **「눌러 보니 …다 [실측: …]」**로 내라.
5. ★ 남의 창에 수를 넘길 때는 **조건을 같이** 넘겨라 — 모드 · 등 개수 · 자라는 기간 · 어느 판.
