# 에셋 소스 조사 — 무료 저폴리 3D (2026-07-12)

> ⚠ "만들지" 않고 "어디서 구하는지"만 조사. Three.js용이라 **glTF/GLB 우선**.
> ⚠ 라이선스 반드시 확인: 상업이용 가능(수익=덤이지만 상용앱 지향) → **CC0 최우선**.
> 조사만. 실제 도입은 나중에.

---

## 라이선스 요약 (중요)
```
CC0        = 저작권 포기. 상업이용 O, 출처표기 불필요. ★최우선
CC-BY      = 상업이용 O, 단 출처표기 필수. (게임 크레딧에 넣으면 됨)
CC-BY-NC   = 비상업만. ❌ 상용앱엔 못 씀
독자 라이선스 = 사이트별 확인 필수
```

---

## 1순위 — CC0 (상업이용·출처표기 불필요) ✅ 확인됨

| 소스 | URL | 포맷 | 내용 | 비고 |
|------|-----|------|------|------|
| **Kenney** | kenney.nl | glTF/FBX/OBJ | 게임 에셋 40k+ (가구·소품·자연·키트) | 전부 CC0. 저폴리 키트배시에 최적 |
| **Quaternius** | quaternius.com | glTF/FBX | 저폴리 팩(자연·식물·가구·캐릭터·동물) | 전부 CC0. 식물·나무 팩 있음 |
| **Poly Haven** | polyhaven.com | glTF·HDRI·텍스처 | 모델 일부 + HDRI/텍스처 다수 | 전부 CC0. 벽/바닥 텍스처·환경광에 좋음 |
| **ambientCG** | ambientcg.com | 텍스처·소수 모델 | PBR 텍스처(나무·천·금속·타일) | 전부 CC0. 재질(반사율) 소스로 |

→ **가구·식물·재질 씨앗은 Kenney + Quaternius + ambientCG 조합이면 대부분 커버.**

---

## 2순위 — 아그리게이터 (모델별 라이선스 확인 필요)

| 소스 | URL | 포맷 | 내용 | 주의 |
|------|-----|------|------|------|
| **Poly Pizza** | poly.pizza | OBJ/FBX/glTF | 저폴리 검색·다운(로그인 불필요) | 다수 CC0(Quaternius 등)이나 **모델별 라이선스 표기 확인** |
| **Sketchfab** | sketchfab.com | glTF/GLB 등 | 방대. 실사~저폴리 | **Downloadable + 라이선스 필터 필수** (CC0/CC-BY만) |
| **itch.io** | itch.io (assets) | 다양 | 인디 에셋팩(유·무료) | 팩별 라이선스 상이 |
| **OpenGameArt** | opengameart.org | 다양 | 오픈 게임 에셋 | 라이선스 혼재(CC0~GPL) |
| **awesome-cc0** | github.com/madjin/awesome-cc0 | 링크모음 | CC0 소스 큐레이션 | 새 CC0 소스 발굴용 |

---

## 3순위 — 유료/부분무료 (품질↑, 필요시)
```
- CGTrader / TurboSquid — free 섹션 있음, 라이선스 꼼꼼히
- Sketchfab Store, Unity Asset Store — 유료 저폴리 팩
※ 지금은 1순위(CC0)로 충분. 유료는 특정 에셋 필요할 때만.
```

---

## Three.js 도입 메모
```
- 포맷: glTF(.gltf/.glb) 우선 (Three.js GLTFLoader 표준). FBX/OBJ는 변환.
- 저폴리 + 텍스처는 GLB(바이너리 단일파일)가 로딩·관리 편함.
- 도구·게임 공용(byeot_plan): 한 번 받은 가구가 조도툴·게임 양쪽에.
- 재질(반사율 ρ)은 ambientCG/Poly Haven PBR에서 albedo·roughness 참고.
```

## 확보 우선순위 (씨앗)
```
1. 가구 저폴리 (침대·책상·의자·선반·화분) → Kenney/Quaternius CC0
2. 식물 저폴리 (관엽·다육·화분식물)      → Quaternius 자연팩 + Poly Pizza(CC0 필터)
3. 재질 텍스처 (나무·천·타일·벽)         → ambientCG/Poly Haven CC0
※ 캐릭터·아바타는 게임 단계에서.
```

---
*조사 문서. 실제 다운·도입 시 각 모델 라이선스 재확인.*
*출처: kenney.nl, quaternius.com, polyhaven.com, ambientcg.com, poly.pizza, sketchfab.com, github.com/madjin/awesome-cc0*
