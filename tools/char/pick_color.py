#!/usr/bin/env python3
"""구운 판의 정점 색을 k-means 로 묶고, «바라는 색»에 가장 가까운 덩어리 중심을 낸다 — make_part 의 --target 으로 쓴다.
쓰기: python tools/char/pick_color.py <구운.glb> R,G,B [R,G,B …]   ⇒ 한 줄에 하나씩 «가장 가까운 중심» R,G,B"""
import sys, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_extract_part import read_glb, acc_np, texture_of
from scipy.cluster.vq import kmeans2
js,b=read_glb(sys.argv[1]); p=js['meshes'][0]['primitives'][0]
UV=np.asarray(acc_np(js,b,p['attributes']['TEXCOORD_0']),np.float32); tex=texture_of(js,b,p); H,W=tex.shape[:2]
col=tex[np.clip((UV[:,1]*H).astype(int),0,H-1),np.clip((UV[:,0]*W).astype(int),0,W-1)].astype(float)
c,l=kmeans2(col,8,seed=1,minit='++'); cnt=np.bincount(l,minlength=8)
for want in sys.argv[2:]:
    w=np.array([float(v) for v in want.split(',')]); i=int(np.argmin(np.abs(c-w).max(1)))
    print(','.join(str(int(round(v))) for v in c[i]), f'# 바람 {want} · 점 {cnt[i]}')
