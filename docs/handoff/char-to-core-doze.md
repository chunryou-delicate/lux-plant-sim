# [core] 에게 — 낮잠은 «뽑을 것이 아니라 부르면» 된다

2026-09-07 · [Char] · **크레딧 0**

## ■ 한 줄

★ **`doze`(앉아 조는 17.33초짜리)가 8캐릭터 «전부»에 이미 있는데 아무도 안 부른다.**
⇒ 박사님이 새로 넣으라 하신 「낮잠」이 **이미 파일에 있었다.**

## ■ 잰 것

    파일    assets/characters/3d/anim/char_*_doze.glb   ⇒ ★ **8개** (세었다)
    클립    Sit_and_Doze_Off · 17.33초 · 앉아 존다
    선언    src/render3d/character.js:46
              { id: 'doze', ko: '졸기', loop: true }    ⇐ ★ loop: true
    부름    ⛔ **0건.** 선언표에만 있다

⚠ 이름을 그냥 grep 하면 「1건」으로 나온다. **그 1건이 위 선언표다.**
⇒ ★ **선언은 부름이 아니다.**

## ■ ★ 견줌 — 누울 자리·앉을 자리는 이미 이어져 있다

    sit    Chair_Sit_Idle_F/M  11.37초  ✔ game.html:15095  tapOnce('furnSit', () => restAct('sit'))
    sleep  Sleep_Normally       1.77초  ✔ game.html:15096  tapOnce('furnLie', () => restAct('sleep'))
    doze   Sit_and_Doze_Off    17.33초  ⛔ 부르는 데가 «없다»

⇒ ★★ 곧 **`restAct('sleep')` 과 똑같은 꼴로 한 줄이면 될 것으로 보인다.**
⇒ ⛔ 그러나 **어디에 붙일지는 내가 정할 것이 아니다** — `game.html`·`room_view.js` 는 그쪽 것이다.
   (「의자에서 존다」인지 「침대에서 낮잠」인지도 기획 물음이다)

## ■ ⚠ 붙이기 전에 볼 것 하나 — 앉은 높이

`sit` 은 이미 **엉덩이 높이를 맞추는 손질**이 들어가 있다:

    room_view.js:8864   if (K === 'sit' && Number.isFinite(person.c.hipsY)) { ... }

⇒ ★ `doze` 도 **앉은 자세**다(Sit_and_Doze_Off). 그 손질이 필요할 수 있다.
⇒ ⇒ ⛔ 내가 「필요하다」고 단정하지 않는다 — **안 재봤다.** 다만 «볼 자리»로 짚는다.

## ■ ⛔ 이 글이 «못» 하는 것

  · 「낮잠이 게임에서 무엇인가」는 모른다 — 시간을 넘기나, 기운을 채우나. **[Plan] 물음이다**
  · `doze` 가 8개 «있다»는 것은 셌지만, **「8개가 다 같은 동작인가」는 안 풀어 봤다**
    (2026-08-04 재조사 주석을 믿었다)
