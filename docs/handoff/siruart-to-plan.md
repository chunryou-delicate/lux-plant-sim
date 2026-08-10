# siruart → plan

# 2026-08-10 · 빈 시루 그림 · 무순도 같은 병 · 검사 문서 예외

## 무엇을 했나

세 가지를 받아 둘을 넣고, 하나는 **막혔다**(에셋이 없다).

| | |
|---|---|
| ① 빈 시루 그림 | `game.html` 세 줄. growth 가 낸 계약(`bagThumbnail`)을 화면이 읽게 했다 |
| ② 무순 카드 | **같은 병이 맞다.** 다만 **고칠 그림이 없다** — 아래 ★판단 |
| ③ 검사 문서 정정 | `docs/handoff/README.md` 에 `test_boot_profile` 예외를 적었다 |

## ① 빈 시루 — 화면에서 확인했다

`game.html` 세 곳이 `OPEN_SIRU.thumbnail`(열린 시루) 대신 **`OPEN_SIRU.bagThumbnail`**(뚜껑)을 읽는다.
계약·에셋·3D 는 한 글자도 안 건드렸다.

| 자리 | 옛 → 새 |
|---|---|
| 카드 머리 그림 (`#cropThumb`) | `thumbnail` → **`bagThumbnail`** |
| 상세 창 그림 (`crop().art`) | `thumbnail` → **`bagThumbnail`** |
| 가방 격자 (`BAG_ART.siru`) | `container_siru_open.png` → **`container_siru_closed.png`** |

**폰 폭 390 에서 실제로 띄워 본 것** — 상태값이 아니라 브라우저가 받아 그린 `currentSrc` 를 읽었다:

```
가방 카드 머리 그림   container_siru_closed.png  (로드됨 512px)
상세 창 그림          container_siru_closed.png  (로드됨 512px)
가방 격자 「콩나물 시루」 칸  container_siru_closed.png  (로드됨 512px)

★ 끌기   #cropThumb 끌기 시작됨 → 방에 시루 1개가 **실제로 섰다**(칸 5개 생김)
★ 방     받은 파일 = container_siru_open.glb   ← 방에 선 시루는 **그대로 열린 시루**
         container_siru_closed 의 glb 는 **안 받았다**
```

⇒ **가방만 뚜껑, 방은 열린 시루.** 요청한 경계가 화면에서 그대로 지켜진다.

### 검사로 못 박았다 — `tools/test_bagcell.mjs`

옛 B-1~B-7 은 **글자만** 읽어서, 글은 「빈 시루」인데 그림은 다 자란 시루인 어긋남을 통째로 놓쳤다.
그림 검사 다섯을 넣었다(`B-a·B-b·B-c·B-d` · 격자 `A-1~A-3`). 33 항목 전부 통과.

★ `src` 가 아니라 **`currentSrc`·`naturalWidth`** 를 본다 — `src` 는 문자열일 뿐이라
  파일이 없어도 통과한다. 「화면에 실제로 그려진 것」을 재는 것이 요점이다.

## ② ★ 무순도 같은 병이다 — 그런데 **고칠 그림이 없다**

확인했고 **멀쩡하지 않다.** 콩나물과 똑같이, 가방에 있는 「새싹 재배판」이
**무순이 다 자란 재배판** 그림을 쓰고 있다. 세 곳 전부다.

```
#musunThumb            container_tray_s.png   ← 무순이 빽빽이 자란 판
musun() 상세 창 art     container_tray_s.png
BAG_ART.sprout_tray     container_tray_s.png
```

**안 고쳤다. 고칠 수가 없다** — 저장소에 **빈 재배판 그림이 없다.**

```
assets/crops/container_tray_l.glb · container_tray_s.glb
assets/crops/thumbs/container_tray_l.png · container_tray_s.png
manifest 의 tray 항목 = 소·대 둘뿐. lid_state 같은 「빈 것」 표시가 없다
```

소(小)·대(大) 둘 다 **자란 무순이 심겨 있는 그림**이다. 콩나물은 차광 용기라
「뚜껑 덮인 짝」이 원래 있어서 고칠 수 있었지만, 재배판에는 그 짝이 없다.

⚠ **짐작으로 지어내지 않았다.** 있는 그림을 잘라 쓰거나 다른 용기를 돌려 쓰면,
  나중에 진짜 그림이 왔을 때 어긋나고 그때 고칠 사람이 없다.

