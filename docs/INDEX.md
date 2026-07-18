# 볕(byeot) · lux-plant-sim — 마스터 인덱스

> 이 파일 하나만 주면 프로젝트 전체 맥락을 잡을 수 있게 한 요약 + 문서 링크 모음.
> 필요한 세부는 아래 raw 링크를 열어서 확인 (WebFetch). 링크는 `main` 기준(항상 최신).

---

## 한 줄 정체
**"빛이 진짜"** — 물리 기반 실내 조도(lux/PPFD) 엔진 위에 두 개의 껍데기:
1. **LUX·CAST**(`tool.html`) — 정밀 실내 조도/식물 적합성 도구 (도구 종료선 도달)
2. **볕 게임**(`plant_grow.html` 등) — 저폴리 3D 식물 키우기 게임 (현재 집중)

헌법: *얕게 누구나 / 깊게 덕후 · 엔진 먼저, 게임 항상 염두 · 데이터는 깊게 기본플레이는 단순 · 한 번에 하나씩.*
타깃: 식집사/식물애호가(조명 전문가 아님). 리포: `chunryou-delicate/lux-plant-sim`.

---

## 현재 진행 (2026-07 기준)
**몬스테라 생장 생성기**(`plant_grow.html`)를 정밀 상태전이 로직으로 구축 중.
- 마디 상태전이: 분홍(대기 thin/med) → 랜덤 활성 → 초록(thick)/드물게 하늘(main)
- petiole가 자라 2개로 분화 → 자식 대기마디 / 잎은 병렬 성숙(furled→opening2→young→mid1|2→mature)
- 성숙(갈라진)잎은 랜덤 확률(matureProb)로만 / 줄기는 종류별 고정 굵기 / 랜덤 4요소로 개체 고정
- 실시간 튜닝 패널(전체 A + 에셋별 B) · ⭐영구저장(localStorage) · 📋복사/내보내기(JSON)
- 근거 문서: **몬스테라_생장로직_정밀.md**, **모듈형_식물성장.md**

---

## 실행 파일 (코드)
- `plant_grow.html` — 몬스테라 생장 생성기(현재 작업 핵심)
- `tool.html` — LUX·CAST 조도/적합성 도구
- `loader_glb.html` — GLB 로더 테스트(직교 4방위)
- `assets_gallery.html` — 몬스테라 에셋 갤러리
- `index.html` — 3D 게임뷰(초기) / `prototypes/` — 초기 프로토들
- `data/plants.json`(식물 79종) · `data/light_sources.json`(광원 10종)
- `assets/monstera/*.glb` — 몬스테라 부품 GLB 13종

앱 raw(코드 공유용):
`https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/plant_grow.html`
`https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/tool.html`

---

## 문서 (필요시 열기)

### ★ 방향·기획 (먼저 읽기)
- **전체 마스터플랜/헌법/로드맵** — byeot_plan.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/byeot_plan.md
- **게임 코어 설계**(캐릭터 다이얼·경제·이사·2단계 목표) — game_design_core.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/game_design_core.md
- **게임 첫 루프 착수**(하루 넘기기·성장) — game_first_loop_start.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/game_first_loop_start.md
- **에셋 먼저 방향전환**(AI 파이프라인·MVP 세트) — game_assets_first.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/game_assets_first.md
- **로드맵 최신화** — roadmap_update.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/roadmap_update.md

### ★ 몬스테라 생장 로직 (plant_grow.html 근거)
- **성장 상태전이 정밀 스펙**(분홍→초록/하늘, petiole 분화, 잎 병렬성숙) — 몬스테라_생장로직_정밀.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/%EB%AA%AC%EC%8A%A4%ED%85%8C%EB%9D%BC_%EC%83%9D%EC%9E%A5%EB%A1%9C%EC%A7%81_%EC%A0%95%EB%B0%80.md
- **모듈+알고리즘 프로시저럴 생성 전략** — 모듈형_식물성장.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/%EB%AA%A8%EB%93%88%ED%98%95_%EC%8B%9D%EB%AC%BC%EC%84%B1%EC%9E%A5.md

### 도구(LUX·CAST)·데이터·작업요청
- **도구 종료선 정의**(어디까지) — tool_stopline.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/tool_stopline.md
- **DB 검증 + ⑤ 적합성 판정 설계** — db_review_and_step5.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/db_review_and_step5.md
- **⑤ 식물 적합성 판정 작업요청** — byeot_cc_step5.md / byeot_cc_step5-2.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/byeot_cc_step5.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/byeot_cc_step5-2.md
- **식물 DB 자율수집 스키마/요청** — byeot_cc_db_collection.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/byeot_cc_db_collection.md
- **방 그리기 v4 작업요청** — byeot_cc_room_draw_v4.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/byeot_cc_room_draw_v4.md
- **3D 렌더 착수 작업요청 v3** — 클코_작업요청_v3.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/%ED%81%B4%EC%BD%94_%EC%9E%91%EC%97%85%EC%9A%94%EC%B2%AD_v3.md

### 에셋·정리·기타
- **CC0/무료 에셋 출처**(Kenney·Quaternius 등) — asset_sources.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/asset_sources.md
- **assets/ 샘플 GLB 출처·라이선스** — assets/SOURCES.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/assets/SOURCES.md
- **도구 TODO 정리** — 조도툴_TODO_정리.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/%EC%A1%B0%EB%8F%84%ED%88%B4_TODO_%EC%A0%95%EB%A6%AC.md
- **준비물/재료 인벤토리** — 준비물_인벤토리.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/%EC%A4%80%EB%B9%84%EB%AC%BC_%EC%9D%B8%EB%B2%A4%ED%86%A0%EB%A6%AC.md
- **프로젝트 이관 정리** — 클코_이관정리.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/docs/%ED%81%B4%EC%BD%94_%EC%9D%B4%EA%B4%80%EC%A0%95%EB%A6%AC.md
- **리포 개요** — README.md
  https://raw.githubusercontent.com/chunryou-delicate/lux-plant-sim/main/README.md

---

## 사전 제작 에셋 (assets/existing/)
Gemini 등으로 미리 만든 참조/원화 이미지 51개(~77MB). 나중에 게임 에셋으로 사용 예정.
(바이너리라 raw로는 Claude가 못 읽음 — 필요시 이미지 자체를 첨부.)
