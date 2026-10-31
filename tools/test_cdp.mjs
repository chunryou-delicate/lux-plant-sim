/* ============================================================
   tools/test_cdp.mjs — 헤드리스 크롬을 붙잡는 최소 도구
   ------------------------------------------------------------
   puppeteer 를 안 쓴다. node 22 에 WebSocket 이 들어 있어서
   CDP(크롬 개발자 프로토콜)를 직접 말하면 의존성이 0 이다.

   쓰는 곳
     tools/test_boot_profile.mjs   부팅에 무엇이 몇 초 걸리는지 잰다
     tools/shot_roomview.mjs       데모를 실제로 찍는다

   ★ 왜 직접 짰나 — 이 저장소에는 node_modules 가 없다. 부팅이 느린 것을
     "짐작으로 고치지 마십시오"라는 지시라서 재는 도구가 먼저 필요했고,
     재려고 npm 의존성을 들이는 건 더 큰 비용이다.
============================================================ */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.CHROME_PATH
].filter(Boolean);

export function findChrome() {
  for (const c of CHROME_CANDIDATES) if (c && fs.existsSync(c)) return c;
  throw new Error('크롬을 못 찾았습니다 — CHROME_PATH 로 알려 주십시오');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ★★ 2026-10-31 총괄(박사님 «CPU 가 왤케 · 렉먹어») — **기본 GL 을 그래픽카드(ANGLE d3d11)로 바꿨다.**
     ⛔ swiftshader(소프트웨어 GL)는 game.html 390×844 에서 14fps 에 크롬이 16코어의 61% 를 먹었다 — 검사 하나가 컴퓨터 전체를 100% 로 올려
       박사님 다른 프로그램이 버벅였다. d3d11 은 65fps · 크롬 CPU 거의 0%(총괄 잼 · 렌더러 «ANGLE (NVIDIA GeForce RTX 3090 … D3D11)»).
     · CDP_GL=soft(또는 swiftshader) 면 예전 소프트웨어 GL 로 띄운다(그래픽카드 없는 기계 · 옛 판과 같은 GL 로 견줄 때).
     · CDP_GL=gpu 는 예전처럼 그래픽카드(이제 기본과 같다).
     · ★ 그래픽카드로 WebGL 이 안 열리면(컨텍스트 null · 렌더러가 SwiftShader) **스스로 swiftshader 로 다시 띄운다** — 방이 통째로 안 뜨는 판을 막는다(아래 §launch).
     ⚠ 화면 사진의 픽셀을 세는 자 · 성능 전후 비교는 «같은 GL» 끼리 견준다(page.gl 에 무엇으로 떴는지 적힌다) */
const GL_ARGS = Object.freeze({
  gpu:  ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  soft: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
export function glWanted() {
  const v = String(process.env.CDP_GL || '').toLowerCase();
  return (v === 'soft' || v === 'swiftshader' || v === 'software') ? 'soft' : 'gpu';
}
/* WebGL 렌더러 이름 — 컨텍스트가 안 열리면 null */
const GL_PROBE = `(()=>{ try { const c=document.createElement('canvas'); const gl=c.getContext('webgl2')||c.getContext('webgl'); if(!gl) return null;
  const d=gl.getExtension('WEBGL_debug_renderer_info'); return String(d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch(e) { return null; } })()`;

/* 헤드리스 크롬을 띄우고 CDP 소켓을 연다.
   opts.width/height  창 크기(폰 세로는 390×844)
   opts.dpr           devicePixelRatio (폰은 3 이지만 측정은 2 로 둔다)
   opts.throttle      { cpu, netKbps } 폰 흉내. 안 주면 데스크톱 그대로
   돌려받는 page.gl = 'gpu' | 'soft' · page.glRenderer = WebGL 렌더러 이름 */
export async function launch(opts = {}) {
  const want = glWanted();
  const page = await launchGL(opts, want);
  let r = null; try { r = await page.eval(GL_PROBE, false); } catch { r = null; }
  if (want === 'gpu' && (!r || /swiftshader/i.test(r))) {
    console.warn(`[test_cdp] 그래픽카드로 WebGL 이 안 열려(${r || '컨텍스트 없음'}) swiftshader 로 다시 띄웁니다`);
    await page.close();
    const p2 = await launchGL(opts, 'soft');
    let r2 = null; try { r2 = await p2.eval(GL_PROBE, false); } catch { r2 = null; }
    p2.gl = 'soft'; p2.glRenderer = r2;
    return p2;
  }
  page.gl = want; page.glRenderer = r;
  return page;
}
async function launchGL(opts, gl) {
  const chrome = findChrome();
  const port = 9222 + Math.floor(Math.random() * 400);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'byeot-cdp-'));
  const args = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--hide-scrollbars', '--mute-audio',
    /* ★ GL — 기본 그래픽카드(d3d11) · CDP_GL=soft 면 소프트웨어(swiftshader). 헤드리스에서 GL 이 아예 없으면 WebGL 컨텍스트가
       안 열려 방이 통째로 안 뜬다(실제로 안 떴다) — 그래서 §launch 가 그래픽카드로 안 열리면 소프트웨어로 다시 띄운다(2026-10-31) */
    ...GL_ARGS[gl === 'soft' ? 'soft' : 'gpu'],
    `--window-size=${opts.width || 390},${opts.height || 844}`,
    'about:blank'
  ];
  const proc = spawn(chrome, args, { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    await sleep(150);
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      wsUrl = (await r.json()).webSocketDebuggerUrl;
    } catch { /* 아직 안 떴다 */ }
  }
  if (!wsUrl) { proc.kill(); throw new Error('크롬이 안 떴습니다'); }

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP 소켓 실패')); });

  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id != null) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (!p) return;
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    } else {
      for (const fn of listeners) { try { fn(m.method, m.params, m.sessionId); } catch { } }
    }
  };
  const send = (method, params, sessionId) => new Promise((res, rej) => {
    const my = ++id;
    pending.set(my, { res, rej });
    ws.send(JSON.stringify({ id: my, method, params: params || {}, sessionId }));
  });

  /* 탭 하나를 잡고 세션을 연다 */
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (method, params) => send(method, params, sessionId);

  await S('Page.enable');
  await S('Runtime.enable');
  await S('Network.enable');
  await S('Log.enable');
  await S('Emulation.setDeviceMetricsOverride', {
    width: opts.width || 390, height: opts.height || 844,
    deviceScaleFactor: opts.dpr || 2, mobile: !!opts.mobile
  });
  if (opts.throttle) {
    if (opts.throttle.cpu) await S('Emulation.setCPUThrottlingRate', { rate: opts.throttle.cpu });
    if (opts.throttle.netKbps) await S('Network.emulateNetworkConditions', {
      offline: false, latency: opts.throttle.latency ?? 40,
      downloadThroughput: opts.throttle.netKbps * 1024 / 8,
      uploadThroughput: opts.throttle.netKbps * 1024 / 8
    });
  }

  const page = {
    on(fn) { listeners.push(fn); },
    send: S,
    /* ★★ 2026-08-23 — **못 붙었으면 그 자리에서 죽는다** ([growth]).
       예전에는 `Page.navigate` 의 답을 버렸다. 그런데 크롬은 **연결이 거부돼도 성공으로 답하고**
       `errorText` 에만 사유를 담는다(`net::ERR_CONNECTION_REFUSED`). 그래서 서버가 없으면
       검사가 **안 죽고 그 다음 `waitFor` 의 제한시간을 통째로 태웠다** — 기본 600초라 하나에 10분이다.
       ⇒ 서버 없이 스위트를 돌리면 일곱 개가 **70분**을 쓰고 나서야 「기다리다 지쳤습니다」라고 했다.
         원인은 서버인데 화면은 조건 이야기를 한다. 제일 늦게 알아채는 종류다.
       ⚠ 잡는 것은 **연결 자체가 안 되는 경우**뿐이다. 404 는 크롬이 「열었다」고 보므로 여기서 안 잡힌다
         (빈 디렉터리를 서빙하는 서버가 실제로 있다 — 2026-08-23 [core]). 그건 검사가 제 조건으로 잡아야 한다. */
    /* ★★ 2026-10-24 [core] 총괄(house 2d5a8046 가름) — **이동이 끝날 때까지 기다린다.**
       예전 goto 는 `Page.navigate` 의 답(이동을 «시작»했다)만 받고 돌아왔다. 바로 뒤 eval 이 옛 문서가 사라지는 순간과 겹치면
       CDP 답에 result 가 없어 TypeError 로 죽었다(test_cutaway_shared_mat — 묶음 다섯 판 중 한 판 · 첫 ok 앞 · 출력 없음).
       ⇒ 새 문서가 붙고(Page.frameNavigated · 같은 loaderId) 그 문서의 기본 실행 맥락이 선 뒤(Runtime.executionContextCreated)에 돌아온다.
         load 까지는 안 기다린다 — 게임은 부팅이 길어 검사마다 제 조건(waitFor)으로 잰다. 같은 문서 안 이동(# 만 바뀜)은 loaderId 가 없어 바로 돌아온다.
       ⚠ 제한(기본 60초) 안에 안 붙으면 던진다 — 조용히 넘어가면 다음 eval 이 엉뚱한 문서를 잰다 */
    async goto(url, { timeout = 60000 } = {}) {
      const seen = { nav: new Set(), ctx: new Set() };
      const fn = (method, p, sid) => {
        if (sid !== sessionId || !p) return;
        if (method === 'Page.frameNavigated' && p.frame && !p.frame.parentId) seen.nav.add(p.frame.loaderId);
        if (method === 'Runtime.executionContextCreated' && p.context && p.context.auxData && p.context.auxData.isDefault)
          seen.ctx.add(p.context.auxData.frameId);
      };
      listeners.push(fn);
      try {
        const r = await S('Page.navigate', { url });
        if (r && r.errorText)
          throw new Error(`페이지를 못 열었습니다 — ${url} (${r.errorText})
` +
            `      서버가 떠 있는지 보십시오: python tools/serve.py <포트> · BYEOT_URL=http://localhost:<포트>`);
        if (!r || !r.loaderId) return;
        const t0 = Date.now();
        while (!(seen.nav.has(r.loaderId) && seen.ctx.has(r.frameId))) {
          if (Date.now() - t0 > timeout)
            throw new Error(`페이지가 ${timeout}ms 안에 안 넘어갔습니다 — ${url} ` +
                            `(새 문서 ${seen.nav.has(r.loaderId) ? '붙음' : '안 붙음'} · 실행 맥락 ${seen.ctx.has(r.frameId) ? '섬' : '안 섬'})`);
          await sleep(20);
        }
      } finally { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }
    },
    async eval(expr, awaitPromise = true) {
      const r = await S('Runtime.evaluate', {
        expression: expr, awaitPromise, returnByValue: true, allowUnsafeEvalBlockedByCSP: true
      });
      if (r && r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' +
        (r.exceptionDetails.exception && r.exceptionDetails.exception.description || ''));
      /* ★ 10-24 — 답에 result 가 없으면(문서가 바뀌는 순간 등) 읽을 수 있는 말로 던진다(예전엔 «reading 'value'» TypeError) */
      if (!r || !r.result) throw new Error(`eval 답에 result 가 없습니다(문서가 바뀌는 중이었나) — ${String(expr).slice(0, 80)}`);
      return r.result.value;
    },
    /* 조건이 참이 될 때까지 기다린다. 틀리면 왜 안 됐는지 남긴다. */
    async waitFor(expr, ms = 60000, every = 200) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        let v = null;
        try { v = await page.eval(`(()=>{ try{ return (${expr}); }catch(e){ return null; } })()`, false); }
        catch { v = null; }
        if (v) return Date.now() - t0;
        await sleep(every);
      }
      throw new Error(`기다리다 지쳤습니다(${ms}ms): ${expr}`);
    },
    async shot(file) {
      const r = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    },
    async close() { try { ws.close(); } catch { } proc.kill(); await sleep(200);
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { } }
  };
  return page;
}

export { sleep };
