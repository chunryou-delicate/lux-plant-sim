# 오늘 밤 실행 설계: 스토리·튜토·가이드·몬스테라 (90분, 병렬 4줄)

기준으로 삼은 것은 다섯 렌즈의 결과, `docs/handoff/master-story-inputs-20260925.md`, 그리고 확정 규칙 감사다. 이번 설계를 쓰면서 코드와 검사 파일을 직접 grep해 다시 확인했고, 파일은 하나도 고치지 않았다.

**대원칙**
- `touches_rules=true`인 제안은 모두 뺐다. 목록은 §4 끝에 있다.
- 퀘스트의 차례·수·문 열쇠, 몬스테라 생장 캐논, 독촉 차례와 「매일」 규칙은 그대로 둔다.
- `src/game/room_view.js`와 `src/render3d/*`는 손대지 않는다. 그래서 주인공의 손 흔들기·환호 클립(wave/cheer)은 오늘 밤 넣을 수 없다. 부를 창구가 room_view에만 있다.
- 확대 화면(drawGrowGauge·openZoomFor)은 아침 ⑤ 검사 전까지 손대지 않는다.

---

## 1. 상위 12 (영향 ÷ 품 순)

### #1 도착 장면 대사 차례 되살리기: 식물신이 선물 «앞»에 온다 〔W1 · 높음/S〕
- **파일·함수**: `game.html` `DLG_SOLO` 선언과 `dlgOpen()` 안의 solo 갈래.
- **지금 코드**:
  ```js
  const DLG_SOLO = new Set(['monsteraArrived', 'intro', 'moved_out', 'varieConfirmed']);
  if (solo) { dlgHold = ids.filter(x => x !== solo); ids = [solo]; }
  ```
- **지금 생기는 일 셋**:
  1. god1이 선물 뒤로 밀린다(확정 차례는 수확→식비→식물신→도착).
  2. `'moved_out'`은 사건 id라서 스크립트 id `movedOut`과 맞지 않고, 이사 장면이 혼자 뜨지 않는다.
  3. 버그: 바로 위 흩기 단계가 `dlgHold`에 넣은 «다음은» 줄을 solo 갈래가 덮어써서 잃는다.
- **새 코드**:
  ```js
  const DLG_SOLO = new Set(['monsteraArrived', 'intro', 'movedOut']);
  // dlgOpen 첫 줄 바로 뒤
  const fresh = new Set([].concat(scriptIds).filter(Boolean));   // 이번에 들어온 것
  // … (미룸 앞붙이기·흩기는 그대로) …
  if (solo) {
    const i = ids.indexOf(solo);
    const lead = ids.slice(0, i).filter(x => fresh.has(x));     // 수확·식물신 — 장면 «앞말»
    const tail = ids.slice(i + 1).filter(x => fresh.has(x));    // 원룸 첫 장면 등 — «뒷말»
    const old  = ids.filter(x => x !== solo && !fresh.has(x));  // 어제 미뤄 둔 것
    dlgHold = [...tail, ...old, ...dlgHold];                    // ⚠ 흩기로 미룬 줄을 안 잃는다
    ids = [...lead, solo];
  } else if (ids.length > DLG_MAX_PER_OPEN) { /* 그대로 */ }
  ```
- **검증 (CDP, 390×844, 새 판에서 intro를 다 넘긴 뒤)**:
  1. `__dlgOpen(['harvest','god1','monsteraArrived'])` 뒤 `__dlgLog.slice(-3)`의 id가 차례대로 `harvest, god1, monsteraArrived`이고 b 번호가 같아야 한다.
  2. `#dlgBox`를 계속 누르며 `#dlgWho`를 모으면, `?` 줄이 「가방에… 화분이 하나 들어와 있어.」보다 앞에 와야 한다.
  3. 잃는 버그: `__dlgOpen(['questDoneFirstHarvest','questOrderSeed','monsteraArrived'])` 뒤 `__dlgLog`에 `questOrderSeed`가 들어 있어야 한다(지금은 사라진다).

### #2 Day 0~1을 참말로: 물 준 순간 퀘스트를 보고, 거짓 두 줄을 없앤다 〔W2 핸들러 + W1 문안·퀘스트 · 높음/S〕

**W2가 `game.html`에서 고칠 것**
- `siruWater`:
  - `if (r.watered) banner('물을 줬습니다', \`오늘이 0일차입니다 — ${r.harvestDays || ''}일 뒤에 거둡니다\`); draw();`
  - → `if (r.watered) banner('물을 줬습니다', \`오늘부터 셉니다 — ${r.harvestDays || ''}일 뒤에 거둡니다\`); checkQuests(lastTurn); draw();`
- `siruPlant`:
  - 부제 `물을 줘야 ${days}일 회전이 시작됩니다` → `씨앗 ${r.seedsUsed}봉지 · 물을 주면 자라기 시작합니다`
  - `syncRoom(); draw();` → `syncRoom(); checkQuests(lastTurn); draw();`

**W1이 `game.html` `questSnapshotNow`에서 고칠 것**
- flatMap 앞에 `const rows = (() => { try { return cropPotList(fp, S.day); } catch { return []; } })();`를 둔다.
- 각 용기 객체에 `ready: !!((rows.find(x => x.id === (p && p.id)) || {}).ready),`를 더한다.

**W1이 `src/game/quest.js`에서 고칠 것**
- `first_harvest.todo`: `() => '다 자란 콩나물을 거두세요'`
  - → `(d, s) => arr(s && s.cropPots).some(p => yes(p && p.ready)) ? '다 자란 콩나물을 거두세요' : '콩나물이 자라는 중 — [다음 날]로 넘기세요'` (25자)
- `water_siru.reward`: `'회전이 돌기 시작합니다'` → `'콩나물이 자라기 시작합니다'`

**W1이 `src/game/dialogue.js`에서 고칠 것**

