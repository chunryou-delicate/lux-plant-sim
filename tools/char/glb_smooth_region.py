#!/usr/bin/env python3
"""몸의 «한 구역»을 라플라시안으로 오래 풀어 봉우리를 없앤다 — 크레딧 0. 정점 수·차례·UV·다른 프리미티브는 그대로.

⛔ 왜 있나 (2026-09-14 · 총괄) — 박사님 「지직지직하고 매칭이 안 되는데」
  남캐 v19 = 여캐 v19 가슴을 «법선 방향으로 눌러» 지운 것(glb_flatten). 렌더러를 고치고 보니 눌린 자리가
  «접시»처럼 테두리가 서고 옆구리에 구멍(접힌 면 지운 자리)이 났다. 누르는 방식은 경계에서 단이 진다.
  ⇒ 구역 안 정점을 이웃 평균으로 «수백 번» 풀면 봉우리는 사라지고 경계는 저절로 이어진다(최소 곡면).
     구역 가장자리는 서서히(smoothstep) 힘을 줄여 단이 안 진다.

쓰기
  python tools/char/glb_smooth_region.py <in.glb> <out.glb> --y0=-0.14 --y1=0.30 --zmin=0 --xmax=0.24 [--iters=800] [--lam=0.5] [--edge=0.04] [--dsmooth=150]
    구역: y0≤y≤y1, z≥zmin, |x|≤xmax. edge 는 가장자리 완충 폭.
⚠ 첫 프리미티브(몸)만 푼다. 귀(둘째)는 구역 밖이라 그대로.
"""
import sys, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_apply_delta import read_glb, write_glb, span
a=[x for x in sys.argv[1:] if not x.startswith('--')]
o={x.split('=')[0]:float(x.split('=')[1]) for x in sys.argv[1:] if x.startswith('--')}
js,b=read_glb(a[0]); p=js['meshes'][0]['primitives'][0]
off,acc,bv=span(js,p['attributes']['POSITION']); n=acc['count']
V=np.frombuffer(bytes(b[off:off+n*12]),np.float32).reshape(n,3).astype(np.float64)
ib,iacc,ibv=span(js,p['indices']); dt={5121:np.uint8,5123:np.uint16,5125:np.uint32}[iacc['componentType']]
F=np.frombuffer(bytes(b[ib:ib+iacc['count']*np.dtype(dt).itemsize]),dt).astype(np.int64).reshape(-1,3)
# UV 쌍둥이(같은 자리 다른 번호)를 한 점으로 묶어 푼다 — 안 묶으면 이음선이 찢긴다
key=np.round(V/1e-5).astype(np.int64); _,grp=np.unique(key,axis=0,return_inverse=True); grp=grp.ravel(); ng=grp.max()+1
E=np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]); E=grp[np.concatenate([E,E[:,::-1]])]
E=np.unique(E,axis=0); E=E[E[:,0]!=E[:,1]]
deg=np.maximum(np.bincount(E[:,0],minlength=ng),1).astype(np.float64)
P=np.zeros((ng,3)); np.add.at(P,grp,V); P/=np.bincount(grp,minlength=ng)[:,None]
def ss(t): t=np.clip(t,0,1); return t*t*(3-2*t)
e=o.get('--edge',0.04)
w=ss((P[:,1]-o['--y0'])/e)*ss((o['--y1']-P[:,1])/e)*ss((P[:,2]-o.get('--zmin',0))/e)*ss((o.get('--xmax',0.24)-np.abs(P[:,0]))/e)
lam=o.get('--lam',0.5); it=int(o.get('--iters',800))
print(f'  구역 정점 {int((w>0).sum()):,} (완전 {int((w>=0.999).sum()):,}) · {it}번')
for _ in range(it):
    m=np.zeros_like(P); np.add.at(m,E[:,0],P[E[:,1]]); m/=deg[:,None]
    P+=lam*w[:,None]*(m-P)
# ★ 옮긴 양(D)을 그물 전체에서 다시 풀어 구역 가장자리의 «단»을 없앤다 (--dsmooth 번)
ds=int(o.get('--dsmooth',150))
if ds>0:
    P0=np.zeros((ng,3)); np.add.at(P0,grp,V); P0/=np.bincount(grp,minlength=ng)[:,None]
    D=P-P0
    for _ in range(ds):
        m=np.zeros_like(D); np.add.at(m,E[:,0],D[E[:,1]]); D=0.5*D+0.5*m/deg[:,None]
    P=P0+D
V2=P[grp].astype(np.float32)
mv=np.linalg.norm(V2-V,axis=1); print(f'  옮긴 정점 {int((mv>1e-6).sum()):,} · 최대 {mv.max():.4f}')
b[off:off+n*12]=V2.tobytes(); acc['min']=[float(x) for x in V2.min(0)]; acc['max']=[float(x) for x in V2.max(0)]
ni=p['attributes'].get('NORMAL')
if ni is not None:
    fn=np.cross(V2[F[:,1]]-V2[F[:,0]],V2[F[:,2]]-V2[F[:,0]]); N=np.zeros_like(V2)
    for c in (F[:,0],F[:,1],F[:,2]): np.add.at(N,c,fn)
    Ng=np.zeros((ng,3),np.float32); np.add.at(Ng,grp,N); N=Ng[grp]           # 쌍둥이 법선도 같이
    L=np.linalg.norm(N,axis=1,keepdims=True); N=N/np.where(L<1e-12,1,L)
    nb,nacc,nbv=span(js,ni); b[nb:nb+n*12]=N.astype(np.float32).tobytes()
write_glb(js,b,a[1]); print('✔',a[1])
