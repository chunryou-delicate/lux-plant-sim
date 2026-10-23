# -*- coding: utf-8 -*-
"""tools/leaf/skeleton_table.py — 한 종 안 잎 GLB 들의 «뼈대»를 같은 자로 잰다 ([leaf] 10-23 · D71 새 두 종 · 크레딧 0)
   Tripo 판은 판마다 따로 떠서 뼈대(잎자루 길이 · 잎몸이 시작하는 자리 · 잎몸 크기)가 서로 다르다.
   growth 그리개가 단계·판을 갈아 끼워도 잎몸 크기·자루 끝 자리가 튀지 않게 보정값을 낸다.
   셈(게임과 같은 자): normalizeAsset(anchorBottom) — 자루 끝(맨 아래 8% 띠 XZ 무게중심) = 원점 · 높이 1(정규) · 실측은 «가장 긴 축 = real_max_m»(manifest 규약)
     잎몸 시작(자루→잎몸 이음) = 높이를 1% 띠로 잘라 «띠 폭 ≥ 잎몸 최대 폭의 25%» 가 처음 되는 높이
     띠 폭 = 그 띠 화소들의 X·Z 폭 중 큰 것(자세 A — 잎몸이 XY 평면에 선다)
   쓰기: python tools/leaf/skeleton_table.py <json 낼 곳> <종이름=glb,glb,…> …   (실측은 manifest 에서 읽고 --real=이름:값 으로 덮을 수 있다)"""
import sys, os, json
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glb_geom import load, acc
from unity_kit import _node_mats
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))

def world(path):
    js, b = load(path); W = _node_mats(js); Ps = []
    for i, nd in enumerate(js.get('nodes', [])):
        if 'mesh' not in nd: continue
        for pr in js['meshes'][nd['mesh']]['primitives']:
            P = acc(js, b, pr['attributes']['POSITION']); Ps.append((np.c_[P, np.ones(len(P))] @ W[i].T)[:, :3])
    return np.vstack(Ps)

