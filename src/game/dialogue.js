/* 대화 — 대사 데이터와 진행 규칙 (2026-08-03)
 *
 * ★순수하다. DOM 도 타이머도 모른다. 화면은 game.html 이 그린다.
 *   여기가 DOM 을 알면 헤드리스에서 대사 순서를 못 검증한다.
 *
 * 화자는 셋이고 **하나는 외형이 없다.**
 *   jachwi  주인공(자취생)     초상화 있음
 *   moni    마스코트 몬이       초상화 있음 · 3D 는 char_mascot_sprout.glb (0.375m 고정)
 *   god     식물신             ★초상화 없음 — first_play.md §식물신 확정:
 *                              "대사 한 줄. 외형 없음 · 이름·모습·설정을 지금 정하지 않는다"
 *                              화면에서는 빛/실루엣으로만 처리한다. 얼굴을 만들지 말 것.
 *
 * ★표정 키는 game.html 의 `FACE_FILE` 이 정본이다. 거기 없는 키를 쓰면 조용히 기본 얼굴로
 *   떨어진다 — 오류가 안 나는 종류라 `tools/test_dialogue_coverage.mjs` 가 대조한다.
 *     jachwi  base · happy · worry · cry · surprise · tired
 *     moni    base · happy(파일은 excited) · sad · curious
 *
 * ★이 파일이 늘어난 이유 (2026-08-03) — 반지하 탈출까지 **말 없는 날이 43일** 있었다.
 *   첫 플레이 3종(수확·도착·말린 새순) 말고는 대사가 아예 없어서, 월세도 가을도 식물등도
 *   숫자만 바뀌고 아무도 아무 말을 안 했다. 그 구간을 채운 것이 아래 §2~§5 다.
 */

export const SPEAKERS = {
  jachwi: { ko: '나',   portrait: true  },
  moni:   { ko: '몬이', portrait: true  },
  god:    { ko: '?',    portrait: false }   // ★이름도 아직 없다. 물음표 그대로 둔다
};

/* 한 대사 = { who, text, face? }
   face 는 초상화 표정 키다. 없으면 기본. 초상화가 없는 화자(god)는 무시된다. */

