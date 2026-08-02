/* ============================================================
   tools/test_boot_profile.mjs — ★부팅에 무엇이 몇 초 걸리나
   ------------------------------------------------------------
   "게임이 열리긴 하는데 늦게 열리네" 를 짐작 대신 숫자로 본다.

     python tools/serve.py 8971
     node tools/test_boot_profile.mjs [--url=...] [--cpu=4] [--net=12000]

   내는 것
     ① 이정표     첫 바이트 · DOM · 방 준비 · 부팅 완료 각각 몇 ms
     ② 종류별 표  무엇을(캐릭터 GLB·식물 GLB·엔진…) 몇 장 · 몇 MB · 몇 초
     ③ 제일 무거운 파일 15개

   ★ 폰 흉내: --cpu=4 --net=12000 (4배 느린 CPU · 12Mbps).
     박사님 폰에서 40초였고 데스크톱 로컬에서는 늘 빠르게 나온다 —
     조이지 않고 재면 "우리 기계에선 빠른데요"밖에 안 나온다.
============================================================ */
import { launch, sleep } from './test_cdp.mjs';

const arg = (k, d) => {
  const a = process.argv.find(s => s.startsWith(`--${k}=`));
  return a ? a.split('=').slice(1).join('=') : d;
};
const URL_ = arg('url', 'http://localhost:8971/game.html');
const CPU = +arg('cpu', 1);
const NET = +arg('net', 0);
const LABEL = arg('label', '');
/* ★ 반사실 측정 — 어떤 파일을 **안 받았다면** 얼마나 빨라지나.
   고칠 파일이 제 소유가 아닐 때(plant_grow.html) 고치지 않고도 효과를 잴 수 있다.
     --block=*monstera/skins/*                                              */
const BLOCK = arg('block', '').split(',').map(s => s.trim()).filter(Boolean);