| 스크립트 | 지금 | 바꾼 뒤 |
|---|---|---|
| `questPlaceSiru` (3줄→1줄) | 「가방에 둔 채로는 안 되는 거야?」 / 「가방 안은 아무 자리도 아니야. 빛이 안 드니까.」 / 「어디에 두느냐. 그게 이 얘기의 전부야.」 | `{ who:'moni', face:'curious', text:'가방 안은 자리가 아니야. 꺼내야 시작돼.' }` |
| `questWaterSiru[1]` | 「아직. 물을 안 줬잖아.」 | 「아직. 씨앗 심고 물까지 줘야 해.」 |
| `questDoneWaterSiru` (3줄→1줄) | 「어제가 아니고?」·「어제는 그냥 놓여 있던 날이고.」가 붙어 있다 | `[{ who:'moni', face:'happy', text:'이제 세기 시작했어. 오늘이 첫날.' }]` |
| `questFirstHarvest` | 첫 두 줄: 「다 자란 것 같은데.」, 「자란 거랑 거둔 거는 달라…」 | `[{jachwi,'다 자라면 그냥 먹으면 돼?'}, {moni curious,'거둬야 먹지. 거둬야 다음 바퀴도 돌고.'}, {jachwi,'안 거두면?'}, {moni,'그 자리에 그대로 있어. 아무 일도 안 나고.'}]` |

**결과**
- 물을 준 D0에 「세기 시작」 한 줄과 questFirstHarvest 4줄이 흩기를 거쳐 이어 뜬다.
- D1 아침은 rentFirst 7줄과 #7의 shortBothCrop 3줄, 합 10줄이 된다(지금 18줄).

**검증**
- `BYEOT_URL=… W=390 H=844 node tools/probe_force5.mjs`로 손가락만 따라 D0부터 걷는다. `__dlgLog`에서:
  - `questDoneWaterSiru`와 `questFirstHarvest`가 day 0에 있어야 한다.
  - day 1에는 `rentFirst`와 `shortBothCrop`만 있어야 한다.
- 매일 `#questChipText`를 읽는다. D1~D4는 「콩나물이 자라는 중 — [다음 날]로 넘기세요」, D5 거두기 직전은 「다 자란 콩나물을 거두세요」여야 한다.

### #3 첫 등은 공짜인데 대사는 12만 원을 고민한다 → «값»이 아니라 «자리»를 고민하게 〔W1 · 높음/S〕

**`dialogue.js` `lampUnlocked`**: 첫 줄은 그대로 두고 나머지를 바꾼다. `LAMP.wonKo`·`daysKo` 줄, 「지금 급하진 않아.」, 「…고민되네.」, 「고민할 만한 값이라서 알려 준 거야.」를 뺀다. 머리 주석에 «첫 등은 game.html이 가방에 넣는다(L.owned=1)»를 적는다.
```js
{ who:'moni',   face:'curious', text:'가을이 됐으니 하나 알려 줄게. **식물등.**' },
{ who:'moni',   face:'happy',   text:'가방 열어 봐. 첫 개는 그냥 왔어.' },
{ who:'jachwi', face:'surprise',text:'…공짜로?' },
{ who:'moni',   text: LAMP.kwhKo ? `첫 개만. 전기는 하루 ${LAMP.kwhKo}이고.` : '첫 개만.' },
{ who:'moni',   text:'…그런데 없이는 안 커.' },            // [plan] 확정 줄 유지
{ who:'moni',   face:'teach',   text:'어디 다느냐가 문제야.' },
{ who:'jachwi', face:'think',   text:'…제일 오래 쓸 자리에 달아야겠네.' },
{ who:'moni',   face:'happy',   text:'고민할 건 그쪽이야.' }
```

**`questBuyLamp`** (6줄→4줄). 「해가 짧아졌어」처럼 빛이 지금 바뀐 것처럼 말하지 않는다. 초보 판은 여름 고정이다.
```js
{ who:'jachwi', text:'가을이면 해가 더 짧아지겠지.' },
{ who:'moni',   face:'curious', text:'응. 그러니까 **볕을 들이는** 거야.' },
{ who:'jachwi', face:'surprise', text:'볕을 들여?' },
{ who:'moni',   face:'happy', text:'**등 밑**이 이 방의 둘째 창턱이 돼.' }
```

**`questDoneBuyLamp`**: 아직 달지도 않았는데 「켰어」라고 하던 줄을 없앤다.
```js
{ who:'jachwi', text:'등이 생겼다. 손바닥만 하네.' },
{ who:'moni', face:'curious', text:'사람 눈엔 약해도 식물한텐 달라.' },
{ who:'moni', face:'happy', text:'이제 이 방에도 **밝은 자리**를 만들 수 있어.' }
```

**`quest.js` `buy_lamp`**
- `ko: '볕을 사 온다'` → `'볕을 들인다'`
- `todo: () => '식물등을 사서 밝은 자리를 만드세요'` → `() => '식물등을 달아 밝은 자리를 만드세요'`
- 열쇠·done·값은 그대로다. `lampSkipped`도 그대로 둔다. 순수 코어 판(A·C 경로)이 쓰고 test_dialogue_coverage가 찾는다.

**검증**
- CDP 390×844에서 `__dlgOpen(['autumnCame','lampUnlocked','questBuyLamp','questDoneBuyLamp'])`를 부르고 줄마다 스크린샷을 찍는다. 끝 글자가 `#next` 밑으로 들어가면 안 된다.
- 백그라운드로 `DAYS=50 STOP_AT=none node tools/probe_longwalk.mjs`를 돌린다. d45 `__dlgLog`에 세 id가 있고, `__S().tutorial.lamp.owned===1`이어야 한다.

### #4 무늬 대사를 게임에 맞추기: 몬이가 먼저 안다, 자르기는 «아직» 〔W1 · 높음/S〕

**`varieGranted` 첫 두 줄**은 [plan] ⓖ 승인판을 그대로 넣고 줄 길이만 나눈다. 나머지 줄은 그대로다.
```js
{ who:'moni',   face:'curious', text:'이 잎, **무늬가 섞였어.**' },
{ who:'jachwi', face:'surprise', text:'…어디? 아직 잘 모르겠는데.' },
{ who:'moni',   text:'**다 자라면** 보여.' },
{ who:'moni',   text:'무늬 진 데는 빛을 못 만들어.' },
{ who:'moni',   text:'그래서 **밝은 자리에서만** 나와.' },
```

