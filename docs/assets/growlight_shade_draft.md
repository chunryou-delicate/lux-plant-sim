# 식물등 셋에 갓·반사판 붙이기 — 빌더 초안 (C1ⓐ · 2026-08-24 · leaf)

박사님 답: **「ⓐ + ⓑ 둘 다」** — ⓐ 갓·반사판을 붙여 「등」으로 보이게 · ⓑ 켜졌을 때 몸체가 빛나게.
ⓑ 는 코드라 [core] 몫이고, ⓐ 가 이 문서다. 천장등 때(`lamp_ceiling_led_draft.md`)와 같다 —
**내가 초안을 내고 빌더를 가진 쪽이 싣는다.**

고칠 곳: `src/render3d/furniture_pastel.js` 의 `B.growlight_bar` · `B.growlight_clip` · `B.growlight_stand`

## ⛔ 먼저 — 손대면 안 되는 것 셋

```
① g.userData.size 를 «바꾸지 마라»
     조립(house.js:810~825)이 이 값으로 occluder·collider 를 만든다.
     growlight_bar 는 y=2.15 라 yBase>=1.0 조건에 걸려 «차폐체»다 —
     d 를 0.06 에서 넓히면 창턱 조도가 조용히 바뀐다. 그것은 밸런스다.
   ⇒ ★ 갓은 «지금 크기 안에서» 만든다. 이 초안은 그 규칙을 지켰다.

② g.userData.lampShade 를 «새 메시로 다시 걸어라»
     밤 광원이 이 칸으로 발광 메시를 찾는다(main.js:116 · room_view.js:1134).
     그리고 room_view.js:5033 이 «꺼지면 emissiveIntensity=0» 을 여기에 건다.
   ⇒ ★★ 그러니 lampShade 는 «카메라가 보는 면»이어야 한다. 지금은 셋 다 «밑면»이다.
     이 초안의 핵심이 그것이다 — 갓을 붙이는 김에 발광면을 위로 돌린다.

③ grow · ppfd · coverage · mount · movable 은 그대로 둔다. 전부 밸런스다.
```

## ★ 왜 이렇게 고치나 — 재서 나온 것

`docs/assets/growlight_visibility.md`. 요약하면

- 실제 폰 화면에서 셋 중 **하나만** 눈으로 찾았다(스탠드등). 그것도 등으로 안 읽힌다
- 등이 **켜진** 판(`lampmove_after.png`)에서 **스탠드등 둘레의 보라 화소가 0** 이다
- 빌더를 보면 셋 다 발광면이 **아래**를 본다. 카메라는 위에서 본다

⇒ **갓만 붙이면 반만 고치는 것이다.** 갓 + 「위에서 보이는 발광면」이 한 벌이다.

---

## ① `growlight_stand` — 접시를 «쟁반»으로

지금: 막대 끝에 납작한 판(0.30×0.03×0.16) 하나. 그 **2mm 밑**에 발광면.
⇒ 위에서 보면 **막대에 꽂힌 흰 원판** = 마이크 스탠드.

고침: 판에 **치마(skirt)를 두른다.** 위에서 보면 「쟁반」이 되고, 그 치마 바깥면이
카메라를 마주 본다. **거기를 빛나게 한다.**

```js
B.growlight_stand=(o)=>{
  const h=o.h??1.5;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#cfd4d8','satin');
  g.add(cyl(0.17,0.19,0.03,m,0,0.015,0,20));
  g.add(cyl(0.018,0.018,h-0.1,m,0,(h-0.1)/2,0,10));
  const arm=bx(0.34,0.03,0.05,m,0.15,h-0.09,0); g.add(arm);

  /* ── 갓 = 얕은 쟁반. 크기는 그대로(0.30×0.16), 아래로 0.05 내려가는 치마만 더한다 ── */
  const PW=0.30, PD=0.16, LIP=0.05;
  const hood=furnMat(o.color??'#cfd4d8','satin');
  g.add(bx(PW,0.02,PD, new THREE.MeshStandardMaterial({color:col('#e6eaee'),roughness:0.4}),
           0.28,h-0.12,0));                                   // 천판(전과 같음)
  for(const [w,d,dx,dz] of [[PW,0.012,0,PD/2],[PW,0.012,0,-PD/2],
                            [0.012,PD,PW/2,0],[0.012,PD,-PW/2,0]])
    g.add(bx(w,LIP,d,hood, 0.28+dx, h-0.12-LIP/2-0.01, dz));  // 치마 넷

  /* ── ★ 발광면을 «치마 바깥»으로 올린다. 카메라가 이 면을 본다 ──
     ⚠ 옛 판은 판 «밑»에 PlaneGeometry 를 깔았다. 위에서는 영영 안 보인다. */
  const glow=new THREE.MeshStandardMaterial({ color:col(o.accent??'#f4ecff'),
    emissive:col(o.accent??'#c9a8e8'), emissiveIntensity:0.9, roughness:0.2 });
  const band=bx(PW+0.004,0.018,PD+0.004,glow, 0.28, h-0.12-LIP-0.002, 0);   // 치마 아래 테두리
  g.add(band);
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(0.27,0.13),                   // 밑 발광(전과 같음)
    new THREE.MeshStandardMaterial({ color:col(o.accent??'#f4ecff'),
      emissive:col(o.accent??'#c9a8e8'), emissiveIntensity:0.9, roughness:0.2,
      side:THREE.DoubleSide })).translateX(0.28).translateY(h-0.19));

  g.userData.size={w:0.45,h,d:0.38};              // ⛔ 그대로
  g.userData.grow=true; g.userData.ppfd=o.ppfd??250; g.userData.coverage=o.coverage??0.7;
  g.userData.lampShade=band;                       // ★ 보이는 면으로 바꾼다
  return g;
};
```