export const SCRIPTS = {

  /* ═══ §1 첫 플레이 ═════════════════════════════════════════════════════
     순서는 first_play.md §2 계약 그대로다 — 수확 → 식비 → 식물신 → 도착.
     ★식물신이 식비 뒤·도착 앞에 온다. 그 자리가 확정이다. */

  /* ★오프닝 (박사님 2026-08-03) — 주인공은 **고아 자취생**이다.
     힘든 상황에서 부모를 찾으며 울고, 그때 마스코트가 나타나 "식물신이 보냈다"고 한다.

     쓰면서 지킨 것 셋:
     ① **울음을 길게 끌지 않는다.** 튜토 첫 화면이다. 무게는 두 줄이면 실리고,
        더 끌면 플레이어가 [건너뛰기]를 누른다 — 그러면 아무것도 안 남는다.
     ② **식물신은 여기 안 나온다.** 외형도 이름도 없는 것이 확정이라(first_play.md),
        "식물신이 보냈다"를 **몬이가 대신 말한다.** 본인은 Day 4에 한 줄뿐이다.
     ③ **몬이가 위로부터 하지 않는다.** "괜찮아"는 값싸다. 할 수 있는 일을 내민다 —
        이 게임이 주는 위로는 대사가 아니라 **자리를 옮기면 식물이 자라는 것**이다. */
  intro: [
    /* ★표정이 한 줄씩 다르다. 예전엔 worry 하나가 성격이 다른 네 줄을 혼자 감당했다 —
       담담한 체념 · 울음 · 막막함 · 놀람은 같은 얼굴로 하면 안 된다. */
    { who: 'jachwi', face: 'tired',    text: '…불도 잘 안 드는 방이네.' },
    { who: 'jachwi', face: 'cry',      text: '엄마… 아빠…' },
    { who: 'jachwi', face: 'worry',    text: '나 이제 어떻게 살지.' },
    /* ★여기서 몬이가 뿅 나타난다. 화면 연출은 game.html 의 .pop 이 한다. */
    { who: 'moni',   face: 'happy', pop: true, text: '— 뿅!' },
    { who: 'jachwi', face: 'surprise', text: '…뭐야?!' },
    { who: 'moni',   text: '놀랐지. 나는 몬이야.' },
    { who: 'moni',   text: '**식물신**이 보냈어. 너 혼자 두면 안 되겠다고.' },
    { who: 'jachwi', text: '식물신…? 그런 게 있어?' },
    { who: 'moni',   face: 'happy', text: '있어. 얼굴은 못 봤지만.' },
    { who: 'moni',   text: '내가 도와줄게. 대단한 건 못 해도, 굶지는 않게.' },
    { who: 'moni',   face: 'happy', text: '가방에 콩나물 시루가 있어. **어두운 데** 놓아 봐.' },
    { who: 'jachwi', text: '…어두운 데?' },
    { who: 'moni',   text: '응. 어두운 자리도 쓸모가 있거든.' }
  ],

  /* 시루를 놓은 직후 — 왜 어두운 곳이어야 하는지는 여기서 말하지 않는다.
     수확 때 품질로 직접 겪는 편이 낫다. */
  cropPlaced: [
    { who: 'moni', text: '좋아. 나흘이면 먹을 수 있어.' }
  ],

  /* Day 4 · 수확 직후. 식비 결과를 **본 뒤에** 나온다(계약 순서). */
  harvest: [
    { who: 'jachwi', face: 'happy', text: '…이게 되네.' },
    { who: 'moni',   face: 'happy', text: '어두운 자리라 하얗게 잘 자랐어. 빛을 봤으면 초록이 되고 썼을 거야.' }
  ],

  /* ★식물신 — 대사 한 줄. 외형 없음.
     ★ 2026-08-04 문구를 고쳤다 — **오는 물건이 바뀌었다.** 줄기 하나짜리 어린 포기가
       온다(state.ARRIVAL). "이건 좀 더 어려울 거야"는 이미 자란 포기를 받을 때의 말이라
       화면과 어긋난다. loop.harvestCrop 이 남기는 로그 문장과 **같은 문장**이다 —
       둘이 갈리면 같은 장면에서 신이 두 가지로 말한다. */
  god1: [
    { who: 'god', text: '콩나물을 잘 키웠구나. 작은 걸 하나 줄 테니 키워 봐라.' }
  ],

  /* 몬스테라 도착 — ★정답이 아닌 자리에 온다(first_play.md 확정).
     "옮겨라"라고 대놓고 말하지 않는다. 옮기는 것이 두 번째 학습이라 스스로 해야 한다.
     ★ 2026-08-04 — 오는 물건이 **줄기 하나짜리 어린 포기**로 바뀌었다(state.ARRIVAL = 유효 45일).
       그래서 첫 마디가 "작다"를 먼저 짚는다. 그래야 며칠 뒤 2개째가 올라오는 것이
       플레이어에게 **처음 보는 성장**이 된다. 여기서 "두 개째가 날 거야"라고 미리 말하지 않는다 —
       발견을 뺏는다. */
  monsteraArrived: [
    { who: 'jachwi', face: 'surprise', text: '몬스테라…? 줄기가 하나뿐인데.' },
    { who: 'moni',   face: 'curious',  text: '작은 걸 줬네. 얘는 콩나물이랑 반대야 — 어두운 데 두면 아무 일도 안 일어나.' }
  ],

  /* 창턱으로 옮긴 뒤 */
  monsteraMoved: [
    { who: 'moni', face: 'happy', text: '창턱! 여기가 이 방에서 제일 밝아.' },
    { who: 'moni', text: '바로는 안 변해. 며칠 지나야 알아.' }
  ],

  /* 어두운 자리에 둔 채 며칠 지났을 때 — 빨리감기로 날짜만 가는 그 상황이다.
     ★혼내지 않는다. 무엇을 보면 되는지만 알려 준다.

     ⛔ **2026-08-11 — 이 대사는 지금 아무 데서도 안 불린다.** 저장소 전체를 훑어 확인했다:
       `EVENT_SCRIPT` 에도 `CHATTER` 에도 없고 `game.html` 도 `dlgOpen('monsteraStalled')` 를
       안 한다. `tools/test_dialogue_coverage.mjs` 의 「쓰이지 않는 대사가 없다」 검사는
       이 이름을 **`used` 목록에 손으로 박아 두어** 통과시키고 있다 — START-HERE §2 가
       "제일 위험하다"고 적은 그 모양(고장난 상태를 검사가 정상으로 못 박아 둔 것)이다.
     ★ 하는 일은 2026-08-09 에 들어온 `monsteraGuideWindow`(monstera_no_spear)가 이미 한다.
       지우는 것이 맞아 보이지만 **검사 파일이 이 창 소유가 아니라** 손대지 않았다.
       판단과 붙일 자리는 `docs/handoff/story2-to-plan.md` 에 적었다. */
  monsteraStalled: [
    { who: 'moni', face: 'sad', text: '며칠째 그대로야…' },
    { who: 'moni', text: '빛이 모자라면 날짜만 가고 모양은 안 변해. 더 밝은 자리를 찾아 보자.' }
  ],

  /* ═══ ★★ 유도 두 걸음 — 자리 → 등 (2026-08-09 박사님 확정) ══════════════
     원문: *"몬스테라 책상에 주고 한 10일 정도 지나면 몬이가 새순 안 나는 게 이상하다 하고
            창턱에 두도록 유도하고 등 하나 설치하게 하면 될 듯."*

     ★★ **두 걸음을 따로 가르치는 것이 핵심이다.** 여기서 등 얘기를 미리 꺼내면
       플레이어는 「왜 등이 필요한지」를 못 배우고 그냥 시키는 대로 두 개를 한다.
       자리를 먼저 옮겨 보고 **그래도 안 되는 것을 눈으로 본 뒤에** 등이 나온다.
     ⚠ 지금까지의 원칙은 「정답 자리를 불러 주지 않는다」였다(plantStalled · first_play.md §4).
       박사님이 첫 학습에서만 그 원칙을 푸셨다 — **여기서는 창턱이라고 말한다.**
       plantStalled(그 뒤의 멈춤들)는 그대로 안 불러 준다. 둘을 헷갈리지 말 것. */
  monsteraGuideWindow: [
    { who: 'jachwi', face: 'worry', text: '열흘이 지났는데… 아무 일도 안 일어난다.' },
    { who: 'moni',   face: 'curious', text: '이상하지? 물도 줬고 날짜도 갔는데 새순이 안 나.' },
    { who: 'moni',   text: '얘는 어두운 데선 아예 안 움직여. 날짜만 가는 거야.' },
    { who: 'jachwi', text: '그럼 어디로.' },
    /* ★자리를 불러 주되 **이유를 같이** 준다. 이름만 주면 다음 집에서 못 쓴다. */
    { who: 'moni',   face: 'happy', text: '창턱. 이 방에서 해가 제일 오래 드는 자리야.' },
    { who: 'moni',   text: '옮겨 놓고 며칠 기다려 봐. 바로는 안 변해.' }
  ],
  /* 창턱(또는 다른 데)으로 옮겼는데도 여전히 안 자랄 때.
     ★ **여기서 처음으로 등이 나온다.** 「자리를 다 썼다」가 등의 이유다 —
       그 벽을 먼저 만나야 이만오천 원이 고민할 만한 값이 된다.
     ⚠ 자리가 충분히 밝으면 이 말은 안 나온다. 그게 맞다 — 안 필요한 물건을 권하지 않는다. */
  monsteraGuideLamp: [
    { who: 'jachwi', face: 'worry', text: '옮겼는데도 그대로다.' },
    { who: 'moni',   face: 'sad', text: '자리는 맞아. 근데 이 방은 창턱까지 써도 모자랄 때가 있어.' },
    { who: 'jachwi', text: '더 밝은 데가 없는데.' },
    { who: 'moni',   face: 'curious', text: '없지. 그래서 이제부터는 **자리 말고 빛을 사는** 거야.' },
    { who: 'moni',   text: '식물등 하나. 그 자리 위에 켜 두면 그 자리만 밝아져.' }
  ],

  /* ★첫 플레이의 그 한 장면 — 말린 새순 */
  spearFurled: [
    { who: 'jachwi', face: 'surprise', text: '뭔가… 돌돌 말린 게 올라왔어.' },
    { who: 'moni',   face: 'happy', text: '새순이야! 저게 펴지면 잎이 돼.' },
    { who: 'god',    text: '자리를 옮긴 것뿐인데 말이지.' }
  ],

  /* ═══ §2 배움 넷 — 체크리스트가 하나씩 채워지는 순간 ══════════════════════
     ★짧다. 셋은 한 줄이고 `learnPlantWindow` 만 세 줄이다 — 거기서만 **"창턱이라서가 아니라
       밝아서"** 를 한 번 짚어야 다음 집에서 쓸 수 있는 배움이 된다(2026-08-11 주석 정정:
       예전 주석은 "한 줄씩이다"라고만 적어 데이터와 어긋나 있었다).
     ★이 넷은 다른 사건과 **같은 턴에 겹친다**(수확 날에 둘이 한꺼번에 켜진다).
       길게 쓰면 Day 4 가 대사 열두 줄이 되어 아무도 안 읽는다.
     ★규칙을 다시 읊지 않는다. 방금 겪은 것을 **한 문장으로 접어 주는** 역할만 한다. */
  learnHarvest: [
    { who: 'moni', face: 'happy', text: '그리고 오늘, 밥값을 네가 아니라 얘가 냈어.' }
  ],
  learnCropDark: [
    { who: 'moni', face: 'curious', text: '이거 하나는 이제 아는 거다 — **어두운 자리도 자리야.**' }
  ],
  learnPlantWindow: [
    { who: 'moni', face: 'happy', text: '얘가 지금 받는 빛, 자라기 시작하는 선을 넘었어.' },
    { who: 'jachwi', text: '창턱이라서?' },
    { who: 'moni', text: '창턱이라서가 아니라 **밝아서**. 다음 집에 가면 창턱부터 찾아.' }
  ],
  learnSpear: [
    { who: 'moni', face: 'happy', text: '말린 새순은 밝은 자리에서만 나와. 봤다는 게 곧 배운 거야.' }
  ],

  /* ═══ §3 살림 — 돈이 실제로 압박이 되는 순간 ═══════════════════════════
     ★몬이는 **대신 해 주지 않는다.** 돈 얘기에서 그게 제일 잘 드러난다 —
       세어 주기는 하지만 벌어 주지는 않는다. */

  /* ★★ 2026-08-09 — **유예가 없어졌다.** 그래서 이 둘의 뜻이 통째로 바뀌었다.
     ------------------------------------------------------------
     예전: 첫 달을 봐 주고(유예 30일), 만료 이레 전에 `rentSoon` 이 「봐 주던 게 끝난다」고 알렸다.
     지금: **첫 [다음 날]에 바로 월세가 통째로 빠진다**(tutorial.js §rentFirstDueDay).
       박사님 원문 — *"다음날 누르면 월세 30만원이 쓱 빠지게, 그리고 식대도 빠지게 해서
       돈에 대한 설명을 먼저 하고 가는게 좋겠어. 식비까지 하면 3달도 빠듯하겠다는 식으로."*
     ⇒ 그래서 **`rentFirst` 가 이 게임의 「돈 설명」 자리**가 됐다. 규칙을 읊는 것이 아니라
       한 번 맞아 본 직후에 셈을 같이 해 보는 모양으로 쓴다 — 몬이는 세어 주지만 벌어 주지 않는다.

     ★★ 2026-08-09 — **대사의 숫자를 실측에 맞춰 다시 썼다.** 살림 값이 바뀌었기 때문이다.
       월세 300,000 → **200,000원** · 시작돈 1,300,000 → **1,500,000원**.
       ⇒ `tools/probe_econ.mjs §1` 실측 (반지하 · 하루 지출 16,667원):
             작물 없이            61일 → **90일**  (= 석 달)
             곳간 상한까지 아끼면  80일 → **121일** (= 넉 달)
       예전 대사 「이대로면 두 달 · 밥값을 아끼면 세 달」은 그 시절 61/80일에 맞춘 말이었다.
       값이 움직였으므로 **대사도 같이 움직인다** — 안 그러면 몬이가 틀린 셈을 말한다.
     ⚠ 숫자를 대사에 박지 않으려 했지만 「이십만 원」은 값과 같아야 한다
       (`rentWon` 200,000 · `homes.json banjiha.rent`). 값이 또 바뀌면 이 줄도 같이 고쳐야 한다. */
  /* ★ 2026-08-11 — 네 줄에서 세 줄로 줄이고 **누가 세는지를 되돌렸다.**
     예전 둘째 줄이 몬이의 "한 달이 벌써?" 였는데, 이 대사는 **달마다 다시 나온다**(REPEATABLE).
     세어 주는 것이 일인 몬이가 매달 달력을 처음 보는 사람이 된다 — 2026-08-11 화면 실측에서
     Day 71 · Day 101 에 똑같이 놀랐다.
     넷째 줄 "그럼 지금부터 세자"도 뺐다 — **없는 조작을 가리킨다.** 세는 화면이 없다. */
  rentSoon: [
    { who: 'jachwi', face: 'worry', text: '달력에 동그라미 쳐 둔 날이 또 다가온다.' },
    { who: 'moni',   face: 'curious', text: '이레 남았어. 이십만 원.' },
    { who: 'jachwi', face: 'tired', text: '…알아. 나도 세고 있었어.' }
  ],
  rentFirst: [
    { who: 'jachwi', face: 'tired', text: '이십만 원. 들어오자마자 한 번에 빠져나갔다.' },
    { who: 'moni',   face: 'curious', text: '오늘이 딱 그 날이었구나. 밥값도 나갔고.' },
    { who: 'jachwi', text: '…남은 걸로 넉 달은 될까.' },
    { who: 'moni',   face: 'sad', text: '아니. 이대로면 석 달이야.' },
    { who: 'moni',   text: '밥값을 얘들이 대신 내 주면 그때 넉 달. 그것도 빠듯하고.' },
    { who: 'jachwi', face: 'worry', text: '…석 달 안에 뭘 해야 한다는 소리네.' },
    { who: 'moni',   text: '나는 세는 것만 할게. 뭘 할지는 네가 정해.' }
  ],
  /* 두 번째 달부터. ★반복 대사라 짧다 — 같은 무게를 두 번 주면 첫 달이 가벼워진다. */
  rentAgain: [
    { who: 'jachwi', face: 'tired', text: '월세 날. 이제 놀라지도 않는다.' },
    { who: 'moni',   face: 'curious', text: '안 놀라게 된 것도 는 거야, 그것도.' }
  ],
  brokeTalk: [
    { who: 'jachwi', face: 'worry', text: '지갑에 남은 게 없다.' },
    { who: 'moni',   face: 'sad', text: '…미안. 나는 돈은 못 만들어.' },
    { who: 'jachwi', text: '네가 미안할 게 뭐 있어.' },
    /* ★초보 모드는 죽지 않는다(story_arc.md §0). 그 규칙을 대사가 그대로 말한다 —
       "게임 오버가 없다"고 설명하지 않고, 하루가 그냥 계속된다는 걸로 보여준다. */
    { who: 'moni',   text: '오늘 하루는 그래도 지나가. 내일도 지나가고.' }
  ],

  /* ═══ §4 계절 · 식물등 ════════════════════════════════════════════════ */

  /* 가을 진입(Day 45). ★여기서 "자리를 더 못 올린다"는 벽을 처음 만난다 —
     그래서 바로 다음에 식물등이 열리는 것이 말이 된다.

     ★★ 2026-08-11 — **측정을 주장하던 줄을 예고로 낮췄다.**
     ------------------------------------------------------------
     `story_arc.md §5 ★★` 가 잰 것: **계절이 화면에만 있고 빛에는 안 걸려 있다.**
     튜토는 `novice` 로 돌아 계절계수가 1.0 이라, 화면이 "가을입니다"라고 말하는 날에도
     창턱 DLI 는 여름과 **같은 값 그대로**다. 그런데 예전 셋째 줄은 "창턱이 예전만 못할 거야"
     라고 **일어나지도 않은 변화를 일어난 것처럼** 말했다(2026-08-11 화면 실측 Day 92).
     ⇒ 지금 참인 것(달력·해의 높이)만 말하게 두고, 밝기 주장은 앞날로 미룬다.
     ⚠ 계절이 빛에 걸리는 날(story_arc §5 권고 ㉠) 이 줄은 **현재형으로 되돌려야** 한다.
       그때까지 몬이는 겪지 않은 것을 겪은 것처럼 말하지 않는다. */
  autumnCame: [
    { who: 'jachwi', text: '창으로 드는 빛이… 각도가 달라졌나?' },
    { who: 'moni',   face: 'curious', text: '가을이야. 해가 조금씩 짧아져.' },
    { who: 'moni',   text: '겨울로 갈수록 창 하나로는 모자라져. 자리가 나빠지는 게 아니라 **해가 낮아지는** 거고.' },
    { who: 'jachwi', text: '그럼 더 밝은 데로 옮기면 되나?' },
    { who: 'moni',   face: 'sad', text: '이 방에서 창턱보다 밝은 데는 없어.' },
    { who: 'moni',   text: '여기서부터는 자리 말고 다른 게 필요해.' }
  ],
  /* ★ 셋째 줄은 autumnCame 과 같은 이유로 단정을 뺐다(위 §계절 주석). */
  winterCame: [
    { who: 'jachwi', face: 'tired', text: '유리에 김이 서린다.' },
    { who: 'moni',   face: 'sad', text: '겨울이야. 반지하는 겨울이 길어.' },
    { who: 'moni',   text: '해가 제일 낮은 계절이야. 창턱 하나로 버티기엔 짧고.' },
    { who: 'jachwi', face: 'worry', text: '…아직 못 나갔네.' },
    /* ★실패가 아니라 더딘 것이다. 그 톤을 여기서 못 지키면 경로 C 가 벌처럼 읽힌다. */
    { who: 'moni',   text: '못 나간 게 아니라 아직 안 나간 거야. **늦은 거지 틀린 게 아니고.**' }
  ],
  /* 겨울 열흘째까지 반지하일 때. 위 winterCame 의 톤을 한 번 더 받쳐 준다. */
  winterStill: [
    { who: 'jachwi', face: 'tired', text: '겨울에도 반지하다.' },
    { who: 'moni',   text: '겨울에 이사하는 사람 많지 않아. 다들 봄에 나가.' },
    { who: 'jachwi', text: '위로야?' },
    { who: 'moni',   face: 'curious', text: '사실이야. 위로는 덤이고.' }
  ],

  /* 식물등 해금 — ★필수품이 아니라 **선택**이다(story_arc.md §4).
     그래서 몬이가 "사"라고 하지 않는다. 값과 전기값만 알려 주고 판단은 넘긴다.
     여기만은 숫자를 대사로 준다 — 처음 보는 물건이라 겪을 기회가 아직 없다. */
  lampUnlocked: [
    { who: 'moni',   face: 'curious', text: '가을이 됐으니 하나 알려 줄게. **식물등.**' },
    { who: 'moni',   text: '이만오천 원. 전기는 하루 이십삼 원이고.' },
    /* ★ 등값 25,000원 ÷ 하루 지출 16,667원 = 하루 반. 예전 하루 지출 20,000원 시절에는
       「하루 살고 조금 더」였다 — 값이 내려가 등이 상대적으로 비싸졌으므로 말도 따라간다. */
    { who: 'jachwi', text: '이만오천 원이면… 하루 반은 사는 돈인데.' },
    { who: 'moni',   text: '사도 되고 안 사도 돼. 그 돈을 이사 자금에 보태도 되고.' },
    { who: 'jachwi', face: 'worry', text: '…고민되네.' },
    { who: 'moni',   face: 'happy', text: '고민할 만한 값이라서 알려 준 거야.' }
  ],
  lampBought: [
    { who: 'jachwi', face: 'happy', text: '샀다. 생각보다 작네.' },
    { who: 'moni',   face: 'happy', text: '켜 봐.' },
    { who: 'jachwi', face: 'surprise', text: '어… 방이 좀 밝아진 것 같기도 하고.' },
    /* ★등이 자리를 이기지 못한다 — 이 게임의 뼈대다(story_arc.md §4).
       설명이 아니라 **플레이어가 이미 본 것**으로 짚는다. */
    { who: 'moni',   face: 'curious', text: '방이 아니라 **그 자리**가 밝아진 거야. 등 밑에 있는 것만.' },
    { who: 'moni',   text: '어두운 구석에 두고 켜면 아무 일도 안 일어나. 그건 전에 봤지?' }
  ],
  /* 해금하고 이레가 지나도록 안 샀을 때. ★"왜 안 사냐"가 아니다 — 안 사는 것도 답이다. */
  lampSkipped: [
    { who: 'moni',   face: 'curious', text: '등은 아직 안 샀네.' },
    { who: 'jachwi', text: '이사 자금에 보태려고.' },
    { who: 'moni',   text: '그것도 답이야. 창턱이 버텨 주는 동안은.' }
  ],

  /* ═══ §5 식물 상태 — 왜 멈췄는지 짚어 준다 ═════════════════════════════ */

  /* 며칠째 형태가 안 오를 때. ★혼내지 않고, 정답 자리를 불러 주지도 않는다.
     자리를 고르는 것은 플레이어 몫이다. */
  plantStalled: [
    { who: 'moni',   face: 'sad', text: '며칠째 그대로야.' },
    { who: 'jachwi', text: '물은 줬는데.' },
    { who: 'moni',   text: '물이 아니야. 저 자리에서 못 받는 게 있어.' },
    { who: 'moni',   face: 'curious', text: '지금은 날짜만 가는 중이야. 옮겨 보자.' }
  ],
  plantStalledAgain: [
    { who: 'moni',   face: 'sad', text: '또 멈췄어.' },
    { who: 'jachwi', face: 'worry', text: '…어디로 옮겨야 되지.' },
    { who: 'moni',   text: '제일 오래 잘 자랐던 자리를 떠올려 봐. 손이 먼저 기억할걸.' }
  ],
  /* 겨울에 멈춘 것은 자리 탓만이 아니다. ★"멈춘 것"과 "죽은 것"을 가른다 —
     초보 모드는 잎을 잃지도 죽지도 않는다(story_arc.md §0). */
  plantStalledWinter: [
    { who: 'jachwi', face: 'worry', text: '겨울인데 안 자란다.' },
    { who: 'moni',   text: '겨울엔 원래 더뎌. 멈춘 거랑 죽은 거는 달라.' },
    { who: 'moni',   face: 'curious', text: '얘는 기다리는 중이야. 봄까지 기다려도 되고, 등을 켜 줘도 되고.' }
  ],
  plantResumed: [
    { who: 'moni',   face: 'happy', text: '봐. 다시 오르기 시작했어.' },
    { who: 'jachwi', face: 'happy', text: '자리 하나 옮겼을 뿐인데.' },
    { who: 'moni',   text: '그 "뿐인데"가 제일 어려운 거야.' }
  ],

  /* ★★ 확정 무늬가 난 날 (varie_granted · tutorial.js §확정 무늬).
     반지하 튜토의 **마지막 장면**이고, 이 잎 한 장이 곧 이사 자금이다.

     지킨 것 넷:
     ① **운이 아니다.** "운이 좋았다"가 한 줄이라도 들어가면 플레이어가 한 일이 그 자리에서
        지워진다. 이 잎은 배움 넷을 채우고, 삽수를 한 번 잘라 보고, 가을까지 밝은 자리를
        지킨 판에만 온다(그게 코어의 조건 그대로다). 그래서 몬이는 축하가 아니라 **원인**을 짚는다.
     ② **몬이가 값을 안 읊는다.** 얼마짜리인지는 상점 화면이 숫자로 말한다. 여기서 금액을
        말하면 튜토의 마지막 장면이 정산표가 된다.
     ③ **그 자리에서 돈이 되지 않는다.** 잘라 뿌리내려야(12일) 판다 — 마지막 줄이 그 다음
        동작을 가리킨다. 튜토의 끝이 "삽수 판매"가 되는 것이 설계다.
     ④ 주인공이 **자기 공으로 안 돌린다.** "내가 뭐 한 것도 없는데"를 몬이가 받아 준다 —
        이 사람은 계속 그렇게 말해 온 사람이고, 그 버릇을 여기서 한 번 고쳐 준다. */
  varieGranted: [
    { who: 'jachwi', face: 'surprise', text: '…새로 난 잎에 흰 게 섞였어.' },
    { who: 'moni',   face: 'curious',  text: '무늬야. 흰 데는 빛을 못 만들어서, **밝은 자리에서만** 나와.' },
    { who: 'jachwi', text: '내가 뭐 한 것도 없는데.' },
    { who: 'moni',   face: 'happy', text: '창턱에 올려놨잖아. **그게 한 거야.**' },
    { who: 'moni',   text: '어두운 데 뒀으면 이 잎은 아예 안 났어.' },
    { who: 'jachwi', text: '…그런가.' },
    { who: 'moni',   face: 'curious', text: '이건 값이 달라. 근데 지금 이대로는 아니야.' },
    { who: 'moni',   text: '잘라서 물에 꽂아. 뿌리가 나오면 그때 팔 수 있어.' },
    { who: 'jachwi', face: 'happy', text: '해 봤던 거네, 그건.' }
  ],

  /* ═══ §6 이사 — 조건이 하나씩 차고, 마침내 나간다 ═══════════════════════ */

  /* 배움은 다 됐고 돈이 모자랄 때. */
  /* ★★ 2026-08-11 — **숫자가 틀려 있었다.** 「백오십만 원」은 이사비가 150만이던 시절 값이고,
     2026-08-09 에 `tutorial.MOVE_RULES.moveOutCostWon` 이 **2,000,000** 으로 올랐다
     (보증금 100만 + 첫 달 35만 + 이사비 65만 · START-HERE §6 · story_arc §3).
     같은 날 `rentFirst`·`chatDailySpend` 는 갱신됐는데 이 줄만 안 따라와서, 화면에서
     **몬이가 틀린 셈을 말하고 있었다**(2026-08-11 화면 실측 Day 48 에서 그대로 떴다).
     ⚠ 숫자를 대사에 박은 자리다. `moveOutCostWon` 이 또 움직이면 이 줄도 같이 고쳐야 한다. */
  shortMoney: [
    { who: 'moni',   face: 'curious', text: '배울 건 다 배웠어. 남은 건 돈이야.' },
    { who: 'jachwi', face: 'tired', text: '…제일 안 되는 거네.' },
    { who: 'moni',   text: '이백만 원. 보증금이랑 첫 달 월세랑 이삿짐값.' },
    { who: 'jachwi', text: '한 번에 나가는구나.' },
    { who: 'moni',   text: '한 번만 나가면 돼. 그다음엔 이 방이 아니고.' }
  ],
  /* 돈은 됐는데 배움이 모자랄 때. ★말이 완전히 다르다 —
     이쪽은 "왜 지금 못 나가냐"에 답해야 한다.
     ★ 2026-08-11 — 「나가는 건 되지」를 뺐다. **화면과 어긋나는 말**이었다 —
       `tutorial.canMoveOut` 이 배움 넷을 요구해서 이사 버튼이 실제로 잠겨 있는데
       몬이가 "나가는 건 된다"고 하면, 플레이어는 있지도 않은 버튼을 찾게 된다. */
  shortLearn: [
    { who: 'moni',   face: 'curious', text: '돈은 됐는데, 아직 안 해 본 게 있어.' },
    { who: 'jachwi', face: 'surprise', text: '돈이 됐으면 나가면 되는 거 아니야?' },
    { who: 'moni',   text: '다음 방도 창은 하나야. 여기서 안 배우면 거기서 똑같이 헤매.' },
    { who: 'moni',   face: 'sad', text: '그래서 짐은 아직 안 싸도 돼. 하나 남았어.' }
  ],
  moveReady: [
    { who: 'moni',   face: 'happy', text: '됐다. 둘 다 됐어.' },
    { who: 'jachwi', face: 'surprise', text: '진짜?' },
    { who: 'moni',   text: '언제 나갈지는 네가 정해. 오늘이어도 되고.' }
  ],

  /* ★반지하 구간의 끝이자 감정의 정점.
     지킨 것 넷:
     ① **신파로 안 간다.** 부모 얘기는 한 줄. 그 뒤를 몬이가 농담으로 받는다.
     ② **식물신은 한 줄뿐이다.** 여기가 세 번째이자 이 구간 마지막 등장이라
        규모를 첫 플레이(god1 · spearFurled)와 똑같이 한 줄로 맞춘다.
     ③ **짐이 적다는 것**으로 이 사람이 어떻게 살았는지를 말한다. 설명하지 않는다.
     ④ 마지막 말은 **다음 방의 창**이다. 이 게임이 계속 하는 얘기가 그것이라. */
  movedOut: [
    { who: 'jachwi', text: '짐이 생각보다 적다.' },
    { who: 'jachwi', text: '박스 네 개. 여기서 산 게 백 일이 넘는데.' },
    { who: 'moni',   face: 'curious', text: '화분은 내가 안고 갈까?' },
    { who: 'jachwi', face: 'happy', text: '네가 어떻게 안아.' },
    { who: 'moni',   face: 'happy', text: '못 안지. 그냥 말해 본 거야.' },
    { who: 'jachwi', face: 'cry', text: '…엄마 아빠한테 자랑할 게 생겼는데.' },
    { who: 'moni',   face: 'sad', text: '…' },
    { who: 'moni',   text: '들었을 거야. 여기 빛은 잘 안 들어와도, 소리는 잘 들리는 방이었잖아.' },
    { who: 'jachwi', face: 'happy', text: '그게 뭐야.' },
    { who: 'jachwi', text: '불 끄고 가자. 어차피 잘 안 들어오던 불.' },
    { who: 'god',    text: '어두운 방에서도 자라는 것이 있었구나.' },
    { who: 'moni',   face: 'happy', text: '가자. 다음 방은 창이 높대.' }
  ],

  /* ★★ 2026-08-11 추가 — **③ 원룸의 첫 장면. 여기가 통째로 비어 있었다.**
     ------------------------------------------------------------
     `oneroom.moveIntoOneroom` 이 `moved_in_oneroom` 을 내고 game.html 이 그것을
     `story.events(r.events)` 로 넘기는데 대사가 없어서 **조용히 지나갔다**
     (`oneroom.js` 가 스스로 "⚠ 대사는 아직 없다"고 적어 둔 자리다).
     2026-08-11 화면 실측: Day 125 에 이사가 끝나고 "가자. 다음 방은 창이 높대."를
     마지막으로 **아무 말도 없이 새 방이 떴다.** 반지하의 마지막 대사가 다음 방을 가리키는데
     그 방에 도착해서는 아무도 아무 말을 안 하는 상태였다.

     쓰면서 지킨 것 넷:
     ① **짧다.** `moved_out`(13줄)과 **같은 턴에 이어서 나온다** — 둘이 한 번에 열리므로
        여기를 길게 쓰면 이사 장면이 스무 줄 넘는 덩어리가 된다. 여덟 줄로 끊는다.
     ② **미화하지 않는다.** 원룸은 좋기만 한 방이 아니다. 재서 나온 사실 둘을 그대로 쓴다 —
        슬롯이 **14칸 → 11칸으로 줄고**(story_arc §③), 월세가 **20만 → 35만으로 오른다**
        (`homes.json`). 이사는 상이면서 동시에 부담이라는 것이 §3 의 확정이다.
     ③ **그래도 하나는 진짜로 늘었다.** 원룸은 등 없이 `min 3.0` 을 넘는 자리가 **처음 생기는
        집**이다(반지하 avg7 2.42 → 원룸 3.07 · story_arc §③ 권고2). 밝기를 자랑하지 않고
        「한 칸 생겼다」로만 말한다 — 실제로 한 칸이다.
     ④ **③단계의 규칙 전환을 여기서 알린다**(story_arc §4-1) — 확정 무늬가 끝나고
        무늬는 빛으로만 난다. 새 규칙을 배우는 게 아니라 **이미 한 걸 반복하는 것**이라
        마지막 줄을 주인공이 받는다.
     ⚠ 숫자는 「서른다섯」 하나만 박았다. 남은 돈·칸수는 화면이 숫자로 말한다. */
  movedInOneroom: [
    { who: 'jachwi', face: 'surprise', text: '…창이 눈높이에 있네.' },
    { who: 'moni',   face: 'happy',   text: '높지. 지나가는 사람 발만 보이지는 않아.' },
    { who: 'jachwi', text: '박스를 푸니까 금방 찬다. 놓을 데는 저기가 더 많았나.' },
    { who: 'moni',   face: 'curious', text: '줄었어. 대신 하나 늘었고 — 등 없이 자라는 자리.' },
    { who: 'moni',   text: '저 방엔 한 칸도 없었어. 여긴 한 칸 있어.' },
    { who: 'jachwi', face: 'tired',   text: '…월세는 서른다섯이 됐고.' },
    { who: 'moni',   face: 'sad',     text: '응. 그건 오른 거 맞아.' },
    { who: 'moni',   face: 'curious', text: '그리고 여기서부터 무늬는 아무도 안 줘. 어디에 두느냐로만 나와.' },
    { who: 'jachwi', text: '…자리로 만드는 건 해 봤어.' }
  ],

  /* ═══ §7 작은 말들 ═════════════════════════════════════════════════════
     ★매일 같은 말이면 안 읽는다. 조건으로 갈리고(계절·날씨·돈·식물 상태),
       고를 때는 **가장 오래 안 나온 것**부터 나온다(pickChatter).
     ★사건이 있는 날에는 안 나온다. 조용한 날이 이틀 이어진 다음에만 나온다 —
       매일 떠들면 사건의 무게가 같이 내려간다. */

  /* 첫 플레이 · 콩나물이 자라는 사흘 */
  chatCrop1: [
    { who: 'jachwi', text: '콩나물이 진짜 자랄까.' },
    { who: 'moni',   face: 'curious', text: '어두운 데 뒀으면 자라.' }
  ],
  chatCrop2: [
    { who: 'jachwi', face: 'surprise', text: '뭔가 하얀 게 올라왔어.' },
    { who: 'moni',   face: 'happy', text: '봐. 빛 없이도 자라는 게 있어.' },
    { who: 'jachwi', text: '내일이면 먹는 건가.' },
    { who: 'moni',   text: '내일 아침에 열어 봐.' }
  ],
  /* ★★ 2026-08-11 추가 — **회전이 도는 구간의 같은 자리**를 채운다.
     위 둘(chatCrop1·chatCrop2)은 「처음 보는 사람」의 말이라 첫 플레이 전용이다. 그런데 조건이
     `!cropHarvested` 뿐이라 **다시 심을 때마다 되살아났다** — 2026-08-11 화면 실측에서
     "콩나물이 진짜 자랄까"가 **Day 36 · Day 84** 에 다시 떴다. 열 번째 시루를 앞에 두고
     처음 보는 사람처럼 말한 것이다. 그래서 위 둘에 `!firstPlayDone` 을 걸고, 비는 자리를
     여기가 받는다. **같은 사실을 다른 사람이 말한다** — 그 사이에 겪은 것이 그 차이다. */
  chatCropAgain: [
    { who: 'jachwi', text: '오늘도 하얀 게 올라와 있다.' },
    { who: 'moni',   face: 'curious', text: '이제 안 놀라네.' },
    { who: 'jachwi', text: '놀랄 일은 아니지. 좋은 일이지.' }
  ],

  /* 여름 · 반지하 살림 */
  chatSummerHeat: [
    { who: 'jachwi', face: 'tired', text: '반지하는 여름에 덥고 겨울에 춥다.' },
    { who: 'moni',   face: 'curious', text: '둘 다인 건 좀 심하지 않아?' },
    { who: 'jachwi', text: '심하지.' }
  ],
  chatSummerDamp: [
    { who: 'jachwi', text: '벽에서 눅눅한 냄새가 난다.' },
    { who: 'moni',   text: '창 좀 열어. 나 말고 너한테 하는 말이야.' }
  ],
  /* ★ 2026-08-09 — 하루 지출이 20,000 → **16,667원**으로 내려갔다(월세 20만). 대사도 따라간다.
     「만 육천 원 남짓」으로 적은 이유 — 16,667 은 유도된 값이라 딱 떨어지지 않는다.
     정확한 숫자를 대사가 읊으면 값이 조금만 움직여도 곧바로 거짓말이 된다. */
  chatDailySpend: [
    { who: 'jachwi', text: '오늘도 만 육천 원 남짓.' },
    { who: 'moni',   face: 'curious', text: '하루가 만 육천 원이야. 그렇게 세니까 좀 무섭다.' },
    { who: 'jachwi', face: 'tired', text: '세지 말걸.' }
  ],
  chatMorning: [
    { who: 'jachwi', text: '아침에 일어나서 제일 먼저 보는 게 화분이 됐다.' },
    { who: 'moni',   face: 'happy', text: '나는?' },
    { who: 'jachwi', text: '너는 안 봐도 있잖아.' }
  ],
  chatQuiet: [
    { who: 'jachwi', text: '이 방은 조용하다.' },
    { who: 'moni',   face: 'curious', text: '조용한 거 싫어?' },
    { who: 'jachwi', text: '전엔 싫었어.' }
  ],
  chatMoniName: [
    { who: 'jachwi', text: '몬이는 왜 몬이야?' },
    { who: 'moni',   face: 'happy', text: '몬스테라니까.' },
    { who: 'jachwi', text: '성의 없다.' },
    { who: 'moni',   text: '성의 있는 이름은 네가 지어 줘.' }
  ],
  /* ★부모 얘기를 여기서 한 번 더 한다 — 다만 **웃으면서** 한다.
     오프닝의 울음과 이사 장면의 한 줄 사이를 이 톤이 이어 준다. */
  chatParents: [
    { who: 'jachwi', text: '엄마가 화분을 잘 죽였어.' },
    { who: 'jachwi', face: 'happy', text: '물을 너무 많이 줘서.' },
    { who: 'moni',   face: 'curious', text: '너는 안 죽이잖아.' },
    { who: 'jachwi', text: '…아직은.' }
  ],
  chatLandlord: [
    { who: 'jachwi', text: '집주인 아저씨가 복도에서 인사했다.' },
    { who: 'moni',   face: 'curious', text: '뭐래?' },
    { who: 'jachwi', text: '"학생, 아직 있었네."' },
    { who: 'moni',   text: '…없었으면 좋겠다는 뜻인가?' },
    { who: 'jachwi', face: 'tired', text: '나도 그 생각 했어.' }
  ],
  chatNeighbor: [
    { who: 'jachwi', text: '윗집에서 물 내리는 소리가 다 들린다.' },
    { who: 'moni',   face: 'curious', text: '그 소리 무서워?' },
    { who: 'jachwi', text: '아니. 누가 있다는 소리라서 좀 낫다.' }
  ],

  /* 가을 */
  chatAutumnShort: [
    { who: 'jachwi', text: '여섯 시인데 벌써 어둡다.' },
    { who: 'moni',   face: 'sad', text: '가을은 그래.' }
  ],
  chatAutumnDust: [
    { who: 'jachwi', text: '잎에 먼지가 앉았다.' },
    { who: 'moni',   face: 'curious', text: '닦아 줘. 먼지도 빛을 가려.' },
    { who: 'jachwi', face: 'surprise', text: '그것도 빛 얘기야?' },
    { who: 'moni',   face: 'happy', text: '나는 원래 빛 얘기밖에 안 해.' }
  ],
  chatAutumnAngle: [
    { who: 'jachwi', text: '해가 드는 자리가 조금씩 안쪽으로 옮겨 온다.' },
    { who: 'moni',   face: 'curious', text: '깊이 들어오지? 대신 약해. 그게 가을 겨울이야.' }
  ],

  /* 겨울 */
  chatWinterCold: [
    { who: 'jachwi', face: 'tired', text: '입김이 난다. 안에서.' },
    { who: 'moni',   face: 'sad', text: '…' },
    { who: 'jachwi', text: '괜찮아. 이불 두 개 있어.' }
  ],
  chatWinterSlow: [
    { who: 'jachwi', text: '얘가 요즘 느리다.' },
    { who: 'moni',   text: '느린 거야. 나쁜 거 아니고.' }
  ],
  chatWinterWindow: [
    { who: 'jachwi', text: '창이 뿌옇다.' },
    { who: 'moni',   face: 'curious', text: '닦으면 조금 밝아져. 진짜야.' }
  ],

  /* 돈이 얼마 안 남았을 때 */
  chatLowCash1: [
    { who: 'jachwi', face: 'worry', text: '통장을 세 번 봤다. 세 번 다 같았다.' },
    { who: 'moni',   face: 'curious', text: '세 번 볼 시간에 자.' }
  ],
  chatLowCash2: [
    { who: 'jachwi', face: 'tired', text: '오늘은 라면.' },
    { who: 'moni',   text: '내일은?' },
    { who: 'jachwi', text: '…라면.' }
  ],

  /* 식물이 잘 자라고 있을 때 */
  chatGrowing1: [
    { who: 'jachwi', face: 'happy', text: '어제보다 큰 것 같은데.' },
    { who: 'moni',   face: 'happy', text: '기분 탓이야. 근데 기분 탓이 맞을 때도 있어.' }
  ],
  chatGrowing2: [
    { who: 'jachwi', text: '잎이 하나 더 생겼다.' },
    { who: 'moni',   face: 'curious', text: '세어 봤어?' },
    { who: 'jachwi', text: '매일 세.' }
  ],

  /* 날씨 — ★초보(novice)는 맑음 고정이라 안 뜬다. 실전 모드에서 쓰인다. */
  chatRain: [
    { who: 'jachwi', text: '비 오는 날은 창이 더 어둡다.' },
    { who: 'moni',   face: 'curious', text: '오늘은 얘도 쉬는 날이야.' }
  ],
  chatCloudy: [
    { who: 'jachwi', text: '흐린 날.' },
    { who: 'moni',   text: '흐려도 빛은 들어와. 맑은 날의 사분의 일쯤.' }
  ]
};

