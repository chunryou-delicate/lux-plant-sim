# 2026-08-03 · 방 뷰(room_view) → 코어(game.html)

방 뷰 3차. 두 가지를 했다.
① 캐릭터를 눌러 고르고 걸어 보낸다 ② 부팅이 왜 느린지 **재서** 밝혔다.

`game.html` · `plant_grow.html` 은 코어 창 소유라 한 글자도 안 고쳤다.
여기 적은 것은 **거기에 붙일 지시**다.

---

## 1. 새로 나온 계약 — `src/game/room_view.js`

좌표는 전부 **뷰포트 기준 CSS 픽셀**이다. pointer 이벤트의 `clientX/clientY` 를 그대로 넣으면 된다.
(`screenPosOf` 만 캔버스 기준이라는 기존 함정은 그대로다. `characterScreenPos` 도 캔버스 기준이다.)

```js
// createRoomView 옵션에 둘이 늘었다
createRoomView(canvas, {
  // ★ 2026-08-03 바뀜(방 뷰 4차) — 인자가 둘이고 **첫째가 '누른 결과'** 다
  onCharacterTap : (selected, tapped) => {},
  //   selected  누른 결과 골라진 id ('jachwi' | 'moni' | null)   ← 해제면 null
  //   tapped    실제로 눌린 id
  // game.html 의 `onCharacterTap: (id) => roomView.selectCharacter(id)` 는 **그대로 두면 된다.**
  // 오히려 그 한 줄이 이제 양방향으로 맞는다 — 같은 캐릭터를 다시 누르면 해제되는데,
  // 첫 인자가 '누른 id' 였을 때는 호스트가 방금 푼 것을 도로 골라서 해제가 안 됐다(폰 지적).
  onProgress     : ({phase, ko, ms}) => {},  // ★ 무엇을 기다리는 중인가
  deferPlantAssets: false,              // 기본 false. 아래 §3 참고
  …
});

view.setCharacterTapHandler(fn)         // 나중에 갈아 끼울 때
view.selectCharacter(id | null) → id    // 고르기. 발밑 주황 링이 뜬다
view.selectedCharacter()       → id | null
view.walkTo(id, screenX, screenY)       // → {ok, x, z, steps} | {ok:false, reason}
view.previewWalk(id, screenX, screenY|null)  // → {ok, x, z} | null. null 이면 지운다
view.characterScreenPos(id)    → {x,y} | null   // ★ 발밑. 상대 끌기의 기준점
view.isWalking(id) · view.stopWalk(id)
view.nudgeCharacters()         → 움직인 사람 수    // 화분 가린 사람 비켜세우기
view.isOccludingPlant(id)      → bool             // 진단용
view.roomSize()                → {w,d,h}
view.bootTimings()             → { start, data, room, ready, character:…, … }  (ms)
view.warmPlantAssets()         → Promise<bool>
view.characters()  // walkable·selected·walking 이 늘었다
```

### 조작 규칙 (제일 중요한 한 줄)

> **고르기 전에 끌면 카메라가 돈다. 고른 뒤에만 끌기가 걷기로 읽힌다.**

이 한 줄이 안 지켜지면 방을 둘러보려던 손짓이 캐릭터를 엉뚱한 데로 보낸다.
모듈 안에서 지키고 있으니 코어에서 따로 할 일은 없다. 다만 코어가 캔버스 위에
투명 판(`moveCatcher` 같은 것)을 덮으면 그 판이 먼저 이벤트를 먹는다 —
화분 조작 중에는 캐릭터가 안 골라지는 게 맞으니 지금 구조 그대로 두면 된다.

- 캐릭터 탭 → 고름(주황 링) · 같은 캐릭터 다시 탭 → 해제
- 고른 뒤 **화면 아무 데나** 끌기 → 갈 자리 미리보기(파랑/빨강) · 손 떼면 걸어감
- 고른 뒤 바닥 탭 → 거기로 걸어감
- 두 손가락 → 언제나 줌 (걷기 미리보기는 자동으로 걷힌다)
- 몬이는 고를 수는 있지만 **따로 못 보낸다**(사람을 따라다니는 게 규칙이라
  목적지를 줘도 다음 프레임에 되돌아온다). `walkTo('moni', …)` 는 `{ok:false}` 다.

