/* _diag_tray — 재배판(sprout_tray)을 사서 가방 칸(#musunThumb)을 «진짜 마우스»로 누르면 무엇이 뜨나(5판: [확인] 바가 안 떴다) */
import { launch, sleep } from './test_cdp.mjs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8972';
const page = await launch({ width: 1770, height: 1188, dpr: 1 });
await page.goto(`${BASE}/game.html`);
await page.eval('localStorage.clear()', false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 150000, 300);
await sleep(3500);
const m = (type, x, y, buttons) => page.send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: 1 });
const tapAt = async (x, y) => { await m('mouseMoved', x, y, 0); await m('mousePressed', x, y, 1); await sleep(80); await m('mouseReleased', x, y, 0); await sleep(700); };
const clearDlg = async () => { for (let i = 0; i < 40; i++) { const t = await page.eval(`String(document.getElementById('stage').classList.contains('talking'))`); if (t !== 'true') return; await page.eval(`(()=>{ const x=document.getElementById('dlgBox'); if (x) x.click(); })()`, false); await sleep(150); } };
await clearDlg();
/* 첫 플레이 끄고(울타리) 재배판을 «준다»(상점 거치지 않고 재고에 넣는다 — 놓는 손만 본다) */
await page.eval(`(()=>{ const S=window.__S(); if (S.firstPlay) S.firstPlay.enabled=false; S.shop=S.shop||{stock:{},orders:[]}; S.shop.stock.sprout_tray=(S.shop.stock.sprout_tray||0)+1; S.shop.stock.siru=(S.shop.stock.siru||0)+1; window.__byeotHint&&window.__byeotHint(); window.__redraw(); })()`, false);
await sleep(800);
const dump = (tag) => page.eval(`(()=>{ const q=id=>{ const all=[...document.querySelectorAll('#'+id)]; return all.map(e=>{ const r=e.getBoundingClientRect(); return { w:Math.round(r.width), x:Math.round(r.left), y:Math.round(r.top), vis:getComputedStyle(e).display!=='none' && r.width>0 }; }); };
  const pc=document.getElementById('placeConfirm'); const pr=pc?pc.getBoundingClientRect():null;
  return JSON.stringify({ tag:${JSON.stringify('x')}.replace('x', ${JSON.stringify('')}) + ${JSON.stringify(tag)}, 무대:document.getElementById('stage').className, musunThumb:q('musunThumb'), cropThumb:q('cropThumb'),
    확인바: pr ? { w:Math.round(pr.width), vis: pc.style.display!=='none' && pr.width>0 } : null, 아래글:(document.getElementById('dropLabel')||{}).textContent, 배너:((document.getElementById('banner')||{}).textContent||'').trim().slice(0,60),
    가방칸:[...document.querySelectorAll('#bagGrid [data-potbag], #bagGrid .cell, #bagGrid img')].slice(0,8).map(e=>({ id:e.id, cls:e.className, pb:e.dataset&&e.dataset.potbag, w:Math.round(e.getBoundingClientRect().width) })) }); })()`);
/* 가방 탭 */
await page.eval(`(()=>{ const t=document.getElementById('tabBag')||document.getElementById('openBag'); if(t) t.click(); })()`, false); await sleep(600);
console.log('■ 가방 연 뒤 —', await dump('bag'));
const at = JSON.parse(await page.eval(`(()=>{ const all=[...document.querySelectorAll('#musunThumb')]; const b=all.find(e=>e.getBoundingClientRect().width>0); if(!b) return 'null'; const r=b.getBoundingClientRect(); return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2}); })()`));
console.log('■ 누를 점 —', JSON.stringify(at));
if (at) { await tapAt(at.x, at.y); await sleep(900); console.log('■ 재배판 칸 누른 뒤 —', await dump('tap')); }
const at2 = JSON.parse(await page.eval(`(()=>{ const all=[...document.querySelectorAll('#cropThumb')]; const b=all.find(e=>e.getBoundingClientRect().width>0); if(!b) return 'null'; const r=b.getBoundingClientRect(); return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2}); })()`));
if (at2) { await page.eval(`(()=>{ const c=document.getElementById('placeCancel'); if(c) c.click(); })()`, false); await sleep(400); await tapAt(at2.x, at2.y); await sleep(900); console.log('■ (견줌) 시루 칸 누른 뒤 —', await dump('siru')); }
await page.close();