/* ★어느 대사가 **다시 나올 수 있나.** 작은 말들과, **실제로 다시 일어나는 사건**만이다.
   나머지 사건 대사는 한 번뿐이다 — 두 번째 들으면 안내가 잔소리가 되고 사건도 가벼워진다.
     rentAgain            월세는 달마다 다시 온다
     rentSoon             ★2026-08-09 추가 — 유예가 없어지면서 **예고도 달마다** 온다.
                          예전에는 첫 달 유예가 끝나기 전 딱 한 번이라 한 번뿐인 대사였다.
                          지금은 청구 이레 전마다 뜨므로(tutorial.js §rent_soon) 다시 나와야 한다.
     plantStalledAgain    멈춤은 다시 일어난다. 열흘마다 짚는다(loop.STALL_REPEAT_DAYS) —
     plantStalledWinter   한 번 말하고 마는 쪽을 골랐다가, 어두운 자리에 방치한 판이
                          190일 통째로 조용해졌다(2026-08-03 진단). */
export const REPEATABLE = new Set(
  Object.keys(SCRIPTS).filter(k => k.startsWith('chat'))
    .concat(['rentSoon', 'rentAgain', 'plantStalledAgain', 'plantStalledWinter'])
);

/* ── 진행 ───────────────────────────────────────────────────────────── */

