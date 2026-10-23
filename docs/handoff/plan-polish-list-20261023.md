# 다듬기 목록 — F 판 재료 (plan · 2026-10-23 · 모으기만 · 고치지 않음)

> 청: 총괄 D77(10-23) — B §12 · C §12 · D §9 · E §10 교차검사에서 나온 **낡은 글 · 낱말 어긋남 · 문서↔코드 어긋남**을 한 표로. 고치는 것은 F 판에서 임자 창이.
> 줄 번호는 10-23 저녁 기준(game.html 은 여러 창이 고쳐 줄이 밀리므로 함수 이름을 같이 적는다).
> «값이 바뀌나» = 고칠 때 판의 숫자·동작이 바뀌는가(✕ 글만 · ○ 값·동작 · ? 가르고 나서).

## 0. 박사님 첫 플레이 피드백 (비워 둠 — 오면 여기 맨 위에)

| # | 박사님 말(원문) | 어디서(방·날·화면) | 무엇이 걸렸나 | 임자 창 | 다듬기 칸 |
|---|---|---|---|---|---|
| | | | | | |

## 1. 문서 ↔ 코드 어긋남 — 규칙이 문서와 다르다 (먼저 가를 것)

| # | 자리 | 무엇 | 임자 | 값이 바뀌나 | 나온 곳 |
|---|---|---|---|---|---|
| 1-1 | src/game/propagation.js:377 «천장이 80% 다» | D40 어린 그루 ×2(상한 .9)로 삽수 새 잎 무늬율이 **중간·밝음 둘 다 90%** — 주석의 천장을 넘는다 · 밝음의 이득은 등급(풀문 .05 → .15)에만 | core(QUESTION · 총괄이 C 짓기 전에 가름) | ? 의도면 주석만 ✕ · 아니면 ○ | C §12 |
| 1-2 | src/game/state.js:404 · 726 `variegated: false` | 화분의 `variegated` 가 늘 false → 화분 어미 무지 마디 삽수는 영영 0% · `VARIE.variegatedMother 0.195` 안 쓰임 · job_shop `ctx.motherVarie` 넘기는 곳 없음 | core(QUESTION) | ? | C §12 |
| 1-3 | game.html(등급 장부 `pots[0]` 만) → shop.js:1953 · 1671 | 무늬 등급 장부는 첫 화분만 — 씨앗 그루 무늬 잎은 값 매길 때 산반으로 떨어진다 | core(QUESTION) | ? | C §12 |
| 1-4 | plant_grow.html:1859 «갈래 비율에는 빛 배율을 태우지 않는다(MAT_TREE)» | 게임은 등급(빛 밴드로 굴림)에서 뽑은 스킨으로 그림을 덮는다(shop.js `leafSkinsFor` → `setLeafSkins`) — 문서의 «빛은 나나 마나만»과 다름 | growth · core | ✕(글) · 판단 따라 ○ | C 지도 |
| 1-5 | src/game/loop.js:1327 «표시만. 차감 없음» · game.html 이 electricity.json 을 안 읽음 | 전기 요금이 실제로 안 빠진다 → characters.json 연구자 `electricityWaived` 가 차이를 안 냄 · `electricityRulesFrom` 은 검사만 부름 | core | ○(차감을 켜면 판 돈이 바뀜) | E §10 |
| 1-6 | data/balance/characters.json 칸 다섯(`household` · `monthlyIncome` · `electricityWaived` · `goalType` · `systems`) | 읽는 코드 0(E 를 지을 때 섬) | core | ○(E) | E §0 |
| 1-7 | game.html `hardReset` · `gameOverAgain` `localStorage.clear()` | 다시 시작이 세이브 밖 열쇠까지 지움 → E 의 «집 엔딩 본 적» 메타 열쇠와 부딪힘 | core | ○(E) | D §9 · E §0 |
| 1-8 | story_arc.md §5 «달력이 둘»(화면 `tutorial.seasonAt` 여름 45일차 · 빛 `weather.seasonOf(S.day)` 0 = 봄) | 지금도 오프셋이 남았는지 확인 안 함 — 새 판은 둘을 같게(E §1-3) | core | ? | E §1-3 |
| 1-9 | tools/test_balance_routes.mjs ③ «튜토 완주 30~50분(배속 10초/일)» | **50.9분 — 0.9분 넘침**(게임 258일 · 누름 157회 · 누름당 3초 가정). 바닥 사람(시루 1 고정 · 등 없이) 판이라 «안내대로»보다 길다 · D81 대로 붉게 둠(core 1533f7e7) | **총괄**(임자 판단 — 자를 고칠지 · 판을 고칠지) | ? | core 10-24 · 총괄 D81 ⑧ |

