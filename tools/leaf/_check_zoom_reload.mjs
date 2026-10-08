/* tools/leaf/_check_zoom_reload.mjs — «세이브로 다시 켜면 확대 창이 방과 같은 무늬 그림을 그리나» ([leaf] 10-08)
   SAVE= 세이브 파일(_make_oneroom_save.mjs 가 뜬 것 · 필수) · OUTD= 찍을 곳(필수) · BYEOT_URL=(기본 127.0.0.1:9340 · 서버는 tools/serve.py)
   재는 것: 켠 직후 · 13초 뒤 · 확대 창 열고 12초 → window.__leafGrades()(= noteTurn 이 날마다 부르는 noteLeafGrades) 뒤 3·10·20초
   각 때 «확대 창이 고른 열쇠(leafSkinUsedAll)» 와 «방이 쥔 열쇠(leafSkinsInRoom)» 를 무늬 잎마다 견준다.
   ⚠ leafSkinUsedAll 의 key 는 그림이 아직 안 왔으면 기본잎(leaf_mid2·leaf_mature)으로 떨어진다(plant_grow §leafSkinUsedAll) — 3초 줄이 그것이다 */
import fs from 'node:fs';
import { launch, sleep } from '../test_cdp.mjs';
if (!process.env.SAVE || !process.env.OUTD) { console.error('⛔ SAVE= OUTD='); process.exit(2); }
const SAVE = fs.readFileSync(process.env.SAVE,'utf8'), BASE = process.env.BYEOT_URL || 'http://127.0.0.1:9340';
const page = await launch({ width: 390, height: 844, dpr: 1 });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{ if(!sessionStorage.__c){ localStorage.clear(); localStorage.setItem('byeot/save/1', ${JSON.stringify(SAVE)}); sessionStorage.__c='1'; } }catch(e){}` });
await page.goto(`${BASE}/game.html`);
let ok=false; for (let i=0;i<100;i++){ await sleep(3000); const r=JSON.parse(await page.eval(`JSON.stringify({rv:!!window.__rv, boot:(document.getElementById('bootMsg')||{}).textContent||null, rs:document.readyState, url:location.href})`)); if (r.rv){ok=true;console.log('켜짐',i*3+3,'초');break;} if(i%10===0) console.log('  …',i*3+3,JSON.stringify(r)); }
if(!ok){ console.log('안 섬'); await page.close(); process.exit(4); }
await sleep(5000);
const J = async (js) => JSON.parse(await page.eval(`(async()=>{ try { return JSON.stringify(await (${js})); } catch(e) { return JSON.stringify({탈:e.message}); } })()`, true, 120000));
const cmp = () => J(`(async()=>{ const z=window.__io.growth.leafSkinUsedAll(), r=window.__rv.leafSkinsInRoom(); const rm=new Map((r||[]).map(x=>[x.leafBirth,x.key]));
  return (z||[]).filter(x=>x.varie).map(x=>x.leafBirth+':'+x.key+(x.key===rm.get(x.leafBirth)?' =':' ≠ 방 '+rm.get(x.leafBirth))); })()`);
console.log('켠 직후      ', JSON.stringify(await cmp()));
await sleep(8000);
console.log('13초 뒤      ', JSON.stringify(await cmp()));
const OUTD=process.env.OUTD; fs.mkdirSync(OUTD,{recursive:true});
const zbtn = await page.eval(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/확대|크게/.test(x.textContent||'')); if(b){b.click();return 'btn';} return 'none';})()`);
await sleep(12000);
console.log('확대 열고 12초 ('+zbtn+')', JSON.stringify(await cmp()));
await page.shot(OUTD+'/zoom_boot.png');
const g = await J(`(async()=>window.__leafGrades())()`);
for (const t of [3,10,20]) { await sleep(t===3?3000:t===10?7000:10000); console.log('__leafGrades 뒤 '+t+'초', JSON.stringify(await cmp())); }
await page.shot(OUTD+'/zoom_after_push.png');
await page.close(); process.exit(0);