/* 한 번만 보여줄 대사는 본 것을 기억한다. 같은 말을 두 번 들으면 안내가 잔소리가 된다. */
export function createDialogue(seen = new Set()) {
  let queue = [], idx = 0;
  /* ★본 것(seen)과 **나온 차례**(history)는 다른 값이다. Set 은 순서를 안 지켜서
     "가장 오래 안 나온 말"을 고를 수가 없다 — 작은 말 고르기(pickChatter)가 그 순서를 본다. */
  const history = [];

  function push(scriptId, { once = true } = {}) {
    const lines = SCRIPTS[scriptId];
    if (!lines) throw new Error(`[대화] 없는 스크립트: ${scriptId}`);
    if (once && !REPEATABLE.has(scriptId) && seen.has(scriptId)) return false;
    seen.add(scriptId);
    history.push(scriptId);
    queue = queue.concat(lines.map(l => ({ ...l, scriptId })));
    return true;
  }
  function current() { return idx < queue.length ? queue[idx] : null; }
  function next() { if (idx < queue.length) idx++; return current(); }
  /* 건너뛰기 — 두 번째부터는 읽은 사람도 있다. 막지 않는다. */
  function skip() { idx = queue.length; return null; }
  function isOpen() { return idx < queue.length; }
  function clear() { queue = []; idx = 0; }
  function seenList() { return [...seen]; }
  function recentList() { return [...history]; }

  return { push, current, next, skip, isOpen, clear, seenList, recentList,
           get length() { return queue.length; },
           get index() { return idx; } };
}

