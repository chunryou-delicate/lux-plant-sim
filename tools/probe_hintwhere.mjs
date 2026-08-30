/* tools/probe_hintwhere.mjs — **손가락이 «옳은 자리»를 짚나** (걸음마다 한 줄)
   ------------------------------------------------------------------
   [Plan]: *"덮개를 넣으면 «틀린 자리»가 더 도드라집니다. 붙이고 나서 「손가락이 맞는 데를
   짚나」를 한 번 더 보십시오. 지금은 틀려도 묻힙니다."*
   ⇒ 그래서 걸음마다 판을 세워 놓고 **무엇을 짚나 · 뭐라고 하나**를 나란히 찍는다.
   ⚠ 이 자는 «옳고 그름»을 판정하지 않는다 — 사람이 읽고 가른다. 판정을 지어내면
     그 판정이 곧 또 하나의 「짐작」이 된다.

   ★★ 읽는 법 — **`무대` 를 «먼저» 보라.**
     `talking` 이 붙어 있으면 손가락도 말풍선도 «쉬는 것이 규칙»이다(§coach ⓑ · §drawMarks).
     그때의 「짚는것: null」은 **구멍이 아니라 규칙**이다.
     ⚠ 나는 이걸 안 보고 「심었는데 아무 안내도 없다」로 읽을 뻔했다 — 대사가 떠 있었을 뿐이다.
     ⇒ 그래서 `무대`·`시트열림`·`쪽지`를 줄마다 같이 찍는다. 「없다」와 「쉰다」를 가르는 값이다.
   ⛔ 값은 안 바꾼다. */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 300000);
wd.unref && wd.unref();
const page = await launch({ width: 390, height: 844, dpr: 1 });
try { await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); } catch {}
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(4500);
const clearTalk = async (n = 20) => {
  for (let i = 0; i < n; i++) {
    const b = await page.eval(`(()=>{const s=document.getElementById('stage'),g=document.getElementById('guide');
      return !!(s&&s.classList.contains('talking'))||!!(g&&g.classList.contains('on'));})()`);
    if (b !== 'true') break;
    await page.eval(`(()=>{const s=document.getElementById('dlgSkip'); if(s)s.click();
      const x=document.getElementById('dlgBox'); if(x)x.click();
      const g=document.getElementById('guideClose'); if(g)g.click();})()`, false);
    await sleep(200);
  }
};
/* 손가락이 뜰 때까지 걷어 가며 기다린다(쪽지·시트가 손가락을 쉬게 한다) */
const settle = async () => {
  for (let i = 0; i < 10; i++) {
    await clearTalk(6);
    const on = await page.eval(`(()=>{ const h=document.getElementById('hint');
      return String(!!(h && h.classList.contains('on'))); })()`);
    if (on === 'true') return;
    await page.eval(`(()=>{ try{ window.__byeotSheet.close(); }catch(e){}
      const c=document.getElementById('coach'); if(c) c.click(); window.__redraw(); })()`, false);
    await sleep(600);
  }
};
const look = async (ko) => {
  await settle();
  const row = await page.eval(`(()=>{ const h=document.getElementById('hint');
    const t=document.querySelector('.hintTarget'); const d=document.getElementById('hintDim');
    const S=window.__S(); const fp=S.firstPlay;
    return JSON.stringify({ 짚는것: t ? (t.id || t.dataset.potbag || t.dataset.place || t.className) : null,
      말: h ? ((h.querySelector('.say')||{}).textContent||'').trim() : null,
      덮개: !!(d && d.classList.contains('on')),
      /* ⚠ 손가락이 «쉬는» 걸음도 있다 — 그때는 말풍선(marks)이 안내한다(§drawMarks).
         그러니 「손가락 없음」만 적으면 「안내가 없다」로 잘못 읽힌다. 같이 적는다. */
      말풍선: [...document.querySelectorAll('#marks .mark')]
        .map(e => (e.getAttribute('aria-label') || e.textContent || '').trim()).slice(0, 3),
      /* ⚠ 손가락이 «왜» 쉬는지도 같이 본다 — 시트가 열렸거나 쪽지가 떠 있으면 쉬는 것이 규칙이다.
         그걸 안 적으면 「안내가 없다」와 「안내가 쉬는 중이다」가 같은 모양으로 보인다. */
      무대: (document.getElementById('stage').className||'').trim(),
      바쁨: (()=>{ try { return !!window.__stageBusy && window.__stageBusy(); } catch { return null; } })(),
      시트열림: !!(document.getElementById('sheet')||{}).classList &&
        document.getElementById('sheet').classList.contains('open'),
      쪽지: !!(document.getElementById('coach')||{}).classList &&
        document.getElementById('coach').classList.contains('on'),
      시루: ((fp && fp.beansprout && fp.beansprout.pots) || []).map(q => ({
        놓임: !!(q.slotId || q.at), 심음: !!q.sown, 물준날: q.startedOnDay ?? null })),
      단계: fp ? fp.phase : null,
      '할 일': ((document.getElementById('questChipText')||{}).textContent||'').trim().slice(0, 30) }); })()`);
  console.log(`  ${ko}\n     ${row}`);
};
console.log('=== 걸음마다 — 손가락이 무엇을 짚나 ===');
/* ⚠ 처음에는 상태를 «손으로 찔러» 걸음을 옮기려 했는데 그 판이 «안 섰다» —
   단계도 할 일도 안 바뀌었고 손가락은 내내 안 떴다. 지어낸 판에서 읽은 값은 값이 아니다.
   ⇒ ★ 그래서 **게임이 실제로 쓰는 손짓**으로 옮긴다: 가방 칸을 누르고 [확인]을 누른다. */