**`varieLucky`** 앞 네 줄을 바꾼다. 「…어? 새 잎이 좀 이상한데.」, 「어어. 잠깐만. **그거 무늬야.**」, 「무늬?」, 「무늬가 섞여서 나오는 거. 흔한 게 아닌데.」 대신 아래를 넣는다.
```js
{ who:'moni',   face:'surprise', text:'어어. 잠깐만. **무늬가 섞였어.**' },   // 몬이 surprise는 이 한 줄만
{ who:'jachwi', face:'curious',  text:'…어디? 그냥 말린 잎인데.' },
{ who:'moni',   face:'curious',  text:'지금은 안 보여. **다 자라면** 보여.' },
```
- 「**두 번째 잎에** 바로 나오네. 운 좋다, 너.」 이하는 **그대로** 둔다. 08-13 박사님 방향이라 §4에서 여쭌다.
- 37자 줄은 「무늬 있는 그루를 잘라 물에 꽂으면,」 / 「그 삽수도 무늬를 물려받아.」로 나눈다.
- 「**그게 늘리는 방법이야.** 한 장을…」은 「**그게 늘리는 방법이야.**」로 줄인다.

**`varieSecond`** (10줄→6줄): 박사님 확정 「자르기 = 3번째 하프문 잎이 성숙했을 때」와 맞춘다. 원래 있던 「자른 건… 죽는 거 아니야?」 이하는 #5로 옮긴다.
```js
{ who:'moni',   face:'proud', text:'이번 잎에도 **무늬가 섞였어.**' },
{ who:'jachwi', text:'그럼 이제 잘라도 돼?' },
{ who:'moni',   face:'teach', text:'아직. 둘 다 **다 자라야** 해.' },
{ who:'moni',   text:'그때 한 장은 자르고, 한 장은 남기는 거야.' },
{ who:'jachwi', face:'tired', text:'또 기다리네.' },
{ who:'moni',   face:'calm', text:'이번 건 끝이 보이는 기다림이야.' }
```

**검증**
- `node -e`로 SCRIPTS를 import해 moni·surprise 줄 수를 센다. ===1이어야 한다.
- 새 줄 모두 `replace(/\*\*/g,'')` 뒤 25자 이하여야 한다.
- 390×844에서 `__dlgOpen(['varieLucky'])`, `(['varieSecond'])`로 줄마다 스크린샷을 찍는다.

### #5 새 장면 둘: 무늬가 «보이는» 날, 하프문으로 «자를 수 있게 된» 날 〔W1 스크립트 + W3 배선 · 높음/M〕

**W1이 `dialogue.js` SCRIPTS에 추가** (둘 다 한 번만 뜬다. REPEATABLE에 넣지 않는다)
```js
varieSeen: [
  { who:'jachwi', face:'surprise', text:'…아. 이게 그 무늬구나.' },
  { who:'moni',   face:'cheer',    text:'보이지? 다 자라니까 나오잖아.' },
  { who:'jachwi', face:'proud',    text:'…이 방에서 이런 게 나네.' },
  { who:'moni',   face:'curious',  text:'다음 잎은 또 달라. 기다려 봐.' }
],
varieHalfMoon: [
  { who:'jachwi', face:'surprise', text:'…이건 아까 거랑 완전히 다르네.' },
  { who:'moni',   face:'cheer',    text:'**하프문**이야. 흔한 거 아니야.' },
  { who:'jachwi', text:'이제 잘라도 돼?' },
  { who:'moni',   face:'proud',    text:'이제 돼. 둘 다 다 자랐으니까.' },
  { who:'jachwi', face:'worry',    text:'자른 건… 죽는 거 아니야?' },
  { who:'moni',   face:'teach',    text:'물에 꽂아. 뿌리 나와. **밝은 데** 두고.' },
  { who:'jachwi', text:'…드디어 나가는 길이 보이네.' },
  { who:'moni',   face:'happy',    text:'응. 그 한 장이 여기서 나가는 값이야.' }
],
```

**W3가 `game.html`에서 배선**
- 모듈 변수 `let pendingLeafScene = null;`를 둔다.
- `noteLeafGrades`의 `for (const a of r.assigned)` 루프 안, banner 다음에:
  ```js
  if (a.why === 'prologue' && a.leafNo === 2) pendingLeafScene = pendingLeafScene || 'seen';
  if (a.why === 'prologue' && a.grade === 'halfmoon') pendingLeafScene = 'half';
  ```
- `function playLeafScene(k)`를 새로 만든다. test_dialogue_coverage가 `dlgOpen('id')` 꼴의 글자를 긁으므로 id는 반드시 글자로 적는다.
  ```js
  function playLeafScene(k) {
    const ok = k === 'half' ? dlgOpen('varieHalfMoon') : k === 'seen' ? dlgOpen('varieSeen') : false;
    if (ok) { focusOnMonstera(); try { sfx.chime(); } catch {} (window.__stageLog ||= []).push({ day: S.day, kind: 'leaf:' + k }); }
    return ok;
  }
  window.__leafScene = (k) => playLeafScene(k);   // 진단 손잡이
  ```
- `showFirstPlayEvents`의 `banners(events)` 앞에서:
  ```js
  const leafK = pendingLeafScene; pendingLeafScene = null;
  ```
  - `leafK==='half'`이고 ✂ 말풍선을 세우는 판정(§삽수 말풍선 `free && (jar||pot)`)이 참일 때만 `events.push({ title:'✂ 이제 자를 수 있습니다', sub:'무늬 잎 둘이 다 자랐습니다 — 방의 ✂ 삽수 자르기를 누르세요' })`를 넣는다. 문턱 수 「2」나 「하프문」은 부제에 넣지 않는다.
  - `const ids = story.turn(...)` 바로 앞에 `if (leafK) playLeafScene(leafK);`를 둔다.

**검증**
- CDP로 `__leafScene('seen')`, `__leafScene('half')`를 부른다. `__dlgLog`의 마지막 id, 줄마다 스크린샷(390), 1초 안에 `__rv.camBusy()`로 카메라가 움직이는지를 본다.
- 실제로 닿는지는 `DAYS=130 STOP_AT=none probe_longwalk`를 백그라운드로 돌려 `__stageLog`와 `__dlgLog`를 본다. 밤 안에 못 닿으면 «못 걸어 봄»이라고 밝힌다([[walk-not-build]]).

### #6 도착 장면 다듬기와 첫 창턱 당기기 〔W1 문안 + W3 연출 · 높음/S〕

