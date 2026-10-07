# -*- coding: utf-8 -*-
"""tools/leaf/seam_normals.py — 「같은 자리에 겹친 정점 짝의 법선이 갈렸나」를 잰다
   ⇒ 실행 중 얇히기(plant_grow.reshapeLeaf)는 정점을 «제 법선»을 따라 민다.
     UV 이음매에서 둘로 쪼개진 정점 짝의 법선이 다르면 짝이 서로 다른 데로 가서 «이음매가 벌어진다»."""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from glb_geom import load, acc

def seam_report(path, mesh_index=None):
    js, b = load(path); out = []
    for mi, m in enumerate(js['meshes']):
        if mesh_index is not None and mi != mesh_index: continue
        pr = m['primitives'][0]
        P = acc(js, b, pr['attributes']['POSITION'])
        if 'NORMAL' not in pr['attributes']: out.append((mi, '법선 없음')); continue
        N = acc(js, b, pr['attributes']['NORMAL'])
        size = float(np.linalg.norm(P.max(0)-P.min(0)))
        key = np.round(P / (size*1e-5)).astype(np.int64)
        groups = {}
        for i, k in enumerate(map(tuple, key)): groups.setdefault(k, []).append(i)
        multi = [g for g in groups.values() if len(g) > 1]
        bad = 0; worst = 0.0
        for g in multi:
            n = N[g]; d = float(1 - (n @ n.T).min())   # 1-cos 의 최대
            worst = max(worst, d)
            if d > 0.02: bad += 1
        out.append((mi, '겹친 정점 묶음 %d · 그중 법선이 갈린 것 %d (%.0f%%) · 제일 갈린 1-cos %.2f' % (
            len(multi), bad, (bad/len(multi)*100) if multi else 0, worst)))
    return out

if __name__ == '__main__':
    for f in sys.argv[1:]:
        for mi, r in seam_report(f): print('%-36s 메시%d  %s' % (f.split('/')[-1], mi, r))