/* ── 이벤트 → 대사 ──────────────────────────────────────────────────────
   ★새 이벤트 체계를 만들지 않는다 — loop.js 가 `turn.events` 로 내는 id 를 그대로 읽는다.
     (첫 플레이 신호는 first_play.firstPlayEventsOf, 살림 신호는 tutorial.tutorialDay,
      식물·배움·이사 신호는 loop.stepTutorial 이 낸다.) */
export const EVENT_SCRIPT = Object.freeze({
  beansprout_harvest:  'harvest',
  monstera_arrived:    'monsteraArrived',
  /* ★ 유도 두 걸음 (2026-08-09) — first_play.firstPlayEventsOf 가 낸다 */
  monstera_no_spear:   'monsteraGuideWindow',
  monstera_needs_lamp: 'monsteraGuideLamp',
  spear_furled:        'spearFurled',

  learn_harvest:       'learnHarvest',
  learn_cropDark:      'learnCropDark',
  learn_plantWindow:   'learnPlantWindow',
  learn_spear:         'learnSpear',

  rent_soon:           'rentSoon',
  broke:               'brokeTalk',

  lamp_unlocked:       'lampUnlocked',
  lamp_bought:         'lampBought',
  lamp_skipped:        'lampSkipped',

  plant_stalled:       'plantStalled',
  plant_stalled_again: 'plantStalledAgain',
  plant_stalled_winter:'plantStalledWinter',
  plant_resumed:       'plantResumed',

  winter_still:        'winterStill',
  varie_granted:       'varieGranted',
  move_short_money:    'shortMoney',
  move_short_learn:    'shortLearn',
  move_ready:          'moveReady',
  moved_out:           'movedOut',
  /* ★ 2026-08-11 — ③ 원룸의 첫 장면. `oneroom.moveIntoOneroom` 이 `moved_out` **다음에**
     내는 사건이고, game.html 의 이사 버튼이 둘을 한 번에 `story.events` 로 넘긴다. */
  moved_in_oneroom:    'movedInOneroom'
});

