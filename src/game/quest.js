/* ══════════════════════════════════════════════════════════════════════════
   퀘스트 — **「지금 뭘 하지?」에 답하는 다섯 줄** (2026-08-17 신설)

   ★★ 왜 생겼나 — 재서 나온 것 하나
     ------------------------------------------------------------
     반지하 한 판을 실제로 굴려 **날마다 무슨 말이 나오는지 전부 받아 적었다**
     (`docs/handoff/quest2-to-plan.md §실측`). 나온 결론이 예상과 달랐다:

       **말은 이틀에 한 번 꼬박꼬박 나온다. 조용한 구간이 없다(최장 2일).**
       **그런데 「지금 뭘 해라」를 말하는 줄은 첫 33일에 몰려 있고 그 뒤로 0 이다.**

     Day 33 부터 Day 77 까지 **44일 동안** 나온 말이 전부 작은 말이었다 —
     「반지하는 여름에 덥고」·「집주인 아저씨가」·「몬이는 왜 몬이야?」.
     ⇒ 「조용해서」가 아니라 **「할 말은 있는데 시킬 일이 없어서」** 목적성이 없었다.
     ⇒ 그래서 이 계통은 **대사를 늘리는 것이 아니라 「할 일」을 늘린다.**

   ★★★ 퀘스트는 **「할 일」이지 「보상」이 아니다.**
     옛 `siru5_cycle5` 는 다 하고 나서야 배너로 알려 주는 **보상 갈고리**였다.
     여기서는 **열리는 순간에 말을 걸고**, 여는 동안 아래 한 줄이 그 일을 말한다.

   ── 왜 다섯인가 (재서 정했다 · 되묻지 말 것) ─────────────────────────────
     ① **가르쳐야 하는데 아무 데서도 안 가르치는 것이 여덟**이었다(2026-08-17 확정문 셋).
        그 여덟을 겹치지 않게 묶으니 **정확히 다섯 덩이**가 된다(아래 표 §가르치는 것).
     ② 빈 구간이 실측으로 **Day 33~77(44일)** 과 **Day 93~끝(107일)** 둘이다.
        다섯이면 평균 **30일에 하나** — 월세 주기와 같은 박자라 새 눈금을 안 만든다.
     ③ **첫 33일에는 안 넣는다.** 거기는 이미 꽉 차 있다(첫 플레이 대사·안내·말풍선).
        넣으면 심부름 목록이 된다.
     ⇒ 넷이면 44일을 못 메우고, 여섯이면 첫 플레이 구간을 침범한다.

   ── 보상 — **있는 것만 쓴다** ────────────────────────────────────────
     새 보상 계통을 안 만들었다. 쓰는 것은 둘뿐이다:
       ㉠ **최대체력 +1** — `stamina.grantStaminaQuest` 가 이미 하던 일.
          값은 `data/balance/stamina.json` 의 `quests` 표가 갖는다(코드에 안 박는다).
       ㉡ ★ **세상이 이미 주는 것** — `varie_bright` 는 무늬 등급이 오르고
          (산반 35만 → 풀문 115만), `sell_varie` 는 **이사가 열린다.**
          이 둘에 체력을 또 얹으면 진짜 보상이 가려진다. 그래서 **0 이다.**
     ⇒ 체력을 주는 것은 셋(5 → 8). 자연 레벨업으로 5→8 은 45회(≈9일)라
       **판을 뒤집는 크기가 아니다.**

   ── 상태를 안 늘린다 ────────────────────────────────────────────────
     ★★ **세이브에 새 칸을 하나도 안 만들었다**(`save.js` 는 이 창의 쓰기 영역 밖이고,
       칸을 늘리면 옛 판이 조용히 어긋난다). 그래서:
         **끝낸 것** = `S.stamina.questsTaken` — 이미 저장된다(save.js §packStamina)
         **열린 것** = **스냅샷에서 그때그때 계산한다.** 기억하지 않는다
       ⇒ 다시 켜면 열린 목록을 다시 센다. 값이 같으므로 어긋날 것이 없다.
     ⚠ 「방금 열렸다」만 한 판 안에서 기억한다(`S._questOpen`). `_` 로 시작하는 칸은
       세이브에 안 실린다 — `loop.js §ts._moveState` 가 쓰는 그 수법 그대로다.
       다시 켜면 열린 대사가 한 번 더 날 수 있고, 그게 자연스럽다(그쪽 주석과 같은 근거).

   ── ⚠ 이 파일은 **순수하다** ────────────────────────────────────────
     DOM 도 코어 API 도 안 부른다. 판정에 필요한 사실은 **부르는 쪽이 스냅샷으로 넘긴다**
     (§questSnapshot 계약). 그래야 헤드리스에서 다섯 줄을 다 검증할 수 있고,
     화면이 어느 함수로 그 사실을 읽는지가 바뀌어도 여기가 안 깨진다.
   ══════════════════════════════════════════════════════════════════════════ */

