# ★★★★★★ 빛식물 — 이벤트 · 대화 · 가이드 · 발생조건 **한 장**
2026-08-30 · [총괄] · 박사님 청 「한눈에 보여주는 것을 머메이드로」

⚠ **낸 곳** — `quest.js` · `first_play.js` · `dialogue.js` · `loop.js` · `tutorial.js` · `oneroom.js` · `game.html`
⚠ **조건은 소스에서 캔 것이다.** 이름에서 읽지 않았다. 다만 「지금 화면에서 정말 그렇게 뜨나」는 [core]가 눌러야 확정이다.

---

## ⓪ 큰 그림 — **말이 나오는 곳은 «셋»이고, 손가락은 «넷째»다**

```mermaid
flowchart LR
  subgraph SRC["말이 나오는 곳 — 셋"]
    A["① 첫 플레이<br/>first_play.js<br/>phase 7"]
    B["② 퀘스트<br/>quest.js<br/>18줄"]
    C["③ 살림·계절·식물<br/>tutorial.js · loop.js<br/>사건 31"]
  end
  A --> EV["사건 id<br/>{ id, ko, … }"]
  B --> EV
  C --> EV
  EV --> MAP["EVENT_SCRIPT<br/>QUEST_OPEN_SCRIPT<br/>QUEST_DONE_SCRIPT"]
  MAP --> ORD["EVENT_ORDER<br/>차례를 정한다"]
  ORD --> DLG["대사<br/>SCRIPTS 66"]
  DLG --> STAGE["화면 · talking"]

  subgraph FOUR["④ 손가락 — 사건이 아니다"]
    H["updateHint()<br/>상태를 매 틱 다시 묻는다"]
    K["쪽지 coach<br/>10초"]
  end
  STAGE -. "말하는 동안 손가락 쉼" .-> H
  K -. "쪽지 뜨면 손가락 쉼" .-> H

  classDef s fill:#1d4b3a,stroke:#4ade80,color:#e8fff4
  classDef f fill:#4a2f1d,stroke:#fbbf24,color:#fff8e8
  class A,B,C s
  class H,K f
```

> ★ **읽는 법** — ①②③은 「일이 벌어져서」 말한다(사건). ④는 「지금 상태가 이러니까」 가리킨다.
> ⇒ ★★ **그래서 ④만 되돌아온다.** 사건은 한 번 지나가면 끝이고, 손가락은 조건이 참인 동안 계속 뜬다.

---

## ① 첫 플레이 — **phase 일곱**

```mermaid
flowchart TD
  P0["start<br/>가방에 시루 하나"] -->|"시루를 방에 놓았다"| P1["place_beansprout"]
  P1 -->|"심었다"| P2["grow_beansprout<br/>4일 한 바퀴"]
  P2 -->|"첫 수확"| E1(["사건 beansprout_harvest<br/>대사 harvest"])
  P2 -->|"몬스테라가 아직 안 왔다"| P3["monstera_gift"]
  P3 -->|"도착"| E2(["monstera_arrived<br/>셋이 말한다"])
  E2 --> P4["move_monstera<br/>★ 손가락 두 걸음"]
  P4 -->|"밝은 자리에 놓았다"| P5["grow_monstera"]
  P5 -->|"말린 새순이 섰다"| E3(["spear_furled"])
  E3 --> P6["complete<br/>첫 플레이 끝"]

  P5 -.->|"열흘 안 자람 · HINT_DAYS=10<br/>아직 안 들려줌"| G1(["monstera_no_spear<br/>창턱. 해가 제일 오래 드는 자리야"])
  G1 -.->|"들려줬고 · 정말 옮겼고<br/>그 뒤 5일 더 안 자람"| G2(["monstera_needs_lamp<br/>★ 여기서 등이 처음 나온다"])
  P5 -.->|"자라기 시작하면"| GX["유도 끝<br/>guide.grewOnce"]

  classDef ev fill:#3a2a52,stroke:#c4b5fd,color:#f3f0ff
  class E1,E2,E3,G1,G2 ev
```