/* ★한 턴에 여러 사건이 겹칠 때의 **순서가 계약이다.**
   Day 4 는 수확·식비·배움 둘·식물신·도착이 한꺼번에 난다. 순서가 흔들리면
   "식물신이 도착 뒤에 말하는" 회차가 생긴다(first_play.md §2 가 금지한 것).
   여기 없는 id 는 대사가 없는 사건이다 — food_cash 처럼 화면이 숫자로 말하는 것들.

   ★★ 2026-08-11 — **`beansprout_harvest_again` 에 일부러 대사를 안 붙였다.** 적어 둔다:
     회전이 5일이라 반지하 한 판(실측 게임 125일)에 **스무 번 넘게** 난다. 사건 대사를 붙이면
     같은 말이 스무 번 나오고, 그렇다고 `REPEATABLE` 에서 빼면 두 번째부터는 storyteller 가
     id 를 돌려주는데 대화 상자가 막아 **검사에는 "말한 날"로 잡히고 화면은 조용한** 상태가 된다
     (START-HERE §2 가 경고한 그 모양이다). 그래서 그 자리는 작은 말(`chatCropAgain`)로 채웠다 —
     작은 말은 조용한 날에만 나오므로 반복이 리듬이 된다.
   ⚠ 아직 대사가 없고 **화면에도 안 붙은** 사건: `ending_ready` · `ending_home`(④ 내 집 마련).
     `game.html` 이 `src/game/ending.js` 를 아예 안 읽는다(2026-08-11 확인). 목표 금액도
     `ENDING_RULES.targetWon = null` 로 미확정이라(story_arc §4-2 ⏸) 여기서 대사를 지어 두면
     안 뜨는 대사가 하나 더 늘 뿐이다. 화면과 금액이 정해질 때 같이 쓴다. */
