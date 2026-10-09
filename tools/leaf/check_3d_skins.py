# -*- coding: utf-8 -*-
"""tools/leaf/check_3d_skins.py — 새 종 3D(밑 메시 · 무늬판) 받은 것 재기 ([leaf] 10-10 · 크레딧 0)
   leaf-3d-order-newspecies-20261009 §3 판정 ① «UV 같음»을 GLB 를 열어 직접 잰다(장부 값을 믿지 않고 다시):
     무늬판과 그 밑 메시의 정점 수 · 삼각 수 · UV 좌표(최대 차) · 위치(최대 차 · 크기 대비)
   그리고 잎 규약(leaf_audit 와 같은 자): 메시 수 · 이음매 법선 갈림 % · 두께% · 채움 % · 삼각 수.
   쓰기: python tools/leaf/check_3d_skins.py <밑.glb> [<무늬판.glb> …]   — 밑 하나에 무늬판 여럿을 견준다"""
import sys, os, json
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glb_geom import load, acc
from leaf_audit import audit

def arrays(path):
    js, b = load(path); P, U, I = [], [], []
    for m in js['meshes']:
        for pr in m['primitives']:
            P.append(acc(js, b, pr['attributes']['POSITION']))
            if 'TEXCOORD_0' in pr['attributes']: U.append(acc(js, b, pr['attributes']['TEXCOORD_0']))
            if 'indices' in pr: I.append(len(acc(js, b, pr['indices'])) // 3)
    return (np.vstack(P) if P else np.zeros((0, 3))), (np.vstack(U) if U else None), sum(I), len(js['meshes'])

def same_uv(base, skin):
    Pb, Ub, Tb, Mb = arrays(base); Ps, Us, Ts, Ms = arrays(skin)
    r = {'verts': [len(Pb), len(Ps)], 'tris': [Tb, Ts], 'meshes': [Mb, Ms]}
    if len(Pb) != len(Ps) or Ub is None or Us is None:
        r['uv_same'] = False; r['why'] = '정점 수가 다르거나 UV 가 없다'; return r
    size = float(np.linalg.norm(Pb.max(0) - Pb.min(0))) or 1.0
    r['pos_maxdiff_rel'] = round(float(np.abs(Pb - Ps).max()) / size, 6)
    r['uv_maxdiff'] = round(float(np.abs(Ub - Us).max()), 6)
    r['uv_same'] = r['uv_maxdiff'] < 1e-4 and r['pos_maxdiff_rel'] < 1e-4
    if not r['uv_same']: r['why'] = 'UV 또는 위치가 갈렸다(정점 차례가 바뀌었거나 다시 펼쳤다)'
    return r

if __name__ == '__main__':
    base = sys.argv[1]; out = {'base': base, 'audit': audit(base), 'skins': {}}
    for s in sys.argv[2:]:
        out['skins'][s] = {'uv': same_uv(base, s), 'audit': audit(s)}
    print(json.dumps(out, ensure_ascii=False, indent=1, default=str))
