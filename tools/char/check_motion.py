#!/usr/bin/env python3
"""부품 «전부»를 걷기 클립 여러 순간으로 움직여 «찢김»을 수치로 잰다 — 크레딧 0.

⛔ 왜 있나 (2026-09-14 · 총괄) — 박사님 「전부 다 확인했는지, 움직일 때랑」
  표(catalog)는 한 순간만 찍었다. 움직이며 찢기는 건 변(edge)이 바인드 자세보다 «몇 배» 늘어나는지로 잡힌다.

쓰기
  python tools/char/check_motion.py [--t=0,0.125,…] [--stretch=1.8] [--who=yeoja|namja]
  출력: 부품마다 «늘어난 변 %»(최대 순간) · 몸에서 떨어진 거리(머리·모자는 머리 뼈 정점과의 최근접 중앙값)
"""
import os, re, sys, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_pose_shot import load_clip, pose_part
from scipy.spatial import cKDTree
B='assets/characters/_bodybase'
o={x.split('=')[0]:x.split('=')[1] for x in sys.argv[1:] if x.startswith('--')}
ts=[float(v) for v in o.get('--t','0,0.125,0.25,0.375,0.5,0.625,0.75,0.875').split(',')]
thr=float(o.get('--stretch',1.8)); whos=[o['--who']] if '--who' in o else ['yeoja','namja']
rows=[]
for who in whos:
    chans,dur=load_clip(f'{B}/{who}_v19_walk.glb')
    body=f'{B}/char_{who}_base_v19_rigged.glb'
    files=sorted(f for f in os.listdir(B) if re.match(rf'{who}_(hair|top|bottom|shoes|dress|set|acc|hat)\d*(?:_\w+?)?_rigged\.glb$',f))
    bodies={t:pose_part(body,chans,t*dur)[0] for t in ts}
    for f in files:
        V0,F,_,_=pose_part(f'{B}/{f}',chans,0.0)
        E=np.unique(np.sort(np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]),1),axis=0)
        L0=np.linalg.norm(V0[E[:,0]]-V0[E[:,1]],axis=1); ok=L0>1e-6
        worst=0.0; worst_t=0; gap=0.0
        for t in ts:
            V,_,_,_=pose_part(f'{B}/{f}',chans,t*dur)
            L=np.linalg.norm(V[E[:,0]]-V[E[:,1]],axis=1)
            r=L[ok]/L0[ok]; bad=100*((r>thr)|(r<1/thr)).mean()
            if bad>worst: worst,worst_t=bad,t
            d,_=cKDTree(bodies[t]).query(V,k=1); gap=max(gap,float(np.percentile(d,95)))
        rows.append((f,worst,worst_t,gap))
        print(f'{f:44s} 늘어난 변 {worst:5.2f}% (t={worst_t:.3f}) · 몸에서 95% 거리 {gap:.3f}', flush=True)
bad=[r for r in rows if r[1]>0.5]
print(f'\n== 부품 {len(rows)} · 늘어난 변 0.5% 넘는 것 {len(bad)}')
for r in sorted(bad,key=lambda r:-r[1]): print(f'  ⚠ {r[0]} {r[1]:.2f}%')