def measure(path, real_max_m):
    P = world(path); y0 = P[:, 1].min(); h = np.ptp(P[:, 1])
    band = P[P[:, 1] <= y0 + 0.08 * h]; ax, az = band[:, 0].mean(), band[:, 2].mean()
    Q = (P - [ax, y0, az]) / h                                   # 정규: 자루 끝 원점 · 높이 1
    bins = np.linspace(0, 1, 101); widths = []; cents = []
    for lo, hi in zip(bins[:-1], bins[1:]):
        S = Q[(Q[:, 1] >= lo) & (Q[:, 1] < hi)]
        widths.append(max(np.ptp(S[:, 0]), np.ptp(S[:, 2])) if len(S) > 2 else 0.0)
        cents.append(S[:, [0, 2]].mean(0) if len(S) else np.array([np.nan, np.nan]))
    widths = np.array(widths); Wmax = widths.max()
    j = int(np.argmax(widths >= 0.25 * Wmax)); yj = float(bins[j])
    jx, jz = cents[j]
    # ★ 잎몸은 «제 평면»으로 잰다(10-23) — 높이로 재면 누운 잎몸(SC 무늬판)의 길이가 두께로 잡힌다
    #   자루 윗끝 Pt = 이음 바로 아래 5% 띠(자루만 있는 곳)의 무게중심 · 잎몸 = 이음 높이 위 화소
    #   법선 n = 잎몸 주성분의 가장 얇은 축(−Z 쪽으로) · 잎몸 축 a = 무게중심 → 잎끝(자루 반대쪽으로 가장 먼 점) · 평면 안
    S = Q[(Q[:, 1] >= max(0.0, yj - 0.05)) & (Q[:, 1] < yj)]; Pt = S.mean(0) if len(S) else np.array([jx, yj, jz])
    blade = Q[Q[:, 1] >= yj]; bc = blade.mean(0)
    _, _, V = np.linalg.svd(blade - bc, full_matrices=False); n = V[2] * (-1 if V[2][2] > 0 else 1)
    inpl = lambda v: v - np.dot(v, n) * n
    d0 = inpl(bc - Pt); d0 = d0 / (np.linalg.norm(d0) or 1)
    tip = blade[np.argmax((blade - bc) @ d0)]
    a = inpl(tip - bc); a /= np.linalg.norm(a)
    w = np.cross(n, a)
    L = (blade - bc) @ a; Wd = (blade - bc) @ w
    pet = float(np.linalg.norm(Pt))                              # 자루 = 자루 끝(원점) → 자루 윗끝 곧은 거리
    longest = float((Q.max(0) - Q.min(0)).max())                 # 정규 단위의 가장 긴 축
    m = (real_max_m / longest) if real_max_m else None           # 정규 1 = m 미터
    r = lambda v: round(float(v), 3); dg = lambda p, q: round(float(np.degrees(np.arctan2(p, q))), 1)
    out = {'petiole_frac': r(pet), 'blade_len_frac': r(np.ptp(L)), 'blade_width_frac': r(np.ptp(Wd)), 'junction_xyz': [r(jx), r(yj), r(jz)],
           'petiole_top_xyz': [r(v) for v in Pt], 'tip_xyz': [r(v) for v in tip],
           'blade_centroid_xyz': [r(bc[0]), r(bc[1]), r(bc[2])], 'blade_axis': [r(v) for v in a], 'blade_normal': [r(v) for v in n],
           'blade_pitch_deg': dg(a[2], a[1]),                     # 잎몸 축이 +Y 에서 뒤(+Z)로 누운 각 — 자세 A 바탕 잎은 0 근처
           'blade_side_deg': dg(a[0], a[1]),                      # 옆(+X)으로 누운 각
           'face_up_deg': round(float(np.degrees(np.arcsin(np.clip(n[1], -1, 1)))), 1),   # 겉면(−Z 쪽 법선)이 위로 든 각 — 곧게 선 잎은 0 · 누운 잎은 ±90 쪽
           'longest_axis_norm': r(longest), 'real_max_m': real_max_m}
    if m:
        out.update({'height_m': r(m), 'petiole_m': r(pet * m), 'blade_len_m': r(np.ptp(L) * m), 'blade_width_m': r(np.ptp(Wd) * m)})
    return out

if __name__ == '__main__':
    flags = [a for a in sys.argv[1:] if a.startswith('--')]; args = [a for a in sys.argv[1:] if not a.startswith('--')]
    over = {}
    for f in flags:
        if f.startswith('--real='):
            for kv in f[7:].split(','): k, v = kv.split(':'); over[k] = float(v)
    man = {os.path.basename(it.get('path', '')): it for it in json.load(open(os.path.join(ROOT, 'assets', 'manifest.json'), encoding='utf-8'))['items'] if str(it.get('path', '')).endswith('.glb')}
    out = {}
    for spec in args[1:]:
        sp, files = spec.split('=', 1); out[sp] = {}
        for g in files.split(','):
            n = os.path.basename(g)[:-4]; rm = over.get(n, (man.get(n + '.glb') or {}).get('real_max_m'))
            out[sp][n] = measure(g if os.path.isabs(g) else os.path.join(ROOT, g), rm)
            o = out[sp][n]
            print(f"{sp:10s} {n:30s} 실측 {rm} · 자루 {o['petiole_frac']:.2f} · 잎몸 길이 {o['blade_len_frac']:.2f} 폭 {o['blade_width_frac']:.2f} · 이음 {o['junction_xyz']}"
                  + (f" · 잎몸 {o['blade_len_m']*100:.1f}×{o['blade_width_m']*100:.1f}cm 자루 {o['petiole_m']*100:.1f}cm" if 'blade_len_m' in o else ''))
    json.dump(out, open(args[0], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