## 2. 낡은 글 — 코드는 맞고 글이 옛 값 (✕ 글만)

| # | 자리 | 낡은 글 → 지금 | 임자 | 상태 |
|---|---|---|---|---|
| 2-1 | game.html:12151 주석 «낙엽·고사 켬» | → 몬스테라 낙엽만 · 마지막 한 장 안 떨어짐 · 고사 없음 | core | 총괄이 넘김(D73) |
| 2-2 | docs/handoff/plan-shop-spec-20261010.md §4 · §7 «낙엽·고사» | 위와 같음 | plan | ✔ 고침(ef58b803) |
| 2-3 | data/growth_tuning.json 건강 글 «min 3.0» | → 2.7 | growth | ✔ growth 가 맞춤(«이 글은 2026-10-23 에야 값에 맞췄다») |
| 2-4 | src/game/save.js:259 «세대 감쇠(0.8ⁿ)» | → `genRise` 0 · 대로 안 오르내림 | core | 총괄이 넘김(D74) |
| 2-5 | docs/GAME_PLAN.md:718 · 806 «수경번식 무늬 80% 계승» | → 무늬 마디 삽수는 뿌리 낸 날 밝기(.20/.50/.80) · 무지 마디만 어미 값 | **박사님 허락 필요**(AGENTS.md) | 총괄이 여쭘 |
| 2-6 | docs/researcher_track.md:62 «희귀 잎당 2%» · §8 «80% 계승» | → 풀문 1/5/15% · 밝은 삽수 새 잎 풀문 ≈ 13.5% | plan | ✔ 정정 줄(cf5ff45f) |
| 2-7 | data/balance/varie_grades.json 옛 셈 «0.45×350,000» | → 지금 표 밝음 .35/.50/.15 · 기대값 670,000 | plan | ✔ 정정 줄(cf5ff45f) |
| 2-8 | data/balance/characters.json 자취생 줄(시작 100만 · 목표 150만 · `balance_provisional false`) | → 코드 시작 150만(tutorial.js:41) · 이사 200만(:59) · 엔딩 500만(homes.json ending) | plan(데이터 글) · core | ✕ 글 / ○ 줄을 코드에 잇게 하면 |
| 2-9 | data/balance/homes.json:46 «moveCost = 보증금 차액 100만 + 이사·복비 50만» | → 값 200만(:41) | plan | ✕ |
| 2-10 | characters.json:74 · homes.json:60 «학원교실 32슬롯» | → 128(house_rooms.json) | plan | ✕ |
| 2-11 | characters.json:55 «아파트 82슬롯» | → 83 | plan | ✕ |
| 2-12 | homes.json:32 «13슬롯이 전부 어두워» | → 반지하 15 | plan | ✕ |
| 2-13 | docs/GAME_PLAN.md §5 프리셋(빠른배속·느린배속·1:1) | → 박사님 «빨리감기는 없애. 하루넘기기만 살리자»(loop.js) | **박사님 허락 필요**(AGENTS.md) | — |
| 2-14 | game.html `openChapterEnd` 기본 글 «여기까지 — 첫 이야기»(ev_first_story_end) | 한 번도 안 뜬다(늘 진로 카드) — 낡은 것은 아니고 **D 마지막 덮개가 그 자리를 씀** | core · plan | D 나머지에서 |
| 2-15 | 할 일 탭 머리(game.html `homeGoalHtml`) 진로를 연 뒤에도 «내 집을 마련했습니다» | → 진로 칩 · 칭호(D §10-4) | core | 가게 끝맺음 판에서 |
| 2-16 | 주문판·맡김판·간판 자리 낱말(«문 앞» · «문 옆 벽» · «지나가는 사람도 알아») | → 판은 가게 방 뒷벽 창 옆 · 칠판 간판은 방 안 진열대 옆 바닥(house) | plan · core | ✔ plan 대사·명세 c02bb033 · f0f041a0 · core 화면 글 269077ed(시작 배너 «창 옆 …판» · 기록 줄 한 번) |

