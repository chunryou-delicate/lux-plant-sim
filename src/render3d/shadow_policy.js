/* ============================================================
   render3d/shadow_policy.js — 그림자 정책 단일 주체
   ------------------------------------------------------------
   ★ 빌더는 castShadow 를 건드리지 않는다. 역할(shadowRole)만 붙인다.
     실제 castShadow 설정은 applyShadowPolicy 한 곳에서만 한다.

   왜 이렇게까지 하나 — 같은 실수를 정반대 방향으로 두 번 했다.
     천장: visible=false 로 감췄더니 three.js 가 그림자 패스에서도 빼서
           해가 천장을 뚫고 들어왔다
     유리: castShadow=true 를 일괄로 걸었더니 통유리가 불투명 그림자를 던져
           거실이 캄캄했다
   둘 다 "전체에 일괄 적용하고 예외를 안 둔" 것이다. 예외를 목록으로 관리하니
   새 메시가 생길 때마다 빠졌다(창틀은 빼놨는데 칸막이 유리는 빠져 있었다).

   그리고 한 번 더 — 빌더가 내부에서 castShadow=true 를 켜고 있으면
   정책 루프가 그 뒤에 안 돌 때 그대로 샌다. 실제로 정책을 trims 붙기 전에
   돌려서 창틀 유리가 전 방에서 빛을 막고 있었다. **순서가 곧 버그였다.**
   그래서 castShadow 를 쓰는 주체를 여기 하나로 못 박는다 — 순서에 무관해진다.
============================================================ */

export const SHADOW_ROLE = {
  BLOCK:  'blocker',            // 벽·가구·칸막이·격자살 — 빛을 막는다
  CLEAR:  'transparent',        // 유리·창틀 — 빛이 지난다
  HIDDEN: 'hidden-but-blocks'   // 천장·컷어웨이된 벽 — 안 보이되 빛은 막는다
};

/**
 * 역할을 붙인다.
 * 기본은 **덮어쓰지 않는다** — 빌더가 이미 정한 역할(유리 등)을 상위 루프가
 * 뭉개면 안 된다. 상위에서 확정적으로 바꿔야 할 때만 force 를 쓴다.
 */
export function markShadow(objOrList, role, { force = false } = {}) {
  const list = Array.isArray(objOrList) ? objOrList : [objOrList];
  const put = m => { if (m.isMesh && (force || !m.userData.shadowRole)) m.userData.shadowRole = role; };
  for (const o of list) {
    if (!o) continue;
    if (o.traverse) o.traverse(put); else put(o);
  }
  return objOrList;
}

/**
 * 역할을 실제 castShadow 로 옮긴다. **이 함수만 castShadow 를 쓴다.**
 * 트리에 전부 붙인 뒤 맨 마지막에 한 번 부른다.
 * @returns {{untagged:number, suspect:number}} 빠뜨린 것들 — 0이 아니면 손볼 곳이 있다
 */
export function applyShadowPolicy(root) {
  const untagged = [], suspect = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    /* 밑동 박스는 '보여주기용 복제본'이다. 그림자는 원래 벽이 던지므로 건드리지 않는다 */
    if (o.userData.isStub) return;
    if (!o.userData.shadowRole) { o.userData.shadowRole = SHADOW_ROLE.BLOCK; untagged.push(o); }
    const role = o.userData.shadowRole;
    const mat  = Array.isArray(o.material) ? o.material[0] : o.material;
    /* ★ 안전망 — 반투명인데 blocker 면 유리를 놓친 것이다.
       베란다 통유리가 정확히 이 상태였고, 거실이 캄캄해질 때까지 아무도 몰랐다. */
    if (role === SHADOW_ROLE.BLOCK && mat && mat.transparent && (mat.opacity ?? 1) < 0.9) suspect.push(o);
    o.receiveShadow = true;
    o.castShadow    = role !== SHADOW_ROLE.CLEAR;
  });
  if (untagged.length) console.warn('[볕] 그림자 정책이 없는 메시 ' + untagged.length + '개 — blocker 로 뒀다', untagged);
  if (suspect.length)  console.warn('[볕] 반투명인데 blocker 인 메시 ' + suspect.length + '개 — 유리를 놓쳤을 수 있다', suspect);
  return { untagged: untagged.length, suspect: suspect.length };
}