export const QUEST_SCHEMA = 'quest/1';

/* ══ 스냅샷 계약 ═══════════════════════════════════════════════════════
   부르는 쪽이 채워 넘기는 사실. **없는 칸은 「모른다」이고, 모르면 안 연다/안 끝낸다.**
   ⚠ 지어내지 않는다 — 0 과 null 은 다른 말이다.

     day                 게임 일자
     firstPlayDone       첫 플레이가 끝났나           (fp.completed)
     cropHarvestTotal    지금까지 거둔 회전의 총합    (cropSites 합)
     cropPots            [{ kind, harvestCount }]     방에 선 작물 용기 전부
     mealKinds           ★ 오늘 밥상에 오른 작물 id 들 (eatFromPantry / mealPlanQuote 의 portions)
     motherLeaves        모주가 지금 달고 있는 잎 수
     motherVarieLeaves   그중 무늬 잎 수
     cuttings            [{ method, status, varieFromCut, varieLightBand }]
     varieSaleCount      무늬 삽수를 판 횟수          (ts.varieSale.count)
   ══════════════════════════════════════════════════════════════════════ */
export function emptySnapshot() {
  return { day: null, firstPlayDone: false, cropHarvestTotal: 0, cropPots: [],
           mealKinds: [], motherLeaves: 0, motherVarieLeaves: 0,
           cuttings: [], varieSaleCount: 0 };
}
function snapOf(s) { return { ...emptySnapshot(), ...(s && typeof s === 'object' ? s : {}) }; }

const arr = v => (Array.isArray(v) ? v : []);
const num = v => (Number.isFinite(v) ? v : 0);

/* 뿌리를 낸 삽수인가 — 상태 이름은 `propagation.CUTTING_STATUS_KO` 소유다.
   ⚠ 여기서 새 이름을 짓지 않는다. 'rooted' 와 'potted'(흙으로 옮긴 것) 둘 다 뿌리를 낸 것이다. */
const ROOTED = ['rooted', 'potted'];
const isRooted = c => !!c && ROOTED.includes(c.status);

/* ══ 다섯 줄 ═══════════════════════════════════════════════════════════
   각 줄이 갖는 것:
     ko      이름 — 화면 배너·기록이 쓴다
     todo    ★ **아래 한 줄이 그대로 쓸 「지금 할 일」.** 28자 이하다
             (`docs/player_guide.md §0` 실측 — 폰 360px 에서 한 줄이 26자)
     why     몬이가 말하지 않는 「왜」. 안내판·기록이 쓴다
     teaches 이 줄이 가르치는 것 (문서와 검사가 대조한다)
     opens   언제 열리나 (스냅샷 → boolean)
     done    언제 끝나나  (스냅샷 → boolean)
   ⚠ **여기 숫자를 박지 않는다.** 세는 수(시루 5개·5바퀴)는 `need` 에 두고
     `todo` 는 그 값을 읽어 짓는다 — 값이 움직여도 문구가 안 낡는다(§2.8 의 반대). */
