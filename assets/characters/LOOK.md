# 정본 생김새 — **그림을 만들기 «전»에 여기부터**

2026-09-07 · [Char] · **그림을 보고 적었다.** 짐작 아님.

---

## ⛔ 왜 이 파일이 생겼나

2026-09-07, 끝 그림 두 장의 사람이 **딴 사람으로 나왔다.**
프롬프트에 `dark bob hair`(단발)라 적었는데 **정본은 긴 생머리**였다.

> 총괄: *"이것이 오늘 제가 재지 않고 «지어낸» 자리입니다. **그림 만들 때 정본을 안 봤습니다.**"*

⇒ ★ **정본은 파일에 있는데 «말»이 없었다.** 프롬프트는 말로 쓰는 것이라
  말이 없으면 **지어내게 된다.** 그래서 여기 적는다.

---

## ★ 자취녀 (jachwi_f) — 주인공

**정본 그림**: `portraits/portrait_jachwi_neutral.png` · 원화 `char_jachwi_f_front.png`

```
머리    ★ «긴 생머리». 어깨를 한참 지나 가슴께까지 내려온다
        ★ «일자 앞머리»(블런트 뱅) — 눈썹을 덮고 가로로 곧게 잘렸다
        색: 아주 짙은 갈색(검정에 가깝되 «검정은 아님»). 옆머리가 얼굴을 감싸 내려온다
        ⛔ 단발(bob) 아님 · ⛔ 묶음머리 아님 · ⛔ 곱슬 아님
얼굴    둥근 편 · 큰 눈 · 홍채는 «따뜻한 갈색» · 속눈썹이 위쪽에 짙다
        볼에 «분홍 홍조»가 뚜렷하다 (이것이 이 캐릭터의 표식이다)
        코는 «점 하나»에 가깝게 작다 · 입도 작다
옷      ★ «크림색·아이보리 반팔 티셔츠». 목이 둥글게 파였다
        ⛔ 흰색 아님(살짝 노란 기) · ⛔ 무늬 없음
화풍    2D 만화체 · «굵지 않은» 윤곽선 · 평평한 채색에 옅은 그림자
```

## ★ 몬이 (mascot_sprout) — 마스코트

**정본 그림**: `portraits/portrait_moni_neutral.png` · 3D 원화 `mascot/expressions/mon_default.png`