## 3. 낱말 · id 어긋남

| # | 자리 | 무엇 | 임자 | 값이 바뀌나 |
|---|---|---|---|---|
| 3-1 | hero_branch.js:17 · characters.json `breadwinner` · `housewife` ↔ 3D 파일 `char_*_gajang_*` · `char_*_jubu_*` · plan-branch-job-gender:57 `'gajang'|'jubu'` | 한 사람 두 id — 짝 표 없음 · room_view `CHAR_ASSET` 은 jachwi 만 | char · core | ✕(짝 표) |
| 3-2 | docs/GAME_PLAN.md «아파트 3.87 < 무늬종 4.2» ↔ house_rooms.json 아파트 «peak 9.75» | 평균과 peak 로 보인다(같은 자 아님) — **결론 내지 않음** · growth 가 avg7 로 다시 잴 때 가림 | growth · (GAME_PLAN 은 박사님 허락) | ? |
| 3-3 | house_rooms.json 방 메모 투룸 «facing_note: 거실 남향 / 침실 동향» ↔ 창 orient(침실 south · 거실 east) | 낱말만 거꾸로(house 가 10-10 에 적어 둠 · 안 고침) | house | ✕ |

## 4. 데이터 · 측정판 — 다시 굽거나 다시 잴 것

| # | 자리 | 무엇 | 임자 | 값이 바뀌나 |
|---|---|---|---|---|
| 4-1 | data/profiles/room_profile.{classroom|apartment|greenhouse}.json | 등 0 판만(`lampCounts [0]`) · roomRev 없음 | house · growth(누가 굽나 = 총괄) | ○(E 판 자람 숫자) |
| 4-2 | data/profiles/room_profile.greenhouse.json:890 `_house_warning` | «프로필 10.49 vs 라이브 14.55» — 낡음 | house · growth | ○ |
| 4-3 | data/house_rooms.json:861 교실 `_slot_cell_warning` | «창턱 자리 112칸이 겨눠도 안 붙는다» — 가장 판을 열기 전에 | house | ○(E 가장) |
| 4-4 | docs/handoff/growth-tworoom-shop.json meta(roomRev 08-23 · 10-09) | 가게 기준 배치 B(10-10)보다 앞 — B·C 판을 지을 때 다시 잼 | growth | ○(가드 문턱) |

## 5. 쓰이지 않는 것 · 빈 자리 (지울지 쓸지 — 정리만)

| # | 자리 | 무엇 | 임자 |
|---|---|---|---|
| 5-1 | assets/illust/ev_home_ending_meshy1.png | 어디서도 안 부름 | char |
| 5-2 | assets/illust/index.json | 장면 셋만 적힘(파일은 훨씬 많음) | char |
| 5-3 | 몬스테라 잎 바램·낙엽 | `advanceTo().leaves` 의 fade/drop 을 loop 가 안 넘김 → 사건 id 없음(B 에서 «못 씀»으로 뺌) | core · growth |

## 6. 이 목록을 다루는 법
- 1절(규칙이 문서와 다름)은 **판 숫자가 바뀔 수 있어** 총괄이 먼저 가른다 — 그 전엔 2·3절 글만 고쳐도 된다.
- «박사님 허락 필요»(2-5 · 2-13 · 3-2 의 GAME_PLAN 쪽)는 plan 이 손대지 않는다(AGENTS.md).
- 고친 줄은 이 표의 «상태»에 커밋을 적는다 — 줄을 지우지 않는다(다음 교차검사가 같은 것을 다시 찾지 않게).
