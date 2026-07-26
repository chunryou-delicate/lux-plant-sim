# 2026-07-26 · char → house

## 자수 먼저

소유 규칙이 서기 전에 **제가 `assets/house/_room_tuner.html` 을 직접 고쳤고 이미 푸쉬됐습니다.**
집 창 소유 파일입니다. 앞으로는 절대 직접 안 건드립니다.

되돌리든 두시든 house 창 판단입니다. 그대로 두셔도 되고, 마음에 안 들면
`git revert` 하시거나 필요한 부분만 남기셔도 됩니다. 아래에 **정확히 무엇을 왜 바꿨는지**
정리합니다.

관련 커밋 (아래로 갈수록 최신)

| 커밋 | 내용 |
|---|---|
| `6da5cf2` | 스케일 기준에 실제 캐릭터 8종·자세·몬이·경량본 토글 투입 |
| `8460bcf` | `frustumCulled=false` — 카메라를 붙이면 캐릭터가 통째로 사라지던 문제 |
| `ca20b40` | 캐릭터 키 축소(여1.40/남1.50)에 맞춰 하드코딩 수치 동기화 |

`3e4a48d`(FPS·GPU 진단 패널)는 집 창 작업이라 제 변경과 무관합니다.

누적 +150 / −23 줄.

---

## 무엇을 왜 바꿨나

### 1. 기존 `refMode==='glb'` 분기를 교체

원래 코드는 `char_namja_jachwi_base.glb` 한 명을 하드코딩하고 `refH` 슬라이더 키에
맞춰 재정규화했습니다.

```js
const k = refH/(sz.y||2);   // 원본 2유닛 → 실제 키로
```

**캐릭터 GLB가 이제 실측이라 이 보정이 오히려 어긋납니다.** 발바닥이 y=0 이라
바닥 정렬 계산(`-bb2.min.y`)도 필요 없어졌습니다. 그래서 보정을 걷어내고
캐릭터 8종 · 자세 7종 · 몬이 동반 · 경량본 토글로 바꿨습니다.

`refH` 슬라이더는 **실루엣 모드 전용**으로 남겨뒀습니다.

### 2. `frustumCulled = false` — 이건 지우지 마세요

Meshy 리깅 메시는 정점이 1.7 스케일인데 메시 노드에 1/100 스케일이 걸려 있고
실제 크기는 관절이 결정합니다. glTF 규약상 스킨드 메시의 노드 변환은 무시돼야
하지만 **three.js 는 프러스텀 컬링 계산에는 그대로 씁니다.**

그래서 바닥 원점에 놓인 0.017m 짜리 상자로 판정되고(실제 렌더는 1.5m, 중심 y≈0.75),
카메라를 캐릭터에 붙이면 시야 밖으로 계산돼 **전체가 사라집니다.**

룸 튜너는 카메라가 13m쯤 떨어져 있어 원점이 우연히 시야에 들어와 있었을 뿐입니다.
줌인하면 똑같이 사라집니다. A포즈(`_base`)만 멀쩡한 건 정적 메시라 바운딩과
렌더가 일치하기 때문입니다.

```js
g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; o.frustumCulled=false; } });
```

### 3. 로딩 절반으로

`idle`·`walking`은 파일 자체에 메시와 애니메이션이 다 들어 있습니다.
리깅 메시를 따로 받지 않게 했습니다 (30MB → 14MB).

### 4. 걷기 제자리 고정

걷기 클립은 전진 모션이라 캐릭터가 방 밖으로 걸어 나갑니다. Hips 의 XZ 를
매 프레임 고정했습니다.

```js
if(refMixer){ refMixer.update(dt);
  if(refHips){ refHips.position.x=refHipsXZ[0]; refHips.position.z=refHipsXZ[1]; } }
```

---

## 캐릭터 에셋 규약 (집 쪽에서 쓸 때 필요한 것)

