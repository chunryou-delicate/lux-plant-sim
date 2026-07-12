# 클코 자율 작업 지시서 — DB 수집 & 준비 (2026-07-12)

> 자리 비운 동안(4~5h) 돌릴 작업. 순서대로, 각 단계 끝나면 커밋·푸시.
> ★ 최우선 원칙: 모르는 값은 지어내지 말 것. unknown 표시. (가짜 데이터 금지)

---

## ⚠ 절대 원칙 (반복 확인)

```
1. 출처 없는 값 = 지어내지 말 것 → "unknown" 또는 null + note
2. 출처 여러 개가 다르면 → 범위로 기록 + 출처 병기 (상충 명시)
3. 각 단계(①②③④) 끝날 때마다 커밋·푸시 (중간 멈춰도 건지게)
4. 기존 코드(tool.html, 엔진) 건드리지 말 것 → 이건 데이터 수집만
5. 막히면 그 항목 비우고 다음으로 (막히면 멈추지 말고 스킵)
```

---

## ① 식물 광요구 DB (최우선·제일 오래) → data/plants.json

### 목표: 80종 (흔한 실내식물 위주 + 식집사 인기·희귀종)
```
1군 (흔한 실내식물 ~50종): 데이터 확실한 것
  몬스테라, 포토스, 스파티필름, 산세베리아(스투키), 필로덴드론(여러종),
  칼라데아, 마란타, 아글라오네마, 스킨답서스, 디펜바키아, 드라세나,
  고무나무(피커스), 피들리프, 벤자민, 아레카야자, 켄차야자,
  스투키, 아스플레니움, 프테리스, 호야, 립살리스, 박쥐란,
  다육류(에케베리아, 하월시아, 세덤, 립살리스), 선인장류,
  허브류(바질, 로즈마리, 민트, 타임), 상추, 방울토마토, 관음죽 등
2군 (인기·희귀 ~30종): 데이터 있는 것만, 없으면 unknown
  몬스테라 알보/타이컨스텔레이션, 아글라오네마 희귀종,
  필로덴드론 핑크프린세스/글로리오섬, 산세베리아 희귀종,
  칼라데아 화이트팬텀, 안스리움 희귀종, 호야 희귀종 등
```

### 각 종별 항목 (스키마)
```json
{
  "id": "monstera_deliciosa",
  "name_ko": "몬스테라 델리시오사",
  "name_en": "Monstera deliciosa",
  "category": "관엽",              // 꽃/관엽/허브/다육/난/분재
  "light": {
    "level": "밝은간접",           // 저광/중광간접/밝은간접/직사
    "ppfd_min": 100, "ppfd_opt": 175, "ppfd_max": 250,  // µmol/m²/s
    "dli_min": 4, "dli_max": 9,     // mol/m²/day
    "direct_ok": false,             // 직사광 견딤?
    "low_light_tolerant": false
  },
  "care": {
    "water": "겉흙 마르면",         // 건조선호/보통/습윤
    "overwater_risk": "high",       // 과습 위험
    "humidity": "medium",           // low/medium/high
    "difficulty": "easy"            // easy/medium/hard
  },
  "special": {
    "variegated": false,            // 무늬종?
    "variegation_light": null,      // 무늬 유지 광량대 (무늬종만)
    "rarity": "common"              // common/uncommon/rare
  },
  "sources": ["soltech.com", "ariumology.com"],  // 출처
  "notes": ""                       // 상충·불확실 메모
}
```

### 참고 출처 (신뢰도 높음)
```
- soltech.com/pages/plant-light-calculator (136종 PPFD/DLI)
- ariumology.com (2026 HortScience 기반)
- houseplantjournal.com (분광기 실측)
- growlightmeter.com/photone, medicgrow.com
※ 값 다르면 범위로. 출처 병기. 없으면 unknown.
```
→ ✅ 끝나면 커밋: "식물 DB 80종 수집 (plants.json)"

---

## ② 광원별 lux→PPFD 계수 + 파장 (짧음) → data/light_sources.json

```json
{
  "id": "led_daylight",
  "name_ko": "백색LED 주광색(5000K+)",
  "lux_to_ppfd": 0.0185,          // µmol/m²/s per lux
  "spectrum_tag": "cool",          // warm/cool/growlight/natural
  "rb_ratio": "B높음",             // 적:청 특성 (Lv2용, 대략)
  "far_red": "low",
  "sources": ["houseplantjournal.com"],
  "notes": ""
}
```
```
광원: 자연광 / 백색LED 전구색(2700K)·주광색(5000K+) / 형광 /
     할로겐·백열 / 적청식물등(purple) / 풀스펙트럼식물등
※ 적청식물등: lux→PPFD 비례 깨짐 → note에 "직접 PPFD 필요" 명시
```
→ ✅ 끝나면 커밋: "광원 계수화 (light_sources.json)"

---

## ③ 무료 저폴리 에셋 소스 조사 → docs/asset_sources.md

```
⚠ 여기선 "만들지" 말 것. 어디서 구하는지 "조사"만.
- 저폴리 3D 가구·식물·화분 무료/유료 소스
  (Sketchfab, Poly Pizza, Kenney, Quaternius, itch.io 등)
- 각 소스: URL + 라이선스(상업이용 가능?) + 포맷(glTF/obj) + 저폴리 여부
- Three.js 로 불러오기 쉬운 포맷(glTF/GLB) 우선 표기
```
→ ✅ 끝나면 커밋: "에셋 소스 조사 (asset_sources.md)"

---

## ④ 게임 설계 반영 + data 스키마 이식 → docs/ + data/

```
- 첨부된 game_design_core.md 를 docs/ 에 넣기
- 그 문서의 데이터 구조 기반으로 이식 json 스키마 만들기:
  · data/characters.json  (주부/연구자/가장/자취생 4종 다이얼)
  · data/homes.json       (집 프리셋 = 빛등급, 반지하~옥상)
- 값은 game_design_core.md 것 참고. 임의 밸런스 값은 note로 "임시" 표시
```
→ ✅ 끝나면 커밋: "게임 설계 문서 + 캐릭터/집 스키마 이식"

---

## 완료 후 (돌아와서 볼 것)
```
- data/plants.json (80종, unknown 표시된 것 확인 필요)
- data/light_sources.json
- docs/asset_sources.md
- data/characters.json, homes.json (이식)
- 각 커밋 메시지로 어디까지 됐는지 확인
※ unknown·상충 표시된 것 = 나중에 사람이 확정할 목록
```
