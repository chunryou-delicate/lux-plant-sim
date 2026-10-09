# -*- coding: utf-8 -*-
"""⛔ 10-10 이 도구는 orient_leaf.py 로 대신한다 — 기운 쪽(cz)만 맞추면 곧은 잎(Tripo)은 겉면이 옆(±X)을 봐 그리개가 눕혀도 모서리만 보였다.
   tools/leaf/yaw_leaf.py — 잎 GLB 를 자루 축(Y) 둘레로 돌려 «잎몸이 +Z 쪽으로 기운» 꼴로 맞춘다 ([leaf] 10-10 · 크레딧 0)
   growth 그리개 규약: normalizeAsset 뒤 상자 중심이 +Z(cz > 0 · PP 성숙 +0.42 · AL 성숙 +0.39) — 눕힘을 X 축으로 돌려 바깥으로 눕히므로
   −Z 로 기운 판은 안쪽으로 눕는다. 기운 방향(cx, cz · 자루 끝 기준 · 높이 단위)을 +Z 로 돌리는 Y 축 돌림만 건다(모양·UV·텍스처 그대로).
   노드 변환은 정점에 녹이고 노드는 단위 행렬로(돌림 뒤 정점 = 월드). 자루 끝 = 맨 아래 8% 띠 XZ 무게중심(normalizeAsset 과 같은 셈)을 축으로.
   쓰기: python tools/leaf/yaw_leaf.py <glb>...   — 제자리에 쓴다(git 이 원본을 쥐고 있을 때만 쓸 것) · --dry 면 재기만"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lift_base import read_glb, write_glb
from unity_kit import _node_mats, _acc_read, _acc_write

def lean(P):
    y0 = P[:, 1].min(); h = np.ptp(P[:, 1]); band = P[P[:, 1] <= y0 + 0.08 * h]; ax, az = band[:, 0].mean(), band[:, 2].mean()
    cx = ((P[:, 0].max() + P[:, 0].min()) / 2 - ax) / h; cz = ((P[:, 2].max() + P[:, 2].min()) / 2 - az) / h
    return ax, az, cx, cz

def yaw(path, dry=False):
    js, b = read_glb(path); b = bytearray(b); W = _node_mats(js); prims = []
    for i, nd in enumerate(js.get('nodes', [])):
        if 'mesh' not in nd: continue
        for pr in js['meshes'][nd['mesh']]['primitives']:
            P = np.array(_acc_read(js, b, pr['attributes']['POSITION'])); P = (np.c_[P, np.ones(len(P))] @ W[i].T)[:, :3]
            N = None
            if 'NORMAL' in pr['attributes']:
                N = np.array(_acc_read(js, b, pr['attributes']['NORMAL'])) @ np.linalg.inv(W[i][:3, :3]).T; N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
            prims.append((pr, P, N))
    allP = np.vstack([p for _, p, _ in prims]); ax, az, cx, cz = lean(allP)
    phi = np.arctan2(cx, cz)                                   # 기운 방향의 각(+Z 에서 +X 쪽으로) — −phi 만큼 돌리면 +Z 로 간다
    c, s = np.cos(-phi), np.sin(-phi)
    R = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])           # Y 축 돌림(+Z → +X 가 양의 각)
    def rot(P): return (P - [ax, 0, az]) @ R.T + [ax, 0, az]
    after = lean(np.vstack([rot(p) for _, p, _ in prims]))
    if not dry:
        for pr, P, N in prims:
            Q = rot(P); pa = pr['attributes']['POSITION']; _acc_write(js, b, pa, Q)
            js['accessors'][pa]['min'] = Q.min(0).tolist(); js['accessors'][pa]['max'] = Q.max(0).tolist()
            if N is not None: _acc_write(js, b, pr['attributes']['NORMAL'], N @ R.T)
        for nd in js.get('nodes', []):
            for k in ('matrix', 'translation', 'rotation', 'scale'): nd.pop(k, None)
        views = [bytes(b[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]) for v in js['bufferViews']]
        write_glb(path, js, views)
    return (round(cx, 2), round(cz, 2)), (round(after[2], 2), round(after[3], 2)), round(float(np.degrees(phi)), 1)

if __name__ == '__main__':
    dry = '--dry' in sys.argv
    for g in [a for a in sys.argv[1:] if not a.startswith('--')]:
        before, aft, deg = yaw(g, dry)
        print(f'{os.path.basename(g):34s} (cx,cz) {before} → {aft} · Y 돌림 {-deg:+.1f}°{" (재기만)" if dry else ""}')