탭 판정 순서 — 정확한 것을 먼저, 손가락 오차를 감안한 것을 뒤에.
① 캐릭터 픽 상자(광선) ② 화분(광선) ③ 캐릭터(화면거리 36px) ④ 자리(화면거리 30px)
⑤ 고른 캐릭터가 있으면 바닥.

---

## 2. ★ game.html 에서 부를 것 (함수 · 시점)

### ㉠ 진행 표시 — **제일 값싼 개선이다**

40초를 검은 화면으로 두면 고장으로 읽힌다. `onProgress` 를 그대로 흘리기만 하면 된다.
`#roomFallback` 이 이미 있으니 그 자리를 쓰면 새 DOM 도 필요 없다.

```js
roomView = await mod.createRoomView($('roomCanvas'), {
  …기존 그대로…,
  onProgress: ({ ko, ms }) => {
    const el = $('roomFallback');
    if (el) el.innerHTML = `${ko}…<br><span style="opacity:.6">${(ms/1000).toFixed(1)}초</span>`;
  },
});
```

phase 는 순서대로 `start → data → room → ready → character:jachwi →
character_done:jachwi → character:moni → character_done:moni` 다.
`ready` 가 오면 방이 뜬 것이니 그때 `stage.classList.add('room-ok')` 를 지금처럼 하면 된다.

> ⚠ 다만 **이걸로는 첫 5초를 못 덮는다.** `createRoomView` 를 부르기 전
> (three.js·src·data·iframe) 이 부팅의 대부분이라, 그 구간 안내는 모듈 밖 classic
> 스크립트에서 띄워야 한다. 지금 부팅 감시 스크립트(`say()`)가 있는 그 자리다 —
> 40초 뒤에 "실패"를 띄우는 대신, **0.5초 뒤부터 "불러오는 중"을 띄우고**
> `__byeotBooted` 나 `room-ok` 가 오면 걷는 식으로 바꾸는 것을 권한다.

### ㉡ 캐릭터 조작을 게임 UI 에 얹고 싶다면

```js
// 캐릭터를 누르면 대사·상호작용을 띄우고 싶을 때
roomView.setCharacterTapHandler((id) => { /* 카드 열기 등 */ });
// 화분 조작 중에는 캐릭터 고르기를 풀어 두는 게 안전하다
picked.select = function (slotId) { roomView.selectCharacter(null); /* …기존… */ };
```

아무것도 안 해도 **누르면 골라지고 끌면 걷는다** — 링·미리보기·걷기 모션까지
모듈이 다 한다. 코어에서 필수로 부를 것은 **없다.**

### ㉢ 확대 iframe 을 늦게 싣는다면

```js
// 그때는 이걸 켜는 게 맞다 — 27MB 가 첫 화면의 유일한 짐이 되므로
createRoomView(canvas, { …, deferPlantAssets: true });
// 방이 뜬 뒤 데워 두기
roomView.warmPlantAssets();
```

---

## 3. ★ 부팅이 왜 느린가 — 잰 것

도구를 새로 만들었다. 짐작 대신 이걸 보십시오.

```
python tools/serve.py 8971
node tools/test_boot_profile.mjs                       # game.html
node tools/test_boot_profile.mjs --block='*monstera/skins/*'   # 반사실 — 안 받았다면?
node tools/test_boot_profile.mjs --cpu=4 --net=8000    # 폰 흉내
```

`tools/test_cdp.mjs` + `tools/test_boot_profile.mjs`. 의존성 0 — node 22 의 WebSocket 으로
크롬 개발자 프로토콜을 직접 말한다(npm 을 안 들였다).

### 측정표 — `game.html`, 로컬 서버, 회선 제한 없음

| 조건 | 방이 뜨는 시각 | 받은 용량 | 요청 |
|---|---:|---:|---:|
| 지금 그대로 | **10.15 s** | **457 MB** | 401 |
| ＋잎무늬 스킨을 안 받으면 | 6.04 s | 34 MB | 293 |
| ＋확대 iframe 을 안 싣는다면 | **4.08 s** | **6.2 MB** | 210 |