export const QUESTS = Object.freeze([

  /* ① ★ 빈 구간의 **첫날**에 열린다 — 첫 플레이가 끝나는 그 순간이다(실측 Day 33).
     가르치는 것 셋을 한 줄이 다 진다: 콩나물은 어두운 데 · 무순은 밝은 데 ·
     **섞어 먹어야 밥이 이득**(확정문 `plan-2026-08-17-crop-balance §3`).
     ⚠ 판정은 「무순을 샀다」가 아니라 **「한 상에 둘이 올랐다」**다. 사는 것은 수단이고
       배워야 하는 것은 **같이 먹는 것**이라서다 — 둘째 몫은 다른 작물이라야 2,500원이다. */
  Object.freeze({
    id: 'crop_mix',
    ko: '한 상에 두 가지',
    teaches: ['콩나물은 어두운 자리', '무순은 밝은 자리', '섞어 먹어야 밥이 이득'],
    why: '같은 것을 두 몫 먹으면 둘째 몫이 반값이 됩니다. 다른 작물이라야 온값입니다.',
    todo: () => '무순을 길러 콩나물과 한 상에 올리세요',
    opens: s => !!s.firstPlayDone,
    done:  s => new Set(arr(s.mealKinds).filter(Boolean)).size >= 2
  }),

  /* ② ★ **이미 있던 것**이다(`stamina.STAMINA_RULES.quests.siru5_cycle5` · 2026-08-11).
     값도 판정도 안 바꿨다 — **말을 붙였을 뿐**이다.
     ⚠ 「분배로」는 이름에서 뺐다. 세이브에 「혼자 거뒀나」를 적는 칸이 없어서
       재지 못하는 말이었다(`quest-to-plan §판단필요 1`). 재는 대신 **체력이 강요한다** —
       실측: 띄엄 29일 · 몰아 49일(같은 문서 §근거).
     ★ 그래서 이 줄이 「물은 한 번에 하나」와 「체력이 천장이다」를 가르친다. */
  Object.freeze({
    id: 'siru5_cycle5',
    ko: '시루 다섯, 다섯 바퀴',
    teaches: ['물은 한 번에 하나', '체력이 천장이다'],
    why: '시루가 늘면 하루에 다 못 돌봅니다. 그 상한이 체력입니다.',
    need: Object.freeze({ sirus: 5, cycles: 5 }),
    todo: q => `시루 ${q.need.sirus}개를 각각 ${q.need.cycles}바퀴 돌리세요`,
    /* ★ ①을 끝낸 뒤에 연다. 둘을 같이 열면 첫날에 할 일이 둘이 되어 어느 쪽도 안 읽힌다 */
    opens: (s, ctx) => !!s.firstPlayDone && !!(ctx && ctx.doneIds.includes('crop_mix')),
    done:  (s, ctx) => arr(s.cropPots)
      .filter(p => p && p.kind === 'beansprout' && num(p.harvestCount) >= ctx.q.need.cycles)
      .length >= ctx.q.need.sirus
  }),

  /* ③ ★ **자를 수 있게 된 순간**에 열린다 — 모주 잎이 둘이 된 날이다.
     한 장뿐일 때 자르면 그루에 잎이 안 남는다(`varieSecond` 가 말하는 그것).
     가르치는 것: **잎 1장이라야 물꽂이**(확정문 `plan-2026-08-17-cutting §2-②`).
     ⚠ 「잘랐다」가 아니라 **「뿌리를 냈다」**로 끝난다. 자르고 방치하면 죽는데,
       그건 배운 것이 아니라 시킨 것만 한 것이다. */
  Object.freeze({
    id: 'first_cut',
    ko: '물에 꽂아 본다',
    teaches: ['잎 1장까지 쪼개야 물꽂이', '자르는 것이 늘리는 길이다'],
    why: '잎이 한 장이라야 물에 꽂힙니다. 여러 장은 화분에만 심습니다.',
    todo: () => '잎 1장짜리 마디를 잘라 물에 꽂으세요',
    opens: s => num(s.motherLeaves) >= 2,
    done:  s => arr(s.cuttings).some(c => c && c.method === 'water' && isRooted(c))
  }),

  /* ④ ★★ **무늬가 난 뒤**에 열린다. 가르치는 것은 하나인데 이 게임의 뼈대다 —
     **빛이 등급을 정한다**(확정문 `plan-2026-08-17-varie-grade §3` · `-cutting §2-③`).
     ⚠ 보상이 체력이 아니다. **등급 자체가 보상**이다(산반 35만 → 풀문 115만).
       체력을 얹으면 진짜 보상이 가려진다.
     ⚠ 「밝음」이라는 이름은 `propagation.VARIE_LIGHT_BANDS` 소유다. 여기서 문턱을
       새로 짓지 않는다 — 삽수가 뿌리내린 날 그 자리의 밴드가 그대로 실린다. */
  Object.freeze({
    id: 'varie_bright',
    ko: '밝은 데서 뿌리내리기',
    teaches: ['빛이 무늬 등급을 정한다'],
    why: '어두운 자리는 산반이 흔하고, 밝은 자리는 하프문·풀문이 납니다.',
    todo: () => '무늬 삽수를 밝은 자리에서 뿌리내리세요',
    opens: s => num(s.motherVarieLeaves) >= 1,
    done:  s => arr(s.cuttings).some(c => c && c.varieFromCut && c.varieLightBand === 'bright')
  }),

  /* ⑤ ★★★ **탈출의 둘째 축이다.** 이것을 안 가르치면 영영 모른다.
     ------------------------------------------------------------
     `tutorial.canMoveOut` 은 **돈 200만 × 무늬 삽수를 판 적**을 본다(escapecut 확정).
     그런데 실측으로, **둘 중 하나도 못 찬 판에서는 그 말이 한 번도 안 나온다** —
     `loop.js §③` 이 `state = c.varie ? 'money' : c.money ? 'varie' : null` 이라
     **둘 다 멀면 `null`(할 말이 없다)** 이기 때문이다. 아래 한 줄(`tutorialGoal`)만이
     그것을 말하는데, 그 줄은 **무엇을 하라만 말하고 어떻게는 안 말한다.**
     ⇒ 이 줄이 그 자리를 맡는다. 열리는 순간 몬이가 **길을 통째로** 한 번 말한다.
     ⚠ 보상은 체력이 아니다 — **이사가 열리는 것**이 보상이다. */
  Object.freeze({
    id: 'sell_varie',
    ko: '무늬를 값으로 만든다',
    teaches: ['탈출 = 돈 + 무늬 삽수를 판 적'],
    why: '이 방을 나가는 조건은 둘입니다 — 이사비, 그리고 무늬 삽수를 판 적이 있는 것.',
    todo: () => '무늬 삽수를 내놓아 팔아 보세요',
    opens: s => arr(s.cuttings).some(c => c && c.varieFromCut),
    done:  s => num(s.varieSaleCount) >= 1
  })
]);

