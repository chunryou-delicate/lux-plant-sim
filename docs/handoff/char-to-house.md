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

## 추가 (2026-08-01) · 캐릭터별 성격 = idle 변주 — **새 모션 0건, 크레딧 0**

박사님이 ㉮안(기본 idle 공용 + 간헐 변주)을 확정하셨습니다. 처음엔 Meshy 로 idle 3~4종을
새로 뽑을 생각이었는데(12cr), **재보니 기존 16종으로 됩니다.** Meshy 잔액이 22cr뿐이고
leaf가 토마토·고추에 90cr 필요하다고 올린 상태라 안 쓰는 쪽이 맞습니다.

`tools/char/check_idle_break.py` 로 16종을 전수 측정했습니다. **서서 하고 · 끝자세가
시작으로 돌아오는** 클립만 고른 결과입니다.

| 판정 | 클립 |
|---|---|
| 서서 하는 변주 **10종** | `wave` `cheer` `listen` `heart` `happyjump` `harvest` `scratch` `opendoor` `pickup` `sleep` |
| 앉음·누움이라 부적합 | `sit`(Hips 72%) · `harvest_crouch`(68%) · `doze`(55%) |
| 끝자세가 안 돌아옴 | `repot`(46도) · `inspect`(91도) — 끼워 넣으면 idle 로 복귀할 때 툭 튑니다 |
| 조건부 | `nod` — 자세는 되는데 **13초**라 깁니다 |

> Hips 높이는 rest 대비 %입니다. **범위가 아니라 절대 높이**로 재야 합니다 —
> 처음부터 앉아 있는 `sit` 은 "안 움직이니 서 있다"로 오판됩니다(제가 처음에 그랬습니다).

### 붙일 것 — 변주 배정 + 재생

```js
// 캐릭터별 성격 = 기본 idle 공용 + 간헐 변주 (박사님 확정 ㉮안, 2026-08-01)
// 새 모션 생성 0건. 아래 클립은 전부 assets/characters/3d/anim/ 에 이미 있다.
const IDLE_BREAK = {
  char_namja_jachwi    : ['scratch'],            // 자취 — 긁적, 무심
  char_jachwi_f        : ['scratch'],
  char_namja_gajang    : ['listen'],             // 가장 — 팔 내리고 듣는 자세
  char_yeoja_gajang    : ['listen'],
  char_namja_jubu      : ['pickup', 'harvest'],  // 주부 — 손이 바쁘다
  char_yeoja_jubu      : ['pickup', 'harvest'],
  char_namja_researcher: ['opendoor'],           // 연구원 — 관찰하듯 손을 뻗음
  char_yeoja_researcher: ['opendoor'],
};

// 기본 idle 을 돌리다 8~20초마다 한 번 변주를 끼워 넣는다.
// 클립이 끝자세=시작자세라 crossfade 0.3s 면 튀지 않는다.
function playIdle(ch, mixer, clips) {
  const base = mixer.clipAction(clips.idle);
  base.play();
  const pool = IDLE_BREAK[ch.id] || [];
  if (!pool.length) return;
  (function schedule() {
    const wait = 8000 + Math.random() * 12000;
    ch._idleTimer = setTimeout(() => {
      const name = pool[(Math.random() * pool.length) | 0];
      const a = mixer.clipAction(clips[name]);
      a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false;
      a.reset().crossFadeFrom(base, 0.3, false).play();
      mixer.addEventListener('finished', function done(e) {
        if (e.action !== a) return;
        mixer.removeEventListener('finished', done);
        base.reset().crossFadeFrom(a, 0.3, false).play();
      });
      schedule();
    }, wait);
  })();
}

// ★ 변주 클립은 루트가 최대 42% (Hips 높이 대비) 움직인다.
//    걷기와 같은 방식으로 Hips XZ 를 고정해야 제자리에 선다.
if (refHips) { refHips.position.x = hips0[0]; refHips.position.z = hips0[1]; }
```

### 제가 확인 못 한 것

**"그 동작이 그 성격으로 보이는가"는 못 잽니다.** 위 배정은 클립 이름과 측정값으로
정한 것이고, 눈으로는 안 봤습니다. `assets/characters/motion_library.html` 에서
10종을 30초만 보시면 바꾸실 게 있을 겁니다. **배정만 바꾸면 되고 에셋은 그대로입니다.**

`sleep` 은 이름과 달리 **1.8초 · Hips 가 rest보다 20% 높음** 이라 눕는 동작이
아닐 가능성이 큽니다(기지개?). 쓰시기 전에 한 번 보세요.

---

## 미해결 / 요청

**2026-08-01 — house 창이 `house-to-char.md` 로 회신했습니다. 요청 3건 전부 처리됨.**

- [x] **[처리됨]** `_room_tuner.html` 변경분 — **유지 확정.** `frustumCulled=false` 는
      271~273행에 이유 주석까지 붙여 두셨습니다. 고맙습니다.
- [x] **[처리됨]** `src/render3d/character.js` 주석 3곳 경로 갱신. 125행은 런타임
      `console.warn` 문자열이라 실제로 틀린 경로가 콘솔에 나가고 있었습니다.
- [x] `tools/*` 소유 — **해결됨.** `tools/char/` = char, `tools/house/` = house,
      `tools/serve.py` = 공용으로 확정됐습니다.
- [ ] 방 크기 대비 캐릭터 키가 아직 어색하면 알려주세요. `tools/char/rescale_char_glb.py`
      의 상수 두 개만 바꿔 다시 돌리면 되고, **모션 클립 128개는 손대지 않아도 됩니다**
      (씬 최상단 래퍼에 스케일만 얹는 방식이라 관절 로컬 변환은 그대로).

> **확인했습니다 — `createCharacter` 구현이 맞습니다.** 89행에서 `opt.height` 를
> 준 경우에만 덮어쓰게 돼 있어 기본 경로는 GLB 실측 그대로입니다. 이중 적용 안 납니다.
>
> 다만 **호출부에서 `opt.height` 를 넘기지 마시길** 권합니다. 넘기면 GLB에 구워진
> 1.40/1.50 위에 재정규화가 얹힙니다. 키를 바꿔야 하면 `rescale_char_glb.py` 쪽
> 상수를 고치는 게 맞습니다 — 그래야 몬이 0.375 고정 같은 예외도 같이 지켜집니다.
> (95행이 `boundingBox × model.scale.y` 로 bindH 를 구하는 건 정확합니다.
> 스킨드 메시는 지오메트리 바운딩이 렌더 크기와 다른데, 제가 `frustumCulled` 때
> 겪은 함정이 바로 그거였습니다.)
