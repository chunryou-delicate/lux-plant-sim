import React, { useState, useMemo, useRef, useEffect } from "react";

// ══════════════════════════════════════════════════════════
// 볕 · 몬스테라 성장 순서도 (독립 도구)
// 원본 PPT 구조: 밑동 아래 고정 · 생장점 위로 · 왼→오 시간진행 · 위아래 가능성분기
// ══════════════════════════════════════════════════════════

const STORE_KEY = "byeot_growth_chart_v2";

// 줄기 상태 = 실제 3D 부품 5종
const STEM = {
  petiole: { label: "가는 잎자루", color: "#9BC48A", width: 4, pink: false, eye: false },
  pink:    { label: "분홍대기", color: "#DB8FB4", width: 7, pink: true,  eye: false },
  thin:    { label: "분홍대기", color: "#DB8FB4", width: 7, pink: true,  eye: false },
  med:     { label: "분홍대기", color: "#DB8FB4", width: 7, pink: true,  eye: false },
  thick:   { label: "눈 생김(활성)", color: "#DBB48A", width: 9, pink: false, eye: true },
  main:    { label: "희귀(하늘)", color: "#9BC4D8", width: 9, pink: false, eye: true },
};
// UI에 보이는 상태 (thin/med 통합)
const STEM_UI = ["petiole", "pink", "thick", "main"];


// 잎 성숙 단계
const LEAF = [
  { key: "furled", label: "새순", color: "#E8A838", shape: "bud" },
  { key: "opening", label: "펴짐", color: "#F2C94C", shape: "bud" },
  { key: "young", label: "어린잎", color: "#7AB55C", shape: "leaf" },
  { key: "mid", label: "중간잎", color: "#4A90D9", shape: "leaf" },
  { key: "mature", label: "성숙잎", color: "#8B5CF6", shape: "leafcut" },
];

const SPECIALS = [
  { key: "none", label: "일반", color: "#4A90D9" },
  { key: "albo", label: "알보(흰)", color: "#DCEBDC" },
  { key: "halfmoon", label: "하프문", color: "#A8D8B0" },
  { key: "galaxy", label: "갤럭시", color: "#2E4A3A" },
];
const specColor = (k) => (SPECIALS.find((s) => s.key === k) || SPECIALS[0]).color;

const DEFAULT_PROB = { mid1: 60, mature: 20, special: 8, matureSpecial: 25, doubleBud: 15 };

// ── 식물 모델 ──
// node: { id, up, buds[], stem, isTip, isSeed }  · root = 밑동
// bud: { stage, side, special, childNode, probOverride }
let _seq = 0;
const uid = (p) => p + (++_seq).toString(36) + Date.now().toString(36).slice(-2);

function newPlant() {
  return { nodes: { seed: { id: "seed", up: null, buds: [], stem: "petiole", isTip: true, isSeed: true } }, root: "seed" };
}
function newStepTree() {
  return { nodes: { s0: { id: "s0", parent: null, children: [], plant: newPlant(), col: 0, row: 0 } }, root: "s0" };
}