const EVENT_ORDER = [
  'beansprout_harvest', 'learn_harvest', 'learn_cropDark',
  'monstera_arrived',
  'spear_furled', 'learn_spear', 'learn_plantWindow',
  /* ★ 유도 두 걸음은 **일반 멈춤 대사보다 앞**이다 (2026-08-09).
     같은 날 `plant_stalled`("옮겨 보자")와 겹칠 수 있는데, 첫 학습에서는 자리를 불러 주는
     쪽이 먼저 와야 한다. 뒤에 오면 "옮겨 보자" 다음에 "창턱으로" 가 붙어 두 번 말하는 꼴이 된다.
     ⚠ 등 안내는 자리 안내보다 **뒤**다 — 두 걸음의 순서가 곧 이 학습의 내용이다. */
  'monstera_no_spear', 'monstera_needs_lamp',
  'plant_resumed', 'plant_stalled', 'plant_stalled_again', 'plant_stalled_winter',
  'season_autumn', 'season_winter', 'winter_still',
  'lamp_unlocked', 'lamp_bought', 'lamp_skipped',
  'rent_soon', 'rent_first', 'rent_again', 'broke',
  /* ★확정 무늬는 살림(월세·파산) **뒤**, 이사 판정 **앞**이다.
     월세 날에 겹치면 "삼십만 원이 나갔다" 다음에 이 잎이 오는 것이 맞고,
     이사 판정보다 앞이라야 "그래서 나갈 수 있게 됐다"가 그 뒤에 온다. */
  'varie_granted',
  /* ★ `moved_in_oneroom` 은 반드시 `moved_out` **뒤**다 — 나가는 장면과 도착 장면이
     같은 턴에 한 번에 열린다. 순서가 뒤집히면 도착해서 인사하고 나서 짐을 싼다. */
  'move_short_learn', 'move_short_money', 'move_ready', 'moved_out', 'moved_in_oneroom'
];

/* 이벤트 하나 → 대사 id. 계절·월세처럼 **같은 id 안에서 갈리는** 것만 여기서 본다. */
function scriptOf(ev) {
  const id = typeof ev === 'string' ? ev : (ev && ev.id);
  if (!id) return null;
  if (id === 'season') return ev.season === 'autumn' ? 'autumnCame'
                            : ev.season === 'winter' ? 'winterCame' : null;
  if (id === 'rent') return ev.first ? 'rentFirst' : 'rentAgain';
  return EVENT_SCRIPT[id] || null;
}
/* 정렬용 열쇠 — season·rent 는 갈린 뒤의 이름으로 줄을 선다. */
function orderKey(ev) {
  const id = typeof ev === 'string' ? ev : (ev && ev.id);
  if (id === 'season') return 'season_' + (ev.season || '');
  if (id === 'rent') return ev.first ? 'rent_first' : 'rent_again';
  return id;
}

/* 턴 결과 → 이번에 나올 대사. events 는 loop.js 의 `turn.events` 그대로다.
   ★Day 4 계약 순서(수확 → 식비 → 식물신 → 도착)는 EVENT_ORDER 가 지킨다. */
export function scriptsForEvents(events = []) {
  const list = (events || []).filter(Boolean);
  const rank = ev => { const i = EVENT_ORDER.indexOf(orderKey(ev)); return i < 0 ? 999 : i; };
  const out = [];
  for (const ev of [...list].sort((a, b) => rank(a) - rank(b))) {
    const s = scriptOf(ev);
    if (s && !out.includes(s)) out.push(s);
  }
  /* ★★ 식물신은 **주는 순간 바로 앞**에 붙는다 (2026-08-04 고침).
     예전에는 `harvest`(첫 수확) 뒤였다 — 그때가 곧 도착이었기 때문이다. 이제 도착이
     3회전째로 밀려서(first_play.monsteraArrivalDue) 옛 자리에 두면 신이 "줄 테니" 하고
     **며칠 뒤에** 물건이 온다. 주는 말과 오는 물건은 붙어 있어야 한다.
     ⚠ 도착보다 **앞**이라야 한다 — first_play.md §2 가 금지한 것이 "식물신이 도착 뒤에 말하는" 회차다. */
  const arr = out.indexOf('monsteraArrived');
  if (arr >= 0 && !out.includes('god1')) out.splice(arr, 0, 'god1');
  return out;
}