### ★ 판단이 필요한 것 — 셋 중 하나

| | 방법 | 결과 |
|---|---|---|
| ⑴ | **leaf 에 「빈 재배판」 원화를 요청한다**(`container_tray_empty.png`) | 콩나물과 **같은 규칙**이 된다. 그림 한 장이면 `game.html` 세 줄로 끝난다 |
| ⑵ | 재배판에도 `lid_state` 같은 **상태 축**을 manifest 에 넣는다 | 앞으로 용기가 늘 때 규칙이 하나로 선다. 대신 leaf·house 계약이 움직인다 |
| ⑶ | 그대로 둔다 | 콩나물만 고쳐지고 무순은 계속 「가방에서 자라는」 그림이다 — **글과 그림이 여전히 다른 말을 한다** |

**⑴을 권한다.** 지금 막힌 것이 그림 한 장뿐이고, 붙일 자리는 이미 세 줄로 정해져 있다.
계약 함수(`openSiruContractFromManifest` 같은 것)는 무순엔 아직 없으므로,
그림이 오면 그때 계약까지 같이 세우는 것이 싸다.

## ③ 검사 문서 정정 — `docs/handoff/README.md`

「포트는 전부 `BYEOT_URL` 로 덮인다」가 **틀렸다.** 재서 확인한 예외 하나를 적었다.

```
tools/test_boot_profile.mjs  — BYEOT_URL 을 안 읽는다
   기본 주소 http://localhost:8971/game.html 이 박혀 있고
   받는 손잡이는 --url= 인자뿐이다
```

브라우저를 띄우는 검사 열여덟 개를 전부 훑어 확인했다 — **`BYEOT_URL` 을 안 읽는 것은 이 하나뿐**이다
(`test_cdp.mjs` 는 검사가 아니라 크롬을 붙잡는 도구다).
「실패를 읽는 법」 표에도 한 줄 넣었다: *`test_boot_profile` 만 시간 초과 → `--url=` 을 안 넘겼다.*

⚠ 이 파일은 **그 절만** 고쳤다. 다른 절은 손대지 않았다.

## ★ 다른 창이 알아야 할 것 — 기준선이 **50/52 였다**

일을 시작할 때 52 개를 돌렸더니 **둘이 이미 깨져 있었다.** 내 변경 전이다.

```
tools/test_first_play.mjs
tools/test_first_play_attacks.mjs
   assert.throws(..., /자리/)
   실제  '[첫 플레이] 시루를 먼저 방 안에 놓아 주세요'
```

커밋 **`f26aeef`**(오늘 10:31 · 「시루가 방에 서 있는데 하루가 안 넘어가던 것을 고쳤다」)에서
문지기가 **자리 사본이 아니라 방에 선 시루**를 세게 되면서 예외 문구가 바뀌었다. 코드가 옳고
**검사가 옛 문구를 붙잡고 있던 것**이라, 검사 쪽을 고쳤다(검사 파일은 이 창 소유다).

지킬 것이 문구가 아니므로 **문구 대신 뜻**을 재게 했다 — 두 문구를 다 받고,
`firstPlayInput` 표가 붙어 있는지를 같이 본다. 그 표가 없으면 화면이 **복구 불가로 읽고
버튼을 전부 잠근다**(f26aeef 의 커밋 메시지가 적어 둔 바로 그것)라, 문구보다 이쪽이 정본이다.

⇒ **`src/game/**` 은 한 줄도 안 건드렸다.**

## 이번에 고친 파일

| 무엇 | 어디 |
|---|---|
| 가방 그림 세 줄 | `game.html` (`#cropThumb` · `crop().art` · `BAG_ART.siru`) |
| 그림 검사 8항목 | `tools/test_bagcell.mjs` (`B-a~B-d` · `A-1~A-3`) |
| 옛 문구를 붙잡던 검사 둘 | `tools/test_first_play.mjs` · `tools/test_first_play_attacks.mjs` |
| 검사 절차 예외 | `docs/handoff/README.md` §검사 돌리는 법 |

## 미해결

- [ ] ★ **빈 재배판 원화**(무순) — 위 ②. leaf 요청 여부는 plan 판단
- [ ] 무순에는 아직 `openSiruContractFromManifest` 같은 **계약 함수가 없다**.
      그림 경로가 `game.html` 에 세 번 적혀 있다 — 그림이 오면 계약으로 걷어야 한다