**`monsteraArrived`** (10줄→12줄, 모두 25자 이하). 「정해져 있어 / 두 번째랑 세 번째」, 「콩나물이랑 **반대**」 낱말은 지킨다.
```js
{ jachwi surprise '가방에… 화분이 하나 들어와 있어.' }, { moni happy '몬스테라야. 나도 오랜만에 보네.' },
{ jachwi curious '줄기 하나뿐인데… 네 머리 잎이랑 닮았다.' }, { moni curious '닮았지. 대신 얘는 콩나물이랑 **반대**야.' },
{ moni '콩나물은 어두울수록 하얗게 잘 됐잖아.' }, { moni '얘는 어두운 데 두면 **아무 일도 안 일어나.**' },
{ jachwi worry '먹지도 못하는 걸 왜…' }, { moni '얘는 정해져 있어. **두 번째랑 세 번째** 잎.' },
{ moni '거기 무늬가 나. 그게 값이 돼.' }, { jachwi curious '…값이 된다고?' },
{ moni happy '응. **이 방을 나가는 돈**, 거기서 나와.' }, { moni '가방에서 꺼내서 **밝은 데** 놓아 봐.' }
```

**`questMonsteraHome`** (4줄→1줄): 지금 「얘는 어디다 둬야 돼?」 / 「온 자리 말고. 거긴 시루한테나 좋은 데야.」 …는 가방으로 오는 지금과 맞지 않고 방금 들은 말을 되묻는다.
→ `[{ who:'moni', face:'happy', text:'볕이 제일 오래 머무는 데로 데려가 줘.' }]`

**`questDoneMonsteraHome`**
→ `[{ who:'jachwi', text:'…잘 부탁해.' }, { who:'moni', face:'calm', text:'나머지는 얘가 해. 우린 기다리면 돼.' }]`

**`quest.js` `monstera_home.why`**
- 지금: `'온 자리는 어둡습니다. 밝은 자리로 옮겨야 새순이 납니다 — 빛 판정은 7일 평균이라 나흘쯤 걸립니다.'`
- 바꾼 뒤: `'가방 안이나 어두운 자리에서는 자라지 않습니다. 밝은 자리에 두면 며칠 뒤부터 달라집니다.'`

**W3 연출**: `dlgOpen('monsteraMoved')`가 있는 세 곳(game.html ~4904, ~10930, ~13483)을 `if (isBrightestSlot(…) && dlgOpen('monsteraMoved')) focusOnMonstera();` 꼴로 바꾼다. dlgOpen은 처음 한 번만 참을 돌려주므로 당기기도 한 번뿐이다.

**검증**
- probe_force5를 d12까지 늘리거나 `node tools/probe_giftflow.mjs`를 돌린다. 창턱에 놓은 턴에 `monsteraMoved`가 나오고 카메라가 당겨져야 한다.
- 390에서 도착 줄 12개 스크린샷을 찍어 `#next` 밑으로 들어가는 글자가 0인지 본다.

### #7 Day 1 「둘 다 멀어」: 안 들어 본 «무늬»와 못 하는 «시루를 늘려» 빼기 〔W1 · 높음/S · 문안만〕
- **지금**: 「둘 다 멀어. 돈도, 무늬도.」 / 「…뭐부터 해야 돼.」 / 「돈. 무늬는 기다리면 와. 돈은 안 그래.」 / 「시루를 늘려. 하나로는 안 모여.」
- **방침**: loop.js 사건 시각은 안 건드린다. D1에 참인 말로만 바꾸고, 주석의 「돈을 먼저 말한다」는 «밥값»으로 지킨다. 주인공의 바람(「해 드는 방」)을 처음 말하는 자리로 쓴다.
- **`shortBothCrop`**:
  ```js
  [{ jachwi tired '…해 드는 방은 한참 멀었겠지.' }, { moni curious '멀어. 그러니까 밥부터 돌리자.' }, { moni '밥값이 덜 나가야 나머지도 모여.' }]
  ```
- **`shortBothLight`** (d22 무렵에 뜬다. 등·무늬 낱말을 안 쓴다):
  ```js
  [{ jachwi '밥은 이제 좀 돈다.' }, { moni proud '응. 밥은 됐어. 이제 남은 건 볕이야.' }, { jachwi think '…해 드는 방.' }, { moni calm '저 화분이 거기까지 데려다줄 거야.' }]
  ```
- **검증**: #2의 probe_force5 로그에서 D1 대사를 합해 10줄 이하인지 본다. 390 스크린샷을 찍는다.

### #8 시루 놓기 [확인] 전에 「자리를 정했네」가 뜨는 것 〔W2 · 높음/S〕
- **`startPhonePlace`**:
  - `draw(); afterPlace();`에서 `afterPlace();`를 지운다.
  - 끝의 `banner('여기에 둘까요?', …)`는 첫 플레이 중에는 부르지 않는다. 조건: `const fpOn = S.firstPlay && S.firstPlay.enabled && !S.firstPlay.completed && !(S.tutorial && S.tutorial.movedOut);`
- **`placeConfirmOk`**: `picked.clear();` 바로 다음 줄에 `try { checkQuests(lastTurn); } catch (e) { console.warn('[퀘스트 확인]', e && e.message); }`를 넣는다. `picked.before`가 비워진 뒤라야 `cropPotConfirmed`가 참이 된다. 두 번 불러도 안전하다고 주석에 적혀 있다.
- **CSS**: `#stage.confirming #placeConfirm{display:flex}` 옆에 `#stage.confirming #plantActions{visibility:hidden}`를 추가한다.
- **`startPhonePlacePotBag`** (~7286, 가방 몬스테라): 같은 꼴(`afterPlace()`가 [확인]보다 먼저 돎)이면 같이 옮긴다. `probe_bagtap_confirm.mjs`와 `probe_giftflow.mjs`로 먼저 확인한다.
- **검증**: `node tools/probe_dlgwhen.mjs` (390×844)
  - ④ 시루 칸을 누른 뒤: `__dlgLog`에 `questDonePlaceSiru`가 없어야 하고, 스크린샷에 확인 팝업만 보여야 한다.
  - ⑤ `#placeOk` 뒤: `questDonePlaceSiru` → `questWaterSiru` 차례로 떠야 한다.

