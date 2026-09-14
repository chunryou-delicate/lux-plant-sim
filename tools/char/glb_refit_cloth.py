#!/usr/bin/env python3
"""옷을 «구운 몸»에서 «우리 몸(v19)»으로 다시 감싸 맞춘다 — 가슴 굴곡을 살린다. 크레딧 0.

⛔ 왜 있나 (2026-09-13 · 총괄) — 박사님 「여캐 옷은 가슴 굴곡을 살려야지」
  몸째 구운 셔츠는 «구운 몸»의 가슴(작다)에 맞춰져 있다. v19 에 입히면 가슴이 뚫고 나와서
  몸 면을 지워 가렸는데 ⇒ 그러면 옷이 «평평»하다. 정점을 밀면(glb_cloth_offset) 삼각형이 늘어나 찢긴다.
  ⇒ ★ 옷 정점마다 «구운 몸에서 가장 가까운 살 점 b» 를 찾고, b 가 «v19 에서는 어디인가(q)» 를 찾아
     그 차이(q-b)를 옷에 더한다. 옷이 몸을 «따라 옮겨지므로» 굴곡이 그대로 살고 찢기지 않는다.
     (차이는 이웃 k 개의 평균으로 매끈하게)

쓰기
  python tools/char/glb_refit_cloth.py <구운.glb> <몸v19(리깅전).glb> <옷(몸v19공간).glb> <날.glb> [--skin=R,G,B] [--ctol=45] [--k=12] [--smooth=30]
    구운.glb 는 extract 때 쓴 그 판(살색 정점이 있어야 «구운 몸»을 안다). 옷은 v19 공간(리깅 전)이어야 한다.

⚠ 이 자가 «안» 하는 것
  · 구운 몸의 살이 옷에 가려 «없는» 자리(몸통 안쪽)는 가장 가까운 살(팔·목·다리)의 차이를 쓴다 — 대개 작다
"""
import io, sys, numpy as np
from PIL import Image
from scipy.spatial import cKDTree
sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_extract_part import read_glb, acc_np, write_glb, texture_of
def main():
    a=[x for x in sys.argv[1:] if not x.startswith('--')]
    o={x.split('=')[0]:x.split('=')[1] for x in sys.argv[1:] if x.startswith('--') and '=' in x}
    baked, body, cloth, out = a[:4]
    skin=np.array([float(v) for v in o.get('--skin','206,194,182').split(',')]); ctol=float(o.get('--ctol',45)); k=int(o.get('--k',12))
    bj,bb=read_glb(baked); p=bj['meshes'][0]['primitives'][0]
    V=np.asarray(acc_np(bj,bb,p['attributes']['POSITION']),np.float32); UV=np.asarray(acc_np(bj,bb,p['attributes']['TEXCOORD_0']),np.float32)
    tex=texture_of(bj,bb,p); H,W=tex.shape[:2]
    col=tex[np.clip((UV[:,1]*H).astype(int),0,H-1), np.clip((UV[:,0]*W).astype(int),0,W-1)].astype(np.float32)
    is_skin=np.abs(col-skin).max(1)<=ctol
    mj,mb=read_glb(body); M=np.concatenate([np.asarray(acc_np(mj,mb,q['attributes']['POSITION']),np.float32) for m in mj['meshes'] for q in m['primitives']])
    # 구운 몸을 v19 에 맞추는 배율·이동 — extract 와 같은 icp
    src=V[is_skin]; tm=cKDTree(M); s,t=1.0,np.zeros(3)
    for _ in range(8):
        dd,ii=tm.query(src*s+t,k=1); ok=dd<np.percentile(dd,80); A_,B_=src[ok],M[ii[ok]]; ca,cb=A_.mean(0),B_.mean(0)
        s=float(((A_-ca)*(B_-cb)).sum()/((A_-ca)**2).sum()); t=cb-ca*s
    S=src*s+t                                           # 구운 살(v19 공간)
    dq,iq=tm.query(S,k=1); delta=M[iq]-S                # 살 점마다 «v19 로 가는 차이»
    print(f'  구운 살 점 {len(S):,} · v19 까지 중앙값 {np.median(dq):.4f} · 90% {np.percentile(dq,90):.4f}')
    cj,cb=read_glb(cloth); cb=bytearray(cb); cp=cj['meshes'][0]['primitives'][0]
    acc=cj['accessors'][cp['attributes']['POSITION']]; bv=cj['bufferViews'][acc['bufferView']]; off=bv['byteOffset']; n=acc['count']
    C=np.frombuffer(bytes(cb[off:off+n*12]),np.float32).reshape(n,3).copy()
    d,ii=cKDTree(S).query(C,k=k); w=1.0/np.maximum(d,1e-4); w/=w.sum(1,keepdims=True)
    D=(delta[ii]*w[:,:,None]).sum(1)
    print(f'  옷 점 {n:,} · 옮긴 양 중앙값 {np.median(np.linalg.norm(D,axis=1)):.4f} · 최대 {np.linalg.norm(D,axis=1).max():.4f}')
    # ★ 옮긴 양을 옷 그물 위에서 매끈하게 (2026-09-14 · 박사님 「지직지직」) — 점마다 따로 옮기니 이웃끼리 어긋나
    #   면이 2% 꺾여(90도 넘게) 옷 전체가 오돌토돌했다. 이웃 평균으로 smooth 번 풀면 «옮기는 양»만 매끈해지고 옷 모양은 그대로.
    sm=int(o.get('--smooth',30))
    if sm>0:
        F=np.asarray(acc_np(cj,cb,cp['indices']),np.int64).reshape(-1,3)
        E=np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]); E=np.concatenate([E,E[:,::-1]])
        # UV 이음선 쌍둥이(같은 자리 다른 번호)도 한 점으로 — 위치로 묶는다
        key=np.round(C/1e-4).astype(np.int64); _,grp=np.unique(key,axis=0,return_inverse=True); grp=grp.ravel()
        Eg=grp[E]; ng=grp.max()+1
        deg=np.bincount(Eg[:,0],minlength=ng).astype(np.float32); deg=np.maximum(deg,1)
        Dg=np.zeros((ng,3),np.float32); np.add.at(Dg,grp,D); cntg=np.bincount(grp,minlength=ng).astype(np.float32); Dg/=cntg[:,None]
        for _ in range(sm):
            acc_=np.zeros_like(Dg); np.add.at(acc_,Eg[:,0],Dg[Eg[:,1]]); Dg=0.5*Dg+0.5*acc_/deg[:,None]
        D=Dg[grp]
        print(f'  매끈하게 {sm}번 · 옮긴 양 중앙값 {np.median(np.linalg.norm(D,axis=1)):.4f}')
    C+=D; cb[off:off+n*12]=C.astype(np.float32).tobytes(); acc['min']=[float(x) for x in C.min(0)]; acc['max']=[float(x) for x in C.max(0)]
    write_glb(cj,bytes(cb),out); print('✔',out)
if __name__=='__main__': main()
