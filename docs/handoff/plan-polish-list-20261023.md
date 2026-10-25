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
| 1-1 | src/game/propagation.js:377 «천장이 80% 다» | D40 어린 그루 ×2(상한 .9)로 삽수 새 잎 무늬율이 **중간·밝음 둘 다 90%** — 주석의 천장을 넘는다 · 밝음의 이득은 등급(풀문 .05 → .15)에만 | core(QUESTION · 총괄이 C 짓기 전에 가름) → **✔ D82: 값은 그대로 · 박사님 첫 플레이 뒤 다시 봄**(C① «밝은 자리의 이득은 등급뿐») | ✕ 지금은 안 바꿈 | C §12 · 총괄 10-24 |
| 1-2 | src/game/state.js:404 · 726 `variegated: false` | 화분의 `variegated` 가 늘 false → 화분 어미 무지 마디 삽수는 영영 0% · `VARIE.variegatedMother 0.195` 안 쓰임 · job_shop `ctx.motherVarie` 넘기는 곳 없음 | core(QUESTION) → **✔ D83 ①: `variegated` 는 false 그대로** — 그 칸은 «무늬종 광량 문턱 ×1.4» 스위치(light_thresholds `variegated`)라 켜면 모주 최적 5~11 → 7~15.4 로 판 전체 자람이 바뀐다. 무늬 잎이 있는지는 core 가 따로 잰다(74719b0f growth_adapter §varieChanceNow · loop §motherVarieOf → 가게 `ctx.motherVarie`) · 화분 어미 무지 마디 삽수 = 0 은 core 가 정함(같은 커밋 · 실제 알보 결 — `variegatedMother` .195 → 0) | ✕ 지금은 안 바꿈 | C §12 · 총괄 D83 |
| 1-3 | game.html(등급 장부 `pots[0]` 만) → shop.js:1953 · 1671 | 무늬 등급 장부는 첫 화분만 — 씨앗 그루 무늬 잎은 값 매길 때 산반으로 떨어진다 | core(QUESTION) → **✔ 고침(core 74719b0f)**: 장부를 화분마다(씨앗 그루까지) — 씨앗 그루 무늬 잎이 제 등급 값을 받는다 · probe_seed_ledger PASS | ○(씨앗 그루 무늬 잎 값) | C §12 · 총괄 D82 ④ |
| 1-4 | plant_grow.html:1859 «갈래 비율에는 빛 배율을 태우지 않는다(MAT_TREE)» | 게임은 등급(빛 밴드로 굴림)에서 뽑은 스킨으로 그림을 덮는다(shop.js `leafSkinsFor` → `setLeafSkins`) — 문서의 «빛은 나나 마나만»과 다름 | growth · core | ✕(글) · 판단 따라 ○ | C 지도 |
| 1-5 | src/game/loop.js:1327 «표시만. 차감 없음» · game.html 이 electricity.json 을 안 읽음 | 전기 요금이 실제로 안 빠진다 → characters.json 연구자 `electricityWaived` 가 차이를 안 냄 · `electricityRulesFrom` 은 검사만 부름 | core | ○(차감을 켜면 판 돈이 바뀜) | E §10 |
| 1-6 | data/balance/characters.json 칸 다섯(`household` · `monthlyIncome` · `electricityWaived` · `goalType` · `systems`) | 읽는 코드 0(E 를 지을 때 섬) | core | ○(E) | E §0 |
| 1-7 | game.html `hardReset` · `gameOverAgain` `localStorage.clear()` | 다시 시작이 세이브 밖 열쇠까지 지움 → E 의 «집 엔딩 본 적» 메타 열쇠와 부딪힘 | core | ○(E) | D §9 · E §0 |
| 1-8 | story_arc.md §5 «달력이 둘»(화면 `tutorial.seasonAt` 여름 45일차 · 빛 `weather.seasonOf(S.day)` 0 = 봄) | 지금도 오프셋이 남았는지 확인 안 함 — 새 판은 둘을 같게(E §1-3) | core | ? | E §1-3 |
| 1-9 | tools/test_balance_routes.mjs ③ «튜토 완주 30~50분(배속 10초/일)» | **50.9분 — 0.9분 넘침**(게임 258일 · 누름 157회 · 누름당 3초 가정). 바닥 사람(시루 1 고정 · 등 없이) 판이라 «안내대로»보다 길다 · D81 대로 붉게 둠(core 1533f7e7) | **총괄**(임자 판단 — 자를 고칠지 · 판을 고칠지) | ? | core 10-24 · 총괄 D81 ⑧ |
| 1-10 | 씨앗 그루 무늬(plant_grow §calcVarieProb — 모주와 같은 한 줄로 잎마다 굴림 · 프롤로그 축복 없음) | 박사님 캐논 «잎마다 따로 · 기본 20%» 그대로 — core tools/probe_seed_varie.mjs: 투룸 진짜 날씨 120일에 무늬 낸 그루 **3~4/10 · 잎 중 13~14%**(DLI 못 박음 7 이상이면 60일 안에 10/10 · 잎 중 48~81% — 윗값). 장부를 넓힌 뒤(1-3) 그 잎이 제 등급 값을 받는다(전엔 산반). ⚠ 실제 알보는 씨앗으로 이어지지 않는다(키메라) — 게임은 씨앗 그루도 무늬를 낸다 | 총괄 → **✔ D83 ②: 캐논대로 그대로 · 박사님 첫 플레이 뒤 다시 봄** | ✕ 지금은 안 바꿈 | core 74719b0f · 총괄 D83 |

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

