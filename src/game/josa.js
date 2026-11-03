/* 조사(을/를 · 이/가 · 은/는 · 과/와 · (으)로) — 받침을 세어 고른다. 정본은 여기 하나다.
   ★ 값과 아무 상관이 없고 **글이 사람 말처럼 읽히게** 있다 — «몬스테라을(를)» 같은 괄호가 화면에 뜨면 그 문장은 사람이 안 읽는다.
   ★ 2026-11-03 8C6 첫머리(총괄 · plan 25224e96) — shop.js 안에 있던 것을 여기로 옮겼다(shop.js 가 그대로 다시 내보낸다 ·
     부르는 자리는 안 바뀜). first_play.js 처럼 shop.js 를 못 부르는 모듈(돌아오는 고리)도 이것만은 부를 수 있게 아무것도 안 부른다.
     ⛔ 예전: 한글이 아니면 받침 없음 — «몬스테라 1를» · «몬스테라 3는»(숫자 끝 1·3·6·7·8·0 은 받침)
     ⇒ 끝 글자가 숫자면 우리말로 읽은 소리의 받침(영 · 일 · 이 · 삼 · 사 · 오 · 육 · 칠 · 팔 · 구) · 0 으로 끝나면 십 · 백 · 천 · 만 모두 받침(ㄹ 아님)
   ⚠ 영문 · 기호 끝은 예전처럼 받침 없음으로 친다. */

/* 숫자 끝 소리의 받침 번호(0 없음 · 8 ㄹ) — 0 영(ㅇ 21) · 1 일(ㄹ 8) · 2 이 · 3 삼(ㅁ 16) · 4 사 · 5 오 · 6 육(ㄱ 1) · 7 칠(ㄹ) · 8 팔(ㄹ) · 9 구 */
const DIGIT_JONG = Object.freeze([21, 8, 0, 16, 0, 0, 1, 8, 8, 0]);

/* 끝 글자의 받침 번호 — 0 이면 받침 없음 · 8 이면 ㄹ(«(으)로»는 ㄹ 받침이면 «로») */
export function jongOf(s) {
  const t = String(s == null ? '' : s).trim();
  if (!t) return 0;
  const c = t.charCodeAt(t.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28;
  if (c >= 0x30 && c <= 0x39) return DIGIT_JONG[c - 0x30];
  return 0;
}
export const hasJong = (s) => jongOf(s) !== 0;
export const josa = (s, withJong, without) => `${s}${hasJong(s) ? withJong : without}`;
