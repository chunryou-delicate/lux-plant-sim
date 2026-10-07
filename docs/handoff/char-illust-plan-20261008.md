# 사건 원화 다시 칠하기 · 원룸·엔딩 장면 — 계획 (char · 2026-10-08)

총괄 판 ③④ · 결정 D3(주인공 정본 = 초상화 · `assets/characters/LOOK.md`).
⛔ **10-08 02시 Higgsfield 연결이 끊겨 있다**(`MCP server "claude.ai Higgsfield" is not connected`) — 생성은 하나도 안 했다.
다시 잇는 일은 박사님이 claude.ai 커넥터 설정에서 해야 한다(Kling 도 같은 처지).

## 지금 있는 것 — 왜 다시 칠하나
`assets/illust/ev_*`(2400×1792) 는 도감(`docs/dogam/data_items.json`)만 쓴다. 게임 코드는 안 부른다.
- 몬이: 화분 없는 «초록 공룡»으로 그려졌다 — 정본(테라코타 화분에 든 새싹 · 몬스테라 잎)과 다르다
- 주인공: 수채 갈색 머리 · 청바지 — 정본(긴 생머리 · 일자 앞머리 · 아주 짙은 갈색 · 크림 티)과 다르다

## 그릴 것과 파일 이름
기존 이름 꼴(`ev_<사건>_<판>.png`)을 따른다. 새 판은 끝에 `_v2` 를 붙여 옛 판을 덮지 않는다.

| 사건 | 파일 | 장면 |
|---|---|---|
| 몬스테라 도착 | `ev_monstera_arrive_v2.png` | 어두운 반지하 · 가방 속 줄기 하나뿐인 화분을 들여다보는 주인공 · 곁의 몬이 |
| 첫 무늬 | `ev_first_varie_v2.png` | 창턱의 몬스테라 · 흰 무늬 섞인 새 잎 · 놀란 주인공 · 기뻐하는 몬이 |
| 반지하 떠나기 | `ev_moveout_v2.png` | 상자 몇 개 · 몬스테라 화분을 안고 계단을 오르는 주인공 · 몬이 |
| ★ 원룸 도착 | `ev_oneroom_arrive.png` | 높은 창으로 빛이 드는 빈 원룸 · 상자 · 화분을 내려놓는 주인공 |
| ★ 원룸 첫날 | `ev_oneroom_firstday.png` | «바깥이 그대로 들어와»(plan D1 문안) — 창밖 계절빛 · 창가 몬스테라 · 몬이 |
| ★ 내 집 마련(엔딩) | `ev_home_ending.png` | 내 집 문 앞/창가 · 잘 자란 몬스테라와 삽수 화분들 · 주인공과 몬이 |

엔딩 화면은 아직 없다(`src/game/ending.js` 는 규칙 뼈대뿐 · 그림 이름 칸 없음) ⇒ 위 이름을 core 에 알리고 붙일 때 그대로 쓴다.

## 주문 — 붙여 쓸 것
참조 그림: `assets/characters/portraits/portrait_jachwi_neutral.png` · `portrait_moni_neutral.png`(기쁜 장면은 `_cheer`). 둘을 올려 «같은 인물» 참조로 건다.
프롬프트 = 장면 한 줄 + LOOK.md 의 자취녀 블록 + 몬이 블록 + **몸 절(아래 그대로)**:
```
CRITICAL: the character MUST still be sitting inside the SAME terracotta flower pot,
and its arms MUST still be the big monstera leaves with splits and holes.
Do not remove the pot. Do not remove the leaves. Do not give it a shell.
```
(LOOK.md 실측: 이 절을 빼면 세 번 중 세 번 화분·잎이 사라졌고, 넣으면 두 번 다 지켰다)

## 고르는 자 — 사건마다 3~5장 뽑아 하나
1. 머리: 긴 생머리 · 일자 앞머리 · 아주 짙은 갈색(검정 아님) — 단발·묶음·곱슬이면 탈락
2. 옷: 크림·아이보리 반팔 티 — 흰 티면 탈락
3. 몬이: 테라코타 화분 안 · 몬스테라 잎 · 사람의 38% 크기 — 화분·잎 하나라도 없으면 탈락
4. 화풍: 2D 납작 만화체 — 3D·클레이면 탈락
5. 장면 사실: 반지하는 창이 높고 어둡다 · 원룸은 밝다 · 몬스테라는 그 사건의 잎 수에 맞다
6. 손가락·글자 깨짐 없음
고른 까닭은 장마다 한 줄씩 이 파일 아래에 적는다.

## 못 한 것
- 생성 0장(연결 끊김). 크레딧 미사용