> ★ **유도 둘은 날수가 아니라 구조로 선다** — `move`는 안 들려줬을 때만, `lamp`는 들려주고 옮겼을 때만.
> ⇒ 두 문이 서로 겹치지 않아, 날수를 어떻게 바꿔도 차례가 안 뒤집힌다.

---

## ② 퀘스트 열여덟 — **사슬과 곁가지**

```mermaid
flowchart TD
  Q1["place_siru<br/>늘 열려 있다"] --> Q2["water_siru"]
  Q2 --> Q3["first_harvest"]
  Q3 --> Q4["resow_siru"]
  Q4 --> Q5["order_seed"]
  Q5 --> Q6["siru_two"]
  Q6 --> Q7["monstera_home"]
  Q7 --> L2["leaf_two"]
  L2 --> L3["leaf_three"]

  FP{{"firstPlayDone<br/>또는 몬스테라 도착"}} --> Q8["crop_mix"]
  FPD{{"firstPlayDone<br/>+ 앞 사슬"}} --> Q9["siru5_cycle5<br/>★ 시루 다섯 · 다섯 바퀴"]
  Q9 --> Q10["radish5"]
  Q9 --> Q11["siru8"]
  Q11 --> Q12["siru16"]

  M2{{"motherLeaves ≥ 2"}} --> C1["first_cut"]
  LU{{"lampUnlocked"}} --> C2["buy_lamp"]
  MV{{"motherVarieLeaves ≥ 1"}} --> C3["varie_bright"]
  CUT{{"무늬 삽수가 있다"}} --> C4["sell_varie<br/>★ 이사의 문"]

  classDef gate fill:#4a2f1d,stroke:#fbbf24,color:#fff8e8
  classDef main fill:#1d4b3a,stroke:#4ade80,color:#e8fff4
  class FP,FPD,M2,LU,MV,CUT gate
  class Q1,Q2,Q3,Q4,Q5,Q6,Q7,Q9 main
```

> ★ 퀘스트마다 대사가 **둘**이다 — 열릴 때(`QUEST_OPEN_SCRIPT` 18) · 끝낼 때(`QUEST_DONE_SCRIPT` 17).
> ⚠ 지도에 **없는 questId는 조용히 지나간다.** 그게 맞다 — 없는 대사를 부르다 던지는 것보다 낫다.
> ⚠ `test_quest.mjs`가 표와 두 지도가 어긋나지 않는지 못 박는다. **이 저장소의 지병**이 「퀘스트는 열리는데 화면이 조용한」 것이라서.

---

## ③ 사건 대사 서른하나 — **조건을 붙여서**

