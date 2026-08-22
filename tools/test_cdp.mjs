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

/* 헤드리스 크롬을 띄우고 CDP 소켓을 연다.
   opts.width/height  창 크기(폰 세로는 390×844)
   opts.dpr           devicePixelRatio (폰은 3 이지만 측정은 2 로 둔다)
   opts.throttle      { cpu, netKbps } 폰 흉내. 안 주면 데스크톱 그대로 */
export async function launch(opts = {}) {
  const chrome = findChrome();
  const port = 9222 + Math.floor(Math.random() * 400);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'byeot-cdp-'));
  const args = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--hide-scrollbars', '--mute-audio',
    /* ★ 소프트웨어 GL 을 강제한다. 헤드리스에서 GPU 가 없으면 WebGL 컨텍스트가
       아예 안 열려 방이 통째로 안 뜬다(실제로 안 떴다). */
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
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
    async goto(url) {
      const r = await S('Page.navigate', { url });
      if (r && r.errorText)
        throw new Error(`페이지를 못 열었습니다 — ${url} (${r.errorText})
` +
          `      서버가 떠 있는지 보십시오: python tools/serve.py <포트> · BYEOT_URL=http://localhost:<포트>`);
    },
    async eval(expr, awaitPromise = true) {
      const r = await S('Runtime.evaluate', {
        expression: expr, awaitPromise, returnByValue: true, allowUnsafeEvalBlockedByCSP: true
      });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' +
        (r.exceptionDetails.exception && r.exceptionDetails.exception.description || ''));
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
