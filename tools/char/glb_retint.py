#!/usr/bin/env python3
"""GLB 의 베이스컬러 텍스처를 «채널별 배율»로 물들인다 — 정점 색 중앙값이 target 이 되게. 크레딧 0.

⛔ 왜 있나 (2026-09-14 · 총괄) — 박사님 「피부가 살색이 아니라 그런가」
  Meshy 가 구운 맨몸 텍스처 중앙값이 (191,176,162) — 회색 섞인 황갈색이라 마네킹처럼 보였다.
쓰기
  python tools/char/glb_retint.py <in.glb> <out.glb> --target=245,214,192 [--gamma=1.0]
    중앙값→target 으로 채널별 배율(클립 255). gamma>1 이면 어두운 데를 더 밝힌다.
"""
import io, sys, numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_extract_part import read_glb, acc_np, write_glb
a=[x for x in sys.argv[1:] if not x.startswith('--')]; o={x.split('=')[0]:x.split('=')[1] for x in sys.argv[1:] if x.startswith('--')}
tgt=np.array([float(v) for v in o.get('--target','245,214,192').split(',')]); g=float(o.get('--gamma',1.0))
js,b0=read_glb(a[0]); p=js['meshes'][0]['primitives'][0]
mat=js['materials'][p['material']]; img=js['images'][js['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
bv=js['bufferViews'][img['bufferView']]; off=bv['byteOffset']; raw=bytes(b0[off:off+bv['byteLength']])
im=Image.open(io.BytesIO(raw)); mode=im.mode; arr=np.array(im.convert('RGBA')).astype(np.float64)
UV=np.array(acc_np(js,b0,p['attributes']['TEXCOORD_0']),np.float32,copy=True); H,W=arr.shape[:2]
med=np.median(arr[np.clip((UV[:,1]*H).astype(int),0,H-1),np.clip((UV[:,0]*W).astype(int),0,W-1)][:,:3],0)
gain=tgt/np.maximum(med,1); print(f'  중앙값 {med.astype(int)} → {tgt.astype(int)} · 배율 {np.round(gain,3)}')
rgb=arr[:,:,:3]/255.0; rgb=np.power(rgb,1.0/g)*gain; arr[:,:,:3]=np.clip(rgb*255,0,255)
out=Image.fromarray(arr.astype(np.uint8)).convert(mode); buf=io.BytesIO(); out.save(buf,'PNG'); new=buf.getvalue()
# 텍스처 바이트를 «뒤에 새로 붙이고» bufferView 만 옮긴다 (옛 그림은 그대로 두어도 해가 없다)
b=bytes(b0); b=b+bytes((4-len(b)%4)%4)
bv['byteOffset']=len(b); bv['byteLength']=len(new); b=b+new; img['mimeType']='image/png'
js['buffers'][0]['byteLength']=len(b); write_glb(js,b,a[1]); print('✔',a[1])
