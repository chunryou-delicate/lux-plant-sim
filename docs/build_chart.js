#!/usr/bin/env node
/*
 * 볕 · 몬스테라 성장 순서도 빌드 스크립트
 * byeot_growth_chart.jsx  →  byeot_growth_chart.html (자립본, CDN/브라우저Babel 없음)
 *
 * 실행:  node docs/build_chart.js     (레포 어디서든)
 *
 * 하는 일:
 *  1) JSX를 빌드타임에 순수 JS(React.createElement)로 변환 → 브라우저 Babel 불필요
 *  2) react/react-dom 는 docs/vendor/ 로컬 파일 사용(외부 CDN 0)
 *  3) 50스텝 데이터(byeot_with_branches.json)를 HTML에 내장 → fetch 불필요, 파일 더블클릭도 열림
 *
 * babel(@babel/standalone, 3MB)은 커밋하지 않고 빌드 시 임시폴더에 1회 다운로드(캐시)해서 사용.
 * jsx의 로드 useEffect(아래 OLD_LOAD)를 바꾸면 매칭이 깨지니 그때 OLD_LOAD도 같이 갱신할 것.
 */
const fs = require("fs"), path = require("path"), os = require("os"), https = require("https");

const DIR = __dirname;
const BABEL_URL = "https://cdn.jsdelivr.net/npm/@babel/standalone@7/babel.min.js";
const BABEL_CACHE = path.join(os.tmpdir(), "babel-standalone-7.min.js");

// jsx 원본의 로드 useEffect(변환 대상). jsx에서 이 블록이 바뀌면 여기도 맞춰 수정.
const OLD_LOAD = `        const r = await window.storage.get(STORE_KEY);
        if (r?.value) {
          const d = JSON.parse(r.value);
          if (d.tree?.nodes?.[d.tree.root]) { setTree(d.tree); setCur(d.cur && d.tree.nodes[d.cur] ? d.cur : d.tree.root); }
          if (d.prob) setProb({ ...DEFAULT_PROB, ...d.prob });
          if (d.hist) hist.current = d.hist; // 되돌리기 기록 복원
        }`;
// fetch 대신 내장 데이터(window.__CHART_DATA__) 사용
const NEW_LOAD = `        const r = await window.storage.get(STORE_KEY);
        let d = r?.value ? JSON.parse(r.value) : null;
        if (!d || !d.tree) { d = (typeof window !== "undefined" && window.__CHART_DATA__) || null; }
        if (d && d.tree?.nodes?.[d.tree.root]) { setTree(d.tree); setCur(d.cur && d.tree.nodes[d.cur] ? d.cur : d.tree.root); }
        if (d && d.prob) setProb({ ...DEFAULT_PROB, ...d.prob });
        if (d && d.hist) hist.current = d.hist;`;

function getBabel() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(BABEL_CACHE) && fs.statSync(BABEL_CACHE).size > 1e6) return resolve(BABEL_CACHE);
    console.log("babel 다운로드(빌드용, 1회 캐시)…");
    const f = fs.createWriteStream(BABEL_CACHE);
    https.get(BABEL_URL, (res) => {
      if (res.statusCode !== 200) { reject(new Error("babel 다운로드 실패 " + res.statusCode)); return; }
      res.pipe(f); f.on("finish", () => f.close(() => resolve(BABEL_CACHE)));
    }).on("error", (e) => { try { fs.unlinkSync(BABEL_CACHE); } catch (_) {} reject(e); });
  });
}

(async () => {
  const Babel = require(await getBabel());

  let jsx = fs.readFileSync(path.join(DIR, "byeot_growth_chart.jsx"), "utf8");
  jsx = jsx.replace(/^import React[^\n]*\n/, "");
  jsx = jsx.replace(/export default function App\(/, "function App(");
  if (!jsx.includes(OLD_LOAD)) { console.error("!! 로드 블록 매칭 실패 — jsx의 로드 useEffect가 바뀜? build_chart.js의 OLD_LOAD를 맞춰 수정하세요."); process.exit(1); }
  jsx = jsx.replace(OLD_LOAD, NEW_LOAD);
  jsx = jsx.replace(/maxWidth: 1150/, "maxWidth: 1400");
  jsx = jsx.replace(/maxHeight: "58vh"/, 'maxHeight: "74vh"');

  let code;
  try { code = Babel.transform(jsx, { presets: ["react"] }).code; }
  catch (e) { console.error("!! JSX 변환 오류:", e.message); process.exit(1); }

  const data = fs.readFileSync(path.join(DIR, "byeot_with_branches.json"), "utf8");

  const html = `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>볕 · 몬스테라 성장 순서도</title>
<style>*{box-sizing:border-box} html,body{margin:0;background:#F4F2EB;min-height:100%} #root{min-height:100vh}</style>
</head><body>
<div id="root">불러오는 중…</div>
<script src="./vendor/react.min.js"></script>
<script src="./vendor/react-dom.min.js"></script>
<script>
window.storage = { get: async(k)=>({ value: localStorage.getItem(k) }), set: async(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
window.__CHART_DATA__ = ${data};
</script>
<script>
try {
const { useState, useMemo, useRef, useEffect } = React;
${code}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
} catch(err){ document.getElementById("root").innerHTML = "<pre style='color:#c0392b;padding:16px;white-space:pre-wrap;font:13px monospace'>오류:\\n"+(err&&err.stack||err)+"</pre>"; }
</script>
</body></html>
`;
  fs.writeFileSync(path.join(DIR, "byeot_growth_chart.html"), html);
  console.log("빌드 완료: docs/byeot_growth_chart.html (" + Math.round(html.length / 1024) + "KB) — CDN/Babel 없음, react 로컬, 데이터 내장");
})().catch((e) => { console.error("빌드 실패:", e.message); process.exit(1); });
