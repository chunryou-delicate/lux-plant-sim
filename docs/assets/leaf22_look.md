# 게임에 안 붙은 무늬 잎 22갈래 — **생김새만** 적는다 (2026-08-29 · leaf)

[Plan] 이 등급을 매기려는데 「그 잎들이 어떻게 생겼는지 모른다」 하여 적는다.
⛔ **등급은 안 매긴다.** 「닮았다」까지만이다 — 자르는 것은 [Plan]·박사님이다.

그림: `docs/handoff/img/leaf22/leaf22_sheet.png` (위에서 본 썸네일 22장)
자:   `tools/leaf/leaf_look.py`

## ⚠ 먼저 — **1판 자는 못 쓰는 자였다. 물린다**

처음엔 「밝고 채도 낮은 화소 = 흰 무늬」로 셌다. 그랬더니

```
mon_charcoal (새까만 잎)  ⇒ 「흰 67.5%」          ⛔ 눈으로 보면 새까맣다
큰덩이비                   ⇒ 38갈래 중 거의 다 1.00  ⛔ 갈리지가 않는다
```

⇒ 까닭: **이 썸네일들은 알파가 없고 배경이 «흰색으로 구워져» 있다**(알파 min/max 둘 다 255).
  나는 **흰 배경을 「흰 무늬」로 세고 있었다.** 큰덩이가 죄다 1.00 이던 것도 배경이 한 덩이라서다.
⇒ ★ 그냥 흰 것을 지우면 **정말 흰 잎**(`monstera_leaf_fullalbo`)까지 지운다.
  그래서 **가장자리에서 번져 들어가** 「가장자리에 닿은 흰 것」만 배경으로 본다.
⇒ 고친 뒤: `mon_charcoal` 흰 **6.1%** · `mon_rose_pink` 분홍 **95.6%** — **눈으로 본 것과 맞는다.**

## 재는 것

| 칸 | 뜻 |
|---|---|
| 흰% | 채도 0.18 미만 · 밝기 0.55 초과 화소 / 잎 전체 |
| 금% | 색상 40~70° · 채도 0.35 이상 |
| 분홍% | 색상 300~360° 또는 0~20° · 채도 0.15 이상 |
| 큰덩이 | 가장 큰 흰 덩이 / 흰 전체 ⇒ **1 에 가까우면 「반쪽·큰 패치」, 0 에 가까우면 「점」** |
| 치우침 | 좌우 흰 화소 차 / 흰 전체 ⇒ **1 에 가까우면 하프문** |

⚠ 이 자가 못 하는 것 — 위에서 본 **한 장**이다. 잎이 접히면 좁게 잡힌다.
  그리고 **「크림」은 흰이 아니라 금으로 잡힌다**(따뜻한 색이라). 표를 볼 때 둘을 같이 봐라.

---

## 표 — 한 줄이 한 갈래

★ 「닮은 것」은 위 여섯 수치의 **거리**다. **눈으로 견준 것이 아니다.** 견줄 자리로만 써라.