## 6. 그림 · 장면 — 실제 판에서 다시 볼 것

| # | 자리 | 무엇 | 임자 | 값이 바뀌나 | 나온 곳 |
|---|---|---|---|---|---|
| 6-1 | 끝맺음 아침 장면(진로 카메라 · 투룸 배치 B 진열대) | 진열대의 AL 구근 화분(잎이 없거나 적음)이 흙 컵처럼 보여 `shopEnding` 둘째 줄 «선반마다 내가 늘린 그루다»와 그림이 약하게 맞는다. house 사진 docs/handoff/img/house_20261024/jobcam_tworoom_b_390.webp — 하네스 세이브 shop71 손(하네스가 구근을 진열대에 많이 둔 판일 수 있음) · **실제 판에서 다시 본다**. 후보(가르지 않음): ㉠ 그림 그대로 ㉡ 구근 화분에 흙 위 싹·표지 ㉢ core `fewPlants` 셈(둘째 줄 갈래 «오늘은 무엇부터 늘릴까»)이 잎 0 구근 화분을 «그루»로 치는지 보기 | core · house | ? | 총괄 D85 ⑤ |
| 6-2 | 가게 끝맺음 장면(Day 845) 할 일 알림 — 줄은 game.html §drawJourney 안내 표 `complete` | 튜토리얼 끝 줄 first_play complete «말린 새순이 나왔습니다! 어두운 자리와 밝은 자리를 모두 찾았습니다.»가 뜬다. a9b6ed87 판에도 있어 D 고장은 아니다. 가게 할 일이 다 끝나 보여 줄 줄이 없을 때 튜토리얼 줄로 떨어지는 것으로 보인다 — test_questui 빨강과 같은 뿌리인지 core 가 가른다. **✔ af972daf 고침**(core) — 뿌리: 가게 사슬을 다 끝낸 날(Day 844 · 845) 열린 할 일이 없어 첫 플레이 끝 줄(`quest[fp.phase]`)로 떨어졌다 · 이사한 뒤엔 열린 할 일 → 진로 머리 줄 → 없으면 칩 숨김(새 글 없음) · test_questui 빨강(c0f06196)은 밥상 쪽 다른 뿌리(0a2ad853 고침). 줄은 §8 대로 남김(총괄 10-25) | core | ✕ 화면만 | 총괄 다시 걸음 9f7263d2 사진 · 캠페인 §5 ②(760a7b98) |
| 6-3 | 가게 끝맺음 뒤 할 일 판 머리(game.html §jobHeadHtml 칭호 칩 줄) | 손짓 말풍선 «여기를 눌러 보세요»가 칭호 칩 «동네 식물 가게 · 단골 30명»을 덮는다(end30_quest 사진 · 작음). **✔ af972daf 고침**(core) — 뿌리: 9f7263d2 가 할 일 머리 줄에 넣은 [진로 바꾸기] 글자 단추를 손가락이 «일하는 단추»로 잡았고, 위가 막혀 왼쪽으로 선 말풍선이 칩을 덮었다 · 고침: 글자 단추는 안 짚음(예전처럼 [✕]) · 말풍선이 머리 줄 글 자리를 비킴(360 · 390 · 430 잼). 줄은 §8 대로 남김(총괄 10-25) | core | ✕ 화면만 | 총괄 다시 걸음 9f7263d2 사진 · 캠페인 §5 ③(760a7b98) |

## 7. 판 걸음 — 하네스가 기준에 못 닿고 넘긴 것 (박사님 첫 플레이 뒤 다시 봄)

| # | 무엇 | 숫자 | 까닭(잰 것) | 후보(지금 안 함) | 임자 | 근거 |
|---|---|---|---|---|---|---|
| 7-1 | 육종 «귀띔을 따르는 사람»(breedH) 2년 안 품종 3 | **3/10**(기준 5/10 · 관리하는 사람 breedR 10/10 · 아무렇게나 breedB 0/10) · 칸별 2년 안 등록 판 하프문 3 · 풀문 1 · 마블 4 · 반달 4 · 분홍 많음 7 | 뿌리 자리 귀띔(hintBreedRootSpot)이 늦게 뜸 — 어두움 표본 다섯이 쌓여야 떠서 연 뒤 중앙 258일 · 상점 구근 싹 무늬가 드묾(9/50) · AL 갈래 귀띔(hintBreedAlKinds)은 6/10 판에서 358일 | ㉠ 뿌리 자리 귀띔을 더 일찍(어두움 표본 문턱을 낮춤) ㉡ 진로 첫날 몬이가 «뿌리 낼 자리» 한 줄 ㉢ 기록장 셈 막대(밝기별)를 사람이 읽으면 하네스와 달라짐 — 첫 플레이에서 봄 | plan · core | core b8f90e5e(`probe_branches --persona breedH --breedgap`) · 73ef283b · D 커밋의 하네스 · 총괄 D86~D88 · 귀띔 다섯 fed58db3 · c1ad629b · b04f4e4e |

## 8. 이 목록을 다루는 법
- 1절(규칙이 문서와 다름)은 **판 숫자가 바뀔 수 있어** 총괄이 먼저 가른다 — 그 전엔 2·3절 글만 고쳐도 된다.
- «박사님 허락 필요»(2-5 · 2-13 · 3-2 의 GAME_PLAN 쪽)는 plan 이 손대지 않는다(AGENTS.md).
- 고친 줄은 이 표의 «상태»에 커밋을 적는다 — 줄을 지우지 않는다(다음 교차검사가 같은 것을 다시 찾지 않게).
