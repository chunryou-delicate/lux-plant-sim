// 사용: node cdp_close.mjs <포트> — 그 포트 크롬에 CDP Browser.close(점잖게 끔 · 프로필은 안 지움)
const port = process.argv[2];
if (!/^\d+$/.test(port || '')) { console.log('포트 없음'); process.exit(2); }
try {
  const v = await (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(5000) })).json();
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; setTimeout(() => j(new Error('ws 열림 5초 넘음')), 5000); });
  ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
  await new Promise((r) => setTimeout(r, 3000));
  console.log(`closed ${port}`);
  process.exit(0);
} catch (e) {
  console.log(`close ${port} 탈: ${(e && e.message) || e}`);
  process.exit(1);
}
