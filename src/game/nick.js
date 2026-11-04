/* ★ 11-03 F3 그루 이름(plan-ui-fun §F3 · «F3 이름 창 글» da5daa9c · 총괄) — 받는 글자 · 길이 · 같은 이름 · «원래 이름» 셈과 글을 한 곳에 둔다
   - 받는 글자: 가~힣 · 0~9 · 띄어쓰기. 조사(josa.js §jongOf)가 한글 · 숫자 끝만 세므로 영문 · 기호 · 낱자(ㄱ · ㅏ) 끝은 «을/를»이 틀린다
   - 앞뒤 띄어쓰기는 떼고 가운데 여러 칸은 하나로 · 띄어쓰기만이면 빈칸 · 8자까지
   - 비우거나 원래 이름과 같은 글이면 «이름 없음»(nick 칸을 지운다)
   - 다른 그루가 쓰는 이름(붙인 이름이든 원래 이름이든)은 못 쓴다 — 기록 · 일기 · [📍 자리]가 이름 하나로 그루를 가리킨다
   - 세이브: 이름이 있을 때만 칸을 적는다(packNick) — 이름 없는 판은 옛 세이브와 한 바이트도 안 다르다
   ⛔ 값 · 하네스와 무관(이름은 화면 · 기록 줄만) */
import { jongOf } from './josa.js';

export const NICK_MAX = 8;
/* 글 — plan da5daa9c «F3 이름 창 글» 그대로 */
export const NICK_KO = Object.freeze({
  pen: '✎', penAriaNone: '이름 짓기', penAriaHas: '이름 바꾸기',
  title: '이름을 지어 주세요', inputAria: '그루 이름',
  hintNone: '한글 · 숫자 · 띄어쓰기로 8자까지 씁니다',
  hintHas: '비워 두면 «{orig}»{ro} 돌아갑니다',
  go: '이 이름으로', goClear: '원래 이름으로', cancel: '그만두기',
  badChar: '이름은 한글 · 숫자 · 띄어쓰기만 씁니다',
  jamo: 'ㄱ · ㅏ 같은 낱자는 못 씁니다',
  tooLong: `이름은 ${NICK_MAX}자까지입니다`,
  dup: '다른 그루가 쓰는 이름입니다',
  logMade: '✎ {orig} 이름을 «{nick}»{ro} 지었습니다',
  logChanged: '✎ «{old}» 이름을 «{nick}»{ro} 바꿨습니다',
  logCleared: '✎ «{old}» 이름을 지웠습니다',
  sellNamed: '이름 붙인 그루입니다'
});
const OK_CHARS = /^[가-힣0-9 ]+$/;
const JAMO = /[ㄱ-ㅣ]/;
/* «(으)로» — 따옴표 밖에 붙인다(ㄹ 받침은 «로» · §josaRo 와 같은 셈) */
export const roOf = (w) => { const j = jongOf(w); return j && j !== 8 ? '으로' : '로'; };
const squeeze = (raw) => String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();

/* 들어온 글 → { ok, nick(null = 이름 없음), why }
   opt.original — 그 그루의 원래 이름(같은 글이면 이름 없음) · opt.taken — 다른 그루들이 쓰는 이름(붙인 이름 · 원래 이름) */
export function cleanNick(raw, opt = {}) {
  const s = squeeze(raw);
  if (!s) return { ok: true, nick: null, why: null };
  if (opt.original && s === squeeze(opt.original)) return { ok: true, nick: null, why: null };
  if (JAMO.test(s)) return { ok: false, nick: null, why: NICK_KO.jamo };
  if (!OK_CHARS.test(s)) return { ok: false, nick: null, why: NICK_KO.badChar };
  if ([...s].length > NICK_MAX) return { ok: false, nick: null, why: NICK_KO.tooLong };
  if (opt.taken && [...opt.taken].some(t => squeeze(t) === s)) return { ok: false, nick: null, why: NICK_KO.dup };
  return { ok: true, nick: s, why: null };
}
/* 그 그루 · 삽수 · 새 종의 이름(없으면 null) */
export function nickOf(o) {
  return o && typeof o.nick === 'string' && o.nick ? o.nick : null;
}
/* 이름 붙이기 · 바꾸기 · 지우기 — 받을 수 없는 글이면 던진다(화면은 why 를 미리 보여 준다)
   돌려줌 { changed, old, nick, log } — 바뀐 것이 없으면 changed false · log null(기록 줄 안 남김) */
export function setNick(o, raw, opt = {}) {
  const c = cleanNick(raw, opt);
  if (!c.ok) { const e = new Error(c.why); e.tutorialInput = true; throw e; }
  const old = nickOf(o);
  if ((old || null) === (c.nick || null)) return { changed: false, old, nick: c.nick, log: null };
  if (c.nick) o.nick = c.nick; else delete o.nick;
  return { changed: true, old, nick: c.nick, log: nickLogKo(opt.original || '', old, c.nick) };
}
/* 기록 줄 셋(지음 · 바꿈 · 지움) — 바뀐 것이 없으면 null */
export function nickLogKo(orig, old, nick) {
  if ((old || null) === (nick || null)) return null;
  if (!old && nick) return NICK_KO.logMade.replace('{orig}', orig).replace('{nick}', nick).replace('{ro}', roOf(nick));
  if (old && nick) return NICK_KO.logChanged.replace('{old}', old).replace('{nick}', nick).replace('{ro}', roOf(nick));
  return NICK_KO.logCleared.replace('{old}', old);
}
/* 이름이 있으면 이름 · 없으면 원래 이름 */
export function nameOr(o, fallback) {
  return nickOf(o) || fallback;
}
/* 몬스테라 화분 원래 이름(이름 무시) · 보이는 이름 — game.html §potNameKo 가 여기 하나를 부른다([자세히] 제목 · [📍 자리] 창 · 기록 줄) */
export function potOrigNameOf(pots, p) {
  const arr = pots || [], idx = arr.indexOf(p);
  return arr.length > 1 && idx >= 0 ? `몬스테라 ${idx + 1}` : '몬스테라';
}
export function potNameOf(pots, p) {
  return nickOf(p) || potOrigNameOf(pots, p);
}
/* 세이브 칸 — 받을 수 있는 이름일 때만 { nick } (깨진 이름은 싣지 않는다 · 지어내지 않는다) */
export function packNick(o) {
  const c = cleanNick(o && o.nick);
  return c.ok && c.nick ? { nick: c.nick } : {};
}
