/* tools/probe_siruhands.mjs — **시루 하나를 세우는 데 «손»이 몇인가** (총괄 ⓑ)
   ------------------------------------------------------------------
   물음: 「놓기 1 + 심기 1 + 물 1 = 셋인가」. 「하루에 하나씩」 규칙의 밑돌이 될 수다.
   ★ 「손」에는 두 뜻이 있어서 둘 다 잰다 — 섞으면 답이 어긋난다:
     ㉠ **누르는 횟수**   사람이 화면에서 하는 손짓 (안내가 이끄는 걸음 수)
     ㉡ **체력**          코어가 깎는 값 (`stamina.ACT_COST` · 하루에 쓸 수 있는 양이 정해져 있다)
   ⇒ ㉠은 probe_force5 가 걸으며 셌다. 여기서는 ㉡을 코어에게 «직접» 묻는다.
   ⛔ 값은 안 바꾼다. 「하루에 몇으로 할까」는 [Plan]·박사님 몫이다. 여기는 수만 낸다.
   ⚠ 브라우저가 필요 없다 — stamina 는 순수 모듈이다(THREE 도 DOM 도 안 쓴다). */
const st = await import('../src/game/stamina.js');
const fp = await import('../src/game/first_play.js');
const J = (o) => JSON.stringify(o, null, 0);
console.log('=== ① 동작 하나에 드는 체력 (코어 표) ===');
console.log(' ', J(st.ACT_COST));
console.log('  · 시작 최대체력 —', st.STAMINA_RULES.startMax);
console.log('  · 상한 —', st.STAMINA_RULES.maxCap === null || st.STAMINA_RULES.maxCap === undefined
  ? '없다(계속 오른다)' : st.STAMINA_RULES.maxCap);
console.log('  ⚠ 옮기기·돌리기·놓기는 표에 «없다» = 0. 자리를 바꿔 보는 것에는 벌이 없다.');
console.log('');
console.log('=== ② 시루 하나 — 걸음마다 무엇이 드나 ===');
{
  const rows = [
    ['가방에서 방으로 놓기', 0, '표에 없다 — 놓기·옮기기는 공짜다'],
    ['씨앗 심기 (sow)',      st.ACT_COST.sow || 0, '놓은 시루는 needsSow 가 참이 된다'],
    ['물 주기 (water)',      st.ACT_COST.water || 0, '물이 회전의 «시작»이다'],
    ['거두기 (harvest)',     st.ACT_COST.harvest || 0, '한 시루에 1 — 다섯이면 5'],
  ];
  for (const [ko, c, why] of rows) console.log(`   ${String(c)} 손  ${ko.padEnd(22)} ${why}`);
  const setUp = (st.ACT_COST.sow || 0) + (st.ACT_COST.water || 0);
  const cycle = setUp + (st.ACT_COST.harvest || 0);
  console.log(`  ⇒ ★ 세우는 데(놓기+심기+물) — 체력 ${setUp}`);
  console.log(`  ⇒ ★ 한 바퀴(거두고 다시 심고 물) — 체력 ${cycle}`);
  console.log(`  ⇒ ⚠ 「손이 셋인가」의 답: 누르는 횟수로는 셋(놓기·심기·물)이지만`);
  console.log(`      체력으로는 ${setUp} 이다 — **놓기는 공짜**다.`);
}
console.log('');
console.log('=== ③ 시루 다섯이면 — 하루에 몇 바퀴가 도나 ===');
{
  const max = st.STAMINA_RULES.startMax;
  const per = (st.ACT_COST.harvest || 0) + (st.ACT_COST.sow || 0) + (st.ACT_COST.water || 0);
  for (const n of [1, 2, 3, 5]) {
    const need = per * n;
    console.log(`   시루 ${n}개 한 바퀴 = 체력 ${need}` +
      `  ⇒ 최대체력 ${max} 이면 ${Math.ceil(need / max)}일치` +
      (need > max ? `  (하루에 ${Math.floor(max / per)}개까지)` : ''));
  }
  console.log('  ⚠ 다섯이 «같은 날» 익으면 하루에 다 못 돈다 — 그것이 「거두는 날을 엇갈리게」의 까닭이다.');
}
console.log('');
console.log('=== ④ 무순 하나를 더 얹으면 ===');
{
  const k = fp.cropKindOf('musun'), b = fp.cropKindOf('beansprout');
  console.log(' ', J({ 무순: { 주기: k.harvestDays, 밝은데: k.wantsLight },
                       콩나물: { 주기: b.harvestDays, 밝은데: b.wantsLight } }));
  const per = (st.ACT_COST.harvest || 0) + (st.ACT_COST.sow || 0) + (st.ACT_COST.water || 0);
  console.log(`  · 무순도 같은 표를 쓴다 ⇒ 한 바퀴 체력 ${per}`);
  console.log(`  · 다만 주기가 다르므로(${b.harvestDays}일 대 ${k.harvestDays}일) 익는 날이 저절로 엇갈린다.`);
}
console.log('');
console.log('=== ⑤ 최대체력이 어떻게 오르나 (「하루에 하나씩」이 언제 풀리나) ===');
{
  const R = st.STAMINA_RULES;
  console.log('  · 그날 쓴 체력이 곧 경험치다(따로 세는 축이 없다).');
  let lv = R.startMax, acc = 0;
  const per = (st.ACT_COST.harvest || 0) + (st.ACT_COST.sow || 0) + (st.ACT_COST.water || 0);
  for (let i = 0; i < 4; i++) {
    const need = st.xpNeededAt ? st.xpNeededAt(lv, R) : (R.levelTable[lv] || lv * R.beyondMult);
    acc += need;
    console.log(`   최대체력 ${lv} → ${lv + 1} : 경험치 ${need}` +
      `  (시루 다섯이면 ${(need / (per * 5)).toFixed(1)}바퀴쯤)`);
    lv++;
  }
  console.log(`  ⇒ 5 → ${lv} 까지 모두 ${acc} 회. 판을 뒤집는 크기는 아니다.`);
}