```mermaid
flowchart TD
  subgraph SAL["살림"]
    R1{{"day 0 아니고<br/>day == 청구일 − 7"}} --> R1e(["rent_soon · ★되풀이"])
    R2{{"cash 0 밑이고<br/>아직 파산 아님"}} --> R2e(["broke<br/>⛔ 지금 한 번뿐 → 되풀이로 옮길 것"])
  end
  subgraph LAMP["등"]
    L1{{"가을에 들어섰다<br/>아직 안 열림"}} --> L1e(["lamp_unlocked<br/>첫 개는 공짜"])
    L2{{"가을 7일째<br/>가진 등 0"}} --> L2e(["lamp_skipped · 한 번만 짚는다"])
    L3{{"샀다"}} --> L3e(["lamp_bought"])
  end
  subgraph STL["멈춤 · STALL_DAYS=4"]
    S0{{"4일째 형태 그대로"}} --> S1{"계절?"}
    S1 -->|"겨울"| S1e(["plant_stalled_winter · ★되"])
    S1 -->|"둘째 번부터"| S2e(["plant_stalled_again · ★되"])
    S1 -->|"처음"| S3e(["plant_stalled"])
    S4{{"멈춰 본 적 있고<br/>다시 오른다"}} --> S4e(["plant_resumed"])
    S5{{"겨울 11일째<br/>아직 반지하"}} --> S5e(["winter_still"])
  end
  subgraph VAR["무늬"]
    V1{{"무늬 잎 한 장"}} --> V1e(["varie_lucky<br/>무늬가 섞였습니다"])
    V2{{"무늬 잎 두 장"}} --> V2e(["varie_lucky2"])
    V3{{"확정 잎이 났다"}} --> V3e(["varie_granted"])
    V4{{"셋째 장부터"}} --> V4e(["⛔ 말하지 않는다<br/>놀람이 값을 잃는다"])
  end
  subgraph MOV["이사 — 상태가 바뀔 때만"]
    M0{{"이사 조건을 잰다"}} --> M1{"어디가 모자라나"}
    M1 -->|"돈만"| M1e(["move_short_money"])
    M1 -->|"배움만"| M2e(["move_short_learn"])
    M1 -->|"둘 다 · 살림이 얕다"| M3e(["move_short_both_crop"])
    M1 -->|"둘 다 · 살림은 됐다"| M4e(["move_short_both_light"])
    M1 -->|"됐다"| M5e(["move_ready"])
    M5e --> M6e(["moved_out"])
    M6e --> M7e(["moved_in_oneroom"])
  end
  subgraph HAND["손"]
    H1{{"오늘 익은 것 × 2 가<br/>오늘 남은 손보다 크다"}} --> H1e(["crop_hands_short · ★되<br/>드문 날이라야 뜬다"])
  end

  classDef ev fill:#3a2a52,stroke:#c4b5fd,color:#f3f0ff
  classDef bad fill:#4a1d1d,stroke:#f87171,color:#ffecec
  class R1e,L1e,L2e,L3e,S1e,S2e,S3e,S4e,S5e,V1e,V2e,V3e,M1e,M2e,M3e,M4e,M5e,M6e,M7e,H1e ev
  class R2e,V4e bad
```

> ★ **이사만 「상태가 바뀔 때」다** (`_moveState`). 나머지는 「일이 벌어질 때」다.
> ⇒ 그래서 이사 말은 조건이 오가면 다시 나오고, 나머지는 안 나온다.

---

## ④ 손가락 — **차례가 곧 규칙이다**

```mermaid
flowchart TD
  T["updateHint() — 매 틱"] --> C0{"쪽지가 떠 있나"}
  C0 -->|"예"| X0(["⛔ 손가락 쉼<br/>둘이 뜨면 둘 다 안 읽힌다"])
  C0 -->|"아니오"| C1{"여기에 둘까요?<br/>확인 중인가"}
  C1 -->|"예"| A1(["👉 확인 단추<br/>★ 여기가 구멍이었다 — 26일 멈춤"])
  C1 -->|"아니오"| C2{"몬스테라를 옮기는 중<br/>격자가 떴나"}
  C2 -->|"예"| A2(["👇 갈 자리<br/>여기로 끌어 보세요 — 창턱<br/>★ 자리는 그때그때 묻는다"])
  C2 -->|"아니오"| C3{"끌고 있나 · 고르는 중인가<br/>말하는 중인가 · 확대 중인가"}
  C3 -->|"하나라도 예"| X1(["⛔ 손가락 쉼"])
  C3 -->|"아니오"| C4{"첫 플레이가 켜져 있나"}
  C4 -->|"아니오"| X2(["⛔ 손가락 쉼"])
  C4 -->|"예"| B1{"시루를 아직 안 놓았나"}
  B1 -->|"예"| A3(["👉 가방 시루 칸<br/>끌거나 눌러서 방 안 어두운 자리에<br/>가방이 닫혔으면 → 가방 단추"])
  B1 -->|"아니오"| B2{"가방에 몬스테라가 있나"}
  B2 -->|"예"| A4(["👉 가방의 그것<br/>끌거나 눌러서 방 안 밝은 자리에"])
  B2 -->|"아니오"| B3{"phase 가 move_monstera 인가"}
  B3 -->|"예"| A5(["👉 방의 화분<br/>창턱으로 옮겨 보세요"])
  B3 -->|"아니오"| B4{"오늘 할 일이 있나"}
  B4 -->|"예"| A6(["👉 그 일<br/>물주기 · 거두기 · 심기"])
  B4 -->|"아니오"| B5{"씨앗·시루·무순을<br/>사야 하나"}
  B5 -->|"예"| A7(["👉 상점 → 품목 → 주문<br/>★ 세 걸음을 끝까지 데려간다"])
  B5 -->|"아니오"| A8(["👉 다음 날"])

  classDef stop fill:#4a1d1d,stroke:#f87171,color:#ffecec
  classDef fin fill:#4a2f1d,stroke:#fbbf24,color:#fff8e8
  class X0,X1,X2 stop
  class A1,A2,A3,A4,A5,A6,A7,A8 fin
```

