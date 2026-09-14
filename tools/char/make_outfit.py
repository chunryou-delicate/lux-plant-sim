#!/usr/bin/env python3
"""«몸째 구운» 옷 판을 자르지 않고 통째로 v19 뼈대에 올린다 — 옷 입은 몸 한 벌. 크레딧 0.

⛔ 왜 있나 (2026-09-14 · 총괄) — 박사님 「스샷 중 정상인 게 없는 듯」
  구운 판에서 색으로 옷을 «떼어» 몸에 얹는 방식은 가장자리가 너덜거리고(떼기 경계), 살색 가까운 옷은 구멍이 나고,
  몸이 뚫고 나온다. 구운 판 자체는 닫힌 깨끗한 메시다. ⇒ ★ 자르지 말고 «옷 입은 몸» 통째로 쓴다.
  대신 상·하·신발 조합은 굽기 단위로 고정된다(머리·눈은 따로 얹는다).

무엇을 하나
  1) 구운 판을 v19(리깅 전)에 icp 로 맞춘다(살색 점 기준)  2) 리깅 공간으로 옮긴다
  3) v19 리깅판에서 무게를 이식한다(이웃 섞기+풀기)  4) 가랑이 가름  5) 살색을 v19 와 같은 복숭아빛으로
쓰기
  python tools/char/make_outfit.py <구운.glb> <몸_리깅전.glb> <몸_리깅.glb> <날_rigged.glb> --skin=R,G,B [--ctol=45] [--smooth=60] [--tint=245,212,190]
"""
import sys, os, subprocess, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_extract_part import read_glb, acc_np, write_glb
def P(path):
    js,b=read_glb(path); return np.concatenate([np.asarray(acc_np(js,b,p['attributes']['POSITION']),np.float32) for m in js['meshes'] for p in m['primitives']])
def run(cmd):
    r=subprocess.run([sys.executable]+cmd,capture_output=True,text=True,encoding='utf-8'); print(r.stdout.strip())
    if r.returncode: print(r.stderr[-800:]); raise SystemExit(cmd[0])
a=[x for x in sys.argv[1:] if not x.startswith('--')]; o={x.split('=')[0]:x.split('=',1)[1] for x in sys.argv[1:] if x.startswith('--')}
baked, body_u, body_r, out = a[:4]; tmp=out.replace('.glb','')
if '--skin' not in o:                      # ★ 살색 자동 — 머리(위 12%)는 늘 맨살이니 그 정점 색 중앙값
    from glb_extract_part import texture_of
    js0,b0=read_glb(baked); p0=js0['meshes'][0]['primitives'][0]
    V0=np.asarray(acc_np(js0,b0,p0['attributes']['POSITION']),np.float32); UV0=np.asarray(acc_np(js0,b0,p0['attributes']['TEXCOORD_0']),np.float32)
    tex=texture_of(js0,b0,p0); H,W=tex.shape[:2]; col=tex[np.clip((UV0[:,1]*H).astype(int),0,H-1),np.clip((UV0[:,0]*W).astype(int),0,W-1)]
    top=V0[:,1]>V0[:,1].max()-(V0[:,1].max()-V0[:,1].min())*0.12
    o['--skin']=','.join(str(int(v)) for v in np.median(col[top],0)); print('  살색(머리에서)',o['--skin'])
run(['tools/char/glb_extract_part.py',baked,body_u,tmp+'_part.glb','--align=icp','--mode=dist','--dmin=-1','--fill=0','--skin='+o.get('--skin','240,215,195'),'--ctol='+o.get('--ctol','45')])
U=P(body_u); R=P(body_r); s=float(np.median((R.max(0)-R.min(0))/(U.max(0)-U.min(0)))); t=R.min(0)-U.min(0)*s
js,b=read_glb(tmp+'_part.glb'); b=bytearray(b); p=js['meshes'][0]['primitives'][0]; acc=js['accessors'][p['attributes']['POSITION']]; bv=js['bufferViews'][acc['bufferView']]; off=bv['byteOffset']; n=acc['count']
V=np.frombuffer(bytes(b[off:off+n*12]),np.float32).reshape(n,3)*s+t; b[off:off+n*12]=V.astype(np.float32).tobytes(); acc['min']=[float(x) for x in V.min(0)]; acc['max']=[float(x) for x in V.max(0)]
write_glb(js,bytes(b),tmp+'_rig.glb')
run(['tools/char/transfer_weights.py',body_r,tmp+'_rig.glb',out,'--smooth='+o.get('--smooth','60')])
run(['tools/char/glb_split_legs.py',body_r,out,out,'--ymax=0.60','--cut=1'])
if o.get('--tint','245,212,190')!='0':
    run(['tools/char/glb_retint_skin.py',out,out,'--skin='+o.get('--skin','240,215,195'),'--ctol='+o.get('--ctol','45'),'--target='+o.get('--tint','245,212,190')])
print('★',out)