### 무엇이 그 시간을 쓰나 (지금 그대로)

| 무엇 | 장수 | 크기 | 언제 |
|---|---:|---:|---|
| **식물 GLB(몬스테라)** | 126 | **450.4 MB** | 1.7s ~ 10.8s |
| 캐릭터 GLB | 4 | 2.67 MB | 9.4s ~ 11.4s |
| 3D 엔진(three) | 4 | 1.34 MB | 0.6s ~ 1.5s |
| 게임 코드(src) | 25 | 0.48 MB | 0.9s ~ 9.7s |
| 그림(원화·초상화) | 11 | 0.43 MB | |
| plant_grow.html | 2 | 0.41 MB | |
| 데이터(json) | 13 | 0.17 MB | |
| 그 밖 | 215 | 0.73 MB | |

제일 무거운 파일 15개가 **전부** `assets/monstera/skins/*.glb` 다. 한 장에 6~7MB.

### 방 뷰가 스스로 잰 시간 (`view.bootTimings`)

```
start 0ms · room 80ms · ready 803ms · 캐릭터 둘 1887ms
```

**방 뷰가 쓰는 시간은 0.8초다.** 나머지 9초는 방 뷰를 부르기 전과, 옆에서 도는 iframe 이다.

---

## 4. ★ 고쳐야 할 것 — 코어 창 소유

### ① `plant_grow.html` : 잎 무늬 스킨을 부팅에 받지 않는다 — **457MB → 34MB**

`ASSET_FILES` 에 무늬종 잎(`skins/…`)이 104장 들어 있고 `loadAssets()` 가 **전부 한꺼번에**
받는다. 방에는 한 장도 안 쓰이고, 확대에서도 그 그루가 무늬종일 때만 쓴다.

`src/render3d/plant_assemble.js` 는 이미 이 문제를 알고 `skins/` 를 빼고 부른다(194~197행).
같은 일을 원본에서 하면 된다. **두 줄이면 된다** — 기본잎을 먼저 다 싣고 `cb()` 를 부른 뒤,
스킨은 뒤에서 조용히 채운다. `pickLeafKey`/`drawLeafStage` 가 이미 `if(ASSETS[k])` 로
없으면 기본잎으로 내려앉게 돼 있어서, 늦게 도착해도 안 깨진다.

```js
function loadAssets(cb){
  const loader=new THREE.GLTFLoader();
  const one=(k)=> new Promise(res=> loader.load(
    './assets/monstera/'+ASSET_FILES[k].split('/').map(encodeURIComponent).join('/'),
    g=>{ try{ ASSETS[k]=normalizeAsset(g.scene, !!LONGY[k], !!ANCHORB[k]); }catch(e){ console.warn('norm fail',k,e); } res(); },
    undefined, ()=>{ console.warn('load fail',k,ASSET_FILES[k]); res(); }));

  const all   = Object.keys(ASSET_FILES);
  const base  = all.filter(k=> !String(ASSET_FILES[k]).startsWith('skins/'));   // 26장 27MB
  const skins = all.filter(k=>  String(ASSET_FILES[k]).startsWith('skins/'));   // 104장 428MB

  Promise.all(base.map(one)).then(()=>{
    ASSETS_READY=true; cb&&cb();                 // ★ 여기서 화면이 뜬다
    /* 무늬종은 뒤에서 채운다. 그 사이에 무늬종을 그리면 기본잎으로 보였다가
       도착하면 바뀐다 — 안 뜨는 것보다 낫고, 부팅이 열 배 가볍다. */
    skins.reduce((p,k)=> p.then(()=>one(k)), Promise.resolve());
  });
}
```