| 갈래 | 바탕 | 무늬가 «어떻게» 드는가 (눈으로 본 것) | 흰% | 금% | 분홍% | 큰덩이 | 붙은 16 중 가까운 것 |
|---|---|---|---|---|---|---|---|
| `mon_charcoal` | **새까만 초록** | 거의 민무늬. 작은 밝은 점 몇 개뿐 | 6.1 | 0 | 1.1 | 0.30 | heart_speckle_2657 |
| `mon_fullalbo` | **크림·베이지** | ★ **거의 전면 백화** — 잎맥만 초록으로 남는다 | 7.8 | 0.1 | 0 | 0.18 | heart_lime_2672_0 |
| `mon_galaxy_darkteal` | 짙은 청록 | **흰 별점**이 고르게 흩뿌려짐 (은하) | 7.2 | 0 | 0 | 0.13 | **heart_speckle_2657 (0.06 — 제일 가깝다)** |
| `mon_galaxy_tealgold` | 짙은 청록 | 금빛 점·잎맥 테두리. 흰 것보다 **금빛** | 4.5 | 0.4 | 0 | 0.05 | heart_marble_2652 |
| `mon_green_lemonpatch` | 짙은 초록 | ★ **한 곳에 큰 노랑 패치** (치우침 0.27) | 8.8 | 11.9 | 0 | 0.11 | heart_speckle_2657 |
| `mon_green_yellow` | 초록 | **잎맥 따라 연두·노랑 굵은 줄** | 5.1 | 5.8 | 0 | 0.07 | heart_marble_2652 |
| `mon_halfmoon_greencream` | 초록 | ★★ **왼쪽 초록 / 오른쪽 회백 — 하프문** (치우침 0.30) | 57.7 | 0 | 0 | **0.94** | pothos_whitegreen_29 |
| `mon_halfmoon_greenwhite` | 초록 | ★★ **가운데~한쪽이 통째로 회백 — 하프문/거의 풀문** | 60.2 | 0 | 0 | **0.93** | pothos_whitegreen_29 |
| `mon_mauve` | **자주(mauve)** | 잎 전체가 자주. 무늬가 아니라 **색 자체가 다르다** | 5.0 | 0 | **62.8** | 0.07 | (닮은 것 없음 · 거리 0.63) |
| `mon_neon_lime` | **형광 연두** | 민무늬. 색만 강하다 | 4.8 | 28.4 | 0 | 0.39 | (닮은 것 없음 · 거리 0.48) |
| `mon_rose_pink` | **장미빛 붉음** | 민무늬. 색만 강하다 | 4.9 | 0 | **95.6** | 0.08 | (닮은 것 없음 · 거리 0.97) |
| `mon_speckle_greencream` | 초록 | **크림 얼룩이 넓게** — 점보다 크고 패치보다 잘다 | 39.4 | 1.5 | 0 | 0.35 | pothos_silver_droplet |
| `mon_star_greenwhite` | 초록 | ★ **가운데가 통째로 흰 큰 별무늬** | 66.8 | 4.5 | 0 | **0.97** | pothos_whitegreen_29 |
| `mon_star_greenyellow` | 초록 | **주황·노랑 큰 조각**이 갈래마다 | 29.4 | 11.6 | 0 | 0.13 | pothos_cream_marble |
| `mon_star_palegreen` | 짙은 초록 | **연두·금빛 작은 별점** | 13.4 | 4.8 | 0 | 0.05 | pothos_cream_marble |
| `mon_star_pinkmint` | 청록 | **회백 + 분홍**이 함께. 세 색이 섞인다 | 25.8 | 0.2 | **50.5** | 0.24 | (닮은 것 없음 · 거리 0.54) |
| `mon_variegata_gold` | 초록 | ★ **초록 절반 / 주황금 절반** — 금빛 하프문 | 3.6 | 5.0 | 0 | 0.16 | heart_halfmoon_v2_stem |
| `mon_variegata_pink` | **진한 자주빛 붉음** | **분홍 잎맥**이 갈라진다 | 10.6 | 0 | **77.2** | 0.22 | (닮은 것 없음 · 거리 0.79) |
| `mon_zebra` | 짙은 초록 | ★ **잎맥 따라 흰 줄무늬** (얼룩말) | 18.2 | 0 | 0 | 0.08 | pothos_silver_droplet |
| `monstera_leaf_young_albo` | 짙은 초록 | ⚠ **민무늬다.** 이름은 albo 인데 무늬가 없다 | 1.7 | 0 | 0 | 0.09 | pothos_mint_dot_34 |
| `pothos_mint_simple` | 초록 | 민무늬. ⚠ **잎꼴이 다르다** — 갈래 없는 홑잎 | 1.6 | 0 | 0 | 0.22 | pothos_mint_dot_34 |
| `pothos_variegated` | 베이지 | **주황 줄무늬 하트잎.** ⚠ 잎꼴이 다르다 | 9.0 | 9.3 | 0 | 0.13 | pothos_mint_dot |

---

## ★ 갈래로 묶으면 다섯이다 (생김만 · 등급 아님)

```
① 하프문·큰 패치   mon_halfmoon_greencream · mon_halfmoon_greenwhite ·
                   mon_star_greenwhite · mon_variegata_gold · mon_green_lemonpatch
                   ⇒ ★ 큰덩이 0.9 이상이거나 치우침 0.2 이상. 붙은 것 중에는
                     heart_halfmoon_v2_stem · pothos_whitegreen_29 가 이 자리다
② 점·별점         mon_galaxy_darkteal · mon_galaxy_tealgold · mon_star_palegreen
                   ⇒ heart_speckle_2657 · pothos_silver_droplet 과 같은 결
③ 줄무늬          mon_zebra · mon_green_yellow · pothos_variegated
                   ⇒ ★ 붙은 16 에 «줄무늬가 없다». 새 결이다
④ 색 자체가 다름   mon_mauve · mon_rose_pink · mon_neon_lime · mon_variegata_pink ·
                   mon_star_pinkmint · mon_charcoal · mon_fullalbo
                   ⇒ ★★ 붙은 16 중 닮은 것이 «없다»(거리 0.5~1.0). 무늬가 아니라 «색»이다
⑤ 민무늬          monstera_leaf_young_albo · pothos_mint_simple
                   ⇒ ⚠ 등급 도구에 넣을 것이 아닐 수 있다
```

## ⚠ 같이 알려야 할 것 셋

1. **`monstera_leaf_young_albo` 는 이름과 생김이 어긋난다** — albo 인데 민무늬다.
   ⇒ 이름만 보고 등급을 매기면 틀린다.
2. **`pothos_mint_simple` · `pothos_variegated` 는 잎꼴이 다르다** — 갈래 없는 홑잎이다.
   몬스테라 무늬 등급에 섞으면 다른 식물이 섞인다.
3. ★ **③ 줄무늬와 ④ 색 갈래는 붙은 16 에 «자리가 없다».** 등급을 매기려면
   **새 칸**이 필요할 수 있다. ⛔ 그것은 내가 정할 일이 아니다.

## ⛔ 내가 안 한 것

- **등급을 안 매겼다.** 「희소·값·나올 확률」은 한 줄도 안 적었다
- **게임에서 안 봤다.** 전부 썸네일이다. 방에 놓으면 작아지고 어두워진다
  (앞서 잰 것: 중간잎 42px 에서 11갈래 중 **5~6만** 갈렸다)
- ★ 그러니 **여기서 「갈린다」고 한 것이 폰에서도 갈린다는 뜻이 아니다.**