const SEG = 40;
// 밑동(root) y=0, 메인은 위로(y 감소). 가지는 우상향 대각선으로 뻗음.
function layoutPlant(plant) {
  const pos = {};
  // ang: 진행 방향 각도(라디안). 메인 줄기는 위(0), 가지는 우상향.
  const walk = (id, x, y, ang) => {
    const n = plant.nodes[id];
    if (!n) return;
    pos[id] = { x, y };
    // 위(up) 방향 = 현재 각도로 계속
    if (n.up) walk(n.up, x + Math.sin(ang) * SEG, y - Math.cos(ang) * SEG, ang);
    // 가지(childNode) = 우상향으로 갈라짐. 눈(빨간점)에서 나오므로 시작점을 몸통 중간(아래쪽)으로
    const s = STEM[n.stem];
    (n.buds || []).forEach((b) => {
      if (b.childNode) {
        // 눈 마디면 빨간 점 위치(몸통 중간 = 진행방향 반대로 반 마디)에서 가지 시작
        let bx = x, by = y;
        if (s?.eye) { bx = x - Math.sin(ang) * SEG / 2; by = y + Math.cos(ang) * SEG / 2; pos[id + "_eye"] = { x: bx, y: by }; }
        const side = b.side || 1;
        const branchAng = ang + side * 0.6;
        walk(b.childNode, bx + Math.sin(branchAng) * SEG, by - Math.cos(branchAng) * SEG, branchAng);
      }
    });
  };
  walk(plant.root, 0, 0, 0);
  return pos;
}
const findTip = (plant) => Object.values(plant.nodes).find((n) => n.isTip);
// 특정 마디에서 up을 따라가 그 사슬의 생장점(끝)을 찾음
const tipOfChain = (plant, startId) => {
  let cur = plant.nodes[startId];
  const seen = new Set();
  while (cur && cur.up && !seen.has(cur.id)) { seen.add(cur.id); cur = plant.nodes[cur.up]; }
  return cur;
};
const bounds = (pos) => {
  const ps = Object.values(pos);
  if (!ps.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  return {
    minX: Math.min(...ps.map((p) => p.x)), maxX: Math.max(...ps.map((p) => p.x)),
    minY: Math.min(...ps.map((p) => p.y)), maxY: Math.max(...ps.map((p) => p.y)),
  };
};

const clone = (o) => JSON.parse(JSON.stringify(o));

// ── 잎 그리기 ──
function LeafShape({ x, y, stage, special, selected }) {
  const st = LEAF[stage] || LEAF[0];
  const col = special && special !== "none" && stage >= 3 ? specColor(special) : st.color;
  const stroke = selected ? "#7F77DD" : st.shape === "bud" ? "#7A5A10" : st.shape === "leafcut" ? "#4B2E83" : "#2C5A1A";
  const sw = selected ? 2 : 0.7;
  if (st.shape === "bud") return <ellipse cx={x} cy={y} rx={4.5} ry={8} fill={col} stroke={stroke} strokeWidth={sw} />;
  if (st.shape === "leafcut")
    return <path d={`M${x} ${y-10} Q ${x+11} ${y-3} ${x+6} ${y+7} L ${x+2} ${y+3} L ${x} ${y+8} L ${x-2} ${y+3} L ${x-6} ${y+7} Q ${x-11} ${y-3} ${x} ${y-10} Z`} fill={col} stroke={stroke} strokeWidth={sw} />;
  return <path d={`M${x} ${y-10} Q ${x+10} ${y-1} ${x} ${y+8} Q ${x-10} ${y-1} ${x} ${y-10} Z`} fill={col} stroke={stroke} strokeWidth={sw} />;
}

// ── 식물 렌더 ──
function PlantSVG({ plant, pos, editable, sel, onPick }) {
  const nodes = Object.values(plant.nodes);
  return (
    <g>
      {/* 줄기 — 선(n→n.up)은 위 마디(n.up)의 몸통 */}
      {nodes.map((n) => {
        if (!n.up || !pos[n.id] || !pos[n.up]) return null;
        const a = pos[n.id], b = pos[n.up];
        const up = plant.nodes[n.up];
        const s = STEM[up?.stem] || STEM.petiole;
        const isSel = editable && sel?.type === "stem" && sel.id === n.up;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        return (
          <g key={"st" + n.id} onClick={editable ? (e) => { e.stopPropagation(); onPick({ type: "stem", id: n.up }); } : undefined} style={{ cursor: editable ? "pointer" : "default" }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={16} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={isSel ? "#7F77DD" : s.color} strokeWidth={s.width + (isSel ? 2 : 0)} strokeLinecap="round" />
            {s.eye && (
              <g onClick={editable ? (e) => { e.stopPropagation(); onPick({ type: "stem", id: n.up }); } : undefined} style={{ cursor: editable ? "pointer" : "default" }}>
                <circle cx={mx} cy={my} r={9} fill="transparent" />
                <circle cx={mx} cy={my} r={3.5} fill="#D0453A" stroke="#8A2A22" strokeWidth={0.6} />
              </g>
            )}
            {s.pink && <circle cx={mx} cy={my} r={2.5} fill="#E86FA8" />}
          </g>
        );
      })}
      {/* 가지 연결선 — 혹→가지첫마디. 이 선이 가지 첫 마디의 몸통(클릭=선택) */}
      {nodes.map((n) => (n.buds || []).map((b, bi) => {
        if (!b.childNode || !pos[n.id] || !pos[b.childNode]) return null;
        const a = pos[n.id], c = pos[b.childNode];
        const s = STEM[n.stem];
        let sx = a.x, sy = a.y;
        if (s?.eye && pos[n.id + "_eye"]) { sx = pos[n.id + "_eye"].x; sy = pos[n.id + "_eye"].y; }
        const child = plant.nodes[b.childNode];
        const cs = STEM[child?.stem] || STEM.petiole;
        const isSel = editable && sel?.type === "stem" && sel.id === b.childNode;
        const mx = (sx + c.x) / 2, my = (sy + c.y) / 2;
        return (
          <g key={"br" + n.id + bi} onClick={editable ? (e) => { e.stopPropagation(); onPick({ type: "stem", id: b.childNode }); } : undefined} style={{ cursor: editable ? "pointer" : "default" }}>
            <line x1={sx} y1={sy} x2={c.x} y2={c.y} stroke="transparent" strokeWidth={16} />
            <line x1={sx} y1={sy} x2={c.x} y2={c.y} stroke={isSel ? "#7F77DD" : cs.color} strokeWidth={cs.width + (isSel ? 2 : 0)} strokeLinecap="round" />
            {cs.eye && <circle cx={mx} cy={my} r={3} fill="#D0453A" stroke="#8A2A22" strokeWidth={0.6} />}
            {cs.pink && <circle cx={mx} cy={my} r={2.5} fill="#E86FA8" />}
          </g>
        );
      }))}
      {/* 잎 + 마디 */}
      {nodes.map((n) => {
        const p = pos[n.id];
        if (!p) return null;
        return (
          <g key={n.id}>
            {(n.buds || []).map((b, bi) => {
              if (b.childNode) return null;
              // 생장점(맨 위)의 새순은 위로 곧게, 중간 마디의 잎은 옆으로
              const straight = n.isTip && n.buds.length === 1;
              const lx = straight ? p.x : p.x + (b.side || 1) * (14 + bi * 3);
              const ly = straight ? p.y - 16 : p.y - 2 - bi * 6;
              const bSel = editable && sel?.type === "bud" && sel.id === n.id && sel.bi === bi;
              return (
                <g key={bi} onClick={editable ? (e) => { e.stopPropagation(); onPick({ type: "bud", id: n.id, bi }); } : undefined} style={{ cursor: editable ? "pointer" : "default" }}>
                  <line x1={p.x} y1={p.y} x2={lx} y2={ly} stroke="#8BA86B" strokeWidth={1.5} />
                  <LeafShape x={lx} y={ly} stage={b.stage} special={b.special} selected={bSel} />
                </g>
              );
            })}
            {(() => {
              const isSel = editable && sel?.type === "node" && sel.id === n.id;
              const click = editable ? (e) => { e.stopPropagation(); onPick({ type: "node", id: n.id }); } : undefined;
              const cur = { cursor: editable ? "pointer" : "default" };
              if (n.isSeed) return <ellipse cx={p.x} cy={p.y} rx={6} ry={8} fill={isSel ? "#7F77DD" : "#8A6A3A"} stroke="#5A4520" strokeWidth={1.5} onClick={click} style={cur} />;
              if (n.isTip) return <circle cx={p.x} cy={p.y} r={isSel ? 8 : 6} fill={isSel ? "#7F77DD" : "#4A78C8"} stroke="#2C4E7C" strokeWidth={1.5} onClick={click} style={cur} />;
              // 중간 마디 흰 원: 표시만, 클릭 비활성
              return <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke="#B98A5A" strokeWidth={1.5} style={{ pointerEvents: "none" }} />;
            })()}
          </g>
        );
      })}
    </g>
  );
}

export default function App() {
  const [tree, setTree] = useState(newStepTree);
  const [cur, setCur] = useState("s0");
  const [prob, setProb] = useState(DEFAULT_PROB);
  const [sel, setSel] = useState(null);
  const [panel, setPanel] = useState(null); // "prob" | "legend"
  const [loaded, setLoaded] = useState(false);
  const hist = useRef({ past: [], future: [] });

  // 로드
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORE_KEY);
        if (r?.value) {
          const d = JSON.parse(r.value);
          if (d.tree?.nodes?.[d.tree.root]) { setTree(d.tree); setCur(d.cur && d.tree.nodes[d.cur] ? d.cur : d.tree.root); }
          if (d.prob) setProb({ ...DEFAULT_PROB, ...d.prob });
          if (d.hist) hist.current = d.hist; // 되돌리기 기록 복원
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  const persist = (t, c, pr) => {
    try { window.storage.set(STORE_KEY, JSON.stringify({ tree: t, cur: c, prob: pr, hist: hist.current })); } catch (e) {}
  };
  const commit = (t, c) => {
    setTree(t); setCur(c); persist(t, c, prob);
  };
  // 되돌리기 = 현재(마지막) 스텝을 없애고 부모 스텝으로 이동
  const undo = () => {
    const node = tree.nodes[cur];
    if (!node || !node.parent) return; // 루트(s0)는 못 지움
    // 자식이 있으면 그 스텝은 중간 스텝 → 리프(자식 없는)만 삭제
    if ((node.children || []).length > 0) return;
    const t = clone(tree);
    const parent = t.nodes[node.parent];
    if (parent) parent.children = (parent.children || []).filter((id) => id !== cur);
    delete t.nodes[cur];
    setTree(t); setCur(node.parent); setSel(null); persist(t, node.parent, prob);
  };
  // 다시 = 사용 안 함(끝 스텝 삭제 방식이라)
  const redo = () => {};
  const [confirmReset, setConfirmReset] = useState(false);
  const resetAll = () => {
    if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 3000); return; }
    setConfirmReset(false);
    const t = newStepTree();
    hist.current = { past: [], future: [] };
    setTree(t); setCur("s0"); setSel(null); setProb(DEFAULT_PROB);
    persist(t, "s0", DEFAULT_PROB);
  };
  const fileRef = useRef(null);
  const [ioText, setIoText] = useState(null); // {mode:"export"|"import", text}
  const exportJSON = () => {
    const data = JSON.stringify({ version: 1, species: "monstera", tree, prob }, null, 2);
    setIoText({ mode: "export", text: data });
  };
  const openImport = () => setIoText({ mode: "import", text: "" });
  const [ioError, setIoError] = useState("");
  const doImport = (raw) => {
    try {
      const d = JSON.parse(raw);
      if (d.tree?.nodes?.[d.tree.root]) {
        hist.current = { past: [], future: [] };
        const c = d.cur && d.tree.nodes[d.cur] ? d.cur : d.tree.root;
        setTree(d.tree); setCur(c); setSel(null);
        const pr = d.prob ? { ...DEFAULT_PROB, ...d.prob } : prob;
        setProb(pr); persist(d.tree, c, pr);
        setIoText(null); setIoError("");
      } else { setIoError("올바른 순서도 데이터가 아닙니다."); }
    } catch (err) { setIoError("JSON 형식이 올바르지 않습니다."); }
  };

  const curNode = tree.nodes[cur] || tree.nodes[tree.root];
  const plant = curNode.plant;

  // 제자리 편집 (확률·특수·제거) — 시간진행 아님
  const editHere = (fn) => {
    const t = clone(tree);
    fn(t.nodes[cur].plant);
    commit(t, cur);
  };
  // 성장 = 자동으로 오른쪽 새 스텝
  const grow = (fn) => {
    const t = clone(tree);
    const c = t.nodes[cur];
    const np = clone(c.plant);
    fn(np);
    const id = uid("t");
    t.nodes[id] = { id, parent: cur, children: [], plant: np, col: (c.col || 0) + 1, row: c.row || 0 };
    c.children.push(id);
    commit(t, id);
  };
  // 가능성 분기 = 아래 새 갈래
  const branch = () => {
    const t = clone(tree);
    const c = t.nodes[cur];
    const sameCol = Object.values(t.nodes).filter((n) => (n.col || 0) === (c.col || 0));
    const maxRow = Math.max(...sameCol.map((n) => n.row || 0));
    const id = uid("b");
    t.nodes[id] = { id, parent: cur, children: [], plant: clone(c.plant), col: c.col || 0, row: maxRow + 1 };
    c.children.push(id);
    commit(t, id);
  };
  // 다음 단계 = 오른쪽 복제(수동)
  const nextStep = () => {
    const t = clone(tree);
    const c = t.nodes[cur];
    const id = uid("t");
    t.nodes[id] = { id, parent: cur, children: [], plant: clone(c.plant), col: (c.col || 0) + 1, row: c.row || 0 };
    c.children.push(id);
    commit(t, id);
  };

  // ── 식물 조작 ──
  const mk = () => ({ stage: 0, side: 1, special: "none", childNode: null });
  const germinate = () => grow((p) => {
    const seed = p.nodes[p.root];
    seed.isTip = false;
    // 씨앗에서 얇은 줄기(petiole)만 나옴. 새순은 다음 단계에서.
    const id = uid("m");
    p.nodes[id] = { id, up: null, buds: [], stem: "petiole", isTip: true };
    seed.up = id;
  });
  const growUp = (tipId) => grow((p) => {
    // tipId 지정 없으면 메인 생장점
    const tip = tipId ? p.nodes[tipId] : findTip(p);
    if (!tip || tip.isSeed || !tip.isTip) return;
    const id = uid("m");
    // tip을 up으로 가리키는 부모(줄기 사슬)
    const parent = Object.values(p.nodes).find((n) => n.up === tip.id);
    if (parent) { p.nodes[id] = { id, up: tip.id, buds: [], stem: "petiole" }; parent.up = id; return; }
    // tip을 childNode로 가리키는 혹(가지 뿌리)
    let budRef = null;
    for (const n of Object.values(p.nodes)) {
      const b = (n.buds || []).find((bd) => bd.childNode === tip.id);
      if (b) { budRef = b; break; }
    }
    if (budRef) { p.nodes[id] = { id, up: tip.id, buds: [], stem: "petiole" }; budRef.childNode = id; return; }
    // 그 외(메인 뿌리)
    p.nodes[id] = { id, up: tip.id, buds: [], stem: "petiole" }; p.root = id;
  });
  const addBud = (nid) => grow((p) => {
    const n = p.nodes[nid];
    // 순서도에선 항상 1혹만 그림. 더블혹은 확률로만 존재(참고), 성장 매커니즘은 동일해 분기 불필요.
    n.buds.push(mk());
    n.buds.forEach((b, i) => (b.side = i % 2 === 0 ? 1 : -1));
  });
  const growLeaf = (nid, bi) => grow((p) => {
    const b = p.nodes[nid].buds[bi];
    if (b.stage < LEAF.length - 1) b.stage++;
  });
  const budToBranch = (nid, bi) => grow((p) => {
    const id = uid("m");
    p.nodes[id] = { id, up: null, buds: [], stem: "petiole", isTip: true };
    p.nodes[nid].buds[bi].childNode = id;
  });
  const setStem = (nid, key) => grow((p) => { p.nodes[nid].stem = key; });
  const pinkRandom = (nid) => grow((p) => { p.nodes[nid].stem = "pink"; });
  const toNode = (nid, rare) => grow((p) => {
    p.nodes[nid].stem = rare ? "main" : "thick";
  });
  // 눈(빨간 혹)에서 가는 잎자루가 먼저 나옴 (새순은 다음 단계) — 씨앗 발아와 같은 순서
  const eyeToLeaf = (nid) => grow((p) => {
    const n = p.nodes[nid];
    n.isTip = false; // 눈은 옆으로 잎자루를 냈으니 더는 생장점 아님
    const id = uid("m");
    p.nodes[id] = { id, up: null, buds: [], stem: "petiole", isTip: true };
    n.buds = n.buds || [];
    n.buds.push({ stage: 0, side: n.buds.length % 2 === 0 ? 1 : -1, special: "none", childNode: id });
  });
  const removeNode = (nid) => editHere((p) => {
    if (p.nodes[nid]?.isTip || p.nodes[nid]?.isSeed) return;
    Object.values(p.nodes).forEach((n) => {
      if (n.up === nid) n.up = p.nodes[nid].up;
      (n.buds || []).forEach((b) => { if (b.childNode === nid) b.childNode = null; });
    });
    const rm = (id) => { const nn = p.nodes[id]; if (!nn) return; if (nn.up) rm(nn.up); (nn.buds || []).forEach((b) => b.childNode && rm(b.childNode)); delete p.nodes[id]; };
    rm(nid);
  });
  const setBudProb = (nid, bi, patch) => editHere((p) => { const b = p.nodes[nid].buds[bi]; b.probOverride = { ...(b.probOverride || {}), ...patch }; });
  const setBudSpecial = (nid, bi, sp) => editHere((p) => { p.nodes[nid].buds[bi].special = sp; });

  // ── 스텝 격자 배치 ──
  const CELL_W = 120, ROW_H = 250, GX = 12, GY = 12, TOP = 22;
  const cells = useMemo(() => {
    const all = Object.values(tree.nodes);
    const maxCol = Math.max(0, ...all.map((n) => n.col || 0));
    const maxRow = Math.max(0, ...all.map((n) => n.row || 0));
    const info = {};
    all.forEach((n) => {
      const pos = layoutPlant(n.plant);
      info[n.id] = { pos, b: bounds(pos) };
    });
    const colW = {};
    for (let c = 0; c <= maxCol; c++) {
      const inC = all.filter((n) => (n.col || 0) === c);
      colW[c] = Math.max(CELL_W, ...inC.map((n) => info[n.id].b.maxX - info[n.id].b.minX + 50));
    }
    const colX = {}; let ax = 20;
    for (let c = 0; c <= maxCol; c++) { colX[c] = ax; ax += colW[c] + GX; }
    // ── 트리 세로 배치(tidy): 잎(최종 분기)은 순차 행, 부모는 자식들 가운데로 → 분기가 아래로 자동 캐스케이드 ──
    const childrenOf = {}; all.forEach((n) => { childrenOf[n.id] = []; });
    all.forEach((n) => { if (n.parent && childrenOf[n.parent]) childrenOf[n.parent].push(n.id); });
    Object.keys(childrenOf).forEach((pid) => childrenOf[pid].sort((a, b) => {
      const na = tree.nodes[a], nb = tree.nodes[b];
      return ((na.row || 0) - (nb.row || 0)) || ((na.col || 0) - (nb.col || 0));   // 첫 분기(#_-1)가 위, 다음(#_-2)이 아래
    }));
    const rowY = {}; let leafRow = 0; const seenRow = new Set();
    const assignRow = (id) => {
      if (rowY[id] != null) return rowY[id];
      if (seenRow.has(id)) return (rowY[id] = leafRow++); seenRow.add(id);
      const kids = childrenOf[id] || [];
      if (!kids.length) return (rowY[id] = leafRow++);
      const rs = kids.map(assignRow);
      return (rowY[id] = (Math.min(...rs) + Math.max(...rs)) / 2);   // 부모 = 자식 범위의 중앙
    };
    assignRow(tree.root);
    all.forEach((n) => { if (rowY[n.id] == null) rowY[n.id] = leafRow++; });   // 혹시 누락 방지
    const maxRowY = Math.max(0, ...Object.values(rowY));
    const place = {};
    // 스텝 번호: col=시간. 팬아웃(부모가 다음칸에 자식 여럿)이면 #col-부모분기-자식(계보). 그 외 같은 col 여럿이면 -행순번.
    const byId = tree.nodes;
    const growChildren = (pid) => all.filter((x) => x.parent === pid && (x.col || 0) === (byId[pid].col || 0) + 1).sort((a, b) => (a.row || 0) - (b.row || 0));
    const sufOf = (lb) => { const m = /^#\d+(?:-(.+))?$/.exec(lb || ""); return m && m[1] ? m[1] : ""; };
    const labelOf = {};
    const compLabel = (n) => {
      if (labelOf[n.id]) return labelOf[n.id];
      labelOf[n.id] = "#" + ((n.col || 0) + 1); // 순환 방지 임시값
      const p = n.parent ? byId[n.parent] : null;
      let lb = null;
      if (p && (n.col || 0) === (p.col || 0) + 1) {
        const gs = growChildren(p.id);
        if (gs.length > 1) {                       // 팬아웃: 부모가 다음 칸에 여러 자식을 냄
          const ci = gs.findIndex((x) => x.id === n.id) + 1;
          const ps = sufOf(compLabel(p));          // 부모의 분기 접미사(#25-1 → "1")
          lb = "#" + ((n.col || 0) + 1) + (ps ? "-" + ps : "") + "-" + ci;
        }
      }
      if (!lb) {
        const inC = all.filter((x) => (x.col || 0) === (n.col || 0)).sort((a, b) => (a.row || 0) - (b.row || 0));
        lb = inC.length > 1 ? "#" + ((n.col || 0) + 1) + "-" + (inC.findIndex((x) => x.id === n.id) + 1) : "#" + ((n.col || 0) + 1);
      }
      labelOf[n.id] = lb; return lb;
    };
    for (let c = 0; c <= maxCol; c++) {
      all.filter((n) => (n.col || 0) === c).forEach((n) => {
        place[n.id] = { x: colX[c], y: TOP + rowY[n.id] * (ROW_H + GY), w: colW[c], info: info[n.id], label: compLabel(n) };
      });
    }
    return { place, w: Math.max(ax, 500), h: TOP + (maxRowY + 1) * (ROW_H + GY), maxCol, maxRow };
  }, [tree]);

  if (!loaded) return <div style={{ padding: 20, color: "#888", fontFamily: "system-ui" }}>불러오는 중…</div>;

  const selNode = sel?.type === "node" ? plant.nodes[sel.id] : null;
  const selStem = sel?.type === "stem" ? plant.nodes[sel.id] : null;
  const selBud = sel?.type === "bud" ? plant.nodes[sel.id]?.buds[sel.bi] : null;

  const G = "#E5E3DC", INK = "#2C2C2A", SUB = "#6B6A64";
  const btn = (bd, bg, fg) => ({ padding: "6px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: `1px solid ${bd}`, background: bg, color: fg });
  const ghost = { padding: "5px 11px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: `1px solid ${G}`, background: "#fff", color: SUB };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: INK, maxWidth: 1150, margin: "0 auto", padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 17, fontWeight: 600 }}>몬스테라 성장 순서도</span>
        <button onClick={undo} style={ghost}>↶ 마지막 스텝 삭제</button>
        <button onClick={resetAll} style={confirmReset ? btn("#E24B4A", "#FDECEC", "#A32D2D") : ghost}>{confirmReset ? "정말 초기화? (다시 클릭)" : "⟲ 초기화"}</button>
        <div style={{ flex: 1 }} />
        <button onClick={exportJSON} style={ghost}>⬇ 내보내기</button>
        <button onClick={openImport} style={ghost}>⬆ 불러오기</button>
        <button onClick={() => setPanel(panel === "legend" ? null : "legend")} style={btn("#5A8F3A", "#EAF3E4", "#3F6B26")}>📖 범례</button>
        <button onClick={() => setPanel(panel === "prob" ? null : "prob")} style={btn("#BA7517", "#FAEEDA", "#854F0B")}>⚙ 종 확률</button>
      </div>

      {ioText && (
        <div style={{ marginBottom: 10, padding: 12, border: "1px solid #4A90D9", borderRadius: 10, background: "#F5F9FD" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <b style={{ fontSize: 13, color: "#2B5C8F" }}>{ioText.mode === "export" ? "내보내기 — 아래 JSON을 전체 복사하세요" : "불러오기 — JSON을 붙여넣고 적용"}</b>
            <div style={{ flex: 1 }} />
            {ioText.mode === "export" && <button onClick={() => { try { navigator.clipboard.writeText(ioText.text); } catch (e) {} }} style={btn("#1D9E75", "#E1F5EE", "#0F6E56")}>📋 클립보드 복사</button>}
            {ioText.mode === "import" && <button onClick={() => doImport(ioText.text)} style={btn("#4A90D9", "#E7F0FA", "#2B5C8F")}>✓ 적용</button>}
            <button onClick={() => setIoText(null)} style={ghost}>닫기</button>
          </div>
          <textarea value={ioText.text} onChange={(e) => setIoText({ ...ioText, text: e.target.value })} readOnly={ioText.mode === "export"}
            onFocus={ioText.mode === "export" ? (e) => { try { e.target.select(); } catch (x) {} } : undefined}
            placeholder={ioText.mode === "import" ? "여기에 JSON을 붙여넣으세요" : ""}
            style={{ width: "100%", height: 140, fontFamily: "monospace", fontSize: 11, padding: 8, borderRadius: 7, border: "1px solid #CDD8E5", boxSizing: "border-box", resize: "vertical" }} />
          {ioError && <div style={{ fontSize: 12, color: "#C0392B", marginTop: 4 }}>{ioError}</div>}
          {ioText.mode === "export" && <div style={{ fontSize: 11, color: "#6B6A64", marginTop: 4 }}>텍스트 영역을 클릭하면 전체 선택됩니다. Ctrl/⌘+C로 복사해 파일로 저장하세요.</div>}
        </div>
      )}

      {panel === "prob" && (
        <div style={{ marginBottom: 10, padding: 12, border: "1px solid #BA7517", borderRadius: 10, background: "#FDFAF3" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#854F0B" }}>몬스테라 종 기본 확률 (지점 지정 없으면 이 값)</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[["mid1", "mid1 비율"], ["mature", "성숙 도달"], ["special", "mid 특수"], ["matureSpecial", "성숙 특수"], ["doubleBud", "더블혹(참고)"]].map(([k, l]) => (
              <label key={k} style={{ fontSize: 12, color: SUB }}>{l}(%)<br />
                <input type="number" min="0" max="100" value={prob[k]}
                  onChange={(e) => { const np = { ...prob, [k]: Math.max(0, Math.min(100, +e.target.value || 0)) }; setProb(np); persist(tree, cur, np); }}
                  style={{ width: 66, padding: "5px 8px", borderRadius: 7, border: `1px solid ${G}`, fontSize: 13, marginTop: 3 }} />
              </label>
            ))}
          </div>
        </div>
      )}
      {panel === "legend" && <Legend G={G} SUB={SUB} />}

      {/* 차트 */}
      <div style={{ overflow: "auto", maxHeight: "58vh", border: `1px solid ${G}`, borderRadius: 12, background: "#fff" }}>
        <svg viewBox={`0 0 ${cells.w} ${Math.max(cells.h, ROW_H + 40)}`} style={{ width: cells.w < 1000 ? "100%" : cells.w, height: Math.max(cells.h, ROW_H + 40), display: "block" }}>
          <defs><pattern id="g" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill={G} /></pattern></defs>
          <rect x="0" y="0" width={cells.w} height={Math.max(cells.h, ROW_H + 40)} fill="url(#g)" />
          {/* 연결선 */}
          {Object.values(tree.nodes).map((s) => (s.children || []).map((cid) => {
            const a = cells.place[s.id], b = cells.place[cid]; if (!a || !b) return null;
            const horiz = (tree.nodes[cid].col || 0) > (s.col || 0);
            return horiz
              ? <line key={s.id + cid} x1={a.x + a.w} y1={a.y + ROW_H / 2} x2={b.x} y2={b.y + ROW_H / 2} stroke="#9BC48A" strokeWidth={2} />
              : <line key={s.id + cid} x1={a.x + a.w / 2} y1={a.y + ROW_H} x2={b.x + b.w / 2} y2={b.y} stroke="#C9A6D8" strokeWidth={1.5} strokeDasharray="4 3" />;
          }))}
          {/* 스텝 셀 */}
          {Object.keys(cells.place).map((sid) => {
            const cp = cells.place[sid], isCur = sid === cur;
            const { pos, b } = cp.info;
            const cx = cp.x + cp.w / 2;
            const tx = cx - (b.minX + b.maxX) / 2;
            const ty = (ROW_H - 26) - b.maxY;
            return (
              <g key={sid}>
                <rect x={cp.x} y={cp.y} width={cp.w} height={ROW_H} rx={8} fill={isCur ? "#F3F1FE" : "#fff"} stroke={isCur ? "#7F77DD" : "#EFEDE6"} strokeWidth={isCur ? 2 : 1}
                  onClick={() => { setCur(sid); setSel(null); }} style={{ cursor: "pointer" }} />
                <text x={cp.x + 10} y={cp.y + 22} fontSize="17" fill={isCur ? "#7F77DD" : "#7A786F"} fontWeight="800">{cp.label}</text>
                {isCur && <text x={cp.x + cp.w - 10} y={cp.y + 20} fontSize="12" textAnchor="end" fill="#7F77DD" fontWeight="700">편집중</text>}
                <g transform={`translate(${tx},${cp.y + ty})`}>
                  <PlantSVG plant={tree.nodes[sid].plant} pos={pos} editable={isCur} sel={isCur ? sel : null} onPick={setSel} />
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 스텝 진행 버튼 — 원본 순서대로 */}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: SUB, fontWeight: 600 }}>성장 단계:</span>
        {(() => {
          const tip = findTip(plant);
          if (!tip) return null;
          if (tip.isSeed) return <button onClick={germinate} style={btn("#9BC48A", "#EDF5E6", "#3F6B26")}>① 씨앗에서 얇은 줄기 나오기</button>;
          const tipBud = (tip.buds || []).find((b) => !b.childNode);
          const btns = [];
          // 새순 없으면 새순 내기
          if (!tipBud) btns.push(<button key="bud" onClick={() => addBud(tip.id)} style={btn("#E8A838", "#FDF6E8", "#8A6410")}>② 줄기 끝에 말린 새순</button>);
          // 새순 있고 아직 성숙 전이면 잎 성숙
          else if (tipBud.stage < LEAF.length - 1) {
            const nextLeaf = LEAF[tipBud.stage + 1];
            const bi = tip.buds.indexOf(tipBud);
            btns.push(<button key="grow" onClick={() => growLeaf(tip.id, bi)} style={btn("#7AB55C", "#EAF5E3", "#3F6B26")}>③ 잎 성숙 → {nextLeaf.label}</button>);
          }
          // 줄기 자람은 항상 가능
          btns.push(<button key="up" onClick={() => growUp(tip.id)} style={btn("#1D9E75", "#E1F5EE", "#0F6E56")}>↑ 줄기 한 마디 자람</button>);
          return btns;
        })()}
        <div style={{ width: 1, height: 20, background: G }} />
        <button onClick={branch} style={btn("#7F77DD", "#EEEDFE", "#3C3489")}>⑂ 가능성 분기(아래)</button>
        <span style={{ fontSize: 11, color: "#A9A7A0" }}>각 단계는 오른쪽에 새 스텝(시간 진행)</span>
      </div>

      {/* 선택 편집 패널 */}
      {selNode && (
        <Panel color="#7F77DD" bg="#FBFAF8">
          <b style={{ fontSize: 13 }}>{selNode.isSeed ? "씨앗(밑동)" : selNode.isTip ? "생장점(맨 위)" : "마디"}</b>
          {selNode.isSeed && <button onClick={germinate} style={btn("#E8A838", "#FDF6E8", "#8A6410")}>① 씨앗에서 얇은 줄기</button>}
          {selNode.isTip && !selNode.isSeed && <button onClick={() => growUp(sel.id)} style={btn("#1D9E75", "#E1F5EE", "#0F6E56")}>↑ 이 생장점 줄기 자람</button>}
          {!selNode.isSeed && <button onClick={() => addBud(sel.id)} style={btn("#E8A838", "#FDF6E8", "#8A6410")}>🌱 새순 내기(혹)</button>}
          <div style={{ flex: 1 }} />
          {!selNode.isTip && !selNode.isSeed && <button onClick={() => removeNode(sel.id)} style={btn("#E24B4A", "#fff", "#A32D2D")}>✕ 제거</button>}
          <button onClick={() => setSel(null)} style={ghost}>닫기</button>
        </Panel>
      )}

      {selStem && (
        <Panel color="#DB8FB4" bg="#FDF5F9">
          <b style={{ fontSize: 13 }}>줄기 상태 · {STEM[selStem.stem]?.label}</b>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", width: "100%", marginTop: 6 }}>
            {STEM_UI.map((k) => {
              const on = selStem.stem === k;
              return <button key={k} onClick={() => setStem(sel.id, k)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, fontSize: 12, cursor: "pointer", border: `1px solid ${on ? "#DB8FB4" : "#E0D5DC"}`, background: on ? "#F7E8F0" : "#fff", color: SUB }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: STEM[k].color, display: "inline-block" }} />{STEM[k].label}</button>;
            })}
            {(selStem.stem === "thick" || selStem.stem === "main") && (
              <>
                <div style={{ width: 1, height: 20, background: "#E0D5DC", margin: "0 4px" }} />
                <button onClick={() => eyeToLeaf(sel.id)} style={btn("#5A8F3A", "#EAF3E4", "#3F6B26")}>➜ 눈에서 가는 잎자루</button>
              </>
            )}
            {(() => {
              const t = tipOfChain(plant, sel.id);
              if (!t || t.isSeed || !t.isTip) return null;
              return <>
                <div style={{ width: 1, height: 20, background: "#E0D5DC", margin: "0 4px" }} />
                <button onClick={() => growUp(t.id)} style={btn("#1D9E75", "#E1F5EE", "#0F6E56")}>↑ 이 줄기 끝 자람</button>
                <button onClick={() => addBud(t.id)} style={btn("#E8A838", "#FDF6E8", "#8A6410")}>🌱 이 줄기 끝에 새순</button>
              </>;
            })()}
            <div style={{ flex: 1 }} /><button onClick={() => setSel(null)} style={ghost}>닫기</button>
          </div>
        </Panel>
      )}

      {selBud && (
        <Panel color="#4A90D9" bg="#F5F9FD">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", width: "100%" }}>
            <b style={{ fontSize: 13 }}>혹/잎 · {LEAF[selBud.stage]?.label}</b>
            <button onClick={() => growLeaf(sel.id, sel.bi)} disabled={selBud.stage >= LEAF.length - 1} style={btn("#7AB55C", "#EAF5E3", "#3F6B26")}>→ 다음 단계</button>
            <button onClick={() => budToBranch(sel.id, sel.bi)} style={btn("#D85A30", "#FAECE7", "#993C1D")}>⋔ 이 혹을 가지로</button>
            <div style={{ flex: 1 }} /><button onClick={() => setSel(null)} style={ghost}>닫기</button>
          </div>
          <div style={{ fontSize: 11, color: SUB, margin: "8px 0", paddingBottom: 8, borderBottom: "1px dashed #CDD8E5", width: "100%" }}>새순→중간잎까진 시간대로 자동. 아래 확률은 이 지점 오버라이드(비우면 종 기본).</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", width: "100%" }}>
            {[["mid1", "mid1 비율"], ["mature", "성숙 도달"], ["special", "특수발현"]].map(([k, l]) => (
              <label key={k} style={{ fontSize: 12, color: SUB }}>{l}(%)<br />
                <input type="number" placeholder={String(prob[k])} value={selBud.probOverride?.[k] ?? ""}
                  onChange={(e) => setBudProb(sel.id, sel.bi, { [k]: e.target.value === "" ? undefined : +e.target.value })}
                  style={{ width: 66, padding: "5px 8px", borderRadius: 7, border: "1px solid #CDD8E5", fontSize: 13, marginTop: 3 }} />
              </label>
            ))}
            <div style={{ fontSize: 12, color: SUB }}>특수 형태<br />
              <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                {SPECIALS.map((s) => (
                  <button key={s.key} onClick={() => setBudSpecial(sel.id, sel.bi, s.key)} style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: `1px solid ${selBud.special === s.key ? "#4A90D9" : "#CDD8E5"}`, background: selBud.special === s.key ? "#E7F0FA" : "#fff", color: SUB }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block", marginRight: 4 }} />{s.label}</button>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      )}

      {!sel && (
        <div style={{ marginTop: 8, padding: "8px 12px", fontSize: 12, color: SUB, background: "#FBFAF8", border: `1px solid ${G}`, borderRadius: 10 }}>
          <b>씨앗 클릭</b>=발아 · <b>생장점(파랑) 클릭</b>=줄기 자람·새순 · <b>마디(원) 클릭</b>=새순 · <b>줄기(선) 클릭</b>=상태 · <b>잎 클릭</b>=성숙·확률·가지. 성장하면 오른쪽에 새 스텝이 저절로 생깁니다.
        </div>
      )}
    </div>
  );
}

function Panel({ color, bg, children }) {
  return <div style={{ marginTop: 8, padding: 10, border: `1px solid ${color}`, borderRadius: 10, background: bg, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{children}</div>;
}

function Legend({ G, SUB }) {
  const Ico = ({ children }) => <svg viewBox="-14 -14 28 28" width="26" height="26" style={{ flex: "0 0 auto" }}>{children}</svg>;
  const rows = [
    { icon: <Ico><ellipse cx="0" cy="0" rx="6" ry="8" fill="#8A6A3A" stroke="#5A4520" strokeWidth="1.5" /></Ico>, name: "씨앗(밑동)", desc: "맨 아래 고정. 클릭 → 발아(씨앗 위로 새순 마디)." },
    { icon: <Ico><circle cx="0" cy="0" r="6" fill="#4A78C8" stroke="#2C4E7C" strokeWidth="1.5" /></Ico>, name: "파랑 생장점", desc: "줄기 맨 위. 클릭 → 줄기 자람(위로)·새순 내기." },
    { icon: <Ico><circle cx="0" cy="0" r="4" fill="#fff" stroke="#B98A5A" strokeWidth="1.5" /></Ico>, name: "마디(흰 점)", desc: "줄기 마디. 클릭 → 새순 내기·제거." },
    { icon: <Ico><line x1="0" y1="9" x2="0" y2="-9" stroke="#E8C9A0" strokeWidth="8" /><line x1="0" y1="9" x2="0" y2="0" stroke="#D0453A" strokeWidth="8" /></Ico>, name: "줄기(선)", desc: "클릭 → 상태 5종: 잎자루→분홍대기(thin/med)→눈→희귀." },
    { icon: <Ico><ellipse cx="0" cy="0" rx="4.5" ry="8" fill="#E8A838" stroke="#7A5A10" strokeWidth="0.7" /></Ico>, name: "🟠 새순→🔵 중간잎", desc: "시간대로 자동 성숙. 잎 클릭 → 다음 단계·확률편집." },
    { icon: <Ico><path d="M0 -10 Q11 -3 6 7 L2 3 L0 8 L-2 3 L-6 7 Q-11 -3 0 -10 Z" fill="#8B5CF6" stroke="#4B2E83" strokeWidth="0.7" /></Ico>, name: "🟣 성숙잎(갈라짐)", desc: "확률로만 도달. 특수무늬는 mid 형태 따라 그룹핑(예정)." },
    { icon: <Ico><ellipse cx="-5" cy="0" rx="3.5" ry="6" fill="#E8A838" stroke="#7A5A10" strokeWidth="0.6" /><ellipse cx="5" cy="0" rx="3.5" ry="6" fill="#E8A838" stroke="#7A5A10" strokeWidth="0.6" /></Ico>, name: "●● 더블혹", desc: "혹 날 때 확률로 2개 → 성장이 2갈래로." },
  ];
  return (
    <div style={{ marginBottom: 10, padding: 12, border: "1px solid #5A8F3A", borderRadius: 10, background: "#F6FAF3" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#3F6B26" }}>범례 — 요소와 클릭 동작</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 8 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 8px", background: "#fff", border: `1px solid ${G}`, borderRadius: 8 }}>
            {r.icon}
            <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 11, color: SUB, lineHeight: 1.45, marginTop: 2 }}>{r.desc}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
