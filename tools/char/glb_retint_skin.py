#!/usr/bin/env python3
"""텍스처에서 «살색 가까운 텍셀»만 target 쪽으로 물들인다(옷은 그대로). 크레딧 0.
쓰기: python tools/char/glb_retint_skin.py <in.glb> <out.glb> --skin=R,G,B --ctol=45 --target=245,212,190"""
import io, sys, numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_extract_part import read_glb, write_glb
a=[x for x in sys.argv[1:] if not x.startswith('--')]; o={x.split('=')[0]:x.split('=')[1] for x in sys.argv[1:] if x.startswith('--')}
skin=np.array([float(v) for v in o['--skin'].split(',')]); ctol=float(o.get('--ctol',45)); tgt=np.array([float(v) for v in o.get('--target','245,212,190').split(',')])
js,b0=read_glb(a[0]); p=js['meshes'][0]['primitives'][0]
mat=js['materials'][p['material']]; img=js['images'][js['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
bv=js['bufferViews'][img['bufferView']]; raw=bytes(b0[bv['byteOffset']:bv['byteOffset']+bv['byteLength']])
im=Image.open(io.BytesIO(raw)); arr=np.array(im.convert('RGBA')).astype(np.float64)
d=np.abs(arr[:,:,:3]-skin).max(2); w=np.clip(1-(d-ctol*0.6)/(ctol*0.6),0,1)        # 살색 안쪽 1 → 경계 0 (부드럽게)
gain=tgt/np.maximum(skin,1)
arr[:,:,:3]=np.clip(arr[:,:,:3]*(1+(gain-1)*w[:,:,None]),0,255)
out=Image.fromarray(arr.astype(np.uint8)).convert(im.mode); buf=io.BytesIO(); out.save(buf,'PNG'); new=buf.getvalue()
b=bytes(b0); b=b+bytes((4-len(b)%4)%4); bv['byteOffset']=len(b); bv['byteLength']=len(new); b=b+new; img['mimeType']='image/png'
js['buffers'][0]['byteLength']=len(b); write_glb(js,b,a[1]); print(f'  살색 텍셀 {100*(w>0.5).mean():.1f}% 물들임 ✔ {a[1]}')
