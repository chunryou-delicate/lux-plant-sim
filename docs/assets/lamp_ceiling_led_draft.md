# 천장등 → 네모 LED 판 · **빌더 초안** ([Asset] → [House])

> 2026-08-24 · 박사님: *"천장등 말하는 거지? **네모 LED 등으로 바꾸고 싶긴 한데.**
> 어차피 천장등은 **이동 못 하게 고정**이야. **켜고 끄고만** 된다."*
>
> ⚠ **[Asset] 은 이 파일을 못 고칩니다.** `src/render3d/*` 와 `furniture_presets.json` 은
> [House] 마당입니다(team-map §2). **초안만 드립니다. 넣는 것은 그쪽입니다.**

---

## 0. 먼저 — **손대기 전에 잰 것 둘**

### ① ✅ **값은 안 움직입니다.** 밸런스 승인 필요 없습니다
```
lamp_ceiling   kind=lighting   값 = 없다 (안 판다)
bed_single     kind=furniture  값 = 293,200
```
`furnitureKindOf` 가 **`lamp_` 로 시작하면 `lighting`** 으로 가르고, `listWon` 은
**`kind === 'furniture'` 일 때만** 매깁니다(`shop.js:340`).
⇒ ★ **`size_m` 을 바꿔도 값이 한 푼도 안 움직입니다.** 돌려서 확인했습니다.

### ② ⚠⚠ **`lampShade` 를 반드시 그대로 넘겨야 합니다 — 안 넘기면 밤에 불이 안 켜집니다**
```
main.js:116        built.furniture.traverse(o => { ... userData.lampShade === o → ctx.clShade = o })
room_view.js:1134  같은 것
```
⇒ **밤 광원이 「빛나는 메시」를 그 칸으로 찾습니다.** 새 빌더도 **발광면을 `lampShade` 에 넣어야** 합니다.
⇒ 그리고 **`hangFromCeiling = true`** 도 그대로 둡니다 — 이것이 **「이동 못 하게 고정」**을 만듭니다
  (`lampImmovableReason` 이 이 칸을 봅니다). 박사님 말씀이 이미 그렇게 돌고 있습니다.

---

## 1. 초안 — `src/render3d/furniture_pastel.js` 의 `B.lamp_ceiling` 을 이것으로

```js
/* 천장등 — 네모 LED 판 (2026-08-24 · 박사님 "네모 LED 등으로 바꾸고 싶긴 한데")
   ★ 줄과 원뿔 갓을 없앴다. 천장에 납작하게 붙는다.
   ⚠ userData.lampShade 를 반드시 넘긴다 — 밤 광원이 이 칸으로 빛나는 면을 찾는다
     (main.js §밤 광원 · room_view.js:1134). 안 넘기면 밤에 불이 안 켜진다.
   ⚠ userData.hangFromCeiling 도 그대로 — 이것이 "이동 못 하게 고정"을 만든다 */
B.lamp_ceiling = (o) => {
  const w = o.w ?? 0.60, d = o.d ?? 0.60, t = o.h ?? 0.05;   // t = 판 두께
  const g = new THREE.Group();
  const body = furnMat(o.color ?? '#e6e3dc', 'satin');       // 테두리(하우징)

  /* 몸통 — 천장에 붙어 아래로 t 만큼 내려온다. 모서리를 아주 살짝만 둥글린다 */
  g.add(panel(w, t, d, body, 0, -t / 2, 0, 0.008));

  /* 빛나는 면 — 아래를 본다. 테두리가 살짝 보이게 안쪽으로 들인다 */
  const inset = 0.02, lit = 0.010;
  const shade = new THREE.Mesh(
    new THREE.BoxGeometry(w - inset * 2, lit, d - inset * 2),
    new THREE.MeshStandardMaterial({
      color: col(o.accent ?? '#f6efdc'), roughness: 0.9,
      emissive: col('#3a2f18'), emissiveIntensity: 0.2,      // 낮 밝기. 밤에 코어가 올린다
    }));
  shade.position.y = -t + lit / 2;                            // 판의 아랫면
  g.add(shade);

  g.userData.size = { w, h: t, d };                           // ★ §2 로 뽑아 적는다
  g.userData.lampShade = shade;                               // ⚠ 밤 광원이 읽는다
  g.userData.hangFromCeiling = true;                          // ⚠ 고정 (움직이지 않는다)
  return g;
};
```

