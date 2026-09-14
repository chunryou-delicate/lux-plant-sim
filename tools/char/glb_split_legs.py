#!/usr/bin/env python3
"""하의(바지·치마·원피스)의 «가랑이 붙음»과 «안감»을 손본다 — 크레딧 0. 리깅된 부품에 뒤에 건다.

⛔ 왜 있나 (2026-09-14 · 총괄) — 박사님 「움직일 때랑」
  걷기 8순간을 재니 상의·머리·신발은 맨몸 수준(0.6~1%)인데 바지·치마는 변이 4~5% 찢어졌다.
  · 바지: 굽기가 두 다리 사이를 «붙여» 놓아, 왼다리 뼈 점과 오른다리 뼈 점이 한 변으로 이어져 있다 ⇒ 다리가 벌어지면 찢김
  · 치마: 굽기가 다리를 감싼 «안감»을 만들어 놓아, 앞다리가 나가면 안감이 치마 앞을 뚫고 나온다
무엇을 하나
  1) 가랑이 높이(ymax) 아래에서 «으뜸 뼈가 왼다리 vs 오른다리»로 갈리는 변을 가진 면을 지운다(가랑이를 가른다)
  2) --lining: 가랑이 아래에서 몸 표면과 dmin 안쪽이면서 법선이 몸을 «향하는» 면(안감)을 지운다
쓰기
  python tools/char/glb_split_legs.py <몸_rigged.glb> <부품_rigged.glb> <날.glb> [--ymax=0.60] [--cut=1|0] [--lining=0.02]   치마·원피스는 --cut=0 --lining=0.025 (자르면 앞이 트인다)
"""
import sys, numpy as np
from scipy.spatial import cKDTree
sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_extract_part import read_glb, acc_np, write_glb
a=[x for x in sys.argv[1:] if not x.startswith('--')]
o={x.split('=')[0]:float(x.split('=')[1]) for x in sys.argv[1:] if x.startswith('--')}
body, part, out = a[:3]; ymax=o.get('--ymax',0.62); lin=o.get('--lining',0.0)
js,b=read_glb(part); b=bytearray(b); p=js['meshes'][0]['primitives'][0]
V=np.asarray(acc_np(js,b,p['attributes']['POSITION']),np.float32); N=np.asarray(acc_np(js,b,p['attributes']['NORMAL']),np.float32)
J=np.asarray(acc_np(js,b,p['attributes']['JOINTS_0'])); W=np.asarray(acc_np(js,b,p['attributes']['WEIGHTS_0']),np.float32)
names=[js['nodes'][j]['name'] for j in js['skins'][0]['joints']]
L={i for i,n in enumerate(names) if n.startswith('Left') and 'Leg' in n}; R={i for i,n in enumerate(names) if n.startswith('Right') and 'Leg' in n}
top=J[np.arange(len(J)),W.argmax(1)]
side=np.array([1 if t in L else (-1 if t in R else 0) for t in top])
iacc=js['accessors'][p['indices']]; ibv=js['bufferViews'][iacc['bufferView']]; ioff=ibv['byteOffset']+iacc.get('byteOffset',0)
dt={5121:np.uint8,5123:np.uint16,5125:np.uint32}[iacc['componentType']]
F=np.frombuffer(bytes(b[ioff:ioff+iacc['count']*np.dtype(dt).itemsize]),dt).astype(np.int64).reshape(-1,3)
low=(V[F][:,:,1]<ymax).all(1)
if o.get('--cut',1)>0:        # ★ 자리로 가른다: 가랑이 아래에서 x=0 면을 걸치는 면 (뼈로 가르면 무게를 푼 뒤엔 못 잡는다)
    sx=np.sign(V[F][:,:,0]); cross=((sx>0).any(1)&(sx<0).any(1))&low
else:
    cross=np.zeros(len(F),bool)
s=side[F]
drop=cross.copy(); print(f'  가랑이 가름 — 지운 면 {int(cross.sum()):,} / {len(F):,}')
if lin>0:
    bj,bb=read_glb(body); bp=bj['meshes'][0]['primitives'][0]
    BV=np.asarray(acc_np(bj,bb,bp['attributes']['POSITION']),np.float32); BN=np.asarray(acc_np(bj,bb,bp['attributes']['NORMAL']),np.float32)
    d,idx=cKDTree(BV).query(V,k=1)
    toward=((N*BN[idx]).sum(1)<0)               # 법선이 몸 법선과 반대 = 몸을 향한 안감
    lining_v=(d<lin)&toward&(V[:,1]<ymax)
    lining=lining_v[F].all(1); drop|=lining; print(f'  안감 — 지운 면 {int(lining.sum()):,}')
keep=F[~drop].astype(dt).reshape(-1); b[ioff:ioff+keep.nbytes]=keep.tobytes(); iacc['count']=int(keep.size)
write_glb(js,bytes(b),out); print('✔',out)
