#!/usr/bin/env python3
"""옷 «아래»에 묻히는 몸 면을 지운다 — 크레딧 0. 뚫림을 «없앤다», 밀지 않는다.

⛔ 왜 있나 (2026-09-13 · 총괄)
  셔츠 정점을 몸 밖으로 «밀었더니»(glb_cloth_offset) 60% 가 몸 안쪽이었고 가슴에서 7.5cm 를 밀어
  삼각형이 늘어나 셔츠 가슴이 «찢어져» 보였다.
  ⇒ ★ 게임의 정석: 옷 아래 몸 면은 «안 그린다». 옷마다 몸 변형본을 하나씩 둔다.

무엇을 하나
  몸 정점마다 가장 가까운 옷 정점을 찾아, 옷 법선 기준으로 «안쪽»(옷이 덮는 쪽)이고 거리가 dmax 안이면 «덮임».
  세 꼭짓점이 모두 덮인 삼각형을 지운다. 뼈·웨이트·UV 는 그대로(정점은 안 지우고 면만 지운다).

쓰기
  python tools/char/glb_cull_under.py <몸_rigged.glb> <옷_rigged.glb> <날.glb> [--dmax=0.06] [--mask=날.json]

⚠ 이 자가 «안» 하는 것
  · 옷이 «안 덮는» 자리(목 구멍·소매 끝 근처)는 남는다 — 그 언저리에서 살짝 뚫릴 수 있다. 그건 눈으로
"""
import sys
import numpy as np
from scipy.spatial import cKDTree
sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_extract_part import read_glb, acc_np, write_glb

def main():
    a=[x for x in sys.argv[1:] if not x.startswith('--')]
    o={x.split('=')[0]:float(x.split('=')[1]) for x in sys.argv[1:] if x.startswith('--') and '=' in x and not x.startswith('--mask=')}
    body, cloth, out = a[0], a[1], a[2]; dmax=o.get('--dmax',0.06)
    cj,cb=read_glb(cloth); cp=cj['meshes'][0]['primitives'][0]
    CV=np.asarray(acc_np(cj,cb,cp['attributes']['POSITION']),np.float32); CN=np.asarray(acc_np(cj,cb,cp['attributes']['NORMAL']),np.float32)
    bj,bb=read_glb(body); bb=bytearray(bb); bp=bj['meshes'][0]['primitives'][0]
    BV=np.asarray(acc_np(bj,bb,bp['attributes']['POSITION']),np.float32)
    iacc=bj['accessors'][bp['indices']]; ibv=bj['bufferViews'][iacc['bufferView']]; ioff=ibv['byteOffset']+iacc.get('byteOffset',0)
    dt={5121:np.uint8,5123:np.uint16,5125:np.uint32}[iacc['componentType']]
    F=np.frombuffer(bytes(bb[ioff:ioff+iacc['count']*np.dtype(dt).itemsize]),dt).astype(np.int64).reshape(-1,3)
    d,idx=cKDTree(CV).query(BV,k=1)
    Nn=CN[idx]/np.maximum(np.linalg.norm(CN[idx],axis=1,keepdims=True),1e-9)
    sd=((BV-CV[idx])*Nn).sum(1)
    # ★ 안쪽만 잡으면 «뚫고 나온» 가슴(바깥)이 남는다. 셔츠가 몸통을 다 덮으니 안팎 가리지 않고 «가까우면» 덮인 것.
    #   머리는 셔츠 꼭대기보다 위라 빠지고, 소매 밖 팔·다리는 멀어서 빠진다.
    # ★ 몸통은 넓게(가슴 끝이 9cm 밖), 팔은 좁게(1.5cm) — 넓게만 하면 소매 «밖» 팔까지 지워 검은 띠가 난다
    torso=np.abs(BV[:,0])<0.2
    covered=((d<dmax)&torso | (d<0.015)&~torso)&(BV[:,1]<CV[:,1].max()-0.01)
    drop=covered[F].all(1)
    # ★ 지운 면 번호를 JSON 으로도 낸다(--mask=파일) — 게임 로더가 옷 여러 벌의 마스크를 «합집합»으로 쓰면
    #   옷 조합마다 몸 변형본을 따로 둘 필요가 없다 (2026-09-14). 면 번호는 «원본 몸(char_*_base_v19_rigged)» 기준.
    mk=[x.split('=',1)[1] for x in sys.argv[1:] if x.startswith('--mask=')]
    if mk:
        import json, os; json.dump({'body':os.path.basename(body),'cloth':os.path.basename(cloth),'faces':int(len(F)),'drop':[int(i) for i in np.nonzero(drop)[0]]},open(mk[0],'w'))
    keep=F[~drop].astype(dt).reshape(-1)
    bb[ioff:ioff+keep.nbytes]=keep.tobytes(); iacc['count']=int(keep.size)
    print(f'  몸 정점 {len(BV):,} · 덮인 정점 {int(covered.sum()):,} · 지운 면 {int(drop.sum()):,} / {len(F):,}')
    write_glb(bj,bytes(bb),out); print('✔',out)
if __name__=='__main__': main()
