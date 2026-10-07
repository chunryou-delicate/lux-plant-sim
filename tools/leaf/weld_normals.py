# -*- coding: utf-8 -*-
"""tools/leaf/weld_normals.py — 같은 자리에 겹친 정점 짝의 «법선만» 평균으로 맞춘다

왜(2026-10-08 잰 것): 하프문 중간잎(heart_halfmoon_v2_stem*)은 UV 이음매에서 쪼개진 정점 짝의
  법선이 54~77% 갈려 있다(정상 잎 셋은 0%). plant_grow.reshapeLeaf 는 정점을 «제 법선»을 따라
  밀어 잎을 얇히므로, 짝이 서로 다른 데로 가서 이음매가 벌어진다 — 그것이 「찢김」이고, 그래서
  29~31 이 못(ALBO_MID_POOL)에서 빠져 있었다.
무엇을: NORMAL 값만 바꾼다(같은 바이트 수). 위치·UV·인덱스·텍스처·노드는 한 바이트도 안 건드린다.
  평균이 0 에 가까운 짝(앞뒤가 정반대인 테두리)은 «원래 법선 그대로» 둔다 — 억지로 맞추지 않는다.
쓰는 법: python tools/leaf/weld_normals.py IN.glb OUT.glb
"""
import sys, os, json, struct
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from glb_geom import load, acc
from thin_leaf import write

def weld(src, dst):
    js, b = load(src); b = bytearray(b); rep = []
    for mi, m in enumerate(js['meshes']):
        for pi, pr in enumerate(m['primitives']):
            if 'NORMAL' not in pr['attributes']: rep.append((mi, pi, '법선 없음 — 건너뜀')); continue
            P = acc(js, bytes(b), pr['attributes']['POSITION'])
            ni = pr['attributes']['NORMAL']; a = js['accessors'][ni]; bv = js['bufferViews'][a['bufferView']]
            assert a['componentType'] == 5126 and a['type'] == 'VEC3'
            N = acc(js, bytes(b), ni)
            size = float(np.linalg.norm(P.max(0)-P.min(0)))
            key = np.round(P / (size*1e-5)).astype(np.int64)
            groups = {}
            for i, k in enumerate(map(tuple, key)): groups.setdefault(k, []).append(i)
            NN = N.copy(); changed = 0; kept = 0
            for g in groups.values():
                if len(g) < 2: continue
                s = N[g].sum(0); L = np.linalg.norm(s)
                if L < 0.3 * len(g): kept += 1; continue      # 앞뒤 정반대 — 그대로 둔다
                avg = s / L
                for i in g:
                    if 1 - float(N[i] @ avg) > 1e-6: changed += 1
                    NN[i] = avg
            stride = bv.get('byteStride', 12); base = bv.get('byteOffset',0) + a.get('byteOffset',0)
            for i in range(len(NN)): struct.pack_into('<fff', b, base + i*stride, *map(float, NN[i]))
            rep.append((mi, pi, '정점 %d · 법선 맞춘 것 %d · 정반대라 둔 묶음 %d' % (len(NN), changed, kept)))
    write(dst, js, bytes(b))
    return rep

if __name__ == '__main__':
    for r in weld(sys.argv[1], sys.argv[2]): print('  메시%d·조각%d  %s' % r)
    print('★ 썼다:', sys.argv[2])