### #9 무늬 잎 그림을 미리 받아 두기: 첫 프레임과 성숙하는 날의 «민잎 번쩍임» 없애기 〔W3 · 높음/S · 캐논 무관〕
- **파일·함수**: `plant_grow.html`. `wantSkin` 아래에 함수를 더하고, `buildPlant`의 `const {axes, axBase, leafM}=growTopology(g);` 다음에 한 줄을 넣는다.
  ```js
  function prefetchVarieSkins(axes, g, leafMOf){
    for(const ax of axes){
      if(!ax.varie || ax.birth>g || leafDroppedOf(ax.leafBirth)) continue;
      const m = g>=ax.leafBirth ? leafMOf(ax,g) : 0;
      if(m<P.stageYoung) ensureSkin('leaf_young_albo');
      if(m<P.stageMid){ const n=midAlboNumOf(ax.leafBirth, ax.alboMid); ensureSkin('leaf_mid_albo'+Math.max(1,Math.min(ALBO_MID_MAX,n))); }
      if(m>=P.stageYoung){ const n=matAlboNumOf(ax.leafBirth, ax.alboMid, ax.matRoll); if(n>0) ensureSkin('leaf_mat'+Math.max(1,Math.min(MAT_ALBO_MAX,n))); }
    }
  }
  // buildPlant 안:  prefetchVarieSkins(axes, g, leafM);
  ```
- **지킬 것**:
  - rng·VARIE_STATE·MAT_STATE는 건드리지 않는다. 받는 장수는 그대로이고 시점만 앞당긴다.
  - `<script>` 블록 구조와 `init()` 호출부를 바꾸지 않는다. `render3d/plant_assemble.js`와 `test_maturation.mjs`가 이 원문을 정규식으로 잘라 쓴다. 방도 같은 buildPlant를 평가하므로 방에도 효과가 간다.
- **검증**:
  - `test_skin_room_matches_zoom`, `test_maturation`, `test_growth_parity`, `test_monstera_canon`, `test_prologue_varie`, `test_perf_budget`이 초록이어야 한다.
  - 진단: iframe에서 `skinsPending()`과 `leafSkinUsedAll()`을 쓴다. 전역이 아니면 `window.__skinDiag`를 읽기 전용으로 연다. 무늬 잎이 m=0.22를 넘는 첫 프레임의 키가 `leaf_young_albo`이고, 성숙하는 날 `leaf_mature`를 한 번도 안 거쳐야 한다.

### #10 대사와 배너가 글을 가리는 것 걷기 〔W4 · 중간/S · CSS 두 줄〕
- **`game.html` CSS**: `#stage.talking #resow{opacity:.35;pointer-events:none}` 묶음 바로 뒤에 아래를 추가한다.
  ```css
  #stage.talking #next{opacity:0;transition:opacity .15s}          /* 「다음 날▼ 탭」 겹침 — 못 누르는 규칙은 그대로 */
  #stage:has(#event.on) #questChip{opacity:0;pointer-events:none;transition:opacity .2s}  /* 배너 6초 동안 칩이 비킨다 */
  ```
  #questChip·#event·#next는 모두 `<main id="stage">` 안에 있는 것을 확인했다.
- **검증**: `node tools/playshot.mjs --tag w4 --days 3 --size 390x844`를 돌린다. `_list.md` 겹침 목록에 `next ⇄ dlgNext`, `next ⇄ dlgText`, 배너 ⇄ questChip 줄이 없어야 한다.

### #11 폰 상점 손가락과 주문 뒤 시트 〔W2 · 중간/S〕
- **`updateHint`의 `shopDoor`**: 건너뛰기 조건을 넓힌다.
  ```js
  if (el.getAttribute && (el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-current') === 'true' || (el.classList && el.classList.contains('cur')))) continue;
  ```
  syncNav가 열린 레일 단추에 `cur`와 `aria-current`를 붙인다. 지금 조건이 이것을 못 알아봐서 [상점]을 두 번 누르면 상점이 닫힌다.
- **`$('buyGo').onclick`**: `banner('주문했습니다', …)` 다음에 `if (S.firstPlay && S.firstPlay.enabled && !S.firstPlay.completed) { try { window.__byeotSheet.close(); } catch {} }`를 넣는다.
- **`updateHint` «떠 있는 창» 갈래** (`'여기를 눌러 보세요'`, ~5589): 창이 `buyPanel`이고 buyItemId가 있으면, 품목표의 `leadDays`를 읽어 `'개수를 정하고 [주문] — 내일 옵니다'` 또는 `'… — 이틀 뒤에 옵니다'`로 말한다. 못 읽으면 지금 말 그대로 둔다.
- **~5883**: `'씨앗을 미리 주문해 두세요'` → `'씨앗을 사러 갑니다'` (재고 0일 때 「미리」는 틀린 말이다).
- **`placeHintAt`**: `if (r.top - hh + 4 < lim)` → `if ((el.closest && el.closest('#navbar')) || r.top - hh + 4 < lim)`. 세로 탭 줄은 옆에서 가리킨다.
- **검증**: `playshot --tag w2 --days 6 --size 390x844`를 돌린다. D5 [상점]을 누른 뒤 1.5초 안에 `__hintLast`가 navShop이 아니어야 하고, 주문 뒤 시트가 닫혀 있어야 한다. `node tools/probe_hintaim.mjs`도 돌린다.

### #12 몬스테라의 작은 보상: 잎이 펴진 날, 자리가 밝아진 날, 첫 새순 〔W3 문안/연출 + W1 한 줄 · 중간/S~M〕

**`showFirstPlayEvents`** (pot0 기준, 메모리 변수만 쓴다. 세이브 칸은 안 늘린다)
- **잎 펴짐**:
  - `let _prevPhase=null`을 둔다.
  - 어제 `turn.growthPhase.phaseId`가 `spear_furled`나 `spear_opening`이고 오늘 `leaf_`로 시작하면:
    - `events.push({ title:'🌿 새 잎이 펴졌습니다', sub:'밝은 자리에 둔 만큼 납니다' })`
    - `focusOnMonstera()`
    - `__stageLog` 기록
  - 불러온 뒤 첫 턴은 prev가 null이라 울리지 않는다.
- **밝아짐**:
  - 서열 `critical<poor<stagnant<slow<good<best`를 쓴다.
  - pot0의 `turn.growthSpeed.band`가 어제보다 오르고 오늘 값이 slow 이상이면 `{ title:'💡 이 자리가 더 밝아졌습니다', sub:\`자라는 속도: ${BAND_KO[어제]} → ${BAND_KO[오늘]}\` }`를 낸다.
  - 한 판·한 그루·한 밴드에 한 번(Set)만 낸다.
  - `BAND_KO`는 `detail.monstera` 안의 KO 표를 모듈 const로 끌어올려 두 곳이 같이 쓴다(W3 소유).
