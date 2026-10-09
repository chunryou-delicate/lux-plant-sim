# -*- coding: utf-8 -*-
"""tools/leaf/orient_leaf.py — 잎 GLB 를 «지금 잎(PP·AL·몬스테라)과 같은 자세»로 돌린다 ([leaf] 10-10 · 크레딧 0)
   ★ 10-10 growth 고름 — 곧은 잎(Tripo 새 종)은 (A) «겉면이 줄기 쪽(−Z) · 곧게»: 그리개가 X 축으로 바깥(+Z)으로 눕히면 겉면 법선 (0,sinθ,−cosθ) 로 위를 본다.
     겉면은 닫힌 껍질의 두 쪽 중 «원화와 밑색이 가까운 쪽»(front_sign). 아래 옛 설명(PP 자세에 맞춤)은 굽은 잎 이야기라 곧은 잎엔 안 쓴다.
   지금 잎의 자세(재 봄): 잎몸(높이 30% 위) 면 법선 ≈ (0, +0.8, +0.5~0.6) — 잎 겉면이 위·앞(+Z)을 본다(법선 X 몫 ≤ 0.15) · 그래서 기운 방향 cz > 0.
   growth 그리개는 이 자세에서 X 축으로 «바깥으로 눕힌다» — 면이 옆(±X)을 보는 판은 눕혀도 모서리만 보인다(10-10 새 종 여섯 판이 그랬다).
   돌림(자루 끝 = 맨 아래 8% 띠 XZ 무게중심 둘레):
     ① Y 축 — 면 법선의 수평 몫이 +Z 를 보게(법선 부호는 위(+Y)를 보는 쪽 · 거의 서 있으면 기운 쪽)
     ② X 축 — 면 법선의 올려본 각을 TARGET_DEG(PP·AL 평균 ≈ 51°)로
   모양·UV·텍스처는 그대로 · 노드 변환은 정점에 녹인다. yaw_leaf.py(기운 쪽만 맞춤)를 대신한다.
   쓰기: python tools/leaf/orient_leaf.py <glb>... [--dry]"""
import sys, os, io, json
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lift_base import read_glb, write_glb
from unity_kit import _node_mats, _acc_read, _acc_write
TARGET_DEG = 51.0

def blade_normal(P):
    y0 = P[:, 1].min(); h = np.ptp(P[:, 1]); B = P[P[:, 1] > y0 + 0.3 * h]; c = B.mean(0)
    w, V = np.linalg.eigh(np.cov((B - c).T)); return V[:, 0]

def lean(P):
    y0 = P[:, 1].min(); h = np.ptp(P[:, 1]); band = P[P[:, 1] <= y0 + 0.08 * h]; ax, az = band[:, 0].mean(), band[:, 2].mean()
    return ax, y0, az, ((P[:, 0].max() + P[:, 0].min()) / 2 - ax) / h, ((P[:, 2].max() + P[:, 2].min()) / 2 - az) / h

def Ry(a): c, s = np.cos(a), np.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def Rx(a): c, s = np.cos(a), np.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])

def front_sign(js, b, prims, n, src2d):
    """닫힌 껍질의 «앞면»(겉면 · 원화가 보여 준 쪽) — 면 법선 n 쪽 삼각형들과 반대쪽 삼각형들의 밑색을 원화 잎 화소와 견줘 가까운 쪽(+1/−1).
       원화가 없으면 무늬 대비가 큰 쪽(겉면이 무늬·잎맥이 또렷하다)."""
    from PIL import Image
    T = None
    try:
        mt = (js.get('materials') or [{}])[0]; bc = (mt.get('pbrMetallicRoughness') or {}).get('baseColorTexture')
        im = js['images'][js['textures'][bc['index']]['source']] if bc else js['images'][0]; v = js['bufferViews'][im['bufferView']]
        T = np.asarray(Image.open(io.BytesIO(bytes(b[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]))).convert('RGB')).astype(np.float64)
    except Exception: return 1
    side = {1: [], -1: []}
    for pr, P, N in prims:
        if 'TEXCOORD_0' not in pr['attributes'] or 'indices' not in pr: continue
        U = np.array(_acc_read(js, b, pr['attributes']['TEXCOORD_0'])); I = np.array(_acc_read(js, b, pr['indices'])).astype(int).reshape(-1, 3)
        fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]]); fn /= np.linalg.norm(fn, axis=1, keepdims=True) + 1e-12
        uv = U[I].mean(1); px = T[np.clip((uv[:, 1] * T.shape[0]).astype(int), 0, T.shape[0] - 1), np.clip((uv[:, 0] * T.shape[1]).astype(int), 0, T.shape[1] - 1)]
        d = fn @ n
        side[1].append(px[d > 0.5]); side[-1].append(px[d < -0.5])
    A = {k: (np.vstack(v) if v and sum(len(x) for x in v) else np.zeros((0, 3))) for k, v in side.items()}
    # ★ 10-10 고침 — 원화와 색 견주기는 칼라데아 어린잎·화이트퓨전 중간에서 «뒷면»을 골랐다(앞뒤 렌더로 확인).
    #   겉면은 무늬·잎맥 대비가 크다(뒷면은 옅고 고르다) → 밝기 표준편차가 큰 쪽. 10% 안으로 비슷하면(민무늬) 더 어두운 쪽(겉면이 짙은 초록)
    def lum(X): return X @ np.array([0.2126, 0.7152, 0.0722]) if len(X) else np.zeros(0)
    s1, s2 = (lum(A[1]).std() if len(A[1]) else 0), (lum(A[-1]).std() if len(A[-1]) else 0)
    if max(s1, s2) > 0 and abs(s1 - s2) / max(s1, s2) > 0.10: return 1 if s1 > s2 else -1
    return 1 if (lum(A[1]).mean() if len(A[1]) else 999) <= (lum(A[-1]).mean() if len(A[-1]) else 999) else -1

