import { launch, sleep } from './test_cdp.mjs';
import fs from 'node:fs';
const BASE = process.env.BYEOT_URL || 'http://localhost:8963';
const page = await launch({ width: 390, height: 844, dpr: 2, mobile: false });
await page.goto(`${BASE}/game.html`);
await page.eval(`localStorage.clear()`, false);
await page.goto(`${BASE}/game.html`);
await page.waitFor('!!window.__rv', 180000, 300);
await page.waitFor('window.__byeotBooted === true', 180000, 300);
await sleep(9000);
await page.shot('docs/handoff/img/dark/room_day0.png');
const info = await page.eval(`(()=>{ const rv = window.__rv; const S = window.__S();
  return JSON.stringify({ day: S.day, lamps: S.lamps,
    daylight: rv && rv.daylightInfo ? rv.daylightInfo() : (rv && rv._dayPhase) || null,
    fns: rv ? Object.keys(rv).filter(k=>/light|day|lamp|expo|tone/i.test(k)) : null }); })()`);
console.log(info);
await page.close();
