/* tools/probe_qa_boot.mjs — 배포본을 띄워 무엇이 있는지 살핀다 (QA 전용, 읽기만) */
import { launch, sleep } from './test_cdp.mjs';

const _WATCHDOG_MS = +(process.env.BYEOT_PROBE_TIMEOUT_MS || 420000);
const _wd = setTimeout(() => { console.error('⏱ 자가 제한을 넘겨 멈춥니다.'); process.exit(2); }, _WATCHDOG_MS);
_wd.unref && _wd.unref();
process.on('exit', () => clearTimeout(_wd));

const BASE = process.env.BYEOT_URL || 'https://chunryou-delicate.github.io/lux-plant-sim';
const CPU = +(process.env.QA_CPU || 1);
const OUT = 'docs/engine/shots/qa';

const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false,
  throttle: CPU > 1 ? { cpu: CPU } : null });

const errs = [], logs = [], net = [];
page.on((m, p) => {
  if (m === 'Runtime.exceptionThrown')
    errs.push((p.exceptionDetails.text || '') + ' ' + ((p.exceptionDetails.exception || {}).description || ''));
  if (m === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(p.type))
    logs.push(p.type + ': ' + (p.args || []).map(a => a.value ?? a.description ?? a.type).join(' '));
  if (m === 'Log.entryAdded' && ['error', 'warning'].includes(p.entry.level))
    logs.push('LOG/' + p.entry.level + ': ' + p.entry.text + ' ' + (p.entry.url || ''));
  if (m === 'Network.loadingFailed') net.push('실패 ' + p.errorText + ' ' + (p.type || ''));
  if (m === 'Network.responseReceived' && p.response.status >= 400)
    net.push(p.response.status + ' ' + p.response.url);
});

const t0 = Date.now();
await page.goto(`${BASE}/game.html`);
await sleep(2500);
await page.eval(`(()=>{try{localStorage.clear()}catch(e){}})()`, false);
await page.goto(`${BASE}/game.html`);
let bootMs = -1;
try { await page.waitFor('!!window.__rv', 180000, 300); bootMs = Date.now() - t0; }
catch (e) { console.log('!! __rv 안 뜸:', e.message); }
console.log('CPU x' + CPU + ' 부팅ms(2회차 포함)', bootMs);
await sleep(4000);

const probe = await page.eval(`(()=>{
  const keys = Object.keys(window).filter(k=>/^__/.test(k));
  const btn = [...document.querySelectorAll('button')].map(b=>({
    id:b.id||null, t:(b.textContent||'').trim().slice(0,16),
    dis:b.disabled, vis:b.offsetParent!==null }));
  let S=null; try{ S=window.__S(); }catch(e){ S={err:String(e)} }
  return { keys, btn: btn.filter(b=>b.id),
    talking: document.getElementById('stage').className,
    quest: (document.getElementById('quest')||{}).textContent,
    S: S && { day:S.day, money:S.money, pots:(S.pots||[]).length,
              room:S.room, keys:Object.keys(S) } };
})()`);
console.log(JSON.stringify(probe, null, 1));
await page.shot(`${OUT}/boot_cpu${CPU}.png`);

console.log('\n예외', JSON.stringify(errs.slice(0, 8), null, 1));
console.log('콘솔', JSON.stringify(logs.slice(0, 20), null, 1));
console.log('네트워크', JSON.stringify([...new Set(net)].slice(0, 20), null, 1));
await page.close();