- **첫 새순 배너** (~11125): `{ title:'🌱 말린 새순이 나왔어요!', sub:'자리에 따라 필요한 빛이 다릅니다.' }` → `{ title:'🌱 첫 새순이 올라왔습니다', sub:'밝은 자리에 둔 보람입니다' }`. 합니다체로 맞춘다.
- **덤**: `[자세히]` 카드에 `잎 갈라짐` 줄을 넣는다. `io.growth.canFenestrate(false)`가 참이면 「이 자리 빛이면 새 잎이 갈라질 수 있습니다」, 거짓이면 「이 자리 빛으로는 통잎으로 납니다 — 더 밝아야 갈라집니다」. 숫자는 쓰지 않는다. 그루가 하나일 때만 낸다.

**W1**: `spearFurled`의 몬이 줄과 식물신 줄 사이에 `{ who:'jachwi', face:'proud', text:'…너도 여기서 버텨 보겠다는 거네.' }`를 넣는다. 식물신 줄 수는 그대로다.

**검증**: `DAYS=50 STOP_AT=none probe_longwalk`를 백그라운드로 돌린다. `__stageLog`에 창턱으로 옮긴 뒤 bandUp 1~3회, d36~40 무렵 leafOpen 1회가 있어야 한다. 그 턴의 스크린샷을 찍는다.

### W1 덤 (시간이 남으면, 문안만)
- **25자 넘는 줄 쪼개기**:

  | 스크립트 | 지금 | 바꾼 뒤 |
  |---|---|---|
  | `questRadish5[4]` | 한 줄 | 「콩나물은 어두울수록 하얗고 아삭해.」 / 「무순은 **반대야.** 빛을 봐야 파래지고 알싸해져.」 |
  | `questSellVarie[3]` | 한 줄 | 「하나는 이사비.」 / 「하나는 **무늬 삽수를 팔아 본 적.**」 |
  | `autumnCame[2]` | 한 줄 | 「겨울로 갈수록 창 하나로는 모자라져.」 / 「자리 탓이 아니야. **해가 낮아지는** 거지.」 |
  | `movedOut[7]` | 한 줄 | 「들었을 거야.」 / 「빛은 안 들어도 소리는 잘 들리는 방이었잖아.」 (movedOut ≥8줄 검사 통과) |
  | `questSiru5[4]` | 한 줄 | 「하루에 물 줄 수 있는 횟수.」 / 「**이 방에서 제일 모자란 거.**」 |

- **`questOrderSeed`**:
  - 값 줄(`한 봉지에 ${BEAN_WON_KO}, …`)은 이미 있는 「한 봉지가 시루 하나 몫이야.」로 한 줄만 둔다. 파일 주석 「씨앗값을 안 읊는다」와 맞춘다.
  - 끝 줄 「시루를 늘리면 그만큼 더 시켜야 하고.」를 지운다.
  - `BEAN_LEAD_KO`를 하루/이틀/사흘 낱말로 바꾼다.
- **첫 수확 날 줄**:
  - `harvest[1]`: 「하얗지? 어두운 데 둬서 그래.」
  - `learnCropDark`: 「**어두운 자리도 자리야.** 이제 알겠지?」
- **`questDoneFirstHarvest`**: 「…엄마는 콩나물국을 늘 짜게 끓였는데.」 / 「짰어?」 / 「응. 그래서 밥을 두 공기씩 먹었지.」 부모 이야기에 새 설정이 한 줌 붙으므로 §4에 표시했다.

---

## 2. 작업줄 넷 (파일 임자는 겹치지 않는다)

