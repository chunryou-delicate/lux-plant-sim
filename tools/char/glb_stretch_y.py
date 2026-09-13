#!/usr/bin/env python3
"""리깅된 부품의 정점을 «어느 높이 위만» 세로로 늘인다 — 크레딧 0. 뼈·무게·UV 그대로.

⛔ 왜 있나 (2026-09-14 · 총괄)
  긴 생머리(hair13) 굽기의 두개골이 v19 머리보다 낮아, icp 로 얼굴에 맞추면 정수리가 3.5cm 모자라 살이 비쳤다.
  앞머리(눈 위)는 맞으니 «눈 선 위»만 늘여 정수리를 덮는다.

쓰기
  python tools/char/glb_stretch_y.py <in.glb> <out.glb> --y0=1.22 --top=1.535 [--xz=1.0]
    y0   이 높이 아래는 안 건드린다. 위는 (y-y0) 를 (top-y0)/(max-y0) 배
    xz   y0 위의 가로·앞뒤도 그 비율만큼(정수리 중심 기준) 키운다
"""
import sys, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_apply_delta import read_glb, write_glb, span

a=[x for x in sys.argv[1:] if not x.startswith('--')]
o={x.split('=')[0]:float(x.split('=')[1]) for x in sys.argv[1:] if x.startswith('--')}
js,b=read_glb(a[0]); y0=o['--y0']; top=o['--top']; xz=o.get('--xz',1.0)
for m in js['meshes']:
    for p in m['primitives']:
        off,acc,bv=span(js,p['attributes']['POSITION']); n=acc['count']
        P=np.frombuffer(bytes(b[off:off+n*12]),np.float32).reshape(n,3).copy()
        k=(top-y0)/(P[:,1].max()-y0); up=P[:,1]>y0
        t=np.clip((P[up,1]-y0)/(P[:,1].max()-y0),0,1)          # 0(y0)→1(정수리): 서서히
        P[up,1]=y0+(P[up,1]-y0)*k
        c=P[up][:,[0,2]].mean(0)
        P[up,0]=c[0]+(P[up,0]-c[0])*(1+(xz-1)*t); P[up,2]=c[1]+(P[up,2]-c[1])*(1+(xz-1)*t)
        b[off:off+n*12]=P.astype(np.float32).tobytes()
        acc['min']=[float(v) for v in P.min(0)]; acc['max']=[float(v) for v in P.max(0)]
        print(f'  y0 {y0} 위 {int(up.sum()):,} 점 · 배율 {k:.3f} · 꼭대기 {P[:,1].max():.4f}')
write_glb(js,b,a[1]); print('✔',a[1])