⚠ **`emissiveIntensity: 0.2` 는 지금 값 그대로 뒀습니다.** 밤 밝기는 **코어가 올립니다** —
**모델만 바꾸고 밝기 값은 안 건드린다**는 것이 이 일의 조건입니다.

---

## 2. ⚠ `size_m` 은 **손으로 적으면 안 됩니다** — 뽑는 법

`data/furniture_presets.json` 의 `_size_m` 주석이 *"빌더가 실제로 내는 크기"* 라 못 박았고,
**`tools/test_furnishop.mjs §A` 가 빌더로 다시 지어 한 톨이라도 다르면 깨뜨립니다.**

⇒ **빌더가 내는 `userData.size` 를 그대로 적습니다.** 위 초안은 `{ w, h: t, d }` 라
  프리셋의 `w`·`d`·`h` 를 그대로 쓰면 **세 칸이 저절로 맞습니다.**

```
지금  "w": 0.44, "d": 0.44, "h": 0.35        ← 빌더 밑값 (h 는 «줄 길이»였다)
      "size_m": { "w": 0.44, "d": 0.44, "h": 0.55 }   ← drop + 0.2 (갓까지)

바꿈  "w": <가로>, "d": <세로>, "h": <두께>
      "size_m": { "w": <가로>, "d": <세로>, "h": <두께> }   ← ★ 셋이 «같아진다»
```
⇒ ★ **줄이 없어져서 `h` 의 뜻이 바뀝니다** — 예전엔 「줄 길이」였고 이제 「판 두께」입니다.
  그래서 `size_m.h` 와 `h` 가 **같은 값**이 됩니다. **그 점을 프리셋 주석에 적어 두시길 권합니다.**

---

## 3. 크기 셋 — **박사님이 고르십니다**

| | 크기 (가로 × 세로 × 두께) | 어떻게 보이나 |
|---|---|---|
| **㉠** | **0.60 × 0.60 × 0.05** | 방이 7×7 이라 넉넉하다. **「LED 판」으로 확실히 읽힌다** |
| **㉡** | **0.45 × 0.45 × 0.04** | 지금 갓과 폭이 비슷해 **자리가 안 바뀐다** |
| **㉢** | **0.60 × 0.60 × 0.03** | 제일 요즘 것 같다. **옆에서 보면 거의 선** |

⇒ ★ **어느 쪽이든 「줄이 없어지고 천장에 납작하게 붙습니다」. 그게 제일 큰 변화입니다.**

---

## 4. ⚠ 넣기 전에 볼 것

- [ ] **`tools/test_furnishop.mjs` 를 돌려 `size_m` 이 맞는지** — 붉으면 «맞는» 붉음이니 프리셋을 고친다
- [ ] **밤 화면을 찍어 불이 켜지는지** — `lampShade` 를 넘겼는지가 여기서 갈린다
- [x] ✅ **「전」 사진을 찍어 뒀다** — `docs/handoff/img/lampled/`
      `before_bj_day010/030/050/075.png` (해 4단계 · 방 전체) ·
      `before_lamp_bj_day010.png` · `before_lamp_bj_day075.png` (천장등만 크게)
      ⇒ **찍은 자**: `tools/_probe_roomshot.mjs`([House] 것). 같은 자로 「후」를 찍으면 그대로 견줄 수 있다
  ★★ **그 사진이 §0-② 의 증거다** — **밤(해 0.10)에 원뿔 갓이 또렷이 빛난다.**
     그것이 `lampShade` 가 하는 일이다. **새 빌더가 그 칸을 안 넘기면 이 빛이 사라진다.**
     ⇒ 「후」를 찍을 때 **밤 컷을 먼저 보라.** 거기서 갈린다
- [ ] ⚠ **원뿔 갓을 쓰는 다른 등**(`795`·`958` 줄 근처)은 **안 건드린다.** 이 건은 천장등 하나다