```js
// 크기 — GLB 에 이미 구워져 있음. 엔진에서 추가 스케일 금지.
//   여캐 1.40m · 남캐 1.50m · 몬이 0.375m(고정, 캐릭터 키에 연동 안 함)
//   1 유닛 = 1 미터, 발바닥 y=0, XZ 는 바운딩 중심
const CHARS = [
  ['char_namja_jachwi','자취남',1.50], ['char_namja_gajang','남가장',1.50],
  ['char_namja_jubu','남주부',1.50],   ['char_namja_researcher','남연구원',1.50],
  ['char_jachwi_f','자취녀',1.40],     ['char_yeoja_gajang','여가장',1.40],
  ['char_yeoja_jubu','여주부',1.40],   ['char_yeoja_researcher','여연구원',1.40],
];

// 경로
//   원본   assets/characters/3d/{char}_{base|rigged|walking|walking_w|idle}.glb
//   경량본 assets/characters/3d/lq/...   ← 게임 화면은 이걸 쓰세요 (폴리곤 1/10)
//   클립   assets/characters/3d/anim/{char}_{key}.glb   (메시 없음, 68KB)
//   몬이   assets/characters/3d/char_mascot_sprout.glb

// 클립 19종 (walking_w 는 여캐만)
//   root 파일: idle · walking · walking_w
//   anim/    : inspect repot pickup harvest harvest_crouch opendoor sleep doze
//              sit happyjump heart cheer wave nod listen scratch

// 클립은 노드 이름으로 바인딩됩니다. 원본·경량본 어느 쪽에도 붙습니다.
const mixer = new THREE.AnimationMixer(riggedScene);
mixer.clipAction(clipGltf.animations[0]).play();

// 캐릭터는 기본 방향이 뒷모습입니다. 카메라 쪽을 보게 하려면
model.rotation.y = Math.PI;
```

**폴리곤** — 원본 캐릭터 평균 22.5만 삼각형, 경량본 2.2만. 방 전체와 같이 돌리면
원본은 눈에 띄게 버벅입니다. 게임 화면은 `lq/` 를 쓰세요.

---

## 몬이 추적 파라미터 (엔진 붙일 때)

```js
// 캐릭터 뒤를 공중에 떠서 졸졸 따라옴. 본 리깅 없이 트랜스폼만.
const MON = {
  floatHeight   : 0.221,   // 바닥에서 몬이 밑면까지 (m)
  bobAmplitude  : 0.103,
  bobPeriod_sec : 2.5,
  followDistance: 0.774,
  followDamping : 4.1,
  tiltDegrees   : 4.0,
};
// 수평 추적은 프레임레이트 무관하게
pos.lerp(target, 1 - Math.exp(-MON.followDamping * dt));
```

튜닝 페이지: `assets/characters/mascot_follow_preview.html`

---

## 추가 (2026-07-26) · `tools/` 분할에 따른 경로 변경 요청

박사님 지시로 `tools/` 를 하위 폴더로 쪼갰습니다. **제 도구 8개가
`tools/char/` 로 옮겨졌습니다.**

```
tools/char/    char 소유   rescale_char_glb · make_lq_glb · make_part_mask ·
                          preview_mask · preview_recolor · strip_anim_glb ·
                          normalize_anim_scale · check_anim
tools/house/   house 소유  _dli_probe · _slotlist 등
tools/         공용        serve.py   (고치기 전 알리기 · 급하면 사후 보고)
```

`src/render3d/character.js` 의 **주석 3곳**이 옛 경로를 가리킵니다. house 소유라
직접 안 고쳤습니다. 실행에는 지장 없고 주석뿐이지만, 나중에 그 경로를 찾다
헤매지 않으시게 바꿔 두시길 권합니다.

| 줄 | 지금 | 바꿀 것 |
|---|---|---|
| 20 | `tools/strip_anim_glb.py 로 클립만 뽑아` | `tools/char/strip_anim_glb.py 로 클립만 뽑아` |
| 84 | `캐릭 작업창이 tools/rescale_char_glb.py 로` | `캐릭 작업창이 tools/char/rescale_char_glb.py 로` |
| 125 | `'— tools/strip_anim_glb.js 를 돌렸나?'` | `'— tools/char/strip_anim_glb.py 를 돌렸나?'` |

> 125행은 확장자도 `.js` 로 잘못 적혀 있습니다. 실제 파일은 `.py` 입니다.

---

## 미해결 / 요청

- [ ] `_room_tuner.html` 의 제 변경분을 **유지할지 되돌릴지** house 창에서 판단해 주세요.
      유지하신다면 `frustumCulled=false` 만은 남겨주시길 요청드립니다 — 없으면 줌인 시 캐릭터가 사라집니다.
      (박사님이 "되돌리면 안 되는 것"으로 확인해 주셨고 house 창에 별도 전달하신다고 하셨습니다.)
- [ ] `src/render3d/character.js` 주석 3곳 경로 갱신 (위 표).
- [x] `tools/*` 소유 — **해결됨.** `tools/char/` = char, `tools/house/` = house,
      `tools/serve.py` = 공용으로 확정됐습니다.
- [ ] 방 크기 대비 캐릭터 키가 아직 어색하면 알려주세요. `tools/char/rescale_char_glb.py`
      의 상수 두 개만 바꿔 다시 돌리면 되고, **모션 클립 128개는 손대지 않아도 됩니다**
      (씬 최상단 래퍼에 스케일만 얹는 방식이라 관절 로컬 변환은 그대로).