await look('① 첫날 (시루가 가방에 · 아직 안 놓음)');

/* 가방을 열고 시루 칸을 누른다 — 임시로 서고 [확인]이 뜬다(§startPhonePlace) */
await page.eval(`(()=>{ try{ window.__byeotSheet.open('bag'); }catch(e){} })()`, false);
await sleep(1200);
await page.eval(`(()=>{ const b=document.querySelector('.bagslot[data-place="beansprout"]');
  if (b) b.click(); })()`, false);
await sleep(1800);
await clearTalk(8);
await look('② 시루를 «눌러» 임시로 세웠다 ([확인] 이 떠 있다)');

await page.eval(`(()=>{ const b=document.getElementById('placeOk');
  if (b) b.dispatchEvent(new PointerEvent('pointerdown',{ bubbles:true, cancelable:true, pointerId:2, pointerType:'touch' })); })()`, false);
await sleep(1800);
await clearTalk(8);
await look('③ [확인] 으로 놓았다 (이제 심어야 한다)');

/* 심기 — 시루 줄의 [🌱 심기] 를 누른다 */
await page.eval(`(()=>{ try{ window.__byeotSheet.open('plants'); }catch(e){} })()`, false);
await sleep(1000);
console.log('  · 심기 단추가 있나 —', await page.eval(`(()=>{
  const b=document.querySelector('#siruList .siru button[data-act="plant"]');
  if (b) { b.click(); return '있다 — 눌렀다'; }
  const n=document.querySelectorAll('#siruList .siru').length;
  return '없다 (시루 줄 ' + n + '개) — 씨앗이 없거나 아직 못 심는 걸음이다';
})()`));
await sleep(2000);
await clearTalk(8);
await look('④ 심었다 (이제 물을 줘야 한다)');
console.log('');
console.log('★ 제일 밝은 자리 —', await page.eval(`(()=>{ const S=window.__S();
  const rows=[...(window.__io.light.daily(S.day+1,S).report.slots||[])].sort((a,b)=>b.dli-a.dli);
  return rows[0].slotId + ' (' + Math.round(rows[0].dli*100)/100 + ')'; })()`));
await page.shot('docs/handoff/img/hintwhere.png').catch(() => {});
await page.close(); clearTimeout(wd);
