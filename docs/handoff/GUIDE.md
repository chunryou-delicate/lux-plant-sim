# 볕 길잡이 — 새 창이 제일 먼저 읽는 한 장

> 2026-11-02 총괄이 세웠다(박사님 «이 PDF 보고 반영할 만한 것 반영해» — 길잡이 문서 · 일 절차를 스킬로 · 정기 점검).
> 이 장은 **짧게 둔다.** 자세한 것은 아래 «어디로 가나» 표가 가리키는 곳에 있다. 이 장에 값·숫자·경과를 적지 않는다(낡는다).
> START-HERE.md(1,955줄) · STATUS.md · team-map.md 는 **역사**다. 필요할 때 grep 으로만 연다.

## 1. 지금 판 — 세 곳만 보면 된다

| 무엇 | 어디 | 누가 고치나 |
|---|---|---|
| 지금 어디까지 · 결정 표(D1~) · 밤낮 기록 | `docs/handoff/master-campaign-20261007.md` (§0-b · §3 · 기록) | 총괄 |
| 박사님께 보인 진행 보고(사진 판) | `docs/handoff/master-progress-YYYYMMDD.html` 가장 새 것 | 총괄 |
| 박사님 답을 기다리는 물음 | `docs/handoff/master-to-doctor-YYYYMMDD.md` 가장 새 것 | 총괄 |
| 큰 줄기 계획(단계 · 갈림목) | `docs/handoff/master-roadmap-YYYYMMDD.html` 가장 새 것 | 총괄 |

## 2. 창(세션)과 인계 자리

| 창 | 하는 일 | 남기는 자리(맨 위가 최신) |
|---|---|---|
| 총괄 `[Master] 대표` | 가름 · 끝 걸음 · 비판 판 · 박사님 보고 | 캠페인 문서 · 진행 보고 |
| core `claude-d7` | 게임 코드 · 자(probe/test) · 회귀 | `core-to-master.md` · `STATUS.md` core 절 머리 |
| plan `[Plan]게임 기획:전체시스템` | 글(대사 · 배너 · 할 일) · 기획 대조 | `plan-to-master.md` · `plan-to-core-*.md` |
| 비판 플레이어(판마다 새 서브에이전트) | 처음 하는 사람처럼 하고 비판 | `playtest-critic<N>-<날짜>.md` |

- 창끼리 말은 SendMessage. 받는 창이 꺼져 있으면 위 «남기는 자리» 맨 위에 적고 push 한다.
- 창 이름은 재시작 때 바뀐다. 이 표가 낡았으면 ListAgents 로 보고 고친다.

## 3. 일 종류마다 어디로 가나

| 하려는 일 | 먼저 열 것 |
|---|---|
| 게임 고치기 한 바퀴(작업 전 빨강 → 고침 → 회귀 → push → 보고) | 스킬 `.claude/skills/byeot-fix-cycle/SKILL.md` |
| 커밋 하나를 고정 판으로 걸어 재기(끝 걸음) | 스킬 `.claude/skills/byeot-walk/SKILL.md` · 도구 `tools/master/` |
| 비판 플레이어 판 띄우기 | 스킬 `.claude/skills/byeot-critic/SKILL.md` |
| 박사님 진행 보고 html | 스킬 `.claude/skills/byeot-progress-report/SKILL.md` |
| 값(돈 · 체력 · 빛 문턱 · 집값) | `data/balance/*.json` — 코드에 숫자를 박지 않는다 |
| 할 일 사슬 · 퀘스트 열쇠 | `src/game/quest.js` |
| 반지하 사건 카드 | `src/game/events_banjiha.js` · 글은 `plan-events-banjiha-d96.md` |
| 원룸 · 이사 · 내 집 마련 · 엔딩 | `src/game/oneroom.js` · `ending.js` · `data/balance/homes.json` · 되묻기 창은 `game.html` (`contract.js` 는 집 계약이 아니라 빛 계약 검증이다) |
| 손가락 · 배너 · 말풍선(화면) | `game.html`(hintAt · markLive 근처) |
| 글 쓰기 · 대 보기(몬이 대사 · 배너 · 할 일 글) | 몬이 대본 `src/game/dialogue.js`(EVENT_SCRIPT · scriptOf) · 할 일 글 `quest.js` 의 todo · 화면 글 `game.html` 의 `*_KO` 상수 · plan 이 넘긴 글 `plan-to-core-*.md` 가장 새 것. 몬이는 수를 말하지 않는다 · 거짓 줄을 안 쓴다 · 새 줄마다 «참인 조건»을 단다 · 스킬 `.claude/skills/byeot-plan-lines/SKILL.md`(글 넘기기) · `.claude/skills/byeot-plan-verify/SKILL.md`(core 해시 대 보기) |
| 하네스 숫자(날 돌려 셈) | `tools/probe_branches.mjs` — ⚠ `tools/_out/branches.json` 을 덮는다 |

