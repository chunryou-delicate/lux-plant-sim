# 클코 작업 요청 — ⑤ 식물 적합성 판정 (도구 종료선 마지막)

> tool.html에 "이 자리, 이 식물 적합?" 판정을 붙인다.
> 데이터는 이미 있음(plants.json 79종 + light_sources.json 10종).
> 로직만 붙이면 도구 종료선 도달 → 게임 시작점.
> 상세 설계: docs/db_review_and_step5.md 참고.

---

## 0. 지금 상황
```
있는 것:
- tool.html: 자리별 조도(lux) 계산 됨 (pointIllum → lux)
- data/plants.json: 식물 79종 (PPFD 범위 or level or unknown)
- data/light_sources.json: 광원 10종 (lux→PPFD 계수)
할 것:
- lux → PPFD 변환 → 식물 needPPFD와 비교 → "적합/부족/과광" 판정
- 도구에 "이 자리 식물 판정" UI (숫자 최소, 말로)
```

---

## STEP 1 — lux→PPFD 변환 모듈
```
- 자리 조도(lux) × 광원 계수 = PPFD
- 광원 계수는 light_sources.json에서 (조명마다 광원종류 지정)
- 자연광(창): sunlight 계수 0.0185
- ⚠ 퍼플등(led_redblue_grow): lux_to_ppfd = null
  → lux 변환 금지. "이 광원은 PPFD 직접 입력" 처리(또는 경고)
- (선택) DLI = PPFD × 조사시간(h) × 3600 / 1e6
```

## STEP 2 — 식물 적합성 판정 (데이터 3층 대응)
```
A층 (ppfd 있음):
   PPFD < ppfd_min          → "빛 부족 ❌"
   ppfd_min ≤ PPFD ≤ ppfd_max → "적합 ✅"
   ppfd_opt 근처(±15%)       → "최적 ⭐"
   PPFD > ppfd_max          → "과광 ⚠"
B층 (ppfd=null, level 있음):
   level 밴드로 대략 판정
   (저광 50-150 / 중간 100-250 / 밝은간접 200-400 / 직사 400+)
   → PPFD가 그 밴드 안이면 OK, 판정에 "대략" 명시
C층 (ppfd=null, level 불확실/unknown):
   "이 식물은 광요구 데이터 미상" → 판정 대신 "실험 모드"(지금은 표시만)
```

## STEP 3 — 판정 UI (식집사용, 숫자 최소)
```
겉(기본 표시):
  "이 자리, 몬스테라 딱 좋아요! ☀️"
  "빛이 좀 부족해요 🥶 더 밝은 창가로"
  "빛이 너무 세서 ⚠ 잎이 탈 수 있어요"
속(상세설정 켤 때만): PPFD 180 / 적정 100~250 / DLI 7.8
- 식물 선택 드롭다운(plants.json 목록) → 자리 판정
- 또는 자리마다 "여기 뭐 키울 수 있나?" → 적합 식물 목록
```

## STEP 4 — 조명에 광원종류 연결 (STEP1 전제)
```
- 지금 조명은 설치형태(상부/매립/벽/기둥)만 있음
- 광원종류(스펙트럼) 축 추가: 각 조명이 어떤 광원인지
  · 백색LED따뜻/시원, 형광, 식물등(풀스펙트럼/퍼플) 등
  · light_sources.json 의 id 참조
- 조명 = [설치형태] × [광원종류] 조합
- 기본값은 백색LED로 (대부분 실내조명)
```

---

## 핵심 원칙
```
- 기존 조도엔진(pointIllum) 건드리지 말 것. 그 위에 얹기만.
- 데이터(plants.json, light_sources.json)는 읽기만. 값 수정 X.
- unknown/null 식물은 "판정 불가"로 유지 (억지 판정 X).
- UI는 "말로" 먼저, 숫자는 상세설정에만.
- 각 STEP 브라우저 확인 후 다음. 되면 커밋·푸시.
```
