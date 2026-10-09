# leaf Higgsfield 주문표 — 도감·카드 그림 · 스킨답서스·칼라데아 원화 · 잎 단계 (2026-10-09 · [leaf])

> 총괄(10-09): 박사님 «힉스필드 많이 써라» · 잔액 2,406.75. ① 도감·카드 식물 2D(몬스테라 무늬 가족 19 · 핑크프린세스·알로카시아 판) — 손그림 결 ② 스킨답서스·칼라데아 2D 원화 ③ 잎 단계 설명 그림.
> ⛔ **크레딧 쓰는 호출은 총괄이 돌린다.** 이 문서와 `leaf-higgsfield-order-20261009.json` 은 «그대로 돌릴 수 있는 주문»이다. 받은 그림을 검수·잇는 일은 leaf 가 한다.
> 주문은 한 표에서 나온다: `python tools/leaf/higgs_order1009.py [--style=A|B]` → JSON · 이 문서 맨 아래 표(표시 줄 아래를 다시 쓴다). 손으로 JSON 을 고치지 말고 표를 고쳐 다시 낸다.

## 0. 고른 것

| 칸 | 값 | 까닭 |
|---|---|---|
| 도구 · 모델 | `generate_image` · `gpt_image_2_5`(variant flare) | 참조 그림으로 «모양·무늬»와 «결»을 같이 잡는다 · **투명 바탕**을 낸다(카드는 어느 판 위에도 얹혀야) · char 사건 원화가 같은 모델로 통과했다 |
| 질 · 크기 | `quality: high` · `resolution: 1k` | 미리 잰 값(get_cost · 제출 없음): **장당 1.5**(medium 0.5 · nano_banana_2_1 1.5 · flux_3 2). 카드·원화는 1024² 면 충분하다(폰 카드 ≤ 460px) |
| 장 수 | 줄마다 `count: 2` | 둘 중 나은 것을 leaf 가 고른다(검수 §3) |
| 참조 role | `image_references` (models_explore get 으로 확인) | |
| 참조 그림 | JSON `refs` — 총괄이 `media_upload` → media_id 로 바꿔 끼운다 | 모양·무늬 = 지금 그 가족의 썸네일 · 결 = 아래 둘 |
| 결 A(손그림) | `REF_STYLE_A` = `assets/illust/ev_first_varie_halfmoon.png` — 이미 통과한 사건 원화(가는 갈색 잉크 선 · 과슈 물칠) · 무늬 몬스테라 잎이 들어 있다 | ③ 은 늘 A(#sceneArt 는 사건 원화 자리라 결이 같아야 한다) |
| 결 B(파스텔 저폴리) | `REF_STYLE_B` = `assets/raw/plants/pink_princess/PP2_clean.png` · `REF_STYLE_B2` = `assets/raw/plants/alocasia/AL2_clean.png` — 핑크프린세스·알로카시아 3D 가 된 원화 | ② 는 늘 B(3D 입력이라 PP·AL 과 같은 길이어야 한다) |
| 바탕 | ① `transparent` · ② `opaque`(흰) · ③ `opaque` | ① 카드 판이 바탕을 준다 · ② Meshy image_to_3d 는 흰 바탕 한 잎 · ③ 장면 |

⚠ **지금 썸네일은 3D 를 위에서 찍은 것**이다(`tools/glb_thumb` · 납작한 색). 그래서 «손그림 결»은 참조가 아니라 결 참조(A/B)가 정한다 — 썸네일은 «무슨 무늬·무슨 색»만 넘긴다. 썸네일 중 차콜·핑크프린세스 무지는 거의 검은 덩어리, 알보-전체흰은 베이지라 프롬프트에 «읽히게 · 흰»을 박았다.

## 1. 차례 — 결부터 고른다 (시험 2줄 · 6 크레딧)

1. **P1 · P2 먼저** — 같은 가족(하프문-그린흰)을 결 A · 결 B 로 각 2장 → `assets/illust/cards/_pilot/`.
2. 총괄·박사님이 A/B 를 고른다(**결은 박사님 판단** — leaf 가 정하지 않는다). leaf 는 검수 ①~⑤ 만 본다.
3. 고른 결로 `python tools/leaf/higgs_order1009.py --style=A|B` → 카드 27줄을 그 결로 다시 낸다(기본 A 로 나가 있다).
4. ② ③ 은 결이 정해져 있어 시험을 안 기다려도 된다 — P1·P2 와 같이 돌려도 된다.
5. 받으면 leaf 가 §3 으로 검수 → 못 쓰는 줄만 재시도 몫(§4)으로 다시 청한다.

## 2. 쓰일 자리

| 묶음 | 게임의 자리 | 누가 거나 |
|---|---|---|
| ① 카드 27 | **지금 게임에 자리가 없다**(도감 화면 없음 · 무늬 등급 알림은 글뿐 · game.html `✨ N번째 잎 — 등급` 배너). 후보: ⓐ 등급 알림 옆 그림 ⓑ 잎·삽수 팔기 확인 시트 ⓒ 앞으로의 도감. 지금 바로 걸 수 있는 곳: `docs/dogam` 식물 칸(leaf) | plan(어디에) · core(걸기) · leaf(docs/dogam) |
| ② 원화 10 + 그루 2 | 잎 10장 = 나중 Meshy `image_to_3d` 입력(Meshy 잔액 461 안에서 · growth 의 «늘어지는 줄기»·«로제트» 규칙 뒤 · leaf-meshy-plan §2-c 그대로). 그루 2장 = growth 가 종 꼴(덩굴·로제트)을 세울 때의 기준 그림 · 도감 후보 | leaf(3D·잇기) · growth(종 프로필) |
| ③ 잎 단계 5 + 한눈에 1 | 다섯 장 = 대사 `statusPhaseOpening/Young/Mid/Mature/Axis`(dialogue.js) 위 #sceneArt(정사각 · `sceneArtOf` 에 case 한 줄씩 · 파일은 `assets/illust/ev_leaf_stage_*.png`) — **다섯이 한 벌(같은 구도)**. 한눈에(16:9) = 도움말·docs | core(sceneArtOf) · plan |

## 3. 검수 (leaf · 0 크레딧 · 장마다)

**① 카드**
- ① 가족이 읽힌다 — 썸네일과 같은 크기로 나란히 놓아 무늬 종류(점·줄·반반·별·전체색)와 색이 같은 가족으로 보인다
- ② 실루엣 — 몬스테라 성숙잎은 갈라짐·구멍 · 핑크프린세스는 하트 · 알로카시아는 화살촉 + 흰 잎맥
- ③ 투명 바탕(알파 있음) · 잘림 없음 · 잎이 칸의 70~85% · 잎자루 아래
- ④ 어두운 가족(차콜 · 갤럭시-다크틸 · PP 무지)도 잎맥·갈라짐이 읽힌다 — 잎 화소 밝기 평균 ≥ 0.25 · 알보-전체흰은 흰(잎 채도 < 0.10 · 베이지 X)
- ⑤ 2D 손그림(3D 렌더·사진 X) · 글자·테두리·그림자 X
- ⑥ **27장이 한 벌** — 같은 각·같은 크기·같은 선 굵기(시트로 늘어놓아 본다)
- ⑦ 폰 96px 로 줄여도 산반 / 하프문 / 풀문이 갈린다

**② 원화**
- ① 한 잎 · 잎자루 아래 · 잎 전체 · 흰 바탕(3D 입력 규약 — leaf-meshy-plan §2-b)
- ② PP·AL 원화와 같은 결(파스텔 저폴리 면)
- ③ 종 특징 — 스킨답서스: 끝이 뾰족한 비대칭 하트 · 칼라데아: 둥근 잎 + 옆맥 따라 은빛 깃 줄무늬 · 화이트퓨전: 흰 붓질 마블
- ④ 어린·중간·성숙이 같은 종의 같은 잎 꼴로 크기·결만 다르다 · 무늬판은 성숙 밑 모양과 같은 꼴
- ⑤ 그루 2장: 스킨답서스 = 걸이 화분에서 덩굴이 늘어짐 · 칼라데아 = 밑동에서 곧은 잎자루가 바로 나는 로제트

**③ 잎 단계**
- ① 다섯 장이 **같은 구도**(카메라·배경·줄기 자리) — 겹쳐 보면 잎만 바뀐다
- ② 단계가 한눈에 다르다: 말린 순이 풀림 → 연한 작은 잎 → 단단한 중간잎(갈라짐 1~2) → 갈라지고 구멍 난 큰 잎 → 줄기 끝 새 순
- ③ 사건 원화(ev_first_varie_halfmoon)와 같은 선·색 · 화분·몬이·사람 없음 · 글자 없음 · 1:1(한눈에는 16:9)

## 4. 합계

| 묶음 | 줄 | 장(×2) | 크레딧(×1.5) |
|---|---|---|---|
| 시험 P1·P2 | 2 | 4 | 6 |
| ① 카드(몬스테라 무늬 19 + 무지 1 · PP 4 · AL 3) | 27 | 54 | 81 |
| ② 잎(스킨답서스 5 · 칼라데아 5) + 그루 2 | 12 | 24 | 36 |
| ③ 잎 단계 5 + 한눈에 1 | 6 | 12 | 18 |
| **합** | **47** | **94** | **141** |
| 재시도 몫(검수에 떨어진 줄만 · 안 쓰면 남음) | ≈ 10 | 20 | 30 |
⇒ 넉넉히 **≈ 170**(잔액 2,406.75 의 7%). 더 쓰라 하시면: 카드 `count: 3`(+40) · `quality: xhigh` 는 get_cost 로 먼저 잰 뒤.
※ 하프문-그린흰은 시험(P1·P2)과 본 줄 둘 다 있다 — 고른 결의 시험 그림이 검수를 넘으면 본 줄은 안 돌려도 된다(−3).

## 5. 받은 뒤 leaf 가 하는 일
1. 받을 곳 그대로 둔다(JSON `save_as` · count 2 면 `_a`·`_b` 꼬리) · 원본은 그대로 · 고른 것만 이름 없는 꼬리로.
2. 검수 §3 — 카드는 시트(같은 크기 27장 + 썸네일 나란히) · ② 는 PP·AL 원화와 나란히 · ③ 은 다섯 장 겹쳐 보기 · 숫자 칸(밝기·채도·알파)은 재서 적는다.
3. manifest 에 줄(name_ko 한글명 · 쓰일 자리) · `docs/dogam` 식물 칸에 카드 · leaf-index 에 적고 경로 박아 커밋 → push → 총괄에 «받은 것 · 고른 것 · 떨어진 줄».

---

## 7. 받은 것 · 최종 검수 (10-09 · 총괄 ad93be7e · 148장 · 2k · 407 크레딧)

장부 `assets/gen/hf_runs/leaf_20261009.json`(작업 번호 · 글 · 참조 · 재 놓은 값 · 2k 원본 자리) · 저장소 사본: 카드 PNG 1024 · ②③ JPEG q95 · 2k 원본은 저장소 밖 `빛식물/_hf_masters/`. manifest 72줄(줄마다 한 줄 · a/b 는 versions · `chosen_version` = leaf 고른 판 · batch `leaf_hf_20261009`).

**손질(크레딧 0 · 저장소 사본만 · 2k 원본은 그대로)** — `tools/leaf/hf_review1009.py`
- ① **잎끝 줄기 지움 81장.** 주문 글이 «잎자루는 아래로»라 했고 참조 썸네일은 잎자루가 «위 홈»이었다 — **주문표(leaf) 쪽 충돌**이다. 그래서 여러 장이 잎 끝(아래)에서 줄기가 났다(몬스테라·PP·AL 은 잎자루가 홈에 붙는다). 맨 아래 «폭이 고른 가는 줄»만 그 토막째 지웠다 — 뾰족한 잎끝(폭이 한결같이 늘어남)·같은 줄의 잎 갈래는 안 건드림 · 위 홈의 잎자루는 그대로 · 핑크-로즈핑크는 방사 갈래가 줄로 읽혀 뺐다. 전후 `img/leaf1009/cards_stub_fix.jpg`.
- ② **어두운 가족 밝힘** — 잎 밝기 0.25 못 넘던 갤럭시-다크틸 A·B · 차콜 A·B · 갤럭시-틸골드 B 를 V 감마(0.83~0.96)로 0.25 에. 가족 얼굴은 그대로(전후 눈으로).
- 다시 손질해도 바뀌는 것 0(두 번째 돌림 «손질 없음»).

**고른 판** — 한 벌 모아 보기 `img/leaf1009/cards_set_A.jpg` · `cards_set_B.jpg`(박사님 결 고르기용 · 27장씩)
- 결 A: 다 `_a` · 하프문-그린흰만 `_b`(반반이 깨끗).
- 결 B: `_b` = 네온라임 · 하프문-그린흰 · 하프문-그린크림 · 별무늬-그린흰 · 핑크민트 · 오로레아-골드 · 알보 — 다 «흰 테두리»(잎 밖 반투명 흰 화소)가 적은 쪽을 쟀다(네온라임 a 290‰ · 골드 a 69‰). 나머지 `_a`.
- ② 스킨답서스·칼라데아: SC2·SC3·SC4 a · SC5 b(흰 가장자리 깨끗) · CA1 b(a 는 잎끝에 새 잎) · CA2·CA3 a · CA4 b · CA5 a · 그루 둘 a. ⚠ 그루 그림 화분이 분홍(결 B 참조의 분홍을 끌고 옴) — growth 의 «덩굴·로제트» 기준 그림이라 그대로 쓴다.
- ③ 잎 단계: 풀림 b · 어린 a · 중간 b(«갈라짐 1~2») · 다 자람 a · 다음 잎 a · 띠 a. ⚠ 게임 `sceneArtOf` 는 `assets/illust/<이름>.png` 를 찾는다 — 이 판은 저장소에 JPEG(`_a/_b` 꼬리) · → **10-10 고른 판을 `assets/illust/ev_leaf_stage_{opening,young,mid,mature,axis,strip}.png`(1024 · 2k 원본에서)로 내보냈다** — core 는 `sceneArtOf` 에 이름만 건다(띠는 1024×579).

**다시 뽑기 3줄(글 고침 · 6장 16.5)** — `docs/handoff/leaf-higgsfield-order-20261009-r2.json`
- PP 무지 A·B: 무지 카드에 **옅은 초록 줄무늬**가 났다(무지가 무늬로 읽힘) · 밝기 0.17~0.19 → «완전 민무늬 · 중간 어두운 초록 · 홈에 잎자루»
- SC1: 두 장 다 잎끝에 **작은 새 잎**이 붙었다(3D 입력은 한 잎) → «한 잎만 · 새순 없음»

<!-- 아래 표는 tools/leaf/higgs_order1009.py 가 다시 쓴다 -->
### 표 ① 도감·카드 (결 A · 투명 바탕 · 1:1)
| # | 종 · 등급 · 가족 | 참조(모양·무늬) | save_as |
| --- | --- | --- | --- |
| 1 | 몬스테라 · 산반 · 스페클-그린크림 | `assets/monstera/skins/thumbs/mon_speckle_greencream.png` | `assets/illust/cards/card_mon_speckle_greencream.png` |
| 2 | 몬스테라 · 산반 · 제브라-그린흰 | `assets/monstera/skins/thumbs/mon_zebra.png` | `assets/illust/cards/card_mon_zebra.png` |
| 3 | 몬스테라 · 산반 · 별무늬-그린흰 | `assets/monstera/skins/thumbs/mon_star_greenwhite.png` | `assets/illust/cards/card_mon_star_greenwhite.png` |
| 4 | 몬스테라 · 산반 · 별무늬-그린옐로우 | `assets/monstera/skins/thumbs/mon_star_greenyellow.png` | `assets/illust/cards/card_mon_star_greenyellow.png` |
| 5 | 몬스테라 · 산반 · 별무늬-페일그린 | `assets/monstera/skins/thumbs/mon_star_palegreen.png` | `assets/illust/cards/card_mon_star_palegreen.png` |
| 6 | 몬스테라 · 산반 · 오로레아-그린옐로우 | `assets/monstera/skins/thumbs/mon_green_yellow.png` | `assets/illust/cards/card_mon_green_yellow.png` |
| 7 | 몬스테라 · 산반 · 라임-레몬패치 | `assets/monstera/skins/thumbs/mon_green_lemonpatch.png` | `assets/illust/cards/card_mon_green_lemonpatch.png` |
| 8 | 몬스테라 · 산반 · 네온-라임 | `assets/monstera/skins/thumbs/mon_neon_lime.png` | `assets/illust/cards/card_mon_neon_lime.png` |
| 9 | 몬스테라 · 하프문 · 하프문-그린흰 | `assets/monstera/skins/thumbs/mon_halfmoon_greenwhite.png` | `assets/illust/cards/card_mon_halfmoon_greenwhite.png` |
| 10 | 몬스테라 · 하프문 · 하프문-그린크림 | `assets/monstera/skins/thumbs/mon_halfmoon_greencream.png` | `assets/illust/cards/card_mon_halfmoon_greencream.png` |
| 11 | 몬스테라 · 하프문 · 갤럭시-틸골드 | `assets/monstera/skins/thumbs/mon_galaxy_tealgold.png` | `assets/illust/cards/card_mon_galaxy_tealgold.png` |
| 12 | 몬스테라 · 하프문 · 갤럭시-다크틸 | `assets/monstera/skins/thumbs/mon_galaxy_darkteal.png` | `assets/illust/cards/card_mon_galaxy_darkteal.png` |
| 13 | 몬스테라 · 하프문 · 별무늬-핑크민트 | `assets/monstera/skins/thumbs/mon_star_pinkmint.png` | `assets/illust/cards/card_mon_star_pinkmint.png` |
| 14 | 몬스테라 · 풀문 · 핑크-로즈핑크 | `assets/monstera/skins/thumbs/mon_variegata_pink.png` | `assets/illust/cards/card_mon_variegata_pink.png` |
| 15 | 몬스테라 · 풀문 · 오로레아-골드 | `assets/monstera/skins/thumbs/mon_variegata_gold.png` | `assets/illust/cards/card_mon_variegata_gold.png` |
| 16 | 몬스테라 · 풀문 · 핑크-로즈 | `assets/monstera/skins/thumbs/mon_rose_pink.png` | `assets/illust/cards/card_mon_rose_pink.png` |
| 17 | 몬스테라 · 풀문 · 모브-라벤더그레이 | `assets/monstera/skins/thumbs/mon_mauve.png` | `assets/illust/cards/card_mon_mauve.png` |
| 18 | 몬스테라 · 풀문 · 알보-전체흰 | `assets/monstera/skins/thumbs/mon_fullalbo.png` | `assets/illust/cards/card_mon_fullalbo.png` |
| 19 | 몬스테라 · 풀문 · 차콜-다크그린 | `assets/monstera/skins/thumbs/mon_charcoal.png` | `assets/illust/cards/card_mon_charcoal.png` |
| 20 | 몬스테라 · 무지 | `assets/monstera/thumbs/monstera_leaf_mature.png` | `assets/illust/cards/card_mon_plain.png` |
| 21 | 핑크프린세스 · 무지 | `assets/plants/pink_princess/thumbs/pp_leaf_mature.png` | `assets/illust/cards/card_pp_green.png` |
| 22 | 핑크프린세스 · 산반 | `assets/plants/pink_princess/skins/thumbs/pp_leaf_mature_pinkmarble.png` | `assets/illust/cards/card_pp_marble.png` |
| 23 | 핑크프린세스 · 하프문 | `assets/plants/pink_princess/skins/thumbs/pp_leaf_mature_pinkheavy.png` | `assets/illust/cards/card_pp_heavy.png` |
| 24 | 핑크프린세스 · 분홍 잎 | `assets/plants/pink_princess/skins/thumbs/pp_leaf_mature_allpink.png` | `assets/illust/cards/card_pp_pink.png` |
| 25 | 알로카시아 프라이덱 · 무지 | `assets/plants/alocasia/thumbs/al_leaf_mature.png` | `assets/illust/cards/card_al_plain.png` |
| 26 | 알로카시아 프라이덱 · 산반 | `assets/plants/alocasia/skins/thumbs/al_leaf_mature_marble.png` | `assets/illust/cards/card_al_marble.png` |
| 27 | 알로카시아 프라이덱 · 하프문 | `assets/plants/alocasia/skins/thumbs/al_leaf_mature_half.png` | `assets/illust/cards/card_al_sector.png` |

### 표 ② 스킨답서스·칼라데아 (결 B · 흰 바탕)
| # | 무엇 | save_as | 비율 |
| --- | --- | --- | --- |
| SC1 | 스킨답서스 · 어린잎(밑 모양) | `assets/raw/plants/scindapsus/SC1.png` | 1:1 |
| SC2 | 스킨답서스 · 중간잎(밑 모양) | `assets/raw/plants/scindapsus/SC2.png` | 1:1 |
| SC3 | 스킨답서스 · 성숙잎(밑 모양) | `assets/raw/plants/scindapsus/SC3.png` | 1:1 |
| SC4 | 스킨답서스 · 성숙 · 무늬 마블퀸 | `assets/raw/plants/scindapsus/SC4.png` | 1:1 |
| SC5 | 스킨답서스 · 성숙 · 무늬 엔조이 | `assets/raw/plants/scindapsus/SC5.png` | 1:1 |
| CA1 | 칼라데아 · 어린잎(오비폴리아) | `assets/raw/plants/calathea/CA1.png` | 1:1 |
| CA2 | 칼라데아 · 중간잎(오비폴리아) | `assets/raw/plants/calathea/CA2.png` | 1:1 |
| CA3 | 칼라데아 · 성숙잎(오비폴리아) | `assets/raw/plants/calathea/CA3.png` | 1:1 |
| CA4 | 칼라데아 · 중간 · 무늬 화이트퓨전 | `assets/raw/plants/calathea/CA4.png` | 1:1 |
| CA5 | 칼라데아 · 성숙 · 무늬 화이트퓨전 | `assets/raw/plants/calathea/CA5.png` | 1:1 |
| SC6 | 스킨답서스 · 그루 전체(덩굴) | `assets/raw/plants/scindapsus/SC6_whole.png` | 3:4 |
| CA6 | 칼라데아 · 그루 전체(로제트) | `assets/raw/plants/calathea/CA6_whole.png` | 3:4 |

### 표 ③ 잎 단계 (결 A · 사건 원화 결)
| 이름 | 대사(걸 자리) | 모양 참조 | save_as |
| --- | --- | --- | --- |
| ev_leaf_stage_opening | statusPhaseOpening «새순이 풀리기 시작했다» | `assets/monstera/thumbs/monstera_bud_opening2.png` | `assets/illust/ev_leaf_stage_opening.png` |
| ev_leaf_stage_young | statusPhaseYoung «잎이 다 펴졌다. 아직 연하다» | `assets/monstera/thumbs/monstera_leaf_young.png` | `assets/illust/ev_leaf_stage_young.png` |
| ev_leaf_stage_mid | statusPhaseMid «중간잎이야» | `assets/monstera/thumbs/monstera_leaf_mid1.png` | `assets/illust/ev_leaf_stage_mid.png` |
| ev_leaf_stage_mature | statusPhaseMature «다 자란 잎이야» | `assets/monstera/thumbs/monstera_leaf_mature.png` | `assets/illust/ev_leaf_stage_mature.png` |
| ev_leaf_stage_axis | statusPhaseAxis «다음 잎이 올라오고 있어. 줄기 끝을 봐» | `assets/monstera/thumbs/monstera_bud_furled.png` | `assets/illust/ev_leaf_stage_axis.png` |
| ev_leaf_stage_strip | 도움말·docs(한눈에 · 16:9) | 어린·중간·성숙·말린 순 넷 | `assets/illust/ev_leaf_stage_strip.png` |