⚠ 치마 0.05 는 **판의 원래 자리(h−0.12) 아래로** 내려간다. 등 전체 키 h 는 안 변한다.

## ② `growlight_bar` — 앞면을 «빛 띠»로

지금: 0.70×0.035×0.06 몸통, 그 **밑**에 두께 0.012 발광 상자.
⇒ 위에서 보면 **가는 흰 줄** 하나. 창틀·몰딩과 안 갈린다(그 자리에 흰 가로줄이 넷 있다).

고침: **크기를 못 넓힌다**(차폐체다). 대신 방을 마주 보는 **앞면**을 통째로 발광으로 쓴다.
0.70 × 0.035 → 폰에서 **74 × 4 px 짜리 빛 줄**이다. 가늘지만 «줄»이라 읽힌다.

```js
B.growlight_bar=(o)=>{
  const w=o.w??0.7;
  const g=new THREE.Group();
  const m=furnMat(o.color??'#dfe3e6','satin');
  g.add(bx(w,0.035,0.045,m,0,0.018,-0.0075));      // 몸통을 살짝 뒤로 — 앞 0.015 를 비운다
  const glow=new THREE.MeshStandardMaterial({ color:col(o.accent??'#f4ecff'),
    emissive:col(o.accent??'#cbb0ea'), emissiveIntensity:0.95, roughness:0.25 });
  const face=bx(w-0.02,0.030,0.014,glow, 0, 0.018, 0.023);   // ★ 앞면 빛 띠 — 카메라가 본다
  g.add(face);
  g.add(bx(w-0.06,0.012,0.045,glow, 0,-0.004,-0.0075));      // 밑 발광(전과 같음)
  g.userData.size={w,h:0.05,d:0.06}; g.userData.mount='under-shelf';   // ⛔ 그대로
  g.userData.grow=true; g.userData.ppfd=o.ppfd??180; g.userData.coverage=o.coverage??0.5;
  g.userData.lampShade=face;                       // ★ 보이는 면으로 바꾼다
  return g;
};
```

⚠ 앞이 어느 쪽인가 — 반지하 바 등은 `z=-1.85`(뒷벽)이고 카메라는 +z 쪽에서 본다.
  `+z` 가 방 안쪽이라 위 코드가 맞다. ⛔ **원룸(`z=-2.33`)도 같은지 확인하고 실어라.**

## ③ `growlight_clip` — 갓 테두리에 «빛 고리»

지금: 갓이 `CylinderGeometry(openEnded)` 를 `rotation.x=π*0.86` 으로 엎어 놓은 것.
갓은 이미 있다 — 다만 **입이 아래를 보고** 발광 원판도 그 안이라 위에서 안 보인다.

고침: 갓 **입 테두리**에 얇은 고리를 두르고 그것을 빛나게 한다. 45° 에서 테두리는 보인다.

```js
  /* head · led 는 그대로 두고, 아래 두 줄을 더한다 */
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.088,0.006,6,20),
    new THREE.MeshStandardMaterial({ color:col(o.accent??'#f2e6ff'),
      emissive:col(o.accent??'#c9a8e8'), emissiveIntensity:0.9, roughness:0.2 }));
  ring.position.copy(head.position); ring.rotation.copy(head.rotation);
  ring.translateY(-0.03);                                  // 갓 입 쪽으로
  g.add(ring);
  g.userData.lampShade=ring;                               // ★ 보이는 면으로 바꾼다
```

⚠ `TorusGeometry` 가 이 파일에서 처음 쓰이는 것이면, 다른 빌더가 쓰는 만듦새를 따르라.

---

## ⚠ 이 초안이 «확인 못 한» 것

```
⛔ 나는 이것을 «찍어 보지 못했다.» Chrome 이 다른 창에서 돌고 있었다
   ⇒ 세 빌더가 화면에서 어떻게 보이는지는 «싣고 찍어 봐야» 안다
⛔ 발광 색(#c9a8e8 보라)이 맞는 색인지 안 물었다 — 지금 값을 그대로 옮겼을 뿐이다
   ★ 실제 식물등은 보라(적청)거나 흰빛이다. 둘 다 실제로 있다. 고를 일이면 박사님께 물어라
⛔ `lampShade` 를 하나에서 다른 것으로 옮기면 room_view.js:5033 이 «옛 메시»를 안 끈다.
   지금은 등마다 lampShade 가 하나뿐이라 문제없지만, 둘을 걸고 싶으면 그쪽을 같이 고쳐야 한다
```

## ⇒ 실은 뒤 할 일 (내가 한다)

1. `node tools/glb_thumb.mjs` 가 아니라 **게임 화면**을 찍어 세 등을 다시 찾아본다
2. 「몇 초 만에 찾는지」를 고침 전/후로 나란히 놓는다
