# assets/derived — 파생 에셋 (자동 생성)

원본을 건드리지 않고 **읽어서 만든** 결과물만 둔다. 손으로 고치지 말 것.

## char_clips/

`assets/characters/3d/char_*_idle.glb` · `char_*_walking.glb` 에서
**애니메이션 클립만** 뽑아낸 GLB.

원본은 메시·텍스처를 통째로 다시 담고 있어 하나에 12~17MB다.
캐릭터 하나 띄우는 데 rigged + idle + walking = 40MB+ 를 받게 된다.
클립만 남기면 **70KB / 35KB** — 총 227MB 절약.

```
node tools/strip_anim_glb.js      # 다시 만들기
```

`anim/` 폴더의 동작 GLB(wave·heart 등)는 원래부터 클립만 들어 있어 0.1MB라 그대로 쓴다.

> 원본 `assets/characters` 는 다른 작업창 담당이라 읽기만 한다.
