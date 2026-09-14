#!/usr/bin/env python3
"""마스크 JSON 여러 개를 «합집합»으로 몸에 적용해 옷 밑 면을 지운 몸을 낸다 — 크레딧 0.

⛔ 왜 있나 (2026-09-14 · 총괄)
  옷 조합마다 몸 변형본(*_body_v19_under_<옷>.glb)을 따로 두면 조합 수만큼 파일이 는다.
  ⇒ 옷마다 «지울 몸 면 번호» 를 masks/<옷>_mask.json 으로 두고(glb_cull_under --mask), 입힐 때 합쳐 쓴다.
     게임 로더도 같은 규칙(면 번호 합집합 → 인덱스 버퍼에서 뺌)으로 하면 된다.

쓰기
  python tools/char/glb_apply_masks.py <몸_rigged.glb> <날.glb> masks/a_mask.json [masks/b_mask.json …]
⚠ 마스크는 «그 몸 파일 이름» 기준이다(json 의 body). 다른 몸에 쓰면 멈춘다.
"""
import sys, json, os, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from glb_extract_part import read_glb, write_glb
body, out, masks = sys.argv[1], sys.argv[2], sys.argv[3:]
bj,bb=read_glb(body); bb=bytearray(bb); bp=bj['meshes'][0]['primitives'][0]
iacc=bj['accessors'][bp['indices']]; ibv=bj['bufferViews'][iacc['bufferView']]; ioff=ibv['byteOffset']+iacc.get('byteOffset',0)
dt={5121:np.uint8,5123:np.uint16,5125:np.uint32}[iacc['componentType']]
F=np.frombuffer(bytes(bb[ioff:ioff+iacc['count']*np.dtype(dt).itemsize]),dt).reshape(-1,3)
drop=np.zeros(len(F),bool)
for m in masks:
    d=json.load(open(m))
    if d['body']!=os.path.basename(body) or d['faces']!=len(F): raise SystemExit(f'⛔ {m}: 몸이 다르다 ({d["body"]} {d["faces"]} ≠ {os.path.basename(body)} {len(F)})')
    drop[d['drop']]=True
keep=F[~drop].reshape(-1); bb[ioff:ioff+keep.nbytes]=keep.tobytes(); iacc['count']=int(keep.size)
write_glb(bj,bytes(bb),out); print(f'  지운 면 {int(drop.sum()):,} / {len(F):,} (마스크 {len(masks)}) ✔ {out}')