export const QUEST_IDS = Object.freeze(QUESTS.map(q => q.id));
export function questOf(id) { return QUESTS.find(q => q.id === id) || null; }

/* 「지금 할 일」 한 줄. ⚠ `todo` 가 함수인 것은 **수를 정의에서 읽게** 하려는 것이다 */
export function questTodo(q) {
  const d = questOf(typeof q === 'string' ? q : (q && q.id)) || q;
  if (!d || typeof d.todo !== 'function') return null;
  try { return d.todo(d); } catch { return null; }
}

/* ── 판정 ───────────────────────────────────────────────────────────── */

/* 끝낸 것 — **`stamina.questsTaken` 이 정본이다.** 여기서 따로 안 센다.
   ⚠ 「받았다」와 「끝냈다」가 같은 칸인 것이 맞다: 보상을 받는 순간이 곧 끝낸 순간이고,
     둘을 갈라 두면 반드시 한쪽이 낡는다(이 저장소가 열여섯 번 밟은 그 모양). */
export function doneIdsOf(S) {
  const t = S && S.stamina && Array.isArray(S.stamina.questsTaken) ? S.stamina.questsTaken : [];
  return t.filter(id => QUEST_IDS.includes(id));
}

/* 지금 이 판의 퀘스트 상태. **기억하지 않는다 — 스냅샷에서 매번 센다.**
   { done: [id…], open: [id…], next: {…}|null, all: [{id, ko, todo, state}…] } */