```
생김    ★ «화분에 든 새싹». 연둣빛 둥근 몸에 팔이 짧다
        머리에 «몬스테라 잎»이 좌우로 하나씩 (구멍 뚫린 그 잎)
        ★ 화분은 «테라코타»(주황빛 갈색) — 위가 넓고 아래가 좁은 흔한 꼴
얼굴    큰 눈에 «흰 하이라이트» 두 점 · 볼에 «분홍 홍조»
        입은 작다 · 눈썹이 «있다»(표정을 짓는다)
크기    사람의 «38%». 실제 0.527 m (사람 1.40 m)
화풍    ★ 자취녀와 «같은» 2D 만화체여야 한다
        ⛔ `mascot/expressions/*.png` 는 **3D 클레이 렌더**다 — «표정 참고»로만 쓰고
          «화풍»은 절대 따라 하지 말 것
```

---

## ⇒ ★★ 그림을 «주문»할 때 — 이대로 붙여 쓸 것

### 자취녀

```
young Korean woman, LONG straight dark-brown hair well past the shoulders,
BLUNT straight bangs across the eyebrows, large warm-brown eyes,
soft pink blush on cheeks, small nose and mouth, cream/ivory short-sleeve
round-neck t-shirt, flat 2D anime illustration, clean thin linework,
soft flat shading, plain background
NOT bob hair, NOT tied hair, NOT curly, NOT white shirt
```

### 몬이

```
tiny chubby sprout mascot sitting IN a terracotta flower pot,
light green rounded body, two monstera leaves with holes on its head,
big round eyes with two white highlights, pink cheek blush,
small mouth, visible eyebrows, flat 2D anime illustration,
clean thin linework, plain background
NOT 3D render, NOT clay style
```

---

## ⛔⛔ **자세를 바꿀 때 — 「몸」이 지워진다. 반드시 못박을 것**

2026-09-07 · 총괄 실측 — **세 번 잃고 두 번 지켰다. 짐작이 아니다.**

```
teach try2   ⇒ 화분 사라짐 · 잎 사라짐  ⇒ ★ «거북이 등딱지»가 붙었다
teach try3   ⇒ 화분은 남았는데 ⇒ «오른쪽 잎이 통째로» 사라졌다
cheer try1   ⇒ 화분 사라짐 · 잎 사라짐  ⇒ 맨 팔이 됐다
──────────────────────────────────────────────
teach try4 · cheer try2  ⇒ ✔ 아래 절을 «넣었다» ⇒ ⇒ 둘 다 «지켰다»
```

> ★★★ **화분과 잎은 몬이의 «옷»이 아니라 «몸»이다.**
> ⇒ ⇒ ⛔ **그런데 만드는 자는 그것을 «배경»으로 본다.**
> ⇒ ★ 「자세를 바꾸라」고만 하면 **바꾸기 좋게 «치워» 버린다.**

### ⇒ ★ **자세를 바꿀 때마다 이 절을 «같이» 넣을 것**

```
CRITICAL: the character MUST still be sitting inside the SAME terracotta flower pot,
and its arms MUST still be the big monstera leaves with splits and holes.
Do not remove the pot. Do not remove the leaves. Do not give it a shell.
```

> ⚠ **이것이 이 파일이 생긴 까닭과 «같은 병»이다** —
> ⇒ 정본이 «파일»에는 있는데 «말»이 없으면 **지어낸다.**
> ⇒ ⇒ ★ 머리 모양도 그랬고, **화분과 잎도 «말이 없던» 것이다.**

---

## ⚠ 규격 — **말로 못 맞춘다. 자로 맞춘다**

```
게임이 쓰는 것   600×800 · «투명» 배경
바닥선           몬이 y=621  ·  ★ 자취녀 y=799 (총괄 결정 2026-09-07 — 판 끝까지)
```
⇒ ★ 들어온 그림이 어떤 크기·배경이든 **`tools/char/fit_portrait.py`** 가 맞춘다.
  ⇒ **주문할 때 크기를 걱정하지 말 것.** 걱정할 것은 **생김새와 화풍**이다.

```
python tools/char/fit_portrait.py <들어온.png> <나갈.png> \
    --ref 'assets/characters/portraits/portrait_moni_*.png'          # 몬이
python tools/char/fit_portrait.py <들어온.png> <나갈.png> \
    --ref '...portrait_jachwi_[a-z]*.png' --bottom 799               # 자취녀
```
⚠ 자취녀 기준에 **`jachwi_m_*`(자취남)이 섞이면 안 된다** — 몸집이 달라 기준이 흐려진다.

---

## ⚠ 그리고 — **작은 화면에서 표정이 갈리려면**

```
★① 「눈」을 바꿔라 — 폰 152px 에서 «읽히는» 것은 눈이다
★② 「실루엣」을 바꿔라 — 폰에서는 얼굴 «안쪽»이 아니라 «바깥 모양»이 보인다
⛔ 「입」이나 「손짓의 잔 차이」는 152px 에서 «몇 화소»다. 그것에 기대지 말 것
```

### ⇒ ★★ 증거가 «그림 안»에 있다 ([Plan] 2026-09-07)

```
neutral ↔ calm  ⇒ 자세가 «똑같은데»(대칭 · 잎 둘 다 아래) ⇒ 폰에서 «대번에» 갈린다
              ⇒ ★ 갈린 것은 «눈» 하나뿐 ⇒ ⇒ **눈은 152px 에서도 읽힌다**
curious ↔ teach ⇒ ⛔ 폰에서 «안 갈린다». 둘 다 몸을 오른쪽으로 기울이고 잎을 위로 뻗었다
              ⇒ ★ «실루엣»이 같으면 얼굴을 바꿔도 «안 갈린다»
```

### ⚠ 그리고 — **자로 재면 «반대»가 나온다. 속지 말 것**

```
폰 152px 화소차   calm↔neutral 6.44 ⇐ ★ «제일 작다»   ·   curious↔teach 9.73
⇒ ⛔ 수로는 calm 이 제일 «안» 갈리는 것처럼 보인다
⇒ ★★ 그런데 사람은 «눈 감은 것»을 대번에 안다
   ⇒ ⇒ **눈 감김은 «면적»이 작고 «뜻»이 크다**
```
> ★★★ **이것이 「자가 재는 것」과 「사람이 읽는 것」이 «반대로» 갈린 자리다.**

### ✔ ⇒ **그런데 «맞는 자»를 찾았다 — 실루엣 겹침(IoU)** (2026-09-07)

화소차가 사람 눈과 반대로 나온 까닭은 **엉뚱한 것을 쟀기** 때문이다.
[Plan] 이 「폰에서는 얼굴 «안쪽»이 아니라 «바깥 모양»이 보인다」고 했으니,
⇒ ★ **재야 할 것은 «바깥 모양이 겹치나»**다.

```
폰 152px 에서 두 그림의 «불투명 화소»가 얼마나 겹치나 (IoU)
  curious ↔ 나머지          0.69 ~ 0.71   ⇒ ✔ «갈린다»
  teach ↔ proud ↔ calm      ★ 0.96        ⇒ ⛔ «안 갈린다» (셋 다 눈 감고 잎 양옆)
```
> ★★ **IoU ≥ 0.95 면 「눈으로 봐라」는 뜻이다.** ⛔ 「안 된다」가 «아니다».
> ⇒ 실제로 `worry ↔ calm` 이 **0.985** 인데 **눈이 뜸/감음이라 갈린다**(2026-09-07).
> ⇒ ⇒ ★ 그리고 `neutral ↔ calm` 0.914 도 [Plan] 이 「대번에 갈린다」고 했다.
> ⇒ ⇒ ⇒ ★★★ **이 자는 «거르는» 자이지 «판정하는» 자가 아니다.**
>   ⛔ IoU 가 낮아도 «뜻»이 같으면 소용없고, 높아도 «눈»이 다르면 갈린다.

### ⇒ ★★★ **그리고 오늘 제일 센 것 — 「막는 말」보다 「이름 붙이는 말」**

`teach` 가 **여섯 판** 걸렸다. 그 여섯이 이것을 말한다:

```
try2  「잎 팔을 앞으로 뻗어라」   ⇒ ⛔ 화분·잎 사라짐 · 거북이 등딱지
try3  「지우지 «마라»」 넣음      ⇒ ⚠ 화분은 남고 오른쪽 «잎만» 사라짐
try4  「잎 둘 다 두어라」 넣음    ⇒ ✔ 다 남았으나 자세가 calm 과 겹침
try5  「멀리 뻗어라」 세게        ⇒ ⛔ 팔은 뻗었는데 ★ «잎이 없는 맨 팔»
try6  ★ 잎을 «손»이라 «이름» 붙임 ⇒ ✔✔ 뻗은 팔 «끝»에 잎이 달림
```

> ⇒ ★ 「잎 팔을 뻗어라」 하면 **«팔»만 뻗고 «잎»은 버린다.**
> ⇒ ⇒ 만드는 자는 팔과 잎을 **딴 것**으로 본다 — 잎을 «장식»으로 보는 것이다.

```
This creature has NO hands: at the end of each short arm there is a LARGE MONSTERA
LEAF BLADE with deep splits and round holes, and that leaf IS its hand.
```

> ★★★ **「지우지 마라」(막는 말)로는 다섯 중 셋을 잃었고,
> 「잎이 손이다」(이름 붙이는 말)로는 «한 번»에 됐다.**
> ⇒ ⇒ **못 하게 막는 말보다 «무엇인지 이름 붙이는 말»이 세다.**

### ⇒ ★ 그래서 **낯을 늘릴 때의 규칙**

```
① 눈을 바꾼다        ⇒ ★ 폰에서 읽힌다. ⛔ 다만 «감은 눈»은 «한 번»만 써라
                       (teach·proud·calm 을 다 감은 눈으로 만들었더니 셋이 겹쳤다)
② 실루엣을 바꾼다    ⇒ ★ 잎을 «위로/앞으로/늘어뜨려» — 세 가지가 나온다
③ ★★ 둘을 «짝»지어라 ⇒ 눈 하나 + 자세 하나. 그러면 여섯 낯이 안 겹친다
```
