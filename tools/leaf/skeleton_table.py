# -*- coding: utf-8 -*-
"""tools/leaf/skeleton_table.py — 한 종 안 잎 GLB 들의 «뼈대»를 같은 자로 잰다 ([leaf] 10-23 · D71 새 두 종 · 크레딧 0)
   Tripo 판은 판마다 따로 떠서 뼈대(잎자루 길이 · 잎몸이 시작하는 자리 · 잎몸 크기)가 서로 다르다.
   growth 그리개가 단계·판을 갈아 끼워도 잎몸 크기·자루 끝 자리가 튀지 않게 보정값을 낸다.
   셈(게임과 같은 자): normalizeAsset(anchorBottom) — 자루 끝(맨 아래 8% 띠 XZ 무게중심) = 원점 · 높이 1(정규) · 실측은 «가장 긴 축 = real_max_m»(manifest 규약)
     ★ 이음 · 잎끝은 «표면 위 거리»로 잡는다(repose_leaf.plan 과 같은 셈 · 10-23 고침)
       자루 윗끝 H = 자루 끝에서 메시를 따라 잰 거리 띠가 «관»에서 «판»으로 넓어지기 바로 앞 · 잎끝 = 표면 거리가 가장 먼 점
       ⚠ 처음 판(높이 띠 폭)은 스킨답서스에서 틀렸다 — 그 Tripo 판들은 자루가 잎몸 홈까지 길게 올라가고 잎몸이 «아래로» 매달려
         높이로 자르면 매달린 잎끝을 이음으로 · 위쪽 귓불을 잎끝으로 잡았다
     잎몸 = 이음 너머 화소 · 법선 = 잎몸 주성분의 가장 얇은 축(겉면 쪽 · orient_leaf.front_sign) · 축 a = H → 잎끝(평면 안)
   쓰기: python tools/leaf/skeleton_table.py <json 낼 곳> <종이름=glb,glb,…> …   (실측은 manifest 에서 읽고 --real=이름:값 으로 덮을 수 있다)"""
import sys, os, json
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glb_geom import load, acc
from unity_kit import _node_mats
from repose_leaf import load_prims, plan
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))

def world(path):
    js, b = load(path); W = _node_mats(js); Ps = []
    for i, nd in enumerate(js.get('nodes', [])):
        if 'mesh' not in nd: continue
        for pr in js['meshes'][nd['mesh']]['primitives']:
            P = acc(js, b, pr['attributes']['POSITION']); Ps.append((np.c_[P, np.ones(len(P))] @ W[i].T)[:, :3])
    return np.vstack(Ps)

def measure(path, real_max_m):
    js, b, prims = load_prims(path)
    off = np.cumsum([0] + [len(p[1]) for p in prims]); P = np.vstack([p[1] for p in prims]); F = np.vstack([p[3] + o for p, o in zip(prims, off)])
    pl = plan(P, F, js, b, prims, 0.004); h = np.ptp(P[:, 1])
    Q = (P - pl['O']) / h                                        # 정규: 자루 끝 원점 · 높이 1
    Pt = pl['H'] / h; tip = pl['tip'] / h; n = pl['n']           # 자루 윗끝 · 잎끝 · 겉면 법선
    blade = Q[pl['t'] >= 1]; bc = blade.mean(0)
    a = (tip - Pt) - np.dot(tip - Pt, n) * n; a /= np.linalg.norm(a)   # 잎몸 축(이음 → 잎끝 · 평면 안)
    w = np.cross(n, a)
    L = (blade - bc) @ a; Wd = (blade - bc) @ w
    pet = float(np.linalg.norm(Pt))                              # 자루 = 자루 끝(원점) → 자루 윗끝 곧은 거리
    jx, yj, jz = Pt
    longest = float((Q.max(0) - Q.min(0)).max())                 # 정규 단위의 가장 긴 축
    m = (real_max_m / longest) if real_max_m else None           # 정규 1 = m 미터
    r = lambda v: round(float(v), 3); dg = lambda p, q: round(float(np.degrees(np.arctan2(p, q))), 1)
    out = {'petiole_frac': r(pet), 'blade_len_frac': r(np.ptp(L)), 'blade_width_frac': r(np.ptp(Wd)), 'junction_xyz': [r(jx), r(yj), r(jz)],
           'petiole_top_xyz': [r(v) for v in Pt], 'tip_xyz': [r(v) for v in tip],
           'blade_centroid_xyz': [r(bc[0]), r(bc[1]), r(bc[2])], 'blade_axis': [r(v) for v in a], 'blade_normal': [r(v) for v in n],
           'blade_pitch_deg': dg(a[2], a[1]),                     # 잎몸 축이 +Y 에서 뒤(+Z)로 누운 각 — 자세 A 바탕 잎은 0 근처
           'blade_side_deg': dg(a[0], a[1]),                      # 옆(+X)으로 누운 각
           'face_up_deg': round(float(np.degrees(np.arcsin(np.clip(n[1], -1, 1)))), 1),   # 겉면 법선이 위로 든 각 — 곧게 선 잎은 0 · 누운 잎은 ±90 쪽
           'face_minus_z': round(float(-n[2]), 3),                # 겉면이 −Z(줄기 쪽)를 보는 몫 — 자세 A 는 1
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