def plan(P, js=None, b=None, prims=None, src2d=None, mode='A'):
    """mode A(growth 10-10 고름 · 곧은 잎): 겉면 법선을 수평 −Z(줄기 쪽)로 — 잎몸을 곧게 세운다. 그리개가 X 축으로 바깥으로 눕히면 겉면이 위를 본다."""
    n = blade_normal(P); ax, y0, az, cx, cz = lean(P)
    if js is not None: n = n * front_sign(js, b, prims, n, src2d)
    yaw = -np.arctan2(-n[0], -n[2])                  # Ry(yaw) 가 n 의 수평 몫을 −Z 로
    n1 = Ry(yaw) @ n
    elev = np.arctan2(n1[1], -n1[2])                 # −Z 에서 +Y 쪽 각(+ = 겉면이 위를 봄)
    # ② 겉면이 «아래»를 보면(elev < 0)만 수평까지 세운다 — 위를 보는 것은 그대로 둔다(그리개가 눕히면 더 위를 본다).
    #   (10-10 첫 판은 늘 수평으로 맞추느라 크게 돌린 두 판에서 잎몸이 자루 끝보다 내려갔다 — 자루 끝이 맨 아래여야 normalizeAsset 이 맞다)
    R = (Rx(-elev) if elev < 0 else np.eye(3)) @ Ry(yaw)
    piv = np.array([ax, y0, az]); P0 = P - piv
    def lean_after(Rm):
        Q = P0 @ Rm.T; y0q = Q[:, 1].min(); hq = np.ptp(Q[:, 1]); band = Q[Q[:, 1] <= y0q + 0.08 * hq]; bx, bz = band[:, 0].mean(), band[:, 2].mean()
        bw = np.ptp(band[:, [0, 2]], axis=0).max() / max(np.ptp(Q[:, 0]), np.ptp(Q[:, 2]))
        return ((Q[:, 0].max() + Q[:, 0].min()) / 2 - bx) / hq, ((Q[:, 2].max() + Q[:, 2].min()) / 2 - bz) / hq, bw
    def roll_up(Rm):
        Q = P0 @ Rm.T; hq = np.ptp(Q[:, 1]); Bc = Q[Q[:, 1] > Q[:, 1].min() + 0.3 * hq].mean(0)
        return Rz(np.arctan2(Bc[0], Bc[1])) @ Rm
    # ③ 자루 끝 → 잎몸 무게중심을 곧게 위(+Y)로(Z 축 굴림 · 겉면 방향 그대로 · 자루가 맨 아래에 남는다)
    R = roll_up(R)
    # ④ 줄기 쪽(−Z)으로 기운 판(cz < 0)은 앞으로 세워 cz ≥ 0 까지 — 단 자루 끝이 맨 아래(아래 띠 폭 ≤ 0.2)인 동안만
    if lean_after(R)[1] < 0:
        best = R
        for d in np.arange(0.5, 70.5, 0.5):
            Rt = roll_up(Rx(np.radians(d)) @ R); cx_, cz_, bw_ = lean_after(Rt)
            if bw_ > 0.2: break
            best = Rt
            if cz_ >= 0: break
        R = best
    return R, (ax, y0, az), n