> 더 나아가려면 **필요할 때만** 받는 게 맞다(그 그루의 무늬 키만). 그건 `pickLeafKey`
> 가 키를 정하는 자리를 알아야 해서 코어 창이 판단할 몫이다. 위 순차 로딩만으로도
> 부팅에서 428MB 가 빠진다.
>
> ⚠ 확인해 주실 것 하나 — `ensureLeafShape()` 는 `PET_CACHE` 로 **이미 다듬은 잎을
> 건너뛴다.** 스킨이 늦게 도착하면 그 잎은 아직 안 다듬어진 상태다. 다음 `redraw()`
> 에서 저절로 잡히는지(=`ensureLeafShape` 가 매 그리기마다 도는지) 코어 창에서
> 한 번 봐 주십시오. 안 돌면 스킨 로딩이 끝날 때 `PET_CACHE={}; redraw()` 를
> 한 번 부르면 된다.

### ② `game.html` : 확대 iframe 을 늦게 싣는다 — 여기서 **다시 2초**

```html
<!-- 지금 -->
<iframe id="growth" src="./plant_grow.html?embed=game" title="식물 확대"></iframe>
<!-- 바꿀 것 — src 를 비워 두고 -->
<iframe id="growth" data-src="./plant_grow.html?embed=game" title="식물 확대"></iframe>
```
```js
/* 방이 뜬 뒤에 싣는다. 확대는 플레이어가 화분을 탭해야 열리는 화면이라
   부팅 순간에 있어야 할 이유가 없다. */
function armGrowthIframe() {
  const f = document.getElementById('growth');
  if (!f || f.src) return;
  f.src = f.dataset.src;
}
// bootRoomView() 안, stage.classList.add('room-ok') 바로 뒤에서
armGrowthIframe();
```

⚠ **주의 하나.** `io.growth = createGrowthAdapter($('growth'))` 와
`await io.growth.ready()` 가 iframe 을 기다린다. src 를 늦게 물리면 `ready()` 도
그만큼 늦어진다 — 첫 턴을 밟기 전에만 도착하면 되므로 `armGrowthIframe()` 을
`room-ok` 시점에 두면 안전하지만, **`ready()` 를 부르는 자리보다 반드시 앞서야 한다.**
순서가 헷갈리면 `armGrowthIframe()` 을 `bootRoomView()` 시작 직후로 옮겨도
(=방과 동시에) 스킨 문제만 고쳐진 상태보다는 빠르다.

### ③ 같은 GLB 를 두 번 받는다 — 서버 설정 문제

`assets/monstera/*.glb` 12장(13.7MB)이 **두 번** 받아진다. iframe 이 한 번,
`plant_assemble.js` 가 한 번. 브라우저 캐시가 있으면 두 번째는 공짜인데
`tools/serve.py` 가 `Cache-Control: no-store` 를 보내서 캐시가 안 먹는다.
로컬 개발 서버라 의도된 것이고 **GitHub Pages 에서는 안 생긴다.**
다만 폰에서 로컬 서버로 열어 볼 때는 그대로 두 배가 되니, 폰 실측을 할 때는
`serve.py` 의 no-store 를 잠깐 끄고 재는 게 맞다.

---

## 5. 이번에 안 한 것 · 위험

- **`deferPlantAssets` 를 기본으로 켜지 않았다.** 재 보니 방 뜨는 시각이 0.3초밖에
  안 당겨졌고(8Mbps 로 조여도 같았다), 대신 첫 화분이 1초쯤 늦어진다.
  측정이 뒷받침하지 않는 변경을 기본으로 넣지 않았다. §2-㉢ 조건이 되면 켜십시오.
- **비켜서기(nudge)는 화분만 본다.** "가구도 가리면 안 된다"는 지시였는데, 가구는
  덩치가 커서 화면에서 늘 뭔가와 겹친다 — 그걸 다 피하면 캐릭터가 설 자리가 없다.
  그래서 **화분을 가릴 때만** 비켜선다. 가구 쪽 기준이 따로 있으면 알려 주십시오.
- **플레이어가 방금 보낸 자리에서는 8초 동안 안 비킨다.** 시켜서 간 자리를 제멋대로
  옮기면 조작이 안 먹은 것처럼 보인다. `view.nudgeCharacters()` 로 직접 부르면 무시한다.
- 걷는 동안 idle 변주는 안 끼운다(걸어가다 머리를 긁으면 다리가 멈춘다).