## 4. 규칙 — 어기면 사고가 났던 것만

1. 박사님과는 존댓말 · 한글로(중간 한 줄까지). 문서 본문은 평서체. 다른 창·서브에이전트에 맡길 때 이 줄을 그대로 넣는다:
   «답변과 진행 메시지를 모두 한국어로 쓴다 · 원래 언어로 두는 것: 고유 명사, 코드 식별자, 명령어, 파일 경로, 인용한 원문 · 서브에이전트나 다른 세션에 일을 맡길 때는 지시에 이 규칙을 그대로 넣는다»
2. 작업 트리 하나를 여러 창이 쓴다. ⛔ `git add .` · pull · stash · autostash · `checkout --` · 새 worktree. 커밋은 경로를 박아서(`git commit -- <파일>` · 새 파일은 `git add -- <파일>` 먼저), 커밋 전 `git diff -- <파일>` 로 내 줄만인지 본다. 커밋 뒤 바로 push · 거절되면 멈추고 총괄에게.
3. 검사와 커밋을 한 명령에 엮지 않는다. «초록»은 exit=0 을 본 것만. 안 돈 검사는 초록이 아니다.
4. 시험 서버는 `127.0.0.1`(localhost 는 거짓 고장). 헤드리스 크롬은 창마다 하나 · 빈 메모리 4GB 이상 · `--mute-audio` · 그래픽카드(d3d11 · `CDP_GL=gpu`) · 끌 때 CDP `Browser.close`.
5. ⛔ 파일 삭제는 박사님 직접 금지다(Temp 의 시험 복사본 · 프로필 포함 · 박사님 답 전까지).
6. 게임 방향(다음 판 · 새 계통 · 새 종 · 진로 · 큰 값)은 박사님께 여쭌다(추천 + 까닭 + 다른 길). 보이게 하기 · 덜 귀찮게 · 말 맞추기는 총괄이 정한다(D95).
7. 자(probe)는 작업 전 판에서 빨강부터 본다. 자의 «탈»은 빨강이다. `catch {}` 로 삼키지 않는다. 사진은 직접 본다.
8. CRLF 문서(캠페인 문서 등)는 Python `io.open(..., newline='')` 로 고친다. sed -i 금지.
9. 시각은 `date` 로 읽고 적는다.

## 5. 스킬은 쓰면서 고친다

- 스킬마다 맨 아래 «고친 기록»이 있다. 그 절차로 일하다 실패하면 «실패 → 까닭 → 고친 줄»을 적는다.
- 고친 줄은 **다음 번 그 절차에서 실제로 통과한 것을 본 뒤에** ✓ 를 붙인다. 그 전엔 «확인 전»이다(검증 없이 고친 절차를 믿지 않는다).
- 같은 일을 두 번 손으로 했으면 스킬 후보다. 총괄에게 말하고 만든다.
