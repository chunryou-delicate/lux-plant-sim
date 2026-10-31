/* 총괄 F ② 뿌리 쪽 자(core 11-01) — test_cdp 가 «제가 만든» 크롬 프로필을 남기지 않는다
   CDP_LIB(기본 ./test_cdp.mjs)를 불러 크롬을 N번(기본 3) 띄웠다 닫는다. BYEOT_URL 이 있으면 게임까지 띄운다(무거운 판).
   판마다 프로필 — page.profileDir 이 있으면 그것, 없으면(작업 전 판) 띄우기 앞뒤로 새로 생긴 byeot-cdp-*(다른 창 것이 섞일 수 있어 «어림»)
     ㉮ close 뒤 그 프로필 폴더가 없다
     ㉯ close 가 10초 안에 끝난다(기다리기가 걸려 멎지 않는다)
     ㉰ 자가 close 없이 던지고 끝나도(자식 node) 그 프로필이 안 남는다 — 작업 전 판은 여기서 샌다
   ⚠ 아무것도 지우지 않는다 — 재기만 한다 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const LIB = process.env.CDP_LIB || new URL('./test_cdp.mjs', import.meta.url).href;
const { launch } = await import(LIB.startsWith('file:') ? LIB : pathToFileURL(LIB).href);
const N = +(process.env.N || 3);
let bad = 0; const ok = (c, m, d = '') => { console.log(`${c ? '  OK' : 'FAIL'}  ${m}${d ? '  → ' + d : ''}`); if (!c) bad++; };
const list = () => new Set(fs.readdirSync(os.tmpdir()).filter(n => /^byeot-cdp-/.test(n)));
const open = async () => {
  const before = list();
  const page = await launch({ width: 390, height: 844, dpr: 1 });
  if (process.env.BYEOT_URL) { await page.goto(`${process.env.BYEOT_URL}/game.html`); await page.waitFor('window.__byeotBooted === true', 240000, 500); }
  else await page.goto('about:blank');
  const fresh = [...list()].filter(n => !before.has(n)).map(n => path.join(os.tmpdir(), n));
  return { page, dirs: page.profileDir ? [page.profileDir] : fresh, how: page.profileDir ? 'profileDir' : `어림(새로 생긴 ${fresh.length}개)` };
};
/* ── 자식 모드: 띄우고 프로필 자리를 한 줄로 알린 뒤 **close 없이** 던져 끝난다 — 자가 중간에 죽은 판 흉내 ── */
if (process.env.CHILD_NOCLOSE) {
  const { dirs } = await open();
  console.log('DIRS ' + JSON.stringify(dirs));
  throw new Error('자식: close 없이 던진다(일부러)');
}
console.log(`  자: ${LIB}`);
for (let i = 1; i <= N; i++) {
  const { page, dirs, how } = await open();
  const t0 = Date.now();
  await page.close();
  const ms = Date.now() - t0;
  const left = dirs.filter(d => fs.existsSync(d));
  ok(dirs.length > 0 && left.length === 0, `㉮ ${i}번째 — close 뒤 프로필이 안 남는다(${how})`, left.length ? `남음 ${left.map(d => path.basename(d)).join(' · ')}` : dirs.map(d => path.basename(d)).join(' · '));
  ok(ms < 10000, `㉯ ${i}번째 — close 가 10초 안에 끝난다`, `${ms}ms`);
}
{
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, CHILD_NOCLOSE: '1' }, encoding: 'utf8', timeout: 300000 });
  const line = ((r.stdout || '').split(/\r?\n/).find(l => l.startsWith('DIRS ')) || '').slice(5);
  const dirs = line ? JSON.parse(line) : [];
  await new Promise(res => setTimeout(res, 1500));
  const left = dirs.filter(d => fs.existsSync(d));
  const warn = ((r.stderr || '') + (r.stdout || '')).split(/\r?\n/).filter(l => /test_cdp\]/.test(l)).slice(0, 2).join(' / ');
  ok(dirs.length > 0 && left.length === 0, '㉰ 자가 close 없이 던지고 끝나도 프로필이 안 남는다',
     `자식 exit=${r.status} · ` + (left.length ? `남음 ${left.map(d => path.basename(d)).join(' · ')}` : (dirs.map(d => path.basename(d)).join(' · ') || '(자리 못 받음)')) + (warn ? ` · ${warn}` : ''));
}
console.log(bad ? `probe_f_cdp_profile: 빨강 ${bad}` : 'probe_f_cdp_profile: 다 통과');
process.exit(bad ? 1 : 0);