def Rz(a): c, s = np.cos(a), np.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def orient(path, dry=False, src2d=None):
    js, b = read_glb(path); b = bytearray(b); W = _node_mats(js); prims = []
    for i, nd in enumerate(js.get('nodes', [])):
        if 'mesh' not in nd: continue
        for pr in js['meshes'][nd['mesh']]['primitives']:
            P = np.array(_acc_read(js, b, pr['attributes']['POSITION'])); P = (np.c_[P, np.ones(len(P))] @ W[i].T)[:, :3]
            N = None
            if 'NORMAL' in pr['attributes']:
                N = np.array(_acc_read(js, b, pr['attributes']['NORMAL'])) @ np.linalg.inv(W[i][:3, :3]).T; N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
            prims.append((pr, P, N))
    allP = np.vstack([p for _, p, _ in prims]); R, (ax, y0, az), n0 = plan(allP, js, b, prims, src2d)
    piv = np.array([ax, y0, az]); rot = lambda P: (P - piv) @ R.T + piv
    Q = np.vstack([rot(p) for _, p, _ in prims]); n1 = R @ n0
    _, _, _, cx1, cz1 = lean(Q)
    if not dry:
        for pr, P, N in prims:
            Qp = rot(P); pa = pr['attributes']['POSITION']; _acc_write(js, b, pa, Qp)
            js['accessors'][pa]['min'] = Qp.min(0).tolist(); js['accessors'][pa]['max'] = Qp.max(0).tolist()
            if N is not None: _acc_write(js, b, pr['attributes']['NORMAL'], N @ R.T)
        for nd in js.get('nodes', []):
            for k in ('matrix', 'translation', 'rotation', 'scale'): nd.pop(k, None)
        write_glb(path, js, [bytes(b[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]) for v in js['bufferViews']])
    return np.round(n0, 2), np.round(n1, 2), round(float(cx1), 2), round(float(cz1), 2)

def facecam(src, dst):
    """보기용 사본 — 겉면 법선을 정확히 −Z(카메라 쪽)로 · 자루 끝 → 잎몸을 +Y 로. 게임 판을 바꾸지 않는다(나란히 찍기 · 썸네일용)"""
    import shutil
    js, b = read_glb(src); b = bytearray(b); W = _node_mats(js); prims = []
    for i, nd in enumerate(js.get('nodes', [])):
        if 'mesh' not in nd: continue
        for pr in js['meshes'][nd['mesh']]['primitives']:
            P = np.array(_acc_read(js, b, pr['attributes']['POSITION'])); P = (np.c_[P, np.ones(len(P))] @ W[i].T)[:, :3]
            N = np.array(_acc_read(js, b, pr['attributes']['NORMAL'])) @ np.linalg.inv(W[i][:3, :3]).T if 'NORMAL' in pr['attributes'] else None
            prims.append((pr, P, N))
    allP = np.vstack([p for _, p, _ in prims]); n = blade_normal(allP); n = n * front_sign(js, b, prims, n, None)
    t = np.array([0, 0, -1.0]); v = np.cross(n, t); c = n @ t
    R = np.eye(3) if np.linalg.norm(v) < 1e-9 else (lambda vx: np.eye(3) + vx + vx @ vx / (1 + c))(np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]]))
    Q = allP @ R.T; hq = np.ptp(Q[:, 1]); y0 = Q[:, 1].min()
    base = Q[Q[:, 1] <= y0 + 0.08 * hq].mean(0); blade = Q[Q[:, 1] > y0 + 0.3 * hq].mean(0); d = blade - base
    R = Rz(np.arctan2(d[0], d[1])) @ R
    for pr, P, N in prims:
        Qp = P @ R.T; pa = pr['attributes']['POSITION']; _acc_write(js, b, pa, Qp); js['accessors'][pa]['min'] = Qp.min(0).tolist(); js['accessors'][pa]['max'] = Qp.max(0).tolist()
        if N is not None: _acc_write(js, b, pr['attributes']['NORMAL'], (N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)) @ R.T)
    for nd in js.get('nodes', []):
        for k in ('matrix', 'translation', 'rotation', 'scale'): nd.pop(k, None)
    write_glb(dst, js, [bytes(b[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]) for v in js['bufferViews']])

if __name__ == '__main__':
    if '--facecam' in sys.argv:   # python tools/leaf/orient_leaf.py --facecam <src.glb> <dst.glb>
        a = [x for x in sys.argv[1:] if not x.startswith('--')]; facecam(a[0], a[1]); print('★', a[1]); sys.exit(0)
    dry = '--dry' in sys.argv
    man = {it.get('path'): it for it in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'manifest.json'), encoding='utf-8'))['items']}
    for g in [a for a in sys.argv[1:] if not a.startswith('--')]:
        rel = g.replace(os.sep, '/').split('assets/', 1)[-1]; src = (man.get(rel) or {}).get('source_2d')
        n0, n1, cx, cz = orient(g, dry, src)
        print(f'{os.path.basename(g):34s} 면 법선 {n0.tolist()} → {n1.tolist()} · cx {cx:+.2f} cz {cz:+.2f}{" (재기만)" if dry else ""}')