export function questView(S, snapshot) {
  const s = snapOf(snapshot);
  const doneIds = doneIdsOf(S);
  const ctx = { doneIds, S };
  const open = [], all = [];
  for (const q of QUESTS) {
    const isDone = doneIds.includes(q.id);
    let isOpen = false;
    if (!isDone) { try { isOpen = !!q.opens(s, { ...ctx, q }); } catch { isOpen = false; } }
    if (isOpen) open.push(q.id);
    all.push({ id: q.id, ko: q.ko, todo: questTodo(q), why: q.why, teaches: q.teaches,
               state: isDone ? 'done' : isOpen ? 'open' : 'locked' });
  }
  /* ★ 「지금 할 일」은 **하나만** 보여 준다. 목록을 내면 심부름 목록이 된다.
     고르는 자는 정의 순서다 — 그 순서가 곧 배우는 순서라서. */
  const nextId = open[0] || null;
  const next = nextId ? all.find(a => a.id === nextId) : null;
  return { schema: QUEST_SCHEMA, done: doneIds, open, next, all };
}

/* 하루(또는 한 동작) 뒤에 판을 다시 본다. **사건을 낸다 — 보상은 안 준다.**
   ★ 보상은 부르는 쪽이 `stamina.grantStaminaQuest(S, id)` 로 준다.
     여기서 주면 이 파일이 stamina 를 알게 되고, 그러면 헤드리스에서 판정만 재는 길이 막힌다.

   반환 `{ opened: [id…], finished: [id…], events: [ev…] }`
     ev = { id: 'quest_opened'|'quest_done', questId, ko, todo }
   ⚠ **두 번 불러도 안전하다.** `finished` 는 아직 `questsTaken` 에 없는 것만 낸다. */
export function stepQuests(S, snapshot) {
  const s = snapOf(snapshot);
  const doneIds = doneIdsOf(S);
  const ctx = { doneIds, S };
  /* 「이미 열렸다고 말한 것」 — `_` 라 세이브에 안 실린다(§상태를 안 늘린다) */
  if (!Array.isArray(S._questOpen)) S._questOpen = [];
  const opened = [], finished = [], events = [];
  for (const q of QUESTS) {
    if (doneIds.includes(q.id)) continue;
    let isOpen = false;
    try { isOpen = !!q.opens(s, { ...ctx, q }); } catch { isOpen = false; }
    if (!isOpen) continue;
    if (!S._questOpen.includes(q.id)) {
      S._questOpen.push(q.id);
      opened.push(q.id);
      events.push({ id: 'quest_opened', questId: q.id, ko: q.ko, todo: questTodo(q) });
    }
    let isDone = false;
    try { isDone = !!q.done(s, { ...ctx, q }); } catch { isDone = false; }
    if (isDone) {
      finished.push(q.id);
      events.push({ id: 'quest_done', questId: q.id, ko: q.ko, todo: questTodo(q) });
    }
  }
  return { opened, finished, events };
}
