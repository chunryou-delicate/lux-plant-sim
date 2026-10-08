/* tools/probe_emote.mjs — **기쁜 순간의 몸짓(cheer·wave)이 «대사 닫힘 + 카메라 멎음» 뒤에 한 번 도나** (2026-10-08 · [char] c56fd8b7)
   ------------------------------------------------------------------
   ① 새 판 — 인트로 대사가 떠 있는 동안엔 몸짓이 없다 · 닫으면 wave 가 한 번(__stageLog 'emote:wave' ok)
   ② 무늬 장면(varieSeen · 진단 손잡이 __leafScene('seen')) — 대사가 닫힌 뒤 cheer 가 한 번
   ③ 방 화면 창구 — 걷는 중이면 거절(emote → false)
   판: 폰 390×844. ⛔ 값 0(그림만). */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:9300';
const wd = setTimeout(() => { console.error('⏱ 자가 제한'); process.exit(2); }, 400000);
wd.unref && wd.unref();
let fail = 0;
const ok = (c, msg, got) => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${msg}${got !== undefined ? ' → ' + JSON.stringify(got) : ''}`); if (!c) fail++; };
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.goto(`${BASE}/game.html`); await page.eval('localStorage.clear()', false); await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 240000, 500); await sleep(2500);
const J = async (e) => JSON.parse(await page.eval(`(()=>{ try { return JSON.stringify((${e})); } catch(e) { return JSON.stringify({ 탈:e.message }); } })()`));
const emoteLog = () => J(`(window.__stageLog||[]).filter(x=>/^emote:/.test(x.kind))`);
const talking = () => J(`document.getElementById('stage').classList.contains('talking')`);
/* ① 인트로 — 대사 중엔 없다 */
const t0 = await talking();
await sleep(3000);
const during = await emoteLog();
ok(t0 === true && during.length === 0, '① 인트로 대사가 떠 있는 동안엔 몸짓이 없다', { talking: t0, emotes: during });
for (let i = 0; i < 60; i++) { if ((await talking()) !== true) break; await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(150); }
let after = [];
for (let i = 0; i < 40; i++) { await sleep(500); after = await emoteLog(); if (after.length) break; }
ok(after.length === 1 && after[0].kind === 'emote:wave' && after[0].ok === true, '① 인트로를 닫으면 wave 가 한 번 돈다', after);
/* ② 무늬 장면 → cheer */
await sleep(6500);                                   /* wave(5.4초)가 끝나기를 기다린다 */
await page.eval(`(()=>{ try { window.__leafScene('seen'); } catch(e) {} })()`, false);
await sleep(1500);
const t2 = await talking();
const mid = (await emoteLog()).filter(x => x.kind === 'emote:cheer');
for (let i = 0; i < 60; i++) { if ((await talking()) !== true) break; await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(150); }
let cheer = [];
for (let i = 0; i < 50; i++) { await sleep(500); cheer = (await emoteLog()).filter(x => x.kind === 'emote:cheer'); if (cheer.length) break; }
ok(t2 === true && mid.length === 0, '② 무늬 장면 대사 중엔 cheer 가 없다', { talking: t2, cheer: mid.length });
ok(cheer.length === 1 && cheer[0].ok === true, '② 대사가 닫히고 카메라가 멎은 뒤 cheer 가 한 번 돈다', cheer);
/* ③ 걷는 중엔 거절 */
await sleep(4000);
const walkRej = await page.eval(`(async()=>{ const rv=window.__rv; const id=(rv.characters ? rv.characters() : []).map(c=>c.id||c)[0];
  try { rv.walkCharacterTo && rv.walkCharacterTo(id, 0.5, 0.5); } catch(e) {}
  await new Promise(r=>setTimeout(r,120));
  return JSON.stringify(await rv.emote(null, 'cheer')); })()`, true, 30000);
console.log('  ③ 걷게 한 뒤 몸짓 →', walkRej, '(걷기 손잡이가 없으면 true 일 수 있다 — 참고)');
await page.close(); clearTimeout(wd);
console.log(fail ? `\nprobe_emote: FAIL ${fail}` : '\nprobe_emote: PASS');
process.exit(fail ? 1 : 0);