/* 무엇으로 셀까 — 경로로 종류를 가른다. 이름이 아니라 **화면에 언제 필요한가**로 묶는다. */
function bucket(u) {
  const p = u.replace(/^https?:\/\/[^/]+/, '');
  if (/vendor\/three|three\.min|GLTFLoader/.test(p)) return '3D 엔진(three)';
  if (/plant_grow\.html/.test(p)) return 'plant_grow.html (확대 iframe)';
  if (/assets\/characters/.test(p)) return '캐릭터 GLB';
  if (/assets\/monstera|assets\/plants/.test(p)) return '식물 GLB(몬스테라)';
  if (/assets\/crops/.test(p)) return '작물 GLB';
  if (/assets\/(furniture|house|pots|deco)/.test(p)) return '가구·방 GLB';
  if (/assets\/.*\.(png|jpg|webp|jpeg)$/.test(p)) return '그림(원화·초상화)';
  if (/assets\//.test(p)) return '기타 에셋';
  if (/\/data\//.test(p)) return '데이터(json)';
  if (/\/src\//.test(p)) return '게임 코드(src)';
  return '그 밖';
}

const fmtMB = b => (b / 1048576).toFixed(2) + 'MB';
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

async function main() {
  const page = await launch({
    width: 390, height: 844, dpr: 2, mobile: true,
    throttle: (CPU > 1 || NET > 0) ? { cpu: CPU, netKbps: NET || 100000, latency: NET ? 60 : 5 } : null
  });

  const reqs = new Map();     // requestId → {url, start, end, size, status}
  const marks = {};
  const t0 = Date.now();
  const mark = k => { if (marks[k] == null) marks[k] = Date.now() - t0; };

  page.on((m, p) => {
    if (m === 'Network.requestWillBeSent')
      reqs.set(p.requestId, { url: p.request.url, start: Date.now() - t0, size: 0, status: 0, end: null });
    else if (m === 'Network.responseReceived') {
      const r = reqs.get(p.requestId); if (r) r.status = p.response.status;
    } else if (m === 'Network.loadingFinished') {
      const r = reqs.get(p.requestId);
      if (r) { r.end = Date.now() - t0; r.size = p.encodedDataLength || 0; }
    } else if (m === 'Network.loadingFailed') {
      const r = reqs.get(p.requestId); if (r) { r.end = Date.now() - t0; r.failed = p.errorText; }
    } else if (m === 'Page.domContentEventFired') mark('DOM 파싱 끝');
    else if (m === 'Page.loadEventFired') mark('load 이벤트');
  });

  if (BLOCK.length) await page.send('Network.setBlockedURLs', { urls: BLOCK });

  await page.goto(URL_);

  /* 이정표 — 페이지마다 다른 신호를 본다 */
  const isGame = /game\.html/.test(URL_);
  try {
    if (isGame) {
      marks['방 캔버스가 떴다(room-ok)'] =
        await page.waitFor(`document.getElementById('stage') && document.getElementById('stage').classList.contains('room-ok')`, 90000, 100);
      marks['게임 부팅 완료(__byeotBooted)'] =
        await page.waitFor(`window.__byeotBooted === true`, 90000, 100);
    } else {
      marks['방 준비(onReady)'] = await page.waitFor(`!!window.view`, 90000, 100);
    }
  } catch (e) {
    console.error('★ 이정표를 못 봤습니다:', e.message);
  }
  /* 캐릭터까지 다 서는 데 얼마나 더 걸리나 — 첫 화면 뒤에 따라오는 몫.
     ★ waitFor 는 '기다린 시간'을 돌려준다. 시작점(t0)부터가 아니다 —
       그대로 적으면 "캐릭터가 0.8초 만에 섰다"는 거짓말이 나온다(실제로 나왔다). */
  if (isGame) try {
    await page.waitFor(`window.__rv && window.__rv.characters().length >= 2`, 60000, 200);
    marks['캐릭터 둘 다 섰다'] = Date.now() - t0;
  } catch { /* 캐릭터가 없는 판이면 넘어간다 */ }

  await sleep(1500);          // 뒤늦게 오는 것(변주 클립 등)까지 담는다
  const total = Date.now() - t0;
  /* ★ 모듈이 스스로 잰 이정표 — 네트워크 시간과 조립 시간이 여기서 갈린다 */
  let inner = null;
  try { inner = await page.eval(`((window.__rv||window.view)||{bootTimings:()=>null}).bootTimings()`); } catch { }
  await page.close();

  /* ── ① 이정표 ── */
  console.log(`\n══ 부팅 측정 ${LABEL ? '· ' + LABEL : ''}`);
  console.log(`   ${URL_}   CPU×${CPU}${NET ? ` · ${NET}kbps` : ' · 회선 제한 없음'}`);
  if (BLOCK.length) console.log(`   막은 것: ${BLOCK.join(' , ')}`);
  console.log('─'.repeat(66));
  for (const [k, v] of Object.entries(marks).sort((a, b) => a[1] - b[1]))
    console.log(`  ${pad(k, 34)} ${padL((v / 1000).toFixed(2), 7)} s`);
  console.log(`  ${pad('(측정 종료)', 34)} ${padL((total / 1000).toFixed(2), 7)} s`);
  if (inner) {
    console.log('\n  방 뷰가 스스로 잰 이정표 (view.bootTimings · createRoomView 부른 순간이 0)');
    for (const [k, v] of Object.entries(inner).sort((a, b) => a[1] - b[1]))
      console.log(`    ${pad(k, 30)} ${padL((v / 1000).toFixed(2), 7)} s`);
  }

  /* ── ② 종류별 ── */
  const all = [...reqs.values()].filter(r => r.end != null);
  const by = new Map();
  for (const r of all) {
    const b = bucket(r.url);
    const o = by.get(b) || { n: 0, bytes: 0, first: Infinity, last: 0 };
    o.n++; o.bytes += r.size; o.first = Math.min(o.first, r.start); o.last = Math.max(o.last, r.end);
    by.set(b, o);
  }
  console.log('\n  무엇을 받았나' + ' '.repeat(14) + '장수      크기     처음      마지막');
  console.log('  ' + '─'.repeat(64));
  const rows = [...by].sort((a, b) => b[1].bytes - a[1].bytes);
  for (const [k, o] of rows)
    console.log(`  ${pad(k, 26)} ${padL(o.n, 4)} ${padL(fmtMB(o.bytes), 10)} ${padL((o.first / 1000).toFixed(2), 8)}s ${padL((o.last / 1000).toFixed(2), 8)}s`);
  const sum = rows.reduce((a, [, o]) => ({ n: a.n + o.n, bytes: a.bytes + o.bytes }), { n: 0, bytes: 0 });
  console.log('  ' + '─'.repeat(64));
  console.log(`  ${pad('합계', 26)} ${padL(sum.n, 4)} ${padL(fmtMB(sum.bytes), 10)}`);

  /* ── ③ 무거운 것 ── */
  console.log('\n  제일 무거운 파일');
  for (const r of all.sort((a, b) => b.size - a.size).slice(0, 15))
    console.log(`   ${padL(fmtMB(r.size), 9)}  ${padL((r.start / 1000).toFixed(2), 6)}→${padL((r.end / 1000).toFixed(2), 6)}s  ${r.url.replace(/^https?:\/\/[^/]+\//, '')}`);

  const failed = [...reqs.values()].filter(r => r.failed || (r.status && r.status >= 400));
  if (failed.length) {
    console.log('\n  ★ 실패한 요청');
    for (const r of failed) console.log(`   ${r.status || ''} ${r.failed || ''}  ${r.url}`);
  }
  /* 같은 파일을 두 번 이상 받았나 — 제일 흔한 낭비다 */
  const seen = new Map();
  for (const r of all) seen.set(r.url, (seen.get(r.url) || 0) + 1);
  const dup = [...seen].filter(([, n]) => n > 1);
  if (dup.length) {
    console.log('\n  ★ 같은 파일을 여러 번 받았습니다');
    for (const [u, n] of dup.sort((a, b) => b[1] - a[1]).slice(0, 12))
      console.log(`   ${n}번  ${u.replace(/^https?:\/\/[^/]+\//, '')}`);
  } else console.log('\n  중복 다운로드 없음');
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
