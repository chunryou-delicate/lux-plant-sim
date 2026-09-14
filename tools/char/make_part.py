#!/usr/bin/env python3
"""«몸째 구운» GLB 한 장에서 부품 하나를 끝까지 만든다 — 떼기 → 다시 감싸 맞추기 → 리깅 공간 → 무게 이식.

쓰기
  python tools/char/make_part.py <구운.glb> <몸_리깅전.glb> <몸_리깅.glb> <날_rigged.glb> --kind=hair|cloth
        --skin=R,G,B [--ctol=45] (--mode=notcolors --excl=R,G,B;R,G,B | --mode=near --target=R,G,B)
  · hair  : 떼기(notcolors) → icp 맞춤 → 리깅 공간 → 머리·목·척추 뼈에서만 무게(glb_reweight_hair)
  · cloth : 떼기 → icp 맞춤 → 다시 감싸 맞추기(refit) → 리깅 공간 → 몸에서 무게(transfer_weights)
⚠ 낸 뒤 glb_pose_shot 으로 «걷게 찍어» 봐라. 이 자는 잘 움직이는지 모른다.
"""
import sys, subprocess, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_extract_part import read_glb, acc_np, write_glb
def P(path):
    js,b=read_glb(path); return np.concatenate([np.asarray(acc_np(js,b,p['attributes']['POSITION']),np.float32) for m in js['meshes'] for p in m['primitives']])
def run(cmd):
    r=subprocess.run([sys.executable]+cmd,capture_output=True,text=True,encoding='utf-8'); print(r.stdout.strip()); 
    if r.returncode: print(r.stderr[-800:]); raise SystemExit(cmd[0])
def main():
    a=[x for x in sys.argv[1:] if not x.startswith('--')]; o=[x for x in sys.argv[1:] if x.startswith('--')]
    baked, body_u, body_r, out = a[:4]
    opt={x.split('=')[0]:x.split('=',1)[1] for x in o}
    kind=opt.get('--kind','cloth'); tmp=out.replace('.glb','')
    ex=[x for x in o if x.split('=')[0] in ('--skin','--ctol','--mode','--excl','--target','--dark','--dmin','--ymin','--ymax','--xmax','--fill','--smooth')]
    import os
    if opt.get('--from-part')=='1' and os.path.exists(tmp+'_part.glb'):
        print('  (뗀 것 그대로 씀 — refit 부터 다시)')             # 2026-09-14 refit 매끈 고침 뒤 129벌 다시 감쌀 때
    else:
        run(['tools/char/glb_extract_part.py',baked,body_u,tmp+'_part.glb','--align='+opt.get('--align','icp')]+ex)
    src=tmp+'_part.glb'
    if kind=='cloth':
        run(['tools/char/glb_refit_cloth.py',baked,body_u,src,tmp+'_fit.glb']+[x for x in o if x.split('=')[0] in ('--skin','--ctol','--smooth')]); src=tmp+'_fit.glb'
    U=P(body_u); R=P(body_r); s=float(np.median((R.max(0)-R.min(0))/(U.max(0)-U.min(0)))); t=R.min(0)-U.min(0)*s
    js,b=read_glb(src); b=bytearray(b); p=js['meshes'][0]['primitives'][0]; acc=js['accessors'][p['attributes']['POSITION']]; bv=js['bufferViews'][acc['bufferView']]; off=bv['byteOffset']; n=acc['count']
    V=np.frombuffer(bytes(b[off:off+n*12]),np.float32).reshape(n,3)*s+t; b[off:off+n*12]=V.astype(np.float32).tobytes(); acc['min']=[float(x) for x in V.min(0)]; acc['max']=[float(x) for x in V.max(0)]
    write_glb(js,bytes(b),tmp+'_rig.glb')
    run(['tools/char/transfer_weights.py',body_r,tmp+'_rig.glb',out])
    if kind=='hair': run(['tools/char/glb_reweight_hair.py',body_r,out,out])
    print('★',out)
if __name__=='__main__': main()
