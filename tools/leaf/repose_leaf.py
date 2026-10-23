# -*- coding: utf-8 -*-
"""tools/leaf/repose_leaf.py — 잎 GLB 를 «자세 A» 로 다시 세운다 · 이음(자루→잎몸)을 꺾어서 ([leaf] 10-23 · D71 · 크레딧 0)
   왜: Tripo 판마다 자루와 잎몸이 이루는 각이 달라 통째 회전(orient_leaf)으로는 한 종 안에서 자세가 안 맞는다
       (스킨답서스 무늬판 둘은 잎몸이 거의 누워 58°·77° — docs/handoff/leaf-species2-skeleton-20261023.md).
   자세 A(growth 10-10 · 10-23 고름): 자루 끝 = 맨 아래 · 자루 곧게 위(+Y) · 잎몸이 자루 윗끝 위에 곧게 · 겉면 −Z · 잎끝 위.
   셈:
     ① 표면 위 거리(측지) — 자루 끝(맨 아래 2% 띠)에서 메시 모서리를 따라 잰 거리 d. UV 이음매로 갈린 정점은 자리로 붙여 잰다.
        자세와 상관없이 «자루 → 잎몸» 순서가 선다(높이로 가르면 누운 잎몸에서 틀린다).
     ② 이음 = d 를 100 띠로 잘라 띠 폭이 최대의 25% 를 처음 넘는 곳 · 자루 윗끝 H = 그 앞 띠의 무게중심
     ③ 자루 회전 Rp = 자루 끝 → H 를 +Y 로(가장 짧은 회전)
        잎몸 회전 Rb = 잎몸 틀(옆 w · 축 a = H → 잎끝(d 가 가장 먼 점) · 겉면 법선 n)을 (X, Y, −Z) 로
        겉면 = 닫힌 껍질 두 쪽 중 무늬·잎맥 대비가 큰 쪽(orient_leaf.front_sign)
     ④ 정점마다 u' = Rp·H + R(t)·(u − H) · R(t) = slerp(Rp, Rb, t) · t = 이음 바로 앞 자루 끝 토막(표면거리 BLEND·D)에서 0 → 1 로 매끈하게
        (t=0 이면 u' = Rp·u 라 자루는 통째로 세워지고 · t=1 이면 잎몸은 H 둘레로 통째로 선다 · 자루 맨 윗 토막만 휜다)
     ⑤ 자루 길이 = PETIOLE × 중맥(H → 잎끝) — 세운 자루를 Y 로만 줄이고(굵기 그대로) 잎몸은 통째로 그만큼 내린다.
        ★ 스킨답서스 Tripo 판은 자루가 잎몸 홈(하트 갈라진 곳)까지 중맥만큼 길게 올라가고 잎몸이 거기서 «아래로» 매달려 있다.
          그대로 세우면 자루 ≈ 중맥이라 키가 1.6~1.8 배가 되어 같은 real_max_m 에서 잎몸이 30% 넘게 작아진다.
          기본 0.6 = 칼라테아 본종 셋(같은 자로 0.44 · 0.69 · 0.68)과 한 자. --petiole=0 이면 줄이지 않는다.
   법선도 같은 R(t) 로 돌린다 · UV·텍스처·삼각형은 그대로.
   쓰기: python tools/leaf/repose_leaf.py <src.glb> <dst.glb> [--blend=0.02] [--petiole=0.6] [--dry]
         (src = dst 면 덮어쓴다 — 원본은 먼저 _hf_masters 에 둘 것)"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial.transform import Rotation, Slerp
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lift_base import read_glb, write_glb
from unity_kit import _node_mats, _acc_read, _acc_write
from orient_leaf import front_sign

def load_prims(path):
    js, b = read_glb(path); b = bytearray(b); W = _node_mats(js); prims = []
    for i, nd in enumerate(js.get('nodes', [])):
        if 'mesh' not in nd: continue
        for pr in js['meshes'][nd['mesh']]['primitives']:
            P = np.array(_acc_read(js, b, pr['attributes']['POSITION'])); P = (np.c_[P, np.ones(len(P))] @ W[i].T)[:, :3]
            N = None
            if 'NORMAL' in pr['attributes']:
                N = np.array(_acc_read(js, b, pr['attributes']['NORMAL'])) @ np.linalg.inv(W[i][:3, :3]).T; N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
            I = np.array(_acc_read(js, b, pr['indices'])).astype(int).reshape(-1, 3)
            prims.append((pr, P, N, I))
    return js, b, prims

def geodesic(P, F, src):
    """정점 P · 삼각형 F · 출발 정점들 src → 표면 위 거리(자리가 같은 정점은 붙여서)"""
    key = np.round(P / (np.ptp(P, 0).max() * 1e-6)).astype(np.int64)
    _, weld, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.ravel()
    Fw = inv[F]; e = np.r_[Fw[:, [0, 1]], Fw[:, [1, 2]], Fw[:, [2, 0]]]; e = e[e[:, 0] != e[:, 1]]
    Pw = P[weld]; w = np.linalg.norm(Pw[e[:, 0]] - Pw[e[:, 1]], axis=1)
    G = coo_matrix((np.r_[w, w], (np.r_[e[:, 0], e[:, 1]], np.r_[e[:, 1], e[:, 0]])), shape=(len(Pw),) * 2).tocsr()
    d = dijkstra(G, directed=False, indices=np.unique(inv[src]), min_only=True)
    return d[inv]

def plan(P, F, js, b, prims, blend=0.02):
    y0 = P[:, 1].min(); h = np.ptp(P[:, 1])
    band = P[:, 1] <= y0 + 0.08 * h; O = np.array([P[band, 0].mean(), y0, P[band, 2].mean()])   # normalizeAsset 의 자루 끝
    d = geodesic(P, F, np.where(P[:, 1] <= y0 + 0.02 * h)[0])
    if not np.isfinite(d).all(): raise SystemExit('⛔ 자루 끝에서 닿지 않는 조각이 있다(메시가 둘 이상) — 이 자로는 못 세운다')
    D = d.max(); bins = np.linspace(0, D, 101); spread = []
    for lo, hi in zip(bins[:-1], bins[1:]):
        S = P[(d >= lo) & (d < hi)]; spread.append(np.ptp(S, 0).max() if len(S) > 2 else 0.0)
    spread = np.array(spread); k = int(np.argmax(spread >= 0.25 * spread.max()))
    S = P[(d >= bins[max(k - 1, 0)]) & (d < bins[k])] if k > 0 else P[d < bins[1]]
    H = S.mean(0) - O; dh = float(bins[k])                       # 자루 윗끝(자루 끝 원점 기준) · 이음의 표면 거리
    U = P - O
    # 자루: 자루 끝 → H 를 +Y 로
    Rp = Rotation.align_vectors([[0, 1, 0]], [H / np.linalg.norm(H)])[0]
    # 잎몸 틀: 법선(주성분 가장 얇은 축 · 겉면 쪽) · 축(H → 잎끝 · 평면 안)
    B = U[d > dh + blend * D]; bc = B.mean(0)
    n = np.linalg.svd(B - bc, full_matrices=False)[2][2]
    n = n * front_sign(js, b, [(pr, Pp, Nn) for pr, Pp, Nn, _ in prims], n, None)
    tip = U[np.argmax(d)]; a = (tip - H) - np.dot(tip - H, n) * n; a /= np.linalg.norm(a)
    w = np.cross(n, a)
    Rb = Rotation.from_matrix(np.c_[[1, 0, 0], [0, 1, 0], [0, 0, -1]] @ np.c_[w, a, n].T)
    t = np.clip((d - (dh - blend * D)) / (blend * D), 0, 1); t = t * t * (3 - 2 * t)
    return dict(O=O, H=H, dh=dh, D=D, Rp=Rp, Rb=Rb, t=t, n=n, a=a, tip=tip)

def repose(src, dst, blend=0.02, petiole=0.6, dry=False):
    js, b, prims = load_prims(src)
    off = np.cumsum([0] + [len(p[1]) for p in prims]); P = np.vstack([p[1] for p in prims]); F = np.vstack([p[3] + o for p, o in zip(prims, off)])
    pl = plan(P, F, js, b, prims, blend)
    S = Slerp([0, 1], Rotation.concatenate([pl['Rp'], pl['Rb']]))
    hl = float(np.linalg.norm(pl['H'])); Hn = np.array([0.0, hl, 0.0]); mid = float(np.linalg.norm(pl['tip'] - pl['H']))
    s = (petiole * mid / hl) if petiole > 0 else 1.0                    # 자루 줄임 몫
    out = []
    for (pr, Pp, Nn, _), o in zip(prims, off):
        tt = pl['t'][o:o + len(Pp)]; R = S(tt)
        Q = Hn + R.apply(Pp - pl['O'] - pl['H'])
        Q[:, 1] -= (1 - s) * ((1 - tt) * np.clip(Q[:, 1], 0, hl) + tt * hl)   # 자루는 Y 로 줄이고 · 잎몸은 통째로 내린다
        out.append(Q)
        if dry: continue
        pa = pr['attributes']['POSITION']; _acc_write(js, b, pa, Q)
        js['accessors'][pa]['min'] = Q.min(0).tolist(); js['accessors'][pa]['max'] = Q.max(0).tolist()
        if Nn is not None: _acc_write(js, b, pr['attributes']['NORMAL'], R.apply(Nn))
    if not dry:
        for nd in js.get('nodes', []):
            for k in ('matrix', 'translation', 'rotation', 'scale'): nd.pop(k, None)
        write_glb(dst, js, [bytes(b[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]) for v in js['bufferViews']])
    Q = np.vstack(out); ang = lambda R: round(float(np.degrees(R.magnitude())), 1); r3 = lambda v: round(float(v), 3)
    return {'자루 회전°': ang(pl['Rp']), '잎몸 회전°': ang(pl['Rb']), '이음 표면거리 몫': r3(pl['dh'] / pl['D']),
            '자루 · 중맥(전)': [r3(hl), r3(mid)], '자루(후)': r3(hl * s), '상자(후)': [r3(v) for v in np.ptp(Q, 0)], '맨 아래 y': r3(Q[:, 1].min())}

if __name__ == '__main__':
    fl = [a for a in sys.argv[1:] if a.startswith('--')]; ar = [a for a in sys.argv[1:] if not a.startswith('--')]
    bl = float(next((f[8:] for f in fl if f.startswith('--blend=')), 0.02))
    pe = float(next((f[10:] for f in fl if f.startswith('--petiole=')), 0.6))
    print('★', os.path.basename(ar[1]), repose(ar[0], ar[1], bl, pe, '--dry' in fl))
