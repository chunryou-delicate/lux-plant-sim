#!/usr/bin/env python3
"""옷 정점이 몸 «안»에 파묻혔으면 몸 표면 바깥으로 밀어낸다 — 크레딧 0.

⛔ 왜 있나 (2026-09-13 · 총괄)
  셔츠를 «몸째 구워» 떼어 v19 에 입혔더니 ⇒ 가슴이 셔츠를 «뚫고» 나왔다.
  구운 몸이 v19 보다 가슴이 작아서다(같은 시트로 구워도 굽기마다 조금씩 다르다).
  ⇒ ★ 옷 정점마다 가장 가까운 몸 정점을 찾아, 몸 법선 기준으로 «안쪽»이면 margin 만큼 바깥으로 민다.

쓰기
  python tools/char/glb_cloth_offset.py <몸_rigged.glb> <옷.glb> <날.glb> [--margin=0.008]
    몸과 옷이 «같은 공간»(리깅 공간)에 있어야 한다.

⚠ 이 자가 «안» 하는 것
  · 팔이 움직일 때 뚫리는 것은 못 막는다 — 바인드 자세에서만 본다
  · 옷의 법선·UV 는 안 건드린다
"""
import json, struct, sys
import numpy as np
from scipy.spatial import cKDTree
sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_extract_part import read_glb, acc_np, write_glb

def main():
    a=[x for x in sys.argv[1:] if not x.startswith('--')]
    o={x.split('=')[0]:float(x.split('=')[1]) for x in sys.argv[1:] if x.startswith('--') and '=' in x}
    body, cloth, out = a[0], a[1], a[2]; margin=o.get('--margin',0.008)
    bj,bb=read_glb(body); bp=bj['meshes'][0]['primitives'][0]
    BV=np.asarray(acc_np(bj,bb,bp['attributes']['POSITION']),np.float32); BN=np.asarray(acc_np(bj,bb,bp['attributes']['NORMAL']),np.float32)
    cj,cb=read_glb(cloth); cb=bytearray(cb); cp=cj['meshes'][0]['primitives'][0]
    acc=cj['accessors'][cp['attributes']['POSITION']]; bv=cj['bufferViews'][acc['bufferView']]; off=bv['byteOffset']; n=acc['count']
    CV=np.frombuffer(bytes(cb[off:off+n*12]),np.float32).reshape(n,3).copy()
    d,idx=cKDTree(BV).query(CV,k=1)
    Nn=BN[idx]; Nn/=np.maximum(np.linalg.norm(Nn,axis=1,keepdims=True),1e-9)
    sd=((CV-BV[idx])*Nn).sum(1)                       # 몸 법선 방향 «부호 있는» 거리
    inside=sd<margin
    CV[inside]+=Nn[inside]*(margin-sd[inside])[:,None]
    print(f'  옷 점 {n:,} · 몸 안쪽이던 점 {int(inside.sum()):,} ({100*inside.mean():.1f}%) · 최대 밀기 {float((margin-sd[inside]).max()) if inside.any() else 0:.4f}')
    cb[off:off+n*12]=CV.astype(np.float32).tobytes(); acc['min']=[float(x) for x in CV.min(0)]; acc['max']=[float(x) for x in CV.max(0)]
    write_glb(cj,bytes(cb),out); print('✔',out)
if __name__=='__main__': main()
