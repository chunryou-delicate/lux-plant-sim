#!/usr/bin/env python3
"""머리카락의 뼈 무게를 «머리·목·척추 뼈에서만» 다시 이식한다 — 크레딧 0.

⛔ 왜 있나 (2026-09-13 · 총괄)
  transfer_weights(최근접 복사)로 이식한 머리카락을 걷게 했더니 ⇒ 어깨 옆 머리카락이 «팔 뼈»에 물려
  팔을 따라가며 찢어졌다(WALK_yeoja.png). 긴 머리는 팔 옆을 지나가지만 팔 것이 아니다.
  ⇒ ★ 몸 정점 중 «주 뼈가 머리·목·척추·골반»인 것들만 후보로 두고 최근접 복사한다.

쓰기
  python tools/char/glb_reweight_hair.py <몸_rigged.glb> <머리_rigged.glb> <날.glb>
⚠ 팔·다리·손·발·어깨 뼈 무게는 «없다». 머리카락이 팔에 닿아도 팔은 못 밀어낸다(그건 물리 몫).
"""
import sys, numpy as np
from scipy.spatial import cKDTree
sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_extract_part import read_glb, acc_np, write_glb
BAD=('Arm','Hand','Shoulder','Leg','Foot','Toe')
def main():
    body, hair, out = sys.argv[1:4]
    bj,bb=read_glb(body); bp=bj['meshes'][0]['primitives'][0]; sk=bj['skins'][0]
    names=[bj['nodes'][j]['name'] for j in sk['joints']]
    ok_joint=np.array([not any(k in n for k in BAD) for n in names])
    BV=np.asarray(acc_np(bj,bb,bp['attributes']['POSITION']),np.float32)
    BJ=np.asarray(acc_np(bj,bb,bp['attributes']['JOINTS_0']),np.int64); BW=np.asarray(acc_np(bj,bb,bp['attributes']['WEIGHTS_0']),np.float32)
    dom=BJ[np.arange(len(BJ)),BW.argmax(1)]
    cand=ok_joint[dom] & (BW.max(1)>0.6)
    print(f'  허용 뼈 {int(ok_joint.sum())}/{len(names)}: {[n for n,o in zip(names,ok_joint) if o]}')
    print(f'  후보 몸 정점 {int(cand.sum()):,} / {len(BV):,}')
    hj,hb=read_glb(hair); hb=bytearray(hb); hp=hj['meshes'][0]['primitives'][0]
    HV=np.asarray(acc_np(hj,hb,hp['attributes']['POSITION']),np.float32)
    d,idx=cKDTree(BV[cand]).query(HV,k=1); src=np.where(cand)[0][idx]
    # 무게 되써 넣기 (JOINTS_0 ushort/ubyte · WEIGHTS_0 float)
    for key,arr in (('JOINTS_0',BJ[src]),('WEIGHTS_0',BW[src])):
        acc=hj['accessors'][hp['attributes'][key]]; bv=hj['bufferViews'][acc['bufferView']]; off=bv['byteOffset']+acc.get('byteOffset',0)
        dt={5121:np.uint8,5123:np.uint16,5125:np.uint32,5126:np.float32}[acc['componentType']]
        raw=arr.astype(dt).tobytes(); hb[off:off+len(raw)]=raw
    print(f'  머리 정점 {len(HV):,} · 최근접 거리 중앙값 {np.median(d):.4f} · 90% {np.percentile(d,90):.4f}')
    write_glb(hj,bytes(hb),out); print('✔',out)
if __name__=='__main__': main()