/* ── 작은 말 고르기 ────────────────────────────────────────────────────
   ★조건은 **겪은 것**으로 쓴다. "지금 가을이다"가 아니라 "가을이라 해가 짧다"를
     말할 수 있는 상황인가로 고른다. 조건이 겹치면 가장 오래 안 나온 것이 나온다. */
export const CHATTER = [
  /* 첫 플레이 — 수확 전 사흘. ★날짜를 딱 집어 걸지 않는다(`===` 로 걸었더니
     조용한 날 세기와 어긋나 셋 다 못 나오는 날이 있었다). 둘 중 안 나온 쪽이 먼저 나온다. */
  /* ★ 2026-08-11 — `!firstPlayDone` 을 걸었다. 이 둘은 **처음 보는 사람의 말**인데
     조건이 `!cropHarvested` 뿐이라 다시 심을 때마다 되살아났다(§chatCropAgain 주석의 실측). */
  { id: 'chatCrop1', when: c => !c.firstPlayDone && !c.cropHarvested && c.cropAgeDays >= 1 },
  { id: 'chatCrop2', when: c => !c.firstPlayDone && !c.cropHarvested && c.cropAgeDays >= 2 },
  /* 첫 플레이가 끝난 뒤의 같은 자리 — 회전이 도는 동안 */
  { id: 'chatCropAgain', when: c => c.firstPlayDone && !c.cropHarvested && c.cropAgeDays >= 2 },

  /* 날씨 — 그날 하늘이 실제로 그래야 한다 */
  { id: 'chatRain',   when: c => c.weather === 'rain' },
  { id: 'chatCloudy', when: c => c.weather === 'cloudy' },

  /* 식물 상태 */
  { id: 'chatGrowing1', when: c => c.grew === true },
  { id: 'chatGrowing2', when: c => c.grew === true },
  { id: 'chatWinterSlow', when: c => c.season === 'winter' && c.blocked },

  /* 돈 — ★ 2026-08-11 주석 정정. 예전 주석은 "한 달 치(60만)"라고 적었는데 코드는 30만이고,
     60만은 하루 지출이 20,000원이던 시절의 한 달이다. 지금 하루 지출은 16,667원(월 50만)이라
     30만은 **열여드레치**다. 값을 안 바꾸고 주석만 사실로 맞췄다 — 열여드레는
     "슬슬 티가 나는" 자리로 알맞다(월세가 한 번 더 오면 못 낸다). */
  { id: 'chatLowCash1', when: c => c.cashWon != null && c.cashWon < 300_000 },
  { id: 'chatLowCash2', when: c => c.cashWon != null && c.cashWon < 300_000 },

  /* 계절 */
  { id: 'chatAutumnShort', when: c => c.season === 'autumn' },
  { id: 'chatAutumnDust',  when: c => c.season === 'autumn' },
  { id: 'chatAutumnAngle', when: c => c.season === 'autumn' },
  { id: 'chatWinterCold',   when: c => c.season === 'winter' },
  { id: 'chatWinterWindow', when: c => c.season === 'winter' },

  /* 살림 — 계절을 안 가린다. 아무것도 안 걸릴 때 여기서 나온다. */
  { id: 'chatSummerHeat', when: c => c.season === 'summer' },
  { id: 'chatSummerDamp', when: c => c.season === 'summer' },
  { id: 'chatDailySpend', when: c => c.living },
  { id: 'chatMorning',    when: c => c.living },
  { id: 'chatQuiet',      when: c => c.living },
  { id: 'chatMoniName',   when: c => c.living },
  { id: 'chatParents',    when: c => c.living },
  { id: 'chatLandlord',   when: c => c.living },
  { id: 'chatNeighbor',   when: c => c.living },
  /* ★맨 끝 그물 — 첫 플레이가 길어져 위가 전부 안 걸리는 날을 위해 둔다.
     이게 없으면 어두운 자리에 방치한 판이 며칠이고 통째로 조용해진다(진단에서 46일). */
  { id: 'chatQuiet',      when: () => true },
  { id: 'chatMoniName',   when: () => true },
  { id: 'chatMorning',    when: () => true }
];

/* 조건에 맞는 것 중 **가장 오래 안 나온 것**. recent 는 나온 차례(오래된 것부터)다.
   ★순수하다 — 난수를 안 쓴다. 재현이 매번 같은 결과를 봐야 검증이 된다. */
export function pickChatter(ctx = {}, recent = []) {
  const pool = [];
  for (const c of CHATTER) {
    let ok = false;
    try { ok = !!c.when(ctx); } catch { ok = false; }
    if (ok && !pool.includes(c.id)) pool.push(c.id);
  }
  if (!pool.length) return null;
  const rank = id => recent.lastIndexOf(id);      // 안 나온 적 있으면 -1 → 제일 앞
  let best = pool[0];
  for (const id of pool) if (rank(id) < rank(best)) best = id;
  return best;
}

/* 턴 → 작은 말 고르기에 쓸 상황. ★turn 과 S 의 **읽기만** 한다. */
export function chatterContext(turn = {}, S = null) {
  const ts = (S && S.tutorial) || null;
  const fp = (S && S.firstPlay) || null;
  const t = turn.tutorial && !turn.tutorial.skipped ? turn.tutorial : null;
  return {
    day: turn.day ?? null,
    weather: (turn.sky && turn.sky.weather) || null,
    season: t ? t.season : (turn.sky && turn.sky.season) || null,
    seasonDay: t ? t.seasonDay : null,
    cashWon: t ? t.cashWon : (ts ? ts.cashWon : null),
    living: !!t,                                     // 살림이 도는 중(첫 플레이 뒤)
    firstPlayDone: !!(fp && fp.completed),
    cropAgeDays: fp && fp.beansprout ? fp.beansprout.ageDays : null,
    cropHarvested: !!(fp && fp.beansprout && fp.beansprout.harvested),
    grew: turn.grew ?? null,
    blocked: turn.growthBlocked || null,
    lampOwned: ts ? ts.lamp.owned : 0,
    movedOut: !!(ts && ts.movedOut)
  };
}

/* ── 한 턴을 통째로 ─────────────────────────────────────────────────────
   ★게임 화면이 쓰는 **유일한 창구**다. 사건이 있으면 사건 대사를, 없으면
     조용한 날을 세다가 작은 말을 낸다.

   왜 상태를 여기서 드나 — "며칠 조용했나"와 "무엇이 최근에 나왔나"는 대화의 리듬이지
   게임 상태가 아니다. 세이브에 안 남고(다시 켜면 처음부터 센다) 코어도 몰라도 된다. */
export const QUIET_DAYS_BEFORE_CHATTER = 2;

export function createStoryteller(opt = {}) {
  /* ★나온 차례를 **여기서 센다.** 예전엔 대화 상자(dlg.recentList)를 보게 해 뒀는데,
     호출부가 낸 id 를 상자에 넣어 주지 않으면 이력이 영영 비어서 작은 말이
     늘 같은 것만 나왔다(재현에서 chatGrowing1 이 연달아 두 번 나왔다).
     세는 쪽과 고르는 쪽이 갈리면 반드시 어긋난다 — 한 곳에서 센다. */
  const history = opt.recent ? [...opt.recent] : [];
  const quietMax = Number.isFinite(opt.quietDays) ? opt.quietDays : QUIET_DAYS_BEFORE_CHATTER;
  let quiet = 0;

  /* 한 턴 → 이번에 띄울 대사 id 목록(순서 그대로). 빈 배열이면 조용한 날이다. */
  function turn(turnObj, S = null) {
    const ids = scriptsForEvents((turnObj && turnObj.events) || []);
    if (ids.length) { quiet = 0; history.push(...ids); return ids; }
    quiet++;
    if (quiet <= quietMax) return [];
    const id = pickChatter(chatterContext(turnObj || {}, S), history);
    if (!id) return [];
    quiet = 0; history.push(id);
    return [id];
  }
  /* 턴 밖에서 나는 일(식물등 구입·이사 버튼) — 그쪽이 낸 events 를 그대로 준다.
     buyLamp()·moveOut() 의 반환값에 `events` 가 실려 온다. */
  function events(list) {
    const ids = scriptsForEvents(list || []);
    if (ids.length) { quiet = 0; history.push(...ids); }
    return ids;
  }
  return { turn, events, get quietDays() { return quiet; }, recent: () => [...history] };
}
