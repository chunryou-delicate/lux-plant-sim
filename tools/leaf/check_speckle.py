# -*- coding: utf-8 -*-
"""텍스처의 「탄색 얼룩」이 잎의 **보이는 면**에 앉는지 UV 로 되짚는다 (브라우저 없이)."""
import sys, io, os, struct, json
sys.path.insert(0, 'tools/leaf')
import numpy as np
from PIL import Image
from recolor_calm import read, to_hsv

CT={5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def acc(js,bb,i):
    a=js['accessors'][i]; bv=js['bufferViews'][a['bufferView']]
    n=NC[a['type']]; fmt,sz=CT[a['componentType']]
    base=bv.get('byteOffset',0)+a.get('byteOffset',0)
    stride=bv.get('byteStride') or n*sz
    o=np.empty((a['count'],n),dtype=np.dtype(fmt))
    for k in range(a['count']): o[k]=struct.unpack_from('<'+fmt*n,bb,base+k*stride)
    return o

def run(path, label):
    js,bb=read(path)
    im0=js['images'][0]; bv=js['bufferViews'][im0['bufferView']]; s0=bv.get('byteOffset',0)
    tex=Image.open(io.BytesIO(bb[s0:s0+bv['byteLength']])).convert('RGB')
    T=np.asarray(tex,dtype=float)/255.0
    H,W=T.shape[:2]
    h,s,v=to_hsv(T)
    tan=((h>=10)&(h<=55)&(s>0.12))            # 벽돌·녹·주황·겨자·갈색
    pr=js['meshes'][0]['primitives'][0]
    P=acc(js,bb,pr['attributes']['POSITION']).astype(float)
    N=acc(js,bb,pr['attributes']['NORMAL']).astype(float)
    UV=acc(js,bb,pr['attributes']['TEXCOORD_0']).astype(float)
    IDX=acc(js,bb,pr['indices']).astype(int).ravel()
    tri=IDX.reshape(-1,3)
    # 삼각형마다 UV 네 점(꼭짓점 3 + 무게중심)을 찍어 본다
    pts=[]
    for w in ((1,0,0),(0,1,0),(0,0,1),(1/3,1/3,1/3)):
        uv = w[0]*UV[tri[:,0]] + w[1]*UV[tri[:,1]] + w[2]*UV[tri[:,2]]
        pts.append(uv)
    hit=np.zeros(len(tri),dtype=bool)
    for uv in pts:
        px=np.clip((uv[:,0]*W).astype(int),0,W-1); py=np.clip(((1-uv[:,1])*H).astype(int),0,H-1)
        hit |= tan[py,px]
    ny = (N[tri[:,0],1]+N[tri[:,1],1]+N[tri[:,2],1])/3.0     # 위를 보면 +
    a=P[tri[:,1]]-P[tri[:,0]]; b=P[tri[:,2]]-P[tri[:,0]]
    area=0.5*np.linalg.norm(np.cross(a,b),axis=1)
    up = ny > 0.2; dn = ny < -0.2
    tot=area.sum()
    print('== %s ==' % label)
    print('   텍스처에서 탄색 화소 %5.1f%%' % (100*tan.mean()))
    print('   탄색을 문 삼각형     %5.1f%%  (넓이로 %5.1f%%)' % (100*hit.mean(), 100*area[hit].sum()/tot))
    for nm,m in (('위를 보는 면',up),('아래를 보는 면',dn),('옆면',~up&~dn)):
        if m.sum()==0: continue
        print('     %-12s 그 면의 넓이 중 탄색 %5.1f%%   (잎 전체 넓이의 %4.1f%%)'
              % (nm, 100*area[m&hit].sum()/max(area[m].sum(),1e-9), 100*area[m].sum()/tot))

if __name__=='__main__':
    for p,l in [('assets/monstera/skins/heart_lime_2672_0_v2.glb','heart_lime_2672_0_v2 (오늘 고친 것)'),
                ('assets/monstera/skins/mon_neon_lime_v2.glb','mon_neon_lime_v2 (오늘 고친 것)'),
                ('assets/monstera/skins/heart_lime_2672_0.glb','heart_lime_2672_0 (기본 · 견줄 것)')]:
        run(p,l); print()