> ★★ **위에 있는 갈래가 이긴다.** [확인]과 [갈 자리]가 「고르는 중이면 쉰다」보다 **앞**에 있는 까닭이다 —
> 뒤에 두면 **영영 안 닿는다.** 「고르는 중」이 먼저 잡아채기 때문이다.
> ⚠ 그래서 **새 갈래를 어디에 끼우나가 그 갈래의 생사다.**

### ⓑ 안 뜨는 때 — **여섯**
```
① 쪽지(coach)가 떠 있다        10초 · COACH_MS
② 끌고 있다                    drag.on
③ 무언가를 고르는 중이다       picked.mode      ⇐ ⚠ 단, [확인]·[갈 자리]는 이보다 앞
④ 말하는 중이다                stage.talking
⑤ 확대 중이다                  stage.zoom
⑥ 첫 플레이가 꺼져 있다        !fp.enabled
```

### ⓒ 층 — **누가 누구를 덮나**
```
82  상세창
80  안내판
70  손가락 hint
69  hintDim 덮개   ⇐ pointer-events:none. 빼면 울타리가 된다
41  왼쪽 세로 메뉴
40  시트
39  시트 스크림
```

---

## ⑤ ★★★ **어긋남 — 이 그림이 드러내려고 있는 것**

```mermaid
flowchart LR
  D1["⛔ brokeTalk<br/>한 번뿐인데<br/>돈은 여러 번 떨어진다"] --> F1["REPEATABLE로 옮기고<br/>brokeTalkAgain을 더한다"]
  D2["⛔ 할 일 줄이 물을 주세요<br/>게임은 심기를 기다린다"] --> F2["✔ 32f6ede — 할 일을<br/>상태에 묻게 고침<br/>이제 자로 써도 된다"]
  D3["⛔ 사람을 눌러 보세요 쪽지가<br/>10초간 손가락을 끈다"] --> F3["✔ 손가락이 안 짚거나<br/>다음 날만 짚을 때로 미룸<br/>걸음 번호를 안 센다"]
  D5["⛔ 쪽지가 살림 숫자를 덮는다<br/>쪽지 top 10 · 띠 bottom 65"] --> F5["✔ 띠를 재서 그 아래에<br/>숫자를 안 박았다"]
  D4["⚠ 안 사는 것도 답이다 가<br/>근거를 잃었다<br/>등 없이 나가는 길 폐기"] --> F4["대사 한 줄이 답을 기다린다<br/>사도 되고 안 사도 돼"]

  classDef bad fill:#4a1d1d,stroke:#f87171,color:#ffecec
  classDef fix fill:#1d4b3a,stroke:#4ade80,color:#e8fff4
  class D1,D2,D3,D4,D5 bad
  class F1,F2,F3,F4,F5 fix
```

---
■ **⚠ 아직 비어 있는 칸** — 눌러서 채울 것:
  ① 손가락 갈래 ④~⑧이 **지금 화면에서 정말 그 차례로 뜨나**
  ② 사건 대사 조건이 **정말 그 날에 터지나**

■ **★ 그리고 오늘 하나가 더 붙었다 — 재는 자도 거짓말을 한다.**
  대사 상자를 마흔 번 눌러도 안 넘어가는 것처럼 보였는데, 연 기록을 붙여 다시 재니
  세 줄이 차례로 넘어가 있었다. **못 넘긴 것은 자였고 게임은 멀쩡했다.**
  ⇒ `tools/probe_walkstep.mjs` 가 「없다 · 쉰다 · 가려졌다」를 **한 줄에서** 가른다.