| 줄 | 혼자 쥐는 파일 | game.html에서 손대도 되는 곳 (함수·블록 이름) | 손대지 않는 곳 |
|---|---|---|---|
| **W1 이야기·퀘스트 문안** (#1 #2문안 #3 #4 #5스크립트 #6문안 #7 #12한 줄, 덤) | `src/game/dialogue.js`, `src/game/quest.js` | `DLG_SOLO`·`dlgOpen`, `questSnapshotNow` | dlgPaint·dlgFlushHeld 동작, 독촉(pickNudge·chatterContext·NUDGE_DAYS), EVENT_SCRIPT 표 |
| **W2 첫날 가이드·손가락** (#2 핸들러 #8 #11, 덤: `을(를)`→`josa()` 청소, bagHelpHTML 마지막 줄) | 없음 (game.html만) | `siruPlant`·`siruWater`·`siruHarvest`(josa), `startPhonePlace`·`startPhonePlacePotBag`·`placeConfirmOk`, `updateHint`(shopDoor 포함)·`placeHintAt`, `$('buyGo').onclick`, CSS `#stage.confirming …` 블록 | FENCE_GIVE_UP·hintNoDim·settingDone, 걸음 순서, 쪽지 표(COACH_NOTES·walkOff) |
| **W3 몬스테라 무대** (#5 배선 #6 연출 #9 #12) | `plant_grow.html` (buildPlant 근처만) | `noteLeafGrades`, `focusOnMonstera`, `showFirstPlayEvents`, `detail.monstera` 카드 IIFE(KO 표 끌어올리기·갈라짐 줄), `monsteraMoved` 세 곳의 그 한 줄, 새 `playLeafScene`·진단 손잡이 | drawGrowGauge·openZoomFor(아침 ⑤), sfx.js(새 소리 없음, chime만), room_view·render3d |
| **W4 겹침·첫인상** (#10, 덤: 첫 가계부 빈 줄 접기, #mealGuide 「묶음」→「몫」) | 없음 | CSS `#stage.talking …` 블록 바로 뒤, `drawMonthPanel`, `#mealGuide` 본문 HTML | banner()·banners() 본문, questChipShouldShow(CSS로 끝낸다) |

**함께 지킬 것**
- game.html은 **Edit만** 쓴다. Write로 통째로 쓰지 않는다. Edit마다 바로 앞에서 다시 Read한다.
- 손대는 함수는 위 표에 적힌 것뿐이다. 한 줄의 game.html 변경은 모두 합쳐 약 60줄 안으로 둔다.
- 네 줄이 같은 작업 트리를 쓴다. Edit 하나하나가 **부팅되는 파일**을 남겨야 한다. game.html을 고친 뒤마다 부팅 확인을 한다: `__byeotBooted===true`이고 콘솔 오류가 0이어야 한다.
- 서버 포트는 줄마다 따로 쓴다: W1 8971, W2 8972(probe_force5 기본값), W3 8973, W4 8963(test_monthly 기본값). 띄우는 법은 `python tools/serve.py <port>`이고 `BYEOT_URL`로 넘긴다.
- **워커는 커밋하지 않는다.** 마스터가 다 모아 전체 검사를 돌린 뒤 `git commit -- <파일>`로 파일을 박아 커밋한다([[shared-index-commit]]). game.html은 마지막에 한 번만 커밋한다.
- 합치는 차례: W1(dialogue/quest) → W3 배선 → W2 → W4. `test_dialogue_coverage`는 **W1 스크립트와 W3 배선이 둘 다 들어간 뒤에만** 초록이 된다. 새 스크립트는 `dlgOpen('varieSeen')`처럼 글자 그대로 불려야 한다.
- 시간표(90분): 0–10 읽기 · 10–55 고치기 · 55–80 줄별 검사 · 80–90 마스터가 합치고 probe_force5로 D0부터 걸음.

---

## 3. 줄마다 초록으로 지킬 검사

**글자에 거는 검사를 grep한 결과 (tools/test_\*.mjs, tools/probe_\*.mjs)**
- 바꾸는 문장 중 검사가 글자로 잡는 것은 **없다**. 다음은 0건이었다: 「다 자란 콩나물을 거두세요」, 「다 자란 것 같은데」, 「어제는 그냥 놓여」, 「볕을 사 온다」, 「식물등을 사서」, 「생각보다 안 밝네」, 「두 장째」, 「운 좋다」, 「둘 다 멀어」, 「무슨 일 있어」, 「가방 안은 아무 자리도」, 「온 자리 말고」, 「말린 새순이 나왔어요」, 「여기에 둘까요」, 「물을 안 줬잖아」, 「무늬가 섞였」, 「고민할 만한 값」, 「온 자리는 어둡」, 「1일 뒤」.
- 「0일차」와 「회전이 시작」은 검사 **이름과 주석**에만 있다(test_bagcell W-5, test_banjiha_routes B-3 등).
- 「씨앗을 미리 주문해 두세요」, 「여기를 눌러 걸어가」, 「끌거나 눌러서 방 안」은 probe의 주석에만 있다.

**⚠ 글자·꼴을 실제로 거는 곳 (바꾸면 깨진다)**
- `test_monthly.mjs`:
  - `'밥으로 아낀 식비'` =~ `/^−[\d,]+원$/`, `'거둔 것'` =~ `/\(\d+회전\)/`.
  - 가계부의 「(N회전)」은 **바꾸지 않는다**. 렌즈2가 낸 「번 거둠」은 뺐다.
  - W4가 −0원을 고칠 때는 saved>0인 달의 출력을 바꾸지 않는다.
- `test_dialogue_coverage.mjs`:
  - 모든 SCRIPTS가 불리는 자리를 가져야 한다(`dlgOpen('id')` 긁기, 사건·퀘스트 표, 손으로 적은 6개).
  - 표정 키가 FACE_FILE에 있어야 한다.
  - 식물신은 `god1`·`movedOut`·`spearFurled` 셋에 3줄이어야 한다.
  - `movedOut`은 8줄 이상이어야 한다.
  - `lampSkipped`가 순수 판 A·C 경로에서 닿아야 한다(스크립트를 지우지 않는다).
- `test_quest.mjs`: 모든 todo ≤28자(`questTodo(q)`는 스냅샷 없이 부르므로 «자라는 중» 갈래 25자가 재진다). siru5 todo가 need의 수를 담아야 한다(안 바꾼다).
- `test_questui.mjs`: `#quest`가 `v.next.todo`와 같아야 한다. first_harvest todo는 `questSnapshotNow`의 `ready`를 보므로 화면과 표가 같은 값을 읽는다.
- `test_guide_notes.mjs`: NOTE_IDS 여섯(walk·walkTip·walkOff·furn·pot·zoomTip). walkOff는 건드리지 않는다.
- `test_quiet.mjs`: 수확 배너에 `/거뒀습니다/`가 있어야 한다. josa로 바꿔도 남는다.
- `test_dawn6.mjs`, `test_sellpopup.mjs`: 밥상 팝업의 「[이대로 다음 날 ▸]」 단추. 손대지 않는다.

**줄별로 돌릴 검사**
- **W1**:
  - 순수: `test_dialogue_coverage`(W3 배선 뒤), `test_quest`, `test_tutorial`, `test_first_play`, `test_first_play_attacks`, `test_stamina_xp`.
  - 브라우저: `test_questui`.
  - 걸음: `probe_dlgwhen`, `probe_questorder`, `probe_questchain`, `probe_nudge`(동작 불변 확인), `probe_force5`.
  - 백그라운드: `DAYS=50 STOP_AT=none probe_longwalk`. `tools/_out/storylens_walk/dlglog.json`과 날짜별 id를 맞대 본다.
- **W2**: `test_place_confirm`, `test_bagcell`, `test_uiwire`, `test_nextday_gate`, `test_guide_notes`, `test_buypopup`, `test_siru_add`, `test_siru_each`, `test_multisiru`, `test_quiet`, `probe_force5`(390×844), `probe_dlgwhen`, `probe_bagtap_confirm`, `probe_giftflow`, `probe_hintaim`, `playshot --days 6 --size 390x844`.
- **W3**: `test_skin_room_matches_zoom`, `test_maturation`, `test_growth_parity`, `test_monstera_canon`, `test_prologue_varie`, `test_variegrade`, `test_skinsize`, `test_perf_budget`, `test_roomview_perf`, `test_escapecut`, `test_cutting_wiring`(자르기 문 불변), `probe_v2_camaudio`, `test_dialogue_coverage`(W1과 함께), `DAYS=50 STOP_AT=none probe_longwalk`(`__stageLog`).
- **W4**: `test_monthly`, `test_mealbykind`, `test_sellpopup`, `test_dawn6`, `test_questui`, `test_nextday_gate`, `test_uiwire`(talking 판정), `playshot --days 3 --size 390x844`(`_list.md` 겹침표).
- **마스터 최종**: 모두 합친 판에서 `probe_force5`로 D0부터 걷는다([[walk-not-build]]). 「세운 판에서 됐다」로 보고하지 않는다.

---

## 4. 위험

1. **같은 파일을 넷이 고친다.** game.html 동시 편집은 Edit 충돌이나 반쯤 고친 파일로 다른 줄의 검사를 깨뜨릴 수 있다.
   - 막는 법: 함수 임자를 나누고, Edit만 쓰고, 고칠 때마다 부팅을 확인한다.
   - 그래도 깨지면 그 줄의 편집이 끝날 때까지 다른 줄은 순수 검사만 돌린다.
2. **checkQuests를 물 주는 순간에 부르면**(#2) first_harvest가 D0에 열린다.
   - 독촉 날수가 하루 당겨져 「그거 아직이지?」가 d5가 아니라 d4에 뜰 수 있다. 수·규칙은 그대로다.
   - 퀘스트 보상 지급도 D1 턴에서 D0 순간으로 옮겨진다.
   - longwalk에서 날짜별 id가 달라진 곳을 모두 적는다.
3. **solo 갈래가 버그로 잃던 줄을 이제 살린다**(#1). 그동안 한 번도 안 뜨던 «다음은» 대사가 새로 나타날 수 있다. longwalk 전후 차이를 적는다. 이사 장면은 이제 정말 혼자 뜨고, 원룸 첫 장면이 그 뒤에 바로 이어진다.
4. **하프문 장면의 「이제 돼」는 잎 문만 참이다.** 병(jar)이 없는 등 다른 까닭으로 자르기가 막혀도 대사는 뜬다. ✂ 배너만 ✂ 말풍선 판정을 빌려 가린다. W3는 그 턴의 `cutBlockedReason`을 기록에 남긴다.
5. **밤 안에 새 장면 둘을 실제로 걸어 닿지 못할 수 있다.** 셋째 잎이 성숙하는 날이 늦다. 진단 손잡이로 잰 것과 걸어서 닿은 것을 따로 보고한다.
6. **prefetch**(#9)는 growth 창의 파일이다.
   - 약 4MB 그림을 더 일찍 받으므로 perf 예산 검사를 본다.
   - plant_assemble이 원문을 정규식으로 자르므로 스크립트 구조가 바뀌면 방 전체가 깨진다.
   - 방과 확대 화면이 같은 그림을 쓰는지 검사로 확인한다.
7. **표정 배정**: 새 줄에 cheer·proud·teach·calm(09-07 몬이 새 낯)을 쓴다. [plan] 배정표(plan-moni-faces ⓚ~ⓡ)의 공식 승인 전이다. 이미 있는 줄의 낯은 되도록 그대로 두었다. 몬이 surprise는 varieLucky 한 줄만 쓴다.
8. **새 설정 한 줌**: questDoneFirstHarvest의 「엄마의 짠 콩나물국」은 부모 이야기에 새 사실을 더한다. 오프닝 세 원칙(울음을 끌지 않는다 · 몬이는 위로하지 않는다)은 지키지만, 박사님께 한 줄 확인을 받는다. 되돌리기 쉬운 3줄이다.
9. **첫 등 대사는 «첫 등은 공짜»(game.html L.owned=1)에 기대어 참이다.** 공짜 규칙이 바뀌면 이 대사가 틀린 말이 되므로 dialogue.js 주석에 그 의존을 적는다. 순수 코어 판(A·C, 등이 공짜가 아님)은 화면이 아니라 상관없다.
10. **자리 비키기**: 아침의 확대 화면 ⑤ 검사와 방·조도 검사 자리는 건드리지 않는다. 식물 줄의 잎 수·진행 점(drawGrowGauge·drawPlantMore)은 그래서 미뤘다.

### 뺀 것 (규칙에 닿거나 금지 파일이 필요함) → 박사님께 여쭐 것
- **ⓐ 독촉을 «할 수 있었는데 안 한 날»만 셀지** (렌즈 1·2·4 공통 1위).
  - 지금은 d2~d25 거의 매일 잔소리가 나오고, chatCrop1·2·부모·집주인 잡담이 한 번도 안 뜬다.
  - 박사님의 「매일매일」 해석에 걸린 문제다.
  - 준비해 둔 패치: `chatterContext` 독촉 고리에 `nudgeWaiting(id)`를 둔다. first_harvest는 익은 시루가 없을 때, order_seed는 주문·재고·자라는 중일 때, leaf_two·three는 늘 «기다림»으로 보고 건너뛴다.
  - 문안만 바꾸는 대안: `nudgeWorry` 「무슨 일 있어?」(sad) → 「그거, 같이 볼까?」(worry). 이 역시 [plan] 문안이다.
- **ⓑ 둘째 잎 무늬를 「운 좋다」(08-13)와 「정해져 있어」(08-29) 중 어느 쪽으로 둘지.** 오늘은 둘 다 남기고, 말하는 사람만 몬이로 바꿨다.
- **ⓒ 원화 ev_\* 열 장의 몬이가 정본과 다르다.** 화분이 없고 꼬리와 등딱지가 있다. 다시 칠할지(크레딧 ③ 대기), 몬이를 빼고 잘라 쓸지. 결정 전에는 원화를 붙이지 않는다.
- **ⓓ 밥상 팝업을 매일 띄울지**, 전날과 같으면 한 줄 배너로 넘길지. 박사님이 요청하신 기능이다.
- **ⓔ 검수 탭과 개발 설정을 기본으로 숨길지**(`?dev=1`). 박사님의 검수 흐름과 `#log` 위치(#pageDev)가 함께 움직인다.
- **ⓕ 첫날 진행도 「1/5 · 시루 놓기」 칩.** 대기 항목 「진행도를 보여 줄지」와 같은 물음이다.
- **ⓖ `lampSkipped`는 게임 안에서 영영 안 뜬다.** 지울지 둘지.
- **금지 파일 때문에 못 하는 것**: 주인공 wave·cheer 몸짓(room_view.js에 창구가 필요하다).
- **다음으로 미룬 것**:
  - 미뤄 둔 대사를 «다음 날»로 넘기는 것(계약 해석 문제, M).
  - move_short 사건 시각 늦추기(loop.js). 오늘은 문안으로 대신했다.
  - 걷기 목표점 바꾸기, walkOff 늦추기, 카메라가 흔들리는 동안 손가락 막기. 모두 W2가 시간이 남을 때만 한다.