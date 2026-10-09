/* src/game/hero_branch.js — **주인공 성별 · 새 판 캐릭터** «추후 분기»가 막히지 않게 길만 연다 (core · 2026-10-10)
   ------------------------------------------------------------------
   박사님(10-09 · 총괄 전달): *"옛날 기획한 대로 직업이랑 남녀별로 추후에 분기되도록도 해"*
   설계: docs/handoff/plan-branch-job-gender-20261010.md §3(최소 이음 다섯) — **지금 짓지 않는다.** 'f' 판은 예전과 바이트 단위로 같다.
   ★ 두 층을 한 칸에 섞지 않는다(한 낱말 두 방):
       S.hero.gender  'f' | 'm'                     — 모습(초상 · 3D 몸 · 옷). 규칙·값·퀘스트·대사는 안 갈린다(plan §2-3)
       S.character    characters.json id            — 새 판 캐릭터(시작 집·돈·식구가 갈리는 «게임의 종류» · 지금은 자취생 고정)
       story.job      job_shop §JOB_IDS              — 엔딩 뒤 진로(같은 판)
   ★ 읽는 곳은 여기 하나(heroGenderOf · characterOf) — 여러 곳에서 S.hero 를 직접 읽으면 반만 바뀐다.
   ⚠ 세이브 칸은 새 두 종과 같은 규약 — 처음 쓸 때 선다(state.newState 칸이 아니다 · save §KNOWN_STATE_KEYS 에 안 든다).
     옛 세이브 · 칸 없는 판 = 'f' · 'jachwi'.
   ★ 그림이 없는 성별은 **조용히 여자 그림으로 떨어지지 않는다** — 콘솔 경고 한 줄(같은 것은 한 번)을 내고 떨어진다.
     모자란 것 목록이 곧 char 주문이다(plan §4). */

export const HERO_GENDERS = Object.freeze(['f', 'm']);
/* = data/balance/characters.json 의 id(test_hero_branch 가 등식을 고정한다) · 튜토·초보 스토리는 자취생 고정(story_arc §0) */
export const CHARACTER_IDS = Object.freeze(['jachwi', 'breadwinner', 'housewife', 'researcher']);

export function createHeroState(gender = 'f') { return { gender: gender === 'm' ? 'm' : 'f' }; }
export function heroGenderOf(S, opt = {}) {
  if (opt.override === 'f' || opt.override === 'm') return opt.override;   /* 미리 보기 깃발(?hero=m) — 세이브엔 안 쓴다 */
  const g = S && S.hero && S.hero.gender;
  return g === 'm' ? 'm' : 'f';
}
export function setHeroGender(S, gender) {
  if (!HERO_GENDERS.includes(gender)) throw new Error(`[주인공] 모르는 성별입니다: ${gender}`);
  S.hero = createHeroState(gender);
  return S.hero;
}
export function characterOf(S) {
  const c = S && S.character;
  return CHARACTER_IDS.includes(c) ? c : 'jachwi';
}

/* ── 세이브 ─────────────────────────────── 칸이 없으면 null(= 기본) */
export function packHero(h) { return h ? { gender: h.gender === 'm' ? 'm' : 'f' } : null; }
export function unpackHero(h) { return h && typeof h === 'object' ? createHeroState(h.gender) : null; }
export function packCharacter(c) { return CHARACTER_IDS.includes(c) ? c : null; }

/* ── 경고 한 줄 — 같은 것은 한 번(대사가 넘어갈 때마다 찍히면 콘솔이 묻힌다) ── */
const warned = new Set();
export function genderWarn(key, msg, warn = (m) => { try { console.warn(m); } catch { } }) {
  if (warned.has(key)) return false;
  warned.add(key); warn(msg); return true;
}
export function _resetGenderWarnings() { warned.clear(); }   /* 검사용 */

/* ── 성별로 고르기 — table[gender] 가 없으면 'f' + 경고 ── */
export function pickByGender(table, gender, what, warn) {
  const g = gender === 'm' ? 'm' : 'f';
  if (table && table[g] != null) return table[g];
  genderWarn(`pick:${what}:${g}`, `[성별] ${what} — '${g}' 판이 아직 없어 'f' 로 떨어집니다`, warn);
  return table ? table.f : null;
}

/* ── 초상 ─────────────────────────────── FACE_FILE 값(file) → 파일 이름 앞말(portrait_ 뒤 · .png 앞)
   남 자취생 초상은 portrait_jachwi_m_{키}.png — **있는 것만** 적는다(없는 파일을 물으면 콘솔에 404 가 쌓인다).
   없는 키는 같은 성별 neutral + 경고(조용히 여자 얼굴로 떨어지지 않게 · plan §3-3). 몬이·식물신은 성별이 없다 */
export const PORTRAIT_M_HAVE = Object.freeze(['cry', 'happy', 'neutral', 'numb', 'proud', 'surprise', 'think', 'tired', 'worry']);
export function portraitNameOf(who, file, gender, warn) {
  if (who !== 'jachwi' || gender !== 'm') return `${who}_${file}`;
  if (PORTRAIT_M_HAVE.includes(file)) return `jachwi_m_${file}`;
  genderWarn(`face:m:${file}`, `[성별] 남 초상 portrait_jachwi_m_${file}.png 가 아직 없어 neutral 로 섭니다`, warn);
  return 'jachwi_m_neutral';
}
